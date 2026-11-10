import "server-only"

/**
 * Minimal iCalendar (.ics) generator — enough for a single-event interview
 * invite attachment. No external deps. Lines are folded at 75 octets (RFC
 * 5545 §3.1): an office address or a description can run long, and strict
 * calendars reject longer lines.
 */

/** One content line, folded: at most 75 octets per line, continuations start with a space, never inside a character. */
function fold(line: string): string {
  const parts: string[] = []
  let current = ""
  let octets = 0
  for (const ch of line) {
    const size = Buffer.byteLength(ch, "utf8")
    // The first line holds 75 octets; a continuation's leading space takes one of its 75.
    if (octets + size > (parts.length === 0 ? 75 : 74)) {
      parts.push(current)
      current = ""
      octets = 0
    }
    current += ch
    octets += size
  }
  parts.push(current)
  return parts.join("\r\n ")
}

function icsDate(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")
}

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n")
}

export function buildInterviewIcs(input: {
  uid: string
  title: string
  description: string
  startsAt: Date
  durationMinutes?: number
  url: string
  organizerName?: string
  /** An in-person interview's address; `url` then points to the status page, not a room. */
  location?: string
}): string {
  const start = icsDate(input.startsAt)
  const end = icsDate(new Date(input.startsAt.getTime() + (input.durationMinutes ?? 30) * 60_000))
  const now = icsDate(new Date())

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WorldStreet Mastery Academy//Interview//EN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${input.uid}@academy.worldstreetgold.com`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeText(input.title)}`,
    `DESCRIPTION:${escapeText(
      input.location
        ? `${input.description}\nWhere: ${input.location}\nDetails: ${input.url}`
        : `${input.description}\nJoin: ${input.url}`
    )}`,
    ...(input.location ? [`LOCATION:${escapeText(input.location)}`] : []),
    `URL:${input.url}`,
    ...(input.organizerName ? [`ORGANIZER;CN=${escapeText(input.organizerName)}:MAILTO:noreply@worldstreet.academy`] : []),
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Interview reminder",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .map(fold)
    .join("\r\n")
}
