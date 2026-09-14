import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import { SCHOOLS, type SchoolSlug } from "@/lib/schools"
import { BRAND } from "@/lib/brand"
import { appUrl } from "@/lib/app-url"
import { fetchBrowseCourses, type BrowseCourse } from "@/lib/actions/student"
import { getCachedUser } from "@/lib/auth/cached"
import { MarketingCourseCard } from "@/components/marketing/course-card"
import { SchoolIcon } from "@/components/shared/school-icon"

export const metadata: Metadata = {
  title: "Programs",
  description: `Browse every program across the eight schools of ${BRAND.name}.`,
  alternates: { canonical: appUrl("/programs") },
}

// Published/coming-soon state changes under a cached render.
export const revalidate = 0

/**
 * `/programs` — the whole catalogue, grouped by school in school order
 * (spec §4/§17). Schools with no published program are hidden; published
 * courses not yet assigned to a school (legacy rows) land in a trailing
 * "More programs" group so nothing published disappears.
 */
export default async function ProgramsPage() {
  const [user, courses] = await Promise.all([getCachedUser(), fetchBrowseCourses()])
  const signedIn = Boolean(user)

  const bySchool = new Map<SchoolSlug | null, BrowseCourse[]>()
  for (const course of courses) {
    const list = bySchool.get(course.school) ?? []
    list.push(course)
    bySchool.set(course.school, list)
  }
  const groups = [...SCHOOLS]
    .sort((a, b) => a.order - b.order)
    .map((school) => ({ school, courses: bySchool.get(school.slug) ?? [] }))
    .filter((group) => group.courses.length > 0)
  const unassigned = bySchool.get(null) ?? []

  return (
    <div className="mx-auto max-w-7xl px-6 pb-24 pt-10 md:pb-32 md:pt-16">
      <header className="max-w-3xl">
        <h1
          className="font-display font-semibold leading-[1.05] tracking-[-0.02em] text-ws-primary"
          style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)" }}
        >
          All programs
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ws-muted md:text-[17px]">
          Browse every program across the eight schools of {BRAND.name}.
        </p>
        <p className="mt-3 text-[13px] tabular-nums text-ws-subtle">
          {courses.length === 1 ? "1 program" : `${courses.length} programs`}
        </p>
      </header>

      {groups.map(({ school, courses: programs }) => (
        <section
          key={school.slug}
          className="mt-16 border-t border-ws-hairline pt-10"
          aria-labelledby={`school-${school.slug}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              id={`school-${school.slug}`}
              className="flex items-center gap-3 font-display text-2xl font-semibold tracking-[-0.015em] text-ws-primary"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ws-brand/10 text-ws-gold">
                <SchoolIcon name={school.icon} size={17} />
              </span>
              {school.name}
            </h2>
            <Link
              href={`/schools/${school.slug}`}
              className="inline-flex items-center gap-1 text-[13px] font-semibold text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-gold"
            >
              About this school
              <ArrowRightIcon size={14} aria-hidden />
            </Link>
          </div>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {programs.map((course) => (
              <li key={course.id}>
                <MarketingCourseCard course={course} signedIn={signedIn} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {unassigned.length > 0 && (
        <section className="mt-16 border-t border-ws-hairline pt-10" aria-labelledby="school-more">
          <h2 id="school-more" className="font-display text-2xl font-semibold tracking-[-0.015em] text-ws-primary">
            More programs
          </h2>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {unassigned.map((course) => (
              <li key={course.id}>
                <MarketingCourseCard course={course} signedIn={signedIn} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {courses.length === 0 && (
        <div className="mt-16 rounded-lg border border-dashed border-ws-hairline p-10 text-center">
          <p className="font-display text-lg font-semibold text-ws-primary">Programs coming soon</p>
          <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-ws-muted">
            The first programs are being prepared. Explore the schools in the meantime.
          </p>
          <Link
            href="/schools"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-sm border border-ws-hairline px-6 text-[14px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:border-ws-brand/40 hover:text-ws-gold"
          >
            Explore the schools
          </Link>
        </div>
      )}
    </div>
  )
}
