/*
 * `<input type="datetime-local">` speaks wall-clock time with no zone; the
 * server speaks ISO. Both conversions happen in the viewer's timezone. Used by
 * the course editor (launch date) and the class scheduler.
 */

/** ISO string → value for a datetime-local input, in the viewer's timezone. */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** datetime-local value → ISO string for the wire ("" stays ""). */
export function localInputToIso(local: string): string {
  if (!local) return ""
  const d = new Date(local)
  return Number.isNaN(d.getTime()) ? "" : d.toISOString()
}
