"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  ReactNode,
} from "react"
import { VideoCall } from "@/components/messages/video-call"
import { endCall as endCallAction, pollIncomingCall, cleanupOrphanedCalls } from "@/lib/actions/calls"
import { useSSEEvents } from "@/lib/hooks/use-call-events"
import { useUser } from "@/components/providers/user-provider"
import { callSounds } from "@/lib/call-sounds"
import { rtkClient } from "@/lib/rtk-client"
import type { CallEventPayload, SSEEventPayload } from "@/lib/call-events"

type CallType = "video" | "audio"
type CallState = "idle" | "ringing" | "connecting" | "connected" | "ended" | "busy"

type CallInfo = {
  callId: string | null
  callType: CallType
  participantId: string
  participantName: string
  participantAvatar?: string
  isIncoming: boolean
  conversationId?: string
  /** Pre-fetched auth token for fast answer (receiver only) */
  authToken?: string
}

type CallContextType = {
  activeCall: CallInfo | null
  callState: CallState
  isMinimized: boolean
  startCall: (params: {
    participantId: string
    participantName: string
    participantAvatar?: string
    callType: CallType
  }) => void
  endCall: () => void
  setMinimized: (minimized: boolean) => void
  onCallConnected: (callId: string) => void
  onCallEnded: () => void
  hasOngoingCall: boolean
}

const CallContext = createContext<CallContextType | null>(null)

export function useCall() {
  const context = useContext(CallContext)
  if (!context) {
    throw new Error("useCall must be used within CallProvider")
  }
  return context
}

export function useOngoingCall() {
  const context = useContext(CallContext)
  return context?.hasOngoingCall ?? false
}

export function CallProvider({ children }: { children: ReactNode }) {
  const user = useUser()
  const [activeCall, setActiveCall] = useState<CallInfo | null>(null)
  const [callState, setCallState] = useState<CallState>("idle")
  const [isMinimized, setIsMinimized] = useState(false)
  const [showCallUI, setShowCallUI] = useState(false)
  const dismissedCallsRef = useRef<Set<string>>(new Set())

  // Preload call sounds on mount so they're ready for instant playback
  useEffect(() => {
    callSounds.preload()
  }, [])

  // On mount: clean up any orphaned calls from previous sessions
  // (page refresh, HMR, crash, navigation, etc.)
  useEffect(() => {
    cleanupOrphanedCalls()
      .then(({ cleaned }) => {
        if (cleaned > 0) {
          console.log(`[CallProvider] Cleaned ${cleaned} orphaned calls on mount`)
        }
      })
      .catch(() => {})

    // Also destroy any leftover RTK client from a previous session
    if (rtkClient.isInRoom || rtkClient.client) {
      console.log("[CallProvider] Destroying leftover RTK client from previous session")
      rtkClient.destroy().catch(() => {})
    }
  }, [])

  // On page unload: try to end the active call so it doesn't stay stuck in DB
  useEffect(() => {
    const handleBeforeUnload = () => {
      const current = activeCallRef.current
      const state = callStateRef.current
      if (!current?.callId) return
      if (state !== "connecting" && state !== "connected" && state !== "ringing") return

      // Use sendBeacon for reliable delivery during page unload
      // We can't use server actions here because they're async and won't complete during unload
      // Instead, send a beacon to a lightweight API route
      try {
        const payload = JSON.stringify({ callId: current.callId })
        navigator.sendBeacon("/api/calls/end", payload)
        console.log("[CallProvider] Sent beacon to end call", current.callId)
      } catch {
        // Last resort: fire-and-forget server action (may not complete)
        endCallAction(current.callId).catch(() => {})
      }

      // Clean up RTK client synchronously
      try {
        rtkClient.destroy().catch(() => {})
      } catch {
        // ignore
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [])

  // Ref to access latest state in the SSE callback without re-subscribing
  const activeCallRef = useRef<CallInfo | null>(null)
  const callStateRef = useRef<CallState>("idle")

  const hasOngoingCall =
    callState === "connecting" ||
    callState === "connected" ||
    callState === "ringing"

  // When a user is busy, auto-close after showing the busy state briefly
  useEffect(() => {
    if (callState !== "busy") return
    callSounds.playDeclined()
    const timer = setTimeout(() => {
      setActiveCall(null)
      setCallState("idle")
      setShowCallUI(false)
      setIsMinimized(false)
    }, 3000)
    return () => clearTimeout(timer)
  }, [callState])

  // Keep refs in sync (must be in useEffect for React 19)
  useEffect(() => {
    activeCallRef.current = activeCall
    callStateRef.current = callState
  }, [activeCall, callState])

  // Handle SSE call events
  const handleCallEvent = useCallback(
    (event: CallEventPayload) => {
      console.log("[CallProvider] SSE event:", event.type, event.callId)

      switch (event.type) {
        case "call:incoming": {
          // Check LIVE connection state — if RTK is in a room, we're in an active call
          const isInActiveCall =
            rtkClient.isInRoom ||
            (callStateRef.current !== "idle" && callStateRef.current !== "ended")

          if (isInActiveCall) {
            console.log("[CallProvider] Already in a call (RTK.isInRoom:", rtkClient.isInRoom, "), auto-declining incoming")
            // Auto-decline the incoming call and notify the caller they're busy
            ;(async () => {
              try {
                const { declineCall } = await import("@/lib/actions/calls")
                await declineCall(event.callId)
              } catch (err) {
                console.error("[CallProvider] Auto-decline failed:", err)
              }
            })()
            return
          }
          if (dismissedCallsRef.current.has(event.callId)) {
            console.log("[CallProvider] Call already dismissed, ignoring")
            return
          }
          setActiveCall({
            callId: event.callId,
            callType: event.callType,
            participantId: event.callerId,
            participantName: event.callerName,
            participantAvatar: event.callerAvatar || undefined,
            isIncoming: true,
            conversationId: event.conversationId,
            authToken: event.authToken,
          })
          setCallState("ringing")
          setShowCallUI(true)
          // Incoming calls start minimized — user can tap to expand or answer from there
          setIsMinimized(true)
          break
        }

        case "call:cancelled": {
          // Caller hung up before we answered — dismiss the incoming call
          const current = activeCallRef.current
          if (current?.callId === event.callId) {
            console.log("[CallProvider] Call cancelled by caller")
            dismissedCallsRef.current.add(event.callId)
            setCallState("ended")
          }
          break
        }

        case "call:declined": {
          // Receiver declined — notify caller
          const current = activeCallRef.current
          if (current?.callId === event.callId) {
            console.log("[CallProvider] Call declined by receiver")
            dismissedCallsRef.current.add(event.callId)
            setCallState("ended")
          }
          break
        }

        case "call:answered": {
          // Receiver answered — the VideoCall component handles room join
          console.log("[CallProvider] Call answered, VideoCall will handle room join")
          break
        }

        case "call:ended": {
          // Call ended by the other participant
          const current = activeCallRef.current
          if (current?.callId === event.callId) {
            console.log("[CallProvider] Call ended by remote participant")
            dismissedCallsRef.current.add(event.callId)
            setCallState("ended")
          }
          break
        }

        case "call:busy": {
          // Receiver is on another call
          console.log("[CallProvider] Receiver is busy/on another call")
          setCallState("busy")
          break
        }
      }
    },
    [] // No deps — uses refs for latest state
  )

  // Forward ALL SSE events to window so other components (meetings, etc.) can listen
  const handleAllSSEEvents = useCallback(
    (event: SSEEventPayload) => {
      // Dispatch to window for cross-component consumption
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("sse:event", { detail: event }),
        )
      }
      // Handle call events locally
      if (event.type.startsWith("call:")) {
        handleCallEvent(event as CallEventPayload)
      }
    },
    [handleCallEvent],
  )

  // Connect to SSE for real-time events
  useSSEEvents(user.id, handleAllSSEEvents)

  // Polling fallback for incoming calls (safety net if SSE misses an event)
  useEffect(() => {
    const poll = async () => {
      // Check LIVE connection state — don't poll if already in a call
      if (rtkClient.isInRoom) return
      // Only poll when idle — SSE handles events during active calls
      if (callStateRef.current !== "idle" && callStateRef.current !== "ended") return
      try {
        const result = await pollIncomingCall()
        if (result.incoming && callStateRef.current === "idle") {
          // Check if not already dismissed
          if (dismissedCallsRef.current.has(result.incoming.callId)) return
          console.log("[CallProvider] Fallback poll detected incoming call:", result.incoming.callId)
          setActiveCall({
            callId: result.incoming.callId,
            callType: result.incoming.callType,
            participantId: result.incoming.callerId,
            participantName: result.incoming.callerName,
            participantAvatar: result.incoming.callerAvatar || undefined,
            isIncoming: true,
            conversationId: result.incoming.conversationId,
            authToken: result.incoming.authToken,
          })
          setCallState("ringing")
          setShowCallUI(true)
          // Incoming calls start minimized
          setIsMinimized(true)
        }
      } catch {
        // Ignore poll errors
      }
    }

    const interval = setInterval(poll, 5000)
    return () => clearInterval(interval)
  }, [])

  const startCall = useCallback(
    (params: {
      participantId: string
      participantName: string
      participantAvatar?: string
      callType: CallType
    }) => {
      // Check LIVE connection state — if RTK is in a room, we're actually in a call
      if (rtkClient.isInRoom) {
        console.log("[CallProvider] RTK is in a room, cannot start new call")
        return
      }
      // Also check our state (for UI consistency)
      if (
        callStateRef.current === "connecting" ||
        callStateRef.current === "connected" ||
        callStateRef.current === "ringing"
      ) {
        console.log("[CallProvider] Already in a call state, ignoring startCall")
        return
      }
      // Instant UI update — show the call modal immediately before any network requests
      setActiveCall({
        callId: null,
        callType: params.callType,
        participantId: params.participantId,
        participantName: params.participantName,
        participantAvatar: params.participantAvatar,
        isIncoming: false,
      })
      setCallState("connecting")
      setShowCallUI(true)
      setIsMinimized(false)
      // Resume audio context on user gesture so sounds play instantly
      callSounds.resume()
    },
    []
  )

  const endCall = useCallback(() => {
    if (activeCallRef.current?.callId) {
      dismissedCallsRef.current.add(activeCallRef.current.callId)
    }
    setCallState("ended")
  }, [])

  const onCallConnected = useCallback((callId: string) => {
    setActiveCall((prev) => (prev ? { ...prev, callId } : prev))
  }, [])

  const onCallEnded = useCallback(() => {
    const current = activeCallRef.current
    if (current?.callId) {
      dismissedCallsRef.current.add(current.callId)
    }
    setActiveCall(null)
    setCallState("idle")
    setShowCallUI(false)
    setIsMinimized(false)
  }, [])

  const handleClose = useCallback(() => {
    const current = activeCallRef.current
    if (current?.callId) {
      dismissedCallsRef.current.add(current.callId)
      endCallAction(current.callId).catch(() => {})
    }
    setActiveCall(null)
    setCallState("idle")
    setShowCallUI(false)
    setIsMinimized(false)
  }, [])

  return (
    <CallContext.Provider
      value={{
        activeCall,
        callState,
        isMinimized,
        startCall,
        endCall,
        setMinimized: setIsMinimized,
        onCallConnected,
        onCallEnded,
        hasOngoingCall,
      }}
    >
      {children}

      {activeCall && showCallUI && (
        <VideoCall
          open={!isMinimized}
          onClose={handleClose}
          callType={activeCall.callType}
          callerName={activeCall.participantName}
          callerAvatar={activeCall.participantAvatar}
          isIncoming={activeCall.isIncoming}
          incomingCallId={
            activeCall.isIncoming ? activeCall.callId || undefined : undefined
          }
          incomingAuthToken={
            activeCall.isIncoming ? activeCall.authToken : undefined
          }
          receiverId={
            !activeCall.isIncoming ? activeCall.participantId : undefined
          }
          onCallStarted={onCallConnected}
          onCallEnded={onCallEnded}
          isMinimized={isMinimized}
          onMinimize={() => setIsMinimized(true)}
          onRestore={() => setIsMinimized(false)}
        />
      )}
    </CallContext.Provider>
  )
}
