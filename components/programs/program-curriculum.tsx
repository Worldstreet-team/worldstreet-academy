"use client"

import * as React from "react"
import { ChevronDownIcon, CirclePlayIcon, FileTextIcon, LockIcon, PlayIcon, RadioIcon } from "lucide-react"
import type { ProgramCurriculumLesson } from "@/lib/actions/program-page"
import { PACKAGE_LABEL } from "@/lib/entitlements"
import { cn } from "@/lib/utils"
import { PreviewTrigger } from "@/components/programs/preview-player"
import { formatClock, formatLength, plural } from "@/components/programs/format"
import { PROGRAM_H2, SECTION_SCROLL_MT } from "@/components/programs/section-title"

/** Rows shown before "Show all" on a flat list; sections shown before "Show more sections". */
const FLAT_LIMIT = 10
const SECTION_LIMIT = 10

type Group = { key: string; title: string | null; lessons: ProgramCurriculumLesson[] }

/** Consecutive runs of one `sectionTitle`, in course order. Untitled runs stay untitled. */
function groupLessons(lessons: ProgramCurriculumLesson[]): Group[] {
  const groups: Group[] = []
  for (const lesson of lessons) {
    const last = groups[groups.length - 1]
    if (last && last.title === lesson.sectionTitle) last.lessons.push(lesson)
    else groups.push({ key: `${groups.length}-${lesson.id}`, title: lesson.sectionTitle, lessons: [lesson] })
  }
  return groups
}

function groupSeconds(lessons: ProgramCurriculumLesson[]): number {
  return lessons.reduce((sum, l) => sum + (l.durationSec ?? 0), 0)
}

const TYPE_ICON = { video: CirclePlayIcon, text: FileTextIcon, live: RadioIcon } as const
const TYPE_LABEL = { video: "Video", text: "Reading", live: "Live class" } as const

/**
 * "Program content" — the published curriculum, Udemy's shape in the house
 * style. Titled sections are an accordion (the first one open; Expand all);
 * lessons without a section are plain rows, never given an invented section
 * name. Free video lessons carry a Preview that plays in the page's preview
 * dialog; lessons a higher tier opens name that tier. Every figure comes from
 * the published lessons themselves.
 */
export function ProgramCurriculum({ lessons, id }: { lessons: ProgramCurriculumLesson[]; id: string }) {
  const groups = React.useMemo(() => groupLessons(lessons), [lessons])
  const sections = groups.filter((g) => g.title !== null)
  const sectioned = sections.length > 0
  const totalSec = groupSeconds(lessons)

  const [open, setOpen] = React.useState<Set<string>>(() => new Set(sections[0] ? [sections[0].key] : []))
  const [showAll, setShowAll] = React.useState(false)

  const allOpen = sections.length > 0 && sections.every((s) => open.has(s.key))
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  // Flat lists cut by rows, sectioned lists by sections.
  const visibleGroups = sectioned && !showAll ? cutAtSections(groups, SECTION_LIMIT) : groups
  const hiddenSections = sectioned ? sections.length - visibleGroups.filter((g) => g.title !== null).length : 0
  const flatRows = !sectioned && !showAll ? lessons.slice(0, FLAT_LIMIT) : lessons

  return (
    <section id={id} aria-labelledby="curriculum-heading" className={SECTION_SCROLL_MT}>
      <h2 id="curriculum-heading" className={PROGRAM_H2}>
        Program content
      </h2>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p className="text-[14px] tabular-nums text-ws-muted">
          {sectioned && <>{plural(sections.length, "section")} · </>}
          {plural(lessons.length, "lesson")}
          {totalSec > 0 && <> · {formatLength(totalSec)} total length</>}
        </p>
        {sections.length > 1 && (
          <button
            type="button"
            onClick={() => setOpen(allOpen ? new Set() : new Set(sections.map((s) => s.key)))}
            className="rounded-sm text-[14px] font-semibold text-ws-primary underline decoration-ws-hairline underline-offset-4 transition-colors duration-[var(--ws-motion-fast)] hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
          >
            {allOpen ? "Collapse all sections" : "Expand all sections"}
          </button>
        )}
      </div>

      <div className="mt-5 overflow-hidden rounded-[20px] border border-ws-hairline bg-ws-surface dark:border-transparent">
        {sectioned ? (
          <div className="divide-y divide-ws-hairline">
            {visibleGroups.map((group) =>
              group.title === null ? (
                <LessonRows key={group.key} lessons={group.lessons} />
              ) : (
                <SectionGroup
                  key={group.key}
                  group={group}
                  expanded={open.has(group.key)}
                  onToggle={() => toggle(group.key)}
                />
              )
            )}
          </div>
        ) : (
          <LessonRows lessons={flatRows} />
        )}

        {(sectioned ? hiddenSections > 0 : lessons.length > FLAT_LIMIT && !showAll) && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="flex h-12 w-full items-center justify-center border-t border-ws-hairline text-[14px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ws-brand/40"
          >
            {sectioned ? `Show ${plural(hiddenSections, "more section")}` : `Show all ${lessons.length.toLocaleString("en-US")} lessons`}
          </button>
        )}
      </div>
    </section>
  )
}

/** Groups up to (and including) the `limit`-th titled section; untitled runs between them ride along. */
function cutAtSections(groups: Group[], limit: number): Group[] {
  const out: Group[] = []
  let seen = 0
  for (const group of groups) {
    if (group.title !== null) {
      if (seen === limit) break
      seen += 1
    }
    out.push(group)
  }
  return out
}

function SectionGroup({ group, expanded, onToggle }: { group: Group; expanded: boolean; onToggle: () => void }) {
  const panelId = `section-panel-${group.key}`
  const seconds = groupSeconds(group.lessons)
  return (
    <div>
      <h3>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-center gap-3 bg-ws-raised/50 px-5 py-4 text-left transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ws-brand/40"
        >
          <ChevronDownIcon
            size={18}
            aria-hidden
            className={cn(
              "shrink-0 text-ws-muted transition-transform duration-[var(--ws-motion-base)] ease-[var(--ws-ease)] motion-reduce:transition-none",
              expanded && "rotate-180"
            )}
          />
          <span className="min-w-0 flex-1 font-display text-[15px] font-semibold text-ws-primary">{group.title}</span>
          <span className="shrink-0 text-[13px] tabular-nums text-ws-muted">
            {plural(group.lessons.length, "lesson")}
            {seconds > 0 && <span className="hidden sm:inline"> · {formatLength(seconds)}</span>}
          </span>
        </button>
      </h3>
      {expanded && (
        <div id={panelId} className="ws-animate-fade border-t border-ws-hairline">
          <LessonRows lessons={group.lessons} />
        </div>
      )}
    </div>
  )
}

function LessonRows({ lessons }: { lessons: ProgramCurriculumLesson[] }) {
  return (
    <ul className="divide-y divide-ws-hairline">
      {lessons.map((lesson) => {
        const Icon = TYPE_ICON[lesson.type]
        const canPreview = lesson.isFree && lesson.videoUrl !== null
        return (
          <li key={lesson.id} className="flex items-start gap-3.5 px-5 py-3.5">
            <Icon size={17} className="mt-[3px] shrink-0 text-ws-muted" aria-label={TYPE_LABEL[lesson.type]} role="img" />
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="min-w-0 text-[14.5px] leading-snug text-ws-primary">{lesson.title}</span>
              {canPreview ? (
                <PreviewTrigger
                  lessonId={lesson.id}
                  label={`Preview: ${lesson.title}`}
                  className="inline-flex items-center gap-1.5 rounded-sm text-[13px] font-semibold text-ws-primary underline decoration-ws-hairline underline-offset-4 transition-colors duration-[var(--ws-motion-fast)] hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
                >
                  <PlayIcon size={11} fill="currentColor" aria-hidden />
                  Preview
                </PreviewTrigger>
              ) : lesson.isFree ? (
                <span className="rounded-full border border-ws-hairline px-2 py-0.5 text-[11.5px] font-medium text-ws-muted">
                  Free lesson
                </span>
              ) : lesson.tier ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-ws-hairline px-2 py-0.5 text-[11.5px] font-medium text-ws-muted">
                  <LockIcon size={10} aria-hidden />
                  <span className="sr-only">Opens with the </span>
                  {PACKAGE_LABEL[lesson.tier]}
                  <span className="sr-only"> package</span>
                </span>
              ) : null}
            </div>
            <span className="mt-[2px] shrink-0 text-[13px] tabular-nums text-ws-muted">
              {lesson.durationSec !== null ? formatClock(lesson.durationSec) : lesson.type === "live" ? "Live" : ""}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
