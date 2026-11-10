import { ArrowRightIcon } from "@/components/icons"
import Link from "next/link"

import { SectionLabel } from "@/components/marketing/section-heading"
import type { World } from "@/lib/institution"

const GOLD_CTA =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ws-brand px-7 text-[15px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"

/**
 * The page of a world that isn't open yet: the Marketplace while
 * MARKETPLACE_OPEN is off, and the Opportunity Hub (owner voice note,
 * 2026-11-02: "you can put that as coming soon… let's focus on the one that
 * will make the academy start first"). Its name, its one line from WORLDS, the
 * "Coming soon" chip, and the way into what is open now: the schools.
 * Same register as the /sell hero. Server component.
 */
export function ComingSoon({ world }: { world: World }) {
  return (
    <div className="pb-24 md:pb-32">
      <section className="border-b border-ws-hairline bg-ws-sunken dark:border-transparent">
        <div className="mx-auto max-w-7xl px-6 py-14 md:py-24">
          <SectionLabel>Coming soon</SectionLabel>
          <h1
            className="mt-4 max-w-[22ch] font-display font-semibold leading-[1.04] tracking-[-0.025em] text-ws-primary"
            style={{ fontSize: "clamp(2.25rem, 5vw, 4rem)" }}
          >
            {world.name}
          </h1>
          {world.body && (
            <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-ws-muted md:text-[18px]">{world.body}</p>
          )}
          <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-ws-muted md:text-[18px]">
            It isn&rsquo;t open yet. For now, start with the Academy: choose a school and a program.
          </p>
          <div className="mt-8">
            <Link href="/schools" className={GOLD_CTA}>
              Explore the schools
              <ArrowRightIcon size={16} aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
