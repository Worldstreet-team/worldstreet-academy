import type { Metadata } from "next"
import { Topbar } from "@/components/platform/topbar"
import { CardHeader, CardShell, EmptyState, Eyebrow, PageHeader, Rise } from "@/components/ui/system"
import { getCachedUser } from "@/lib/auth/cached"
import connectDB from "@/lib/db"
import {
  LEADERBOARD_SIZE,
  POINTS,
  pointsSummary,
  programLeaderboards,
  recentPointActivity,
  type LeaderboardRow,
  type PointActivity,
  type PointsSummary,
  type ProgramLeaderboard,
} from "@/lib/points"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Points",
  robots: { index: false, follow: false },
}

/** How points are earned, from the one table in lib/points.ts. */
const EARN_RULES = [
  { label: "Finish a lesson", value: `+${POINTS.lesson_completed}` },
  { label: "Hand in an assignment", value: `+${POINTS.assignment_submitted}` },
  { label: "Get an assignment graded", value: "+ grade ÷ 5" },
  { label: "Pass a final exam", value: `+${POINTS.exam_passed}` },
  { label: "Complete a program", value: `+${POINTS.course_completed}` },
] as const

function n(value: number): string {
  return value.toLocaleString("en-US")
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
}

/**
 * `/dashboard/points` (owner, 2026-10-03) — the student's learning points: the
 * total, the last seven days, a leaderboard for each program they're enrolled
 * in (top ten, plus their own place when it's lower) and their recent awards.
 * Points have no cash value. Behind the paid-dashboard gate, like the rest of
 * the student shell.
 */
export default async function PointsPage() {
  // The layout redirects a signed-out visitor; this only narrows the type.
  const user = await getCachedUser()
  if (!user) return null

  let data: { summary: PointsSummary; boards: ProgramLeaderboard[]; activity: PointActivity[] } | null = null
  try {
    await connectDB()
    const [summary, boards, activity] = await Promise.all([
      pointsSummary(user.id),
      programLeaderboards(user.id),
      recentPointActivity(user.id),
    ])
    data = { summary, boards, activity }
  } catch (error) {
    console.error("Points page error:", error)
  }

  return (
    <>
      <Topbar title="Points" breadcrumbOverrides={{ points: "Points" }} />
      <div className="flex-1 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 sm:px-6 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <PageHeader
            title="Points"
            subtitle="Earned as you learn — lessons, assignments, exams and finished programs. Points have no cash value."
          />

          {!data ? (
            <CardShell>
              <EmptyState title="Your points didn't load" description="Refresh the page to try again." />
            </CardShell>
          ) : (
            <>
              <Rise>
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Total" value={n(data.summary.total)} />
                  <Stat label="This week" value={`+${n(data.summary.thisWeek)}`} note="The last 7 days" />
                </div>
              </Rise>

              {data.boards.map((board, i) => (
                <Rise key={board.courseId} delay={60 * (i + 1)}>
                  <Leaderboard board={board} />
                </Rise>
              ))}

              <Rise delay={60 * (data.boards.length + 1)}>
                <CardShell>
                  <CardHeader title="Recent activity" subtitle="Newest first" />
                  {data.activity.length === 0 ? (
                    <EmptyState
                      illustration="noTransactions"
                      title="No points yet"
                      description={`Finish your next lesson to earn your first ${POINTS.lesson_completed}.`}
                    />
                  ) : (
                    <ul className="divide-y divide-border/60 border-t border-border/60">
                      {data.activity.map((a) => (
                        <li key={a.id} className="flex min-w-0 items-center gap-3 px-4 py-3">
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-[14px] font-medium">{a.label}</span>
                            <span className="truncate text-[12.5px] text-muted-foreground" title={a.courseTitle ?? undefined}>
                              {[a.courseTitle, day(a.at)].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                          <span className="shrink-0 text-[14px] font-semibold tabular-nums text-credit">+{n(a.points)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardShell>
              </Rise>

              <Rise delay={60 * (data.boards.length + 2)}>
                <CardShell>
                  <CardHeader title="How you earn points" subtitle="Each one counts once" />
                  <dl className="divide-y divide-border/60 border-t border-border/60">
                    {EARN_RULES.map((rule) => (
                      <div key={rule.label} className="flex items-center justify-between gap-4 px-4 py-3">
                        <dt className="text-[14px]">{rule.label}</dt>
                        <dd className="shrink-0 text-[14px] font-semibold tabular-nums">{rule.value}</dd>
                      </div>
                    ))}
                  </dl>
                </CardShell>
              </Rise>
            </>
          )}
        </div>
      </div>
    </>
  )
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <CardShell className="gap-1.5 p-4">
      <Eyebrow className="text-[11px]">{label}</Eyebrow>
      <span className="text-[22px] font-semibold leading-tight tracking-[-0.01em] tabular-nums">{value}</span>
      {note && <span className="text-[12px] text-muted-foreground">{note}</span>}
    </CardShell>
  )
}

/** One program's board: the top ten, then the student's own row when they're lower down. */
function Leaderboard({ board }: { board: ProgramLeaderboard }) {
  const onBoard = board.top.some((row) => row.isMe) || board.me !== null
  return (
    <CardShell>
      <CardHeader
        title={board.courseTitle}
        subtitle={
          board.ranked === 0
            ? "Leaderboard · no points yet"
            : `Leaderboard · ${board.ranked > LEADERBOARD_SIZE ? `top ${LEADERBOARD_SIZE} of ${n(board.ranked)}` : `${n(board.ranked)} ranked`}`
        }
      />
      {board.top.length === 0 ? (
        <p className="border-t border-border/60 px-4 py-4 text-[13px] text-muted-foreground">
          Nobody in this program has earned points yet. Finish a lesson to top the board.
        </p>
      ) : (
        <ol className="divide-y divide-border/60 border-t border-border/60">
          {board.top.map((row, i) => (
            <BoardRow key={i} row={row} />
          ))}
          {board.me && (
            <>
              <li aria-hidden className="px-4 py-1 text-center text-[12px] leading-none text-muted-foreground">
                ···
              </li>
              <BoardRow row={board.me} />
            </>
          )}
        </ol>
      )}
      {!onBoard && board.top.length > 0 && (
        <p className="border-t border-border/60 px-4 py-3 text-[12.5px] text-muted-foreground">
          You&apos;re not on this board yet — your first points put you on it.
        </p>
      )}
    </CardShell>
  )
}

function BoardRow({ row }: { row: LeaderboardRow }) {
  return (
    <li
      className={cn("flex min-w-0 items-center gap-3 px-4 py-3", row.isMe && "bg-accent/40")}
      aria-current={row.isMe ? "true" : undefined}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground/[0.05] text-[13px] font-semibold tabular-nums">
        {row.rank}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-[14px] font-medium">{row.name}</span>
        {row.isMe && (
          <span className="shrink-0 rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[11px] font-semibold">You</span>
        )}
      </span>
      <span className="shrink-0 text-[14px] font-semibold tabular-nums">{n(row.points)}</span>
    </li>
  )
}
