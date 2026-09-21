"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import {
  BadgeCheckIcon,
  BookOpenIcon,
  CheckIcon,
  ChevronLeftIcon,
  CopyCheckIcon,
  LoaderCircleIcon,
  LockKeyholeIcon,
  MailIcon,
  PackageCheckIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
  WalletIcon,
} from "lucide-react"
import { purchaseCourse } from "@/lib/actions/enrollments"
import { getMyWalletBalance, type MyWalletBalance } from "@/lib/actions/wallet"
import { saveEnrollmentIntent } from "@/lib/actions/enrollment-intent"
import type { ProgramDetail, PublicPackage } from "@/lib/actions/student"
import { queryKeys } from "@/lib/hooks/queries/keys"
import { PACKAGE_LABEL } from "@/lib/entitlements"
import { BRAND } from "@/lib/brand"
import { SCHOOL_BY_SLUG, type SchoolSlug } from "@/lib/schools"
import { cn } from "@/lib/utils"
import { RollingAmount } from "@/components/ui/rolling-amount"
import { Disclosure } from "@/components/checkout/disclosure"
import { MobileSummary, OrderCard } from "@/components/checkout/order-summary"
import { Appear, PayButton, ShortfallPanel, type PayPhase } from "@/components/checkout/payment-parts"
import {
  LEVEL_LABEL,
  centsUsd,
  lengthLabel,
  packageLine,
  packageServices,
  splitFeatures,
  wholeUsd,
} from "@/components/checkout/order-lines"

/** What the curriculum says about this order — counted from published lessons, never the stored counters. */
export type CheckoutFacts = {
  /** Published lessons on the program. */
  lessons: number
  /** Of those, the ones the chosen package opens. */
  openLessons: number
  /** Video length of the lessons the chosen package opens, in seconds. */
  openVideoSec: number
}

/** One saved choice per program + package. */
function intentKeyOf(courseId: string, packageKey: PublicPackage["key"] | null): string {
  return `${courseId}:${packageKey ?? ""}`
}

/** Save this order as the learner's saved school. Resolves true once stored; never rejects. */
function saveCheckoutIntent(
  school: SchoolSlug,
  courseId: string,
  packageKey: PublicPackage["key"] | null
): Promise<boolean> {
  return saveEnrollmentIntent({ school, courseId, packageKey, source: "checkout" }).then(
    (result) => result.success,
    () => false
  )
}

/**
 * The checkout itself. The page (a server component) has already decided
 * everything that can be decided before the buyer acts: the program exists
 * and is live, the buyer isn't enrolled, and the package is the one they chose
 * on the program page. So there is no package picker here — only the order,
 * the wallet, and one button.
 *
 * Desktop: order details on the left, the payment card pinned on the right.
 * Phone: a collapsible order summary under the header (Shopify's pattern), the
 * payment card first, the details after, and the pay button in a bar pinned
 * to the bottom of the screen.
 */
export function CheckoutView({
  program,
  packageKey,
  wallet: initialWallet,
  facts,
  reservedSeat,
}: {
  program: ProgramDetail
  packageKey: PublicPackage["key"]
  wallet: MyWalletBalance
  facts: CheckoutFacts
  /** The buyer holds a pre-launch reservation on this program; paying activates it. */
  reservedSeat: boolean
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const selected = program.packages.find((p) => p.key === packageKey) ?? program.packages[0]

  const [wallet, setWallet] = React.useState(initialWallet)
  const [phase, setPhase] = React.useState<PayPhase>("idle")
  const [error, setError] = React.useState<string | null>(null)
  // What the wallet itself reported on a declined debit. It outranks the
  // balance read below until the buyer refreshes that read.
  const [declinedShortfallMinor, setDeclinedShortfallMinor] = React.useState<number | null>(null)
  const [refreshing, setRefreshing] = React.useState(false)
  const [savingLater, setSavingLater] = React.useState(false)
  const [saveLaterError, setSaveLaterError] = React.useState<string | null>(null)
  // The save of this order as the learner's saved school, keyed by what it
  // saved. "Save and pay later" and the wallet round trip wait on it: both
  // lead into `(platform)`, whose school-first gate would bounce a brand-new
  // learner away if they arrived before the save landed.
  const intentSaveRef = React.useRef<{ key: string; done: Promise<boolean> } | null>(null)

  const price = selected.price
  const priceMinor = Math.round(price * 100)
  const isPaid = priceMinor > 0
  // The wallet is the only way a paid seat is bought, so when it is off the
  // purchase cannot succeed — `purchaseCourse` fails closed before it touches
  // money. Say so before the click rather than after it. A free program needs
  // no debit, so it is never blocked.
  const payBlocked = isPaid && !wallet.enabled
  // The balance read is real, so a shortfall is known before the click. The
  // server still decides: it debits or declines, and a decline's own figure
  // wins (`declinedShortfallMinor`).
  const knownShortfallMinor = isPaid && wallet.enabled ? Math.max(0, priceMinor - wallet.usdAvailableMinor) : 0
  const shortfallMinor = declinedShortfallMinor ?? (knownShortfallMinor > 0 ? knownShortfallMinor : null)
  const shortfall = !payBlocked && shortfallMinor !== null && shortfallMinor > 0

  const school = program.school ? SCHOOL_BY_SLUG[program.school] : null
  const multiTier = program.tierCount > 1
  const line = packageLine(program, selected)
  const programHref = `/programs/${program.slug}`
  const changeHref = `${programHref}?package=${selected.key}#packages`

  // Reaching checkout IS choosing (Phase 9): remember it, so an order the
  // buyer walks away from can be finished from the dashboard, and the
  // wallet-funding round trip is never stopped by the school-first gate. Its
  // own effect, keyed on plain values, so it saves once per program + package
  // and never again for a re-render. A program with no school (legacy) saves
  // nothing; a program without a ladder saves no package key.
  const intentSchool = program.school
  const intentCourseId = program.id
  const intentPackageKey = program.tierCount > 0 ? selected.key : null

  React.useEffect(() => {
    if (!intentSchool) return
    intentSaveRef.current = {
      key: intentKeyOf(intentCourseId, intentPackageKey),
      done: saveCheckoutIntent(intentSchool, intentCourseId, intentPackageKey),
    }
  }, [intentSchool, intentCourseId, intentPackageKey])

  /** Waits for this order's save; re-attempts it once if it failed or never started. */
  async function ensureIntentSaved(): Promise<boolean> {
    if (!intentSchool) return false
    const key = intentKeyOf(intentCourseId, intentPackageKey)
    const current = intentSaveRef.current
    if (current?.key === key && (await current.done)) return true
    const retry = { key, done: saveCheckoutIntent(intentSchool, intentCourseId, intentPackageKey) }
    intentSaveRef.current = retry
    return retry.done
  }

  async function saveForLater() {
    setSaveLaterError(null)
    setSavingLater(true)
    if (await ensureIntentSaved()) {
      // Stays pending through the navigation.
      router.push("/dashboard?saved=1")
      return
    }
    setSaveLaterError("Couldn't save your choice — try again.")
    setSavingLater(false)
  }

  async function refreshBalance() {
    setRefreshing(true)
    const next = await getMyWalletBalance().catch(() => null)
    if (next) {
      setWallet(next)
      // A fresh read replaces the declined figure: if the buyer topped up in
      // another tab, the page should let them pay now.
      setDeclinedShortfallMinor(null)
    }
    setRefreshing(false)
  }

  async function openFunding() {
    // Internal wallet deposit page (default): navigate in-tab with the
    // shortfall prefilled and a redirect straight back to this checkout.
    if (wallet.fundingUrl.startsWith("/")) {
      // The deposit page sits behind the school-first gate: let the save land
      // first. Navigate either way — a learner who already has a school or an
      // enrollment is never gated.
      await ensureIntentSaved()
      const returnTo = `${window.location.pathname}${window.location.search}`
      const params = new URLSearchParams({ redirect: returnTo })
      if (shortfallMinor && shortfallMinor > 0) params.set("suggestMinor", String(shortfallMinor))
      router.push(`${wallet.fundingUrl}?${params.toString()}`)
      return
    }
    // External override (central dashboard) — keep the legacy new-tab flow.
    const returnTo = window.location.href
    const url = `${wallet.fundingUrl}${wallet.fundingUrl.includes("?") ? "&" : "?"}redirect=${encodeURIComponent(returnTo)}`
    window.open(url, "_blank", "noopener")
  }

  async function handlePurchase() {
    if (phase !== "idle") return
    setPhase("processing")
    setError(null)

    try {
      // The server derives identity from the session and the price from the
      // course's package; enrollment is only granted after the central
      // WorldStreet wallet confirms the debit. No optimistic success. A program
      // without a package ladder (tierCount 0) shows one synthesized tier — the
      // server ignores a key there, so none is sent.
      const result = await purchaseCourse({
        courseId: program.id,
        packageKey: program.tierCount > 0 ? selected.key : undefined,
      })

      if (result.success) {
        // Money moved outside the query cache — mark every wallet figure
        // stale, the top bar's balance chip included.
        queryClient.invalidateQueries({ queryKey: queryKeys.wallet })
        setPhase("success")
        // `new=1` only words the confirmation ("a confirmation email is on its
        // way"); what it confirms is read from the enrollment, never the URL.
        // A replayed purchase (already enrolled) sent no new email.
        const fresh = result.data.alreadyEnrolled ? "" : "&new=1"
        router.push(`/dashboard/checkout/success?courseId=${program.id}${fresh}`)
        return
      }

      if (result.code === "insufficient_funds") {
        setDeclinedShortfallMinor(result.shortfallMinor ?? null)
        if (typeof result.availableMinor === "number") {
          const availableMinor = result.availableMinor
          setWallet((w) => ({ ...w, usdAvailableMinor: availableMinor, usdAvailable: availableMinor / 100 }))
        }
      } else {
        setError(result.error || "Something went wrong. You have not been charged.")
      }
      setPhase("idle")
    } catch {
      setError("Something went wrong. You have not been charged.")
      setPhase("idle")
    }
  }

  const busy = phase !== "idle"

  /** The page's one primary action — rendered in the payment card on desktop and in the bottom bar on a phone. */
  function primaryAction(where: "card" | "bar") {
    const id = where === "card" ? "checkout-pay" : "checkout-pay-bar"
    if (payBlocked) {
      // Gold is the page's primary action. With the wallet off there is no
      // action to offer, so the CTA drops out of gold rather than sitting
      // there dimmed and still claiming the eye.
      return (
        <button
          id={id}
          type="button"
          disabled
          className="flex h-[52px] w-full cursor-not-allowed items-center justify-center rounded-full border border-ws-hairline text-[15px] font-semibold text-ws-muted"
        >
          Payments unavailable
        </button>
      )
    }
    if (shortfall && shortfallMinor) {
      return (
        <button
          id={id}
          type="button"
          onClick={openFunding}
          disabled={busy}
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-ws-brand text-[15px] font-semibold text-ws-brand-on transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-brand/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ws-page active:translate-y-px disabled:opacity-45"
        >
          <WalletIcon size={17} aria-hidden />
          Add {centsUsd(shortfallMinor)} to your wallet
        </button>
      )
    }
    return (
      <PayButton
        id={id}
        phase={phase}
        label={isPaid ? `Pay ${wholeUsd(price)}` : "Enrol for free"}
        paid={isPaid}
        onClick={handlePurchase}
      />
    )
  }

  const services = packageServices(program, selected)
  const { lead, rest: features } = splitFeatures(selected.features)
  const includedTitle = multiTier ? `What's included in ${selected.name}` : "What's included"
  const includedSummary = [
    services.length > 0 && services.map((s) => s.label).slice(0, 2).join(", ") + (services.length > 2 ? ` +${services.length - 2}` : ""),
    selected.features.length > 0 && `${selected.features.length} ${program.tierCount === 0 ? "outcomes" : "features"}`,
  ]
    .filter(Boolean)
    .join(" · ")
  const detailsSummary = [
    LEVEL_LABEL[program.level],
    facts.lessons > 0 && `${facts.lessons.toLocaleString("en-US")} ${facts.lessons === 1 ? "lesson" : "lessons"}`,
    program.instructorName,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <div className="pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-20">
      <MobileSummary
        program={program}
        pkg={selected}
        line={line}
        changeHref={multiTier ? changeHref : null}
        reservedSeat={reservedSeat}
      />

      <div className="mx-auto w-full max-w-[1120px] px-4 sm:px-6 lg:px-8">
        <div
          className={cn(
            "grid gap-6 pt-6 sm:pt-8 lg:pt-12",
            "[grid-template-areas:'head'_'pay'_'sections']",
            "lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] lg:grid-rows-[auto_auto_1fr] lg:gap-x-12 lg:gap-y-6 xl:gap-x-16",
            "lg:[grid-template-areas:'head_pay'_'order_pay'_'sections_pay']"
          )}
        >
          {/* ── Heading ── */}
          <div className="rise min-w-0 [grid-area:head]">
            <Link
              href={multiTier ? changeHref : programHref}
              className="-ml-1 inline-flex max-w-full items-center gap-1 rounded-full py-1 pl-1 pr-2 text-[13.5px] font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
            >
              <ChevronLeftIcon size={16} aria-hidden className="shrink-0" />
              <span className="truncate">{program.title}</span>
            </Link>
            <h1 className="mt-3 font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-ws-primary sm:text-[34px]">
              Complete your enrollment
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-ws-muted">
              {isPaid
                ? "Review your order, then pay from your WorldStreet wallet."
                : "Review your order, then confirm your free enrollment."}
            </p>
          </div>

          {/* ── Order (desktop — a phone has it in the summary above) ── */}
          <div className="rise hidden min-w-0 [grid-area:order] lg:block" style={{ "--rise-delay": "60ms" } as React.CSSProperties}>
            <OrderCard
              program={program}
              pkg={selected}
              line={line}
              changeHref={multiTier ? changeHref : null}
              reservedSeat={reservedSeat}
            />
          </div>

          {/* ── Payment ── */}
          <div className="min-w-0 [grid-area:pay] lg:sticky lg:top-8 lg:self-start">
            <section
              aria-labelledby="payment-heading"
              className="rise rounded-[20px] border border-ws-hairline bg-ws-surface p-5 dark:border-transparent sm:p-6"
              style={{ "--rise-delay": "90ms" } as React.CSSProperties}
            >
              <h2 id="payment-heading" className="text-[15px] font-semibold text-ws-primary">
                {isPaid ? "Payment" : "Your enrollment"}
              </h2>

              {isPaid && (
                <div className="mt-4 flex items-center gap-3 rounded-[14px] bg-ws-sunken p-3.5">
                  <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-ws-brand/[0.12] text-ws-gold"
                  >
                    <WalletIcon size={18} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[14px] font-semibold text-ws-primary">WorldStreet wallet</span>
                    <span className="text-[12.5px] text-ws-muted">{wallet.enabled ? "USD balance" : "Unavailable right now"}</span>
                  </span>
                  {wallet.enabled && (
                    <RollingAmount
                      value={centsUsd(wallet.usdAvailableMinor)}
                      className={cn("text-[16px] font-semibold", shortfall ? "text-warning" : "text-ws-primary")}
                    />
                  )}
                </div>
              )}

              {/* The receipt */}
              <dl className="mt-5 space-y-2.5 text-[14px]">
                <div className="flex items-baseline gap-3">
                  <dt className="min-w-0 flex-1 text-ws-muted">
                    {line.label ? (
                      <>
                        <span className="text-ws-primary">{line.name}</span> · {line.label}
                      </>
                    ) : (
                      <span className="text-ws-primary">{program.title}</span>
                    )}
                  </dt>
                  <dd className="shrink-0 font-medium tabular-nums text-ws-primary">
                    {isPaid ? centsUsd(priceMinor) : "Free"}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 flex items-end justify-between gap-3 border-t border-ws-hairline pt-4">
                <span className="pb-1 text-[14px] font-semibold text-ws-primary">{isPaid ? "Total due" : "Total"}</span>
                <span className="font-display text-[40px] font-light leading-none tracking-[-0.025em] tabular-nums text-ws-primary">
                  {wholeUsd(price)}
                </span>
              </div>
              <Appear show={isPaid && wallet.enabled && !shortfall}>
                <p className="flex items-baseline justify-between gap-3 pt-2.5 text-[13px] text-ws-muted">
                  <span>Wallet balance after</span>
                  <RollingAmount value={centsUsd(wallet.usdAvailableMinor - priceMinor)} className="font-medium" />
                </p>
              </Appear>

              {/* Wallet off. Stated before the click, because no amount of
                  trying clears it — the CTA is disabled for the same reason. */}
              <Appear show={payBlocked}>
                <div className="mt-5 rounded-[14px] bg-warning-chip p-4">
                  <p className="text-[14px] font-semibold text-warning">Payments are unavailable right now</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-ws-muted">
                    You haven&apos;t been charged, and this program is still here when payments are back.
                  </p>
                </div>
              </Appear>

              {/* Not enough in the wallet — how much, and the way through. */}
              <Appear show={shortfall && shortfallMinor !== null}>
                <ShortfallPanel
                  shortfallMinor={shortfallMinor ?? 0}
                  balanceMinor={wallet.usdAvailableMinor}
                  priceMinor={priceMinor}
                  refreshing={refreshing}
                  onRefresh={refreshBalance}
                />
              </Appear>

              <Appear show={error !== null}>
                <p role="alert" className="mt-5 rounded-[14px] bg-debit-chip px-4 py-3 text-[13.5px] leading-relaxed text-debit">
                  {error}
                </p>
              </Appear>

              <div className="mt-6 hidden lg:block">{primaryAction("card")}</div>

              {/* Only a program in a school can be saved: a legacy one has no
                  school to put on the dashboard, so the promise would be empty. */}
              {program.school && phase !== "success" && (
                <div className="mt-2 lg:mt-2.5">
                  <button
                    type="button"
                    onClick={saveForLater}
                    disabled={savingLater || busy}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-full text-[14px] font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised hover:text-ws-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-ws-muted"
                  >
                    {savingLater ? (
                      <>
                        <LoaderCircleIcon size={14} className="animate-spin" aria-hidden />
                        Saving…
                      </>
                    ) : (
                      "Save and pay later"
                    )}
                  </button>
                  {saveLaterError && (
                    <p role="alert" className="mt-1 text-center text-[12.5px] text-ws-danger">
                      {saveLaterError}
                    </p>
                  )}
                </div>
              )}

              {/* The promise under the button — only while there is a button to keep it. */}
              {!payBlocked && (
                <p className="mt-4 flex items-start gap-2 border-t border-ws-hairline pt-4 text-[12.5px] leading-relaxed text-ws-muted">
                  <LockKeyholeIcon size={14} className="mt-0.5 shrink-0" aria-hidden />
                  <span>
                    {isPaid
                      ? "Charged once, only when you press Pay. Your program opens the moment the wallet confirms."
                      : "No payment needed. Your program opens as soon as you enrol."}
                  </span>
                </p>
              )}
            </section>
          </div>

          {/* ── Details ── */}
          <div className="rise min-w-0 [grid-area:sections]" style={{ "--rise-delay": "120ms" } as React.CSSProperties}>
            <div className="overflow-hidden rounded-[20px] border border-ws-hairline bg-ws-surface dark:border-transparent">
              {(services.length > 0 || selected.features.length > 0) && (
                <Disclosure icon={PackageCheckIcon} title={includedTitle} summary={includedSummary} defaultOpen="desktop">
                  {services.length > 0 && (
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {services.map(({ key, label, icon: Icon }) => (
                        <li key={key} className="flex items-center gap-2.5 rounded-[12px] bg-ws-sunken px-3 py-2.5 text-[13.5px] font-medium text-ws-primary">
                          <Icon size={15} className="shrink-0 text-ws-gold" aria-hidden />
                          {label}
                        </li>
                      ))}
                    </ul>
                  )}
                  {features.length > 0 && (
                    <>
                      <p className={cn("text-[13px] font-semibold text-ws-primary", services.length > 0 && "mt-5")}>
                        {lead ? `${lead}, plus` : program.tierCount === 0 ? "What you'll learn" : "Features"}
                      </p>
                      <ul className="mt-3 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
                        {features.map((feature, i) => (
                          <li key={`${selected.key}-${i}`} className="flex items-start gap-2.5 text-[14px] leading-snug text-ws-primary">
                            <span aria-hidden className="mt-px flex size-[18px] shrink-0 items-center justify-center rounded-full bg-ws-raised text-ws-muted">
                              <CheckIcon size={11} strokeWidth={3} />
                            </span>
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {multiTier && (
                    <Link
                      href={changeHref}
                      className="mt-5 inline-flex items-center gap-1 text-[13px] font-medium text-ws-muted underline-offset-4 transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary hover:underline"
                    >
                      Compare packages
                    </Link>
                  )}
                </Disclosure>
              )}

              <Disclosure icon={BookOpenIcon} title="Program details" summary={detailsSummary}>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-[14px]">
                  {school && <Fact label="School" value={school.short} wide />}
                  <Fact label="Level" value={LEVEL_LABEL[program.level]} />
                  {facts.lessons > 0 && (
                    <Fact
                      label="Lessons"
                      value={
                        multiTier && facts.openLessons < facts.lessons
                          ? `${facts.openLessons} of ${facts.lessons} with ${PACKAGE_LABEL[selected.key]}`
                          : facts.lessons.toLocaleString("en-US")
                      }
                    />
                  )}
                  {facts.openVideoSec > 0 && <Fact label="Video" value={lengthLabel(facts.openVideoSec)} />}
                  {program.enrolledCount > 0 && <Fact label="Learners" value={program.enrolledCount.toLocaleString("en-US")} />}
                  {program.rating !== null && program.ratingCount > 0 && (
                    <Fact
                      label="Rating"
                      value={`${program.rating.toFixed(1)} · ${program.ratingCount.toLocaleString("en-US")} ${program.ratingCount === 1 ? "rating" : "ratings"}`}
                    />
                  )}
                </dl>
                <div className="mt-5 flex items-center gap-3 rounded-[14px] bg-ws-sunken p-3">
                  <span className="relative size-10 shrink-0 overflow-hidden rounded-full bg-ws-raised">
                    {program.instructorAvatarUrl ? (
                      <Image src={program.instructorAvatarUrl} alt="" fill sizes="40px" className="object-cover" />
                    ) : (
                      <span className="flex size-full items-center justify-center text-[13px] font-semibold text-ws-muted">
                        {program.instructorName.slice(0, 1)}
                      </span>
                    )}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-[12px] font-medium text-ws-muted">Your instructor</span>
                    <span className="truncate text-[14px] font-semibold text-ws-primary">{program.instructorName}</span>
                    {program.instructorHeadline && (
                      <span className="truncate text-[12.5px] text-ws-muted">{program.instructorHeadline}</span>
                    )}
                  </span>
                </div>
                <Link
                  href={programHref}
                  className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-ws-muted underline-offset-4 transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary hover:underline"
                >
                  See the full program page
                </Link>
              </Disclosure>

              {isPaid && (
                <Disclosure icon={ShieldCheckIcon} title="How payment works" summary="One debit · access on confirmation">
                  <ul className="space-y-4">
                    <HowRow icon={WalletIcon} title="Paid from your WorldStreet wallet">
                      {centsUsd(priceMinor)} is debited from the USD balance of your central WorldStreet wallet. No card
                      details are entered on this page.
                    </HowRow>
                    <HowRow icon={BadgeCheckIcon} title="Access follows the confirmed debit">
                      Your enrollment is created only after the wallet confirms the payment — then the program opens in
                      your dashboard straight away.
                    </HowRow>
                    <HowRow icon={CopyCheckIcon} title="Never charged twice">
                      Each order carries one payment reference, so a double click or a retry can&apos;t debit you again.
                    </HowRow>
                    <HowRow icon={RotateCcwIcon} title="Covered if something fails">
                      If your enrollment can&apos;t be completed after the debit, the charge is refunded to your wallet.
                    </HowRow>
                  </ul>
                  <p className="mt-5 flex items-center gap-2 text-[13px] text-ws-muted">
                    <MailIcon size={14} className="shrink-0" aria-hidden />
                    <span>
                      Questions?{" "}
                      <a
                        href={`mailto:${BRAND.supportEmail}`}
                        className="font-medium text-ws-primary underline-offset-4 hover:underline"
                      >
                        {BRAND.supportEmail}
                      </a>
                    </span>
                  </p>
                </Disclosure>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Phone: the pay button, pinned ── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ws-hairline bg-ws-page px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:hidden">
        <div className="mx-auto max-w-[1120px]">{primaryAction("bar")}</div>
      </div>
    </div>
  )
}

/* ── Pieces ─────────────────────────────────────────────────────────────── */

function Fact({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={cn("min-w-0", wide && "col-span-2")}>
      <dt className="text-[12px] font-medium text-ws-muted">{label}</dt>
      <dd className="mt-0.5 font-medium tabular-nums text-ws-primary">{value}</dd>
    </div>
  )
}

function HowRow({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  title: string
  children: React.ReactNode
}) {
  return (
    <li className="flex items-start gap-3">
      <span aria-hidden className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-ws-sunken text-ws-muted">
        <Icon size={14} />
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold text-ws-primary">{title}</span>
        <span className="mt-0.5 block text-[13.5px] leading-relaxed text-ws-muted">{children}</span>
      </span>
    </li>
  )
}
