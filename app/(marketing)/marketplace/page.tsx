import { ArrowRightIcon, SearchIcon, StoreIcon } from "@/components/icons"
import type { Metadata } from "next"
import Link from "next/link"

import { BRAND } from "@/lib/brand"
import { appUrl } from "@/lib/app-url"
import { SCHOOLS, SCHOOL_BY_SLUG, countProgramsBySchool, schoolSlugOf } from "@/lib/schools"
import { fetchBrowseCourses, type BrowseCourse } from "@/lib/actions/student"
import { getCachedUser } from "@/lib/auth/cached"
import { MARKETPLACE_SHARE_ACADEMY, MARKETPLACE_SHARE_OWN_LINK } from "@/lib/db/models"
import {
  isMarketplaceSort,
  marketplaceHref,
  sharePercent,
  type MarketplaceFilterValues,
} from "@/lib/marketplace"
import { MarketingCourseCard } from "@/components/marketing/course-card"
import { MarketplaceFilters } from "@/components/marketplace/marketplace-filters"

export const metadata: Metadata = {
  title: "Marketplace",
  description: `Pre-recorded courses from practitioners, quality-reviewed by ${BRAND.name}. Learn on your schedule.`,
  alternates: { canonical: appUrl("/marketplace") },
}

// Publishing and reviews change the shelf under a cached render.
export const revalidate = 0

type Search = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

function readFilters(params: Record<string, string | string[] | undefined>): MarketplaceFilterValues {
  const school = first(params.school)
  const price = first(params.price)
  const level = first(params.level)
  const sort = first(params.sort)
  return {
    q: (first(params.q) ?? "").trim().replace(/\s+/g, " ").slice(0, 80),
    school: schoolSlugOf(school) ?? "",
    price: price === "free" || price === "paid" ? price : "",
    level: level === "beginner" || level === "intermediate" || level === "advanced" ? level : "",
    sort: isMarketplaceSort(sort) ? sort : "popular",
  }
}

const isFree = (c: BrowseCourse) => c.pricing === "free" || !c.price

/** Every word must appear in the title, the blurb, the topic or the seller's name. */
function matches(course: BrowseCourse, words: string[]): boolean {
  const school = course.school ? SCHOOL_BY_SLUG[course.school] : null
  const haystack = [course.title, course.shortDescription, school?.name, school?.short, course.sellerName]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
  return words.every((word) => haystack.includes(word))
}

function sortCourses(courses: BrowseCourse[], sort: MarketplaceFilterValues["sort"]): BrowseCourse[] {
  const time = (iso: string | null) => (iso ? new Date(iso).getTime() : 0)
  const price = (c: BrowseCourse) => (isFree(c) ? 0 : (c.price ?? 0))
  const sorted = [...courses]
  switch (sort) {
    case "rating":
      return sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.enrolledCount - a.enrolledCount)
    case "newest":
      return sorted.sort((a, b) => time(b.publishedAt) - time(a.publishedAt))
    case "price-low":
      return sorted.sort((a, b) => price(a) - price(b))
    case "price-high":
      return sorted.sort((a, b) => price(b) - price(a))
    default:
      // fetchBrowseCourses already orders by enrolments, then newest.
      return sorted
  }
}

/**
 * `/marketplace` — the Academy Marketplace (owner meeting 2026-10-03): pre-
 * recorded courses from approved sellers and from the Academy's own faculty,
 * each quality-reviewed before it is published. Udemy's shape in the house
 * style: one line of promise, search, four filters (topic = the course's
 * school, price, level, sort), the card grid, and the way in for sellers.
 * Filtering happens here on the server from the URL; lists published
 * marketplace courses only.
 */
export default async function MarketplacePage({ searchParams }: Search) {
  const [user, catalogue, params] = await Promise.all([
    getCachedUser(),
    fetchBrowseCourses({ kind: "marketplace" }),
    searchParams,
  ])
  const signedIn = Boolean(user)
  const filters = readFilters(params)

  const words = filters.q.toLowerCase().split(" ").filter(Boolean)
  const filtered = catalogue.filter(
    (c) =>
      (!filters.school || c.school === filters.school) &&
      (!filters.price || (filters.price === "free" ? isFree(c) : !isFree(c))) &&
      (!filters.level || c.level === filters.level) &&
      (words.length === 0 || matches(c, words))
  )
  const courses = sortCourses(filtered, filters.sort)

  const counts = countProgramsBySchool(catalogue)
  // Topics with a course on the shelf — plus the one in the URL, so the select can show it.
  const topics = SCHOOLS.filter((s) => counts[s.slug] > 0 || s.slug === filters.school).map((s) => ({
    slug: s.slug,
    label: s.short,
    count: counts[s.slug],
  }))
  const filtering = Boolean(filters.q || filters.school || filters.price || filters.level)

  return (
    <div className="mx-auto max-w-7xl px-6 pb-24 pt-10 md:pb-32 md:pt-16">
      <header className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="max-w-3xl">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ws-muted">Academy Marketplace</p>
          <h1
            className="mt-3 font-display font-semibold leading-[1.05] tracking-[-0.02em] text-ws-primary"
            style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)" }}
          >
            Learn from practitioners — on your schedule
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ws-muted md:text-[17px]">
            Pre-recorded courses from people who do the work, each one reviewed by our team before it goes live. Buy
            once, learn at your own pace.
          </p>
        </div>
        <Link
          href="/sell"
          className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-full border border-ws-hairline px-5 text-[14px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-surface lg:self-end"
        >
          <StoreIcon size={16} aria-hidden />
          Sell your course
        </Link>
      </header>

      {catalogue.length > 0 && (
        <MarketplaceFilters key={marketplaceHref(filters)} values={filters} topics={topics} className="mt-10" />
      )}

      {catalogue.length > 0 && (
        <p className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[13px]">
          <span className="tabular-nums text-ws-muted">
            {courses.length === 1 ? "1 course" : `${courses.length} courses`}
            {filters.q && (
              <>
                {" "}
                for <span className="font-medium text-ws-primary">“{filters.q}”</span>
              </>
            )}
          </span>
          {filtering && (
            <Link href={marketplaceHref({ sort: filters.sort })} className="font-semibold text-ws-primary underline-offset-4 hover:underline">
              Clear filters
            </Link>
          )}
        </p>
      )}

      {courses.length > 0 && (
        <ul className="rise mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {courses.map((course) => (
            <li key={course.id}>
              <MarketingCourseCard course={course} signedIn={signedIn} />
            </li>
          ))}
        </ul>
      )}

      {catalogue.length > 0 && courses.length === 0 && (
        <div className="mt-10 rounded-[20px] border border-dashed border-ws-hairline p-10 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-ws-surface text-ws-muted">
            <SearchIcon size={20} aria-hidden />
          </span>
          <p className="mt-4 font-display text-lg font-semibold text-ws-primary">No courses match these filters</p>
          <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-ws-muted">
            Try another topic or level, or search for a seller&rsquo;s name.
          </p>
          <Link
            href={marketplaceHref({})}
            className="mt-6 inline-flex h-11 items-center justify-center rounded-full border border-ws-hairline px-6 text-[14px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-surface"
          >
            Clear filters
          </Link>
        </div>
      )}

      {catalogue.length === 0 && (
        <div className="mt-12 rounded-[20px] border border-dashed border-ws-hairline p-10 text-center md:p-14">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-ws-surface text-ws-muted">
            <StoreIcon size={20} aria-hidden />
          </span>
          <p className="mt-4 font-display text-xl font-semibold text-ws-primary">The first courses are in review</p>
          <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-ws-muted">
            Every marketplace course is checked by our team before it goes live. While the shelf fills up, explore
            the schools — or be one of the first sellers.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/schools"
              className="inline-flex h-11 items-center justify-center rounded-full border border-ws-hairline px-6 text-[14px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-surface"
            >
              Explore the schools
            </Link>
            <Link
              href="/sell"
              className="inline-flex h-11 items-center justify-center rounded-full border border-ws-hairline px-6 text-[14px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-surface"
            >
              Sell your course
            </Link>
          </div>
        </div>
      )}

      {/* The way in for sellers — the page's one gold action. */}
      <section
        aria-labelledby="sell-heading"
        className="mt-20 grid gap-6 rounded-[20px] border border-ws-hairline bg-ws-surface p-7 md:mt-28 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-10 dark:border-transparent"
      >
        <div>
          <h2 id="sell-heading" className="font-display text-[clamp(1.5rem,2.6vw,2rem)] font-semibold tracking-[-0.015em] text-ws-primary">
            Teach what you know
          </h2>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ws-muted">
            Approved sellers keep {sharePercent(MARKETPLACE_SHARE_OWN_LINK)} of every sale through their own link
            and {sharePercent(MARKETPLACE_SHARE_ACADEMY)} of the sales we make for them.
          </p>
        </div>
        <Link
          href="/sell"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ws-brand px-7 text-[15px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"
        >
          Sell your course
          <ArrowRightIcon size={16} aria-hidden />
        </Link>
      </section>
    </div>
  )
}
