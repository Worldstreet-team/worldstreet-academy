import { notFound } from "next/navigation"
import { fetchCertificate } from "@/lib/actions/certificates"
import { CertificateClient } from "@/components/learn/certificate-view"
import { Topbar } from "@/components/platform/topbar"
import { appUrl } from "@/lib/app-url"

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ courseId: string }>
}) {
  const { courseId } = await params
  const certificate = await fetchCertificate(courseId)

  if (!certificate) notFound()

  // Built on the server: APP_URL reads SITE_URL, which a client bundle can't
  // see. Only a stored ID can be verified, so a legacy certificate prints none.
  const verifyUrl = certificate.certificateId ? appUrl(`/verify/${certificate.certificateId}`) : null

  return (
    <>
      <Topbar
        title="Certificate"
        breadcrumbOverrides={{
          [courseId]: certificate.courseTitle,
          certificate: "Certificate"
        }}
      />
      <CertificateClient data={certificate} verifyUrl={verifyUrl} />
    </>
  )
}
