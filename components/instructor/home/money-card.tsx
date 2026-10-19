"use client"
import { ArrowRight } from "@/components/icons"

import Link from "next/link"

import { CardShell } from "@/components/ui/system"
import type { TeachingMoney } from "@/lib/actions/teaching-home"
import { formatMinor } from "@/lib/teaching-home"

/*
 * The tutor's money at a glance, from the earnings ledger (never price ×
 * enrollments): what is still clearing, what reached the wallet, this
 * month's sales and referral commissions. Withdrawals stay on the
 * Worldstreet dashboard; the links go to where each figure is explained.
 */

const LINK = "inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"

function Figure({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 px-4 py-4 sm:px-5">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className="truncate font-display text-[24px] font-light leading-none tracking-[-0.02em] tabular-nums">{value}</span>
      <span className="text-[11.5px] text-muted-foreground">{hint}</span>
    </div>
  )
}

export function MoneyCard({ money }: { money: TeachingMoney }) {
  return (
    <CardShell>
      <div className="flex flex-col px-4 py-3.5 sm:px-5">
        <h2 className="text-[15px] font-semibold leading-tight">Earnings</h2>
        <span className="text-[13px] text-muted-foreground">Your share, net of fees</span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-border/60 border-t border-border/60">
        <Figure label="Clearing" value={formatMinor(money.pendingMinor)} hint="Refund window" />
        <Figure label="In your wallet" value={formatMinor(money.clearedMinor)} hint="Cleared to date" />
      </div>
      <dl className="flex flex-col divide-y divide-border/60 border-t border-border/60 text-[13px]">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <dt className="text-muted-foreground">Sales this month</dt>
          <dd className="font-semibold tabular-nums">{money.salesThisMonth.toLocaleString()}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <dt className="text-muted-foreground">Partner commission</dt>
          <dd className="font-semibold tabular-nums">
            {money.referralMinor === null ? "—" : formatMinor(money.referralMinor)}
          </dd>
        </div>
      </dl>
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/60 px-4 py-3 sm:px-5">
        <Link href="/dashboard/referrals" className={LINK}>
          WMA Partners
          <ArrowRight size={14} strokeWidth={2} aria-hidden />
        </Link>
        <Link href="/instructor/earnings" className={LINK}>
          Earnings &amp; payout
          <ArrowRight size={14} strokeWidth={2} aria-hidden />
        </Link>
      </div>
    </CardShell>
  )
}
