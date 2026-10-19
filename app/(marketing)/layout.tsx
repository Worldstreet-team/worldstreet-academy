import { Navbar } from "@/components/marketing/navbar"
import { Footer } from "@/components/marketing/footer"
import { CohortBanner } from "@/components/marketing/cohort-banner"
import { fetchFacultyCount } from "@/lib/actions/student"
import { FACULTY_PUBLIC } from "@/lib/faculty"
import { PartnerVisit } from "@/components/marketing/partner-visit"

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // One count per request drives both "Faculty" links (spec §10): they show
  // only when there is faculty to show. Navbar and footer are server
  // components, so a prop carries it — no client fetch. Never while faculty
  // is hidden from the public site (FACULTY_PUBLIC, owner 2026-10-03).
  const showFaculty = FACULTY_PUBLIC && (await fetchFacultyCount()) > 0

  return (
    <div className="flex min-h-svh flex-col">
      {/* The live cohort's one-line countdown (owner 2026-10-03). It sits
          above the sticky navbar and scrolls away, so the navbar still sticks
          at the top and every sticky offset under it holds. */}
      <CohortBanner variant="bar" />
      <Navbar showFaculty={showFaculty} />
      {/* The navbar is sticky and opaque, so pages simply start below it. */}
      <main className="flex-1">{children}</main>
      <Footer showFaculty={showFaculty} />
      {/* WMA Partners: counts a `?ref=` visit (once per visitor per code per day) */}
      <PartnerVisit />
    </div>
  )
}
