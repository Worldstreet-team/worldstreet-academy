import { Topbar } from "@/components/platform/topbar"
import { PageHeader } from "@/components/shared/page-header"
import { StudentsFilters } from "@/components/instructor/students/students-filters"
import { StudentsList } from "@/components/instructor/students/students-list"
import { CardShell, EmptyState } from "@/components/ui/system"
import { getFacultyStudents } from "@/lib/actions/faculty-students"
import { parseStudentFilters } from "@/lib/faculty-students"

export default async function InstructorStudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const filters = parseStudentFilters(await searchParams)
  const result = await getFacultyStudents(filters)
  const filtered = filters.program !== null || filters.plan !== null || filters.cohort !== null

  return (
    <>
      <Topbar title="My Students" variant="instructor" />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-6xl space-y-6">
          <PageHeader
            title="My Students"
            subline={
              result.success && result.data.scope === "all"
                ? "Every learner in every program."
                : "Every learner in your programs."
            }
          />

          {!result.success ? (
            <CardShell>
              <EmptyState title="Could not load your students" description={result.error} />
            </CardShell>
          ) : (
            <>
              <StudentsFilters values={filters} programs={result.data.programs} cohorts={result.data.cohorts} />
              <p className="text-[13px] text-muted-foreground">
                <span className="tabular-nums">{result.data.total} learners</span>
                {result.data.truncated && <> · Showing the 500 most recently active.</>}
              </p>
              <StudentsList view={result.data} filtered={filtered} />
            </>
          )}
        </div>
      </div>
    </>
  )
}
