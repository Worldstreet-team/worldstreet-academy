"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getMyMeetings,
  getMeetingHistory,
  getMyMeetingInvites,
  getInstructorCoursesForMeeting,
  getUpcomingClasses,
  type MeetingWithDetails,
  type MeetingHistoryEntry,
  type MeetingInviteItem,
  type UpcomingClass,
} from "@/lib/actions/meetings"
import { queryKeys } from "./keys"

export function useMyMeetings() {
  return useQuery<MeetingWithDetails[]>({
    queryKey: queryKeys.meetings,
    queryFn: async () => {
      const r = await getMyMeetings()
      return r.success && r.meetings ? r.meetings : []
    },
    staleTime: 30 * 1000, // 30s — meetings are time-sensitive
    refetchInterval: 30 * 1000, // poll every 30s
  })
}

export function useMeetingHistory() {
  return useQuery<MeetingHistoryEntry[]>({
    queryKey: queryKeys.meetingHistory,
    queryFn: async () => {
      const r = await getMeetingHistory()
      return r.success && r.meetings ? r.meetings : []
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useMeetingInvites() {
  return useQuery<MeetingInviteItem[]>({
    queryKey: queryKeys.meetingInvites,
    queryFn: async () => {
      const r = await getMyMeetingInvites()
      return r.success && r.invites ? r.invites : []
    },
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000, // poll every 30s
  })
}

export function useUpcomingClasses() {
  return useQuery<UpcomingClass[]>({
    queryKey: queryKeys.upcomingClasses,
    queryFn: () => getUpcomingClasses(),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000, // a class leaves the list once it starts
  })
}

export function useInstructorMeetingCourses() {
  return useQuery({
    queryKey: queryKeys.instructorMeetingCourses,
    queryFn: async () => {
      const r = await getInstructorCoursesForMeeting()
      return r.success && r.courses ? r.courses : []
    },
    staleTime: 10 * 60 * 1000,
  })
}

/** Invalidate all meeting-related queries (e.g. after joining/leaving/ending) */
export function useInvalidateMeetings() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.meetings })
    qc.invalidateQueries({ queryKey: queryKeys.meetingHistory })
    qc.invalidateQueries({ queryKey: queryKeys.meetingInvites })
    qc.invalidateQueries({ queryKey: queryKeys.upcomingClasses })
  }
}
