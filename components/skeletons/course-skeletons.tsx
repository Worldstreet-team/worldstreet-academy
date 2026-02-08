import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

/**
 * Skeleton for course card (matches CourseCard layout)
 */
export function CourseCardSkeleton() {
  return (
    <Card className="overflow-hidden h-full">
      <div className="aspect-video w-full bg-muted relative overflow-hidden">
        <Skeleton className="absolute inset-0 rounded-none" />
      </div>
      <CardContent className="p-3.5 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-12" />
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Skeleton for course grid (multiple cards)
 */
export function CourseGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <CourseCardSkeleton key={i} />
      ))}
    </div>
  )
}

/**
 * Skeleton for carousel course cards
 */
export function CourseCarouselSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="shrink-0 basis-[85%] sm:basis-1/2 lg:basis-1/3">
          <CourseCardSkeleton />
        </div>
      ))}
    </div>
  )
}

/**
 * Skeleton for instructor course page (sections with carousels)
 */
export function InstructorCoursesPageSkeleton() {
  return (
    <div className="space-y-8">
      {/* Published section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-6 rounded-full" />
        </div>
        <CourseCarouselSkeleton count={3} />
      </section>
      
      {/* Drafts section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-5 w-6 rounded-full" />
        </div>
        <CourseCarouselSkeleton count={2} />
      </section>
    </div>
  )
}

/**
 * Skeleton for course detail page
 */
export function CourseDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="aspect-video w-full max-w-3xl mx-auto bg-muted rounded-lg">
        <Skeleton className="w-full h-full rounded-lg" />
      </div>
      
      {/* Title & meta */}
      <div className="space-y-3">
        <Skeleton className="h-8 w-3/4" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </div>
      
      {/* Description */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      
      {/* Lessons */}
      <div className="space-y-2">
        <Skeleton className="h-5 w-24 mb-4" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Skeleton for my courses (enrolled courses list)
 */
export function MyCoursesGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="overflow-hidden h-full">
          <div className="aspect-video w-full bg-muted relative overflow-hidden">
            <Skeleton className="absolute inset-0 rounded-none" />
          </div>
          <CardContent className="p-3.5 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            {/* Progress bar skeleton */}
            <div className="pt-1">
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/**
 * Skeleton for bookmarks list
 */
export function BookmarksGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="overflow-hidden h-full">
          <div className="aspect-video w-full bg-muted relative overflow-hidden">
            <Skeleton className="absolute inset-0 rounded-none" />
            {/* Bookmark icon skeleton */}
            <div className="absolute top-2 right-2">
              <Skeleton className="h-7 w-7 rounded-full" />
            </div>
          </div>
          <CardContent className="p-3.5 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-12" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/**
 * Skeleton for browse courses page
 */
export function BrowseCoursesPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Search bar skeleton */}
      <Skeleton className="h-10 w-full max-w-md" />
      
      {/* Filters skeleton */}
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="h-8 w-16 rounded-full" />
      </div>
      
      {/* Grid */}
      <CourseGridSkeleton count={9} />
    </div>
  )
}

/**
 * Skeleton for lesson sidebar
 */
export function LessonSidebarSkeleton() {
  return (
    <div className="space-y-2 p-4">
      <Skeleton className="h-5 w-24 mb-4" />
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-2">
          <Skeleton className="h-4 w-4 rounded" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  )
}
