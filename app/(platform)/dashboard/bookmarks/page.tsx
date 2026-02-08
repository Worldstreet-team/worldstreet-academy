"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, Bookmark01Icon, StarIcon } from "@hugeicons/core-free-icons"
import { Topbar } from "@/components/platform/topbar"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { EmptyState } from "@/components/shared/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchMyBookmarks, toggleCourseBookmark, type StudentBookmark } from "@/lib/actions/student"

export default function BookmarksPage() {
  const [search, setSearch] = React.useState("")
  const [bookmarks, setBookmarks] = React.useState<StudentBookmark[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    async function loadBookmarks() {
      try {
        const data = await fetchMyBookmarks()
        setBookmarks(data)
      } catch (error) {
        console.error("Failed to load bookmarks:", error)
      } finally {
        setIsLoading(false)
      }
    }
    loadBookmarks()
  }, [])

  const handleRemoveBookmark = async (courseId: string) => {
    try {
      await toggleCourseBookmark(courseId)
      setBookmarks((prev) => prev.filter((b) => b.courseId !== courseId))
    } catch (error) {
      console.error("Failed to remove bookmark:", error)
    }
  }

  const filteredCourses = React.useMemo(() => {
    if (!search.trim()) return bookmarks
    const q = search.toLowerCase()
    return bookmarks.filter(
      (c) =>
        c.courseTitle.toLowerCase().includes(q) ||
        c.instructorName.toLowerCase().includes(q)
    )
  }, [bookmarks, search])

  return (
    <>
      <Topbar title="Bookmarks" />
      <div className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 pb-24 md:pb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bookmarks</h1>
          <p className="text-muted-foreground mt-1">
            Courses you&apos;ve bookmarked for later.
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="h-full">
                <Skeleton className="aspect-video w-full" />
                <CardContent className="p-4 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            {bookmarks.length > 0 && (
              <div className="relative">
                <HugeiconsIcon
                  icon={Search01Icon}
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search bookmarks..."
                  className="w-full h-9 rounded-lg border bg-muted/40 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                />
              </div>
            )}

            {bookmarks.length === 0 ? (
              <EmptyState
                illustration="/user/dashboard/course-empty-state.png"
                title="No bookmarks yet"
                description="Browse courses and bookmark the ones you like to find them here."
                actionLabel="Browse Courses"
                actionHref="/dashboard/courses"
                actionVariant="outline"
              />
            ) : filteredCourses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-sm text-muted-foreground">
                <p>No courses match &quot;{search}&quot;</p>
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="text-primary text-xs mt-1 hover:underline"
                >
                  Clear search
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
                {filteredCourses.map((course) => (
                  <Link
                    key={course.id}
                    href={`/dashboard/courses/${course.courseId}`}
                    className="group block"
                  >
                    <Card className="h-full transition-all hover:shadow-md hover:border-primary/30">
                      <div className="aspect-video w-full bg-muted relative overflow-hidden">
                        {course.courseThumbnail ? (
                          <Image
                            src={course.courseThumbnail}
                            alt={course.courseTitle}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-muted-foreground/40 text-xs">No thumbnail</span>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleRemoveBookmark(course.courseId)
                          }}
                          className="absolute top-2.5 right-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/30 bg-primary/80 text-white backdrop-blur-md shadow-lg transition-all hover:bg-primary"
                        >
                          <HugeiconsIcon icon={Bookmark01Icon} size={14} fill="currentColor" />
                        </button>
                      </div>
                      <CardContent className="p-4 space-y-2">
                        <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                          {course.courseTitle}
                        </h3>
                        <div className="flex items-center gap-2">
                          <Avatar size="sm">
                            <AvatarFallback>{course.instructorName.split(" ").map((n) => n[0]).join("")}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground truncate">{course.instructorName}</span>
                        </div>
                        {course.rating && (
                          <div className="inline-flex items-center gap-1 rounded-md bg-orange-50 dark:bg-orange-500/10 px-1.5 py-0.5 w-fit">
                            <HugeiconsIcon icon={StarIcon} size={11} className="text-orange-500" fill="currentColor" />
                            <span className="text-[11px] font-medium text-orange-600 dark:text-orange-400">{course.rating}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
