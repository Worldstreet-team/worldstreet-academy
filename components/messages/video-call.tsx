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
  MoreHorizontalIcon,
  FlipHorizontalIcon,
  MaximizeScreenIcon,
  MinimizeScreenIcon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

type CallType = "video" | "audio"
type CallState = "ringing" | "connecting" | "connected" | "ended"

type VideoCallProps = {
  open: boolean
  onClose: () => void
  callType: CallType
  callerName: string
  callerAvatar?: string
  isIncoming?: boolean
  onAnswer?: () => void
  onDecline?: () => void
}

// Glassmorphic button component
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
  const baseStyles = {
    default: {
      background: "rgba(255, 255, 255, 0.12)",
      hoverBg: "rgba(255, 255, 255, 0.2)",
    },
    danger: {
      background: "rgba(239, 68, 68, 0.8)",
      hoverBg: "rgba(239, 68, 68, 0.9)",
    },
    success: {
      background: "rgba(34, 197, 94, 0.8)",
      hoverBg: "rgba(34, 197, 94, 0.9)",
    },
  }

  const sizeClasses = {
    default: "w-12 h-12",
    large: "w-16 h-16",
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-full flex items-center justify-center transition-all duration-200",
        "hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100",
        sizeClasses[size],
        className
      )}
      style={{
        background: baseStyles[variant].background,
        backdropFilter: "blur(12px)",
        boxShadow: "0 4px 30px rgba(0, 0, 0, 0.1)",
      }}
    >
      {children}
    </button>
  )
}

// Call timer display
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
    <span className="text-white/80 text-sm font-medium tabular-nums">
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
  onAnswer,
  onDecline,
}: VideoCallProps) {
  const [callState, setCallState] = useState<CallState>(isIncoming ? "ringing" : "connecting")
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(callType === "audio")
  const [isSpeakerOn, setIsSpeakerOn] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isFrontCamera, setIsFrontCamera] = useState(true)
  const [callStartTime, setCallStartTime] = useState<Date | null>(null)
  const [showControls, setShowControls] = useState(true)
  
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize local media stream
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

  // Cleanup media stream
  const cleanupMedia = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop())
      localStreamRef.current = null
    }
  }, [])

  useEffect(() => {
    if (open && (callState === "connecting" || callState === "connected")) {
      initializeMedia()
    }
    return () => cleanupMedia()
  }, [open, callState, initializeMedia, cleanupMedia])

  // Simulate connection (replace with actual WebRTC/Cloudflare logic)
  useEffect(() => {
    if (callState === "connecting") {
      const timeout = setTimeout(() => {
        setCallState("connected")
        setCallStartTime(new Date())
      }, 2000)
      return () => clearTimeout(timeout)
    }
  }, [callState])

  // Auto-hide controls
  useEffect(() => {
    if (callState === "connected" && showControls) {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 4000)
    }
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
    }
  }, [showControls, callState])

  const handleAnswer = () => {
    setCallState("connecting")
    onAnswer?.()
  }

  const handleDecline = () => {
    setCallState("ended")
    cleanupMedia()
    onDecline?.()
    setTimeout(onClose, 500)
  }

  const handleEndCall = () => {
    setCallState("ended")
    cleanupMedia()
    setTimeout(onClose, 500)
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = isMuted
      })
    }
  }

  const toggleVideo = () => {
    setIsVideoOff(!isVideoOff)
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = isVideoOff
      })
    }
  }

  const switchCamera = async () => {
    setIsFrontCamera(!isFrontCamera)
    cleanupMedia()
    await initializeMedia()
  }

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleEndCall()}>
      <DialogContent
        className={cn(
          "p-0 gap-0 overflow-hidden border-0 transition-all duration-300",
          isFullscreen ? "max-w-full w-screen h-screen" : "max-w-md aspect-9/16"
        )}
        style={{ background: "#0a0a0a" }}
      >
        <div
          className="relative w-full h-full flex flex-col"
          onClick={() => callState === "connected" && setShowControls(!showControls)}
        >
          {/* Background - Remote Video or Avatar */}
          {callState === "connected" && callType === "video" && !isVideoOff ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
              style={{ background: "#1a1a1a" }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-linear-to-b from-zinc-900 to-black">
              {/* Animated rings for ringing state */}
              {callState === "ringing" && (
                <>
                  <div className="absolute w-40 h-40 rounded-full border border-white/10 animate-ping" style={{ animationDuration: "2s" }} />
                  <div className="absolute w-52 h-52 rounded-full border border-white/5 animate-ping" style={{ animationDuration: "2s", animationDelay: "0.5s" }} />
                </>
              )}
              <Avatar className="w-28 h-28 border-2 border-white/20">
                <AvatarImage src={callerAvatar} alt={callerName} />
                <AvatarFallback className="text-3xl bg-zinc-800 text-white">
                  {getInitials(callerName)}
                </AvatarFallback>
              </Avatar>
            </div>
          )}

          {/* Local Video PIP */}
          {callState === "connected" && callType === "video" && !isVideoOff && (
            <div
              className={cn(
                "absolute top-20 right-4 w-28 aspect-3/4 rounded-2xl overflow-hidden transition-all duration-300",
                showControls ? "opacity-100" : "opacity-70"
              )}
              style={{
                background: "rgba(0, 0, 0, 0.3)",
                backdropFilter: "blur(4px)",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: isFrontCamera ? "scaleX(-1)" : "none" }}
              />
            </div>
          )}

          {/* Top Info Bar */}
          <div
            className={cn(
              "absolute top-0 left-0 right-0 flex items-center justify-between px-5 py-6 transition-all duration-300",
              showControls || callState !== "connected" ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
            style={{
              background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col">
              <h3 className="text-white font-semibold text-lg">{callerName}</h3>
              <p className="text-white/60 text-sm">
                {callState === "ringing" && (isIncoming ? "Incoming call..." : "Calling...")}
                {callState === "connecting" && "Connecting..."}
                {callState === "connected" && <CallTimer startTime={callStartTime} />}
                {callState === "ended" && "Call ended"}
              </p>
            </div>

            {callState === "connected" && (
              <div className="flex items-center gap-2">
                <GlassButton onClick={() => setIsFullscreen(!isFullscreen)}>
                  <HugeiconsIcon
                    icon={isFullscreen ? MinimizeScreenIcon : MaximizeScreenIcon}
                    size={20}
                    className="text-white"
                  />
                </GlassButton>
              </div>
            )}
          </div>

          {/* Ringing / Incoming Call UI */}
          {callState === "ringing" && isIncoming && (
            <div
              className="absolute bottom-0 left-0 right-0 pb-12 pt-8 px-6"
              style={{
                background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)",
              }}
            >
              <div className="flex items-center justify-center gap-16">
                <div className="flex flex-col items-center gap-2">
                  <GlassButton variant="danger" size="large" onClick={handleDecline}>
                    <HugeiconsIcon icon={CallEnd01Icon} size={28} className="text-white" />
                  </GlassButton>
                  <span className="text-white/70 text-xs">Decline</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <GlassButton variant="success" size="large" onClick={handleAnswer}>
                    <HugeiconsIcon icon={callType === "video" ? Video01Icon : Call02Icon} size={28} className="text-white" />
                  </GlassButton>
                  <span className="text-white/70 text-xs">Answer</span>
                </div>
              </div>
            </div>
          )}

          {/* Connecting State */}
          {callState === "connecting" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full bg-white animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
                <p className="text-white/60 text-sm">Connecting...</p>
              </div>
            </div>
          )}

          {/* Connected Call Controls */}
          {(callState === "connected" || (callState === "ringing" && !isIncoming)) && (
            <div
              className={cn(
                "absolute bottom-0 left-0 right-0 pb-10 pt-6 px-6 transition-all duration-300",
                showControls || callState === "ringing" ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
              )}
              style={{
                background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Secondary Controls */}
              <div className="flex items-center justify-center gap-4 mb-6">
                {callType === "video" && (
                  <GlassButton onClick={switchCamera}>
                    <HugeiconsIcon icon={FlipHorizontalIcon} size={20} className="text-white" />
                  </GlassButton>
                )}
                <GlassButton onClick={() => setIsSpeakerOn(!isSpeakerOn)}>
                  <HugeiconsIcon
                    icon={isSpeakerOn ? SpeakerIcon : Speaker01Icon}
                    size={20}
                    className="text-white"
                  />
                </GlassButton>
                <GlassButton>
                  <HugeiconsIcon icon={MoreHorizontalIcon} size={20} className="text-white" />
                </GlassButton>
              </div>

              {/* Primary Controls */}
              <div className="flex items-center justify-center gap-5">
                <GlassButton
                  onClick={toggleMute}
                  className={isMuted ? "bg-white/90!" : ""}
                >
                  <HugeiconsIcon
                    icon={isMuted ? MicOff01Icon : Mic01Icon}
                    size={22}
                    className={isMuted ? "text-black" : "text-white"}
                  />
                </GlassButton>

                {callType === "video" && (
                  <GlassButton
                    onClick={toggleVideo}
                    className={isVideoOff ? "bg-white/90!" : ""}
                  >
                    <HugeiconsIcon
                      icon={isVideoOff ? VideoOffIcon : Video01Icon}
                      size={22}
                      className={isVideoOff ? "text-black" : "text-white"}
                    />
                  </GlassButton>
                )}

                <GlassButton variant="danger" size="large" onClick={handleEndCall}>
                  <HugeiconsIcon icon={CallEnd01Icon} size={26} className="text-white" />
                </GlassButton>
              </div>
            </div>
          )}

          {/* Ended State */}
          {callState === "ended" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{
                    background: "rgba(239, 68, 68, 0.2)",
                    backdropFilter: "blur(12px)",
                  }}
                >
                  <HugeiconsIcon icon={CallEnd01Icon} size={28} className="text-red-400" />
                </div>
                <p className="text-white/60 text-sm">Call ended</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
