import Link from "next/link"
import Image from "next/image"
import { ArrowRightIcon } from "lucide-react"
import type { BrowseCourse } from "@/lib/actions/student"
import { courseAvailability } from "@/lib/types/course"
import { levelChipStyle } from "@/components/shared/level-badge"
import { SCHOOL_BY_SLUG } from "@/lib/schools"
import { SchoolIcon } from "@/components/shared/school-icon"
import { programPriceLabel } from "@/lib/program-price"

/**
 * One program on a school page (spec §5): title, blurb, level, price and the
 * [VIEW PROGRAM] affordance. The whole row is the link. Links to the program page.
 */
export function ProgramRow({ course }: { course: BrowseCourse }) {
  const comingSoon =
    courseAvailability({ status: "published", availableAt: course.availableAt }) === "coming_soon"

  return (
    <li>
      <Link
        href={`/programs/${course.slug}`}
        className="group grid gap-5 rounded-lg border border-ws-hairline bg-ws-surface p-5 transition-colors duration-[var(--ws-motion-base)] hover:border-ws-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 sm:grid-cols-[9rem_1fr] sm:p-6"
      >
        <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-md bg-ws-sunken sm:aspect-[4/3]">
          {course.thumbnailUrl ? (
            <Image
              src={course.thumbnailUrl}
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, 9rem"
              className="object-cover"
            />
          ) : (
            // No art yet: the school's icon in a gold wash, never an empty box.
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ws-brand/10 text-ws-gold">
              <SchoolIcon
                name={course.school ? SCHOOL_BY_SLUG[course.school].icon : "graduation-cap"}
                size={20}
              />
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-medium capitalize"
              style={levelChipStyle(course.level)}
            >
              {course.level}
            </span>
            {comingSoon && (
              <span className="rounded-full bg-ws-chip px-2 py-0.5 text-[11px] font-medium text-ws-muted">
                Coming soon
              </span>
            )}
          </div>
          <h3 className="mt-3 font-display text-xl font-semibold tracking-[-0.01em] text-ws-primary">
            {course.title}
          </h3>
          <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-ws-muted">
            {course.shortDescription ?? course.description}
          </p>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
            <span className="text-[14px] font-semibold tabular-nums text-ws-primary">
              {programPriceLabel(course)}
            </span>
            <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ws-gold">
              View program
              <ArrowRightIcon
                size={14}
                aria-hidden
                className="transition-transform duration-200 group-hover:translate-x-0.5"
              />
            </span>
          </div>
        </div>
      </Link>
    </li>
  )
}
