"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRightIcon, PlayIcon, SearchXIcon } from "lucide-react"
import type { SchoolSlug } from "@/lib/schools"
import { BRAND } from "@/lib/brand"
import { Segmented } from "@/components/ui/system"
import { Reveal } from "@/components/marketing/motion/reveal"
import { useMotionOK } from "@/components/marketing/motion/bus"
import { cn } from "@/lib/utils"
import { CoverMosaic } from "./cover-mosaic"
import { IndexBar } from "./index-bar"
import { SchoolRow, ProgramLink } from "./school-row"
import { SearchField } from "./search-field"
import {
  LEVEL_LABEL,
  filterIndex,
  plural,
  usd,
  type Level,
  type LevelFilter,
  type SchoolsIndexData,
} from "./model"

export type IndexStats = {
  schools: number
  /** Programs across the eight schools. */
  programs: number
  /** Cheapest way into any school's program, whole USD; null when none is priced. */
  from: number | null
  instructors: number
  /** Free preview lessons the closing section can play. */
  freeLessons: number
}

/**
 * `/schools` below the navbar and above the closing section: the header
 * (headline, real totals, the search, the cover wall), the follow-along bar,
 * and the eight schools as editorial rows — all driven by one query, typed
 * into either search field, plus a level filter that appears only when the
 * catalogue really spans more than one level.
 *
 * The query and level live in the URL (`?q=`, `?level=`, replaced in place,
 * no navigation), so a filtered view can be shared and survives a reload.
 */
export function SchoolsIndex({
  data,
  stats,
  initialQuery,
  initialLevel,
  notice,
}: {
  data: SchoolsIndexData
  stats: IndexStats
  initialQuery: string
  initialLevel: LevelFilter
  /** The school-first gate's welcome, when it applies (server-rendered). */
  notice?: React.ReactNode
}) {
  const ok = useMotionOK()
  const [query, setQuery] = React.useState(initialQuery)
  const [level, setLevel] = React.useState<LevelFilter>(initialLevel)
  const result = React.useMemo(() => filterIndex(data, query, level), [data, query, level])
  const lit = React.useMemo(
    () => (result.active ? new Set(result.hits.map((h) => h.school.slug)) : null),
    [result]
  )

  // ── The URL follows the filter (debounced, replaced in place).
  React.useEffect(() => {
    const t = window.setTimeout(() => {
      const url = new URL(window.location.href)
      const q = query.trim()
      if (q) url.searchParams.set("q", q)
      else url.searchParams.delete("q")
      if (level !== "all") url.searchParams.set("level", level)
      else url.searchParams.delete("level")
      if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url)
    }, 250)
    return () => window.clearTimeout(t)
  }, [query, level])

  // ── Jumps: a school hidden by the filter clears it first, then the page scrolls once it is back.
  const [pending, setPending] = React.useState<SchoolSlug | null>(null)
  const jump = React.useCallback(
    (slug: SchoolSlug) => {
      if (lit && !lit.has(slug)) {
        setQuery("")
        setLevel("all")
      }
      setPending(slug)
    },
    [lit]
  )
  React.useEffect(() => {
    if (!pending) return
    const el = document.getElementById(pending)
    if (el) {
      el.scrollIntoView({ behavior: ok ? "smooth" : "auto", block: "start" })
      const url = new URL(window.location.href)
      url.hash = pending
      window.history.replaceState(window.history.state, "", url)
    }
    setPending(null)
  }, [pending, ok])

  const listRef = React.useRef<HTMLElement>(null)
  const heroSearchRef = React.useRef<HTMLDivElement>(null)
  const heroInputRef = React.useRef<HTMLInputElement>(null)
  const toResults = React.useCallback(() => {
    heroInputRef.current?.blur()
    listRef.current?.scrollIntoView({ behavior: ok ? "smooth" : "auto", block: "start" })
  }, [ok])

  // ── Follow-along bar: shown once the header's search is above the viewport and the list is on screen.
  const [barShown, setBarShown] = React.useState(false)
  React.useEffect(() => {
    const search = heroSearchRef.current
    const list = listRef.current
    if (!search || !list) return
    let past = false
    let inList = false
    const sync = () => setBarShown(past && inList)
    const a = new IntersectionObserver(
      (entries) => {
        const e = entries[entries.length - 1]
        past = !e.isIntersecting && e.boundingClientRect.top < (e.rootBounds?.top ?? 0)
        sync()
      },
      { rootMargin: "-65px 0px 0px 0px" }
    )
    const b = new IntersectionObserver(
      (entries) => {
        inList = entries[entries.length - 1].isIntersecting
        sync()
      },
      { rootMargin: "-130px 0px -35% 0px" }
    )
    a.observe(search)
    b.observe(list)
    return () => {
      a.disconnect()
      b.disconnect()
    }
  }, [])

  // ── Which school is being read: the row crossing a line ~45% down the viewport.
  const [current, setCurrent] = React.useState<SchoolSlug | null>(null)
  React.useEffect(() => {
    const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-school-row]"))
    if (rows.length === 0) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setCurrent(e.target.getAttribute("data-school-row") as SchoolSlug)
        }
      },
      { rootMargin: "-45% 0px -54% 0px" }
    )
    rows.forEach((r) => io.observe(r))
    return () => io.disconnect()
  }, [])

  const clear = () => {
    setQuery("")
    setLevel("all")
  }

  const visible = new Map(result.hits.map((h) => [h.school.slug, h]))
  const empty = result.active && result.hits.length === 0 && result.others.length === 0
  const levelOptions = React.useMemo(
    () => [
      { key: "all" as LevelFilter, label: "All levels" },
      ...data.levels.map((l: Level) => ({ key: l as LevelFilter, label: LEVEL_LABEL[l] })),
    ],
    [data.levels]
  )

  return (
    <>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <section aria-labelledby="schools-heading" className="relative isolate overflow-x-clip">
        <div className="mx-auto max-w-7xl px-6 pb-14 pt-8 md:pb-20 md:pt-14">
          {notice}
          <div className="lg:grid lg:grid-cols-12 lg:items-center lg:gap-x-12">
            <div className="lg:col-span-6">
              <Reveal as="h1" y={18} duration={0.8} amount={0}>
                <span
                  id="schools-heading"
                  className="block text-balance font-display text-[clamp(2.375rem,4.4vw,3.5rem)] font-semibold leading-[1.04] tracking-[-0.03em] text-ws-primary"
                >
                  Explore the Schools of {BRAND.name}
                </span>
              </Reveal>
              <Reveal delay={0.08} y={14} amount={0}>
                <p className="mt-5 max-w-md text-pretty text-[16px] leading-relaxed text-ws-muted md:text-[17px]">
                  Your future can take many directions. Choose the school that matches your interests,
                  goals and ambitions.
                </p>
              </Reveal>
              <Reveal delay={0.14} y={14} amount={0}>
                <Totals stats={stats} />
              </Reveal>
              <Reveal delay={0.2} y={14} amount={0} className="mt-8">
                <div ref={heroSearchRef}>
                  <SearchField
                    id="schools-search"
                    inputRef={heroInputRef}
                    value={query}
                    onChange={setQuery}
                    onSubmit={toResults}
                  />
                </div>
                {data.levels.length > 1 && (
                  <Segmented
                    options={levelOptions}
                    value={level}
                    onChange={setLevel}
                    size="sm"
                    className="mt-3"
                  />
                )}
                <p aria-live="polite" className="mt-4 flex min-h-6 flex-wrap items-center gap-x-5 gap-y-2 text-[14px]">
                  {result.active ? (
                    <>
                      <span className="tabular-nums text-ws-muted">{summaryOf(result.hits.length, result.programCount)}</span>
                      <button
                        type="button"
                        onClick={toResults}
                        className="inline-flex items-center gap-1.5 font-semibold text-ws-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 lg:hidden"
                      >
                        See results
                      </button>
                      <button
                        type="button"
                        onClick={clear}
                        className="font-semibold text-ws-muted underline-offset-4 hover:text-ws-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
                      >
                        Clear
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/programs"
                        className="group inline-flex items-center gap-1.5 font-semibold text-ws-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
                      >
                        Browse all {plural(data.total, "program")}
                        <ArrowRightIcon size={14} aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5" />
                      </Link>
                      {stats.freeLessons > 0 && (
                        <a
                          href="#free-lessons"
                          className="inline-flex items-center gap-2 font-semibold text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
                        >
                          <PlayIcon size={12} fill="currentColor" aria-hidden />
                          Watch a free lesson
                        </a>
                      )}
                    </>
                  )}
                </p>
              </Reveal>
            </div>

            <div className="mt-12 lg:col-span-6 lg:mt-0">
              <CoverMosaic schools={data.schools} lit={lit} onJump={jump} />
            </div>
          </div>
        </div>
      </section>

      <IndexBar
        show={barShown}
        schools={data.schools}
        lit={lit}
        current={current}
        query={query}
        onQuery={setQuery}
        onSubmit={toResults}
        onJump={jump}
      />

      {/* ── The schools ────────────────────────────────────────────────── */}
      <section ref={listRef} aria-label="Schools" className="mx-auto max-w-7xl scroll-mt-24 px-6 md:scroll-mt-36">
        {result.active && !empty && (
          <div className="mb-12 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-ws-hairline pb-5">
            <p className="text-[15px] text-ws-muted">
              <span className="font-semibold tabular-nums text-ws-primary">
                {summaryOf(result.hits.length, result.programCount)}
              </span>
              {query.trim() && <> for “{query.trim()}”</>}
              {level !== "all" && <> at {LEVEL_LABEL[level].toLowerCase()} level</>}
            </p>
            <button
              type="button"
              onClick={clear}
              className="text-[14px] font-semibold text-ws-muted underline-offset-4 hover:text-ws-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
            >
              Show all schools
            </button>
          </div>
        )}

        <div className="flex flex-col gap-20 md:gap-28 lg:gap-32">
          {data.schools.map((school) => {
            const hit = visible.get(school.slug)
            const order = hit ? result.hits.indexOf(hit) : 0
            return (
              <SchoolRow
                key={school.slug}
                hit={hit ?? { school, programs: school.programs, hidden: 0 }}
                flip={order % 2 === 1}
                tokens={result.tokens}
                hidden={!hit}
              />
            )
          })}
        </div>

        {result.others.length > 0 && (
          <div className={cn(result.hits.length > 0 && "mt-24")}>
            <h2 className="font-display text-[22px] font-semibold tracking-[-0.01em] text-ws-primary">
              {result.hits.length > 0 ? "More programs" : "Programs"}
            </h2>
            <p className="mt-1.5 text-[14px] text-ws-muted">
              {result.others.length === 1 ? "A program" : "Programs"} not yet part of one of the eight schools.
            </p>
            <ul className="mt-5 grid gap-3 md:grid-cols-2">
              {result.others.map((program) => (
                <li
                  key={program.id}
                  className="overflow-hidden rounded-[20px] border border-ws-hairline bg-ws-surface dark:border-transparent"
                >
                  <ProgramLink program={program} tokens={result.tokens} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {empty && <NoMatch query={query.trim()} level={level} total={data.total} schools={data.schools} onClear={clear} onJump={jump} />}
      </section>
    </>
  )
}

/** "2 schools · 3 programs", "3 programs" (none in a school), "1 school" (it has none open), or "No matches". */
function summaryOf(schools: number, programs: number): string {
  const parts = [schools > 0 ? plural(schools, "school") : null, programs > 0 ? plural(programs, "program") : null]
  return parts.filter(Boolean).join(" · ") || "No matches"
}

/** "8 schools · 10 programs · from $49 · 1 instructor" — only what is real and not zero. */
function Totals({ stats }: { stats: IndexStats }) {
  const bits: React.ReactNode[] = [
    <>
      <b className="font-semibold text-ws-primary">{stats.schools}</b> schools
    </>,
  ]
  if (stats.programs > 0) {
    bits.push(
      <>
        <b className="font-semibold text-ws-primary">{stats.programs}</b> {stats.programs === 1 ? "program" : "programs"}
      </>
    )
  }
  if (stats.from !== null) {
    bits.push(
      stats.from === 0 ? (
        <>
          <b className="font-semibold text-ws-primary">free</b> to start
        </>
      ) : (
        <>
          from <b className="font-semibold text-ws-primary">{usd(stats.from)}</b>
        </>
      )
    )
  }
  if (stats.instructors > 0) {
    bits.push(
      <>
        <b className="font-semibold text-ws-primary">{stats.instructors}</b>{" "}
        {stats.instructors === 1 ? "instructor" : "instructors"}
      </>
    )
  }
  // Two halves that each keep to one line: on a phone they stack (no
  // separator stranded at a line's end); from sm they run on as one line.
  const halves = [bits.slice(0, 2), bits.slice(2)].filter((h) => h.length > 0)
  const dot = <span aria-hidden className="text-ws-subtle">·</span>
  return (
    <p className="mt-6 flex flex-col gap-1 text-[15px] tabular-nums text-ws-muted sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2.5">
      {halves.map((half, h) => (
        <span key={h} className="flex items-center gap-x-2.5 whitespace-nowrap">
          {h > 0 && <span className="hidden sm:inline">{dot}</span>}
          {half.map((bit, i) => (
            <React.Fragment key={i}>
              {i > 0 && dot}
              <span>{bit}</span>
            </React.Fragment>
          ))}
        </span>
      ))}
    </p>
  )
}

/** Nothing matched: say so plainly, then offer the eight schools and the full list as the way on. */
function NoMatch({
  query,
  level,
  total,
  schools,
  onClear,
  onJump,
}: {
  query: string
  level: LevelFilter
  total: number
  schools: SchoolsIndexData["schools"]
  onClear: () => void
  onJump: (slug: SchoolSlug) => void
}) {
  return (
    <div className="rounded-[20px] border border-ws-hairline bg-ws-surface px-6 py-12 text-center dark:border-transparent md:px-12 md:py-16">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-ws-chip text-ws-muted">
        <SearchXIcon size={20} aria-hidden />
      </span>
      <h2 className="mt-5 text-balance font-display text-[22px] font-semibold tracking-[-0.01em] text-ws-primary md:text-[26px]">
        {query ? <>Nothing matches “{query}”</> : "Nothing matches that filter"}
        {query && level !== "all" && <> at {LEVEL_LABEL[level].toLowerCase()} level</>}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-pretty text-[15px] leading-relaxed text-ws-muted">
        Try a shorter or broader word, or start from one of the eight schools.
      </p>
      <ul className="mx-auto mt-7 flex max-w-3xl flex-wrap justify-center gap-2">
        {schools.map((school) => (
          <li key={school.slug}>
            <button
              type="button"
              onClick={() => onJump(school.slug)}
              className="inline-flex h-9 items-center rounded-full bg-ws-page px-4 text-[13px] font-medium text-ws-primary ring-1 ring-ws-hairline transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 dark:ring-0"
            >
              {school.short}
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-[14px]">
        <button
          type="button"
          onClick={onClear}
          className="font-semibold text-ws-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
        >
          Clear search
        </button>
        <Link
          href="/programs"
          className="group inline-flex items-center gap-1.5 font-semibold text-ws-muted hover:text-ws-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
        >
          Browse all {plural(total, "program")}
          <ArrowRightIcon size={14} aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  )
}
