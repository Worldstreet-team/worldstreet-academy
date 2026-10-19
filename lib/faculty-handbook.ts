import { sharePercent } from "@/lib/marketplace"
import { HOST_EARLY_START_MS } from "@/lib/class-schedule"

/**
 * The faculty handbook — institutional blueprint §16 (Teaching standards →
 * Curriculum guidelines → Platform training), D29. The one home for its copy.
 *
 * OWNER SIGN-OFF REQUIRED. Drafted 2026-10-19 from the blueprint and the
 * platform's real rules. Every figure is either passed in from the constant
 * that enforces it or is a literal whose source is named beside it. Until the
 * owner approves the text, HANDBOOK_APPROVED stays false and each page shows
 * "Draft". Client-safe: the onboarding checklist reads the titles.
 */
export const HANDBOOK_APPROVED: boolean = false

export const HANDBOOK_KEYS = ["teachingStandards", "curriculumGuidelines", "platformTraining"] as const
export type HandbookKey = (typeof HANDBOOK_KEYS)[number]

export type HandbookPage = {
  key: HandbookKey
  slug: string
  title: string
  summary: string
  checklistLabel: string
}

export type HandbookFigures = {
  /** INSTRUCTOR_REVENUE_SHARE */
  facultyShare: number
  /** MARKETPLACE_SHARE_OWN_LINK */
  creatorShareOwnLink: number
  /** MARKETPLACE_SHARE_ACADEMY */
  creatorShareAcademy: number
  /** REFERRAL_COMMISSION_RATE */
  referralRate: number
  /** EARNINGS_CLEARING_DAYS */
  clearingDays: number
}

export type HandbookBlock =
  | { kind: "p"; text: string }
  | { kind: "list"; items: { title?: string; text: string }[] }
export type HandbookSection = { heading: string; blocks: HandbookBlock[] }

export const HANDBOOK_PAGES: readonly HandbookPage[] = [
  {
    key: "teachingStandards",
    slug: "teaching-standards",
    title: "Teaching standards",
    summary: "What a WMA program sets out to do, and what every learner can count on from you.",
    checklistLabel: "Read the teaching standards",
  },
  {
    key: "curriculumGuidelines",
    slug: "curriculum-guidelines",
    title: "Curriculum guidelines",
    summary: "How a program is built here: plans, lessons, assessments, assignments and certificates.",
    checklistLabel: "Read the curriculum guidelines",
  },
  {
    key: "platformTraining",
    slug: "platform-training",
    title: "Platform training",
    summary: "Your faculty dashboard, live classes, mentorship and how you are paid.",
    checklistLabel: "Complete the platform training",
  },
]

export function handbookPageBySlug(slug: string): HandbookPage | null {
  return HANDBOOK_PAGES.find((page) => page.slug === slug) ?? null
}

const p = (text: string): HandbookBlock => ({ kind: "p", text })
const list = (...items: { title?: string; text: string }[]): HandbookBlock => ({ kind: "list", items })
const item = (text: string, title?: string): { title?: string; text: string } =>
  title ? { title, text } : { text }

export function handbookSections(key: HandbookKey, figures: HandbookFigures): HandbookSection[] {
  const early = `${HOST_EARLY_START_MS / 60_000} minutes`
  const days = `${figures.clearingDays} days`

  switch (key) {
    case "teachingStandards":
      return [
        {
          heading: "Why we teach",
          blocks: [
            // Blueprint §1
            p(
              "WorldStreet Mastery Academy exists to equip people with knowledge that has utility, develop that knowledge into mastery through structured learning and application, and help them use their mastery to transform their personal financial capacity."
            ),
            // Blueprint §2
            p("We teach people how to turn knowledge into economic value."),
          ],
        },
        {
          heading: "The Mastery Journey",
          blocks: [
            p("Every program carries a learner through five stages:"),
            // Blueprint §5
            list(
              item("The learner discovers a field, skill or economic opportunity.", "Discover"),
              item("The learner acquires foundational knowledge.", "Learn"),
              item("The learner develops competence through structured practice, mentorship and assessment.", "Master"),
              item("The learner applies the knowledge to real-world problems, projects or opportunities.", "Apply"),
              item("The learner learns how to convert the acquired capability into economic value.", "Liquidate")
            ),
          ],
        },
        {
          heading: "What every learner can count on",
          blocks: [
            list(
              item(
                `Classes run when they are scheduled. Learners see each class on their dashboard and are reminded a day and an hour before it starts. You can open the room up to ${early} early.`
              ),
              item("Every submission is graded. Give a grade from 0 to 100 and written feedback; the learner sees both."),
              item("Questions are answered. Learners whose plan includes instructor Q&A can message you directly."),
              item(
                "Executive learners get you one to one. They propose times for a private session; you confirm one and keep their roadmap up to date."
              )
            ),
          ],
        },
        {
          heading: "Teach to the plan",
          blocks: [
            p(
              "Each learner buys a plan — Basic, Standard or Executive — and the plan decides what they receive: live classes, instructor Q&A, assignments, a certificate, private mentorship and priority support. The platform enforces it: a learner can't join a class, message you or submit work that their plan doesn't include. Promise learners only what their plan includes."
            ),
          ],
        },
        {
          heading: "Faculty and Marketplace Creators",
          blocks: [
            // Blueprint §6, §17
            p(
              "You teach as WMA faculty. Marketplace Creators, who sell their own courses in the Academy Marketplace, remain distinct from official WMA faculty."
            ),
          ],
        },
      ]

    case "curriculumGuidelines":
      return [
        {
          heading: "Programs and plans",
          blocks: [
            // Blueprint §9
            p(
              "A program is what a learner learns — for example, Crypto Trading Mastery. A plan is how they learn it: Basic, Standard or Executive. Every program belongs to one school."
            ),
            p("Each plan has its own price, inclusions and lessons. You set them in the program editor."),
          ],
        },
        {
          heading: "Lessons",
          blocks: [
            list(
              item("Lessons sit in sections and play in the order you set."),
              item("A free preview lesson is open to anyone, enrolled or not."),
              item("A lesson can require a plan. Learners on a lower plan see it locked, but only while the program still sells that plan.")
            ),
          ],
        },
        {
          heading: "Assessments",
          blocks: [
            list(
              item("Each program can have one final exam. It opens when a learner has completed every lesson."),
              // Schema defaults, lib/db/models/exam.ts
              item(
                "You set the pass mark (70% unless you change it), the time limit (30 minutes by default) and the number of attempts (3 by default; 0 means unlimited)."
              ),
              item("When a program requires its final exam, a learner completes the program, and receives a certificate, only by passing it."),
              item("Lesson quizzes are practice. They never block completion.")
            ),
          ],
        },
        {
          heading: "Assignments",
          blocks: [
            list(
              item("Assignments are practical work set on a program. Learners whose plan includes assignments can submit them."),
              // MAX_SUBMISSION_FILES / MAX_SUBMISSION_BYTES, lib/actions/assignments.ts
              item(
                "A submission holds text and up to three files of up to 25 MB each. Files are private: only the learner, you and admins can open them."
              ),
              item("A learner can replace a submission until you grade it. Due dates are shown to learners but not enforced.")
            ),
          ],
        },
        {
          heading: "Certificates",
          blocks: [
            list(
              item("A learner whose plan includes the certificate receives one on completing the program, with a certificate ID anyone can verify."),
              item(
                "Certificates carry your signature. Until you add one in Settings, your learners' certificates read “Pending Instructor Signature”."
              )
            ),
          ],
        },
        {
          heading: "Communities",
          blocks: [
            p("Each program can link one community group. Add its link in the program editor; learners with access to the program see it."),
          ],
        },
      ]

    case "platformTraining":
      return [
        {
          heading: "Your faculty dashboard",
          blocks: [
            list(
              item("Today's classes, the week ahead, your programs and what is waiting on you.", "Overview"),
              item("Every learner in your programs. Open one to see their lessons, exams, assignments and classes.", "My Students"),
              item("Your programs' lessons, materials, exams and assignments.", "My Courses"),
              item("Start classes, run your Executive mentorship sessions and keep roadmaps.", "Live Classroom"),
              item("Schedule classes and check their recordings.", "Calendar"),
              item("Every sale, refund and commission, and when each clears.", "Earnings"),
              item("Your partner code and link.", "WMA Partners")
            ),
          ],
        },
        {
          heading: "Live classes",
          blocks: [
            list(
              item(`Schedule a class in Calendar. You can start it up to ${early} before its time.`),
              item("When you start a class, learners whose plan includes live classes are told it is live and join from their dashboard."),
              item(
                "Every class is recorded. The recording appears for those learners once it has been processed; they can watch it but not download it. You can rename or hide a recording."
              )
            ),
          ],
        },
        {
          heading: "Grading",
          blocks: [
            p(
              "Create assignments from the program's page in My Courses. Submissions waiting for a grade appear in your to-do list on the Overview, oldest first."
            ),
          ],
        },
        {
          heading: "Mentorship (Executive)",
          blocks: [
            list(
              // MIN_LEAD_MS / MAX_AHEAD_MS, lib/actions/mentorship.ts
              item("Executive learners propose up to three times, at least an hour ahead and no more than 60 days out."),
              item("Confirm one in Live Classroom and it becomes a private meeting that only you, the learner and admins can join."),
              item("Keep each mentee's roadmap there too; the learner sees it on their dashboard.")
            ),
          ],
        },
        {
          heading: "How you are paid",
          blocks: [
            list(
              item(`You earn ${sharePercent(figures.facultyShare)} of every sale of your programs.`),
              item(
                `In the Academy Marketplace, you keep ${sharePercent(figures.creatorShareOwnLink)} of sales made through your own link and ${sharePercent(figures.creatorShareAcademy)} of sales the Academy makes.`
              ),
              item(
                `Each earning clears ${days} after the sale (refund protection) into your WorldStreet wallet. You withdraw from the WorldStreet dashboard, where identity verification happens.`
              ),
              item("If a sale is refunded, its earning is taken back: reversed before it clears, or deducted from your wallet after."),
              item(
                `WMA Partners: when someone you invite makes their first paid purchase, ${sharePercent(figures.referralRate)} of it is yours, paid like a sale.`
              )
            ),
          ],
        },
        {
          heading: "Your WMA Faculty credential",
          blocks: [
            p(
              "Accept the instructor agreement, complete your profile, add your signature, verify your identity for payouts and acknowledge these three handbook pages, and you receive your WMA Faculty credential: an ID that starts WMAF-. It shows on your profile."
            ),
          ],
        },
      ]
  }
}
