/**
 * The Academy Marketplace's pure, client-safe rules (owner meeting
 * 2026-10-03, follow-ups 2026-10-05). Pre-recorded courses sold by approved
 * sellers and by the Academy's own faculty, each one quality-reviewed before
 * it is published.
 *
 * The money split itself lives in lib/db/models/earning.ts
 * (MARKETPLACE_SHARE_OWN_LINK / MARKETPLACE_SHARE_ACADEMY). That module loads
 * mongoose, so it never reaches a client bundle: callers on the server pass
 * those rates into `sellerSplitNote`, and the figures keep one home.
 * Server-only seller reads are in lib/seller.ts.
 */

import { SCHOOLS } from "@/lib/schools"

/** Where an approved seller lands in the instructor area — the only home they have there. */
export const SELLER_HOME = "/instructor/courses"

/**
 * Instructor-area routes an approved seller (role USER, `sellerStatus`
 * "approved") may open: the course list, add/edit, the course page, its
 * lessons, settings (earnings) and profile. Meetings, messages, certificates,
 * analytics, exams, assignments and the overview are faculty tools — the
 * layout and a client guard send a seller from them to SELLER_HOME.
 */
export function sellerMayOpen(pathname: string): boolean {
  if (pathname === "/instructor/settings" || pathname === "/instructor/profile") return true
  if (pathname === "/instructor/courses" || pathname === "/instructor/courses/new") return true
  return /^\/instructor\/courses\/[^/]+(\/(edit|lessons))?$/.test(pathname)
}

/** "85%" from 0.85. */
export function sharePercent(rate: number): string {
  return `${Math.round(rate * 100)}%`
}

/** The one sentence every seller surface uses for the split. */
export function sellerSplitNote(ownLinkRate: number, academyRate: number): string {
  return `Sales through your link: you keep ${sharePercent(ownLinkRate)}. Sales we make: you keep ${sharePercent(academyRate)}.`
}

/** What every marketplace course is reviewed against before it is published (/sell, the application, the review). */
export const QUALITY_CRITERIA = [
  {
    title: "Practical",
    body: "Learners finish able to do something they couldn't before — real tasks, real tools, real examples.",
  },
  {
    title: `Fits one of the ${SCHOOLS.length} schools`,
    body: "The topic belongs in a school of the Academy, from trading and technology to digital business, the creative economy and leadership.",
  },
  {
    title: "Clear audio and video",
    body: "Steady picture, clean sound and readable screens. Phone footage is fine when it is clear.",
  },
  {
    title: "Original",
    body: "Your own material. Nothing copied, re-uploaded or used without permission.",
  },
  {
    title: "Structured lessons",
    body: "Short lessons in a sensible order, each with a title that says what it teaches.",
  },
] as const

export type MarketplaceSort = "popular" | "rating" | "newest" | "price-low" | "price-high"

export const MARKETPLACE_SORTS: ReadonlyArray<{ value: MarketplaceSort; label: string }> = [
  { value: "popular", label: "Most popular" },
  { value: "rating", label: "Highest rated" },
  { value: "newest", label: "Newest" },
  { value: "price-low", label: "Price: low to high" },
  { value: "price-high", label: "Price: high to low" },
]

export function isMarketplaceSort(value: unknown): value is MarketplaceSort {
  return typeof value === "string" && MARKETPLACE_SORTS.some((s) => s.value === value)
}

/** The marketplace's URL state: `?q=&school=&price=&level=&sort=`. */
export type MarketplaceFilterValues = {
  q: string
  /** A school slug, used as the course's topic; "" = every topic. */
  school: string
  price: "" | "free" | "paid"
  level: "" | "beginner" | "intermediate" | "advanced"
  sort: MarketplaceSort
}

/** `/marketplace` with only the filters that differ from the defaults. */
export function marketplaceHref(values: Partial<MarketplaceFilterValues>): string {
  const params = new URLSearchParams()
  if (values.q?.trim()) params.set("q", values.q.trim())
  if (values.school) params.set("school", values.school)
  if (values.price) params.set("price", values.price)
  if (values.level) params.set("level", values.level)
  if (values.sort && values.sort !== "popular") params.set("sort", values.sort)
  const query = params.toString()
  return query ? `/marketplace?${query}` : "/marketplace"
}
