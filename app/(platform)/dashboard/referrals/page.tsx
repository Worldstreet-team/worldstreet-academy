import type { Metadata } from "next"
import Link from "next/link"
import { Topbar } from "@/components/platform/topbar"
import { CardHeader, CardShell, EmptyState, Eyebrow, ListRow, PageHeader, Rise } from "@/components/ui/system"
import { ReferralShare } from "@/components/referrals/referral-share"
import { getCachedUser } from "@/lib/auth/cached"
import connectDB from "@/lib/db"
import { EARNINGS_CLEARING_DAYS, REFERRAL_COMMISSION_RATE, REFERRAL_RATE_BY_PLAN } from "@/lib/db/models"
import { PACKAGE_KEYS, PACKAGE_LABEL, PROGRAM_PRICE_LIST } from "@/lib/entitlements"
import { PARTNER_LEVELS, PARTNER_LEVEL_NOTE, nextPartnerLevel, partnerLevelFor } from "@/lib/partner-levels"
import { referralPath } from "@/lib/referral-link"
import { referralSummary, type ReferralPerson, type ReferralSummary } from "@/lib/referrals"
import { appUrl } from "@/lib/app-url"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "WMA Partners",
  robots: { index: false, follow: false },
}

const pct = (rate: number) => `${Math.round(rate * 100)}%`
/** "Basic 10% ($4.90), Standard 12% ($23.88), Executive 15% ($149.85)" — the programme document's rates (Owen, 2026-11-05). */
const PLAN_RATES = PACKAGE_KEYS.map(
  (k) =>
    `${PACKAGE_LABEL[k]} ${pct(REFERRAL_RATE_BY_PLAN[k])} (${usd(Math.round(PROGRAM_PRICE_LIST[k] * 100 * REFERRAL_RATE_BY_PLAN[k]))})`
).join(", ")
const RATE_RANGE = `${pct(REFERRAL_RATE_BY_PLAN.basic)} to ${pct(REFERRAL_RATE_BY_PLAN.executive)}`
const SUBTITLE = `Share your Partner Code and earn ${RATE_RANGE} of every purchase made by a learner you refer.`
/** The client's rules, 2026-11-05: every purchase earns, however it was paid, once the payment is confirmed. */
const RULES = [
  `You earn a share of every purchase a learner you refer makes, by the plan they buy: ${PLAN_RATES}. A course without plans earns ${pct(REFERRAL_COMMISSION_RATE)}.`,
  // Transfers closed (CTO, 2026-11-08): was "It counts however they pay: from their WorldStreet wallet, or by bank transfer, USDT or ESPEES once the Academy has confirmed the payment. The purchase must be credited to your code."
  "It counts when they pay from their WorldStreet wallet. The purchase must be credited to your code.",
  // The commission clears to the wallet's USD balance, which pays for programs here; USD withdrawals aren't open yet (the withdraw page says "payouts coming soon").
  `Each commission shows here as pending, then clears to your WorldStreet wallet's USD balance ${EARNINGS_CLEARING_DAYS} days after the purchase. You can spend it on any program here; withdrawing USD is coming soon. If a purchase is refunded or cancelled, its commission is reversed.`,
  "Your own purchases never earn commission.",
] as const
const STATS_NOTE = "Clicks count each visitor once a day. Revenue is what learners paid for purchases credited to your code."

function usd(minor: number): string {
  return (minor / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
}

/** What the person's purchases earned you so far, in words: "$23.88 paid to your wallet · $4.90 clears from Nov 12, 2026". */
function commissionLine(c: ReferralPerson["commission"]): string | null {
  if (!c) return null
  const parts: string[] = []
  if (c.paidMinor > 0) parts.push(`${usd(c.paidMinor)} paid to your wallet`)
  if (c.pendingMinor > 0) {
    parts.push(c.nextClearsAt ? `${usd(c.pendingMinor)} clears from ${day(c.nextClearsAt)}` : `${usd(c.pendingMinor)} pending`)
  }
  if (c.refunded > 0) parts.push(`${c.refunded === 1 ? "1 purchase" : `${c.refunded} purchases`} refunded, no commission`)
  return parts.length ? parts.join(" · ") : null
}

/**
 * `/dashboard/referrals` (owner, 2026-10-05) — every student and tutor's code
 * and link, who joined through it, and what it has earned. Open to anyone
 * signed in, enrolled or not (exempt from the school-first gate), and the
 * same page for instructors. The code is minted on the first visit.
 */
export default async function ReferralsPage() {
  // The layout redirects a signed-out visitor; this only narrows the type.
  const user = await getCachedUser()
  if (!user) return null

  let summary: ReferralSummary | null = null
  try {
    await connectDB()
    summary = await referralSummary(user.id)
  } catch (error) {
    console.error("Referrals page error:", error)
  }

  const clickDays = summary ? summary.clicks.last30.filter((d) => d.count > 0) : []
  const maxClicks = Math.max(1, ...clickDays.map((d) => d.count))

  return (
    <>
      <Topbar title="WMA Partners" breadcrumbOverrides={{ referrals: "WMA Partners" }} />
      <div className="flex-1 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 sm:px-6 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <PageHeader title="WMA Partners" subtitle={SUBTITLE} />

          {!summary ? (
            <CardShell>
              <EmptyState
                title="Your partner dashboard didn't load"
                description="Refresh the page to try again."
              />
            </CardShell>
          ) : (
            <>
              <Rise>
                <ReferralShare code={summary.code} link={appUrl(referralPath("/", summary.code))} />
              </Rise>

              <Rise delay={60}>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Stat label="Clicks" value={String(summary.clicks.total)} />
                  <Stat label="Sign-ups" value={String(summary.referredCount)} />
                  <Stat label="Enrolled" value={String(summary.paidCount)} />
                  <Stat label="Revenue" value={usd(summary.revenueMinor)} />
                  <Stat label="Commission pending" value={usd(summary.pendingMinor)} />
                  <Stat label="Commission paid" value={usd(summary.clearedMinor)} />
                </div>
                <p className="mt-3 text-[12.5px] text-muted-foreground">
                  {STATS_NOTE} Paid commission is in your{" "}
                  <Link href="/dashboard/wallet" className="font-medium text-foreground underline underline-offset-4">
                    WorldStreet wallet
                  </Link>
                  &apos;s USD balance: spend it on any program here. Withdrawing USD is coming soon.
                </p>
              </Rise>

              <Rise delay={75}>
                <PartnerLevelCard successful={summary.paidCount} />
              </Rise>

              <Rise delay={90}>
                <CardShell>
                  <CardHeader title="Clicks in the last 30 days" subtitle="One per visitor per day" />
                  {clickDays.length === 0 ? (
                    <EmptyState
                      title="No clicks yet"
                      description="When someone opens your partner link, the visit shows here."
                    />
                  ) : (
                    <ul className="divide-y divide-border border-t border-border">
                      {clickDays.map((d) => (
                        <li key={d.day} className="flex items-center gap-3 px-5 py-3">
                          <span className="w-28 shrink-0 text-[13.5px]">{day(`${d.day}T00:00:00.000Z`)}</span>
                          <span className="h-2 min-w-0 flex-1 rounded-full bg-foreground/[0.06]" aria-hidden>
                            <span
                              className="block h-full rounded-full bg-foreground/30"
                              style={{ width: `${(d.count / maxClicks) * 100}%` }}
                            />
                          </span>
                          <span className="w-10 shrink-0 text-right text-[13.5px] font-semibold tabular-nums">{d.count}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardShell>
              </Rise>

              <Rise delay={120}>
                <CardShell>
                  <CardHeader
                    title="People you invited"
                    subtitle={
                      summary.referredCount > summary.people.length
                        ? `The latest ${summary.people.length} of ${summary.referredCount}`
                        : "Newest first"
                    }
                  />
                  {summary.people.length === 0 ? (
                    <EmptyState
                      illustration="beneficiaries"
                      title="No one yet"
                      description="Share your link. People who join through it show up here, and so does what each of their purchases earns you."
                    />
                  ) : (
                    <ul className="divide-y divide-border border-t border-border">
                      {summary.people.map((p) => (
                        <li key={p.id}>
                          <ListRow
                            title={p.name}
                            subtitle={[`Joined ${day(p.joinedAt)}`, commissionLine(p.commission)]
                              .filter(Boolean)
                              .join(" · ")}
                            right={<PaidChip paid={p.paid} />}
                            className="hover:bg-transparent"
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </CardShell>
              </Rise>

              <Rise delay={150}>
                <CardShell>
                  <CardHeader title="How commission works" subtitle="Refer → Enrol → Verify → Earn" />
                  <ul className="flex list-disc flex-col gap-2 border-t border-border px-5 py-4 pl-9 text-[13.5px] leading-relaxed">
                    {RULES.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </CardShell>
              </Rise>
            </>
          )}
        </div>
      </div>
    </>
  )
}

/**
 * The partner's performance level (programme document §3): where they stand,
 * what the next level needs, and all three levels as the document states them.
 * "Successful" = invited people who paid for an enrollment (the Enrolled stat).
 */
function PartnerLevelCard({ successful }: { successful: number }) {
  const level = partnerLevelFor(successful)
  const next = nextPartnerLevel(successful)
  const subtitle = level
    ? `${level.name} · ${successful.toLocaleString("en-US")} successful ${successful === 1 ? "referral" : "referrals"}`
    : "Your first successful referral makes you an Academy Partner"
  return (
    <CardShell>
      <CardHeader title="Your partner level" subtitle={subtitle} />
      <div className="flex flex-col gap-3 border-t border-border px-5 py-4">
        {next && level && (
          <p className="text-[13.5px] text-muted-foreground">
            {next.more.toLocaleString("en-US")} more successful {next.more === 1 ? "referral" : "referrals"} to {next.level.name}.
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {PARTNER_LEVELS.map((l) => {
            const current = level?.key === l.key
            return (
              <li
                key={l.key}
                className={cn("rounded-[14px] p-3.5", current ? "bg-foreground/[0.06]" : "border border-border")}
                aria-current={current ? "true" : undefined}
              >
                <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <span className="text-[14px] font-semibold">
                    {l.name}
                    {current && <span className="ml-2 text-[12px] font-medium text-muted-foreground">You are here</span>}
                  </span>
                  <span className="text-[12.5px] tabular-nums text-muted-foreground">{l.range}</span>
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{l.perk}</p>
              </li>
            )
          })}
        </ul>
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">{PARTNER_LEVEL_NOTE}</p>
      </div>
    </CardShell>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <CardShell className="gap-1.5 p-4">
      <Eyebrow className="text-[11px]">{label}</Eyebrow>
      <span className="text-[22px] font-semibold leading-tight tracking-[-0.01em] tabular-nums">{value}</span>
    </CardShell>
  )
}

function PaidChip({ paid }: { paid: boolean }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold",
        paid ? "bg-credit-chip text-credit" : "bg-foreground/[0.06] text-muted-foreground"
      )}
    >
      {paid ? "Paid" : "Not yet"}
    </span>
  )
}
