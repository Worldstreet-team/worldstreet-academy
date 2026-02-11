"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { toggleCourseBookmark, checkCoursesBookmarked } from "@/lib/actions/student"

/**
 * DB-backed bookmark hook.
 * Pass in the list of visible courseIds so the hook can batch-check them.
 * Returns `isBookmarked(id)` and `toggle(id)`.
 */
export function useBookmarks(courseIds: string[]) {
  const [map, setMap] = useState<Record<string, boolean>>({})
  const [isPending, startTransition] = useTransition()
  const checkedRef = useRef<string>("")

  // Batch-check bookmarks whenever the set of visible course IDs changes
  useEffect(() => {
    if (courseIds.length === 0) return
    const key = courseIds.slice().sort().join(",")
    if (key === checkedRef.current) return
    checkedRef.current = key

    checkCoursesBookmarked(courseIds).then((result) => {
      setMap((prev) => ({ ...prev, ...result }))
    })
  }, [courseIds])

  const isBookmarked = useCallback(
    (courseId: string) => !!map[courseId],
    [map],
  )

  const toggle = useCallback(
    (courseId: string) => {
      // Optimistic update
      setMap((prev) => ({ ...prev, [courseId]: !prev[courseId] }))
      startTransition(async () => {
        const result = await toggleCourseBookmark(courseId)
        if (result.success) {
          setMap((prev) => ({ ...prev, [courseId]: result.isBookmarked }))
        } else {
          // Revert on failure
          setMap((prev) => ({ ...prev, [courseId]: !prev[courseId] }))
        }
      })
    },
    [],
  )

  return { isBookmarked, toggle, isPending }
}
