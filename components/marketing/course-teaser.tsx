import { ArrowRightIcon } from "@/components/icons"
import Link from "next/link"

import type { BrowseCourse } from "@/lib/actions/student"
import { MarketingCourseCard } from "@/components/marketing/course-card"
import { Reveal, RevealGroup } from "@/components/marketing/motion/reveal"
import { SectionLabel, SectionTitle } from "@/components/marketing/section-heading"

/**
 * A short shelf of up to four course cards with a way to the full list —
 * the landing's marketplace ("Learn on your schedule") and New Economy
 * ("free") teasers (owner, 2026-10-05). The cards are the catalogue's own,
 * so a course looks the same wherever it is listed. Renders nothing when
 * there are no courses.
 */
export function CourseTeaser({
  id,
  label,
  title,
  body,
  href,
  linkLabel,
  courses,
  signedIn,
}: {
  id: string
  label: string
  title: string
  body: string
  href: string
  linkLabel: string
  courses: BrowseCourse[]
  signedIn: boolean
}) {
  if (courses.length === 0) return null
  const shown = courses.slice(0, 4)

  return (
    <section className="py-14 sm:py-20 md:py-28" aria-labelledby={`${id}-heading`}>
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
          <RevealGroup>
            <SectionLabel>{label}</SectionLabel>
            <SectionTitle id={`${id}-heading`} className="mt-4 max-w-2xl">
              {title}
            </SectionTitle>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ws-muted md:text-[16px]">{body}</p>
          </RevealGroup>
          <Link
            href={href}
            className="inline-flex items-center gap-1.5 rounded-sm text-[14px] font-semibold text-ws-primary underline decoration-ws-hairline underline-offset-4 transition-colors duration-[var(--ws-motion-fast)] hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
          >
            {linkLabel}
            <ArrowRightIcon size={15} aria-hidden />
          </Link>
        </div>

        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {shown.map((course, i) => (
            <Reveal as="li" key={course.id} delay={i * 0.06} y={20} duration={0.65}>
              <MarketingCourseCard course={course} signedIn={signedIn} />
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}
