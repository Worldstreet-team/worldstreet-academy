"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckIcon } from "lucide-react"
import { saveEnrollmentIntent } from "@/lib/actions/enrollment-intent"
import type { PublicPackage } from "@/lib/actions/student"
import { PACKAGE_LABEL } from "@/lib/entitlements"
import { packagePriceLabel } from "@/lib/program-price"
import type { SchoolSlug } from "@/lib/schools"
import { cn } from "@/lib/utils"
import { StartColumns, StartPanel } from "@/components/start/start-panel"

/** Features shown beside the panel; the rest are one link away. */
const FEATURES_SHOWN = 8

const eyebrow = "text-[12px] font-semibold uppercase tracking-[0.08em] text-ws-muted"
const pill =
  "inline-flex h-12 w-full items-center justify-center rounded-full px-6 text-[15px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ws-surface disabled:cursor-default disabled:opacity-60"

/**
 * The last step: pick a package, then pay now or save it. Both buttons save
 * the intent first, so "pay later" is never a lost choice and a checkout the
 * learner walks away from is still on their dashboard.
 *
 * Gold is the pay button alone. The selected package is shown by the surface
 * ladder (the row steps up to `raised`) and an ink radio — a choice among
 * options is state, not a second call to action.
 */
export function PackageChooser({
  school,
  courseId,
  programSlug,
  packages,
  tierCount,
  cover,
  intro,
}: {
  school: SchoolSlug
  courseId: string
  programSlug: string
  /** Enabled tiers, never empty (ProgramDetail.packages). */
  packages: PublicPackage[]
  /** 0 = no ladder: one synthesized tier that carries no key. */
  tierCount: number
  /** The school's cover, for the panel strip. */
  cover: string | null
  /** The step heading, rendered by the page. */
  intro: React.ReactNode
}) {
  const router = useRouter()
  const initial = packages.find((p) => p.highlight) ?? packages[0]
  const [key, setKey] = useState<PublicPackage["key"]>(initial.key)
  const [action, setAction] = useState<"pay" | "later" | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const selected = packages.find((p) => p.key === key) ?? initial
  const multiTier = packages.length > 1
  const free = selected.price === 0
  const more = selected.features.length - FEATURES_SHOWN

  function go(next: "pay" | "later") {
    setError(null)
    setAction(next)
    startTransition(async () => {
      const result = await saveEnrollmentIntent({
        school,
        courseId,
        packageKey: tierCount > 0 ? selected.key : null,
        source: "start",
      })
      if (!result.success) {
        setAction(null)
        setError(result.error)
        return
      }
      router.push(next === "pay" && result.data.checkoutHref ? result.data.checkoutHref : "/dashboard?saved=1")
    })
  }

  const panel = (
    <StartPanel cover={cover}>
      {multiTier ? (
        <fieldset className="min-w-0">
          <legend className={cn(eyebrow, "mb-3")}>Choose your package</legend>
          <div className="space-y-1.5">
            {packages.map((pkg) => {
              const active = pkg.key === key
              return (
                <label
                  key={pkg.key}
                  className={cn(
                    "flex cursor-pointer items-center gap-3.5 rounded-[14px] px-4 py-3.5 transition-colors duration-[var(--ws-motion-fast)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ws-brand/40",
                    active ? "bg-ws-raised ring-1 ring-ws-primary/25" : "hover:bg-ws-raised/60"
                  )}
                >
                  <input
                    type="radio"
                    name="package"
                    value={pkg.key}
                    checked={active}
                    onChange={() => setKey(pkg.key)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors duration-[var(--ws-motion-fast)]",
                      active ? "border-ws-primary" : "border-ws-subtle"
                    )}
                  >
                    {active && <span className="size-2 rounded-full bg-ws-primary" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ws-muted">
                        {PACKAGE_LABEL[pkg.key]}
                      </span>
                      {pkg.highlight && (
                        // Outlined, not filled: `chip` and `raised` are the same
                        // step, so a filled chip vanishes on the selected row.
                        <span className="rounded-full border border-ws-hairline px-2 py-px text-[10px] font-semibold uppercase tracking-[0.06em] text-ws-muted">
                          Most popular
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-[15px] font-medium leading-snug text-ws-primary">{pkg.name}</span>
                  </span>
                  <span className="shrink-0 font-display text-xl font-light tabular-nums tracking-[-0.01em] text-ws-primary">
                    {packagePriceLabel(pkg.price)}
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>
      ) : (
        <div>
          <p className={eyebrow}>{selected.name}</p>
          <p className="mt-2 font-display text-[44px] font-light leading-none tabular-nums tracking-[-0.02em] text-ws-primary">
            {packagePriceLabel(selected.price)}
          </p>
          {selected.tagline && <p className="mt-3 text-[14px] leading-relaxed text-ws-muted">{selected.tagline}</p>}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-5 text-[13px] text-ws-danger">
          {error}
        </p>
      )}

      <div className="mt-6 grid gap-2.5">
        <button
          type="button"
          onClick={() => go("pay")}
          disabled={pending}
          className={cn(pill, "bg-ws-brand text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90")}
        >
          {pending && action === "pay"
            ? "Opening checkout…"
            : free
              ? "Continue — it's free"
              : `Continue to payment · ${packagePriceLabel(selected.price)}`}
        </button>
        <button
          type="button"
          onClick={() => go("later")}
          disabled={pending}
          className={cn(
            pill,
            "border border-ws-hairline text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised"
          )}
        >
          {pending && action === "later" ? "Saving…" : free ? "Save for later" : "Save and pay later"}
        </button>
      </div>
      <p className="mt-4 text-balance text-center text-[13px] leading-relaxed text-ws-muted">
        {free ? "Saving puts it on your dashboard." : "Saving puts it on your dashboard. Nothing is charged until you pay."}
      </p>
    </StartPanel>
  )

  const details =
    selected.features.length > 0 ? (
      // Keyed by package so switching replays the one-shot entrance: the eye
      // is on the panel, and the change beside it should register.
      <section key={selected.key} aria-labelledby="included-heading" className="rise border-t border-ws-hairline pt-8">
        <p className={eyebrow}>What&apos;s included</p>
        <h2 id="included-heading" className="mt-2 font-display text-xl font-semibold tracking-[-0.01em] text-ws-primary">
          {selected.name}
        </h2>
        {multiTier && selected.tagline && (
          <p className="mt-1.5 text-[14px] leading-relaxed text-ws-muted">{selected.tagline}</p>
        )}
        <ul className="mt-5 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
          {selected.features.slice(0, FEATURES_SHOWN).map((feature, i) => (
            <li key={`${selected.key}-${i}`} className="flex items-start gap-2.5 text-[14px] leading-relaxed text-ws-muted">
              <CheckIcon size={15} className="mt-[3px] shrink-0 text-ws-subtle" aria-hidden />
              {feature}
            </li>
          ))}
        </ul>
        {more > 0 && (
          <p className="mt-5 text-[13px] text-ws-muted">
            <Link
              href={`/programs/${programSlug}#packages`}
              className="underline decoration-ws-hairline underline-offset-4 transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary hover:decoration-current"
            >
              And <span className="tabular-nums">{more}</span> more on the program page
            </Link>
          </p>
        )}
      </section>
    ) : undefined

  return <StartColumns intro={intro} panel={panel} details={details} />
}
