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
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Call02Icon,
  CallEnd01Icon,
  Video01Icon,
  WifiConnected01Icon,
} from "@hugeicons/core-free-icons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { VideoCall } from "@/components/messages/video-call"
import {
  endCall as endCallAction,
  pollIncomingCall,
  cleanupOrphanedCalls,
  getActiveCall,
  rejoinCall,
} from "@/lib/actions/calls"
import { useSSEEvents } from "@/lib/hooks/use-call-events"
import { useUser } from "@/components/providers/user-provider"
import { callSounds } from "@/lib/call-sounds"
import { rtkClient } from "@/lib/rtk-client"
import type { CallEventPayload, SSEEventPayload } from "@/lib/call-events"

type CallType = "video" | "audio"
type CallState =
  | "idle"
  | "ringing"
  | "connecting"
  | "connected"
  | "ended"
  | "busy"
  | "reconnecting"

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
  /** Whether this is a reconnection to an existing call */
  isReconnection?: boolean
  /** When the call was originally answered (for reconnection timer) */
  originalAnsweredAt?: string
}

type CallContextType = {
  activeCall: CallInfo | null
  callState: CallState
  isMinimized: boolean
  /** Whether the remote participant has rejoined after a disconnect */
  remoteRejoined: boolean
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

/** Returns the active call participant info for display (e.g. merged avatar in sidebar) */
export function useActiveCallInfo() {
  const context = useContext(CallContext)
  if (!context?.hasOngoingCall || !context.activeCall) return null
  return {
    participantName: context.activeCall.participantName,
    participantAvatar: context.activeCall.participantAvatar,
  }
}

export function CallProvider({ children }: { children: ReactNode }) {
  const user = useUser()
  const [activeCall, setActiveCall] = useState<CallInfo | null>(null)
  const [callState, setCallState] = useState<CallState>("idle")
  const [isMinimized, setIsMinimized] = useState(false)
  const [showCallUI, setShowCallUI] = useState(false)
  const [remoteRejoined, setRemoteRejoined] = useState(false)
  const dismissedCallsRef = useRef<Set<string>>(new Set())

  // Preload call sounds on mount so they're ready for instant playback
  useEffect(() => {
    callSounds.preload()
  }, [])

  // On mount: check for active ongoing call (reconnection), then clean stale calls
  useEffect(() => {
    let cancelled = false

    async function checkAndCleanup() {
      try {
        // First, check if we have an active ongoing call to rejoin
        const { activeCall: existingCall } = await getActiveCall()
        if (cancelled) return

        if (existingCall) {
          console.log(
            `[CallProvider] Found active call ${existingCall.callId} — showing reconnection UI`
          )
          setActiveCall({
            callId: existingCall.callId,
            callType: existingCall.callType,
            participantId: existingCall.participantId,
            participantName: existingCall.participantName,
            participantAvatar: existingCall.participantAvatar || undefined,
            isIncoming: existingCall.isIncoming,
            conversationId: existingCall.conversationId,
            authToken: existingCall.authToken,
            isReconnection: true,
            originalAnsweredAt: existingCall.answeredAt,
          })
          setCallState("reconnecting")
          setShowCallUI(true)
          setIsMinimized(true)
          return // Don't clean up — this call is active
        }

        // No active call — destroy any leftover RTK client
        // Guard: don't destroy if a call was started while getActiveCall was pending
        const currentState = callStateRef.current
        if (
          currentState === "idle" &&
          (rtkClient.isInRoom || rtkClient.client)
        ) {
          console.log("[CallProvider] Destroying leftover RTK client")
          rtkClient.destroy().catch(() => {})
        }

        // Clean up only stale orphaned calls (ringing >60s, ongoing >2h)
        const { cleaned } = await cleanupOrphanedCalls()
        if (cleaned > 0) {
          console.log(`[CallProvider] Cleaned ${cleaned} orphaned calls`)
        }
      } catch {
        // Ignore errors
      }
    }

    checkAndCleanup()
    return () => {
      cancelled = true
    }
  }, [])

  // On page unload: try to end the active call
  useEffect(() => {
    const handleBeforeUnload = () => {
      const current = activeCallRef.current
      const state = callStateRef.current
      if (!current?.callId) return
      if (
        state !== "connecting" &&
        state !== "connected" &&
        state !== "ringing"
      )
        return

      try {
        const payload = JSON.stringify({ callId: current.callId })
        navigator.sendBeacon("/api/calls/end", payload)
      } catch {
        endCallAction(current.callId).catch(() => {})
      }

      try {
        rtkClient.destroy().catch(() => {})
      } catch {
        // ignore
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [])

  // Refs for accessing latest state in callbacks
  const activeCallRef = useRef<CallInfo | null>(null)
  const callStateRef = useRef<CallState>("idle")

  const hasOngoingCall =
    callState === "connecting" ||
    callState === "connected" ||
    callState === "ringing" ||
    callState === "reconnecting"

  // Auto-close busy state
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

  // Keep refs in sync
  useEffect(() => {
    activeCallRef.current = activeCall
    callStateRef.current = callState
  }, [activeCall, callState])

  // Handle call events via Ably
  const handleCallEvent = useCallback(
    (event: CallEventPayload) => {
      console.log("[CallProvider] Ably event:", event.type, event.callId)

      switch (event.type) {
        case "call:incoming": {
          const isInActiveCall =
            rtkClient.isInRoom ||
            (callStateRef.current !== "idle" &&
              callStateRef.current !== "ended" &&
              callStateRef.current !== "reconnecting")

          if (isInActiveCall) {
            // If we're already ringing from the SAME caller, update to the newer call
            // (handles React Strict Mode double-initiation + rapid re-calls)
            const current = activeCallRef.current
            if (
              current &&
              current.participantId === event.callerId &&
              callStateRef.current === "ringing"
            ) {
              console.log("[CallProvider] Same caller calling again — updating to new call")
              setActiveCall((prev) =>
                prev
                  ? {
                      ...prev,
                      callId: event.callId,
                      authToken: event.authToken,
                    }
                  : prev
              )
              return
            }

            console.log("[CallProvider] Already in a call, auto-declining")
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
          if (dismissedCallsRef.current.has(event.callId)) return

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
          setIsMinimized(true)
          break
        }

        case "call:cancelled": {
          const current = activeCallRef.current
          if (current?.callId === event.callId) {
            dismissedCallsRef.current.add(event.callId)
            setCallState("ended")
          }
          break
        }

        case "call:declined": {
          const current = activeCallRef.current
          if (current?.callId === event.callId) {
            dismissedCallsRef.current.add(event.callId)
            setCallState("ended")
          }
          break
        }

        case "call:answered": {
          console.log("[CallProvider] Call answered, VideoCall handles join")
          break
        }

        case "call:ended": {
          const current = activeCallRef.current
          if (current?.callId === event.callId) {
            dismissedCallsRef.current.add(event.callId)
            setCallState("ended")
          }
          break
        }

        case "call:busy": {
          setCallState("busy")
          break
        }

        case "call:participant-rejoined": {
          const current = activeCallRef.current
          if (current?.callId === event.callId) {
            console.log("[CallProvider] Remote participant rejoined")
            setRemoteRejoined(true)
            setTimeout(() => setRemoteRejoined(false), 5000)
          }
          break
        }
      }
    },
    []
  )

  // Forward ALL events to window for cross-component consumption
  const handleAllEvents = useCallback(
    (event: SSEEventPayload) => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("sse:event", { detail: event })
        )
      }
      if (event.type.startsWith("call:")) {
        handleCallEvent(event as CallEventPayload)
      }
    },
    [handleCallEvent]
  )

  // Connect to Ably for real-time events
  useSSEEvents(user.id, handleAllEvents)

  // Polling fallback for incoming calls
  useEffect(() => {
    const poll = async () => {
      if (rtkClient.isInRoom) return
      if (
        callStateRef.current !== "idle" &&
        callStateRef.current !== "ended"
      )
        return
      try {
        const result = await pollIncomingCall()
        if (result.incoming && callStateRef.current === "idle") {
          if (dismissedCallsRef.current.has(result.incoming.callId)) return
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
      if (rtkClient.isInRoom) return
      if (
        callStateRef.current === "connecting" ||
        callStateRef.current === "connected" ||
        callStateRef.current === "ringing"
      )
        return

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
      callSounds.resume()
    },
    []
  )

  // Rejoin an active call after refresh
  const handleRejoin = useCallback(async () => {
    const current = activeCallRef.current
    if (!current?.callId || !current.authToken) return

    console.log("[CallProvider] Rejoining call:", current.callId)
    setCallState("connecting")

    try {
      const result = await rejoinCall(current.callId)
      if (!result.success) {
        console.error("[CallProvider] Rejoin failed:", result.error)
        // Call is no longer active — clean up
        setActiveCall(null)
        setCallState("idle")
        setShowCallUI(false)
        setIsMinimized(false)
        return
      }

      const token = result.authToken || current.authToken
      await rtkClient.init(token, {
        audio: true,
        video: current.callType === "video",
      })
      await rtkClient.joinRoom()
      try {
        await rtkClient.client?.self.enableAudio()
      } catch {}
      if (current.callType === "video") {
        try {
          await rtkClient.client?.self.enableVideo()
        } catch {}
      }

      console.log("[CallProvider] Rejoin successful")
      setActiveCall((prev) =>
        prev ? { ...prev, isReconnection: false } : prev
      )
      // Don't set connected yet — participantJoined RTK event will do that
      // Just keep connecting state so the UI shows progress
    } catch (err) {
      console.error("[CallProvider] Rejoin RTK failed:", err)
      setActiveCall(null)
      setCallState("idle")
      setShowCallUI(false)
      setIsMinimized(false)
    }
  }, [])

  // Dismiss the reconnection banner
  const handleDismissReconnection = useCallback(async () => {
    const current = activeCallRef.current
    if (current?.callId) {
      dismissedCallsRef.current.add(current.callId)
      try {
        await endCallAction(current.callId)
      } catch {}
    }
    try {
      await rtkClient.leaveRoom()
    } catch {}
    setActiveCall(null)
    setCallState("idle")
    setShowCallUI(false)
    setIsMinimized(false)
  }, [])

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
    setRemoteRejoined(false)
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
    setRemoteRejoined(false)
  }, [])

  return (
    <CallContext.Provider
      value={{
        activeCall,
        callState,
        isMinimized,
        remoteRejoined,
        startCall,
        endCall,
        setMinimized: setIsMinimized,
        onCallConnected,
        onCallEnded,
        hasOngoingCall,
      }}
    >
      {children}

      {/* Reconnection banner — shown when user refreshed during an active call */}
      {activeCall && showCallUI && callState === "reconnecting" && (
        <ReconnectionBanner
          callInfo={activeCall}
          remoteRejoined={remoteRejoined}
          onRejoin={handleRejoin}
          onDismiss={handleDismissReconnection}
        />
      )}

      {/* Normal call UI */}
      {activeCall && showCallUI && callState !== "reconnecting" && (
        <VideoCall
          open={!isMinimized}
          onClose={handleClose}
          callType={activeCall.callType}
          callerName={activeCall.participantName}
          callerAvatar={activeCall.participantAvatar}
          isIncoming={activeCall.isIncoming}
          incomingCallId={
            activeCall.isIncoming
              ? activeCall.callId || undefined
              : undefined
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
          isReconnection={activeCall.isReconnection}
          reconnectionAuthToken={
            activeCall.isReconnection ? activeCall.authToken : undefined
          }
          originalAnsweredAt={activeCall.originalAnsweredAt}
          remoteRejoined={remoteRejoined}
        />
      )}
    </CallContext.Provider>
  )
}

// ── Reconnection Banner Component ──

function ReconnectionBanner({
  callInfo,
  remoteRejoined,
  onRejoin,
  onDismiss,
}: {
  callInfo: CallInfo
  remoteRejoined: boolean
  onRejoin: () => void
  onDismiss: () => void
}) {
  const [isRejoining, setIsRejoining] = useState(false)

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)

  const handleRejoin = async () => {
    setIsRejoining(true)
    await onRejoin()
    setIsRejoining(false)
  }

  return (
    <div className="fixed bottom-24 right-4 z-[9999] animate-in slide-in-from-bottom-4 fade-in duration-200">
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border border-border/50 bg-background">
        <div className="relative">
          <Avatar className="w-10 h-10">
            <AvatarImage
              src={callInfo.participantAvatar}
              alt={callInfo.participantName}
            />
            <AvatarFallback className="text-xs">
              {getInitials(callInfo.participantName)}
            </AvatarFallback>
          </Avatar>
          {remoteRejoined && (
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
              <HugeiconsIcon
                icon={WifiConnected01Icon}
                size={8}
                className="text-white"
              />
            </div>
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">
            {callInfo.participantName}
          </span>
          <span className="text-xs text-muted-foreground">
            {remoteRejoined
              ? "Participant is back"
              : `Active ${callInfo.callType} call`}
          </span>
        </div>
        <div className="flex items-center gap-2 ml-2">
          <button
            onClick={onDismiss}
            disabled={isRejoining}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
          >
            <HugeiconsIcon icon={CallEnd01Icon} size={16} />
          </button>
          <button
            onClick={handleRejoin}
            disabled={isRejoining}
            className="h-9 px-3 rounded-full flex items-center justify-center gap-1.5 bg-green-500 text-white hover:bg-green-600 transition-colors disabled:opacity-50 text-xs font-medium"
          >
            {isRejoining ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <HugeiconsIcon
                  icon={
                    callInfo.callType === "video" ? Video01Icon : Call02Icon
                  }
                  size={14}
                />
                Rejoin
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
