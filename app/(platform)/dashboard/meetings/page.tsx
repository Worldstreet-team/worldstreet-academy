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
  Clock01Icon,
  ArrowRight01Icon,
  BubbleChatIcon,
  ChartColumnIcon,
  VolumeHighIcon,
  ArrowShrink02Icon,
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
import { useMeeting } from "@/components/providers/meeting-provider"
import type { MeetingEventPayload } from "@/lib/call-events"
import {
  createMeeting,
  joinMeeting,
  getMyMeetings,
  getMeetingDetails,
  getMeetingHistory,
  endMeeting as endMeetingAction,
  leaveMeeting,
  admitParticipant,
  declineParticipant,
  toggleHandRaise,
  sendReaction,
  kickParticipant,
  sendMeetingChat,
  createMeetingPoll,
  voteMeetingPoll,
  muteParticipant,
  toggleScreenSharePermission,
  type MeetingWithDetails,
  type MeetingParticipantDetails,
  type MeetingHistoryEntry,
} from "@/lib/actions/meetings"
import {
  playMeetingCreating,
  playMeetingJoined,
  playScreenShare,
  playHandRaise,
  playReaction,
  playMeetingEnded,
  playChatMessage,
} from "@/lib/sounds"

/* ═══════════════════════════════════════════════════════
   CONSTANTS & TYPES
   ═══════════════════════════════════════════════════════ */

const REACTIONS = [
  { id: "👏", emoji: "👏", label: "Clap" },
  { id: "❤️", emoji: "❤️", label: "Love" },
  { id: "😂", emoji: "😂", label: "Haha" },
  { id: "🎉", emoji: "🎉", label: "Celebrate" },
  { id: "👍", emoji: "👍", label: "Like" },
] as const
const TILES_PER_PAGE = 4

type ChatMessage = {
  id: string
  userId: string
  userName: string
  userAvatar: string | null
  message: string
  imageUrl?: string
  videoUrl?: string
  timestamp: number
}

type Poll = {
  id: string
  question: string
  options: string[]
  votes: Record<string, number>
  voters: Set<string>
  createdBy: string
  createdByName: string
}

type ActiveTab = "people" | "chat" | "polls"

/* ----------------------------------------------------------------
   SUB-COMPONENTS
   ---------------------------------------------------------------- */

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
    <span className="tabular-nums text-sm font-medium text-muted-foreground">
      {h > 0 && `${h}:`}
      {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  )
}

function ParticipantTile({
  name,
  avatar,
  isMuted,
  isVideoOff,
  isLocal,
  isSpeaking,
  isScreenShare,
  handRaised,
  reactionId,
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
  reactionId?: string | null
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
        "bg-neutral-200/60 dark:bg-zinc-900/70",
        isSpeaking && "ring-2 ring-emerald-400/60 ring-offset-1 ring-offset-transparent",
        cls,
      )}
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
            <AvatarFallback className="text-xl bg-black/5 dark:bg-white/10 text-foreground/80">
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>
      )}

      {(handRaised || reactionId) && (
        <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
          {reactionId && (() => {
            const r = REACTIONS.find((rx) => rx.id === reactionId)
            return r ? (
              <div className="w-8 h-8 rounded-full bg-background/70 backdrop-blur-sm flex items-center justify-center animate-bounce">
                <span className="text-base leading-none">{r.emoji}</span>
              </div>
            ) : null
          })()}
          {handRaised && (
            <div className="w-8 h-8 rounded-full bg-amber-500/20 backdrop-blur-sm flex items-center justify-center animate-bounce">
              <span className="text-base leading-none">✋</span>
            </div>
          )}
        </div>
      )}

      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
        <span className="px-2.5 py-0.5 rounded-full border border-white/30 dark:border-white/20 text-[11px] font-medium text-white truncate max-w-[70%] backdrop-blur-sm">
          {isLocal ? "You" : name}
        </span>
        {isMuted && (
          <div className="w-6 h-6 rounded-full border border-red-400/50 flex items-center justify-center backdrop-blur-sm">
            <HugeiconsIcon icon={MicOff01Icon} size={11} className="text-red-400" />
          </div>
        )}
      </div>
    </div>
  )
}

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

    if (typeof participant.registerAudioElement === "function") {
      participant.registerAudioElement(el)
      return
    }

    if (audioEnabled && participant.audioTrack) {
      el.srcObject = new MediaStream([participant.audioTrack])
      el.play().catch(() => {})
    } else {
      el.srcObject = null
    }
  }, [participantId, audioEnabled])

  return <audio ref={audioRef} autoPlay playsInline />
}

function RemoteParticipantTile({
  participantId,
  participant,
  handRaised,
  reactionId,
  className,
}: {
  participantId: string
  participant: { name: string; audioEnabled: boolean; videoEnabled: boolean }
  handRaised?: boolean
  reactionId?: string | null
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
      reactionId={reactionId}
      videoRef={videoRef}
      className={className}
    />
  )
}

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
    <div className="relative flex-1 rounded-2xl overflow-hidden flex items-center justify-center min-h-0 bg-black/90">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-contain"
      />
      <div className="absolute bottom-2 left-2 flex items-center gap-2 px-3 py-1 rounded-full border border-white/20 backdrop-blur-sm">
        <HugeiconsIcon icon={ComputerScreenShareIcon} size={12} className="text-emerald-400" />
        <span className="text-[11px] font-medium text-white">
          {isLocal ? "You are sharing" : `${participantName}'s screen`}
        </span>
      </div>
    </div>
  )
}

function SetupOverlay({ message }: { message: string }) {
  return (
    <div className="absolute inset-0 z-50 bg-background/95 flex flex-col items-center justify-center gap-5 rounded-inherit">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-muted border border-border">
        <HugeiconsIcon icon={Loading03Icon} size={28} className="text-muted-foreground animate-spin" />
      </div>
      <p className="text-muted-foreground text-sm font-medium">{message}</p>
    </div>
  )
}

function WaitingRoom({
  meetingTitle,
  onCancel,
}: {
  meetingTitle: string
  onCancel: () => void
}) {
  return (
    <div className="absolute inset-0 z-50 bg-background flex flex-col items-center justify-center rounded-inherit">
      <div className="relative z-10 flex flex-col items-center gap-8">
        <div className="relative">
          <div className="absolute inset-0 w-24 h-24 rounded-full bg-emerald-500/10 animate-ping" />
          <div className="w-24 h-24 rounded-full flex items-center justify-center bg-muted border border-border">
            <HugeiconsIcon icon={Loading03Icon} size={32} className="text-muted-foreground animate-spin" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-foreground text-lg font-semibold">{meetingTitle}</h2>
          <p className="text-muted-foreground text-sm">Waiting for the host to let you in…</p>
        </div>
        <Button variant="outline" size="sm" onClick={onCancel} className="border-border text-muted-foreground hover:text-foreground hover:border-border bg-muted">
          Cancel
        </Button>
      </div>
    </div>
  )
}

function MeetingEndedScreen({
  meetingTitle,
  duration,
  onReturn,
}: {
  meetingTitle: string
  duration: string
  onReturn: () => void
}) {
  return (
    <div className="fixed inset-0 z-60 bg-background flex flex-col items-center justify-center gap-6">
      <div className="w-20 h-20 rounded-full border-2 border-red-400/30 flex items-center justify-center">
        <HugeiconsIcon icon={CallEnd01Icon} size={32} className="text-red-400" />
      </div>
      <div className="text-center space-y-1.5">
        <h2 className="text-xl font-semibold text-foreground">Meeting Ended</h2>
        <p className="text-sm text-muted-foreground">{meetingTitle}</p>
        {duration && (
          <p className="text-xs text-muted-foreground/60">Duration: {duration}</p>
        )}
      </div>
      <Button onClick={onReturn} size="sm" className="gap-2 mt-2">
        <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
        Back to Meetings
      </Button>
    </div>
  )
}

/* ----------------------------------------------------------------
   MAIN PAGE COMPONENT
   ---------------------------------------------------------------- */

type ScreenSharer = { id: string; name: string; isLocal: boolean }

export default function MeetingsPage() {
  const user = useUser()
  const searchParams = useSearchParams()
  const router = useRouter()
  const meetingCtx = useMeeting()

  const [meetings, setMeetings] = useState<MeetingWithDetails[]>([])
  const [isLoadingMeetings, setIsLoadingMeetings] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [meetingHistory, setMeetingHistory] = useState<MeetingHistoryEntry[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)

  const [activeMeeting, setActiveMeeting] = useState<MeetingWithDetails | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(true)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [meetingStartTime, setMeetingStartTime] = useState<Date | null>(null)
  const [admittedParticipants, setAdmittedParticipants] = useState<MeetingParticipantDetails[]>([])
  const [pendingRequests, setPendingRequests] = useState<MeetingParticipantDetails[]>([])
  const [remoteParticipants, setRemoteParticipants] = useState<
    Map<string, { name: string; audioEnabled: boolean; videoEnabled: boolean; userId?: string }>
  >(new Map())
  const [isJoined, setIsJoined] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [screenSharer, setScreenSharer] = useState<ScreenSharer | null>(null)

  const [raisedHands, setRaisedHands] = useState<Set<string>>(new Set())
  const [myHandRaised, setMyHandRaised] = useState(false)
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const [tileReactions, setTileReactions] = useState<Map<string, string>>(new Map())
  const tileReactionTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const [gridPage, setGridPage] = useState(0)
  const [setupMessage, setSetupMessage] = useState<string | null>(null)
  const [waitingForApproval, setWaitingForApproval] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<ActiveTab | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState("")
  const [unreadChat, setUnreadChat] = useState(0)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const [polls, setPolls] = useState<Poll[]>([])
  const [showCreatePoll, setShowCreatePoll] = useState(false)
  const [pollQuestion, setPollQuestion] = useState("")
  const [pollOptions, setPollOptions] = useState(["", ""])
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set())

  const [isLoudspeaker, setIsLoudspeaker] = useState(true)
  const [screenSharePermissions, setScreenSharePermissions] = useState<Map<string, boolean>>(new Map())
  const [showMeetingEnded, setShowMeetingEnded] = useState<{ title: string; duration: string } | null>(null)

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent))
  }, [])

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const isHost = activeMeeting?.hostId === user.id

  const waitingRef = useRef(waitingForApproval)
  waitingRef.current = waitingForApproval
  const activeMeetingRef = useRef(activeMeeting)
  activeMeetingRef.current = activeMeeting
  const activeTabRef = useRef(activeTab)
  activeTabRef.current = activeTab
  const meetingStartTimeRef = useRef(meetingStartTime)
  meetingStartTimeRef.current = meetingStartTime
  const joinRTKRef = useRef<(authToken: string, meetingId?: string, meetingTitle?: string) => Promise<void>>(async () => {})

  /* ---- EFFECTS ---- */

  useEffect(() => {
    let cancelled = false
    getMyMeetings().then((r) => {
      if (cancelled) return
      if (r.success && r.meetings) setMeetings(r.meetings)
      setIsLoadingMeetings(false)
    })
    getMeetingHistory().then((r) => {
      if (cancelled) return
      if (r.success && r.meetings) setMeetingHistory(r.meetings)
      setIsLoadingHistory(false)
    })
    return () => { cancelled = true }
  }, [])

  /* ---- Real-time meeting list refresh via Ably ---- */
  useEffect(() => {
    // Only refresh the lobby list when NOT in an active meeting
    if (activeMeeting) return

    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    function handleMeetingListEvent(evt: Event) {
      const e = (evt as CustomEvent).detail as MeetingEventPayload & { type: string }
      if (!e?.type?.startsWith("meeting:")) return

      // These events indicate the meeting list should be refreshed
      const refreshEvents = [
        "meeting:ended",
        "meeting:participant-joined",
        "meeting:participant-left",
        "meeting:admitted",
      ]
      if (refreshEvents.includes(e.type)) {
        // Debounce to avoid multiple rapid re-fetches
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
          getMyMeetings().then((r) => {
            if (r.success && r.meetings) setMeetings(r.meetings)
          })
          getMeetingHistory().then((r) => {
            if (r.success && r.meetings) setMeetingHistory(r.meetings)
          })
        }, 500)
      }
    }
    window.addEventListener("sse:event", handleMeetingListEvent)
    return () => {
      window.removeEventListener("sse:event", handleMeetingListEvent)
      if (debounceTimer) clearTimeout(debounceTimer)
    }
  }, [activeMeeting])

  useEffect(() => {
    const joinId = searchParams.get("join")
    if (!joinId) return
    router.replace("/dashboard/meetings", { scroll: false })
    handleJoinByLink(joinId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useEffect(() => {
    if (!isJoined) return
    const client = rtkClient.client
    if (!client) return
    const raf = requestAnimationFrame(() => {
      if (localVideoRef.current) client.self.registerVideoElement(localVideoRef.current, true)
    })
    return () => cancelAnimationFrame(raf)
  }, [isJoined, isVideoOff])

  const isScreenShareActive = !!screenSharer
  useEffect(() => { setGridPage(0) }, [isScreenShareActive])

  useEffect(() => {
    const participantPages = Math.ceil((remoteParticipants.size + 1) / TILES_PER_PAGE)
    const totalSlides = (screenSharer ? 1 : 0) + participantPages
    const maxPage = Math.max(0, totalSlides - 1)
    setGridPage((prev) => Math.min(prev, maxPage))
  }, [remoteParticipants.size, screenSharer])

  useEffect(() => {
    if (activeTab === "chat") {
      setUnreadChat(0)
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [chatMessages.length, activeTab])

  /* ---- SSE listener ---- */
  useEffect(() => {
    function handleSSE(evt: Event) {
      const e = (evt as CustomEvent).detail as MeetingEventPayload & { type: string }
      if (!e?.type?.startsWith("meeting:")) return

      switch (e.type) {
        case "meeting:join-request":
          setPendingRequests((prev) => {
            if (prev.some((r) => r.userId === e.userId)) return prev
            return [...prev, { userId: e.userId, name: e.userName, avatar: e.userAvatar, role: "participant" as const, status: "pending" as const }]
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
          if (activeMeetingRef.current) handleMeetingEnd()
          break
        case "meeting:kicked":
          if (activeMeetingRef.current) handleMeetingEnd()
          break
        case "meeting:hand-raised":
          setRaisedHands((prev) => new Set(prev).add(e.userId))
          playHandRaise()
          break
        case "meeting:hand-lowered":
          setRaisedHands((prev) => { const n = new Set(prev); n.delete(e.userId); return n })
          break
        case "meeting:reaction":
          if (e.emoji && e.userId) {
            playReaction()
            const uid = e.userId
            const prevTimer = tileReactionTimers.current.get(uid)
            if (prevTimer) clearTimeout(prevTimer)
            setTileReactions((prev) => new Map(prev).set(uid, e.emoji!))
            const t = setTimeout(() => {
              setTileReactions((prev) => { const n = new Map(prev); n.delete(uid); return n })
              tileReactionTimers.current.delete(uid)
            }, 3000)
            tileReactionTimers.current.set(uid, t)
          }
          break
        case "meeting:chat":
          if (e.chatMessage || e.chatImageUrl || e.chatVideoUrl) {
            playChatMessage()
            setChatMessages((prev) => [...prev, {
              id: e.chatMessageId || `${Date.now()}-${e.userId}`,
              userId: e.userId,
              userName: e.userName,
              userAvatar: e.userAvatar,
              message: e.chatMessage || "",
              imageUrl: e.chatImageUrl,
              videoUrl: e.chatVideoUrl,
              timestamp: Date.now(),
            }])
            if (activeTabRef.current !== "chat") setUnreadChat((c) => c + 1)
          }
          break
        case "meeting:poll":
          if (e.pollId && e.pollQuestion && e.pollOptions) {
            setPolls((prev) => [...prev, {
              id: e.pollId!,
              question: e.pollQuestion!,
              options: e.pollOptions!,
              votes: Object.fromEntries(e.pollOptions!.map((_, i) => [String(i), 0])),
              voters: new Set<string>(),
              createdBy: e.userId,
              createdByName: e.userName,
            }])
          }
          break
        case "meeting:poll-vote":
          if (e.pollId && e.pollVotes) {
            setPolls((prev) => prev.map((p) => {
              if (p.id !== e.pollId) return p
              const newVotes = { ...p.votes }
              for (const [key, val] of Object.entries(e.pollVotes!)) {
                newVotes[key] = (newVotes[key] || 0) + val
              }
              const newVoters = new Set(p.voters)
              newVoters.add(e.userId)
              return { ...p, votes: newVotes, voters: newVoters }
            }))
          }
          break
        case "meeting:mute-participant":
          rtkClient.client?.self.disableAudio().catch(() => {})
          setIsMuted(true)
          break
        case "meeting:screen-share-permission":
          break
      }
    }
    window.addEventListener("sse:event", handleSSE)
    return () => window.removeEventListener("sse:event", handleSSE)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  /* ---- RTK event listeners ---- */
  useEffect(() => {
    if (!isJoined) return
    const client = rtkClient.client
    if (!client) return

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const joined = client.participants.joined as any
      const existing: Array<{ id: string; name: string; audioEnabled: boolean; videoEnabled: boolean; screenShareEnabled?: boolean; customParticipantId?: string }> = []
      if (typeof joined.toArray === "function") existing.push(...joined.toArray())
      else if (typeof joined.forEach === "function") joined.forEach((p: (typeof existing)[0]) => existing.push(p))
      else if (typeof joined[Symbol.iterator] === "function") { for (const p of joined) existing.push(p) }

      if (existing.length > 0) {
        const map = new Map<string, { name: string; audioEnabled: boolean; videoEnabled: boolean; userId?: string }>()
        for (const p of existing) {
          map.set(p.id, { name: p.name, audioEnabled: p.audioEnabled, videoEnabled: p.videoEnabled, userId: p.customParticipantId })
          if (p.screenShareEnabled) setScreenSharer({ id: p.id, name: p.name, isLocal: false })
        }
        setRemoteParticipants(map)
      }
    } catch (err) { console.warn("[Meeting] Error populating existing participants:", err) }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleParticipantJoined = (p: any) => {
      setRemoteParticipants((prev) => {
        const next = new Map(prev)
        next.set(p.id, { name: p.name, audioEnabled: p.audioEnabled, videoEnabled: p.videoEnabled, userId: p.customParticipantId })
        return next
      })
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleParticipantLeft = (p: any) => {
      setRemoteParticipants((prev) => { const n = new Map(prev); n.delete(p.id); return n })
      setScreenSharer((prev) => (prev?.id === p.id ? null : prev))
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleAudioUpdate = (p: any) => {
      const audioEnabled = p.audioEnabled ?? true
      setRemoteParticipants((prev) => {
        const ex = prev.get(p.id)
        if (!ex) return new Map(prev).set(p.id, { name: p.name || "Participant", audioEnabled, videoEnabled: false, userId: p.customParticipantId })
        const n = new Map(prev); n.set(p.id, { ...ex, audioEnabled }); return n
      })
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleVideoUpdate = (p: any) => {
      const videoEnabled = p.videoEnabled ?? true
      setRemoteParticipants((prev) => {
        const ex = prev.get(p.id)
        if (!ex) return new Map(prev).set(p.id, { name: p.name || "Participant", audioEnabled: false, videoEnabled, userId: p.customParticipantId })
        const n = new Map(prev); n.set(p.id, { ...ex, videoEnabled }); return n
      })
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleScreenShareUpdate = (p: any) => {
      if (p.screenShareEnabled) { setScreenSharer({ id: p.id, name: p.name, isLocal: false }); playScreenShare() }
      else setScreenSharer((prev) => (prev?.id === p.id ? null : prev))
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleSelfScreenShareUpdate = (payload: any) => {
      if (payload.screenShareEnabled) {
        setIsScreenSharing(true)
        setScreenSharer({ id: client.self.id, name: `${user.firstName} ${user.lastName}`, isLocal: true })
        playScreenShare()
      } else {
        setIsScreenSharing(false)
        setScreenSharer((prev) => (prev?.isLocal ? null : prev))
      }
    }

    rtkClient.on("participantJoined", "participants", handleParticipantJoined)
    rtkClient.on("participantLeft", "participants", handleParticipantLeft)
    rtkClient.on("audioUpdate", "participants", handleAudioUpdate)
    rtkClient.on("videoUpdate", "participants", handleVideoUpdate)
    rtkClient.on("screenShareUpdate", "participants", handleScreenShareUpdate)
    rtkClient.on("screenShareUpdate", "self", handleSelfScreenShareUpdate)

    return () => {
      rtkClient.off("participantJoined", "participants", handleParticipantJoined)
      rtkClient.off("participantLeft", "participants", handleParticipantLeft)
      rtkClient.off("audioUpdate", "participants", handleAudioUpdate)
      rtkClient.off("videoUpdate", "participants", handleVideoUpdate)
      rtkClient.off("screenShareUpdate", "participants", handleScreenShareUpdate)
      rtkClient.off("screenShareUpdate", "self", handleSelfScreenShareUpdate)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isJoined])

  /* ---- HANDLERS ---- */

  const joinRTKAndSetup = useCallback(
    async (authToken: string, meetingId?: string, meetingTitle?: string) => {
      try {
        await rtkClient.init(authToken, { audio: true, video: false })
        await rtkClient.joinRoom()
        setIsJoined(true)
        setSetupMessage(null)
        playMeetingJoined()

        let meeting = activeMeetingRef.current
        if (!meeting && meetingId) {
          const details = await getMeetingDetails(meetingId)
          if (details.success && details.meeting) {
            meeting = details.meeting
            setActiveMeeting(meeting)
            setMeetingStartTime(details.meeting.startedAt ? new Date(details.meeting.startedAt) : new Date())
            if (details.participants) setAdmittedParticipants(details.participants.filter((p) => p.status === "admitted"))
          } else {
            meeting = {
              id: meetingId, title: meetingTitle || "Meeting", hostId: "", hostName: "", hostAvatar: null,
              status: "active", meetingId, participantCount: 1, maxParticipants: 50,
              settings: { allowScreenShare: true, muteOnEntry: true, requireApproval: true, maxParticipants: 50 },
              createdAt: new Date().toISOString(),
            }
            setActiveMeeting(meeting)
            setMeetingStartTime(new Date())
          }
        }

        // Register with the meeting provider for PIP bar / cross-screen persistence
        if (meeting) {
          meetingCtx.registerMeeting({
            meetingId: meeting.id,
            title: meeting.title,
            isHost: meeting.hostId === user.id,
            startTime: meeting.startedAt ? new Date(meeting.startedAt) : new Date(),
            participantCount: meeting.participantCount,
          })
        }
      } catch (err) {
        console.error("[Meeting] Failed to join RTK room:", err)
        setSetupMessage(null)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meetingCtx.registerMeeting, user.id],
  )

  useEffect(() => { joinRTKRef.current = joinRTKAndSetup }, [joinRTKAndSetup])

  /* ---- PIP bar callbacks & muted state sync ---- */
  useEffect(() => {
    if (!activeMeeting || !isJoined) return
    meetingCtx.setMeetingCallbacks({
      onToggleMute: () => {
        const next = !isMuted
        setIsMuted(next)
        if (next) rtkClient.client?.self.disableAudio().catch(() => {})
        else rtkClient.client?.self.enableAudio().catch(() => {})
        meetingCtx.setMeetingMuted(next)
      },
      onEndMeeting: () => handleEndMeeting(),
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMeeting, isJoined, isMuted])

  // Keep PIP bar muted indicator in sync
  useEffect(() => {
    meetingCtx.setMeetingMuted(isMuted)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMuted])

  // Keep participant count in sync with provider
  useEffect(() => {
    if (!activeMeeting) return
    meetingCtx.updateMeeting({ participantCount: remoteParticipants.size + 1 })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteParticipants.size, activeMeeting])

  // When user navigates back to meetings page while RTK is still in room, restore the meeting
  useEffect(() => {
    if (activeMeeting || !meetingCtx.hasActiveMeeting) return
    // RTK client is still connected (module-level singleton persists across navigation)
    if (!rtkClient.isInRoom || !rtkClient.client) return

    const info = meetingCtx.activeMeetingInfo
    if (!info) return

    // Un-minimize since user is back on the meetings page
    meetingCtx.setMinimized(false)

    // Restore meeting state from the provider + DB
    setSetupMessage("Reconnecting...")
    getMeetingDetails(info.meetingId).then((details) => {
      if (details.success && details.meeting) {
        setActiveMeeting(details.meeting)
        setMeetingStartTime(info.startTime)
        setIsJoined(true)
        setSetupMessage(null)
        if (details.participants) {
          setAdmittedParticipants(details.participants.filter((p) => p.status === "admitted"))
        }
      } else {
        // Meeting no longer exists — clean up
        meetingCtx.unregisterMeeting()
        rtkClient.leaveRoom().catch(() => {})
        setSetupMessage(null)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCreate() {
    if (!newTitle.trim()) return
    setIsCreating(true)
    setShowCreate(false)
    setSetupMessage("Setting up your meeting...")
    playMeetingCreating()
    const result = await createMeeting(newTitle.trim())
    if (result.success && result.meeting && result.authToken) {
      setNewTitle("")
      setActiveMeeting(result.meeting)
      setMeetingStartTime(result.meeting.startedAt ? new Date(result.meeting.startedAt) : new Date())
      await joinRTKAndSetup(result.authToken)
    } else setSetupMessage(null)
    setIsCreating(false)
  }

  async function handleJoinByLink(meetingId: string) {
    setSetupMessage("Joining meeting...")
    const result = await joinMeeting(meetingId)
    if (result.success) {
      if (result.requiresApproval) { setSetupMessage(null); setWaitingForApproval(result.meeting?.title || "Meeting"); return }
      if (result.authToken && result.meeting) {
        setActiveMeeting(result.meeting)
        setMeetingStartTime(result.meeting.startedAt ? new Date(result.meeting.startedAt) : new Date())
        await joinRTKAndSetup(result.authToken)
      }
    } else { setSetupMessage(null); console.error("[Meeting] Join failed:", result.error) }
  }

  async function handleRejoin(meeting: MeetingWithDetails) {
    setSetupMessage("Connecting...")
    const result = await joinMeeting(meeting.id)
    if (result.success) {
      if (result.requiresApproval) { setSetupMessage(null); setWaitingForApproval(result.meeting?.title || meeting.title); return }
      if (result.authToken && result.meeting) {
        setActiveMeeting(result.meeting)
        setMeetingStartTime(result.meeting.startedAt ? new Date(result.meeting.startedAt) : new Date())
        await joinRTKAndSetup(result.authToken)
        const details = await getMeetingDetails(meeting.id)
        if (details.success && details.participants) setAdmittedParticipants(details.participants.filter((p) => p.status === "admitted"))
      }
    } else { setSetupMessage(null); console.error("[Meeting] Rejoin failed:", result.error) }
  }

  function resetMeetingState() {
    rtkClient.leaveRoom().catch(() => {})
    meetingCtx.unregisterMeeting()
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
    setTileReactions(new Map())
    tileReactionTimers.current.forEach((t) => clearTimeout(t))
    tileReactionTimers.current.clear()
    setGridPage(0)
    setActiveTab(null)
    setChatMessages([])
    setChatInput("")
    setUnreadChat(0)
    setPolls([])
    setShowCreatePoll(false)
    setMyVotes(new Set())
    setScreenSharePermissions(new Map())
    getMyMeetings().then((r) => { if (r.success && r.meetings) setMeetings(r.meetings) })
    getMeetingHistory().then((r) => { if (r.success && r.meetings) setMeetingHistory(r.meetings) })
  }

  function handleMeetingEnd() {
    const title = activeMeetingRef.current?.title || "Meeting"
    const start = meetingStartTimeRef.current
    let duration = ""
    if (start) {
      const secs = Math.floor((Date.now() - start.getTime()) / 1000)
      const mm = Math.floor(secs / 60)
      const ss = secs % 60
      duration = mm > 0 ? `${mm}m ${ss}s` : `${ss}s`
    }
    playMeetingEnded()
    resetMeetingState()
    setShowMeetingEnded({ title, duration })
  }

  async function handleEndMeeting() {
    if (!activeMeeting) return
    try {
      if (isHost) await endMeetingAction(activeMeeting.id)
      else await leaveMeeting(activeMeeting.id)
    } catch { /* noop */ }
    handleMeetingEnd()
  }

  async function toggleMute() {
    const next = !isMuted
    setIsMuted(next)
    try {
      if (next) await rtkClient.client?.self.disableAudio()
      else await rtkClient.client?.self.enableAudio()
    } catch (e) { console.error("Toggle mute:", e) }
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
          if (localVideoRef.current) rtkClient.client?.self.registerVideoElement(localVideoRef.current, true)
        })
      }
    } catch (e) { console.error("Toggle video:", e) }
  }

  async function toggleScreenShare() {
    try {
      if (isScreenSharing) await rtkClient.client?.self.disableScreenShare()
      else await rtkClient.client?.self.enableScreenShare()
    } catch (e) { console.error("Screen share:", e) }
  }

  function toggleLoudspeaker() {
    setIsLoudspeaker((prev) => {
      const next = !prev
      document.querySelectorAll("audio").forEach((el) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const audioEl = el as any
        if (typeof audioEl.setSinkId === "function") {
          audioEl.setSinkId(next ? "default" : "communications").catch(() => {})
        }
      })
      return next
    })
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
    if (next) playHandRaise()
    await toggleHandRaise(activeMeeting.id, next)
  }

  async function handleReaction(reactionId: string) {
    if (!activeMeeting) return
    setShowReactionPicker(false)
    playReaction()
    const existingTimer = tileReactionTimers.current.get(user.id)
    if (existingTimer) clearTimeout(existingTimer)
    setTileReactions((prev) => new Map(prev).set(user.id, reactionId))
    const timer = setTimeout(() => {
      setTileReactions((prev) => { const n = new Map(prev); n.delete(user.id); return n })
      tileReactionTimers.current.delete(user.id)
    }, 3000)
    tileReactionTimers.current.set(user.id, timer)
    await sendReaction(activeMeeting.id, reactionId)
  }

  function copyMeetingLink() {
    if (!activeMeeting) return
    const link = `${window.location.origin}/dashboard/meetings?join=${activeMeeting.id}`
    navigator.clipboard.writeText(link)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  async function handleKick(userId: string) {
    if (!activeMeeting) return
    await kickParticipant(activeMeeting.id, userId)
  }

  async function handleMuteParticipant(userId: string) {
    if (!activeMeeting) return
    await muteParticipant(activeMeeting.id, userId)
  }

  async function handleToggleScreenSharePerm(userId: string) {
    if (!activeMeeting) return
    const current = screenSharePermissions.get(userId) ?? true
    const next = !current
    setScreenSharePermissions((prev) => new Map(prev).set(userId, next))
    await toggleScreenSharePermission(activeMeeting.id, userId, next)
  }

  async function handleSendChat() {
    if (!activeMeeting || !chatInput.trim()) return
    const msg = chatInput.trim()
    setChatInput("")
    setChatMessages((prev) => [...prev, {
      id: `${Date.now()}-${user.id}`,
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      userAvatar: user.avatarUrl,
      message: msg,
      timestamp: Date.now(),
    }])
    await sendMeetingChat(activeMeeting.id, msg)
  }

  async function handleCreatePoll() {
    if (!activeMeeting || !pollQuestion.trim() || pollOptions.filter((o) => o.trim()).length < 2) return
    const opts = pollOptions.filter((o) => o.trim())
    setPolls((prev) => [...prev, {
      id: `poll-${Date.now()}-local`, question: pollQuestion, options: opts,
      votes: Object.fromEntries(opts.map((_, i) => [String(i), 0])),
      voters: new Set<string>(), createdBy: user.id,
      createdByName: `${user.firstName} ${user.lastName}`,
    }])
    setShowCreatePoll(false)
    const q = pollQuestion
    setPollQuestion("")
    setPollOptions(["", ""])
    await createMeetingPoll(activeMeeting.id, q, opts)
  }

  async function handleVotePoll(pollId: string, optionIndex: number) {
    if (!activeMeeting || myVotes.has(pollId)) return
    setMyVotes((prev) => new Set(prev).add(pollId))
    setPolls((prev) => prev.map((p) => {
      if (p.id !== pollId) return p
      const newVotes = { ...p.votes }
      newVotes[String(optionIndex)] = (newVotes[String(optionIndex)] || 0) + 1
      const newVoters = new Set(p.voters)
      newVoters.add(user.id)
      return { ...p, votes: newVotes, voters: newVoters }
    }))
    await voteMeetingPoll(activeMeeting.id, pollId, optionIndex)
  }

  /* ---- RENDER: MEETING ENDED ---- */

  if (showMeetingEnded) {
    return (
      <MeetingEndedScreen
        meetingTitle={showMeetingEnded.title}
        duration={showMeetingEnded.duration}
        onReturn={() => setShowMeetingEnded(null)}
      />
    )
  }

  /* ---- RENDER: ACTIVE MEETING ---- */

  if (activeMeeting && isJoined && !meetingCtx.isMinimized) {
    const totalParticipants = remoteParticipants.size + 1
    const hasScreenShare = !!screenSharer

    const allGridEntries: Array<{ id: string; isLocal: boolean }> = [
      { id: "local", isLocal: true },
      ...Array.from(remoteParticipants.keys()).map((id) => ({ id, isLocal: false })),
    ]

    type Slide = { type: "screenshare" } | { type: "participants"; entries: typeof allGridEntries }
    const slides: Slide[] = []
    if (hasScreenShare) slides.push({ type: "screenshare" })
    for (let i = 0; i < allGridEntries.length; i += TILES_PER_PAGE) {
      slides.push({ type: "participants", entries: allGridEntries.slice(i, i + TILES_PER_PAGE) })
    }
    const totalSlideCount = slides.length
    const currentSlide = Math.min(gridPage, Math.max(0, totalSlideCount - 1))
    const activeSlide = slides[currentSlide]

    const panelOpen = activeTab !== null

    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-neutral-100 dark:bg-zinc-950 overflow-hidden">
        <style>{"nav.safe-area-bottom { display: none !important; }"}</style>

        {Array.from(remoteParticipants.entries()).map(([id, p]) => (
          <RemoteAudioPlayer key={`audio-${id}`} participantId={id} audioEnabled={p.audioEnabled} />
        ))}

        {/* Top bar */}
        <div className="relative z-10 flex items-center justify-between px-4 py-2 bg-transparent">
          <div className="flex items-center gap-2.5">
            <span className="text-foreground font-semibold text-sm truncate max-w-40">{activeMeeting.title}</span>
            <span className="text-muted-foreground/40">·</span>
            <MeetingTimer startTime={meetingStartTime} />
            <span className="text-muted-foreground/40">·</span>
            <span className="text-muted-foreground text-xs">{totalParticipants}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyMeetingLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground transition-colors border border-border/50"
            >
              <HugeiconsIcon icon={copiedLink ? CheckmarkCircle01Icon : Link01Icon} size={12} />
              {copiedLink ? "Copied!" : "Invite"}
            </button>
            <button
              onClick={() => meetingCtx.setMinimized(true)}
              className="flex items-center justify-center w-8 h-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
              title="Minimize meeting"
            >
              <HugeiconsIcon icon={ArrowShrink02Icon} size={14} />
            </button>
          </div>
        </div>

        {/* Pending admission requests */}
        {isHost && pendingRequests.length > 0 && (
          <div className="relative z-10 px-4 pb-1">
            <div className="flex flex-col gap-1.5">
              {pendingRequests.map((req) => (
                <div key={req.userId} className="flex items-center gap-3 px-4 py-2 rounded-xl bg-amber-500/8 dark:bg-amber-500/6 border border-amber-500/15 animate-in fade-in slide-in-from-top-2 duration-200">
                  <Avatar className="w-7 h-7 shrink-0">
                    {req.avatar && <AvatarImage src={req.avatar} alt={req.name} />}
                    <AvatarFallback className="text-[9px] bg-amber-500/15 text-amber-600 dark:text-amber-400">
                      {req.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-foreground font-medium flex-1 truncate">{req.name} <span className="text-muted-foreground font-normal">wants to join</span></span>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => handleAdmit(req.userId)} className="h-7 px-3 rounded-lg text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors">
                      Admit
                    </button>
                    <button onClick={() => handleDecline(req.userId)} className="h-7 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Video area */}
        <div className="relative flex-1 p-2 md:p-3 overflow-hidden flex flex-col gap-1.5">
          <div className="relative flex-1 flex flex-col gap-2">
            {activeSlide?.type === "screenshare" ? (
              <ScreenShareView participantId={screenSharer!.id} participantName={screenSharer!.name} isLocal={screenSharer!.isLocal} />
            ) : activeSlide?.type === "participants" ? (
              <div className={cn(
                "grid gap-2 md:gap-3 flex-1 auto-rows-fr",
                activeSlide.entries.length <= 1 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2",
              )}>
                {activeSlide.entries.map((entry) =>
                  entry.isLocal ? (
                    <ParticipantTile
                      key="local"
                      name={`${user.firstName} ${user.lastName}`}
                      avatar={user.avatarUrl}
                      isMuted={isMuted}
                      isVideoOff={isVideoOff}
                      isLocal
                      handRaised={myHandRaised}
                      reactionId={tileReactions.get(user.id) || null}
                      videoRef={localVideoRef}
                    />
                  ) : (() => {
                    const participant = remoteParticipants.get(entry.id)!
                    const uid = participant.userId || entry.id
                    return (
                      <RemoteParticipantTile
                        key={entry.id}
                        participantId={entry.id}
                        participant={participant}
                        handRaised={raisedHands.has(uid)}
                        reactionId={tileReactions.get(uid) || null}
                      />
                    )
                  })(),
                )}
              </div>
            ) : null}

            {totalSlideCount > 1 && (
              <>
                <div className="flex gap-1.5 justify-center py-1">
                  {slides.map((slide, i) => (
                    <button key={i} onClick={() => setGridPage(i)}
                      className={cn("h-1.5 rounded-full transition-all duration-200",
                        i === currentSlide ? slide.type === "screenshare" ? "bg-emerald-400 w-4" : "bg-foreground w-4" : "bg-foreground/30 hover:bg-foreground/50 w-1.5")} />
                  ))}
                </div>
              </>
            )}
          </div>


        </div>

        {/* Side panel */}
        {panelOpen && (
          <div className="fixed md:absolute inset-0 md:inset-auto md:top-12 md:right-3 md:bottom-24 z-40 md:w-80 md:rounded-2xl flex flex-col overflow-hidden animate-in slide-in-from-right-4 fade-in duration-200 bg-background/95 backdrop-blur-2xl border border-border/50 dark:border-white/8">
            <div className="flex items-center border-b border-border/40 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] md:pt-2">
              {(["people", "chat", "polls"] as ActiveTab[]).map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={cn("flex-1 py-2.5 text-xs font-semibold capitalize transition-colors relative",
                    activeTab === tab ? "text-foreground" : "text-muted-foreground hover:text-foreground/70")}>
                  {tab}
                  {tab === "chat" && unreadChat > 0 && activeTab !== "chat" && (
                    <span className="absolute top-1.5 right-1/4 w-4 h-4 rounded-full bg-primary text-[9px] flex items-center justify-center text-primary-foreground font-bold">{unreadChat > 9 ? "9+" : unreadChat}</span>
                  )}
                  {activeTab === tab && <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-foreground rounded-full" />}
                </button>
              ))}
              <button onClick={() => setActiveTab(null)} className="w-8 h-8 rounded-full flex items-center justify-center ml-1 hover:bg-muted transition-colors">
                <HugeiconsIcon icon={Cancel01Icon} size={16} className="text-muted-foreground" />
              </button>
            </div>

            {activeTab === "people" && (
              <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">In meeting ({totalParticipants})</p>
                <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-muted/50 transition-colors">
                  <Avatar className="w-8 h-8">
                    {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="You" />}
                    <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">{(user.firstName?.[0] || "") + (user.lastName?.[0] || "")}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-foreground truncate block">{user.firstName} {user.lastName}</span>
                    <span className="text-[10px] text-muted-foreground">{isHost ? "Host · You" : "You"}</span>
                  </div>
                  {myHandRaised && <span className="text-sm leading-none animate-bounce">✋</span>}
                  {isMuted && <HugeiconsIcon icon={MicOff01Icon} size={14} className="text-red-400" />}
                </div>

                {Array.from(remoteParticipants.entries()).map(([id, p]) => {
                  const uid = p.userId || id
                  const isParticipantHost = uid === activeMeeting.hostId
                  return (
                    <div key={id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-muted/50 transition-colors group">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                          {p.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-foreground truncate block">{p.name}</span>
                        {isParticipantHost && <span className="text-[10px] text-muted-foreground">Host</span>}
                      </div>
                      {raisedHands.has(uid) && <span className="text-sm leading-none">✋</span>}
                      {!p.audioEnabled && <HugeiconsIcon icon={MicOff01Icon} size={14} className="text-red-400" />}
                      {isHost && !isParticipantHost && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {p.audioEnabled && (
                            <button onClick={() => handleMuteParticipant(uid)} title="Mute" className="w-7 h-7 rounded-full border border-border/60 flex items-center justify-center hover:bg-muted transition-colors">
                              <HugeiconsIcon icon={MicOff01Icon} size={12} className="text-muted-foreground" />
                            </button>
                          )}
                          <button onClick={() => handleToggleScreenSharePerm(uid)} title={screenSharePermissions.get(uid) === false ? "Allow screen share" : "Revoke screen share"}
                            className={cn("w-7 h-7 rounded-full border flex items-center justify-center hover:bg-muted transition-colors",
                              screenSharePermissions.get(uid) === false ? "border-red-400/40" : "border-border/60")}>
                            <HugeiconsIcon icon={ComputerScreenShareIcon} size={12} className={screenSharePermissions.get(uid) === false ? "text-red-400" : "text-muted-foreground"} />
                          </button>
                          <button onClick={() => handleKick(uid)} title="Remove" className="w-7 h-7 rounded-full border border-red-400/40 flex items-center justify-center hover:bg-red-500/10 transition-colors">
                            <HugeiconsIcon icon={Cancel01Icon} size={12} className="text-red-400" />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}

                {admittedParticipants
                  .filter((p) => p.userId !== user.id && !Array.from(remoteParticipants.values()).some((rp) => rp.name === p.name))
                  .map((p) => (
                    <div key={p.userId} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl opacity-40">
                      <Avatar className="w-8 h-8">
                        {p.avatar && <AvatarImage src={p.avatar} alt={p.name} />}
                        <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">{p.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-muted-foreground flex-1 truncate">{p.name}</span>
                      <span className="text-[10px] text-muted-foreground/60">offline</span>
                    </div>
                  ))}
              </div>
            )}

            {activeTab === "chat" && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {chatMessages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground/40">
                      <HugeiconsIcon icon={BubbleChatIcon} size={32} />
                      <p className="text-xs">No messages yet</p>
                    </div>
                  )}
                  {chatMessages.map((msg) => {
                    const isMe = msg.userId === user.id
                    return (
                      <div key={msg.id} className={cn("flex gap-2", isMe && "flex-row-reverse")}>
                        <Avatar className="w-6 h-6 shrink-0 mt-0.5">
                          {msg.userAvatar && <AvatarImage src={msg.userAvatar} alt={msg.userName} />}
                          <AvatarFallback className="text-[8px] bg-muted text-muted-foreground">
                            {msg.userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className={cn("max-w-[75%]", isMe && "text-right")}>
                          <p className="text-[10px] text-muted-foreground mb-0.5">{isMe ? "You" : msg.userName}</p>
                          {msg.message && (
                            <div className={cn("px-3 py-1.5 rounded-2xl text-sm", isMe ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted text-foreground rounded-tl-sm")}>
                              {msg.message}
                            </div>
                          )}
                          {msg.imageUrl && (
                            <Image src={msg.imageUrl} alt="" width={240} height={180} className="mt-1 rounded-xl max-w-full object-cover" />
                          )}
                          {msg.videoUrl && <video src={msg.videoUrl} controls className="mt-1 rounded-xl max-w-full max-h-48" />}
                        </div>
                      </div>
                    )
                  })}
                  <div ref={chatEndRef} />
                </div>
                <div className="p-3 border-t border-border/40 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-3">
                  <div className="flex gap-2">
                    <Input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendChat()}
                      placeholder="Type a message..."
                      className="flex-1 h-9 text-sm"
                    />
                    <Button onClick={handleSendChat} size="sm" disabled={!chatInput.trim()} className="h-9 px-3">
                      <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "polls" && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {polls.length === 0 && !showCreatePoll && (
                    <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground/40">
                      <HugeiconsIcon icon={ChartColumnIcon} size={32} />
                      <p className="text-xs">No polls yet</p>
                    </div>
                  )}
                  {polls.map((poll) => {
                    const totalVotes = Object.values(poll.votes).reduce((a, b) => a + b, 0)
                    const hasVoted = myVotes.has(poll.id)
                    return (
                      <div key={poll.id} className="rounded-xl border border-border/60 p-3 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">{poll.question}</p>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{totalVotes} vote{totalVotes !== 1 ? "s" : ""}</span>
                        </div>
                        <div className="space-y-1.5">
                          {poll.options.map((opt, i) => {
                            const count = poll.votes[String(i)] || 0
                            const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
                            return (
                              <button
                                key={i}
                                disabled={hasVoted}
                                onClick={() => handleVotePoll(poll.id, i)}
                                className={cn(
                                  "relative w-full text-left px-3 py-2 rounded-lg border transition-all overflow-hidden",
                                  hasVoted ? "border-border/40 cursor-default" : "border-border/60 hover:border-primary/40 cursor-pointer",
                                )}
                              >
                                {hasVoted && (
                                  <div className="absolute inset-y-0 left-0 bg-primary/10 transition-all duration-500" style={{ width: `${pct}%` }} />
                                )}
                                <div className="relative flex items-center justify-between">
                                  <span className="text-xs text-foreground">{opt}</span>
                                  {hasVoted && <span className="text-[10px] font-medium text-muted-foreground">{pct}%</span>}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                        <p className="text-[10px] text-muted-foreground/60">by {poll.createdByName}</p>
                      </div>
                    )
                  })}
                  {showCreatePoll && (
                    <div className="rounded-xl border border-primary/30 p-3 space-y-3">
                      <Input value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} placeholder="Poll question..." className="h-9 text-sm" autoFocus />
                      {pollOptions.map((opt, i) => (
                        <div key={i} className="flex gap-2">
                          <Input
                            value={opt}
                            onChange={(e) => {
                              const next = [...pollOptions]
                              next[i] = e.target.value
                              setPollOptions(next)
                            }}
                            placeholder={`Option ${i + 1}`}
                            className="h-8 text-xs flex-1"
                          />
                          {pollOptions.length > 2 && (
                            <button onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))} className="w-8 h-8 rounded-full border border-border/40 flex items-center justify-center hover:bg-muted">
                              <HugeiconsIcon icon={Cancel01Icon} size={10} className="text-muted-foreground" />
                            </button>
                          )}
                        </div>
                      ))}
                      {pollOptions.length < 6 && (
                        <button onClick={() => setPollOptions([...pollOptions, ""])} className="text-xs text-primary hover:underline">
                          + Add option
                        </button>
                      )}
                      <div className="flex gap-2">
                        <Button onClick={handleCreatePoll} size="sm" disabled={!pollQuestion.trim() || pollOptions.filter((o) => o.trim()).length < 2} className="flex-1 h-8 text-xs">
                          Create Poll
                        </Button>
                        <Button onClick={() => setShowCreatePoll(false)} variant="outline" size="sm" className="h-8 text-xs">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                {!showCreatePoll && (
                  <div className="p-3 border-t border-border/40 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-3">
                    <Button onClick={() => setShowCreatePoll(true)} variant="outline" size="sm" className="w-full h-9 gap-1.5 text-xs">
                      <HugeiconsIcon icon={Add01Icon} size={12} />
                      Create Poll
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Bottom controls dock */}
        <div className="absolute bottom-0 left-0 right-0 z-30 flex flex-col items-center pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-4 px-2 md:px-3 pointer-events-none gap-2">

          {/* Mobile reaction picker — stacked above controls */}
          {isMobile && showReactionPicker && (
            <div className="pointer-events-auto rounded-2xl animate-in fade-in zoom-in-95 duration-150 bg-white/8 dark:bg-white/6 backdrop-blur-2xl border border-white/10 dark:border-white/8 shadow-2xl shadow-black/20 p-2">
              <div className="flex items-center gap-1.5">
                {REACTIONS.map((r) => (
                  <button key={r.id} onClick={() => handleReaction(r.id)}
                    className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/10 active:bg-white/20 transition-colors active:scale-95"
                    title={r.label}>
                    <span className="text-xl leading-none">{r.emoji}</span>
                  </button>
                ))}
                <button
                  onClick={() => setShowReactionPicker(false)}
                  className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors ml-0.5"
                  title="Close"
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={14} className="text-foreground/70" />
                </button>
              </div>
            </div>
          )}

          {/* Mobile secondary controls row */}
          <div className="pointer-events-auto md:hidden flex items-center gap-0.5 px-2 py-1.5 rounded-2xl bg-white/8 dark:bg-white/6 backdrop-blur-2xl border border-white/10 dark:border-white/8 shadow-2xl shadow-black/20">
            <button onClick={handleToggleHand} className="flex flex-col items-center px-2.5">
              <div className={cn("w-9 h-9 rounded-full flex items-center justify-center transition-all",
                myHandRaised ? "bg-amber-500/20" : "bg-transparent")}>
                <span className={cn("text-base leading-none transition-transform", myHandRaised && "animate-bounce")}>✋</span>
              </div>
            </button>

            <button onClick={() => setShowReactionPicker(!showReactionPicker)} className="flex flex-col items-center px-2.5">
              <div className={cn("w-9 h-9 rounded-full flex items-center justify-center transition-all",
                showReactionPicker ? "bg-foreground/90" : "bg-transparent")}>
                <span className="text-base leading-none">😊</span>
              </div>
            </button>

            <button onClick={() => setActiveTab(activeTab === "people" ? null : "people")} className="flex flex-col items-center px-2.5 relative">
              <div className={cn("w-9 h-9 rounded-full flex items-center justify-center transition-all",
                activeTab === "people" ? "bg-foreground/90" : "bg-transparent")}>
                <HugeiconsIcon icon={UserGroupIcon} size={16} className={activeTab === "people" ? "text-background" : "text-foreground"} />
              </div>
              {pendingRequests.length > 0 && (
                <span className="absolute -top-0.5 right-0 w-4 h-4 rounded-full bg-amber-500 text-[9px] flex items-center justify-center text-white font-bold">{pendingRequests.length}</span>
              )}
            </button>

            <button onClick={() => { setActiveTab(activeTab === "chat" ? null : "chat"); setUnreadChat(0) }} className="flex flex-col items-center px-2.5 relative">
              <div className={cn("w-9 h-9 rounded-full flex items-center justify-center transition-all",
                activeTab === "chat" ? "bg-foreground/90" : "bg-transparent")}>
                <HugeiconsIcon icon={BubbleChatIcon} size={16} className={activeTab === "chat" ? "text-background" : "text-foreground"} />
              </div>
              {unreadChat > 0 && activeTab !== "chat" && (
                <span className="absolute -top-0.5 right-0 w-4 h-4 rounded-full bg-primary text-[9px] flex items-center justify-center text-primary-foreground font-bold">{unreadChat > 9 ? "9+" : unreadChat}</span>
              )}
            </button>

            <button onClick={() => setActiveTab(activeTab === "polls" ? null : "polls")} className="flex flex-col items-center px-2.5">
              <div className={cn("w-9 h-9 rounded-full flex items-center justify-center transition-all",
                activeTab === "polls" ? "bg-foreground/90" : "bg-transparent")}>
                <HugeiconsIcon icon={ChartColumnIcon} size={16} className={activeTab === "polls" ? "text-background" : "text-foreground"} />
              </div>
            </button>
          </div>

          {/* Primary controls row */}
          <div className="pointer-events-auto flex items-center gap-0.5 md:gap-1 px-1.5 md:px-2.5 py-1.5 md:py-2 rounded-2xl bg-white/8 dark:bg-white/6 backdrop-blur-2xl border border-white/10 dark:border-white/8 shadow-2xl shadow-black/20">
            <button onClick={toggleMute} className="flex flex-col items-center gap-0.5 px-1 md:px-2 shrink-0">
              <div className={cn("w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all",
                isMuted ? "bg-foreground/90" : "bg-transparent")}>
                <HugeiconsIcon icon={isMuted ? MicOff01Icon : Mic01Icon} size={16} className={cn("md:w-4.5! md:h-4.5!", isMuted ? "text-background" : "text-foreground")} />
              </div>
              <span className="text-[9px] text-muted-foreground font-medium hidden md:block">{isMuted ? "Unmute" : "Mute"}</span>
            </button>

            <button onClick={toggleVideo} className="flex flex-col items-center gap-0.5 px-1 md:px-2 shrink-0">
              <div className={cn("w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all",
                isVideoOff ? "bg-foreground/90" : "bg-transparent")}>
                <HugeiconsIcon icon={isVideoOff ? VideoOffIcon : Video01Icon} size={16} className={cn("md:w-4.5! md:h-4.5!", isVideoOff ? "text-background" : "text-foreground")} />
              </div>
              <span className="text-[9px] text-muted-foreground font-medium hidden md:block">{isVideoOff ? "Start" : "Stop"}</span>
            </button>

            {!isMobile && (
              <button onClick={toggleScreenShare} disabled={!!screenSharer && !isScreenSharing}
                className="flex flex-col items-center gap-0.5 px-2 disabled:opacity-30 shrink-0">
                <div className={cn("w-11 h-11 rounded-full flex items-center justify-center transition-all",
                  isScreenSharing ? "bg-foreground/90" : "bg-transparent")}>
                  <HugeiconsIcon icon={ComputerScreenShareIcon} size={18} className={isScreenSharing ? "text-background" : "text-foreground"} />
                </div>
                <span className="text-[9px] text-muted-foreground font-medium">Share</span>
              </button>
            )}

            {isMobile && (
              <button onClick={toggleLoudspeaker} className="flex flex-col items-center gap-0.5 px-1 shrink-0">
                <div className={cn("w-9 h-9 rounded-full flex items-center justify-center transition-all",
                  isLoudspeaker ? "bg-foreground/90" : "bg-transparent")}>
                  <HugeiconsIcon icon={VolumeHighIcon} size={16} className={isLoudspeaker ? "text-background" : "text-foreground"} />
                </div>
              </button>
            )}

            {isMobile && (
              <button onClick={toggleScreenShare} disabled={!!screenSharer && !isScreenSharing}
                className="flex flex-col items-center gap-0.5 px-1 disabled:opacity-30 shrink-0">
                <div className={cn("w-9 h-9 rounded-full flex items-center justify-center transition-all",
                  isScreenSharing ? "bg-foreground/90" : "bg-transparent")}>
                  <HugeiconsIcon icon={ComputerScreenShareIcon} size={16} className={isScreenSharing ? "text-background" : "text-foreground"} />
                </div>
              </button>
            )}

            <div className="w-px h-6 md:h-8 bg-white/10 dark:bg-white/6 mx-0.5 shrink-0 hidden md:block" />

            {/* Desktop: secondary controls inline */}
            <button onClick={handleToggleHand} className="hidden md:flex flex-col items-center gap-0.5 px-2 shrink-0">
              <div className={cn("w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all",
                myHandRaised ? "bg-amber-500/20" : "bg-transparent")}>
                <span className={cn("text-base md:text-lg leading-none transition-transform", myHandRaised && "animate-bounce")}>✋</span>
              </div>
              <span className="text-[9px] text-muted-foreground font-medium hidden md:block">{myHandRaised ? "Lower" : "Raise"}</span>
            </button>

            <div className="relative shrink-0 hidden md:block">
              <button onClick={() => setShowReactionPicker(!showReactionPicker)} className="flex flex-col items-center gap-0.5 px-2">
                <div className="w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center bg-transparent">
                  <span className="text-base md:text-lg leading-none">😊</span>
                </div>
                <span className="text-[9px] text-muted-foreground font-medium hidden md:block">React</span>
              </button>
              {showReactionPicker && (
                <div className="absolute bottom-16 left-1/2 -translate-x-1/2 rounded-2xl animate-in fade-in zoom-in-95 duration-150 bg-background/95 backdrop-blur-xl border border-border dark:border-white/10 shadow-lg p-2">
                  <div className="flex gap-1">
                    {REACTIONS.map((r) => (
                      <button key={r.id} onClick={() => handleReaction(r.id)}
                        className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-muted transition-colors hover:scale-110 active:scale-95"
                        title={r.label}>
                        <span className="text-xl leading-none">{r.emoji}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="w-px h-8 bg-white/10 dark:bg-white/6 mx-0.5 shrink-0 hidden md:block" />

            <button onClick={() => setActiveTab(activeTab === "people" ? null : "people")} className="hidden md:flex flex-col items-center gap-0.5 px-2 relative shrink-0">
              <div className={cn("w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all",
                activeTab === "people" ? "bg-foreground/90" : "bg-transparent")}>
                <HugeiconsIcon icon={UserGroupIcon} size={16} className={cn("md:w-4.5! md:h-4.5!", activeTab === "people" ? "text-background" : "text-foreground")} />
              </div>
              {pendingRequests.length > 0 && (
                <span className="absolute -top-0.5 right-0 w-4 h-4 rounded-full bg-amber-500 text-[9px] flex items-center justify-center text-white font-bold">{pendingRequests.length}</span>
              )}
              <span className="text-[9px] text-muted-foreground font-medium hidden md:block">People</span>
            </button>

            <button onClick={() => { setActiveTab(activeTab === "chat" ? null : "chat"); setUnreadChat(0) }} className="hidden md:flex flex-col items-center gap-0.5 px-2 relative shrink-0">
              <div className={cn("w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all",
                activeTab === "chat" ? "bg-foreground/90" : "bg-transparent")}>
                <HugeiconsIcon icon={BubbleChatIcon} size={16} className={cn("md:w-4.5! md:h-4.5!", activeTab === "chat" ? "text-background" : "text-foreground")} />
              </div>
              {unreadChat > 0 && activeTab !== "chat" && (
                <span className="absolute -top-0.5 right-0 w-4 h-4 rounded-full bg-primary text-[9px] flex items-center justify-center text-primary-foreground font-bold">{unreadChat > 9 ? "9+" : unreadChat}</span>
              )}
              <span className="text-[9px] text-muted-foreground font-medium hidden md:block">Chat</span>
            </button>

            <button onClick={() => setActiveTab(activeTab === "polls" ? null : "polls")} className="hidden md:flex flex-col items-center gap-0.5 px-2 shrink-0">
              <div className={cn("w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all",
                activeTab === "polls" ? "bg-foreground/90" : "bg-transparent")}>
                <HugeiconsIcon icon={ChartColumnIcon} size={16} className={cn("md:w-4.5! md:h-4.5!", activeTab === "polls" ? "text-background" : "text-foreground")} />
              </div>
              <span className="text-[9px] text-muted-foreground font-medium hidden md:block">Polls</span>
            </button>

            <div className="w-px h-6 md:h-8 bg-white/10 dark:bg-white/6 mx-0.5 shrink-0" />

            <button onClick={handleEndMeeting} className="flex flex-col items-center gap-0.5 px-1 md:px-2 shrink-0">
              <div className="w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center bg-red-500/85">
                <HugeiconsIcon icon={CallEnd01Icon} size={18} className="text-white" />
              </div>
              <span className="text-[9px] text-muted-foreground font-medium hidden md:block">{isHost ? "End" : "Leave"}</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ---- RENDER: LOBBY ---- */

  function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`
    const mins = Math.floor(seconds / 60)
    const hrs = Math.floor(mins / 60)
    if (hrs > 0) return `${hrs}h ${mins % 60}m`
    return `${mins}m`
  }

  function formatTimeAgo(date: string): string {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return "Just now"
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d ago`
    return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" })
  }

  return (
    <div className="relative flex flex-col h-dvh min-h-0">
      {setupMessage && <SetupOverlay message={setupMessage} />}
      {waitingForApproval && <WaitingRoom meetingTitle={waitingForApproval} onCancel={() => setWaitingForApproval(null)} />}

      <Topbar title="Meetings" />

      {/* Return-to-meeting banner when minimized */}
      {activeMeeting && isJoined && meetingCtx.isMinimized && (
        <div className="px-4 pt-2">
          <button
            onClick={() => meetingCtx.setMinimized(false)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15 transition-colors"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
              <HugeiconsIcon icon={Video01Icon} size={16} className="text-emerald-500" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <span className="text-sm font-medium text-foreground truncate block">{activeMeeting.title}</span>
              <span className="text-xs text-emerald-600 dark:text-emerald-400">Tap to return to meeting</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <MeetingTimer startTime={meetingStartTime} />
            </div>
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Active Meetings</h2>
                <Button onClick={() => setShowCreate(true)} size="sm" className="gap-1.5">
                  <HugeiconsIcon icon={Add01Icon} size={14} />
                  New
                </Button>
              </div>

              {isLoadingMeetings ? (
                <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
              ) : meetings.length === 0 ? (
                <div className="rounded-xl border border-dashed bg-muted/30 p-8 text-center">
                  <div className="relative w-36 h-36 mx-auto mb-3">
                    <Image src="/user/dashboard/no-meeting-yet.png" alt="No meetings yet" fill className="object-contain" priority />
                  </div>
                  <h3 className="font-semibold text-sm mb-1">No active meetings</h3>
                  <p className="text-xs text-muted-foreground mb-4 max-w-xs mx-auto leading-relaxed">Create a meeting to start a video call with screen sharing.</p>
                  <Button onClick={() => setShowCreate(true)} size="sm" variant="outline" className="gap-1.5">
                    <HugeiconsIcon icon={Add01Icon} size={14} />
                    Create Meeting
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {meetings.map((meeting) => (
                    <div key={meeting.id} className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-accent/50 transition-colors cursor-pointer group" onClick={() => handleRejoin(meeting)}>
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                        meeting.status === "active" ? "bg-emerald-500/12 group-hover:bg-emerald-500/20" : "bg-primary/8 group-hover:bg-primary/12")}>
                        <HugeiconsIcon icon={Video01Icon} size={18} className={meeting.status === "active" ? "text-emerald-500" : "text-primary/60"} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm truncate">{meeting.title}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">{meeting.hostId === user.id ? "Hosted by you" : `Hosted by ${meeting.hostName}`}</span>
                          <span className="text-muted-foreground/40 text-xs">&middot;</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1"><HugeiconsIcon icon={UserGroupIcon} size={11} />{meeting.participantCount}</span>
                        </div>
                      </div>
                      <Badge variant={meeting.status === "active" ? "default" : "secondary"} className={cn("text-[10px] px-2 gap-1", meeting.status === "active" && "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-400")}>
                        {meeting.status === "active" && (
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                          </span>
                        )}
                        {meeting.status === "active" ? "Live" : meeting.status === "waiting" ? "Waiting" : meeting.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              <JoinByIdSection onJoin={handleJoinByLink} />
            </div>

            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <HugeiconsIcon icon={Clock01Icon} size={14} />
                History
              </h2>

              {isLoadingHistory ? (
                <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
              ) : meetingHistory.length === 0 ? (
                <div className="rounded-xl border border-dashed bg-muted/30 p-6 text-center">
                  <HugeiconsIcon icon={Clock01Icon} size={24} className="text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Completed meetings will appear here</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[calc(100dvh-14rem)] overflow-y-auto">
                  {meetingHistory.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card/50 hover:bg-accent/30 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                        <HugeiconsIcon icon={Video01Icon} size={14} className="text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate leading-tight">{entry.title}</p>
                        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-0.5"><HugeiconsIcon icon={UserGroupIcon} size={10} />{entry.participantCount}</span>
                          {entry.duration != null && entry.duration > 0 && (<><span className="text-muted-foreground/30">&middot;</span><span>{formatDuration(entry.duration)}</span></>)}
                          <span className="text-muted-foreground/30">&middot;</span>
                          <span>{entry.wasHost ? "You hosted" : entry.hostName}</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground/60 shrink-0 mt-0.5">{formatTimeAgo(entry.endedAt ?? entry.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ResponsiveModal open={showCreate} onOpenChange={setShowCreate}>
        <ResponsiveModalContent className="sm:max-w-md">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <HugeiconsIcon icon={Video01Icon} size={16} className="text-primary" />
              </div>
              New Meeting
            </ResponsiveModalTitle>
            <p className="text-sm text-muted-foreground">Create a meeting room and invite others with a link.</p>
          </ResponsiveModalHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Meeting name</label>
              <Input placeholder="e.g. Weekly standup, Study group..." value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreate()} className="h-11" autoFocus />
            </div>
            <Button onClick={handleCreate} disabled={!newTitle.trim() || isCreating} className="w-full gap-2 h-11">
              {isCreating ? (<><HugeiconsIcon icon={Loading03Icon} size={16} className="animate-spin" />Creating...</>) : (<><HugeiconsIcon icon={Video01Icon} size={16} />Create &amp; Join</>)}
            </Button>
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </div>
  )
}

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
        <Button onClick={handleJoin} disabled={!meetingId.trim() || isJoining} size="sm">
          {isJoining ? "Joining..." : "Join"}
        </Button>
      </div>
    </div>
  )
}
