"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Call02Icon,
  CallEnd01Icon,
  Mic01Icon,
  MicOff01Icon,
  Video01Icon,
  VideoOffIcon,
  SpeakerIcon,
  Speaker01Icon,
  FlipHorizontalIcon,
  MinimizeScreenIcon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useRealtimeKitClient } from "@cloudflare/realtimekit-react"
import {
  initiateCall,
  answerCall,
  endCall as endCallAction,
  getCallStatus,
} from "@/lib/actions/calls"

type CallType = "video" | "audio"
type CallState = "ringing" | "connecting" | "connected" | "ended"

type VideoCallProps = {
  open: boolean
  onClose: () => void
  callType: CallType
  callerName: string
  callerAvatar?: string
  isIncoming?: boolean
  incomingCallId?: string
  receiverId?: string
  onCallStarted?: (callId: string) => void
  onCallEnded?: () => void
  isMinimized?: boolean
  onMinimize?: () => void
  onRestore?: () => void
}

// Glassmorphic button
function GlassButton({
  onClick,
  children,
  variant = "default",
  size = "default",
  className,
  disabled,
}: {
  onClick?: () => void
  children: React.ReactNode
  variant?: "default" | "danger" | "success" | "transparent"
  size?: "default" | "large"
  className?: string
  disabled?: boolean
}) {
  const bg = {
    default: "rgba(255,255,255,0.12)",
    danger: "rgba(239,68,68,0.85)",
    success: "rgba(34,197,94,0.85)",
    transparent: "transparent",
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-full flex items-center justify-center transition-all duration-200",
        "active:scale-95 disabled:opacity-50",
        size === "large" ? "w-16 h-16" : "w-12 h-12",
        className
      )}
      style={{
        background: bg[variant],
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      {children}
    </button>
  )
}

function CallTimer({ startTime }: { startTime: Date | null }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!startTime) return
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [startTime])

  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60

  return (
    <span className="text-white/70 text-sm font-medium tabular-nums">
      {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
    </span>
  )
}

export function VideoCall({
  open,
  onClose,
  callType,
  callerName,
  callerAvatar,
  isIncoming = false,
  incomingCallId,
  receiverId,
  onCallStarted,
  onCallEnded,
  isMinimized: externalMinimized,
  onMinimize,
  onRestore,
}: VideoCallProps) {
  const [callState, setCallState] = useState<CallState>(
    isIncoming ? "ringing" : "connecting"
  )
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(callType === "audio")
  const [isSpeakerOn, setIsSpeakerOn] = useState(true)
  const [callStartTime, setCallStartTime] = useState<Date | null>(null)
  const [showControls, setShowControls] = useState(true)
  const [callId, setCallId] = useState<string | null>(incomingCallId || null)
  const [internalMinimized, setInternalMinimized] = useState(false)

  const isMinimized =
    externalMinimized !== undefined ? externalMinimized : internalMinimized

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isEndingRef = useRef(false)
  const authTokenRef = useRef<string | null>(null)
  const remoteParticipantRef = useRef<unknown>(null)

  // ── RealtimeKit SDK ──
  const [meeting, initMeeting] = useRealtimeKitClient()
  const hasJoinedRoomRef = useRef(false)
  const meetingRef = useRef(meeting)
  const isInitializingRef = useRef(false)
  
  // Keep meetingRef in sync with meeting state
  useEffect(() => {
    meetingRef.current = meeting
  }, [meeting])

  // Initialize RTK client (prepare local media) but DON'T join room yet
  const initializeRTKClient = useCallback(
    async (authToken: string) => {
      // Guard against double-init (React strict mode or re-renders)
      if (isInitializingRef.current) {
        console.log("[RTK] Init already in progress, skipping")
        return meetingRef.current
      }
      if (meetingRef.current) {
        console.log("[RTK] Meeting already initialized, reusing")
        return meetingRef.current
      }
      isInitializingRef.current = true
      try {
        const m = await initMeeting({
          authToken,
          defaults: {
            audio: !isMuted,
            video: callType === "video" && !isVideoOff,
          },
        })
        if (!m) {
          console.error("Failed to init RTK meeting")
          isInitializingRef.current = false
          return null
        }
        console.log("[RTK] Client initialized (not joined yet)")
        // Store in ref immediately so joinRoom can access it
        meetingRef.current = m
        isInitializingRef.current = false
        return m
      } catch (err) {
        console.error("RTK init error:", err)
        isInitializingRef.current = false
        return null
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initMeeting, callType]
  )

  // Actually join the RTK room (call this only when ready to connect)
  const joinRoom = useCallback(async () => {
    const m = meetingRef.current
    if (!m || hasJoinedRoomRef.current) {
      console.log("[RTK] joinRoom skipped - meeting:", !!m, "hasJoined:", hasJoinedRoomRef.current)
      return
    }
    hasJoinedRoomRef.current = true
    try {
      console.log("[RTK] Joining room...")
      await m.joinRoom()
      console.log("[RTK] Room join called")
    } catch (err) {
      console.error("RTK joinRoom error:", err)
      hasJoinedRoomRef.current = false
    }
  }, [])

  // ── RTK event listeners ──
  useEffect(() => {
    if (!meeting) return

    const handleRoomJoined = () => {
      console.log("[RTK] Room joined")
      // Register local video element
      if (localVideoRef.current && callType === "video") {
        meeting.self.registerVideoElement(localVideoRef.current, true)
      }
    }

    const handleRoomLeft = () => {
      console.log("[RTK] Room left | callState:", callState)
      // Do NOT auto-end the call from roomLeft events.
      // roomLeft fires for many reasons: HMR, brief disconnects, leaveRoom() calls.
      // The participantLeft event + server polling are the reliable signals.
      // Only end if we explicitly triggered it (isEndingRef is true).
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleParticipantJoined = (participant: any) => {
      console.log("[RTK] Participant joined:", participant.name)
      remoteParticipantRef.current = participant
      // Connected — the other side has joined
      setCallState("connected")
      setCallStartTime(new Date())
      // Register remote video element
      if (remoteVideoRef.current && callType === "video") {
        participant.registerVideoElement(remoteVideoRef.current)
      }
    }

    const handleParticipantLeft = () => {
      console.log("[RTK] Participant left")
      remoteParticipantRef.current = null
      // Remote user left — end the call
      if (!isEndingRef.current) {
        isEndingRef.current = true
        if (callId) {
          endCallAction(callId).catch(console.error)
        }
        setCallState("ended")
      }
    }

    meeting.self.on("roomJoined", handleRoomJoined)
    meeting.self.on("roomLeft", handleRoomLeft)
    meeting.participants.joined.on("participantJoined", handleParticipantJoined)
    meeting.participants.joined.on("participantLeft", handleParticipantLeft)

    return () => {
      meeting.self.removeListener("roomJoined", handleRoomJoined)
      meeting.self.removeListener("roomLeft", handleRoomLeft)
      meeting.participants.joined.removeListener(
        "participantJoined",
        handleParticipantJoined
      )
      meeting.participants.joined.removeListener(
        "participantLeft",
        handleParticipantLeft
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting, callType, callId])

  // NOTE: We intentionally do NOT call leaveRoom() on unmount.
  // Fast Refresh / HMR triggers unmount/remount which would kill active RTK connections.
  // Room cleanup is handled explicitly by handleEndCall, handleDismiss, and participantLeft.

  // Re-register video elements when refs become available or minimized state changes
  useEffect(() => {
    if (!meeting || callType !== "video") return

    if (localVideoRef.current && meeting.self.roomJoined) {
      meeting.self.registerVideoElement(localVideoRef.current, true)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const remote = remoteParticipantRef.current as any
    if (remoteVideoRef.current && remote) {
      remote.registerVideoElement(remoteVideoRef.current)
    }
  }, [meeting, callType, isMinimized, callState])

  // ── Initiate outgoing call ──
  useEffect(() => {
    if (!open || isIncoming || callState !== "connecting" || callId) return
    let cancelled = false

    async function startCall() {
      if (!receiverId) {
        setCallState("ended")
        return
      }
      console.log("[Caller] Initiating call to:", receiverId)
      const result = await initiateCall(receiverId, callType)
      if (cancelled) return
      if (result.success && result.callId && result.authToken) {
        console.log("[Caller] Call created with ID:", result.callId)
        setCallId(result.callId)
        authTokenRef.current = result.authToken
        onCallStarted?.(result.callId)
        setCallState("ringing")
        // DON'T init RTK yet — wait for receiver to answer
        // We init + join ONLY when poll detects status="ongoing"
      } else {
        console.log("[Caller] Failed to initiate call:", result.error)
        setCallState("ended")
      }
    }

    startCall()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isIncoming, callState, receiverId, callType])

  // ── Poll outgoing call status (to detect answer/decline/miss) ──
  useEffect(() => {
    if (!open || isIncoming || !callId) return
    if (callState !== "ringing") return
    let cancelled = false
    let joined = false

    const pollInterval = setInterval(async () => {
      if (cancelled || joined) return
      const result = await getCallStatus(callId)
      if (cancelled || joined) return
      console.log("[Poll] Call", callId, "status:", result.status)
      if (result.success && result.status) {
        if (result.status === "ongoing") {
          joined = true
          clearInterval(pollInterval)
          console.log("[Caller] Receiver answered! Init + joining room...")
          // NOW init RTK and join — both in one go
          const token = authTokenRef.current
          if (token) {
            const m = await initializeRTKClient(token)
            if (m) {
              hasJoinedRoomRef.current = true
              console.log("[Caller] Joining room...")
              await m.joinRoom()
              console.log("[Caller] Joined room")
            }
          }
          // State will be set to "connected" when participantJoined fires
        } else if (["declined", "missed", "failed", "completed"].includes(result.status)) {
          clearInterval(pollInterval)
          setCallState("ended")
        }
      }
    }, 1000)

    return () => {
      cancelled = true
      clearInterval(pollInterval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isIncoming, callState, callId])

  // ── Poll active call to detect remote end (fallback for RTK events) ──
  useEffect(() => {
    if (!callId || callState !== "connected") return
    let cancelled = false

    const pollInterval = setInterval(async () => {
      if (cancelled) return
      const result = await getCallStatus(callId)
      if (cancelled) return
      if (
        result.success &&
        result.status &&
        ["completed", "missed", "declined", "failed"].includes(result.status)
      ) {
        if (!isEndingRef.current) {
          isEndingRef.current = true
          setCallState("ended")
          const m = meetingRef.current
          if (m) {
            try {
              await m.leaveRoom()
            } catch {}
          }
        }
      }
    }, 2000)

    return () => {
      cancelled = true
      clearInterval(pollInterval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, callState])

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setCallState(isIncoming ? "ringing" : "connecting")
      setIsMuted(false)
      setIsVideoOff(callType === "audio")
      setCallStartTime(null)
      setShowControls(true)
      isEndingRef.current = false
      hasJoinedRoomRef.current = false
      isInitializingRef.current = false
      authTokenRef.current = null
      remoteParticipantRef.current = null
      if (!isIncoming) setCallId(null)
      if (externalMinimized === undefined) {
        setInternalMinimized(false)
      }
    }
  }, [open, isIncoming, callType, externalMinimized])

  // Auto-hide controls in connected state
  useEffect(() => {
    if (callState === "connected" && showControls && !isMinimized) {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
      controlsTimeoutRef.current = setTimeout(
        () => setShowControls(false),
        5000
      )
    }
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
    }
  }, [showControls, callState, isMinimized])

  // Auto-close after ended state shows for 2s
  useEffect(() => {
    if (callState !== "ended") return
    const timer = setTimeout(() => {
      onCallEnded?.()
      onClose()
    }, 2000)
    return () => clearTimeout(timer)
  }, [callState, onCallEnded, onClose])

  // ── Answer incoming call ──
  const handleAnswer = async () => {
    if (!incomingCallId) return
    console.log("[Receiver] Answering call ID:", incomingCallId)
    setCallState("connecting")
    const result = await answerCall(incomingCallId)
    console.log("[Receiver] answerCall result:", result.success, result.error)
    if (result.success && result.authToken) {
      authTokenRef.current = result.authToken
      // Receiver: init RTK client AND join room immediately
      const m = await initializeRTKClient(result.authToken)
      if (m) {
        hasJoinedRoomRef.current = true
        console.log("[RTK] Receiver joining room...")
        await m.joinRoom()
        console.log("[RTK] Receiver joined room")
        // Notify parent AFTER successfully joining
        onCallStarted?.(incomingCallId)
      } else {
        console.error("[Receiver] Failed to init RTK client")
        setCallState("ended")
      }
    } else {
      console.error("[Receiver] Answer failed:", result.error)
      // Call was already expired/answered — dismiss immediately so poll finds the real call
      onCallEnded?.()
      onClose()
    }
  }

  const handleDecline = async () => {
    if (incomingCallId) {
      const { declineCall } = await import("@/lib/actions/calls")
      await declineCall(incomingCallId)
    }
    setCallState("ended")
  }

  const handleEndCall = async () => {
    if (isEndingRef.current) return
    isEndingRef.current = true
    try {
      if (callId) {
        await endCallAction(callId)
      }
      const m = meetingRef.current
      if (m) {
        try {
          await m.leaveRoom()
        } catch {}
      }
    } catch (e) {
      console.error("End call error:", e)
    }
    setCallState("ended")
  }

  const handleMinimize = () => {
    if (onMinimize) {
      onMinimize()
    } else {
      setInternalMinimized(true)
    }
  }

  const handleRestore = () => {
    if (onRestore) {
      onRestore()
    } else {
      setInternalMinimized(false)
    }
    setShowControls(true)
  }

  const handleDismiss = useCallback(async () => {
    // Clean up the call on the server if it wasn't properly ended
    if (callId && !isEndingRef.current) {
      isEndingRef.current = true
      try {
        await endCallAction(callId)
      } catch {}
    }
    const m = meetingRef.current
    if (m) {
      try {
        m.leaveRoom()
      } catch {}
    }
    onCallEnded?.()
    onClose()
  }, [callId, onCallEnded, onClose])

  // ── Toggle mute/video via RTK SDK ──
  const toggleMute = async () => {
    const next = !isMuted
    setIsMuted(next)
    const m = meetingRef.current
    if (m?.self) {
      try {
        if (next) {
          await m.self.disableAudio()
        } else {
          await m.self.enableAudio()
        }
      } catch (e) {
        console.error("Toggle mute error:", e)
      }
    }
  }

  const toggleVideo = async () => {
    const next = !isVideoOff
    setIsVideoOff(next)
    const m = meetingRef.current
    if (m?.self) {
      try {
        if (next) {
          await m.self.disableVideo()
        } else {
          await m.self.enableVideo()
        }
      } catch (e) {
        console.error("Toggle video error:", e)
      }
    }
  }

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)

  const shouldRender =
    externalMinimized !== undefined ? open || isMinimized : open
  if (!shouldRender) return null

  // ── Minimized floating pip ──
  if (isMinimized) {
    if (callState === "ended") {
      return (
        <div className="fixed bottom-24 right-4 z-[9999] animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border border-border/50 bg-background">
            <Avatar className="w-10 h-10">
              <AvatarImage src={callerAvatar} alt={callerName} />
              <AvatarFallback className="text-xs">
                {getInitials(callerName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                {callerName}
              </span>
              <span className="text-xs text-muted-foreground">Call ended</span>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div
        className="fixed bottom-24 right-4 z-[9999] cursor-pointer animate-in slide-in-from-bottom-4 fade-in duration-200"
        onClick={handleRestore}
      >
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border border-border/50 bg-background">
          <Avatar className="w-10 h-10">
            <AvatarImage src={callerAvatar} alt={callerName} />
            <AvatarFallback className="text-xs">
              {getInitials(callerName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">
              {callerName}
            </span>
            {callState === "connected" ? (
              <CallTimer startTime={callStartTime} />
            ) : (
              <span className="text-xs text-muted-foreground">
                {callState === "ringing"
                  ? isIncoming
                    ? "Incoming..."
                    : "Calling..."
                  : "Connecting..."}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 ml-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleMute()
              }}
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                isMuted
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              )}
            >
              <HugeiconsIcon
                icon={isMuted ? MicOff01Icon : Mic01Icon}
                size={14}
              />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleEndCall()
              }}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
            >
              <HugeiconsIcon icon={CallEnd01Icon} size={14} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Modal call UI ──
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={callState === "ended" ? handleDismiss : undefined}
      />

      <div
        className="relative w-full max-w-sm aspect-[3/4] rounded-3xl overflow-hidden shadow-2xl bg-black animate-in fade-in zoom-in-95 duration-200"
        onClick={() =>
          callState === "connected" && setShowControls(!showControls)
        }
      >
        {/* Background — local camera preview during ringing/connecting */}
        {callType === "video" &&
        !isVideoOff &&
        (callState === "ringing" || callState === "connecting") ? (
          <div className="absolute inset-0">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/40" />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Avatar className="w-28 h-28 mb-5">
                <AvatarImage src={callerAvatar} alt={callerName} />
                <AvatarFallback className="text-3xl bg-zinc-800 text-white">
                  {getInitials(callerName)}
                </AvatarFallback>
              </Avatar>
              <h3 className="text-white font-semibold text-xl">
                {callerName}
              </h3>
              <p className="text-white/50 text-sm mt-1">
                {callState === "ringing" &&
                  (isIncoming ? "Incoming call..." : "Calling...")}
                {callState === "connecting" && "Connecting..."}
              </p>
            </div>
          </div>
        ) : callState === "connected" && callType === "video" && !isVideoOff ? (
          <>
            {/* Remote video (full screen) */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-zinc-900 via-zinc-950 to-black">
            <Avatar className="w-28 h-28 mb-5">
              <AvatarImage src={callerAvatar} alt={callerName} />
              <AvatarFallback className="text-3xl bg-zinc-800 text-white">
                {getInitials(callerName)}
              </AvatarFallback>
            </Avatar>
            <h3 className="text-white font-semibold text-xl">{callerName}</h3>
            <p className="text-white/50 text-sm mt-1">
              {callState === "ringing" &&
                (isIncoming ? "Incoming call..." : "Calling...")}
              {callState === "connecting" && "Connecting..."}
              {callState === "connected" && (
                <CallTimer startTime={callStartTime} />
              )}
              {callState === "ended" && "Call ended"}
            </p>
          </div>
        )}

        {/* Local PIP (video calls when connected) */}
        {callState === "connected" && callType === "video" && !isVideoOff && (
          <div
            className="absolute top-4 right-4 w-24 aspect-[3/4] rounded-2xl overflow-hidden shadow-lg"
            style={{
              background: "rgba(0,0,0,0.3)",
              backdropFilter: "blur(4px)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Top bar — name + timer (video connected) + minimize */}
        {callState === "connected" && callType === "video" && (
          <div
            className={cn(
              "absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-4 pb-10 transition-all duration-300",
              showControls
                ? "opacity-100"
                : "opacity-0 pointer-events-none"
            )}
            style={{
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-white font-semibold text-lg">
                {callerName}
              </h3>
              <CallTimer startTime={callStartTime} />
            </div>
            <GlassButton onClick={handleMinimize}>
              <HugeiconsIcon
                icon={MinimizeScreenIcon}
                size={18}
                className="text-white"
              />
            </GlassButton>
          </div>
        )}

        {/* Incoming call — answer/decline */}
        {callState === "ringing" && isIncoming && (
          <div
            className="absolute bottom-0 left-0 right-0 pb-6 pt-8 px-6"
            style={{
              background:
                "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)",
            }}
          >
            <div className="flex items-center justify-center gap-20">
              <div className="flex flex-col items-center gap-2">
                <GlassButton
                  variant="danger"
                  size="large"
                  onClick={handleDecline}
                >
                  <HugeiconsIcon
                    icon={CallEnd01Icon}
                    size={28}
                    className="text-white"
                  />
                </GlassButton>
                <span className="text-white/60 text-xs">Decline</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <GlassButton
                  variant="success"
                  size="large"
                  onClick={handleAnswer}
                >
                  <HugeiconsIcon
                    icon={callType === "video" ? Video01Icon : Call02Icon}
                    size={28}
                    className="text-white"
                  />
                </GlassButton>
                <span className="text-white/60 text-xs">Answer</span>
              </div>
            </div>
          </div>
        )}

        {/* Controls — outgoing ringing or connected */}
        {(callState === "connected" ||
          (callState === "ringing" && !isIncoming) ||
          (callState === "connecting" && !isIncoming)) && (
          <div
            className={cn(
              "absolute bottom-0 left-0 right-0 pb-6 pt-6 px-6 transition-all duration-300",
              showControls || callState !== "connected"
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4 pointer-events-none"
            )}
            style={{
              background:
                "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-center gap-3">
              <GlassButton
                onClick={toggleMute}
                className={isMuted ? "!bg-white/90" : ""}
                size="default"
              >
                <HugeiconsIcon
                  icon={isMuted ? MicOff01Icon : Mic01Icon}
                  size={18}
                  className={isMuted ? "text-black" : "text-white"}
                />
              </GlassButton>

              {callType === "video" && (
                <GlassButton
                  onClick={toggleVideo}
                  className={isVideoOff ? "!bg-white/90" : ""}
                  size="default"
                >
                  <HugeiconsIcon
                    icon={isVideoOff ? VideoOffIcon : Video01Icon}
                    size={18}
                    className={isVideoOff ? "text-black" : "text-white"}
                  />
                </GlassButton>
              )}

              <GlassButton
                onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                className={!isSpeakerOn ? "!bg-white/90" : ""}
                size="default"
              >
                <HugeiconsIcon
                  icon={isSpeakerOn ? SpeakerIcon : Speaker01Icon}
                  size={18}
                  className={!isSpeakerOn ? "text-black" : "text-white"}
                />
              </GlassButton>

              {callState === "connected" && (
                <GlassButton
                  onClick={handleMinimize}
                  variant="transparent"
                  size="default"
                >
                  <HugeiconsIcon
                    icon={MinimizeScreenIcon}
                    size={16}
                    className="text-white/70"
                  />
                </GlassButton>
              )}

              <GlassButton
                variant="danger"
                size="large"
                onClick={handleEndCall}
              >
                <HugeiconsIcon
                  icon={CallEnd01Icon}
                  size={26}
                  className="text-white"
                />
              </GlassButton>
            </div>
          </div>
        )}

        {/* Ended state */}
        {callState === "ended" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-zinc-900 via-zinc-950 to-black">
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full flex items-center justify-center bg-red-500/20 mb-1">
                <HugeiconsIcon
                  icon={CallEnd01Icon}
                  size={28}
                  className="text-red-400"
                />
              </div>
              <p className="text-white/50 text-sm">Call ended</p>
              <button
                onClick={handleDismiss}
                className="mt-3 px-8 py-2.5 rounded-full text-sm font-medium bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
