"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchBrowseCourses, type BrowseCourse } from "@/lib/actions/student"
import { queryKeys } from "./keys"
import { afterPageHydration } from "./after-hydration"

export function useBrowseCourses(filters?: { level?: string; pricing?: string }) {
  return useQuery<BrowseCourse[]>({
    queryKey: queryKeys.browseCourses(filters),
    // 2026-11-12: waits for the page to hydrate — the ⌘K search shares this with the
    // dashboard's Discover row (after-hydration.ts, React #418). Was:
    // queryFn: () => fetchBrowseCourses(filters),
    queryFn: async () => {
      await afterPageHydration()
      return fetchBrowseCourses(filters)
    },
    staleTime: 10 * 60 * 1000, // 10 min — course catalog changes rarely
  })
}
