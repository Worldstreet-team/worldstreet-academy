"use client"

import * as React from "react"
import Image from "next/image"
import { SCHOOLS, type SchoolSlug } from "@/lib/schools"
import { SCHOOL_COVERS } from "@/lib/school-art"
import { cn } from "@/lib/utils"

export type HeroSlide = {
  src: string
  /** The school this cover belongs to; null for the student portrait. */
  school: SchoolSlug | null
  /** Accessible name for the slide's indicator. */
  label: string
}

/**
 * The hero's slides: the student portrait first (the owner's "girl holding
 * books"), then every school cover in school order. A school without a cover
 * file simply has no slide — picking it holds the portrait.
 */
export const HERO_SLIDES: readonly HeroSlide[] = [
  { src: "/brand/hero-student.png", school: null, label: "A WorldStreet student" },
  ...SCHOOLS.flatMap((s): HeroSlide[] => {
    const src = SCHOOL_COVERS[s.slug]
    return src ? [{ src, school: s.slug, label: s.name }] : []
  }),
]

export function slideOf(school: SchoolSlug | null): number {
  if (!school) return 0
  const i = HERO_SLIDES.findIndex((s) => s.school === school)
  return i === -1 ? 0 : i
}

/** Dwell per slide — the indicator's fill time. */
export const SLIDE_MS = 6000
/**
 * The curtain between two slides. Its soft edge crosses the open (right)
 * half of the stage in about the first 0.8s — in step with the copy's relay
 * on a chip — and the rest is a long, soft landing.
 */
const WIPE_MS = 1900
/** In-out with a long tail: the curtain gathers, crosses, and lands softly. */
const EASE_CURTAIN = "cubic-bezier(0.45, 0, 0.2, 1)"
/** Longest a transition waits for its picture before it goes anyway. */
const LOAD_WAIT_MS = 1500

/**
 * The curtain's geometry. Each slide is a CURTAIN (the masked, moving layer)
 * holding a FRAME (the stage-sized picture, counter-moved so the picture
 * itself stands still while the curtain slides over it). The curtain is
 * (1 + 2F) stage widths wide, opaque in the middle and feathered over F
 * stage widths at both ends; at rest it overhangs the stage by F on each
 * side, so both feathers sit off stage. Entering, it starts wholly off one
 * side and slides home, and its leading feather crosses the stage as a soft,
 * travelling crossfade — never a hard edge. Transform only, on the
 * compositor (WAAPI): the mask never changes, so nothing repaints.
 */
const F = 0.45
/** Curtain travel, in % of its own width: (1 + F) stage widths. */
const CURTAIN_TRAVEL = ((1 + F) / (1 + 2 * F)) * 100
/** Frame travel, in % of its own (stage) width. */
const FRAME_TRAVEL = (1 + F) * 100
const FEATHER = `${((F / (1 + 2 * F)) * 100).toFixed(3)}%`
const FRAME_WIDTH = `${((1 / (1 + 2 * F)) * 100).toFixed(3)}%`
const CURTAIN_MASK = `linear-gradient(to right, transparent 0%, black ${FEATHER}, black calc(100% - ${FEATHER}), transparent 100%)`

/**
 * One slide's time on stage, as a single transform on its picture: a scale
 * settle as the curtain brings it in (1.1 → 1, expo-out, the first quarter),
 * then the slow push-in (→ 1.06, linear) for the rest of its dwell. The slide
 * the server painted has no curtain, so it starts at 1.
 */
const PUSH_MS = WIPE_MS + SLIDE_MS
const SETTLE_AT = (WIPE_MS + 400) / PUSH_MS
const PUSH_IN: Keyframe[] = [
  { transform: "scale(1.1)", offset: 0, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
  { transform: "scale(1)", offset: SETTLE_AT, easing: "linear" },
  { transform: "scale(1.06)", offset: 1 },
]
const PUSH_ONLY: Keyframe[] = [{ transform: "scale(1)" }, { transform: "scale(1.06)" }]

/**
 * The slideshow's clock and memory. `target` is the slide asked for (the
 * indicators follow it at once); `stack` is what the stage paints, newest
 * first — the slide coming in over the one (or, after a quick double click,
 * two) it is covering. A request waits for its picture to load (at most
 * LOAD_WAIT_MS), so a curtain never opens on an empty frame.
 *
 * Only the first slide renders on the server. The rest mount once the
 * browser is idle — each an eager image, so every cover is in the cache long
 * before the slideshow or a chip asks for it — and a request for a slide
 * that has not mounted yet mounts it on the spot.
 */
export function useHeroSlideshow(initial: number) {
  const [target, setTarget] = React.useState(initial)
  const [stack, setStack] = React.useState<number[]>([initial])
  const [dir, setDir] = React.useState<1 | -1>(1)
  const [seq, setSeq] = React.useState(0)
  const [mounted, setMounted] = React.useState<ReadonlySet<number>>(() => new Set([initial]))
  // Loaded pictures live in a ref: the server-painted image can report its
  // load during hydration, before this component has mounted, so the ref
  // records it and the tick (from mount on) re-runs the commit check.
  const loaded = React.useRef<Set<number>>(new Set())
  const [loadTick, setLoadTick] = React.useState(0)
  const live = React.useRef(false)
  const nextDir = React.useRef<1 | -1>(1)
  const current = stack[0]

  React.useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])

  React.useEffect(() => {
    const all = () => setMounted(new Set(HERO_SLIDES.map((_, i) => i)))
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(all, { timeout: 2500 })
      return () => window.cancelIdleCallback(id)
    }
    const t = window.setTimeout(all, 1200)
    return () => window.clearTimeout(t)
  }, [])

  /** Ask for slide `i`; `d` is the curtain's direction (+1 enters from the right). */
  const go = React.useCallback((i: number, d?: 1 | -1) => {
    setMounted((m) => (m.has(i) ? m : new Set(m).add(i)))
    setTarget((t) => {
      nextDir.current = d ?? (i >= t ? 1 : -1)
      return i
    })
  }, [])

  const markLoaded = React.useCallback((i: number) => {
    if (loaded.current.has(i)) return
    loaded.current.add(i)
    if (live.current) setLoadTick((n) => n + 1)
  }, [])

  // Commit the request once its picture is ready (or has kept us waiting long enough).
  React.useEffect(() => {
    if (target === current) return
    const commit = () => {
      setDir(nextDir.current)
      setStack((s) => [target, ...s.filter((x) => x !== target)].slice(0, 3))
      setSeq((n) => n + 1)
    }
    if (loaded.current.has(target)) {
      commit()
      return
    }
    const t = window.setTimeout(commit, LOAD_WAIT_MS)
    return () => window.clearTimeout(t)
  }, [target, current, loadTick])

  /** The newest curtain is home: everything under it can stop painting. */
  const settle = React.useCallback((i: number) => {
    setStack((s) => (s[0] === i && s.length > 1 ? [i] : s))
  }, [])

  return { target, stack, dir, seq, mounted, go, markLoaded, settle }
}

/**
 * The stage: every mounted slide as a stacked curtain. Pure scenery —
 * aria-hidden, no pointer events. `drift` runs the push-in (off while the
 * visitor has paused, the hero is off screen or the tab is hidden); `ok` is
 * the reduced-motion switch — without it a change is a short crossfade and
 * nothing drifts.
 */
export function HeroStage({
  show,
  ok,
  drift,
}: {
  show: ReturnType<typeof useHeroSlideshow>
  ok: boolean
  drift: boolean
}) {
  const { stack, dir, seq, mounted, markLoaded, settle } = show
  return (
    <>
      {HERO_SLIDES.map((slide, i) =>
        mounted.has(i) ? (
          <Curtain
            key={slide.src}
            i={i}
            slide={slide}
            pos={stack.indexOf(i)}
            dir={dir}
            seq={seq}
            ok={ok}
            drift={drift}
            onLoaded={markLoaded}
            onHome={settle}
          />
        ) : null
      )}
    </>
  )
}

function Curtain({
  i,
  slide,
  pos,
  dir,
  seq,
  ok,
  drift,
  onLoaded,
  onHome,
}: {
  i: number
  slide: HeroSlide
  /** 0 = on stage (or coming in), 1–2 = being covered, -1 = off. */
  pos: number
  dir: 1 | -1
  seq: number
  ok: boolean
  drift: boolean
  onLoaded: (i: number) => void
  onHome: (i: number) => void
}) {
  const curtain = React.useRef<HTMLDivElement>(null)
  const frame = React.useRef<HTMLDivElement>(null)
  const push = React.useRef<HTMLDivElement>(null)
  const shade = React.useRef<HTMLDivElement>(null)
  const pushAnim = React.useRef<Animation | null>(null)
  // Frozen at mount: the first slide is painted by the server and never
  // "enters"; a later mount waits, hidden, for its turn.
  const [bornOnStage] = React.useState(pos === 0)
  const seenSeq = React.useRef(seq)
  const lastPos = React.useRef(pos)
  const driftRef = React.useRef(drift)
  React.useEffect(() => {
    driftRef.current = drift
  }, [drift])

  const startPush = React.useCallback(
    (keyframes: Keyframe[]) => {
      pushAnim.current?.cancel()
      pushAnim.current = null
      if (!ok || !push.current) return
      const a = push.current.animate(keyframes, { duration: PUSH_MS, fill: "forwards" })
      if (!driftRef.current) a.pause()
      pushAnim.current = a
    },
    [ok]
  )

  // A layout effect: the curtain's first keyframe must apply before the
  // frame that makes it visible is painted.
  React.useLayoutEffect(() => {
    const c = curtain.current
    const f = frame.current
    const s = shade.current
    if (!c || !f || !s) return
    const was = lastPos.current
    lastPos.current = pos

    if (pos === 0 && seq !== seenSeq.current) {
      seenSeq.current = seq
      for (const el of [c, f, s]) el.getAnimations().forEach((a) => a.cancel())
      c.style.visibility = "visible"
      const home = ok
        ? c.animate(
            [{ transform: `translateX(${dir * CURTAIN_TRAVEL}%)` }, { transform: "translateX(0)" }],
            { duration: WIPE_MS, easing: EASE_CURTAIN }
          )
        : c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: "ease-out" })
      if (ok) {
        f.animate([{ transform: `translateX(${-dir * FRAME_TRAVEL}%)` }, { transform: "translateX(0)" }], {
          duration: WIPE_MS,
          easing: EASE_CURTAIN,
        })
      }
      home.finished.then(() => onHome(i)).catch(() => {})
      startPush(PUSH_IN)
      return
    }

    if (pos >= 1 && was === 0 && ok) {
      // Being covered: it keeps moving the way the curtain travels, slower
      // than the curtain — the depth between two pictures — and dims.
      f.animate([{ transform: "translateX(0)" }, { transform: `translateX(${-dir * 7}%)` }], {
        duration: WIPE_MS,
        easing: EASE_CURTAIN,
        fill: "forwards",
      })
      s.animate([{ opacity: 0 }, { opacity: 0.55 }], { duration: WIPE_MS, easing: "ease-in", fill: "forwards" })
      return
    }

    if (pos === -1 && was !== -1) {
      c.style.visibility = "hidden"
      for (const el of [c, f, s]) el.getAnimations().forEach((a) => a.cancel())
      pushAnim.current?.cancel()
      pushAnim.current = null
    }
  }, [pos, seq, dir, ok, i, onHome, startPush])

  // The server-painted slide starts its push-in once it is known that motion
  // is welcome, and every push stops for good the moment it is not.
  React.useEffect(() => {
    if (!ok) {
      pushAnim.current?.cancel()
      pushAnim.current = null
      return
    }
    if (bornOnStage && seenSeq.current === 0 && lastPos.current === 0 && !pushAnim.current) startPush(PUSH_ONLY)
  }, [ok, bornOnStage, startPush])

  React.useEffect(() => {
    const a = pushAnim.current
    if (!a || a.playState === "finished") return
    if (drift) a.play()
    else a.pause()
  }, [drift])

  React.useEffect(() => () => pushAnim.current?.cancel(), [])

  const portrait = slide.school === null

  return (
    <div
      ref={curtain}
      className={cn("absolute inset-y-0 -left-[45%] w-[190%]", !bornOnStage && "invisible")}
      style={{ zIndex: pos === -1 ? 0 : 10 - pos, maskImage: CURTAIN_MASK, WebkitMaskImage: CURTAIN_MASK }}
    >
      <div ref={frame} className="absolute inset-y-0" style={{ left: FEATHER, width: FRAME_WIDTH }}>
        {/* Ground — overhangs the frame, so a covered slide's drift never bares an edge. */}
        <div className="absolute inset-y-0 -inset-x-[10%] bg-ws-page" />
        {/* The band clips; the push scales inside it — so the push-in never
            carries the picture past the band's foot, below the veil. */}
        <div className={cn(BAND, "overflow-hidden")}>
          <div ref={push} className={cn("absolute inset-0", portrait ? "origin-[80%_30%]" : "origin-[74%_58%]")}>
            {portrait ? (
              <Portrait i={i} src={slide.src} onLoaded={onLoaded} />
            ) : (
              <Cover i={i} src={slide.src} onLoaded={onLoaded} />
            )}
          </div>
        </div>
        <div ref={shade} className="absolute inset-y-0 -inset-x-[10%] bg-ws-page opacity-0" />
      </div>
    </div>
  )
}

/**
 * Below lg the picture lives in a band across the top of the stage (the
 * copy sits under it); from lg it is the whole stage, behind the copy.
 * `--band` is set on the stage.
 */
const BAND = "absolute inset-x-0 top-0 h-[var(--band)] lg:inset-y-0 lg:h-auto"

/**
 * A school cover, inside the band. The renders stand their subject on a
 * pedestal right of centre (between ~44% and ~88% across) in a dark studio.
 * Below lg the frame is lifted by 14% of the band — the render's empty top
 * goes, and the subject sits clear above the copy that overlaps the band's
 * foot. From xl the frame is height-bound (16:10) and pushed past the
 * stage's right edge by 8% of the stage: that trims the render's empty right
 * margin and moves the subject away from the copy without cutting into it.
 * lg alone (1024–1279) has a stage too narrow for that — a full-height
 * frame would be wider than the stage and stand the subject under the
 * headline — so there the frame is 80% of the stage's height, on its foot,
 * pulled 12% past the right edge, and its top feathered into the stage by
 * a static mask.
 */
function Cover({ i, src, onLoaded }: { i: number; src: string; onLoaded: (i: number) => void }) {
  return (
    <div className="absolute inset-x-0 -top-[14%] h-full lg:inset-x-auto lg:top-auto lg:bottom-0 lg:-right-[12%] lg:h-[80%] lg:aspect-[16/10] lg:[mask-image:linear-gradient(to_bottom,transparent,black_30%)] xl:top-0 xl:-right-[8%] xl:h-full xl:[mask-image:none]">
      <Image
        src={src}
        alt=""
        fill
        loading="eager"
        sizes="100vw"
        draggable={false}
        onLoad={() => onLoaded(i)}
        className="object-cover object-[80%_58%] lg:object-center"
      />
    </div>
  )
}

function Portrait({ i, src, onLoaded }: { i: number; src: string; onLoaded: (i: number) => void }) {
  return (
    <div className="absolute inset-0">
      {/* The studio she stands in: the covers' warm key light, drawn with the
          house ambient glow — hero pages only (01-foundations → Atmosphere). */}
      <div className="absolute inset-0 bg-[radial-gradient(60%_70%_at_82%_38%,var(--ws-glow-brand),transparent_70%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(34%_42%_at_80%_34%,var(--ws-glow-brand),transparent_72%)]" />
      <Image
        src={src}
        alt=""
        width={509}
        height={491}
        priority
        draggable={false}
        onLoad={() => onLoaded(i)}
        sizes="(min-width: 1536px) 40rem, (min-width: 1280px) 36rem, (min-width: 1024px) 25rem, (min-width: 768px) 24rem, (min-width: 640px) 21rem, 15rem"
        className="absolute bottom-0 right-0 h-auto w-[15rem] drop-shadow-[0_24px_60px_rgba(0,0,0,0.55)] sm:w-[21rem] md:w-[24rem] lg:w-[25rem] xl:w-[36rem] 2xl:w-[40rem]"
      />
    </div>
  )
}
