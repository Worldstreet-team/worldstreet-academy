# Mastery Academy — Phase 1 Implementation Plan (Public site)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The blueprint's §1–§4, §11, §14–§16 are live on `/`, the eight schools have an index (`/schools`) and a page each (`/schools/[slug]`), navigation points at them, and the journey Homepage → Schools → School → "View program" works end to end (the program page itself is Phase 2; until then "View program" links to the existing `/courses/[id]`).

**Architecture:** Server components fetch (`components/marketing/landing.tsx` stays the landing's ONLY fetch point; the two new routes fetch once each via `fetchBrowseCourses`), client leaves animate. Schools are static config (`lib/schools.ts`); program membership is `Course.school` in MongoDB and reaches the UI through `BrowseCourse.school`. The old Programs index + Rooms timeline (which told the same story twice) collapse into one `HowItWorks` timeline; the vignettes it needs move out of the dead `hero-slider.tsx` into `components/marketing/vignettes.tsx`, then all three old files are deleted.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict · Mongoose (read-only here) · Tailwind v4 · motion/react · lucide-react.

**Spec:** `docs/mastery-academy-blueprint.md` §1–§5, §11, §14–§17 (copy — binding) and `docs/mastery-academy-plan.md` §Phase 1 (scope). Phase 0 shipped `lib/brand.ts`, `lib/schools.ts`, `Course.school`, `Course.packages` — this plan builds on them.

## Global Constraints

- **No schema changes, no DB writes.** Phase 1 only reads. Do not touch `lib/db/models/*`, `scripts/*`, or anything under `lib/actions/` except the one read helper in `lib/actions/student.ts` named in Task 1.
- **Copy is the spec's, verbatim**, with exactly two systematic adjustments: the brand is always rendered through `BRAND` from `@/lib/brand` (`BRAND.name` = `WorldStreet Mastery Academy`, `BRAND.wordmark` = `WorldStreet`, `BRAND.eyebrow` = `Mastery Academy`, `BRAND.tagline` = `Learn Skills. Build Value. Own Your Future.`), and ALL-CAPS spec headings are set in sentence/title case (the type carries the emphasis). Never invent numbers, testimonials or claims.
- **Icons:** `lucide-react` only, never emoji. `School.icon` is a name string — the ONLY name→component map is `components/shared/school-icon.tsx` (Task 1). Static call sites import the lucide component directly.
- **UI tokens:** never hardcode a palette hex; use the existing semantic classes (`text-ws-gold`, `bg-ws-surface`, `border-ws-hairline`, `text-ws-muted`, `text-ws-subtle`, `bg-ws-brand`, `text-ws-brand-on`, `bg-ws-brand/10` washes, `bg-ws-sunken`, `bg-ws-chip`, `font-display`). New code uses radii from the ladder only (`rounded-xs/sm/md/lg/full`) — no `rounded-xl/2xl/3xl` in NEW files. Gold only on primary CTAs, active state, brand moments and the ~10–13% icon washes.
- **Base UI composition uses the `render` prop, never `asChild`.** RSC-first: add `"use client"` only where hooks or `motion/react` require it.
- **Links:** "View program" and program cards link to `/courses/${course.id}` until Phase 2 ships `/programs/[slug]`. Never ship a dead link (no `href="#"`, no `/terms` / `/privacy` / `/faculty` / `/programs` yet).
- **No new dependencies. No `any`.**
- **Verification:** no test runner exists. Every task ends with `npx tsc --noEmit 2>&1 | grep -v '^\.next/'` printing nothing, `npx eslint <every file you touched>` printing no errors or warnings, and the task's own runtime check. A `pnpm dev:mock` server is ALREADY RUNNING on http://localhost:3001 from this checkout (mock Clerk, local MongoDB seeded with the 12 Mastery programs; Turbopack hot-reloads file changes, including new routes and deleted files). Do **not** start a second dev server. Runtime checks are `curl` against :3001 — e.g. `curl -s http://localhost:3001/schools | grep -o 'School of [A-Za-z &;]*' | sort -u`. Signed-in views: add `-b mock_persona=student`.
- **Commits:** one or more per task; message ends with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Never commit `.env*`. Never `git add -A` — add the files you touched by name.
- **Surgical:** touch only listed files (plus files a compile error forces you into — say so in the report). No reformatting, no drive-by refactors, no renames beyond those listed. Do not touch `app/(platform)/**` except the one sidebar label in Task 6, and nothing under `app/(instructor)` or `app/(admin)`.

---

### Task 1: Data layer — `school` on `BrowseCourse`, school filter, program counts, school icon map

**Files:**
- Modify: `lib/actions/student.ts` (the `BrowseCourse` type at lines 12–30; `fetchBrowseCourses` at lines 91–153; `fetchOtherCourses` at lines 390–437)
- Modify: `lib/schools.ts` (append one helper)
- Create: `components/shared/school-icon.tsx`

**Interfaces:**
- Consumes: `SchoolSlug`, `SCHOOLS`, `isSchoolSlug` from `@/lib/schools` (Phase 0); `RenderIcon` from `@/components/shared/render-icon`; `ICoursePackage` shape `{ key, name, tagline, price, features, highlight, ctaLabel, enabled, entitlements }` on `course.packages` (Phase 0).
- Produces (later tasks rely on these exact names):
  - `BrowseCourse.school: SchoolSlug | null`, `BrowseCourse.shortDescription: string | null`, `BrowseCourse.tierCount: number` (count of ENABLED packages; `0` for courses without packages).
  - `fetchBrowseCourses({ school?: SchoolSlug })` — the existing function gains one optional filter.
  - `countProgramsBySchool(items: ReadonlyArray<{ school: SchoolSlug | null }>): Record<SchoolSlug, number>` in `lib/schools.ts`.
  - `SchoolIcon({ name, ...lucideProps })` in `components/shared/school-icon.tsx`.

- [ ] **Step 1: Extend the `BrowseCourse` type** in `lib/actions/student.ts`. Add the import and three fields:

```ts
import { isSchoolSlug, type SchoolSlug } from "@/lib/schools"
```

```ts
export type BrowseCourse = {
  id: string
  title: string
  description: string
  /** Spec §5 program blurb; null on legacy courses (fall back to `description`). */
  shortDescription: string | null
  thumbnailUrl: string | null
  instructorId: string
  instructorName: string
  instructorAvatarUrl: string | null
  level: "beginner" | "intermediate" | "advanced"
  category: string
  /** Phase 0 taxonomy; null on courses not yet assigned to a school. */
  school: SchoolSlug | null
  pricing: "free" | "paid"
  price: number | null
  /** Enabled package tiers on the course (0 = no package ladder). `price` is already the cheapest enabled tier. */
  tierCount: number
  status: string
  availableAt: string | null
  preEnrollEnabled: boolean
  totalLessons: number
  totalDuration: number
  enrolledCount: number
  rating: number | null
}
```

- [ ] **Step 2: Add the `school` filter to `fetchBrowseCourses`.** Change the options type and add one line after the `pricing` block:

```ts
export async function fetchBrowseCourses(options?: {
  level?: string
  pricing?: string
  search?: string
  school?: SchoolSlug
}): Promise<BrowseCourse[]> {
```

```ts
    if (options?.school) {
      query.school = options.school
    }
```

- [ ] **Step 3: Map the three new fields** in BOTH `fetchBrowseCourses` and `fetchOtherCourses` (the two `courses.map` blocks that return a `BrowseCourse`). Insert these lines into each returned object (order: `shortDescription` after `description`, `school` after `category`, `tierCount` after `price`):

```ts
        shortDescription: course.shortDescription ?? null,
```
```ts
        school: isSchoolSlug(course.school) ? course.school : null,
```
```ts
        tierCount: (course.packages ?? []).filter((p) => p.enabled).length,
```

- [ ] **Step 4: Append `countProgramsBySchool` to `lib/schools.ts`** (after `isSchoolSlug`):

```ts
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
```

- [ ] **Step 5: Create `components/shared/school-icon.tsx`** — exactly:

```tsx
import {
  BlocksIcon,
  BotIcon,
  BriefcaseIcon,
  ChartColumnIcon,
  ClapperboardIcon,
  CodeIcon,
  GraduationCapIcon,
  LandmarkIcon,
  ShieldCheckIcon,
  type LucideIcon,
  type LucideProps,
} from "lucide-react"
import { RenderIcon } from "@/components/shared/render-icon"

/**
 * `School.icon` (lib/schools.ts) is a lucide NAME so the config stays
 * icon-set agnostic; this is the one place a name becomes a component.
 * Unknown names fall back to the graduation cap rather than rendering
 * nothing.
 */
const SCHOOL_ICONS: Record<string, LucideIcon> = {
  landmark: LandmarkIcon,
  blocks: BlocksIcon,
  bot: BotIcon,
  code: CodeIcon,
  "shield-check": ShieldCheckIcon,
  "chart-column": ChartColumnIcon,
  clapperboard: ClapperboardIcon,
  briefcase: BriefcaseIcon,
}

export function SchoolIcon({ name, ...props }: LucideProps & { name: string }) {
  return <RenderIcon icon={SCHOOL_ICONS[name] ?? GraduationCapIcon} {...props} />
}
```

- [ ] **Step 6: Typecheck and lint.**

Run: `npx tsc --noEmit 2>&1 | grep -v '^\.next/'` — expected: no output. If tsc names any OTHER file constructing a `BrowseCourse`, add the same three fields there and list it in your report.
Run: `npx eslint lib/actions/student.ts lib/schools.ts components/shared/school-icon.tsx` — expected: clean.

- [ ] **Step 7: Runtime check** — the landing still renders (the type change is additive):

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/` — expected `200`.

- [ ] **Step 8: Commit**

```bash
git add lib/actions/student.ts lib/schools.ts components/shared/school-icon.tsx
git commit -m "feat(schools): school + tierCount on BrowseCourse, school filter, program counts, icon map

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: How it works — port the vignettes, build the 4-step timeline, delete the three old sections

**Files:**
- Create: `components/marketing/vignettes.tsx` (port + 3 new vignettes)
- Create: `components/marketing/how-it-works.tsx`
- Modify: `components/marketing/landing.tsx` (imports + two section slots)
- Delete: `components/marketing/hero-slider.tsx`, `components/marketing/rooms-timeline.tsx`, `components/marketing/programs-list.tsx`

**Interfaces:**
- Consumes: `SCHOOLS` from `@/lib/schools`; `SchoolIcon` from `@/components/shared/school-icon` (Task 1); `Reveal` from `@/components/marketing/motion/reveal`; `useMotionOK` from `@/components/marketing/motion/bus`; `EASE_INERTIA`, `EASE_LUX` from `@/components/marketing/motion/ease`.
- Produces: `HowItWorks` (no props; renders `<section id="how-it-works">`), and from `vignettes.tsx`: `BrowserFrame({ route, children })`, `SchoolsVignette`, `ProgramVignette`, `PackagesVignette`, `ClassroomVignette`.

- [ ] **Step 1: Create `components/marketing/vignettes.tsx`.** Start the file with this header, then paste `BrowserFrame` (hero-slider.tsx lines 300–325), the `LESSONS` const and `ClassroomVignette` (lines 327–453) **verbatim** from `components/marketing/hero-slider.tsx`, then the three new vignettes below. Do NOT port `LiveRoomVignette` or `ExamVignette` — they are not in the four-step journey.

```tsx
"use client"

import * as React from "react"
import { motion } from "motion/react"
import { CheckIcon, LockIcon, PlayIcon } from "lucide-react"
import { SCHOOLS } from "@/lib/schools"
import { SchoolIcon } from "@/components/shared/school-icon"
import { EASE_INERTIA, EASE_LUX } from "@/components/marketing/motion/ease"
import { useMotionOK } from "@/components/marketing/motion/bus"

/**
 * Product vignettes for the How-it-works walkthrough (spec §11): the four
 * journey moments rebuilt from design-system primitives inside a browser
 * frame — never course art. Every vignette is aria-hidden scenery; the step
 * copy beside it carries the meaning. Shared stagger grammar: a container
 * variant with `staggerChildren`, items fading up 8px (0 under reduced
 * motion).
 */
```

Then, after the verbatim port, apply exactly these two edits to the ported classroom code so it shows the journey's example program (Forex Trading Mastery) instead of the old Bitcoin course:

Replace the `LESSONS` const with:
```ts
const LESSONS = [
  { title: "What is the Forex market?", state: "done" as const, tag: "Free preview" },
  { title: "Currency pairs and pips", state: "done" as const },
  { title: "Reading price action", state: "active" as const },
  { title: "Risk management basics", state: "locked" as const },
]
```
Replace the player title `Bitcoin Mining Explained` with `Reading price action`, and the comment `{/* Lesson rail — the REAL seeded lesson titles. */}` with `{/* Lesson rail. */}`.

Now append the three new vignettes:

```tsx
/* ── 01 Choose your school ───────────────────────────────────────────────── */

const STAGGER = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.2 } },
}

function itemVariants(ok: boolean) {
  return {
    hidden: { opacity: 0, y: ok ? 8 : 0 },
    show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_LUX } },
  }
}

export function SchoolsVignette() {
  const ok = useMotionOK()
  return (
    <div aria-hidden className="flex h-full flex-col bg-ws-sunken">
      <div className="shrink-0 border-b border-ws-hairline px-5 py-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-ws-gold">Our schools</p>
        <p className="mt-1 font-display text-[15px] font-semibold text-ws-primary md:text-lg">
          Choose the school that matches your goals.
        </p>
      </div>
      <motion.ul
        className="grid min-h-0 flex-1 grid-cols-2 gap-2.5 overflow-hidden p-4 sm:grid-cols-4 sm:gap-3 sm:p-5"
        initial="hidden"
        animate="show"
        variants={STAGGER}
      >
        {SCHOOLS.map((school, i) => (
          <motion.li
            key={school.slug}
            variants={itemVariants(ok)}
            className={
              i === 0
                ? "flex min-h-0 flex-col rounded-md border border-ws-brand/60 bg-ws-surface p-3"
                : "flex min-h-0 flex-col rounded-md border border-ws-hairline bg-ws-surface p-3"
            }
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ws-brand/10 text-ws-gold">
              <SchoolIcon name={school.icon} size={15} />
            </span>
            <span className="mt-3 line-clamp-2 text-[12px] font-semibold leading-snug text-ws-primary">
              {school.short}
            </span>
            {i === 0 && (
              <span className="mt-auto inline-flex w-fit rounded-full bg-ws-brand px-2 py-0.5 text-[10px] font-semibold text-ws-brand-on">
                Explore school
              </span>
            )}
          </motion.li>
        ))}
      </motion.ul>
    </div>
  )
}

/* ── 02 Select your program ──────────────────────────────────────────────── */

const MODULES = [
  "Forex market structure and currency pairs",
  "Technical and fundamental analysis",
  "Risk management and position sizing",
  "Trading psychology and a live trade plan",
]

const INCLUDED = ["Structured lessons", "Live classes", "Instructor Q&A", "Signed certificate"]

export function ProgramVignette() {
  const ok = useMotionOK()
  return (
    <div aria-hidden className="grid h-full grid-rows-[auto_1fr] bg-ws-sunken">
      <div className="border-b border-ws-hairline px-5 py-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-ws-gold">
          School of Trading &amp; Financial Markets
        </p>
        <p className="mt-1 font-display text-lg font-semibold tracking-[-0.01em] text-ws-primary md:text-xl">
          Forex Trading Mastery
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {["Beginner to advanced", "3 packages", "Certificate"].map((chip) => (
            <span key={chip} className="rounded-full bg-ws-chip px-2 py-0.5 text-[10px] font-medium text-ws-muted">
              {chip}
            </span>
          ))}
        </div>
      </div>
      <div className="grid min-h-0 md:grid-cols-[1fr_0.8fr]">
        <div className="min-h-0 overflow-hidden">
          <div className="border-b border-ws-hairline px-5 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-ws-subtle">
            Curriculum
          </div>
          <motion.ol initial="hidden" animate="show" variants={STAGGER}>
            {MODULES.map((module, i) => (
              <motion.li
                key={module}
                variants={itemVariants(ok)}
                className="flex items-center gap-3 border-b border-ws-hairline px-5 py-2.5 md:py-3"
              >
                <span className="font-display text-[11px] font-bold tracking-[0.1em] text-ws-gold">0{i + 1}</span>
                <span className="truncate text-[13px] text-ws-primary">{module}</span>
              </motion.li>
            ))}
          </motion.ol>
        </div>
        <div className="hidden min-h-0 flex-col border-l border-ws-hairline md:flex">
          <div className="border-b border-ws-hairline px-5 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-ws-subtle">
            What&apos;s included
          </div>
          <ul className="space-y-2.5 px-5 py-4">
            {INCLUDED.map((item) => (
              <li key={item} className="flex items-center gap-2 text-[12px] text-ws-muted">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-ws-success/20 text-ws-success">
                  <CheckIcon size={9} />
                </span>
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-auto px-5 pb-4">
            <span className="inline-flex h-9 w-full items-center justify-center rounded-sm bg-ws-brand text-[12px] font-semibold text-ws-brand-on">
              View packages
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── 03 Choose your package ──────────────────────────────────────────────── */

/** The real Forex ladder from the Phase 0 catalogue (spec §6). */
const TIERS = [
  { name: "Basic", price: 49, highlight: false, lines: ["Full curriculum", "Self-paced lessons", "Progress tracking"] },
  { name: "Standard", price: 199, highlight: true, lines: ["Everything in Basic", "Live classes and Q&A", "Signed certificate"] },
  { name: "Executive", price: 999, highlight: false, lines: ["Everything in Standard", "1:1 mentorship", "Priority support"] },
]

export function PackagesVignette() {
  const ok = useMotionOK()
  return (
    <div aria-hidden className="flex h-full flex-col bg-ws-sunken">
      <div className="shrink-0 border-b border-ws-hairline px-5 py-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-ws-gold">
          Choose your learning experience
        </p>
        <p className="mt-1 font-display text-[15px] font-semibold text-ws-primary md:text-lg">
          Forex Trading Mastery · packages
        </p>
      </div>
      <motion.div
        className="grid min-h-0 flex-1 gap-3 overflow-hidden p-4 sm:grid-cols-3 sm:p-5"
        initial="hidden"
        animate="show"
        variants={STAGGER}
      >
        {TIERS.map((tier) => (
          <motion.div
            key={tier.name}
            variants={itemVariants(ok)}
            className={
              tier.highlight
                ? "relative flex min-h-0 flex-col rounded-md border border-ws-brand/70 bg-ws-surface p-4"
                : "flex min-h-0 flex-col rounded-md border border-ws-hairline bg-ws-surface p-4"
            }
          >
            {tier.highlight && (
              <span className="absolute right-3 top-3 rounded-full bg-ws-brand px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-ws-brand-on">
                Popular
              </span>
            )}
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ws-muted">{tier.name}</p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-ws-primary">${tier.price}</p>
            <ul className="mt-3 hidden space-y-1.5 sm:block">
              {tier.lines.map((line) => (
                <li key={line} className="flex items-center gap-2 text-[11px] text-ws-muted">
                  <CheckIcon size={11} className={tier.highlight ? "shrink-0 text-ws-gold" : "shrink-0 text-ws-subtle"} />
                  {line}
                </li>
              ))}
            </ul>
            <span
              className={
                tier.highlight
                  ? "mt-auto inline-flex h-8 items-center justify-center rounded-sm bg-ws-brand text-[11px] font-semibold text-ws-brand-on"
                  : "mt-auto inline-flex h-8 items-center justify-center rounded-sm border border-ws-hairline text-[11px] font-semibold text-ws-primary"
              }
            >
              {tier.highlight ? "Enrol now" : "Choose"}
            </span>
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
```

Keep only the imports the file actually uses (eslint will flag unused ones — remove them, never disable the rule).

- [ ] **Step 2: Create `components/marketing/how-it-works.tsx`** — exactly:

```tsx
"use client"

import * as React from "react"
import Link from "next/link"
import { motion, useScroll, useTransform } from "motion/react"
import {
  BrowserFrame,
  ClassroomVignette,
  PackagesVignette,
  ProgramVignette,
  SchoolsVignette,
} from "@/components/marketing/vignettes"
import { Reveal } from "@/components/marketing/motion/reveal"
import { useMotionOK } from "@/components/marketing/motion/bus"

/**
 * HOW IT WORKS (spec §11) — the four-step journey as a timeline: sticky step
 * label on one side, the product moment in a browser frame on the other,
 * beside a vertical track whose gold beam fills with scroll. One section now
 * tells the story the old Programs index + Rooms timeline pair told twice.
 *
 * The beam is scroll-linked (useScroll on the track, spring-free transform).
 * Reduced motion: the track renders fully lit, entries plain-fade.
 */
const STEPS = [
  {
    id: "school",
    step: "01",
    label: "Choose your school",
    route: "/schools",
    body: "Find the area that matches your goals.",
    Vignette: SchoolsVignette,
  },
  {
    id: "program",
    step: "02",
    label: "Select your program",
    route: "/programs/forex-trading-mastery",
    body: "Explore the curriculum, instructors, benefits and learning format.",
    Vignette: ProgramVignette,
  },
  {
    id: "package",
    step: "03",
    label: "Choose your package",
    route: "/programs/forex-trading-mastery#packages",
    body: "Select the learning experience that fits your needs.",
    Vignette: PackagesVignette,
  },
  {
    id: "enrol",
    step: "04",
    label: "Enrol & start learning",
    route: "/dashboard/courses/…/learn",
    body: "Complete your payment and gain access to your learning dashboard.",
    Vignette: ClassroomVignette,
  },
] as const

export function HowItWorks() {
  const ok = useMotionOK()
  const trackRef = React.useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start 0.7", "end 0.6"],
  })
  const beamHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"])

  return (
    <section id="how-it-works" className="relative scroll-mt-24 py-24 md:py-32" aria-label="How it works">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal y={22} duration={0.7}>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ws-gold">
            How it works
          </p>
          <h2 className="mt-3 max-w-2xl font-display text-[clamp(1.75rem,3.6vw,2.75rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-ws-primary">
            Start your journey
            <br />
            in four simple steps.
          </h2>
        </Reveal>

        <div ref={trackRef} className="relative mt-16 md:mt-20">
          {/* Track + beam */}
          <div
            aria-hidden
            className="absolute bottom-0 left-[7px] top-0 w-px bg-ws-hairline md:left-1/2"
          >
            {ok ? (
              <motion.div
                className="w-px origin-top bg-gradient-to-b from-ws-gold via-ws-gold to-transparent"
                style={{ height: beamHeight }}
              />
            ) : (
              <div className="h-full w-px bg-ws-gold/60" />
            )}
          </div>

          <ol className="space-y-20 md:space-y-32">
            {STEPS.map((step, i) => {
              const flip = i % 2 === 1
              return (
                <li
                  key={step.id}
                  className="relative grid gap-8 pl-10 md:grid-cols-2 md:gap-16 md:pl-0"
                >
                  {/* Node on the track */}
                  <span
                    aria-hidden
                    className="absolute left-0 top-1 flex size-4 items-center justify-center rounded-full border border-ws-hairline bg-ws-surface md:left-1/2 md:-translate-x-1/2"
                  >
                    <span className="size-1.5 rounded-full bg-ws-gold" />
                  </span>

                  {/* Label — sticky while its frame scrolls by on desktop. */}
                  <div className={flip ? "md:order-2 md:pl-16" : "md:pr-16 md:text-right"}>
                    <div className="md:sticky md:top-28">
                      <Reveal y={18} duration={0.6}>
                        <span className="font-display text-[13px] font-bold tracking-[0.14em] text-ws-gold">
                          {step.step}
                        </span>
                        <h3 className="mt-2 font-display text-2xl font-semibold tracking-[-0.015em] text-ws-primary md:text-3xl">
                          {step.label}
                        </h3>
                        <p
                          className={
                            "mt-3 max-w-sm text-[14px] leading-relaxed text-ws-muted" +
                            (flip ? "" : " md:ml-auto")
                          }
                        >
                          {step.body}
                        </p>
                      </Reveal>
                    </div>
                  </div>

                  {/* The product moment */}
                  <div className={flip ? "md:order-1 md:pr-16" : "md:pl-16"}>
                    <Reveal y={28} duration={0.75}>
                      <div className="h-[24rem] md:h-[28rem]">
                        <BrowserFrame route={step.route}>
                          <step.Vignette />
                        </BrowserFrame>
                      </div>
                    </Reveal>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>

        {/* Spec §11 close: "Your journey starts here." + [EXPLORE PROGRAMS] */}
        <Reveal
          y={18}
          duration={0.6}
          className="mt-20 flex flex-col items-start gap-5 border-t border-ws-hairline pt-10 sm:flex-row sm:items-center sm:justify-between md:mt-24"
        >
          <p className="font-display text-xl font-semibold tracking-[-0.01em] text-ws-primary md:text-2xl">
            Your journey starts here.
          </p>
          <Link
            href="/schools"
            className="inline-flex h-12 items-center justify-center rounded-sm bg-ws-brand px-8 text-[15px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"
          >
            Explore programs
          </Link>
        </Reveal>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Rewire `components/marketing/landing.tsx`.** Replace the two imports

```ts
import { RoomsTimeline } from "@/components/marketing/rooms-timeline"
```
```ts
import { ProgramsList } from "@/components/marketing/programs-list"
```
with the single
```ts
import { HowItWorks } from "@/components/marketing/how-it-works"
```
and replace the two JSX slots
```tsx
      {/* §4 — Programs index */}
      <ProgramsList />

      {/* §5 — The product walkthrough, mid-page where it reads as evidence */}
      <RoomsTimeline />
```
with
```tsx
      {/* How it works — the four-step journey (spec §11) */}
      <HowItWorks />
```

- [ ] **Step 4: Delete the three superseded files**

```bash
git rm components/marketing/hero-slider.tsx components/marketing/rooms-timeline.tsx components/marketing/programs-list.tsx
```

Then confirm nothing else imports them: `grep -rn "hero-slider\|rooms-timeline\|programs-list" app components lib --include=*.ts --include=*.tsx` — expected: no output.

- [ ] **Step 5: Typecheck, lint, runtime**

Run: `npx tsc --noEmit 2>&1 | grep -v '^\.next/'` — expected: no output.
Run: `npx eslint components/marketing/vignettes.tsx components/marketing/how-it-works.tsx components/marketing/landing.tsx` — expected: clean.
Run: `curl -s http://localhost:3001/ | grep -o 'id="how-it-works"\|Choose your school\|Select your program\|Choose your package\|Enrol &amp; start learning\|Your journey starts here' | sort -u` — expected: all six strings.

- [ ] **Step 6: Commit**

```bash
git add components/marketing/vignettes.tsx components/marketing/how-it-works.tsx components/marketing/landing.tsx
git commit -m "feat(landing): four-step How it works timeline; retire hero-slider, rooms-timeline, programs-list

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
(`git rm` already staged the deletions.)

---

### Task 3: Why band, Schools grid, School card (new homepage sections)

**Files:**
- Create: `components/marketing/school-card.tsx`
- Create: `components/marketing/why-band.tsx`
- Create: `components/marketing/schools-grid.tsx`
- Modify: `components/marketing/landing.tsx` (imports, counts, two new slots)

**Interfaces:**
- Consumes: `School`, `SchoolSlug`, `SCHOOLS`, `countProgramsBySchool` from `@/lib/schools`; `SchoolIcon` (Task 1); `BRAND`; `Reveal`, `RevealGroup`, `LineMask`.
- Produces: `SchoolCard({ school, count, headingLevel?, className? })` (server-safe, no hooks — Task 5 reuses it), `WhyBand()`, `SchoolsGrid({ counts })`.

- [ ] **Step 1: Create `components/marketing/school-card.tsx`** — exactly:

```tsx
import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import type { School } from "@/lib/schools"
import { SchoolIcon } from "@/components/shared/school-icon"
import { cn } from "@/lib/utils"

/**
 * One school card (spec §4): icon in a gold wash, name, blurb, program count
 * and the [EXPLORE SCHOOL] affordance. The WHOLE card is the link — one tab
 * stop, one accessible name — so a grid of eight stays navigable. Server-safe
 * (no hooks): used by the landing grid and the /schools index.
 */
export function SchoolCard({
  school,
  count,
  headingLevel = "h3",
  className,
}: {
  school: School
  count: number
  /** h3 under a section h2 (landing); h2 under the page h1 (/schools). */
  headingLevel?: "h2" | "h3"
  className?: string
}) {
  const Heading = headingLevel
  return (
    <Link
      href={`/schools/${school.slug}`}
      className={cn(
        "group flex h-full flex-col rounded-lg border border-ws-hairline bg-ws-surface p-6 transition-colors duration-[var(--ws-motion-base)] hover:border-ws-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40",
        className
      )}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ws-brand/10 text-ws-gold">
        <SchoolIcon name={school.icon} size={18} />
      </span>
      <Heading className="mt-5 font-display text-[17px] font-semibold leading-snug tracking-[-0.01em] text-ws-primary">
        {school.name}
      </Heading>
      <p className="mt-2 text-[13px] leading-relaxed text-ws-muted">{school.blurb}</p>
      <span className="mt-auto flex items-center justify-between gap-3 pt-6 text-[13px]">
        <span className="tabular-nums text-ws-subtle">
          {count === 1 ? "1 program" : `${count} programs`}
        </span>
        <span className="inline-flex items-center gap-1.5 font-semibold text-ws-gold">
          Explore school
          <ArrowRightIcon
            size={14}
            aria-hidden
            className="transition-transform duration-200 group-hover:translate-x-0.5"
          />
        </span>
      </span>
    </Link>
  )
}
```

- [ ] **Step 2: Create `components/marketing/why-band.tsx`** — exactly (copy is spec §3 verbatim):

```tsx
"use client"

import {
  CompassIcon,
  GaugeIcon,
  GraduationCapIcon,
  HammerIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react"
import { LineMask } from "@/components/marketing/motion/line-mask"
import { Reveal, RevealGroup } from "@/components/marketing/motion/reveal"
import { BRAND } from "@/lib/brand"

/**
 * WHY (spec §3) — same grammar as the About band: statement left, argument
 * right on one baseline, then the six pillars full-width under a hairline.
 * No card, no panel: the section takes the page's own background.
 */
const PILLARS = [
  {
    icon: GraduationCapIcon,
    title: "Learn From Experts",
    line: "Learn from experienced instructors and practitioners across different fields.",
  },
  {
    icon: HammerIcon,
    title: "Practical Learning",
    line: "Go beyond theory with practical lessons, assignments, projects and real-world applications.",
  },
  {
    icon: CompassIcon,
    title: "Multiple Career Paths",
    line: "Explore technology, financial markets, digital business, creative skills and emerging industries.",
  },
  {
    icon: GaugeIcon,
    title: "Learn at Your Level",
    line: "Whether you're starting from zero or looking to advance your existing knowledge, choose a program that fits your level.",
  },
  {
    icon: UsersIcon,
    title: "Mentorship & Community",
    line: "Where included, receive access to instructors, mentorship, community learning and guided support.",
  },
  {
    icon: TrendingUpIcon,
    title: "Learn. Apply. Grow.",
    line: "The objective isn't simply to finish a course. It's to develop knowledge you can actually apply.",
  },
] as const

export function WhyBand() {
  return (
    <section className="relative py-24 md:py-32" aria-label={`Why learn with ${BRAND.name}`}>
      <div className="mx-auto max-w-7xl px-6">
        <RevealGroup>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ws-gold">
            Why {BRAND.wordmark}
          </p>

          <div className="mt-8 grid gap-x-16 gap-y-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <LineMask
              as="h2"
              mode="inview"
              className="font-display text-[clamp(2rem,4.4vw,3.5rem)] font-semibold leading-[1.06] tracking-[-0.025em] text-ws-primary"
              lines={[
                { text: "Why learn with" },
                { text: BRAND.wordmark, className: "text-ws-gold" },
                { text: `${BRAND.eyebrow}?`, className: "text-ws-gold" },
              ]}
            />

            <p className="max-w-xl text-[16px] leading-relaxed text-ws-muted md:text-[17px] lg:pt-2">
              Because the world is changing. The skills that create opportunities
              today are not necessarily the skills that created opportunities
              yesterday. {BRAND.name} is built around the skills shaping tomorrow.
            </p>
          </div>
        </RevealGroup>

        {/* Pillars — full width, one hairline, 1 → 2 → 3 columns. */}
        <div className="mt-20 grid gap-10 border-t border-ws-hairline pt-12 sm:grid-cols-2 sm:gap-8 md:mt-24 lg:grid-cols-3">
          {PILLARS.map((pillar, i) => (
            <Reveal key={pillar.title} delay={(i % 3) * 0.09} y={18} duration={0.6}>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ws-brand/10 text-ws-gold">
                <pillar.icon size={16} />
              </span>
              <h3 className="mt-4 text-[15px] font-semibold text-ws-primary">{pillar.title}</h3>
              <p className="mt-1.5 max-w-xs text-[13px] leading-relaxed text-ws-muted">{pillar.line}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Create `components/marketing/schools-grid.tsx`** — a SERVER component (no `"use client"`; `Reveal`/`RevealGroup` are client leaves that accept server-rendered children):

```tsx
import type { SchoolSlug } from "@/lib/schools"
import { SCHOOLS } from "@/lib/schools"
import { BRAND } from "@/lib/brand"
import { SchoolCard } from "@/components/marketing/school-card"
import { Reveal, RevealGroup } from "@/components/marketing/motion/reveal"

/**
 * OUR SCHOOLS (spec §4) — heading copy verbatim, then the eight cards in
 * 1 → 2 → 4 columns. Program counts come from the landing's single fetch
 * (`countProgramsBySchool`), never a second query.
 */
export function SchoolsGrid({ counts }: { counts: Record<SchoolSlug, number> }) {
  return (
    <section id="schools" className="relative scroll-mt-24 py-24 md:py-32" aria-label="Our schools">
      <div className="mx-auto max-w-7xl px-6">
        <RevealGroup>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ws-gold">
            Our schools
          </p>
          <h2
            className="mt-4 max-w-3xl font-display font-semibold leading-[1.05] tracking-[-0.02em] text-ws-primary"
            style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)" }}
          >
            Explore the Schools of {BRAND.name}
          </h2>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ws-muted md:text-[17px]">
            Your future can take many directions. Choose the school that matches
            your interests, goals and ambitions.
          </p>
        </RevealGroup>

        <ul className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SCHOOLS.map((school, i) => (
            <Reveal as="li" key={school.slug} delay={(i % 4) * 0.06} y={20} duration={0.6}>
              <SchoolCard school={school} count={counts[school.slug]} />
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Wire into `components/marketing/landing.tsx`.** Add imports:

```ts
import { countProgramsBySchool } from "@/lib/schools"
import { WhyBand } from "@/components/marketing/why-band"
import { SchoolsGrid } from "@/components/marketing/schools-grid"
```

After `const drops = futureDrops(published)` add:
```ts
  // ── Schools grid: program counts from the same published list.
  const schoolCounts = countProgramsBySchool(published)
```

Insert directly after the `<AboutBand />` slot (before `<HowItWorks />`):
```tsx
      {/* Why learn here — six pillars (spec §3) */}
      <WhyBand />

      {/* Our schools — eight cards with live program counts (spec §4) */}
      <SchoolsGrid counts={schoolCounts} />
```

- [ ] **Step 5: Typecheck, lint, runtime**

Run: `npx tsc --noEmit 2>&1 | grep -v '^\.next/'` — expected: no output.
Run: `npx eslint components/marketing/school-card.tsx components/marketing/why-band.tsx components/marketing/schools-grid.tsx components/marketing/landing.tsx` — expected: clean.
Run: `curl -s http://localhost:3001/ | grep -o 'href="/schools/[a-z-]*"' | sort -u | wc -l` — expected `8`.
Run: `curl -s http://localhost:3001/ | grep -o 'Learn From Experts\|Learn\. Apply\. Grow\.\|[0-9]* programs' | sort -u` — expected: both pillar titles plus at least one non-zero `N programs` count (the mock DB has 12 assigned programs).

- [ ] **Step 6: Commit**

```bash
git add components/marketing/school-card.tsx components/marketing/why-band.tsx components/marketing/schools-grid.tsx components/marketing/landing.tsx
git commit -m "feat(landing): Why band (six pillars) and Schools grid with live program counts

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Blueprint copy — hero, about, marquee, catalogue, testimonials, FAQ, finale, metadata

**Files:**
- Modify: `components/marketing/hero-wall.tsx` (headline lines ~152–160, paragraph ~161–170, CTA block ~171–199)
- Modify: `components/marketing/about-band.tsx` (whole file shrinks: pillars go)
- Modify: `components/marketing/words-marquee.tsx` (the `WORDS` array, lines 7–18)
- Modify: `components/marketing/catalogue-rail.tsx` (eyebrow, CTA label, aria-labels)
- Modify: `components/marketing/reviews-finale.tsx` (`Testimonials` heading; `FinaleCta` copy + CTAs)
- Modify: `components/marketing/faq.tsx` (the `FAQS` array, sub-copy, section id)
- Modify: `app/(marketing)/page.tsx` (metadata description)

**Interfaces:**
- Consumes: `BRAND`. `HeroWall`/`FinaleCta` props are unchanged (`signedIn`, `registerUrl`).
- Produces: `<section id="faq">` (the footer links to `/#faq` in Task 6).

- [ ] **Step 1: `hero-wall.tsx` — headline, paragraph, CTAs (spec §1).** Replace the `lines` prop of the `LineMask`:

```tsx
          lines={[
            { text: "Learn Skills." },
            { text: "Build Value." },
            { text: "Own Your Future.", className: "text-ws-gold" },
          ]}
```

Replace the paragraph text inside the `motion.p` (keep its props) with:
```
Master practical, in-demand skills through expert-led programs designed for the new and modern economy. Explore our schools, choose your path and start building capabilities you can apply in the real world.
```

Replace the CTA `motion.div`'s children (primary = EXPLORE PROGRAMS, secondary = START LEARNING per spec; the gold class strings are the existing ones, unchanged):
```tsx
          <Link
            href="/schools"
            className="inline-flex h-12 items-center justify-center rounded-sm bg-ws-brand px-8 text-[15px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"
          >
            Explore programs
          </Link>
          {signedIn ? (
            <Link
              href="/dashboard"
              className="inline-flex h-12 items-center justify-center rounded-sm border border-ws-hairline px-7 text-[15px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:border-ws-brand/40 hover:text-ws-gold"
            >
              Continue learning
            </Link>
          ) : (
            <a
              href={registerUrl}
              className="inline-flex h-12 items-center justify-center rounded-sm border border-ws-hairline px-7 text-[15px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:border-ws-brand/40 hover:text-ws-gold"
            >
              Start learning
            </a>
          )}
```

- [ ] **Step 2: `about-band.tsx` — spec §2, pillars removed.** Rewrite the file to exactly:

```tsx
"use client"

import Link from "next/link"
import { LineMask } from "@/components/marketing/motion/line-mask"
import { RevealGroup } from "@/components/marketing/motion/reveal"
import { BRAND } from "@/lib/brand"

/**
 * ABOUT (spec §2) — set directly on the page, not in a panel. The statement
 * sits left and the argument right on the same baseline grid. The old
 * three-pillar strip is gone: the six spec pillars live in WhyBand, directly
 * below, and saying it twice was the one thing the old page did wrong.
 */
export function AboutBand() {
  return (
    <section className="relative py-24 md:py-32" aria-label="About the academy">
      <div className="mx-auto max-w-7xl px-6">
        <RevealGroup>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ws-gold">
            About
          </p>

          {/* Statement left, argument right — aligned to one top edge. */}
          <div className="mt-8 grid gap-x-16 gap-y-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <LineMask
              as="h2"
              mode="inview"
              className="font-display text-[clamp(2rem,4.4vw,3.5rem)] font-semibold leading-[1.06] tracking-[-0.025em] text-ws-primary"
              lines={[
                { text: "Welcome to" },
                { text: BRAND.wordmark, className: "text-ws-gold" },
                { text: `${BRAND.eyebrow}.`, className: "text-ws-gold" },
              ]}
            />

            <div className="space-y-4 text-[16px] leading-relaxed text-ws-muted md:text-[17px] lg:pt-2">
              <p className="max-w-xl">
                {BRAND.name} is the education and skills development arm of the
                WorldStreet ecosystem.
              </p>
              <p className="max-w-xl">
                Our purpose is simple: To help people learn valuable skills,
                develop practical capabilities and create opportunities for
                themselves in the new economy.
              </p>
              <p className="max-w-xl">
                We bring together expert instructors, structured programs,
                practical learning experiences, mentorship and a growing
                ecosystem of opportunities.
              </p>
              <p className="max-w-xl">
                From financial markets to artificial intelligence, from
                blockchain to cybersecurity, from content creation to digital
                business, {BRAND.name} is designed to help you move from
                interest to knowledge, knowledge to skill, and skill to
                opportunity.
              </p>
              <Link
                href="/schools"
                className="group inline-flex items-center gap-1.5 pt-3 text-[14px] font-semibold text-ws-gold"
              >
                <span className="relative">
                  Explore the schools
                  <span className="absolute -bottom-0.5 left-0 h-px w-full origin-left scale-x-0 bg-ws-gold transition-transform duration-200 ease-[var(--ws-ease)] group-hover:scale-x-100" />
                </span>
                <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
            </div>
          </div>
        </RevealGroup>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: `words-marquee.tsx` — the band of words now spans the eight schools.** Replace the contents of the `WORDS` array (keep the const name and everything else) with:

```ts
  "Trading",
  "Blockchain",
  "Artificial intelligence",
  "Software",
  "Cybersecurity",
  "Data",
  "Creative media",
  "Digital business",
  "Mentorship",
  "Certification",
```

- [ ] **Step 4: `catalogue-rail.tsx` — programs, not courses.** Four string edits, nothing structural:
  - eyebrow `The catalogue` → `Featured programs`
  - CTA label `Browse all courses` → `Browse all programs`
  - `aria-label="Course catalogue"` → `aria-label="Program catalogue"`
  - `aria-label="Previous courses"` → `aria-label="Previous programs"`; `aria-label="More courses"` → `aria-label="More programs"`

- [ ] **Step 5: `reviews-finale.tsx` — §14 heading and §16 finale.**

In `Testimonials`, replace the eyebrow text `From the floor` with `Testimonials` and the h2 text `Rated by the people who did the work.` with `Real people. Real learning experiences.`

Replace the whole `FinaleCta` function with (the doc comment above it stays):

```tsx
export function FinaleCta({
  signedIn,
  registerUrl,
}: {
  signedIn: boolean
  registerUrl: string
}) {
  return (
    <section className="relative isolate overflow-hidden border-t border-ws-hairline py-20 text-center md:py-24">
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 h-[20rem] w-[44rem] max-w-[120vw] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]"
        style={{ background: "var(--ws-glow-brand)" }}
      />
      <div className="relative mx-auto max-w-3xl px-6">
        <Reveal as="h2" amount={0.2} className="font-display text-[clamp(2.25rem,5vw,4rem)] font-semibold leading-[1.04] tracking-[-0.03em] text-ws-primary">
          <span className="block">Your next level starts with</span>
          <span className="block text-ws-gold">what you learn today.</span>
        </Reveal>
        <Reveal as="p" amount={0.2} delay={0.1} className="mx-auto mt-6 max-w-2xl text-[15px] leading-relaxed text-ws-muted md:text-[16px]">
          The world is changing. Technology is changing. Business is changing.
          The way people create careers and opportunities is changing. The
          question isn&apos;t whether the world will change. The question is:
          Will you be ready?
        </Reveal>
        <Reveal as="p" amount={0.2} delay={0.14} className="mx-auto mt-4 max-w-md text-[15px] font-medium leading-relaxed text-ws-primary">
          Choose a skill. Build your knowledge. Develop your capability. Create
          your opportunity.
        </Reveal>
        <Reveal amount={0.2} delay={0.2} className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/schools"
            className="inline-flex h-12 items-center justify-center rounded-sm bg-ws-brand px-9 text-[15px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"
          >
            Explore programs
          </Link>
          {signedIn ? (
            <Link
              href="/dashboard/courses"
              className="inline-flex h-12 items-center justify-center rounded-sm border border-ws-hairline px-8 text-[15px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:border-ws-brand/40 hover:text-ws-gold"
            >
              Enrol now
            </Link>
          ) : (
            <a
              href={registerUrl}
              className="inline-flex h-12 items-center justify-center rounded-sm border border-ws-hairline px-8 text-[15px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:border-ws-brand/40 hover:text-ws-gold"
            >
              Enrol now
            </a>
          )}
        </Reveal>
        <Reveal as="p" amount={0.2} delay={0.26} className="mx-auto mt-8 max-w-xl text-[13px] leading-relaxed text-ws-subtle">
          Welcome to {BRAND.name}.{" "}
          <span className="font-semibold text-ws-muted">Learn Skills. Build Value. Create Your Future.</span>
        </Reveal>
      </div>
    </section>
  )
}
```
Add `import { BRAND } from "@/lib/brand"` to the file's imports.

- [ ] **Step 6: `faq.tsx` — the seven spec §15 questions.** Replace the `FAQS` const with:

```ts
const FAQS = [
  {
    q: `Who can join ${BRAND.name}?`,
    a: "Anyone who wants to develop practical knowledge and skills can explore our programs, subject to the requirements of individual courses.",
  },
  {
    q: "Do I need previous experience?",
    a: "Many programs are designed for beginners. Individual program pages will specify prerequisites where necessary.",
  },
  {
    q: "Are classes online?",
    a: `Programs can be delivered through the ${BRAND.name} LMS using the format specified on each program page.`,
  },
  {
    q: "Can I learn more than one course?",
    a: "Yes. Students can enrol in multiple programs where available.",
  },
  {
    q: "Do I receive a certificate?",
    a: "Eligible programs may provide certificates upon meeting their completion requirements.",
  },
  {
    q: "Can I pay online?",
    a: "Yes. The platform provides secure payment options available to the student's country.",
  },
  {
    q: "What happens after payment?",
    a: "Your enrollment is confirmed and your course access becomes available according to the program's delivery schedule.",
  },
] as const
```

Replace the doc comment's second paragraph (the "Every answer is grounded…" block) with `Copy is spec §15 verbatim.` Replace the sub-copy paragraph text `The short version of how paying, learning, exams and teaching work here.` with `The short version of how joining, learning, paying and certificates work here.` Change the section opening tag to:

```tsx
    <section id="faq" className="relative isolate scroll-mt-24 py-24 md:py-32" aria-label="Frequently asked questions">
```

- [ ] **Step 7: `app/(marketing)/page.tsx` metadata.** Replace the description with:

```ts
  description: `Master practical, in-demand skills through expert-led programs designed for the new and modern economy. Explore the eight schools of ${BRAND.name}, choose your path and start building capabilities you can apply in the real world.`,
```

- [ ] **Step 8: Typecheck, lint, runtime**

Run: `npx tsc --noEmit 2>&1 | grep -v '^\.next/'` — expected: no output.
Run: `npx eslint components/marketing/hero-wall.tsx components/marketing/about-band.tsx components/marketing/words-marquee.tsx components/marketing/catalogue-rail.tsx components/marketing/reviews-finale.tsx components/marketing/faq.tsx "app/(marketing)/page.tsx"` — expected: clean (remove any import the pillar deletion left unused in about-band.tsx).
Run: `curl -s http://localhost:3001/ | grep -o 'Own Your Future\.\|Explore programs\|Welcome to\|Who can join\|What happens after payment\|id="faq"\|what you learn today\|Featured programs' | sort -u` — expected: all eight strings.
Run: `curl -s http://localhost:3001/ | grep -c 'A trading floor\|taught from the floor\|Browse the catalogue\|Rated by the people'` — expected `0`.

- [ ] **Step 9: Commit**

```bash
git add components/marketing/hero-wall.tsx components/marketing/about-band.tsx components/marketing/words-marquee.tsx components/marketing/catalogue-rail.tsx components/marketing/reviews-finale.tsx components/marketing/faq.tsx "app/(marketing)/page.tsx"
git commit -m "feat(landing): blueprint copy for hero, about, marquee, catalogue, testimonials, FAQ and finale

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Routes — `/schools` index and `/schools/[slug]`

**Files:**
- Create: `components/marketing/program-row.tsx`
- Create: `app/(marketing)/schools/page.tsx`
- Create: `app/(marketing)/schools/[slug]/page.tsx`

**Interfaces:**
- Consumes: `fetchBrowseCourses({ school })`, `BrowseCourse` (Task 1); `SCHOOLS`, `SCHOOL_BY_SLUG`, `isSchoolSlug`, `countProgramsBySchool` from `@/lib/schools`; `SchoolCard` (Task 3); `SchoolIcon` (Task 1); `courseAvailability` from `@/lib/types/course`; `levelChipStyle` from `@/components/shared/level-badge`; `BRAND`. The root layout already applies the title template `%s | ${BRAND.name}` — pages set the `%s` part only.
- Produces: routes `/schools` and `/schools/[slug]` (404 on unknown slug); `ProgramRow({ course })` and `programPriceLabel(course)`.

- [ ] **Step 1: Create `components/marketing/program-row.tsx`** — server-safe (no hooks), exactly:

```tsx
import Link from "next/link"
import Image from "next/image"
import { ArrowRightIcon } from "lucide-react"
import type { BrowseCourse } from "@/lib/actions/student"
import { courseAvailability } from "@/lib/types/course"
import { levelChipStyle } from "@/components/shared/level-badge"

/**
 * Price line for a program row. `Course.price` is whole USD and, for
 * package ladders, already the cheapest enabled tier (Phase 0 rule) — so a
 * ladder reads "From $49", a single package or legacy course reads the
 * scalar, and free stays free.
 */
export function programPriceLabel(
  course: Pick<BrowseCourse, "pricing" | "price" | "tierCount">
): string {
  if (course.pricing === "free" || !course.price) return "Free"
  const usd = `$${course.price.toLocaleString("en-US")}`
  return course.tierCount > 1 ? `From ${usd}` : usd
}

/**
 * One program on a school page (spec §5): title, blurb, level, price and the
 * [VIEW PROGRAM] affordance. The whole row is the link. Links to the existing
 * course page until Phase 2 ships `/programs/[slug]`.
 */
export function ProgramRow({ course }: { course: BrowseCourse }) {
  const comingSoon =
    courseAvailability({ status: "published", availableAt: course.availableAt }) === "coming_soon"

  return (
    <li>
      <Link
        href={`/courses/${course.id}`}
        className="group grid gap-5 rounded-lg border border-ws-hairline bg-ws-surface p-5 transition-colors duration-[var(--ws-motion-base)] hover:border-ws-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 sm:grid-cols-[9rem_1fr] sm:p-6"
      >
        <div className="relative aspect-video overflow-hidden rounded-md bg-ws-sunken sm:aspect-[4/3]">
          {course.thumbnailUrl && (
            <Image
              src={course.thumbnailUrl}
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, 9rem"
              className="object-cover"
            />
          )}
        </div>
        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-medium capitalize"
              style={levelChipStyle(course.level)}
            >
              {course.level}
            </span>
            {comingSoon && (
              <span className="rounded-full bg-ws-chip px-2 py-0.5 text-[11px] font-medium text-ws-muted">
                Coming soon
              </span>
            )}
          </div>
          <h3 className="mt-3 font-display text-xl font-semibold tracking-[-0.01em] text-ws-primary">
            {course.title}
          </h3>
          <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-ws-muted">
            {course.shortDescription ?? course.description}
          </p>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
            <span className="text-[14px] font-semibold tabular-nums text-ws-primary">
              {programPriceLabel(course)}
            </span>
            <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ws-gold">
              View program
              <ArrowRightIcon
                size={14}
                aria-hidden
                className="transition-transform duration-200 group-hover:translate-x-0.5"
              />
            </span>
          </div>
        </div>
      </Link>
    </li>
  )
}
```

- [ ] **Step 2: Create `app/(marketing)/schools/page.tsx`** — exactly:

```tsx
import type { Metadata } from "next"
import { SCHOOLS, countProgramsBySchool } from "@/lib/schools"
import { fetchBrowseCourses } from "@/lib/actions/student"
import { BRAND } from "@/lib/brand"
import { SchoolCard } from "@/components/marketing/school-card"

export const metadata: Metadata = {
  title: "Schools",
  description:
    "Your future can take many directions. Choose the school that matches your interests, goals and ambitions.",
}

// Program counts come from the live catalogue.
export const revalidate = 0

/** `/schools` — spec §4 as a page: the eight schools with live program counts. */
export default async function SchoolsPage() {
  const courses = await fetchBrowseCourses()
  const counts = countProgramsBySchool(courses)

  return (
    <div className="mx-auto max-w-7xl px-6 pb-24 pt-10 md:pb-32 md:pt-16">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ws-gold">Our schools</p>
      <h1
        className="mt-4 max-w-3xl font-display font-semibold leading-[1.05] tracking-[-0.02em] text-ws-primary"
        style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)" }}
      >
        Explore the Schools of {BRAND.name}
      </h1>
      <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ws-muted md:text-[17px]">
        Your future can take many directions. Choose the school that matches your
        interests, goals and ambitions.
      </p>

      <ul className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SCHOOLS.map((school) => (
          <li key={school.slug}>
            <SchoolCard school={school} count={counts[school.slug]} headingLevel="h2" />
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 3: Create `app/(marketing)/schools/[slug]/page.tsx`** — exactly:

```tsx
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"
import { SCHOOL_BY_SLUG, isSchoolSlug } from "@/lib/schools"
import { fetchBrowseCourses } from "@/lib/actions/student"
import { SchoolIcon } from "@/components/shared/school-icon"
import { ProgramRow } from "@/components/marketing/program-row"

// Published/coming-soon state of a school's programs changes under a cached render.
export const revalidate = 0

type Params = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  if (!isSchoolSlug(slug)) return {}
  const school = SCHOOL_BY_SLUG[slug]
  return { title: school.name, description: school.tagline ?? school.blurb }
}

/**
 * `/schools/[slug]` — spec §5: the school's tagline and intro from config,
 * then its published programs from the catalogue. Unknown slugs 404.
 */
export default async function SchoolPage({ params }: Params) {
  const { slug } = await params
  if (!isSchoolSlug(slug)) notFound()
  const school = SCHOOL_BY_SLUG[slug]
  const programs = await fetchBrowseCourses({ school: slug })

  return (
    <div className="mx-auto max-w-7xl px-6 pb-24 pt-10 md:pb-32 md:pt-16">
      <Link
        href="/schools"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary"
      >
        <ArrowLeftIcon size={14} aria-hidden />
        All schools
      </Link>

      <header className="mt-8 max-w-3xl">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ws-brand/10 text-ws-gold">
          <SchoolIcon name={school.icon} size={22} />
        </span>
        <h1
          className="mt-6 font-display font-semibold leading-[1.05] tracking-[-0.02em] text-ws-primary"
          style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)" }}
        >
          {school.name}
        </h1>
        {school.tagline && (
          <p className="mt-4 font-display text-xl font-medium text-ws-gold md:text-2xl">{school.tagline}</p>
        )}
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ws-muted md:text-[17px]">
          {school.intro ?? school.blurb}
        </p>
      </header>

      <section className="mt-16 border-t border-ws-hairline pt-10" aria-labelledby="programs-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="programs-heading" className="font-display text-2xl font-semibold tracking-[-0.015em] text-ws-primary">
            Available programs
          </h2>
          <span className="text-[13px] tabular-nums text-ws-subtle">
            {programs.length === 1 ? "1 program" : `${programs.length} programs`}
          </span>
        </div>

        {programs.length > 0 ? (
          <ul className="mt-8 grid gap-4">
            {programs.map((course) => (
              <ProgramRow key={course.id} course={course} />
            ))}
          </ul>
        ) : (
          <div className="mt-8 rounded-lg border border-dashed border-ws-hairline p-10 text-center">
            <p className="font-display text-lg font-semibold text-ws-primary">Programs coming soon</p>
            <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-ws-muted">
              This school&apos;s first programs are being prepared. Explore the other schools in the meantime.
            </p>
            <Link
              href="/schools"
              className="mt-6 inline-flex h-11 items-center justify-center rounded-sm border border-ws-hairline px-6 text-[14px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:border-ws-brand/40 hover:text-ws-gold"
            >
              Explore the schools
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Typecheck, lint, runtime**

Run: `npx tsc --noEmit 2>&1 | grep -v '^\.next/'` — expected: no output.
Run: `npx eslint components/marketing/program-row.tsx "app/(marketing)/schools/page.tsx" "app/(marketing)/schools/[slug]/page.tsx"` — expected: clean.
Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/schools` — expected `200`.
Run: `curl -s http://localhost:3001/schools | grep -o 'href="/schools/[a-z-]*"' | sort -u | wc -l` — expected `8`.
Run: `curl -s http://localhost:3001/schools/trading-financial-markets | grep -o 'Forex Trading Mastery\|Crypto Trading Mastery\|From \$49\|View program\|Understand the markets' | sort -u` — expected: all five strings (`From $49` proves the ladder price rule).
Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/schools/not-a-school` — expected `404`.
Run: `curl -s http://localhost:3001/schools/cybersecurity | grep -o 'Available programs\|Programs coming soon\|View program' | sort -u` — expected `Available programs` plus EITHER `View program` (a program is assigned) OR `Programs coming soon` (none) — report which.

- [ ] **Step 5: Commit**

```bash
git add components/marketing/program-row.tsx "app/(marketing)/schools/page.tsx" "app/(marketing)/schools/[slug]/page.tsx"
git commit -m "feat(schools): /schools index and /schools/[slug] pages with live programs

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Navigation — navbar, footer, sidebar label, programs index copy

**Files:**
- Modify: `components/marketing/navbar.tsx` (link row + `mobileLinks`)
- Modify: `components/marketing/footer.tsx` (Academy column, tagline)
- Modify: `components/platform/app-sidebar.tsx:73` (one label)
- Modify: `app/(marketing)/courses/page.tsx` (heading + intro copy)

**Interfaces:**
- Consumes: `MarketingNavLink` from `@/components/marketing/mobile-nav` (unchanged), `BRAND`. Anchors `#how-it-works` (Task 2) and `#faq` (Task 4).

- [ ] **Step 1: `navbar.tsx`.** Add a module-level const after `REGISTER_URL`:

```ts
/** Public destinations, in journey order (spec §17). Shared by the md+ link row and the mobile sheet. */
const PUBLIC_LINKS: MarketingNavLink[] = [
  { href: "/schools", label: "Schools" },
  { href: "/courses", label: "Programs" },
  { href: "/#how-it-works", label: "How it works" },
]
```

Change the first entry of `mobileLinks` from `{ href: "/courses", label: "Courses" },` to `...PUBLIC_LINKS,`.

In the `<nav>`, replace the single hard-coded `Courses` `<Link>` with:
```tsx
            {PUBLIC_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full px-3 py-1.5 text-sm font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-chip hover:text-ws-primary"
              >
                {link.label}
              </Link>
            ))}
```
The `My Learning` / `Instructor Dashboard` conditionals and the CTA block stay exactly as they are.

- [ ] **Step 2: `footer.tsx`.** Add `import { BRAND } from "@/lib/brand"`. Replace the tagline paragraph text `Learn, trade, and grow with the WorldStreet ecosystem.` with `{BRAND.tagline}`. Replace the Academy column's `<ul>` with:

```tsx
            <ul className="space-y-2">
              <li>
                <Link href="/schools" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Schools
                </Link>
              </li>
              <li>
                <Link href="/courses" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Programs
                </Link>
              </li>
              <li>
                <Link href="/#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  My Learning
                </Link>
              </li>
            </ul>
```
The Teach and Legal columns are unchanged (Legal stays as plain spans — the pages arrive in Phase 8; do not turn them into links).

- [ ] **Step 3: `app-sidebar.tsx`.** Change `title: "Browse courses",` (the `learnItems` entry with `href: "/dashboard/courses"`) to `title: "Programs",`. Nothing else in the file.

- [ ] **Step 4: `app/(marketing)/courses/page.tsx`.** Add `import { BRAND } from "@/lib/brand"`. Replace the h1 text `All Courses` with `All programs` and the paragraph text `Browse our catalog of courses across crypto, trading, and blockchain.` with `Browse every program across the eight schools of {BRAND.name}.`

- [ ] **Step 5: Typecheck, lint, runtime**

Run: `npx tsc --noEmit 2>&1 | grep -v '^\.next/'` — expected: no output.
Run: `npx eslint components/marketing/navbar.tsx components/marketing/footer.tsx components/platform/app-sidebar.tsx "app/(marketing)/courses/page.tsx"` — expected: clean.
Run: `curl -s http://localhost:3001/ | grep -o 'href="/schools"\|href="/#how-it-works"\|href="/#faq"\|>Programs<' | sort -u` — expected: all four.
Run: `curl -s http://localhost:3001/courses | grep -o 'All programs\|eight schools'` — expected: both.
Run: `curl -s -b mock_persona=student http://localhost:3001/dashboard | grep -c '>Programs<'` — expected `≥ 1`; and `curl -s -b mock_persona=student http://localhost:3001/dashboard | grep -c 'Browse courses'` — expected `0` from the sidebar (the dashboard body's own "Browse courses" section header and empty-state labels are Phase 4 and may remain — report the number and where it comes from).

- [ ] **Step 6: Commit**

```bash
git add components/marketing/navbar.tsx components/marketing/footer.tsx components/platform/app-sidebar.tsx "app/(marketing)/courses/page.tsx"
git commit -m "feat(nav): Schools / Programs / How it works in navbar and footer; sidebar Programs label

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Phase verification (controller, after Task 6)

- `/` renders the eleven sections in order: HeroWall → WordsMarquee → AboutBand → WhyBand → SchoolsGrid → HowItWorks → CatalogueGrid → UpcomingDrops (if any) → Testimonials (if any) → Faq → FinaleCta.
- `/schools` shows eight cards with non-zero counts for the assigned schools; `/schools/trading-financial-markets` lists Forex + Crypto with `From $49` / `From $49`; unknown slug 404s.
- No horizontal scroll at 400px on `/`, `/schools`, `/schools/trading-financial-markets` (screenshot if the headless browser cooperates; otherwise reviewer checks for fixed widths > 100vw in new files).
- `grep -rn 'href="#"' components/marketing app/\(marketing\)` → none. `grep -rn "hero-slider\|rooms-timeline\|programs-list" app components lib` → none.
- `pnpm lint` total ≤ the pre-Phase-1 baseline (60 problems on `main`); `npx tsc --noEmit` clean apart from the pre-existing stale `.next/types` entries.
