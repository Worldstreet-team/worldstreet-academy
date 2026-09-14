import {
  AwardIcon,
  CircleHelpIcon,
  ClipboardListIcon,
  CompassIcon,
  DownloadIcon,
  HandshakeIcon,
  ListChecksIcon,
  RadioIcon,
  SquarePlayIcon,
  TrendingUpIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"

/** Spec §9 — the eleven inclusions, verbatim and static. */
const INCLUDED: ReadonlyArray<{ label: string; icon: LucideIcon }> = [
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

export function WhatsIncluded() {
  return (
    <section className="mt-16 border-t border-ws-hairline pt-10" aria-labelledby="included-heading">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ws-gold">What&apos;s included</p>
      <h2
        id="included-heading"
        className="mt-3 font-display text-2xl font-semibold tracking-[-0.015em] text-ws-primary"
      >
        Your learning experience
      </h2>
      <p className="mt-2 text-[15px] text-ws-muted">Depending on the program, students may receive:</p>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {INCLUDED.map(({ label, icon: Icon }) => (
          <li
            key={label}
            className="flex items-center gap-3 rounded-md border border-ws-hairline bg-ws-surface px-4 py-3"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ws-brand/10 text-ws-gold">
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
