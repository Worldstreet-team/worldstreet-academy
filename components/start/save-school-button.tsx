"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { saveEnrollmentIntent } from "@/lib/actions/enrollment-intent"
import type { SchoolSlug } from "@/lib/schools"
import { cn } from "@/lib/utils"

/**
 * Keep the school, open the dashboard — for a school with no programs yet, or
 * a program that has not opened. Gold only when it is the step's one action;
 * beside another primary it is the outlined secondary.
 */
export function SaveSchoolButton({
  school,
  variant = "primary",
}: {
  school: SchoolSlug
  variant?: "primary" | "secondary"
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function save() {
    setError(null)
    startTransition(async () => {
      const result = await saveEnrollmentIntent({ school, source: "start" })
      if (result.success) router.push("/dashboard?saved=1")
      else setError(result.error)
    })
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className={cn(
          "inline-flex h-12 w-full items-center justify-center rounded-full px-6 text-[15px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ws-surface disabled:cursor-default disabled:opacity-60",
          variant === "primary"
            ? "bg-ws-brand text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"
            : "border border-ws-hairline text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised"
        )}
      >
        {pending ? "Saving…" : "Save this school"}
      </button>
      {error && <p role="alert" className="text-[13px] text-ws-danger">{error}</p>}
    </div>
  )
}
