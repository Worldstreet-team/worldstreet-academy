import { notFound } from "next/navigation"
import { fetchCertificate } from "@/lib/actions/certificates"
import { CertificateClient } from "@/components/learn/certificate-view"

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ courseId: string }>
}) {
  const { courseId } = await params
  const certificate = await fetchCertificate(courseId)

  if (!certificate) notFound()

  return <CertificateClient data={certificate} />
}
