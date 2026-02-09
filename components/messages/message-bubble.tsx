"use client"

import Image from "next/image"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  FileIcon,
  PlayIcon,
  PauseIcon,
  Tick02Icon,
  TickDouble02Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { useState, useRef, useEffect, useCallback } from "react"
import { motion } from "motion/react"

export type MessageType = {
  id: string
  senderId: string
  senderName?: string
  senderAvatar?: string
  content: string
  timestamp: Date
  isOwn: boolean
  type?: "text" | "image" | "file" | "voice" | "video" | "audio"
  fileUrl?: string
  fileName?: string
  fileSize?: string
  duration?: string
  waveform?: number[]
  isRead?: boolean
  isDelivered?: boolean
  status?: "pending" | "sent" | "error"
  uploadProgress?: number
}

type MessageBubbleProps = {
  message: MessageType
  showAvatar?: boolean
}

export function MessageBubble({ message, showAvatar = true }: MessageBubbleProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasPlayed, setHasPlayed] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(0)
  const [fullscreenMedia, setFullscreenMedia] = useState<"image" | "video" | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  // rAF-based audio progress tracking for smooth updates
  const updateAudioProgress = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      const audio = audioRef.current
      if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
        setProgress((audio.currentTime / audio.duration) * 100)
        setCurrentTime(audio.currentTime)
      }
      animationFrameRef.current = requestAnimationFrame(updateAudioProgress)
    }
  }, [])

  // Clean up rAF on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const toggleAudio = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
          animationFrameRef.current = null
        }
        setIsPlaying(false)
      } else {
        audioRef.current.play().then(() => {
          setIsPlaying(true)
          animationFrameRef.current = requestAnimationFrame(updateAudioProgress)
        }).catch((err) => {
          console.error("Audio play failed:", err)
          setIsPlaying(false)
        })
      }
    }
  }

  // Seek by clicking on audio progress bar
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !audioRef.current.duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percentage = clickX / rect.width
    audioRef.current.currentTime = percentage * audioRef.current.duration
    setProgress(percentage * 100)
    setCurrentTime(audioRef.current.currentTime)
  }

  const renderContent = () => {
    switch (message.type) {
      case "image":
        return (
          <div className="space-y-1">
            <button
              onClick={() => setFullscreenMedia("image")}
              className="block overflow-hidden w-full min-w-56 relative aspect-4/3 bg-muted cursor-pointer active:scale-[0.98] transition-transform"
            >
              {message.fileUrl ? (
                <Image
                  src={message.fileUrl}
                  alt=""
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="animate-pulse text-muted-foreground text-xs">Loading image...</div>
                </div>
              )}
            </button>
            {message.content && (
              <p className="text-sm px-3 py-1.5">{message.content}</p>
            )}
          </div>
        )

      case "video":
        return (
          <div className="space-y-1">
            <button
              onClick={() => message.fileUrl && !message.uploadProgress ? setFullscreenMedia("video") : undefined}
              className={cn(
                "block overflow-hidden w-full min-w-56 relative aspect-video bg-black",
                message.fileUrl && !message.uploadProgress && "cursor-pointer active:scale-[0.98] transition-transform"
              )}
            >
              {message.fileUrl ? (
                <>
                  <video
                    src={message.fileUrl}
                    className="w-full h-full object-cover pointer-events-none"
                    preload="metadata"
                    playsInline
                    muted
                  />
                  {/* Upload progress overlay */}
                  {message.uploadProgress != null && message.uploadProgress < 100 ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                      <div className="relative h-14 w-14">
                        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 56 56">
                          <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
                          <circle
                            cx="28" cy="28" r="24" fill="none" stroke="white" strokeWidth="3"
                            strokeDasharray={2 * Math.PI * 24}
                            strokeDashoffset={2 * Math.PI * 24 * (1 - (message.uploadProgress || 0) / 100)}
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white tabular-nums">
                          {message.uploadProgress}%
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-11 w-11 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center border border-white/10">
                        <HugeiconsIcon icon={PlayIcon} size={20} className="text-white ml-0.5" />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="animate-pulse text-white/50 text-xs">Loading video...</div>
                </div>
              )}
            </button>
            {message.content && (
              <p className="text-sm px-3 py-1.5">{message.content}</p>
            )}
          </div>
        )

      case "file":
        return (
          <div className="flex items-center gap-3 min-w-48">
            <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
              <HugeiconsIcon icon={FileIcon} size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{message.fileName || "File"}</p>
              <p className="text-xs opacity-60">{message.fileSize || "—"}</p>
            </div>
          </div>
        )

      case "voice":
      case "audio":
        return (
          <div className={cn(
            "flex items-center gap-2.5 min-w-52 transition-opacity duration-300",
            hasPlayed && !isPlaying && "opacity-60"
          )}>
            {message.fileUrl && (
              <audio
                ref={audioRef}
                src={message.fileUrl}
                preload="metadata"
                onEnded={() => {
                  setIsPlaying(false)
                  setHasPlayed(true)
                  setProgress(100)
                }}
                onTimeUpdate={(e) => {
                  const audio = e.currentTarget
                  if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
                    // Only update from timeUpdate as fallback when rAF isn't running
                    if (!isPlaying) {
                      setProgress((audio.currentTime / audio.duration) * 100)
                      setCurrentTime(audio.currentTime)
                    }
                  }
                }}
                onLoadedMetadata={(e) => {
                  const duration = e.currentTarget.duration
                  if (duration && !isNaN(duration)) {
                    setAudioDuration(duration)
                  }
                }}
                onCanPlay={() => {
                  if (audioRef.current && audioRef.current.duration && !isNaN(audioRef.current.duration)) {
                    setAudioDuration(audioRef.current.duration)
                  }
                }}
              />
            )}
            <button
              className={cn(
                "h-8 w-8 shrink-0 rounded-full flex items-center justify-center transition-colors",
                message.isOwn 
                  ? "hover:bg-primary-foreground/20" 
                  : "hover:bg-muted-foreground/20",
                !message.fileUrl && "opacity-50 cursor-not-allowed"
              )}
              onClick={message.fileUrl ? toggleAudio : undefined}
              disabled={!message.fileUrl}
            >
              <HugeiconsIcon 
                icon={isPlaying ? PauseIcon : PlayIcon} 
                size={16} 
                className={message.isOwn ? "text-primary-foreground" : ""}
              />
            </button>
            {/* Progress bar with thumb */}
            <div 
              className={cn(
                "flex-1 h-6 flex items-center relative",
                message.fileUrl ? "cursor-pointer" : "cursor-default"
              )}
              onClick={message.fileUrl ? handleProgressClick : undefined}
            >
              {/* Track */}
              <div className={cn(
                "w-full h-0.75 rounded-full relative",
                message.isOwn ? "bg-primary-foreground/20" : "bg-muted-foreground/15"
              )}>
                {/* Fill */}
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full",
                    message.isOwn ? "bg-primary-foreground/80" : "bg-foreground/50"
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
              {/* Thumb */}
              <div
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full shadow-sm",
                  message.isOwn ? "bg-primary-foreground" : "bg-foreground/70"
                )}
                style={{ left: `calc(${progress}% - 6px)` }}
              />
            </div>
            <span className={cn(
              "text-[10px] shrink-0 tabular-nums min-w-8 text-right",
              message.isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
            )}>
              {isPlaying || currentTime > 0
                ? formatDuration(currentTime)
                : message.duration || (audioDuration > 0 ? formatDuration(audioDuration) : "0:00")
              }
            </span>
          </div>
        )

      default:
        // For text messages or fallback
        if (message.content) {
          return <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        }
        // Empty message placeholder
        return <p className="text-sm text-muted-foreground/50 italic">Message</p>
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: message.status === "pending" ? 0.5 : 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        "flex gap-2",
        message.isOwn ? "justify-end" : "justify-start",
      )}
    >
      {!message.isOwn && showAvatar && (
        <Avatar className="h-6 w-6 mt-1 shrink-0">
          <AvatarImage src={message.senderAvatar} />
          <AvatarFallback className="text-[10px]">
            {message.senderName?.[0]?.toUpperCase() || "U"}
          </AvatarFallback>
        </Avatar>
      )}
      {!message.isOwn && !showAvatar && <div className="w-6 shrink-0" />}

      <div className={cn("flex flex-col max-w-[75%]", message.isOwn ? "items-end" : "items-start")}>
        {/* Determine if this is a media message for edge-to-edge rendering */}
        {(() => {
          const isMedia = message.type === "image" || message.type === "video"
          return (
            <div
              className={cn(
                "rounded-2xl shadow-sm",
                isMedia ? "p-0 overflow-hidden" : "px-3 py-2",
                message.isOwn
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-muted/80 rounded-bl-md",
                message.status === "error" && "bg-destructive/90 text-destructive-foreground"
              )}
            >
              {/* Text below media needs its own padding */}
              {isMedia ? (
                <div>
                  {renderContent()}
                </div>
              ) : (
                renderContent()
              )}
            </div>
          )
        })()}
        
        <div className="flex items-center gap-1 mt-0.5 px-0.5">
          <span className="text-[10px] text-muted-foreground/70">
            {message.status === "pending" 
              ? "Sending..." 
              : message.status === "error"
                ? "Failed"
                : formatTime(message.timestamp)}
          </span>
          {message.isOwn && message.status !== "pending" && message.status !== "error" && (
            <HugeiconsIcon
              icon={message.isRead ? TickDouble02Icon : Tick02Icon}
              size={11}
              className={cn(
                message.isRead ? "text-primary" : "text-muted-foreground/60"
              )}
            />
          )}
        </div>
      </div>

      {/* Fullscreen media viewer */}
      {fullscreenMedia && message.fileUrl && (
        <FullscreenMediaViewer
          type={fullscreenMedia}
          url={message.fileUrl}
          onClose={() => setFullscreenMedia(null)}
        />
      )}
    </motion.div>
  )
}

// Fullscreen glassmorphic media viewer with custom controls
function FullscreenMediaViewer({
  type,
  url,
  onClose,
}: {
  type: "image" | "video"
  url: string
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const progressBarRef = useRef<HTMLDivElement | null>(null)

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === " " && type === "video") {
        e.preventDefault()
        togglePlay()
      }
    }
    document.addEventListener("keydown", handleKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", handleKey)
      document.body.style.overflow = ""
    }
  }, [onClose, type])

  const togglePlay = () => {
    if (!videoRef.current) return
    if (videoRef.current.paused) {
      videoRef.current.play()
      setIsPlaying(true)
    } else {
      videoRef.current.pause()
      setIsPlaying(false)
    }
  }

  const handleTimeUpdate = () => {
    if (!videoRef.current) return
    const video = videoRef.current
    if (video.duration && !isNaN(video.duration)) {
      setProgress((video.currentTime / video.duration) * 100)
      setCurrentTime(video.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (videoRef.current && videoRef.current.duration && !isNaN(videoRef.current.duration)) {
      setDuration(videoRef.current.duration)
    }
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !progressBarRef.current) return
    const rect = progressBarRef.current.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percentage = Math.max(0, Math.min(1, clickX / rect.width))
    videoRef.current.currentTime = percentage * videoRef.current.duration
    setProgress(percentage * 100)
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Glassmorphic backdrop */}
      <div className="absolute inset-0 bg-black/85 backdrop-blur-xl" />

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 h-10 w-10 rounded-full bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center hover:bg-white/20 transition-colors"
      >
        <HugeiconsIcon icon={Cancel01Icon} size={18} className="text-white" />
      </button>

      {/* Media content */}
      <div
        className="relative w-full h-full flex items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {type === "image" ? (
          <Image
            src={url}
            alt=""
            fill
            className="object-contain p-8"
            sizes="100vw"
            priority
          />
        ) : (
          <div className="relative max-w-full max-h-full w-full h-full flex flex-col items-center justify-center">
            {/* Video element */}
            <video
              ref={videoRef}
              src={url}
              className="max-w-full max-h-[calc(100%-80px)] rounded-lg bg-black"
              playsInline
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setIsPlaying(false)}
              onClick={togglePlay}
            />

            {/* Center play/pause button overlay (tap to toggle) */}
            {!isPlaying && (
              <button
                onClick={togglePlay}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-16 w-16 rounded-full bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-white/25 transition-colors"
              >
                <HugeiconsIcon icon={PlayIcon} size={28} className="text-white ml-1" />
              </button>
            )}

            {/* Bottom control bar */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15">
              {/* Play/Pause button */}
              <button
                onClick={togglePlay}
                className="h-10 w-10 shrink-0 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors"
              >
                <HugeiconsIcon icon={isPlaying ? PauseIcon : PlayIcon} size={20} className="text-white" />
              </button>

              {/* Current time */}
              <span className="text-xs text-white/80 tabular-nums min-w-10">
                {formatDuration(currentTime)}
              </span>

              {/* Progress bar */}
              <div
                ref={progressBarRef}
                className="flex-1 h-8 flex items-center cursor-pointer"
                onClick={handleSeek}
              >
                <div className="w-full h-1 bg-white/20 rounded-full relative">
                  <div
                    className="absolute inset-y-0 left-0 bg-white rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                  {/* Thumb */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 h-3 w-3 bg-white rounded-full shadow-md"
                    style={{ left: `calc(${progress}% - 6px)` }}
                  />
                </div>
              </div>

              {/* Duration */}
              <span className="text-xs text-white/80 tabular-nums min-w-10 text-right">
                {formatDuration(duration)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
