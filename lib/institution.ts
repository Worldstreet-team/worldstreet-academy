/**
 * The one home of the institutional blueprint's copy (docs/institutional-blueprint.md).
 * Client-safe: no server imports. Surfaces import these strings; they never
 * retype them.
 */
import { BRAND, SITE_DESCRIPTION } from "@/lib/brand"

/** §18 — the homepage hero. The eyebrow is uppercased by CSS. */
export const HERO = {
  eyebrow: `Welcome to ${BRAND.name}`,
  titleLines: ["The Academy of", "the New Economy"],
  positioning: BRAND.descriptor,
  beats: "Learn the knowledge. Master the skill. Apply the knowledge. Create economic value.",
} as const

/** §1 */
export const PURPOSE =
  "To equip people with knowledge that has utility, develop that knowledge into mastery through structured learning and application, and help them use their mastery to transform their personal financial capacity."
export const COMBINES = [
  "Structured learning programs", "Live cohort-based learning", "Practical skills development",
  "Faculty members and expert instructors", "Mentorship", "Assignments and assessments",
  "Projects and application", "Communities", "Certifications", "Career and income pathways",
  "A digital marketplace for additional knowledge products",
] as const
export const WEALTH_LIQUEFACTION = [
  "Knowledge", "Application", "Mastery", "Skills", "Economic Value", "Financial Transformation",
] as const

/** §2 */
export const WEALTH_LIQUEFACTION_DEFINITION =
  "Wealth Liquefaction is the process of transforming knowledge, skills, ideas, assets, opportunities and innovation into economic value and ultimately into financial capacity."
export const VALUE_LINE = "We teach people how to turn knowledge into economic value."

/** §3, §4 */
export const VISION =
  "To build the world's most impactful institution for developing people who can create, capture and multiply economic value in the new economy."
export const MISSION =
  "To equip individuals with relevant knowledge, practical skills, innovative thinking and access to economic opportunities that enable them to transform their personal economy."
export const GAPS = [
  { title: "The Knowledge Gap", body: "People don't know what they need to know." },
  { title: "The Mastery Gap", body: "People may know something but cannot apply it effectively." },
  { title: "The Opportunity Gap", body: "People may have knowledge and skills but lack pathways to monetize them." },
] as const

/** §5 */
export const JOURNEY = [
  { name: "Discover", body: "The learner discovers a field, skill or economic opportunity." },
  { name: "Learn", body: "The learner acquires foundational knowledge." },
  { name: "Master", body: "The learner develops competence through structured practice, mentorship and assessment." },
  { name: "Apply", body: "The learner applies the knowledge to real-world problems, projects or opportunities." },
  {
    name: "Liquidate",
    body: "The learner learns how to convert the acquired capability into economic value. This is where the concept of wealth liquefaction becomes central.",
  },
] as const
export const JOURNEY_EXAMPLES = [
  ["Learn graphic design", "Master graphic design", "Build portfolio", "Acquire clients", "Generate income"],
  ["Learn AI", "Build AI solutions", "Solve business problems", "Create products/services", "Generate economic value"],
] as const

/** §6 — the Opportunity Hub has no description yet (D18): no body, no link. */
export type World = { key: "academy" | "marketplace" | "opportunity-hub"; name: string; body: string | null; href: string | null }
export const WORLDS: readonly World[] = [
  {
    key: "academy",
    name: "The Academy",
    body: "This is the institutional learning environment. Schools, Programs, Faculty, Cohorts, Live classes, Assessments, Assignments, Mentorship, Certifications, Student communities and Projects. This is the premium, structured academic side.",
    href: "/schools",
  },
  {
    key: "marketplace",
    name: "The Academy Marketplace",
    body: "This is the open knowledge marketplace. External educators, experts and creators can submit courses. They do not automatically become WMA faculty.",
    href: "/marketplace",
  },
  { key: "opportunity-hub", name: "The Opportunity Hub", body: null, href: null },
]

/** §20, §21 */
export const ECOSYSTEM =
  "The Academy is the institution; the Marketplace is the knowledge-commerce layer; the student dashboard is the campus; the schools are the academic divisions; the faculty are the educators; cohorts are the academic sessions; and the mastery-to-economic-value framework is the philosophy that ties everything together."
export const CORE_TRANSFORMATION = [
  "Knowledge", "Skill", "Mastery", "Application", "Value Creation", "Economic Opportunity", "Financial Transformation",
] as const
export const CORE_PROPOSITION =
  "The ultimate proposition is that WMA should help people move from knowing to doing, and from doing to creating value."

/** §22, §23 — competitor names never print (ruling 5). */
export const DEFINITION = SITE_DESCRIPTION
export const ACADEMY_LINE = "WMA is the Academy of the New Economy."
export const BIGGER_VISION = {
  contrast: "Most learning platforms answer: “What course do you want to buy?”",
  question: "Who do you want to become, what do you need to master, and how can that mastery create value in the new economy?",
} as const
