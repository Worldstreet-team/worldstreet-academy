"use client"

import Image from "next/image"
import Link from "next/link"
import { PlayIcon } from "lucide-react"
import type { FreePreview } from "@/lib/actions/student"
import { BRAND } from "@/lib/brand"
import { SCHOOL_BY_SLUG } from "@/lib/schools"
import { PreviewProvider, PreviewTrigger, type ProgramPreview } from "@/components/programs/preview-player"
import { SectionTitle } from "@/components/marketing/section-heading"
import { plural } from "./model"

/**
 * `#free-lessons` — lessons instructors made free to watch, one per program,
 * each opening the program page's own preview player (the dialog lists them
 * all and switches in place). Under each, the program it comes from, as a
 * link. Hidden when there are none.
 */
export function FreeLessons({ lessons }: { lessons: FreePreview[] }) {
  if (lessons.length === 0) return null
  // Durations are whole minutes here; the player's list shows exact clocks, so it gets none rather than a rounded one.
  const previews: ProgramPreview[] = lessons.map((l) => ({
    id: l.lessonId,
    title: l.lessonTitle,
    durationSec: null,
    videoUrl: l.videoUrl,
    posterUrl: l.posterUrl,
    program: l.courseTitle,
  }))

  return (
    <PreviewProvider previews={previews} programTitle={BRAND.name}>
      <section id="free-lessons" aria-labelledby="free-lessons-heading" className="scroll-mt-24">
        <SectionTitle id="free-lessons-heading" className="max-w-2xl text-balance">
          Watch a free lesson before you choose
        </SectionTitle>
        <p className="mt-4 max-w-xl text-pretty text-[16px] leading-relaxed text-ws-muted md:text-[17px]">
          {plural(lessons.length, "lesson")} instructors have opened to everyone. No account needed.
        </p>
        <ul className="mt-10 grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
          {lessons.map((lesson) => (
            <li key={lesson.lessonId}>
              <PreviewTrigger
                lessonId={lesson.lessonId}
                label={`Play ${lesson.lessonTitle}`}
                className="group block w-full rounded-[20px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 focus-visible:ring-offset-4 focus-visible:ring-offset-ws-page"
              >
                <span className="relative block aspect-video overflow-hidden rounded-[20px] bg-ws-sunken">
                  {lesson.posterUrl && (
                    <Image
                      src={lesson.posterUrl}
                      alt=""
                      fill
                      sizes="(min-width: 1280px) 397px, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover transition-transform duration-600 ease-[var(--ws-ease-rise)] motion-safe:group-hover:scale-[1.03]"
                    />
                  )}
                  <span aria-hidden className="absolute inset-0 bg-linear-to-t from-black/60 via-black/10 to-transparent" />
                  <span aria-hidden className="absolute inset-0 flex items-center justify-center">
                    <span className="flex size-14 items-center justify-center rounded-full bg-white text-black transition-transform duration-200 ease-[var(--ws-ease)] motion-safe:group-hover:scale-105">
                      <PlayIcon size={20} fill="currentColor" className="ml-0.5" />
                    </span>
                  </span>
                  {lesson.minutes !== null && (
                    <span className="absolute bottom-3 right-3 rounded-full bg-black/65 px-2.5 py-1 text-[12px] font-semibold tabular-nums text-white">
                      {lesson.minutes} min
                    </span>
                  )}
                </span>
                <span className="mt-4 block font-display text-[16px] font-semibold leading-snug text-ws-primary">
                  {lesson.lessonTitle}
                </span>
              </PreviewTrigger>
              <p className="mt-1 text-[13.5px] text-ws-muted">
                From{" "}
                <Link
                  href={`/programs/${lesson.courseSlug}`}
                  className="font-medium text-ws-primary underline decoration-ws-hairline underline-offset-4 transition-colors hover:decoration-ws-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
                >
                  {lesson.courseTitle}
                </Link>
                {lesson.school && <> · {SCHOOL_BY_SLUG[lesson.school].short}</>}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </PreviewProvider>
  )
}
