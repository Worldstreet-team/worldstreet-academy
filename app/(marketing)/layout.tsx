import { Navbar } from "@/components/marketing/navbar"
import { Footer } from "@/components/marketing/footer"
import { CohortBanner } from "@/components/marketing/cohort-banner"
import { fetchFacultyCount } from "@/lib/actions/student"
import { FACULTY_PUBLIC } from "@/lib/faculty"
import { getCohortCalendar } from "@/lib/cohort-calendar"

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // One count per request drives both "Faculty" links (spec §10): they show
  // only when there is faculty to show. Navbar and footer are server
  // components, so a prop carries it — no client fetch. Never while faculty
  // is hidden from the public site (FACULTY_PUBLIC, owner 2026-10-03).
  const [facultyCount, calendar] = await Promise.all([
    FACULTY_PUBLIC ? fetchFacultyCount() : Promise.resolve(0),
    getCohortCalendar(),
  ])
  const showFaculty = FACULTY_PUBLIC && facultyCount > 0

  return (
    <div className="flex min-h-svh flex-col">
      {/* The live cohort's one-line countdown (owner 2026-10-03), the next cohort in the database. It sits
          above the sticky navbar and scrolls away, so the navbar still sticks
          at the top and every sticky offset under it holds. */}
      <CohortBanner variant="bar" cohort={calendar.next} />
      <Navbar showFaculty={showFaculty} />
      {/* The navbar is sticky and opaque, so pages simply start below it. */}
      <main className="flex-1">{children}</main>
      <Footer showFaculty={showFaculty} />
    </div>
  )
}
