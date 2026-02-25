"use client"

/**
 * Vivid Top Bar — status indicator, minimize, expand, close controls.
 */

import { motion } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Cancel01Icon,
  ArrowExpand02Icon,
  ArrowShrink02Icon,
} from "@hugeicons/core-free-icons"
import { useVivid } from "@/lib/vivid/provider"

const stateLabels: Record<string, string> = {
  idle: "Offline",
  connecting: "Connecting…",
  ready: "Listening",
  listening: "Hearing you…",
  processing: "Thinking…",
  speaking: "Speaking",
  error: "Error",
}

export function TopBar() {
  const vivid = useVivid()

  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-border/20 relative z-10">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <motion.div
            animate={{
              scale: vivid.isListening ? [1, 1.3, 1] : 1,
              backgroundColor: vivid.isConnected ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.3)",
            }}
            transition={{ repeat: vivid.isListening ? Infinity : 0, duration: 1 }}
            className="w-2 h-2 rounded-full"
          />
          <span className="text-sm font-medium text-foreground/80">
            WorldStreet AI
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {stateLabels[vivid.state] || vivid.state}
        </span>
      </div>

      <div className="flex items-center gap-1">
        {/* Expand / Minimize toggle */}
        {vivid.isConnected && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => vivid.setViewMode(
              vivid.viewMode === "expanded" ? "minimized" : "expanded"
            )}
            className="p-2 rounded-lg hover:bg-accent/50 transition-colors text-muted-foreground"
            aria-label={vivid.viewMode === "expanded" ? "Minimize" : "Expand"}
          >
            {vivid.viewMode === "expanded" ? (
              <HugeiconsIcon icon={ArrowShrink02Icon} size={16} />
            ) : (
              <HugeiconsIcon icon={ArrowExpand02Icon} size={16} />
            )}
          </motion.button>
        )}

        {/* Close */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => vivid.endSession()}
          className="p-2 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={16} />
        </motion.button>
      </div>
    </div>
  )
}
