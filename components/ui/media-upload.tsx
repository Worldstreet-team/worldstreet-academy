"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Image01Icon,
  Video01Icon,
  Upload04Icon,
  Delete01Icon,
  PlayIcon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

/* ─── Types ─── */
type MediaType = "image" | "video"

type PresignedUrlResult = {
  success: boolean
  uploadUrl?: string
  publicUrl?: string
  error?: string
}

interface MediaUploadProps {
  /** "image" or "video" */
  type: MediaType
  /** Current URL value */
  value: string
  /** Callback when URL changes (from upload or link) */
  onChange: (url: string) => void
  /** Called when media is removed */
  onRemove?: () => void
  /** Called to get a presigned URL for uploading - returns uploadUrl and publicUrl */
  onGetPresignedUrl?: (file: File) => Promise<PresignedUrlResult>
  /** Legacy: Called when a file is selected - should upload and return the URL */
  onFileSelected?: (file: File) => Promise<string | void>
  /** For video: called when duration is detected (in seconds) */
  onDurationDetected?: (seconds: number) => void
  /** Label shown above the upload area */
  label?: string
  /** Compact mode for smaller areas (e.g. inside lessons) */
  compact?: boolean
  /** Show loading state during upload */
  isUploading?: boolean
  /** Extra class names */
  className?: string
}

/** Format bytes to human readable string */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function MediaUpload({
  type,
  value,
  onChange,
  onRemove,
  onGetPresignedUrl,
  onFileSelected,
  onDurationDetected,
  label,
  compact = false,
  isUploading = false,
  className,
}: MediaUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const [previewError, setPreviewError] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [localUploading, setLocalUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadedBytes, setUploadedBytes] = useState(0)
  const [totalBytes, setTotalBytes] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadStartTime, setUploadStartTime] = useState<number | null>(null)
  const [uploadStatus, setUploadStatus] = useState<string>("")
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<string | null>(null)

  const uploading = isUploading || localUploading

  // Calculate estimated time remaining
  useEffect(() => {
    if (uploading && uploadStartTime && uploadedBytes > 0 && totalBytes > 0) {
      const elapsedMs = Date.now() - uploadStartTime
      const bytesPerMs = uploadedBytes / elapsedMs
      const remainingBytes = totalBytes - uploadedBytes
      const remainingMs = remainingBytes / bytesPerMs
      
      if (remainingMs < 1000) {
        setEstimatedTimeRemaining("< 1s")
      } else if (remainingMs < 60000) {
        setEstimatedTimeRemaining(`${Math.ceil(remainingMs / 1000)}s`)
      } else {
        const mins = Math.floor(remainingMs / 60000)
        const secs = Math.ceil((remainingMs % 60000) / 1000)
        setEstimatedTimeRemaining(`${mins}m ${secs}s`)
      }
    } else {
      setEstimatedTimeRemaining(null)
    }
  }, [uploading, uploadStartTime, uploadedBytes, totalBytes])

  const handleValueChange = useCallback(
    (url: string) => {
      setPreviewError(false)
      setIsPlaying(false)
      setUploadError(null)
      onChange(url)
    },
    [onChange]
  )

  /** Upload file to R2 using presigned URL with progress tracking */
  async function uploadWithProgress(file: File, uploadUrl: string): Promise<boolean> {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest()
      abortControllerRef.current = new AbortController()
      
      setUploadStatus("Uploading to cloud...")
      
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100)
          setUploadProgress(progress)
          setUploadedBytes(event.loaded)
          setTotalBytes(event.total)
          setUploadStatus(`Uploading: ${progress}%`)
        }
      })

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploadProgress(100)
          setUploadStatus("Upload complete!")
          resolve(true)
        } else if (xhr.status === 0) {
          console.error("[Upload] CORS error — status 0")
          setUploadError("Network error. Check R2 CORS configuration.")
          setUploadStatus("CORS error")
          resolve(false)
        } else {
          console.error("[Upload] Failed:", xhr.status, xhr.statusText, xhr.responseText)
          setUploadError(`Upload failed (${xhr.status}: ${xhr.statusText})`)
          setUploadStatus("Upload failed")
          resolve(false)
        }
      })

      xhr.addEventListener("error", () => {
        console.error("[Upload] Network error — status:", xhr.status)
        setUploadError("Network error during upload.")
        setUploadStatus("Network error")
        resolve(false)
      })

      xhr.addEventListener("abort", () => {
        setUploadStatus("Upload cancelled")
        resolve(false)
      })

      xhr.open("PUT", uploadUrl)
      xhr.setRequestHeader("Content-Type", file.type)
      xhr.send(file)
    })
  }

  /** Handle file upload with presigned URL */
  async function handleUpload(file: File) {
    setLocalUploading(true)
    setUploadProgress(0)
    setUploadedBytes(0)
    setTotalBytes(file.size)
    setUploadError(null)
    setUploadStartTime(Date.now())
    setUploadStatus("Preparing upload...")

    try {
      if (onGetPresignedUrl) {
        setUploadStatus("Getting upload URL...")
        const result = await onGetPresignedUrl(file)
        
        if (!result.success || !result.uploadUrl || !result.publicUrl) {
          setUploadError(result.error || "Failed to get upload URL")
          setUploadStatus("Failed to prepare upload")
          return
        }

        const uploadSuccess = await uploadWithProgress(file, result.uploadUrl)
        
        if (uploadSuccess) {
          handleValueChange(result.publicUrl)
          if (type === "video" && onDurationDetected) {
            probeVideoDuration(result.publicUrl)
          }
        }
      } else if (onFileSelected) {
        const uploadedUrl = await onFileSelected(file)
        if (uploadedUrl) {
          handleValueChange(uploadedUrl)
          if (type === "video" && onDurationDetected) {
            probeVideoDuration(uploadedUrl)
          }
        }
      } else {
        const objectUrl = URL.createObjectURL(file)
        handleValueChange(objectUrl)
        if (type === "video" && onDurationDetected) {
          probeVideoDuration(objectUrl)
        }
      }
    } catch (error) {
      console.error("[Upload] Error:", error)
      setUploadError(error instanceof Error ? error.message : "Upload failed")
    } finally {
      setLocalUploading(false)
      setUploadStatus("")
      setTimeout(() => {
        setUploadProgress(0)
        setUploadedBytes(0)
        setTotalBytes(0)
        setUploadStartTime(null)
        setEstimatedTimeRemaining(null)
      }, 2000)
    }
  }

  /* ── File input handler ── */
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    await handleUpload(file)
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
  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    const acceptPrefix = type === "image" ? "image/" : "video/"
    if (!file.type.startsWith(acceptPrefix)) return
    await handleUpload(file)
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

  const isImage = type === "image"
  const accept = isImage ? "image/*" : "video/*"
  const Icon = isImage ? Image01Icon : Video01Icon
  const emptyLabel = isImage ? "No image added" : "No video added"

  /* ─────── Hidden file input (shared) ─────── */
  const sharedElements = (
    <input
      ref={fileInputRef}
      type="file"
      accept={accept}
      className="hidden"
      onChange={handleFileSelect}
    />
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

        {/* Preview - clickable to replace */}
        <div
          onClick={isImage && !uploading ? () => fileInputRef.current?.click() : undefined}
          className={cn(
            "relative rounded-lg border bg-muted/20 overflow-hidden group",
            compact ? "aspect-video" : "aspect-video max-h-52",
            isImage && !uploading && "cursor-pointer hover:border-primary/50 transition-colors"
          )}
        >
          {isImage ? (
            <>
              <Image
                src={value}
                alt="Preview"
                fill
                className="object-cover !relative"
                sizes={compact ? "200px" : "400px"}
                onError={() => setPreviewError(true)}
              />
              {/* Replace overlay on hover */}
              {!uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 group-hover:bg-black/40 group-hover:opacity-100 transition-all">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/20 backdrop-blur-md shadow-lg">
                    <HugeiconsIcon icon={Upload04Icon} size={18} className="text-white" />
                  </div>
                </div>
              )}
            </>
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

        {/* Upload Progress - shown below when replacing */}
        {uploading && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={Loading03Icon} size={14} className="text-primary animate-spin" />
              <span className="text-xs font-medium">{uploadStatus || "Uploading..."}</span>
            </div>
            {uploadProgress > 0 && (
              <>
                <Progress value={uploadProgress} className="h-2" />
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{formatBytes(uploadedBytes)} / {formatBytes(totalBytes)}</span>
                  <span className="font-medium text-primary">{uploadProgress}%</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Action buttons row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {!isImage && (
            <Button
              variant="outline"
              size="xs"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <HugeiconsIcon icon={Loading03Icon} size={12} className="animate-spin" />
              ) : (
                <HugeiconsIcon icon={Upload04Icon} size={12} />
              )}
              Replace
            </Button>
          )}
          <Button
            variant="destructive"
            size="xs"
            type="button"
            onClick={handleRemove}
            disabled={uploading}
          >
            <HugeiconsIcon icon={Delete01Icon} size={12} />
            Remove
          </Button>
        </div>

        {sharedElements}
      </div>
    )
  }

  /* ─────── Empty state: drop zone (entire container is clickable) ─────── */
  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label className="text-xs font-medium text-muted-foreground">
          {label}
        </Label>
      )}
      <div
        onClick={!uploading ? () => fileInputRef.current?.click() : undefined}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "rounded-lg border-2 border-dashed border-border bg-muted/20 transition-colors cursor-pointer hover:border-primary/50 hover:bg-muted/30",
          isDragging && "border-primary bg-primary/5",
          uploading && "cursor-default hover:border-border hover:bg-muted/20",
          compact ? "p-4" : "p-6"
        )}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <div className={cn("rounded-full bg-muted p-2", compact && "p-1.5")}>
            {uploading ? (
              <HugeiconsIcon
                icon={Loading03Icon}
                size={compact ? 18 : 24}
                className="text-primary animate-spin"
              />
            ) : (
              <HugeiconsIcon
                icon={Icon}
                size={compact ? 18 : 24}
                className="text-muted-foreground"
              />
            )}
          </div>
          
          {/* Upload Progress */}
          {uploading ? (
            <div className="w-full max-w-55 space-y-2">
              <p className="text-xs font-medium text-foreground">
                {uploadStatus || "Uploading..."}
              </p>
              
              {uploadProgress > 0 && (
                <>
                  <Progress value={uploadProgress} className="h-2" />
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground gap-2">
                    <span>{formatBytes(uploadedBytes)} / {formatBytes(totalBytes)}</span>
                    <span className="font-medium text-primary">{uploadProgress}%</span>
                  </div>
                  {estimatedTimeRemaining && (
                    <p className="text-[10px] text-muted-foreground">
                      ~{estimatedTimeRemaining} remaining
                    </p>
                  )}
                </>
              )}
              
              {uploadProgress === 0 && (
                <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
                  <HugeiconsIcon icon={Loading03Icon} size={10} className="animate-spin" />
                  <span>Preparing...</span>
                </div>
              )}
            </div>
          ) : (
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
                Click or drag & drop to upload
              </p>
            </div>
          )}

          {/* Error message */}
          {uploadError && (
            <p className="text-[10px] text-destructive">{uploadError}</p>
          )}
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
