/**
 * Server-side real-time event bus using Ably.
 * Handles call events, message events, and meeting events.
 *
 * Server actions publish events via Ably REST API.
 * Clients subscribe via Ably Realtime WebSocket (see use-call-events.ts).
 *
 * Channel naming: `user:<userId>` — one channel per user.
 * Event name: `event` — payload contains the type discriminator.
 */

import Ably from "ably"

// ── Call event types ──

export type CallEventType =
  | "call:incoming"
  | "call:answered"
  | "call:ended"
  | "call:declined"
  | "call:cancelled"
  | "call:busy"

export type CallEventPayload = {
  type: CallEventType
  callId: string
  callType: "video" | "audio"
  callerId: string
  callerName: string
  callerAvatar: string | null
  receiverId: string
  conversationId: string
  status?: string
  /** Receiver's auth token — included in call:incoming so answer can start RTK init immediately */
  authToken?: string
}

// ── Message event types ──

export type MessageEventType =
  | "message:new"
  | "message:read"
  | "message:deleted"

// ── Meeting event types ──

export type MeetingEventType =
  | "meeting:join-request"
  | "meeting:admitted"
  | "meeting:declined"
  | "meeting:ended"
  | "meeting:participant-joined"
  | "meeting:participant-left"
  | "meeting:stage-invite"
  | "meeting:stage-removed"
  | "meeting:hand-raised"
  | "meeting:hand-lowered"
  | "meeting:reaction"
  | "meeting:kicked"
  | "meeting:chat"
  | "meeting:poll"
  | "meeting:poll-vote"
  | "meeting:mute-participant"
  | "meeting:screen-share-permission"

export type MeetingEventPayload = {
  type: MeetingEventType
  meetingId: string
  meetingTitle: string
  userId: string
  userName: string
  userAvatar: string | null
  /** RTK auth token — included in meeting:admitted so joiner can init immediately */
  authToken?: string
  /** Emoji for reactions */
  emoji?: string
  /** Chat message content */
  chatMessage?: string
  chatImageUrl?: string
  chatVideoUrl?: string
  chatMessageId?: string
  /** Poll data */
  pollId?: string
  pollQuestion?: string
  pollOptions?: string[]
  pollVotes?: Record<string, number>
  pollVoters?: Record<string, string>
  /** Permission flag */
  canScreenShare?: boolean
}

export type MessageEventPayload = {
  type: MessageEventType
  messageId: string
  conversationId: string
  senderId: string
  senderName: string
  senderAvatar: string | null
  content: string
  messageType: "text" | "image" | "video" | "audio" | "file"
  fileUrl?: string
  fileUrls?: string[]
  fileName?: string
  fileSize?: string
  duration?: string
  waveform?: number[]
  timestamp: string
}

// ── Unified event type ──

export type SSEEventPayload = CallEventPayload | MessageEventPayload | MeetingEventPayload

// ── Ably REST client (server-side, lazy-initialized) ──

let _ablyRest: Ably.Rest | null = null

function getAblyRest(): Ably.Rest {
  if (!_ablyRest) {
    const key = process.env.ABLY_API_KEY
    if (!key) {
      throw new Error("[Ably] ABLY_API_KEY environment variable is not set")
    }
    _ablyRest = new Ably.Rest({ key })
  }
  return _ablyRest
}

/**
 * Publish an event to a specific user's Ably channel.
 */
export async function emitEvent(userId: string, event: SSEEventPayload): Promise<void> {
  try {
    const ably = getAblyRest()
    const channel = ably.channels.get(`user:${userId}`)
    await channel.publish("event", event)
    console.log(`[Ably] Published ${event.type} to user:${userId}`)
  } catch (err) {
    console.error(`[Ably] Failed to publish ${event.type} to user:${userId}:`, err)
  }
}

// Backwards-compat alias
export const emitCallEvent = emitEvent

/**
 * Publish an event to multiple users' Ably channels.
 */
export async function emitEventToMany(
  userIds: string[],
  event: SSEEventPayload
): Promise<void> {
  await Promise.allSettled(
    userIds.map((userId) => emitEvent(userId, event))
  )
}

// Backwards-compat alias
export const emitCallEventToMany = emitEventToMany

/**
 * Create an Ably token for client-side use.
 * The token is scoped to subscribe on the user's channel only.
 */
export async function createAblyToken(
  userId: string
): Promise<Ably.TokenDetails> {
  const ably = getAblyRest()
  const tokenRequest = await ably.auth.createTokenRequest({
    clientId: userId,
    capability: { [`user:${userId}`]: ["subscribe"] },
    ttl: 60 * 60 * 1000, // 1 hour
  })
  // Exchange the token request for an actual token
  const token = await ably.auth.requestToken(tokenRequest)
  return token
}
