"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

export type Faq = { question: string; answer: string }

/**
 * The FAQ as a disclosure list (WAI-ARIA APG "FAQ" pattern): each question is
 * a real button carrying aria-expanded/aria-controls (Base UI Collapsible),
 * rows separated by hairlines. Closed answers stay in the DOM as
 * `hidden="until-found"`, so find-in-page still reaches them. The only motion
 * is CSS: the chevron turns and an opening answer fades in; closing is instant.
 */
export function FaqList({ faqs }: { faqs: readonly Faq[] }) {
  return (
    <dl className="divide-y divide-border border-t border-border">
      {faqs.map((faq) => (
        <Collapsible key={faq.question}>
          <dt>
            <CollapsibleTrigger className="group flex min-h-14 w-full items-center justify-between gap-4 px-4 py-3.5 text-left text-[14px] font-medium transition-colors duration-[var(--ws-motion-fast)] hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40">
              <span className="min-w-0">{faq.question}</span>
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                aria-hidden
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-[var(--ws-motion-base)] ease-[var(--ws-ease)] group-data-[panel-open]:rotate-180 motion-reduce:transition-none"
              />
            </CollapsibleTrigger>
          </dt>
          <CollapsibleContent
            hiddenUntilFound
            render={<dd />}
            className="transition-opacity duration-[var(--ws-motion-base)] ease-[var(--ws-ease)] data-[starting-style]:opacity-0 motion-reduce:transition-none"
          >
            <p className="px-4 pb-4 text-[13px] leading-relaxed text-muted-foreground">{faq.answer}</p>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </dl>
  )
}
