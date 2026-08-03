"use client"

import Image from "next/image"
import { BookOpenIcon, GraduationCapIcon, StarIcon, UsersIcon } from "lucide-react"

export function CourseDetail({ data }: { data: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const course = (data as any)?.course || data
  if (!course) return null

  return (
    <div className="space-y-5">
      {/* Thumbnail */}
      {course.thumbnailUrl && (
        <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted">
          <Image src={course.thumbnailUrl} alt={course.title} fill className="object-cover" sizes="420px" />
          {/* Price overlay */}
          {(course.pricing === "free" || course.price) && (
            <div className="absolute bottom-3 right-3">
              <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-background/80 text-foreground border border-ws-hairline">
                {course.pricing === "free" ? "Free" : `$${course.price}`}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Title + Author */}
      <div className="space-y-3">
        <h4 className="text-base font-semibold text-foreground leading-snug">{course.title}</h4>

        {/* Instructor row */}
        {course.instructorName && (
          <div className="flex items-center gap-2.5">
            {course.instructorAvatar ? (
              <div className="relative w-7 h-7 rounded-full overflow-hidden bg-muted shrink-0 ring-1 ring-border/20">
                <Image src={course.instructorAvatar} alt="" fill className="object-cover" sizes="28px" />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-full bg-accent/40 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-foreground/50">
                  {course.instructorName[0]?.toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-sm text-foreground/80">{course.instructorName}</span>
              <span className="text-[11px] text-muted-foreground">Instructor</span>
            </div>
          </div>
        )}
      </div>

      {/* Description */}
      {course.shortDescription && (
        <p className="text-sm text-muted-foreground leading-relaxed">{course.shortDescription}</p>
      )}

      {/* Rating row */}
      {((course.rating ?? 0) > 0 || (course.totalReviews ?? 0) > 0) && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <StarIcon
                key={s}
                
                size={14}
                className={s <= Math.round(course.rating || 0) ? "text-ws-rating fill-ws-rating" : "text-muted-foreground/20"} />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            {(course.rating || 0).toFixed(1)} {course.totalReviews ? `(${course.totalReviews})` : ""}
          </span>
        </div>
      )}

      {/* Enrolled progress */}
      {course.isEnrolled && (
        <div className="p-3.5 rounded-lg bg-accent/15 border border-ws-hairline space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Your progress</span>
            <span className="font-semibold text-foreground tabular-nums">{course.enrollmentProgress || 0}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-accent/30 overflow-hidden">
            {/* Static fill — 06-motion bans layout (width) animation */}
            <div
              style={{ width: `${course.enrollmentProgress || 0}%` }}
              className="h-full rounded-full bg-foreground/60"
            />
          </div>
        </div>
      )}

      {/* Meta badges */}
      <div className="flex flex-wrap gap-2">
        {course.totalLessons > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/20 text-xs text-foreground/70">
            <BookOpenIcon  size={12} /> {course.totalLessons} lessons
          </span>
        )}
        {course.enrolledCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/20 text-xs text-foreground/70">
            <UsersIcon  size={12} /> {course.enrolledCount} students
          </span>
        )}
        {course.level && (
          <span className="px-3 py-1.5 rounded-lg bg-accent/20 text-xs text-foreground/70 capitalize">{course.level}</span>
        )}
        {course.category && (
          <span className="px-3 py-1.5 rounded-lg bg-accent/20 text-xs text-foreground/70">{course.category}</span>
        )}
      </div>
    </div>
  )
}
