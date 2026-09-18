"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { PlayIcon } from "lucide-react"
import type { FreePreview } from "@/lib/actions/student"
import { SCHOOL_BY_SLUG } from "@/lib/schools"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Reveal, RevealGroup } from "@/components/marketing/motion/reveal"
import { SectionLabel, SectionTitle } from "@/components/marketing/section-heading"

/**
 * WATCH A FREE LESSON — the try-before-you-buy row. Real free-preview lessons
 * only; with none, the section does not render. A card opens the lesson in a
 * dialog on the landing itself — no sign-in between the visitor and the first
 * minute — and the dialog's one action leads to the program.
 */
export function FreePreviewRail({ previews }: { previews: FreePreview[] }) {
  const [open, setOpen] = React.useState<FreePreview | null>(null)
  if (previews.length === 0) return null

  return (
    <section className="py-14 sm:py-20 md:py-28" aria-labelledby="preview-heading">
      <div className="mx-auto max-w-7xl px-6">
        <RevealGroup>
          <SectionLabel>Try a lesson</SectionLabel>
          <SectionTitle id="preview-heading" className="mt-4 max-w-2xl">
            Watch a free lesson before you decide
          </SectionTitle>
        </RevealGroup>

        <Reveal y={20} duration={0.65} className="mt-10">
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {previews.map((preview) => (
              <li key={preview.lessonId}>
                <button
                  type="button"
                  onClick={() => setOpen(preview)}
                  className="group flex h-full w-full flex-col overflow-hidden rounded-[20px] border border-ws-hairline bg-ws-surface text-left transition-colors duration-[var(--ws-motion-base)] hover:bg-ws-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 dark:border-transparent"
                >
                  <span className="relative block aspect-video w-full overflow-hidden bg-ws-sunken">
                    {preview.posterUrl && (
                      <Image
                        src={preview.posterUrl}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 416px"
                        className="object-cover transition-transform duration-600 ease-[var(--ws-ease-rise)] group-hover:scale-[1.03] motion-reduce:transition-none"
                      />
                    )}
                    <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white">
                        <PlayIcon size={18} fill="currentColor" aria-hidden />
                      </span>
                    </span>
                    {preview.minutes !== null && (
                      <span className="absolute bottom-2.5 right-3 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium tabular-nums text-white">
                        {preview.minutes} min
                      </span>
                    )}
                  </span>
                  <span className="flex flex-1 flex-col p-4">
                    <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-ws-subtle">
                      {preview.school ? SCHOOL_BY_SLUG[preview.school].short : "Free lesson"}
                    </span>
                    <span className="mt-1.5 line-clamp-2 font-display text-[16px] font-semibold leading-[1.3] text-ws-primary">
                      {preview.lessonTitle}
                    </span>
                    <span className="mt-1 text-[13px] text-ws-muted">{preview.courseTitle}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>

      <Dialog open={open !== null} onOpenChange={(next) => !next && setOpen(null)}>
        {/* sm:max-w-3xl repeats the unprefixed override: DialogContent's own
            default carries `sm:max-w-sm`, and at >=640px that rule sits later
            in the generated stylesheet than a bare `max-w-3xl` and would win
            — so the dialog would stay small on desktop without it. */}
        <DialogContent className="max-w-3xl sm:max-w-3xl overflow-hidden p-0">
          {open && (
            <>
              {/* Mounted only while open, so closing the dialog stops playback. */}
              <video
                key={open.lessonId}
                src={open.videoUrl}
                poster={open.posterUrl ?? undefined}
                controls
                autoPlay
                playsInline
                className="aspect-video w-full bg-black"
              />
              <div className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <DialogTitle className="truncate font-display text-[17px] font-semibold text-ws-primary">
                    {open.lessonTitle}
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 text-[13px] text-ws-muted">
                    A free lesson from {open.courseTitle}
                  </DialogDescription>
                </div>
                <Link
                  href={`/programs/${open.courseSlug}`}
                  className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-ws-brand px-6 text-[14px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"
                >
                  View the program
                </Link>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
