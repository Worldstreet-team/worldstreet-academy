import type { ICoursePackage, IPackageEntitlements, PackageKey } from "@/lib/db/models"

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

// Optional fields: a .lean()/projected read of a legacy row predates these
// fields and returns no key at all — Mongoose only materialises defaults when
// it hydrates a document.
type CourseLike = { packages?: ICoursePackage[] | null }
type EnrollmentLike = { packageKey?: PackageKey | null } | null | undefined
type LessonLike = { minPackageKey?: PackageKey | null; isFree?: boolean }

/** An enabled (on-sale) package by key — what checkout may sell. */
export function packageFor(course: CourseLike, key: PackageKey | null): ICoursePackage | null {
  if (!key) return null
  return (course.packages ?? []).find((p) => p.key === key && p.enabled) ?? null
}

/**
 * What an enrollment's package unlocks. The bought package is found by key
 * even if its tier has since been disabled for sale — buyers keep what they
 * paid for. A null packageKey (legacy / free / pre-enrolled), or a package no
 * longer on the course at all → FULL_ACCESS (grandfathered).
 */
export function entitlementsFor(course: CourseLike, enrollment: EnrollmentLike): IPackageEntitlements {
  const key = enrollment?.packageKey ?? null
  const pkg = key ? (course.packages ?? []).find((p) => p.key === key) : undefined
  return pkg ? pkg.entitlements : FULL_ACCESS
}

/**
 * A lesson's tier only gates while the course still sells (has enabled) that
 * tier — a tier switched off in the ladder gates nothing.
 */
export function effectiveLessonTier(course: CourseLike, lesson: LessonLike): PackageKey | null {
  const tier = lesson.minPackageKey ?? null
  return tier && packageFor(course, tier) ? tier : null
}

/** Free-preview lessons, untiered lessons and legacy (null-package) enrollments always open. */
export function canAccessLesson(course: CourseLike, lesson: LessonLike, enrollment: EnrollmentLike): boolean {
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
export function lowestPackageWith(course: CourseLike, flag: keyof IPackageEntitlements): PackageKey | null {
  return PACKAGE_KEYS.find((key) => packageFor(course, key)?.entitlements[flag]) ?? null
}
