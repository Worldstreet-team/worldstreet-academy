"use client"

import Image from "next/image"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  FileIcon,
  PlayIcon,
  PauseIcon,
  Tick02Icon,
  TickDouble02Icon,
} from "@hugeicons/core-free-icons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useState, useRef } from "react"

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
}

type MessageBubbleProps = {
  message: MessageType
  showAvatar?: boolean
}

// Number of bars to display in waveform
const WAVEFORM_DISPLAY_BARS = 28

export function MessageBubble({ message, showAvatar = true }: MessageBubbleProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

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
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  // Seek within waveform on click
  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percentage = clickX / rect.width
    audioRef.current.currentTime = percentage * audioRef.current.duration
  }

  // Normalize waveform data to display bars
  const normalizeWaveform = (waveform: number[] | undefined): number[] => {
    if (!waveform || waveform.length === 0) {
      // Generate placeholder waveform
      return Array(WAVEFORM_DISPLAY_BARS).fill(0).map(() => 0.2 + Math.random() * 0.3)
    }

    // Resample to WAVEFORM_DISPLAY_BARS
    const result: number[] = []
    const step = waveform.length / WAVEFORM_DISPLAY_BARS

    for (let i = 0; i < WAVEFORM_DISPLAY_BARS; i++) {
      const start = Math.floor(i * step)
      const end = Math.floor((i + 1) * step)
      let sum = 0
      for (let j = start; j < end && j < waveform.length; j++) {
        sum += waveform[j]
      }
      result.push(sum / (end - start))
    }

    return result
  }

  const renderContent = () => {
    switch (message.type) {
      case "image":
        return (
          <div className="space-y-1">
            <div className="rounded-xl overflow-hidden max-w-64 relative aspect-square">
              <Image
                src={message.fileUrl || "/placeholder.png"}
                alt=""
                fill
                className="object-cover"
              />
            </div>
            {message.content && (
              <p className="text-sm">{message.content}</p>
            )}
          </div>
        )

      case "video":
        return (
          <div className="space-y-1">
            <div className="rounded-xl overflow-hidden max-w-64 relative aspect-video bg-black">
              <video
                src={message.fileUrl}
                className="w-full h-full object-cover"
                controls
              />
            </div>
            {message.content && (
              <p className="text-sm">{message.content}</p>
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
        const waveformBars = normalizeWaveform(message.waveform)
        return (
          <div className="flex items-center gap-2 min-w-48">
            <audio
              ref={audioRef}
              src={message.fileUrl}
              onEnded={() => {
                setIsPlaying(false)
                setProgress(0)
                setCurrentTime(0)
              }}
              onTimeUpdate={(e) => {
                const audio = e.currentTarget
                setProgress((audio.currentTime / audio.duration) * 100)
                setCurrentTime(audio.currentTime)
              }}
              onLoadedMetadata={(e) => {
                setAudioDuration(e.currentTarget.duration)
              }}
            />
            <Button
              size="icon"
              variant="ghost"
              className={cn(
                "h-8 w-8 shrink-0 rounded-full",
                message.isOwn 
                  ? "hover:bg-primary-foreground/20" 
                  : "hover:bg-muted-foreground/20"
              )}
              onClick={toggleAudio}
            >
              <HugeiconsIcon 
                icon={isPlaying ? PauseIcon : PlayIcon} 
                size={16} 
                className={message.isOwn ? "text-primary-foreground" : ""}
              />
            </Button>
            <div 
              className="flex-1 flex items-center gap-[2px] h-5 cursor-pointer"
              onClick={handleWaveformClick}
            >
              {waveformBars.map((level, i) => {
                const isPast = (i / waveformBars.length) * 100 <= progress
                const height = Math.max(3, level * 16)
                return (
                  <div
                    key={i}
                    className={cn(
                      "w-[2px] rounded-full transition-colors duration-100",
                      message.isOwn
                        ? isPast 
                          ? "bg-primary-foreground" 
                          : "bg-primary-foreground/40"
                        : isPast 
                          ? "bg-muted-foreground" 
                          : "bg-muted-foreground/30"
                    )}
                    style={{ height: `${height}px` }}
                  />
                )
              })}
            </div>
            <span className={cn(
              "text-[10px] shrink-0 tabular-nums",
              message.isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
            )}>
              {isPlaying || currentTime > 0
                ? formatDuration(currentTime)
                : message.duration || formatDuration(audioDuration) || "0:00"
              }
            </span>
          </div>
        )

      default:
        return <p className="text-sm whitespace-pre-wrap">{message.content}</p>
    }
  }

  return (
    <div className={cn(
      "flex gap-2 transition-opacity duration-200",
      message.isOwn ? "justify-end" : "justify-start",
      message.status === "pending" && "opacity-50"
    )}>
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
        <div
          className={cn(
            "rounded-2xl px-3 py-2 shadow-sm",
            message.isOwn
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-muted/80 rounded-bl-md",
            message.status === "error" && "bg-destructive/90 text-destructive-foreground"
          )}
        >
          {renderContent()}
        </div>
        
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
    </div>
  )
}
