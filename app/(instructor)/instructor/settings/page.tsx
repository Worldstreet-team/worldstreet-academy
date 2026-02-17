import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Topbar } from "@/components/platform/topbar"
import { getMySignature } from "@/lib/actions/signature"
import { InstructorSignatureUpload } from "./signature-upload"

export default async function InstructorSettingsPage() {
  const currentSignature = await getMySignature()

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

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                defaultValue="Sarah Chen"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                defaultValue="Crypto educator & DeFi researcher with 8+ years in blockchain."
                className="min-h-20"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="avatarUrl">Avatar URL</Label>
              <Input
                id="avatarUrl"
                type="url"
                defaultValue="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&fit=crop&crop=face"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Certificate Signature</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Upload your signature to appear on student certificates. Use a
              transparent PNG for best results.
            </p>
            <InstructorSignatureUpload currentSignatureUrl={currentSignature} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Payout</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="payoutEmail">Payout Email</Label>
              <Input
                id="payoutEmail"
                type="email"
                placeholder="your@email.com"
              />
              <p className="text-[11px] text-muted-foreground">
                Revenue is paid out monthly. 85% instructor share.
              </p>
            </div>
          </CardContent>
        </Card>

        <Separator />
        <Button>Save Changes</Button>
      </div>
    </>
  )
}
