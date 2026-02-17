import { Topbar } from "@/components/platform/topbar"
import { getCurrentUser } from "@/lib/auth"
import { getMySignature } from "@/lib/actions/signature"
import { InstructorProfileClient } from "./instructor-profile-client"

export default async function InstructorProfilePage() {
  const [currentUser, currentSignature] = await Promise.all([
    getCurrentUser(),
    getMySignature(),
  ])

  return (
    <>
      <Topbar title="Profile" variant="instructor" />
      <div className="p-4 md:p-6 space-y-6 max-w-2xl pb-24 md:pb-8">
        <div>
          <h1 className="text-xl font-bold">My Profile</h1>
          <p className="text-sm text-muted-foreground">
            Manage your instructor profile and signature.
          </p>
        </div>

        <InstructorProfileClient
          user={currentUser}
          currentSignatureUrl={currentSignature}
        />
      </div>
    </>
  )
}
