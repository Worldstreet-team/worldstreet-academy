"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MeetingTimer } from "@/components/meetings/meeting-timer"
import type { MeetingWithDetails, MeetingHistoryEntry } from "@/lib/actions/meetings"
import { CalendarDaysIcon, ChevronDownIcon, ChevronRightIcon, ClockIcon, LoaderCircleIcon, Trash2Icon, UsersIcon, VideoIcon, XIcon } from "lucide-react"

/* ── Utility formatters ── */

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const hrs = Math.floor(mins / 60)
  if (hrs > 0) return `${hrs}h ${mins % 60}m`
  return `${mins}m`
}

export function formatTimeAgo(date: string): string {
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

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

/* ═════════════════════════════════════════════════════
   CREATE MEETING MODAL (Overlay)
   ═════════════════════════════════════════════════════ */

export function CreateMeetingModal({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (title: string) => void
}) {
  const [newTitle, setNewTitle] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  async function handleCreate() {
    if (!newTitle.trim()) return
    setIsCreating(true)
    onCreate(newTitle.trim())
    setNewTitle("")
    setIsCreating(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => onOpenChange(false)}
      />
      {/* Panel */}
      <div className="relative w-full max-w-sm mx-4 bg-card border border-ws-hairline rounded-lg shadow-[var(--ws-shadow-sheet)] overflow-hidden animate-in fade-in-0 zoom-in-95 duration-[var(--ws-motion-base)]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-ws-success/10 flex items-center justify-center">
              <VideoIcon  size={17} className="text-ws-success" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">New Meeting</h2>
              <p className="text-[11px] text-muted-foreground">Create and join instantly</p>
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted/80 transition-colors"
          >
            <XIcon  size={16} className="text-muted-foreground" />
          </button>
        </div>
        {/* Body */}
        <div className="px-5 pb-5 pt-3 space-y-3">
          <Input
            ref={inputRef}
            placeholder="Meeting name..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            className="h-10 text-sm bg-muted/30 border-ws-hairline focus-visible:ring-1 focus-visible:ring-ws-success/30"
          />
          <Button
            onClick={handleCreate}
            disabled={!newTitle.trim() || isCreating}
            className="w-full gap-2 h-10 bg-ws-success hover:bg-ws-success/90 text-white text-sm font-medium rounded-lg"
          >
            {isCreating ? (
              <>
                <LoaderCircleIcon  size={15} className="animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <VideoIcon  size={15} />
                Create &amp; Join
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ═════════════════════════════════════════════════════
   QUICK ACTIONS BAR (Hero)
   ═════════════════════════════════════════════════════ */

export function MeetingQuickActions({
  onCreateNew,
  onJoin,
}: {
  onCreateNew: () => void
  onSchedule?: () => void
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
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {/* Start Meeting card */}
      <button
        onClick={onCreateNew}
        className="group relative flex flex-col items-start justify-center p-4 h-[120px] sm:h-[130px] rounded-lg bg-card border border-ws-hairline overflow-hidden transition-all hover:border-ws-hairline"
      >
        {/* Illustration positioned at right middle */}
        <div className="absolute md:-right-8 -right-20 top-[54%] -translate-y-1/2 h-[102%] w-[65%] pointer-events-none">
          <Image
            src="/user/dashboard/create-new-meeting.png"
            alt=""
            fill
            className="object-contain object-center-right"
            priority
          />
        </div>
        <div className="relative z-10 text-left">
          <div className="w-9 h-9 rounded-lg bg-muted/80 flex items-center justify-center mb-2">
            <VideoIcon  size={17} className="text-foreground" />
          </div>
          <h3 className="font-semibold text-sm text-foreground">Start Meeting</h3>
          <p className="text-muted-foreground text-[11px] mt-0.5">Start an instant meeting</p>
        </div>
      </button>

      {/* Join card */}
      <div className="flex flex-col justify-between gap-3 p-4 rounded-lg border border-ws-hairline bg-card">
        <div>
          <h3 className="font-semibold text-sm">Join Meeting</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Enter a link or code</p>
        </div>
          <div className="flex gap-2">
            <Input
              placeholder="Meeting link or ID..."
              value={meetingId}
              onChange={(e) => {
                let val = e.target.value
                const match = val.match(/[?&]join=([a-f0-9]{24})/)
                if (match) val = match[1]
                setMeetingId(val)
              }}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              className="flex-1 h-9 text-sm"
            />
            <Button
              onClick={handleJoin}
              disabled={!meetingId.trim() || isJoining}
              size="sm"
              className="h-9 px-4"
            >
              {isJoining ? (
                <LoaderCircleIcon  size={14} className="animate-spin" />
              ) : (
                "Join"
              )}
            </Button>
          </div>
        </div>
      </div>
  )
}

/* ═════════════════════════════════════════════════════
   ACTIVE MEETINGS LIST
   ═════════════════════════════════════════════════════ */

export function ActiveMeetingsList({
  meetings,
  isLoading,
  userId,
  onRejoin,
}: {
  meetings: MeetingWithDetails[]
  isLoading: boolean
  userId: string
  onRejoin: (meeting: MeetingWithDetails) => void
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-[72px] rounded-lg bg-muted/40 animate-pulse" />
        ))}
      </div>
    )
  }

  if (meetings.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-ws-hairline p-8 text-center">
        <div className="relative w-28 h-28 mx-auto mb-3">
          <Image
            src="/user/dashboard/no-meeting-yet.png"
            alt="No meetings yet"
            fill
            className="object-contain opacity-80"
            priority
          />
        </div>
        <h3 className="font-semibold text-sm mb-1 text-foreground">No active meetings</h3>
        <p className="text-xs text-muted-foreground max-w-[240px] mx-auto leading-relaxed">
          Start a meeting to collaborate with screen sharing, chat, and polls.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {meetings.map((meeting) => {
        const isActive = meeting.status === "active"
        const thumbnailUrl = (meeting as MeetingWithDetails & { courseThumbnailUrl?: string }).courseThumbnailUrl
        const isHostMe = meeting.hostId === userId
        const hostName = isHostMe ? "You" : meeting.hostName
        
        return (
          <button
            key={meeting.id}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-ws-hairline bg-card hover:bg-muted/30 transition-all text-left group"
            onClick={() => onRejoin(meeting)}
          >
            {/* Thumbnail or icon */}
            <div className="relative w-11 h-11 rounded-lg overflow-hidden bg-muted/40 shrink-0 flex items-center justify-center">
              {thumbnailUrl ? (
                <Image src={thumbnailUrl} alt={meeting.title} fill className="object-cover" />
              ) : (
                <VideoIcon  size={18} className="text-muted-foreground/50" />
              )}
              {isActive && (
                <div className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-ws-success ring-2 ring-card" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-sm truncate">{meeting.title}</h3>
                {isActive && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-muted text-[10px] font-medium text-muted-foreground shrink-0">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-ws-success" />
                    </span>
                    Active
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
                {/* Participant avatars (up to 4 + "+N") */}
                {meeting.participantAvatars && meeting.participantAvatars.length > 0 ? (
                  <>
                    <div className="flex -space-x-1.5 shrink-0">
                      {meeting.participantAvatars.slice(0, 4).map((p, i) => (
                        <Avatar key={i} className="w-4 h-4 border border-card ring-1 ring-card">
                          {p.avatar && <AvatarImage src={p.avatar} alt={p.name} />}
                          <AvatarFallback className="text-[6px]">
                            {p.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {meeting.participantCount > 4 && (
                        <div className="flex items-center justify-center w-4 h-4 rounded-full border border-card ring-1 ring-card bg-muted text-[6px] font-semibold text-muted-foreground shrink-0">
                          +{meeting.participantCount - 4}
                        </div>
                      )}
                    </div>
                    <span className="text-muted-foreground/30">&middot;</span>
                  </>
                ) : (
                  <>
                    <Avatar className="w-4 h-4 border border-ws-hairline">
                      {meeting.hostAvatar && (
                        <AvatarImage src={meeting.hostAvatar} alt={hostName} />
                      )}
                      <AvatarFallback className="text-[6px]">
                        {hostName.split(" ").map(n => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-muted-foreground/30">&middot;</span>
                  </>
                )}
                <span className="truncate">{hostName}</span>
                <span className="text-muted-foreground/30">&middot;</span>
                <span className="flex items-center gap-0.5 shrink-0">
                  <UsersIcon  size={10} />
                  {meeting.participantCount}
                </span>
              </div>
            </div>
            <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex items-center gap-1 text-[11px] font-medium text-foreground">
                Rejoin
                <ChevronRightIcon  size={11} />
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

/* ═════════════════════════════════════════════════════
   MEETING HISTORY (with delete)
   ═════════════════════════════════════════════════════ */

export function MeetingHistory({
  history,
  isLoading,
  onDelete,
}: {
  history: MeetingHistoryEntry[]
  isLoading: boolean
  onDelete?: (meetingId: string) => void
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(e: React.MouseEvent, meetingId: string) {
    e.stopPropagation()
    setDeletingId(meetingId)
    onDelete?.(meetingId)
    setDeletingId(null)
  }

  if (isLoading) {
    return (
      <div className="space-y-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 rounded-lg bg-muted/20 animate-pulse" />
        ))}
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="py-10 text-center">
        <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
          <CalendarDaysIcon  size={18} className="text-muted-foreground/40" />
        </div>
        <p className="text-xs text-muted-foreground">No meeting history yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-px">
      {history.map((entry) => {
        const isExpanded = expandedId === entry.id
        return (
          <div key={entry.id}>
            <button
              onClick={() => setExpandedId(isExpanded ? null : entry.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/30 transition-colors text-left group"
            >
              {/* Stacked avatars (always visible) */}
              <div className="flex items-center -space-x-1.5 shrink-0">
                {entry.participants.length > 0 ? (
                  <>
                    {entry.participants.slice(0, 2).map((p) => (
                      <Avatar key={p.userId} className="w-7 h-7 ring-2 ring-card">
                        {p.avatar && <AvatarImage src={p.avatar} alt={p.name} />}
                        <AvatarFallback className="text-[8px] font-medium bg-muted text-muted-foreground">
                          {getInitials(p.name)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {entry.participants.length > 2 && (
                      <div className="w-7 h-7 rounded-full ring-2 ring-card bg-muted flex items-center justify-center">
                        <span className="text-[8px] font-semibold text-muted-foreground">
                          +{entry.participants.length - 2}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-7 h-7 rounded-full bg-muted/40 flex items-center justify-center">
                    <VideoIcon  size={12} className="text-muted-foreground/40" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium truncate leading-tight">{entry.title}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-muted-foreground/60">
                    {formatTimeAgo(entry.endedAt ?? entry.createdAt)}
                  </span>
                  {entry.duration != null && entry.duration > 0 && (
                    <>
                      <span className="text-muted-foreground/20">&middot;</span>
                      <span className="text-[10px] text-muted-foreground/60 flex items-center gap-0.5">
                        <ClockIcon  size={9} />
                        {formatDuration(entry.duration)}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <ChevronDownIcon
                
                size={13}
                className={cn(
                  "text-muted-foreground/40 shrink-0 transition-transform duration-[var(--ws-motion-base)]",
                  isExpanded && "rotate-180"
                )} />
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div className="px-3 pb-3 ml-5 space-y-2.5">
                <div className="text-[11px] text-muted-foreground/60">
                  {entry.wasHost ? "Hosted by you" : `Host: ${entry.hostName}`}
                  <span className="mx-1.5 text-muted-foreground/20">&middot;</span>
                  {entry.participantCount} participant{entry.participantCount !== 1 ? "s" : ""}
                </div>

                {entry.participants.length > 0 && (
                  <div className="space-y-1">
                    {entry.participants.map((p) => (
                      <div key={p.userId} className="flex items-center gap-2 py-0.5">
                        <Avatar className="w-5 h-5">
                          {p.avatar && <AvatarImage src={p.avatar} alt={p.name} />}
                          <AvatarFallback className="text-[7px] font-medium bg-muted text-muted-foreground">
                            {getInitials(p.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-[12px] text-foreground truncate flex-1">{p.name}</span>
                        {p.role === "host" && (
                          <span className="text-[9px] text-muted-foreground/50 uppercase tracking-wider">Host</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {onDelete && (
                  <button
                    onClick={(e) => handleDelete(e, entry.id)}
                    disabled={deletingId === entry.id}
                    className="flex items-center gap-1.5 text-[11px] text-muted-foreground/40 hover:text-ws-danger transition-colors pt-0.5"
                  >
                    <Trash2Icon  size={11} />
                    Remove
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ═════════════════════════════════════════════════════
   RETURN TO MEETING BANNER
   ═════════════════════════════════════════════════════ */

export function ReturnToMeetingBanner({
  meetingTitle,
  meetingStartTime,
  onReturn,
}: {
  meetingTitle: string
  meetingStartTime: Date | null
  onReturn: () => void
}) {
  return (
    <div className="px-4 pt-2">
      <button
        onClick={onReturn}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-ws-success/8 border border-ws-success/15 hover:bg-ws-success/12 transition-all"
      >
        <div className="w-10 h-10 rounded-lg bg-ws-success/10 flex items-center justify-center shrink-0">
          <VideoIcon  size={17} className="text-ws-success" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <span className="text-sm font-medium text-foreground truncate block">
            {meetingTitle}
          </span>
          <span className="text-xs text-ws-success dark:text-ws-success">
            Tap to return to meeting
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="relative inline-flex rounded-full h-2 w-2 bg-ws-success" />
          </span>
          <MeetingTimer startTime={meetingStartTime} />
        </div>
      </button>
    </div>
  )
}
