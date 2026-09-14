import type { Metadata } from "next"
import { SCHOOLS, countProgramsBySchool } from "@/lib/schools"
import { fetchBrowseCourses } from "@/lib/actions/student"
import { BRAND } from "@/lib/brand"
import { SchoolCard } from "@/components/marketing/school-card"

export const metadata: Metadata = {
  title: "Schools",
  description:
    "Your future can take many directions. Choose the school that matches your interests, goals and ambitions.",
}

// Program counts come from the live catalogue.
export const revalidate = 0

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

      <ul className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SCHOOLS.map((school) => (
          <li key={school.slug}>
            <SchoolCard school={school} count={counts[school.slug]} headingLevel="h2" />
          </li>
        ))}
      </ul>
    </div>
  )
}
