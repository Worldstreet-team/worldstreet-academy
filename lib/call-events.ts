/**
 * Server-side in-memory event bus for real-time signaling.
 * Handles both call events and message events via SSE.
 *
 * CRITICAL: Uses globalThis to share state across Next.js module boundaries.
 * Next.js bundles server actions and route handlers separately, so a plain
 * module-level variable would be different instances in each context.
 * globalThis ensures both read/write the same Map (same Node.js process).
 * This is the same pattern Prisma recommends for its client singleton.
 */

// ── Call event types ──

export type CallEventType =
  | "call:incoming"
  | "call:answered"
  | "call:ended"
  | "call:declined"
  | "call:cancelled"

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

type EventCallback = (event: SSEEventPayload) => void

// Use globalThis to share subscribers across Next.js bundle boundaries
const globalForEvents = globalThis as unknown as {
  __sseEventSubscribers?: Map<string, Set<EventCallback>>
}

if (!globalForEvents.__sseEventSubscribers) {
  globalForEvents.__sseEventSubscribers = new Map()
}

const _subscribers = globalForEvents.__sseEventSubscribers

/**
 * Subscribe a user to all SSE events (calls + messages).
 * Returns an unsubscribe function.
 */
export function subscribeToEvents(
  userId: string,
  callback: EventCallback
): () => void {
  if (!_subscribers.has(userId)) {
    _subscribers.set(userId, new Set())
  }
  _subscribers.get(userId)!.add(callback)

  return () => {
    const subs = _subscribers.get(userId)
    if (subs) {
      subs.delete(callback)
      if (subs.size === 0) {
        _subscribers.delete(userId)
      }
    }
  }
}

// Backwards-compat alias
export const subscribeToCallEvents = subscribeToEvents

/**
 * Emit an event to a specific user.
 */
export function emitEvent(userId: string, event: SSEEventPayload): void {
  const subs = _subscribers.get(userId)
  if (subs && subs.size > 0) {
    console.log(`[SSE Events] Emitting ${event.type} to user ${userId} (${subs.size} subscribers)`)
    for (const callback of subs) {
      try {
        callback(event)
      } catch (err) {
        console.error("[SSE Events] Subscriber error:", err)
      }
    }
  } else {
    console.log(`[SSE Events] No subscribers for user ${userId}, event ${event.type} dropped`)
  }
}

// Backwards-compat aliases
export const emitCallEvent = emitEvent

/**
 * Emit an event to multiple users.
 */
export function emitEventToMany(
  userIds: string[],
  event: SSEEventPayload
): void {
  for (const userId of userIds) {
    emitEvent(userId, event)
  }
}

// Backwards-compat alias
export const emitCallEventToMany = emitEventToMany

/**
 * Get count of active subscribers (for debugging).
 */
export function getSubscriberCount(): number {
  let count = 0
  for (const subs of _subscribers.values()) {
    count += subs.size
  }
  return count
}
