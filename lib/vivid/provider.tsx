"use client"

/**
 * Vivid AI Provider — WorldStreet Academy
 *
 * Central state manager: connects the realtime client, manages transcript lines,
 * overlay panels, on-demand UI, view modes, and dispatches function calls.
 */

import {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react"
import { useRouter, usePathname } from "next/navigation"
import { useUser } from "@clerk/nextjs"

import type {
  VividContextValue,
  VividAgentState,
  VividViewMode,
  TranscriptLine,
  OverlayPanel,
  OverlaySection,
  OnDemandUI,
} from "./types"
import { RealtimeClient } from "./realtime-client"
import {
  createVividSession,
  executeVividFunction,
} from "./actions"
import { clientFunctions, serverFunctions } from "./functions"
import { useVividStore } from "./store"

// Map server function names to overlay sections
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

// ============================================================================
// Context
// ============================================================================

const VividContext = createContext<VividContextValue | null>(null)

export function useVivid(): VividContextValue {
  const ctx = useContext(VividContext)
  if (!ctx) throw new Error("useVivid must be used within <VividProvider>")
  return ctx
}

// ============================================================================
// Provider
// ============================================================================

interface VividProviderProps {
  children: ReactNode
}

export function VividProvider({ children }: VividProviderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user: clerkUser } = useUser()

  // Core state
  const [state, setState] = useState<VividAgentState>("idle")
  const [viewMode, setViewMode] = useState<VividViewMode>("minimized")
  const [error, setError] = useState<Error | null>(null)

  // Transcript lines (Spotify-style lyrics)
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([])
  const [currentLine, setCurrentLine] = useState<TranscriptLine | null>(null)

  // Live overlay (single panel that updates in-place)
  const [overlayPanels, setOverlayPanels] = useState<OverlayPanel[]>([])
  const [activePanel, setActivePanel] = useState<OverlayPanel | null>(null)

  // On-demand UI
  const [onDemandUI, setOnDemandUI] = useState<OnDemandUI | null>(null)
  const onDemandResolve = useRef<((result: unknown) => void) | null>(null)

  // Client ref
  const clientRef = useRef<RealtimeClient | null>(null)
  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname

  // Buffer for streaming transcript
  const assistantBuffer = useRef("")

  // Ref to endSession so client function can call it without circular deps
  const endSessionRef = useRef<() => void>(() => {})

  // Pending action to execute after AI finishes speaking (onResponseDone)
  const pendingActionRef = useRef<(() => void) | null>(null)

  // Pre-warmed mic stream — acquired on mount to avoid getUserMedia latency later
  const micStreamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    // Fire-and-forget: request mic permission on page load so it's ready when
    // the user taps the blob. If denied, startSession will retry.
    let cancelled = false
    navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
        } else {
          micStreamRef.current = stream
        }
      })
      .catch(() => {
        // Permission denied or unavailable — will retry in startSession
      })
    return () => {
      cancelled = true
      // Stop pre-warmed stream if it was never consumed by a session
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop())
        micStreamRef.current = null
      }
    }
  }, [])

  // ──────────────────────────────────────────────
  // Transcript helpers
  // ──────────────────────────────────────────────

  const addTranscriptLine = useCallback(
    (role: "user" | "assistant", text: string, isFinal: boolean, spokenIdx?: number) => {
      // We only show assistant lines
      if (role === "user") return

      const spoken = spokenIdx ?? text.length
      const line: TranscriptLine = {
        id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role,
        text,
        timestamp: Date.now(),
        isFinal,
        isActive: !isFinal,
        spokenIndex: isFinal ? text.length : spoken,
      }
      setTranscriptLines((prev) => {
        // If the last line is from the same role and not final, update it
        const last = prev[prev.length - 1]
        if (last && last.role === role && !last.isFinal) {
          return [...prev.slice(0, -1), { ...last, text, isFinal, isActive: !isFinal, spokenIndex: isFinal ? text.length : spoken }]
        }
        return [...prev, line]
      })
      if (!isFinal) setCurrentLine(line)
      else setCurrentLine(null)
    },
    [],
  )

  // ──────────────────────────────────────────────
  // Overlay helpers
  // ──────────────────────────────────────────────

  const pushPanel = useCallback(
    (panel: Omit<OverlayPanel, "id" | "timestamp">, openIfClosed = true) => {
      const full: OverlayPanel = {
        ...panel,
        id: `panel-${Date.now()}`,
        timestamp: Date.now(),
      }
      setOverlayPanels((prev) => {
        // Replace panel with same section, or add new
        const filtered = prev.filter((p) => p.section !== panel.section)
        return [...filtered, full]
      })
      setActivePanel(full)
      if (openIfClosed && (viewMode === "minimized" || viewMode === "compact")) {
        setViewMode("expanded")
      }
    },
    [viewMode],
  )

  /** Silently update an existing panel's data without opening the overlay */
  const updatePanelDataSilent = useCallback(
    (section: OverlaySection, data: unknown) => {
      setOverlayPanels((prev) => {
        const existing = prev.find((p) => p.section === section)
        if (!existing) return prev // Don't create new panel silently
        const updated = { ...existing, data, timestamp: Date.now() }
        return prev.map((p) => p.section === section ? updated : p)
      })
      setActivePanel((prev) => {
        if (prev?.section === section) return { ...prev, data, timestamp: Date.now() }
        return prev
      })
    },
    [],
  )

  const updatePanelData = useCallback(
    (section: OverlaySection, data: unknown) => {
      pushPanel({ section, title: section.replace("-", " "), data })
    },
    [pushPanel],
  )

  const clearPanels = useCallback(() => {
    setOverlayPanels([])
    setActivePanel(null)
  }, [])

  // ──────────────────────────────────────────────
  // On-demand UI helpers
  // ──────────────────────────────────────────────

  const showOnDemandUI = useCallback(
    (ui: Omit<OnDemandUI, "id">) => {
      const full: OnDemandUI = { ...ui, id: `ui-${Date.now()}` }
      setOnDemandUI(full)
      if (viewMode === "minimized") setViewMode("expanded")
    },
    [viewMode],
  )

  const dismissUI = useCallback(() => {
    setOnDemandUI(null)
    onDemandResolve.current = null
  }, [])

  const resolveUI = useCallback((result: unknown) => {
    if (onDemandResolve.current) {
      onDemandResolve.current(result)
      onDemandResolve.current = null
    }
    setOnDemandUI(null)
    // Also clear any overlay panels underneath so they don't bleed through
    setOverlayPanels([])
    setActivePanel(null)
  }, [])

  // ──────────────────────────────────────────────
  // Client Function Handlers
  // ──────────────────────────────────────────────

  const handleClientFunction = useCallback(
    async (name: string, args: Record<string, unknown>): Promise<unknown> => {
      switch (name) {
        case "navigateToPage": {
          const path = args.path as string
          router.push(path)
          // Only auto-minimize if no overlay data is actively shown
          // This prevents the overlay from closing when AI navigates as part of a workflow
          if (!activePanel && !onDemandUI) {
            setViewMode("minimized")
          }
          return { success: true, navigatedTo: path }
        }

        case "minimizeSession": {
          setViewMode("minimized")
          return { success: true, minimized: true }
        }

        case "maximizeSession": {
          setViewMode("expanded")
          return { success: true, expanded: true }
        }

        case "endSession": {
          // Defer session end until AI finishes speaking
          pendingActionRef.current = () => endSessionRef.current()
          return { success: true, ended: true, message: "Session ending — goodbye!" }
        }

        case "closeOverlay": {
          clearPanels()
          // If we were in overlay/expanded with only data showing, go compact
          if (viewMode === "overlay") setViewMode("expanded")
          return { success: true, overlayClosed: true }
        }

        case "clearOnDemandUI": {
          dismissUI()
          return { success: true, uiDismissed: true }
        }

        case "updateOverlay": {
          const section = args.section as OverlaySection
          const title = (args.title as string) || section
          // Use cached data from store if available, otherwise show skeleton (null)
          const store = useVividStore.getState()
          const SECTION_TO_STORE: Record<string, keyof typeof store> = {
            courses: "courses",
            enrollments: "enrollments",
            meetings: "meetings",
            messages: "messages",
            profile: "profile",
            certificates: "certificates",
          }
          const storeKey = SECTION_TO_STORE[section]
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cached = storeKey ? (store as any)[storeKey] : null
          const hasCache = cached && (Array.isArray(cached) ? cached.length > 0 : cached !== null)
          pushPanel({ section, title, data: hasCache ? cached : null })
          return { success: true, section }
        }

        case "requestOnDemandUI": {
          const uiType = args.type as OnDemandUI["type"]
          const title = (args.title as string) || uiType
          const desc = args.description as string | undefined

          return new Promise((resolve) => {
            onDemandResolve.current = resolve
            showOnDemandUI({ type: uiType, title, description: desc })
          })
        }

        case "getCurrentTime": {
          return {
            success: true,
            time: new Date().toLocaleTimeString(),
            date: new Date().toLocaleDateString(),
          }
        }

        case "changeLanguage": {
          const langCode = args.languageCode as string
          try {
            // Dynamically import the Google Translate helper to trigger client-side language switch
            const { changeLanguage: switchLang, resetToEnglish } = await import(
              "@/components/translator/translate-script"
            )
            if (langCode === "en") {
              await resetToEnglish()
            } else {
              await switchLang(langCode)
            }
            // Also persist to DB in the background
            const { updatePreferredLanguage } = await import("@/lib/actions/language")
            updatePreferredLanguage(langCode).catch(() => {})
            return { success: true, languageCode: langCode, message: `Language changed to ${langCode}` }
          } catch (error) {
            console.error("[Vivid] changeLanguage error:", error)
            return { success: false, error: "Failed to change language" }
          }
        }

        case "toggleTheme": {
          // Toggle document class for dark/light mode
          const root = document.documentElement
          const current = root.classList.contains("dark") ? "dark" : "light"
          const next = current === "dark" ? "light" : "dark"
          root.classList.remove(current)
          root.classList.add(next)
          // Persist via localStorage for next-themes
          localStorage.setItem("theme", next)
          // Dispatch storage event so next-themes picks it up
          window.dispatchEvent(new StorageEvent("storage", { key: "theme", newValue: next }))
          return { success: true, theme: next, message: `Switched to ${next} mode` }
        }

        case "playPauseVideo": {
          const action = (args.action as string) || "toggle"
          try {
            const video = document.querySelector("video") as HTMLVideoElement | null
            if (!video) return { success: false, error: "No video player found on this page" }
            if (action === "play") { await video.play(); return { success: true, state: "playing" } }
            if (action === "pause") { video.pause(); return { success: true, state: "paused" } }
            // toggle
            if (video.paused) { await video.play(); return { success: true, state: "playing" } }
            else { video.pause(); return { success: true, state: "paused" } }
          } catch (error) {
            console.error("[Vivid] playPauseVideo error:", error)
            return { success: false, error: "Could not control the video" }
          }
        }

        case "copyToClipboard": {
          const text = args.text as string
          const label = (args.label as string) || "Text"
          try {
            await navigator.clipboard.writeText(text)
            return { success: true, message: `${label} copied to clipboard!` }
          } catch {
            return { success: false, error: "Failed to copy to clipboard" }
          }
        }

        case "scrollToSection": {
          const sectionId = args.sectionId as string
          try {
            const el = document.querySelector(sectionId)
            if (!el) return { success: false, error: `Section "${sectionId}" not found on this page` }
            el.scrollIntoView({ behavior: "smooth", block: "start" })
            return { success: true, scrolledTo: sectionId }
          } catch {
            return { success: false, error: "Failed to scroll" }
          }
        }

        default:
          return { success: false, error: `Unknown client function: ${name}` }
      }
    },
    [router, pushPanel, showOnDemandUI, clearPanels, dismissUI, viewMode, activePanel, onDemandUI],
  )

  // ──────────────────────────────────────────────
  // Auto-overlay: map server function results → overlay panel
  // ──────────────────────────────────────────────

  const autoOverlay = useCallback(
    (fnName: string, result: unknown) => {
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
        // Only populate data into an EXISTING panel.
        // The AI must explicitly call updateOverlay to OPEN the panel.
        // This prevents flicker from the AI calling multiple server functions.
        updatePanelDataSilent(section, data)
      }
    },
    [updatePanelDataSilent],
  )

  // ──────────────────────────────────────────────
  // Function Dispatch
  // ──────────────────────────────────────────────

  const handleFunctionCall = useCallback(
    async (name: string, args: Record<string, unknown>, callId: string) => {
      let result: unknown

      const isClient = clientFunctions.some((f) => f.name === name)
      const isServer = serverFunctions.some((f) => f.name === name)

      if (isClient) {
        result = await handleClientFunction(name, args)
      } else if (isServer) {
        result = await executeVividFunction(name, args)
        // Auto-push to overlay if this function has a mapping
        autoOverlay(name, result)

        // Special: after initiateCall, defer end-session + navigation until AI finishes speaking
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = result as any
        if (name === "initiateCall" && r?.success && r?.call?.navigateTo) {
          const navigateTo = r.call.navigateTo
          pendingActionRef.current = () => {
            endSessionRef.current()
            router.push(navigateTo)
          }
        }
      } else {
        result = { success: false, error: `Function "${name}" not registered` }
      }

      clientRef.current?.sendFunctionResult(callId, result)
    },
    [handleClientFunction, autoOverlay, router],
  )

  // ──────────────────────────────────────────────
  // Session Start / Stop
  // ──────────────────────────────────────────────

  const startSession = useCallback(async () => {
    if (clientRef.current) return

    setState("connecting")
    setError(null)
    assistantBuffer.current = ""

    // Hydrate the data store in the background
    useVividStore.getState().hydrate()

    try {
      const sessionParams = clerkUser
        ? {
            userId: clerkUser.id,
            userName: clerkUser.firstName || "",
            userLastName: clerkUser.lastName || "",
            userEmail: clerkUser.primaryEmailAddress?.emailAddress || "",
            userRole:
              (clerkUser.publicMetadata?.role as string) || "user",
            pathname: pathnameRef.current,
          }
        : { pathname: pathnameRef.current }

      const client = new RealtimeClient(
        { sessionToken: "", instructions: "" },
        {
          onStateChange: (s) => setState(s),
          onTranscript: (text, isFinal) => {
            if (isFinal) {
              addTranscriptLine("assistant", text, true)
              assistantBuffer.current = ""
            } else {
              if (assistantBuffer.current === "") {
                setTranscriptLines([])
              }
              const prevLen = assistantBuffer.current.length
              assistantBuffer.current += text
              addTranscriptLine("assistant", assistantBuffer.current, false, prevLen + text.length)
            }
          },
          onUserTranscript: () => {},
          onFunctionCall: handleFunctionCall,
          onError: (err) => {
            setError(err)
            console.error("[Vivid] Error:", err)
          },
          onResponseDone: () => {
            assistantBuffer.current = ""
            if (pendingActionRef.current) {
              const action = pendingActionRef.current
              pendingActionRef.current = null
              setTimeout(action, 200)
            }
          },
        },
      )

      // ── Parallel phase: token fetch + WebRTC prepare run simultaneously ──
      // Grab pre-warmed mic stream (may be null if denied / not ready yet)
      const preWarmedMic = micStreamRef.current
      micStreamRef.current = null // hand ownership to the client

      const [session] = await Promise.all([
        createVividSession(sessionParams),
        client.prepare(preWarmedMic),
      ])

      if (!session.success || !session.client_secret) {
        client.disconnect()
        throw new Error(session.error || "Failed to create session")
      }

      // ── Finalize: SDP exchange using the token (needs both offer + token) ──
      clientRef.current = client
      await client.finalize(session.client_secret)

      // Start in minimized state — user or AI can expand later
      setViewMode("minimized")
    } catch (err) {
      setState("error")
      setError(err instanceof Error ? err : new Error(String(err)))
    }
  }, [clerkUser, handleFunctionCall, addTranscriptLine])

  const endSession = useCallback(() => {
    clientRef.current?.disconnect()
    clientRef.current = null
    setState("idle")
    setViewMode("minimized")
    setTranscriptLines([])
    setCurrentLine(null)
    clearPanels()
    dismissUI()
    assistantBuffer.current = ""
    useVividStore.getState().reset()
  }, [clearPanels, dismissUI])

  // Keep endSessionRef in sync so handleClientFunction can call it
  useEffect(() => {
    endSessionRef.current = endSession
  }, [endSession])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clientRef.current?.disconnect()
      clientRef.current = null
    }
  }, [])

  // ──────────────────────────────────────────────
  // Audio Levels
  // ──────────────────────────────────────────────

  const getAudioLevels = useCallback((): Uint8Array => {
    return clientRef.current?.getAudioLevels() ?? new Uint8Array(0)
  }, [])

  // ──────────────────────────────────────────────
  // Context Value
  // ──────────────────────────────────────────────

  const isConnected = state !== "idle" && state !== "error" && state !== "connecting"
  const isListening = state === "listening"
  const isSpeaking = state === "speaking"

  const value: VividContextValue = {
    state,
    viewMode,
    isConnected,
    isListening,
    isSpeaking,
    error,
    transcriptLines,
    currentLine,
    overlayPanels,
    activePanel,
    onDemandUI,
    startSession,
    endSession,
    setViewMode,
    pushPanel,
    updatePanel: updatePanelData,
    clearPanels,
    showOnDemandUI,
    dismissUI,
    resolveUI,
    getAudioLevels,
  }

  return <VividContext value={value}>{children}</VividContext>
}
