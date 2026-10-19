"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { CircleCheckBigIcon } from "@/components/icons"
import { acknowledgeHandbook } from "@/lib/actions/instructor-onboarding"
import { COHORT_TIME_ZONE } from "@/lib/cohort"
import type { HandbookKey } from "@/lib/faculty-handbook"

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: COHORT_TIME_ZONE })

/** The foot of a handbook page: acknowledge it once, then show when. */
export function HandbookAcknowledge({
  handbookKey,
  title,
  acknowledgedAt,
}: {
  handbookKey: HandbookKey
  title: string
  acknowledgedAt: string | null
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const name = title.toLowerCase()

  if (acknowledgedAt) {
    return (
      <p className="flex items-center gap-2 text-[14px] text-muted-foreground">
        <CircleCheckBigIcon size={16} className="text-ws-success" />
        You acknowledged the {name} on {DATE.format(new Date(acknowledgedAt))}.
      </p>
    )
  }

  async function onClick() {
    setPending(true)
    setError(null)
    const res = await acknowledgeHandbook(handbookKey)
    setPending(false)
    if (!res.success) {
      setError(res.error)
      return
    }
    await queryClient.invalidateQueries({ queryKey: ["instructor-onboarding"] })
    router.refresh()
  }

  return (
    <div className="space-y-2">
      <Button className="h-10 px-5" disabled={pending} onClick={onClick}>
        {pending ? "Saving…" : `I have read the ${name}`}
      </Button>
      {error && (
        <p role="alert" className="text-[13px] text-ws-danger">
          {error}
        </p>
      )}
    </div>
  )
}
