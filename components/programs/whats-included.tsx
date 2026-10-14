import { AwardIcon, CircleHelpIcon, ClipboardListIcon, CompassIcon, DownloadIcon, HandshakeIcon, ListChecksIcon, RadioIcon, SquarePlayIcon, TrendingUpIcon, UsersIcon, type IconComponent } from "@/components/icons"
import { PROGRAM_H2 } from "@/components/programs/section-title"

/** Spec §9 — the eleven inclusions, verbatim and static. */
const INCLUDED: ReadonlyArray<{ label: string; icon: IconComponent }> = [
  { label: "Structured curriculum", icon: ListChecksIcon },
  { label: "Video lessons", icon: SquarePlayIcon },
  { label: "Live classes", icon: RadioIcon },
  { label: "Practical assignments", icon: ClipboardListIcon },
  { label: "Quizzes & assessments", icon: CircleHelpIcon },
  { label: "Downloadable resources", icon: DownloadIcon },
  { label: "Instructor guidance", icon: CompassIcon },
  { label: "Mentorship", icon: HandshakeIcon },
  { label: "Community access", icon: UsersIcon },
  { label: "Progress tracking", icon: TrendingUpIcon },
  { label: "Certificate upon completion", icon: AwardIcon },
]

/**
 * The program page's "What's included?" section. It is the general list, not
 * a promise: what a given tier opens is spelled out in the package chooser,
 * hence the closing note.
 */
export function WhatsIncluded() {
  return (
    <section aria-labelledby="included-heading">
      <h2 id="included-heading" className={PROGRAM_H2}>
        Your learning experience
      </h2>
      <p className="mt-2 text-[15px] text-ws-muted">Depending on the program, students may receive:</p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {INCLUDED.map(({ label, icon: Icon }) => (
          <li
            key={label}
            className="flex items-center gap-3 rounded-[14px] border border-ws-hairline bg-ws-surface px-4 py-3.5 dark:border-transparent"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-ws-brand/[0.13]">
              <Icon size={15} aria-hidden />
            </span>
            <span className="text-[14px] font-medium text-ws-primary">{label}</span>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-[13px] italic text-ws-subtle">Specific inclusions vary by program and package.</p>
    </section>
  )
}
