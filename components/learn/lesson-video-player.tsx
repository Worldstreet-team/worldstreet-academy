"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { VideoPlayer } from "@/components/learn/video-player"
import { markLessonComplete } from "@/lib/actions/student"

type Lesson = {
  id: string
  title: string
  duration: number | null
  type: string
}

type LessonVideoPlayerProps = {
  src: string
  courseId: string
  lessonId: string
  currentTitle: string
  nextLesson: Lesson | null
}

export function LessonVideoPlayer({
  src,
  courseId,
  lessonId,
  currentTitle,
  nextLesson,
}: LessonVideoPlayerProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  
  const handleComplete = () => {
    startTransition(async () => {
      await markLessonComplete(courseId, lessonId)
      router.refresh()
    })
  }
  
  return (
    <VideoPlayer
      src={src}
      courseId={courseId}
      currentTitle={currentTitle}
      nextLesson={nextLesson}
      onComplete={handleComplete}
    />
  )
}
