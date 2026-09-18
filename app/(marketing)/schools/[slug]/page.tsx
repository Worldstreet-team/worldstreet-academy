import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"
import { SCHOOL_BY_SLUG, isSchoolSlug } from "@/lib/schools"
import { schoolCover } from "@/lib/school-art"
import { cn } from "@/lib/utils"
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

      {/* With a cover, the header IS the banner from md: a 21:9 frame with
          the icon, name, tagline and the one gold action on the render's
          deliberately dark left side, over a left-to-right
          `--ws-overlay-scrim` fade, so both the h1 and the CTA sit inside
          the first viewport at 1280x800 and 1024x768. The render is dark in
          both themes, so the text on it is white in both. The header does
          not clip: an aspect-ratio box grows to fit its content only while
          overflow is visible, so the cover carries its own rounded,
          clipped frame behind the text. Below md the same elements stack
          (the render, then the text in ink) — a narrower column to the
          left of a 21:9 frame stops fitting the longer school names.
          Cropped at 65% down (80% across once the frame outgrows 21:9) so
          each object keeps the top of its plinth and stays on the right.
          `unoptimized`: the source is 1600px and ~22KB, and the optimiser's
          q75 re-encode is larger and bands the dark gradient. */}
      <header
        className={cn(
          "mt-8",
          cover
            ? "rise relative md:flex md:aspect-[21/9] md:flex-col md:items-start md:justify-center md:px-14 md:py-10"
            : "max-w-3xl"
        )}
      >
        {cover && (
          <div className="relative aspect-[16/10] overflow-hidden rounded-[20px] border border-ws-hairline bg-ws-sunken sm:aspect-[21/9] md:absolute md:inset-0 md:aspect-auto">
            <Image
              src={cover}
              alt=""
              fill
              priority
              unoptimized
              className="object-cover object-[center_65%] md:object-[80%_65%]"
            />
            <span
              aria-hidden
              className="absolute inset-0 hidden bg-linear-to-r from-[var(--ws-overlay-scrim)] via-[var(--ws-overlay-scrim)] via-25% to-transparent to-60% md:block"
            />
          </div>
        )}
        <span
          className={cn(
            "relative flex h-12 w-12 items-center justify-center rounded-full bg-ws-brand/10 text-ws-gold",
            cover && "mt-8 md:mt-0 md:text-ws-brand"
          )}
        >
          <SchoolIcon name={school.icon} size={22} />
        </span>
        <h1
          className={cn(
            "relative mt-6 font-display text-[length:clamp(2rem,4.5vw,3.5rem)] font-semibold leading-[1.05] tracking-[-0.02em] text-ws-primary",
            cover && "md:max-w-[min(28rem,40%)] md:text-[length:clamp(2rem,3.6vw,3rem)] md:text-white"
          )}
        >
          {school.name}
        </h1>
        {school.tagline && (
          <p
            className={cn(
              "relative mt-4 font-display text-xl font-medium text-ws-primary md:text-2xl",
              cover && "md:max-w-[min(28rem,40%)] md:text-[22px] md:text-white/80"
            )}
          >
            {school.tagline}
          </p>
        )}
        <Link
          href={`/dashboard/start?school=${school.slug}`}
          className="relative mt-8 inline-flex h-12 items-center justify-center rounded-full bg-ws-brand px-7 text-[15px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"
        >
          Start with this school
        </Link>
      </header>

      {/* The intro reads after the header at every size, so the reading order
          matches what is on screen; on the cover it would make the overlay
          taller than the frame. */}
      <p className="mt-8 max-w-3xl text-[15px] leading-relaxed text-ws-muted md:mt-10 md:text-[17px]">
        {school.intro ?? school.blurb}
      </p>

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
