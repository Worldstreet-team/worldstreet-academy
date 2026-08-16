"use client"

import * as React from "react"
import { motion } from "motion/react"
import { PlusIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Reveal, RevealGroup } from "@/components/marketing/motion/reveal"
import { EASE_LUX } from "@/components/marketing/motion/ease"
import { useMotionOK } from "@/components/marketing/motion/bus"

/**
 * §9 — FAQ. Split layout: sticky heading column left, accordion right.
 * Native button rows over hairline dividers; answers are height-animated
 * (instant under reduced motion) and the plus icon rotates 45° into an ×.
 *
 * Every answer is grounded in the shipped product — wallet-balance checkout
 * (lib/actions/enrollments.purchaseCourse), free courses, course levels and
 * free-preview lessons, timed exams with a per-course pass mark, signed PDF
 * certificates, free pre-enrollment on scheduled drops, and the dashboard's
 * Become an Instructor application. No invented numbers, no invented policy.
 */

const FAQS = [
  {
    q: "How do I pay for a course?",
    a: "Paid courses are bought with your WorldStreet wallet balance — there's no separate card checkout inside the academy. Free courses cost nothing: enroll and start.",
  },
  {
    q: "I'm new to trading. Is this for me?",
    a: "Yes — every course is labeled beginner, intermediate or advanced, and instructors can open lessons as free previews so you can try a course before you commit.",
  },
  {
    q: "How do exams work?",
    a: "A course exam is a timed sitting with a pass mark set by the instructor. Passing it unlocks your course completion.",
  },
  {
    q: "Do I get a certificate?",
    a: "Once you pass, your certificate of completion is issued — signed by you and your instructor, and downloadable as a PDF to share.",
  },
  {
    q: "What does a scheduled drop mean?",
    a: "Some courses are published ahead of their release date. When pre-enrollment is on, you reserve a seat free before launch — you only pay when it goes live and you start.",
  },
  {
    q: "Can I teach on WorldStreet Academy?",
    a: "Yes — apply from the Become an Instructor page in your dashboard. Once approved, you can build courses and run live sessions of your own.",
  },
] as const

export function Faq() {
  const ok = useMotionOK()
  const [open, setOpen] = React.useState<number | null>(null)

  return (
    <section className="relative isolate py-24 md:py-32" aria-label="Frequently asked questions">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
        {/* ── Heading column ── */}
        <div>
          <div className="lg:sticky lg:top-24">
            <RevealGroup>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ws-gold">
                FAQ
              </p>
              <h2
                className="mt-4 max-w-md font-display font-semibold leading-[1.05] tracking-[-0.02em] text-ws-primary"
                style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)" }}
              >
                Answers before you ask.
              </h2>
              <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-ws-muted">
                The short version of how paying, learning, exams and teaching
                work here.
              </p>
            </RevealGroup>
          </div>
        </div>

        {/* ── Accordion column ── */}
        <div>
          {FAQS.map((faq, i) => {
            const expanded = open === i
            return (
              <Reveal key={faq.q} delay={i * 0.05} y={14} duration={0.55}>
                <div
                  className={cn(
                    "border-t border-ws-hairline",
                    i === FAQS.length - 1 && "border-b"
                  )}
                >
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={`faq-panel-${i}`}
                    onClick={() => setOpen((prev) => (prev === i ? null : i))}
                    className="flex w-full items-center justify-between gap-6 py-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
                  >
                    <span className="text-[15px] font-semibold text-ws-primary md:text-base">
                      {faq.q}
                    </span>
                    <PlusIcon
                      size={16}
                      aria-hidden
                      className={cn(
                        "shrink-0 text-ws-muted transition-transform duration-200 ease-[var(--ws-ease)]",
                        expanded && "rotate-45"
                      )}
                    />
                  </button>
                  <motion.div
                    id={`faq-panel-${i}`}
                    className="overflow-hidden"
                    initial={false}
                    animate={{
                      height: expanded ? "auto" : 0,
                      opacity: expanded ? 1 : 0,
                    }}
                    transition={{ duration: ok ? 0.3 : 0, ease: EASE_LUX }}
                  >
                    <p className="max-w-xl pb-5 pr-8 text-[14px] leading-relaxed text-ws-muted">
                      {faq.a}
                    </p>
                  </motion.div>
                </div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
