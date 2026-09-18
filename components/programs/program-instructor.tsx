import Link from "next/link"
import { BadgeCheckIcon, ChevronRightIcon, UsersIcon } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { facultyHref } from "@/lib/faculty"
import { SectionLabel } from "@/components/marketing/section-heading"

/**
 * Public instructor block (spec §6 "instructor"). No Message button — that
 * needs a signed-in conversation. When the instructor is faculty the block
 * links their public `/faculty/[username]` page for every visitor; otherwise
 * only signed-in visitors get the dashboard profile (it would bounce a guest
 * through the login wall).
 *
 * Full width, split two ways: identity on the left, the bio on the right.
 * The old max-w-3xl card left half the row empty at desktop, which read as a
 * gap in the page rather than a deliberate margin.
 */
export function ProgramInstructor({
  id,
  username,
  name,
  avatarUrl,
  headline,
  bio,
  totalStudents,
  signedIn,
}: {
  id: string
  /** Faculty URL key; null when the instructor isn't faculty, so there is no page to link. */
  username: string | null
  name: string
  avatarUrl: string | null
  headline: string | null
  bio: string | null
  totalStudents: number
  signedIn: boolean
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const profileHref = username ? facultyHref(username) : signedIn ? `/dashboard/instructor/${id}` : null

  return (
    <section className="mt-16 border-t border-ws-hairline pt-10" aria-labelledby="instructor-heading">
      <SectionLabel>Faculty</SectionLabel>
      <h2
        id="instructor-heading"
        className="mt-3 font-display text-2xl font-semibold tracking-[-0.015em] text-ws-primary"
      >
        About the instructor
      </h2>

      <div className="mt-8 grid gap-8 rounded-[20px] border border-ws-hairline bg-ws-surface p-6 dark:border-transparent md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:gap-12 md:p-8">
        <div className="flex gap-5">
          <Avatar className="h-20 w-20 shrink-0">
            {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
            <AvatarFallback className="bg-ws-brand/10 text-base font-semibold text-ws-gold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-display text-xl font-semibold text-ws-primary">
              {name}
              <BadgeCheckIcon
                size={16}
                className="shrink-0 text-ws-gold"
                role="img"
                aria-label="Verified instructor"
              />
            </p>
            {headline && <p className="mt-1 text-[14px] leading-relaxed text-ws-muted">{headline}</p>}
            {totalStudents > 0 && (
              <p className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-ws-muted">
                <UsersIcon size={13} aria-hidden />
                <span className="font-medium tabular-nums text-ws-primary">
                  {totalStudents.toLocaleString("en-US")}
                </span>
                {totalStudents === 1 ? "student" : "students"}
              </p>
            )}
          </div>
        </div>

        <div className="min-w-0">
          {bio && <p className="text-[15px] leading-relaxed text-ws-muted">{bio}</p>}
          {profileHref && (
            <Link
              href={profileHref}
              className="mt-5 inline-flex items-center gap-1 text-[13px] font-semibold text-ws-gold hover:underline"
            >
              {username ? "View faculty profile" : "View full profile"}
              <ChevronRightIcon size={14} aria-hidden />
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}
