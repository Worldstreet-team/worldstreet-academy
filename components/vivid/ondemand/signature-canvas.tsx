"use client"

import { useRef, useState, useEffect } from "react"
import { motion } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { PencilEdit01Icon } from "@hugeicons/core-free-icons"
import { useVivid } from "@/lib/vivid/provider"

export function SignatureCanvasUI() {
  const vivid = useVivid()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const [isSaving, setIsSaving] = useState(false)

  const getCtx = () => canvasRef.current?.getContext("2d") || null

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    canvas.width = canvas.offsetWidth * 2
    canvas.height = canvas.offsetHeight * 2
    ctx.scale(2, 2)
    const isDark = document.documentElement.classList.contains("dark")
    ctx.strokeStyle = isDark ? "rgba(255,255,255,0.8)" : "rgba(20,20,20,0.85)"
    ctx.lineWidth = 2.5
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
  }, [])

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  return (
    <div className="space-y-4">
      <canvas
        ref={canvasRef}
        className="w-full h-40 rounded-2xl border border-border/50 bg-zinc-900 dark:bg-background cursor-crosshair touch-none"
        onMouseDown={(e) => {
          isDrawing.current = true
          const ctx = getCtx()
          const { x, y } = getPos(e)
          ctx?.beginPath()
          ctx?.moveTo(x, y)
        }}
        onMouseMove={(e) => {
          if (!isDrawing.current) return
          const ctx = getCtx()
          const { x, y } = getPos(e)
          ctx?.lineTo(x, y)
          ctx?.stroke()
        }}
        onMouseUp={() => { isDrawing.current = false }}
        onMouseLeave={() => { isDrawing.current = false }}
        onTouchStart={(e) => {
          e.preventDefault()
          isDrawing.current = true
          const ctx = getCtx()
          const { x, y } = getPos(e)
          ctx?.beginPath()
          ctx?.moveTo(x, y)
        }}
        onTouchMove={(e) => {
          e.preventDefault()
          if (!isDrawing.current) return
          const ctx = getCtx()
          const { x, y } = getPos(e)
          ctx?.lineTo(x, y)
          ctx?.stroke()
        }}
        onTouchEnd={() => { isDrawing.current = false }}
      />
      <div className="flex gap-2">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            const ctx = getCtx()
            if (ctx && canvasRef.current) {
              ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
            }
          }}
          className="flex-1 py-2.5 px-3 rounded-xl text-sm font-medium bg-accent/40
                     hover:bg-accent/60 transition-colors"
        >
          Clear
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          disabled={isSaving}
          onClick={async () => {
            const dataUrl = canvasRef.current?.toDataURL("image/png")
            if (dataUrl) {
              setIsSaving(true)
              vivid.resolveUI({ signatureDataUrl: dataUrl })
            }
          }}
          className="flex-1 py-2.5 px-3 rounded-xl text-sm font-medium bg-foreground text-background
                     hover:bg-foreground/90 transition-colors flex items-center justify-center gap-2
                     disabled:opacity-50"
        >
          {isSaving ? (
            <span className="inline-block w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
          ) : (
            <HugeiconsIcon icon={PencilEdit01Icon} size={14} />
          )}
          {isSaving ? "Saving…" : "Save"}
        </motion.button>
      </div>
    </div>
  )
}
