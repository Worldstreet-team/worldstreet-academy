"use client"

import { useQuery } from "@tanstack/react-query"
import { getMyMastery } from "@/lib/actions/mastery"
import type { MyMastery } from "@/lib/mastery-score"
import { queryKeys } from "./keys"

export function useMyMastery() {
  return useQuery<MyMastery[] | null>({
    queryKey: queryKeys.mastery,
    queryFn: () => getMyMastery(),
    staleTime: 60 * 1000,
  })
}
