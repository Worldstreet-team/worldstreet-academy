import type { Metadata } from "next"
import { HugeiconsIcon } from "@hugeicons/react"
import { Store01Icon } from "@hugeicons/core-free-icons"
import { Topbar } from "@/components/platform/topbar"
import { SellerApplyPanel } from "@/components/sell/seller-apply-panel"
import { getMySellerApplication } from "@/lib/actions/seller-applications"
import { getCachedUser } from "@/lib/auth/cached"
import { MARKETPLACE_SHARE_ACADEMY, MARKETPLACE_SHARE_OWN_LINK } from "@/lib/db/models"
import { sellerSplitNote } from "@/lib/marketplace"

export const metadata: Metadata = { title: "Sell on the marketplace" }

/**
 * `/dashboard/sell/apply` — the seller application (owner, 2026-10-05), in
 * the student shell. Exempt from the paid-dashboard gate (lib/start-gate.ts):
 * a seller needn't be enrolled anywhere.
 */
export default async function SellApplyPage() {
  const [user, data] = await Promise.all([getCachedUser(), getMySellerApplication()])

  return (
    <>
      <Topbar />
      <div className="mx-auto w-full max-w-2xl space-y-8 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 sm:px-6 md:pb-12 md:pt-10">
        <header className="space-y-3 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-[14px] bg-primary/[0.12] text-primary">
            <HugeiconsIcon icon={Store01Icon} className="size-6" />
          </div>
          <h1 className="font-display text-[28px] font-semibold tracking-[-0.02em] text-foreground">
            Sell on the marketplace
          </h1>
          <p className="mx-auto max-w-md text-[15px] leading-relaxed text-muted-foreground">
            Apply once. When you&apos;re approved, you build your course, we review it and it goes live beside the
            Academy&apos;s own.
          </p>
        </header>

        {data ? (
          <SellerApplyPanel
            data={data}
            defaultName={user ? `${user.firstName} ${user.lastName}`.trim() : ""}
            splitNote={sellerSplitNote(MARKETPLACE_SHARE_OWN_LINK, MARKETPLACE_SHARE_ACADEMY)}
          />
        ) : (
          <p className="rounded-[20px] border border-ws-hairline bg-card p-6 text-center text-[14px] text-muted-foreground dark:border-transparent">
            We couldn&apos;t load your application. Refresh the page to try again.
          </p>
        )}
      </div>
    </>
  )
}
