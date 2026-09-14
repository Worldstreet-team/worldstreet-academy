# Mastery Academy — Phase 2 Implementation Plan (Program page, packages editor, catalogue)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The blueprint's §6–§9 program page is live at `/programs/[slug]` — hero, "What you'll learn", the 1–3-card package ladder with a working Enrol CTA per package, "What's included", the instructor block and the §15 FAQ — `/programs` lists every published program grouped by school, every old `/courses*` URL redirects, and instructors/admins manage packages and per-lesson minimum tiers in the existing course editor with server-side validation.

**Architecture:** One new read helper (`fetchProgramBySlug`) hands the page a `ProgramDetail` whose `packages` array is never empty (a course without a ladder gets one synthesized "Full program" tier at its own price), so every program renders the same components. Access state (enrolled / coming soon / open) is computed once by the page and shared by the hero CTA, every package card and the mobile bar. Package editing is a controlled `PackageEditor` child of the existing course editor that serializes into the `packages` hidden field the Phase 0 save path already validates (`parsePackages` in `lib/actions/instructor.ts`); the editor derives the scalar `pricing`/`price` from the cheapest enabled tier so the server's existing price validation keeps passing. Lesson tiers ride the editor's `lessons` JSON (the course save recreates lessons, so the field must travel with them) plus a small per-row action on the lesson manager.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict · Mongoose (reads + the existing course/lesson writes) · Zod (`zod/v4`) · Tailwind v4 · Base UI (`render` prop) · lucide-react.

**Spec:** `docs/mastery-academy-blueprint.md` §5–§9, §15, §17 (copy — binding) and `docs/mastery-academy-plan.md` §Phase 2 (scope, rulings). Phase 0 shipped the schema (`Course.packages`, `Course.school`, `Course.shortDescription`, `Lesson.minPackageKey`, `lib/entitlements.ts`, `parsePackages` in `lib/actions/instructor.ts`); Phase 1 shipped `/schools`, `/schools/[slug]`, `BrowseCourse.school/shortDescription/tierCount`, `programPriceLabel`, `SchoolIcon`.

**Controller rulings already made (do not re-litigate — they are in the ledger):**
- The `/courses` → `/programs` and `/courses/[id]` → `/programs/[slug]` redirects are page-level `permanentRedirect()` calls, NOT `next.config.ts` redirects, so the running dev server never restarts.
- `PackageCta` and the sticky mobile bar are server components (plain links/anchors — nothing needs a hook).
- Pre-enrolled + live counts as "open" for the ladder (the card link goes to checkout, which activates the reservation); coming-soon (with or without a reservation) shows one `CourseSchedulingCta` in the hero and muted "Available at launch" blocks on the cards.
- The instructor block is a new lightweight server component (`ProgramInstructor`), not the dashboard's `AboutInstructor` (that one needs other-course lists and a Message button).
- `CourseOutcomes` is reused unchanged (its heading reads "What you'll learn").
- Signed-in dashboard surfaces (`components/courses/course-card.tsx`, `components/shared/command-search.tsx`, the sidebar) keep `/dashboard/courses/[id]` — Phase 4 owns the dashboard.
- Published courses with no school (legacy mock rows) list under a trailing "More programs" group on `/programs` so nothing published disappears.
- Live lesson-tier write paths are `lib/actions/instructor.ts` (editor save, `addLesson`, new `setLessonMinPackage`); `lib/actions/lessons.ts` gets the Zod field so its (currently uncalled) actions validate it too.

## Global Constraints

- **No schema changes.** Do not touch `lib/db/models/*` or `scripts/*`. Additive TypeScript types only. No new `role` values. Money stays whole USD in `Course.price` and package `price`; never touch `lib/actions/enrollments.ts`, `lib/wallet.ts`, or `app/(platform)/dashboard/checkout/**` (checkout learns `package=` in Phase 3).
- **`"use server"` files export only async functions** (types are fine, sync helpers must stay unexported). `lib/actions/student.ts`, `reviews.ts`, `instructor.ts`, `lessons.ts` are all `"use server"`.
- **Copy is the spec's, verbatim** ("Choose your learning experience", "Most popular", "Your learning experience", "Depending on the program, students may receive:", "Specific inclusions vary by program and package.", the eleven §9 inclusions, "Enrol for $X"). Brand always through `BRAND` from `@/lib/brand`. Never invent numbers, testimonials or claims.
- **Icons:** `lucide-react` only, never emoji (the spec's ⭐ becomes a gold `StarIcon` chip).
- **UI tokens:** never hardcode a palette hex; semantic classes only (`text-ws-gold`, `bg-ws-surface`, `bg-ws-raised`, `bg-ws-sunken`, `bg-ws-chip`, `border-ws-hairline`, `text-ws-muted`, `text-ws-subtle`, `text-ws-primary`, `bg-ws-brand`, `text-ws-brand-on`, `bg-ws-brand/10` washes, `text-ws-rating`, `text-ws-danger`, `font-display`). NEW files use radii from the ladder only (`rounded-xs/sm/md/lg/full`). Gold only on the primary CTA, the "Most popular" chip, active state, brand moments and ~10% icon washes — the highlighted package card gets a raised surface and a gold border wash, NEVER a gold background. Prices in `tabular-nums`. Section separators use `·`.
- **Base UI composition uses the `render` prop, never `asChild`.** RSC-first: `"use client"` only where hooks require it.
- **Links:** public program links are `/programs/${course.slug}`; public catalogue is `/programs`. Signed-in dashboard links stay `/dashboard/courses/${id}`. Never ship a dead link (no `href="#"` except in-page `#packages`; no `/faculty`, `/terms`, `/privacy`).
- **No new dependencies. No `any`.**
- **Verification:** no test runner exists. Every task ends with `npx tsc --noEmit 2>&1 | grep -v '^\.next/'` printing nothing, `npx eslint <every file you touched>` printing no errors or warnings, and the task's own runtime check. A `pnpm dev:mock` server is ALREADY RUNNING on http://localhost:3001 from this checkout (mock Clerk, local MongoDB at `mongodb://127.0.0.1:27017/worldstreet-academy` seeded with the 12 Mastery programs; Turbopack hot-reloads file changes, including new routes and deleted files). Do **not** start a second dev server and do **not** edit `next.config.ts`. Runtime checks are `curl` against :3001 — Next HTML is one line, so count with `grep -o … | wc -l`, never `grep -c`. Personas: `-b mock_persona=guest` (signed out), `student`, `instructor`, `admin` (no cookie = student). Known mock data: `forex-trading-mastery` (3 packages, 14 outcomes), `crypto-trading-mastery` (3 packages), `ai-ai-automation` (1 package, $199), `blockchain-technology-mastery` (1 package, no outcomes), and five legacy published courses with no school and no packages (e.g. `bitcoin-cryptocurrency-fundamentals`, price 0). Guest → `/dashboard/checkout?…` is a 307 to the WorldStreet hub login carrying the full checkout URL (the mock uses a `pk_live_` key, so the production branch of `middleware.ts` runs).
- **Commits:** one or more per task; message ends with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Never commit `.env*`. Never `git add -A` — add the files you touched by name. **Never run `git stash` / `git stash pop`** (other work may be in the tree); if the tree looks dirty, leave it and say so in your report.
- **Surgical:** touch only listed files (plus files a compile error forces you into — say so in the report). No reformatting, no drive-by refactors, no renames beyond those listed. Do not touch `app/(platform)/**` (except nothing — the dashboard is Phase 4).

---

### Task 1: Data layer — `slug` on `BrowseCourse`, `ProgramDetail` + `fetchProgramBySlug`, `fetchProgramSlug`, package helpers, review slug

**Files:**
- Modify: `lib/entitlements.ts` (append three exports)
- Modify: `lib/actions/student.ts` (the `BrowseCourse` type at lines 13–37; the two mappers in `fetchBrowseCourses` ≈ line 130 and `fetchOtherCourses` ≈ line 420; new types + two functions inserted after `fetchPublicCourse`, ≈ line 292)
- Modify: `lib/actions/reviews.ts` (`LandingReview` type at line 473; `fetchLandingReviews` populate + mapper at lines 489–535)

**Interfaces:**
- Consumes: `ICoursePackage`, `IPackageEntitlements`, `PackageKey` from `@/lib/db/models`; `FULL_ACCESS`, `PACKAGE_RANK` from `@/lib/entitlements` (Phase 0); `Course.slug` (unique, lowercase), `Course.rating.count`.
- Produces (later tasks rely on these exact names):
  - `lib/entitlements.ts`: `PACKAGE_KEYS: readonly ["basic","standard","executive"]`, `isPackageKey(v: unknown): v is PackageKey`, `PACKAGE_LABEL: Record<PackageKey, string>` (`Basic` / `Standard` / `Executive 101`).
  - `BrowseCourse.slug: string`.
  - `PublicPackage`, `ProgramDetail` types; `fetchProgramBySlug(slug: string): Promise<ProgramDetail | null>` (published only; `packages` never empty, sorted basic → standard → executive); `fetchProgramSlug(courseId: string): Promise<string | null>` (published only; invalid ObjectId → null).
  - `LandingReview.courseSlug: string`.

- [ ] **Step 1: Package helpers.** Append to `lib/entitlements.ts`:

```ts
/** Ladder order — also the order the program page renders tiers in. */
export const PACKAGE_KEYS = ["basic", "standard", "executive"] as const

export function isPackageKey(value: unknown): value is PackageKey {
  return typeof value === "string" && (PACKAGE_KEYS as readonly string[]).includes(value)
}

/** Spec §6 tier labels as the program page and editor print them. */
export const PACKAGE_LABEL: Record<PackageKey, string> = {
  basic: "Basic",
  standard: "Standard",
  executive: "Executive 101",
}
```

- [ ] **Step 2: `slug` on `BrowseCourse`.** In `lib/actions/student.ts`, add one field to the type directly under `title: string`:

```ts
  /** Public URL key: `/programs/${slug}`. */
  slug: string
```

and one line to BOTH mappers (`fetchBrowseCourses` and `fetchOtherCourses`), directly under `title: course.title,`:

```ts
        slug: course.slug,
```

- [ ] **Step 3: Program detail types + fetchers.** Extend the imports at the top of `lib/actions/student.ts`:

```ts
import { Course, Enrollment, Bookmark, User, Lesson, type IPackageEntitlements, type PackageKey } from "@/lib/db/models"
import { FULL_ACCESS, PACKAGE_RANK } from "@/lib/entitlements"
```

(keep the existing `mongoose`, `connectDB`, `getCurrentUser`, `isSchoolSlug` imports). Then insert this block immediately after the closing `}` of `fetchPublicCourse` (before the `// LEARN PAGE` banner):

```ts
// ============================================================================
// PROGRAM PAGE (spec §6–§9) — /programs/[slug]
// ============================================================================

/** One purchasable tier as the public program page shows it (packages are public; nothing is stripped but `enabled`). */
export type PublicPackage = {
  key: PackageKey
  name: string
  tagline: string
  price: number
  features: string[]
  highlight: boolean
  ctaLabel: string | null
  entitlements: IPackageEntitlements
}

export type ProgramDetail = BrowseCourse & {
  ratingCount: number
  whatYouWillLearn: string[]
  requirements: string[]
  targetAudience: string[]
  instructorHeadline: string | null
  instructorBio: string | null
  instructorTotalStudents: number
  /**
   * Enabled tiers in ladder order (basic → standard → executive). Never empty:
   * a course without a ladder gets one synthesized "Full program" tier at the
   * course's own price, so every program renders the same components.
   */
  packages: PublicPackage[]
}

const NO_ENTITLEMENTS: IPackageEntitlements = {
  liveClasses: false,
  instructorQa: false,
  assignments: false,
  certificate: false,
  mentorship: false,
  prioritySupport: false,
}

/**
 * Fetch one published program by slug for the public program page.
 */
export async function fetchProgramBySlug(slug: string): Promise<ProgramDetail | null> {
  try {
    await connectDB()

    const course = await Course.findOne({ slug, status: "published" })
      .populate("instructor", "firstName lastName avatarUrl bio instructorProfile")
      .lean()

    if (!course) return null

    const instructor = course.instructor as unknown as {
      _id: { toString(): string }
      firstName: string
      lastName?: string
      avatarUrl: string | null
      bio: string | null
      instructorProfile?: { headline: string | null; totalStudents: number }
    } | null

    // Guard against missing instructor (deleted user, etc.)
    if (!instructor) return null

    const whatYouWillLearn = course.whatYouWillLearn ?? []
    const enabled = (course.packages ?? [])
      .filter((p) => p.enabled)
      .sort((a, b) => PACKAGE_RANK[a.key] - PACKAGE_RANK[b.key])

    const packages: PublicPackage[] =
      enabled.length > 0
        ? enabled.map((p) => ({
            key: p.key,
            name: p.name,
            tagline: p.tagline ?? "",
            price: p.price,
            features: p.features ?? [],
            highlight: Boolean(p.highlight),
            ctaLabel: p.ctaLabel ?? null,
            entitlements: { ...NO_ENTITLEMENTS, ...p.entitlements },
          }))
        : [
            {
              key: "standard",
              name: "Full program",
              tagline: "",
              price: course.price ?? 0,
              features: whatYouWillLearn,
              highlight: false,
              ctaLabel: null,
              entitlements: FULL_ACCESS,
            },
          ]

    return {
      id: course._id.toString(),
      title: course.title,
      slug: course.slug,
      description: course.description,
      shortDescription: course.shortDescription ?? null,
      thumbnailUrl: course.thumbnailUrl,
      instructorId: instructor._id.toString(),
      instructorName: `${instructor.firstName} ${instructor.lastName || ""}`.trim(),
      instructorAvatarUrl: instructor.avatarUrl,
      level: course.level as "beginner" | "intermediate" | "advanced",
      category: course.category || "",
      school: isSchoolSlug(course.school) ? course.school : null,
      pricing: course.pricing as "free" | "paid",
      price: course.price,
      tierCount: enabled.length,
      status: course.status,
      availableAt: course.availableAt ? course.availableAt.toISOString() : null,
      preEnrollEnabled: course.preEnrollEnabled ?? true,
      totalLessons: course.totalLessons || 0,
      totalDuration: course.totalDuration || 0,
      enrolledCount: course.enrolledCount || 0,
      rating: course.rating?.average || null,
      ratingCount: course.rating?.count || 0,
      whatYouWillLearn,
      requirements: course.requirements ?? [],
      targetAudience: course.targetAudience ?? [],
      instructorHeadline: instructor.instructorProfile?.headline || null,
      instructorBio: instructor.bio,
      instructorTotalStudents: instructor.instructorProfile?.totalStudents || 0,
      packages,
    }
  } catch (error) {
    console.error("Fetch program by slug error:", error)
    return null
  }
}

/**
 * Slug for a published course id — the old `/courses/[id]` route redirects
 * through this. Non-ObjectId input and unpublished courses resolve to null.
 */
export async function fetchProgramSlug(courseId: string): Promise<string | null> {
  try {
    if (!mongoose.isValidObjectId(courseId)) return null
    await connectDB()
    const course = await Course.findOne({ _id: courseId, status: "published" }).select("slug").lean()
    return course?.slug ?? null
  } catch (error) {
    console.error("Fetch program slug error:", error)
    return null
  }
}
```

- [ ] **Step 4: Review → program slug.** In `lib/actions/reviews.ts`: add `courseSlug: string` to `LandingReview` directly under `courseId: string`; change `.populate("course", "title status")` to `.populate("course", "title status slug")`; add `slug?: string` to the inline `course` cast type (next to `status?: string`); and in the returned object add `courseSlug: course.slug ?? "",` directly under `courseId: course._id.toString(),`.

- [ ] **Step 5: Verify.** Run `npx tsc --noEmit 2>&1 | grep -v '^\.next/'` → prints nothing. Run `npx eslint lib/entitlements.ts lib/actions/student.ts lib/actions/reviews.ts` → clean. Runtime smoke (the helper is `"use server"`, so exercise it through the running app): `curl -s http://localhost:3001/schools/trading-financial-markets | grep -o 'href="/courses/[a-f0-9]*"' | wc -l` still prints `2` (nothing consumes `slug` yet — this only proves the mappers still return rows).

- [ ] **Step 6: Commit.**

```bash
git add lib/entitlements.ts lib/actions/student.ts lib/actions/reviews.ts
git commit -m "feat(programs): program detail fetcher, slug on BrowseCourse, package helpers

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Program page — route, hero, outcomes, What's included, instructor, FAQ

**Files:**
- Create: `components/programs/access.ts`
- Create: `components/programs/program-hero.tsx`
- Create: `components/programs/whats-included.tsx`
- Create: `components/programs/program-instructor.tsx`
- Create: `app/(marketing)/programs/[slug]/page.tsx`

**Interfaces:**
- Consumes: `fetchProgramBySlug`, `ProgramDetail` (Task 1); `checkEnrollment(userId, courseId)` from `@/lib/actions/enrollments` → `{ isEnrolled, status?, resumeLessonId? }`; `getCachedUser()` from `@/lib/auth/cached` → `LocalUser | null` (`user.id`); `courseAvailability` from `@/lib/types/course`; `CourseOutcomes` from `@/components/courses/course-outcomes` (returns null when all three lists are empty); `CourseSchedulingCta` and `AvailabilityCountdown` from `@/components/shared/*`; `WishlistButton` from `@/components/marketing/wishlist-button` (`variant="full"`); `programPriceLabel` from `@/components/marketing/program-row`; `levelChipStyle` from `@/components/shared/level-badge`; `Faq` from `@/components/marketing/faq` (renders `<section id="faq">` with the seven §15 questions); `SCHOOL_BY_SLUG` from `@/lib/schools`; `Avatar`, `AvatarImage`, `AvatarFallback` from `@/components/ui/avatar`.
- Produces: `ProgramAccess` (Task 3 consumes it); the page's section order Hero → Outcomes → **[Task 3 inserts the ladder here]** → What's included → Instructor → FAQ.

- [ ] **Step 1: Access type.** Create `components/programs/access.ts`:

```ts
/**
 * Where this visitor stands with a program — computed once by the page and
 * shared by the hero CTA, every package card and the mobile bar.
 */
export type ProgramAccess =
  | { kind: "enrolled"; continueHref: string }
  /** Published with a future availableAt: nothing can be bought yet. */
  | { kind: "coming_soon" }
  | { kind: "open" }
```

- [ ] **Step 2: Hero.** Create `components/programs/program-hero.tsx` (server component — no `"use client"`):

```tsx
import Link from "next/link"
import Image from "next/image"
import { CalendarClockIcon, ChevronRightIcon, StarIcon } from "lucide-react"
import type { ProgramDetail } from "@/lib/actions/student"
import { SCHOOL_BY_SLUG } from "@/lib/schools"
import { levelChipStyle } from "@/components/shared/level-badge"
import { AvailabilityCountdown } from "@/components/shared/availability-countdown"
import { CourseSchedulingCta } from "@/components/shared/course-scheduling-cta"
import { WishlistButton } from "@/components/marketing/wishlist-button"
import { programPriceLabel } from "@/components/marketing/program-row"
import type { ProgramAccess } from "@/components/programs/access"

/**
 * Spec §6 header: school breadcrumb → title → subtitle line
 * (`shortDescription`, gold) → intro (`description`) → level · price · rating
 * (only with real reviews) · coming-soon countdown. The right column holds
 * the art and the one CTA for this visitor's state.
 */
export function ProgramHero({
  program,
  access,
  scheduling,
  signedIn,
}: {
  program: ProgramDetail
  access: ProgramAccess
  /** Present only while the course is coming soon or the visitor holds a pre-launch reservation. */
  scheduling: { isComingSoon: boolean; isPreEnrolled: boolean } | null
  signedIn: boolean
}) {
  const school = program.school ? SCHOOL_BY_SLUG[program.school] : null
  const linkClass =
    "transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary"

  return (
    <header className="mx-auto max-w-7xl px-6 pt-10 md:pt-16">
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium text-ws-muted"
      >
        <Link href="/schools" className={linkClass}>
          All schools
        </Link>
        {school && (
          <>
            <ChevronRightIcon size={14} aria-hidden className="text-ws-subtle" />
            <Link href={`/schools/${school.slug}`} className={linkClass}>
              {school.name}
            </Link>
          </>
        )}
      </nav>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-16">
        <div className="max-w-3xl">
          <h1
            className="font-display font-semibold leading-[1.05] tracking-[-0.02em] text-ws-primary"
            style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)" }}
          >
            {program.title}
          </h1>
          {program.shortDescription && (
            <p className="mt-4 font-display text-xl font-medium text-ws-gold md:text-2xl">
              {program.shortDescription}
            </p>
          )}
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ws-muted md:text-[17px]">
            {program.description}
          </p>

          <ul className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px]" aria-label="Program details">
            <li>
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-medium capitalize"
                style={levelChipStyle(program.level)}
              >
                {program.level}
              </span>
            </li>
            <li className="font-semibold tabular-nums text-ws-primary">{programPriceLabel(program)}</li>
            {program.ratingCount > 0 && program.rating !== null && (
              <li className="inline-flex items-center gap-1">
                <StarIcon size={13} className="text-ws-rating" fill="currentColor" aria-hidden />
                <span className="font-medium text-ws-primary">{program.rating.toFixed(1)}</span>
                <span className="tabular-nums text-ws-muted">({program.ratingCount})</span>
              </li>
            )}
            {program.totalLessons > 0 && (
              <li className="tabular-nums text-ws-muted">
                {program.totalLessons} {program.totalLessons === 1 ? "lesson" : "lessons"}
              </li>
            )}
            {access.kind === "coming_soon" && program.availableAt && (
              <li className="inline-flex items-center gap-1.5 rounded-full bg-ws-brand/10 px-2.5 py-1 text-[11px] font-semibold text-ws-gold">
                <CalendarClockIcon size={12} aria-hidden />
                Coming soon · <AvailabilityCountdown availableAt={program.availableAt} variant="compact" />
              </li>
            )}
          </ul>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          {program.thumbnailUrl && (
            <div className="relative mb-5 aspect-video overflow-hidden rounded-lg bg-ws-sunken">
              <Image
                src={program.thumbnailUrl}
                alt=""
                fill
                sizes="(max-width: 1024px) 100vw, 24rem"
                className="object-cover"
              />
            </div>
          )}
          <div className="rounded-lg border border-ws-hairline bg-ws-surface p-5">
            {access.kind === "enrolled" ? (
              <Link
                href={access.continueHref}
                className="flex h-11 w-full items-center justify-center rounded-sm bg-ws-brand px-5 text-sm font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"
              >
                Continue learning
              </Link>
            ) : scheduling ? (
              <CourseSchedulingCta
                courseId={program.id}
                availableAt={program.availableAt}
                isComingSoon={scheduling.isComingSoon}
                preEnrollEnabled={program.preEnrollEnabled}
                isPreEnrolled={scheduling.isPreEnrolled}
                isPaid={program.pricing === "paid"}
                price={program.price}
                signedIn={signedIn}
              />
            ) : (
              <div className="flex flex-col gap-3">
                <a
                  href="#packages"
                  className="flex h-11 w-full items-center justify-center rounded-sm bg-ws-brand px-5 text-sm font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"
                >
                  {program.packages.length > 1 ? "Choose your package" : "Enrol now"}
                </a>
                <WishlistButton courseId={program.id} signedIn={signedIn} variant="full" />
              </div>
            )}
          </div>
        </aside>
      </div>
    </header>
  )
}
```

- [ ] **Step 3: What's included.** Create `components/programs/whats-included.tsx` (server):

```tsx
import {
  AwardIcon,
  CircleHelpIcon,
  ClipboardListIcon,
  CompassIcon,
  DownloadIcon,
  HandshakeIcon,
  ListChecksIcon,
  RadioIcon,
  SquarePlayIcon,
  TrendingUpIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"

/** Spec §9 — the eleven inclusions, verbatim and static. */
const INCLUDED: ReadonlyArray<{ label: string; icon: LucideIcon }> = [
  { label: "Structured curriculum", icon: ListChecksIcon },
  { label: "Video lessons", icon: SquarePlayIcon },
  { label: "Live classes", icon: RadioIcon },
  { label: "Practical assignments", icon: ClipboardListIcon },
  { label: "Quizzes & assessments", icon: CircleHelpIcon },
  { label: "Downloadable resources", icon: DownloadIcon },
  { label: "Instructor guidance", icon: CompassIcon },
  { label: "Mentorship", icon: HandshakeIcon },
  { label: "Community access", icon: UsersIcon },
  { label: "Progress tracking", icon: TrendingUpIcon },
  { label: "Certificate upon completion", icon: AwardIcon },
]

export function WhatsIncluded() {
  return (
    <section className="mt-16 border-t border-ws-hairline pt-10" aria-labelledby="included-heading">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ws-gold">What&apos;s included</p>
      <h2
        id="included-heading"
        className="mt-3 font-display text-2xl font-semibold tracking-[-0.015em] text-ws-primary"
      >
        Your learning experience
      </h2>
      <p className="mt-2 text-[15px] text-ws-muted">Depending on the program, students may receive:</p>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {INCLUDED.map(({ label, icon: Icon }) => (
          <li
            key={label}
            className="flex items-center gap-3 rounded-md border border-ws-hairline bg-ws-surface px-4 py-3"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ws-brand/10 text-ws-gold">
              <Icon size={15} aria-hidden />
            </span>
            <span className="text-[14px] font-medium text-ws-primary">{label}</span>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-[13px] italic text-ws-subtle">Specific inclusions vary by program and package.</p>
    </section>
  )
}
```

- [ ] **Step 4: Instructor block.** Create `components/programs/program-instructor.tsx` (server):

```tsx
import Link from "next/link"
import { BadgeCheckIcon, ChevronRightIcon, UsersIcon } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

/**
 * Public instructor block (spec §6 "instructor"). No Message button — that
 * needs a signed-in conversation. The profile link is the dashboard one and
 * therefore only offered to signed-in visitors (it would bounce a guest
 * through the login wall); `/faculty/[username]` arrives in Phase 5.
 */
export function ProgramInstructor({
  id,
  name,
  avatarUrl,
  headline,
  bio,
  totalStudents,
  signedIn,
}: {
  id: string
  name: string
  avatarUrl: string | null
  headline: string | null
  bio: string | null
  totalStudents: number
  signedIn: boolean
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <section className="mt-16 border-t border-ws-hairline pt-10" aria-labelledby="instructor-heading">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ws-gold">Faculty</p>
      <h2
        id="instructor-heading"
        className="mt-3 font-display text-2xl font-semibold tracking-[-0.015em] text-ws-primary"
      >
        About the instructor
      </h2>
      <div className="mt-8 flex max-w-3xl flex-col gap-5 rounded-lg border border-ws-hairline bg-ws-surface p-6 sm:flex-row sm:items-start">
        <Avatar className="h-16 w-16 shrink-0">
          {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
          <AvatarFallback className="bg-ws-brand/10 text-sm font-semibold text-ws-gold">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-display text-lg font-semibold text-ws-primary">
            {name}
            <BadgeCheckIcon size={16} className="shrink-0 text-ws-gold" aria-label="Verified instructor" />
          </p>
          {headline && <p className="mt-0.5 text-[14px] text-ws-muted">{headline}</p>}
          {totalStudents > 0 && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-ws-muted">
              <UsersIcon size={13} aria-hidden />
              <span className="font-medium tabular-nums text-ws-primary">{totalStudents.toLocaleString("en-US")}</span>
              {totalStudents === 1 ? "student" : "students"}
            </p>
          )}
          {bio && <p className="mt-4 text-[15px] leading-relaxed text-ws-muted">{bio}</p>}
          {signedIn && (
            <Link
              href={`/dashboard/instructor/${id}`}
              className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-ws-gold hover:underline"
            >
              View full profile
              <ChevronRightIcon size={14} aria-hidden />
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 5: The route.** Create `app/(marketing)/programs/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next"
import { cache } from "react"
import { notFound } from "next/navigation"
import { fetchProgramBySlug } from "@/lib/actions/student"
import { checkEnrollment } from "@/lib/actions/enrollments"
import { getCachedUser } from "@/lib/auth/cached"
import { courseAvailability } from "@/lib/types/course"
import { ProgramHero } from "@/components/programs/program-hero"
import { CourseOutcomes } from "@/components/courses/course-outcomes"
import { WhatsIncluded } from "@/components/programs/whats-included"
import { ProgramInstructor } from "@/components/programs/program-instructor"
import { Faq } from "@/components/marketing/faq"
import type { ProgramAccess } from "@/components/programs/access"

// Per-visitor: enrollment state and the coming-soon/live cutover both change
// under a cached render.
export const revalidate = 0

type Params = { params: Promise<{ slug: string }> }

// generateMetadata and the page both need the program; dedupe the read.
const getProgram = cache((slug: string) => fetchProgramBySlug(slug))

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const program = await getProgram(slug)
  if (!program) return {}
  return {
    title: program.title,
    description: program.shortDescription ?? program.description.slice(0, 160),
  }
}

/**
 * `/programs/[slug]` — spec §6–§9 in order: hero, what you'll learn, the
 * package ladder (Task 3), what's included, the instructor, the FAQ.
 * Unknown or unpublished slugs 404.
 */
export default async function ProgramPage({ params }: Params) {
  const { slug } = await params
  const program = await getProgram(slug)
  if (!program) notFound()

  const user = await getCachedUser()
  const enrollment = user ? await checkEnrollment(user.id, program.id) : null
  const isEnrolled = enrollment?.isEnrolled ?? false
  const isPreEnrolled = enrollment?.status === "pre_enrolled"
  const isComingSoon =
    courseAvailability({ status: "published", availableAt: program.availableAt }) === "coming_soon"

  // Fall back to the course home when there is nothing to resume into.
  const access: ProgramAccess = isEnrolled
    ? {
        kind: "enrolled",
        continueHref: enrollment?.resumeLessonId
          ? `/dashboard/courses/${program.id}/learn/${enrollment.resumeLessonId}`
          : `/dashboard/courses/${program.id}`,
      }
    : isComingSoon
      ? { kind: "coming_soon" }
      : { kind: "open" }
  const scheduling = !isEnrolled && (isComingSoon || isPreEnrolled) ? { isComingSoon, isPreEnrolled } : null
  const hasOutcomes =
    program.whatYouWillLearn.length + program.requirements.length + program.targetAudience.length > 0

  return (
    <article className="pb-24 md:pb-32">
      <ProgramHero program={program} access={access} scheduling={scheduling} signedIn={Boolean(user)} />
      <div className="mx-auto max-w-7xl px-6">
        {hasOutcomes && (
          <section className="mt-16" aria-label="What you will learn">
            <CourseOutcomes
              whatYouWillLearn={program.whatYouWillLearn}
              requirements={program.requirements}
              targetAudience={program.targetAudience}
            />
          </section>
        )}
        <WhatsIncluded />
        <ProgramInstructor
          id={program.instructorId}
          name={program.instructorName}
          avatarUrl={program.instructorAvatarUrl}
          headline={program.instructorHeadline}
          bio={program.instructorBio}
          totalStudents={program.instructorTotalStudents}
          signedIn={Boolean(user)}
        />
      </div>
      <Faq />
    </article>
  )
}
```

- [ ] **Step 6: Verify.** `npx tsc --noEmit 2>&1 | grep -v '^\.next/'` → nothing. `npx eslint components/programs "app/(marketing)/programs/[slug]/page.tsx"` → clean. Runtime:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/programs/forex-trading-mastery        # 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/programs/not-a-program              # 404
curl -s http://localhost:3001/programs/forex-trading-mastery | grep -o '<title>[^<]*</title>'       # Forex Trading Mastery | WorldStreet Mastery Academy
curl -s http://localhost:3001/programs/forex-trading-mastery | grep -o 'What&#x27;s included\|Your learning experience\|Specific inclusions vary by program and package\.\|About the instructor\|Answers before you ask\.' | sort -u   # all five lines
curl -s http://localhost:3001/programs/forex-trading-mastery | grep -o 'href="/schools/trading-financial-markets"' | wc -l   # ≥1 (breadcrumb)
curl -s -b mock_persona=guest http://localhost:3001/programs/forex-trading-mastery | grep -o 'href="#packages"' | wc -l      # 1 (hero CTA; guest is not enrolled)
curl -s -b mock_persona=guest http://localhost:3001/programs/forex-trading-mastery | grep -o 'View full profile' | wc -l     # 0 (guest gets no dashboard link)
```

Count the outcomes: `curl -s http://localhost:3001/programs/forex-trading-mastery | grep -o 'What you&#x27;ll learn' | wc -l` → `1`.

- [ ] **Step 7: Commit.**

```bash
git add components/programs/access.ts components/programs/program-hero.tsx components/programs/whats-included.tsx components/programs/program-instructor.tsx "app/(marketing)/programs/[slug]/page.tsx"
git commit -m "feat(programs): /programs/[slug] — hero, outcomes, what's included, instructor, FAQ

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Package ladder, per-package CTA, sticky mobile bar

**Files:**
- Create: `components/programs/package-ladder.tsx`
- Create: `components/programs/program-sticky-bar.tsx`
- Modify: `app/(marketing)/programs/[slug]/page.tsx` (two imports, one section, one conditional)

**Interfaces:**
- Consumes: `PublicPackage` (Task 1), `PACKAGE_LABEL` (Task 1), `ProgramAccess` (Task 2), `cn` from `@/lib/utils`.
- Produces: `PackageLadder({ courseId, packages, access })`, `ProgramStickyBar({ fromPrice, multiTier })`; `<section id="packages">` is the in-page anchor the hero and the bar scroll to. Every open-state CTA is `/dashboard/checkout?courseId=<id>&package=<key>`.

- [ ] **Step 1: The ladder.** Create `components/programs/package-ladder.tsx` (server):

```tsx
import Link from "next/link"
import { CheckIcon, StarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PublicPackage } from "@/lib/actions/student"
import { PACKAGE_LABEL } from "@/lib/entitlements"
import type { ProgramAccess } from "@/components/programs/access"

function priceLabel(price: number): string {
  return price === 0 ? "Free" : `$${price.toLocaleString("en-US")}`
}

/** Spec §6 button copy: the package's own label, else "Enrol for $price". */
function ctaLabel(pkg: PublicPackage): string {
  if (pkg.ctaLabel) return pkg.ctaLabel
  return pkg.price === 0 ? "Enrol for free" : `Enrol for ${priceLabel(pkg.price)}`
}

const GRID: Record<number, string> = {
  1: "md:max-w-md",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
}

/**
 * Spec §6 "Choose your learning experience": 1–3 tier cards side by side
 * (stacked on phones). The highlighted tier gets a raised surface, a gold
 * border wash and the "Most popular" chip — never a gold background. Tier key
 * labels (BASIC / STANDARD / EXECUTIVE 101) only make sense against siblings,
 * so a single-tier program shows none.
 */
export function PackageLadder({
  courseId,
  packages,
  access,
}: {
  courseId: string
  packages: PublicPackage[]
  access: ProgramAccess
}) {
  const multiTier = packages.length > 1

  return (
    <section
      id="packages"
      className="mt-16 scroll-mt-24 border-t border-ws-hairline pt-10"
      aria-labelledby="packages-heading"
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ws-gold">Packages</p>
      <h2
        id="packages-heading"
        className="mt-3 font-display text-2xl font-semibold tracking-[-0.015em] text-ws-primary"
      >
        Choose your learning experience
      </h2>

      <ul className={cn("mt-8 grid gap-4", GRID[packages.length] ?? "md:grid-cols-3")}>
        {packages.map((pkg) => (
          <li
            key={pkg.key}
            className={cn(
              "relative flex flex-col rounded-lg border p-6",
              pkg.highlight ? "border-ws-brand/40 bg-ws-raised" : "border-ws-hairline bg-ws-surface"
            )}
          >
            {pkg.highlight && (
              <span className="absolute right-5 top-5 inline-flex items-center gap-1 rounded-full bg-ws-brand/10 px-2.5 py-1 text-[11px] font-semibold text-ws-gold">
                <StarIcon size={12} fill="currentColor" aria-hidden />
                Most popular
              </span>
            )}
            {multiTier && (
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ws-muted">
                {PACKAGE_LABEL[pkg.key]}
              </p>
            )}
            <p className="mt-3 font-display text-4xl font-light tabular-nums tracking-[-0.02em] text-ws-primary">
              {priceLabel(pkg.price)}
            </p>
            <h3 className="mt-2 font-display text-xl font-semibold text-ws-primary">{pkg.name}</h3>
            {pkg.tagline && <p className="mt-1 text-[14px] text-ws-muted">{pkg.tagline}</p>}
            {pkg.features.length > 0 && (
              <ul className="mt-6 space-y-2.5">
                {pkg.features.map((feature, i) => (
                  <li
                    key={`${pkg.key}-${i}`}
                    className="flex items-start gap-2.5 text-[14px] leading-relaxed text-ws-muted"
                  >
                    <CheckIcon size={15} className="mt-0.5 shrink-0 text-ws-gold" aria-hidden />
                    {feature}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-auto pt-8">
              <PackageCta
                courseId={courseId}
                pkg={pkg}
                access={access}
                primary={pkg.highlight || !multiTier}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * One card's action. Enrolled → continue; coming soon → nothing to buy yet
 * (the hero carries the countdown / pre-enrol button); otherwise the checkout
 * link carrying the package key. Guests hit the same link — middleware sends
 * them to sign in with this URL as the return address.
 */
function PackageCta({
  courseId,
  pkg,
  access,
  primary,
}: {
  courseId: string
  pkg: PublicPackage
  access: ProgramAccess
  primary: boolean
}) {
  const base =
    "flex h-11 w-full items-center justify-center rounded-sm px-5 text-sm font-semibold transition-opacity duration-[var(--ws-motion-fast)]"

  if (access.kind === "enrolled") {
    return (
      <Link href={access.continueHref} className={cn(base, "bg-ws-brand text-ws-brand-on hover:opacity-90")}>
        Continue learning
      </Link>
    )
  }
  if (access.kind === "coming_soon") {
    return <p className={cn(base, "bg-ws-chip text-ws-muted")}>Available at launch</p>
  }
  return (
    <Link
      href={`/dashboard/checkout?courseId=${courseId}&package=${pkg.key}`}
      className={cn(
        base,
        primary
          ? "bg-ws-brand text-ws-brand-on hover:opacity-90"
          : "border border-ws-hairline text-ws-primary transition-colors hover:border-ws-brand/40"
      )}
    >
      {ctaLabel(pkg)}
    </Link>
  )
}
```

- [ ] **Step 2: Sticky mobile bar.** Create `components/programs/program-sticky-bar.tsx` (server):

```tsx
/**
 * Phone-only bar pinned to the bottom of the program page: the cheapest
 * price and a jump to the ladder. Rendered only while there is something to
 * buy (access "open"); marketing pages have no bottom nav to collide with.
 */
export function ProgramStickyBar({ fromPrice, multiTier }: { fromPrice: number; multiTier: boolean }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ws-hairline bg-ws-surface px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 md:hidden">
      <div className="flex items-center justify-between gap-4">
        <p className="flex items-baseline gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-ws-muted">
            {multiTier ? "From" : "Price"}
          </span>
          <span className="font-display text-xl font-semibold tabular-nums text-ws-primary">
            {fromPrice === 0 ? "Free" : `$${fromPrice.toLocaleString("en-US")}`}
          </span>
        </p>
        <a
          href="#packages"
          className="inline-flex h-11 items-center justify-center rounded-full bg-ws-brand px-6 text-sm font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"
        >
          {multiTier ? "Choose package" : "Enrol now"}
        </a>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Wire into the page.** In `app/(marketing)/programs/[slug]/page.tsx` add the imports:

```tsx
import { PackageLadder } from "@/components/programs/package-ladder"
import { ProgramStickyBar } from "@/components/programs/program-sticky-bar"
```

Insert directly after the `{hasOutcomes && (…)}` block (before `<WhatsIncluded />`):

```tsx
        <PackageLadder courseId={program.id} packages={program.packages} access={access} />
```

and directly before the closing `</article>`:

```tsx
      {access.kind === "open" && (
        <ProgramStickyBar
          fromPrice={Math.min(...program.packages.map((p) => p.price))}
          multiTier={program.packages.length > 1}
        />
      )}
```

- [ ] **Step 4: Verify.** tsc + eslint on the three files. Runtime:

```bash
P=http://localhost:3001/programs
curl -s $P/forex-trading-mastery | grep -o 'Choose your learning experience' | wc -l                                  # 1
curl -s $P/forex-trading-mastery | grep -o 'href="/dashboard/checkout?courseId=[a-f0-9]*&amp;package=[a-z]*"' | sort -u   # exactly 3 lines: package=basic, package=standard, package=executive
curl -s $P/forex-trading-mastery | grep -o 'Most popular' | wc -l                                                    # 1
curl -s $P/forex-trading-mastery | grep -o '>Basic<\|>Standard<\|>Executive 101<' | sort -u                          # the three tier labels
curl -s $P/forex-trading-mastery | grep -o 'Enrol for \$49\|Enrol for \$199\|Enrol for \$999' | sort -u              # $49 and $199 present; $999 present unless that package carries its own ctaLabel (then that label is present instead)
curl -s $P/ai-ai-automation | grep -o 'package=[a-z]*"' | sort -u                                                     # exactly 1 line
curl -s $P/ai-ai-automation | grep -o '>Standard<' | wc -l                                                           # 0 (single tier shows no key label)
curl -s $P/bitcoin-cryptocurrency-fundamentals | grep -o 'Full program\|Enrol for free' | sort -u                     # both (synthesized tier at price 0)
curl -s -b mock_persona=guest $P/forex-trading-mastery | grep -o 'Choose package' | wc -l                             # 1 (sticky bar)
curl -s -o /dev/null -b mock_persona=guest -w "%{http_code} %{redirect_url}\n" "http://localhost:3001/dashboard/checkout?courseId=x&package=basic"   # 307 to the hub login whose redirect param contains dashboard%2Fcheckout%3FcourseId%3Dx%26package%3Dbasic
```

- [ ] **Step 5: Commit.**

```bash
git add components/programs/package-ladder.tsx components/programs/program-sticky-bar.tsx "app/(marketing)/programs/[slug]/page.tsx"
git commit -m "feat(programs): package ladder with per-package checkout CTAs and mobile bar

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: `/programs` catalogue grouped by school, `/courses*` redirects, every public link repointed

**Files:**
- Create: `app/(marketing)/programs/page.tsx`
- Modify (replace body): `app/(marketing)/courses/page.tsx`
- Modify (replace body): `app/(marketing)/courses/[courseId]/page.tsx`
- Modify: `components/marketing/course-card.tsx:81`, `components/marketing/program-row.tsx` (line 36 + the doc comment above `ProgramRow`), `components/marketing/upcoming-drops.tsx:57`, `components/marketing/reviews-finale.tsx:172`, `components/marketing/navbar.tsx:17`, `components/marketing/footer.tsx:29`, `components/marketing/catalogue-rail.tsx:88,114`, `middleware.ts:20`

**Interfaces:**
- Consumes: `BrowseCourse.slug`, `fetchProgramSlug` (Task 1); `LandingReview.courseSlug` (Task 1); `SCHOOLS` (has `order`, `slug`, `name`, `icon`) from `@/lib/schools`; `MarketingCourseCard({ course, signedIn })` (client) from `@/components/marketing/course-card`; `SchoolIcon` from `@/components/shared/school-icon`; `getCachedUser`.
- Produces: `/programs` (metadata title "Programs"), `/courses` → 308 `/programs`, `/courses/:id` → 308 `/programs/:slug` (404 for unknown/unpublished ids).

- [ ] **Step 1: The catalogue.** Create `app/(marketing)/programs/page.tsx`:

```tsx
import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import { SCHOOLS, type SchoolSlug } from "@/lib/schools"
import { BRAND } from "@/lib/brand"
import { fetchBrowseCourses, type BrowseCourse } from "@/lib/actions/student"
import { getCachedUser } from "@/lib/auth/cached"
import { MarketingCourseCard } from "@/components/marketing/course-card"
import { SchoolIcon } from "@/components/shared/school-icon"

export const metadata: Metadata = {
  title: "Programs",
  description: `Browse every program across the eight schools of ${BRAND.name}.`,
}

// Published/coming-soon state changes under a cached render.
export const revalidate = 0

/**
 * `/programs` — the whole catalogue, grouped by school in school order
 * (spec §4/§17). Schools with no published program are hidden; published
 * courses not yet assigned to a school (legacy rows) land in a trailing
 * "More programs" group so nothing published disappears.
 */
export default async function ProgramsPage() {
  const [user, courses] = await Promise.all([getCachedUser(), fetchBrowseCourses()])
  const signedIn = Boolean(user)

  const bySchool = new Map<SchoolSlug | null, BrowseCourse[]>()
  for (const course of courses) {
    const list = bySchool.get(course.school) ?? []
    list.push(course)
    bySchool.set(course.school, list)
  }
  const groups = [...SCHOOLS]
    .sort((a, b) => a.order - b.order)
    .map((school) => ({ school, courses: bySchool.get(school.slug) ?? [] }))
    .filter((group) => group.courses.length > 0)
  const unassigned = bySchool.get(null) ?? []

  return (
    <div className="mx-auto max-w-7xl px-6 pb-24 pt-10 md:pb-32 md:pt-16">
      <header className="max-w-3xl">
        <h1
          className="font-display font-semibold leading-[1.05] tracking-[-0.02em] text-ws-primary"
          style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)" }}
        >
          All programs
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ws-muted md:text-[17px]">
          Browse every program across the eight schools of {BRAND.name}.
        </p>
        <p className="mt-3 text-[13px] tabular-nums text-ws-subtle">
          {courses.length === 1 ? "1 program" : `${courses.length} programs`}
        </p>
      </header>

      {groups.map(({ school, courses: programs }) => (
        <section
          key={school.slug}
          className="mt-16 border-t border-ws-hairline pt-10"
          aria-labelledby={`school-${school.slug}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              id={`school-${school.slug}`}
              className="flex items-center gap-3 font-display text-2xl font-semibold tracking-[-0.015em] text-ws-primary"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ws-brand/10 text-ws-gold">
                <SchoolIcon name={school.icon} size={17} />
              </span>
              {school.name}
            </h2>
            <Link
              href={`/schools/${school.slug}`}
              className="inline-flex items-center gap-1 text-[13px] font-semibold text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-gold"
            >
              About this school
              <ArrowRightIcon size={14} aria-hidden />
            </Link>
          </div>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {programs.map((course) => (
              <li key={course.id}>
                <MarketingCourseCard course={course} signedIn={signedIn} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {unassigned.length > 0 && (
        <section className="mt-16 border-t border-ws-hairline pt-10" aria-labelledby="school-more">
          <h2 id="school-more" className="font-display text-2xl font-semibold tracking-[-0.015em] text-ws-primary">
            More programs
          </h2>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {unassigned.map((course) => (
              <li key={course.id}>
                <MarketingCourseCard course={course} signedIn={signedIn} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {courses.length === 0 && (
        <div className="mt-16 rounded-lg border border-dashed border-ws-hairline p-10 text-center">
          <p className="font-display text-lg font-semibold text-ws-primary">Programs coming soon</p>
          <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-ws-muted">
            The first programs are being prepared. Explore the schools in the meantime.
          </p>
          <Link
            href="/schools"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-sm border border-ws-hairline px-6 text-[14px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:border-ws-brand/40 hover:text-ws-gold"
          >
            Explore the schools
          </Link>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Redirect pages.** Replace the ENTIRE contents of `app/(marketing)/courses/page.tsx` with:

```tsx
import { permanentRedirect } from "next/navigation"

/** `/courses` moved to `/programs` (Phase 2). Kept as a route so old links and bookmarks land. */
export default function CoursesRedirect() {
  return permanentRedirect("/programs")
}
```

Replace the ENTIRE contents of `app/(marketing)/courses/[courseId]/page.tsx` with:

```tsx
import { notFound, permanentRedirect } from "next/navigation"
import { fetchProgramSlug } from "@/lib/actions/student"

// The slug lookup must see the current published state.
export const revalidate = 0

/**
 * `/courses/[id]` moved to `/programs/[slug]` (Phase 2). Old links, the
 * `revalidatePath` calls in enrollments/reviews and any bookmark keep
 * resolving; unknown or unpublished ids 404 as before.
 */
export default async function CourseRedirect({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params
  const slug = await fetchProgramSlug(courseId)
  if (!slug) notFound()
  return permanentRedirect(`/programs/${slug}`)
}
```

- [ ] **Step 3: Repoint every public link.** Exact edits:
  - `components/marketing/course-card.tsx` line 81: `href={\`/courses/${course.id}\`}` → `href={\`/programs/${course.slug}\`}`.
  - `components/marketing/program-row.tsx` line 36: same replacement; and in the doc comment above `ProgramRow` replace the sentence `Links to the existing\n * course page until Phase 2 ships \`/programs/[slug]\`.` with `Links to the program page.`
  - `components/marketing/upcoming-drops.tsx` line 57: same replacement.
  - `components/marketing/reviews-finale.tsx` line 172: `href={\`/courses/${review.courseId}\`}` → `href={\`/programs/${review.courseSlug}\`}`.
  - `components/marketing/navbar.tsx` line 17: `{ href: "/courses", label: "Programs" }` → `{ href: "/programs", label: "Programs" }`.
  - `components/marketing/footer.tsx` line 29: `href="/courses"` → `href="/programs"`.
  - `components/marketing/catalogue-rail.tsx` lines 88 and 114: `href="/courses"` → `href="/programs"` (both).
  - `middleware.ts` line 20 (local-dev branch only): `loginUrl.searchParams.set("redirect_url", pathname)` → `loginUrl.searchParams.set("redirect_url", \`${pathname}${request.nextUrl.search}\`)` so a `pk_test_` developer also returns to checkout with `courseId` and `package` intact (the production branch already carries the search).

- [ ] **Step 4: Verify.** tsc + eslint on every touched file. Runtime:

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3001/courses                 # 308 http://localhost:3001/programs
ID=$(curl -s http://localhost:3001/schools/trading-financial-markets | grep -o 'href="/programs/[a-z0-9-]*"' | head -1)   # sanity: school rows now link to /programs/<slug>
echo "$ID"
# find a real id for the redirect check (mock DB, run from the repo root):
FOREX=$(node --input-type=module -e 'import m from "mongoose"; await m.connect("mongodb://127.0.0.1:27017/worldstreet-academy"); const c = await m.connection.db.collection("courses").findOne({ slug: "forex-trading-mastery" }); console.log(String(c._id)); await m.disconnect()')
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3001/courses/$FOREX          # 308 http://localhost:3001/programs/forex-trading-mastery
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/courses/000000000000000000000000        # 404
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/courses/not-an-id                       # 404
curl -s http://localhost:3001/programs | grep -o 'id="school-[a-z0-9-]*"' | sort -u                     # trading-financial-markets, blockchain-web3, ai-automation, …, plus school-more (legacy rows)
curl -s http://localhost:3001/programs | grep -o 'href="/programs/[a-z0-9-]*"' | sort -u | wc -l        # ≥ 10
curl -s http://localhost:3001/ | grep -o 'href="/courses[^"]*"' | wc -l                                 # 0
curl -s http://localhost:3001/programs | grep -o 'href="/courses[^"]*"' | wc -l                        # 0
grep -rn '"/courses\|`/courses/\${' components app --include=*.tsx | grep -v 'dashboard/courses\|instructor/courses\|admin/courses'   # prints nothing
```

- [ ] **Step 5: Commit.**

```bash
git add "app/(marketing)/programs/page.tsx" "app/(marketing)/courses/page.tsx" "app/(marketing)/courses/[courseId]/page.tsx" components/marketing/course-card.tsx components/marketing/program-row.tsx components/marketing/upcoming-drops.tsx components/marketing/reviews-finale.tsx components/marketing/navbar.tsx components/marketing/footer.tsx components/marketing/catalogue-rail.tsx middleware.ts
git commit -m "feat(programs): /programs catalogue by school; /courses* redirect; public links → /programs/[slug]

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Packages editor (instructor + admin)

**Files:**
- Create: `components/instructor/package-editor.tsx`
- Modify: `components/instructor/course-editor.tsx` (imports ≈ lines 1–45; `EditableCourse` at line 47; state block ≈ line 169; hidden inputs at lines 278–279; new section after the Availability block ≈ line 557; the Pricing section at lines 559–603)
- Modify: `lib/actions/instructor.ts` (`fetchCourseForEdit` return at lines 208–224)
- Modify: `app/(instructor)/instructor/courses/[courseId]/edit/page.tsx` (the `course` object), `app/(admin)/admin/courses/[courseId]/edit/page.tsx` (passes `data.course` straight through — verify only)

**Interfaces:**
- Consumes: `ICoursePackage`, `IPackageEntitlements`, `PackageKey` from `@/lib/db/models` (type-only); `PACKAGE_KEYS`, `PACKAGE_LABEL` (Task 1); the existing `parsePackages` in `lib/actions/instructor.ts` (reads the `packages` form field as JSON; `fieldErrors.packages` on failure; when the field is present, `pricingFromPackages` derives the scalar `pricing`/`price` from the cheapest ENABLED tier); `Switch`/`Checkbox` (`checked`, `onCheckedChange`), `Select` (`value`, `onValueChange(v: string | null)`).
- Produces: `EditorPackage`, `PackageEditor`, `toEditorPackage`, `toCoursePackage`, `emptyPackage`, `ladderPrice`; `fetchCourseForEdit().course.packages: ICoursePackage[]`; `EditableCourse.packages?: ICoursePackage[]`. The editor ALWAYS posts `packages` (possibly `[]`), so the editor is now the source of truth for a course's ladder.

- [ ] **Step 1: The package editor.** Create `components/instructor/package-editor.tsx`:

```tsx
"use client"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ICoursePackage, IPackageEntitlements, PackageKey } from "@/lib/db/models"
import { PACKAGE_KEYS, PACKAGE_LABEL } from "@/lib/entitlements"
import { PlusIcon, Trash2Icon } from "lucide-react"

/**
 * Editor-side row for one package. Mirrors ICoursePackage except that
 * `features` is edited as one textarea (a line per feature) and `price` is
 * the raw input string; `toCoursePackage` converts back before submit.
 * `uid` is the React key (the tier key can be changed in place).
 */
export type EditorPackage = {
  uid: string
  key: PackageKey
  name: string
  tagline: string
  price: string
  featuresText: string
  highlight: boolean
  ctaLabel: string
  enabled: boolean
  entitlements: IPackageEntitlements
}

const NO_ENTITLEMENTS: IPackageEntitlements = {
  liveClasses: false,
  instructorQa: false,
  assignments: false,
  certificate: false,
  mentorship: false,
  prioritySupport: false,
}

const ENTITLEMENT_LABELS: ReadonlyArray<{ key: keyof IPackageEntitlements; label: string }> = [
  { key: "liveClasses", label: "Live classes" },
  { key: "instructorQa", label: "Instructor Q&A" },
  { key: "assignments", label: "Practical assignments" },
  { key: "certificate", label: "Certificate" },
  { key: "mentorship", label: "Mentorship" },
  { key: "prioritySupport", label: "Priority support" },
]

/** Existing rows key on the tier (unique per course) so server and client render the same keys. */
export function toEditorPackage(p: ICoursePackage): EditorPackage {
  return {
    uid: p.key,
    key: p.key,
    name: p.name,
    tagline: p.tagline ?? "",
    price: String(p.price),
    featuresText: (p.features ?? []).join("\n"),
    highlight: Boolean(p.highlight),
    ctaLabel: p.ctaLabel ?? "",
    enabled: p.enabled !== false,
    entitlements: { ...NO_ENTITLEMENTS, ...p.entitlements },
  }
}

export function toCoursePackage(p: EditorPackage): ICoursePackage {
  const ctaLabel = p.ctaLabel.trim()
  return {
    key: p.key,
    name: p.name.trim(),
    tagline: p.tagline.trim(),
    price: Math.max(0, Math.round(Number(p.price) || 0)),
    features: p.featuresText
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean),
    highlight: p.highlight,
    ctaLabel: ctaLabel === "" ? null : ctaLabel,
    enabled: p.enabled,
    entitlements: { ...p.entitlements },
  }
}

export function emptyPackage(key: PackageKey): EditorPackage {
  return {
    uid: crypto.randomUUID(),
    key,
    name: "",
    tagline: "",
    price: "",
    featuresText: "",
    highlight: false,
    ctaLabel: "",
    enabled: true,
    entitlements: { ...NO_ENTITLEMENTS },
  }
}

/** Cheapest ENABLED tier in whole dollars, or null when no tier is enabled (the course then sells at its own price). */
export function ladderPrice(packages: EditorPackage[]): number | null {
  const enabled = packages.filter((p) => p.enabled)
  if (enabled.length === 0) return null
  return Math.min(...enabled.map((p) => toCoursePackage(p).price))
}

/**
 * Up to three tiers keyed basic / standard / executive. Controlled: the
 * course editor owns the array and serializes it into the `packages` hidden
 * field. Server rules mirrored here for a good first try — unique keys (used
 * keys are disabled in the select), at most one highlight (turning one on
 * turns the others off) — the server (`parsePackages`) remains the authority.
 */
export function PackageEditor({
  value,
  onChange,
  error,
}: {
  value: EditorPackage[]
  onChange: (next: EditorPackage[]) => void
  error?: string
}) {
  const used = new Set(value.map((p) => p.key))
  const nextKey = PACKAGE_KEYS.find((k) => !used.has(k)) ?? null

  function patch(uid: string, changes: Partial<EditorPackage>) {
    onChange(value.map((p) => (p.uid === uid ? { ...p, ...changes } : p)))
  }
  function setHighlight(uid: string, on: boolean) {
    onChange(value.map((p) => ({ ...p, highlight: p.uid === uid ? on : on ? false : p.highlight })))
  }
  function setEntitlement(uid: string, key: keyof IPackageEntitlements, on: boolean) {
    onChange(
      value.map((p) => (p.uid === uid ? { ...p, entitlements: { ...p.entitlements, [key]: on } } : p))
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-muted-foreground">
        Up to three tiers — Basic, Standard and Executive 101. While any tier is enabled the
        course sells from the cheapest enabled tier and the Pricing section below follows it.
      </p>

      {value.map((pkg) => (
        <div key={pkg.uid} className="space-y-3 rounded-md border p-3">
          <div className="flex items-center gap-2">
            <Select
              value={pkg.key}
              onValueChange={(v) => {
                if (v) patch(pkg.uid, { key: v as PackageKey })
              }}
            >
              <SelectTrigger className="w-[9.5rem]" aria-label="Package tier">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PACKAGE_KEYS.map((k) => (
                  <SelectItem key={k} value={k} disabled={k !== pkg.key && used.has(k)}>
                    {PACKAGE_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
              <Switch
                checked={pkg.enabled}
                onCheckedChange={(v) => patch(pkg.uid, { enabled: Boolean(v) })}
                aria-label="Package enabled"
              />
              {pkg.enabled ? "Enabled" : "Disabled"}
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              aria-label={`Remove ${PACKAGE_LABEL[pkg.key]} package`}
              onClick={() => onChange(value.filter((p) => p.uid !== pkg.uid))}
            >
              <Trash2Icon size={14} />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`pkg-name-${pkg.uid}`}>Name</Label>
              <Input
                id={`pkg-name-${pkg.uid}`}
                placeholder="Forex Foundation"
                maxLength={60}
                value={pkg.name}
                onChange={(e) => patch(pkg.uid, { name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`pkg-price-${pkg.uid}`}>Price (USD)</Label>
              <Input
                id={`pkg-price-${pkg.uid}`}
                type="number"
                min="0"
                step="1"
                placeholder="49"
                value={pkg.price}
                onChange={(e) => patch(pkg.uid, { price: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`pkg-tagline-${pkg.uid}`}>Tagline</Label>
            <Input
              id={`pkg-tagline-${pkg.uid}`}
              placeholder="Perfect for beginners"
              maxLength={120}
              value={pkg.tagline}
              onChange={(e) => patch(pkg.uid, { tagline: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`pkg-features-${pkg.uid}`}>
              Features <span className="font-normal text-muted-foreground">— one per line, up to 20</span>
            </Label>
            <Textarea
              id={`pkg-features-${pkg.uid}`}
              className="min-h-24"
              placeholder={"Forex fundamentals\nCurrency pairs"}
              value={pkg.featuresText}
              onChange={(e) => patch(pkg.uid, { featuresText: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`pkg-cta-${pkg.uid}`}>
              Button label{" "}
              <span className="font-normal text-muted-foreground">— optional, defaults to “Enrol for $price”</span>
            </Label>
            <Input
              id={`pkg-cta-${pkg.uid}`}
              placeholder="Apply / Enrol for $999"
              maxLength={40}
              value={pkg.ctaLabel}
              onChange={(e) => patch(pkg.uid, { ctaLabel: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Most popular</p>
              <p className="text-[10px] text-muted-foreground">
                Highlights this tier on the program page. One per course.
              </p>
            </div>
            <Switch
              checked={pkg.highlight}
              onCheckedChange={(v) => setHighlight(pkg.uid, Boolean(v))}
              aria-label="Most popular"
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-[11px] font-medium uppercase tracking-wider text-ws-muted">Includes</legend>
            <div className="grid grid-cols-2 gap-2">
              {ENTITLEMENT_LABELS.map(({ key, label }) => (
                <label key={key} className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    checked={pkg.entitlements[key]}
                    onCheckedChange={(v) => setEntitlement(pkg.uid, key, Boolean(v))}
                  />
                  <span className="text-[12px]">{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        className="w-full border-dashed"
        disabled={nextKey === null}
        onClick={() => {
          if (nextKey) onChange([...value, emptyPackage(nextKey)])
        }}
      >
        <PlusIcon size={14} />
        {nextKey ? `Add ${PACKAGE_LABEL[nextKey]} package` : "All three tiers added"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Course editor wiring.** In `components/instructor/course-editor.tsx`:
  1. Add imports (next to the `SCHOOLS` import):
     ```tsx
     import type { ICoursePackage } from "@/lib/db/models"
     import {
       PackageEditor,
       ladderPrice,
       toCoursePackage,
       toEditorPackage,
       type EditorPackage,
     } from "@/components/instructor/package-editor"
     ```
  2. Add to `EditableCourse` after `preEnrollEnabled?: boolean`:
     ```tsx
       packages?: ICoursePackage[]
     ```
  3. After `const [preEnrollEnabled, setPreEnrollEnabled] = …` add:
     ```tsx
       const [packages, setPackages] = useState<EditorPackage[]>(
         (course?.packages ?? []).map(toEditorPackage)
       )
       // With a ladder, the course's scalar pricing is the cheapest enabled
       // tier (the server derives the same in updateCourse/createCourse); the
       // hidden fields mirror that so the server's price check keeps passing.
       const derivedPrice = ladderPrice(packages)
       const effectivePricing = derivedPrice === null ? pricing : derivedPrice > 0 ? "paid" : "free"
       const effectivePrice = derivedPrice === null ? price : String(derivedPrice)
     ```
  4. Change the two hidden inputs `name="pricing"` / `name="price"` to `value={effectivePricing}` / `value={effectivePrice}`, and add directly under them:
     ```tsx
                 <input type="hidden" name="packages" value={JSON.stringify(packages.map(toCoursePackage))} />
     ```
  5. Directly before `<SectionDivider label="Pricing" />` insert:
     ```tsx
               <SectionDivider label="Packages" />

               <PackageEditor value={packages} onChange={setPackages} error={state.fieldErrors.packages} />

     ```
  6. Wrap the Pricing section body: replace the existing `<div className="space-y-3">` that starts right after `<SectionDivider label="Pricing" />` (the one holding the free/paid `Select` and the price input) so it becomes
     ```tsx
               {derivedPrice !== null ? (
                 <p className="rounded-md border p-3 text-[11px] text-muted-foreground">
                   Set by packages: this course sells {derivedPrice > 0 ? `from $${derivedPrice}` : "free"} — the
                   cheapest enabled tier. Disable every tier to price the course directly.
                 </p>
               ) : (
                 <div className="space-y-3">
                   … the existing Select + price Input, unchanged …
                 </div>
               )}
     ```

- [ ] **Step 3: Load packages into the editor.** In `lib/actions/instructor.ts` `fetchCourseForEdit`, add to the returned `course` object after `preEnrollEnabled: course.preEnrollEnabled ?? true,`:

```ts
        packages: (course.packages ?? []).map(
          (p): ICoursePackage => ({
            key: p.key,
            name: p.name,
            tagline: p.tagline ?? "",
            price: p.price,
            features: p.features ?? [],
            highlight: Boolean(p.highlight),
            ctaLabel: p.ctaLabel ?? null,
            enabled: p.enabled !== false,
            entitlements: {
              liveClasses: Boolean(p.entitlements?.liveClasses),
              instructorQa: Boolean(p.entitlements?.instructorQa),
              assignments: Boolean(p.entitlements?.assignments),
              certificate: Boolean(p.entitlements?.certificate),
              mentorship: Boolean(p.entitlements?.mentorship),
              prioritySupport: Boolean(p.entitlements?.prioritySupport),
            },
          })
        ),
```

(`ICoursePackage` is already imported there.) In `app/(instructor)/instructor/courses/[courseId]/edit/page.tsx` add `packages: data.course.packages,` to the `course` object after `preEnrollEnabled`. The admin page passes `data.course` through unchanged — confirm it compiles.

- [ ] **Step 4: Verify.** tsc + eslint on all touched files. Then the round trip. Create `.superpowers/sdd/mastery-phase-2/edit-roundtrip.mjs` (git-ignored workspace; run it from the repo root with `node .superpowers/sdd/mastery-phase-2/edit-roundtrip.mjs`):

```js
// Round-trips the LIVE updateCourse action through the admin editor page's own
// <form> (React progressive-enhancement POST): re-posts every hidden field the
// page rendered, with one package tagline changed, then reads it back from the
// editor and from the public program page.
import mongoose from "mongoose"
const BASE = "http://localhost:3001"
const COOKIE = "mock_persona=admin"
const unesc = (s) => s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")

await mongoose.connect("mongodb://127.0.0.1:27017/worldstreet-academy")
const course = await mongoose.connection.db.collection("courses").findOne({ slug: "forex-trading-mastery" })
await mongoose.disconnect()
const PAGE = `${BASE}/admin/courses/${course._id}/edit`

async function hiddenFields() {
  const html = await (await fetch(PAGE, { headers: { cookie: COOKIE } })).text()
  const fields = []
  for (const m of html.matchAll(/<input\b[^>]*>/g)) {
    const tag = m[0]
    if (!/type="hidden"/.test(tag)) continue
    const name = tag.match(/name="([^"]+)"/)?.[1]
    if (name) fields.push([name, unesc(tag.match(/value="([^"]*)"/)?.[1] ?? "")])
  }
  return fields
}

const before = await hiddenFields()
const pkgField = before.find(([k]) => k === "packages")
if (!pkgField) throw new Error("editor did not render a packages hidden field")
const packages = JSON.parse(pkgField[1])
console.log("editor loaded packages:", packages.map((p) => `${p.key}:$${p.price}${p.highlight ? "*" : ""}`).join(" "))

const stamp = `Round-trip ${Date.now().toString(36)}`
packages[0].tagline = stamp
const fd = new FormData()
for (const [k, v] of before) fd.append(k, k === "packages" ? JSON.stringify(packages) : v)
const r = await fetch(PAGE, { method: "POST", headers: { cookie: COOKIE, accept: "text/x-component" }, body: fd, redirect: "manual" })
console.log(`POST ${r.status}; x-action-redirect: ${r.headers.get("x-action-redirect") ?? "-"}`)

const after = await hiddenFields()
const saved = JSON.parse(after.find(([k]) => k === "packages")[1])
console.log("editor reloaded tagline[0]:", saved[0].tagline, saved[0].tagline === stamp ? "OK" : "MISMATCH")
console.log("editor price field:", after.find(([k]) => k === "price")?.[1], "pricing:", after.find(([k]) => k === "pricing")?.[1])
const pub = await (await fetch(`${BASE}/programs/forex-trading-mastery`)).text()
console.log("program page shows tagline:", pub.includes(stamp) ? "OK" : "MISSING")
```

Expected output: three packages loaded (`basic:$49 standard:$199* executive:$999`), `POST 200` with an `x-action-redirect` to `/admin/courses`, `OK`, price `49` / pricing `paid`, and `OK` on the program page. Also confirm the section renders: `curl -s -b mock_persona=admin http://localhost:3001/admin/courses/<id>/edit | grep -o 'Packages\|Add Executive 101 package\|All three tiers added' | sort -u` shows `Packages` and `All three tiers added` (Forex already has all three). Then confirm the server still rejects a bad ladder: re-run the harness once with `packages[1].key = "basic"` (duplicate key) — the response body contains `Package keys must be unique` and the editor's reloaded tagline is unchanged. Remove that experiment afterwards; the harness must leave the tagline stamp as its only change (say so in the report).

- [ ] **Step 5: Commit.**

```bash
git add components/instructor/package-editor.tsx components/instructor/course-editor.tsx lib/actions/instructor.ts "app/(instructor)/instructor/courses/[courseId]/edit/page.tsx"
git commit -m "feat(editor): packages section — up to three tiers with entitlements, price derived from the ladder

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Lesson minimum package — editor lesson form, lesson manager, save paths

**Files:**
- Modify: `lib/types/course.ts` (`Lesson` type at lines 68–80)
- Modify: `lib/actions/lessons.ts` (`CreateLessonSchema` at line 13; `LessonListItem` at line 29; both mappers in `getCourseLessons` / `getPublishedLessons`)
- Modify: `lib/actions/instructor.ts` (`fetchCourseForEdit` lessons mapper ≈ line 226; the `insertMany` blocks in `createCourse` ≈ line 316 and `updateCourse` ≈ line 470; `addLesson` at lines 580–650; new `setLessonMinPackage` after `addLesson`)
- Modify: `components/instructor/course-editor.tsx` (`EditorLesson` at line 111; `emptyLesson` at line 135; lessons `useState` initializer at line 212; the lesson form after the `{/* Type + Duration */}` grid ≈ line 770)
- Modify: `components/instructor/lesson-manager.tsx`
- Modify: `app/(instructor)/instructor/courses/[courseId]/lessons/page.tsx`, `app/(instructor)/instructor/courses/[courseId]/edit/page.tsx`, `app/(admin)/admin/courses/[courseId]/edit/page.tsx` (each lesson mapper gains `minPackageKey`)

**Interfaces:**
- Consumes: `Lesson.minPackageKey: PackageKey | null` (Phase 0 schema; `null` = every tier and every legacy enrolment); `isPackageKey`, `PACKAGE_LABEL` (Task 1); `getAuthenticatedInstructor()` and `courseScope()` in `lib/actions/instructor.ts`.
- Produces: `Lesson.minPackageKey?: PackageKey | null` (`lib/types`); `LessonListItem.minPackageKey: PackageKey | null`; `setLessonMinPackage(courseId, lessonId, minPackageKey): Promise<{ success: boolean; error: string | null }>`; the editor's `lessons` JSON entries carry `minPackageKey: "" | PackageKey`; `addLesson` reads a `minPackageKey` form field.

- [ ] **Step 1: Types.** In `lib/types/course.ts` add `import type { PackageKey } from "@/lib/db/models/course"` under the existing `SchoolSlug` import, and add to the `Lesson` type after `isFree: boolean`:

```ts
  /** Lowest package that can open this lesson; null/undefined = every tier. */
  minPackageKey?: PackageKey | null
```

In `lib/actions/lessons.ts`: change the models import to `import { Course, Lesson, ILesson, type PackageKey } from "@/lib/db/models"`; add to `CreateLessonSchema` after `liveScheduledAt`:

```ts
  minPackageKey: z.enum(["basic", "standard", "executive"]).nullable().optional(),
```

add `minPackageKey: PackageKey | null` to `LessonListItem` after `isFree: boolean`, and `minPackageKey: lesson.minPackageKey ?? null,` to BOTH mappers (`getCourseLessons`, `getPublishedLessons`) after `isFree: lesson.isFree,`.

- [ ] **Step 2: Save paths in `lib/actions/instructor.ts`.**
  1. Change the entitlements import to `import { isPackageKey, pricingFromPackages } from "@/lib/entitlements"`.
  2. `fetchCourseForEdit` lessons mapper: add `minPackageKey: l.minPackageKey ?? null,` after `isFree: l.isFree,`.
  3. In BOTH `insertMany` calls (`createCourse` and `updateCourse`): extend the inline lesson type with `minPackageKey?: string | null` (after `isFree?: boolean`), and add to the mapped document after `isFree: l.isFree || false,`:
     ```ts
                   minPackageKey: isPackageKey(l.minPackageKey) ? l.minPackageKey : null,
     ```
  4. `addLesson`: after `const isFree = …` add `const minPackageKeyRaw = formData.get("minPackageKey")` and `const minPackageKey = isPackageKey(minPackageKeyRaw) ? minPackageKeyRaw : null`; add `minPackageKey,` to the `Lesson.create({ … })` document after `isFree,`.
  5. Insert after the closing `}` of `addLesson` (before `// ---- Delete Lesson ----`):

```ts
// ---- Lesson minimum package ----
/**
 * Sets the lowest tier that can open a lesson (null = everyone). Called from
 * the lesson manager's per-row select; ownership-scoped like the other
 * lesson mutations (admins may edit any course).
 */
export async function setLessonMinPackage(
  courseId: string,
  lessonId: string,
  minPackageKey: string | null
): Promise<{ success: boolean; error: string | null }> {
  if (minPackageKey !== null && !isPackageKey(minPackageKey)) {
    return { success: false, error: "Unknown package" }
  }

  try {
    await connectDB()
    const instructor = await getAuthenticatedInstructor()

    const course = await Course.findOne({ _id: courseId, ...courseScope(instructor) }).select("_id")
    if (!course) return { success: false, error: "Course not found" }

    const lesson = await Lesson.findOneAndUpdate(
      { _id: lessonId, course: courseId },
      { minPackageKey },
      { new: true }
    ).select("_id")
    if (!lesson) return { success: false, error: "Lesson not found" }

    revalidatePath(`/instructor/courses/${courseId}/lessons`)
    return { success: true, error: null }
  } catch (error) {
    console.error("Set lesson package error:", error)
    return { success: false, error: "Failed to update lesson" }
  }
}
```

- [ ] **Step 3: Course editor lesson form.** In `components/instructor/course-editor.tsx`:
  1. Add `import type { PackageKey } from "@/lib/db/models"` — fold it into the Task 5 `ICoursePackage` type import: `import type { ICoursePackage, PackageKey } from "@/lib/db/models"` — and `import { PACKAGE_KEYS, PACKAGE_LABEL } from "@/lib/entitlements"`.
  2. `EditorLesson`: add `minPackageKey: PackageKey | ""` after `isFree: boolean`. `emptyLesson()`: add `minPackageKey: "",`. The `useState<EditorLesson[]>` initializer: add `minPackageKey: l.minPackageKey ?? "",`.
  3. Directly after the closing `</div>` of the `{/* Type + Duration */}` grid (immediately before `{/* Lesson Thumbnail */}`), insert:

```tsx
                          {/* Minimum package (spec §6 ladder gating) */}
                          <div className="space-y-1.5">
                            <Label>Minimum package</Label>
                            <Select
                              value={lesson.minPackageKey || "everyone"}
                              onValueChange={(v) =>
                                updateLesson(lesson.tempId, {
                                  minPackageKey: v && v !== "everyone" ? (v as PackageKey) : "",
                                })
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="everyone">Everyone</SelectItem>
                                {PACKAGE_KEYS.map((k) => (
                                  <SelectItem key={k} value={k}>
                                    {PACKAGE_LABEL[k]} and up
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-[10px] text-muted-foreground">
                              Lowest tier that can open this lesson. Everyone also covers every existing enrolment.
                            </p>
                          </div>
```

- [ ] **Step 4: Lesson manager.** In `components/instructor/lesson-manager.tsx`:
  1. Imports: change `import { useActionState, useState } from "react"` to `import { useActionState, useState, useTransition } from "react"`; add `import { useRouter } from "next/navigation"`; add `import type { PackageKey } from "@/lib/db/models"`; add `import { PACKAGE_KEYS, PACKAGE_LABEL } from "@/lib/entitlements"`; extend the instructor-actions import to `import { addLesson, deleteLesson, setLessonMinPackage, type CourseFormState } from "@/lib/actions/instructor"`.
  2. Add after `typeIcons`:

```tsx
/** Per-row tier select — saves immediately through setLessonMinPackage. */
function LessonTierSelect({
  courseId,
  lessonId,
  value,
}: {
  courseId: string
  lessonId: string
  value: PackageKey | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex flex-col items-end gap-0.5">
      <Select
        value={value ?? "everyone"}
        disabled={pending}
        onValueChange={(v) => {
          setError(null)
          startTransition(async () => {
            const res = await setLessonMinPackage(courseId, lessonId, v && v !== "everyone" ? v : null)
            if (res.success) router.refresh()
            else setError(res.error)
          })
        }}
      >
        <SelectTrigger className="h-7 w-[9rem] text-xs" aria-label="Minimum package">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="everyone">Everyone</SelectItem>
          {PACKAGE_KEYS.map((k) => (
            <SelectItem key={k} value={k}>
              {PACKAGE_LABEL[k]} and up
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-[10px] text-ws-danger">{error}</p>}
    </div>
  )
}
```

  3. In the lesson row, directly before the `Quiz` `<Button …>`, insert:

```tsx
                    <LessonTierSelect
                      courseId={courseId}
                      lessonId={lesson.id}
                      value={lesson.minPackageKey ?? null}
                    />
```

  4. In the Add Lesson dialog, directly before the `{/* Free preview */}`-style block that holds `<input type="checkbox" id="lesson-free" …>` (i.e. before its `<div className="flex items-center gap-2">`), insert:

```tsx
            <div className="space-y-1.5">
              <Label>Minimum package</Label>
              <Select name="minPackageKey" defaultValue="everyone">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="everyone">Everyone</SelectItem>
                  {PACKAGE_KEYS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {PACKAGE_LABEL[k]} and up
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
```

- [ ] **Step 5: Pages.** In `app/(instructor)/instructor/courses/[courseId]/lessons/page.tsx`, `app/(instructor)/instructor/courses/[courseId]/edit/page.tsx` and `app/(admin)/admin/courses/[courseId]/edit/page.tsx`, add `minPackageKey: l.minPackageKey,` to each lesson mapper after `isFree: l.isFree,`.

- [ ] **Step 6: Verify.** tsc + eslint on every touched file. Runtime — reuse the Task 5 harness pattern in a second file `.superpowers/sdd/mastery-phase-2/lesson-tier-roundtrip.mjs` (run from the repo root): load the admin editor's hidden fields for `forex-trading-mastery`, parse the `lessons` JSON, set `lessons[0].minPackageKey = "standard"` (leave everything else exactly as rendered), POST, then check:

```js
// after the POST, from the same script:
await mongoose.connect("mongodb://127.0.0.1:27017/worldstreet-academy")
const rows = await mongoose.connection.db.collection("lessons").find({ course: course._id }).sort({ order: 1 }).project({ title: 1, minPackageKey: 1 }).toArray()
console.log(rows.map((l) => `${l.minPackageKey ?? "everyone"} · ${l.title}`).join("\n"))
await mongoose.disconnect()
```

Expected: the first lesson prints `standard · …`, every other lesson `everyone · …`. Then the lessons page shows it: `curl -s -b mock_persona=admin http://localhost:3001/instructor/courses/<id>/lessons | grep -o 'Standard and up' | wc -l` prints `1` (one row select shows the saved tier — the Add-lesson dialog is not in the initial HTML) and `grep -o 'Everyone' | wc -l` ≥ the number of remaining lessons. Reset afterwards: re-run the harness with `minPackageKey: ""` on that lesson (state it in the report).

- [ ] **Step 7: Commit.**

```bash
git add lib/types/course.ts lib/actions/lessons.ts lib/actions/instructor.ts components/instructor/course-editor.tsx components/instructor/lesson-manager.tsx "app/(instructor)/instructor/courses/[courseId]/lessons/page.tsx" "app/(instructor)/instructor/courses/[courseId]/edit/page.tsx" "app/(admin)/admin/courses/[courseId]/edit/page.tsx"
git commit -m "feat(editor): per-lesson minimum package in the course editor and lesson manager

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Content load check, content-debt list, plan status (controller-run — no implementer dispatch)

**Files:**
- Modify: `docs/mastery-academy-plan.md` (status board Phase 2 row, Phase 2 exit criteria, header status line)

- [ ] **Step 1: Catalogue idempotency on the mock DB** (dotenv does not override an existing env var, so this never touches production):

```bash
MONGODB_URI=mongodb://127.0.0.1:27017/worldstreet-academy node scripts/mastery-catalogue.mjs
```

Expected: 12 programs matched, `0` to modify (Phase 0 already applied it). If it reports modifications, apply with `--apply` (mock only) and record why in the ledger.

- [ ] **Step 2: Content debt** (product owes this; the pages already render correctly with the gaps): school intros for the 7 schools other than Trading (spec gives only §5's); curricula (`whatYouWillLearn`), taglines, features and ladders for the 9 programs the spec prices at a single "founding price"; program thumbnails (all 12 fall back to the school icon); instructor bios/headlines for the seeded faculty; legal pages. List these in the Phase 2 report line of the status board.

- [ ] **Step 3: Status board.** Tick the Phase 2 exit criteria, mark Phase 2 done with the branch, commit count and report line, and set the header to `Phases 0–2 done (unmerged branches), Phase 3 next`. Commit `docs: Phase 2 complete on the status board`.
