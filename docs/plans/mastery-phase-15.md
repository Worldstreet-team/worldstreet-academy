# Mastery Academy — Phase 15 Implementation Plan (Student portal, welcome email, communities)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The WMA Student Portal answers §11's four questions, with every §11 item one tap away:
- a learner reaches My classes, Recordings, Assignments, **Assessments**, My points, the **Inbox** and **Communities** from the sidebar;
- the program, school and Academy communities sit on one page (§14);
- a first-time payer gets one welcome email with their sign-in details, a map of the portal and the cohort start (§10, D27);
- a signed-out visitor who opens a plan's checkout comes back to it after signing in (§10).

**Architecture:**
- **Assessments.** `getMyAssessments()` already returns finals, knowledge checks and assignments. It gains four nullable fields (attempts, limit, best score, pass mark). Pure helpers in `lib/dashboard-home.ts` turn a row into its next action and its meta line. One client list component serves `/dashboard/assessments` (finals and quizzes) and `/dashboard/assignments` (assignments only).
- **Communities.** A pure `lib/communities.ts` builds one deduplicated list from the learner's enrollments, the schools' links and two build-time env links. The new page and the dashboard's Help & community tile both render it.
- **Welcome.** A server-only `lib/welcome-email.ts` claims an additive `User.welcomedAt` atomically and sends once. Both paid-enrollment paths call it fire-and-forget, after their existing confirmation email. Nothing else in either money path changes.
- **Return path.** Middleware forwards the query string as `x-next-search`; the checkout layout's fallback redirect uses the existing `loginUrl()`.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict · Mongoose · TanStack Query · Resend + `@react-email/components` · Tailwind v4 with the WorldStreet design system (`ds/`, `ws-*` tokens).

**Spec:** `docs/institutional-blueprint.md` §10, §11, §14, §19. **Roadmap:** `docs/institutional-blueprint-plan.md` Phase 15, decisions D19 (Campus), D26, D27.

**Branch:** `mastery/phase-15`, cut from `feat/institutional`. Track B: this phase runs first, then Phase 16 on top of it.

## Controller rulings (binding)

1. **`getMyAssessments()` keeps its signature.** The roadmap's "via `getMyAssessments` with scope `final | lesson`" has no parameter to match: the function returns every scope. Pages split the rows client-side with `assessmentKindOf`. Its rows gain `attemptsUsed`, `maxAttempts`, `bestScorePercent` and `passMarkPercent`, null on assignments. A lean exam row skips schema defaults, so a missing `settings.maxAttempts` reads `3` and a missing `settings.passMarkPercent` reads `70`, as the runner's hydrated document does.
2. **The list stays a client component** (`useMyAssessments`), so it shares the dashboard tile's cache and assignment due dates stay in the learner's time zone. The two pages become RSC shells around it.
3. **The dashboard's Assignments tile follows the split.** Its title names the kinds it holds. Its single "See all" link is replaced by a foot link per kind present (Task 2).
4. **`communitiesFor` takes the schools as an input** (the roadmap lists only `programs`, `academyUrl` and `executiveUrl`), so its school rows can be asserted while every school link is still null. `myCommunities(enrollments)` binds `SCHOOLS` and the two env links for the page and the tile.
5. **Community rules.**
   - Nothing shows without at least one access-granting enrollment (`active` or `completed`).
   - The Academy row then shows to every such learner (D26), not only as a fallback.
   - The Executive row needs an access-granting enrollment whose plan is explicitly `executive`.
   - Every URL passes `safeWebUrl`.
   - Rows run program → school → academy → executive, and are deduplicated by URL (first wins).
6. **`School.communityUrl` is optional on the type (`communityUrl?: string | null`), and no school entry sets it.** Phase 13 rewrites the school list, so this phase touches only the type. Phase 13 must keep the field.
7. **The tile shows the first two community rows**, then "All communities" when there are more. The page shows them all.
8. **The Inbox badge reads the bell's own query.** A new `useNotificationFeed()` holds the bell's key, limit and timings. The bell switches to it, so the two counts can never disagree, and the bell's live invalidation refreshes both.
9. **Page titles follow the labels:** Inbox, My points, and My classes. `/dashboard/meetings` keeps "Meetings" for people who can start sessions (`canStart`): an instructor hosts interviews and ad-hoc meetings there.
10. **Campus (D19).** The greeting's eyebrow reads `WMA Campus · Monday, October 19` (the date part as today). "WMA" is literal here: Phase 11's `BRAND.shortName` is on another track. The nav keeps "Dashboard".
11. **The welcome goes on the learner's first *paid* enrollment only, checked in the data.**
    - The roadmap's "no backfill needed: existing learners simply never get one" is false with a bare claim: every user created before this release lacks `welcomedAt`, so their next purchase would claim it.
    - So `sendWelcomeOnce(userId, enrollmentId)` first requires that no other enrollment of theirs with `pricePaid > 0` was purchased earlier.
    - The claim is **at most once**. A failed send is never retried: the per-program confirmation email already carries the sign-in line.
    - It lives in a new server-only `lib/welcome-email.ts`, because `lib/email.tsx` has no database code.
12. **"The WMA Student Portal" in emails** replaces "your dashboard" in exactly two learner-facing strings (Task 5). In-app notification text is untouched.
13. **The cohort line** in the welcome reads `lib/cohort.ts` (`cohortIsUpcoming`, `COHORT_DATE_LABEL`). `lib/welcome-email.ts` is this phase's only consumer. When Phase 12 replaces that module with data, that one call switches to Phase 12's reader.
14. **Return path.**
    - `middleware.ts` gains one line, the `x-next-search` header. A layout can't see the query string otherwise, and checkout needs `courseId` and `package`.
    - The checkout layout redirects to `loginUrl(checkoutReturnPath(...))`.
    - The `(platform)`, `(instructor)` and `(admin)` layouts are out of scope and stay as they are.
15. **No mock persona is added.** `mocks/`, `lib/dev` and `scripts/dev` must stay identical to `feat/institutional`: the Phase 10 release check diffs them. A new worktree's database has a `student` with no enrollments, and the harness resets that student between checks.
16. **Go note numbering.** The section takes the next free number on this branch. The controller renumbers it at merge if another track took that number first.

## Global Constraints

- **Schema:** additive only, because the Go mobile API reads the same MongoDB. `users.welcomedAt` is new and nullable. No renamed fields, no new enum values, no new role values.
- **Server actions:** `connectDB()` → auth/ownership → Zod (`import { z } from "zod/v4"`) → mutate → `revalidatePath()` → return `{ success: true, data } | { success: false, error }`. They never throw across the boundary. User ids come from `getCurrentUser()`, never the browser. Admin actions use `requireAdmin()`. Role gates live in each route group's `layout.tsx`.
- **Money paths:** `purchaseCourse` and `adminApproveEspeePayment` change by one import and one un-awaited call each, placed after their `void sendEnrollmentConfirmationEmail(...)`. Orders, charges, enrollments, earnings, referrals and return values are untouched. Money is integer cents through `lib/wallet.ts` and fails closed.
- **Fire-and-forget helpers never throw:** catch everything and log it, like `lib/notify.ts`.
- **Code:** no new dependencies, no `any`, no secrets. Env values are named, never written. `NEXT_PUBLIC_*` values are inlined at build time, so write `process.env.NEXT_PUBLIC_X` literally.
- **Absolute URLs** come only from `lib/app-url.ts` (`appUrl`, `APP_URL`). Emails never contain a password.
- **Local-dev switch:** a `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` starting with `pk_test_` means local `/login`; anything else means the hub. `lib/auth/login-url.ts` already mirrors `middleware.ts`.
- **UI:**
  - The WorldStreet design system. `ds/` is vendored: never edit it.
  - `ws-*` and shadcn tokens only, never a hex. Gold only for primary CTAs, active nav and brand moments.
  - Icons only from `@/components/icons` (duotone glyphs). Never lucide, Hugeicons or emoji.
  - Base UI composition via `render`, never `asChild`. Pills, 20 px cards, Manrope.
  - `·` separators. `tabular-nums` for counts, scores and money.
  - Inside `(platform)`, copy the neighbouring page's container classes verbatim. They carry the `pb-24`-equivalent bottom-nav clearance (`pb-[calc(6rem+env(safe-area-inset-bottom))]`).
- **External links:** `target="_blank" rel="noopener noreferrer"` plus a `sr-only` "(opens in a new tab)", as `SupportTile` does today.
- **RSC-first:** `"use client"` only where interaction or the shared React Query cache needs it. Never import a non-component value (an object, a constant, a function) from a `"use client"` module into a server component.
- **Copy:**
  - New user-facing strings use the new vocabulary: *plan*, not package; *program* for Academy offerings.
  - Don't rename strings outside this phase's scope. The vocabulary pass runs last (Phase 11, Tasks 6–7), so "Teach on Academy" and the bell's "See all notifications" stay.
  - Never invent figures or policy.
- **Checks:** no test runner exists, and none may be added.
  - Pure rules are checked by a throwaway `node:assert/strict` script, run from the repo root as `npx tsx --tsconfig ./tsconfig.json "$SCRATCH/<file>.ts"`. If `@/…` doesn't resolve for a file outside the repo, switch its imports to absolute paths into the repo and say so.
  - Everything else: `npx tsc --noEmit` (one stale `.next/types` error is not real), `npx eslint <file>` one changed file at a time, and a driven route.
- **Databases:** scripts touch only the local mock database, with `MONGODB_URI` on the command line. `.env.local` points at production.
- Anchors are **quoted text**, never line numbers.

## Review Focus

1. **A learner who paid before this release buys again.** Their user document has no `welcomedAt`. They must get no welcome: they already know the portal. Covered in Task 5, step 8c.
2. **Two first purchases land at the same moment** (two tabs, two programs). Exactly one welcome is sent: neither the earlier-purchase check nor the claim may let both through or block both. Covered in Task 5, step 8d.
3. **The email service fails** (Resend down; the disabled key locally). The purchase and the approval still succeed at their normal speed, and nothing about the failure reaches the buyer. `welcomedAt` stays set. Covered in Task 5, step 8b.
4. **A final exam with every attempt used must not offer "Retake"**, and an unlimited exam (`maxAttempts: 0`) must never print "of 0". A best score of 0 still prints. Covered in Task 1's assertions.
5. **Community links must be safe.**
   - A `javascript:` or blank link is never rendered.
   - The same group never appears twice.
   - A refunded or reserved program's private group never shows.
   - The Executive group shows only on an Executive plan.

   Covered in Task 3's assertions, and by Task 3, step 10.

## Verification server

Each track runs its own `dev:mock` in its own worktree. The controller fills `<PORT>`, `<DBPORT>` and `<WALLETPORT>` per track.

```bash
netstat -ano | grep -E ":<PORT>|:<DBPORT>|:<WALLETPORT>"      # must print nothing first
SCRATCH=$(mktemp -d)                                           # helpers and logs live outside the repository
RESEND_API_KEY=re_disabled_local CLOUDFLARE_REALTIME_API_KEY=disabled-local OPENAI_API_KEY=disabled-local \
ABLY_API_KEY=disabled-local R2_SECRET_ACCESS_KEY=disabled-local WALLET_SERVICE_TOKEN=disabled-local \
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_bG9jYWwuZGV2JA MOCK_DB_PORT=<DBPORT> PORT=<PORT> node scripts/dev-mock.mjs
MONGODB_URI=mongodb://127.0.0.1:<DBPORT>/worldstreet-academy node scripts/mastery-catalogue.mjs --apply
```

The worktree has no `.env.local`; that is intended. Personas switch with the `mock_persona` cookie: `guest`, `student`, `instructor`, `admin`. The seeded `student` starts with no enrollments, so the paid-dashboard gate sends them to `/schools` until a fixture gives them access (`/dashboard/checkout*` and `/dashboard/meetings` are exempt). Turbopack hot-reloads code but not model schema changes, so restart after Task 5's model edit. Stop the server, and the stub, when done.

**Task-specific variants.** Each one means: restart with these variables added, and send output to `"$SCRATCH/dev.log"`.
- **Task 3:** `NEXT_PUBLIC_COMMUNITY_URL=https://t.me/wma-academy-fixture NEXT_PUBLIC_EXECUTIVE_COMMUNITY_URL=https://t.me/wma-executive-fixture`. These are fixture hosts on purpose: the sidebar already links `social.worldstreetgold.com`.
- **Task 5:** `WALLET_BASE_URL=http://127.0.0.1:<WALLETPORT> WALLET_SERVICE_TOKEN=stub-token`. This replaces the `disabled-local` token. Run with the wallet stub below.

**Wallet stub.** Local only, and never committed. `node "$SCRATCH/wallet-stub.mjs" <WALLETPORT>`:

```js
import http from "node:http"
const charges = new Map()
let n = 0
const zero = { availableMinor: 0, lockedMinor: 0, available: 0, locked: 0 }
http.createServer((req, res) => {
  let body = ""
  req.on("data", (c) => (body += c))
  req.on("end", () => {
    const send = (obj) => { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)) }
    if (req.url === "/__state") return send({ ok: true, charges: [...charges.values()] })
    if (req.method === "GET" && req.url.endsWith("/balances")) {
      return send({ ok: true, balances: { USD: { availableMinor: 10000000, lockedMinor: 0, available: 100000, locked: 0 }, NGN: zero } })
    }
    if (req.method === "POST" && req.url.endsWith("/charges")) {
      const key = req.headers["idempotency-key"] ?? `k${++n}`
      if (!charges.has(key)) {
        const { amountMinor, description } = JSON.parse(body || "{}")
        charges.set(key, { id: `ch_stub_${++n}`, chargeRef: key, status: "succeeded", currency: "USD", amountMinor,
          recipientAmountMinor: amountMinor, platformRevenueMinor: 0, description, createdAt: new Date().toISOString() })
      }
      return send({ ok: true, charge: charges.get(key) })
    }
    send({ ok: true })
  })
}).listen(Number(process.argv[2]), "127.0.0.1")
```

**Mock-DB harness.** The controller writes `$SCRATCH/mockdb.cjs` once. It uses Mongoose's raw collections (`mongoose.connection.db.collection(...)`), run as `NODE_PATH="$(pwd)/node_modules" MONGODB_URI=mongodb://127.0.0.1:<DBPORT>/worldstreet-academy node "$SCRATCH/mockdb.cjs" <cmd>`. "Student" means the user with the email `student@worldstreet.academy`. "Forex" and "Crypto" are the courses titled "Forex Trading Mastery" and "Crypto Trading Mastery". Raw inserts set `createdAt`/`updatedAt` themselves.

| Command | Effect |
|---|---|
| `ids` | Prints JSON `{ student, admin, forex, crypto }`. |
| `reset-student` | Deletes the student's `enrollments`, `orders`, `earnings` (as `student`), `manualpayments`, `examattempts` and `submissions`, and `$unset`s their `welcomedAt`. |
| `assess-fixture` | Requires `reset-student` first. Inserts, all on Forex:<br>• an active enrollment: `packageKey: "standard"`, the course's Standard `packageName`, `pricePaid: 199`, `progress: 100`, `purchasedAt` now.<br>• a published text lesson, "Reading a price chart".<br>• a published lesson quiz on it: `scope: "lesson"`, title "Chart check", `passMarkPercent: 60`, `maxAttempts: 0`.<br>• a published final: `scope: "final"`, title "Forex final exam", `passMarkPercent: 70`, `maxAttempts: 3`.<br>• one `failed` attempt at the final, `scorePercent: 64`.<br>• a published assignment, "Price-action journal", with no due date.<br>Exams take `instructor` = the course's instructor, `questionCount: 1`, `totalPoints: 1`, and the other settings at schema defaults. |
| `community <title> <url>` | Sets `communityUrl` on that course. |
| `plan <packageKey>` | Sets the student's Forex enrollment's `packageKey` and its matching `packageName`. |
| `enroll-status <title> <status>` | Sets the status of the student's enrollment on that course. |
| `notify` | Inserts one unread `course` notification for the student, titled "Fixture notice", with the body "Inbox badge check". |
| `prior-paid <title>` | Inserts an active enrollment for the student on that course: `pricePaid: 199`, `packageKey: "standard"`, `purchasedAt: 2026-09-01T09:00:00Z`. Unsets `welcomedAt`. |
| `espee-proof <title>` | Inserts a `submitted` ManualPayment for the student on that course and prints its id. Fields: `packageKey: "basic"` with the course's Basic `packageName`, `amountMinor: 4900`, `amountLabel: "$49"`, `receiptKey: "worldstreet-academy/payment-proofs/<studentId>/fixture.png"`, `receiptContentType: "image/png"`, `transferReference: "FIXTURE-<n>"`, `history: [{ status: "submitted", at: now }]`. |
| `probe` | Prints the student's `welcomedAt`, and each enrollment's title, status, `pricePaid` and `packageKey`. |

**Page text.** Server-rendered pages:

```bash
BASE=http://localhost:<PORT>
text() { curl -s ${2:+-b "mock_persona=$2"} "$BASE$1" | perl -0pe 's#<script\b.*?</script>##gs; s#<style\b.*?</style>##gs; s#<[^>]+># #g; s#&\#x27;#\x27#g; s#&quot;#"#g; s#&amp;#&#g; s#\s+# #g'; }
```

Client-rendered content (the sidebar, React Query lists) needs the browser. `ptext <path> <persona> <waitForText> [width] [selector]` prints the `innerText` of the first `selector` match (default `body`) once `waitForText` is visible. Pass `"[data-slot=sidebar-inner]"` to read only the student rail. It uses `$SCRATCH/pw-text.cjs`: Playwright is installed globally and required through `NODE_PATH="$(npm root -g)"`. The script sets the `mock_persona` cookie for `$BASE`, opens the page with `waitUntil: "networkidle"` at the given width (default 1440), and waits up to 20 s. `$SCRATCH/pw-buy.cjs` and `$SCRATCH/pw-approve.cjs` (Task 5) are written the same way.

## File structure

| File | Responsibility |
|---|---|
| `lib/actions/exams.ts` (modify) | `MyAssessment` + attempts, limit, best score, pass mark |
| `lib/dashboard-home.ts` (modify) | + `assessmentKindOf`, `assessmentAction`, `assessmentMeta`; − `classCommunities` |
| `components/dashboard/assessment-list.tsx` (new) | The one list behind Assessments and Assignments (client) |
| `app/(platform)/dashboard/assessments/page.tsx` (new) | `/dashboard/assessments`: finals and knowledge checks |
| `app/(platform)/dashboard/assignments/page.tsx` (modify) | Assignments only, as an RSC shell |
| `components/dashboard/assignments-tile.tsx` (modify) | Title and foot links follow the split |
| `lib/schools.ts` (modify, type only) | `School.communityUrl?` |
| `lib/actions/student.ts` (modify) | `StudentEnrollment.school` |
| `lib/communities.ts` (new) | Pure community list and the two env links |
| `app/(platform)/dashboard/communities/page.tsx` (new) | `/dashboard/communities` (RSC) |
| `components/dashboard/home-tiles.tsx`, `app/(platform)/dashboard/page.tsx` (modify) | `SupportTile` reads the same list |
| `lib/hooks/queries/use-notifications.ts` (new), `lib/hooks/queries/index.ts` (modify) | `useNotificationFeed`, shared by the bell and the sidebar |
| `components/shared/notification-bell.tsx` (modify) | Uses `useNotificationFeed` |
| `components/platform/app-sidebar.tsx` (modify) | §11 navigation, Inbox badge |
| `app/(platform)/dashboard/{notifications,meetings,points}/page.tsx` (modify) | Titles: Inbox, My classes, My points |
| `components/dashboard/learning-hero.tsx` (modify) | "WMA Campus" eyebrow |
| `lib/db/models/user.ts` (modify) | `welcomedAt` |
| `lib/email.tsx` (modify) | `sendWelcomeEmail`; "the WMA Student Portal" ×2 |
| `lib/welcome-email.ts` (new) | `sendWelcomeOnce`: first-paid check, atomic claim, send |
| `lib/actions/enrollments.ts`, `lib/actions/manual-payments.ts` (modify) | One import + one fire-and-forget call each |
| `middleware.ts`, `lib/auth/login-url.ts`, `app/(checkout)/layout.tsx` (modify) | Checkout return path |
| `lib/vivid/prompt.ts`, docs (modify) | New routes; Go note; runbook; status |

---

### Task 1: Assessment rows carry attempts, best score and pass mark

**Files:**
- Modify: `lib/actions/exams.ts`, `lib/dashboard-home.ts`

**Interfaces:**
- Produces, on `MyAssessment` (`lib/actions/exams.ts`), after `href`:

```ts
/** Exams: finished attempts (status ≠ "in_progress"). Assignments: null. */
attemptsUsed: number | null
/** Exams: the exam's attempt limit, 0 = unlimited. Assignments: null. */
maxAttempts: number | null
/** Exams: the best finished score, 0–100; null before any. Assignments: null. */
bestScorePercent: number | null
/** Exams: the pass mark, 1–100. Assignments: null. */
passMarkPercent: number | null
```

- Produces, in `lib/dashboard-home.ts`:
  - `export type AssessmentKind = "assessments" | "assignments"`
  - `assessmentKindOf(a: Pick<MyAssessment, "scope">): AssessmentKind`: `"assignments"` for scope `assignment`, else `"assessments"`.
  - `assessmentAction(a: MyAssessment): string | null`: the row's next action (table in step 5).
  - `assessmentMeta(a: MyAssessment): string | null`: the exam meta line (rules in step 5).

- [ ] **Step 0: Baseline.** Run `pnpm lint 2>&1 | tail -3` and record the problem count for Task 7.

- [ ] **Step 1: Check first.**
  Run: `grep -n "bestScorePercent" lib/dashboard-home.ts; grep -c "attemptsUsed: number | null" lib/actions/exams.ts`
  Expected: no hit, and `0`.

- [ ] **Step 2: Write `$SCRATCH/t1-assessments.ts`.**

```ts
import assert from "node:assert/strict"
import { assessmentAction, assessmentKindOf, assessmentMeta } from "@/lib/dashboard-home"
import type { MyAssessment } from "@/lib/actions/exams"

const base = { id: "e1", courseId: "c1", courseTitle: "Forex Trading Mastery", title: "Forex final exam", lessonId: null, dueAt: null, href: "/dashboard/courses/c1/exam" }
const exam = (o: Partial<MyAssessment> = {}): MyAssessment =>
  ({ ...base, scope: "final", status: "not_started", attemptsUsed: 0, maxAttempts: 3, bestScorePercent: null, passMarkPercent: 70, ...o })
const task = (o: Partial<MyAssessment> = {}): MyAssessment =>
  ({ ...base, scope: "assignment", status: "not_started", attemptsUsed: null, maxAttempts: null, bestScorePercent: null, passMarkPercent: null, ...o })

assert.equal(assessmentAction(exam()), "Start")
assert.equal(assessmentAction(exam({ status: "in_progress" })), "Resume")
assert.equal(assessmentAction(exam({ status: "failed", attemptsUsed: 1 })), "Retake")
assert.equal(assessmentAction(exam({ status: "failed", attemptsUsed: 3 })), "View result")          // none left
assert.equal(assessmentAction(exam({ status: "failed", attemptsUsed: 9, maxAttempts: 0 })), "Retake") // unlimited
assert.equal(assessmentAction(exam({ status: "passed", attemptsUsed: 1 })), "View result")
assert.equal(assessmentAction(exam({ status: "locked" })), null)
assert.equal(assessmentAction(task()), "Submit")
assert.equal(assessmentAction(task({ status: "submitted" })), null)
assert.equal(assessmentAction(task({ status: "graded" })), "View grade")

assert.equal(assessmentMeta(exam({ attemptsUsed: 1, bestScorePercent: 64 })), "1 of 3 attempts · Best 64% · Pass mark 70%")
assert.equal(assessmentMeta(exam({ maxAttempts: 1 })), "0 of 1 attempt · Pass mark 70%")
assert.equal(assessmentMeta(exam({ scope: "lesson", maxAttempts: 0, passMarkPercent: 60 })), "Unlimited attempts · Pass mark 60%")
assert.equal(assessmentMeta(exam({ maxAttempts: 0, attemptsUsed: 1, bestScorePercent: 80 })), "1 attempt · unlimited · Best 80% · Pass mark 70%")
assert.equal(assessmentMeta(exam({ maxAttempts: 0, attemptsUsed: 2, bestScorePercent: 0 })), "2 attempts · unlimited · Best 0% · Pass mark 70%")
assert.equal(assessmentMeta(task()), null)

assert.equal(assessmentKindOf(exam({ scope: "lesson" })), "assessments")
assert.equal(assessmentKindOf(exam()), "assessments")
assert.equal(assessmentKindOf(task()), "assignments")
console.log("assessments: all assertions passed")
```

- [ ] **Step 3: Run it to see it fail.**
  Run: `npx tsx --tsconfig ./tsconfig.json "$SCRATCH/t1-assessments.ts"`
  Expected: FAIL, because `assessmentAction` is not exported.

- [ ] **Step 4: `getMyAssessments` in `lib/actions/exams.ts`.**
  - **Type.** Add the four fields to `MyAssessment`, and `scorePercent: number | null` to the local `AssessmentAttempt` type.
  - **Selects.**
    - The enrollment select becomes `"course packageKey examPassed progress bestScorePercent"`.
    - The exam select becomes `"course scope lesson title settings.passMarkPercent settings.maxAttempts"`.
    - The attempt select becomes `"exam status submittedAt createdAt scorePercent"`.
  - **Per exam row**, from the `history` it already builds:
    - `attemptsUsed` is the number of attempts whose status isn't `in_progress`.
    - `maxAttempts` is `exam.settings?.maxAttempts ?? 3`, and `passMarkPercent` is `exam.settings?.passMarkPercent ?? 70` (ruling 1).
    - `bestScorePercent` is the highest non-null `scorePercent` among finished attempts. For a final, it also takes `enrollment.bestScorePercent` when that is non-null. It is null when there are none.
  - **Assignment rows** set all four to `null`.
  - Extend the doc comment above the function by one sentence about the new fields.

- [ ] **Step 5: The helpers in `lib/dashboard-home.ts`,** placed beside `assessmentCounts`. `assessmentAction` follows this table:

  | `status` | final / lesson | assignment |
  |---|---|---|
  | `not_started` | `"Start"` | `"Submit"` |
  | `in_progress` | `"Resume"` | `"Resume"` |
  | `failed` | `"Retake"` while attempts remain or `maxAttempts` is 0; `"View result"` when `attemptsUsed ≥ maxAttempts` | — |
  | `passed` | `"View result"` | — |
  | `locked`, `submitted` | `null` | `null` |
  | `graded` | — | `"View grade"` |

  `assessmentMeta` returns `null` for scope `assignment`. Otherwise it joins these parts with `" · "`:
  - **Attempts.** With `max > 0`, `` `${used} of ${max} ${max === 1 ? "attempt" : "attempts"}` ``. With `max === 0`, `"Unlimited attempts"` when `used === 0`, else `` `${used} ${used === 1 ? "attempt" : "attempts"} · unlimited` ``.
  - **Best.** `` `Best ${best}%` `` when `bestScorePercent !== null`. A 0 prints.
  - **Pass mark.** `` `Pass mark ${pass}%` `` when `passMarkPercent !== null`.

- [ ] **Step 6: Run it to see it pass.**
  Run: `npx tsx --tsconfig ./tsconfig.json "$SCRATCH/t1-assessments.ts"`
  Expected: `assessments: all assertions passed`.

- [ ] **Step 7: Typecheck and lint.**
  Run: `npx tsc --noEmit`, then `npx eslint lib/actions/exams.ts` and `npx eslint lib/dashboard-home.ts`.
  Expected: clean.

- [ ] **Step 8: Commit.**

```bash
git add lib/actions/exams.ts lib/dashboard-home.ts
git commit -m "feat(assessments): attempts, best score and pass mark on every assessment row"
```

---

### Task 2: `/dashboard/assessments`, and Assignments keeps assignments

**Files:**
- Create: `components/dashboard/assessment-list.tsx`, `app/(platform)/dashboard/assessments/page.tsx`
- Modify: `app/(platform)/dashboard/assignments/page.tsx`, `components/dashboard/assignments-tile.tsx`

**Interfaces:**
- Consumes: Task 1's fields and helpers; `ASSESSMENT_STATUS` and `assessmentKindLabel` from `components/dashboard/assignments-tile.tsx` (client to client, as the page imports them today); `useMyAssessments`.
- Produces: `AssessmentList({ kind }: { kind: AssessmentKind })`, a `"use client"` component.

- [ ] **Step 1: Check first.** Run `mockdb.cjs reset-student`, then `mockdb.cjs assess-fixture`.
  Run: `curl -s -o /dev/null -w "%{http_code}\n" -b mock_persona=student $BASE/dashboard/assessments`
  Expected: `404`.

- [ ] **Step 2: Create `components/dashboard/assessment-list.tsx`.**
  - **Data.** It reads `useMyAssessments()` and keeps the rows where `assessmentKindOf(a) === kind`.
  - **States.** Loading, error (with "Try again") and the row markup are moved from the current `assignments/page.tsx`: the `<ul className="space-y-2">` block and the states above it.
  - **Each row adds:**
    - under the kind line, `assessmentMeta(a)` when non-null, in `block truncate text-[12px] tabular-nums text-ws-muted`;
    - to the right of the status chip, `assessmentAction(a)` when non-null, in `shrink-0 text-[12.5px] font-medium text-ws-primary max-sm:hidden`.
  - **Empty copy:**
    - `assessments`: title "No assessments right now", body "Knowledge checks and final exams your plan includes appear here."
    - `assignments`: title "Nothing to hand in right now", body "Practical assignments your plan includes appear here."
  - The component comment says it is the one list behind both pages.

- [ ] **Step 3: The two pages, both RSC shells** with no `"use client"`. Copy the recordings page's container classes, and use `PageHeader` from `@/components/shared/page-header`.
  - `app/(platform)/dashboard/assessments/page.tsx`:
    - `export const metadata = { title: "Assessments" }`;
    - `<Topbar title="Assessments" />`;
    - header title "Assessments", subline "Knowledge checks and final exams your plan includes — your attempts, best score and pass mark.";
    - `<AssessmentList kind="assessments" />`.
  - `app/(platform)/dashboard/assignments/page.tsx`, rewritten the same way:
    - metadata title "Assignments";
    - subline "Practical assignments your plan includes. Hand in your work and see your grade.";
    - `<AssessmentList kind="assignments" />`.

- [ ] **Step 4: `assignments-tile.tsx`** (ruling 3).
  - **Title:** "Assessments & assignments" when both kinds are present, else "Assessments" or "Assignments".
  - **Header:** drop `CardHeader`'s `link`. The subtitle stays.
  - **Foot:** replace the "`N` more" link with one `TILE_FOOT_LINK` per kind present, side by side in a `flex` row with a hairline between them. They read "All assessments" → `/dashboard/assessments` and "All assignments" → `/dashboard/assignments`, each followed by `<Chevron />`.
  - Update the component comment.

- [ ] **Step 5: Verify.**
  - Run: `ptext /dashboard/assessments student "Forex final exam" | grep -oE "Chart check|Forex final exam|Knowledge check|Final exam|1 of 3 attempts · Best 64% · Pass mark 70%|Unlimited attempts · Pass mark 60%|Retake|Start" | sort -u`
    Expected: all eight.
  - Run: `ptext /dashboard/assessments student "Forex final exam" | grep -c "Price-action journal"`
    Expected: `0`.
  - Run: `ptext /dashboard/assignments student "Price-action journal" | grep -cE "Final exam|Knowledge check"`
    Expected: `0`. The same text shows "Submit".
  - Run: `ptext /dashboard student "All assessments" | grep -oE "Assessments & assignments|All assessments|All assignments" | sort -u`
    Expected: all three.

- [ ] **Step 6: Look at it.**
  - At 390 px in dark and light, the meta line truncates without horizontal scroll, and the action label is hidden.
  - With every row removed (`reset-student`, then `prior-paid "Crypto Trading Mastery"` so the gate still opens), both pages show their empty copy.

- [ ] **Step 7: Typecheck, lint and commit.**

```bash
npx tsc --noEmit
npx eslint components/dashboard/assessment-list.tsx
npx eslint "app/(platform)/dashboard/assessments/page.tsx"
npx eslint "app/(platform)/dashboard/assignments/page.tsx"
npx eslint components/dashboard/assignments-tile.tsx
git add components/dashboard/assessment-list.tsx "app/(platform)/dashboard/assessments/page.tsx" "app/(platform)/dashboard/assignments/page.tsx" components/dashboard/assignments-tile.tsx
git commit -m "feat(portal): an Assessments page — finals and knowledge checks with attempts and pass marks"
```

---

### Task 3: Communities — program, school, Academy (§14, D26)

**Files:**
- Create: `lib/communities.ts`, `app/(platform)/dashboard/communities/page.tsx`
- Modify: `lib/schools.ts` (type only), `lib/actions/student.ts`, `lib/dashboard-home.ts`, `components/dashboard/home-tiles.tsx`, `app/(platform)/dashboard/page.tsx`

**Interfaces:**
- Produces, in `lib/schools.ts`, on `School` after `intro`:
  `/** §14 School Community (D26): an external group link; absent or null until product supplies one. */ communityUrl?: string | null`
- Produces, in `lib/actions/student.ts`, on `StudentEnrollment` after `communityUrl`:
  `/** The program's school (`Course.school`); null when unassigned. */ school: SchoolSlug | null`
- Produces, from `lib/communities.ts` (client-safe, no server imports):

```ts
export type CommunityScope = "program" | "school" | "academy" | "executive"
export type CommunityLink = { scope: CommunityScope; label: string; url: string }
export type CommunityProgram = Pick<StudentEnrollment, "status" | "courseTitle" | "communityUrl" | "school" | "packageKey" | "explicitPackage">
export const COMMUNITY_SCOPE_TITLE: Record<CommunityScope, string> =
  { program: "Program community", school: "School community", academy: "Academy community", executive: "Executive community" }
/** Inlined at build time; blank → null. */
export const ACADEMY_COMMUNITY_URL: string | null      // process.env.NEXT_PUBLIC_COMMUNITY_URL?.trim() || null
export const EXECUTIVE_COMMUNITY_URL: string | null    // process.env.NEXT_PUBLIC_EXECUTIVE_COMMUNITY_URL?.trim() || null
export function communitiesFor(input: {
  programs: readonly CommunityProgram[]
  schools: readonly Pick<School, "slug" | "name" | "communityUrl">[]
  academyUrl: string | null
  executiveUrl: string | null
}): CommunityLink[]
/** communitiesFor with SCHOOLS and the two env links. */
export function myCommunities(programs: readonly CommunityProgram[]): CommunityLink[]
```

- Removes: `ClassCommunity` and `classCommunities` from `lib/dashboard-home.ts`.
- `SupportTile`'s prop becomes `communities: CommunityLink[]`.

- [ ] **Step 1: Check first.**
  Run: `grep -rln "classCommunities\|ClassCommunity" app components lib`
  Expected: `lib/dashboard-home.ts`, `components/dashboard/home-tiles.tsx` and `app/(platform)/dashboard/page.tsx`.

- [ ] **Step 2: Write `$SCRATCH/t3-communities.ts`.**

```ts
import assert from "node:assert/strict"
import { communitiesFor, type CommunityProgram } from "@/lib/communities"

const schools = [
  { slug: "trading-financial-markets", name: "School of Trading & Financial Markets", communityUrl: "https://t.me/wma-trading" },
  { slug: "data-analytics", name: "School of Data & Analytics", communityUrl: null },
] as const
const ACADEMY = "https://social.worldstreetgold.com"
const EXEC = "https://t.me/wma-executive"
const p = (o: Partial<CommunityProgram> = {}): CommunityProgram => ({
  status: "active", courseTitle: "Forex Trading Mastery", communityUrl: null,
  school: "trading-financial-markets", packageKey: "standard", explicitPackage: true, ...o,
})
const run = (programs: CommunityProgram[], academyUrl: string | null = ACADEMY, executiveUrl: string | null = EXEC) =>
  communitiesFor({ programs, schools, academyUrl, executiveUrl })

// No access-granting enrollment → nothing, not even the Academy row.
assert.deepEqual(run([p({ status: "pre_enrolled", communityUrl: "https://t.me/forex" }), p({ status: "refunded" })]), [])
// Order and labels.
assert.deepEqual(
  run([p({ communityUrl: "https://t.me/forex" }), p({ courseTitle: "Crypto Trading Mastery", communityUrl: "https://t.me/crypto", packageKey: "executive" })]),
  [
    { scope: "program", label: "Forex Trading Mastery", url: "https://t.me/forex" },
    { scope: "program", label: "Crypto Trading Mastery", url: "https://t.me/crypto" },
    { scope: "school", label: "School of Trading & Financial Markets", url: "https://t.me/wma-trading" },
    { scope: "academy", label: "WorldStreet Mastery Academy", url: ACADEMY },
    { scope: "executive", label: "Executive plan learners", url: EXEC },
  ]
)
// Deduplicated by URL, first wins.
const dup = run([p({ communityUrl: ACADEMY }), p({ courseTitle: "Crypto Trading Mastery", communityUrl: ACADEMY })], ACADEMY, null)
assert.deepEqual(dup.map((l) => l.scope), ["program", "school"])
assert.equal(dup[0].label, "Forex Trading Mastery")
// Unsafe or blank links never render.
assert.deepEqual(run([p({ communityUrl: "javascript:alert(1)", school: "data-analytics", packageKey: "executive" })], "   ", "not a url"), [])
// Executive only on an explicit Executive plan that grants access.
assert.equal(run([p({ packageKey: "executive", explicitPackage: false })]).some((l) => l.scope === "executive"), false)
assert.equal(run([p({ packageKey: "executive", status: "completed" })]).some((l) => l.scope === "executive"), true)
// The Academy row shows to every enrolled learner, with no program or school link.
assert.deepEqual(run([p({ school: null })]).map((l) => l.scope), ["academy"])
assert.deepEqual(run([p({ school: null })], null, null), [])
console.log("communities: all assertions passed")
```

- [ ] **Step 3: Run it to see it fail.**
  Run: `npx tsx --tsconfig ./tsconfig.json "$SCRATCH/t3-communities.ts"`
  Expected: FAIL, because `lib/communities` doesn't exist.

- [ ] **Step 4: The two fields.**
  - Add `communityUrl?` to the `School` type. No entry in `SCHOOLS` changes (ruling 6).
  - Add `school` to `StudentEnrollment`. In `fetchMyEnrollments`' returned object, set `school: isSchoolSlug(course.school) ? course.school : null`. `school` is already in the populate's `select`, and `isSchoolSlug` is already imported.

- [ ] **Step 5: Create `lib/communities.ts`.** Its doc comment cites institutional blueprint §14 and D26 ("external links; no in-app forum"). It imports `BRAND`, `SCHOOLS` and the `School` type, `grantsAccess` (`lib/dashboard-home.ts`), `safeWebUrl` (`lib/faculty.ts`) and the `StudentEnrollment` type. `communitiesFor`:
  1. `active` = the programs that pass `grantsAccess`. If there are none, return `[]`.
  2. Program rows, in input order: `safeWebUrl(p.communityUrl)` → `{ scope: "program", label: p.courseTitle, url }`.
  3. School rows: each distinct non-null `p.school` among `active`, in first-seen order. Look the school up in `input.schools`, then `safeWebUrl(school.communityUrl)` → `{ scope: "school", label: school.name, url }`.
  4. `safeWebUrl(academyUrl)` → `{ scope: "academy", label: BRAND.name, url }`.
  5. If some active program has `explicitPackage && packageKey === "executive"`: `safeWebUrl(executiveUrl)` → `{ scope: "executive", label: "Executive plan learners", url }`.
  6. Drop any row whose `url` already appeared.

- [ ] **Step 6: Run it to see it pass.**
  Run: `npx tsx --tsconfig ./tsconfig.json "$SCRATCH/t3-communities.ts"`
  Expected: `communities: all assertions passed`.

- [ ] **Step 7: The tile and the dashboard.**
  - **`lib/dashboard-home.ts`:** delete `ClassCommunity` and `classCommunities`, with its doc comment.
  - **`SupportTile` in `home-tiles.tsx`:**
    - Delete the `COMMUNITY_URL` constant, its comment and the `ClassCommunity` import.
    - The rows become `communities.slice(0, 2)` mapped to `{ key: url, href: url, title: COMMUNITY_SCOPE_TITLE[scope], subtitle: label }`. The existing new-tab row markup and `CommunityGlyph` stay.
    - When `communities.length > 2`, close the card with a `TILE_FOOT_LINK` `Link` to `/dashboard/communities` reading "All communities", with `<Chevron />` (ruling 7).
    - Rewrite the doc comment's community sentence around D26.
  - **`app/(platform)/dashboard/page.tsx`:** pass `communities={myCommunities(enrollments)}` and drop the `classCommunities` import.

- [ ] **Step 8: Create `app/(platform)/dashboard/communities/page.tsx`** (RSC).
  - **Data:** `export const metadata = { title: "Communities" }`; `const links = myCommunities(await fetchMyEnrollments())`.
  - **Shell:** `<Topbar title="Communities" />`, with the recordings page's container classes. `PageHeader` (`@/components/shared/page-header`): title "Communities", subline "Your program, school and Academy groups — relationships beyond your classes. Each opens in a new tab."
  - **List:** a `CardShell` holding `TILE_ROWS`. Each row is the `SupportTile` new-tab anchor (`TILE_ROW` from `components/dashboard/tile-bits.tsx`, which has no `"use client"`). It shows:
    - a 40 px `bg-primary/[0.12]` chip with the scope's glyph, `text-primary`: program `BookOpen01Icon`, school `Mortarboard01Icon`, academy `UserMultiple02Icon`, executive `Award01Icon`;
    - `COMMUNITY_SCOPE_TITLE[scope]` over `label`;
    - `LinkSquare02Icon`;
    - the `sr-only` "(opens in a new tab)".
  - **Empty:** `EmptyState` (no `icon` prop: functions can't cross to a client component) with title "No community links yet" and description "Links to your program, school and Academy communities appear here when they're ready."

- [ ] **Step 9: Verify.** Restart with the Task 3 variables. Then run `reset-student`, `assess-fixture` and `community "Forex Trading Mastery" https://t.me/wma-forex-fixture`.
  - Run: `text /dashboard/communities student | grep -oE "Program community|Forex Trading Mastery|School community|Academy community|WorldStreet Mastery Academy|Executive community" | sort -u`
    Expected: exactly `Academy community`, `Forex Trading Mastery`, `Program community` and `WorldStreet Mastery Academy`. There is no school row, because every school link is null, and no Executive row on a Standard plan.
  - Run: `curl -s -b mock_persona=student $BASE/dashboard/communities | grep -oE '<a [^>]*href="https://t\.me/wma-(forex|academy)-fixture"[^>]*>' | grep -c 'rel="noopener noreferrer"'`
    Expected: `2`. Both anchors also carry `target="_blank"`.
  - Run `mockdb.cjs plan executive`, then repeat the first command.
    Expected: it now also prints `Executive community`.
  - Run: `ptext /dashboard student "Help & community" | grep -oE "Program community|Academy community|All communities" | sort -u`
    Expected: all three, because three links make the tile show two plus the foot link.

- [ ] **Step 10: The private link stays private.** Run `mockdb.cjs plan standard` and `mockdb.cjs enroll-status "Forex Trading Mastery" refunded`. Then give the student access elsewhere with `prior-paid "Crypto Trading Mastery"`.
  Run: `text /dashboard/communities student | grep -c "t.me/wma-forex-fixture"`
  Expected: `0`. The Academy row still shows.

- [ ] **Step 11: Look at it.** At 1440 and 390 px, in dark and light, the rows wrap without horizontal scroll and the tile's rows sit side by side at full width.

- [ ] **Step 12: Typecheck, lint and commit.**

```bash
npx tsc --noEmit
for f in lib/communities.ts lib/schools.ts lib/actions/student.ts lib/dashboard-home.ts components/dashboard/home-tiles.tsx "app/(platform)/dashboard/page.tsx" "app/(platform)/dashboard/communities/page.tsx"; do npx eslint "$f"; done
git add lib/communities.ts lib/schools.ts lib/actions/student.ts lib/dashboard-home.ts components/dashboard/home-tiles.tsx "app/(platform)/dashboard/page.tsx" "app/(platform)/dashboard/communities/page.tsx"
git commit -m "feat(portal): Communities — program, school and Academy groups on one page (D26)"
```

---

### Task 4: The portal's navigation (§11) and the Campus

**Files:**
- Create: `lib/hooks/queries/use-notifications.ts`
- Modify: `lib/hooks/queries/index.ts`, `components/shared/notification-bell.tsx`, `components/platform/app-sidebar.tsx`, `app/(platform)/dashboard/notifications/page.tsx`, `app/(platform)/dashboard/meetings/page.tsx`, `app/(platform)/dashboard/points/page.tsx`, `components/dashboard/learning-hero.tsx`

**Interfaces:**
- Consumes: `/dashboard/assessments` (Task 2) and `/dashboard/communities` (Task 3).
- Produces:
  - `export const NOTIFICATION_FEED_LIMIT = 40`.
  - `useNotificationFeed()`: `useQuery<NotificationFeed>` with `queryKey: queryKeys.notifications`, `queryFn: () => getMyNotifications(NOTIFICATION_FEED_LIMIT)`, `staleTime: 30_000` and `refetchInterval: 120_000`. These are the bell's current options, moved.

- [ ] **Step 1: Check first.** Run `reset-student`, then `assess-fixture`.
  Run: `ptext /dashboard student "Learn" 1440 "[data-slot=sidebar-inner]" | grep -cxE "Assessments|Inbox|Communities|My classes"`
  Expected: `0`.

- [ ] **Step 2: The shared feed.** Create `use-notifications.ts` per the interface, in the style of `use-assessments.ts`, and export both names from `index.ts`. In `NotificationBell`, replace the `useQuery({ queryKey: queryKeys.notifications, … })` call with `const { data, isLoading } = useNotificationFeed()`. Delete `BELL_LIMIT`, and drop `useQuery` from the import when nothing else uses it.

- [ ] **Step 3: `app-sidebar.tsx`** (§11).
  - **`learnItems`**, in order:
    - Dashboard and My programs, unchanged.
    - `{ title: "My classes", href: "/dashboard/meetings", icon: Calendar03Icon, match: (p) => p.startsWith("/dashboard/meetings") }`.
    - Recordings, moved from Connect unchanged.
    - Assignments, unchanged.
    - `{ title: "Assessments", href: "/dashboard/assessments", icon: ClipboardCheckIcon, match: (p) => p.startsWith("/dashboard/assessments") }`.
    - `{ title: "My points", href: "/dashboard/points", icon: ChampionIcon, match: (p) => p === "/dashboard/points" }`.
    - Certificates.

    Mentorship and Teach still append after them.
  - **`connectItems`**, in order:
    - `{ title: "Inbox", href: "/dashboard/notifications", icon: Inbox, match: (p) => p === "/dashboard/notifications" }`.
    - Messages.
    - `{ title: "Communities", href: "/dashboard/communities", icon: UserMultiple02Icon, match: (p) => p === "/dashboard/communities" }`.
  - **Badge.** `const inboxUnread = useNotificationFeed().data?.unreadCount ?? 0`. In `badgeFor`: `if (item.href === "/dashboard/notifications" && inboxUnread > 0) return { label: inboxUnread > 99 ? "99+" : String(inboxUnread), spoken: \`${inboxUnread} unread\`, tone: "brand" }`. The meetings "live" badge keys on the href, so it follows My classes.
  - **Imports and comments.** Fix the icon import: add the four glyphs, and drop any the linter reports unused. Add a line to the `learnItems` comment citing institutional blueprint §11.

- [ ] **Step 4: Titles** (ruling 9).
  - **`notifications/page.tsx`:** `<Topbar title="Inbox" breadcrumbOverrides={{ notifications: "Inbox" }} />`, and the `PageHeader` `title="Inbox"`.
  - **`meetings/page.tsx`:** after `const canStart = user.role !== "USER"`, add `const pageTitle = canStart ? "Meetings" : "My classes"`. Then `<Topbar title={pageTitle} breadcrumbOverrides={{ meetings: pageTitle }} />` and `PageHeader title={pageTitle}`.
  - **`points/page.tsx`:** metadata `title: "My points"`, then `<Topbar title="My points" breadcrumbOverrides={{ points: "My points" }} />` and `PageHeader title="My points"`.

- [ ] **Step 5: The Campus (D19).** In `HomeGreeting` (`learning-hero.tsx`), the eyebrow `<p>` starts with the text `WMA Campus · `, then the existing date or its invisible placeholder. Add a comment: D19, the dashboard is the Campus; eyebrow only, and the nav keeps "Dashboard".

- [ ] **Step 6: Verify.**
  - **Learn order.** Run: `ptext /dashboard student "Learn" 1440 "[data-slot=sidebar-inner]" | grep -nxE "Dashboard|My programs|My classes|Recordings|Assignments|Assessments|My points|Certificates"`
    Expected: the eight lines in that order. The fixture's progress is 100, so no row carries a count.
  - **Connect rows.** Opening the Inbox also opens Connect. Run: `ptext /dashboard/notifications student "Inbox" 1440 "[data-slot=sidebar-inner]" | grep -xE "Inbox|Messages|Communities"`
    Expected: all three.
  - **The badge.** Run `mockdb.cjs notify`, reload `/dashboard/notifications` in the browser, and check that the sidebar's Inbox row shows `1`. Press "Mark all read": the badge disappears without a reload, and the topbar bell's count clears with it.
  - **Titles.**
    - Run: `ptext /dashboard/meetings student "My classes" | grep -c "My classes"` → at least `1`. As `instructor`, `/dashboard/meetings` reads "Meetings".
    - Run: `curl -s -b mock_persona=student $BASE/dashboard/points | grep -o "<title>[^<]*</title>"` → it contains `My points`.
  - **Campus.** Run: `ptext /dashboard student "WMA Campus" | grep -oE "WMA Campus · [A-Z][a-z]+day, [A-Z][a-z]+ [0-9]+"`
    Expected: one line.
  - **Shapes.** At 390 px, the menu sheet lists the same rows. At 1440 px, the collapsed rail's tooltips read "Assessments", "Inbox" and "Communities". Each new page lights only its own row.

- [ ] **Step 7: Typecheck, lint and commit.**

```bash
npx tsc --noEmit
for f in lib/hooks/queries/use-notifications.ts lib/hooks/queries/index.ts components/shared/notification-bell.tsx components/platform/app-sidebar.tsx "app/(platform)/dashboard/notifications/page.tsx" "app/(platform)/dashboard/meetings/page.tsx" "app/(platform)/dashboard/points/page.tsx" components/dashboard/learning-hero.tsx; do npx eslint "$f"; done
git add lib/hooks/queries/use-notifications.ts lib/hooks/queries/index.ts components/shared/notification-bell.tsx components/platform/app-sidebar.tsx "app/(platform)/dashboard/notifications/page.tsx" "app/(platform)/dashboard/meetings/page.tsx" "app/(platform)/dashboard/points/page.tsx" components/dashboard/learning-hero.tsx
git commit -m "feat(portal): every §11 item in the sidebar — My classes, Assessments, Inbox, Communities; the WMA Campus"
```

---

### Task 5: The welcome email (§10, D27)

**Files:**
- Modify: `lib/db/models/user.ts`, `lib/email.tsx`, `lib/actions/enrollments.ts`, `lib/actions/manual-payments.ts`
- Create: `lib/welcome-email.ts`

**Interfaces:**
- Produces:
  - `IUser.welcomedAt: Date | null`, with schema `welcomedAt: { type: Date, default: null }`. Its doc comment: "When the one-time welcome email was claimed (D27); null = never. Additive, web-only: Go ignores it."
  - In `lib/email.tsx`: `export type WelcomeEmailData = { to: string; firstName: string; /** "Monday 16 November" while a cohort is upcoming; null omits the line. */ cohortStartLabel: string | null }`, and `sendWelcomeEmail(data: WelcomeEmailData): Promise<{ success: true } | { success: false; error: string }>`. The function follows `sendEnrollmentConfirmationEmail`'s shape, and its logs read `[Email] Welcome failed:` and `[Email] Welcome error:`.
  - In `lib/welcome-email.ts` (`import "server-only"`): `sendWelcomeOnce(userId: string, enrollmentId: string): Promise<void>`, which never throws.
- Consumes: `cohortIsUpcoming` and `COHORT_DATE_LABEL` (`lib/cohort.ts`, ruling 13); `appUrl`; the portal labels from Task 4.

- [ ] **Step 1: Check first.**
  Run: `grep -rn "welcomedAt\|sendWelcome" lib app`
  Expected: nothing.

- [ ] **Step 2: The model field** in `lib/db/models/user.ts`, placed after `referralCode` in both the interface and the schema.

- [ ] **Step 3: `lib/email.tsx`.**
  - **Placement.** Add `WelcomeEmail` and `sendWelcomeEmail` after `sendEnrollmentConfirmationEmail`, built with the same template pieces (`base`, `body`, `card`, `contentPad`, `heading`, `sub`, `muted`, `cta`, `linkSmall`, `footer`).
  - **Subject:** `` `Welcome to ${BRAND.name}` ``. **Preview:** "Your WMA Student Portal is ready".
  - **Body,** in order. `portalUrl = appUrl("/dashboard")`.
    1. Heading: `` `Welcome to ${BRAND.name}` ``.
    2. `sub`: `` `${data.firstName ? `${data.firstName}, your` : "Your"} payment is confirmed and your place at the Academy is ready.` ``
    3. `sub`: "Sign in at <Link href={portalUrl}>{portalUrl}</Link> with <strong>{data.to}</strong> and the password of your WorldStreet account."
    4. When `cohortStartLabel` is set, `sub`: "Your cohort begins on <strong>{cohortStartLabel}</strong>."
    5. `sub` with `fontWeight: 600`: "Your WMA Student Portal". Then one `sub` per `PORTAL_MAP` row: `<Link href={appUrl(path)}><strong>{label}</strong></Link> — {body}`.
    6. `muted`: "What each page holds depends on the plan you chose."
    7. The `Button`: "Open the Student Portal" → `portalUrl`. Then the house `Hr` and `linkSmall` with `portalUrl`, and the footer `BRAND.name`.

```ts
/** The Student Portal, in §11's order — the labels are the sidebar's (keep them in step). */
const PORTAL_MAP = [
  { label: "My programs", path: "/dashboard/my-courses", body: "Your lessons and your progress." },
  { label: "My classes", path: "/dashboard/meetings", body: "Live classes and their times." },
  { label: "Recordings", path: "/dashboard/recordings", body: "Past live classes, to watch again." },
  { label: "Assignments", path: "/dashboard/assignments", body: "Practical work to hand in." },
  { label: "Assessments", path: "/dashboard/assessments", body: "Knowledge checks and final exams." },
  { label: "My points", path: "/dashboard/points", body: "Points you earn as you learn." },
  { label: "Communities", path: "/dashboard/communities", body: "Your program, school and Academy groups." },
] as const
```

  - **"The WMA Student Portal"** (ruling 12). Two strings change:
    - In `EnrollmentConfirmationEmail`, the sign-in sentence's closing words "your dashboard." (after "to open") become "the WMA Student Portal."
    - In `sendEspeeProofReceivedEmail`, "Your dashboard opens once it&apos;s confirmed" becomes "The WMA Student Portal opens once it&apos;s confirmed".

    Update that function's doc comment to match.

- [ ] **Step 4: Create `lib/welcome-email.ts`.** Its doc comment cites §10 and D27, says it is fire-and-forget like `lib/notify.ts`, and explains ruling 11. `sendWelcomeOnce(userId, enrollmentId)` runs inside one `try`, whose `catch` logs `[Welcome] failed:`:
  1. `await connectDB()`.
  2. `current = Enrollment.findOne({ _id: enrollmentId, user: userId }).select("pricePaid purchasedAt").lean()`. Return unless `current` exists and `current.pricePaid > 0`.
  3. `cutoff = current.purchasedAt ?? new Date()`. If `Enrollment.exists({ user: userId, _id: { $ne: enrollmentId }, pricePaid: { $gt: 0 }, $or: [{ purchasedAt: { $lt: cutoff } }, { purchasedAt: null }] })`, return: an earlier paid enrollment means this is not the first.
  4. `User.updateOne({ _id: userId, welcomedAt: null }, { $set: { welcomedAt: new Date() } })`. Return unless `modifiedCount === 1`. (`null` matches a missing field, and the filter is the atomic claim.)
  5. `console.info("[Welcome] claimed", userId)`.
  6. Load the user's `email firstName`. Return if there is no email.
  7. `await sendWelcomeEmail({ to, firstName: firstName ?? "", cohortStartLabel: cohortIsUpcoming() ? COHORT_DATE_LABEL : null })`. The claim is never released (at most once).

- [ ] **Step 5: The call sites.** Exactly one import and one call per file.
  - **`lib/actions/enrollments.ts`, in `purchaseCourse` only.** This is the `void sendEnrollmentConfirmationEmail({` whose object holds `availableAtIso: null,`; `preEnrollCourse`'s call is not touched. Right after it, add:
    ```ts
    // D27: one welcome on the learner's first paid enrollment — after the confirmation, never awaited.
    if (isPaid) void sendWelcomeOnce(user.id, enrollment._id.toString())
    ```
  - **`lib/actions/manual-payments.ts`,** right after the `void sendEnrollmentConfirmationEmail({` in `adminApproveEspeePayment`, add the same comment and `void sendWelcomeOnce(learnerId, enrollmentId)`.
  - Run: `git diff --stat lib/actions/enrollments.ts lib/actions/manual-payments.ts`
    Expected: only additions. The diff shows the import, the comment and the call in each file, and nothing else.

- [ ] **Step 6: Typecheck and lint.**

```bash
npx tsc --noEmit
for f in lib/db/models/user.ts lib/email.tsx lib/welcome-email.ts lib/actions/enrollments.ts lib/actions/manual-payments.ts; do npx eslint "$f"; done
```

- [ ] **Step 7: Start the Task 5 server.** Run the wallet stub and restart with the Task 5 variables (the schema changed), logging to `"$SCRATCH/dev.log"`. Get the ids with `mockdb.cjs ids`. Define `claims() { grep -c "\[Welcome\] claimed" "$SCRATCH/dev.log"; }`. `pw-buy.cjs <courseId> <package> [<courseId> <package>]` opens each `/dashboard/checkout?courseId=…&package=…` as `student` in its own page, clicks the button whose name starts with "Pay $" on all of them at once (`Promise.all`), and waits for `**/dashboard/checkout/success**` on each.

- [ ] **Step 8: Verify.**
  - **a. A first wallet purchase sends one.** `reset-student`; `before=$(claims)`; `pw-buy $FOREX basic`.
    Expected:
    - `claims` is `before + 1`;
    - `probe` shows a `welcomedAt`;
    - `curl -s 127.0.0.1:<WALLETPORT>/__state` shows one 4900 charge.

    Then `pw-buy $CRYPTO basic`: `claims` doesn't change.
  - **b. Email failure is invisible to the buyer.** In run a, the success page loaded, and `grep -cE "\[Email\] Welcome (failed|error)" "$SCRATCH/dev.log"` is at least `1` (the disabled key). `welcomedAt` stayed set.
  - **c. A pre-release payer gets none.** `reset-student`; `prior-paid "Crypto Trading Mastery"`; `before=$(claims)`; `pw-buy $FOREX basic`.
    Expected: `claims` equals `before`, and `probe` shows no `welcomedAt`.
  - **d. Simultaneous first purchases send exactly one.** `reset-student`; `before=$(claims)`; `pw-buy $FOREX basic $CRYPTO basic`.
    Expected: both reach success, and `claims` is `before + 1`.
  - **e. A first ESPEE approval sends one, and a second sends none.**
    1. `reset-student`, then `ID=$(mockdb.cjs espee-proof "Forex Trading Mastery")` and `before=$(claims)`.
    2. `pw-approve.cjs $ID` opens `/admin/payments/espee/$ID` as `admin`, clicks "Approve" then "Approve & open program", and waits for "Approved. The program is open and the learner has been emailed."
       Expected: `claims` is `before + 1`.
    3. Then `ID2=$(mockdb.cjs espee-proof "Crypto Trading Mastery")` and `pw-approve.cjs $ID2`.
       Expected: `claims` doesn't change.

- [ ] **Step 9: Commit.**

```bash
git add lib/db/models/user.ts lib/email.tsx lib/welcome-email.ts lib/actions/enrollments.ts lib/actions/manual-payments.ts
git commit -m "feat(email): one welcome to the WMA Student Portal on a learner's first paid enrollment (D27)"
```

---

### Task 6: A signed-out checkout keeps its place (§10)

**Files:**
- Modify: `middleware.ts`, `lib/auth/login-url.ts`, `app/(checkout)/layout.tsx`

**Interfaces:**
- Produces:
  - The request header `x-next-search`: the request's `nextUrl.search` (`""` or `"?…"`), set beside `x-next-pathname` on every request the middleware passes on.
  - `checkoutReturnPath(pathname: string | null, search: string | null): string` in `lib/auth/login-url.ts`. It returns `pathname` (plus `search` when that starts with `"?"` and is longer than one character) if `pathname` is exactly `/dashboard/checkout` or starts with `/dashboard/checkout/`. Otherwise it returns `"/dashboard/checkout"`.

- [ ] **Step 1: Check first.**
  Run: `grep -c "x-next-search" middleware.ts; grep -c "loginUrl" "app/(checkout)/layout.tsx"`
  Expected: `0` and `0`.

- [ ] **Step 2: Write `$SCRATCH/t6-return.ts`.**

```ts
import assert from "node:assert/strict"
import { checkoutReturnPath, loginUrl } from "@/lib/auth/login-url"

assert.equal(checkoutReturnPath("/dashboard/checkout", "?courseId=abc&package=standard"), "/dashboard/checkout?courseId=abc&package=standard")
assert.equal(checkoutReturnPath("/dashboard/checkout/pending", ""), "/dashboard/checkout/pending")
assert.equal(checkoutReturnPath(null, null), "/dashboard/checkout")
assert.equal(checkoutReturnPath("//evil.example/x", "?a=1"), "/dashboard/checkout")
assert.equal(checkoutReturnPath("/dashboard/checkoutx", ""), "/dashboard/checkout")
assert.equal(checkoutReturnPath("/dashboard/checkout", "courseId=abc"), "/dashboard/checkout")
assert.equal(checkoutReturnPath("/dashboard/checkout", "?"), "/dashboard/checkout")
const back = "https%3A%2F%2Facademy.worldstreetgold.com%2Fdashboard%2Fcheckout%3FcourseId%3Dabc%26package%3Dstandard"
assert.equal(loginUrl("/dashboard/checkout?courseId=abc&package=standard"), `https://www.worldstreetgold.com/login?redirect=${back}&redirect_url=${back}`)
console.log("checkout return: all assertions passed")
```

- [ ] **Step 3: Run it to see it fail.**
  Run: `env -u NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY npx tsx --tsconfig ./tsconfig.json "$SCRATCH/t6-return.ts"`
  Expected: FAIL, because `checkoutReturnPath` is not exported.

- [ ] **Step 4: Implement.**
  - **`middleware.ts`:** after `requestHeaders.set("x-next-pathname", pathname)`, add `requestHeaders.set("x-next-search", request.nextUrl.search)`. Extend the comment above it: server components read the query string from it.
  - **`lib/auth/login-url.ts`:** add `checkoutReturnPath` per its interface, with a doc comment: only a checkout path, so the return can never be steered elsewhere.
  - **`app/(checkout)/layout.tsx`:** import `headers` from `next/headers` and `{ checkoutReturnPath, loginUrl }`. The body of `if (!user)` becomes:
    ```ts
    const h = await headers()
    redirect(loginUrl(checkoutReturnPath(h.get("x-next-pathname"), h.get("x-next-search"))))
    ```
    `redirect()` throws by design, so nothing wraps it.
  - **The layout's doc comment:** replace "The local-dev Clerk branch is mirrored from `(platform)/layout.tsx`; keep them in step." with a sentence saying the fallback returns the visitor to this checkout through `loginUrl()`, which mirrors `middleware.ts` and its `pk_test_` switch.

- [ ] **Step 5: Run it to see it pass.**
  Run: `env -u NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY npx tsx --tsconfig ./tsconfig.json "$SCRATCH/t6-return.ts"`
  Expected: `checkout return: all assertions passed`.

- [ ] **Step 6: Drive it.** Use the base server (no wallet), run `reset-student`, and take `$FOREX` from `ids`.
  - Run: `curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" -b mock_persona=guest "$BASE/dashboard/checkout?courseId=$FOREX&package=basic"`
    Expected: `307 $BASE/login?redirect_url=%2Fdashboard%2Fcheckout%3FcourseId%3D$FOREX%26package%3Dbasic`.
  - Run: `text "/dashboard/checkout?courseId=$FOREX&package=basic" student | grep -oE 'Forex Trading Mastery|[$]49' | sort -u`
    Expected: both. The return path opens the plan the visitor chose, even with payments off.
  - Run: `curl -s -o /dev/null -w "%{http_code}\n" -b mock_persona=instructor "$BASE/dashboard?welcome=1"`
    Expected: `200`. The new header leaves the `(platform)` gate alone.
  - In mock mode the layout's own branch is unreachable: middleware answers a guest first, and a mock persona always resolves a user. It is proven by the assertions and by review.

- [ ] **Step 7: Typecheck, lint and commit.**

```bash
npx tsc --noEmit
for f in middleware.ts lib/auth/login-url.ts "app/(checkout)/layout.tsx"; do npx eslint "$f"; done
git add middleware.ts lib/auth/login-url.ts "app/(checkout)/layout.tsx"
git commit -m "fix(checkout): a signed-out visitor returns to the plan they chose after signing in"
```

---

### Task 7: Vivid's routes, docs, and the closing run

**Files:**
- Modify: `lib/vivid/prompt.ts`, `docs/go-patches-phase-3.md`, `docs/launch-runbook.md`, `docs/institutional-blueprint-plan.md`, `docs/mastery-academy-plan.md`, `context.md`

**Interfaces:** none.

- [ ] **Step 1: Vivid** (`lib/vivid/prompt.ts`).
  - In `getPageContext`, after the `/dashboard/assignments` line, add:
    - `/dashboard/assessments` → "their assessments — knowledge checks and final exams";
    - `/dashboard/communities` → "their program, school and Academy communities";
    - `/dashboard/notifications` → "their inbox".
  - In ROUTES, extend the line that starts `/dashboard/recordings | /dashboard/assignments` with ` | /dashboard/assessments | /dashboard/communities | /dashboard/notifications — inbox`.

- [ ] **Step 2: The Go note** in `docs/go-patches-phase-3.md`: a new last section, `## <next>. Phase 15 — the welcome email (institutional blueprint §10, D27)` (ruling 16).
  - "Go needs no patch."
  - **`users.welcomedAt`** is a date or `null` (missing = `null`). It is web-only, and Go may ignore it.
    - The web claims it with a filtered update (`{ _id, welcomedAt: null }`) before sending the one-time "Welcome to WorldStreet Mastery Academy" email, after a learner's first paid enrollment (a wallet purchase or an ESPEE approval).
    - If Go ever sends that welcome, it must claim the same field the same way first.
    - Any wholesale user write must keep it.

- [ ] **Step 3: The runbook,** `docs/launch-runbook.md` §3.
  - The `NEXT_PUBLIC_COMMUNITY_URL` row's note becomes: "The Academy community, shown to every learner with an open program, on `/dashboard/communities` and the dashboard's Help & community tile. Inlined at build: tick "Build Variable" and redeploy after any change. Unset → no Academy row."
  - Add a row: `NEXT_PUBLIC_EXECUTIVE_COMMUNITY_URL` | Optional | **Build** | "The Executive community, shown only to learners on an Executive plan. Build variable, as above. Unset → hidden."
  - Below the table, add one line: school community links are code (`communityUrl` on each school in `lib/schools.ts`). Product supplies them, and a deploy ships them.

- [ ] **Step 4: Status.**
  - In `docs/institutional-blueprint-plan.md`, tick Phase 15's three exit criteria and set its row in §3's table to done, with the date and commit count. Also set its row in `docs/mastery-academy-plan.md`'s status board.
  - Add a dated entry to `context.md`: the §11 sidebar (My classes, Assessments, My points, Inbox, Communities), the split of Assessments from Assignments, the Communities page (D26), the welcome email (D27, first paid enrollment only, at most once), the WMA Campus eyebrow, and the checkout return path.

- [ ] **Step 5: The closing run.** Start the server with the wallet stub and both community variables, and run `reset-student` then `assess-fixture`.
  - **Pages.** At 1440 and 390 px, in dark and light, as `student`: `/dashboard`, `/dashboard/assessments`, `/dashboard/assignments`, `/dashboard/communities`, `/dashboard/notifications`, `/dashboard/meetings` and `/dashboard/points`.
    Expected:
    - no horizontal scroll (`document.documentElement.scrollWidth <= innerWidth`);
    - no console errors apart from the known Vivid 403;
    - the sidebar's active row is right on each page.
  - **Exit criteria.** Walk the three from `docs/institutional-blueprint-plan.md`:
    1. Every §11 item is in the sidebar, and both new pages are live (Tasks 2–4).
    2. One welcome per first payment, and none on a second (Task 5, step 8 a and e).
    3. The checkout return (Task 6, step 6).

- [ ] **Step 6: Whole-repo checks.**
  - Run: `pnpm lint 2>&1 | tail -3`. Expected: no more problems than Task 1's baseline.
  - Run: `npx tsc --noEmit`. Expected: clean.
  - Run: `git diff feat/institutional HEAD -- mocks lib/dev scripts/dev lib/wallet.ts`. Expected: nothing (ruling 15).

- [ ] **Step 7: Commit.**

```bash
npx eslint lib/vivid/prompt.ts
git add lib/vivid/prompt.ts docs/go-patches-phase-3.md docs/launch-runbook.md docs/institutional-blueprint-plan.md docs/mastery-academy-plan.md context.md
git commit -m "docs: Phase 15 — the portal, communities and the welcome email; Vivid knows the new pages"
```

## Report (end of phase)

Read out Phase 15's exit criteria from `docs/institutional-blueprint-plan.md`, and add:
- **The Review Focus results,** with the claim counts from Task 5, step 8.
- **For the controller:**
  - The main checkout's `CLAUDE.md` (git-excluded, so absent from worktrees) needs two edits: its middleware sentence should name `x-next-search` beside `x-next-pathname`, and `lib/communities.ts` joins the "each fact has one home" list.
  - At merge, Phase 12 swaps the welcome's cohort line to its own reader (ruling 13), and Phase 13 keeps `School.communityUrl` (ruling 6).
- **For the owner:**
  - Set `NEXT_PUBLIC_EXECUTIVE_COMMUNITY_URL` in Coolify, and confirm `NEXT_PUBLIC_COMMUNITY_URL`. Both are build variables.
  - School community links are content debt, owed by product.
  - The welcome is sent only to learners whose first paid enrollment happens after this release.
