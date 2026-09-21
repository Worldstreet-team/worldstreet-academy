import type { Metadata } from "next"
import { cache } from "react"
import { notFound, permanentRedirect } from "next/navigation"
import { fetchBrowseCourses, fetchProgramBySlug, type BrowseCourse } from "@/lib/actions/student"
import { fetchProgramCurriculum, fetchProgramReviews } from "@/lib/actions/program-page"
import { appUrl } from "@/lib/app-url"
import { BRAND } from "@/lib/brand"
import { checkEnrollment } from "@/lib/actions/enrollments"
import { getCachedUser } from "@/lib/auth/cached"
import { getLearnStart } from "@/lib/course-access"
import { courseAvailability } from "@/lib/types/course"
import { PACKAGE_RANK, isPackageKey } from "@/lib/entitlements"
import { SCHOOL_BY_SLUG } from "@/lib/schools"
import { cn } from "@/lib/utils"
import { ProgramHero } from "@/components/programs/program-hero"
import { ProgramArt, PurchasePanel, programIncludes, type ProgramFacts } from "@/components/programs/purchase-panel"
import { StickyPurchase } from "@/components/programs/sticky-purchase"
import { SectionNav, type SectionLink } from "@/components/programs/section-nav"
import { ProgramOutcomes, ProgramPrerequisites } from "@/components/programs/program-outcomes"
import { ProgramCurriculum } from "@/components/programs/program-curriculum"
import { ClampedText } from "@/components/programs/clamped-text"
import { ProgramInstructor } from "@/components/programs/program-instructor"
import { PackageChooser } from "@/components/programs/package-chooser"
import { PackageSelectionProvider } from "@/components/programs/package-selection"
import type { LessonAccess } from "@/components/programs/package-model"
import { ProgramReviews } from "@/components/programs/program-reviews"
import { RelatedPrograms } from "@/components/programs/related-programs"
import { PreviewProvider, type ProgramPreview } from "@/components/programs/preview-player"
import { ProgramStickyBar } from "@/components/programs/program-sticky-bar"
import { PROGRAM_H2, SECTION_SCROLL_MT } from "@/components/programs/section-title"
import { Faq } from "@/components/marketing/faq"
import type { ProgramAccess } from "@/components/programs/access"

// Per-visitor: enrollment state and the coming-soon/live cutover both change
// under a cached render.
export const revalidate = 0

type Params = { params: Promise<{ slug: string }> }

// generateMetadata and the page both need the program; dedupe the read.
const getProgram = cache((slug: string) => fetchProgramBySlug(slug))

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const program = await getProgram(slug)
  if (!program) return {}
  const description = program.shortDescription ?? program.description.slice(0, 160)
  const url = appUrl(`/programs/${program.slug}`)
  return {
    title: program.title,
    description,
    alternates: { canonical: url },
    // A page's openGraph REPLACES the inherited one, so set it only with a thumbnail
    // to show; without one the page keeps the site card (app/opengraph-image.tsx)
    // and Next fills og:title/description from the fields above.
    ...(program.thumbnailUrl
      ? {
          openGraph: {
            siteName: BRAND.name,
            type: "website",
            url,
            title: `${program.title} | ${BRAND.name}`,
            description,
            images: [{ url: program.thumbnailUrl, alt: program.title }],
          },
        }
      : {}),
  }
}

/** Stuck chrome above the lg purchase card: site navbar (64) + section nav (48). */
const STUCK_CHROME_PX = 112

/**
 * `/programs/[slug]` — the course page a buyer decides on (Udemy/Coursera's
 * shape, in the house style). Unknown or unpublished slugs 404.
 *
 * Layout: ONE grid from the hero to the FAQ, so two sticky things can span
 * what they need to —
 *
 *   row 1  hero band (full-bleed sunken fill)  │  aside: purchase card,
 *   row 2  section nav (sticks; its grid area  │  sticky, rows 1–3, so it
 *          runs rows 2→end, so it stays stuck │  rides beside the hero and
 *          through packages, reviews and FAQ) │  the main column and stops
 *   row 3  main column                         │  where they end
 *   row 4  packages · reviews · related · FAQ (full width)
 *
 * A sticky grid item is confined to its grid area, which is why the nav's
 * area deliberately overlaps the rows below it; row 2 is a fixed 3rem so the
 * content starts under it. Below lg it is one column: art, hero, the offer
 * inline, then the nav.
 *
 * Every fact is real: lesson count, length and previews come from the
 * published lessons (not the stored counters), reviews and ratings from their
 * collections; anything at zero is left out rather than printed.
 */
export default async function ProgramPage({
  params,
  searchParams,
}: Params & { searchParams: Promise<{ package?: string | string[] }> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  // Slugs are stored lowercase; any other casing redirects to the one URL.
  if (slug !== slug.toLowerCase()) permanentRedirect(`/programs/${slug.toLowerCase()}`)
  const program = await getProgram(slug)
  if (!program) notFound()

  const user = await getCachedUser()
  const [enrollment, start, curriculum, reviewsPage, catalogue] = await Promise.all([
    user ? checkEnrollment(user.id, program.id) : Promise.resolve(null),
    user ? getLearnStart(user.id, program.id) : Promise.resolve(null),
    fetchProgramCurriculum(program.id),
    fetchProgramReviews(program.id, 1, 6),
    fetchBrowseCourses(),
  ])
  const signedIn = Boolean(user)
  const isEnrolled = enrollment?.isEnrolled ?? false
  const isPreEnrolled = enrollment?.status === "pre_enrolled"
  const isComingSoon =
    courseAvailability({ status: "published", availableAt: program.availableAt }) === "coming_soon"

  // Straight into the player where this learner starts; while their package
  // opens no lesson yet, the course page's waiting state.
  const access: ProgramAccess = isEnrolled
    ? { kind: "enrolled", continueHref: start?.href ?? `/dashboard/courses/${program.id}` }
    : isComingSoon
      ? { kind: "coming_soon" }
      : { kind: "open" }
  // Only while coming soon: a live reservation buys through the ladder, whose links carry the package.
  const scheduling = !isEnrolled && isComingSoon ? { isComingSoon, isPreEnrolled } : null
  // One price source for the offer and the sticky bar: the tiers the chooser renders.
  const fromPrice = Math.min(...program.packages.map((p) => p.price))
  const multiTier = program.packages.length > 1
  // `?package=<key>` — the choice, kept in the URL so checkout's "Change" lands
  // back on it. Only an enabled tier of a multi-tier program counts.
  const requested = typeof query.package === "string" ? query.package : null
  const initialKey =
    multiTier && isPackageKey(requested) && program.packages.some((p) => p.key === requested) ? requested : null

  const previews: ProgramPreview[] = curriculum.flatMap((lesson) =>
    lesson.isFree && lesson.videoUrl
      ? [
          {
            id: lesson.id,
            title: lesson.title,
            durationSec: lesson.durationSec,
            videoUrl: lesson.videoUrl,
            posterUrl: lesson.posterUrl ?? program.thumbnailUrl,
          },
        ]
      : []
  )
  const facts: ProgramFacts = {
    lessons: curriculum.length,
    videoSec: curriculum.reduce((sum, lesson) => sum + (lesson.durationSec ?? 0), 0),
    previews: previews.length,
  }
  const includes = programIncludes(program, facts)
  // What each tier opens of the published curriculum: a lesson's `tier` is
  // set only when it needs more than the cheapest tier.
  const lessonAccess: LessonAccess | null =
    curriculum.length > 0
      ? {
          total: curriculum.length,
          open: Object.fromEntries(
            program.packages.map((p) => [
              p.key,
              curriculum.filter((lesson) => !lesson.tier || PACKAGE_RANK[p.key] >= PACKAGE_RANK[lesson.tier]).length,
            ])
          ),
        }
      : null
  // A ladder-less program is a legacy full enrollment, which earns the certificate.
  const certificate = program.tierCount === 0 || program.packages.some((p) => p.entitlements.certificate)

  const hasReviews = (reviewsPage.summary?.count ?? 0) > 0 || reviewsPage.total > 0
  // An enrolled learner is never quoted a price (lib/program-rail.ts): the
  // offer card already says "You're enrolled", and the ladder has no action for them.
  const showLadder = access.kind !== "enrolled"
  const school = program.school ? SCHOOL_BY_SLUG[program.school] : null

  // Related: this school's other programs when there are at least two to
  // show, else the catalogue — school siblings first — as "More programs".
  const others = catalogue.filter((c) => c.id !== program.id)
  const siblings = school ? others.filter((c) => c.school === school.slug) : []
  const relatedFromSchool = siblings.length >= 2
  const related: BrowseCourse[] = relatedFromSchool
    ? siblings.slice(0, 4)
    : [...siblings, ...others.filter((c) => c.school !== program.school || !school)].slice(0, 4)
  const programCount = catalogue.filter((c) => c.instructorId === program.instructorId).length

  const links: SectionLink[] = [
    { id: "overview", label: "Overview" },
    curriculum.length > 0 ? { id: "curriculum", label: "Curriculum" } : null,
    { id: "instructor", label: "Instructor" },
    showLadder ? { id: "packages", label: multiTier ? "Packages" : "Pricing" } : null,
    hasReviews ? { id: "reviews", label: "Reviews" } : null,
    { id: "faq", label: "FAQ" },
  ].filter((link): link is SectionLink => link !== null)

  const offer = {
    program,
    access,
    scheduling,
    signedIn,
    fromPrice,
    multiTier,
    includes,
    hasPreview: previews.length > 0,
  }

  return (
    <PreviewProvider previews={previews} programTitle={program.title}>
      <PackageSelectionProvider
        courseId={program.id}
        packages={program.packages}
        tierCount={program.tierCount}
        initialKey={initialKey}
        signedIn={signedIn}
      >
        <article>
          <div className="mx-auto grid max-w-7xl grid-cols-1 grid-rows-[auto_3rem_auto_auto] px-6 lg:grid-cols-[minmax(0,1fr)_23.5rem] lg:gap-x-14">
            {/* Hero band: a full-bleed fill one step off the page behind row 1. */}
            <div aria-hidden className="relative col-[1/-1] row-start-1">
              <div className="absolute inset-y-0 left-1/2 w-screen -translate-x-1/2 border-b border-ws-hairline bg-ws-sunken dark:border-transparent" />
            </div>

            <header id="program-hero" className="relative col-start-1 row-start-1 min-w-0 pb-10 sm:pt-10 lg:pb-14 lg:pt-12">
              {/* Below lg the art leads the page (edge to edge on phones); on lg it sits in the card. */}
              <div className="-mx-6 mb-7 sm:mx-0 sm:mb-9 lg:hidden">
                <ProgramArt
                  program={program}
                  hasPreview={previews.length > 0}
                  sizes="(max-width: 640px) 100vw, 46rem"
                  priority
                  className="sm:rounded-[20px]"
                />
              </div>
              <ProgramHero program={program} access={access} facts={facts} certificate={certificate} signedIn={signedIn} />
              <div className="mt-8 lg:hidden">
                <PurchasePanel {...offer} variant="inline" />
              </div>
            </header>

            {/* Above the section nav (z-40), below the site navbar (z-50): the card overhangs the band's edge. */}
            <aside aria-label="Enrol" className="relative z-[41] hidden lg:col-start-2 lg:row-[1/4] lg:block lg:pt-12">
              <StickyPurchase watchId="program-hero" topOffset={STUCK_CHROME_PX} className="sticky top-[8.5rem]">
                <PurchasePanel {...offer} variant="card" />
              </StickyPurchase>
            </aside>

            <div className="sticky top-14 z-40 col-[1/-1] row-[2/-1] h-12 self-start sm:top-16">
              <div aria-hidden className="absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2 border-b border-ws-hairline bg-ws-page" />
              <div className="h-full lg:max-w-[calc(100%-23.5rem-3.5rem)]">
                <SectionNav links={links} />
              </div>
            </div>

            <div id="overview" className={cn("col-start-1 row-start-3 min-w-0 space-y-14 pt-10 lg:space-y-16 lg:pt-12", SECTION_SCROLL_MT)}>
              <ProgramOutcomes items={program.whatYouWillLearn} />
              {curriculum.length > 0 && <ProgramCurriculum id="curriculum" lessons={curriculum} />}
              <ProgramPrerequisites requirements={program.requirements} targetAudience={program.targetAudience} />
              {program.description && (
                <section aria-labelledby="about-heading">
                  <h2 id="about-heading" className={PROGRAM_H2}>
                    About this program
                  </h2>
                  <div className="mt-4 max-w-[68ch]">
                    <ClampedText text={program.description} lines={7} className="text-[16px] leading-[1.7] text-ws-primary/85" />
                  </div>
                </section>
              )}
              <ProgramInstructor
                sectionId="instructor"
                id={program.instructorId}
                username={program.instructorUsername}
                name={program.instructorName}
                avatarUrl={program.instructorAvatarUrl}
                headline={program.instructorHeadline}
                bio={program.instructorBio}
                totalStudents={program.instructorTotalStudents}
                programCount={programCount}
                signedIn={signedIn}
              />
            </div>

            <div className="col-[1/-1] row-start-4 min-w-0 pt-20 lg:pt-24">
              <div className="space-y-20 lg:space-y-24">
                {showLadder && (
                  <PackageChooser
                    programTitle={program.title}
                    comingSoon={access.kind === "coming_soon"}
                    lessons={lessonAccess}
                  />
                )}
                {hasReviews && <ProgramReviews courseId={program.id} sectionId="reviews" initial={reviewsPage} />}
                <RelatedPrograms programs={related} school={relatedFromSchool ? school : null} signedIn={signedIn} />
              </div>
              {/* The FAQ carries its own max-w-7xl gutter and vertical padding:
                  step out of this grid's gutter so the two line up, and let its
                  padding be the gap above it. */}
              <div className="-mx-6">
                <Faq />
              </div>
            </div>
          </div>

          {access.kind === "open" && <ProgramStickyBar title={program.title} fromPrice={fromPrice} />}
        </article>
      </PackageSelectionProvider>
    </PreviewProvider>
  )
}
