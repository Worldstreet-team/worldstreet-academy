/**
 * Number formatting shared by the program page's server and client pieces.
 * Pure and client-safe. Every figure here is printed tabular by the caller.
 */

/** "2h 41m", "45m", "3h" — a total length. Empty for zero or less. */
export function formatLength(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return ""
  const minutes = Math.max(1, Math.round(totalSeconds / 60))
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

/** "16:40", "1:02:05" — one video's running time, as a player shows it. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, "0")
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`
}

/** "1 lesson", "8 lessons" — with the number formatted for thousands. */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? one : many}`
}

export function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}
