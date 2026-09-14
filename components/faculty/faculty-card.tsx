import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { FacultyMember } from "@/lib/actions/student"
import { countryName } from "@/lib/countries"
import { facultyHref, facultyInitials } from "@/lib/faculty"

/**
 * One faculty member (spec §10): photo, name, area of specialization (the
 * headline until one is set), country, up to four expertise chips and how many
 * programs they teach. The whole card is one link. Server-safe (no hooks):
 * /faculty and the homepage teaser both render it under a section h2.
 */
export function FacultyCard({ member }: { member: FacultyMember }) {
  const line = member.specialization ?? member.headline
  const country = countryName(member.country)

  return (
    <Link
      href={facultyHref(member.username)}
      className="group flex h-full flex-col rounded-lg border border-ws-hairline bg-ws-surface p-6 transition-colors duration-[var(--ws-motion-base)] hover:border-ws-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
    >
      <Avatar className="h-16 w-16">
        {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt="" />}
        <AvatarFallback className="bg-ws-brand/10 text-sm font-semibold text-ws-gold">
          {facultyInitials(member.name)}
        </AvatarFallback>
      </Avatar>
      <h3 className="mt-5 break-words font-display text-[17px] font-semibold leading-snug tracking-[-0.01em] text-ws-primary">
        {member.name}
      </h3>
      {line && <p className="mt-1 break-words text-[13px] leading-relaxed text-ws-muted">{line}</p>}
      {country && <p className="mt-1 text-[12px] text-ws-subtle">{country}</p>}
      {member.expertise.length > 0 && (
        <span className="mt-4 flex flex-wrap gap-1.5">
          {member.expertise.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="max-w-full truncate rounded-full bg-ws-chip px-2 py-0.5 text-[11px] font-medium text-ws-muted"
            >
              {tag}
            </span>
          ))}
        </span>
      )}
      <span className="mt-auto flex items-center justify-between gap-3 pt-6 text-[13px]">
        <span className="tabular-nums text-ws-subtle">
          {member.courseCount === 1 ? "1 program" : `${member.courseCount} programs`}
        </span>
        <span className="inline-flex items-center gap-1.5 font-semibold text-ws-muted transition-colors duration-[var(--ws-motion-fast)] group-hover:text-ws-primary">
          View profile
          <ArrowRightIcon size={14} aria-hidden />
        </span>
      </span>
    </Link>
  )
}
