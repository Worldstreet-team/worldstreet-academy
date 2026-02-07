import { Topbar } from "@/components/platform/topbar"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

export default function ProfilePage() {
  return (
    <>
      <Topbar title="Profile" />
      <div className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 max-w-3xl pb-24 md:pb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
          <p className="text-muted-foreground mt-1">
            Manage your account information.
          </p>
        </div>

        <Card>
          <CardContent className="p-6 space-y-6">
            {/* Avatar section */}
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-lg bg-primary/10 text-primary">
                  U
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">User</h2>
                <p className="text-sm text-muted-foreground">user@worldstreet.com</p>
              </div>
            </div>

            <Separator />

            {/* Profile fields */}
            <div className="grid gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Full Name
                  </label>
                  <p className="mt-1 text-sm">User</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Email
                  </label>
                  <p className="mt-1 text-sm">user@worldstreet.com</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Username
                  </label>
                  <p className="mt-1 text-sm">@user</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Member Since
                  </label>
                  <p className="mt-1 text-sm">January 2026</p>
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex justify-end">
              <Button>Edit Profile</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
