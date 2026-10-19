import { CardHeader, CardShell } from "@/components/ui/system"
import { MASTERY_PART_COPY, type MasteryKey, type MasteryView } from "@/lib/mastery-score"

/**
 * One program's Mastery Score and its parts (D24). No hooks and no
 * "use client", so server and client trees can both render it. Shown only on
 * `(platform)` and `(admin)` surfaces, never on a public page.
 */
export function MasteryCard({ title, mastery }: { title: string; mastery: MasteryView }) {
  const { result, excluded, classes } = mastery
  return (
    <CardShell>
      <CardHeader
        title={title}
        subtitle="Mastery Score"
        right={
          result.score !== null ? (
            <span className="tabular-nums">
              <span className="text-[22px] font-semibold">{`${result.score}`}</span>
              <span className="text-muted-foreground">{" / 100"}</span>
            </span>
          ) : undefined
        }
      />
      {result.score === null && (
        <p className="px-4 pb-3 text-[13px] text-muted-foreground">Your score shows once two parts have data.</p>
      )}
      <ul className="divide-y divide-border/60 border-t border-border/60">
        {result.parts.map((part) => {
          const copy = MASTERY_PART_COPY[part.key]
          const hint =
            part.key === "attendance" && classes && classes.held > 0
              ? `${classes.attended} of ${classes.held} classes · joined on the web`
              : copy.hint
          return (
            <li key={part.key} className="flex min-w-0 items-center justify-between gap-3 px-4 py-3">
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[14px] font-medium">{copy.label}</span>
                <span className="truncate text-[12.5px] text-muted-foreground">{`${hint} · weighs ${part.weight}%`}</span>
              </span>
              <span className="shrink-0 text-right text-[14px] tabular-nums">
                {part.value !== null ? (
                  <span className="font-semibold">{`${part.value}%`}</span>
                ) : (
                  <span className="text-[12.5px] text-muted-foreground">{emptyText(part.key, excluded)}</span>
                )}
              </span>
            </li>
          )
        })}
      </ul>
      <p className="border-t border-border/60 px-4 py-3 text-[12.5px] text-muted-foreground">
        {"Parts your plan doesn't include, or that have no data yet, don't count; the rest are re-weighted. No cash value."}
      </p>
    </CardShell>
  )
}

function emptyText(key: MasteryKey, excluded: MasteryKey[]): string {
  if (excluded.includes(key)) return "Not in your plan"
  return key === "attendance" ? "No classes held yet" : "No data yet"
}
