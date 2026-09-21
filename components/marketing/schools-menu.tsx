"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRightIcon, ChevronDownIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SchoolIcon } from "@/components/shared/school-icon"
import { SCHOOLS, type School, type SchoolSlug } from "@/lib/schools"
import { schoolCover } from "@/lib/school-art"
import { cn } from "@/lib/utils"

/** Program counts per school; null when the catalogue could not be read. */
export type SchoolCounts = Record<SchoolSlug, number> | null

function programCountLabel(count: number): string {
  if (count === 0) return "Coming soon"
  return count === 1 ? "1 program" : `${count} programs`
}

/**
 * "Explore schools" — the marketplace header's catalogue menu. A Base UI
 * popover (click to open; Esc, outside click and a chosen link close it)
 * holding the eight schools in two columns of four, in school order, with
 * "All schools" / "All programs" at its foot. No gold in here: the bar's
 * one gold button stays the only primary action.
 */
export function SchoolsMenu({ counts, className }: { counts: SchoolCounts; className?: string }) {
  const [open, setOpen] = React.useState(false)
  const close = () => setOpen(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "group inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium text-ws-primary outline-none transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-chip focus-visible:ring-2 focus-visible:ring-ws-primary/25 data-[popup-open]:bg-ws-chip",
          className
        )}
      >
        <span>
          Explore<span className="hidden lg:inline"> schools</span>
        </span>
        <ChevronDownIcon
          aria-hidden
          size={16}
          className="text-ws-muted transition-transform duration-[var(--ws-motion-base)] ease-[var(--ws-ease)] group-data-[popup-open]:rotate-180 motion-reduce:transition-none"
        />
      </PopoverTrigger>
      {/* sideOffset 20: the trigger's foot sits 12px above the bar's hairline,
          so the panel hangs 8px below the bar. */}
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={20}
        aria-label="Explore schools"
        className="w-[min(44rem,calc(100vw-3rem))] rounded-[20px] border-ws-hairline bg-ws-surface p-2 text-ws-primary shadow-xl shadow-black/20 duration-[var(--ws-motion-base)] motion-reduce:animate-none dark:shadow-black/50"
      >
        <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ws-subtle">
          Schools
        </p>
        <ul className="grid grid-flow-col grid-cols-2 grid-rows-4 gap-x-1 gap-y-0.5">
          {SCHOOLS.map((school) => (
            <li key={school.slug}>
              <SchoolRow school={school} count={counts ? counts[school.slug] : null} onNavigate={close} />
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-center gap-1 border-t border-ws-hairline px-1 pt-2">
          <FooterLink href="/schools" onNavigate={close}>
            All schools
          </FooterLink>
          <FooterLink href="/programs" onNavigate={close}>
            All programs
          </FooterLink>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/**
 * One school: cover thumb (or the school's glyph), short name, program count.
 * Shared with the mobile sheet, which passes `compact` for a denser row.
 */
export function SchoolRow({
  school,
  count,
  onNavigate,
  compact = false,
}: {
  school: School
  count: number | null
  onNavigate?: () => void
  compact?: boolean
}) {
  const cover = schoolCover(school.slug)
  return (
    <Link
      href={`/schools/${school.slug}`}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-[12px] outline-none transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised focus-visible:bg-ws-raised focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ws-primary/25",
        compact ? "min-h-12 px-3 py-1.5" : "p-2.5"
      )}
    >
      <span
        className={cn(
          "relative shrink-0 overflow-hidden rounded-[9px] bg-ws-sunken",
          compact ? "h-7 w-11" : "h-[34px] w-[52px]"
        )}
      >
        {cover ? (
          <Image src={cover} alt="" fill sizes="52px" className="object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center text-ws-muted">
            <SchoolIcon name={school.icon} size={16} aria-hidden />
          </span>
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-medium leading-snug text-ws-primary">{school.short}</span>
        {count !== null && (
          <span className="mt-0.5 block text-[12px] leading-4 tabular-nums text-ws-subtle">
            {programCountLabel(count)}
          </span>
        )}
      </span>
    </Link>
  )
}

function FooterLink({
  href,
  onNavigate,
  children,
}: {
  href: string
  onNavigate: () => void
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="group/foot inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-ws-muted outline-none transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised hover:text-ws-primary focus-visible:bg-ws-raised focus-visible:text-ws-primary"
    >
      {children}
      <ArrowRightIcon
        aria-hidden
        size={14}
        className="transition-transform duration-[var(--ws-motion-fast)] group-hover/foot:translate-x-0.5 motion-reduce:transition-none"
      />
    </Link>
  )
}
