"use client"
import { DownloadIcon, HandshakeIcon } from "@/components/icons"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Topbar } from "@/components/platform/topbar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageHeader } from "@/components/shared/page-header"
import { adminExportPartnersCsv, adminListPartners } from "@/lib/actions/admin-partners"
import { money } from "@/components/admin/shared"

export default function AdminPartnersPage() {
  const [exporting, setExporting] = React.useState(false)
  const [exportError, setExportError] = React.useState<string | null>(null)

  const { data: res, isLoading } = useQuery({
    queryKey: ["admin", "partners"],
    queryFn: () => adminListPartners(),
  })
  const loaded = res?.success ? res.data : null

  async function exportCsv() {
    setExporting(true)
    setExportError(null)
    try {
      const out = await adminExportPartnersCsv()
      if (!out.success) {
        setExportError(out.error)
        return
      }
      const blob = new Blob([out.data.csv], { type: "text/csv;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `wma-partners-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setExportError("Failed to export partners")
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <Topbar variant="admin" title="WMA Partners" />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-7xl space-y-8">
          <PageHeader
            title="WMA Partners"
            subline={
              loaded
                ? `${loaded.rows.length.toLocaleString()} active ${loaded.rows.length === 1 ? "partner" : "partners"} · ${loaded.inactive.toLocaleString()} ${loaded.inactive === 1 ? "code" : "codes"} with no activity yet`
                : "Partner Codes, clicks, sign-ups and commission."
            }
            action={
              <Button size="sm" variant="outline" onClick={exportCsv} disabled={exporting}>
                <DownloadIcon size={14} />
                {exporting ? "Exporting…" : "Export CSV"}
              </Button>
            }
          />

          {exportError && <p className="text-xs text-destructive">{exportError}</p>}

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : !res || !res.success ? (
            <EmptyState
              icon={HandshakeIcon}
              title="Partners didn't load"
              description={res && !res.success ? res.error : "Try again in a moment."}
            />
          ) : res.data.rows.length === 0 ? (
            <EmptyState
              icon={HandshakeIcon}
              title="No partner activity yet"
              description="Partners appear here once someone opens their link or joins through it."
            />
          ) : (
            <div className="rounded-[20px] border border-ws-hairline bg-ws-surface overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Partner</TableHead>
                    <TableHead className="hidden text-right md:table-cell">Clicks</TableHead>
                    <TableHead className="hidden text-right md:table-cell">Sign-ups</TableHead>
                    <TableHead className="hidden text-right md:table-cell">Enrolled</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {res.data.rows.map((r) => (
                    <TableRow key={r.userId}>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="font-medium truncate max-w-[200px]">
                            {r.firstName} {r.lastName}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                            {r.code} · {r.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums md:table-cell">{r.clicks.toLocaleString()}</TableCell>
                      <TableCell className="hidden text-right tabular-nums md:table-cell">{r.signUps.toLocaleString()}</TableCell>
                      <TableCell className="hidden text-right tabular-nums md:table-cell">{r.enrolled.toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(r.revenueMinor)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <p>{money(r.commissionPendingMinor + r.commissionPaidMinor)}</p>
                        <p className="text-[11px] text-muted-foreground">{money(r.commissionPendingMinor)} pending</p>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
