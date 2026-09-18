"use client"

import { useQuery } from "@tanstack/react-query"
import { getMyEnrollmentIntent, type MyEnrollmentIntent } from "@/lib/actions/enrollment-intent"
import { queryKeys } from "./keys"

/** The learner's saved-but-unpaid school, or null. */
export function useMyEnrollmentIntent() {
  return useQuery<MyEnrollmentIntent | null>({
    queryKey: queryKeys.enrollmentIntent,
    queryFn: getMyEnrollmentIntent,
    staleTime: 2 * 60 * 1000,
  })
}
