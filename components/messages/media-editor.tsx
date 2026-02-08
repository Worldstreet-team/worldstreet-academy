"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Cancel01Icon,
  Tick01Icon,
  CropIcon,
  RotateRight01Icon,
  BlurIcon,
  FilterIcon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent } from "@/components/ui/dialog"

type MediaEditorProps = {
  open: boolean
  onClose: () => void
  file: File | null
  type: "image" | "video"
  onSave: (editedFile: File) => void
}

type EditMode = "crop" | "rotate" | "blur" | "filter" | null

export function MediaEditor({ open, onClose, file, type, onSave }: MediaEditorProps) {
  const [editMode, setEditMode] = useState<EditMode>(null)
  const [rotation, setRotation] = useState(0)
  const [blur, setBlur] = useState(0)
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  
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

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360)
  }

  const applyEdits = () => {
    if (!canvasRef.current || !imageRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const img = imageRef.current
    
    // Set canvas size based on rotation
    if (rotation === 90 || rotation === 270) {
      canvas.width = img.height
      canvas.height = img.width
    } else {
      canvas.width = img.width
      canvas.height = img.height
    }

    // Apply transforms
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
      // For video, just close (video editing would need more complex logic)
      if (file) onSave(file)
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <Button size="icon" variant="ghost" onClick={onClose}>
            <HugeiconsIcon icon={Cancel01Icon} size={20} />
          </Button>
          <span className="font-medium">Edit {type === "image" ? "Photo" : "Video"}</span>
          <Button size="icon" variant="ghost" onClick={handleSave}>
            <HugeiconsIcon icon={Tick01Icon} size={20} />
          </Button>
        </div>

        {/* Preview */}
        <div className="relative bg-black aspect-square flex items-center justify-center overflow-hidden">
          {type === "image" && preview && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={preview}
              alt="Preview"
              className="max-w-full max-h-full object-contain transition-all"
              style={{
                transform: `rotate(${rotation}deg)`,
                filter: `blur(${blur}px) brightness(${brightness}%) contrast(${contrast}%)`,
              }}
            />
          )}
          {type === "video" && preview && (
            <video
              src={preview}
              className="max-w-full max-h-full object-contain"
              controls
              style={{
                transform: `rotate(${rotation}deg)`,
              }}
            />
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Edit Controls */}
        {editMode && (
          <div className="p-4 border-t">
            {editMode === "rotate" && (
              <div className="flex justify-center">
                <Button variant="outline" onClick={handleRotate}>
                  Rotate 90°
                </Button>
              </div>
            )}
            {editMode === "blur" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Blur: {blur}px</label>
                <Slider
                  value={[blur]}
                  onValueChange={(v) => setBlur(Array.isArray(v) ? v[0] : v)}
                  max={20}
                  step={1}
                />
              </div>
            )}
            {editMode === "filter" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Brightness: {brightness}%</label>
                  <Slider
                    value={[brightness]}
                    onValueChange={(v) => setBrightness(Array.isArray(v) ? v[0] : v)}
                    min={50}
                    max={150}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Contrast: {contrast}%</label>
                  <Slider
                    value={[contrast]}
                    onValueChange={(v) => setContrast(Array.isArray(v) ? v[0] : v)}
                    min={50}
                    max={150}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tools */}
        <div className="flex items-center justify-around p-3 border-t bg-muted/30">
          <button
            onClick={() => setEditMode(editMode === "crop" ? null : "crop")}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors",
              editMode === "crop" ? "bg-primary/10 text-primary" : "hover:bg-muted"
            )}
          >
            <HugeiconsIcon icon={CropIcon} size={20} />
            <span className="text-xs">Crop</span>
          </button>
          <button
            onClick={() => {
              setEditMode("rotate")
              handleRotate()
            }}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors",
              editMode === "rotate" ? "bg-primary/10 text-primary" : "hover:bg-muted"
            )}
          >
            <HugeiconsIcon icon={RotateRight01Icon} size={20} />
            <span className="text-xs">Rotate</span>
          </button>
          <button
            onClick={() => setEditMode(editMode === "blur" ? null : "blur")}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors",
              editMode === "blur" ? "bg-primary/10 text-primary" : "hover:bg-muted"
            )}
          >
            <HugeiconsIcon icon={BlurIcon} size={20} />
            <span className="text-xs">Blur</span>
          </button>
          <button
            onClick={() => setEditMode(editMode === "filter" ? null : "filter")}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors",
              editMode === "filter" ? "bg-primary/10 text-primary" : "hover:bg-muted"
            )}
          >
            <HugeiconsIcon icon={FilterIcon} size={20} />
            <span className="text-xs">Adjust</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
