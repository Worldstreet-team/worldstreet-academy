import type { Metadata } from "next"
import Link from "next/link"
import { fetchFaculty } from "@/lib/actions/student"
import { appUrl } from "@/lib/app-url"
import { BRAND } from "@/lib/brand"
import { FacultyCard } from "@/components/faculty/faculty-card"

/** Spec §10 intro, verbatim (brand casing per D1). */
const INTRO = `Behind every great learning experience is a great teacher. ${BRAND.name} brings together instructors and practitioners across technology, financial markets, digital business and creative industries.`

export const metadata: Metadata = {
  title: "Faculty",
  description: INTRO,
  alternates: { canonical: appUrl("/faculty") },
}

// Faculty follows roles, profile edits and publishing — never serve a stale list.
export const revalidate = 0

/**
 * `/faculty` — spec §10 as a page: the heading and intro, then every faculty
 * member (role INSTRUCTOR or ADMIN with at least one published program),
 * featured first.
 */
export default async function FacultyPage() {
  const faculty = await fetchFaculty()

  return (
    <div className="mx-auto max-w-7xl px-6 pb-24 pt-10 md:pb-32 md:pt-16">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ws-gold">Faculty</p>
      <h1
        className="mt-4 max-w-3xl font-display font-semibold leading-[1.05] tracking-[-0.02em] text-ws-primary"
        style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)" }}
      >
        Learn from experienced instructors
      </h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ws-muted md:text-[17px]">{INTRO}</p>

      <section className="mt-16 border-t border-ws-hairline pt-10" aria-labelledby="faculty-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="faculty-heading" className="font-display text-2xl font-semibold tracking-[-0.015em] text-ws-primary">
            Meet our faculty
          </h2>
          <span className="text-[13px] tabular-nums text-ws-subtle">
            {faculty.length === 1 ? "1 instructor" : `${faculty.length} instructors`}
          </span>
        </div>

        {faculty.length > 0 ? (
          <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {faculty.map((member) => (
              <li key={member.id}>
                <FacultyCard member={member} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-8 rounded-lg border border-dashed border-ws-hairline p-10 text-center">
            <p className="font-display text-lg font-semibold text-ws-primary">Faculty profiles are on the way</p>
            <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-ws-muted">
              Instructors appear here once their first program is published. Explore the programs in the meantime.
            </p>
            <Link
              href="/programs"
              className="mt-6 inline-flex h-11 items-center justify-center rounded-sm border border-ws-hairline px-6 text-[14px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:border-ws-brand/40 hover:text-ws-gold"
            >
              Explore programs
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}
