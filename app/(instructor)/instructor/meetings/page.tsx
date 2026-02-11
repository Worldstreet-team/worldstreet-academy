"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Link01Icon,
  ArrowShrink02Icon,
} from "@hugeicons/core-free-icons"
import { Topbar } from "@/components/platform/topbar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
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
  getMeetingHistory as fetchMeetingHistory,
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
  deleteMeetingHistory,
  inviteToStage,
  removeFromStage,
  requestStage,
  declineStageRequest,
  acceptStageRequest,
  createCourseMeeting,
  getInstructorCoursesForMeeting,
  type MeetingWithDetails,
  type MeetingParticipantDetails,
  type MeetingHistoryEntry,
  type MeetingRole,
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
import {
  MeetingTimer,
  ParticipantTile,
  RemoteAudioPlayer,
  RemoteParticipantTile,
  ScreenShareView,
  SetupOverlay,
  WaitingRoom,
  MeetingEndedScreen,
  MeetingSidePanel,
  MeetingControls,
  CreateMeetingModal,
  MeetingQuickActions,
  ActiveMeetingsList,
  MeetingHistory,
  ReturnToMeetingBanner,
} from "@/components/meetings"
import type { ActiveTab, ChatMessage, Poll, PollVoter } from "@/components/meetings"
import {
  InstructorInviteDialog,
  CourseMeetingCards,
  CreateCourseMeetingModal,
  type CourseSummary,
} from "@/components/meetings/instructor-meeting-extras"

/**
 * Instructor Meetings Page
 *
 * Same meeting functionality as the student/platform page but lives under
 * the /instructor route group. The meeting join link uses the instructor
 * path so PiP navigation returns to this page instead of /dashboard/meetings.
 */

const TILES_PER_PAGE = 4
const MEETINGS_PATH = "/instructor/meetings"

type ScreenSharer = { id: string; name: string; isLocal: boolean }

export default function InstructorMeetingsPage() {
  const user = useUser()
  const searchParams = useSearchParams()
  const router = useRouter()
  const meetingCtx = useMeeting()

  /* ── STATE ── */

  const [meetings, setMeetings] = useState<MeetingWithDetails[]>([])
  const [isLoadingMeetings, setIsLoadingMeetings] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
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

  const [polls, setPolls] = useState<Poll[]>([])
  const [showCreatePoll, setShowCreatePoll] = useState(false)
  const [pollQuestion, setPollQuestion] = useState("")
  const [pollOptions, setPollOptions] = useState(["", ""])
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set())

  const [isLoudspeaker, setIsLoudspeaker] = useState(true)
  const [screenSharePermissions, setScreenSharePermissions] = useState<Map<string, boolean>>(new Map())
  const [showMeetingEnded, setShowMeetingEnded] = useState<{ title: string; duration: string } | null>(null)
  const [isEndingMeeting, setIsEndingMeeting] = useState(false)
  const hasEndedRef = useRef(false)

  // Guest / stage system
  const [myRole, setMyRole] = useState<MeetingRole>("participant")
  const [participantRoles, setParticipantRoles] = useState<Map<string, string>>(new Map())
  const [stageRequests, setStageRequests] = useState<Array<{ userId: string; userName: string; userAvatar: string | null }>>([])
  const [hasRequestedStage, setHasRequestedStage] = useState(false)

  // Speaking levels
  const [speakingLevels, setSpeakingLevels] = useState<Map<string, number>>(new Map())
  const [mySpeakingLevel, setMySpeakingLevel] = useState(0)

  // Multi-tab detection
  const [tabConflict, setTabConflict] = useState<string | null>(null)
  const tabChannelRef = useRef<BroadcastChannel | null>(null)
  const tabIdRef = useRef<string>(Math.random().toString(36).slice(2))

  const [isMobile, setIsMobile] = useState(false)

  // Course-linked meetings
  const [instructorCourses, setInstructorCourses] = useState<CourseSummary[]>([])
  const [isLoadingCourses, setIsLoadingCourses] = useState(true)
  const [showCourseMeetingModal, setShowCourseMeetingModal] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState<CourseSummary | null>(null)
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  useEffect(() => {
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent))
  }, [])

  // Multi-tab detection: prevent joining same meeting in multiple tabs
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return
    const channel = new BroadcastChannel("meeting-tab-sync")
    tabChannelRef.current = channel

    channel.onmessage = (event) => {
      const { type, meetingId, tabId, userId: msgUserId } = event.data || {}
      
      // Another tab is checking if we're in a meeting
      if (type === "check" && tabId !== tabIdRef.current) {
        if (activeMeetingRef.current && msgUserId === user.id) {
          channel.postMessage({
            type: "occupied",
            meetingId: activeMeetingRef.current.id,
            tabId: tabIdRef.current,
          })
        }
      }
      
      // Another tab responded that they're in a meeting
      if (type === "occupied" && tabId !== tabIdRef.current && meetingId) {
        setTabConflict(meetingId)
      }
      
      // Another tab left the meeting
      if (type === "left" && tabId !== tabIdRef.current) {
        setTabConflict(null)
      }
    }

    return () => {
      channel.close()
      tabChannelRef.current = null
    }
  }, [user.id])

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
  const myRoleRef = useRef(myRole)
  myRoleRef.current = myRole
  const joinRTKRef = useRef<(authToken: string, meetingId?: string, meetingTitle?: string) => Promise<void>>(async () => {})

  /* ── EFFECTS ── */

  useEffect(() => {
    let cancelled = false
    getMyMeetings().then((r) => {
      if (cancelled) return
      if (r.success && r.meetings) setMeetings(r.meetings)
      setIsLoadingMeetings(false)
    })
    fetchMeetingHistory().then((r) => {
      if (cancelled) return
      if (r.success && r.meetings) setMeetingHistory(r.meetings)
      setIsLoadingHistory(false)
    })
    getInstructorCoursesForMeeting().then((r) => {
      if (cancelled) return
      if (r.success && r.courses) setInstructorCourses(r.courses)
      setIsLoadingCourses(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (activeMeeting) return
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    function handleMeetingListEvent(evt: Event) {
      const e = (evt as CustomEvent).detail as MeetingEventPayload & { type: string }
      if (!e?.type?.startsWith("meeting:")) return
      const refreshEvents = [
        "meeting:ended",
        "meeting:participant-joined",
        "meeting:participant-left",
        "meeting:admitted",
      ]
      if (refreshEvents.includes(e.type)) {
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
          getMyMeetings().then((r) => {
            if (r.success && r.meetings) setMeetings(r.meetings)
          })
          fetchMeetingHistory().then((r) => {
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
    router.replace(MEETINGS_PATH, { scroll: false })
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
  useEffect(() => {
    setGridPage(0)
  }, [isScreenShareActive])

  useEffect(() => {
    const participantPages = Math.ceil((remoteParticipants.size + 1) / TILES_PER_PAGE)
    const totalSlides = (screenSharer ? 1 : 0) + participantPages
    const maxPage = Math.max(0, totalSlides - 1)
    setGridPage((prev) => Math.min(prev, maxPage))
  }, [remoteParticipants.size, screenSharer])

  useEffect(() => {
    if (activeTab === "chat") setUnreadChat(0)
  }, [chatMessages.length, activeTab])

  /* ── SSE listener ── */
  useEffect(() => {
    function handleSSE(evt: Event) {
      const e = (evt as CustomEvent).detail as MeetingEventPayload & { type: string }
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
          if (activeMeetingRef.current && !hasEndedRef.current) handleMeetingEnd()
          break
        case "meeting:kicked":
          if (activeMeetingRef.current && !hasEndedRef.current) handleMeetingEnd()
          break
        case "meeting:hand-raised":
          setRaisedHands((prev) => new Set(prev).add(e.userId))
          playHandRaise()
          break
        case "meeting:hand-lowered":
          setRaisedHands((prev) => {
            const n = new Set(prev)
            n.delete(e.userId)
            return n
          })
          break
        case "meeting:reaction":
          if (e.emoji && e.userId) {
            playReaction()
            const uid = e.userId
            const prevTimer = tileReactionTimers.current.get(uid)
            if (prevTimer) clearTimeout(prevTimer)
            setTileReactions((prev) => new Map(prev).set(uid, e.emoji!))
            const t = setTimeout(() => {
              setTileReactions((prev) => {
                const n = new Map(prev)
                n.delete(uid)
                return n
              })
              tileReactionTimers.current.delete(uid)
            }, 3000)
            tileReactionTimers.current.set(uid, t)
          }
          break
        case "meeting:chat":
          if (e.chatMessage || e.chatImageUrl || e.chatVideoUrl) {
            playChatMessage()
            setChatMessages((prev) => [
              ...prev,
              {
                id: e.chatMessageId || `${Date.now()}-${e.userId}`,
                userId: e.userId,
                userName: e.userName,
                userAvatar: e.userAvatar,
                message: e.chatMessage || "",
                imageUrl: e.chatImageUrl,
                videoUrl: e.chatVideoUrl,
                timestamp: Date.now(),
              },
            ])
            if (activeTabRef.current !== "chat") setUnreadChat((c) => c + 1)
          }
          break
        case "meeting:poll":
          if (e.pollId && e.pollQuestion && e.pollOptions) {
            setPolls((prev) => [
              ...prev,
              {
                id: e.pollId!,
                question: e.pollQuestion!,
                options: e.pollOptions!,
                votes: Object.fromEntries(e.pollOptions!.map((_, i) => [String(i), 0])),
                voters: new Set<string>(),
                voterDetails: {},
                createdBy: e.userId,
                createdByName: e.userName,
              },
            ])
          }
          break
        case "meeting:poll-vote":
          if (e.pollId && e.pollVotes && e.optionIndex !== undefined) {
            setPolls((prev) =>
              prev.map((p) => {
                if (p.id !== e.pollId) return p
                const newVotes = { ...p.votes }
                for (const [key, val] of Object.entries(e.pollVotes!))
                  newVotes[key] = (newVotes[key] || 0) + val
                const newVoters = new Set(p.voters)
                newVoters.add(e.userId)
                
                // Add voter details for the specific option
                const newVoterDetails = { ...p.voterDetails }
                const optionKey = String(e.optionIndex)
                if (!newVoterDetails[optionKey]) {
                  newVoterDetails[optionKey] = []
                }
                // Only add if not already present
                if (!newVoterDetails[optionKey].some(v => v.userId === e.userId)) {
                  newVoterDetails[optionKey] = [
                    ...newVoterDetails[optionKey],
                    {
                      userId: e.userId,
                      userName: e.userName,
                      userAvatar: e.userAvatar,
                    }
                  ]
                }
                
                return { ...p, votes: newVotes, voters: newVoters, voterDetails: newVoterDetails }
              })
            )
          }
          break
        case "meeting:mute-participant": {
          const muteType = (e as MeetingEventPayload & { muteType?: string }).muteType || "audio"
          if (muteType === "audio") {
            rtkClient.client?.self.disableAudio().catch(() => {})
            setIsMuted(true)
          } else if (muteType === "video") {
            rtkClient.client?.self.disableVideo().catch(() => {})
            setIsVideoOff(true)
          } else if (muteType === "screenshare") {
            rtkClient.client?.self.disableScreenShare().catch(() => {})
            setIsScreenSharing(false)
            setScreenSharer((prev) => (prev?.isLocal ? null : prev))
          }
          break
        }
        case "meeting:screen-share-permission": {
          const allowed = (e as MeetingEventPayload & { canScreenShare?: boolean }).canScreenShare
          if (allowed === false) {
            rtkClient.client?.self.disableScreenShare().catch(() => {})
            setIsScreenSharing(false)
            setScreenSharer((prev) => (prev?.isLocal ? null : prev))
          }
          break
        }
        case "meeting:stage-request":
          setStageRequests((prev) => {
            if (prev.some((r) => r.userId === e.userId)) return prev
            return [...prev, { userId: e.userId, userName: e.userName, userAvatar: e.userAvatar }]
          })
          break
        case "meeting:stage-request-declined":
          // Guest receives notification that their request was declined
          if (e.userId === user.id) {
            setHasRequestedStage(false)
          }
          break
        case "meeting:stage-request-accepted":
          // Guest receives notification that their request was accepted (role-changed also fires)
          if (e.userId === user.id) {
            setHasRequestedStage(false)
          }
          break
        case "meeting:role-changed": {
          const newRole = (e as MeetingEventPayload & { role?: string }).role
          if (!newRole) break
          if (e.userId === user.id) {
            setMyRole(newRole as MeetingRole)
            setHasRequestedStage(false)
            if (newRole === "guest") {
              rtkClient.client?.self.disableAudio().catch(() => {})
              rtkClient.client?.self.disableVideo().catch(() => {})
              rtkClient.client?.self.disableScreenShare().catch(() => {})
              setIsMuted(true)
              setIsVideoOff(true)
              setIsScreenSharing(false)
              setScreenSharer((prev) => (prev?.isLocal ? null : prev))
            }
          }
          setParticipantRoles((prev) => {
            const next = new Map(prev)
            next.set(e.userId, newRole)
            return next
          })
          if (newRole === "participant") {
            setStageRequests((prev) => prev.filter((r) => r.userId !== e.userId))
          }
          break
        }
        case "meeting:participant-joined": {
          const joinRole = (e as MeetingEventPayload & { role?: string }).role
          if (joinRole) {
            setParticipantRoles((prev) => {
              const next = new Map(prev)
              next.set(e.userId, joinRole)
              return next
            })
          }
          break
        }
        case "meeting:speaking": {
          const level = (e as MeetingEventPayload & { speakingLevel?: number }).speakingLevel ?? 0
          setSpeakingLevels((prev) => {
            const next = new Map(prev)
            next.set(e.userId, level)
            return next
          })
          break
        }
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

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const joined = client.participants.joined as any
      const existing: Array<{
        id: string
        name: string
        audioEnabled: boolean
        videoEnabled: boolean
        screenShareEnabled?: boolean
        customParticipantId?: string
      }> = []
      if (typeof joined.toArray === "function") existing.push(...joined.toArray())
      else if (typeof joined.forEach === "function")
        joined.forEach((p: (typeof existing)[0]) => existing.push(p))
      else if (typeof joined[Symbol.iterator] === "function") {
        for (const p of joined) existing.push(p)
      }
      if (existing.length > 0) {
        const map = new Map<
          string,
          { name: string; audioEnabled: boolean; videoEnabled: boolean; userId?: string }
        >()
        for (const p of existing) {
          map.set(p.id, {
            name: p.name,
            audioEnabled: p.audioEnabled,
            videoEnabled: p.videoEnabled,
            userId: p.customParticipantId,
          })
          if (p.screenShareEnabled)
            setScreenSharer({ id: p.id, name: p.name, isLocal: false })
        }
        setRemoteParticipants(map)
      }
    } catch (err) {
      console.warn("[Meeting] Error populating existing participants:", err)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleParticipantJoined = (p: any) => {
      setRemoteParticipants((prev) => {
        const next = new Map(prev)
        next.set(p.id, {
          name: p.name,
          audioEnabled: p.audioEnabled,
          videoEnabled: p.videoEnabled,
          userId: p.customParticipantId,
        })
        return next
      })
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleParticipantLeft = (p: any) => {
      setRemoteParticipants((prev) => {
        const n = new Map(prev)
        n.delete(p.id)
        return n
      })
      setScreenSharer((prev) => (prev?.id === p.id ? null : prev))
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleAudioUpdate = (p: any) => {
      const audioEnabled = p.audioEnabled ?? true
      setRemoteParticipants((prev) => {
        const ex = prev.get(p.id)
        if (!ex)
          return new Map(prev).set(p.id, {
            name: p.name || "Participant",
            audioEnabled,
            videoEnabled: false,
            userId: p.customParticipantId,
          })
        const n = new Map(prev)
        n.set(p.id, { ...ex, audioEnabled })
        return n
      })
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleVideoUpdate = (p: any) => {
      const videoEnabled = p.videoEnabled ?? true
      setRemoteParticipants((prev) => {
        const ex = prev.get(p.id)
        if (!ex)
          return new Map(prev).set(p.id, {
            name: p.name || "Participant",
            audioEnabled: false,
            videoEnabled,
            userId: p.customParticipantId,
          })
        const n = new Map(prev)
        n.set(p.id, { ...ex, videoEnabled })
        return n
      })
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleScreenShareUpdate = (p: any) => {
      if (p.screenShareEnabled) {
        setScreenSharer({ id: p.id, name: p.name, isLocal: false })
        playScreenShare()
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

  /* ── LOCAL AUDIO LEVEL DETECTION (local-only, no server round trips) ── */
  useEffect(() => {
    if (!isJoined || isMuted || !activeMeeting) return
    let animationId: number
    let audioContext: AudioContext | null = null
    let analyser: AnalyserNode | null = null
    let dataArray: Uint8Array | null = null
    let stream: MediaStream | null = null

    async function setupAudioAnalysis() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        audioContext = new AudioContext()
        analyser = audioContext.createAnalyser()
        analyser.fftSize = 256
        const source = audioContext.createMediaStreamSource(stream)
        source.connect(analyser)
        const bufferLength = analyser.frequencyBinCount
        dataArray = new Uint8Array(bufferLength)

        function tick() {
          if (!analyser || !dataArray || !activeMeetingRef.current) return
          analyser.getByteFrequencyData(dataArray as Uint8Array<ArrayBuffer>)
          const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
          const level = Math.min(1, avg / 128)
          setMySpeakingLevel(level)
          animationId = requestAnimationFrame(tick)
        }
        tick()
      } catch (err) {
        console.warn("[Meeting] Audio analysis setup failed:", err)
      }
    }

    setupAudioAnalysis()

    return () => {
      if (animationId) cancelAnimationFrame(animationId)
      if (audioContext) audioContext.close().catch(() => {})
      if (stream) stream.getTracks().forEach((t) => t.stop())
      setMySpeakingLevel(0)
    }
  }, [isJoined, isMuted, activeMeeting])

  /* ── HANDLERS ── */

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
            setMeetingStartTime(
              details.meeting.startedAt ? new Date(details.meeting.startedAt) : new Date()
            )
            if (details.participants) {
              const admitted = details.participants.filter((p) => p.status === "admitted")
              setAdmittedParticipants(admitted)
              const roles = new Map<string, string>()
              for (const p of admitted) roles.set(p.userId, p.role)
              setParticipantRoles(roles)
            }
          } else {
            meeting = {
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
                guestAccess: true,
              },
              createdAt: new Date().toISOString(),
            }
            setActiveMeeting(meeting)
            setMeetingStartTime(new Date())
          }
        }

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
    [meetingCtx.registerMeeting, user.id]
  )

  useEffect(() => {
    joinRTKRef.current = joinRTKAndSetup
  }, [joinRTKAndSetup])

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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    meetingCtx.setMeetingMuted(isMuted)
  }, [isMuted])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (activeMeeting)
      meetingCtx.updateMeeting({ participantCount: remoteParticipants.size + 1 })
  }, [remoteParticipants.size, activeMeeting])

  /* Reconnect to existing meeting when navigating back — instant restore */
  useEffect(() => {
    if (activeMeeting || !meetingCtx.hasActiveMeeting) return
    if (!rtkClient.isInRoom || !rtkClient.client) return
    const info = meetingCtx.activeMeetingInfo
    if (!info) return

    // Immediately restore — RTK is already connected, no loading state needed
    meetingCtx.setMinimized(false)
    setActiveMeeting({
      id: info.meetingId,
      title: info.title,
      hostId: info.isHost ? user.id : "",
      hostName: info.isHost ? `${user.firstName} ${user.lastName}` : "",
      hostAvatar: info.isHost ? user.avatarUrl : null,
      status: "active",
      meetingId: info.meetingId,
      participantCount: info.participantCount,
      maxParticipants: 50,
      settings: {
        allowScreenShare: true,
        muteOnEntry: true,
        requireApproval: true,
        maxParticipants: 50,
        guestAccess: true,
      },
      createdAt: new Date().toISOString(),
    })
    setMeetingStartTime(info.startTime)
    setIsJoined(true)

    // Silently fetch full details in background
    getMeetingDetails(info.meetingId).then((details) => {
      if (details.success && details.meeting) {
        setActiveMeeting(details.meeting)
        if (details.participants) {
          const admitted = details.participants.filter((p) => p.status === "admitted")
          setAdmittedParticipants(admitted)
          const roles = new Map<string, string>()
          for (const p of admitted) {
            roles.set(p.userId, p.role)
            if (p.userId === user.id) setMyRole(p.role as MeetingRole)
          }
          setParticipantRoles(roles)
        }
      } else {
        // Meeting no longer exists — clean up
        meetingCtx.unregisterMeeting()
        rtkClient.leaveRoom().catch(() => {})
        setActiveMeeting(null)
        setIsJoined(false)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCreate(title: string) {
    setShowCreate(false)
    setSetupMessage("Setting up your meeting...")
    playMeetingCreating()
    const result = await createMeeting(title)
    if (result.success && result.meeting && result.authToken) {
      setActiveMeeting(result.meeting)
      setMyRole("host")
      setMeetingStartTime(
        result.meeting.startedAt ? new Date(result.meeting.startedAt) : new Date()
      )
      await joinRTKAndSetup(result.authToken)
    } else {
      setSetupMessage(null)
    }
  }

  async function handleCreateCourseMeeting(courseId: string, title: string) {
    setShowCourseMeetingModal(false)
    setSelectedCourse(null)
    setSetupMessage("Setting up your live session...")
    playMeetingCreating()
    const result = await createCourseMeeting(courseId, title)
    if (result.success && result.meeting && result.authToken) {
      setActiveMeeting(result.meeting)
      setMyRole("host")
      setMeetingStartTime(
        result.meeting.startedAt ? new Date(result.meeting.startedAt) : new Date()
      )
      await joinRTKAndSetup(result.authToken)
    } else {
      setSetupMessage(null)
    }
  }

  function handleStartCourseMeeting(course: CourseSummary) {
    setSelectedCourse(course)
    setShowCourseMeetingModal(true)
  }

  async function handleJoinByLink(meetingId: string) {
    // Check if already in this meeting in another tab
    if (tabChannelRef.current) {
      const isOccupied = await new Promise<boolean>((resolve) => {
        let resolved = false
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true
            resolve(false)
          }
        }, 150)
        
        const handleResponse = (event: MessageEvent) => {
          const { type, tabId } = event.data || {}
          if (type === "occupied" && tabId !== tabIdRef.current) {
            clearTimeout(timeout)
            if (!resolved) {
              resolved = true
              resolve(true)
            }
          }
        }
        
        tabChannelRef.current!.addEventListener("message", handleResponse)
        tabChannelRef.current!.postMessage({
          type: "check",
          meetingId,
          tabId: tabIdRef.current,
          userId: user.id,
        })
        
        // Cleanup listener after timeout
        setTimeout(() => {
          tabChannelRef.current?.removeEventListener("message", handleResponse)
        }, 200)
      })
      
      if (isOccupied) {
        setTabConflict(meetingId)
        return
      }
    }
    
    setSetupMessage("Joining meeting...")
    const result = await joinMeeting(meetingId)
    if (result.success) {
      if (result.requiresApproval) {
        setSetupMessage(null)
        setWaitingForApproval(result.meeting?.title || "Meeting")
        return
      }
      if (result.authToken && result.meeting) {
        const role = (result as { role?: MeetingRole }).role
        setMyRole(role || (result.meeting.hostId === user.id ? "host" : "participant"))
        if (role === "guest") {
          setIsMuted(true)
          setIsVideoOff(true)
        }
        setActiveMeeting(result.meeting)
        setMeetingStartTime(
          result.meeting.startedAt ? new Date(result.meeting.startedAt) : new Date()
        )
        await joinRTKAndSetup(result.authToken)
        // Enforce RTK-level audio/video disable for guests after joining
        if (role === "guest") {
          rtkClient.client?.self.disableAudio().catch(() => {})
          rtkClient.client?.self.disableVideo().catch(() => {})
        }
        // Broadcast to other tabs that we've joined
        tabChannelRef.current?.postMessage({
          type: "joined",
          meetingId: result.meeting.id,
          tabId: tabIdRef.current,
        })
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
        const role = (result as { role?: MeetingRole }).role
        setMyRole(role || (result.meeting.hostId === user.id ? "host" : "participant"))
        if (role === "guest") {
          setIsMuted(true)
          setIsVideoOff(true)
        }
        setActiveMeeting(result.meeting)
        setMeetingStartTime(
          result.meeting.startedAt ? new Date(result.meeting.startedAt) : new Date()
        )
        await joinRTKAndSetup(result.authToken)
        // Enforce RTK-level audio/video disable for guests after joining
        if (role === "guest") {
          rtkClient.client?.self.disableAudio().catch(() => {})
          rtkClient.client?.self.disableVideo().catch(() => {})
        }
        const details = await getMeetingDetails(meeting.id)
        if (details.success && details.participants) {
          const admitted = details.participants.filter((p) => p.status === "admitted")
          setAdmittedParticipants(admitted)
          const roles = new Map<string, string>()
          for (const p of admitted) roles.set(p.userId, p.role)
          setParticipantRoles(roles)
        }
      }
    } else {
      setSetupMessage(null)
      console.error("[Meeting] Rejoin failed:", result.error)
    }
  }

  function resetMeetingState() {
    // Broadcast to other tabs that we've left
    tabChannelRef.current?.postMessage({
      type: "left",
      tabId: tabIdRef.current,
    })
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
    setSpeakingLevels(new Map())
    setMySpeakingLevel(0)
    setMyRole("participant")
    setParticipantRoles(new Map())
    setStageRequests([])
    setHasRequestedStage(false)
    // Refresh meetings list after state is cleared
    setTimeout(() => {
      getMyMeetings().then((r) => {
        if (r.success && r.meetings) setMeetings(r.meetings)
      })
      fetchMeetingHistory().then((r) => {
        if (r.success && r.meetings) setMeetingHistory(r.meetings)
      })
    }, 100)
  }

  function handleMeetingEnd() {
    if (hasEndedRef.current) return
    hasEndedRef.current = true
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
    setIsEndingMeeting(false)
    setShowMeetingEnded({ title, duration })
  }

  async function handleEndMeeting() {
    if (!activeMeeting || isEndingMeeting) return
    setIsEndingMeeting(true)
    // Capture values before resetting state
    const meetingId = activeMeeting.id
    const wasHost = isHost
    // Clean up locally FIRST — instant UI response
    handleMeetingEnd()
    // Fire-and-forget server notification — don't block UI
    try {
      if (wasHost) endMeetingAction(meetingId).catch(() => {})
      else leaveMeeting(meetingId).catch(() => {})
    } catch {
      /* noop */
    }
  }

  async function toggleMute() {
    // Guests cannot unmute - audio is disabled until promoted to stage
    if (myRole === "guest" && isMuted) return
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
    // Guests cannot enable video - video is disabled until promoted to stage
    if (myRole === "guest" && isVideoOff) return
    const next = !isVideoOff
    setIsVideoOff(next)
    try {
      if (next) {
        await rtkClient.client?.self.disableVideo()
      } else {
        await rtkClient.client?.self.enableVideo()
        requestAnimationFrame(() => {
          if (localVideoRef.current)
            rtkClient.client?.self.registerVideoElement(localVideoRef.current, true)
        })
      }
    } catch (e) {
      console.error("Toggle video:", e)
    }
  }

  async function toggleScreenShare() {
    try {
      if (isScreenSharing) await rtkClient.client?.self.disableScreenShare()
      else await rtkClient.client?.self.enableScreenShare()
    } catch (e) {
      console.error("Screen share:", e)
    }
  }

  function toggleLoudspeaker() {
    setIsLoudspeaker((prev) => {
      const next = !prev
      document.querySelectorAll("audio").forEach((el) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const audioEl = el as any
        if (typeof audioEl.setSinkId === "function")
          audioEl.setSinkId(next ? "default" : "communications").catch(() => {})
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
      setTileReactions((prev) => {
        const n = new Map(prev)
        n.delete(user.id)
        return n
      })
      tileReactionTimers.current.delete(user.id)
    }, 3000)
    tileReactionTimers.current.set(user.id, timer)
    await sendReaction(activeMeeting.id, reactionId)
  }

  async function handleKick(userId: string) {
    if (activeMeeting) await kickParticipant(activeMeeting.id, userId)
  }

  async function handleMuteParticipant(userId: string, muteType: "audio" | "video" | "screenshare" = "audio") {
    if (activeMeeting) await muteParticipant(activeMeeting.id, userId, muteType)
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
    setChatMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${user.id}`,
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`,
        userAvatar: user.avatarUrl,
        message: msg,
        timestamp: Date.now(),
      },
    ])
    await sendMeetingChat(activeMeeting.id, msg)
  }

  async function handleCreatePoll() {
    if (!activeMeeting || !pollQuestion.trim() || pollOptions.filter((o) => o.trim()).length < 2)
      return
    const opts = pollOptions.filter((o) => o.trim())
    const pollId = `poll-${Date.now()}-${user.id}`
    setPolls((prev) => [
      ...prev,
      {
        id: pollId,
        question: pollQuestion,
        options: opts,
        votes: Object.fromEntries(opts.map((_, i) => [String(i), 0])),
        voters: new Set<string>(),
        voterDetails: {},
        createdBy: user.id,
        createdByName: `${user.firstName} ${user.lastName}`,
      },
    ])
    setShowCreatePoll(false)
    const q = pollQuestion
    setPollQuestion("")
    setPollOptions(["", ""])
    await createMeetingPoll(activeMeeting.id, q, opts, undefined, pollId)
  }

  async function handleVotePoll(pollId: string, optionIndex: number) {
    if (!activeMeeting || myVotes.has(pollId)) return
    setMyVotes((prev) => new Set(prev).add(pollId))
    
    const voter: PollVoter = {
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      userAvatar: user.avatarUrl,
    }
    
    setPolls((prev) =>
      prev.map((p) => {
        if (p.id !== pollId) return p
        const newVotes = { ...p.votes }
        newVotes[String(optionIndex)] = (newVotes[String(optionIndex)] || 0) + 1
        const newVoters = new Set(p.voters)
        newVoters.add(user.id)
        
        // Add voter details
        const newVoterDetails = { ...p.voterDetails }
        const optionKey = String(optionIndex)
        if (!newVoterDetails[optionKey]) {
          newVoterDetails[optionKey] = []
        }
        newVoterDetails[optionKey] = [...newVoterDetails[optionKey], voter]
        
        return { ...p, votes: newVotes, voters: newVoters, voterDetails: newVoterDetails }
      })
    )
    await voteMeetingPoll(activeMeeting.id, pollId, optionIndex)
  }

  async function handleDeleteHistory(meetingId: string) {
    setMeetingHistory((prev) => prev.filter((h) => h.id !== meetingId))
    await deleteMeetingHistory(meetingId)
  }

  async function handleRequestStage() {
    if (!activeMeeting || hasRequestedStage) return
    setHasRequestedStage(true)
    await requestStage(activeMeeting.id)
  }

  async function handleInviteToStage(userId: string) {
    if (!activeMeeting) return
    setParticipantRoles((prev) => new Map(prev).set(userId, "participant"))
    setStageRequests((prev) => prev.filter((r) => r.userId !== userId))
    await inviteToStage(activeMeeting.id, userId)
  }

  async function handleRemoveFromStage(userId: string) {
    if (!activeMeeting) return
    setParticipantRoles((prev) => new Map(prev).set(userId, "guest"))
    await removeFromStage(activeMeeting.id, userId)
  }

  async function handleAcceptStageRequest(userId: string) {
    if (!activeMeeting) return
    setStageRequests((prev) => prev.filter((r) => r.userId !== userId))
    await acceptStageRequest(activeMeeting.id, userId)
  }

  async function handleDeclineStageRequest(userId: string) {
    if (!activeMeeting) return
    setStageRequests((prev) => prev.filter((r) => r.userId !== userId))
    await declineStageRequest(activeMeeting.id, userId)
  }

  /* ── RENDER: MEETING ENDED ── */
  if (showMeetingEnded) {
    return (
      <MeetingEndedScreen
        meetingTitle={showMeetingEnded.title}
        duration={showMeetingEnded.duration}
        onReturn={() => {
          hasEndedRef.current = false
          setShowMeetingEnded(null)
        }}
      />
    )
  }

  /* ── RENDER: ACTIVE MEETING ── */
  if (activeMeeting && isJoined && !meetingCtx.isMinimized) {
    const totalParticipants = remoteParticipants.size + 1
    const hasScreenShare = !!screenSharer

    // Split participants into stage and audience based on roles
    const isOnStage = (rtkId: string) => {
      const uid = remoteParticipants.get(rtkId)?.userId
      if (!uid) return true
      const role = participantRoles.get(uid) || "participant"
      return role !== "guest"
    }
    const stageRemoteIds = Array.from(remoteParticipants.keys()).filter(isOnStage)
    const audienceRemoteIds = Array.from(remoteParticipants.keys()).filter((id) => !isOnStage(id))
    const localIsOnStage = myRole !== "guest"

    const allGridEntries: Array<{ id: string; isLocal: boolean }> = [
      ...(localIsOnStage ? [{ id: "local", isLocal: true }] : []),
      ...stageRemoteIds.map((id) => ({ id, isLocal: false })),
    ]

    type Slide =
      | { type: "screenshare" }
      | { type: "participants"; entries: typeof allGridEntries }
    const slides: Slide[] = []
    if (hasScreenShare) slides.push({ type: "screenshare" })
    for (let i = 0; i < allGridEntries.length; i += TILES_PER_PAGE)
      slides.push({ type: "participants", entries: allGridEntries.slice(i, i + TILES_PER_PAGE) })

    const totalSlideCount = slides.length
    const currentSlide = Math.min(gridPage, Math.max(0, totalSlideCount - 1))
    const activeSlide = slides[currentSlide]
    const panelOpen = activeTab !== null

    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-neutral-100 dark:bg-zinc-950 overflow-hidden">
        <style>{"nav.safe-area-bottom { display: none !important; }"}</style>

        {/* Remote audio players */}
        {Array.from(remoteParticipants.entries()).map(([id, p]) => (
          <RemoteAudioPlayer key={`audio-${id}`} participantId={id} audioEnabled={p.audioEnabled} />
        ))}

        {/* Top bar */}
        <div className="relative z-10 flex items-center justify-between px-4 py-2 bg-transparent">
          <div className="flex items-center gap-2.5">
            <span className="text-foreground font-semibold text-sm truncate max-w-40">
              {activeMeeting.title}
            </span>
            <span className="text-muted-foreground/40">·</span>
            <MeetingTimer startTime={meetingStartTime} />
            <span className="text-muted-foreground/40">·</span>
            <span className="text-muted-foreground text-xs">{totalParticipants}</span>
            
            {/* Desktop carousel controls */}
            {totalSlideCount > 1 && (
              <>
                <span className="text-muted-foreground/40 hidden md:block">·</span>
                <div className="hidden md:flex items-center gap-2">
                  <button
                    onClick={() => setGridPage(Math.max(0, currentSlide - 1))}
                    disabled={currentSlide === 0}
                    className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-muted transition-colors disabled:opacity-30 disabled:pointer-events-none"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                  </button>
                  <div className="flex gap-1.5">
                    {slides.map((slide, i) => (
                      <button
                        key={i}
                        onClick={() => setGridPage(i)}
                        className={cn(
                          "h-1.5 rounded-full transition-all duration-200",
                          i === currentSlide
                            ? slide.type === "screenshare"
                              ? "bg-emerald-400 w-4"
                              : "bg-foreground w-4"
                            : "bg-foreground/30 hover:bg-foreground/50 w-1.5"
                        )}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => setGridPage(Math.min(totalSlideCount - 1, currentSlide + 1))}
                    disabled={currentSlide === totalSlideCount - 1}
                    className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-muted transition-colors disabled:opacity-30 disabled:pointer-events-none"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                  </button>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInviteDialog(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground transition-colors border border-border/50"
            >
              <HugeiconsIcon icon={Link01Icon} size={12} />
              Invite
            </button>
            {activeMeeting && (
              <InstructorInviteDialog
                open={showInviteDialog}
                onOpenChange={setShowInviteDialog}
                meetingId={activeMeeting.id}
                meetingLink={`${window.location.origin}${MEETINGS_PATH}?join=${activeMeeting.id}`}
              />
            )}
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
                <div
                  key={req.userId}
                  className="flex items-center gap-3 px-4 py-2 rounded-xl bg-amber-500/8 dark:bg-amber-500/6 border border-amber-500/15 animate-in fade-in slide-in-from-top-2 duration-200"
                >
                  <Avatar className="w-7 h-7 shrink-0">
                    {req.avatar && <AvatarImage src={req.avatar} alt={req.name} />}
                    <AvatarFallback className="text-[9px] bg-amber-500/15 text-amber-600 dark:text-amber-400">
                      {req.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-foreground font-medium flex-1 truncate">
                    {req.name}{" "}
                    <span className="text-muted-foreground font-normal">wants to join</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleAdmit(req.userId)}
                      className="h-7 px-3 rounded-lg text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                    >
                      Admit
                    </button>
                    <button
                      onClick={() => handleDecline(req.userId)}
                      className="h-7 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
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
            {/* Mobile prev/next arrows overlaid on sides */}
            {totalSlideCount > 1 && (
              <>
                <button
                  onClick={() => setGridPage(Math.max(0, currentSlide - 1))}
                  disabled={currentSlide === 0}
                  className="md:hidden flex absolute left-0 top-1/2 -translate-y-1/2 z-20 h-8 w-8 items-center justify-center rounded-full bg-background/60 backdrop-blur-sm border border-border/30 text-muted-foreground hover:text-foreground hover:bg-background/80 transition-colors disabled:opacity-0 disabled:pointer-events-none"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <button
                  onClick={() => setGridPage(Math.min(totalSlideCount - 1, currentSlide + 1))}
                  disabled={currentSlide === totalSlideCount - 1}
                  className="md:hidden flex absolute right-0 top-1/2 -translate-y-1/2 z-20 h-8 w-8 items-center justify-center rounded-full bg-background/60 backdrop-blur-sm border border-border/30 text-muted-foreground hover:text-foreground hover:bg-background/80 transition-colors disabled:opacity-0 disabled:pointer-events-none"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                </button>
              </>
            )}

            {activeSlide?.type === "screenshare" ? (
              <ScreenShareView
                participantId={screenSharer!.id}
                participantName={screenSharer!.name}
                isLocal={screenSharer!.isLocal}
              />
            ) : activeSlide?.type === "participants" ? (
              <div
                className={cn(
                  "grid gap-2 md:gap-3 flex-1 auto-rows-fr",
                  activeSlide.entries.length <= 1
                    ? "grid-cols-1"
                    : "grid-cols-1 md:grid-cols-2"
                )}
              >
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
                      speakingLevel={mySpeakingLevel}
                      videoRef={localVideoRef}
                    />
                  ) : (
                    (() => {
                      const participant = remoteParticipants.get(entry.id)!
                      const uid = participant.userId || entry.id
                      return (
                        <RemoteParticipantTile
                          key={entry.id}
                          participantId={entry.id}
                          participant={participant}
                          handRaised={raisedHands.has(uid)}
                          reactionId={tileReactions.get(uid) || null}
                          speakingLevel={speakingLevels.get(uid) || 0}
                        />
                      )
                    })()
                  )
                )}
              </div>
            ) : null}

            {/* Slide dots (mobile only) */}
            {totalSlideCount > 1 && (
              <div className="md:hidden flex gap-1.5 justify-center py-1">
                {slides.map((slide, i) => (
                  <button
                    key={i}
                    onClick={() => setGridPage(i)}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-200",
                      i === currentSlide
                        ? slide.type === "screenshare"
                          ? "bg-emerald-400 w-4"
                          : "bg-foreground w-4"
                        : "bg-foreground/30 hover:bg-foreground/50 w-1.5"
                    )}
                  />
                ))}
              </div>
            )}

            {/* Audience strip - shows guests watching */}
            {(audienceRemoteIds.length > 0 || !localIsOnStage) && (
              <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl bg-muted/30 border border-border/30">
                <span className="text-[10px] text-muted-foreground font-medium shrink-0">
                  {audienceRemoteIds.length + (localIsOnStage ? 0 : 1)} watching
                </span>
                <div className="flex -space-x-1.5 overflow-hidden">
                  {!localIsOnStage && (
                    <Avatar className="w-5 h-5 border border-background shrink-0">
                      {user.avatarUrl && <AvatarImage src={user.avatarUrl} />}
                      <AvatarFallback className="text-[7px] bg-primary/10 text-primary">
                        {user.firstName?.[0]}{user.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  {audienceRemoteIds.slice(0, 10).map((rtkId) => {
                    const p = remoteParticipants.get(rtkId)
                    return (
                      <Avatar key={rtkId} className="w-5 h-5 border border-background shrink-0">
                        <AvatarFallback className="text-[7px] bg-muted-foreground/10 text-muted-foreground">
                          {p?.name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?"}
                        </AvatarFallback>
                      </Avatar>
                    )
                  })}
                  {audienceRemoteIds.length > 10 && (
                    <span className="text-[9px] text-muted-foreground ml-1.5">+{audienceRemoteIds.length - 10}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Side panel */}
        {panelOpen && activeTab && (
          <MeetingSidePanel
            activeTab={activeTab}
            onTabChange={setActiveTab}
            unreadChat={unreadChat}
            userId={user.id}
            userName={`${user.firstName} ${user.lastName}`}
            userAvatar={user.avatarUrl}
            isHost={isHost ?? false}
            isMuted={isMuted}
            myHandRaised={myHandRaised}
            myRole={myRole === "co-host" ? "host" : myRole}
            activeMeetingHostId={activeMeeting.hostId}
            remoteParticipants={remoteParticipants}
            participantRoles={participantRoles}
            raisedHands={raisedHands}
            admittedParticipants={admittedParticipants.map((p) => ({
              userId: p.userId,
              name: p.name,
              avatar: p.avatar,
              role: p.role,
            }))}
            stageRequests={stageRequests}
            screenSharePermissions={screenSharePermissions}
            onKick={handleKick}
            onMuteParticipant={handleMuteParticipant}
            onToggleScreenSharePerm={handleToggleScreenSharePerm}
            onInviteToStage={handleInviteToStage}
            onRemoveFromStage={handleRemoveFromStage}
            onAcceptStageRequest={handleAcceptStageRequest}
            onDeclineStageRequest={handleDeclineStageRequest}
            chatMessages={chatMessages}
            chatInput={chatInput}
            onChatInputChange={setChatInput}
            onSendChat={handleSendChat}
            polls={polls}
            myVotes={myVotes}
            showCreatePoll={showCreatePoll}
            pollQuestion={pollQuestion}
            pollOptions={pollOptions}
            onSetShowCreatePoll={setShowCreatePoll}
            onPollQuestionChange={setPollQuestion}
            onPollOptionChange={(i, v) => {
              const next = [...pollOptions]
              next[i] = v
              setPollOptions(next)
            }}
            onAddPollOption={() => setPollOptions([...pollOptions, ""])}
            onRemovePollOption={(i) => setPollOptions(pollOptions.filter((_, j) => j !== i))}
            onCreatePoll={handleCreatePoll}
            onVotePoll={handleVotePoll}
          />
        )}

        {/* Bottom controls */}
        <MeetingControls
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          isScreenSharing={isScreenSharing}
          isLoudspeaker={isLoudspeaker}
          isMobile={isMobile}
          isHost={isHost ?? false}
          isEndingMeeting={isEndingMeeting}
          myHandRaised={myHandRaised}
          myRole={myRole === "co-host" ? "host" : myRole}
          hasRequestedStage={hasRequestedStage}
          showReactionPicker={showReactionPicker}
          activeTab={activeTab}
          unreadChat={unreadChat}
          pendingRequestCount={pendingRequests.length}
          stageRequestCount={stageRequests.length}
          screenShareDisabled={!!screenSharer && !isScreenSharing}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
          onToggleScreenShare={toggleScreenShare}
          onToggleLoudspeaker={toggleLoudspeaker}
          onToggleHand={handleToggleHand}
          onReaction={handleReaction}
          onToggleReactionPicker={() => setShowReactionPicker(!showReactionPicker)}
          onTabChange={(tab) => {
            if (tab === "chat") setUnreadChat(0)
            setActiveTab(tab)
          }}
          onRequestStage={handleRequestStage}
          onEndMeeting={handleEndMeeting}
        />
      </div>
    )
  }

  /* ── RENDER: LOBBY ── */
  return (
    <div className="relative flex flex-col h-dvh min-h-0">
      {setupMessage && <SetupOverlay message={setupMessage} />}
      {waitingForApproval && (
        <WaitingRoom
          meetingTitle={waitingForApproval}
          onCancel={() => setWaitingForApproval(null)}
        />
      )}
      {tabConflict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm text-center space-y-4">
            <div className="size-12 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center">
              <svg className="size-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-lg">Already in Meeting</h3>
              <p className="text-sm text-muted-foreground mt-1">
                You&apos;re already in this meeting in another tab. Close that tab first to join here.
              </p>
            </div>
            <Button variant="outline" onClick={() => setTabConflict(null)} className="w-full">
              Dismiss
            </Button>
          </div>
        </div>
      )}
      <Topbar title="Meetings" />

      {activeMeeting && isJoined && meetingCtx.isMinimized && (
        <ReturnToMeetingBanner
          meetingTitle={activeMeeting.title}
          meetingStartTime={meetingStartTime}
          onReturn={() => meetingCtx.setMinimized(false)}
        />
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 md:px-6 py-6 space-y-6">
          {/* Quick actions hero */}
          <MeetingQuickActions
            onCreateNew={() => setShowCreate(true)}
            onJoin={handleJoinByLink}
          />

          {/* Course cards - Go Live from your courses */}
          <CourseMeetingCards
            courses={instructorCourses}
            isLoading={isLoadingCourses}
            onStartMeeting={handleStartCourseMeeting}
          />

          {/* Two-column: Active meetings + History */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Active meetings - left */}
            <section className="lg:col-span-3 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Active Meetings</h2>
                {meetings.length > 0 && (
                  <span className="text-[11px] text-muted-foreground/60">
                    {meetings.length} meeting{meetings.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <ActiveMeetingsList
                meetings={meetings}
                isLoading={isLoadingMeetings}
                userId={user.id}
                onRejoin={handleRejoin}
              />
            </section>

            {/* History - right */}
            <section className="lg:col-span-2 space-y-3">
              <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
                <div className="px-3 pt-3 pb-1">
                  <h2 className="text-sm font-semibold text-foreground">Recent History</h2>
                </div>
                <div className="max-h-[calc(100dvh-20rem)] overflow-y-auto">
                  <MeetingHistory
                    history={meetingHistory}
                    isLoading={isLoadingHistory}
                    onDelete={handleDeleteHistory}
                  />
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      <CreateMeetingModal open={showCreate} onOpenChange={setShowCreate} onCreate={handleCreate} />
      <CreateCourseMeetingModal
        key={selectedCourse?.id}
        open={showCourseMeetingModal}
        onOpenChange={setShowCourseMeetingModal}
        course={selectedCourse}
        onCreate={handleCreateCourseMeeting}
      />
    </div>
  )
}
