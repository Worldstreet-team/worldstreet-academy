"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Reveal, RevealGroup } from "@/components/marketing/motion/reveal"
import { dropDateLabel } from "@/components/marketing/course-card"
import type { BrowseCourse } from "@/lib/actions/student"

/**
 * §5 — UPCOMING DROPS. List rows for published courses with a future
 * `availableAt`: a UTC-pinned date block (dropDateLabel — the same util the
 * cards use), title, category + level, and the pre-enroll link. NO
 * thumbnails, ever. The section renders nothing when no drop is scheduled —
 * the Landing also guards this server-side.
 */
export function UpcomingDrops({ drops }: { drops: BrowseCourse[] }) {
  if (drops.length === 0) return null

  return (
    <section className="relative isolate py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <RevealGroup>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ws-gold">
            Upcoming drops
          </p>
          <h2
            className="mt-4 max-w-3xl font-display font-semibold leading-[1.05] tracking-[-0.02em] text-ws-primary"
            style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)" }}
          >
            On the calendar.
          </h2>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ws-muted">
            Scheduled releases. Where pre-enrollment is on, reserve a seat free
            and get an email the moment the course goes live.
          </p>
        </RevealGroup>

        <div className="mt-12">
          {drops.map((course, i) => {
            const isLast = i === drops.length - 1
            const [month, day] = dropDateLabel(course.availableAt!).split(" ")
            return (
              <Reveal key={course.id} delay={i * 0.07} y={18} duration={0.6}>
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
                  <Link
                    href={`/courses/${course.id}`}
                    className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
                  >
                    <div className="grid grid-cols-[auto_1fr] items-center gap-x-5 gap-y-3 py-5 sm:grid-cols-[auto_1fr_auto] md:gap-x-8 md:py-6">
                      {/* UTC-pinned date block */}
                      <span className="flex h-14 w-14 flex-col items-center justify-center rounded-lg border border-ws-hairline bg-ws-surface">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ws-gold">
                          {month}
                        </span>
                        <span className="font-display text-xl font-semibold leading-none tabular-nums text-ws-primary">
                          {day}
                        </span>
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-display text-lg font-semibold tracking-[-0.01em] text-ws-primary transition-colors duration-[var(--ws-motion-fast)] group-hover:text-ws-gold md:text-xl">
                          {course.title}
                        </span>
                        <span className="mt-1 block text-[13px] capitalize text-ws-muted">
                          {course.category ? `${course.category} · ` : ""}
                          {course.level}
                        </span>
                      </span>
                      <span className="col-span-2 text-[13px] font-semibold text-ws-gold transition-opacity duration-[var(--ws-motion-fast)] group-hover:opacity-80 sm:col-span-1">
                        {course.preEnrollEnabled
                          ? "Pre-enroll free →"
                          : "View course →"}
                      </span>
                    </div>
                  </Link>
                </div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
