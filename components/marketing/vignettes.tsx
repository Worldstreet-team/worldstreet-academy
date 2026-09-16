"use client"

import * as React from "react"
import { motion } from "motion/react"
import { CheckIcon, LockIcon, PlayIcon } from "lucide-react"
import { SCHOOLS } from "@/lib/schools"
import { SchoolIcon } from "@/components/shared/school-icon"
import { EASE_INERTIA, EASE_LUX } from "@/components/marketing/motion/ease"
import { useMotionOK } from "@/components/marketing/motion/bus"

/**
 * Product vignettes for the How-it-works walkthrough (spec §11): the four
 * journey moments rebuilt from design-system primitives inside a browser
 * frame — never course art. Every vignette is aria-hidden scenery; the step
 * copy beside it carries the meaning. Shared stagger grammar: a container
 * variant with `staggerChildren`, items fading up 8px (0 under reduced
 * motion).
 */

/* ── Browser-chrome frame ────────────────────────────────────────────────── */

export function BrowserFrame({
  route,
  children,
}: {
  route: string
  children: React.ReactNode
}) {
  return (
    <div aria-hidden className="flex h-full flex-col overflow-hidden rounded-[20px] border border-ws-hairline bg-ws-surface">
      <div className="flex shrink-0 items-center border-b border-ws-hairline px-4 py-2.5">
        <span className="flex w-16 gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-ws-chip" />
          <span className="h-2.5 w-2.5 rounded-full bg-ws-chip" />
          <span className="h-2.5 w-2.5 rounded-full bg-ws-chip" />
        </span>
        {/* Keyed on the route: when the pinned How-it-works stage moves to the
            next step the address bar fades to the new URL instead of snapping. */}
        <span
          key={route}
          className="ws-animate-fade mx-auto min-w-0 truncate rounded-full bg-ws-sunken px-3.5 py-1 font-mono text-[11px] text-ws-subtle"
        >
          {route}
        </span>
        <span className="w-16" aria-hidden />
      </div>
      <div className="relative min-h-0 flex-1">{children}</div>
    </div>
  )
}

/* ── Vignette (a): the classroom player ──────────────────────────────────── */

const LESSONS = [
  { title: "What is the Forex market?", state: "done" as const, tag: "Free preview" },
  { title: "Currency pairs and pips", state: "done" as const },
  { title: "Reading price action", state: "active" as const },
  { title: "Risk management basics", state: "locked" as const },
]

export function ClassroomVignette() {
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
            Reading price action
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

      {/* Lesson rail. */}
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
                  ? "flex min-w-0 items-center gap-3 border-l-2 border-ws-brand bg-ws-raised px-4 py-2.5 md:py-3"
                  : "flex min-w-0 items-center gap-3 border-l-2 border-transparent px-4 py-2.5 md:py-3"
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

/* ── 01 Choose your school ───────────────────────────────────────────────── */

const STAGGER = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.2 } },
}

function itemVariants(ok: boolean) {
  return {
    hidden: { opacity: 0, y: ok ? 8 : 0 },
    show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_LUX } },
  }
}

export function SchoolsVignette() {
  const ok = useMotionOK()
  return (
    <div aria-hidden className="flex h-full flex-col bg-ws-sunken">
      <div className="shrink-0 border-b border-ws-hairline px-5 py-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-ws-gold">Our schools</p>
        <p className="mt-1 font-display text-[15px] font-semibold text-ws-primary md:text-lg">
          Choose the school that matches your goals.
        </p>
      </div>
      {/* Phones: a 2×2 of the first four schools — eight tiles at two columns
          cannot fit the frame and were squashing to blank boxes. sm+: all eight. */}
      <motion.ul
        className="grid min-h-0 flex-1 grid-cols-2 gap-2.5 overflow-hidden p-4 sm:grid-cols-4 sm:gap-3 sm:p-5 [&>li:nth-child(n+5)]:hidden sm:[&>li:nth-child(n+5)]:flex"
        initial="hidden"
        animate="show"
        variants={STAGGER}
      >
        {SCHOOLS.map((school, i) => (
          <motion.li
            key={school.slug}
            variants={itemVariants(ok)}
            className={
              i === 0
                ? "flex min-h-0 flex-col rounded-md border border-ws-brand/60 bg-ws-surface p-3"
                : "flex min-h-0 flex-col rounded-md border border-ws-hairline bg-ws-surface p-3"
            }
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ws-brand/10 text-ws-gold">
              <SchoolIcon name={school.icon} size={15} />
            </span>
            <span className="mt-3 line-clamp-2 text-[12px] font-semibold leading-snug text-ws-primary">
              {school.short}
            </span>
            {i === 0 && (
              <span className="mt-auto hidden w-fit rounded-full bg-ws-brand px-2 py-0.5 text-[10px] font-semibold text-ws-brand-on sm:inline-flex">
                Explore school
              </span>
            )}
          </motion.li>
        ))}
      </motion.ul>
    </div>
  )
}

/* ── 02 Select your program ──────────────────────────────────────────────── */

const MODULES = [
  "Forex market structure and currency pairs",
  "Technical and fundamental analysis",
  "Risk management and position sizing",
  "Trading psychology and a live trade plan",
]

const INCLUDED = ["Structured lessons", "Live classes", "Instructor Q&A", "Signed certificate"]

export function ProgramVignette() {
  const ok = useMotionOK()
  return (
    <div aria-hidden className="grid h-full grid-rows-[auto_1fr] bg-ws-sunken">
      <div className="border-b border-ws-hairline px-5 py-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-ws-gold">
          School of Trading &amp; Financial Markets
        </p>
        <p className="mt-1 font-display text-lg font-semibold tracking-[-0.01em] text-ws-primary md:text-xl">
          Forex Trading Mastery
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {["Beginner to advanced", "3 packages", "Certificate"].map((chip) => (
            <span key={chip} className="rounded-full bg-ws-chip px-2 py-0.5 text-[10px] font-medium text-ws-muted">
              {chip}
            </span>
          ))}
        </div>
      </div>
      <div className="grid min-h-0 md:grid-cols-[1fr_0.8fr]">
        <div className="min-h-0 overflow-hidden">
          <div className="border-b border-ws-hairline px-5 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-ws-subtle">
            Curriculum
          </div>
          <motion.ol initial="hidden" animate="show" variants={STAGGER}>
            {MODULES.map((module, i) => (
              <motion.li
                key={module}
                variants={itemVariants(ok)}
                className="flex min-w-0 items-center gap-3 border-b border-ws-hairline px-5 py-2.5 md:py-3"
              >
                <span className="font-display text-[11px] font-bold tracking-[0.1em] text-ws-gold">0{i + 1}</span>
                <span className="truncate text-[13px] text-ws-primary">{module}</span>
              </motion.li>
            ))}
          </motion.ol>
        </div>
        <div className="hidden min-h-0 flex-col border-l border-ws-hairline md:flex">
          <div className="border-b border-ws-hairline px-5 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-ws-subtle">
            What&apos;s included
          </div>
          <ul className="space-y-2.5 px-5 py-4">
            {INCLUDED.map((item) => (
              <li key={item} className="flex items-center gap-2 text-[12px] text-ws-muted">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-ws-success/20 text-ws-success">
                  <CheckIcon size={9} />
                </span>
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-auto px-5 pb-4">
            <span className="inline-flex h-9 w-full items-center justify-center rounded-sm bg-ws-brand text-[12px] font-semibold text-ws-brand-on">
              View packages
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── 03 Choose your package ──────────────────────────────────────────────── */

/** The real Forex ladder from the Phase 0 catalogue (spec §6). */
const TIERS = [
  { name: "Basic", price: 49, highlight: false, lines: ["Full curriculum", "Self-paced lessons", "Progress tracking"] },
  { name: "Standard", price: 199, highlight: true, lines: ["Everything in Basic", "Live classes and Q&A", "Signed certificate"] },
  { name: "Executive", price: 999, highlight: false, lines: ["Everything in Standard", "1:1 mentorship", "Priority support"] },
]

export function PackagesVignette() {
  const ok = useMotionOK()
  return (
    <div aria-hidden className="flex h-full flex-col bg-ws-sunken">
      <div className="shrink-0 border-b border-ws-hairline px-5 py-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-ws-gold">
          Choose your learning experience
        </p>
        <p className="mt-1 font-display text-[15px] font-semibold text-ws-primary md:text-lg">
          Forex Trading Mastery · packages
        </p>
      </div>
      {/* Phones: three compact rows (name + price left, CTA right). sm+: three
          columns with the feature lines. Either way all three tiers fit the frame. */}
      <motion.div
        className="grid min-h-0 flex-1 gap-2.5 overflow-hidden p-4 sm:grid-cols-3 sm:gap-3 sm:p-5"
        initial="hidden"
        animate="show"
        variants={STAGGER}
      >
        {TIERS.map((tier) => (
          <motion.div
            key={tier.name}
            variants={itemVariants(ok)}
            className={
              tier.highlight
                ? "relative flex min-h-0 min-w-0 items-center gap-3 rounded-md border border-ws-brand/70 bg-ws-surface p-3 sm:flex-col sm:items-stretch sm:p-4"
                : "flex min-h-0 min-w-0 items-center gap-3 rounded-md border border-ws-hairline bg-ws-surface p-3 sm:flex-col sm:items-stretch sm:p-4"
            }
          >
            {tier.highlight && (
              <span className="absolute right-3 top-3 hidden rounded-full bg-ws-brand px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-ws-brand-on sm:inline-flex">
                Popular
              </span>
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ws-muted">{tier.name}</p>
              <p className="mt-0.5 font-display text-xl font-semibold tabular-nums text-ws-primary sm:mt-1 sm:text-2xl">
                ${tier.price}
              </p>
            </div>
            <ul className="mt-3 hidden space-y-1.5 sm:block">
              {tier.lines.map((line) => (
                <li key={line} className="flex items-center gap-2 text-[11px] text-ws-muted">
                  <CheckIcon size={11} className={tier.highlight ? "shrink-0 text-ws-gold" : "shrink-0 text-ws-subtle"} />
                  {line}
                </li>
              ))}
            </ul>
            <span
              className={
                tier.highlight
                  ? "ml-auto inline-flex h-8 shrink-0 items-center justify-center rounded-sm bg-ws-brand px-3 text-[11px] font-semibold text-ws-brand-on sm:ml-0 sm:mt-auto sm:px-0"
                  : "ml-auto inline-flex h-8 shrink-0 items-center justify-center rounded-sm border border-ws-hairline px-3 text-[11px] font-semibold text-ws-primary sm:ml-0 sm:mt-auto sm:px-0"
              }
            >
              {tier.highlight ? "Enrol now" : "Choose"}
            </span>
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
