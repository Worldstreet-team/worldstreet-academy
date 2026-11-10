import "server-only"

import { Types } from "mongoose"
import connectDB from "@/lib/db"
import { AccessGrant, Course, Enrollment, Order, PaymentEvent, User, type IOrder, type OrderStatus } from "@/lib/db/models"
import { notifyAdmins, notifyUser } from "@/lib/notify"
import { sendEnrollmentConfirmationEmail } from "@/lib/email"
import { sendWelcomeOnce } from "@/lib/welcome-email"
import { transferLabel } from "@/lib/payment-channels"

/*
 * Learners who paid outside the platform (team voice note, 2026-11-06). An
 * admin records the payment (lib/actions/admin-access-grants.ts); this module
 * opens it onto the learner's account, from the admin's action when the
 * account exists, else on the learner's first sign-in (lib/auth/sync.ts, and
 * the dashboard gate as a retry). Opening mirrors a transfer approval
 * (adminApproveEspeePayment): an Order that records how the money moved, the
 * Enrollment, the counts and the learner's notices. No wallet charge, no
 * instructor Earning and no partner commission: the platform never took this
 * payment. Never call revalidatePath here — the sign-in path runs during a
 * render.
 */

const OPENING_STALE_MS = 2 * 60 * 1000

export function grantReference(grantId: string): string {
  return `academy_grant_${grantId}`
}

export function normalizeGrantEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase()
}

export type OpenGrantResult =
  | { ok: true; enrollmentId: string; alreadyHadAccess: boolean }
  | { ok: false; message: string }

type OpenOptions = {
  /** How it opened, for the Order's history: "by Ada Admin", "when the learner signed in". */
  how: string
  /** Wait for the learner's emails (the admin's list add paces them); otherwise fire-and-forget. */
  awaitEmails?: boolean
}

async function transitionOrder(order: IOrder, status: OrderStatus, note?: string) {
  order.status = status
  order.history.push({ status, at: new Date(), ...(note ? { note } : {}) })
  await order.save()
}

async function logEvent(orderId: Types.ObjectId | null, reference: string, type: string, payload: Record<string, unknown>) {
  try {
    await PaymentEvent.create({ order: orderId, reference, type, payload })
  } catch (err) {
    console.error("[Grants] failed to log payment event", type, err)
  }
}

/**
 * Opens one waiting grant onto the account `userId`, whose email must be the
 * grant's. One request at a time (the `openingAt` claim). A failure leaves it
 * waiting with `lastError` set, so the admin list says why. Never throws.
 */
export async function openAccessGrant(grantId: string, userId: string, opts: OpenOptions): Promise<OpenGrantResult> {
  try {
    await connectDB()
    const now = new Date()
    const grant = await AccessGrant.findOneAndUpdate(
      {
        _id: grantId,
        status: "waiting",
        $or: [{ openingAt: null }, { openingAt: { $lt: new Date(now.getTime() - OPENING_STALE_MS) } }],
      },
      { $set: { openingAt: now } },
      { new: true }
    )
    if (!grant) return { ok: false, message: "It is already open, cancelled, or being opened right now" }

    const fail = async (message: string): Promise<OpenGrantResult> => {
      await AccessGrant.updateOne({ _id: grant._id, status: "waiting" }, { $set: { openingAt: null, lastError: message } }).catch(
        (err) => console.error("[Grants] couldn't release a grant:", err)
      )
      return { ok: false, message }
    }

    const [course, learner, existing] = await Promise.all([
      Course.findById(grant.course).select("title instructor packages kind").lean(),
      User.findById(userId).select("email firstName lastName authUserId").lean(),
      Enrollment.findOne({ user: userId, course: grant.course }).select("status").lean(),
    ])
    if (!course) return await fail("The program no longer exists")
    if (!learner) return await fail("That account no longer exists")
    if (normalizeGrantEmail(learner.email) !== grant.email) return await fail("That account uses a different email")
    // An admin's own decision on this enrollment outranks the grant, as it does a transfer approval.
    if (existing && ["suspended", "cancelled", "expired"].includes(existing.status)) {
      return await fail(`Their enrollment in this program is ${existing.status}. Restore it from Enrollments.`)
    }
    // Already in (they bought it in checkout meanwhile, say): nothing to open, and no second Order.
    if (existing && (existing.status === "active" || existing.status === "completed")) {
      await AccessGrant.updateOne(
        { _id: grant._id },
        {
          $set: {
            status: "opened",
            user: userId,
            enrollment: existing._id,
            alreadyHadAccess: true,
            openedAt: now,
            openingAt: null,
            lastError: null,
          },
        }
      )
      return { ok: true, enrollmentId: existing._id.toString(), alreadyHadAccess: true }
    }

    const courseId = grant.course.toString()
    const via = transferLabel(grant.method)
    const reference = grantReference(grant._id.toString())
    const price = grant.amountMinor / 100
    const packageFields = { packageKey: grant.packageKey ?? null, packageName: grant.packageName ?? null }
    const isActivation = existing?.status === "pre_enrolled"
    const isRestore = existing?.status === "refunded"

    let order: IOrder | null = null
    let enrollmentId: string
    try {
      // The Order records how the money moved: outside the platform, recorded by an admin.
      order = await Order.findOne({ reference })
      if (order) {
        // An earlier attempt failed to enroll and left the order `failed`.
        await transitionOrder(order, "paid", `Opened again ${opts.how}`)
      } else {
        order = await Order.create({
          user: userId,
          authUserId: learner.authUserId,
          course: grant.course,
          reference,
          amountMinor: grant.amountMinor,
          currency: "USD",
          packageKey: packageFields.packageKey,
          paymentMethod: grant.method,
          status: "paid",
          chargeId: null,
          history: [
            {
              status: "pending",
              at: grant.paidAt,
              note: `Paid outside the platform by ${via}${grant.reference ? ` (reference ${grant.reference})` : ""}`,
            },
            { status: "paid", at: now, note: `Recorded by ${grant.addedByName}, opened ${opts.how}` },
          ],
        })
      }
      await AccessGrant.updateOne({ _id: grant._id }, { $set: { order: order._id } })

      // purchasedAt is the day they paid, so their cohort is the one they paid for.
      const fields = {
        pricePaid: price,
        currency: "USD",
        transactionId: null,
        purchasedAt: grant.paidAt,
        activatedAt: now,
        ...packageFields,
      }
      if (isActivation || isRestore) {
        const restored = await Enrollment.findOneAndUpdate(
          { user: userId, course: grant.course, status: isActivation ? "pre_enrolled" : "refunded" },
          { $set: { status: "active", legacyUnpaid: false, ...fields } },
          { new: true }
        )
        if (!restored) throw new Error("enrollment row changed concurrently")
        enrollmentId = restored._id.toString()
      } else {
        const created = await Enrollment.create({ user: userId, course: grant.course, ...fields })
        enrollmentId = created._id.toString()
      }
    } catch (err) {
      console.error("[Grants] couldn't open the enrollment:", err)
      if (order) {
        await transitionOrder(order, "failed", "enrollment could not be created").catch(() => {})
        await logEvent(order._id, reference, "access_grant_failed", {
          grantId: grant._id.toString(),
          message: err instanceof Error ? err.message : String(err),
        })
      }
      return await fail("Couldn't open the program. Try again.")
    }

    try {
      await transitionOrder(order, "enrolled")
    } catch (err) {
      console.error("[Grants] enrolled, but the order didn't move to enrolled:", err)
    }
    await logEvent(order._id, reference, "access_grant_opened", {
      grantId: grant._id.toString(),
      amountMinor: grant.amountMinor,
      courseId,
      packageKey: packageFields.packageKey,
      method: grant.method,
      paymentReference: grant.reference,
      paidAt: grant.paidAt.toISOString(),
      addedBy: grant.addedBy.toString(),
      opened: opts.how,
    })
    await AccessGrant.updateOne(
      { _id: grant._id },
      {
        $set: {
          status: "opened",
          user: userId,
          enrollment: enrollmentId,
          order: order._id,
          alreadyHadAccess: false,
          openedAt: now,
          openingAt: null,
          lastError: null,
        },
      }
    ).catch((err) => console.error("[Grants] opened, but the grant row didn't update:", err))

    // The student counts move as on a purchase; a pre-enrollment already counted this student.
    if (!isActivation) {
      try {
        await Course.findByIdAndUpdate(courseId, { $inc: { enrolledCount: 1 } })
        await User.findByIdAndUpdate(course.instructor, { $inc: { "instructorProfile.totalStudents": 1 } })
      } catch (err) {
        console.error("[Grants] couldn't update the student counts:", err)
      }
    }

    // Executive (D4), as on a purchase: the instructor and admins schedule onboarding.
    const pkg = packageFields.packageKey
      ? ((course.packages ?? []).find((p) => p.key === packageFields.packageKey) ?? null)
      : null
    if (pkg?.key === "executive" && pkg.entitlements.mentorship) {
      const buyer = `${learner.firstName ?? ""} ${learner.lastName ?? ""}`.trim() || learner.email
      const note = {
        type: "course" as const,
        title: `New ${pkg.name} enrollment`,
        body: `${buyer} enrolled in ${course.title} — schedule their onboarding.`,
      }
      void notifyUser(course.instructor.toString(), { ...note, href: `/instructor/courses/${courseId}`, courseId })
      void notifyAdmins({ ...note, href: `/admin/enrollments?course=${courseId}` })
    }

    void notifyUser(userId, {
      type: "payment",
      title: "Your payment is recorded — you're enrolled",
      body: `${course.title}${packageFields.packageName ? ` — ${packageFields.packageName}` : ""} is open in your dashboard.`.slice(0, 500),
      href: `/dashboard/courses/${courseId}`,
      courseId,
    })
    const emails = async () => {
      await sendEnrollmentConfirmationEmail({
        to: learner.email ?? "",
        firstName: learner.firstName ?? "",
        courseTitle: course.title,
        courseId,
        availableAtIso: null,
        isPaid: true,
        price,
        packageName: packageFields.packageName,
      })
      // D27: one welcome on the learner's first paid enrollment.
      await sendWelcomeOnce(userId, enrollmentId)
    }
    if (opts.awaitEmails) await emails().catch((err) => console.error("[Grants] emails failed:", err))
    else void emails().catch((err) => console.error("[Grants] emails failed:", err))

    return { ok: true, enrollmentId, alreadyHadAccess: false }
  } catch (err) {
    console.error("[Grants] open failed:", err)
    return { ok: false, message: "Couldn't open the program. Try again." }
  }
}

/**
 * Opens every waiting grant for this account's email — on the learner's first
 * sign-in, and again whenever the dashboard gate would turn them away. Only a
 * verified email claims, so nobody can sign up with someone else's address
 * and take their place. Returns how many opened. Never throws.
 */
export async function claimWaitingGrants(user: { id: string; email: string; verified: boolean }): Promise<number> {
  try {
    const email = normalizeGrantEmail(user.email)
    if (!email || !user.verified) return 0
    await connectDB()
    const waiting = await AccessGrant.find({ email, status: "waiting" }).select("_id").sort({ createdAt: 1 }).limit(20).lean()
    let opened = 0
    for (const g of waiting) {
      const result = await openAccessGrant(g._id.toString(), user.id, { how: "when the learner signed in" })
      if (result.ok) opened++
    }
    return opened
  } catch (err) {
    console.error("[Grants] claim failed:", err)
    return 0
  }
}
