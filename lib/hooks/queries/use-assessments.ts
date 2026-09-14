"use client"

import { useQuery } from "@tanstack/react-query"
import { getMyAssessments, type MyAssessment } from "@/lib/actions/exams"
import { queryKeys } from "./keys"

export function useMyAssessments() {
  return useQuery<MyAssessment[]>({
    queryKey: queryKeys.assessments,
    queryFn: () => getMyAssessments(),
    staleTime: 60 * 1000,
  })
}
