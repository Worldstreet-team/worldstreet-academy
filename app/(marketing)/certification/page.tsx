import { ArrowRightIcon, CheckIcon } from "@/components/icons"
import type { Metadata } from "next"
import Link from "next/link"

import { appUrl } from "@/lib/app-url"
import { CERT_TIERS, CERT_TIER_LABEL, CERT_TIER_REQUIREMENTS } from "@/lib/certificate-tier"
import { MASTERY_KEYS, MASTERY_MIN_PARTS, MASTERY_PART_COPY, MASTERY_WEIGHTS } from "@/lib/mastery-score"
import { SectionLabel, SectionTitle } from "@/components/marketing/section-heading"

export const metadata: Metadata = {
  title: "Certification",
  description:
    "The three WMA credentials (Certificate of Completion, Certified Practitioner and Mastery Certification) and what each one requires.",
  alternates: { canonical: appUrl("/certification") },
}

const GOLD_CTA =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ws-brand px-7 text-[15px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"

const CARD = "rounded-[20px] border border-ws-hairline bg-ws-surface p-6 dark:border-transparent"

/**
 * `/certification` — the three WMA credentials and what each requires
 * (institutional blueprint §13, D25). Static: every number comes from
 * `lib/certificate-tier.ts` and `lib/mastery-score.ts`.
 * COPY DRAFTED FROM THE CONSTANTS — AWAITING OWNER SIGN-OFF.
 */
export default function CertificationPage() {
  return (
    <div className="pb-24 md:pb-32">
      <section className="border-b border-ws-hairline bg-ws-sunken dark:border-transparent">
        <div className="mx-auto max-w-7xl px-6 py-14 md:py-24">
          <SectionLabel>Certification</SectionLabel>
          <h1
            className="mt-4 max-w-[22ch] font-display font-semibold leading-[1.04] tracking-[-0.025em] text-ws-primary"
            style={{ fontSize: "clamp(2.25rem, 5vw, 4rem)" }}
          >
            WMA Certification
          </h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-ws-muted md:text-[18px]">
            Every WMA credential corresponds to published academic requirements and demonstrated competency.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pt-12 md:pt-16" aria-label="The credentials">
        <ol aria-label="WMA credentials" className="grid gap-5 lg:grid-cols-3">
          {CERT_TIERS.map((tier, i) => (
            <li key={tier} className={CARD}>
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] tabular-nums text-ws-subtle">
                {`Credential ${i + 1}`}
              </span>
              <h2 className="mt-2 font-display text-[20px] font-semibold leading-snug tracking-[-0.01em] text-ws-primary">
                {CERT_TIER_LABEL[tier]}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {CERT_TIER_REQUIREMENTS[tier].map((line) => (
                  <li key={line} className="flex items-start gap-2.5 text-[14px] leading-relaxed text-ws-muted">
                    <CheckIcon size={15} className="mt-1 shrink-0" aria-hidden />
                    {line}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-7xl px-6 pt-14 md:pt-20" aria-labelledby="score-heading">
        <SectionTitle id="score-heading" className="max-w-xl">
          The WMA Mastery Score
        </SectionTitle>
        <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-ws-muted">
          A score from 0 to 100 for each program, built from five parts:
        </p>
        <ul className="mt-4 flex flex-wrap gap-2.5">
          {MASTERY_KEYS.map((key) => (
            <li
              key={key}
              className="rounded-full bg-ws-chip px-3.5 py-1.5 text-[13px] font-medium tabular-nums text-ws-primary"
            >
              {`${MASTERY_PART_COPY[key].label} ${MASTERY_WEIGHTS[key]}`}
            </li>
          ))}
        </ul>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ws-muted">
          {`Parts your plan doesn't include never count against you, and the score shows once ${MASTERY_MIN_PARTS} parts have data.`}
        </p>
      </section>

      <section className="mx-auto max-w-7xl px-6 pt-14 md:pt-20" aria-labelledby="one-heading">
        <SectionTitle id="one-heading" className="max-w-xl">
          One certificate per program
        </SectionTitle>
        <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-ws-muted">
          Each program issues one certificate with one ID. It shows the highest credential you have earned, reprints
          under the same ID when you reach a higher one, and is never lowered. Every certificate carries an ID that
          anyone can verify online.
        </p>
        <div className="mt-8">
          <Link href="/programs" className={GOLD_CTA}>
            Explore programs
            <ArrowRightIcon size={16} aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  )
}
