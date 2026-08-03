"use server"

import { revalidatePath } from "next/cache"
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
} from "@/lib/db/models"
import { Types } from "mongoose"
import { getCurrentUser } from "@/lib/auth/actions"
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
  | { success: true; data: { enrollmentId: string; alreadyEnrolled?: boolean } }
  | {
      success: false
      error: string
      code?: "auth" | "not_found" | "insufficient_funds" | "wallet_unavailable" | "enroll_failed"
      shortfallMinor?: number
      availableMinor?: number
    }

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
 * Purchase / enroll in a course.
 *
 * The caller supplies only the courseId: identity comes from the session and
 * the price from the course record — nothing money-related is trusted from
 * the client. Paid courses debit the central Worldstreet wallet service
 * server-to-server and enroll ONLY after the wallet confirms the charge.
 * The debit is idempotent (deterministic reference per user+course), so a
 * retried or double-clicked purchase can never charge twice. If the wallet is
 * unreachable we fail closed: no enrollment, no fake success.
 */
export async function purchaseCourse(courseId: string): Promise<PurchaseResult> {
  try {
    await connectDB()

    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: "You need to be signed in to enroll", code: "auth" }
    }

    // Idempotent short-circuit — an existing access-granting enrollment is a
    // success, not an error. A refunded row means this is a RE-purchase: the
    // row is kept for audit, so we reactivate it rather than insert (the
    // {user, course} unique index forbids a second row).
    const existing = await Enrollment.findOne({ user: user.id, course: courseId })
    if (existing && existing.status !== "refunded") {
      return { success: true, data: { enrollmentId: existing._id.toString(), alreadyEnrolled: true } }
    }
    const isRepurchase = Boolean(existing)

    const course = await Course.findOne({ _id: courseId, status: "published" })
    if (!course) {
      return { success: false, error: "Course not found or not available", code: "not_found" }
    }

    const price = course.pricing === "paid" ? course.price ?? 0 : 0
    const amountMinor = Math.round(price * 100)
    const isPaid = amountMinor > 0

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
    const baseReference = `academy_enroll_${user.id}_${courseId}`
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
        authUserId: user.authUserId,
      })

      try {
        const { charge } = await createWalletCharge(user.authUserId, {
          amountMinor,
          description: `Course: ${course.title}`,
          metadata: { courseId: course._id.toString(), courseSlug: course.slug ?? "" },
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
            error: "Your Worldstreet balance doesn't cover this course.",
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
      if (isRepurchase) {
        // Restore the audited row. Progress is deliberately preserved: the
        // student is buying the same course back, not starting over.
        enrollment = await Enrollment.findOneAndUpdate(
          { user: user.id, course: courseId },
          {
            $set: {
              status: "active",
              pricePaid: price,
              currency: "USD",
              transactionId: chargeId,
              purchasedAt: new Date(),
              legacyUnpaid: false,
            },
          },
          { new: true }
        )
        if (!enrollment) throw new Error("re-purchase: enrollment row vanished")
      } else {
        enrollment = await Enrollment.create({
          user: user.id,
          course: courseId,
          pricePaid: price,
          currency: "USD",
          transactionId: chargeId,
          purchasedAt: new Date(),
        })
      }
    } catch (err: unknown) {
      const isDuplicate = typeof err === "object" && err !== null && (err as { code?: number }).code === 11000
      if (isDuplicate) {
        // Raced with another request for the same user+course; the charge is
        // idempotent, so the money side is consistent either way.
        const winner = await Enrollment.findOne({ user: user.id, course: courseId })
        if (winner) {
          if (order) await transitionOrder(order, "enrolled", "concurrent enrollment")
          return { success: true, data: { enrollmentId: winner._id.toString(), alreadyEnrolled: true } }
        }
      }
      // Charged but couldn't enroll — compensate with a refund so no money is kept
      // without access. If the refund also fails, the reconciliation job surfaces it.
      if (isPaid && chargeId) {
        try {
          await refundWalletCharge(user.authUserId, chargeId, "enrollment creation failed")
          if (order) {
            await transitionOrder(order, "refunded", "compensating refund after enroll failure")
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

    // Update course + instructor aggregates
    await Course.findByIdAndUpdate(courseId, { $inc: { enrolledCount: 1 } })
    await User.findByIdAndUpdate(course.instructor, {
      $inc: {
        "instructorProfile.totalStudents": 1,
        "instructorProfile.totalEarnings": isPaid ? (price * INSTRUCTOR_REVENUE_SHARE) : 0,
      },
    })

    revalidatePath("/dashboard/my-courses")
    revalidatePath(`/courses/${courseId}`)

    return { success: true, data: { enrollmentId: enrollment._id.toString() } }
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

    // Add lesson to completed if not already
    const lessonObjectId = new Types.ObjectId(lessonId)
    const lessonIdStr = lessonObjectId.toString()
    const completedIds = enrollment.completedLessons.map((id: Types.ObjectId) => id.toString())
    
    if (!completedIds.includes(lessonIdStr)) {
      enrollment.completedLessons.push(lessonObjectId)
    }

    enrollment.lastAccessedLesson = lessonObjectId
    enrollment.lastAccessedAt = new Date()

    // Calculate progress
    const totalLessons = await Lesson.countDocuments({
      course: courseId,
      isPublished: true,
    })

    enrollment.progress = Math.round(
      (enrollment.completedLessons.length / totalLessons) * 100
    )

    // Check if course is completed — when the course requires a CBT exam,
    // completion (and thus the certificate) waits for a passing attempt.
    if (enrollment.progress >= 100) {
      const gatedCourse = await Course.findById(courseId).select("examRequired").lean()
      if (!gatedCourse?.examRequired || enrollment.examPassed) {
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

    const totalLessons = await Lesson.countDocuments({
      course: courseId,
      isPublished: true,
    })

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
    // them buy the course back.
    const enrollment = await Enrollment.findOne({
      user: userId,
      course: courseId,
      status: { $in: ["active", "completed"] },
    }).select("status lastAccessedLesson")

    if (!enrollment) {
      return { isEnrolled: false }
    }

    return {
      isEnrolled: true,
      status: enrollment.status,
      resumeLessonId: enrollment.lastAccessedLesson?.toString() ?? null,
    }
  } catch (error) {
    console.error("Check enrollment error:", error)
    return { isEnrolled: false }
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
