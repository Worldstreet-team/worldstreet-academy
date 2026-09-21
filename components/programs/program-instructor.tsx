import Link from "next/link"
import { ArrowRightIcon, BookOpenIcon, UsersIcon } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { facultyHref } from "@/lib/faculty"
import { ClampedText } from "@/components/programs/clamped-text"
import { initialsOf, plural } from "@/components/programs/format"
import { PROGRAM_H2, SECTION_SCROLL_MT } from "@/components/programs/section-title"

/**
 * Public instructor block (spec §6 "instructor"). No Message button — that
 * needs a signed-in conversation. When the instructor is faculty the block
 * links their public `/faculty/[username]` page for every visitor; otherwise
 * only signed-in visitors get the dashboard profile (it would bounce a guest
 * through the login wall).
 *
 * One card: identity row (large avatar, name, headline), the stats that are
 * real (students when any, programs when more than this one), then the bio,
 * clamped with Show more.
 */
export function ProgramInstructor({
  id,
  sectionId,
  username,
  name,
  avatarUrl,
  headline,
  bio,
  totalStudents,
  programCount,
  signedIn,
}: {
  id: string
  sectionId: string
  /** Faculty URL key; null when the instructor isn't faculty, so there is no page to link. */
  username: string | null
  name: string
  avatarUrl: string | null
  headline: string | null
  bio: string | null
  totalStudents: number
  /** Published programs this instructor teaches, this one included. */
  programCount: number
  signedIn: boolean
}) {
  const profileHref = username ? facultyHref(username) : signedIn ? `/dashboard/instructor/${id}` : null
  const stats = [
    totalStudents > 0 ? { icon: UsersIcon, label: plural(totalStudents, "student") } : null,
    programCount > 1 ? { icon: BookOpenIcon, label: plural(programCount, "program") } : null,
  ].filter(Boolean) as Array<{ icon: typeof UsersIcon; label: string }>

  return (
    <section id={sectionId} aria-labelledby="instructor-heading" className={SECTION_SCROLL_MT}>
      <h2 id="instructor-heading" className={PROGRAM_H2}>
        Your instructor
      </h2>

      <div className="mt-5 rounded-[20px] border border-ws-hairline bg-ws-surface p-6 dark:border-transparent sm:p-8">
        <div className="flex items-center gap-5">
          <Avatar className="size-20 shrink-0 sm:size-24">
            {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
            <AvatarFallback className="bg-ws-raised text-lg font-semibold text-ws-primary">
              {initialsOf(name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-display text-[22px] font-semibold leading-tight tracking-[-0.015em] text-ws-primary">
              {profileHref ? (
                <Link
                  href={profileHref}
                  className="rounded-sm transition-colors duration-[var(--ws-motion-fast)] hover:underline hover:decoration-ws-hairline hover:underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
                >
                  {name}
                </Link>
              ) : (
                name
              )}
            </p>
            {headline && <p className="mt-1.5 text-[15px] leading-snug text-ws-muted">{headline}</p>}
            {stats.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[14px]">
                {stats.map(({ icon: Icon, label }) => (
                  <li key={label} className="inline-flex items-center gap-1.5 text-ws-muted">
                    <Icon size={15} aria-hidden />
                    <span className="tabular-nums text-ws-primary">{label}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {bio && (
          <div className="mt-6 border-t border-ws-hairline pt-6">
            <ClampedText text={bio} lines={5} className="text-[15px] leading-relaxed text-ws-muted" />
          </div>
        )}

        {profileHref && (
          <Link
            href={profileHref}
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-full border border-ws-hairline px-5 text-[14px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
          >
            {username ? "View faculty profile" : "View full profile"}
            <ArrowRightIcon size={15} aria-hidden />
          </Link>
        )}
      </div>
    </section>
  )
}
