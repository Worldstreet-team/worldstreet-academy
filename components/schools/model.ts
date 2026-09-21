import type { ProgramDetail } from "@/lib/actions/student"
import type { ProgramCurriculumLesson } from "@/lib/actions/program-page"
import type { PackageKey } from "@/lib/db/models"
import { courseAvailability } from "@/lib/types/course"
import { PACKAGE_LABEL } from "@/lib/entitlements"
import { programPriceLabel } from "@/lib/program-price"
import { programIncludes, type IncludedItem, type ProgramFacts } from "@/components/programs/purchase-panel"
import type { ProgramPreview } from "@/components/programs/preview-player"
import { formatLength, plural } from "@/components/programs/format"

/**
 * The school page's read model: each program with what its curriculum really
 * holds, and the pure derivations the sections share (level range, the topic
 * map, the comparison). Every figure comes from the program's published
 * lessons, its packages or its stored rating — never the drifting
 * `totalLessons`/`totalDuration` counters — and a missing figure stays
 * missing rather than printing as zero.
 */

export type SchoolProgram = {
  program: ProgramDetail
  /** Counted from the published lessons, as on the program page. */
  facts: ProgramFacts
  /** Free video lessons, tagged with the program for the shared player. */
  previews: ProgramPreview[]
  /** "This program includes" — the program page's own rule (`programIncludes`). */
  includes: IncludedItem[]
  comingSoon: boolean
}

export function toSchoolProgram(program: ProgramDetail, curriculum: ProgramCurriculumLesson[]): SchoolProgram {
  const previews: ProgramPreview[] = curriculum.flatMap((lesson) =>
    lesson.isFree && lesson.videoUrl
      ? [
          {
            id: lesson.id,
            title: lesson.title,
            durationSec: lesson.durationSec,
            videoUrl: lesson.videoUrl,
            posterUrl: lesson.posterUrl ?? program.thumbnailUrl,
            program: program.title,
          },
        ]
      : []
  )
  const facts: ProgramFacts = {
    lessons: curriculum.length,
    videoSec: curriculum.reduce((sum, lesson) => sum + (lesson.durationSec ?? 0), 0),
    previews: previews.length,
  }
  return {
    program,
    facts,
    previews,
    includes: programIncludes(program, facts),
    comingSoon: courseAvailability({ status: "published", availableAt: program.availableAt }) === "coming_soon",
  }
}

// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------

export const LEVELS = ["beginner", "intermediate", "advanced"] as const
export type Level = (typeof LEVELS)[number]

export const LEVEL_LABEL: Record<Level, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
}

/** The levels the programs cover, in ladder order. */
export function levelsOf(programs: SchoolProgram[]): Level[] {
  return LEVELS.filter((level) => programs.some((p) => p.program.level === level))
}

/** Beginner first, then the catalogue's own order (most enrolled, newest) within a level. */
export function byLevel(programs: SchoolProgram[]): SchoolProgram[] {
  return [...programs].sort((a, b) => LEVELS.indexOf(a.program.level) - LEVELS.indexOf(b.program.level))
}

/** "Opens Oct 3" — pinned to UTC so the server render and any client agree. */
export function opensLabel(availableAt: string): string {
  return `Opens ${new Date(availableAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`
}

/** "3 lessons · 15m of video" — only the parts that are real; empty when none are. */
export function sizeLine(facts: ProgramFacts): string[] {
  return [
    facts.lessons > 0 ? plural(facts.lessons, "lesson") : null,
    facts.videoSec > 0 ? `${formatLength(facts.videoSec)} of video` : null,
  ].filter((part): part is string => part !== null)
}

// ---------------------------------------------------------------------------
// Topics — "What you'll learn here"
// ---------------------------------------------------------------------------

export type SharedTopic = { text: string; programIds: string[] }

export type TopicMap = {
  /** Topics that appear in two or more programs, in first-seen order. */
  shared: SharedTopic[]
  /** Each program's topics that no other program lists, in the program's own order. */
  own: Array<{ program: ProgramDetail; topics: string[] }>
  /** Distinct topics across the school. */
  total: number
}

const topicKey = (text: string) => text.trim().toLowerCase().replace(/\s+/g, " ")

/**
 * The programs' own "what you'll learn" lines, de-duplicated across the
 * school (exact text, ignoring case and spacing — nothing is paraphrased or
 * merged by guesswork) and attributed: a line two programs share is listed
 * once, under both.
 */
export function topicMap(programs: SchoolProgram[]): TopicMap {
  const seen = new Map<string, { text: string; programIds: string[] }>()
  for (const { program } of programs) {
    for (const line of program.whatYouWillLearn) {
      const text = line.trim()
      if (!text) continue
      const key = topicKey(text)
      const entry = seen.get(key)
      if (!entry) seen.set(key, { text, programIds: [program.id] })
      else if (!entry.programIds.includes(program.id)) entry.programIds.push(program.id)
    }
  }
  const shared = [...seen.values()].filter((t) => t.programIds.length > 1)
  const sharedKeys = new Set(shared.map((t) => topicKey(t.text)))
  const own = programs
    .map(({ program }) => ({
      program,
      topics: [...new Set(program.whatYouWillLearn.map((line) => line.trim()).filter(Boolean))].filter(
        (text) => !sharedKeys.has(topicKey(text))
      ),
    }))
    .filter((column) => column.topics.length > 0)
  return { shared, own, total: seen.size }
}

// ---------------------------------------------------------------------------
// Compare
// ---------------------------------------------------------------------------

export type CompareCell =
  | { kind: "text"; text: string; sub?: string; capitalize?: boolean }
  | { kind: "included" }
  | { kind: "tier"; tier: PackageKey }
  | { kind: "rating"; rating: number; count: number }
  | null

export type CompareRow = { label: string; cells: CompareCell[] }

/** Rows under a heading that says how to read them (e.g. why a cell names a package). */
export type CompareGroup = { title: string; rows: CompareRow[] }

/** The services `programIncludes` can list, as the table names them. */
const SERVICE_ROWS: ReadonlyArray<{ label: string; include: string }> = [
  { label: "Live classes", include: "Live classes" },
  { label: "Instructor Q&A", include: "Instructor Q&A" },
  { label: "Graded assignments", include: "Graded assignments" },
  { label: "Certificate", include: "Certificate of completion" },
  { label: "1-on-1 mentorship", include: "1-on-1 mentorship" },
]

/**
 * The side-by-side table, in groups. A cell is null (printed as a dash) when
 * that program doesn't have the thing yet; a row where no program has it is
 * left out, and so is a group left with no rows. Services follow the program
 * page's own rule: included from the first price, or named by the package
 * that adds it.
 */
export function compareGroups(programs: SchoolProgram[]): CompareGroup[] {
  const basics: CompareRow[] = [
    {
      label: "Level",
      cells: programs.map(({ program }) => ({ kind: "text", text: program.level, capitalize: true })),
    },
    {
      label: "Price",
      cells: programs.map(({ program }) => ({ kind: "text", text: programPriceLabel(program) })),
    },
    {
      label: "Packages",
      cells: programs.map(({ program }) =>
        program.tierCount > 1
          ? {
              kind: "text",
              text: plural(program.packages.length, "package"),
              sub: `${PACKAGE_LABEL[program.packages[0].key]} to ${PACKAGE_LABEL[program.packages[program.packages.length - 1].key]}`,
            }
          : { kind: "text", text: "One price" }
      ),
    },
    {
      label: "Availability",
      cells: programs.some((p) => p.comingSoon)
        ? programs.map(({ program, comingSoon }) =>
            comingSoon && program.availableAt
              ? { kind: "text", text: opensLabel(program.availableAt) }
              : { kind: "text", text: "Open now" }
          )
        : programs.map(() => null),
    },
  ]
  const inside: CompareRow[] = [
    {
      label: "Lessons",
      cells: programs.map(({ facts }) => (facts.lessons > 0 ? { kind: "text", text: plural(facts.lessons, "lesson") } : null)),
    },
    {
      label: "Video",
      cells: programs.map(({ facts }) => (facts.videoSec > 0 ? { kind: "text", text: formatLength(facts.videoSec) } : null)),
    },
    {
      label: "Free lessons",
      cells: programs.map(({ facts }) => (facts.previews > 0 ? { kind: "text", text: String(facts.previews) } : null)),
    },
  ]
  const services: CompareRow[] = SERVICE_ROWS.map(({ label, include }) => ({
    label,
    cells: programs.map(({ includes }): CompareCell => {
      const item = includes.find((i) => i.label === include)
      if (!item) return null
      return item.tier ? { kind: "tier", tier: item.tier } : { kind: "included" }
    }),
  }))
  const people: CompareRow[] = [
    {
      label: "Rating",
      cells: programs.map(({ program }) =>
        program.rating !== null && program.ratingCount > 0
          ? { kind: "rating", rating: program.rating, count: program.ratingCount }
          : null
      ),
    },
    {
      label: "Instructor",
      cells: programs.map(({ program }) => ({ kind: "text", text: program.instructorName })),
    },
  ]
  const kept = (rows: CompareRow[]) => rows.filter((row) => row.cells.some((cell) => cell !== null))
  return [
    { title: "At a glance", rows: kept(basics) },
    { title: "What’s inside today", rows: kept(inside) },
    { title: "Which package adds each service", rows: kept(services) },
    { title: "Learners and faculty", rows: kept(people) },
  ].filter((group) => group.rows.length > 0)
}
