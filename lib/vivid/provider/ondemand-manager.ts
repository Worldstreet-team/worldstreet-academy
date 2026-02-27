"use client"

/**
 * On-Demand UI Manager — isolated hook for on-demand UI state.
 *
 * Key bug-fix: exposes `isActiveRef` so async callbacks (e.g. onResponseDone)
 * can check whether an on-demand UI is open without stale closures.
 * This prevents the AI from ending the session while a file-upload or
 * signature canvas is still active.
 */

import { useState, useCallback, useRef, useEffect } from "react"
import type { OnDemandUI, VividViewMode } from "../types"

export function useOnDemandManager(
  viewMode: VividViewMode,
  setViewMode: (mode: VividViewMode) => void,
) {
  const [onDemandUI, setOnDemandUI] = useState<OnDemandUI | null>(null)
  const onDemandResolve = useRef<((result: unknown) => void) | null>(null)

  // Ref stays in sync so async callbacks can read the latest value
  const isActiveRef = useRef(false)
  useEffect(() => {
    isActiveRef.current = !!onDemandUI
  }, [onDemandUI])

  const showOnDemandUI = useCallback(
    (ui: Omit<OnDemandUI, "id">) => {
      const full: OnDemandUI = { ...ui, id: `ui-${Date.now()}` }
      setOnDemandUI(full)
      if (viewMode === "minimized") setViewMode("expanded")
    },
    [viewMode, setViewMode],
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
  }, [])

  return {
    onDemandUI,
    onDemandResolve,
    isActiveRef,
    showOnDemandUI,
    dismissUI,
    resolveUI,
  }
}
