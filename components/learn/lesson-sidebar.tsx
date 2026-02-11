"use client"

import Link from "next/link"
import Image from "next/image"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AnimatePresence, motion } from "motion/react"
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import { Tick02Icon, Video01Icon, Wifi01Icon, File01Icon } from "@hugeicons/core-free-icons"
import type { LearnLesson } from "@/lib/actions/student"

type LessonSidebarProps = {
  lessons: LearnLesson[]
  courseId: string
  currentLessonId: string
  nextLessonId: string | null
  completedLessonIds?: string[]
}

const typeIcons = {
  video: Video01Icon,
  live: Wifi01Icon,
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
          transition={{ duration: 1.2, repeat: Infinity, delay, ease: "easeInOut" }}
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

export function LessonSidebar({
  lessons,
  courseId,
  currentLessonId,
  nextLessonId,
  completedLessonIds = [],
}: LessonSidebarProps) {
  const completedCount = completedLessonIds.length
  
  return (
    <aside className="hidden lg:flex w-80 border-l flex-col shrink-0">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm">Course Content</h3>
        <p className="text-xs text-muted-foreground mt-1">
          {completedCount}/{lessons.length} lessons completed
        </p>
      </div>
      <ScrollArea className="flex-1">
        <div className="py-1">
          <AnimatePresence mode="popLayout">
            {lessons.map((lesson, index) => {
              const isCurrent = lesson.id === currentLessonId
              const isUpNext = lesson.id === nextLessonId
              const isCompleted = completedLessonIds.includes(lesson.id)

              return (
                <motion.div
                  key={lesson.id}
                  layout
                  initial={false}
                  animate={{
                    backgroundColor: isCurrent
                      ? "var(--color-primary-a10, oklch(0.62 0.1 170 / 0.1))"
                      : isUpNext
                        ? "var(--color-accent-a60, oklch(0 0 0 / 0.03))"
                        : "transparent",
                  }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                >
                  <Link
                    href={`/dashboard/courses/${courseId}/learn/${lesson.id}`}
                    className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/50"
                  >
                    {/* Thumbnail with number overlay */}
                    <div className="relative w-14 h-10 rounded-md overflow-hidden shrink-0 bg-muted">
                      {lesson.thumbnailUrl ? (
                        <Image
                          src={lesson.thumbnailUrl}
                          alt={lesson.title}
                          fill
                          className="object-cover"
                          sizes="56px"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-muted">
                          <HugeiconsIcon 
                            icon={typeIcons[lesson.type] || Video01Icon} 
                            size={16} 
                            className="text-muted-foreground/50" 
                          />
                        </div>
                      )}
                      {/* Small circle with number */}
                      <motion.div
                        className={cn(
                          "absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold",
                          isCompleted && !isCurrent
                            ? "bg-green-500 text-white"
                            : isCurrent
                              ? "bg-primary text-primary-foreground"
                              : "bg-black/70 text-white"
                        )}
                        layout
                        transition={{ duration: 0.3 }}
                      >
                        {isCompleted && !isCurrent ? (
                          <HugeiconsIcon icon={Tick02Icon} size={12} className="text-white" />
                        ) : (
                          index + 1
                        )}
                      </motion.div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-sm">{lesson.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {lesson.type}
                        {lesson.duration ? ` · ${Math.floor(lesson.duration / 60)}:${String(lesson.duration % 60).padStart(2, '0')}` : ""}
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
                  {index < lessons.length - 1 && (
                    <div className="mx-4 border-b border-dotted border-muted-foreground/20" />
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </aside>
  )
}
