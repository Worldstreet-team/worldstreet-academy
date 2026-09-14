import Link from "next/link"
import { CheckIcon, StarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PublicPackage } from "@/lib/actions/student"
import { PACKAGE_LABEL } from "@/lib/entitlements"
import type { ProgramAccess } from "@/components/programs/access"

function priceLabel(price: number): string {
  return price === 0 ? "Free" : `$${price.toLocaleString("en-US")}`
}

/** Spec §6 button copy: the package's own label, else "Enrol for $price". */
function ctaLabel(pkg: PublicPackage): string {
  if (pkg.ctaLabel) return pkg.ctaLabel
  return pkg.price === 0 ? "Enrol for free" : `Enrol for ${priceLabel(pkg.price)}`
}

const GRID: Record<number, string> = {
  1: "md:max-w-md",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
}

/**
 * Spec §6 "Choose your learning experience": 1–3 tier cards side by side
 * (stacked on phones). The highlighted tier gets a raised surface, a gold
 * border wash and the "Most popular" chip — never a gold background. Tier key
 * labels (BASIC / STANDARD / EXECUTIVE 101) only make sense against siblings,
 * so a single-tier program shows none.
 */
export function PackageLadder({
  courseId,
  packages,
  access,
}: {
  courseId: string
  packages: PublicPackage[]
  access: ProgramAccess
}) {
  const multiTier = packages.length > 1

  return (
    <section
      id="packages"
      className="mt-16 scroll-mt-24 border-t border-ws-hairline pt-10"
      aria-labelledby="packages-heading"
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ws-gold">Packages</p>
      <h2
        id="packages-heading"
        className="mt-3 font-display text-2xl font-semibold tracking-[-0.015em] text-ws-primary"
      >
        Choose your learning experience
      </h2>

      <ul className={cn("mt-8 grid gap-4", GRID[packages.length] ?? "md:grid-cols-3")}>
        {packages.map((pkg) => (
          <li
            key={pkg.key}
            className={cn(
              "relative flex flex-col rounded-lg border p-6",
              pkg.highlight ? "border-ws-brand/40 bg-ws-raised" : "border-ws-hairline bg-ws-surface"
            )}
          >
            {pkg.highlight && (
              <span className="absolute right-5 top-5 inline-flex items-center gap-1 rounded-full bg-ws-brand/10 px-2.5 py-1 text-[11px] font-semibold text-ws-gold">
                <StarIcon size={12} fill="currentColor" aria-hidden />
                Most popular
              </span>
            )}
            {multiTier && (
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ws-muted">
                {PACKAGE_LABEL[pkg.key]}
              </p>
            )}
            <p className="mt-3 font-display text-4xl font-light tabular-nums tracking-[-0.02em] text-ws-primary">
              {priceLabel(pkg.price)}
            </p>
            <h3 className="mt-2 font-display text-xl font-semibold text-ws-primary">{pkg.name}</h3>
            {pkg.tagline && <p className="mt-1 text-[14px] text-ws-muted">{pkg.tagline}</p>}
            {pkg.features.length > 0 && (
              <ul className="mt-6 space-y-2.5">
                {pkg.features.map((feature, i) => (
                  <li
                    key={`${pkg.key}-${i}`}
                    className="flex items-start gap-2.5 text-[14px] leading-relaxed text-ws-muted"
                  >
                    <CheckIcon size={15} className="mt-0.5 shrink-0 text-ws-muted" aria-hidden />
                    {feature}
                  </li>
                ))}
              </ul>
            )}
            {access.kind !== "enrolled" && (
              <div className="mt-auto pt-8">
                <PackageCta
                  courseId={courseId}
                  pkg={pkg}
                  access={access}
                  primary={pkg.highlight || !multiTier}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * One card's action. Enrolled visitors get none — the hero's "Continue
 * learning" is the page's one CTA. Coming soon → nothing to buy yet (the hero
 * carries the countdown / pre-enrol button); otherwise the checkout link
 * carrying the package key. Guests hit the same link — middleware sends them
 * to sign in with this URL as the return address.
 */
function PackageCta({
  courseId,
  pkg,
  access,
  primary,
}: {
  courseId: string
  pkg: PublicPackage
  access: Exclude<ProgramAccess, { kind: "enrolled" }>
  primary: boolean
}) {
  const base =
    "flex h-11 w-full items-center justify-center rounded-sm px-5 text-sm font-semibold transition-opacity duration-[var(--ws-motion-fast)]"

  if (access.kind === "coming_soon") {
    return <p className={cn(base, "bg-ws-chip text-ws-muted")}>Available at launch</p>
  }
  return (
    <Link
      href={`/dashboard/checkout?courseId=${courseId}&package=${pkg.key}`}
      className={cn(
        base,
        primary
          ? "bg-ws-brand text-ws-brand-on hover:opacity-90"
          : "border border-ws-hairline text-ws-primary transition-colors hover:border-ws-brand/40"
      )}
    >
      {ctaLabel(pkg)}
    </Link>
  )
}
