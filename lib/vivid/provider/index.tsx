"use client"

/**
 * Vivid AI Provider — WorldStreet Academy
 *
 * Thin shell wiring together isolated managers. Uses a **ref-based callback
 * pattern** so the RealtimeClient always invokes the LATEST handler versions,
 * eliminating stale-closure bugs that caused actions to silently fail.
 *
 * Bug-fixes vs the monolithic version:
 *   1. Session end is BLOCKED while an on-demand UI is active.
 *   2. resolveUI clears overlay panels so they don't bleed through.
 *   3. changeLanguage now triggers the DOM change (Google Translate) in addition
 *      to the DB update — it was unreachable dead code before.
 *   4. All RealtimeClient callbacks read from refs — no stale closures.
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
} from "../types"
import { RealtimeClient } from "../realtime-client"
import { createVividSession, executeVividFunction } from "../actions"
import { clientFunctions, serverFunctions } from "../functions"
import { useVividStore } from "../store"

import { useTranscriptManager } from "./transcript-manager"
import { useOverlayManager } from "./overlay-manager"
import { useOnDemandManager } from "./ondemand-manager"
import { handleClientFn, type ClientHandlerDeps } from "./client-handler"
import { mapResultToOverlay } from "./server-handler"

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

  // ── Core state ──────────────────────────────────────────────
  const [state, setState] = useState<VividAgentState>("idle")
  const [viewMode, setViewMode] = useState<VividViewMode>("minimized")
  const [error, setError] = useState<Error | null>(null)

  // ── Managers ────────────────────────────────────────────────
  const transcript = useTranscriptManager()
  const overlay = useOverlayManager(viewMode, setViewMode)
  const ondemand = useOnDemandManager(viewMode, setViewMode)

  // ── Refs ────────────────────────────────────────────────────
  const clientRef = useRef<RealtimeClient | null>(null)
  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname

  const endSessionRef = useRef<() => void>(() => {})
  const pendingActionRef = useRef<(() => void) | null>(null)
  const pendingFnCallRef = useRef<Promise<void> | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)

  // ── Keep refs to managers & state so callbacks are always current ──
  const overlayRef = useRef(overlay)
  overlayRef.current = overlay

  const ondemandRef = useRef(ondemand)
  ondemandRef.current = ondemand

  const viewModeRef = useRef(viewMode)
  viewModeRef.current = viewMode

  const transcriptRef = useRef(transcript)
  transcriptRef.current = transcript

  const routerRef = useRef(router)
  routerRef.current = router

  // ── Pre-warm mic ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      .then((stream) => {
        if (cancelled) stream.getTracks().forEach((t) => t.stop())
        else micStreamRef.current = stream
      })
      .catch(() => {})
    return () => {
      cancelled = true
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop())
        micStreamRef.current = null
      }
    }
  }, [])

  // ── Bug-fix: fire pending action after on-demand UI dismisses ──
  const prevOnDemandRef = useRef(ondemand.onDemandUI)
  useEffect(() => {
    const wasActive = !!prevOnDemandRef.current
    const isActive = !!ondemand.onDemandUI
    prevOnDemandRef.current = ondemand.onDemandUI

    if (wasActive && !isActive && pendingActionRef.current) {
      const action = pendingActionRef.current
      pendingActionRef.current = null
      setTimeout(action, 200)
    }
  }, [ondemand.onDemandUI])

  // ── Wrapped resolveUI: also clears overlay underneath ──────
  const resolveUI = useCallback(
    (result: unknown) => {
      ondemand.resolveUI(result)
      overlay.clearPanels()
    },
    [ondemand, overlay],
  )

  // =========================================================================
  // REF-BASED FUNCTION DISPATCH
  //
  // The RealtimeClient is created once in startSession and captures its
  // callbacks forever.  By reading from refs, every callback always invokes
  // the LATEST manager functions, viewMode, activePanel, etc.
  // =========================================================================

  /** Ref to the core function-call handler — updated every render. */
  const handleFunctionCallRef = useRef<
    (name: string, args: Record<string, unknown>, callId: string) => Promise<void>
  >(async () => {})

  // Re-assign on every render (synchronous — safe in React 19).
  handleFunctionCallRef.current = async (name, args, callId) => {
    let result: unknown

    const isClient = clientFunctions.some((f) => f.name === name)
    const isServer = serverFunctions.some((f) => f.name === name)

    if (isClient) {
      // Build deps from refs → always current values
      const deps: ClientHandlerDeps = {
        router: routerRef.current,
        pushPanel: overlayRef.current.pushPanel,
        clearPanels: overlayRef.current.clearPanels,
        showOnDemandUI: ondemandRef.current.showOnDemandUI,
        dismissUI: ondemandRef.current.dismissUI,
        viewMode: viewModeRef.current,
        setViewMode,
        activePanel: overlayRef.current.activePanel,
        onDemandUI: ondemandRef.current.onDemandUI,
        onDemandResolve: ondemandRef.current.onDemandResolve,
        pendingActionRef,
        endSessionRef,
      }
      result = await handleClientFn(name, args, deps)
    } else if (isServer) {
      result = await executeVividFunction(name, args)
      mapResultToOverlay(name, result, overlayRef.current.updatePanelDataSilent)

      // ── Client-side post-processing for server functions ────────
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = result as any

      // changeLanguage: the server action updates the DB, but we also need
      // to trigger the DOM change (Google Translate) on the client.
      if (name === "changeLanguage" && r?.success) {
        try {
          const langCode = (args.languageCode as string) || r.languageCode
          const { changeLanguage: switchLang, resetToEnglish } = await import(
            "@/components/translator/translate-script"
          )
          if (langCode === "en") await resetToEnglish()
          else await switchLang(langCode)
        } catch (e) {
          console.error("[Vivid] Client-side language change error:", e)
        }
      }

      // initiateCall: defer navigation + session end until AI finishes speaking
      if (name === "initiateCall" && r?.success && r?.call?.navigateTo) {
        const navigateTo = r.call.navigateTo
        pendingActionRef.current = () => {
          endSessionRef.current()
          routerRef.current.push(navigateTo)
        }
        // Timeout fallback: if onResponseDone never fires (or already fired),
        // force the action after 4 seconds.
        const actionSnapshot = pendingActionRef.current
        setTimeout(() => {
          if (pendingActionRef.current === actionSnapshot) {
            const action = pendingActionRef.current
            pendingActionRef.current = null
            action()
          }
        }, 4000)
      }
    } else {
      result = { success: false, error: `Function "${name}" not registered` }
    }

    clientRef.current?.sendFunctionResult(callId, result)
  }

  // =========================================================================
  // Session Lifecycle
  // =========================================================================

  const startSession = useCallback(async () => {
    if (clientRef.current) return

    setState("connecting")
    setError(null)
    transcriptRef.current.assistantBuffer.current = ""

    // Hydrate the data store in the background
    useVividStore.getState().hydrate()

    try {
      const sessionParams = clerkUser
        ? {
            userId: clerkUser.id,
            userName: clerkUser.firstName || "",
            userLastName: clerkUser.lastName || "",
            userEmail: clerkUser.primaryEmailAddress?.emailAddress || "",
            userRole: (clerkUser.publicMetadata?.role as string) || "user",
            pathname: pathnameRef.current,
          }
        : { pathname: pathnameRef.current }

      const client = new RealtimeClient(
        { sessionToken: "", instructions: "" },
        {
          onStateChange: (s) => setState(s),

          // ── Transcript: stream assistant + user lines ──
          onTranscript: (text, isFinal) => {
            const buf = transcriptRef.current.assistantBuffer
            if (isFinal) {
              buf.current = ""
              transcriptRef.current.addTranscriptLine("assistant", text, true, text.length)
            } else {
              buf.current += text
              transcriptRef.current.addTranscriptLine("assistant", buf.current, false, buf.current.length)
            }
          },

          onUserTranscript: (text, isFinal) => {
            transcriptRef.current.addTranscriptLine("user", text, isFinal, text.length)
          },

          // ── Function call: delegate to ref → always current handler ──
          onFunctionCall: (name, args, callId) => {
            const promise = handleFunctionCallRef.current(name, args, callId)
            pendingFnCallRef.current = promise
            promise.finally(() => {
              if (pendingFnCallRef.current === promise) {
                pendingFnCallRef.current = null
              }
            })
          },

          onError: (err) => {
            setError(err)
            console.error("[Vivid] Error:", err)
          },

          // ── Response done: read from ref → always current on-demand state ──
          onResponseDone: () => {
            // Wait for any in-flight function call to complete before
            // checking pendingActionRef — fixes the race where
            // response.done fires before the async handler resolves.
            const maybePending = pendingFnCallRef.current
            const execute = () => {
              if (pendingActionRef.current) {
                if (ondemandRef.current.isActiveRef.current) return
                const action = pendingActionRef.current
                pendingActionRef.current = null
                setTimeout(action, 200)
              }
            }
            if (maybePending) {
              maybePending.then(execute).catch(execute)
            } else {
              execute()
            }
          },
        },
      )

      // ── Parallel: token fetch + WebRTC prepare ──
      const preWarmedMic = micStreamRef.current
      micStreamRef.current = null

      const [session] = await Promise.all([
        createVividSession(sessionParams),
        client.prepare(preWarmedMic),
      ])

      if (!session.success || !session.client_secret) {
        client.disconnect()
        throw new Error(session.error || "Failed to create session")
      }

      clientRef.current = client
      await client.finalize(session.client_secret)

      setViewMode("minimized")
    } catch (err) {
      setState("error")
      setError(err instanceof Error ? err : new Error(String(err)))
    }
  }, [clerkUser])

  const endSession = useCallback(() => {
    clientRef.current?.disconnect()
    clientRef.current = null
    setState("idle")
    setViewMode("minimized")
    transcriptRef.current.resetTranscript()
    overlayRef.current.clearPanels()
    ondemandRef.current.dismissUI()
    useVividStore.getState().reset()
  }, [])

  // Keep endSessionRef in sync
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

  // ── Audio levels ───────────────────────────────────────────
  const getAudioLevels = useCallback((): Uint8Array => {
    return clientRef.current?.getAudioLevels() ?? new Uint8Array(0)
  }, [])

  // ── Context value ──────────────────────────────────────────
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
    transcriptLines: transcript.transcriptLines,
    currentLine: transcript.currentLine,
    overlayPanels: overlay.overlayPanels,
    activePanel: overlay.activePanel,
    onDemandUI: ondemand.onDemandUI,
    startSession,
    endSession,
    setViewMode,
    pushPanel: overlay.pushPanel,
    updatePanel: overlay.updatePanelData,
    clearPanels: overlay.clearPanels,
    showOnDemandUI: ondemand.showOnDemandUI,
    dismissUI: ondemand.dismissUI,
    resolveUI,
    getAudioLevels,
  }

  return <VividContext value={value}>{children}</VividContext>
}
