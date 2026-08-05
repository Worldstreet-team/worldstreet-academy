"use client"

import { useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  listCourseResources,
  getResourceUploadUrl,
  addResource,
  deleteResource,
} from "@/lib/actions/resources"
import { FileIcon, LinkIcon, LoaderCircleIcon, Trash2Icon, UploadIcon } from "lucide-react"
import { RenderIcon } from "@/components/shared/render-icon"

function formatSize(bytes: number) {
  if (!bytes) return ""
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * Instructor-side attachment manager. Files upload straight to R2 via a
 * presigned PUT (never through our server); the DB record is only created once
 * the upload succeeds, so a failed upload can't leave a broken row.
 */
export function ResourceManager({ courseId }: { courseId: string }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState("")
  const [linkUrl, setLinkUrl] = useState("")
  const [isFree, setIsFree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: resources = [] } = useQuery({
    queryKey: ["course-resources", courseId],
    queryFn: () => listCourseResources(courseId),
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ["course-resources", courseId] })

  async function handleFile(file: File) {
    setBusy(true)
    setError(null)
    try {
      const presign = await getResourceUploadUrl(courseId, file.name, file.type, file.size)
      if (!presign.success || !presign.uploadUrl || !presign.storageKey) {
        setError(presign.error || "Couldn't prepare the upload")
        return
      }

      const put = await fetch(presign.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      })
      if (!put.ok) {
        setError("Upload failed. Please try again.")
        return
      }

      const result = await addResource({
        courseId,
        title: title.trim() || file.name.replace(/\.[^.]+$/, ""),
        kind: presign.kind!,
        storageKey: presign.storageKey,
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        isFree,
      })
      if (!result.success) {
        setError(result.error || "Couldn't save the resource")
        return
      }
      setTitle("")
      setIsFree(false)
      if (fileRef.current) fileRef.current.value = ""
      refresh()
    } finally {
      setBusy(false)
    }
  }

  async function handleAddLink() {
    if (!linkUrl.trim()) return
    setBusy(true)
    setError(null)
    const result = await addResource({
      courseId,
      title: title.trim() || linkUrl.trim(),
      kind: "link",
      externalUrl: linkUrl.trim(),
      isFree,
    })
    setBusy(false)
    if (!result.success) {
      setError(result.error || "Couldn't save the link")
      return
    }
    setTitle("")
    setLinkUrl("")
    setIsFree(false)
    refresh()
  }

  async function handleDelete(id: string) {
    setBusy(true)
    await deleteResource(id)
    setBusy(false)
    refresh()
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Resources & downloads</h3>
        <p className="text-xs text-muted-foreground">
          PDFs, eBooks, worksheets, templates and slide decks. Only enrolled students can download
          them — unless you mark one as a free preview.
        </p>
      </div>

      {resources.length > 0 && (
        <div className="space-y-2">
          {resources.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 rounded-lg border border-ws-hairline bg-card px-3 py-2"
            >
              <RenderIcon icon={r.kind === "link" ? LinkIcon : FileIcon}
                
                size={15}
                className="shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-medium">{r.title}</p>
                  {r.isFree && (
                    <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                      Free
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {formatSize(r.sizeBytes)}
                  {r.downloadCount ? ` · ${r.downloadCount} downloads` : ""}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => handleDelete(r.id)}
                aria-label={`Delete ${r.title}`}
              >
                <Trash2Icon  size={14} className="text-ws-danger" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-ws-danger/10 border border-ws-danger/20 px-3 py-2">
          <p className="text-xs text-ws-danger">{error}</p>
        </div>
      )}

      <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
        <div className="space-y-1.5">
          <Label htmlFor="resourceTitle" className="text-xs">
            Title (optional — defaults to the filename)
          </Label>
          <Input
            id="resourceTitle"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Chart Patterns Cheat Sheet"
            className="h-11 text-base md:h-9 md:text-sm"
          />
        </div>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={isFree}
            onChange={(e) => setIsFree(e.target.checked)}
            className="h-4 w-4 shrink-0"
          />
          Free preview (downloadable without enrolling)
        </label>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".pdf,.epub,.mobi,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.zip"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="gap-1.5 text-xs"
          >
            {busy ? (
              <LoaderCircleIcon  size={13} className="animate-spin" />
            ) : (
              <UploadIcon  size={13} />
            )}
            Upload file
          </Button>

          <div className="flex flex-1 gap-2">
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="…or paste a link"
              className="h-11 text-base md:h-9 md:text-sm"
            />
            <Button variant="outline" size="sm" disabled={busy || !linkUrl.trim()} onClick={handleAddLink}>
              Add
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
