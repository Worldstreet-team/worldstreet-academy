"use client"

import { RotateCcw } from "lucide-react"

/** Error boundary for the instructor portal — ws-styled, with retry. */
export default function InstructorError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="w-full max-w-md rounded-lg border border-ws-hairline bg-ws-surface p-8 text-center">
        <h2 className="font-display text-xl font-semibold text-ws-primary">
          Something went wrong
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ws-muted">
          The instructor portal hit an unexpected error. Try again — if it keeps
          happening, reload the page.
        </p>
        {error.digest && (
          <p className="mt-2 text-[11px] tabular-nums text-ws-subtle">
            Ref: {error.digest}
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
  )
}
