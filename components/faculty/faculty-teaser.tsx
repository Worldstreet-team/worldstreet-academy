import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import type { FacultyMember } from "@/lib/actions/student"
import { BRAND } from "@/lib/brand"
import { FacultyCard } from "@/components/faculty/faculty-card"
import { Reveal, RevealGroup } from "@/components/marketing/motion/reveal"
import { SectionLabel, SectionTitle } from "@/components/marketing/section-heading"

/**
 * LEARN FROM EXPERIENCED INSTRUCTORS (spec §10) on the homepage: the heading
 * and intro verbatim, "Meet our faculty" with [VIEW FACULTY] on one line, and
 * up to four faculty cards. The grid uses auto-fill, so a single instructor
 * keeps a card's width instead of stretching across the row or floating alone
 * in a four-column frame. Renders nothing when there is no faculty — the
 * landing never shows an empty section.
 */
export function FacultyTeaser({ faculty }: { faculty: FacultyMember[] }) {
  if (faculty.length === 0) return null

  return (
    <section id="faculty" className="relative scroll-mt-24 py-20 md:py-28" aria-labelledby="faculty-teaser-heading">
      <div className="mx-auto max-w-7xl px-6">
        <RevealGroup>
          <SectionLabel>Faculty</SectionLabel>
          <SectionTitle id="faculty-teaser-heading" className="mt-4 max-w-2xl">
            Learn from experienced instructors
          </SectionTitle>
          <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-ws-muted md:text-[17px]">
            Behind every great learning experience is a great teacher. {BRAND.name} brings together
            instructors and practitioners across technology, financial markets, digital business and
            creative industries.
          </p>
        </RevealGroup>

        <Reveal className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-ws-hairline pt-6 md:mt-12">
          <p className="font-display text-lg font-semibold tracking-[-0.01em] text-ws-primary">Meet our faculty</p>
          <Link
            href="/faculty"
            className="group inline-flex items-center gap-1.5 text-[14px] font-semibold text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
          >
            View faculty
            <ArrowRightIcon size={14} aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </Reveal>

        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]">
          {faculty.slice(0, 4).map((member, i) => (
            <Reveal as="li" key={member.id} delay={i * 0.06} y={20} duration={0.6}>
              <FacultyCard member={member} />
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}
