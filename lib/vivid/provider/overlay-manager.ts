"use client"

/**
 * Overlay Manager — isolated hook for overlay panel state.
 *
 * Manages a stack of panels where each section can only appear once.
 * pushPanel auto-expands the widget when called, while
 * updatePanelDataSilent fills data into an existing panel without
 * opening the overlay (used by auto-overlay for server results).
 */

import { useState, useCallback } from "react"
import type { OverlayPanel, OverlaySection, VividViewMode } from "../types"

export function useOverlayManager(
  viewMode: VividViewMode,
  setViewMode: (mode: VividViewMode) => void,
) {
  const [overlayPanels, setOverlayPanels] = useState<OverlayPanel[]>([])
  const [activePanel, setActivePanel] = useState<OverlayPanel | null>(null)

  const pushPanel = useCallback(
    (panel: Omit<OverlayPanel, "id" | "timestamp">, openIfClosed = true) => {
      const full: OverlayPanel = {
        ...panel,
        id: `panel-${Date.now()}`,
        timestamp: Date.now(),
      }
      setOverlayPanels((prev) => {
        const filtered = prev.filter((p) => p.section !== panel.section)
        return [...filtered, full]
      })
      setActivePanel(full)
      if (openIfClosed && (viewMode === "minimized" || viewMode === "compact")) {
        setViewMode("expanded")
      }
    },
    [viewMode, setViewMode],
  )

  /** Silently update an existing panel's data without opening the overlay */
  const updatePanelDataSilent = useCallback(
    (section: OverlaySection, data: unknown) => {
      setOverlayPanels((prev) => {
        const existing = prev.find((p) => p.section === section)
        if (!existing) return prev
        const updated = { ...existing, data, timestamp: Date.now() }
        return prev.map((p) => (p.section === section ? updated : p))
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

  return {
    overlayPanels,
    activePanel,
    pushPanel,
    updatePanelDataSilent,
    updatePanelData,
    clearPanels,
  }
}
