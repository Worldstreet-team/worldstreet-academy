import Link from "next/link"
import {
  Award,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Mail,
  MessageCircle,
  Wallet,
} from "lucide-react"
import { Topbar } from "@/components/platform/topbar"
import { PageHeader } from "@/components/shared/page-header"

/**
 * FAQ content is intentionally scoped to how the Academy actually works —
 * wallet-funded enrollment, progress/exams/certificates, instructor
 * applications — so every answer here is verifiable in-product.
 */
const faqs = [
  {
    question: "How do I enroll in a paid course?",
    answer:
      "Paid courses are charged to your WorldStreet wallet — the Academy holds no balance of its own. Open a course, choose Enroll, and confirm the charge at checkout. If your wallet balance is too low, top it up from the Wallet page first; enrollment only completes after the payment is confirmed.",
  },
  {
    question: "How is my course progress tracked?",
    answer:
      "Each lesson you finish is marked complete, and your overall progress is the share of lessons completed. You can see per-course progress on My Courses and pick up exactly where you left off from the course player.",
  },
  {
    question: "When can I take the course exam?",
    answer:
      "The final exam unlocks once you reach 100% progress — every lesson in the course must be completed. If the exam still looks locked, check the course player for any lesson that isn't marked done yet.",
  },
  {
    question: "How do I earn a certificate?",
    answer:
      "Complete all lessons and pass the course exam. Your certificate is then issued automatically and lives on the Certificates page, where you can view and share it any time.",
  },
  {
    question: "How do I become an instructor?",
    answer:
      "Apply from the Become an Instructor page in the sidebar. Tell us about your expertise and the courses you want to teach; our team reviews every application and you'll get a notification with the decision.",
  },
  {
    question: "Can I get a refund on a course?",
    answer:
      "Refunds are handled case by case by the support team. Contact us with your order details (the course name and roughly when you enrolled) and we'll review it. Approved refunds are returned to your WorldStreet wallet.",
  },
  {
    question: "How do I change the language or theme?",
    answer:
      "Both live in Settings. The language picker translates the whole interface and is saved to your account; the theme control switches between light and dark on the device you're using. The globe and theme buttons in the top bar do the same thing.",
  },
]

const quickLinks = [
  {
    title: "Wallet",
    description: "Balance, top-ups and transactions.",
    href: "/dashboard/wallet",
    icon: Wallet,
  },
  {
    title: "Certificates",
    description: "Credentials you have earned.",
    href: "/dashboard/certificates",
    icon: Award,
  },
  {
    title: "Become an instructor",
    description: "Apply to teach on the Academy.",
    href: "/dashboard/become-instructor",
    icon: GraduationCap,
  },
]

export default function HelpPage() {
  return (
    <>
      <Topbar title="Help" />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-3xl space-y-8">
          <PageHeader
            title="Help & support"
            subline="Answers to common questions, and real people when you need them."
          />

          <div className="space-y-8">
            {/* ── FAQ ────────────────────────────────────── */}
            <section className="">
              <h2 className="text-sm font-semibold text-ws-primary">
                Frequently asked questions
              </h2>
              <div className="mt-3 divide-y divide-ws-hairline overflow-hidden rounded-lg border border-ws-hairline bg-ws-surface">
                {faqs.map((faq) => (
                  <details key={faq.question} className="group">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-medium text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised/60 [&::-webkit-details-marker]:hidden">
                      {faq.question}
                      <ChevronDown className="h-4 w-4 shrink-0 text-ws-subtle transition-transform duration-[var(--ws-motion-fast)] group-open:rotate-180" />
                    </summary>
                    <p className="px-5 pb-4 text-[13px] leading-relaxed text-ws-muted">
                      {faq.answer}
                    </p>
                  </details>
                ))}
              </div>
            </section>

            {/* ── Contact support ────────────────────────── */}
            <section className="">
              <h2 className="text-sm font-semibold text-ws-primary">
                Contact support
              </h2>
              <div className="mt-3 divide-y divide-ws-hairline overflow-hidden rounded-lg border border-ws-hairline bg-ws-surface">
                <a
                  href="mailto:support@worldstreetgold.com"
                  className="flex min-h-14 items-center gap-3 px-5 py-3 transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised/60"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ws-raised text-ws-muted">
                    <Mail className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ws-primary">
                      Email us
                    </p>
                    <p className="truncate text-[13px] text-ws-muted">
                      support@worldstreetgold.com · replies within one business
                      day
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ws-subtle" />
                </a>

                <Link
                  href="/dashboard/messages"
                  className="flex min-h-14 items-center gap-3 px-5 py-3 transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised/60"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ws-raised text-ws-muted">
                    <MessageCircle className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ws-primary">
                      Message us
                    </p>
                    <p className="text-[13px] text-ws-muted">
                      Reach an instructor or start a conversation in Messages.
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ws-subtle" />
                </Link>
              </div>
            </section>

            {/* ── Quick links ────────────────────────────── */}
            <section className="">
              <h2 className="text-sm font-semibold text-ws-primary">
                Quick links
              </h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                {quickLinks.map(({ title, description, href, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="group rounded-lg border border-ws-hairline bg-ws-surface p-5 transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ws-raised text-ws-muted transition-colors duration-[var(--ws-motion-fast)] group-hover:text-ws-primary">
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <p className="mt-3 text-sm font-medium text-ws-primary">
                      {title}
                    </p>
                    <p className="mt-0.5 text-[13px] text-ws-muted">
                      {description}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  )
}
