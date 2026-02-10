"use server"

import { Types } from "mongoose"
import connectDB from "@/lib/db"
import { Call, Conversation, User, Message, type ICall, type CallType } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth"
import { createMeeting, addParticipant } from "@/lib/realtime"
import { emitCallEvent, type CallEventPayload } from "@/lib/call-events"

// ── Helpers ──

/** Parallelize DB connection + auth — saves ~30-80ms per action */
async function initAction() {
  const [, currentUser] = await Promise.all([connectDB(), getCurrentUser()])
  return currentUser
}

/** Fire-and-forget: schedule DB write without blocking the response */
function backgroundWrite(promise: Promise<unknown>) {
  promise.catch((err) => console.error("[Call] Background write failed:", err))
}

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
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const callerId = new Types.ObjectId(currentUser.id)
    const recipientId = new Types.ObjectId(receiverId)

    // Parallelize conversation lookup + stale call expiry (independent operations)
    const [conversation, expireResult] = await Promise.all([
      Conversation.findOne({
        participants: { $all: [callerId, recipientId] },
      }).then(async (conv) => {
        if (conv) return conv
        return Conversation.create({
          participants: [callerId, recipientId],
          lastMessageAt: new Date(),
        })
      }),
      // Expire stale ringing calls between this pair
      Call.updateMany(
        {
          status: "ringing",
          $or: [
            { callerId, receiverId: recipientId },
            { callerId: recipientId, receiverId: callerId },
          ],
        },
        { status: "missed", endedAt: new Date() }
      ),
      // Also expire stale ringing calls involving this caller (>60s old)
      Call.updateMany(
        {
          status: "ringing",
          createdAt: { $lt: new Date(Date.now() - 60_000) },
          $or: [{ callerId }, { receiverId: callerId }],
        },
        { status: "missed", endedAt: new Date() }
      ),
    ])
    if (expireResult.modifiedCount > 0) {
      console.log(`[InitiateCall] Expired ${expireResult.modifiedCount} previous ringing calls between pair`)
    }

    const [caller, receiver] = await Promise.all([
      User.findById(callerId).lean(),
      User.findById(recipientId).lean(),
    ])
    if (!caller || !receiver) return { success: false, error: "User not found" }

    // NOTE: We don't check DB status for "busy" detection — DB records can be stale.
    // Instead, the receiver's CallProvider checks if they have a live RTK connection
    // and auto-declines incoming calls if already in a call.

    const callerName = `${caller.firstName} ${caller.lastName}`.trim()
    const receiverName = `${receiver.firstName} ${receiver.lastName}`.trim()

    // Create Cloudflare RealtimeKit meeting
    const meetingId = await createMeeting(
      `${callerName} → ${receiverName} (${type})`
    )

    // Use a voice preset for audio-only, group_call_host for video
    const presetName = type === "audio" ? "group_call_host" : "group_call_host"

    // Add both participants in parallel for faster call setup
    const [callerParticipant, receiverParticipant] = await Promise.all([
      addParticipant(meetingId, {
        name: callerName,
        customParticipantId: currentUser.id,
        presetName,
      }),
      addParticipant(meetingId, {
        name: receiverName,
        customParticipantId: receiverId,
        presetName,
      }),
    ])

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

    // Emit SSE event to the receiver
    const eventPayload: CallEventPayload = {
      type: "call:incoming",
      callId: call._id.toString(),
      callType: type,
      callerId: currentUser.id,
      callerName,
      callerAvatar: caller.avatarUrl || null,
      receiverId,
      conversationId: conversation._id.toString(),
      authToken: receiverParticipant.authToken,
    }
    await emitCallEvent(receiverId, eventPayload)

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
    const currentUser = await initAction()
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

    console.log(`[AnswerCall] Call ${callId} status updated to: ongoing`)

    // Save and notify caller in parallel — instant "answered" event
    const eventPayload: CallEventPayload = {
      type: "call:answered",
      callId,
      callType: call.type,
      callerId: call.callerId.toString(),
      callerName: "",
      callerAvatar: null,
      receiverId: currentUser.id,
      conversationId: call.conversationId.toString(),
    }
    await Promise.all([
      call.save(),
      emitCallEvent(call.callerId.toString(), eventPayload),
    ])

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
    const currentUser = await initAction()
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

    // Save, emit, and insert system message in parallel
    const eventPayload: CallEventPayload = {
      type: "call:declined",
      callId,
      callType: call.type,
      callerId: call.callerId.toString(),
      callerName: "",
      callerAvatar: null,
      receiverId: currentUser.id,
      conversationId: call.conversationId.toString(),
      status: "declined",
    }
    await Promise.all([
      call.save(),
      emitCallEvent(call.callerId.toString(), eventPayload),
    ])
    // System message is non-critical — fire in background
    backgroundWrite(insertCallSystemMessage(call))

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
    const currentUser = await initAction()
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

    // Only emit + insert system message if WE won the race
    if (updated) {
      console.log(`[EndCall] Call ${callId} ended with status: ${newStatus}`)

      const otherUserId =
        call.callerId.toString() === currentUser.id
          ? call.receiverId.toString()
          : call.callerId.toString()

      const eventType = wasRinging ? "call:cancelled" as const : "call:ended" as const

      const eventPayload: CallEventPayload = {
        type: eventType,
        callId,
        callType: call.type,
        callerId: call.callerId.toString(),
        callerName: "",
        callerAvatar: null,
        receiverId: call.receiverId.toString(),
        conversationId: call.conversationId.toString(),
        status: newStatus,
      }
      // Emit instantly, system message in background
      await emitCallEvent(otherUserId, eventPayload)
      backgroundWrite(insertCallSystemMessage(updated))
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
    const currentUser = await initAction()
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
    const currentUser = await initAction()
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

      // Notify both participants
      const eventPayload: CallEventPayload = {
        type: "call:ended",
        callId: call._id.toString(),
        callType: updated.type,
        callerId: updated.callerId.toString(),
        callerName: "",
        callerAvatar: null,
        receiverId: updated.receiverId.toString(),
        conversationId: updated.conversationId.toString(),
        status: "missed",
      }
      await emitCallEvent(updated.callerId.toString(), eventPayload)
      await emitCallEvent(updated.receiverId.toString(), eventPayload)
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
    authToken?: string
  } | null
}> {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { incoming: null }

    const userId = new Types.ObjectId(currentUser.id)

    // Parallelize stale call expiry + incoming call query
    const staleThreshold = new Date(Date.now() - 30_000)
    const [expireResult, incomingCall] = await Promise.all([
      // Only expire stale ringing calls where THIS user is a participant
      // (not global — global cleanup was killing other users' active ringing calls)
      Call.updateMany(
        {
          status: "ringing",
          createdAt: { $lt: staleThreshold },
          $or: [{ callerId: userId }, { receiverId: userId }],
        },
        { status: "missed", endedAt: new Date() }
      ),
      Call.findOne({
        receiverId: userId,
        status: "ringing",
        createdAt: { $gte: staleThreshold },
      })
        .sort({ createdAt: -1 })
        .lean(),
    ])
    if (expireResult.modifiedCount > 0) {
      console.log(`[PollIncoming] Expired ${expireResult.modifiedCount} stale calls for user ${currentUser.id}`)
    }

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
        authToken: incomingCall.receiverToken,
      },
    }
  } catch (error) {
    console.error("Error polling incoming calls:", error)
    return { incoming: null }
  }
}

// ──────────────────────────────────────────────
// Get active call for the current user (for reconnection after refresh)
// Returns the ongoing call if one exists, with auth token
// ──────────────────────────────────────────────

export type ActiveCallInfo = {
  callId: string
  callType: CallType
  participantId: string
  participantName: string
  participantAvatar: string | null
  isIncoming: boolean
  conversationId: string
  authToken: string
  answeredAt: string
}

export async function getActiveCall(): Promise<{
  activeCall: ActiveCallInfo | null
}> {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { activeCall: null }

    const userId = new Types.ObjectId(currentUser.id)
    // Only return calls that are "ongoing" (answered, not ended) and recent (< 2 hours)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)

    const call = await Call.findOne({
      $or: [{ callerId: userId }, { receiverId: userId }],
      status: "ongoing",
      answeredAt: { $gte: twoHoursAgo },
    })
      .sort({ answeredAt: -1 })
      .lean()

    if (!call) return { activeCall: null }

    const isCaller = call.callerId.toString() === currentUser.id
    const otherUserId = isCaller ? call.receiverId : call.callerId
    const authToken = isCaller ? call.callerToken : call.receiverToken

    if (!authToken) return { activeCall: null }

    const otherUser = await User.findById(otherUserId)
      .select("firstName lastName avatarUrl")
      .lean()

    return {
      activeCall: {
        callId: call._id.toString(),
        callType: call.type,
        participantId: otherUserId.toString(),
        participantName: otherUser
          ? `${otherUser.firstName} ${otherUser.lastName}`.trim()
          : "Unknown",
        participantAvatar: otherUser?.avatarUrl || null,
        isIncoming: !isCaller,
        conversationId: call.conversationId.toString(),
        authToken,
        answeredAt: call.answeredAt?.toISOString() || new Date().toISOString(),
      },
    }
  } catch (error) {
    console.error("Error getting active call:", error)
    return { activeCall: null }
  }
}

// ──────────────────────────────────────────────
// Rejoin an active call (emit event to the other participant)
// ──────────────────────────────────────────────

export async function rejoinCall(callId: string): Promise<{
  success: boolean
  authToken?: string
  error?: string
}> {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const call = await Call.findById(callId).lean()
    if (!call) return { success: false, error: "Call not found" }

    // Only allow rejoin for ongoing calls
    if (call.status !== "ongoing") {
      return { success: false, error: "Call is not ongoing" }
    }

    const isCaller = call.callerId.toString() === currentUser.id
    const isReceiver = call.receiverId.toString() === currentUser.id
    if (!isCaller && !isReceiver) {
      return { success: false, error: "Not a participant" }
    }

    const authToken = isCaller ? call.callerToken : call.receiverToken
    if (!authToken) return { success: false, error: "No auth token available" }

    // Notify the other participant that this user has rejoined
    const otherUserId = isCaller
      ? call.receiverId.toString()
      : call.callerId.toString()

    const callerUser = await User.findById(call.callerId).select("firstName lastName avatarUrl").lean()

    const eventPayload: CallEventPayload = {
      type: "call:participant-rejoined",
      callId: call._id.toString(),
      callType: call.type,
      callerId: call.callerId.toString(),
      callerName: callerUser ? `${callerUser.firstName} ${callerUser.lastName}`.trim() : "",
      callerAvatar: callerUser?.avatarUrl || null,
      receiverId: call.receiverId.toString(),
      conversationId: call.conversationId.toString(),
    }
    await emitCallEvent(otherUserId, eventPayload)

    return { success: true, authToken }
  } catch (error) {
    console.error("Error rejoining call:", error)
    return { success: false, error: "Failed to rejoin call" }
  }
}

// ──────────────────────────────────────────────
// Cleanup orphaned calls for the current user
// Called on page load to recover from crashes, HMR, navigation, etc.
// Only cleans STALE calls — recent ongoing calls are kept for reconnection
// ──────────────────────────────────────────────

export async function cleanupOrphanedCalls(): Promise<{
  cleaned: number
}> {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { cleaned: 0 }

    const userId = new Types.ObjectId(currentUser.id)
    const now = new Date()
    // Only clean calls older than 2 hours — recent ongoing calls may be reconnectable
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
    // Ringing calls are stale after 60 seconds
    const sixtySecondsAgo = new Date(Date.now() - 60_000)

    // Find stale calls:
    // - "ringing" calls older than 60s (they timed out)
    // - "ongoing" calls older than 2h (abandoned)
    const orphanedCalls = await Call.find({
      $and: [
        { $or: [{ callerId: userId }, { receiverId: userId }] },
        {
          $or: [
            { status: "ringing", createdAt: { $lt: sixtySecondsAgo } },
            { status: "ongoing", answeredAt: { $lt: twoHoursAgo } },
          ],
        },
      ],
    }).lean()

    let cleaned = 0

    for (const call of orphanedCalls) {
      const isRinging = call.status === "ringing"
      const newStatus = isRinging ? "missed" : "completed"
      let duration = 0
      if (call.answeredAt) {
        duration = Math.floor((now.getTime() - call.answeredAt.getTime()) / 1000)
      }

      const updated = await Call.findOneAndUpdate(
        {
          _id: call._id,
          status: { $nin: ["completed", "missed", "declined", "failed"] },
        },
        { status: newStatus, endedAt: now, duration },
        { new: true }
      )

      if (updated) {
        cleaned++
        const age = now.getTime() - call.createdAt.getTime()
        console.log(`[CleanupOrphaned] Cleaned call ${call._id} (was ${call.status} → ${newStatus}, age: ${Math.round(age / 1000)}s)`)

        // Notify the other participant so their UI updates too
        const otherUserId =
          call.callerId.toString() === currentUser.id
            ? call.receiverId.toString()
            : call.callerId.toString()

        const eventPayload: CallEventPayload = {
          type: "call:ended",
          callId: call._id.toString(),
          callType: call.type,
          callerId: call.callerId.toString(),
          callerName: "",
          callerAvatar: null,
          receiverId: call.receiverId.toString(),
          conversationId: call.conversationId.toString(),
          status: newStatus,
        }
        emitCallEvent(otherUserId, eventPayload).catch(() => {})
        backgroundWrite(insertCallSystemMessage(updated))
      }
    }

    if (cleaned > 0) {
      console.log(`[CleanupOrphaned] Cleaned ${cleaned} orphaned calls for user ${currentUser.id}`)
    }

    return { cleaned }
  } catch (error) {
    console.error("Error cleaning up orphaned calls:", error)
    return { cleaned: 0 }
  }
}

// ──────────────────────────────────────────────
// End call by beacon (fire-and-forget on page unload)
// Uses a simple callId approach for Navigator.sendBeacon
// ──────────────────────────────────────────────

export async function endCallByCallId(callId: string): Promise<void> {
  try {
    const currentUser = await initAction()
    if (!currentUser) return

    const now = new Date()
    const call = await Call.findById(callId).lean()
    if (!call) return

    if (["completed", "missed", "declined", "failed"].includes(call.status)) return

    const isParticipant =
      call.callerId.toString() === currentUser.id ||
      call.receiverId.toString() === currentUser.id
    if (!isParticipant) return

    let duration = 0
    if (call.answeredAt) {
      duration = Math.floor((now.getTime() - call.answeredAt.getTime()) / 1000)
    }

    const newStatus = call.status === "ringing" ? "missed" : "completed"

    const updated = await Call.findOneAndUpdate(
      { _id: callId, status: { $nin: ["completed", "missed", "declined", "failed"] } },
      { status: newStatus, endedAt: now, duration },
      { new: true }
    )

    if (updated) {
      const otherUserId =
        call.callerId.toString() === currentUser.id
          ? call.receiverId.toString()
          : call.callerId.toString()

      const eventPayload: CallEventPayload = {
        type: call.status === "ringing" ? "call:cancelled" : "call:ended",
        callId,
        callType: call.type,
        callerId: call.callerId.toString(),
        callerName: "",
        callerAvatar: null,
        receiverId: call.receiverId.toString(),
        conversationId: call.conversationId.toString(),
        status: newStatus,
      }
      await emitCallEvent(otherUserId, eventPayload)
    }
  } catch (error) {
    console.error("[EndCallByCallId] Error:", error)
  }
}
