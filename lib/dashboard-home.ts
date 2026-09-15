import type { MyAssessment } from "@/lib/actions/exams"
import type { StudentEnrollment } from "@/lib/actions/student"
import type { IPackageEntitlements } from "@/lib/db/models"

/*
 * Pure selectors over the student's enrollments (`fetchMyEnrollments`). The
 * dashboard, My programs and the help page share them, and every "is this
 * true for this student?" decision lives here so it can be asserted without a
 * browser. No React, no server imports — `import type` only.
 */

/** The statuses that open the player — the same two `lib/course-access.ts` counts. */
export function grantsAccess(enrollment: Pick<StudentEnrollment, "status">): boolean {
  return enrollment.status === "active" || enrollment.status === "completed"
}

/** Access-granting rows open the player where the student left off; every other row opens the course page. */
export function enrollmentHref(enrollment: StudentEnrollment): string {
  return grantsAccess(enrollment)
    ? `/dashboard/courses/${enrollment.courseId}/learn/${enrollment.resumeLessonId ?? enrollment.firstLessonId ?? "first"}`
    : `/dashboard/courses/${enrollment.courseId}`
}

/** A reservation on a course whose launch is still ahead — the card's "Not live yet" face. */
export function isComingSoon(enrollment: StudentEnrollment, now: number): boolean {
  return (
    enrollment.status === "pre_enrolled" &&
    !!enrollment.courseAvailableAt &&
    new Date(enrollment.courseAvailableAt).getTime() > now
  )
}

/**
 * A reservation on a course that is already open — launched, or never
 * scheduled. It still opens nothing: the course page sends it through
 * checkout, which activates the seat.
 */
export function isSeatReady(enrollment: StudentEnrollment, now: number): boolean {
  return enrollment.status === "pre_enrolled" && !isComingSoon(enrollment, now)
}

/**
 * Rows that hold a seat: access-granting (active, completed) or reserved
 * (pre_enrolled). Refunded, expired, suspended and cancelled rows are kept for
 * history, not enrollments the student has.
 */
export function holdsSeat(enrollment: Pick<StudentEnrollment, "status">): boolean {
  return grantsAccess(enrollment) || enrollment.status === "pre_enrolled"
}

const STATUS_CHIP: Record<string, string> = {
  pre_enrolled: "Seat reserved",
  expired: "Access expired",
  refunded: "Refunded",
  suspended: "Suspended",
  cancelled: "Cancelled",
}

/**
 * Cover chip for rows that don't open the player. `active` needs none,
 * `completed` already shows the card's own Completed chip, and a reservation
 * before launch shows "Not live yet" instead.
 */
export function enrollmentStatusLabel(enrollment: StudentEnrollment, now: number): string | null {
  if (grantsAccess(enrollment) || isComingSoon(enrollment, now)) return null
  return STATUS_CHIP[enrollment.status] ?? null
}

/**
 * Newest first by `lastAccessedAt` — the ordering the sidebar's "Continue
 * learning" row uses. Never-opened rows serialize as "now", so a fresh purchase leads.
 */
function byRecentAccess(a: StudentEnrollment, b: StudentEnrollment): number {
  return new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime()
}

/** Continue learning → the most recently accessed active or completed enrollment. */
export function pickResume(enrollments: StudentEnrollment[]): StudentEnrollment | null {
  return [...enrollments].filter(grantsAccess).sort(byRecentAccess)[0] ?? null
}

/** Current course → the most recently accessed active enrollment. */
export function pickCurrent(enrollments: StudentEnrollment[]): StudentEnrollment | null {
  return [...enrollments].filter((e) => e.status === "active").sort(byRecentAccess)[0] ?? null
}

/** "Priority support" — only a package actually bought with it, on an enrollment that still grants access. */
export function hasPrioritySupport(enrollments: StudentEnrollment[]): boolean {
  return enrollments.some((e) => grantsAccess(e) && e.explicitPackage && e.entitlements.prioritySupport)
}

/** "Your mentor" — an Executive package with mentorship. Single "Full program" tiers also carry mentorship and never qualify. */
export function isMentorEnrollment(enrollment: StudentEnrollment): boolean {
  return (
    grantsAccess(enrollment) &&
    enrollment.explicitPackage &&
    enrollment.packageKey === "executive" &&
    enrollment.entitlements.mentorship
  )
}

export type InstructorRow = {
  instructorId: string
  name: string
  avatarUrl: string | null
  headline: string | null
  /** Some access-granting enrollment with this instructor includes Q&A — the getOrCreateConversation gate. */
  canMessage: boolean
  isMentor: boolean
}

/** One row per distinct instructor across the student's access-granting enrollments. */
export function instructorRows(enrollments: StudentEnrollment[]): InstructorRow[] {
  const rows = new Map<string, InstructorRow>()
  for (const e of enrollments) {
    if (!grantsAccess(e)) continue
    const row = rows.get(e.instructorId) ?? {
      instructorId: e.instructorId,
      name: e.instructorName,
      avatarUrl: e.instructorAvatarUrl,
      headline: e.instructorHeadline,
      canMessage: false,
      isMentor: false,
    }
    row.canMessage = row.canMessage || e.entitlements.instructorQa
    row.isMentor = row.isMentor || isMentorEnrollment(e)
    rows.set(e.instructorId, row)
  }
  return [...rows.values()]
}

/** Whether any access-granting enrollment's package includes `flag` — tiles that can't be backed stay hidden. */
export function includesAny(enrollments: StudentEnrollment[], flag: keyof IPackageEntitlements): boolean {
  return enrollments.some((e) => grantsAccess(e) && e.entitlements[flag])
}

/** The codebase's date + time format. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
}

/* ── Student home ─────────────────────────────────────────────────────────
   The dashboard's hero, stat strip, tiles and greeting line. Every figure
   they show is derived here from real rows; nothing is estimated. */

/**
 * Not completed yet — what "In progress" counts and lists on the home, My
 * programs and the sidebar. A just-bought program at 0% belongs here, and so
 * does one at 100% still waiting on its final exam or on Finish.
 */
export function isInProgress(enrollment: Pick<StudentEnrollment, "status">): boolean {
  return enrollment.status === "active"
}

/**
 * Completed — the status the certificate and completion pages require.
 * Progress alone never means finished: a program sits at 100% `active` until
 * its required exam is passed or the student presses Finish.
 */
export function isFinished(enrollment: Pick<StudentEnrollment, "status">): boolean {
  return enrollment.status === "completed"
}

/**
 * Where an open (access-granting) program stands:
 * - `complete` — status completed.
 * - `no_lessons` — the package opens no published lesson yet.
 * - `exam` — a required final exam isn't passed and stored progress is 100,
 *   the exam route's own unlock rule (`getStudentExamStatus.eligible`).
 * - `finish` — no exam in the way and every open lesson done, but Finish (on
 *   the player's last lesson → `markCourseComplete`) not pressed: completing
 *   lessons never completes a program by itself.
 * - `start` — nothing done yet and the player opens the first lesson.
 * - `resume` — anything else.
 */
export type LearningStep = "complete" | "no_lessons" | "exam" | "finish" | "start" | "resume"

export function learningStep(enrollment: StudentEnrollment): LearningStep {
  const e = enrollment
  if (e.status === "completed") return "complete"
  if (e.openLessons === 0) return "no_lessons"
  if (e.finalExamPending) {
    if (e.progress >= 100) return "exam"
  } else if (e.completedOpenLessons >= e.openLessons) {
    return "finish"
  }
  return e.completedOpenLessons === 0 && e.resumeLessonId === e.firstLessonId ? "start" : "resume"
}

/**
 * The page a program's next step lives on: the final exam, the player's last
 * lesson (where Finish is), the course page while nothing is published, or
 * the player where the student left off. Non-access rows open the course page.
 */
export function nextStepHref(enrollment: StudentEnrollment): string {
  if (!grantsAccess(enrollment)) return enrollmentHref(enrollment)
  const coursePage = `/dashboard/courses/${enrollment.courseId}`
  switch (learningStep(enrollment)) {
    case "exam":
      return `${coursePage}/exam`
    case "finish":
      return enrollment.lastLessonId ? `${coursePage}/learn/${enrollment.lastLessonId}` : coursePage
    case "no_lessons":
      return coursePage
    default:
      return enrollmentHref(enrollment)
  }
}

export type LearningTotals = {
  /** Enrollments that open the player. */
  open: number
  inProgress: number
  completed: number
  lessonsDone: number
  /** Lessons the student's packages open — the denominator of `lessonsDone`. */
  lessonsOpen: number
}

/** The stat strip's figures, over access-granting enrollments only — a refunded or expired row isn't progress. */
export function learningTotals(enrollments: StudentEnrollment[]): LearningTotals {
  const open = enrollments.filter(grantsAccess)
  return {
    open: open.length,
    inProgress: open.filter(isInProgress).length,
    completed: open.filter(isFinished).length,
    lessonsDone: open.reduce((sum, e) => sum + e.completedOpenLessons, 0),
    lessonsOpen: open.reduce((sum, e) => sum + e.openLessons, 0),
  }
}

/** The reservation launching soonest. */
export function pickUpcomingLaunch(enrollments: StudentEnrollment[], now: number): StudentEnrollment | null {
  const launch = (e: StudentEnrollment) => new Date(e.courseAvailableAt ?? 0).getTime()
  return enrollments.filter((e) => isComingSoon(e, now)).sort((a, b) => launch(a) - launch(b))[0] ?? null
}

/** The most recently touched reservation whose course is already open. */
export function pickSeatReady(enrollments: StudentEnrollment[], now: number): StudentEnrollment | null {
  return enrollments.filter((e) => isSeatReady(e, now)).sort(byRecentAccess)[0] ?? null
}

export type HomeHero = {
  /**
   * `learning` — an open program (`learningStep` picks its face);
   * `seat_ready` — a reservation on an open course, waiting for checkout;
   * `reserved` — a reservation before launch.
   */
  mode: "learning" | "seat_ready" | "reserved"
  /** The program the hero is about. */
  enrollment: StudentEnrollment
}

/**
 * The home hero's program. The most recently opened ACTIVE program leads —
 * there is still something to do there (`pickCurrent`); then a reserved seat
 * the student can take up now; then a completed program (`pickResume`); then
 * a seat before launch. Null → the hero invites the student to browse.
 */
export function pickHero(enrollments: StudentEnrollment[], now: number): HomeHero | null {
  const current = pickCurrent(enrollments)
  if (current) return { mode: "learning", enrollment: current }
  const seat = pickSeatReady(enrollments, now)
  if (seat) return { mode: "seat_ready", enrollment: seat }
  const completed = pickResume(enrollments)
  if (completed) return { mode: "learning", enrollment: completed }
  const reserved = pickUpcomingLaunch(enrollments, now)
  return reserved ? { mode: "reserved", enrollment: reserved } : null
}

export type ProgramTab = "in_progress" | "completed" | "all"

/**
 * Rows for one tab of the home's My programs card. "All" leads with what is
 * in progress, then reservations, then completed programs, then rows that no
 * longer open the player (refunded, expired…); recent first within each.
 */
export function programsForTab(enrollments: StudentEnrollment[], tab: ProgramTab, now: number): StudentEnrollment[] {
  if (tab === "in_progress") return enrollments.filter(isInProgress).sort(byRecentAccess)
  if (tab === "completed") return enrollments.filter(isFinished).sort(byRecentAccess)
  const rank = (e: StudentEnrollment) =>
    isInProgress(e) ? 0 : isComingSoon(e, now) || isSeatReady(e, now) ? 1 : isFinished(e) ? 2 : 3
  return [...enrollments].sort((a, b) => rank(a) - rank(b) || byRecentAccess(a, b))
}

/** Nothing left for the student to do on these (a submitted assignment awaits the instructor). */
const ASSESSMENT_DONE: ReadonlySet<MyAssessment["status"]> = new Set(["passed", "submitted", "graded"])

export function assessmentCounts(assessments: MyAssessment[]): { toDo: number; done: number } {
  const done = assessments.filter((a) => ASSESSMENT_DONE.has(a.status)).length
  return { toDo: assessments.length - done, done }
}

/** A class past its start time that the host hasn't started — listed as "Waiting for your instructor". */
export function isClassLate(scheduledAt: string, now: number): boolean {
  return new Date(scheduledAt).getTime() <= now
}

/**
 * The one reading of `getUpcomingClasses` the home makes — the Upcoming
 * classes tile, the stat strip and the greeting line. The server lists
 * scheduled classes only (never started or ended ones), soonest first, from a
 * grace window before now. `waiting` are past their start with the host not
 * in yet; `ahead` haven't started — only those count as upcoming.
 */
export function splitClasses<T extends { scheduledAt: string }>(
  classes: T[],
  now: number
): { waiting: T[]; ahead: T[] } {
  const waiting: T[] = []
  const ahead: T[] = []
  for (const c of classes) (isClassLate(c.scheduledAt, now) ? waiting : ahead).push(c)
  return { waiting, ahead }
}

/** The soonest class still ahead. */
export function nextClass<T extends { scheduledAt: string }>(classes: T[], now: number): T | null {
  return splitClasses(classes, now).ahead[0] ?? null
}

const DAY_MS = 86_400_000

/** Local calendar day as an integer, so two instants compare by date, DST-safe. */
function dayNumber(time: number): number {
  const d = new Date(time)
  return Math.round(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / DAY_MS)
}

/**
 * When a class starts, relative to now. Standalone: "Today, 6:00 PM" ·
 * "Tomorrow, 9:30 AM" · "Thu, 6:00 PM" within the week · "Sep 24, 6:00 PM".
 * Inline (mid-sentence): "today at 6:00 PM" · "Thu at 6:00 PM".
 */
export function formatClassWhen(iso: string, now: number, { inline = false }: { inline?: boolean } = {}): string {
  const at = new Date(iso)
  const time = at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  const days = dayNumber(at.getTime()) - dayNumber(now)
  const day =
    days === 0
      ? inline ? "today" : "Today"
      : days === 1
        ? inline ? "tomorrow" : "Tomorrow"
        : days > 1 && days < 7
          ? at.toLocaleDateString("en-US", { weekday: "short" })
          : at.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  return `${day}${inline ? " at " : ", "}${time}`
}

/** "Sep 30" — the year only when it isn't this one. */
export function formatShortDate(iso: string, now: number): string {
  const d = new Date(iso)
  const sameYear = d.getFullYear() === new Date(now).getFullYear()
  return d.toLocaleDateString(
    "en-US",
    sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" }
  )
}

function plural(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many
}

/**
 * The greeting row's one line of context, every clause from real data, led
 * by the same program state the hero picks: programs in progress, else a
 * reserved seat ready to take up, else programs completed, else a seat's
 * launch — then the next live class and open assignments. Empty when there is
 * nothing true to say.
 */
export function homeSummary({
  enrollments,
  nextClassAt,
  toDo,
  now,
}: {
  enrollments: StudentEnrollment[]
  /** Only for students whose packages include live classes. */
  nextClassAt: string | null
  toDo: number
  now: number
}): string {
  const totals = learningTotals(enrollments)
  const seatsReady = enrollments.filter((e) => isSeatReady(e, now)).length
  const parts: string[] = []
  if (totals.inProgress > 0) {
    parts.push(`${totals.inProgress} ${plural(totals.inProgress, "program")} in progress`)
  } else if (seatsReady > 0) {
    parts.push(seatsReady === 1 ? "your reserved seat is ready" : `${seatsReady} reserved seats are ready`)
  } else if (totals.completed > 0) {
    parts.push(`${totals.completed} ${plural(totals.completed, "program")} completed`)
  } else {
    const launch = pickUpcomingLaunch(enrollments, now)
    if (launch?.courseAvailableAt) parts.push(`your seat opens ${formatShortDate(launch.courseAvailableAt, now)}`)
  }
  if (nextClassAt) parts.push(`next live class ${formatClassWhen(nextClassAt, now, { inline: true })}`)
  if (toDo > 0) parts.push(`${toDo} ${plural(toDo, "assignment")} to do`)
  const line = parts.join(" · ")
  return line.charAt(0).toUpperCase() + line.slice(1)
}

/** Catalogue programs the student isn't already enrolled in. */
export function notEnrolled<T extends { id: string }>(courses: T[], enrollments: StudentEnrollment[]): T[] {
  const enrolled = new Set(enrollments.map((e) => e.courseId))
  return courses.filter((c) => !enrolled.has(c.id))
}

/** "Sarah Chen" → "SC", for avatar fallbacks. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export type BentoPrefer = "wide" | "narrow"

export type BentoRow<K extends string> =
  /** 3:2 at full width — `wideRight` alternates the long list's side row by row. */
  | { kind: "pair"; wide: K; narrow: K[]; wideRight: boolean }
  /** Equal columns (one to three tiles). */
  | { kind: "even"; keys: K[] }

/**
 * Lays the home tiles out as the hub's paired rows, so a tile hidden for this
 * student never leaves a hole. Wide tiles (long lists) pair with narrow ones;
 * leftover narrow tiles share a row evenly, except a single leftover, which
 * joins the last pair's narrow column rather than standing alone.
 */
export function layoutBento<K extends string>(tiles: readonly { key: K; prefer: BentoPrefer }[]): BentoRow<K>[] {
  const wide = tiles.filter((t) => t.prefer === "wide").map((t) => t.key)
  const narrow = tiles.filter((t) => t.prefer === "narrow").map((t) => t.key)
  const rows: BentoRow<K>[] = []
  const pairs = Math.min(wide.length, narrow.length)
  for (let i = 0; i < pairs; i++) {
    rows.push({ kind: "pair", wide: wide[i], narrow: [narrow[i]], wideRight: i % 2 === 1 })
  }
  for (const key of wide.slice(pairs)) rows.push({ kind: "even", keys: [key] })

  const rest = narrow.slice(pairs)
  const last = rows[rows.length - 1]
  if (rest.length === 1 && last?.kind === "pair") {
    last.narrow.push(rest[0])
    return rows
  }
  for (let i = 0; i < rest.length; ) {
    const size = rest.length - i === 3 ? 3 : Math.min(2, rest.length - i)
    rows.push({ kind: "even", keys: rest.slice(i, i + size) })
    i += size
  }
  return rows
}
