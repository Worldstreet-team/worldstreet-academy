import { Topbar } from "@/components/platform/topbar"
import { PageHeader } from "@/components/shared/page-header"
import { PerformanceLists, ProgramSummaryCard } from "@/components/instructor/students/performance-view"
import { StudentsFilters } from "@/components/instructor/students/students-filters"
import { CardShell, EmptyState } from "@/components/ui/system"
import { getStudentPerformanceOverview } from "@/lib/actions/faculty-students"
import { parseStudentFilters } from "@/lib/faculty-students"

/** Student Performance across every learner the instructor teaches (institutional blueprint §16). */
export default async function InstructorPerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const filters = parseStudentFilters(await searchParams)
  const result = await getStudentPerformanceOverview(filters)
  const filtered = filters.program !== null || filters.plan !== null || filters.cohort !== null

  return (
    <>
      <Topbar title="Student Performance" variant="instructor" breadcrumbOverrides={{ performance: "Student Performance" }} />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-6xl space-y-6">
          <PageHeader
            title="Student Performance"
            subline={
              result.success && result.data.scope === "all"
                ? "How learners are doing in every program."
                : "How your learners are doing, program by program."
            }
          />

          {!result.success ? (
            <CardShell>
              <EmptyState title="Could not load student performance" description={result.error} />
            </CardShell>
          ) : result.data.programs.length === 0 ? (
            <CardShell>
              <EmptyState
                title="No learners yet"
                description="Once learners enrol in your programs, their progress, exams and Mastery Score appear here."
                ctas={[{ label: "Go to My Courses", href: "/instructor/courses" }]}
              />
            </CardShell>
          ) : (
            <>
              <StudentsFilters
                values={filters}
                programs={result.data.programs}
                cohorts={result.data.cohorts}
                base="/instructor/performance"
              />
              <p className="text-[13px] text-muted-foreground">
                <span className="tabular-nums">{result.data.total} learners</span>
                {result.data.truncated && <> · Every learner counts in the summaries; the lists show the first 500.</>}
              </p>
              {result.data.summaries.length === 0 ? (
                <CardShell>
                  <EmptyState
                    title={filtered ? "No learners match these filters" : "No learners yet"}
                    ctas={filtered ? [{ label: "Clear filters", href: "/instructor/performance" }] : []}
                  />
                </CardShell>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {result.data.summaries.map((s) => (
                      <ProgramSummaryCard key={s.id} summary={s} masteryReady={result.data.masteryReady} filters={filters} />
                    ))}
                  </div>
                  <PerformanceLists view={result.data} />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
