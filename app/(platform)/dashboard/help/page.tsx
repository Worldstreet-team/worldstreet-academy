import { Topbar } from "@/components/platform/topbar"
import { CardHeader, CardShell, PageHeader, Rise } from "@/components/ui/system"
import { FaqList, type Faq } from "@/components/help/faq-list"
import { QuickLinks, type QuickLink } from "@/components/help/quick-links"
import { SupportContact } from "@/components/help/support-contact"

/**
 * FAQ content is intentionally scoped to how the Academy actually works —
 * wallet-funded enrollment, progress/exams/certificates, instructor
 * applications — so every answer here is verifiable in-product.
 */
const faqs: Faq[] = [
  {
    question: "How do I enroll in a paid course?",
    answer:
      "Paid courses are charged to your WorldStreet wallet — the Academy holds no balance of its own. Open a course, choose Enroll, and confirm the charge at checkout. If your wallet balance is too low, top it up from the Wallet page first; enrollment only completes after the payment is confirmed.",
  },
  {
    question: "How is my course progress tracked?",
    answer:
      "Each lesson you finish is marked complete, and your overall progress is the share of lessons completed. You can see per-course progress on My programs and pick up exactly where you left off from the course player.",
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

const quickLinks: QuickLink[] = [
  {
    title: "Wallet",
    description: "Balance, top-ups and transactions.",
    href: "/dashboard/wallet",
    icon: "wallet",
  },
  {
    title: "Certificates",
    description: "Credentials you have earned.",
    href: "/dashboard/certificates",
    icon: "certificates",
  },
  {
    title: "Become an instructor",
    description: "Apply to teach on the Academy.",
    href: "/dashboard/become-instructor",
    icon: "instructor",
  },
]

/**
 * Renders with no server data — no await, no DB call — so the route
 * prerenders and a sidebar click paints at once. The one per-student fact
 * (priority support) is resolved client-side inside SupportContact.
 */
export default function HelpPage() {
  return (
    <>
      <Topbar title="Help" />
      <div className="flex-1 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 sm:px-6 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <PageHeader title="Help" subtitle="Answers to common questions, and real people when you need them." />

          <Rise>
            <QuickLinks links={quickLinks} />
          </Rise>

          <Rise delay={60}>
            <CardShell>
              <CardHeader title="Frequently asked questions" subtitle="How enrollment, progress and certificates work." />
              <FaqList faqs={faqs} />
            </CardShell>
          </Rise>

          <Rise delay={120}>
            <SupportContact />
          </Rise>
        </div>
      </div>
    </>
  )
}
