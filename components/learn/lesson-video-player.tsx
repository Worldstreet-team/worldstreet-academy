"use client"

import { useRouter } from "next/navigation"
import { useTransition, useEffect, useState } from "react"
import { VideoPlayer } from "@/components/learn/video-player"
import { markLessonComplete } from "@/lib/actions/student"
import { getLessonWatchProgress } from "@/lib/actions/watch-progress"

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
  const [initialTime, setInitialTime] = useState<number | undefined>(undefined)
  
  // Fetch saved watch position on mount
  useEffect(() => {
    getLessonWatchProgress(lessonId).then((progress) => {
      if (progress && progress.currentTime > 0) {
        setInitialTime(progress.currentTime)
      }
    })
  }, [lessonId])
  
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
      lessonId={lessonId}
      currentTitle={currentTitle}
      nextLesson={nextLesson}
      onComplete={handleComplete}
      initialTime={initialTime}
    />
  )
}
