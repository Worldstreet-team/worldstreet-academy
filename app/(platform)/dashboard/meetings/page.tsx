"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
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
  type MeetingWithDetails,
  type MeetingParticipantDetails,
} from "@/lib/actions/meetings"

/* ─── Glass Button ──────────────────────────────────────────── */
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
          "active:scale-95 disabled:opacity-50",
          className,
        )}
        style={{
          background: bg[variant],
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        {children}
      </button>
      {label && (
        <span className="text-[10px] text-white/60 font-medium">{label}</span>
      )}
    </div>
  )
}

/* ─── Timer ─────────────────────────────────────────────────── */
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

/* ─── Participant Tile ──────────────────────────────────────── */
function ParticipantTile({
  name,
  avatar,
  isMuted,
  isVideoOff,
  isLocal,
  isSpeaking,
  isScreenShare,
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
        "relative rounded-2xl overflow-hidden bg-zinc-900/80 flex items-center justify-center transition-all duration-200",
        isSpeaking && "ring-2 ring-emerald-400/60",
        cls,
      )}
      style={{
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
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
          <Avatar className="w-16 h-16">
            {avatar && <AvatarImage src={avatar} alt={name} />}
            <AvatarFallback className="text-xl bg-zinc-700 text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>
      )}

      <div
        className="absolute bottom-0 left-0 right-0 px-3 py-2 flex items-center justify-between"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)",
        }}
      >
        <span className="text-xs font-medium text-white truncate">
          {isLocal ? "You" : name}
        </span>
        {isMuted && (
          <div className="w-5 h-5 rounded-full bg-red-500/80 flex items-center justify-center">
            <HugeiconsIcon icon={MicOff01Icon} size={10} className="text-white" />
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Pending Request Card ──────────────────────────────────── */
function PendingRequestCard({
  request,
  onAdmit,
  onDecline,
}: {
  request: MeetingParticipantDetails
  onAdmit: () => void
  onDecline: () => void
}) {
  const initials = request.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
      style={{
        background: "rgba(255,255,255,0.08)",
        backdropFilter: "blur(12px)",
      }}
    >
      <Avatar className="w-9 h-9">
        {request.avatar && (
          <AvatarImage src={request.avatar} alt={request.name} />
        )}
        <AvatarFallback className="text-xs bg-zinc-700 text-white">
          {initials}
        </AvatarFallback>
      </Avatar>
      <span className="flex-1 text-sm font-medium text-white truncate">
        {request.name}
      </span>
      <button
        onClick={onAdmit}
        className="w-8 h-8 rounded-full bg-emerald-500/80 flex items-center justify-center hover:bg-emerald-500 transition-colors"
      >
        <HugeiconsIcon
          icon={CheckmarkCircle01Icon}
          size={16}
          className="text-white"
        />
      </button>
      <button
        onClick={onDecline}
        className="w-8 h-8 rounded-full bg-red-500/80 flex items-center justify-center hover:bg-red-500 transition-colors"
      >
        <HugeiconsIcon icon={Cancel01Icon} size={16} className="text-white" />
      </button>
    </div>
  )
}

/* ─── Admitted Row ──────────────────────────────────────────── */
function AdmittedRow({
  name,
  avatar,
}: {
  name: string
  avatar?: string | null
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
      style={{ background: "rgba(255,255,255,0.05)" }}
    >
      <Avatar className="w-7 h-7">
        {avatar && <AvatarImage src={avatar} alt={name} />}
        <AvatarFallback className="text-[10px] bg-zinc-700 text-white">
          {initials}
        </AvatarFallback>
      </Avatar>
      <span className="text-xs font-medium text-white/80 truncate">{name}</span>
    </div>
  )
}

/* ─── Remote Participant Tile ───────────────────────────────── */
function RemoteParticipantTile({
  participantId,
  participant,
  className,
}: {
  participantId: string
  participant: {
    name: string
    audioEnabled: boolean
    videoEnabled: boolean
  }
  className?: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const client = rtkClient.client
    if (!client || !videoRef.current) return
    const p = client.participants.joined.get(participantId)
    if (p) p.registerVideoElement(videoRef.current)
  }, [participantId, participant.videoEnabled])

  return (
    <ParticipantTile
      name={participant.name}
      isMuted={!participant.audioEnabled}
      isVideoOff={!participant.videoEnabled}
      videoRef={videoRef}
      className={className}
    />
  )
}

/* ─── Screen Share View ─────────────────────────────────────── */
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

    // Attach the screen share track to the video element via srcObject
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

    // Try immediately (tracks should be ready since screenShareUpdate fired)
    attachTrack()

    // Also listen for track changes in case they aren't ready yet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (payload: any) => {
      if (payload.screenShareEnabled) {
        requestAnimationFrame(attachTrack)
      }
    }

    if (isLocal) {
      client.self.on("screenShareUpdate" as never, handler as never)
      return () => {
        client.self.removeListener(
          "screenShareUpdate" as never,
          handler as never,
        )
        if (el) el.srcObject = null
      }
    } else {
      const p = client.participants.joined.get(participantId)
      if (p) {
        p.on("screenShareUpdate" as never, handler as never)
        return () => {
          p.removeListener(
            "screenShareUpdate" as never,
            handler as never,
          )
          if (el) el.srcObject = null
        }
      }
      return () => {
        if (el) el.srcObject = null
      }
    }
  }, [participantId, isLocal])

  return (
    <div className="relative flex-1 rounded-2xl overflow-hidden bg-black flex items-center justify-center min-h-0">
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
          background:
            "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)",
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

/* ─── Setup Overlay ─────────────────────────────────────────── */
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

/* ─── Waiting Room ──────────────────────────────────────────── */
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
        {/* Pulsing ring animation */}
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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*                         Main Page                            */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

type ScreenSharer = { id: string; name: string; isLocal: boolean }

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
  const [isMuted, setIsMuted] = useState(true)
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
    Map<
      string,
      { name: string; audioEnabled: boolean; videoEnabled: boolean }
    >
  >(new Map())
  const [isJoined, setIsJoined] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [screenSharer, setScreenSharer] = useState<ScreenSharer | null>(null)

  /* ── Setup / waiting state ── */
  const [setupMessage, setSetupMessage] = useState<string | null>(null)
  const [waitingForApproval, setWaitingForApproval] = useState<string | null>(
    null,
  )

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const isHost = activeMeeting?.hostId === user.id
  const waitingRef = useRef(waitingForApproval)
  waitingRef.current = waitingForApproval
  const activeMeetingRef = useRef(activeMeeting)
  activeMeetingRef.current = activeMeeting
  const joinRTKRef = useRef<
    (authToken: string, meetingId?: string, meetingTitle?: string) => Promise<void>
  >(async () => {})

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

  /* ── SSE listener for meeting events (via window CustomEvent from CallProvider) ── */
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
      }
    }

    window.addEventListener("sse:event", handleSSE)
    return () => window.removeEventListener("sse:event", handleSSE)
  }, [])

  /* ── RTK event listeners ── */
  useEffect(() => {
    if (!isJoined) return
    const client = rtkClient.client
    if (!client) return

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleAudioUpdate = (p: any, data: any) => {
      setRemoteParticipants((prev) => {
        const ex = prev.get(p.id)
        if (!ex) return prev
        const next = new Map(prev)
        next.set(p.id, {
          ...ex,
          audioEnabled: data?.audioEnabled ?? ex.audioEnabled,
        })
        return next
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleVideoUpdate = (p: any, data: any) => {
      setRemoteParticipants((prev) => {
        const ex = prev.get(p.id)
        if (!ex) return prev
        const next = new Map(prev)
        next.set(p.id, {
          ...ex,
          videoEnabled: data?.videoEnabled ?? ex.videoEnabled,
        })
        return next
      })
    }

    // Screen share events from remote participants (note: camelCase "screenShareUpdate")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleScreenShareUpdate = (p: any) => {
      if (p.screenShareEnabled) {
        setScreenSharer({ id: p.id, name: p.name, isLocal: false })
      } else {
        setScreenSharer((prev) => (prev?.id === p.id ? null : prev))
      }
    }

    // Self screen share — track local screen share state via SDK events
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

    // Map-level events
    rtkClient.on(
      "participantJoined",
      "participants",
      handleParticipantJoined,
    )
    rtkClient.on("participantLeft", "participants", handleParticipantLeft)
    // Per-participant events forwarded through participant map
    rtkClient.on("audioUpdate", "participants", handleAudioUpdate)
    rtkClient.on("videoUpdate", "participants", handleVideoUpdate)
    rtkClient.on(
      "screenShareUpdate",
      "participants",
      handleScreenShareUpdate,
    )
    // Self screen share events
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
      rtkClient.off(
        "screenShareUpdate",
        "self",
        handleSelfScreenShareUpdate,
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isJoined])

  /* ── Join RTK room and set up ── */
  const joinRTKAndSetup = useCallback(
    async (
      authToken: string,
      meetingId?: string,
      meetingTitle?: string,
    ) => {
      try {
        await rtkClient.init(authToken, { audio: false, video: false })
        await rtkClient.joinRoom()
        setIsJoined(true)
        setSetupMessage(null)

        if (localVideoRef.current) {
          rtkClient.client?.self.registerVideoElement(
            localVideoRef.current,
            true,
          )
        }

        // If we don't have meeting details yet, fetch them
        if (!activeMeetingRef.current && meetingId) {
          const details = await getMeetingDetails(meetingId)
          if (details.success && details.meeting) {
            setActiveMeeting(details.meeting)
            setMeetingStartTime(
              details.meeting.startedAt
                ? new Date(details.meeting.startedAt)
                : new Date(),
            )
            if (details.participants)
              setAdmittedParticipants(
                details.participants.filter((p) => p.status === "admitted"),
              )
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
    [],
  )

  // Keep joinRTKRef in sync for SSE handler
  useEffect(() => {
    joinRTKRef.current = joinRTKAndSetup
  }, [joinRTKAndSetup])

  /* ── Create meeting ── */
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

  /* ── Join via link / ID ── */
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

  /* ── Rejoin from lobby list ── */
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

  /* ── Force leave (host ended meeting via SSE) ── */
  function handleForceLeave() {
    rtkClient.leaveRoom().catch(() => {})
    setActiveMeeting(null)
    setIsJoined(false)
    setRemoteParticipants(new Map())
    setIsMuted(true)
    setIsVideoOff(true)
    setIsScreenSharing(false)
    setScreenSharer(null)
    setPendingRequests([])
    setAdmittedParticipants([])
    setSetupMessage(null)
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
      if (next) await rtkClient.client?.self.disableVideo()
      else {
        await rtkClient.client?.self.enableVideo()
        if (localVideoRef.current)
          rtkClient.client?.self.registerVideoElement(
            localVideoRef.current,
            true,
          )
      }
    } catch (e) {
      console.error("Toggle video:", e)
    }
  }

  async function toggleScreenShare() {
    try {
      if (isScreenSharing) {
        await rtkClient.client?.self.disableScreenShare()
        // State updates handled by self screenShareUpdate listener
      } else {
        await rtkClient.client?.self.enableScreenShare()
        // State updates handled by self screenShareUpdate listener
      }
    } catch (e) {
      // User likely cancelled the screen picker dialog
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

  function copyMeetingLink() {
    if (!activeMeeting) return
    const link = `${window.location.origin}/dashboard/meetings?join=${activeMeeting.id}`
    navigator.clipboard.writeText(link)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  /* ── Loading overlay ── */
  if (setupMessage) return <SetupOverlay message={setupMessage} />

  /* ── Waiting for host approval ── */
  if (waitingForApproval) {
    return (
      <WaitingRoom
        meetingTitle={waitingForApproval}
        onCancel={() => setWaitingForApproval(null)}
      />
    )
  }

  /* ━━━━━━━━━━━━━━━━━━━ ACTIVE MEETING VIEW ━━━━━━━━━━━━━━━━━━ */

  if (activeMeeting && isJoined) {
    const totalParticipants = remoteParticipants.size + 1
    const hasScreenShare = !!screenSharer

    const gridCols = hasScreenShare
      ? ""
      : totalParticipants <= 1
        ? "grid-cols-1"
        : totalParticipants <= 4
          ? "grid-cols-2"
          : totalParticipants <= 9
            ? "grid-cols-3"
            : "grid-cols-4"

    return (
      <div className="flex flex-col h-dvh bg-zinc-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-br from-zinc-900 via-zinc-950 to-black" />

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
            {/* Invite link — visible to all */}
            <button
              onClick={copyMeetingLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white/70 hover:text-white transition-colors"
              style={{
                background: "rgba(255,255,255,0.08)",
                backdropFilter: "blur(8px)",
              }}
            >
              <HugeiconsIcon
                icon={copiedLink ? CheckmarkCircle01Icon : Link01Icon}
                size={12}
              />
              {copiedLink ? "Copied!" : "Invite Link"}
            </button>

            {/* People button — visible to all */}
            <button
              onClick={() => setShowPanel(!showPanel)}
              className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white/70 hover:text-white transition-colors"
              style={{
                background: "rgba(255,255,255,0.08)",
                backdropFilter: "blur(8px)",
              }}
            >
              <HugeiconsIcon icon={UserGroupIcon} size={14} />
              {pendingRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-[10px] flex items-center justify-center text-white font-bold">
                  {pendingRequests.length}
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
              background: "rgba(30,30,30,0.85)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white text-sm font-semibold">People</h3>
              <button onClick={() => setShowPanel(false)}>
                <HugeiconsIcon
                  icon={Cancel01Icon}
                  size={16}
                  className="text-white/50"
                />
              </button>
            </div>

            {/* Pending requests — host only */}
            {isHost && pendingRequests.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] uppercase tracking-wider text-amber-400/80 font-semibold mb-2">
                  Waiting ({pendingRequests.length})
                </p>
                <div className="space-y-2">
                  {pendingRequests.map((req) => (
                    <PendingRequestCard
                      key={req.userId}
                      request={req}
                      onAdmit={() => handleAdmit(req.userId)}
                      onDecline={() => handleDecline(req.userId)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* In meeting */}
            <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-2">
              In meeting ({totalParticipants})
            </p>
            <div className="space-y-1.5">
              <AdmittedRow
                name={`${user.firstName} ${user.lastName} (You)`}
                avatar={user.avatarUrl}
              />
              {Array.from(remoteParticipants.values()).map((p, i) => (
                <AdmittedRow key={i} name={p.name} />
              ))}
              {admittedParticipants
                .filter(
                  (p) =>
                    p.userId !== user.id &&
                    !Array.from(remoteParticipants.values()).some(
                      (rp) => rp.name === p.name,
                    ),
                )
                .map((p) => (
                  <AdmittedRow
                    key={p.userId}
                    name={p.name}
                    avatar={p.avatar}
                  />
                ))}
            </div>
          </div>
        )}

        {/* ── Video area ── */}
        <div className="relative z-10 flex-1 p-3 md:p-4 overflow-hidden flex flex-col gap-2">
          {hasScreenShare ? (
            /* Spotlight layout: screen share primary, participants as thumbnails */
            <>
              <ScreenShareView
                participantId={screenSharer.id}
                participantName={screenSharer.name}
                isLocal={screenSharer.isLocal}
              />

              {/* Participant thumbnail strip */}
              <div className="flex gap-2 overflow-x-auto pb-1 shrink-0">
                <div className="w-32 h-24 shrink-0">
                  <ParticipantTile
                    name={`${user.firstName} ${user.lastName}`}
                    avatar={user.avatarUrl}
                    isMuted={isMuted}
                    isVideoOff={isVideoOff}
                    isLocal
                    videoRef={localVideoRef}
                    className="w-full h-full"
                  />
                </div>
                {Array.from(remoteParticipants.entries()).map(([id, p]) => (
                  <div key={id} className="w-32 h-24 shrink-0">
                    <RemoteParticipantTile
                      participantId={id}
                      participant={p}
                      className="w-full h-full"
                    />
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* Grid layout: all participants in a grid */
            <div
              className={cn(
                "grid gap-2 md:gap-3 h-full auto-rows-fr",
                gridCols,
              )}
            >
              <ParticipantTile
                name={`${user.firstName} ${user.lastName}`}
                avatar={user.avatarUrl}
                isMuted={isMuted}
                isVideoOff={isVideoOff}
                isLocal
                videoRef={localVideoRef}
              />
              {Array.from(remoteParticipants.entries()).map(([id, p]) => (
                <RemoteParticipantTile
                  key={id}
                  participantId={id}
                  participant={p}
                />
              ))}
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
          }}
        >
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

          {/* Screen share — visible to everyone */}
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

          {/* People — visible to everyone */}
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
            {pendingRequests.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-500 text-[10px] flex items-center justify-center text-white font-bold">
                {pendingRequests.length}
              </span>
            )}
          </GlassButton>

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

  /* ━━━━━━━━━━━━━━━━━━━━━━━━ LOBBY VIEW ━━━━━━━━━━━━━━━━━━━━━━ */

  return (
    <>
      <Topbar title="Meetings" />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
          {/* Hero */}
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

          {/* Meetings list */}
          {isLoadingMeetings ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : meetings.length === 0 ? (
            <div className="text-center py-16">
              <div className="relative w-20 h-20 mx-auto mb-5">
                <div className="absolute inset-0 rounded-2xl bg-primary/10 animate-pulse" />
                <div className="relative w-full h-full rounded-2xl bg-linear-to-br from-primary/15 to-primary/5 flex items-center justify-center border border-primary/10">
                  <HugeiconsIcon
                    icon={Video01Icon}
                    size={32}
                    className="text-primary/70"
                  />
                </div>
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
            <div className="space-y-3">
              {meetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => handleRejoin(meeting)}
                >
                  <div
                    className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                      meeting.status === "active"
                        ? "bg-emerald-500/12"
                        : "bg-primary/8",
                    )}
                  >
                    <HugeiconsIcon
                      icon={Video01Icon}
                      size={22}
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
                        Hosted by{" "}
                        {meeting.hostId === user.id ? "you" : meeting.hostName}
                      </span>
                      <span className="text-muted-foreground/60 text-xs">
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
                        "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20",
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

          {/* Join by ID / link */}
          <div className="pt-4 border-t">
            <JoinByIdSection onJoin={handleJoinByLink} />
          </div>
        </div>
      </div>

      {/* Create modal */}
      <ResponsiveModal open={showCreate} onOpenChange={setShowCreate}>
        <ResponsiveModalContent className="sm:max-w-md">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>New Meeting</ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <div className="space-y-4 pt-2">
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                Give your meeting a name and you&apos;ll get a shareable link to
                invite others.
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

/* ─── Join by Meeting ID section ────────────────────────────── */
function JoinByIdSection({
  onJoin,
}: {
  onJoin: (meetingId: string) => void
}) {
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
          <HugeiconsIcon icon={Link01Icon} size={14} className="text-primary/70" />
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
