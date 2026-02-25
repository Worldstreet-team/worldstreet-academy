"use client"

/**
 * Vivid Minimized Bar — Compact floating assistant bar (award-worthy design).
 *
 * Appears when the session is active but minimized. Shows:
 * - Subtle animated waveform
 * - Real-time word-by-word transcript with scroll-up animation
 * - Expand / Close controls
 * - Smooth spring transitions
 */

import { useRef, useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowExpand02Icon,
  Cancel01Icon,
  Mic01Icon,
} from "@hugeicons/core-free-icons"
import { useVivid } from "@/lib/vivid/provider"

const MINI_BARS = 16

/** Strip markdown wrappers for clean display */
function stripMd(text: string): string {
  return text
    .replace(/\*{1,3}(.*?)\*{1,3}/g, "$1")
    .replace(/_{1,3}(.*?)_{1,3}/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[\s]*[-*+]\s+/gm, "")
    .replace(/^[\s]*\d+\.\s+/gm, "")
    .replace(/([^\\])\*/g, "$1")
    .replace(/^\*/g, "")
    .replace(/\n/g, " ")
    .trim()
}

/** Split text into word tokens with offsets */
function tokenize(text: string) {
  const tokens: { word: string; start: number; end: number; isSpace: boolean }[] = []
  let i = 0
  while (i < text.length) {
    if (/\s/.test(text[i])) {
      const s = i
      while (i < text.length && /\s/.test(text[i])) i++
      tokens.push({ word: text.slice(s, i), start: s, end: i, isSpace: true })
    } else {
      const s = i
      while (i < text.length && !/\s/.test(text[i])) i++
      tokens.push({ word: text.slice(s, i), start: s, end: i, isSpace: false })
    }
  }
  return tokens
}

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

  // ── Streaming transcript with word-by-word animation ──

  const lastLine = vivid.transcriptLines
    .filter((l) => l.role === "assistant")
    .slice(-1)[0]

  const rawText = lastLine?.text || ""
  const spokenIndex = lastLine?.spokenIndex ?? 0
  const isFinal = lastLine?.isFinal ?? true
  const cleanText = useMemo(() => stripMd(rawText), [rawText])
  const tokens = useMemo(() => tokenize(cleanText), [cleanText])

  // Derive a stable message key from the line ID for enter/exit animations
  const messageKey = lastLine?.id ?? "empty"

  // How many words fit in the container (~48ch ≈ 280px @ text-xs)
  const MAX_VISIBLE_CHARS = 55
  const visibleTokens = useMemo(() => {
    if (tokens.length === 0) return []
    // Show a trailing window of words that fit
    let charCount = 0
    let startIdx = tokens.length
    for (let i = tokens.length - 1; i >= 0; i--) {
      charCount += tokens[i].word.length
      if (charCount > MAX_VISIBLE_CHARS) break
      startIdx = i
    }
    return tokens.slice(startIdx)
  }, [tokens])

  const displayLabel = !cleanText ? stateLabel(vivid.state) : null

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
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-999 touch-none"
      >
        <motion.div
          layout
          layoutId="vivid-surface"
          className="flex items-center gap-3 px-4 py-2.5 rounded-2xl
                     bg-background/80 backdrop-blur-2xl border border-border/30
                     shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08)]
                     max-w-md cursor-grab active:cursor-grabbing select-none"
          onClick={() => {
            if (!isDragging) vivid.setViewMode("expanded")
          }}
          whileHover={{ scale: 1.01, y: -1 }}
          whileTap={{ scale: 0.99 }}
        >
        {/* Pulsing indicator with green glow */}
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

        {/* Word-by-word streaming transcript */}
        <div className="flex-1 max-w-52 h-5 overflow-hidden relative">
          <AnimatePresence mode="popLayout">
            {displayLabel ? (
              <motion.p
                key="label"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 0.6, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="text-xs text-foreground/70 font-medium truncate absolute inset-0"
              >
                {displayLabel}
              </motion.p>
            ) : (
              <motion.div
                key={`msg-${messageKey}`}
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -12, opacity: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="flex items-center gap-0 flex-nowrap whitespace-nowrap absolute inset-0"
              >
                {visibleTokens.map((token, i) => {
                  if (token.isSpace) return <span key={`s-${i}`}>&nbsp;</span>
                  const isSpoken = token.end <= spokenIndex
                  const isCurrent = !isSpoken && token.start < spokenIndex

                  // Words animate in one by one as they arrive from the stream
                  return (
                    <motion.span
                      key={`w-${token.start}-${token.word}`}
                      initial={{ opacity: 0, y: 6, filter: "blur(2px)" }}
                      animate={{
                        opacity: isSpoken || isCurrent ? 1 : 0.4,
                        y: 0,
                        filter: "blur(0px)",
                      }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className="text-xs font-medium inline-block"
                      style={{
                        color: isSpoken || isCurrent
                          ? "var(--foreground)"
                          : "color-mix(in srgb, var(--foreground) 40%, transparent)",
                      }}
                    >
                      {token.word}
                    </motion.span>
                  )
                })}
                {/* Blinking cursor while streaming */}
                {!isFinal && (
                  <motion.span
                    animate={{ opacity: [1, 0.2, 1] }}
                    transition={{ repeat: Infinity, duration: 0.8 }}
                    className="inline-block w-0.5 h-3 bg-foreground/40 rounded-full ml-0.5"
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

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
    case "connecting": return "Connecting…"
    case "ready": return "Listening…"
    case "listening": return "Hearing you…"
    case "processing": return "Thinking…"
    case "speaking": return "Speaking…"
    default: return "WorldStreet AI"
  }
}
