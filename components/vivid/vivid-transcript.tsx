"use client"

/**
 * Vivid Transcript — Karaoke-style voice lyrics with word-by-word highlighting.
 * As the AI speaks, the currently-spoken word sweeps bold across the text,
 * similar to Apple Music or Spotify lyrics.
 *
 * Supports inline markdown: **bold**, *italic*, __underline__, ~~strikethrough~~,
 * bullet lists (- / * / +), numbered lists (1.), and headers (# … ######).
 */

import { useRef, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "motion/react"
import { useVivid } from "@/lib/vivid/provider"
import type { TranscriptLine } from "@/lib/vivid/types"

// ── Markdown → styled tokens ─────────────────────────────────────────

type InlineStyle = "bold" | "italic" | "underline" | "strikethrough" | "code"
type BlockPrefix = "bullet" | "numbered" | "header"

interface StyledToken {
  word: string
  charStart: number
  charEnd: number
  isSpace: boolean
  styles: InlineStyle[]
  block?: BlockPrefix
  headerLevel?: number
}

/**
 * Parse text that may contain markdown into an array of StyledTokens.
 * Each token preserves its character offset (for karaoke) and any formatting.
 *
 * Splits on lines first to handle block-level markers (lists, headers),
 * then applies inline styles per-word.
 */
function parseMarkdownTokens(text: string): StyledToken[] {
  const tokens: StyledToken[] = []
  let globalOffset = 0

  // Process text line-by-line to detect block prefixes
  const lines = text.split("\n")

  lines.forEach((line, lineIdx) => {
    let remaining = line
    let lineOffset = globalOffset
    let block: BlockPrefix | undefined
    let headerLevel: number | undefined

    // Detect block-level prefix
    const headerMatch = remaining.match(/^(#{1,6})\s+/)
    const bulletMatch = remaining.match(/^[\s]*[-*+]\s+/)
    const numberedMatch = remaining.match(/^[\s]*\d+\.\s+/)

    if (headerMatch) {
      headerLevel = headerMatch[1].length
      block = "header"
      const prefixLen = headerMatch[0].length
      remaining = remaining.slice(prefixLen)
      lineOffset += prefixLen
    } else if (bulletMatch) {
      block = "bullet"
      const prefixLen = bulletMatch[0].length
      remaining = remaining.slice(prefixLen)
      lineOffset += prefixLen
    } else if (numberedMatch) {
      block = "numbered"
      const prefixLen = numberedMatch[0].length
      remaining = remaining.slice(prefixLen)
      lineOffset += prefixLen
    }

    // Tokenize the remaining text into words and spaces
    let i = 0
    while (i < remaining.length) {
      if (/\s/.test(remaining[i])) {
        const start = i
        while (i < remaining.length && /\s/.test(remaining[i])) i++
        tokens.push({
          word: remaining.slice(start, i),
          charStart: lineOffset + start,
          charEnd: lineOffset + i,
          isSpace: true,
          styles: [],
          block: start === 0 ? block : undefined,
          headerLevel: start === 0 ? headerLevel : undefined,
        })
      } else {
        const start = i
        while (i < remaining.length && !/\s/.test(remaining[i])) i++
        const raw = remaining.slice(start, i)

        // Detect inline markdown wrappers and strip them from display
        const styles: InlineStyle[] = []
        let display = raw

        // Bold: **text** or __text__ (check triple first for bold-italic)
        if (/^\*{3}.*\*{3}$/.test(display)) {
          styles.push("bold", "italic")
          display = display.slice(3, -3)
        } else if (/^\*{2}.*\*{2}$/.test(display)) {
          styles.push("bold")
          display = display.slice(2, -2)
        } else if (/^\*[^*]+\*$/.test(display)) {
          styles.push("italic")
          display = display.slice(1, -1)
        }

        // Underline: __text__  (only if not already consumed as bold)
        if (!styles.includes("bold") && /^__.*__$/.test(display)) {
          styles.push("underline")
          display = display.slice(2, -2)
        }

        // Strikethrough: ~~text~~
        if (/^~~.*~~$/.test(display)) {
          styles.push("strikethrough")
          display = display.slice(2, -2)
        }

        // Inline code: `text`
        if (/^`[^`]+`$/.test(display)) {
          styles.push("code")
          display = display.slice(1, -1)
        }

        // Clean up stray markdown chars (leading/trailing * or _)
        display = display.replace(/^\*+|\*+$/g, "").replace(/^_+|_+$/g, "") || display

        tokens.push({
          word: display,
          charStart: lineOffset + start,
          charEnd: lineOffset + i,
          isSpace: false,
          styles,
          block: start === 0 ? block : undefined,
          headerLevel: start === 0 ? headerLevel : undefined,
        })
      }
    }

    // Account for the newline character between lines (except the last)
    globalOffset += line.length + (lineIdx < lines.length - 1 ? 1 : 0)

    // Add a line break token between lines
    if (lineIdx < lines.length - 1) {
      tokens.push({
        word: "\n",
        charStart: globalOffset - 1,
        charEnd: globalOffset,
        isSpace: true,
        styles: [],
      })
    }
  })

  return tokens
}

/** CSS classes for inline styles */
function inlineStyleClasses(styles: InlineStyle[]): string {
  const cls: string[] = []
  if (styles.includes("bold")) cls.push("font-bold")
  if (styles.includes("italic")) cls.push("italic")
  if (styles.includes("underline")) cls.push("underline underline-offset-2")
  if (styles.includes("strikethrough")) cls.push("line-through")
  if (styles.includes("code")) cls.push("font-mono text-[0.9em] bg-muted/30 px-1 rounded")
  return cls.join(" ")
}

/** Header size classes */
function headerClasses(level?: number): string {
  switch (level) {
    case 1: return "text-2xl font-bold"
    case 2: return "text-xl font-bold"
    case 3: return "text-lg font-semibold"
    default: return "font-semibold"
  }
}

// ── Components ────────────────────────────────────────────────────────

export function TranscriptLyrics() {
  const vivid = useVivid()
  const scrollRef = useRef<HTMLDivElement>(null)
  const { transcriptLines } = vivid

  const assistantLines = transcriptLines.filter((l) => l.role === "assistant")

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      })
    }
  }, [assistantLines])

  if (assistantLines.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          className="text-lg text-muted-foreground font-light"
        >
          Start speaking…
        </motion.p>
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      className="flex-1 w-full max-w-2xl mx-auto overflow-y-scroll overflow-x-hidden px-8 py-6
                 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden! mask-t-from-50% mask-b-from-95%"
      style={{ scrollbarWidth: "none" }}
    >
      <div className="flex flex-col gap-2 justify-end min-h-full">
        <AnimatePresence initial={false}>
          {assistantLines.map((line, i) => (
            <LyricLine
              key={line.id}
              line={line}
              isLatest={i === assistantLines.length - 1}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

function LyricLine({ line, isLatest }: { line: TranscriptLine; isLatest: boolean }) {
  const tokens = useMemo(() => parseMarkdownTokens(line.text), [line.text])
  const isStreaming = isLatest && !line.isFinal

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
      animate={{
        opacity: isLatest ? 1 : line.isFinal ? 0.3 : 1,
        y: 0,
        filter: "blur(0px)",
        scale: isLatest && !line.isFinal ? 1.02 : 1,
      }}
      exit={{ opacity: 0, y: -10 }}
      transition={{
        layout: { type: "spring", stiffness: 200, damping: 25 },
        opacity: { duration: 0.4 },
        filter: { duration: 0.3 },
      }}
      className="flex justify-start overflow-hidden"
    >
      <div className="max-w-full px-1 overflow-hidden">
        <div className="text-lg md:text-xl leading-relaxed tracking-tight text-left text-foreground/90">
          {tokens.map((token, ti) => {
            // Line breaks
            if (token.word === "\n") return <br key={ti} />

            // Spaces
            if (token.isSpace) return <span key={ti}>{token.word}</span>

            // Block prefix decorations
            const prefix = token.block === "bullet"
              ? <span className="mr-1.5 text-muted-foreground select-none">•</span>
              : token.block === "numbered"
                ? null // number already stripped; could reconstruct but skip for voice
                : null

            // Header sizing
            const hdrCls = token.block === "header" ? headerClasses(token.headerLevel) : ""

            // Determine word state based on spokenIndex (character position)
            const isSpoken = token.charEnd <= line.spokenIndex
            const isCurrent = !isSpoken && token.charStart < line.spokenIndex
            const isUpcoming = token.charStart >= line.spokenIndex

            const styleCls = inlineStyleClasses(token.styles)

            if (line.isFinal) {
              return (
                <span key={ti} className={`inline font-medium ${styleCls} ${hdrCls}`}>
                  {prefix}{token.word}
                </span>
              )
            }

            if (isStreaming) {
              return (
                <motion.span
                  key={`${ti}-${token.word}`}
                  initial={{ opacity: 0.3, fontWeight: token.styles.includes("bold") ? 700 : 400 }}
                  animate={{
                    opacity: isSpoken || isCurrent ? 1 : 0.4,
                    fontWeight: isSpoken || isCurrent ? 700 : (token.styles.includes("bold") ? 700 : 400),
                  }}
                  transition={{
                    duration: isCurrent ? 0.15 : 0.25,
                    ease: "easeOut",
                  }}
                  className={`inline ${styleCls} ${hdrCls}`}
                  style={{
                    color: isSpoken || isCurrent
                      ? "var(--foreground)"
                      : isUpcoming
                        ? "color-mix(in srgb, var(--foreground) 35%, transparent)"
                        : undefined,
                  }}
                >
                  {prefix}{token.word}
                </motion.span>
              )
            }

            // Non-streaming, non-final fallback
            return (
              <motion.span
                key={`${ti}-${token.word}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: ti * 0.03, ease: "easeOut" }}
                className={`inline font-medium ${styleCls} ${hdrCls}`}
              >
                {prefix}{token.word}
              </motion.span>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}
