"use client"

import { Topbar } from "@/components/platform/topbar"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useUser } from "@/components/providers/user-provider"

export default function ProfilePage() {
  const user = useUser()

  const initials = user
    ? `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || user.email?.[0]?.toUpperCase() || "U"
    : "U"

  const fullName = user
    ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || "User"
    : "User"

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "—"

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
                {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={fullName} />}
                <AvatarFallback className="text-lg bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">{fullName}</h2>
                <p className="text-sm text-muted-foreground">{user?.email || "—"}</p>
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
                  <p className="mt-1 text-sm">{fullName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Email
                  </label>
                  <p className="mt-1 text-sm">{user?.email || "—"}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Role
                  </label>
                  <p className="mt-1 text-sm capitalize">{user?.role || "User"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Member Since
                  </label>
                  <p className="mt-1 text-sm">{memberSince}</p>
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
