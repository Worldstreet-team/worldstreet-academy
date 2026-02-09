"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from "react"
import { VideoCall } from "@/components/messages/video-call"
import {
  getCallStatus,
  pollIncomingCall,
  endCall as endCallAction,
} from "@/lib/actions/calls"

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
  const [activeCall, setActiveCall] = useState<CallInfo | null>(null)
  const [callState, setCallState] = useState<CallState>("idle")
  const [isMinimized, setIsMinimized] = useState(false)
  const [showCallUI, setShowCallUI] = useState(false)
  const dismissedCallsRef = useRef<Set<string>>(new Set())

  const hasOngoingCall =
    callState === "connecting" ||
    callState === "connected" ||
    callState === "ringing"

  // Refresh prevention when call is active
  useEffect(() => {
    if (!hasOngoingCall) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = "You have an ongoing call. Leaving will end the call."
      return e.returnValue
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [hasOngoingCall])

  // Poll for incoming calls using server action
  useEffect(() => {
    if (hasOngoingCall) return
    let active = true

    async function poll() {
      try {
        const data = await pollIncomingCall()
        if (!active) return

        if (
          data.incoming &&
          !dismissedCallsRef.current.has(data.incoming.callId)
        ) {
          const incoming = data.incoming
          setActiveCall({
            callId: incoming.callId,
            callType: incoming.callType,
            participantId: incoming.callerId,
            participantName: incoming.callerName,
            participantAvatar: incoming.callerAvatar || undefined,
            isIncoming: true,
            conversationId: incoming.conversationId,
          })
          setCallState("ringing")
          setShowCallUI(true)
          setIsMinimized(false)
        }
      } catch {
        // Silently ignore poll errors
      }
    }

    const interval = setInterval(poll, 1500)
    poll()

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [hasOngoingCall])

  // Poll active call status to detect remote end
  useEffect(() => {
    if (!activeCall?.callId) return
    // Poll as long as we have an active call that isn't ended
    if (callState === "idle" || callState === "ended") return
    let active = true

    const interval = setInterval(async () => {
      if (!active || !activeCall?.callId) return
      const result = await getCallStatus(activeCall.callId)
      if (!active) return
      if (
        result.success &&
        result.status &&
        ["completed", "missed", "declined", "failed"].includes(result.status)
      ) {
        setCallState("ended")
      }
    }, 2000)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [activeCall?.callId, callState])

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
    if (activeCall?.callId) {
      dismissedCallsRef.current.add(activeCall.callId)
    }
    setCallState("ended")
  }, [activeCall])

  const onCallConnected = useCallback((callId: string) => {
    // Only update the callId on the active call — don't change callState here.
    // The VideoCall component manages its own internal state transitions.
    // The provider callState is only for: idle → ringing/connecting → ended lifecycle.
    setActiveCall((prev) => (prev ? { ...prev, callId } : prev))
  }, [])

  const onCallEnded = useCallback(() => {
    if (activeCall?.callId) {
      dismissedCallsRef.current.add(activeCall.callId)
    }
    setActiveCall(null)
    setCallState("idle")
    setShowCallUI(false)
    setIsMinimized(false)
  }, [activeCall])

  const handleClose = useCallback(() => {
    if (activeCall?.callId) {
      dismissedCallsRef.current.add(activeCall.callId)
      // End the call on the server if it's still active
      endCallAction(activeCall.callId).catch(() => {})
    }
    setActiveCall(null)
    setCallState("idle")
    setShowCallUI(false)
    setIsMinimized(false)
  }, [activeCall])

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
