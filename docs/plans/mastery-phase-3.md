# Mastery Academy — Phase 3 Implementation Plan (Checkout by package, tier commerce, entitlement enforcement)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A student can go from "Enrol" on a package to "Enrollment confirmed". The wallet charges that package's price, and the Order, Enrollment, success page and email all carry the package. What each package includes is then enforced server-side on the web: lessons, lesson materials, the final exam and certificate, live classes, instructor Q&A and the Executive intake. Admins can see and change an enrollment's package, and the Go API has a matching patch list (`docs/go-patches-phase-3.md`).

**Architecture:**
- **Rules.** The pure package rules stay in `lib/entitlements.ts`: which package an enrollment bought, a lesson's effective tier, lesson access, and the lowest tier that includes a service.
- **Loader.** One new server-only loader, `lib/course-access.ts`, reads a student's access-granting enrollment plus the course's packages. Every web gate calls it; no gate repeats the lookup.
- **Purchase.** `purchaseCourse` takes `{ courseId, packageKey }` and prices from the chosen enabled package. The legacy single price still works.
- **Checkout.** The checkout keeps the package in the URL, so the wallet-funding round trip preserves it. The success page becomes a server component with a one-time Executive intake form.
- **Admin.** Admins move an enrollment between packages without moving money; each move is logged as a `package_changed` PaymentEvent.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict · Mongoose · Zod (`zod/v4`) · Tailwind v4 · Base UI (`render` prop) · lucide-react · central Worldstreet Wallet (`lib/wallet.ts`, integer cents).

**Spec:**
- `docs/mastery-academy-blueprint.md`: §6–§7 (package ladders), §11 step 4, §12 (the "Welcome to … Your learning journey starts now." copy), §17 (the journey).
- `docs/mastery-academy-plan.md`: §Phase 3, whose scope and "Carried over from Phase 2" list bind this plan; decisions D4 (Executive = pay now, then intake) and D5 (no self-serve upgrades in v1); §0.3 hard constraints.
- Phases 0–2 already shipped the schema (`Course.packages`, `Lesson.minPackageKey`, `Enrollment.packageKey/packageName`, `Order.packageKey`), `lib/entitlements.ts`, the program page with per-package checkout links, and the packages and lesson-tier editors.

**Controller rulings already made (do not re-litigate — they are in the ledger):**
1. **One loader.** `lib/course-access.ts` is the only place a gate reads "enrollment + course packages". Gates never compare ranks or look up packages inline.
2. **Buyers keep what they bought.** `entitlementsFor` finds the bought package by key even after the tier is disabled for sale. A package deleted from the course, or a null `packageKey`, gives full access (grandfathered).
3. **Lesson tiers follow the ladder.** A lesson's tier gates only while the course still sells (has enabled) that tier. Free-preview lessons (`isFree`) are never locked.
4. **No upgrades (D5).** Every lock notice names the package that includes the thing and links to support (`/dashboard/help`). It never links to a purchase or to `/programs/…#packages`, where enrolled visitors get no buy buttons.
5. **$0 tiers.** A $0 package is allowed only as a course's single enabled package. Next to paid tiers it would flip `Course.pricing` to "free", which the mobile app reads as "enrol without paying". The editor save refuses it.
6. **No certificate, no exam gate.** A package without `certificate` (Basic) completes on its lessons alone. It never meets the final-exam gate, never starts the final exam, and never lists a certificate.
7. **Completion never creates enrollments.** `markLessonComplete` and `markCourseComplete` stop creating enrollments. Today any signed-in user can call them to get an active enrollment (or a completed one, with a certificate) on any paid course. They now require an access-granting enrollment.
8. **Course classes.** Who may join a course meeting: the host, admins, direct invitees, and students whose package includes live classes. Everyone else is refused; before, anyone holding the link joined as a guest.
9. **Instructor Q&A.** A student cannot open a new conversation with the instructor of a course they're enrolled in when none of those enrollments includes Q&A. Existing conversations stay, and users with no enrollment with that instructor are unaffected.
10. **Checkout switcher.** The package switcher on checkout is a radio list (label · name · tagline · price). It is also the "ladder" when the URL has no valid package, because a segmented control can't show prices.
11. **Page shapes.** Checkout stays a client page (surgical). The success page becomes a server component with one small client form.
12. **Confirmation email.** `purchaseCourse` sends the enrollment confirmation email for every live enrollment it grants; it never sent one before. Pre-enrolment keeps its own email.
13. **Lost races refund.** A paid purchase that loses the enrollment row to a concurrent purchase of a different package refunds its own charge. Activation and re-purchase updates now pin the status they read, so a race can't overwrite another buyer's package.
14. **Executive intake.** The intake and the "schedule onboarding" notifications key on the **Executive** tier (D4), not on the mentorship flag alone. Single "Full program" tiers from the catalogue carry `mentorship: true` as a Phase 0 default and must not trigger onboarding.
15. **Admin package changes.** An admin can move an enrollment only to an enabled package on its course, never to "no package" (which would silently grant full access).
16. **Local verification setup.** Money paths are verified against a local wallet stub, never production. The controller runs the stub, restarts the dev server with the stub's env once Task 1's model change lands, owns the mock-DB snapshot, and resets both between tasks.

## Global Constraints

- **Schema: additive only.**
  - The only model change in this phase is Task 1's `Enrollment.mentorshipIntake` (default `null`).
  - No renamed fields, no new `role` values, no changed meaning of an existing status.
  - Mongoose caches models in the running dev server: a schema edit takes effect only after the controller restarts it, so nobody but Task 1 edits `lib/db/models/*`.
- **Money:**
  - `Course.price`, package `price` and `Enrollment.pricePaid` are whole USD.
  - `Order.amountMinor`, `Earning.*Minor` and every `lib/wallet.ts` call are integer US cents.
  - Conversion happens once, in `purchaseCourse`.
  - No amount ever comes from the client.
  - Wallet disabled means fail closed.
  - Never edit `lib/wallet.ts`.
- **`"use server"` files export only async functions** (plus types). Non-exported helpers and consts are fine. `lib/actions/*.ts` are all `"use server"`.
- **`lib/course-access.ts` is `import "server-only"`.** Import it from server actions and server components only, never from a `"use client"` file.
- **Package rules have exactly two homes:** `lib/entitlements.ts` (pure: `entitlementsFor`, `effectiveLessonTier`, `canAccessLesson`, `lowestPackageWith`, `packageFor`, `PACKAGE_LABEL`) and `lib/course-access.ts` (the loader). Never write a rank comparison or a `packages.find(...)` for access inline.
- **Copy (verbatim):**
  - "Enrollment confirmed"
  - "Welcome to {BRAND.name}. Your learning journey starts now."
  - "Choose a package to continue"
  - The lock-notice sentences inside `PackageLockNotice` (Task 4).
  - Brand always via `BRAND` from `@/lib/brand`; tier labels always via `PACKAGE_LABEL` ("Basic" / "Standard" / "Executive 101").
  - Never invent numbers or claims.
- **No purchase links from lock states** (ruling 4). Support link only: `/dashboard/help`.
- **Icons:** `lucide-react` only; never emoji.
- **UI tokens:**
  - Semantic classes only (`bg-ws-surface`, `bg-ws-raised`, `bg-ws-sunken`, `bg-ws-chip`, `bg-ws-track`, `border-ws-hairline`, `text-ws-primary`, `text-ws-muted`, `text-ws-subtle`, `text-ws-gold`, `bg-ws-brand`, `text-ws-brand-on`, `bg-ws-brand/10`, `border-ws-brand/40`, `text-ws-success`, `bg-ws-success/10`, `text-ws-danger`, `text-ws-warning`, `font-display`); never a hex.
  - New markup uses radii `rounded-xs/sm/md/lg/full` only.
  - Gold only on the one primary CTA per view, the active/selected state, and ~10% icon washes.
  - Prices and counts in `tabular-nums`; whole-dollar prices print as `$49` (`toLocaleString("en-US")`), wallet balances keep cents.
  - Separators use `·`.
- **Base UI composition uses the `render` prop, never `asChild`.** A Base UI `Select` needs an `items` prop to show labels instead of raw values. RSC-first: `"use client"` only where hooks require it.
- **Links:**
  - Dashboard course pages: `/dashboard/courses/${id}`.
  - Public program pages: `/programs/${slug}`.
  - Support: `/dashboard/help`.
  - Instructor course page: `/instructor/courses/${id}`.
  - Admin enrollments filtered to a course: `/admin/enrollments?course=${id}`.
  - Never ship a dead link.
- **No new dependencies. No `any`.**
- **Commits:**
  - One or more per task; every message ends with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
  - Add files by name; never `git add -A`.
  - Never commit `.env*`.
  - **Never run `git stash` / `git stash pop`.** The untracked `AGENTS.md` in the repo root is not yours; leave it.
- **Surgical:** touch only the listed files, plus files a compile error forces you into (say so in the report). No reformatting, no drive-by refactors.

## Verification kit (controller-owned — use it, never start or restart servers yourself)

No test runner exists. Every task ends with:
- `npx tsc --noEmit 2>&1 | grep -v '^\.next/'` printing nothing;
- `npx eslint <every file you touched>` printing no errors or warnings;
- the task's own runtime checks against the dev server.

Set this once per shell (Git Bash, repo root):

```bash
H="C:/Users/owen/AppData/Local/Temp/claude/C--Users-owen-downloads-projects-worldstreet-worldstreet-academy/d4ab89bb-8435-4b94-b993-6b42283d1e4b/scratchpad/phase-3"
export NODE_PATH="$(pwd)/node_modules"   # lets the .cjs helpers require mongoose
```

- **Dev server:** `pnpm dev:mock` on **http://localhost:3001**, already running.
  - Mock Clerk, with `pk_live_` so the production auth branch runs.
  - Local Mongo at `mongodb://127.0.0.1:27017/worldstreet-academy`.
  - From Task 2 on it runs with `WALLET_BASE_URL=http://127.0.0.1:4010` and `WALLET_SERVICE_TOKEN=stub-token`.
  - Turbopack hot-reloads code, but not model schema changes.
  - Do **not** start a second server and do **not** edit `next.config.ts`.
- **Personas:** cookie `mock_persona=guest|student|instructor|admin`; no cookie means student. A guest on `/dashboard/*` gets a 307 to the hub login.
- **Wallet stub:** `http://127.0.0.1:4010`.
  - `curl -s 127.0.0.1:4010/__state` shows balances and every charge.
  - `curl -s -X POST 127.0.0.1:4010/__balance -H 'Content-Type: application/json' -d '{"authUserId":"user_mock_student","availableMinor":5000}'` sets a balance. Unknown users start with 150000 ($1,500).
  - `curl -s -X POST 127.0.0.1:4010/__reset` wipes it.
  - Insufficient funds come back as the wallet's real `INSUFFICIENT_BALANCE` 409.
  - If `__state` doesn't answer, report **BLOCKED**. Do not start the stub.
- **Calling a server action:** `bash "$H/action.sh" "<page that imports it>" <actionName> '<json args array>' [persona]` prints the action's return value.
  - The page must be one whose client components import the action; the helper reads the action id from that page's client chunks.
  - `PRINT_ID=1 bash "$H/action.sh" …` prints only the id, for raw concurrent POSTs:
    `curl -s -X POST "http://localhost:3001<page>" -H "Next-Action: $ID" -H "Accept: text/x-component" -H "Content-Type: text/plain;charset=UTF-8" -b mock_persona=<p> --data '<json>' | tail -1`.
- **Mock DB helper:** `node "$H/mockdb.cjs" <cmd>`.
  - `probe [userId]`: enrollments, orders, payment events, earnings, latest notifications.
  - `fixture [basic|standard|executive|none]`: three video lessons on Forex (tiers everyone / standard / executive, `videoUrl`s `https://example.com/fixture-<tier>.mp4`), plus a student enrollment on that package. Prints ids as JSON.
  - `exam-fixture <courseId> [lessonId]`.
  - `meeting-fixture <courseId>`.
  - `set-package <enrollmentId> <key>`.
  - `set-status <enrollmentId> <status>`.
  - `preenrol <userId> <courseId>`.
  - `restore`: puts every tracked collection, course ladder and user counter back to the clean baseline.
  - **Run `restore` (and the stub `__reset`) at the end of every task that touched data**, and say so in your report.
- **Never POST the course editor for a course that has lessons.** The save recreates lessons with new ids, which the snapshot can't restore; Forex, Crypto and Blockchain have none.
- **HTML checks:**
  - Next HTML is one line: count with `grep -o … | wc -l`, never `grep -c`.
  - The RSC payload repeats visible text, so strip scripts before counting: `curl -s … | perl -pe 's/<script\b.*?<\/script>//gs' | grep -o '…' | wc -l`.
  - A client page's data isn't in its HTML; check it through `action.sh`.
- **Browser (phone width / visual):**
  - `B=~/.claude/skills/gstack/browse/dist/browse`.
  - Commands: `$B viewport 400x800` · `$B goto <url>` · `$B wait --load` · `$B js "document.body.scrollWidth + '/' + window.innerWidth"` · `$B screenshot --viewport <file.png>` (write screenshots into `$H`) · `$B console --errors`.
  - It browses as the default persona (student).
- **Mock data:**

| Course (slug) | id | Packages (enabled) | Lessons |
|---|---|---|---|
| `bitcoin-cryptocurrency-fundamentals` | `6a6fc0bb6433bbbd6322be03` | none — free | 12 (student enrolled, active, `packageKey` null) |
| `technical-analysis-crypto-trading` | `6a6fc0bb6433bbbd6322be07` | none — paid $79 | 8 (student enrolled, active) |
| `forex-trading-mastery` | `6aa7bc2845744c5eeb0eb781` | basic "Forex Foundation" $49 · standard "Forex Mastery" $199 (highlight) · executive "Private Forex Mentorship" $999 | 0 |
| `crypto-trading-mastery` | `6aa7bc2845744c5eeb0eb782` | basic "Crypto Foundation" $49 · standard "Crypto Mastery" $199 · executive "Private 1-on-1 Crypto Mentorship" $999 | 0 |
| `blockchain-technology-mastery` | `6aa7bc2845744c5eeb0eb783` | standard "Full program" $99 (all six entitlements true) | 0 |

- **Entitlements:**
  - Basic: all six false.
  - Standard: `liveClasses`, `instructorQa`, `assignments`, `certificate` true; `mentorship`, `prioritySupport` false.
  - Executive: all six true.
  - No course has `examRequired`.
- **Users:**
  - student `6a6fc0bb6433bbbd6322be61` (`authUserId` `user_mock_student`)
  - instructor "Sarah Chen" `6a6fc0ba6433bbbd6322bdfd` (teaches every course above)
  - admin `6a6fc1258372b65d1ee8e972` (`user_mock_admin`)

---

### Task 1: Access primitives — package rules, server-only access loader, $0-tier rule, intake field

**Files:**
- Modify: `lib/entitlements.ts` (whole file shown below)
- Create: `lib/course-access.ts`
- Modify: `lib/db/models/enrollment.ts` (interface after `packageName`; schema after `packageName`)
- Modify: `lib/actions/instructor.ts` (`PackagesSchema`, lines 29–33)
- Modify: `components/instructor/package-editor.tsx` (the price hint, line 229)

**Interfaces:**
- Consumes: `ICoursePackage`, `IPackageEntitlements`, `PackageKey`, `Course`, `Enrollment`, `Lesson` from `@/lib/db/models`; `connectDB` from `@/lib/db`.
- Produces (later tasks rely on these exact names):
  - `lib/entitlements.ts`:
    - `entitlementsFor(course, enrollment)` finds the bought package by key and ignores `enabled`.
    - `effectiveLessonTier(course, lesson): PackageKey | null`.
    - `canAccessLesson(course, lesson, enrollment): boolean`. **New first parameter `course`**; `lesson` may carry `isFree`.
    - `lowestPackageWith(course, flag: keyof IPackageEntitlements): PackageKey | null`.
    - Unchanged: `packageFor` (enabled only), `PACKAGE_RANK`, `FULL_ACCESS`, `pricingFromPackages`, `PACKAGE_KEYS`, `isPackageKey`, `PACKAGE_LABEL`.
    - Parameter shapes: `course: { packages?: ICoursePackage[] | null }`, `enrollment: { packageKey?: PackageKey | null } | null | undefined`, `lesson: { minPackageKey?: PackageKey | null; isFree?: boolean }`.
  - `lib/course-access.ts`:
    - `type CourseAccess = { enrollmentId: string; packageKey: PackageKey | null; packageName: string | null; entitlements: IPackageEntitlements; course: { id: string; slug: string; instructorId: string; packages: ICoursePackage[] } }`
    - `getCourseAccess(userId: string, courseId: string): Promise<CourseAccess | null>`
    - `lockedLessonIds(access: CourseAccess | null): Promise<Set<string>>`
    - `isLessonLockedFor(userId: string, lessonId: string): Promise<boolean>`
  - `IEnrollment.mentorshipIntake: { goals: string; availability: string; submittedAt: Date } | null`.
  - `PackagesSchema` refuses an enabled $0 package when more than one package is enabled.

- [ ] **Step 1: Package rules.** Replace the whole of `lib/entitlements.ts` with:

```ts
import type { ICoursePackage, IPackageEntitlements, PackageKey } from "@/lib/db/models"

export const PACKAGE_RANK: Record<PackageKey, 1 | 2 | 3> = { basic: 1, standard: 2, executive: 3 }

/** Legacy / free / pre-enrolled enrollments: everything today's app allows. */
export const FULL_ACCESS: IPackageEntitlements = {
  liveClasses: true,
  instructorQa: true,
  assignments: true,
  certificate: true,
  mentorship: true,
  prioritySupport: true,
}

// Optional fields: a .lean()/projected read of a legacy row predates these
// fields and returns no key at all — Mongoose only materialises defaults when
// it hydrates a document.
type CourseLike = { packages?: ICoursePackage[] | null }
type EnrollmentLike = { packageKey?: PackageKey | null } | null | undefined
type LessonLike = { minPackageKey?: PackageKey | null; isFree?: boolean }

/** An enabled (on-sale) package by key — what checkout may sell. */
export function packageFor(course: CourseLike, key: PackageKey | null): ICoursePackage | null {
  if (!key) return null
  return (course.packages ?? []).find((p) => p.key === key && p.enabled) ?? null
}

/**
 * What an enrollment's package unlocks. The bought package is found by key
 * even if its tier has since been disabled for sale — buyers keep what they
 * paid for. A null packageKey (legacy / free / pre-enrolled), or a package no
 * longer on the course at all → FULL_ACCESS (grandfathered).
 */
export function entitlementsFor(course: CourseLike, enrollment: EnrollmentLike): IPackageEntitlements {
  const key = enrollment?.packageKey ?? null
  const pkg = key ? (course.packages ?? []).find((p) => p.key === key) : undefined
  return pkg ? pkg.entitlements : FULL_ACCESS
}

/**
 * A lesson's tier only gates while the course still sells (has enabled) that
 * tier — a tier switched off in the ladder gates nothing.
 */
export function effectiveLessonTier(course: CourseLike, lesson: LessonLike): PackageKey | null {
  const tier = lesson.minPackageKey ?? null
  return tier && packageFor(course, tier) ? tier : null
}

/** Free-preview lessons, untiered lessons and legacy (null-package) enrollments always open. */
export function canAccessLesson(course: CourseLike, lesson: LessonLike, enrollment: EnrollmentLike): boolean {
  if (lesson.isFree) return true
  const tier = effectiveLessonTier(course, lesson)
  if (!tier) return true
  const key = enrollment?.packageKey ?? null
  if (!key) return true
  return PACKAGE_RANK[key] >= PACKAGE_RANK[tier]
}

/**
 * Course.price/pricing must stay truthful for surfaces (and the mobile app)
 * that only read the scalar: with packages, price = cheapest enabled package.
 * Returns null when there are no enabled packages (keep the course's own values).
 */
export function pricingFromPackages(
  packages: ICoursePackage[] | null | undefined
): { pricing: "free" | "paid"; price: number } | null {
  const enabled = (packages ?? []).filter((p) => p.enabled)
  if (enabled.length === 0) return null
  const price = Math.min(...enabled.map((p) => p.price))
  return { pricing: price > 0 ? "paid" : "free", price }
}

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

/** Lowest enabled tier whose package includes `flag` — the package a lock notice names. null when none does. */
export function lowestPackageWith(course: CourseLike, flag: keyof IPackageEntitlements): PackageKey | null {
  return PACKAGE_KEYS.find((key) => packageFor(course, key)?.entitlements[flag]) ?? null
}
```

- [ ] **Step 2: The loader.** Create `lib/course-access.ts`:

```ts
import "server-only"

import mongoose from "mongoose"
import connectDB from "@/lib/db"
import {
  Course,
  Enrollment,
  Lesson,
  type ICoursePackage,
  type IPackageEntitlements,
  type PackageKey,
} from "@/lib/db/models"
import { canAccessLesson, entitlementsFor } from "@/lib/entitlements"

/**
 * Package-aware access for one student on one course — the single lookup the
 * web gates (lessons, materials, assessments, certificates, live classes,
 * instructor Q&A) share. Only access-granting enrollments count (active /
 * completed): a reservation, refund, suspension or cancellation reads as null
 * here and the caller's own enrollment rules handle it. Course staff (the
 * instructor, admins) have no enrollment, so they read as null too — callers
 * that let staff in check that first.
 */
export type CourseAccess = {
  enrollmentId: string
  packageKey: PackageKey | null
  packageName: string | null
  entitlements: IPackageEntitlements
  course: { id: string; slug: string; instructorId: string; packages: ICoursePackage[] }
}

export async function getCourseAccess(userId: string, courseId: string): Promise<CourseAccess | null> {
  if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(courseId)) return null
  await connectDB()
  const [enrollment, course] = await Promise.all([
    Enrollment.findOne({ user: userId, course: courseId, status: { $in: ["active", "completed"] } })
      .select("_id packageKey packageName")
      .lean(),
    Course.findById(courseId).select("slug instructor packages").lean(),
  ])
  if (!enrollment || !course) return null
  const packages = course.packages ?? []
  const packageKey = enrollment.packageKey ?? null
  return {
    enrollmentId: enrollment._id.toString(),
    packageKey,
    packageName: enrollment.packageName ?? null,
    entitlements: entitlementsFor({ packages }, { packageKey }),
    course: {
      id: course._id.toString(),
      slug: course.slug,
      instructorId: course.instructor.toString(),
      packages,
    },
  }
}

/**
 * Ids of the course's lessons this enrollment's package can't open. Empty when
 * there is no access-granting enrollment (other gates decide) or nothing is tiered.
 */
export async function lockedLessonIds(access: CourseAccess | null): Promise<Set<string>> {
  if (!access) return new Set()
  const lessons = await Lesson.find({ course: access.course.id }).select("_id minPackageKey isFree").lean()
  return new Set(
    lessons
      .filter((lesson) => !canAccessLesson(access.course, lesson, access))
      .map((lesson) => lesson._id.toString())
  )
}

/** True only when the user is enrolled on the lesson's course and their package can't open it. */
export async function isLessonLockedFor(userId: string, lessonId: string): Promise<boolean> {
  if (!mongoose.isValidObjectId(lessonId)) return false
  await connectDB()
  const lesson = await Lesson.findById(lessonId).select("course minPackageKey isFree").lean()
  if (!lesson) return false
  const access = await getCourseAccess(userId, lesson.course.toString())
  return access ? !canAccessLesson(access.course, lesson, access) : false
}
```

- [ ] **Step 3: Intake field.** In `lib/db/models/enrollment.ts`, add to `IEnrollment` directly under `packageName: string | null`:

```ts
  /** Executive onboarding answers, sent once from the checkout success page (D4). */
  mentorshipIntake: { goals: string; availability: string; submittedAt: Date } | null
```

and to the schema directly under the `packageName: { type: String, default: null },` line:

```ts
    mentorshipIntake: {
      type: new Schema(
        {
          goals: { type: String, required: true, maxlength: 2000 },
          availability: { type: String, required: true, maxlength: 500 },
          submittedAt: { type: Date, required: true },
        },
        { _id: false }
      ),
      default: null,
    },
```

- [ ] **Step 4: $0-tier rule.** In `lib/actions/instructor.ts` replace the `PackagesSchema` declaration (lines 29–33) with:

```ts
const PackagesSchema = z
  .array(PackageSchema)
  .max(3)
  .refine((arr) => new Set(arr.map((p) => p.key)).size === arr.length, "Package keys must be unique")
  .refine((arr) => arr.filter((p) => p.highlight).length <= 1, "Only one package can be highlighted")
  .superRefine((arr, ctx) => {
    // A $0 tier only works alone: next to paid tiers it turns Course.pricing
    // "free", which the mobile app reads as "enrol without paying".
    if (arr.filter((p) => p.enabled).length < 2) return
    arr.forEach((p, i) => {
      if (p.enabled && p.price === 0) {
        ctx.addIssue({
          code: "custom",
          path: [i, "price"],
          message: "A free tier only works as a program's single package — set a price or disable the other tiers",
        })
      }
    })
  })
```

(`parsePackages` already prefixes `"<Label> package: "` from `path[0]`, so the editor shows e.g. "Basic package: A free tier only works as …".)

- [ ] **Step 5: Editor hint.** In `components/instructor/package-editor.tsx` replace

```tsx
              <p className="text-[10px] text-muted-foreground">Required. Enter 0 to make this tier free.</p>
```

with

```tsx
              <p className="text-[10px] text-muted-foreground">Required. Enter 0 only when this is the program&apos;s single package.</p>
```

- [ ] **Step 6: Verify.**
  1. tsc (filtered) and `npx eslint lib/entitlements.ts lib/course-access.ts lib/db/models/enrollment.ts lib/actions/instructor.ts components/instructor/package-editor.tsx`. `canAccessLesson` has no callers yet, so its signature change compiles cleanly; if tsc names one, fix that caller and report it.
  2. Rule assertions. Create `"$H/t1-entitlements.ts"`:

```ts
import assert from "node:assert/strict"
import {
  FULL_ACCESS,
  canAccessLesson,
  effectiveLessonTier,
  entitlementsFor,
  lowestPackageWith,
} from "@/lib/entitlements"
import type { ICoursePackage, IPackageEntitlements, PackageKey } from "@/lib/db/models"

const none: IPackageEntitlements = {
  liveClasses: false, instructorQa: false, assignments: false,
  certificate: false, mentorship: false, prioritySupport: false,
}
const pkg = (key: PackageKey, price: number, enabled: boolean, e: Partial<IPackageEntitlements>): ICoursePackage => ({
  key, name: key, tagline: "", price, features: [], highlight: false, ctaLabel: null, enabled,
  entitlements: { ...none, ...e },
})
const course = {
  packages: [
    pkg("basic", 49, true, {}),
    pkg("standard", 199, true, { liveClasses: true, instructorQa: true, assignments: true, certificate: true }),
    pkg("executive", 999, false, { ...FULL_ACCESS }),
  ],
}

assert.deepEqual(entitlementsFor(course, { packageKey: null }), FULL_ACCESS)
assert.deepEqual(entitlementsFor(course, null), FULL_ACCESS)
assert.equal(entitlementsFor(course, { packageKey: "basic" }).certificate, false)
assert.equal(entitlementsFor(course, { packageKey: "executive" }).mentorship, true, "disabled tier still honoured for its buyers")
assert.deepEqual(entitlementsFor({ packages: [] }, { packageKey: "basic" }), FULL_ACCESS, "deleted package → grandfathered")

assert.equal(effectiveLessonTier(course, { minPackageKey: "standard" }), "standard")
assert.equal(effectiveLessonTier(course, { minPackageKey: "executive" }), null, "tier not on sale gates nothing")
assert.equal(effectiveLessonTier(course, {}), null)

assert.equal(canAccessLesson(course, { minPackageKey: "standard" }, { packageKey: "basic" }), false)
assert.equal(canAccessLesson(course, { minPackageKey: "standard", isFree: true }, { packageKey: "basic" }), true)
assert.equal(canAccessLesson(course, { minPackageKey: "standard" }, { packageKey: "standard" }), true)
assert.equal(canAccessLesson(course, { minPackageKey: "standard" }, { packageKey: "executive" }), true)
assert.equal(canAccessLesson(course, { minPackageKey: "executive" }, { packageKey: "basic" }), true)
assert.equal(canAccessLesson(course, { minPackageKey: "standard" }, { packageKey: null }), true)
assert.equal(canAccessLesson(course, { minPackageKey: "standard" }, null), true)

assert.equal(lowestPackageWith(course, "certificate"), "standard")
assert.equal(lowestPackageWith(course, "mentorship"), null, "executive is disabled")

console.log("entitlements: all assertions passed")
```

   Run it from the repo root: `npx tsx --tsconfig ./tsconfig.json "$H/t1-entitlements.ts"`. Expect `entitlements: all assertions passed`. If tsx can't resolve `@/lib/…` for a file outside the repo, change the two imports to absolute file paths into the repo, and say so in the report.

  3. The $0 rule, through the live `updateCourse` action. Create `"$H/t1-free-tier.cjs"`. It posts the admin editor's own form (React progressive-enhancement POST, the recipe Phase 2 used) with Forex's Basic tier priced $0:

```js
// Re-posts every hidden field the admin editor rendered for Forex, with the
// Basic tier set to $0 while Standard/Executive stay paid, and expects the
// server to refuse the save.
const mongoose = require("mongoose")
const BASE = "http://localhost:3001"
const COOKIE = "mock_persona=admin"
const URI = "mongodb://127.0.0.1:27017/worldstreet-academy"
const unesc = (s) => s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")

async function hiddenFields(page) {
  const html = await (await fetch(page, { headers: { cookie: COOKIE } })).text()
  const fields = []
  for (const m of html.matchAll(/<input\b[^>]*>/g)) {
    const tag = m[0]
    if (!/type="hidden"/.test(tag)) continue
    const name = tag.match(/name="([^"]+)"/)?.[1]
    if (name) fields.push([name, unesc(tag.match(/value="([^"]*)"/)?.[1] ?? "")])
  }
  return fields
}

async function main() {
  await mongoose.connect(URI)
  const courses = mongoose.connection.db.collection("courses")
  const course = await courses.findOne({ slug: "forex-trading-mastery" })
  const page = `${BASE}/admin/courses/${course._id}/edit`

  const fields = await hiddenFields(page)
  const packages = JSON.parse(fields.find(([k]) => k === "packages")[1])
  packages.find((p) => p.key === "basic").price = 0
  const fd = new FormData()
  for (const [k, v] of fields) fd.append(k, k === "packages" ? JSON.stringify(packages) : v)
  const res = await fetch(page, { method: "POST", headers: { cookie: COOKIE, accept: "text/x-component" }, body: fd, redirect: "manual" })
  const body = await res.text()
  console.log(`POST ${res.status}`, body.includes("A free tier only works as a program") ? "REFUSED-OK" : "NOT-REFUSED")

  const after = await courses.findOne({ _id: course._id })
  console.log("basic price in DB:", after.packages.find((p) => p.key === "basic").price, "· pricing:", after.pricing, "· price:", after.price)
  await mongoose.disconnect()
}
main().catch(async (e) => { console.error(e); await mongoose.disconnect(); process.exit(1) })
```

   Run `node "$H/t1-free-tier.cjs"`. Expect `POST 200 REFUSED-OK` and `basic price in DB: 49 · pricing: paid · price: 49`. A 303 means the save went through: that is a FAIL; run `node "$H/mockdb.cjs" restore` and fix.

  4. Positive case, a single $0 package is still allowed. Copy the script to `"$H/t1-free-single.cjs"`, change the slug to `blockchain-technology-mastery` and the mutation to `packages.find((p) => p.key === "standard").price = 0`. Expect `POST 303` (saved) and DB `pricing: free · price: 0`. Then run `node "$H/mockdb.cjs" restore`, and confirm with a re-read that Blockchain is back to `$99 / paid`.

- [ ] **Step 7: Commit.**

```bash
git add lib/entitlements.ts lib/course-access.ts lib/db/models/enrollment.ts lib/actions/instructor.ts components/instructor/package-editor.tsx
git commit -m "feat(access): package rules, server-only course access loader, \$0-tier rule, Executive intake field

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `purchaseCourse` buys a package — price, references, race refund, Executive notice, confirmation email, Vivid

**Files:**
- Modify: `lib/actions/enrollments.ts` (imports; `PurchaseResult`; add `PurchaseInput`; `purchaseCourse` whole function; the `sendEnrollmentConfirmationEmail` call in `preEnrollCourse`)
- Modify: `lib/email.tsx` (`EnrollmentEmailData`; `EnrollmentConfirmationEmail`; the subject in `sendEnrollmentConfirmationEmail`)
- Modify: `lib/vivid/actions/courses.ts` (`vividEnrollInCourse`)
- Modify: `app/(platform)/dashboard/checkout/page.tsx` (the one `purchaseCourse(course.id)` call only — Task 3 rewrites the page)

**Interfaces:**
- Consumes: `packageFor` (Task 1 / Phase 0); `notifyUser`, `notifyAdmins` from `@/lib/notify`; `BRAND` (already imported in `lib/email.tsx`).
- Produces:
  - `purchaseCourse(input: { courseId: string; packageKey?: PackageKey }): Promise<PurchaseResult>`
  - `PurchaseResult` success data: `{ enrollmentId: string; alreadyEnrolled?: boolean; packageName: string | null }`
  - Failure `code` adds `"invalid" | "package_required"`
  - `EnrollmentEmailData.packageName: string | null`
  - Wallet reference: `academy_enroll_<userId>_<courseId>[_<packageKey>][_r<n>]`

- [ ] **Step 1: Imports and types.** In `lib/actions/enrollments.ts`:
  - add `import { z } from "zod/v4"` directly under `import { revalidatePath } from "next/cache"`;
  - add `type PackageKey,` to the `@/lib/db/models` import list (after `type OrderStatus,`);
  - directly under `import { sendEnrollmentConfirmationEmail } from "@/lib/email"` add:

```ts
import { notifyAdmins, notifyUser } from "@/lib/notify"
import { packageFor } from "@/lib/entitlements"
```

   Replace the `PurchaseResult` type with:

```ts
export type PurchaseResult =
  | { success: true; data: { enrollmentId: string; alreadyEnrolled?: boolean; packageName: string | null } }
  | {
      success: false
      error: string
      code?:
        | "auth"
        | "invalid"
        | "not_found"
        | "not_live"
        | "package_required"
        | "insufficient_funds"
        | "wallet_unavailable"
        | "enroll_failed"
      shortfallMinor?: number
      availableMinor?: number
    }

const PurchaseInput = z.object({
  courseId: z.string().regex(/^[a-f0-9]{24}$/),
  packageKey: z.enum(["basic", "standard", "executive"]).optional(),
})
```

- [ ] **Step 2: `purchaseCourse`.** Replace the whole function (its doc comment through its closing `}`) with:

```ts
/**
 * Purchase / enroll in a course, in one of its packages when it sells them.
 *
 * The caller supplies only the course and the package key: identity comes
 * from the session and the price from the course record (the chosen enabled
 * package's price, or the single course price when the course sells no
 * packages) — nothing money-related is trusted from the client. Paid purchases
 * debit the central Worldstreet wallet server-to-server and enroll ONLY after
 * the wallet confirms the charge. The debit is idempotent (deterministic
 * reference per user + course + package + purchase generation), so a retried
 * or double-clicked purchase can never charge twice. If the wallet is
 * unreachable we fail closed: no enrollment, no fake success.
 */
export async function purchaseCourse(input: { courseId: string; packageKey?: PackageKey }): Promise<PurchaseResult> {
  try {
    await connectDB()

    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: "You need to be signed in to enroll", code: "auth" }
    }

    const parsed = PurchaseInput.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: "That checkout link isn't valid", code: "invalid" }
    }
    const { courseId, packageKey } = parsed.data

    // Idempotent short-circuit — an existing access-granting enrollment is a
    // success, not an error. A refunded row means this is a RE-purchase: the
    // row is kept for audit, so we reactivate it rather than insert (the
    // {user, course} unique index forbids a second row).
    const existing = await Enrollment.findOne({ user: user.id, course: courseId })
    // A pre-enrolled row is a reservation, not access: purchase ACTIVATES it.
    const isActivation = existing?.status === "pre_enrolled"
    if (existing && existing.status !== "refunded" && !isActivation) {
      return {
        success: true,
        data: {
          enrollmentId: existing._id.toString(),
          alreadyEnrolled: true,
          packageName: existing.packageName ?? null,
        },
      }
    }
    const isRepurchase = Boolean(existing) && !isActivation

    const course = await Course.findOne({ _id: courseId, status: "published" })
    if (!course) {
      return { success: false, error: "Course not found or not available", code: "not_found" }
    }

    // Scheduled courses take money only once they are live — before that the
    // only door is preEnrollCourse, which never charges.
    if (courseAvailability(course) === "coming_soon") {
      return {
        success: false,
        error: "This course isn't live yet. You can enroll now and pay when it launches.",
        code: "not_live",
      }
    }

    // Which package is being bought. A course that sells packages takes money
    // only for an enabled tier the buyer chose. A course with no enabled
    // package sells at its single price and ignores any key — the program page
    // links its synthesized "Full program" tier as package=standard.
    const sellsPackages = (course.packages ?? []).some((p) => p.enabled)
    const pkg = sellsPackages ? packageFor(course, packageKey ?? null) : null
    if (sellsPackages && !pkg) {
      return { success: false, error: "Choose a package to continue", code: "package_required" }
    }

    const price = pkg ? pkg.price : course.pricing === "paid" ? course.price ?? 0 : 0
    const amountMinor = Math.round(price * 100)
    const isPaid = amountMinor > 0
    const packageFields = { packageKey: pkg?.key ?? null, packageName: pkg?.name ?? null }

    // The charge reference is deterministic per PURCHASE GENERATION, not per
    // user+course. Within one generation, retries and double-clicks replay the
    // same charge (never a second debit). But a re-purchase after a refund must
    // get a fresh reference: the wallet replays a stored idempotent response for
    // 24h, so reusing the old key would hand back the already-refunded charge
    // and the student would get the course without paying again.
    const generation = await Order.countDocuments({
      user: user.id,
      course: courseId,
      status: "refunded",
    })
    // Package purchases carry the key; single-price references stay
    // byte-identical to pre-package orders so their retries still replay.
    const baseReference = `academy_enroll_${user.id}_${courseId}${pkg ? `_${pkg.key}` : ""}`
    const reference = generation > 0 ? `${baseReference}_r${generation}` : baseReference

    let chargeId: string | null = null
    let order: IOrder | null = null

    if (isPaid) {
      if (!walletEnabled()) {
        // Never enroll a paid course without a confirmed debit.
        return {
          success: false,
          error: "Payments are temporarily unavailable. Please try again later.",
          code: "wallet_unavailable",
        }
      }

      const ord = await Order.findOneAndUpdate(
        { reference },
        {
          $setOnInsert: {
            user: user.id,
            authUserId: user.authUserId,
            course: courseId,
            reference,
            amountMinor,
            currency: "USD",
            packageKey: packageFields.packageKey,
            status: "pending",
            history: [{ status: "pending", at: new Date() }],
          },
        },
        { upsert: true, new: true }
      )
      if (!ord) {
        return { success: false, error: "Failed to open an order", code: "enroll_failed" }
      }
      order = ord

      await transitionOrder(ord, "payment_requested")
      await logPaymentEvent(ord._id, reference, "charge_requested", {
        amountMinor,
        courseId,
        packageKey: packageFields.packageKey,
        authUserId: user.authUserId,
      })

      try {
        const { charge } = await createWalletCharge(user.authUserId, {
          amountMinor,
          description: pkg ? `Course: ${course.title} — ${pkg.name}` : `Course: ${course.title}`,
          metadata: {
            courseId: course._id.toString(),
            courseSlug: course.slug ?? "",
            packageKey: packageFields.packageKey,
          },
          idempotencyKey: reference,
        })
        chargeId = charge.id
        ord.chargeId = charge.id
        await transitionOrder(ord, "paid")
        await logPaymentEvent(ord._id, reference, "charge_confirmed", {
          chargeId: charge.id,
          amountMinor: charge.amountMinor,
        })
      } catch (err) {
        if (isInsufficientBalance(err)) {
          const details = err.details as { availableMinor?: number }
          const availableMinor = typeof details.availableMinor === "number" ? details.availableMinor : 0
          ord.failureCode = "insufficient_funds"
          await transitionOrder(ord, "failed", "insufficient funds")
          await logPaymentEvent(ord._id, reference, "charge_failed", {
            code: "INSUFFICIENT_BALANCE",
            availableMinor,
          })
          return {
            success: false,
            error: "Your Worldstreet balance doesn't cover this purchase.",
            code: "insufficient_funds",
            availableMinor,
            shortfallMinor: Math.max(0, amountMinor - availableMinor),
          }
        }
        const code = err instanceof WalletError ? err.code : "WALLET_ERROR"
        ord.failureCode = code
        await transitionOrder(ord, "failed", code)
        await logPaymentEvent(ord._id, reference, "charge_failed", {
          code,
          message: err instanceof Error ? err.message : String(err),
        })
        console.error("[Payments] wallet charge failed:", err)
        return {
          success: false,
          error: "We couldn't reach the payment service. You have not been charged.",
          code: "wallet_unavailable",
        }
      }
    }

    // Create (or reactivate) the enrollment — access unlocks here and never
    // before payment.
    let enrollment
    try {
      if (isRepurchase || isActivation) {
        // Restore (re-purchase) or activate (pre-enrollment) the audited row.
        // Progress is deliberately preserved either way. The filter pins the
        // status we read, so a concurrent purchase that already took the row
        // is detected below instead of silently overwritten.
        enrollment = await Enrollment.findOneAndUpdate(
          { user: user.id, course: courseId, status: isActivation ? "pre_enrolled" : "refunded" },
          {
            $set: {
              status: "active",
              pricePaid: price,
              currency: "USD",
              transactionId: chargeId,
              purchasedAt: new Date(),
              activatedAt: new Date(),
              legacyUnpaid: false,
              ...packageFields,
            },
          },
          { new: true }
        )
        if (!enrollment) {
          throw Object.assign(new Error("enrollment row changed concurrently"), { code: 11000 })
        }
      } else {
        enrollment = await Enrollment.create({
          user: user.id,
          course: courseId,
          pricePaid: price,
          currency: "USD",
          transactionId: chargeId,
          purchasedAt: new Date(),
          activatedAt: new Date(),
          ...packageFields,
        })
      }
    } catch (err: unknown) {
      const isDuplicate = typeof err === "object" && err !== null && (err as { code?: number }).code === 11000
      const winner = isDuplicate
        ? await Enrollment.findOne({ user: user.id, course: courseId, status: { $in: ["active", "completed"] } })
        : null
      // Raced with another request for the same user+course. Same package →
      // same reference → the wallet replayed ONE charge, so the winner holds our
      // charge (or nobody charged) and there is nothing to undo.
      if (winner && (!chargeId || winner.transactionId === chargeId)) {
        if (order) await transitionOrder(order, "enrolled", "concurrent enrollment")
        return {
          success: true,
          data: { enrollmentId: winner._id.toString(), alreadyEnrolled: true, packageName: winner.packageName ?? null },
        }
      }
      // Charged, but THIS charge bought no access (enrollment failed, or a
      // concurrent purchase of a different package took the row) — refund so no
      // money is kept without access. If the refund also fails, the
      // reconciliation job surfaces it.
      if (isPaid && chargeId) {
        try {
          await refundWalletCharge(user.authUserId, chargeId, "enrollment creation failed")
          if (order) {
            await transitionOrder(order, "refunded", "compensating refund after enroll failure")
            await logPaymentEvent(order._id, reference, "charge_refunded", { chargeId })
          }
        } catch (refundErr) {
          console.error("[Payments] ORPHANED CHARGE — refund failed, needs reconciliation:", chargeId, refundErr)
          if (order) {
            await transitionOrder(order, "failed", "enroll failed AND refund failed — orphaned charge")
            await logPaymentEvent(order._id, reference, "refund_failed", { chargeId })
          }
        }
      }
      if (winner) {
        return {
          success: true,
          data: { enrollmentId: winner._id.toString(), alreadyEnrolled: true, packageName: winner.packageName ?? null },
        }
      }
      console.error("Enroll in course error:", err)
      return { success: false, error: "Failed to enroll in course", code: "enroll_failed" }
    }

    if (order) await transitionOrder(order, "enrolled")

    // Instructor earnings: ledger row stays pending through the clearing
    // window, then clears into their central wallet balance.
    if (isPaid) {
      const feeMinor = Math.round(amountMinor * (1 - INSTRUCTOR_REVENUE_SHARE))
      const netMinor = amountMinor - feeMinor
      const instructor = await User.findById(course.instructor).select("authUserId")
      if (instructor?.authUserId) {
        try {
          await Earning.create({
            enrollment: enrollment._id,
            order: order?._id ?? null,
            course: course._id,
            instructor: course.instructor,
            instructorAuthUserId: instructor.authUserId,
            student: user.id,
            kind: "sale",
            grossMinor: amountMinor,
            feeMinor,
            netMinor,
            currency: "USD",
            status: "pending",
            availableAt: new Date(Date.now() + EARNINGS_CLEARING_DAYS * 24 * 60 * 60 * 1000),
            // Same generation suffix as the charge: a re-purchase is a new sale
            // and must earn again, but the enrollment id is unchanged so the
            // bare reference would collide with the original (refunded) sale.
            creditReference:
              generation > 0
                ? `academy_earn_${enrollment._id.toString()}_r${generation}`
                : `academy_earn_${enrollment._id.toString()}`,
            chargeId,
          })
        } catch (err) {
          console.error("[Earnings] failed to record sale earning:", err)
        }
      }
    }

    // Update course + instructor aggregates. Pre-enrollment already counted
    // this student, so activation only moves money aggregates.
    if (!isActivation) {
      await Course.findByIdAndUpdate(courseId, { $inc: { enrolledCount: 1 } })
    }
    await User.findByIdAndUpdate(course.instructor, {
      $inc: {
        ...(isActivation ? {} : { "instructorProfile.totalStudents": 1 }),
        "instructorProfile.totalEarnings": isPaid ? (price * INSTRUCTOR_REVENUE_SHARE) : 0,
      },
    })

    // Executive (D4): the instructor and admins schedule onboarding; the
    // buyer's intake form waits on the success page. Keyed on the Executive
    // tier — single "Full program" tiers also carry mentorship: true.
    if (pkg?.key === "executive" && pkg.entitlements.mentorship) {
      const buyer = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email
      const note = {
        type: "course" as const,
        title: `New ${pkg.name} enrollment`,
        body: `${buyer} enrolled in ${course.title} — schedule their onboarding.`,
      }
      void notifyUser(course.instructor.toString(), { ...note, href: `/instructor/courses/${courseId}` })
      void notifyAdmins({ ...note, href: `/admin/enrollments?course=${courseId}` })
    }

    void sendEnrollmentConfirmationEmail({
      to: user.email ?? "",
      firstName: user.firstName ?? "",
      courseTitle: course.title,
      courseId: course._id.toString(),
      availableAtIso: null,
      isPaid,
      price,
      packageName: packageFields.packageName,
    })

    revalidatePath("/dashboard/my-courses")
    revalidatePath(`/courses/${courseId}`)

    return {
      success: true,
      data: { enrollmentId: enrollment._id.toString(), packageName: packageFields.packageName },
    }
  } catch (error) {
    console.error("Enroll in course error:", error)
    return { success: false, error: "Failed to enroll in course", code: "enroll_failed" }
  }
}
```

   In `preEnrollCourse`'s `sendEnrollmentConfirmationEmail({ … })` call, add `packageName: null,` after `price: course.price ?? 0,`.

- [ ] **Step 3: Email.** In `lib/email.tsx`:
  - add to `EnrollmentEmailData`, after `price: number`:

```ts
  /** Package bought; null for pre-enrolments and single-price courses. */
  packageName: string | null
```

  - replace the whole `EnrollmentConfirmationEmail` function with:

```tsx
function EnrollmentConfirmationEmail({ data }: { data: EnrollmentEmailData }) {
  const courseUrl = `${APP_URL}/dashboard/courses/${data.courseId}`
  return (
    <Html style={base}>
      <Head />
      <Preview>
        {data.availableAtIso ? `You're enrolled in ${data.courseTitle}` : `Enrollment confirmed: ${data.courseTitle}`}
      </Preview>
      <Body style={body}>
        <Container style={card}>
          <Section style={contentPad}>
            <Text style={heading}>{data.availableAtIso ? "You're enrolled" : "Enrollment confirmed"}</Text>
            {data.availableAtIso ? (
              <>
                <Text style={sub}>
                  {data.firstName ? `${data.firstName} — you` : "You"}&apos;re in.
                  Your seat on <strong>{data.courseTitle}</strong> is reserved.
                </Text>
                <Text style={sub}>
                  The course isn&apos;t live yet — it opens on{" "}
                  <strong>{formatLaunch(data.availableAtIso)}</strong>. Nothing
                  was charged today{data.isPaid
                    ? ` — payment ($${data.price.toFixed(2)}) is only asked for when the course is live and you choose to start`
                    : ""}.
                </Text>
                <Text style={muted}>
                  We&apos;ll email you the moment it goes live.
                </Text>
              </>
            ) : (
              <>
                <Text style={sub}>
                  Welcome to {BRAND.name}. Your learning journey starts now.
                </Text>
                <Text style={sub}>
                  You now have access to <strong>{data.courseTitle}</strong>
                  {data.packageName ? ` — ${data.packageName}` : ""}.
                </Text>
              </>
            )}

            <Section style={{ marginTop: "28px" }}>
              <Button href={courseUrl} style={cta}>
                {data.availableAtIso ? "View the course" : "Start learning"}
              </Button>
            </Section>

            <Hr style={{ borderColor: "#E4E4E9", margin: "24px 0 16px" }} />

            <Link href={courseUrl} style={linkSmall}>
              {courseUrl}
            </Link>
          </Section>
        </Container>

        <Section style={footer}>
          <Text style={footerText}>{BRAND.name}</Text>
        </Section>
      </Body>
    </Html>
  )
}
```

  (The `#E4E4E9` literal is the existing email-client inline style, unchanged — emails can't read CSS variables.)

  - In `sendEnrollmentConfirmationEmail` replace ``subject: `You're enrolled: ${data.courseTitle}`,`` with:

```ts
      subject: data.availableAtIso
        ? `You're enrolled: ${data.courseTitle}`
        : `Enrollment confirmed: ${data.courseTitle}`,
```

- [ ] **Step 4: Vivid.** In `lib/vivid/actions/courses.ts`, `vividEnrollInCourse`, replace everything from `if (course.pricing === "free") {` through the end of the `return { success: true, needsCheckout: true, … }` object with:

```ts
    const sellsPackages = (course.packages ?? []).some((p) => p.enabled)

    if (course.pricing === "free" && !sellsPackages) {
      // Route through the shared purchase action so enrollment side-effects
      // (counts, instructor stats) stay in one place.
      const { purchaseCourse } = await import("@/lib/actions/enrollments")
      const result = await purchaseCourse({ courseId: course._id.toString() })
      if (!result.success) return { success: false, error: result.error }
      return { success: true, enrolled: true, message: "Enrolled successfully!" }
    }

    // Paid courses — and every course sold in packages — go through the real
    // checkout: the wallet debit happens server-side there and the student
    // picks their own package. Vivid never chooses a tier or marks a course
    // as purchased itself.
    return {
      success: true,
      needsCheckout: true,
      checkoutUrl: `/dashboard/checkout?courseId=${course._id}`,
      price: course.price,
      message: sellsPackages
        ? `This program comes in packages from $${course.price}. Opening checkout so you can choose one.`
        : `This course costs $${course.price}. Redirecting to checkout.`,
    }
```

- [ ] **Step 5: Call site.** In `app/(platform)/dashboard/checkout/page.tsx` change `const result = await purchaseCourse(course.id)` to `const result = await purchaseCourse({ courseId: course.id })`. Nothing else in that file changes in this task.

- [ ] **Step 6: Verify.** tsc and eslint on the four files. Then run the runtime checks below (the wallet stub must answer `__state`). Set `F=6aa7bc2845744c5eeb0eb781`, `C=6aa7bc2845744c5eeb0eb782`, `T=6a6fc0bb6433bbbd6322be07`, and `P="/dashboard/checkout?courseId=$F"`.
  1. `bash "$H/action.sh" "$P" purchaseCourse "[{\"courseId\":\"$F\"}]"` → `code: "package_required"`.
  2. `bash "$H/action.sh" "$P" purchaseCourse '[{"courseId":"nope"}]'` → `code: "invalid"`.
  3. `bash "$H/action.sh" "$P" purchaseCourse "[{\"courseId\":\"$F\",\"packageKey\":\"basic\"}]"` → `success: true`, `packageName: "Forex Foundation"`. Then `node "$H/mockdb.cjs" probe` shows:
     - order `academy_enroll_6a6fc0bb6433bbbd6322be61_6aa7bc2845744c5eeb0eb781_basic`, `amountMinor=4900 status=enrolled pkg=basic`;
     - the enrollment `status=active pkg=basic name="Forex Foundation" paid=49`;
     - an earning with `gross=4900`.
     `curl -s 127.0.0.1:4010/__state` shows one charge, `amountMinor 4900`, description `Course: Forex Trading Mastery — Forex Foundation`, `metadata.packageKey basic`.
  4. Repeat check 3 exactly → `alreadyEnrolled: true`, `packageName: "Forex Foundation"`; still one charge and one order.
  5. Insufficient funds. `curl -s -X POST 127.0.0.1:4010/__balance -H 'Content-Type: application/json' -d '{"authUserId":"user_mock_student","availableMinor":5000}'`, then buy `$C` `executive` (page `"/dashboard/checkout?courseId=$C"`) → `code: "insufficient_funds"`, `shortfallMinor: 94900`. Set the balance back to `150000` and retry → `success: true`, `packageName: "Private 1-on-1 Crypto Mentorship"`. Probe: the order ends `_executive`, `amountMinor=99900 status=enrolled`, and the latest notifications include `"New Private 1-on-1 Crypto Mentorship enrollment"` to instructor `6a6fc0ba6433bbbd6322bdfd` (href `/instructor/courses/<C>`) and to admin `6a6fc1258372b65d1ee8e972` (href `/admin/enrollments?course=<C>`).
  6. Blockchain single tier (Full program, mentorship true) as **admin**: buy `6aa7bc2845744c5eeb0eb783` `standard` (page `/dashboard/checkout?courseId=6aa7bc2845744c5eeb0eb783`, persona `admin`) → success. **No** new "enrollment" notification (Executive only). The order reference ends `_standard`.
  7. Legacy single price as **admin**: buy `$T` with `"packageKey":"standard"` (page `"/dashboard/checkout?courseId=$T"`, persona `admin`) → success. Probe admin (`node "$H/mockdb.cjs" probe 6a6fc1258372b65d1ee8e972`): order reference `academy_enroll_6a6fc1258372b65d1ee8e972_6a6fc0bb6433bbbd6322be07` (**no** package segment), `amountMinor=7900 pkg=null`; enrollment `pkg=null name=null`.
  8. Pre-enrolled activation carries the package: `node "$H/mockdb.cjs" preenrol 6a6fc1258372b65d1ee8e972 $F`, then as admin buy `$F` `standard` → success. Probe admin: that same enrollment id is now `status=active pkg=standard name="Forex Mastery" paid=199`, and `courses.enrolledCount` for Forex did not move (compare a quick read before/after).
  9. Concurrent purchase of two packages as admin on Crypto:

```bash
ID=$(PRINT_ID=1 bash "$H/action.sh" "/dashboard/checkout?courseId=$C" purchaseCourse '[]' admin)
post() { curl -s -X POST "http://localhost:3001/dashboard/checkout?courseId=$C" -H "Next-Action: $ID" -H "Accept: text/x-component" -H "Content-Type: text/plain;charset=UTF-8" -b "mock_persona=admin" --data "[{\"courseId\":\"$C\",\"packageKey\":\"$1\"}]" | tail -1; echo; }
post basic & post standard & wait
```

     Both print `success: true`. Probe admin: exactly **one** Crypto enrollment. In `__state`, the admin's Crypto charges have **at most one** with `status: "succeeded"`; if two were charged, the other is `refunded` and its order is `status=refunded`. Report which way the race went (it may not overlap; that is fine, say so).
  10. End: `node "$H/mockdb.cjs" restore` and `curl -s -X POST 127.0.0.1:4010/__reset`.

- [ ] **Step 7: Commit.**

```bash
git add lib/actions/enrollments.ts lib/email.tsx lib/vivid/actions/courses.ts "app/(platform)/dashboard/checkout/page.tsx"
git commit -m "feat(checkout): purchaseCourse charges the chosen package; race-safe activation, Executive notice, confirmation email

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Checkout page with package summary + switcher; "Enrollment confirmed" page; Executive intake

**Files:**
- Modify: `lib/actions/student.ts` (the `fetchProgramBySlug` block at ≈ lines 334–425 becomes a shared finder + two exports)
- Modify: `lib/actions/enrollments.ts` (append `CheckoutConfirmation`, `getCheckoutConfirmation`, `submitMentorshipIntake`; imports)
- Modify: `app/(platform)/dashboard/checkout/page.tsx` (whole file)
- Modify: `app/(platform)/dashboard/checkout/success/page.tsx` (whole file — becomes a server component)
- Create: `components/checkout/mentorship-intake-form.tsx`

**Interfaces:**
- Consumes:
  - `purchaseCourse({ courseId, packageKey })` and `PurchaseResult` (Task 2);
  - `getCourseAccess`, `CourseAccess` (Task 1);
  - `canAccessLesson`, `PACKAGE_LABEL` (Task 1);
  - `ProgramDetail`, `PublicPackage` from `lib/actions/student.ts` (Phase 2). `packages` is never empty and is in ladder order; `tierCount` 0 means the ladder was synthesized.
  - `SCHOOL_BY_SLUG` from `@/lib/schools`; `IEnrollment.mentorshipIntake` (Task 1).
- Produces:
  - `fetchProgramById(courseId: string): Promise<ProgramDetail | null>`
  - `type CheckoutConfirmation = { courseId: string; courseTitle: string; packageName: string | null; startLessonId: string | null; needsIntake: boolean; intakeSent: boolean }`
  - `getCheckoutConfirmation(courseId: string): Promise<CheckoutConfirmation | null>`
  - `submitMentorshipIntake(courseId: string, input: { goals: string; availability: string }): Promise<{ success: true } | { success: false; error: string }>`
  - The success URL stays `/dashboard/checkout/success?courseId=<id>`; its "Go to dashboard" links `/dashboard?welcome=1` (Phase 4 reads the flag).

- [ ] **Step 1: Program by id.** In `lib/actions/student.ts`, replace from the doc comment `/**\n * Fetch one published program by slug for the public program page.\n */` through the closing `}` of `fetchProgramBySlug` with the block below. The body of `findProgram` is the old `fetchProgramBySlug` body, unchanged except the query filter and the missing try/catch/connectDB:

```ts
/** Shared finder behind the program page (by slug) and checkout (by id). */
async function findProgram(filter: { slug: string } | { _id: string }): Promise<ProgramDetail | null> {
  const course = await Course.findOne({ ...filter, status: "published" })
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
            price: course.pricing === "free" ? 0 : course.price ?? 0,
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
}

/**
 * Fetch one published program by slug for the public program page.
 */
export async function fetchProgramBySlug(slug: string): Promise<ProgramDetail | null> {
  try {
    await connectDB()
    return await findProgram({ slug })
  } catch (error) {
    console.error("Fetch program by slug error:", error)
    return null
  }
}

/**
 * The same program by course id — checkout's order summary and package
 * switcher. Invalid ids and unpublished courses resolve to null.
 */
export async function fetchProgramById(courseId: string): Promise<ProgramDetail | null> {
  try {
    if (!mongoose.isValidObjectId(courseId)) return null
    await connectDB()
    return await findProgram({ _id: courseId })
  } catch (error) {
    console.error("Fetch program by id error:", error)
    return null
  }
}
```

- [ ] **Step 2: Confirmation + intake actions.** In `lib/actions/enrollments.ts`:
  - add `import { getCourseAccess } from "@/lib/course-access"` under the `@/lib/notify` import;
  - change the entitlements import to `import { canAccessLesson, packageFor } from "@/lib/entitlements"`;
  - append at the end of the file:

```ts
// ============================================================================
// CHECKOUT CONFIRMATION (spec §12, §17 "Enrollment confirmed")
// ============================================================================

export type CheckoutConfirmation = {
  courseId: string
  courseTitle: string
  packageName: string | null
  /** First lesson this package opens — "Start learning" lands there; null when the course has none. */
  startLessonId: string | null
  /** Executive buyers who haven't sent their onboarding intake yet (D4). */
  needsIntake: boolean
  /** Executive buyers whose intake is already with their mentor. */
  intakeSent: boolean
}

/** What the success page confirms. null when the caller has no access-granting enrollment on the course. */
export async function getCheckoutConfirmation(courseId: string): Promise<CheckoutConfirmation | null> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return null

    const access = await getCourseAccess(user.id, courseId)
    if (!access) return null

    const [course, enrollment, lessons] = await Promise.all([
      Course.findById(courseId).select("title").lean(),
      Enrollment.findById(access.enrollmentId).select("mentorshipIntake").lean(),
      Lesson.find({ course: courseId }).sort({ order: 1 }).select("_id minPackageKey isFree").lean(),
    ])
    if (!course) return null

    const start = lessons.find((lesson) => canAccessLesson(access.course, lesson, access))
    const executive = access.packageKey === "executive" && access.entitlements.mentorship
    return {
      courseId,
      courseTitle: course.title,
      packageName: access.packageName,
      startLessonId: start ? start._id.toString() : null,
      needsIntake: executive && !enrollment?.mentorshipIntake,
      intakeSent: executive && Boolean(enrollment?.mentorshipIntake),
    }
  } catch (error) {
    console.error("Get checkout confirmation error:", error)
    return null
  }
}

const IntakeInput = z.object({
  goals: z.string().trim().min(10, "Tell your mentor a little more about your goals").max(2000, "Keep your goals under 2,000 characters"),
  availability: z.string().trim().min(2, "Share when you're usually available").max(500, "Keep availability under 500 characters"),
})

/**
 * One-time Executive onboarding intake (D4). Goals and availability are stored
 * on the enrollment and sent to the instructor, who schedules onboarding —
 * session booking itself is Phase 7.
 */
export async function submitMentorshipIntake(
  courseId: string,
  input: { goals: string; availability: string }
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "You need to be signed in" }

    const access = await getCourseAccess(user.id, courseId)
    if (!access || access.packageKey !== "executive" || !access.entitlements.mentorship) {
      return { success: false, error: "Your package doesn't include mentorship" }
    }

    const parsed = IntakeInput.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again" }
    }

    // The filter only matches an enrollment without an intake: one-time, race-safe.
    const updated = await Enrollment.findOneAndUpdate(
      { _id: access.enrollmentId, mentorshipIntake: null },
      { $set: { mentorshipIntake: { ...parsed.data, submittedAt: new Date() } } },
      { new: true }
    )
    if (!updated) return { success: false, error: "You've already sent your intake" }

    const buyer = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email
    void notifyUser(access.course.instructorId, {
      type: "course",
      title: "Executive intake received",
      body: `${buyer}: ${parsed.data.goals}`.slice(0, 500),
      href: `/instructor/courses/${courseId}`,
    })

    revalidatePath("/dashboard/checkout/success")
    return { success: true }
  } catch (error) {
    console.error("Submit mentorship intake error:", error)
    return { success: false, error: "Couldn't send your intake — try again" }
  }
}
```

- [ ] **Step 3: Checkout page.** Replace the whole of `app/(platform)/dashboard/checkout/page.tsx` with:

```tsx
"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { Topbar } from "@/components/platform/topbar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useUser } from "@/components/providers/user-provider"
import { purchaseCourse, checkEnrollment } from "@/lib/actions/enrollments"
import { getMyWalletBalance, type MyWalletBalance } from "@/lib/actions/wallet"
import { fetchProgramById, type ProgramDetail, type PublicPackage } from "@/lib/actions/student"
import { PACKAGE_LABEL } from "@/lib/entitlements"
import { SCHOOL_BY_SLUG } from "@/lib/schools"
import { cn } from "@/lib/utils"
import {
  BookOpenIcon,
  CheckIcon,
  ChevronLeftIcon,
  CircleCheckIcon,
  LoaderCircleIcon,
  ShieldCheckIcon,
} from "lucide-react"

/** Package prices are whole dollars. */
function dollars(price: number): string {
  return price === 0 ? "Free" : `$${price.toLocaleString("en-US")}`
}

export default function CheckoutPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const user = useUser()

  const courseId = searchParams.get("courseId")
  const packageParam = searchParams.get("package")
  const [program, setProgram] = useState<ProgramDetail | null>(null)
  const [wallet, setWallet] = useState<MyWalletBalance | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shortfallMinor, setShortfallMinor] = useState<number | null>(null)

  useEffect(() => {
    if (!courseId) {
      setIsLoading(false)
      return
    }
    // Fetch program, enrollment state and central wallet balance in parallel
    Promise.all([
      fetchProgramById(courseId),
      user ? checkEnrollment(user.id, courseId) : Promise.resolve({ isEnrolled: false }),
      getMyWalletBalance(),
    ]).then(([p, enrollment, walletBalance]) => {
      if (enrollment.isEnrolled) {
        // Already enrolled — skip checkout entirely
        router.replace(`/dashboard/checkout/success?courseId=${courseId}`)
        return
      }
      setProgram(p)
      setWallet(walletBalance)
      setIsLoading(false)
    })
  }, [courseId, user, router])

  // The URL carries the package, so the wallet-funding round trip (which
  // returns to this exact URL) keeps the buyer's choice. A single-tier program
  // needs no choice.
  const packages = program?.packages ?? []
  const selected: PublicPackage | null =
    packages.length === 1 ? packages[0] : (packages.find((p) => p.key === packageParam) ?? null)

  function choosePackage(key: PublicPackage["key"]) {
    if (!courseId) return
    setError(null)
    setShortfallMinor(null)
    router.replace(`/dashboard/checkout?courseId=${courseId}&package=${key}`, { scroll: false })
  }

  function openFunding() {
    if (!wallet) return
    // Internal wallet deposit page (default): navigate in-tab with the
    // shortfall prefilled and a redirect straight back to this checkout.
    if (wallet.fundingUrl.startsWith("/")) {
      const returnTo =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : `/dashboard/checkout?courseId=${courseId}`
      const params = new URLSearchParams({ redirect: returnTo })
      if (shortfallMinor && shortfallMinor > 0) params.set("suggestMinor", String(shortfallMinor))
      router.push(`${wallet.fundingUrl}?${params.toString()}`)
      return
    }
    // External override (central dashboard) — keep the legacy new-tab flow.
    const returnTo = typeof window !== "undefined" ? window.location.href : ""
    const url = `${wallet.fundingUrl}${wallet.fundingUrl.includes("?") ? "&" : "?"}redirect=${encodeURIComponent(returnTo)}`
    window.open(url, "_blank", "noopener")
  }

  async function handlePurchase() {
    if (!program || !user || !selected) return
    setIsProcessing(true)
    setError(null)
    setShortfallMinor(null)

    try {
      // The server derives identity from the session and the price from the
      // course's package; enrollment is only granted after the central
      // Worldstreet wallet confirms the debit. No optimistic success. A program
      // without a package ladder (tierCount 0) shows one synthesized tier — the
      // server ignores a key there, so none is sent.
      const result = await purchaseCourse({
        courseId: program.id,
        packageKey: program.tierCount > 0 ? selected.key : undefined,
      })

      if (result.success) {
        setIsSuccess(true)
        router.push(`/dashboard/checkout/success?courseId=${program.id}`)
      } else {
        if (result.code === "insufficient_funds") {
          setShortfallMinor(result.shortfallMinor ?? null)
          setError(null)
          // Refresh the displayed balance to what the wallet reported
          getMyWalletBalance().then(setWallet)
        } else {
          setError(result.error || "Something went wrong")
        }
        setIsProcessing(false)
      }
    } catch {
      setError("Something went wrong. You have not been charged.")
      setIsProcessing(false)
    }
  }

  if (isLoading) {
    return (
      <>
        <Topbar title="Checkout" />
        <div className="flex-1 flex items-center justify-center">
          <LoaderCircleIcon size={24} className="animate-spin text-ws-muted" />
        </div>
      </>
    )
  }

  if (!program || !courseId) {
    return (
      <>
        <Topbar title="Checkout" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <p className="text-sm text-ws-muted">Program not found</p>
            <Button variant="outline" onClick={() => router.back()}>
              Go Back
            </Button>
          </div>
        </div>
      </>
    )
  }

  const price = selected ? selected.price : null
  const school = program.school ? SCHOOL_BY_SLUG[program.school] : null
  const multiTier = packages.length > 1

  return (
    <>
      <Topbar title="Checkout" />
      <div className="flex-1 overflow-y-auto pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8">
        <div className="max-w-lg mx-auto px-4 md:px-6 py-8 space-y-6">
          {/* Back */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-ws-muted hover:text-ws-primary transition-colors"
          >
            <ChevronLeftIcon size={14} />
            Back
          </button>

          {/* Program */}
          <div className="rounded-lg border border-ws-hairline bg-ws-surface overflow-hidden">
            <div className="relative aspect-[21/9] bg-ws-raised">
              {program.thumbnailUrl ? (
                <Image src={program.thumbnailUrl} alt={program.title} fill className="object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <BookOpenIcon size={32} className="text-ws-subtle" />
                </div>
              )}
            </div>
            <div className="p-4">
              {school && (
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ws-muted">{school.short}</p>
              )}
              <h1 className="mt-1 text-base font-semibold text-ws-primary">{program.title}</h1>
              <p className="mt-0.5 text-xs text-ws-muted">
                by {program.instructorName} · <span className="tabular-nums">{program.totalLessons}</span> lessons
              </p>
            </div>
          </div>

          {/* Package switcher — doubles as the ladder when no package is chosen */}
          {multiTier && (
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-semibold text-ws-primary">
                {selected ? "Your package" : "Choose your package"}
              </legend>
              {packages.map((pkg) => {
                const active = pkg.key === selected?.key
                return (
                  <label
                    key={pkg.key}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors duration-[var(--ws-motion-fast)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ws-brand/40",
                      active ? "border-ws-brand/40 bg-ws-raised" : "border-ws-hairline bg-ws-surface hover:bg-ws-raised"
                    )}
                  >
                    <input
                      type="radio"
                      name="package"
                      value={pkg.key}
                      checked={active}
                      onChange={() => choosePackage(pkg.key)}
                      className="sr-only"
                    />
                    <span
                      aria-hidden
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                        active ? "border-ws-brand bg-ws-brand text-ws-brand-on" : "border-ws-hairline"
                      )}
                    >
                      {active && <CheckIcon size={10} strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-ws-muted">
                        {PACKAGE_LABEL[pkg.key]}
                      </span>
                      <span className="block truncate text-sm font-medium text-ws-primary">{pkg.name}</span>
                      {pkg.tagline && <span className="block truncate text-xs text-ws-muted">{pkg.tagline}</span>}
                    </span>
                    <span className="font-display text-lg font-light tabular-nums text-ws-primary">
                      {dollars(pkg.price)}
                    </span>
                  </label>
                )
              })}
            </fieldset>
          )}

          {/* What the chosen package includes (collapsed) */}
          {selected && selected.features.length > 0 && (
            <details className="rounded-lg border border-ws-hairline bg-ws-surface px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium text-ws-primary">
                What&apos;s included <span className="tabular-nums text-ws-muted">({selected.features.length})</span>
              </summary>
              <ul className="mt-3 space-y-2">
                {selected.features.map((feature, i) => (
                  <li key={`${selected.key}-${i}`} className="flex items-start gap-2 text-[13px] leading-relaxed text-ws-muted">
                    <CheckIcon size={14} className="mt-0.5 shrink-0" aria-hidden />
                    {feature}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {/* Order Summary */}
          {selected && price !== null && (
            <div className="rounded-lg border border-ws-hairline bg-ws-surface p-4 space-y-4">
              <h2 className="text-sm font-semibold text-ws-primary">Order summary</h2>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-ws-muted">
                    {program.tierCount > 0 ? selected.name : "Program price"}
                  </span>
                  <span className="font-medium tabular-nums text-ws-primary">{dollars(price)}</span>
                </div>
                {price > 0 && wallet?.enabled && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-ws-muted">Worldstreet balance</span>
                    <span
                      className={cn(
                        "font-medium tabular-nums",
                        wallet.usdAvailable >= price ? "text-ws-primary" : "text-ws-danger"
                      )}
                    >
                      ${wallet.usdAvailable.toFixed(2)}
                    </span>
                  </div>
                )}
                <Separator />
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-ws-primary">Total</span>
                  <span className="font-display text-3xl font-light tabular-nums tracking-[-0.02em] text-ws-primary">
                    {dollars(price)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Secure checkout note */}
          <div className="flex items-center gap-2 justify-center text-xs text-ws-subtle">
            <ShieldCheckIcon size={13} />
            <span>
              {!price
                ? "Secure checkout"
                : "Paid from your Worldstreet wallet — funding & withdrawals live on the Worldstreet dashboard"}
            </span>
          </div>

          {/* Insufficient funds */}
          {shortfallMinor !== null && (
            <div className="rounded-lg bg-ws-warning/10 border border-ws-warning/20 px-4 py-3 space-y-2">
              <p className="text-sm font-medium text-ws-warning">Insufficient balance</p>
              <p className="text-xs text-ws-muted">
                You need ${(shortfallMinor / 100).toFixed(2)} more in your Worldstreet wallet for this
                package. Top up on the Worldstreet dashboard, then come back — your order will still be here.
              </p>
              <Button variant="outline" size="sm" className="w-full" onClick={openFunding}>
                Fund my Worldstreet wallet
              </Button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-ws-danger/10 border border-ws-danger/20 px-4 py-3">
              <p className="text-sm text-ws-danger">{error}</p>
            </div>
          )}

          {/* CTA */}
          <Button
            onClick={handlePurchase}
            disabled={!selected || isProcessing || isSuccess}
            className="w-full h-12 text-sm font-semibold gap-2"
            size="lg"
          >
            {isSuccess ? (
              <>
                <CircleCheckIcon size={16} />
                Enrolled! Redirecting...
              </>
            ) : isProcessing ? (
              <>
                <LoaderCircleIcon size={16} className="animate-spin" />
                Processing...
              </>
            ) : !selected || price === null ? (
              "Choose a package to continue"
            ) : (
              <>
                <CircleCheckIcon size={16} />
                {price === 0 ? "Enrol for free" : `Pay ${dollars(price)}`}
              </>
            )}
          </Button>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 4: Success page.** Replace the whole of `app/(platform)/dashboard/checkout/success/page.tsx` with:

```tsx
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowRightIcon, CircleCheckIcon } from "lucide-react"
import { Topbar } from "@/components/platform/topbar"
import { Button } from "@/components/ui/button"
import { BRAND } from "@/lib/brand"
import { getCheckoutConfirmation } from "@/lib/actions/enrollments"
import { MentorshipIntakeForm } from "@/components/checkout/mentorship-intake-form"

/** Spec §12/§17 "Enrollment confirmed" — server-rendered from the enrollment, never from query params. */
export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ courseId?: string }>
}) {
  const { courseId } = await searchParams
  const confirmation = courseId ? await getCheckoutConfirmation(courseId) : null

  // No access-granting enrollment (bad link, unpaid reservation, refund) —
  // the course page holds the right next step.
  if (!confirmation) {
    redirect(courseId ? `/dashboard/courses/${courseId}` : "/dashboard/my-courses")
  }

  const startHref = confirmation.startLessonId
    ? `/dashboard/courses/${confirmation.courseId}/learn/${confirmation.startLessonId}`
    : `/dashboard/courses/${confirmation.courseId}`

  return (
    <>
      <Topbar title="Enrollment confirmed" />
      <div className="flex-1 px-4 pb-24 md:pb-8">
        <div className="mx-auto w-full max-w-md space-y-8 py-16">
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-ws-success/10">
              <CircleCheckIcon size={32} className="text-ws-success" aria-hidden />
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-[-0.015em] text-ws-primary">
              Enrollment confirmed
            </h1>
            <p className="text-sm leading-relaxed text-ws-muted">
              Welcome to {BRAND.name}. Your learning journey starts now.
            </p>
            <div className="rounded-lg bg-ws-surface px-4 py-3 text-left">
              <p className="text-sm font-medium text-ws-primary">{confirmation.courseTitle}</p>
              {confirmation.packageName && (
                <p className="mt-0.5 text-xs text-ws-muted">{confirmation.packageName}</p>
              )}
            </div>
          </div>

          {confirmation.needsIntake && <MentorshipIntakeForm courseId={confirmation.courseId} />}
          {confirmation.intakeSent && (
            <p className="text-center text-xs text-ws-muted">
              Your mentor has your intake — they&apos;ll be in touch to schedule onboarding.
            </p>
          )}

          <div className="space-y-3">
            <Button className="h-11 w-full gap-2" size="lg" render={<Link href={startHref} />}>
              Start learning
              <ArrowRightIcon size={16} aria-hidden />
            </Button>
            <Button variant="outline" className="h-11 w-full" size="lg" render={<Link href="/dashboard?welcome=1" />}>
              Go to dashboard
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
```

   (`redirect()` returns `never`, so `confirmation` is non-null below it. If tsc disagrees, add `return` in front of `redirect(…)`.)

- [ ] **Step 5: Intake form.** Create `components/checkout/mentorship-intake-form.tsx`:

```tsx
"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { submitMentorshipIntake } from "@/lib/actions/enrollments"

/**
 * One-time Executive onboarding intake (D4): goals and availability go to the
 * instructor, who schedules the first session. Booking itself is Phase 7.
 */
export function MentorshipIntakeForm({ courseId }: { courseId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [goals, setGoals] = useState("")
  const [availability, setAvailability] = useState("")
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      className="space-y-4 rounded-lg bg-ws-surface p-5"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        startTransition(async () => {
          const res = await submitMentorshipIntake(courseId, { goals, availability })
          if (res.success) router.refresh()
          else setError(res.error)
        })
      }}
    >
      <div>
        <h2 className="text-sm font-semibold text-ws-primary">Tell your mentor about you</h2>
        <p className="mt-1 text-xs text-ws-muted">Your instructor uses this to plan your onboarding session.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="intake-goals">What do you want to achieve?</Label>
        <Textarea
          id="intake-goals"
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          maxLength={2000}
          className="min-h-24"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="intake-availability">When are you usually available?</Label>
        <Textarea
          id="intake-availability"
          value={availability}
          onChange={(e) => setAvailability(e.target.value)}
          maxLength={500}
          placeholder="e.g. Weekday evenings, GMT+1"
          className="min-h-16"
          required
        />
      </div>
      {error && <p className="text-xs text-ws-danger">{error}</p>}
      <Button type="submit" variant="outline" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send to my mentor"}
      </Button>
    </form>
  )
}
```

- [ ] **Step 6: Verify.** tsc; `npx eslint lib/actions/student.ts lib/actions/enrollments.ts "app/(platform)/dashboard/checkout/page.tsx" "app/(platform)/dashboard/checkout/success/page.tsx" components/checkout/mentorship-intake-form.tsx`. Then:
  1. Program by id: `bash "$H/action.sh" "/dashboard/checkout?courseId=$F" fetchProgramById "[\"$F\"]"` → JSON with `tierCount: 3` and packages `basic, standard, executive` in that order. With `'["nope"]'` → `null`. The program page `/programs/forex-trading-mastery` still returns 200 with the three package names (strip scripts first).
  2. Buy Forex Basic as the student (Task 2 check 3). `curl -s -b mock_persona=student "http://localhost:3001/dashboard/checkout/success?courseId=$F" | perl -pe 's/<script\b.*?<\/script>//gs'` contains `Enrollment confirmed`, `Your learning journey starts now.`, `Forex Foundation`, `/dashboard?welcome=1`, and **no** `Tell your mentor about you`.
  3. Buy Crypto Executive as the student. The success page for `$C` contains `Tell your mentor about you`. Then:
     - `bash "$H/action.sh" "/dashboard/checkout/success?courseId=$C" submitMentorshipIntake "[\"$C\",{\"goals\":\"Build a disciplined swing-trading plan\",\"availability\":\"Weekday evenings, GMT+1\"}]"` → `{"success":true}`.
     - The same call again → `You've already sent your intake`.
     - `{"goals":"short","availability":"x"}` on a fresh Executive buyer is refused with the goals message (just check the message on the second call's shape if you have no fresh buyer; say which).
     - The success page now shows `Your mentor has your intake` and no form. Probe: the enrollment `intake=yes`, plus a notification `"Executive intake received"` to the instructor.
  4. Intake refused for non-Executive: as the student (Basic on Forex) `submitMentorshipIntake` on `$F` → `Your package doesn't include mentorship`.
  5. Not enrolled: `curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" -b mock_persona=student "http://localhost:3001/dashboard/checkout/success?courseId=6aa7bc2845744c5eeb0eb783"` → 307 to `/dashboard/courses/6aa7bc2845744c5eeb0eb783`.
  6. Browser, phone width, student:
     - `$B viewport 400x800`, `$B goto "http://localhost:3001/dashboard/checkout?courseId=6aa7bc2845744c5eeb0eb784"` (AI, single $199 tier; not enrolled), `$B wait --load` → no radio list; total `$199`; button `Pay $199`.
     - `$B goto "http://localhost:3001/dashboard/checkout?courseId=$F"` after `node "$H/mockdb.cjs" restore`, so the student isn't enrolled → legend `Choose your package`, three radios, button `Choose a package to continue` (disabled).
     - `$B js "document.querySelector('input[value=standard]').click(); location.search"` → contains `package=standard`; the total reads `$199`.
     - `$B js "document.body.scrollWidth + '/' + window.innerWidth"` → `400/400`.
     - Save `$B screenshot --viewport "$H/t3-checkout-400.png"`; `$B console --errors` shows nothing from checkout.
  7. End: `node "$H/mockdb.cjs" restore` and the stub `__reset`.

- [ ] **Step 7: Commit.**

```bash
git add lib/actions/student.ts lib/actions/enrollments.ts "app/(platform)/dashboard/checkout/page.tsx" "app/(platform)/dashboard/checkout/success/page.tsx" components/checkout/mentorship-intake-form.tsx
git commit -m "feat(checkout): package summary + switcher, Enrollment confirmed page, one-time Executive intake

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Lesson enforcement — locked lessons, media withheld, completion never creates enrollments, progress over open lessons

**Files:**
- Create: `components/learn/package-lock-notice.tsx`
- Modify: `lib/actions/student.ts` (imports; `LearnLesson`; `LearnCourse`; `fetchCourseForLearning`; `markLessonComplete`; `markCourseComplete`)
- Modify: `lib/actions/enrollments.ts` (`completeLesson`, `updateLastAccessed`, `getEnrollmentProgress`)
- Modify: `lib/actions/watch-progress.ts` (`saveWatchProgress`, `getLessonWatchProgress`)
- Modify: `lib/actions/resources.ts` (`listCourseResources`, `getResourceDownloadUrl`)
- Modify: `app/(platform)/dashboard/courses/[courseId]/learn/[lessonId]/page.tsx`
- Modify: `components/learn/lesson-sidebar.tsx`, `components/learn/mobile-lesson-list.tsx`

**Interfaces:**
- Consumes: `getCourseAccess`, `lockedLessonIds`, `isLessonLockedFor` (Task 1); `canAccessLesson`, `effectiveLessonTier`, `entitlementsFor`, `PACKAGE_LABEL` (Task 1).
- Produces:
  - `PackageLockNotice({ title: string; requiredLabel: string | null; compact?: boolean })`: a server-safe component (no hooks) that Tasks 5 and 6 reuse.
  - `LearnLesson.locked: boolean`; `LearnLesson.requiredPackage: PackageKey | null`.
  - `LearnCourse.slug: string`; `LearnCourse.packageKey: PackageKey | null`; `LearnCourse.entitlements: IPackageEntitlements` (full access for the course's instructor and admins). Task 6 reads `entitlements.instructorQa` on the learn page.
  - `completeLesson` failure may carry `code: "package_locked"`.

- [ ] **Step 1: Lock notice.** Create `components/learn/package-lock-notice.tsx`:

```tsx
import Link from "next/link"
import { LockIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * What a student sees where their package stops — a lesson, an assessment, a
 * live class, instructor Q&A. Packages can't be changed at checkout in v1 (D5):
 * support moves an enrollment to another package, so the only action is a
 * support link, never a purchase.
 */
export function PackageLockNotice({
  title,
  requiredLabel,
  compact = false,
}: {
  title: string
  /** Tier that includes it ("Standard"), or null when no tier on sale does. */
  requiredLabel: string | null
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        "flex gap-3",
        compact ? "flex-wrap items-center" : "flex-col items-center gap-4 text-center"
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ws-raised">
        <LockIcon size={18} className="text-ws-muted" aria-hidden />
      </div>
      <div className={cn("space-y-1", compact && "min-w-0 flex-1")}>
        <p className="text-sm font-semibold text-ws-primary">{title}</p>
        <p className="text-xs leading-relaxed text-ws-muted">
          {requiredLabel ? `Included from the ${requiredLabel} package.` : "Not included in your package."} To
          change your package, contact support.
        </p>
      </div>
      <Button variant="outline" size="sm" render={<Link href="/dashboard/help" />}>
        Contact support
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Learn data.** In `lib/actions/student.ts`:
  - change the entitlements import to `import { FULL_ACCESS, PACKAGE_RANK, canAccessLesson, effectiveLessonTier, entitlementsFor } from "@/lib/entitlements"`;
  - add `import { getCourseAccess, lockedLessonIds } from "@/lib/course-access"` below it;
  - add to `LearnLesson` after `isFree: boolean`:

```ts
  /** The student's package can't open this lesson — media is withheld and the page shows a lock notice. */
  locked: boolean
  /** Tier that opens a locked lesson; null when the lesson is open. */
  requiredPackage: PackageKey | null
```

  - add to `LearnCourse` after `rating: number | null`:

```ts
  slug: string
  /** The viewer's package; null for legacy enrollments and for course staff. */
  packageKey: PackageKey | null
  /** What the viewer's package includes — full access for the course's instructor and admins. */
  entitlements: IPackageEntitlements
```

   In `fetchCourseForLearning` replace the block from `const user = await getCurrentUser()` through the end of the `return { … }` object with:

```ts
    const user = await getCurrentUser()
    let hasAccess = false
    let enrollment: { packageKey: PackageKey | null } | null = null
    if (user) {
      if (user.role === "ADMIN") {
        hasAccess = true
      } else if (
        (course.instructor as unknown as { _id?: { toString(): string } })?._id?.toString() === user.id
      ) {
        hasAccess = true
      } else {
        const found = await Enrollment.findOne({
          user: user.id,
          course: courseId,
          status: { $in: ["active", "completed"] },
        }).select("_id packageKey")
        hasAccess = Boolean(found)
        enrollment = found ? { packageKey: found.packageKey ?? null } : null
      }
    }

    const instructor = course.instructor as unknown as {
      _id: { toString(): string }
      firstName: string
      lastName: string
      avatarUrl: string
    }

    const lessons = await Lesson.find({ course: courseId })
      .sort({ order: 1 })
      .lean()

    const packages = course.packages ?? []

    return {
      id: course._id.toString(),
      title: course.title,
      instructorId: instructor._id.toString(),
      instructorName: `${instructor.firstName} ${instructor.lastName}`,
      instructorAvatarUrl: instructor.avatarUrl,
      rating: course.rating?.average || null,
      slug: course.slug,
      packageKey: enrollment?.packageKey ?? null,
      entitlements: entitlementsFor({ packages }, enrollment),
      hasAccess,
      lessons: lessons.map((l) => {
        // Staff have no enrollment → nothing locks for them.
        const locked = hasAccess && !canAccessLesson({ packages }, l, enrollment)
        const unlocked = (hasAccess && !locked) || l.isFree
        return {
          id: l._id.toString(),
          courseId: courseId,
          title: l.title,
          description: l.description || "",
          type: l.type as "video" | "live" | "text",
          videoUrl: unlocked ? (l.videoUrl || null) : null,
          thumbnailUrl: l.videoThumbnailUrl || null,
          content: unlocked ? (l.content || null) : null,
          duration: l.videoDuration ? Math.round(l.videoDuration / 60) : null,
          order: l.order,
          isFree: l.isFree,
          locked,
          requiredPackage: locked ? effectiveLessonTier({ packages }, l) : null,
        }
      }),
    }
```

   (Keep the existing `const { Lesson, Enrollment } = await import("@/lib/db/models")` and `getCurrentUser` dynamic imports above it as they are.)

- [ ] **Step 3: Completion never creates enrollments.** In `lib/actions/student.ts` replace the whole `markLessonComplete` function with:

```ts
export async function markLessonComplete(courseId: string, lessonId: string): Promise<{ success: boolean }> {
  "use server"
  try {
    await connectDB()
    const user = await getAuthenticatedUser()
    const { Lesson } = await import("@/lib/db/models")

    // Progress lives on an enrollment the student already has — this never
    // creates one (it used to, handing an active enrollment and full access on
    // any course to anyone who called the action).
    const enrollment = await Enrollment.findOne({
      user: user._id,
      course: courseId,
      status: { $in: ["active", "completed"] },
    })
    if (!enrollment) return { success: false }

    const lessonIds = (await Lesson.find({ course: courseId }).select("_id").lean()).map((l) => l._id.toString())
    if (!lessonIds.includes(lessonId)) return { success: false }

    const locked = await lockedLessonIds(await getCourseAccess(user._id.toString(), courseId))
    if (locked.has(lessonId)) return { success: false }

    if (!enrollment.completedLessons.some((id: { toString(): string }) => id.toString() === lessonId)) {
      enrollment.completedLessons.push(new mongoose.Types.ObjectId(lessonId))
    }

    // Progress counts only the lessons this package opens.
    const open = new Set(lessonIds.filter((id) => !locked.has(id)))
    const done = enrollment.completedLessons.filter((id: { toString(): string }) => open.has(id.toString())).length
    enrollment.progress = open.size > 0 ? Math.min(100, Math.round((done / open.size) * 100)) : 0
    enrollment.lastAccessedAt = new Date()

    await enrollment.save()

    return { success: true }
  } catch (error) {
    console.error("Mark lesson complete error:", error)
    return { success: false }
  }
}
```

   Replace the whole `markCourseComplete` function with:

```ts
export async function markCourseComplete(
  courseId: string
): Promise<{ success: boolean; requiresExam?: boolean }> {
  "use server"
  try {
    await connectDB()
    const user = await getAuthenticatedUser()

    // Never creates an enrollment (it used to hand a completed enrollment —
    // and so a certificate — to anyone who called this action).
    const enrollment = await Enrollment.findOne({
      user: user._id,
      course: courseId,
      status: { $in: ["active", "completed"] },
    })
    if (!enrollment) return { success: false }

    // CBT gate: when the course requires an exam, completion only happens
    // through a passing attempt (lib/actions/exams.ts) — unless the package has
    // no assessment & certificate (Basic), which completes on its lessons.
    const [course, access] = await Promise.all([
      Course.findById(courseId).select("examRequired").lean(),
      getCourseAccess(user._id.toString(), courseId),
    ])
    const examGates = !!course?.examRequired && (access?.entitlements.certificate ?? true)

    enrollment.progress = 100
    enrollment.lastAccessedAt = new Date()
    if (examGates && !enrollment.examPassed) {
      await enrollment.save()
      return { success: true, requiresExam: true }
    }
    enrollment.status = "completed"
    enrollment.completedAt = new Date()
    await enrollment.save()

    return { success: true }
  } catch (error) {
    console.error("Mark course complete error:", error)
    return { success: false }
  }
}
```

- [ ] **Step 4: The same rules on the other progress paths.** In `lib/actions/enrollments.ts`:
  - change the course-access import to `import { getCourseAccess, isLessonLockedFor, lockedLessonIds } from "@/lib/course-access"`;
  - replace the body of `completeLesson`'s `try` block with:

```ts
    await connectDB()

    const enrollment = await Enrollment.findOne({
      user: userId,
      course: courseId,
      status: { $in: ["active", "completed"] },
    })

    if (!enrollment) {
      return { success: false, error: "Not enrolled in this course" }
    }

    const access = await getCourseAccess(userId, courseId)
    const locked = await lockedLessonIds(access)
    if (locked.has(lessonId)) {
      return { success: false, error: "This lesson isn't included in your package", code: "package_locked" as const }
    }

    // Add lesson to completed if not already
    const lessonObjectId = new Types.ObjectId(lessonId)
    const lessonIdStr = lessonObjectId.toString()
    const completedIds = enrollment.completedLessons.map((id: Types.ObjectId) => id.toString())

    if (!completedIds.includes(lessonIdStr)) {
      enrollment.completedLessons.push(lessonObjectId)
    }

    enrollment.lastAccessedLesson = lessonObjectId
    enrollment.lastAccessedAt = new Date()

    // Progress counts only published lessons this package opens.
    const publishedIds = (await Lesson.find({ course: courseId, isPublished: true }).select("_id").lean()).map(
      (l) => l._id.toString()
    )
    const open = new Set(publishedIds.filter((id) => !locked.has(id)))
    const done = enrollment.completedLessons.filter((id: Types.ObjectId) => open.has(id.toString())).length
    enrollment.progress = open.size > 0 ? Math.min(100, Math.round((done / open.size) * 100)) : 0

    // Check if course is completed — when the course requires a CBT exam,
    // completion (and thus the certificate) waits for a passing attempt, unless
    // the package has no assessment & certificate.
    if (enrollment.progress >= 100) {
      const gatedCourse = await Course.findById(courseId).select("examRequired").lean()
      const examGates = !!gatedCourse?.examRequired && (access?.entitlements.certificate ?? true)
      if (!examGates || enrollment.examPassed) {
        enrollment.status = "completed"
        enrollment.completedAt = new Date()
      }
    }

    await enrollment.save()

    revalidatePath(`/courses/${courseId}/learn/${lessonId}`)
    revalidatePath("/dashboard/my-courses")

    return {
      success: true,
      data: {
        progress: enrollment.progress,
        isCompleted: enrollment.status === "completed",
      },
    }
```

  - in `updateLastAccessed`, directly after `await connectDB()`, add:

```ts
    // A lesson outside the student's package is never "where they left off".
    if (await isLessonLockedFor(userId, lessonId)) {
      return { success: false, error: "This lesson isn't included in your package" }
    }
```

  - in `getEnrollmentProgress` replace

```ts
    const totalLessons = await Lesson.countDocuments({
      course: courseId,
      isPublished: true,
    })
```

  with

```ts
    // Only the published lessons this package opens count toward the total.
    const locked = await lockedLessonIds(await getCourseAccess(userId, courseId))
    const totalLessons = (await Lesson.find({ course: courseId, isPublished: true }).select("_id").lean()).filter(
      (l) => !locked.has(l._id.toString())
    ).length
```

- [ ] **Step 5: Watch progress.** In `lib/actions/watch-progress.ts` add `import { isLessonLockedFor } from "@/lib/course-access"` under the auth import. In `saveWatchProgress`, directly after `if (!user) return { success: false }`, add:

```ts
    if (await isLessonLockedFor(user.id, lessonId)) return { success: false }
```

   In `getLessonWatchProgress`, directly after `if (!user) return null`, add:

```ts
    if (await isLessonLockedFor(user.id, lessonId)) return null
```

- [ ] **Step 6: Lesson materials.** In `lib/actions/resources.ts` add `import { getCourseAccess, isLessonLockedFor, lockedLessonIds } from "@/lib/course-access"` under the models import. In `listCourseResources` replace

```ts
    const access = await hasCourseAccess(courseId, user)

    const resources = await Resource.find({ course: courseId }).sort({ order: 1 }).lean()
    return resources.map((r) => {
      const unlocked = access || r.isFree
```

with

```ts
    const access = await hasCourseAccess(courseId, user)
    // Materials attached to a lesson the student's package can't open stay locked.
    const lockedLessons = user ? await lockedLessonIds(await getCourseAccess(user.id, courseId)) : new Set<string>()

    const resources = await Resource.find({ course: courseId }).sort({ order: 1 }).lean()
    return resources.map((r) => {
      const unlocked = r.isFree || (access && !(r.lesson && lockedLessons.has(r.lesson.toString())))
```

   In `getResourceDownloadUrl` replace

```ts
      if (!access) {
        return { success: false, error: "Enroll in this course to download its materials" }
      }
```

with

```ts
      if (!access) {
        return { success: false, error: "Enroll in this course to download its materials" }
      }
      if (resource.lesson && (await isLessonLockedFor(user.id, resource.lesson.toString()))) {
        return { success: false, error: "This material belongs to a lesson outside your package" }
      }
```

- [ ] **Step 7: Learn page.** In `app/(platform)/dashboard/courses/[courseId]/learn/[lessonId]/page.tsx`:
  1. Add imports under the `CourseResources` import:

```tsx
import { PackageLockNotice } from "@/components/learn/package-lock-notice"
import { PACKAGE_LABEL } from "@/lib/entitlements"
```

  2. Replace

```tsx
  if (currentUser) {
    void updateLastAccessed(currentUser.id, courseId, actualLessonId)
  }

  const isLessonCompleted = completedLessonIds.includes(actualLessonId)
  const courseProgressPercent =
    lessons.length > 0
      ? Math.round((completedLessonIds.length / lessons.length) * 100)
      : 0
```

   with

```tsx
  if (currentUser && !currentLesson.locked) {
    void updateLastAccessed(currentUser.id, courseId, actualLessonId)
  }

  const isLessonCompleted = completedLessonIds.includes(actualLessonId)
  // Progress is measured over the lessons this package opens.
  const openLessonIds = new Set(lessons.filter((l) => !l.locked).map((l) => l.id))
  const courseProgressPercent =
    openLessonIds.size > 0
      ? Math.min(100, Math.round((completedLessonIds.filter((id) => openLessonIds.has(id)).length / openLessonIds.size) * 100))
      : 0
```

  3. Replace the opening of the content ternary, `{currentLesson.type === "video" && currentLesson.videoUrl ? (`, with:

```tsx
            {currentLesson.locked ? (
              <div className="w-full border-b border-ws-hairline bg-ws-sunken">
                <div className="mx-auto max-w-xl px-6 py-12 md:py-16">
                  <PackageLockNotice
                    title="This lesson isn't in your package"
                    requiredLabel={currentLesson.requiredPackage ? PACKAGE_LABEL[currentLesson.requiredPackage] : null}
                  />
                </div>
              </div>
            ) : currentLesson.type === "video" && currentLesson.videoUrl ? (
```

  4. Wrap the `<div className="ml-auto">…<MarkCompleteButton …/>…</div>` so it renders only when `!currentLesson.locked`:

```tsx
              {!currentLesson.locked && (
                <div className="ml-auto">
                  <MarkCompleteButton
                    courseId={courseId}
                    lessonId={actualLessonId}
                    completed={isLessonCompleted}
                  />
                </div>
              )}
```

  5. Replace `<LessonQuizCard courseId={courseId} lessonId={actualLessonId} />` with `{!currentLesson.locked && <LessonQuizCard courseId={courseId} lessonId={actualLessonId} />}`.

- [ ] **Step 8: Lesson lists show the lock.** In both `components/learn/lesson-sidebar.tsx` and `components/learn/mobile-lesson-list.tsx`:
  - add `LockIcon` to the lucide import;
  - replace the badge contents

```tsx
{isCompleted && !isCurrent ? (
  <CheckIcon  size={12} className="text-white" />
) : (
  index + 1
)}
```

   with (sidebar: size 12; mobile list: size 10, matching each file's existing `CheckIcon` size)

```tsx
{lesson.locked ? (
  <LockIcon size={12} className="text-white" aria-label="Locked" />
) : isCompleted && !isCurrent ? (
  <CheckIcon  size={12} className="text-white" />
) : (
  index + 1
)}
```

   The lock takes the neutral `bg-black/70` badge background: change the badge class condition so `isCompleted && !isCurrent` becomes `!lesson.locked && isCompleted && !isCurrent`.

   In each file, also add `lesson.locked && "text-muted-foreground"` to the title `<p className="truncate font-medium text-sm">` via `cn(…)` (import `cn` is already present).

- [ ] **Step 9: Verify.** tsc; eslint on every touched file. Then set up the fixture:

```bash
node "$H/mockdb.cjs" fixture basic   # → {"courseId":"6aa7…781","lessons":{"everyone":E,"standard":S,"executive":X},"enrollmentId":N}
```

  1. `L="/dashboard/courses/$F/learn"`. Run `curl -s -b mock_persona=student "http://localhost:3001$L/$E" | perl -pe 's/<script\b.*?<\/script>//gs'` → 200. Check the output:
     - it contains **no** `isn't in your package`;
     - `curl -s … "$L/$E" | grep -o 'fixture-everyone.mp4' | wc -l` ≥ 1.
  2. `$L/$S` (stripped) contains `This lesson isn&#x27;t in your package` (or the unescaped form) and `Included from the Standard package`. `curl -s … "$L/$S" | grep -o 'fixture-standard.mp4' | wc -l` → **0**: the media is not in the HTML or the payload.
  3. `$L/$X`: the stripped page contains `Included from the Executive 101 package`.
  4. `bash "$H/action.sh" "$L/$E" markLessonComplete "[\"$F\",\"$S\"]"` → `{"success":false}`; with `"$E"` → `{"success":true}`. Probe: Forex enrollment `progress=100` (1 of 1 open lessons).
  5. `node "$H/mockdb.cjs" set-package $N standard` → `$L/$S` no longer contains `isn't in your package`, and `markLessonComplete` on `$S` → success, progress `100` (2 of 2 open; Executive still locked).
  6. No enrollment is ever created. `bash "$H/action.sh" "/dashboard/courses/6a6fc0bb6433bbbd6322be03/learn/<any bitcoin lesson id>" markLessonComplete "[\"$F\",\"$E\"]" admin` → `{"success":false}`; and `markCourseComplete` via the same page (FinishCourseButton imports it; if the id isn't found there, use a bitcoin lesson page whose next lesson is null) with `["$F"]` as admin → `{"success":false}`. `node "$H/mockdb.cjs" probe 6a6fc1258372b65d1ee8e972` shows **no** Forex enrollment. Get a bitcoin lesson id with `curl -s -b mock_persona=student http://localhost:3001/dashboard/courses/6a6fc0bb6433bbbd6322be03 | grep -o 'learn/[0-9a-f]\{24\}' | head -1`.
  7. Staff see everything: `curl -s -b mock_persona=instructor "http://localhost:3001$L/$X" | grep -o 'fixture-executive.mp4' | wc -l` ≥ 1 (the instructor owns Forex).
  8. Regression: the student's bitcoin lessons (legacy `packageKey` null) still open, with no lock text on any of its lesson pages you sample.
  9. End: `node "$H/mockdb.cjs" restore`.

- [ ] **Step 10: Commit.**

```bash
git add components/learn/package-lock-notice.tsx lib/actions/student.ts lib/actions/enrollments.ts lib/actions/watch-progress.ts lib/actions/resources.ts "app/(platform)/dashboard/courses/[courseId]/learn/[lessonId]/page.tsx" components/learn/lesson-sidebar.tsx components/learn/mobile-lesson-list.tsx
git commit -m "feat(access): lessons gated by package — media withheld, lock notice, progress over open lessons, completion never creates enrollments

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Assessment & certificate gates

**Files:**
- Modify: `lib/actions/exams.ts` (models import; new helper `examPackageLock`; `StudentExamStatus`; `getStudentExamStatus`; `startExamAttempt`)
- Modify: `components/courses/course-exam-card.tsx`
- Modify: `components/learn/lesson-quiz-card.tsx`
- Modify: `app/(platform)/dashboard/courses/[courseId]/exam/page.tsx` (intro screen only)
- Modify: `lib/actions/certificates.ts` (`fetchCertificate`, `fetchMyCertificates`)

**Interfaces:**
- Consumes: `canAccessLesson`, `effectiveLessonTier`, `entitlementsFor`, `lowestPackageWith`, `PACKAGE_LABEL` (Task 1); `PackageLockNotice` (Task 4).
- Produces:
  - `StudentExamStatus.packageLock: { requiredLabel: string | null } | null`
  - `StudentExamStatus.examRequired` is false when the package has no certificate, so `FinishCourseButton` finishes instead of routing to the exam.
  - `startExamAttempt` failure may carry `code: "package_locked"`.

- [ ] **Step 1: Exams.** In `lib/actions/exams.ts`:
  - add `Lesson,` to the `@/lib/db/models` import (after `Enrollment,`), plus `type ICoursePackage,` and `type PackageKey,`;
  - add under the `notifyUser` import:

```ts
import { PACKAGE_LABEL, canAccessLesson, effectiveLessonTier, entitlementsFor, lowestPackageWith } from "@/lib/entitlements"
```

   - add this helper directly above `export type StudentExamStatus`:

```ts
/**
 * Package gate for an assessment. A final exam belongs to the assessment &
 * certificate entitlement (Basic has neither); a knowledge check follows its
 * lesson's tier. null = open.
 */
async function examPackageLock(
  course: { packages?: ICoursePackage[] | null },
  enrollment: { packageKey?: PackageKey | null },
  lessonId: string | null | undefined
): Promise<{ requiredLabel: string | null } | null> {
  if (lessonId) {
    const lesson = await Lesson.findById(lessonId).select("minPackageKey isFree").lean()
    if (!lesson || canAccessLesson(course, lesson, enrollment)) return null
    const tier = effectiveLessonTier(course, lesson)
    return { requiredLabel: tier ? PACKAGE_LABEL[tier] : null }
  }
  if (entitlementsFor(course, enrollment).certificate) return null
  const tier = lowestPackageWith(course, "certificate")
  return { requiredLabel: tier ? PACKAGE_LABEL[tier] : null }
}
```

   - add to `StudentExamStatus` after `lastResult: …`:

```ts
  /** Set when the student's package doesn't include this assessment — show a lock notice, never a start button. */
  packageLock: { requiredLabel: string | null } | null
```

   - in `getStudentExamStatus` change `Course.findById(courseId).select("examRequired").lean()` to `Course.findById(courseId).select("examRequired packages").lean()`, and replace `const isLessonQuiz = !!lessonId` with:

```ts
    const isLessonQuiz = !!lessonId
    const packageLock = enrollment ? await examPackageLock(course, enrollment, lessonId) : null
    // A package without the assessment & certificate completes on its lessons:
    // the exam gate doesn't apply to it.
    const examRequired = !isLessonQuiz && !!course.examRequired && !packageLock
```

   - In BOTH returned objects:
     - replace `examRequired: !isLessonQuiz && !!course.examRequired,` with `examRequired,`;
     - add `packageLock,` after `lastResult: …`;
     - in the second (full) object, replace the `eligible:` line with `eligible: packageLock ? false : isLessonQuiz ? true : (enrollment.progress ?? 0) >= 100,`.
   - In `startExamAttempt`:
     - change the return type's failure member to `| { success: false; error: string; code?: "package_locked" }`;
     - directly after `if (!enrollment) return { success: false, error: "You're not enrolled in this course" }` add:

```ts
    const course = await Course.findById(courseId).select("packages").lean()
    if (course && (await examPackageLock(course, enrollment, lessonId))) {
      return {
        success: false,
        code: "package_locked",
        error: lessonId
          ? "This knowledge check belongs to a lesson outside your package"
          : "Your package doesn't include the assessment and certificate",
      }
    }
```

- [ ] **Step 2: Cards and intro.**
  - In `components/courses/course-exam-card.tsx` add `import { PackageLockNotice } from "@/components/learn/package-lock-notice"`, and directly after `if (!status?.hasExam) return null` add:

```tsx
  if (status.packageLock) {
    return (
      <Card>
        <CardContent className="p-4">
          <PackageLockNotice
            compact
            title={status.title || "Course exam"}
            requiredLabel={status.packageLock.requiredLabel}
          />
        </CardContent>
      </Card>
    )
  }
```

  - In `components/learn/lesson-quiz-card.tsx` change `if (!status?.hasExam) return null` to `if (!status?.hasExam || status.packageLock) return null`.
  - In `app/(platform)/dashboard/courses/[courseId]/exam/page.tsx` add `import { PackageLockNotice } from "@/components/learn/package-lock-notice"`, and in the intro screen replace `{!status.eligible ? (` with:

```tsx
                {status.packageLock ? (
                  <PackageLockNotice
                    title="Not included in your package"
                    requiredLabel={status.packageLock.requiredLabel}
                  />
                ) : !status.eligible ? (
```

- [ ] **Step 3: Certificates.** In `lib/actions/certificates.ts`:
  - add `import { entitlementsFor } from "@/lib/entitlements"` and `type ICoursePackage` to the models import (`import { Enrollment, Course, User, type ICoursePackage } from "@/lib/db/models"`).
  - In `fetchCertificate`, directly after `if (!course) return null`, add:

```ts
    // Packages without assessment & certificate (Basic) complete, but never certify.
    if (!entitlementsFor(course, enrollment).certificate) return null
```

  - In `fetchMyCertificates` change the populate `select: "title thumbnailUrl instructor"` to `select: "title thumbnailUrl instructor packages"`, and replace `.filter((e) => e.course)` with:

```ts
      .filter(
        (e) =>
          e.course &&
          entitlementsFor(e.course as unknown as { packages?: ICoursePackage[] | null }, e).certificate
      )
```

- [ ] **Step 4: Verify.** tsc; eslint on the five files. Fixture:

```bash
node "$H/mockdb.cjs" fixture basic                 # note N (enrollment) and S (standard lesson)
node "$H/mockdb.cjs" exam-fixture $F               # final exam
node "$H/mockdb.cjs" exam-fixture $F $S            # knowledge check on the Standard lesson
```

  1. `bash "$H/action.sh" "/dashboard/courses/$F" getStudentExamStatus "[\"$F\"]"` (student) → `packageLock: {"requiredLabel":"Standard"}`, `examRequired: false`, `eligible: false`.
  2. `bash "$H/action.sh" "/dashboard/courses/$F/exam" startExamAttempt "[\"$F\"]"` → `code: "package_locked"`, error `Your package doesn't include the assessment and certificate`. With `["$F","$S"]` → the knowledge-check message.
  3. `node "$H/mockdb.cjs" set-package $N standard` → status: `packageLock: null`. `startExamAttempt ["$F"]` now fails only with `Finish all lessons first` (progress < 100): the gate passed.
  4. Certificates:
     - Set the package back with `set-package $N basic`, then `set-status $N completed`.
     - `curl -s -o /dev/null -w "%{http_code}\n" -b mock_persona=student "http://localhost:3001/dashboard/courses/$F/certificate"` → 404.
     - `curl -s -b mock_persona=student http://localhost:3001/dashboard/certificates | perl -pe 's/<script\b.*?<\/script>//gs' | grep -o 'Forex Trading Mastery' | wc -l` → 0.
     - `set-package $N standard` → the certificate page returns 200 and `/dashboard/certificates` lists `Forex Trading Mastery`.
  5. End: `node "$H/mockdb.cjs" restore`.

- [ ] **Step 5: Commit.**

```bash
git add lib/actions/exams.ts components/courses/course-exam-card.tsx components/learn/lesson-quiz-card.tsx "app/(platform)/dashboard/courses/[courseId]/exam/page.tsx" lib/actions/certificates.ts
git commit -m "feat(access): final exam and certificate follow the package; knowledge checks follow their lesson

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Live classes & instructor Q&A gates

**Files:**
- Modify: `lib/actions/meetings.ts` (import; `joinMeeting`; `createCourseMeeting`; `getMyMeetingInvites`)
- Modify: `app/(platform)/dashboard/meetings/page.tsx` (join-error banner)
- Modify: `lib/actions/messages.ts` (imports; `getOrCreateConversation`)
- Modify: `app/(platform)/dashboard/instructor/[instructorId]/message-instructor-button.tsx`
- Modify: `components/courses/about-instructor.tsx` (`canMessage` prop)
- Modify: `app/(platform)/dashboard/courses/[courseId]/page.tsx` (pass `canMessage`)
- Modify: `app/(platform)/dashboard/courses/[courseId]/learn/[lessonId]/page.tsx` (instructor block only)

**Interfaces:**
- Consumes: `getCourseAccess` (Task 1); `entitlementsFor` (Task 1); `LearnCourse.entitlements` (Task 4).
- Produces:
  - `AboutInstructor` accepts `canMessage?: boolean` (default `true`).
  - `joinMeeting` refusals: `"This live class is for students enrolled in the course"` or `"Live classes aren't included in your package"`.
  - `getOrCreateConversation` refusal: `"Instructor Q&A isn't included in your package"`.

- [ ] **Step 1: Meetings actions.** In `lib/actions/meetings.ts` add, under the `@/lib/email` import:

```ts
import { getCourseAccess } from "@/lib/course-access"
import { entitlementsFor } from "@/lib/entitlements"
```

   In `joinMeeting`, directly after the closing `}` of the `if (meeting.hostId.toString() === currentUser.id) { … }` block, add:

```ts
    // Course classes: admins, direct invitees, and students whose package
    // includes live classes. A class link is not a way into paid content.
    if (meeting.courseId && currentUser.role !== "ADMIN") {
      const invited = (meeting.invites ?? []).some((inv) => inv.userId?.toString() === currentUser.id)
      if (!invited) {
        const access = await getCourseAccess(currentUser.id, meeting.courseId.toString())
        if (!access) return { success: false, error: "This live class is for students enrolled in the course" }
        if (!access.entitlements.liveClasses) {
          return { success: false, error: "Live classes aren't included in your package" }
        }
      }
    }
```

   In `createCourseMeeting` replace everything from `backgroundSave(` through the closing of the `enrolledCount` `countDocuments` call:

```ts
    backgroundSave(
      (async () => {
        const enrollments = await Enrollment.find({
          ...
    })
```

   (i.e. the fire-and-forget email block and the `const enrolledCount = await Enrollment.countDocuments({…})` that follows it) with:

```ts
    // Only packages with live classes hear about — and may join — a class.
    const classEnrollments = (
      await Enrollment.find({
        course: new Types.ObjectId(courseId),
        status: { $in: ["active", "completed"] },
      })
        .select("user packageKey")
        .lean()
    ).filter((e) => entitlementsFor(course, e).liveClasses)

    backgroundSave(
      (async () => {
        const studentIds = classEnrollments.map((e) => e.user.toString())
        if (studentIds.length === 0) return

        const students = await User.find({ _id: { $in: studentIds } })
          .select("email firstName lastName")
          .lean()

        // Send emails in parallel (batched)
        const emailPromises = students.map((student) =>
          sendMeetingNotificationEmail(student.email, {
            meetingTitle: title,
            hostName,
            hostAvatarUrl: currentUser.avatarUrl || undefined,
            meetingLink,
            courseName: course.title,
            courseThumbnailUrl: course.thumbnailUrl || undefined,
          })
        )
        await Promise.allSettled(emailPromises)
      })()
    )
```

   and in its `return` change `notifiedCount: enrolledCount,` to `notifiedCount: classEnrollments.length,`.

   In `getMyMeetingInvites`:
   - change the enrollments `.select("course")` to `.select("course packageKey")`;
   - replace `const enrolledCourseIds = enrollments.map((e) => e.course)` with:

```ts
    // A course's classes show only for enrollments whose package includes live classes.
    const enrolledCourses =
      enrollments.length > 0
        ? await Course.find({ _id: { $in: enrollments.map((e) => e.course) } }).select("packages").lean()
        : []
    const coursesById = new Map(enrolledCourses.map((c) => [c._id.toString(), c]))
    const enrolledCourseIds = enrollments
      .filter((e) => {
        const course = coursesById.get(e.course.toString())
        return course ? entitlementsFor(course, e).liveClasses : false
      })
      .map((e) => e.course)
```

- [ ] **Step 2: Show join refusals.** In `app/(platform)/dashboard/meetings/page.tsx`:
  - add `const [joinError, setJoinError] = useState<string | null>(null)` directly under the `setupMessage` state line;
  - in BOTH join-failure branches (the `} else {` after `if (result.success) {` in the handler that calls `joinMeeting(meetingId)` and in `handleRejoin`), replace `console.error("[Meeting] Join failed:", result.error)` (and the same log in `handleRejoin`, if present) with:

```tsx
      setJoinError(result.error ?? "Couldn't join this meeting")
```

   (keep the existing `setSetupMessage(null)`). If `handleRejoin`'s failure branch has no log line, add the `setJoinError` call after its `setSetupMessage(null)`.
  - In the lobby render, directly under `{setupMessage && <SetupOverlay message={setupMessage} />}`, add:

```tsx
      {joinError && (
        <div
          role="alert"
          className="fixed inset-x-4 top-4 z-50 mx-auto flex max-w-md items-start gap-3 rounded-lg border border-ws-hairline bg-ws-surface px-4 py-3 shadow-lg"
        >
          <p className="flex-1 text-sm text-ws-primary">{joinError}</p>
          <button
            type="button"
            onClick={() => setJoinError(null)}
            className="text-xs font-medium text-ws-muted transition-colors hover:text-ws-primary"
          >
            Dismiss
          </button>
        </div>
      )}
```

- [ ] **Step 3: Q&A server gate.** In `lib/actions/messages.ts`:
  - change the models import to add `Course, Enrollment,` (`import { Message, Conversation, User, Course, Enrollment, type IMessage, type IConversation, type IUser } from "@/lib/db/models"`);
  - add `import { entitlementsFor } from "@/lib/entitlements"`;
  - in `getOrCreateConversation` replace

```ts
    if (!conversation) {
      conversation = await Conversation.create({
```

with

```ts
    if (!conversation) {
      // Instructor Q&A is a package entitlement: a student whose enrollments
      // with this instructor all lack it can't open a new thread with them.
      // Existing threads stay; people with no enrollment with them are unaffected.
      if (currentUser.role === "USER") {
        const taught = await Course.find({ instructor: recipientId }).select("_id packages").lean()
        if (taught.length > 0) {
          const enrollments = await Enrollment.find({
            user: senderId,
            course: { $in: taught.map((c) => c._id) },
            status: { $in: ["active", "completed"] },
          })
            .select("course packageKey")
            .lean()
          const coursesById = new Map(taught.map((c) => [c._id.toString(), c]))
          const includesQa = enrollments.some((e) => {
            const course = coursesById.get(e.course.toString())
            return course ? entitlementsFor(course, e).instructorQa : false
          })
          if (enrollments.length > 0 && !includesQa) {
            return { success: false, error: "Instructor Q&A isn't included in your package" }
          }
        }
      }

      conversation = await Conversation.create({
```

- [ ] **Step 4: Q&A in the UI.**
  - `message-instructor-button.tsx`: change the React import to `import { useState, useTransition } from "react"`, add `const [error, setError] = useState<string | null>(null)`, and make the handler:

```tsx
  const handleMessage = () => {
    setError(null)
    startTransition(async () => {
      const result = await getOrCreateConversation(instructorId)
      if (result.success && result.conversationId) {
        router.push(`/dashboard/messages?c=${result.conversationId}`)
      } else {
        setError(result.error ?? "Couldn't open a conversation")
      }
    })
  }
```

   Wrap the returned `<Button …>…</Button>` in `<div className="flex flex-col items-end gap-1">` … `{error && <p className="text-[11px] text-ws-danger">{error}</p>}` … `</div>`.
  - `components/courses/about-instructor.tsx`:
    - add `/** False when the viewer's package has no instructor Q&A — Message buttons are hidden. */ canMessage?: boolean` to the props interface;
    - destructure `canMessage = true`;
    - wrap BOTH `<Button … onClick={handleMessage} …>…Message</Button>` elements in `{canMessage && ( … )}`.
  - `app/(platform)/dashboard/courses/[courseId]/page.tsx`:
    - add `import { getCourseAccess } from "@/lib/course-access"`;
    - directly after `const isEnrolled = enrollmentStatus.isEnrolled` add:

```tsx
  // Q&A follows the package; visitors without an enrollment keep today's behaviour.
  const courseAccess = currentUser ? await getCourseAccess(currentUser.id, courseId) : null
```

   and pass `canMessage={courseAccess ? courseAccess.entitlements.instructorQa : true}` to `<AboutInstructor …/>`.
  - Learn page (`…/learn/[lessonId]/page.tsx`): replace `<MessageInstructorButton instructorId={course.instructorId} />` with:

```tsx
                {course.entitlements.instructorQa ? (
                  <MessageInstructorButton instructorId={course.instructorId} />
                ) : (
                  <p className="max-w-40 text-right text-[11px] leading-snug text-ws-muted">
                    Instructor Q&amp;A isn&apos;t in your package
                  </p>
                )}
```

- [ ] **Step 5: Verify.** tsc; eslint on the seven files. Fixture: `node "$H/mockdb.cjs" fixture basic` (note N, E), then `node "$H/mockdb.cjs" meeting-fixture $F` (note M).
  1. `bash "$H/action.sh" "/dashboard/meetings" joinMeeting "[\"$M\"]"` (student, Basic) → `Live classes aren't included in your package`.
  2. `getMyMeetingInvites` on `/dashboard/meetings` (args `[]`) → `invites` has **no** `Fixture live class`.
  3. `set-package $N standard`. Now `getMyMeetingInvites` lists `Fixture live class`, and `joinMeeting` gets past the gate: RealtimeKit isn't configured, so expect `Failed to join meeting`, **not** a package message.
  4. As admin: `joinMeeting` → not refused by the gate (the same RTK failure is fine). No-enrollment branch: `node "$H/mockdb.cjs" set-status $N cancelled`, then as the student → `This live class is for students enrolled in the course`; `set-status $N active` afterwards.
  5. Q&A. `set-package $N basic`. Then:
     - `bash "$H/action.sh" "/dashboard/messages" getOrCreateConversation "[\"6a6fc0ba6433bbbd6322bdfd\"]"` → `Instructor Q&A isn't included in your package`.
     - Probe that no conversation was created: `node -e` or a quick read of the `conversations` count against the baseline.
     - `set-package $N standard` → `{"success":true,"conversationId":…}`.
     - `set-package $N basic` again → the **same** call now returns success (the existing conversation is kept).
     - As admin → success.
  6. UI, with `restore` → `fixture basic` again:
     - `curl -s -b mock_persona=student "http://localhost:3001/dashboard/courses/$F/learn/$E" | perl -pe 's/<script\b.*?<\/script>//gs' | grep -o "Q&amp;A isn&#x27;t in your package\|Q&amp;A isn't in your package" | wc -l` ≥ 1.
     - The dashboard course page `/dashboard/courses/$F` (stripped) has no `>Message<` button text.
     - `set-package $N standard`: both show the Message button again.
  7. End: `node "$H/mockdb.cjs" restore`.

- [ ] **Step 6: Commit.**

```bash
git add lib/actions/meetings.ts "app/(platform)/dashboard/meetings/page.tsx" lib/actions/messages.ts "app/(platform)/dashboard/instructor/[instructorId]/message-instructor-button.tsx" components/courses/about-instructor.tsx "app/(platform)/dashboard/courses/[courseId]/page.tsx" "app/(platform)/dashboard/courses/[courseId]/learn/[lessonId]/page.tsx"
git commit -m "feat(access): live classes and instructor Q&A follow the package

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Admin — package on enrollments and orders; change package with an audit event

**Files:**
- Modify: `lib/actions/admin-enrollments.ts` (imports; `AdminEnrollmentRow`; filters; populate; mapper; new `adminSetEnrollmentPackage`; CSV)
- Modify: `app/(admin)/admin/enrollments/page.tsx`
- Modify: `lib/hooks/queries/keys.ts` (`adminEnrollments` filter type)
- Modify: `lib/actions/admin-payments.ts` (`AdminOrderRow.packageKey`; both mappers)
- Modify: `app/(admin)/admin/payments/page.tsx` (order row + detail dialog)

**Interfaces:**
- Consumes: `packageFor`, `isPackageKey`, `PACKAGE_KEYS`, `PACKAGE_LABEL` (Task 1); `PaymentEvent`; `requireAdmin(): Promise<LocalUser>`.
- Produces:
  - `AdminEnrollmentRow.packageKey: PackageKey | null`
  - `AdminEnrollmentRow.packageName: string | null`
  - `AdminEnrollmentRow.coursePackages: { key: PackageKey; name: string }[]`
  - `adminListEnrollments` filters gain `package?: string` (`"all" | "none" | PackageKey`)
  - `adminSetEnrollmentPackage(enrollmentId: string, packageKey: PackageKey): Promise<{ success: boolean; error?: string }>`
  - `AdminOrderRow.packageKey: PackageKey | null`

- [ ] **Step 1: Enrollment actions.** In `lib/actions/admin-enrollments.ts`:
  - change the imports to:

```ts
import { revalidatePath } from "next/cache"
import mongoose from "mongoose"
import connectDB from "@/lib/db"
import { Course, Enrollment, PaymentEvent, User, type ICoursePackage, type PackageKey } from "@/lib/db/models"
import type { EnrollmentStatus } from "@/lib/db/models/enrollment"
import { requireAdmin } from "@/lib/auth/admin"
import { courseAvailability } from "@/lib/types/course"
import type { CourseStatus } from "@/lib/types/course"
import { PACKAGE_RANK, isPackageKey, packageFor } from "@/lib/entitlements"
```

  - add to `AdminEnrollmentRow` after `payment: AdminEnrollmentPayment`:

```ts
  packageKey: PackageKey | null
  packageName: string | null
  /** Enabled tiers on the course, in ladder order — the choices for "Change package". */
  coursePackages: { key: PackageKey; name: string }[]
```

  - `adminListEnrollments`:
    - add `package?: string` to its `filters` type;
    - after `if (filters?.status && filters.status !== "all") query.status = filters.status` add:

```ts
    const packageFilter = filters?.package
    if (packageFilter === "none") query.packageKey = null
    else if (isPackageKey(packageFilter)) query.packageKey = packageFilter
```

    - change `.populate("course", "title pricing status availableAt")` to `.populate("course", "title pricing status availableAt packages")`;
    - in the mapper's `course` cast add `packages?: ICoursePackage[] | null`;
    - add to the returned row after `payment,`:

```ts
        packageKey: e.packageKey ?? null,
        packageName: e.packageName ?? null,
        coursePackages: (course?.packages ?? [])
          .filter((p) => p.enabled)
          .sort((a, b) => PACKAGE_RANK[a.key] - PACKAGE_RANK[b.key])
          .map((p) => ({ key: p.key, name: p.name })),
```

  - `adminExportEnrollments`:
    - add `package?: string` to its filters type;
    - add `"Package",` to `header` after `"Payment status",`;
    - add `r.packageName,` after `r.payment,`.
  - Insert after `adminSetEnrollmentStatus`:

```ts
/**
 * Move one enrollment to another package (D5 — no self-serve upgrades in v1).
 * No money moves: refunds and charges stay in Payments. The change is logged
 * as a `package_changed` PaymentEvent so the payment trail explains why access
 * differs from what was bought. Only enabled tiers on the course are valid —
 * never "no package", which would silently grant full access.
 */
export async function adminSetEnrollmentPackage(
  enrollmentId: string,
  packageKey: PackageKey
): Promise<{ success: boolean; error?: string }> {
  try {
    await connectDB()
    const admin = await requireAdmin()

    if (!mongoose.isValidObjectId(enrollmentId)) return { success: false, error: "Enrollment not found" }
    if (!isPackageKey(packageKey)) return { success: false, error: "Unknown package" }

    const enrollment = await Enrollment.findById(enrollmentId)
    if (!enrollment) return { success: false, error: "Enrollment not found" }

    const course = await Course.findById(enrollment.course).select("packages").lean()
    const pkg = course ? packageFor(course, packageKey) : null
    if (!pkg) return { success: false, error: "This course doesn't sell that package" }

    const from = enrollment.packageKey ?? null
    if (from === pkg.key) return { success: true }

    enrollment.packageKey = pkg.key
    enrollment.packageName = pkg.name
    await enrollment.save()

    try {
      await PaymentEvent.create({
        order: null,
        reference: `academy_package_${enrollment._id.toString()}`,
        type: "package_changed",
        payload: {
          enrollmentId: enrollment._id.toString(),
          courseId: enrollment.course.toString(),
          from,
          to: pkg.key,
          adminId: admin.id,
        },
      })
    } catch (err) {
      console.error("[Payments] failed to log package change", err)
    }

    revalidatePath("/admin/enrollments")
    return { success: true }
  } catch (error) {
    console.error("Admin set enrollment package error:", error)
    return { success: false, error: "Failed to change the package" }
  }
}
```

- [ ] **Step 2: Query key.** In `lib/hooks/queries/keys.ts` add `package?: string` to the `adminEnrollments` filters type (after `payment?: string`).

- [ ] **Step 3: Enrollments page.** In `app/(admin)/admin/enrollments/page.tsx`:
  1. Imports:
     - add `adminSetEnrollmentPackage` to the admin-enrollments import;
     - add `import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"`;
     - add `import { PACKAGE_KEYS, PACKAGE_LABEL } from "@/lib/entitlements"`;
     - add `import type { PackageKey } from "@/lib/db/models"`.
  2. Under `PAYMENT_FILTERS` add:

```tsx
const PACKAGE_FILTERS = [
  { value: "all", label: "Any package" },
  { value: "none", label: "No package" },
  ...PACKAGE_KEYS.map((key) => ({ value: key, label: PACKAGE_LABEL[key] })),
]
```

  3. State, under `const [payment, setPayment] = React.useState("all")`:

```tsx
  const [pkgFilter, setPkgFilter] = React.useState("all")
  const [packageTarget, setPackageTarget] = React.useState<{
    id: string
    name: string
    current: PackageKey | null
    options: { key: PackageKey; name: string }[]
  } | null>(null)
  const [packageChoice, setPackageChoice] = React.useState<PackageKey | null>(null)
```

  4. Add `package: pkgFilter,` to `filters` (after `payment,`) and to the `adminExportEnrollments({ … })` call.
  5. Under the `setEnrollmentStatus` mutation add:

```tsx
  const setEnrollmentPackage = useMutation({
    mutationFn: ({ id, key }: { id: string; key: PackageKey }) => adminSetEnrollmentPackage(id, key),
    onSuccess: (res) => {
      setActionError(res.success ? null : (res.error ?? "Failed"))
      if (res.success) setPackageTarget(null)
      queryClient.invalidateQueries({ queryKey: ["admin", "enrollments"] })
    },
  })
```

  6. After the `FilterChips` for `status`, add a third row:

```tsx
            <FilterChips
              value={pkgFilter}
              onChange={(v) => {
                setPkgFilter(v)
                setPage(1)
              }}
              options={PACKAGE_FILTERS}
            />
```

  7. Table: add `<TableHead>Package</TableHead>` after `<TableHead>Course</TableHead>`, and the cell after the course cell:

```tsx
                        <TableCell>
                          {e.packageKey ? (
                            <>
                              <p className="text-sm">{e.packageName ?? PACKAGE_LABEL[e.packageKey]}</p>
                              <p className="text-[10px] text-muted-foreground">{PACKAGE_LABEL[e.packageKey]}</p>
                            </>
                          ) : (
                            <p className="text-xs text-muted-foreground">—</p>
                          )}
                        </TableCell>
```

  8. In the row dropdown, before the "Cancel enrollment" item:

```tsx
                              {e.coursePackages.length > 0 && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setPackageChoice(e.packageKey)
                                    setPackageTarget({
                                      id: e.id,
                                      name: e.customerName,
                                      current: e.packageKey,
                                      options: e.coursePackages,
                                    })
                                  }}
                                >
                                  Change package…
                                </DropdownMenuItem>
                              )}
```

  9. After the cancel `<Dialog>…</Dialog>`, add:

```tsx
      <Dialog open={!!packageTarget} onOpenChange={(open) => !open && setPackageTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change {packageTarget?.name}&rsquo;s package</DialogTitle>
            <DialogDescription>
              Moves this enrollment&rsquo;s access to another package. No money moves — charges and
              refunds live in Payments. The change is recorded in the payment log.
            </DialogDescription>
          </DialogHeader>
          <Select
            items={(packageTarget?.options ?? []).map((o) => ({
              value: o.key,
              label: `${PACKAGE_LABEL[o.key]} · ${o.name}`,
            }))}
            value={packageChoice}
            onValueChange={(v) => setPackageChoice((v as PackageKey | null) ?? null)}
          >
            <SelectTrigger className="w-full" aria-label="Package">
              <SelectValue placeholder="Choose a package" />
            </SelectTrigger>
            <SelectContent>
              {(packageTarget?.options ?? []).map((o) => (
                <SelectItem key={o.key} value={o.key}>
                  {PACKAGE_LABEL[o.key]} · {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPackageTarget(null)}>
              Keep package
            </Button>
            <Button
              size="sm"
              disabled={
                !packageChoice || packageChoice === packageTarget?.current || setEnrollmentPackage.isPending
              }
              onClick={() => {
                if (packageTarget && packageChoice) {
                  setEnrollmentPackage.mutate({ id: packageTarget.id, key: packageChoice })
                }
              }}
            >
              {setEnrollmentPackage.isPending ? "Saving…" : "Change package"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
```

   (If the local `Select` wrapper's `value`/`onValueChange` types reject `PackageKey | null`, mirror `components/instructor/lesson-manager.tsx`'s `LessonTierSelect` usage exactly and say so in the report.)

- [ ] **Step 4: Orders.** In `lib/actions/admin-payments.ts`:
  - `import type { PackageKey } from "@/lib/db/models"` (type-only, alongside the existing models import);
  - add `packageKey: PackageKey | null` to `AdminOrderRow` after `chargeId`;
  - add `packageKey: o.packageKey ?? null,` after `chargeId: o.chargeId,` in BOTH `adminListOrders` and `adminGetOrderDetail`.

  In `app/(admin)/admin/payments/page.tsx`:
  - add `import { PACKAGE_LABEL } from "@/lib/entitlements"`;
  - in the order row's course cell, directly under `<p className="font-medium truncate max-w-[180px]">{o.courseTitle}</p>`, add:

```tsx
                      {o.packageKey && (
                        <p className="text-[10px] text-muted-foreground">{PACKAGE_LABEL[o.packageKey]}</p>
                      )}
```

  - in the detail dialog, change the `DialogDescription` contents to `{detail.buyerName} · {detail.buyerEmail}{detail.packageKey ? ` · ${PACKAGE_LABEL[detail.packageKey]}` : ""}`.

- [ ] **Step 5: Verify.** tsc; eslint on the five files. Data: `node "$H/mockdb.cjs" fixture basic` (note N). Then buy Crypto Standard as the student via Task 2's action call, which creates a real order.
  1. `bash "$H/action.sh" "/admin/enrollments" adminListEnrollments '[{"package":"basic"}]' admin` → every row has `packageKey: "basic"`, and the fixture row shows `coursePackages` `basic, standard, executive` with names. `'[{"package":"none"}]'` → the student's bitcoin and technical-analysis rows, `packageKey: null`, `coursePackages: []`.
  2. `bash "$H/action.sh" "/admin/enrollments" adminSetEnrollmentPackage "[\"$N\",\"standard\"]" admin` → `{"success":true}`. Probe: that enrollment is `pkg=standard name="Forex Mastery"`, plus a payment event `package_changed academy_package_<N> {"enrollmentId":…,"from":"basic","to":"standard","adminId":"6a6fc1258372b65d1ee8e972"}`. Repeating the call → success, and **no** second event.
  3. `["<bitcoin enrollment id 6a6fe33862cf63ed050e56c6>","standard"]` → `This course doesn't sell that package`. `["$N","gold"]` → `Unknown package`. As the student persona → the page 307s or the action refuses (`Failed to change the package`); either is fine, say which.
  4. `bash "$H/action.sh" "/admin/payments" adminListOrders '[{}]' admin` → the Crypto order row has `packageKey: "standard"`.
  5. `adminExportEnrollments` (same page, `'[{"package":"standard"}]'`, admin) → the CSV header contains `Package`, and the row contains `Forex Mastery`.
  6. End: `node "$H/mockdb.cjs" restore` and the stub `__reset`.

- [ ] **Step 6: Commit.**

```bash
git add lib/actions/admin-enrollments.ts "app/(admin)/admin/enrollments/page.tsx" lib/hooks/queries/keys.ts lib/actions/admin-payments.ts "app/(admin)/admin/payments/page.tsx"
git commit -m "feat(admin): package column, filter and audited package change on enrollments; package on orders

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
