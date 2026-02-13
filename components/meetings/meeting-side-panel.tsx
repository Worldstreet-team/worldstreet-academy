"use client"

import { useRef, useEffect, useState } from "react"
import Image from "next/image"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Cancel01Icon,
  MicOff01Icon,
  VideoOffIcon,
  ComputerScreenShareIcon,
  BubbleChatIcon,
  ChartColumnIcon,
  ArrowRight01Icon,
  Add01Icon,
  UserGroupIcon,
  SentIcon,
  Tick02Icon,
  ArrowDown01Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"

export type ActiveTab = "people" | "chat" | "polls"

export type ChatMessage = {
  id: string
  userId: string
  userName: string
  userAvatar: string | null
  message: string
  imageUrl?: string
  videoUrl?: string
  timestamp: number
}

export type PollVoter = {
  userId: string
  userName: string
  userAvatar: string | null
}

export type Poll = {
  id: string
  question: string
  options: string[]
  votes: Record<string, number>
  voters: Set<string>
  voterDetails: Record<string, PollVoter[]> // Maps option index to array of voters
  createdBy: string
  createdByName: string
}

/* ── People Tab ── */

type StageRequest = { userId: string; userName: string; userAvatar: string | null }

function PeopleTab({
  userId,
  userName,
  userAvatar,
  isHost,
  isMuted,
  myHandRaised,
  myRole,
  activeMeetingHostId,
  remoteParticipants,
  participantRoles,
  raisedHands,
  admittedParticipants,
  stageRequests,
  screenSharePermissions,
  onKick,
  onMuteParticipant,
  onToggleScreenSharePerm,
  onInviteToStage,
  onRemoveFromStage,
  onAcceptStageRequest,
  onDeclineStageRequest,
}: {
  userId: string
  userName: string
  userAvatar: string | null
  isHost: boolean
  isMuted: boolean
  myHandRaised: boolean
  myRole: "host" | "participant" | "guest"
  activeMeetingHostId: string
  remoteParticipants: Map<string, { name: string; audioEnabled: boolean; videoEnabled: boolean; userId?: string; avatar?: string | null }>
  participantRoles: Map<string, string>
  raisedHands: Set<string>
  admittedParticipants: Array<{ userId: string; name: string; avatar: string | null; role?: string }>
  stageRequests: StageRequest[]
  screenSharePermissions: Map<string, boolean>
  onKick: (userId: string) => void
  onMuteParticipant: (userId: string, muteType: "audio" | "video" | "screenshare") => void
  onToggleScreenSharePerm: (userId: string) => void
  onInviteToStage: (userId: string) => void
  onRemoveFromStage: (userId: string) => void
  onAcceptStageRequest: (userId: string) => void
  onDeclineStageRequest: (userId: string) => void
}) {
  // Classify participants into stage and audience
  const stageEntries: Array<{ id: string; name: string; audioEnabled: boolean; videoEnabled: boolean; userId?: string; avatar?: string | null; isLocal?: boolean }> = []
  const audienceEntries: Array<{ id: string; name: string; audioEnabled: boolean; videoEnabled: boolean; userId?: string; avatar?: string | null }> = []

  // Local user
  const isLocalOnStage = myRole === "host" || myRole === "participant"

  // Remote participants
  console.log("[Sidebar] Processing", remoteParticipants.size, "remote participants")
  for (const [id, p] of remoteParticipants.entries()) {
    console.log("[Sidebar] Participant:", p.name, "has avatar:", !!p.avatar, p.avatar)
    const uid = p.userId || id
    const role = participantRoles.get(uid) || "participant"
    if (role === "guest") {
      audienceEntries.push({ id, ...p })
    } else {
      stageEntries.push({ id, ...p })
    }
  }

  // Offline admitted (show at bottom of their section)
  const offlineAdmitted = admittedParticipants.filter(
    (p) => p.userId !== userId && !Array.from(remoteParticipants.values()).some((rp) => (rp.userId || "") === p.userId)
  )

  const totalOnStage = stageEntries.length + (isLocalOnStage ? 1 : 0)
  const totalAudience = audienceEntries.length + (!isLocalOnStage ? 1 : 0)

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Stage Requests */}
      {isHost && stageRequests.length > 0 && (
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-foreground/40 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-foreground/60" />
            </span>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Requests ({stageRequests.length})
            </span>
          </div>
          <div className="space-y-1.5">
            {stageRequests.map((req) => (
              <div key={req.userId} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/40">
                <Avatar className="w-7 h-7">
                  {req.userAvatar && <AvatarImage src={req.userAvatar} alt={req.userName} />}
                  <AvatarFallback className="text-[9px] font-medium bg-muted text-muted-foreground">
                    {req.userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-[13px] font-medium flex-1 truncate">{req.userName}</span>
                <button onClick={() => onAcceptStageRequest(req.userId)} className="h-7 px-3 rounded-md text-[11px] font-medium bg-foreground text-background hover:opacity-90 transition-opacity">
                  Accept
                </button>
                <button onClick={() => onDeclineStageRequest(req.userId)} className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors">
                  <HugeiconsIcon icon={Cancel01Icon} size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* On Stage */}
      <div className="px-4 py-3">
        <p className="text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider mb-1.5">
          On Stage · {totalOnStage}
        </p>
        
        <div className="space-y-px">
          {/* Local user (if on stage) */}
          {isLocalOnStage && (
            <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted/30 transition-colors">
              <Avatar className="w-8 h-8">
                {userAvatar && <AvatarImage src={userAvatar} alt="You" />}
                <AvatarFallback className="text-[9px] font-medium bg-muted text-muted-foreground">
                  {userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-medium text-foreground truncate">{userName}</span>
                  <span className="text-[10px] text-muted-foreground/60">(You)</span>
                </div>
                {isHost && <span className="text-[10px] text-muted-foreground/60">Host</span>}
              </div>
              <div className="flex items-center gap-1">
                {myHandRaised && <span className="text-xs">✋</span>}
                {isMuted && <HugeiconsIcon icon={MicOff01Icon} size={13} className="text-red-400/80" />}
              </div>
            </div>
          )}

          {/* Remote stage participants */}
          {stageEntries.map(({ id, name, audioEnabled, videoEnabled, userId: uid, avatar }) => {
            const pUid = uid || id
            const isParticipantHost = pUid === activeMeetingHostId
            return (
              <div key={id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted/30 transition-colors group">
                <Avatar className="w-8 h-8">
                  {avatar && <AvatarImage src={avatar} alt={name} />}
                  <AvatarFallback className="text-[9px] font-medium bg-muted text-muted-foreground">
                    {name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] font-medium text-foreground truncate block">{name}</span>
                  {isParticipantHost && <span className="text-[10px] text-muted-foreground/60">Host</span>}
                </div>
                <div className="flex items-center gap-1">
                  {raisedHands.has(pUid) && <span className="text-xs">✋</span>}
                  {!audioEnabled && <HugeiconsIcon icon={MicOff01Icon} size={13} className="text-red-400/80" />}
                </div>
                {isHost && !isParticipantHost && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {audioEnabled && (
                      <button onClick={() => onMuteParticipant(pUid, "audio")} title="Mute audio" className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-muted/80 transition-colors">
                        <HugeiconsIcon icon={MicOff01Icon} size={13} className="text-muted-foreground" />
                      </button>
                    )}
                    {videoEnabled && (
                      <button onClick={() => onMuteParticipant(pUid, "video")} title="Mute video" className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-muted/80 transition-colors">
                        <HugeiconsIcon icon={VideoOffIcon} size={13} className="text-muted-foreground" />
                      </button>
                    )}
                    <button onClick={() => onToggleScreenSharePerm(pUid)} title="Screen share" className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-muted/80 transition-colors">
                      <HugeiconsIcon icon={ComputerScreenShareIcon} size={13} className={screenSharePermissions.get(pUid) === false ? "text-red-400/80" : "text-muted-foreground"} />
                    </button>
                    <button onClick={() => onRemoveFromStage(pUid)} title="Move to audience" className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-muted/80 transition-colors">
                      <HugeiconsIcon icon={ArrowRight01Icon} size={13} className="text-muted-foreground rotate-90" />
                    </button>
                    <button onClick={() => onKick(pUid)} title="Remove" className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-red-500/10 transition-colors">
                      <HugeiconsIcon icon={Cancel01Icon} size={13} className="text-red-400/70" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Audience */}
      {(totalAudience > 0 || offlineAdmitted.length > 0) && (
        <div className="px-4 py-3">
          <p className="text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider mb-1.5">
            Audience · {totalAudience}
          </p>
          
          <div className="space-y-px">
            {/* Local user (if guest) */}
            {!isLocalOnStage && (
              <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted/30 transition-colors">
                <Avatar className="w-8 h-8">
                  {userAvatar && <AvatarImage src={userAvatar} alt="You" />}
                  <AvatarFallback className="text-[9px] font-medium bg-muted text-muted-foreground">
                    {userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-medium text-foreground truncate">{userName}</span>
                    <span className="text-[10px] text-muted-foreground/60">(You)</span>
                  </div>
                </div>
              </div>
            )}

            {/* Remote audience */}
            {audienceEntries.map(({ id, name, userId: uid, avatar }) => {
              const pUid = uid || id
              return (
                <div key={id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted/30 transition-colors group">
                  <Avatar className="w-8 h-8">
                    {avatar && <AvatarImage src={avatar} alt={name} />}
                    <AvatarFallback className="text-[9px] font-medium bg-muted text-muted-foreground">
                      {name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-[13px] text-foreground truncate flex-1">{name}</span>
                  {raisedHands.has(pUid) && <span className="text-xs">✋</span>}
                  {isHost && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => onInviteToStage(pUid)} title="Add to stage" className="h-6 px-2.5 rounded-md text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors">
                        Add
                      </button>
                      <button onClick={() => onKick(pUid)} title="Remove" className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-red-500/10 transition-colors">
                        <HugeiconsIcon icon={Cancel01Icon} size={12} className="text-red-400/70" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Offline */}
            {offlineAdmitted.map((p) => (
              <div key={p.userId} className="flex items-center gap-3 px-2 py-2 rounded-lg opacity-40">
                <Avatar className="w-8 h-8">
                  {p.avatar && <AvatarImage src={p.avatar} alt={p.name} />}
                  <AvatarFallback className="text-[9px] font-medium bg-muted text-muted-foreground">
                    {p.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-[13px] text-muted-foreground flex-1 truncate">{p.name}</span>
                <span className="text-[9px] text-muted-foreground/50">offline</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Chat Tab ── */

function ChatTab({
  userId,
  chatMessages,
  chatInput,
  onChatInputChange,
  onSendChat,
}: {
  userId: string
  chatMessages: ChatMessage[]
  chatInput: string
  onChatInputChange: (value: string) => void
  onSendChat: () => void
}) {
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages.length])

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {chatMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground/30">
            <HugeiconsIcon icon={BubbleChatIcon} size={28} />
            <div className="text-center">
              <p className="text-[13px] font-medium text-muted-foreground/60">No messages yet</p>
              <p className="text-xs text-muted-foreground/40">Be the first to say hello</p>
            </div>
          </div>
        )}
        <div className="space-y-3">
          {chatMessages.map((msg) => {
            const isMe = msg.userId === userId
            return (
              <div key={msg.id} className={cn("flex gap-2.5", isMe && "flex-row-reverse")}>
                <Avatar className="w-7 h-7 shrink-0 mt-0.5">
                  {msg.userAvatar && <AvatarImage src={msg.userAvatar} alt={msg.userName} />}
                  <AvatarFallback className="text-[8px] font-medium bg-muted text-muted-foreground">
                    {msg.userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className={cn("max-w-[75%] space-y-0.5", isMe && "items-end")}>
                  <div className={cn("flex items-center gap-2", isMe && "flex-row-reverse")}>
                    <span className="text-[10px] font-medium text-muted-foreground">{isMe ? "You" : msg.userName}</span>
                    <span className="text-[9px] text-muted-foreground/50">{formatTime(msg.timestamp)}</span>
                  </div>
                  {msg.message && (
                    <div className={cn(
                      "px-3 py-2 rounded-xl text-sm leading-relaxed",
                      isMe
                        ? "bg-foreground text-background rounded-br-md"
                        : "bg-muted/70 text-foreground rounded-bl-md",
                    )}>
                      {msg.message}
                    </div>
                  )}
                  {msg.imageUrl && (
                    <Image src={msg.imageUrl} alt="" width={200} height={150} className="mt-1.5 rounded-xl object-cover" />
                  )}
                  {msg.videoUrl && <video src={msg.videoUrl} controls className="mt-1.5 rounded-xl max-w-full max-h-40" />}
                </div>
              </div>
            )
          })}
        </div>
        <div ref={chatEndRef} />
      </div>
      
      {/* Input */}
      <div className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-3">
        <div className="flex items-center gap-2 p-1 rounded-lg bg-muted/40">
          <Input
            value={chatInput}
            onChange={(e) => onChatInputChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && onSendChat()}
            placeholder="Type a message..."
            className="flex-1 h-8 text-sm bg-transparent border-0 focus-visible:ring-0 shadow-none"
          />
          <button
            onClick={onSendChat}
            disabled={!chatInput.trim()}
            className="w-8 h-8 rounded-md bg-foreground text-background flex items-center justify-center disabled:opacity-30 transition-opacity"
          >
            <HugeiconsIcon icon={SentIcon} size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Polls Tab ── */

function PollsTab({
  isHost,
  polls,
  myVotes,
  showCreatePoll,
  pollQuestion,
  pollOptions,
  onSetShowCreatePoll,
  onPollQuestionChange,
  onPollOptionChange,
  onAddPollOption,
  onRemovePollOption,
  onCreatePoll,
  onVotePoll,
}: {
  isHost: boolean
  polls: Poll[]
  myVotes: Set<string>
  showCreatePoll: boolean
  pollQuestion: string
  pollOptions: string[]
  onSetShowCreatePoll: (show: boolean) => void
  onPollQuestionChange: (value: string) => void
  onPollOptionChange: (index: number, value: string) => void
  onAddPollOption: () => void
  onRemovePollOption: (index: number) => void
  onCreatePoll: () => void
  onVotePoll: (pollId: string, optionIndex: number) => void
}) {
  const [expandedPolls, setExpandedPolls] = useState<Set<string>>(new Set())

  const togglePollExpansion = (pollId: string) => {
    setExpandedPolls((prev) => {
      const next = new Set(prev)
      if (next.has(pollId)) {
        next.delete(pollId)
      } else {
        next.add(pollId)
      }
      return next
    })
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {polls.length === 0 && !showCreatePoll && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground/30">
            <HugeiconsIcon icon={ChartColumnIcon} size={28} />
            <div className="text-center">
              <p className="text-[13px] font-medium text-muted-foreground/60">No polls yet</p>
              {isHost && <p className="text-xs text-muted-foreground/40">Create one to engage participants</p>}
            </div>
          </div>
        )}
        
        {polls.map((poll) => {
          const totalVotes = Object.values(poll.votes).reduce((a, b) => a + b, 0)
          const hasVoted = myVotes.has(poll.id)
          const showResults = hasVoted || isHost
          const isExpanded = expandedPolls.has(poll.id)
          return (
            <div key={poll.id} className="rounded-xl bg-muted/20 p-3.5 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] font-semibold text-foreground leading-snug">{poll.question}</p>
                {hasVoted && (
                  <div className="shrink-0 w-5 h-5 rounded-full bg-muted/60 flex items-center justify-center">
                    <HugeiconsIcon icon={Tick02Icon} size={12} className="text-foreground/70" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {poll.options.map((opt, i) => {
                  const count = poll.votes[String(i)] || 0
                  const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
                  const optionVoters = poll.voterDetails?.[String(i)] || []
                  return (
                    <div key={i}>
                      <button
                        disabled={hasVoted}
                        onClick={() => onVotePoll(poll.id, i)}
                        className={cn(
                          "relative w-full text-left px-3 py-2 rounded-lg transition-all overflow-hidden",
                          hasVoted
                            ? "bg-muted/40 cursor-default"
                            : "bg-muted/20 hover:bg-muted/40 cursor-pointer",
                        )}
                      >
                        {showResults && (
                          <div className="absolute inset-y-0 left-0 bg-foreground/8 transition-all duration-500 ease-out" style={{ width: `${pct}%` }} />
                        )}
                        <div className="relative flex items-center justify-between">
                          <span className="text-sm text-foreground">{opt}</span>
                          {showResults && (
                            <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                              {pct}% {isHost && count > 0 && `(${count})`}
                            </span>
                          )}
                        </div>
                      </button>
                      {/* Show voter details for hosts when expanded */}
                      {isHost && isExpanded && showResults && optionVoters.length > 0 && (
                        <div className="mt-1.5 ml-3 space-y-1">
                          {optionVoters.map((voter) => (
                            <div key={voter.userId} className="flex items-center gap-2 px-2 py-1">
                              <Avatar className="w-4 h-4">
                                {voter.userAvatar && <AvatarImage src={voter.userAvatar} alt={voter.userName} />}
                                <AvatarFallback className="text-[8px] font-medium bg-muted text-muted-foreground">
                                  {voter.userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-[11px] text-muted-foreground">{voter.userName}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center justify-between pt-1">
                <p className="text-[10px] text-muted-foreground/60">by {poll.createdByName}</p>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] text-muted-foreground/60">{totalVotes} vote{totalVotes !== 1 ? "s" : ""}</p>
                  {isHost && showResults && totalVotes > 0 && (
                    <button
                      onClick={() => togglePollExpansion(poll.id)}
                      className="flex items-center gap-1 text-[10px] text-foreground/60 hover:text-foreground transition-colors"
                    >
                      <span>{isExpanded ? "Hide" : "View"} Details</span>
                      <HugeiconsIcon
                        icon={ArrowDown01Icon}
                        size={10}
                        className={cn("transition-transform", isExpanded && "rotate-180")}
                      />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        
        {showCreatePoll && (
          <div className="rounded-xl bg-muted/20 p-3.5 space-y-3">
            <Input
              value={pollQuestion}
              onChange={(e) => onPollQuestionChange(e.target.value)}
              placeholder="Ask a question..."
              className="h-9 text-sm bg-transparent border-muted/60"
              autoFocus
            />
            <div className="space-y-2">
              {pollOptions.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={opt}
                    onChange={(e) => onPollOptionChange(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    className="h-8 text-sm bg-transparent border-muted/60 flex-1"
                  />
                  {pollOptions.length > 2 && (
                    <button onClick={() => onRemovePollOption(i)} className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-muted/60 transition-colors">
                      <HugeiconsIcon icon={Cancel01Icon} size={12} className="text-muted-foreground" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {pollOptions.length < 6 && (
              <button onClick={onAddPollOption} className="text-xs font-medium text-foreground/70 hover:text-foreground transition-colors">
                + Add another option
              </button>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={onCreatePoll}
                disabled={!pollQuestion.trim() || pollOptions.filter((o) => o.trim()).length < 2}
                className="flex-1 h-8 text-[13px] font-medium rounded-lg bg-foreground text-background disabled:opacity-30 transition-opacity"
              >
                Create Poll
              </button>
              <button onClick={() => onSetShowCreatePoll(false)} className="h-8 px-3 rounded-lg text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      
      {isHost && !showCreatePoll && polls.length > 0 && (
        <div className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-3">
          <button onClick={() => onSetShowCreatePoll(true)} className="w-full h-9 rounded-lg bg-muted/40 text-[13px] font-medium text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 transition-colors">
            <HugeiconsIcon icon={Add01Icon} size={13} />
            New Poll
          </button>
        </div>
      )}
      {isHost && !showCreatePoll && polls.length === 0 && (
        <div className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-3">
          <button onClick={() => onSetShowCreatePoll(true)} className="w-full h-9 rounded-lg bg-foreground text-background text-[13px] font-medium flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity">
            <HugeiconsIcon icon={Add01Icon} size={13} />
            Create Poll
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Main Side Panel ── */

export function MeetingSidePanel({
  activeTab,
  onTabChange,
  unreadChat,
  // People props
  userId,
  userName,
  userAvatar,
  isHost,
  isMuted,
  myHandRaised,
  myRole,
  activeMeetingHostId,
  remoteParticipants,
  participantRoles,
  raisedHands,
  admittedParticipants,
  stageRequests,
  screenSharePermissions,
  onKick,
  onMuteParticipant,
  onToggleScreenSharePerm,
  onInviteToStage,
  onRemoveFromStage,
  onAcceptStageRequest,
  onDeclineStageRequest,
  // Chat props
  chatMessages,
  chatInput,
  onChatInputChange,
  onSendChat,
  // Polls props
  polls,
  myVotes,
  showCreatePoll,
  pollQuestion,
  pollOptions,
  onSetShowCreatePoll,
  onPollQuestionChange,
  onPollOptionChange,
  onAddPollOption,
  onRemovePollOption,
  onCreatePoll,
  onVotePoll,
}: {
  activeTab: ActiveTab
  onTabChange: (tab: ActiveTab | null) => void
  unreadChat: number
  userId: string
  userName: string
  userAvatar: string | null
  isHost: boolean
  isMuted: boolean
  myHandRaised: boolean
  myRole: "host" | "participant" | "guest"
  activeMeetingHostId: string
  remoteParticipants: Map<string, { name: string; audioEnabled: boolean; videoEnabled: boolean; userId?: string; avatar?: string | null }>
  participantRoles: Map<string, string>
  raisedHands: Set<string>
  admittedParticipants: Array<{ userId: string; name: string; avatar: string | null; role?: string }>
  stageRequests: Array<{ userId: string; userName: string; userAvatar: string | null }>
  screenSharePermissions: Map<string, boolean>
  onKick: (userId: string) => void
  onMuteParticipant: (userId: string, muteType: "audio" | "video" | "screenshare") => void
  onToggleScreenSharePerm: (userId: string) => void
  onInviteToStage: (userId: string) => void
  onRemoveFromStage: (userId: string) => void
  onAcceptStageRequest: (userId: string) => void
  onDeclineStageRequest: (userId: string) => void
  chatMessages: ChatMessage[]
  chatInput: string
  onChatInputChange: (value: string) => void
  onSendChat: () => void
  polls: Poll[]
  myVotes: Set<string>
  showCreatePoll: boolean
  pollQuestion: string
  pollOptions: string[]
  onSetShowCreatePoll: (show: boolean) => void
  onPollQuestionChange: (value: string) => void
  onPollOptionChange: (index: number, value: string) => void
  onAddPollOption: () => void
  onRemovePollOption: (index: number) => void
  onCreatePoll: () => void
  onVotePoll: (pollId: string, optionIndex: number) => void
}) {
  const stageRequestCount = stageRequests.length
  
  const TAB_ICONS = {
    people: UserGroupIcon,
    chat: BubbleChatIcon,
    polls: ChartColumnIcon,
  } as const
  
  return (
    <div className="fixed md:absolute inset-0 md:inset-auto md:top-12 md:right-3 md:bottom-24 z-40 md:w-85 md:rounded-xl flex flex-col overflow-hidden animate-in slide-in-from-right-4 fade-in duration-200 bg-background/98 backdrop-blur-2xl border border-border/20 shadow-xl shadow-black/5">
      {/* Header with tabs */}
      <div className="flex items-center justify-between px-1 pt-[max(0.5rem,env(safe-area-inset-top))] md:pt-1.5 pb-0">
        <div className="flex-1 flex">
          {(["people", "chat", "polls"] as ActiveTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold capitalize transition-all relative",
                activeTab === tab
                  ? "text-foreground"
                  : "text-muted-foreground/70 hover:text-muted-foreground",
              )}
            >
              <HugeiconsIcon icon={TAB_ICONS[tab]} size={14} className={activeTab === tab ? "text-foreground" : ""} />
              <span className="hidden xs:inline">{tab}</span>
              
              {/* Badge */}
              {tab === "people" && stageRequestCount > 0 && activeTab !== "people" && (
                <span className="absolute top-2 right-2 xs:right-1/4 min-w-4.5 h-4.5 px-1 rounded-full bg-foreground text-[10px] flex items-center justify-center text-background font-bold">
                  {stageRequestCount}
                </span>
              )}
              {tab === "chat" && unreadChat > 0 && activeTab !== "chat" && (
                <span className="absolute top-2 right-2 xs:right-1/4 min-w-4.5 h-4.5 px-1 rounded-full bg-foreground text-[10px] flex items-center justify-center text-background font-bold">
                  {unreadChat > 9 ? "9+" : unreadChat}
                </span>
              )}
              
              {/* Active indicator */}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-1/4 right-1/4 h-[1.5px] bg-foreground/80 rounded-full" />
              )}
            </button>
          ))}
        </div>
        <button onClick={() => onTabChange(null)} className="w-9 h-9 rounded-lg flex items-center justify-center mr-1 hover:bg-muted/60 transition-colors">
          <HugeiconsIcon icon={Cancel01Icon} size={16} className="text-muted-foreground" />
        </button>
      </div>

      {activeTab === "people" && (
        <PeopleTab
          userId={userId}
          userName={userName}
          userAvatar={userAvatar}
          isHost={isHost}
          isMuted={isMuted}
          myHandRaised={myHandRaised}
          myRole={myRole}
          activeMeetingHostId={activeMeetingHostId}
          remoteParticipants={remoteParticipants}
          participantRoles={participantRoles}
          raisedHands={raisedHands}
          admittedParticipants={admittedParticipants}
          stageRequests={stageRequests}
          screenSharePermissions={screenSharePermissions}
          onKick={onKick}
          onMuteParticipant={onMuteParticipant}
          onToggleScreenSharePerm={onToggleScreenSharePerm}
          onInviteToStage={onInviteToStage}
          onRemoveFromStage={onRemoveFromStage}
          onAcceptStageRequest={onAcceptStageRequest}
          onDeclineStageRequest={onDeclineStageRequest}
        />
      )}
      {activeTab === "chat" && (
        <ChatTab
          userId={userId}
          chatMessages={chatMessages}
          chatInput={chatInput}
          onChatInputChange={onChatInputChange}
          onSendChat={onSendChat}
        />
      )}
      {activeTab === "polls" && (
        <PollsTab
          isHost={isHost}
          polls={polls}
          myVotes={myVotes}
          showCreatePoll={showCreatePoll}
          pollQuestion={pollQuestion}
          pollOptions={pollOptions}
          onSetShowCreatePoll={onSetShowCreatePoll}
          onPollQuestionChange={onPollQuestionChange}
          onPollOptionChange={onPollOptionChange}
          onAddPollOption={onAddPollOption}
          onRemovePollOption={onRemovePollOption}
          onCreatePoll={onCreatePoll}
          onVotePoll={onVotePoll}
        />
      )}
    </div>
  )
}
