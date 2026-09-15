"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, Mail01Icon, Message01Icon } from "@hugeicons/core-free-icons"
import { CardHeader, CardShell, ListRow } from "@/components/ui/system"
import { BRAND } from "@/lib/brand"
import { hasPrioritySupport } from "@/lib/dashboard-home"
import { useEnrollments } from "@/lib/hooks/queries"

const MailGlyph = ({ className }: { className?: string }) => <HugeiconsIcon icon={Mail01Icon} className={className} />
const MessageGlyph = ({ className }: { className?: string }) => <HugeiconsIcon icon={Message01Icon} className={className} />
const chevron = <HugeiconsIcon icon={ArrowRight01Icon} aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />

/**
 * Contact support. Priority support (spec §12) is derived on the client
 * exactly as the dashboard's SupportTile does — `hasPrioritySupport` over the
 * cached enrollments — so the Help page itself waits on nothing: the standard
 * email row renders at once and upgrades to the priority row when the
 * enrollments say so. Priority emails carry a subject tag for the support inbox.
 */
export function SupportContact() {
  const { data: enrollments } = useEnrollments()
  const priority = enrollments ? hasPrioritySupport(enrollments) : false
  const emailHref = priority
    ? `mailto:${BRAND.supportEmail}?subject=${encodeURIComponent("[Priority] Support request")}`
    : `mailto:${BRAND.supportEmail}`

  return (
    <CardShell>
      <CardHeader title="Contact support" subtitle="Real people, when the answers above don't cover it." />
      <div className="divide-y divide-border border-t border-border">
        <ListRow
          icon={MailGlyph}
          title="Email us"
          subtitle={`${BRAND.supportEmail} · replies within one business day`}
          href={emailHref}
          right={
            <>
              {priority && (
                <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-foreground">
                  Priority support
                </span>
              )}
              {chevron}
            </>
          }
        />
        <ListRow
          icon={MessageGlyph}
          title="Message us"
          subtitle="Reach an instructor or start a conversation in Messages."
          href="/dashboard/messages"
          right={chevron}
        />
      </div>
    </CardShell>
  )
}
