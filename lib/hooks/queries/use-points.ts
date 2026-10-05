"use client"

import { useQuery } from "@tanstack/react-query"
import { getMyPointsSummary } from "@/lib/actions/points"
import type { PointsSummary } from "@/lib/points"
import { queryKeys } from "./keys"

export function useMyPoints() {
  return useQuery<PointsSummary | null>({
    queryKey: queryKeys.points,
    queryFn: () => getMyPointsSummary(),
    staleTime: 60 * 1000,
  })
}
