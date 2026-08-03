"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronRightIcon, LoaderCircleIcon, PhoneOffIcon, VideoIcon } from "lucide-react"
import { RenderIcon } from "@/components/shared/render-icon"

/* ── Setup overlay (loading spinner) ── */

export function SetupOverlay({ message }: { message: string }) {
  return (
    <div className="absolute inset-0 z-50 bg-background/95 flex flex-col items-center justify-center gap-5 rounded-inherit">
      <div className="w-16 h-16 rounded-lg flex items-center justify-center bg-muted border border-border">
        <LoaderCircleIcon  size={28} className="text-muted-foreground animate-spin" />
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
          <div className="w-24 h-24 rounded-full flex items-center justify-center bg-muted border border-border">
            <LoaderCircleIcon  size={32} className="text-muted-foreground animate-spin" />
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
  reason = "ended",
}: {
  meetingTitle: string
  duration: string
  onReturn: () => void
  /** "ended" = host ended the meeting, "left" = participant voluntarily left, "kicked" = removed by host */
  reason?: "ended" | "left" | "kicked"
}) {
  const headings: Record<string, string> = {
    ended: "Meeting Ended",
    left: "You Left the Meeting",
    kicked: "You Were Removed",
  }

  return (
    <div className="fixed inset-0 z-60 bg-background flex flex-col items-center justify-center gap-6">
      <div className={cn(
        "w-20 h-20 rounded-full border-2 flex items-center justify-center",
        reason === "left" ? "border-muted-foreground/30" : "border-ws-danger/30"
      )}>
        <RenderIcon icon={reason === "left" ? ChevronRightIcon : PhoneOffIcon}
          
          size={32}
          className={reason === "left" ? "text-muted-foreground" : "text-ws-danger"} />
      </div>
      <div className="text-center space-y-1.5">
        <h2 className="text-xl font-semibold text-foreground">{headings[reason]}</h2>
        <p className="text-sm text-muted-foreground">{meetingTitle}</p>
        {duration && (
          <p className="text-xs text-muted-foreground/60">Duration: {duration}</p>
        )}
      </div>
      <Button onClick={onReturn} size="sm" className="gap-2 mt-2">
        <ChevronRightIcon  size={14} />
        Back to Meetings
      </Button>
    </div>
  )
}
