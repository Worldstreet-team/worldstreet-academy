"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Video01Icon,
  Calendar03Icon,
  ArrowRight01Icon,
  Message01Icon,
  Clock01Icon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons"
import { getMyMeetings, getMyMeetingInvites, type MeetingWithDetails, type MeetingInviteItem } from "@/lib/actions/meetings"
import { getConversations, type ConversationWithDetails } from "@/lib/actions/messages"

/* ── Status badge helper ── */
function MeetingStatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string; className: string }> = {
    active: { label: "Live", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
    waiting: { label: "Waiting", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20" },
    scheduled: { label: "Scheduled", className: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  }
  const v = variants[status] ?? { label: status, className: "" }
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${v.className}`}>
      {v.label}
    </Badge>
  )
}

/* ── Time-ago helper ── */
function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

/* ── Skeleton ── */
function ActivityCardSkeleton() {
  return (
    <Card className="h-full">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="space-y-1 flex-1">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        <Skeleton className="h-3 w-24" />
      </CardContent>
    </Card>
  )
}

/* ═════════════════════════════════════════════════════
   MAIN COMPONENT
   ═════════════════════════════════════════════════════ */

export function RecentActivity({
  meetingsHref = "/dashboard/meetings",
  messagesHref = "/dashboard/messages",
}: {
  variant?: "student" | "instructor"
  meetingsHref?: string
  messagesHref?: string
}) {
  const [activeMeetings, setActiveMeetings] = React.useState<MeetingWithDetails[]>([])
  const [invites, setInvites] = React.useState<MeetingInviteItem[]>([])
  const [conversations, setConversations] = React.useState<ConversationWithDetails[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    async function load() {
      try {
        const [meetingsRes, invitesRes, convoRes] = await Promise.all([
          getMyMeetings(),
          getMyMeetingInvites(),
          getConversations(),
        ])
        if (meetingsRes.success && meetingsRes.meetings) {
          setActiveMeetings(meetingsRes.meetings)
        }
        if (invitesRes.success && invitesRes.invites) {
          setInvites(invitesRes.invites)
        }
        if (convoRes.success && convoRes.conversations) {
          setConversations(convoRes.conversations)
        }
      } catch (error) {
        console.error("Failed to load activity:", error)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const recentConversations = conversations.slice(0, 3)
  const hasActivity = activeMeetings.length > 0 || invites.length > 0 || recentConversations.length > 0

  if (isLoading) {
    return (
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Recent Activity</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Your latest meetings & messages</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <ActivityCardSkeleton key={i} />
          ))}
        </div>
      </section>
    )
  }

  if (!hasActivity) return null

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Recent Activity</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Your latest meetings & messages</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Active / Ongoing Meetings ── */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <HugeiconsIcon icon={Video01Icon} size={14} className="text-emerald-500" />
              </div>
              <h3 className="text-sm font-semibold">Active Meetings</h3>
            </div>
            {activeMeetings.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {activeMeetings.length}
              </Badge>
            )}
          </div>

          {activeMeetings.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">No active meetings</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {activeMeetings.slice(0, 3).map((meeting) => (
                <Link key={meeting.id} href={`${meetingsHref}?join=${meeting.id}`}>
                  <Card className="group hover:border-emerald-500/30 hover:shadow-sm transition-all">
                    <CardContent className="p-3 flex items-center gap-3">
                      {meeting.courseThumbnailUrl ? (
                        <div className="w-10 h-10 rounded-lg bg-muted relative overflow-hidden shrink-0">
                          <Image
                            src={meeting.courseThumbnailUrl}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="40px"
                          />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                          <HugeiconsIcon icon={Video01Icon} size={16} className="text-emerald-500" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate group-hover:text-emerald-600 transition-colors">
                          {meeting.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <MeetingStatusBadge status={meeting.status} />
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <HugeiconsIcon icon={UserMultipleIcon} size={10} />
                            {meeting.participantCount}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ── Invited / Upcoming Meetings ── */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <HugeiconsIcon icon={Calendar03Icon} size={14} className="text-blue-500" />
              </div>
              <h3 className="text-sm font-semibold">Invitations</h3>
            </div>
            {invites.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {invites.length}
              </Badge>
            )}
          </div>

          {invites.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">No pending invitations</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {invites.slice(0, 3).map((invite) => (
                <Link key={invite.id} href={`${meetingsHref}?join=${invite.meetingId}`}>
                  <Card className="group hover:border-blue-500/30 hover:shadow-sm transition-all">
                    <CardContent className="p-3 flex items-center gap-3">
                      {invite.courseThumbnailUrl ? (
                        <div className="w-10 h-10 rounded-lg bg-muted relative overflow-hidden shrink-0">
                          <Image
                            src={invite.courseThumbnailUrl}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="40px"
                          />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                          <HugeiconsIcon icon={Calendar03Icon} size={16} className="text-blue-500" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate group-hover:text-blue-600 transition-colors">
                          {invite.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <MeetingStatusBadge status={invite.status} />
                          {invite.courseName && (
                            <span className="text-[10px] text-muted-foreground truncate">
                              {invite.courseName}
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ── Recent Messages ── */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <HugeiconsIcon icon={Message01Icon} size={14} className="text-violet-500" />
              </div>
              <h3 className="text-sm font-semibold">Messages</h3>
            </div>
            {recentConversations.filter((c) => c.unreadCount > 0).length > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {recentConversations.reduce((s, c) => s + c.unreadCount, 0)} new
              </Badge>
            )}
          </div>

          {recentConversations.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">No recent messages</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {recentConversations.map((convo) => (
                <Link key={convo.id} href={`${messagesHref}?chat=${convo.id}`}>
                  <Card className="group hover:border-violet-500/30 hover:shadow-sm transition-all">
                    <CardContent className="p-3 flex items-center gap-3">
                      <Avatar size="sm" className="shrink-0">
                        <AvatarFallback>
                          {convo.participant.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium truncate group-hover:text-violet-600 transition-colors">
                            {convo.participant.name}
                          </p>
                          {convo.unreadCount > 0 && (
                            <span className="shrink-0 w-4.5 h-4.5 rounded-full bg-violet-500 text-white text-[9px] flex items-center justify-center font-medium">
                              {convo.unreadCount > 9 ? "9+" : convo.unreadCount}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p className="text-[11px] text-muted-foreground truncate flex-1">
                            {convo.isOwnLastMessage && "You: "}
                            {convo.lastMessageType !== "text"
                              ? convo.lastMessageType === "image"
                                ? "📷 Photo"
                                : convo.lastMessageType === "video"
                                  ? "🎬 Video"
                                  : convo.lastMessageType === "audio"
                                    ? "🎤 Audio"
                                    : "📎 File"
                              : convo.lastMessage}
                          </p>
                          <span className="text-[10px] text-muted-foreground/50 shrink-0 flex items-center gap-0.5">
                            <HugeiconsIcon icon={Clock01Icon} size={9} />
                            {timeAgo(convo.lastMessageAt)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* View all links */}
      <div className="flex items-center gap-3 pt-1">
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          render={<Link href={meetingsHref} />}
        >
          All Meetings
          <HugeiconsIcon icon={ArrowRight01Icon} size={12} />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          render={<Link href={messagesHref} />}
        >
          All Messages
          <HugeiconsIcon icon={ArrowRight01Icon} size={12} />
        </Button>
      </div>
    </section>
  )
}
