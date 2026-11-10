import { ArrowRightIcon, CheckIcon } from "@/components/icons"
import type { Metadata } from "next"
import Link from "next/link"

import { BRAND } from "@/lib/brand"
import { appUrl } from "@/lib/app-url"
import { HIRING_OPEN, STAFF_APPLY_HREF } from "@/lib/careers"
import { MARKETPLACE_OPEN } from "@/lib/marketplace"
import { SCHOOLS } from "@/lib/schools"
import { SectionLabel, SectionTitle } from "@/components/marketing/section-heading"

export const metadata: Metadata = {
  title: "Careers",
  description: `Join the small teaching staff of ${BRAND.name}. Staff tutors are hired through an application and an interview, at our office or online.`,
  alternates: { canonical: appUrl("/careers") },
}

const GOLD_CTA =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ws-brand px-7 text-[15px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"

const OUTLINE_CTA =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full border border-ws-hairline px-7 text-[15px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised"

const CARD = "rounded-[20px] border border-ws-hairline bg-ws-surface p-6 dark:border-transparent"

/** What a staff tutor does for the Academy's official students. */
const ROLE = [
  "Teach live classes to an Academy cohort in your school, and keep the recordings for learners who missed them.",
  "Set and grade assignments and projects, and send feedback that moves each learner forward.",
  "Mentor Executive learners one to one and keep their roadmap.",
  "Stay with your learners until the subject makes sense, not just until the material is covered.",
] as const

const LOOKING_FOR = [
  `Real, practical depth in a subject taught in one of our ${SCHOOLS.length} schools.`,
  "The patience to explain it clearly, live, to people starting out.",
  "Reliability: you'll teach on a schedule our students plan their lives around.",
  "Either near our office for in-person work, or set up to teach well online.",
] as const

/** How a staff tutor is hired — the same pipeline the admin review screen runs. */
const HIRING_STEPS = [
  { title: "Apply", body: "Sign in to your WorldStreet account, answer the questions and upload your CV. About ten minutes." },
  { title: "Review", body: "Our academic team reads every application and shortlists the people we'd like to meet." },
  {
    title: "Interview",
    body: "We interview every shortlisted applicant, in person at our office or by video call on the platform. You tell us which works when you apply.",
  },
  { title: "Decision", body: "We approve or decline after the interview and tell you by email and in the app." },
  {
    title: "Onboarding",
    body: "Approved tutors are onboarded online: they sign the instructor agreement, complete their profile and training, and are then assigned to teach a program.",
  },
] as const

/**
 * `/careers` — the vacancy page (owner voice note, 2026-11-05). The Academy
 * hires a few staff tutors for its official students like any employer: a
 * job application, an interview at the office or online, then a decision.
 * It replaces the old /teach pitch on the main navigation, which now
 * redirects here. While HIRING_OPEN is off the page says there are no
 * openings and offers no application. Selling your own course is a separate
 * door (/sell) and is said so here, so nobody mistakes one for the other.
 *
 * The vacancy is the site's "Become an Instructor" section (team, 2026-11-05:
 * "retain a 'Become an Instructor' section on the website ... all
 * applications will go through an internal review, selection, and approval
 * process before anyone is appointed as an Academy instructor"). The footer
 * links to its #become-an-instructor anchor.
 */
export default function CareersPage() {
  return (
    <div className="pb-24 md:pb-32">
      <section className="border-b border-ws-hairline bg-ws-sunken dark:border-transparent">
        <div className="mx-auto max-w-7xl px-6 py-14 md:py-24">
          <SectionLabel>Careers</SectionLabel>
          <h1
            className="mt-4 max-w-[22ch] font-display font-semibold leading-[1.04] tracking-[-0.025em] text-ws-primary"
            style={{ fontSize: "clamp(2.25rem, 5vw, 4rem)" }}
          >
            Work with {BRAND.wordmark}.
          </h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-ws-muted md:text-[18px]">
            We hire a small teaching staff for the Academy&rsquo;s official students. When we need someone, the
            vacancy is posted here.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-20 px-6 pt-16 md:space-y-28 md:pt-24">
        {HIRING_OPEN ? (
          <section
            id="become-an-instructor"
            aria-labelledby="vacancy-heading"
            className="grid scroll-mt-24 gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14"
          >
            <div>
              <SectionLabel>Open vacancy: staff tutor</SectionLabel>
              <SectionTitle id="vacancy-heading" className="mt-3">
                Become an Instructor
              </SectionTitle>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ws-muted md:text-[16px]">
                Qualified people can apply to teach the Academy&rsquo;s students. A few positions, office-based or
                remote. This is a job: we take on only a handful of tutors, and every shortlisted applicant is
                interviewed before we decide. Pay and working terms are discussed at interview.
              </p>
              <div className="mt-8">
                <Link href={STAFF_APPLY_HREF} className={GOLD_CTA}>
                  Apply for this role
                  <ArrowRightIcon size={16} aria-hidden />
                </Link>
              </div>
            </div>
            <div className="grid gap-4">
              <div className={CARD}>
                <p className="text-[15px] font-semibold text-ws-primary">The role</p>
                <ul className="mt-3 space-y-2.5">
                  {ROLE.map((line) => (
                    <li key={line} className="flex gap-3 text-[14px] leading-relaxed text-ws-muted">
                      <CheckIcon size={16} aria-hidden className="mt-0.5 shrink-0" />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
              <div className={CARD}>
                <p className="text-[15px] font-semibold text-ws-primary">Who we&rsquo;re looking for</p>
                <ul className="mt-3 space-y-2.5">
                  {LOOKING_FOR.map((line) => (
                    <li key={line} className="flex gap-3 text-[14px] leading-relaxed text-ws-muted">
                      <CheckIcon size={16} aria-hidden className="mt-0.5 shrink-0" />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        ) : (
          <section
            id="become-an-instructor"
            aria-labelledby="vacancy-heading"
            className={`${CARD} max-w-3xl scroll-mt-24 md:p-10`}
          >
            <SectionLabel>Become an Instructor</SectionLabel>
            <SectionTitle id="vacancy-heading" className="mt-3">
              No openings right now.
            </SectionTitle>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ws-muted md:text-[16px]">
              Our teaching staff is full for now. We hire only a few tutors at a time, and the next vacancy will be
              posted on this page.
            </p>
          </section>
        )}

        {HIRING_OPEN && (
          <section aria-labelledby="hiring-heading" className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
            <div>
              <SectionLabel>How we hire</SectionLabel>
              <SectionTitle id="hiring-heading" className="mt-3">
                From application to your first class.
              </SectionTitle>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ws-muted md:text-[16px]">
                You can follow your application at every step from your dashboard. Every application goes through
                internal review, selection and approval, including an interview, before anyone is appointed as an
                Academy instructor.
              </p>
            </div>
            <ol className="space-y-3">
              {HIRING_STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-4 rounded-[20px] border border-ws-hairline bg-ws-surface p-5 dark:border-transparent">
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
        )}

        {/* The other door: selling your own course is not a job here. */}
        <section
          aria-labelledby="sell-heading"
          className="grid gap-6 rounded-[20px] border border-ws-hairline bg-ws-surface p-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-10 dark:border-transparent"
        >
          <div>
            <h2 id="sell-heading" className="font-display text-[clamp(1.5rem,2.6vw,2rem)] font-semibold tracking-[-0.015em] text-ws-primary">
              Want to sell your own course instead?
            </h2>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ws-muted">
              That&rsquo;s the marketplace, a separate online sign-up. Creators publish and sell their own courses
              and are approved on the details they send. It isn&rsquo;t a job with the Academy and doesn&rsquo;t
              make you one of our tutors.
              {MARKETPLACE_OPEN ? "" : " The marketplace is coming soon."}
            </p>
          </div>
          <Link href={MARKETPLACE_OPEN ? "/sell" : "/marketplace"} className={OUTLINE_CTA}>
            {MARKETPLACE_OPEN ? "Sell on the marketplace" : "About the marketplace"}
          </Link>
        </section>
      </div>
    </div>
  )
}
