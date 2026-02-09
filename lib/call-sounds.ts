/**
 * Call sounds using Web Audio API.
 * Generates pleasant tones for call events without external sound files.
 * All sounds are synthesized programmatically — zero dependencies.
 */

class CallSoundManager {
  private ctx: AudioContext | null = null
  private ringInterval: ReturnType<typeof setInterval> | null = null

  private getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new AudioContext()
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {})
    }
    return this.ctx
  }

  /** Resume audio context — call during user gesture (click) to satisfy autoplay policy */
  resume() {
    try {
      this.getContext()
    } catch {
      // AudioContext not available (SSR)
    }
  }

  private playTone(
    frequency: number,
    startOffset: number,
    duration: number,
    volume: number = 0.12,
    type: OscillatorType = "sine"
  ) {
    try {
      const ctx = this.getContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = type
      osc.frequency.value = frequency
      gain.gain.value = 0

      osc.connect(gain)
      gain.connect(ctx.destination)

      const start = ctx.currentTime + startOffset
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(volume, start + 0.015)
      gain.gain.setValueAtTime(volume, start + duration - 0.04)
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration)

      osc.start(start)
      osc.stop(start + duration)
    } catch {
      // Silently fail if AudioContext unavailable
    }
  }

  /**
   * Outgoing ringback tone: US-style 440+480 Hz, 2 s on / 4 s off.
   * Caller hears this while waiting for the receiver to pick up.
   */
  startOutgoingRing() {
    this.stopRing()
    const playRingCycle = () => {
      this.playTone(440, 0, 2, 0.07)
      this.playTone(480, 0, 2, 0.07)
    }
    playRingCycle()
    this.ringInterval = setInterval(playRingCycle, 4000)
  }

  /**
   * Incoming ring: musical double-chirp C5→E5, C5→E5.
   * Receiver hears this when a call arrives.
   */
  startIncomingRing() {
    this.stopRing()
    const playRingCycle = () => {
      // First chirp
      this.playTone(523.25, 0, 0.15, 0.18) // C5
      this.playTone(659.25, 0.16, 0.15, 0.18) // E5
      // Second chirp
      this.playTone(523.25, 0.5, 0.15, 0.18) // C5
      this.playTone(659.25, 0.66, 0.15, 0.18) // E5
    }
    playRingCycle()
    this.ringInterval = setInterval(playRingCycle, 2500)
  }

  /** Call connected: quick ascending C5→E5→G5 arpeggio. */
  playConnected() {
    this.stopRing()
    this.playTone(523.25, 0, 0.12, 0.16) // C5
    this.playTone(659.25, 0.1, 0.12, 0.16) // E5
    this.playTone(783.99, 0.2, 0.22, 0.16) // G5
  }

  /** Call ended: descending B4→G4→E4. */
  playEnded() {
    this.stopRing()
    this.playTone(493.88, 0, 0.15, 0.12) // B4
    this.playTone(392.0, 0.13, 0.15, 0.12) // G4
    this.playTone(329.63, 0.26, 0.25, 0.10) // E4
  }

  /** Call declined / busy: two short low beeps. */
  playDeclined() {
    this.stopRing()
    this.playTone(480, 0, 0.2, 0.12)
    this.playTone(480, 0.35, 0.2, 0.12)
  }

  /** Stop ongoing ring pattern (outgoing or incoming). */
  stopRing() {
    if (this.ringInterval) {
      clearInterval(this.ringInterval)
      this.ringInterval = null
    }
  }

  /** Stop everything — call on unmount / cleanup. */
  stopAll() {
    this.stopRing()
  }
}

export const callSounds = new CallSoundManager()
