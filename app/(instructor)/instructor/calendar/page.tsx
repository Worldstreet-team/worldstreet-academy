"use client"

import { useState } from "react"
import { Topbar } from "@/components/platform/topbar"
import { PageHeader } from "@/components/shared/page-header"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TeachingCalendar } from "@/components/instructor/teaching-calendar"
import { InstructorRecordings } from "@/components/recordings/instructor-recordings"
import { RecordingPlayer } from "@/components/recordings/recording-player"

/** The tutor's academic calendar: classes, mentorship sessions and class recordings. */
export default function InstructorCalendarPage() {
  const [playing, setPlaying] = useState<{ id: string; title: string } | null>(null)

  return (
    <>
      <Topbar title="Calendar" variant="instructor" />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-6xl space-y-8">
          <PageHeader
            title="Calendar"
            subline="Your live classes and mentorship sessions. Every class is recorded; 1-on-1 sessions are not."
          />
          <TeachingCalendar onPlay={setPlaying} />
          <InstructorRecordings onPlay={setPlaying} />
        </div>
      </div>

      <Dialog open={playing !== null} onOpenChange={(open) => !open && setPlaying(null)}>
        <DialogContent className="sm:max-w-3xl">
          {playing && (
            <>
              <DialogHeader>
                <DialogTitle>{playing.title}</DialogTitle>
              </DialogHeader>
              <RecordingPlayer recordingId={playing.id} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
