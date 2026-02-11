"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  Loading03Icon,
  CallEnd01Icon,
  ArrowRight01Icon,
  Video01Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"

/* ── Setup overlay (loading spinner) ── */

export function SetupOverlay({ message }: { message: string }) {
  return (
    <div className="absolute inset-0 z-50 bg-background/95 flex flex-col items-center justify-center gap-5 rounded-inherit">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-muted border border-border">
        <HugeiconsIcon icon={Loading03Icon} size={28} className="text-muted-foreground animate-spin" />
      </div>
      <p className="text-muted-foreground text-sm font-medium">{message}</p>
    </div>
  )
}

/* ── Waiting room (pending host approval) ── */

export function WaitingRoom({
  meetingTitle,
  onCancel,
}: {
  meetingTitle: string
  onCancel: () => void
}) {
  return (
    <div className="absolute inset-0 z-50 bg-background flex flex-col items-center justify-center rounded-inherit">
      <div className="relative z-10 flex flex-col items-center gap-8">
        <div className="relative">
          <div className="absolute inset-0 w-24 h-24 rounded-full bg-emerald-500/10 animate-ping" />
          <div className="w-24 h-24 rounded-full flex items-center justify-center bg-muted border border-border">
            <HugeiconsIcon icon={Loading03Icon} size={32} className="text-muted-foreground animate-spin" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-foreground text-lg font-semibold">{meetingTitle}</h2>
          <p className="text-muted-foreground text-sm">Waiting for the host to let you in…</p>
        </div>
        <Button variant="outline" size="sm" onClick={onCancel} className="border-border text-muted-foreground hover:text-foreground hover:border-border bg-muted">
          Cancel
        </Button>
      </div>
    </div>
  )
}

/* ── Meeting ended screen ── */

export function MeetingEndedScreen({
  meetingTitle,
  duration,
  onReturn,
}: {
  meetingTitle: string
  duration: string
  onReturn: () => void
}) {
  return (
    <div className="fixed inset-0 z-60 bg-background flex flex-col items-center justify-center gap-6">
      <div className="w-20 h-20 rounded-full border-2 border-red-400/30 flex items-center justify-center">
        <HugeiconsIcon icon={CallEnd01Icon} size={32} className="text-red-400" />
      </div>
      <div className="text-center space-y-1.5">
        <h2 className="text-xl font-semibold text-foreground">Meeting Ended</h2>
        <p className="text-sm text-muted-foreground">{meetingTitle}</p>
        {duration && (
          <p className="text-xs text-muted-foreground/60">Duration: {duration}</p>
        )}
      </div>
      <Button onClick={onReturn} size="sm" className="gap-2 mt-2">
        <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
        Back to Meetings
      </Button>
    </div>
  )
}
