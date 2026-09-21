"use client"

import * as React from "react"
import { PlayIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { formatClock } from "@/components/programs/format"

/** A free video lesson the visitor may watch before buying. */
export type ProgramPreview = {
  id: string
  title: string
  durationSec: number | null
  videoUrl: string
  posterUrl: string | null
  /**
   * The program the lesson belongs to, when the dialog lists lessons from
   * more than one (the school page): it names the program over the lesson
   * title and under each lesson in the list. The program page leaves it out.
   */
  program?: string
}

type PreviewContextValue = {
  previews: ProgramPreview[]
  open: (lessonId?: string) => void
}

const PreviewContext = React.createContext<PreviewContextValue | null>(null)

/**
 * The program page's one preview player. The purchase card's art and every
 * "Preview" row in the curriculum open the same dialog, so it lives here and
 * the triggers only name a lesson. With more than one free lesson the dialog
 * lists them all (the Udemy "free sample videos" list) and switches in place.
 *
 * The <video> is mounted only while the dialog is open, keyed by lesson, so
 * closing it or switching lessons stops playback.
 */
export function PreviewProvider({
  previews,
  programTitle,
  children,
}: {
  previews: ProgramPreview[]
  programTitle: string
  children: React.ReactNode
}) {
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const active = previews.find((p) => p.id === activeId) ?? null

  const value = React.useMemo<PreviewContextValue>(
    () => ({
      previews,
      open: (lessonId) => setActiveId(lessonId ?? previews[0]?.id ?? null),
    }),
    [previews]
  )

  return (
    <PreviewContext.Provider value={value}>
      {children}
      <Dialog open={active !== null} onOpenChange={(next) => !next && setActiveId(null)}>
        {/* sm:max-w-3xl repeats the unprefixed width: DialogContent's own
            `sm:max-w-sm` survives a bare override (see free-preview-rail). */}
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-3xl gap-0 overflow-y-auto p-0 sm:max-w-3xl">
          {active && (
            <>
              <div className="px-5 pb-4 pr-14 pt-5">
                <DialogDescription className="truncate text-[12px] font-semibold uppercase tracking-[0.08em] text-ws-muted">
                  {active.program ?? "Program preview"}
                </DialogDescription>
                <DialogTitle className="mt-1.5 truncate font-display text-[17px] font-semibold leading-snug text-ws-primary">
                  {active.title}
                </DialogTitle>
              </div>
              <video
                key={active.id}
                src={active.videoUrl}
                poster={active.posterUrl ?? undefined}
                controls
                autoPlay
                playsInline
                className="aspect-video w-full bg-black"
              />
              {previews.length > 1 && (
                <div className="px-3 pb-3 pt-4">
                  <p className="px-2 text-[13px] font-semibold text-ws-primary">
                    Free lessons from {programTitle}
                  </p>
                  <ul className="mt-2 max-h-52 overflow-y-auto">
                    {previews.map((p) => {
                      const current = p.id === active.id
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            aria-current={current ? "true" : undefined}
                            onClick={() => setActiveId(p.id)}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-[12px] px-2 py-2.5 text-left transition-colors duration-[var(--ws-motion-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40",
                              current ? "bg-ws-raised" : "hover:bg-ws-surface"
                            )}
                          >
                            <span
                              className={cn(
                                "flex size-8 shrink-0 items-center justify-center rounded-[9px]",
                                current ? "bg-ws-primary text-ws-page" : "bg-ws-chip text-ws-muted"
                              )}
                            >
                              <PlayIcon size={13} fill="currentColor" aria-hidden />
                            </span>
                            <span
                              className={cn(
                                "min-w-0 flex-1 truncate text-[14px]",
                                current ? "font-semibold text-ws-primary" : "text-ws-muted"
                              )}
                            >
                              {p.title}
                              {p.program && (
                                <span className="block truncate text-[12.5px] font-normal text-ws-muted">{p.program}</span>
                              )}
                            </span>
                            {p.durationSec !== null && (
                              <span className="shrink-0 text-[12.5px] tabular-nums text-ws-muted">
                                {formatClock(p.durationSec)}
                              </span>
                            )}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </PreviewContext.Provider>
  )
}

/** Opens the preview dialog on `lessonId` (the first preview when omitted). Renders its own button. */
export function PreviewTrigger({
  lessonId,
  className,
  children,
  label,
}: {
  lessonId?: string
  className?: string
  children: React.ReactNode
  /** Accessible name when the children are not text. */
  label?: string
}) {
  const ctx = React.useContext(PreviewContext)
  if (!ctx || ctx.previews.length === 0) return null
  return (
    <button type="button" aria-label={label} onClick={() => ctx.open(lessonId)} className={className}>
      {children}
    </button>
  )
}
