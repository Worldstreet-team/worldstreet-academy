"use client"

import * as React from "react"
import { motion } from "motion/react"
import { PlusIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Reveal, RevealGroup } from "@/components/marketing/motion/reveal"
import { SectionLabel, SectionTitle } from "@/components/marketing/section-heading"
import { EASE_LUX } from "@/components/marketing/motion/ease"
import { useMotionOK } from "@/components/marketing/motion/bus"
import { BRAND } from "@/lib/brand"

/**
 * FAQ (spec §15). Split layout: sticky heading column left, accordion right.
 * Native button rows over hairline dividers; answers are height-animated
 * (instant under reduced motion) and the plus icon rotates 45° into an ×.
 * An open row's question stays ink; closed rows lift from muted to ink on
 * hover, so the list reads as a list and the open one as the page.
 *
 * Copy is spec §15 verbatim.
 */

const FAQS = [
  {
    q: `Who can join ${BRAND.name}?`,
    a: "Anyone who wants to develop practical knowledge and skills can explore our programs, subject to the requirements of individual courses.",
  },
  {
    q: "Do I need previous experience?",
    a: "Many programs are designed for beginners. Individual program pages will specify prerequisites where necessary.",
  },
  {
    q: "Are classes online?",
    a: `Programs can be delivered through the ${BRAND.name} LMS using the format specified on each program page.`,
  },
  {
    q: "Can I learn more than one course?",
    a: "Yes. Students can enrol in multiple programs where available.",
  },
  {
    q: "Do I receive a certificate?",
    a: "Eligible programs may provide certificates upon meeting their completion requirements.",
  },
  {
    q: "Can I pay online?",
    a: "Yes. The platform provides secure payment options available to the student's country.",
  },
  {
    q: "What happens after payment?",
    a: "Your enrollment is confirmed and your course access becomes available according to the program's delivery schedule.",
  },
] as const

export function Faq() {
  const ok = useMotionOK()
  const [open, setOpen] = React.useState<number | null>(null)

  return (
    <section id="faq" className="relative isolate scroll-mt-24 py-20 md:py-28" aria-labelledby="faq-heading">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
        {/* ── Heading column ── */}
        <div>
          <div className="lg:sticky lg:top-28">
            <RevealGroup>
              <SectionLabel>FAQ</SectionLabel>
              <SectionTitle id="faq-heading" className="mt-4 max-w-md">
                Answers before
                <br />
                you ask.
              </SectionTitle>
              <p className="mt-4 max-w-sm text-[16px] leading-relaxed text-ws-muted md:text-[17px]">
                The short version of how joining, learning, paying and
                certificates work here.
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
                    className={cn(
                      "flex w-full items-center justify-between gap-6 py-6 text-left transition-colors duration-[var(--ws-motion-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40",
                      expanded ? "text-ws-primary" : "text-ws-primary/80 hover:text-ws-primary"
                    )}
                  >
                    <span className="font-display text-[16px] font-semibold tracking-[-0.01em] md:text-[18px]">
                      {faq.q}
                    </span>
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full transition-colors duration-[var(--ws-motion-fast)]",
                        expanded ? "bg-ws-raised text-ws-primary" : "text-ws-muted"
                      )}
                    >
                      <PlusIcon
                        size={16}
                        aria-hidden
                        className={cn(
                          "transition-transform duration-200 ease-[var(--ws-ease)]",
                          expanded && "rotate-45"
                        )}
                      />
                    </span>
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
                    <p className="max-w-xl pb-6 pr-12 text-[15px] leading-relaxed text-ws-muted">
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
