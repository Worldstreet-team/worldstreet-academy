"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchInstructorCourses, type InstructorCourseItem } from "@/lib/actions/instructor"
import { queryKeys } from "./keys"

export function useInstructorCourses() {
  return useQuery<InstructorCourseItem[]>({
    queryKey: queryKeys.instructorCourses,
    queryFn: fetchInstructorCourses,
    staleTime: 5 * 60 * 1000, // 5 min
    refetchInterval: 6 * 1000, // background poll every 6s
  })
}

/** Imperatively refresh instructor courses (e.g. after creating/deleting a course) */
export function useInvalidateInstructorCourses() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: queryKeys.instructorCourses })
}
