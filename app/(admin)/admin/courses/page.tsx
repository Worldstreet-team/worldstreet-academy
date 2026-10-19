"use client"
import { MoreHorizontal, BookOpenIcon, PlusIcon, StarIcon } from "@/components/icons"

import * as React from "react"
import { Suspense } from "react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
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
import Link from "next/link"

import { PageHeader } from "@/components/shared/page-header"
import {
  adminListCourses,
  adminSetCourseStatus,
} from "@/lib/actions/admin-courses"
import { FORMAT_LABEL, isFileFormat } from "@/lib/course-format"
import { queryKeys } from "@/lib/hooks/queries/keys"
import {
  formatDate,
  formatDateTime,
  StatusBadge,
  FilterChips,
  Pagination,
} from "@/components/admin/shared"
import { courseAvailability } from "@/lib/types/course"
import type { CourseStatus } from "@/lib/types/course"


const KIND_LABEL = { marketplace: "Marketplace", "new-economy": "New Economy" } as const

/**
 * The catalogue, and (owner 2026-10-05) the marketplace review queue at
 * `?review=pending`: sellers' courses waiting on a quality review — approve
 * to publish, or request changes with a note.
 */
export default function AdminCoursesPage() {
  // useSearchParams needs a Suspense boundary in the app router.
  return (
    <Suspense fallback={null}>
      <AdminCoursesInner />
    </Suspense>
  )
}

function AdminCoursesInner() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const review = searchParams.get("review") === "pending" ? "pending" : "all"
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

  const filters =
    review === "pending"
      ? { status: "all", search: debouncedSearch || undefined, page, review }
      : { status, search: debouncedSearch || undefined, page }

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.adminCourses(filters),
    queryFn: () => adminListCourses(filters),
  })

  const setCourseStatus = useMutation({
    mutationFn: ({ courseId, newStatus }: { courseId: string; newStatus: CourseStatus }) =>
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
          title={review === "pending" ? "Review queue" : "Courses"}
          subline={
            review === "pending"
              ? "Marketplace courses from Marketplace Creators, oldest first. Open one to record its four checks."
              : data
                ? `${data.total.toLocaleString()} courses`
                : "Create and manage the catalogue."
          }
          action={
            <Button size="sm" render={<Link href="/admin/courses/new" />}>
              <PlusIcon size={14} />
              New course
            </Button>
          }
        />

        <FilterChips
          value={review}
          onChange={(v) => {
            setPage(1)
            router.replace(v === "pending" ? "/admin/courses?review=pending" : "/admin/courses")
          }}
          options={[
            { value: "all", label: "All courses" },
            {
              value: "pending",
              label: "Review queue",
              ...(review === "pending" && data ? { count: data.total } : {}),
            },
          ]}
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
          {review !== "pending" && (
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
                { value: "suspended", label: "Suspended" },
                { value: "closed", label: "Closed" },
                { value: "archived", label: "Archived" },
              ]}
            />
          )}
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
            title={review === "pending" ? "Nothing to review" : "No courses"}
            description={
              review === "pending" ? "No marketplace course is waiting on a review." : "No courses match this filter."
            }
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
                      <Link
                        href={`/admin/courses/${c.id}/edit`}
                        className="text-sm font-medium truncate hover:underline"
                      >
                        {c.title}
                      </Link>
                      <StatusBadge status={c.status} />
                      {/* Published + future date = the derived Coming Soon state,
                          worth surfacing here since the raw status won't show it. */}
                      {courseAvailability({ status: c.status as CourseStatus, availableAt: c.availableAt }) ===
                        "coming_soon" && <StatusBadge status="coming_soon" />}
                      {c.kind !== "program" && (
                        <span className="inline-flex shrink-0 items-center rounded-full bg-ws-chip px-2 py-0.5 text-[10px] font-medium text-ws-primary">
                          {c.format ? `${KIND_LABEL[c.kind as keyof typeof KIND_LABEL]} · ${FORMAT_LABEL[c.format]}` : KIND_LABEL[c.kind as keyof typeof KIND_LABEL]}
                        </span>
                      )}
                      {c.reviewStatus !== "none" && (
                        <StatusBadge status={c.reviewStatus === "pending" ? "in_review" : c.reviewStatus} />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.instructorName} · {isFileFormat(c.format) ? "1 file" : `${c.totalLessons} lessons`} ·{" "}
                      <Link href={`/admin/enrollments?course=${c.id}`} className="hover:underline">
                        {c.enrolledCount} students
                      </Link>
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
                      {c.availableAt ? ` · available ${formatDateTime(c.availableAt)}` : ""}
                      {c.sellerOwned ? " · seller" : ""}
                      {c.reviewStatus === "pending" && c.reviewSubmittedAt
                        ? ` · submitted ${formatDateTime(c.reviewSubmittedAt)}`
                        : ""}
                    </p>
                    {c.reviewStatus === "changes_requested" && c.reviewNote && (
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-ws-muted">Changes requested: {c.reviewNote}</p>
                    )}
                  </div>
                  {c.reviewStatus === "pending" && (
                    <Button
                      size="sm"
                      className="hidden shrink-0 sm:inline-flex"
                      render={<Link href={`/admin/courses/${c.id}/review`} />}
                    >
                      Open review
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon-sm" aria-label="Course actions" />
                      }
                    >
                      <MoreHorizontal size={16} strokeWidth={2} />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem render={<Link href={`/admin/courses/${c.id}/edit`} />}>
                        Edit course
                      </DropdownMenuItem>
                      <DropdownMenuItem render={<Link href={`/admin/enrollments?course=${c.id}`} />}>
                        View enrollments
                      </DropdownMenuItem>
                      {c.reviewStatus === "pending" && (
                        <DropdownMenuItem render={<Link href={`/admin/courses/${c.id}/review`} />}>
                          Open review
                        </DropdownMenuItem>
                      )}
                      {c.status !== "published" && !(c.kind === "marketplace" && c.sellerOwned && c.reviewStatus !== "approved") && (
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
                      {c.status === "published" && (
                        <DropdownMenuItem
                          onClick={() =>
                            setCourseStatus.mutate({ courseId: c.id, newStatus: "suspended" })
                          }
                        >
                          Suspend
                        </DropdownMenuItem>
                      )}
                      {c.status === "suspended" && (
                        <DropdownMenuItem
                          onClick={() =>
                            setCourseStatus.mutate({ courseId: c.id, newStatus: "published" })
                          }
                        >
                          Reinstate
                        </DropdownMenuItem>
                      )}
                      {(c.status === "published" || c.status === "suspended") && (
                        <DropdownMenuItem
                          onClick={() =>
                            setCourseStatus.mutate({ courseId: c.id, newStatus: "closed" })
                          }
                        >
                          Close enrollments
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
