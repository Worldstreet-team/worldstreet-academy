"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Topbar } from "@/components/platform/topbar"
import { Skeleton } from "@/components/ui/skeleton"
import { type InstructorCourseItem } from "@/lib/actions/instructor"
import { useInstructorCourses } from "@/lib/hooks/queries"
import { EmptyState } from "@/components/shared/empty-state"

export default function AnalyticsPage() {
  const { data: courses = [], isLoading } = useInstructorCourses()

  return (
    <>
      <Topbar title="Analytics" variant="instructor" />
      <div className="p-4 md:p-6 space-y-6 pb-24 md:pb-8">
        <div>
          <h1 className="text-xl font-bold">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Track your course performance and student engagement.
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-4 w-32" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : courses.length === 0 ? (
          <EmptyState
            illustration="/user/dashboard/course-empty-state.png"
            title="No courses yet"
            description="Create your first course to see analytics here."
            actionLabel="Create Course"
            actionHref="/instructor/courses/new"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {courses.map((course) => (
              <Card key={course.id}>
                <CardHeader>
                  <CardTitle className="text-sm">{course.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-lg font-bold">{course.enrolledCount}</p>
                      <p className="text-[11px] text-muted-foreground">Students</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">{course.rating ?? "—"}</p>
                      <p className="text-[11px] text-muted-foreground">Rating</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">
                        {course.pricing === "paid"
                          ? `$${((course.price ?? 0) * course.enrolledCount * 0.85).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                          : "Free"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">Revenue</p>
                    </div>
                  </div>
                  <div className="h-16 bg-muted/50 rounded-md flex items-center justify-center">
                    <span className="text-[11px] text-muted-foreground">
                      Enrollment chart — coming soon
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
