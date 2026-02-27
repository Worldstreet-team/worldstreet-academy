"use client"

import { useRef, useState, useCallback } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Upload04Icon } from "@hugeicons/core-free-icons"
import { useVivid } from "@/lib/vivid/provider"

export function FileUploadUI() {
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
