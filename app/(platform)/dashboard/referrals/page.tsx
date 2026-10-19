import type { Metadata } from "next"
import { Topbar } from "@/components/platform/topbar"
import { CardHeader, CardShell, EmptyState, Eyebrow, ListRow, PageHeader, Rise } from "@/components/ui/system"
import { ReferralShare } from "@/components/referrals/referral-share"
import { getCachedUser } from "@/lib/auth/cached"
import connectDB from "@/lib/db"
import { EARNINGS_CLEARING_DAYS, REFERRAL_COMMISSION_RATE } from "@/lib/db/models"
import { referralPath } from "@/lib/referral-link"
import { referralSummary, type ReferralPerson, type ReferralSummary } from "@/lib/referrals"
import { appUrl } from "@/lib/app-url"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "WMA Partners",
  robots: { index: false, follow: false },
}

const RATE = `${Math.round(REFERRAL_COMMISSION_RATE * 100)}%`
const SUBTITLE = `Share your Partner Code and earn ${RATE} of the first purchase of every learner you refer.`
const RULES = [
  `You earn ${RATE} of the first purchase each learner you refer pays for, once per learner.`,
  "It counts when that first purchase is paid from their WorldStreet wallet and credited to your code. A first purchase paid by ESPEE transfer, or credited to another code, earns you no commission.",
  `Commission clears to your WorldStreet wallet ${EARNINGS_CLEARING_DAYS} days after the purchase. If the purchase is refunded, the commission is reversed.`,
  "Your own purchases never earn commission.",
] as const
const STATS_NOTE = "Clicks count each visitor once a day. Revenue is what learners paid for purchases credited to your code."

function usd(minor: number): string {
  return (minor / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
}

/** What the person's purchase earned you so far, in words. */
function commissionLine(c: ReferralPerson["commission"]): string | null {
  if (!c) return null
  if (c.status === "pending") return `${usd(c.netMinor)} clears ${day(c.availableAt)}`
  if (c.status === "cleared") return `${usd(c.netMinor)} paid to your wallet`
  return "Purchase refunded — no commission"
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
                <p className="mt-3 text-[12.5px] text-muted-foreground">{STATS_NOTE}</p>
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
                      description="Share your link. People who join through it show up here, and so does what their first purchase earns you."
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
                  <CardHeader title="How commission works" />
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
