"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { StarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { levelChipStyle } from "@/components/shared/level-badge"
import { WishlistButton, autoBookmark } from "@/components/marketing/wishlist-button"
import type { BrowseCourse } from "@/lib/actions/student"

export function formatDuration(totalMinutes: number): string {
  if (!totalMinutes || totalMinutes <= 0) return ""
  const h = Math.floor(totalMinutes / 60)
  const m = Math.round(totalMinutes % 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function formatPrice(pricing: string, price: number | null): string {
  if (pricing === "free") return "Free"
  if (price == null) return ""
  return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export function isFutureDrop(course: Pick<BrowseCourse, "availableAt">): boolean {
  return Boolean(course.availableAt && new Date(course.availableAt).getTime() > Date.now())
}

export function dropDateLabel(availableAt: string): string {
  // Pinned to UTC: this renders in SSR'd client components, and a zone-local
  // format would hydration-mismatch for every visitor west of the server.
  return new Date(availableAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

/**
 * Catalogue course card (§5). The card body is one `<Link>` to the public
 * course page; the WishlistButton is an absolutely-positioned SIBLING of the
 * link inside the same relative wrapper (valid HTML, no click collision).
 * Clicking through fires `autoBookmark` — fire-and-forget, never blocking
 * navigation.
 *
 * Fills its grid cell (`w-full`); the caller's grid owns the sizing. Hover is
 * chromatic (border → ws-brand/40) plus the one sanctioned zoom exception:
 * the thumbnail eases 1→1.03 inside its clipped frame over 600ms
 * `--ws-ease-rise` — the image moves, the card chrome stays static.
 */
export function MarketingCourseCard({
  course,
  signedIn,
  className,
}: {
  course: BrowseCourse
  signedIn: boolean
  className?: string
}) {
  const drop = isFutureDrop(course)

  return (
    <article
      className={cn(
        "group relative w-full overflow-hidden rounded-lg border border-ws-hairline bg-ws-surface transition-colors duration-[var(--ws-motion-base)] hover:border-ws-brand/40",
        className
      )}
    >
      <Link
        href={`/courses/${course.id}`}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
        onClick={() => {
          if (signedIn) void autoBookmark(course.id)
        }}
        draggable={false}
      >
        {/* Clipped thumbnail frame */}
        <div className="relative aspect-video w-full overflow-hidden bg-ws-sunken">
          {course.thumbnailUrl ? (
            <Image
              src={course.thumbnailUrl}
              alt=""
              fill
              draggable={false}
              className="object-cover transition-transform duration-600 ease-[var(--ws-ease-rise)] group-hover:scale-[1.03]"
              sizes="(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 416px"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-ws-raised">
              <Image
                src="/brand/wsa-mark.png"
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 object-contain opacity-40"
              />
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-4">
          <div className="flex items-center justify-between gap-2">
            <span
              className="rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em]"
              style={levelChipStyle(course.level)}
            >
              {course.level}
            </span>
            {drop && course.availableAt ? (
              <span className="inline-flex items-center rounded-full bg-ws-warning/15 px-2.5 py-0.5 text-[11px] font-semibold text-ws-warning">
                Drops {dropDateLabel(course.availableAt)}
              </span>
            ) : (
              <span className="text-[13px] font-semibold tabular-nums text-ws-gold">
                {formatPrice(course.pricing, course.price)}
              </span>
            )}
          </div>

          <h3 className="mt-2.5 line-clamp-2 min-h-[2.6em] font-display text-[16px] font-semibold leading-[1.3] text-ws-primary">
            {course.title}
          </h3>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-ws-hairline pt-3">
            {/* No lesson/duration counts: brand-new programs read "0 lessons"
                and that is worse than saying nothing. */}
            <span />
            <span className="flex items-center gap-2">
              {course.rating !== null && (
                <span className="inline-flex items-center gap-1 text-[12px] tabular-nums text-ws-muted">
                  <StarIcon size={11} fill="currentColor" className="text-ws-rating" />
                  {course.rating}
                </span>
              )}
              {drop && course.preEnrollEnabled && (
                <span className="text-[11px] font-medium text-ws-gold">Free pre-enroll</span>
              )}
            </span>
          </div>
        </div>
      </Link>

      {/* Sibling of the Link, per the wishlist contract. */}
      <WishlistButton
        courseId={course.id}
        signedIn={signedIn}
        className="absolute right-3 top-3 z-10"
      />
    </article>
  )
}
