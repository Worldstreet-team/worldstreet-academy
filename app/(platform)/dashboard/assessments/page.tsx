import { AssessmentList } from "@/components/dashboard/assessment-list"
import { Topbar } from "@/components/platform/topbar"
import { PageHeader } from "@/components/shared/page-header"

export const metadata = { title: "Assessments" }

export default function AssessmentsPage() {
  return (
    <>
      <Topbar title="Assessments" />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-4xl space-y-6">
          <PageHeader
            title="Assessments"
            subline="Knowledge checks and final exams your plan includes — your attempts, best score and pass mark."
          />
          <AssessmentList kind="assessments" />
        </div>
      </div>
    </>
  )
}
