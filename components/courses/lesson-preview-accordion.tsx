"use client"

import { useState } from "react"
import Image from "next/image"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import type { PublicCourseLesson } from "@/lib/actions/student"
import { PreviewVideoPlayer } from "./preview-video-player"
import { ChevronDownIcon, LockIcon, PlayIcon, TypeIcon, VideoIcon } from "lucide-react"
import { RenderIcon } from "@/components/shared/render-icon"

interface LessonPreviewAccordionProps {
  lessons: PublicCourseLesson[]
  courseId: string
  coursePricing: "free" | "paid"
  coursePrice: number | null
}

// Calculate reading time from text content (average 200 words per minute)
function calculateReadingMins(content: string | null): number {
  if (!content) return 1
  // Strip HTML tags and count words
  const plainText = content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
  const wordCount = plainText.split(" ").filter(Boolean).length
  const minutes = Math.ceil(wordCount / 200)
  return Math.max(1, minutes)
}

// Format video duration (seconds -> mm:ss or just secs)
function formatVideoDuration(durationMins: number | null): string {
  if (!durationMins) return ""
  
  // durationMins is in minutes, convert back to get time display
  if (durationMins < 1) {
    return "< 1min"
  }
  
  return `${durationMins}min`
}

export function LessonPreviewAccordion({
  lessons,
  courseId,
  coursePricing,
  coursePrice,
}: LessonPreviewAccordionProps) {
  const [openLessonId, setOpenLessonId] = useState<string | null>(null)

  const getLessonTypeIcon = (type: "video" | "live" | "text") => {
    switch (type) {
      case "video":
        return VideoIcon
      case "text":
        return TypeIcon
      default:
        return PlayIcon
    }
  }

  const getLessonDurationLabel = (lesson: PublicCourseLesson): string => {
    switch (lesson.type) {
      case "video":
        return lesson.duration ? formatVideoDuration(lesson.duration) : "Video"
      case "text":
        const readMins = calculateReadingMins(lesson.content)
        return `${readMins} min read`
      case "live":
        return "Live Session"
      default:
        return lesson.type
    }
  }

  return (
    <div className="rounded-lg border border-ws-hairline bg-ws-surface divide-y divide-ws-hairline overflow-hidden">
      {lessons.map((lesson, index) => {
        const canPreview = lesson.isFree
        const isOpen = openLessonId === lesson.id
        const hasContent =
          (lesson.type === "video" && lesson.videoUrl) ||
          (lesson.type === "text" && lesson.content)

        // Non-free lessons - no accordion
        if (!canPreview) {
          return (
            <div key={lesson.id}>
              <div className="w-full min-h-14 px-3 py-2 flex items-center gap-3">
                {/* Thumbnail or Number */}
                {lesson.thumbnailUrl ? (
                  <div className="relative w-16 h-10 shrink-0 rounded-sm bg-ws-raised overflow-hidden">
                    <Image
                      src={lesson.thumbnailUrl}
                      alt={lesson.title}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                    {lesson.type === "video" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <div className="w-5 h-5 rounded-full bg-white/90 flex items-center justify-center">
                          <PlayIcon
                            
                            size={10}
                            className="text-black ml-0.5" />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-ws-raised text-sm font-medium tabular-nums text-ws-muted">
                    {index + 1}
                  </span>
                )}

                {/* Lesson Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ws-primary truncate">{lesson.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <RenderIcon icon={getLessonTypeIcon(lesson.type)}
                      
                      size={12}
                      className="text-ws-muted shrink-0" />
                    <span className="text-[11px] text-ws-muted">
                      {getLessonDurationLabel(lesson)}
                    </span>
                  </div>
                </div>

                <LockIcon
                  
                  size={14}
                  className="text-ws-subtle shrink-0" />
              </div>
            </div>
          )
        }

        // Free/Preview lessons - with accordion
        return (
          <Collapsible
            key={lesson.id}
            open={isOpen}
            onOpenChange={(open) => setOpenLessonId(open ? lesson.id : null)}
          >
            <div className="hover:bg-ws-raised transition-colors">
              <CollapsibleTrigger className="w-full min-h-14 px-3 py-2 flex items-center gap-3 text-left">
                {/* Thumbnail or Number */}
                {lesson.thumbnailUrl ? (
                  <div className="relative w-16 h-10 shrink-0 rounded-sm bg-ws-raised overflow-hidden">
                    <Image
                      src={lesson.thumbnailUrl}
                      alt={lesson.title}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                    {lesson.type === "video" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <div className="w-5 h-5 rounded-full bg-white/90 flex items-center justify-center">
                          <PlayIcon
                            
                            size={10}
                            className="text-black ml-0.5" />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-ws-raised text-sm font-medium tabular-nums text-ws-muted">
                    {index + 1}
                  </span>
                )}

                {/* Lesson Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ws-primary truncate">{lesson.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <RenderIcon icon={getLessonTypeIcon(lesson.type)}
                      
                      size={12}
                      className="text-ws-muted shrink-0" />
                    <span className="text-[11px] text-ws-muted">
                      {getLessonDurationLabel(lesson)}
                    </span>
                  </div>
                </div>

                {/* Right side: Preview marker + Arrow */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-ws-gold">
                    <PlayIcon  size={13} fill="currentColor" />
                    Preview
                  </span>
                  <ChevronDownIcon
                    
                    size={16}
                    className={`text-ws-muted transition-transform duration-[var(--ws-motion-base)] ${
                      isOpen ? "rotate-180" : ""
                    }`} />
                </div>
              </CollapsibleTrigger>

              {/* Expandable Content */}
              <CollapsibleContent>
                <div className="px-3 pb-3 space-y-3">
                  {/* Description */}
                  {lesson.description && (
                    <p className="text-xs text-ws-muted">
                      {lesson.description}
                    </p>
                  )}

                  {/* Video Preview with custom player */}
                  {lesson.type === "video" && lesson.videoUrl && (
                    <PreviewVideoPlayer
                      src={lesson.videoUrl}
                      poster={lesson.thumbnailUrl}
                      courseId={courseId}
                      coursePricing={coursePricing}
                      coursePrice={coursePrice}
                    />
                  )}

                  {/* Text Content Preview */}
                  {lesson.type === "text" && lesson.content && (
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none text-sm text-ws-muted [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                      dangerouslySetInnerHTML={{
                        __html: lesson.content,
                      }}
                    />
                  )}

                  {/* No content available */}
                  {!hasContent && (
                    <p className="text-xs text-ws-muted italic">
                      Preview content not available
                    </p>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )
      })}
    </div>
  )
}
