"use client"

import * as React from "react"
import Link from "next/link"
import { CourseCard } from "@/components/platform/course-card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Check,
  Copy,
  EllipsisVertical,
  FileQuestion,
  ListVideo,
  Pencil,
  Trash2,
} from "lucide-react"
import { DeleteCourseDialog } from "@/components/instructor/delete-course-dialog"
import { useUser } from "@/components/providers/user-provider"
import type { InstructorCourseItem } from "@/lib/actions/instructor"

/**
 * Instructor view of the shared platform CourseCard: the card itself is
 * untouched; a status chip and an overflow menu (Edit · Lessons · Exam ·
 * Delete) are overlaid on the cover, where the shared card leaves both
 * corners free for owner chrome. Marketplace and New Economy courses say so,
 * a seller's course shows where it stands in review, and a seller's live
 * marketplace course carries "Your link" under the card (owner, 2026-10-05).
 * Sellers get no Exam item — exams are a faculty tool.
 */

const KIND_CHIP: Partial<Record<InstructorCourseItem["kind"], string>> = {
  marketplace: "Marketplace",
  "new-economy": "New Economy",
}

const REVIEW_CHIP: Partial<Record<InstructorCourseItem["reviewStatus"], string>> = {
  pending: "In review",
  changes_requested: "Changes requested",
}

/** The seller's own course link, with a copy button. */
function ShareRow({ url }: { url: string }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <div className="mt-2 flex items-center gap-2 rounded-md border border-ws-hairline bg-ws-surface px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ws-subtle">Your link</p>
        <p className="truncate text-[12px] text-ws-primary" title={url}>
          {url}
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(url).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1600)
          })
        }}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-sm border border-ws-hairline px-2.5 text-[12px] font-medium text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised"
        aria-label="Copy your link"
      >
        {copied ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={2} />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  )
}

const statusText: Record<string, string> = {
  published: "text-ws-success",
  draft: "text-white/85",
  archived: "text-white/55",
}

export function InstructorCourseCard({
  course,
  showMenu = true,
}: {
  course: InstructorCourseItem
  showMenu?: boolean
}) {
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  // Only approved sellers reach the instructor area without a faculty role.
  const seller = useUser().role === "USER"
  const kindChip = KIND_CHIP[course.kind]
  const reviewChip = REVIEW_CHIP[course.reviewStatus]

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex-1">
        <CourseCard
          href={`/instructor/courses/${course.id}`}
          title={course.title}
          thumbnailUrl={course.thumbnailUrl}
          price={course.price}
          pricing={course.pricing}
          rating={course.rating}
          level={course.level}
          totalLessons={course.totalLessons}
          showLessonCount
          totalDuration={course.totalDuration}
          enrolledCount={course.enrolledCount}
        />

        {/* Status chips — same scrim treatment as the shared card's cover chips */}
        <div className="pointer-events-none absolute left-3 top-2.5 z-10 flex max-w-[calc(100%-4rem)] flex-wrap gap-1">
          <span
            className={`rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${
              statusText[course.status] ?? statusText.draft
            }`}
          >
            {course.status}
          </span>
          {kindChip && (
            <span className="rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-white/85">
              {kindChip}
            </span>
          )}
          {reviewChip && (
            <span className="rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-white/85">
              {reviewChip}
            </span>
          )}
        </div>

        {showMenu && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={`Actions for ${course.title}`}
                className="ws-touch-target absolute right-2.5 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-sm bg-black/45 text-white transition-colors duration-[var(--ws-motion-fast)] hover:bg-black/70"
              >
                <EllipsisVertical size={16} strokeWidth={2} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={4} className="min-w-40">
                <DropdownMenuItem
                  render={<Link href={`/instructor/courses/${course.id}/edit`} />}
                >
                  <Pencil size={14} strokeWidth={2} />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  render={<Link href={`/instructor/courses/${course.id}/lessons`} />}
                >
                  <ListVideo size={14} strokeWidth={2} />
                  Lessons
                </DropdownMenuItem>
                {!seller && (
                  <DropdownMenuItem
                    render={<Link href={`/instructor/courses/${course.id}/exam`} />}
                  >
                    <FileQuestion size={14} strokeWidth={2} />
                    Exam
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 size={14} strokeWidth={2} />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DeleteCourseDialog
              courseId={course.id}
              courseTitle={course.title}
              open={deleteOpen}
              onOpenChange={setDeleteOpen}
            />
          </>
        )}
      </div>
      {course.share && <ShareRow url={course.share.url} />}
    </div>
  )
}
