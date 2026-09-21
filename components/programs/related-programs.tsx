import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import type { BrowseCourse } from "@/lib/actions/student"
import type { School } from "@/lib/schools"
import { MarketingCourseCard } from "@/components/marketing/course-card"
import { PROGRAM_H2 } from "@/components/programs/section-title"

/**
 * Where to go next: up to four other published programs — from this
 * program's school when it has siblings ("More from <School>"), otherwise
 * from the whole catalogue ("More programs"). The cards are the catalogue's
 * own (`/programs`), so a program looks the same wherever it is listed.
 * Nothing renders when there is nothing else to show.
 */
export function RelatedPrograms({
  programs,
  school,
  signedIn,
}: {
  programs: BrowseCourse[]
  /** Set when `programs` all come from this school. */
  school: School | null
  signedIn: boolean
}) {
  if (programs.length === 0) return null
  const href = school ? `/schools/${school.slug}` : "/programs"

  return (
    <section aria-labelledby="related-heading">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <h2 id="related-heading" className={PROGRAM_H2}>
          {school ? `More from ${school.short}` : "More programs"}
        </h2>
        <Link
          href={href}
          className="inline-flex items-center gap-1.5 rounded-sm text-[14px] font-semibold text-ws-primary underline decoration-ws-hairline underline-offset-4 transition-colors duration-[var(--ws-motion-fast)] hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
        >
          {school ? "View the school" : "Browse all programs"}
          <ArrowRightIcon size={15} aria-hidden />
        </Link>
      </div>
      {/* Phones: a swipeable row (four stacked cards would be a page of
          their own); from sm a grid. */}
      <ul className="no-scrollbar -mx-6 mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-6 px-6 pb-1 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
        {programs.map((course) => (
          <li key={course.id} className="w-[78%] shrink-0 snap-start sm:w-auto">
            <MarketingCourseCard course={course} signedIn={signedIn} />
          </li>
        ))}
      </ul>
    </section>
  )
}
