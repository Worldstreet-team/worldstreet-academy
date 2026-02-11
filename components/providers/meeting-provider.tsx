"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react"
import { useRouter, usePathname } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Mic01Icon,
  MicOff01Icon,
  CallEnd01Icon,
  Video01Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

/* ═══════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════ */

type ActiveMeetingInfo = {
  meetingId: string
  title: string
  isHost: boolean
  startTime: Date | null
  participantCount: number
}

type MeetingContextType = {
  activeMeetingInfo: ActiveMeetingInfo | null
  isMinimized: boolean
  registerMeeting: (info: ActiveMeetingInfo) => void
  unregisterMeeting: () => void
  updateMeeting: (partial: Partial<ActiveMeetingInfo>) => void
  setMinimized: (minimized: boolean) => void
  hasActiveMeeting: boolean
  setMeetingCallbacks: (cbs: MeetingCallbacks) => void
  /** Update muted state so PIP bar re-renders */
  setMeetingMuted: (muted: boolean) => void
}

type MeetingCallbacks = {
  onToggleMute: () => void
  onEndMeeting: () => void
}

const MeetingContext = createContext<MeetingContextType | null>(null)

export function useMeeting() {
  const context = useContext(MeetingContext)
  if (!context) {
    throw new Error("useMeeting must be used within MeetingProvider")
  }
  return context
}

/** Safe check outside the provider tree */
export function useActiveMeeting() {
  const context = useContext(MeetingContext)
  return context?.hasActiveMeeting ?? false
}

/* ═══════════════════════════════════════════════════════
   PIP TIMER
   ═══════════════════════════════════════════════════════ */

function PipTimer({ startTime }: { startTime: Date | null }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!startTime) return
    const iv = setInterval(
      () => setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000)),
      1000,
    )
    return () => clearInterval(iv)
  }, [startTime])
  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60
  if (h > 0) return <span className="text-xs text-muted-foreground tabular-nums">{h}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}</span>
  return <span className="text-xs text-muted-foreground tabular-nums">{m}:{String(s).padStart(2, "0")}</span>
}

/* ═══════════════════════════════════════════════════════
   PROVIDER
   ═══════════════════════════════════════════════════════ */

export function MeetingProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [activeMeetingInfo, setActiveMeetingInfo] = useState<ActiveMeetingInfo | null>(null)
  const [isMinimized, setIsMinimized] = useState(false)
  const [pipMuted, setPipMuted] = useState(false)
  const callbacksRef = useRef<MeetingCallbacks | null>(null)

  const hasActiveMeeting = activeMeetingInfo !== null

  const registerMeeting = useCallback((info: ActiveMeetingInfo) => {
    setActiveMeetingInfo(info)
    setIsMinimized(false)
  }, [])

  const unregisterMeeting = useCallback(() => {
    setActiveMeetingInfo(null)
    setIsMinimized(false)
    setPipMuted(false)
    callbacksRef.current = null
  }, [])

  const updateMeeting = useCallback((partial: Partial<ActiveMeetingInfo>) => {
    setActiveMeetingInfo((prev) => (prev ? { ...prev, ...partial } : prev))
  }, [])

  const setMeetingCallbacks = useCallback((cbs: MeetingCallbacks) => {
    callbacksRef.current = cbs
  }, [])

  const setMeetingMuted = useCallback((muted: boolean) => {
    setPipMuted(muted)
  }, [])

  const MEETINGS_PATHS = ["/dashboard/meetings", "/instructor/meetings"]
  const isOnMeetingsPage = MEETINGS_PATHS.includes(pathname)

  // Determine which meetings route to navigate to from PiP
  const meetingsRoute = pathname.startsWith("/instructor")
    ? "/instructor/meetings"
    : "/dashboard/meetings"

  // When navigating away from meetings page while in a meeting, auto-minimize
  const prevOnMeetingsPage = useRef(true)
  useEffect(() => {
    // Only auto-minimize when user *navigates away* (transition from on-page to off-page)
    if (hasActiveMeeting && prevOnMeetingsPage.current && !isOnMeetingsPage) {
      // Defer to avoid setState-in-effect lint; runs next microtask
      queueMicrotask(() => setIsMinimized(true))
    }
    prevOnMeetingsPage.current = isOnMeetingsPage
  }, [hasActiveMeeting, isOnMeetingsPage])

  function handlePipClick() {
    if (!isOnMeetingsPage) {
      router.push(meetingsRoute)
    }
    setIsMinimized(false)
  }

  function handlePipEnd(e: React.MouseEvent) {
    e.stopPropagation()
    callbacksRef.current?.onEndMeeting()
  }

  function handlePipMute(e: React.MouseEvent) {
    e.stopPropagation()
    callbacksRef.current?.onToggleMute()
  }

  return (
    <MeetingContext.Provider
      value={{
        activeMeetingInfo,
        isMinimized,
        registerMeeting,
        unregisterMeeting,
        updateMeeting,
        setMinimized: setIsMinimized,
        hasActiveMeeting,
        setMeetingCallbacks,
        setMeetingMuted,
      }}
    >
      {children}

      {/* Floating PIP bar — shown when minimized */}
      {activeMeetingInfo && isMinimized && (
        <div
          className="fixed bottom-24 right-4 z-9998 cursor-pointer animate-in slide-in-from-bottom-4 fade-in duration-200"
          onClick={handlePipClick}
        >
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border border-border/50 bg-background">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
              <HugeiconsIcon icon={Video01Icon} size={18} className="text-emerald-500" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium text-foreground truncate max-w-35">
                {activeMeetingInfo.title}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
                <PipTimer startTime={activeMeetingInfo.startTime} />
              </div>
            </div>
            <div className="flex items-center gap-1.5 ml-2">
              <button
                onClick={handlePipMute}
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center transition-colors",
                  pipMuted
                    ? "bg-red-500/15 hover:bg-red-500/25"
                    : "bg-muted hover:bg-muted/80",
                )}
              >
                <HugeiconsIcon
                  icon={pipMuted ? MicOff01Icon : Mic01Icon}
                  size={16}
                  className={pipMuted ? "text-red-400" : "text-foreground"}
                />
              </button>
              <button
                onClick={handlePipEnd}
                className="w-9 h-9 rounded-full bg-red-500/85 hover:bg-red-500 flex items-center justify-center transition-colors"
              >
                <HugeiconsIcon icon={CallEnd01Icon} size={16} className="text-white" />
              </button>
            </div>
          </div>
        </div>
      )}
    </MeetingContext.Provider>
  )
}
