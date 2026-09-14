import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import type { FacultyMember } from "@/lib/actions/student"
import { BRAND } from "@/lib/brand"
import { FacultyCard } from "@/components/faculty/faculty-card"
import { Reveal, RevealGroup } from "@/components/marketing/motion/reveal"

/**
 * LEARN FROM EXPERIENCED INSTRUCTORS (spec §10) on the homepage: the heading
 * and intro verbatim, up to four faculty cards and [VIEW FACULTY]. Renders
 * nothing when there is no faculty — the landing never shows an empty section.
 */
export function FacultyTeaser({ faculty }: { faculty: FacultyMember[] }) {
  if (faculty.length === 0) return null

  return (
    <section id="faculty" className="relative scroll-mt-24 py-24 md:py-32" aria-labelledby="faculty-teaser-heading">
      <div className="mx-auto max-w-7xl px-6">
        <RevealGroup>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ws-gold">Faculty</p>
          <h2
            id="faculty-teaser-heading"
            className="mt-4 max-w-3xl font-display font-semibold leading-[1.05] tracking-[-0.02em] text-ws-primary"
            style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)" }}
          >
            Learn from experienced instructors
          </h2>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ws-muted md:text-[17px]">
            Behind every great learning experience is a great teacher. {BRAND.name} brings together
            instructors and practitioners across technology, financial markets, digital business and
            creative industries.
          </p>
        </RevealGroup>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-3">
          <p className="font-display text-xl font-semibold tracking-[-0.01em] text-ws-primary">Meet our faculty</p>
          <Link
            href="/faculty"
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-sm border border-ws-hairline px-6 text-[14px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:border-ws-brand/40"
          >
            View faculty
            <ArrowRightIcon size={14} aria-hidden />
          </Link>
        </div>

        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
