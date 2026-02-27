/**
 * Vivid AI Functions — WorldStreet Academy
 *
 * All callable functions for the voice agent.
 * Covers: navigation, overlay, on-demand UI, courses, meetings,
 * messages, certificates, profile, language, enrollments.
 */

import type { VividFunctionConfig, JSONSchema, JSONSchemaProperty } from "./types"

// ============================================================================
// Helpers
// ============================================================================

function str(description: string, required = true): JSONSchemaProperty & { _req?: boolean } {
  return { type: "string", description, _req: required } as JSONSchemaProperty & { _req?: boolean }
}
function num(description: string, required = false): JSONSchemaProperty & { _req?: boolean } {
  return { type: "number", description, _req: required } as JSONSchemaProperty & { _req?: boolean }
}
function enm(description: string, opts: string[], required = false): JSONSchemaProperty & { _req?: boolean } {
  return { type: "string", description, enum: opts, _req: required } as JSONSchemaProperty & { _req?: boolean }
}

function params(defs: Record<string, JSONSchemaProperty & { _req?: boolean }>): JSONSchema {
  const properties: Record<string, JSONSchemaProperty> = {}
  const required: string[] = []
  for (const [k, v] of Object.entries(defs)) {
    const { _req, ...prop } = v
    properties[k] = prop
    if (_req) required.push(k)
  }
  return { type: "object", properties, ...(required.length > 0 ? { required } : {}) }
}

const noop = async () => ({ success: true })

// ============================================================================
// CLIENT FUNCTIONS — Navigation + UI
// ============================================================================

const navigateToPage: VividFunctionConfig = {
  name: "navigateToPage",
  description: `Navigate the user to a page. CORRECT ROUTES:
  /dashboard — home
  /dashboard/courses — browse all courses
  /dashboard/courses/{courseId} — view a specific course (use the course ID, NOT slug)
  /dashboard/courses/{courseId}/learn/{lessonId} — watch a specific lesson
  /dashboard/courses/{courseId}/certificate — view certificate
  /dashboard/my-courses — enrolled courses
  /dashboard/meetings — meetings hub (append ?meetingId=X to auto-join)
  /dashboard/messages — messages (append ?userId=X to open conversation)
  /dashboard/profile — user profile
  /dashboard/settings — settings
  /dashboard/certificates — all certificates
  /dashboard/bookmarks — bookmarks
  /dashboard/checkout?courseId=X — checkout/enroll
  /dashboard/help — help
  ⚠️ NEVER use /courses — always use /dashboard/courses
  /instructor — instructor home
  /instructor/courses — instructor courses
  /instructor/analytics — analytics
  NEVER use /course/slug — always use /dashboard/courses/{id}`,
  parameters: params({
    path: str("The URL path to navigate to", true),
    reason: str("Brief reason shown to user", false),
  }),
  handler: noop,
  executionContext: "client",
}

const updateOverlay: VividFunctionConfig = {
  name: "updateOverlay",
  description: `Show or update the live overlay panel with data. The overlay stays on screen and updates in real-time — no stacking. Types:
  - courses: show course grid (from search/browse)
  - meetings: show active meetings
  - enrollments: show user's enrolled courses with progress
  - messages: show recent conversations
  - course-detail: show detailed view of one course
  - profile: show user profile info
  - certificates: show earned certificates
  - search-results: search results for anything`,
  parameters: params({
    section: enm("What to display", ["courses", "meetings", "enrollments", "messages", "course-detail", "profile", "certificates", "search-results"], true),
    title: str("Overlay title", true),
    query: str("Search query if applicable", false),
    filters: str("JSON filters: level, pricing, category, status", false),
    courseId: str("Course ID for course-detail section", false),
  }),
  handler: noop,
  executionContext: "client",
}

const requestOnDemandUI: VividFunctionConfig = {
  name: "requestOnDemandUI",
  description: `Show an on-demand UI prompt to the user. Types:
  - file-upload: for avatar/profile picture changes
  - signature-canvas: for signing certificates (config: { quickSign: boolean })
  - confirmation: ask user to confirm an action (config: { action, details })
  - rating: ask user to rate something (config: { courseId, courseName })
  - language-picker: let user pick language for the platform
  - bookmark-toggle: show bookmark toggle card (config: { courseId, courseTitle, thumbnailUrl, isBookmarked })
  - progress-dashboard: show progress ring + lesson checklist (config: { courseId, courseTitle, thumbnailUrl })
  - contact-card: show user contact card with message/call actions (config: { userId, userName, userAvatar, bio })
  - checkout-confirm: show purchase confirmation card (config: { courseId, courseTitle, thumbnailUrl, price, walletBalance })
  - friend-search: search for users and add them as friends/contacts`,
  parameters: params({
    type: enm("UI type", ["file-upload", "signature-canvas", "confirmation", "rating", "language-picker", "bookmark-toggle", "progress-dashboard", "contact-card", "checkout-confirm", "friend-search"], true),
    title: str("Title for the UI prompt", true),
    description: str("Description text", false),
    config: str("JSON config for the UI type", false),
  }),
  handler: noop,
  executionContext: "client",
}

const getCurrentTime: VividFunctionConfig = {
  name: "getCurrentTime",
  description: "Get the current date and time",
  parameters: params({}),
  handler: async () => {
    const now = new Date()
    return {
      date: now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
      time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    }
  },
  executionContext: "client",
}

const minimizeSession: VividFunctionConfig = {
  name: "minimizeSession",
  description: "Minimize the voice assistant to a small floating bar. Use when: switching pages, after answering a question that leads to navigation, or when user says 'minimize' / 'go away' / 'shrink'.",
  parameters: params({}),
  handler: noop,
  executionContext: "client",
}

const maximizeSession: VividFunctionConfig = {
  name: "maximizeSession",
  description: "Expand the voice assistant back to full screen from the minimized bar. Use when user says 'maximize', 'expand', 'come back', 'show yourself', 'open up', 'full screen'.",
  parameters: params({}),
  handler: noop,
  executionContext: "client",
}

const endSession: VividFunctionConfig = {
  name: "endSession",
  description: `End the voice assistant session completely. This disconnects the realtime audio connection and resets all state. MUST be called before:
  - Joining a meeting (audio conflict with WebRTC)
  - Placing a call (audio conflict)
  - When user says "bye", "goodbye", "that's all", "I'm done", "thanks that's it", "close", "stop", "shut down"
  - When user explicitly asks to end the conversation
  After calling this, the assistant cannot hear or speak until restarted.`,
  parameters: params({
    reason: str("Brief reason for ending (shown to user)", false),
  }),
  handler: noop,
  executionContext: "client",
}

const closeOverlay: VividFunctionConfig = {
  name: "closeOverlay",
  description: `Close the overlay data panel without ending the session. Use when:
  - User says "close that", "hide the panel", "remove that", "clear the screen"
  - User changes topic and the overlay is no longer relevant
  - Before showing a different overlay section (prevents flicker)
  - After the user has seen enough and wants to return to the transcript-only view
  The voice session stays active.`,
  parameters: params({}),
  handler: noop,
  executionContext: "client",
}

const clearOnDemandUI: VividFunctionConfig = {
  name: "clearOnDemandUI",
  description: `Dismiss any on-demand UI that is currently showing (file-upload, signature-canvas, confirmation, rating, language-picker, bookmark-toggle, progress-dashboard, contact-card, checkout-confirm). Use when:
  - User says "cancel", "never mind", "skip"
  - The operation was completed or is no longer needed
  - Before switching to a completely different task`,
  parameters: params({}),
  handler: noop,
  executionContext: "client",
}

// ── New Client Functions ──

const toggleTheme: VividFunctionConfig = {
  name: "toggleTheme",
  description: "Toggle between dark and light mode instantly. Use when user says 'dark mode', 'light mode', 'switch theme', 'toggle theme', 'change theme'.",
  parameters: params({}),
  handler: noop,
  executionContext: "client",
}

const playPauseVideo: VividFunctionConfig = {
  name: "playPauseVideo",
  description: "Play or pause the lesson video on the current page. Only works when user is on a lesson page (/dashboard/courses/{courseId}/learn/{lessonId}). Use when user says 'play', 'pause', 'stop the video', 'resume'.",
  parameters: params({
    action: enm("Play or pause", ["play", "pause", "toggle"], true),
  }),
  handler: noop,
  executionContext: "client",
}

const copyToClipboard: VividFunctionConfig = {
  name: "copyToClipboard",
  description: "Copy text to the user's clipboard. Use for sharing meeting links, course URLs, referral codes, or any text the user wants to copy.",
  parameters: params({
    text: str("The text to copy to clipboard", true),
    label: str("What was copied, shown in toast (e.g. 'Meeting link')", false),
  }),
  handler: noop,
  executionContext: "client",
}

const scrollToSection: VividFunctionConfig = {
  name: "scrollToSection",
  description: "Scroll the page to a specific section. Use on course detail pages to jump to reviews, lessons, description, requirements. Or on any page with sections.",
  parameters: params({
    sectionId: str("CSS selector or id of the section to scroll to (e.g. '#reviews', '#lessons', '.course-description')", true),
  }),
  handler: noop,
  executionContext: "client",
}

// ============================================================================
// SERVER FUNCTIONS — Data + Actions
// ============================================================================

const searchCourses: VividFunctionConfig = {
  name: "searchCourses",
  description: "Search/browse courses. Filter by level, pricing, category. Returns course list with IDs for navigation.",
  parameters: params({
    search: str("Search term", false),
    level: enm("Difficulty", ["beginner", "intermediate", "advanced"], false),
    pricing: enm("Price filter", ["free", "paid"], false),
    category: str("Category filter", false),
    sortBy: enm("Sort", ["popular", "newest", "rating", "price-low", "price-high"], false),
    limit: num("Max results (default 20)", false),
  }),
  handler: noop,
  executionContext: "server",
}

const getCourseDetails: VividFunctionConfig = {
  name: "getCourseDetails",
  description: "Get detailed info about a course including lessons, instructor, enrollment status. Returns courseId for navigation.",
  parameters: params({ courseId: str("Course ID", true) }),
  handler: noop,
  executionContext: "server",
}

const getUserEnrollments: VividFunctionConfig = {
  name: "getUserEnrollments",
  description: "Get user's enrolled courses with progress. Use for 'my courses', 'what am I learning', 'continue learning'.",
  parameters: params({
    status: enm("Filter", ["active", "completed", "all"], false),
  }),
  handler: noop,
  executionContext: "server",
}

const enrollInCourse: VividFunctionConfig = {
  name: "enrollInCourse",
  description: "Enroll the user in a course. For free courses, enrolls directly. For paid courses, navigates to checkout.",
  parameters: params({ courseId: str("Course ID to enroll in", true) }),
  handler: noop,
  executionContext: "server",
}

const getCourseLessons: VividFunctionConfig = {
  name: "getCourseLessons",
  description: "Get lessons for a course. Use for 'next lesson', 'previous lesson', 'show lessons'. Returns lesson IDs for navigation.",
  parameters: params({ courseId: str("Course ID", true) }),
  handler: noop,
  executionContext: "server",
}

const checkActiveMeetings: VividFunctionConfig = {
  name: "checkActiveMeetings",
  description: "Check for active/ongoing meetings. Shows meeting IDs the user can join.",
  parameters: params({}),
  handler: noop,
  executionContext: "server",
}

const createMeeting: VividFunctionConfig = {
  name: "createMeeting",
  description: "Create a new meeting room. Returns meeting ID and join URL.",
  parameters: params({
    title: str("Meeting title", true),
  }),
  handler: noop,
  executionContext: "server",
}

const getRecentMessages: VividFunctionConfig = {
  name: "getRecentMessages",
  description: "Get recent message conversations with last message preview. Use for 'check messages', 'who messaged me', 'read last message'.",
  parameters: params({
    limit: num("Max conversations (default 15)", false),
  }),
  handler: noop,
  executionContext: "server",
}

const sendMessage: VividFunctionConfig = {
  name: "sendMessage",
  description: "Send a text message to another user. Need the recipient's user ID.",
  parameters: params({
    recipientId: str("User ID to message", true),
    content: str("Message text", true),
  }),
  handler: noop,
  executionContext: "server",
}

const getUserProfile: VividFunctionConfig = {
  name: "getUserProfile",
  description: "Get current user's profile info: name, email, role, wallet balance, enrollment stats.",
  parameters: params({}),
  handler: noop,
  executionContext: "server",
}

const updateUserProfile: VividFunctionConfig = {
  name: "updateUserProfile",
  description: "Update user's profile fields (name, bio). For avatar, use requestOnDemandUI with file-upload.",
  parameters: params({
    firstName: str("First name", false),
    lastName: str("Last name", false),
    bio: str("Bio text", false),
  }),
  handler: noop,
  executionContext: "server",
}

const changeLanguage: VividFunctionConfig = {
  name: "changeLanguage",
  description: "Change the platform language. Common codes: en (English), es (Spanish), fr (French), de (German), pt (Portuguese), zh-CN (Chinese), ar (Arabic), hi (Hindi), ja (Japanese), ko (Korean), ru (Russian), tr (Turkish).",
  parameters: params({
    languageCode: str("Language code (e.g. 'es', 'fr', 'zh-CN')", true),
  }),
  handler: noop,
  executionContext: "client",
}

const submitCourseReview: VividFunctionConfig = {
  name: "submitCourseReview",
  description: "Submit or update a review for a course. Rating 1-5 stars with optional comment.",
  parameters: params({
    courseId: str("Course ID", true),
    rating: num("Rating 1-5", true),
    comment: str("Review comment", false),
  }),
  handler: noop,
  executionContext: "server",
}

const getMyCertificates: VividFunctionConfig = {
  name: "getMyCertificates",
  description: "Get all certificates the user has earned.",
  parameters: params({}),
  handler: noop,
  executionContext: "server",
}

const saveSignature: VividFunctionConfig = {
  name: "saveSignature",
  description: "Save the user's signature (from signature canvas UI). The dataUrl comes from the on-demand signature-canvas UI.",
  parameters: params({
    signatureDataUrl: str("Base64 data URL of signature", true),
  }),
  handler: noop,
  executionContext: "server",
}

const initiateCall: VividFunctionConfig = {
  name: "initiateCall",
  description: `Start a real-time voice or video call to another user. This uses the platform's call system (NOT meetings) — it rings the recipient's device, and the call UI appears in the messages page. The flow:
  1. Ring the recipient instantly
  2. The AI session ends (to free the mic for the call)
  3. User navigates to messages where the call UI shows
  For voice calls, set callType to "audio". For video, set to "video".
  ⚠️ The AI session MUST end before the call connects — audio conflicts will occur otherwise.`,
  parameters: params({
    recipientId: str("User ID of the person to call", true),
    recipientName: str("Display name of the recipient", true),
    callType: enm("Type of call", ["audio", "video"], true),
  }),
  handler: noop,
  executionContext: "server",
}

const getUserSignature: VividFunctionConfig = {
  name: "getUserSignature",
  description: "Check if the user has an existing signature saved. Returns signature URL if exists. Use before asking to sign certificates.",
  parameters: params({}),
  handler: noop,
  executionContext: "server",
}

// ── New Server Functions (B1-B9) ──

const toggleBookmark: VividFunctionConfig = {
  name: "toggleBookmark",
  description: "Bookmark or unbookmark a course. Returns the new bookmark state. Use when user says 'bookmark this', 'save this course', 'remove bookmark', 'unbookmark'.",
  parameters: params({
    courseId: str("Course ID to toggle bookmark on", true),
  }),
  handler: noop,
  executionContext: "server",
}

const markLessonComplete: VividFunctionConfig = {
  name: "markLessonComplete",
  description: "Mark a specific lesson as complete. Use when user says 'I finished this lesson', 'mark as done', 'lesson complete', or after they've been on a lesson page for a while.",
  parameters: params({
    courseId: str("Course ID the lesson belongs to", true),
    lessonId: str("Lesson ID to mark complete", true),
  }),
  handler: noop,
  executionContext: "server",
}

const markCourseComplete: VividFunctionConfig = {
  name: "markCourseComplete",
  description: "Mark an entire course as completed. This triggers certificate generation. Use when ALL lessons are done or user explicitly asks to complete the course.",
  parameters: params({
    courseId: str("Course ID to mark complete", true),
  }),
  handler: noop,
  executionContext: "server",
}

const getWatchProgress: VividFunctionConfig = {
  name: "getWatchProgress",
  description: "Get video watch progress for a course — how far the user has gotten through each lesson. Shows percentage watched per lesson.",
  parameters: params({
    courseId: str("Course ID to check progress for", true),
  }),
  handler: noop,
  executionContext: "server",
}

const getBookmarks: VividFunctionConfig = {
  name: "getBookmarks",
  description: "Fetch all bookmarked courses for the user. Use when user says 'show my bookmarks', 'saved courses', 'what did I bookmark'.",
  parameters: params({}),
  handler: noop,
  executionContext: "server",
}

const joinMeeting: VividFunctionConfig = {
  name: "joinMeeting",
  description: "Join an existing meeting room by meeting ID. Returns join URL. ⚠️ Remember to end the AI session FIRST before joining — audio conflict!",
  parameters: params({
    meetingId: str("Meeting ID to join", true),
  }),
  handler: noop,
  executionContext: "server",
}

const searchUsers: VividFunctionConfig = {
  name: "searchUsers",
  description: "Search users by name or email. Use to find contacts for messaging, calling, or adding to meetings. Returns list of matching users with IDs.",
  parameters: params({
    query: str("Search term (name or email)", true),
    limit: num("Max results (default 15)", false),
  }),
  handler: noop,
  executionContext: "server",
}

const getUnreadCount: VividFunctionConfig = {
  name: "getUnreadCount",
  description: "Check total unread message count. Use when user asks 'do I have messages', 'any unread', 'check notifications'.",
  parameters: params({}),
  handler: noop,
  executionContext: "server",
}

const getCompletedLessons: VividFunctionConfig = {
  name: "getCompletedLessons",
  description: "Get list of completed lesson IDs for a course. Use to show progress, determine next lesson, or check what's left.",
  parameters: params({
    courseId: str("Course ID to check", true),
  }),
  handler: noop,
  executionContext: "server",
}

// ============================================================================
// Exports
// ============================================================================

export const clientFunctions: VividFunctionConfig[] = [
  navigateToPage,
  updateOverlay,
  requestOnDemandUI,
  getCurrentTime,
  minimizeSession,
  maximizeSession,
  endSession,
  closeOverlay,
  clearOnDemandUI,
  toggleTheme,
  playPauseVideo,
  copyToClipboard,
  scrollToSection,
]

export const serverFunctions: VividFunctionConfig[] = [
  searchCourses,
  getCourseDetails,
  getUserEnrollments,
  enrollInCourse,
  getCourseLessons,
  checkActiveMeetings,
  createMeeting,
  getRecentMessages,
  sendMessage,
  getUserProfile,
  updateUserProfile,
  changeLanguage,
  submitCourseReview,
  getMyCertificates,
  saveSignature,
  initiateCall,
  getUserSignature,
  toggleBookmark,
  markLessonComplete,
  markCourseComplete,
  getWatchProgress,
  getBookmarks,
  joinMeeting,
  searchUsers,
  getUnreadCount,
  getCompletedLessons,
]

export const allVividFunctions: VividFunctionConfig[] = [
  ...clientFunctions,
  ...serverFunctions,
]
