import { fetchBrowseCourses, type BrowseCourse } from "@/lib/actions/student"
import { fetchLandingReviews } from "@/lib/actions/reviews"
import { getCurrentUser } from "@/lib/auth/actions"
import { HeroWall } from "@/components/marketing/hero-wall"
import { RoomsTimeline } from "@/components/marketing/rooms-timeline"
import { WordsMarquee } from "@/components/marketing/words-marquee"
import { AboutBand } from "@/components/marketing/about-band"
import { ProgramsList } from "@/components/marketing/programs-list"
import { CatalogueGrid } from "@/components/marketing/catalogue-rail"
import { UpcomingDrops } from "@/components/marketing/upcoming-drops"
import { Testimonials, FinaleCta } from "@/components/marketing/reviews-finale"
import { Faq } from "@/components/marketing/faq"

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
 * The Academy landing at `/` — clean editorial composition, in order: hero,
 * the band of words, the About statement, the interactive Programs index, the
 * product-frame walkthrough (pure DS vignettes, no course art), the catalogue
 * card grid (the ONLY section allowed to show course thumbnails), Upcoming
 * drops (hidden when nothing is scheduled), testimonials (real reviews, from
 * the first one up), the static FAQ, and the compact finale CTA.
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

  // ── Catalogue rail: every published course — the rail scrolls.
  const gridCourses = published.slice(0, 12)

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
      <HeroWall courses={published} signedIn={signedIn} registerUrl={REGISTER_URL} />

      {/* §2 — The band of words */}
      <WordsMarquee />

      {/* §3 — About, set on the page itself */}
      <AboutBand />

      {/* §4 — Programs index */}
      <ProgramsList />

      {/* §5 — The product walkthrough, mid-page where it reads as evidence */}
      <RoomsTimeline />

      {/* §6 — The catalogue grid (the ONLY course-art section; hides below 3) */}
      <CatalogueGrid courses={gridCourses} signedIn={signedIn} />

      {/* §7 — Upcoming drops (renders only when something is scheduled) */}
      {drops.length > 0 && <UpcomingDrops drops={drops} />}

      {/* §8 — From the floor (real reviews; hides only at zero) */}
      <Testimonials reviews={reviews} />

      {/* §9 — FAQ (static, truthful) */}
      <Faq />

      {/* §10 — Compact finale CTA */}
      <FinaleCta signedIn={signedIn} registerUrl={REGISTER_URL} />
    </div>
  )
}
