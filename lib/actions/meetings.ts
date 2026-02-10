"use server"

import { Types } from "mongoose"
import connectDB from "@/lib/db"
import { Meeting, User, type IMeeting, type IMeetingParticipant, type MeetingStatus } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth"
import { createMeeting as createRTKMeeting, addParticipant } from "@/lib/realtime"
import { emitEvent, emitEventToMany, type MeetingEventPayload } from "@/lib/call-events"

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
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    // Create RTK meeting room
    const rtkMeetingId = await createRTKMeeting(`Meeting: ${title}`)

    // Add host as participant
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
      status: "waiting",
      meetingId: rtkMeetingId,
      hostToken: hostParticipant.authToken,
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
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const meeting = await Meeting.findById(meetingId)
    if (!meeting) return { success: false, error: "Meeting not found" }

    if (meeting.status === "ended") return { success: false, error: "Meeting has ended" }

    // Host already has access — redirect to meeting directly
    if (meeting.hostId.toString() === currentUser.id) {
      const host = await User.findById(meeting.hostId).select("firstName lastName avatarUrl").lean()
      return {
        success: true,
        authToken: meeting.hostToken,
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

    const userId = new Types.ObjectId(currentUser.id)
    const existingP = meeting.participants.find(
      (p) => p.userId.toString() === currentUser.id
    )

    // Already admitted — just return a fresh token
    if (existingP?.status === "admitted") {
      const participant = await addParticipant(meeting.meetingId, {
        name: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
        customParticipantId: currentUser.id,
        presetName: "group_call_participant",
      })

      const host = await User.findById(meeting.hostId).select("firstName lastName avatarUrl").lean()

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
    await meeting.save()

    if (meeting.settings.requireApproval) {
      // Notify the host about join request
      const eventPayload: MeetingEventPayload = {
        type: "meeting:join-request",
        meetingId: meeting._id.toString(),
        meetingTitle: meeting.title,
        userId: currentUser.id,
        userName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
        userAvatar: currentUser.avatarUrl,
      }
      await emitEvent(meeting.hostId.toString(), eventPayload)

      return { success: true, requiresApproval: true, meeting: { id: meeting._id.toString(), title: meeting.title, hostId: meeting.hostId.toString(), hostName: "", hostAvatar: null, status: meeting.status, meetingId: meeting.meetingId, participantCount: 0, maxParticipants: meeting.settings.maxParticipants, settings: serializeSettings(meeting.settings), createdAt: meeting.createdAt.toISOString() } }
    }

    // Auto-admit — generate token
    const participant = await addParticipant(meeting.meetingId, {
      name: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
      customParticipantId: currentUser.id,
      presetName: "group_call_participant",
    })

    const host = await User.findById(meeting.hostId).select("firstName lastName avatarUrl").lean()

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
    await connectDB()
    const currentUser = await getCurrentUser()
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
    await meeting.save()

    // Generate RTK token for admitted participant
    const user = await User.findById(userId).select("firstName lastName").lean()
    const rtkParticipant = await addParticipant(meeting.meetingId, {
      name: user ? `${user.firstName} ${user.lastName}`.trim() : "Participant",
      customParticipantId: userId,
      presetName: "group_call_participant",
    })

    // Notify the participant that they've been admitted
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
    await connectDB()
    const currentUser = await getCurrentUser()
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
    await meeting.save()

    // Notify the participant
    const eventPayload: MeetingEventPayload = {
      type: "meeting:declined",
      meetingId: meeting._id.toString(),
      meetingTitle: meeting.title,
      userId: currentUser.id,
      userName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
      userAvatar: currentUser.avatarUrl,
    }
    await emitEvent(userId, eventPayload)

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
    await connectDB()
    const currentUser = await getCurrentUser()
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
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const meeting = await Meeting.findById(meetingId)
    if (!meeting) return { success: false, error: "Meeting not found" }
    if (meeting.hostId.toString() !== currentUser.id) {
      return { success: false, error: "Only host can end meeting" }
    }

    meeting.status = "ended"
    meeting.endedAt = new Date()
    // Collect participant IDs to notify before marking as left
    const participantIdsToNotify = meeting.participants
      .filter((p) => p.status === "admitted" && p.userId.toString() !== currentUser.id)
      .map((p) => p.userId.toString())
    // Mark all admitted participants as left
    for (const p of meeting.participants) {
      if (p.status === "admitted") {
        p.status = "left"
        p.leftAt = new Date()
      }
    }
    await meeting.save()

    // Notify all participants that the meeting has ended
    if (participantIdsToNotify.length > 0) {
      const endPayload: MeetingEventPayload = {
        type: "meeting:ended",
        meetingId: meeting._id.toString(),
        meetingTitle: meeting.title,
        userId: currentUser.id,
        userName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
        userAvatar: currentUser.avatarUrl,
      }
      await emitEventToMany(participantIdsToNotify, endPayload)
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
    await connectDB()
    const currentUser = await getCurrentUser()
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
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const meeting = await Meeting.findById(meetingId)
    if (!meeting) return { success: false, error: "Meeting not found" }

    const participantIds = meeting.participants.map((p) => p.userId)
    const users = await User.find({ _id: { $in: participantIds } })
      .select("firstName lastName avatarUrl")
      .lean()
    const userMap = new Map(users.map((u) => [u._id.toString(), u]))

    const host = userMap.get(meeting.hostId.toString())

    // Check if current user is host and return authToken
    let authToken: string | undefined
    if (meeting.hostId.toString() === currentUser.id) {
      authToken = meeting.hostToken
    } else {
      // Check if admitted — generate a fresh token
      const myP = meeting.participants.find(
        (p) => p.userId.toString() === currentUser.id && p.status === "admitted"
      )
      if (myP) {
        const rtkP = await addParticipant(meeting.meetingId, {
          name: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
          customParticipantId: currentUser.id,
          presetName: "group_call_participant",
        })
        authToken = rtkP.authToken
      }
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
    await connectDB()
    const currentUser = await getCurrentUser()
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
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const meeting = await Meeting.findById(meetingId)
    if (!meeting) return { success: false, error: "Meeting not found" }

    const participant = meeting.participants.find(
      (p) => p.userId.toString() === currentUser.id
    )
    if (participant) {
      participant.status = "left"
      participant.leftAt = new Date()
      await meeting.save()
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
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const meeting = await Meeting.findById(meetingId)
    if (!meeting) return { success: false, error: "Meeting not found" }
    if (meeting.hostId.toString() !== currentUser.id) {
      return { success: false, error: "Only the host can invite to stage" }
    }

    const user = await User.findById(userId).select("firstName lastName avatarUrl").lean()
    const eventPayload: MeetingEventPayload = {
      type: "meeting:stage-invite",
      meetingId: meeting._id.toString(),
      meetingTitle: meeting.title,
      userId: currentUser.id,
      userName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
      userAvatar: currentUser.avatarUrl,
    }
    await emitEvent(userId, eventPayload)

    // Also notify all other admitted participants so they update their state
    const otherParticipantIds = meeting.participants
      .filter((p) => p.status === "admitted" && p.userId.toString() !== userId && p.userId.toString() !== currentUser.id)
      .map((p) => p.userId.toString())

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
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const meeting = await Meeting.findById(meetingId)
    if (!meeting) return { success: false, error: "Meeting not found" }
    if (meeting.hostId.toString() !== currentUser.id) {
      return { success: false, error: "Only the host can remove from stage" }
    }

    const user = await User.findById(userId).select("firstName lastName avatarUrl").lean()
    const eventPayload: MeetingEventPayload = {
      type: "meeting:stage-removed",
      meetingId: meeting._id.toString(),
      meetingTitle: meeting.title,
      userId: currentUser.id,
      userName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
      userAvatar: currentUser.avatarUrl,
    }
    await emitEvent(userId, eventPayload)

    // Also notify others
    const otherParticipantIds = meeting.participants
      .filter((p) => p.status === "admitted" && p.userId.toString() !== userId && p.userId.toString() !== currentUser.id)
      .map((p) => p.userId.toString())

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

export async function toggleHandRaise(
  meetingId: string,
  raised: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const meeting = await Meeting.findById(meetingId)
    if (!meeting) return { success: false, error: "Meeting not found" }

    // Notify the host
    const eventPayload: MeetingEventPayload = {
      type: raised ? "meeting:hand-raised" : "meeting:hand-lowered",
      meetingId: meeting._id.toString(),
      meetingTitle: meeting.title,
      userId: currentUser.id,
      userName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
      userAvatar: currentUser.avatarUrl,
    }

    // Send to all admitted participants so everyone sees the hand
    const participantIds = meeting.participants
      .filter((p) => p.status === "admitted" && p.userId.toString() !== currentUser.id)
      .map((p) => p.userId.toString())
    // Include host
    if (!participantIds.includes(meeting.hostId.toString())) {
      participantIds.push(meeting.hostId.toString())
    }
    await emitEventToMany(participantIds, eventPayload)

    return { success: true }
  } catch (error) {
    console.error("Error toggling hand raise:", error)
    return { success: false, error: "Failed to toggle hand" }
  }
}

// ── Send reaction ──

export async function sendReaction(
  meetingId: string,
  emoji: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const meeting = await Meeting.findById(meetingId)
    if (!meeting) return { success: false, error: "Meeting not found" }

    const eventPayload: MeetingEventPayload = {
      type: "meeting:reaction",
      meetingId: meeting._id.toString(),
      meetingTitle: meeting.title,
      userId: currentUser.id,
      userName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
      userAvatar: currentUser.avatarUrl,
      emoji,
    }

    // Send to all admitted participants
    const participantIds = meeting.participants
      .filter((p) => p.status === "admitted" && p.userId.toString() !== currentUser.id)
      .map((p) => p.userId.toString())
    // Include host
    if (meeting.hostId.toString() !== currentUser.id && !participantIds.includes(meeting.hostId.toString())) {
      participantIds.push(meeting.hostId.toString())
    }
    await emitEventToMany(participantIds, eventPayload)

    return { success: true }
  } catch (error) {
    console.error("Error sending reaction:", error)
    return { success: false, error: "Failed to send reaction" }
  }
}
