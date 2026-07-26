"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Topbar } from "@/components/platform/topbar"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  UserMultipleIcon,
  TeachingIcon,
  BookOpen01Icon,
  DollarCircleIcon,
} from "@hugeicons/core-free-icons"
import { getAdminOverview } from "@/lib/actions/admin-overview"
import { queryKeys } from "@/lib/hooks/queries/keys"
import { money, formatDateTime, StatusBadge } from "@/components/admin/shared"

function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string
  value: string
  sub?: string
  icon: typeof UserMultipleIcon
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold">{value}</p>
          {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
        </div>
        <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <HugeiconsIcon icon={icon} size={16} />
        </div>
      </CardContent>
    </Card>
  )
}

export default function AdminOverviewPage() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.adminOverview,
    queryFn: () => getAdminOverview(),
  })

  return (
    <>
      <Topbar variant="admin" title="Admin" />
      <div className="p-4 sm:p-6 space-y-6 pb-24 md:pb-6">
        <div>
          <h1 className="text-lg font-semibold">Platform overview</h1>
          <p className="text-sm text-muted-foreground">
            Users, money and instructor pipeline at a glance.
          </p>
        </div>

        {isLoading || !data ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard
                label="Users"
                value={data.totals.users.toLocaleString()}
                sub={`${data.totals.instructors} instructors`}
                icon={UserMultipleIcon}
              />
              <StatCard
                label="Pending applications"
                value={data.totals.pendingApplications.toLocaleString()}
                sub={`30d: ${data.funnel.submitted30d} in · ${data.funnel.approved30d}✓ ${data.funnel.rejected30d}✗${
                  data.funnel.approvalRatePct != null ? ` · ${data.funnel.approvalRatePct}% approved` : ""
                }`}
                icon={TeachingIcon}
              />
              <StatCard
                label="Published courses"
                value={data.totals.publishedCourses.toLocaleString()}
                sub={`${data.totals.activeEnrollments.toLocaleString()} active enrollments`}
                icon={BookOpen01Icon}
              />
              <StatCard
                label="Gross revenue"
                value={money(data.totals.grossRevenueMinor)}
                sub={`${money(data.totals.pendingEarningsMinor)} pending · ${money(data.totals.clearedEarningsMinor)} cleared to instructors`}
                icon={DollarCircleIcon}
              />
            </div>

            {/* 14-day revenue */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold">Revenue — last 14 days</h2>
                  <span className="text-xs text-muted-foreground">
                    {money(data.revenueByDay.reduce((s, d) => s + d.minor, 0))} total
                  </span>
                </div>
                {(() => {
                  const max = Math.max(...data.revenueByDay.map((d) => d.minor), 1)
                  return (
                    <div className="flex items-end gap-1.5 h-24">
                      {data.revenueByDay.map((d) => (
                        <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group/bar">
                          <span className="text-[8px] text-muted-foreground opacity-0 group-hover/bar:opacity-100 transition-opacity">
                            {d.minor > 0 ? money(d.minor) : ""}
                          </span>
                          <div
                            className={`w-full rounded-t-md transition-colors ${
                              d.minor > 0 ? "bg-primary/70 group-hover/bar:bg-primary" : "bg-muted"
                            }`}
                            style={{ height: `${Math.max(3, (d.minor / max) * 100)}%` }}
                          />
                          <span className="text-[8px] text-muted-foreground/70">
                            {new Date(d.date + "T00:00:00").toLocaleDateString("en-US", { day: "numeric" })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </CardContent>
            </Card>

            <div className="grid lg:grid-cols-2 gap-4">
              {/* Recent applications */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold">Recent applications</h2>
                    <Link
                      href="/admin/applications"
                      className="text-xs text-primary hover:underline"
                    >
                      View all
                    </Link>
                  </div>
                  {data.recentApplications.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-6 text-center">
                      No applications yet.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {data.recentApplications.map((a) => (
                        <Link
                          key={a.id}
                          href={`/admin/applications/${a.id}`}
                          className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50 transition-colors"
                        >
                          <Avatar className="h-7 w-7">
                            {a.applicantAvatar && <AvatarImage src={a.applicantAvatar} />}
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                              {a.applicantName[0]?.toUpperCase() ?? "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate">{a.applicantName}</p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {a.headline}
                            </p>
                          </div>
                          <StatusBadge status={a.status} />
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent payment events */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold">Recent payment events</h2>
                    <Link href="/admin/payments" className="text-xs text-primary hover:underline">
                      View all
                    </Link>
                  </div>
                  {data.recentPaymentEvents.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-6 text-center">
                      No payment events yet.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {data.recentPaymentEvents.map((e) => (
                        <div
                          key={e.id}
                          className="flex items-center justify-between gap-3 rounded-lg px-2 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">
                              {e.type.replace(/_/g, " ")}
                            </p>
                            <p className="text-[10px] text-muted-foreground font-mono truncate">
                              {e.reference}
                            </p>
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {formatDateTime(e.createdAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </>
  )
}
