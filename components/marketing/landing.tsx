import { fetchBrowseCourses, fetchFaculty, fetchFreePreviewLessons, type BrowseCourse } from "@/lib/actions/student"
import { fetchLandingReviews } from "@/lib/actions/reviews"
import { getCurrentUser } from "@/lib/auth/actions"
import { FACULTY_PUBLIC } from "@/lib/faculty"
import { registerUrl } from "@/lib/auth/login-url"
import { cheapestBySchool, countProgramsBySchool } from "@/lib/schools"
import { HeroWall } from "@/components/marketing/hero-wall"
import { CohortBanner } from "@/components/marketing/cohort-banner"
import { cohortIsUpcoming } from "@/lib/cohort"
import { HowItWorks } from "@/components/marketing/how-it-works"
import { WorldsBand } from "@/components/marketing/worlds-band"
import { WordsMarquee } from "@/components/marketing/words-marquee"
import { AboutBand } from "@/components/marketing/about-band"
import { WhyBand } from "@/components/marketing/why-band"
import { SchoolsGrid } from "@/components/marketing/schools-grid"
import { CatalogueGrid } from "@/components/marketing/catalogue-rail"
import { FacultyTeaser } from "@/components/faculty/faculty-teaser"
import { UpcomingDrops } from "@/components/marketing/upcoming-drops"
import { Testimonials, FinaleCta } from "@/components/marketing/reviews-finale"
import { Faq } from "@/components/marketing/faq"
import { StickySchoolBar } from "@/components/marketing/sticky-school-bar"
import { FreePreviewRail } from "@/components/marketing/free-preview-rail"
import { InstitutionBand } from "@/components/marketing/institution-band"
import { CertificateBand } from "@/components/marketing/certificate-band"
import { CourseTeaser } from "@/components/marketing/course-teaser"
import { ScrollProgress } from "@/components/marketing/motion/scroll-progress"

// A new account starts at the schools (Homepage → School → Program), never at the hub.
const REGISTER_URL = registerUrl("/schools")

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
 * the live cohort band (hidden once the cohort has begun), "Our mission"
 * (blueprint §4, the three gaps), the band of
 * words, the Schools grid, the About statement, the Why pillars, the
 * How-it-works timeline, the three worlds, the catalogue
 * card grid (the one program section with course thumbnails), the
 * "Watch a free lesson" rail (real free previews only; hidden at zero), the
 * marketplace and New Economy teasers (up to four cards each — the
 * Academy's other half, owner 2026-10-05; each hidden at zero), the
 * Faculty teaser (hidden when there is no faculty, and while FACULTY_PUBLIC
 * is off), Upcoming drops (hidden
 * when nothing is scheduled), testimonials (real reviews), the FAQ, and the
 * finale CTA — plus a sticky school bar, fixed to the viewport, that follows
 * the visitor once the hero has scrolled out of view, and a gold reading-
 * progress line on the navbar's foot.
 *
 * This server component is the ONLY fetch point; sections are client leaves
 * that receive data as props. Every fetch already falls back to `[]`/null,
 * and every section tolerates empty data by hiding — never by faking. No
 * aggregate numbers anywhere: displayed figures come only from BrowseCourse/
 * LandingReview fields plus the true "70% default" pass-mark line.
 */
export async function Landing() {
  const [user, courses, reviews, faculty, previews, marketplace, newEconomy] = await Promise.all([
    getCurrentUser().catch(() => null),
    fetchBrowseCourses(),
    fetchLandingReviews(9),
    FACULTY_PUBLIC ? fetchFaculty() : Promise.resolve([]),
    fetchFreePreviewLessons(),
    fetchBrowseCourses({ kind: "marketplace" }),
    fetchBrowseCourses({ kind: "new-economy" }),
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
      {/* Reading progress — a gold line on the navbar's foot, landing only */}
      <ScrollProgress />

      {/* Hero — the still claim over a slideshow of students, the school picker and its CTAs (institutional blueprint §18) */}
      <HeroWall counts={schoolCounts} cheapest={schoolFrom} signedIn={signedIn} registerUrl={REGISTER_URL} cohortOpen={cohortIsUpcoming()} />

      {/* Live cohort — the date, the countdown and "Choose your school" (owner 2026-10-03); gone once it begins */}
      <CohortBanner variant="band" className="pt-14 md:pt-20" />

      {/* Who we are — the owner's framing: point A to point B, our systems, our experts */}
      <InstitutionBand />

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

      {/* The three worlds — the Academy, the Marketplace, the Opportunity Hub (blueprint §6) */}
      <WorldsBand />

      {/* Featured programs — the catalogue grid (the ONLY course-art section; hides below 3) */}
      <CatalogueGrid courses={gridCourses} signedIn={signedIn} />

      {/* Watch a free lesson — real free previews only; hides at zero */}
      <FreePreviewRail previews={previews} />

      {/* The marketplace — up to four pre-recorded courses; hides at zero */}
      <CourseTeaser
        id="marketplace"
        label="Marketplace"
        title="Learn on your schedule"
        body="Pre-recorded courses from practitioners, each reviewed by our team before it goes live."
        href="/marketplace"
        linkLabel="Browse the marketplace"
        courses={marketplace}
        signedIn={signedIn}
      />

      {/* New Economy — free courses on WorldStreet's products; hides at zero */}
      <CourseTeaser
        id="new-economy"
        label="New Economy · Free"
        title="Free courses on the new economy"
        body="How to use each WorldStreet product, step by step. Free, at your own pace."
        href="/new-economy"
        linkLabel="All free courses"
        courses={newEconomy}
        signedIn={signedIn}
      />

      {/* Faculty — up to four instructors and View faculty; hides at zero (spec §10) and while FACULTY_PUBLIC is off */}
      {FACULTY_PUBLIC && <FacultyTeaser faculty={faculty} />}

      {/* Upcoming drops (renders only when something is scheduled) */}
      {drops.length > 0 && <UpcomingDrops drops={drops} />}

      {/* Certification — the claim and a sample certificate (spec §13) */}
      <CertificateBand />

      {/* Testimonials — real reviews only; hides at zero (spec §14) */}
      <Testimonials reviews={reviews} />

      {/* FAQ (spec §15) */}
      <Faq />

      {/* Finale CTA (spec §16) */}
      <FinaleCta signedIn={signedIn} registerUrl={REGISTER_URL} />

      {/* Follows the visitor once the hero scrolls away (spec §1) */}
      <StickySchoolBar cheapest={schoolFrom} />
    </div>
  )
}
