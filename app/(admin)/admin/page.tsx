"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Topbar } from "@/components/platform/topbar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { StatTile } from "@/components/shared/stat-tile"
import { BookOpen, CircleDollarSign, Inbox, Users } from "lucide-react"
import { getAdminOverview } from "@/lib/actions/admin-overview"
import { queryKeys } from "@/lib/hooks/queries/keys"
import { money, formatDateTime, StatusBadge } from "@/components/admin/shared"

export default function AdminOverviewPage() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.adminOverview,
    queryFn: () => getAdminOverview(),
  })

  return (
    <>
      <Topbar variant="admin" title="Admin" />
      <div className="flex-1 px-6 pb-24 pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-7xl space-y-8">
          <PageHeader
            title="Platform overview"
            subline="Users, money and instructor pipeline at a glance."
          />

          {isLoading || !data ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatTile
                  label="Users"
                  value={data.totals.users.toLocaleString()}
                  context={`${data.totals.instructors} instructors`}
                  icon={<Users size={20} strokeWidth={2} />}
                />
                <StatTile
                  label="Pending applications"
                  value={data.totals.pendingApplications.toLocaleString()}
                  context={`30d: ${data.funnel.submitted30d} in · ${data.funnel.approved30d} approved · ${data.funnel.rejected30d} rejected${
                    data.funnel.approvalRatePct != null ? ` · ${data.funnel.approvalRatePct}% approved` : ""
                  }`}
                  icon={<Inbox size={20} strokeWidth={2} />}
                />
                <StatTile
                  label="Published courses"
                  value={data.totals.publishedCourses.toLocaleString()}
                  context={`${data.totals.activeEnrollments.toLocaleString()} active enrollments`}
                  icon={<BookOpen size={20} strokeWidth={2} />}
                />
                <StatTile
                  label="Gross revenue"
                  value={money(data.totals.grossRevenueMinor)}
                  context={`${money(data.totals.pendingEarningsMinor)} pending · ${money(data.totals.clearedEarningsMinor)} cleared to instructors`}
                  icon={<CircleDollarSign size={20} strokeWidth={2} />}
                  tone="gold"
                />
              </div>

              {/* 14-day revenue */}
              <div className="rounded-lg border border-ws-hairline bg-ws-surface p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-ws-primary">Revenue — last 14 days</h2>
                  <span className="text-xs tabular-nums text-ws-muted">
                    {money(data.revenueByDay.reduce((s, d) => s + d.minor, 0))} total
                  </span>
                </div>
                {(() => {
                  const max = Math.max(...data.revenueByDay.map((d) => d.minor), 1)
                  return (
                    <div className="flex items-end gap-1.5 h-24">
                      {data.revenueByDay.map((d) => (
                        <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group/bar">
                          <span className="text-[8px] tabular-nums text-ws-muted opacity-0 group-hover/bar:opacity-100 transition-opacity">
                            {d.minor > 0 ? money(d.minor) : ""}
                          </span>
                          <div
                            className={`w-full rounded-t-md transition-colors ${
                              d.minor > 0 ? "bg-ws-brand" : "bg-ws-track"
                            }`}
                            style={{ height: `${Math.max(3, (d.minor / max) * 100)}%` }}
                          />
                          <span className="text-[8px] tabular-nums text-ws-subtle">
                            {new Date(d.date + "T00:00:00").toLocaleDateString("en-US", { day: "numeric" })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                {/* Recent applications */}
                <div className="rounded-lg border border-ws-hairline bg-ws-surface p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-ws-primary">Recent applications</h2>
                    <Link
                      href="/admin/applications"
                      className="text-xs font-medium text-ws-muted transition-colors hover:text-ws-primary"
                    >
                      View all
                    </Link>
                  </div>
                  {data.recentApplications.length === 0 ? (
                    <p className="text-xs text-ws-muted py-6 text-center">
                      No applications yet.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {data.recentApplications.map((a) => (
                        <Link
                          key={a.id}
                          href={`/admin/applications/${a.id}`}
                          className="flex items-center gap-3 rounded-sm px-2 py-2 transition-colors hover:bg-ws-raised"
                        >
                          <Avatar className="h-7 w-7">
                            {a.applicantAvatar && <AvatarImage src={a.applicantAvatar} />}
                            <AvatarFallback className="text-[10px] bg-ws-chip text-ws-primary">
                              {a.applicantName[0]?.toUpperCase() ?? "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate text-ws-primary">{a.applicantName}</p>
                            <p className="text-[11px] text-ws-muted truncate">
                              {a.headline}
                            </p>
                          </div>
                          <StatusBadge status={a.status} />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent payment events */}
                <div className="rounded-lg border border-ws-hairline bg-ws-surface p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-ws-primary">Recent payment events</h2>
                    <Link
                      href="/admin/payments"
                      className="text-xs font-medium text-ws-muted transition-colors hover:text-ws-primary"
                    >
                      View all
                    </Link>
                  </div>
                  {data.recentPaymentEvents.length === 0 ? (
                    <p className="text-xs text-ws-muted py-6 text-center">
                      No payment events yet.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {data.recentPaymentEvents.map((e) => (
                        <div
                          key={e.id}
                          className="flex items-center justify-between gap-3 rounded-sm px-2 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate capitalize text-ws-primary">
                              {e.type.replace(/_/g, " ")}
                            </p>
                            <p className="text-[10px] text-ws-muted tabular-nums truncate">
                              {e.reference}
                            </p>
                          </div>
                          <span className="text-[10px] text-ws-subtle shrink-0">
                            {formatDateTime(e.createdAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
