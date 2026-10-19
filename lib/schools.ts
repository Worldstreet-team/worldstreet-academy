/**
 * The seven Schools of WorldStreet Mastery Academy (institutional blueprint
 * §7, decision D21). Static and code-owned: a school is a way of grouping
 * programs, not a document. Program membership is NOT listed here — it is
 * `Course.school` on each course, so the DB is the only source of which
 * programs a school has.
 *
 * Each school carries the §8 page fields (`intro` is the School Overview,
 * plus `learn`, `audience`, `careers`), its §7 `areas` (D22, each matched to
 * a published program by catalogue title, never by slug), `legacySlugs`
 * (retired slugs that still arrive as 308s, 30-day cookies and stored
 * values) and `communityUrl` (filled in Phase 15).
 */
export type SchoolSlug =
  | "trading-financial-markets"
  | "technology-ai"
  | "digital-business"
  | "entrepreneurship-wealth-creation"
  | "creative-economy"
  | "leadership-personal-development"
  | "emerging-technologies"

/** One §7 study area. `program` is a catalogue title, or null for "Coming soon". */
export type StudyArea = { name: string; program: string | null }

export type School = {
  slug: SchoolSlug
  /** Full name, e.g. "School of Trading & Financial Markets". */
  name: string
  /** Short label without "School of" — also written to Course.category for legacy/mobile displays. */
  short: string
  /** Card blurb, at most 110 characters. */
  blurb: string
  /** School-page headline; null renders nothing. */
  tagline: string | null
  /** §8 School Overview: the hero paragraph. */
  intro: string | null
  /** lucide icon name for RenderIcon. */
  icon: string
  order: number
  /** §8 "What you'll learn". */
  learn: readonly string[]
  /** §8 "Who it's for". */
  audience: readonly string[]
  /** §8 "Career & economic applications". */
  careers: readonly string[]
  /** §7 study areas, verbatim and in order. */
  areas: readonly StudyArea[]
  /** §14 School Community (D26): an external group link; null until product supplies one. */
  communityUrl: string | null
  /** Retired slugs that now resolve to this school. */
  legacySlugs: readonly string[]
}

/*
 * Verbatim (ruling 7): Trading's blurb, tagline and intro (the 2026-09-14
 * blueprint) and every `areas` name (§7). Drafted: `learn`, `audience` and
 * `careers` for all seven, and the blurb and intro of the other six. Each
 * entry opens with a DRAFT marker comment for the owner to clear.
 */
export const SCHOOLS: readonly School[] = [
  {
    // DRAFT: owner sign-off pending (learn, audience, careers; blurb, tagline and intro are the 2026-09-14 blueprint's)
    slug: "trading-financial-markets", order: 1, icon: "landmark",
    name: "School of Trading & Financial Markets",
    short: "Trading & Financial Markets",
    blurb: "Learn about Forex, cryptocurrency, market analysis, risk management and trading psychology.",
    tagline: "Understand the markets. Develop your skills. Trade with knowledge.",
    intro: "Financial markets offer enormous opportunities—but opportunity without knowledge can become expensive experience. Our programs are designed to help students understand market fundamentals, develop structured approaches to analysis and learn responsible risk management.",
    learn: [
      "How the Forex and crypto markets work, and what moves them",
      "Technical and fundamental analysis",
      "Risk management and position sizing",
      "Trading psychology and discipline",
      "Building and following a written trading plan",
    ],
    audience: [
      "Beginners who want a structured start in the markets",
      "Self-taught traders who want a method and discipline",
      "Professionals who want to understand the markets they invest in",
    ],
    careers: [
      "Trading your own account with a tested plan and clear risk rules",
      "Market research and analysis roles",
      "Financial content, education and community work",
      "A grounding for further study in finance and investing",
    ],
    areas: [
      { name: "Forex Trading Mastery", program: "Forex Trading Mastery" },
      { name: "Crypto Trading Mastery", program: "Crypto Trading Mastery" },
      { name: "Technical Analysis", program: null },
      { name: "Fundamental Analysis", program: null },
      { name: "Risk Management", program: null },
      { name: "Financial Markets Intelligence", program: null },
    ],
    communityUrl: null,
    legacySlugs: [],
  },
  {
    // DRAFT: owner sign-off pending
    slug: "technology-ai", order: 2, icon: "bot",
    name: "School of Technology & Artificial Intelligence",
    short: "Technology & AI",
    blurb: "Build practical skills in artificial intelligence, software, data and cybersecurity.",
    tagline: null,
    intro: "Technology and artificial intelligence are changing how businesses operate, how people work and how value is created. This school brings AI, software, data and security together, so you learn the tools and the thinking behind them, and how to apply them to real problems.",
    learn: [
      "Practical AI tools, prompt engineering and automation workflows",
      "How modern software and apps are designed and built",
      "Collecting, analysing and presenting data",
      "Digital security and responsible cybersecurity practice",
      "Applying technology to real business problems",
    ],
    audience: [
      "Beginners curious about AI and technology",
      "Professionals who want to work faster with AI and automation",
      "Aspiring developers, analysts and security practitioners",
      "Founders who want to build with technology",
    ],
    careers: [
      "Building AI-powered workflows and automation for businesses",
      "Software, web and app development",
      "Data analysis and reporting",
      "Cybersecurity support and awareness",
      "Technology freelancing and consulting",
    ],
    areas: [
      { name: "Artificial Intelligence", program: "AI & AI Automation" },
      { name: "Software Development", program: "App Development with AI" },
      { name: "Web Development", program: null },
      { name: "Data Analytics", program: "Data Analysis" },
      { name: "Cybersecurity", program: "Cybersecurity" },
      { name: "Cloud Computing", program: null },
      { name: "AI Automation", program: "AI & AI Automation" },
    ],
    communityUrl: null,
    legacySlugs: ["ai-automation", "software-app-development", "cybersecurity", "data-analytics"],
  },
  {
    // DRAFT: owner sign-off pending
    slug: "digital-business", order: 3, icon: "briefcase",
    name: "School of Digital Business",
    short: "Digital Business",
    blurb: "Build practical skills for selling, marketing, e-commerce and working in the global digital economy.",
    tagline: null,
    intro: "Every business now sells, markets and serves its customers online. This school teaches the skills that make that work, from marketing and selling to e-commerce and the remote work behind them, so you can grow a business or bring those skills to one.",
    learn: [
      "Digital and social media marketing",
      "Selling, from the first conversation to the closed deal",
      "Setting up and running an online store",
      "Writing copy that persuades",
      "Supporting a business remotely as a virtual assistant",
    ],
    audience: [
      "Business owners who want to grow online",
      "Job seekers building skills for remote work",
      "Marketers and salespeople who want a structured upgrade",
      "Creators and freelancers who want to sell their own work",
    ],
    careers: [
      "Digital marketing and social media management",
      "Sales and business development roles",
      "Running your own e-commerce store",
      "Copywriting and content for brands",
      "Remote virtual assistance for businesses worldwide",
    ],
    areas: [
      { name: "Digital Marketing", program: "Tech Sales & Digital Marketing" },
      { name: "E-commerce", program: "E-Commerce & Digital Business" },
      { name: "Copywriting", program: null },
      { name: "Sales", program: "Tech Sales & Digital Marketing" },
      { name: "Business Development", program: null },
      { name: "Social Media Marketing", program: null },
    ],
    communityUrl: null,
    legacySlugs: ["digital-business-remote-careers"],
  },
  {
    // DRAFT: owner sign-off pending
    slug: "entrepreneurship-wealth-creation", order: 4, icon: "lightbulb",
    name: "School of Entrepreneurship & Wealth Creation",
    short: "Entrepreneurship & Wealth Creation",
    blurb: "Learn to start, run and grow a business, and the principles of investing and building wealth.",
    tagline: null,
    intro: "Knowledge creates value when it is put to work. This school is about turning ideas, skills and opportunities into businesses and assets: validating an idea, building a startup, managing a company and understanding how wealth is created and grown.",
    learn: [
      "Finding and testing a business idea",
      "Building and launching a startup",
      "Business strategy and management",
      "Investment fundamentals",
      "The principles of creating and growing wealth",
    ],
    audience: [
      "Aspiring founders with an idea to test",
      "Small-business owners who want to grow",
      "Professionals planning a business of their own",
      "Anyone who wants to understand investing and wealth",
    ],
    careers: [
      "Starting and running your own business",
      "Growing an existing business",
      "Business strategy and management roles",
      "Making informed personal investment decisions",
    ],
    areas: [
      { name: "Entrepreneurship", program: null },
      { name: "Startup Building", program: null },
      { name: "Business Strategy", program: null },
      { name: "Investment Fundamentals", program: null },
      { name: "Wealth Creation", program: null },
      { name: "Business Management", program: null },
    ],
    communityUrl: null,
    legacySlugs: [],
  },
  {
    // DRAFT: owner sign-off pending
    slug: "creative-economy", order: 5, icon: "palette",
    name: "School of Creative Economy",
    short: "Creative Economy",
    blurb: "Turn ideas into compelling design, video and content, and build skills for the creator economy.",
    tagline: null,
    intro: "Creativity is now an economy of its own. This school teaches the craft behind design, video and content, and how to turn that craft into a portfolio, clients and an audience.",
    learn: [
      "Graphic design and UI/UX fundamentals",
      "Video production and editing",
      "Content creation for social platforms",
      "Photography and animation basics",
      "Building a portfolio that wins clients",
    ],
    audience: [
      "Aspiring designers, editors and content creators",
      "Creators who want to grow an audience",
      "Marketers who want to make their own content",
      "Freelancers who want a stronger portfolio",
    ],
    careers: [
      "Freelance design, video and content work",
      "In-house creative roles in brands and agencies",
      "Building an audience as a creator",
      "Content production for businesses",
    ],
    areas: [
      { name: "Graphic Design", program: null },
      { name: "UI/UX", program: null },
      { name: "Video Production", program: "Video Editing Mastery" },
      { name: "Animation", program: null },
      { name: "Photography", program: null },
      { name: "Content Creation", program: "Content Creation Mastery" },
    ],
    communityUrl: null,
    legacySlugs: ["digital-media-creative"],
  },
  {
    // DRAFT: owner sign-off pending
    slug: "leadership-personal-development", order: 6, icon: "users",
    name: "School of Leadership & Personal Development",
    short: "Leadership & Personal Development",
    blurb: "Develop the leadership, communication and personal effectiveness that turn knowledge into results.",
    tagline: null,
    intro: "Skills create value when the people who hold them can lead, communicate and decide well. This school develops the personal capabilities behind every career and business: leadership, communication, productivity and clear thinking.",
    learn: [
      "Leading people and teams",
      "Communicating clearly and speaking with confidence",
      "Managing your time, focus and priorities",
      "Emotional intelligence at work",
      "Strategic thinking and decision-making",
    ],
    audience: [
      "New and aspiring managers",
      "Professionals preparing for their next role",
      "Founders leading their first team",
      "Anyone who wants to communicate and decide with more confidence",
    ],
    careers: [
      "Team leadership and management",
      "Presenting, pitching and public speaking",
      "Coaching and mentoring others",
      "Greater effectiveness in any role or business",
    ],
    areas: [
      { name: "Leadership", program: null },
      { name: "Communication", program: null },
      { name: "Personal Productivity", program: null },
      { name: "Public Speaking", program: null },
      { name: "Emotional Intelligence", program: null },
      { name: "Strategic Thinking", program: null },
    ],
    communityUrl: null,
    legacySlugs: [],
  },
  {
    // DRAFT: owner sign-off pending
    slug: "emerging-technologies", order: 7, icon: "blocks",
    name: "School of Emerging Technologies",
    short: "Emerging Technologies",
    blurb: "Understand blockchain, Web3, FinTech and the technologies shaping what comes next.",
    tagline: null,
    intro: "New technologies create new economies. This school explains how blockchain, Web3, FinTech, robotics, IoT and extended reality work, where they are being used, and the opportunities they open.",
    learn: [
      "How blockchain and digital assets work",
      "The Web3 ecosystem and decentralised applications",
      "FinTech and the future of financial services",
      "Robotics, IoT and extended reality fundamentals",
      "Judging which emerging technologies matter, and why",
    ],
    audience: [
      "Learners curious about blockchain and Web3",
      "Professionals in finance and technology",
      "Founders exploring new technology for their business",
      "Anyone who wants to understand what comes next",
    ],
    careers: [
      "Blockchain and Web3 projects and communities",
      "FinTech products and services",
      "Advising businesses on new technology",
      "A foundation for specialised technical study",
    ],
    areas: [
      { name: "Blockchain", program: "Blockchain Technology Mastery" },
      { name: "Web3", program: null },
      { name: "Robotics", program: null },
      { name: "IoT", program: null },
      { name: "FinTech", program: null },
      { name: "Extended Reality", program: null },
      { name: "Emerging technology", program: null },
    ],
    communityUrl: null,
    legacySlugs: ["blockchain-web3"],
  },
]

export const SCHOOL_BY_SLUG = Object.fromEntries(SCHOOLS.map((s) => [s.slug, s])) as Record<SchoolSlug, School>

/** Tuple form for z.enum(). */
export const SCHOOL_SLUGS = SCHOOLS.map((s) => s.slug) as [SchoolSlug, ...SchoolSlug[]]

/** True for one of the seven current slugs only; a retired slug is false. */
export function isSchoolSlug(value: unknown): value is SchoolSlug {
  return typeof value === "string" && SCHOOLS.some((s) => s.slug === value)
}

const SCHOOL_BY_ANY_SLUG = new Map<string, School>(
  SCHOOLS.flatMap((s) => [s.slug, ...s.legacySlugs].map((slug) => [slug, s] as const))
)

/** The school for a current or retired slug (exact, case-sensitive); null otherwise. */
export function schoolFromSlug(value: unknown): School | null {
  return typeof value === "string" ? (SCHOOL_BY_ANY_SLUG.get(value) ?? null) : null
}

/** The current slug for a current or retired one; null otherwise. */
export function schoolSlugOf(value: unknown): SchoolSlug | null {
  return schoolFromSlug(value)?.slug ?? null
}

/** Every slug a school's rows may be stored under: the current one, then the retired ones. */
export function storedSlugsFor(slug: SchoolSlug): string[] {
  return [slug, ...SCHOOL_BY_SLUG[slug].legacySlugs]
}

export type StudyAreaLink = { name: string; program: { title: string; href: string } | null }

/**
 * Each of the school's study areas with the published program that teaches it.
 * Matches by trimmed, case-insensitive title (production slugs carry random
 * suffixes); an area with no match is "Coming soon" (program null).
 */
export function studyAreas(
  school: School,
  programs: ReadonlyArray<{ title: string; slug: string }>
): StudyAreaLink[] {
  return school.areas.map((area) => {
    const want = area.program?.toLowerCase()
    const found = want ? programs.find((p) => p.title.trim().toLowerCase() === want) : undefined
    return { name: area.name, program: found ? { title: found.title, href: `/programs/${found.slug}` } : null }
  })
}

/**
 * Program count per school from any list carrying `school` (e.g. the
 * published `BrowseCourse[]` the landing already fetches). Every school is
 * present in the result, zero included, so cards never read `undefined`.
 */
export function countProgramsBySchool(
  items: ReadonlyArray<{ school: SchoolSlug | null }>
): Record<SchoolSlug, number> {
  const counts = Object.fromEntries(SCHOOLS.map((s) => [s.slug, 0])) as Record<SchoolSlug, number>
  for (const item of items) {
    if (item.school && item.school in counts) counts[item.school] += 1
  }
  return counts
}

/**
 * Cheapest program per school, whole USD (0 = a free program exists), null
 * when the school has no priced program. `price` is already the cheapest
 * enabled package (Phase 0 rule), so this never re-derives package rules.
 */
export function cheapestBySchool(
  items: ReadonlyArray<{ school: SchoolSlug | null; pricing: "free" | "paid"; price: number | null }>
): Record<SchoolSlug, number | null> {
  const out = Object.fromEntries(SCHOOLS.map((s) => [s.slug, null])) as Record<SchoolSlug, number | null>
  for (const item of items) {
    if (!item.school || !(item.school in out)) continue
    const price = item.pricing === "free" ? 0 : item.price
    if (price === null || price === undefined) continue
    const current = out[item.school]
    if (current === null || price < current) out[item.school] = price
  }
  return out
}
