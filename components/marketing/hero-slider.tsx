"use client"

import * as React from "react"
import Link from "next/link"
import { AnimatePresence, motion, useInView } from "motion/react"
import {
  AwardIcon,
  CheckIcon,
  ClockIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  HandIcon,
  LockIcon,
  MicIcon,
  MonitorUpIcon,
  PaperclipIcon,
  PlayIcon,
  RadioIcon,
  SmileIcon,
  Vote,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { LineMask } from "@/components/marketing/motion/line-mask"
import { Parallax } from "@/components/marketing/motion/parallax"
import { TiltCard } from "@/components/marketing/motion/tilt-card"
import {
  EASE_EXIT,
  EASE_INERTIA,
  EASE_LUX,
} from "@/components/marketing/motion/ease"
import { useMotionOK } from "@/components/marketing/motion/bus"

/**
 * §1 — HERO + HERO BAND. A contained split header (display headline left,
 * supporting copy + CTAs right) over a full-width product-frame slider: three
 * UI vignettes — the classroom player, the live room, the exam → certificate
 * — rebuilt purely from design-system primitives at large scale, framed in
 * browser chrome on the stone band. NO course art anywhere in this section.
 *
 * Slider: crossfade + slight translate between slides (EASE_INERTIA in,
 * EASE_EXIT out), 6s autoplay that pauses on hover/focus/reduced-motion/
 * offscreen, manual dot nav. The frame drifts on a Layer-B parallax.
 */

const SLIDES = [
  { id: "learn", label: "The classroom", route: "/dashboard/courses/…/learn" },
  { id: "live", label: "The live room", route: "/dashboard/meetings" },
  { id: "exam", label: "Exam → certificate", route: "/dashboard/courses/…/exam" },
] as const

/**
 * §1 — HERO. Type, copy, CTAs on the open stage. No frame, no card, no course
 * art: the product walkthrough lives in <ProductFrames /> further down the
 * page, where it reads as evidence rather than decoration.
 */
export function Hero({
  signedIn,
  registerUrl,
}: {
  signedIn: boolean
  registerUrl: string
}) {
  const ok = useMotionOK()

  return (
    <section
      className="relative isolate flex min-h-[82svh] items-center overflow-hidden"
      aria-label="WorldStreet Academy"
    >
      <div
        aria-hidden
        className="absolute -left-40 -top-56 -z-10 h-[42rem] w-[42rem] rounded-full blur-[120px]"
        style={{ background: "var(--ws-glow-brand)" }}
      />
      <div
        aria-hidden
        className="absolute -bottom-40 right-[-10rem] -z-10 h-[34rem] w-[34rem] rounded-full opacity-60 blur-[130px]"
        style={{ background: "var(--ws-glow-brand)" }}
      />

      <div className="mx-auto grid w-full max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:gap-16">
        <div>
          <motion.p
            className="text-[11px] font-medium uppercase tracking-[0.14em] text-ws-gold"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            WorldStreet Academy
          </motion.p>
          <LineMask
            as="h1"
            mode="mount"
            delay={0.05}
            className="mt-5 font-display text-[clamp(2.75rem,6.5vw,5.75rem)] font-semibold leading-[1.02] tracking-[-0.03em] text-ws-primary"
            lines={[
              { text: "A trading floor" },
              { text: "with a syllabus.", className: "text-ws-gold" },
            ]}
          />
        </div>

        <div className="lg:pb-2">
          <motion.p
            className="max-w-md text-[15px] leading-relaxed text-ws-muted md:text-base"
            initial={{ opacity: 0, y: ok ? 20 : 0 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE_INERTIA, delay: 0.4 }}
          >
            Courses from traders who trade, live sessions you can speak in, and a
            real exam between the last lesson and your signed certificate.
          </motion.p>
          <motion.div
            className="mt-7 flex flex-wrap items-center gap-3"
            initial={{ opacity: 0, y: ok ? 20 : 0 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE_INERTIA, delay: 0.5 }}
          >
            {signedIn ? (
              <Link
                href="/dashboard"
                className="inline-flex h-12 items-center justify-center rounded-sm bg-ws-brand px-8 text-[15px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"
              >
                Continue learning
              </Link>
            ) : (
              <a
                href={registerUrl}
                className="inline-flex h-12 items-center justify-center rounded-sm bg-ws-brand px-8 text-[15px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"
              >
                Start learning
              </a>
            )}
            <Link
              href="/courses"
              className="inline-flex h-12 items-center justify-center rounded-sm border border-ws-hairline px-7 text-[15px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:border-ws-brand/40 hover:text-ws-gold"
            >
              Explore courses
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

/**
 * The product walkthrough band — mid-page evidence. Full-bleed carousel of
 * browser-framed UI vignettes (classroom, live room, exam → certificate).
 */
export function ProductFrames() {
  const ok = useMotionOK()
  const bandRef = React.useRef<HTMLDivElement>(null)
  const bandInView = useInView(bandRef, { amount: 0.25 })
  const [index, setIndex] = React.useState(0)
  const [hovered, setHovered] = React.useState(false)
  const [focused, setFocused] = React.useState(false)

  // 6s autoplay — off under reduced motion, paused on hover/focus/offscreen.
  React.useEffect(() => {
    if (!ok || hovered || focused || !bandInView) return
    const t = setInterval(
      () => setIndex((i) => (i + 1) % SLIDES.length),
      6000
    )
    return () => clearInterval(t)
  }, [ok, hovered, focused, bandInView])

  const slide = SLIDES[index]

  return (
    <section className="relative isolate overflow-hidden" aria-label="Inside the academy">
      <div className="mx-auto max-w-7xl px-6 pb-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ws-gold">
          Inside the academy
        </p>
        <h2 className="mt-3 max-w-2xl font-display text-[clamp(1.6rem,3.2vw,2.5rem)] font-semibold leading-[1.1] tracking-[-0.02em] text-ws-primary">
          The rooms you actually learn in.
        </h2>
      </div>

      {/* ── Hero band (full width) ── */}
      <div
        ref={bandRef}
        className="relative mt-12 border-y border-ws-hairline bg-ws-sunken/50 md:mt-16"
        role="region"
        aria-roledescription="carousel"
        aria-label="Inside the academy"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={() => setFocused(false)}
      >
        <div className="pb-32 pt-10 md:pb-40 md:pt-14">
          <Parallax
            speed={-0.06}
            mobile={false}
            className="w-full px-3 sm:px-5 lg:px-8"
          >
            <div
              className="relative"
              style={{ height: "clamp(460px, 50vw, 720px)" }}
            >
              <AnimatePresence initial={false}>
                <motion.div
                  key={slide.id}
                  className="absolute inset-0"
                  aria-roledescription="slide"
                  aria-label={`${index + 1} of ${SLIDES.length}: ${slide.label}`}
                  initial={{ opacity: 0, x: ok ? 40 : 0 }}
                  animate={{
                    opacity: 1,
                    x: 0,
                    transition: { duration: ok ? 0.8 : 0.3, ease: EASE_INERTIA },
                  }}
                  exit={{
                    opacity: 0,
                    x: ok ? -28 : 0,
                    transition: { duration: ok ? 0.45 : 0.2, ease: EASE_EXIT },
                  }}
                >
                  <BrowserFrame route={slide.route}>
                    {slide.id === "learn" ? (
                      <ClassroomVignette />
                    ) : slide.id === "live" ? (
                      <LiveRoomVignette />
                    ) : (
                      <ExamVignette />
                    )}
                  </BrowserFrame>
                </motion.div>
              </AnimatePresence>
            </div>
          </Parallax>

          {/* Caption + dot nav */}
          <div className="mt-8 flex flex-col items-center gap-3 px-6">
            <span className="relative block h-[1.1rem] w-full overflow-hidden text-center">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={slide.id}
                  className="absolute inset-0 block text-[11px] uppercase tracking-[0.14em] text-ws-subtle"
                  initial={{ y: "100%", opacity: 0 }}
                  animate={{ y: "0%", opacity: 1 }}
                  exit={{ y: "-100%", opacity: 0 }}
                  transition={{ duration: 0.4, ease: EASE_LUX }}
                >
                  {slide.label}
                </motion.span>
              </AnimatePresence>
            </span>
            <div className="flex items-center gap-4">
              <button
                type="button"
                aria-label="Previous slide"
                onClick={() => setIndex((i) => (i - 1 + SLIDES.length) % SLIDES.length)}
                className="flex size-9 items-center justify-center rounded-full border border-ws-hairline text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:border-ws-brand/40 hover:text-ws-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
              >
                <ChevronLeftIcon size={16} aria-hidden />
              </button>

              <div className="flex items-center gap-2.5">
                {SLIDES.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-label={`Show ${s.label}`}
                    aria-current={i === index || undefined}
                    onClick={() => setIndex(i)}
                    className={cn(
                      "h-2 rounded-full transition-all duration-[var(--ws-motion-base)] ease-[var(--ws-ease)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40",
                      i === index
                        ? "w-7 bg-ws-brand"
                        : "w-2 bg-ws-chip hover:bg-ws-raised"
                    )}
                  />
                ))}
              </div>

              <button
                type="button"
                aria-label="Next slide"
                onClick={() => setIndex((i) => (i + 1) % SLIDES.length)}
                className="flex size-9 items-center justify-center rounded-full border border-ws-hairline text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:border-ws-brand/40 hover:text-ws-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
              >
                <ChevronRightIcon size={16} aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── Browser-chrome frame ────────────────────────────────────────────────── */

function BrowserFrame({
  route,
  children,
}: {
  route: string
  children: React.ReactNode
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-ws-hairline bg-ws-surface shadow-2xl shadow-black/50">
      <div className="flex shrink-0 items-center border-b border-ws-hairline px-4 py-2.5">
        <span className="flex w-16 gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-ws-chip" />
          <span className="h-2.5 w-2.5 rounded-full bg-ws-chip" />
          <span className="h-2.5 w-2.5 rounded-full bg-ws-chip" />
        </span>
        <span className="mx-auto min-w-0 truncate rounded-full bg-ws-sunken px-3.5 py-1 font-mono text-[11px] text-ws-subtle">
          {route}
        </span>
        <span className="w-16" aria-hidden />
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}

/* ── Vignette (a): the classroom player ──────────────────────────────────── */

const LESSONS = [
  { title: "What is Bitcoin?", state: "done" as const, tag: "Free preview" },
  { title: "How Blockchain Works", state: "done" as const },
  { title: "Bitcoin Mining Explained", state: "active" as const },
  { title: "Setting Up Your First Wallet", state: "locked" as const },
]

function ClassroomVignette() {
  const ok = useMotionOK()
  return (
    <div
      aria-hidden
      className="grid h-full grid-rows-[1fr_auto] md:grid-cols-[1.15fr_0.85fr] md:grid-rows-none"
    >
      {/* Video frame — abstract stone player, no fake play button. */}
      <div className="relative min-h-0 overflow-hidden bg-ws-sunken">
        <div className="absolute inset-0 bg-gradient-to-br from-ws-raised/60 via-transparent to-transparent" />
        <div
          className="absolute -right-24 -top-24 h-72 w-72 rounded-full blur-[80px]"
          style={{ background: "var(--ws-glow-brand)" }}
        />
        <motion.span
          className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-ws-chip px-2.5 py-1 text-[11px] font-semibold text-ws-gold"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_LUX, delay: 0.5 }}
        >
          Resume · Lesson 3
        </motion.span>
        <div className="absolute inset-x-4 bottom-4">
          <p className="font-display text-[15px] font-semibold text-ws-primary md:text-lg">
            Bitcoin Mining Explained
          </p>
          <p className="mt-0.5 text-[12px] text-ws-muted">
            Picks up where you stopped — position autosaves.
          </p>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-ws-track">
            <motion.div
              className="h-full origin-left rounded-full bg-ws-brand"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 0.62 }}
              transition={{ duration: 0.9, ease: EASE_INERTIA, delay: 0.35 }}
            />
          </div>
        </div>
      </div>

      {/* Lesson rail — the REAL seeded lesson titles. */}
      <div className="flex min-h-0 flex-col border-t border-ws-hairline md:border-l md:border-t-0">
        <div className="shrink-0 border-b border-ws-hairline px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-ws-subtle">
          Lessons
        </div>
        <motion.ul
          className="min-h-0 flex-1 divide-y divide-ws-hairline overflow-hidden"
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.06, delayChildren: 0.25 } },
          }}
        >
          {LESSONS.map((lesson) => (
            <motion.li
              key={lesson.title}
              variants={{
                hidden: { opacity: 0, y: ok ? 8 : 0 },
                show: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.5, ease: EASE_LUX },
                },
              }}
              className={
                lesson.state === "active"
                  ? "flex items-center gap-3 border-l-2 border-ws-brand bg-ws-raised px-4 py-2.5 md:py-3"
                  : "flex items-center gap-3 border-l-2 border-transparent px-4 py-2.5 md:py-3"
              }
            >
              {lesson.state === "done" ? (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ws-success/20 text-ws-success">
                  <CheckIcon size={11} />
                </span>
              ) : lesson.state === "active" ? (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ws-brand/15 text-ws-gold">
                  <PlayIcon size={9} fill="currentColor" />
                </span>
              ) : (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-ws-hairline text-ws-subtle">
                  <LockIcon size={9} />
                </span>
              )}
              <span
                className={
                  lesson.state === "locked"
                    ? "truncate text-[13px] text-ws-subtle"
                    : "truncate text-[13px] text-ws-primary"
                }
              >
                {lesson.title}
              </span>
              {lesson.tag && (
                <span className="ml-auto shrink-0 rounded-full bg-ws-chip px-2 py-0.5 text-[10px] font-medium text-ws-muted">
                  {lesson.tag}
                </span>
              )}
            </motion.li>
          ))}
        </motion.ul>
        <div className="shrink-0 border-t border-ws-hairline px-4 py-3">
          <div className="flex items-center justify-between text-[11px] text-ws-muted">
            <span>Course progress</span>
            <span className="text-ws-subtle">autosaves</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-ws-track">
            <motion.div
              className="h-full origin-left rounded-full bg-ws-brand"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 0.5 }}
              transition={{ duration: 0.9, ease: EASE_INERTIA, delay: 0.45 }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Vignette (b): the live room ─────────────────────────────────────────── */

const CHAT = [
  { who: "them", text: "Watch this level — who's trapped here?" },
  { who: "you", text: "Late shorts from the breakdown?" },
  { who: "them", text: "Exactly. Watch how price treats them." },
]

function LiveRoomVignette() {
  const ok = useMotionOK()
  return (
    <div
      aria-hidden
      className="grid h-full grid-rows-[1fr_auto] md:grid-cols-[1.1fr_0.9fr] md:grid-rows-none"
    >
      {/* The stage */}
      <div className="flex min-h-0 flex-col p-4 md:p-5">
        <div className="flex shrink-0 items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ws-danger/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-ws-danger">
            {ok ? (
              <motion.span
                className="flex"
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 1.6, repeat: Infinity }}
              >
                <RadioIcon size={12} />
              </motion.span>
            ) : (
              <RadioIcon size={12} />
            )}
            Live
          </span>
          <span className="text-[11px] text-ws-muted">
            Market structure · Session 4
          </span>
        </div>
        {/* Stage tiles: initials avatars, one hand raised. */}
        <div className="mt-4 grid min-h-0 flex-1 grid-cols-2 gap-2.5">
          {["JK", "AO", "TN", "RS"].map((who, i) => (
            <motion.div
              key={who}
              className="relative flex items-center justify-center rounded-lg bg-ws-sunken ring-1 ring-ws-hairline"
              initial={{ opacity: 0, y: ok ? 10 : 0 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE_LUX, delay: 0.2 + i * 0.08 }}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ws-chip text-[12px] font-semibold text-ws-muted ring-1 ring-ws-hairline md:h-12 md:w-12">
                {who}
              </span>
              {i === 0 && (
                <span className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-ws-chip text-ws-muted">
                  <MicIcon size={10} />
                </span>
              )}
              {i === 3 && (
                <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-ws-brand text-ws-brand-on">
                  <HandIcon size={10} />
                </span>
              )}
            </motion.div>
          ))}
        </div>
        {/* Control strip */}
        <div className="mt-4 flex shrink-0 items-center gap-4 border-t border-ws-hairline pt-3 text-ws-muted">
          <MicIcon size={14} />
          <MonitorUpIcon size={14} />
          <Vote size={14} />
          <SmileIcon size={14} />
          <span className="ml-auto text-[11px] text-ws-subtle">
            Raise a hand to speak
          </span>
        </div>
      </div>

      {/* The chat */}
      <div className="flex min-h-0 flex-col border-t border-ws-hairline md:border-l md:border-t-0">
        <div className="shrink-0 border-b border-ws-hairline px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-ws-subtle">
          Class chat
        </div>
        <motion.div
          className="min-h-0 flex-1 space-y-2.5 overflow-hidden p-4"
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.09, delayChildren: 0.3 } },
          }}
        >
          {CHAT.map((m, i) => (
            <motion.p
              key={i}
              variants={{
                hidden: { opacity: 0, y: ok ? 12 : 0 },
                show: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.5, ease: EASE_LUX },
                },
              }}
              className={
                m.who === "you"
                  ? "ml-auto w-fit max-w-[85%] rounded-lg bg-ws-brand px-3 py-2 text-[13px] leading-snug text-ws-brand-on"
                  : "w-fit max-w-[85%] rounded-lg bg-ws-chip px-3 py-2 text-[13px] leading-snug text-ws-primary"
              }
            >
              {m.text}
            </motion.p>
          ))}
          <motion.span
            variants={{
              hidden: { opacity: 0, y: ok ? 12 : 0 },
              show: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.5, ease: EASE_LUX },
              },
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-ws-hairline bg-ws-raised px-2.5 py-1 text-[11px] text-ws-muted"
          >
            <PaperclipIcon size={11} />
            chart-annotated.png
          </motion.span>
        </motion.div>
      </div>
    </div>
  )
}

/* ── Vignette (c): exam → certificate ────────────────────────────────────── */

const EXAM_CHECKS = [
  "Timed sitting",
  "Questions shuffled per attempt",
  "Answers autosave as you go",
  "Score clears the pass mark",
]

function ExamVignette() {
  const ok = useMotionOK()
  return (
    <div
      aria-hidden
      className="grid h-full grid-rows-[auto_1fr] md:grid-cols-2 md:grid-rows-none"
    >
      {/* The sitting: checklist + pass mark */}
      <div className="flex min-h-0 flex-col p-4 md:p-6">
        <div className="flex shrink-0 items-center justify-between">
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-ws-subtle">
            The exam
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ws-chip px-2.5 py-1 text-[12px] font-semibold tabular-nums text-ws-primary">
            <ClockIcon size={12} className="text-ws-muted" />
            45:00
          </span>
        </div>
        <motion.ul
          className="mt-4 space-y-2 md:mt-5 md:space-y-2.5"
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.08, delayChildren: 0.25 } },
          }}
        >
          {EXAM_CHECKS.map((item, i) => {
            const last = i === EXAM_CHECKS.length - 1
            return (
              <motion.li
                key={item}
                variants={{
                  hidden: { opacity: 0, y: ok ? 10 : 0 },
                  show: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.5, ease: EASE_LUX },
                  },
                }}
                className={cn(
                  "flex items-center gap-3 rounded-md border px-3 py-2 md:py-2.5",
                  last
                    ? "border-ws-brand ring-1 ring-ws-brand/40"
                    : "border-ws-hairline"
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                    last
                      ? "bg-ws-brand text-ws-brand-on"
                      : "bg-ws-success/20 text-ws-success"
                  )}
                >
                  <CheckIcon size={9} />
                </span>
                <span className="text-[13px] text-ws-primary">{item}</span>
              </motion.li>
            )
          })}
        </motion.ul>
        {/* Pass-mark meter — the true 70% default. */}
        <div className="mt-auto hidden pt-6 md:block">
          <div className="relative">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-ws-track">
              <motion.div
                className="h-full origin-left rounded-full bg-ws-brand"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 0.7 }}
                transition={{ duration: 0.9, ease: EASE_INERTIA, delay: 0.5 }}
              />
            </div>
            <div className="absolute -top-1.5 bottom-[-6px] left-[70%] w-px bg-ws-primary/60" />
          </div>
          <p className="mt-3 text-[12px] text-ws-muted">
            The default pass mark is 70% — instructors set it per course.
          </p>
        </div>
      </div>

      {/* The proof: signed certificate */}
      <div className="flex min-h-0 items-center border-t border-ws-hairline bg-ws-sunken/40 p-4 md:border-l md:border-t-0 md:p-6">
        <TiltCard className="w-full">
          <div className="rounded-lg border border-ws-gold/30 bg-ws-surface p-5 shadow-xl shadow-black/40 md:p-6">
            <div className="flex items-start justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ws-brand/15">
                <AwardIcon size={18} className="text-ws-gold" />
              </span>
              <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-ws-muted">
                Certificate of completion
              </span>
            </div>
            <p className="mt-5 font-display text-lg font-semibold tracking-[-0.01em] text-ws-primary md:text-xl">
              Your course, completed
            </p>
            {/* Two signatures: instructor AND student. */}
            <div className="mt-6 grid grid-cols-2 gap-6 md:mt-7 md:gap-8">
              {(["Instructor", "You"] as const).map((who, i) => (
                <div key={who}>
                  <svg
                    viewBox="0 0 120 28"
                    className="h-6 w-full max-w-[120px] text-ws-primary/80 md:h-7"
                    fill="none"
                  >
                    <motion.path
                      d="M4 20 C 14 4, 24 26, 36 12 S 56 20, 68 10 S 92 22, 116 8"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      initial={{ pathLength: ok ? 0 : 1 }}
                      animate={{ pathLength: 1 }}
                      transition={
                        ok
                          ? {
                              duration: 0.6,
                              ease: EASE_INERTIA,
                              delay: 0.5 + i * 0.15,
                            }
                          : { duration: 0 }
                      }
                    />
                  </svg>
                  <div className="mt-1 border-t border-ws-hairline pt-1.5 text-[11px] uppercase tracking-[0.1em] text-ws-muted">
                    {who}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-ws-hairline pt-4">
              <span className="rounded-sm bg-ws-chip px-2.5 py-1 font-mono text-[11px] tracking-wide text-ws-primary">
                WSA-XXXXXXXX
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-sm bg-ws-chip px-2.5 py-1 text-[11px] font-medium text-ws-muted">
                <DownloadIcon size={11} />
                PDF download
              </span>
            </div>
          </div>
        </TiltCard>
      </div>
    </div>
  )
}
