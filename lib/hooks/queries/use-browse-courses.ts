"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchBrowseCourses, type BrowseCourse } from "@/lib/actions/student"
import { queryKeys } from "./keys"

export function useBrowseCourses(filters?: { level?: string; pricing?: string }) {
  return useQuery<BrowseCourse[]>({
    queryKey: queryKeys.browseCourses(filters),
    queryFn: () => fetchBrowseCourses(filters),
    staleTime: 10 * 60 * 1000, // 10 min — course catalog changes rarely
  })
}
