import { Award01Icon, BookOpen01Icon, LinkSquare02Icon, Mortarboard01Icon, UserMultiple02Icon } from "@/components/icons"
import { TILE_ROW, TILE_ROWS } from "@/components/dashboard/tile-bits"
import { Topbar } from "@/components/platform/topbar"
import { PageHeader } from "@/components/shared/page-header"
import { CardShell, EmptyState } from "@/components/ui/system"
import { fetchMyEnrollments } from "@/lib/actions/student"
import { COMMUNITY_SCOPE_TITLE, myCommunities, type CommunityScope } from "@/lib/communities"

export const metadata = { title: "Communities" }

const SCOPE_ICON: Record<CommunityScope, React.ComponentType<{ className?: string }>> = {
  program: BookOpen01Icon,
  school: Mortarboard01Icon,
  academy: UserMultiple02Icon,
  executive: Award01Icon,
}

/** Program, school and Academy groups (blueprint §14, D26): external links, no in-app forum. */
export default async function CommunitiesPage() {
  const links = myCommunities(await fetchMyEnrollments())
  return (
    <>
      <Topbar title="Communities" />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-4xl space-y-6">
          <PageHeader
            title="Communities"
            subline="Your program, school and Academy groups — relationships beyond your classes. Each opens in a new tab."
          />
          {links.length === 0 ? (
            <EmptyState
              title="No community links yet"
              description="Links to your program, school and Academy communities appear here when they're ready."
            />
          ) : (
            <CardShell>
              <div className={TILE_ROWS}>
                {links.map((link) => {
                  const Icon = SCOPE_ICON[link.scope]
                  return (
                    <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className={TILE_ROW}>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/[0.12]">
                        <Icon className="h-[18px] w-[18px] text-primary" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[14px] font-medium">{COMMUNITY_SCOPE_TITLE[link.scope]}</span>
                        <span className="truncate text-[12.5px] text-muted-foreground" title={link.label}>
                          {link.label}
                        </span>
                      </span>
                      <LinkSquare02Icon className="h-4 w-4 shrink-0 text-muted-foreground/70" aria-hidden />
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  )
                })}
              </div>
            </CardShell>
          )}
        </div>
      </div>
    </>
  )
}
