"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Topbar } from "@/components/platform/topbar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PageHeader } from "@/components/shared/page-header"
import { StatTile } from "@/components/shared/stat-tile"
import {
  adminListUsers,
  adminGetUserDetail,
  adminUpdateUserRole,
  type AdminUserRow,
} from "@/lib/actions/admin-users"
import { queryKeys } from "@/lib/hooks/queries/keys"
import { formatDate, StatusBadge, FilterChips, Pagination } from "@/components/admin/shared"
import { useUser } from "@/components/providers/user-provider"
import { UsersIcon } from "lucide-react"

type RoleFilter = "all" | "USER" | "INSTRUCTOR" | "ADMIN"
type Role = "USER" | "INSTRUCTOR" | "ADMIN"

export default function AdminUsersPage() {
  const me = useUser()
  const queryClient = useQueryClient()
  const [role, setRole] = React.useState<RoleFilter>("all")
  const [search, setSearch] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [selected, setSelected] = React.useState<AdminUserRow | null>(null)
  const [pendingRole, setPendingRole] = React.useState<Role | null>(null)
  const [actionError, setActionError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  const filters = {
    role: role === "all" ? undefined : role,
    search: debouncedSearch || undefined,
    page,
  }

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.adminUsers(filters),
    queryFn: () => adminListUsers(filters),
  })

  const { data: detail } = useQuery({
    queryKey: selected ? queryKeys.adminUserDetail(selected.id) : ["admin", "user", "none"],
    queryFn: () => (selected ? adminGetUserDetail(selected.id) : null),
    enabled: !!selected,
  })

  const roleMutation = useMutation({
    mutationFn: ({ userId, newRole }: { userId: string; newRole: Role }) =>
      adminUpdateUserRole(userId, newRole),
    onSuccess: (res, vars) => {
      if (!res.success) {
        setActionError(res.error ?? "Failed to update role")
      } else {
        setActionError(null)
        setPendingRole(null)
        // Only reflect the new role locally once the server confirmed it.
        setSelected((prev) =>
          prev && prev.id === vars.userId ? { ...prev, role: vars.newRole } : prev
        )
        queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
        queryClient.invalidateQueries({ queryKey: queryKeys.adminUserDetail(vars.userId) })
      }
    },
  })

  return (
    <>
      <Topbar variant="admin" />
      <div className="flex-1 px-6 pb-24 pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-7xl space-y-8">
        <PageHeader
          title="Users"
          subline={data ? `${data.total.toLocaleString()} accounts` : "Search and manage accounts."}
        />

        <div className="flex items-center gap-3 flex-wrap">
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Search name, email or username…"
            className="max-w-xs h-10 text-sm"
          />
          <FilterChips
            value={role}
            onChange={(v) => {
              setRole(v)
              setPage(1)
            }}
            options={[
              { value: "all", label: "All" },
              { value: "USER", label: "Students" },
              { value: "INSTRUCTOR", label: "Instructors" },
              { value: "ADMIN", label: "Admins" },
            ]}
          />
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : !data || data.users.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title="No users found"
            description="Try a different search or filter."
          />
        ) : (
          <>
            <div className="rounded-lg border border-ws-hairline bg-ws-surface overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="hidden sm:table-cell">Application</TableHead>
                    <TableHead className="hidden lg:table-cell">Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.users.map((u) => (
                    <TableRow
                      key={u.id}
                      className="cursor-pointer"
                      onClick={() => setSelected(u)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar className="h-7 w-7 shrink-0">
                            {u.avatarUrl && <AvatarImage src={u.avatarUrl} />}
                            <AvatarFallback className="text-[10px] bg-ws-chip text-ws-primary">
                              {u.name[0]?.toUpperCase() ?? "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium truncate max-w-[160px] flex items-center gap-1.5">
                              {u.name}
                              {u.id === me.id && (
                                <Badge variant="outline" className="text-[8px]">you</Badge>
                              )}
                            </p>
                            <p className="text-[10px] text-muted-foreground md:hidden truncate max-w-[160px]">
                              {u.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {u.email}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={u.role} />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {u.instructorStatus !== "none" ? (
                          <span className="capitalize text-muted-foreground">
                            {u.instructorStatus.replace(/_/g, " ")}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        {formatDate(u.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination page={data.page} pageCount={data.pageCount} onPageChange={setPage} />
          </>
        )}
        </div>
      </div>

      {/* User detail sheet */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    {selected.avatarUrl && <AvatarImage src={selected.avatarUrl} />}
                    <AvatarFallback className="bg-ws-chip text-ws-primary">
                      {selected.name[0]?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 text-left">
                    <p className="text-sm font-semibold truncate">{selected.name}</p>
                    <p className="text-xs text-muted-foreground font-normal truncate">
                      {selected.email}
                    </p>
                  </div>
                </SheetTitle>
              </SheetHeader>

              <div className="px-4 pb-6 space-y-4">
                <div className="flex items-center gap-2">
                  <StatusBadge status={selected.role} />
                  {selected.instructorStatus !== "none" && (
                    <Badge variant="outline" className="text-[10px]">
                      application: {selected.instructorStatus}
                    </Badge>
                  )}
                  {selected.verified && (
                    <Badge variant="secondary" className="text-[10px]">verified</Badge>
                  )}
                </div>

                {detail && (
                  <div className="grid grid-cols-3 gap-2">
                    <StatTile label="Enrolled" value={detail.enrollmentCount} className="p-3" />
                    <StatTile label="Orders" value={detail.orderCount} className="p-3" />
                    <StatTile label="Courses" value={detail.coursesOwned} className="p-3" />
                  </div>
                )}

                {detail?.latestApplication && (
                  <a
                    href={`/admin/applications/${detail.latestApplication.id}`}
                    className="block rounded-lg border border-ws-hairline px-3 py-2 hover:bg-ws-raised transition-colors"
                  >
                    <p className="text-xs font-medium">Latest instructor application</p>
                    <p className="text-[11px] text-muted-foreground capitalize">
                      {detail.latestApplication.status.replace(/_/g, " ")} ·{" "}
                      {formatDate(detail.latestApplication.createdAt)}
                    </p>
                  </a>
                )}

                {/* Role management */}
                <div className="space-y-2 pt-2 border-t border-ws-hairline">
                  <p className="text-xs font-semibold">Change role</p>
                  {selected.id === me.id ? (
                    <p className="text-[11px] text-ws-muted">
                      You can&apos;t change your own role.
                    </p>
                  ) : (
                    <div className="flex items-center gap-2">
                      {(["USER", "INSTRUCTOR", "ADMIN"] as Role[]).map((r) => (
                        <Button
                          key={r}
                          size="sm"
                          variant={selected.role === r ? "secondary" : "outline"}
                          disabled={selected.role === r}
                          onClick={() => {
                            setActionError(null)
                            setPendingRole(r)
                          }}
                          className="text-xs capitalize"
                        >
                          {r.toLowerCase()}
                        </Button>
                      ))}
                    </div>
                  )}
                  {actionError && <p className="text-xs text-ws-danger">{actionError}</p>}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Role change confirm */}
      <Dialog open={pendingRole !== null} onOpenChange={(open) => !open && setPendingRole(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change role to {pendingRole?.toLowerCase()}?</DialogTitle>
            <DialogDescription>
              {pendingRole === "ADMIN" ? (
                <>
                  <span className="font-medium text-foreground">Careful:</span> ADMIN unlocks this
                  admin console <em>and</em> admin surfaces in the mobile app (e.g. Vision
                  catalogue admin). The role is written to the database and mirrored to Clerk.
                </>
              ) : pendingRole === "INSTRUCTOR" ? (
                <>Grants the instructor portal and course creation. Mirrored to Clerk metadata.</>
              ) : (
                <>Revokes instructor/admin access. Their courses stay untouched.</>
              )}
            </DialogDescription>
          </DialogHeader>
          {/* Error surfaces inside the dialog — previously it rendered in the
              sheet, hidden behind this modal. */}
          {actionError && <p className="text-xs text-ws-danger">{actionError}</p>}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPendingRole(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant={pendingRole === "ADMIN" ? "destructive" : "default"}
              disabled={roleMutation.isPending}
              onClick={() => {
                if (selected && pendingRole) {
                  roleMutation.mutate({ userId: selected.id, newRole: pendingRole })
                }
              }}
            >
              {roleMutation.isPending ? "Saving…" : "Confirm change"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
