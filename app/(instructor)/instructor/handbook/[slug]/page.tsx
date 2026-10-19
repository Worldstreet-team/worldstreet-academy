import { notFound } from "next/navigation"
import { Topbar } from "@/components/platform/topbar"
import { BackAction } from "@/components/ui/system"
import { HandbookAcknowledge } from "@/components/instructor/handbook-acknowledge"
import { getMyHandbookStatus } from "@/lib/actions/instructor-onboarding"
import {
  EARNINGS_CLEARING_DAYS,
  INSTRUCTOR_REVENUE_SHARE,
  MARKETPLACE_SHARE_ACADEMY,
  MARKETPLACE_SHARE_OWN_LINK,
  REFERRAL_COMMISSION_RATE,
} from "@/lib/db/models"
import { HANDBOOK_APPROVED, handbookPageBySlug, handbookSections } from "@/lib/faculty-handbook"

export default async function HandbookPageView({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const page = handbookPageBySlug(slug)
  if (!page) notFound()

  const status = await getMyHandbookStatus()
  const sections = handbookSections(page.key, {
    facultyShare: INSTRUCTOR_REVENUE_SHARE,
    creatorShareOwnLink: MARKETPLACE_SHARE_OWN_LINK,
    creatorShareAcademy: MARKETPLACE_SHARE_ACADEMY,
    referralRate: REFERRAL_COMMISSION_RATE,
    clearingDays: EARNINGS_CLEARING_DAYS,
  })

  return (
    <>
      <Topbar title="Handbook" variant="instructor" />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-2xl space-y-8">
          <div className="flex items-start gap-3">
            <BackAction to="/instructor/handbook" />
            <div className="min-w-0 space-y-1">
              <h1 className="font-display text-[28px] font-semibold tracking-[-0.02em] text-ws-primary">{page.title}</h1>
              <p className="text-[15px] text-ws-muted">{page.summary}</p>
              {!HANDBOOK_APPROVED && (
                <span className="mt-1 inline-block rounded-full bg-surface-sunken px-3 py-1 text-[12px] text-muted-foreground">
                  Draft · awaiting approval
                </span>
              )}
            </div>
          </div>

          <div className="max-w-2xl space-y-8">
            {sections.map((section) => (
              <section key={section.heading} className="space-y-3">
                <h2 className="text-[18px] font-semibold text-foreground">{section.heading}</h2>
                {section.blocks.map((block, i) =>
                  block.kind === "p" ? (
                    <p key={i} className="text-[15px] leading-relaxed text-muted-foreground">
                      {block.text}
                    </p>
                  ) : (
                    <ul key={i} className="list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-muted-foreground">
                      {block.items.map((it, j) => (
                        <li key={j}>
                          {it.title ? (
                            <>
                              <strong className="font-semibold text-foreground">{it.title}</strong> — {it.text}
                            </>
                          ) : (
                            it.text
                          )}
                        </li>
                      ))}
                    </ul>
                  )
                )}
              </section>
            ))}
          </div>

          <div className="border-t border-border pt-6">
            <HandbookAcknowledge handbookKey={page.key} title={page.title} acknowledgedAt={status[page.key]} />
          </div>
        </div>
      </div>
    </>
  )
}
