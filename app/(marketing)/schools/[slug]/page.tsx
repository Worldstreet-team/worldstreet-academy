import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"
import { SCHOOL_BY_SLUG, isSchoolSlug } from "@/lib/schools"
import { schoolCover } from "@/lib/school-art"
import { fetchBrowseCourses } from "@/lib/actions/student"
import { SchoolIcon } from "@/components/shared/school-icon"
import { ProgramRow } from "@/components/marketing/program-row"
import { appUrl } from "@/lib/app-url"

// Published/coming-soon state of a school's programs changes under a cached render.
export const revalidate = 0

type Params = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  if (!isSchoolSlug(slug)) return {}
  const school = SCHOOL_BY_SLUG[slug]
  return {
    title: school.name,
    description: school.tagline ?? school.blurb,
    alternates: { canonical: appUrl(`/schools/${school.slug}`) },
  }
}

/**
 * `/schools/[slug]` — spec §5: the school's tagline and intro from config,
 * then its published programs from the catalogue. Unknown slugs 404.
 */
export default async function SchoolPage({ params }: Params) {
  const { slug } = await params
  if (!isSchoolSlug(slug)) notFound()
  const school = SCHOOL_BY_SLUG[slug]
  const programs = await fetchBrowseCourses({ school: slug })
  const cover = schoolCover(school.slug)

  return (
    <div className="mx-auto max-w-7xl px-6 pb-24 pt-10 md:pb-32 md:pt-16">
      <Link
        href="/schools"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary"
      >
        <ArrowLeftIcon size={14} aria-hidden />
        All schools
      </Link>

      {/* The school's cover as a banner. 21:9 from sm, cropped at 65% so
          every render keeps both its object and the top of its plinth; a
          phone shows the whole 16:10 render instead of a 146px strip. The
          hairline gives the frame an edge where the render's dark left third
          meets the dark page. `unoptimized`: the source is 1600px and ~22KB,
          and the optimiser's q75 re-encode is larger and bands the gradient. */}
      {cover && (
        <div className="rise relative mt-8 aspect-[16/10] overflow-hidden rounded-[20px] border border-ws-hairline bg-ws-sunken sm:aspect-[21/9]">
          <Image src={cover} alt="" fill priority unoptimized className="object-cover object-[center_65%]" />
        </div>
      )}

      <header className="mt-8 max-w-3xl">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ws-brand/10 text-ws-gold">
          <SchoolIcon name={school.icon} size={22} />
        </span>
        <h1
          className="mt-6 font-display font-semibold leading-[1.05] tracking-[-0.02em] text-ws-primary"
          style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)" }}
        >
          {school.name}
        </h1>
        {school.tagline && (
          <p className="mt-4 font-display text-xl font-medium text-ws-primary md:text-2xl">{school.tagline}</p>
        )}
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ws-muted md:text-[17px]">
          {school.intro ?? school.blurb}
        </p>
        <Link
          href={`/dashboard/start?school=${school.slug}`}
          className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-ws-brand px-7 text-[15px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"
        >
          Start with this school
        </Link>
      </header>

      <section className="mt-16 border-t border-ws-hairline pt-10" aria-labelledby="programs-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="programs-heading" className="font-display text-2xl font-semibold tracking-[-0.015em] text-ws-primary">
            Available programs
          </h2>
          <span className="text-[13px] tabular-nums text-ws-subtle">
            {programs.length === 1 ? "1 program" : `${programs.length} programs`}
          </span>
        </div>

        {programs.length > 0 ? (
          <ul className="mt-8 grid gap-4">
            {programs.map((course) => (
              <ProgramRow key={course.id} course={course} />
            ))}
          </ul>
        ) : (
          <div className="mt-8 rounded-lg border border-dashed border-ws-hairline p-10 text-center">
            <p className="font-display text-lg font-semibold text-ws-primary">Programs coming soon</p>
            <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-ws-muted">
              This school&apos;s first programs are being prepared. Explore the other schools in the meantime.
            </p>
            <Link
              href="/schools"
              className="mt-6 inline-flex h-11 items-center justify-center rounded-sm border border-ws-hairline px-6 text-[14px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:border-ws-brand/40 hover:text-ws-gold"
            >
              Explore the schools
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}
