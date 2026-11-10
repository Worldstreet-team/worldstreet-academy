import type { BrowseCourse } from "@/lib/actions/student"

/**
 * Price line for a program row. `Course.price` is whole USD and, for
 * package ladders, already the cheapest enabled tier (Phase 0 rule) — so a
 * ladder reads "From $49", a single package or legacy course reads the
 * scalar, and free stays free.
 */
export function programPriceLabel(
  course: Pick<BrowseCourse, "pricing" | "price" | "tierCount">
): string {
  if (course.pricing === "free" || !course.price) return "Free"
  const usd = `$${course.price.toLocaleString("en-US")}`
  return course.tierCount > 1 ? `From ${usd}` : usd
}

/**
 * The regular price in words, for plain text that can't strike it through
 * (an announced or sentence-length price): " (was $300)", or "" when the
 * price isn't discounted.
 */
export function wasPriceNote(price: number, listPrice: number | null): string {
  return listPrice !== null && listPrice > price ? ` (was $${listPrice.toLocaleString("en-US")})` : ""
}

/** A package's own price: whole USD, or "Free". */
export function packagePriceLabel(price: number): string {
  return price === 0 ? "Free" : `$${price.toLocaleString("en-US")}`
}
