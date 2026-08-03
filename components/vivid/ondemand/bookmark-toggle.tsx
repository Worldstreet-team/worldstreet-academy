"use client"

import Image from "next/image"
import { useState } from "react"
import { motion } from "motion/react"
import { useVivid } from "@/lib/vivid/provider"
import type { OnDemandUI } from "@/lib/vivid/types"
import { parseConfig } from "./helpers"
import { BookmarkCheckIcon, BookmarkIcon } from "lucide-react"
import { RenderIcon } from "@/components/shared/render-icon"

export function BookmarkToggleUI({ ui }: { ui: OnDemandUI }) {
  const vivid = useVivid()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config = parseConfig(ui.config as any)
  const [isBookmarked, setIsBookmarked] = useState(config.isBookmarked === true)
  const [isSaving, setIsSaving] = useState(false)

  const handleToggle = async () => {
    setIsSaving(true)
    const newState = !isBookmarked
    setIsBookmarked(newState)
    await new Promise((r) => setTimeout(r, 300))
    vivid.resolveUI({ courseId: config.courseId, isBookmarked: newState })
  }

  return (
    <div className="space-y-4">
      {/* Course card */}
      <div className="rounded-lg overflow-hidden border border-ws-hairline bg-card/60">
        {config.thumbnailUrl && (
          <div className="relative w-full aspect-2/1 bg-muted">
            <Image
              src={config.thumbnailUrl}
              alt={config.courseTitle || ""}
              fill
              className="object-cover"
              sizes="400px"
            />
          </div>
        )}
        <div className="p-4">
          <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
            {config.courseTitle || "Course"}
          </p>
        </div>
      </div>

      {/* Toggle button */}
      <motion.button
        whileTap={{ scale: 0.98 }}
        disabled={isSaving}
        onClick={handleToggle}
        className={`
          w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-lg text-sm font-medium
          transition-all duration-[var(--ws-motion-base)] disabled:opacity-60
          ${isBookmarked
            ? "bg-foreground text-background"
            : "bg-accent/40 text-foreground hover:bg-accent/60"
          }
        `}
      >
        <motion.div
          animate={isBookmarked ? { scale: [1, 1.3, 1], rotate: [0, -10, 10, 0] } : {}}
          transition={{ duration: 0.4 }}
        >
          <RenderIcon icon={isBookmarked ? BookmarkCheckIcon : BookmarkIcon}
            
            size={18}
            className={isBookmarked ? "fill-current" : ""} />
        </motion.div>
        {isSaving ? "Saving…" : isBookmarked ? "Bookmarked" : "Bookmark this course"}
      </motion.button>
    </div>
  )
}
