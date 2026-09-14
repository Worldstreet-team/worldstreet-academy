# Mastery Academy — Phase 0 Implementation Plan (Foundations)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every later phase a name to import and a field to write — brand constants + one shared lockup, a static 8-school taxonomy with a `school` field on courses, the package/tier schema on courses/lessons/enrollments/orders with a pure entitlements helper, and an idempotent catalogue script — with nothing user-visible changing except the brand string.

**Architecture:** All schema changes are additive with defaults (a Go mobile API reads the same MongoDB). Static config lives in `lib/` (`brand.ts`, `schools.ts`, `entitlements.ts`), models in `lib/db/models/*`, the live course save path is `lib/actions/instructor.ts` (formData → manual validation), and the catalogue script follows `scripts/_swap-catalogue.mjs` (raw collection, `--apply` gate).

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict · Mongoose · Zod (`import { z } from "zod/v4"`) · Tailwind v4 · lucide-react.

**Spec:** `docs/mastery-academy-blueprint.md` (copy) and `docs/mastery-academy-plan.md` §Phase 0 (scope). This file is the task-level expansion of that phase.

## Global Constraints

- **Additive only.** New schema fields have defaults; no field renamed or removed; no new `role` values; existing documents must deserialize unchanged.
- **Brand name is exactly** `WorldStreet Mastery Academy` (capital S — D1). Lockup eyebrow text is `Mastery Academy`, rendered uppercase by CSS. Certificate prefix stays `WSA`.
- **Money units:** `Course.price` and package `price` are whole USD; never touch the cents conversion in `lib/actions/enrollments.ts`.
- **No new dependencies. No `any`.** Zod is `import { z } from "zod/v4"`.
- **Icons:** `lucide-react` only, never emoji. Runtime-chosen icons render via `components/shared/render-icon.tsx`.
- **UI tokens:** never hardcode a palette hex; use the existing `text-ws-gold`, `font-display`, etc. classes already in the lockup markup.
- **Verification:** no test runner exists. Every task ends with `npx tsc --noEmit` and `pnpm lint` clean, plus the task's own runtime check. A `pnpm dev:mock` server is already running on http://localhost:3001 from this checkout (mock Clerk; persona cookie `mock_persona=student|instructor|admin`). Do **not** start a second dev server. Mongoose caches models on `global`, so schema edits need that server restarted to take effect — the controller does the restart; implementers verify schema work with `tsc` and a one-off `npx tsx` snippet where stated.
- **Commits:** one or more per task, message ends with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Never commit `.env*`.
- **Surgical:** touch only listed files (plus files a compile error forces you into — say so in the report). No reformatting, no drive-by refactors. Do not delete `components/marketing/hero-slider.tsx` (Phase 1 does).

---

### Task 1: Brand constants + shared lockup + rename

**Files:**
- Create: `lib/brand.ts`
- Create: `components/shared/brand-lockup.tsx`
- Modify: `components/marketing/navbar.tsx:34-48`, `components/marketing/footer.tsx:10-24`, `components/platform/app-sidebar.tsx:235-250`, `components/instructor/instructor-sidebar.tsx:209-224`, `components/admin/admin-sidebar.tsx:153-165`
- Modify (string rename): `app/layout.tsx`, `app/(marketing)/page.tsx`, `lib/email.tsx`, `components/learn/certificate-view.tsx`, `lib/ics.ts`, `lib/actions/applications.ts`, `lib/vivid/prompt.ts`, `components/welcome/onboarding-steps.ts`, `components/welcome/onboarding-modal.tsx`, `app/(platform)/dashboard/become-instructor/page.tsx`, `components/marketing/hero-wall.tsx`, `components/marketing/about-band.tsx`, `components/marketing/faq.tsx`, `components/marketing/hero-slider.tsx`, `components/shared/illustrations.tsx` (comment only — may stay), `scripts/seed.ts` (comment), `scripts/_swap-catalogue.mjs` (comment)

**Interfaces:**
- Produces: `BRAND` const (below) and `BrandLockup` component. Later tasks import `BRAND` from `@/lib/brand`.

- [ ] **Step 1: Create `lib/brand.ts`** — exactly:

```ts
/**
 * Brand facts for WorldStreet Mastery Academy. The only place the product
 * name, lockup eyebrow, tagline and sender identity are spelled out — every
 * surface imports from here (design-system 04-components → TopNav lockup).
 */
export const BRAND = {
  name: "WorldStreet Mastery Academy",
  /** Lockup wordmark next to the gold wsa-mark. */
  wordmark: "WorldStreet",
  /** Lockup eyebrow; rendered uppercase by CSS. Admin shell overrides with "Admin". */
  eyebrow: "Mastery Academy",
  tagline: "Learn Skills. Build Value. Own Your Future.",
  descriptor:
    "The world's premier institution for skills, innovation and wealth liquefaction.",
  supportEmail: "support@worldstreetgold.com",
  fromEmail: "WorldStreet Mastery Academy <noreply@worldstreet.academy>",
  certificatePrefix: "WSA",
} as const
```

- [ ] **Step 2: Create `components/shared/brand-lockup.tsx`** — a server component (no `"use client"`) that renders the *inner* lockup only; callers keep their own `<Link>` / `SidebarMenuButton` wrapper:

```tsx
import Image from "next/image"
import { BRAND } from "@/lib/brand"
import { cn } from "@/lib/utils"

type BrandLockupProps = {
  /** Eyebrow under the wordmark; defaults to the product eyebrow. */
  eyebrow?: string
  /** Alt text for the mark. Empty (decorative) when the wrapper already labels the link. */
  alt?: string
  /** Sidebar variant: text block fills and truncates inside a collapsible rail. */
  truncate?: boolean
  className?: string
}

/**
 * Unified ecosystem lockup (design-system 05-screens): gold wsa-mark 26px +
 * "WorldStreet" Poppins SemiBold 15 + gold uppercase app eyebrow. One
 * implementation for the marketing navbar/footer and all three sidebars.
 */
export function BrandLockup({ eyebrow = BRAND.eyebrow, alt = "", truncate = false, className }: BrandLockupProps) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <Image
        src="/brand/wsa-mark.png"
        alt={alt}
        width={26}
        height={26}
        className="h-[26px] w-[26px] shrink-0 object-contain"
      />
      <span className={cn("grid min-w-0 text-left leading-tight", truncate && "flex-1")}>
        <span className={cn("font-display text-[15px] font-semibold tracking-tight", truncate && "truncate")}>
          {BRAND.wordmark}
        </span>
        <span className={cn("font-sans text-[10px] font-semibold uppercase tracking-[2px] text-ws-gold", truncate && "truncate")}>
          {eyebrow}
        </span>
      </span>
    </span>
  )
}
```

- [ ] **Step 3: Replace the five inline lockups.** Keep each wrapper element and its classes/handlers; replace only the `<Image …/>` + text-block pair with `<BrandLockup …/>`; remove the now-unused `Image` import where nothing else uses it.
  - `components/marketing/navbar.tsx` → `<Link href="/" className="flex shrink-0 items-center gap-2"><BrandLockup alt={BRAND.name} /></Link>` (the Link already carries `flex … gap-2`; BrandLockup's own `flex` span nests fine).
  - `components/marketing/footer.tsx` → same, `alt=""`.
  - `components/platform/app-sidebar.tsx` and `components/instructor/instructor-sidebar.tsx` → inside the existing `SidebarMenuButton`: `<BrandLockup truncate />`; change the `aria-label` to `` `${BRAND.name} home` ``.
  - `components/admin/admin-sidebar.tsx` → `<BrandLockup truncate eyebrow="Admin" alt={BRAND.name} />`.

- [ ] **Step 4: Rename every remaining brand string.** Run `grep -rniE "worldstreet academy" --include=*.ts --include=*.tsx --include=*.mjs . --exclude-dir=node_modules --exclude-dir=.next` and fix each hit (43 expected). Rules:
  - Metadata: `app/layout.tsx` → `default: BRAND.name`, `template: \`%s | ${BRAND.name}\``; `app/(marketing)/page.tsx` description → use `BRAND.name`.
  - `lib/email.tsx` → `const FROM_EMAIL = process.env.EMAIL_FROM || BRAND.fromEmail`; the eight footer strings → `BRAND.name` (template literals).
  - `components/learn/certificate-view.tsx` → visible wordmark and jsPDF text become `WORLDSTREET MASTERY ACADEMY` (`BRAND.name.toUpperCase()`), alt text `BRAND.name`.
  - `lib/ics.ts` PRODID → `-//WorldStreet Mastery Academy//Interview//EN`.
  - `lib/actions/applications.ts`, `lib/vivid/prompt.ts` (the live prompt line), `components/welcome/*`, `app/(platform)/dashboard/become-instructor/page.tsx`, `components/marketing/hero-wall.tsx` (aria-label + visible eyebrow), `about-band.tsx`, `faq.tsx` (“Can I teach on WorldStreet Mastery Academy?”), `hero-slider.tsx` → `BRAND.name` or the literal new name where a template literal is awkward.
  - Pure file-header comments (`lib/vivid/*.ts` line 2, `components/shared/illustrations.tsx`, `scripts/*`) may stay; the grep after this step must show **only** comment lines.

- [ ] **Step 5: Verify.** `npx tsc --noEmit` and `pnpm lint` clean. `curl -s http://localhost:3001/ | grep -o "<title>[^<]*</title>"` prints `WorldStreet Mastery Academy`; `curl -s http://localhost:3001/ | grep -c "Mastery Academy"` ≥ 2 (navbar + footer eyebrow). Re-run the grep from Step 4 and paste the residual (comment-only) lines into the report.

- [ ] **Step 6: Commit** — `feat(brand): WorldStreet Mastery Academy name + one shared lockup`.

---

### Task 2: Schools taxonomy + `Course.school`

**Files:**
- Create: `lib/schools.ts`
- Modify: `lib/db/models/course.ts` (interface + schema), `lib/types/course.ts`, `lib/types/index.ts`, `lib/actions/instructor.ts` (`fetchCourseForEdit` ~:150-170, `createCourse` ~:188-260, `updateCourse` ~:317-400), `components/instructor/course-editor.tsx` (:41, :56, :62-70, :183, :286, :488-500), `lib/actions/courses.ts:21` (only if it has live callers — see Step 5)

**Interfaces:**
- Produces: `SchoolSlug`, `School`, `SCHOOLS`, `SCHOOL_BY_SLUG`, `SCHOOL_SLUGS` from `@/lib/schools`; `ICourse.school: SchoolSlug | null`; `Course.school: SchoolSlug | null` DTO field.
- Consumes: nothing from Task 1.

- [ ] **Step 1: Create `lib/schools.ts`** — copy the eight schools' `name`, `short`, `blurb` from the spec §4 verbatim; only Trading has `tagline`/`intro` (spec §5). `icon` is a lucide icon **name string** rendered through `components/shared/render-icon.tsx` (read that file first and use its expected name format — kebab or PascalCase — for all eight; verify each icon exists in `node_modules/lucide-react/dist/lucide-react.d.ts` and substitute the nearest existing one if not, listing the final names in the report):

```ts
/**
 * The eight Schools of WorldStreet Mastery Academy (spec §4–5). Static and
 * code-owned: a school is a way of grouping programs, not a document.
 * Program membership is NOT listed here — it is `Course.school` on each
 * course, so the DB is the only source of which programs a school has.
 */
export type SchoolSlug =
  | "trading-financial-markets"
  | "blockchain-web3"
  | "ai-automation"
  | "software-app-development"
  | "cybersecurity"
  | "data-analytics"
  | "digital-media-creative"
  | "digital-business-remote-careers"

export type School = {
  slug: SchoolSlug
  /** Full name, e.g. "School of Trading & Financial Markets". */
  name: string
  /** Short label without "School of" — also written to Course.category for legacy/mobile displays. */
  short: string
  /** Card blurb (spec §4). */
  blurb: string
  /** School-page headline (spec §5); null renders nothing. */
  tagline: string | null
  /** School-page intro paragraph (spec §5); null falls back to blurb. */
  intro: string | null
  /** lucide icon name for RenderIcon. */
  icon: string
  order: number
}

export const SCHOOLS: readonly School[] = [
  {
    slug: "trading-financial-markets", order: 1, icon: "landmark",
    name: "School of Trading & Financial Markets",
    short: "Trading & Financial Markets",
    blurb: "Learn about Forex, cryptocurrency, market analysis, risk management and trading psychology.",
    tagline: "Understand the markets. Develop your skills. Trade with knowledge.",
    intro: "Financial markets offer enormous opportunities—but opportunity without knowledge can become expensive experience. Our programs are designed to help students understand market fundamentals, develop structured approaches to analysis and learn responsible risk management.",
  },
  {
    slug: "blockchain-web3", order: 2, icon: "blocks",
    name: "School of Blockchain & Web3",
    short: "Blockchain & Web3",
    blurb: "Understand the technology behind blockchain, digital assets and the emerging Web3 economy.",
    tagline: null, intro: null,
  },
  {
    slug: "ai-automation", order: 3, icon: "bot",
    name: "School of Artificial Intelligence & Automation",
    short: "AI & Automation",
    blurb: "Discover how AI is transforming business, productivity, creativity and everyday work.",
    tagline: null, intro: null,
  },
  {
    slug: "software-app-development", order: 4, icon: "code",
    name: "School of Software & App Development",
    short: "Software & App Development",
    blurb: "Learn how modern applications are designed and developed, including the use of AI-powered development tools.",
    tagline: null, intro: null,
  },
  {
    slug: "cybersecurity", order: 5, icon: "shield-check",
    name: "School of Cybersecurity",
    short: "Cybersecurity",
    blurb: "Build knowledge of digital security, cyber threats and responsible cybersecurity practices.",
    tagline: null, intro: null,
  },
  {
    slug: "data-analytics", order: 6, icon: "chart-column",
    name: "School of Data & Analytics",
    short: "Data & Analytics",
    blurb: "Learn how to collect, understand, analyze and communicate data for better decisions.",
    tagline: null, intro: null,
  },
  {
    slug: "digital-media-creative", order: 7, icon: "clapperboard",
    name: "School of Digital Media & Creative Technology",
    short: "Digital Media & Creative Technology",
    blurb: "Turn ideas into compelling digital content and develop skills for the creator economy.",
    tagline: null, intro: null,
  },
  {
    slug: "digital-business-remote-careers", order: 8, icon: "briefcase",
    name: "School of Digital Business & Remote Careers",
    short: "Digital Business & Remote Careers",
    blurb: "Build practical skills for selling, marketing, e-commerce and working in the global digital economy.",
    tagline: null, intro: null,
  },
]

export const SCHOOL_BY_SLUG = Object.fromEntries(SCHOOLS.map((s) => [s.slug, s])) as Record<SchoolSlug, School>

/** Tuple form for z.enum(). */
export const SCHOOL_SLUGS = SCHOOLS.map((s) => s.slug) as [SchoolSlug, ...SchoolSlug[]]

export function isSchoolSlug(value: unknown): value is SchoolSlug {
  return typeof value === "string" && value in SCHOOL_BY_SLUG
}
```

- [ ] **Step 2: Model.** In `lib/db/models/course.ts` add to `ICourse` after `category: string`:
```ts
  /** School this program belongs to (lib/schools.ts). null only on legacy rows not yet re-saved. */
  school: SchoolSlug | null
```
with `import type { SchoolSlug } from "@/lib/schools"` at the top, and in the schema after `category`:
```ts
    school: {
      type: String,
      default: null,
      index: true,
    },
```
Export the type from `lib/db/models/index.ts` is not needed (it lives in `lib/schools`).

- [ ] **Step 3: Types.** `lib/types/course.ts`: delete the `CourseCategory` union; add `import type { SchoolSlug } from "@/lib/schools"`; in `Course` replace `category?: CourseCategory` with `category?: string` and add `school: SchoolSlug | null`. `lib/types/index.ts`: remove `CourseCategory` from the export list. Fix every other `CourseCategory` import (`grep -rn CourseCategory --include=*.ts --include=*.tsx . --exclude-dir=node_modules` must return zero).

- [ ] **Step 4: Live save path — `lib/actions/instructor.ts`.**
  - `fetchCourseForEdit`: replace `category: (course.category || "Cryptocurrency") as CourseCategory` with `category: course.category ?? ""` and add `school: (course.school ?? null) as SchoolSlug | null`. Extend the returned course type accordingly.
  - `createCourse` and `updateCourse`: read `const school = formData.get("school")`; if `!isSchoolSlug(school)` → `fieldErrors.school = "Choose a school"`. On persist set `school` and `category: SCHOOL_BY_SLUG[school].short` (replacing the `category || "Cryptocurrency"` / `category || existingCourse.category` fallbacks). Remove the now-unused `category` formData read.

- [ ] **Step 5: Dormant Zod stack.** `grep -rn "lib/actions/courses\"" --include=*.ts --include=*.tsx . --exclude-dir=node_modules`. If any live caller submits `category`, add `school: z.enum(SCHOOL_SLUGS)` to `CreateCourseSchema` in `lib/actions/courses.ts` and derive `category` the same way; if there are no callers, leave the file untouched and say so in the report.

- [ ] **Step 6: Editor — `components/instructor/course-editor.tsx`.** Replace the `CATEGORIES` const and the category `<Select>` with a School select over `SCHOOLS` (label = `name`, value = `slug`, placeholder "Choose a school"); state `const [school, setSchool] = useState<SchoolSlug | "">(course?.school ?? "")`; hidden input `name="school" value={school}`; show `fieldErrors.school` under it like other fields; the editor's `course` prop type gains `school: SchoolSlug | null` and drops `CourseCategory`. Label the section "School" (it was "Category").

- [ ] **Step 7: Verify.** `npx tsc --noEmit`, `pnpm lint` clean. Runtime (server restart is the controller's job — note in report if you could not observe it): with `mock_persona=instructor`, open http://localhost:3001/instructor/courses/new → the School select lists eight schools; saving without one shows "Choose a school".

- [ ] **Step 8: Commit** — `feat(schools): static 8-school taxonomy and Course.school`.

---

### Task 3: Package (tier) schema + entitlements helper

**Files:**
- Create: `lib/entitlements.ts`
- Modify: `lib/db/models/course.ts`, `lib/db/models/lesson.ts`, `lib/db/models/enrollment.ts`, `lib/db/models/order.ts`, `lib/db/models/index.ts`, `lib/actions/instructor.ts` (`createCourse`/`updateCourse` persist blocks)

**Interfaces:**
- Produces: `PackageKey`, `IPackageEntitlements`, `ICoursePackage` (from `@/lib/db/models`), and from `@/lib/entitlements`: `PACKAGE_RANK`, `FULL_ACCESS`, `packageFor`, `entitlementsFor`, `canAccessLesson`, `pricingFromPackages`.
- Consumes: nothing from Tasks 1–2 (independent).

- [ ] **Step 1: Course model.** In `lib/db/models/course.ts` add above `ICourse`:

```ts
export type PackageKey = "basic" | "standard" | "executive"

/** What a package unlocks beyond the lessons themselves (spec §6 ladder). */
export interface IPackageEntitlements {
  liveClasses: boolean
  instructorQa: boolean
  assignments: boolean
  certificate: boolean
  mentorship: boolean
  prioritySupport: boolean
}

/**
 * One purchasable tier of a course. Prices are whole USD like Course.price.
 * An empty `packages` array means the course sells at its single `price`
 * (every course today) — readers synthesize one package from it.
 */
export interface ICoursePackage {
  key: PackageKey
  name: string
  tagline: string
  price: number
  features: string[]
  highlight: boolean
  ctaLabel: string | null
  enabled: boolean
  entitlements: IPackageEntitlements
}
```
Add `packages: ICoursePackage[]` to `ICourse` after `examRequired`, and to the schema after `examRequired`:
```ts
    packages: {
      type: [
        new Schema<ICoursePackage>(
          {
            key: { type: String, enum: ["basic", "standard", "executive"], required: true },
            name: { type: String, required: true, trim: true, maxlength: 60 },
            tagline: { type: String, default: "", maxlength: 120 },
            price: { type: Number, required: true, min: 0 },
            features: { type: [String], default: [] },
            highlight: { type: Boolean, default: false },
            ctaLabel: { type: String, default: null, maxlength: 40 },
            enabled: { type: Boolean, default: true },
            entitlements: {
              liveClasses: { type: Boolean, default: false },
              instructorQa: { type: Boolean, default: false },
              assignments: { type: Boolean, default: false },
              certificate: { type: Boolean, default: false },
              mentorship: { type: Boolean, default: false },
              prioritySupport: { type: Boolean, default: false },
            },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
```
Export from `lib/db/models/index.ts`: `type PackageKey, type IPackageEntitlements, type ICoursePackage` alongside `ICourse`.

- [ ] **Step 2: Lesson.** `lib/db/models/lesson.ts`: add to `ILesson` after `isFree` — `/** Lowest package that can open this lesson; null = every tier (and every legacy enrollment). */ minPackageKey: PackageKey | null` (import the type from `./course`); schema after `isFree`: `minPackageKey: { type: String, enum: [null, "basic", "standard", "executive"], default: null },`.

- [ ] **Step 3: Enrollment + Order.** `lib/db/models/enrollment.ts` after `legacyUnpaid`: `/** Package bought (null = legacy single-price, free, or pre-enrolled). */ packageKey: PackageKey | null` and `/** Package name snapshot at purchase. */ packageName: string | null`; schema: `packageKey: { type: String, enum: [null, "basic", "standard", "executive"], default: null }, packageName: { type: String, default: null },`. `lib/db/models/order.ts` after `chargeId`: `packageKey: PackageKey | null` / `packageKey: { type: String, enum: [null, "basic", "standard", "executive"], default: null },`.

- [ ] **Step 4: Create `lib/entitlements.ts`** — pure, no DB:

```ts
import type { ICourse, ICoursePackage, IPackageEntitlements, PackageKey } from "@/lib/db/models"

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

type CourseLike = Pick<ICourse, "packages">
type EnrollmentLike = { packageKey: PackageKey | null } | null | undefined
type LessonLike = { minPackageKey: PackageKey | null }

export function packageFor(course: CourseLike, key: PackageKey | null): ICoursePackage | null {
  if (!key) return null
  return course.packages.find((p) => p.key === key && p.enabled) ?? null
}

/** null packageKey → FULL_ACCESS (grandfathered); a package → its switches. */
export function entitlementsFor(course: CourseLike, enrollment: EnrollmentLike): IPackageEntitlements {
  const pkg = packageFor(course, enrollment?.packageKey ?? null)
  return pkg ? pkg.entitlements : FULL_ACCESS
}

export function canAccessLesson(lesson: LessonLike, enrollment: EnrollmentLike): boolean {
  if (!lesson.minPackageKey) return true
  const key = enrollment?.packageKey ?? null
  if (!key) return true
  return PACKAGE_RANK[key] >= PACKAGE_RANK[lesson.minPackageKey]
}

/**
 * Course.price/pricing must stay truthful for surfaces (and the mobile app)
 * that only read the scalar: with packages, price = cheapest enabled package.
 * Returns null when there are no enabled packages (keep the course's own values).
 */
export function pricingFromPackages(packages: ICoursePackage[]): { pricing: "free" | "paid"; price: number } | null {
  const enabled = packages.filter((p) => p.enabled)
  if (enabled.length === 0) return null
  const price = Math.min(...enabled.map((p) => p.price))
  return { pricing: price > 0 ? "paid" : "free", price }
}
```

- [ ] **Step 5: Save path accepts packages.** In `lib/actions/instructor.ts` add (top of file) a Zod schema using `import { z } from "zod/v4"`:

```ts
const PackageSchema = z.object({
  key: z.enum(["basic", "standard", "executive"]),
  name: z.string().trim().min(2).max(60),
  tagline: z.string().trim().max(120).default(""),
  price: z.number().int().min(0).max(100000),
  features: z.array(z.string().trim().min(1).max(160)).max(20).default([]),
  highlight: z.boolean().default(false),
  ctaLabel: z.string().trim().max(40).nullable().default(null),
  enabled: z.boolean().default(true),
  entitlements: z.object({
    liveClasses: z.boolean(), instructorQa: z.boolean(), assignments: z.boolean(),
    certificate: z.boolean(), mentorship: z.boolean(), prioritySupport: z.boolean(),
  }),
})
const PackagesSchema = z
  .array(PackageSchema)
  .max(3)
  .refine((arr) => new Set(arr.map((p) => p.key)).size === arr.length, "Package keys must be unique")
  .refine((arr) => arr.filter((p) => p.highlight).length <= 1, "Only one package can be highlighted")
```
In both `createCourse` and `updateCourse`: read `formData.get("packages")`; when it is a non-empty string, `JSON.parse` it (invalid JSON → `fieldErrors.packages = "Packages could not be read"`), run `PackagesSchema.safeParse`; on failure set `fieldErrors.packages` to the first issue message; on success include `packages` in the persisted document **and** override `pricing`/`price` with `pricingFromPackages(packages)` when it returns non-null. When the field is absent (the editor does not send it yet — Phase 2 adds the UI) leave `packages` untouched.

- [ ] **Step 6: Verify.** `npx tsc --noEmit`, `pnpm lint` clean. Schema smoke test without the dev server: `npx tsx -e "import { Course } from './lib/db/models'; const c = new Course({ title: 'x', slug: 'x', description: 'x', instructor: '000000000000000000000000', category: 'x', packages: [{ key: 'basic', name: 'Basic', price: 49, entitlements: {} }] }); console.log(JSON.stringify(c.toObject().packages))"` prints one package with all six entitlement booleans defaulted to `false` and `enabled: true`. Paste the output in the report.

- [ ] **Step 7: Commit** — `feat(packages): tier schema on course/lesson/enrollment/order + entitlements helper`.

---

### Task 4: Catalogue script `scripts/mastery-catalogue.mjs`

**Files:**
- Create: `scripts/mastery-catalogue.mjs`

**Interfaces:**
- Consumes: the `packages` and `school` shapes from Tasks 2–3 (the script writes raw documents, so it duplicates the shape literally — keep it in sync with the schema).

- [ ] **Step 1: Write the script.** Model it on `scripts/_swap-catalogue.mjs` (dotenv `.env.local`, `mongoose.connect(process.env.MONGODB_URI)`, raw `db.collection("courses")`, `--apply` gate, dry-run prints the full diff). Behaviour:
  - **Match by exact `title`** (production slugs carry random suffixes, so slug is not a key). The D10 rename matches the old title `Content Creation / Video Editing Mastery` and retitles it `Content Creation Mastery`. The old title `Artificial Intelligence & AI Automation` is retitled to the spec's `AI & AI Automation`.
  - For each of the 12 programs: if found → `$set` `title`, `school`, `category` (= school short label), and — only where the spec supplies them — `shortDescription`, `description`, `whatYouWillLearn`, plus `packages`. **Never** overwrite `price`, `thumbnailUrl`, `status`, `instructor`, `enrolledCount`, `rating` on an existing row. If not found → insert a full document like the swap script does (all defaults present), `status: "draft"` for the two new programs (`Video Editing Mastery`, `E-Commerce & Digital Business`) and `"published"` otherwise, `thumbnailUrl: null`, `price` from the table below.
  - **Slug normalization:** compute `clean = slugify(title)`; if no *other* course holds that slug, `$set slug: clean` (Phase 2 URLs are `/programs/[slug]`). Otherwise keep the existing slug and print a warning.
  - Owner for inserts: `users.findOne({ email: "samsonrichfield@gmail.com" })`, falling back to `users.findOne({ role: { $in: ["ADMIN", "INSTRUCTOR"] } })` (the mock DB has no such email); abort if neither exists.
  - Single-package programs: `packages: [{ key: "standard", name: "Full program", tagline: "", price: <existing price or table price>, features: [], highlight: false, ctaLabel: null, enabled: true, entitlements: FULL }]` where `FULL` = all six `true`.
  - Never deletes or archives anything.

  Program table (`title → school slug, table price`): Forex Trading Mastery → trading-financial-markets, 199 · Crypto Trading Mastery → trading-financial-markets, 199 · Blockchain Technology Mastery → blockchain-web3, 99 · AI & AI Automation → ai-automation, 199 · App Development with AI → software-app-development, 49 · Cybersecurity → cybersecurity, 99 · Data Analysis → data-analytics, 99 · Content Creation Mastery → digital-media-creative, 99 · Video Editing Mastery → digital-media-creative, 99 · Tech Sales & Digital Marketing → digital-business-remote-careers, 49 · E-Commerce & Digital Business → digital-business-remote-careers, 49 · Virtual Assistance → digital-business-remote-careers, 49.

  Spec copy to embed verbatim (blueprint §5–8):
  - **Forex** `shortDescription`: "Learn the fundamentals and advanced concepts of Forex trading through a structured learning pathway." `description`: "Want to understand how the Forex market works? Want to stop relying on random information and start developing a structured understanding of the market? The Forex Trading Mastery program is designed to take you through a structured learning journey—from foundational concepts to advanced market analysis and trading principles." `whatYouWillLearn`: Forex fundamentals · Currency pairs · Market structure · Candlestick analysis · Technical analysis · Fundamental analysis · Trading strategies · Risk management · Trading psychology · Trade planning · Market analysis · Position sizing · Trading discipline · Practical application.
    Packages: **basic** `Forex Foundation` / `Perfect for beginners` / 49 / features: Forex fundamentals · Currency pairs · Market terminology · Charts & candlesticks · Introduction to technical analysis · Market structure fundamentals · Risk-management foundations · Trading psychology fundamentals · Learning materials · Community access where applicable / entitlements all `false`. **standard** `Forex Mastery` / `Designed for learners who want a comprehensive Forex education pathway.` / 199 / `highlight: true` / features: Everything in Basic · Advanced technical analysis · Fundamental analysis · Trading strategy frameworks · Trade planning · Execution principles · Advanced risk management · Trading psychology · Practical assignments · Live classes where scheduled · Instructor Q&A · Mentorship/community support where included · Educational market-analysis sessions where scheduled · Assessment & certificate / entitlements `liveClasses, instructorQa, assignments, certificate` true, `mentorship, prioritySupport` false. **executive** `Private Forex Mentorship` / `A premium one-on-one learning experience.` / 999 / `ctaLabel: "Apply / Enrol for $999"` / features: Everything in Standard · Private 1-on-1 coaching · Personalized learning roadmap · Private expert sessions · Individual strategy review · Personalized trading-plan development · Private Q&A · Direct mentorship · Individual progress assessment · Personalized feedback · Priority support / entitlements all `true`.
  - **Crypto** `shortDescription`: "Understand digital assets, crypto markets, analysis, security and responsible trading principles." `description`: "Cryptocurrency has created an entirely new financial and technological ecosystem. But entering the crypto market without proper knowledge can expose you to unnecessary risk. Our Crypto Trading Mastery program is designed to help you understand digital assets, market dynamics, analysis, risk management and responsible trading practices." `whatYouWillLearn`: Cryptocurrency fundamentals · Bitcoin & digital assets · Blockchain fundamentals · Exchanges & wallets · Market structure · Technical analysis · Fundamental analysis · Trading strategies · Risk management · Trading psychology · Portfolio principles · Crypto security · Practical market analysis.
    Packages: **basic** `Crypto Foundation` / `Perfect for beginners` / 49 / features: Cryptocurrency fundamentals · Bitcoin & digital assets · Blockchain fundamentals · Exchanges & wallets · Market structure · Introduction to technical analysis · Risk-management foundations · Crypto security · Learning materials · Community access where applicable. **standard** `Crypto Mastery` / `Designed for learners who want a comprehensive crypto education pathway.` / 199 / highlight / features and entitlements identical to Forex Standard. **executive** `Private 1-on-1 Crypto Mentorship` / same tagline, price, CTA, features and entitlements as Forex Executive.
  - **AI & AI Automation** `shortDescription`: "Turn Artificial Intelligence into a practical skill." `description`: "AI isn't just changing technology. It's changing how businesses operate, how people work and how opportunities are created. This program introduces you to practical AI tools, automation workflows and real-world applications." `whatYouWillLearn`: AI fundamentals · Prompt engineering · AI productivity tools · Content automation · Business automation · Workflow design · AI-assisted research · AI for marketing · AI for productivity · Building automated workflows. Packages: one **standard** `Founding price` / `` / 199 / features = the ten items above / entitlements all `true`.
  - **All other programs:** no spec copy — leave existing `description`/`shortDescription` alone; for the two new inserts use the school `blurb` as `description` and `shortDescription: null`.

- [ ] **Step 2: Dry-run output.** Print, per program: `MATCH <title>` / `INSERT <title>` / `RENAME <old> → <new>`, the slug decision, and the `$set` keys. End with `DRY RUN — nothing written. Re-run with --apply` unless `--apply`.

- [ ] **Step 3: Verify against the mock DB.** The running `pnpm dev:mock` uses `mongodb://127.0.0.1:27017/worldstreet-academy`. Run `MONGODB_URI=mongodb://127.0.0.1:27017/worldstreet-academy node scripts/mastery-catalogue.mjs` (dry run) → 12 `INSERT` lines, 0 errors; then `--apply` → `Inserted 12`; re-run dry → 12 `MATCH` lines and no `$set` beyond idempotent values (second `--apply` must change nothing — print `modifiedCount` and require 0 on the re-run). Paste the two dry-run outputs into the report. **Never run it against any other URI.**

- [ ] **Step 4: Commit** — `feat(catalogue): idempotent Mastery Academy catalogue script (12 programs, schools, packages)`.
