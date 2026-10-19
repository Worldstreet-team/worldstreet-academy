# Mastery Academy — Phase 12 Implementation Plan (Cohorts as data + Academic Calendar)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cohorts are the academic sessions (§20). An admin enters Cohort 002 at `/admin/cohorts`, and every countdown, banner, strip, offer timer, school page and learner card follows it with no redeploy. Learners and faculty see which cohort a learner is in, and the public sees an Academic Calendar.

**Architecture:**
- **Data.** A new web-only `Cohort` collection. Nothing is written to `Enrollment`: a learner's cohort is derived on read from the enrolment date (D20).
- **Rules.** Pure and client-safe: `lib/cohort-rules.ts` picks the next, current and enrolment cohort, and `lib/cohort.ts` keeps the Lagos zone and gains date formatters.
- **Loader.** The server-only `lib/cohort-calendar.ts` reads the collection once per request (`React.cache`), opts the route out of build-time rendering with `connection()`, and falls back to today's env constant while the collection is empty.
- **Components.** Client components stop importing the module constants and take the date as a prop.

**Tech Stack:** Next.js 16.1.6 App Router · React 19 · TypeScript strict · Mongoose 9 · Zod (`zod/v4`) · TanStack Query · Tailwind v4 with the WorldStreet design system (`ds/`, `ws-*` tokens).

**Spec:** `docs/institutional-blueprint.md` §6, §8, §18, §19, §20. **Roadmap:** `docs/institutional-blueprint-plan.md` Phase 12, decision D20 (and the 2026-10-05 owner rule: the offer timer counts down to the next cohort).

**Branch:** `mastery/phase-12`, cut from the tip of `mastery/phase-11`. Track A runs 11 → 12, because both edit `lib/cohort.ts` and `cohort-banner.tsx`. Task 1, step 1 stops the phase if Phase 11 hasn't landed.

## Controller rulings (binding)

1. **Phase 11's names are the starting point.** Phase 11 adds `COHORT_NUMBER` and `COHORT_NAME` to `lib/cohort.ts`, gives the band `id="cohort"` with "Explore Programs" / "Join Cohort", and adds `HeroWall`'s `cohortOpen` prop, computed in `landing.tsx` with `cohortIsUpcoming()`. This phase keeps every Phase 11 string. It moves the values to data and then deletes the module constants (Task 6).
2. **The enrolment date.** There is no `enrolledAt` field. For cohort placement, the enrolment date is `Enrollment.purchasedAt` (falling back to `createdAt`). The wallet charge and the ESPEE approval both set `purchasedAt`, and `getCourseStudents` already reports it as `enrolledAt`. **The one exception is ESPEE:** when an approved proof (`ManualPayment.enrollment` = the row, `status: "approved"`) was submitted earlier than `purchasedAt`, its `createdAt` counts instead. A learner who paid on 18 October and was approved on the 20th is in Cohort 001, not 002. This is a read only: the money path (`enrollments.ts`, `manual-payments.ts`) is untouched.
3. **Who has a cohort:** an enrollment in a school program (`courseKindOf(course) === "program"`) with status `active` or `completed`. Marketplace and New Economy courses, and pre-enrolled, refunded, suspended, cancelled or expired rows, have `cohortName: null`, and no chip shows.
4. **Never frozen into the build.** Most marketing pages declare `export const revalidate = 0`, but `/teach`, `/sell` and Phase 11's `/academy` don't, and the marketing layout renders the cohort bar on every one of them. `getCohortCalendar()` therefore starts with `await connection()` (from `next/server`), **as its first statement and outside any try/catch**. During a build, `connection()` throws a Next-internal signal that marks the route dynamic, and swallowing it would freeze the page. `/calendar` also declares `revalidate = 0`, as its neighbours do.
5. **The fallback equals today.** If the collection is empty or the read fails, the calendar holds one cohort built from `NEXT_PUBLIC_COHORT_STARTS_AT` (default `2026-10-19T00:00:00+01:00`; an unparseable value falls back to the default) and `NEXT_PUBLIC_COHORT_NUMBER` (a whole number ≥ 1, else `1`). Both are still build-time values.
6. **Cohort rules (admin):**
   - Numbers run 1–999 and are unique.
   - A higher number must start strictly later than every lower one.
   - The end is optional; when set, it must be after the start.
   - A cohort that has started keeps its number, and its start can't move into the future. A start in the past may be entered (Cohort 001).
   - An upcoming cohort may change its number, within the same rules.
   - There is no delete.
7. **Times are Lagos wall time.** The admin form uses `<input type="datetime-local">` and sends the raw `YYYY-MM-DDTHH:mm` string. The browser never converts it. The server reads it with the fixed offset `+01:00`, because Africa/Lagos has no daylight saving.
8. **Names come from numbers.** `cohortName(n)` gives `"Cohort 001"`. The model stores `name` for readability, but every view derives it from `number`.
9. **The offer timer is the next cohort's start** (owner rule, 2026-10-05). `OfferEnds` takes `endsAt`. The program page passes it through `PackageSelectionProvider`'s context, and the dashboard course page through `PackageLadder`.
10. **A learner's class band counts down to their own cohort**, and only while that cohort's start is in the future and no class is live or scheduled. Before this phase it used the global start.
11. **Roadmap corrections.**
    - The tutor-home importer of `lib/cohort.ts` is `lib/teaching-home.ts` (the pure `cohortStartLabel`), not `lib/actions/teaching-home.ts`. The action gains `nextCohort` and the per-card `cohortCounts`.
    - The roadmap's "admin enrollment sheet" is the `/admin/enrollments` table (the Enrolled cell) and its CSV (a last column, "Cohort").
    - The roadmap lists `lib/actions/class-board.ts` and `lib/vivid/prompt.ts` as callers. Both are covered: the prompt takes the calendar as a parameter, and `createVividSession` reads it.
12. **Status labels:** `upcoming` → "Upcoming", `running` → "In session", `past` → "Ended".
    - A cohort is **past** when its end has passed, or, with no end, once a later cohort has started.
    - It is **running** otherwise, once started.
13. **Learner count** = distinct users with an active or completed program enrollment placed in that cohort. The tutor home counts enrollments per course (one per user by the unique index).
14. **A cohort's `note` is admin-only.** It never prints on a public page.
15. **Copy.**
    - §8's heading "Upcoming cohorts", §19's "Academic Calendar" and §20's "cohorts are the academic sessions".
    - Dates in the site's en-GB style.
    - New strings use the new vocabulary: plan, never package; program for Academy offerings. Existing strings stay; the vocabulary pass runs last.
16. **School page "Upcoming cohorts".**
    - It lists the school's open programs (not coming soon) whose plans include live classes, naming those plans. A ladder-less legacy program names its one plan ("Full program").
    - It hides when there is no next cohort or no such program.
    - It sits after `SchoolFaculty` and before `SchoolReviews`, with a section-nav link "Cohorts".
17. **`/calendar` reuses `CohortBanner variant="band"`** for the next cohort, so the heading, countdown and CTAs match the landing.
18. **Go: none.** `cohorts` is a new collection Go never reads, and no enrollment field changes. One short note goes in `docs/go-patches-phase-3.md` so the Go team knows why.
19. **Pure modules use relative imports only** (`lib/cohort-rules.ts`, `lib/cohort.ts`), so the assert script runs from a scratch directory.

## Global Constraints

- **Data:**
  - Additive only. The Go mobile API reads the same MongoDB, so there are no renamed fields, no new enum values on existing fields and no new role values. `Cohort` is a new collection.
  - Nothing new is written to `Enrollment`, `Order`, `ManualPayment` or `Earning`.
- **Server actions** follow `connectDB()` → auth (`requireAdmin()` from `@/lib/auth/admin` for admin; `getCurrentUser()` from `@/lib/auth/actions` otherwise) → Zod (`import { z } from "zod/v4"`) → mutate → `revalidatePath()` → return `{ success: true, data } | { success: false, error }`.
  - They never throw across the boundary.
  - User ids come from `getCurrentUser()`, never the browser.
  - A `"use server"` file exports only async functions (and types).
- **Gates:** role gates live in each route group's `layout.tsx`, never middleware. `/admin/*` is already gated by `app/(admin)/layout.tsx`.
- **Money** is integer cents through `lib/wallet.ts`. This phase doesn't touch the money path.
- **Code:**
  - No new dependencies. No `any`. No secrets or env values in code.
  - `connectDB` is the default export of `@/lib/db`.
  - Models are imported from the `@/lib/db/models` barrel.
- **UI:**
  - The WorldStreet design system. `ds/` is vendored and never edited.
  - `ws-*` tokens only, never a hex.
  - Gold only for primary CTAs, active nav and brand moments.
  - Icons only from `@/components/icons` (duotone glyphs; never lucide, Hugeicons or emoji).
  - Base UI composition via `render`, never `asChild`.
  - Pills for buttons, 20 px cards (`rounded-[20px]`), Manrope.
  - `·` separators; `tabular-nums` for money and counts.
  - Pages under `(platform)` clear the bottom nav with `pb-24 md:pb-8` (admin and instructor pages keep their neighbours' padding).
- **RSC-first:** add `"use client"` only where interaction needs it.
- **Motion:** opacity and transform only; honour reduced motion; no hover scaling, no loops.
- **No test runner, and none is added.**
  - Pure rules: a throwaway `node:assert/strict` script in `$SCRATCH`, run with `npx tsx`.
  - Everything else: `npx tsc --noEmit` (one stale `.next/types` error is not real), `npx eslint <file>` for each changed file, and driving the route.
- **Never run a repo script without `MONGODB_URI=` in front.** The main checkout's `.env.local` points at production; the worktree has none, which is intended.
- **Anchors are quoted text,** never line numbers.
- **Test dates assume the run happens before 16 November 2026.** If it doesn't, move every test date forward by the same number of weeks.

## Review Focus

1. **The ESPEE approval lag.** A learner whose proof was submitted before a cohort's start, but approved after it, must show that cohort, not the next one. Covered in Task 1, step 2 (assert) and Task 5, step 6 (drive).
2. **The admin's browser isn't in Lagos.** "16 Nov 2026, 00:00" typed in New York must store `2026-11-15T23:00:00.000Z`. Covered in Task 1, step 2 (assert) and Task 2, step 9 (Playwright `timezoneId`).
3. **The next cohort starts while a page is open.**
   - The bar, band, strip and offer timer vanish at the instant, without a reload.
   - The next request shows the cohort after it, or nothing.

   Covered in Task 3, step 9 and Task 4, step 6.
4. **A prerenderable marketing page frozen at build** (`/teach`, `/sell`, `/academy`, `/calendar`). Covered in Task 2, step 3 (`connection()` placement) and Task 8, step 4 (the build's route table).
5. **Cohorts entered out of order:**
   - a duplicate number;
   - Cohort 003 before Cohort 002;
   - moving a started cohort's start into the future;
   - an end before the start.

   Each is refused with a sentence naming the conflict. Covered in Task 2, step 8.

## Verification server

Each track runs its own `dev:mock` in its worktree, on its own ports. The controller fills `<PORT>` and `<DBPORT>`.

```bash
netstat -ano | grep -E ":<PORT>|:<DBPORT>"      # must print nothing first
RESEND_API_KEY=re_disabled_local CLOUDFLARE_REALTIME_API_KEY=disabled-local OPENAI_API_KEY=disabled-local \
ABLY_API_KEY=disabled-local R2_SECRET_ACCESS_KEY=disabled-local WALLET_SERVICE_TOKEN=disabled-local \
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_bG9jYWwuZGV2JA MOCK_DB_PORT=<DBPORT> PORT=<PORT> node scripts/dev-mock.mjs
MONGODB_URI=mongodb://127.0.0.1:<DBPORT>/worldstreet-academy node scripts/mastery-catalogue.mjs --apply
```

- **Starting it.** Start the server in the background. Run the catalogue once, before the first `admin` request, so the seeded instructor (`instructor` persona) owns the 12 programs.
- **Keeping it.** Keep one server across tasks; restart it only where a step says so. `NEXT_PUBLIC_*` values are read when it starts. The worktree has no `.env.local`; that is intended.
- **Personas.** They switch with the `mock_persona` cookie: `guest`, `student`, `instructor`, `admin` (`mocks/clerk/personas.ts`). No new persona is needed.
- **Browser checks** use Playwright (installed globally, not in the project) with that cookie set for `localhost`.
- **Stopping it.** Stop the server when the phase is done. A killed `dev:mock` leaves `next` and `mongod` alive, so re-check the ports.

Helpers, set once per shell, from the worktree root:

```bash
WT=$(pwd -W 2>/dev/null || pwd)   # a native path (C:/…) on Git Bash, so node and tsx can read it
BASE=http://localhost:<PORT>
SCRATCH=$(mktemp -d)   # assert scripts and the DB helper live outside the repository
text() { curl -s ${2:+-b "mock_persona=$2"} "$BASE$1" | perl -0pe 's#<script\b.*?</script>##gs; s#<style\b.*?</style>##gs; s#<[^>]+># #g; s#&\#x27;#\x27#g; s#&quot;#"#g; s#&amp;#&#g; s#\s+# #g'; }
db() { MONGODB_URI=mongodb://127.0.0.1:<DBPORT>/worldstreet-academy NODE_PATH="$WT/node_modules" node "$SCRATCH/db.cjs" "$@"; }
```

`text` strips scripts, so the RSC payload never counts as rendered copy. Countdowns render only after mount, so a timer is checked in the browser, or by its ISO in the raw payload (`curl -s … | grep -c <iso>`).

Save this file as `$SCRATCH/db.cjs` with the Write tool (a heredoc breaks on the quotes). It writes straight to the mock DB, bypassing the admin rules on purpose, so checks can build any state:

```js
// Phase 12 mock-DB helper. Refuses any URI but the local mock mongod.
const mongoose = require("mongoose")
const uri = process.env.MONGODB_URI || ""
if (!/^mongodb:\/\/127\.0\.0\.1:\d+\//.test(uri)) throw new Error("mock mongod only")
const [cmd, ...a] = process.argv.slice(2)
const nameOf = (n) => `Cohort ${String(n).padStart(3, "0")}`
;(async () => {
  await mongoose.connect(uri)
  const db = mongoose.connection.db
  const now = new Date()
  const course = async (title) => {
    const c = await db.collection("courses").findOne({ title })
    if (!c) throw new Error(`no course "${title}"`)
    return c
  }
  if (cmd === "cohort") {                       // cohort <number> <startISO> [endISO]
    const [n, start, end] = a
    await db.collection("cohorts").updateOne(
      { number: Number(n) },
      { $set: { number: Number(n), name: nameOf(n), startsAt: new Date(start), endsAt: end ? new Date(end) : null, note: null, createdBy: null, updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true })
  } else if (cmd === "clear-cohorts") {
    await db.collection("cohorts").deleteMany({})
  } else if (cmd === "cohorts") {               // prints: number startISO endISO
    for (const c of await db.collection("cohorts").find().sort({ number: 1 }).toArray())
      console.log(c.number, c.startsAt.toISOString(), c.endsAt ? c.endsAt.toISOString() : "-")
  } else if (cmd === "id") {                    // id <course title>
    console.log(String((await course(a[0]))._id))
  } else if (cmd === "kind") {                  // kind <course title> <program|marketplace|new-economy>
    await db.collection("courses").updateOne({ title: a[0] }, { $set: { kind: a[1] } })
  } else if (cmd === "enrol") {                 // enrol <email> <course title> <purchasedISO> [espeeSubmittedISO]
    const [email, title, purchased, espee] = a
    const user = await db.collection("users").findOne({ email })
    if (!user) throw new Error(`no user ${email}`)
    const c = await course(title)
    const at = new Date(purchased)
    const pkg = (c.packages || []).find((p) => p.key === "standard" && p.enabled)
    await db.collection("enrollments").updateOne(
      { user: user._id, course: c._id },
      { $set: { status: "active", purchasedAt: at, activatedAt: at, pricePaid: pkg ? pkg.price : 0, currency: "USD", transactionId: null, preEnrolledAt: null, legacyUnpaid: false, packageKey: pkg ? "standard" : null, packageName: pkg ? pkg.name : null, mentorshipIntake: null, certificateId: null, progress: 0, completedLessons: [], lastAccessedLesson: null, lastAccessedAt: null, completedAt: null, examPassed: false, examPassedAt: null, bestScorePercent: null, mentorRoadmap: null, updatedAt: now }, $setOnInsert: { createdAt: at } },
      { upsert: true })
    const e = await db.collection("enrollments").findOne({ user: user._id, course: c._id })
    if (espee) await db.collection("manualpayments").insertOne({ user: user._id, authUserId: "mock", course: c._id, packageKey: e.packageKey, packageName: e.packageName, amountMinor: 100, currency: "USD", method: "espee", amountLabel: "$1", receiptKey: "mock", receiptContentType: "image/png", transferReference: "MOCK", note: "", status: "approved", reviewedBy: null, reviewedAt: at, rejectionReason: null, order: null, enrollment: e._id, history: [], createdAt: new Date(espee), updatedAt: at })
  } else throw new Error(`unknown command ${cmd}`)
  await mongoose.disconnect()
})().catch((err) => { console.error(err); process.exit(1) })
```

**State A**, used by most checks, is two cohorts: `db clear-cohorts; db cohort 1 2026-10-19T00:00:00+01:00; db cohort 2 2026-11-16T00:00:00+01:00`.

## File structure

| File | Responsibility |
|---|---|
| `lib/cohort-rules.ts` (new) | Pure, client-safe: `CohortView`, `CohortCalendar`, `cohortName`, `nextCohort`, `currentCohort`, `cohortForEnrolment`, `cohortStatus`, `calendarOf`, `fallbackCohort`, `enrolmentInstant` |
| `lib/cohort.ts` (modify) | Keeps `COHORT_TIME_ZONE`; + `COHORT_UTC_OFFSET` and the formatters `cohortDateLabel`, `cohortDateShort`, `cohortDateFull`, `lagosInstant`, `lagosLocal`; loses its env constants (Task 6) |
| `lib/db/models/cohort.ts` (new), `lib/db/models/index.ts` | The `Cohort` model and its barrel export |
| `lib/cohort-calendar.ts` (new) | Server-only: `getCohortCalendar()`, `cohortsForEnrollments()` |
| `lib/actions/admin-cohorts.ts` (new), `app/(admin)/admin/cohorts/page.tsx` (new) | Admin list, create and edit |
| `components/admin/admin-sidebar.tsx`, `components/admin/bottom-nav.tsx` | The "Cohorts" nav item |
| `components/shared/cohort-countdown.tsx`, `components/marketing/cohort-banner.tsx` | Take the cohort as props |
| `app/(marketing)/layout.tsx`, `components/marketing/landing.tsx`, `app/(marketing)/schools/page.tsx`, `app/(marketing)/schools/[slug]/page.tsx`, `app/(marketing)/programs/[slug]/page.tsx` | Pass `calendar.next` |
| `components/programs/package-offer.tsx`, `package-selection.tsx`, `package-chooser.tsx`, `program-sticky-bar.tsx`, `package-ladder.tsx`, `package-model.ts` (comment), `app/(platform)/dashboard/courses/[courseId]/page.tsx` | The offer timer follows the next cohort |
| `lib/actions/class-board.ts`, `components/dashboard/class-band.tsx`, `components/dashboard/home-strip.tsx`, `lib/actions/student.ts`, `components/platform/course-card.tsx`, `components/platform/enrollment-card.tsx`, `components/dashboard/learning-hero.tsx` | Learners see their cohort |
| `lib/actions/teaching-home.ts`, `lib/teaching-home.ts`, `components/instructor/home/{teaching-home,next-class-hero,cohort-grid}.tsx`, `lib/actions/admin-enrollments.ts`, `app/(admin)/admin/enrollments/page.tsx`, `lib/vivid/prompt.ts`, `lib/vivid/actions/index.ts` | Faculty, admin and Vivid see cohorts |
| `app/(marketing)/calendar/page.tsx` (new), `components/schools/school-cohorts.tsx` (new), `app/sitemap.ts`, `components/marketing/footer.tsx` | Academic Calendar; school "Upcoming cohorts" |
| `docs/go-patches-phase-3.md`, `docs/launch-runbook.md`, `docs/institutional-blueprint-plan.md`, `docs/mastery-academy-plan.md`, `context.md` | Notes, owner steps, status |

---

### Task 1: Cohort rules, formatters and the model

**Files:**
- Create: `lib/cohort-rules.ts`, `lib/db/models/cohort.ts`
- Modify: `lib/cohort.ts` (additions only; the old constants stay until Task 6), `lib/db/models/index.ts`
- Test: `$SCRATCH/cohort-rules.assert.mts` (throwaway, outside the repo)

**Interfaces:**
- Produces, in `lib/cohort-rules.ts` (no imports from `@/`):

```ts
export type CohortView = { number: number; name: string; startsAt: string; endsAt: string | null } // ISO instants
export type CohortCalendar = { next: CohortView | null; current: CohortView | null; all: CohortView[] } // all: start ascending
export type CohortStatus = "upcoming" | "running" | "past"
export const COHORT_STATUS_LABEL: Record<CohortStatus, string> // { upcoming: "Upcoming", running: "In session", past: "Ended" }
export const DEFAULT_COHORT_STARTS_AT = "2026-10-19T00:00:00+01:00"
export function cohortName(n: number): string                                   // "Cohort 001"
export function nextCohort(cohorts: readonly CohortView[], now: number): CohortView | null      // soonest start strictly after now
export function currentCohort(cohorts: readonly CohortView[], now: number): CohortView | null   // latest start at or before now
export function cohortForEnrolment(cohorts: readonly CohortView[], enrolledAt: Date): CohortView | null // first start ≥ enrolledAt, else the latest start
export function cohortStatus(cohort: CohortView, cohorts: readonly CohortView[], now: number): CohortStatus // ruling 12
export function calendarOf(cohorts: readonly CohortView[], now: number): CohortCalendar        // sorts, then next/current
export function fallbackCohort(startsAt: string | undefined, number: string | undefined): CohortView // ruling 5
export function enrolmentInstant(row: { purchasedAt?: Date | null; createdAt?: Date | null }, espeeSubmittedAt: Date | null): Date // ruling 2: (purchasedAt ?? createdAt ?? epoch), or the proof time when earlier
```

  Every function sorts a copy by `startsAt` (then `number`) and never assumes sorted input.
- Produces, in `lib/cohort.ts` (client-safe, no imports):
  - `COHORT_UTC_OFFSET = "+01:00"`.
  - `cohortDateLabel(iso: string): string`: "Monday 19 October".
  - `cohortDateShort(iso: string): string`: "19 Oct".
  - `cohortDateFull(iso: string): string`: "Monday 19 October 2026".
  - `lagosInstant(local: string): Date | null`: reads `YYYY-MM-DDTHH:mm` as Lagos wall time. Returns null for any other shape, and for an impossible date, which fails the round trip through `lagosLocal`.
  - `lagosLocal(iso: string): string`: the inverse.

  All `en-GB` with `timeZone: COHORT_TIME_ZONE`.
- Produces: `Cohort` model and `ICohort` (`lib/db/models/cohort.ts`), exported from the barrel.

- [ ] **Step 1: Check first.**
  - Phase 11 has landed: `grep -c "COHORT_NAME\|COHORT_NUMBER" lib/cohort.ts` prints ≥ 2, `grep -c 'id="cohort"' components/marketing/cohort-banner.tsx` prints 1, and `grep -c "cohortOpen" components/marketing/landing.tsx` prints 1. If any prints `0`, stop and report: Phase 12 needs Phase 11.
  - `ls lib/cohort-rules.ts lib/db/models/cohort.ts` fails with "No such file".
  - Record the lint baseline: `pnpm lint 2>&1 | tail -3`.

- [ ] **Step 2: Write `$SCRATCH/cohort-rules.assert.mts`.** It is an ES module, so the top-level `await` works. It loads both modules by file URL, so a Windows path never reads as a URL scheme. Its assertions:

```ts
import assert from "node:assert/strict"
import { pathToFileURL } from "node:url"
const load = (p: string) => import(pathToFileURL(`${process.env.WT}/${p}`).href)
const { cohortName, nextCohort, currentCohort, cohortForEnrolment, cohortStatus, calendarOf, fallbackCohort, enrolmentInstant, COHORT_STATUS_LABEL } = await load("lib/cohort-rules.ts")
const { lagosInstant, lagosLocal, cohortDateLabel, cohortDateShort, cohortDateFull } = await load("lib/cohort.ts")
const C1 = { number: 1, name: "Cohort 001", startsAt: "2026-10-18T23:00:00.000Z", endsAt: null }
const C2 = { number: 2, name: "Cohort 002", startsAt: "2026-11-15T23:00:00.000Z", endsAt: null }
const t1 = Date.parse(C1.startsAt)
assert.equal(cohortName(1), "Cohort 001"); assert.equal(cohortName(12), "Cohort 012"); assert.equal(cohortName(123), "Cohort 123")
assert.deepEqual(nextCohort([C1, C2], t1), C2)              // exact start instant is not "next"
assert.deepEqual(nextCohort([C2, C1], t1 - 1), C1)          // unsorted input
assert.deepEqual(currentCohort([C1, C2], t1), C1)           // at the instant it is current
assert.equal(currentCohort([C1, C2], t1 - 1), null)
assert.equal(nextCohort([], t1), null); assert.equal(currentCohort([], t1), null); assert.equal(cohortForEnrolment([], new Date()), null)
assert.deepEqual(cohortForEnrolment([C1, C2], new Date(t1)), C1)       // on the start → that cohort
assert.deepEqual(cohortForEnrolment([C1, C2], new Date(t1 + 1)), C2)   // just after → the next one
assert.deepEqual(cohortForEnrolment([C2, C1], new Date("2026-09-01T00:00:00Z")), C1)
assert.deepEqual(cohortForEnrolment([C1, C2], new Date("2026-12-01T00:00:00Z")), C2) // after the last → latest started
const oct20 = Date.parse("2026-10-20T00:00:00Z"), nov20 = Date.parse("2026-11-20T00:00:00Z")
assert.deepEqual(calendarOf([C2, C1], oct20), { next: C2, current: C1, all: [C1, C2] })
assert.equal(cohortStatus(C1, [C1, C2], oct20), "running"); assert.equal(cohortStatus(C2, [C1, C2], oct20), "upcoming")
assert.equal(cohortStatus(C1, [C1, C2], nov20), "past"); assert.equal(cohortStatus(C2, [C1, C2], nov20), "running")
assert.equal(cohortStatus({ ...C1, endsAt: "2026-10-25T00:00:00.000Z" }, [C1, C2], Date.parse("2026-10-26T00:00:00Z")), "past")
assert.equal(COHORT_STATUS_LABEL.running, "In session")
assert.deepEqual(fallbackCohort(undefined, undefined), C1)
assert.deepEqual(fallbackCohort("2026-11-16T00:00:00+01:00", "2"), C2)
assert.deepEqual(fallbackCohort("garbage", "0"), C1); assert.equal(fallbackCohort(undefined, "2.5").number, 1)
const d = (s: string) => new Date(s)
assert.deepEqual(enrolmentInstant({ purchasedAt: d("2026-10-20T09:00:00Z") }, d("2026-10-18T12:00:00Z")), d("2026-10-18T12:00:00Z"))
assert.deepEqual(enrolmentInstant({ purchasedAt: d("2026-10-20T09:00:00Z") }, d("2026-10-21T00:00:00Z")), d("2026-10-20T09:00:00Z"))
assert.deepEqual(enrolmentInstant({ purchasedAt: null, createdAt: d("2026-10-01T00:00:00Z") }, null), d("2026-10-01T00:00:00Z"))
// Review Focus 1: paid (proof) before the start, approved after it → still Cohort 001
assert.deepEqual(cohortForEnrolment([C1, C2], enrolmentInstant({ purchasedAt: d("2026-10-19T09:00:00Z") }, d("2026-10-18T12:00:00Z"))), C1)
// Review Focus 2: Lagos wall time, whatever the machine's zone
assert.equal(lagosInstant("2026-11-16T00:00")?.toISOString(), "2026-11-15T23:00:00.000Z")
assert.equal(lagosInstant("2026-11-16"), null); assert.equal(lagosInstant("2026-02-30T00:00"), null); assert.equal(lagosInstant(""), null)
assert.equal(lagosLocal("2026-11-15T23:00:00.000Z"), "2026-11-16T00:00")
assert.equal(cohortDateLabel(C1.startsAt), "Monday 19 October"); assert.equal(cohortDateShort(C1.startsAt), "19 Oct")
assert.equal(cohortDateFull(C1.startsAt), "Monday 19 October 2026")
console.log("ok")
```

- [ ] **Step 3: Run it, and watch it fail.**
  Run: `(cd "$SCRATCH" && WT="$WT" npx tsx cohort-rules.assert.mts)`
  Expected: FAIL, with "Cannot find module" for `cohort-rules.ts`.

- [ ] **Step 4: Add the formatters to `lib/cohort.ts`.** Add them below `COHORT_TIME_ZONE`, per the interface. Leave every existing export in place; Task 6 removes them. Extend the header comment: Phase 12 moves the date to data (`lib/cohort-calendar.ts`), and this module keeps the zone and the formatters.

- [ ] **Step 5: Create `lib/cohort-rules.ts`** per the interface. Its doc comment states D20's derivation and ruling 2, and says that nothing is stored on `Enrollment`.

- [ ] **Step 6: Create the model.** `lib/db/models/cohort.ts`, in the style of `enrollment-intent.ts`:
  - `ICohort`: `number: number` (required, min 1, max 999), `name: string` (required), `startsAt: Date` (required), `endsAt: Date | null` (default null), `note: string | null` (default null, maxlength 500), `createdBy: Types.ObjectId | null` (ref `User`, default null), and `timestamps: true`.
  - Indexes: `{ number: 1 }` unique, and `{ startsAt: 1 }`.
  - Its doc comment: web-only, invisible to Go; Phase 12, D20.
  - Add `export { Cohort, type ICohort } from "./cohort"` to `lib/db/models/index.ts`.

- [ ] **Step 7: Run the assert again.**
  Run: `(cd "$SCRATCH" && WT="$WT" npx tsx cohort-rules.assert.mts)`
  Expected: `ok`.

- [ ] **Step 8: Typecheck and lint.**
  Run: `npx tsc --noEmit`, then `npx eslint lib/cohort.ts`, `npx eslint lib/cohort-rules.ts`, `npx eslint lib/db/models/cohort.ts` and `npx eslint lib/db/models/index.ts`.
  Expected: clean, apart from the one stale `.next/types` error.

- [ ] **Step 9: Commit.**

```bash
git add lib/cohort.ts lib/cohort-rules.ts lib/db/models/cohort.ts lib/db/models/index.ts
git commit -m "feat(cohorts): the Cohort collection and its pure rules — next, current and an enrolment's cohort (D20)"
```

---

### Task 2: The loader and `/admin/cohorts`

**Files:**
- Create: `lib/cohort-calendar.ts`, `lib/actions/admin-cohorts.ts`, `app/(admin)/admin/cohorts/page.tsx`
- Modify: `components/admin/admin-sidebar.tsx`, `components/admin/bottom-nav.tsx`

**Interfaces:**
- Consumes: Task 1's `CohortView`, `CohortCalendar`, `calendarOf`, `fallbackCohort`, `cohortForEnrolment`, `enrolmentInstant`, `cohortName`, `cohortStatus`, `COHORT_STATUS_LABEL`, `lagosInstant`, `lagosLocal` and `cohortDateFull`; the `Cohort` model.
- Produces, in `lib/cohort-calendar.ts` (`import "server-only"`):
  - `getCohortCalendar: () => Promise<CohortCalendar>`, wrapped in `React.cache`.
  - `type EnrolmentRow = { _id: Types.ObjectId | string; purchasedAt?: Date | null; createdAt?: Date | null }`.
  - `cohortsForEnrollments(rows: EnrolmentRow[]): Promise<Map<string, CohortView | null>>`, keyed by `String(row._id)`. It does one `ManualPayment.find({ status: "approved", enrollment: { $in: ids } }).select("enrollment createdAt")` read, with the earliest proof per enrollment, then `cohortForEnrolment(calendar.all, enrolmentInstant(row, proof))`. Callers pass only the rows ruling 3 allows.
- Produces, in `lib/actions/admin-cohorts.ts` (`"use server"`):
  - `type AdminCohortRow = { id: string; number: number; name: string; startsAt: string; endsAt: string | null; note: string | null; status: CohortStatus; learners: number }`.
  - `adminListCohorts(): Promise<{ success: true; data: { cohorts: AdminCohortRow[]; fallback: CohortView | null } } | { success: false; error: string }>`. The rows run number-descending. `fallback` is set only while the collection is empty.
  - `type CohortFormInput = { number: number; startsAt: string; endsAt: string | null; note: string | null }`, where `startsAt` and `endsAt` are Lagos `YYYY-MM-DDTHH:mm`.
  - `adminCreateCohort(input: CohortFormInput): Promise<{ success: true; data: CohortView } | { success: false; error: string }>`.
  - `adminUpdateCohort(id: string, input: CohortFormInput)`: the same result type.

- [ ] **Step 1: Check first.** Start the verification server.
  Run: `curl -s -o /dev/null -w "%{http_code}\n" -b "mock_persona=admin" $BASE/admin/cohorts`
  Expected: `404`.

- [ ] **Step 2: The loader.** Create `lib/cohort-calendar.ts`. `getCohortCalendar` does these, in order:
  1. `await connection()`. This is the first statement, outside the try (ruling 4); say so in a comment.
  2. In a try: `await connectDB()`, then `Cohort.find().select("number startsAt endsAt").lean()`.
  3. Map each row to a `CohortView`, with the name from `cohortName(number)`.
  4. On any error, log `"[Cohorts] read failed:"` and use `[]`.
  5. An empty list becomes `[fallbackCohort(process.env.NEXT_PUBLIC_COHORT_STARTS_AT, process.env.NEXT_PUBLIC_COHORT_NUMBER)]`.
  6. Return `calendarOf(list, Date.now())`.

  `cohortsForEnrollments` returns an empty map for no rows, without reading.

- [ ] **Step 3: Self-check the placement (Review Focus 4).**
  Run: `grep -n "await connection()" lib/cohort-calendar.ts` and `grep -n "try {" lib/cohort-calendar.ts`
  Expected: the `connection()` line number is lower than the first `try {` inside `getCohortCalendar`.

- [ ] **Step 4: The actions.** Create `lib/actions/admin-cohorts.ts`, in the style of `lib/actions/admin-course-review.ts`.
  - **Schemas.** A Zod `CohortInput`:
    - `number`: `z.number().int().min(1).max(999)`.
    - `startsAt`: `z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)`.
    - `endsAt`: the same pattern, `.nullable()`.
    - `note`: `z.string().trim().max(500).nullable()`.

    And `CohortId = z.string().regex(/^[a-f0-9]{24}$/)`.
  - **Each write runs:** `connectDB()`, then `requireAdmin()`, then parse.
    - `lagosInstant` must not be null (error "Enter the start as a date and time").
    - Then the rules (ruling 6), against the other cohorts loaded once, **in this order**, so each case gets its own message: end after start; then, on update, the started-cohort rules; then the unique number; then the order between neighbours.
    - Then the write: `name: cohortName(number)`, and `createdBy: admin.id` on create.
    - Then `revalidatePath("/admin/cohorts")` and `revalidatePath("/", "layout")`.
    - A Mongo duplicate-key error (`code === 11000`) returns the duplicate message.
  - **Refusals, exact copy** (dates via `cohortDateFull`):
    - `` `${cohortName(n)} already exists.` ``
    - `` `${cohortName(n)} must start after ${prev.name} (${cohortDateFull(prev.startsAt)}).` ``
    - `` `${cohortName(n)} must start before ${next.name} (${cohortDateFull(next.startsAt)}).` ``
    - `"The end must be after the start."`
    - `"A cohort that has started keeps its number."`
    - `"A cohort that has started can't move its start into the future."`
    - `"Cohort not found"`
  - **`adminListCohorts`.** It reads the cohorts, then the learner counts (ruling 13):
    - `Course.distinct("_id", PROGRAM_KIND_FILTER)` (from `@/lib/course-kind`);
    - then `Enrollment.find({ course: { $in: ids }, status: { $in: ["active", "completed"] } }).select("_id user purchasedAt createdAt").lean()`;
    - then `cohortsForEnrollments`, counting distinct `user` per cohort number.

    `status` comes from `cohortStatus`.

- [ ] **Step 5: The page.** Create `app/(admin)/admin/cohorts/page.tsx`, a client page. Copy `app/(admin)/admin/exams/page.tsx`: `Topbar variant="admin"`, the same padding wrapper, `PageHeader`, `useQuery({ queryKey: ["admin", "cohorts"], queryFn: adminListCohorts })`, `Dialog` and `EmptyState`.
  - **Header.** `PageHeader` title "Cohorts", subline "The Academy's academic sessions. Every countdown, banner and offer timer follows the next one." Its `action` is a default `Button` "Add a cohort".
  - **Rows.** One `rounded-[20px]` hairline row per cohort:
    - the name, in `font-semibold`;
    - a status pill with `COHORT_STATUS_LABEL`, in `bg-ws-chip`;
    - "Starts {cohortDateFull} · {HH:mm from lagosLocal} Lagos time", and "Ends …" when set;
    - the note, muted;
    - on the right, the learner count, `tabular-nums`, "1 learner" / "N learners";
    - an outline `xs` "Edit" button.
  - **Empty collection.** An `EmptyState` (icon `CalendarDays`) titled "No cohorts yet", with the description `` `Until you add one, the site counts down to ${fallback.name}, starting ${cohortDateFull(fallback.startsAt)} (NEXT_PUBLIC_COHORT_STARTS_AT).` ``
  - **The dialog** ("Add a cohort" / `` `Edit ${name}` ``):
    - Number (`Input type="number"`, defaulting to the highest number + 1, else 1). It is disabled, with the hint "A started cohort keeps its number.", when editing a started cohort.
    - "Starts (Lagos time)" and "Ends (Lagos time, optional)", each `Input type="datetime-local"`. For an edit they are prefilled with `lagosLocal(iso)`.
    - "Note (admins only)", a `Textarea` with `maxLength={500}`.
    - Save sends the raw input strings (ruling 7), shows the action's `error` in `text-ws-danger`, and on success closes and invalidates `["admin", "cohorts"]`.

- [ ] **Step 6: Nav.**
  - `admin-sidebar.tsx`: in `manageItems`, after the item with `title: "Enrollments",`, add `{ title: "Cohorts", href: "/admin/cohorts", icon: CalendarDays, match: (p) => p.startsWith("/admin/cohorts") }`.
  - `bottom-nav.tsx`: add the same entry to `moreItems`, after "Courses". Update the comment `/** ESPEE payments, Courses, Sellers, Reviews and Exams share the fifth slot behind a "More" menu. */` to name Cohorts.
  - Import `CalendarDays` from `@/components/icons`.

- [ ] **Step 7: Verify the list.** As `admin` in the browser:
  - With `db clear-cohorts`, `/admin/cohorts` shows "No cohorts yet" naming "Cohort 001, starting Monday 19 October 2026".
  - Add Cohort 1 at `2026-10-19T00:00` and Cohort 2 at `2026-11-16T00:00`.
  - Run `db cohorts`. Expected: `1 2026-10-18T23:00:00.000Z -` and `2 2026-11-15T23:00:00.000Z -`.
  - The list shows Cohort 002 "Upcoming" first, then Cohort 001 "In session".
  - Then `db enrol student@worldstreet.academy "Forex Trading Mastery" 2026-10-10T10:00:00Z` and reload. Cohort 001 shows "1 learner".
  - The sidebar's "Cohorts" is active, and on a 390 px viewport it sits under "More".

- [ ] **Step 8: Verify the refusals (Review Focus 5).** In the dialog, each of these shows its exact message and changes nothing (`db cohorts` is unchanged):
  - Add number 2 → "Cohort 002 already exists."
  - Add number 3 at `2026-11-01T00:00` → "Cohort 003 must start after Cohort 002 (Monday 16 November 2026)."
  - Edit Cohort 001's start to `2026-12-01T00:00` → "A cohort that has started can't move its start into the future."
  - Add number 3 at `2026-12-14T00:00`, ending `2026-12-01T00:00` → "The end must be after the start."
  - Edit Cohort 002's number to 4 → saved, then edit it back to 2. An upcoming cohort may renumber.

- [ ] **Step 9: Verify the time zone (Review Focus 2).** In Playwright, use a context with `timezoneId: "America/New_York"` and the `admin` cookie. Add Cohort 3 at `2026-12-14T00:00`.
  Run: `db cohorts | grep "^3 "`
  Expected: `3 2026-12-13T23:00:00.000Z -`.
  Then remove it with `db clear-cohorts`, and restore State A.

- [ ] **Step 10: Lint, typecheck and commit.**

```bash
npx tsc --noEmit
for f in lib/cohort-calendar.ts lib/actions/admin-cohorts.ts "app/(admin)/admin/cohorts/page.tsx" components/admin/admin-sidebar.tsx components/admin/bottom-nav.tsx; do npx eslint "$f"; done
git add lib/cohort-calendar.ts lib/actions/admin-cohorts.ts "app/(admin)/admin/cohorts/page.tsx" components/admin/admin-sidebar.tsx components/admin/bottom-nav.tsx
git commit -m "feat(admin): /admin/cohorts — enter the Academy's cohorts in Lagos time; the calendar loader with today's env fallback"
```

---

### Task 3: Marketing surfaces follow the data

**Files:**
- Modify:
  - `components/shared/cohort-countdown.tsx`
  - `components/marketing/cohort-banner.tsx`
  - `app/(marketing)/layout.tsx`
  - `components/marketing/landing.tsx`
  - `app/(marketing)/schools/page.tsx`
  - `app/(marketing)/schools/[slug]/page.tsx`
  - `app/(marketing)/programs/[slug]/page.tsx`
  - `components/programs/package-offer.tsx`: a one-line bridge, removed in Task 4

**Interfaces:**
- Consumes: `getCohortCalendar` (Task 2); `cohortDateLabel` and `cohortDateShort` (Task 1).
- Produces:
  - `CohortCountdown({ startsAt, variant, prefix, endedLabel, className, blockClassName }: { startsAt: string; … })`: `startsAt` is required, and the other props are unchanged.
  - `WhileCohortUpcoming({ startsAt, children }: { startsAt: string; children: React.ReactNode })`.
  - `CohortBanner` props: today's variants, intersected with `{ cohort: CohortView | null }`. It renders nothing for `null`.

- [ ] **Step 1: Check first** (State A).
  Run: `text / | grep -c "Cohort 002"`
  Expected: `0`. The page still reads the env default, which is past.

- [ ] **Step 2: `cohort-countdown.tsx`.**
  - `CohortCountdown` passes `target={startsAt}`.
  - `WhileCohortUpcoming` computes from `startsAt`, with `[startsAt]` as the effect's dependencies, and sets `ended` back to `false` when `startsAt` changes.
  - Drop the `@/lib/cohort` import, and update the doc comments: the start now comes from the caller (`getCohortCalendar().next`).

- [ ] **Step 3: `cohort-banner.tsx`.**
  - Replace `if (!cohortIsUpcoming()) return null` with `if (!props.cohort) return null`.
  - Wrap the variant in `<WhileCohortUpcoming startsAt={props.cohort.startsAt}>`.
  - Pass `cohort` to `CohortBar`, `CohortBand` and `CohortStrip`.
  - In each, Phase 11's `COHORT_NAME` becomes `cohort.name`, `COHORT_DATE_LABEL` becomes `cohortDateLabel(cohort.startsAt)` and `COHORT_DATE_SHORT` becomes `cohortDateShort(cohort.startsAt)`. Every `<CohortCountdown` gets `startsAt={cohort.startsAt}`.
  - The copy is unchanged. Update the doc comment: "The cohort comes from `getCohortCalendar().next` (lib/cohort-calendar.ts)".

- [ ] **Step 4: Callers pass `calendar.next`.**
  - **Marketing layout.** `const calendar = await getCohortCalendar()`, read alongside the faculty count; `<CohortBanner variant="bar" />` becomes `<CohortBanner variant="bar" cohort={calendar.next} />`.
  - **`landing.tsx`.** Add `getCohortCalendar()` to the opening `Promise.all` (the one that destructures `const [user, courses, reviews, faculty, previews, marketplace, newEconomy]`). Phase 11's `cohortOpen={cohortIsUpcoming()}` becomes `cohortOpen={calendar.next !== null}`. Pass `cohort={calendar.next}` to `<CohortBanner variant="band" …>`, and drop the `@/lib/cohort` import.
  - **`schools/page.tsx` and `schools/[slug]/page.tsx`.** Read the calendar in the page's `Promise.all`. In each `cohort={…}` slot, `cohortIsUpcoming() ? (` becomes `calendar.next ? (`, and the strip gets `cohort={calendar.next}`. Drop the `@/lib/cohort` import.
  - **`programs/[slug]/page.tsx`.** Add `getCohortCalendar()` to the `Promise.all` that loads `enrollment, start, curriculum, reviewsPage, catalogue`, and pass `cohort={calendar.next}` to the strip.

- [ ] **Step 5: The bridge.** In `components/programs/package-offer.tsx` `OfferEnds`, pass `startsAt={COHORT_STARTS_AT_ISO}` (import it from `@/lib/cohort`) so the tree compiles. Task 4 replaces it.

- [ ] **Step 6: Verify State A, with no restart.**
  Run: `text / | grep -oE "Cohort 002 — Starts Monday 16 November|Join the upcoming cohort|Explore Programs|Join Cohort" | sort -u`
  Expected: all four.
  Then each of these must print at least `1`:
  - `text /teach | grep -c "Cohort 002 starts 16 Nov"` (the bar on a page without `revalidate`)
  - `text /schools | grep -c "Cohort 002"`
  - `text /schools/trading-financial-markets | grep -c "Cohort 002"`
  - `text /programs/forex-trading-mastery | grep -c "Cohort 002"`

- [ ] **Step 7: Verify the empty collection.**
  Run: `db clear-cohorts; text / | grep -c "Cohort 00"; text / | grep -c "Start learning"; curl -s $BASE/ | grep -c 'href="/#cohort"'`
  Expected: `0`, ≥ `1` and `0`. This is today's behaviour: the default start has passed.
  Then `db cohort 2 2026-11-16T00:00:00+01:00`, and `text / | grep -c "Cohort 002 — Starts"` prints `1` with no restart. This is exit criterion 1.

- [ ] **Step 8: Verify the env fallback.**
  - Restart the server with `NEXT_PUBLIC_COHORT_STARTS_AT=2026-11-16T00:00:00+01:00 NEXT_PUBLIC_COHORT_NUMBER=2` added, after `db clear-cohorts`. `text / | grep -c "Cohort 002 — Starts Monday 16 November"` prints `1`, which equals Phase 11's behaviour.
  - Restart without them, and restore State A.

- [ ] **Step 9: Verify the start passing with the page open (Review Focus 3).**
  1. Run `db clear-cohorts; db cohort 1 2026-10-19T00:00:00+01:00; db cohort 2 "$(date -u -d '+2 min' +%Y-%m-%dT%H:%M:%SZ)"; db cohort 3 2026-12-14T00:00:00+01:00`.
  2. Open `/` in the browser. The bar and band show Cohort 002 counting down.
  3. When it reaches zero, both vanish without a reload.
  4. Reload: the band reads "Cohort 003 — Starts Monday 14 December".
  5. Restore State A.

- [ ] **Step 10: Look at it.** At 1440, 390 and 320 px, `/`, `/schools` and `/programs/forex-trading-mastery` have no horizontal scroll, and the bar stays one line at 360 px.

- [ ] **Step 11: Lint, typecheck and commit.**

```bash
npx tsc --noEmit
for f in components/shared/cohort-countdown.tsx components/marketing/cohort-banner.tsx "app/(marketing)/layout.tsx" components/marketing/landing.tsx "app/(marketing)/schools/page.tsx" "app/(marketing)/schools/[slug]/page.tsx" "app/(marketing)/programs/[slug]/page.tsx" components/programs/package-offer.tsx; do npx eslint "$f"; done
git add components/shared/cohort-countdown.tsx components/marketing/cohort-banner.tsx "app/(marketing)/layout.tsx" components/marketing/landing.tsx "app/(marketing)/schools/page.tsx" "app/(marketing)/schools/[slug]/page.tsx" "app/(marketing)/programs/[slug]/page.tsx" components/programs/package-offer.tsx
git commit -m "feat(cohorts): the bar, band and strips count down to the next cohort in the database"
```

---

### Task 4: The offer timer counts down to the next cohort

**Files:**
- Modify:
  - `components/programs/package-offer.tsx`
  - `components/programs/package-selection.tsx`
  - `components/programs/package-chooser.tsx`
  - `components/programs/program-sticky-bar.tsx`
  - `components/programs/package-ladder.tsx`
  - `components/programs/package-model.ts` (the comment only)
  - `app/(marketing)/programs/[slug]/page.tsx`
  - `app/(platform)/dashboard/courses/[courseId]/page.tsx`

**Interfaces:**
- Consumes: `CohortCountdown` with `startsAt` (Task 3); `getCohortCalendar` (Task 2).
- Produces:
  - `OfferEnds({ pkg, endsAt, className }: { pkg: Priced; endsAt: string | null; className?: string })`. It renders nothing when `endsAt` is null or the package has no discount.
  - `PackageSelectionProvider` gains the prop `offerEndsAt: string | null`, and `Selection` gains `offerEndsAt: string | null`.
  - `PackageLadder` gains the prop `offerEndsAt: string | null`, passed down to `SinglePackage`.

- [ ] **Step 1: Check first** (State A).
  Run: `curl -s $BASE/programs/forex-trading-mastery | grep -o "2026-11-15T23:00:00.000Z" | wc -l`
  Expected: `1` or more (the strip's countdown).
  Note the number: after this task it grows (the offer timers).

- [ ] **Step 2: `package-offer.tsx`.** Change `OfferEnds` per the interface, removing the Task 3 bridge and its import. Update the file's doc comment: the countdown runs to the next cohort's start, passed in by the page.

- [ ] **Step 3: The program page's offer timers.**
  - **`package-selection.tsx`.** The provider takes `offerEndsAt`, puts it in the memoised value (add it to the deps), and `SelectedOffer` passes `endsAt={offerEndsAt}` from `usePackageSelection()`.
  - **`package-chooser.tsx`.** `OfferTerms` and `SingleOffer` read `offerEndsAt` from `usePackageSelection()` and pass it to their `OfferEnds`.
  - **`program-sticky-bar.tsx`.** It does the same.
  - **`programs/[slug]/page.tsx`.** `<PackageSelectionProvider` gets `offerEndsAt={calendar.next?.startsAt ?? null}`.

- [ ] **Step 4: The dashboard course page.**
  - `PackageLadder` and `SinglePackage` take `offerEndsAt` and pass it to both `OfferEnds`.
  - In `dashboard/courses/[courseId]/page.tsx`, read `getCohortCalendar()` and pass `offerEndsAt={calendar.next?.startsAt ?? null}` to `<PackageLadder`.
  - In `package-model.ts`, the comment "The discount holds until the live cohort starts (lib/cohort.ts)" now names `lib/cohort-calendar.ts`.

- [ ] **Step 5: Verify State A.**
  - `curl -s $BASE/programs/forex-trading-mastery | grep -o "2026-11-15T23:00:00.000Z" | wc -l` prints more than in step 1.
  - In the browser as `guest`: the chooser, the purchase card and the sticky bar each show "Offer ends in …".
  - As `student`: `/dashboard/courses/$(db id "Crypto Trading Mastery")` shows "Offer ends in …" under each plan. The student holds the Forex enrollment from Task 2, so the gate lets them through.

- [ ] **Step 6: Verify the empty collection (Review Focus 3).**
  - Run `db clear-cohorts`.
  - `curl -s $BASE/programs/forex-trading-mastery | grep -cE "2026-11-15T23:00:00.000Z|2026-10-18T23:00:00.000Z"` prints `0`. Neither the cleared cohort nor the past fallback reaches a timer.
  - `text /programs/forex-trading-mastery | grep -c "Save "` prints at least `1`: struck prices stay and only the timer goes.
  - No "Offer ends in" shows anywhere in the browser.
  - Restore State A.

- [ ] **Step 7: Lint, typecheck and commit.**

```bash
npx tsc --noEmit
for f in components/programs/package-offer.tsx components/programs/package-selection.tsx components/programs/package-chooser.tsx components/programs/program-sticky-bar.tsx components/programs/package-ladder.tsx components/programs/package-model.ts "app/(marketing)/programs/[slug]/page.tsx" "app/(platform)/dashboard/courses/[courseId]/page.tsx"; do npx eslint "$f"; done
git add components/programs "app/(marketing)/programs/[slug]/page.tsx" "app/(platform)/dashboard/courses/[courseId]/page.tsx"
git commit -m "feat(plans): Offer ends in counts down to the next cohort (owner, 2026-10-05)"
```

---

### Task 5: Learners see their cohort

**Files:**
- Modify:
  - `lib/actions/class-board.ts`
  - `components/dashboard/class-band.tsx`
  - `components/dashboard/home-strip.tsx`
  - `lib/actions/student.ts`
  - `components/platform/course-card.tsx`
  - `components/platform/enrollment-card.tsx`
  - `components/dashboard/learning-hero.tsx`

**Interfaces:**
- Consumes: `cohortsForEnrollments` (Task 2); `cohortDateLabel` (Task 1).
- Produces:
  - `ClassBoardEntry` gains `cohortName: string | null`, the learner's cohort for a program, started or not.
  - `cohortStartsAt` now means that cohort's start, set only while it is in the future and no class is live or scheduled (ruling 10).
  - `StudentEnrollment` gains `cohortName: string | null` (ruling 3).
  - `CourseCard` gains the prop `cohortName?: string | null`.

- [ ] **Step 1: Set up the learner and check first.** State A, then:

```bash
db enrol student@worldstreet.academy "Forex Trading Mastery" 2026-10-10T10:00:00Z                          # → Cohort 001
db enrol student@worldstreet.academy "Crypto Trading Mastery" 2026-10-20T09:00:00Z 2026-10-18T12:00:00Z     # ESPEE lag → Cohort 001
db enrol student@worldstreet.academy "Blockchain Technology Mastery" 2026-10-25T09:00:00Z                  # → Cohort 002
db kind "Bitcoin & Cryptocurrency Fundamentals" marketplace
db enrol student@worldstreet.academy "Bitcoin & Cryptocurrency Fundamentals" 2026-10-25T09:00:00Z          # no cohort
```

  As `student`, `/dashboard/my-courses` in the browser shows no "Cohort 00" text.

- [ ] **Step 2: `class-board.ts`.**
  - Select `course packageKey purchasedAt createdAt` on the enrollments.
  - Call `cohortsForEnrollments` once, over the entitled rows whose course is a program.
  - Each entry gets `cohortName: cohort?.name ?? null`.
  - Its `cohortStartsAt` is `!next && !live && cohort && Date.parse(cohort.startsAt) > Date.now() ? cohort.startsAt : null`.
  - Drop `const cohortAhead = cohortIsUpcoming()` and the `@/lib/cohort` import. Update the `cohortStartsAt` doc comment.

- [ ] **Step 3: `class-band.tsx` and `home-strip.tsx`.**
  - **The band's cohort branch.**
    - `<Eyebrow>Your cohort</Eyebrow>` becomes `<Eyebrow>{entry.cohortName ?? "Your cohort"}</Eyebrow>`.
    - `Live classes begin {COHORT_DATE_LABEL}` becomes `Live classes begin {cohortDateLabel(entry.cohortStartsAt)}`.
    - The `AddToCalendar` title becomes `` `${entry.courseTitle}: ${entry.cohortName ?? "live cohort"} begins` ``.
  - **`home-strip.tsx`.** `soonest`'s cohort variant carries `name: cohort.cohortName ?? "your cohort"`, and the label `"Until your cohort begins"` becomes `` `Until ${s.name} begins` ``.

- [ ] **Step 4: `fetchMyEnrollments`** (`lib/actions/student.ts`).
  - Add `kind` to the course populate select (`"slug title thumbnailUrl instructor totalLessons availableAt status packages examRequired school communityUrl"`).
  - After loading, call `cohortsForEnrollments` once, over the rows whose course `courseKindOf(...) === "program"` and whose status is `active` or `completed`.
  - Add `cohortName` to each returned object, after `communityUrl:`, and to the `StudentEnrollment` type, with a doc comment citing D20.

- [ ] **Step 5: Cards and hero.**
  - **`course-card.tsx`.** `{packageName && <PackageChip name={packageName} className="mt-2 self-start" />}` becomes one wrapping row, `mt-2 flex flex-wrap gap-1.5`, holding the package chip and, when set, `<PackageChip name={cohortName} />`.
  - **`enrollment-card.tsx`.** Pass `cohortName={enrollment.cohortName}`.
  - **`learning-hero.tsx` `HeroTitle`.** After `{e.explicitPackage && e.packageName && <PackageChip name={e.packageName} />}`, add `{e.cohortName && <PackageChip name={e.cohortName} />}`.

- [ ] **Step 6: Verify, as `student` in the browser (Review Focus 1).**
  - `/dashboard/my-courses`: Forex shows "Cohort 001", Crypto shows "Cohort 001" (the ESPEE proof predates the start), Blockchain shows "Cohort 002", and Bitcoin shows no cohort chip.
  - `/dashboard`: the hero shows its program's cohort chip.
  - Switch the hero to Blockchain Technology Mastery. Its band reads "Cohort 002", then "Live classes begin Monday 16 November", with the block countdown.
  - Forex's band shows no cohort countdown, because Cohort 001 has started.
  - The hero stats' next-class cell reads "Until Cohort 002 begins".
  - At 390 px the chips wrap without overflow.

- [ ] **Step 7: Lint, typecheck and commit.**

```bash
npx tsc --noEmit
for f in lib/actions/class-board.ts components/dashboard/class-band.tsx components/dashboard/home-strip.tsx lib/actions/student.ts components/platform/course-card.tsx components/platform/enrollment-card.tsx components/dashboard/learning-hero.tsx; do npx eslint "$f"; done
git add lib/actions/class-board.ts components/dashboard/class-band.tsx components/dashboard/home-strip.tsx lib/actions/student.ts components/platform/course-card.tsx components/platform/enrollment-card.tsx components/dashboard/learning-hero.tsx
git commit -m "feat(dashboard): learners see their cohort — My programs, the hero and the class band"
```

---

### Task 6: Faculty, admin enrollments and Vivid; retire the constants

**Files:**
- Modify:
  - `lib/actions/teaching-home.ts`
  - `lib/teaching-home.ts`
  - `components/instructor/home/teaching-home.tsx`
  - `components/instructor/home/next-class-hero.tsx`
  - `components/instructor/home/cohort-grid.tsx`
  - `lib/actions/admin-enrollments.ts`
  - `app/(admin)/admin/enrollments/page.tsx`
  - `lib/vivid/prompt.ts`
  - `lib/vivid/actions/index.ts`
  - `lib/cohort.ts`
- Test: `$SCRATCH/vivid-prompt.assert.mts` (throwaway)

**Interfaces:**
- Consumes: `getCohortCalendar` and `cohortsForEnrollments` (Task 2); `cohortDateLabel` (Task 1).
- Produces:
  - `TeachingHome` gains `nextCohort: CohortView | null`.
  - `CohortCard` gains `cohortCounts: { name: string; count: number }[]`: program courses only, ascending by number, zeros left out.
  - `cohortStartLabel(iso: string): string` ("Mon 19 Oct") in `lib/teaching-home.ts`.
  - `NextClassHero` and `CohortGrid` each gain the prop `nextCohort: CohortView | null`.
  - `AdminEnrollmentRow` gains `cohortName: string | null`.
  - `buildAcademyPrompt(user, pathname, cohorts: Pick<CohortCalendar, "next" | "current">): string`.
  - `lib/cohort.ts` keeps only `COHORT_TIME_ZONE`, `COHORT_UTC_OFFSET` and Task 1's formatters.

- [ ] **Step 1: Check first.**
  Run: `grep -rnE "COHORT_STARTS_AT_ISO|COHORT_DATE_LABEL|COHORT_DATE_SHORT|cohortIsUpcoming|COHORT_NUMBER|COHORT_NAME" app components lib`
  Expected: hits only in `lib/cohort.ts`, `lib/teaching-home.ts`, `components/instructor/home/next-class-hero.tsx`, `components/instructor/home/cohort-grid.tsx` and `lib/vivid/prompt.ts`.

- [ ] **Step 2: The tutor home.**
  - **`getTeachingHome`.**
    - Read `getCohortCalendar()` once.
    - Read `Enrollment.find({ course: { $in: <ids of taught courses whose courseKindOf is "program"> }, status: { $in: ["active", "completed"] } }).select("_id course purchasedAt createdAt").lean()`, then `cohortsForEnrollments`.
    - Tally by course and cohort into `cohortCounts`.
    - Return `nextCohort: calendar.next`. Add both to the types, with doc comments.
  - **`lib/teaching-home.ts`.** `cohortStartLabel()` becomes `cohortStartLabel(iso: string)`, and its import becomes `COHORT_TIME_ZONE` only.
  - **`next-class-hero.tsx`.**
    - `EmptyHero`'s `showCohort` becomes `teachesProgram && nextCohort !== null && Date.parse(nextCohort.startsAt) > now`.
    - `Cohort begins {cohortStartLabel()}` becomes `{nextCohort.name} begins {cohortStartLabel(nextCohort.startsAt)}`.
    - The `Countdown` target is `nextCohort.startsAt`.
    - Thread `nextCohort` through `NextClassHero`'s props.
  - **`cohort-grid.tsx`.**
    - `` `None · cohort ${cohortStartLabel()}` `` becomes `` `None · ${nextCohort.name} ${cohortStartLabel(nextCohort.startsAt)}` ``, when the next cohort is ahead of `now`. Otherwise it reads `"None scheduled"`, as today.
    - After `<Row label="Students">`, add `<Row label="By cohort">` when `card.cohortCounts.length > 0`. It lists each entry as `` `${name} · ${count}` `` in `tabular-nums`, wrapping.
  - **`teaching-home.tsx` (component).** Pass `nextCohort={home.nextCohort}` to `<NextClassHero` and `<CohortGrid`.

- [ ] **Step 3: Admin enrollments.**
  - In `adminListEnrollments`, add `kind` to `.populate("course", "title pricing status availableAt packages")`.
  - Call `cohortsForEnrollments` once, over the page's rows that ruling 3 allows.
  - Set `cohortName` after `progress: e.progress ?? 0,`.
  - In the page, under `{formatDate(e.enrolledAt)}`, add `{e.cohortName && <p className="text-[10px]">{e.cohortName}</p>}`.
  - In `adminExportEnrollments`, append `"Cohort"` after `"Progress %",` in the header, and `r.cohortName` after `r.progress,` in each row.

- [ ] **Step 4: Vivid.**
  - **`prompt.ts`.** It takes the third parameter. The line beginning `` - ${cohortIsUpcoming() ? `` becomes:
    - with `next`: `` `- ${next.name} starts ${cohortDateLabel(next.startsAt)}; pay-now prices hold until then.` ``
    - else with `current`: `` `- ${current.name} began ${cohortDateLabel(current.startsAt)}.` ``
    - else: `- `.

    Each is followed by the unchanged " Classes are live, and recordings stay in the dashboard (watch only, no download)."
  - **`lib/vivid/actions/index.ts`.** `createVividSession` reads `await getCohortCalendar()` and passes `{ next, current }`.

- [ ] **Step 5: The Vivid assert.** Write `$SCRATCH/vivid-prompt.assert.mts`, loading the module the way Task 1's script does:

```ts
import assert from "node:assert/strict"
import { pathToFileURL } from "node:url"
const { buildAcademyPrompt } = await import(pathToFileURL(`${process.env.WT}/lib/vivid/prompt.ts`).href)
const C1 = { number: 1, name: "Cohort 001", startsAt: "2026-10-18T23:00:00.000Z", endsAt: null }
const C2 = { number: 2, name: "Cohort 002", startsAt: "2026-11-15T23:00:00.000Z", endsAt: null }
assert.ok(buildAcademyPrompt(null, "/", { next: C2, current: C1 }).includes("Cohort 002 starts Monday 16 November; pay-now prices hold until then."))
assert.ok(buildAcademyPrompt(null, "/", { next: null, current: C1 }).includes("Cohort 001 began Monday 19 October."))
console.log("ok")
```

  Run: `(cd "$SCRATCH" && WT="$WT" npx tsx --tsconfig "$WT/tsconfig.json" vivid-prompt.assert.mts)`
  Expected: `ok`. The `--tsconfig` flag resolves the prompt's `@/` imports.

- [ ] **Step 6: Retire the constants.**
  - In `lib/cohort.ts`, delete `DEFAULT_STARTS_AT`, `parseStart`, `STARTS_AT`, `COHORT_STARTS_AT_ISO`, `COHORT_DATE_LABEL`, `COHORT_DATE_SHORT`, `cohortIsUpcoming`, and Phase 11's `COHORT_NUMBER` / `COHORT_NAME`.
  - Rewrite the header comment: the zone and the formatters live here; the cohort itself is data (`lib/cohort-calendar.ts`, D20); and the two env variables are only the empty-collection fallback.
  - Run the step 1 grep again. Expected: no output.

- [ ] **Step 7: Verify** (State A, plus Task 5's enrollments).
  - **As `instructor`, `/instructor`:**
    - Forex Trading Mastery's card shows "By cohort Cohort 001 · 1".
    - Crypto's shows "Cohort 001 · 1".
    - Blockchain Technology Mastery's shows "Cohort 002 · 1".
    - The empty hero (no class scheduled) reads "Cohort 002 begins Mon 16 Nov", with "in …" counting.
    - A program card with no class reads "None · Cohort 002 Mon 16 Nov".
  - **As `admin`, `/admin/enrollments`:** the student's Forex and Crypto rows show "Cohort 001", Blockchain shows "Cohort 002", and Bitcoin shows nothing. "Export CSV" ends each row with the cohort name, and the header with `"Cohort"`.
  - **With an empty collection** (`db clear-cohorts`): the tutor hero shows no cohort line, and the student's chips all read "Cohort 001" (the fallback). Restore State A.

- [ ] **Step 8: Lint, typecheck and commit.**

```bash
npx tsc --noEmit
for f in lib/actions/teaching-home.ts lib/teaching-home.ts components/instructor/home/teaching-home.tsx components/instructor/home/next-class-hero.tsx components/instructor/home/cohort-grid.tsx lib/actions/admin-enrollments.ts "app/(admin)/admin/enrollments/page.tsx" lib/vivid/prompt.ts lib/vivid/actions/index.ts lib/cohort.ts; do npx eslint "$f"; done
git add lib/actions/teaching-home.ts lib/teaching-home.ts components/instructor/home "app/(admin)/admin/enrollments/page.tsx" lib/actions/admin-enrollments.ts lib/vivid/prompt.ts lib/vivid/actions/index.ts lib/cohort.ts
git commit -m "feat(cohorts): faculty and admins see each learner's cohort; Vivid reads the calendar; the env constants retire"
```

---

### Task 7: The Academic Calendar and the school's Upcoming cohorts

**Files:**
- Create: `app/(marketing)/calendar/page.tsx`, `components/schools/school-cohorts.tsx`
- Modify: `app/(marketing)/schools/[slug]/page.tsx`, `app/sitemap.ts`, `components/marketing/footer.tsx`

**Interfaces:**
- Consumes:
  - from Task 2: `getCohortCalendar`;
  - from Task 1: `cohortStatus`, `COHORT_STATUS_LABEL`, `cohortDateLabel` and `cohortDateFull`;
  - from Task 3: `CohortBanner`, `CohortCountdown` and `WhileCohortUpcoming`;
  - `SchoolProgram` (`components/schools/model.ts`), `PACKAGE_LABEL`, and `SCHOOL_SECTION` / `SectionHead` (`components/schools/section-head.tsx`).
- Produces:
  - `type SchoolCohortRow = { slug: string; title: string; plans: string[] }`.
  - `schoolCohortRows(programs: SchoolProgram[]): SchoolCohortRow[]`: open programs only (`!comingSoon`). `plans` holds the labels of `program.packages` with `entitlements.liveClasses`: `PACKAGE_LABEL[key]` when `program.tierCount > 0`, else the package's `name`. Programs without one are left out.
  - `SchoolCohorts({ cohort, rows }: { cohort: CohortView | null; rows: SchoolCohortRow[] })`: a server component.

  Phase 13 reorders the school page around it.

- [ ] **Step 1: Check first.**
  Run: `curl -s -o /dev/null -w "%{http_code}\n" $BASE/calendar; text /schools/trading-financial-markets | grep -c "Upcoming cohorts"`
  Expected: `404` and `0`.

- [ ] **Step 2: `school-cohorts.tsx`.** It renders nothing when `cohort` is null or `rows` is empty.
  - The wrapper is `<section id="cohorts" aria-labelledby="cohorts-heading" className={SCHOOL_SECTION}>`, wrapped in `<WhileCohortUpcoming startsAt={cohort.startsAt}>`.
  - The head is `SectionHead` with the title "Upcoming cohorts" (§8) and the lede `` `${cohort.name} starts ${cohortDateLabel(cohort.startsAt)}.` ``. Its `aside` is `<CohortCountdown startsAt={cohort.startsAt} variant="compact" prefix="Starts in " />`.
  - Under it sits one 20 px card, with the eyebrow "Plans with live classes".
  - Each row links its title to `` `/programs/${slug}#packages` `` and lists its `plans` joined with " · ".

- [ ] **Step 3: The school page.**
  - Compute `const cohortRows = schoolCohortRows(programs)`.
  - Mount `<SchoolCohorts cohort={calendar.next} rows={cohortRows} />` right after `<SchoolFaculty members={facultyMembers} />`.
  - In `links`, after `facultyMembers.length > 0 ? { id: "faculty", label: "Faculty" } : null,`, add `calendar.next && cohortRows.length > 0 ? { id: "cohorts", label: "Cohorts" } : null,`.
  - Add the section to the page's doc comment.

- [ ] **Step 4: `app/(marketing)/calendar/page.tsx`.**
  - **Config.** A server page with `export const revalidate = 0` and its own comment: "cohorts change in admin; read them per request".
  - **Metadata.** Title "Academic Calendar"; description `` `Cohorts are the academic sessions of ${BRAND.name}. Every cohort, with its dates.` ``; `alternates: { canonical: appUrl("/calendar") }`.
  - **Header.** It follows the marketing page rhythm (`mx-auto max-w-7xl px-6`):
    - `SectionLabel` "Academic Calendar";
    - an `h1` "Academic Calendar";
    - the lede "Cohorts are the academic sessions of the Academy." (§20).
  - **The next cohort.** `<CohortBanner variant="band" cohort={calendar.next} />`. Without one, show a muted 20 px card: "The next cohort's start date will be published here."
  - **"All cohorts"** (`h2`). One 20 px card holds an `<ol>` of `calendar.all`, newest start first. Each `<li>` shows:
    - the name;
    - a `bg-ws-chip` pill with `COHORT_STATUS_LABEL[cohortStatus(c, calendar.all, Date.now())]`;
    - `` `Starts ${cohortDateFull(c.startsAt)}` ``, and `` ` · Ends ${cohortDateFull(c.endsAt)}` `` when set.

    Notes never print (ruling 14).
  - The page has no other data fetch.

- [ ] **Step 5: Sitemap and footer.**
  - `app/sitemap.ts`: insert `{ url: appUrl("/calendar") },` immediately before `{ url: appUrl("/sell") },`, and add `/calendar` to its doc comment.
  - `footer.tsx`: in the Academy column, right after the `<li>` holding "Programs", add `<li>` → `<Link href="/calendar" …>Academic Calendar</Link>`, with the column's existing link classes.

- [ ] **Step 6: Verify State A.**
  - `curl -s -o /dev/null -w "%{http_code}\n" $BASE/calendar` prints `200`.
  - `text /calendar | grep -oE "Academic Calendar|Cohort 002 — Starts Monday 16 November|Starts Monday 19 October 2026|Starts Monday 16 November 2026|In session|Upcoming" | sort -u` prints all six.
  - `curl -s $BASE/calendar | grep -o '<link rel="canonical"[^>]*>'` ends in `/calendar`, and `curl -s $BASE/sitemap.xml | grep -c "/calendar<"` prints `1`.
  - `text / | grep -c "Academic Calendar"` prints at least `1` (the footer).
  - `text /schools/trading-financial-markets | grep -oE "Upcoming cohorts|Cohort 002 starts Monday 16 November|Standard · Executive 101" | sort -u` prints all three, and `curl -s $BASE/schools/trading-financial-markets | grep -c 'href="#cohorts"'` prints `1`.

- [ ] **Step 7: Verify the empty collection.**
  - Run `db clear-cohorts`.
  - `text /schools/trading-financial-markets | grep -c "Upcoming cohorts"` prints `0`.
  - `text /calendar | grep -oE "Cohort 001|In session|will be published here" | sort -u` prints all three: the fallback cohort is in session, and no next cohort is published.
  - Restore State A.

- [ ] **Step 8: Look at it.** In dark and light, at 1440, 390 and 320 px, `/calendar` and the school page have no horizontal scroll. The headings run `h1` → `h2`, and the status pills stay legible in light mode.

- [ ] **Step 9: Lint, typecheck and commit.**

```bash
npx tsc --noEmit
for f in "app/(marketing)/calendar/page.tsx" components/schools/school-cohorts.tsx "app/(marketing)/schools/[slug]/page.tsx" app/sitemap.ts components/marketing/footer.tsx; do npx eslint "$f"; done
git add "app/(marketing)/calendar/page.tsx" components/schools/school-cohorts.tsx "app/(marketing)/schools/[slug]/page.tsx" app/sitemap.ts components/marketing/footer.tsx
git commit -m "feat(calendar): the Academic Calendar at /calendar, and Upcoming cohorts on every school page"
```

---

### Task 8: Docs, the owner's steps and the closing run

**Files:**
- Modify: `docs/go-patches-phase-3.md`, `docs/launch-runbook.md`, `docs/institutional-blueprint-plan.md`, `docs/mastery-academy-plan.md`, `context.md`

**Interfaces:** none.

- [ ] **Step 1: The Go note.** In `docs/go-patches-phase-3.md`, add the next free section number (`## 12.` unless another track has taken it), titled "Phase 12 — cohorts (web-only)". It says:
  - `cohorts` is a new collection that Go doesn't read.
  - No `enrollments` field changes; a learner's cohort is derived on the web from `purchasedAt` (or the approved ESPEE proof's `createdAt`).
  - Mobile shows no cohort until a later Go release chooses to read the collection.

- [ ] **Step 2: The runbook.**
  - In `docs/launch-runbook.md`, add a section after "Cohort launch", titled "Cohorts as data (Phase 12)":
    1. Deploy (§4).
    2. As an admin, open `/admin/cohorts` and add Cohort 1, starting 2026-10-19 00:00 (Lagos time).
    3. Add Cohort 2 at the owner's date.
    4. **Check:** `/`, `/schools` and a program page count down to Cohort 002, and `/calendar` lists both.
    5. Then remove `NEXT_PUBLIC_COHORT_STARTS_AT` and `NEXT_PUBLIC_COHORT_NUMBER` from Coolify. They only matter while the collection is empty.
  - Change the "Cohort launch" §1 bullet on `NEXT_PUBLIC_COHORT_STARTS_AT` to say it is the fallback while no cohort exists in `/admin/cohorts`.

- [ ] **Step 3: The status docs.**
  - In `docs/institutional-blueprint-plan.md`: tick Phase 12's exit criteria, set its §3 row to done with the date and commit count, and record ruling 11's corrections under Phase 12.
  - In `docs/mastery-academy-plan.md`: update row 12 to match.
  - In `context.md`, add a dated Decision Log entry: cohorts are data, `/admin/cohorts`, `/calendar`, the derived cohort (rulings 2 and 3), and the env fallback.

- [ ] **Step 4: The build proves nothing is frozen (Review Focus 4).** Stop the dev server first.

```bash
MONGODB_URI=mongodb://127.0.0.1:<DBPORT>/worldstreet-academy NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsud29ybGRzdHJlZXRnb2xkLmNvbSQ= \
  pnpm build 2>&1 | tee "$SCRATCH/build.log" | grep -E " /(teach|sell|academy|calendar)( |$)"
```

  Expected: each of the four routes is marked `ƒ` (Dynamic), never `○` (Static). If the build fails for an unrelated environment reason, paste the error into the report, and confirm Task 2, step 3 instead.

- [ ] **Step 5: The closing run.** Restart the verification server (State A, plus Task 5's enrollments).
  - Walk the pages as `guest`, `student`, `instructor` and `admin`, in dark and light, at 1440 and 390 px:
    - `/`, `/teach`, `/calendar`, `/schools`, `/schools/trading-financial-markets` and `/programs/forex-trading-mastery`;
    - `/dashboard` and `/dashboard/my-courses`;
    - `/instructor`;
    - `/admin/cohorts` and `/admin/enrollments`.
  - **Expect:** no horizontal scroll, and no console errors apart from the known Vivid 403.
  - Then, as `admin`, edit Cohort 002's start to `2026-11-23T00:00` in the UI and, with no restart, `text / | grep -c "Cohort 002 — Starts Monday 23 November"` prints `1` (exit criterion 1). Edit it back.

- [ ] **Step 6: Whole-repo checks.**
  Run: `pnpm lint` and `npx tsc --noEmit`
  Expected: no new lint errors against Task 1's baseline; tsc is clean.

- [ ] **Step 7: Commit.**

```bash
git add docs/go-patches-phase-3.md docs/launch-runbook.md docs/institutional-blueprint-plan.md docs/mastery-academy-plan.md context.md
git commit -m "docs(cohorts): Phase 12 — the Go note, the owner's cohort steps and the status board"
```

## Report (end of phase)

Read out Phase 12's exit criteria from `docs/institutional-blueprint-plan.md`, and add:
- the build's route-table lines for `/teach`, `/sell`, `/academy` and `/calendar` (Task 8, step 4);
- the files other tracks also edit, for the merge into `feat/institutional`: `components/admin/admin-sidebar.tsx` and `bottom-nav.tsx` (Phases 18 and 21), `components/dashboard/learning-hero.tsx` and `home-strip.tsx` (Phases 15 and 16), `lib/actions/student.ts`, `components/marketing/footer.tsx` and `app/sitemap.ts`;
- for the controller: once merged, add `lib/cohort-rules.ts` and `lib/cohort-calendar.ts` to the "each fact has one home" list in the repository's `CLAUDE.md`, which is git-excluded, so no implementer can;
- a reminder for the owner: the runbook's "Cohorts as data" steps, and Cohort 002's date (content debt, D20).
