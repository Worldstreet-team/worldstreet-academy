"use client"

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { fetchMyBookmarks, toggleCourseBookmark, type StudentBookmark } from "@/lib/actions/student"
import { queryKeys } from "./keys"

export function useBookmarks() {
  return useQuery<StudentBookmark[]>({
    queryKey: queryKeys.bookmarks,
    queryFn: fetchMyBookmarks,
    staleTime: 2 * 60 * 1000,
  })
}

/** Derived set of bookmarked course IDs for quick lookup */
export function useBookmarkedIds() {
  const { data: bookmarks } = useBookmarks()
  return new Set(bookmarks?.map((b) => b.courseId) ?? [])
}

/** Toggle bookmark with optimistic update */
export function useToggleBookmark() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: toggleCourseBookmark,
    onMutate: async (courseId) => {
      // Cancel in-flight refetches
      await qc.cancelQueries({ queryKey: queryKeys.bookmarks })
      const prev = qc.getQueryData<StudentBookmark[]>(queryKeys.bookmarks)

      // Optimistic removal (we don't have full data for add, so just remove)
      if (prev) {
        qc.setQueryData<StudentBookmark[]>(
          queryKeys.bookmarks,
          prev.filter((b) => b.courseId !== courseId)
        )
      }
      return { prev }
    },
    onError: (_err, _courseId, ctx) => {
      // Rollback on error
      if (ctx?.prev) qc.setQueryData(queryKeys.bookmarks, ctx.prev)
    },
    onSettled: () => {
      // Always refetch to get the true state
      qc.invalidateQueries({ queryKey: queryKeys.bookmarks })
    },
  })
}
