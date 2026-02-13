/**
 * Module-level RTK (Dyte) client singleton.
 * Completely decoupled from React lifecycle — survives re-renders, HMR, and strict mode.
 *
 * Usage:
 *   import { rtkClient } from "@/lib/rtk-client"
 *   const client = await rtkClient.init(authToken, { audio: true, video: false })
 *   await client.joinRoom()
 *   // ... later
 *   await rtkClient.destroy()
 */

// The RTK Client type from the core package
import type { default as RTKClientInstance } from "@cloudflare/realtimekit"

type RTKEventCallback = (...args: unknown[]) => void

interface RTKClientManager {
  /** The current Dyte/RTK client instance */
  client: RTKClientInstance | null

  /** Initialize a new client (destroys any existing one first) */
  init(
    authToken: string,
    defaults?: { audio?: boolean; video?: boolean }
  ): Promise<RTKClientInstance>

  /** Join the RTK room */
  joinRoom(): Promise<void>

  /** Leave the room and clean up */
  leaveRoom(): Promise<void>

  /** Destroy the client completely */
  destroy(): Promise<void>

  /** Register an event listener (persists across React re-renders) */
  on(event: string, target: "self" | "participants", callback: RTKEventCallback): void

  /** Remove an event listener */
  off(event: string, target: "self" | "participants", callback: RTKEventCallback): void

  /** Remove all event listeners */
  offAll(): void

  /** Whether the client has joined a room */
  isInRoom: boolean
}

// Module-level state — survives React lifecycle
let _client: RTKClientInstance | null = null
let _isInRoom = false
let _isInitializing = false
let _isJoining = false
const _listeners: Array<{
  event: string
  target: "self" | "participants"
  callback: RTKEventCallback
}> = []

// Cached SDK class — preloaded on app mount so init() doesn't pay the dynamic-import cost
let _CachedClientClass: typeof RTKClientInstance | null = null
let _preloadPromise: Promise<typeof RTKClientInstance> | null = null

/**
 * Eagerly import the RTK SDK and cache the constructor.
 * Call this once on app mount (e.g. in CallProvider useEffect).
 * Subsequent calls are no-ops — returns the cached class instantly.
 */
export function preloadRTKSDK(): Promise<typeof RTKClientInstance> {
  if (_CachedClientClass) return Promise.resolve(_CachedClientClass)
  if (_preloadPromise) return _preloadPromise
  _preloadPromise = import("@cloudflare/realtimekit").then(({ default: C }) => {
    _CachedClientClass = C
    console.log("[RTK-Client] SDK preloaded")
    return C
  })
  return _preloadPromise
}

export const rtkClient: RTKClientManager = {
  get client() {
    return _client
  },

  get isInRoom() {
    return _isInRoom
  },

  async init(authToken, defaults) {
    // Prevent double-init
    if (_isInitializing) {
      console.log("[RTK-Client] Init already in progress, waiting...")
      // Wait for current init to complete
      while (_isInitializing) {
        await new Promise((r) => setTimeout(r, 50))
      }
      if (_client) return _client
    }

    // Dispose existing client first
    if (_client) {
      console.log("[RTK-Client] Destroying previous client before re-init")
      await this.destroy()
    }

    _isInitializing = true
    try {
      // Use cached SDK class if available, otherwise dynamic import (SSR-safe)
      const ClientClass = _CachedClientClass ?? await preloadRTKSDK()
      console.log("[RTK-Client] Initializing with token:", authToken.slice(0, 20) + "...")

      _client = await ClientClass.init({
        authToken,
        defaults: {
          audio: defaults?.audio ?? true,
          video: defaults?.video ?? false,
        },
      })

      console.log("[RTK-Client] Initialized successfully")

      // Re-attach any registered listeners
      for (const { event, target, callback } of _listeners) {
        _attachListener(event, target, callback)
      }

      return _client!
    } catch (err) {
      console.error("[RTK-Client] Init failed:", err)
      _client = null
      throw err
    } finally {
      _isInitializing = false
    }
  },

  async joinRoom() {
    if (!_client) throw new Error("RTK client not initialized")
    if (_isInRoom) {
      console.log("[RTK-Client] Already in room, skipping join")
      return
    }
    if (_isJoining) {
      console.log("[RTK-Client] Join already in progress, waiting...")
      while (_isJoining) {
        await new Promise((r) => setTimeout(r, 50))
      }
      return
    }
    _isJoining = true
    try {
      console.log("[RTK-Client] Joining room...")
      await _client.joinRoom()
      _isInRoom = true
      console.log("[RTK-Client] Joined room")
    } finally {
      _isJoining = false
    }
  },

  async leaveRoom() {
    if (!_client || !_isInRoom) return
    try {
      console.log("[RTK-Client] Leaving room...")
      await _client.leaveRoom()
    } catch {
      // Already left
    }
    _isInRoom = false
  },

  async destroy() {
    if (_client) {
      // Remove all listeners from the actual client
      for (const { event, target, callback } of _listeners) {
        _detachListener(event, target, callback)
      }
      if (_isInRoom) {
        try {
          await _client.leaveRoom()
        } catch {
          // Already left
        }
      }
      _client = null
      _isInRoom = false
    }
  },

  on(event, target, callback) {
    // Store for re-attachment after re-init
    _listeners.push({ event, target, callback })
    // Attach to current client if available
    if (_client) {
      _attachListener(event, target, callback)
    }
  },

  off(event, target, callback) {
    // Remove from stored listeners
    const idx = _listeners.findIndex(
      (l) => l.event === event && l.target === target && l.callback === callback
    )
    if (idx !== -1) _listeners.splice(idx, 1)
    // Detach from current client
    if (_client) {
      _detachListener(event, target, callback)
    }
  },

  offAll() {
    // Detach all from current client
    if (_client) {
      for (const { event, target, callback } of _listeners) {
        _detachListener(event, target, callback)
      }
    }
    _listeners.length = 0
  },
}

function _attachListener(
  event: string,
  target: "self" | "participants",
  callback: RTKEventCallback
) {
  if (!_client) return
  if (target === "self") {
    _client.self.on(event as Parameters<typeof _client.self.on>[0], callback as never)
  } else if (target === "participants") {
    _client.participants.joined.on(
      event as Parameters<typeof _client.participants.joined.on>[0],
      callback as never
    )
  }
}

function _detachListener(
  event: string,
  target: "self" | "participants",
  callback: RTKEventCallback
) {
  if (!_client) return
  try {
    if (target === "self") {
      _client.self.removeListener(event as Parameters<typeof _client.self.removeListener>[0], callback as never)
    } else if (target === "participants") {
      _client.participants.joined.removeListener(
        event as Parameters<typeof _client.participants.joined.removeListener>[0],
        callback as never
      )
    }
  } catch {
    // Listener may already be removed
  }
}
