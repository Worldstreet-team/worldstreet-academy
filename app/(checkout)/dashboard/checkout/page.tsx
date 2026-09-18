"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useUser } from "@/components/providers/user-provider"
import { purchaseCourse, checkEnrollment } from "@/lib/actions/enrollments"
import { getMyWalletBalance, type MyWalletBalance } from "@/lib/actions/wallet"
import { queryKeys } from "@/lib/hooks/queries/keys"
import { fetchProgramById, type ProgramDetail, type PublicPackage } from "@/lib/actions/student"
import { PACKAGE_LABEL } from "@/lib/entitlements"
import { SCHOOL_BY_SLUG } from "@/lib/schools"
import { cn } from "@/lib/utils"
import {
  BookOpenIcon,
  CheckIcon,
  ChevronLeftIcon,
  CircleCheckIcon,
  LoaderCircleIcon,
  ShieldCheckIcon,
} from "lucide-react"

/** Package prices are whole dollars. */
function dollars(price: number): string {
  return price === 0 ? "Free" : `$${price.toLocaleString("en-US")}`
}

export default function CheckoutPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const user = useUser()
  const queryClient = useQueryClient()

  const courseId = searchParams.get("courseId")
  const packageParam = searchParams.get("package")
  const [program, setProgram] = useState<ProgramDetail | null>(null)
  const [wallet, setWallet] = useState<MyWalletBalance | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shortfallMinor, setShortfallMinor] = useState<number | null>(null)

  useEffect(() => {
    if (!courseId) {
      setIsLoading(false)
      return
    }
    // Fetch program, enrollment state and central wallet balance in parallel
    Promise.all([
      fetchProgramById(courseId),
      user ? checkEnrollment(user.id, courseId) : Promise.resolve({ isEnrolled: false }),
      getMyWalletBalance(),
    ]).then(([p, enrollment, walletBalance]) => {
      if (enrollment.isEnrolled) {
        // Already enrolled — skip checkout entirely
        router.replace(`/dashboard/checkout/success?courseId=${courseId}`)
        return
      }
      setProgram(p)
      setWallet(walletBalance)
      setIsLoading(false)
    })
  }, [courseId, user, router])

  // The URL carries the package, so the wallet-funding round trip (which
  // returns to this exact URL) keeps the buyer's choice. A single-tier program
  // needs no choice.
  const packages = program?.packages ?? []
  const selected: PublicPackage | null =
    packages.length === 1 ? packages[0] : (packages.find((p) => p.key === packageParam) ?? null)

  function choosePackage(key: PublicPackage["key"]) {
    if (!courseId) return
    setError(null)
    setShortfallMinor(null)
    router.replace(`/dashboard/checkout?courseId=${courseId}&package=${key}`, { scroll: false })
  }

  function openFunding() {
    if (!wallet) return
    // Internal wallet deposit page (default): navigate in-tab with the
    // shortfall prefilled and a redirect straight back to this checkout.
    if (wallet.fundingUrl.startsWith("/")) {
      const returnTo =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : `/dashboard/checkout?courseId=${courseId}`
      const params = new URLSearchParams({ redirect: returnTo })
      if (shortfallMinor && shortfallMinor > 0) params.set("suggestMinor", String(shortfallMinor))
      router.push(`${wallet.fundingUrl}?${params.toString()}`)
      return
    }
    // External override (central dashboard) — keep the legacy new-tab flow.
    const returnTo = typeof window !== "undefined" ? window.location.href : ""
    const url = `${wallet.fundingUrl}${wallet.fundingUrl.includes("?") ? "&" : "?"}redirect=${encodeURIComponent(returnTo)}`
    window.open(url, "_blank", "noopener")
  }

  async function handlePurchase() {
    if (!program || !user || !selected) return
    setIsProcessing(true)
    setError(null)
    setShortfallMinor(null)

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
        setIsSuccess(true)
        router.push(`/dashboard/checkout/success?courseId=${program.id}`)
      } else {
        if (result.code === "insufficient_funds") {
          setShortfallMinor(result.shortfallMinor ?? null)
          setError(null)
          // Refresh the displayed balance to what the wallet reported
          getMyWalletBalance().then(setWallet)
        } else {
          setError(result.error || "Something went wrong")
        }
        setIsProcessing(false)
      }
    } catch {
      setError("Something went wrong. You have not been charged.")
      setIsProcessing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoaderCircleIcon size={24} className="animate-spin text-ws-muted" />
      </div>
    )
  }

  if (!program || !courseId) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="space-y-3 text-center">
          <p className="text-sm text-ws-muted">Program not found</p>
          <Button variant="outline" onClick={() => router.back()}>
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  const price = selected ? selected.price : null
  const school = program.school ? SCHOOL_BY_SLUG[program.school] : null
  const multiTier = packages.length > 1
  // The wallet is the only way a paid seat is bought, so when it is off the
  // purchase cannot succeed — `purchaseCourse` fails closed before it touches
  // money. Say so before the click rather than after it. A free program needs
  // no debit, so it is never blocked. `wallet === null` is still loading.
  const payBlocked = price !== null && price > 0 && wallet !== null && !wallet.enabled

  return (
    <div className="pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-lg space-y-6 px-4 py-8 md:px-6">
          {/* Back */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-ws-muted hover:text-ws-primary transition-colors"
          >
            <ChevronLeftIcon size={14} />
            Back
          </button>

          {/* Program */}
          <div className="rounded-lg border border-ws-hairline bg-ws-surface overflow-hidden">
            <div className="relative aspect-[21/9] bg-ws-raised">
              {program.thumbnailUrl ? (
                <Image src={program.thumbnailUrl} alt={program.title} fill className="object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <BookOpenIcon size={32} className="text-ws-subtle" />
                </div>
              )}
            </div>
            <div className="p-4">
              {school && (
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ws-muted">{school.short}</p>
              )}
              <h1 className="mt-1 text-base font-semibold text-ws-primary">{program.title}</h1>
              <p className="mt-0.5 text-xs text-ws-muted">
                by {program.instructorName} · <span className="tabular-nums">{program.totalLessons}</span> lessons
              </p>
            </div>
          </div>

          {/* Package switcher — doubles as the ladder when no package is chosen */}
          {multiTier && (
            <fieldset className="min-w-0 space-y-2">
              <legend className="mb-2 text-sm font-semibold text-ws-primary">
                {selected ? "Your package" : "Choose your package"}
              </legend>
              {packages.map((pkg) => {
                const active = pkg.key === selected?.key
                return (
                  <label
                    key={pkg.key}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors duration-[var(--ws-motion-fast)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ws-brand/40",
                      active ? "border-ws-brand/40 bg-ws-raised" : "border-ws-hairline bg-ws-surface hover:bg-ws-raised"
                    )}
                  >
                    <input
                      type="radio"
                      name="package"
                      value={pkg.key}
                      checked={active}
                      onChange={() => choosePackage(pkg.key)}
                      className="sr-only"
                    />
                    <span
                      aria-hidden
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                        active ? "border-ws-brand bg-ws-brand text-ws-brand-on" : "border-ws-hairline"
                      )}
                    >
                      {active && <CheckIcon size={10} strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-ws-muted">
                        {PACKAGE_LABEL[pkg.key]}
                      </span>
                      <span className="block truncate text-sm font-medium text-ws-primary">{pkg.name}</span>
                      {pkg.tagline && <span className="block truncate text-xs text-ws-muted">{pkg.tagline}</span>}
                    </span>
                    <span className="font-display text-lg font-light tabular-nums text-ws-primary">
                      {dollars(pkg.price)}
                    </span>
                  </label>
                )
              })}
            </fieldset>
          )}

          {/* What the chosen package includes (collapsed) */}
          {selected && selected.features.length > 0 && (
            <details className="rounded-lg border border-ws-hairline bg-ws-surface px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium text-ws-primary">
                What&apos;s included <span className="tabular-nums text-ws-muted">({selected.features.length})</span>
              </summary>
              <ul className="mt-3 space-y-2">
                {selected.features.map((feature, i) => (
                  <li key={`${selected.key}-${i}`} className="flex items-start gap-2 text-[13px] leading-relaxed text-ws-muted">
                    <CheckIcon size={14} className="mt-0.5 shrink-0" aria-hidden />
                    {feature}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {/* Order Summary */}
          {selected && price !== null && (
            <div className="rounded-lg border border-ws-hairline bg-ws-surface p-4 space-y-4">
              <h2 className="text-sm font-semibold text-ws-primary">Order summary</h2>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-ws-muted">
                    {program.tierCount > 0 ? selected.name : "Program price"}
                  </span>
                  <span className="font-medium tabular-nums text-ws-primary">{dollars(price)}</span>
                </div>
                {price > 0 && wallet?.enabled && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-ws-muted">WorldStreet balance</span>
                    <span
                      className={cn(
                        "font-medium tabular-nums",
                        wallet.usdAvailable >= price ? "text-ws-primary" : "text-ws-danger"
                      )}
                    >
                      ${wallet.usdAvailable.toFixed(2)}
                    </span>
                  </div>
                )}
                <Separator />
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-ws-primary">Total</span>
                  <span className="font-display text-3xl font-light tabular-nums tracking-[-0.02em] text-ws-primary">
                    {dollars(price)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* How this is paid. "Secure checkout" itself lives in the
              layout header, so it is not repeated here. */}
          {price !== null && price > 0 && (
            <p className="flex items-center justify-center gap-2 text-center text-xs text-ws-subtle">
              <ShieldCheckIcon size={13} className="shrink-0" aria-hidden />
              <span>
                Paid from your WorldStreet wallet — funding &amp; withdrawals live on the
                WorldStreet dashboard
              </span>
            </p>
          )}

          {/* Wallet off. Stated before the click, because no amount of trying
              clears it — the CTA below is disabled for the same reason. */}
          {payBlocked && (
            <div className="space-y-1 rounded-lg border border-ws-warning/20 bg-ws-warning/10 px-4 py-3">
              <p className="text-sm font-medium text-ws-warning">Payments are unavailable right now</p>
              <p className="text-xs text-ws-muted">
                You haven&apos;t been charged, and this program is still here when payments are back.
              </p>
            </div>
          )}

          {/* Insufficient funds */}
          {shortfallMinor !== null && (
            <div className="rounded-lg bg-ws-warning/10 border border-ws-warning/20 px-4 py-3 space-y-2">
              <p className="text-sm font-medium text-ws-warning">Insufficient balance</p>
              <p className="text-xs text-ws-muted">
                You need ${(shortfallMinor / 100).toFixed(2)} more in your WorldStreet wallet for this
                package. Top up on the WorldStreet dashboard, then come back — your order will still be here.
              </p>
              <Button variant="outline" size="sm" className="w-full" onClick={openFunding}>
                Fund my WorldStreet wallet
              </Button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-ws-danger/10 border border-ws-danger/20 px-4 py-3">
              <p className="text-sm text-ws-danger">{error}</p>
            </div>
          )}

          {/* CTA */}
          <Button
            onClick={handlePurchase}
            disabled={!selected || isProcessing || isSuccess || payBlocked}
            // Gold is the page's primary action. With the wallet off there is
            // no action to offer, so the CTA drops out of gold rather than
            // sitting there dimmed and still claiming the eye.
            variant={payBlocked ? "outline" : "default"}
            className="w-full h-12 text-sm font-semibold gap-2"
            size="lg"
          >
            {isSuccess ? (
              <>
                <CircleCheckIcon size={16} />
                Enrolled! Redirecting...
              </>
            ) : isProcessing ? (
              <>
                <LoaderCircleIcon size={16} className="animate-spin" />
                Processing...
              </>
            ) : !selected || price === null ? (
              "Choose a package to continue"
            ) : payBlocked ? (
              "Payments unavailable"
            ) : (
              <>
                <CircleCheckIcon size={16} />
                {price === 0 ? "Enrol for free" : `Pay ${dollars(price)}`}
              </>
            )}
        </Button>
      </div>
    </div>
  )
}
