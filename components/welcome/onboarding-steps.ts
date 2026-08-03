/**
 * Onboarding carousel copy. Shared so the step content lives in one place
 * regardless of how it's presented.
 */
export const onboardingSteps = [
  {
    /** Key into the modal's art map — the old teal PNGs are retired. */
    art: "mascot",
    tagline: "Welcome to WorldStreet Academy",
    subtitleMobile: "Your journey to mastering the markets starts here.",
    subtitleDesktop:
      "We bring together expert instructors, structured courses, and a global community — everything you need to go from beginner to confident trader.",
  },
  {
    art: "courses",
    tagline: "Learn from the best",
    subtitleMobile: "Expert-led courses on trading, DeFi & blockchain.",
    subtitleDesktop:
      "From technical analysis and risk management to DeFi protocols and smart contracts — our library is built by professionals who trade for a living.",
  },
  {
    art: "certificate",
    tagline: "Earn certificates",
    subtitleMobile: "Showcase your achievements to the world.",
    subtitleDesktop:
      "Complete courses to earn verifiable certificates. Share them on LinkedIn, add them to your resume, and stand out in the industry.",
  },
] as const

export type OnboardingStep = (typeof onboardingSteps)[number]
