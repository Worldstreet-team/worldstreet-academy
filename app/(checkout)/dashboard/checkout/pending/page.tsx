import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ClockIcon, ReceiptTextIcon } from "lucide-react"
import { BRAND } from "@/lib/brand"
import { getCachedUser } from "@/lib/auth/cached"
import { getMyEspeePayments, type EspeeProofView, type EspeeRejectionView } from "@/lib/actions/manual-payments"
import { needsSchoolChoice } from "@/lib/start-gate"
import { getStartGateState } from "@/lib/start-gate-state"

export const metadata: Metadata = {
  title: "Payment under review",
  robots: { index: false, follow: false },
}

/** Rendered on the server (UTC in Docker), so the time names its zone. */
function submittedLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  })
}

/**
 * `/dashboard/checkout/pending` — where an ESPEE buyer waits (owner meeting
 * 2026-10-03). The gate sends a learner here while a proof of theirs is under
 * review, since the dashboard opens only once a program is paid for. With
 * nothing under review: a learner with access goes to the dashboard; one
 * without sees their newest rejection and a way back to checkout, else goes
 * wherever the gate sends them.
 */
export default async function CheckoutPendingPage() {
  // The layout redirects a signed-out visitor; this only narrows the type.
  const user = await getCachedUser()
  if (!user) return null

  const { open, latestRejection } = await getMyEspeePayments()

  if (open.length === 0) {
    // Fails open like the gate: unreadable state counts as access.
    const gate = user.role === "USER" ? await getStartGateState(user.id).catch(() => null) : null
    const hasAccess =
      !gate ||
      !needsSchoolChoice({ role: user.role, instructorStatus: user.instructorStatus, pathname: "/dashboard", ...gate })
    if (hasAccess || !latestRejection) redirect("/dashboard")
    return <NotConfirmed rejection={latestRejection} />
  }

  return <UnderReview proofs={open} email={user.email} />
}

function UnderReview({ proofs, email }: { proofs: EspeeProofView[]; email: string }) {
  return (
    <div className="flex flex-1 justify-center px-4 py-16 sm:py-24">
      <div className="rise w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-ws-surface text-ws-muted">
            <ClockIcon size={20} aria-hidden />
          </span>
          <h1 className="mt-5 text-balance font-display text-[24px] font-semibold leading-tight tracking-[-0.015em] text-ws-primary">
            Payment received — under review
          </h1>
          <p className="mt-2 text-pretty text-[14px] leading-relaxed text-ws-muted">
            Your dashboard opens once an admin confirms your payment. We&apos;ll email{" "}
            <span className="font-medium text-ws-primary">{email}</span>.
          </p>
        </div>

        <ul className="mt-8 space-y-3">
          {proofs.map((p) => (
            <li
              key={p.id}
              className="rounded-[20px] border border-ws-hairline bg-ws-surface p-5 dark:border-transparent"
            >
              <dl className="space-y-2.5 text-[14px]">
                <Fact label="Program" value={p.courseTitle} />
                {p.packageName && <Fact label="Plan" value={p.packageName} />}
                <Fact label="Amount" value={p.amountLabel} />
                <Fact label="Submitted" value={submittedLabel(p.submittedAt)} />
                <Fact label="Reference" value={p.transferReference} />
              </dl>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-center text-[13px] leading-relaxed text-ws-muted">
          Questions about your payment?{" "}
          <a href={`mailto:${BRAND.supportEmail}`} className="font-medium text-ws-primary underline-offset-4 hover:underline">
            {BRAND.supportEmail}
          </a>
        </p>
        <div className="mt-3 flex justify-center">
          <Link
            href="/programs"
            className="rounded-full px-3 py-1.5 text-[13px] font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised hover:text-ws-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
          >
            Browse programs
          </Link>
        </div>
      </div>
    </div>
  )
}

function NotConfirmed({ rejection }: { rejection: EspeeRejectionView }) {
  return (
    <div className="flex flex-1 justify-center px-4 py-16 sm:py-24">
      <div className="rise flex w-full max-w-md flex-col items-center text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-debit-chip text-debit">
          <ReceiptTextIcon size={20} aria-hidden />
        </span>
        <h1 className="mt-5 font-display text-[24px] font-semibold leading-tight tracking-[-0.015em] text-ws-primary">
          Payment not confirmed
        </h1>
        <p className="mt-2 text-pretty text-[14px] leading-relaxed text-ws-muted">
          We couldn&apos;t confirm your ESPEE payment of {rejection.amountLabel} for {rejection.courseTitle}.
        </p>
        {rejection.reason && (
          <p className="mt-5 w-full whitespace-pre-wrap rounded-[14px] bg-ws-surface p-4 text-left text-[14px] leading-relaxed text-ws-primary">
            {rejection.reason}
          </p>
        )}
        <Link
          href={rejection.checkoutPath}
          className="mt-6 flex h-11 items-center justify-center rounded-full bg-ws-brand px-6 text-[14px] font-semibold text-ws-brand-on transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-brand/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ws-page"
        >
          Try again
        </Link>
        <p className="mt-4 text-[13px] text-ws-muted">
          Think this is a mistake?{" "}
          <a href={`mailto:${BRAND.supportEmail}`} className="font-medium text-ws-primary underline-offset-4 hover:underline">
            {BRAND.supportEmail}
          </a>
        </p>
      </div>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="w-24 shrink-0 text-ws-muted">{label}</dt>
      <dd className="min-w-0 flex-1 break-words font-medium text-ws-primary">{value}</dd>
    </div>
  )
}
