import { CourseGrid } from "@/components/courses/course-grid"
import { fetchBrowseCourses } from "@/lib/actions/student"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BRAND } from "@/lib/brand"

// Force dynamic rendering to show fresh instructor avatars
export const revalidate = 0

export default async function CoursesPage() {
  const courses = await fetchBrowseCourses()
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">All programs</h1>
        <p className="text-muted-foreground">
          Browse every program across the eight schools of {BRAND.name}.
        </p>
      </div>

      {/* Filters (skeleton) */}
      <div className="flex flex-wrap items-center gap-2 mb-8">
        <Badge variant="default" className="cursor-pointer">All</Badge>
        <Badge variant="outline" className="cursor-pointer">Beginner</Badge>
        <Badge variant="outline" className="cursor-pointer">Intermediate</Badge>
        <Badge variant="outline" className="cursor-pointer">Advanced</Badge>
        <div className="ml-auto">
          <Badge variant="outline" className="cursor-pointer">Free</Badge>
          <Badge variant="outline" className="cursor-pointer ml-2">Paid</Badge>
        </div>
      </div>

      <CourseGrid courses={courses} />
    </div>
  )
}
