import "server-only"

/**
 * Minimal iCalendar (.ics) generator — enough for a single-event interview
 * invite attachment. No external deps; RFC 5545 line folding is skipped
 * because our fields stay short.
 */

function icsDate(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")
}

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n")
}

export function buildInterviewIcs(input: {
  uid: string
  title: string
  description: string
  startsAt: Date
  durationMinutes?: number
  url: string
  organizerName?: string
}): string {
  const start = icsDate(input.startsAt)
  const end = icsDate(new Date(input.startsAt.getTime() + (input.durationMinutes ?? 30) * 60_000))
  const now = icsDate(new Date())

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WorldStreet Academy//Interview//EN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${input.uid}@academy.worldstreetgold.com`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeText(input.title)}`,
    `DESCRIPTION:${escapeText(`${input.description}\nJoin: ${input.url}`)}`,
    `URL:${input.url}`,
    ...(input.organizerName ? [`ORGANIZER;CN=${escapeText(input.organizerName)}:MAILTO:noreply@worldstreet.academy`] : []),
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Interview reminder",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n")
}
