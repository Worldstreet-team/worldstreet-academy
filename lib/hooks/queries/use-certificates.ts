"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchMyCertificates, type StudentCertificate } from "@/lib/actions/certificates"
import { queryKeys } from "./keys"

/** `enabled: false` keeps the query off for a student whose packages include no certificate (the home passes that). */
export function useMyCertificates(enabled = true) {
  return useQuery<StudentCertificate[]>({
    queryKey: queryKeys.certificates,
    queryFn: () => fetchMyCertificates(),
    enabled,
    staleTime: 5 * 60 * 1000,
  })
}
