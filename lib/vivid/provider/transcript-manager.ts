"use client"

/**
 * Transcript Manager — manages streaming transcript state for karaoke lyrics.
 *
 * Maintains a rolling list of transcript lines from both the assistant and user.
 * The assistant buffer accumulates streaming deltas; when finalized the line is
 * marked isFinal. The `currentLine` always refers to the latest active line.
 */

import { useState, useRef, useCallback } from "react"
import type { TranscriptLine } from "../types"

/** Keep this many past lines to avoid unbounded memory growth */
const MAX_LINES = 50

let lineIdCounter = 0

export function useTranscriptManager() {
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([])
  const [currentLine, setCurrentLine] = useState<TranscriptLine | null>(null)
  const assistantBuffer = useRef("")

  const addTranscriptLine = useCallback(
    (role: "user" | "assistant", text: string, isFinal: boolean, spokenIdx?: number) => {
      setTranscriptLines((prev) => {
        // Look for an existing non-final line by this role to update
        const existingIdx = prev.findIndex(
          (l) => l.role === role && !l.isFinal,
        )

        if (existingIdx >= 0) {
          // Update existing streaming line
          const updated = [...prev]
          updated[existingIdx] = {
            ...updated[existingIdx],
            text,
            isFinal,
            spokenIndex: spokenIdx ?? text.length,
            isActive: !isFinal,
          }
          const line = updated[existingIdx]
          setCurrentLine(isFinal ? null : line)
          return updated.slice(-MAX_LINES)
        }

        // Create a new line
        const line: TranscriptLine = {
          id: `tl-${++lineIdCounter}`,
          role,
          text,
          timestamp: Date.now(),
          isFinal,
          isActive: !isFinal,
          spokenIndex: spokenIdx ?? text.length,
        }
        setCurrentLine(isFinal ? null : line)
        return [...prev, line].slice(-MAX_LINES)
      })
    },
    [],
  )

  const resetTranscript = useCallback(() => {
    assistantBuffer.current = ""
    setTranscriptLines([])
    setCurrentLine(null)
  }, [])

  return {
    transcriptLines,
    currentLine,
    assistantBuffer,
    addTranscriptLine,
    resetTranscript,
  }
}
