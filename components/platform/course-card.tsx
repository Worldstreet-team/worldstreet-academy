"use client"

import Link from "next/link"
import Image from "next/image"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { levelChipStyle } from "@/components/shared/level-badge"
import { abbreviateCount } from "@/lib/utils"
import { ArrowRightIcon, BookmarkIcon, CheckIcon, PlayIcon, StarIcon } from "lucide-react"

/**
 * Course card — the one card used across the platform (dashboard, bookmarks,
 * my-courses). Built to the Academy spec (05-screens) with the reference
 * screen's cover treatment:
 *
 * - Cover 2:1 with a bottom scrim (imagery rule: 35% dark when text sits on
 *   imagery) carrying the lessons·duration pill, so the busy photographic
 *   covers stop fighting the body copy.
 * - Body: title SemiBold 15 (2-line slot so grid rows align), Avatar S +
 *   instructor caption.
 * - Footer: enrolled → 4px brand progress rail + "N% complete" + gold action;
 *   browse → gold price, orange star (always #F97316 filled), level badge.
 *
 * Hover lightens one ladder step (`bg/surface` → `bg/raised`) — never scales,
 * never adds shadow, per the system's state conventions.
 */

function formatDuration(totalMinutes: number): string {
  if (!totalMinutes || totalMinutes <= 0) return ""
  const h = Math.floor(totalMinutes / 60)
  const m = Math.round(totalMinutes % 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}


type CourseCardProps = {
  href: string
  title: string
  thumbnailUrl?: string | null
  instructorName?: string
  instructorAvatarUrl?: string | null
  /** Enrolled variant: 0–100 renders the progress rail + caption. */
  progress?: number
  /** Browse variant. */
  price?: number | null
  pricing?: string
  rating?: number | null
  level?: string
  totalLessons?: number
  /** Minutes. */
  totalDuration?: number
  enrolledCount?: number
  isBookmarked?: boolean
  onToggleBookmark?: () => void
}

export function CourseCard({
  href,
  title,
  thumbnailUrl,
  instructorName,
  instructorAvatarUrl,
  progress,
  price,
  pricing,
  rating,
  level,
  totalLessons,
  totalDuration,
  enrolledCount,
  isBookmarked,
  onToggleBookmark,
}: CourseCardProps) {
  const showProgress = typeof progress === "number"
  const isComplete = progress === 100
  const duration = formatDuration(totalDuration ?? 0)
  const coverMeta = [
    totalLessons ? `${totalLessons} lessons` : null,
    duration || null,
  ].filter(Boolean)

  return (
    <Link href={href} className="group block h-full">
      <article className="flex h-full flex-col overflow-hidden rounded-lg border border-ws-hairline bg-ws-surface transition-colors duration-[var(--ws-motion-fast)] group-hover:border-ws-muted/30 group-hover:bg-ws-raised">
        {/* Cover */}
        <div className="relative aspect-[2/1] w-full overflow-hidden bg-ws-sunken">
          {thumbnailUrl ? (
            <Image
              src={thumbnailUrl}
              alt=""
              fill
              className="object-cover transition-[filter] duration-[var(--ws-motion-base)] group-hover:brightness-110"
              sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-ws-raised">
              <PlayIcon  size={24} className="text-ws-subtle" />
            </div>
          )}

          {/* Bottom scrim so overlaid chips read against any photo */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />

          {/* Lessons · duration — the reference's cover pill */}
          {coverMeta.length > 0 && (
            <span className="absolute bottom-2.5 left-3 z-10 inline-flex items-center gap-1.5 text-[11px] font-medium tabular-nums text-white/90">
              <PlayIcon  size={11} aria-hidden />
              {coverMeta.join(" · ")}
            </span>
          )}

          {isComplete && (
            <span className="absolute bottom-2.5 right-3 z-10 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-ws-success">
              <CheckIcon  size={11} />
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
              className="ws-touch-target absolute right-2.5 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-sm bg-black/45 text-white opacity-90 transition-colors duration-[var(--ws-motion-fast)] hover:bg-black/70"
            >
              <BookmarkIcon
                
                size={14}
                fill={isBookmarked ? "currentColor" : "none"}
                className={`transition-colors duration-[var(--ws-motion-fast)] ${
                  isBookmarked ? "text-ws-brand" : "text-white"
                }`} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col p-4">
          {/* Fixed two-line slot so grid rows align regardless of title length */}
          <h3 className="line-clamp-2 min-h-[2.6em] text-[15px] font-semibold leading-[1.3] text-ws-primary">
            {title}
          </h3>

          {instructorName && (
            <div className="mt-2.5 flex items-center gap-2">
              <Avatar className="h-6 w-6 shrink-0 ring-1 ring-ws-hairline">
                {instructorAvatarUrl && <AvatarImage src={instructorAvatarUrl} alt="" />}
                <AvatarFallback className="bg-ws-chip text-[9px] text-ws-muted">
                  {initials(instructorName)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-[13px] text-ws-muted">{instructorName}</span>
            </div>
          )}

          {/* Footer */}
          <div className="mt-auto pt-4">
            {showProgress ? (
              <>
                <div className="h-1 w-full overflow-hidden rounded-full bg-ws-track">
                  <div
                    className="h-full rounded-full bg-ws-brand transition-[width] duration-[var(--ws-motion-slow)]"
                    style={{ width: `${Math.max(progress, 2)}%` }}
                  />
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <span className="text-[13px] tabular-nums text-ws-muted">
                    {progress}% complete
                  </span>
                  <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-ws-gold">
                    {isComplete ? "Review" : progress === 0 ? "Start" : "Continue"}
                    <ArrowRightIcon
                      
                      size={13}
                      aria-hidden
                      className="transition-transform duration-[var(--ws-motion-fast)] group-hover:translate-x-0.5" />
                  </span>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between gap-2 border-t border-ws-hairline pt-3">
                <div className="flex items-baseline gap-3">
                  <span className="text-[13px] font-semibold tabular-nums text-ws-gold">
                    {/* USD prices always carry 2 decimals (02-typography). */}
                    {pricing === "free" ? "Free" : price != null ? `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ""}
                  </span>
                  {rating ? (
                    <span className="inline-flex items-center gap-1">
                      <StarIcon
                        
                        size={12}
                        fill="currentColor"
                        className="text-ws-rating" />
                      <span className="text-[13px] tabular-nums text-ws-muted">{rating}</span>
                    </span>
                  ) : null}
                  {enrolledCount ? (
                    <span className="hidden text-[11px] tabular-nums text-ws-subtle sm:inline">
                      {abbreviateCount(enrolledCount)} enrolled
                    </span>
                  ) : null}
                </div>
                {level && (
                  <span
                    className="rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em]"
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

/** Matching skeleton — `bg/raised` blocks mirroring the real geometry. */
export function CourseCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-ws-hairline bg-ws-surface">
      <div className="aspect-[2/1] w-full animate-pulse bg-ws-raised" />
      <div className="p-4">
        <div className="h-4 w-4/5 animate-pulse rounded-xs bg-ws-raised" />
        <div className="mt-2 h-4 w-2/5 animate-pulse rounded-xs bg-ws-raised" />
        <div className="mt-3 flex items-center gap-2">
          <div className="h-6 w-6 animate-pulse rounded-full bg-ws-raised" />
          <div className="h-3 w-24 animate-pulse rounded-xs bg-ws-raised" />
        </div>
        <div className="mt-4 h-1 w-full animate-pulse rounded-full bg-ws-raised" />
      </div>
    </div>
  )
}
