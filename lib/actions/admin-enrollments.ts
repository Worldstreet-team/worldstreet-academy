"use server"

import { revalidatePath } from "next/cache"
import mongoose from "mongoose"
import connectDB from "@/lib/db"
import { Course, Earning, Enrollment, PaymentEvent, User, type CourseKind, type ICoursePackage, type PackageKey } from "@/lib/db/models"
import type { EnrollmentStatus } from "@/lib/db/models/enrollment"
import { requireAdmin, requireSuperAdmin } from "@/lib/auth/admin"
import { courseAvailability } from "@/lib/types/course"
import type { CourseStatus } from "@/lib/types/course"
import { PACKAGE_RANK, entitlementsFor, isPackageKey, packageFor } from "@/lib/entitlements"
import { getCourseAccess, openPublishedLessonIds } from "@/lib/course-access"
import { cohortsForEnrollments } from "@/lib/cohort-calendar"
import { ensureCertificateId } from "@/lib/certificate-id"
import { ensureCertificateTier } from "@/lib/certificate-standing"
import { courseKindOf } from "@/lib/course-kind"
import { masteryInputsForMany, type MasteryCourseRow, type MasteryEnrollmentRow } from "@/lib/mastery-inputs"
import { masteryView } from "@/lib/mastery-score"

const PAGE_SIZE = 20
const OBJECT_ID = /^[a-f0-9]{24}$/

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
  /** Mastery Score 0–100; null for non-programs, inactive enrollments or while it has no score. */
  mastery: number | null
  /** The learner's cohort (D20); null off active/completed school-program rows. */
  cohortName: string | null
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

/**
 * paymentOf as a Mongo filter (2026-11-12), so a payment filter pages, counts
 * and exports in the query. Null when there is no payment filter.
 */
async function paymentQuery(payment: unknown): Promise<Record<string, unknown> | null> {
  if (payment !== "successful" && payment !== "pending" && payment !== "not_required" && payment !== "refunded") {
    return null
  }
  if (payment === "refunded") return { status: "refunded" }
  const charged = [{ transactionId: { $nin: [null, ""] } }, { pricePaid: { $gt: 0 } }]
  if (payment === "successful") return { status: { $ne: "refunded" }, $or: charged }
  const unpaid = { transactionId: { $in: [null, ""] }, pricePaid: { $not: { $gt: 0 } } }
  // paymentOf reads a course with no pricing as free.
  const freeCourses = await Course.distinct("_id", { pricing: { $in: ["free", null] } })
  if (payment === "pending") {
    return { ...unpaid, status: "pre_enrolled", legacyUnpaid: { $ne: true }, course: { $nin: freeCourses } }
  }
  return {
    ...unpaid,
    status: { $ne: "refunded" },
    $or: [{ legacyUnpaid: true }, { course: { $in: freeCourses } }, { status: { $ne: "pre_enrolled" } }],
  }
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
    // 2026-11-12: only a 24-hex course id reaches the query (an object is read as a Mongo
    // operator; junk threw a CastError, which emptied the list without a word).
    // if (filters?.course) query.course = filters.course
    if (filters?.course) {
      if (typeof filters.course !== "string" || !OBJECT_ID.test(filters.course)) return empty
      query.course = filters.course
    }
    // 2026-11-12: only a literal string reaches the query.
    // if (filters?.status && filters.status !== "all") query.status = filters.status
    if (typeof filters?.status === "string" && filters.status !== "all") query.status = filters.status
    const packageFilter = filters?.package
    if (packageFilter === "none") query.packageKey = null
    else if (isPackageKey(packageFilter)) query.packageKey = packageFilter
    // 2026-11-12: the payment filter runs in the query. Applied after the page was cut, page 2
    // repeated page 1's matches, the total counted every row, and the CSV export (which walks
    // the pages) listed the same enrollments more than once.
    const paymentFilter = await paymentQuery(filters?.payment)
    if (paymentFilter) query.$and = [paymentFilter]

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
        .populate("course", "title pricing status availableAt packages kind format")
        .lean(),
      Enrollment.countDocuments(query),
      filters?.course ? Course.findById(filters.course).select("title").lean() : null,
    ])

    const cohortOf = await cohortsForEnrollments(
      rows.filter((e) => {
        const course = e.course as unknown as { kind?: CourseKind | null } | null
        return (e.status === "active" || e.status === "completed") && course !== null && courseKindOf(course) === "program"
      })
    )

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
        mastery: null,
        cohortName: cohortOf.get(e._id.toString())?.name ?? null,
      }
    })

    if (filters?.payment && filters.payment !== "all") {
      mapped = mapped.filter((m) => m.payment === filters.payment)
    }
    mapped = mapped.slice(0, PAGE_SIZE)

    // Mastery Score for the page's program rows, in one bulk read.
    const rowById = new Map(rows.map((r) => [r._id.toString(), r]))
    const pairs: { enrollment: MasteryEnrollmentRow; course: MasteryCourseRow }[] = []
    for (const m of mapped) {
      const r = rowById.get(m.id)
      const user = r?.user as unknown as { _id?: unknown } | null
      const course = r?.course as unknown as { _id?: unknown; kind?: Parameters<typeof courseKindOf>[0]["kind"]; packages?: ICoursePackage[] | null; format?: MasteryCourseRow["format"] } | null
      if (!r || !user?._id || !course?._id) continue
      if (courseKindOf(course) !== "program" || (r.status !== "active" && r.status !== "completed")) continue
      pairs.push({
        enrollment: { ...r, user: String(user._id), course: String(course._id) },
        course: { _id: String(course._id), packages: course.packages ?? null, format: course.format },
      })
    }
    // A Mastery Score failure leaves every row listed with no score, never an empty table.
    try {
      const facts = await masteryInputsForMany(pairs)
      const scores = new Map<string, number | null>()
      for (const m of mapped) {
        const f = facts.get(m.id)
        if (f) scores.set(m.id, masteryView(f).result.score)
      }
      for (const m of mapped) m.mastery = scores.get(m.id) ?? null
    } catch (masteryError) {
      console.error("Admin enrollments mastery error:", masteryError)
    }

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

/** Prefixed to the note of each pending earning a cancellation reverses, so a restore reopens exactly those. */
const CANCELLED_NOTE = "enrollment cancelled before clearing: "
const CANCELLED_NOTE_RE = new RegExp(`^${CANCELLED_NOTE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)

/**
 * Suspend/cancel/restore one customer's enrollment. Restore returns the
 * record to wherever it was in the lifecycle: activated ones become active,
 * never-activated ones fall back to pre-enrolled.
 *
 * A cancelled purchase earns nothing that hasn't paid out yet (2026-11-08):
 * cancelling reverses the enrollment's pending tutor share and referral
 * commission, and restoring a cancelled enrollment reopens exactly those.
 * Earnings already cleared stay paid; returning money is a refund's job
 * (`refundEnrollment`, which claws back). This is also how a transfer
 * approved in error stops its commission: a transfer has no wallet refund.
 */
export async function adminSetEnrollmentStatus(
  enrollmentId: string,
  action: "suspend" | "cancel" | "restore"
) {
  try {
    await connectDB()
    const admin = await requireAdmin()

    if (typeof enrollmentId !== "string" || !mongoose.isValidObjectId(enrollmentId)) return { success: false, error: "Enrollment not found" }
    const enrollment = await Enrollment.findById(enrollmentId)
    if (!enrollment) return { success: false, error: "Enrollment not found" }
    // Four eyes, as on transfers and paid-learner grants: no admin changes their own seat.
    if (enrollment.user.toString() === admin.id) {
      return { success: false, error: "Another admin has to change your own enrollment" }
    }
    const fromStatus = enrollment.status
    const wasCancelled = enrollment.status === "cancelled"
    // 2026-11-12: a refunded seat belongs to the money trail (Payments). Cancelling or suspending
    // it let "Restore" turn it back into an active seat with the money already returned.
    if (fromStatus === "refunded") {
      return { success: false, error: "This enrollment was refunded, so it can't be changed here" }
    }
    // A cancelled seat is restored before it is suspended: a restore from "suspended" never
    // reopens the earnings the cancellation reversed.
    if (action === "suspend" && wasCancelled) {
      return { success: false, error: "Restore this enrollment first, then suspend it" }
    }
    // …nor reopens a commission that pays them: restoring a cancelled enrollment
    // turns its reversed referral commission back to pending.
    if (
      action === "restore" &&
      wasCancelled &&
      (await Earning.exists({ enrollment: enrollment._id, kind: "referral", instructor: admin.id, status: "reversed", note: CANCELLED_NOTE_RE }))
    ) {
      return { success: false, error: "You referred this learner, so another admin has to restore their enrollment" }
    }

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
    // 2026-11-12: written only while the status is still the one read, so a cancel and a
    // restore sent at once by two admins can't both land (a whole-document save was last-wins).
    // await enrollment.save()
    const written = await Enrollment.updateOne({ _id: enrollment._id, status: fromStatus }, { $set: { status: enrollment.status } })
    if (written.matchedCount === 0) {
      return { success: false, error: "This enrollment changed in the meantime. Reload and try again." }
    }

    if (action === "cancel") {
      const pending = await Earning.find({ enrollment: enrollment._id, kind: { $in: ["sale", "referral"] }, status: "pending" })
      for (const earning of pending) {
        // 2026-11-12: reversed only while still pending. The clearing pass can pay an earning out
        // meanwhile, and a whole-document save overwrote its "cleared" with "reversed", which a
        // restore then reopened as pending: a paid earning owed a second time.
        // earning.status = "reversed"
        // earning.note = `${CANCELLED_NOTE}${earning.note ?? ""}`
        // await earning.save()
        await Earning.updateOne(
          { _id: earning._id, status: "pending" },
          { $set: { status: "reversed", note: `${CANCELLED_NOTE}${earning.note ?? ""}` } }
        )
      }
    } else if (action === "restore" && wasCancelled) {
      const reversed = await Earning.find({ enrollment: enrollment._id, status: "reversed", note: CANCELLED_NOTE_RE })
      for (const earning of reversed) {
        // 2026-11-12: conditional, as above, so two restores at once reopen it once.
        // earning.status = "pending"
        // earning.note = earning.note.replace(CANCELLED_NOTE_RE, "")
        // await earning.save()
        await Earning.updateOne(
          { _id: earning._id, status: "reversed", note: earning.note },
          { $set: { status: "pending", note: earning.note.replace(CANCELLED_NOTE_RE, "") } }
        )
      }
    }

    // A restored completion that was never stamped stores the ID its certificate
    // already prints (the legacy value) — restore never mints a fresh one.
    if (action === "restore") {
      await ensureCertificateId(enrollment, false)
      await ensureCertificateTier(enrollment._id)
    }

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
    // A plan change is access without a WorldStreet payment: super admin only (CTO, 2026-11-08).
    const admin = await requireSuperAdmin()

    if (!mongoose.isValidObjectId(enrollmentId)) return { success: false, error: "Enrollment not found" }
    if (!isPackageKey(packageKey)) return { success: false, error: "Unknown plan" }

    const enrollment = await Enrollment.findById(enrollmentId)
    if (!enrollment) return { success: false, error: "Enrollment not found" }
    // Four eyes: a plan change is access without payment, so never on your own seat.
    if (enrollment.user.toString() === admin.id) {
      return { success: false, error: "Another admin has to change your own plan" }
    }

    // Payment decides the tier of a reservation or a refunded row; only live
    // enrollments can be moved, so the audit trail never goes stale.
    if (enrollment.status !== "active" && enrollment.status !== "completed") {
      return { success: false, error: "Only active or completed enrollments can change plan" }
    }

    const course = await Course.findById(enrollment.course).select("packages examRequired").lean()
    const pkg = course ? packageFor(course, packageKey) : null
    if (!pkg) return { success: false, error: "This course doesn't sell that plan" }

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
        entitlements: entitlementsFor({ packages: current.course.packages, format: current.course.format }, { packageKey: pkg.key }),
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
    // An upgrade can make an existing completion certify: store the ID its
    // certificate prints (the legacy value), never a fresh random one.
    await ensureCertificateId(enrollment, false)
    await ensureCertificateTier(enrollment._id)

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
    if (error instanceof Error && error.message === "Not authorized") {
      return { success: false, error: "Only a super admin can change a learner's plan" }
    }
    console.error("Admin set enrollment package error:", error)
    return { success: false, error: "Failed to change the plan" }
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
      "Plan",
      "Price paid",
      "Enrolled at",
      "Pre-enrolled at",
      "Activated at",
      "Last accessed",
      "Completed at",
      "Progress %",
      "Cohort",
    ]
    // 2026-11-12: names and course titles are typed by people; a leading = + - @ (or a tab or
    // carriage return) would run as a formula when the file is opened in a spreadsheet. Text
    // cells only: numbers are written raw.
    // const quote = (v: string | number | null) =>
    //   `"${String(v ?? "").replace(/"/g, '""')}"`
    const quote = (v: string | number | null) => {
      const text = String(v ?? "")
      const safe = typeof v === "string" && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
      return `"${safe.replace(/"/g, '""')}"`
    }
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
          r.cohortName,
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
