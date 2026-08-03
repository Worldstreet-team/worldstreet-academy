import { Topbar } from "@/components/platform/topbar"
import { PageHeader } from "@/components/shared/page-header"
import { getMySignature } from "@/lib/actions/signature"
import { getMyInstructorEarnings } from "@/lib/actions/earnings"
import { getCurrentUser } from "@/lib/auth"
import { InstructorProfileClient } from "./instructor-profile-client"

export default async function InstructorSettingsPage() {
  const [currentSignature, currentUser, earnings] = await Promise.all([
    getMySignature(),
    getCurrentUser(),
    getMyInstructorEarnings(),
  ])

  return (
    <>
      <Topbar title="Settings" variant="instructor" />
      <div className="flex-1 px-6 pb-24 pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-2xl space-y-8">
          <PageHeader
            title="Instructor Settings"
            subline="Update your instructor profile and preferences."
          />

          <InstructorProfileClient
            user={currentUser}
            currentSignatureUrl={currentSignature}
          />

          <div className="rounded-lg border border-ws-hairline bg-ws-surface p-6">
            <h2 className="text-sm font-semibold text-ws-primary">Earnings & Payout</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-md border border-ws-hairline bg-ws-raised/50 p-3">
                <p className="text-[11px] text-ws-muted">In your Worldstreet wallet</p>
                <p className="mt-1 font-display text-lg font-semibold tabular-nums text-ws-primary">
                  ${((earnings?.clearedMinor ?? 0) / 100).toFixed(2)}
                </p>
              </div>
              <div className="rounded-md border border-ws-hairline bg-ws-raised/50 p-3">
                <p className="text-[11px] text-ws-muted">Clearing (7-day window)</p>
                <p className="mt-1 font-display text-lg font-semibold tabular-nums text-ws-primary">
                  ${((earnings?.pendingMinor ?? 0) / 100).toFixed(2)}
                </p>
              </div>
            </div>
            <p className="mt-4 border-t border-ws-hairline pt-4 text-[11px] leading-relaxed text-ws-muted">
              You keep an 85% share of every sale. Earnings clear into your central Worldstreet
              wallet balance {earnings?.clearingDays ?? 7} days after each sale (refund
              protection). Withdrawals — and the identity verification they require — happen on
              the Worldstreet dashboard, not in the Academy.
            </p>
            <a
              href={earnings?.withdrawUrl ?? "https://dashboard.worldstreetgold.com/withdraw"}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-sm border border-ws-hairline bg-transparent px-3 text-sm font-medium text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised"
            >
              Withdraw on the Worldstreet dashboard →
            </a>
          </div>
        </div>
      </div>
    </>
  )
}
