"use client"

import { useQuery } from "@tanstack/react-query"
import { getMyEnrollmentIntent, type MyEnrollmentIntent } from "@/lib/actions/enrollment-intent"
import { queryKeys } from "./keys"

/**
 * The learner's saved-but-unpaid school, or null. Refetched on every mount:
 * it changes on the picker (which has no QueryProvider) and at checkout,
 * and neither invalidates this cache.
 */
export function useMyEnrollmentIntent() {
  return useQuery<MyEnrollmentIntent | null>({
    queryKey: queryKeys.enrollmentIntent,
    queryFn: getMyEnrollmentIntent,
    staleTime: 0,
    refetchOnMount: "always",
  })
}
