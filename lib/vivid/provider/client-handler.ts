"use client"

/**
 * Client Function Handler — handles all 13 client-side functions the AI can call.
 *
 * Extracted from the provider to keep the provider file thin.
 * Receives manager handles and refs as a dependency object.
 */

import type { OverlayPanel, OverlaySection, OnDemandUI, VividViewMode } from "../types"
import { useVividStore } from "../store"

export interface ClientHandlerDeps {
  router: { push: (url: string) => void }
  pushPanel: (panel: Omit<OverlayPanel, "id" | "timestamp">, openIfClosed?: boolean) => void
  clearPanels: () => void
  showOnDemandUI: (ui: Omit<OnDemandUI, "id">) => void
  dismissUI: () => void
  viewMode: VividViewMode
  setViewMode: (mode: VividViewMode) => void
  activePanel: OverlayPanel | null
  onDemandUI: OnDemandUI | null
  onDemandResolve: React.MutableRefObject<((result: unknown) => void) | null>
  pendingActionRef: React.MutableRefObject<(() => void) | null>
  endSessionRef: React.MutableRefObject<() => void>
}

export async function handleClientFn(
  name: string,
  args: Record<string, unknown>,
  deps: ClientHandlerDeps,
): Promise<unknown> {
  const {
    router, pushPanel, clearPanels, showOnDemandUI, dismissUI,
    viewMode, setViewMode, activePanel, onDemandUI,
    onDemandResolve, pendingActionRef, endSessionRef,
  } = deps

  switch (name) {
    case "navigateToPage": {
      const path = args.path as string
      router.push(path)
      // Only auto-minimize if no overlay / on-demand UI is actively shown
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
      // Defer session end until AI finishes speaking (fires in onResponseDone)
      pendingActionRef.current = () => endSessionRef.current()
      return { success: true, ended: true, message: "Session ending — goodbye!" }
    }

    case "closeOverlay": {
      clearPanels()
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
      // Use cached data from Zustand store if available, otherwise show skeleton
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
        const { changeLanguage: switchLang, resetToEnglish } = await import(
          "@/components/translator/translate-script"
        )
        if (langCode === "en") {
          await resetToEnglish()
        } else {
          await switchLang(langCode)
        }
        const { updatePreferredLanguage } = await import("@/lib/actions/language")
        updatePreferredLanguage(langCode).catch(() => {})
        return { success: true, languageCode: langCode, message: `Language changed to ${langCode}` }
      } catch (error) {
        console.error("[Vivid] changeLanguage error:", error)
        return { success: false, error: "Failed to change language" }
      }
    }

    case "toggleTheme": {
      const root = document.documentElement
      const current = root.classList.contains("dark") ? "dark" : "light"
      const next = current === "dark" ? "light" : "dark"
      root.classList.remove(current)
      root.classList.add(next)
      localStorage.setItem("theme", next)
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
}
