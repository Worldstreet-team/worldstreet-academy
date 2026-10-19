import Link from "next/link"

import { Topbar } from "@/components/platform/topbar"
import { PageHeader } from "@/components/shared/page-header"
import { CardHeader, CardShell, EmptyState } from "@/components/ui/system"
import { getMyCourseMaterials, type FacultyMaterial } from "@/lib/actions/resources"
import { RESOURCE_KIND_LABEL, fileSizeLabel } from "@/lib/faculty-format"

/*
 * Course Materials (institutional blueprint §16): each program's downloadable
 * materials, read only. Uploads and removals stay in the course page's
 * materials section ("Manage"). Metadata only — no file or link leaves here.
 */

function materialMeta(m: FacultyMaterial): string {
  return [RESOURCE_KIND_LABEL[m.kind], fileSizeLabel(m.sizeBytes) || null, m.lesson ? `Lesson: ${m.lesson}` : "Whole program"]
    .filter(Boolean)
    .join(" · ")
}

const count = (n: number) => (n === 1 ? "1 material" : `${n} materials`)

export default async function InstructorMaterialsPage() {
  const result = await getMyCourseMaterials()
  const programs = result.success ? result.data.programs : []
  const withMaterials = programs.filter((p) => p.materials.length > 0)
  const empty = programs.filter((p) => p.materials.length === 0)

  return (
    <>
      <Topbar title="Course Materials" variant="instructor" breadcrumbOverrides={{ materials: "Course Materials" }} />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-5xl space-y-6">
          <PageHeader title="Course Materials" subline="The downloads in each of your programs." />

          {!result.success ? (
            <CardShell>
              <EmptyState title="Could not load your course materials" description={result.error} />
            </CardShell>
          ) : result.data.programs.length === 0 ? (
            <CardShell>
              <EmptyState
                title="You don't teach a program yet"
                description="Materials you add to a program's page appear here."
                ctas={[{ label: "Go to My Courses", href: "/instructor/courses" }]}
              />
            </CardShell>
          ) : (
            <>
              <p className="text-[13px] tabular-nums text-muted-foreground">
                {count(result.data.total)} ·{" "}
                {result.data.programs.length === 1 ? "1 program" : `${result.data.programs.length} programs`}
              </p>
              {withMaterials.map((p) => (
                <CardShell key={p.id} className="h-auto">
                  <CardHeader title={p.title} subtitle={count(p.materials.length)} link={{ label: "Manage", href: p.manageHref }} />
                  <ul className="divide-y divide-border border-t border-border">
                    {p.materials.map((m) => (
                      <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-[14px] font-medium">{m.title}</span>
                          <span className="truncate text-[12.5px] text-muted-foreground">{materialMeta(m)}</span>
                        </span>
                        {m.isFree && (
                          <span className="shrink-0 rounded-full bg-ws-chip px-2.5 py-0.5 text-[12px] font-semibold text-muted-foreground">
                            Free preview
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </CardShell>
              ))}

              {/* Programs with nothing yet share one card, so they don't bury the ones that have materials. */}
              {empty.length > 0 && (
                <CardShell className="h-auto">
                  <CardHeader
                    title="No materials yet"
                    subtitle={empty.length === 1 ? "1 program" : `${empty.length} programs`}
                  />
                  <ul className="divide-y divide-border border-t border-border">
                    {empty.map((p) => (
                      <li key={p.id}>
                        <Link
                          href={p.manageHref}
                          className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-foreground/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        >
                          <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{p.title}</span>
                          <span className="shrink-0 text-[13px] font-medium text-muted-foreground">Manage</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardShell>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
