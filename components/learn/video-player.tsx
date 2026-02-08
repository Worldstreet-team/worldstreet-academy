"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  PlayIcon,
  PauseIcon,
  VolumeHighIcon,
  VolumeLowIcon,
  VolumeMuteIcon,
  FullScreenIcon,
  MinimizeScreenIcon,
  Forward01Icon,
  Backward01Icon,
  Settings01Icon,
  Lamp01Icon,
  PictureInPictureOnIcon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { AnimatePresence, motion } from "motion/react"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Lesson = {
  id: string
  title: string
  duration: number | null
  type: string
}

type VideoPlayerProps = {
  src: string
  courseId: string
  nextLesson: Lesson | null
  currentTitle: string
  onLightsOut?: (active: boolean) => void
  onComplete?: () => void
}

const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

function formatTime(seconds: number) {
  if (!isFinite(seconds) || seconds < 0) return "0:00"
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function VideoPlayer({
  src,
  courseId,
  nextLesson,
  currentTitle,
  onLightsOut,
  onComplete,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const hideTimeout = useRef<ReturnType<typeof setTimeout>>(null)
  const osdTimeout = useRef<ReturnType<typeof setTimeout>>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [volume, setVolume] = useState(1)
  const [prevVolume, setPrevVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [showOverlay, setShowOverlay] = useState(false)
  const [countdown, setCountdown] = useState(5)
  const [isSeeking, setIsSeeking] = useState(false)
  const [hoverTime, setHoverTime] = useState<number | null>(null)
  const [hoverX, setHoverX] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [lightsOut, setLightsOut] = useState(false)

  // Volume hover popover
  const [showVolumeSlider, setShowVolumeSlider] = useState(false)
  const volumeHideTimeout = useRef<ReturnType<typeof setTimeout>>(null)

  // Settings / speed menu
  const [showSettings, setShowSettings] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)

  // OSD (on-screen display) for volume / speed / skip feedback
  const [osd, setOsd] = useState<string | null>(null)

  // Double-tap seek for mobile
  const tapTimeout = useRef<ReturnType<typeof setTimeout>>(null)
  const lastTapX = useRef<number>(0)
  const tapCount = useRef(0)

  // Seek indicator animation
  const [seekIndicator, setSeekIndicator] = useState<{ side: "left" | "right"; key: number } | null>(null)
  const seekIndicatorKey = useRef(0)

  // Mobile settings drawer
  const [showMobileSettings, setShowMobileSettings] = useState(false)

  const router = useRouter()

  /* ---- OSD flash ---- */
  const flashOsd = useCallback((text: string) => {
    setOsd(text)
    if (osdTimeout.current) clearTimeout(osdTimeout.current)
    osdTimeout.current = setTimeout(() => setOsd(null), 800)
  }, [])

  /* ---- Auto-hide controls ---- */
  const resetHideTimer = useCallback(() => {
    setShowControls(true)
    if (hideTimeout.current) clearTimeout(hideTimeout.current)
    hideTimeout.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false)
        setShowVolumeSlider(false)
        setShowSettings(false)
      }
    }, 3000)
  }, [isPlaying])

  useEffect(() => {
    resetHideTimer()
    return () => {
      if (hideTimeout.current) clearTimeout(hideTimeout.current)
    }
  }, [resetHideTimer])

  /* ---- Video event handlers ---- */
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current
    if (!video || isSeeking) return
    setCurrentTime(video.currentTime)
    setDuration((d) => (video.duration && isFinite(video.duration) ? video.duration : d))
  }, [isSeeking])

  const handleProgress = useCallback(() => {
    const video = videoRef.current
    if (!video || video.buffered.length === 0) return
    setBuffered(video.buffered.end(video.buffered.length - 1))
  }, [])

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    setDuration(video.duration)
    video.volume = volume
  }, [volume])

  /* ---- rAF progress sync (always running for smooth bar) ---- */
  const isPlayingRef = useRef(isPlaying)
  const isSeekingRef = useRef(isSeeking)
  isPlayingRef.current = isPlaying
  isSeekingRef.current = isSeeking

  useEffect(() => {
    let raf: number
    const sync = () => {
      const video = videoRef.current
      if (video && !isSeekingRef.current && !video.paused) {
        setCurrentTime(video.currentTime)
        if (video.duration && isFinite(video.duration)) {
          setDuration(video.duration)
        }
      }
      raf = requestAnimationFrame(sync)
    }
    raf = requestAnimationFrame(sync)
    return () => cancelAnimationFrame(raf)
  }, [])

  const handleEnded = useCallback(() => {
    setIsPlaying(false)
    // Mark lesson as complete
    onComplete?.()
    if (nextLesson) {
      setShowOverlay(true)
      setCountdown(5)
    }
  }, [nextLesson, onComplete])

  // Fullscreen change listener
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", handler)
    return () => document.removeEventListener("fullscreenchange", handler)
  }, [])

  /* ---- Countdown to auto-redirect ---- */
  useEffect(() => {
    if (!showOverlay) return
    if (countdown <= 0) {
      router.push(`/dashboard/courses/${courseId}/learn/${nextLesson?.id}`)
      return
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [showOverlay, countdown, courseId, nextLesson, router])

  /* ---- Play / Pause ---- */
  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play()
      setIsPlaying(true)
    } else {
      video.pause()
      setIsPlaying(false)
    }
    resetHideTimer()
  }, [resetHideTimer])

  /* ---- Seek ---- */
  const seekFromEvent = useCallback(
    (clientX: number) => {
      const video = videoRef.current
      const bar = progressRef.current
      if (!video || !bar || !duration) return
      const rect = bar.getBoundingClientRect()
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      video.currentTime = pct * duration
      setCurrentTime(pct * duration)
    },
    [duration]
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsSeeking(true)
      seekFromEvent(e.clientX)
      const bar = progressRef.current
      if (!bar) return
      bar.setPointerCapture(e.pointerId)
      const onMove = (ev: PointerEvent) => seekFromEvent(ev.clientX)
      const onUp = () => {
        setIsSeeking(false)
        bar.removeEventListener("pointermove", onMove)
        bar.removeEventListener("pointerup", onUp)
      }
      bar.addEventListener("pointermove", onMove)
      bar.addEventListener("pointerup", onUp)
    },
    [seekFromEvent]
  )

  const handleProgressHover = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const bar = progressRef.current
      if (!bar) return
      const rect = bar.getBoundingClientRect()
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      setHoverTime(pct * duration)
      setHoverX(e.clientX - rect.left)
    },
    [duration]
  )

  /* ---- Skip ---- */
  const skip = useCallback((seconds: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds))
  }, [])

  /* ---- Volume ---- */
  const setVolumeLevel = useCallback(
    (v: number) => {
      const video = videoRef.current
      if (!video) return
      const clamped = Math.max(0, Math.min(1, v))
      video.volume = clamped
      video.muted = clamped === 0
      setVolume(clamped)
      setIsMuted(clamped === 0)
      if (clamped > 0) setPrevVolume(clamped)
      flashOsd(`${Math.round(clamped * 100)}%`)
    },
    [flashOsd]
  )

  const toggleMute = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.muted || volume === 0) {
      const restore = prevVolume > 0 ? prevVolume : 0.5
      video.muted = false
      video.volume = restore
      setVolume(restore)
      setIsMuted(false)
      flashOsd(`${Math.round(restore * 100)}%`)
    } else {
      setPrevVolume(volume)
      video.muted = true
      setIsMuted(true)
      flashOsd("Muted")
    }
  }, [volume, prevVolume, flashOsd])

  /* ---- Playback Rate ---- */
  const changePlaybackRate = useCallback(
    (rate: number) => {
      const video = videoRef.current
      if (!video) return
      video.playbackRate = rate
      setPlaybackRate(rate)
      setShowSettings(false)
      flashOsd(`${rate}x`)
    },
    [flashOsd]
  )

  /* ---- Fullscreen ---- */
  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      el.requestFullscreen()
    }
  }, [])

  /* ---- PiP ---- */
  const togglePip = useCallback(async () => {
    const video = videoRef.current
    if (!video) return
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
      } else {
        await video.requestPictureInPicture()
      }
    } catch {
      // PiP not supported
    }
  }, [])

  /* ---- Lights Out ---- */
  const toggleLightsOut = useCallback(() => {
    setLightsOut((v) => {
      const next = !v
      onLightsOut?.(next)
      flashOsd(next ? "Lights Off" : "Lights On")
      return next
    })
  }, [onLightsOut, flashOsd])

  /* ---- Volume slider hover ---- */
  const handleVolumeEnter = useCallback(() => {
    if (volumeHideTimeout.current) clearTimeout(volumeHideTimeout.current)
    setShowVolumeSlider(true)
  }, [])

  const handleVolumeLeave = useCallback(() => {
    volumeHideTimeout.current = setTimeout(() => setShowVolumeSlider(false), 300)
  }, [])

  /* ---- Double-tap seek (mobile) / single-tap play/pause ---- */
  const handleVideoTap = useCallback(
    (e: React.MouseEvent<HTMLVideoElement>) => {
      // On desktop, just toggle play
      if (!("ontouchstart" in window)) {
        togglePlay()
        return
      }
      e.preventDefault()
      const clientX = e.clientX

      tapCount.current += 1
      lastTapX.current = clientX

      if (tapCount.current === 1) {
        tapTimeout.current = setTimeout(() => {
          if (tapCount.current === 1) {
            togglePlay()
          }
          tapCount.current = 0
        }, 250)
      } else if (tapCount.current >= 2) {
        if (tapTimeout.current) clearTimeout(tapTimeout.current)
        tapCount.current = 0

        const video = videoRef.current
        if (!video) return
        const rect = video.getBoundingClientRect()
        const x = clientX - rect.left
        const half = rect.width / 2

        if (x < half) {
          skip(-10)
          flashOsd("-10s")
          seekIndicatorKey.current += 1
          setSeekIndicator({ side: "left", key: seekIndicatorKey.current })
        } else {
          skip(10)
          flashOsd("+10s")
          seekIndicatorKey.current += 1
          setSeekIndicator({ side: "right", key: seekIndicatorKey.current })
        }
        setTimeout(() => setSeekIndicator(null), 600)
      }
    },
    [togglePlay, skip, flashOsd]
  )

  /* ---- Keyboard shortcuts ---- */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault()
          togglePlay()
          break
        case "ArrowLeft":
          e.preventDefault()
          skip(-10)
          flashOsd("-10s")
          break
        case "ArrowRight":
          e.preventDefault()
          skip(10)
          flashOsd("+10s")
          break
        case "ArrowUp":
          e.preventDefault()
          setVolumeLevel(volume + 0.05)
          break
        case "ArrowDown":
          e.preventDefault()
          setVolumeLevel(volume - 0.05)
          break
        case "m":
          toggleMute()
          break
        case "f":
          toggleFullscreen()
          break
        case "p":
          togglePip()
          break
        case "l":
          toggleLightsOut()
          break
        case ">":
        case ".": {
          const idx = PLAYBACK_RATES.indexOf(playbackRate)
          if (idx < PLAYBACK_RATES.length - 1) changePlaybackRate(PLAYBACK_RATES[idx + 1])
          break
        }
        case "<":
        case ",": {
          const idx = PLAYBACK_RATES.indexOf(playbackRate)
          if (idx > 0) changePlaybackRate(PLAYBACK_RATES[idx - 1])
          break
        }
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [
    togglePlay, skip, toggleMute, toggleFullscreen, togglePip,
    toggleLightsOut, setVolumeLevel, volume, changePlaybackRate,
    playbackRate, flashOsd,
  ])

  /* ---- Derived ---- */
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const bufferProgress = duration > 0 ? (buffered / duration) * 100 : 0
  const VolumeIcon =
    isMuted || volume === 0
      ? VolumeMuteIcon
      : volume < 0.5
        ? VolumeLowIcon
        : VolumeHighIcon

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative aspect-video w-full bg-black select-none group",
        lightsOut && "z-50"
      )}
      onMouseMove={resetHideTimer}
      onMouseLeave={() => {
        if (isPlaying) setShowControls(false)
        setShowVolumeSlider(false)
        setShowSettings(false)
      }}
    >
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain"
        onTimeUpdate={handleTimeUpdate}
        onProgress={handleProgress}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onClick={handleVideoTap}
        preload="auto"
        playsInline
      />

      {/* ---- Double-tap seek indicators ---- */}
      <AnimatePresence>
        {seekIndicator && (
          <motion.div
            key={seekIndicator.key}
            initial={{ opacity: 0.8, scale: 1 }}
            animate={{ opacity: 0, scale: 1.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className={cn(
              "absolute top-0 bottom-0 w-1/3 pointer-events-none flex items-center justify-center",
              seekIndicator.side === "left" ? "left-0 rounded-r-full" : "right-0 rounded-l-full"
            )}
          >
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
              <HugeiconsIcon
                icon={seekIndicator.side === "left" ? Backward01Icon : Forward01Icon}
                size={24}
                className="text-white"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- OSD flash (volume %, speed, skip) ---- */}
      <AnimatePresence>
        {osd && (
          <motion.div
            key={osd}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.15 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30"
          >
            <div className="bg-black/70 backdrop-blur-sm text-white text-lg font-semibold px-5 py-2.5 rounded-xl">
              {osd}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- Center play button (paused state) ---- */}
      {!isPlaying && !showOverlay && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity"
        >
          <div className="flex h-12 w-12 md:h-16 md:w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
            <HugeiconsIcon icon={PlayIcon} size={22} className="md:hidden" />
            <HugeiconsIcon icon={PlayIcon} size={28} className="hidden md:block" />
          </div>
        </button>
      )}

      {/* ---- Controls bar ---- */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent px-2.5 md:px-4 pb-2 md:pb-3 pt-8 md:pt-10 transition-opacity duration-300",
          showControls && !showOverlay ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Progress bar */}
        <div
          ref={progressRef}
          className="relative h-1 md:h-1.5 rounded-full bg-white/20 cursor-pointer mb-2 md:mb-3 group/progress hover:h-2.5 transition-all touch-none"
          onPointerDown={handlePointerDown}
          onMouseMove={handleProgressHover}
          onMouseLeave={() => setHoverTime(null)}
        >
          {/* Buffer bar */}
          <div
            className="absolute top-0 left-0 h-full rounded-full bg-white/15 transition-[width] duration-300"
            style={{ width: `${bufferProgress}%` }}
          />
          {/* Played progress */}
          <div
            className="absolute top-0 left-0 h-full rounded-full bg-primary"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 h-3 w-3 md:h-3.5 md:w-3.5 rounded-full bg-primary border-2 border-white shadow opacity-0 group-hover/progress:opacity-100 transition-opacity" />
          </div>
          {/* Hover tooltip */}
          {hoverTime !== null && (
            <div
              className="absolute -top-8 -translate-x-1/2 bg-black/90 text-white text-[10px] px-1.5 py-0.5 rounded pointer-events-none"
              style={{ left: hoverX }}
            >
              {formatTime(hoverTime)}
            </div>
          )}
        </div>

        {/* Control buttons */}
        <div className="flex items-center justify-between">
          {/* Left controls */}
          <div className="flex items-center gap-0.5 md:gap-1.5">
            <button onClick={togglePlay} className="text-white hover:text-primary transition-colors p-1">
              <HugeiconsIcon icon={isPlaying ? PauseIcon : PlayIcon} size={18} />
            </button>
            <button
              onClick={() => { skip(-10); flashOsd("-10s") }}
              className="text-white/70 hover:text-white transition-colors p-1"
            >
              <HugeiconsIcon icon={Backward01Icon} size={16} />
            </button>
            <button
              onClick={() => { skip(10); flashOsd("+10s") }}
              className="text-white/70 hover:text-white transition-colors p-1"
            >
              <HugeiconsIcon icon={Forward01Icon} size={16} />
            </button>

            {/* Volume with hover slider — hidden on mobile */}
            <div
              className="relative hidden md:flex items-center"
              onMouseEnter={handleVolumeEnter}
              onMouseLeave={handleVolumeLeave}
            >
              <button onClick={toggleMute} className="text-white/70 hover:text-white transition-colors p-1">
                <HugeiconsIcon icon={VolumeIcon} size={16} />
              </button>
              <AnimatePresence>
                {showVolumeSlider && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden flex items-center"
                  >
                    <div className="flex items-center gap-2 pl-1 pr-2">
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={isMuted ? 0 : volume}
                        onChange={(e) => setVolumeLevel(parseFloat(e.target.value))}
                        className="w-20 h-1 accent-primary cursor-pointer appearance-none bg-white/30 rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow"
                      />
                      <span className="text-white/60 text-[10px] tabular-nums w-7 text-right">
                        {Math.round((isMuted ? 0 : volume) * 100)}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <span className="text-white/80 text-[10px] md:text-xs tabular-nums ml-0.5 md:ml-1">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-0.5 md:gap-1">
            {/* Current speed badge — click to reset */}
            {playbackRate !== 1 && (
              <button
                onClick={() => changePlaybackRate(1)}
                className="hidden md:inline-flex text-primary text-[10px] font-bold bg-primary/20 px-1.5 py-0.5 rounded hover:bg-primary/30 transition-colors"
              >
                {playbackRate}x
              </button>
            )}

            {/* Desktop: Settings popover (speed + quality) */}
            <Popover open={showSettings} onOpenChange={(open) => { setShowSettings(open); if (open) setShowVolumeSlider(false) }}>
              <PopoverTrigger
                className={cn(
                  "hidden md:inline-flex text-white/70 hover:text-white transition-colors p-1",
                  showSettings && "text-white"
                )}
              >
                <HugeiconsIcon icon={Settings01Icon} size={16} />
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="end"
                sideOffset={12}
                className="bg-black/90 backdrop-blur-md border-white/10 min-w-44 overflow-hidden p-0"
              >
                {/* Speed section */}
                <div className="px-3 py-2 border-b border-white/10">
                  <p className="text-white/50 text-[10px] uppercase tracking-wider font-medium">
                    Speed
                  </p>
                </div>
                <div className="py-1 max-h-36 overflow-auto">
                  {PLAYBACK_RATES.map((rate) => (
                    <button
                      key={rate}
                      onClick={() => changePlaybackRate(rate)}
                      className={cn(
                        "w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center justify-between",
                        rate === playbackRate
                          ? "text-primary bg-primary/10"
                          : "text-white/70 hover:text-white hover:bg-white/5"
                      )}
                    >
                      <span>{rate === 1 ? "Normal" : `${rate}x`}</span>
                      {rate === playbackRate && (
                        <span className="text-primary text-xs">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Mobile: Settings button opens drawer */}
            <button
              onClick={(e) => { e.stopPropagation(); setShowMobileSettings(true); resetHideTimer() }}
              className="md:hidden text-white/70 hover:text-white transition-colors p-1"
            >
              <HugeiconsIcon icon={Settings01Icon} size={16} />
            </button>

            {/* Lights Out — hidden on mobile */}
            <button
              onClick={toggleLightsOut}
              className={cn(
                "hidden md:inline-flex transition-colors p-1",
                lightsOut ? "text-primary" : "text-white/70 hover:text-white"
              )}
              title="Lights Out (L)"
            >
              <HugeiconsIcon icon={Lamp01Icon} size={16} />
            </button>

            {/* PiP — hidden on mobile */}
            <button
              onClick={togglePip}
              className="hidden md:inline-flex text-white/70 hover:text-white transition-colors p-1"
              title="Picture in Picture (P)"
            >
              <HugeiconsIcon icon={PictureInPictureOnIcon} size={16} />
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="text-white/70 hover:text-white transition-colors p-1"
              title="Fullscreen (F)"
            >
              <HugeiconsIcon icon={isFullscreen ? MinimizeScreenIcon : FullScreenIcon} size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ---- Mobile Settings Sheet (rendered outside video via portal) ---- */}
      <Sheet open={showMobileSettings} onOpenChange={setShowMobileSettings}>
        <SheetContent side="bottom" showCloseButton={false} className="rounded-t-2xl p-0 max-h-[70svh] overflow-auto">
          {/* Drag handle */}
          <div className="flex justify-center pt-2.5 pb-1">
            <div className="h-1 w-8 rounded-full bg-muted-foreground/30" />
          </div>

          <div className="px-4 pb-5 space-y-4">
            <SheetHeader className="p-0">
              <SheetTitle className="text-sm font-semibold">Settings</SheetTitle>
            </SheetHeader>

            {/* Speed */}
            <div className="space-y-2">
              <p className="text-muted-foreground text-[10px] uppercase tracking-wider font-medium">Speed</p>
              <div className="flex flex-wrap gap-1.5">
                {PLAYBACK_RATES.map((rate) => (
                  <button
                    key={rate}
                    onClick={() => changePlaybackRate(rate)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                      rate === playbackRate
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {rate === 1 ? "Normal" : `${rate}x`}
                  </button>
                ))}
              </div>
            </div>

            {/* Extra options */}
            <div className="space-y-1">
              <p className="text-muted-foreground text-[10px] uppercase tracking-wider font-medium mb-2">More</p>
              <button
                onClick={() => { toggleLightsOut(); setShowMobileSettings(false) }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <span className="flex items-center gap-2.5 text-sm">
                  <HugeiconsIcon icon={Lamp01Icon} size={15} />
                  Lights Out
                </span>
                <span className={cn("text-[10px] font-medium", lightsOut ? "text-primary" : "text-muted-foreground")}>
                  {lightsOut ? "On" : "Off"}
                </span>
              </button>
              <button
                onClick={() => { togglePip(); setShowMobileSettings(false) }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <span className="flex items-center gap-2.5 text-sm">
                  <HugeiconsIcon icon={PictureInPictureOnIcon} size={15} />
                  Picture in Picture
                </span>
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ---- Auto-redirect countdown overlay ---- */}
      {showOverlay && nextLesson && (
        <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center gap-3 md:gap-5 z-20 px-6">
          <p className="text-white/60 text-xs md:text-sm">Up next</p>
          <h3 className="text-white text-base md:text-xl font-semibold text-center max-w-lg">
            {nextLesson.title}
          </h3>
          <div className="flex items-center justify-center h-12 w-12 md:h-16 md:w-16 rounded-full border-2 border-white/20">
            <span className="text-white text-xl md:text-2xl font-bold tabular-nums">
              {countdown}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowOverlay(false)}
              className="text-white/60 hover:text-white text-xs md:text-sm underline underline-offset-2 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => router.push(`/dashboard/courses/${courseId}/learn/${nextLesson.id}`)}
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors"
            >
              Play Now
            </button>
          </div>
        </div>
      )}

      {/* ---- Lights out backdrop ---- */}
      {lightsOut && (
        <div
          className="fixed inset-0 bg-black/90 -z-10"
          onClick={toggleLightsOut}
        />
      )}
    </div>
  )
}
