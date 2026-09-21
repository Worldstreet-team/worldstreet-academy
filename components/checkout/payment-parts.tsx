"use client"

import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { LoaderCircleIcon, LockKeyholeIcon, RefreshCwIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { EASE_LUX, EASE_STANDARD } from "@/components/marketing/motion/ease"
import { useMotionOK } from "@/components/marketing/motion/bus"
import { centsUsd } from "@/components/checkout/order-lines"

/** Where a pay button stands: waiting for the buyer, waiting for the wallet, or done. */
export type PayPhase = "idle" | "processing" | "success"

/**
 * A state that arrives after a click (a declined debit, a refreshed balance)
 * opens on its height instead of shoving the button down in one frame. What
 * is already true on arrival renders in place — no entrance on page load.
 */
export function Appear({ show, children }: { show: boolean; children: React.ReactNode }) {
  const ok = useMotionOK()
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: ok ? 0.32 : 0, ease: EASE_LUX }}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * The gold pay button and its three states. The label travels: idle slides
 * out upward as "Confirming payment…" rises in, and a confirmed debit turns
 * the button to the success chip with a drawn check — the state the buyer
 * sees while the success page loads.
 */
export function PayButton({
  id,
  phase,
  label,
  paid,
  onClick,
}: {
  id: string
  phase: PayPhase
  label: string
  /** A paid order carries the lock; a free enrolment has nothing to secure. */
  paid: boolean
  onClick: () => void
}) {
  const ok = useMotionOK()
  const t = { duration: ok ? 0.26 : 0, ease: EASE_STANDARD }
  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      disabled={phase !== "idle"}
      aria-live="polite"
      className={cn(
        "relative flex h-[52px] w-full items-center justify-center overflow-hidden rounded-full text-[15px] font-semibold transition-colors duration-[var(--ws-motion-slow)] ease-[var(--ws-ease)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-ws-page",
        phase === "success"
          ? "bg-credit-chip text-credit focus-visible:ring-credit/40"
          : "bg-ws-brand text-ws-brand-on focus-visible:ring-ws-brand/40",
        phase === "idle" && "hover:bg-ws-brand/90 active:translate-y-px",
        phase === "processing" && "cursor-progress"
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={phase}
          initial={{ y: 18, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -18, opacity: 0 }}
          transition={t}
          className="inline-flex items-center gap-2"
        >
          {phase === "processing" ? (
            <>
              <LoaderCircleIcon size={17} className="animate-spin" aria-hidden />
              Confirming payment…
            </>
          ) : phase === "success" ? (
            <>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                <motion.path
                  d="M3.5 9.5 7.5 13.5 14.5 5"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: ok ? 0 : 1 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: ok ? 0.32 : 0, delay: ok ? 0.12 : 0, ease: EASE_LUX }}
                />
              </svg>
              Payment confirmed
            </>
          ) : (
            <>
              {paid && <LockKeyholeIcon size={16} aria-hidden />}
              {label}
            </>
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}

export function ShortfallPanel({
  shortfallMinor,
  balanceMinor,
  priceMinor,
  refreshing,
  onRefresh,
}: {
  shortfallMinor: number
  balanceMinor: number
  priceMinor: number
  refreshing: boolean
  onRefresh: () => void
}) {
  const covered = priceMinor > 0 ? Math.min(1, Math.max(0, balanceMinor / priceMinor)) : 0
  return (
    <div role="status" className="mt-5 rounded-[14px] bg-warning-chip p-4">
      <p className="text-[14px] font-semibold text-warning">You&apos;re {centsUsd(shortfallMinor)} short</p>
      <p className="mt-1 text-[13px] leading-relaxed text-ws-muted">
        Your wallet holds {centsUsd(balanceMinor)} of the {centsUsd(priceMinor)} this order costs. Top up and come
        back — your order stays right here.
      </p>
      {/* How much of the price the balance covers. */}
      <div
        role="meter"
        aria-label="Balance toward this order"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(covered * 100)}
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-ws-sunken"
      >
        <div className="h-full origin-left rounded-full bg-warning" style={{ transform: `scaleX(${covered})` }} />
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full py-1 text-[13px] font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 disabled:cursor-default"
      >
        <RefreshCwIcon size={13} className={cn(refreshing && "animate-spin")} aria-hidden />
        {refreshing ? "Checking your balance…" : "Already topped up? Refresh balance"}
      </button>
    </div>
  )
}
