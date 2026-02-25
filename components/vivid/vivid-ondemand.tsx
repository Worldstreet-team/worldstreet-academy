"use client"

/**
 * Vivid On-Demand UI — 9 interactive panels:
 * file-upload, signature-canvas, confirmation, rating, language-picker,
 * bookmark-toggle, progress-dashboard, contact-card, checkout-confirm.
 *
 * Modern, theme-aware, clean — no gradients.
 */

import Image from "next/image"
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
  Bookmark01Icon,
  Bookmark02Icon,
  UserIcon,
  BubbleChatIcon,
  Call02Icon,
  VideoReplayIcon,
  ShoppingCart01Icon,
  CheckmarkCircle02Icon,
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
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground tracking-tight">{ui.title}</h3>
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
        <p className="text-sm text-muted-foreground leading-relaxed">{ui.description}</p>
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
    case "bookmark-toggle":
      return <BookmarkToggleUI ui={ui} />
    case "progress-dashboard":
      return <ProgressDashboardUI ui={ui} />
    case "contact-card":
      return <ContactCardUI ui={ui} />
    case "checkout-confirm":
      return <CheckoutConfirmUI ui={ui} />
    default:
      return <p className="text-sm text-muted-foreground">Unknown UI type.</p>
  }
}

// ──────────────────────────────────────────────────────────────────────
// File Upload
// ──────────────────────────────────────────────────────────────────────

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
        flex flex-col items-center justify-center gap-3 p-8 rounded-2xl
        border-2 border-dashed cursor-pointer transition-all duration-200
        ${isDragging
          ? "border-foreground/40 bg-accent/30"
          : "border-border/50 hover:border-foreground/25 hover:bg-accent/10"
        }
      `}
    >
      <div className="p-3 rounded-xl bg-accent/40">
        <HugeiconsIcon icon={Upload04Icon} size={24} className="text-foreground/60" />
      </div>
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

// ──────────────────────────────────────────────────────────────────────
// Signature Canvas
// ──────────────────────────────────────────────────────────────────────

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
        className="w-full h-40 rounded-2xl border border-border/50 bg-background cursor-crosshair touch-none"
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

// ──────────────────────────────────────────────────────────────────────
// Confirmation
// ──────────────────────────────────────────────────────────────────────

function ConfirmationUI({ ui }: { ui: OnDemandUI }) {
  const vivid = useVivid()

  return (
    <div className="space-y-5">
      <div className="p-4 rounded-2xl bg-accent/20 border border-border/30">
        <p className="text-sm text-foreground/80 leading-relaxed">
          {ui.config?.message as string || "Are you sure?"}
        </p>
      </div>
      <div className="flex gap-2">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => vivid.resolveUI({ confirmed: false })}
          className="flex-1 py-2.5 px-3 rounded-xl text-sm font-medium bg-accent/40
                     hover:bg-accent/60 transition-colors"
        >
          Cancel
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => vivid.resolveUI({ confirmed: true })}
          className="flex-1 py-2.5 px-3 rounded-xl text-sm font-medium bg-foreground text-background
                     hover:bg-foreground/90 transition-colors flex items-center justify-center gap-2"
        >
          <HugeiconsIcon icon={Tick02Icon} size={14} /> Confirm
        </motion.button>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// Rating
// ──────────────────────────────────────────────────────────────────────

function RatingUI() {
  const vivid = useVivid()
  const [rating, setRating] = useState(0)
  const [hoveredStar, setHoveredStar] = useState(0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-center gap-3 py-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <motion.button
            key={star}
            whileHover={{ scale: 1.25, y: -2 }}
            whileTap={{ scale: 0.9 }}
            onMouseEnter={() => setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(0)}
            onClick={() => setRating(star)}
            className="p-1 cursor-pointer"
          >
            <HugeiconsIcon
              icon={StarIcon}
              size={32}
              className={`transition-colors duration-150 ${
                star <= (hoveredStar || rating)
                  ? "text-amber-400 fill-amber-400"
                  : "text-muted-foreground/20"
              }`}
            />
          </motion.button>
        ))}
      </div>
      {rating > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-center text-xs text-muted-foreground mb-3">
            {rating === 5 ? "Excellent!" : rating === 4 ? "Great!" : rating === 3 ? "Good" : rating === 2 ? "Fair" : "Poor"}
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => vivid.resolveUI({ rating })}
            className="w-full py-2.5 rounded-xl text-sm font-medium bg-foreground text-background
                       hover:bg-foreground/90 transition-colors"
          >
            Submit {rating} star{rating !== 1 ? "s" : ""}
          </motion.button>
        </motion.div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// Language Picker
// ──────────────────────────────────────────────────────────────────────

function LanguagePickerUI() {
  const vivid = useVivid()

  return (
    <div className="space-y-1.5 max-h-80 overflow-y-auto">
      {LANG_OPTIONS.map((lang, i) => (
        <motion.button
          key={lang.code}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.03 }}
          whileHover={{ x: 4 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => vivid.resolveUI({ languageCode: lang.code })}
          className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-accent/40
                     border border-transparent hover:border-border/40 transition-all text-left"
        >
          <HugeiconsIcon icon={Globe02Icon} size={16} className="text-foreground/50 shrink-0" />
          <span className="text-sm font-medium">{lang.label}</span>
          <span className="text-xs text-muted-foreground ml-auto uppercase tracking-wider">{lang.code}</span>
        </motion.button>
      ))}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// Bookmark Toggle (A1) — Course card with animated bookmark icon
// ──────────────────────────────────────────────────────────────────────

function BookmarkToggleUI({ ui }: { ui: OnDemandUI }) {
  const vivid = useVivid()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config = parseConfig(ui.config as any)
  const [isBookmarked, setIsBookmarked] = useState(config.isBookmarked === true)
  const [isSaving, setIsSaving] = useState(false)

  const handleToggle = async () => {
    setIsSaving(true)
    const newState = !isBookmarked
    setIsBookmarked(newState)
    await new Promise((r) => setTimeout(r, 300))
    vivid.resolveUI({ courseId: config.courseId, isBookmarked: newState })
  }

  return (
    <div className="space-y-4">
      {/* Course card */}
      <div className="rounded-2xl overflow-hidden border border-border/30 bg-card/60">
        {config.thumbnailUrl && (
          <div className="relative w-full aspect-2/1 bg-muted">
            <Image
              src={config.thumbnailUrl}
              alt={config.courseTitle || ""}
              fill
              className="object-cover"
              sizes="400px"
            />
          </div>
        )}
        <div className="p-4">
          <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
            {config.courseTitle || "Course"}
          </p>
        </div>
      </div>

      {/* Toggle button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        disabled={isSaving}
        onClick={handleToggle}
        className={`
          w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-sm font-medium
          transition-all duration-200 disabled:opacity-60
          ${isBookmarked
            ? "bg-foreground text-background"
            : "bg-accent/40 text-foreground hover:bg-accent/60"
          }
        `}
      >
        <motion.div
          animate={isBookmarked ? { scale: [1, 1.3, 1], rotate: [0, -10, 10, 0] } : {}}
          transition={{ duration: 0.4 }}
        >
          <HugeiconsIcon
            icon={isBookmarked ? Bookmark02Icon : Bookmark01Icon}
            size={18}
            className={isBookmarked ? "fill-current" : ""}
          />
        </motion.div>
        {isSaving ? "Saving…" : isBookmarked ? "Bookmarked" : "Bookmark this course"}
      </motion.button>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// Progress Dashboard (A2) — Visual progress ring + lesson checklist
// ──────────────────────────────────────────────────────────────────────

function ProgressDashboardUI({ ui }: { ui: OnDemandUI }) {
  const vivid = useVivid()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config = parseConfig(ui.config as any)
  const [progress, setProgress] = useState<{
    overallProgress: number
    completedCount: number
    totalLessons: number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lessons: any[]
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const { executeVividFunction } = await import("@/lib/vivid/actions")
        const result = await executeVividFunction("getCompletedLessons", { courseId: config.courseId })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = result as any
        if (r?.success) {
          setProgress({
            overallProgress: Math.round((r.completedCount / Math.max(r.totalLessons, 1)) * 100),
            completedCount: r.completedCount,
            totalLessons: r.totalLessons,
            lessons: r.lessons || [],
          })
        }
      } catch {
        // Fallback: empty state
      } finally {
        setIsLoading(false)
      }
    }
    fetchProgress()
  }, [config.courseId])

  const pct = progress?.overallProgress || 0
  const circumference = 2 * Math.PI * 42

  return (
    <div className="space-y-5">
      {/* Course header */}
      <div className="flex items-center gap-3">
        {config.thumbnailUrl && (
          <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-muted shrink-0">
            <Image src={config.thumbnailUrl} alt="" fill className="object-cover" sizes="48px" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{config.courseTitle || "Course"}</p>
          <p className="text-xs text-muted-foreground">
            {progress ? `${progress.completedCount} of ${progress.totalLessons} lessons` : "Loading…"}
          </p>
        </div>
      </div>

      {/* Progress ring */}
      <div className="flex justify-center py-2">
        <div className="relative w-28 h-28">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle
              cx="50" cy="50" r="42"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              className="text-accent/30"
            />
            <motion.circle
              cx="50" cy="50" r="42"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
              className="text-foreground"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: circumference - (circumference * pct) / 100 }}
              transition={{ duration: 1, ease: "circOut", delay: 0.3 }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-2xl font-bold text-foreground tabular-nums"
            >
              {isLoading ? "—" : `${pct}%`}
            </motion.span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">complete</span>
          </div>
        </div>
      </div>

      {/* Lesson checklist */}
      {progress && progress.lessons.length > 0 && (
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {progress.lessons.map((lesson, i) => (
            <motion.div
              key={lesson.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.04 }}
              className={`
                flex items-center gap-3 p-2.5 rounded-xl text-sm
                ${lesson.isCompleted
                  ? "bg-accent/20 text-foreground/60"
                  : "bg-card/40 text-foreground"
                }
              `}
            >
              <div className={`
                w-5 h-5 rounded-full flex items-center justify-center shrink-0 border
                ${lesson.isCompleted
                  ? "bg-foreground text-background border-foreground"
                  : "border-border/60"
                }
              `}>
                {lesson.isCompleted && <HugeiconsIcon icon={Tick02Icon} size={10} />}
              </div>
              <span className={`flex-1 truncate ${lesson.isCompleted ? "line-through" : ""}`}>
                {lesson.title}
              </span>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {lesson.order}
              </span>
            </motion.div>
          ))}
        </div>
      )}

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => vivid.resolveUI({ acknowledged: true, progress: pct })}
        className="w-full py-2.5 rounded-xl text-sm font-medium bg-accent/40
                   hover:bg-accent/60 transition-colors"
      >
        Got it
      </motion.button>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// Contact Card (A5) — User profile with message/call actions
// ──────────────────────────────────────────────────────────────────────

function ContactCardUI({ ui }: { ui: OnDemandUI }) {
  const vivid = useVivid()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config = parseConfig(ui.config as any)

  return (
    <div className="space-y-5">
      {/* Profile section */}
      <div className="flex flex-col items-center text-center pt-2">
        <div className="relative w-20 h-20 rounded-full overflow-hidden bg-accent/30 mb-3 ring-2 ring-border/20 ring-offset-2 ring-offset-background">
          {config.userAvatar ? (
            <Image src={config.userAvatar} alt="" fill className="object-cover" sizes="80px" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <HugeiconsIcon icon={UserIcon} size={32} className="text-muted-foreground/50" />
            </div>
          )}
        </div>
        <p className="text-base font-semibold text-foreground">{config.userName || "User"}</p>
        {config.role && (
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground mt-0.5 px-2 py-0.5 rounded-md bg-accent/30">
            {config.role}
          </span>
        )}
        {config.bio && (
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed line-clamp-3 max-w-65">
            {config.bio}
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => vivid.resolveUI({ action: "message", userId: config.userId })}
          className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl
                     text-sm font-medium bg-accent/40 hover:bg-accent/60 transition-colors"
        >
          <HugeiconsIcon icon={BubbleChatIcon} size={16} />
          Message
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => vivid.resolveUI({ action: "call", userId: config.userId, callType: "audio" })}
          className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl
                     text-sm font-medium bg-foreground text-background hover:bg-foreground/90
                     transition-colors"
        >
          <HugeiconsIcon icon={Call02Icon} size={16} />
          Call
        </motion.button>
      </div>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => vivid.resolveUI({ action: "video-call", userId: config.userId, callType: "video" })}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl
                   text-sm font-medium bg-accent/20 hover:bg-accent/40 transition-colors"
      >
        <HugeiconsIcon icon={VideoReplayIcon} size={16} />
        Video Call
      </motion.button>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// Checkout Confirm (A6) — Purchase confirmation card
// ──────────────────────────────────────────────────────────────────────

function CheckoutConfirmUI({ ui }: { ui: OnDemandUI }) {
  const vivid = useVivid()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config = parseConfig(ui.config as any)
  const [isPurchasing, setIsPurchasing] = useState(false)
  const price = Number(config.price) || 0
  const balance = Number(config.walletBalance) || 0
  const canAfford = balance >= price

  return (
    <div className="space-y-5">
      {/* Course preview */}
      <div className="rounded-2xl overflow-hidden border border-border/30 bg-card/60">
        {config.thumbnailUrl && (
          <div className="relative w-full aspect-2/1 bg-muted">
            <Image
              src={config.thumbnailUrl}
              alt={config.courseTitle || ""}
              fill
              className="object-cover"
              sizes="400px"
            />
          </div>
        )}
        <div className="p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground leading-snug">
            {config.courseTitle || "Course"}
          </p>

          {/* Price breakdown */}
          <div className="space-y-2 pt-2 border-t border-border/20">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Price</span>
              <span className="font-semibold text-foreground">${price.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Wallet balance</span>
              <span className={`font-medium ${canAfford ? "text-foreground" : "text-destructive"}`}>
                ${balance.toFixed(2)}
              </span>
            </div>
            <div className="h-px bg-border/30" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">After purchase</span>
              <span className="font-semibold text-foreground">
                ${canAfford ? (balance - price).toFixed(2) : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Insufficient balance warning */}
      {!canAfford && (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20">
          <p className="text-xs text-destructive">
            Insufficient balance. You need ${(price - balance).toFixed(2)} more.
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => vivid.resolveUI({ confirmed: false })}
          className="flex-1 py-3 px-4 rounded-xl text-sm font-medium bg-accent/40
                     hover:bg-accent/60 transition-colors"
        >
          Cancel
        </motion.button>
        <motion.button
          whileHover={canAfford ? { scale: 1.02 } : {}}
          whileTap={canAfford ? { scale: 0.98 } : {}}
          disabled={!canAfford || isPurchasing}
          onClick={async () => {
            setIsPurchasing(true)
            vivid.resolveUI({ confirmed: true, courseId: config.courseId })
          }}
          className={`
            flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-medium
            transition-colors disabled:opacity-40
            ${canAfford
              ? "bg-foreground text-background hover:bg-foreground/90"
              : "bg-muted text-muted-foreground cursor-not-allowed"
            }
          `}
        >
          {isPurchasing ? (
            <span className="inline-block w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
          ) : (
            <HugeiconsIcon icon={canAfford ? ShoppingCart01Icon : CheckmarkCircle02Icon} size={16} />
          )}
          {isPurchasing ? "Processing…" : canAfford ? `Pay $${price.toFixed(2)}` : "Insufficient funds"}
        </motion.button>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// Config parser helper
// ──────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseConfig(config: any): Record<string, any> {
  if (!config) return {}
  if (typeof config === "string") {
    try { return JSON.parse(config) } catch { return {} }
  }
  return config
}
