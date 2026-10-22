"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchMyEnrollments, type StudentEnrollment } from "@/lib/actions/student"
import { queryKeys } from "./keys"

export function useEnrollments() {
  return useQuery<StudentEnrollment[]>({
    queryKey: queryKeys.enrollments,
    queryFn: fetchMyEnrollments,
    staleTime: 5 * 60 * 1000, // 5 min — enrollments rarely change
    refetchInterval: 60 * 1000, // background poll every 60s
  })
}

/**
 * Imperatively refresh enrollments (e.g. after a new enrollment or a completed
 * lesson). Exam status goes with them: whether the final exam is unlocked
 * depends on the enrollment's progress.
 */
export function useInvalidateEnrollments() {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.enrollments }),
      qc.invalidateQueries({ queryKey: ["exam-status"] }),
    ])
}
