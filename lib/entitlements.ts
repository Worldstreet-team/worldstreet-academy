import type { ICoursePackage, IPackageEntitlements, PackageKey } from "@/lib/db/models"
import { isFileFormat, type CourseFormat } from "@/lib/course-format"

export const PACKAGE_RANK: Record<PackageKey, 1 | 2 | 3> = { basic: 1, standard: 2, executive: 3 }

/** Legacy / free / pre-enrolled enrollments: everything today's app allows. */
export const FULL_ACCESS: IPackageEntitlements = {
  liveClasses: true,
  instructorQa: true,
  assignments: true,
  certificate: true,
  mentorship: true,
  prioritySupport: true,
}

/**
 * A template or guide (a file product) grants no services: no live classes, no
 * Q&A, no assignments, no certificate, no recordings or mentorship. Its
 * enrollment carries a null packageKey, which would otherwise read as
 * FULL_ACCESS.
 */
export const NO_ENTITLEMENTS: IPackageEntitlements = {
  liveClasses: false,
  instructorQa: false,
  assignments: false,
  certificate: false,
  mentorship: false,
  prioritySupport: false,
}

// Optional fields: a .lean()/projected read of a legacy row predates these
// fields and returns no key at all — Mongoose only materialises defaults when
// it hydrates a document.
// `format` is REQUIRED (null or undefined are allowed, explicitly): a read that
// forgets to select it would otherwise grant a template full access.
type PackagesLike = { packages?: ICoursePackage[] | null }
type CourseLike = PackagesLike & { format: CourseFormat | null | undefined }
type EnrollmentLike = { packageKey?: PackageKey | null } | null | undefined
type LessonLike = { minPackageKey?: PackageKey | null; isFree?: boolean }

/** An enabled (on-sale) package by key — what checkout may sell. */
export function packageFor(course: PackagesLike, key: PackageKey | null): ICoursePackage | null {
  if (!key) return null
  return (course.packages ?? []).find((p) => p.key === key && p.enabled) ?? null
}

/** The course sells packages: at least one tier is enabled, so a buyer must choose one. */
export function sellsPackages(course: PackagesLike): boolean {
  return (course.packages ?? []).some((p) => p.enabled)
}

/**
 * What an enrollment's package unlocks. The bought package is found by key
 * even if its tier has since been disabled for sale — buyers keep what they
 * paid for. A null packageKey (legacy / free / pre-enrolled), or a package no
 * longer on the course at all → FULL_ACCESS (grandfathered).
 */
export function entitlementsFor(course: CourseLike, enrollment: EnrollmentLike): IPackageEntitlements {
  // The one rule for file products: callers must select `format` beside `packages`.
  if (isFileFormat(course.format)) return NO_ENTITLEMENTS
  const key = enrollment?.packageKey ?? null
  const pkg = key ? (course.packages ?? []).find((p) => p.key === key) : undefined
  return pkg ? pkg.entitlements : FULL_ACCESS
}

/**
 * A lesson's tier only gates while the course still sells (has enabled) that
 * tier — a tier switched off in the ladder gates nothing.
 */
export function effectiveLessonTier(course: PackagesLike, lesson: LessonLike): PackageKey | null {
  const tier = lesson.minPackageKey ?? null
  return tier && packageFor(course, tier) ? tier : null
}

/** Free-preview lessons, untiered lessons and legacy (null-package) enrollments always open. */
export function canAccessLesson(course: PackagesLike, lesson: LessonLike, enrollment: EnrollmentLike): boolean {
  if (lesson.isFree) return true
  const tier = effectiveLessonTier(course, lesson)
  if (!tier) return true
  const key = enrollment?.packageKey ?? null
  if (!key) return true
  return PACKAGE_RANK[key] >= PACKAGE_RANK[tier]
}

/**
 * Course.price/pricing must stay truthful for surfaces (and the mobile app)
 * that only read the scalar: with packages, price = cheapest enabled package.
 * Returns null when there are no enabled packages (keep the course's own values).
 */
export function pricingFromPackages(
  packages: ICoursePackage[] | null | undefined
): { pricing: "free" | "paid"; price: number } | null {
  const enabled = (packages ?? []).filter((p) => p.enabled)
  if (enabled.length === 0) return null
  const price = Math.min(...enabled.map((p) => p.price))
  return { pricing: price > 0 ? "paid" : "free", price }
}

/** Ladder order — also the order the program page renders tiers in. */
export const PACKAGE_KEYS = ["basic", "standard", "executive"] as const

export function isPackageKey(value: unknown): value is PackageKey {
  return typeof value === "string" && (PACKAGE_KEYS as readonly string[]).includes(value)
}

/** Spec §6 tier labels as the program page and editor print them. */
export const PACKAGE_LABEL: Record<PackageKey, string> = {
  basic: "Basic",
  standard: "Standard",
  executive: "Executive 101",
}

/** Lowest enabled tier whose package includes `flag` — the package a lock notice names. null when none does. */
export function lowestPackageWith(course: PackagesLike, flag: keyof IPackageEntitlements): PackageKey | null {
  return PACKAGE_KEYS.find((key) => packageFor(course, key)?.entitlements[flag]) ?? null
}

/**
 * Executive mentorship (spec §6 "Private 1-on-1 coaching"): an enrollment that
 * bought the Executive package, while that package is still on the course (found
 * by key, `enabled` ignored — buyers keep what they paid for) and includes
 * mentorship. Legacy null-package rows and single "Full program" tiers never
 * qualify: full ACCESS is not a purchased service. Server callers pair it with an
 * access-granting enrollment (`getCourseAccess`). The dashboard's
 * `isMentorEnrollment` is the client twin.
 */
export function includesMentorship(course: PackagesLike, enrollment: EnrollmentLike): boolean {
  if (enrollment?.packageKey !== "executive") return false
  return Boolean((course.packages ?? []).find((p) => p.key === "executive")?.entitlements.mentorship)
}
