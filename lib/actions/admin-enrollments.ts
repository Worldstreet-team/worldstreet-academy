"use server"

import { revalidatePath } from "next/cache"
import mongoose from "mongoose"
import connectDB from "@/lib/db"
import { Course, Enrollment, PaymentEvent, User, type ICoursePackage, type PackageKey } from "@/lib/db/models"
import type { EnrollmentStatus } from "@/lib/db/models/enrollment"
import { requireAdmin } from "@/lib/auth/admin"
import { courseAvailability } from "@/lib/types/course"
import type { CourseStatus } from "@/lib/types/course"
import { PACKAGE_RANK, entitlementsFor, isPackageKey, packageFor } from "@/lib/entitlements"
import { getCourseAccess, openPublishedLessonIds } from "@/lib/course-access"

const PAGE_SIZE = 20

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Payment state is derived, not stored: the Enrollment records access, the
 * Order records money, and this projection reads them together the way the
 * spec's "payment status" column expects.
 */
export type AdminEnrollmentPayment =
  | "not_required"
  | "pending"
  | "successful"
  | "refunded"

export type AdminEnrollmentRow = {
  id: string
  courseId: string
  courseTitle: string
  coursePricing: string
  courseAvailability: string
  customerName: string
  customerEmail: string
  status: EnrollmentStatus
  payment: AdminEnrollmentPayment
  packageKey: PackageKey | null
  packageName: string | null
  /** Enabled tiers on the course, in ladder order — the choices for "Change package". */
  coursePackages: { key: PackageKey; name: string }[]
  pricePaid: number
  enrolledAt: string
  preEnrolledAt: string | null
  activatedAt: string | null
  startedAt: string | null
  completedAt: string | null
  progress: number
}

function paymentOf(e: {
  status: EnrollmentStatus
  pricePaid: number
  transactionId: string | null
  legacyUnpaid: boolean
  coursePricing: string
}): AdminEnrollmentPayment {
  if (e.status === "refunded") return "refunded"
  if (e.transactionId || e.pricePaid > 0) return "successful"
  if (e.coursePricing === "free" || e.legacyUnpaid) return "not_required"
  // Paid course, no charge yet — pre-enrolled or otherwise awaiting activation.
  return e.status === "pre_enrolled" ? "pending" : "not_required"
}

export async function adminListEnrollments(filters?: {
  course?: string
  status?: string
  payment?: string
  package?: string
  search?: string
  page?: number
}): Promise<{
  enrollments: AdminEnrollmentRow[]
  total: number
  page: number
  pageCount: number
  courseTitle: string | null
}> {
  const empty = { enrollments: [], total: 0, page: 1, pageCount: 1, courseTitle: null }
  try {
    await connectDB()
    await requireAdmin()

    const page = Math.max(1, filters?.page ?? 1)
    const query: Record<string, unknown> = {}
    if (filters?.course) query.course = filters.course
    if (filters?.status && filters.status !== "all") query.status = filters.status
    const packageFilter = filters?.package
    if (packageFilter === "none") query.packageKey = null
    else if (isPackageKey(packageFilter)) query.packageKey = packageFilter

    // Name/email search resolves to user ids first — enrollment stores refs.
    if (filters?.search?.trim()) {
      const rx = new RegExp(escapeRegex(filters.search.trim()), "i")
      const users = await User.find({
        $or: [{ email: rx }, { firstName: rx }, { lastName: rx }, { username: rx }],
      })
        .select("_id")
        .limit(500)
        .lean()
      query.user = { $in: users.map((u) => u._id) }
    }

    const [rows, total, courseDoc] = await Promise.all([
      Enrollment.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE * 3) // payment filter happens post-query; over-fetch, trim below
        .populate("user", "firstName lastName email username")
        .populate("course", "title pricing status availableAt packages")
        .lean(),
      Enrollment.countDocuments(query),
      filters?.course ? Course.findById(filters.course).select("title").lean() : null,
    ])

    let mapped: AdminEnrollmentRow[] = rows.map((e) => {
      const user = e.user as unknown as {
        firstName?: string
        lastName?: string
        email?: string
        username?: string
      } | null
      const course = e.course as unknown as {
        _id: { toString(): string }
        title?: string
        pricing?: string
        status?: string
        availableAt?: Date | null
        packages?: ICoursePackage[] | null
      } | null
      const payment = paymentOf({
        status: e.status,
        pricePaid: e.pricePaid ?? 0,
        transactionId: e.transactionId ?? null,
        legacyUnpaid: e.legacyUnpaid ?? false,
        coursePricing: course?.pricing ?? "free",
      })
      return {
        id: e._id.toString(),
        courseId: course?._id?.toString() ?? "",
        courseTitle: course?.title ?? "(deleted course)",
        coursePricing: course?.pricing ?? "free",
        courseAvailability: course
          ? courseAvailability({
              status: (course.status ?? "draft") as CourseStatus,
              availableAt: course.availableAt ?? null,
            })
          : "archived",
        customerName: user
          ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.username || "Unknown"
          : "Unknown",
        customerEmail: user?.email ?? "",
        status: e.status,
        payment,
        packageKey: e.packageKey ?? null,
        packageName: e.packageName ?? null,
        coursePackages: (course?.packages ?? [])
          .filter((p) => p.enabled)
          .sort((a, b) => PACKAGE_RANK[a.key] - PACKAGE_RANK[b.key])
          .map((p) => ({ key: p.key, name: p.name })),
        pricePaid: e.pricePaid ?? 0,
        enrolledAt: e.createdAt.toISOString(),
        preEnrolledAt: e.preEnrolledAt ? new Date(e.preEnrolledAt).toISOString() : null,
        activatedAt: e.activatedAt ? new Date(e.activatedAt).toISOString() : null,
        startedAt: e.lastAccessedAt ? new Date(e.lastAccessedAt).toISOString() : null,
        completedAt: e.completedAt ? new Date(e.completedAt).toISOString() : null,
        progress: e.progress ?? 0,
      }
    })

    if (filters?.payment && filters.payment !== "all") {
      mapped = mapped.filter((m) => m.payment === filters.payment)
    }
    mapped = mapped.slice(0, PAGE_SIZE)

    return {
      enrollments: mapped,
      total,
      page,
      pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      courseTitle: (courseDoc as { title?: string } | null)?.title ?? null,
    }
  } catch (error) {
    console.error("Admin list enrollments error:", error)
    return empty
  }
}

/**
 * Suspend/cancel/restore one customer's enrollment. Restore returns the
 * record to wherever it was in the lifecycle: activated ones become active,
 * never-activated ones fall back to pre-enrolled.
 */
export async function adminSetEnrollmentStatus(
  enrollmentId: string,
  action: "suspend" | "cancel" | "restore"
) {
  try {
    await connectDB()
    await requireAdmin()

    const enrollment = await Enrollment.findById(enrollmentId)
    if (!enrollment) return { success: false, error: "Enrollment not found" }

    if (action === "suspend") {
      if (enrollment.status === "suspended") return { success: true }
      enrollment.status = "suspended"
    } else if (action === "cancel") {
      if (enrollment.status === "cancelled") return { success: true }
      enrollment.status = "cancelled"
    } else {
      if (enrollment.status !== "suspended" && enrollment.status !== "cancelled") {
        return { success: false, error: "Only suspended or cancelled enrollments can be restored" }
      }
      enrollment.status = enrollment.completedAt
        ? "completed"
        : enrollment.activatedAt || enrollment.transactionId || (enrollment.pricePaid ?? 0) > 0
          ? "active"
          : "pre_enrolled"
    }
    await enrollment.save()

    revalidatePath("/admin/enrollments")
    return { success: true }
  } catch (error) {
    console.error("Admin set enrollment status error:", error)
    return { success: false, error: "Failed to update enrollment" }
  }
}

/**
 * Move one enrollment to another package (D5 — no self-serve upgrades in v1).
 * No money moves: refunds and charges stay in Payments. The change is logged
 * as a `package_changed` PaymentEvent so the payment trail explains why access
 * differs from what was bought. Only enabled tiers on the course are valid —
 * never "no package", which would silently grant full access.
 */
export async function adminSetEnrollmentPackage(
  enrollmentId: string,
  packageKey: PackageKey
): Promise<{ success: boolean; error?: string }> {
  try {
    await connectDB()
    const admin = await requireAdmin()

    if (!mongoose.isValidObjectId(enrollmentId)) return { success: false, error: "Enrollment not found" }
    if (!isPackageKey(packageKey)) return { success: false, error: "Unknown package" }

    const enrollment = await Enrollment.findById(enrollmentId)
    if (!enrollment) return { success: false, error: "Enrollment not found" }

    // Payment decides the tier of a reservation or a refunded row; only live
    // enrollments can be moved, so the audit trail never goes stale.
    if (enrollment.status !== "active" && enrollment.status !== "completed") {
      return { success: false, error: "Only active or completed enrollments can change package" }
    }

    const course = await Course.findById(enrollment.course).select("packages examRequired").lean()
    const pkg = course ? packageFor(course, packageKey) : null
    if (!pkg) return { success: false, error: "This course doesn't sell that package" }

    const from = enrollment.packageKey ?? null
    if (from === pkg.key) return { success: true }

    // Progress and completion follow the NEW package: the same denominator as
    // completeLesson (published lessons the package opens). A completion the
    // new package hasn't earned — lessons it opens still to do, or a final exam
    // it now requires — goes back to active. Never promotes: finishing stays
    // the student's own action. Everything is computed first and written in ONE
    // save, so the package can never move without its completion re-check.
    const progressFrom = enrollment.progress ?? 0
    const statusFrom = enrollment.status
    const current = await getCourseAccess(enrollment.user.toString(), enrollment.course.toString())
    if (current) {
      const next = {
        ...current,
        packageKey: pkg.key,
        packageName: pkg.name,
        entitlements: entitlementsFor({ packages: current.course.packages }, { packageKey: pkg.key }),
      }
      const open = await openPublishedLessonIds(next)
      const done = enrollment.completedLessons.filter((id: { toString(): string }) => open.has(id.toString())).length
      enrollment.progress = open.size > 0 ? Math.min(100, Math.round((done / open.size) * 100)) : 0
      const allDone = open.size > 0 && done === open.size
      const examGates = !!course?.examRequired && next.entitlements.certificate && !enrollment.examPassed
      if (enrollment.status === "completed" && (!allDone || examGates)) {
        enrollment.status = "active"
        enrollment.completedAt = null
      }
    }
    enrollment.packageKey = pkg.key
    enrollment.packageName = pkg.name
    await enrollment.save()

    try {
      await PaymentEvent.create({
        order: null,
        // Deliberately not unique (unlike Order.reference): every change on this enrollment logs its own event.
        reference: `academy_package_${enrollment._id.toString()}`,
        type: "package_changed",
        payload: {
          enrollmentId: enrollment._id.toString(),
          courseId: enrollment.course.toString(),
          from,
          to: pkg.key,
          progress: { from: progressFrom, to: enrollment.progress ?? 0 },
          status: { from: statusFrom, to: enrollment.status },
          adminId: admin.id,
        },
      })
    } catch (err) {
      console.error("[Payments] failed to log package change", err)
    }

    revalidatePath("/admin/enrollments")
    return { success: true }
  } catch (error) {
    console.error("Admin set enrollment package error:", error)
    return { success: false, error: "Failed to change the package" }
  }
}

/** Same filters as the list, no pagination — rows for a CSV download. */
export async function adminExportEnrollments(filters?: {
  course?: string
  status?: string
  payment?: string
  package?: string
  search?: string
}): Promise<{ success: boolean; csv?: string; error?: string }> {
  try {
    await connectDB()
    await requireAdmin()

    // Reuse the list path page by page so the projection logic stays single-source.
    const all: AdminEnrollmentRow[] = []
    for (let page = 1; page <= 50; page++) {
      const { enrollments, pageCount } = await adminListEnrollments({ ...filters, page })
      all.push(...enrollments)
      if (page >= pageCount) break
    }

    const header = [
      "Course",
      "Customer",
      "Email",
      "Enrollment status",
      "Payment status",
      "Package",
      "Price paid",
      "Enrolled at",
      "Pre-enrolled at",
      "Activated at",
      "Last accessed",
      "Completed at",
      "Progress %",
    ]
    const quote = (v: string | number | null) =>
      `"${String(v ?? "").replace(/"/g, '""')}"`
    const csv = [
      header.map(quote).join(","),
      ...all.map((r) =>
        [
          r.courseTitle,
          r.customerName,
          r.customerEmail,
          r.status,
          r.payment,
          r.packageName,
          r.pricePaid,
          r.enrolledAt,
          r.preEnrolledAt,
          r.activatedAt,
          r.startedAt,
          r.completedAt,
          r.progress,
        ]
          .map(quote)
          .join(","),
      ),
    ].join("\n")

    return { success: true, csv }
  } catch (error) {
    console.error("Admin export enrollments error:", error)
    return { success: false, error: "Failed to export enrollments" }
  }
}
