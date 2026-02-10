"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Image from "next/image"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Mic01Icon,
  MicOff01Icon,
  Video01Icon,
  VideoOffIcon,
  CallEnd01Icon,
  ComputerScreenShareIcon,
  CheckmarkCircle01Icon,
  Cancel01Icon,
  UserGroupIcon,
  Link01Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"
import { Topbar } from "@/components/platform/topbar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/ui/responsive-modal"
import { cn } from "@/lib/utils"
import { rtkClient } from "@/lib/rtk-client"
import { useUser } from "@/components/providers/user-provider"
import type { MeetingEventPayload } from "@/lib/call-events"
import {
  createMeeting,
  joinMeeting,
  getMyMeetings,
  getMeetingDetails,
  endMeeting as endMeetingAction,
  leaveMeeting,
  admitParticipant,
  declineParticipant,
  toggleHandRaise,
  sendReaction,
  type MeetingWithDetails,
  type MeetingParticipantDetails,
} from "@/lib/actions/meetings"

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */

const REACTION_EMOJIS = ["👏", "❤️", "😂", "🎉", "👍"]
const TILES_PER_PAGE = 4

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

/* ── Glass Button (meeting controls) ─────────────────────────── */
function GlassButton({
  onClick,
  children,
  variant = "default",
  active = false,
  label,
  disabled,
  className,
}: {
  onClick?: () => void
  children: React.ReactNode
  variant?: "default" | "danger" | "success"
  active?: boolean
  label?: string
  disabled?: boolean
  className?: string
}) {
  const bg = {
    default: active ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.12)",
    danger: "rgba(239,68,68,0.85)",
    success: "rgba(34,197,94,0.85)",
  }
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200",
          "hover:scale-105 active:scale-95 disabled:opacity-40 disabled:pointer-events-none",
          className,
        )}
        style={{
          background: bg[variant],
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        {children}
      </button>
      {label && (
        <span className="text-[10px] text-white/50 font-medium">{label}</span>
      )}
    </div>
  )
}

/* ── Meeting Timer ───────────────────────────────────────────── */
function MeetingTimer({ startTime }: { startTime: Date | null }) {
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
  return (
    <span className="tabular-nums text-sm font-medium text-white/70">
      {h > 0 && `${h}:`}
      {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  )
}

/* ── Participant Tile (glassmorphic) ─────────────────────────── */
function ParticipantTile({
  name,
  avatar,
  isMuted,
  isVideoOff,
  isLocal,
  isSpeaking,
  isScreenShare,
  handRaised,
  videoRef,
  className: cls,
}: {
  name: string
  avatar?: string | null
  isMuted?: boolean
  isVideoOff?: boolean
  isLocal?: boolean
  isSpeaking?: boolean
  isScreenShare?: boolean
  handRaised?: boolean
  videoRef?: React.RefObject<HTMLVideoElement | null>
  className?: string
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <div
      className={cn(
        "relative rounded-2xl overflow-hidden flex items-center justify-center transition-all duration-300",
        isSpeaking && "ring-2 ring-emerald-400/60 ring-offset-1 ring-offset-transparent",
        cls,
      )}
      style={{
        background: "rgba(30,30,35,0.7)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {!isVideoOff && videoRef ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={cn(
            "absolute inset-0 w-full h-full",
            isScreenShare ? "object-contain bg-black" : "object-cover",
          )}
        />
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Avatar className="w-16 h-16 ring-2 ring-white/10">
            {avatar && <AvatarImage src={avatar} alt={name} />}
            <AvatarFallback className="text-xl bg-white/10 text-white/80">
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>
      )}

      {handRaised && (
        <div className="absolute top-2 right-2 text-lg animate-bounce">✋</div>
      )}

      <div
        className="absolute bottom-0 left-0 right-0 px-3 py-2 flex items-center justify-between"
        style={{
          background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)",
        }}
      >
        <span className="text-xs font-medium text-white truncate">
          {isLocal ? "You" : name}
        </span>
        <div className="flex items-center gap-1">
          {isMuted && (
            <div className="w-5 h-5 rounded-full bg-red-500/80 flex items-center justify-center">
              <HugeiconsIcon icon={MicOff01Icon} size={10} className="text-white" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Audio player for remote participants ─────────────────────
   RTK/Dyte custom UI requires explicit audio element registration
   to hear other participants. Without this, only video renders. */
function RemoteAudioPlayer({
  participantId,
  audioEnabled,
}: {
  participantId: string
  audioEnabled: boolean
}) {
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const client = rtkClient.client
    if (!client || !audioRef.current) return

    const p = client.participants.joined.get(participantId)
    if (!p) return

    const el = audioRef.current

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const participant = p as any

    // Prefer SDK built-in registration (handles track changes automatically)
    if (typeof participant.registerAudioElement === "function") {
      participant.registerAudioElement(el)
      return
    }

    // Fallback: manually pipe the raw audio track into the element
    if (audioEnabled && participant.audioTrack) {
      el.srcObject = new MediaStream([participant.audioTrack])
      el.play().catch(() => {})
    } else {
      el.srcObject = null
    }
  }, [participantId, audioEnabled])

  return <audio ref={audioRef} autoPlay playsInline />
}

/* ── Remote Participant Tile ─────────────────────────────────── */
function RemoteParticipantTile({
  participantId,
  participant,
  handRaised,
  className,
}: {
  participantId: string
  participant: { name: string; audioEnabled: boolean; videoEnabled: boolean }
  handRaised?: boolean
  className?: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const client = rtkClient.client
    if (!client || !videoRef.current) return
    if (!participant.videoEnabled) return

    const p = client.participants.joined.get(participantId)
    if (p && videoRef.current) {
      p.registerVideoElement(videoRef.current)
    }
  }, [participantId, participant.videoEnabled])

  return (
    <ParticipantTile
      name={participant.name}
      isMuted={!participant.audioEnabled}
      isVideoOff={!participant.videoEnabled}
      handRaised={handRaised}
      videoRef={videoRef}
      className={className}
    />
  )
}

/* ── Screen Share View ───────────────────────────────────────── */
function ScreenShareView({
  participantId,
  participantName,
  isLocal,
}: {
  participantId: string
  participantName: string
  isLocal: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const client = rtkClient.client
    if (!client || !videoRef.current) return
    const el = videoRef.current

    function attachTrack() {
      if (!el || !client) return
      let tracks: { video?: MediaStreamTrack; audio?: MediaStreamTrack } | undefined
      if (isLocal) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tracks = (client.self as any).screenShareTracks
      } else {
        const p = client.participants.joined.get(participantId)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tracks = (p as any)?.screenShareTracks
      }
      if (tracks?.video) {
        const stream = new MediaStream([tracks.video])
        el.srcObject = stream
        el.play().catch(() => {})
      }
    }

    attachTrack()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (payload: any) => {
      if (payload?.screenShareEnabled ?? payload) requestAnimationFrame(attachTrack)
    }

    if (isLocal) {
      client.self.on("screenShareUpdate" as never, handler as never)
      return () => {
        client.self.removeListener("screenShareUpdate" as never, handler as never)
        if (el) el.srcObject = null
      }
    } else {
      const p = client.participants.joined.get(participantId)
      if (p) {
        p.on("screenShareUpdate" as never, handler as never)
        return () => {
          p.removeListener("screenShareUpdate" as never, handler as never)
          if (el) el.srcObject = null
        }
      }
      return () => {
        if (el) el.srcObject = null
      }
    }
  }, [participantId, isLocal])

  return (
    <div
      className="relative flex-1 rounded-2xl overflow-hidden flex items-center justify-center min-h-0"
      style={{
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-contain"
      />
      <div
        className="absolute bottom-0 left-0 right-0 px-4 py-2"
        style={{
          background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)",
        }}
      >
        <div className="flex items-center gap-2">
          <HugeiconsIcon
            icon={ComputerScreenShareIcon}
            size={14}
            className="text-emerald-400"
          />
          <span className="text-xs font-medium text-white">
            {isLocal
              ? "You are sharing your screen"
              : `${participantName}'s screen`}
          </span>
        </div>
      </div>
    </div>
  )
}

/* ── Floating Reaction ───────────────────────────────────────── */
function FloatingReaction({
  emoji,
  onDone,
}: {
  emoji: string
  onDone: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="animate-float-up text-3xl pointer-events-none select-none">
      {emoji}
    </div>
  )
}

/* ── Setup Overlay ───────────────────────────────────────────── */
function SetupOverlay({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/90 flex flex-col items-center justify-center gap-5">
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center"
        style={{
          background: "rgba(255,255,255,0.06)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <HugeiconsIcon
          icon={Loading03Icon}
          size={32}
          className="text-white/70 animate-spin"
        />
      </div>
      <p className="text-white/70 text-sm font-medium">{message}</p>
    </div>
  )
}

/* ── Waiting Room ────────────────────────────────────────────── */
function WaitingRoom({
  meetingTitle,
  onCancel,
}: {
  meetingTitle: string
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col items-center justify-center">
      <div className="absolute inset-0 bg-linear-to-br from-zinc-900 via-zinc-950 to-black" />
      <div className="relative z-10 flex flex-col items-center gap-8">
        <div className="relative">
          <div className="absolute inset-0 w-28 h-28 rounded-full bg-emerald-500/10 animate-ping" />
          <div
            className="w-28 h-28 rounded-full flex items-center justify-center"
            style={{
              background: "rgba(255,255,255,0.06)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <HugeiconsIcon
              icon={Loading03Icon}
              size={36}
              className="text-white/50 animate-spin"
            />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-white text-xl font-semibold">{meetingTitle}</h2>
          <p className="text-white/40 text-sm">
            Waiting for the host to let you in…
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          className="border-white/10 text-white/60 hover:text-white hover:border-white/20 bg-white/5"
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════ */

type ScreenSharer = { id: string; name: string; isLocal: boolean }
type ReactionItem = { id: string; emoji: string; left: number }

export default function MeetingsPage() {
  const user = useUser()
  const searchParams = useSearchParams()
  const router = useRouter()

  /* ── Lobby state ── */
  const [meetings, setMeetings] = useState<MeetingWithDetails[]>([])
  const [isLoadingMeetings, setIsLoadingMeetings] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  /* ── Active meeting state ── */
  const [activeMeeting, setActiveMeeting] = useState<MeetingWithDetails | null>(
    null,
  )
  const [isMuted, setIsMuted] = useState(false) // audio ON by default
  const [isVideoOff, setIsVideoOff] = useState(true)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [meetingStartTime, setMeetingStartTime] = useState<Date | null>(null)
  const [showPanel, setShowPanel] = useState(false)
  const [admittedParticipants, setAdmittedParticipants] = useState<
    MeetingParticipantDetails[]
  >([])
  const [pendingRequests, setPendingRequests] = useState<
    MeetingParticipantDetails[]
  >([])
  const [remoteParticipants, setRemoteParticipants] = useState<
    Map<string, { name: string; audioEnabled: boolean; videoEnabled: boolean }>
  >(new Map())
  const [isJoined, setIsJoined] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [screenSharer, setScreenSharer] = useState<ScreenSharer | null>(null)

  /* ── Hand-raise & reactions ── */
  const [raisedHands, setRaisedHands] = useState<Set<string>>(new Set())
  const [myHandRaised, setMyHandRaised] = useState(false)
  const [reactions, setReactions] = useState<ReactionItem[]>([])
  const [showReactionPicker, setShowReactionPicker] = useState(false)

  /* ── Grid carousel ── */
  const [gridPage, setGridPage] = useState(0)

  /* ── Setup / waiting state ── */
  const [setupMessage, setSetupMessage] = useState<string | null>(null)
  const [waitingForApproval, setWaitingForApproval] = useState<string | null>(
    null,
  )

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const isHost = activeMeeting?.hostId === user.id

  // Refs for stable callback access
  const waitingRef = useRef(waitingForApproval)
  waitingRef.current = waitingForApproval
  const activeMeetingRef = useRef(activeMeeting)
  activeMeetingRef.current = activeMeeting
  const joinRTKRef = useRef<
    (
      authToken: string,
      meetingId?: string,
      meetingTitle?: string,
    ) => Promise<void>
  >(async () => {})

  /* ═══════════════════════════════════════════════════════════
     EFFECTS
     ═══════════════════════════════════════════════════════════ */

  /* ── Load meetings on mount ── */
  useEffect(() => {
    let cancelled = false
    getMyMeetings().then((r) => {
      if (cancelled) return
      if (r.success && r.meetings) setMeetings(r.meetings)
      setIsLoadingMeetings(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  /* ── Handle ?join=<id> URL param ── */
  useEffect(() => {
    const joinId = searchParams.get("join")
    if (!joinId) return
    router.replace("/dashboard/meetings", { scroll: false })
    handleJoinByLink(joinId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  /* ── Register local video element when meeting view mounts ── */
  useEffect(() => {
    if (!isJoined) return
    const client = rtkClient.client
    if (!client) return

    const raf = requestAnimationFrame(() => {
      if (localVideoRef.current) {
        client.self.registerVideoElement(localVideoRef.current, true)
      }
    })
    return () => cancelAnimationFrame(raf)
  }, [isJoined, isVideoOff])

  /* ── Auto-reset grid page when participant count changes ── */
  useEffect(() => {
    const total = remoteParticipants.size + 1
    const maxPage = Math.max(0, Math.ceil(total / TILES_PER_PAGE) - 1)
    setGridPage((prev) => Math.min(prev, maxPage))
  }, [remoteParticipants.size])

  /* ── SSE listener for meeting events ── */
  useEffect(() => {
    function handleSSE(evt: Event) {
      const e = (evt as CustomEvent).detail as MeetingEventPayload & {
        type: string
      }
      if (!e?.type?.startsWith("meeting:")) return

      switch (e.type) {
        case "meeting:join-request":
          setPendingRequests((prev) => {
            if (prev.some((r) => r.userId === e.userId)) return prev
            return [
              ...prev,
              {
                userId: e.userId,
                name: e.userName,
                avatar: e.userAvatar,
                role: "participant" as const,
                status: "pending" as const,
              },
            ]
          })
          break

        case "meeting:admitted":
          if (e.authToken && waitingRef.current) {
            setWaitingForApproval(null)
            setSetupMessage("Joining meeting...")
            joinRTKRef.current(e.authToken, e.meetingId, e.meetingTitle)
          }
          break

        case "meeting:declined":
          setWaitingForApproval(null)
          break

        case "meeting:ended":
          if (activeMeetingRef.current) handleForceLeave()
          break

        case "meeting:hand-raised":
          setRaisedHands((prev) => new Set(prev).add(e.userId))
          break

        case "meeting:hand-lowered":
          setRaisedHands((prev) => {
            const next = new Set(prev)
            next.delete(e.userId)
            return next
          })
          break

        case "meeting:reaction":
          if (e.emoji) {
            const id = `${Date.now()}-${Math.random()}`
            const left = 10 + Math.random() * 80
            setReactions((prev) => [...prev, { id, emoji: e.emoji!, left }])
          }
          break
      }
    }

    window.addEventListener("sse:event", handleSSE)
    return () => window.removeEventListener("sse:event", handleSSE)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  /* ── RTK event listeners ── */
  useEffect(() => {
    if (!isJoined) return
    const client = rtkClient.client
    if (!client) return

    // ────── Populate existing participants on join ──────
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const joined = client.participants.joined as any
      const existing: Array<{
        id: string
        name: string
        audioEnabled: boolean
        videoEnabled: boolean
        screenShareEnabled?: boolean
      }> = []
      if (typeof joined.toArray === "function") {
        existing.push(...joined.toArray())
      } else if (typeof joined.forEach === "function") {
        joined.forEach((p: (typeof existing)[0]) => existing.push(p))
      } else if (typeof joined[Symbol.iterator] === "function") {
        for (const p of joined) existing.push(p)
      }

      if (existing.length > 0) {
        const map = new Map<
          string,
          { name: string; audioEnabled: boolean; videoEnabled: boolean }
        >()
        for (const p of existing) {
          map.set(p.id, {
            name: p.name,
            audioEnabled: p.audioEnabled,
            videoEnabled: p.videoEnabled,
          })
          if (p.screenShareEnabled) {
            setScreenSharer({ id: p.id, name: p.name, isLocal: false })
          }
        }
        setRemoteParticipants(map)
      }
    } catch (err) {
      console.warn("[Meeting] Error populating existing participants:", err)
    }

    // ────── Event handlers ──────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleParticipantJoined = (p: any) => {
      setRemoteParticipants((prev) => {
        const next = new Map(prev)
        next.set(p.id, {
          name: p.name,
          audioEnabled: p.audioEnabled,
          videoEnabled: p.videoEnabled,
        })
        return next
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleParticipantLeft = (p: any) => {
      setRemoteParticipants((prev) => {
        const next = new Map(prev)
        next.delete(p.id)
        return next
      })
      setScreenSharer((prev) => (prev?.id === p.id ? null : prev))
    }

    // Audio / video update: read directly from participant object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleAudioUpdate = (p: any) => {
      const audioEnabled = p.audioEnabled ?? true
      setRemoteParticipants((prev) => {
        const existing = prev.get(p.id)
        if (!existing) {
          return new Map(prev).set(p.id, {
            name: p.name || "Participant",
            audioEnabled,
            videoEnabled: false,
          })
        }
        const next = new Map(prev)
        next.set(p.id, { ...existing, audioEnabled })
        return next
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleVideoUpdate = (p: any) => {
      const videoEnabled = p.videoEnabled ?? true
      setRemoteParticipants((prev) => {
        const existing = prev.get(p.id)
        if (!existing) {
          return new Map(prev).set(p.id, {
            name: p.name || "Participant",
            audioEnabled: false,
            videoEnabled,
          })
        }
        const next = new Map(prev)
        next.set(p.id, { ...existing, videoEnabled })
        return next
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleScreenShareUpdate = (p: any) => {
      if (p.screenShareEnabled) {
        setScreenSharer({ id: p.id, name: p.name, isLocal: false })
      } else {
        setScreenSharer((prev) => (prev?.id === p.id ? null : prev))
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleSelfScreenShareUpdate = (payload: any) => {
      if (payload.screenShareEnabled) {
        setIsScreenSharing(true)
        setScreenSharer({
          id: client.self.id,
          name: `${user.firstName} ${user.lastName}`,
          isLocal: true,
        })
      } else {
        setIsScreenSharing(false)
        setScreenSharer((prev) => (prev?.isLocal ? null : prev))
      }
    }

    rtkClient.on(
      "participantJoined",
      "participants",
      handleParticipantJoined,
    )
    rtkClient.on("participantLeft", "participants", handleParticipantLeft)
    rtkClient.on("audioUpdate", "participants", handleAudioUpdate)
    rtkClient.on("videoUpdate", "participants", handleVideoUpdate)
    rtkClient.on(
      "screenShareUpdate",
      "participants",
      handleScreenShareUpdate,
    )
    rtkClient.on("screenShareUpdate", "self", handleSelfScreenShareUpdate)

    return () => {
      rtkClient.off(
        "participantJoined",
        "participants",
        handleParticipantJoined,
      )
      rtkClient.off("participantLeft", "participants", handleParticipantLeft)
      rtkClient.off("audioUpdate", "participants", handleAudioUpdate)
      rtkClient.off("videoUpdate", "participants", handleVideoUpdate)
      rtkClient.off(
        "screenShareUpdate",
        "participants",
        handleScreenShareUpdate,
      )
      rtkClient.off("screenShareUpdate", "self", handleSelfScreenShareUpdate)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isJoined])

  /* ═══════════════════════════════════════════════════════════
     HANDLERS
     ═══════════════════════════════════════════════════════════ */

  const joinRTKAndSetup = useCallback(
    async (
      authToken: string,
      meetingId?: string,
      meetingTitle?: string,
    ) => {
      try {
        // Enable audio by default so WebRTC audio pipeline is fully established
        await rtkClient.init(authToken, { audio: true, video: false })
        await rtkClient.joinRoom()
        setIsJoined(true)
        setSetupMessage(null)

        if (!activeMeetingRef.current && meetingId) {
          const details = await getMeetingDetails(meetingId)
          if (details.success && details.meeting) {
            setActiveMeeting(details.meeting)
            setMeetingStartTime(
              details.meeting.startedAt
                ? new Date(details.meeting.startedAt)
                : new Date(),
            )
            if (details.participants) {
              setAdmittedParticipants(
                details.participants.filter((p) => p.status === "admitted"),
              )
            }
          } else {
            setActiveMeeting({
              id: meetingId,
              title: meetingTitle || "Meeting",
              hostId: "",
              hostName: "",
              hostAvatar: null,
              status: "active",
              meetingId,
              participantCount: 1,
              maxParticipants: 50,
              settings: {
                allowScreenShare: true,
                muteOnEntry: true,
                requireApproval: true,
                maxParticipants: 50,
              },
              createdAt: new Date().toISOString(),
            })
            setMeetingStartTime(new Date())
          }
        }
      } catch (err) {
        console.error("[Meeting] Failed to join RTK room:", err)
        setSetupMessage(null)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useEffect(() => {
    joinRTKRef.current = joinRTKAndSetup
  }, [joinRTKAndSetup])

  async function handleCreate() {
    if (!newTitle.trim()) return
    setIsCreating(true)
    setShowCreate(false)
    setSetupMessage("Setting up your meeting...")

    const result = await createMeeting(newTitle.trim())
    if (result.success && result.meeting && result.authToken) {
      setNewTitle("")
      setActiveMeeting(result.meeting)
      setMeetingStartTime(new Date())
      await joinRTKAndSetup(result.authToken)
    } else {
      setSetupMessage(null)
    }
    setIsCreating(false)
  }

  async function handleJoinByLink(meetingId: string) {
    setSetupMessage("Joining meeting...")
    const result = await joinMeeting(meetingId)
    if (result.success) {
      if (result.requiresApproval) {
        setSetupMessage(null)
        setWaitingForApproval(result.meeting?.title || "Meeting")
        return
      }
      if (result.authToken && result.meeting) {
        setActiveMeeting(result.meeting)
        setMeetingStartTime(
          result.meeting.startedAt
            ? new Date(result.meeting.startedAt)
            : new Date(),
        )
        await joinRTKAndSetup(result.authToken)
      }
    } else {
      setSetupMessage(null)
      console.error("[Meeting] Join failed:", result.error)
    }
  }

  async function handleRejoin(meeting: MeetingWithDetails) {
    setSetupMessage("Connecting...")
    const result = await joinMeeting(meeting.id)
    if (result.success) {
      if (result.requiresApproval) {
        setSetupMessage(null)
        setWaitingForApproval(result.meeting?.title || meeting.title)
        return
      }
      if (result.authToken && result.meeting) {
        setActiveMeeting(result.meeting)
        setMeetingStartTime(
          result.meeting.startedAt
            ? new Date(result.meeting.startedAt)
            : new Date(),
        )
        await joinRTKAndSetup(result.authToken)
        const details = await getMeetingDetails(meeting.id)
        if (details.success && details.participants) {
          setAdmittedParticipants(
            details.participants.filter((p) => p.status === "admitted"),
          )
        }
      }
    } else {
      setSetupMessage(null)
      console.error("[Meeting] Rejoin failed:", result.error)
    }
  }

  function handleForceLeave() {
    rtkClient.leaveRoom().catch(() => {})
    setActiveMeeting(null)
    setIsJoined(false)
    setRemoteParticipants(new Map())
    setIsMuted(false)
    setIsVideoOff(true)
    setIsScreenSharing(false)
    setScreenSharer(null)
    setPendingRequests([])
    setAdmittedParticipants([])
    setSetupMessage(null)
    setRaisedHands(new Set())
    setMyHandRaised(false)
    setReactions([])
    setGridPage(0)
    getMyMeetings().then((r) => {
      if (r.success && r.meetings) setMeetings(r.meetings)
    })
  }

  /* ── Media controls ── */
  async function toggleMute() {
    const next = !isMuted
    setIsMuted(next)
    try {
      if (next) await rtkClient.client?.self.disableAudio()
      else await rtkClient.client?.self.enableAudio()
    } catch (e) {
      console.error("Toggle mute:", e)
    }
  }

  async function toggleVideo() {
    const next = !isVideoOff
    setIsVideoOff(next)
    try {
      if (next) {
        await rtkClient.client?.self.disableVideo()
      } else {
        await rtkClient.client?.self.enableVideo()
        requestAnimationFrame(() => {
          if (localVideoRef.current) {
            rtkClient.client?.self.registerVideoElement(
              localVideoRef.current,
              true,
            )
          }
        })
      }
    } catch (e) {
      console.error("Toggle video:", e)
    }
  }

  async function toggleScreenShare() {
    try {
      if (isScreenSharing) {
        await rtkClient.client?.self.disableScreenShare()
      } else {
        await rtkClient.client?.self.enableScreenShare()
      }
    } catch (e) {
      console.error("Screen share:", e)
    }
  }

  async function handleEndMeeting() {
    if (!activeMeeting) return
    try {
      if (isHost) await endMeetingAction(activeMeeting.id)
      else await leaveMeeting(activeMeeting.id)
    } catch {
      /* noop */
    }
    handleForceLeave()
  }

  async function handleAdmit(userId: string) {
    if (!activeMeeting) return
    await admitParticipant(activeMeeting.id, userId)
    setPendingRequests((prev) => prev.filter((r) => r.userId !== userId))
  }

  async function handleDecline(userId: string) {
    if (!activeMeeting) return
    await declineParticipant(activeMeeting.id, userId)
    setPendingRequests((prev) => prev.filter((r) => r.userId !== userId))
  }

  async function handleToggleHand() {
    if (!activeMeeting) return
    const next = !myHandRaised
    setMyHandRaised(next)
    await toggleHandRaise(activeMeeting.id, next)
  }

  async function handleReaction(emoji: string) {
    if (!activeMeeting) return
    setShowReactionPicker(false)
    const id = `${Date.now()}-${Math.random()}`
    const left = 10 + Math.random() * 80
    setReactions((prev) => [...prev, { id, emoji, left }])
    await sendReaction(activeMeeting.id, emoji)
  }

  function removeReaction(id: string) {
    setReactions((prev) => prev.filter((r) => r.id !== id))
  }

  function copyMeetingLink() {
    if (!activeMeeting) return
    const link = `${window.location.origin}/dashboard/meetings?join=${activeMeeting.id}`
    navigator.clipboard.writeText(link)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  /* ═══════════════════════════════════════════════════════════
     RENDER: LOADING / WAITING
     ═══════════════════════════════════════════════════════════ */

  if (setupMessage) return <SetupOverlay message={setupMessage} />
  if (waitingForApproval) {
    return (
      <WaitingRoom
        meetingTitle={waitingForApproval}
        onCancel={() => setWaitingForApproval(null)}
      />
    )
  }

  /* ═══════════════════════════════════════════════════════════
     RENDER: ACTIVE MEETING
     ═══════════════════════════════════════════════════════════ */

  if (activeMeeting && isJoined) {
    const totalParticipants = remoteParticipants.size + 1
    const hasScreenShare = !!screenSharer

    // Build all grid entries: self + all remote participants
    const allGridEntries: Array<{ id: string; isLocal: boolean }> = [
      { id: "local", isLocal: true },
      ...Array.from(remoteParticipants.keys()).map((id) => ({
        id,
        isLocal: false,
      })),
    ]

    // Carousel pagination
    const totalPages = Math.ceil(allGridEntries.length / TILES_PER_PAGE)
    const currentPage = Math.min(gridPage, Math.max(0, totalPages - 1))
    const pageEntries = allGridEntries.slice(
      currentPage * TILES_PER_PAGE,
      (currentPage + 1) * TILES_PER_PAGE,
    )

    const gridCols = hasScreenShare
      ? ""
      : pageEntries.length <= 1
        ? "grid-cols-1"
        : "grid-cols-2"

    return (
      <div className="flex flex-col h-dvh bg-zinc-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-br from-zinc-900 via-zinc-950 to-black" />

        {/* ── Hidden audio players for every remote participant ── */}
        {Array.from(remoteParticipants.entries()).map(([id, p]) => (
          <RemoteAudioPlayer
            key={`audio-${id}`}
            participantId={id}
            audioEnabled={p.audioEnabled}
          />
        ))}

        {/* ── Floating reactions ── */}
        <div className="fixed bottom-28 left-0 right-0 z-30 pointer-events-none flex flex-col items-center">
          {reactions.map((r) => (
            <div
              key={r.id}
              className="absolute"
              style={{ left: `${r.left}%`, bottom: 0 }}
            >
              <FloatingReaction
                emoji={r.emoji}
                onDone={() => removeReaction(r.id)}
              />
            </div>
          ))}
        </div>

        {/* ── Pending request banner (minimal, inline) ── */}
        {isHost && pendingRequests.length > 0 && (
          <div
            className="relative z-20 mx-4 mt-1 flex items-center gap-3 px-4 py-2 rounded-xl"
            style={{
              background: "rgba(245,158,11,0.12)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(245,158,11,0.2)",
            }}
          >
            <span className="text-xs text-amber-300/80 font-medium shrink-0">
              {pendingRequests.length} waiting
            </span>
            <div className="flex-1 flex items-center gap-2 overflow-x-auto">
              {pendingRequests.map((req) => (
                <div
                  key={req.userId}
                  className="flex items-center gap-2 shrink-0"
                >
                  <span className="text-xs text-white/70 truncate max-w-24">
                    {req.name}
                  </span>
                  <button
                    onClick={() => handleAdmit(req.userId)}
                    className="w-6 h-6 rounded-full bg-emerald-500/20 hover:bg-emerald-500/40 flex items-center justify-center transition-colors"
                    title="Admit"
                  >
                    <HugeiconsIcon
                      icon={CheckmarkCircle01Icon}
                      size={12}
                      className="text-emerald-400"
                    />
                  </button>
                  <button
                    onClick={() => handleDecline(req.userId)}
                    className="w-6 h-6 rounded-full bg-red-500/20 hover:bg-red-500/40 flex items-center justify-center transition-colors"
                    title="Decline"
                  >
                    <HugeiconsIcon
                      icon={Cancel01Icon}
                      size={12}
                      className="text-red-400"
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Top bar ── */}
        <div
          className="relative z-10 flex items-center justify-between px-4 md:px-6 py-3"
          style={{
            background: "rgba(0,0,0,0.3)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
          }}
        >
          <div className="flex flex-col">
            <h2 className="text-white font-semibold text-sm truncate max-w-50">
              {activeMeeting.title}
            </h2>
            <div className="flex items-center gap-2">
              <MeetingTimer startTime={meetingStartTime} />
              <span className="text-white/40 text-xs">&middot;</span>
              <span className="text-white/50 text-xs">
                {totalParticipants} in meeting
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyMeetingLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white/70 hover:text-white transition-colors"
              style={{
                background: "rgba(255,255,255,0.08)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <HugeiconsIcon
                icon={copiedLink ? CheckmarkCircle01Icon : Link01Icon}
                size={12}
              />
              {copiedLink ? "Copied!" : "Invite"}
            </button>
            <button
              onClick={() => setShowPanel(!showPanel)}
              className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white/70 hover:text-white transition-colors"
              style={{
                background: "rgba(255,255,255,0.08)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <HugeiconsIcon icon={UserGroupIcon} size={14} />
              {(pendingRequests.length > 0 || raisedHands.size > 0) && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-[10px] flex items-center justify-center text-white font-bold">
                  {pendingRequests.length + raisedHands.size}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── People side-panel ── */}
        {showPanel && (
          <div
            className="absolute top-14 right-4 z-20 w-72 max-h-[calc(100dvh-120px)] rounded-2xl p-3 overflow-y-auto animate-in slide-in-from-right-4 fade-in duration-200"
            style={{
              background: "rgba(20,20,25,0.9)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white text-sm font-semibold">People</h3>
              <button onClick={() => setShowPanel(false)}>
                <HugeiconsIcon
                  icon={Cancel01Icon}
                  size={16}
                  className="text-white/40 hover:text-white/70 transition-colors"
                />
              </button>
            </div>

            {/* Raised Hands */}
            {raisedHands.size > 0 && (
              <div className="mb-3">
                <p className="text-[10px] uppercase tracking-wider text-amber-400/80 font-semibold mb-1.5">
                  ✋ Raised hands ({raisedHands.size})
                </p>
                <div className="space-y-1">
                  {Array.from(raisedHands).map((uid) => {
                    const rp = Array.from(remoteParticipants.entries()).find(
                      ([id]) => id === uid,
                    )
                    const name =
                      rp
                        ? rp[1].name
                        : admittedParticipants.find(
                            (ap) => ap.userId === uid,
                          )?.name || "Participant"
                    return (
                      <div
                        key={uid}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                        style={{ background: "rgba(245,158,11,0.1)" }}
                      >
                        <span className="text-sm">✋</span>
                        <span className="text-xs text-white/80 flex-1 truncate">
                          {name}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Pending requests — host only */}
            {isHost && pendingRequests.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] uppercase tracking-wider text-amber-400/80 font-semibold mb-1.5">
                  Waiting ({pendingRequests.length})
                </p>
                <div className="space-y-1.5">
                  {pendingRequests.map((req) => {
                    const initials = req.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)
                    return (
                      <div
                        key={req.userId}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                        style={{ background: "rgba(255,255,255,0.05)" }}
                      >
                        <Avatar className="w-6 h-6">
                          {req.avatar && (
                            <AvatarImage src={req.avatar} alt={req.name} />
                          )}
                          <AvatarFallback className="text-[8px] bg-white/10 text-white/70">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-white/70 flex-1 truncate">
                          {req.name}
                        </span>
                        <button
                          onClick={() => handleAdmit(req.userId)}
                          className="w-6 h-6 rounded-full bg-emerald-500/20 hover:bg-emerald-500/40 flex items-center justify-center transition-colors"
                        >
                          <HugeiconsIcon
                            icon={CheckmarkCircle01Icon}
                            size={12}
                            className="text-emerald-400"
                          />
                        </button>
                        <button
                          onClick={() => handleDecline(req.userId)}
                          className="w-6 h-6 rounded-full bg-red-500/20 hover:bg-red-500/40 flex items-center justify-center transition-colors"
                        >
                          <HugeiconsIcon
                            icon={Cancel01Icon}
                            size={12}
                            className="text-red-400"
                          />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* All participants */}
            <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1.5">
              In meeting ({totalParticipants})
            </p>
            <div className="space-y-1">
              {/* Self */}
              <div
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                <Avatar className="w-6 h-6">
                  {user.avatarUrl && (
                    <AvatarImage src={user.avatarUrl} alt="You" />
                  )}
                  <AvatarFallback className="text-[8px] bg-white/10 text-white/70">
                    {(user.firstName?.[0] || "") + (user.lastName?.[0] || "")}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-white/70 flex-1 truncate">
                  {user.firstName} {user.lastName} (You)
                </span>
                {isHost && (
                  <Badge
                    variant="outline"
                    className="text-[8px] px-1.5 py-0 border-white/10 text-white/40"
                  >
                    Host
                  </Badge>
                )}
              </div>
              {/* Remote participants */}
              {Array.from(remoteParticipants.entries()).map(([id, p]) => (
                <div
                  key={id}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.05)" }}
                >
                  <Avatar className="w-6 h-6">
                    <AvatarFallback className="text-[8px] bg-white/10 text-white/70">
                      {p.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-white/70 flex-1 truncate">
                    {p.name}
                  </span>
                  {raisedHands.has(id) && <span className="text-xs">✋</span>}
                </div>
              ))}
              {/* Admitted but offline */}
              {admittedParticipants
                .filter(
                  (p) =>
                    p.userId !== user.id &&
                    !Array.from(remoteParticipants.values()).some(
                      (rp) => rp.name === p.name,
                    ),
                )
                .map((p) => (
                  <div
                    key={p.userId}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg opacity-50"
                    style={{ background: "rgba(255,255,255,0.03)" }}
                  >
                    <Avatar className="w-6 h-6">
                      {p.avatar && (
                        <AvatarImage src={p.avatar} alt={p.name} />
                      )}
                      <AvatarFallback className="text-[8px] bg-white/10 text-white/70">
                        {p.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-white/50 flex-1 truncate">
                      {p.name}
                    </span>
                    <span className="text-[10px] text-white/30">offline</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ── Video area ── */}
        <div className="relative z-10 flex-1 p-3 md:p-4 overflow-hidden flex flex-col gap-2">
          {hasScreenShare ? (
            /* ── Screen-share layout: large share + thumbnail strip ── */
            <>
              <ScreenShareView
                participantId={screenSharer.id}
                participantName={screenSharer.name}
                isLocal={screenSharer.isLocal}
              />
              <div className="flex gap-2 overflow-x-auto pb-1 shrink-0">
                <div className="w-32 h-24 shrink-0">
                  <ParticipantTile
                    name={`${user.firstName} ${user.lastName}`}
                    avatar={user.avatarUrl}
                    isMuted={isMuted}
                    isVideoOff={isVideoOff}
                    isLocal
                    handRaised={myHandRaised}
                    videoRef={localVideoRef}
                    className="w-full h-full"
                  />
                </div>
                {Array.from(remoteParticipants.entries()).map(([id, p]) => (
                  <div key={id} className="w-32 h-24 shrink-0">
                    <RemoteParticipantTile
                      participantId={id}
                      participant={p}
                      handRaised={raisedHands.has(id)}
                      className="w-full h-full"
                    />
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* ── Normal grid layout with carousel pagination ── */
            <div className="relative flex-1 flex flex-col gap-2">
              <div
                className={cn(
                  "grid gap-2 md:gap-3 flex-1 auto-rows-fr",
                  gridCols,
                )}
              >
                {pageEntries.map((entry) =>
                  entry.isLocal ? (
                    <ParticipantTile
                      key="local"
                      name={`${user.firstName} ${user.lastName}`}
                      avatar={user.avatarUrl}
                      isMuted={isMuted}
                      isVideoOff={isVideoOff}
                      isLocal
                      handRaised={myHandRaised}
                      videoRef={localVideoRef}
                    />
                  ) : (
                    <RemoteParticipantTile
                      key={entry.id}
                      participantId={entry.id}
                      participant={remoteParticipants.get(entry.id)!}
                      handRaised={raisedHands.has(entry.id)}
                    />
                  ),
                )}
              </div>

              {/* Carousel navigation (appears when > 4 participants) */}
              {totalPages > 1 && (
                <>
                  {/* Prev / Next arrows */}
                  <div className="absolute top-1/2 -translate-y-1/2 left-1 right-1 flex justify-between pointer-events-none z-10">
                    <button
                      onClick={() =>
                        setGridPage((p) => Math.max(0, p - 1))
                      }
                      className={cn(
                        "pointer-events-auto w-9 h-9 rounded-full flex items-center justify-center transition-all",
                        currentPage <= 0
                          ? "opacity-0 pointer-events-none"
                          : "opacity-80 hover:opacity-100 hover:scale-110",
                      )}
                      style={{
                        background: "rgba(0,0,0,0.5)",
                        backdropFilter: "blur(8px)",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      <span className="text-white text-lg font-bold leading-none">
                        ‹
                      </span>
                    </button>
                    <button
                      onClick={() =>
                        setGridPage((p) =>
                          Math.min(totalPages - 1, p + 1),
                        )
                      }
                      className={cn(
                        "pointer-events-auto w-9 h-9 rounded-full flex items-center justify-center transition-all",
                        currentPage >= totalPages - 1
                          ? "opacity-0 pointer-events-none"
                          : "opacity-80 hover:opacity-100 hover:scale-110",
                      )}
                      style={{
                        background: "rgba(0,0,0,0.5)",
                        backdropFilter: "blur(8px)",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      <span className="text-white text-lg font-bold leading-none">
                        ›
                      </span>
                    </button>
                  </div>

                  {/* Dot indicators */}
                  <div className="flex gap-1.5 justify-center py-1">
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setGridPage(i)}
                        className={cn(
                          "h-1.5 rounded-full transition-all duration-200",
                          i === currentPage
                            ? "bg-white w-4"
                            : "bg-white/30 hover:bg-white/50 w-1.5",
                        )}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Bottom controls ── */}
        <div
          className="relative z-10 flex items-center justify-center gap-3 md:gap-4 px-4 py-4 md:py-5"
          style={{
            background: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderTop: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          {/* Mic */}
          <GlassButton
            onClick={toggleMute}
            active={isMuted}
            label={isMuted ? "Unmute" : "Mute"}
          >
            <HugeiconsIcon
              icon={isMuted ? MicOff01Icon : Mic01Icon}
              size={18}
              className={isMuted ? "text-black" : "text-white"}
            />
          </GlassButton>

          {/* Video */}
          <GlassButton
            onClick={toggleVideo}
            active={isVideoOff}
            label={isVideoOff ? "Start Video" : "Stop Video"}
          >
            <HugeiconsIcon
              icon={isVideoOff ? VideoOffIcon : Video01Icon}
              size={18}
              className={isVideoOff ? "text-black" : "text-white"}
            />
          </GlassButton>

          {/* Screen share — available for everyone */}
          <GlassButton
            onClick={toggleScreenShare}
            active={isScreenSharing}
            label="Share"
          >
            <HugeiconsIcon
              icon={ComputerScreenShareIcon}
              size={18}
              className={isScreenSharing ? "text-black" : "text-white"}
            />
          </GlassButton>

          {/* Raise hand */}
          <GlassButton
            onClick={handleToggleHand}
            active={myHandRaised}
            label={myHandRaised ? "Lower" : "Raise"}
          >
            <span
              className={cn("text-lg", myHandRaised && "animate-bounce")}
            >
              ✋
            </span>
          </GlassButton>

          {/* Reactions */}
          <div className="relative">
            <GlassButton
              onClick={() => setShowReactionPicker(!showReactionPicker)}
              label="React"
            >
              <span className="text-lg">😊</span>
            </GlassButton>
            {showReactionPicker && (
              <div
                className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-1 px-2 py-1.5 rounded-full animate-in fade-in zoom-in-95 duration-150"
                style={{
                  background: "rgba(30,30,35,0.95)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                {REACTION_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleReaction(emoji)}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-xl hover:bg-white/10 transition-colors hover:scale-110 active:scale-95"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* People */}
          <GlassButton
            onClick={() => setShowPanel(!showPanel)}
            label="People"
            className="relative"
          >
            <HugeiconsIcon
              icon={UserGroupIcon}
              size={18}
              className="text-white"
            />
            {(pendingRequests.length > 0 || raisedHands.size > 0) && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-500 text-[10px] flex items-center justify-center text-white font-bold">
                {pendingRequests.length + raisedHands.size}
              </span>
            )}
          </GlassButton>

          {/* End / Leave */}
          <GlassButton
            variant="danger"
            onClick={handleEndMeeting}
            label={isHost ? "End" : "Leave"}
          >
            <HugeiconsIcon
              icon={CallEnd01Icon}
              size={20}
              className="text-white"
            />
          </GlassButton>
        </div>
      </div>
    )
  }

  /* ═══════════════════════════════════════════════════════════
     RENDER: LOBBY (theme-aware, light + dark mode)
     ═══════════════════════════════════════════════════════════ */

  return (
    <>
      <Topbar title="Meetings" />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
          {/* ── Hero ── */}
          <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-primary/10 via-primary/5 to-transparent border p-6">
            <div className="absolute -right-8 -top-8 w-40 h-40 bg-primary/5 rounded-full blur-2xl" />
            <div className="absolute -left-4 bottom-0 w-24 h-24 bg-primary/3 rounded-full blur-xl" />
            <div className="relative flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold">Meetings</h1>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Host or join video meetings with screen sharing
                </p>
              </div>
              <Button
                onClick={() => setShowCreate(true)}
                size="sm"
                className="gap-1.5 shrink-0"
              >
                <HugeiconsIcon icon={Add01Icon} size={16} />
                New Meeting
              </Button>
            </div>
          </div>

          {/* ── Meetings list ── */}
          {isLoadingMeetings ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-20 rounded-xl bg-muted animate-pulse"
                />
              ))}
            </div>
          ) : meetings.length === 0 ? (
            <div className="text-center py-12">
              <div className="relative w-48 h-48 mx-auto mb-4">
                <Image
                  src="/user/dashboard/no-meeting-yet.png"
                  alt="No meetings yet"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <h3 className="font-semibold text-lg mb-1">No meetings yet</h3>
              <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto leading-relaxed">
                Create a meeting to start a video call with screen sharing and
                invite others.
              </p>
              <Button
                onClick={() => setShowCreate(true)}
                size="sm"
                className="gap-1.5"
              >
                <HugeiconsIcon icon={Add01Icon} size={16} />
                Create Meeting
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {meetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-accent/50 transition-colors cursor-pointer group"
                  onClick={() => handleRejoin(meeting)}
                >
                  <div
                    className={cn(
                      "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                      meeting.status === "active"
                        ? "bg-emerald-500/12 group-hover:bg-emerald-500/20"
                        : "bg-primary/8 group-hover:bg-primary/12",
                    )}
                  >
                    <HugeiconsIcon
                      icon={Video01Icon}
                      size={20}
                      className={
                        meeting.status === "active"
                          ? "text-emerald-500"
                          : "text-primary/60"
                      }
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">
                      {meeting.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {meeting.hostId === user.id
                          ? "Hosted by you"
                          : `Hosted by ${meeting.hostName}`}
                      </span>
                      <span className="text-muted-foreground/40 text-xs">
                        &middot;
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <HugeiconsIcon icon={UserGroupIcon} size={11} />
                        {meeting.participantCount}
                      </span>
                    </div>
                  </div>
                  <Badge
                    variant={
                      meeting.status === "active" ? "default" : "secondary"
                    }
                    className={cn(
                      "text-[10px] px-2 gap-1",
                      meeting.status === "active" &&
                        "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-400",
                    )}
                  >
                    {meeting.status === "active" && (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                    )}
                    {meeting.status === "active"
                      ? "Live"
                      : meeting.status === "waiting"
                        ? "Waiting"
                        : meeting.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {/* ── Join by link/ID ── */}
          <div className="pt-4 border-t">
            <JoinByIdSection onJoin={handleJoinByLink} />
          </div>
        </div>
      </div>

      {/* ── Create modal ── */}
      <ResponsiveModal open={showCreate} onOpenChange={setShowCreate}>
        <ResponsiveModalContent className="sm:max-w-md">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>New Meeting</ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <div className="space-y-4 pt-2">
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                Give your meeting a name and you&apos;ll get a shareable link
                to invite others.
              </p>
              <Input
                placeholder="e.g. Weekly standup, Study group..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
            </div>
            <Button
              onClick={handleCreate}
              disabled={!newTitle.trim() || isCreating}
              className="w-full gap-1.5"
            >
              {isCreating ? (
                <>
                  <HugeiconsIcon
                    icon={Loading03Icon}
                    size={16}
                    className="animate-spin"
                  />
                  Creating...
                </>
              ) : (
                <>
                  <HugeiconsIcon icon={Video01Icon} size={16} />
                  Create &amp; Join
                </>
              )}
            </Button>
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════
   JOIN BY MEETING ID SECTION
   ═══════════════════════════════════════════════════════════════ */

function JoinByIdSection({ onJoin }: { onJoin: (meetingId: string) => void }) {
  const [meetingId, setMeetingId] = useState("")
  const [isJoining, setIsJoining] = useState(false)

  function handleJoin() {
    if (!meetingId.trim()) return
    setIsJoining(true)
    onJoin(meetingId.trim())
    setIsJoining(false)
    setMeetingId("")
  }

  return (
    <div className="rounded-xl border border-dashed bg-muted/30 p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <HugeiconsIcon
            icon={Link01Icon}
            size={14}
            className="text-primary/70"
          />
        </div>
        <h3 className="text-sm font-semibold">Join a meeting</h3>
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Paste a meeting link or ID..."
          value={meetingId}
          onChange={(e) => {
            let val = e.target.value
            const match = val.match(/[?&]join=([a-f0-9]{24})/)
            if (match) val = match[1]
            setMeetingId(val)
          }}
          onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          className="flex-1"
        />
        <Button
          onClick={handleJoin}
          disabled={!meetingId.trim() || isJoining}
          size="sm"
        >
          {isJoining ? "Joining..." : "Join"}
        </Button>
      </div>
    </div>
  )
}
