import Link from "next/link"
import { BadgeCheckIcon, ChevronRightIcon, UsersIcon } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

/**
 * Public instructor block (spec §6 "instructor"). No Message button — that
 * needs a signed-in conversation. The profile link is the dashboard one and
 * therefore only offered to signed-in visitors (it would bounce a guest
 * through the login wall); `/faculty/[username]` arrives in Phase 5.
 */
export function ProgramInstructor({
  id,
  name,
  avatarUrl,
  headline,
  bio,
  totalStudents,
  signedIn,
}: {
  id: string
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

  return (
    <section className="mt-16 border-t border-ws-hairline pt-10" aria-labelledby="instructor-heading">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ws-gold">Faculty</p>
      <h2
        id="instructor-heading"
        className="mt-3 font-display text-2xl font-semibold tracking-[-0.015em] text-ws-primary"
      >
        About the instructor
      </h2>
      <div className="mt-8 flex max-w-3xl flex-col gap-5 rounded-lg border border-ws-hairline bg-ws-surface p-6 sm:flex-row sm:items-start">
        <Avatar className="h-16 w-16 shrink-0">
          {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
          <AvatarFallback className="bg-ws-brand/10 text-sm font-semibold text-ws-gold">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-display text-lg font-semibold text-ws-primary">
            {name}
            <BadgeCheckIcon size={16} className="shrink-0 text-ws-gold" aria-label="Verified instructor" />
          </p>
          {headline && <p className="mt-0.5 text-[14px] text-ws-muted">{headline}</p>}
          {totalStudents > 0 && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-ws-muted">
              <UsersIcon size={13} aria-hidden />
              <span className="font-medium tabular-nums text-ws-primary">{totalStudents.toLocaleString("en-US")}</span>
              {totalStudents === 1 ? "student" : "students"}
            </p>
          )}
          {bio && <p className="mt-4 text-[15px] leading-relaxed text-ws-muted">{bio}</p>}
          {signedIn && (
            <Link
              href={`/dashboard/instructor/${id}`}
              className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-ws-gold hover:underline"
            >
              View full profile
              <ChevronRightIcon size={14} aria-hidden />
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}
