import { SCHOOL_SECTION, SectionHead } from "@/components/schools/section-head"

/**
 * `#learn`, `#audience` and `#careers` — the school's own lists from
 * institutional blueprint §8 ("What you'll learn", "Who it's for", "Career /
 * economic applications"). Ink and muted only: no gold bullets or cards.
 * Hidden when the list is empty.
 */
export function SchoolPoints({
  id,
  title,
  items,
  layout,
}: {
  id: "learn" | "audience" | "careers"
  title: string
  items: readonly string[]
  layout: "list" | "cards"
}) {
  if (items.length === 0) return null

  return (
    <section id={id} aria-labelledby={`${id}-heading`} className={SCHOOL_SECTION}>
      <SectionHead id={`${id}-heading`} title={title} />

      {layout === "list" ? (
        <ul className="mt-10 grid gap-x-10 gap-y-4 md:grid-cols-2">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-3 text-[16px] leading-snug text-ws-primary">
              <span aria-hidden className="mt-[0.45em] size-2 shrink-0 rounded-full ring-[1.5px] ring-ws-muted" />
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <ol className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => (
            <li
              key={item}
              className="rounded-[20px] border border-ws-hairline bg-ws-surface p-6 dark:border-transparent"
            >
              <span className="text-[13px] tabular-nums text-ws-muted">{String(i + 1).padStart(2, "0")}</span>
              <p className="mt-3 text-[16px] leading-snug text-ws-primary">{item}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
