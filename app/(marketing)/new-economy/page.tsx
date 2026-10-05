import type { Metadata } from "next"
import Link from "next/link"
import { SparklesIcon } from "lucide-react"
import { BRAND } from "@/lib/brand"
import { appUrl } from "@/lib/app-url"
import { fetchBrowseCourses } from "@/lib/actions/student"
import { getCachedUser } from "@/lib/auth/cached"
import { MarketingCourseCard } from "@/components/marketing/course-card"

export const metadata: Metadata = {
  title: "New Economy — free courses",
  description: `Free courses on the new economy from ${BRAND.name}: how to use each WorldStreet product, step by step.`,
  alternates: { canonical: appUrl("/new-economy") },
}

// Publishing changes the list under a cached render.
export const revalidate = 0

/** What the courses walk through — the WorldStreet products, in the hub's order. */
const PRODUCTS = ["Dashboard", "Wallet", "Shop", "Social", "Xstream", "Forex Trading", "Vivid AI", "Vision", "Arcade", "Prediction"]

/**
 * `/new-economy` — free courses explaining how to use each WorldStreet
 * product (owner meeting 2026-10-03). Lists published `new-economy` courses
 * only; they are free by rule (the editor and the catalogue script both set
 * them free), so the cards read "Free".
 */
export default async function NewEconomyPage() {
  const [user, courses] = await Promise.all([getCachedUser(), fetchBrowseCourses({ kind: "new-economy" })])
  const signedIn = Boolean(user)

  return (
    <div className="mx-auto max-w-7xl px-6 pb-24 pt-10 md:pb-32 md:pt-16">
      <header className="max-w-3xl">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ws-muted">New Economy · Free</p>
        <h1
          className="mt-3 font-display font-semibold leading-[1.05] tracking-[-0.02em] text-ws-primary"
          style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)" }}
        >
          Free courses on the new economy
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ws-muted md:text-[17px]">
          How to use WorldStreet&rsquo;s products. Digital money, online markets and the tools to work them now sit in
          one ecosystem — each short course walks you through one product, step by step, at your own pace. No charge,
          ever.
        </p>
        <ul aria-label="Products covered" className="mt-6 flex flex-wrap gap-2">
          {PRODUCTS.map((product) => (
            <li
              key={product}
              className="rounded-full bg-ws-chip px-3 py-1 text-[12.5px] font-medium text-ws-primary"
            >
              {product}
            </li>
          ))}
        </ul>
      </header>

      {courses.length > 0 ? (
        <ul className="rise mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {courses.map((course) => (
            <li key={course.id}>
              <MarketingCourseCard course={course} signedIn={signedIn} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-12 rounded-[20px] border border-dashed border-ws-hairline p-10 text-center md:p-14">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-ws-surface text-ws-muted">
            <SparklesIcon size={20} aria-hidden />
          </span>
          <p className="mt-4 font-display text-xl font-semibold text-ws-primary">The first free courses are on the way</p>
          <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-ws-muted">
            One course per WorldStreet product is being recorded. In the meantime, explore the schools.
          </p>
          <Link
            href="/schools"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-full border border-ws-hairline px-6 text-[14px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-surface"
          >
            Explore the schools
          </Link>
        </div>
      )}
    </div>
  )
}
