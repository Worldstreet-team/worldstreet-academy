"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod/v4"
import connectDB from "@/lib/db"
import {
  SellerApplication,
  User,
  type SellerApplicationStatus,
  type SellerStatus,
} from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth/actions"
import { requireAdmin } from "@/lib/auth/admin"
import { notifyAdmins, notifyUser } from "@/lib/notify"
import { sendNewSellerApplicationAdminEmail, sendSellerDecisionEmail } from "@/lib/email"
import { appUrl } from "@/lib/app-url"
import { SCHOOL_BY_SLUG, SCHOOL_SLUGS, isSchoolSlug, type SchoolSlug } from "@/lib/schools"
import { isFacultyRole, safeWebUrl } from "@/lib/faculty"
import { SELLER_HOME } from "@/lib/marketplace"

/**
 * Seller applications (owner, 2026-10-05: approved sellers only). A person
 * applies at /dashboard/sell/apply; an admin approves or rejects at
 * /admin/sellers. Approval sets `User.sellerStatus = "approved"`, which opens
 * the trimmed instructor area for marketplace courses — never a role change.
 * Faculty (INSTRUCTOR/ADMIN) may already put courses on the marketplace and
 * don't apply.
 */

type Result<T> = { success: true; data: T } | { success: false; error: string }

const PAGE_SIZE = 20

const ObjectIdSchema = z.string().regex(/^[a-f0-9]{24}$/, "Invalid application")

/** "youtube.com/@me" → "https://youtube.com/@me": a missing scheme is the common slip. */
function withScheme(value: string): string {
  return value && !/^[a-z][a-z0-9+.-]*:/i.test(value) ? `https://${value}` : value
}

const ApplicationInput = z.object({
  fullName: z.string().trim().min(2, "Enter the name you'll sell under").max(80, "Name must be 80 characters or less"),
  // Typed as a string so the form can send "" before a choice is made.
  school: z.string().pipe(z.enum(SCHOOL_SLUGS, { error: "Choose the school your course fits" })),
  topic: z
    .string()
    .trim()
    .min(5, "Say what you'll teach in a few words")
    .max(160, "Keep the topic to 160 characters"),
  experience: z
    .string()
    .trim()
    .min(50, "Tell us about your experience (at least 50 characters)")
    .max(2000, "Experience must be 2,000 characters or less"),
  sampleUrl: z
    .string()
    .trim()
    .max(500, "That link is too long")
    .transform(withScheme)
    .refine((v) => safeWebUrl(v) !== null, "Add a link to a sample of your teaching (https://…)"),
  pitch: z
    .string()
    .trim()
    .min(50, "Tell learners why they should buy (at least 50 characters)")
    .max(2000, "Keep this to 2,000 characters"),
  agreed: z.boolean().refine((v) => v, "Agree to the quality standards and the revenue split to apply"),
})

export type SellerApplicationInput = z.input<typeof ApplicationInput>

export type SellerApplicationView = {
  id: string
  status: SellerApplicationStatus
  fullName: string
  school: SchoolSlug | null
  topic: string
  experience: string
  sampleUrl: string
  pitch: string
  reason: string | null
  createdAt: string
  reviewedAt: string | null
}

export type MySellerApplication = {
  sellerStatus: SellerStatus
  /** INSTRUCTOR/ADMIN: already able to sell, nothing to apply for. */
  isFaculty: boolean
  /** The latest application, if any. */
  application: SellerApplicationView | null
}

type ApplicationDoc = {
  _id: { toString(): string }
  status: SellerApplicationStatus
  fullName: string
  school: string
  topic: string
  experience: string
  sampleUrl: string
  pitch: string
  reason?: string | null
  createdAt: Date
  reviewedAt?: Date | null
}

function toView(app: ApplicationDoc): SellerApplicationView {
  return {
    id: app._id.toString(),
    status: app.status,
    fullName: app.fullName,
    school: isSchoolSlug(app.school) ? app.school : null,
    topic: app.topic,
    experience: app.experience,
    sampleUrl: app.sampleUrl,
    pitch: app.pitch,
    reason: app.reason ?? null,
    createdAt: new Date(app.createdAt).toISOString(),
    reviewedAt: app.reviewedAt ? new Date(app.reviewedAt).toISOString() : null,
  }
}

/* ═══════════════════════ Applicant side ═══════════════════════ */

export async function getMySellerApplication(): Promise<MySellerApplication | null> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return null

    const [me, latest] = await Promise.all([
      User.findById(user.id).select("sellerStatus").lean(),
      SellerApplication.findOne({ user: user.id }).sort({ createdAt: -1 }).lean(),
    ])
    return {
      sellerStatus: me?.sellerStatus ?? "none",
      isFaculty: isFacultyRole(user.role),
      application: latest ? toView(latest) : null,
    }
  } catch (error) {
    console.error("Get seller application error:", error)
    return null
  }
}

export async function submitSellerApplication(input: SellerApplicationInput): Promise<Result<{ id: string }>> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "Sign in to apply" }
    if (isFacultyRole(user.role)) {
      return { success: false, error: "You're faculty — you can already put courses on the marketplace" }
    }

    const parsed = ApplicationInput.safeParse(input)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the form" }
    const answers = parsed.data

    const me = await User.findById(user.id).select("sellerStatus").lean()
    if (!me) return { success: false, error: "Account not found" }
    if (me.sellerStatus === "approved") return { success: false, error: "You're already approved to sell" }

    const open = await SellerApplication.exists({ user: user.id, status: "submitted" })
    if (open) return { success: false, error: "Your application is already in review" }

    const now = new Date()
    const application = await SellerApplication.create({
      user: user.id,
      status: "submitted",
      fullName: answers.fullName,
      school: answers.school,
      topic: answers.topic,
      experience: answers.experience,
      sampleUrl: answers.sampleUrl,
      pitch: answers.pitch,
      agreedAt: now,
    })
    await User.updateOne({ _id: user.id }, { $set: { sellerStatus: "applied" } })

    // Fire-and-forget: the bell and an email for every admin.
    const schoolName = SCHOOL_BY_SLUG[answers.school].name
    void notifyAdmins({
      type: "application",
      title: "New seller application",
      body: `${answers.fullName} wants to sell “${answers.topic}” (${SCHOOL_BY_SLUG[answers.school].short}).`.slice(0, 500),
      href: "/admin/sellers",
    })
    void (async () => {
      const admins = await User.find({ role: "ADMIN" }).select("email").lean()
      await Promise.allSettled(
        admins
          .filter((a) => a.email && !a.email.endsWith("@users.noemail"))
          .map((a) =>
            sendNewSellerApplicationAdminEmail(a.email, {
              applicantName: answers.fullName,
              applicantAvatarUrl: user.avatarUrl ?? undefined,
              topic: answers.topic,
              schoolName,
              reviewUrl: appUrl("/admin/sellers"),
            })
          )
      )
    })()

    revalidatePath("/dashboard/sell/apply")
    revalidatePath("/admin/sellers")
    return { success: true, data: { id: application._id.toString() } }
  } catch (error) {
    // Unique-index race: two tabs submitting at once.
    if ((error as { code?: number })?.code === 11000) {
      return { success: false, error: "Your application is already in review" }
    }
    console.error("Submit seller application error:", error)
    return { success: false, error: "Failed to submit your application" }
  }
}

/* ═══════════════════════ Admin side ═══════════════════════ */

export type AdminSellerApplicationRow = SellerApplicationView & {
  userId: string
  email: string
  avatarUrl: string | null
  /** The account's name, which can differ from the name they sell under. */
  accountName: string
}

const ListInput = z.object({
  status: z.enum(["submitted", "approved", "rejected"]).default("submitted"),
  page: z.number().int().min(1).max(10_000).default(1),
})

export async function adminListSellerApplications(filters?: {
  status?: SellerApplicationStatus
  page?: number
}): Promise<{
  applications: AdminSellerApplicationRow[]
  total: number
  page: number
  pageCount: number
  counts: Record<SellerApplicationStatus, number>
}> {
  const counts: Record<SellerApplicationStatus, number> = { submitted: 0, approved: 0, rejected: 0 }
  const empty = { applications: [], total: 0, page: 1, pageCount: 1, counts }
  try {
    await connectDB()
    await requireAdmin()

    const parsed = ListInput.safeParse(filters ?? {})
    if (!parsed.success) return empty
    const { status, page } = parsed.data

    const [rows, total, grouped] = await Promise.all([
      SellerApplication.find({ status })
        .sort({ createdAt: status === "submitted" ? 1 : -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .populate("user", "firstName lastName email avatarUrl")
        .lean(),
      SellerApplication.countDocuments({ status }),
      SellerApplication.aggregate<{ _id: SellerApplicationStatus; n: number }>([
        { $group: { _id: "$status", n: { $sum: 1 } } },
      ]),
    ])
    for (const g of grouped) if (g._id in counts) counts[g._id] = g.n

    return {
      applications: rows.map((row) => {
        const owner = row.user as unknown as {
          _id?: { toString(): string }
          firstName?: string
          lastName?: string
          email?: string
          avatarUrl?: string | null
        } | null
        return {
          ...toView(row),
          userId: owner?._id?.toString() ?? "",
          email: owner?.email ?? "",
          avatarUrl: owner?.avatarUrl ?? null,
          accountName: `${owner?.firstName ?? ""} ${owner?.lastName ?? ""}`.trim() || "Unknown",
        }
      }),
      total,
      page,
      pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      counts,
    }
  } catch (error) {
    console.error("Admin list seller applications error:", error)
    return empty
  }
}

/** Approve: the applicant may now create marketplace courses. */
export async function adminApproveSellerApplication(applicationId: string): Promise<Result<null>> {
  try {
    await connectDB()
    const admin = await requireAdmin()

    const id = ObjectIdSchema.safeParse(applicationId)
    if (!id.success) return { success: false, error: "Invalid application" }

    // Only a submitted application can be decided — a second click is a no-op error.
    const application = await SellerApplication.findOneAndUpdate(
      { _id: id.data, status: "submitted" },
      { $set: { status: "approved", reviewedBy: admin.id, reviewedAt: new Date(), reason: null } },
      { new: true }
    ).lean()
    if (!application) return { success: false, error: "This application was already decided" }

    const seller = await User.findByIdAndUpdate(
      application.user,
      { $set: { sellerStatus: "approved" } },
      { new: true }
    )
      .select("email firstName")
      .lean()

    void notifyUser(application.user.toString(), {
      type: "application",
      title: "You're approved to sell",
      body: "Create your first marketplace course, add your lessons and submit it for review.",
      href: SELLER_HOME,
    })
    if (seller?.email) {
      void sendSellerDecisionEmail({
        to: seller.email,
        firstName: seller.firstName ?? "",
        approved: true,
        reason: null,
        ctaUrl: appUrl(SELLER_HOME),
      })
    }

    revalidatePath("/admin/sellers")
    revalidatePath("/dashboard/sell/apply")
    return { success: true, data: null }
  } catch (error) {
    console.error("Approve seller application error:", error)
    return { success: false, error: "Failed to approve the application" }
  }
}

const RejectInput = z.object({
  applicationId: ObjectIdSchema,
  reason: z
    .string()
    .trim()
    .min(5, "Give the applicant a reason (at least 5 characters)")
    .max(1000, "Keep the reason to 1,000 characters"),
})

/** Reject with a reason, which is emailed to the applicant. They may apply again. */
export async function adminRejectSellerApplication(applicationId: string, reason: string): Promise<Result<null>> {
  try {
    await connectDB()
    const admin = await requireAdmin()

    const parsed = RejectInput.safeParse({ applicationId, reason })
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }

    const application = await SellerApplication.findOneAndUpdate(
      { _id: parsed.data.applicationId, status: "submitted" },
      { $set: { status: "rejected", reviewedBy: admin.id, reviewedAt: new Date(), reason: parsed.data.reason } },
      { new: true }
    ).lean()
    if (!application) return { success: false, error: "This application was already decided" }

    // Never demote an approved seller from an old application.
    const seller = await User.findOneAndUpdate(
      { _id: application.user, sellerStatus: { $ne: "approved" } },
      { $set: { sellerStatus: "rejected" } },
      { new: true }
    )
      .select("email firstName")
      .lean()

    void notifyUser(application.user.toString(), {
      type: "application",
      title: "Your seller application wasn't approved",
      body: parsed.data.reason.slice(0, 500),
      href: "/dashboard/sell/apply",
    })
    if (seller?.email) {
      void sendSellerDecisionEmail({
        to: seller.email,
        firstName: seller.firstName ?? "",
        approved: false,
        reason: parsed.data.reason,
        ctaUrl: appUrl("/dashboard/sell/apply"),
      })
    }

    revalidatePath("/admin/sellers")
    revalidatePath("/dashboard/sell/apply")
    return { success: true, data: null }
  } catch (error) {
    console.error("Reject seller application error:", error)
    return { success: false, error: "Failed to reject the application" }
  }
}
