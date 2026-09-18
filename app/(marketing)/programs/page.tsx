import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { ArrowRightIcon } from "lucide-react"
import { SCHOOLS, type School, type SchoolSlug } from "@/lib/schools"
import { schoolCover } from "@/lib/school-art"
import { BRAND } from "@/lib/brand"
import { appUrl } from "@/lib/app-url"
import { fetchBrowseCourses, type BrowseCourse } from "@/lib/actions/student"
import { getCachedUser } from "@/lib/auth/cached"
import { MarketingCourseCard } from "@/components/marketing/course-card"
import { cn } from "@/lib/utils"

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
          className="rise mt-14 grid gap-5 border-t border-ws-hairline pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"
          aria-labelledby={`school-${school.slug}`}
        >
          <SchoolPanel school={school} count={programs.length} />
          <ul className="grid content-start gap-5 sm:grid-cols-2">
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

/**
 * A school's face beside its programs. With one to three programs per school a
 * bare three-column grid is mostly air; the cover fills it and says where you
 * are. From lg it sticks while a longer list scrolls past. No gold here — a
 * page of eight gold buttons would have no primary action.
 */
function SchoolPanel({ school, count }: { school: School; count: number }) {
  const cover = schoolCover(school.slug)
  return (
    <div className="relative flex min-h-[18rem] flex-col justify-end overflow-hidden rounded-[20px] bg-ws-surface p-6 lg:sticky lg:top-24 lg:self-start">
      {cover && (
        <>
          <Image
            src={cover}
            alt=""
            fill
            sizes="(max-width: 1024px) 100vw, 33vw"
            className="object-cover object-[85%_15%]"
          />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
        </>
      )}
      <div className={cn("relative", cover ? "max-w-[68%] text-white" : "text-ws-primary")}>
        <h2 id={`school-${school.slug}`} className="font-display text-2xl font-semibold tracking-[-0.015em]">
          {school.name}
        </h2>
        <p className={cn("mt-2 text-[14px] leading-relaxed", cover ? "text-white/80" : "text-ws-muted")}>
          {school.tagline ?? school.blurb}
        </p>
        <p className={cn("mt-3 text-[13px] tabular-nums", cover ? "text-white/70" : "text-ws-subtle")}>
          {count === 1 ? "1 program" : `${count} programs`}
        </p>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-semibold">
          <Link href={`/dashboard/start?school=${school.slug}`} className="inline-flex items-center gap-1 hover:underline">
            Start with this school
            <ArrowRightIcon size={14} aria-hidden />
          </Link>
          <Link href={`/schools/${school.slug}`} className={cn("hover:underline", cover ? "text-white/80" : "text-ws-muted")}>
            About this school
          </Link>
        </div>
      </div>
    </div>
  )
}
