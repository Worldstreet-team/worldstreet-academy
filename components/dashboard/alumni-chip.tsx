import { GraduationCapIcon } from "@/components/icons"
import { ALUMNI_LABEL } from "@/lib/certificate-tier"
import { cn } from "@/lib/utils"

/**
 * "WMA Alumni": shown to anyone who holds a certificate (institutional
 * blueprint §19 / D19, Phase 17 ruling 9). Private surfaces only: the
 * dashboard greeting and the profile, never a public page. Hook-free, so
 * client parents decide when to render it.
 */
export function AlumniChip({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-ws-chip px-2.5 py-0.5 text-[12px] font-semibold normal-case tracking-normal text-ws-primary",
        className,
      )}
    >
      <GraduationCapIcon size={13} aria-hidden />
      {ALUMNI_LABEL}
    </span>
  )
}
