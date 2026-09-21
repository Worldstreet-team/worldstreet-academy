import type { SchoolReviews as SchoolReviewsData } from "@/lib/actions/school-page"
import { cn } from "@/lib/utils"
import { RatingSummary, ReviewCard } from "@/components/programs/program-reviews"
import { plural } from "@/components/programs/format"
import { SCHOOL_SECTION, SectionHead } from "@/components/schools/section-head"

/**
 * `#reviews` — what learners made of the school's programs, together: the
 * combined rating (every program's stored rating, weighted by its count) and
 * the best written reviews, each tagged with the program it reviews
 * (`fetchSchoolReviews`). The program page's own summary and card, so a
 * review reads the same on both pages. Hidden when there are no ratings and
 * no written reviews.
 */
export function SchoolReviews({ data }: { data: SchoolReviewsData }) {
  const { summary, reviews, total } = data
  if (!summary && reviews.length === 0) return null

  return (
    <section id="reviews" aria-labelledby="reviews-heading" className={SCHOOL_SECTION}>
      <SectionHead
        id="reviews-heading"
        title="What learners say"
        lede="Ratings from every program in the school, combined, and the reviews learners wrote."
        aside={
          total > reviews.length ? (
            <p className="text-[14px] tabular-nums text-ws-muted">{plural(total, "written review")} in all</p>
          ) : undefined
        }
      />
      <div className={cn("mt-10 grid gap-10", summary && "lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-14")}>
        {summary && <RatingSummary summary={summary} />}
        <div className="min-w-0">
          {reviews.length === 0 ? (
            <p className="rounded-[20px] border border-dashed border-ws-hairline px-6 py-8 text-[15px] text-ws-muted">
              No written reviews yet.
            </p>
          ) : (
            <ul className={cn("grid gap-4", reviews.length > 1 && "md:grid-cols-2")}>
              {reviews.map((review) => (
                <li key={review.id} className="flex">
                  <ReviewCard review={review} wide={reviews.length === 1} program={review.program} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
