import type { Metadata } from "next"
import Link from "next/link"
import { cookies } from "next/headers"
import { ArrowLeftIcon } from "lucide-react"
import { fetchBrowseCourses, fetchProgramById } from "@/lib/actions/student"
import { SCHOOLS, SCHOOL_BY_SLUG, cheapestBySchool, countProgramsBySchool, isSchoolSlug } from "@/lib/schools"
import { schoolCover } from "@/lib/school-art"
import { START_SCHOOL_COOKIE, resolveStartStep } from "@/lib/start-gate"
import { courseAvailability } from "@/lib/types/course"
import { SchoolCard } from "@/components/marketing/school-card"
import { ProgramRow } from "@/components/marketing/program-row"
import { PackageChooser } from "@/components/start/package-chooser"
import { SaveSchoolButton } from "@/components/start/save-school-button"
import { StartColumns, StartPanel } from "@/components/start/start-panel"

export const metadata: Metadata = { title: "Choose your school", robots: { index: false, follow: false } }
export const revalidate = 0

type Search = { searchParams: Promise<{ school?: string; program?: string; pick?: string }> }

const SHELL = "mx-auto w-full max-w-6xl px-4 pb-24 pt-10 md:px-6 md:pt-14"

/**
 * The step counter is an eyebrow, and eyebrows are muted (design-system 04):
 * it states where the learner is; the one gold thing on each step is the
 * action that moves them on. `context` names the school once it is chosen.
 */
function StepHeading({
  step,
  of,
  context,
  title,
  lede,
}: {
  step: number
  of: number
  context?: string
  title: string
  lede: string
}) {
  return (
    <header className="rise max-w-2xl">
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ws-muted">
        Step <span className="tabular-nums">{step}</span> of <span className="tabular-nums">{of}</span>
        {context && <> · {context}</>}
      </p>
      <h1
        className="mt-4 text-balance font-display font-semibold leading-[1.05] tracking-[-0.02em] text-ws-primary"
        style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
      >
        {title}
      </h1>
      <p className="mt-4 text-pretty text-[15px] leading-relaxed text-ws-muted md:text-[17px]">{lede}</p>
    </header>
  )
}

function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary"
    >
      <ArrowLeftIcon size={14} aria-hidden />
      {children}
    </Link>
  )
}

const panelEyebrow = "text-[12px] font-semibold uppercase tracking-[0.08em] text-ws-muted"

/**
 * `/dashboard/start` — school first (owner, 2026-09-16). Steps are URL-driven:
 * `?school=` then `?program=`, so Back works and the landing can deep-link. A
 * guest's landing choice arrives by URL, or by the `wsa_school` cookie when
 * the sign-in round trip dropped the query. `?pick=1` forces the school step.
 */
export default async function StartPage({ searchParams }: Search) {
  const params = await searchParams
  const remembered = (await cookies()).get(START_SCHOOL_COOKIE)?.value
  const schoolParam = params.pick ? undefined : (params.school ?? remembered)

  const published = (await fetchBrowseCourses()).filter((c) => c.status === "published")
  const inSchool = isSchoolSlug(schoolParam) ? published.filter((c) => c.school === schoolParam) : []
  const step = resolveStartStep({ school: schoolParam, program: params.program, programIds: inSchool.map((c) => c.id) })

  if (step.step === "school") {
    const counts = countProgramsBySchool(published)
    const cheapest = cheapestBySchool(published)
    return (
      <div className={SHELL}>
        <StepHeading
          step={1}
          of={3}
          title="Choose your school"
          lede="Your future can take many directions. Pick the one that matches your goals — you can add another school later."
        />
        <ul className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {SCHOOLS.map((school, i) => (
            <li key={school.slug} className="rise" style={{ "--rise-delay": `${i * 45}ms` } as React.CSSProperties}>
              <SchoolCard
                school={school}
                count={counts[school.slug]}
                fromPrice={cheapest[school.slug]}
                headingLevel="h2"
                href={`/dashboard/start?school=${school.slug}`}
                cta="Choose school"
                priority={i < 4}
              />
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const school = SCHOOL_BY_SLUG[step.school]
  const cover = schoolCover(school.slug)

  if (step.step === "waitlist") {
    return (
      <div className={SHELL}>
        <BackLink href="/dashboard/start?pick=1">All schools</BackLink>
        <div className="mt-8">
          <StartColumns
            intro={
              <StepHeading
                step={2}
                of={2}
                title={school.name}
                lede="This school's first programs are being prepared. Save it and it will be waiting on your dashboard the day they open."
              />
            }
            panel={
              <StartPanel cover={cover}>
                <p className={panelEyebrow}>Programs opening soon</p>
                <p className="mt-2 text-[14px] leading-relaxed text-ws-muted">{school.blurb}</p>
                <div className="mt-6">
                  <SaveSchoolButton school={school.slug} />
                </div>
              </StartPanel>
            }
          />
        </div>
      </div>
    )
  }

  if (step.step === "program") {
    return (
      <div className={SHELL}>
        <BackLink href="/dashboard/start?pick=1">All schools</BackLink>
        <div className="mt-8">
          <StepHeading
            step={2}
            of={3}
            context={school.short}
            title="Choose your program"
            lede={school.tagline ?? school.blurb}
          />
        </div>
        <ul className="rise mt-10 grid gap-4 lg:grid-cols-2" style={{ "--rise-delay": "90ms" } as React.CSSProperties}>
          {inSchool.map((course) => (
            <ProgramRow
              key={course.id}
              course={course}
              href={`/dashboard/start?school=${school.slug}&program=${course.id}`}
            />
          ))}
        </ul>
      </div>
    )
  }

  // step.step === "package"
  const program = await fetchProgramById(step.courseId)
  const single = inSchool.length === 1
  const back = single ? "/dashboard/start?pick=1" : `/dashboard/start?school=${school.slug}`
  if (!program) {
    return (
      <div className={SHELL}>
        <BackLink href={back}>Back</BackLink>
        <p className="mt-8 text-[15px] text-ws-muted">That program isn&apos;t available right now.</p>
      </div>
    )
  }
  const comingSoon = courseAvailability({ status: "published", availableAt: program.availableAt }) === "coming_soon"

  const intro = (
    <>
      <StepHeading
        step={single ? 2 : 3}
        of={single ? 2 : 3}
        title={program.title}
        lede={program.shortDescription ?? program.description}
      />
      <p className="rise mt-5 text-[13px] font-medium text-ws-muted" style={{ "--rise-delay": "45ms" } as React.CSSProperties}>
        <Link
          href={`/programs/${program.slug}`}
          className="underline decoration-ws-hairline underline-offset-4 transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary hover:decoration-current"
        >
          See the full curriculum
        </Link>
      </p>
    </>
  )

  return (
    <div className={SHELL}>
      <BackLink href={back}>{single ? "All schools" : school.short}</BackLink>
      <div className="mt-8">
        {comingSoon ? (
          // Pre-enrolment lives on the program page; here the learner keeps the school.
          <StartColumns
            intro={intro}
            panel={
              <StartPanel cover={cover}>
                <p className={panelEyebrow}>
                  {program.availableAt
                    ? `Opens ${new Date(program.availableAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
                    : "Opens soon"}
                </p>
                <p className="mt-2 text-[14px] leading-relaxed text-ws-muted">
                  This program opens soon. Reserve your seat on its page, or save the school and come back.
                </p>
                <div className="mt-6 grid gap-2.5">
                  <Link
                    href={`/programs/${program.slug}`}
                    className="inline-flex h-12 w-full items-center justify-center rounded-full bg-ws-brand px-6 text-[15px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ws-surface"
                  >
                    View program
                  </Link>
                  <SaveSchoolButton school={school.slug} variant="secondary" />
                </div>
              </StartPanel>
            }
          />
        ) : (
          <PackageChooser
            school={school.slug}
            courseId={program.id}
            programSlug={program.slug}
            packages={program.packages}
            tierCount={program.tierCount}
            cover={cover}
            intro={intro}
          />
        )}
      </div>
    </div>
  )
}
