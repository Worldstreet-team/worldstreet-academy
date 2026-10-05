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
  title: "Refer & earn",
  robots: { index: false, follow: false },
}

const RATE = `${Math.round(REFERRAL_COMMISSION_RATE * 100)}%`
const RULE = `You earn ${RATE} of a friend's first purchase, paid to your WorldStreet wallet after ${EARNINGS_CLEARING_DAYS} days.`

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

  return (
    <>
      <Topbar title="Refer & earn" breadcrumbOverrides={{ referrals: "Refer & earn" }} />
      <div className="flex-1 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 sm:px-6 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <PageHeader title="Refer & earn" subtitle={RULE} />

          {!summary ? (
            <CardShell>
              <EmptyState
                title="Your referral link didn't load"
                description="Refresh the page to try again."
              />
            </CardShell>
          ) : (
            <>
              <Rise>
                <ReferralShare code={summary.code} link={appUrl(referralPath("/", summary.code))} />
              </Rise>

              <Rise delay={60}>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label="Referred" value={String(summary.referredCount)} />
                  <Stat label="Paid" value={String(summary.paidCount)} />
                  <Stat label="Pending" value={usd(summary.pendingMinor)} />
                  <Stat label="In your wallet" value={usd(summary.clearedMinor)} />
                </div>
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
