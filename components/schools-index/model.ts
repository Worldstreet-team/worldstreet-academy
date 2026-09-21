import type { BrowseCourse } from "@/lib/actions/student"
import { SCHOOLS, type SchoolSlug } from "@/lib/schools"
import { schoolCover } from "@/lib/school-art"

/**
 * The `/schools` index as plain data: built once on the server from the live
 * catalogue (`fetchBrowseCourses`), then filtered on the client as the
 * visitor types. Nothing here is invented — every label is a field of a real
 * program or school, and anything that would read zero is left out.
 */

export type Level = BrowseCourse["level"]

export const LEVEL_ORDER: readonly Level[] = ["beginner", "intermediate", "advanced"]

export const LEVEL_LABEL: Record<Level, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
}

export type IndexProgram = {
  id: string
  slug: string
  title: string
  level: Level
  /** Program art (its thumbnail, else its program art, else its school's cover). */
  art: string | null
  /** Cheapest way in, whole USD; 0 = free; null = no price set. */
  price: number | null
  /** Enabled packages; 2+ means the price is the cheapest of a ladder ("from"). */
  packages: number
  /** "Opens Oct 3" for a program scheduled in the future; null once it is open. */
  opens: string | null
  /** Lower-cased search words: title, blurb, outcomes, level, instructor. */
  terms: string[]
}

export type IndexSchool = {
  slug: SchoolSlug
  /** "01" … "08" — the spec's order (§4). */
  number: string
  /** Full name, e.g. "School of Cybersecurity" — the heading's accessible text. */
  name: string
  /** "School of", when the name starts with it; the title is the rest. */
  lead: string | null
  title: string
  short: string
  tagline: string | null
  blurb: string
  cover: string | null
  programs: IndexProgram[]
  /** Cheapest program in the school, whole USD; 0 = free; null = none priced. */
  from: number | null
  terms: string[]
}

const LEAD = "School of "

/** Split text into lower-cased words; hyphenated words also count joined ("e-commerce" → "ecommerce"). */
export function wordsOf(text: string): string[] {
  const out = new Set<string>()
  const lower = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
  for (const chunk of lower.split(/[^\p{L}\p{N}-]+/u)) {
    if (!chunk) continue
    const parts = chunk.split("-").filter(Boolean)
    for (const part of parts) out.add(part)
    if (parts.length > 1) out.add(parts.join(""))
  }
  return Array.from(out)
}

/** Every query word must begin some word of the subject — "crypto" finds "cryptocurrency", "ai" never finds "maintain". */
export function matches(terms: readonly string[], tokens: readonly string[]): boolean {
  return tokens.every((t) => terms.some((w) => w.startsWith(t)))
}

function toProgram(course: BrowseCourse, now: number): IndexProgram {
  const price = course.pricing === "free" ? 0 : course.price
  const opensAt = course.availableAt ? new Date(course.availableAt) : null
  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    level: course.level,
    art: course.thumbnailUrl,
    price: price ?? null,
    packages: course.tierCount,
    opens:
      opensAt && opensAt.getTime() > now
        ? `Opens ${opensAt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`
        : null,
    terms: wordsOf(
      [
        course.title,
        course.shortDescription ?? "",
        ...course.outcomes,
        LEVEL_LABEL[course.level] ?? "",
        course.instructorName,
      ].join(" ")
    ),
  }
}

export type SchoolsIndexData = {
  schools: IndexSchool[]
  /** Published programs not in any school — reachable here only through search and the level filter. */
  others: IndexProgram[]
  /** Levels present across every published program, in ladder order. The filter renders only when there are two or more. */
  levels: Level[]
  /** Published programs, all of them — the "browse all" count. */
  total: number
}

export function buildSchoolsIndex(courses: readonly BrowseCourse[]): SchoolsIndexData {
  const now = Date.now()
  const published = courses.filter((c) => c.status === "published")
  const bySchool = new Map<SchoolSlug, IndexProgram[]>()
  const others: IndexProgram[] = []
  for (const course of published) {
    const program = toProgram(course, now)
    if (course.school) bySchool.set(course.school, [...(bySchool.get(course.school) ?? []), program])
    else others.push(program)
  }

  const schools = SCHOOLS.map((school, i): IndexSchool => {
    const programs = bySchool.get(school.slug) ?? []
    const priced = programs.map((p) => p.price).filter((p): p is number => p !== null)
    const lead = school.name.startsWith(LEAD) ? LEAD.trim() : null
    return {
      slug: school.slug,
      number: String(i + 1).padStart(2, "0"),
      name: school.name,
      lead,
      title: lead ? school.name.slice(LEAD.length) : school.name,
      short: school.short,
      tagline: school.tagline,
      blurb: school.blurb,
      cover: schoolCover(school.slug),
      programs,
      from: priced.length ? Math.min(...priced) : null,
      terms: wordsOf([school.name, school.short, school.blurb, school.tagline ?? "", school.intro ?? ""].join(" ")),
    }
  })

  const present = new Set(published.map((c) => c.level))
  return {
    schools,
    others,
    levels: LEVEL_ORDER.filter((l) => present.has(l)),
    total: published.length,
  }
}

export type LevelFilter = Level | "all"

export type SchoolHit = {
  school: IndexSchool
  /** The programs to show — all of them, or the ones the filter kept. */
  programs: IndexProgram[]
  /** Programs of this school the filter left out. */
  hidden: number
}

export type IndexResult = {
  active: boolean
  tokens: string[]
  hits: SchoolHit[]
  others: IndexProgram[]
  programCount: number
}

/**
 * Narrow the index, most specific match first:
 *   · programs that match on their own words ("forex" → Forex Trading
 *     Mastery, even though the trading school's blurb mentions Forex too);
 *   · else, when the school's own words match, all its programs ("trading");
 *   · else, programs that match together with their school ("trading
 *     beginner" → the beginner programs of the trading school).
 * A level filter applies to every program shown and keeps only schools with
 * a program at that level.
 */
export function filterIndex(
  data: Pick<SchoolsIndexData, "schools" | "others">,
  query: string,
  level: LevelFilter
): IndexResult {
  const tokens = wordsOf(query)
  const active = tokens.length > 0 || level !== "all"
  const atLevel = (p: IndexProgram) => level === "all" || p.level === level

  if (!active) {
    return {
      active,
      tokens,
      hits: data.schools.map((school) => ({ school, programs: school.programs, hidden: 0 })),
      others: [],
      programCount: data.schools.reduce((n, s) => n + s.programs.length, 0),
    }
  }

  const hits: SchoolHit[] = []
  for (const school of data.schools) {
    const schoolHit = matches(school.terms, tokens)
    const eligible = school.programs.filter(atLevel)
    const direct = tokens.length > 0 ? eligible.filter((p) => matches(p.terms, tokens)) : []
    const programs =
      direct.length > 0
        ? direct
        : schoolHit
          ? eligible
          : eligible.filter((p) => matches([...school.terms, ...p.terms], tokens))
    const keep = level === "all" ? schoolHit || programs.length > 0 : programs.length > 0
    if (keep) hits.push({ school, programs, hidden: school.programs.length - programs.length })
  }
  const others = data.others.filter((p) => atLevel(p) && matches(p.terms, tokens))
  return {
    active,
    tokens,
    hits,
    others,
    programCount: hits.reduce((n, h) => n + h.programs.length, 0) + others.length,
  }
}

/**
 * The Academy's own path-traced renders (`/art/…`) put a small subject on a
 * wide dark stage; a thumbnail zooms onto the subject. Uploaded photos are
 * framed by their owners and are shown whole.
 */
export function isRender(src: string): boolean {
  return src.startsWith("/art/")
}

/** Zoomed onto the render's subject (right of centre, just below the middle). */
export const RENDER_THUMB = "origin-[64%_58%] scale-[1.9]"

export function usd(value: number): string {
  return `$${value.toLocaleString("en-US")}`
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`
}
