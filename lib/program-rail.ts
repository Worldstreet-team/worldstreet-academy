/**
 * What the student program page may print about price and size. One rule
 * each: an enrolled learner is never quoted a price; a ladder is quoted
 * "From"; a zero is not a fact worth showing.
 */
export type ProgramRail = {
  /** The large figure: a price, "Free", or "Enrolled". */
  headline: string
  /** The chip beside it. */
  note: string
  /** Button copy for a buyer; null when enrolled (the page renders Continue). */
  buyLabel: string | null
}

export function programRail(input: {
  isEnrolled: boolean
  /** Enrollment.packageName of the access-granting enrollment, else null. */
  packageName: string | null
  pricing: "free" | "paid"
  /** Whole USD; for a ladder, the cheapest enabled tier. */
  price: number | null
  /** Enabled tiers; 0 or 1 = a single price. */
  tierCount: number
}): ProgramRail {
  if (input.isEnrolled) return { headline: "Enrolled", note: input.packageName ?? "Full access", buyLabel: null }
  if (input.pricing === "free" || !input.price) return { headline: "Free", note: "Full access", buyLabel: "Enrol for free" }
  const usd = `$${input.price.toLocaleString("en-US")}`
  if (input.tierCount > 1) {
    return { headline: `From ${usd}`, note: `${input.tierCount} packages`, buyLabel: "Choose your package" }
  }
  return { headline: usd, note: "One-time purchase", buyLabel: "Enrol now" }
}

function minutesLabel(total: number): string {
  const h = Math.floor(total / 60)
  const m = Math.round(total % 60)
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

/**
 * The page's figures, from the real lesson rows first and the stored counters
 * second. Anything that would read 0 is left out.
 */
export function programStats(course: {
  totalLessons: number
  /** Minutes. */
  totalDuration: number
  enrolledCount: number
  lessons: ReadonlyArray<{ duration: number | null }>
}): { label: string; value: string }[] {
  const lessons = course.lessons.length || course.totalLessons
  const minutes = course.totalDuration || course.lessons.reduce((sum, l) => sum + (l.duration ?? 0), 0)
  const out: { label: string; value: string }[] = []
  if (lessons > 0) out.push({ label: "Lessons", value: String(lessons) })
  if (minutes > 0) out.push({ label: "Duration", value: minutesLabel(minutes) })
  if (course.enrolledCount > 0) out.push({ label: "Enrolled", value: course.enrolledCount.toLocaleString("en-US") })
  return out
}
