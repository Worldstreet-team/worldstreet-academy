"use client"

import * as React from "react"
import Image from "next/image"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Topbar } from "@/components/platform/topbar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { MoreHorizontal } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import {
  adminListCourses,
  adminSetCourseStatus,
} from "@/lib/actions/admin-courses"
import { queryKeys } from "@/lib/hooks/queries/keys"
import {
  formatDate,
  StatusBadge,
  FilterChips,
  Pagination,
} from "@/components/admin/shared"
import { BookOpenIcon, StarIcon } from "lucide-react"

export default function AdminCoursesPage() {
  const queryClient = useQueryClient()
  const [status, setStatus] = React.useState("all")
  const [search, setSearch] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [actionError, setActionError] = React.useState<string | null>(null)
  const [archiveTarget, setArchiveTarget] = React.useState<{ id: string; title: string } | null>(null)

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  const filters = { status, search: debouncedSearch || undefined, page }

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.adminCourses(filters),
    queryFn: () => adminListCourses(filters),
  })

  const setCourseStatus = useMutation({
    mutationFn: ({ courseId, newStatus }: { courseId: string; newStatus: "draft" | "published" | "archived" }) =>
      adminSetCourseStatus(courseId, newStatus),
    onSuccess: (res, vars) => {
      setActionError(res.success ? null : (res.error ?? "Failed"))
      if (res.success && vars.newStatus === "archived") setArchiveTarget(null)
      queryClient.invalidateQueries({ queryKey: ["admin", "courses"] })
    },
  })

  return (
    <>
      <Topbar variant="admin" />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-7xl space-y-8">
        <PageHeader
          title="Courses"
          subline={data ? `${data.total.toLocaleString()} courses` : "Course catalog moderation."}
        />

        <div className="flex items-center gap-3 flex-wrap">
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Search titles…"
            className="max-w-xs h-10 text-sm"
          />
          <FilterChips
            value={status}
            onChange={(v) => {
              setStatus(v)
              setPage(1)
            }}
            options={[
              { value: "all", label: "All" },
              { value: "published", label: "Published" },
              { value: "draft", label: "Drafts" },
              { value: "archived", label: "Archived" },
            ]}
          />
        </div>

        {actionError && <p className="text-xs text-ws-danger">{actionError}</p>}

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : !data || data.courses.length === 0 ? (
          <EmptyState
            icon={BookOpenIcon}
            title="No courses"
            description="No courses match this filter."
          />
        ) : (
          <>
            <div className="space-y-2">
              {data.courses.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-lg border border-ws-hairline bg-ws-surface px-3 py-2.5"
                >
                  <div className="relative h-12 w-20 rounded-sm overflow-hidden bg-ws-raised shrink-0 hidden sm:block">
                    {c.thumbnailUrl ? (
                      <Image
                        src={c.thumbnailUrl}
                        alt={c.title}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <BookOpenIcon  size={16} className="text-muted-foreground/40" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{c.title}</p>
                      <StatusBadge status={c.status} />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.instructorName} · {c.totalLessons} lessons · {c.enrolledCount} students
                      {c.ratingAverage ? (
                        <span className="inline-flex items-center gap-0.5 ml-1">
                          · <StarIcon  size={10} className="text-ws-rating" />
                          {c.ratingAverage.toFixed(1)}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70">
                      {c.pricing === "free" ? "Free" : `$${c.price ?? 0}`} · created{" "}
                      {formatDate(c.createdAt)}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon-sm" aria-label="Course actions" />
                      }
                    >
                      <MoreHorizontal size={16} strokeWidth={2} />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      {c.status !== "published" && (
                        <DropdownMenuItem
                          onClick={() =>
                            setCourseStatus.mutate({ courseId: c.id, newStatus: "published" })
                          }
                        >
                          Publish
                        </DropdownMenuItem>
                      )}
                      {c.status === "published" && (
                        <DropdownMenuItem
                          onClick={() =>
                            setCourseStatus.mutate({ courseId: c.id, newStatus: "draft" })
                          }
                        >
                          Unpublish (to draft)
                        </DropdownMenuItem>
                      )}
                      {c.status !== "archived" && (
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setArchiveTarget({ id: c.id, title: c.title })}
                        >
                          Archive
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
            <Pagination page={data.page} pageCount={data.pageCount} onPageChange={setPage} />
          </>
        )}
        </div>
      </div>

      {/* Archive confirm — archiving pulls a course out of the catalog, so it
          gets the same explicit confirmation as role changes and refunds. */}
      <Dialog open={!!archiveTarget} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive “{archiveTarget?.title}”?</DialogTitle>
            <DialogDescription>
              The course disappears from the public catalog and can no longer be
              purchased. Existing students keep access to their content. You can
              re-publish it later from this page.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setArchiveTarget(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={setCourseStatus.isPending}
              onClick={() => {
                if (archiveTarget) {
                  setCourseStatus.mutate({ courseId: archiveTarget.id, newStatus: "archived" })
                }
              }}
            >
              {setCourseStatus.isPending ? "Archiving…" : "Archive course"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
