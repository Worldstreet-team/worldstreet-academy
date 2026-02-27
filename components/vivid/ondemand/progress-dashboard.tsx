"use client"

import Image from "next/image"
import { useState, useEffect } from "react"
import { motion } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Tick02Icon } from "@hugeicons/core-free-icons"
import { useVivid } from "@/lib/vivid/provider"
import type { OnDemandUI } from "@/lib/vivid/types"
import { parseConfig } from "./helpers"

export function ProgressDashboardUI({ ui }: { ui: OnDemandUI }) {
  const vivid = useVivid()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config = parseConfig(ui.config as any)
  const [progress, setProgress] = useState<{
    overallProgress: number
    completedCount: number
    totalLessons: number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lessons: any[]
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const { executeVividFunction } = await import("@/lib/vivid/actions")
        const result = await executeVividFunction("getCompletedLessons", { courseId: config.courseId })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = result as any
        if (r?.success) {
          setProgress({
            overallProgress: Math.round((r.completedCount / Math.max(r.totalLessons, 1)) * 100),
            completedCount: r.completedCount,
            totalLessons: r.totalLessons,
            lessons: r.lessons || [],
          })
        }
      } catch {
        // Fallback: empty state
      } finally {
        setIsLoading(false)
      }
    }
    fetchProgress()
  }, [config.courseId])

  const pct = progress?.overallProgress || 0
  const circumference = 2 * Math.PI * 42

  return (
    <div className="space-y-5">
      {/* Course header */}
      <div className="flex items-center gap-3">
        {config.thumbnailUrl && (
          <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-muted shrink-0">
            <Image src={config.thumbnailUrl} alt="" fill className="object-cover" sizes="48px" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{config.courseTitle || "Course"}</p>
          <p className="text-xs text-muted-foreground">
            {progress ? `${progress.completedCount} of ${progress.totalLessons} lessons` : "Loading…"}
          </p>
        </div>
      </div>

      {/* Progress ring */}
      <div className="flex justify-center py-2">
        <div className="relative w-28 h-28">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle
              cx="50" cy="50" r="42"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              className="text-accent/30"
            />
            <motion.circle
              cx="50" cy="50" r="42"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
              className="text-foreground"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: circumference - (circumference * pct) / 100 }}
              transition={{ duration: 1, ease: "circOut", delay: 0.3 }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-2xl font-bold text-foreground tabular-nums"
            >
              {isLoading ? "—" : `${pct}%`}
            </motion.span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">complete</span>
          </div>
        </div>
      </div>

      {/* Lesson checklist */}
      {progress && progress.lessons.length > 0 && (
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {progress.lessons.map((lesson, i) => (
            <motion.div
              key={lesson.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.04 }}
              className={`
                flex items-center gap-3 p-2.5 rounded-xl text-sm
                ${lesson.isCompleted
                  ? "bg-accent/20 text-foreground/60"
                  : "bg-card/40 text-foreground"
                }
              `}
            >
              <div className={`
                w-5 h-5 rounded-full flex items-center justify-center shrink-0 border
                ${lesson.isCompleted
                  ? "bg-foreground text-background border-foreground"
                  : "border-border/60"
                }
              `}>
                {lesson.isCompleted && <HugeiconsIcon icon={Tick02Icon} size={10} />}
              </div>
              <span className={`flex-1 truncate ${lesson.isCompleted ? "line-through" : ""}`}>
                {lesson.title}
              </span>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {lesson.order}
              </span>
            </motion.div>
          ))}
        </div>
      )}

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => vivid.resolveUI({ acknowledged: true, progress: pct })}
        className="w-full py-2.5 rounded-xl text-sm font-medium bg-accent/40
                   hover:bg-accent/60 transition-colors"
      >
        Got it
      </motion.button>
    </div>
  )
}
