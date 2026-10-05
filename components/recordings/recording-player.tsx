"use client"

import { useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { LoaderCircleIcon } from "lucide-react"
import { getRecordingPlayback } from "@/lib/actions/recordings"

/** Give up after this many fresh links in a row without the video playing again. */
const MAX_REFRESHES = 3

/**
 * Plays one class recording from a 10-minute signed link
 * (getRecordingPlayback re-checks access each time it is asked).
 *
 * "Watch, don't download": no download item in the native controls
 * (`controlsList="nodownload noplaybackrate"`), no picture-in-picture, no
 * right-click "Save video as". This DETERS casual saving; it cannot prevent
 * it — anyone can screen-record a playing video, and a signed link copied
 * from the browser's dev tools works for its ten minutes. The control that
 * matters is server-side: the file lives only in the private bucket and every
 * link is short-lived and minted after an access check.
 *
 * A link that expires mid-class (a seek or a buffer refill after ten
 * minutes) makes the video error; the player then asks for a fresh link and
 * resumes from the same second.
 */
export function RecordingPlayer({ recordingId }: { recordingId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const resumeRef = useRef<{ time: number; play: boolean } | null>(null)
  const playingRef = useRef(false)
  const refreshesRef = useRef(0)
  const [stopped, setStopped] = useState<string | null>(null)

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["recording-playback", recordingId],
    queryFn: () => getRecordingPlayback(recordingId),
    // A signed link is single-use-ish: never serve one from cache to a new player.
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })

  function handleError() {
    const video = videoRef.current
    if (!video || isFetching) return
    if (refreshesRef.current >= MAX_REFRESHES) {
      setStopped("Playback stopped. Close the recording and open it again.")
      return
    }
    refreshesRef.current += 1
    resumeRef.current = { time: video.currentTime, play: playingRef.current }
    void refetch()
  }

  function handleLoadedMetadata() {
    const video = videoRef.current
    const resume = resumeRef.current
    if (!video || !resume) return
    resumeRef.current = null
    video.currentTime = resume.time
    if (resume.play) video.play().catch(() => {})
  }

  if (isLoading) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-md bg-black text-white/70">
        <LoaderCircleIcon size={20} className="animate-spin motion-reduce:animate-none" aria-label="Loading recording" />
      </div>
    )
  }

  const error = stopped ?? (data && !data.success ? data.error : null)
  if (error || !data?.success) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-md bg-ws-sunken px-6 text-center text-sm text-ws-muted">
        {error ?? "Couldn't open this recording"}
      </div>
    )
  }

  return (
    <video
      ref={videoRef}
      key={recordingId}
      src={data.data.url}
      className="aspect-video w-full rounded-md bg-black"
      controls
      controlsList="nodownload noplaybackrate"
      disablePictureInPicture
      playsInline
      preload="metadata"
      onContextMenu={(e) => e.preventDefault()}
      onError={handleError}
      onLoadedMetadata={handleLoadedMetadata}
      onPlaying={() => {
        playingRef.current = true
        refreshesRef.current = 0
      }}
      onPause={() => {
        playingRef.current = false
      }}
    >
      Your browser can&apos;t play this recording.
    </video>
  )
}
