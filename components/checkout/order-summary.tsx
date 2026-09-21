"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { motion } from "motion/react"
import { BadgeCheckIcon, ChevronDownIcon, ReceiptTextIcon } from "lucide-react"
import type { ProgramDetail, PublicPackage } from "@/lib/actions/student"
import { SCHOOL_BY_SLUG } from "@/lib/schools"
import { cn } from "@/lib/utils"
import { SchoolIcon } from "@/components/shared/school-icon"
import { EASE_LUX } from "@/components/marketing/motion/ease"
import { useMotionOK } from "@/components/marketing/motion/bus"
import { LEVEL_LABEL, wholeUsd } from "@/components/checkout/order-lines"

/**
 * The order as checkout shows it: the program's art and name, and the chosen
 * package with a quiet "Change" back to the program page's chooser. Desktop
 * shows it as a card beside the payment; a phone folds it into a summary bar.
 */

/** The program art, or its school's mark on the raised step — never a grey box. */
export function ProgramThumb({ program, sizes, className }: { program: ProgramDetail; sizes: string; className?: string }) {
  const school = program.school ? SCHOOL_BY_SLUG[program.school] : null
  return (
    <span className={cn("relative block overflow-hidden bg-ws-raised", className)}>
      {program.thumbnailUrl ? (
        <Image src={program.thumbnailUrl} alt="" fill sizes={sizes} className="object-cover" priority />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-ws-muted">
          <SchoolIcon name={school?.icon ?? "graduation-cap"} size={28} aria-hidden />
        </span>
      )}
    </span>
  )
}

/** The chosen package as a compact line: label chip, name, tagline, price and a quiet "Change". */
export function PackageRow({
  pkg,
  line,
  changeHref,
  compact = false,
}: {
  pkg: PublicPackage
  line: { label: string | null; name: string }
  changeHref: string | null
  compact?: boolean
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="min-w-0 flex-1">
        {(line.label || pkg.highlight) && (
          <p className="flex flex-wrap items-center gap-2">
            {line.label && (
              <span className="rounded-full bg-ws-brand/[0.12] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ws-gold">
                {line.label}
              </span>
            )}
            {pkg.highlight && line.label && <span className="text-[12px] font-medium text-ws-muted">Most popular</span>}
          </p>
        )}
        <p className={cn("font-semibold text-ws-primary", compact ? "mt-1.5 text-[15px]" : "mt-2 text-[17px]")}>{line.name}</p>
        {pkg.tagline && (
          <p className={cn("mt-0.5 leading-snug text-ws-muted", compact ? "text-[13px]" : "text-[14px]")}>{pkg.tagline}</p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <span
          className={cn(
            "font-display font-light leading-none tracking-[-0.02em] tabular-nums text-ws-primary",
            compact ? "text-[22px]" : "text-[30px]"
          )}
        >
          {wholeUsd(pkg.price)}
        </span>
        {changeHref && (
          <Link
            href={changeHref}
            className="mt-2 rounded-full text-[13px] font-medium text-ws-muted underline-offset-4 transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
          >
            Change<span className="sr-only"> package</span>
          </Link>
        )}
      </div>
    </div>
  )
}

/** Desktop order card: the program's art, what it is, and the chosen package. */
export function OrderCard({
  program,
  pkg,
  line,
  changeHref,
  reservedSeat,
}: {
  program: ProgramDetail
  pkg: PublicPackage
  line: { label: string | null; name: string }
  changeHref: string | null
  reservedSeat: boolean
}) {
  const school = program.school ? SCHOOL_BY_SLUG[program.school] : null
  return (
    <section
      aria-label="Your order"
      className="overflow-hidden rounded-[20px] border border-ws-hairline bg-ws-surface dark:border-transparent"
    >
      <div className="flex items-center gap-5 p-5 sm:p-6">
        <ProgramThumb program={program} sizes="160px" className="aspect-[16/10] w-40 shrink-0 rounded-[14px]" />
        <div className="min-w-0 flex-1">
          {school && (
            <p className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-ws-muted">
              <SchoolIcon name={school.icon} size={13} aria-hidden />
              <span className="truncate">{school.short}</span>
            </p>
          )}
          <h2 className="mt-1.5 font-display text-[22px] font-semibold leading-tight tracking-[-0.015em] text-ws-primary">
            {program.title}
          </h2>
          <p className="mt-1 truncate text-[13.5px] text-ws-muted">
            {LEVEL_LABEL[program.level]} · by {program.instructorName}
          </p>
        </div>
      </div>
      <div className="border-t border-ws-hairline px-5 py-5 sm:px-6">
        <PackageRow pkg={pkg} line={line} changeHref={changeHref} />
        {reservedSeat && <ReservedSeatNote />}
      </div>
    </section>
  )
}

/**
 * Phone only: the order, folded into one bar under the header — "Show order
 * summary" and the total. Opens on its height, like the detail rows.
 */
export function MobileSummary({
  program,
  pkg,
  line,
  changeHref,
  reservedSeat,
}: {
  program: ProgramDetail
  pkg: PublicPackage
  line: { label: string | null; name: string }
  changeHref: string | null
  reservedSeat: boolean
}) {
  const ok = useMotionOK()
  const [open, setOpen] = React.useState(false)
  const school = program.school ? SCHOOL_BY_SLUG[program.school] : null
  return (
    <div className="border-b border-ws-hairline bg-ws-sunken lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="order-summary-panel"
        onClick={() => setOpen((v) => !v)}
        className="mx-auto flex w-full max-w-[1120px] items-center gap-3 px-4 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ws-brand/40 sm:px-6"
      >
        <ReceiptTextIcon size={17} className="shrink-0 text-ws-muted" aria-hidden />
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[14px] font-medium text-ws-primary">
          {open ? "Hide order summary" : "Show order summary"}
          <ChevronDownIcon
            size={16}
            aria-hidden
            className={cn(
              "shrink-0 text-ws-muted transition-transform duration-[var(--ws-motion-slow)] ease-[var(--ws-ease)] motion-reduce:transition-none",
              open && "rotate-180"
            )}
          />
        </span>
        <span className="shrink-0 font-display text-[19px] font-normal tabular-nums text-ws-primary">{wholeUsd(pkg.price)}</span>
      </button>
      <motion.div
        id="order-summary-panel"
        inert={!open}
        className="overflow-hidden"
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: ok ? 0.38 : 0, ease: EASE_LUX }}
      >
        <motion.div
          initial={false}
          animate={{ y: open ? 0 : -8 }}
          transition={{ duration: ok ? 0.42 : 0, ease: EASE_LUX }}
          className="mx-auto max-w-[1120px] px-4 pb-5 sm:px-6"
        >
          <div className="flex items-center gap-3.5">
            <ProgramThumb program={program} sizes="96px" className="aspect-[16/10] w-24 shrink-0 rounded-[12px]" />
            <div className="min-w-0 flex-1">
              {school && (
                <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-ws-muted">{school.short}</p>
              )}
              <p className="mt-0.5 font-display text-[17px] font-semibold leading-tight text-ws-primary">{program.title}</p>
              <p className="mt-0.5 truncate text-[12.5px] text-ws-muted">by {program.instructorName}</p>
            </div>
          </div>
          <div className="mt-4 rounded-[14px] bg-ws-surface p-4">
            <PackageRow pkg={pkg} line={line} changeHref={changeHref} compact />
            {reservedSeat && <ReservedSeatNote />}
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}

/** A pre-launch reservation on this program: paying turns it into the enrollment. */
export function ReservedSeatNote() {
  return (
    <p className="mt-4 flex items-center gap-2 text-[13px] text-ws-muted">
      <BadgeCheckIcon size={14} className="shrink-0" aria-hidden />
      You reserved a seat before launch — paying activates it.
    </p>
  )
}
