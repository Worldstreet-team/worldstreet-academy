"use server"

import { revalidatePath } from "next/cache"
import { Types } from "mongoose"
import connectDB from "@/lib/db"
import {
  InstructorApplication,
  User,
  Meeting,
  ACTIVE_APPLICATION_STATUSES,
  type ApplicationStatus,
  type IMeetingInvite,
} from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth/actions"
import { requireAdmin, syncRoleToClerk } from "@/lib/auth/admin"
import { notifyUser, notifyAdmins } from "@/lib/notify"
import { createMeeting as createRTKMeeting, addParticipant } from "@/lib/realtime"
import {
  sendApplicationReceivedEmail,
  sendApplicationDecisionEmail,
  sendInterviewInviteEmail,
} from "@/lib/email"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://academy.worldstreetgold.com"
const PAGE_SIZE = 20

/* ═══════════════════════ Shared types ═══════════════════════ */

export type ApplicationAnswersInput = {
  headline: string
  expertise: string[]
  experienceYears: string
  experience: string
  motivation: string
  portfolioUrl?: string
  twitter?: string
  linkedin?: string
  website?: string
  sampleVideoUrl?: string
}

export type InterviewInfo = {
  meetingId: string
  scheduledAt: string | null
  /** Deep link into the meetings page waiting room. */
  joinPath: string
}

export type MyApplication = {
  id: string
  status: ApplicationStatus
  answers: ApplicationAnswersInput
  decisionNote: string
  history: { status: string; at: string; note?: string }[]
  createdAt: string
  interview: InterviewInfo | null
}

/* ═══════════════════════ Applicant side ═══════════════════════ */

function sanitizeUrl(value?: string): string | null {
  const v = value?.trim()
  if (!v) return null
  if (!/^https?:\/\//i.test(v)) return `https://${v}`
  return v
}

export async function submitInstructorApplication(input: ApplicationAnswersInput) {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "Not authenticated" }

    if (user.role === "INSTRUCTOR" || user.role === "ADMIN") {
      return { success: false, error: "You already have instructor access" }
    }

    // Validation — mirror the form's constraints server-side.
    const headline = input.headline?.trim() ?? ""
    const experience = input.experience?.trim() ?? ""
    const motivation = input.motivation?.trim() ?? ""
    const expertise = (input.expertise ?? [])
      .map((e) => e.trim())
      .filter(Boolean)
      .slice(0, 8)

    if (headline.length < 10) return { success: false, error: "Headline must be at least 10 characters" }
    if (expertise.length === 0) return { success: false, error: "Add at least one area of expertise" }
    if (experience.length < 50)
      return { success: false, error: "Tell us more about your experience (at least 50 characters)" }
    if (motivation.length < 50)
      return { success: false, error: "Tell us more about your motivation (at least 50 characters)" }

    const existing = await InstructorApplication.findOne({
      user: user.id,
      status: { $in: ACTIVE_APPLICATION_STATUSES },
    })
    if (existing) {
      return { success: false, error: "You already have an application in review" }
    }

    const application = await InstructorApplication.create({
      user: user.id,
      status: "submitted",
      answers: {
        headline,
        expertise,
        experienceYears: input.experienceYears?.trim() ?? "",
        experience,
        motivation,
        portfolioUrl: sanitizeUrl(input.portfolioUrl),
        twitter: sanitizeUrl(input.twitter),
        linkedin: sanitizeUrl(input.linkedin),
        website: sanitizeUrl(input.website),
        sampleVideoUrl: sanitizeUrl(input.sampleVideoUrl),
      },
      history: [
        {
          status: "submitted",
          at: new Date(),
          by: `${user.firstName} ${user.lastName}`.trim(),
        },
      ],
    })

    await User.findByIdAndUpdate(user.id, { $set: { instructorStatus: "applied" } })

    // Fire-and-forget: bell for admins, email receipt for the applicant.
    void notifyAdmins({
      type: "application",
      title: "New instructor application",
      body: `${user.firstName} ${user.lastName} applied: "${headline}"`,
      href: `/admin/applications/${application._id.toString()}`,
    })
    void sendApplicationReceivedEmail(user.email, {
      applicantName: user.firstName || "there",
      applicantAvatarUrl: user.avatarUrl ?? undefined,
      statusUrl: `${APP_URL}/dashboard/become-instructor`,
    })

    revalidatePath("/dashboard/become-instructor")
    return { success: true, applicationId: application._id.toString() }
  } catch (error) {
    // Unique-index race: two tabs submitting at once.
    if ((error as { code?: number })?.code === 11000) {
      return { success: false, error: "You already have an application in review" }
    }
    console.error("Submit application error:", error)
    return { success: false, error: "Failed to submit application" }
  }
}

export async function getMyInstructorApplication(): Promise<MyApplication | null> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return null

    const app = await InstructorApplication.findOne({ user: user.id })
      .sort({ createdAt: -1 })
      .lean()
    if (!app) return null

    // Interview details when one is scheduled (or already live).
    let interview: InterviewInfo | null = null
    if (app.interviewMeetingId) {
      const meeting = await Meeting.findById(app.interviewMeetingId)
        .select("scheduledAt status")
        .lean()
      if (meeting && meeting.status !== "ended") {
        interview = {
          meetingId: app.interviewMeetingId.toString(),
          scheduledAt: meeting.scheduledAt ? new Date(meeting.scheduledAt).toISOString() : null,
          joinPath: `/dashboard/meetings?join=${app.interviewMeetingId.toString()}`,
        }
      }
    }

    return {
      id: app._id.toString(),
      status: app.status,
      answers: {
        headline: app.answers.headline,
        expertise: app.answers.expertise ?? [],
        experienceYears: app.answers.experienceYears ?? "",
        experience: app.answers.experience,
        motivation: app.answers.motivation,
        portfolioUrl: app.answers.portfolioUrl ?? undefined,
        twitter: app.answers.twitter ?? undefined,
        linkedin: app.answers.linkedin ?? undefined,
        website: app.answers.website ?? undefined,
        sampleVideoUrl: app.answers.sampleVideoUrl ?? undefined,
      },
      decisionNote: app.decisionNote ?? "",
      history: (app.history ?? []).map((h) => ({
        status: h.status,
        at: new Date(h.at).toISOString(),
        note: h.note,
      })),
      createdAt: app.createdAt.toISOString(),
      interview,
    }
  } catch (error) {
    console.error("Get my application error:", error)
    return null
  }
}

export async function withdrawInstructorApplication() {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "Not authenticated" }

    const app = await InstructorApplication.findOne({
      user: user.id,
      status: { $in: ACTIVE_APPLICATION_STATUSES },
    })
    if (!app) return { success: false, error: "No active application to withdraw" }

    app.status = "withdrawn"
    app.history.push({
      status: "withdrawn",
      at: new Date(),
      by: `${user.firstName} ${user.lastName}`.trim(),
    })
    await app.save()

    await User.findByIdAndUpdate(user.id, { $set: { instructorStatus: "none" } })

    revalidatePath("/dashboard/become-instructor")
    return { success: true }
  } catch (error) {
    console.error("Withdraw application error:", error)
    return { success: false, error: "Failed to withdraw application" }
  }
}

/* ═══════════════════════ Admin side ═══════════════════════ */

export type AdminApplicationRow = {
  id: string
  applicantId: string
  applicantName: string
  applicantEmail: string
  applicantAvatar: string | null
  headline: string
  expertise: string[]
  status: ApplicationStatus
  createdAt: string
}

export async function adminListApplications(filters?: {
  status?: ApplicationStatus | "all" | "active"
  page?: number
}): Promise<{
  applications: AdminApplicationRow[]
  total: number
  page: number
  pageCount: number
  counts: Record<string, number>
}> {
  const empty = { applications: [], total: 0, page: 1, pageCount: 1, counts: {} }
  try {
    await connectDB()
    await requireAdmin()

    const page = Math.max(1, filters?.page ?? 1)
    const query: Record<string, unknown> = {}
    if (filters?.status === "active") {
      query.status = { $in: ACTIVE_APPLICATION_STATUSES }
    } else if (filters?.status && filters.status !== "all") {
      query.status = filters.status
    }

    const [rows, total, countsAgg] = await Promise.all([
      InstructorApplication.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .populate("user", "firstName lastName email avatarUrl")
        .lean(),
      InstructorApplication.countDocuments(query),
      InstructorApplication.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    ])

    const counts: Record<string, number> = {}
    for (const g of countsAgg as { _id: string; count: number }[]) counts[g._id] = g.count

    return {
      applications: rows.map((a) => {
        const applicant = a.user as unknown as {
          _id?: { toString(): string }
          firstName?: string
          lastName?: string
          email?: string
          avatarUrl?: string | null
        } | null
        return {
          id: a._id.toString(),
          applicantId: applicant?._id?.toString() ?? "",
          applicantName: applicant
            ? `${applicant.firstName ?? ""} ${applicant.lastName ?? ""}`.trim() || "Unknown"
            : "Unknown",
          applicantEmail: applicant?.email ?? "",
          applicantAvatar: applicant?.avatarUrl ?? null,
          headline: a.answers?.headline ?? "",
          expertise: a.answers?.expertise ?? [],
          status: a.status,
          createdAt: a.createdAt.toISOString(),
        }
      }),
      total,
      page,
      pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      counts,
    }
  } catch (error) {
    console.error("Admin list applications error:", error)
    return empty
  }
}

export type AdminApplicationDetail = AdminApplicationRow & {
  answers: ApplicationAnswersInput
  reviewerNotes: { byName: string; note: string; at: string }[]
  decisionNote: string
  decidedAt: string | null
  history: { status: string; at: string; by?: string; note?: string }[]
  applicantJoinedAt: string | null
  applicantEnrollments: number
  interview: InterviewInfo | null
}

export async function adminGetApplication(applicationId: string): Promise<AdminApplicationDetail | null> {
  try {
    await connectDB()
    await requireAdmin()

    const a = await InstructorApplication.findById(applicationId)
      .populate("user", "firstName lastName email avatarUrl createdAt")
      .lean()
    if (!a) return null

    const applicant = a.user as unknown as {
      _id?: { toString(): string }
      firstName?: string
      lastName?: string
      email?: string
      avatarUrl?: string | null
      createdAt?: Date
    } | null

    const { Enrollment } = await import("@/lib/db/models")
    const applicantEnrollments = applicant?._id
      ? await Enrollment.countDocuments({ user: applicant._id })
      : 0

    let interview: InterviewInfo | null = null
    if (a.interviewMeetingId) {
      const meeting = await Meeting.findById(a.interviewMeetingId)
        .select("scheduledAt status")
        .lean()
      if (meeting && meeting.status !== "ended") {
        interview = {
          meetingId: a.interviewMeetingId.toString(),
          scheduledAt: meeting.scheduledAt ? new Date(meeting.scheduledAt).toISOString() : null,
          joinPath: `/dashboard/meetings?join=${a.interviewMeetingId.toString()}`,
        }
      }
    }

    return {
      id: a._id.toString(),
      applicantId: applicant?._id?.toString() ?? "",
      applicantName: applicant
        ? `${applicant.firstName ?? ""} ${applicant.lastName ?? ""}`.trim() || "Unknown"
        : "Unknown",
      applicantEmail: applicant?.email ?? "",
      applicantAvatar: applicant?.avatarUrl ?? null,
      headline: a.answers?.headline ?? "",
      expertise: a.answers?.expertise ?? [],
      status: a.status,
      createdAt: a.createdAt.toISOString(),
      answers: {
        headline: a.answers.headline,
        expertise: a.answers.expertise ?? [],
        experienceYears: a.answers.experienceYears ?? "",
        experience: a.answers.experience,
        motivation: a.answers.motivation,
        portfolioUrl: a.answers.portfolioUrl ?? undefined,
        twitter: a.answers.twitter ?? undefined,
        linkedin: a.answers.linkedin ?? undefined,
        website: a.answers.website ?? undefined,
        sampleVideoUrl: a.answers.sampleVideoUrl ?? undefined,
      },
      reviewerNotes: (a.reviewerNotes ?? [])
        .map((n) => ({ byName: n.byName, note: n.note, at: new Date(n.at).toISOString() }))
        .reverse(),
      decisionNote: a.decisionNote ?? "",
      decidedAt: a.decidedAt ? new Date(a.decidedAt).toISOString() : null,
      history: (a.history ?? []).map((h) => ({
        status: h.status,
        at: new Date(h.at).toISOString(),
        by: h.by,
        note: h.note,
      })),
      applicantJoinedAt: applicant?.createdAt ? new Date(applicant.createdAt).toISOString() : null,
      applicantEnrollments,
      interview,
    }
  } catch (error) {
    console.error("Admin get application error:", error)
    return null
  }
}

/**
 * Schedule (or reschedule) the interview call for an application.
 *
 * Creates a Meeting with status "scheduled" + a real waiting room
 * (requireApproval, no guest auto-admit) and the RTK room minted up front —
 * the admin's own join via the standard `?join=` deep link flips it live
 * (see joinMeeting's scheduled→active host path). The applicant is invited
 * via invites[] (shows on their meetings page), notified in-app, and emailed
 * the join link.
 */
export async function adminScheduleInterview(applicationId: string, scheduledAtISO: string) {
  try {
    await connectDB()
    const admin = await requireAdmin()

    const scheduledAt = new Date(scheduledAtISO)
    if (isNaN(scheduledAt.getTime())) return { success: false, error: "Invalid date" }
    if (scheduledAt.getTime() < Date.now() - 60_000) {
      return { success: false, error: "Interview time must be in the future" }
    }

    const app = await InstructorApplication.findById(applicationId).populate(
      "user",
      "firstName lastName email avatarUrl"
    )
    if (!app) return { success: false, error: "Application not found" }
    if (!ACTIVE_APPLICATION_STATUSES.includes(app.status)) {
      return { success: false, error: `Application is already ${app.status}` }
    }

    const applicant = app.user as unknown as {
      _id: Types.ObjectId
      firstName?: string
      lastName?: string
      email?: string
      avatarUrl?: string | null
    }
    const applicantName = `${applicant.firstName ?? ""} ${applicant.lastName ?? ""}`.trim() || "Applicant"
    const adminName = `${admin.firstName} ${admin.lastName}`.trim()

    // Reschedule path: reuse the existing meeting if it hasn't ended.
    let meetingDoc = app.interviewMeetingId
      ? await Meeting.findOne({ _id: app.interviewMeetingId, status: { $ne: "ended" } })
      : null
    let rescheduled = false

    if (meetingDoc) {
      meetingDoc.scheduledAt = scheduledAt
      await meetingDoc.save()
      rescheduled = true
    } else {
      // Mint the RTK room + host token up front, mirroring createMeeting.
      const rtkMeetingId = await createRTKMeeting(`Interview: ${applicantName}`)
      const hostParticipant = await addParticipant(rtkMeetingId, {
        name: adminName,
        customParticipantId: admin.id,
        presetName: "group_call_host",
      })

      meetingDoc = await Meeting.create({
        title: `Instructor Interview — ${applicantName}`,
        description: "Interview call for a WorldStreet Academy instructor application.",
        hostId: new Types.ObjectId(admin.id),
        status: "scheduled",
        scheduledAt,
        meetingId: rtkMeetingId,
        hostToken: hostParticipant.authToken,
        applicationId: app._id,
        participants: [
          {
            userId: new Types.ObjectId(admin.id),
            role: "host",
            status: "admitted",
            joinedAt: new Date(),
          },
        ],
        invites: [
          {
            userId: applicant._id,
            email: applicant.email ?? "",
            status: "sent",
            sentAt: new Date(),
          } as IMeetingInvite,
        ],
        settings: {
          allowScreenShare: true,
          muteOnEntry: false,
          requireApproval: true,
          guestAccess: false, // real waiting room — the admin admits the applicant
          maxParticipants: 10,
        },
      })
    }

    // Application state: interview_scheduled + pointer + history.
    app.interviewMeetingId = meetingDoc._id
    if (app.status !== "interview_scheduled") {
      app.status = "interview_scheduled"
    }
    app.history.push({
      status: "interview_scheduled",
      at: new Date(),
      by: adminName,
      note: `${rescheduled ? "Rescheduled" : "Scheduled"} for ${scheduledAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`,
    })
    await app.save()
    await User.findByIdAndUpdate(applicant._id, { $set: { instructorStatus: "interview" } })

    const joinPath = `/dashboard/meetings?join=${meetingDoc._id.toString()}`

    // Fire-and-forget: bell + email to the applicant.
    void notifyUser(applicant._id.toString(), {
      type: "meeting",
      title: rescheduled ? "Your interview was rescheduled" : "Interview scheduled 🎙️",
      body: `${scheduledAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} — with ${adminName}`,
      href: "/dashboard/become-instructor",
    })
    if (applicant.email) {
      void sendInterviewInviteEmail(applicant.email, {
        applicantName: applicant.firstName || "there",
        applicantAvatarUrl: applicant.avatarUrl ?? undefined,
        hostName: adminName,
        hostAvatarUrl: admin.avatarUrl ?? undefined,
        scheduledAt: scheduledAt.toISOString(),
        joinUrl: `${APP_URL}${joinPath}`,
      })
    }

    revalidatePath(`/admin/applications/${applicationId}`)
    revalidatePath("/admin/applications")
    return {
      success: true,
      meetingId: meetingDoc._id.toString(),
      joinPath,
      rescheduled,
    }
  } catch (error) {
    console.error("Schedule interview error:", error)
    return { success: false, error: "Failed to schedule interview" }
  }
}

export async function adminStartApplicationReview(applicationId: string) {
  try {
    await connectDB()
    const admin = await requireAdmin()

    const app = await InstructorApplication.findById(applicationId)
    if (!app) return { success: false, error: "Application not found" }
    if (app.status !== "submitted") {
      return { success: false, error: `Can't start review from status "${app.status}"` }
    }

    app.status = "under_review"
    app.history.push({
      status: "under_review",
      at: new Date(),
      by: `${admin.firstName} ${admin.lastName}`.trim(),
    })
    await app.save()

    await notifyUser(app.user.toString(), {
      type: "application",
      title: "Your application is under review",
      body: "An admin is reviewing your instructor application.",
      href: "/dashboard/become-instructor",
    })

    revalidatePath(`/admin/applications/${applicationId}`)
    revalidatePath("/admin/applications")
    return { success: true }
  } catch (error) {
    console.error("Start review error:", error)
    return { success: false, error: "Failed to start review" }
  }
}

export async function adminAddApplicationNote(applicationId: string, note: string) {
  try {
    await connectDB()
    const admin = await requireAdmin()

    const trimmed = note.trim()
    if (!trimmed) return { success: false, error: "Note can't be empty" }

    const app = await InstructorApplication.findByIdAndUpdate(
      applicationId,
      {
        $push: {
          reviewerNotes: {
            by: admin.id,
            byName: `${admin.firstName} ${admin.lastName}`.trim(),
            note: trimmed,
            at: new Date(),
          },
        },
      },
      { new: true }
    )
    if (!app) return { success: false, error: "Application not found" }

    revalidatePath(`/admin/applications/${applicationId}`)
    return { success: true }
  } catch (error) {
    console.error("Add note error:", error)
    return { success: false, error: "Failed to add note" }
  }
}

/**
 * Decide an application. Approval is the promotion path: role=INSTRUCTOR,
 * instructorStatus=approved, instructorProfile seeded from the answers, and
 * the role mirrored to Clerk publicMetadata.
 */
export async function adminDecideApplication(
  applicationId: string,
  decision: "approved" | "rejected",
  note?: string
) {
  try {
    await connectDB()
    const admin = await requireAdmin()

    const app = await InstructorApplication.findById(applicationId)
    if (!app) return { success: false, error: "Application not found" }
    if (!ACTIVE_APPLICATION_STATUSES.includes(app.status)) {
      return { success: false, error: `Application is already ${app.status}` }
    }

    const user = await User.findById(app.user)
    if (!user) return { success: false, error: "Applicant no longer exists" }

    const decisionNote = note?.trim() ?? ""
    const adminName = `${admin.firstName} ${admin.lastName}`.trim()

    app.status = decision
    app.decidedBy = admin.id as unknown as typeof app.decidedBy
    app.decidedAt = new Date()
    app.decisionNote = decisionNote
    app.history.push({ status: decision, at: new Date(), by: adminName, note: decisionNote })
    await app.save()

    if (decision === "approved") {
      // Promote (never demote an existing ADMIN).
      if (user.role === "USER") user.role = "INSTRUCTOR"
      user.instructorStatus = "approved"
      // Seed the public instructor profile from the application.
      user.instructorProfile = {
        headline: app.answers.headline,
        expertise: app.answers.expertise ?? [],
        socialLinks: {
          twitter: app.answers.twitter ?? undefined,
          linkedin: app.answers.linkedin ?? undefined,
          website: app.answers.website ?? app.answers.portfolioUrl ?? undefined,
        },
        totalStudents: user.instructorProfile?.totalStudents ?? 0,
        totalCourses: user.instructorProfile?.totalCourses ?? 0,
        totalEarnings: user.instructorProfile?.totalEarnings ?? 0,
      }
      await user.save()
      await syncRoleToClerk(user.authUserId, user.role)
    } else {
      user.instructorStatus = "rejected"
      await user.save()
    }

    // Fire-and-forget notifications + email.
    void notifyUser(user._id.toString(), {
      type: "application",
      title: decision === "approved" ? "You're an instructor now 🎉" : "Application update",
      body:
        decision === "approved"
          ? "Your instructor application was approved. Your instructor portal is ready."
          : decisionNote || "Your instructor application wasn't approved this time.",
      href: decision === "approved" ? "/instructor" : "/dashboard/become-instructor",
    })
    void sendApplicationDecisionEmail(user.email, {
      applicantName: user.firstName || "there",
      applicantAvatarUrl: user.avatarUrl ?? undefined,
      statusUrl:
        decision === "approved"
          ? `${APP_URL}/instructor`
          : `${APP_URL}/dashboard/become-instructor`,
      decision,
      decisionNote: decisionNote || undefined,
    })

    revalidatePath(`/admin/applications/${applicationId}`)
    revalidatePath("/admin/applications")
    revalidatePath("/admin/users")
    return { success: true }
  } catch (error) {
    console.error("Decide application error:", error)
    return { success: false, error: "Failed to record decision" }
  }
}
