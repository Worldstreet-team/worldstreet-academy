"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, Certificate01Icon, Mortarboard01Icon, Wallet01Icon } from "@hugeicons/core-free-icons"
import { CardHeader, CardShell, ListRow } from "@/components/ui/system"

export type QuickLinkIcon = "wallet" | "certificates" | "instructor"

export type QuickLink = { title: string; description: string; href: string; icon: QuickLinkIcon }

/* The Help page is a server component and can't hand a component to ListRow,
   so it names each glyph and the map lives on this side of the boundary. */
const GLYPHS: Record<QuickLinkIcon, typeof Wallet01Icon> = {
  wallet: Wallet01Icon,
  certificates: Certificate01Icon,
  instructor: Mortarboard01Icon,
}

export function QuickLinks({ links }: { links: readonly QuickLink[] }) {
  return (
    <CardShell>
      <CardHeader title="Quick links" subtitle="The pages people most often ask about." />
      <div className="divide-y divide-border border-t border-border">
        {links.map((link) => {
          const glyph = GLYPHS[link.icon]
          return (
            <ListRow
              key={link.href}
              icon={({ className }) => <HugeiconsIcon icon={glyph} className={className} />}
              title={link.title}
              subtitle={link.description}
              href={link.href}
              right={<HugeiconsIcon icon={ArrowRight01Icon} aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />}
            />
          )
        })}
      </div>
    </CardShell>
  )
}
