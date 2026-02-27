"use server"

/**
 * Vivid Actions — Entry point
 *
 * Exports createVividSession (OpenAI realtime token), executeVividFunction
 * (central dispatcher), and re-exports every domain action for direct use.
 */

import { buildAcademyPrompt, generateFunctionInstructions } from "../prompt"
import { allVividFunctions } from "../functions"

// ── Domain imports ─────────────────────────────────────────────────────
import {
  vividSearchCourses,
  vividGetCourseDetails,
  vividGetUserEnrollments,
  vividEnrollInCourse,
  vividGetCourseLessons,
} from "./courses"
import {
  vividMarkLessonComplete,
  vividMarkCourseComplete,
  vividGetWatchProgress,
  vividGetCompletedLessons,
} from "./progress"
import { vividToggleBookmark, vividGetBookmarks } from "./bookmarks"
import {
  vividCheckActiveMeetings,
  vividCreateMeeting,
  vividJoinMeeting,
} from "./meetings"
import {
  vividGetRecentMessages,
  vividSendMessage,
  vividGetUnreadCount,
  vividSearchUsers,
} from "./messages"
import {
  vividGetUserProfile,
  vividUpdateProfile,
  vividChangeLanguage,
} from "./profile"
import {
  vividGetMyCertificates,
  vividSaveSignature,
  vividGetUserSignature,
} from "./certificates"
import { vividSubmitReview, vividInitiateCall } from "./misc"

// Re-export all domain actions for consumers that import individual functions
export {
  vividSearchCourses,
  vividGetCourseDetails,
  vividGetUserEnrollments,
  vividEnrollInCourse,
  vividGetCourseLessons,
  vividMarkLessonComplete,
  vividMarkCourseComplete,
  vividGetWatchProgress,
  vividGetCompletedLessons,
  vividToggleBookmark,
  vividGetBookmarks,
  vividCheckActiveMeetings,
  vividCreateMeeting,
  vividJoinMeeting,
  vividGetRecentMessages,
  vividSendMessage,
  vividGetUnreadCount,
  vividSearchUsers,
  vividGetUserProfile,
  vividUpdateProfile,
  vividChangeLanguage,
  vividGetMyCertificates,
  vividSaveSignature,
  vividGetUserSignature,
  vividSubmitReview,
  vividInitiateCall,
}

// ============================================================================
// Create Vivid Session Token
// ============================================================================

interface CreateSessionParams {
  userId?: string
  userName?: string
  userLastName?: string
  userEmail?: string
  userRole?: string
  pathname?: string
}

export async function createVividSession(params: CreateSessionParams) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return { success: false, error: "Server configuration error" }

    const user = params.userId
      ? { id: params.userId, firstName: params.userName, lastName: params.userLastName, email: params.userEmail, role: params.userRole }
      : null

    let instructions = buildAcademyPrompt(user, params.pathname || "/")
    const functionNames = allVividFunctions.map((f) => f.name)
    instructions += generateFunctionInstructions(functionNames)

    const tools = allVividFunctions.map((f) => ({
      type: "function" as const,
      name: f.name,
      description: f.description,
      parameters: f.parameters,
    }))

    const res = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        modalities: ["text", "audio"],
        voice: "alloy",
        instructions,
        turn_detection: { type: "server_vad", threshold: 0.6, prefix_padding_ms: 400, silence_duration_ms: 600 },
        tools,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Unknown error" }))
      console.error("[Vivid] OpenAI session error:", err)
      return { success: false, error: "Failed to create voice session" }
    }

    const data = await res.json()
    return { success: true, client_secret: data.client_secret.value, expires_at: data.client_secret.expires_at }
  } catch (error) {
    console.error("[Vivid] Token generation error:", error)
    return { success: false, error: "Failed to generate token" }
  }
}

// ============================================================================
// Function Dispatcher
// ============================================================================

const handlers: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
  searchCourses: (a) => vividSearchCourses(a as Parameters<typeof vividSearchCourses>[0]),
  getCourseDetails: (a) => vividGetCourseDetails(a as Parameters<typeof vividGetCourseDetails>[0]),
  getUserEnrollments: (a) => vividGetUserEnrollments(a as Parameters<typeof vividGetUserEnrollments>[0]),
  enrollInCourse: (a) => vividEnrollInCourse(a as Parameters<typeof vividEnrollInCourse>[0]),
  getCourseLessons: (a) => vividGetCourseLessons(a as Parameters<typeof vividGetCourseLessons>[0]),
  markLessonComplete: (a) => vividMarkLessonComplete(a as Parameters<typeof vividMarkLessonComplete>[0]),
  markCourseComplete: (a) => vividMarkCourseComplete(a as Parameters<typeof vividMarkCourseComplete>[0]),
  getWatchProgress: (a) => vividGetWatchProgress(a as Parameters<typeof vividGetWatchProgress>[0]),
  getCompletedLessons: (a) => vividGetCompletedLessons(a as Parameters<typeof vividGetCompletedLessons>[0]),
  toggleBookmark: (a) => vividToggleBookmark(a as Parameters<typeof vividToggleBookmark>[0]),
  getBookmarks: () => vividGetBookmarks(),
  checkActiveMeetings: () => vividCheckActiveMeetings(),
  createMeeting: (a) => vividCreateMeeting(a as Parameters<typeof vividCreateMeeting>[0]),
  joinMeeting: (a) => vividJoinMeeting(a as Parameters<typeof vividJoinMeeting>[0]),
  getRecentMessages: (a) => vividGetRecentMessages(a as Parameters<typeof vividGetRecentMessages>[0]),
  sendMessage: (a) => vividSendMessage(a as Parameters<typeof vividSendMessage>[0]),
  getUnreadCount: () => vividGetUnreadCount(),
  searchUsers: (a) => vividSearchUsers(a as Parameters<typeof vividSearchUsers>[0]),
  getUserProfile: () => vividGetUserProfile(),
  updateUserProfile: (a) => vividUpdateProfile(a as Parameters<typeof vividUpdateProfile>[0]),
  changeLanguage: (a) => vividChangeLanguage(a as Parameters<typeof vividChangeLanguage>[0]),
  getMyCertificates: () => vividGetMyCertificates(),
  saveSignature: (a) => vividSaveSignature(a as Parameters<typeof vividSaveSignature>[0]),
  getUserSignature: () => vividGetUserSignature(),
  submitCourseReview: (a) => vividSubmitReview(a as Parameters<typeof vividSubmitReview>[0]),
  initiateCall: (a) => vividInitiateCall(a as Parameters<typeof vividInitiateCall>[0]),
}

export async function executeVividFunction(name: string, args: Record<string, unknown>) {
  try {
    const handler = handlers[name]
    if (!handler) return { success: false, error: `Function "${name}" not found` }
    return await handler(args || {})
  } catch (error) {
    console.error("[Vivid] Function error:", error)
    return { success: false, error: error instanceof Error ? error.message : "Function failed" }
  }
}
