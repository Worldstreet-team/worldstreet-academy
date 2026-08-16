import { Navbar } from "@/components/marketing/navbar"
import { Footer } from "@/components/marketing/footer"

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <Navbar />
      {/* The navbar is fixed, so every marketing page clears it; the landing
          hero cancels this with -mt to run beneath the transparent bar. */}
      <main className="flex-1 pt-[4.25rem] sm:pt-[5.25rem]">{children}</main>
      <Footer />
    </div>
  )
}
