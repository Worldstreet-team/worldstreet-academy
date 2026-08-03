"use client"

/**
 * Vivid Top Bar — status indicator, minimize, expand, close controls.
 */

import { motion } from "motion/react"
import { useVivid } from "@/lib/vivid/provider"
import { Maximize2Icon, Minimize2Icon, XIcon } from "lucide-react"

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
    <div className="flex items-center justify-between px-6 py-4 border-b border-ws-hairline relative z-10">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {/* Mic live-state dot — opacity-only loop while listening
              (sanctioned live-state exception, 06-motion) */}
          <motion.div
            animate={{
              opacity: vivid.isListening ? [0.4, 1, 0.4] : vivid.isConnected ? 0.8 : 0.3,
            }}
            transition={{ repeat: vivid.isListening ? Infinity : 0, duration: 1.2, ease: "easeInOut" }}
            className="w-2 h-2 rounded-full bg-foreground"
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
            whileTap={{ scale: 0.98 }}
            onClick={() => vivid.setViewMode(
              vivid.viewMode === "expanded" ? "minimized" : "expanded"
            )}
            className="p-2 rounded-lg hover:bg-accent/50 transition-colors text-muted-foreground"
            aria-label={vivid.viewMode === "expanded" ? "Minimize" : "Expand"}
          >
            {vivid.viewMode === "expanded" ? (
              <Minimize2Icon  size={16} />
            ) : (
              <Maximize2Icon  size={16} />
            )}
          </motion.button>
        )}

        {/* Close */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => vivid.endSession()}
          className="p-2 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
        >
          <XIcon  size={16} />
        </motion.button>
      </div>
    </div>
  )
}
