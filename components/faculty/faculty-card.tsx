import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { FacultyMember } from "@/lib/actions/student"
import { countryName } from "@/lib/countries"
import { facultyHref, facultyInitials } from "@/lib/faculty"

/**
 * One faculty member (spec §10): photo, name, area of specialization (the
 * headline until one is set), country, up to four expertise chips and how many
 * programs they teach. The whole card is one link. v2 card shape: `card`
 * fill, 20px corners, fill-separated in dark (hairline in light), hover lifts
 * one ladder step. Server-safe (no hooks): /faculty and the homepage teaser
 * both render it under a section h2.
 */
export function FacultyCard({ member }: { member: FacultyMember }) {
  const line = member.specialization ?? member.headline
  const country = countryName(member.country)

  return (
    <Link
      href={facultyHref(member.username)}
      className="group flex h-full flex-col rounded-[20px] border border-ws-hairline bg-ws-surface p-6 transition-colors duration-[var(--ws-motion-base)] hover:bg-ws-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 dark:border-transparent"
    >
      <Avatar className="h-[72px] w-[72px]">
        {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt="" />}
        <AvatarFallback className="bg-ws-brand/[0.12] text-base font-semibold text-ws-gold">
          {facultyInitials(member.name)}
        </AvatarFallback>
      </Avatar>
      <h3 className="mt-6 break-words font-display text-[18px] font-semibold leading-snug tracking-[-0.01em] text-ws-primary">
        {member.name}
      </h3>
      {line && <p className="mt-1.5 break-words text-[13.5px] leading-relaxed text-ws-muted">{line}</p>}
      {country && <p className="mt-1 text-[12.5px] text-ws-muted">{country}</p>}
      {member.expertise.length > 0 && (
        <span className="mt-4 flex flex-wrap gap-1.5">
          {member.expertise.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="max-w-full truncate rounded-full bg-ws-chip px-2.5 py-1 text-[11.5px] font-medium text-ws-muted"
            >
              {tag}
            </span>
          ))}
        </span>
      )}
      <span className="mt-auto flex items-center justify-between gap-3 pt-6 text-[13px]">
        <span className="tabular-nums text-ws-muted">
          {member.courseCount === 1 ? "1 program" : `${member.courseCount} programs`}
        </span>
        <span className="inline-flex items-center gap-1.5 font-semibold text-ws-muted transition-colors duration-[var(--ws-motion-fast)] group-hover:text-ws-primary">
          View profile
          <ArrowRightIcon
            size={14}
            aria-hidden
            className="transition-transform duration-200 group-hover:translate-x-0.5"
          />
        </span>
      </span>
    </Link>
  )
}
