"use client"

import { useState, useEffect, useRef } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Mic01Icon,
  MicOff01Icon,
  Video01Icon,
  VideoOffIcon,
  CallEnd01Icon,
  ComputerScreenShareIcon,
  UserAdd01Icon,
  CheckmarkCircle01Icon,
  Cancel01Icon,
  Copy01Icon,
  UserGroupIcon,
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
import {
  createMeeting,
  getMyMeetings,
  getMeetingDetails,
  endMeeting as endMeetingAction,
  leaveMeeting,
  admitParticipant,
  declineParticipant,
  getPendingRequests,
  type MeetingWithDetails,
  type MeetingParticipantDetails,
} from "@/lib/actions/meetings"

// ── Glass Button (reusable glassmorphic control) ──
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
          className
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

// ── Timer ──
function MeetingTimer({ startTime }: { startTime: Date | null }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!startTime) return
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [startTime])
  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60
  return (
    <span className="tabular-nums text-sm font-medium text-white/70">
      {h > 0 && `${h}:`}{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  )
}

// ── Participant Tile ──
function ParticipantTile({
  name,
  avatar,
  isMuted,
  isVideoOff,
  isLocal,
  isSpeaking,
  isScreenShare,
  videoRef,
}: {
  name: string
  avatar?: string | null
  isMuted?: boolean
  isVideoOff?: boolean
  isLocal?: boolean
  isSpeaking?: boolean
  isScreenShare?: boolean
  videoRef?: React.RefObject<HTMLVideoElement | null>
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
        "relative rounded-2xl overflow-hidden bg-zinc-900/80 flex items-center justify-center",
        "transition-all duration-200",
        isScreenShare ? "col-span-2 row-span-2" : "",
        isSpeaking && "ring-2 ring-emerald-400/60"
      )}
      style={{
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        aspectRatio: isScreenShare ? "16/9" : "4/3",
      }}
    >
      {!isVideoOff && videoRef ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Avatar className="w-16 h-16">
            {avatar && <AvatarImage src={avatar} alt={name} />}
            <AvatarFallback className="text-xl bg-zinc-700 text-white">{initials}</AvatarFallback>
          </Avatar>
        </div>
      )}

      {/* Overlay info */}
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

// ── Pending Request Card ──
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
        {request.avatar && <AvatarImage src={request.avatar} alt={request.name} />}
        <AvatarFallback className="text-xs bg-zinc-700 text-white">{initials}</AvatarFallback>
      </Avatar>
      <span className="flex-1 text-sm font-medium text-white truncate">{request.name}</span>
      <button
        onClick={onAdmit}
        className="w-8 h-8 rounded-full bg-emerald-500/80 flex items-center justify-center hover:bg-emerald-500 transition-colors"
      >
        <HugeiconsIcon icon={CheckmarkCircle01Icon} size={16} className="text-white" />
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

// ── Remote Participant Tile (handles ref safely) ──
function RemoteParticipantTile({
  participantId,
  participant,
}: {
  participantId: string
  participant: { name: string; audioEnabled: boolean; videoEnabled: boolean }
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    // Register the video element ref for this participant
    const client = rtkClient.client
    if (!client || !videoRef.current) return
    const p = client.participants.joined.get(participantId)
    if (p) {
      p.registerVideoElement(videoRef.current)
    }
  }, [participantId, participant.videoEnabled])

  return (
    <ParticipantTile
      name={participant.name}
      isMuted={!participant.audioEnabled}
      isVideoOff={!participant.videoEnabled}
      videoRef={videoRef}
    />
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Main Page
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function MeetingsPage() {
  const user = useUser()

  // ── Lobby state ──
  const [meetings, setMeetings] = useState<MeetingWithDetails[]>([])
  const [isLoadingMeetings, setIsLoadingMeetings] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  // ── Active meeting state ──
  const [activeMeeting, setActiveMeeting] = useState<MeetingWithDetails | null>(null)
  const [, setAuthToken] = useState<string | null>(null)
  const [isMuted, setIsMuted] = useState(true)
  const [isVideoOff, setIsVideoOff] = useState(true)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [meetingStartTime, setMeetingStartTime] = useState<Date | null>(null)
  const [showParticipants, setShowParticipants] = useState(false)
  const [, setParticipants] = useState<MeetingParticipantDetails[]>([])
  const [pendingRequests, setPendingRequests] = useState<MeetingParticipantDetails[]>([])
  const [remoteParticipants, setRemoteParticipants] = useState<Map<string, { name: string; audioEnabled: boolean; videoEnabled: boolean }>>(new Map())
  const [isJoined, setIsJoined] = useState(false)
  const [copiedId, setCopiedId] = useState(false)

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const screenShareRef = useRef<HTMLVideoElement>(null)
  const isHost = activeMeeting?.hostId === user.id
  const pendingPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Load meetings ──
  async function loadMeetings() {
    setIsLoadingMeetings(true)
    const result = await getMyMeetings()
    if (result.success && result.meetings) {
      setMeetings(result.meetings)
    }
    setIsLoadingMeetings(false)
  }

  useEffect(() => {
    let cancelled = false
    getMyMeetings().then((result) => {
      if (cancelled) return
      if (result.success && result.meetings) {
        setMeetings(result.meetings)
      }
      setIsLoadingMeetings(false)
    })
    return () => { cancelled = true }
  }, [])

  // ── Create meeting ──
  async function handleCreate() {
    if (!newTitle.trim()) return
    setIsCreating(true)
    const result = await createMeeting(newTitle.trim())
    if (result.success && result.meeting && result.authToken) {
      setShowCreate(false)
      setNewTitle("")
      setActiveMeeting(result.meeting)
      setAuthToken(result.authToken)
      setMeetingStartTime(new Date())
      // Join RTK room as host
      await joinRTKRoom(result.authToken)
    }
    setIsCreating(false)
  }

  // ── Join RTK room ──
  async function joinRTKRoom(token: string) {
    try {
      await rtkClient.init(token, { audio: false, video: false })
      await rtkClient.joinRoom()
      setIsJoined(true)

      // Register local video
      if (localVideoRef.current) {
        rtkClient.client?.self.registerVideoElement(localVideoRef.current, true)
      }
    } catch (err) {
      console.error("[Meeting] Failed to join RTK room:", err)
    }
  }

  // ── RTK event listeners ──
  useEffect(() => {
    if (!isJoined) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleParticipantJoined = (p: any) => {
      console.log("[Meeting] Participant joined:", p.name)
      setRemoteParticipants((prev) => {
        const next = new Map(prev)
        next.set(p.id, { name: p.name, audioEnabled: p.audioEnabled, videoEnabled: p.videoEnabled })
        return next
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleParticipantLeft = (p: any) => {
      console.log("[Meeting] Participant left:", p.name)
      setRemoteParticipants((prev) => {
        const next = new Map(prev)
        next.delete(p.id)
        return next
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleAudioUpdate = (p: any, data: any) => {
      setRemoteParticipants((prev) => {
        const existing = prev.get(p.id)
        if (!existing) return prev
        const next = new Map(prev)
        next.set(p.id, { ...existing, audioEnabled: data?.audioEnabled ?? existing.audioEnabled })
        return next
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleVideoUpdate = (p: any, data: any) => {
      setRemoteParticipants((prev) => {
        const existing = prev.get(p.id)
        if (!existing) return prev
        const next = new Map(prev)
        next.set(p.id, { ...existing, videoEnabled: data?.videoEnabled ?? existing.videoEnabled })
        return next
      })
    }

    rtkClient.on("participantJoined", "participants", handleParticipantJoined)
    rtkClient.on("participantLeft", "participants", handleParticipantLeft)
    rtkClient.on("audioUpdate", "participants", handleAudioUpdate)
    rtkClient.on("videoUpdate", "participants", handleVideoUpdate)

    return () => {
      rtkClient.off("participantJoined", "participants", handleParticipantJoined)
      rtkClient.off("participantLeft", "participants", handleParticipantLeft)
      rtkClient.off("audioUpdate", "participants", handleAudioUpdate)
      rtkClient.off("videoUpdate", "participants", handleVideoUpdate)
    }
  }, [isJoined])

  // ── Poll pending requests for host ──
  useEffect(() => {
    if (!activeMeeting || !isHost) return
    const poll = async () => {
      const result = await getPendingRequests(activeMeeting.id)
      if (result.success && result.requests) {
        setPendingRequests(result.requests)
      }
    }
    poll()
    pendingPollRef.current = setInterval(poll, 5000)
    return () => {
      if (pendingPollRef.current) clearInterval(pendingPollRef.current)
    }
  }, [activeMeeting, isHost])

  // ── Rejoin existing meeting ──
  async function handleRejoin(meeting: MeetingWithDetails) {
    const result = await getMeetingDetails(meeting.id)
    if (result.success && result.meeting && result.authToken) {
      setActiveMeeting(result.meeting)
      setAuthToken(result.authToken)
      setMeetingStartTime(result.meeting.startedAt ? new Date(result.meeting.startedAt) : new Date())
      if (result.participants) setParticipants(result.participants)
      await joinRTKRoom(result.authToken)
    }
  }

  // ── Controls ──
  async function toggleMute() {
    const next = !isMuted
    setIsMuted(next)
    try {
      if (next) await rtkClient.client?.self.disableAudio()
      else await rtkClient.client?.self.enableAudio()
    } catch (e) {
      console.error("Toggle mute error:", e)
    }
  }

  async function toggleVideo() {
    const next = !isVideoOff
    setIsVideoOff(next)
    try {
      if (next) await rtkClient.client?.self.disableVideo()
      else {
        await rtkClient.client?.self.enableVideo()
        if (localVideoRef.current) {
          rtkClient.client?.self.registerVideoElement(localVideoRef.current, true)
        }
      }
    } catch (e) {
      console.error("Toggle video error:", e)
    }
  }

  async function toggleScreenShare() {
    try {
      if (isScreenSharing) {
        await rtkClient.client?.self.disableScreenShare()
        setIsScreenSharing(false)
      } else {
        await rtkClient.client?.self.enableScreenShare()
        setIsScreenSharing(true)
      }
    } catch (e) {
      console.error("Screen share error:", e)
      setIsScreenSharing(false)
    }
  }

  async function handleEndMeeting() {
    if (!activeMeeting) return
    try {
      if (isHost) {
        await endMeetingAction(activeMeeting.id)
      } else {
        await leaveMeeting(activeMeeting.id)
      }
    } catch {}
    await rtkClient.leaveRoom()
    setActiveMeeting(null)
    setIsJoined(false)
    setRemoteParticipants(new Map())
    setIsMuted(true)
    setIsVideoOff(true)
    setIsScreenSharing(false)
    setPendingRequests([])
    loadMeetings()
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

  function copyMeetingId() {
    if (!activeMeeting) return
    navigator.clipboard.writeText(activeMeeting.id)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  ACTIVE MEETING VIEW
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (activeMeeting && isJoined) {
    const totalParticipants = remoteParticipants.size + 1

    // Grid layout based on participant count
    const gridCols =
      totalParticipants <= 1
        ? "grid-cols-1"
        : totalParticipants <= 4
          ? "grid-cols-2"
          : totalParticipants <= 9
            ? "grid-cols-3"
            : "grid-cols-4"

    return (
      <div className="flex flex-col h-dvh bg-zinc-950 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-linear-to-br from-zinc-900 via-zinc-950 to-black" />

        {/* Top bar */}
        <div
          className="relative z-10 flex items-center justify-between px-4 md:px-6 py-3"
          style={{
            background: "rgba(0,0,0,0.3)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
          }}
        >
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <h2 className="text-white font-semibold text-sm truncate max-w-50">
                {activeMeeting.title}
              </h2>
              <div className="flex items-center gap-2">
                <MeetingTimer startTime={meetingStartTime} />
                <span className="text-white/40 text-xs">·</span>
                <span className="text-white/50 text-xs">{totalParticipants} in meeting</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyMeetingId}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white/70 hover:text-white transition-colors"
              style={{
                background: "rgba(255,255,255,0.08)",
                backdropFilter: "blur(8px)",
              }}
            >
              <HugeiconsIcon icon={copiedId ? CheckmarkCircle01Icon : Copy01Icon} size={12} />
              {copiedId ? "Copied!" : "Copy ID"}
            </button>

            {isHost && pendingRequests.length > 0 && (
              <button
                onClick={() => setShowParticipants(!showParticipants)}
                className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white/70 hover:text-white transition-colors"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <HugeiconsIcon icon={UserGroupIcon} size={14} />
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-[10px] flex items-center justify-center text-white font-bold">
                  {pendingRequests.length}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Participants panel (slide-in from right) */}
        {showParticipants && (
          <div
            className="absolute top-14 right-4 z-20 w-72 max-h-96 rounded-2xl p-3 overflow-y-auto animate-in slide-in-from-right-4 fade-in duration-200"
            style={{
              background: "rgba(30,30,30,0.85)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white text-sm font-semibold">Waiting to join</h3>
              <button onClick={() => setShowParticipants(false)}>
                <HugeiconsIcon icon={Cancel01Icon} size={16} className="text-white/50" />
              </button>
            </div>
            {pendingRequests.length === 0 ? (
              <p className="text-white/40 text-xs text-center py-4">No pending requests</p>
            ) : (
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
            )}
          </div>
        )}

        {/* Video grid */}
        <div className="relative z-10 flex-1 p-3 md:p-4 overflow-hidden">
          <div className={cn("grid gap-2 md:gap-3 h-full auto-rows-fr", gridCols)}>
            {/* Local participant */}
            <ParticipantTile
              name={`${user.firstName} ${user.lastName}`}
              avatar={user.avatarUrl}
              isMuted={isMuted}
              isVideoOff={isVideoOff}
              isLocal
              videoRef={localVideoRef}
            />

            {/* Remote participants */}
            {Array.from(remoteParticipants.entries()).map(([id, p]) => (
              <RemoteParticipantTile key={id} participantId={id} participant={p} />
            ))}

            {/* Screen share tile */}
            {isScreenSharing && (
              <ParticipantTile
                name="Your Screen"
                isScreenShare
                videoRef={screenShareRef}
              />
            )}
          </div>
        </div>

        {/* Bottom controls */}
        <div
          className="relative z-10 flex items-center justify-center gap-3 md:gap-4 px-4 py-4 md:py-5"
          style={{
            background: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          <GlassButton onClick={toggleMute} active={isMuted} label={isMuted ? "Unmute" : "Mute"}>
            <HugeiconsIcon
              icon={isMuted ? MicOff01Icon : Mic01Icon}
              size={18}
              className={isMuted ? "text-black" : "text-white"}
            />
          </GlassButton>

          <GlassButton onClick={toggleVideo} active={isVideoOff} label={isVideoOff ? "Start Video" : "Stop Video"}>
            <HugeiconsIcon
              icon={isVideoOff ? VideoOffIcon : Video01Icon}
              size={18}
              className={isVideoOff ? "text-black" : "text-white"}
            />
          </GlassButton>

          <GlassButton onClick={toggleScreenShare} active={isScreenSharing} label="Share Screen">
            <HugeiconsIcon
              icon={ComputerScreenShareIcon}
              size={18}
              className={isScreenSharing ? "text-black" : "text-white"}
            />
          </GlassButton>

          {isHost && (
            <GlassButton
              onClick={() => setShowParticipants(!showParticipants)}
              label="Requests"
              className="relative"
            >
              <HugeiconsIcon icon={UserAdd01Icon} size={18} className="text-white" />
              {pendingRequests.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-500 text-[10px] flex items-center justify-center text-white font-bold">
                  {pendingRequests.length}
                </span>
              )}
            </GlassButton>
          )}

          <GlassButton variant="danger" onClick={handleEndMeeting} label={isHost ? "End" : "Leave"}>
            <HugeiconsIcon icon={CallEnd01Icon} size={20} className="text-white" />
          </GlassButton>
        </div>
      </div>
    )
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  LOBBY / MEETINGS LIST
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  return (
    <>
      <Topbar title="Meetings" />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Meetings</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Host or join video meetings with screen sharing
              </p>
            </div>
            <Button onClick={() => setShowCreate(true)} size="sm" className="gap-1.5">
              <HugeiconsIcon icon={Add01Icon} size={16} />
              New Meeting
            </Button>
          </div>

          {/* Active / Recent meetings */}
          {isLoadingMeetings ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : meetings.length === 0 ? (
            <div className="text-center py-16">
              <div
                className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                style={{
                  background: "rgba(var(--primary-rgb, 0,0,0), 0.08)",
                }}
              >
                <HugeiconsIcon icon={Video01Icon} size={32} className="text-primary/60" />
              </div>
              <h3 className="font-semibold text-lg mb-1">No meetings yet</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-xs mx-auto">
                Create a meeting to start a video call with screen sharing and invite others.
              </p>
              <Button onClick={() => setShowCreate(true)} size="sm" className="gap-1.5">
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
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background:
                        meeting.status === "active"
                          ? "rgba(34,197,94,0.12)"
                          : "rgba(var(--primary-rgb, 0,0,0), 0.08)",
                    }}
                  >
                    <HugeiconsIcon
                      icon={Video01Icon}
                      size={22}
                      className={meeting.status === "active" ? "text-emerald-500" : "text-primary/60"}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">{meeting.title}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        Hosted by {meeting.hostId === user.id ? "you" : meeting.hostName}
                      </span>
                      <span className="text-muted-foreground/60 text-xs">·</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <HugeiconsIcon icon={UserGroupIcon} size={11} />
                        {meeting.participantCount}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge
                      variant={meeting.status === "active" ? "default" : "secondary"}
                      className={cn(
                        "text-[10px] px-2",
                        meeting.status === "active" && "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20"
                      )}
                    >
                      {meeting.status === "active" ? "Live" : meeting.status === "waiting" ? "Waiting" : meeting.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Join by ID section */}
          <div className="pt-4 border-t">
            <JoinByIdSection onJoin={handleRejoin} />
          </div>
        </div>
      </div>

      {/* Create Meeting Modal */}
      <ResponsiveModal open={showCreate} onOpenChange={setShowCreate}>
        <ResponsiveModalContent className="sm:max-w-md">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>New Meeting</ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <div className="space-y-4 pt-2">
            <Input
              placeholder="Meeting title..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
            <Button
              onClick={handleCreate}
              disabled={!newTitle.trim() || isCreating}
              className="w-full"
            >
              {isCreating ? "Creating..." : "Create & Join"}
            </Button>
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  )
}

// ── Join by Meeting ID ──
function JoinByIdSection({ onJoin }: { onJoin: (meeting: MeetingWithDetails) => void }) {
  const [meetingId, setMeetingId] = useState("")
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState("")

  async function handleJoin() {
    if (!meetingId.trim()) return
    setError("")
    setIsJoining(true)
    const result = await getMeetingDetails(meetingId.trim())
    if (result.success && result.meeting) {
      onJoin(result.meeting)
    } else {
      setError(result.error || "Meeting not found")
    }
    setIsJoining(false)
  }

  return (
    <div>
      <h3 className="text-sm font-semibold mb-2">Join a meeting</h3>
      <div className="flex gap-2">
        <Input
          placeholder="Enter meeting ID..."
          value={meetingId}
          onChange={(e) => {
            setMeetingId(e.target.value)
            setError("")
          }}
          onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          className="flex-1"
        />
        <Button onClick={handleJoin} disabled={!meetingId.trim() || isJoining} size="sm">
          {isJoining ? "Joining..." : "Join"}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive mt-1.5">{error}</p>}
    </div>
  )
}
