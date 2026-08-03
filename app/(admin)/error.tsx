"use client"

import { useEffect } from "react"
import { RotateCcw } from "lucide-react"

/**
 * Admin console error boundary — same ws-token styling as the rest of the
 * console. Actions there mutate real money and roles, so surface the failure
 * plainly and offer a retry instead of a blank screen.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Admin console error:", error)
  }, [error])

  return (
    <div className="flex-1 px-6 pb-24 pt-8 md:px-8 md:pb-12 lg:px-12">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mx-auto mt-16 max-w-md rounded-lg border border-ws-hairline bg-ws-surface p-8 text-center">
          <h1 className="font-display text-xl font-semibold text-ws-primary">
            Something went wrong
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-ws-muted">
            The admin console hit an unexpected error. Nothing was saved — try
            again, and if it keeps happening check the server logs.
          </p>
          {error.digest && (
            <p className="mt-2 tabular-nums text-[10px] text-ws-subtle">
              digest: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-sm bg-ws-brand px-5 text-sm font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"
          >
            <RotateCcw size={16} strokeWidth={2} />
            Try again
          </button>
        </div>
      </div>
    </div>
  )
}
