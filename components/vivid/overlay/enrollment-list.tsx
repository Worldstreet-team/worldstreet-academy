"use client"

import Image from "next/image"
import { motion } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  TeachingIcon,
  Certificate01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"

export interface EnrollmentItem {
  id?: string
  courseTitle: string
  thumbnailUrl?: string
  instructorName?: string
  instructorAvatar?: string
  progress?: number
  completedLessons?: number
  totalLessons?: number
}

export function EnrollmentList({ data }: { data: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = Array.isArray(data) ? data : (data as any)?.enrollments || []

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="p-4 rounded-2xl bg-accent/20 mb-4">
          <HugeiconsIcon icon={Certificate01Icon} size={28} className="text-muted-foreground/50" />
        </div>
        <p className="text-muted-foreground text-sm">No enrollments found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.slice(0, 12).map((e: EnrollmentItem, i: number) => {
        const pct = e.progress || 0
        const isComplete = pct >= 100
        return (
          <motion.div
            key={e.id || i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="rounded-2xl bg-card/50 border border-border/20 overflow-hidden
                       hover:border-foreground/10 hover:bg-card/70 transition-all duration-200"
          >
            <div className="flex gap-3 p-3.5">
              {/* Course thumbnail */}
              {e.thumbnailUrl ? (
                <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-muted shrink-0">
                  <Image src={e.thumbnailUrl} alt="" fill className="object-cover" sizes="64px" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
                  <HugeiconsIcon icon={TeachingIcon} size={20} className="text-muted-foreground/30" />
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
                  {e.courseTitle}
                </p>

                {/* Instructor */}
                {e.instructorName && (
                  <div className="flex items-center gap-1.5">
                    {e.instructorAvatar ? (
                      <div className="relative w-4 h-4 rounded-full overflow-hidden bg-muted shrink-0">
                        <Image src={e.instructorAvatar} alt="" fill className="object-cover" sizes="16px" />
                      </div>
                    ) : null}
                    <span className="text-[11px] text-muted-foreground truncate">{e.instructorName}</span>
                  </div>
                )}

                {/* Progress */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full bg-accent/30 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.7, ease: "circOut", delay: i * 0.04 + 0.15 }}
                      className={`h-full rounded-full ${isComplete ? "bg-emerald-500/80" : "bg-foreground/50"}`}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 w-8 text-right">
                    {pct}%
                  </span>
                </div>

                {/* Lesson count */}
                {e.completedLessons !== undefined && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    {isComplete && <HugeiconsIcon icon={Tick02Icon} size={10} className="text-emerald-500" />}
                    {e.completedLessons}/{e.totalLessons || "?"} lessons
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
