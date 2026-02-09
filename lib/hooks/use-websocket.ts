"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import type { MessageWithDetails } from "@/lib/actions/messages"

type WebSocketMessage = {
  type: "message" | "typing" | "read" | "connected" | "error"
  payload: MessageWithDetails | { conversationId: string; userId: string } | { error: string }
}

type UseWebSocketOptions = {
  conversationId: string | null
  userId: string | null
  onMessage?: (message: MessageWithDetails) => void
  onTyping?: (userId: string) => void
  onRead?: (conversationId: string) => void
  onError?: (error: string) => void
}

// WebSocket connection manager
class WebSocketManager {
  private static instance: WebSocketManager | null = null
  private socket: WebSocket | null = null
  private listeners: Map<string, Set<(data: WebSocketMessage) => void>> = new Map()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectTimeout: NodeJS.Timeout | null = null
  private userId: string | null = null

  private constructor() {}

  static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager()
    }
    return WebSocketManager.instance
  }

  connect(userId: string): void {
    if (this.socket?.readyState === WebSocket.OPEN && this.userId === userId) {
      return
    }

    this.userId = userId
    this.disconnect()

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const wsUrl = `${protocol}//${window.location.host}/api/ws?userId=${userId}`

    try {
      this.socket = new WebSocket(wsUrl)

      this.socket.onopen = () => {
        console.log("WebSocket connected")
        this.reconnectAttempts = 0
        this.notifyListeners("global", { type: "connected", payload: { conversationId: "", userId } })
      }

      this.socket.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data)
          
          // Notify all listeners
          this.listeners.forEach((callbacks) => {
            callbacks.forEach((callback) => callback(data))
          })
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error)
        }
      }

      this.socket.onclose = () => {
        console.log("WebSocket disconnected")
        this.attemptReconnect()
      }

      this.socket.onerror = (error) => {
        console.error("WebSocket error:", error)
      }
    } catch (error) {
      console.error("Failed to connect WebSocket:", error)
      this.attemptReconnect()
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts || !this.userId) {
      return
    }

    this.reconnectAttempts++
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)

    this.reconnectTimeout = setTimeout(() => {
      if (this.userId) {
        this.connect(this.userId)
      }
    }, delay)
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
  }

  subscribe(key: string, callback: (data: WebSocketMessage) => void): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set())
    }
    this.listeners.get(key)!.add(callback)

    return () => {
      const callbacks = this.listeners.get(key)
      if (callbacks) {
        callbacks.delete(callback)
        if (callbacks.size === 0) {
          this.listeners.delete(key)
        }
      }
    }
  }

  private notifyListeners(key: string, data: WebSocketMessage): void {
    const callbacks = this.listeners.get(key)
    if (callbacks) {
      callbacks.forEach((callback) => callback(data))
    }
  }

  send(data: WebSocketMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data))
    }
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN
  }
}

export function useWebSocket({
  conversationId,
  userId,
  onMessage,
  onTyping,
  onRead,
  onError,
}: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false)
  const managerRef = useRef<WebSocketManager | null>(null)

  useEffect(() => {
    if (!userId) return

    managerRef.current = WebSocketManager.getInstance()
    managerRef.current.connect(userId)

    const unsubscribe = managerRef.current.subscribe(
      conversationId || "global",
      (data) => {
        switch (data.type) {
          case "connected":
            setIsConnected(true)
            break
          case "message":
            if (onMessage && "id" in data.payload) {
              onMessage(data.payload as MessageWithDetails)
            }
            break
          case "typing":
            if (onTyping && "userId" in data.payload) {
              onTyping((data.payload as { userId: string }).userId)
            }
            break
          case "read":
            if (onRead && "conversationId" in data.payload) {
              onRead((data.payload as { conversationId: string }).conversationId)
            }
            break
          case "error":
            if (onError && "error" in data.payload) {
              onError((data.payload as { error: string }).error)
            }
            break
        }
      }
    )

    return () => {
      unsubscribe()
    }
  }, [userId, conversationId, onMessage, onTyping, onRead, onError])

  const sendMessage = useCallback((message: MessageWithDetails) => {
    managerRef.current?.send({ type: "message", payload: message })
  }, [])

  const sendTyping = useCallback(() => {
    if (conversationId && userId) {
      managerRef.current?.send({
        type: "typing",
        payload: { conversationId, userId },
      })
    }
  }, [conversationId, userId])

  const sendRead = useCallback(() => {
    if (conversationId) {
      managerRef.current?.send({
        type: "read",
        payload: { conversationId, userId: userId || "" },
      })
    }
  }, [conversationId, userId])

  return {
    isConnected,
    sendMessage,
    sendTyping,
    sendRead,
  }
}

// Polling fallback for environments without WebSocket support
export function useMessagePolling({
  conversationId,
  enabled = true,
  interval = 3000,
  onNewMessages,
}: {
  conversationId: string | null
  enabled?: boolean
  interval?: number
  onNewMessages?: (messages: MessageWithDetails[]) => void
}) {
  const lastMessageIdRef = useRef<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)

  useEffect(() => {
    if (!enabled || !conversationId) return

    let timeoutId: NodeJS.Timeout

    const poll = async () => {
      setIsPolling(true)
      try {
        const response = await fetch(
          `/api/messages/poll?conversationId=${conversationId}&lastMessageId=${lastMessageIdRef.current || ""}`
        )
        if (response.ok) {
          const data = await response.json()
          if (data.messages?.length > 0) {
            lastMessageIdRef.current = data.messages[data.messages.length - 1].id
            onNewMessages?.(data.messages)
          }
        }
      } catch (error) {
        console.error("Polling error:", error)
      } finally {
        setIsPolling(false)
        timeoutId = setTimeout(poll, interval)
      }
    }

    poll()

    return () => {
      clearTimeout(timeoutId)
    }
  }, [conversationId, enabled, interval, onNewMessages])

  return { isPolling }
}
