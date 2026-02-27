"use client"

/**
 * Vivid AI Widget — WorldStreet Academy
 *
 * Main composing component: orchestrates the OrbButton, MinimizedBar,
 * FullPageExperience, and all sub-components. Handles view mode transitions.
 *
 * Layout:
 *   Desktop → Full-width split: left = transcript lyrics + orb, right = side panel
 *   Mobile  → Stacked: orb on top, panel as bottom card
 */

import { useEffect } from "react"
import { motion, AnimatePresence, LayoutGroup } from "motion/react"
import { useVivid } from "@/lib/vivid/provider"
import { OrbButton } from "./vivid-orb"
import { MinimizedBar } from "./vivid-minimized"
import { TopBar } from "./vivid-topbar"
import { LiveOrb } from "./vivid-visualizer"
import { TranscriptLyrics } from "./vivid-transcript"
import { OverlayPanelView } from "./overlay"
import { OnDemandUIPanel } from "./ondemand"

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
        <AnimatePresence mode="wait">
          {viewMode === "minimized" && isSessionActive && state !== "connecting" && (
            <MinimizedBar />
          )}
        </AnimatePresence>

        {/* Full-page experience */}
        <AnimatePresence mode="wait">
          {(viewMode === "expanded" || viewMode === "overlay" || viewMode === "compact") && (
            <FullPageExperience />
          )}
        </AnimatePresence>
      </LayoutGroup>
    </>
  )
}

// ============================================================================
// Full-Page Experience — Left/Right Split
// ============================================================================

function FullPageExperience() {
  const vivid = useVivid()
  const hasPanel = !!(vivid.activePanel || vivid.onDemandUI)
  const panelKey = vivid.onDemandUI?.id ?? vivid.activePanel?.id ?? "panel"

  return (
    <motion.div
      key="full-page"
      layoutId="vivid-surface"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed inset-0 z-998 flex flex-col bg-background/80 backdrop-blur-2xl"
      style={{ borderRadius: 0 }}
    >
      {/* Background gradient mesh */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-150 h-150 rounded-full bg-white/2 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-125 h-125 rounded-full bg-white/2 blur-[100px]" />
      </div>

      {/* Top bar */}
      <TopBar />

      {/* Desktop: side-by-side | Mobile: stacked */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* ── Left: Transcript Lyrics + Orb ── */}
        <div className="flex-1 flex flex-col items-center justify-end min-h-0 px-4 pb-8 pt-4">
          <TranscriptLyrics />
          <div className="shrink-0 mt-6 flex flex-col items-center">
            <LiveOrb />
            <motion.p
              animate={{ opacity: 0.5 }}
              className="text-xs text-muted-foreground font-medium mt-1"
            >
              {stateLabel(vivid.state)}
            </motion.p>
          </div>
        </div>

        {/* ── Right: Side panel (overlay / on-demand) ── */}
        <AnimatePresence mode="wait">
          {hasPanel && (
            <motion.div
              key={panelKey}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className={[
                // Desktop: full-height side panel
                "md:w-105 md:border-l md:border-border/20",
                // Mobile: bottom card
                "max-md:mx-4 max-md:mb-4 max-md:rounded-2xl max-md:border max-md:border-border/30 max-md:max-h-[60vh]",
                // Shared
                "bg-background/60 backdrop-blur-xl overflow-y-auto",
                "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden!",
              ].join(" ")}
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

function stateLabel(state: string): string {
  switch (state) {
    case "connecting": return "Connecting\u2026"
    case "ready": return "Listening\u2026"
    case "listening": return "Hearing you\u2026"
    case "processing": return "Thinking\u2026"
    case "speaking": return "Speaking\u2026"
    default: return "WorldStreet AI"
  }
}
