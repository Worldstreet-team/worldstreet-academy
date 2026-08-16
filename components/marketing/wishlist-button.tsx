"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { Heart } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  toggleCourseBookmark,
  checkCoursesBookmarked,
} from "@/lib/actions/student"
import { addCourseBookmark } from "@/lib/actions/bookmarks"

/* ------------------------------------------------------------------------- *
 * Fire-and-forget add-only bookmark.
 *
 * Never removes an existing bookmark, swallows every error, and callers are
 * not expected to await it:  `void autoBookmark(courseId)` in a click handler
 * is the intended usage (the server-action POST fires before client-side
 * navigation and is not cancelled by it). Signed-out visitors no-op on the
 * server, so calling unconditionally is safe.
 * ------------------------------------------------------------------------- */
export async function autoBookmark(courseId: string): Promise<void> {
  try {
    await addCourseBookmark(courseId)
  } catch {
    // best-effort by design — never surface
  }
}

/* ------------------------------------------------------------------------- *
 * Batched initial-state check.
 *
 * Every WishlistButton mounted in the same effect flush funnels its courseId
 * into one `checkCoursesBookmarked` round-trip instead of N. The microtask
 * runs after React finishes the passive-effect pass, so a grid of cards
 * produces a single request.
 * ------------------------------------------------------------------------- */
let pendingChecks: Map<string, Array<(v: boolean) => void>> | null = null

function queueBookmarkCheck(courseId: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!pendingChecks) {
      pendingChecks = new Map()
      queueMicrotask(() => {
        const batch = pendingChecks
        pendingChecks = null
        if (!batch || batch.size === 0) return
        checkCoursesBookmarked([...batch.keys()])
          .then((result) => {
            for (const [id, resolvers] of batch) {
              for (const r of resolvers) r(!!result[id])
            }
          })
          .catch(() => {
            for (const resolvers of batch.values()) {
              for (const r of resolvers) r(false)
            }
          })
      })
    }
    const resolvers = pendingChecks.get(courseId) ?? []
    resolvers.push(resolve)
    pendingChecks.set(courseId, resolvers)
  })
}

/* ------------------------------------------------------------------------- *
 * WishlistButton — small ghost heart chip.
 *
 * Signed-in: optimistic toggle against `toggleCourseBookmark`, reverting if
 * the server declines. Signed-out: identical-looking chip that links to
 * /login, so the two states never shift layout.
 * ------------------------------------------------------------------------- */

const chipClasses =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full " +
  "border border-ws-hairline bg-ws-chip text-ws-muted " +
  "transition-colors hover:bg-ws-raised hover:text-ws-primary " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"

export function WishlistButton({
  courseId,
  signedIn,
  className,
}: {
  courseId: string
  signedIn: boolean
  className?: string
}) {
  const [bookmarked, setBookmarked] = useState(false)
  const [, startTransition] = useTransition()

  useEffect(() => {
    if (!signedIn) return
    let cancelled = false
    queueBookmarkCheck(courseId).then((v) => {
      if (!cancelled) setBookmarked(v)
    })
    return () => {
      cancelled = true
    }
  }, [courseId, signedIn])

  const handleToggle = useCallback(() => {
    setBookmarked((prev) => !prev)
    startTransition(async () => {
      const result = await toggleCourseBookmark(courseId)
      if (result.success) {
        setBookmarked(result.isBookmarked)
      } else {
        // server declined (or signed-out race) — revert the optimistic flip
        setBookmarked((prev) => !prev)
      }
    })
  }, [courseId])

  if (!signedIn) {
    return (
      <Link
        href="/login"
        aria-label="Sign in to save this course to your wishlist"
        title="Sign in to save"
        className={cn(chipClasses, className)}
        onClick={(e) => e.stopPropagation()}
      >
        <Heart size={15} strokeWidth={1.75} aria-hidden />
      </Link>
    )
  }

  return (
    <button
      type="button"
      aria-pressed={bookmarked}
      aria-label={bookmarked ? "Remove from wishlist" : "Save to wishlist"}
      title={bookmarked ? "Remove from wishlist" : "Save to wishlist"}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        handleToggle()
      }}
      className={cn(
        chipClasses,
        bookmarked && "border-ws-brand/40 text-ws-gold hover:text-ws-gold",
        className
      )}
    >
      <Heart
        size={15}
        strokeWidth={1.75}
        fill={bookmarked ? "currentColor" : "none"}
        aria-hidden
      />
    </button>
  )
}
