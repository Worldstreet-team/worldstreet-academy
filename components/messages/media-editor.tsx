"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Cancel01Icon,
  Tick01Icon,
  CropIcon,
  RotateRight01Icon,
  BlurIcon,
  Sun03Icon,
  Infinity01Icon,
  UndoIcon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent } from "@/components/ui/dialog"

type MediaEditorProps = {
  open: boolean
  onClose: () => void
  file: File | null
  type: "image" | "video"
  onSave: (editedFile: File) => void
}

// Custom circular dial control
function CircularDial({
  value,
  onChange,
  min,
  max,
  label,
  icon,
}: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  label: string
  icon: typeof BlurIcon
}) {
  const dialRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const startY = useRef(0)
  const startValue = useRef(0)

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    isDragging.current = true
    startY.current = "touches" in e ? e.touches[0].clientY : e.clientY
    startValue.current = value
    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
    document.addEventListener("touchmove", handleTouchMove)
    document.addEventListener("touchend", handleMouseUp)
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.current) return
    const deltaY = startY.current - e.clientY
    const range = max - min
    const newValue = Math.min(max, Math.max(min, startValue.current + (deltaY / 100) * range))
    onChange(Math.round(newValue))
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging.current) return
    const deltaY = startY.current - e.touches[0].clientY
    const range = max - min
    const newValue = Math.min(max, Math.max(min, startValue.current + (deltaY / 100) * range))
    onChange(Math.round(newValue))
  }

  const handleMouseUp = () => {
    isDragging.current = false
    document.removeEventListener("mousemove", handleMouseMove)
    document.removeEventListener("mouseup", handleMouseUp)
    document.removeEventListener("touchmove", handleTouchMove)
    document.removeEventListener("touchend", handleMouseUp)
  }

  const percentage = ((value - min) / (max - min)) * 100
  const rotation = (percentage / 100) * 270 - 135

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        ref={dialRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
        className="relative w-16 h-16 rounded-full cursor-grab active:cursor-grabbing select-none"
        style={{
          background: "rgba(255, 255, 255, 0.1)",
          backdropFilter: "blur(12px)",
          boxShadow: "inset 0 0 20px rgba(255, 255, 255, 0.05)",
        }}
      >
        {/* Track */}
        <svg className="absolute inset-0 w-full h-full -rotate-135">
          <circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke="rgba(255, 255, 255, 0.15)"
            strokeWidth="3"
            strokeDasharray={`${0.75 * 2 * Math.PI * 28} ${2 * Math.PI * 28}`}
          />
          <circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke="rgba(255, 255, 255, 0.7)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${(percentage / 100) * 0.75 * 2 * Math.PI * 28} ${2 * Math.PI * 28}`}
          />
        </svg>
        {/* Center indicator */}
        <div
          className="absolute top-1/2 left-1/2 w-1.5 h-1.5 rounded-full bg-white"
          style={{
            transform: `translate(-50%, -50%) rotate(${rotation}deg) translateY(-22px)`,
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <HugeiconsIcon icon={icon} size={18} className="text-white/80" />
        </div>
      </div>
      <div className="text-center">
        <p className="text-[10px] text-white/60 uppercase tracking-wider">{label}</p>
        <p className="text-xs text-white font-medium">{value}{label === "Blur" ? "px" : "%"}</p>
      </div>
    </div>
  )
}

export function MediaEditor({ open, onClose, file, type, onSave }: MediaEditorProps) {
  const [rotation, setRotation] = useState(0)
  const [blur, setBlur] = useState(0)
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [showControls, setShowControls] = useState(true)
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)

  const preview = useMemo(() => {
    if (!file) return ""
    return URL.createObjectURL(file)
  }, [file])

  useEffect(() => {
    if (!preview || type !== "image") return
    
    const img = new window.Image()
    img.onload = () => {
      imageRef.current = img
    }
    img.src = preview
    
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview, type])

  const handleRotate = () => setRotation((prev) => (prev + 90) % 360)

  const resetEdits = () => {
    setRotation(0)
    setBlur(0)
    setBrightness(100)
    setContrast(100)
  }

  const hasEdits = rotation !== 0 || blur !== 0 || brightness !== 100 || contrast !== 100

  const applyEdits = () => {
    if (!canvasRef.current || !imageRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const img = imageRef.current
    
    if (rotation === 90 || rotation === 270) {
      canvas.width = img.height
      canvas.height = img.width
    } else {
      canvas.width = img.width
      canvas.height = img.height
    }

    ctx.save()
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.filter = `blur(${blur}px) brightness(${brightness}%) contrast(${contrast}%)`
    ctx.drawImage(img, -img.width / 2, -img.height / 2)
    ctx.restore()
  }

  const handleSave = () => {
    if (type === "image" && canvasRef.current && imageRef.current) {
      applyEdits()
      canvasRef.current.toBlob((blob) => {
        if (blob) {
          const editedFile = new File([blob], file?.name || "edited.jpg", {
            type: "image/jpeg",
          })
          onSave(editedFile)
          onClose()
        }
      }, "image/jpeg", 0.9)
    } else {
      if (file) onSave(file)
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden bg-black/95 border-0">
        {/* Full-screen image with overlaid controls */}
        <div 
          className="relative w-full aspect-3/4 flex items-center justify-center overflow-hidden"
          onClick={() => setShowControls(!showControls)}
        >
          {/* Image */}
          {type === "image" && preview && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={preview}
              alt="Preview"
              className="w-full h-full object-contain transition-all duration-300"
              style={{
                transform: `rotate(${rotation}deg)`,
                filter: `blur(${blur}px) brightness(${brightness}%) contrast(${contrast}%)`,
              }}
            />
          )}
          {type === "video" && preview && (
            <video
              src={preview}
              className="w-full h-full object-contain"
              controls
              style={{ transform: `rotate(${rotation}deg)` }}
            />
          )}
          <canvas ref={canvasRef} className="hidden" />

          {/* Glassmorphic Top Bar */}
          <div
            className={cn(
              "absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-4 transition-all duration-300",
              showControls ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
            )}
            style={{
              background: "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)",
            }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
              style={{
                background: "rgba(255, 255, 255, 0.1)",
                backdropFilter: "blur(12px)",
              }}
            >
              <HugeiconsIcon icon={Cancel01Icon} size={20} className="text-white" />
            </button>

            <div className="flex items-center gap-3">
              {hasEdits && (
                <button
                  onClick={(e) => { e.stopPropagation(); resetEdits(); }}
                  className="w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
                  style={{
                    background: "rgba(255, 255, 255, 0.1)",
                    backdropFilter: "blur(12px)",
                  }}
                >
                  <HugeiconsIcon icon={UndoIcon} size={18} className="text-white" />
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); handleSave(); }}
                className="h-10 px-5 rounded-full flex items-center gap-2 transition-colors hover:bg-white/20"
                style={{
                  background: "rgba(255, 255, 255, 0.15)",
                  backdropFilter: "blur(12px)",
                }}
              >
                <HugeiconsIcon icon={Tick01Icon} size={18} className="text-white" />
                <span className="text-white text-sm font-medium">Done</span>
              </button>
            </div>
          </div>

          {/* Glassmorphic Bottom Controls */}
          <div
            className={cn(
              "absolute bottom-0 left-0 right-0 transition-all duration-300",
              showControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Adjustment Dials */}
            <div
              className="mx-4 mb-4 px-4 py-5 rounded-2xl"
              style={{
                background: "rgba(0, 0, 0, 0.4)",
                backdropFilter: "blur(20px)",
              }}
            >
              <div className="flex items-center justify-around">
                <CircularDial
                  value={blur}
                  onChange={setBlur}
                  min={0}
                  max={20}
                  label="Blur"
                  icon={BlurIcon}
                />
                <CircularDial
                  value={brightness}
                  onChange={setBrightness}
                  min={50}
                  max={150}
                  label="Brightness"
                  icon={Sun03Icon}
                />
                <CircularDial
                  value={contrast}
                  onChange={setContrast}
                  min={50}
                  max={150}
                  label="Contrast"
                  icon={Infinity01Icon}
                />
              </div>
            </div>

            {/* Quick Actions */}
            <div
              className="flex items-center justify-center gap-6 pb-6 pt-2"
              style={{
                background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)",
              }}
            >
              <button
                onClick={handleRotate}
                className="flex flex-col items-center gap-1.5 group"
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center transition-all group-hover:scale-105"
                  style={{
                    background: "rgba(255, 255, 255, 0.1)",
                    backdropFilter: "blur(12px)",
                  }}
                >
                  <HugeiconsIcon icon={RotateRight01Icon} size={22} className="text-white" />
                </div>
                <span className="text-[10px] text-white/70 uppercase tracking-wider">Rotate</span>
              </button>

              <button
                onClick={() => {}}
                className="flex flex-col items-center gap-1.5 group opacity-50"
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center transition-all"
                  style={{
                    background: "rgba(255, 255, 255, 0.1)",
                    backdropFilter: "blur(12px)",
                  }}
                >
                  <HugeiconsIcon icon={CropIcon} size={22} className="text-white" />
                </div>
                <span className="text-[10px] text-white/70 uppercase tracking-wider">Crop</span>
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
