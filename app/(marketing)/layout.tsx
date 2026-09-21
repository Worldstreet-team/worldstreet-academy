import { Navbar } from "@/components/marketing/navbar"
import { Footer } from "@/components/marketing/footer"
import { fetchFacultyCount } from "@/lib/actions/student"

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // One count per request drives both "Faculty" links (spec §10): they show
  // only when there is faculty to show. Navbar and footer are server
  // components, so a prop carries it — no client fetch.
  const showFaculty = (await fetchFacultyCount()) > 0

  return (
    <div className="flex min-h-svh flex-col">
      <Navbar showFaculty={showFaculty} />
      {/* The navbar is sticky and opaque, so pages simply start below it. */}
      <main className="flex-1">{children}</main>
      <Footer showFaculty={showFaculty} />
    </div>
  )
}
