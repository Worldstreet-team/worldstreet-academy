"use client"

import Link from "next/link"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { HugeiconsIcon } from "@hugeicons/react"
import { StarIcon, Bookmark01Icon, PlayCircle02Icon } from "@hugeicons/core-free-icons"
import { useBookmarkContext } from "@/components/providers/bookmark-provider"
import type { Course } from "@/lib/types"
import type { BrowseCourse } from "@/lib/actions/student"

type CourseData = Course | BrowseCourse

/** Smart duration display: 23s, 3m, 1hr 10min */
function formatDuration(totalMinutes: number): string {
  if (!totalMinutes || totalMinutes <= 0) return "0m"
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return h === 1 ? "1hr" : `${h}hrs`
  return h === 1 ? `1hr ${m}m` : `${h}hrs ${m}m`
}

export function CourseCard({ course }: { course: CourseData }) {
  const { isBookmarked, toggle } = useBookmarkContext()
  const favorited = isBookmarked(course.id)

  return (
    <Link href={`/dashboard/courses/${course.id}`}>
      <Card className="group h-full transition-all hover:shadow-md hover:border-primary/30">
        {/* Flush image */}
        <div className="aspect-video w-full bg-muted relative overflow-hidden">
          {course.thumbnailUrl ? (
            <Image
              src={course.thumbnailUrl}
              alt={course.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-muted-foreground/40 text-xs">No thumbnail</span>
            </div>
          )}
          {/* Glassmorphic price badge */}
          <Badge
            className="absolute top-2.5 left-2.5 text-[10px] z-10 border border-white/30 shadow-lg backdrop-blur-md bg-white/20 text-white dark:bg-black/30 dark:border-white/20"
          >
            {course.pricing === "free" ? "Free" : `$${course.price}`}
          </Badge>
          {/* Bookmark button */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              toggle(course.id)
            }}
            className={`absolute top-2.5 right-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/30 backdrop-blur-md shadow-lg transition-all hover:bg-white/40 dark:border-white/20 ${
              favorited
                ? "bg-primary/80 text-white"
                : "bg-white/20 text-white dark:bg-black/30"
            }`}
          >
            <HugeiconsIcon icon={Bookmark01Icon} size={14} fill={favorited ? "currentColor" : "none"} />
          </button>
          {/* Lesson count + duration overlay */}
          {course.totalLessons > 0 && (
            <div className="absolute bottom-2 right-2 z-10 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-white border border-white/20 backdrop-blur-md bg-black/50 shadow-lg">
              <HugeiconsIcon icon={PlayCircle02Icon} size={11} />
              <span>{course.totalLessons}</span>
              {course.totalDuration > 0 && (
                <>
                  <span className="opacity-60">·</span>
                  <span>{formatDuration(course.totalDuration)}</span>
                </>
              )}
            </div>
          )}
        </div>

        <CardContent className="p-4 space-y-2.5">
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="text-[10px] capitalize">
              {course.level}
            </Badge>
            {course.rating && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground ml-auto">
                <HugeiconsIcon icon={StarIcon} size={11} className="text-orange-500" fill="currentColor" />
                {course.rating}
              </span>
            )}
          </div>
          <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {course.title}
          </h3>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {course.description}
          </p>
          <div className="flex items-center gap-2 pt-2 border-t text-xs text-muted-foreground">
            <Avatar size="sm">
              {course.instructorAvatarUrl && (
                <AvatarImage src={course.instructorAvatarUrl} alt={course.instructorName} />
              )}
              <AvatarFallback>{course.instructorName.split(" ").map(n => n[0]).join("")}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-medium text-foreground leading-tight truncate">{course.instructorName}</span>
              <span className="text-[10px] text-muted-foreground leading-tight">{course.totalLessons} lessons</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
