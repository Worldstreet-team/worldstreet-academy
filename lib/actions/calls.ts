"use server"

import { Types } from "mongoose"
import connectDB from "@/lib/db"
import { Call, Conversation, User, Message, type ICall, type CallType } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth"
import { createMeeting, addParticipant } from "@/lib/realtime"

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type CallWithDetails = {
  id: string
  conversationId: string
  callerId: string
  callerName: string
  callerAvatar: string | null
  receiverId: string
  receiverName: string
  receiverAvatar: string | null
  type: CallType
  status: ICall["status"]
  duration: number
  createdAt: Date
  answeredAt?: Date
  endedAt?: Date
}

export type IncomingCall = {
  callId: string
  callerName: string
  callerAvatar: string | null
  callType: CallType
  authToken: string
}

// ──────────────────────────────────────────────
// Initiate a call
// ──────────────────────────────────────────────

export async function initiateCall(
  receiverId: string,
  type: CallType
): Promise<{
  success: boolean
  callId?: string
  authToken?: string
  error?: string
}> {
  try {
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const callerId = new Types.ObjectId(currentUser.id)
    const recipientId = new Types.ObjectId(receiverId)

    // Ensure a conversation exists
    let conversation = await Conversation.findOne({
      participants: { $all: [callerId, recipientId] },
    })
    if (!conversation) {
      conversation = await Conversation.create({
        participants: [callerId, recipientId],
        lastMessageAt: new Date(),
      })
    }

    // Expire ALL previous ringing calls between these two users (either direction)
    // This prevents the receiver from picking up a stale call from any prior attempt
    const expireResult = await Call.updateMany(
      {
        status: "ringing",
        $or: [
          { callerId, receiverId: recipientId },
          { callerId: recipientId, receiverId: callerId },
        ],
      },
      { status: "missed", endedAt: new Date() }
    )
    if (expireResult.modifiedCount > 0) {
      console.log(`[InitiateCall] Expired ${expireResult.modifiedCount} previous ringing calls between pair`)
    }

    const caller = await User.findById(callerId).lean()
    const receiver = await User.findById(recipientId).lean()
    if (!caller || !receiver) return { success: false, error: "User not found" }

    const callerName = `${caller.firstName} ${caller.lastName}`.trim()
    const receiverName = `${receiver.firstName} ${receiver.lastName}`.trim()

    // Create Cloudflare RealtimeKit meeting
    const meetingId = await createMeeting(
      `${callerName} → ${receiverName} (${type})`
    )

    // Use a voice preset for audio-only, group_call_host for video
    const presetName = type === "audio" ? "group_call_host" : "group_call_host"

    // Add both participants
    const callerParticipant = await addParticipant(meetingId, {
      name: callerName,
      customParticipantId: currentUser.id,
      presetName,
    })

    const receiverParticipant = await addParticipant(meetingId, {
      name: receiverName,
      customParticipantId: receiverId,
      presetName,
    })

    // Create call record
    const call = await Call.create({
      conversationId: conversation._id,
      callerId,
      receiverId: recipientId,
      type,
      status: "ringing",
      meetingId,
      callerToken: callerParticipant.authToken,
      receiverToken: receiverParticipant.authToken,
    })

    console.log(`[InitiateCall] Created call ${call._id} from ${callerId} to ${recipientId}`)

    return {
      success: true,
      callId: call._id.toString(),
      authToken: callerParticipant.authToken,
    }
  } catch (error) {
    console.error("Error initiating call:", error)
    return { success: false, error: "Failed to initiate call" }
  }
}

// ──────────────────────────────────────────────
// Answer a call
// ──────────────────────────────────────────────

export async function answerCall(callId: string): Promise<{
  success: boolean
  authToken?: string
  error?: string
}> {
  try {
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const call = await Call.findById(callId)
    if (!call) return { success: false, error: "Call not found" }
    if (call.receiverId.toString() !== currentUser.id) {
      return { success: false, error: "Not authorized to answer this call" }
    }
    if (call.status !== "ringing") {
      return { success: false, error: "Call is no longer ringing" }
    }

    call.status = "ongoing"
    call.answeredAt = new Date()
    await call.save()
    
    console.log(`[AnswerCall] Call ${callId} status updated to: ongoing`)

    return {
      success: true,
      authToken: call.receiverToken,
    }
  } catch (error) {
    console.error("Error answering call:", error)
    return { success: false, error: "Failed to answer call" }
  }
}

// ──────────────────────────────────────────────
// Decline a call
// ──────────────────────────────────────────────

export async function declineCall(callId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const call = await Call.findById(callId)
    if (!call) return { success: false, error: "Call not found" }
    if (call.receiverId.toString() !== currentUser.id) {
      return { success: false, error: "Not authorized" }
    }
    if (call.status !== "ringing") {
      return { success: false, error: "Call is no longer ringing" }
    }

    call.status = "declined"
    call.endedAt = new Date()
    await call.save()

    // Insert a system message into the conversation
    await insertCallSystemMessage(call)

    return { success: true }
  } catch (error) {
    console.error("Error declining call:", error)
    return { success: false, error: "Failed to decline call" }
  }
}

// ──────────────────────────────────────────────
// End a call (from either side)
// ──────────────────────────────────────────────

export async function endCall(callId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const call = await Call.findById(callId)
    if (!call) return { success: false, error: "Call not found" }

    const isParticipant =
      call.callerId.toString() === currentUser.id ||
      call.receiverId.toString() === currentUser.id
    if (!isParticipant) return { success: false, error: "Not authorized" }

    // Guard: if call is already in a terminal state, skip (prevents duplicate messages)
    if (["completed", "missed", "declined", "failed"].includes(call.status)) {
      console.log(`[EndCall] Call ${callId} already in terminal state: ${call.status}, skipping`)
      return { success: true }
    }

    // Calculate duration
    const endTime = new Date()
    let duration = 0
    if (call.answeredAt) {
      duration = Math.floor((endTime.getTime() - call.answeredAt.getTime()) / 1000)
    }

    // If it was ringing and the caller ends it, mark as missed
    const wasRinging = call.status === "ringing"
    const callerEnded = call.callerId.toString() === currentUser.id
    const newStatus = wasRinging
      ? callerEnded
        ? "missed"
        : "declined"
      : "completed"

    // Atomic update: only if call is still in a non-terminal state
    // This prevents race conditions where both participants call endCall simultaneously
    const updated = await Call.findOneAndUpdate(
      {
        _id: callId,
        status: { $nin: ["completed", "missed", "declined", "failed"] },
      },
      {
        status: newStatus,
        endedAt: endTime,
        duration,
      },
      { new: true }
    )

    // Only insert system message if WE were the one who actually updated (won the race)
    if (updated) {
      await insertCallSystemMessage(updated)
      console.log(`[EndCall] Call ${callId} ended with status: ${newStatus}`)
    } else {
      console.log(`[EndCall] Call ${callId} was already ended by the other participant`)
    }

    return { success: true }
  } catch (error) {
    console.error("Error ending call:", error)
    return { success: false, error: "Failed to end call" }
  }
}

// ──────────────────────────────────────────────
// Get call history for a conversation
// ──────────────────────────────────────────────

export async function getCallHistory(conversationId: string): Promise<{
  success: boolean
  calls?: CallWithDetails[]
  error?: string
}> {
  try {
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const calls = await Call.find({
      conversationId: new Types.ObjectId(conversationId),
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("callerId", "firstName lastName avatarUrl")
      .populate("receiverId", "firstName lastName avatarUrl")
      .lean()

    const callsWithDetails: CallWithDetails[] = calls.map((c) => {
      const caller = c.callerId as unknown as {
        _id: Types.ObjectId
        firstName: string
        lastName: string
        avatarUrl?: string
      }
      const receiver = c.receiverId as unknown as {
        _id: Types.ObjectId
        firstName: string
        lastName: string
        avatarUrl?: string
      }

      return {
        id: c._id.toString(),
        conversationId: c.conversationId.toString(),
        callerId: caller._id.toString(),
        callerName: `${caller.firstName} ${caller.lastName}`.trim(),
        callerAvatar: caller.avatarUrl || null,
        receiverId: receiver._id.toString(),
        receiverName: `${receiver.firstName} ${receiver.lastName}`.trim(),
        receiverAvatar: receiver.avatarUrl || null,
        type: c.type,
        status: c.status,
        duration: c.duration,
        createdAt: c.createdAt,
        answeredAt: c.answeredAt,
        endedAt: c.endedAt,
      }
    })

    return { success: true, calls: callsWithDetails }
  } catch (error) {
    console.error("Error fetching call history:", error)
    return { success: false, error: "Failed to fetch call history" }
  }
}

// ──────────────────────────────────────────────
// Helper: Insert a call event system message
// ──────────────────────────────────────────────

async function insertCallSystemMessage(call: ICall) {
  let durationStr: string | null = null

  if (call.status === "completed") {
    const mins = Math.floor(call.duration / 60)
    const secs = call.duration % 60
    durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
  }

  // Structured call event format: CALL_EVENT:type:status:duration:callerId
  const content = `CALL_EVENT:${call.type}:${call.status}:${durationStr || "0"}:${call.callerId}`

  await Message.create({
    conversationId: call.conversationId,
    senderId: call.callerId,
    receiverId: call.receiverId,
    content,
    type: "text",
    isRead: false,
    isDelivered: true,
  })

  // Update conversation lastMessage
  const msg = await Message.findOne({
    conversationId: call.conversationId,
  }).sort({ createdAt: -1 })

  if (msg) {
    await Conversation.findByIdAndUpdate(call.conversationId, {
      lastMessage: msg._id,
      lastMessageAt: msg.createdAt,
    })
  }
}

// ──────────────────────────────────────────────
// Get call status (for outgoing call polling)
// ──────────────────────────────────────────────

export async function getCallStatus(callId: string): Promise<{
  success: boolean
  status?: string
  error?: string
}> {
  try {
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    // Force fresh read - findOne creates a new query each time
    const call = await Call.findOne({ _id: callId })
    if (!call) return { success: false, error: "Call not found" }

    console.log(`[GetCallStatus] Call ${callId} status: ${call.status}`)
    return { success: true, status: call.status }
  } catch (error) {
    console.error("Error getting call status:", error)
    return { success: false, error: "Failed to get call status" }
  }
}

// ──────────────────────────────────────────────
// Expire stale ringing calls (cleanup — call from a cron or on poll)
// ──────────────────────────────────────────────

export async function expireRingingCalls(): Promise<void> {
  const thirtySecondsAgo = new Date(Date.now() - 30_000)

  const staleCalls = await Call.find({
    status: "ringing",
    createdAt: { $lt: thirtySecondsAgo },
  })

  for (const call of staleCalls) {
    // Atomic update: only expire if still ringing (prevents race with endCall/declineCall)
    const updated = await Call.findOneAndUpdate(
      { _id: call._id, status: "ringing" },
      { status: "missed", endedAt: new Date() },
      { new: true }
    )
    if (updated) {
      await insertCallSystemMessage(updated)
    }
  }
}

// ──────────────────────────────────────────────
// Poll for incoming calls (server action replacement for /api/calls/poll)
// ──────────────────────────────────────────────

export async function pollIncomingCall(): Promise<{
  incoming: {
    callId: string
    callerId: string
    callerName: string
    callerAvatar: string | null
    callType: CallType
    conversationId: string
  } | null
}> {
  try {
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) return { incoming: null }

    const userId = new Types.ObjectId(currentUser.id)

    // Expire stale ringing calls (>30 seconds old)
    const staleThreshold = new Date(Date.now() - 30_000)
    const expireResult = await Call.updateMany(
      { status: "ringing", createdAt: { $lt: staleThreshold } },
      { status: "missed", endedAt: new Date() }
    )
    if (expireResult.modifiedCount > 0) {
      console.log(`[PollIncoming] Expired ${expireResult.modifiedCount} stale calls`)
    }

    // Find the NEWEST ringing call where this user is the receiver
    const incomingCall = await Call.findOne({
      receiverId: userId,
      status: "ringing",
    })
      .sort({ createdAt: -1 })
      .lean()

    if (!incomingCall) {
      return { incoming: null }
    }

    console.log(`[PollIncoming] Found incoming call ${incomingCall._id} with status: ${incomingCall.status}`)

    // Get caller info
    const caller = await User.findById(incomingCall.callerId)
      .select<Pick<import("@/lib/db/models").IUser, "firstName" | "lastName" | "avatarUrl">>(
        "firstName lastName avatarUrl"
      )
      .lean()

    return {
      incoming: {
        callId: incomingCall._id.toString(),
        callerId: incomingCall.callerId.toString(),
        callerName: caller
          ? `${caller.firstName} ${caller.lastName}`.trim()
          : "Unknown",
        callerAvatar: caller?.avatarUrl || null,
        callType: incomingCall.type,
        conversationId: incomingCall.conversationId.toString(),
      },
    }
  } catch (error) {
    console.error("Error polling incoming calls:", error)
    return { incoming: null }
  }
}
