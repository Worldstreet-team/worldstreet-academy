"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Topbar } from "@/components/platform/topbar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PageHeader } from "@/components/shared/page-header"
import { formatDate, formatDateTime } from "@/components/admin/shared"
import {
  superFindAccount,
  superGetTeam,
  superGrantAdmin,
  superRevokeAdmin,
  superSetAdminLevel,
  type FoundAccount,
  type TeamAuditRow,
  type TeamMember,
} from "@/lib/actions/admin-team"
import { queryKeys } from "@/lib/hooks/queries/keys"

type Change = "grant" | "promote" | "demote" | "revoke"
type Pending = { change: Change; id: string; name: string }

const COPY: Record<Change, { title: (n: string) => string; body: string; confirm: string; destructive: boolean }> = {
  grant: {
    title: (n) => `Make ${n} an admin?`,
    body: "Admins manage programs, payments, enrollments and users here and in the mobile app's admin screens. Only a super admin can undo this.",
    confirm: "Make admin",
    destructive: false,
  },
  promote: {
    title: (n) => `Make ${n} a super admin?`,
    body: "Super admins can add and remove admins, including other super admins.",
    confirm: "Make super admin",
    destructive: false,
  },
  demote: {
    title: (n) => `Make ${n} a regular admin?`,
    body: "They keep admin access but can no longer add or remove admins.",
    confirm: "Make regular admin",
    destructive: false,
  },
  revoke: {
    title: (n) => `Remove ${n}'s admin access?`,
    body: "Their account goes back to the role it had before they were made an admin. Their programs stay untouched.",
    confirm: "Remove admin",
    destructive: true,
  },
}

function phrase(row: TeamAuditRow): string {
  switch (row.action) {
    case "grant":
      return row.toLevel === "super" ? `made ${row.targetName} a super admin` : `made ${row.targetName} an admin`
    case "revoke":
      return `removed ${row.targetName}'s admin access`
    case "promote":
      return `made ${row.targetName} a super admin`
    case "demote":
      return `made ${row.targetName} a regular admin`
  }
}

function Person({ name, email, avatarUrl }: { name: string; email: string; avatarUrl: string | null }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="h-8 w-8 shrink-0">
        {avatarUrl && <AvatarImage src={avatarUrl} />}
        <AvatarFallback className="bg-ws-chip text-[11px] text-ws-primary">
          {name[0]?.toUpperCase() ?? "?"}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-ws-muted">{email}</p>
      </div>
    </div>
  )
}

function grantLine(m: TeamMember): string {
  if (!m.granted) return "Granted before admin levels"
  const date = formatDate(m.granted.at)
  return m.granted.byName ? `Granted by ${m.granted.byName} · ${date}` : `Granted by the bootstrap script · ${date}`
}

const SECTION = "rounded-[20px] border border-ws-hairline bg-ws-surface p-5"

export function TeamConsole() {
  const queryClient = useQueryClient()
  const [email, setEmail] = React.useState("")
  const [found, setFound] = React.useState<FoundAccount | null>(null)
  const [findError, setFindError] = React.useState<string | null>(null)
  const [finding, setFinding] = React.useState(false)
  const [pending, setPending] = React.useState<Pending | null>(null)
  const [actionError, setActionError] = React.useState<string | null>(null)

  const { data, isLoading } = useQuery({ queryKey: queryKeys.adminTeam, queryFn: superGetTeam })

  const mutation = useMutation({
    mutationFn: ({ change, id }: Pending) => {
      if (change === "grant") return superGrantAdmin(id)
      if (change === "revoke") return superRevokeAdmin(id)
      return superSetAdminLevel(id, change === "promote" ? "super" : null)
    },
    onSuccess: (res) => {
      if (!res.success) {
        setActionError(res.error)
        return
      }
      setActionError(null)
      setPending(null)
      setFound(null)
      setEmail("")
      queryClient.invalidateQueries({ queryKey: ["admin", "team"] })
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
    },
    onError: () => setActionError("Couldn't update admin access"),
  })

  async function find(e: React.FormEvent) {
    e.preventDefault()
    setFinding(true)
    setFindError(null)
    setFound(null)
    try {
      const res = await superFindAccount(email)
      if (res.success) setFound(res.data)
      else setFindError(res.error)
    } catch {
      setFindError("Couldn't look that account up. Try again.")
    } finally {
      setFinding(false)
    }
  }

  function ask(change: Change, id: string, name: string) {
    setActionError(null)
    setPending({ change, id, name })
  }

  const copy = pending ? COPY[pending.change] : null
  const members = data?.success ? data.data.members : []
  const audit = data?.success ? data.data.audit : []

  return (
    <>
      <Topbar variant="admin" />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-7xl space-y-8">
          <PageHeader
            title="Team"
            subline="Admins run the Academy. Super admins also decide who is an admin."
          />

          <section className={SECTION}>
            <h2 className="text-sm font-semibold">Add an admin</h2>
            <form onSubmit={find} className="mt-3 flex flex-wrap items-end gap-3">
              <div className="w-full max-w-sm space-y-1.5">
                <Label htmlFor="team-email">Email address</Label>
                <Input
                  id="team-email"
                  type="text"
                  inputMode="email"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="h-10 text-sm"
                />
              </div>
              <Button type="submit" variant="outline" disabled={finding || !email.trim()}>
                {finding ? "Finding…" : "Find account"}
              </Button>
            </form>
            {findError && <p className="mt-2 text-xs text-ws-danger">{findError}</p>}
            {found && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-ws-hairline p-3">
                <div className="min-w-0">
                  <Person name={found.name} email={found.email} avatarUrl={found.avatarUrl} />
                  <p className="mt-1 pl-11 text-[11px] capitalize text-ws-muted">{found.role.toLowerCase()}</p>
                </div>
                {found.role === "ADMIN" ? (
                  <p className="text-sm text-ws-muted">Already an admin.</p>
                ) : (
                  <Button onClick={() => ask("grant", found.id, found.name)}>Make admin</Button>
                )}
              </div>
            )}
          </section>

          <section className={SECTION}>
            <h2 className="text-sm font-semibold">
              Admins · <span className="tabular-nums">{data?.success ? members.length : "—"}</span>
            </h2>
            <div className="mt-3 divide-y divide-ws-hairline">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="my-2 h-14 rounded-lg" />)
              ) : data && !data.success ? (
                <p className="py-3 text-sm text-ws-danger">{data.error}</p>
              ) : (
                members.map((m) => (
                  <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Person name={m.name} email={m.email} avatarUrl={m.avatarUrl} />
                        {m.isYou && <Badge variant="outline" className="text-[10px]">You</Badge>}
                        <Badge variant="outline" className="text-[10px]">
                          {m.adminLevel === "super" ? "Super admin" : "Admin"}
                        </Badge>
                      </div>
                      <p className="pl-11 text-[11px] text-ws-muted">{grantLine(m)}</p>
                    </div>
                    {!m.isYou && (
                      <div className="flex flex-wrap gap-2">
                        {m.adminLevel === "super" ? (
                          <Button size="sm" variant="outline" onClick={() => ask("demote", m.id, m.name)}>
                            Make regular admin
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => ask("promote", m.id, m.name)}>
                            Make super admin
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => ask("revoke", m.id, m.name)}>
                          Remove admin
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>

          <section className={SECTION}>
            <h2 className="text-sm font-semibold">Audit trail</h2>
            {isLoading ? (
              <Skeleton className="mt-3 h-20 rounded-lg" />
            ) : audit.length === 0 ? (
              <p className="mt-3 text-sm text-ws-muted">No admin changes recorded yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {audit.map((row, i) => (
                  <li key={`${row.at}-${i}`} className="text-sm">
                    <span className="font-medium">{row.actorName ?? "The bootstrap script"}</span> {phrase(row)}
                    <span className="text-ws-muted"> · {formatDateTime(row.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent>
          {pending && copy && (
            <>
              <DialogHeader>
                <DialogTitle>{copy.title(pending.name)}</DialogTitle>
                <DialogDescription>{copy.body}</DialogDescription>
              </DialogHeader>
              {actionError && <p className="text-xs text-ws-danger">{actionError}</p>}
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setPending(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant={copy.destructive ? "destructive" : "default"}
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate(pending)}
                >
                  {mutation.isPending ? "Saving…" : copy.confirm}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
