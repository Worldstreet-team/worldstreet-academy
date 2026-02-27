/**
 * Vivid AI Types — WorldStreet Academy
 *
 * Core type definitions for the bespoke Vivid voice agent.
 * Supports: live overlay, on-demand UI, transcript lyrics, navigation, actions.
 */

// ============================================================================
// Function System
// ============================================================================

export interface JSONSchemaProperty {
  type: "string" | "number" | "boolean" | "object" | "array"
  description?: string
  enum?: string[]
  items?: JSONSchemaProperty
  properties?: Record<string, JSONSchemaProperty>
  required?: string[]
}

export interface JSONSchema {
  type: "object"
  properties: Record<string, JSONSchemaProperty>
  required?: string[]
}

export interface VividFunctionConfig {
  name: string
  description: string
  parameters: JSONSchema
  handler: (params: Record<string, unknown>) => Promise<unknown>
  executionContext: "client" | "server"
}

export interface OpenAIToolDefinition {
  type: "function"
  name: string
  description: string
  parameters: JSONSchema
}

// ============================================================================
// Agent State
// ============================================================================

export type VividAgentState =
  | "idle"
  | "connecting"
  | "ready"
  | "listening"
  | "processing"
  | "speaking"
  | "error"

// ============================================================================
// Conversation
// ============================================================================

export interface ConversationTurn {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: number
  functionCalls?: FunctionCallRecord[]
}

export interface FunctionCallRecord {
  name: string
  arguments: Record<string, unknown>
  result?: unknown
  error?: string
}

// ============================================================================
// Transcript Line (Spotify-style lyrics)
// ============================================================================

export interface TranscriptLine {
  id: string
  role: "user" | "assistant"
  text: string
  timestamp: number
  isFinal: boolean
  isActive: boolean
  /** Character index up to which audio has been delivered (for karaoke highlight) */
  spokenIndex: number
}

// ============================================================================
// Live Overlay — single unified panel that updates in-place
// ============================================================================

export type OverlaySection =
  | "courses"
  | "meetings"
  | "enrollments"
  | "messages"
  | "course-detail"
  | "profile"
  | "search-results"
  | "certificates"

export interface OverlayPanel {
  id: string
  section: OverlaySection
  title: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
  timestamp: number
}

// ============================================================================
// On-Demand UI (dynamic prompts)
// ============================================================================

export type OnDemandUIType =
  | "file-upload"
  | "signature-canvas"
  | "confirmation"
  | "rating"
  | "language-picker"
  | "bookmark-toggle"
  | "progress-dashboard"
  | "contact-card"
  | "checkout-confirm"
  | "friend-search"

export interface OnDemandUI {
  id: string
  type: OnDemandUIType
  title: string
  description?: string
  config?: Record<string, unknown>
}

// ============================================================================
// Vivid View Mode
// ============================================================================

export type VividViewMode =
  | "minimized"   // Small floating orb only
  | "compact"     // Orb + small transcript panel
  | "expanded"    // Full-page experience with lyrics + overlay
  | "overlay"     // Overlay panel showing data

// ============================================================================
// Context Value
// ============================================================================

export interface VividContextValue {
  // State
  state: VividAgentState
  viewMode: VividViewMode
  isConnected: boolean
  isListening: boolean
  isSpeaking: boolean
  error: Error | null

  // Transcript (Spotify-style)
  transcriptLines: TranscriptLine[]
  currentLine: TranscriptLine | null

  // Live overlay
  overlayPanels: OverlayPanel[]
  activePanel: OverlayPanel | null

  // On-demand UI
  onDemandUI: OnDemandUI | null

  // Actions
  startSession: () => Promise<void>
  endSession: () => void
  setViewMode: (mode: VividViewMode) => void

  // Overlay
  pushPanel: (panel: Omit<OverlayPanel, "id" | "timestamp">) => void
  updatePanel: (section: OverlaySection, data: unknown) => void
  clearPanels: () => void

  // On-demand
  showOnDemandUI: (ui: Omit<OnDemandUI, "id">) => void
  dismissUI: () => void
  resolveUI: (result: unknown) => void

  // Audio
  getAudioLevels: () => Uint8Array
}
