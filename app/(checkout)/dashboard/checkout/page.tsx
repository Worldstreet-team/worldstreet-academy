import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ReceiptTextIcon } from "lucide-react"
import { getCachedUser } from "@/lib/auth/cached"
import { checkEnrollment } from "@/lib/actions/enrollments"
import { getMyWalletBalance } from "@/lib/actions/wallet"
import { fetchProgramById } from "@/lib/actions/student"
import { fetchProgramCurriculum } from "@/lib/actions/program-page"
import { PACKAGE_RANK } from "@/lib/entitlements"
import { courseAvailability, type CourseStatus } from "@/lib/types/course"
import { CheckoutView, type CheckoutFacts } from "@/components/checkout/checkout-view"

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
}

type Search = { courseId?: string | string[]; package?: string | string[] }

/**
 * `/dashboard/checkout?courseId=<id>&package=<key>` — the last step of
 * Homepage → School → Program → Package → Checkout (blueprint §18).
 *
 * Everything that can be settled before the buyer acts is settled here, on
 * the server, so the page never renders a choice that belongs elsewhere:
 *   · already enrolled → the confirmation page;
 *   · not live yet → the program page (its scheduling CTA is the right door);
 *   · a multi-package program without a valid `package` → the program page's
 *     package chooser, where the choice now lives (a single-price program
 *     needs no package);
 *   · otherwise the order, with the wallet balance already read.
 */
export default async function CheckoutPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams
  // Only a well-formed id reaches the database; anything else is "not found".
  const courseId = typeof params.courseId === "string" && /^[a-f0-9]{24}$/i.test(params.courseId) ? params.courseId : null
  const packageParam = typeof params.package === "string" ? params.package : null

  // The layout redirects a signed-out visitor; this only narrows the type.
  const user = await getCachedUser()
  if (!user) return null

  const [program, enrollment] = courseId
    ? await Promise.all([fetchProgramById(courseId), checkEnrollment(user.id, courseId)])
    : [null, null]
  if (!program || !enrollment) return <ProgramNotFound />

  if (enrollment.isEnrolled) redirect(`/dashboard/checkout/success?courseId=${program.id}`)

  if (courseAvailability({ status: program.status as CourseStatus, availableAt: program.availableAt }) === "coming_soon") {
    redirect(`/programs/${program.slug}`)
  }

  const selected =
    program.packages.length === 1
      ? program.packages[0]
      : (program.packages.find((p) => p.key === packageParam) ?? null)
  if (!selected) redirect(`/programs/${program.slug}#packages`)

  const [wallet, curriculum] = await Promise.all([getMyWalletBalance(), fetchProgramCurriculum(program.id)])

  // A lesson's `tier` is set only when it sits above the program's cheapest
  // tier; the chosen package opens it when its rank reaches that tier.
  const open = curriculum.filter((l) => !l.tier || PACKAGE_RANK[l.tier] <= PACKAGE_RANK[selected.key])
  const facts: CheckoutFacts = {
    lessons: curriculum.length,
    openLessons: open.length,
    openVideoSec: open.reduce((sum, l) => sum + (l.durationSec ?? 0), 0),
  }

  return (
    <CheckoutView
      program={program}
      packageKey={selected.key}
      wallet={wallet}
      facts={facts}
      reservedSeat={enrollment.status === "pre_enrolled"}
    />
  )
}

function ProgramNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-24">
      <div className="flex max-w-sm flex-col items-center text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-ws-surface text-ws-muted">
          <ReceiptTextIcon size={20} aria-hidden />
        </span>
        <h1 className="mt-5 font-display text-[22px] font-semibold tracking-[-0.015em] text-ws-primary">
          This order isn&apos;t available
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ws-muted">
          The program in this link couldn&apos;t be found, or it isn&apos;t open for enrollment. Nothing has been charged.
        </p>
        <Link
          href="/programs"
          className="mt-6 flex h-11 items-center justify-center rounded-full bg-ws-brand px-6 text-[14px] font-semibold text-ws-brand-on transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-brand/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ws-page"
        >
          Browse programs
        </Link>
      </div>
    </div>
  )
}
