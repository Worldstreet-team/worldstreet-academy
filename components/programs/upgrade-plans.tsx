import { ArrowRightIcon, CheckIcon, CircleCheckIcon } from "@/components/icons"
import Link from "next/link"

import type { PublicPackage } from "@/lib/actions/student"
import type { UpgradeOptions } from "@/lib/actions/enrollments"
import { PACKAGE_LABEL } from "@/lib/entitlements"
import { cn } from "@/lib/utils"
import { minorUsd } from "@/components/checkout/order-lines"
import { SERVICES, servicesOf } from "@/components/programs/package-model"
import { PROGRAM_H2, SECTION_SCROLL_MT } from "@/components/programs/section-title"

const GOLD_CTA =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ws-brand px-6 text-[15px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ws-surface active:translate-y-px"

/**
 * `#packages` for a learner who already holds a place (2026-11-12, Owen):
 * their plan, marked as theirs, and each higher plan with "Upgrade for $X",
 * X being the difference (`getUpgradeOptions`). The one place an enrolled
 * learner is quoted a figure (lib/program-rail.ts), and only that one: no
 * plan prices, no lower plans. Rendered only when the place can change plan
 * by paying; on the top plan it just says so.
 */
export function UpgradePlans({
  courseId,
  packages,
  tierCount,
  upgrade,
  programTitle,
}: {
  courseId: string
  packages: PublicPackage[]
  tierCount: number
  upgrade: UpgradeOptions
  programTitle: string
}) {
  const current = packages.find((p) => p.key === upgrade.current.key) ?? null
  const currentServices = current ? servicesOf(current, tierCount) : null
  const higher = upgrade.options.flatMap((option) => {
    const pkg = packages.find((p) => p.key === option.key)
    return pkg ? [{ option, pkg }] : []
  })
  const currentLabel = PACKAGE_LABEL[upgrade.current.key]

  return (
    <section id="packages" aria-labelledby="your-plan-heading" className={SECTION_SCROLL_MT}>
      <h2 id="your-plan-heading" className={PROGRAM_H2}>
        Your plan
      </h2>
      <p className="mt-2 max-w-2xl text-pretty text-[15px] leading-relaxed text-ws-muted">
        {higher.length > 0
          ? `You're on ${currentLabel}. Move up whenever you like: you pay only the difference, and what you've already paid counts in full.`
          : `You're on ${currentLabel}, the most complete way to take ${programTitle}.`}
      </p>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <li className="flex min-w-0 flex-col rounded-[20px] bg-ws-raised p-5 ring-1 ring-ws-brand/60 sm:p-6">
          <p className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-ws-brand/[0.12] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ws-gold">
              {currentLabel}
            </span>
            <span className="inline-flex items-center gap-1 text-[12.5px] font-medium text-ws-success">
              <CircleCheckIcon size={14} aria-hidden />
              Your plan
            </span>
          </p>
          <p className="mt-3 text-[17px] font-semibold text-ws-primary">{upgrade.current.name}</p>
          {current?.tagline && <p className="mt-1 text-[14px] leading-snug text-ws-muted">{current.tagline}</p>}
          {currentServices && (
            <ServiceList keys={SERVICES.filter((s) => currentServices[s.key]).map((s) => s.label)} onRaised className="mt-4" />
          )}
        </li>

        {higher.map(({ option, pkg }) => {
          const services = servicesOf(pkg, tierCount)
          // What this plan adds to the one held, in the ladder's own terms.
          const adds = SERVICES.filter((s) => services[s.key] && !currentServices?.[s.key]).map((s) => s.label)
          return (
            <li
              key={pkg.key}
              className="flex min-w-0 flex-col rounded-[20px] border border-ws-hairline bg-ws-surface p-5 dark:border-transparent sm:p-6"
            >
              <p className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-ws-brand/[0.12] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ws-gold">
                  {PACKAGE_LABEL[pkg.key]}
                </span>
                {pkg.highlight && <span className="text-[12px] font-medium text-ws-muted">Most popular</span>}
              </p>
              <p className="mt-3 text-[17px] font-semibold text-ws-primary">{option.name}</p>
              {pkg.tagline && <p className="mt-1 text-[14px] leading-snug text-ws-muted">{pkg.tagline}</p>}
              {adds.length > 0 && (
                <>
                  <p className="mt-4 text-[13px] font-semibold text-ws-primary">Adds to your plan</p>
                  <ServiceList keys={adds} className="mt-2.5" />
                </>
              )}
              <div className="mt-auto pt-6">
                <Link href={`/dashboard/checkout?courseId=${courseId}&package=${pkg.key}`} className={GOLD_CTA}>
                  <span className="tabular-nums">Upgrade for {minorUsd(option.upgradeMinor)}</span>
                  <ArrowRightIcon size={17} aria-hidden />
                </Link>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function ServiceList({ keys, onRaised = false, className }: { keys: string[]; onRaised?: boolean; className?: string }) {
  if (keys.length === 0) return null
  return (
    <ul className={cn("space-y-2", className)}>
      {keys.map((label) => (
        <li key={label} className="flex items-start gap-2.5 text-[14px] leading-snug text-ws-primary">
          <span aria-hidden className={cn(
              "mt-px flex size-[18px] shrink-0 items-center justify-center rounded-full text-ws-muted",
              onRaised ? "bg-ws-surface" : "bg-ws-raised"
            )}>
            <CheckIcon size={11} strokeWidth={3} />
          </span>
          {label}
        </li>
      ))}
    </ul>
  )
}
