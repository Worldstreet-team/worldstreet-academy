import { ArrowRightIcon, CheckIcon } from "@/components/icons"
import type { Metadata } from "next"
import Link from "next/link"

import { BRAND } from "@/lib/brand"
import { SCHOOLS } from "@/lib/schools"
import { appUrl } from "@/lib/app-url"
import { EARNINGS_CLEARING_DAYS, MARKETPLACE_SHARE_ACADEMY, MARKETPLACE_SHARE_OWN_LINK } from "@/lib/db/models"
import { COURSE_FORMATS, FORMAT_BLURB, FORMAT_LABEL } from "@/lib/course-format"
import { REVIEW_CHECKS, REVIEW_CHECK_DETAILS } from "@/lib/review-checks"
import { QUALITY_CRITERIA, sharePercent } from "@/lib/marketplace"
import { SectionLabel, SectionTitle } from "@/components/marketing/section-heading"

export const metadata: Metadata = {
  title: "Sell your course",
  description: `Sell a pre-recorded course on the ${BRAND.name} marketplace. Keep ${sharePercent(MARKETPLACE_SHARE_OWN_LINK)} of sales through your own link.`,
  alternates: { canonical: appUrl("/sell") },
}

const APPLY_HREF = "/dashboard/sell/apply"

const GOLD_CTA =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ws-brand px-7 text-[15px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"

/** Institutional blueprint §17's pipeline: the application, the four recorded reviews, approval and publishing. */
const STEPS = [
  {
    title: "Application",
    body: "Apply in ten minutes: what you'll teach, a sample of your work and your agreement to the standards. Once you're approved as a Marketplace Creator, build your listing in the editor and submit it.",
  },
  ...REVIEW_CHECKS.map((key) => {
    const d = REVIEW_CHECK_DETAILS[key]
    return { title: d.qualifier ? `${d.title} (${d.qualifier})` : d.title, body: d.body }
  }),
  { title: "Approval", body: "Once all four reviews pass, an admin approves it. You'll hear by email and in the app." },
  { title: "Publishing", body: "It goes live on the Academy Marketplace. Share your own link: sales through it pay you the larger share." },
] as const

/**
 * `/sell` — the pitch to sellers (owner, 2026-10-05): who the marketplace is
 * for, the split (the larger share through the seller's own link), the
 * quality criteria every course is reviewed against and how review works.
 * One gold action, "Apply to sell", at the top and again at the foot; it
 * leads to the signed-in application (the hub's sign-in comes first for a
 * guest).
 */
export default function SellPage() {
  const own = sharePercent(MARKETPLACE_SHARE_OWN_LINK)
  const academy = sharePercent(MARKETPLACE_SHARE_ACADEMY)

  return (
    <div className="pb-24 md:pb-32">
      {/* Hero */}
      <section className="border-b border-ws-hairline bg-ws-sunken dark:border-transparent">
        <div className="mx-auto max-w-7xl px-6 py-14 md:py-24">
          <SectionLabel>Sell on the marketplace</SectionLabel>
          <h1
            className="mt-4 max-w-[22ch] font-display font-semibold leading-[1.04] tracking-[-0.025em] text-ws-primary"
            style={{ fontSize: "clamp(2.25rem, 5vw, 4rem)" }}
          >
            Teach what you know. Earn from every sale.
          </h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-ws-muted md:text-[18px]">
            Turn your know-how into a pre-recorded course on the {BRAND.name} marketplace. We review it, publish it
            beside the Academy&rsquo;s own programs and sell it with you.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href={APPLY_HREF} className={GOLD_CTA}>
              Apply to sell
              <ArrowRightIcon size={16} aria-hidden />
            </Link>
            <Link
              href="/marketplace"
              className="inline-flex h-12 items-center rounded-full px-2 text-[15px] font-semibold text-ws-primary underline decoration-ws-hairline underline-offset-4 transition-colors duration-[var(--ws-motion-fast)] hover:decoration-current"
            >
              Browse the marketplace
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-20 px-6 pt-16 md:space-y-28 md:pt-24">
        {/* The split */}
        <section aria-labelledby="split-heading" className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
          <div>
            <SectionLabel>The split</SectionLabel>
            <SectionTitle id="split-heading" className="mt-3">
              You keep most of it — more when you bring the buyer.
            </SectionTitle>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ws-muted md:text-[16px]">
              Every course page you share carries your own link. A learner who buys through it earns you the larger
              share; a sale the Academy makes still pays you half. Earnings clear into your WorldStreet wallet{" "}
              {EARNINGS_CLEARING_DAYS} days after each sale.
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            <li className="rounded-[20px] border border-ws-hairline bg-ws-surface p-6 dark:border-transparent">
              <p className="font-display text-[56px] font-light leading-none tabular-nums tracking-[-0.03em] text-ws-primary">
                {own}
              </p>
              <p className="mt-4 text-[15px] font-semibold text-ws-primary">Sales through your link</p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ws-muted">
                You share it — on your channel, in your community, in your messages — and you keep {own}.
              </p>
            </li>
            <li className="rounded-[20px] border border-ws-hairline bg-ws-surface p-6 dark:border-transparent">
              <p className="font-display text-[56px] font-light leading-none tabular-nums tracking-[-0.03em] text-ws-primary">
                {academy}
              </p>
              <p className="mt-4 text-[15px] font-semibold text-ws-primary">Sales we make</p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ws-muted">
                A learner finds your course on the Academy — the marketplace, search, our promotion — and you keep{" "}
                {academy}.
              </p>
            </li>
          </ul>
        </section>

        {/* Formats */}
        <section aria-labelledby="formats-heading">
          <SectionLabel>What you can sell</SectionLabel>
          <SectionTitle id="formats-heading" className="mt-3 max-w-3xl">
            Courses, masterclasses, workshops, templates and guides.
          </SectionTitle>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {COURSE_FORMATS.map((format) => (
              <li key={format} className="rounded-[20px] border border-ws-hairline bg-ws-surface p-5 dark:border-transparent">
                <p className="text-[15px] font-semibold text-ws-primary">{FORMAT_LABEL[format]}</p>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ws-muted">{FORMAT_BLURB[format]}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Quality criteria */}
        <section aria-labelledby="quality-heading">
          <SectionLabel>The standard</SectionLabel>
          <SectionTitle id="quality-heading" className="mt-3 max-w-3xl">
            Every course is reviewed before it goes live.
          </SectionTitle>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ws-muted md:text-[16px]">
            Learners trust the marketplace because nothing reaches it unchecked. We look for five things:
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {QUALITY_CRITERIA.map((item) => (
              <li key={item.title} className="rounded-[20px] border border-ws-hairline bg-ws-surface p-5 dark:border-transparent">
                <span className="flex size-8 items-center justify-center rounded-[9px] bg-ws-chip text-ws-primary">
                  <CheckIcon size={16} aria-hidden />
                </span>
                <p className="mt-4 text-[15px] font-semibold text-ws-primary">{item.title}</p>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ws-muted">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* How review works */}
        <section aria-labelledby="steps-heading" className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
          <div>
            <SectionLabel>How it works</SectionLabel>
            <SectionTitle id="steps-heading" className="mt-3">
              From application to publishing.
            </SectionTitle>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ws-muted md:text-[16px]">
              Every submission passes four recorded reviews before it is published. If one asks for changes, you&rsquo;ll see which review and why, and reviews that passed stay passed unless you change the content.
            </p>
          </div>
          <ol className="space-y-3">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className="flex gap-4 rounded-[20px] border border-ws-hairline bg-ws-surface p-5 dark:border-transparent"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ws-chip text-[13px] font-semibold tabular-nums text-ws-primary">
                  {i + 1}
                </span>
                <div>
                  <p className="text-[15px] font-semibold text-ws-primary">{step.title}</p>
                  <p className="mt-1 text-[14px] leading-relaxed text-ws-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Foot CTA */}
        <section
          aria-labelledby="apply-heading"
          className="grid gap-6 rounded-[20px] border border-ws-hairline bg-ws-surface p-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-10 dark:border-transparent"
        >
          <div>
            <h2 id="apply-heading" className="font-display text-[clamp(1.5rem,2.6vw,2rem)] font-semibold tracking-[-0.015em] text-ws-primary">
              Ready to sell your course?
            </h2>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ws-muted">
              Apply today. You&rsquo;ll need a WorldStreet account, a sample of your teaching and a topic that fits one
              of the {SCHOOLS.length} schools.
            </p>
          </div>
          <Link href={APPLY_HREF} className={GOLD_CTA}>
            Apply to sell
            <ArrowRightIcon size={16} aria-hidden />
          </Link>
        </section>
      </div>
    </div>
  )
}
