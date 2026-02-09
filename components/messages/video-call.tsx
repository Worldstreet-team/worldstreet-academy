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
import { initiateCall, answerCall, endCall as endCallAction, getCallStatus } from "@/lib/actions/calls"

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
}

// Glassmorphic button — no borders, clean
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
  variant?: "default" | "danger" | "success"
  size?: "default" | "large"
  className?: string
  disabled?: boolean
}) {
  const bg = {
    default: "rgba(255,255,255,0.12)",
    danger: "rgba(239,68,68,0.85)",
    success: "rgba(34,197,94,0.85)",
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
}: VideoCallProps) {
  const [callState, setCallState] = useState<CallState>(isIncoming ? "ringing" : "connecting")
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(callType === "audio")
  const [isSpeakerOn, setIsSpeakerOn] = useState(true)
  const [isFrontCamera, setIsFrontCamera] = useState(true)
  const [callStartTime, setCallStartTime] = useState<Date | null>(null)
  const [showControls, setShowControls] = useState(true)
  const [callId, setCallId] = useState<string | null>(incomingCallId || null)
  const [isMinimized, setIsMinimized] = useState(false)
  const [isEnding, setIsEnding] = useState(false)

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const initializeMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: callType === "video" ? { facingMode: isFrontCamera ? "user" : "environment" } : false,
        audio: true,
      })
      localStreamRef.current = stream
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }
    } catch (error) {
      console.error("Failed to get media stream:", error)
    }
  }, [callType, isFrontCamera])

  const cleanupMedia = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop())
      localStreamRef.current = null
    }
  }, [])

  useEffect(() => {
    if (open && (callState === "connecting" || callState === "connected" || callState === "ringing")) {
      initializeMedia()
    }
    return () => {
      if (!open) cleanupMedia()
    }
  }, [open, callState, initializeMedia, cleanupMedia])

  // Initiate outgoing call
  useEffect(() => {
    if (!open || isIncoming || callState !== "connecting" || callId) return
    let cancelled = false

    async function startCall() {
      if (!receiverId) {
        setCallState("ended")
        return
      }
      const result = await initiateCall(receiverId, callType)
      if (cancelled) return
      if (result.success && result.callId) {
        setCallId(result.callId)
        onCallStarted?.(result.callId)
        setCallState("ringing")
      } else {
        setCallState("ended")
      }
    }

    startCall()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isIncoming, callState, receiverId, callType])

  // Poll for outgoing call status
  useEffect(() => {
    if (!open || isIncoming || callState !== "ringing" || !callId) return
    let cancelled = false

    const pollInterval = setInterval(async () => {
      if (cancelled) return
      const result = await getCallStatus(callId)
      if (cancelled) return
      if (result.success && result.status) {
        if (result.status === "ongoing") {
          setCallState("connected")
          setCallStartTime(new Date())
        } else if (["declined", "missed", "failed"].includes(result.status)) {
          setCallState("ended")
          cleanupMedia()
          onCallEnded?.()
          setTimeout(onClose, 1500)
        }
      }
    }, 2000)

    return () => {
      cancelled = true
      clearInterval(pollInterval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isIncoming, callState, callId])

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setCallState(isIncoming ? "ringing" : "connecting")
      setIsMuted(false)
      setIsVideoOff(callType === "audio")
      setCallStartTime(null)
      setShowControls(true)
      setIsMinimized(false)
      setIsEnding(false)
      if (!isIncoming) setCallId(null)
    }
  }, [open, isIncoming, callType])

  // Auto-hide controls in connected state
  useEffect(() => {
    if (callState === "connected" && showControls && !isMinimized) {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 5000)
    }
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
    }
  }, [showControls, callState, isMinimized])

  const handleAnswer = async () => {
    if (!incomingCallId) return
    setCallState("connecting")
    const result = await answerCall(incomingCallId)
    if (result.success) {
      setCallState("connected")
      setCallStartTime(new Date())
    } else {
      setCallState("ended")
    }
  }

  const handleDecline = async () => {
    if (incomingCallId) {
      const { declineCall } = await import("@/lib/actions/calls")
      await declineCall(incomingCallId)
    }
    setCallState("ended")
    cleanupMedia()
    onCallEnded?.()
    setTimeout(onClose, 500)
  }

  const handleEndCall = async () => {
    if (isEnding) return
    setIsEnding(true)
    try {
      if (callId) {
        await endCallAction(callId)
      }
    } catch (e) {
      console.error("End call error:", e)
    }
    setCallState("ended")
    cleanupMedia()
    onCallEnded?.()
    setTimeout(onClose, 500)
  }

  const handleMinimize = () => {
    setIsMinimized(true)
  }

  const handleRestore = () => {
    setIsMinimized(false)
    setShowControls(true)
  }

  const toggleMute = () => {
    const next = !isMuted
    setIsMuted(next)
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !next })
  }

  const toggleVideo = () => {
    const next = !isVideoOff
    setIsVideoOff(next)
    localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !next })
  }

  const switchCamera = async () => {
    setIsFrontCamera(!isFrontCamera)
    cleanupMedia()
    await initializeMedia()
  }

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)

  if (!open) return null

  // ── Minimized floating pip ──
  if (isMinimized) {
    return (
      <div
        className="fixed bottom-20 right-4 z-50 cursor-pointer animate-in slide-in-from-bottom-4 fade-in duration-200"
        onClick={handleRestore}
      >
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl"
          style={{
            background: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          <Avatar className="w-10 h-10">
            <AvatarImage src={callerAvatar} alt={callerName} />
            <AvatarFallback className="text-xs bg-zinc-700 text-white">
              {getInitials(callerName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-white text-sm font-medium">{callerName}</span>
            <CallTimer startTime={callStartTime} />
          </div>
          <div className="flex items-center gap-2 ml-2">
            <button
              onClick={(e) => { e.stopPropagation(); toggleMute() }}
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center",
                isMuted ? "bg-white/90" : "bg-white/15"
              )}
            >
              <HugeiconsIcon icon={isMuted ? MicOff01Icon : Mic01Icon} size={14} className={isMuted ? "text-black" : "text-white"} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleEndCall() }}
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: "rgba(239,68,68,0.9)" }}
            >
              <HugeiconsIcon icon={CallEnd01Icon} size={14} className="text-white" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Full-screen call UI ──
  return (
    <div className="fixed inset-0 z-50 bg-black">
      <div
        className="relative w-full h-full flex flex-col"
        onClick={() => callState === "connected" && setShowControls(!showControls)}
      >
        {/* Background */}
        {callState === "connected" && callType === "video" && !isVideoOff ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
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
              {callState === "ringing" && (isIncoming ? "Incoming call..." : "Ringing...")}
              {callState === "connecting" && "Connecting..."}
              {callState === "connected" && <CallTimer startTime={callStartTime} />}
              {callState === "ended" && "Call ended"}
            </p>
          </div>
        )}

        {/* Local PIP (video calls when connected) */}
        {callState === "connected" && callType === "video" && !isVideoOff && (
          <div
            className="absolute top-14 right-4 w-28 aspect-[3/4] rounded-2xl overflow-hidden"
            style={{ background: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <video
              ref={localVideoRef}
              autoPlay playsInline muted
              className="w-full h-full object-cover"
              style={{ transform: isFrontCamera ? "scaleX(-1)" : "none" }}
            />
          </div>
        )}

        {/* Top bar — name + timer (video connected) + minimize */}
        {callState === "connected" && callType === "video" && (
          <div
            className={cn(
              "absolute top-0 left-0 right-0 flex items-center justify-between px-5 pt-12 pb-16 transition-all duration-300",
              showControls ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-white font-semibold text-lg">{callerName}</h3>
              <CallTimer startTime={callStartTime} />
            </div>
            <GlassButton onClick={handleMinimize}>
              <HugeiconsIcon icon={MinimizeScreenIcon} size={18} className="text-white" />
            </GlassButton>
          </div>
        )}

        {/* Incoming call — answer/decline */}
        {callState === "ringing" && isIncoming && (
          <div
            className="absolute bottom-0 left-0 right-0 pb-14 pt-8 px-6"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)" }}
          >
            <div className="flex items-center justify-center gap-20">
              <div className="flex flex-col items-center gap-2">
                <GlassButton variant="danger" size="large" onClick={handleDecline}>
                  <HugeiconsIcon icon={CallEnd01Icon} size={28} className="text-white" />
                </GlassButton>
                <span className="text-white/60 text-xs">Decline</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <GlassButton variant="success" size="large" onClick={handleAnswer}>
                  <HugeiconsIcon icon={callType === "video" ? Video01Icon : Call02Icon} size={28} className="text-white" />
                </GlassButton>
                <span className="text-white/60 text-xs">Answer</span>
              </div>
            </div>
          </div>
        )}

        {/* Controls — outgoing ringing or connected */}
        {(callState === "connected" || (callState === "ringing" && !isIncoming) || (callState === "connecting" && !isIncoming)) && (
          <div
            className={cn(
              "absolute bottom-0 left-0 right-0 pb-12 pt-8 px-6 transition-all duration-300",
              showControls || callState !== "connected" ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
            )}
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-center gap-4">
              <GlassButton onClick={toggleMute} className={isMuted ? "!bg-white/90" : ""}>
                <HugeiconsIcon icon={isMuted ? MicOff01Icon : Mic01Icon} size={20} className={isMuted ? "text-black" : "text-white"} />
              </GlassButton>

              {callType === "video" && (
                <GlassButton onClick={toggleVideo} className={isVideoOff ? "!bg-white/90" : ""}>
                  <HugeiconsIcon icon={isVideoOff ? VideoOffIcon : Video01Icon} size={20} className={isVideoOff ? "text-black" : "text-white"} />
                </GlassButton>
              )}

              {callType === "video" && (
                <GlassButton onClick={switchCamera}>
                  <HugeiconsIcon icon={FlipHorizontalIcon} size={20} className="text-white" />
                </GlassButton>
              )}

              <GlassButton onClick={() => setIsSpeakerOn(!isSpeakerOn)} className={!isSpeakerOn ? "!bg-white/90" : ""}>
                <HugeiconsIcon icon={isSpeakerOn ? SpeakerIcon : Speaker01Icon} size={20} className={!isSpeakerOn ? "text-black" : "text-white"} />
              </GlassButton>

              {callState === "connected" && (
                <GlassButton onClick={handleMinimize}>
                  <HugeiconsIcon icon={MinimizeScreenIcon} size={20} className="text-white" />
                </GlassButton>
              )}

              <GlassButton variant="danger" size="large" onClick={handleEndCall}>
                <HugeiconsIcon icon={CallEnd01Icon} size={24} className="text-white" />
              </GlassButton>
            </div>
          </div>
        )}

        {/* Ended state */}
        {callState === "ended" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full flex items-center justify-center bg-red-500/20">
                <HugeiconsIcon icon={CallEnd01Icon} size={28} className="text-red-400" />
              </div>
              <p className="text-white/50 text-sm">Call ended</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
