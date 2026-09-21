"use client"

import * as React from "react"
import { AnimatePresence, motion, useIsPresent, type Variants } from "motion/react"
import { EASE_INERTIA } from "@/components/marketing/motion/ease"
import { BRAND } from "@/lib/brand"
import { SCHOOLS, type School } from "@/lib/schools"
import { cn } from "@/lib/utils"

/**
 * The hero's words — the claim (eyebrow + h1) and the sub-copy — showing
 * the default copy or the chosen school's.
 *
 * A change is a relay, not a cut: the outgoing words slide up and out of
 * their own masks in a quick bottom-up cascade, and the incoming ones rise
 * into theirs in reading order on a longer, staggered expo-out, starting as
 * the outgoing lines they would land on clear.
 * Every word is its own mask, so a school name of any length wraps naturally
 * and the cascade follows the reading order. The sub-copy follows a beat
 * later, as a fade and a short rise.
 *
 * Nothing below moves: the cell stacks every variant it can show (the
 * default and all eight schools) invisibly in one grid area, so it is always
 * as tall as its tallest variant, at every width.
 *
 * The variant on screen at load plays the page's load sequence (the old
 * LineMask timing); later ones play the swap. Reduced motion: opacity only.
 */

/**
 * Phones show only the first sentence: the second is what the picker right
 * under it asks, and dropping it helps bring the gold CTA onto a phone's
 * first screen.
 */
const DEFAULT_SUB = (
  <>
    Master practical, in-demand skills through expert-led programs designed for the new and modern economy.
    <span className="max-sm:hidden">
      {" "}
      Explore our schools, choose your path and start building capabilities you can apply in the real world.
    </span>
  </>
)

const LEAD = "School of "

/** Out: accelerate away — an ease-in that leaves at once (no EASE_EXIT crawl). */
const EASE_AWAY = [0.4, 0, 0.7, 0.2] as const

type Cue = { ok: boolean; delay: number; out: number }

const WORD: Variants = {
  hidden: ({ ok }: Cue) => (ok ? { y: "112%", opacity: 1 } : { y: "0%", opacity: 0 }),
  shown: ({ ok, delay }: Cue) =>
    ok
      ? { y: "0%", opacity: 1, transition: { duration: 0.95, ease: EASE_INERTIA, delay } }
      : { y: "0%", opacity: 1, transition: { duration: 0.25 } },
  gone: ({ ok, out }: Cue) =>
    ok
      ? {
          y: "-112%",
          opacity: 0,
          transition: { y: { duration: 0.34, ease: EASE_AWAY, delay: out }, opacity: { duration: 0.3, ease: "easeIn", delay: out } },
        }
      : { opacity: 0, transition: { duration: 0.2 } },
}

const PARA: Variants = {
  hidden: ({ ok }: Cue) => (ok ? { y: 16, opacity: 0 } : { y: 0, opacity: 0 }),
  shown: ({ ok, delay }: Cue) =>
    ok
      ? { y: 0, opacity: 1, transition: { duration: 0.75, ease: EASE_INERTIA, delay } }
      : { y: 0, opacity: 1, transition: { duration: 0.25 } },
  gone: ({ ok, out }: Cue) =>
    ok
      ? { y: -10, opacity: 0, transition: { duration: 0.3, ease: EASE_AWAY, delay: out } }
      : { opacity: 0, transition: { duration: 0.2 } },
}

/** When each variant's words begin to rise: with the page, or as a swap. */
const TIMING = {
  intro: { eyebrow: 0, head: 0.05, line: 0.09, word: 0.035, sub: 0.35 },
  swap: { eyebrow: 0.3, head: 0.3, line: 0.07, word: 0.045, sub: 0.46 },
}
/**
 * Gap between two outgoing words. The exit runs BOTTOM-UP (last word
 * first): a variant stands on the cell's foot, so the incoming copy lands
 * where the outgoing copy's last lines were — those clear first, and the
 * newcomer rises into empty masks rather than through the old words.
 */
const OUT_STEP = 0.02

type Line = { text: string; className?: string }

function headLines(school: School | null): Line[] {
  if (!school) {
    return [{ text: "Learn Skills." }, { text: "Build Value." }, { text: "Own Your Future.", className: "text-ws-gold" }]
  }
  const lead = school.name.startsWith(LEAD)
  return [
    ...(lead ? [{ text: LEAD.trim(), className: "font-light text-ws-muted" }] : []),
    { text: lead ? school.name.slice(LEAD.length) : school.name },
  ]
}

function eyebrow(school: School | null): string {
  if (!school) return BRAND.name
  const pad = (n: number) => String(n).padStart(2, "0")
  return `School ${pad(school.order)} of ${pad(SCHOOLS.length)}`
}

const EYEBROW = "text-[11px] font-medium uppercase tracking-[0.14em] text-ws-gold"
const H1_DEFAULT =
  "mt-5 max-w-4xl font-display text-[clamp(2.75rem,6.5vw,5.5rem)] font-semibold leading-[1.02] tracking-[-0.03em] text-ws-primary"
// lg narrows the name to the copy column; the picture stands right of it.
const H1_SCHOOL =
  "mt-5 max-w-3xl lg:max-w-xl xl:max-w-3xl font-display text-[clamp(2.25rem,4.4vw,4rem)] font-semibold leading-[1.04] tracking-[-0.03em] text-ws-primary"
const SUB = "max-w-xl text-[15px] leading-relaxed text-ws-muted md:text-lg xl:max-w-2xl"
const FACTS = "mt-3 text-[14px] leading-6 tabular-nums text-ws-primary/80"

/**
 * One word in its own mask. The mask's box is padded past the line box and
 * pulled back by an equal negative margin (layout untouched): at this
 * leading a plain overflow-hidden would shave descenders.
 */
function Word({ text, cue, className }: { text: string; cue: Cue | null; className?: string }) {
  return (
    <span className="-my-[0.14em] inline-block overflow-hidden py-[0.14em] align-top">
      {cue ? (
        <motion.span className={cn("inline-block", className)} variants={WORD} custom={cue}>
          {text}
        </motion.span>
      ) : (
        <span className={cn("inline-block", className)}>{text}</span>
      )}
    </span>
  )
}

function Words({ text, cue }: { text: string; cue: ((word: number) => Cue) | null }) {
  const words = text.split(" ")
  return (
    <>
      {words.map((w, i) => (
        <React.Fragment key={i}>
          <Word text={w} cue={cue ? cue(i) : null} />
          {i < words.length - 1 && " "}
        </React.Fragment>
      ))}
    </>
  )
}

/** `live` = the animated variant; otherwise a static, invisible sizer. */
function HeadContent({ school, ok, intro, live }: { school: School | null; ok: boolean; intro: boolean; live: boolean }) {
  const t = intro ? TIMING.intro : TIMING.swap
  const lines = headLines(school)
  // Where each line's words start in the whole headline, and how many there
  // are — the exit cascade runs bottom-up, from the last word.
  const starts = lines.map((_, i) => lines.slice(0, i).reduce((sum, l) => sum + l.text.split(" ").length, 0))
  const total = starts[lines.length - 1] + lines[lines.length - 1].text.split(" ").length
  const H = live ? "h1" : "p"
  return (
    <>
      <p className={EYEBROW}>
        <Words text={eyebrow(school)} cue={live ? () => ({ ok, delay: t.eyebrow, out: OUT_STEP * total }) : null} />
      </p>
      <H className={school ? H1_SCHOOL : H1_DEFAULT}>
        {lines.map((line, i) => (
          <span key={i} className={cn("block", line.className)}>
            <Words
              text={line.text}
              cue={
                live
                  ? (word) => ({
                      ok,
                      delay: t.head + i * t.line + word * t.word,
                      out: OUT_STEP * (total - 1 - (starts[i] + word)),
                    })
                  : null
              }
            />
          </span>
        ))}
      </H>
    </>
  )
}

function SubContent({
  school,
  facts,
  ok,
  intro,
  live,
}: {
  school: School | null
  facts: string | null
  ok: boolean
  intro: boolean
  live: boolean
}) {
  const text = school ? (school.tagline ?? school.blurb) : DEFAULT_SUB
  if (!live) {
    return (
      <>
        <p className={SUB}>{text}</p>
        {facts && <p className={FACTS}>{facts}</p>}
      </>
    )
  }
  const t = intro ? TIMING.intro : TIMING.swap
  return (
    <>
      <motion.p className={SUB} variants={PARA} custom={{ ok, delay: t.sub, out: 0 }}>
        {text}
      </motion.p>
      {facts && (
        <motion.p className={FACTS} variants={PARA} custom={{ ok, delay: t.sub + 0.1, out: 0.04 }}>
          {facts}
        </motion.p>
      )}
    </>
  )
}

type Styles = React.ComponentProps<typeof motion.div>["style"]

/**
 * The claim and its sub-copy, in one cell. The cell is as tall as the
 * tallest variant (the default, at every width we ship — a school's name is
 * set smaller), and each variant stands on the cell's FOOT: a shorter school
 * block sits directly over the chips it answers, and the slack goes above
 * its eyebrow rather than opening a hole between its name and its tagline.
 *
 * `headStyle` / `subStyle` carry the scroll hand-off (see hero-wall.tsx);
 * `subRef` marks where the default sub-copy sits, for its position-based fade.
 * `factsFor` must only state real figures.
 */
export function HeroCopy({
  school,
  ok,
  factsFor,
  headStyle,
  subStyle,
  subRef,
}: {
  school: School | null
  ok: boolean
  factsFor: (school: School) => string | null
  headStyle: Styles
  subStyle: Styles
  subRef: React.Ref<HTMLDivElement>
}) {
  const settled = useSettled()
  return (
    <div className="grid">
      {[null, ...SCHOOLS].map((s) => (
        <div key={s?.slug ?? "default"} aria-hidden className="invisible self-end [grid-area:1/1]">
          <HeadContent school={s} ok={ok} intro={false} live={false} />
          <div ref={s ? undefined : subRef} className="mt-5 sm:mt-6">
            <SubContent school={s} facts={s ? factsFor(s) : null} ok={ok} intro={false} live={false} />
          </div>
        </div>
      ))}
      <AnimatePresence initial>
        <Variant key={school?.slug ?? "default"} intro={!settled}>
          {(intro) => (
            <>
              <motion.div className="origin-[0%_70%]" style={headStyle}>
                <HeadContent school={school} ok={ok} intro={intro} live />
              </motion.div>
              <motion.div className="mt-5 sm:mt-6" style={subStyle}>
                <SubContent school={school} facts={school ? factsFor(school) : null} ok={ok} intro={intro} live />
              </motion.div>
            </>
          )}
        </Variant>
      </AnimatePresence>
    </div>
  )
}

/**
 * One variant in its cell. On its way out it is hidden from assistive tech
 * and stops taking the pointer, so the page never briefly holds two live
 * headings. `intro` is frozen at mount: a variant that arrived with the page
 * keeps the load timing even after the page settles.
 */
function Variant({ intro, children }: { intro: boolean; children: (intro: boolean) => React.ReactNode }) {
  const present = useIsPresent()
  const [arrivedWithPage] = React.useState(intro)
  return (
    <motion.div
      className={cn("self-end [grid-area:1/1]", !present && "pointer-events-none")}
      aria-hidden={!present || undefined}
      initial="hidden"
      animate="shown"
      exit="gone"
    >
      {children(arrivedWithPage)}
    </motion.div>
  )
}

/** False on the first render (the page's load sequence), true from then on. */
function useSettled() {
  const [settled, setSettled] = React.useState(false)
  React.useEffect(() => setSettled(true), [])
  return settled
}
