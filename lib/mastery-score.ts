/**
 * The Mastery Score (D24, institutional blueprint §12): how well a learner is
 * mastering one program, 0–100.
 *
 * - Computed on read from the learner's own data, never stored, and with no
 *   cash value.
 * - Visible only to the learner, their faculty and admins, on `(platform)` and
 *   `(admin)` surfaces. Never on a public page.
 * - `MASTERY_WEIGHTS` is the one constant the owner tunes.
 * - A part the plan doesn't include, or one with no data yet, is left out and
 *   the rest are re-weighted, so a Basic learner is never marked down for what
 *   their plan doesn't open.
 * - The server-only loader that gathers the inputs is `lib/mastery-inputs.ts`.
 *
 * Pure and client-safe: no imports.
 */

export const MASTERY_WEIGHTS = { completion: 30, assessment: 25, assignments: 20, projects: 10, attendance: 15 } as const

export type MasteryKey = keyof typeof MASTERY_WEIGHTS

export const MASTERY_KEYS: readonly MasteryKey[] = ["completion", "assessment", "assignments", "projects", "attendance"]

/** A score needs at least this many parts with data. */
export const MASTERY_MIN_PARTS = 2

/** Each 0–100; null when the plan excludes the part or it has no data. */
export type MasteryInputs = Record<MasteryKey, number | null>

export type MasteryPart = { key: MasteryKey; value: number | null; weight: number }

export type MasteryResult = { score: number | null; parts: MasteryPart[] }

export type MasteryClasses = { attended: number; held: number }

export type MasteryFacts = {
  inputs: MasteryInputs
  /** Parts the plan doesn't include, in MASTERY_KEYS order. */
  excluded: MasteryKey[]
  /** Null when the plan has no live classes. */
  classes: MasteryClasses | null
  /** Highest graded project (0–100), null when none or the plan has no assignments; Phase 17's Mastery tier. */
  bestProjectGrade: number | null
}

export type MasteryView = { result: MasteryResult; excluded: MasteryKey[]; classes: MasteryClasses | null }

export type MyMastery = MasteryView & { enrollmentId: string; courseId: string; courseTitle: string }

function clamp(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null
  return Math.min(100, Math.max(0, value))
}

/** The weighted mean over the parts that have a value, or a null score while fewer than MASTERY_MIN_PARTS do. */
export function masteryScore(inputs: MasteryInputs): MasteryResult {
  const clamped = MASTERY_KEYS.map((key) => ({ key, value: clamp(inputs[key]), weight: MASTERY_WEIGHTS[key] as number }))
  let weighted = 0
  let totalWeight = 0
  let present = 0
  for (const p of clamped) {
    if (p.value === null) continue
    weighted += p.value * p.weight
    totalWeight += p.weight
    present += 1
  }
  const score = present >= MASTERY_MIN_PARTS ? Math.round(weighted / totalWeight) : null
  return {
    score,
    parts: clamped.map((p) => ({ key: p.key, value: p.value === null ? null : Math.round(p.value), weight: p.weight })),
  }
}

/** Scores the facts after nulling every part the plan doesn't include. */
export function masteryView(facts: MasteryFacts): MasteryView {
  const inputs: MasteryInputs = { ...facts.inputs }
  for (const key of facts.excluded) inputs[key] = null
  return { result: masteryScore(inputs), excluded: facts.excluded, classes: facts.classes }
}

export const MASTERY_PART_COPY: Record<MasteryKey, { label: string; hint: string }> = {
  completion: { label: "Completion", hint: "Lessons your plan opens" },
  assessment: { label: "Assessments", hint: "Your best final-exam score" },
  assignments: { label: "Assignments", hint: "Average grade, graded work only" },
  projects: { label: "Projects", hint: "Average project grade" },
  attendance: { label: "Attendance", hint: "Live classes joined on the web" },
}
