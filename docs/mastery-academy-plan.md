# Worldstreet Mastery Academy — Phased Implementation Plan

**Date:** 2026-09-14 · **Status:** IN PROGRESS — Phases 0–7 done and Phase 8 repo side done (unmerged branches; production steps in `docs/launch-runbook.md`) · **Spec:** `docs/mastery-academy-blueprint.md`
**Predecessor:** `docs/academy-update-plan.md` (July — admin, instructor pipeline, wallet, CBT exams; all built). Its hard constraints (Part 1) still bind this plan and are restated in §0.3.

> **How to drive this plan.** Say **"start phase N"**. The executor reads this file + the spec, opens a branch `mastery/phase-N`, expands the phase into bite-sized tasks (superpowers:subagent-driven-development), and reports against the phase's **Exit criteria** checklist — those are the sentences to read out in a status meeting. Phases are ordered by dependency; the "Parallel tracks" table in §0.5 shows what can overlap. Each phase ends with `pnpm lint`, `npx tsc --noEmit`, and a walk through the affected routes in `pnpm dev:mock` (mock Clerk, local Mongo, persona cookie `mock_persona=student|instructor|admin|guest`).

## Status board (update as phases land)

| Phase | Name | Est. | Status | Report line |
|---|---|---|---|---|
| 0 | Foundations — brand, schools taxonomy, package schema | 2–3 d | **done** 2026-09-14 (branch `mastery/phase-0`, 6 code commits, tasks in `docs/plans/mastery-phase-0.md`) | Brand renamed with one shared lockup; 8-school taxonomy + `Course.school`; package/tier schema on course/lesson/enrollment/order + entitlements helper; save action validates school and packages (price derives from packages); catalogue script dry-runs clean and seeds the mock DB (12 programs). Not yet applied to production (Phase 8). |
| 1 | Public site — homepage, schools index, school pages | 3–4 d | **done** 2026-09-14 (branch `mastery/phase-1` off `mastery/phase-0`, 9 code commits, tasks in `docs/plans/mastery-phase-1.md`) | Homepage rebuilt to §1–4/11/14–16 (eleven sections; one How-it-works timeline replaces the old Programs index + Rooms timeline; `hero-slider.tsx` and its orphans deleted); `/schools` and `/schools/[slug]` live with program counts and "View program" → `/courses/[id]`; navbar/footer/sidebar point at Schools · Programs · How it works; phone width verified (no overflow at 400px). Open product items: §16 says "Create Your Future" while the tagline says "Own"; "Explore programs" CTAs land on `/schools` while nav "Programs" lands on `/courses`; programs have no thumbnails yet (school icon fallback shown). |
| 2 | Program page + packages editor + catalogue content | 3–4 d | **done** 2026-09-14 (branch `mastery/phase-2` off `mastery/phase-1`, 10 code commits, tasks in `docs/plans/mastery-phase-2.md`) | `/programs/[slug]` live: hero, what you'll learn, a 1–3-package ladder with a checkout link per package, what's included, instructor, FAQ and a phone price bar. `/programs` lists every program by school; `/courses` and `/courses/[id]` redirect (308). Instructors and admins edit packages (validated server-side, course price follows the cheapest tier) and per-lesson minimum packages limited to the tiers a course sells. Guests who sign in from a program page return to it. Checkout still charges the course price, so this ships with Phase 3 (carry-overs written into Phase 3). Content debt for product: intros for 7 schools; curricula, descriptions and package ladders for the 9 single-price programs; thumbnails for all 12; instructor bios; §6 per-package description sentences; Crypto's top tier label ("Executive 1-on-1" in §7 vs "Executive 101"); legal pages. |
| 3 | Checkout + tier commerce + entitlement enforcement | 3–4 d | **done** 2026-09-14 (branch `mastery/phase-3` off `mastery/phase-2`, 7 tasks + 5 task-review fixes + 5 final-review fixes, tasks in `docs/plans/mastery-phase-3.md`) | Checkout charges the chosen package: Forex Basic debits $49.00, and the order, enrollment and confirmation email all record the package. The wallet reference carries the package, so legacy orders stay idempotent, and a buyer who loses a concurrent purchase is refunded. Checkout has a package summary and switcher; the success page reads "Enrollment confirmed — Your learning journey starts now."; Executive buyers get a one-time intake form and the instructor and admins are notified. Server-side gates cover locked lessons (media withheld, progress over open lessons), knowledge checks, the final exam and certificates (Basic completes but never certifies, including on instructor views and the completion page), live classes (join, notify list, invites) and instructor Q&A (every new-thread path: Message buttons, messages, calls); legacy enrollments keep full access. Admins see, filter and change a live enrollment's package; the change is audited, and completion is re-checked in the same write, so an upgrade never hands out an unearned certificate. Orders show their package. Closed two pre-existing holes: marking a lesson or course complete used to create an enrollment on any course, and finishing a course did not require its lessons. Go patch list: `docs/go-patches-phase-3.md` (ship with Go, or leave lesson tiers unset). Ops: confirm `WALLET_*` in Coolify and schedule `POST /api/cron/course-live`. Deferred: progress denominator alignment (Phase 4), staff-with-enrollment over-locking, exam save/submit after an admin package change, the race-loser and cancelled-re-buy messages, refusal copy naming the package. |
| 4 | Student dashboard per blueprint | 3–4 d | **done** 2026-09-14 (branch `mastery/phase-4` off `mastery/phase-3`, 6 tasks + 2 task-review fixes + 3 final-review fixes, tasks in `docs/plans/mastery-phase-4.md`) | `/dashboard` is the §12 dashboard: "Welcome to WorldStreet Mastery Academy — Your learning journey starts now." after checkout, a gold Continue learning CTA (the only gold button), and tiles for Current course, My progress (published lessons the package opens), Upcoming classes, Assignments, Certificates, Instructor / Mentor, Community (only when `NEXT_PUBLIC_COMMUNITY_URL` is set) and Support. Tiles and badges never claim more than the package gives: Upcoming classes / Certificates hide without live classes / a certificate; "Your mentor" and "Priority support" only on a bought, live Executive enrollment (never on grandfathered full access); the help page mail gets a `[Priority]` subject for those students. Instructors schedule a course class for later from the session modal, can start it from 15 minutes before its time, and can cancel it; students with live classes see it under Upcoming classes (dashboard and `/dashboard/meetings`, still listed as "Waiting for your instructor" for 2 h if the host is late), get reminders in class wording with the time zone named (no false "tomorrow"), and are told when it begins if they try to join before the host starts it. Assignments list the knowledge checks and final exams the package includes, with their attempt state (a final says "Finish lessons first" until lessons are done). My programs shows each card's package and a chip for every status that doesn't open the player. Progress now counts published lessons the package opens everywhere (Go doc R3 updated). Local checks ran with Resend/RealtimeKit keys replaced by placeholders after we found dev:mock inherits live keys from `.env.local`. |
| 5 | Faculty — profiles, public pages, editor | 2–3 d | **done** 2026-09-14 (branch `mastery/phase-5` off `mastery/phase-4`, 5 tasks + the shared Phases 5–6 final-review fix wave, tasks in `docs/plans/mastery-phase-5.md`) | `/faculty` lists every instructor or admin with at least one published program (featured first, then by students) and `/faculty/[username]` shows photo, name, specialization, short bio, professional experience, credentials and the programs they teach; anyone else gets a real 404. Instructors edit their faculty profile on `/instructor/profile`; admins edit any instructor's and mark who is featured from the user sheet on `/admin/users`; an approved application copies the applicant's experience when the profile has none. The homepage faculty teaser and the Faculty nav/footer links appear only while faculty exists; program pages and the signed-in instructor page link the public profile. Writes are dotted `$set`s so fields the Go API stores survive (Go note in `docs/go-patches-phase-3.md`). |
| 6 | Certification & trust — rebrand, IDs, verify page, testimonials | 2 d | **done** 2026-09-14 (branch `mastery/phase-6` off `mastery/phase-5`, 6 tasks + the shared final-review and runtime-check fix wave + 2 follow-up fixes (verify limit key, review ownership), tasks in `docs/plans/mastery-phase-6.md`) | A certifying completion (lesson, exam pass or Finish) stores a stable ID (`WSA-` + 8 Crockford symbols) under a partial unique index; Basic completions get none. `scripts/backfill-certificate-ids.mjs` stores the legacy printed ID on certificates issued before this phase (dry run by default; `--apply` needs an explicit `MONGODB_URI` — run in production at launch). The certificate prints the student, program and school, completion date (UTC), the stored ID, a verify URL and the instructor's signature, in WorldStreet Mastery Academy branding; the Academy signatory slot stays dormant until product supplies a name and signature file (D9). `/verify/<id>` is public and noindex, shows names and dates only, and says "No certificate with this ID" for anything not completed and certificate-entitled. Students set their country on `/dashboard/profile`; homepage testimonials read Name · Country · Program, and admins feature reviews from `/admin/reviews` inside the existing honesty floor. |
| 7 | Executive services — mentorship booking, roadmap, assignments | 5–7 d | **done** 2026-09-14 (branch `mastery/phase-7` off `mastery/phase-8`, 6 tasks + the Phases 7–8 final-review fix wave + 1 follow-up (session students join as participants), tasks in `docs/plans/mastery-phase-7.md`); two checks need staging | Students on a package with mentorship request a private session with up to three times (at least an hour ahead, within 60 days) from `/dashboard/mentorship` or the Instructor / Mentor tile, and can cancel; one open request per enrollment. Instructors see a Mentorship panel on `/instructor/meetings`: confirming a time creates the RealtimeKit room first (nothing is written if that fails), then a private meeting only the student, the host and admins can join, with the class early-start rule, the not-started refusal and reminders; they can decline or cancel, and write each mentee's plain-text roadmap, which the student reads on `/dashboard/mentorship`. Instructors author and publish assignments and grade submissions 0–100 with feedback; students on a package with assignments submit text and files from `/dashboard/assignments` (files only in the private resources bucket, under the student's own prefix), and the Assignments tile lists exams and assignments together. Uploads fail closed until `R2_RESOURCES_BUCKET_NAME` is set; a real confirmed session and a real file upload/download were not run locally (placeholder RealtimeKit key, no private bucket) — run both on staging before release (`docs/launch-runbook.md`). No session quota in v1. |
| 8 | Launch — SEO, legal, migration in prod, Go patches, QA of §17 journey | 2–3 d | **repo side done** 2026-09-14 (branch `mastery/phase-8` off `mastery/phase-6`, 5 tasks + 1 review fix; 40 of 41 runtime checks pass (the home canonical is Next's bare-origin form), tasks in `docs/plans/mastery-phase-8.md`); **production steps not run** | Every marketing page carries canonical URLs and the brand share card (program pages use their thumbnail); `/sitemap.xml` lists home, schools, published programs and faculty, and `/robots.txt` keeps the signed-in apps out while leaving `/verify` crawlable for its noindex. The footer's Legal column links the WorldStreet hub's published legal documents (worldstreetgold.com/legal) — no Academy copy was written. The two one-off identity scripts with real Clerk ids are removed. `docs/launch-runbook.md` is the owner's ordered checklist: blockers, backup, Go release first, Coolify env, deploy, scheduled tasks (Node fetch — the image has no curl), the catalogue dry run → apply (stop if anything but the two new drafts would be inserted), the certificate-ID backfill, the §17 journey on production, rollback and post-launch cleanup. Go notes for Phases 5–6 are in `docs/go-patches-phase-3.md` §5 and §0.4. `context.md` and the `dev:mock` header are current; `CLAUDE.md` is local-only (excluded from git) and was updated in place. |

Total ≈ 25–34 dev-days sequential; ≈ 18–24 with the parallel tracks in §0.5.

---

## 0. Ground truth and decisions

### 0.1 What exists today (audit synthesis, 2026-09-14)

Public: three marketing routes (`/`, `/courses`, `/courses/[courseId]`). The landing (`components/marketing/landing.tsx`) already has the *shape* of the blueprint — hero wall, about band, a hardcoded "programs" list + a 3-step "rooms" timeline (near-duplicates), catalogue rail, upcoming drops, real-review testimonials (floor-gated), a 6-question FAQ, finale CTA. The public course page has **no buy button for a live course** — only wishlist; purchase happens from `/dashboard/courses/[id]` → `/dashboard/checkout?courseId=` (wallet debit via `purchaseCourse`). Guests are sent to production Clerk at `worldstreetgold.com`.

Data: `Course` is single-price (`pricing: free|paid`, `price` in **dollars**), `category` is a free string with a 7-value type-level list duplicated in `lib/types/course.ts:4` and `components/instructor/course-editor.tsx:62`, and there is **no School, Package/Tier, Faculty, Assignment, Booking or Certificate model**. `Enrollment` has a **unique `{user, course}` index** and no tier. `Order.reference` doubles as the wallet idempotency key. Certificates are derived from completed enrollments and already print an ID (`WSA-<last 8 of enrollment id>`), but there is no public verify route.

Dashboard: `/dashboard` shows greeting + progress pane + my courses + browse + bookmarks. Missing vs blueprint §12: continue-learning CTA (sidebar only), upcoming classes (the `Meeting.scheduledAt` plumbing exists — reminders cron reads it — but no instructor create-path sets it and no student list shows it), certificates tile, instructor/mentor tile, assignments (no concept at all), community, support tile. `/dashboard/help` exists (FAQ + `mailto:support@worldstreetgold.com`).

Catalogue in production: 10 programs installed by `scripts/_swap-catalogue.mjs` (single flat prices 49/99/199; "Content Creation / Video Editing" is one course; no "E-Commerce & Digital Business"). The blueprint lists **12**.

Brand: "WorldStreet Academy" appears in 43 code locations; the lockup (mark + "WorldStreet" + gold "ACADEMY" eyebrow) is **copy-pasted in 5 files**, no shared component.

### 0.2 Decisions to take at the 10:00 meeting (defaults in bold — the plan proceeds on the defaults unless overruled)

| # | Question | Default |
|---|---|---|
| D1 | Brand casing and lockup: blueprint writes "Worldstreet"; the ecosystem lockup is "WorldStreet" + "ACADEMY" (ratified 2026-08-03). | **"WorldStreet Mastery Academy"** in copy/metadata/emails/certificates; lockup eyebrow becomes **"MASTERY ACADEMY"** (needs a one-line update in `../design-system/04-components`). Keep certificate prefix `WSA-`. Tagline "wealth liquefaction" — confirm wording with product. |
| D2 | Do tiers gate **content** (Basic and Standard have different curricula in §6) or only **services**? | **Both.** Lessons carry `minPackageKey`; services are explicit booleans on the package. Requires a Go patch (§0.4) in the same release as Phase 3. |
| D3 | Prices for the 10 non-trading programs (blueprint shows AI at a single "Founding price $199"; prod has 49/99). | **Single package per program at today's prod price** until product supplies tiers; Forex + Crypto get the full 3-tier ladder from §6–7. |
| D4 | Executive $999 — "Apply" (form first) or "Enrol" (pay now)? | **Pay now**, then an intake form + instructor/admin notification; session booking is Phase 7. |
| D5 | Tier upgrades (Basic → Standard) | **None in v1** (admin can change `packageKey` in `/admin/enrollments`); v2 = pay the difference. |
| D6 | "Community" destination | **`NEXT_PUBLIC_COMMUNITY_URL` env** (WorldStreet Social, or a Telegram/Discord invite); tile hidden when unset. |
| D7 | Assignments | **Lite now** (tile lists lesson knowledge-checks + final exam from the existing exam engine); **full submissions** (file upload + grading) in Phase 7. |
| D8 | Program URLs | **`/programs/[slug]`** (SEO, uses the existing unique `Course.slug`); `/courses/[id]` 308-redirects; `/courses` → `/programs`. |
| D9 | Certificate "authorized signature" | **Instructor signature (existing) + an Academy signatory image** (`public/brand/signatory.png`, name in `lib/brand.ts`). Needs the signatory's name + signature file from product. |
| D10 | Catalogue data changes: split "Content Creation / Video Editing" into two; add "E-Commerce & Digital Business". | **Rename existing → "Content Creation Mastery"** (keeps its enrollments); create the two new courses as drafts until they have lessons. |

### 0.3 Hard constraints (inherited — do not relitigate)

1. **Two backends, one database.** The Go mobile API reads the same collections. Every schema change is **additive with defaults**; no renamed fields, no new role enum values, no changed semantics of existing `status` values. Web-only enforcement of a money/access rule is bypassable from mobile until Go is patched — plan those patches in the same release (§0.4).
2. **Money:** `Course.price`/`Enrollment.pricePaid` are dollars; `Order.amountMinor`, `Earning.*Minor`, and every `lib/wallet.ts` call are **integer cents**. Conversion happens once, server-side (`lib/actions/enrollments.ts:134`). No amount ever comes from the client. Wallet env missing ⇒ fail closed.
3. **Identity:** Clerk id (`authUserId`) is the wallet subject; Mongo `_id` for Ably channels. Never overwrite `authUserId`.
4. **UI:** DS v2 stone+gold (`../design-system/`, tokens via `var(--ws-*)`), lucide only (the blueprint's school emoji become lucide icons), radii 4/7/10/13/999, gold = CTA/active/brand only, `render` prop not `asChild`, RSC-first, `pb-24 md:pb-8`.
5. **Truthfulness:** no fabricated testimonials (§14), no aggregate stats we don't have, "Pre-enrol free" only where `preEnrollEnabled`.
6. **No new deps** without asking; no `any`; Zod via `zod/v4`.

### 0.4 Cross-repo coordination checklist

| When | Repo | Change |
|---|---|---|
| Phase 3 | Go (`worldstreet-academy/backend`) | Lesson list/detail: hide or lock lessons where `lesson.minPackageKey` outranks `enrollment.packageKey` (null packageKey = full access, grandfathered). Certificate endpoints: refuse when the enrollment's package has `entitlements.certificate === false`. Any mobile purchase path must accept `packageKey` and compute price from `course.packages` — verify whether one exists. |
| Phase 0 | `../design-system/04-components` | Lockup eyebrow "ACADEMY" → "MASTERY ACADEMY" (D1). |
| Phase 0 → 8 | Go (`worldstreet-academy/backend`) / mobile | `Course.category` changes vocabulary: the legacy 7-value list (Cryptocurrency, Trading, DeFi, …) becomes the school's short label ("Trading & Financial Markets", …) on every live row once `scripts/mastery-catalogue.mjs --apply` runs in Phase 8. Any mobile filter/grouping keyed on the old strings must switch to `Course.school` (or the new labels) in the same release. |
| Phase 8 (ordering) | this repo / Coolify | `scripts/mastery-catalogue.mjs --apply` lowers Forex/Crypto scalar `price` to the cheapest package ($49) and raises AI to the spec's $199 — it must run **after** Phase 3's package-aware checkout is deployed (the script refuses price changes without `--allow-price-change`); AI's price change needs product sign-off (D3). |
| Phase 3 | Coolify | Confirm `WALLET_*` env; add `POST /api/cron/course-live` scheduled task (already in code, not yet scheduled). |
| Phase 8 | Coolify / Mongo | Run `scripts/mastery-catalogue.mjs --apply` against prod once; verify Go reads `school`/`packages` benignly. |
| Phase 5 → 8 | Go (`worldstreet-academy/backend`) | `users.country` and `users.instructorProfile.{specialization, experience, credentials, featured}` are additive; if Go writes `instructorProfile` it writes dotted paths or carries them (Phase 5 ruling 22; Go doc R8). |
| Phase 6 → 8 | Go / mobile | Never write `enrollments.certificateId: ""` (partial unique index); Go completions don't stamp an ID until patched — the web stores one when the certificate is opened on the web, and a backfill re-run covers the rest; mobile certificates print `certificateId`, else `WSA-<last 8 of _id>` (Go doc R9). `reviews.featured` is additive; category vocabulary per R10. |
| Phase 7 → 8 | Go (`worldstreet-academy/backend`) / mobile | `meetings.mentorshipSessionId` (additive) marks a private session room with no `courseId`. Any meeting-join path refuses it unless the caller is that session's student, the host or an admin; honours the session status (`confirmed`, mentorship still held); refuses non-hosts until the host starts it; and never lists it as a course session while `scheduled` (Go doc R11). |
| Phase 7 → 8 | Go | `enrollments.mentorRoadmap: { text, updatedAt, updatedBy } \| null` is additive. Any wholesale enrollment write carries it (and Phase 6's `certificateId`); mobile renders it as plain text (Go doc R11). |
| Phase 7 → 8 | Go | Mentorship rule R-M: `enrollment.packageKey == "executive"` AND the course's `executive` package (by key, ignoring `enabled`) has `entitlements.mentorship` AND status `active\|completed`. Assignments follow R1's `entitlements.assignments` (Go doc R11). |
| Phase 7 → 8 | Go | `mentorshipsessions`, `assignments` and `submissions` are web-only; Go may ignore them. Never write them without the web rules: one `requested` session per enrollment; submission files only under `worldstreet-academy/submissions/<assignmentId>/<userId>/` in the private bucket (Go doc R11). |
| Phase 8 | Owner | Production order — Go, env, deploy, crons, catalogue, certificate backfill, §17 QA, rollback: `docs/launch-runbook.md`. |
| Never | all | Non-additive schema changes; new `role` values; changed Ably payload shapes. |

### 0.5 Parallel tracks

| Track A (critical path) | Track B (can start after Phase 0) | Track C (after Phase 3) |
|---|---|---|
| 0 → 1 → 2 → 3 → 8 | 5 Faculty · 6 Certification | 4 Dashboard · 7 Executive services |

---

## Phase 0 — Foundations: brand, schools taxonomy, package schema (2–3 d)

**Goal:** every later phase has a name to import and a field to write — nothing user-visible changes except the brand string.

**Depends on:** nothing. **Unblocks:** everything.

### Tasks

**0.1 Brand constants + shared lockup.**
- Create `lib/brand.ts`:
  ```ts
  export const BRAND = {
    name: "WorldStreet Mastery Academy",
    wordmark: "WorldStreet",          // lockup text
    eyebrow: "Mastery Academy",       // lockup eyebrow (rendered uppercase)
    tagline: "Learn Skills. Build Value. Own Your Future.",
    descriptor: "The world's premier institution for skills, innovation and wealth liquefaction.",
    supportEmail: "support@worldstreetgold.com",
    fromEmail: "WorldStreet Mastery Academy <noreply@worldstreet.academy>",
    certificatePrefix: "WSA",
  } as const
  ```
- Create `components/shared/brand-lockup.tsx` — one server component `BrandLockup({ eyebrow?: string; href?: string; size?: "sm" | "md" })` reproducing the ratified markup (gold `/brand/wsa-mark.png` 26px + "WorldStreet" Poppins SemiBold 15 + gold uppercase eyebrow, `text-[10px] uppercase tracking-[2px] text-ws-gold`). Default eyebrow `BRAND.eyebrow`; admin shell passes `"Admin"`.
- Replace the five inline copies: `components/marketing/navbar.tsx:34-48`, `components/marketing/footer.tsx:10-24`, `components/platform/app-sidebar.tsx:239-249`, `components/instructor/instructor-sidebar.tsx:213-223`, `components/admin/admin-sidebar.tsx:153-157`.
- Rename the 43 hits (list in the marketing audit; grep `-i "worldstreet academy"` excluding `node_modules .next *.md`): `app/layout.tsx:39-40` metadata default/template, `app/(marketing)/page.tsx:6`, `lib/email.tsx:22` (`FROM_EMAIL = BRAND.fromEmail`) + 8 footer strings, `components/learn/certificate-view.tsx:134,142,205,357`, `lib/ics.ts:36`, `lib/actions/applications.ts:595,656`, `lib/vivid/prompt.ts:87`, `components/welcome/onboarding-steps.ts:9`, `components/welcome/onboarding-modal.tsx:164`, `app/(platform)/dashboard/become-instructor/page.tsx:450`, the three sidebar aria-labels, `components/marketing/hero-wall.tsx:68,154`, `about-band.tsx:61`, `faq.tsx:45`. Comments in file headers may stay.
- Delete the dead hero `components/marketing/hero-slider.tsx` **only if** `rooms-timeline.tsx:10` vignette imports are moved into `components/marketing/vignettes.tsx` first (they are the only live imports).

**0.2 Schools taxonomy (static config).**
- Create `lib/schools.ts`:
  ```ts
  import type { LucideIcon } from "lucide-react"
  import { Landmark, Link2, Bot, Code2, ShieldCheck, BarChart3, Clapperboard, Briefcase } from "lucide-react"

  export type SchoolSlug =
    | "trading-financial-markets" | "blockchain-web3" | "ai-automation" | "software-app-development"
    | "cybersecurity" | "data-analytics" | "digital-media-creative" | "digital-business-remote-careers"

  export type School = {
    slug: SchoolSlug
    name: string        // "School of Trading & Financial Markets"
    short: string       // "Trading & Financial Markets" — also written to Course.category
    blurb: string       // §4 card copy, verbatim
    tagline: string | null  // §5 — only Trading has one today; null renders nothing
    intro: string | null    // §5 intro paragraph; null falls back to blurb
    icon: LucideIcon
    order: number
  }
  export const SCHOOLS: readonly School[]            // 8 entries, copy from spec §4/§5
  export const SCHOOL_BY_SLUG: Record<SchoolSlug, School>
  export const SCHOOL_SLUGS = SCHOOLS.map(s => s.slug) as [SchoolSlug, ...SchoolSlug[]]  // for z.enum
  ```
  Icons are `lucide-react` (no emoji — UI constraint). Program membership is **not** in the config; it comes from `Course.school` so it never drifts from the DB.
- `lib/db/models/course.ts`: add `school: { type: String, default: null, index: true }` (`SchoolSlug | null` on `ICourse`). Additive; Go ignores it.
- `lib/types/course.ts`: add `school: SchoolSlug | null` to the `Course` DTO; replace the `CourseCategory` union with `string` (category becomes a display label derived from the school). Update the one cast at `lib/actions/instructor.ts:164` and the `CATEGORIES` select in `components/instructor/course-editor.tsx:62-70,497` to a **School select** that also writes `category = school.short`.
- `lib/actions/courses.ts:21` and `lib/actions/admin-courses.ts` Zod: `school: z.enum(SCHOOL_SLUGS).nullable()`.

**0.3 Package (tier) schema — data only, no commerce yet.**
- `lib/db/models/course.ts`:
  ```ts
  export type PackageKey = "basic" | "standard" | "executive"
  export interface IPackageEntitlements {
    liveClasses: boolean; instructorQa: boolean; assignments: boolean
    certificate: boolean; mentorship: boolean; prioritySupport: boolean
  }
  export interface ICoursePackage {
    key: PackageKey
    name: string            // "Forex Foundation"
    tagline: string         // "Perfect for beginners"
    price: number           // whole USD — same unit as Course.price
    features: string[]      // bullets, verbatim from spec
    highlight: boolean      // renders "Most popular"
    ctaLabel: string | null // null → "Enrol for $X"; Executive uses "Apply / Enrol for $999"
    enabled: boolean
    entitlements: IPackageEntitlements
  }
  // ICourse: packages: ICoursePackage[]   (schema default [])
  ```
  Schema rule enforced in `lib/actions/courses.ts` + `admin-courses.ts` save paths: when `packages.length > 0`, `pricing = "paid"` and `price = min(enabled package price)` so mobile and every legacy "from $X" surface stay truthful. Keys unique per course; at most one `highlight`.
- `lib/db/models/lesson.ts`: add `minPackageKey: { type: String, enum: [null, "basic", "standard", "executive"], default: null }` (null = every tier).
- `lib/db/models/enrollment.ts`: add `packageKey: PackageKey | null` (default null) and `packageName: string | null` (snapshot at purchase).
- `lib/db/models/order.ts`: add `packageKey: PackageKey | null` (default null).
- Create `lib/entitlements.ts` (pure, no DB):
  ```ts
  export const PACKAGE_RANK: Record<PackageKey, 1 | 2 | 3> = { basic: 1, standard: 2, executive: 3 }
  export const FULL_ACCESS: IPackageEntitlements = { liveClasses: true, instructorQa: true, assignments: true, certificate: true, mentorship: true, prioritySupport: true }
  export function packageFor(course: Pick<ICourse, "packages">, key: PackageKey | null): ICoursePackage | null
  export function entitlementsFor(course: Pick<ICourse, "packages">, enrollment: Pick<IEnrollment, "packageKey"> | null): IPackageEntitlements
  // null packageKey (legacy/free/pre-enrolled) → FULL_ACCESS — grandfathered, matches today's behaviour
  export function canAccessLesson(lesson: Pick<ILesson, "minPackageKey">, enrollment: Pick<IEnrollment, "packageKey"> | null): boolean
  ```

**0.4 Catalogue script (dry-run only in this phase).**
- Create `scripts/mastery-catalogue.mjs` following `scripts/_swap-catalogue.mjs` (raw collection, `--apply` gate, prints a diff first). Upserts **by slug** the 12 programs from spec §4 with: `title`, `school`, `category = school.short`, `shortDescription` (§5 program blurbs), `description` (§6/§7/§8 intros where given; otherwise the §5 blurb), `whatYouWillLearn` (§6/§7/§8 lists; empty for programs the spec doesn't detail), `packages` (Forex + Crypto: the 3-tier ladder from §6/§7 with entitlements Basic `{certificate:false, liveClasses:false, instructorQa:false, assignments:false, mentorship:false, prioritySupport:false}`, Standard all true except `mentorship/prioritySupport`, Executive all true; AI: one `standard` package "Founding price" $199 with full entitlements; the other 9 per D3). D10 handling: rename slug `content-creation-video-editing-mastery` → title "Content Creation Mastery" (slug unchanged), insert `video-editing-mastery` and `e-commerce-digital-business` as `status: "draft"`. Never deletes. Runs against whatever `MONGODB_URI` is set — so it also seeds the mock DB for `pnpm dev:mock`.
- Do **not** `--apply` to production in this phase (Phase 8 does).

### Verification
- `npx tsc --noEmit`, `pnpm lint` clean.
- `pnpm dev:mock` → `/`, `/dashboard`, `/instructor`, `/admin` render with the new lockup and "WorldStreet Mastery Academy" in `<title>`.
- `node scripts/mastery-catalogue.mjs` (no `--apply`) against the mock DB prints 12 upserts and 0 errors; `--apply` then makes `/instructor/courses/<id>/edit` show the School select + saved packages round-trip.
- Emails: `lib/email.tsx` preview renders with the new FROM.

### Exit criteria (report these)
- [x] One `BrandLockup` component; zero inline lockups; zero "WorldStreet Academy" strings outside comments/docs.
- [x] `Course.school`, `Course.packages`, `Lesson.minPackageKey`, `Enrollment.packageKey/packageName`, `Order.packageKey` exist with defaults; existing rows unaffected.
- [x] `lib/schools.ts`, `lib/entitlements.ts`, `lib/brand.ts` exist and are the only sources of those facts.
- [x] Editor saves a school; the save action accepts `packages` and derives `price` from them (the packages UI itself is Phase 2.3).
- [x] `scripts/mastery-catalogue.mjs` dry-runs clean and seeds the mock DB.

---

## Phase 1 — Public site: homepage, schools index, school pages (3–4 d)

**Goal:** the blueprint's §1–§4, §11, §15, §16 are live, and the journey Homepage → Schools → School → Program works end to end (program page itself is Phase 2 — until then "View program" links to the existing `/courses/[id]`).

**Depends on:** Phase 0.

### Tasks

**1.1 Routes.**
- Create `app/(marketing)/schools/page.tsx` → `/schools` — "Explore the Schools of WorldStreet Mastery Academy" (§4 copy) + 8 school cards (`SchoolCard`) with program counts from `fetchSchoolProgramCounts()`.
- Create `app/(marketing)/schools/[slug]/page.tsx` → `/schools/[slug]` — `generateStaticParams` from `SCHOOL_SLUGS`, `notFound()` on unknown; hero (name, tagline, intro from config), "Available Programs" list (published courses where `school === slug`, via new `fetchSchoolPrograms(slug)` in `lib/actions/student.ts` returning `BrowseCourse[]`), each row = title, `shortDescription`, "from $X" (min package price), **[VIEW PROGRAM]**. Empty state when the school has no published program ("Programs coming soon" + pre-enrol drops if any).
- `generateMetadata` per school (`${school.name} · ${BRAND.name}`).

**1.2 Homepage rebuild (edit `components/marketing/landing.tsx` in place; new sections are new files).** Final order:
1. `HeroWall` — copy from §1: eyebrow `BRAND.name`, H1 "Learn Skills. Build Value. Own Your Future.", paragraph verbatim; primary "Explore programs" → `/schools`, secondary "Start learning" → `REGISTER_URL` (guest) / `/dashboard` (signed in). Keep the wall + student cut-out.
2. `WordsMarquee` — keep.
3. `AboutBand` → copy from §2 ("Welcome to…"). Keep layout.
4. **New** `components/marketing/why-band.tsx` — §3, six pillars (lucide: `GraduationCap, Hammer, Compass, Gauge, Users, TrendingUp`), full-width under one hairline (same grammar as AboutBand's pillars).
5. **New** `components/marketing/schools-grid.tsx` — §4, 8 cards, 2×4 → 1-col on phones, each card: icon in a 13% gold wash, name, blurb, program count, "Explore school" → `/schools/[slug]`. Server component reading `SCHOOLS` + counts.
6. **New** `components/marketing/how-it-works.tsx` — §11, four numbered steps (01 Choose your school → `/schools`, 02 Select your program, 03 Choose your package, 04 Enrol & start learning), "Your journey starts here." + [Explore programs]. Reuse the gold-beam scroll behaviour from `rooms-timeline.tsx` with 4 entries and the existing vignettes for steps 2–4 (school grid screenshot for step 1 can be a `BrowserFrame` of `SchoolsGrid` in compact mode). **Delete** `programs-list.tsx` and `rooms-timeline.tsx` after porting — they were flagged as near-duplicates.
7. `CatalogueGrid` — keep ("Featured programs"), cards link to `/programs/[slug]` once Phase 2 lands.
8. `UpcomingDrops` — keep.
9. `Testimonials` — keep (§14; country added in Phase 6).
10. `Faq` — replace the 6 inline questions with the 7 from §15 verbatim.
11. `FinaleCta` — §16 copy verbatim; [Explore programs] → `/schools`, [Enrol now] → `/schools` (guest) / `/dashboard/courses` (signed in).
- Faculty teaser (§10) slots between 7 and 8 in Phase 5.

**1.3 Navigation.**
- `components/marketing/navbar.tsx`: links "Schools" → `/schools`, "Programs" → `/courses` (→ `/programs` after Phase 2), "How it works" → `/#how-it-works`; keep "My Learning"/"Instructor Dashboard" conditionals and CTAs. Mirror in `mobile-nav.tsx` (`MarketingNavLink[]`).
- `components/marketing/footer.tsx`: Academy column → Schools, Programs, Faculty (Phase 5, hidden until then), FAQ (`/#faq`); Legal column links become real `/terms`, `/privacy` (pages in Phase 8; until then leave as spans — do not ship dead links).
- `app/(platform)` sidebar "Browse courses" label → "Programs" (href unchanged).

### Verification
- `pnpm dev:mock` with the catalogue script applied: `/` shows all 11 sections in order; `/schools` shows 8 cards with counts; `/schools/trading-financial-markets` lists Forex + Crypto; an unknown slug 404s.
- Phone width (400px): no horizontal scroll on any of the three pages.
- Lighthouse a11y on `/` ≥ 95 (headings in order, every card is one link).
- `pnpm lint`, `npx tsc --noEmit`.

### Exit criteria
- [x] `/`, `/schools`, `/schools/[slug]` live with blueprint copy; §17 journey works through "View program".
- [x] `programs-list.tsx` and `rooms-timeline.tsx` removed; one `HowItWorks`.
- [x] Navbar/footer/sidebar labels updated; no dead links.

---

## Phase 2 — Program page, packages editor, catalogue content (3–4 d)

**Goal:** §5–§9 — a program page at `/programs/[slug]` with "What you will learn", the package ladder, "What's included", instructor block, and a working **Enrol** CTA per package (guests included).

**Depends on:** Phase 0 (schema), Phase 1 (routes/nav). Checkout accepts the package in Phase 3; until then the CTA links to `/dashboard/checkout?courseId=<id>&package=<key>` and the checkout page ignores `package` (it still charges `course.price` — acceptable in mock only; **do not deploy Phase 2 to prod without Phase 3**).

### Tasks

**2.1 Route + data.**
- Create `app/(marketing)/programs/[slug]/page.tsx` (`revalidate = 0`) with `generateMetadata`. Data via new `fetchProgramBySlug(slug)` in `lib/actions/student.ts` → `ProgramDetail = BrowseCourse & { slug, school, whatYouWillLearn, requirements, targetAudience, packages: PublicPackage[], instructor: { id, name, avatarUrl, headline } }` where `PublicPackage` omits nothing sensitive (packages are public). Filter `enabled` packages; if `packages` is empty synthesize one `{ key: "standard", name: "Full program", price: course.price, features: whatYouWillLearn, highlight: false, entitlements: FULL_ACCESS }` so every program renders the same component.
- Create `app/(marketing)/programs/page.tsx` → `/programs` = the current `/courses` grid, grouped by school (8 headed groups, empty groups hidden). Add `next.config.ts` redirects: `/courses` → `/programs` (308) and `/courses/:id` → handled by a tiny server component at the old route that looks up the slug and `redirect()`s (keeps old links and the Vivid prompt working).
- `MarketingCourseCard`, `CatalogueGrid`, `UpcomingDrops`, platform `CourseCard` and `command-search.tsx`: link to `/programs/[slug]` for public, `/dashboard/courses/[id]` stays for enrolled.

**2.2 Page anatomy (`components/programs/*`, all server unless noted).**
1. `ProgramHero` — school breadcrumb → title → §6 subtitle line (`shortDescription`) → intro (`description`) → "from $X" + level + rating (only if `rating.count > 0`) + availability chip (reuse `AvailabilityCountdown` when coming soon).
2. `ProgramOutcomes` — "What you will learn" two-column checklist from `whatYouWillLearn` (reuse `components/courses/course-outcomes.tsx`).
3. `PackageLadder` — "Choose your learning experience": 1–3 cards side by side (stack on phones), each = key label (BASIC / STANDARD / EXECUTIVE 101), `$price` in Poppins Light tabular, name, tagline, features list, CTA. `highlight` card gets the "⭐ Most popular" → rendered as a gold `Star` lucide chip and a raised surface step (never a gold background). CTA = `PackageCta` (client): enrolled → "Continue learning"; pre-enrolled/coming-soon → existing `CourseSchedulingCta` semantics; else link to `/dashboard/checkout?courseId=<id>&package=<key>` with label `ctaLabel ?? "Enrol for $price"`. Guests hit the same link — `middleware.ts` already redirects to login with a return URL, so no separate sign-in branch.
4. `WhatsIncluded` — §9 list, static, with the footnote "Specific inclusions vary by program and package."
5. `AboutInstructor` — reuse `components/courses/about-instructor.tsx` (public variant: no Message button for guests; link to `/faculty/[username]` after Phase 5).
6. `ProgramFaq` — the 7 §15 questions (same `Faq` component, section id `faq`).
7. Sticky mobile bar: cheapest package price + "Choose package" scroll-to.

**2.3 Packages editor (instructor + admin share `components/instructor/course-editor.tsx`).**
- New "Packages" section (after Availability): list of up to 3 rows keyed basic/standard/executive with name, tagline, price, features (textarea → lines), highlight toggle, CTA label, enabled, and six entitlement switches. Client state mirrors `ICoursePackage`; Zod in `lib/actions/courses.ts` + `admin-courses.ts`:
  ```ts
  const packageSchema = z.object({
    key: z.enum(["basic", "standard", "executive"]),
    name: z.string().min(2).max(60), tagline: z.string().max(120),
    price: z.number().int().min(0).max(100000),
    features: z.array(z.string().min(1).max(160)).max(20),
    highlight: z.boolean(), ctaLabel: z.string().max(40).nullable(), enabled: z.boolean(),
    entitlements: z.object({ liveClasses: z.boolean(), instructorQa: z.boolean(), assignments: z.boolean(), certificate: z.boolean(), mentorship: z.boolean(), prioritySupport: z.boolean() }),
  })
  packages: z.array(packageSchema).max(3).refine(unique keys).refine(≤1 highlight)
  ```
- Lesson manager (`components/instructor/lesson-manager.tsx`): per-lesson "Minimum package" select (Everyone / Basic / Standard / Executive) → `Lesson.minPackageKey` via `lib/actions/lessons.ts` Zod.

**2.4 Content load.** Run `scripts/mastery-catalogue.mjs --apply` on the mock DB; for prod this waits for Phase 8. Anything the blueprint doesn't specify (7 school intros, 9 programs' curricula and packages) is **content debt owed by product** — list it in the phase report; the page renders correctly with empty lists (sections hide).

### Verification
- `pnpm dev:mock`: `/programs/forex-trading-mastery` shows hero, 14 outcomes, 3 packages with the §6 features, included list, FAQ; `/programs/ai-ai-automation` shows one package at $199; `/programs` groups by school; `/courses/<oldId>` redirects.
- Guest → click "Enrol for $49" → lands on `/login` (mock) with return to checkout; student persona → checkout page opens with `?package=basic` in the URL.
- Editor: add a package, save, reload — persists; `price` shows the min; lesson "Minimum package" persists.
- `pnpm lint`, `npx tsc --noEmit`.

### Exit criteria
- [x] `/programs`, `/programs/[slug]` live; old `/courses*` URLs redirect.
- [x] Package ladder renders 1–3 packages from data; every CTA resolves to checkout with `package=`.
- [x] Editors (instructor + admin) manage packages and lesson tiers with server-side validation.
- [x] Content-debt list handed to product.

---

## Phase 3 — Checkout, tier commerce, entitlement enforcement (3–4 d)

**Goal:** §17 from "ENROL NOW" to "Enrollment confirmed" — money moves for the chosen package, the enrollment records it, and the package's entitlements are enforced on the web (and listed for Go).

**Depends on:** Phase 0, 2.

**Carried over from Phase 2 (final review, 2026-09-14) — bake these into the 3.x tasks:**
- **Legacy path.** A course with no enabled packages renders one synthesized "Full program" tier whose CTA links `package=standard`. `purchaseCourse` must treat any `packageKey` on a course with no enabled packages as absent (charge `course.price`, no `package_required`), or that link dead-ends.
- **Lesson tiers are a subset of the sold ladder.** Since the Phase 2 fix wave every write path stores `minPackageKey` only when it is an enabled package on the course (else `null`). Enforcement should still treat a tier the course no longer sells as `null` (a later tier disable in the lesson manager is not re-normalised until the next editor save).
- **$0 tiers.** `pricingFromPackages` makes `Course.pricing` "free" when the cheapest enabled tier is $0, so a free Basic on a paid ladder flips the scalar the mobile app reads. Decide whether a $0 tier is allowed on a paid ladder and route it through the free-enrolment path.
- **Live reservations use the ladder.** On `/programs/[slug]` a pre-enrolled visitor on a live course now picks a package from the ladder (links carry `package=`); checkout must activate the reservation with that package.
- **Release caveat, strengthened.** Saving a course in the editor now rewrites `course.price` to the cheapest enabled tier, bypassing the catalogue script's `--allow-price-change` guard. Phase 2 must not reach production without Phase 3.

### Tasks

**3.1 `purchaseCourse` takes a package (`lib/actions/enrollments.ts`).**
- Signature → `purchaseCourse(input: { courseId: string; packageKey?: PackageKey })`, first Zod in this file:
  ```ts
  const purchaseInput = z.object({ courseId: z.string().regex(/^[a-f0-9]{24}$/), packageKey: z.enum(["basic", "standard", "executive"]).optional() })
  ```
- Resolution: `pkg = packageFor(course, packageKey ?? null)`. If the course has packages and `packageKey` is missing/disabled → `{ success: false, code: "package_required" }`. Price: `pkg ? pkg.price : (course.pricing === "paid" ? course.price : 0)` → `amountMinor = Math.round(price * 100)` (unchanged conversion point).
- Reference: `` `academy_enroll_${user.id}_${courseId}${pkg ? `_${pkg.key}` : ""}${generation ? `_r${generation}` : ""}` `` — legacy references unchanged, so re-runs stay idempotent.
- `Order.$setOnInsert.packageKey`, `Enrollment.packageKey/packageName` on create **and** on pre-enrolled activation; `description: \`${course.title} — ${pkg.name}\`` on the wallet charge; `metadata.packageKey`.
- `Earning` unchanged (amount-driven). `PurchaseResult` gains `packageName`.
- Update the two callers: `app/(platform)/dashboard/checkout/page.tsx:81` and `lib/vivid/actions/courses.ts:209` (Vivid: if the course has packages, return the checkout URL instead of purchasing — the assistant must not pick a tier for the user).
- `preEnrollCourse` unchanged (package chosen at payment).

**3.2 Checkout page (`app/(platform)/dashboard/checkout/page.tsx`).**
- Read `package` from the URL; render an order summary card: program title, school, package name + tagline, features (collapsed), price in Poppins Light tabular, wallet balance, shortfall flow unchanged (`openFunding`). Package switcher (segmented, never gold) so a user can change tier before paying. Missing/invalid `package` on a packaged course → summary shows the ladder instead of the pay button.
- Success (`checkout/success/page.tsx`): "Enrollment confirmed" heading, §12 welcome line "Your learning journey starts now.", package name, "Start learning →" to the first lesson (`resumeLessonId`), secondary "Go to dashboard".
- `sendEnrollmentConfirmationEmail` (`lib/email.tsx`) gains `packageName` and the §12 welcome line.

**3.3 Entitlement enforcement (web).** Every check uses `entitlementsFor(course, enrollment)` / `canAccessLesson`; null `packageKey` = full access (grandfathered).
- Lessons: `app/(platform)/dashboard/courses/[courseId]/learn/[lessonId]/page.tsx` — locked lessons render a `LockedLesson` card ("Included from Standard — upgrade" → `/programs/[slug]#packages`) instead of the player; the sidebar list shows a lock glyph. Server actions `completeLesson`, `updateLastAccessed`, `saveWatchProgress`, `getLessonWatchProgress` refuse locked lessons (`code: "package_locked"`). Progress % denominators count only accessible lessons (`completeLesson` recompute + `getEnrollmentProgress`).
- Exam: `lib/actions/exams.ts` start-attempt refuses when `!entitlements.certificate` (Basic has "no assessment & certificate" in §6) → `code: "package_locked"`; `course-exam-card.tsx` shows the upgrade prompt.
- Certificate: `lib/actions/certificates.ts` `fetchCertificate`/`fetchMyCertificates` skip enrollments whose package lacks `certificate`.
- Live classes: `createCourseMeeting` notify list and `joinMeeting` (course meetings) require `liveClasses`; `getMeetingInvites` filters the same.
- Instructor Q&A: `components/courses/about-instructor.tsx` Message buttons + `getOrCreateConversation` when the other party is the course instructor require `instructorQa` (student↔student and support paths unaffected).
- Executive intake (D4): on purchase of a package with `mentorship: true`, create a `Notification` for the instructor and admins ("New Executive enrollment — schedule onboarding") and show a one-time intake form on the success page (`goals`, `availability` text → stored on `Enrollment.mentorshipIntake: { goals, availability, submittedAt } | null`, additive).

**3.4 Admin.**
- `/admin/enrollments`: column + filter for package; "Change package" action (`lib/actions/admin-enrollments.ts`) writes `packageKey/packageName` with a `PaymentEvent` of type `package_changed` for audit (no money moves — D5).
- `/admin/payments` order rows show `packageKey`.

**3.5 Go patch list** — hand §0.4's Phase-3 rows to the backend owner; ship web + Go the same day, or ship web with `minPackageKey` unset on all lessons (services-only gating) until Go lands.

### Verification
- `pnpm dev:mock` (wallet disabled ⇒ purchase fails closed with the existing "wallet unavailable" message — confirm that path) then with a `WALLET_*` staging env: buy Forex Basic → Order has `packageKey: "basic"`, `amountMinor: 4900`; Enrollment `packageName: "Forex Foundation"`; a Standard-only lesson is locked; exam card shows upgrade; certificate list omits it. Buy Standard on Crypto → everything unlocked except mentorship.
- Repeat purchase is idempotent (same reference → same Order).
- Pre-enrol on a scheduled course → after `availableAt` passes → "Start course — pay" → checkout shows ladder → activation carries `packageKey`.
- Admin change package → PaymentEvent row appears.
- `pnpm lint`, `npx tsc --noEmit`.

### Exit criteria
- [x] `purchaseCourse({courseId, packageKey})` charges the package price; Order/Enrollment/email carry the package.
- [x] Checkout shows the package summary + switcher; success page confirms with §12 copy.
- [x] Lesson, exam, certificate, live-class, and Q&A gates enforced server-side on web; legacy enrollments unaffected.
- [x] Admin can view/change package; Go patch list delivered (or lesson tiers left unset).

---

## Phase 4 — Student dashboard per blueprint §12 (3–4 d)

**Goal:** after payment the student lands on a dashboard with the ten §12 tiles, each backed by real data or hidden truthfully.

**Depends on:** Phase 3 (packages/entitlements). Track C — can run in parallel with Phase 5/6.

### Tasks

**4.1 Dashboard home (`app/(platform)/dashboard/page.tsx`) — new layout.**
1. Welcome band: first visit after enrollment (`hasOnboarded` false or `?welcome=1` from success page) → "Welcome to WorldStreet Mastery Academy — Your learning journey starts now."; otherwise the existing greeting. **Continue learning →** hero CTA (resume lesson from `useEnrollments()`; falls back to "Browse programs").
2. **My programs** — existing "My courses" grid, renamed; card chip shows `packageName`.
3. **Current course** — the most recently accessed enrollment (`lastAccessedAt`) with lesson title + progress.
4. **My progress** — existing `ProgressPane`.
5. **Upcoming classes** — new `UpcomingClasses` (client, `useUpcomingClasses()` → new action `getUpcomingClasses()`; see 4.2). Empty state: "No classes scheduled — your instructor will post them here."
6. **Assignments** (D7 lite) — new `AssignmentsTile`: lesson knowledge-checks (`Exam.scope === "lesson"`) + final exams across enrolled courses with attempt state (not started / in progress / passed / failed) from `lib/actions/exams.ts` (add `getMyAssessments()` returning `{ courseId, courseTitle, examId, title, scope, status, lessonId }[]`). Hidden when the enrollment's package lacks `assignments` **and** there are no final exams.
7. **Certificates** — count + latest from `fetchMyCertificates()`; link `/dashboard/certificates`. Add `queryKeys.certificates`.
8. **Instructor / Mentor** — instructors of enrolled courses (avatar, name, headline, "Message" → existing `getOrCreateConversation`, gated by `instructorQa`); Executive enrollments show "Your mentor" with "Request a session" (Phase 7; until then it opens Messages).
9. **Community** — link tile to `process.env.NEXT_PUBLIC_COMMUNITY_URL`; hidden when unset (D6).
10. **Support** — tile → `/dashboard/help`; `prioritySupport` packages show a "Priority support" badge and the help page's mailto gets `?subject=[Priority]…`.
- Grid: 12-col; tiles are `bg-ws-surface` cards, 13px radius, separated by fill not borders; phone = one column; `pb-24 md:pb-8`.

**4.2 Scheduled classes (producer + consumer).**
- `lib/actions/meetings.ts` `createCourseMeeting(courseId, title, description, scheduledAt?: Date)`: when `scheduledAt` is in the future → `status: "scheduled"`, no `startedAt`; else current behaviour. Add `startScheduledMeeting(meetingId)` (scheduled → active; reuse the admin-interview start path if one exists — grep `startScheduled` first, otherwise mirror `startMeeting`). `getMyMeetings` returns `scheduledAt`.
- New `getUpcomingClasses()` — meetings with `status: "scheduled"`, `scheduledAt >= now`, `courseId ∈ my active enrollments`, filtered by `liveClasses` entitlement; sorted ascending; returns `{ id, title, courseTitle, scheduledAt, joinHref: "/dashboard/meetings?join=<id>" }[]`.
- Instructor UI `/instructor/meetings`: "Schedule a class" (date/time picker, course select) → the reminders cron (`app/api/cron/reminders`) already emails T-24h/T-1h from `scheduledAt`.
- `/dashboard/meetings`: new "Upcoming" list above invites.

**4.3 My programs page** (`my-courses/page.tsx`): tabs stay progress-based; add a status chip per card for `pre_enrolled` ("Not live yet"), `suspended`, `cancelled`, `refunded` (today only `pre_enrolled` is special-cased) and the package name.

**4.4 Sidebar/bottom nav**: no new routes; "Browse courses" → "Programs" (done in Phase 1); add "Help" to the mobile bottom nav overflow if space allows — otherwise leave.

### Verification
- `pnpm dev:mock` student persona: dashboard shows welcome band on `?welcome=1`; tiles present; community tile hidden without env, shown with it; instructor persona schedules a class 1 h ahead → student sees it under Upcoming classes and on `/dashboard/meetings`; Basic-package enrollment does not see it.
- Assignments tile lists the seeded lesson quiz/final exam with correct states.
- `pnpm lint`, `npx tsc --noEmit`.

### Exit criteria
- [x] All ten §12 tiles implemented or truthfully hidden; "Continue learning" CTA on the dashboard.
- [x] Instructors can schedule classes; students see upcoming classes (entitlement-gated); reminders fire.
- [x] Package name visible on my programs; status chips for every enrollment status.

---

## Phase 5 — Faculty: profiles, public pages, editor (2–3 d)

**Goal:** §10 — a public faculty directory and profiles with the seven blueprint fields, editable by instructors and admins.

**Depends on:** Phase 0. Track B — parallel with Phases 2–4.

### Tasks

**5.1 Profile fields (`lib/db/models/user.ts`, additive under `instructorProfile`)**: `specialization: string | null` (area of specialization — distinct from `headline`), `experience: string | null` (professional experience, ≤ 2000), `credentials: string[]` (≤ 10 × 120), `country: string | null` (ISO-3166 alpha-2), `featured: boolean` (admin-curated ordering), plus existing `headline`, `expertise[]`, `socialLinks`. On application approval (`lib/actions/applications.ts` approve path) copy `answers.experience` → `instructorProfile.experience` if empty.

**5.2 Edit UI.**
- `/instructor/profile` (`instructor-profile-client.tsx`): add headline, specialization, expertise (chips), experience, credentials (list), country (select from a static ISO list in `lib/countries.ts`), social links. `updateProfile` in `lib/actions/instructor.ts` gains these with Zod; `bio` gets a 1000-char cap.
- `/admin/users/[id]` detail: same form for admins (uses `requireAdmin()`); `featured` toggle.

**5.3 Public pages (marketing group).**
- `app/(marketing)/faculty/page.tsx` → `/faculty` — "Learn from experienced instructors" (§10 copy); grid of `FacultyCard` (photo, name, specialization, expertise chips, courses-taught count) for users with `role ∈ {INSTRUCTOR, ADMIN}` **and ≥ 1 published course** (via new `fetchFaculty()` in `lib/actions/student.ts`; featured first, then by `totalStudents`). Empty state hidden from nav until the list is non-empty (`fetchFacultyCount()` in navbar/footer).
- `app/(marketing)/faculty/[username]/page.tsx` — photo, name, specialization, short bio, professional experience, credentials, courses taught (published, → `/programs/[slug]`), social links. `generateMetadata`. `notFound()` if the user isn't faculty.
- Homepage `FacultyTeaser` (between Featured programs and Upcoming drops): up to 4 cards + [View faculty]; hidden when count is 0.
- `/dashboard/instructor/[instructorId]` stays for signed-in users; add a "Public profile" link.
- Program page `AboutInstructor` → links to `/faculty/[username]`.

### Verification
- `pnpm dev:mock` instructor persona edits all fields → `/faculty` shows the card (seeded instructor owns published courses) → profile page shows the seven fields; a user with no published course is absent; nav "Faculty" appears only when count > 0.
- `pnpm lint`, `npx tsc --noEmit`.

### Exit criteria
- [x] `/faculty`, `/faculty/[username]` live with the seven §10 fields.
- [x] Instructors and admins can edit every field; `experience` seeded from applications.
- [x] Homepage teaser + nav/footer link appear only when faculty exists.

---

## Phase 6 — Certification & trust: rebrand, IDs, verify page, testimonials (2 d)

**Goal:** §13 and §14 — certificates carry the new brand, program name, a stable ID, an authorized signature, and are publicly verifiable; testimonials show country.

**Depends on:** Phase 0. Track B.

### Tasks

**6.1 Stable certificate IDs.**
- `lib/db/models/enrollment.ts`: `certificateId: string | null` (default null, **sparse unique** index). Generated when an enrollment becomes `completed` (both paths: `completeLesson` completion branch and the exam-pass completion in `lib/actions/exams.ts`) as `` `${BRAND.certificatePrefix}-${8 chars from crypto.randomBytes base32}` `` via `lib/certificate-id.ts` (retry once on duplicate).
- `scripts/backfill-certificate-ids.mjs`: sets `certificateId` on existing completed enrollments using today's derived value (`WSA-<last 8 of _id uppercased>`) so already-issued PDFs stay valid. `--apply` gate.
- `CertificateData` gains `certificateId`, `programName` (= course title), `schoolName`; `certificate-view.tsx` prints "Certificate ID" from the field (replacing the derived string at `:236, :472, :582`), wordmark "WORLDSTREET MASTERY ACADEMY" (`:134, :142, :357`), and "for successfully completing the program".

**6.2 Authorized signature (D9).** `lib/brand.ts` gains `signatory: { name, title, imagePath: "/brand/signatory.png" }`; certificate renders instructor signature (left) + Academy signatory (right) in both the preview and the jsPDF export. Download stays blocked until the instructor has signed (existing rule).

**6.3 Public verification.** `app/(marketing)/verify/[certificateId]/page.tsx` → `/verify/WSA-XXXXXXXX`: looks up `Enrollment.certificateId` (status `completed`), shows student name, program, school, completion date, instructor, "Valid" chip; unknown → "No certificate with this ID". No auth. `generateMetadata` with `robots: noindex`. QR of this URL printed on the certificate (inline SVG QR via a small dependency-free encoder in `lib/qr.ts`, or skip QR if product prefers — no new dep without asking).

**6.4 Testimonials country (§14).** `User.country` (added in 5.1 for instructors — extend to all users: profile page gets the country select). `LandingReview` gains `country`; `reviews-finale.tsx` shows "Name · Country · Program". Admin `/admin/reviews` gains a "Feature on homepage" toggle (`Review.featured: boolean`, additive) so the six shown are curated; `fetchLandingReviews` prefers featured, then rating.

### Verification
- Complete a course in mock → `certificateId` set → `/dashboard/courses/[id]/certificate` prints it + both signatures → `/verify/<id>` validates; a random ID fails.
- Backfill dry-run lists existing completed enrollments; `--apply` on mock sets IDs.
- Homepage testimonials show country when set; admin featured toggle reorders.
- `pnpm lint`, `npx tsc --noEmit`.

### Exit criteria
- [x] Every completed enrollment has a unique `certificateId` (new completions on write; existing ones once the backfill runs in production — Phase 8 runbook); certificate shows the six §13 fields (authorized signature = instructor until product supplies the Academy signatory).
- [x] `/verify/[id]` public and correct.
- [x] Testimonials show country; homepage six are admin-curated, never fabricated.

---

## Phase 7 — Executive services: mentorship booking, roadmap, full assignments (5–7 d, optional)

**Goal:** the Executive package's promises (private 1-on-1 sessions, personalized roadmap, priority support) and full submission-based assignments become real features instead of copy.

**Depends on:** Phase 3, 4. Track C.

### Tasks

**7.1 Mentorship booking.**
- Model `lib/db/models/booking.ts`: `student`, `instructor`, `course`, `enrollment`, `status: requested|confirmed|completed|cancelled|no_show`, `proposedSlots: Date[]` (student proposes 3 — same pattern as `InstructorApplication.proposedSlots`), `scheduledAt`, `durationMin` (default 45), `meetingId` (RTK room), `notes`, `history[]`. Index `{ instructor, status }`, `{ student, status }`.
- Actions `lib/actions/bookings.ts`: `requestSession(courseId, slots)` (requires `mentorship` entitlement; max 1 open request per enrollment), `confirmSession(bookingId, slot)` (instructor → creates a scheduled `Meeting` with `requireApproval: true`, `scheduledAt`, `courseId`; reuse `adminScheduleInterview` mechanics), `cancelSession`, `completeSession`, `getMyBookings`, `getInstructorBookings`. Notifications + email on request/confirm/cancel; the reminders cron already covers `scheduledAt`.
- UI: student — "Request a session" on the Instructor/Mentor tile and program learn page; list under `/dashboard/meetings` "Mentorship". Instructor — `/instructor/meetings` "Mentorship requests" queue with confirm/propose.
- Quota: `ICoursePackage.entitlements.mentorship` stays boolean; add `mentorshipSessions: number | null` to the package (null = unlimited) and count `completed|confirmed` bookings against it.

**7.2 Personalized roadmap.** `Enrollment.mentorRoadmap: { markdown: string, updatedAt, updatedBy } | null` (additive). Instructor edits from the student's roster row (`getCourseStudents`); student sees it on the Instructor/Mentor tile and the course page. TipTap is already in the repo for prompts — reuse the same editor.

**7.3 Full assignments (D7 v2).** Models `Assignment { course, lesson|null, title, instructions, dueAt|null, minPackageKey, resourceKeys[] }` and `Submission { assignment, user, enrollment, text, fileKeys[] (private R2 resources bucket — never public), status: submitted|graded|returned, grade|null, feedback|null, gradedBy, gradedAt }` with unique `{ assignment, user }`. Instructor: create/grade under lessons; student: submit from the lesson page + Assignments tile shows due/graded. Gated by `entitlements.assignments`. Go/mobile: read-only visibility optional.

### Exit criteria
- [x] Executive students can request, get confirmed, and join a private session; instructors manage the queue; reminders fire. *(a real RealtimeKit confirm runs on staging)*
- [x] Roadmap editable/visible; priority-support badge live.
- [x] Assignments with file submissions and grading, gated by package. *(a real R2 upload/download runs on staging; production needs `R2_RESOURCES_BUCKET_NAME`)*

---

## Phase 8 — Launch: SEO, legal, production migration, Go patches, journey QA (2–3 d)

**Goal:** the §17 journey is verified on production data, discoverable, and legally complete.

**Depends on:** Phases 0–4 (5–6 recommended).

### Tasks
1. **Production content:** `node scripts/mastery-catalogue.mjs` (dry-run, review diff) → `--apply`; `scripts/backfill-certificate-ids.mjs --apply`; confirm existing enrollments still resolve (`/dashboard/my-courses` for a known user).
2. **Go patches** from §0.4 deployed and verified from the mobile app (locked lesson hidden, certificate refused for Basic).
3. **SEO:** `app/sitemap.ts` (schools, programs, faculty, verify excluded), `app/robots.ts`, `app/opengraph-image.tsx` (brand lockup on stone, Poppins) + per-program `opengraph-image` using the thumbnail; `generateMetadata` on every marketing route; canonical URLs via `lib/app-url.ts`.
4. **Legal:** `/terms`, `/privacy` pages (copy from product — blocker if absent); footer spans → links.
5. **Docs:** update `CLAUDE.md` (route handlers = 5; schools/packages/entitlements/brand modules; `/programs` URLs; catalogue script warning), `context.md` decision log entry, `../design-system/04-components` lockup eyebrow.
6. **Ops:** Coolify scheduled task for `/api/cron/course-live` (every 5 min, `CRON_SECRET`); confirm `WALLET_*`, `NEXT_PUBLIC_COMMUNITY_URL`, `SITE_URL`.
7. **Journey QA (§17), on production with a real wallet-funded test account:** Homepage → Schools → Trading → Forex → Standard → Enrol → (sign out first) login redirect returns to checkout → pay → "Enrollment confirmed" email + page → dashboard welcome → Continue learning → first lesson. Record the run as the report.
8. **Cleanup:** remove `link-tmp.cjs` / `link-mobile-identity.cjs` from the repo root (one-off scripts with real Clerk ids) or move them under `scripts/` with a warning header.

### Exit criteria
- [ ] Production catalogue = 12 programs with schools + packages; no orphaned enrollments. *(owner: `docs/launch-runbook.md` §6)*
- [ ] §17 journey passes end to end on production; run log attached. *(owner: runbook §8)*
- [ ] Sitemap/OG/metadata live; ~~`/terms` and `/privacy` real~~ legal links go to the hub's documents; docs updated; crons scheduled. *(code and docs done on `mastery/phase-8`; "live" and crons need the deploy — runbook §4–§5)*

---

## Risk register (top 6)

1. **Tier bypass via mobile** until the Go patch lands — Phase 3 ships web + Go together, or with lesson tiers unset (services-only gating) so nobody pays for content they can't see and nobody sees content they didn't pay for.
2. **Unique `{user, course}` enrollment index vs upgrades** — v1 has no upgrades (D5); a "pay the difference" v2 needs a new Order reference suffix, never a second enrollment row.
3. **Catalogue migration on live data** — the script is upsert-by-slug, never deletes, renames only the combined media course (D10); dry-run diff reviewed before `--apply`.
4. **Rebrand touches issued certificates** — existing PDFs are already downloaded; re-renders show the new name, same ID (backfilled). Acceptable; note in the Phase 6 report.
5. **Content debt** — the blueprint fully specifies 3 of 12 programs and 1 of 8 school intros. Phases 1–2 render truthfully with gaps; product owes the rest before Phase 8.
6. **Guest checkout through satellite Clerk** — the return URL must be an allowed production origin (localhost is rejected, as seen 2026-09-14); test on staging/prod, not locally.
