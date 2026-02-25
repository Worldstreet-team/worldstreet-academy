"use client"

/**
 * Vivid AI Widget — WorldStreet Academy
 *
 * Main composing component: orchestrates the OrbButton, MinimizedBar,
 * FullPageExperience, and all sub-components. Handles view mode transitions.
 */

import { useEffect } from "react"
import { motion, AnimatePresence, LayoutGroup } from "motion/react"
import { useVivid } from "@/lib/vivid/provider"
import { OrbButton } from "./vivid-orb"
import { MinimizedBar } from "./vivid-minimized"
import { TopBar } from "./vivid-topbar"
import { TranscriptLyrics } from "./vivid-transcript"
import { LiveOrb } from "./vivid-visualizer"
import { OverlayPanelView } from "./vivid-overlay"
import { OnDemandUIPanel } from "./vivid-ondemand"

// ============================================================================
// Main Widget
// ============================================================================

export function VividWidget() {
  const vivid = useVivid()
  const { state, viewMode } = vivid

  // When idle, ensure we're in minimized mode
  useEffect(() => {
    if (state === "idle" && viewMode !== "minimized") {
      vivid.setViewMode("minimized")
    }
  }, [state, viewMode, vivid])

  // Is the session active? (not idle/error)
  const isSessionActive = state !== "idle" && state !== "error"

  return (
    <>
      {/* Idle floating orb — only when no session */}
      <AnimatePresence>
        {viewMode === "minimized" && !isSessionActive && (
          <motion.div
            key="orb-trigger"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="fixed bottom-6 right-6 z-999 hidden md:block"
          >
            <OrbButton />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connecting state — also show orb in minimized position */}
      <AnimatePresence>
        {state === "connecting" && viewMode === "minimized" && (
          <motion.div
            key="orb-connecting"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="fixed bottom-6 right-6 z-999 hidden md:block"
          >
            <OrbButton />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shared layout transition between minimized pill & full-page */}
      <LayoutGroup>
        {/* Minimized bar — active session, minimized */}
        <AnimatePresence>
          {viewMode === "minimized" && isSessionActive && state !== "connecting" && (
            <MinimizedBar />
          )}
        </AnimatePresence>

        {/* Full-page experience */}
        <AnimatePresence>
          {(viewMode === "expanded" || viewMode === "overlay" || viewMode === "compact") && (
            <FullPageExperience />
          )}
        </AnimatePresence>
      </LayoutGroup>
    </>
  )
}

// ============================================================================
// Full-Page Experience
// ============================================================================

function FullPageExperience() {
  const vivid = useVivid()

  return (
    <motion.div
      key="full-page"
      layoutId="vivid-surface"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed inset-0 z-998 flex flex-col bg-background/80 backdrop-blur-2xl rounded-none"
      style={{ borderRadius: 0 }}
    >
      {/* Background gradient mesh */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-150 h-150 rounded-full bg-white/2 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-125 h-125 rounded-full bg-white/2 blur-[100px]" />
      </div>

      {/* Top bar */}
      <TopBar />

      {/* Content area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left: Transcript lyrics */}
        <div className="flex-1 flex flex-col items-center justify-end pb-8 overflow-hidden">
          <TranscriptLyrics />
          <LiveOrb />
        </div>

        {/* Right: Overlay / On-Demand UI */}
        <AnimatePresence mode="wait">
          {(vivid.activePanel || vivid.onDemandUI) && (
            <motion.div
              key="side-panel"
              initial={{ x: 80, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 80, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-105 border-l border-border/30 bg-background/60 backdrop-blur-xl overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden!"
            >
              {vivid.onDemandUI ? (
                <OnDemandUIPanel ui={vivid.onDemandUI} />
              ) : vivid.activePanel ? (
                <OverlayPanelView panel={vivid.activePanel} />
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
