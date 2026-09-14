/**
 * Where this visitor stands with a program — computed once by the page and
 * shared by the hero CTA, every package card and the mobile bar.
 */
export type ProgramAccess =
  | { kind: "enrolled"; continueHref: string }
  /** Published with a future availableAt: nothing can be bought yet. */
  | { kind: "coming_soon" }
  | { kind: "open" }
