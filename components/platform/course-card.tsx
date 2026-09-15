"use client"

import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, Bookmark01Icon, PlayIcon, StarIcon, Tick02Icon } from "@hugeicons/core-free-icons"
import { levelChipStyle } from "@/components/shared/level-badge"
import { AvailabilityCountdown } from "@/components/shared/availability-countdown"
import { PackageChip, ProgramCover, ProgressTrack } from "@/components/platform/program-bits"
import { Skel } from "@/components/ui/system"
import { abbreviateCount, cn } from "@/lib/utils"

/**
 * Course card — the one card used across the platform (dashboard, bookmarks,
 * my-courses, instructor catalogue), on Design System v2:
 *
 * - The v2 card: `card` fill, 20px corners, separated by fill in dark (the
 *   border is transparent there) and by a hairline on paper. Hover lightens one
 *   ladder step; never a scale, never a shadow.
 * - Cover 2:1. A scrim only when text sits on the photograph (imagery rule);
 *   a course with no photograph gets the branded cover, not a grey box.
 * - Body: title SemiBold 15 in a two-line slot so grid rows align.
 * - Footer: enrolled → 4px gold track + "N% complete"; browse → price in ink
 *   (gold is never a data colour), orange filled star, level chip.
 *
 * Owner surfaces overlay a status chip top-left and a menu top-right
 * (instructor-course-card.tsx), so both cover corners stay free of permanent
 * chrome.
 */

function formatDuration(totalMinutes: number): string {
  if (!totalMinutes || totalMinutes <= 0) return ""
  const h = Math.floor(totalMinutes / 60)
  const m = Math.round(totalMinutes % 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

type CourseCardProps = {
  href: string
  title: string
  thumbnailUrl?: string | null
  /** Enrolled variant: 0–100 renders the progress rail + caption. */
  progress?: number
  /** Browse variant. */
  price?: number | null
  pricing?: string
  rating?: number | null
  level?: string
  totalLessons?: number
  /** Owner surfaces only (instructor/admin authoring). Student-facing
   *  cards stay off: the new programs carry no curriculum yet. */
  showLessonCount?: boolean
  /** Minutes. */
  totalDuration?: number
  enrolledCount?: number
  isBookmarked?: boolean
  onToggleBookmark?: () => void
  /** ISO date: renders the "Not live yet" face — chip on the cover, countdown
   *  in the footer — replacing progress/price until the course launches. */
  comingSoonAt?: string | null
  /** Enrolled cards: the package bought, as a chip under the title. */
  packageName?: string | null
  /** Enrolled cards whose status doesn't open the player ("Refunded", "Suspended"…): a neutral cover chip and a "View" footer. */
  statusLabel?: string | null
}

const COVER_CHIP =
  "absolute left-3 top-2.5 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]"

export function CourseCard({
  href,
  title,
  thumbnailUrl,
  progress,
  price,
  pricing,
  rating,
  level,
  totalLessons,
  showLessonCount = false,
  totalDuration,
  enrolledCount,
  isBookmarked,
  onToggleBookmark,
  comingSoonAt,
  packageName,
  statusLabel,
}: CourseCardProps) {
  const showProgress = typeof progress === "number" && !comingSoonAt
  const isComplete = progress === 100 && !statusLabel
  const duration = formatDuration(totalDuration ?? 0)
  // Student-facing cards show no lesson count: the new programs carry no
  // curriculum yet and "0 lessons" is worse than saying nothing. Owner
  // surfaces opt back in, where the count is the point.
  const coverMeta = [
    showLessonCount && totalLessons ? `${totalLessons} lessons` : null,
    duration || null,
  ].filter(Boolean)
  const textOnCover = coverMeta.length > 0 || isComplete

  return (
    <Link
      href={href}
      className="group block h-full rounded-[20px] outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <article className="flex h-full flex-col overflow-hidden rounded-[20px] border border-border bg-card transition-colors duration-[var(--ws-motion-fast)] group-hover:bg-accent dark:border-transparent">
        {/* Cover */}
        <div className="relative aspect-[2/1] w-full overflow-hidden">
          <ProgramCover
            src={thumbnailUrl}
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="absolute inset-0"
          />

          {/* Scrim only under text — the imagery rule's 35% band, darker at the edge the text sits on */}
          {textOnCover && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/60 via-black/35 to-transparent" />
          )}

          {statusLabel ? (
            <span className={cn(COVER_CHIP, "text-white")}>{statusLabel}</span>
          ) : comingSoonAt ? (
            <span className={cn(COVER_CHIP, "text-primary")}>Not live yet</span>
          ) : null}

          {/* Lessons · duration */}
          {coverMeta.length > 0 && (
            <span className="ws-icon-mono absolute bottom-2.5 left-3 inline-flex items-center gap-1.5 text-[11px] font-medium tabular-nums text-white/90">
              <HugeiconsIcon icon={PlayIcon} className="h-3 w-3" aria-hidden />
              {coverMeta.join(" · ")}
            </span>
          )}

          {isComplete && (
            <span className="ws-icon-mono absolute bottom-2.5 right-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-white">
              <HugeiconsIcon icon={Tick02Icon} className="h-3 w-3" aria-hidden />
              Completed
            </span>
          )}

          {onToggleBookmark && (
            <button
              type="button"
              aria-label={isBookmarked ? "Remove bookmark" : "Bookmark course"}
              aria-pressed={isBookmarked}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onToggleBookmark()
              }}
              className="ws-touch-target ws-icon-mono absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white transition-colors duration-[var(--ws-motion-fast)] hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            >
              <HugeiconsIcon
                icon={Bookmark01Icon}
                fill={isBookmarked ? "currentColor" : "none"}
                className={cn("h-4 w-4", isBookmarked ? "text-primary" : "text-white")}
                aria-hidden
              />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col p-4">
          {/* Fixed two-line slot so grid rows align regardless of title length */}
          <h3 className="line-clamp-2 min-h-[2.6em] text-[15px] font-semibold leading-[1.3] text-foreground">
            {title}
          </h3>

          {packageName && <PackageChip name={packageName} className="mt-2 self-start" />}

          {/* Footer */}
          <div className="mt-auto pt-4">
            {comingSoonAt ? (
              <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                <span className="text-[12px] text-muted-foreground">
                  Starts in{" "}
                  <AvailabilityCountdown
                    availableAt={comingSoonAt}
                    variant="compact"
                    className="font-semibold tabular-nums text-foreground"
                  />
                </span>
                <FooterAction label="View" />
              </div>
            ) : statusLabel ? (
              <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                <span className="text-[13px] tabular-nums text-muted-foreground">
                  {typeof progress === "number" ? `${progress}% complete` : ""}
                </span>
                <FooterAction label="View" muted />
              </div>
            ) : showProgress ? (
              <>
                <ProgressTrack value={progress} label={`${title} progress`} />
                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <span className="text-[13px] tabular-nums text-muted-foreground">{progress}% complete</span>
                  <FooterAction label={isComplete ? "Review" : progress === 0 ? "Start" : "Continue"} />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                <div className="flex min-w-0 items-baseline gap-3">
                  <span className="text-[13px] font-semibold tabular-nums text-foreground">
                    {/* USD prices always carry 2 decimals (02-typography). */}
                    {pricing === "free"
                      ? "Free"
                      : price != null
                        ? `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : ""}
                  </span>
                  {rating ? (
                    <span className="inline-flex items-center gap-1">
                      <HugeiconsIcon icon={StarIcon} fill="currentColor" className="h-3 w-3 text-ws-rating" aria-hidden />
                      <span className="text-[13px] tabular-nums text-muted-foreground">{rating}</span>
                    </span>
                  ) : null}
                  {enrolledCount ? (
                    <span className="hidden text-[11px] tabular-nums text-subtle sm:inline">
                      {abbreviateCount(enrolledCount)} enrolled
                    </span>
                  ) : null}
                </div>
                {level && (
                  <span
                    className="shrink-0 rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em]"
                    style={levelChipStyle(level)}
                  >
                    {level}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </article>
    </Link>
  )
}

/** The footer's verb. Ink, not gold: a grid of gold "Continue"s would outshout the page's one primary CTA. */
function FooterAction({ label, muted = false }: { label: string; muted?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 text-[13px]",
        muted ? "font-medium text-muted-foreground" : "font-semibold text-foreground"
      )}
    >
      {label}
      <HugeiconsIcon
        icon={ArrowRight01Icon}
        className="h-3.5 w-3.5 transition-transform duration-[var(--ws-motion-fast)] group-hover:translate-x-0.5"
        aria-hidden
      />
    </span>
  )
}

/** Matching skeleton — neutral blocks mirroring the real geometry. */
export function CourseCardSkeleton() {
  return (
    <div aria-hidden className="overflow-hidden rounded-[20px] border border-border bg-card dark:border-transparent">
      <Skel className="aspect-[2/1] w-full rounded-none" />
      <div className="p-4">
        <Skel className="h-4 w-4/5" />
        <Skel className="mt-2 h-4 w-2/5" />
        <Skel className="mt-6 h-1 w-full rounded-full" />
        <div className="mt-2.5 flex items-center justify-between">
          <Skel className="h-3 w-24" />
          <Skel className="h-3 w-14" />
        </div>
      </div>
    </div>
  )
}
