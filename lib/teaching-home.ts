/**
 * Pure, client-safe helpers for the tutor home (/instructor): the week
 * agenda's days, money and time formats, and the "Add to calendar" file.
 * Date maths runs in the BROWSER's zone (lib/calendar-grid.ts), so call these
 * client-side only. No dependencies.
 */

import { addDays, dayKey, startOfDay } from "@/lib/calendar-grid"
import { HOST_EARLY_START_MS } from "@/lib/class-schedule"
import { cohortShortParts } from "@/lib/cohort"

/** A class has no stored length; the calendar file books this much. */
export const CLASS_ICS_MINUTES = 60

/** "$1,234.56" from integer cents. */
export function formatMinor(minor: number): string {
  return (minor / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })
}

/** "6:00 PM" in the browser's locale and zone. */
export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
}

/** "Mon 19 Oct" — the cohort's start as its home zone reads it. */
export function cohortStartLabel(iso: string): string {
  const { weekday, day, month } = cohortShortParts(iso)
  return `${weekday} ${day} ${month}`
}

/** The browser's zone, by IANA name and abbreviation ("Africa/Lagos", "WAT" or "GMT+1"). */
export function browserZone(at: Date): { name: string; short: string } {
  const name = Intl.DateTimeFormat().resolvedOptions().timeZone
  const short =
    new Intl.DateTimeFormat(undefined, { timeZoneName: "short" }).formatToParts(at).find((p) => p.type === "timeZoneName")
      ?.value ?? ""
  return { name, short }
}

/** "Monday 19 October · 6:00 PM" in the browser's locale and zone. */
export function classWhenLabel(iso: string): string {
  const at = new Date(iso)
  const date = at.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })
  return `${date} · ${timeLabel(iso)}`
}

/** "3d ago" · "5h ago" · "just now" — how long something has waited. */
export function waitedLabel(iso: string, now: number): string {
  const ms = Math.max(0, now - new Date(iso).getTime())
  const hours = Math.floor(ms / 3600_000)
  if (hours >= 48) return `${Math.floor(hours / 24)}d ago`
  if (hours >= 1) return `${hours}h ago`
  const minutes = Math.floor(ms / 60_000)
  return minutes >= 1 ? `${minutes}m ago` : "just now"
}

export type AgendaDay<T> = { key: string; date: Date; isToday: boolean; entries: T[] }

/** Seven local days from today, each with its entries in start order. Entries outside them are dropped. */
export function agendaDays<T extends { start: string }>(entries: T[], now: number): AgendaDay<T>[] {
  const today = startOfDay(new Date(now))
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i))
  const byKey = new Map(days.map((d) => [dayKey(d), [] as T[]]))
  for (const e of entries) byKey.get(dayKey(new Date(e.start)))?.push(e)
  return days.map((date, i) => {
    const key = dayKey(date)
    return { key, date, isToday: i === 0, entries: byKey.get(key) ?? [] }
  })
}

/* ── Add to calendar (.ics) ─────────────────────────────────────────────── */

/** RFC 5545 TEXT escaping. */
function icsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n")
}

/** "20261019T170000Z". */
function icsInstant(at: Date): string {
  return at.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
}

/** Lines longer than 75 octets continue on the next line after a space (RFC 5545 §3.1). */
function fold(line: string): string {
  const bytes = new TextEncoder()
  if (bytes.encode(line).length <= 75) return line
  const out: string[] = []
  let current = ""
  for (const ch of line) {
    if (bytes.encode(current + ch).length > (out.length ? 74 : 75)) {
      out.push(current)
      current = ch
    } else {
      current += ch
    }
  }
  out.push(current)
  return out.join("\r\n ")
}

/** A one-event calendar file for a scheduled class. */
export function classIcs(input: {
  id: string
  title: string
  courseTitle: string
  start: string
  /** Absolute link back to the class. */
  url: string
  now?: number
}): string {
  const start = new Date(input.start)
  const end = new Date(start.getTime() + CLASS_ICS_MINUTES * 60_000)
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WorldStreet Academy//Teaching//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:class-${input.id}@academy.worldstreetgold.com`,
    `DTSTAMP:${icsInstant(new Date(input.now ?? Date.now()))}`,
    `DTSTART:${icsInstant(start)}`,
    `DTEND:${icsInstant(end)}`,
    `SUMMARY:${icsText(input.title)}`,
    `DESCRIPTION:${icsText(`${input.courseTitle} — live class. Start it from ${input.url}`)}`,
    `URL:${input.url}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText(input.title)}`,
    // Reminds the host when the room opens to them.
    `TRIGGER:-PT${Math.round(HOST_EARLY_START_MS / 60_000)}M`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
  return lines.map(fold).join("\r\n") + "\r\n"
}

/** Saves `classIcs` as a file — no dependency, no server round trip. */
export function downloadClassIcs(input: Parameters<typeof classIcs>[0]): void {
  const blob = new Blob([classIcs(input)], { type: "text/calendar;charset=utf-8" })
  const href = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = href
  a.download = `${input.title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "class"}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(href), 1000)
}
