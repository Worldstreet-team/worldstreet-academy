"use server"

import { Types } from "mongoose"
import connectDB from "@/lib/db"
import { Meeting, User, type IMeeting, type IMeetingParticipant, type MeetingStatus } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth"
import { createMeeting as createRTKMeeting, addParticipant } from "@/lib/realtime"
import { emitEvent, type CallEventPayload } from "@/lib/call-events"

// ── Types ──

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
  settings: IMeeting["settings"]
  createdAt: Date
  startedAt?: Date
}

export type MeetingParticipantDetails = {
  userId: string
  name: string
  avatar: string | null
  role: IMeetingParticipant["role"]
  status: IMeetingParticipant["status"]
  joinedAt?: Date
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
        settings: meeting.settings,
        createdAt: meeting.createdAt,
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

    const userId = new Types.ObjectId(currentUser.id)
    const existingP = meeting.participants.find(
      (p) => p.userId.toString() === currentUser.id
    )

    // Already admitted — just return a fresh token
    if (existingP?.status === "admitted") {
      const participant = await addParticipant(meeting.meetingId, {
        name: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
        customParticipantId: currentUser.id,
        presetName: "group_call_host",
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
          settings: meeting.settings,
          createdAt: meeting.createdAt,
          startedAt: meeting.startedAt,
        },
      }
    }

    // Already pending
    if (existingP?.status === "pending") {
      return { success: true, requiresApproval: true }
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
      const eventPayload: CallEventPayload = {
        type: "call:incoming", // Reuse call:incoming for meeting join notifications
        callId: meeting._id.toString(),
        callType: "video",
        callerId: currentUser.id,
        callerName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
        callerAvatar: currentUser.avatarUrl,
        receiverId: meeting.hostId.toString(),
        conversationId: meeting._id.toString(),
        status: "meeting:join-request",
      }
      emitEvent(meeting.hostId.toString(), eventPayload)

      return { success: true, requiresApproval: true }
    }

    // Auto-admit — generate token
    const participant = await addParticipant(meeting.meetingId, {
      name: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
      customParticipantId: currentUser.id,
      presetName: "group_call_host",
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
        settings: meeting.settings,
        createdAt: meeting.createdAt,
        startedAt: meeting.startedAt,
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
      presetName: "group_call_host",
    })

    // Notify the participant that they've been admitted
    const eventPayload: CallEventPayload = {
      type: "call:answered", // Reuse for meeting admit notification
      callId: meeting._id.toString(),
      callType: "video",
      callerId: currentUser.id,
      callerName: "",
      callerAvatar: null,
      receiverId: userId,
      conversationId: meeting._id.toString(),
      status: "meeting:admitted",
      authToken: rtkParticipant.authToken,
    }
    emitEvent(userId, eventPayload)

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
    const eventPayload: CallEventPayload = {
      type: "call:declined",
      callId: meeting._id.toString(),
      callType: "video",
      callerId: currentUser.id,
      callerName: "",
      callerAvatar: null,
      receiverId: userId,
      conversationId: meeting._id.toString(),
      status: "meeting:declined",
    }
    emitEvent(userId, eventPayload)

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
    // Mark all admitted participants as left
    for (const p of meeting.participants) {
      if (p.status === "admitted") {
        p.status = "left"
        p.leftAt = new Date()
      }
    }
    await meeting.save()

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
          settings: m.settings,
          createdAt: m.createdAt,
          startedAt: m.startedAt,
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
          presetName: "group_call_host",
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
        settings: meeting.settings,
        createdAt: meeting.createdAt,
        startedAt: meeting.startedAt,
      },
      participants: meeting.participants.map((p) => {
        const u = userMap.get(p.userId.toString())
        return {
          userId: p.userId.toString(),
          name: u ? `${u.firstName} ${u.lastName}`.trim() : "Unknown",
          avatar: u?.avatarUrl || null,
          role: p.role,
          status: p.status,
          joinedAt: p.joinedAt,
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
