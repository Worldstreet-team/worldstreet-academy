"use client"
import { BookmarkIcon } from "@/components/icons"

import { useCallback, useEffect, useState, useTransition } from "react"
import { toggleCourseBookmark, checkCoursesBookmarked } from "@/lib/actions/student"


export function BookmarkButton({ courseId, className }: { courseId: string; className?: string }) {
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    checkCoursesBookmarked([courseId])
      .then((result) => {
        setIsBookmarked(!!result[courseId])
      })
      // 2026-11-12: unknown (offline, a tab left open across a deploy) reads as not saved.
      .catch(() => {})
  }, [courseId])

  const handleToggle = useCallback(() => {
    setIsBookmarked((prev) => !prev)
    startTransition(async () => {
      // 2026-11-12: a thrown call reached the error boundary and took the course page down.
      // const result = await toggleCourseBookmark(courseId)
      const result = await toggleCourseBookmark(courseId).catch(() => ({ success: false, isBookmarked: false }))
      if (result.success) {
        setIsBookmarked(result.isBookmarked)
      } else {
        setIsBookmarked((prev) => !prev)
      }
    })
  }, [courseId])

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isPending}
      // 2026-11-12: an icon-only button had no name for screen readers.
      aria-label={isBookmarked ? "Remove bookmark" : "Bookmark this program"}
      aria-pressed={isBookmarked}
      className={className ?? "absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-black/30 text-white hover:bg-black/50 transition-all"}
    >
      <BookmarkIcon
        
        size={16}
        fill={isBookmarked ? "currentColor" : "none"} />
    </button>
  )
}
