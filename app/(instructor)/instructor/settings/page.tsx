import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Topbar } from "@/components/platform/topbar"
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
      <div className="p-4 md:p-6 space-y-6 max-w-2xl pb-24 md:pb-8">
        <div>
          <h1 className="text-xl font-bold">Instructor Settings</h1>
          <p className="text-sm text-muted-foreground">
            Update your instructor profile and preferences.
          </p>
        </div>

        <InstructorProfileClient
          user={currentUser}
          currentSignatureUrl={currentSignature}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Earnings & Payout</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-[11px] text-muted-foreground">In your Worldstreet wallet</p>
                <p className="text-lg font-bold">
                  ${((earnings?.clearedMinor ?? 0) / 100).toFixed(2)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-[11px] text-muted-foreground">Clearing (7-day window)</p>
                <p className="text-lg font-bold">
                  ${((earnings?.pendingMinor ?? 0) / 100).toFixed(2)}
                </p>
              </div>
            </div>
            <Separator />
            <p className="text-[11px] text-muted-foreground">
              You keep an 85% share of every sale. Earnings clear into your central Worldstreet
              wallet balance {earnings?.clearingDays ?? 7} days after each sale (refund
              protection). Withdrawals — and the identity verification they require — happen on
              the Worldstreet dashboard, not in the Academy.
            </p>
            <a
              href={earnings?.withdrawUrl ?? "https://dashboard.worldstreetgold.com/withdraw"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 w-full items-center justify-center rounded-md border border-input bg-transparent px-3 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Withdraw on the Worldstreet dashboard →
            </a>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
