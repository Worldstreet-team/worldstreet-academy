import { Topbar } from "@/components/platform/topbar"
import { PageHeader } from "@/components/shared/page-header"
import { StatTile } from "@/components/shared/stat-tile"
import { CardShell, CardHeader, EmptyState } from "@/components/ui/system"
import { getMyInstructorEarnings, type EarningRow } from "@/lib/actions/earnings"
import { EARNING_KIND_LABEL, EARNING_STATUS_LABEL, earningShareLabel, shortDate } from "@/lib/faculty-format"
import { formatMinor } from "@/lib/teaching-home"

function clearsLabel(r: EarningRow): string {
  if (r.status === "pending") return shortDate(r.availableAt)
  if (r.status === "cleared" && r.clearedAt) return shortDate(r.clearedAt)
  return "—"
}

export default async function InstructorEarningsPage() {
  const earnings = await getMyInstructorEarnings()

  return (
    <>
      <Topbar title="Earnings" variant="instructor" />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-5xl space-y-8">
          <PageHeader
            title="Earnings"
            subline="Your share of every sale, from the ledger."
            action={
              earnings ? (
                <a
                  href={earnings.withdrawUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-full border border-border px-4 py-2 text-[13px] font-semibold text-foreground transition-colors hover:bg-foreground/[0.05]"
                >
                  Withdraw on the WorldStreet dashboard
                </a>
              ) : undefined
            }
          />

          {!earnings || earnings.rows.length === 0 ? (
            <CardShell>
              <EmptyState
                title="No earnings yet"
                description="Your share of each sale appears here once a learner buys one of your programs."
              />
            </CardShell>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatTile
                  label="Clearing"
                  value={<span className="tabular-nums">{formatMinor(earnings.pendingMinor)}</span>}
                  context={`${earnings.clearingDays}-day refund window`}
                />
                <StatTile label="In your wallet" value={<span className="tabular-nums">{formatMinor(earnings.clearedMinor)}</span>} />
                <StatTile label="Lifetime net" value={<span className="tabular-nums">{formatMinor(earnings.lifetimeNetMinor)}</span>} />
              </div>

              <CardShell>
                <CardHeader title="By program" />
                <ul className="divide-y divide-border">
                  {earnings.byCourse.map((c) => (
                    <li key={c.courseId} className="flex items-center justify-between gap-4 px-5 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-medium">{c.courseTitle}</p>
                        <p className="text-[12px] text-muted-foreground tabular-nums">{c.sales} sales</p>
                      </div>
                      <span className="shrink-0 text-[14px] font-semibold tabular-nums">{formatMinor(c.netMinor)}</span>
                    </li>
                  ))}
                </ul>
              </CardShell>

              <CardShell>
                <CardHeader title="Ledger" subtitle="The 100 most recent entries" />
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full text-left text-[13px]">
                    <thead className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                      <tr>
                        {["Date", "Kind", "Program", "Learner", "Gross", "Share", "Net", "Status", "Clears"].map((h) => (
                          <th key={h} className="px-4 py-2 font-medium">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {earnings.rows.map((r) => (
                        <tr key={r.id}>
                          <td className="whitespace-nowrap px-4 py-3 tabular-nums">{shortDate(r.createdAt)}</td>
                          <td className="px-4 py-3">{EARNING_KIND_LABEL[r.kind]}</td>
                          <td className="max-w-[14rem] truncate px-4 py-3">{r.courseTitle}</td>
                          <td className="px-4 py-3">{r.learnerName ?? "—"}</td>
                          <td className="px-4 py-3 tabular-nums">{formatMinor(r.grossMinor)}</td>
                          <td className="px-4 py-3 tabular-nums">{earningShareLabel(r.grossMinor, r.netMinor)}</td>
                          <td className="px-4 py-3 font-semibold tabular-nums">{formatMinor(r.netMinor)}</td>
                          <td className="px-4 py-3">{EARNING_STATUS_LABEL[r.status]}</td>
                          <td className="whitespace-nowrap px-4 py-3 tabular-nums">{clearsLabel(r)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="divide-y divide-border lg:hidden">
                  {earnings.rows.map((r) => (
                    <li key={r.id} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="min-w-0 truncate text-[14px] font-medium">{r.courseTitle}</p>
                        <span className="shrink-0 text-[14px] font-semibold tabular-nums">{formatMinor(r.netMinor)}</span>
                      </div>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">
                        {EARNING_KIND_LABEL[r.kind]} · {r.learnerName ?? "—"} · {EARNING_STATUS_LABEL[r.status]} · {shortDate(r.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              </CardShell>
            </>
          )}
        </div>
      </div>
    </>
  )
}
