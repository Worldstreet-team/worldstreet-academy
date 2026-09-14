import type { Metadata } from "next"
import { cache } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeftIcon, AwardIcon, ExternalLinkIcon, GlobeIcon, type LucideIcon } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ProgramRow } from "@/components/marketing/program-row"
import { fetchBrowseCourses, fetchFacultyProfile } from "@/lib/actions/student"
import { appUrl } from "@/lib/app-url"
import { BRAND } from "@/lib/brand"
import { countryName } from "@/lib/countries"
import { facultyHref, facultyInitials } from "@/lib/faculty"

// Profile edits, role changes and publishing all change this page.
export const revalidate = 0

type Params = { params: Promise<{ username: string }> }

// generateMetadata and the page both need the profile; dedupe the read.
const getProfile = cache((username: string) => fetchFacultyProfile(username))

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { username } = await params
  const profile = await getProfile(username)
  if (!profile) return {}
  return {
    title: profile.name,
    description:
      profile.specialization ?? profile.headline ?? profile.bio?.slice(0, 160) ?? `${profile.name} teaches at ${BRAND.name}.`,
    alternates: { canonical: appUrl(facultyHref(profile.username)) },
  }
}

/**
 * `/faculty/[username]` — one instructor's public profile with the seven
 * spec §10 fields: photo, name, area of specialization, short biography,
 * professional experience, courses taught and credentials/achievements — plus
 * headline, country, expertise and links. Unknown usernames, students and
 * instructors without a published program 404.
 */
export default async function FacultyProfilePage({ params }: Params) {
  const { username } = await params
  const profile = await getProfile(username)
  if (!profile) notFound()

  const courses = await fetchBrowseCourses({ instructorId: profile.id })
  const country = countryName(profile.country)
  const subline = [profile.headline, country].filter(Boolean).join(" · ")
  const links = (
    [
      { href: profile.socialLinks.website, label: "Website", icon: GlobeIcon },
      { href: profile.socialLinks.linkedin, label: "LinkedIn", icon: ExternalLinkIcon },
      { href: profile.socialLinks.twitter, label: "X (Twitter)", icon: ExternalLinkIcon },
    ] satisfies { href: string | null; label: string; icon: LucideIcon }[]
  ).filter((link): link is { href: string; label: string; icon: LucideIcon } => link.href !== null)

  return (
    <div className="mx-auto max-w-7xl px-6 pb-24 pt-10 md:pb-32 md:pt-16">
      <Link
        href="/faculty"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary"
      >
        <ArrowLeftIcon size={14} aria-hidden />
        All faculty
      </Link>

      <header className="mt-8 flex max-w-4xl flex-col gap-6 sm:flex-row sm:items-start">
        <Avatar className="h-24 w-24 shrink-0">
          {profile.avatarUrl && <AvatarImage src={profile.avatarUrl} alt={profile.name} />}
          <AvatarFallback className="bg-ws-brand/10 text-2xl font-semibold text-ws-gold">
            {facultyInitials(profile.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ws-gold">Faculty</p>
          <h1
            className="mt-3 break-words font-display font-semibold leading-[1.05] tracking-[-0.02em] text-ws-primary"
            style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)" }}
          >
            {profile.name}
          </h1>
          {profile.specialization && (
            <p className="mt-3 break-words font-display text-xl font-medium text-ws-primary md:text-2xl">
              {profile.specialization}
            </p>
          )}
          {subline && <p className="mt-2 break-words text-[15px] text-ws-muted">{subline}</p>}
          {profile.expertise.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Areas of expertise">
              {profile.expertise.map((tag) => (
                <li
                  key={tag}
                  className="max-w-full truncate rounded-full bg-ws-chip px-2.5 py-1 text-[12px] font-medium text-ws-muted"
                >
                  {tag}
                </li>
              ))}
            </ul>
          )}
          {links.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-2">
              {links.map(({ href, label, icon: Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-ws-hairline px-3.5 text-[13px] font-medium text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised"
                  >
                    <Icon size={14} aria-hidden />
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </header>

      {profile.bio && (
        <section className="mt-16 border-t border-ws-hairline pt-10" aria-labelledby="about-heading">
          <h2 id="about-heading" className="font-display text-2xl font-semibold tracking-[-0.015em] text-ws-primary">
            About
          </h2>
          <p className="mt-4 max-w-3xl whitespace-pre-line break-words text-[15px] leading-relaxed text-ws-muted md:text-[17px]">
            {profile.bio}
          </p>
        </section>
      )}

      {profile.experience && (
        <section className="mt-16 border-t border-ws-hairline pt-10" aria-labelledby="experience-heading">
          <h2 id="experience-heading" className="font-display text-2xl font-semibold tracking-[-0.015em] text-ws-primary">
            Professional experience
          </h2>
          <p className="mt-4 max-w-3xl whitespace-pre-line break-words text-[15px] leading-relaxed text-ws-muted md:text-[17px]">
            {profile.experience}
          </p>
        </section>
      )}

      {profile.credentials.length > 0 && (
        <section className="mt-16 border-t border-ws-hairline pt-10" aria-labelledby="credentials-heading">
          <h2 id="credentials-heading" className="font-display text-2xl font-semibold tracking-[-0.015em] text-ws-primary">
            Credentials &amp; achievements
          </h2>
          <ul className="mt-6 grid max-w-3xl gap-3">
            {profile.credentials.map((item) => (
              <li key={item} className="flex items-start gap-3 text-[15px] leading-relaxed text-ws-primary">
                <AwardIcon size={16} className="mt-1 shrink-0 text-ws-muted" aria-hidden />
                <span className="min-w-0 break-words">{item}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {courses.length > 0 && (
        <section className="mt-16 border-t border-ws-hairline pt-10" aria-labelledby="courses-heading">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="courses-heading" className="font-display text-2xl font-semibold tracking-[-0.015em] text-ws-primary">
              Courses taught
            </h2>
            <span className="text-[13px] tabular-nums text-ws-subtle">
              {courses.length === 1 ? "1 program" : `${courses.length} programs`}
            </span>
          </div>
          <ul className="mt-8 grid gap-4">
            {courses.map((course) => (
              <ProgramRow key={course.id} course={course} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
