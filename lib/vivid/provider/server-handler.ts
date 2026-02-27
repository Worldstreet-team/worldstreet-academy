"use client"

/**
 * Server Handler — maps server function results to overlay panels.
 *
 * After a server action completes, mapResultToOverlay silently fills
 * data into any existing skeleton panel without opening a new overlay.
 */

import type { OverlaySection } from "../types"

/** Names of server functions that produce overlay-worthy data */
const SERVER_TO_OVERLAY: Record<string, OverlaySection> = {
  searchCourses: "courses",
  getCourseDetails: "course-detail",
  getUserEnrollments: "enrollments",
  checkActiveMeetings: "meetings",
  getRecentMessages: "messages",
  getUserProfile: "profile",
  getMyCertificates: "certificates",
  initiateCall: "meetings",
  getBookmarks: "courses",
  searchUsers: "search-results",
}

export function mapResultToOverlay(
  fnName: string,
  result: unknown,
  updatePanelDataSilent: (section: OverlaySection, data: unknown) => void,
) {
  const section = SERVER_TO_OVERLAY[fnName]
  if (!section) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = result as any
  if (!r || r.success === false) return

  let data: unknown = null
  switch (section) {
    case "courses":
      data = r.courses || r.bookmarks || []
      break
    case "course-detail":
      data = r
      break
    case "enrollments":
      data = r.enrollments || []
      break
    case "meetings":
      data = r.meetings || (r.call ? [r.call] : [])
      break
    case "messages":
      data = r.conversations || []
      break
    case "profile":
      data = r
      break
    case "certificates":
      data = r.certificates || []
      break
    case "search-results":
      data = r.users || r.results || []
      break
  }

  if (data !== null) {
    updatePanelDataSilent(section, data)
  }
}
