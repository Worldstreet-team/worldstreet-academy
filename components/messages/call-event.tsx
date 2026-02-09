"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  Call02Icon,
  CallEnd01Icon,
  CallIncoming04Icon,
  CallOutgoing04Icon,
  Video01Icon,
  VideoOffIcon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

type CallEventProps = {
  content: string
  /** Whether the current logged-in user sent this message (= is the caller) */
  isOwn: boolean
  timestamp: Date
  onCallback?: (type: "video" | "audio") => void
}

/**
 * New format: CALL_EVENT:type:status:duration:callerId
 * Legacy format: starts with emoji or contains call keywords
 * isOwn = current user is the caller (senderId === callerId)
 */
function parseCallEvent(content: string, isOwn: boolean) {
  // Try new structured format first
  if (content.startsWith("CALL_EVENT:")) {
    const parts = content.split(":")
    const type = (parts[1] === "video" ? "video" : "audio") as "video" | "audio"
    const status = parts[2] || "completed"
    const durationStr = parts[3] || "0"
    const isCaller = isOwn

    const isMissed = status === "missed"
    const isDeclined = status === "declined"
    const isFailed = status === "failed"
    const isCompleted = status === "completed"
    const duration = durationStr !== "0" ? durationStr : null

    return { type, isMissed, isDeclined, isFailed, isCompleted, duration, isCaller }
  }

  // Legacy emoji-based format
  const isVideo = content.includes("Video") || content.includes("📹")
  const type: "video" | "audio" = isVideo ? "video" : "audio"
  const isMissed = content.toLowerCase().includes("missed")
  const isDeclined = content.toLowerCase().includes("declined")
  const isFailed = content.toLowerCase().includes("failed")
  const isCompleted = !isMissed && !isDeclined && !isFailed
  const durationMatch = content.match(/·\s*(.+)$/)
  const duration = isCompleted && durationMatch ? durationMatch[1].trim() : null

  return { type, isMissed, isDeclined, isFailed, isCompleted, duration, isCaller: isOwn }
}

export function isCallEventMessage(content: string): boolean {
  if (content.startsWith("CALL_EVENT:")) return true
  return (
    content.startsWith("📹") ||
    content.startsWith("📞") ||
    (content.includes("call") &&
      (content.includes("Missed") ||
        content.includes("declined") ||
        content.includes("failed") ||
        content.includes("Video call ·") ||
        content.includes("Voice call ·")))
  )
}

export function CallEvent({ content, isOwn, timestamp, onCallback }: CallEventProps) {
  const { type, isMissed, isDeclined, isFailed, isCompleted, duration, isCaller } = parseCallEvent(content, isOwn)

  // Determine perspective-aware status label
  const getStatusLabel = () => {
    if (isCompleted) return duration || "Completed"
    if (isFailed) return "Failed"

    if (isMissed) {
      // Caller placed but missed → they see "No answer"
      // Receiver missed → they see "Missed call"
      return isCaller ? "No answer" : "Missed"
    }
    if (isDeclined) {
      // Caller placed but declined → they see "Declined"
      // Receiver declined → they see "Declined"
      return isCaller ? "Declined" : "Declined"
    }
    return "Completed"
  }

  const isNegative = isMissed || isDeclined || isFailed
  const CallIcon = type === "video" ? Video01Icon : Call02Icon

  // Arrow direction based on perspective
  const StatusIcon = isCaller ? CallOutgoing04Icon : CallIncoming04Icon
  const statusColor = isNegative ? "text-red-500" : "text-emerald-500"

  const timeStr = new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <div className="flex items-center justify-center py-1">
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl max-w-[280px] bg-muted/60 dark:bg-muted/40">
        {/* Call type icon */}
        <div
          className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
            isNegative ? "bg-red-500/10" : "bg-emerald-500/10"
          )}
        >
          <HugeiconsIcon
            icon={CallIcon}
            size={18}
            className={isNegative ? "text-red-500" : "text-emerald-500"}
          />
        </div>

        {/* Call info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            {type === "video" ? "Video" : "Voice"} Call
          </p>
          <div className="flex items-center gap-1">
            <HugeiconsIcon icon={StatusIcon} size={12} className={statusColor} />
            <span className={cn("text-xs", statusColor)}>
              {getStatusLabel()}
            </span>
            <span className="text-xs text-muted-foreground ml-1">{timeStr}</span>
          </div>
        </div>

        {/* Callback button for missed/declined */}
        {isNegative && !isFailed && onCallback && (
          <button
            onClick={() => onCallback(type)}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-foreground/10 transition-colors shrink-0"
            title={`Call back (${type})`}
          >
            <HugeiconsIcon
              icon={type === "video" ? Video01Icon : Call02Icon}
              size={16}
              className="text-emerald-500"
            />
          </button>
        )}
      </div>
    </div>
  )
}
