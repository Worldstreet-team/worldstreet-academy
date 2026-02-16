"use client"

import { useCallback } from "react"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  Download01Icon,
} from "@hugeicons/core-free-icons"
import Link from "next/link"
import type { CertificateData } from "@/lib/actions/certificates"

// ── Certificate visual component (used for preview) ──────────────────────────

function CertificatePreview({ data }: { data: CertificateData }) {
  const completedDate = new Date(data.completedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <div className="relative w-full aspect-[1.414/1] bg-white text-black overflow-hidden" id="certificate-preview">
      {/* Outer border pattern */}
      <div className="absolute inset-3 sm:inset-4 md:inset-6 border-2 border-neutral-800" />
      <div className="absolute inset-4 sm:inset-5 md:inset-7 border border-neutral-400" />

      {/* Corner ornaments */}
      <svg className="absolute top-5 left-5 sm:top-6 sm:left-6 md:top-8 md:left-8 w-8 h-8 sm:w-10 sm:h-10 md:w-14 md:h-14 text-neutral-800" viewBox="0 0 64 64" fill="none">
        <path d="M0 0 L32 0 L32 4 L4 4 L4 32 L0 32 Z" fill="currentColor" />
        <path d="M8 8 L24 8 L24 10 L10 10 L10 24 L8 24 Z" fill="currentColor" opacity="0.4" />
      </svg>
      <svg className="absolute top-5 right-5 sm:top-6 sm:right-6 md:top-8 md:right-8 w-8 h-8 sm:w-10 sm:h-10 md:w-14 md:h-14 text-neutral-800 rotate-90" viewBox="0 0 64 64" fill="none">
        <path d="M0 0 L32 0 L32 4 L4 4 L4 32 L0 32 Z" fill="currentColor" />
        <path d="M8 8 L24 8 L24 10 L10 10 L10 24 L8 24 Z" fill="currentColor" opacity="0.4" />
      </svg>
      <svg className="absolute bottom-5 left-5 sm:bottom-6 sm:left-6 md:bottom-8 md:left-8 w-8 h-8 sm:w-10 sm:h-10 md:w-14 md:h-14 text-neutral-800 -rotate-90" viewBox="0 0 64 64" fill="none">
        <path d="M0 0 L32 0 L32 4 L4 4 L4 32 L0 32 Z" fill="currentColor" />
        <path d="M8 8 L24 8 L24 10 L10 10 L10 24 L8 24 Z" fill="currentColor" opacity="0.4" />
      </svg>
      <svg className="absolute bottom-5 right-5 sm:bottom-6 sm:right-6 md:bottom-8 md:right-8 w-8 h-8 sm:w-10 sm:h-10 md:w-14 md:h-14 text-neutral-800 rotate-180" viewBox="0 0 64 64" fill="none">
        <path d="M0 0 L32 0 L32 4 L4 4 L4 32 L0 32 Z" fill="currentColor" />
        <path d="M8 8 L24 8 L24 10 L10 10 L10 24 L8 24 Z" fill="currentColor" opacity="0.4" />
      </svg>

      {/* Content */}
      <div className="relative h-full flex flex-col items-center justify-between px-6 py-10 sm:px-8 sm:py-12 md:px-16 md:py-16">
        {/* Header */}
        <div className="text-center space-y-1 sm:space-y-2">
          <p className="text-[10px] sm:text-xs md:text-sm tracking-[0.3em] sm:tracking-[0.4em] uppercase text-neutral-500 font-medium">
            WorldStreet Academy
          </p>
          <div className="flex items-center justify-center gap-2 sm:gap-3 md:gap-4">
            <div className="h-px w-8 sm:w-12 md:w-20 bg-neutral-300" />
            <svg className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-neutral-800" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
            <div className="h-px w-8 sm:w-12 md:w-20 bg-neutral-300" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center space-y-1.5 sm:space-y-2">
          <h1 className="text-lg sm:text-2xl md:text-4xl font-light tracking-widest uppercase text-neutral-800">
            Certificate
          </h1>
          <p className="text-[9px] sm:text-[10px] md:text-xs tracking-[0.25em] sm:tracking-[0.35em] uppercase text-neutral-500">
            of Completion
          </p>
        </div>

        {/* Presented to */}
        <div className="text-center space-y-1.5 sm:space-y-3">
          <p className="text-[9px] sm:text-[10px] md:text-xs tracking-[0.15em] sm:tracking-[0.2em] uppercase text-neutral-500">
            This is proudly presented to
          </p>
          <div className="relative">
            <p
              className="text-xl sm:text-3xl md:text-5xl text-neutral-900"
              style={{ fontFamily: "'Playfair Display', 'Georgia', serif", fontStyle: "italic" }}
            >
              {data.studentName}
            </p>
            <div className="mt-1.5 sm:mt-2 mx-auto w-32 sm:w-48 md:w-64 h-px bg-neutral-300" />
          </div>
        </div>

        {/* Course info */}
        <div className="text-center space-y-1 sm:space-y-2 max-w-xs sm:max-w-md md:max-w-lg">
          <p className="text-[9px] sm:text-[10px] md:text-xs text-neutral-500">
            For successfully completing the course
          </p>
          <p className="text-sm sm:text-base md:text-xl font-semibold text-neutral-800 leading-snug">
            {data.courseTitle}
          </p>
        </div>

        {/* Bottom section — date + instructor */}
        <div className="w-full flex items-end justify-between px-2 sm:px-4 md:px-8">
          {/* Date */}
          <div className="text-center">
            <div className="w-20 sm:w-28 md:w-36 h-px bg-neutral-300 mb-1 sm:mb-1.5" />
            <p className="text-[8px] sm:text-[9px] md:text-[10px] text-neutral-500 uppercase tracking-wider">
              Date
            </p>
            <p className="text-[9px] sm:text-[10px] md:text-xs text-neutral-700 font-medium mt-0.5">
              {completedDate}
            </p>
          </div>

          {/* Seal */}
          <div className="flex flex-col items-center">
            <svg className="w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 text-neutral-800" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="1" />
              <circle cx="32" cy="32" r="24" stroke="currentColor" strokeWidth="0.5" />
              <text x="32" y="29" textAnchor="middle" className="text-[5px] sm:text-[6px]" fill="currentColor" fontWeight="600" letterSpacing="1.5">WORLDSTREET</text>
              <text x="32" y="37" textAnchor="middle" className="text-[4px] sm:text-[5px]" fill="currentColor" letterSpacing="1">ACADEMY</text>
            </svg>
          </div>

          {/* Instructor */}
          <div className="text-center">
            <div className="w-20 sm:w-28 md:w-36 h-px bg-neutral-300 mb-1 sm:mb-1.5" />
            <p className="text-[8px] sm:text-[9px] md:text-[10px] text-neutral-500 uppercase tracking-wider">
              Instructor
            </p>
            <p className="text-[9px] sm:text-[10px] md:text-xs text-neutral-700 font-medium mt-0.5">
              {data.instructorName}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main certificate page client component ───────────────────────────────────

export function CertificateClient({ data }: { data: CertificateData }) {
  const downloadPDF = useCallback(async () => {
    const { jsPDF } = await import("jspdf")
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })

    const w = 297
    const h = 210

    // White background
    doc.setFillColor(255, 255, 255)
    doc.rect(0, 0, w, h, "F")

    // Outer border
    doc.setDrawColor(30, 30, 30)
    doc.setLineWidth(0.8)
    doc.rect(8, 8, w - 16, h - 16)

    // Inner border
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.3)
    doc.rect(10, 10, w - 20, h - 20)

    // Corner ornaments (L-shaped brackets)
    const corners = [
      { x: 12, y: 12, sx: 1, sy: 1 },
      { x: w - 12, y: 12, sx: -1, sy: 1 },
      { x: 12, y: h - 12, sx: 1, sy: -1 },
      { x: w - 12, y: h - 12, sx: -1, sy: -1 },
    ]
    doc.setDrawColor(30, 30, 30)
    doc.setLineWidth(0.6)
    corners.forEach(({ x, y, sx, sy }) => {
      doc.line(x, y, x + 16 * sx, y)
      doc.line(x, y, x, y + 16 * sy)
    })
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.3)
    corners.forEach(({ x, y, sx, sy }) => {
      const offset = 3 * sx
      const offsetY = 3 * sy
      doc.line(x + offset, y + offsetY, x + offset + 10 * sx, y + offsetY)
      doc.line(x + offset, y + offsetY, x + offset, y + offsetY + 10 * sy)
    })

    const cx = w / 2

    // Header — "WORLDSTREET ACADEMY"
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(140, 140, 140)
    doc.text("WORLDSTREET ACADEMY", cx, 30, { align: "center", charSpace: 3 })

    // Decorative star
    doc.setDrawColor(30, 30, 30)
    doc.setLineWidth(0.3)
    const starY = 36
    doc.line(cx - 25, starY, cx - 8, starY)
    doc.line(cx + 8, starY, cx + 25, starY)
    // Simple diamond shape as star
    doc.setFillColor(30, 30, 30)
    doc.triangle(cx, starY - 3, cx - 3, starY, cx + 3, starY, "F")
    doc.triangle(cx, starY + 3, cx - 3, starY, cx + 3, starY, "F")

    // Title — "CERTIFICATE"
    doc.setFont("helvetica", "normal")
    doc.setFontSize(30)
    doc.setTextColor(50, 50, 50)
    doc.text("CERTIFICATE", cx, 54, { align: "center", charSpace: 5 })

    // Subtitle — "OF COMPLETION"
    doc.setFontSize(8)
    doc.setTextColor(140, 140, 140)
    doc.text("OF COMPLETION", cx, 61, { align: "center", charSpace: 3 })

    // "This is proudly presented to"
    doc.setFontSize(7)
    doc.setTextColor(140, 140, 140)
    doc.text("THIS IS PROUDLY PRESENTED TO", cx, 76, { align: "center", charSpace: 1.5 })

    // Student name (calligraphic style — using Times Italic)
    doc.setFont("times", "bolditalic")
    doc.setFontSize(28)
    doc.setTextColor(20, 20, 20)
    doc.text(data.studentName, cx, 92, { align: "center" })

    // Line under name
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.3)
    doc.line(cx - 45, 96, cx + 45, 96)

    // "For successfully completing the course"
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.setTextColor(140, 140, 140)
    doc.text("For successfully completing the course", cx, 108, { align: "center" })

    // Course title
    doc.setFont("helvetica", "bold")
    doc.setFontSize(14)
    doc.setTextColor(40, 40, 40)

    // Handle long course titles by splitting
    const courseTitle = data.courseTitle
    if (courseTitle.length > 50) {
      const lines = doc.splitTextToSize(courseTitle, 180)
      doc.text(lines, cx, 118, { align: "center" })
    } else {
      doc.text(courseTitle, cx, 118, { align: "center" })
    }

    // Bottom section
    const botY = h - 38

    // Date (left)
    const dateFormatted = new Date(data.completedAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.3)
    doc.line(40, botY, 100, botY)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(6)
    doc.setTextColor(140, 140, 140)
    doc.text("DATE", 70, botY + 5, { align: "center" })
    doc.setFontSize(8)
    doc.setTextColor(60, 60, 60)
    doc.text(dateFormatted, 70, botY + 11, { align: "center" })

    // Seal (center)
    doc.setDrawColor(30, 30, 30)
    doc.setLineWidth(0.4)
    doc.circle(cx, botY + 2, 12)
    doc.setLineWidth(0.2)
    doc.circle(cx, botY + 2, 10)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(5)
    doc.setTextColor(30, 30, 30)
    doc.text("WORLDSTREET", cx, botY, { align: "center" })
    doc.setFontSize(4)
    doc.text("ACADEMY", cx, botY + 4, { align: "center" })

    // Instructor (right)
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.3)
    doc.line(w - 100, botY, w - 40, botY)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(6)
    doc.setTextColor(140, 140, 140)
    doc.text("INSTRUCTOR", w - 70, botY + 5, { align: "center" })
    doc.setFontSize(8)
    doc.setTextColor(60, 60, 60)
    doc.text(data.instructorName, w - 70, botY + 11, { align: "center" })

    // Certificate ID (bottom)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(5)
    doc.setTextColor(180, 180, 180)
    doc.text(`Certificate ID: WSA-${data.id.slice(-8).toUpperCase()}`, cx, h - 14, { align: "center" })

    doc.save(`WorldStreet-Academy-Certificate-${data.courseTitle.replace(/[^a-zA-Z0-9]/g, "-")}.pdf`)
  }, [data])

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
          className="gap-1.5"
        >
          <HugeiconsIcon icon={Download01Icon} size={16} />
          Download PDF
        </Button>
      </div>

      {/* Certificate */}
      <div className="w-full max-w-4xl px-4 pb-12">
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 shadow-xl overflow-hidden">
          <CertificatePreview data={data} />
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Certificate ID: WSA-{data.id.slice(-8).toUpperCase()}
        </p>
      </div>
    </div>
  )
}
