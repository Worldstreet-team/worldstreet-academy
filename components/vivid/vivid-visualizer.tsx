"use client"

/**
 * Vivid Visualizer — Mirrored waveform + mic control.
 */

import { useRef, useEffect } from "react"
import { motion } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Mic01Icon, MicOff01Icon } from "@hugeicons/core-free-icons"
import { useVivid } from "@/lib/vivid/provider"

const BAR_COUNT = 40

export function LiveOrb() {
  const vivid = useVivid()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  // Mirrored waveform visualizer — bars originate from center outward
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const W = 400
    const H = 80
    canvas.width = W
    canvas.height = H

    const update = () => {
      ctx.clearRect(0, 0, W, H)
      const levels = vivid.getAudioLevels()
      const step = levels.length > 0 ? Math.floor(levels.length / BAR_COUNT) : 1
      const midY = H / 2
      const barW = 3
      const gap = 2
      const totalW = BAR_COUNT * (barW + gap) - gap
      const startX = (W - totalW) / 2
      const centerBar = Math.floor(BAR_COUNT / 2)

      for (let i = 0; i < BAR_COUNT; i++) {
        // Map bar index so center bars get the strongest signal
        // Distance from center: 0 = center, centerBar = edge
        const distFromCenter = Math.abs(i - centerBar)
        // Reverse: center gets index 0 (loudest), edges get highest indices
        const levelIdx = distFromCenter
        const val = levels.length > 0 ? (levels[levelIdx * step] ?? 0) / 255 : 0
        const h = 2 + val * (midY - 4)
        const x = startX + i * (barW + gap)
        const alpha = 0.35 + val * 0.65

        ctx.fillStyle = `rgba(160,160,160,${alpha})`
        ctx.beginPath()
        ctx.roundRect(x, midY - h, barW, h, 1.5)
        ctx.fill()
        ctx.beginPath()
        ctx.roundRect(x, midY, barW, h, 1.5)
        ctx.fill()
      }

      // center line
      ctx.fillStyle = "rgba(160,160,160,0.15)"
      ctx.fillRect(startX, midY - 0.5, totalW, 1)

      animRef.current = requestAnimationFrame(update)
    }

    update()
    return () => cancelAnimationFrame(animRef.current)
  }, [vivid])

  return (
    <div className="relative flex flex-col items-center gap-3 py-4 shrink-0 w-full">
      {/* Mirrored waveform */}
      <canvas
        ref={canvasRef}
        className="w-full max-w-sm h-20"
      />

      {/* Mic button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => vivid.isConnected ? vivid.endSession() : vivid.startSession()}
        className="flex items-center justify-center
                   w-12 h-12 rounded-full bg-foreground/5
                   cursor-pointer"
      >
        {vivid.isConnected ? (
          <HugeiconsIcon icon={MicOff01Icon} size={20} className="text-foreground/80" />
        ) : (
          <HugeiconsIcon icon={Mic01Icon} size={20} className="text-foreground/80" />
        )}
      </motion.button>
    </div>
  )
}
