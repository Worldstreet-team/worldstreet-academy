"use client"
import { DownloadIcon } from "@/components/icons"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { getProductDownloadUrl } from "@/lib/actions/product-files"

/**
 * Download a template or guide. Each click mints a fresh 5-minute signed URL
 * (attachment disposition) after the server has checked ownership, so the
 * browser downloads without leaving the page. The URL is never in the HTML.
 */
export function ProductDownloadButton({
  courseId,
  label,
  variant = "primary",
}: {
  courseId: string
  label: string
  variant?: "primary" | "outline"
}) {
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function download() {
    setBusy(true)
    setError(null)
    try {
      const res = await getProductDownloadUrl(courseId)
      if (res.success) window.location.assign(res.data.url)
      else setError(res.error)
    } catch {
      setError("Couldn't prepare the download — try again")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        size={variant === "primary" ? "lg" : "default"}
        variant={variant === "primary" ? "default" : "outline"}
        disabled={busy}
        onClick={download}
      >
        <DownloadIcon size={16} aria-hidden />
        {busy ? "Preparing…" : label}
      </Button>
      {error && (
        <p role="alert" className="text-[13px] text-ws-danger">
          {error}
        </p>
      )}
    </div>
  )
}
