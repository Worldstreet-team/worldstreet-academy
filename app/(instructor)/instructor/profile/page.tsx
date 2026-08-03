import { Topbar } from "@/components/platform/topbar"
import { PageHeader } from "@/components/shared/page-header"
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
      <div className="flex-1 px-6 pb-24 pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-2xl space-y-8">
          <PageHeader
            title="My Profile"
            subline="Manage your instructor profile and signature."
          />

          <InstructorProfileClient
            user={currentUser}
            currentSignatureUrl={currentSignature}
          />
        </div>
      </div>
    </>
  )
}
