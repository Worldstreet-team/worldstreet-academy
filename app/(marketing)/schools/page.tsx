import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRightIcon, CompassIcon } from "lucide-react"
import { SCHOOLS, countProgramsBySchool } from "@/lib/schools"
import { fetchBrowseCourses } from "@/lib/actions/student"
import { BRAND } from "@/lib/brand"
import { appUrl } from "@/lib/app-url"
import { SchoolCard } from "@/components/marketing/school-card"

export const metadata: Metadata = {
  title: "Schools",
  description:
    "Your future can take many directions. Choose the school that matches your interests, goals and ambitions.",
  alternates: { canonical: appUrl("/schools") },
}

// Program counts come from the live catalogue.
export const revalidate = 0

/** Cards step in 45ms apart, so the grid reads left-to-right on arrival. */
const STAGGER_MS = 45

/** `/schools` — spec §4 as a page: the eight schools with live program counts. */
export default async function SchoolsPage() {
  const courses = await fetchBrowseCourses()
  const counts = countProgramsBySchool(courses)

  return (
    <div className="mx-auto max-w-7xl px-6 pb-24 pt-10 md:pb-32 md:pt-16">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ws-gold">Our schools</p>
      <h1
        className="mt-4 max-w-3xl font-display font-semibold leading-[1.05] tracking-[-0.02em] text-ws-primary"
        style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)" }}
      >
        Explore the Schools of {BRAND.name}
      </h1>
      <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ws-muted md:text-[17px]">
        Your future can take many directions. Choose the school that matches your
        interests, goals and ambitions.
      </p>

      {/* Three across on desktop: eight schools plus the closing tile fill a
          clean 3x3. Each card rises on a stagger and carries its own hover
          gesture (see "one signature motion per school" in globals.css). */}
      <ul className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {SCHOOLS.map((school, i) => (
          <li
            key={school.slug}
            className="rise"
            style={{ "--rise-delay": `${i * STAGGER_MS}ms` } as React.CSSProperties}
          >
            <SchoolCard school={school} count={counts[school.slug]} headingLevel="h2" />
          </li>
        ))}

        {/* Ninth tile — the way out for anyone who does not want to pick a
            school first. Quieter than a school card (sunken, not surface) so
            it closes the grid without competing with it. */}
        <li
          className="rise"
          style={{ "--rise-delay": `${SCHOOLS.length * STAGGER_MS}ms` } as React.CSSProperties}
        >
          <Link
            href="/programs"
            data-school="browse-all"
            className="ws-school group flex h-full flex-col rounded-[20px] border border-ws-hairline bg-ws-sunken p-7 transition-colors duration-[var(--ws-motion-base)] hover:bg-ws-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ws-brand/[0.12] text-ws-gold transition-colors duration-[var(--ws-motion-base)] group-hover:bg-ws-brand/[0.18]">
              <span className="ws-school-glyph">
                <CompassIcon size={20} />
              </span>
            </span>
            <h2 className="mt-6 font-display text-[18px] font-semibold leading-snug tracking-[-0.01em] text-ws-primary">
              Not sure where to start?
            </h2>
            <p className="mb-7 mt-2.5 text-[14px] leading-relaxed text-ws-muted">
              See every program in one list, across all eight schools, and compare
              what each one covers before you choose.
            </p>
            <span className="mt-auto flex items-center justify-between gap-3 border-t border-ws-hairline pt-5 text-[13px]">
              <span className="tabular-nums text-ws-muted">
                {courses.length === 1 ? "1 program" : `${courses.length} programs`}
              </span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-ws-gold">
                Browse all
                <ArrowRightIcon
                  size={14}
                  aria-hidden
                  className="transition-transform duration-200 group-hover:translate-x-0.5"
                />
              </span>
            </span>
          </Link>
        </li>
      </ul>
    </div>
  )
}
