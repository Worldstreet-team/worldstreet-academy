import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Topbar } from "@/components/platform/topbar"
import { getMySignature } from "@/lib/actions/signature"
import { getCurrentUser } from "@/lib/auth"
import { InstructorProfileClient } from "./instructor-profile-client"

export default async function InstructorSettingsPage() {
  const [currentSignature, currentUser] = await Promise.all([
    getMySignature(),
    getCurrentUser(),
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
            <CardTitle className="text-sm">Payout</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="payoutEmail">
                Payout Email
              </label>
              <input
                id="payoutEmail"
                type="email"
                placeholder="your@email.com"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <p className="text-[11px] text-muted-foreground">
                Revenue is paid out monthly. 85% instructor share.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
