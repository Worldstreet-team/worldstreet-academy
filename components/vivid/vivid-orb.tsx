"use client"

/**
 * Vivid Orb Button — Floating trigger with animated blob.
 * Shows faster blob animation during "connecting" state.
 */

import { useRef, useEffect } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Mic01Icon } from "@hugeicons/core-free-icons"
import { useVivid } from "@/lib/vivid/provider"

export function OrbButton() {
  const vivid = useVivid()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const isConnecting = vivid.state === "connecting"

  // Orb glow animation — faster when connecting
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const size = 120
    canvas.width = size * 2
    canvas.height = size * 2

    const draw = () => {
      ctx.clearRect(0, 0, size * 2, size * 2)
      // Speed multiplier: 3x during connecting, 1x normal
      const speed = isConnecting ? 4500 : 1500
      const t = Date.now() / speed
      const levels = vivid.getAudioLevels()
      const avg = levels.length > 0
        ? levels.reduce((a, b) => a + b, 0) / levels.length / 255
        : 0

      // Pulsate radius when connecting
      const connectPulse = isConnecting ? Math.sin(Date.now() / 300) * 6 : 0
      const baseR = 44 + avg * 12 + connectPulse
      const gradient = ctx.createRadialGradient(size, size, baseR * 0.2, size, size, baseR * 1.6)

      if (isConnecting) {
        // Brighter, more vivid green gradient when connecting
        gradient.addColorStop(0, `rgba(34,197,94,${0.95})`)
        gradient.addColorStop(0.35, `rgba(22,163,74,${0.7})`)
        gradient.addColorStop(0.7, `rgba(16,130,60,${0.35})`)
        gradient.addColorStop(1, "rgba(16,130,60,0)")
      } else {
        gradient.addColorStop(0, `rgba(34,197,94,${0.85 + avg * 0.15})`)
        gradient.addColorStop(0.35, `rgba(22,163,74,${0.5 + avg * 0.3})`)
        gradient.addColorStop(0.7, `rgba(16,130,60,${0.2 + avg * 0.15})`)
        gradient.addColorStop(1, "rgba(16,130,60,0)")
      }

      ctx.fillStyle = gradient
      ctx.beginPath()

      // Organic blob shape — more volatile when connecting
      const points = 64
      const noiseScale = isConnecting ? 2 : 1
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2
        const noise = (Math.sin(angle * 3 + t) * 3 + Math.cos(angle * 5 + t * 1.3) * 2) * noiseScale
        const r = baseR + noise * (1 + avg * 4)
        const x = size + Math.cos(angle) * r
        const y = size + Math.sin(angle) * r
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.fill()

      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animRef.current)
  }, [vivid, isConnecting])

  return (
    <button
      onClick={() => vivid.startSession()}
      className="relative flex items-center justify-center w-20 h-20 rounded-full
                 cursor-pointer group"
      aria-label="Start WorldStreet AI"
      disabled={isConnecting}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-[-50%] w-[200%] h-[200%] pointer-events-none"
      />
      {isConnecting ? (
        <div className="relative z-10 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-foreground/30 border-t-foreground/80 rounded-full animate-spin" />
        </div>
      ) : (
        <HugeiconsIcon icon={Mic01Icon} size={24} className="text-foreground/80 group-hover:text-foreground transition-colors relative z-10" />
      )}
    </button>
  )
}
