"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Call02Icon,
  CallEnd01Icon,
  Mic01Icon,
  MicOff01Icon,
  Video01Icon,
  VideoOffIcon,
  SpeakerIcon,
  Speaker01Icon,
  MinimizeScreenIcon,
  WifiConnected01Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { rtkClient } from "@/lib/rtk-client"
import { callSounds } from "@/lib/call-sounds"
import {
  initiateCall,
  answerCall,
  endCall as endCallAction,
  getCallStatus,
} from "@/lib/actions/calls"
import { useCallEvents } from "@/lib/hooks/use-call-events"
import { useUser } from "@/components/providers/user-provider"
import type { CallEventPayload } from "@/lib/call-events"

type CallType = "video" | "audio"
type CallState = "ringing" | "connecting" | "connected" | "ended" | "busy"

type VideoCallProps = {
  open: boolean
  onClose: () => void
  callType: CallType
  callerName: string
  callerAvatar?: string
  isIncoming?: boolean
  incomingCallId?: string
  /** Pre-fetched auth token for fast answer (skips waiting for answerCall response) */
  incomingAuthToken?: string
  receiverId?: string
  onCallStarted?: (callId: string) => void
  onCallEnded?: () => void
  isMinimized?: boolean
  onMinimize?: () => void
  onRestore?: () => void
  /** Whether this is a reconnection to an existing call */
  isReconnection?: boolean
  /** Auth token for reconnection (already authenticated) */
  reconnectionAuthToken?: string
  /** Original answered time for reconnection timer continuity */
  originalAnsweredAt?: string
  /** Whether the remote participant has rejoined */
  remoteRejoined?: boolean
}

// Glassmorphic button
function GlassButton({
  onClick,
  children,
  variant = "default",
  size = "default",
  className,
  disabled,
}: {
  onClick?: () => void
  children: React.ReactNode
  variant?: "default" | "danger" | "success" | "transparent"
  size?: "default" | "large"
  className?: string
  disabled?: boolean
}) {
  const bg = {
    default: "rgba(255,255,255,0.12)",
    danger: "rgba(239,68,68,0.85)",
    success: "rgba(34,197,94,0.85)",
    transparent: "transparent",
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-full flex items-center justify-center transition-all duration-200",
        "active:scale-95 disabled:opacity-50",
        size === "large" ? "w-16 h-16" : "w-12 h-12",
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
  )
}

function CallTimer({ startTime }: { startTime: Date | null }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!startTime) return
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [startTime])

  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60

  return (
    <span className="text-white/70 text-sm font-medium tabular-nums">
      {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
    </span>
  )
}

export function VideoCall({
  open,
  onClose,
  callType,
  callerName,
  callerAvatar,
  isIncoming = false,
  incomingCallId,
  incomingAuthToken,
  receiverId,
  onCallStarted,
  onCallEnded,
  isMinimized: externalMinimized,
  onMinimize,
  onRestore,
  isReconnection = false,
  reconnectionAuthToken,
  originalAnsweredAt,
  remoteRejoined: externalRemoteRejoined = false,
}: VideoCallProps) {
  const [callState, setCallState] = useState<CallState>(
    isIncoming ? "ringing" : "connecting"
  )
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(callType === "audio")
  const [isSpeakerOn, setIsSpeakerOn] = useState(true)
  const [callStartTime, setCallStartTime] = useState<Date | null>(null)
  const [showControls, setShowControls] = useState(true)
  const [callId, setCallId] = useState<string | null>(incomingCallId || null)
  const [internalMinimized, setInternalMinimized] = useState(false)
  const [isRemoteMuted, setIsRemoteMuted] = useState(false)
  const [isAnswering, setIsAnswering] = useState(false)
  const [isEnding, setIsEnding] = useState(false)

  const isMinimized =
    externalMinimized !== undefined ? externalMinimized : internalMinimized

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const remoteAudioRef = useRef<HTMLAudioElement>(null)
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isEndingRef = useRef(false)
  const authTokenRef = useRef<string | null>(null)
  const remoteParticipantRef = useRef<unknown>(null)
  const hasJoinedRoomRef = useRef(false)
  const participantLeftTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isConnectedRef = useRef(false)
  const isAnsweringRef = useRef(false)
  const isInitiatingRef = useRef(false)

  // Get user for SSE subscription
  const user = useUser()

  // ── Handle SSE call events (answer/decline/cancel/end) ──
  const handleCallSSE = useCallback(
    (event: CallEventPayload) => {
      // Only handle events for our current call (except busy which has no callId)
      const currentCallId = callIdRef.current
      if (event.type !== "call:busy" && (!currentCallId || event.callId !== currentCallId)) return

      console.log("[VideoCall] SSE event:", event.type, event.callId)

      switch (event.type) {
        case "call:busy": {
          // Receiver is on another call
          setCallState("busy")
          callSounds.stopRing()
          callSounds.playBusy()
          rtkClient.leaveRoom().catch(() => {})
          break
        }

        case "call:answered": {
          // Receiver answered — caller should join room (RTK may already be pre-initialized)
          if (!isIncoming && !hasJoinedRoomRef.current) {
            // Immediately update UI to show we're connecting (not stuck on ringing)
            setCallState("connecting")
            const token = authTokenRef.current
            if (token) {
              ;(async () => {
                try {
                  // Only init if not already initialized (pre-init during ringing)
                  if (!rtkClient.client) {
                    await rtkClient.init(token, {
                      audio: true,
                      video: callType === "video",
                    })
                  }
                  console.log("[Caller] Joining room via SSE...")
                  await rtkClient.joinRoom()
                  hasJoinedRoomRef.current = true
                  try { await rtkClient.client?.self.enableAudio() } catch {}
                  if (callType === "video") {
                    try { await rtkClient.client?.self.enableVideo() } catch {}
                  }
                } catch (err) {
                  console.error("[Caller] RTK init/join failed:", err)
                  setCallState("ended")
                }
              })()
            }
          }
          break
        }

        case "call:declined":
        case "call:cancelled":
        case "call:ended": {
          // Remote end/cancel/decline — end the call
          if (!isEndingRef.current) {
            isEndingRef.current = true
            setCallState("ended")
            rtkClient.leaveRoom().catch(() => {})
          }
          break
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isIncoming, callType]
  )

  useCallEvents(user.id, handleCallSSE)

  // Keep a ref to callId so the SSE callback can access the latest value
  const callIdRef = useRef<string | null>(callId)
  callIdRef.current = callId

  // ── Helper: setup remote audio with loudspeaker support ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setupRemoteAudio = useCallback((participant: any) => {
    if (!participant?.audioTrack) return
    try {
      const stream = new MediaStream([participant.audioTrack])
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream
        remoteAudioRef.current.volume = 1.0 // Always start at full volume (loudspeaker)
        remoteAudioRef.current.play().catch((e: unknown) => {
          console.warn("[RTK] Remote audio autoplay blocked:", e)
        })
      }
    } catch (e) {
      console.warn("[RTK] Failed to setup remote audio:", e)
    }
  }, [])

  // ── RTK event listeners (registered via singleton, survive re-renders) ──
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleRoomJoined = () => {
      console.log("[RTK] Room joined")
      // Register local video
      if (localVideoRef.current && callType === "video") {
        try {
          rtkClient.client?.self.registerVideoElement(localVideoRef.current, true)
        } catch {
          // Fallback: Use self video track directly
          const selfVideoTrack = rtkClient.client?.self?.videoTrack
          if (selfVideoTrack && localVideoRef.current) {
            try {
              const stream = new MediaStream([selfVideoTrack])
              localVideoRef.current.srcObject = stream
              localVideoRef.current.play().catch(() => {})
            } catch { /* ignore */ }
          }
        }
      }
      // Explicitly enable audio after joining to ensure mic is publishing
      rtkClient.client?.self.enableAudio().catch(() => {})
      if (callType === "video") {
        rtkClient.client?.self.enableVideo().catch(() => {})
      }
    }

    const handleRoomLeft = () => {
      console.log("[RTK] Room left")
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleParticipantJoined = (participant: any) => {
      console.log("[RTK] Participant joined:", participant.name, "audioEnabled:", participant.audioEnabled, "videoEnabled:", participant.videoEnabled)
      // Cancel any pending "participant left" timer — they reconnected
      if (participantLeftTimerRef.current) {
        clearTimeout(participantLeftTimerRef.current)
        participantLeftTimerRef.current = null
        console.log("[RTK] Cancelled pending participantLeft timer")
      }
      remoteParticipantRef.current = participant
      isConnectedRef.current = true
      isEndingRef.current = false  // Reset so end button works
      setCallState("connected")
      setCallStartTime((prev) => prev ?? new Date())
      setIsRemoteMuted(!participant.audioEnabled)
      // Register video element for remote participant
      if (remoteVideoRef.current && callType === "video" && participant.videoEnabled) {
        try {
          participant.registerVideoElement(remoteVideoRef.current)
        } catch (e) {
          console.warn("[RTK] Failed to register remote video:", e)
        }
      }
      // Fallback: if registerVideoElement doesn't work, use MediaStream directly
      if (callType === "video" && participant.videoTrack && remoteVideoRef.current) {
        try {
          const stream = new MediaStream([participant.videoTrack])
          if (!remoteVideoRef.current.srcObject) {
            remoteVideoRef.current.srcObject = stream
            remoteVideoRef.current.play().catch(() => {})
          }
        } catch (e) {
          console.warn("[RTK] Failed to set remote video srcObject:", e)
        }
      }
      // Setup remote audio — use a proper audio element
      setupRemoteAudio(participant)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleVideoUpdate = (...args: any[]) => {
      const participant = args[0]
      const data = args[1] as { videoEnabled?: boolean; videoTrack?: MediaStreamTrack } | undefined
      if (!data) return
      console.log("[RTK] Remote video update:", participant?.name, "enabled:", data.videoEnabled)
      if (data.videoEnabled && data.videoTrack && remoteVideoRef.current) {
        try {
          // Try registerVideoElement first 
          if (participant?.registerVideoElement) {
            participant.registerVideoElement(remoteVideoRef.current)
          }
          // Also set srcObject as backup
          const stream = new MediaStream([data.videoTrack])
          remoteVideoRef.current.srcObject = stream
          remoteVideoRef.current.play().catch(() => {})
        } catch (e) {
          console.warn("[RTK] Failed to update remote video:", e)
        }
      } else if (!data.videoEnabled && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleAudioUpdate = (...args: any[]) => {
      const participant = args[0]
      const data = args[1] as { audioEnabled?: boolean; audioTrack?: MediaStreamTrack } | undefined
      if (!data) return
      console.log("[RTK] Remote audio update:", participant?.name, "enabled:", data.audioEnabled)
      setIsRemoteMuted(!data.audioEnabled)
      // Re-attach audio track when it changes — always force re-setup
      if (data.audioEnabled && data.audioTrack) {
        setupRemoteAudio({ audioTrack: data.audioTrack })
      }
    }

    const handleParticipantLeft = () => {
      console.log("[RTK] Participant left")
      // Debounce: Dyte fires phantom participantLeft during initial connection.
      // Wait 3 seconds and check if the participant came back.
      if (participantLeftTimerRef.current) {
        clearTimeout(participantLeftTimerRef.current)
      }
      participantLeftTimerRef.current = setTimeout(() => {
        participantLeftTimerRef.current = null
        // Check if participant rejoined during the wait
        if (remoteParticipantRef.current) {
          console.log("[RTK] Participant left debounce — participant is back, ignoring")
          return
        }
        // Only end call if we were actually connected at some point
        if (!isConnectedRef.current) {
          console.log("[RTK] Participant left during setup — ignoring")
          return
        }
        console.log("[RTK] Participant left confirmed — ending call")
        if (!isEndingRef.current) {
          isEndingRef.current = true
          if (callId) endCallAction(callId).catch(console.error)
          setCallState("ended")
        }
      }, 3000)
      // Clear the participant ref immediately so the debounce check works
      remoteParticipantRef.current = null
    }

    rtkClient.on("roomJoined", "self", handleRoomJoined)
    rtkClient.on("roomLeft", "self", handleRoomLeft)
    rtkClient.on("participantJoined", "participants", handleParticipantJoined)
    rtkClient.on("participantLeft", "participants", handleParticipantLeft)
    rtkClient.on("audioUpdate", "participants", handleAudioUpdate)
    rtkClient.on("videoUpdate", "participants", handleVideoUpdate)

    return () => {
      rtkClient.off("roomJoined", "self", handleRoomJoined)
      rtkClient.off("roomLeft", "self", handleRoomLeft)
      rtkClient.off("participantJoined", "participants", handleParticipantJoined)
      rtkClient.off("participantLeft", "participants", handleParticipantLeft)
      rtkClient.off("audioUpdate", "participants", handleAudioUpdate)
      rtkClient.off("videoUpdate", "participants", handleVideoUpdate)
      if (participantLeftTimerRef.current) {
        clearTimeout(participantLeftTimerRef.current)
        participantLeftTimerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callType, callId])

  // Register local video when call becomes connected (catches invitee case where
  // handleRoomJoined fires before the PIP <video> element is in the DOM)
  useEffect(() => {
    if (callState !== "connected" || callType !== "video" || isVideoOff) return
    if (!rtkClient.client || !rtkClient.isInRoom) return
    // Short delay to let React render the PIP video element first
    const timer = setTimeout(() => {
      if (!localVideoRef.current || !rtkClient.client) return
      try {
        rtkClient.client.self.registerVideoElement(localVideoRef.current, true)
      } catch { /* ignore */ }
      // Always force-attach self videoTrack as fallback
      const selfTrack = rtkClient.client.self?.videoTrack
      if (selfTrack && localVideoRef.current) {
        try {
          localVideoRef.current.srcObject = new MediaStream([selfTrack])
          localVideoRef.current.play().catch(() => {})
        } catch { /* ignore */ }
      }
    }, 150)
    return () => clearTimeout(timer)
  }, [callState, callType, isVideoOff])

  // Re-register video/audio elements when minimized state changes
  useEffect(() => {
    if (!rtkClient.client || !rtkClient.isInRoom) return
    // Use a microtask delay to ensure new video elements are mounted after restore
    const timer = setTimeout(() => {
      if (!rtkClient.client || !rtkClient.isInRoom) return
      // Re-register local video — always force clear & re-attach to handle stale srcObject
      if (callType === "video") {
        if (localVideoRef.current) {
          // Clear any stale srcObject from before minimize
          localVideoRef.current.srcObject = null
          try {
            rtkClient.client.self.registerVideoElement(localVideoRef.current, true)
          } catch { /* ignore */ }
          // Always force-attach self videoTrack directly
          const selfTrack = rtkClient.client.self?.videoTrack
          if (selfTrack && localVideoRef.current) {
            try {
              const stream = new MediaStream([selfTrack])
              localVideoRef.current.srcObject = stream
              localVideoRef.current.play().catch(() => {})
            } catch { /* ignore */ }
          }
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const remote = remoteParticipantRef.current as any
        if (remoteVideoRef.current && remote) {
          // Clear stale remote srcObject too
          remoteVideoRef.current.srcObject = null
          try {
            remote.registerVideoElement(remoteVideoRef.current)
          } catch { /* ignore */ }
          // Always force-attach remote videoTrack
          if (remote.videoTrack) {
            try {
              const stream = new MediaStream([remote.videoTrack])
              remoteVideoRef.current.srcObject = stream
              remoteVideoRef.current.play().catch(() => {})
            } catch { /* ignore */ }
          }
        }
      }
      // Re-setup remote audio via helper
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const remoteP = remoteParticipantRef.current as any
      if (remoteP) {
        setupRemoteAudio(remoteP)
      }
    }, 150) // Delay ensures DOM elements are mounted after restore
    return () => clearTimeout(timer)
  }, [callType, isMinimized, callState, setupRemoteAudio])

  // ── Loudspeaker toggle: force audio through loudspeaker ──
  useEffect(() => {
    if (!remoteAudioRef.current) return
    const audioEl = remoteAudioRef.current
    // Speaker ON = full volume (loudspeaker), OFF = lower volume (earpiece-style)
    audioEl.volume = isSpeakerOn ? 1.0 : 0.15
    // On supported devices, try to switch audio output
    // setSinkId('default') = loudspeaker, '' = default/earpiece
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const el = audioEl as any
    if (typeof el.setSinkId === "function") {
      el.setSinkId(isSpeakerOn ? "default" : "").catch(() => {
        // setSinkId not supported or failed — volume change still applies
      })
    }
  }, [isSpeakerOn])

  // ── Initiate outgoing call ──
  useEffect(() => {
    if (!open || isIncoming || callState !== "connecting" || callId) return
    // Guard: prevent double-initiation (React Strict Mode fires effects twice)
    if (isInitiatingRef.current) return
    isInitiatingRef.current = true

    async function startCall() {
      if (!receiverId) {
        isInitiatingRef.current = false
        setCallState("ended")
        return
      }
      console.log("[Caller] Initiating call to:", receiverId)
      const result = await initiateCall(receiverId, callType)
      if (result.success && result.callId && result.authToken) {
        console.log("[Caller] Call created with ID:", result.callId)
        setCallId(result.callId)
        authTokenRef.current = result.authToken
        onCallStarted?.(result.callId)
        setCallState("ringing")
        // Pre-init RTK during ringing so joinRoom() is instant when answer arrives
        rtkClient.init(result.authToken, {
          audio: true,
          video: callType === "video",
        }).then(() => {
          console.log("[Caller] RTK pre-initialized during ringing")
        }).catch((err) => {
          console.warn("[Caller] RTK pre-init failed (will retry on answer):", err)
        })
      } else {
        console.log("[Caller] Failed to initiate call:", result.error)
        isInitiatingRef.current = false
        // If the error is "busy" — show busy state instead of ended
        if (result.error === "User is on another call") {
          setCallState("busy")
        } else {
          setCallState("ended")
        }
      }
    }

    startCall()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isIncoming, callState, receiverId, callType])

  // Polling fallback for outgoing call answer detection (safety net if SSE misses the event)
  useEffect(() => {
    if (!open || isIncoming || !callId || callState !== "ringing") return
    let cancelled = false

    const pollInterval = setInterval(async () => {
      if (cancelled) return
      try {
        const result = await getCallStatus(callId)
        if (cancelled) return
        if (result.success && result.status) {
          if (result.status === "ongoing" && !hasJoinedRoomRef.current && !rtkClient.isInRoom) {
            // SSE missed the answer event — join room now
            console.log("[Caller] Fallback poll: detected answer, joining room...")
            clearInterval(pollInterval)
            const token = authTokenRef.current
            if (token) {
              try {
                await rtkClient.init(token, { audio: true, video: callType === "video" })
                await rtkClient.joinRoom()
                hasJoinedRoomRef.current = true
                try { await rtkClient.client?.self.enableAudio() } catch {}
                if (callType === "video") {
                  try { await rtkClient.client?.self.enableVideo() } catch {}
                }
              } catch (err) {
                console.error("[Caller] Fallback RTK join failed:", err)
                setCallState("ended")
              }
            }
          } else if (["declined", "missed", "failed", "completed"].includes(result.status)) {
            clearInterval(pollInterval)
            if (!isEndingRef.current) {
              isEndingRef.current = true
              setCallState("ended")
            }
          }
        }
      } catch {
        // Ignore poll errors
      }
    }, 4000) // 4s interval — SSE should handle this instantly, poll is just a safety net

    return () => {
      cancelled = true
      clearInterval(pollInterval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isIncoming, callState, callId, callType])

  // Reset state when dialog opens (but NOT when restoring from minimized or reconnecting)
  useEffect(() => {
    if (open) {
      // Guard: skip reset if already in an active/connected call (e.g. restoring from minimize)
      if (hasJoinedRoomRef.current || isConnectedRef.current) {
        return
      }
      // Guard: skip reset during reconnection — the reconnection effect handles state
      if (isReconnection) {
        return
      }
      // Guard: skip reset if user is in the process of answering
      // (handleAnswer sets this ref before calling handleRestore which changes open)
      if (isAnsweringRef.current) {
        return
      }
      setCallState(isIncoming ? "ringing" : "connecting")
      setIsMuted(false)
      setIsVideoOff(callType === "audio")
      setCallStartTime(null)
      setShowControls(true)
      setIsRemoteMuted(false)
      setIsAnswering(false)
      setIsEnding(false)
      isEndingRef.current = false
      hasJoinedRoomRef.current = false
      isConnectedRef.current = false
      isInitiatingRef.current = false
      authTokenRef.current = null
      remoteParticipantRef.current = null
      if (!isIncoming) setCallId(null)
      if (externalMinimized === undefined) {
        setInternalMinimized(false)
      }
    }
  }, [open, isIncoming, callType, externalMinimized, isReconnection])

  // ── Reconnection: auto-join RTK when reconnecting to an active call ──
  useEffect(() => {
    if (!isReconnection || !reconnectionAuthToken) return
    if (hasJoinedRoomRef.current || rtkClient.isInRoom) return

    // Set the original start time so the timer continues from where it was
    if (originalAnsweredAt) {
      setCallStartTime(new Date(originalAnsweredAt))
    }

    let cancelled = false

    async function reconnect() {
      console.log("[VideoCall] Reconnection: joining RTK with existing token")
      try {
        await rtkClient.init(reconnectionAuthToken!, {
          audio: true,
          video: callType === "video",
        })
        if (cancelled) return
        await rtkClient.joinRoom()
        hasJoinedRoomRef.current = true
        try { await rtkClient.client?.self.enableAudio() } catch {}
        if (callType === "video") {
          try { await rtkClient.client?.self.enableVideo() } catch {}
        }
        console.log("[VideoCall] Reconnection: joined room")
        // The participantJoined RTK event will set callState to "connected"
      } catch (err) {
        console.error("[VideoCall] Reconnection failed:", err)
        if (!cancelled) {
          setCallState("ended")
        }
      }
    }

    reconnect()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReconnection, reconnectionAuthToken, callType])

  // ── Start local camera preview immediately for video calls ──
  // Shows the user's own camera while connecting/ringing (before RTK init)
  useEffect(() => {
    if (!open || callType !== "video" || isVideoOff) return
    if (localVideoRef.current && !localVideoRef.current.srcObject) {
      let stream: MediaStream | null = null
      navigator.mediaDevices.getUserMedia({ video: true, audio: false }).then((s) => {
        stream = s
        if (localVideoRef.current && !rtkClient.client) {
          // Only use local preview if RTK hasn't taken over yet
          localVideoRef.current.srcObject = stream
          localVideoRef.current.play().catch(() => {})
        } else {
          // RTK is already managing the video — stop our preview
          stream.getTracks().forEach(t => t.stop())
        }
      }).catch(() => {
        // Camera permission denied or unavailable — that's ok
      })
      return () => {
        if (stream) {
          stream.getTracks().forEach(t => t.stop())
        }
      }
    }
  }, [open, callType, isVideoOff])

  // ── Call sounds ──
  useEffect(() => {
    if (callState === "ringing") {
      if (isIncoming) {
        callSounds.startIncomingRing()
      } else {
        callSounds.startOutgoingRing()
      }
    } else if (callState === "connected") {
      callSounds.playConnected()
    } else if (callState === "ended") {
      // Only play ended sound if we were actually connected or explicitly ended by user
      // This prevents the "ended" sound from firing during the connecting→connected transition
      if (isConnectedRef.current || isEndingRef.current) {
        callSounds.playEnded()
      }
    } else if (callState === "busy") {
      callSounds.stopRing()
      callSounds.playBusy()
    } else {
      callSounds.stopRing()
    }
    return () => {
      callSounds.stopAll()
    }
  }, [callState, isIncoming])

  // Auto-hide controls in connected state
  useEffect(() => {
    if (callState === "connected" && showControls && !isMinimized) {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
      controlsTimeoutRef.current = setTimeout(
        () => setShowControls(false),
        5000
      )
    }
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
    }
  }, [showControls, callState, isMinimized])

  // Auto-close after ended state shows for 2s
  // Only auto-close if we were actually connected or explicitly ending
  useEffect(() => {
    if (callState !== "ended" && callState !== "busy") return
    // If ended: only show ended screen if we were actually connected or explicitly ending
    if (callState === "ended" && !isConnectedRef.current && !isEndingRef.current) {
      return // Don't show ended screen — just wait for actual connection
    }
    const timer = setTimeout(() => {
      onCallEnded?.()
      onClose()
    }, callState === "busy" ? 3000 : 2000)
    return () => clearTimeout(timer)
  }, [callState, onCallEnded, onClose])

  // ── Answer incoming call (optimized: RTK init in parallel with server action) ──
  const handleAnswer = async () => {
    if (!incomingCallId || isAnswering) return
    isAnsweringRef.current = true
    setIsAnswering(true)
    console.log("[Receiver] Answering call ID:", incomingCallId)
    setCallState("connecting")

    // Expand to full screen when answering
    if (isMinimized) {
      handleRestore()
    }

    // Resume audio context during user gesture to satisfy autoplay policy
    callSounds.resume()

    // Determine the auth token — prefer pre-fetched one from SSE
    const token = incomingAuthToken || authTokenRef.current

    if (token) {
      // FAST PATH: We already have the token, start RTK init in parallel with server ack
      authTokenRef.current = token
      console.log("[Receiver] Fast path — starting RTK init in parallel with answerCall")

      const [answerResult] = await Promise.all([
        answerCall(incomingCallId),
        (async () => {
          try {
            await rtkClient.init(token, {
              audio: true,
              video: callType === "video",
            })
            console.log("[RTK] Receiver joining room (parallel)...")
            await rtkClient.joinRoom()
            hasJoinedRoomRef.current = true
            console.log("[RTK] Receiver joined room (parallel)")
            try { await rtkClient.client?.self.enableAudio() } catch {}
            if (callType === "video") {
              try { await rtkClient.client?.self.enableVideo() } catch {}
            }
          } catch (err) {
            console.error("[Receiver] Parallel RTK init/join failed:", err)
          }
        })(),
      ])

      if (!answerResult.success) {
        console.error("[Receiver] Answer failed:", answerResult.error)
        setIsAnswering(false)
        onCallEnded?.()
        onClose()
        return
      }

      // If RTK didn't join via parallel path (shouldn't happen), try with returned token
      if (!hasJoinedRoomRef.current && answerResult.authToken) {
        authTokenRef.current = answerResult.authToken
        try {
          await rtkClient.init(answerResult.authToken, {
            audio: true,
            video: callType === "video",
          })
          await rtkClient.joinRoom()
          hasJoinedRoomRef.current = true
          try { await rtkClient.client?.self.enableAudio() } catch {}
          if (callType === "video") {
            try { await rtkClient.client?.self.enableVideo() } catch {}
          }
        } catch (err) {
          console.error("[Receiver] Fallback RTK init/join failed:", err)
          setIsAnswering(false)
          setCallState("ended")
          return
        }
      }

      setIsAnswering(false)
      onCallStarted?.(incomingCallId)
    } else {
      // SLOW PATH: No pre-fetched token, must wait for answerCall
      console.log("[Receiver] Slow path — waiting for answerCall token")
      const result = await answerCall(incomingCallId)
      if (result.success && result.authToken) {
        authTokenRef.current = result.authToken
        try {
          await rtkClient.init(result.authToken, {
            audio: true,
            video: callType === "video",
          })
          console.log("[RTK] Receiver joining room...")
          await rtkClient.joinRoom()
          hasJoinedRoomRef.current = true
          console.log("[RTK] Receiver joined room")
          try { await rtkClient.client?.self.enableAudio() } catch {}
          if (callType === "video") {
            try { await rtkClient.client?.self.enableVideo() } catch {}
          }
          setIsAnswering(false)
          onCallStarted?.(incomingCallId)
        } catch (err) {
          console.error("[Receiver] RTK init/join failed:", err)
          setIsAnswering(false)
          setCallState("ended")
        }
      } else {
        console.error("[Receiver] Answer failed:", result.error)
        setIsAnswering(false)
        onCallEnded?.()
        onClose()
      }
    }
  }

  const handleDecline = async () => {
    callSounds.playDeclined()
    if (incomingCallId) {
      const { declineCall } = await import("@/lib/actions/calls")
      await declineCall(incomingCallId)
    }
    setCallState("ended")
  }

  const handleEndCall = async () => {
    if (isEndingRef.current || isEnding) return
    isEndingRef.current = true
    setIsEnding(true)
    // Cancel any pending participantLeft timer
    if (participantLeftTimerRef.current) {
      clearTimeout(participantLeftTimerRef.current)
      participantLeftTimerRef.current = null
    }
    // End on server (don't let failure block room leave)
    if (callId) {
      try { await endCallAction(callId) } catch (e) { console.error("End call server error:", e) }
    }
    // Leave RTK room
    try { await rtkClient.leaveRoom() } catch (e) { console.error("Leave room error:", e) }
    setIsEnding(false)
    setCallState("ended")
  }

  const handleMinimize = () => {
    if (onMinimize) {
      onMinimize()
    } else {
      setInternalMinimized(true)
    }
  }

  const handleRestore = () => {
    if (onRestore) {
      onRestore()
    } else {
      setInternalMinimized(false)
    }
    setShowControls(true)
  }

  const handleDismiss = useCallback(async () => {
    if (callId && !isEndingRef.current) {
      isEndingRef.current = true
      try { await endCallAction(callId) } catch {}
    }
    await rtkClient.leaveRoom()
    onCallEnded?.()
    onClose()
  }, [callId, onCallEnded, onClose])

  // ── Toggle mute/video via RTK SDK ──
  const toggleMute = async () => {
    const next = !isMuted
    setIsMuted(next)
    const c = rtkClient.client
    if (c?.self) {
      try {
        if (next) await c.self.disableAudio()
        else await c.self.enableAudio()
      } catch (e) {
        console.error("Toggle mute error:", e)
      }
    }
  }

  const toggleVideo = async () => {
    const next = !isVideoOff
    setIsVideoOff(next)
    const c = rtkClient.client
    if (c?.self) {
      try {
        if (next) await c.self.disableVideo()
        else await c.self.enableVideo()
      } catch (e) {
        console.error("Toggle video error:", e)
      }
    }
  }

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)

  const shouldRender =
    externalMinimized !== undefined ? open || isMinimized : open
  if (!shouldRender) return null

  // Hidden audio element for remote participant's audio stream
  // Note: using position/opacity instead of display:none — some mobile browsers
  // stop playing audio from hidden elements
  const remoteAudioElement = (
    <audio
      ref={remoteAudioRef}
      autoPlay
      playsInline
      className="absolute w-0 h-0 opacity-0 pointer-events-none"
    />
  )

  // ── Minimized floating pip ──
  if (isMinimized) {
    if (callState === "ended") {
      return (
        <div className="fixed bottom-24 right-4 z-[9999] animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border border-border/50 bg-background">
            <Avatar className="w-10 h-10">
              <AvatarImage src={callerAvatar} alt={callerName} />
              <AvatarFallback className="text-xs">
                {getInitials(callerName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                {callerName}
              </span>
              <span className="text-xs text-muted-foreground">Call ended</span>
            </div>
            <button
              onClick={handleDismiss}
              className="ml-1 w-7 h-7 rounded-full flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={14} />
            </button>
          </div>
        </div>
      )
    }

    return (
      <div
        className="fixed bottom-24 right-4 z-[9999] cursor-pointer animate-in slide-in-from-bottom-4 fade-in duration-200"
        onClick={handleRestore}
      >
        {remoteAudioElement}
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border border-border/50 bg-background">
          <div className="relative">
            <Avatar className="w-10 h-10">
              <AvatarImage src={callerAvatar} alt={callerName} />
              <AvatarFallback className="text-xs">
                {getInitials(callerName)}
              </AvatarFallback>
            </Avatar>
            {externalRemoteRejoined && (
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
                <HugeiconsIcon icon={WifiConnected01Icon} size={8} className="text-white" />
              </div>
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">
              {callerName}
            </span>
            {callState === "connected" ? (
              <CallTimer startTime={callStartTime} />
            ) : (
              <span className="text-xs text-muted-foreground">
                {callState === "ringing"
                  ? isIncoming
                    ? "Incoming..."
                    : "Calling..."
                  : "Connecting..."}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 ml-2">
            {/* Incoming ringing: show answer + decline */}
            {callState === "ringing" && isIncoming ? (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDecline()
                  }}
                  disabled={isAnswering}
                  className="w-9 h-9 rounded-full flex items-center justify-center bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
                >
                  <HugeiconsIcon icon={CallEnd01Icon} size={16} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleAnswer()
                  }}
                  disabled={isAnswering}
                  className="w-9 h-9 rounded-full flex items-center justify-center bg-green-500 text-white hover:bg-green-600 transition-colors disabled:opacity-50"
                >
                  {isAnswering ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <HugeiconsIcon
                      icon={callType === "video" ? Video01Icon : Call02Icon}
                      size={16}
                    />
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleMute()
                  }}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                    isMuted
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  )}
                >
                  <HugeiconsIcon
                    icon={isMuted ? MicOff01Icon : Mic01Icon}
                    size={14}
                  />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleEndCall()
                  }}
                  disabled={isEnding}
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
                >
                  {isEnding ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <HugeiconsIcon icon={CallEnd01Icon} size={14} />
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Modal call UI ──
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center">
      {remoteAudioElement}
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={callState === "ended" || callState === "busy" ? handleDismiss : undefined}
      />

      <div
        className="relative w-[95vw] h-[93vh] md:w-[90vw] md:h-[90vh] rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl bg-black animate-in fade-in zoom-in-95 duration-200"
        onClick={() =>
          callState === "connected" && setShowControls(!showControls)
        }
      >
        {/* Universal close button — always visible */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleDismiss()
          }}
          className="absolute top-4 right-4 z-50 w-9 h-9 rounded-full flex items-center justify-center bg-black/40 backdrop-blur-sm hover:bg-black/60 text-white/70 hover:text-white transition-all"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={18} />
        </button>
        {/* Background — local camera preview during ringing/connecting */}
        {callType === "video" &&
        !isVideoOff &&
        (callState === "ringing" || callState === "connecting") ? (
          <div className="absolute inset-0">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/40" />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Avatar className="w-28 h-28 mb-5">
                <AvatarImage src={callerAvatar} alt={callerName} />
                <AvatarFallback className="text-3xl bg-zinc-800 text-white">
                  {getInitials(callerName)}
                </AvatarFallback>
              </Avatar>
              <h3 className="text-white font-semibold text-xl">
                {callerName}
              </h3>
              <p className="text-white/50 text-sm mt-1">
                {callState === "ringing" &&
                  (isIncoming ? "Incoming call..." : "Ringing...")}
                {callState === "connecting" && "Connecting..."}
              </p>
              {callState === "ringing" && (
                <div className="mt-3 flex items-center justify-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-white/60 animate-pulse" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 rounded-full bg-white/60 animate-pulse" style={{ animationDelay: "300ms" }} />
                  <span className="w-2 h-2 rounded-full bg-white/60 animate-pulse" style={{ animationDelay: "600ms" }} />
                </div>
              )}
            </div>
          </div>
        ) : callState === "connected" && callType === "video" && !isVideoOff ? (
          <>  
            {/* Remote video (full screen) */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Remote mute indicator (video call) */}
            {isRemoteMuted && (
              <div className="absolute top-4 left-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm">
                <HugeiconsIcon icon={MicOff01Icon} size={12} className="text-red-400" />
                <span className="text-xs text-white/80">Muted</span>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-zinc-900 via-zinc-950 to-black">
            <Avatar className="w-28 h-28 mb-5">
              <AvatarImage src={callerAvatar} alt={callerName} />
              <AvatarFallback className="text-3xl bg-zinc-800 text-white">
                {getInitials(callerName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-2">
              <h3 className="text-white font-semibold text-xl">{callerName}</h3>
              {externalRemoteRejoined && callState === "connected" && (
                <HugeiconsIcon
                  icon={WifiConnected01Icon}
                  size={16}
                  className="text-green-400 animate-pulse"
                />
              )}
            </div>
            <p className="text-white/50 text-sm mt-1">
              {callState === "ringing" &&
                (isIncoming ? "Incoming call..." : "Ringing...")}
              {callState === "connecting" && "Connecting..."}
              {callState === "connected" && (
                <>
                  <CallTimer startTime={callStartTime} />
                  {isRemoteMuted && (
                    <span className="ml-2 inline-flex items-center gap-1 text-red-400">
                      <HugeiconsIcon icon={MicOff01Icon} size={10} />
                      <span className="text-[10px]">Muted</span>
                    </span>
                  )}
                </>
              )}
              {callState === "ended" && "Call ended"}
            </p>
            {callState === "ringing" && (
              <div className="mt-3 flex items-center justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-white/60 animate-pulse" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-white/60 animate-pulse" style={{ animationDelay: "300ms" }} />
                <span className="w-2 h-2 rounded-full bg-white/60 animate-pulse" style={{ animationDelay: "600ms" }} />
              </div>
            )}
          </div>
        )}

        {/* Local PIP (video calls when connected) */}
        {callState === "connected" && callType === "video" && !isVideoOff && (
          <div
            className="absolute top-6 right-6 w-32 md:w-44 aspect-[3/4] rounded-2xl overflow-hidden shadow-lg border border-white/10"
            style={{
              background: "rgba(0,0,0,0.3)",
              backdropFilter: "blur(4px)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Top bar — name + timer (video connected) + minimize */}
        {callState === "connected" && callType === "video" && (
          <div
            className={cn(
              "absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-4 pb-10 transition-all duration-300",
              showControls
                ? "opacity-100"
                : "opacity-0 pointer-events-none"
            )}
            style={{
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <div>
                <h3 className="text-white font-semibold text-lg">
                  {callerName}
                </h3>
                <CallTimer startTime={callStartTime} />
              </div>
              {externalRemoteRejoined && (
                <HugeiconsIcon
                  icon={WifiConnected01Icon}
                  size={16}
                  className="text-green-400 animate-pulse"
                />
              )}
            </div>
            <GlassButton onClick={handleMinimize}>
              <HugeiconsIcon
                icon={MinimizeScreenIcon}
                size={18}
                className="text-white"
              />
            </GlassButton>
          </div>
        )}

        {/* Incoming call — answer/decline */}
        {callState === "ringing" && isIncoming && (
          <div
            className="absolute bottom-0 left-0 right-0 pb-6 pt-8 px-6"
            style={{
              background:
                "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)",
            }}
          >
            <div className="flex items-center justify-center gap-20">
              <div className="flex flex-col items-center gap-2">
                <GlassButton
                  variant="danger"
                  size="large"
                  onClick={handleDecline}
                  disabled={isAnswering}
                >
                  <HugeiconsIcon
                    icon={CallEnd01Icon}
                    size={28}
                    className="text-white"
                  />
                </GlassButton>
                <span className="text-white/60 text-xs">Decline</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <GlassButton
                  variant="success"
                  size="large"
                  onClick={handleAnswer}
                  disabled={isAnswering}
                >
                  {isAnswering ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <HugeiconsIcon
                      icon={callType === "video" ? Video01Icon : Call02Icon}
                      size={28}
                      className="text-white"
                    />
                  )}
                </GlassButton>
                <span className="text-white/60 text-xs">
                  {isAnswering ? "Connecting..." : "Answer"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Controls — outgoing ringing or connected */}
        {(callState === "connected" ||
          (callState === "ringing" && !isIncoming) ||
          (callState === "connecting" && !isIncoming)) && (
          <div
            className={cn(
              "absolute bottom-0 left-0 right-0 pb-6 pt-6 px-6 transition-all duration-300",
              showControls || callState !== "connected"
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4 pointer-events-none"
            )}
            style={{
              background:
                "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-center gap-3">
              <GlassButton
                onClick={toggleMute}
                className={isMuted ? "!bg-white/90" : ""}
                size="default"
              >
                <HugeiconsIcon
                  icon={isMuted ? MicOff01Icon : Mic01Icon}
                  size={18}
                  className={isMuted ? "text-black" : "text-white"}
                />
              </GlassButton>

              {callType === "video" && (
                <GlassButton
                  onClick={toggleVideo}
                  className={isVideoOff ? "!bg-white/90" : ""}
                  size="default"
                >
                  <HugeiconsIcon
                    icon={isVideoOff ? VideoOffIcon : Video01Icon}
                    size={18}
                    className={isVideoOff ? "text-black" : "text-white"}
                  />
                </GlassButton>
              )}

              <GlassButton
                onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                className={!isSpeakerOn ? "!bg-white/90" : ""}
                size="default"
              >
                <HugeiconsIcon
                  icon={isSpeakerOn ? SpeakerIcon : Speaker01Icon}
                  size={18}
                  className={!isSpeakerOn ? "text-black" : "text-white"}
                />
              </GlassButton>

              {callState === "connected" && (
                <GlassButton
                  onClick={handleMinimize}
                  variant="transparent"
                  size="default"
                >
                  <HugeiconsIcon
                    icon={MinimizeScreenIcon}
                    size={16}
                    className="text-white/70"
                  />
                </GlassButton>
              )}

              <GlassButton
                variant="danger"
                size="large"
                onClick={handleEndCall}
                disabled={isEnding}
              >
                {isEnding ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <HugeiconsIcon
                    icon={CallEnd01Icon}
                    size={26}
                    className="text-white"
                  />
                )}
              </GlassButton>
            </div>
          </div>
        )}

        {/* Busy state — receiver is on another call */}
        {callState === "busy" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-zinc-900 via-zinc-950 to-black">
            <div className="flex flex-col items-center gap-3">
              <Avatar className="w-24 h-24 mb-3">
                <AvatarImage src={callerAvatar} alt={callerName} />
                <AvatarFallback className="text-2xl bg-zinc-800 text-white">
                  {getInitials(callerName)}
                </AvatarFallback>
              </Avatar>
              <div className="w-14 h-14 rounded-full flex items-center justify-center bg-orange-500/20 mb-1">
                <HugeiconsIcon
                  icon={Call02Icon}
                  size={24}
                  className="text-orange-400"
                />
              </div>
              <h3 className="text-white font-semibold text-lg">{callerName}</h3>
              <p className="text-white/50 text-sm">On another call</p>
              <button
                onClick={handleDismiss}
                className="mt-3 px-8 py-2.5 rounded-full text-sm font-medium bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Ended state — only show if we were connected or user explicitly ended */}
        {callState === "ended" && (isConnectedRef.current || isEndingRef.current) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-zinc-900 via-zinc-950 to-black">
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full flex items-center justify-center bg-red-500/20 mb-1">
                <HugeiconsIcon
                  icon={CallEnd01Icon}
                  size={28}
                  className="text-red-400"
                />
              </div>
              <p className="text-white/50 text-sm">Call ended</p>
              <button
                onClick={handleDismiss}
                className="mt-3 px-8 py-2.5 rounded-full text-sm font-medium bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
