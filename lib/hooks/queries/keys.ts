/** Centralized query key factory — ensures consistent cache keys across the app */
export const queryKeys = {
  // ── Courses (Student) ──
  enrollments: ["enrollments"] as const,
  bookmarks: ["bookmarks"] as const,
  browseCourses: (filters?: { level?: string; pricing?: string }) =>
    filters ? ["browse-courses", filters] as const : ["browse-courses"] as const,

  // ── Courses (Instructor) ──
  instructorCourses: ["instructor-courses"] as const,

  // ── Meetings ──
  meetings: ["meetings"] as const,
  meetingHistory: ["meeting-history"] as const,
  meetingInvites: ["meeting-invites"] as const,
  instructorMeetingCourses: ["instructor-meeting-courses"] as const,

  // ── Messages ──
  conversations: ["conversations"] as const,
  messages: (conversationId: string) => ["messages", conversationId] as const,
  unreadCount: ["unread-count"] as const,
} as const
