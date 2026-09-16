"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { completeOnboarding } from "@/lib/actions/onboarding"
import { TOUR_OPEN_GROUP_EVENT } from "@/lib/dashboard-tour"
import { cn } from "@/lib/utils"

/*
 * The first-run tour: five short stops that point at the real shell instead
 * of describing it. A scrim covers the page with one window cut out around
 * the current stop (a sidebar row, the wallet chip, the learning hero) and a
 * card beside it says what that thing is for. Everything is measured live,
 * so the window follows the page as it scrolls, as the rail folds and as
 * cards finish rising. A stop whose anchor is not on screen (the rail on a
 * phone, the wallet chip below lg) falls back to the next anchor, and with
 * none the card simply stands on its own.
 *
 * It runs once, on the dashboard, for a student who has not been onboarded
 * (`User.hasOnboarded`), and again on request from `/dashboard?tour=1` (the
 * Help page links there). It never runs on the checkout or a course page:
 * its anchors live on the home.
 */

type Step = {
  id: string
  title: string
  body: string
  /** `data-tour` keys in order of preference; the first one visible is spotlit. */
  targets?: readonly string[]
  /** A folded sidebar group (NavGroup id) opened first so its row can be seen. */
  group?: string
}

function stepsFor(firstName: string): Step[] {
  return [
    {
      id: "welcome",
      title: firstName ? `Welcome, ${firstName}.` : "Welcome to the Academy.",
      body: "Here is how to get from this screen to your first lesson. It takes about thirty seconds.",
    },
    {
      id: "browse",
      title: "Find a program",
      body: "Programs lists everything the Academy teaches, school by school. Open one to read its curriculum, meet the instructor and compare packages.",
      targets: ["browse-nav", "browse-section"],
    },
    {
      id: "enrol",
      title: "Enrol from the program page",
      body: "Choose a package and pay from your WorldStreet wallet at checkout. If the wallet is short, top it up first; enrolment is confirmed the moment the payment is.",
      targets: ["wallet-chip", "wallet-nav"],
      group: "account",
    },
    {
      id: "continue",
      title: "Pick up where you left off",
      body: "Once you are enrolled, this card is home base: your progress, the next lesson, and one button that takes you straight back into it.",
      targets: ["hero"],
    },
    {
      id: "help",
      title: "Help is one click away",
      body: "Answers to the usual questions live under Help, with a line to support. You can replay this tour from there any time.",
      targets: ["help-nav"],
      group: "account",
    },
  ]
}

type Box = { top: number; left: number; width: number; height: number }
type Placement = "right" | "left" | "bottom" | "top"

/** Breathing room between the anchor and the cut-out. */
const PAD = 6
/** Distance from the cut-out to the card. */
const GAP = 14
/** Viewport margin the card never crosses. */
const MARGIN = 16
const CARD_W = 320
/** Below this width the card docks to the top or bottom edge instead of floating beside its anchor. */
const PHONE = 640
/** The shell settles (rail, greeting, hero skeleton) before the first stop appears. */
const START_DELAY = 700

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function isVisible(el: HTMLElement): boolean {
  if (typeof el.checkVisibility === "function" && !el.checkVisibility()) return false
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0
}

function findTarget(keys?: readonly string[]): HTMLElement | null {
  if (!keys) return null
  for (const key of keys) {
    const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${key}"]`)
    for (const el of nodes) if (isVisible(el)) return el
  }
  return null
}

function toBox(r: DOMRect): Box {
  return { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 }
}

function sameBox(a: Box | null, b: Box | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return (
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  )
}

/** Beside the anchor: to its right when there is room (rail rows), else under, over, or to its left. */
function place(box: Box, cardH: number, vw: number, vh: number): { placement: Placement; top: number; left: number } {
  const right = box.left + box.width
  const bottom = box.top + box.height
  const cx = box.left + box.width / 2
  const cy = box.top + box.height / 2
  const clampY = (t: number) => Math.min(Math.max(t, MARGIN), Math.max(MARGIN, vh - cardH - MARGIN))
  const clampX = (l: number) => Math.min(Math.max(l, MARGIN), Math.max(MARGIN, vw - CARD_W - MARGIN))
  if (vw - right - GAP - MARGIN >= CARD_W) return { placement: "right", left: right + GAP, top: clampY(cy - cardH / 2) }
  if (vh - bottom - GAP - MARGIN >= cardH) return { placement: "bottom", left: clampX(cx - CARD_W / 2), top: bottom + GAP }
  if (box.top - GAP - MARGIN >= cardH) return { placement: "top", left: clampX(cx - CARD_W / 2), top: box.top - GAP - cardH }
  if (box.left - GAP - MARGIN >= CARD_W) return { placement: "left", left: box.left - GAP - CARD_W, top: clampY(cy - cardH / 2) }
  // Nothing fits beside a panel that fills the viewport: sit over its foot rather than over the rail.
  return { placement: "bottom", left: clampX(cx - CARD_W / 2), top: clampY(bottom + GAP) }
}

export function DashboardTour({ autoStart, firstName }: { autoStart: boolean; firstName: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const replay = useSearchParams().get("tour") === "1"
  const steps = React.useMemo(() => stepsFor(firstName), [firstName])

  const [open, setOpen] = React.useState(false)
  // The first run is over once finished, even before the refreshed layout stops asking for it.
  const [done, setDone] = React.useState(false)
  const [index, setIndex] = React.useState(0)
  const [box, setBox] = React.useState<Box | null>(null)
  const [viewport, setViewport] = React.useState({ w: 0, h: 0 })
  const [cardH, setCardH] = React.useState(0)
  const cardRef = React.useRef<HTMLDivElement>(null)
  const primaryRef = React.useRef<HTMLButtonElement>(null)

  const step = steps[index]
  const last = index === steps.length - 1
  const shouldOpen = pathname === "/dashboard" && ((autoStart && !done) || replay)

  React.useEffect(() => {
    if (!shouldOpen) {
      setOpen(false)
      return
    }
    const id = window.setTimeout(() => {
      setIndex(0)
      setOpen(true)
    }, START_DELAY)
    return () => window.clearTimeout(id)
  }, [shouldOpen])

  const finish = React.useCallback(() => {
    setOpen(false)
    setDone(true)
    if (replay) router.replace("/dashboard", { scroll: false })
    if (autoStart) {
      // The layout mounts this off `hasOnboarded`; refresh so it stops.
      void completeOnboarding().then(() => router.refresh())
    }
  }, [autoStart, replay, router])

  const next = React.useCallback(() => {
    if (last) finish()
    else setIndex((i) => i + 1)
  }, [last, finish])

  const back = React.useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])

  // Viewport size drives placement; read on open and on every resize.
  React.useEffect(() => {
    if (!open) return
    const read = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    read()
    window.addEventListener("resize", read)
    return () => window.removeEventListener("resize", read)
  }, [open])

  // The anchor is measured every frame while the tour is open: the cut-out
  // then follows scrolling, the rail folding open and cards still rising,
  // and it finds an anchor that mounts late (the hero after its skeleton).
  React.useEffect(() => {
    if (!open) return
    let raf = 0
    const tick = () => {
      const el = findTarget(step.targets)
      const measured = el ? toBox(el.getBoundingClientRect()) : null
      setBox((prev) => (sameBox(prev, measured) ? prev : measured))
      // The card's own height places it above or beside the anchor.
      const h = cardRef.current?.offsetHeight ?? 0
      setCardH((prev) => (prev === h ? prev : h))
      raf = window.requestAnimationFrame(tick)
    }
    raf = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(raf)
  }, [open, step])

  // On each stop: open the folded group its row lives in, then bring the
  // anchor into view if it is off screen.
  React.useEffect(() => {
    if (!open) return
    if (step.group) window.dispatchEvent(new CustomEvent(TOUR_OPEN_GROUP_EVENT, { detail: step.group }))
    const id = window.setTimeout(
      () => {
        const el = findTarget(step.targets)
        if (!el) return
        const r = el.getBoundingClientRect()
        const behavior = reducedMotion() ? "auto" : "smooth"
        // A panel that fills much of the viewport (the hero) goes to the top,
        // under the sticky bar, so the card has room beneath it.
        if (r.height > window.innerHeight * 0.45) {
          if (Math.abs(r.top - 88) > 8) window.scrollBy({ top: r.top - 88, behavior })
          return
        }
        const inView = r.top >= 96 && r.bottom <= window.innerHeight - 96
        if (!inView) el.scrollIntoView({ block: "center", behavior })
      },
      step.group ? 80 : 0,
    )
    return () => window.clearTimeout(id)
  }, [open, step])

  React.useEffect(() => {
    if (open) primaryRef.current?.focus({ preventScroll: true })
  }, [open, index])

  React.useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault()
        finish()
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        next()
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        back()
      } else if (e.key === "Tab" && cardRef.current) {
        // The card owns focus while the scrim is up.
        const focusables = cardRef.current.querySelectorAll<HTMLElement>("button:not([disabled])")
        if (focusables.length === 0) return
        const first = focusables[0]
        const end = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          end.focus()
        } else if (!e.shiftKey && document.activeElement === end) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, finish, next, back])

  if (!open) return null

  const phone = viewport.w > 0 && viewport.w < PHONE
  const spot = box && viewport.w > 0 ? box : null

  // Where the card sits: beside its anchor, docked to an edge on a phone, or centred with no anchor.
  let cardStyle: React.CSSProperties
  let placement: Placement | null = null
  if (!spot) {
    cardStyle = { left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: `min(${CARD_W + 40}px, calc(100vw - ${MARGIN * 2}px))` }
  } else if (phone) {
    const upper = spot.top + spot.height / 2 < viewport.h * 0.55
    cardStyle = upper
      ? { left: MARGIN, right: MARGIN, bottom: `calc(${MARGIN}px + env(safe-area-inset-bottom, 0px))` }
      : { left: MARGIN, right: MARGIN, top: `calc(${MARGIN}px + env(safe-area-inset-top, 0px))` }
  } else {
    const p = place(spot, cardH || 200, viewport.w, viewport.h)
    placement = p.placement
    cardStyle = { left: p.left, top: p.top, width: CARD_W }
  }

  // The caret sits on the card edge that faces the anchor, level with its centre.
  let caretStyle: React.CSSProperties | null = null
  let caretEdges = ""
  if (spot && placement && typeof cardStyle.top === "number" && typeof cardStyle.left === "number") {
    const cx = spot.left + spot.width / 2
    const cy = spot.top + spot.height / 2
    const alongY = Math.min(Math.max(cy - cardStyle.top, 20), Math.max(20, cardH - 20))
    const alongX = Math.min(Math.max(cx - cardStyle.left, 20), CARD_W - 20)
    switch (placement) {
      case "right":
        caretStyle = { left: -6, top: alongY - 6 }
        caretEdges = "border-b border-l"
        break
      case "left":
        caretStyle = { right: -6, top: alongY - 6 }
        caretEdges = "border-r border-t"
        break
      case "bottom":
        caretStyle = { top: -6, left: alongX - 6 }
        caretEdges = "border-l border-t"
        break
      case "top":
        caretStyle = { bottom: -6, left: alongX - 6 }
        caretEdges = "border-b border-r"
        break
    }
  }

  return (
    <div className="fixed inset-0 z-[70]" role="presentation">
      {/* The scrim, with one window cut out of it — a single element whose
          shadow is the scrim, so the window glides between stops. */}
      {spot ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-[14px] ring-1 ring-primary/50 transition-[top,left,width,height] duration-[var(--ws-motion-slow)] ease-(--ws-ease) motion-reduce:transition-none"
          style={{
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
            boxShadow: "0 0 0 200vmax var(--ws-overlay-scrim)",
          }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-[var(--ws-overlay-scrim)]" />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className="absolute rounded-[20px] border border-border bg-card p-5 text-card-foreground shadow-[0_16px_48px_rgba(0,0,0,0.35)] transition-[top,left] duration-[var(--ws-motion-slow)] ease-(--ws-ease) motion-reduce:transition-none dark:border-transparent"
        style={cardStyle}
      >
        {caretStyle && (
          <span
            aria-hidden
            className={cn("absolute size-3 rotate-45 border-border bg-card dark:border-transparent", caretEdges)}
            style={caretStyle}
          />
        )}

        {/* Keyed by stop so the words fade in fresh while the card glides. */}
        <div key={step.id} className="ws-animate-fade">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {index === 0 ? "Quick tour" : `Step ${index} of ${steps.length - 1}`}
          </p>
          <h2 id="tour-title" className="mt-1.5 font-display text-[17px] font-semibold leading-tight tracking-[-0.01em]">
            {step.title}
          </h2>
          <p id="tour-body" className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
            {step.body}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          {last ? (
            <span />
          ) : (
            <button
              type="button"
              onClick={finish}
              className="rounded-full px-2 py-1 text-[13px] font-medium text-muted-foreground outline-none transition-colors duration-[var(--ws-motion-fast)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {index === 0 ? "Skip" : "Skip tour"}
            </button>
          )}
          <div className="flex items-center gap-1.5">
            {index > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                onClick={back}
                aria-label="Back"
                className="rounded-full text-muted-foreground hover:text-foreground"
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
              </Button>
            )}
            <Button ref={primaryRef} type="button" onClick={next} className="h-9 rounded-full px-4 text-[13.5px] font-semibold">
              {index === 0 ? "Show me around" : last ? "Done" : "Next"}
              {index > 0 && !last && <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" aria-hidden />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
