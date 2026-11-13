"use client"

import * as React from "react"

import { DownloadIcon, LinkIcon, LoaderCircleIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { getResourceDownloadUrl } from "@/lib/actions/resources"

/**
 * One material's download on Course Materials (owner, 2026-11-12: assigned
 * tutors download their program's materials). The page holds no file key or
 * link: each click asks getResourceDownloadUrl, which checks TEACH scope and
 * mints a fresh 5-minute signed link (a link material returns its address).
 * Opened like the learner's Resources list (components/learn/course-resources.tsx):
 * a new tab, or this tab where a phone browser blocks the pop-up after the await.
 */
export function MaterialDownloadButton({ resourceId, title, isLink }: { resourceId: string; title: string; isLink: boolean }) {
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function download() {
    setBusy(true)
    setError(null)
    let result: Awaited<ReturnType<typeof getResourceDownloadUrl>>
    try {
      result = await getResourceDownloadUrl(resourceId)
    } catch {
      setBusy(false)
      setError("We couldn't reach the server. Check your connection, or reload the page.")
      return
    }
    setBusy(false)
    if (result.success && result.url) {
      const opened = window.open(result.url, "_blank")
      if (opened) opened.opener = null
      else window.location.assign(result.url)
    } else {
      setError(result.error || "Couldn't start the download")
    }
  }

  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={download}
        aria-label={`${isLink ? "Open" : "Download"} ${title}`}
        className="gap-1.5 text-xs"
      >
        {busy ? (
          <LoaderCircleIcon size={13} className="animate-spin" aria-hidden />
        ) : isLink ? (
          <LinkIcon size={13} aria-hidden />
        ) : (
          <DownloadIcon size={13} aria-hidden />
        )}
        {isLink ? "Open" : "Download"}
      </Button>
      {error && (
        <span role="alert" className="max-w-[16rem] text-right text-[12px] text-ws-danger">
          {error}
        </span>
      )}
    </span>
  )
}
