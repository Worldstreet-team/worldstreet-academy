import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CourseGrid } from "@/components/courses/course-grid"
import { mockCourses } from "@/lib/mock-data"

export default function HomePage() {
  const featuredCourses = mockCourses.slice(0, 3)

  return (
    <div>
      {/* Hero */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4 text-center">
          <div className="mx-auto max-w-3xl space-y-6">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Master the Markets with{" "}
              <span className="text-primary">WorldStreet Academy</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Learn cryptocurrency trading, DeFi, risk management, and blockchain
              development from industry experts. Free and premium courses
              available.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button size="lg" render={<Link href="/courses" />}>
                Browse Courses
              </Button>
              <Button size="lg" variant="outline" render={<Link href="/dashboard" />}>
                Start Learning
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y bg-muted/40 py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-3xl font-bold">50+</p>
              <p className="text-sm text-muted-foreground mt-1">Courses</p>
            </div>
            <div>
              <p className="text-3xl font-bold">10K+</p>
              <p className="text-sm text-muted-foreground mt-1">Students</p>
            </div>
            <div>
              <p className="text-3xl font-bold">25+</p>
              <p className="text-sm text-muted-foreground mt-1">Instructors</p>
            </div>
            <div>
              <p className="text-3xl font-bold">4.8</p>
              <p className="text-sm text-muted-foreground mt-1">Avg Rating</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Courses */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Featured Courses</h2>
              <p className="text-muted-foreground mt-1">
                Start your learning journey with our top picks
              </p>
            </div>
            <Button variant="outline" render={<Link href="/courses" />}>
              View All
            </Button>
          </div>
          <CourseGrid courses={featuredCourses} />
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-muted/40 border-t">
        <div className="container mx-auto px-4 text-center">
          <div className="mx-auto max-w-2xl space-y-4">
            <h2 className="text-2xl font-bold tracking-tight">
              Start learning today
            </h2>
            <p className="text-muted-foreground">
              Join thousands of learners on WorldStreet Academy and level up your skills.
            </p>
            <Button size="lg" render={<Link href="/courses" />}>
              Browse Courses
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
