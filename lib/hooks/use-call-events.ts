"use client"

import { useEffect, useRef, useState } from "react"
import type { CallEventPayload, MessageEventPayload, SSEEventPayload } from "@/lib/call-events"

type SSEEventHandler = (event: SSEEventPayload) => void

/**
 * Client-side hook that connects to the SSE endpoint for real-time events.
 * Handles both call events and message events.
 * Automatically reconnects on disconnection with exponential backoff.
 */
export function useSSEEvents(
  userId: string | null,
  onEvent: SSEEventHandler
) {
  const [isConnected, setIsConnected] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectAttemptRef = useRef(0)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onEventRef = useRef(onEvent)
  const mountedRef = useRef(true)

  // Keep handler ref up to date without re-triggering effect
  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  useEffect(() => {
    if (!userId) return
    mountedRef.current = true

    function connect() {
      if (!userId || !mountedRef.current) return

      // Close existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }

      console.log("[SSE Client] Connecting to /api/calls/events...")
      const es = new EventSource("/api/calls/events")
      eventSourceRef.current = es

      es.onopen = () => {
        if (!mountedRef.current) return
        console.log("[SSE Client] Connected")
        setIsConnected(true)
        reconnectAttemptRef.current = 0
      }

      es.onmessage = (event) => {
        if (!mountedRef.current) return
        try {
          const data = JSON.parse(event.data)
          if (data.type === "connected") {
            console.log("[SSE Client] Server confirmed connection for user:", data.userId)
            return
          }
          // Dispatch the call event
          onEventRef.current(data as CallEventPayload)
        } catch (err) {
          console.error("[SSE Client] Failed to parse event:", err)
        }
      }

      es.onerror = () => {
        if (!mountedRef.current) return
        console.log("[SSE Client] Connection error/closed")
        setIsConnected(false)
        es.close()
        eventSourceRef.current = null

        // Exponential backoff reconnect: 1s, 2s, 4s, 8s, max 30s
        const attempt = reconnectAttemptRef.current
        const delay = Math.min(1000 * Math.pow(2, attempt), 30_000)
        reconnectAttemptRef.current = attempt + 1

        console.log(`[SSE Client] Reconnecting in ${delay}ms (attempt ${attempt + 1})`)
        reconnectTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) connect()
        }, delay)
      }
    }

    connect()

    return () => {
      mountedRef.current = false
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
    }
  }, [userId])

  return { isConnected }
}

// Backwards-compat alias for call-only consumers
export function useCallEvents(
  userId: string | null,
  onEvent: (event: CallEventPayload) => void
) {
  return useSSEEvents(userId, (event) => {
    if (event.type.startsWith("call:")) {
      onEvent(event as CallEventPayload)
    }
  })
}

// Hook for message-only consumers
export function useMessageEvents(
  userId: string | null,
  onEvent: (event: MessageEventPayload) => void
) {
  return useSSEEvents(userId, (event) => {
    if (event.type.startsWith("message:")) {
      onEvent(event as MessageEventPayload)
    }
  })
}
