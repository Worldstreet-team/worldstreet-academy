import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { SCHOOL_BY_SLUG, cheapestBySchool, countProgramsBySchool, isSchoolSlug } from "@/lib/schools"
import { schoolCover } from "@/lib/school-art"
import { fetchBrowseCourses, fetchFaculty, fetchProgramBySlug } from "@/lib/actions/student"
import { fetchProgramCurriculum } from "@/lib/actions/program-page"
import { fetchSchoolReviews } from "@/lib/actions/school-page"
import { packagePriceLabel, programPriceLabel } from "@/lib/program-price"
import { appUrl } from "@/lib/app-url"
import { BRAND } from "@/lib/brand"
import { Faq } from "@/components/marketing/faq"
import { PreviewProvider } from "@/components/programs/preview-player"
import { SectionNav, type SectionLink } from "@/components/programs/section-nav"
import { plural } from "@/components/programs/format"
import { byLevel, levelsOf, toSchoolProgram, topicMap, type SchoolProgram } from "@/components/schools/model"
import type { SchoolCta } from "@/components/schools/cta"
import { SchoolHero } from "@/components/schools/school-hero"
import { SchoolPrograms } from "@/components/schools/school-programs"
import { SchoolCompare } from "@/components/schools/school-compare"
import { SchoolTopics } from "@/components/schools/school-topics"
import { SchoolPath } from "@/components/schools/school-path"
import { SchoolFreeLessons } from "@/components/schools/school-free-lessons"
import { SchoolFaculty, type SchoolFacultyMember } from "@/components/schools/school-faculty"
import { SchoolReviews } from "@/components/schools/school-reviews"
import { OtherSchools } from "@/components/schools/other-schools"
import { SchoolClosing } from "@/components/schools/school-closing"
import { SchoolStickyBar } from "@/components/schools/school-sticky-bar"

// Published/coming-soon state of a school's programs changes under a cached render.
export const revalidate = 0

type Params = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  if (!isSchoolSlug(slug)) return {}
  const school = SCHOOL_BY_SLUG[slug]
  const description = school.tagline ?? school.blurb
  const url = appUrl(`/schools/${school.slug}`)
  const cover = schoolCover(school.slug)
  return {
    title: school.name,
    description,
    alternates: { canonical: url },
    // A page's openGraph replaces the inherited one, so set it only with art to show.
    ...(cover
      ? {
          openGraph: {
            siteName: BRAND.name,
            type: "website",
            url,
            title: `${school.name} | ${BRAND.name}`,
            description,
            images: [{ url: cover, alt: school.name }],
          },
        }
      : {}),
  }
}

/**
 * `/schools/[slug]` — where a visitor decides a school is for them (spec §5,
 * blueprint §17/§18: School → Program → Package → Checkout). Unknown slugs 404.
 *
 *   hero          the school's render, full bleed; name, promise, one gold
 *                 action, and a strip of real facts
 *   section nav   sticky under the navbar, one link per section that renders
 *   programs      image-led cards (1 = feature, 2 = pair, 3+ = grid)
 *   compare       2+ programs, side by side
 *   learn         the programs' own outcomes, de-duplicated and attributed
 *   path          2+ levels, beginner → advanced
 *   free lessons  the shared preview player; hidden when none
 *   faculty       hidden when none
 *   reviews       combined rating + the best written reviews; hidden when none
 *   FAQ · other schools · closing band · phone bar
 *
 * Every figure is real: lesson counts and lengths come from the published
 * lessons, prices from the packages, ratings from their collections, and
 * anything at zero is left out rather than printed.
 */
export default async function SchoolPage({ params }: Params) {
  const { slug } = await params
  if (!isSchoolSlug(slug)) notFound()
  const school = SCHOOL_BY_SLUG[slug]
  const cover = schoolCover(school.slug)

  const [catalogue, faculty, reviews] = await Promise.all([
    fetchBrowseCourses(),
    fetchFaculty(),
    fetchSchoolReviews(school.slug, 6),
  ])
  const loaded = await Promise.all(
    catalogue
      .filter((course) => course.school === school.slug)
      .map(async (course) => {
        const [program, curriculum] = await Promise.all([
          fetchProgramBySlug(course.slug),
          fetchProgramCurriculum(course.id),
        ])
        return program ? toSchoolProgram(program, curriculum) : null
      })
  )
  const programs = byLevel(loaded.filter((p): p is SchoolProgram => p !== null))

  const previews = programs.flatMap((p) => p.previews)
  const counts = countProgramsBySchool(catalogue)
  const cheapestAll = cheapestBySchool(catalogue)
  const cheapest = cheapestAll[school.slug]
  const hasTopics = topicMap(programs).total > 0
  const hasPath = levelsOf(programs).length > 1
  const hasReviews = reviews.summary !== null || reviews.reviews.length > 0

  const facultyMembers: SchoolFacultyMember[] = faculty.flatMap((member) => {
    const taught = programs.filter((p) => p.program.instructorId === member.id).map((p) => p.program)
    if (taught.length === 0) return []
    return [{ member, programs: taught, students: taught[0].instructorTotalStudents }]
  })

  // The journey goes School → Program → Package: with programs to choose
  // between, the gold action takes the visitor to them; with exactly one, to
  // its page, where the package is chosen; with none yet, to the schools that
  // are open.
  const only = programs.length === 1 ? programs[0].program : null
  const primary: SchoolCta =
    programs.length === 0
      ? { href: "#other-schools", label: "See the other schools" }
      : only
        ? { href: `/programs/${only.slug}`, label: "View the program" }
        : { href: "#programs", label: "View programs" }
  const secondary: SchoolCta | null =
    programs.length > 1
      ? { href: "#compare", label: "Compare programs" }
      : programs.length === 0
        ? { href: "/programs", label: "Browse all programs" }
        : null

  const fromText = cheapest === null ? null : cheapest === 0 ? "starting free" : `from ${packagePriceLabel(cheapest)}`
  const closing =
    programs.length === 0
      ? {
          title: "Start in another school",
          body: "Every program open today, across all eight schools, is in one list — each with its level and price.",
          cta: { href: "/programs", label: "Browse all programs" },
        }
      : only
        ? {
            title: `Begin with ${only.title}`,
            body: `The ${school.short} program, ${programPriceLabel(only).toLowerCase()}. Its page has the full curriculum and the packages to choose from.`,
            cta: { href: `/programs/${only.slug}`, label: `Explore ${only.title}` },
          }
        : {
            title: "Find your program",
            body: `${plural(programs.length, "program")} in the ${school.name}${fromText ? `, ${fromText}` : ""}. Open one to see its curriculum and choose a package.`,
            cta: { href: "#programs", label: "View programs" },
          }

  const links: SectionLink[] = [
    { id: "programs", label: "Programs" },
    programs.length > 1 ? { id: "compare", label: "Compare" } : null,
    hasTopics ? { id: "learn", label: "What you’ll learn" } : null,
    hasPath ? { id: "path", label: "Path" } : null,
    previews.length > 0 ? { id: "free-lessons", label: "Free lessons" } : null,
    facultyMembers.length > 0 ? { id: "faculty", label: "Faculty" } : null,
    hasReviews ? { id: "reviews", label: "Reviews" } : null,
    { id: "faq", label: "FAQ" },
    { id: "other-schools", label: "Other schools" },
  ].filter((link): link is SectionLink => link !== null)

  return (
    <PreviewProvider previews={previews} programTitle={school.name}>
      <article>
        <SchoolHero
          school={school}
          cover={cover}
          programs={programs}
          rating={reviews.summary}
          primary={primary}
          secondary={secondary}
        />

        {/* The nav's container runs to the end of "Other schools", so it stays
            stuck through every section and lets go before the closing band. */}
        <div>
          <div className="sticky top-14 z-40 h-12 border-b border-ws-hairline bg-ws-page sm:top-16">
            <div className="mx-auto h-full max-w-7xl px-6">
              <SectionNav links={links} />
            </div>
          </div>

          <SchoolPrograms school={school} programs={programs} />
          <SchoolCompare programs={programs} schoolName={school.name} />
          <SchoolTopics programs={programs} />
          <SchoolPath programs={programs} />
          <SchoolFreeLessons previews={previews} />
          <SchoolFaculty members={facultyMembers} />
          <SchoolReviews data={reviews} />
          <div className="pt-6 md:pt-10">
            <Faq />
          </div>
          <OtherSchools school={school} counts={counts} cheapest={cheapestAll} total={catalogue.length} />
        </div>

        <SchoolClosing school={school} cover={cover} {...closing} />

        {programs.length > 0 && (
          <SchoolStickyBar
            cta={primary}
            name={school.short}
            icon={school.icon}
            meta={[plural(programs.length, "program"), fromText].filter(Boolean).join(" · ")}
          />
        )}
      </article>
    </PreviewProvider>
  )
}
