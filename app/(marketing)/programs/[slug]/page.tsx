import type { Metadata } from "next"
import { cache } from "react"
import { notFound, permanentRedirect } from "next/navigation"
import { fetchProgramBySlug } from "@/lib/actions/student"
import { appUrl } from "@/lib/app-url"
import { checkEnrollment } from "@/lib/actions/enrollments"
import { getCachedUser } from "@/lib/auth/cached"
import { courseAvailability } from "@/lib/types/course"
import { ProgramHero } from "@/components/programs/program-hero"
import { CourseOutcomes } from "@/components/courses/course-outcomes"
import { WhatsIncluded } from "@/components/programs/whats-included"
import { ProgramInstructor } from "@/components/programs/program-instructor"
import { Faq } from "@/components/marketing/faq"
import type { ProgramAccess } from "@/components/programs/access"
import { PackageLadder } from "@/components/programs/package-ladder"
import { ProgramStickyBar } from "@/components/programs/program-sticky-bar"

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
  return {
    title: program.title,
    description: program.shortDescription ?? program.description.slice(0, 160),
    alternates: { canonical: appUrl(`/programs/${program.slug}`) },
  }
}

/**
 * `/programs/[slug]` — spec §6–§9 in order: hero, what you'll learn, the
 * package ladder (Task 3), what's included, the instructor, the FAQ.
 * Unknown or unpublished slugs 404.
 */
export default async function ProgramPage({ params }: Params) {
  const { slug } = await params
  // Slugs are stored lowercase; any other casing redirects to the one URL.
  if (slug !== slug.toLowerCase()) permanentRedirect(`/programs/${slug.toLowerCase()}`)
  const program = await getProgram(slug)
  if (!program) notFound()

  const user = await getCachedUser()
  const enrollment = user ? await checkEnrollment(user.id, program.id) : null
  const isEnrolled = enrollment?.isEnrolled ?? false
  const isPreEnrolled = enrollment?.status === "pre_enrolled"
  const isComingSoon =
    courseAvailability({ status: "published", availableAt: program.availableAt }) === "coming_soon"

  // Fall back to the course home when there is nothing to resume into.
  const access: ProgramAccess = isEnrolled
    ? {
        kind: "enrolled",
        continueHref: enrollment?.resumeLessonId
          ? `/dashboard/courses/${program.id}/learn/${enrollment.resumeLessonId}`
          : `/dashboard/courses/${program.id}`,
      }
    : isComingSoon
      ? { kind: "coming_soon" }
      : { kind: "open" }
  // Only while coming soon: a live reservation buys through the ladder, whose links carry the package.
  const scheduling = !isEnrolled && isComingSoon ? { isComingSoon, isPreEnrolled } : null
  // One price source for the hero and the sticky bar: the tiers the ladder renders.
  const fromPrice = Math.min(...program.packages.map((p) => p.price))
  const multiTier = program.packages.length > 1
  const hasOutcomes =
    program.whatYouWillLearn.length + program.requirements.length + program.targetAudience.length > 0

  return (
    <article className="pb-24 md:pb-32">
      <ProgramHero
        program={program}
        access={access}
        scheduling={scheduling}
        signedIn={Boolean(user)}
        fromPrice={fromPrice}
        multiTier={multiTier}
      />
      <div className="mx-auto max-w-7xl px-6">
        {hasOutcomes && (
          <div className="mt-16">
            <CourseOutcomes
              whatYouWillLearn={program.whatYouWillLearn}
              requirements={program.requirements}
              targetAudience={program.targetAudience}
            />
          </div>
        )}
        <PackageLadder courseId={program.id} packages={program.packages} access={access} />
        <WhatsIncluded />
        <ProgramInstructor
          id={program.instructorId}
          name={program.instructorName}
          avatarUrl={program.instructorAvatarUrl}
          headline={program.instructorHeadline}
          bio={program.instructorBio}
          totalStudents={program.instructorTotalStudents}
          signedIn={Boolean(user)}
        />
      </div>
      <Faq />
      {access.kind === "open" && (
        <ProgramStickyBar fromPrice={fromPrice} multiTier={multiTier} />
      )}
    </article>
  )
}
