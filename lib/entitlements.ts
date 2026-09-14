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

// Optional: a .lean()/projected read of a legacy course predates this field
// and returns no `packages` key at all — Mongoose only materialises the `[]`
// default when it hydrates a document.
type CourseLike = { packages?: ICoursePackage[] | null }
type EnrollmentLike = { packageKey: PackageKey | null } | null | undefined
type LessonLike = { minPackageKey: PackageKey | null }

export function packageFor(course: CourseLike, key: PackageKey | null): ICoursePackage | null {
  if (!key) return null
  return (course.packages ?? []).find((p) => p.key === key && p.enabled) ?? null
}

/** null packageKey → FULL_ACCESS (grandfathered); a package → its switches. */
export function entitlementsFor(course: CourseLike, enrollment: EnrollmentLike): IPackageEntitlements {
  const pkg = packageFor(course, enrollment?.packageKey ?? null)
  return pkg ? pkg.entitlements : FULL_ACCESS
}

export function canAccessLesson(lesson: LessonLike, enrollment: EnrollmentLike): boolean {
  if (!lesson.minPackageKey) return true
  const key = enrollment?.packageKey ?? null
  if (!key) return true
  return PACKAGE_RANK[key] >= PACKAGE_RANK[lesson.minPackageKey]
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
