"use client"

import Image from "next/image"
import { motion } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  UserIcon,
  ArrowRight01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons"

export function SearchResultsList({ data }: { data: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = Array.isArray(data) ? data : (data as any)?.users || (data as any)?.results || []

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="p-4 rounded-2xl bg-accent/20 mb-4">
          <HugeiconsIcon icon={Search01Icon} size={28} className="text-muted-foreground/50" />
        </div>
        <p className="text-muted-foreground text-sm">No results found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {items.slice(0, 15).map((user: any, i: number) => (
        <motion.div
          key={user.id || user._id || i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03 }}
          className="flex items-center gap-3 p-3 rounded-2xl bg-card/50 border border-border/20
                     hover:border-foreground/10 hover:bg-card/70 transition-all duration-200"
        >
          <div className="relative w-10 h-10 rounded-full bg-accent/20 overflow-hidden shrink-0 ring-1 ring-border/20">
            {user.avatar || user.avatarUrl ? (
              <Image src={user.avatar || user.avatarUrl} alt="" fill className="object-cover" sizes="40px" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <HugeiconsIcon icon={UserIcon} size={18} className="text-muted-foreground/50" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || "User"}
            </p>
            {(user.email || user.role) && (
              <p className="text-[11px] text-muted-foreground truncate">
                {user.role ? <span className="capitalize">{user.role}</span> : null}
                {user.role && user.email ? " · " : ""}
                {user.email}
              </p>
            )}
          </div>
          <HugeiconsIcon icon={ArrowRight01Icon} size={14} className="text-muted-foreground/30 shrink-0" />
        </motion.div>
      ))}
    </div>
  )
}
