import Link from "next/link"
import { cn } from "@/lib/utils"
import { plural } from "@/components/programs/format"
import { SCHOOL_SECTION, SectionHead } from "@/components/schools/section-head"
import { topicMap, type SchoolProgram, type SharedTopic } from "@/components/schools/model"

/** Past this many, a column hands over to the program page. */
const PER_COLUMN = 10

/**
 * `#learn` — "What you'll learn here", built only from the programs' own
 * "what you'll learn" lines (`topicMap`): de-duplicated across the school and
 * attributed to the program that teaches each one.
 *
 * With two programs that share topics it reads like a Venn diagram laid flat:
 * what only the first teaches, what both teach (the raised middle column),
 * what only the second teaches — the difference between them at a glance.
 * With three or more, the shared topics lead, tagged with how many programs
 * cover them, then each program's own. One program is simply its list.
 */
export function SchoolTopics({ programs }: { programs: SchoolProgram[] }) {
  const map = topicMap(programs)
  if (map.total === 0) return null

  const byId = new Map(programs.map(({ program }) => [program.id, program]))
  const venn = programs.length === 2 && map.shared.length > 0 && map.own.length === 2
  const single = programs.length === 1

  const lede = single
    ? `${plural(map.total, "topic")}, from ${programs[0].program.title}.`
    : map.shared.length > 0
      ? `${plural(map.total, "topic")} across the school's ${programs.length} programs — ${map.shared.length} of them taught in more than one.`
      : `${plural(map.total, "topic")} across the school's ${programs.length} programs.`

  return (
    <section id="learn" aria-labelledby="learn-heading" className={SCHOOL_SECTION}>
      <SectionHead id="learn-heading" title="What you’ll learn here" lede={lede} />

      {venn ? (
        <div className="mt-10 grid gap-3 rounded-[20px] border border-ws-hairline bg-ws-surface p-3 dark:border-transparent lg:grid-cols-3">
          <OwnColumn program={map.own[0].program} topics={map.own[0].topics} region="a" />
          <div className="rounded-[14px] bg-ws-raised p-6 sm:p-7">
            <VennMark region="both" />
            <h3 className="mt-4 font-display text-[17px] font-semibold tracking-[-0.01em] text-ws-primary">
              In both programs
            </h3>
            <p className="mt-1 text-[13px] tabular-nums text-ws-muted">{plural(map.shared.length, "shared topic")}</p>
            <TopicList items={map.shared.map((t) => t.text)} />
          </div>
          <OwnColumn program={map.own[1].program} topics={map.own[1].topics} region="b" />
        </div>
      ) : (
        <div className="mt-10 space-y-3">
          {map.shared.length > 0 && <SharedBlock shared={map.shared} total={programs.length} byId={byId} />}
          <div
            className={cn(
              "grid gap-3",
              map.own.length === 2 && "md:grid-cols-2",
              map.own.length > 2 && "md:grid-cols-2 lg:grid-cols-3"
            )}
          >
            {map.own.map(({ program, topics }) => (
              <div
                key={program.id}
                className="rounded-[20px] border border-ws-hairline bg-ws-surface dark:border-transparent"
              >
                <OwnColumn program={program} topics={topics} single={single} exclusive={map.shared.length > 0} />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function OwnColumn({
  program,
  topics,
  single = false,
  exclusive = true,
  region,
}: {
  program: SchoolProgram["program"]
  topics: string[]
  single?: boolean
  /** Some topics are shared elsewhere, so this column's are the ones only this program teaches. */
  exclusive?: boolean
  /** Set in the two-program layout: which side of the diagram this column is. */
  region?: "a" | "b"
}) {
  const shown = topics.slice(0, PER_COLUMN)
  const more = topics.length - shown.length
  return (
    <div className="p-6 sm:p-7">
      {region && <VennMark region={region} />}
      <h3 className={cn("font-display text-[17px] font-semibold tracking-[-0.01em] text-ws-primary", region && "mt-4")}>
        <Link
          href={`/programs/${program.slug}`}
          className="rounded-sm decoration-ws-hairline underline-offset-4 transition-colors duration-[var(--ws-motion-fast)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
        >
          {program.title}
        </Link>
      </h3>
      <p className="mt-1 text-[13px] tabular-nums text-ws-muted">
        {single || !exclusive ? plural(topics.length, "topic") : `${plural(topics.length, "topic")} only here`}
      </p>
      <TopicList items={shown} columns={single && shown.length > 4} />
      {more > 0 && (
        <Link
          href={`/programs/${program.slug}`}
          className="mt-5 inline-flex rounded-sm text-[13.5px] font-semibold text-ws-primary underline decoration-ws-hairline underline-offset-4 transition-colors duration-[var(--ws-motion-fast)] hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
        >
          and {plural(more, "more topic")}
        </Link>
      )}
    </div>
  )
}

function SharedBlock({
  shared,
  total,
  byId,
}: {
  shared: SharedTopic[]
  total: number
  byId: Map<string, SchoolProgram["program"]>
}) {
  return (
    <div className="rounded-[20px] bg-ws-raised p-6 sm:p-7">
      <h3 className="font-display text-[17px] font-semibold tracking-[-0.01em] text-ws-primary">
        In more than one program
      </h3>
      <p className="mt-1 text-[13px] tabular-nums text-ws-muted">{plural(shared.length, "shared topic")}</p>
      <ul className="mt-5 grid gap-x-10 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {shared.map((topic) => (
          <li key={topic.text} className="flex items-start gap-3 text-[15px] leading-snug text-ws-primary">
            <span aria-hidden className="mt-[0.45em] size-2 shrink-0 rounded-full ring-[1.5px] ring-ws-muted" />
            <span className="min-w-0">
              {topic.text}
              <span className="mt-0.5 block text-[12.5px] text-ws-muted">
                {topic.programIds.length === total
                  ? `All ${total} programs`
                  : topic.programIds.map((id) => byId.get(id)?.title).filter(Boolean).join(" · ")}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Two overlapping rings with one region filled — which part of the diagram a
 * column is: the first program alone, both, or the second alone. Ink, never
 * gold; it carries the column's meaning, it doesn't decorate it. Each region
 * renders once per page, so its mask/clip ids are unique.
 */
function VennMark({ region }: { region: "a" | "both" | "b" }) {
  const A = { cx: 10, cy: 10, r: 8.25 }
  const B = { cx: 21, cy: 10, r: 8.25 }
  const id = `school-venn-${region}`
  return (
    <svg viewBox="0 0 31 20" width={37} height={24} aria-hidden className="block text-ws-primary">
      <defs>
        {region === "both" ? (
          <clipPath id={id}>
            <circle {...A} />
          </clipPath>
        ) : (
          <mask id={id}>
            <rect width="31" height="20" fill="white" />
            <circle {...(region === "a" ? B : A)} fill="black" />
          </mask>
        )}
      </defs>
      {region === "both" ? (
        <circle {...B} fill="currentColor" clipPath={`url(#${id})`} />
      ) : (
        <circle {...(region === "a" ? A : B)} fill="currentColor" mask={`url(#${id})`} />
      )}
      <circle {...A} fill="none" stroke="currentColor" strokeOpacity={0.4} strokeWidth={1.25} />
      <circle {...B} fill="none" stroke="currentColor" strokeOpacity={0.4} strokeWidth={1.25} />
    </svg>
  )
}

function TopicList({ items, columns = false }: { items: string[]; columns?: boolean }) {
  return (
    <ul className={cn("mt-5 grid gap-x-10 gap-y-3", columns && "sm:grid-cols-2 lg:grid-cols-3")}>
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-[15px] leading-snug text-ws-primary">
          <span aria-hidden className="mt-[0.45em] size-2 shrink-0 rounded-full ring-[1.5px] ring-ws-muted" />
          {item}
        </li>
      ))}
    </ul>
  )
}
