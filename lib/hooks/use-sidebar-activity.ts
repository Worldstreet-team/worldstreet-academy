"use client"

import { useMyMeetings, useMeetingInvites } from "@/lib/hooks/queries"
import type { MeetingWithDetails, MeetingInviteItem } from "@/lib/actions/meetings"

export type SidebarActivityItem = {
  id: string
  type: "meeting" | "invite" | "call"
  title: string
  href: string
  isActive: boolean
}

/**
 * Hook that provides sidebar activity data (active meetings + invites).
 * Backed by TanStack Query — data is shared with the meetings page and
 * silently refreshes every 30 seconds in the background.
 */
export function useSidebarActivity() {
  const { data: activeMeetings = [], isSuccess: meetingsLoaded } = useMyMeetings()
  const { data: invites = [], isSuccess: invitesLoaded } = useMeetingInvites()

  const isLoaded = meetingsLoaded || invitesLoaded

  // Filter invites to exclude meetings already in activeMeetings (prevents duplicates)
  const activeMeetingIds = new Set(activeMeetings.map((m) => m.id))
  const filteredInvites = invites.filter((inv) => !activeMeetingIds.has(inv.meetingId))

  const hasActivity = activeMeetings.length > 0 || filteredInvites.length > 0

  return { activeMeetings, invites: filteredInvites, hasActivity, isLoaded }
}
