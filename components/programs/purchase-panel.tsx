import Link from "next/link"
import Image from "next/image"
import {
  AwardIcon,
  CircleCheckIcon,
  ClipboardCheckIcon,
  HandshakeIcon,
  ListVideoIcon,
  MessagesSquareIcon,
  MonitorPlayIcon,
  PlayIcon,
  RadioIcon,
  SquarePlayIcon,
  type LucideIcon,
} from "lucide-react"
import type { ProgramDetail } from "@/lib/actions/student"
import type { IPackageEntitlements, PackageKey } from "@/lib/db/models"
import { PACKAGE_LABEL } from "@/lib/entitlements"
import { SCHOOL_BY_SLUG } from "@/lib/schools"
import { packagePriceLabel } from "@/lib/program-price"
import { cn } from "@/lib/utils"
import { SchoolIcon } from "@/components/shared/school-icon"
import { CourseSchedulingCta } from "@/components/shared/course-scheduling-cta"
import { WishlistButton } from "@/components/marketing/wishlist-button"
import type { ProgramAccess } from "@/components/programs/access"
import { PreviewTrigger } from "@/components/programs/preview-player"
import { SelectedOffer } from "@/components/programs/package-selection"
import { formatLength, plural } from "@/components/programs/format"

/** What the curriculum says about the program — counted from published lessons, never the stored counters. */
export type ProgramFacts = {
  lessons: number
  videoSec: number
  previews: number
}

export type IncludedItem = {
  icon: LucideIcon
  label: string
  /** The tier that unlocks it when that is above the cheapest one; null = included from the first price. */
  tier: PackageKey | null
}

/**
 * The services a tier can promise, in the order a buyer climbs them. Priority
 * support stays in the ladder's comparison table; it is not a thing a learner
 * does, so it doesn't belong on a list of what the program includes.
 */
const SERVICES: ReadonlyArray<{ key: keyof IPackageEntitlements; label: string; icon: LucideIcon }> = [
  { key: "liveClasses", label: "Live classes", icon: RadioIcon },
  { key: "instructorQa", label: "Instructor Q&A", icon: MessagesSquareIcon },
  { key: "assignments", label: "Graded assignments", icon: ClipboardCheckIcon },
  { key: "certificate", label: "Certificate of completion", icon: AwardIcon },
  { key: "mentorship", label: "1-on-1 mentorship", icon: HandshakeIcon },
]

/**
 * "This program includes", from real data only: the curriculum's own counts,
 * then the services the cheapest tier carries, then the ones a higher tier
 * adds (named by tier).
 *
 * A program without a ladder is sold as one synthesized "Full program" tier
 * whose entitlements are FULL_ACCESS — that is ACCESS for a legacy
 * enrollment, not a list of promises. Such a program lists only what a full
 * enrollment really delivers without anyone scheduling anything: the
 * certificate and instructor Q&A. Mentorship is only ever delivered to an
 * Executive enrollment (`includesMentorship`), so it is listed only there.
 */
export function programIncludes(program: ProgramDetail, facts: ProgramFacts): IncludedItem[] {
  const items: IncludedItem[] = []
  if (facts.videoSec > 0) items.push({ icon: MonitorPlayIcon, label: `${formatLength(facts.videoSec)} of video`, tier: null })
  if (facts.lessons > 0) items.push({ icon: ListVideoIcon, label: plural(facts.lessons, "lesson"), tier: null })
  if (facts.previews > 0) {
    items.push({ icon: SquarePlayIcon, label: `${plural(facts.previews, "free preview")}`, tier: null })
  }

  if (program.tierCount === 0) {
    items.push({ icon: MessagesSquareIcon, label: "Instructor Q&A", tier: null })
    items.push({ icon: AwardIcon, label: "Certificate of completion", tier: null })
    return items
  }

  const cheapest = program.packages[0]?.key
  for (const service of SERVICES) {
    const pkg = program.packages.find(
      (p) => p.entitlements[service.key] && (service.key !== "mentorship" || p.key === "executive")
    )
    if (!pkg) continue
    items.push({ icon: service.icon, label: service.label, tier: pkg.key === cheapest ? null : pkg.key })
  }
  return items
}

/**
 * The offer: art, price, the one primary action, the wishlist and what the
 * program includes. On sale, price and action follow the package choice
 * (`SelectedOffer`): "Choose your package" until the visitor has met the
 * chooser, then the selected tier straight to checkout. Rendered twice by the
 * page — as the floating card beside
 * the hero on lg (`card`, with the art and its preview button) and inline in
 * the hero below lg (`inline`, the art already leads the hero there) — with
 * `data-purchase` on both, which is how the bottom bar knows an offer is on
 * screen.
 */
export function PurchasePanel({
  program,
  access,
  scheduling,
  signedIn,
  fromPrice,
  multiTier,
  includes,
  hasPreview,
  variant,
}: {
  program: ProgramDetail
  access: ProgramAccess
  scheduling: { isComingSoon: boolean; isPreEnrolled: boolean } | null
  signedIn: boolean
  fromPrice: number
  multiTier: boolean
  includes: IncludedItem[]
  hasPreview: boolean
  variant: "card" | "inline"
}) {
  const card = variant === "card"

  return (
    <div
      data-purchase
      className="overflow-hidden rounded-[20px] border border-ws-hairline bg-ws-surface dark:border-transparent"
    >
      {card && (
        <div className="group-data-[compact]/purchase:hidden">
          <ProgramArt program={program} hasPreview={hasPreview} sizes="23.5rem" />
        </div>
      )}

      {/* Inline (below lg) the panel is wide: from sm the offer and the
          includes list sit side by side instead of one long column. */}
      <div className={card ? "p-6" : cn("p-5 sm:p-6", includes.length > 0 && "sm:grid sm:grid-cols-2 sm:gap-8")}>
        <div>
          {access.kind === "enrolled" ? (
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-ws-success/[0.14] text-ws-success">
                <CircleCheckIcon size={18} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="font-display text-[19px] font-semibold tracking-[-0.01em] text-ws-primary">
                  You&apos;re enrolled
                </p>
                <p className="mt-0.5 text-[13.5px] text-ws-muted">Pick up where you left off.</p>
              </div>
            </div>
          ) : scheduling ? (
            <>
              <p className="flex items-baseline gap-2">
                <span className="font-display text-[44px] font-light leading-none tabular-nums tracking-[-0.025em] text-ws-primary">
                  {packagePriceLabel(fromPrice)}
                </span>
                {multiTier && fromPrice > 0 && <span className="text-[14px] font-medium text-ws-muted">to start</span>}
              </p>
              {multiTier && (
                <p className="mt-2.5 text-[13.5px] text-ws-muted">
                  <span className="tabular-nums">{program.packages.length}</span> packages ·{" "}
                  {PACKAGE_LABEL[program.packages[0].key]} to{" "}
                  {PACKAGE_LABEL[program.packages[program.packages.length - 1].key]}
                </p>
              )}
            </>
          ) : (
            // On sale: price, sub-line and action follow the package choice.
            <SelectedOffer fromPrice={fromPrice} />
          )}

          {access.kind === "enrolled" ? (
            <div className="mt-5">
              <Link
                href={access.continueHref}
                className="flex h-12 w-full items-center justify-center rounded-full bg-ws-brand px-5 text-[15px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ws-surface active:translate-y-px"
              >
                Continue learning
              </Link>
            </div>
          ) : scheduling ? (
            <div className="mt-5">
              <CourseSchedulingCta
                courseId={program.id}
                availableAt={program.availableAt}
                isComingSoon={scheduling.isComingSoon}
                preEnrollEnabled={program.preEnrollEnabled}
                isPreEnrolled={scheduling.isPreEnrolled}
                isPaid={program.pricing === "paid"}
                price={program.price}
                signedIn={signedIn}
              />
            </div>
          ) : (
            <WishlistButton
              courseId={program.id}
              signedIn={signedIn}
              variant="full"
              className="mt-2.5 h-12 rounded-full transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised hover:opacity-100"
            />
          )}
        </div>

        {includes.length > 0 && (
          <div
            className={cn(
              "mt-6 border-t border-ws-hairline pt-5",
              !card && "sm:mt-0 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0"
            )}
          >
            <p className="text-[14px] font-semibold text-ws-primary">This program includes</p>
            <ul className="mt-3 space-y-2.5">
              {includes.map(({ icon: Icon, label, tier }) => (
                <li key={label} className="flex items-center gap-3 text-[14px]">
                  <Icon size={16} className="shrink-0 text-ws-muted" aria-hidden />
                  <span className="min-w-0 flex-1 text-ws-primary">{label}</span>
                  {tier && (
                    <span className="shrink-0 rounded-full border border-ws-hairline px-2 py-0.5 text-[11.5px] font-medium text-ws-muted">
                      <span className="sr-only">with the </span>
                      {PACKAGE_LABEL[tier]}
                      <span className="sr-only"> package</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * The program's art at 16:9. With a free preview it becomes the preview
 * button (Udemy's "Preview this course"); without art, a school-marked panel
 * stands in — never a grey box.
 */
export function ProgramArt({
  program,
  hasPreview,
  sizes,
  priority = false,
  className,
}: {
  program: ProgramDetail
  hasPreview: boolean
  sizes: string
  priority?: boolean
  className?: string
}) {
  const school = program.school ? SCHOOL_BY_SLUG[program.school] : null
  const art = (
    <span className={cn("relative block aspect-video w-full overflow-hidden bg-ws-raised", className)}>
      {program.thumbnailUrl ? (
        <Image src={program.thumbnailUrl} alt="" fill priority={priority} sizes={sizes} className="object-cover" />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-ws-muted">
          <SchoolIcon name={school?.icon ?? "graduation-cap"} size={36} aria-hidden />
        </span>
      )}
      {hasPreview && (
        <>
          {/* Hover deepens the scrim one step — chromatic, never a scale. */}
          <span aria-hidden className="absolute inset-0 bg-linear-to-t from-black/70 via-black/25 to-black/5" />
          <span aria-hidden className="absolute inset-0 bg-black/0 transition-colors duration-[var(--ws-motion-fast)] group-hover/art:bg-black/15" />
          <span aria-hidden className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-white text-black">
              <PlayIcon size={20} fill="currentColor" className="ml-0.5" />
            </span>
          </span>
          <span className="absolute inset-x-0 bottom-3.5 text-center text-[14px] font-semibold text-white">
            Preview this program
          </span>
        </>
      )}
    </span>
  )

  if (!hasPreview) return art
  return (
    <PreviewTrigger
      label="Preview this program"
      className="group/art block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ws-brand/60"
    >
      {art}
    </PreviewTrigger>
  )
}
