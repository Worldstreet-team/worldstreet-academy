import Link from "next/link"
import { CheckIcon, MinusIcon, StarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PublicPackage } from "@/lib/actions/student"
import { PACKAGE_LABEL } from "@/lib/entitlements"
import type { IPackageEntitlements } from "@/lib/db/models"
import { PROGRAM_H2 } from "@/components/programs/section-title"
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
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
}

/**
 * The six services a tier can carry, in the order a buyer climbs them. Used
 * for the comparison table only — the per-card feature lists stay the
 * instructor's own copy.
 */
const COMPARED: ReadonlyArray<{ key: keyof IPackageEntitlements; label: string }> = [
  { key: "liveClasses", label: "Live classes" },
  { key: "instructorQa", label: "Instructor Q&A" },
  { key: "assignments", label: "Graded assignments" },
  { key: "certificate", label: "Certificate of completion" },
  { key: "mentorship", label: "1-on-1 mentorship" },
  { key: "prioritySupport", label: "Priority support" },
]

/**
 * Spec §6 "Choose your learning experience": 1–3 tier cards side by side
 * (stacked on phones). The highlighted tier gets a raised surface, a gold
 * ring and a "Most popular" cap — never a gold background. Tier key labels
 * (BASIC / STANDARD / EXECUTIVE 101) only make sense against siblings, so a
 * single-tier program shows none.
 *
 * Below the cards, multi-tier programs get a comparison table of the six
 * entitlements. The cards sell each tier in the instructor's words; the table
 * answers the question the cards can't — what actually differs — without
 * making the visitor diff three bullet lists by eye.
 *
 * A lone package is not a ladder: it renders as ONE wide card — name, price
 * and action on the left, its features in two columns on the right — instead
 * of a third-width card stranded beside empty space.
 *
 * `className` lets a page restyle the section's outer spacing and scroll
 * margin (the program page clears a taller sticky header than the dashboard).
 */
export function PackageLadder({
  courseId,
  packages,
  access,
  className,
}: {
  courseId: string
  packages: PublicPackage[]
  access: ProgramAccess
  className?: string
}) {
  const multiTier = packages.length > 1
  // Only compare rows where the tiers actually differ; a row that is off for
  // every tier is noise, and one that is on for every tier belongs on a card.
  const rows = COMPARED.filter((row) => {
    const on = packages.filter((p) => p.entitlements[row.key]).length
    return on > 0 && on < packages.length
  })

  return (
    <section
      id="packages"
      className={cn("mt-16 scroll-mt-24 border-t border-ws-hairline pt-10", className)}
      aria-labelledby="packages-heading"
    >
      <h2 id="packages-heading" className={PROGRAM_H2}>
        {multiTier ? "Choose your learning experience" : "Enrol in this program"}
      </h2>
      {multiTier && (
        <p className="mt-2 max-w-xl text-[15px] text-ws-muted">
          Every package opens the full curriculum. What changes is how much of the
          faculty&apos;s time and assessment comes with it.
        </p>
      )}

      {!multiTier && packages[0] ? (
        <SinglePackage courseId={courseId} pkg={packages[0]} access={access} />
      ) : (
        <ul className={cn("mt-8 grid items-start gap-4", GRID[packages.length] ?? "md:grid-cols-3")}>
          {packages.map((pkg) => (
            <li
              key={pkg.key}
              className={cn(
                "relative flex h-full flex-col overflow-hidden rounded-[20px]",
                pkg.highlight
                  ? "bg-ws-raised ring-1 ring-ws-brand/40"
                  : "border border-ws-hairline bg-ws-surface dark:border-transparent"
              )}
            >
              {pkg.highlight && (
                <p className="flex items-center justify-center gap-1.5 bg-ws-brand/[0.12] py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-ws-gold">
                  <StarIcon size={11} fill="currentColor" aria-hidden />
                  Most popular
                </p>
              )}
              <div className="flex flex-1 flex-col p-6">
                {multiTier && (
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ws-subtle">
                    {PACKAGE_LABEL[pkg.key]}
                  </p>
                )}
                <p className="mt-3 font-display text-[40px] font-light leading-none tabular-nums tracking-[-0.02em] text-ws-primary">
                  {priceLabel(pkg.price)}
                </p>
                <h3 className="mt-3 font-display text-xl font-semibold text-ws-primary">{pkg.name}</h3>
                {pkg.tagline && <p className="mt-1.5 text-[14px] leading-relaxed text-ws-muted">{pkg.tagline}</p>}

                {access.kind !== "enrolled" && (
                  <div className="mt-6">
                    <PackageCta
                      courseId={courseId}
                      pkg={pkg}
                      access={access}
                      primary={pkg.highlight || !multiTier}
                    />
                  </div>
                )}

                {pkg.features.length > 0 && (
                  <ul className="mt-6 space-y-2.5 border-t border-ws-hairline pt-5">
                    {pkg.features.map((feature, i) => (
                      <li
                        key={`${pkg.key}-${i}`}
                        className="flex items-start gap-2.5 text-[14px] leading-relaxed text-ws-muted"
                      >
                        <CheckIcon size={15} className="mt-0.5 shrink-0 text-ws-subtle" aria-hidden />
                        {feature}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {multiTier && rows.length > 0 && (
        <div className="mt-10">
          <h3 className="font-display text-base font-semibold tracking-[-0.01em] text-ws-primary">
            What changes between packages
          </h3>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left">
              <caption className="sr-only">
                Services included in each package of this program
              </caption>
              <thead>
                <tr className="border-b border-ws-hairline">
                  <th scope="col" className="py-3 pr-4 text-[13px] font-medium text-ws-muted">
                    Service
                  </th>
                  {packages.map((pkg) => (
                    <th
                      key={pkg.key}
                      scope="col"
                      className={cn(
                        "px-3 py-3 text-center text-[13px] font-semibold text-ws-primary",
                        pkg.highlight && "bg-ws-brand/[0.06]"
                      )}
                    >
                      {PACKAGE_LABEL[pkg.key]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="border-b border-ws-hairline last:border-0">
                    <th
                      scope="row"
                      className="py-3 pr-4 text-[14px] font-normal text-ws-muted"
                    >
                      {row.label}
                    </th>
                    {packages.map((pkg) => {
                      const on = pkg.entitlements[row.key]
                      return (
                        <td
                          key={pkg.key}
                          className={cn("px-3 py-3 text-center", pkg.highlight && "bg-ws-brand/[0.06]")}
                        >
                          {on ? (
                            <CheckIcon
                              size={16}
                              className="mx-auto text-ws-primary"
                              role="img"
                              aria-label="Included"
                            />
                          ) : (
                            <MinusIcon
                              size={16}
                              className="mx-auto text-ws-subtle"
                              role="img"
                              aria-label="Not included"
                            />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}

/**
 * The lone package, as one wide card: the offer (name, tagline, price, action)
 * on the left; what it includes — the instructor's own feature lines — in two
 * columns on the right. Stacks on phones.
 */
function SinglePackage({
  courseId,
  pkg,
  access,
}: {
  courseId: string
  pkg: PublicPackage
  access: ProgramAccess
}) {
  const features = pkg.features.length > 0
  return (
    <div
      className={cn(
        "mt-8 grid overflow-hidden rounded-[20px] border border-ws-hairline bg-ws-surface dark:border-transparent",
        features && "md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]"
      )}
    >
      <div className={cn("flex flex-col p-6 sm:p-8", features && "md:bg-ws-raised/40")}>
        <h3 className="font-display text-xl font-semibold text-ws-primary">{pkg.name}</h3>
        {pkg.tagline && <p className="mt-1.5 text-[14px] leading-relaxed text-ws-muted">{pkg.tagline}</p>}
        <p className="mt-5 font-display text-[44px] font-light leading-none tabular-nums tracking-[-0.025em] text-ws-primary">
          {priceLabel(pkg.price)}
        </p>
        {access.kind !== "enrolled" && (
          <div className="mt-6 md:mt-auto md:pt-8">
            <PackageCta courseId={courseId} pkg={pkg} access={access} primary />
          </div>
        )}
      </div>
      {features && (
        <div className="border-t border-ws-hairline p-6 sm:p-8 md:border-l md:border-t-0">
          <p className="text-[14px] font-semibold text-ws-primary">What&apos;s in it</p>
          <ul className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {pkg.features.map((feature, i) => (
              <li key={`${pkg.key}-${i}`} className="flex items-start gap-2.5 text-[14px] leading-relaxed text-ws-muted">
                <CheckIcon size={15} className="mt-[3px] shrink-0 text-ws-subtle" aria-hidden />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
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
    "flex h-12 w-full items-center justify-center rounded-full px-5 text-sm font-semibold transition-opacity duration-[var(--ws-motion-fast)]"

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
          : "border border-ws-hairline text-ws-primary transition-colors hover:border-ws-brand/40 hover:bg-ws-raised"
      )}
    >
      {ctaLabel(pkg)}
    </Link>
  )
}
