/**
 * Meeting sound effects using Web Audio API.
 * Lightweight synthetic sounds — no audio files needed.
 */

let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext()
  }
  if (audioContext.state === "suspended") {
    audioContext.resume()
  }
  return audioContext
}

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = "sine",
  volume = 0.3,
) {
  try {
    const ctx = getAudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = type
    osc.frequency.setValueAtTime(frequency, ctx.currentTime)
    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
  } catch {
    // Silently fail if audio is not available
  }
}

/** Short ascending tone — played when starting to create a meeting */
export function playMeetingCreating() {
  try {
    const ctx = getAudioContext()
    const now = ctx.currentTime
    const notes = [440, 554]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.setValueAtTime(freq, now + i * 0.12)
      gain.gain.setValueAtTime(0.15, now + i * 0.12)
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.12 + 0.15)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + i * 0.12)
      osc.stop(now + i * 0.12 + 0.15)
    })
  } catch {
    // Silently fail
  }
}

/** Pleasant success chime — played when meeting is created/joined */
export function playMeetingJoined() {
  try {
    const ctx = getAudioContext()
    const now = ctx.currentTime
    // Three-note ascending chime (C5 → E5 → G5)
    const notes = [523, 659, 784]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.setValueAtTime(freq, now + i * 0.1)
      gain.gain.setValueAtTime(0.12, now + i * 0.1)
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.3)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + i * 0.1)
      osc.stop(now + i * 0.1 + 0.3)
    })
  } catch {
    // Silently fail
  }
}

/** Subtle notification — screen share start */
export function playScreenShare() {
  playTone(880, 0.15, "sine", 0.12)
}

/** Soft knock — hand raise */
export function playHandRaise() {
  try {
    const ctx = getAudioContext()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "triangle"
    osc.frequency.setValueAtTime(800, now)
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.1)
    gain.gain.setValueAtTime(0.2, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.15)
  } catch {
    // Silently fail
  }
}

/** Light bubble pop — reaction */
export function playReaction() {
  try {
    const ctx = getAudioContext()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.frequency.setValueAtTime(600, now)
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08)
    gain.gain.setValueAtTime(0.15, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.12)
  } catch {
    // Silently fail
  }
}
