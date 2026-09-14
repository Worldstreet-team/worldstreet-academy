"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod/v4"
import connectDB from "@/lib/db"
import {
  Course,
  Enrollment,
  User,
  Lesson,
  Order,
  PaymentEvent,
  Earning,
  INSTRUCTOR_REVENUE_SHARE,
  EARNINGS_CLEARING_DAYS,
  type IOrder,
  type OrderStatus,
  type PackageKey,
} from "@/lib/db/models"
import { Types } from "mongoose"
import { getCurrentUser } from "@/lib/auth/actions"
import { courseAvailability } from "@/lib/types/course"
import { sendEnrollmentConfirmationEmail } from "@/lib/email"
import { notifyAdmins, notifyUser } from "@/lib/notify"
import { getCourseAccess, isLessonLockedFor, lockedLessonIds } from "@/lib/course-access"
import { PACKAGE_KEYS, canAccessLesson, packageFor, sellsPackages } from "@/lib/entitlements"
import {
  createWalletCharge,
  refundWalletCharge,
  isInsufficientBalance,
  walletEnabled,
  WalletError,
} from "@/lib/wallet"

// ============================================================================
// TYPES
// ============================================================================

export type EnrollmentWithCourse = {
  id: string
  courseId: string
  courseTitle: string
  courseThumbnail: string | null
  instructorName: string
  progress: number
  completedLessons: string[]
  lastAccessedAt: string
  status: string
}

export type EnrollmentProgress = {
  progress: number
  completedLessons: string[]
  totalLessons: number
  lastAccessedLesson: string | null
}

// ============================================================================
// ENROLLMENT ACTIONS
// ============================================================================

export type PurchaseResult =
  | { success: true; data: { enrollmentId: string; alreadyEnrolled?: boolean; packageName: string | null } }
  | {
      success: false
      error: string
      code?:
        | "auth"
        | "invalid"
        | "not_found"
        | "not_live"
        | "package_required"
        | "insufficient_funds"
        | "wallet_unavailable"
        | "enroll_failed"
      shortfallMinor?: number
      availableMinor?: number
    }

const PurchaseInput = z.object({
  courseId: z.string().regex(/^[a-f0-9]{24}$/),
  packageKey: z.enum(PACKAGE_KEYS).optional(),
})

async function transitionOrder(order: IOrder, status: OrderStatus, note?: string) {
  order.status = status
  order.history.push({ status, at: new Date(), ...(note ? { note } : {}) })
  await order.save()
}

async function logPaymentEvent(
  orderId: Types.ObjectId | null,
  reference: string,
  type: string,
  payload: Record<string, unknown>
) {
  try {
    await PaymentEvent.create({ order: orderId, reference, type, payload })
  } catch (err) {
    console.error("[Payments] failed to log payment event", type, err)
  }
}

/**
 * Purchase / enroll in a course, in one of its packages when it sells them.
 *
 * The caller supplies only the course and the package key: identity comes
 * from the session and the price from the course record (the chosen enabled
 * package's price, or the single course price when the course sells no
 * packages) — nothing money-related is trusted from the client. Paid purchases
 * debit the central Worldstreet wallet server-to-server and enroll ONLY after
 * the wallet confirms the charge. The debit is idempotent (deterministic
 * reference per user + course + package + purchase generation), so a retried
 * or double-clicked purchase can never charge twice. If the wallet is
 * unreachable we fail closed: no enrollment, no fake success.
 */
export async function purchaseCourse(input: { courseId: string; packageKey?: PackageKey }): Promise<PurchaseResult> {
  try {
    await connectDB()

    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: "You need to be signed in to enroll", code: "auth" }
    }

    const parsed = PurchaseInput.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: "That checkout link isn't valid", code: "invalid" }
    }
    const { courseId, packageKey } = parsed.data

    // Idempotent short-circuit — an existing access-granting enrollment is a
    // success, not an error. A refunded row means this is a RE-purchase: the
    // row is kept for audit, so we reactivate it rather than insert (the
    // {user, course} unique index forbids a second row).
    const existing = await Enrollment.findOne({ user: user.id, course: courseId })
    // A pre-enrolled row is a reservation, not access: purchase ACTIVATES it.
    const isActivation = existing?.status === "pre_enrolled"
    if (existing && existing.status !== "refunded" && !isActivation) {
      return {
        success: true,
        data: {
          enrollmentId: existing._id.toString(),
          alreadyEnrolled: true,
          packageName: existing.packageName ?? null,
        },
      }
    }
    const isRepurchase = Boolean(existing) && !isActivation

    const course = await Course.findOne({ _id: courseId, status: "published" })
    if (!course) {
      return { success: false, error: "Course not found or not available", code: "not_found" }
    }

    // Scheduled courses take money only once they are live — before that the
    // only door is preEnrollCourse, which never charges.
    if (courseAvailability(course) === "coming_soon") {
      return {
        success: false,
        error: "This course isn't live yet. You can enroll now and pay when it launches.",
        code: "not_live",
      }
    }

    // Which package is being bought. A course that sells packages takes money
    // only for an enabled tier the buyer chose. A course with no enabled
    // package sells at its single price and ignores any key — the program page
    // links its synthesized "Full program" tier as package=standard.
    const packaged = sellsPackages(course)
    const pkg = packaged ? packageFor(course, packageKey ?? null) : null
    if (packaged && !pkg) {
      return { success: false, error: "Choose a package to continue", code: "package_required" }
    }

    const price = pkg ? pkg.price : course.pricing === "paid" ? course.price ?? 0 : 0
    const amountMinor = Math.round(price * 100)
    const isPaid = amountMinor > 0
    const packageFields = { packageKey: pkg?.key ?? null, packageName: pkg?.name ?? null }

    // The charge reference is deterministic per PURCHASE GENERATION, not per
    // user+course. Within one generation, retries and double-clicks replay the
    // same charge (never a second debit). But a re-purchase after a refund must
    // get a fresh reference: the wallet replays a stored idempotent response for
    // 24h, so reusing the old key would hand back the already-refunded charge
    // and the student would get the course without paying again.
    const generation = await Order.countDocuments({
      user: user.id,
      course: courseId,
      status: "refunded",
    })
    // Package purchases carry the key; single-price references stay
    // byte-identical to pre-package orders so their retries still replay.
    const baseReference = `academy_enroll_${user.id}_${courseId}${pkg ? `_${pkg.key}` : ""}`
    const reference = generation > 0 ? `${baseReference}_r${generation}` : baseReference

    let chargeId: string | null = null
    let order: IOrder | null = null

    if (isPaid) {
      if (!walletEnabled()) {
        // Never enroll a paid course without a confirmed debit.
        return {
          success: false,
          error: "Payments are temporarily unavailable. Please try again later.",
          code: "wallet_unavailable",
        }
      }

      const ord = await Order.findOneAndUpdate(
        { reference },
        {
          $setOnInsert: {
            user: user.id,
            authUserId: user.authUserId,
            course: courseId,
            reference,
            amountMinor,
            currency: "USD",
            packageKey: packageFields.packageKey,
            status: "pending",
            history: [{ status: "pending", at: new Date() }],
          },
        },
        { upsert: true, new: true }
      )
      if (!ord) {
        return { success: false, error: "Failed to open an order", code: "enroll_failed" }
      }
      order = ord

      await transitionOrder(ord, "payment_requested")
      await logPaymentEvent(ord._id, reference, "charge_requested", {
        amountMinor,
        courseId,
        packageKey: packageFields.packageKey,
        authUserId: user.authUserId,
      })

      try {
        const { charge } = await createWalletCharge(user.authUserId, {
          amountMinor,
          description: pkg ? `Course: ${course.title} — ${pkg.name}` : `Course: ${course.title}`,
          metadata: {
            courseId: course._id.toString(),
            courseSlug: course.slug ?? "",
            ...(packageFields.packageKey ? { packageKey: packageFields.packageKey } : {}),
          },
          idempotencyKey: reference,
        })
        chargeId = charge.id
        ord.chargeId = charge.id
        await transitionOrder(ord, "paid")
        await logPaymentEvent(ord._id, reference, "charge_confirmed", {
          chargeId: charge.id,
          amountMinor: charge.amountMinor,
        })
      } catch (err) {
        if (isInsufficientBalance(err)) {
          const details = err.details as { availableMinor?: number }
          const availableMinor = typeof details.availableMinor === "number" ? details.availableMinor : 0
          ord.failureCode = "insufficient_funds"
          await transitionOrder(ord, "failed", "insufficient funds")
          await logPaymentEvent(ord._id, reference, "charge_failed", {
            code: "INSUFFICIENT_BALANCE",
            availableMinor,
          })
          return {
            success: false,
            error: "Your Worldstreet balance doesn't cover this purchase.",
            code: "insufficient_funds",
            availableMinor,
            shortfallMinor: Math.max(0, amountMinor - availableMinor),
          }
        }
        const code = err instanceof WalletError ? err.code : "WALLET_ERROR"
        ord.failureCode = code
        await transitionOrder(ord, "failed", code)
        await logPaymentEvent(ord._id, reference, "charge_failed", {
          code,
          message: err instanceof Error ? err.message : String(err),
        })
        console.error("[Payments] wallet charge failed:", err)
        return {
          success: false,
          error: "We couldn't reach the payment service. You have not been charged.",
          code: "wallet_unavailable",
        }
      }
    }

    // Create (or reactivate) the enrollment — access unlocks here and never
    // before payment.
    let enrollment
    try {
      if (isRepurchase || isActivation) {
        // Restore (re-purchase) or activate (pre-enrollment) the audited row.
        // Progress is deliberately preserved either way. The filter pins the
        // status we read, so a concurrent purchase that already took the row
        // is detected below instead of silently overwritten.
        enrollment = await Enrollment.findOneAndUpdate(
          { user: user.id, course: courseId, status: isActivation ? "pre_enrolled" : "refunded" },
          {
            $set: {
              status: "active",
              pricePaid: price,
              currency: "USD",
              transactionId: chargeId,
              purchasedAt: new Date(),
              activatedAt: new Date(),
              legacyUnpaid: false,
              ...packageFields,
            },
          },
          { new: true }
        )
        if (!enrollment) {
          throw Object.assign(new Error("enrollment row changed concurrently"), { code: 11000 })
        }
      } else {
        enrollment = await Enrollment.create({
          user: user.id,
          course: courseId,
          pricePaid: price,
          currency: "USD",
          transactionId: chargeId,
          purchasedAt: new Date(),
          activatedAt: new Date(),
          ...packageFields,
        })
      }
    } catch (err: unknown) {
      // Whatever went wrong, first ask whether an access-granting row already
      // holds THIS request's charge — a same-reference sibling, or our own
      // write, may have committed even though this call errored. Refunding that
      // charge would leave access on a refunded debit.
      const winner = await Enrollment.findOne({
        user: user.id,
        course: courseId,
        status: { $in: ["active", "completed"] },
      }).catch(() => null)
      // Raced with another request for the same user+course. Same package →
      // same reference → the wallet replayed ONE charge, so the winner holds our
      // charge (or nobody charged) and there is nothing to undo.
      if (winner && (!chargeId || winner.transactionId === chargeId)) {
        if (order) await transitionOrder(order, "enrolled", "concurrent enrollment")
        return {
          success: true,
          data: { enrollmentId: winner._id.toString(), alreadyEnrolled: true, packageName: winner.packageName ?? null },
        }
      }
      // Charged, but THIS charge bought no access (enrollment failed, or a
      // concurrent purchase of a different package took the row) — refund so no
      // money is kept without access. If the refund also fails, the
      // reconciliation job surfaces it.
      if (isPaid && chargeId) {
        try {
          await refundWalletCharge(
            user.authUserId,
            chargeId,
            winner ? "lost a concurrent purchase" : "enrollment creation failed"
          )
          if (order) {
            await transitionOrder(
              order,
              "refunded",
              winner
                ? "compensating refund — a concurrent purchase took the enrollment"
                : "compensating refund after enroll failure"
            )
            await logPaymentEvent(order._id, reference, "charge_refunded", { chargeId })
          }
        } catch (refundErr) {
          console.error("[Payments] ORPHANED CHARGE — refund failed, needs reconciliation:", chargeId, refundErr)
          if (order) {
            await transitionOrder(order, "failed", "enroll failed AND refund failed — orphaned charge")
            await logPaymentEvent(order._id, reference, "refund_failed", { chargeId })
          }
        }
      }
      if (winner) {
        return {
          success: true,
          data: { enrollmentId: winner._id.toString(), alreadyEnrolled: true, packageName: winner.packageName ?? null },
        }
      }
      console.error("Enroll in course error:", err)
      return { success: false, error: "Failed to enroll in course", code: "enroll_failed" }
    }

    if (order) await transitionOrder(order, "enrolled")

    // Instructor earnings: ledger row stays pending through the clearing
    // window, then clears into their central wallet balance.
    if (isPaid) {
      const feeMinor = Math.round(amountMinor * (1 - INSTRUCTOR_REVENUE_SHARE))
      const netMinor = amountMinor - feeMinor
      const instructor = await User.findById(course.instructor).select("authUserId")
      if (instructor?.authUserId) {
        try {
          await Earning.create({
            enrollment: enrollment._id,
            order: order?._id ?? null,
            course: course._id,
            instructor: course.instructor,
            instructorAuthUserId: instructor.authUserId,
            student: user.id,
            kind: "sale",
            grossMinor: amountMinor,
            feeMinor,
            netMinor,
            currency: "USD",
            status: "pending",
            availableAt: new Date(Date.now() + EARNINGS_CLEARING_DAYS * 24 * 60 * 60 * 1000),
            // Same generation suffix as the charge: a re-purchase is a new sale
            // and must earn again, but the enrollment id is unchanged so the
            // bare reference would collide with the original (refunded) sale.
            creditReference:
              generation > 0
                ? `academy_earn_${enrollment._id.toString()}_r${generation}`
                : `academy_earn_${enrollment._id.toString()}`,
            chargeId,
          })
        } catch (err) {
          console.error("[Earnings] failed to record sale earning:", err)
        }
      }
    }

    // Update course + instructor aggregates. Pre-enrollment already counted
    // this student, so activation only moves money aggregates.
    if (!isActivation) {
      await Course.findByIdAndUpdate(courseId, { $inc: { enrolledCount: 1 } })
    }
    await User.findByIdAndUpdate(course.instructor, {
      $inc: {
        ...(isActivation ? {} : { "instructorProfile.totalStudents": 1 }),
        "instructorProfile.totalEarnings": isPaid ? (price * INSTRUCTOR_REVENUE_SHARE) : 0,
      },
    })

    // Executive (D4): the instructor and admins schedule onboarding; the
    // buyer's intake form waits on the success page. Keyed on the Executive
    // tier — single "Full program" tiers also carry mentorship: true.
    if (pkg?.key === "executive" && pkg.entitlements.mentorship) {
      const buyer = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email
      const note = {
        type: "course" as const,
        title: `New ${pkg.name} enrollment`,
        body: `${buyer} enrolled in ${course.title} — schedule their onboarding.`,
      }
      void notifyUser(course.instructor.toString(), { ...note, href: `/instructor/courses/${courseId}` })
      void notifyAdmins({ ...note, href: `/admin/enrollments?course=${courseId}` })
    }

    void sendEnrollmentConfirmationEmail({
      to: user.email ?? "",
      firstName: user.firstName ?? "",
      courseTitle: course.title,
      courseId: course._id.toString(),
      availableAtIso: null,
      isPaid,
      price,
      packageName: packageFields.packageName,
    })

    revalidatePath("/dashboard/my-courses")
    revalidatePath(`/courses/${courseId}`)

    return {
      success: true,
      data: { enrollmentId: enrollment._id.toString(), packageName: packageFields.packageName },
    }
  } catch (error) {
    console.error("Enroll in course error:", error)
    return { success: false, error: "Failed to enroll in course", code: "enroll_failed" }
  }
}

/**
 * Mark a lesson as completed
 */
export async function completeLesson(
  userId: string,
  courseId: string,
  lessonId: string
) {
  try {
    await connectDB()

    const enrollment = await Enrollment.findOne({
      user: userId,
      course: courseId,
      status: { $in: ["active", "completed"] },
    })

    if (!enrollment) {
      return { success: false, error: "Not enrolled in this course" }
    }

    const access = await getCourseAccess(userId, courseId)
    const locked = await lockedLessonIds(access)
    if (locked.has(lessonId)) {
      return { success: false, error: "This lesson isn't included in your package", code: "package_locked" as const }
    }

    // Add lesson to completed if not already
    const lessonObjectId = new Types.ObjectId(lessonId)
    const lessonIdStr = lessonObjectId.toString()
    const completedIds = enrollment.completedLessons.map((id: Types.ObjectId) => id.toString())

    if (!completedIds.includes(lessonIdStr)) {
      enrollment.completedLessons.push(lessonObjectId)
    }

    enrollment.lastAccessedLesson = lessonObjectId
    enrollment.lastAccessedAt = new Date()

    // Progress counts only published lessons this package opens.
    const publishedIds = (await Lesson.find({ course: courseId, isPublished: true }).select("_id").lean()).map(
      (l) => l._id.toString()
    )
    const open = new Set(publishedIds.filter((id) => !locked.has(id)))
    const done = enrollment.completedLessons.filter((id: Types.ObjectId) => open.has(id.toString())).length
    enrollment.progress = open.size > 0 ? Math.min(100, Math.round((done / open.size) * 100)) : 0

    // Check if course is completed — when the course requires a CBT exam,
    // completion (and thus the certificate) waits for a passing attempt, unless
    // the package has no assessment & certificate.
    if (enrollment.progress >= 100) {
      const gatedCourse = await Course.findById(courseId).select("examRequired").lean()
      const examGates = !!gatedCourse?.examRequired && (access?.entitlements.certificate ?? true)
      if (!examGates || enrollment.examPassed) {
        enrollment.status = "completed"
        enrollment.completedAt = new Date()
      }
    }

    await enrollment.save()

    revalidatePath(`/courses/${courseId}/learn/${lessonId}`)
    revalidatePath("/dashboard/my-courses")

    return {
      success: true,
      data: {
        progress: enrollment.progress,
        isCompleted: enrollment.status === "completed",
      },
    }
  } catch (error) {
    console.error("Complete lesson error:", error)
    return { success: false, error: "Failed to update progress" }
  }
}

/**
 * Update last accessed lesson (for resume functionality)
 */
export async function updateLastAccessed(
  userId: string,
  courseId: string,
  lessonId: string
) {
  try {
    await connectDB()

    // A lesson outside the student's package is never "where they left off".
    if (await isLessonLockedFor(userId, lessonId)) {
      return { success: false, error: "This lesson isn't included in your package" }
    }

    await Enrollment.findOneAndUpdate(
      { user: userId, course: courseId },
      {
        lastAccessedLesson: lessonId,
        lastAccessedAt: new Date(),
      }
    )

    return { success: true }
  } catch (error) {
    console.error("Update last accessed error:", error)
    return { success: false, error: "Failed to update" }
  }
}

// ============================================================================
// ENROLLMENT QUERIES
// ============================================================================

/**
 * Get user's enrollments (my courses)
 */
export async function getUserEnrollments(
  userId: string,
  status?: "active" | "completed" | "all"
): Promise<EnrollmentWithCourse[]> {
  try {
    await connectDB()

    // "all" means all of the user's LIVE courses — a refunded purchase is not
    // one of them (the row is retained only for the payment audit trail).
    const query: Record<string, unknown> = { user: userId }
    if (status && status !== "all") {
      query.status = status
    } else {
      query.status = { $in: ["active", "completed", "expired"] }
    }

    const enrollments = await Enrollment.find(query)
      .populate({
        path: "course",
        select: "title slug thumbnailUrl instructor",
        populate: {
          path: "instructor",
          select: "firstName lastName",
        },
      })
      .sort({ lastAccessedAt: -1 })
      .lean()

    return enrollments.map((enrollment) => {
      const course = enrollment.course as unknown as {
        _id: { toString(): string }
        title: string
        slug: string
        thumbnailUrl: string
        instructor: { firstName: string; lastName: string }
      }

      return {
        id: enrollment._id.toString(),
        courseId: course._id.toString(),
        courseTitle: course.title,
        courseThumbnail: course.thumbnailUrl,
        instructorName: `${course.instructor.firstName} ${course.instructor.lastName}`,
        progress: enrollment.progress,
        completedLessons: enrollment.completedLessons.map((id: Types.ObjectId) => id.toString()),
        lastAccessedAt: enrollment.lastAccessedAt?.toISOString() || new Date().toISOString(),
        status: enrollment.status,
      }
    })
  } catch (error) {
    console.error("Get user enrollments error:", error)
    return []
  }
}

/**
 * Get enrollment details with progress
 */
export async function getEnrollmentProgress(
  userId: string,
  courseId: string
): Promise<EnrollmentProgress | null> {
  try {
    await connectDB()

    const enrollment = await Enrollment.findOne({
      user: userId,
      course: courseId,
    }).lean()

    if (!enrollment) {
      return null
    }

    // Only the published lessons this package opens count toward the total.
    const locked = await lockedLessonIds(await getCourseAccess(userId, courseId))
    const totalLessons = (await Lesson.find({ course: courseId, isPublished: true }).select("_id").lean()).filter(
      (l) => !locked.has(l._id.toString())
    ).length

    return {
      progress: enrollment.progress,
      completedLessons: enrollment.completedLessons.map((id: Types.ObjectId) => id.toString()),
      totalLessons,
      lastAccessedLesson: enrollment.lastAccessedLesson?.toString() || null,
    }
  } catch (error) {
    console.error("Get enrollment progress error:", error)
    return null
  }
}

/**
 * Check if user is enrolled in a course
 */
export async function checkEnrollment(
  userId: string,
  courseId: string
): Promise<{ isEnrolled: boolean; status?: string; resumeLessonId?: string | null }> {
  try {
    await connectDB()

    // Access-granting statuses only: a refunded/expired row still exists (kept
    // for audit) but must read as "not enrolled", or the course page would
    // offer "Continue learning" into content the server will refuse, and
    // checkout would bounce the user to the success screen instead of letting
    // them buy the course back. pre_enrolled is surfaced via `status` with
    // isEnrolled false — a reservation, not access — so course pages can show
    // "Enrolled · starts …" without unlocking anything.
    const enrollment = await Enrollment.findOne({
      user: userId,
      course: courseId,
      status: { $in: ["active", "completed", "pre_enrolled"] },
    }).select("status lastAccessedLesson")

    if (!enrollment) {
      return { isEnrolled: false }
    }

    return {
      isEnrolled: enrollment.status !== "pre_enrolled",
      status: enrollment.status,
      resumeLessonId: enrollment.lastAccessedLesson?.toString() ?? null,
    }
  } catch (error) {
    console.error("Check enrollment error:", error)
    return { isEnrolled: false }
  }
}

export type PreEnrollResult =
  | { success: true; data: { enrollmentId: string; alreadyEnrolled?: boolean } }
  | { success: false; error: string; code?: "auth" | "not_found" | "not_open" | "already_live" }

/**
 * Reserve a seat on a scheduled course before it goes live. Never charges:
 * the record is a reservation (status "pre_enrolled") that purchaseCourse
 * later activates — payment happens there, once the course is live.
 */
export async function preEnrollCourse(courseId: string): Promise<PreEnrollResult> {
  try {
    await connectDB()

    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: "You need to be signed in to enroll", code: "auth" }
    }

    const course = await Course.findOne({ _id: courseId, status: "published" })
    if (!course) {
      return { success: false, error: "Course not found or not available", code: "not_found" }
    }
    if (courseAvailability(course) !== "coming_soon") {
      // The course went live between render and click — the normal purchase
      // flow is the right door now.
      return { success: false, error: "This course is already live", code: "already_live" }
    }
    if (!course.preEnrollEnabled) {
      return { success: false, error: "Pre-launch enrollment isn't open for this course", code: "not_open" }
    }

    const existing = await Enrollment.findOne({ user: user.id, course: courseId })
    if (existing && !["refunded", "cancelled"].includes(existing.status)) {
      return { success: true, data: { enrollmentId: existing._id.toString(), alreadyEnrolled: true } }
    }

    let enrollment
    if (existing) {
      // A refunded/cancelled row coming back as a reservation keeps its audit
      // trail; activation will restamp the money fields.
      enrollment = await Enrollment.findOneAndUpdate(
        { user: user.id, course: courseId },
        {
          $set: {
            status: "pre_enrolled",
            preEnrolledAt: new Date(),
            pricePaid: 0,
            transactionId: null,
          },
        },
        { new: true }
      )
      if (!enrollment) throw new Error("pre-enroll: enrollment row vanished")
    } else {
      try {
        enrollment = await Enrollment.create({
          user: user.id,
          course: courseId,
          status: "pre_enrolled",
          preEnrolledAt: new Date(),
          pricePaid: 0,
        })
      } catch (err: unknown) {
        const isDuplicate =
          typeof err === "object" && err !== null && (err as { code?: number }).code === 11000
        if (!isDuplicate) throw err
        const winner = await Enrollment.findOne({ user: user.id, course: courseId })
        if (!winner) throw err
        return { success: true, data: { enrollmentId: winner._id.toString(), alreadyEnrolled: true } }
      }
      await Course.findByIdAndUpdate(courseId, { $inc: { enrolledCount: 1 } })
      await User.findByIdAndUpdate(course.instructor, {
        $inc: { "instructorProfile.totalStudents": 1 },
      })
    }

    const availableAtIso = course.availableAt ? course.availableAt.toISOString() : null
    void sendEnrollmentConfirmationEmail({
      to: user.email ?? "",
      firstName: user.firstName ?? "",
      courseTitle: course.title,
      courseId: course._id.toString(),
      availableAtIso,
      isPaid: course.pricing === "paid",
      price: course.price ?? 0,
      packageName: null,
    })

    revalidatePath("/dashboard/my-courses")
    revalidatePath(`/courses/${courseId}`)

    return { success: true, data: { enrollmentId: enrollment._id.toString() } }
  } catch (error) {
    console.error("Pre-enroll error:", error)
    return { success: false, error: "Failed to enroll in course" }
  }
}

/**
 * Get course students (for instructor)
 */
export async function getCourseStudents(
  courseId: string,
  instructorId: string
) {
  try {
    await connectDB()

    // Verify course ownership
    const course = await Course.findOne({
      _id: courseId,
      instructor: instructorId,
    })

    if (!course) {
      return { success: false, error: "Course not found or unauthorized" }
    }

    const enrollments = await Enrollment.find({ course: courseId })
      .populate("user", "firstName lastName email")
      .sort({ purchasedAt: -1 })
      .lean()

    return {
      success: true,
      data: enrollments.map((e) => {
        const user = e.user as unknown as {
          _id: { toString(): string }
          firstName: string
          lastName: string
          email: string
        }

        return {
          id: e._id.toString(),
          userId: user._id.toString(),
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          progress: e.progress,
          status: e.status,
          enrolledAt: e.purchasedAt.toISOString(),
          completedAt: e.completedAt?.toISOString() || null,
        }
      }),
    }
  } catch (error) {
    console.error("Get course students error:", error)
    return { success: false, error: "Failed to get students" }
  }
}

// ============================================================================
// CHECKOUT CONFIRMATION (spec §12, §17 "Enrollment confirmed")
// ============================================================================

export type CheckoutConfirmation = {
  courseId: string
  courseTitle: string
  packageName: string | null
  /** First lesson this package opens — "Start learning" lands there; null when the course has none. */
  startLessonId: string | null
  /** Executive buyers who haven't sent their onboarding intake yet (D4). */
  needsIntake: boolean
  /** Executive buyers whose intake is already with their mentor. */
  intakeSent: boolean
}

/** What the success page confirms. null when the caller has no access-granting enrollment on the course. */
export async function getCheckoutConfirmation(courseId: string): Promise<CheckoutConfirmation | null> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return null

    const access = await getCourseAccess(user.id, courseId)
    if (!access) return null

    const [course, enrollment, lessons] = await Promise.all([
      Course.findById(courseId).select("title").lean(),
      Enrollment.findById(access.enrollmentId).select("mentorshipIntake").lean(),
      Lesson.find({ course: courseId }).sort({ order: 1 }).select("_id minPackageKey isFree").lean(),
    ])
    if (!course) return null

    const start = lessons.find((lesson) => canAccessLesson(access.course, lesson, access))
    const executive = access.packageKey === "executive" && access.entitlements.mentorship
    return {
      courseId,
      courseTitle: course.title,
      packageName: access.packageName,
      startLessonId: start ? start._id.toString() : null,
      needsIntake: executive && !enrollment?.mentorshipIntake,
      intakeSent: executive && Boolean(enrollment?.mentorshipIntake),
    }
  } catch (error) {
    console.error("Get checkout confirmation error:", error)
    return null
  }
}

const IntakeInput = z.object({
  goals: z.string().trim().min(10, "Tell your mentor a little more about your goals").max(2000, "Keep your goals under 2,000 characters"),
  availability: z.string().trim().min(2, "Share when you're usually available").max(500, "Keep availability under 500 characters"),
})

/**
 * One-time Executive onboarding intake (D4). Goals and availability are stored
 * on the enrollment and sent to the instructor, who schedules onboarding —
 * session booking itself is Phase 7.
 */
export async function submitMentorshipIntake(
  courseId: string,
  input: { goals: string; availability: string }
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "You need to be signed in" }

    const access = await getCourseAccess(user.id, courseId)
    if (!access || access.packageKey !== "executive" || !access.entitlements.mentorship) {
      return { success: false, error: "Your package doesn't include mentorship" }
    }

    const parsed = IntakeInput.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again" }
    }

    // The filter only matches an enrollment without an intake: one-time, race-safe.
    const updated = await Enrollment.findOneAndUpdate(
      { _id: access.enrollmentId, mentorshipIntake: null },
      { $set: { mentorshipIntake: { ...parsed.data, submittedAt: new Date() } } },
      { new: true }
    )
    if (!updated) return { success: false, error: "You've already sent your intake" }

    const buyer = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email
    void notifyUser(access.course.instructorId, {
      type: "course",
      title: "Executive intake received",
      body: `${buyer}: ${parsed.data.goals}`.slice(0, 500),
      href: `/instructor/courses/${courseId}`,
    })

    revalidatePath("/dashboard/checkout/success")
    return { success: true }
  } catch (error) {
    console.error("Submit mentorship intake error:", error)
    return { success: false, error: "Couldn't send your intake — try again" }
  }
}
