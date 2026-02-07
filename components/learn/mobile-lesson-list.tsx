"use client"

import Link from "next/link"
import { motion, AnimatePresence } from "motion/react"
import { cn } from "@/lib/utils"

type Lesson = {
  id: string
  courseId: string
  title: string
  description: string | null
  type: "video" | "text" | "live"
  videoUrl: string | null
  content: string | null
  duration: number | null
  order: number
  isFree: boolean
}

type MobileLessonListProps = {
  lessons: Lesson[]
  courseId: string
  currentLessonId: string
  nextLessonId: string | null
}

/* ---- Equalizer bars animation (playing indicator) ---- */
function EqualizerIcon({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-end gap-[2px] h-3.5 w-3.5", className)}>
      {[0, 0.2, 0.4].map((delay, i) => (
        <motion.div
          key={i}
          className="w-[3px] rounded-sm bg-primary"
          animate={{ height: ["40%", "100%", "60%", "90%", "40%"] }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  )
}

/* ---- Pulsing dot (up next indicator) ---- */
function NextDot() {
  return (
    <motion.div
      className="h-2 w-2 rounded-full bg-primary/60"
      animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
    />
  )
}

export function MobileLessonList({
  lessons,
  courseId,
  currentLessonId,
  nextLessonId,
}: MobileLessonListProps) {
  return (
    <div className="space-y-0.5">
      {lessons.map((lesson, index) => {
        const isCurrent = lesson.id === currentLessonId
        const isUpNext = lesson.id === nextLessonId
        return (
          <Link
            key={lesson.id}
            href={`/dashboard/courses/${courseId}/learn/${lesson.id}`}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
              isCurrent
                ? "bg-primary/10"
                : isUpNext
                  ? "bg-muted/50"
                  : "hover:bg-muted/50"
            )}
          >
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium shrink-0",
                isCurrent
                  ? "bg-primary text-primary-foreground"
                  : isUpNext
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
              )}
            >
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-sm">{lesson.title}</p>
              <p className="text-[11px] text-muted-foreground capitalize">
                {lesson.type}
                {lesson.duration ? ` · ${lesson.duration}min` : ""}
              </p>
            </div>
            <AnimatePresence mode="wait">
              {isCurrent ? (
                <motion.div
                  key="playing"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                  className="shrink-0"
                >
                  <EqualizerIcon />
                </motion.div>
              ) : isUpNext ? (
                <motion.div
                  key="next"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                  className="shrink-0"
                >
                  <NextDot />
                </motion.div>
              ) : (
                <motion.span
                  key="duration"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-[10px] text-muted-foreground tabular-nums shrink-0"
                >
                  {lesson.duration ? `${lesson.duration}m` : lesson.type}
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        )
      })}
    </div>
  )
}
