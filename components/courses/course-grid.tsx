"use client"

import { useMemo } from "react"
import type { Course } from "@/lib/types"
import type { BrowseCourse } from "@/lib/actions/student"
import { BookmarkProvider } from "@/components/providers/bookmark-provider"
import { CourseCard } from "./course-card"

type CourseData = Course | BrowseCourse

export function CourseGrid({ courses }: { courses: CourseData[] }) {
  const courseIds = useMemo(() => courses.map((c) => c.id), [courses])

  if (courses.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No courses found.</p>
      </div>
    )
  }

  return (
    <BookmarkProvider courseIds={courseIds}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
      </div>
    </BookmarkProvider>
  )
}
