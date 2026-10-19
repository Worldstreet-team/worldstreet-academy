import { ArrowRightIcon } from "@/components/icons"
import Link from "next/link"

import { Reveal, RevealGroup } from "@/components/marketing/motion/reveal"
import { SectionLabel, SectionTitle } from "@/components/marketing/section-heading"
import { WORLDS } from "@/lib/institution"
import { cn } from "@/lib/utils"

/**
 * THE THREE WORLDS (institutional blueprint §6) — the Academy, the Academy
 * Marketplace and the Opportunity Hub, in the landing's section rhythm. A world
 * with a route is one link; the Opportunity Hub has no description yet (D18),
 * so it is a muted "Coming soon" card with no link and no invented copy.
 * Shared by the landing and /academy. Server component.
 */
export function WorldsBand({ className }: { className?: string }) {
  return (
    <section className={cn("py-14 sm:py-20 md:py-28", className)} aria-labelledby="worlds-heading">
      <div className="mx-auto max-w-7xl px-6">
        <RevealGroup>
          <SectionLabel>The three worlds</SectionLabel>
          <SectionTitle id="worlds-heading" className="mt-4 max-w-3xl">
            The Academy has three major worlds
          </SectionTitle>
        </RevealGroup>

        <ul className="mt-10 grid gap-5 md:mt-14 md:grid-cols-3">
          {WORLDS.map((world, i) => (
            <Reveal as="li" key={world.key} delay={i * 0.06} y={16} className="flex">
              {world.href ? (
                <Link
                  href={world.href}
                  className="group flex w-full flex-col rounded-[20px] border border-ws-hairline bg-ws-surface p-6 transition-colors duration-200 hover:border-ws-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
                >
                  <span className="font-display text-[19px] font-semibold tracking-[-0.01em] text-ws-primary">
                    {world.name}
                  </span>
                  <span className="mt-3 text-[14px] leading-relaxed text-ws-muted">{world.body}</span>
                  <span className="mt-auto flex justify-end pt-6 text-ws-primary">
                    <ArrowRightIcon
                      size={18}
                      aria-hidden
                      className="transition-transform duration-200 group-hover:translate-x-0.5"
                    />
                  </span>
                </Link>
              ) : (
                <div className="flex w-full flex-col rounded-[20px] border border-dashed border-ws-hairline p-6 text-ws-muted">
                  <span className="font-display text-[19px] font-semibold tracking-[-0.01em] text-ws-muted">
                    {world.name}
                  </span>
                  <span className="mt-4 inline-flex w-fit items-center rounded-full border border-ws-hairline px-3 py-1 text-[12px] font-semibold text-ws-muted">
                    Coming soon
                  </span>
                </div>
              )}
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}
