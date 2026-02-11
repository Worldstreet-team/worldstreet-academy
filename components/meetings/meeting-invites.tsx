"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Video01Icon,
  UserIcon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  getMyMeetingInvites,
  type MeetingInviteItem,
} from "@/lib/actions/meetings"

/* ═══════════════════════════════════════════════════════════
   MEETING INVITES LIST
   Shows meeting invites from courses the user has purchased
   ═══════════════════════════════════════════════════════════ */

export function MeetingInvitesList({
  onJoin,
}: {
  onJoin: (meetingId: string) => void
}) {
  const [invites, setInvites] = useState<MeetingInviteItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getMyMeetingInvites().then((r) => {
      if (cancelled) return
      if (r.success && r.invites) setInvites(r.invites)
      setIsLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Course Sessions</h2>
        <div className="space-y-1.5">
          {[1, 2].map((i) => (
            <div key={i} className="h-[56px] rounded-xl bg-muted/30 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (invites.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Course Sessions</h2>
        <span className="text-[11px] text-muted-foreground/50">
          {invites.length} active
        </span>
      </div>

      <div className="space-y-1.5">
        {invites.map((invite) => (
          <button
            key={invite.meetingId}
            onClick={() => onJoin(invite.meetingId)}
            className="group w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/30 transition-colors text-left"
          >
            {/* Thumbnail / icon */}
            <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-muted/30 shrink-0 flex items-center justify-center">
              {invite.courseThumbnailUrl ? (
                <Image
                  src={invite.courseThumbnailUrl}
                  alt={invite.courseName || invite.title}
                  fill
                  className="object-cover"
                />
              ) : (
                <HugeiconsIcon icon={Video01Icon} size={16} className="text-muted-foreground/40" />
              )}
              <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-[1.5px] ring-card" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium truncate">{invite.title}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {invite.hostAvatar ? (
                  <Avatar className="w-3.5 h-3.5">
                    <AvatarImage src={invite.hostAvatar} alt={invite.hostName} />
                    <AvatarFallback className="text-[5px]">
                      {invite.hostName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full bg-muted flex items-center justify-center">
                    <HugeiconsIcon icon={UserIcon} size={7} className="text-muted-foreground" />
                  </div>
                )}
                <span className="text-[11px] text-muted-foreground truncate">
                  {invite.hostName}
                </span>
                {invite.courseName && (
                  <>
                    <span className="text-muted-foreground/20">&middot;</span>
                    <span className="text-[11px] text-muted-foreground/50 truncate">
                      {invite.courseName}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Join hint */}
            <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex items-center gap-0.5 text-[11px] font-medium text-foreground">
                Join
                <HugeiconsIcon icon={ArrowRight01Icon} size={10} />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
