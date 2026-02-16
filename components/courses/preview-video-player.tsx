"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  PlayIcon,
  PauseIcon,
  VolumeHighIcon,
  VolumeMute01Icon,
  FullScreenIcon,
  MinimizeScreenIcon,
  Forward01Icon,
  Backward01Icon,
  ShoppingCart01Icon,
} from "@hugeicons/core-free-icons"

interface PreviewVideoPlayerProps {
  src: string
  poster?: string | null
  courseId: string
  coursePricing: "free" | "paid"
  coursePrice: number | null
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export function PreviewVideoPlayer({
  src,
  poster,
  courseId,
  coursePricing,
  coursePrice,
}: PreviewVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [showEnrollCTA, setShowEnrollCTA] = useState(false)

  const hideControlsTimeout = useRef<NodeJS.Timeout | null>(null)

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return
    if (showEnrollCTA) {
      // Restart video from beginning
      videoRef.current.currentTime = 0
      setShowEnrollCTA(false)
    }
    if (videoRef.current.paused) {
      videoRef.current.play()
    } else {
      videoRef.current.pause()
    }
  }, [showEnrollCTA])

  // Skip forward/backward
  const skip = useCallback((seconds: number) => {
    if (!videoRef.current) return
    videoRef.current.currentTime = Math.max(
      0,
      Math.min(videoRef.current.currentTime + seconds, duration)
    )
  }, [duration])

  // Seek
  const handleSeek = useCallback((value: number | readonly number[]) => {
    if (!videoRef.current) return
    const seekValue = Array.isArray(value) ? value[0] : value
    videoRef.current.currentTime = seekValue
    setCurrentTime(seekValue)
  }, [])

  // Volume
  const handleVolumeChange = useCallback((value: number | readonly number[]) => {
    if (!videoRef.current) return
    const newVolume = Array.isArray(value) ? value[0] : value
    videoRef.current.volume = newVolume
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
  }, [])

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return
    if (isMuted) {
      videoRef.current.muted = false
      setIsMuted(false)
    } else {
      videoRef.current.muted = true
      setIsMuted(true)
    }
  }, [isMuted])

  // Fullscreen
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen()
        setIsFullscreen(true)
      } else {
        await document.exitFullscreen()
        setIsFullscreen(false)
      }
    } catch (err) {
      console.error("Fullscreen error:", err)
    }
  }, [])

  // Auto-hide controls
  const resetHideControlsTimer = useCallback(() => {
    setShowControls(true)
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current)
    }
    if (isPlaying) {
      hideControlsTimeout.current = setTimeout(() => {
        setShowControls(false)
      }, 3000)
    }
  }, [isPlaying])

  // Event handlers
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleTimeUpdate = () => setCurrentTime(video.currentTime)
    const handleLoadedMetadata = () => setDuration(video.duration)
    const handleEnded = () => {
      setIsPlaying(false)
      setShowEnrollCTA(true)
      setShowControls(true)
    }

    video.addEventListener("play", handlePlay)
    video.addEventListener("pause", handlePause)
    video.addEventListener("timeupdate", handleTimeUpdate)
    video.addEventListener("loadedmetadata", handleLoadedMetadata)
    video.addEventListener("ended", handleEnded)

    return () => {
      video.removeEventListener("play", handlePlay)
      video.removeEventListener("pause", handlePause)
      video.removeEventListener("timeupdate", handleTimeUpdate)
      video.removeEventListener("loadedmetadata", handleLoadedMetadata)
      video.removeEventListener("ended", handleEnded)
    }
  }, [])

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if video container is focused or video is playing
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      
      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault()
          togglePlay()
          break
        case "arrowleft":
        case "j":
          e.preventDefault()
          skip(-5)
          break
        case "arrowright":
        case "l":
          e.preventDefault()
          skip(5)
          break
        case "m":
          e.preventDefault()
          toggleMute()
          break
        case "f":
          e.preventDefault()
          toggleFullscreen()
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [togglePlay, skip, toggleMute, toggleFullscreen])

  return (
    <div
      ref={containerRef}
      className="relative aspect-video bg-black rounded-lg overflow-hidden group"
      onMouseMove={resetHideControlsTimer}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster || undefined}
        className="w-full h-full object-contain"
        playsInline
        onClick={togglePlay}
      />

      {/* Enroll CTA Overlay */}
      {showEnrollCTA && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-4 z-20">
          <p className="text-white text-sm font-medium text-center px-4">
            Enjoyed the preview? Enroll now to continue learning!
          </p>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              className="gap-2"
              render={<Link href={`/dashboard/courses/${courseId}`} />}
            >
              <HugeiconsIcon icon={ShoppingCart01Icon} size={16} />
              {coursePricing === "free" || !coursePrice
                ? "Enroll for Free"
                : `Enroll for $${coursePrice}`}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={togglePlay}
              className="text-white border-white/40 hover:bg-white/10"
            >
              Replay
            </Button>
          </div>
        </div>
      )}

      {/* Center Play Button (when paused and no CTA) */}
      {!isPlaying && !showEnrollCTA && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity"
        >
          <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
            <HugeiconsIcon icon={PlayIcon} size={24} className="text-black ml-1" />
          </div>
        </button>
      )}

      {/* Controls */}
      <div
        className={`absolute bottom-0 left-0 right-0 px-3 pb-2 pt-8 bg-linear-to-t from-black/80 to-transparent transition-opacity duration-300 ${
          showControls && !showEnrollCTA ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Progress Bar */}
        <Slider
          value={[currentTime]}
          max={duration || 100}
          step={0.1}
          onValueChange={handleSeek}
          className="mb-2 cursor-pointer"
        />

        {/* Control Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="p-1.5 text-white hover:text-primary transition-colors"
            >
              <HugeiconsIcon
                icon={isPlaying ? PauseIcon : PlayIcon}
                size={18}
              />
            </button>

            {/* Skip Backward */}
            <button
              onClick={() => skip(-5)}
              className="p-1.5 text-white hover:text-primary transition-colors"
            >
              <HugeiconsIcon icon={Backward01Icon} size={16} />
            </button>

            {/* Skip Forward */}
            <button
              onClick={() => skip(5)}
              className="p-1.5 text-white hover:text-primary transition-colors"
            >
              <HugeiconsIcon icon={Forward01Icon} size={16} />
            </button>

            {/* Volume */}
            <div className="flex items-center gap-1 ml-1">
              <button
                onClick={toggleMute}
                className="p-1.5 text-white hover:text-primary transition-colors"
              >
                <HugeiconsIcon
                  icon={isMuted || volume === 0 ? VolumeMute01Icon : VolumeHighIcon}
                  size={16}
                />
              </button>
              <Slider
                value={[isMuted ? 0 : volume]}
                max={1}
                step={0.01}
                onValueChange={handleVolumeChange}
                className="w-16 cursor-pointer"
              />
            </div>

            {/* Time */}
            <span className="text-white text-[10px] ml-2 tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 text-white hover:text-primary transition-colors"
            >
              <HugeiconsIcon
                icon={isFullscreen ? MinimizeScreenIcon : FullScreenIcon}
                size={16}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
