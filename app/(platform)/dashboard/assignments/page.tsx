import { AssessmentList } from "@/components/dashboard/assessment-list"
import { Topbar } from "@/components/platform/topbar"
import { PageHeader } from "@/components/shared/page-header"

export const metadata = { title: "Assignments" }

export default function AssignmentsPage() {
  return (
    <>
      <Topbar title="Assignments" />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-4xl space-y-6">
          <PageHeader
            title="Assignments"
            subline="Practical assignments your plan includes. Hand in your work and see your grade."
          />
          <AssessmentList kind="assignments" />
        </div>
      </div>
    </>
  )
}
