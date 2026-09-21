import Image from "next/image"
import { PlayIcon } from "lucide-react"
import { plural, formatClock } from "@/components/programs/format"
import { PreviewTrigger, type ProgramPreview } from "@/components/programs/preview-player"
import { SCHOOL_SECTION, SectionHead } from "@/components/schools/section-head"

/** A row and a half at most; the dialog lists every one of them. */
const SHOWN = 6

/**
 * `#free-lessons` — the lessons instructors made free to watch, across the
 * school's programs, each opening the program page's own preview player
 * (`PreviewProvider` wraps the page). Hidden when there are none.
 */
export function SchoolFreeLessons({ previews }: { previews: ProgramPreview[] }) {
  if (previews.length === 0) return null
  const shown = previews.slice(0, SHOWN)

  return (
    <section id="free-lessons" aria-labelledby="free-lessons-heading" className={SCHOOL_SECTION}>
      <SectionHead
        id="free-lessons-heading"
        title="Watch a free lesson"
        lede={`${plural(previews.length, "lesson")} from this school's programs, free to watch before you choose.`}
      />
      <ul className="mt-10 grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((lesson) => (
          <li key={lesson.id}>
            <PreviewTrigger
              lessonId={lesson.id}
              className="group block w-full rounded-[20px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 focus-visible:ring-offset-4 focus-visible:ring-offset-ws-page"
            >
              <span className="relative block aspect-video overflow-hidden rounded-[20px] bg-ws-sunken">
                {lesson.posterUrl && (
                  <Image
                    src={lesson.posterUrl}
                    alt=""
                    fill
                    sizes="(min-width: 1280px) 397px, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                  />
                )}
                <span aria-hidden className="absolute inset-0 bg-linear-to-t from-black/60 via-black/10 to-transparent" />
                <span aria-hidden className="absolute inset-0 bg-black/0 transition-colors duration-[var(--ws-motion-fast)] group-hover:bg-black/15" />
                <span aria-hidden className="absolute inset-0 flex items-center justify-center">
                  <span className="flex size-14 items-center justify-center rounded-full bg-white text-black">
                    <PlayIcon size={20} fill="currentColor" className="ml-0.5" />
                  </span>
                </span>
                {lesson.durationSec !== null && (
                  <span className="absolute bottom-3 right-3 rounded-full bg-black/65 px-2.5 py-1 text-[12px] font-semibold tabular-nums text-white">
                    {formatClock(lesson.durationSec)}
                  </span>
                )}
              </span>
              <span className="mt-4 block font-display text-[16px] font-semibold leading-snug text-ws-primary">
                {lesson.title}
              </span>
              {lesson.program && <span className="mt-1 block text-[13.5px] text-ws-muted">{lesson.program}</span>}
            </PreviewTrigger>
          </li>
        ))}
      </ul>
    </section>
  )
}
