import Image from "next/image"
import { BRAND } from "@/lib/brand"
import { ArrowRightIcon, CheckIcon } from "@/components/icons"
import Link from "next/link"
import { CERT_TIERS, CERT_TIER_LABEL } from "@/lib/certificate-tier"
import { Reveal, RevealGroup } from "@/components/marketing/motion/reveal"
import { SectionLabel, SectionTitle } from "@/components/marketing/section-heading"

/** Spec §13 — what the certificate displays, verbatim. */
const SHOWS = ["Student name", "Program", "Completion date", "Certificate ID", "Authorized signature", `${BRAND.name} branding`]

/**
 * CERTIFICATION (spec §13): the claim, what the certificate carries, and a
 * sample of one. The sample wears the page's own surface (the kit's light
 * brand never applies under a dark <html>, so a light island would render
 * dark ink on a dark card) and says "Sample", with placeholders instead of a
 * person.
 */
export function CertificateBand() {
  return (
    <section className="py-14 sm:py-20 md:py-28" aria-labelledby="certificate-heading">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 lg:grid-cols-2 lg:gap-16">
        <RevealGroup>
          <SectionLabel>Certification</SectionLabel>
          <SectionTitle id="certificate-heading" className="mt-4 max-w-xl">
            Learn. Complete. Get recognized.
          </SectionTitle>
          <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-ws-muted md:text-[17px]">
            Students who successfully meet the requirements of eligible programs can receive a {BRAND.name}{" "}
            certificate. Every certificate carries an ID that anyone can verify online.
          </p>
          <ul className="mt-6 grid max-w-xl gap-x-6 gap-y-2.5 sm:grid-cols-2">
            {SHOWS.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[14px] text-ws-muted">
                <CheckIcon size={15} className="mt-0.5 shrink-0" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-xl text-[14px] text-ws-muted">
            {`Three credentials: ${CERT_TIERS.map((t) => CERT_TIER_LABEL[t]).join(" · ")}.`}
          </p>
          <Link
            href="/certification"
            className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary"
          >
            See what each one requires
            <ArrowRightIcon size={14} aria-hidden />
          </Link>
        </RevealGroup>

        <Reveal y={24} duration={0.7}>
          <div
            role="img"
            aria-label="A sample certificate"
            className="relative mx-auto w-full max-w-lg -rotate-2 rounded-[20px] border border-ws-hairline bg-ws-surface p-8 text-center text-ws-primary sm:p-10"
          >
            <span className="absolute right-5 top-5 rounded-full bg-ws-chip px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-ws-muted">
              Sample
            </span>
            <Image src="/brand/wsa-mark.png" alt="" width={36} height={36} className="mx-auto h-9 w-9 object-contain" />
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-ws-muted">{BRAND.name}</p>
            <p className="mt-6 font-display text-[22px] font-semibold tracking-[-0.01em] sm:text-[26px]">
              Certificate of Completion
            </p>
            <p className="mt-5 text-[13px] text-ws-muted">This certifies that</p>
            <p className="mt-1 font-display text-[26px] font-light sm:text-[30px]">Your Name</p>
            <p className="mt-3 text-[13px] text-ws-muted">has successfully completed the program</p>
            <p className="mt-1 font-display text-[17px] font-semibold">Your Program</p>
            <div className="mt-8 flex items-end justify-between border-t border-ws-hairline pt-4 text-left text-[11px] text-ws-muted">
              <span>
                Certificate ID
                <span className="block font-mono text-[12px] tabular-nums text-ws-primary">
                  {BRAND.certificatePrefix}-XXXXXXXX
                </span>
              </span>
              <span className="text-right">
                Completed
                <span className="block text-[12px] text-ws-primary">Your date</span>
              </span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
