import { fetchBrowseCourses, fetchFaculty, type BrowseCourse } from "@/lib/actions/student"
import { fetchLandingReviews } from "@/lib/actions/reviews"
import { getCurrentUser } from "@/lib/auth/actions"
import { registerUrl } from "@/lib/auth/login-url"
import { cheapestBySchool, countProgramsBySchool } from "@/lib/schools"
import { HeroWall } from "@/components/marketing/hero-wall"
import { HowItWorks } from "@/components/marketing/how-it-works"
import { WordsMarquee } from "@/components/marketing/words-marquee"
import { AboutBand } from "@/components/marketing/about-band"
import { WhyBand } from "@/components/marketing/why-band"
import { SchoolsGrid } from "@/components/marketing/schools-grid"
import { CatalogueGrid } from "@/components/marketing/catalogue-rail"
import { FacultyTeaser } from "@/components/faculty/faculty-teaser"
import { UpcomingDrops } from "@/components/marketing/upcoming-drops"
import { Testimonials, FinaleCta } from "@/components/marketing/reviews-finale"
import { Faq } from "@/components/marketing/faq"

// A new account returns to the school picker, never to the hub.
const REGISTER_URL = registerUrl("/dashboard/start")

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
 * the band of words, the Schools grid, the About statement, the Why pillars,
 * the How-it-works timeline, the catalogue card grid (the ONLY section
 * allowed to show course thumbnails), the Faculty teaser (hidden when there is
 * no faculty), Upcoming drops (hidden when nothing is scheduled), testimonials
 * (real reviews), the FAQ, and the finale CTA.
 *
 * This server component is the ONLY fetch point; sections are client leaves
 * that receive data as props. Every fetch already falls back to `[]`/null,
 * and every section tolerates empty data by hiding — never by faking. No
 * aggregate numbers anywhere: displayed figures come only from BrowseCourse/
 * LandingReview fields plus the true "70% default" pass-mark line.
 */
export async function Landing() {
  const [user, courses, reviews, faculty] = await Promise.all([
    getCurrentUser().catch(() => null),
    fetchBrowseCourses(),
    fetchLandingReviews(9),
    fetchFaculty(),
  ])

  const signedIn = Boolean(user)
  const published = courses.filter((c) => c.status === "published")

  // ── Catalogue rail: every published course — the rail scrolls.
  const gridCourses = published.slice(0, 12)

  // ── Upcoming drops (hidden when nothing is queued).
  const drops = futureDrops(published)

  // ── Schools grid: program counts from the same published list.
  const schoolCounts = countProgramsBySchool(published)
  const schoolFrom = cheapestBySchool(published)

  return (
    <div
      style={
        {
          "--land-ease-inertia": "cubic-bezier(0.16, 1, 0.3, 1)",
          "--land-ease-exit": "cubic-bezier(0.7, 0, 0.84, 0)",
        } as React.CSSProperties
      }
    >
      {/* Hero — claim, the school picker and its CTA (spec §1) */}
      <HeroWall courses={published} signedIn={signedIn} registerUrl={REGISTER_URL} />

      {/* The band of words — the eight schools' vocabulary */}
      <WordsMarquee />

      {/* Our schools — eight cards with live program counts (spec §4) */}
      <SchoolsGrid counts={schoolCounts} cheapest={schoolFrom} />

      {/* About (spec §2) */}
      <AboutBand />

      {/* Why learn here — six pillars (spec §3) */}
      <WhyBand />

      {/* How it works — the four-step journey (spec §11) */}
      <HowItWorks />

      {/* Featured programs — the catalogue grid (the ONLY course-art section; hides below 3) */}
      <CatalogueGrid courses={gridCourses} signedIn={signedIn} />

      {/* Faculty — up to four instructors and View faculty; hides at zero (spec §10) */}
      <FacultyTeaser faculty={faculty} />

      {/* Upcoming drops (renders only when something is scheduled) */}
      {drops.length > 0 && <UpcomingDrops drops={drops} />}

      {/* Testimonials — real reviews only; hides at zero (spec §14) */}
      <Testimonials reviews={reviews} />

      {/* FAQ (spec §15) */}
      <Faq />

      {/* Finale CTA (spec §16) */}
      <FinaleCta signedIn={signedIn} registerUrl={REGISTER_URL} />
    </div>
  )
}
