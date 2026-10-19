import { ArrowRightIcon, CheckIcon, PlusIcon } from "@/components/icons"
import type { Metadata } from "next"
import Link from "next/link"

import { BRAND } from "@/lib/brand"
import { appUrl } from "@/lib/app-url"
import { EARNINGS_CLEARING_DAYS, INSTRUCTOR_REVENUE_SHARE, REFERRAL_COMMISSION_RATE } from "@/lib/db/models"
import { sharePercent } from "@/lib/marketplace"
import { SCHOOLS } from "@/lib/schools"
import { APPLICATION_STEPS } from "@/lib/application-tracker"
import { SectionLabel, SectionTitle } from "@/components/marketing/section-heading"

const SHARE = sharePercent(INSTRUCTOR_REVENUE_SHARE)
const REFERRAL = sharePercent(REFERRAL_COMMISSION_RATE)

export const metadata: Metadata = {
  title: "Teach with us",
  description: `Teach a live cohort at ${BRAND.name}. Earn ${SHARE} of your program sales and help your students reach financial independence.`,
  alternates: { canonical: appUrl("/teach") },
}

/** The signed-in application; a guest signs in first and lands back on it. */
const APPLY_HREF = "/dashboard/become-instructor"

const GOLD_CTA =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ws-brand px-7 text-[15px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"

const CARD = "rounded-[20px] border border-ws-hairline bg-ws-surface p-6 dark:border-transparent"

/** What a tutor teaches from (owner meeting, 2026-10-03). */
const DASHBOARD = [
  { title: "Live classes", body: "Teach your cohort face to face, with a whiteboard and screen share." },
  { title: "Recordings", body: "Every class is kept, so learners who missed it can catch up." },
  { title: "Calendar", body: "Schedule your sessions; your learners see them on their dashboards." },
  { title: "Assignments", body: "Set practical work, grade it and send feedback in one place." },
  { title: "Mentorship", body: "Meet your Executive learners one to one and keep their roadmap." },
] as const

const FAQS = [
  {
    q: "Who can teach?",
    a: `People with real, practical knowledge in one of our ${SCHOOLS.length} schools — from trading and technology to digital business, entrepreneurship, the creative economy, leadership and emerging technologies — who want to see their learners succeed.`,
  },
  {
    q: "Do I need teaching experience?",
    a: "No. We look for depth in your subject and the patience to explain it. Tell us about any teaching you have done; the interview is where we get to know how you explain things.",
  },
  {
    q: "What do I need to apply?",
    a: `A ${BRAND.wordmark} account with your first and last name on your profile, about ten minutes for the questions, and your CV as a PDF. A sample teaching video or other documents help, but they're optional.`,
  },
  {
    q: "How does the interview work?",
    a: "After review, our team schedules a short call on the platform, usually by proposing a few times for you to pick from. You join it from your dashboard — no other software needed.",
  },
  {
    q: "How am I paid?",
    a: `You earn ${SHARE} of every sale of your programs. Earnings clear into your WorldStreet wallet ${EARNINGS_CLEARING_DAYS} days after each sale, and you withdraw from your WorldStreet dashboard.`,
  },
  {
    q: "How does the referral code work?",
    a: `Every tutor gets a personal referral code and link. When someone you invite makes their first purchase, ${REFERRAL} of it is yours, paid like a sale.`,
  },
  {
    q: "Can I sell a pre-recorded course instead?",
    a: "Yes — that's the marketplace. Approved Marketplace Creators publish pre-recorded courses there after a quality review. See “Sell your course” for how it works.",
  },
  {
    q: "What if I'm not approved?",
    a: "You'll get a note from the reviewer explaining the decision, and you're welcome to apply again later with more detail.",
  },
] as const

/**
 * `/teach` — the pitch to tutors (owner meeting, 2026-10-03): the purpose,
 * what tutors earn, the dashboard they teach from, how an application goes
 * and FAQs. One gold action, "Apply to teach", at the top and again at the
 * foot; it leads to the signed-in application (the hub's sign-in comes first
 * for a guest, and returns there). Same register as /sell.
 */
export default function TeachPage() {
  return (
    <div className="pb-24 md:pb-32">
      {/* Hero */}
      <section className="border-b border-ws-hairline bg-ws-sunken dark:border-transparent">
        <div className="mx-auto max-w-7xl px-6 py-14 md:py-24">
          <SectionLabel>Teach with us</SectionLabel>
          <h1
            className="mt-4 max-w-[22ch] font-display font-semibold leading-[1.04] tracking-[-0.025em] text-ws-primary"
            style={{ fontSize: "clamp(2.25rem, 5vw, 4rem)" }}
          >
            Teach what you&rsquo;ve mastered. Change lives with it.
          </h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-ws-muted md:text-[18px]">
            Lead a live cohort at {BRAND.name}, take your learners from their first lesson to real understanding,
            and earn {SHARE} of your program sales.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href={APPLY_HREF} className={GOLD_CTA}>
              Become a WMA Instructor
              <ArrowRightIcon size={16} aria-hidden />
            </Link>
            <Link
              href="/schools"
              className="inline-flex h-12 items-center rounded-full px-2 text-[15px] font-semibold text-ws-primary underline decoration-ws-hairline underline-offset-4 transition-colors duration-[var(--ws-motion-fast)] hover:decoration-current"
            >
              Explore the schools
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-20 px-6 pt-16 md:space-y-28 md:pt-24">
        {/* Purpose */}
        <section aria-labelledby="purpose-heading" className="max-w-4xl">
          <SectionLabel>Our purpose</SectionLabel>
          <SectionTitle id="purpose-heading" className="mt-3">
            Our aim is to transform the lives of our students and bring them to financial independence.
          </SectionTitle>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-ws-muted md:text-[16px]">
            Our tutors don&rsquo;t just record videos. They teach a cohort live, answer the hard questions, grade the
            work and stay with their learners until the subject makes sense — because understanding, not a
            certificate, is what changes someone&rsquo;s life.
          </p>
        </section>

        {/* What tutors earn */}
        <section aria-labelledby="earn-heading">
          <SectionLabel>What our tutors earn</SectionLabel>
          <SectionTitle id="earn-heading" className="mt-3 max-w-3xl">
            You keep most of every sale — and earn when you bring people in.
          </SectionTitle>
          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            <li className={CARD}>
              <p className="font-display text-[56px] font-light leading-none tabular-nums tracking-[-0.03em] text-ws-primary">
                {SHARE}
              </p>
              <p className="mt-4 text-[15px] font-semibold text-ws-primary">Of your program sales</p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ws-muted">
                Every sale of a program you teach pays you {SHARE}. It clears into your WorldStreet wallet{" "}
                {EARNINGS_CLEARING_DAYS} days after the sale.
              </p>
            </li>
            <li className={CARD}>
              <p className="font-display text-[56px] font-light leading-none tabular-nums tracking-[-0.03em] text-ws-primary">
                {REFERRAL}
              </p>
              <p className="mt-4 text-[15px] font-semibold text-ws-primary">With your referral code</p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ws-muted">
                Share your own code and link. When someone you invite makes their first purchase, {REFERRAL} of it is
                yours.
              </p>
            </li>
            <li className={CARD}>
              <p className="font-display text-[56px] font-light leading-none tracking-[-0.03em] text-ws-primary">Live</p>
              <p className="mt-4 text-[15px] font-semibold text-ws-primary">Cohorts of your own</p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ws-muted">
                Teach real classes to a cohort that learns together, from a dashboard built for tutors.
              </p>
            </li>
          </ul>
        </section>

        {/* The tutor dashboard */}
        <section aria-labelledby="dashboard-heading" className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
          <div>
            <SectionLabel>Your dashboard</SectionLabel>
            <SectionTitle id="dashboard-heading" className="mt-3">
              Everything you teach from, in one place.
            </SectionTitle>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ws-muted md:text-[16px]">
              Approved tutors get their own sign-in and a dedicated dashboard for their cohorts — classes, schedule,
              coursework and mentees side by side.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {DASHBOARD.map((item) => (
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

        {/* How it works */}
        <section aria-labelledby="steps-heading" className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
          <div>
            <SectionLabel>How it works</SectionLabel>
            <SectionTitle id="steps-heading" className="mt-3">
              From application to your first cohort.
            </SectionTitle>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ws-muted md:text-[16px]">
              You can follow your application at every step from your dashboard, and we&rsquo;ll tell you by email
              whenever it moves.
            </p>
          </div>
          <ol className="space-y-3">
            {APPLICATION_STEPS.map((step, i) => (
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

        {/* FAQs */}
        <section aria-labelledby="faq-heading" className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
          <div>
            <SectionLabel>FAQ</SectionLabel>
            <SectionTitle id="faq-heading" className="mt-3">
              Before you apply.
            </SectionTitle>
          </div>
          <div className="border-b border-ws-hairline">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group border-t border-ws-hairline">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left text-ws-primary/80 transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 group-open:text-ws-primary [&::-webkit-details-marker]:hidden">
                  <span className="font-display text-[16px] font-semibold tracking-[-0.01em] md:text-[17px]">{faq.q}</span>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full text-ws-muted group-open:bg-ws-raised group-open:text-ws-primary">
                    <PlusIcon
                      size={16}
                      aria-hidden
                      className="transition-transform duration-200 ease-[var(--ws-ease)] group-open:rotate-45 motion-reduce:transition-none"
                    />
                  </span>
                </summary>
                <p className="max-w-xl pb-5 pr-12 text-[15px] leading-relaxed text-ws-muted">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Foot CTA */}
        <section
          aria-labelledby="apply-heading"
          className="grid gap-6 rounded-[20px] border border-ws-hairline bg-ws-surface p-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-10 dark:border-transparent"
        >
          <div>
            <h2 id="apply-heading" className="font-display text-[clamp(1.5rem,2.6vw,2rem)] font-semibold tracking-[-0.015em] text-ws-primary">
              Ready to teach with us?
            </h2>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ws-muted">
              Apply today. You&rsquo;ll need a WorldStreet account, your CV and a subject that fits one of the{" "}
              {SCHOOLS.length} schools.
            </p>
          </div>
          <Link href={APPLY_HREF} className={GOLD_CTA}>
            Become a WMA Instructor
            <ArrowRightIcon size={16} aria-hidden />
          </Link>
        </section>
      </div>
    </div>
  )
}
