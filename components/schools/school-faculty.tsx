import Link from "next/link"
import Image from "next/image"
import { ArrowRightIcon } from "lucide-react"
import type { FacultyMember, ProgramDetail } from "@/lib/actions/student"
import { facultyHref } from "@/lib/faculty"
import { countryName } from "@/lib/countries"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { initialsOf, plural } from "@/components/programs/format"
import { SCHOOL_SECTION, SectionHead } from "@/components/schools/section-head"

export type SchoolFacultyMember = {
  member: FacultyMember
  /** This school's programs they teach. */
  programs: ProgramDetail[]
  /** `instructorProfile.totalStudents`, as the program page prints it; 0 hides it. */
  students: number
}

/**
 * `#faculty` — who teaches in this school: faculty (INSTRUCTOR/ADMIN with a
 * published program) matched to the school's programs by instructor. Each
 * links to their public `/faculty/<username>` page and names the programs
 * they teach here. Hidden when none of the school's instructors is faculty.
 * One person gets one wide card; more share a grid.
 */
export function SchoolFaculty({ members }: { members: SchoolFacultyMember[] }) {
  if (members.length === 0) return null
  const single = members.length === 1

  return (
    <section id="faculty" aria-labelledby="faculty-heading" className={SCHOOL_SECTION}>
      <SectionHead
        id="faculty-heading"
        title={single ? "Who teaches here" : "The faculty"}
        lede={single ? undefined : `${members.length} instructors teach this school's programs.`}
      />
      <ul className={cn("mt-10 grid gap-5", !single && "lg:grid-cols-2")}>
        {members.map((entry) => (
          <li key={entry.member.id} className="flex min-w-0">
            <FacultyCard entry={entry} wide={single} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function FacultyCard({ entry, wide }: { entry: SchoolFacultyMember; wide: boolean }) {
  const { member, programs, students } = entry
  const href = facultyHref(member.username)
  const country = countryName(member.country)
  const stats = [
    students > 0 ? plural(students, "student") : null,
    plural(member.courseCount, "program"),
    country,
  ].filter((s): s is string => Boolean(s))

  return (
    <article
      className={cn(
        "flex w-full min-w-0 flex-col gap-8 rounded-[20px] border border-ws-hairline bg-ws-surface p-6 dark:border-transparent sm:p-8",
        wide && "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14 lg:p-10"
      )}
    >
      <div>
        <div className="flex items-center gap-5">
          <Avatar className="size-20 shrink-0 sm:size-24">
            {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt="" />}
            <AvatarFallback className="bg-ws-raised text-lg font-semibold text-ws-primary">
              {initialsOf(member.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h3 className="font-display text-[22px] font-semibold leading-tight tracking-[-0.015em] text-ws-primary">
              <Link
                href={href}
                className="rounded-sm decoration-ws-hairline underline-offset-4 transition-colors duration-[var(--ws-motion-fast)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
              >
                {member.name}
              </Link>
            </h3>
            {member.headline && <p className="mt-1.5 text-[15px] leading-snug text-ws-muted">{member.headline}</p>}
            <p className="mt-2.5 text-[13.5px] tabular-nums text-ws-muted">{stats.join(" · ")}</p>
          </div>
        </div>

        {(member.specialization || member.expertise.length > 0) && (
          <div className="mt-6 border-t border-ws-hairline pt-6">
            {member.specialization && (
              <p className="text-[15px] leading-relaxed text-ws-primary">
                <span className="block text-[13px] font-medium text-ws-muted">Specializes in</span>
                {member.specialization}
              </p>
            )}
            {member.expertise.length > 0 && (
              <ul className={cn("flex flex-wrap gap-2", member.specialization && "mt-4")} aria-label="Expertise">
                {member.expertise.map((skill) => (
                  <li key={skill} className="rounded-full bg-ws-chip px-3 py-1 text-[12.5px] font-medium text-ws-primary">
                    {skill}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <Link
          href={href}
          className="mt-7 inline-flex h-11 items-center gap-2 rounded-full border border-ws-hairline px-5 text-[14px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
        >
          View faculty profile
          <ArrowRightIcon size={15} aria-hidden />
        </Link>
      </div>

      {programs.length > 0 && (
        <div className={cn(!wide && "border-t border-ws-hairline pt-6")}>
          <p className="text-[13px] font-semibold text-ws-primary">Teaches in this school</p>
          <ul className="mt-3 space-y-2">
            {programs.map((program) => (
              <li key={program.id}>
                <Link
                  href={`/programs/${program.slug}`}
                  className="group flex items-center gap-4 rounded-[14px] bg-ws-sunken p-2.5 pr-4 transition-colors duration-[var(--ws-motion-base)] hover:bg-ws-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
                >
                  <span className="relative aspect-[16/10] w-20 shrink-0 overflow-hidden rounded-[9px] bg-ws-raised">
                    {program.thumbnailUrl && (
                      <Image src={program.thumbnailUrl} alt="" fill sizes="80px" className="object-cover" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold text-ws-primary">{program.title}</span>
                    <span className="block truncate text-[12.5px] capitalize text-ws-muted">{program.level}</span>
                  </span>
                  <ArrowRightIcon
                    size={15}
                    aria-hidden
                    className="shrink-0 text-ws-muted transition-transform duration-[var(--ws-motion-base)] group-hover:translate-x-0.5 group-hover:text-ws-primary motion-reduce:transition-none"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  )
}
