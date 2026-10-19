import { Topbar } from "@/components/platform/topbar"
import { PageHeader } from "@/components/shared/page-header"
import { AssignmentsBoard } from "@/components/instructor/assignments-board"
import { CardShell, EmptyState } from "@/components/ui/system"
import { getMyAssignments } from "@/lib/actions/assignments"

/** Assignments across every program the instructor teaches (institutional blueprint §16). */
export default async function InstructorAllAssignmentsPage() {
  const result = await getMyAssignments()

  return (
    <>
      <Topbar title="Assignments" variant="instructor" />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-5xl space-y-6">
          <PageHeader title="Assignments" subline="Every assignment and project across your programs." />

          {!result.success ? (
            <CardShell>
              <EmptyState title="Could not load your assignments" description={result.error} />
            </CardShell>
          ) : result.data.rows.length === 0 ? (
            <CardShell>
              <EmptyState
                title={result.data.programs === 0 ? "You don't teach a program yet" : "No assignments yet"}
                description="Set assignments and projects from a program's page in My Courses. They appear here with their submissions."
                ctas={[{ label: "Go to My Courses", href: "/instructor/courses" }]}
              />
            </CardShell>
          ) : (
            <AssignmentsBoard rows={result.data.rows} programs={result.data.programs} />
          )}
        </div>
      </div>
    </>
  )
}
