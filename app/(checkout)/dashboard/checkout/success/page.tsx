import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { redirect } from "next/navigation"
import {
  ArrowRightIcon,
  AwardIcon,
  HandshakeIcon,
  MailIcon,
  PlayIcon,
  RadioIcon,
  type LucideIcon,
} from "lucide-react"
import { BRAND } from "@/lib/brand"
import { getCachedUser } from "@/lib/auth/cached"
import { getCourseAccess, getLearnStart } from "@/lib/course-access"
import { getCheckoutConfirmation } from "@/lib/actions/enrollments"
import { fetchProgramById } from "@/lib/actions/student"
import { fetchProgramCurriculum } from "@/lib/actions/program-page"
import { PACKAGE_LABEL } from "@/lib/entitlements"
import { SCHOOL_BY_SLUG } from "@/lib/schools"
import { SchoolIcon } from "@/components/shared/school-icon"
import { EnrolledSeal } from "@/components/checkout/enrolled-seal"
import { MentorshipIntakeForm } from "@/components/checkout/mentorship-intake-form"
import { grantedServices } from "@/components/checkout/order-lines"

export const metadata: Metadata = {
  title: "Enrollment confirmed",
  robots: { index: false, follow: false },
}

type NextStep = { icon: LucideIcon; title: string; body: string }

/**
 * Spec §12/§17 "Payment successful → Enrollment confirmed" — server-rendered
 * from the enrollment, never from query params: without an access-granting
 * enrollment there is nothing to confirm and the visitor goes to the course
 * page, which holds the right next step.
 */
export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ courseId?: string; new?: string }>
}) {
  const { courseId, new: fresh } = await searchParams
  // Set by checkout after a purchase it just made. It only decides whether to
  // mention the confirmation email — a buyer who already owned the program
  // (checkout sends them here too) is not being emailed anything now.
  const justEnrolled = fresh === "1"
  const confirmation = courseId ? await getCheckoutConfirmation(courseId) : null

  // No access-granting enrollment (bad link, unpaid reservation, refund) —
  // the course page holds the right next step.
  if (!confirmation) {
    redirect(courseId ? `/dashboard/courses/${courseId}` : "/dashboard/my-courses")
  }

  const user = await getCachedUser()
  const [program, access, curriculum, start] = await Promise.all([
    fetchProgramById(confirmation.courseId),
    user ? getCourseAccess(user.id, confirmation.courseId) : Promise.resolve(null),
    fetchProgramCurriculum(confirmation.courseId),
    user ? getLearnStart(user.id, confirmation.courseId) : Promise.resolve(null),
  ])

  // Straight into the player where this learner starts; while their package
  // opens no lesson yet, the course page's waiting state.
  const startHref = start?.href ?? `/dashboard/courses/${confirmation.courseId}`
  const startLesson = start ? curriculum.find((lesson) => lesson.id === start.lessonId) : undefined

  const title = program?.title ?? confirmation.courseTitle
  const school = program?.school ? SCHOOL_BY_SLUG[program.school] : null
  // Services are promises only for a package the buyer actually bought: a
  // legacy or free enrollment has no package, and its FULL_ACCESS is access,
  // never a list of things to expect.
  const packageKey = access?.packageKey ?? null
  const bought = packageKey ? access?.course.packages.find((p) => p.key === packageKey) : undefined
  const services = access && bought ? grantedServices(access.entitlements, packageKey) : new Set<string>()
  const tierLabel = packageKey && program && program.tierCount > 1 ? PACKAGE_LABEL[packageKey] : null

  const steps: NextStep[] = [
    start
      ? {
          icon: PlayIcon,
          title: "Your lessons are open",
          body: !startLesson
            ? "Everything your package includes is unlocked now."
            : start.resumed
              ? `Pick up where you left off — “${startLesson.title}”.`
              : `Start with “${startLesson.title}” — or pick up anywhere in the program.`,
        }
      : {
          icon: PlayIcon,
          title: "Your program is in your dashboard",
          body: "Lessons open there as your instructor publishes them.",
        },
  ]
  if (justEnrolled && user?.email) {
    steps.push({ icon: MailIcon, title: "A confirmation is on its way", body: `We're sending the details to ${user.email}.` })
  }
  if (confirmation.intakeSent) {
    steps.push({
      icon: HandshakeIcon,
      title: "Your mentor has your intake",
      body: "They'll be in touch to schedule your onboarding session.",
    })
  }
  if (services.has("liveClasses")) {
    steps.push({
      icon: RadioIcon,
      title: "Live classes",
      body: "When your instructor schedules one, it appears in your dashboard.",
    })
  }
  if (services.has("certificate")) {
    steps.push({
      icon: AwardIcon,
      title: "Earn your certificate",
      body: `Complete the program to receive your ${BRAND.name} certificate.`,
    })
  }

  return (
    <div className="flex flex-1 flex-col items-center px-4 pb-16 pt-8 sm:pt-12">
      <div className="w-full max-w-[560px]">
        <EnrolledSeal />

        <div className="-mt-3 text-center">
          <p
            className="rise text-[12px] font-semibold uppercase tracking-[0.14em] text-credit"
            style={{ "--rise-delay": "380ms" } as React.CSSProperties}
          >
            Enrollment confirmed
          </p>
          <h1
            className="rise mt-3 text-balance font-display text-[30px] font-semibold leading-[1.1] tracking-[-0.02em] text-ws-primary sm:text-[36px]"
            style={{ "--rise-delay": "440ms" } as React.CSSProperties}
          >
            Welcome to {title}
          </h1>
          <p
            className="rise mt-3 text-[15.5px] leading-relaxed text-ws-muted"
            style={{ "--rise-delay": "500ms" } as React.CSSProperties}
          >
            Your learning journey starts now.
          </p>
        </div>

        {/* The next step comes straight after the news, above the fold on a
            laptop and a phone; the details follow for whoever wants them. */}
        <div
          className="rise mx-auto mt-8 flex max-w-[440px] flex-col gap-2.5 sm:flex-row-reverse"
          style={{ "--rise-delay": "560ms" } as React.CSSProperties}
        >
          <Link
            href={startHref}
            className="flex h-[52px] items-center justify-center gap-2 rounded-full bg-ws-brand px-6 sm:flex-1 text-[15px] font-semibold text-ws-brand-on transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-brand/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ws-page active:translate-y-px"
          >
            {start ? "Start learning" : "Open your program"}
            <ArrowRightIcon size={17} aria-hidden />
          </Link>
          <Link
            href="/dashboard?welcome=1"
            className="flex h-[52px] items-center justify-center rounded-full border border-ws-hairline px-6 sm:flex-1 text-[15px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 active:translate-y-px"
          >
            Go to dashboard
          </Link>
        </div>

        <section
          aria-label="Your enrollment"
          className="rise mt-10 overflow-hidden rounded-[20px] border border-ws-hairline bg-ws-surface dark:border-transparent"
          style={{ "--rise-delay": "640ms" } as React.CSSProperties}
        >
          <div className="flex items-center gap-4 p-5">
            <span className="relative block aspect-[16/10] w-24 shrink-0 overflow-hidden rounded-[12px] bg-ws-raised sm:w-28">
              {program?.thumbnailUrl ? (
                <Image src={program.thumbnailUrl} alt="" fill sizes="112px" className="object-cover" />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-ws-muted">
                  <SchoolIcon name={school?.icon ?? "graduation-cap"} size={24} aria-hidden />
                </span>
              )}
            </span>
            <div className="min-w-0 flex-1">
              {school && (
                <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-ws-muted">{school.short}</p>
              )}
              <p className="mt-1 font-display text-[17px] font-semibold leading-tight text-ws-primary">{title}</p>
              {tierLabel && confirmation.packageName && (
                <p className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-ws-brand/[0.12] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ws-gold">
                    {tierLabel}
                  </span>
                  <span className="text-[13.5px] text-ws-muted">{confirmation.packageName}</span>
                </p>
              )}
            </div>
          </div>

          <div className="border-t border-ws-hairline px-5 pb-5 pt-4">
            <h2 className="text-[13px] font-semibold text-ws-primary">What happens next</h2>
            <ul className="mt-3 space-y-3.5">
              {steps.slice(0, 4).map(({ icon: Icon, title: stepTitle, body }) => (
                <li key={stepTitle} className="flex items-start gap-3">
                  <span aria-hidden className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-ws-sunken text-ws-muted">
                    <Icon size={15} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14px] font-semibold text-ws-primary">{stepTitle}</span>
                    <span className="mt-0.5 block break-words text-[13.5px] leading-relaxed text-ws-muted">{body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {confirmation.needsIntake && (
          <div className="rise mt-5" style={{ "--rise-delay": "700ms" } as React.CSSProperties}>
            <MentorshipIntakeForm courseId={confirmation.courseId} />
          </div>
        )}

      </div>
    </div>
  )
}
