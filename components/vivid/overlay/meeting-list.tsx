"use client"

import { motion } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { UserGroupIcon } from "@hugeicons/core-free-icons"

export interface MeetingItem {
  id?: string
  title: string
  status: string
  hostName?: string
  participantCount?: number
}

export function MeetingList({ data }: { data: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = Array.isArray(data) ? data : (data as any)?.meetings || []

  return (
    <div className="space-y-3">
      {items.slice(0, 10).map((m: MeetingItem, i: number) => (
        <motion.div
          key={m.id || i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          className="flex items-center gap-3 p-3.5 rounded-2xl bg-card/50 border border-border/20
                     hover:border-foreground/10 hover:bg-card/70 transition-all duration-200"
        >
          <div className="p-2 rounded-xl bg-accent/30">
            <HugeiconsIcon icon={UserGroupIcon} size={16} className="text-foreground/70" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{m.title}</p>
            <p className="text-xs text-muted-foreground">
              {m.hostName} · {m.participantCount || 0} participants
            </p>
          </div>
          <span className={`text-[11px] px-2.5 py-1 rounded-lg font-medium ${
            m.status === "active" ? "bg-emerald-500/15 text-emerald-500" :
            m.status === "waiting" ? "bg-amber-500/15 text-amber-500" :
            "bg-accent/30 text-muted-foreground"
          }`}>
            {m.status}
          </span>
        </motion.div>
      ))}
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">No active meetings.</p>
      )}
    </div>
  )
}
