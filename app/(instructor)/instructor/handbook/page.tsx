import Link from "next/link"
import { Topbar } from "@/components/platform/topbar"
import { PageHeader } from "@/components/shared/page-header"
import { CardShell } from "@/components/ui/system"
import { CircleCheckBigIcon } from "@/components/icons"
import { getMyHandbookStatus } from "@/lib/actions/instructor-onboarding"
import { COHORT_TIME_ZONE } from "@/lib/cohort"
import { HANDBOOK_APPROVED, HANDBOOK_PAGES } from "@/lib/faculty-handbook"

const SHORT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: COHORT_TIME_ZONE })

export default async function HandbookPage() {
  const status = await getMyHandbookStatus()

  return (
    <>
      <Topbar title="Handbook" variant="instructor" />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-2xl space-y-8">
          <PageHeader
            title="Faculty handbook"
            subline="Teaching standards, curriculum guidelines and platform training. Read each one and acknowledge it."
            action={
              !HANDBOOK_APPROVED ? (
                <span className="rounded-full bg-surface-sunken px-3 py-1 text-[12px] text-muted-foreground">
                  Draft · awaiting approval
                </span>
              ) : undefined
            }
          />
          <div className="space-y-4">
            {HANDBOOK_PAGES.map((page) => {
              const at = status[page.key]
              return (
                <Link key={page.key} href={`/instructor/handbook/${page.slug}`} className="block">
                  <CardShell className="space-y-2 p-5">
                    <h2 className="text-[16px] font-semibold text-foreground">{page.title}</h2>
                    <p className="text-[14px] text-muted-foreground">{page.summary}</p>
                    {at ? (
                      <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                        <CircleCheckBigIcon size={14} className="text-ws-success" />
                        Acknowledged {SHORT.format(new Date(at))}
                      </p>
                    ) : (
                      <p className="text-[13px] text-muted-foreground">Not yet acknowledged</p>
                    )}
                  </CardShell>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
