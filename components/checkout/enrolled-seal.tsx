"use client"

import { motion } from "motion/react"
import { EASE_INERTIA } from "@/components/marketing/motion/ease"
import { useMotionOK } from "@/components/marketing/motion/bus"

/**
 * Twelve sparks around the seal, alternating success green and brand gold.
 * Positions are whole pixels: the server and the browser print raw floats
 * differently, and a mismatched transform is a hydration error.
 */
const SPARKS = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * Math.PI * 2 - Math.PI / 2
  // Alternate lengths so the burst reads as a flourish, not a clock face.
  const long = i % 2 === 0
  const at = (r: number) => ({ x: Math.round(Math.cos(angle) * r), y: Math.round(Math.sin(angle) * r) })
  return {
    deg: i * 30,
    long,
    gold: i % 4 === 1 || i % 4 === 3,
    from: at(42),
    to: at(long ? 76 : 66),
  }
})

/**
 * The drawn seal on "Enrollment confirmed" — the one celebration in the
 * money flow, and it plays once: the ring draws, the tick lands, then a ring
 * of sparks bursts outward and a single ripple leaves the seal. Success green
 * because money moved the right way; the gold sparks are the brand's.
 * Reduced motion: the finished seal, still.
 */
export function EnrolledSeal() {
  const ok = useMotionOK()

  return (
    <div aria-hidden className="relative mx-auto size-[168px]">
      {/* The seal's own light — a static wash, never a loop. */}
      <span
        className="absolute inset-0 rounded-full"
        style={{ background: "radial-gradient(closest-side, var(--credit-chip), transparent 72%)" }}
      />

      {ok && (
        <>
          <motion.span
            className="absolute inset-[46px] rounded-full border-2 border-credit"
            initial={{ scale: 1, opacity: 0 }}
            animate={{ scale: [1, 1.9], opacity: [0.55, 0] }}
            transition={{ delay: 0.96, duration: 0.9, ease: EASE_INERTIA }}
          />
          {SPARKS.map((s, i) => {
            return (
              <motion.span
                key={i}
                className={s.gold ? "absolute left-1/2 top-1/2 rounded-full bg-ws-brand" : "absolute left-1/2 top-1/2 rounded-full bg-credit"}
                style={{ width: 3, height: s.long ? 12 : 8, marginLeft: -1.5, marginTop: s.long ? -6 : -4, rotate: s.deg }}
                initial={{ x: s.from.x, y: s.from.y, opacity: 0, scale: 0.4 }}
                animate={{
                  x: s.to.x,
                  y: s.to.y,
                  opacity: [0, 1, 0],
                  scale: [0.4, 1, 0.7],
                }}
                transition={{ delay: 0.94 + (i % 3) * 0.03, duration: 0.8, ease: EASE_INERTIA, times: [0, 0.35, 1] }}
              />
            )
          })}
        </>
      )}

      <motion.svg
        width="88"
        height="88"
        viewBox="0 0 72 72"
        fill="none"
        className="absolute left-1/2 top-1/2 -ml-[44px] -mt-[44px] text-credit"
        // In, hold while the ring and tick draw (globals.css), then one small
        // pop as the tick lands (~0.96s) — the beat the sparks leave on.
        initial={ok ? { scale: 0.86, opacity: 0 } : false}
        animate={{ scale: [0.86, 1, 1, 1.07, 1], opacity: 1 }}
        transition={{ duration: ok ? 1.25 : 0, times: [0, 0.26, 0.74, 0.84, 1], ease: "easeOut" }}
      >
        <circle cx="36" cy="36" r="28" className="fill-current opacity-[0.12]" />
        <circle
          cx="36"
          cy="36"
          r="28"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
          className="ws-seal-ring"
        />
        <path
          d="M24 37.5 32.5 46 49 28.5"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="ws-seal-tick"
        />
      </motion.svg>
    </div>
  )
}
