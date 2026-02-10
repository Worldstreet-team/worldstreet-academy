"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import * as Ably from "ably"
import type { CallEventPayload, MessageEventPayload, SSEEventPayload } from "@/lib/call-events"

type RealtimeEventHandler = (event: SSEEventPayload) => void

// Singleton Ably Realtime client — shared across all hook instances
let _ablyClient: Ably.Realtime | null = null

function getAblyClient(): Ably.Realtime {
  if (!_ablyClient) {
    const key = process.env.NEXT_PUBLIC_ABLY_KEY
    if (!key) {
      throw new Error("[Ably] NEXT_PUBLIC_ABLY_KEY is not set")
    }
    _ablyClient = new Ably.Realtime({
      key,
      // Auto-reconnect with exponential backoff (built-in)
      disconnectedRetryTimeout: 1000,
      suspendedRetryTimeout: 5000,
    })
  }
  return _ablyClient
}

/**
 * Client-side hook that connects to Ably Realtime for real-time events.
 * Handles call events, message events, and meeting events.
 * Ably handles reconnection automatically with exponential backoff.
 */
export function useSSEEvents(
  userId: string | null,
  onEvent: RealtimeEventHandler
) {
  const [isConnected, setIsConnected] = useState(false)
  const onEventRef = useRef(onEvent)
  const channelRef = useRef<Ably.RealtimeChannel | null>(null)

  // Keep handler ref up to date without re-triggering effect
  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  useEffect(() => {
    if (!userId) return

    const ably = getAblyClient()
    const channelName = `user:${userId}`

    // Monitor connection state
    const onConnectionStateChange = (stateChange: Ably.ConnectionStateChange) => {
      console.log(`[Ably] Connection state: ${stateChange.current}`)
      setIsConnected(stateChange.current === "connected")
    }
    ably.connection.on(onConnectionStateChange)

    // Set initial connection state
    setIsConnected(ably.connection.state === "connected")

    // Subscribe to the user's channel
    const channel = ably.channels.get(channelName)
    channelRef.current = channel

    const onMessage = (message: Ably.Message) => {
      try {
        const data = message.data as SSEEventPayload
        if (data && data.type) {
          onEventRef.current(data)
        }
      } catch (err) {
        console.error("[Ably] Failed to process message:", err)
      }
    }

    channel.subscribe("event", onMessage)
    console.log(`[Ably] Subscribed to channel: ${channelName}`)

    return () => {
      console.log(`[Ably] Unsubscribing from channel: ${channelName}`)
      channel.unsubscribe("event", onMessage)
      ably.connection.off(onConnectionStateChange)
      channelRef.current = null
      // Don't close the Ably client — it's shared across hook instances
    }
  }, [userId])

  return { isConnected }
}

// Backwards-compat alias for call-only consumers
export function useCallEvents(
  userId: string | null,
  onEvent: (event: CallEventPayload) => void
) {
  const handler = useCallback(
    (event: SSEEventPayload) => {
      if (event.type.startsWith("call:")) {
        onEvent(event as CallEventPayload)
      }
    },
    [onEvent]
  )
  return useSSEEvents(userId, handler)
}

// Hook for message-only consumers
export function useMessageEvents(
  userId: string | null,
  onEvent: (event: MessageEventPayload) => void
) {
  const handler = useCallback(
    (event: SSEEventPayload) => {
      if (event.type.startsWith("message:")) {
        onEvent(event as MessageEventPayload)
      }
    },
    [onEvent]
  )
  return useSSEEvents(userId, handler)
}
