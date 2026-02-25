"use client"

/**
 * Vivid On-Demand UI — File upload, signature canvas, confirmation, rating, language picker.
 */

import { useRef, useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Cancel01Icon,
  Upload04Icon,
  PencilEdit01Icon,
  Tick02Icon,
  Globe02Icon,
  StarIcon,
} from "@hugeicons/core-free-icons"
import { useVivid } from "@/lib/vivid/provider"
import type { OnDemandUI } from "@/lib/vivid/types"

const LANG_OPTIONS = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "pt", label: "Português" },
  { code: "zh", label: "中文" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "ar", label: "العربية" },
  { code: "hi", label: "हिन्दी" },
]

export function OnDemandUIPanel({ ui }: { ui: OnDemandUI }) {
  const vivid = useVivid()

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">{ui.title}</h3>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => vivid.dismissUI()}
          className="p-1.5 rounded-lg hover:bg-accent/50 text-muted-foreground"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={16} />
        </motion.button>
      </div>
      {ui.description && (
        <p className="text-sm text-muted-foreground">{ui.description}</p>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={ui.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          <OnDemandUIContent ui={ui} />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function OnDemandUIContent({ ui }: { ui: OnDemandUI }) {
  switch (ui.type) {
    case "file-upload":
      return <FileUploadUI />
    case "signature-canvas":
      return <SignatureCanvasUI />
    case "confirmation":
      return <ConfirmationUI ui={ui} />
    case "rating":
      return <RatingUI />
    case "language-picker":
      return <LanguagePickerUI />
    default:
      return <p className="text-sm text-muted-foreground">Unknown UI type.</p>
  }
}

// ──── File Upload ────

function FileUploadUI() {
  const vivid = useVivid()
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      vivid.resolveUI({ fileName: file.name, dataUrl: reader.result, type: file.type })
    }
    reader.readAsDataURL(file)
  }, [vivid])

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setIsDragging(false)
        const file = e.dataTransfer.files[0]
        if (file) handleFile(file)
      }}
      onClick={() => inputRef.current?.click()}
      className={`
        flex flex-col items-center justify-center gap-3 p-8 rounded-xl
        border-2 border-dashed cursor-pointer transition-colors
        ${isDragging ? "border-foreground/50 bg-white/5" : "border-border/50 hover:border-foreground/30"}
      `}
    >
      <HugeiconsIcon icon={Upload04Icon} size={32} className="text-muted-foreground" />
      <p className="text-sm text-muted-foreground text-center">
        {isDragging ? "Drop it here" : "Click or drag a file"}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />
    </div>
  )
}

// ──── Signature Canvas ────

function SignatureCanvasUI() {
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
    ctx.strokeStyle = "rgba(255,255,255,0.7)"
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
        className="w-full h-40 rounded-xl border border-border/50 bg-background cursor-crosshair touch-none"
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
          className="flex-1 py-2 px-3 rounded-lg text-sm bg-muted hover:bg-accent transition-colors"
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
          className="flex-1 py-2 px-3 rounded-lg text-sm bg-foreground text-background hover:bg-foreground/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
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

// ──── Confirmation ────

function ConfirmationUI({ ui }: { ui: OnDemandUI }) {
  const vivid = useVivid()

  return (
    <div className="space-y-4">
      <p className="text-sm text-foreground/80 leading-relaxed">
        {ui.config?.message as string || "Are you sure?"}
      </p>
      <div className="flex gap-2">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => vivid.resolveUI({ confirmed: false })}
          className="flex-1 py-2.5 px-3 rounded-lg text-sm bg-muted hover:bg-accent transition-colors"
        >
          Cancel
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => vivid.resolveUI({ confirmed: true })}
          className="flex-1 py-2.5 px-3 rounded-lg text-sm bg-foreground text-background hover:bg-foreground/90 transition-colors flex items-center justify-center gap-2"
        >
          <HugeiconsIcon icon={Tick02Icon} size={14} /> Confirm
        </motion.button>
      </div>
    </div>
  )
}

// ──── Rating ────

function RatingUI() {
  const vivid = useVivid()
  const [rating, setRating] = useState(0)
  const [hoveredStar, setHoveredStar] = useState(0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <motion.button
            key={star}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            onMouseEnter={() => setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(0)}
            onClick={() => setRating(star)}
            className="p-1 cursor-pointer"
          >
            <HugeiconsIcon
              icon={StarIcon}
              size={32}
              className={`transition-colors ${
                star <= (hoveredStar || rating)
                  ? "text-amber-400 fill-amber-400"
                  : "text-muted-foreground/30"
              }`}
            />
          </motion.button>
        ))}
      </div>
      {rating > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => vivid.resolveUI({ rating })}
            className="w-full py-2.5 rounded-lg text-sm bg-foreground text-background hover:bg-foreground/90 transition-colors"
          >
            Submit {rating} star{rating !== 1 ? "s" : ""}
          </motion.button>
        </motion.div>
      )}
    </div>
  )
}

// ──── Language Picker ────

function LanguagePickerUI() {
  const vivid = useVivid()

  return (
    <div className="space-y-2">
      {LANG_OPTIONS.map((lang) => (
        <motion.button
          key={lang.code}
          whileHover={{ scale: 1.01, x: 4 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => vivid.resolveUI({ languageCode: lang.code })}
          className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-accent/50
                     border border-transparent hover:border-white/15 transition-all text-left"
        >
          <HugeiconsIcon icon={Globe02Icon} size={16} className="text-foreground/70 shrink-0" />
          <span className="text-sm font-medium">{lang.label}</span>
          <span className="text-xs text-muted-foreground ml-auto">{lang.code}</span>
        </motion.button>
      ))}
    </div>
  )
}
