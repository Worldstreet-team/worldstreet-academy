/**
 * Vivid AI Zustand Store — WorldStreet Academy
 *
 * Centralized data cache for instant overlay responses.
 * Pre-fetches on session start, serves from cache immediately,
 * then refreshes silently in the background.
 */

import { create } from "zustand"
import {
  vividSearchCourses,
  vividGetUserEnrollments,
  vividCheckActiveMeetings,
  vividGetRecentMessages,
  vividGetUserProfile,
  vividGetMyCertificates,
} from "./actions"

// ============================================================================
// Types
// ============================================================================

interface VividDataState {
  // Data caches
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  courses: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  enrollments: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meetings: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profile: any | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  certificates: any[]

  // Loading states per section
  loading: {
    courses: boolean
    enrollments: boolean
    meetings: boolean
    messages: boolean
    profile: boolean
    certificates: boolean
  }

  // Timestamps for cache invalidation
  lastFetched: {
    courses: number
    enrollments: number
    meetings: number
    messages: number
    profile: number
    certificates: number
  }

  // Whether initial hydration is complete
  isHydrated: boolean

  // Actions
  hydrate: () => Promise<void>
  refreshSection: (section: keyof VividDataState["loading"]) => Promise<void>
  refreshAll: () => Promise<void>
  reset: () => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setSection: (section: keyof VividDataState["loading"], data: any) => void
}

// ============================================================================
// Store
// ============================================================================

const initialState = {
  courses: [],
  enrollments: [],
  meetings: [],
  messages: [],
  profile: null,
  certificates: [],
  loading: {
    courses: false,
    enrollments: false,
    meetings: false,
    messages: false,
    profile: false,
    certificates: false,
  },
  lastFetched: {
    courses: 0,
    enrollments: 0,
    meetings: 0,
    messages: 0,
    profile: 0,
    certificates: 0,
  },
  isHydrated: false,
}

export const useVividStore = create<VividDataState>((set, get) => ({
  ...initialState,

  /**
   * Initial hydration — fetch all sections in parallel on session start.
   */
  hydrate: async () => {
    if (get().isHydrated) return

    set({
      loading: {
        courses: true,
        enrollments: true,
        meetings: true,
        messages: true,
        profile: true,
        certificates: true,
      },
    })

    const results = await Promise.allSettled([
      vividSearchCourses({ limit: 8, sortBy: "popular" }),
      vividGetUserEnrollments({ status: "active" }),
      vividCheckActiveMeetings(),
      vividGetRecentMessages({ limit: 5 }),
      vividGetUserProfile(),
      vividGetMyCertificates(),
    ])

    const now = Date.now()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extract = (r: PromiseSettledResult<any>, key: string) =>
      r.status === "fulfilled" && r.value?.success ? r.value[key] : []

    set({
      courses: extract(results[0], "courses"),
      enrollments: extract(results[1], "enrollments"),
      meetings: extract(results[2], "meetings"),
      messages: extract(results[3], "conversations"),
      profile: results[4].status === "fulfilled" && results[4].value?.success
        ? results[4].value.profile
        : null,
      certificates: extract(results[5], "certificates"),
      loading: {
        courses: false,
        enrollments: false,
        meetings: false,
        messages: false,
        profile: false,
        certificates: false,
      },
      lastFetched: {
        courses: now,
        enrollments: now,
        meetings: now,
        messages: now,
        profile: now,
        certificates: now,
      },
      isHydrated: true,
    })
  },

  /**
   * Refresh a single section (background refresh).
   */
  refreshSection: async (section) => {
    set((s) => ({ loading: { ...s.loading, [section]: true } }))

    try {
      let data: unknown
      switch (section) {
        case "courses": {
          const r = await vividSearchCourses({ limit: 8, sortBy: "popular" })
          data = r.success ? r.courses : get().courses
          break
        }
        case "enrollments": {
          const r = await vividGetUserEnrollments({ status: "active" })
          data = r.success ? r.enrollments : get().enrollments
          break
        }
        case "meetings": {
          const r = await vividCheckActiveMeetings()
          data = r.success ? r.meetings : get().meetings
          break
        }
        case "messages": {
          const r = await vividGetRecentMessages({ limit: 5 })
          data = r.success ? r.conversations : get().messages
          break
        }
        case "profile": {
          const r = await vividGetUserProfile()
          data = r.success ? r.profile : get().profile
          break
        }
        case "certificates": {
          const r = await vividGetMyCertificates()
          data = r.success ? r.certificates : get().certificates
          break
        }
      }

      set((s) => ({
        [section]: data,
        loading: { ...s.loading, [section]: false },
        lastFetched: { ...s.lastFetched, [section]: Date.now() },
      }))
    } catch {
      set((s) => ({ loading: { ...s.loading, [section]: false } }))
    }
  },

  /**
   * Refresh all sections.
   */
  refreshAll: async () => {
    const { refreshSection } = get()
    await Promise.all([
      refreshSection("courses"),
      refreshSection("enrollments"),
      refreshSection("meetings"),
      refreshSection("messages"),
      refreshSection("profile"),
      refreshSection("certificates"),
    ])
  },

  /**
   * Update a section from external source (e.g., after a server action).
   */
  setSection: (section, data) => {
    set((s) => ({
      [section]: data,
      lastFetched: { ...s.lastFetched, [section]: Date.now() },
    }))
  },

  /**
   * Reset the store (on session end).
   */
  reset: () => set(initialState),
}))
