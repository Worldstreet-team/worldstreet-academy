"use client"

import { useRef, useEffect } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { MicOff01Icon, ComputerScreenShareIcon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { rtkClient } from "@/lib/rtk-client"

const REACTIONS = [
  { id: "👏", emoji: "👏", label: "Clap" },
  { id: "❤️", emoji: "❤️", label: "Love" },
  { id: "😂", emoji: "😂", label: "Haha" },
  { id: "🎉", emoji: "🎉", label: "Celebrate" },
  { id: "👍", emoji: "👍", label: "Like" },
] as const

export { REACTIONS }

/* ── Base participant tile ── */

export function ParticipantTile({
  name,
  avatar,
  isMuted,
  isVideoOff,
  isLocal,
  speakingLevel = 0,
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
  speakingLevel?: number
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

  // Debug: log avatar prop
  if (!isScreenShare) {
    console.log("[ParticipantTile]", name, "avatar:", avatar || "NO AVATAR")
  }

  // Scale ring width based on speaking level (0-1)
  const isSpeaking = speakingLevel > 0.1
  const ringWidth = Math.min(4, 1 + speakingLevel * 4) // 1-4px dynamic

  return (
    <div
      className={cn(
        "relative rounded-2xl overflow-hidden flex items-center justify-center transition-all duration-150",
        "bg-neutral-200/60 dark:bg-zinc-900/70",
        cls,
      )}
      style={isSpeaking ? {
        boxShadow: `0 0 0 ${ringWidth}px rgba(52, 211, 153, ${0.4 + speakingLevel * 0.4})`,
      } : undefined}
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
            <AvatarImage src={avatar || ""} alt={name} />
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

/* ── Remote audio player ── */

export function RemoteAudioPlayer({
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

/* ── Remote participant tile (with video registration) ── */

export function RemoteParticipantTile({
  participantId,
  participant,
  handRaised,
  reactionId,
  speakingLevel = 0,
  className,
}: {
  participantId: string
  participant: { name: string; audioEnabled: boolean; videoEnabled: boolean; avatar?: string | null }
  handRaised?: boolean
  reactionId?: string | null
  speakingLevel?: number
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
      avatar={participant.avatar}
      isMuted={!participant.audioEnabled}
      isVideoOff={!participant.videoEnabled}
      handRaised={handRaised}
      reactionId={reactionId}
      speakingLevel={speakingLevel}
      videoRef={videoRef}
      className={className}
    />
  )
}

/* ── Screen share view ── */

export function ScreenShareView({
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
