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

  // ── Notifications ──
  notifications: ["notifications"] as const,

  // ── Wallet ──
  walletOverview: ["wallet", "overview"] as const,
  walletTransactions: ["wallet", "transactions"] as const,
  walletBanks: ["wallet", "banks"] as const,
  walletSavedBanks: ["wallet", "saved-banks"] as const,
  walletKyc: ["wallet", "kyc"] as const,

  // ── Exams ──
  examStatus: (courseId: string) => ["exam-status", courseId] as const,
  examAttempt: (attemptId: string) => ["exam-attempt", attemptId] as const,
  courseExam: (courseId: string) => ["course-exam", courseId] as const,

  // ── Instructor application ──
  myApplication: ["my-instructor-application"] as const,

  // ── Admin ──
  adminOverview: ["admin", "overview"] as const,
  adminUsers: (filters?: { role?: string; search?: string; page?: number }) =>
    filters ? (["admin", "users", filters] as const) : (["admin", "users"] as const),
  adminUserDetail: (userId: string) => ["admin", "user", userId] as const,
  adminOrders: (filters?: { status?: string; page?: number }) =>
    filters ? (["admin", "orders", filters] as const) : (["admin", "orders"] as const),
  adminOrderDetail: (orderId: string) => ["admin", "order", orderId] as const,
  adminEarnings: (filters?: { status?: string; page?: number }) =>
    filters ? (["admin", "earnings", filters] as const) : (["admin", "earnings"] as const),
  adminCourses: (filters?: { status?: string; search?: string; page?: number }) =>
    filters ? (["admin", "courses", filters] as const) : (["admin", "courses"] as const),
  adminReviews: (filters?: { filter?: string; page?: number }) =>
    filters ? (["admin", "reviews", filters] as const) : (["admin", "reviews"] as const),
  adminApplications: (filters?: { status?: string; page?: number }) =>
    filters ? (["admin", "applications", filters] as const) : (["admin", "applications"] as const),
  adminApplicationDetail: (id: string) => ["admin", "application", id] as const,
} as const
