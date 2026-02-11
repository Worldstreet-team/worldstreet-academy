"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Bookmark01Icon } from "@hugeicons/core-free-icons"
import { toggleCourseBookmark, checkCoursesBookmarked } from "@/lib/actions/student"

export function BookmarkButton({ courseId, className }: { courseId: string; className?: string }) {
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    checkCoursesBookmarked([courseId]).then((result) => {
      setIsBookmarked(!!result[courseId])
    })
  }, [courseId])

  const handleToggle = useCallback(() => {
    setIsBookmarked((prev) => !prev)
    startTransition(async () => {
      const result = await toggleCourseBookmark(courseId)
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
      className={className ?? "absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 transition-all"}
    >
      <HugeiconsIcon
        icon={Bookmark01Icon}
        size={16}
        fill={isBookmarked ? "currentColor" : "none"}
      />
    </button>
  )
}
