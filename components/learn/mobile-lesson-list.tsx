"use client"

import Link from "next/link"
import Image from "next/image"
import { motion, AnimatePresence } from "motion/react"
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import { Tick02Icon, Video01Icon, WifiIcon, File01Icon } from "@hugeicons/core-free-icons"
import type { LearnLesson } from "@/lib/actions/student"

type MobileLessonListProps = {
  lessons: LearnLesson[]
  courseId: string
  currentLessonId: string
  nextLessonId: string | null
  completedLessonIds?: string[]
}

const typeIcons = {
  video: Video01Icon,
  live: WifiIcon,
  text: File01Icon,
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
  completedLessonIds = [],
}: MobileLessonListProps) {
  return (
    <div className="space-y-0.5">
      {lessons.map((lesson, index) => {
        const isCurrent = lesson.id === currentLessonId
        const isUpNext = lesson.id === nextLessonId
        const isCompleted = completedLessonIds.includes(lesson.id)
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
            {/* Thumbnail with number overlay */}
            <div className="relative w-12 h-8 rounded overflow-hidden shrink-0 bg-muted">
              {lesson.thumbnailUrl ? (
                <Image
                  src={lesson.thumbnailUrl}
                  alt={lesson.title}
                  fill
                  className="object-cover"
                  sizes="48px"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <HugeiconsIcon 
                    icon={typeIcons[lesson.type] || Video01Icon} 
                    size={14} 
                    className="text-muted-foreground/50" 
                  />
                </div>
              )}
              {/* Small circle with number */}
              <div
                className={cn(
                  "absolute bottom-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold",
                  isCompleted && !isCurrent
                    ? "bg-green-500 text-white"
                    : isCurrent
                      ? "bg-primary text-primary-foreground"
                      : "bg-black/70 text-white"
                )}
              >
                {isCompleted && !isCurrent ? (
                  <HugeiconsIcon icon={Tick02Icon} size={10} className="text-white" />
                ) : (
                  index + 1
                )}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-sm">{lesson.title}</p>
              <p className="text-[11px] text-muted-foreground capitalize">
                {lesson.type}
                {lesson.duration 
                  ? ` · ${Math.floor(lesson.duration / 60)}:${String(lesson.duration % 60).padStart(2, '0')}` 
                  : ""}
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
                  {lesson.duration 
                    ? `${Math.floor(lesson.duration / 60)}:${String(lesson.duration % 60).padStart(2, '0')}` 
                    : lesson.type}
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        )
      })}
    </div>
  )
}
