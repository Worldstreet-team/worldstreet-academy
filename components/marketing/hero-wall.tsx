"use client"

import * as React from "react"
import Link from "next/link"
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react"
import { XIcon } from "lucide-react"
import { EASE_INERTIA } from "@/components/marketing/motion/ease"
import { useMotionOK } from "@/components/marketing/motion/bus"
import { HeroStage, PEOPLE_COUNT, slideOf, useHeroSlideshow } from "@/components/marketing/hero-stage"
import { HeroPauseToggle, useSlideClock } from "@/components/marketing/hero-controls"
import { HeroCopy } from "@/components/marketing/hero-copy"
import { HeroChipScrollbar } from "@/components/marketing/hero-chip-scrollbar"
import { useStartSchool } from "@/components/marketing/start-school-store"
import { BRAND } from "@/lib/brand"
import { SCHOOLS, SCHOOL_BY_SLUG, type School, type SchoolSlug } from "@/lib/schools"
import { START_SCHOOL_COOKIE } from "@/lib/start-gate"
import { cn } from "@/lib/utils"

const MotionLink = motion.create(Link)

/** The hand-off's resting values, written explicitly under reduced motion:
 *  motion keeps the last inline value it wrote, and the first client pass
 *  always runs with motion on, so `style={undefined}` could strand a block
 *  mid-fade on a page restored part-way down. */
const STILL = { y: 0, scale: 1, opacity: 1 }

/** The chip pill's glide and the CTA's reshape. */
const GLIDE = { type: "spring", stiffness: 420, damping: 38, mass: 0.9 } as const

/** Forget the landing's school (the chips' "clear", or the active chip tapped again). */
function clearPick() {
  document.cookie = `${START_SCHOOL_COOKIE}=; path=/; max-age=0; samesite=lax`
  useStartSchool.setState({ picked: null })
}

/**
 * §1 — HERO. The claim holds still while a slideshow plays behind it: four
 * students (green-screen cutouts, each holding something with the gold W
 * mark), one every six seconds, each with a slow push-in and brought on by a
 * soft travelling curtain (see `hero-stage.tsx`). Owner request, 2026-09-18
 * — the one auto-advancing loop in the app; on 2026-09-21 the school covers
 * left the rotation and the students replaced them — and, by the owner's
 * later call the same day, with no
 * visible control row. What stays for WCAG 2.2.2 (`hero-controls.tsx`): one
 * pause/play button, clipped out of sight until it takes keyboard focus, and
 * the show holds still while the pointer rests on the chips or the CTAs,
 * while keyboard focus is inside the hero, while the hero is off screen and
 * while the tab is hidden. Reduced motion: no autoplay and no drift — the
 * stage only changes when a school is chosen, with a short crossfade.
 *
 * The stage is a dark island (`data-ws-theme="platform"`): the covers are
 * dark renders in both modes, so in light mode the hero is a rounded dark
 * stage set into the paper — the same token scoping the Schools showcase
 * panels use. Below lg the picture is a band across the top of the stage
 * and the copy sits under it; from lg the picture fills the stage, behind a
 * veil that keeps the copy column dark.
 *
 * "What do you want to master?" — choosing a school stops the slideshow on
 * that school's cover (the curtain comes from the side the school lies on)
 * and hands the copy to the school: its number, name, tagline (or blurb)
 * and real facts, with the gold CTA reshaping to "Explore the School of …"
 * → `/schools/<slug>`. The chosen chip's pill glides from chip to chip.
 * Choosing it again, or "Clear", returns the default copy and the student the
 * show was on, and resumes the slideshow. Every cell reserves its tallest
 * variant, so nothing below it ever moves (`hero-copy.tsx`).
 *
 * The hand-off, as the hero scrolls away (a function of scroll only — see
 * `useHeroLeave`): the picture trails the page inside the stage; the
 * headline lifts, settles to 0.94 and dims but stays faintly lit to the
 * last; the sub-copy, picker and CTA row dissolve sooner — each fully gone
 * before it reaches the navbar — but only while crossing the top half of the
 * screen, so the middle of the screen is never emptied. Reduced motion:
 * none of it — the hero simply scrolls.
 */
export function HeroWall({
  counts,
  cheapest,
  signedIn,
  registerUrl,
}: {
  counts: Record<SchoolSlug, number>
  cheapest: Record<SchoolSlug, number | null>
  signedIn: boolean
  registerUrl: string
}) {
  const ok = useMotionOK()
  const heroRef = React.useRef<HTMLElement>(null)
  const subRef = React.useRef<HTMLDivElement>(null)
  const pickRef = React.useRef<HTMLDivElement>(null)
  const chipRowRef = React.useRef<HTMLDivElement>(null)
  const ctaRef = React.useRef<HTMLDivElement>(null)
  const leave = useHeroLeave(ok, heroRef, subRef, pickRef, ctaRef)

  const picked = useStartSchool((s) => s.picked)
  const pick = useStartSchool((s) => s.pick)
  const school = picked ? SCHOOL_BY_SLUG[picked] : null

  const show = useHeroSlideshow(slideOf(picked))
  const { go, target } = show
  // The student the show was on — where "Clear" returns to.
  const lastPerson = React.useRef(0)
  React.useEffect(() => {
    if (target < PEOPLE_COUNT) lastPerson.current = target
  }, [target])
  // A chosen school holds its own cover; clearing it brings the students back.
  React.useEffect(() => {
    go(picked ? slideOf(picked) : lastPerson.current)
  }, [picked, go])

  // ── When the show may run ──
  const [paused, setPaused] = React.useState(false)
  const [pointerHold, setPointerHold] = React.useState(false)
  const [focusHold, setFocusHold] = React.useState(false)
  const onScreen = useOnScreen(heroRef)
  const tabVisible = useTabVisible()
  const still = !ok || paused || !onScreen || !tabVisible
  const auto = !still && !picked && !pointerHold && !focusHold
  const holdOn = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") setPointerHold(true)
  }
  const holdOff = () => setPointerHold(false)
  // Only the students rotate; the curtain always comes on from the right.
  useSlideClock(target, auto, () => go((target + 1) % PEOPLE_COUNT, 1))

  const choose = (slug: SchoolSlug) => (picked === slug ? clearPick() : pick(slug))

  const factsFor = React.useCallback(
    (s: School) => {
      const n = counts[s.slug]
      if (!n) return null
      const from = cheapest[s.slug]
      return [
        n === 1 ? "1 program" : `${n} programs`,
        from === null ? null : from === 0 ? "free to start" : `from $${from.toLocaleString("en-US")}`,
      ]
        .filter(Boolean)
        .join(" · ")
    },
    [counts, cheapest]
  )

  const cta = school ? `Explore the ${school.name}` : "Explore programs"
  const secondary =
    "inline-flex h-12 w-full items-center justify-center rounded-sm border border-ws-hairline px-7 text-[15px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:border-ws-brand/40 hover:text-ws-gold sm:w-auto"

  return (
    <section
      ref={heroRef}
      id="hero"
      aria-label={BRAND.name}
      className="px-2 pt-2 sm:px-3 sm:pt-3"
      // Keyboard focus anywhere in the hero holds the show; a mouse click does not.
      onFocus={(e) => setFocusHold(e.target.matches(":focus-visible"))}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusHold(false)
      }}
    >
      <div
        data-ws-theme="platform"
        className="relative isolate overflow-hidden rounded-[20px] bg-ws-page text-ws-primary [--band:15rem] sm:[--band:24rem] md:[--band:27rem]"
      >
        {/* The show's one control: first in the hero, seen only on keyboard focus. */}
        {ok && <HeroPauseToggle paused={paused} onToggle={() => setPaused((p) => !p)} />}

        {/* ── The stage: the picture trails the page as the hero leaves ── */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-20 select-none"
          style={{ y: ok ? leave.stageY : 0 }}
        >
          <HeroStage show={show} ok={ok} drift={!still} />
        </motion.div>

        {/* ── The veil: keeps the copy on dark ground ──
            Below lg the band fades into the stage under the copy. From lg
            a left-heavy ramp holds the copy column, opening to the picture
            from about the middle, and the foot settles into the stage. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          {/* Solid for 12rem past the band's foot: the picture lags the page
              by up to 180px on the way out, and must never slip out from
              under the veil. */}
          <div className="absolute inset-x-0 top-0 h-[calc(var(--band)+12rem)] bg-[linear-gradient(to_bottom,transparent_0,transparent_calc(var(--band)*0.3),color-mix(in_oklab,var(--ws-bg-page)_55%,transparent)_calc(var(--band)*0.48),color-mix(in_oklab,var(--ws-bg-page)_88%,transparent)_calc(var(--band)*0.64),var(--ws-bg-page)_calc(var(--band)*0.86))] lg:hidden" />
          <div className="absolute inset-0 hidden bg-[linear-gradient(90deg,var(--ws-bg-page)_0%,var(--ws-bg-page)_34%,color-mix(in_oklab,var(--ws-bg-page)_82%,transparent)_48%,color-mix(in_oklab,var(--ws-bg-page)_30%,transparent)_62%,transparent_74%)] lg:block xl:bg-[linear-gradient(90deg,var(--ws-bg-page)_0%,var(--ws-bg-page)_26%,color-mix(in_oklab,var(--ws-bg-page)_82%,transparent)_40%,color-mix(in_oklab,var(--ws-bg-page)_34%,transparent)_54%,transparent_66%)]" />
          <div className="absolute inset-x-0 bottom-0 hidden h-2/5 bg-[linear-gradient(to_top,color-mix(in_oklab,var(--ws-bg-page)_70%,transparent),transparent)] lg:block" />
        </div>

        {/* ── The copy ──
            Each scroll-linked wrapper sits OUTSIDE its block's own
            animations (motion can't drive one property from both), so the
            load sequence and the school swaps play untouched and the
            hand-off layers on top of them. */}
        <div className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-7xl flex-col px-6 pb-10 pt-[calc(var(--band)-6.5rem)] sm:min-h-[calc(100svh-4.75rem)] lg:justify-center lg:py-10">
          <div className="w-full lg:relative">
            <HeroCopy
              school={school}
              ok={ok}
              factsFor={factsFor}
              headStyle={ok ? { y: leave.headY, scale: leave.headScale, opacity: leave.headOpacity } : STILL}
              subStyle={ok ? { y: leave.subY, opacity: leave.subOpacity } : STILL}
              subRef={subRef}
            />
            <p className="sr-only" aria-live="polite">
              {school ? [school.name, factsFor(school)].filter(Boolean).join(". ") : ""}
            </p>

            {/* lg+ widens the picker to 3xl so the eight chips sit in two
                rows (three would push the CTA under a 768px fold). Phones
                close every gap a step, with the shorter band and the
                one-sentence sub-copy, so the gold CTA makes the first screen. */}
            <motion.div
              className="mt-6 max-w-2xl sm:mt-7 lg:max-w-3xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE_INERTIA, delay: 0.5 }}
            >
              {/* The picker and the CTA row fade on their own schedules. While
                  faded they stop taking the pointer (see useHeroLeave), and any
                  keyboard focus inside brings them back to full strength. */}
              <motion.div
                ref={pickRef}
                className="focus-within:opacity-100!"
                style={ok ? { y: leave.pickY, opacity: leave.pickOpacity } : STILL}
                onPointerEnter={holdOn}
                onPointerLeave={holdOff}
              >
                {/* "Clear" sits right after the question, inside the copy
                    column — never out over the picture. */}
                <div className="flex h-6 items-center gap-3">
                  <p id="hero-pick" className="text-[14px] font-medium text-ws-primary">
                    What do you want to master?
                  </p>
                  <AnimatePresence initial={false}>
                    {school && (
                      <motion.button
                        key="clear"
                        type="button"
                        onClick={clearPick}
                        aria-label="Clear the chosen school"
                        initial={{ opacity: 0, x: 6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 6 }}
                        transition={{ duration: ok ? 0.2 : 0, ease: EASE_INERTIA }}
                        className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised hover:text-ws-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/50"
                      >
                        Clear
                        <XIcon size={14} aria-hidden />
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
                {/* A choice list, not tabs: the chosen chip is raised, never
                    gold — gold stays on the one CTA. Phones scroll the row
                    sideways inside the gutter (with a visible scrollbar
                    below it, owner 2026-09-18); sm+ wraps. */}
                <motion.div
                  ref={chipRowRef}
                  layoutScroll
                  role="group"
                  aria-labelledby="hero-pick"
                  className="-mx-6 mt-3 flex gap-2 overflow-x-auto px-6 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
                >
                  {SCHOOLS.map((s) => {
                    const on = picked === s.slug
                    return (
                      <button
                        key={s.slug}
                        type="button"
                        aria-pressed={on}
                        onClick={(e) => {
                          choose(s.slug)
                          // Phones: centre the chip in its sideways row (never scroll the page).
                          const row = e.currentTarget.parentElement
                          if (row && row.scrollWidth > row.clientWidth) {
                            const c = e.currentTarget.getBoundingClientRect()
                            const r = row.getBoundingClientRect()
                            row.scrollBy({ left: c.left + c.width / 2 - (r.left + r.width / 2), behavior: ok ? "smooth" : "auto" })
                          }
                        }}
                        className={cn(
                          "group relative h-10 shrink-0 rounded-full px-3.5 text-[13px] font-medium transition-colors duration-[var(--ws-motion-base)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/50",
                          on ? "text-ws-primary" : "text-ws-muted hover:text-ws-primary"
                        )}
                      >
                        <span
                          aria-hidden
                          className="absolute inset-0 rounded-full bg-ws-surface/70 ring-1 ring-inset ring-ws-hairline transition-colors duration-[var(--ws-motion-fast)] group-hover:bg-ws-raised"
                        />
                        <AnimatePresence>
                          {on && (
                            <motion.span
                              key="pill"
                              layoutId="hero-chip-pill"
                              aria-hidden
                              className="absolute inset-0 bg-ws-raised ring-1 ring-inset ring-ws-primary/30"
                              style={{ borderRadius: 999 }}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={ok ? { layout: GLIDE, opacity: { duration: 0.2 } } : { duration: 0 }}
                            />
                          )}
                        </AnimatePresence>
                        <span className="relative">{s.short}</span>
                      </button>
                    )
                  })}
                </motion.div>
                <HeroChipScrollbar rowRef={chipRowRef} className="mt-1" />
              </motion.div>

              {/* `id="hero-cta"`: the sticky school bar takes over as this row fades. */}
              <motion.div
                ref={ctaRef}
                id="hero-cta"
                className="mt-5 flex flex-col gap-3 focus-within:opacity-100! sm:mt-6 sm:flex-row sm:items-center"
                style={ok ? { y: leave.ctaY, opacity: leave.ctaOpacity } : STILL}
                onPointerEnter={holdOn}
                onPointerLeave={holdOff}
              >
                {/* The gold CTA reshapes to its new label (layout), its label
                    rolling through; the secondary glides aside. */}
                <MotionLink
                  layout
                  href={school ? `/schools/${school.slug}` : "/programs"}
                  transition={{ layout: ok ? GLIDE : { duration: 0 } }}
                  style={{ borderRadius: 7 }}
                  className="relative inline-flex min-h-14 w-full items-center justify-center overflow-hidden bg-ws-brand px-6 py-2.5 text-center text-[15px] font-semibold leading-[1.2] text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ws-page sm:min-h-12 sm:w-auto sm:px-8"
                >
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={cta}
                      layout="position"
                      className="block"
                      initial={ok ? { y: "130%", opacity: 0 } : { opacity: 0 }}
                      animate={{ y: "0%", opacity: 1 }}
                      exit={ok ? { y: "-130%", opacity: 0 } : { opacity: 0 }}
                      transition={{ duration: ok ? 0.5 : 0.15, ease: EASE_INERTIA }}
                    >
                      {cta}
                    </motion.span>
                  </AnimatePresence>
                </MotionLink>
                {signedIn ? (
                  <MotionLink layout="position" transition={{ layout: ok ? GLIDE : { duration: 0 } }} href="/dashboard" className={secondary}>
                    Start learning
                  </MotionLink>
                ) : (
                  <motion.a layout="position" transition={{ layout: ok ? GLIDE : { duration: 0 } }} href={registerUrl} className={secondary}>
                    Start learning
                  </motion.a>
                )}
              </motion.div>
            </motion.div>

          </div>
        </div>
      </div>
    </section>
  )
}

/** Whether a real share of the hero is on screen (the show holds when it is not). */
function useOnScreen(ref: React.RefObject<HTMLElement | null>) {
  const [on, setOn] = React.useState(true)
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[entries.length - 1]
        setOn(e.isIntersecting && e.intersectionRatio >= 0.2)
      },
      { threshold: [0, 0.2, 0.4] }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref])
  return on
}

function useTabVisible() {
  const [visible, setVisible] = React.useState(true)
  React.useEffect(() => {
    const sync = () => setVisible(document.visibilityState === "visible")
    sync()
    document.addEventListener("visibilitychange", sync)
    return () => document.removeEventListener("visibilitychange", sync)
  }, [])
  return visible
}

/**
 * The hero's hand-off. Every value is the identity with the page at rest,
 * so the server render and the first client frame are the untouched hero.
 *
 * The picture and the headline run on the hero's own progress: 0 with its
 * top at the navbar's foot, 1 once its bottom has passed under the bar. The
 * bar is 57px on phones and 65px from sm; the offset uses 65, so a phone's
 * hero rests at ~1% — a sub-pixel difference. The headline, the top of the
 * column, is gone by ~0.5, so its whole hand-off sits inside that window.
 * The picture's lag only ever opens a gap at the stage's top edge, which by
 * then is under the navbar.
 *
 * The column below it fades by POSITION, not by hero progress: each block
 * dissolves (and lifts a little) only while it crosses the top half of the
 * viewport — from its top at 50% (42% for the CTA row) to its bottom just
 * under the navbar. Content in the middle of the screen is always at full
 * strength, so the hand-off never leaves an emptied screen, and the gold CTA
 * is never a half-faded smudge mid-page. The sticky school bar rises as the
 * CTA row passes 30% of the viewport (the row at about half strength), so a
 * primary action is always in view. A faded control stops taking the
 * pointer (set on the element, no re-render).
 */
function useHeroLeave(
  ok: boolean,
  heroRef: React.RefObject<HTMLElement | null>,
  subRef: React.RefObject<HTMLDivElement | null>,
  pickRef: React.RefObject<HTMLDivElement | null>,
  ctaRef: React.RefObject<HTMLDivElement | null>
) {
  const { scrollYProgress: p } = useScroll({ target: heroRef, offset: ["start 65px", "end 65px"] })
  const sub = useTopFade(subRef, "start 0.5", 18)
  const pickFade = useTopFade(pickRef, "start 0.5", 16)
  const cta = useTopFade(ctaRef, "start 0.42", 12)

  const leave = {
    // Depth: px the picture lags behind the page by the time the hero has gone.
    stageY: useTransform(p, [0, 1], [0, 180]),
    // The claim lifts, settles and dims — never fully out: it is the last to go.
    headY: useTransform(p, [0, 0.5], [0, -44]),
    headScale: useTransform(p, [0, 0.5], [1, 0.94]),
    headOpacity: useTransform(p, [0, 0.5], [1, 0.22]),
    subY: sub.y,
    subOpacity: sub.opacity,
    pickY: pickFade.y,
    pickOpacity: pickFade.opacity,
    ctaY: cta.y,
    ctaOpacity: cta.opacity,
  }

  usePointerGate(pickRef, leave.pickOpacity, ok)
  usePointerGate(ctaRef, leave.ctaOpacity, ok)
  return leave
}

/**
 * Fade-and-lift for one block as it crosses the top of the viewport: from
 * `start` (its top at that fraction of the viewport) to its bottom at 14%,
 * just under the navbar. Every hero block rests below its start line, so it
 * rests at the identity.
 */
function useTopFade(
  ref: React.RefObject<HTMLElement | null>,
  start: `start ${number}`,
  lift: number
) {
  const { scrollYProgress } = useScroll({ target: ref, offset: [start, "end 0.14"] })
  return {
    opacity: useTransform(scrollYProgress, [0, 1], [1, 0]),
    y: useTransform(scrollYProgress, [0, 1], [0, -lift]),
  }
}

/**
 * A control faded (near-)invisible should not catch clicks or show a pointer
 * cursor. Only while the fade is live — reduced motion never fades, so it
 * never gates.
 */
function usePointerGate(
  ref: React.RefObject<HTMLElement | null>,
  opacity: MotionValue<number>,
  ok: boolean
) {
  const gate = React.useCallback(
    (v: number) => {
      if (ref.current) ref.current.style.pointerEvents = ok && v < 0.08 ? "none" : ""
    },
    [ref, ok]
  )
  useMotionValueEvent(opacity, "change", gate)
  // Re-evaluate when motion is switched on or off, and for a page opened mid-scroll.
  React.useEffect(() => gate(opacity.get()), [gate, opacity])
}
