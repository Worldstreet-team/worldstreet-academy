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
  EllipsisVertical,
  FileQuestion,
  ListVideo,
  Pencil,
  Trash2,
} from "lucide-react"
import { DeleteCourseDialog } from "@/components/instructor/delete-course-dialog"
import type { InstructorCourseItem } from "@/lib/actions/instructor"

/**
 * Instructor view of the shared platform CourseCard: the card itself is
 * untouched; a status chip and an overflow menu (Edit · Lessons · Exam ·
 * Delete) are overlaid on the cover, where the shared card leaves both
 * corners free for owner chrome.
 */

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

  return (
    <div className="relative h-full">
      <CourseCard
        href={`/instructor/courses/${course.id}`}
        title={course.title}
        thumbnailUrl={course.thumbnailUrl}
        price={course.price}
        pricing={course.pricing}
        rating={course.rating}
        level={course.level}
        totalLessons={course.totalLessons}
        totalDuration={course.totalDuration}
        enrolledCount={course.enrolledCount}
      />

      {/* Status chip — same scrim treatment as the shared card's cover chips */}
      <span
        className={`pointer-events-none absolute left-3 top-2.5 z-10 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${
          statusText[course.status] ?? statusText.draft
        }`}
      >
        {course.status}
      </span>

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
              <DropdownMenuItem
                render={<Link href={`/instructor/courses/${course.id}/exam`} />}
              >
                <FileQuestion size={14} strokeWidth={2} />
                Exam
              </DropdownMenuItem>
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
  )
}
