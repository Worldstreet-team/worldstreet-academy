"use client"

import * as React from "react"
import { AnimatePresence, motion, useInView } from "motion/react"
import {
  AwardIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  CompassIcon,
  DownloadIcon,
  HandIcon,
  LockIcon,
  MicIcon,
  PlayIcon,
  RadioIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Reveal, RevealGroup } from "@/components/marketing/motion/reveal"
import {
  EASE_EXIT,
  EASE_INERTIA,
  EASE_LUX,
} from "@/components/marketing/motion/ease"
import { useMediaQuery, useMotionOK } from "@/components/marketing/motion/bus"

/**
 * §4 — PROGRAMS. A tight editorial index: five fixed-grid rows
 * (`[3rem_1fr_auto]` so numerals and titles rail up perfectly — nothing ever
 * translates on hover or activation). The active row carries a gold numeral,
 * ws-primary title and a one-line description that expands IN PLACE
 * (height-animated; instant under reduced motion); inactive rows sit at
 * ws-subtle. Hover/focus/click switches rows and the list auto-advances
 * every 5s until the first interaction.
 *
 * On lg+ the right column is a framed panel stretched to the exact height of
 * the list (grid items-stretch): the per-row vignette (DS primitives only —
 * never course art) centered inside it, and the truthful fact line pinned at
 * the panel's bottom edge, inside the frame. Below lg the rows collapse to an
 * accordion on the same fixed grid.
 */

type Program = {
  numeral: string
  title: string
  /** One line for the expanding row description. */
  blurb: string
  /** The full truthful sentence, pinned inside the lg+ panel. */
  fact: string
  vignette: React.ComponentType
}

const PROGRAMS: Program[] = [
  {
    numeral: "01",
    title: "Learn",
    blurb: "Video and text lessons with free previews — progress autosaves.",
    fact: "Video and text lessons with free previews — your watch position autosaves and every lesson tracks complete.",
    vignette: LearnVignette,
  },
  {
    numeral: "02",
    title: "Live sessions",
    blurb: "Scheduled classes with a moderated stage, chat and polls.",
    fact: "Scheduled classes on a moderated stage: raise your hand to speak, vote in polls, react, share screens.",
    vignette: LiveVignette,
  },
  {
    numeral: "03",
    title: "Exams",
    blurb: "Timed, shuffled per attempt, with a pass mark set per course.",
    fact: "Timed, questions shuffled per attempt, attempts limited, answers autosaved. The default pass mark is 70% — instructors set it per course.",
    vignette: ExamsVignette,
  },
  {
    numeral: "04",
    title: "Certificates",
    blurb: "Signed by you and your instructor, downloadable as a PDF.",
    fact: "Pass the exam and your certificate unlocks — signed by your instructor and by you, downloadable as a PDF with its own ID.",
    vignette: CertificatesVignette,
  },
  {
    numeral: "05",
    title: "Vivid AI",
    blurb: "A voice assistant that answers, then navigates you there.",
    fact: "A voice assistant on every page — ask it anything about the academy and it takes you where you need to go.",
    vignette: VividVignette,
  },
]

export function ProgramsList() {
  const ok = useMotionOK()
  const isCompact = useMediaQuery("(max-width: 1023px)")
  const listRef = React.useRef<HTMLDivElement>(null)
  const inView = useInView(listRef, { amount: 0.35 })
  const [active, setActive] = React.useState(0)
  const [interacted, setInteracted] = React.useState(false)
  const [open, setOpen] = React.useState<number | null>(null)

  // Auto-advance every 5s until the first interaction (desktop only).
  React.useEffect(() => {
    if (!ok || interacted || !inView || isCompact) return
    const t = setInterval(
      () => setActive((i) => (i + 1) % PROGRAMS.length),
      5000
    )
    return () => clearInterval(t)
  }, [ok, interacted, inView, isCompact])

  const select = (i: number) => {
    setInteracted(true)
    setActive(i)
  }

  const ActiveVignette = PROGRAMS[active].vignette

  return (
    <section className="relative isolate py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <RevealGroup>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ws-gold">
            Programs
          </p>
          <h2
            className="mt-4 max-w-3xl font-display font-semibold leading-[1.05] tracking-[-0.02em] text-ws-primary"
            style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)" }}
          >
            From first lesson to signed certificate.
          </h2>
        </RevealGroup>

        <div
          ref={listRef}
          className="mt-12 grid items-stretch gap-12 lg:mt-16 lg:grid-cols-[1fr_24rem] lg:gap-16 xl:grid-cols-[1fr_26rem]"
        >
          {/* ── The index rows ── */}
          <div>
            {PROGRAMS.map((program, i) => {
              const isLast = i === PROGRAMS.length - 1
              // Desktop: the active row expands. Mobile: the open one.
              const expanded = isCompact ? open === i : active === i

              return (
                <Reveal key={program.title} delay={i * 0.06} y={14} duration={0.55}>
                  <div
                    className={cn(
                      "group relative border-t border-ws-hairline",
                      isLast && "border-b"
                    )}
                  >
                    {/* Gold hairline sweeps the row's top border on hover. */}
                    <span
                      aria-hidden
                      className="absolute inset-x-0 top-[-1px] h-px origin-left scale-x-0 bg-ws-brand transition-transform duration-300 ease-[var(--land-ease-inertia)] group-hover:scale-x-100"
                    />
                    <button
                      type="button"
                      className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
                      aria-expanded={expanded}
                      onMouseEnter={() => {
                        if (!isCompact) select(i)
                      }}
                      onFocus={() => {
                        if (!isCompact) select(i)
                      }}
                      onClick={() => {
                        if (isCompact) {
                          setInteracted(true)
                          setOpen((prev) => (prev === i ? null : i))
                        } else {
                          select(i)
                        }
                      }}
                    >
                      <div className="grid grid-cols-[3rem_1fr_auto] items-baseline gap-x-4 py-5">
                        <span
                          className={cn(
                            "font-display text-[14px] font-semibold tabular-nums transition-colors duration-[var(--ws-motion-base)]",
                            expanded ? "text-ws-gold" : "text-ws-subtle"
                          )}
                        >
                          {program.numeral}
                        </span>
                        <span
                          className={cn(
                            "font-display text-xl font-semibold tracking-[-0.01em] transition-colors duration-[var(--ws-motion-base)] md:text-2xl",
                            expanded ? "text-ws-primary" : "text-ws-subtle"
                          )}
                        >
                          {program.title}
                        </span>
                        <span className="col-start-3 row-start-1 self-center justify-self-end lg:hidden">
                          <ChevronDownIcon
                            size={16}
                            aria-hidden
                            className={cn(
                              "text-ws-subtle transition-transform duration-200",
                              expanded && "rotate-180"
                            )}
                          />
                        </span>
                        {/* The in-place description: height-animated on the
                            title's own column, so nothing ever shifts
                            sideways. Instant under reduced motion. */}
                        <motion.span
                          className="col-start-2 row-start-2 block overflow-hidden"
                          initial={false}
                          animate={{
                            height: expanded ? "auto" : 0,
                            opacity: expanded ? 1 : 0,
                          }}
                          transition={{ duration: ok ? 0.35 : 0, ease: EASE_LUX }}
                        >
                          <span className="block pt-2 text-[14px] leading-relaxed text-ws-muted">
                            {program.blurb}
                          </span>
                        </motion.span>
                      </div>
                    </button>
                  </div>
                </Reveal>
              )
            })}
          </div>

          {/* ── The framed panel (lg+), stretched to the list's height ── */}
          <div className="hidden lg:block">
            <Reveal className="h-full" delay={0.15} y={24}>
              <div className="flex h-full flex-col overflow-hidden rounded-xl border border-ws-hairline bg-ws-surface">
                {/* Vignette stage — centered, clipped by the frame. */}
                <div className="relative flex-1">
                  <AnimatePresence initial={false}>
                    <motion.div
                      key={active}
                      className="absolute inset-0 flex items-center justify-center p-6"
                      initial={{ opacity: 0, y: ok ? 20 : 0 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        transition: { duration: ok ? 0.55 : 0.25, ease: EASE_INERTIA },
                      }}
                      exit={{
                        opacity: 0,
                        y: ok ? -12 : 0,
                        transition: { duration: ok ? 0.3 : 0.2, ease: EASE_EXIT },
                      }}
                    >
                      <div className="w-full max-w-[21rem]">
                        <ActiveVignette />
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
                {/* The truthful fact line — pinned at the panel's bottom
                    edge, inside the frame. aria-hidden: it duplicates the
                    row content for sighted users only. */}
                <div aria-hidden className="border-t border-ws-hairline px-5 py-4">
                  <motion.p
                    key={active}
                    className="min-h-[4rem] text-[13px] leading-relaxed text-ws-muted"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: ok ? 0.35 : 0 }}
                  >
                    {PROGRAMS[active].fact}
                  </motion.p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── Compact vignettes (DS primitives only — no course art) ──────────────── */

function VignetteCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "w-full overflow-hidden rounded-lg border border-ws-hairline bg-ws-surface shadow-xl shadow-black/40",
        className
      )}
    >
      {children}
    </div>
  )
}

function LearnVignette() {
  return (
    <VignetteCard>
      <div className="relative h-28 bg-ws-sunken">
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-ws-chip px-2.5 py-1 text-[11px] font-semibold text-ws-gold">
          Resume · Lesson 3
        </span>
        <div className="absolute inset-x-3 bottom-3 h-1 overflow-hidden rounded-full bg-ws-track">
          <div className="h-full w-[62%] rounded-full bg-ws-brand" />
        </div>
      </div>
      <ul className="divide-y divide-ws-hairline">
        <li className="flex items-center gap-3 border-l-2 border-transparent px-4 py-2.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ws-success/20 text-ws-success">
            <CheckIcon size={11} />
          </span>
          <span className="truncate text-[13px] text-ws-primary">
            What is Bitcoin?
          </span>
          <span className="ml-auto shrink-0 rounded-full bg-ws-chip px-2 py-0.5 text-[10px] font-medium text-ws-muted">
            Free preview
          </span>
        </li>
        <li className="flex items-center gap-3 border-l-2 border-ws-brand bg-ws-raised px-4 py-2.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ws-brand/15 text-ws-gold">
            <PlayIcon size={9} fill="currentColor" />
          </span>
          <span className="truncate text-[13px] text-ws-primary">
            How Blockchain Works
          </span>
        </li>
        <li className="flex items-center gap-3 border-l-2 border-transparent px-4 py-2.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-ws-hairline text-ws-subtle">
            <LockIcon size={9} />
          </span>
          <span className="truncate text-[13px] text-ws-subtle">
            Setting Up Your First Wallet
          </span>
        </li>
      </ul>
    </VignetteCard>
  )
}

function LiveVignette() {
  return (
    <VignetteCard className="p-4">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-ws-danger/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-ws-danger">
          <RadioIcon size={12} />
          Live
        </span>
        <span className="text-[11px] text-ws-muted">
          Market structure · Session 4
        </span>
      </div>
      <div className="mt-4 flex items-center gap-2">
        {["JK", "AO", "TN", "RS"].map((who, i) => (
          <span key={who} className="relative">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ws-chip text-[11px] font-semibold text-ws-muted ring-1 ring-ws-hairline">
              {who}
            </span>
            {i === 3 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-ws-brand text-ws-brand-on">
                <HandIcon size={9} />
              </span>
            )}
          </span>
        ))}
      </div>
      <div className="mt-4 space-y-2 border-t border-ws-hairline pt-3">
        <p className="w-fit max-w-[85%] rounded-lg bg-ws-chip px-3 py-2 text-[13px] leading-snug text-ws-primary">
          Watch this level — who&apos;s trapped here?
        </p>
        <p className="ml-auto w-fit max-w-[85%] rounded-lg bg-ws-brand px-3 py-2 text-[13px] leading-snug text-ws-brand-on">
          Late shorts from the breakdown?
        </p>
      </div>
    </VignetteCard>
  )
}

function ExamsVignette() {
  return (
    <VignetteCard className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-ws-subtle">
          The sitting
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-ws-chip px-2.5 py-1 text-[12px] font-semibold tabular-nums text-ws-primary">
          <ClockIcon size={12} className="text-ws-muted" />
          45:00
        </span>
      </div>
      {/* Abstract question card — one option ringed gold. */}
      <div className="mt-4 rounded-md border border-ws-hairline bg-ws-raised p-3.5">
        <div className="h-2.5 w-3/4 rounded-full bg-ws-chip" />
        <div className="mt-2 h-2.5 w-1/2 rounded-full bg-ws-chip" />
        <div className="mt-3.5 space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                "flex items-center gap-3 rounded-md border px-3 py-2",
                i === 1
                  ? "border-ws-brand ring-1 ring-ws-brand/40"
                  : "border-ws-hairline"
              )}
            >
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                  i === 1
                    ? "border-ws-brand bg-ws-brand text-ws-brand-on"
                    : "border-ws-hairline"
                )}
              >
                {i === 1 && <CheckIcon size={9} />}
              </span>
              <span
                className={cn(
                  "h-2 rounded-full bg-ws-chip",
                  ["w-2/3", "w-1/2", "w-3/5"][i]
                )}
              />
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-[12px] text-ws-muted">
        Timed · shuffled per attempt · answers autosave
      </p>
    </VignetteCard>
  )
}

function CertificatesVignette() {
  return (
    <VignetteCard className="border-ws-gold/30 p-5">
      <div className="flex items-start justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ws-brand/15">
          <AwardIcon size={18} className="text-ws-gold" />
        </span>
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-ws-muted">
          Certificate of completion
        </span>
      </div>
      <p className="mt-5 font-display text-lg font-semibold tracking-[-0.01em] text-ws-primary">
        Your course, completed
      </p>
      <div className="mt-6 grid grid-cols-2 gap-6">
        {(["Instructor", "You"] as const).map((who) => (
          <div key={who}>
            <svg
              viewBox="0 0 120 28"
              className="h-6 w-full max-w-[120px] text-ws-primary/80"
              fill="none"
            >
              <path
                d="M4 20 C 14 4, 24 26, 36 12 S 56 20, 68 10 S 92 22, 116 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
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
    </VignetteCard>
  )
}

function VividVignette() {
  const ok = useMotionOK()
  return (
    <VignetteCard className="p-6">
      <div className="flex flex-col items-center py-4 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ws-brand/15 text-ws-gold ring-1 ring-ws-brand/30">
          <MicIcon size={22} />
        </span>
        {/* Waveform */}
        <span className="mt-5 flex h-7 items-center gap-1" aria-hidden>
          {[0.35, 0.7, 1, 0.55, 0.8, 0.45, 0.65].map((h, i) =>
            ok ? (
              <motion.span
                key={i}
                className="w-1 rounded-full bg-ws-gold/70"
                style={{ height: `${h * 100}%`, transformOrigin: "center" }}
                animate={{ scaleY: [0.4, 1, 0.5, 0.9, 0.4] }}
                transition={{
                  duration: 1.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.12,
                }}
              />
            ) : (
              <span
                key={i}
                className="w-1 rounded-full bg-ws-gold/70"
                style={{ height: `${h * 100}%` }}
              />
            )
          )}
        </span>
        <p className="mt-5 text-[14px] font-semibold text-ws-primary">
          Vivid · voice assistant
        </p>
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-ws-hairline bg-ws-raised px-3 py-1.5 text-[12px] text-ws-muted">
          <CompassIcon size={12} className="text-ws-gold" />
          Answers, then navigates you there
        </p>
      </div>
    </VignetteCard>
  )
}
