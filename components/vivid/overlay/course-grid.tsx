"use client"

import Image from "next/image"
import { motion } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  TeachingIcon,
  StarIcon,
  BookOpen01Icon,
} from "@hugeicons/core-free-icons"

export interface CourseItem {
  id?: string
  title: string
  shortDescription?: string
  thumbnailUrl?: string
  instructorName?: string
  instructorAvatar?: string
  rating?: number
  level?: string
  pricing?: string
  price?: number
  totalLessons?: number
  enrolledCount?: number
  progress?: number
}

export function CourseGrid({ data }: { data: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = Array.isArray(data) ? data : (data as any)?.courses || (data as any)?.bookmarks || []

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="p-4 rounded-2xl bg-accent/20 mb-4">
          <HugeiconsIcon icon={TeachingIcon} size={28} className="text-muted-foreground/50" />
        </div>
        <p className="text-muted-foreground text-sm">No courses found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.slice(0, 12).map((course: CourseItem, i: number) => (
        <motion.div
          key={course.id || i}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04, type: "spring", stiffness: 300, damping: 25 }}
          className="rounded-2xl bg-card/50 border border-border/20
                     hover:border-foreground/10 hover:bg-card/70 transition-all duration-200
                     group cursor-pointer overflow-hidden"
        >
          {/* Thumbnail banner */}
          {course.thumbnailUrl ? (
            <div className="relative w-full aspect-2/1 bg-muted overflow-hidden">
              <Image
                src={course.thumbnailUrl}
                alt={course.title}
                fill
                className="object-cover group-hover:scale-[1.03] transition-transform duration-500 ease-out"
                sizes="400px"
              />
              {/* Price badge — top right */}
              <div className="absolute top-2.5 right-2.5">
                {course.pricing === "free" ? (
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-600/90 text-white backdrop-blur-sm">
                    Free
                  </span>
                ) : course.price ? (
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-background/80 text-foreground backdrop-blur-sm border border-border/30">
                    ${course.price}
                  </span>
                ) : null}
              </div>
              {/* Level badge — top left */}
              {course.level && (
                <div className="absolute top-2.5 left-2.5">
                  <span className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-background/70 text-foreground/80 backdrop-blur-sm border border-border/20 capitalize">
                    {course.level}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-20 bg-accent/20 flex items-center justify-center">
              <HugeiconsIcon icon={TeachingIcon} size={28} className="text-muted-foreground/30" />
            </div>
          )}

          {/* Content */}
          <div className="p-3.5 space-y-2.5">
            <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
              {course.title}
            </p>

            {/* Author row */}
            <div className="flex items-center gap-2">
              {course.instructorAvatar ? (
                <div className="relative w-5 h-5 rounded-full overflow-hidden bg-muted shrink-0 ring-1 ring-border/20">
                  <Image src={course.instructorAvatar} alt="" fill className="object-cover" sizes="20px" />
                </div>
              ) : course.instructorName ? (
                <div className="w-5 h-5 rounded-full bg-accent/40 flex items-center justify-center shrink-0">
                  <span className="text-[9px] font-bold text-foreground/50">
                    {course.instructorName[0]?.toUpperCase()}
                  </span>
                </div>
              ) : null}
              {course.instructorName && (
                <span className="text-xs text-muted-foreground truncate">{course.instructorName}</span>
              )}
            </div>

            {/* Progress bar (if enrolled) */}
            {(course.progress ?? 0) > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 rounded-full bg-accent/30 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${course.progress}%` }}
                    transition={{ duration: 0.8, ease: "circOut", delay: i * 0.04 + 0.2 }}
                    className="h-full rounded-full bg-foreground/60"
                  />
                </div>
                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{course.progress}%</span>
              </div>
            )}

            {/* Meta row */}
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              {(course.rating ?? 0) > 0 && (
                <span className="flex items-center gap-0.5 text-amber-400">
                  <HugeiconsIcon icon={StarIcon} size={11} className="fill-current" />
                  {(course.rating ?? 0).toFixed(1)}
                </span>
              )}
              {(course.totalLessons ?? 0) > 0 && (
                <span className="flex items-center gap-1">
                  <HugeiconsIcon icon={BookOpen01Icon} size={11} />
                  {course.totalLessons}
                </span>
              )}
              {(course.enrolledCount ?? 0) > 0 && (
                <span>
                  {course.enrolledCount! > 999
                    ? `${(course.enrolledCount! / 1000).toFixed(1)}k`
                    : course.enrolledCount} students
                </span>
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
