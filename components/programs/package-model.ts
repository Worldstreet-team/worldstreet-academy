/**
 * The program page's package rules — pure and client-safe, shared by the
 * package chooser, the purchase card and the bottom bar. Every value here is
 * derived from `ProgramDetail.packages` (the instructor's own tiers) and the
 * published curriculum; nothing is invented.
 */
import type { PublicPackage } from "@/lib/actions/student"
import type { IPackageEntitlements, PackageKey } from "@/lib/db/models"
import { PACKAGE_LABEL, PACKAGE_RANK } from "@/lib/entitlements"

export type ServiceKey = keyof IPackageEntitlements

/** The six services a tier can carry, in the order a buyer climbs them. */
export const SERVICES: ReadonlyArray<{ key: ServiceKey; label: string }> = [
  { key: "liveClasses", label: "Live classes" },
  { key: "instructorQa", label: "Instructor Q&A" },
  { key: "assignments", label: "Graded assignments" },
  { key: "certificate", label: "Certificate of completion" },
  { key: "mentorship", label: "1-on-1 mentorship" },
  { key: "prioritySupport", label: "Priority support" },
]

/**
 * What a package truly promises — the same rule as `programIncludes`. A
 * ladder-less program (`tierCount` 0) is sold as one synthesized tier whose
 * FULL_ACCESS entitlements describe ACCESS for a legacy enrollment, not
 * promises: it lists only the certificate and instructor Q&A. Mentorship is
 * only ever delivered to an Executive enrollment (`includesMentorship`).
 */
export function servicesOf(pkg: PublicPackage, tierCount: number): Record<ServiceKey, boolean> {
  if (tierCount === 0) {
    return {
      liveClasses: false,
      instructorQa: true,
      assignments: false,
      certificate: true,
      mentorship: false,
      prioritySupport: false,
    }
  }
  return {
    ...pkg.entitlements,
    mentorship: pkg.entitlements.mentorship && pkg.key === "executive",
  }
}

/** The package a visitor starts on: the instructor's "most popular", else the first. */
export function defaultPackageKey(packages: PublicPackage[]): PackageKey {
  return (packages.find((p) => p.highlight) ?? packages[0]).key
}

/**
 * Checkout for one package. A ladder-less program has no real package to
 * name (the server ignores a key there), so its link carries none.
 */
export function checkoutHref(courseId: string, pkg: PublicPackage, tierCount: number): string {
  const base = `/dashboard/checkout?courseId=${encodeURIComponent(courseId)}`
  return tierCount > 0 ? `${base}&package=${pkg.key}` : base
}

/**
 * The primary action's words. The instructor's own button copy wins (spec
 * §6 "APPLY / ENROL FOR $999"); otherwise "Continue to payment" (or "Enrol
 * now" on a single-price program), with the price shown beside it.
 */
export function actionLabel(pkg: PublicPackage, single: boolean): { text: string; showPrice: boolean } {
  if (pkg.ctaLabel) return { text: pkg.ctaLabel, showPrice: false }
  if (pkg.price === 0) return { text: "Enrol for free", showPrice: false }
  return { text: single ? "Enrol now" : "Continue to payment", showPrice: true }
}

/** How many published lessons each tier opens (free previews and untiered lessons open for all). */
export type LessonAccess = { total: number; open: Partial<Record<PackageKey, number>> }

/** "All 12 lessons", "9 of 12 lessons", "1 lesson" — what a tier opens; null with no published lessons. */
export function lessonLine(access: LessonAccess | null, key: PackageKey): string | null {
  if (!access || access.total === 0) return null
  const open = access.open[key] ?? access.total
  const total = access.total.toLocaleString("en-US")
  if (open >= access.total) return access.total === 1 ? "1 lesson" : `All ${total} lessons`
  return `${open.toLocaleString("en-US")} of ${total} lessons`
}

// ---------------------------------------------------------------------------
// "Everything in Basic" — the feature lists' own inheritance
// ---------------------------------------------------------------------------

const INHERITS = /^everything (?:in|from) (?:the )?(.+?)(?: (?:package|tier|plan))?[.:]?$/i

export type PackageBreakdown = {
  /** The instructor's inheritance line verbatim ("Everything in Basic"), when it names a lower tier. */
  inheritLine: string | null
  /** The lower tier that line names. */
  inheritsFrom: PackageKey | null
  /** That tier's full list, its own inheritance resolved. */
  inherited: string[]
  /** This tier's own lines, the resolved inheritance line removed. */
  own: string[]
}

const norm = (line: string) => line.trim().toLowerCase()

/** The lower tier an "Everything in X" line names, matched by key, label or package name. */
function parentOf(line: string, pkg: PublicPackage, packages: PublicPackage[]): PublicPackage | null {
  const match = INHERITS.exec(line.trim())
  if (!match) return null
  const named = norm(match[1])
  return (
    packages.find(
      (p) =>
        PACKAGE_RANK[p.key] < PACKAGE_RANK[pkg.key] &&
        (named === p.key || named === norm(PACKAGE_LABEL[p.key]) || named === norm(p.name))
    ) ?? null
  )
}

/**
 * Each tier's list split into what it inherits and what it adds. An
 * "Everything in X" line that names no lower tier of this program stays an
 * ordinary line — the instructor's copy is never dropped.
 */
export function breakdownsOf(packages: PublicPackage[]): Record<string, PackageBreakdown> {
  const out: Record<string, PackageBreakdown> = {}
  const effective: Record<string, string[]> = {}
  for (const pkg of packages) {
    let inheritLine: string | null = null
    let parent: PublicPackage | null = null
    const own: string[] = []
    for (const line of pkg.features) {
      const found: PublicPackage | null = parent ? null : parentOf(line, pkg, packages)
      if (found) {
        parent = found
        inheritLine = line.trim()
      } else if (line.trim()) {
        own.push(line.trim())
      }
    }
    const inherited = parent ? (effective[parent.key] ?? []) : []
    const seen = new Set(inherited.map(norm))
    effective[pkg.key] = [...inherited, ...own.filter((line) => !seen.has(norm(line)))]
    out[pkg.key] = { inheritLine, inheritsFrom: parent?.key ?? null, inherited, own }
  }
  return out
}

// ---------------------------------------------------------------------------
// Compare packages — feature × tier
// ---------------------------------------------------------------------------

export type CompareCell = boolean | string
export type CompareRow = { label: string; cells: CompareCell[] }
export type CompareGroup = { title: string; rows: CompareRow[] }

/**
 * The comparison table, built from the same data as the cards: lessons (when
 * the curriculum is published), the services, then every feature line grouped
 * by the tier that first lists it. A group is titled "Included from Basic" /
 * "Added in Standard" only when its lines really do carry up the ladder;
 * otherwise it says where they are first listed.
 */
export function comparisonOf(
  packages: PublicPackage[],
  tierCount: number,
  lessons: LessonAccess | null
): CompareGroup[] {
  const groups: CompareGroup[] = []
  const breakdowns = breakdownsOf(packages)
  const effective = packages.map((p) => {
    const b = breakdowns[p.key]
    return new Set([...b.inherited, ...b.own].map(norm))
  })

  const services: CompareRow[] = []
  if (lessons && lessons.total > 0) {
    services.push({
      label: "Lessons",
      cells: packages.map((p) => {
        const open = lessons.open[p.key] ?? lessons.total
        return open >= lessons.total ? `All ${lessons.total}` : `${open} of ${lessons.total}`
      }),
    })
  }
  const promised = packages.map((p) => servicesOf(p, tierCount))
  for (const service of SERVICES) {
    const cells = promised.map((s) => s[service.key])
    if (cells.some(Boolean)) services.push({ label: service.label, cells })
  }
  if (services.length > 0) groups.push({ title: "Services", rows: services })

  const listed = new Set<string>()
  packages.forEach((pkg, index) => {
    const b = breakdowns[pkg.key]
    const lines = [...b.inherited, ...b.own].filter((line) => !listed.has(norm(line)))
    if (lines.length === 0) return
    const rows = lines.map((line) => {
      listed.add(norm(line))
      return { label: line, cells: effective.map((set) => set.has(norm(line))) }
    })
    // Carried up the ladder: on for this tier and every tier above, off below.
    const cumulative = rows.every((row) => row.cells.every((on, i) => on === i >= index))
    const label = PACKAGE_LABEL[pkg.key]
    groups.push({
      title: cumulative ? (index === 0 ? `Included from ${label}` : `Added in ${label}`) : `First listed in ${label}`,
      rows,
    })
  })
  return groups
}

/** The lowest tier of this program that promises a service — where a missing one can be had. */
export function lowestWith(packages: PublicPackage[], tierCount: number, key: ServiceKey): PackageKey | null {
  return packages.find((p) => servicesOf(p, tierCount)[key])?.key ?? null
}
