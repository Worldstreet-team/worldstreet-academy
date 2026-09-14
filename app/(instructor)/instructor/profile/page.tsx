import { Topbar } from "@/components/platform/topbar"
import { PageHeader } from "@/components/shared/page-header"
import { getCurrentUser } from "@/lib/auth"
import { getMySignature } from "@/lib/actions/signature"
import { getMyFacultyProfile } from "@/lib/actions/profile"
import { countryOptions } from "@/lib/countries"
import { InstructorProfileClient } from "./instructor-profile-client"
import { FacultyProfileCard } from "./faculty-profile-card"

export default async function InstructorProfilePage() {
  const [currentUser, currentSignature, faculty] = await Promise.all([
    getCurrentUser(),
    getMySignature(),
    getMyFacultyProfile(),
  ])

  return (
    <>
      <Topbar title="Profile" variant="instructor" />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-2xl space-y-8">
          <PageHeader
            title="My Profile"
            subline="Manage your instructor profile, faculty page and signature."
          />

          <InstructorProfileClient
            user={currentUser}
            currentSignatureUrl={currentSignature}
          >
            {/* Country names are computed here, on the server, so the select's
                server-rendered label matches hydration. */}
            {faculty && <FacultyProfileCard initial={faculty} countries={countryOptions()} />}
          </InstructorProfileClient>
        </div>
      </div>
    </>
  )
}
