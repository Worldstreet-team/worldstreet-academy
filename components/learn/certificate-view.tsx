"use client"

import { useCallback, useRef, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  Download01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import Link from "next/link"
import type { CertificateData } from "@/lib/actions/certificates"
import { SignatureCanvas } from "@/components/shared/signature-canvas"

// ── Helper: fetch image as base64 data URL ───────────────────────────────────

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url)
    const blob = await resp.blob()
    return new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

// ── Corner Ornament SVG ──────────────────────────────────────────────────────

function CornerOrnament({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 80" fill="none">
      {/* Outer L bracket */}
      <path
        d="M0 0 L40 0 L40 3 L3 3 L3 40 L0 40 Z"
        fill="currentColor"
      />
      {/* Inner L bracket */}
      <path
        d="M6 6 L28 6 L28 8 L8 8 L8 28 L6 28 Z"
        fill="currentColor"
        opacity="0.35"
      />
      {/* Diamond accent */}
      <path
        d="M14 2 L16 0 L18 2 L16 4 Z"
        fill="currentColor"
        opacity="0.5"
      />
      <path
        d="M2 14 L4 12 L6 14 L4 16 Z"
        fill="currentColor"
        opacity="0.5"
      />
    </svg>
  )
}

// ── Certificate visual component (used for preview) ──────────────────────────

function CertificatePreview({
  data,
  studentSignature,
}: {
  data: CertificateData
  studentSignature: string | null
}) {
  const completedDate = new Date(data.completedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <div
      className="relative w-full aspect-[1.414/1] bg-white text-black overflow-hidden"
      id="certificate-preview"
    >
      {/* ── Decorative borders ─────────────────────────────────── */}
      {/* Outer thick border */}
      <div className="absolute inset-3 sm:inset-4 md:inset-6 border-2 border-neutral-800" />
      {/* Inner thin border */}
      <div className="absolute inset-4 sm:inset-5 md:inset-7 border border-neutral-300" />
      {/* Third decorative border */}
      <div className="absolute inset-5 sm:inset-6 md:inset-8 border border-neutral-200" />

      {/* ── Corner ornaments ───────────────────────────────────── */}
      <CornerOrnament className="absolute top-4 left-4 sm:top-5 sm:left-5 md:top-7 md:left-7 w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 text-neutral-800" />
      <CornerOrnament className="absolute top-4 right-4 sm:top-5 sm:right-5 md:top-7 md:right-7 w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 text-neutral-800 rotate-90" />
      <CornerOrnament className="absolute bottom-4 left-4 sm:bottom-5 sm:left-5 md:bottom-7 md:left-7 w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 text-neutral-800 -rotate-90" />
      <CornerOrnament className="absolute bottom-4 right-4 sm:bottom-5 sm:right-5 md:bottom-7 md:right-7 w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 text-neutral-800 rotate-180" />

      {/* ── Center watermark — WorldStreet1 monochrome ─────────── */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <Image
          src="/worldstreet-logo/WorldStreet1.png"
          alt=""
          width={320}
          height={320}
          className="w-40 h-40 sm:w-56 sm:h-56 md:w-72 md:h-72 object-contain opacity-[0.04] grayscale"
          aria-hidden="true"
        />
      </div>

      {/* ── Unsigned overlay (prevents screenshots) ────────────── */}
      {!data.instructorSignatureUrl && (
        <div className="absolute inset-0 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center pointer-events-none z-10">
          <div className="text-center space-y-2">
            <p className="text-lg sm:text-xl md:text-2xl font-semibold text-neutral-800 dark:text-neutral-200">
              Pending Instructor Signature
            </p>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
              This certificate will be available once your instructor signs it
            </p>
          </div>
        </div>
      )}

      {/* ── Content ────────────────────────────────────────────── */}
      <div className="relative h-full flex flex-col items-center justify-between px-8 py-10 sm:px-10 sm:py-12 md:px-20 md:py-14">
        {/* Header — Logo + Institution */}
        <div className="flex flex-col items-center gap-2 sm:gap-3">
          <Image
            src="/worldstreet-logo/WorldStreet3x.png"
            alt="WorldStreet Academy"
            width={48}
            height={48}
            className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 object-contain"
          />
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
            <div className="h-px w-8 sm:w-12 md:w-20 bg-neutral-300" />
            <p className="text-[9px] sm:text-[10px] md:text-xs tracking-[0.35em] uppercase text-neutral-400 font-medium">
              WorldStreet Academy
            </p>
            <div className="h-px w-8 sm:w-12 md:w-20 bg-neutral-300" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center space-y-1 sm:space-y-1.5">
          <h1 className="text-xl sm:text-3xl md:text-[42px] font-extralight tracking-[0.2em] sm:tracking-[0.25em] uppercase text-neutral-800 leading-none">
            Certificate
          </h1>
          <p className="text-[8px] sm:text-[9px] md:text-[11px] tracking-[0.3em] uppercase text-neutral-400 font-light">
            of Completion
          </p>
        </div>

        {/* Presented to */}
        <div className="text-center space-y-2 sm:space-y-3">
          <p className="text-[8px] sm:text-[9px] md:text-[10px] tracking-[0.2em] uppercase text-neutral-400">
            This is proudly presented to
          </p>
          <div className="relative">
            <p className="text-2xl sm:text-4xl md:text-[48px] text-neutral-900 leading-tight font-cursive">
              {data.studentName}
            </p>
            <div className="mt-2 sm:mt-3 mx-auto w-28 sm:w-40 md:w-56 h-px bg-neutral-200" />
          </div>
        </div>

        {/* Course info */}
        <div className="text-center max-w-[70%]">
          <p className="text-[8px] sm:text-[9px] md:text-[10px] text-neutral-400 mb-1.5 sm:mb-2">
            for successfully completing the course
          </p>
          <p className="text-xs sm:text-sm md:text-lg font-semibold text-neutral-800 leading-snug">
            {data.courseTitle}
          </p>
        </div>

        {/* Bottom — Signatures + Seal */}
        <div className="w-full grid grid-cols-3 items-end gap-4 px-0 sm:px-2 md:px-6">
          {/* Student signature + Date */}
          <div className="flex flex-col items-center gap-1">
            {studentSignature && (
              <img
                src={studentSignature}
                alt="Student signature"
                className="h-6 sm:h-8 md:h-10 w-auto object-contain mb-0.5"
              />
            )}
            <div className="w-full max-w-[120px] sm:max-w-[140px] md:max-w-[160px] h-px bg-neutral-300" />
            <p className="text-[7px] sm:text-[8px] md:text-[9px] text-neutral-400 uppercase tracking-widest mt-0.5">
              Student
            </p>
            <p className="text-[8px] sm:text-[9px] md:text-[10px] text-neutral-600 font-medium">
              {completedDate}
            </p>
          </div>

          {/* Center seal — Logo */}
          <div className="flex flex-col items-center">
            <Image
              src="/worldstreet-logo/WorldStreet3x.png"
              alt="WorldStreet Academy"
              width={64}
              height={64}
              className="w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 object-contain"
            />
            <p className="text-[6px] sm:text-[7px] md:text-[8px] text-neutral-300 tracking-widest uppercase mt-1">
              Verified
            </p>
          </div>

          {/* Instructor signature */}
          <div className="flex flex-col items-center gap-1">
            {data.instructorSignatureUrl && (
              <img
                src={data.instructorSignatureUrl}
                alt="Instructor signature"
                className="h-6 sm:h-8 md:h-10 w-auto object-contain mb-0.5"
              />
            )}
            <div className="w-full max-w-[120px] sm:max-w-[140px] md:max-w-[160px] h-px bg-neutral-300" />
            <p className="text-[7px] sm:text-[8px] md:text-[9px] text-neutral-400 uppercase tracking-widest mt-0.5">
              Instructor
            </p>
            <p className="text-[8px] sm:text-[9px] md:text-[10px] text-neutral-600 font-medium">
              {data.instructorName}
            </p>
          </div>
        </div>

        {/* Certificate ID */}
        <p className="absolute bottom-3 sm:bottom-4 md:bottom-5 left-0 right-0 text-center text-[6px] sm:text-[7px] md:text-[8px] text-neutral-300 tracking-wider">
          WSA-{data.id.slice(-8).toUpperCase()}
        </p>
      </div>
    </div>
  )
}

// ── Main certificate page client component ───────────────────────────────────

export function CertificateClient({ data }: { data: CertificateData }) {
  const [studentSig, setStudentSig] = useState<string | null>(
    data.studentSignatureUrl
  )
  const [isSigned, setIsSigned] = useState(!!data.studentSignatureUrl)
  const [showCanvas, setShowCanvas] = useState(false)

  const downloadPDF = useCallback(async () => {
    const { jsPDF } = await import("jspdf")
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    })

    const w = 297
    const h = 210
    const cx = w / 2

    // ── Load images in parallel ──────────────────────────────────
    const [logoDataUrl, watermarkDataUrl, instructorSigDataUrl, studentSigDataUrl] =
      await Promise.all([
        fetchAsDataUrl("/worldstreet-logo/WorldStreet3x.png"),
        fetchAsDataUrl("/worldstreet-logo/WorldStreet1.png"),
        data.instructorSignatureUrl
          ? fetchAsDataUrl(data.instructorSignatureUrl)
          : null,
        studentSig ? fetchAsDataUrl(studentSig) : null,
      ])

    // ── White background ─────────────────────────────────────────
    doc.setFillColor(255, 255, 255)
    doc.rect(0, 0, w, h, "F")

    // ── Decorative borders ───────────────────────────────────────
    // Outer thick border
    doc.setDrawColor(30, 30, 30)
    doc.setLineWidth(0.8)
    doc.rect(8, 8, w - 16, h - 16)

    // Inner border
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.3)
    doc.rect(10, 10, w - 20, h - 20)

    // Third border
    doc.setDrawColor(210, 210, 210)
    doc.setLineWidth(0.2)
    doc.rect(12, 12, w - 24, h - 24)

    // ── Corner ornaments (L-shaped brackets) ─────────────────────
    const corners = [
      { x: 11, y: 11, sx: 1, sy: 1 },
      { x: w - 11, y: 11, sx: -1, sy: 1 },
      { x: 11, y: h - 11, sx: 1, sy: -1 },
      { x: w - 11, y: h - 11, sx: -1, sy: -1 },
    ]
    doc.setDrawColor(30, 30, 30)
    doc.setLineWidth(0.6)
    corners.forEach(({ x, y, sx, sy }) => {
      doc.line(x, y, x + 18 * sx, y)
      doc.line(x, y, x, y + 18 * sy)
    })
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.25)
    corners.forEach(({ x, y, sx, sy }) => {
      const ox = 3 * sx
      const oy = 3 * sy
      doc.line(x + ox, y + oy, x + ox + 10 * sx, y + oy)
      doc.line(x + ox, y + oy, x + ox, y + oy + 10 * sy)
    })
    // Diamond accents at corners
    doc.setFillColor(30, 30, 30)
    corners.forEach(({ x, y, sx, sy }) => {
      const dx = x + 16 * sx
      const dy = y + 2 * sy
      doc.triangle(dx, dy - 1.2, dx - 1.2 * sx, dy, dx, dy + 1.2, "F")
      doc.triangle(dx, dy - 1.2, dx + 1.2 * sx, dy, dx, dy + 1.2, "F")
    })

    // ── Center watermark — WorldStreet1 monochrome ───────────────
    if (watermarkDataUrl) {
      doc.saveGraphicsState()
      const gState = doc.GState({ opacity: 0.04 })
      doc.setGState(gState)
      doc.addImage(watermarkDataUrl, "PNG", cx - 40, h / 2 - 40, 80, 80)
      doc.restoreGraphicsState()
    }

    // ── Logo (top center) — WorldStreet3x ────────────────────────
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, "PNG", cx - 7, 18, 14, 14)
    }

    // ── Institution name with flanking lines ─────────────────────
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.2)
    doc.line(cx - 38, 38, cx - 18, 38)
    doc.line(cx + 18, 38, cx + 38, 38)

    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.setTextColor(160, 160, 160)
    doc.text("WORLDSTREET ACADEMY", cx, 39, { align: "center" })

    // ── "Certificate" title ──────────────────────────────────────
    doc.setFont("helvetica", "normal")
    doc.setFontSize(32)
    doc.setTextColor(50, 50, 50)
    doc.text("CERTIFICATE", cx, 56, { align: "center" })

    // ── "of Completion" subtitle ─────────────────────────────────
    doc.setFontSize(7)
    doc.setTextColor(160, 160, 160)
    doc.text("OF COMPLETION", cx, 63, { align: "center" })

    // ── "This is proudly presented to" ───────────────────────────
    doc.setFontSize(6.5)
    doc.setTextColor(160, 160, 160)
    doc.text("THIS IS PROUDLY PRESENTED TO", cx, 78, { align: "center" })

    // ── Student name (cursive) ───────────────────────────────────
    doc.setFont("times", "bolditalic")
    doc.setFontSize(26)
    doc.setTextColor(25, 25, 25)
    doc.text(data.studentName, cx, 93, { align: "center" })

    // Line under name
    doc.setDrawColor(210, 210, 210)
    doc.setLineWidth(0.25)
    doc.line(cx - 40, 97, cx + 40, 97)

    // ── "for successfully completing the course" ─────────────────
    doc.setFont("helvetica", "normal")
    doc.setFontSize(6.5)
    doc.setTextColor(160, 160, 160)
    doc.text("FOR SUCCESSFULLY COMPLETING THE COURSE", cx, 108, {
      align: "center",
    })

    // ── Course title ─────────────────────────────────────────────
    doc.setFont("helvetica", "bold")
    doc.setFontSize(13)
    doc.setTextColor(50, 50, 50)
    const courseTitle = data.courseTitle
    if (courseTitle.length > 55) {
      const lines = doc.splitTextToSize(courseTitle, 170)
      doc.text(lines, cx, 118, { align: "center" })
    } else {
      doc.text(courseTitle, cx, 118, { align: "center" })
    }

    // ── Bottom section: 3-column layout ──────────────────────────
    const botY = h - 40
    const colLeft = 65
    const colRight = w - 65

    // ── Left column: Student signature + Date ────────────────────
    if (studentSigDataUrl) {
      doc.addImage(studentSigDataUrl, "PNG", colLeft - 18, botY - 14, 36, 12)
    }
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.25)
    doc.line(colLeft - 22, botY, colLeft + 22, botY)

    doc.setFont("helvetica", "normal")
    doc.setFontSize(5.5)
    doc.setTextColor(160, 160, 160)
    doc.text("STUDENT", colLeft, botY + 5, { align: "center" })

    const dateFormatted = new Date(data.completedAt).toLocaleDateString(
      "en-US",
      { year: "numeric", month: "long", day: "numeric" }
    )
    doc.setFontSize(7)
    doc.setTextColor(80, 80, 80)
    doc.text(dateFormatted, colLeft, botY + 11, { align: "center" })

    // ── Center: Seal / Logo — WorldStreet3x ──────────────────────
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, "PNG", cx - 10, botY - 12, 20, 20)
    }
    doc.setFont("helvetica", "normal")
    doc.setFontSize(5)
    doc.setTextColor(190, 190, 190)
    doc.text("VERIFIED", cx, botY + 13, { align: "center" })

    // ── Right column: Instructor signature + Name ────────────────
    if (instructorSigDataUrl) {
      doc.addImage(
        instructorSigDataUrl,
        "PNG",
        colRight - 18,
        botY - 14,
        36,
        12
      )
    }
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.25)
    doc.line(colRight - 22, botY, colRight + 22, botY)

    doc.setFont("helvetica", "normal")
    doc.setFontSize(5.5)
    doc.setTextColor(160, 160, 160)
    doc.text("INSTRUCTOR", colRight, botY + 5, { align: "center" })

    doc.setFontSize(7)
    doc.setTextColor(80, 80, 80)
    doc.text(data.instructorName, colRight, botY + 11, { align: "center" })

    // ── Certificate ID ───────────────────────────────────────────
    doc.setFont("helvetica", "normal")
    doc.setFontSize(5)
    doc.setTextColor(200, 200, 200)
    doc.text(`WSA-${data.id.slice(-8).toUpperCase()}`, cx, h - 12, {
      align: "center",
    })

    doc.save(
      `WorldStreet-Certificate-${data.courseTitle.replace(/[^a-zA-Z0-9]/g, "-")}.pdf`
    )
  }, [data, studentSig])

  return (
    <div className="min-h-screen flex flex-col items-center bg-neutral-50 dark:bg-neutral-950">
      {/* Top bar */}
      <div className="w-full max-w-5xl px-4 py-4 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          render={<Link href="/dashboard/certificates" />}
          className="gap-1.5"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
          My Certificates
        </Button>

        <Button
          size="sm"
          onClick={downloadPDF}
          disabled={!data.instructorSignatureUrl}
          className="gap-1.5"
        >
          <HugeiconsIcon icon={Download01Icon} size={16} />
          {data.instructorSignatureUrl ? "Download PDF" : "Awaiting Signature"}
        </Button>
      </div>

      {/* Certificate */}
      <div className="w-full max-w-4xl px-4 pb-6">
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden">
          <CertificatePreview data={data} studentSignature={studentSig} />
        </div>
      </div>

      {/* Signature section */}
      <div className="w-full max-w-4xl px-4 pb-12">
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
          <div className="flex flex-col items-center gap-6">
            {/* Student signature area */}
            <div className="flex flex-col items-center gap-3 w-full">
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                Your Signature
              </p>

              {studentSig && !showCanvas ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-48 h-20 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 flex items-center justify-center overflow-hidden">
                    <img
                      src={studentSig}
                      alt="Your signature"
                      className="h-full w-auto object-contain p-2"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-emerald-600">
                      <HugeiconsIcon icon={Tick02Icon} size={12} />
                      <span className="text-[10px] font-medium">Signed</span>
                    </div>
                    <button
                      onClick={() => setShowCanvas(true)}
                      className="text-[10px] text-neutral-500 hover:text-primary transition-colors underline underline-offset-2"
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
                      setIsSigned(true)
                      setShowCanvas(false)
                    }}
                    onCancel={
                      studentSig ? () => setShowCanvas(false) : undefined
                    }
                    compact
                  />
                </div>
              )}
            </div>

            {/* Status message for unsigned certificates */}
            {!data.instructorSignatureUrl && (
              <div className="w-full text-center py-2">
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  ⏳ Your instructor needs to sign this certificate before you can download it
                </p>
              </div>
            )}
          </div>

          {isSigned && (
            <p className="text-center text-xs text-emerald-600 mt-4 flex items-center justify-center gap-1">
              <HugeiconsIcon icon={Tick02Icon} size={14} />
              Your signature has been added to the certificate
            </p>
          )}
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-4">
          Certificate ID: WSA-{data.id.slice(-8).toUpperCase()}
        </p>
      </div>
    </div>
  )
}
