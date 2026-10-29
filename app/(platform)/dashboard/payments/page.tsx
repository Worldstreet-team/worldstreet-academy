import type { Metadata } from "next"
import Link from "next/link"
import { Topbar } from "@/components/platform/topbar"
import { CardHeader, CardShell, EmptyState, PageHeader, Rise } from "@/components/ui/system"
import { getCachedUser } from "@/lib/auth/cached"
import { BRAND } from "@/lib/brand"
import connectDB from "@/lib/db"
import { myPayments, type MyPayment, type MyPaymentStatus } from "@/lib/my-payments"
import { formatMinor } from "@/lib/teaching-home"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Payments",
  robots: { index: false, follow: false },
}

/** Each state's chip and the one line that tells the learner what it means for them. */
const STATUS: Record<MyPaymentStatus, { label: string; tone: "credit" | "debit" | "neutral"; detail: string | null }> = {
  paid: { label: "Paid", tone: "credit", detail: null },
  processing: { label: "Processing", tone: "neutral", detail: "We're confirming this payment with your wallet." },
  in_review: { label: "In review", tone: "neutral", detail: "An admin is checking your ESPEE receipt." },
  refunding: { label: "Being refunded", tone: "neutral", detail: "This charge bought no access, so it's on its way back to your wallet." },
  refunded: { label: "Refunded", tone: "neutral", detail: "Returned to your wallet." },
  failed: { label: "Failed", tone: "debit", detail: "You weren't charged." },
  declined: { label: "Declined", tone: "debit", detail: "Your receipt wasn't approved. You can send a new one from checkout." },
  cancelled: { label: "Cancelled", tone: "neutral", detail: "You weren't charged." },
}

const METHOD: Record<MyPayment["method"], string> = { wallet: "Wallet", espee: "ESPEE" }

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
}

/**
 * `/dashboard/payments` — the learner's purchases and where each stands
 * (corrections brief §6–§7, 2026-10-28): plan, amount, how it was paid and
 * its status, newest first (lib/my-payments.ts). Balance, top-ups and
 * withdrawals stay on the wallet page. Exempt from the paid-dashboard gate
 * (lib/start-gate.ts), so a learner whose payment failed or is in review can
 * still see it.
 */
export default async function PaymentsPage() {
  // The layout redirects a signed-out visitor; this only narrows the type.
  const user = await getCachedUser()
  if (!user) return null

  let payments: MyPayment[] | null = null
  try {
    await connectDB()
    payments = await myPayments(user.id)
  } catch (error) {
    console.error("Payments page error:", error)
  }

  const paid = payments?.filter((p) => p.status === "paid") ?? []
  const paidMinor = paid.reduce((sum, p) => sum + p.amountMinor, 0)

  return (
    <>
      <Topbar title="Payments" breadcrumbOverrides={{ payments: "Payments" }} />
      <div className="flex-1 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 sm:px-6 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <PageHeader
            title="Payments"
            subtitle="Everything you've bought at the Academy and where each payment stands. Your balance and top-ups are in your Wallet."
          />

          {!payments ? (
            <CardShell>
              <EmptyState title="Your payments didn't load" description="Refresh the page to try again." />
            </CardShell>
          ) : (
            <Rise>
              <CardShell>
                <CardHeader
                  title="Purchases"
                  subtitle={
                    paid.length > 0
                      ? `${paid.length} paid · ${formatMinor(paidMinor)}`
                      : payments.length > 0
                        ? "Newest first"
                        : undefined
                  }
                />
                {payments.length === 0 ? (
                  <EmptyState
                    illustration="noTransactions"
                    title="No payments yet"
                    description="When you buy a program, it shows up here with its plan, amount and status."
                    ctas={[{ label: "Browse programs", href: "/programs" }]}
                  />
                ) : (
                  <ul className="divide-y divide-border/60 border-t border-border/60">
                    {payments.map((p) => (
                      <PaymentRow key={p.id} payment={p} />
                    ))}
                  </ul>
                )}
              </CardShell>
            </Rise>
          )}

          <p className="text-center text-[13px] leading-relaxed text-muted-foreground">
            A question about a payment? Write to{" "}
            <a href={`mailto:${BRAND.supportEmail}`} className="font-medium text-foreground underline underline-offset-4">
              {BRAND.supportEmail}
            </a>{" "}
            with the program and the date, or visit{" "}
            <Link href="/dashboard/help" className="font-medium text-foreground underline underline-offset-4">
              Help
            </Link>
            .
          </p>
        </div>
      </div>
    </>
  )
}

function PaymentRow({ payment: p }: { payment: MyPayment }) {
  const status = STATUS[p.status]
  const detail = p.note ?? status.detail
  return (
    <li className="flex min-w-0 items-start gap-3 px-4 py-3.5">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {p.href ? (
          <Link href={p.href} className="truncate text-[14px] font-medium hover:underline" title={p.courseTitle}>
            {p.courseTitle}
          </Link>
        ) : (
          <span className="truncate text-[14px] font-medium" title={p.courseTitle}>
            {p.courseTitle}
          </span>
        )}
        <span className="truncate text-[12.5px] text-muted-foreground">
          {[p.plan, METHOD[p.method], day(p.at)].filter(Boolean).join(" · ")}
        </span>
        {detail && <span className="text-[12.5px] leading-snug text-muted-foreground">{detail}</span>}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="text-[14px] font-semibold tabular-nums">{formatMinor(p.amountMinor)}</span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11.5px] font-semibold",
            status.tone === "credit" && "bg-credit-chip text-credit",
            status.tone === "debit" && "bg-debit-chip text-debit",
            status.tone === "neutral" && "bg-muted text-muted-foreground"
          )}
        >
          {status.label}
        </span>
      </span>
    </li>
  )
}
