import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Topbar } from "@/components/platform/topbar"
import { mockCourses } from "@/lib/mock-data"

const INSTRUCTOR_ID = "inst-1"

export default function AnalyticsPage() {
  const myCourses = mockCourses.filter(
    (c) => c.instructorId === INSTRUCTOR_ID
  )
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {myCourses.map((course) => (
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
      </div>
    </>
  )
}
