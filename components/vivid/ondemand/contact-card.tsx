"use client"

import Image from "next/image"
import { motion } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  UserIcon,
  BubbleChatIcon,
  Call02Icon,
  VideoReplayIcon,
} from "@hugeicons/core-free-icons"
import { useVivid } from "@/lib/vivid/provider"
import type { OnDemandUI } from "@/lib/vivid/types"
import { parseConfig } from "./helpers"

export function ContactCardUI({ ui }: { ui: OnDemandUI }) {
  const vivid = useVivid()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config = parseConfig(ui.config as any)

  return (
    <div className="space-y-5">
      {/* Profile section */}
      <div className="flex flex-col items-center text-center pt-2">
        <div className="relative w-20 h-20 rounded-full overflow-hidden bg-accent/30 mb-3 ring-2 ring-border/20 ring-offset-2 ring-offset-background">
          {config.userAvatar ? (
            <Image src={config.userAvatar} alt="" fill className="object-cover" sizes="80px" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <HugeiconsIcon icon={UserIcon} size={32} className="text-muted-foreground/50" />
            </div>
          )}
        </div>
        <p className="text-base font-semibold text-foreground">{config.userName || "User"}</p>
        {config.role && (
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground mt-0.5 px-2 py-0.5 rounded-md bg-accent/30">
            {config.role}
          </span>
        )}
        {config.bio && (
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed line-clamp-3 max-w-65">
            {config.bio}
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => vivid.resolveUI({ action: "message", userId: config.userId })}
          className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl
                     text-sm font-medium bg-accent/40 hover:bg-accent/60 transition-colors"
        >
          <HugeiconsIcon icon={BubbleChatIcon} size={16} />
          Message
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => vivid.resolveUI({ action: "call", userId: config.userId, callType: "audio" })}
          className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl
                     text-sm font-medium bg-foreground text-background hover:bg-foreground/90
                     transition-colors"
        >
          <HugeiconsIcon icon={Call02Icon} size={16} />
          Call
        </motion.button>
      </div>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => vivid.resolveUI({ action: "video-call", userId: config.userId, callType: "video" })}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl
                   text-sm font-medium bg-accent/20 hover:bg-accent/40 transition-colors"
      >
        <HugeiconsIcon icon={VideoReplayIcon} size={16} />
        Video Call
      </motion.button>
    </div>
  )
}
