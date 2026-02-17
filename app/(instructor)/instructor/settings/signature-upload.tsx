"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Upload03Icon, Tick02Icon, Delete02Icon } from "@hugeicons/core-free-icons"
import { saveSignature } from "@/lib/actions/signature"
import { getImageUploadUrl } from "@/lib/actions/upload"

export function InstructorSignatureUpload({
  currentSignatureUrl,
}: {
  currentSignatureUrl: string | null
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(currentSignatureUrl)
  const [isUploading, setIsUploading] = useState(false)
  const [saved, setSaved] = useState(!!currentSignatureUrl)

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return
    setIsUploading(true)
    setSaved(false)

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
      setPreview(result.publicUrl)
      setSaved(true)
    } catch (error) {
      console.error("Signature upload error:", error)
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemove = async () => {
    try {
      await saveSignature("")
      setPreview(null)
      setSaved(false)
    } catch (error) {
      console.error("Remove signature error:", error)
    }
  }

  return (
    <div className="space-y-3">
      {preview ? (
        <div className="flex items-center gap-4">
          <div className="w-48 h-20 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 flex items-center justify-center overflow-hidden">
            <img
              src={preview}
              alt="Your signature"
              className="h-full w-auto object-contain p-2"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              className="gap-1.5"
            >
              <HugeiconsIcon icon={Upload03Icon} size={14} />
              Change
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              className="gap-1.5 text-destructive hover:text-destructive"
            >
              <HugeiconsIcon icon={Delete02Icon} size={14} />
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="w-48 h-20 rounded-lg border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:text-primary"
        >
          {isUploading ? (
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <>
              <HugeiconsIcon icon={Upload03Icon} size={20} />
              <span className="text-xs font-medium">Upload Signature</span>
            </>
          )}
        </button>
      )}

      {saved && (
        <p className="text-xs text-emerald-600 flex items-center gap-1">
          <HugeiconsIcon icon={Tick02Icon} size={14} />
          Signature saved — it will appear on student certificates
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ""
        }}
      />
    </div>
  )
}
