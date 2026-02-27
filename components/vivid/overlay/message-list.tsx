"use client"

import Image from "next/image"
import { motion } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { UserIcon } from "@hugeicons/core-free-icons"

export interface ConvoItem {
  conversationId?: string
  userName: string
  userAvatar?: string
  lastMessage?: string
  isFromMe?: boolean
}

/** Parse CALL_EVENT:type:status:duration:callerId into human-readable text */
function formatCallEvent(msg?: string): string {
  if (!msg) return "No messages yet"
  if (!msg.startsWith("CALL_EVENT:")) return msg
  const parts = msg.split(":")
  const callType = parts[1] === "video" ? "Video" : "Voice"
  const status = parts[2] || "completed"
  const dur = parts[3] || "0"
  if (status === "completed" && dur !== "0") return `${callType} call · ${dur}`
  if (status === "missed") return `Missed ${callType.toLowerCase()} call`
  if (status === "declined") return `Declined ${callType.toLowerCase()} call`
  if (status === "failed") return `Failed ${callType.toLowerCase()} call`
  return `${callType} call`
}

export function MessageList({ data }: { data: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = Array.isArray(data) ? data : (data as any)?.conversations || []

  return (
    <div className="space-y-2">
      {items.slice(0, 12).map((c: ConvoItem, i: number) => (
        <motion.div
          key={c.conversationId || i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          className="flex items-center gap-3 p-3 rounded-2xl bg-card/50 border border-border/20
                     hover:border-foreground/10 hover:bg-card/70 transition-all duration-200"
        >
          <div className="relative w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center overflow-hidden shrink-0 ring-1 ring-border/20">
            {c.userAvatar ? (
              <Image src={c.userAvatar} alt="" fill className="object-cover" sizes="36px" />
            ) : (
              <HugeiconsIcon icon={UserIcon} size={20} className="text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{c.userName}</p>
            <p className="text-xs text-muted-foreground truncate">
              {c.isFromMe ? "You: " : ""}{formatCallEvent(c.lastMessage)}
            </p>
          </div>
        </motion.div>
      ))}
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">No conversations.</p>
      )}
    </div>
  )
}
