"use server"

import { Types } from "mongoose"
import connectDB from "@/lib/db"
import { Meeting, User, type IMeeting, type IMeetingParticipant, type MeetingStatus } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth"
import { createMeeting as createRTKMeeting, addParticipant } from "@/lib/realtime"
import { emitEvent, emitEventToMany, type MeetingEventPayload } from "@/lib/call-events"

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

export type MeetingSettings = {
  allowScreenShare: boolean
  muteOnEntry: boolean
  requireApproval: boolean
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
}

/** Converts a Mongoose settings subdocument to a plain object */
function serializeSettings(s: IMeeting["settings"]): MeetingSettings {
  return {
    allowScreenShare: !!s.allowScreenShare,
    muteOnEntry: !!s.muteOnEntry,
    requireApproval: !!s.requireApproval,
    maxParticipants: s.maxParticipants ?? 50,
  }
}

export type MeetingParticipantDetails = {
  userId: string
  name: string
  avatar: string | null
  role: "host" | "co-host" | "participant"
  status: "pending" | "admitted" | "declined" | "left"
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
    const status = meeting.settings.requireApproval ? "pending" : "admitted"
    meeting.participants.push({
      userId,
      role: "participant",
      status,
      joinedAt: status === "admitted" ? new Date() : undefined,
    } as IMeetingParticipant)
    if (meeting.settings.requireApproval) {
      // Save and notify host in parallel — instant notification
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

    // Auto-admit — parallelize save, RTK token, and host lookup
    const [, participant, host] = await Promise.all([
      meeting.save(),
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
    participant.joinedAt = new Date()

    // Parallelize DB save + user lookup (independent operations)
    const [, user] = await Promise.all([
      meeting.save(),
      User.findById(userId).select("firstName lastName").lean(),
    ])

    // Generate RTK token (needs user name from parallel lookup)
    const rtkParticipant = await addParticipant(meeting.meetingId, {
      name: user ? `${user.firstName} ${user.lastName}`.trim() : "Participant",
      customParticipantId: userId,
      presetName: "group_call_participant",
    })

    // Notify the participant immediately
    const eventPayload: MeetingEventPayload = {
      type: "meeting:admitted",
      meetingId: meeting._id.toString(),
      meetingTitle: meeting.title,
      userId: currentUser.id,
      userName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
      userAvatar: currentUser.avatarUrl,
      authToken: rtkParticipant.authToken,
    }
    await emitEvent(userId, eventPayload)

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

    // Save and notify in parallel — participants get instant "ended" event
    const endPayload: MeetingEventPayload = {
      type: "meeting:ended",
      meetingId: meeting._id.toString(),
      meetingTitle: meeting.title,
      userId: currentUser.id,
      userName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
      userAvatar: currentUser.avatarUrl,
    }
    await Promise.all([
      meeting.save(),
      participantIdsToNotify.length > 0
        ? emitEventToMany(participantIdsToNotify, endPayload)
        : Promise.resolve(),
    ])

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

    const otherParticipantIds = meeting.participants
      .filter((p) => p.status === "admitted" && p.userId.toString() !== userId && p.userId.toString() !== currentUser.id)
      .map((p) => p.userId.toString())

    // Fetch user info + emit to target in parallel
    const eventPayload: MeetingEventPayload = {
      type: "meeting:stage-invite",
      meetingId: meeting._id.toString(),
      meetingTitle: meeting.title,
      userId: currentUser.id,
      userName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
      userAvatar: currentUser.avatarUrl,
    }
    const [user] = await Promise.all([
      User.findById(userId).select("firstName lastName avatarUrl").lean(),
      emitEvent(userId, eventPayload),
    ])

    // Broadcast to others (needs user name from parallel lookup)
    if (otherParticipantIds.length > 0) {
      const broadcastPayload: MeetingEventPayload = {
        type: "meeting:stage-invite",
        meetingId: meeting._id.toString(),
        meetingTitle: meeting.title,
        userId,
        userName: user ? `${user.firstName} ${user.lastName}`.trim() : "Participant",
        userAvatar: user?.avatarUrl || null,
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

    const otherParticipantIds = meeting.participants
      .filter((p) => p.status === "admitted" && p.userId.toString() !== userId && p.userId.toString() !== currentUser.id)
      .map((p) => p.userId.toString())

    // Fetch user info + emit to target in parallel
    const eventPayload: MeetingEventPayload = {
      type: "meeting:stage-removed",
      meetingId: meeting._id.toString(),
      meetingTitle: meeting.title,
      userId: currentUser.id,
      userName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
      userAvatar: currentUser.avatarUrl,
    }
    const [user] = await Promise.all([
      User.findById(userId).select("firstName lastName avatarUrl").lean(),
      emitEvent(userId, eventPayload),
    ])

    // Broadcast to others (needs user name from parallel lookup)
    if (otherParticipantIds.length > 0) {
      const broadcastPayload: MeetingEventPayload = {
        type: "meeting:stage-removed",
        meetingId: meeting._id.toString(),
        meetingTitle: meeting.title,
        userId,
        userName: user ? `${user.firstName} ${user.lastName}`.trim() : "Participant",
        userAvatar: user?.avatarUrl || null,
      }
      await emitEventToMany(otherParticipantIds, broadcastPayload)
    }

    return { success: true }
  } catch (error) {
    console.error("Error removing from stage:", error)
    return { success: false, error: "Failed to remove from stage" }
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
  startedAt: string | null
  endedAt: string | null
  duration: number | null // seconds
  createdAt: string
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
    const hosts = await User.find({ _id: { $in: hostIds } })
      .select("firstName lastName avatarUrl")
      .lean()
    const hostMap = new Map(hosts.map((h) => [h._id.toString(), h]))

    return {
      success: true,
      meetings: meetings.map((m) => {
        const host = hostMap.get(m.hostId.toString())
        const isHost = m.hostId.toString() === currentUser.id
        const duration =
          m.startedAt && m.endedAt
            ? Math.floor((new Date(m.endedAt).getTime() - new Date(m.startedAt).getTime()) / 1000)
            : m.endedAt && m.createdAt
              ? Math.floor((new Date(m.endedAt).getTime() - new Date(m.createdAt).getTime()) / 1000)
              : null
        return {
          id: m._id.toString(),
          title: m.title,
          hostName: host ? `${host.firstName} ${host.lastName}`.trim() : "Unknown",
          hostAvatar: host?.avatarUrl || null,
          wasHost: isHost,
          status: m.status,
          participantCount: m.participants.filter((p) => p.status === "admitted" || p.status === "left").length,
          startedAt: m.startedAt?.toISOString() || null,
          endedAt: m.endedAt?.toISOString() || null,
          duration,
          createdAt: m.createdAt.toISOString(),
        }
      }),
    }
  } catch (error) {
    console.error("Error fetching meeting history:", error)
    return { success: false, error: "Failed to fetch meeting history" }
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
      participant.status = "left"
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
  cachedParticipantIds?: string[]
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

    const pollId = `poll-${Date.now()}-${currentUser.id}`
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