"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { RotateCcw } from "@/components/icons"

/**
 * The error page for every route group without its own (the public site, the
 * student dashboard, sign-in) — before 2026-11-12 a failed page showed Next's
 * bare "Application error" screen. "Try again" re-asks the server for the page
 * (router.refresh) and then re-renders it, so a passing failure — the database
 * not answering for a moment — clears without a full reload.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()
  const [retrying, startRetry] = React.useTransition()

  React.useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[70dvh] flex-1 items-center justify-center px-4 py-16 sm:px-6">
      <div className="w-full max-w-md rounded-[20px] border border-ws-hairline bg-ws-surface p-6 text-center sm:p-8">
        <h1 className="font-display text-xl font-semibold text-ws-primary">Something went wrong</h1>
        <p className="mt-2 text-sm leading-relaxed text-ws-muted">
          This page didn&apos;t load. Try again — if it keeps happening, come back in a few minutes.
        </p>
        {error.digest && <p className="mt-2 text-[11px] tabular-nums text-ws-subtle">Ref: {error.digest}</p>}
        <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <button
            type="button"
            disabled={retrying}
            onClick={() =>
              startRetry(() => {
                router.refresh()
                reset()
              })
            }
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-ws-brand px-5 text-sm font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90 disabled:opacity-60 sm:w-auto"
          >
            <RotateCcw size={16} strokeWidth={2} />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex h-10 w-full items-center justify-center rounded-full border border-ws-hairline px-5 text-sm font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:border-ws-brand/40 sm:w-auto"
          >
            Back to the Academy
          </Link>
        </div>
      </div>
    </div>
  )
}
