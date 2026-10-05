"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { EraserIcon, EyeOffIcon, PenLineIcon, PresentationIcon, Trash2Icon, XIcon } from "lucide-react"
import { rtkClient } from "@/lib/rtk-client"
import { cn } from "@/lib/utils"

/*
 * Live-class whiteboard (owner, 2026-10-03: tutors explain with drawings).
 *
 * The host draws; everyone else sees the board read-only. Strokes travel over
 * RealtimeKit's room broadcast (`participants.broadcastMessage` /
 * `broadcastedMessage`) through the lib/rtk-client singleton — no server, no
 * storage. Protocol (every payload is flat: the SDK only carries
 * boolean | number | string values):
 *
 *   wb:open          { open, by }                 host shows/hides the board for everyone
 *   wb:stroke        { id, c, e, w, from, p, done, by }
 *                    p = "x,y,x,y…" integers on a 1600×900 board, starting at
 *                    point index `from`. Partials (done:false) append while
 *                    drawing; the final (done:true, from:0) carries the whole
 *                    stroke and replaces it, so a lost partial heals itself.
 *   wb:clear         { by }
 *   wb:sync-request  {}                           a (re)joining participant asks for the board
 *   wb:snapshot      { sid, part, parts, open, d, by }
 *                    the host's answer (also sent when anyone joins): the
 *                    newest strokes that fit ~48 KB of JSON, in ≤4 KB parts.
 *
 * Limits: the SDK allows 5 broadcastMessage calls per second per client, so
 * every outgoing message goes through one queue spaced 250 ms apart; partial
 * updates are cut every 100 ms and coalesce in that queue (so they actually
 * leave about 4× a second). A stroke splits after 500 points, keeping any one
 * message to a few KB. The board keeps the last 400 strokes.
 *
 * Trust: the broadcast event doesn't name its sender, so participants accept
 * only payloads that carry the host's user id (`by`) and the host ignores
 * every incoming board message except sync requests. That stops accidents, not
 * a participant forging messages from dev tools.
 *
 * The board is a client-side canvas: RealtimeKit's cloud recording captures
 * the call's audio/video, not this panel.
 */

const BOARD_W = 1600
const BOARD_H = 900
const PEN_WIDTH = 4
const ERASER_WIDTH = 36
const MIN_POINT_DIST = 3
const MAX_POINTS_PER_STROKE = 500
const MAX_STROKES = 400
const PARTIAL_EVERY_MS = 100
const SEND_GAP_MS = 250
const SNAPSHOT_MAX_CHARS = 48_000
const CHUNK_CHARS = 4_000
const MAX_SNAPSHOT_PARTS = 20
const SNAPSHOT_DEBOUNCE_MS = 1_200

const COLORS = {
  ink: { label: "Ink", cssVar: "--ws-text-primary" },
  blue: { label: "Blue", cssVar: "--ws-accent-forex" },
  red: { label: "Red", cssVar: "--ws-status-danger" },
} as const
type ColorKey = keyof typeof COLORS
const isColorKey = (v: unknown): v is ColorKey => typeof v === "string" && v in COLORS

type Stroke = {
  id: string
  color: ColorKey
  erase: boolean
  width: number
  /** Flat [x0, y0, x1, y1, …] in board units. */
  points: number[]
  /** Host only: points already broadcast in partials. */
  sent: number
  done: boolean
}

type Payload = Record<string, string | number | boolean>
type Outgoing = { key?: string; retry?: boolean; build: () => { type: string; payload: Payload } | null }

/* ── Module state: survives the room view unmounting (minimise, re-render),
      like the rtk-client singleton itself. Reset when the meeting changes. ── */

const board = { meetingId: "", strokes: [] as Stroke[], open: false }

function boardFor(meetingId: string) {
  if (board.meetingId !== meetingId) {
    board.meetingId = meetingId
    board.strokes = []
    board.open = false
    queue.length = 0
  }
  return board
}

const queue: Outgoing[] = []
let pumpTimer: ReturnType<typeof setTimeout> | null = null
let nextSendAt = 0

function enqueue(item: Outgoing) {
  const i = item.key ? queue.findIndex((q) => q.key === item.key) : -1
  if (i >= 0) queue[i] = item
  else queue.push(item)
  pump()
}

function dropQueued(match: (key: string) => boolean) {
  for (let i = queue.length - 1; i >= 0; i--) {
    const key = queue[i].key
    if (key && match(key)) queue.splice(i, 1)
  }
}

function pump() {
  if (pumpTimer || queue.length === 0) return
  pumpTimer = setTimeout(async () => {
    pumpTimer = null
    const item = queue.shift()
    const msg = item?.build() ?? null
    const client = rtkClient.client
    if (item && msg && client && rtkClient.isInRoom) {
      nextSendAt = Date.now() + SEND_GAP_MS
      try {
        await client.participants.broadcastMessage(msg.type, msg.payload)
      } catch (err) {
        // Most likely the SDK's rate limit: back off, and resend anything but a partial.
        console.warn("[Whiteboard] broadcast failed:", err)
        nextSendAt = Date.now() + 1_000
        if (item.retry) queue.unshift({ ...item, retry: false })
      }
    }
    pump()
  }, Math.max(0, nextSendAt - Date.now()))
}

const newId = () => Math.random().toString(36).slice(2, 10)

function decodePoints(p: unknown): number[] | null {
  if (typeof p !== "string") return null
  if (p === "") return []
  const nums = p.split(",").map(Number)
  if (nums.length % 2 !== 0 || nums.length > MAX_POINTS_PER_STROKE * 2 + 2) return null
  for (const n of nums) if (!Number.isFinite(n)) return null
  return nums
}

function finalPayload(s: Stroke, by: string): Payload {
  return { id: s.id, c: s.color, e: s.erase, w: s.width, from: 0, p: s.points.join(","), done: true, by }
}

export function Whiteboard({
  meetingId,
  hostUserId,
  isHost,
}: {
  meetingId: string
  /** The meeting host's user id — the only sender participants accept. */
  hostUserId: string
  isHost: boolean
}) {
  // Mount with this meeting's board (the room remounts the panel per meeting via `key`).
  const [open, setOpenState] = useState(() => boardFor(meetingId).open)
  const [locallyHidden, setLocallyHidden] = useState(false)
  const [tool, setTool] = useState<"pen" | "eraser">("pen")
  const [color, setColor] = useState<ColorKey>("ink")

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<number | null>(null)
  const drawingRef = useRef<Stroke | null>(null)
  const lastPartialRef = useRef(0)
  const snapshotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const assemblyRef = useRef<{ sid: string; chunks: (string | null)[]; got: number } | null>(null)

  const setOpen = useCallback((value: boolean) => {
    board.open = value
    setOpenState(value)
  }, [])

  /* ── Rendering: one-shot rAF redraws, never a running loop ── */

  const render = useCallback(() => {
    frameRef.current = null
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    const styles = getComputedStyle(canvas)
    const scale = canvas.width / BOARD_W
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    for (const s of board.strokes) {
      if (s.points.length < 2) continue
      ctx.globalCompositeOperation = s.erase ? "destination-out" : "source-over"
      const colour = styles.getPropertyValue(COLORS[s.color].cssVar).trim() || "#888"
      ctx.strokeStyle = colour
      ctx.fillStyle = colour
      ctx.lineWidth = s.width * scale
      if (s.points.length === 2) {
        ctx.beginPath()
        ctx.arc(s.points[0] * scale, s.points[1] * scale, (s.width * scale) / 2, 0, Math.PI * 2)
        ctx.fill()
        continue
      }
      ctx.beginPath()
      ctx.moveTo(s.points[0] * scale, s.points[1] * scale)
      for (let i = 2; i < s.points.length; i += 2) ctx.lineTo(s.points[i] * scale, s.points[i + 1] * scale)
      ctx.stroke()
    }
    ctx.globalCompositeOperation = "source-over"
  }, [])

  const scheduleRender = useCallback(() => {
    if (frameRef.current === null) frameRef.current = requestAnimationFrame(render)
  }, [render])

  // Size the canvas to its box (device pixels) and redraw on resize.
  const visible = open && !locallyHidden
  useEffect(() => {
    const canvas = canvasRef.current
    if (!visible || !canvas) return
    const observer = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr))
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr))
      scheduleRender()
    })
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [visible, scheduleRender])

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current)
    },
    []
  )

  /* ── Host: snapshots for late joiners ── */

  const sendSnapshot = useCallback(() => {
    dropQueued((key) => key.startsWith("s:"))
    if (!board.open && board.strokes.length === 0) return
    const encoded: string[] = []
    let size = 2
    for (let i = board.strokes.length - 1; i >= 0; i--) {
      const s = board.strokes[i]
      if (!s.done) continue // still being drawn — its final message follows
      const item = JSON.stringify([s.id, s.color, s.erase ? 1 : 0, s.width, s.points.join(",")])
      if (size + item.length + 1 > SNAPSHOT_MAX_CHARS) break
      encoded.unshift(item)
      size += item.length + 1
    }
    const json = `[${encoded.join(",")}]`
    const parts: string[] = []
    for (let i = 0; i < json.length; i += CHUNK_CHARS) parts.push(json.slice(i, i + CHUNK_CHARS))
    const sid = newId()
    parts.forEach((d, part) =>
      enqueue({
        key: `s:${sid}:${part}`,
        retry: true,
        build: () => ({
          type: "wb:snapshot",
          payload: { sid, part, parts: parts.length, open: board.open, d, by: hostUserId },
        }),
      })
    )
  }, [hostUserId])

  const scheduleSnapshot = useCallback(() => {
    if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current)
    snapshotTimerRef.current = setTimeout(sendSnapshot, SNAPSHOT_DEBOUNCE_MS)
  }, [sendSnapshot])

  /* ── Incoming messages ── */

  useEffect(() => {
    const onMessage = (...args: unknown[]) => {
      const event = args[0] as { type?: unknown; payload?: Record<string, unknown> } | undefined
      const type = typeof event?.type === "string" ? event.type : ""
      const p = event?.payload
      if (!type.startsWith("wb:") || !p) return

      if (isHost) {
        // The host is the board's only author: it answers sync requests and ignores the rest (its own echoes included).
        if (type === "wb:sync-request") scheduleSnapshot()
        return
      }
      if (p.by !== hostUserId) return

      if (type === "wb:open") {
        if (typeof p.open === "boolean") setOpen(p.open)
        if (p.open) setLocallyHidden(false)
        return
      }
      if (type === "wb:clear") {
        board.strokes = []
        scheduleRender()
        return
      }
      if (type === "wb:stroke") {
        const points = decodePoints(p.p)
        if (typeof p.id !== "string" || !isColorKey(p.c) || typeof p.w !== "number" || !points) return
        const from = typeof p.from === "number" ? p.from : 0
        const existing = board.strokes.find((s) => s.id === p.id)
        if (p.done === true) {
          const stroke: Stroke = { id: p.id, color: p.c, erase: p.e === true, width: p.w, points, sent: 0, done: true }
          if (existing) Object.assign(existing, stroke)
          else board.strokes.push(stroke)
        } else if (!existing && from === 0) {
          board.strokes.push({ id: p.id, color: p.c, erase: p.e === true, width: p.w, points, sent: 0, done: false })
        } else if (existing && !existing.done && from === existing.points.length / 2) {
          existing.points.push(...points)
        } // else: a gap — the final message repairs it
        if (board.strokes.length > MAX_STROKES) board.strokes.splice(0, board.strokes.length - MAX_STROKES)
        scheduleRender()
        return
      }
      if (type === "wb:snapshot") {
        const { sid, part, parts, d } = p
        if (typeof sid !== "string" || typeof part !== "number" || typeof parts !== "number" || typeof d !== "string") return
        if (parts < 1 || parts > MAX_SNAPSHOT_PARTS || part < 0 || part >= parts) return
        let asm = assemblyRef.current
        if (!asm || asm.sid !== sid) {
          asm = { sid, chunks: Array<string | null>(parts).fill(null), got: 0 }
          assemblyRef.current = asm
        }
        if (asm.chunks[part] === null) {
          asm.chunks[part] = d
          asm.got++
        }
        if (asm.got < asm.chunks.length) return
        assemblyRef.current = null
        try {
          const rows: unknown = JSON.parse(asm.chunks.join(""))
          if (!Array.isArray(rows)) return
          const strokes: Stroke[] = []
          for (const row of rows) {
            if (!Array.isArray(row) || row.length !== 5) continue
            const [id, c, e, w, encoded] = row as unknown[]
            const pts = decodePoints(encoded)
            if (typeof id !== "string" || !isColorKey(c) || typeof w !== "number" || !pts) continue
            strokes.push({ id, color: c, erase: e === 1, width: w, points: pts, sent: 0, done: true })
          }
          // Keep a stroke still arriving in partials; the snapshot only holds finished ones.
          const inFlight = board.strokes.filter((s) => !s.done && !strokes.some((x) => x.id === s.id))
          board.strokes = [...strokes, ...inFlight].slice(-MAX_STROKES)
          if (typeof p.open === "boolean") setOpen(p.open)
          scheduleRender()
        } catch {
          // A garbled snapshot — the next join or request sends another.
        }
      }
    }

    rtkClient.on("broadcastedMessage", "broadcast", onMessage)
    // A new face in the room gets the board from the host (debounced for bursts of joins).
    const onJoined = () => {
      if (isHost) scheduleSnapshot()
    }
    rtkClient.on("participantJoined", "participants", onJoined)
    // A (re)mounting participant — late join, or back from minimised — asks for it.
    if (!isHost) enqueue({ key: "sync-request", retry: true, build: () => ({ type: "wb:sync-request", payload: { at: Date.now() } }) })

    return () => {
      rtkClient.off("broadcastedMessage", "broadcast", onMessage)
      rtkClient.off("participantJoined", "participants", onJoined)
    }
  }, [isHost, hostUserId, scheduleRender, scheduleSnapshot, setOpen])

  /* ── Host drawing ── */

  function boardPoint(e: React.PointerEvent<HTMLCanvasElement>): [number, number] {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.round(((e.clientX - rect.left) / rect.width) * BOARD_W)
    const y = Math.round(((e.clientY - rect.top) / rect.height) * BOARD_H)
    return [Math.min(BOARD_W, Math.max(0, x)), Math.min(BOARD_H, Math.max(0, y))]
  }

  function queuePartial(s: Stroke) {
    enqueue({
      key: `p:${s.id}`,
      build: () => {
        const total = s.points.length / 2
        if (s.done || s.sent >= total) return null
        const from = s.sent
        s.sent = total
        return {
          type: "wb:stroke",
          payload: { id: s.id, c: s.color, e: s.erase, w: s.width, from, p: s.points.slice(from * 2).join(","), done: false, by: hostUserId },
        }
      },
    })
  }

  function finishStroke(s: Stroke) {
    s.done = true
    dropQueued((key) => key === `p:${s.id}`)
    enqueue({
      key: `f:${s.id}`,
      retry: true,
      build: () => {
        s.sent = s.points.length / 2
        return { type: "wb:stroke", payload: finalPayload(s, hostUserId) }
      },
    })
  }

  function startStroke(x: number, y: number): Stroke {
    const s: Stroke = {
      id: newId(),
      color,
      erase: tool === "eraser",
      width: tool === "eraser" ? ERASER_WIDTH : PEN_WIDTH,
      points: [x, y],
      sent: 0,
      done: false,
    }
    board.strokes.push(s)
    if (board.strokes.length > MAX_STROKES) board.strokes.splice(0, board.strokes.length - MAX_STROKES)
    return s
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isHost || (e.pointerType === "mouse" && e.button !== 0)) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const [x, y] = boardPoint(e)
    drawingRef.current = startStroke(x, y)
    lastPartialRef.current = Date.now()
    scheduleRender()
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    let s = drawingRef.current
    if (!isHost || !s) return
    const [x, y] = boardPoint(e)
    const lx = s.points[s.points.length - 2]
    const ly = s.points[s.points.length - 1]
    if (Math.hypot(x - lx, y - ly) < MIN_POINT_DIST) return
    s.points.push(x, y)
    if (s.points.length / 2 >= MAX_POINTS_PER_STROKE) {
      // Split long strokes so no message grows past a few KB.
      finishStroke(s)
      s = startStroke(x, y)
      drawingRef.current = s
    }
    if (Date.now() - lastPartialRef.current >= PARTIAL_EVERY_MS) {
      lastPartialRef.current = Date.now()
      queuePartial(s)
    }
    scheduleRender()
  }

  function onPointerUp() {
    const s = drawingRef.current
    if (!s) return
    drawingRef.current = null
    finishStroke(s)
    scheduleRender()
  }

  function toggleBoard() {
    const next = !board.open
    setOpen(next)
    enqueue({ key: "open", retry: true, build: () => ({ type: "wb:open", payload: { open: board.open, by: hostUserId } }) })
  }

  function clearBoard() {
    board.strokes = []
    drawingRef.current = null
    dropQueued((key) => key.startsWith("p:") || key.startsWith("f:") || key.startsWith("s:"))
    enqueue({ key: "clear", retry: true, build: () => ({ type: "wb:clear", payload: { by: hostUserId } }) })
    scheduleRender()
  }

  /* ── UI ── */

  const pill =
    "flex items-center gap-1.5 rounded-full border border-ws-hairline bg-ws-surface px-3 py-1.5 text-xs font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary"
  const toolButton = (active: boolean) =>
    cn(
      "flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-[var(--ws-motion-fast)]",
      active ? "bg-ws-raised text-ws-primary" : "text-ws-muted hover:bg-ws-raised hover:text-ws-primary"
    )

  if (!visible) {
    if (isHost) {
      return (
        <button type="button" onClick={toggleBoard} className={cn(pill, "absolute right-2 top-2 z-30")}>
          <PresentationIcon size={13} aria-hidden />
          Whiteboard
        </button>
      )
    }
    return open ? (
      <button type="button" onClick={() => setLocallyHidden(false)} className={cn(pill, "absolute right-2 top-2 z-30")}>
        <PresentationIcon size={13} aria-hidden />
        Show whiteboard
      </button>
    ) : null
  }

  return (
    <div
      className="absolute inset-0 z-20 flex flex-col gap-2 rounded-lg bg-ws-page p-1"
      // The room's swipe-to-page handler must not see drawing gestures.
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 px-1 text-xs font-medium text-ws-muted">
          <PresentationIcon size={13} aria-hidden />
          {isHost ? "Whiteboard · everyone sees this" : "Whiteboard"}
        </span>
        {isHost ? (
          <div className="flex items-center gap-1 rounded-full border border-ws-hairline bg-ws-surface p-1" role="toolbar" aria-label="Whiteboard tools">
            <button type="button" className={toolButton(tool === "pen")} aria-pressed={tool === "pen"} aria-label="Pen" title="Pen" onClick={() => setTool("pen")}>
              <PenLineIcon size={14} />
            </button>
            {(Object.keys(COLORS) as ColorKey[]).map((key) => (
              <button
                key={key}
                type="button"
                className={toolButton(tool === "pen" && color === key)}
                aria-pressed={tool === "pen" && color === key}
                aria-label={`${COLORS[key].label} pen`}
                title={COLORS[key].label}
                onClick={() => {
                  setColor(key)
                  setTool("pen")
                }}
              >
                <span className="h-3.5 w-3.5 rounded-full ring-1 ring-ws-hairline" style={{ background: `var(${COLORS[key].cssVar})` }} />
              </button>
            ))}
            <button type="button" className={toolButton(tool === "eraser")} aria-pressed={tool === "eraser"} aria-label="Eraser" title="Eraser" onClick={() => setTool("eraser")}>
              <EraserIcon size={14} />
            </button>
            <button type="button" className={toolButton(false)} aria-label="Clear the board" title="Clear" onClick={clearBoard}>
              <Trash2Icon size={14} />
            </button>
            <button type="button" className={toolButton(false)} aria-label="Close the whiteboard for everyone" title="Close" onClick={toggleBoard}>
              <XIcon size={14} />
            </button>
          </div>
        ) : (
          <button type="button" className={pill} onClick={() => setLocallyHidden(true)}>
            <EyeOffIcon size={13} aria-hidden />
            Hide
          </button>
        )}
      </div>
      {/* A strict 16:9 board, letterboxed: every client maps strokes onto the same shape. */}
      <div className="flex min-h-0 flex-1 items-center justify-center [container-type:size]">
        <div
          className="relative aspect-video overflow-hidden rounded-md border border-ws-hairline bg-ws-surface"
          style={{ width: "min(100cqw, calc(100cqh * 16 / 9))" }}
        >
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={isHost ? "Whiteboard — draw to explain" : "The instructor's whiteboard"}
            className={cn("absolute inset-0 h-full w-full touch-none", isHost ? (tool === "eraser" ? "cursor-cell" : "cursor-crosshair") : "cursor-default")}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        </div>
      </div>
    </div>
  )
}
