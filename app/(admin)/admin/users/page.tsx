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
import { UserMultipleIcon } from "@hugeicons/core-free-icons"
import {
  adminListUsers,
  adminGetUserDetail,
  adminUpdateUserRole,
  type AdminUserRow,
} from "@/lib/actions/admin-users"
import { queryKeys } from "@/lib/hooks/queries/keys"
import { formatDate, StatusBadge, FilterChips, Pagination } from "@/components/admin/shared"
import { useUser } from "@/components/providers/user-provider"

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
    onSuccess: (res) => {
      if (!res.success) {
        setActionError(res.error ?? "Failed to update role")
      } else {
        setActionError(null)
        setPendingRole(null)
        queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
        if (selected) {
          queryClient.invalidateQueries({ queryKey: queryKeys.adminUserDetail(selected.id) })
        }
      }
    },
  })

  return (
    <>
      <Topbar variant="admin" />
      <div className="p-4 sm:p-6 space-y-4 pb-24 md:pb-6">
        <div>
          <h1 className="text-lg font-semibold">Users</h1>
          <p className="text-sm text-muted-foreground">
            {data ? `${data.total.toLocaleString()} accounts` : "Search and manage accounts."}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Search name, email or username…"
            className="max-w-xs h-8 text-xs"
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
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : !data || data.users.length === 0 ? (
          <EmptyState
            icon={UserMultipleIcon}
            title="No users found"
            description="Try a different search or filter."
          />
        ) : (
          <>
            <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
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
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
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

      {/* User detail sheet */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    {selected.avatarUrl && <AvatarImage src={selected.avatarUrl} />}
                    <AvatarFallback className="bg-primary/10 text-primary">
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
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-muted/50 py-2">
                      <p className="text-sm font-semibold">{detail.enrollmentCount}</p>
                      <p className="text-[10px] text-muted-foreground">Enrollments</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 py-2">
                      <p className="text-sm font-semibold">{detail.orderCount}</p>
                      <p className="text-[10px] text-muted-foreground">Orders</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 py-2">
                      <p className="text-sm font-semibold">{detail.coursesOwned}</p>
                      <p className="text-[10px] text-muted-foreground">Courses</p>
                    </div>
                  </div>
                )}

                {detail?.latestApplication && (
                  <a
                    href={`/admin/applications/${detail.latestApplication.id}`}
                    className="block rounded-lg border border-border/60 px-3 py-2 hover:bg-muted/50 transition-colors"
                  >
                    <p className="text-xs font-medium">Latest instructor application</p>
                    <p className="text-[11px] text-muted-foreground capitalize">
                      {detail.latestApplication.status.replace(/_/g, " ")} ·{" "}
                      {formatDate(detail.latestApplication.createdAt)}
                    </p>
                  </a>
                )}

                {/* Role management */}
                <div className="space-y-2 pt-2 border-t border-border/50">
                  <p className="text-xs font-semibold">Change role</p>
                  {selected.id === me.id ? (
                    <p className="text-[11px] text-muted-foreground">
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
                  {actionError && <p className="text-xs text-destructive">{actionError}</p>}
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
                  setSelected((prev) => (prev ? { ...prev, role: pendingRole } : prev))
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
