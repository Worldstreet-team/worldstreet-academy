"use client"

import { useState, useEffect, useCallback } from "react"
import { getMyMeetings, getMyMeetingInvites, type MeetingWithDetails, type MeetingInviteItem } from "@/lib/actions/meetings"
import { useSSEEvents } from "@/lib/hooks/use-call-events"
import { useUser } from "@/components/providers/user-provider"
import type { SSEEventPayload } from "@/lib/call-events"

export type SidebarActivityItem = {
  id: string
  type: "meeting" | "invite" | "call"
  title: string
  href: string
  isActive: boolean
}

export function useSidebarActivity() {
  const user = useUser()
  const [activeMeetings, setActiveMeetings] = useState<MeetingWithDetails[]>([])
  const [invites, setInvites] = useState<MeetingInviteItem[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // Initial load
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [meetingsRes, invitesRes] = await Promise.all([
          getMyMeetings(),
          getMyMeetingInvites(),
        ])
        if (cancelled) return
        if (meetingsRes.success && meetingsRes.meetings) {
          setActiveMeetings(meetingsRes.meetings)
        }
        if (invitesRes.success && invitesRes.invites) {
          setInvites(invitesRes.invites)
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setIsLoaded(true)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Listen for realtime meeting/call events via Ably
  const handleEvent = useCallback(
    (event: SSEEventPayload) => {
      if (!event.type) return

      // Refresh on meeting lifecycle events
      const refreshTypes = [
        "meeting:ended",
        "meeting:participant-joined",
        "meeting:participant-left",
        "meeting:admitted",
        "call:incoming",
        "call:ended",
        "call:answered",
      ]

      if (refreshTypes.includes(event.type)) {
        // Debounce: refresh data
        getMyMeetings().then((r) => {
          if (r.success && r.meetings) setActiveMeetings(r.meetings)
        })
        getMyMeetingInvites().then((r) => {
          if (r.success && r.invites) setInvites(r.invites)
        })
      }
    },
    []
  )

  useSSEEvents(user?.id ?? null, handleEvent)

  const hasActivity = activeMeetings.length > 0 || invites.length > 0

  return { activeMeetings, invites, hasActivity, isLoaded }
}
