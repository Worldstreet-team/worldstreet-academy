"use client"

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { Button } from "@/components/ui/button"
import { saveSignature } from "@/lib/actions/signature"
import { getImageUploadUrl } from "@/lib/actions/upload"
import { cn } from "@/lib/utils"
import { CheckIcon, EraserIcon, PencilLineIcon, Trash2Icon, UploadIcon, XIcon } from "lucide-react"

type Tool = "pen" | "eraser"
type PenSize = 2 | 3 | 5

const PEN_SIZES: { value: PenSize; label: string }[] = [
  { value: 2, label: "S" },
  { value: 3, label: "M" },
  { value: 5, label: "L" },
]

export function SignatureCanvas({
  currentSignatureUrl,
  onSave,
  onCancel,
  compact = false,
}: {
  currentSignatureUrl: string | null
  onSave: (url: string) => void
  onCancel?: () => void
  compact?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasContent, setHasContent] = useState(false)
  const [tool, setTool] = useState<Tool>("pen")
  const [penSize, setPenSize] = useState<PenSize>(3)
  const [isSaving, setIsSaving] = useState(false)
  const lastPoint = useRef<{ x: number; y: number } | null>(null)

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1

    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.scale(dpr, dpr)
    ctx.lineCap = "round"
    ctx.lineJoin = "round"

    // Fill with white/transparent
    ctx.clearRect(0, 0, rect.width, rect.height)
  }, [])

  const getCanvasPoint = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }
    },
    []
  )

  const startDrawing = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      const point = getCanvasPoint(e)
      if (!point) return
      setIsDrawing(true)
      lastPoint.current = point

      const canvas = canvasRef.current
      const ctx = canvas?.getContext("2d")
      if (!ctx) return

      if (tool === "pen") {
        ctx.globalCompositeOperation = "source-over"
        ctx.strokeStyle = "#1a1a1a" // signature ink — near-black pen on the paper pad, matches print output
        ctx.lineWidth = penSize
      } else {
        ctx.globalCompositeOperation = "destination-out"
        ctx.lineWidth = penSize * 6
      }

      ctx.beginPath()
      ctx.moveTo(point.x, point.y)
    },
    [tool, penSize, getCanvasPoint]
  )

  const draw = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return

      const point = getCanvasPoint(e)
      if (!point || !lastPoint.current) return

      const canvas = canvasRef.current
      const ctx = canvas?.getContext("2d")
      if (!ctx) return

      ctx.beginPath()
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y)

      // Quadratic smoothing
      const midX = (lastPoint.current.x + point.x) / 2
      const midY = (lastPoint.current.y + point.y) / 2
      ctx.quadraticCurveTo(lastPoint.current.x, lastPoint.current.y, midX, midY)
      ctx.stroke()

      lastPoint.current = point
      setHasContent(true)
    },
    [isDrawing, getCanvasPoint]
  )

  const stopDrawing = useCallback(() => {
    setIsDrawing(false)
    lastPoint.current = null
  }, [])

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)
    setHasContent(false)
  }, [])

  const handleSave = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas || !hasContent) return

    setIsSaving(true)
    try {
      // Export to blob
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      )
      if (!blob) throw new Error("Failed to export canvas")

      const file = new File([blob], "signature.png", { type: "image/png" })

      const result = await getImageUploadUrl(file.name, file.type)
      if (!result.success || !result.uploadUrl || !result.publicUrl) {
        throw new Error("Failed to get upload URL")
      }

      await fetch(result.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      })

      await saveSignature(result.publicUrl)
      onSave(result.publicUrl)
    } catch (error) {
      console.error("Signature save error:", error)
    } finally {
      setIsSaving(false)
    }
  }, [hasContent, onSave])

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return
    setIsSaving(true)
    try {
      const result = await getImageUploadUrl(file.name, file.type)
      if (!result.success || !result.uploadUrl || !result.publicUrl) {
        throw new Error("Failed to get upload URL")
      }
      await fetch(result.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      })
      await saveSignature(result.publicUrl)
      onSave(result.publicUrl)
    } catch (error) {
      console.error("Signature upload error:", error)
    } finally {
      setIsSaving(false)
    }
  }, [onSave])

  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className={cn("space-y-3", compact ? "w-full" : "w-full max-w-md")}>
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {/* Pen / Eraser toggle */}
          <button
            onClick={() => setTool("pen")}
            className={cn(
              "p-2 rounded-lg transition-all duration-[var(--ws-motion-base)]",
              tool === "pen"
                ? "bg-ws-primary text-ws-page"
                : "text-ws-muted hover:text-ws-primary hover:bg-ws-chip"
            )}
            title="Pen"
          >
            <PencilLineIcon  size={16} />
          </button>
          <button
            onClick={() => setTool("eraser")}
            className={cn(
              "p-2 rounded-lg transition-all duration-[var(--ws-motion-base)]",
              tool === "eraser"
                ? "bg-ws-primary text-ws-page"
                : "text-ws-muted hover:text-ws-primary hover:bg-ws-chip"
            )}
            title="Eraser"
          >
            <EraserIcon  size={16} />
          </button>

          {/* Divider */}
          <div className="w-px h-5 bg-ws-track mx-1" />

          {/* Pen sizes */}
          {PEN_SIZES.map((s) => (
            <button
              key={s.value}
              onClick={() => setPenSize(s.value)}
              className={cn(
                "w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-[var(--ws-motion-base)] text-[10px] font-semibold",
                penSize === s.value
                  ? "bg-ws-primary text-ws-page"
                  : "text-ws-muted hover:text-ws-primary hover:bg-ws-chip"
              )}
              title={`Size ${s.label}`}
            >
              <div
                className={cn(
                  "rounded-full bg-current",
                  s.value === 2 && "w-1 h-1",
                  s.value === 3 && "w-1.5 h-1.5",
                  s.value === 5 && "w-2.5 h-2.5"
                )}
              />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={clearCanvas}
            className="p-2 rounded-lg text-ws-muted hover:text-ws-danger hover:bg-ws-danger/15 transition-all duration-[var(--ws-motion-base)]"
            title="Clear"
          >
            <Trash2Icon  size={16} />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className={cn(
          "relative rounded-lg border-2 border-dashed border-ws-hairline bg-ws-sunken overflow-hidden",
          isDrawing && "border-ws-subtle",
          compact ? "h-28" : "h-36"
        )}
      >
        <canvas
          ref={canvasRef}
          className={cn(
            "absolute inset-0 w-full h-full",
            tool === "pen" ? "cursor-crosshair" : "cursor-cell"
          )}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
          style={{ touchAction: "none" }}
        />

        {/* Guide line */}
        <div className="absolute bottom-6 left-8 right-8 h-px bg-ws-track pointer-events-none" />

        {/* Placeholder text */}
        {!hasContent && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-ws-subtle text-sm font-light tracking-wide">
              Sign here
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs text-ws-muted hover:text-ws-primary transition-colors"
          >
            <UploadIcon  size={14} />
            Upload instead
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileUpload(file)
              e.target.value = ""
            }}
          />
        </div>

        <div className="flex items-center gap-2">
          {onCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="gap-1 text-xs h-8"
            >
              <XIcon  size={14} />
              Cancel
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasContent || isSaving}
            className="gap-1 text-xs h-8"
          >
            {isSaving ? (
              <svg
                className="animate-spin h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              <CheckIcon  size={14} />
            )}
            Save Signature
          </Button>
        </div>
      </div>
    </div>
  )
}
