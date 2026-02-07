"use client"

import { useRef, useState, useCallback } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalFooter,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
} from "@/components/ui/responsive-modal"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Image01Icon,
  Video01Icon,
  Upload04Icon,
  Link01Icon,
  Delete01Icon,
  PlayIcon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

/* ─── Types ─── */
type MediaType = "image" | "video"

interface MediaUploadProps {
  /** "image" or "video" */
  type: MediaType
  /** Current URL value */
  value: string
  /** Callback when URL changes (from upload or link) */
  onChange: (url: string) => void
  /** Called when media is removed */
  onRemove?: () => void
  /** For video: called when duration is detected (in seconds) */
  onDurationDetected?: (seconds: number) => void
  /** Label shown above the upload area */
  label?: string
  /** Compact mode for smaller areas (e.g. inside lessons) */
  compact?: boolean
  /** Extra class names */
  className?: string
}

export function MediaUpload({
  type,
  value,
  onChange,
  onRemove,
  onDurationDetected,
  label,
  compact = false,
  className,
}: MediaUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const [linkValue, setLinkValue] = useState("")
  const [previewError, setPreviewError] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)

  const handleValueChange = useCallback(
    (url: string) => {
      setPreviewError(false)
      setIsPlaying(false)
      onChange(url)
    },
    [onChange]
  )

  /* ── File input handler ── */
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const objectUrl = URL.createObjectURL(file)
    handleValueChange(objectUrl)
    if (type === "video" && onDurationDetected) probeVideoDuration(objectUrl)
    e.target.value = ""
  }

  /* ── Drag & drop ── */
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }
  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    const acceptPrefix = type === "image" ? "image/" : "video/"
    if (!file.type.startsWith(acceptPrefix)) return
    const objectUrl = URL.createObjectURL(file)
    handleValueChange(objectUrl)
    if (type === "video" && onDurationDetected) probeVideoDuration(objectUrl)
  }

  /* ── Link paste ── */
  function handleLinkConfirm() {
    const url = linkValue.trim()
    if (!url) return
    handleValueChange(url)
    setLinkModalOpen(false)
    if (type === "video" && onDurationDetected) probeVideoDuration(url)
  }

  /* ── Remove ── */
  function handleRemove() {
    handleValueChange("")
    onRemove?.()
  }

  /* ── Video duration detection (returns seconds) ── */
  function probeVideoDuration(url: string) {
    const vid = document.createElement("video")
    vid.preload = "metadata"
    vid.src = url
    vid.addEventListener("loadedmetadata", () => {
      if (vid.duration && isFinite(vid.duration)) {
        onDurationDetected?.(Math.round(vid.duration))
      }
      vid.src = ""
      vid.load()
    })
    vid.addEventListener("error", () => {
      vid.src = ""
      vid.load()
    })
  }

  /* ── Play / pause video ── */
  function togglePlayback() {
    const el = videoRef.current
    if (!el) return
    if (el.paused) {
      el.play()
      setIsPlaying(true)
    } else {
      el.pause()
      setIsPlaying(false)
    }
  }

  function openLinkModal() {
    setLinkValue(value)
    setLinkModalOpen(true)
  }

  const isImage = type === "image"
  const accept = isImage ? "image/*" : "video/*"
  const Icon = isImage ? Image01Icon : Video01Icon
  const emptyLabel = isImage ? "No image added" : "No video added"

  /* ─────── Hidden file input + modal (shared) ─────── */
  const sharedElements = (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleFileSelect}
      />
      <LinkPasteModal
        open={linkModalOpen}
        onOpenChange={setLinkModalOpen}
        value={linkValue}
        onValueChange={setLinkValue}
        onConfirm={handleLinkConfirm}
        type={type}
      />
    </>
  )

  /* ─────── Has content: preview + action buttons beneath ─────── */
  if (value && !previewError) {
    return (
      <div className={cn("space-y-2", className)}>
        {label && (
          <Label className="text-xs font-medium text-muted-foreground">
            {label}
          </Label>
        )}

        {/* Preview */}
        <div
          className={cn(
            "relative rounded-lg border bg-muted/20 overflow-hidden group",
            compact ? "aspect-video" : "aspect-video max-h-52"
          )}
        >
          {isImage ? (
            <Image
              src={value}
              alt="Preview"
              fill
              className="object-cover !relative"
              sizes={compact ? "200px" : "400px"}
              onError={() => setPreviewError(true)}
            />
          ) : (
            <>
              <video
                ref={videoRef}
                src={value}
                className="h-full w-full object-contain bg-black"
                playsInline
                controls={isPlaying}
                onEnded={() => setIsPlaying(false)}
                onPause={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                onError={() => setPreviewError(true)}
              />
              {/* Glassmorphic play overlay */}
              {!isPlaying && (
                <button
                  type="button"
                  onClick={togglePlayback}
                  className="absolute inset-0 flex items-center justify-center bg-black/10 transition-opacity group-hover:bg-black/20"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-white/20 backdrop-blur-md shadow-lg transition-transform group-hover:scale-110">
                    <HugeiconsIcon
                      icon={PlayIcon}
                      size={20}
                      className="text-white ml-0.5"
                    />
                  </div>
                </button>
              )}
            </>
          )}
        </div>

        {/* Action buttons row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            variant="outline"
            size="xs"
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            <HugeiconsIcon icon={Upload04Icon} size={12} />
            Replace
          </Button>
          <Button
            variant="outline"
            size="xs"
            type="button"
            onClick={openLinkModal}
          >
            <HugeiconsIcon icon={Link01Icon} size={12} />
            URL
          </Button>
          <Button
            variant="destructive"
            size="xs"
            type="button"
            onClick={handleRemove}
          >
            <HugeiconsIcon icon={Delete01Icon} size={12} />
            Remove
          </Button>
        </div>

        {sharedElements}
      </div>
    )
  }

  /* ─────── Empty state: drop zone ─────── */
  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label className="text-xs font-medium text-muted-foreground">
          {label}
        </Label>
      )}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "rounded-lg border-2 border-dashed border-border bg-muted/20 transition-colors",
          isDragging && "border-primary bg-primary/5",
          compact ? "p-4" : "p-6"
        )}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <div className={cn("rounded-full bg-muted p-2", compact && "p-1.5")}>
            <HugeiconsIcon
              icon={Icon}
              size={compact ? 18 : 24}
              className="text-muted-foreground"
            />
          </div>
          <div>
            <p
              className={cn(
                "font-medium text-muted-foreground",
                compact ? "text-[11px]" : "text-xs"
              )}
            >
              {emptyLabel}
            </p>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
              Drag & drop or use the buttons below
            </p>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Button
              variant="outline"
              size="xs"
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              <HugeiconsIcon icon={Upload04Icon} size={12} />
              Upload
            </Button>
            <Button
              variant="outline"
              size="xs"
              type="button"
              onClick={openLinkModal}
            >
              <HugeiconsIcon icon={Link01Icon} size={12} />
              Paste URL
            </Button>
          </div>
        </div>
      </div>

      {previewError && value && (
        <p className="text-[10px] text-destructive">
          Failed to load preview. Check the URL.
        </p>
      )}

      {sharedElements}
    </div>
  )
}

/* ─── Internal Link Paste Modal ─── */
function LinkPasteModal({
  open,
  onOpenChange,
  value,
  onValueChange,
  onConfirm,
  type,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  value: string
  onValueChange: (v: string) => void
  onConfirm: () => void
  type: MediaType
}) {
  const isImage = type === "image"
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>
            {isImage ? "Image URL" : "Video URL"}
          </ResponsiveModalTitle>
          <ResponsiveModalDescription>
            {isImage
              ? "Paste a direct link to the image."
              : "Paste a direct link to the video file."}
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>
        <Input
          type="url"
          placeholder={
            isImage
              ? "https://images.unsplash.com/photo-..."
              : "https://storage.example.com/video.mp4"
          }
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim()) onConfirm()
          }}
          autoFocus
        />
        <ResponsiveModalFooter>
          <Button size="sm" onClick={onConfirm} disabled={!value.trim()}>
            Save
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  )
}
