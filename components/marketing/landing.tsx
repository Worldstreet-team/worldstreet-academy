import { fetchBrowseCourses, type BrowseCourse } from "@/lib/actions/student"
import { fetchLandingReviews } from "@/lib/actions/reviews"
import { getCurrentUser } from "@/lib/auth/actions"
import { Hero, ProductFrames } from "@/components/marketing/hero-slider"
import { WordsMarquee } from "@/components/marketing/words-marquee"
import { AboutBand } from "@/components/marketing/about-band"
import { ProgramsList } from "@/components/marketing/programs-list"
import { CatalogueRail } from "@/components/marketing/catalogue-rail"
import { UpcomingDrops } from "@/components/marketing/upcoming-drops"
import { ReviewsFinale } from "@/components/marketing/reviews-finale"

const isLocalDev = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")
const REGISTER_URL = isLocalDev ? "/register" : "https://worldstreetgold.com/register"

/** Published courses with a FUTURE availableAt, soonest first — real
 *  scheduling only; the drops section hides entirely when this is empty. */
function futureDrops(published: BrowseCourse[]): BrowseCourse[] {
  const now = Date.now()
  return published
    .filter((c) => c.availableAt && new Date(c.availableAt).getTime() > now)
    .sort(
      (a, b) =>
        new Date(a.availableAt!).getTime() - new Date(b.availableAt!).getTime()
    )
}

/**
 * The Academy landing at `/` — clean editorial composition. Six sections:
 * hero + product-frame band (pure DS vignettes, no course art), the raised
 * About panel, the interactive Programs index, the catalogue rail (the ONLY
 * section allowed to show course thumbnails), Upcoming drops (hidden when
 * nothing is scheduled), and From-the-floor + finale (reviews render only at
 * the 3-review floor).
 *
 * This server component is the ONLY fetch point; sections are client leaves
 * that receive data as props. Every fetch already falls back to `[]`/null,
 * and every section tolerates empty data by hiding — never by faking. No
 * aggregate numbers anywhere: displayed figures come only from BrowseCourse/
 * LandingReview fields plus the true "70% default" pass-mark line.
 */
export async function Landing() {
  const [user, courses, reviews] = await Promise.all([
    getCurrentUser().catch(() => null),
    fetchBrowseCourses(),
    fetchLandingReviews(9),
  ])

  const signedIn = Boolean(user)
  const published = courses.filter((c) => c.status === "published")

  // ── Catalogue rail: 8 published, from the same single fetch.
  const railCourses = published.slice(0, 8)

  // ── Upcoming drops (hidden when nothing is queued).
  const drops = futureDrops(published)

  return (
    <div
      style={
        {
          "--land-ease-inertia": "cubic-bezier(0.16, 1, 0.3, 1)",
          "--land-ease-exit": "cubic-bezier(0.7, 0, 0.84, 0)",
        } as React.CSSProperties
      }
    >
      {/* §1 — Hero: type and CTAs on the open stage */}
      <Hero signedIn={signedIn} registerUrl={REGISTER_URL} />

      {/* §2 — The band of words */}
      <WordsMarquee />

      {/* §3 — About, set on the page itself */}
      <AboutBand />

      {/* §4 — Programs index */}
      <ProgramsList />

      {/* §5 — The product walkthrough, mid-page where it reads as evidence */}
      <ProductFrames />

      {/* §6 — The catalogue (the ONLY course-art section; hides below 3) */}
      <CatalogueRail courses={railCourses} signedIn={signedIn} />

      {/* §5 — Upcoming drops (renders only when something is scheduled) */}
      {drops.length > 0 && <UpcomingDrops drops={drops} />}

      {/* §6 — From the floor + finale (reviews render only at ≥3) */}
      <ReviewsFinale reviews={reviews} signedIn={signedIn} registerUrl={REGISTER_URL} />
    </div>
  )
}
