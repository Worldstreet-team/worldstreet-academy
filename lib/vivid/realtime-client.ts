/**
 * Vivid AI Realtime Client — WebRTC Connection to OpenAI
 *
 * Handles the WebRTC peer connection, data channel events,
 * audio playback, and microphone capture.
 */

import type { VividAgentState, OpenAIToolDefinition } from "./types"

// ============================================================================
// Types
// ============================================================================

export interface RealtimeClientConfig {
  sessionToken: string
  instructions: string
  voice?: string
  tools?: OpenAIToolDefinition[]
}

export interface RealtimeClientEvents {
  onStateChange: (state: VividAgentState) => void
  onTranscript: (text: string, isFinal: boolean) => void
  onUserTranscript: (text: string, isFinal: boolean) => void
  onFunctionCall: (name: string, args: Record<string, unknown>, callId: string) => void
  onError: (error: Error) => void
  onResponseDone: () => void
}

// ============================================================================
// Client
// ============================================================================

export class RealtimeClient {
  private pc: RTCPeerConnection | null = null
  private dc: RTCDataChannel | null = null
  private audioElement: HTMLAudioElement | null = null
  private mediaStream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private localOffer: RTCSessionDescriptionInit | null = null

  private config: RealtimeClientConfig
  private events: RealtimeClientEvents
  private state: VividAgentState = "idle"
  private isSpeakingRef = false

  private static readonly REALTIME_URL = "https://api.openai.com/v1/realtime"
  private static readonly MODEL = "gpt-4o-realtime-preview-2024-12-17"

  constructor(config: RealtimeClientConfig, events: RealtimeClientEvents) {
    this.config = config
    this.events = events
  }

  /**
   * Phase 1 — Prepare: sets up PeerConnection, mic, AudioContext, DataChannel,
   * and creates the SDP offer. Does NOT need the session token.
   * Can accept a pre-warmed MediaStream to skip getUserMedia latency.
   */
  async prepare(preWarmedStream?: MediaStream | null): Promise<void> {
    if (this.pc) return
    this.setState("connecting")

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    })
    this.pc = pc

    const audioEl = document.createElement("audio")
    audioEl.autoplay = true
    audioEl.setAttribute("playsinline", "true")
    this.audioElement = audioEl
    document.body.appendChild(audioEl)

    try {
      this.audioContext = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      )()
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 512
      this.analyser.smoothingTimeConstant = 0.5
    } catch (e) {
      console.warn("[Vivid] AudioContext init failed:", e)
    }

    pc.ontrack = (event) => {
      const stream = event.streams[0]
      audioEl.srcObject = stream
      audioEl.play().catch(() => {})
      if (this.audioContext && this.analyser && stream) {
        try {
          const node = this.audioContext.createMediaStreamSource(stream)
          node.connect(this.analyser)
        } catch {}
      }
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        this.disconnect()
      }
    }

    // Reuse pre-warmed mic stream, or request a fresh one
    const stream = (preWarmedStream && preWarmedStream.active)
      ? preWarmedStream
      : await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        })
    this.mediaStream = stream
    stream.getTracks().forEach((track) => pc.addTrack(track, stream))

    if (this.audioContext && this.analyser) {
      try {
        const micNode = this.audioContext.createMediaStreamSource(stream)
        micNode.connect(this.analyser)
      } catch {}
    }

    const dc = pc.createDataChannel("oai-events")
    this.dc = dc

    dc.onopen = () => {
      this.setState("ready")
      // Send greeting request immediately — no delay needed, channel is open
      if (dc.readyState === "open") {
        dc.send(JSON.stringify({ type: "response.create" }))
      }
    }

    dc.onmessage = (event) => {
      try {
        this.handleEvent(JSON.parse(event.data))
      } catch {}
    }

    dc.onclose = () => {
      this.setState("idle")
      this.events.onResponseDone()
    }

    // Create the SDP offer (doesn't require token)
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    this.localOffer = offer
  }

  /**
   * Phase 2 — Finalize: exchanges the SDP offer for an answer using the
   * session token, then sets the remote description to complete the handshake.
   */
  async finalize(sessionToken: string): Promise<void> {
    if (!this.pc || !this.localOffer) {
      throw new Error("[Vivid] prepare() must be called before finalize()")
    }

    const sdpResponse = await fetch(
      `${RealtimeClient.REALTIME_URL}?model=${RealtimeClient.MODEL}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/sdp",
        },
        body: this.localOffer.sdp,
      }
    )

    if (!sdpResponse.ok) {
      throw new Error(`WebRTC SDP exchange failed: ${sdpResponse.status}`)
    }

    const answerSdp = await sdpResponse.text()
    await this.pc.setRemoteDescription({ type: "answer", sdp: answerSdp })
    this.localOffer = null
  }

  /**
   * Legacy one-shot connect: calls prepare() then finalize().
   * Kept for backward compatibility.
   */
  async connect(preWarmedStream?: MediaStream | null): Promise<void> {
    try {
      await this.prepare(preWarmedStream)
      await this.finalize(this.config.sessionToken)
    } catch (error) {
      this.setState("error")
      this.events.onError(error instanceof Error ? error : new Error(String(error)))
      this.disconnect()
    }
  }

  disconnect(): void {
    this.dc?.close()
    this.dc = null
    this.mediaStream?.getTracks().forEach((t) => t.stop())
    this.mediaStream = null
    this.pc?.close()
    this.pc = null
    if (this.audioElement) {
      this.audioElement.srcObject = null
      this.audioElement.remove()
      this.audioElement = null
    }
    this.audioContext?.close().catch(() => {})
    this.audioContext = null
    this.analyser = null
    this.setState("idle")
  }

  sendFunctionResult(callId: string, result: unknown): void {
    if (this.dc?.readyState !== "open") return
    try {
      this.dc.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: callId,
            output: JSON.stringify(result),
          },
        })
      )
      this.dc.send(JSON.stringify({ type: "response.create" }))
    } catch (e) {
      console.warn("[Vivid] Failed to send function result:", e)
    }
  }

  getAudioLevels(): Uint8Array {
    if (!this.analyser) return new Uint8Array(0)
    const data = new Uint8Array(this.analyser.frequencyBinCount)
    this.analyser.getByteFrequencyData(data)
    return data
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleEvent(event: Record<string, any>): void {
    switch (event.type) {
      case "input_audio_buffer.speech_started":
        this.setState("listening")
        break

      case "input_audio_buffer.speech_stopped":
        this.setState("processing")
        break

      case "response.audio.delta":
        if (!this.isSpeakingRef) {
          this.isSpeakingRef = true
          this.setState("speaking")
        }
        break

      case "response.audio_transcript.delta":
        this.events.onTranscript(event.delta || "", false)
        break

      case "response.audio_transcript.done":
        this.events.onTranscript(event.transcript || "", true)
        break

      // User speech transcript
      case "conversation.item.input_audio_transcription.completed":
        this.events.onUserTranscript(event.transcript || "", true)
        break

      case "response.function_call_arguments.done":
        try {
          const args = JSON.parse(event.arguments || "{}")
          this.events.onFunctionCall(event.name, args, event.call_id)
        } catch {
          console.error("[Vivid] Failed to parse function args")
        }
        break

      case "response.done":
        this.isSpeakingRef = false
        this.setState("ready")
        this.events.onResponseDone()
        break

      case "error": {
        const msg = event.error?.message || ""
        // Suppress non-fatal errors like stale call_id
        if (msg.includes("not found") || msg.includes("already")) {
          console.warn("[Vivid] Non-fatal realtime error:", msg)
        } else {
          console.error("[Vivid] Realtime error:", event.error)
          this.events.onError(new Error(msg || "Realtime error"))
        }
        break
      }
    }
  }

  private setState(state: VividAgentState): void {
    this.state = state
    this.events.onStateChange(state)
  }
}
