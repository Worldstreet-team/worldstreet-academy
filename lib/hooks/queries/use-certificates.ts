"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchMyCertificates, type StudentCertificate } from "@/lib/actions/certificates"
import { queryKeys } from "./keys"

export function useMyCertificates() {
  return useQuery<StudentCertificate[]>({
    queryKey: queryKeys.certificates,
    queryFn: () => fetchMyCertificates(),
    staleTime: 5 * 60 * 1000,
  })
}
