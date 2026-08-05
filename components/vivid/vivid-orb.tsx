"use client"

/**
 * Vivid Orb Button — Floating trigger rendered as a molten-gold orb.
 *
 * States:
 * - idle       — slow ~4.5s breathing glow, subtle organic shimmer on the core,
 *                and a faint highlight slowly orbiting inside the gradient
 * - hover      — the outer glow intensifies slightly (canvas parameter)
 * - connecting — faster breathing + a quick shimmer sweep across the core;
 *                button stays disabled
 * - active     — audio level swells the core a few px and spawns thin gold
 *                ripple rings that expand and fade
 *
 * Respects prefers-reduced-motion by rendering a single static frame.
 */

import { useRef, useEffect } from "react"
import { useVivid } from "@/lib/vivid/provider"
import { MicIcon } from "lucide-react"

/** Dark ink for content sitting on gold (--ws-brand-on-primary). */
const INK_ON_GOLD = "#1B1A16"

type RGB = { r: number; g: number; b: number }

const FALLBACK_BRAND: RGB = { r: 234, g: 179, b: 8 } // #EAB308 (DS v2 gold)
const WHITE: RGB = { r: 255, g: 255, b: 255 }

function readBrandColor(): RGB {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--ws-brand-primary")
    .trim()
    .replace("#", "")
  if (/^[0-9a-fA-F]{6}$/.test(raw)) {
    return {
      r: parseInt(raw.slice(0, 2), 16),
      g: parseInt(raw.slice(2, 4), 16),
      b: parseInt(raw.slice(4, 6), 16),
    }
  }
  return FALLBACK_BRAND
}

function mix(from: RGB, to: RGB, amount: number): RGB {
  return {
    r: Math.round(from.r + (to.r - from.r) * amount),
    g: Math.round(from.g + (to.g - from.g) * amount),
    b: Math.round(from.b + (to.b - from.b) * amount),
  }
}

function rgba(c: RGB, alpha: number): string {
  return `rgba(${c.r},${c.g},${c.b},${alpha})`
}

export function OrbButton() {
  const vivid = useVivid()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const hoverRef = useRef(false)
  const isConnecting = vivid.state === "connecting"

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const size = 120
    canvas.width = size * 2
    canvas.height = size * 2
    const cx = size
    const cy = size

    // Gold ramp derived from the live brand token
    const brand = readBrandColor() // #FFCC29 gold
    const core = mix(brand, WHITE, 0.24) // bright molten core ~ (255,216,92)
    const deep: RGB = {
      // deep amber rim ~ (181,131,20)
      r: Math.round(brand.r * 0.71),
      g: Math.round(brand.g * 0.64),
      b: Math.round(brand.b * 0.49),
    }
    const highlight = mix(brand, WHITE, 0.55) // orbiting sheen

    // Fixed ripple pool — mutated in place, no per-frame allocation
    const ripples = [
      { r: 0, alpha: 0 },
      { r: 0, alpha: 0 },
    ]
    let lastRipple = 0

    const drawFrame = (animate: boolean) => {
      ctx.clearRect(0, 0, size * 2, size * 2)
      const now = Date.now()
      const t = animate ? now / 1000 : 0

      const levels = vivid.getAudioLevels()
      const avg =
        levels.length > 0
          ? levels.reduce((a, b) => a + b, 0) / levels.length / 255
          : 0

      // Breathing — slow and calm at idle, quicker while connecting
      const breathPeriod = isConnecting ? 1.8 : 4.5
      const breath = 0.5 + 0.5 * Math.sin((t * Math.PI * 2) / breathPeriod)
      const hoverBoost = hoverRef.current ? 1 : 0

      // Core radius: gentle breath + a few px of audio swell
      const baseR = 40 + breath * 1.5 + avg * 7

      // ── 1. Outer breathing glow ──
      const glowR = baseR * (1.7 + breath * 0.35 + hoverBoost * 0.15)
      const glowAlpha = 0.14 + breath * 0.1 + hoverBoost * 0.1 + avg * 0.12
      const glow = ctx.createRadialGradient(cx, cy, baseR * 0.5, cx, cy, glowR)
      glow.addColorStop(0, rgba(brand, glowAlpha))
      glow.addColorStop(1, rgba(brand, 0))
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2)
      ctx.fill()

      // ── 2. Audio ripples — thin expanding gold strokes ──
      if (animate && avg > 0.16 && now - lastRipple > 480) {
        const slot = ripples.find((rp) => rp.alpha <= 0.02)
        if (slot) {
          slot.r = baseR + 3
          slot.alpha = 0.45 + avg * 0.3
          lastRipple = now
        }
      }
      for (const rp of ripples) {
        if (rp.alpha > 0.02) {
          ctx.strokeStyle = rgba(brand, rp.alpha)
          ctx.lineWidth = 1.25
          ctx.beginPath()
          ctx.arc(cx, cy, rp.r, 0, Math.PI * 2)
          ctx.stroke()
          rp.r += 0.9 + avg * 1.4
          rp.alpha *= 0.945
        }
      }

      // ── 3. Molten core — layered golds with a subtle organic shimmer ──
      const grad = ctx.createRadialGradient(
        cx, cy, baseR * 0.15,
        cx, cy, baseR * 1.05,
      )
      grad.addColorStop(0, rgba(core, 0.98))
      grad.addColorStop(0.45, rgba(brand, 0.95))
      grad.addColorStop(0.82, rgba(deep, 0.9))
      grad.addColorStop(1, rgba(deep, 0))
      ctx.fillStyle = grad
      ctx.beginPath()
      const points = 64
      const wobble = t * 0.6 // slow, elegant drift
      const amp = 1.4 + avg * 3 // subtle at idle, opens up with voice
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2
        const noise =
          Math.sin(angle * 3 + wobble) * amp * 0.6 +
          Math.cos(angle * 5 + wobble * 1.3) * amp * 0.4
        const r = baseR + noise
        const x = cx + Math.cos(angle) * r
        const y = cy + Math.sin(angle) * r
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.fill()

      // ── 4. Orbiting highlight — light moving across molten metal.
      //       While connecting it becomes a faster, brighter shimmer sweep. ──
      ctx.save()
      ctx.clip() // clip to the core path drawn above
      const sweepSpeed = isConnecting ? 2.6 : 0.35
      const sweepAngle = t * sweepSpeed
      const hx = cx + Math.cos(sweepAngle) * baseR * 0.45
      const hy = cy + Math.sin(sweepAngle) * baseR * 0.45
      const hlAlpha = isConnecting ? 0.5 : 0.22 + hoverBoost * 0.08
      const hl = ctx.createRadialGradient(hx, hy, 0, hx, hy, baseR * 0.95)
      hl.addColorStop(0, rgba(highlight, hlAlpha))
      hl.addColorStop(1, rgba(highlight, 0))
      ctx.fillStyle = hl
      ctx.fillRect(0, 0, size * 2, size * 2)
      ctx.restore()
    }

    const loop = () => {
      drawFrame(true)
      animRef.current = requestAnimationFrame(loop)
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const start = () => {
      cancelAnimationFrame(animRef.current)
      if (reducedMotion.matches) {
        drawFrame(false) // single static frame
      } else {
        loop()
      }
    }
    start()
    reducedMotion.addEventListener("change", start)
    return () => {
      cancelAnimationFrame(animRef.current)
      reducedMotion.removeEventListener("change", start)
    }
  }, [vivid, isConnecting])

  return (
    <button
      onClick={() => vivid.startSession()}
      onPointerEnter={() => { hoverRef.current = true }}
      onPointerLeave={() => { hoverRef.current = false }}
      className="relative flex items-center justify-center w-20 h-20 rounded-full
                 cursor-pointer"
      aria-label="Start WorldStreet AI"
      disabled={isConnecting}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-[-50%] w-[200%] h-[200%] pointer-events-none"
      />
      {/* Dark ink on gold — explicit so it never flips in light mode */}
      <MicIcon
        
        size={24}
        className="relative z-10"
        style={{ color: INK_ON_GOLD }} />
    </button>
  )
}
