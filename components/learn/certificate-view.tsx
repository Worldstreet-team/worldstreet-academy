"use client"
import { CheckIcon, ChevronLeftIcon, CopyIcon, DownloadIcon, ImageIcon, LockIcon } from "@/components/icons"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { CertificateData } from "@/lib/actions/certificates"
import { SignatureCanvas } from "@/components/shared/signature-canvas"
import { BRAND } from "@/lib/brand"
import { CERT_TIER_LABEL } from "@/lib/certificate-tier"

/**
 * The certificate page (owner, 2026-11-08: "better designed and in a
 * downloadable way"). The certificate itself is one server-drawn picture
 * (lib/certificate-art.tsx via ./image): the page shows it, and "Download PDF"
 * and "Image" fetch the same drawing at print size, so the download is exactly
 * what the learner sees. An Academy certificate is ready on completion; a
 * marketplace creator's waits for the creator's signature (`data.locked`).
 * The learner's own signature is optional and prints above "Holder".
 */

/**
 * The stored certificate ID, or — for a certificate completed before IDs were
 * stored — the ID it has always printed. Same rule as `legacyCertificateId` in
 * lib/certificate-id.ts, the image route and the backfill in
 * scripts/backfill-certificate-ids.mjs, repeated because that module (node
 * crypto + Mongoose) can't enter a client bundle. Change them together.
 */
function printedCertificateId(data: CertificateData): string {
  return data.certificateId ?? `${BRAND.certificatePrefix}-${data.id.slice(-8).toUpperCase()}`
}

/** A short stable tag for a signature URL, so a new signature fetches a new picture. */
function versionOf(value: string | null): string {
  if (!value) return "0"
  let h = 0
  for (let i = 0; i < value.length; i++) h = (Math.imul(31, h) + value.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export function CertificateClient({ data, verifyUrl }: { data: CertificateData; verifyUrl: string | null }) {
  const certificateId = printedCertificateId(data)
  /** Printed without the scheme; never uppercased — the /verify path is case-sensitive. */
  const verifyLabel = verifyUrl ? verifyUrl.replace(/^https?:\/\//, "") : null

  const [studentSig, setStudentSig] = useState<string | null>(data.studentSignatureUrl)
  const [showCanvas, setShowCanvas] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState<"pdf" | "png" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  // Bumped by "Try again": a failed image needs a new address, or the browser reuses the failure.
  const [retry, setRetry] = useState(0)

  const imgRef = useRef<HTMLImageElement>(null)
  const imageBase = `/dashboard/courses/${data.courseId}/certificate/image`
  const version = versionOf(studentSig)
  const previewSrc = `${imageBase}?v=${version}${retry ? `&r=${retry}` : ""}`
  const fileStem = `${BRAND.name}-Certificate-${data.programName}`.replace(/[^a-zA-Z0-9]+/g, "-").replace(/-+$/, "")
  const title = `${CERT_TIER_LABEL[data.tier]}: ${data.programName}`

  // The server-rendered <img> can finish (or fail) before React attaches onLoad/onError, which then
  // never fire: read its state once mounted, and again whenever the address changes.
  useEffect(() => {
    const el = imgRef.current
    if (!el || !el.complete) return
    if (el.naturalWidth > 0) setLoaded(true)
    else setFailed(true)
  }, [previewSrc])

  // The print-size drawing takes the server a few seconds, so it starts once the certificate is
  // showing; a download reuses that request (one per version), and a failed one is retried.
  const printRef = useRef<{ version: string; blob: Promise<Blob> } | null>(null)
  const printImage = useCallback((): Promise<Blob> => {
    if (printRef.current?.version === version) return printRef.current.blob
    const blob = fetch(`${imageBase}?size=print&v=${version}`, { cache: "no-store" }).then((res) => {
      if (!res.ok) throw new Error(`certificate image ${res.status}`)
      return res.blob()
    })
    printRef.current = { version, blob }
    blob.catch(() => {
      if (printRef.current?.blob === blob) printRef.current = null
    })
    return blob
  }, [imageBase, version])

  useEffect(() => {
    if (!loaded || data.locked) return
    const t = setTimeout(() => void printImage().catch(() => {}), 800)
    return () => clearTimeout(t)
  }, [loaded, data.locked, printImage])

  async function download(kind: "pdf" | "png") {
    setBusy(kind)
    setError(null)
    try {
      if (kind === "png") {
        saveBlob(await printImage(), `${fileStem}.png`)
        return
      }
      const [blob, { jsPDF }] = await Promise.all([printImage(), import("jspdf")])
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true })
      doc.setProperties({ title, subject: `Certificate ID ${certificateId}`, author: BRAND.name, creator: BRAND.name })
      // The drawing is A4 landscape (297×210 mm), edge to edge.
      doc.addImage(await blobToDataUrl(blob), "PNG", 0, 0, 297, 210, undefined, "FAST")
      doc.save(`${fileStem}.pdf`)
    } catch (err) {
      console.error("[Certificate] download failed:", err)
      setError("We couldn't prepare the download. Please try again.")
    } finally {
      setBusy(null)
    }
  }

  async function copyVerifyLink() {
    if (!verifyUrl) return
    try {
      await navigator.clipboard.writeText(verifyUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center bg-ws-page pb-24 md:pb-12">
      {/* Top bar */}
      <div className="flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <Button variant="ghost" size="sm" render={<Link href="/dashboard/certificates" />} className="gap-1.5">
          <ChevronLeftIcon size={16} />
          My Certificates
        </Button>

        {!data.locked && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" disabled={busy !== null || failed} onClick={() => download("png")}>
              <ImageIcon size={16} />
              {busy === "png" ? "Preparing…" : "Image"}
            </Button>
            <Button size="sm" className="gap-1.5" disabled={busy !== null || failed} onClick={() => download("pdf")}>
              <DownloadIcon size={16} />
              {busy === "pdf" ? "Preparing…" : "Download PDF"}
            </Button>
          </div>
        )}
      </div>
      {error && <p className="-mt-1 mb-3 w-full max-w-5xl px-4 text-right text-xs text-ws-danger">{error}</p>}

      {/* The certificate */}
      <div className="w-full max-w-5xl px-4">
        {data.locked ? (
          <div className="flex aspect-[1754/1240] w-full flex-col items-center justify-center gap-3 rounded-[20px] border border-ws-hairline bg-ws-surface p-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-[9px] bg-ws-chip">
              <LockIcon size={22} />
            </span>
            <p className="text-lg font-semibold text-ws-primary sm:text-xl">Waiting for your instructor&rsquo;s signature</p>
            <p className="max-w-md text-sm text-ws-muted">
              {data.instructorName || "Your instructor"} signs this certificate before you can view and download it. You
              completed {data.programName}; nothing else is needed from you.
            </p>
          </div>
        ) : (
          <div className="relative aspect-[1754/1240] w-full overflow-hidden rounded-[20px] border border-ws-hairline bg-ws-sunken shadow-sm">
            {!loaded && !failed && <Skeleton className="absolute inset-0 rounded-none" />}
            {failed ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                <p className="text-sm text-ws-muted">We couldn&rsquo;t load your certificate.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setFailed(false)
                    setLoaded(false)
                    setRetry((n) => n + 1)
                  }}
                >
                  Try again
                </Button>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- a private, per-learner PNG from our own route; next/image would cache it publicly
              <img
                key={previewSrc}
                ref={imgRef}
                src={previewSrc}
                alt={`${title}, awarded to ${data.studentName}`}
                className={`absolute inset-0 h-full w-full transition-opacity duration-300 motion-reduce:transition-none ${loaded ? "opacity-100" : "opacity-0"}`}
                onLoad={() => setLoaded(true)}
                onError={() => setFailed(true)}
              />
            )}
          </div>
        )}
      </div>

      {/* ID and verification */}
      <div className="mt-4 flex w-full max-w-5xl flex-col items-center gap-1 px-4 text-center text-[12px] text-ws-muted">
        <p className="tabular-nums">{`Certificate ID ${certificateId}`}</p>
        {verifyUrl && (
          <p className="flex flex-wrap items-center justify-center gap-x-2">
            <span>
              Anyone can check it at{" "}
              <a href={verifyUrl} className="break-all underline underline-offset-2 hover:text-ws-primary">
                {verifyLabel}
              </a>
            </span>
            <button
              type="button"
              onClick={copyVerifyLink}
              className="inline-flex items-center gap-1 font-medium text-ws-primary underline-offset-2 hover:underline"
            >
              {copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
              {copied ? "Copied" : "Copy link"}
            </button>
          </p>
        )}
      </div>

      {/* The holder's own signature: optional */}
      {!data.locked && (
        <div className="mt-6 w-full max-w-5xl px-4">
          <div className="rounded-[20px] border border-ws-hairline bg-ws-surface p-5 sm:p-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <div>
                <p className="text-sm font-semibold text-ws-primary">Your signature (optional)</p>
                <p className="mt-0.5 text-xs text-ws-muted">It prints above &ldquo;Holder&rdquo; on your certificate.</p>
              </div>

              {studentSig && !showCanvas ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-20 w-48 items-center justify-center overflow-hidden rounded-[9px] border border-ws-hairline bg-ws-sunken">
                    {/* eslint-disable-next-line @next/next/no-img-element -- the learner's uploaded signature */}
                    <img src={studentSig} alt="Your signature" className="h-full w-auto object-contain p-2" />
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 font-medium text-ws-success">
                      <CheckIcon size={12} />
                      On your certificate
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCanvas(true)}
                      className="text-ws-muted underline underline-offset-2 transition-colors hover:text-ws-primary"
                    >
                      Change signature
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full max-w-md">
                  <SignatureCanvas
                    currentSignatureUrl={studentSig}
                    onSave={(url) => {
                      setStudentSig(url)
                      setShowCanvas(false)
                      setLoaded(false)
                      setFailed(false)
                    }}
                    onCancel={studentSig ? () => setShowCanvas(false) : undefined}
                    compact
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
