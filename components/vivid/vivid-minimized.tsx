"use client"

/**
 * Vivid Minimized Bar — Compact floating assistant bar.
 *
 * Appears when the session is active but minimized. Shows:
 * - Subtle animated waveform
 * - Status text (Listening, Speaking, etc.)
 * - Expand / Close controls
 * - Smooth spring transitions
 */

import { useRef, useEffect, useState } from "react"
import { motion } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowExpand02Icon,
  Cancel01Icon,
  Mic01Icon,
} from "@hugeicons/core-free-icons"
import { useVivid } from "@/lib/vivid/provider"

const MINI_BARS = 16

export function MinimizedBar() {
  const vivid = useVivid()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const constraintsRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Tiny inline waveform
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const W = 64
    const H = 24
    canvas.width = W * 2
    canvas.height = H * 2
    ctx.scale(2, 2)

    const update = () => {
      ctx.clearRect(0, 0, W, H)
      const levels = vivid.getAudioLevels()
      const step = levels.length > 0 ? Math.floor(levels.length / MINI_BARS) : 1
      const midY = H / 2
      const barW = 2
      const gap = 1.5
      const totalW = MINI_BARS * (barW + gap) - gap
      const startX = (W - totalW) / 2
      const centerBar = Math.floor(MINI_BARS / 2)

      for (let i = 0; i < MINI_BARS; i++) {
        const distFromCenter = Math.abs(i - centerBar)
        const levelIdx = distFromCenter
        const val = levels.length > 0 ? (levels[levelIdx * step] ?? 0) / 255 : 0
        const h = 1 + val * (midY - 2)
        const x = startX + i * (barW + gap)
        const alpha = 0.4 + val * 0.6

        ctx.fillStyle = `rgba(160,160,160,${alpha})`
        ctx.beginPath()
        ctx.roundRect(x, midY - h, barW, h, 1)
        ctx.fill()
        ctx.beginPath()
        ctx.roundRect(x, midY, barW, h, 1)
        ctx.fill()
      }

      animRef.current = requestAnimationFrame(update)
    }

    update()
    return () => cancelAnimationFrame(animRef.current)
  }, [vivid])

  const label = stateLabel(vivid.state)

  return (
    <>
      {/* Full-viewport drag constraint boundary */}
      <div
        ref={constraintsRef}
        className="fixed inset-0 z-998 pointer-events-none"
      />
      <motion.div
        drag
        dragConstraints={constraintsRef}
        dragElastic={0.1}
        dragMomentum={false}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={() => setTimeout(() => setIsDragging(false), 0)}
        initial={{ y: 80, opacity: 0, scale: 0.9 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 80, opacity: 0, scale: 0.9 }}
        transition={{ type: "spring", stiffness: 260, damping: 28 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-999 touch-none"
      >
        <motion.div
          layoutId="vivid-surface"
          className="flex items-center gap-3 px-4 py-2.5
                     bg-background/80 backdrop-blur-2xl border border-border/30
                     shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08)]
                     max-w-md cursor-grab active:cursor-grabbing select-none"
          style={{ borderRadius: 16 }}
          onClick={() => {
            if (!isDragging) vivid.setViewMode("expanded")
          }}
          whileHover={{ scale: 1.01, y: -1 }}
          whileTap={{ scale: 0.99 }}
        >
        {/* Pulsing indicator */}
        <div className="relative flex items-center justify-center w-8 h-8 shrink-0">
          <motion.div
            animate={{
              scale: vivid.isSpeaking ? [1, 1.2, 1] : vivid.isListening ? [1, 1.15, 1] : 1,
              opacity: vivid.isConnected ? 1 : 0.4,
            }}
            transition={{
              repeat: vivid.isSpeaking || vivid.isListening ? Infinity : 0,
              duration: vivid.isSpeaking ? 0.8 : 1.2,
            }}
            className="absolute inset-0 rounded-full bg-foreground/5"
          />
          <HugeiconsIcon icon={Mic01Icon} size={14} className="text-foreground/70 relative z-10" />
        </div>

        {/* Mini waveform */}
        <canvas
          ref={canvasRef}
          className="w-16 h-6 shrink-0"
        />

        {/* Status text */}
        <p className="flex-1 max-w-44 text-xs text-foreground/60 font-medium truncate">
          {label}
        </p>

        {/* Controls */}
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => vivid.setViewMode("expanded")}
            className="p-1.5 rounded-lg hover:bg-accent/50 transition-colors text-muted-foreground"
            aria-label="Expand"
          >
            <HugeiconsIcon icon={ArrowExpand02Icon} size={14} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => vivid.endSession()}
            className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
            aria-label="End session"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={14} />
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
    </>
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
