"use client"

import * as React from "react"
import { motion } from "motion/react"
import {
  ArrowRightIcon,
  AwardIcon,
  CheckIcon,
  ChevronDownIcon,
  ClipboardCheckIcon,
  HandshakeIcon,
  LayersIcon,
  LifeBuoyIcon,
  ListVideoIcon,
  MessagesSquareIcon,
  RadioIcon,
  ShieldCheckIcon,
  StarIcon,
  type LucideIcon,
} from "lucide-react"
import type { PublicPackage } from "@/lib/actions/student"
import type { PackageKey } from "@/lib/db/models"
import { PACKAGE_LABEL } from "@/lib/entitlements"
import { packagePriceLabel } from "@/lib/program-price"
import { cn } from "@/lib/utils"
import { RollingAmount } from "@/components/ui/rolling-amount"
import { useMotionOK } from "@/components/marketing/motion/bus"
import { EASE_LUX } from "@/components/marketing/motion/ease"
import { PROGRAM_H2, SECTION_SCROLL_MT } from "@/components/programs/section-title"
import { CheckoutLink, usePackageSelection } from "@/components/programs/package-selection"
import { PackageCompare } from "@/components/programs/package-compare"
import {
  SERVICES,
  actionLabel,
  breakdownsOf,
  lessonLine,
  lowestWith,
  servicesOf,
  type LessonAccess,
  type PackageBreakdown,
  type ServiceKey,
} from "@/components/programs/package-model"

const SERVICE_ICON: Record<ServiceKey, LucideIcon> = {
  liveClasses: RadioIcon,
  instructorQa: MessagesSquareIcon,
  assignments: ClipboardCheckIcon,
  certificate: AwardIcon,
  mentorship: HandshakeIcon,
  prioritySupport: LifeBuoyIcon,
}

const GOLD_CTA =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ws-brand px-6 text-[15px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ws-surface active:translate-y-px"

/**
 * `#packages` — spec §6 "Choose your learning experience", as a choice rather
 * than three competing buttons: one selectable card per tier (native radios,
 * so arrow keys move the choice) and, beside it, the SELECTED tier's full
 * breakdown — its services, then every feature line in the instructor's own
 * words, "Everything in Basic" opening to the inherited list. ONE gold action
 * — "Continue to payment · $X" — carries the chosen tier to checkout. Below,
 * "Compare packages" opens the feature × tier table built from the same data.
 *
 * A single-price program (one tier, or the synthesized "Full program" of a
 * ladder-less one — spec §8 "FOUNDING PRICE: $199 [ENROL NOW]") has nothing
 * to choose: one offer card, "Enrol now · $X".
 *
 * Motion: the selected card's raised fill and gold ring glide between cards
 * (`layoutId`); the breakdown crossfades with a short rise while its frame
 * eases to the new height, so the page below glides rather than jumps; the
 * CTA's price rolls. All of it is instant under reduced motion.
 */
export function PackageChooser({
  programTitle,
  comingSoon,
  lessons,
  className,
}: {
  programTitle: string
  /** Published with a future availableAt: packages can be read, not bought yet. */
  comingSoon: boolean
  lessons: LessonAccess | null
  className?: string
}) {
  const { packages, multiTier } = usePackageSelection()
  return (
    <section id="packages" aria-labelledby="packages-heading" className={cn(SECTION_SCROLL_MT, className)}>
      <h2 id="packages-heading" className={PROGRAM_H2}>
        {multiTier ? "Choose your learning experience" : "Enrol in this program"}
      </h2>
      {multiTier ? (
        <>
          <p className="mt-2 max-w-2xl text-pretty text-[15px] leading-relaxed text-ws-muted">
            {packages.length === 3 ? "Three" : "Two"} ways to take {programTitle}. Choose one to see everything it
            includes — you pay for exactly that at checkout.
          </p>
          <Chooser comingSoon={comingSoon} lessons={lessons} />
          <PackageCompare lessons={lessons} />
        </>
      ) : (
        <SingleOffer comingSoon={comingSoon} lessons={lessons} />
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Multi-tier: options + breakdown
// ---------------------------------------------------------------------------

function Chooser({ comingSoon, lessons }: { comingSoon: boolean; lessons: LessonAccess | null }) {
  const { packages, tierCount, selected, select, engage } = usePackageSelection()
  const optionsRef = React.useRef<HTMLDivElement>(null)
  const breakdowns = React.useMemo(() => breakdownsOf(packages), [packages])
  // "Everything in Basic" opens per visit to a tier; switching tiers folds it.
  const [openInherited, setOpenInherited] = React.useState<PackageKey | null>(null)

  // Having the choice on screen counts as meeting it: the card and the bar
  // switch from "Choose your package" to the selected tier.
  React.useEffect(() => {
    const el = optionsRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          engage()
          io.disconnect()
        }
      },
      { threshold: 0.6 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [engage])

  return (
    <div className="mt-8 grid items-start gap-5 lg:mt-10 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:gap-6">
      <div ref={optionsRef} className="lg:sticky lg:top-[8.5rem]">
        <fieldset>
          <legend className="sr-only">Choose a package</legend>
          <div className="space-y-3">
            {packages.map((pkg) => (
              <OptionCard
                key={pkg.key}
                pkg={pkg}
                selected={pkg.key === selected.key}
                onSelect={() => {
                  select(pkg.key)
                  setOpenInherited(null)
                }}
              />
            ))}
          </div>
        </fieldset>
      </div>

      <Breakdown
        packages={packages}
        tierCount={tierCount}
        selected={selected}
        breakdowns={breakdowns}
        lessons={lessons}
        comingSoon={comingSoon}
        openInherited={openInherited}
        onToggleInherited={(key) => setOpenInherited((prev) => (prev === key ? null : key))}
      />
    </div>
  )
}

/**
 * One tier as a radio: label, "Most popular", name, tagline, price. The
 * selected card is raised with a gold ring (gold = active state); that fill
 * is one element that glides to whichever card is chosen.
 */
function OptionCard({ pkg, selected, onSelect }: { pkg: PublicPackage; selected: boolean; onSelect: () => void }) {
  const ok = useMotionOK()
  return (
    <label
      className={cn(
        "group relative flex cursor-pointer items-start gap-4 rounded-[20px] border p-5 transition-colors duration-[var(--ws-motion-fast)] sm:p-6",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ws-brand/70",
        selected
          ? "border-transparent"
          : "border-ws-hairline bg-ws-surface hover:bg-ws-raised/70 dark:border-transparent"
      )}
    >
      {selected && (
        <motion.span
          layoutId="package-option-selected"
          aria-hidden
          className="absolute inset-0 z-[1] bg-ws-raised ring-1 ring-ws-brand/60"
          style={{ borderRadius: 20 }}
          transition={ok ? { duration: 0.46, ease: EASE_LUX } : { duration: 0 }}
        />
      )}
      <input
        type="radio"
        name="program-package"
        value={pkg.key}
        checked={selected}
        onChange={onSelect}
        className="sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "relative z-10 flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors duration-[var(--ws-motion-base)]",
          selected ? "border-ws-brand bg-ws-brand" : "border-ws-subtle/70 group-hover:border-ws-muted"
        )}
      >
        <span
          className={cn(
            "size-2 rounded-full bg-ws-brand-on transition-transform duration-[var(--ws-motion-base)] ease-[var(--ws-ease)] motion-reduce:transition-none",
            selected ? "scale-100" : "scale-0"
          )}
        />
      </span>

      <span className="relative z-10 min-w-0 flex-1">
        <span className="flex min-h-5 flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <span
            className={cn(
              "text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors duration-[var(--ws-motion-base)]",
              selected ? "text-ws-primary" : "text-ws-muted"
            )}
          >
            {PACKAGE_LABEL[pkg.key]}
          </span>
          {pkg.highlight && (
            <span className="inline-flex items-center gap-1 rounded-full bg-ws-brand/[0.12] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ws-gold">
              <StarIcon size={10} fill="currentColor" aria-hidden />
              Most popular
            </span>
          )}
        </span>
        <span className="mt-2 flex items-baseline justify-between gap-4">
          <span className="min-w-0 font-display text-[17px] font-semibold leading-snug tracking-[-0.01em] text-ws-primary">
            {pkg.name}
          </span>
          <span className="shrink-0 font-display text-[26px] font-light leading-none tabular-nums tracking-[-0.02em] text-ws-primary">
            {packagePriceLabel(pkg.price)}
          </span>
        </span>
        {pkg.tagline && (
          <span className="mt-1.5 block text-pretty text-[13.5px] leading-relaxed text-ws-muted">{pkg.tagline}</span>
        )}
      </span>
    </label>
  )
}

function Breakdown({
  packages,
  tierCount,
  selected,
  breakdowns,
  lessons,
  comingSoon,
  openInherited,
  onToggleInherited,
}: {
  packages: PublicPackage[]
  tierCount: number
  selected: PublicPackage
  breakdowns: Record<string, PackageBreakdown>
  lessons: LessonAccess | null
  comingSoon: boolean
  openInherited: PackageKey | null
  onToggleInherited: (key: PackageKey) => void
}) {
  return (
    <div className="overflow-hidden rounded-[20px] border border-ws-hairline bg-ws-surface dark:border-transparent">
      <div className="p-5 sm:p-8">
        {/* Title block: one per tier, crossfading. */}
        <Stack selectedKey={selected.key} packages={packages}>
          {(pkg) => (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ws-muted">
                {PACKAGE_LABEL[pkg.key]} package
              </p>
              <h3 className="mt-2 font-display text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ws-primary">
                {pkg.name}
              </h3>
            </>
          )}
        </Stack>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
          <OfferAction pkg={selected} single={false} comingSoon={comingSoon} />
          <p className="flex items-center gap-2 text-[13px] leading-snug text-ws-muted">
            <ShieldCheckIcon size={15} className="shrink-0 text-ws-subtle" aria-hidden />
            Paid from your WorldStreet wallet at checkout
          </p>
        </div>
      </div>

      <div className="border-t border-ws-hairline p-5 sm:p-8">
        <Stack selectedKey={selected.key} packages={packages}>
          {(pkg) => {
            const b = breakdowns[pkg.key]
            const lessonsText = lessonLine(lessons, pkg.key)
            return (
              <>
                <ServiceGrid packages={packages} tierCount={tierCount} pkg={pkg} />

                <div className="mt-8 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <h4 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ws-primary">
                    Everything it includes
                  </h4>
                  {lessonsText && (
                    <p className="inline-flex items-center gap-1.5 text-[13px] tabular-nums text-ws-muted">
                      <ListVideoIcon size={14} aria-hidden />
                      {lessonsText}
                    </p>
                  )}
                </div>
                {b.inheritsFrom && b.inheritLine && (
                  <Inherited
                    line={b.inheritLine}
                    items={b.inherited}
                    open={openInherited === pkg.key}
                    onToggle={() => onToggleInherited(pkg.key)}
                    id={`inherited-${pkg.key}`}
                  />
                )}
                {b.own.length > 0 && (
                  <ul className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                    {b.own.map((line, i) => (
                      <li
                        key={`${pkg.key}-${i}`}
                        className="flex items-start gap-2.5 text-[14.5px] leading-snug text-ws-primary/90"
                      >
                        <CheckIcon size={16} className="mt-[1px] shrink-0 text-ws-muted" aria-hidden />
                        {line}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )
          }}
        </Stack>
      </div>
    </div>
  )
}

/**
 * Every tier's version of a block, rendered once (so the page's HTML carries
 * every package's breakdown). The selected one is in flow and fades in with a
 * short rise just after the outgoing one — laid over it, out of flow — has
 * faded; the rest are `invisible` (out of the tab order and the accessibility
 * tree). The frame's height follows the selected variant, measured and eased,
 * so the page below glides instead of jumping. Instant under reduced motion.
 */
function Stack({
  selectedKey,
  packages,
  children,
}: {
  selectedKey: PackageKey
  packages: PublicPackage[]
  children: (pkg: PublicPackage) => React.ReactNode
}) {
  const ok = useMotionOK()
  const activeRef = React.useRef<HTMLDivElement>(null)
  // Only the first measurement after a switch eases; later ones (a disclosure
  // opening inside) follow the content frame by frame.
  const [frame, setFrame] = React.useState<{ height: number | null; ease: boolean }>({ height: null, ease: false })

  React.useEffect(() => {
    const el = activeRef.current
    if (!el) return
    let first = true
    const ro = new ResizeObserver(() => {
      setFrame({ height: el.offsetHeight, ease: first })
      first = false
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [selectedKey])

  return (
    <motion.div
      className="relative overflow-hidden"
      initial={false}
      animate={{ height: frame.height ?? "auto" }}
      transition={{ duration: ok && frame.ease ? 0.36 : 0, ease: EASE_LUX }}
    >
      {packages.map((pkg) => {
        const active = pkg.key === selectedKey
        return (
          <div
            key={pkg.key}
            ref={active ? activeRef : undefined}
            aria-hidden={!active || undefined}
            className={cn(
              "min-w-0 motion-reduce:transition-none",
              active
                ? "visible relative translate-y-0 opacity-100 transition-[opacity,transform] delay-[90ms] duration-[var(--ws-motion-slow)] ease-[var(--ws-ease)]"
                : "invisible absolute inset-x-0 top-0 translate-y-1.5 opacity-0 transition-[opacity,transform,visibility] duration-[var(--ws-motion-fast)] ease-[var(--ws-ease)]"
            )}
          >
            {children(pkg)}
          </div>
        )
      })}
    </motion.div>
  )
}

/** "Everything in Basic" — the instructor's line, opening to what it stands for. */
function Inherited({
  line,
  items,
  open,
  onToggle,
  id,
}: {
  line: string
  items: string[]
  open: boolean
  onToggle: () => void
  id: string
}) {
  const ok = useMotionOK()
  return (
    <div className="mt-4 rounded-[14px] bg-ws-raised/60">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
        className="flex w-full items-center gap-3 rounded-[14px] px-3.5 py-3 text-left sm:px-4 transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ws-brand/40"
      >
        <LayersIcon size={16} className="shrink-0 text-ws-muted" aria-hidden />
        <span className="min-w-0 flex-1 text-[14.5px] font-semibold text-ws-primary">{line}</span>
        <span className="shrink-0 text-[13px] tabular-nums text-ws-muted">
          {items.length} {open ? "included" : "more"}
        </span>
        <ChevronDownIcon
          size={16}
          aria-hidden
          className={cn(
            "shrink-0 text-ws-muted transition-transform duration-[var(--ws-motion-base)] ease-[var(--ws-ease)] motion-reduce:transition-none",
            open && "rotate-180"
          )}
        />
      </button>
      <motion.div
        id={id}
        className="overflow-hidden"
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: ok ? 0.32 : 0, ease: EASE_LUX }}
        inert={!open}
      >
        <ul className="grid gap-x-8 gap-y-2.5 px-4 pb-4 pt-1 sm:grid-cols-2">
          {items.map((item, i) => (
            <li key={`${id}-${i}`} className="flex items-start gap-2.5 text-[14px] leading-snug text-ws-muted">
              <CheckIcon size={15} className="mt-[1px] shrink-0 text-ws-subtle" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </motion.div>
    </div>
  )
}

/**
 * The services a tier promises, as a strip of icon chips. Multi-tier: a
 * service this tier lacks says which tier of THIS program has it ("With
 * Executive 101"); services no tier offers are left out. Single-price: only
 * what the one tier carries.
 */
function ServiceGrid({
  packages,
  tierCount,
  pkg,
}: {
  packages: PublicPackage[]
  tierCount: number
  pkg: PublicPackage
}) {
  const multiTier = packages.length > 1
  const mine = servicesOf(pkg, tierCount)
  const rows = SERVICES.flatMap((service): Array<{ key: ServiceKey; label: string; on: boolean; note: string | null }> => {
    if (mine[service.key]) return [{ ...service, on: true, note: null }]
    const where = multiTier ? lowestWith(packages, tierCount, service.key) : null
    return where ? [{ ...service, on: false, note: `With ${PACKAGE_LABEL[where]}` }] : []
  })
  if (rows.length === 0) return null

  return (
    <ul className="grid gap-y-2.5 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-3.5 xl:grid-cols-3">
      {rows.map(({ key, label, on, note }) => {
        const Icon = SERVICE_ICON[key]
        return (
          <li key={key} className="flex min-w-0 items-center gap-3">
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-[9px] sm:size-9",
                on ? "bg-ws-raised text-ws-primary" : "border border-dashed border-ws-hairline text-ws-subtle"
              )}
            >
              <Icon size={16} aria-hidden />
            </span>
            {/* Phones: one row, the note at the end. From sm: the note under the name. */}
            <span className="flex min-w-0 flex-1 items-baseline justify-between gap-3 leading-tight sm:block">
              <span className={cn("min-w-0 text-[14px] font-medium sm:block", on ? "text-ws-primary" : "text-ws-subtle")}>
                {label}
              </span>
              {note && <span className="shrink-0 text-[12.5px] text-ws-muted sm:mt-0.5 sm:block">{note}</span>}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * The one primary action for a tier: checkout with that tier, the price
 * rolling as the choice changes. Coming soon: nothing to buy yet — the hero's
 * countdown and the card's pre-enrol button carry that state.
 */
function OfferAction({ pkg, single, comingSoon }: { pkg: PublicPackage; single: boolean; comingSoon: boolean }) {
  if (comingSoon) {
    return (
      <p className="inline-flex h-12 items-center justify-center rounded-full bg-ws-chip px-6 text-[15px] font-semibold text-ws-muted">
        Available at launch
      </p>
    )
  }
  const { text, showPrice } = actionLabel(pkg, single)
  return (
    <CheckoutLink data-offer-cta className={cn(GOLD_CTA, "w-full sm:w-auto")}>
      <span>{text}</span>
      {showPrice && (
        <>
          <span aria-hidden className="opacity-60">
            ·
          </span>
          <RollingAmount value={packagePriceLabel(pkg.price)} />
        </>
      )}
      <ArrowRightIcon size={16} aria-hidden className="-mr-1" />
    </CheckoutLink>
  )
}

// ---------------------------------------------------------------------------
// Single price
// ---------------------------------------------------------------------------

/**
 * The lone offer as one wide card: name, price and "Enrol now" on the left;
 * what it carries on the right. The synthesized "Full program" of a
 * ladder-less program lists only its services — its feature lines are the
 * program's "What you'll learn", already on the page.
 */
function SingleOffer({ comingSoon, lessons }: { comingSoon: boolean; lessons: LessonAccess | null }) {
  const { packages, tierCount, selected: pkg } = usePackageSelection()
  const features = tierCount > 0 ? pkg.features.filter((line) => line.trim()) : []
  const lessonsText = lessonLine(lessons, pkg.key)
  const hasServices = SERVICES.some((s) => servicesOf(pkg, tierCount)[s.key])

  const offer = (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ws-muted">
        {tierCount > 0 ? pkg.name : "Full program"}
      </p>
      <p className="mt-3 font-display text-[52px] font-light leading-none tabular-nums tracking-[-0.03em] text-ws-primary">
        {packagePriceLabel(pkg.price)}
      </p>
      {pkg.tagline && <p className="mt-3 text-pretty text-[14.5px] leading-relaxed text-ws-muted">{pkg.tagline}</p>}
      {lessonsText && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-[13px] tabular-nums text-ws-muted">
          <ListVideoIcon size={14} aria-hidden />
          {lessonsText}
        </p>
      )}
    </>
  )
  const action = (
    <>
      <OfferAction pkg={pkg} single comingSoon={comingSoon} />
      {!comingSoon && pkg.price > 0 && (
        <p className="mt-3 flex items-center gap-2 text-[13px] text-ws-muted">
          <ShieldCheckIcon size={15} className="shrink-0 text-ws-subtle" aria-hidden />
          Paid from your WorldStreet wallet at checkout
        </p>
      )}
    </>
  )

  // Nothing to list but its services: one band — the offer, what it
  // carries, the action — rather than a split card with an empty half.
  if (features.length === 0) {
    return (
      <div className="mt-8 grid gap-8 rounded-[20px] border border-ws-hairline bg-ws-surface p-6 sm:p-8 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_17rem] lg:items-center lg:gap-12 dark:border-transparent">
        <div>{offer}</div>
        {hasServices ? (
          <div className="border-t border-ws-hairline pt-7 lg:border-l lg:border-t-0 lg:py-2 lg:pl-12 lg:pt-2">
            <ServiceGrid packages={packages} tierCount={tierCount} pkg={pkg} />
          </div>
        ) : (
          <div aria-hidden className="hidden lg:block" />
        )}
        <div className="[&>a]:w-full">{action}</div>
      </div>
    )
  }

  return (
    <div className="mt-8 grid overflow-hidden rounded-[20px] border border-ws-hairline bg-ws-surface md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] dark:border-transparent">
      <div className="p-6 sm:p-8 md:bg-ws-raised/40">
        {offer}
        <div className="mt-7">{action}</div>
      </div>

      <div className="space-y-8 border-t border-ws-hairline p-6 sm:p-8 md:border-l md:border-t-0">
        {hasServices && <ServiceGrid packages={packages} tierCount={tierCount} pkg={pkg} />}
        <div>
          <h3 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ws-primary">
            Everything it includes
          </h3>
          <ul className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {features.map((line, i) => (
              <li key={`${pkg.key}-${i}`} className="flex items-start gap-2.5 text-[14.5px] leading-snug text-ws-primary/90">
                <CheckIcon size={16} className="mt-[1px] shrink-0 text-ws-muted" aria-hidden />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
