"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchMyEnrollments, type StudentEnrollment } from "@/lib/actions/student"
import { queryKeys } from "./keys"

export function useEnrollments() {
  return useQuery<StudentEnrollment[]>({
    queryKey: queryKeys.enrollments,
    queryFn: fetchMyEnrollments,
    staleTime: 5 * 60 * 1000, // 5 min — enrollments rarely change
    refetchInterval: 6 * 1000, // background poll every 6s
  })
}

/** Imperatively refresh enrollments (e.g. after a new enrollment) */
export function useInvalidateEnrollments() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: queryKeys.enrollments })
}
