"use client"

/**
 * System primitives — ported from the hub's reference implementation
 * (dashboard-revamp/components/ui/system.tsx, Design System v2), which is the
 * web port of the mobile app's `crypto/ui/bits.tsx` discipline. Sizes are
 * measured off the live iPhone 17 simulator, not guessed. House rules these
 * encode:
 *
 *  · Colour carries meaning only: gold = brand/primary action, emerald/red =
 *    money direction (via the --credit/--debit token pairs), nothing decorative.
 *  · Dark cards separate by fill, not outline; rows separate with hairlines.
 *  · Every figure is tabular so live values don't jitter.
 *  · A card names itself INSIDE the card (title + subtitle), never with a
 *    decorative leading icon.
 *  · Active segment = neutral raised fill (accent), never a gold fill.
 *  · Balance figures are LIGHT weight and large — the hero is airy, not chunky.
 *
 * Academy port notes (where this file departs from the hub, and why):
 *
 *  · No glass. The hub's CardShell/ActionPill are clear panes over its silk
 *    WebGL field; Academy has no field, and design-system/06 bans
 *    backdrop-filter. Cards are the v2 solid spec instead (04-components →
 *    Card): `card` fill, 20px corners, no border in dark, hairline in light,
 *    never a shadow.
 *  · Radii are written as the hub's PIXELS, not its class names: Academy's
 *    `--radius` is 13px, so `rounded-2xl`/`rounded-xl` resolve larger here
 *    than on the hub. Card corner = `rounded-[20px]`; the ListRow icon chip
 *    is 10px (`rounded-md` on this repo's ladder).
 *  · Internal hrefs go through next/link; illustrations through next/image.
 *  · Segmented drops the hub's Vivid-only `vividPrefix` (Academy's Vivid has
 *    no data-vivid-target registry).
 *  · Skeleton blocks hold a static tone — see `.skel` in app/globals.css.
 *  · Not ported: ALLOCATION_RAMP / allocationColor / WeightBar (crypto
 *    portfolio composition, a literal oklch palette).
 *
 * Icons: kit props typed `React.ComponentType<{ className?: string }>` take a
 * Hugeicons glyph through a one-line wrapper, as the hub does:
 *   const WalletGlyph = ({ className }: { className?: string }) =>
 *     <HugeiconsIcon icon={Wallet01Icon} className={className} />
 * The global two-tone rule (app/globals.css) inks the outer path and golds the
 * inner strokes; wrap an icon in `.ws-icon-mono` when it must be one colour.
 */

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { RollingAmount } from "@/components/ui/rolling-amount"

export { RollingAmount }

/* ── Illustrations — ported from the mobile app's assets/banners ──────────
   Copied byte-for-byte from dashboard-revamp/public/illustrations/. */

export const illustrations = {
  noCrypto:        "/illustrations/no-crypto-yet.png",
  noTransactions:  "/illustrations/empty-transactions.png",
  noNotifications: "/illustrations/empty-notifications.png",
  beneficiaries:   "/illustrations/beneficiaries.png",
  kyc:             "/illustrations/kyc-gold.png",
  twoFactor:       "/illustrations/two-factor-auth.png",
  cryptoBuy:       "/illustrations/crypto-buy.png",
  cryptoSwap:      "/illustrations/crypto-swap.png",
  cryptoTrade:     "/illustrations/crypto-trade.png",
  welcome:         "/illustrations/dashboard-welcome.png",
  noMessages:      "/illustrations/no-messages-illustration.png",
  unauthorized:    "/illustrations/unauthorized-illustration.png",
} as const

export type IllustrationKey = keyof typeof illustrations

/* ── Rise — staggered entrance wrapper (mobile's Rise cascade) ─────────── */

export function Rise({
  delay = 0,
  className,
  children,
}: {
  delay?: number
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("rise", className)} style={{ "--rise-delay": `${delay}ms` } as React.CSSProperties}>
      {children}
    </div>
  )
}

/* ── Eyebrow — the uppercase section/stat label (mobile: 13px, 0.08em) ─── */

export function Eyebrow({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground", className)}>
      {children}
    </span>
  )
}

/* ── Balance — the hero figure. Large, LIGHT, tabular. ─────────────────── */

export function Balance({
  value,
  hidden,
  mask = "$••••••",
  className,
}: {
  value: string
  hidden?: boolean
  mask?: string
  className?: string
}) {
  return (
    <RollingAmount
      value={hidden ? mask : value}
      className={cn(
        "font-display font-light leading-[1.05] tracking-[-0.02em]",
        "text-[clamp(2.75rem,5.5vw,4.5rem)]",
        className,
      )}
    />
  )
}

/* ── DeltaChip — percent/amount change in a 14%-tinted chip ────────────── */

export function DeltaChip({
  value,
  suffix = "%",
  prefix,
  className,
}: {
  /** The signed number. Positive renders credit, negative renders debit. */
  value: number
  suffix?: string
  prefix?: string
  className?: string
}) {
  const up = value >= 0
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-1 text-[13px] font-semibold tabular-nums",
        up ? "bg-credit-chip text-credit" : "bg-debit-chip text-debit",
        className,
      )}
    >
      {up ? "+" : ""}
      {prefix}
      {Math.abs(value) >= 1000
        ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
        : value.toFixed(2)}
      {suffix}
    </span>
  )
}

/* ── ChangeText — bare directional figure for table cells ──────────────── */

export function ChangeText({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("font-medium tabular-nums", value >= 0 ? "text-credit" : "text-debit", className)}>
      {value >= 0 ? "+" : ""}
      {value.toFixed(2)}%
    </span>
  )
}

/* ── Segmented — the ONE tab system. Fully-rounded track, raised thumb. ── */

export type SegmentedOption<T extends string> = {
  key: T
  label: string
  icon?: React.ComponentType<{ className?: string }>
  /** The tab leads somewhere that is not open yet. It stays VISIBLE — the
   *  feature is coming and people have already found it — but it cannot be
   *  selected, and it says why on hover. Removing it instead would hide a
   *  roadmap; leaving it live would let a click do nothing. */
  disabled?: boolean
  /** Tooltip/`title` text for a disabled option. */
  disabledReason?: string
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  grow = false,
  className,
}: {
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (key: T) => void
  /** md = the mobile 40px bar. sm = compact, for inside card headers. */
  size?: "sm" | "md"
  /** Fill the row: the track goes full-width and options split it evenly.
   *  For master tab bars (e.g. a page's top-level view toggle). */
  grow?: boolean
  className?: string
}) {
  const md = size === "md"
  const trackRef = React.useRef<HTMLDivElement>(null)
  const [thumb, setThumb] = React.useState<{ left: number; width: number } | null>(null)
  const [settled, setSettled] = React.useState(false)

  const measure = React.useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const btn = track.querySelector<HTMLElement>(`[data-seg-key="${CSS.escape(value)}"]`)
    if (!btn) return
    setThumb({ left: btn.offsetLeft, width: btn.offsetWidth })
  }, [value])

  React.useLayoutEffect(() => {
    measure()
  }, [measure, options.length, size, grow])

  // grow-bars resize with the viewport, and late font loads reflow labels.
  React.useEffect(() => {
    const track = trackRef.current
    if (!track || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(measure)
    ro.observe(track)
    return () => ro.disconnect()
  }, [measure])

  // The thumb must not slide on first paint — springs are for changes, not
  // arrivals. The transition switches on one frame after the first measure.
  React.useEffect(() => {
    if (!thumb || settled) return
    const id = requestAnimationFrame(() => setSettled(true))
    return () => cancelAnimationFrame(id)
  }, [thumb, settled])

  // Droplet: while the thumb travels it stretches like liquid and relaxes
  // as it lands — fired only on a value CHANGE, never on first paint.
  // (The hub flips this from an effect with a timeout; here the change is
  // caught during render and the class clears on animationend, which keeps
  // react-hooks/set-state-in-effect quiet with the same result.)
  const [stretching, setStretching] = React.useState(false)
  const [prevValue, setPrevValue] = React.useState(value)
  if (prevValue !== value) {
    setPrevValue(value)
    if (settled) setStretching(true)
  }

  return (
    // The track is the SUNKEN step of the stone ladder and the thumb is the
    // RAISED one — two full steps apart, so the selection stays legible on a
    // card and on the page. A translucent track (foreground/6%) picked up
    // whatever was behind it and the thumb vanished.
    // The thumb is ONE element that slides between options on a spring —
    // selection travels, it doesn't teleport.
    <div
      ref={trackRef}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full bg-surface-sunken",
        md ? "gap-1 p-1" : "gap-0.5 p-0.5",
        // flex-1 (basis 0) rather than a bare w-full: inside a flex row, 100%
        // would claim the whole line and squeeze out anything beside it.
        grow && "flex w-full min-w-0 flex-1",
        className,
      )}
    >
      {thumb && (
        <span
          aria-hidden
          onAnimationEnd={() => setStretching(false)}
          className={cn(
            "absolute rounded-full bg-card shadow-sm ring-1 ring-foreground/[0.08] dark:bg-accent",
            md ? "inset-y-1" : "inset-y-0.5",
            settled &&
              "transition-[left,width] duration-[340ms] [transition-timing-function:cubic-bezier(0.3,1.4,0.4,1)] motion-reduce:transition-none",
            stretching && "ws-thumb-stretch",
          )}
          style={{ left: thumb.left, width: thumb.width }}
        />
      )}
      {options.map((opt) => {
        const active = value === opt.key
        const Icon = opt.icon
        const off = opt.disabled === true
        return (
          <button
            key={opt.key}
            type="button"
            data-seg-key={opt.key}
            aria-pressed={active}
            disabled={off}
            title={off ? opt.disabledReason : undefined}
            onClick={() => { if (!off) onChange(opt.key) }}
            className={cn(
              "relative z-10 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              md ? "px-3.5 py-2 text-[13px]" : "px-2.5 py-1 text-xs",
              grow && "flex-1 justify-center",
              off
                // Legible enough to read as a real destination, plainly not
                // pressable. No hover lift, no press squish — the control
                // must not pretend to respond.
                ? "cursor-not-allowed text-muted-foreground/45"
                : cn(
                    "active:scale-[0.96] motion-reduce:active:scale-100",
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  ),
              // Before the first client measure (SSR, fonts still loading) the
              // active button paints its own fill so selection never vanishes.
              !thumb && active && !off && "bg-card shadow-sm ring-1 ring-foreground/[0.08] dark:bg-accent",
            )}
          >
            {Icon && <Icon className={cn(md ? "h-4 w-4" : "h-3.5 w-3.5", active && !off && "text-primary")} />}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

/* ── PageHeader — title + subtitle, bare icon actions on the right ─────── */

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
  className,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  /** Where "back" goes. A href navigates; a function runs instead (close a
   *  modal, step back inside a flow). Sub-pages should always pass one — a
   *  screen you can only leave through the browser chrome is a dead end. */
  back?: string | (() => void)
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 items-start gap-2">
        {back !== undefined && <BackAction to={back} />}
        <div className="flex min-w-0 flex-col gap-0.5">
          {/* Large-title scale — the iOS register: big, bold, tight. */}
          <h1 className="font-display text-[28px] font-bold leading-[1.15] tracking-[-0.02em]">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-1">{actions}</div>}
    </div>
  )
}

/** The one back control. Sits on the SUNKEN step so it reads as a control
 *  rather than a link, and lines up with the title's cap height. */
export function BackAction({ to, className }: { to: string | (() => void); className?: string }) {
  const cls = cn(
    "mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:h-8 sm:w-8",
    className,
  )
  const icon = <HugeiconsIcon icon={ArrowLeft01Icon} className="h-[18px] w-[18px]" />
  return typeof to === "string" ? (
    <Link href={to} aria-label="Back" title="Back" className={cls}>{icon}</Link>
  ) : (
    <button type="button" onClick={to} aria-label="Back" title="Back" className={cls}>{icon}</button>
  )
}

/** Bare icon button for PageHeader actions — no chip, no border. */
export function IconAction({
  icon: Icon,
  label,
  onClick,
  href,
  active,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick?: () => void
  href?: string
  active?: boolean
}) {
  const cls = cn(
    "inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
  )
  const inner = <Icon className="h-[18px] w-[18px]" />
  return href ? (
    <Link href={href} aria-label={label} title={label} className={cls}>{inner}</Link>
  ) : (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={cls}>{inner}</button>
  )
}

/* ── CardShell — the dashboard card surface ───────────────────────────────
   v2 solid card (design-system/04-components → Card): `card` fill, 20px
   corners. Dark separates by FILL — the #1C1917-on-#0C0A09 step reads without
   an outline, so the border is transparent (kept, not removed, so the box is
   the same size in both modes). Light adds the hairline back, because paper
   fill steps are too close. Never a shadow. ─────────────────────────────── */

/**
 * "The surface you are on is ALREADY a card." A CardShell rendered inside a
 * modal popup — itself a card with its own corners and fill — would stack
 * pane on pane: two roundings, two fills, and the inner one floating a few
 * pixels inside the outer for no reason.
 *
 * Wrapping a subtree in `<FlatCardSurface>` tells every CardShell inside it
 * to contribute layout only and skip the pane. That lets a panel written for
 * the page be reused verbatim in a modal instead of being rewritten or
 * forked.
 */
const FlatCardSurfaceContext = React.createContext(false)

export function FlatCardSurface({ children }: { children: React.ReactNode }) {
  return <FlatCardSurfaceContext.Provider value={true}>{children}</FlatCardSurfaceContext.Provider>
}

export function CardShell({ className, children, ...rest }: React.ComponentProps<"div">) {
  const flat = React.useContext(FlatCardSurfaceContext)
  return (
    <div
      className={cn(
        "relative flex h-full min-w-0 flex-col",
        !flat && "overflow-hidden rounded-[20px] border border-border bg-card dark:border-transparent",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

/* ── CardHeader — the in-card header idiom (no decorative icon) ────────── */

export function CardHeader({
  title,
  subtitle,
  badge,
  link,
  right,
  className,
}: {
  title: string
  subtitle?: string
  /** Small status chip rendered beside the title (e.g. "2 in flight"). */
  badge?: React.ReactNode
  link?: { label: string; href: string }
  right?: React.ReactNode
  className?: string
}) {
  return (
    // data-slot: a surface that titles a panel ITSELF — a modal whose own
    // header already names the pane — hides these without reaching for
    // ":first-child", which would silently target the wrong node the day a
    // panel gains a banner above its header.
    <div data-slot="card-header" className={cn("flex items-center justify-between gap-3 px-4 py-3.5", className)}>
      <div className="flex min-w-0 flex-col">
        <span className="flex items-center gap-2.5">
          <h3 className="text-[15px] font-semibold leading-tight">{title}</h3>
          {badge}
        </span>
        {subtitle && <span className="text-[13px] text-muted-foreground">{subtitle}</span>}
      </div>
      {right}
      {link && (
        // Navigation stays muted — gold is for brand, primary CTA and active
        // state, never a "View all".
        <Link
          href={link.href}
          className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {link.label}
          <HugeiconsIcon icon={ArrowRight01Icon} className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  )
}

/* ── ActionPill — gold circular icon chip + label (mobile home rail) ───── */

export function ActionPill({
  icon: Icon,
  label,
  href,
  onClick,
  ...rest
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  href?: string
  onClick?: () => void
} & Record<`data-${string}`, string>) {
  const cls =
    // Solid pill on the card step (the hub's is glass over its silk field),
    // with a press squish so the rail feels like buttons rather than chips.
    "flex shrink-0 items-center gap-2.5 rounded-full bg-card py-2 pl-2 pr-4 ring-1 ring-border/40 transition-all hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.96] motion-reduce:active:scale-100"
  const inner = (
    <>
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/[0.12]">
        <Icon className="h-4 w-4 text-primary" />
      </span>
      <span className="text-[14px] font-semibold">{label}</span>
    </>
  )
  return href ? (
    <Link href={href} className={cls} {...rest}>{inner}</Link>
  ) : (
    <button type="button" onClick={onClick} className={cls} {...rest}>{inner}</button>
  )
}

/* ── EmptyState — illustration (or gold chip) + title + body + CTAs ────── */

export function EmptyState({
  illustration,
  icon: Icon,
  title,
  description,
  ctas = [],
  className,
}: {
  illustration?: IllustrationKey
  icon?: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  /** Either `href` (a real destination) or `onClick` (opens something in place, e.g. a modal) — never both. */
  ctas?: ({ label: string; icon?: React.ComponentType<{ className?: string }> } & (
    | { href: string; onClick?: never }
    | { href?: never; onClick: () => void }
  ))[]
  className?: string
}) {
  return (
    <div className={cn("flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center", className)}>
      {illustration ? (
        // Never wrap an illustration in a circle or glow — it carries its own.
        <Image
          src={illustrations[illustration]}
          alt=""
          width={112}
          height={112}
          className="h-28 w-28 object-contain"
        />
      ) : Icon ? (
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/[0.12]">
          <Icon className="h-5 w-5 text-primary" />
        </span>
      ) : null}
      <div className="flex flex-col gap-1">
        <span className="text-[15px] font-semibold">{title}</span>
        {description && (
          <span className="mx-auto max-w-xs text-[13px] leading-relaxed text-muted-foreground">
            {description}
          </span>
        )}
      </div>
      {ctas.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {ctas.map((c) => {
            const cls = "inline-flex items-center gap-1.5 rounded-full border border-primary/40 px-4 py-2 text-[13px] font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            return c.onClick ? (
              <button key={c.label} type="button" onClick={c.onClick} className={cls}>
                {c.icon && <c.icon className="h-3.5 w-3.5" />}
                {c.label}
              </button>
            ) : (
              <Link key={c.label} href={c.href} className={cls}>
                {c.icon && <c.icon className="h-3.5 w-3.5" />}
                {c.label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── ListRow — gold rounded-square icon chip + title/subtitle + right ──── */

export function ListRow({
  icon: Icon,
  iconTone = "primary",
  title,
  subtitle,
  right,
  href,
  onClick,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>
  iconTone?: "primary" | "danger"
  title: string
  subtitle?: string
  right?: React.ReactNode
  href?: string
  onClick?: () => void
  className?: string
}) {
  const inner = (
    <>
      {Icon && (
        <span
          className={cn(
            // 10px — the hub's radius-xl, which is `rounded-md` on this repo's ladder.
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-md",
            iconTone === "danger" ? "bg-debit-chip" : "bg-primary/[0.12]",
          )}
        >
          <Icon className={cn("h-[18px] w-[18px]", iconTone === "danger" ? "text-debit" : "text-primary")} />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[14px] font-medium">{title}</span>
        {subtitle && <span className="truncate text-[12.5px] text-muted-foreground">{subtitle}</span>}
      </span>
      {right}
    </>
  )
  const cls = cn("flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40", className)
  if (href) return <Link href={href} className={cls}>{inner}</Link>
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{inner}</button>
  return <div className={cls}>{inner}</div>
}

/* ── Skeletons — the shape of what's loading ───────────────────────────── */

/** One neutral block; never gold. */
export function Skel({ className }: { className?: string }) {
  return <span aria-hidden className={cn("skel block rounded-sm", className)} />
}

/**
 * A list of rows in the ListRow shape: leading avatar, two stacked lines, a
 * right-aligned figure. Rows fade toward the bottom so the card reads as
 * continuing past the fold rather than stopping dead.
 *
 * `aria-busy` + a polite label so a screen reader is told the region is
 * loading instead of being read a wall of empty boxes.
 */
export function SkeletonRows({
  rows = 4,
  label = "Loading",
  className,
}: {
  rows?: number
  label?: string
  className?: string
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={cn("flex flex-1 flex-col divide-y divide-border/15", className)}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-3"
          style={{ opacity: 1 - i * (0.55 / Math.max(1, rows - 1)) }}
        >
          <Skel className="h-8 w-8 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skel className="h-3 w-24 max-w-[40%]" />
            <Skel className="h-2.5 w-16 max-w-[28%]" />
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Skel className="h-3 w-16" />
            <Skel className="h-2.5 w-10" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Rows of figures with no avatar — tables and stat lists. */
export function SkeletonTable({
  rows = 5,
  cols = 3,
  label = "Loading",
  className,
}: {
  rows?: number
  cols?: number
  label?: string
  className?: string
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={cn("flex flex-1 flex-col divide-y divide-border/15", className)}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-3"
          style={{ opacity: 1 - i * (0.55 / Math.max(1, rows - 1)) }}
        >
          <Skel className="h-7 w-7 shrink-0 rounded-full" />
          <Skel className="h-3 w-20 max-w-[30%]" />
          <div className="flex flex-1 items-center justify-end gap-6">
            {Array.from({ length: Math.max(1, cols - 1) }).map((_, c) => (
              <Skel key={c} className="h-3 w-14" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Sparkline — a real series, or nothing ─────────────────────────────────
   Renders only when it's handed points, and returns null when it isn't: a
   chart that isn't reading data is worse than no chart. (The hub's earlier
   version drew one of two hard-coded zig-zags from a percentage's SIGN, so
   every series with the same direction got an identical curve.) */

export function Sparkline({
  points,
  width = 64,
  height = 24,
  className,
}: {
  points: number[] | undefined
  width?: number
  height?: number
  className?: string
}) {
  const id = React.useId()
  if (!points || points.length < 2) return null

  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  // A dead-flat series would otherwise pin to the top edge; centre it instead.
  const flat = max - min < Number.EPSILON
  const pad = 1.5
  const y = (v: number) =>
    flat ? height / 2 : height - pad - ((v - min) / span) * (height - pad * 2)
  const x = (i: number) => (i / (points.length - 1)) * width

  const line = points.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ")
  const up = points[points.length - 1] >= points[0]
  const stroke = up ? "var(--credit)" : "var(--debit)"

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      className={cn("shrink-0 overflow-visible", className)}
    >
      <defs>
        <linearGradient id={`sl-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${line} ${width},${height}`} fill={`url(#sl-${id})`} />
      <polyline
        points={line}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
