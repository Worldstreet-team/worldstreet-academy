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
import { HugeiconsIcon } from "@hugeicons/react"
import { BookOpen01Icon, StarIcon, MoreHorizontalIcon } from "@hugeicons/core-free-icons"
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

export default function AdminCoursesPage() {
  const queryClient = useQueryClient()
  const [status, setStatus] = React.useState("all")
  const [search, setSearch] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [actionError, setActionError] = React.useState<string | null>(null)

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
    onSuccess: (res) => {
      setActionError(res.success ? null : (res.error ?? "Failed"))
      queryClient.invalidateQueries({ queryKey: ["admin", "courses"] })
    },
  })

  return (
    <>
      <Topbar variant="admin" />
      <div className="p-4 sm:p-6 space-y-4 pb-24 md:pb-6">
        <div>
          <h1 className="text-lg font-semibold">Courses</h1>
          <p className="text-sm text-muted-foreground">
            {data ? `${data.total.toLocaleString()} courses` : "Course catalog moderation."}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Search titles…"
            className="max-w-xs h-8 text-xs"
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

        {actionError && <p className="text-xs text-destructive">{actionError}</p>}

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : !data || data.courses.length === 0 ? (
          <EmptyState
            icon={BookOpen01Icon}
            title="No courses"
            description="No courses match this filter."
          />
        ) : (
          <>
            <div className="space-y-2">
              {data.courses.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-2.5"
                >
                  <div className="relative h-12 w-20 rounded-lg overflow-hidden bg-muted shrink-0 hidden sm:block">
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
                        <HugeiconsIcon icon={BookOpen01Icon} size={16} className="text-muted-foreground/40" />
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
                          · <HugeiconsIcon icon={StarIcon} size={10} className="text-orange-500" />
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
                      <HugeiconsIcon icon={MoreHorizontalIcon} size={16} />
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
                          onClick={() =>
                            setCourseStatus.mutate({ courseId: c.id, newStatus: "archived" })
                          }
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
    </>
  )
}
