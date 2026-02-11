"use server"

import { Types } from "mongoose"
import connectDB from "@/lib/db"
import { Meeting, User, Course, Enrollment, type IMeeting, type IMeetingParticipant, type MeetingStatus } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth"
import { createMeeting as createRTKMeeting, addParticipant } from "@/lib/realtime"
import { emitEvent, emitEventToMany, type MeetingEventPayload } from "@/lib/call-events"
import { sendMeetingNotificationEmail, sendMeetingInviteEmail } from "@/lib/email"

// ── Helpers ──

/** Parallelize DB connection + auth — saves ~30-80ms per action */
async function initAction() {
  const [, currentUser] = await Promise.all([connectDB(), getCurrentUser()])
  return currentUser
}

/** Fire-and-forget: schedule DB write without blocking the response */
function backgroundSave(promise: Promise<unknown>) {
  promise.catch((err) => console.error("[Meeting] Background save failed:", err))
}

// ── Types ──

export type MeetingRole = "host" | "co-host" | "participant" | "guest"

export type MeetingSettings = {
  allowScreenShare: boolean
  muteOnEntry: boolean
  requireApproval: boolean
  guestAccess: boolean
  maxParticipants: number
}

export type MeetingWithDetails = {
  id: string
  title: string
  description?: string
  hostId: string
  hostName: string
  hostAvatar: string | null
  status: MeetingStatus
  meetingId: string
  participantCount: number
  maxParticipants: number
  settings: MeetingSettings
  createdAt: string
  startedAt?: string
  courseId?: string
  courseThumbnailUrl?: string
}

/** Converts a Mongoose settings subdocument to a plain object */
function serializeSettings(s: IMeeting["settings"]): MeetingSettings {
  return {
    allowScreenShare: !!s.allowScreenShare,
    muteOnEntry: !!s.muteOnEntry,
    requireApproval: !!s.requireApproval,
    guestAccess: s.guestAccess !== false,
    maxParticipants: s.maxParticipants ?? 50,
  }
}

export type MeetingParticipantDetails = {
  userId: string
  name: string
  avatar: string | null
  role: MeetingRole
  status: "pending" | "admitted" | "declined" | "left" | "kicked"
  joinedAt?: string
}

// ── Create a new meeting ──

export async function createMeeting(
  title: string,
  description?: string
): Promise<{
  success: boolean
  meeting?: MeetingWithDetails
  authToken?: string
  error?: string
}> {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    // Create RTK meeting room — sequential (addParticipant needs meetingId)
    const rtkMeetingId = await createRTKMeeting(`Meeting: ${title}`)
    const hostParticipant = await addParticipant(rtkMeetingId, {
      name: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
      customParticipantId: currentUser.id,
      presetName: "group_call_host",
    })

    // Create meeting record
    const meeting = await Meeting.create({
      title,
      description,
      hostId: new Types.ObjectId(currentUser.id),
      status: "active",
      meetingId: rtkMeetingId,
      hostToken: hostParticipant.authToken,
      startedAt: new Date(),
      participants: [
        {
          userId: new Types.ObjectId(currentUser.id),
          role: "host",
          status: "admitted",
          joinedAt: new Date(),
        },
      ],
      settings: {
        allowScreenShare: true,
        muteOnEntry: true,
        requireApproval: true,
        guestAccess: true,
        maxParticipants: 50,
      },
    })

    return {
      success: true,
      authToken: hostParticipant.authToken,
      meeting: {
        id: meeting._id.toString(),
        title: meeting.title,
        description: meeting.description,
        hostId: currentUser.id,
        hostName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
        hostAvatar: currentUser.avatarUrl,
        status: meeting.status,
        meetingId: rtkMeetingId,
        participantCount: 1,
        maxParticipants: 50,
        settings: serializeSettings(meeting.settings),
        createdAt: meeting.createdAt.toISOString(),
        startedAt: meeting.startedAt?.toISOString(),
      },
    }
  } catch (error) {
    console.error("Error creating meeting:", error)
    return { success: false, error: "Failed to create meeting" }
  }
}

// ── Join a meeting (request to join) ──

export async function joinMeeting(meetingId: string): Promise<{
  success: boolean
  authToken?: string
  meeting?: MeetingWithDetails
  role?: MeetingRole
  requiresApproval?: boolean
  error?: string
}> {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const meeting = await Meeting.findById(meetingId)
    if (!meeting) return { success: false, error: "Meeting not found" }

    if (meeting.status === "ended") return { success: false, error: "Meeting has ended" }

    // Host already has access — use currentUser directly (skip DB lookup)
    if (meeting.hostId.toString() === currentUser.id) {
      return {
        success: true,
        authToken: meeting.hostToken,
        role: "host",
        meeting: {
          id: meeting._id.toString(),
          title: meeting.title,
          description: meeting.description,
          hostId: currentUser.id,
          hostName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
          hostAvatar: currentUser.avatarUrl,
          status: meeting.status,
          meetingId: meeting.meetingId,
          participantCount: meeting.participants.filter((p) => p.status === "admitted").length,
          maxParticipants: meeting.settings.maxParticipants,
          settings: serializeSettings(meeting.settings),
          createdAt: meeting.createdAt.toISOString(),
          startedAt: meeting.startedAt?.toISOString(),
        },
      }
    }

    const userId = new Types.ObjectId(currentUser.id)
    const existingP = meeting.participants.find(
      (p) => p.userId.toString() === currentUser.id
    )

    // Check if user was kicked from this meeting — they cannot rejoin
    if (existingP?.status === "kicked") {
      return { success: false, error: "You have been removed from this meeting and cannot rejoin" }
    }

    // Already admitted — parallelize RTK token + host lookup
    if (existingP?.status === "admitted") {
      const [participant, host] = await Promise.all([
        addParticipant(meeting.meetingId, {
          name: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
          customParticipantId: currentUser.id,
          presetName: "group_call_participant",
        }),
        User.findById(meeting.hostId).select("firstName lastName avatarUrl").lean(),
      ])

      return {
        success: true,
        authToken: participant.authToken,
        role: (existingP.role as MeetingRole) || "participant",
        meeting: {
          id: meeting._id.toString(),
          title: meeting.title,
          description: meeting.description,
          hostId: meeting.hostId.toString(),
          hostName: host ? `${host.firstName} ${host.lastName}`.trim() : "Host",
          hostAvatar: host?.avatarUrl || null,
          status: meeting.status,
          meetingId: meeting.meetingId,
          participantCount: meeting.participants.filter((p) => p.status === "admitted").length,
          maxParticipants: meeting.settings.maxParticipants,
          settings: serializeSettings(meeting.settings),
          createdAt: meeting.createdAt.toISOString(),
          startedAt: meeting.startedAt?.toISOString(),
        },
      }
    }

    // Already pending
    if (existingP?.status === "pending") {
      return { success: true, requiresApproval: true, meeting: { id: meeting._id.toString(), title: meeting.title, hostId: meeting.hostId.toString(), hostName: "", hostAvatar: null, status: meeting.status, meetingId: meeting.meetingId, participantCount: 0, maxParticipants: meeting.settings.maxParticipants, settings: serializeSettings(meeting.settings), createdAt: meeting.createdAt.toISOString() } }
    }

    // Add as new participant
    // Determine join mode: guest auto-admit, pending approval, or direct participant
    const requiresApproval = meeting.settings.requireApproval
    const guestAccess = meeting.settings.guestAccess !== false

    if (requiresApproval && guestAccess) {
      // Auto-admit as guest — no waiting room
      meeting.participants.push({
        userId,
        role: "guest",
        status: "admitted",
        joinedAt: new Date(),
      } as IMeetingParticipant)

      // Parallelize save, RTK token, host lookup, and broadcast
      const admittedIds = meeting.participants
        .filter((p) => p.status === "admitted" && p.userId.toString() !== currentUser.id)
        .map((p) => p.userId.toString())
      const joinedEvent: MeetingEventPayload = {
        type: "meeting:participant-joined",
        meetingId: meeting._id.toString(),
        meetingTitle: meeting.title,
        userId: currentUser.id,
        userName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
        userAvatar: currentUser.avatarUrl,
        role: "guest",
      }
      const [, participant, host] = await Promise.all([
        meeting.save(),
        addParticipant(meeting.meetingId, {
          name: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
          customParticipantId: currentUser.id,
          presetName: "group_call_participant",
        }),
        User.findById(meeting.hostId).select("firstName lastName avatarUrl").lean(),
        admittedIds.length > 0 ? emitEventToMany(admittedIds, joinedEvent) : Promise.resolve(),
      ])

      return {
        success: true,
        authToken: participant.authToken,
        role: "guest" as MeetingRole,
        meeting: {
          id: meeting._id.toString(),
          title: meeting.title,
          description: meeting.description,
          hostId: meeting.hostId.toString(),
          hostName: host ? `${host.firstName} ${host.lastName}`.trim() : "Host",
          hostAvatar: host?.avatarUrl || null,
          status: meeting.status,
          meetingId: meeting.meetingId,
          participantCount: meeting.participants.filter((p) => p.status === "admitted").length,
          maxParticipants: meeting.settings.maxParticipants,
          settings: serializeSettings(meeting.settings),
          createdAt: meeting.createdAt.toISOString(),
          startedAt: meeting.startedAt?.toISOString(),
        },
      }
    }

    if (requiresApproval && !guestAccess) {
      // Traditional approval flow
      const existingPending = meeting.participants.find(
        (p) => p.userId.toString() === currentUser.id && p.status === "pending"
      )
      if (!existingPending) {
        meeting.participants.push({
          userId,
          role: "participant",
          status: "pending",
        } as IMeetingParticipant)
      }
      const eventPayload: MeetingEventPayload = {
        type: "meeting:join-request",
        meetingId: meeting._id.toString(),
        meetingTitle: meeting.title,
        userId: currentUser.id,
        userName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
        userAvatar: currentUser.avatarUrl,
      }
      await Promise.all([
        meeting.save(),
        emitEvent(meeting.hostId.toString(), eventPayload),
      ])

      return { success: true, requiresApproval: true, meeting: { id: meeting._id.toString(), title: meeting.title, hostId: meeting.hostId.toString(), hostName: "", hostAvatar: null, status: meeting.status, meetingId: meeting.meetingId, participantCount: 0, maxParticipants: meeting.settings.maxParticipants, settings: serializeSettings(meeting.settings), createdAt: meeting.createdAt.toISOString() } }
    }

    // Auto-admit as participant — parallelize save, RTK token, host lookup, and broadcast
    meeting.participants.push({
      userId,
      role: "participant",
      status: "admitted",
      joinedAt: new Date(),
    } as IMeetingParticipant)

    // Collect other admitted participant IDs for broadcast BEFORE saving
    const otherAdmittedIds = meeting.participants
      .filter((p) => p.status === "admitted" && p.userId.toString() !== currentUser.id)
      .map((p) => p.userId.toString())
    const joinedEvent: MeetingEventPayload = {
      type: "meeting:participant-joined",
      meetingId: meeting._id.toString(),
      meetingTitle: meeting.title,
      userId: currentUser.id,
      userName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
      userAvatar: currentUser.avatarUrl,
      role: "participant",
    }

    const [, participant, host] = await Promise.all([
      meeting.save(),
      addParticipant(meeting.meetingId, {
        name: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
        customParticipantId: currentUser.id,
        presetName: "group_call_participant",
      }),
      User.findById(meeting.hostId).select("firstName lastName avatarUrl").lean(),
      otherAdmittedIds.length > 0 ? emitEventToMany(otherAdmittedIds, joinedEvent) : Promise.resolve(),
    ])

    return {
      success: true,
      authToken: participant.authToken,
      role: "participant" as MeetingRole,
      meeting: {
        id: meeting._id.toString(),
        title: meeting.title,
        description: meeting.description,
        hostId: meeting.hostId.toString(),
        hostName: host ? `${host.firstName} ${host.lastName}`.trim() : "Host",
        hostAvatar: host?.avatarUrl || null,
        status: meeting.status,
        meetingId: meeting.meetingId,
        participantCount: meeting.participants.filter((p) => p.status === "admitted").length,
        maxParticipants: meeting.settings.maxParticipants,
        settings: serializeSettings(meeting.settings),
        createdAt: meeting.createdAt.toISOString(),
        startedAt: meeting.startedAt?.toISOString(),
      },
    }
  } catch (error) {
    console.error("Error joining meeting:", error)
    return { success: false, error: "Failed to join meeting" }
  }
}

// ── Admit a participant ──

export async function admitParticipant(
  meetingId: string,
  userId: string
): Promise<{ success: boolean; authToken?: string; error?: string }> {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const meeting = await Meeting.findById(meetingId)
    if (!meeting) return { success: false, error: "Meeting not found" }
    if (meeting.hostId.toString() !== currentUser.id) {
      return { success: false, error: "Only host can admit participants" }
    }

    const participant = meeting.participants.find(
      (p) => p.userId.toString() === userId
    )
    if (!participant) return { success: false, error: "Participant not found" }

    participant.status = "admitted"
    participant.role = "participant"
    participant.joinedAt = new Date()

    // Parallelize ALL independent operations: DB save, user lookup, AND RTK token generation
    const [, user, rtkParticipant] = await Promise.all([
      meeting.save(),
      User.findById(userId).select("firstName lastName avatarUrl").lean(),
      addParticipant(meeting.meetingId, {
        name: "Participant", // placeholder — RTK only needs a display name
        customParticipantId: userId,
        presetName: "group_call_participant",
      }),
    ])

    const participantName = user ? `${user.firstName} ${user.lastName}`.trim() : "Participant"

    // Notify the admitted participant
    const admittedPayload: MeetingEventPayload = {
      type: "meeting:admitted",
      meetingId: meeting._id.toString(),
      meetingTitle: meeting.title,
      userId: currentUser.id,
      userName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
      userAvatar: currentUser.avatarUrl,
      authToken: rtkParticipant.authToken,
    }

    // Broadcast participant-joined to all OTHER admitted participants
    const joinedPayload: MeetingEventPayload = {
      type: "meeting:participant-joined",
      meetingId: meeting._id.toString(),
      meetingTitle: meeting.title,
      userId,
      userName: participantName,
      userAvatar: user?.avatarUrl || null,
      role: "participant",
    }
    const otherAdmitted = meeting.participants
      .filter((p) => p.status === "admitted" && p.userId.toString() !== userId)
      .map((p) => p.userId.toString())

    // Fire-and-forget broadcasts — don't block the response
    const broadcastPromise = Promise.all([
      emitEvent(userId, admittedPayload),
      otherAdmitted.length > 0 ? emitEventToMany(otherAdmitted, joinedPayload) : Promise.resolve(),
    ])
    backgroundSave(broadcastPromise)

    return { success: true, authToken: rtkParticipant.authToken }
  } catch (error) {
    console.error("Error admitting participant:", error)
    return { success: false, error: "Failed to admit participant" }
  }
}

// ── Decline a participant ──

export async function declineParticipant(
  meetingId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const meeting = await Meeting.findById(meetingId)
    if (!meeting) return { success: false, error: "Meeting not found" }
    if (meeting.hostId.toString() !== currentUser.id) {
      return { success: false, error: "Only host can decline participants" }
    }

    const participant = meeting.participants.find(
      (p) => p.userId.toString() === userId
    )
    if (!participant) return { success: false, error: "Participant not found" }

    participant.status = "declined"

    // Save and notify in parallel — instant user notification
    const eventPayload: MeetingEventPayload = {
      type: "meeting:declined",
      meetingId: meeting._id.toString(),
      meetingTitle: meeting.title,
      userId: currentUser.id,
      userName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
      userAvatar: currentUser.avatarUrl,
    }
    await Promise.all([
      meeting.save(),
      emitEvent(userId, eventPayload),
    ])

    return { success: true }
  } catch (error) {
    console.error("Error declining participant:", error)
    return { success: false, error: "Failed to decline participant" }
  }
}

// ── Start a meeting (host only) ──

export async function startMeeting(meetingId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const meeting = await Meeting.findById(meetingId)
    if (!meeting) return { success: false, error: "Meeting not found" }
    if (meeting.hostId.toString() !== currentUser.id) {
      return { success: false, error: "Only host can start meeting" }
    }

    meeting.status = "active"
    meeting.startedAt = new Date()
    await meeting.save()

    return { success: true }
  } catch (error) {
    console.error("Error starting meeting:", error)
    return { success: false, error: "Failed to start meeting" }
  }
}

// ── End a meeting ──

export async function endMeeting(meetingId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const meeting = await Meeting.findById(meetingId)
    if (!meeting) return { success: false, error: "Meeting not found" }
    if (meeting.hostId.toString() !== currentUser.id) {
      return { success: false, error: "Only host can end meeting" }
    }

    // Collect participant IDs to notify BEFORE mutating
    const participantIdsToNotify = meeting.participants
      .filter((p) => p.status === "admitted" && p.userId.toString() !== currentUser.id)
      .map((p) => p.userId.toString())

    meeting.status = "ended"
    meeting.endedAt = new Date()
    for (const p of meeting.participants) {
      if (p.status === "admitted") {
        p.status = "left"
        p.leftAt = new Date()
      }
    }

    // Save DB immediately, fire-and-forget Ably broadcasts
    const endPayload: MeetingEventPayload = {
      type: "meeting:ended",
      meetingId: meeting._id.toString(),
      meetingTitle: meeting.title,
      userId: currentUser.id,
      userName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
      userAvatar: currentUser.avatarUrl,
    }
    await meeting.save()
    // Don't block response — participants will get notified asynchronously
    if (participantIdsToNotify.length > 0) {
      backgroundSave(emitEventToMany(participantIdsToNotify, endPayload))
    }

    return { success: true }
  } catch (error) {
    console.error("Error ending meeting:", error)
    return { success: false, error: "Failed to end meeting" }
  }
}

// ── Get my meetings ──

export async function getMyMeetings(): Promise<{
  success: boolean
  meetings?: MeetingWithDetails[]
  error?: string
}> {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const userId = new Types.ObjectId(currentUser.id)

    const meetings = await Meeting.find({
      $or: [
        { hostId: userId },
        { "participants.userId": userId, "participants.status": "admitted" },
      ],
      status: { $ne: "ended" },
    })
      .sort({ createdAt: -1 })
      .lean()

    const hostIds = [...new Set(meetings.map((m) => m.hostId.toString()))]
    const hosts = await User.find({ _id: { $in: hostIds } })
      .select("firstName lastName avatarUrl")
      .lean()
    const hostMap = new Map(hosts.map((h) => [h._id.toString(), h]))

    return {
      success: true,
      meetings: meetings.map((m) => {
        const host = hostMap.get(m.hostId.toString())
        return {
          id: m._id.toString(),
          title: m.title,
          description: m.description,
          hostId: m.hostId.toString(),
          hostName: host ? `${host.firstName} ${host.lastName}`.trim() : "Unknown",
          hostAvatar: host?.avatarUrl || null,
          status: m.status,
          meetingId: m.meetingId,
          participantCount: m.participants.filter((p) => p.status === "admitted").length,
          maxParticipants: m.settings.maxParticipants,
          settings: serializeSettings(m.settings),
          createdAt: m.createdAt.toISOString(),
          startedAt: m.startedAt?.toISOString(),
        }
      }),
    }
  } catch (error) {
    console.error("Error fetching meetings:", error)
    return { success: false, error: "Failed to fetch meetings" }
  }
}

// ── Get meeting details with participants ──

export async function getMeetingDetails(meetingId: string): Promise<{
  success: boolean
  meeting?: MeetingWithDetails
  participants?: MeetingParticipantDetails[]
  authToken?: string
  error?: string
}> {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const meeting = await Meeting.findById(meetingId)
    if (!meeting) return { success: false, error: "Meeting not found" }

    // Check participant status before parallel operations
    const isHost = meeting.hostId.toString() === currentUser.id
    const myP = !isHost
      ? meeting.participants.find(
          (p) => p.userId.toString() === currentUser.id && p.status === "admitted"
        )
      : null

    // Parallelize user lookup + optional RTK token generation
    const participantIds = meeting.participants.map((p) => p.userId)
    const [users, rtkP] = await Promise.all([
      User.find({ _id: { $in: participantIds } })
        .select("firstName lastName avatarUrl")
        .lean(),
      myP
        ? addParticipant(meeting.meetingId, {
            name: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
            customParticipantId: currentUser.id,
            presetName: "group_call_participant",
          })
        : Promise.resolve(null),
    ])

    const userMap = new Map(users.map((u) => [u._id.toString(), u]))
    const host = userMap.get(meeting.hostId.toString())

    let authToken: string | undefined
    if (isHost) {
      authToken = meeting.hostToken
    } else if (rtkP) {
      authToken = rtkP.authToken
    }

    return {
      success: true,
      authToken,
      meeting: {
        id: meeting._id.toString(),
        title: meeting.title,
        description: meeting.description,
        hostId: meeting.hostId.toString(),
        hostName: host ? `${host.firstName} ${host.lastName}`.trim() : "Unknown",
        hostAvatar: host?.avatarUrl || null,
        status: meeting.status,
        meetingId: meeting.meetingId,
        participantCount: meeting.participants.filter((p) => p.status === "admitted").length,
        maxParticipants: meeting.settings.maxParticipants,
        settings: serializeSettings(meeting.settings),
        createdAt: meeting.createdAt.toISOString(),
        startedAt: meeting.startedAt?.toISOString(),
      },
      participants: meeting.participants.map((p) => {
        const u = userMap.get(p.userId.toString())
        return {
          userId: p.userId.toString(),
          name: u ? `${u.firstName} ${u.lastName}`.trim() : "Unknown",
          avatar: u?.avatarUrl || null,
          role: p.role,
          status: p.status,
          joinedAt: p.joinedAt?.toISOString(),
        }
      }),
    }
  } catch (error) {
    console.error("Error fetching meeting details:", error)
    return { success: false, error: "Failed to fetch meeting details" }
  }
}

// ── Get pending join requests (for host) ──

export async function getPendingRequests(meetingId: string): Promise<{
  success: boolean
  requests?: MeetingParticipantDetails[]
  error?: string
}> {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const meeting = await Meeting.findById(meetingId)
    if (!meeting) return { success: false, error: "Meeting not found" }
    if (meeting.hostId.toString() !== currentUser.id) {
      return { success: false, error: "Only host can view requests" }
    }

    const pending = meeting.participants.filter((p) => p.status === "pending")
    const userIds = pending.map((p) => p.userId)
    const users = await User.find({ _id: { $in: userIds } })
      .select("firstName lastName avatarUrl")
      .lean()
    const userMap = new Map(users.map((u) => [u._id.toString(), u]))

    return {
      success: true,
      requests: pending.map((p) => {
        const u = userMap.get(p.userId.toString())
        return {
          userId: p.userId.toString(),
          name: u ? `${u.firstName} ${u.lastName}`.trim() : "Unknown",
          avatar: u?.avatarUrl || null,
          role: p.role,
          status: p.status,
        }
      }),
    }
  } catch (error) {
    console.error("Error fetching pending requests:", error)
    return { success: false, error: "Failed to fetch requests" }
  }
}

// ── Leave a meeting ──

export async function leaveMeeting(meetingId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const meeting = await Meeting.findById(meetingId)
    if (!meeting) return { success: false, error: "Meeting not found" }

    const participant = meeting.participants.find(
      (p) => p.userId.toString() === currentUser.id
    )
    if (participant) {
      participant.status = "left"
      participant.leftAt = new Date()
      // Fire-and-forget — user is already leaving, no need to block
      backgroundSave(meeting.save())
    }

    return { success: true }
  } catch (error) {
    console.error("Error leaving meeting:", error)
    return { success: false, error: "Failed to leave meeting" }
  }
}

// ── Invite to stage (host only) ──

export async function inviteToStage(
  meetingId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const meeting = await Meeting.findById(meetingId)
    if (!meeting) return { success: false, error: "Meeting not found" }
    if (meeting.hostId.toString() !== currentUser.id) {
      return { success: false, error: "Only the host can invite to stage" }
    }

    // Update role to participant in DB
    const participant = meeting.participants.find(
      (p) => p.userId.toString() === userId && p.status === "admitted"
    )
    if (participant) participant.role = "participant"

    // Include host in broadcast so their grid updates
    const otherParticipantIds = meeting.participants
      .filter((p) => p.status === "admitted" && p.userId.toString() !== userId)
      .map((p) => p.userId.toString())

    // Emit role-changed to the target user
    const rolePayload: MeetingEventPayload = {
      type: "meeting:role-changed",
      meetingId: meeting._id.toString(),
      meetingTitle: meeting.title,
      userId,
      userName: "",
      userAvatar: null,
      role: "participant",
    }
    const stagePayload: MeetingEventPayload = {
      type: "meeting:stage-invite",
      meetingId: meeting._id.toString(),
      meetingTitle: meeting.title,
      userId: currentUser.id,
      userName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
      userAvatar: currentUser.avatarUrl,
      role: "participant",
    }

    const [user] = await Promise.all([
      User.findById(userId).select("firstName lastName avatarUrl").lean(),
      meeting.save(),
      emitEvent(userId, rolePayload),
      emitEvent(userId, stagePayload),
    ])

    // Broadcast role change to all others
    if (otherParticipantIds.length > 0) {
      const broadcastPayload: MeetingEventPayload = {
        type: "meeting:role-changed",
        meetingId: meeting._id.toString(),
        meetingTitle: meeting.title,
        userId,
        userName: user ? `${user.firstName} ${user.lastName}`.trim() : "Participant",
        userAvatar: user?.avatarUrl || null,
        role: "participant",
      }
      await emitEventToMany(otherParticipantIds, broadcastPayload)
    }

    return { success: true }
  } catch (error) {
    console.error("Error inviting to stage:", error)
    return { success: false, error: "Failed to invite to stage" }
  }
}

// ── Remove from stage (host only) ──

export async function removeFromStage(
  meetingId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const meeting = await Meeting.findById(meetingId)
    if (!meeting) return { success: false, error: "Meeting not found" }
    if (meeting.hostId.toString() !== currentUser.id) {
      return { success: false, error: "Only the host can remove from stage" }
    }

    // Update role to guest in DB
    const participant = meeting.participants.find(
      (p) => p.userId.toString() === userId && p.status === "admitted"
    )
    if (participant) participant.role = "guest"

    // Include host in broadcast so their grid updates
    const otherParticipantIds = meeting.participants
      .filter((p) => p.status === "admitted" && p.userId.toString() !== userId)
      .map((p) => p.userId.toString())

    // Emit role-changed to the target user
    const rolePayload: MeetingEventPayload = {
      type: "meeting:role-changed",
      meetingId: meeting._id.toString(),
      meetingTitle: meeting.title,
      userId,
      userName: "",
      userAvatar: null,
      role: "guest",
    }
    const stagePayload: MeetingEventPayload = {
      type: "meeting:stage-removed",
      meetingId: meeting._id.toString(),
      meetingTitle: meeting.title,
      userId: currentUser.id,
      userName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
      userAvatar: currentUser.avatarUrl,
      role: "guest",
    }

    const [user] = await Promise.all([
      User.findById(userId).select("firstName lastName avatarUrl").lean(),
      meeting.save(),
      emitEvent(userId, rolePayload),
      emitEvent(userId, stagePayload),
    ])

    // Broadcast role change to all others
    if (otherParticipantIds.length > 0) {
      const broadcastPayload: MeetingEventPayload = {
        type: "meeting:role-changed",
        meetingId: meeting._id.toString(),
        meetingTitle: meeting.title,
        userId,
        userName: user ? `${user.firstName} ${user.lastName}`.trim() : "Participant",
        userAvatar: user?.avatarUrl || null,
        role: "guest",
      }
      await emitEventToMany(otherParticipantIds, broadcastPayload)
    }

    return { success: true }
  } catch (error) {
    console.error("Error removing from stage:", error)
    return { success: false, error: "Failed to remove from stage" }
  }
}

// ── Request to join stage (guest only) ──

export async function requestStage(
  meetingId: string,
  cachedParticipantIds?: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    let hostId: string
    if (cachedParticipantIds) {
      // We still need hostId even with cache
      const meeting = await Meeting.findById(meetingId).select("hostId").lean()
      if (!meeting) return { success: false, error: "Meeting not found" }
      hostId = meeting.hostId.toString()
    } else {
      const meeting = await Meeting.findById(meetingId).select("hostId participants").lean()
      if (!meeting) return { success: false, error: "Meeting not found" }
      hostId = meeting.hostId.toString()
    }

    const eventPayload: MeetingEventPayload = {
      type: "meeting:stage-request",
      meetingId,
      meetingTitle: "",
      userId: currentUser.id,
      userName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
      userAvatar: currentUser.avatarUrl,
      role: "guest",
    }

    // Notify host of the stage request
    await emitEvent(hostId, eventPayload)

    return { success: true }
  } catch (error) {
    console.error("Error requesting stage:", error)
    return { success: false, error: "Failed to request stage" }
  }
}

// ── Decline stage request (host only) ──

export async function declineStageRequest(
  meetingId: string,
  guestUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const meeting = await Meeting.findById(meetingId).select("hostId title").lean()
    if (!meeting) return { success: false, error: "Meeting not found" }

    // Only host can decline stage requests
    if (meeting.hostId.toString() !== currentUser.id) {
      return { success: false, error: "Only the host can decline stage requests" }
    }

    const eventPayload: MeetingEventPayload = {
      type: "meeting:stage-request-declined",
      meetingId,
      meetingTitle: meeting.title,
      userId: guestUserId,
      userName: "",
      userAvatar: null,
      stageRequestStatus: "declined",
      hostId: currentUser.id,
      hostName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
    }

    // Notify the requesting guest that their request was declined
    await emitEvent(guestUserId, eventPayload)

    return { success: true }
  } catch (error) {
    console.error("Error declining stage request:", error)
    return { success: false, error: "Failed to decline stage request" }
  }
}

// ── Accept stage request (host only) — wrapper that changes role and notifies guest ──

export async function acceptStageRequest(
  meetingId: string,
  guestUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const meeting = await Meeting.findById(meetingId).select("hostId title").lean()
    if (!meeting) return { success: false, error: "Meeting not found" }

    // Only host can accept stage requests
    if (meeting.hostId.toString() !== currentUser.id) {
      return { success: false, error: "Only the host can accept stage requests" }
    }

    // This will promote the guest to participant and emit meeting:role-changed
    const result = await inviteToStage(meetingId, guestUserId)
    if (!result.success) return result

    // Also emit a stage-request-accepted event so the guest knows their specific request was accepted
    const acceptedPayload: MeetingEventPayload = {
      type: "meeting:stage-request-accepted",
      meetingId,
      meetingTitle: meeting.title,
      userId: guestUserId,
      userName: "",
      userAvatar: null,
      stageRequestStatus: "accepted",
      hostId: currentUser.id,
      hostName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
    }

    await emitEvent(guestUserId, acceptedPayload)

    return { success: true }
  } catch (error) {
    console.error("Error accepting stage request:", error)
    return { success: false, error: "Failed to accept stage request" }
  }
}

// ── Raise / lower hand ──

// ── Meeting history types ──

export type MeetingHistoryEntry = {
  id: string
  title: string
  hostName: string
  hostAvatar: string | null
  wasHost: boolean
  status: MeetingStatus
  participantCount: number
  participants: Array<{
    userId: string
    name: string
    avatar: string | null
    role: string
  }>
  startedAt: string | null
  endedAt: string | null
  duration: number | null // seconds
  createdAt: string
  courseThumbnailUrl?: string | null
}

// ── Get meeting history (ended meetings) ──

export async function getMeetingHistory(): Promise<{
  success: boolean
  meetings?: MeetingHistoryEntry[]
  error?: string
}> {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const userId = new Types.ObjectId(currentUser.id)

    const meetings = await Meeting.find({
      $or: [
        { hostId: userId },
        {
          "participants": {
            $elemMatch: {
              userId,
              status: { $in: ["admitted", "left"] },
            },
          },
        },
      ],
      status: "ended",
    })
      .sort({ endedAt: -1, createdAt: -1 })
      .limit(50)
      .lean()

    const hostIds = [...new Set(meetings.map((m) => m.hostId.toString()))]
    const allParticipantIds = [
      ...new Set(meetings.flatMap((m) => m.participants.map((p) => p.userId.toString()))),
    ]
    const userIds = [...new Set([...hostIds, ...allParticipantIds])]
    const users = await User.find({ _id: { $in: userIds } })
      .select("firstName lastName avatarUrl")
      .lean()
    const userMap = new Map(users.map((u) => [u._id.toString(), u]))

    return {
      success: true,
      meetings: meetings.map((m) => {
        const host = userMap.get(m.hostId.toString())
        const isHost = m.hostId.toString() === currentUser.id
        const duration =
          m.startedAt && m.endedAt
            ? Math.floor((new Date(m.endedAt).getTime() - new Date(m.startedAt).getTime()) / 1000)
            : m.endedAt && m.createdAt
              ? Math.floor((new Date(m.endedAt).getTime() - new Date(m.createdAt).getTime()) / 1000)
              : null
        const admittedParticipants = m.participants.filter(
          (p) => p.status === "admitted" || p.status === "left"
        )
        return {
          id: m._id.toString(),
          title: m.title,
          hostName: host ? `${host.firstName} ${host.lastName}`.trim() : "Unknown",
          hostAvatar: host?.avatarUrl || null,
          wasHost: isHost,
          status: m.status,
          participantCount: admittedParticipants.length,
          participants: admittedParticipants.map((p) => {
            const u = userMap.get(p.userId.toString())
            return {
              userId: p.userId.toString(),
              name: u ? `${u.firstName} ${u.lastName}`.trim() : "Unknown",
              avatar: u?.avatarUrl || null,
              role: p.role,
            }
          }),
          startedAt: m.startedAt?.toISOString() || null,
          endedAt: m.endedAt?.toISOString() || null,
          duration,
          createdAt: m.createdAt.toISOString(),
          courseThumbnailUrl: (m as IMeeting).courseThumbnailUrl || null,
        }
      }),
    }
  } catch (error) {
    console.error("Error fetching meeting history:", error)
    return { success: false, error: "Failed to fetch meeting history" }
  }
}

// ── Delete a meeting from history (soft-delete for user) ──

export async function deleteMeetingHistory(
  meetingId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const userId = new Types.ObjectId(currentUser.id)
    const meeting = await Meeting.findById(meetingId)
    if (!meeting) return { success: false, error: "Meeting not found" }

    // Only allow deleting ended meetings from history
    if (meeting.status !== "ended") {
      return { success: false, error: "Can only delete ended meetings from history" }
    }

    // If user is the host, remove the entire meeting
    if (meeting.hostId.toString() === currentUser.id) {
      await Meeting.findByIdAndDelete(meetingId)
    } else {
      // Remove the user's participant entry so it no longer shows in their history
      await Meeting.findByIdAndUpdate(meetingId, {
        $pull: { participants: { userId } },
      })
    }

    return { success: true }
  } catch (error) {
    console.error("Error deleting meeting history:", error)
    return { success: false, error: "Failed to delete meeting history" }
  }
}

export async function toggleHandRaise(
  meetingId: string,
  raised: boolean,
  /** Pass from client state to skip DB lookup entirely */
  cachedParticipantIds?: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    let targetIds: string[]

    if (cachedParticipantIds?.length) {
      // Use client-provided IDs — skip DB read entirely (~50-200ms saved)
      targetIds = cachedParticipantIds.filter((id) => id !== currentUser.id)
    } else {
      // Fallback: lightweight projection query
      const meeting = await Meeting.findById(meetingId)
        .select("participants.userId participants.status hostId")
        .lean()
      if (!meeting) return { success: false, error: "Meeting not found" }

      targetIds = meeting.participants
        .filter((p) => p.status === "admitted" && p.userId.toString() !== currentUser.id)
        .map((p) => p.userId.toString())
      const hostId = meeting.hostId.toString()
      if (hostId !== currentUser.id && !targetIds.includes(hostId)) {
        targetIds.push(hostId)
      }
    }

    const eventPayload: MeetingEventPayload = {
      type: raised ? "meeting:hand-raised" : "meeting:hand-lowered",
      meetingId,
      meetingTitle: "",
      userId: currentUser.id,
      userName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
      userAvatar: currentUser.avatarUrl,
    }
    await emitEventToMany(targetIds, eventPayload)

    return { success: true }
  } catch (error) {
    console.error("Error toggling hand raise:", error)
    return { success: false, error: "Failed to toggle hand" }
  }
}

// ── Send reaction ──

export async function sendReaction(
  meetingId: string,
  emoji: string,
  /** Pass from client state to skip DB lookup entirely */
  cachedParticipantIds?: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    let targetIds: string[]

    if (cachedParticipantIds?.length) {
      // Use client-provided IDs — skip DB read entirely
      targetIds = cachedParticipantIds.filter((id) => id !== currentUser.id)
    } else {
      // Fallback: lightweight projection query
      const meeting = await Meeting.findById(meetingId)
        .select("participants.userId participants.status hostId")
        .lean()
      if (!meeting) return { success: false, error: "Meeting not found" }

      targetIds = meeting.participants
        .filter((p) => p.status === "admitted" && p.userId.toString() !== currentUser.id)
        .map((p) => p.userId.toString())
      if (meeting.hostId.toString() !== currentUser.id && !targetIds.includes(meeting.hostId.toString())) {
        targetIds.push(meeting.hostId.toString())
      }
    }

    const eventPayload: MeetingEventPayload = {
      type: "meeting:reaction",
      meetingId,
      meetingTitle: "",
      userId: currentUser.id,
      userName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
      userAvatar: currentUser.avatarUrl,
      emoji,
    }
    await emitEventToMany(targetIds, eventPayload)

    return { success: true }
  } catch (error) {
    console.error("Error sending reaction:", error)
    return { success: false, error: "Failed to send reaction" }
  }
}

// ── Kick a participant (host only) ──

export async function kickParticipant(
  meetingId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const meeting = await Meeting.findById(meetingId)
    if (!meeting) return { success: false, error: "Meeting not found" }
    if (meeting.hostId.toString() !== currentUser.id) {
      return { success: false, error: "Only host can kick participants" }
    }

    const participant = meeting.participants.find(
      (p) => p.userId.toString() === userId
    )
    if (participant) {
      participant.status = "kicked"
      participant.leftAt = new Date()
    }

    const eventPayload: MeetingEventPayload = {
      type: "meeting:kicked",
      meetingId: meeting._id.toString(),
      meetingTitle: meeting.title,
      userId: currentUser.id,
      userName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
      userAvatar: currentUser.avatarUrl,
    }
    await Promise.all([
      meeting.save(),
      emitEvent(userId, eventPayload),
    ])

    return { success: true }
  } catch (error) {
    console.error("Error kicking participant:", error)
    return { success: false, error: "Failed to kick participant" }
  }
}

// ── Send meeting chat message ──

export async function sendMeetingChat(
  meetingId: string,
  message: string,
  imageUrl?: string,
  videoUrl?: string,
  cachedParticipantIds?: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    let targetIds: string[]
    if (cachedParticipantIds?.length) {
      targetIds = cachedParticipantIds.filter((id) => id !== currentUser.id)
    } else {
      const meeting = await Meeting.findById(meetingId)
        .select("participants.userId participants.status hostId")
        .lean()
      if (!meeting) return { success: false, error: "Meeting not found" }
      targetIds = meeting.participants
        .filter((p) => p.status === "admitted" && p.userId.toString() !== currentUser.id)
        .map((p) => p.userId.toString())
      if (meeting.hostId.toString() !== currentUser.id && !targetIds.includes(meeting.hostId.toString())) {
        targetIds.push(meeting.hostId.toString())
      }
    }

    const eventPayload: MeetingEventPayload = {
      type: "meeting:chat",
      meetingId,
      meetingTitle: "",
      userId: currentUser.id,
      userName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
      userAvatar: currentUser.avatarUrl,
      chatMessage: message,
      chatImageUrl: imageUrl,
      chatVideoUrl: videoUrl,
      chatMessageId: `${Date.now()}-${currentUser.id}`,
    }
    await emitEventToMany(targetIds, eventPayload)

    return { success: true }
  } catch (error) {
    console.error("Error sending meeting chat:", error)
    return { success: false, error: "Failed to send chat" }
  }
}

// ── Create a poll ──

export async function createMeetingPoll(
  meetingId: string,
  question: string,
  options: string[],
  cachedParticipantIds?: string[],
  clientPollId?: string,
): Promise<{ success: boolean; pollId?: string; error?: string }> {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    let targetIds: string[]
    if (cachedParticipantIds?.length) {
      targetIds = cachedParticipantIds.filter((id) => id !== currentUser.id)
    } else {
      const meeting = await Meeting.findById(meetingId)
        .select("participants.userId participants.status hostId")
        .lean()
      if (!meeting) return { success: false, error: "Meeting not found" }
      targetIds = meeting.participants
        .filter((p) => p.status === "admitted" && p.userId.toString() !== currentUser.id)
        .map((p) => p.userId.toString())
      if (meeting.hostId.toString() !== currentUser.id && !targetIds.includes(meeting.hostId.toString())) {
        targetIds.push(meeting.hostId.toString())
      }
    }

    const pollId = clientPollId || `poll-${Date.now()}-${currentUser.id}`
    const eventPayload: MeetingEventPayload = {
      type: "meeting:poll",
      meetingId,
      meetingTitle: "",
      userId: currentUser.id,
      userName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
      userAvatar: currentUser.avatarUrl,
      pollId,
      pollQuestion: question,
      pollOptions: options,
      pollVotes: Object.fromEntries(options.map((_, i) => [String(i), 0])),
    }
    await emitEventToMany(targetIds, eventPayload)

    return { success: true, pollId }
  } catch (error) {
    console.error("Error creating poll:", error)
    return { success: false, error: "Failed to create poll" }
  }
}

// ── Vote on a poll ──

export async function voteMeetingPoll(
  meetingId: string,
  pollId: string,
  optionIndex: number,
  cachedParticipantIds?: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    let targetIds: string[]
    if (cachedParticipantIds?.length) {
      targetIds = cachedParticipantIds.filter((id) => id !== currentUser.id)
    } else {
      const meeting = await Meeting.findById(meetingId)
        .select("participants.userId participants.status hostId")
        .lean()
      if (!meeting) return { success: false, error: "Meeting not found" }
      targetIds = meeting.participants
        .filter((p) => p.status === "admitted" && p.userId.toString() !== currentUser.id)
        .map((p) => p.userId.toString())
      if (meeting.hostId.toString() !== currentUser.id && !targetIds.includes(meeting.hostId.toString())) {
        targetIds.push(meeting.hostId.toString())
      }
    }

    const eventPayload: MeetingEventPayload = {
      type: "meeting:poll-vote",
      meetingId,
      meetingTitle: "",
      userId: currentUser.id,
      userName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
      userAvatar: currentUser.avatarUrl,
      pollId,
      pollVotes: { [String(optionIndex)]: 1 },
      optionIndex,
    }
    await emitEventToMany(targetIds, eventPayload)

    return { success: true }
  } catch (error) {
    console.error("Error voting on poll:", error)
    return { success: false, error: "Failed to vote" }
  }
}

// ── Mute a participant (host only) ──

export async function muteParticipant(
  meetingId: string,
  userId: string,
  muteType: "audio" | "video" | "screenshare" = "audio",
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const eventPayload: MeetingEventPayload = {
      type: "meeting:mute-participant",
      meetingId,
      meetingTitle: "",
      userId: currentUser.id,
      userName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
      userAvatar: currentUser.avatarUrl,
      muteType,
    }
    await emitEvent(userId, eventPayload)

    return { success: true }
  } catch (error) {
    console.error("Error muting participant:", error)
    return { success: false, error: "Failed to mute participant" }
  }
}

// ── Toggle screen share permission (host only) ──

export async function toggleScreenSharePermission(
  meetingId: string,
  userId: string,
  allowed: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const eventPayload: MeetingEventPayload = {
      type: "meeting:screen-share-permission",
      meetingId,
      meetingTitle: "",
      userId: currentUser.id,
      userName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
      userAvatar: currentUser.avatarUrl,
      canScreenShare: allowed,
    }
    await emitEvent(userId, eventPayload)

    return { success: true }
  } catch (error) {
    console.error("Error toggling screen share permission:", error)
    return { success: false, error: "Failed to update permission" }
  }
}

// ── Broadcast speaking level to other participants ──

export async function broadcastSpeakingLevel(
  meetingId: string,
  level: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    await connectDB()
    const meeting = await Meeting.findOne({ meetingId }).lean()
    if (!meeting) return { success: false, error: "Meeting not found" }

    const participants = (meeting.participants ?? []) as unknown as IMeetingParticipant[]
    const admitted = participants.filter(
      (p) => p.status === "admitted" && p.userId.toString() !== currentUser.id
    )
    if (admitted.length === 0) return { success: true }

    const targetIds = admitted.map((p) => p.userId.toString())
    const eventPayload: MeetingEventPayload = {
      type: "meeting:speaking",
      meetingId,
      meetingTitle: meeting.title,
      userId: currentUser.id,
      userName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
      userAvatar: currentUser.avatarUrl,
      speakingLevel: Math.min(1, Math.max(0, level)),
    }
    await emitEventToMany(targetIds, eventPayload)

    return { success: true }
  } catch (error) {
    console.error("Error broadcasting speaking level:", error)
    return { success: false, error: "Failed to broadcast" }
  }
}

// ── Create meeting from course (instructor) ──

export async function createCourseMeeting(
  courseId: string,
  title: string,
  description?: string,
): Promise<{
  success: boolean
  meeting?: MeetingWithDetails
  authToken?: string
  notifiedCount?: number
  error?: string
}> {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    // Verify instructor owns this course
    const course = await Course.findOne({
      _id: courseId,
      instructor: new Types.ObjectId(currentUser.id),
      status: "published",
    }).lean()
    if (!course) return { success: false, error: "Course not found" }

    // Create RTK meeting room
    const rtkMeetingId = await createRTKMeeting(`Meeting: ${title}`)
    const hostParticipant = await addParticipant(rtkMeetingId, {
      name: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
      customParticipantId: currentUser.id,
      presetName: "group_call_host",
    })

    // Create meeting record with course linkage
    const meeting = await Meeting.create({
      title,
      description,
      hostId: new Types.ObjectId(currentUser.id),
      status: "active",
      meetingId: rtkMeetingId,
      hostToken: hostParticipant.authToken,
      courseId: new Types.ObjectId(courseId),
      courseThumbnailUrl: course.thumbnailUrl || undefined,
      startedAt: new Date(),
      participants: [
        {
          userId: new Types.ObjectId(currentUser.id),
          role: "host",
          status: "admitted",
          joinedAt: new Date(),
        },
      ],
      settings: {
        allowScreenShare: true,
        muteOnEntry: true,
        requireApproval: true,
        guestAccess: true,
        maxParticipants: 50,
      },
    })

    // Fire-and-forget: Notify all enrolled students via email
    const meetingLink = `${process.env.SITE_URL || "https://worldstreet.academy"}/dashboard/meetings?join=${meeting._id.toString()}`
    const hostName = `${currentUser.firstName} ${currentUser.lastName}`.trim()

    backgroundSave(
      (async () => {
        const enrollments = await Enrollment.find({
          course: new Types.ObjectId(courseId),
          status: { $in: ["active", "completed"] },
        })
          .select("user")
          .lean()

        const studentIds = enrollments.map((e) => e.user.toString())
        if (studentIds.length === 0) return

        const students = await User.find({ _id: { $in: studentIds } })
          .select("email firstName lastName")
          .lean()

        // Send emails in parallel (batched)
        const emailPromises = students.map((student) =>
          sendMeetingNotificationEmail(student.email, {
            meetingTitle: title,
            hostName,
            hostAvatarUrl: currentUser.avatarUrl || undefined,
            meetingLink,
            courseName: course.title,
            courseThumbnailUrl: course.thumbnailUrl || undefined,
          })
        )
        await Promise.allSettled(emailPromises)
      })()
    )

    // Count enrolled students for UI feedback
    const enrolledCount = await Enrollment.countDocuments({
      course: new Types.ObjectId(courseId),
      status: { $in: ["active", "completed"] },
    })

    return {
      success: true,
      authToken: hostParticipant.authToken,
      notifiedCount: enrolledCount,
      meeting: {
        id: meeting._id.toString(),
        title: meeting.title,
        description: meeting.description,
        hostId: currentUser.id,
        hostName,
        hostAvatar: currentUser.avatarUrl,
        status: meeting.status,
        meetingId: rtkMeetingId,
        participantCount: 1,
        maxParticipants: 50,
        settings: serializeSettings(meeting.settings),
        createdAt: meeting.createdAt.toISOString(),
        startedAt: meeting.startedAt?.toISOString(),
        courseId: courseId,
        courseThumbnailUrl: course.thumbnailUrl || undefined,
      },
    }
  } catch (error) {
    console.error("Error creating course meeting:", error)
    return { success: false, error: "Failed to create meeting" }
  }
}

// ── Invite user by email ──

export type InviteResult = {
  success: boolean
  status: "invited" | "already_in_call" | "not_found" | "error"
  email: string
  userName?: string
  error?: string
}

export async function inviteByEmail(
  meetingId: string,
  email: string,
): Promise<InviteResult> {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, status: "error", email, error: "Unauthorized" }

    const meeting = await Meeting.findById(meetingId)
    if (!meeting) return { success: false, status: "error", email, error: "Meeting not found" }
    if (meeting.hostId.toString() !== currentUser.id)
      return { success: false, status: "error", email, error: "Only the host can invite" }

    // Find user by email
    const invitee = await User.findOne({ email: email.toLowerCase().trim() })
      .select("firstName lastName email avatarUrl")
      .lean()

    if (!invitee) {
      return { success: false, status: "not_found", email }
    }

    // Check if already in the call
    const existingParticipant = meeting.participants.find(
      (p) => p.userId.toString() === invitee._id.toString() && p.status === "admitted"
    )
    if (existingParticipant) {
      return {
        success: true,
        status: "already_in_call",
        email,
        userName: `${invitee.firstName} ${invitee.lastName}`.trim(),
      }
    }

    // Check if already invited
    const existingInvite = meeting.invites?.find(
      (inv) => inv.userId?.toString() === invitee._id.toString() && inv.status === "sent"
    )
    if (existingInvite) {
      return {
        success: true,
        status: "invited",
        email,
        userName: `${invitee.firstName} ${invitee.lastName}`.trim(),
      }
    }

    // Send invite email
    const meetingLink = `${process.env.SITE_URL || "https://worldstreet.academy"}/dashboard/meetings?join=${meetingId}`
    const result = await sendMeetingInviteEmail(invitee.email, {
      meetingTitle: meeting.title,
      hostName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
      hostAvatarUrl: currentUser.avatarUrl || undefined,
      meetingLink,
      courseName: undefined,
      courseThumbnailUrl: meeting.courseThumbnailUrl || undefined,
      inviteeName: invitee.firstName,
    })

    if (!result.success) {
      return { success: false, status: "error", email, error: result.error }
    }

    // Record invite
    meeting.invites = meeting.invites || []
    meeting.invites.push({
      userId: invitee._id,
      email: invitee.email,
      status: "sent",
      sentAt: new Date(),
    } as any)
    backgroundSave(meeting.save())

    return {
      success: true,
      status: "invited",
      email,
      userName: `${invitee.firstName} ${invitee.lastName}`.trim(),
    }
  } catch (error) {
    console.error("Error inviting by email:", error)
    return { success: false, status: "error", email, error: "Failed to send invite" }
  }
}

// ── Search users by email (for invite autocomplete) ──

export async function searchUsersByEmail(
  query: string,
  meetingId: string,
): Promise<{
  success: boolean
  users?: Array<{
    id: string
    email: string
    name: string
    avatar: string | null
    status: "available" | "already_in_call" | "invited"
  }>
  error?: string
}> {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Unauthorized" }
    if (!query.trim() || query.length < 3) return { success: true, users: [] }

    const [meeting, users] = await Promise.all([
      Meeting.findById(meetingId).select("participants invites").lean(),
      User.find({
        email: { $regex: query.trim(), $options: "i" },
        _id: { $ne: new Types.ObjectId(currentUser.id) },
      })
        .select("firstName lastName email avatarUrl")
        .limit(5)
        .lean(),
    ])

    if (!meeting) return { success: false, error: "Meeting not found" }

    const admittedIds = new Set(
      meeting.participants
        .filter((p) => p.status === "admitted")
        .map((p) => p.userId.toString())
    )
    const invitedIds = new Set(
      (meeting.invites || [])
        .filter((inv) => inv.status === "sent")
        .map((inv) => inv.userId?.toString())
        .filter(Boolean) as string[]
    )

    return {
      success: true,
      users: users.map((u) => {
        const uid = u._id.toString()
        let status: "available" | "already_in_call" | "invited" = "available"
        if (admittedIds.has(uid)) status = "already_in_call"
        else if (invitedIds.has(uid)) status = "invited"
        return {
          id: uid,
          email: u.email,
          name: `${u.firstName} ${u.lastName}`.trim(),
          avatar: u.avatarUrl || null,
          status,
        }
      }),
    }
  } catch (error) {
    console.error("Error searching users:", error)
    return { success: false, error: "Search failed" }
  }
}

// ── Get meeting invites for current user (user-side) ──

export type MeetingInviteItem = {
  id: string
  meetingId: string
  title: string
  hostName: string
  hostAvatar: string | null
  courseName: string | null
  courseThumbnailUrl: string | null
  status: MeetingStatus
  createdAt: string
}

export async function getMyMeetingInvites(): Promise<{
  success: boolean
  invites?: MeetingInviteItem[]
  error?: string
}> {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    // Find meetings where:
    // 1. The user is in invites list OR
    // 2. The meeting is linked to a course the user is enrolled in
    const [directInvites, enrollments] = await Promise.all([
      Meeting.find({
        "invites.userId": new Types.ObjectId(currentUser.id),
        status: { $in: ["active", "waiting", "scheduled"] },
      })
        .select("title hostId courseId courseThumbnailUrl status createdAt invites")
        .lean(),
      Enrollment.find({
        user: new Types.ObjectId(currentUser.id),
        status: { $in: ["active", "completed"] },
      })
        .select("course")
        .lean(),
    ])

    const enrolledCourseIds = enrollments.map((e) => e.course)

    const courseMeetings =
      enrolledCourseIds.length > 0
        ? await Meeting.find({
            courseId: { $in: enrolledCourseIds },
            status: { $in: ["active", "waiting", "scheduled"] },
            hostId: { $ne: new Types.ObjectId(currentUser.id) },
          })
            .select("title hostId courseId courseThumbnailUrl status createdAt")
            .lean()
        : []

    // Merge and deduplicate by meeting ID
    const allMeetings = new Map<string, (typeof directInvites)[0]>()
    for (const m of directInvites) allMeetings.set(m._id.toString(), m)
    for (const m of courseMeetings) allMeetings.set(m._id.toString(), m)

    const meetings = Array.from(allMeetings.values())
    if (meetings.length === 0) return { success: true, invites: [] }

    // Fetch host info + course names
    const hostIds = [...new Set(meetings.map((m) => m.hostId.toString()))]
    const courseIds = [...new Set(meetings.filter((m) => m.courseId).map((m) => m.courseId!.toString()))]

    const [hosts, courses] = await Promise.all([
      User.find({ _id: { $in: hostIds } }).select("firstName lastName avatarUrl").lean(),
      courseIds.length > 0
        ? Course.find({ _id: { $in: courseIds } }).select("title").lean()
        : Promise.resolve([]),
    ])

    const hostMap = new Map(hosts.map((h) => [h._id.toString(), h]))
    const courseMap = new Map(courses.map((c) => [c._id.toString(), c]))

    return {
      success: true,
      invites: meetings
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map((m) => {
          const host = hostMap.get(m.hostId.toString())
          const course = m.courseId ? courseMap.get(m.courseId.toString()) : null
          return {
            id: m._id.toString(),
            meetingId: m._id.toString(),
            title: m.title,
            hostName: host ? `${host.firstName} ${host.lastName}`.trim() : "Unknown",
            hostAvatar: host?.avatarUrl || null,
            courseName: course?.title || null,
            courseThumbnailUrl: (m as IMeeting).courseThumbnailUrl || null,
            status: m.status,
            createdAt: m.createdAt.toISOString(),
          }
        }),
    }
  } catch (error) {
    console.error("Error fetching meeting invites:", error)
    return { success: false, error: "Failed to fetch invites" }
  }
}

// ── Get instructor's published courses (for meeting creation) ──

export type InstructorCourseSummary = {
  id: string
  title: string
  thumbnailUrl: string | null
  enrolledCount: number
}

export async function getInstructorCoursesForMeeting(): Promise<{
  success: boolean
  courses?: InstructorCourseSummary[]
  error?: string
}> {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const courses = await Course.find({
      instructor: new Types.ObjectId(currentUser.id),
      status: "published",
    })
      .select("title thumbnailUrl enrolledCount")
      .sort({ createdAt: -1 })
      .lean()

    return {
      success: true,
      courses: courses.map((c) => ({
        id: c._id.toString(),
        title: c.title,
        thumbnailUrl: c.thumbnailUrl || null,
        enrolledCount: c.enrolledCount || 0,
      })),
    }
  } catch (error) {
    console.error("Error fetching instructor courses:", error)
    return { success: false, error: "Failed to fetch courses" }
  }
}