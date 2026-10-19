"use client"

import { useRef, useState } from "react"
import { FileIcon, UploadIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { getProductUploadUrl } from "@/lib/actions/product-files"
import {
  FORMAT_LABEL,
  MAX_PRODUCT_BYTES,
  PRODUCT_ACCEPT,
  PRODUCT_MIME,
  fileSizeLabel,
  productTypeLabel,
  type FileFormat,
  type ProductFileValue,
} from "@/lib/course-format"

const TYPE_ERROR = "Upload a PDF, EPUB, Word, Excel, PowerPoint, CSV or ZIP file"

/**
 * The one file a template or guide sells. It goes straight from the browser to
 * the PRIVATE bucket through a presigned PUT; the course save then carries the
 * key. Nothing is written until the file is fully uploaded.
 */
export function ProductFileField({
  value,
  onChange,
  format,
}: {
  value: ProductFileValue | null
  onChange: (value: ProductFileValue) => void
  format: FileFormat
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function upload(file: File) {
    setError(null)
    if (!Object.hasOwn(PRODUCT_MIME, file.type)) {
      setError(TYPE_ERROR)
      return
    }
    if (file.size > MAX_PRODUCT_BYTES) {
      setError("Files can be up to 100 MB")
      return
    }
    setUploading(file.name)
    try {
      const presign = await getProductUploadUrl(file.name, file.type, file.size)
      if (!presign.success) {
        setError(presign.error)
        return
      }
      const put = await fetch(presign.data.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      })
      if (!put.ok) {
        setError(`Couldn't upload ${file.name} — try again`)
        return
      }
      onChange({ key: presign.data.storageKey, filename: file.name, mimeType: file.type, sizeBytes: file.size })
    } catch {
      setError(`Couldn't upload ${file.name} — try again`)
    } finally {
      setUploading(null)
    }
  }

  const label = FORMAT_LABEL[format].toLowerCase()

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={PRODUCT_ACCEPT}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          if (file) void upload(file)
        }}
      />

      {value ? (
        <div className="flex items-center gap-3 rounded-[20px] border border-ws-hairline p-4">
          <FileIcon size={20} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{value.filename}</p>
            <p className="text-xs tabular-nums text-muted-foreground">
              {[productTypeLabel(value.mimeType), fileSizeLabel(value.sizeBytes)].filter(Boolean).join(" · ")}
            </p>
          </div>
          <Button type="button" variant="outline" className="rounded-full" disabled={uploading !== null} onClick={() => inputRef.current?.click()}>
            Replace file
          </Button>
        </div>
      ) : (
        <div className="rounded-[20px] border border-dashed border-ws-hairline p-5 text-center space-y-3">
          <UploadIcon size={22} className="mx-auto" />
          <p className="text-sm font-medium">No {label} file yet</p>
          <p className="text-xs text-muted-foreground">
            One file, delivered after purchase: PDF, EPUB, Word, Excel, PowerPoint, CSV or ZIP, up to 100 MB. It&apos;s
            stored privately; only buyers can download it.
          </p>
          <Button type="button" variant="outline" className="rounded-full" disabled={uploading !== null} onClick={() => inputRef.current?.click()}>
            Choose a file
          </Button>
        </div>
      )}

      {uploading && <p className="text-xs text-muted-foreground">Uploading {uploading}…</p>}
      {error && (
        <p role="alert" className="text-xs text-ws-danger">
          {error}
        </p>
      )}
    </div>
  )
}
