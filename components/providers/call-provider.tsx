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
import { endCall as endCallAction, pollIncomingCall } from "@/lib/actions/calls"
import { useCallEvents } from "@/lib/hooks/use-call-events"
import { useUser } from "@/components/providers/user-provider"
import { callSounds } from "@/lib/call-sounds"
import type { CallEventPayload } from "@/lib/call-events"

type CallType = "video" | "audio"
type CallState = "idle" | "ringing" | "connecting" | "connected" | "ended"

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
  // Ref to access latest state in the SSE callback without re-subscribing
  const activeCallRef = useRef<CallInfo | null>(null)
  const callStateRef = useRef<CallState>("idle")

  const hasOngoingCall =
    callState === "connecting" ||
    callState === "connected" ||
    callState === "ringing"

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
          // Only show if we don't already have an active call and haven't dismissed this one
          if (
            callStateRef.current !== "idle" &&
            callStateRef.current !== "ended"
          ) {
            console.log("[CallProvider] Already in a call, ignoring incoming")
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
          setIsMinimized(false)
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
      }
    },
    [] // No deps — uses refs for latest state
  )

  // Connect to SSE for real-time call events
  useCallEvents(user.id, handleCallEvent)

  // Polling fallback for incoming calls (safety net if SSE misses an event)
  useEffect(() => {
    const poll = async () => {
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
          setIsMinimized(false)
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
