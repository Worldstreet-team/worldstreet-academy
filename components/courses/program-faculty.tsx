import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MessageInstructorButton } from "@/app/(platform)/dashboard/instructor/[instructorId]/message-instructor-button"
import type { ProgramTeacher } from "@/lib/teaching"

/*
 * A program's assigned faculty on a learner's course page (owner, 2026-10-19):
 * they teach it, so they stand in for the owner, each with their own Message
 * button. The Q&A gate (instructorQaRefusal) counts them like the owner, so a
 * plan without instructor Q&A gets the same note it gets for the owner.
 */

function initials(name: string): string {
  return (
    name
      .split(" ")
      .map((part) => part[0]?.toUpperCase())
      .join("")
      .slice(0, 2) || "?"
  )
}

export function ProgramFaculty({ members, canMessage }: { members: ProgramTeacher[]; canMessage: boolean }) {
  return (
    <section aria-labelledby="program-faculty-heading" className="space-y-5">
      <h2 id="program-faculty-heading" className="text-base font-semibold">
        {members.length === 1 ? "Instructor" : "Instructors"}
      </h2>
      <div className="divide-y divide-border/60 rounded-lg bg-muted/30">
        {members.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center gap-4 p-5">
            <Avatar className="h-12 w-12 shrink-0 shadow-sm ring-2 ring-background">
              {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt={m.name} />}
              <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">{initials(m.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[15px] font-semibold">{m.name}</h3>
              <p className="line-clamp-1 text-[13px] text-muted-foreground">{m.headline || "Program faculty"}</p>
              <Link
                href={`/dashboard/instructor/${m.id}`}
                className="text-xs text-muted-foreground transition-colors hover:text-primary"
              >
                View profile
              </Link>
            </div>
            {canMessage ? (
              <MessageInstructorButton instructorId={m.id} label="Message" variant="outline" ariaLabel={`Message ${m.name}`} />
            ) : (
              <p className="max-w-40 text-right text-[11px] leading-snug text-ws-muted">
                Instructor Q&amp;A isn&apos;t in your plan
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
