"use client"

import { useState } from "react"
import Image from "next/image"
import { useQuery } from "@tanstack/react-query"
import { PlayIcon, VideoIcon } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CardShell, EmptyState } from "@/components/ui/system"
import { listMyRecordings, type RecordingView } from "@/lib/actions/recordings"
import { RecordingPlayer } from "@/components/recordings/recording-player"

/** "1 h 05 min", "45 min", or "" when RealtimeKit reported no duration. */
export function formatRecordingDuration(seconds: number): string {
  if (!seconds || seconds < 60) return seconds > 0 ? "<1 min" : ""
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`
}

/** The viewer's own time zone — this only ever renders in the browser after the query resolves. */
export function formatRecordedAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

/**
 * Class recordings the viewer may watch. `courseId` scopes it to one program
 * (the course page's "Past classes", which renders nothing while there are
 * none); without it, every program (/dashboard/recordings, with an empty state).
 */
export function RecordingsList({ courseId }: { courseId?: string }) {
  const [playing, setPlaying] = useState<RecordingView | null>(null)
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["recordings", courseId ?? "all"],
    queryFn: () => listMyRecordings(courseId ? { courseId } : {}),
  })
  const recordings = data?.success ? data.data : []
  const failed = isError || (data && !data.success)
  const scoped = Boolean(courseId)

  if (isLoading) {
    return scoped ? null : <div className="h-40 animate-pulse rounded-lg bg-ws-surface motion-reduce:animate-none" />
  }
  if (failed) {
    return scoped ? null : (
      <CardShell>
        <EmptyState
          title="Couldn't load your recordings"
          description="Check your connection and try again."
          ctas={[{ label: "Try again", onClick: () => refetch() }]}
        />
      </CardShell>
    )
  }
  if (recordings.length === 0) {
    return scoped ? null : (
      <div className="rounded-lg bg-ws-surface px-6 py-8">
        <p className="text-[15px] font-semibold text-ws-primary">No class recordings yet</p>
        <p className="mt-1 text-[13px] text-ws-muted">
          Live classes from your programs are recorded. They appear here shortly after each class ends.
        </p>
      </div>
    )
  }

  return (
    <section className="space-y-3">
      {scoped && (
        <h2 className="font-display text-lg font-semibold tracking-[-0.01em] text-ws-primary">Past classes</h2>
      )}
      <ul className="space-y-2">
        {recordings.map((r) => {
          const duration = formatRecordingDuration(r.durationSeconds)
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setPlaying(r)}
                className="flex w-full items-center gap-3 rounded-md bg-ws-surface p-3 text-left transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised"
              >
                <span className="relative flex h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-ws-raised">
                  {r.courseArt ? (
                    <Image src={r.courseArt} alt="" fill sizes="80px" className="object-cover" />
                  ) : (
                    <VideoIcon size={16} className="text-ws-muted" aria-hidden />
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                    <PlayIcon size={14} className="text-white" fill="currentColor" aria-hidden />
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-ws-primary">{r.title}</span>
                  <span className="block truncate text-[12px] text-ws-muted">
                    {[!scoped && r.courseTitle, formatRecordedAt(r.recordedAt), duration].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="shrink-0 text-[12px] font-medium text-ws-muted">Watch</span>
              </button>
            </li>
          )
        })}
      </ul>

      <Dialog open={playing !== null} onOpenChange={(open) => !open && setPlaying(null)}>
        <DialogContent className="sm:max-w-3xl">
          {playing && (
            <>
              <DialogHeader>
                <DialogTitle>{playing.title}</DialogTitle>
                <DialogDescription>
                  {[playing.courseTitle, playing.hostName, formatRecordedAt(playing.recordedAt)].filter(Boolean).join(" · ")}
                </DialogDescription>
              </DialogHeader>
              <RecordingPlayer recordingId={playing.id} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
