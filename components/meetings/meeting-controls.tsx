"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  Mic01Icon,
  MicOff01Icon,
  Video01Icon,
  VideoOffIcon,
  CallEnd01Icon,
  ComputerScreenShareIcon,
  VolumeHighIcon,
  BubbleChatIcon,
  ChartColumnIcon,
  UserGroupIcon,
  Cancel01Icon,
  Mic02Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { REACTIONS } from "@/components/meetings/participant-tiles"
import type { ActiveTab } from "@/components/meetings/meeting-side-panel"

type MeetingControlsProps = {
  isMuted: boolean
  isVideoOff: boolean
  isScreenSharing: boolean
  isLoudspeaker: boolean
  isMobile: boolean
  isHost: boolean
  isEndingMeeting: boolean
  myHandRaised: boolean
  myRole: "host" | "participant" | "guest"
  hasRequestedStage: boolean
  showReactionPicker: boolean
  activeTab: ActiveTab | null
  unreadChat: number
  pendingRequestCount: number
  stageRequestCount: number
  screenShareDisabled: boolean
  onToggleMute: () => void
  onToggleVideo: () => void
  onToggleScreenShare: () => void
  onToggleLoudspeaker: () => void
  onToggleHand: () => void
  onReaction: (reactionId: string) => void
  onToggleReactionPicker: () => void
  onTabChange: (tab: ActiveTab | null) => void
  onRequestStage: () => void
  onEndMeeting: () => void
}

export function MeetingControls({
  isMuted,
  isVideoOff,
  isScreenSharing,
  isLoudspeaker,
  isMobile,
  isHost,
  isEndingMeeting,
  myHandRaised,
  myRole,
  hasRequestedStage,
  showReactionPicker,
  activeTab,
  unreadChat,
  pendingRequestCount,
  stageRequestCount,
  screenShareDisabled,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onToggleLoudspeaker,
  onToggleHand,
  onReaction,
  onToggleReactionPicker,
  onTabChange,
  onRequestStage,
  onEndMeeting,
}: MeetingControlsProps) {
  const isGuest = myRole === "guest"
  const totalBadge = pendingRequestCount + stageRequestCount
  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 flex flex-col items-center pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-4 px-2 md:px-3 pointer-events-none gap-2">
      {/* Mobile reaction picker */}
      {isMobile && showReactionPicker && (
        <div className="pointer-events-auto rounded-2xl animate-in fade-in zoom-in-95 duration-150 bg-white/8 dark:bg-white/6 backdrop-blur-2xl border border-white/10 dark:border-white/8 shadow-2xl shadow-black/20 p-2">
          <div className="flex items-center gap-1.5">
            {REACTIONS.map((r) => (
              <button key={r.id} onClick={() => onReaction(r.id)}
                className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/10 active:bg-white/20 transition-colors active:scale-95"
                title={r.label}>
                <span className="text-xl leading-none">{r.emoji}</span>
              </button>
            ))}
            <button onClick={onToggleReactionPicker}
              className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors ml-0.5"
              title="Close">
              <HugeiconsIcon icon={Cancel01Icon} size={14} className="text-foreground/70" />
            </button>
          </div>
        </div>
      )}

      {/* Mobile secondary controls row */}
      <div className="pointer-events-auto md:hidden flex items-center gap-0.5 px-2 py-1.5 rounded-2xl bg-white/8 dark:bg-white/6 backdrop-blur-2xl border border-white/10 dark:border-white/8 shadow-2xl shadow-black/20">
        <button onClick={onToggleHand} className="flex flex-col items-center px-2.5">
          <div className={cn("w-9 h-9 rounded-full flex items-center justify-center transition-all", myHandRaised ? "bg-amber-500/20" : "bg-transparent")}>
            <span className={cn("text-base leading-none transition-transform", myHandRaised && "animate-bounce")}>✋</span>
          </div>
        </button>
        <button onClick={onToggleReactionPicker} className="flex flex-col items-center px-2.5">
          <div className={cn("w-9 h-9 rounded-full flex items-center justify-center transition-all", showReactionPicker ? "bg-foreground/90" : "bg-transparent")}>
            <span className="text-base leading-none">😊</span>
          </div>
        </button>
        <button onClick={() => onTabChange(activeTab === "people" ? null : "people")} className="flex flex-col items-center px-2.5 relative">
          <div className={cn("w-9 h-9 rounded-full flex items-center justify-center transition-all", activeTab === "people" ? "bg-foreground/90" : "bg-transparent")}>
            <HugeiconsIcon icon={UserGroupIcon} size={16} className={activeTab === "people" ? "text-background" : "text-foreground"} />
          </div>
          {totalBadge > 0 && (
            <span className="absolute -top-0.5 right-0 w-4 h-4 rounded-full bg-amber-500 text-[9px] flex items-center justify-center text-white font-bold">{totalBadge}</span>
          )}
        </button>
        <button onClick={() => { onTabChange(activeTab === "chat" ? null : "chat") }} className="flex flex-col items-center px-2.5 relative">
          <div className={cn("w-9 h-9 rounded-full flex items-center justify-center transition-all", activeTab === "chat" ? "bg-foreground/90" : "bg-transparent")}>
            <HugeiconsIcon icon={BubbleChatIcon} size={16} className={activeTab === "chat" ? "text-background" : "text-foreground"} />
          </div>
          {unreadChat > 0 && activeTab !== "chat" && (
            <span className="absolute -top-0.5 right-0 w-4 h-4 rounded-full bg-foreground text-[9px] flex items-center justify-center text-background font-bold">{unreadChat > 9 ? "9+" : unreadChat}</span>
          )}
        </button>
        <button onClick={() => onTabChange(activeTab === "polls" ? null : "polls")} className="flex flex-col items-center px-2.5">
          <div className={cn("w-9 h-9 rounded-full flex items-center justify-center transition-all", activeTab === "polls" ? "bg-foreground/90" : "bg-transparent")}>
            <HugeiconsIcon icon={ChartColumnIcon} size={16} className={activeTab === "polls" ? "text-background" : "text-foreground"} />
          </div>
        </button>
      </div>

      {/* Primary controls row */}
      <div className="pointer-events-auto flex items-center gap-0.5 md:gap-1 px-1.5 md:px-2.5 py-1.5 md:py-2 rounded-2xl bg-white/8 dark:bg-white/6 backdrop-blur-2xl border border-white/10 dark:border-white/8 shadow-2xl shadow-black/20">
        {/* Guest: Request to speak */}
        {isGuest && (
          <button onClick={onRequestStage} disabled={hasRequestedStage}
            className="flex flex-col items-center gap-0.5 px-1 md:px-2 shrink-0 disabled:opacity-60">
            <div className={cn("w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all",
              hasRequestedStage ? "bg-amber-500/20 ring-1 ring-amber-500/40" : "bg-emerald-500/15 hover:bg-emerald-500/25")}>
              <HugeiconsIcon icon={Mic02Icon} size={16} className={cn("md:w-4.5! md:h-4.5!",
                hasRequestedStage ? "text-amber-400" : "text-emerald-400")} />
            </div>
            <span className="text-[9px] text-muted-foreground font-medium hidden md:block">
              {hasRequestedStage ? "Requested" : "Speak"}
            </span>
          </button>
        )}

        {/* Mute - hidden for guests */}
        {!isGuest && (
          <button onClick={onToggleMute} className="flex flex-col items-center gap-0.5 px-1 md:px-2 shrink-0">
            <div className={cn("w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all", isMuted ? "bg-foreground/90" : "bg-transparent")}>
              <HugeiconsIcon icon={isMuted ? MicOff01Icon : Mic01Icon} size={16} className={cn("md:w-4.5! md:h-4.5!", isMuted ? "text-background" : "text-foreground")} />
            </div>
            <span className="text-[9px] text-muted-foreground font-medium hidden md:block">{isMuted ? "Unmute" : "Mute"}</span>
          </button>
        )}

        {/* Video - hidden for guests */}
        {!isGuest && (
          <button onClick={onToggleVideo} className="flex flex-col items-center gap-0.5 px-1 md:px-2 shrink-0">
            <div className={cn("w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all", isVideoOff ? "bg-foreground/90" : "bg-transparent")}>
              <HugeiconsIcon icon={isVideoOff ? VideoOffIcon : Video01Icon} size={16} className={cn("md:w-4.5! md:h-4.5!", isVideoOff ? "text-background" : "text-foreground")} />
            </div>
            <span className="text-[9px] text-muted-foreground font-medium hidden md:block">{isVideoOff ? "Start" : "Stop"}</span>
          </button>
        )}

        {/* Desktop screen share - hidden for guests */}
        {!isMobile && !isGuest && (
          <button onClick={onToggleScreenShare} disabled={screenShareDisabled}
            className="flex flex-col items-center gap-0.5 px-2 disabled:opacity-30 shrink-0">
            <div className={cn("w-11 h-11 rounded-full flex items-center justify-center transition-all", isScreenSharing ? "bg-foreground/90" : "bg-transparent")}>
              <HugeiconsIcon icon={ComputerScreenShareIcon} size={18} className={isScreenSharing ? "text-background" : "text-foreground"} />
            </div>
            <span className="text-[9px] text-muted-foreground font-medium">Share</span>
          </button>
        )}

        {/* Mobile loudspeaker */}
        {isMobile && (
          <button onClick={onToggleLoudspeaker} className="flex flex-col items-center gap-0.5 px-1 shrink-0">
            <div className={cn("w-9 h-9 rounded-full flex items-center justify-center transition-all", isLoudspeaker ? "bg-foreground/90" : "bg-transparent")}>
              <HugeiconsIcon icon={VolumeHighIcon} size={16} className={isLoudspeaker ? "text-background" : "text-foreground"} />
            </div>
          </button>
        )}

        <div className="w-px h-6 md:h-8 bg-white/10 dark:bg-white/6 mx-0.5 shrink-0 hidden md:block" />

        {/* Desktop: secondary controls inline */}
        <button onClick={onToggleHand} className="hidden md:flex flex-col items-center gap-0.5 px-2 shrink-0">
          <div className={cn("w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all", myHandRaised ? "bg-amber-500/20" : "bg-transparent")}>
            <span className={cn("text-base md:text-lg leading-none transition-transform", myHandRaised && "animate-bounce")}>✋</span>
          </div>
          <span className="text-[9px] text-muted-foreground font-medium hidden md:block">{myHandRaised ? "Lower" : "Raise"}</span>
        </button>

        <div className="relative shrink-0 hidden md:block">
          <button onClick={onToggleReactionPicker} className="flex flex-col items-center gap-0.5 px-2">
            <div className="w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center bg-transparent">
              <span className="text-base md:text-lg leading-none">😊</span>
            </div>
            <span className="text-[9px] text-muted-foreground font-medium hidden md:block">React</span>
          </button>
          {showReactionPicker && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 rounded-2xl animate-in fade-in zoom-in-95 duration-150 bg-background/95 backdrop-blur-xl border border-border dark:border-white/10 shadow-lg p-2">
              <div className="flex gap-1">
                {REACTIONS.map((r) => (
                  <button key={r.id} onClick={() => onReaction(r.id)}
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

        {/* Desktop panel toggles */}
        <button onClick={() => onTabChange(activeTab === "people" ? null : "people")} className="hidden md:flex flex-col items-center gap-0.5 px-2 relative shrink-0">
          <div className={cn("w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all", activeTab === "people" ? "bg-foreground/90" : "bg-transparent")}>
            <HugeiconsIcon icon={UserGroupIcon} size={16} className={cn("md:w-4.5! md:h-4.5!", activeTab === "people" ? "text-background" : "text-foreground")} />
          </div>
          {totalBadge > 0 && (
            <span className="absolute -top-0.5 right-0 w-4 h-4 rounded-full bg-amber-500 text-[9px] flex items-center justify-center text-white font-bold">{totalBadge}</span>
          )}
          <span className="text-[9px] text-muted-foreground font-medium hidden md:block">People</span>
        </button>

        <button onClick={() => { onTabChange(activeTab === "chat" ? null : "chat") }} className="hidden md:flex flex-col items-center gap-0.5 px-2 relative shrink-0">
          <div className={cn("w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all", activeTab === "chat" ? "bg-foreground/90" : "bg-transparent")}>
            <HugeiconsIcon icon={BubbleChatIcon} size={16} className={cn("md:w-4.5! md:h-4.5!", activeTab === "chat" ? "text-background" : "text-foreground")} />
          </div>
          {unreadChat > 0 && activeTab !== "chat" && (
            <span className="absolute -top-0.5 right-0 w-4 h-4 rounded-full bg-foreground text-[9px] flex items-center justify-center text-background font-bold">{unreadChat > 9 ? "9+" : unreadChat}</span>
          )}
          <span className="text-[9px] text-muted-foreground font-medium hidden md:block">Chat</span>
        </button>

        <button onClick={() => onTabChange(activeTab === "polls" ? null : "polls")} className="hidden md:flex flex-col items-center gap-0.5 px-2 shrink-0">
          <div className={cn("w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all", activeTab === "polls" ? "bg-foreground/90" : "bg-transparent")}>
            <HugeiconsIcon icon={ChartColumnIcon} size={16} className={cn("md:w-4.5! md:h-4.5!", activeTab === "polls" ? "text-background" : "text-foreground")} />
          </div>
          <span className="text-[9px] text-muted-foreground font-medium hidden md:block">Polls</span>
        </button>

        <div className="w-px h-6 md:h-8 bg-white/10 dark:bg-white/6 mx-0.5 shrink-0" />

        {/* End call */}
        <button onClick={onEndMeeting} disabled={isEndingMeeting} className="flex flex-col items-center gap-0.5 px-1 md:px-2 shrink-0 disabled:opacity-70">
          <div className="w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center bg-red-500/85">
            {isEndingMeeting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <HugeiconsIcon icon={CallEnd01Icon} size={18} className="text-white" />
            )}
          </div>
          <span className="text-[9px] text-muted-foreground font-medium hidden md:block">{isEndingMeeting ? "Ending..." : isHost ? "End" : "Leave"}</span>
        </button>
      </div>
    </div>
  )
}
