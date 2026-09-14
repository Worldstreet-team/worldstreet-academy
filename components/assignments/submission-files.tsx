"use client"

import * as React from "react"
import { DownloadIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getSubmissionFileUrl } from "@/lib/actions/assignments"

export function formatSize(bytes: number): string {
  if (!bytes) return ""
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * Submission files as download buttons. Each click mints a fresh 5-minute signed
 * URL (attachment disposition), so navigating to it downloads without leaving the page.
 */
export function SubmissionFiles({
  submissionId,
  files,
}: {
  submissionId: string
  files: { index: number; filename: string; sizeBytes: number }[]
}) {
  const [busy, setBusy] = React.useState<number | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  if (files.length === 0) return null

  async function download(index: number) {
    setBusy(index)
    setError(null)
    const res = await getSubmissionFileUrl(submissionId, index)
    setBusy(null)
    if (res.success) window.location.assign(res.data.url)
    else setError(res.error)
  }

  return (
    <div className="space-y-1.5">
      <ul className="flex flex-wrap gap-2">
        {files.map((file) => (
          <li key={file.index} className="min-w-0 max-w-full">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy !== null}
              onClick={() => download(file.index)}
              className="max-w-full"
            >
              <DownloadIcon size={14} aria-hidden />
              <span className="truncate">{file.filename}</span>
              {file.sizeBytes > 0 && <span className="tabular-nums text-ws-muted">{formatSize(file.sizeBytes)}</span>}
            </Button>
          </li>
        ))}
      </ul>
      {error && <p className="text-xs text-ws-danger">{error}</p>}
    </div>
  )
}
