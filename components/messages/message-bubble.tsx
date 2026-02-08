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
  type?: "text" | "image" | "file" | "voice" | "video"
  fileUrl?: string
  fileName?: string
  fileSize?: string
  duration?: string
  isRead?: boolean
  isDelivered?: boolean
}

type MessageBubbleProps = {
  message: MessageType
  showAvatar?: boolean
}

export function MessageBubble({ message, showAvatar = true }: MessageBubbleProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
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
        return (
          <div className="flex items-center gap-2 min-w-48">
            <audio
              ref={audioRef}
              src={message.fileUrl}
              onEnded={() => setIsPlaying(false)}
              onTimeUpdate={(e) => {
                const audio = e.currentTarget
                setProgress((audio.currentTime / audio.duration) * 100)
              }}
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0"
              onClick={toggleAudio}
            >
              <HugeiconsIcon icon={isPlaying ? PauseIcon : PlayIcon} size={16} />
            </Button>
            <div className="flex-1 h-1 bg-current/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-current rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs opacity-60 shrink-0">{message.duration || "0:00"}</span>
          </div>
        )

      default:
        return <p className="text-sm whitespace-pre-wrap">{message.content}</p>
    }
  }

  return (
    <div className={cn("flex gap-2", message.isOwn ? "justify-end" : "justify-start")}>
      {!message.isOwn && showAvatar && (
        <Avatar className="h-7 w-7 mt-1 shrink-0">
          <AvatarImage src={message.senderAvatar} />
          <AvatarFallback className="text-xs">
            {message.senderName?.[0]?.toUpperCase() || "U"}
          </AvatarFallback>
        </Avatar>
      )}
      {!message.isOwn && !showAvatar && <div className="w-7 shrink-0" />}

      <div className={cn("flex flex-col max-w-[75%]", message.isOwn ? "items-end" : "items-start")}>
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2",
            message.isOwn
              ? "bg-primary text-primary-foreground rounded-br-sm"
              : "bg-muted rounded-bl-sm"
          )}
        >
          {renderContent()}
        </div>
        
        <div className="flex items-center gap-1 mt-0.5 px-1">
          <span className="text-[10px] text-muted-foreground">
            {formatTime(message.timestamp)}
          </span>
          {message.isOwn && (
            <HugeiconsIcon
              icon={message.isRead ? TickDouble02Icon : Tick02Icon}
              size={12}
              className={cn(
                message.isRead ? "text-primary" : "text-muted-foreground"
              )}
            />
          )}
        </div>
      </div>
    </div>
  )
}
