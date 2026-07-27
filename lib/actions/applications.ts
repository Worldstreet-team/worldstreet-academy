"use server"

import { revalidatePath } from "next/cache"
import { Types, type HydratedDocument } from "mongoose"
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
import { buildInterviewIcs } from "@/lib/ics"
import {
  sendApplicationReceivedEmail,
  sendApplicationDecisionEmail,
  sendInterviewInviteEmail,
  sendNewApplicationAdminEmail,
  sendUnderReviewEmail,
  sendSlotsProposedEmail,
} from "@/lib/email"
import type { IScorecard, RejectionReason } from "@/lib/db/models"

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
  cvUrl?: string
  /** Terms-of-teaching acceptance — required at submit, recorded with a timestamp. */
  termsAccepted?: boolean
}

/** Days a rejected applicant must wait before re-applying. */
const REAPPLY_COOLDOWN_DAYS = 30

export type InterviewInfo = {
  meetingId: string
  scheduledAt: string | null
  /** Deep link into the meetings page waiting room. */
  joinPath: string
}

export type ProposedSlotView = { at: string; note?: string }

export type MyApplication = {
  id: string
  status: ApplicationStatus
  answers: ApplicationAnswersInput
  decisionNote: string
  history: { status: string; at: string; note?: string }[]
  createdAt: string
  interview: InterviewInfo | null
  /** Interview slots the admin proposed — the applicant picks one. */
  proposedSlots: ProposedSlotView[]
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
    if (!input.termsAccepted) {
      return { success: false, error: "Please accept the instructor terms to continue" }
    }
    // Minimum-profile check — reviewer sees a real name, and payments/KYC need one later.
    if (!user.firstName?.trim() || !user.lastName?.trim()) {
      return {
        success: false,
        error: "Add your first and last name to your profile before applying",
      }
    }

    const existing = await InstructorApplication.findOne({
      user: user.id,
      status: { $in: ACTIVE_APPLICATION_STATUSES },
    })
    if (existing) {
      return { success: false, error: "You already have an application in review" }
    }

    // Re-apply cooldown after a rejection.
    const lastRejected = await InstructorApplication.findOne({ user: user.id, status: "rejected" })
      .sort({ decidedAt: -1 })
      .select("decidedAt")
      .lean()
    if (lastRejected?.decidedAt) {
      const eligibleAt = new Date(
        new Date(lastRejected.decidedAt).getTime() + REAPPLY_COOLDOWN_DAYS * 24 * 3600 * 1000
      )
      if (eligibleAt.getTime() > Date.now()) {
        return {
          success: false,
          error: `You can re-apply from ${eligibleAt.toLocaleDateString("en-US", { dateStyle: "medium" })}`,
        }
      }
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
        cvUrl: sanitizeUrl(input.cvUrl),
      },
      termsAcceptedAt: new Date(),
      history: [
        {
          status: "submitted",
          at: new Date(),
          by: `${user.firstName} ${user.lastName}`.trim(),
        },
      ],
    })

    await User.findByIdAndUpdate(user.id, { $set: { instructorStatus: "applied" } })

    // Fire-and-forget: bell + email for admins, email receipt for the applicant.
    void notifyAdmins({
      type: "application",
      title: "New instructor application",
      body: `${user.firstName} ${user.lastName} applied: "${headline}"`,
      href: `/admin/applications/${application._id.toString()}`,
    })
    void (async () => {
      const admins = await User.find({ role: "ADMIN" }).select("email").lean()
      const reviewUrl = `${APP_URL}/admin/applications/${application._id.toString()}`
      await Promise.allSettled(
        admins
          .filter((a) => a.email && !a.email.endsWith("@users.noemail"))
          .map((a) =>
            sendNewApplicationAdminEmail(a.email, {
              applicantName: `${user.firstName} ${user.lastName}`.trim(),
              applicantAvatarUrl: user.avatarUrl ?? undefined,
              headline,
              reviewUrl,
            })
          )
      )
    })()
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
        cvUrl: app.answers.cvUrl ?? undefined,
      },
      decisionNote: app.decisionNote ?? "",
      history: (app.history ?? []).map((h) => ({
        status: h.status,
        at: new Date(h.at).toISOString(),
        note: h.note,
      })),
      createdAt: app.createdAt.toISOString(),
      interview,
      proposedSlots:
        // Slots are only actionable before an interview is locked in.
        !interview && ACTIVE_APPLICATION_STATUSES.includes(app.status)
          ? (app.proposedSlots ?? [])
              .filter((s) => new Date(s.at).getTime() > Date.now())
              .map((s) => ({ at: new Date(s.at).toISOString(), note: s.note }))
          : [],
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
  assignedToName: string
  /** Waiting > 48h with nobody on it. */
  overdue: boolean
}

export async function adminListApplications(filters?: {
  status?: ApplicationStatus | "all" | "active"
  page?: number
  /** Only applications assigned to the calling admin. */
  mine?: boolean
  /** Case-insensitive match on expertise tags. */
  expertise?: string
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
    const admin = await requireAdmin()

    const page = Math.max(1, filters?.page ?? 1)
    const query: Record<string, unknown> = {}
    if (filters?.status === "active") {
      query.status = { $in: ACTIVE_APPLICATION_STATUSES }
    } else if (filters?.status && filters.status !== "all") {
      query.status = filters.status
    }
    if (filters?.mine) query.assignedTo = admin.id
    if (filters?.expertise?.trim()) {
      query["answers.expertise"] = new RegExp(
        filters.expertise.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i"
      )
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
          assignedToName: a.assignedToName ?? "",
          overdue:
            a.status === "submitted" &&
            !a.assignedTo &&
            Date.now() - new Date(a.createdAt).getTime() > 48 * 3600 * 1000,
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

export type ScorecardView = {
  expertiseDepth: number
  communication: number
  productionReadiness: number
  recommendation: "approve" | "reject" | "unsure"
  notes: string
  byName: string
  at: string
}

export type AdminApplicationDetail = AdminApplicationRow & {
  answers: ApplicationAnswersInput
  reviewerNotes: { byName: string; note: string; at: string }[]
  decisionNote: string
  rejectionReason: string
  decidedAt: string | null
  history: { status: string; at: string; by?: string; note?: string }[]
  applicantJoinedAt: string | null
  applicantEnrollments: number
  interview: InterviewInfo | null
  proposedSlots: ProposedSlotView[]
  scorecard: ScorecardView | null
  termsAcceptedAt: string | null
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
      assignedToName: a.assignedToName ?? "",
      overdue:
        a.status === "submitted" &&
        !a.assignedTo &&
        Date.now() - new Date(a.createdAt).getTime() > 48 * 3600 * 1000,
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
        cvUrl: a.answers.cvUrl ?? undefined,
      },
      reviewerNotes: (a.reviewerNotes ?? [])
        .map((n) => ({ byName: n.byName, note: n.note, at: new Date(n.at).toISOString() }))
        .reverse(),
      decisionNote: a.decisionNote ?? "",
      rejectionReason: a.rejectionReason ?? "",
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
      proposedSlots: (a.proposedSlots ?? []).map((s) => ({
        at: new Date(s.at).toISOString(),
        note: s.note,
      })),
      scorecard: a.scorecard
        ? {
            expertiseDepth: a.scorecard.expertiseDepth,
            communication: a.scorecard.communication,
            productionReadiness: a.scorecard.productionReadiness,
            recommendation: a.scorecard.recommendation,
            notes: a.scorecard.notes ?? "",
            byName: a.scorecard.byName ?? "",
            at: a.scorecard.at ? new Date(a.scorecard.at).toISOString() : "",
          }
        : null,
      termsAcceptedAt: a.termsAcceptedAt ? new Date(a.termsAcceptedAt).toISOString() : null,
    }
  } catch (error) {
    console.error("Admin get application error:", error)
    return null
  }
}

type InterviewHost = {
  id: string
  name: string
  avatarUrl?: string | null
}

/**
 * Shared interview-scheduling core — used by the admin's direct "Schedule
 * interview" AND by the applicant picking one of the proposed slots.
 *
 * Creates (or reschedules) a Meeting with status "scheduled" + a real waiting
 * room and the RTK room minted up front — the host's join via the standard
 * `?join=` deep link flips it live. The applicant is invited via invites[],
 * notified in-app, and emailed the join link with an .ics calendar attachment.
 */
async function scheduleInterviewCore(
  app: HydratedDocument<import("@/lib/db/models").IInstructorApplication>,
  host: InterviewHost,
  scheduledAt: Date,
  byName: string
) {
  const applicant = app.user as unknown as {
    _id: Types.ObjectId
    firstName?: string
    lastName?: string
    email?: string
    avatarUrl?: string | null
  }
  const applicantName = `${applicant.firstName ?? ""} ${applicant.lastName ?? ""}`.trim() || "Applicant"

  // Reschedule path: reuse the existing meeting if it hasn't ended.
  let meetingDoc = app.interviewMeetingId
    ? await Meeting.findOne({ _id: app.interviewMeetingId, status: { $ne: "ended" } })
    : null
  let rescheduled = false

  if (meetingDoc) {
    meetingDoc.scheduledAt = scheduledAt
    // A moved interview needs fresh reminders.
    meetingDoc.reminders = { h24SentAt: null, h1SentAt: null }
    await meetingDoc.save()
    rescheduled = true
  } else {
    // Mint the RTK room + host token up front, mirroring createMeeting.
    const rtkMeetingId = await createRTKMeeting(`Interview: ${applicantName}`)
    const hostParticipant = await addParticipant(rtkMeetingId, {
      name: host.name,
      customParticipantId: host.id,
      presetName: "group_call_host",
    })

    meetingDoc = await Meeting.create({
      title: `Instructor Interview — ${applicantName}`,
      description: "Interview call for a WorldStreet Academy instructor application.",
      hostId: new Types.ObjectId(host.id),
      status: "scheduled",
      scheduledAt,
      meetingId: rtkMeetingId,
      hostToken: hostParticipant.authToken,
      applicationId: app._id,
      participants: [
        {
          userId: new Types.ObjectId(host.id),
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
        guestAccess: false, // real waiting room — the host admits the applicant
        maxParticipants: 10,
      },
    })
  }

  // Application state: interview_scheduled + pointer + history; proposed slots
  // are consumed by the pick (or superseded by a direct schedule).
  app.interviewMeetingId = meetingDoc._id
  app.proposedSlots = []
  if (app.status !== "interview_scheduled") {
    app.status = "interview_scheduled"
  }
  app.history.push({
    status: "interview_scheduled",
    at: new Date(),
    by: byName,
    note: `${rescheduled ? "Rescheduled" : "Scheduled"} for ${scheduledAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`,
  })
  await app.save()
  await User.findByIdAndUpdate(applicant._id, { $set: { instructorStatus: "interview" } })

  const joinPath = `/dashboard/meetings?join=${meetingDoc._id.toString()}`

  // Fire-and-forget: bell + email (with calendar attachment) to the applicant.
  void notifyUser(applicant._id.toString(), {
    type: "meeting",
    title: rescheduled ? "Your interview was rescheduled" : "Interview scheduled 🎙️",
    body: `${scheduledAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} — with ${host.name}`,
    href: "/dashboard/become-instructor",
  })
  if (applicant.email) {
    const ics = buildInterviewIcs({
      uid: meetingDoc._id.toString(),
      title: "WorldStreet Academy — Instructor Interview",
      description: `Interview with ${host.name} about your instructor application.`,
      startsAt: scheduledAt,
      durationMinutes: 30,
      url: `${APP_URL}${joinPath}`,
      organizerName: host.name,
    })
    void sendInterviewInviteEmail(
      applicant.email,
      {
        applicantName: applicant.firstName || "there",
        applicantAvatarUrl: applicant.avatarUrl ?? undefined,
        hostName: host.name,
        hostAvatarUrl: host.avatarUrl ?? undefined,
        scheduledAt: scheduledAt.toISOString(),
        joinUrl: `${APP_URL}${joinPath}`,
      },
      ics
    )
  }

  return { meetingId: meetingDoc._id.toString(), joinPath, rescheduled }
}

/** Admin schedules (or reschedules) the interview directly at a specific time. */
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

    const adminName = `${admin.firstName} ${admin.lastName}`.trim()
    const result = await scheduleInterviewCore(
      app,
      { id: admin.id, name: adminName, avatarUrl: admin.avatarUrl },
      scheduledAt,
      adminName
    )

    revalidatePath(`/admin/applications/${applicationId}`)
    revalidatePath("/admin/applications")
    return { success: true, ...result }
  } catch (error) {
    console.error("Schedule interview error:", error)
    return { success: false, error: "Failed to schedule interview" }
  }
}

/**
 * Admin proposes 2–3 interview slots; the applicant picks one from their
 * status page. Proposing implies review has started.
 */
export async function adminProposeSlots(
  applicationId: string,
  slots: { at: string; note?: string }[]
) {
  try {
    await connectDB()
    const admin = await requireAdmin()

    const parsed = (slots ?? [])
      .map((s) => ({ at: new Date(s.at), note: s.note?.trim() || undefined }))
      .filter((s) => !isNaN(s.at.getTime()) && s.at.getTime() > Date.now())
      .sort((a, b) => a.at.getTime() - b.at.getTime())
      .slice(0, 3)
    if (parsed.length === 0) {
      return { success: false, error: "Propose at least one future time slot" }
    }

    const app = await InstructorApplication.findById(applicationId).populate(
      "user",
      "firstName lastName email avatarUrl"
    )
    if (!app) return { success: false, error: "Application not found" }
    if (!ACTIVE_APPLICATION_STATUSES.includes(app.status)) {
      return { success: false, error: `Application is already ${app.status}` }
    }

    const adminName = `${admin.firstName} ${admin.lastName}`.trim()
    app.proposedSlots = parsed as typeof app.proposedSlots
    app.slotsProposedBy = admin.id as unknown as typeof app.slotsProposedBy
    app.slotsProposedAt = new Date()
    if (app.status === "submitted") app.status = "under_review"
    app.history.push({
      status: app.status,
      at: new Date(),
      by: adminName,
      note: `Proposed ${parsed.length} interview slot${parsed.length === 1 ? "" : "s"}`,
    })
    await app.save()

    const applicant = app.user as unknown as {
      _id: Types.ObjectId
      firstName?: string
      email?: string
      avatarUrl?: string | null
    }

    void notifyUser(applicant._id.toString(), {
      type: "application",
      title: "Pick your interview time 🎙️",
      body: `${adminName} proposed ${parsed.length} time slot${parsed.length === 1 ? "" : "s"} — choose what works for you.`,
      href: "/dashboard/become-instructor",
    })
    if (applicant.email) {
      void sendSlotsProposedEmail(applicant.email, {
        applicantName: applicant.firstName || "there",
        applicantAvatarUrl: applicant.avatarUrl ?? undefined,
        hostName: adminName,
        slots: parsed.map((s) => s.at.toISOString()),
        pickUrl: `${APP_URL}/dashboard/become-instructor`,
      })
    }

    revalidatePath(`/admin/applications/${applicationId}`)
    revalidatePath("/admin/applications")
    return { success: true }
  } catch (error) {
    console.error("Propose slots error:", error)
    return { success: false, error: "Failed to propose slots" }
  }
}

/** Applicant picks one of the proposed slots — schedules the interview for real. */
export async function pickInterviewSlot(applicationId: string, slotAtISO: string) {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "Not authenticated" }

    const app = await InstructorApplication.findOne({
      _id: applicationId,
      user: user.id,
    }).populate("user", "firstName lastName email avatarUrl")
    if (!app) return { success: false, error: "Application not found" }
    if (!ACTIVE_APPLICATION_STATUSES.includes(app.status)) {
      return { success: false, error: `Application is already ${app.status}` }
    }

    const picked = (app.proposedSlots ?? []).find(
      (s) => new Date(s.at).getTime() === new Date(slotAtISO).getTime()
    )
    if (!picked) return { success: false, error: "That slot is no longer available" }
    if (new Date(picked.at).getTime() < Date.now()) {
      return { success: false, error: "That slot has passed — ask for new times" }
    }

    // Host = the admin who proposed the slots (fallback: any admin).
    let host = app.slotsProposedBy
      ? await User.findById(app.slotsProposedBy).select("firstName lastName avatarUrl").lean()
      : null
    if (!host) {
      host = await User.findOne({ role: "ADMIN" }).select("firstName lastName avatarUrl").lean()
    }
    if (!host) return { success: false, error: "No reviewer available — contact support" }

    const hostName = `${host.firstName ?? ""} ${host.lastName ?? ""}`.trim() || "WorldStreet Team"
    const applicantName = `${user.firstName} ${user.lastName}`.trim()
    const result = await scheduleInterviewCore(
      app,
      { id: host._id.toString(), name: hostName, avatarUrl: host.avatarUrl ?? null },
      new Date(picked.at),
      applicantName
    )

    // Tell the reviewer which slot won.
    void notifyUser(host._id.toString(), {
      type: "meeting",
      title: "Interview slot confirmed",
      body: `${applicantName} picked ${new Date(picked.at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`,
      href: `/admin/applications/${app._id.toString()}`,
    })

    revalidatePath("/dashboard/become-instructor")
    return { success: true, ...result }
  } catch (error) {
    console.error("Pick slot error:", error)
    return { success: false, error: "Failed to confirm the slot" }
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
    void (async () => {
      const applicant = await User.findById(app.user).select("email firstName avatarUrl").lean()
      if (applicant?.email && !applicant.email.endsWith("@users.noemail")) {
        await sendUnderReviewEmail(applicant.email, {
          applicantName: applicant.firstName || "there",
          applicantAvatarUrl: applicant.avatarUrl ?? undefined,
          statusUrl: `${APP_URL}/dashboard/become-instructor`,
        })
      }
    })()

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
  note?: string,
  rejectionReason?: RejectionReason
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
    if (decision === "rejected" && rejectionReason) {
      app.rejectionReason = rejectionReason
    }
    app.history.push({ status: decision, at: new Date(), by: adminName, note: decisionNote })
    await app.save()

    // Targeted $set updates — never doc.save(): legacy user rows that fail
    // full-document validation (e.g. seed accounts without authUserId) must
    // not abort the promotion/notification half of a decision.
    if (decision === "approved") {
      const newRole = user.role === "USER" ? "INSTRUCTOR" : user.role
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            role: newRole,
            instructorStatus: "approved",
            instructorProfile: {
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
            },
          },
        }
      )
      user.role = newRole
      if (user.authUserId) await syncRoleToClerk(user.authUserId, newRole)
    } else {
      await User.updateOne({ _id: user._id }, { $set: { instructorStatus: "rejected" } })
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

/* ═══════════════════ admin ops: assignment, scorecard, export ═══════════════════ */

/** Assign the application to an admin (self-assign from the UI) or clear it. */
export async function adminAssignApplication(applicationId: string, assign: boolean) {
  try {
    await connectDB()
    const admin = await requireAdmin()

    const app = await InstructorApplication.findById(applicationId)
    if (!app) return { success: false, error: "Application not found" }

    const adminName = `${admin.firstName} ${admin.lastName}`.trim()
    if (assign) {
      app.assignedTo = admin.id as unknown as typeof app.assignedTo
      app.assignedToName = adminName
    } else {
      app.assignedTo = null
      app.assignedToName = ""
    }
    await app.save()

    revalidatePath(`/admin/applications/${applicationId}`)
    revalidatePath("/admin/applications")
    return { success: true, assignedToName: app.assignedToName }
  } catch (error) {
    console.error("Assign application error:", error)
    return { success: false, error: "Failed to update assignment" }
  }
}

/** Save (overwrite) the structured interview scorecard. */
export async function adminSaveScorecard(
  applicationId: string,
  input: {
    expertiseDepth: number
    communication: number
    productionReadiness: number
    recommendation: "approve" | "reject" | "unsure"
    notes?: string
  }
) {
  try {
    await connectDB()
    const admin = await requireAdmin()

    const clamp = (v: number) => Math.min(5, Math.max(1, Math.round(v)))
    const scorecard: IScorecard = {
      expertiseDepth: clamp(input.expertiseDepth),
      communication: clamp(input.communication),
      productionReadiness: clamp(input.productionReadiness),
      recommendation: input.recommendation,
      notes: input.notes?.trim() ?? "",
      byName: `${admin.firstName} ${admin.lastName}`.trim(),
      at: new Date(),
    }

    const app = await InstructorApplication.findByIdAndUpdate(
      applicationId,
      { $set: { scorecard } },
      { new: true }
    )
    if (!app) return { success: false, error: "Application not found" }

    revalidatePath(`/admin/applications/${applicationId}`)
    return { success: true }
  } catch (error) {
    console.error("Save scorecard error:", error)
    return { success: false, error: "Failed to save scorecard" }
  }
}

/** CSV export of applications (most recent 1000) for offline review/reporting. */
export async function adminExportApplicationsCsv(): Promise<
  { success: true; csv: string } | { success: false; error: string }
> {
  try {
    await connectDB()
    await requireAdmin()

    const rows = await InstructorApplication.find({})
      .sort({ createdAt: -1 })
      .limit(1000)
      .populate("user", "firstName lastName email")
      .lean()

    const esc = (v: unknown) => {
      const s = String(v ?? "")
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const header = [
      "submitted_at",
      "status",
      "name",
      "email",
      "headline",
      "expertise",
      "experience_years",
      "assigned_to",
      "recommendation",
      "decided_at",
      "rejection_reason",
    ].join(",")

    const lines = rows.map((a) => {
      const u = a.user as unknown as { firstName?: string; lastName?: string; email?: string } | null
      return [
        esc(a.createdAt.toISOString()),
        esc(a.status),
        esc(u ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() : ""),
        esc(u?.email ?? ""),
        esc(a.answers?.headline ?? ""),
        esc((a.answers?.expertise ?? []).join("; ")),
        esc(a.answers?.experienceYears ?? ""),
        esc(a.assignedToName ?? ""),
        esc(a.scorecard?.recommendation ?? ""),
        esc(a.decidedAt ? new Date(a.decidedAt).toISOString() : ""),
        esc(a.rejectionReason ?? ""),
      ].join(",")
    })

    return { success: true, csv: [header, ...lines].join("\n") }
  } catch (error) {
    console.error("Export applications error:", error)
    return { success: false, error: "Export failed" }
  }
}
