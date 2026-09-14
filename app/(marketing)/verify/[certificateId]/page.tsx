import type { Metadata } from "next"
import Link from "next/link"
import { BadgeCheckIcon, CircleAlertIcon } from "lucide-react"
import { verifyCertificate } from "@/lib/actions/certificates"
import { BRAND } from "@/lib/brand"

// Certificates are issued and revoked (refunds) at any moment — never cache.
export const revalidate = 0

type Params = { params: Promise<{ certificateId: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { certificateId } = await params
  return {
    title: `Certificate ${certificateId.trim().toUpperCase().slice(0, 40)}`,
    description: `Check that a ${BRAND.name} certificate is genuine.`,
    // Verification pages carry student names — never index them.
    robots: { index: false },
  }
}

/** UTC, like the certificate itself — paper and this page show the same day. */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  })
}

function Field({ label, value, numeric = false }: { label: string; value: string; numeric?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-ws-subtle">{label}</dt>
      <dd className={`mt-1 break-words text-[15px] font-medium text-ws-primary${numeric ? " tabular-nums" : ""}`}>
        {value}
      </dd>
    </div>
  )
}

/**
 * `/verify/[certificateId]` — spec §13 made checkable. Public (no auth), RSC,
 * noindex. The ID is read case-insensitively; an unknown, revoked or
 * non-certifying ID reads "No certificate with this ID" (HTTP 200). Lookups are
 * rate-limited per IP; over the limit the page says so inline, never "not found".
 */
export default async function VerifyCertificatePage({ params }: Params) {
  const { certificateId } = await params
  const result = await verifyCertificate(certificateId)
  const rateLimited = result === "rate_limited"
  const certificate = rateLimited ? null : result
  const lookedUp = certificateId.trim().toUpperCase().slice(0, 40)

  return (
    <div className="mx-auto max-w-3xl px-6 pb-24 pt-10 md:pb-32 md:pt-16">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ws-gold">Certificate verification</p>
      <h1
        className="mt-4 font-display font-semibold leading-[1.05] tracking-[-0.02em] text-ws-primary"
        style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)" }}
      >
        Verify a certificate
      </h1>
      <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ws-muted md:text-[17px]">
        Every {BRAND.name} certificate carries a unique ID. This page checks it against our records.
      </p>

      {rateLimited ? (
        <section aria-labelledby="certificate-heading" className="mt-10 rounded-lg bg-ws-surface p-6 md:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ws-warning/10 text-ws-warning">
              <CircleAlertIcon size={18} aria-hidden />
            </span>
            <h2 id="certificate-heading" className="min-w-0 font-display text-lg font-semibold text-ws-primary">
              Too many lookups — try again in a few minutes.
            </h2>
          </div>
        </section>
      ) : certificate ? (
        <section aria-labelledby="certificate-heading" className="mt-10 rounded-lg bg-ws-surface p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              id="certificate-heading"
              className="font-mono text-[15px] tabular-nums tracking-wide text-ws-primary"
            >
              {certificate.certificateId}
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ws-success/10 px-2.5 py-1 text-[12px] font-semibold text-ws-success">
              <BadgeCheckIcon size={14} aria-hidden />
              Valid
            </span>
          </div>
          <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
            <Field label="Student" value={certificate.studentName} />
            <Field label="Program" value={certificate.programName} />
            {certificate.schoolName && <Field label="School" value={certificate.schoolName} />}
            <Field label="Completed" value={formatDate(certificate.completedAt)} numeric />
            {certificate.instructorName && <Field label="Instructor" value={certificate.instructorName} />}
          </dl>
          <p className="mt-6 border-t border-ws-hairline pt-4 text-[13px] leading-relaxed text-ws-muted">
            This certificate was issued by {BRAND.name} and matches our records.
          </p>
        </section>
      ) : (
        <section aria-labelledby="certificate-heading" className="mt-10 rounded-lg bg-ws-surface p-6 md:p-8">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ws-danger/10 text-ws-danger">
              <CircleAlertIcon size={18} aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 id="certificate-heading" className="font-display text-lg font-semibold text-ws-primary">
                No certificate with this ID
              </h2>
              <p className="mt-1 break-all font-mono text-[13px] tabular-nums text-ws-muted">{lookedUp}</p>
              <p className="mt-3 text-[14px] leading-relaxed text-ws-muted">
                Check the ID printed at the bottom of the certificate: {BRAND.certificatePrefix}- followed by eight
                letters and numbers.
              </p>
            </div>
          </div>
        </section>
      )}

      <Link
        href="/schools"
        className="mt-10 inline-flex h-11 items-center justify-center rounded-sm border border-ws-hairline px-6 text-[14px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:border-ws-brand/40 hover:text-ws-gold"
      >
        Explore the schools
      </Link>
    </div>
  )
}
