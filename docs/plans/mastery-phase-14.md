# Mastery Academy — Phase 14 Implementation Plan (Plans to the blueprint)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every program's three plans are institutional blueprint §9's: Basic — Foundation (4 weeks), Standard — Mastery (8–12 weeks), Executive — Personalized Mastery (Flexible schedule), each with §9's inclusions. A Basic learner can watch recordings, submit assignments, sit the final exam and receive a Certificate of Completion. Basic still can't join live classes or start a thread with the instructor, and no existing learner loses access.

**Architecture:**
- **Access.** A new `recordings` entitlement. Its one rule is `recordingsAllowed` in `lib/entitlements.ts`: the flag, or live classes, so plans saved before the flag keep their recordings. `entitlementsFor` and the public program read model return the effective value. The recordings actions gate on it instead of `liveClasses`.
- **Data.** Basic's new services are data. `scripts/mastery-catalogue.mjs` writes §9's plans. Its dry run now diffs every plan field, and an `--apply` that would remove access refuses without `--allow-access-loss`. The exam, assignment and certificate gates already read `certificate` and `assignments` from data, so they need no code change.
- **UI.** "Recorded classes" joins every list of what a plan includes. The tagline (§9's "Foundation" / "Mastery" / "Personalized Mastery") sits beside the tier label. The program page's "Your learning experience" follows §9.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict · MongoDB/Mongoose · Zod (`zod/v4`) · Tailwind v4 with the WorldStreet design system (`ds/`, `ws-*` tokens) · a plain `.mjs` maintenance script.

**Spec:** `docs/institutional-blueprint.md` §9. **Roadmap:** `docs/institutional-blueprint-plan.md` Phase 14, decision D23. The owner answered it on 2026-10-19: yes, as the blueprint says, with the signal-group line kept on Executive.

**Branch:** `mastery/phase-14`, in Track B's worktree (15 → 16 → 14 → 17), cut from `feat/institutional` at the track's current tip.

## Controller rulings (binding)

1. **Plan `name`s stay program-specific**: "Forex Foundation", "Forex Mastery", "Private Forex Mentorship", and `${subject} Foundation` and so on for the generic ten.
   - §9's words go in two places:
     - **`tagline`:** "Foundation", "Mastery", "Personalized Mastery".
     - **The tier label:** `PACKAGE_LABEL`. `executive` changes from "Executive 101" to "Executive". `PLAN.executive.label` in the script is already "Executive".
   - The roadmap's "Executive: name 'Executive'" means that label.
   - Why names stay: they are snapshotted on every `Enrollment.packageName`, and runbook §6 greps for them.
2. **No `--update-plans` flag.** Verified: on a MATCH, the script `$set`s `packages` wholesale, so a re-run already rewrites every plan's name, tagline, duration, features and entitlements, not only prices. What it lacks is visibility and a brake. Task 2 adds two things:
   - per-plan diff lines in the dry run;
   - an access-loss gate: an `--apply` that would turn off a flag an existing plan has exits 1 unless `--allow-access-loss` is passed.

   The runbook step is: dry run, then `--apply`. The roadmap's "`--apply --update-plans`" is corrected in Task 8.
3. **Features are §9 verbatim, the same for all 12 programs** (lists pinned in Task 2). They replace the Forex and Crypto spec lists and the generic lists. Those programs' subject lines live on in `whatYouWillLearn`.
   - Standard's mentorship line reads "Mentorship in your live cohort" (D23: group mentorship, copy only).
   - Executive keeps the two owner promises that §9 lacks: "Lifetime mentorship access" and "Access to the signal group" (D23).
   - "Private one-on-one classes with a personal tutor" is dropped, because §9's "Dedicated/private tutor" and "One-on-one sessions" say the same. The phase report lists this for the owner.
4. **`recordings` is appended last** in the interface, the Mongoose schema, `FULL_ACCESS`, every `NO_ENTITLEMENTS`, `PackageSchema` and the script's flag objects. Script-written and editor-written documents then share one key order, and re-runs stay idempotent.
5. **Effective, not stored.**
   - `entitlementsFor` returns a fresh object whose `recordings` is `recordingsAllowed(stored)`.
   - `findProgram` does the same for `PublicPackage.entitlements`.
   - The three gates in `lib/actions/recordings.ts` still call `recordingsAllowed(...)` explicitly (roadmap 14.1).
   - Only a raw `course.packages[i].entitlements.recordings` is the stored flag. Never gate on it.
6. **Editor.** The "Recorded classes" box shows `recordingsAllowed(...)`. It is disabled while Live classes is ticked, because live classes always carry their recordings. A live-class plan always posts `recordings: true`.
7. **Recordings surfaces.**
   - The student sidebar's Recordings link is already unconditional. The roadmap's "Recordings link condition" does not exist, so `components/platform/app-sidebar.tsx` (a Phase 15/18 file) is not touched.
   - The dashboard's class band (`getMyClassBoard`) stays live-class only. Its states (join, countdown, cohort start) mean nothing to a Basic learner.
   - Basic reaches recordings through the sidebar's Recordings page and the program page's "Past classes".
8. **The final exam stays gated on `certificate`**; no "assessments" flag is added. Basic now has `certificate`, so on an `examRequired` program, Basic completion now waits for the exam, exactly as Standard's does.
9. **Basic enrollments completed before the apply** on an `examRequired` program will certify without having sat the exam. This is accepted (D23: "existing Basic buyers gain"). The runbook counts them, read-only, before the apply; the expected count is 0.
10. **Tagline placement.** Wherever a tier label shows, the tagline follows it on the same line as `— Foundation`, in normal case (§9 reads "BASIC — Foundation"), and the separate tagline line under the name goes. That covers:
    - the chooser's option card and breakdown;
    - the dashboard ladder card;
    - the checkout row.

    Single-tier offers (`SingleOffer`, `SinglePackage`, a checkout row with no label) keep the tagline where it is.
11. **"Recorded classes"** joins all four service lists, right after "Live classes", with `VideoReplayIcon` (the sidebar's Recordings glyph): `package-model.ts`, `package-ladder.tsx`, `purchase-panel.tsx`, `order-lines.ts`. The checkout success page gains one step, for recorded classes without live classes.
12. **No persona is added.** `mocks/clerk`, `scripts/dev/` and `lib/dev/` never change on a branch bound for main (`git diff origin/main HEAD -- mocks lib/dev scripts/dev lib/wallet.ts` must stay empty). The Basic learner is the seeded `student` persona with a fixture enrollment, written by a throwaway script in the scratch directory.
13. **Vocabulary.** Lines this phase writes or rewrites say "plan". Other existing "package" strings stay for the final vocabulary pass, for example meetings.ts's "Live classes aren't included in your package".
14. **Track order.** If Phase 15 or 16 landed first on this track, a quoted anchor may have moved. Apply the same change to the same construct, and never revert their edits.
15. **`CLAUDE.md` is git-excluded.** After the merge, the controller adds `--allow-access-loss` to the catalogue bullet in the main checkout's `CLAUDE.md`. Implementers don't.

## Global Constraints

- **Data:**
  - Schema changes are additive only: the Go mobile API reads the same MongoDB. No renamed fields, no new enum values on existing fields, no new role or status values. `recordings` is a new boolean field, `default: false`.
  - **Money is untouched.** Prices, `listPrice`, the price gate and the checkout charge stay as they are. Money is integer cents through `lib/wallet.ts` and fails closed.
  - **Paid files.** Recordings play only as a 10-minute signed GET from `R2_RESOURCES_BUCKET_NAME`. Never write or link a paid file in the public bucket, and never expose `storageKey`.
- **Server actions:**
  - They follow `connectDB()` → auth/ownership → Zod (`import { z } from "zod/v4"`) → mutate → `revalidatePath()` → return `{ success: true, data } | { success: false, error }`. They never throw across the boundary.
  - User ids come from `getCurrentUser()`, never the browser.
  - Admin actions use `requireAdmin()`. Role gates live in each route group's `layout.tsx`, not middleware.
  - Imports use `@/*`.
- **Code:** no new dependencies, no `any`, no secrets. Never edit `ds/` (vendored).
- **UI:**
  - Use the WorldStreet design system: `ws-*` tokens only, never a hex.
  - Gold is only for primary CTAs, active nav and brand moments.
  - Icons only via `@/components/icons` (duotone glyphs; never lucide, Hugeicons or emoji).
  - Base UI composition uses the `render` prop, never `asChild`.
  - Pills, 20 px cards, Manrope. `pb-24 md:pb-8` inside `(platform)`. `·` separators. `tabular-nums` for money and counts.
  - RSC-first: `"use client"` only where interaction needs it.
- **Wording:**
  - Copy the spec's wording verbatim where it gives wording.
  - New user-facing strings use the new vocabulary (plan, not package). Don't rename existing strings outside this phase's scope.
- **Database scripts:** dry run by default, and `--apply` writes. Always put `MONGODB_URI=` on the command line. Production runs are the owner's, through `docs/launch-runbook.md`.
- **Checks:**
  - No test runner exists, and none may be added.
  - Pure rules: a throwaway `node:assert/strict` script in `$SCRATCH` (`SCRATCH=$(mktemp -d)`, outside the repo), run from the worktree root with `npx tsx --tsconfig ./tsconfig.json "$SCRATCH/<file>.ts"`.
  - Everything else: `npx tsc --noEmit` (one stale `.next/types` error is not real), `npx eslint <file>` one changed file at a time, and driving the route.
- Anchors below are **quoted text**, never line numbers.

## Review Focus

1. **Plans saved before the flag.** A Standard or Executive plan with live classes and no `recordings` key must keep its recordings. Covered in Task 1, step 4 (asserts), and Task 7, step 6 (`standard --legacy`).
2. **A paid-access leak.** Once Basic gains its other services, a Basic learner must still be refused a live class and a new thread with the instructor. Covered in Task 7, steps 4–5.
3. **Basic on an exam-required program.** Completion waits for the exam, the exam stays locked until every lesson is done, and the certificate appears only after a pass. Covered in Task 7, step 3.
4. **A catalogue re-run revoking access that was granted by hand.** Covered in Task 2, step 6.
5. **The editor round-trip.** Zod strips unknown keys, so a save must keep `recordings`, and a live-class plan can't be saved without it. Covered in Task 4, step 4.

## Verification server

Each track runs its own `dev:mock` in its own worktree, on its own ports; the controller fills `<PORT>` and `<DBPORT>`. The three R2 placeholders on the last launch line let recording playback mint a signed URL offline (presigning makes no network call). Keep them on for every task.

```bash
netstat -ano | grep -E ":<PORT>|:<DBPORT>"      # must print nothing first
RESEND_API_KEY=re_disabled_local CLOUDFLARE_REALTIME_API_KEY=disabled-local OPENAI_API_KEY=disabled-local \
ABLY_API_KEY=disabled-local R2_SECRET_ACCESS_KEY=disabled-local WALLET_SERVICE_TOKEN=disabled-local \
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_bG9jYWwuZGV2JA MOCK_DB_PORT=<DBPORT> PORT=<PORT> \
R2_RESOURCES_BUCKET_NAME=mock-private CLOUDFLARE_ACCOUNT_ID=mock R2_ACCESS_KEY_ID=disabled-local node scripts/dev-mock.mjs
MONGODB_URI=mongodb://127.0.0.1:<DBPORT>/worldstreet-academy node scripts/mastery-catalogue.mjs --apply
```

- **Before you start:**
  - Run the server in the background.
  - The worktree has no `.env.local`; that is intended.
  - The mock DB persists in the worktree's `.local-db`, so a restart keeps the catalogue and the fixture.
- **Personas:** the `mock_persona` cookie switches them: `guest`, `student`, `instructor`, `admin`.
- **Known dev noise:**
  - The dev "1 Issue" badge is the Vivid 403.
  - A hydration warning on query pages predates this phase.
  - A killed `dev:mock` can leave `next` and `mongod` running, so re-run the `netstat` check.
- Stop the server when the task is done.

```bash
BASE=http://localhost:<PORT>
DB="MONGODB_URI=mongodb://127.0.0.1:<DBPORT>/worldstreet-academy"
SCRATCH=$(mktemp -d)
text() { curl -s ${2:+-b "mock_persona=$2"} "$BASE$1" | perl -0pe 's#<script\b.*?</script>##gs; s#<style\b.*?</style>##gs; s#<[^>]+># #g; s#&\#x27;#\x27#g; s#&quot;#"#g; s#&amp;#&#g; s#\s+# #g'; }
```

**Playwright** is installed globally, not in the project. Harnesses are `.cjs` files in `$SCRATCH`, run with `node "$SCRATCH/<file>.cjs"`, and start with:

```js
const { chromium } = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright")
const BASE = process.env.BASE
async function as(browser, persona) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.addCookies([{ name: "mock_persona", value: persona, url: BASE }])
  return ctx.newPage()
}
```

**The fixture.** Create `$SCRATCH/fixture.ts`. It is idempotent, and each run resets the student's progress on Forex.

- **Needs:** the catalogue applied.
- **Usage:** `env $DB npx tsx --tsconfig ./tsconfig.json "$SCRATCH/fixture.ts" [basic|standard|executive] [--legacy]` (`--legacy` unsets the chosen plan's stored `recordings`).
- **Prints:** one JSON line of ids.

```ts
import connectDB from "@/lib/db"
import { Assignment, Conversation, Course, Enrollment, Exam, ExamAttempt, Lesson, Meeting, Question, Recording, Submission, User } from "@/lib/db/models"
import type { PackageKey } from "@/lib/db/models"

async function main() {
  const plan = (process.argv[2] ?? "basic") as PackageKey
  const legacy = process.argv.includes("--legacy")
  const m = await connectDB()
  const course = await Course.findOne({ title: "Forex Trading Mastery" })
  const student = await User.findOne({ email: "student@worldstreet.academy" })
  if (!course || !student) throw new Error("Start dev:mock and apply the catalogue first")
  const host = course.instructor
  if (legacy) {
    await Course.updateOne({ _id: course._id }, { $unset: { "packages.$[p].entitlements.recordings": "" } }, { arrayFilters: [{ "p.key": plan }] })
  }
  const lessonIds: string[] = []
  for (const [order, title] of ["Fixture lesson 1", "Fixture lesson 2"].entries()) {
    const l = await Lesson.findOneAndUpdate({ course: course._id, title },
      { $setOnInsert: { type: "text", content: "<p>Fixture lesson.</p>", order, isPublished: true, isFree: false, minPackageKey: null } },
      { upsert: true, new: true })
    lessonIds.push(l._id.toString())
  }
  await Course.updateOne({ _id: course._id }, { $set: { examRequired: true } })
  const exam = await Exam.findOneAndUpdate({ course: course._id, scope: "final" },
    { $setOnInsert: { instructor: host, title: "Fixture final", status: "published", questionCount: 1, totalPoints: 1,
      settings: { durationMinutes: 30, passMarkPercent: 70, maxAttempts: 3, shuffleQuestions: false, shuffleOptions: false, showResults: true } } },
    { upsert: true, new: true })
  await Question.updateOne({ exam: exam._id },
    { $setOnInsert: { type: "single", prompt: "Pick A", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correctOptionIds: ["a"], points: 1, order: 0 } },
    { upsert: true })
  const assignment = await Assignment.findOneAndUpdate({ course: course._id, title: "Fixture assignment" },
    { $setOnInsert: { instructor: host, instructions: "Write one line.", status: "published" } }, { upsert: true, new: true })
  const meeting = await Meeting.findOneAndUpdate({ courseId: course._id, title: "Fixture class" },
    { $set: { status: "scheduled", scheduledAt: new Date(Date.now() + 86_400_000) }, $setOnInsert: { hostId: host, meetingId: "fixture-room", hostToken: "fixture-token" } },
    { upsert: true, new: true })
  await Recording.updateOne({ rtkRecordingId: "fixture-rec-1" },
    { $setOnInsert: { meeting: meeting._id, course: course._id, host, status: "stored", storageKey: "worldstreet-academy/recordings/fixture/fixture.mp4",
      durationSeconds: 1800, recordedAt: new Date(), title: "Fixture class recording", hidden: false } },
    { upsert: true })
  const pkg = course.packages.find((p) => p.key === plan)
  await Enrollment.updateOne({ user: student._id, course: course._id },
    { $set: { status: "active", packageKey: plan, packageName: pkg?.name ?? null, pricePaid: pkg?.price ?? 0, activatedAt: new Date(), progress: 0,
      completedLessons: [], lastAccessedLesson: null, completedAt: null, examPassed: false, examPassedAt: null, bestScorePercent: null, certificateId: null } },
    { upsert: true })
  await Promise.all([
    ExamAttempt.deleteMany({ user: student._id, course: course._id }),
    Submission.deleteMany({ user: student._id, assignment: assignment._id }),
    Conversation.deleteMany({ participants: { $all: [student._id, host] } }),
  ])
  console.log(JSON.stringify({ plan, legacy, courseId: course._id.toString(), lessonIds, examId: exam._id.toString(),
    assignmentId: assignment._id.toString(), meetingId: meeting._id.toString(), hostId: host.toString() }))
  await m.disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
```

**The inspector.** `$SCRATCH/inspect.ts` is run the same way. It prints Forex's plans as `{ key, tagline, duration, entitlements }`, the student's Forex enrollment (`status packageKey progress examPassed certificateId`), and `threads`, the `Conversation.countDocuments({ participants: { $all: [student._id, course.instructor] } })`. It has the same `main()` wrapper, and `.lean()` reads.

## File structure

| File | Responsibility |
|---|---|
| `lib/db/models/course.ts` (modify) | `recordings` on `IPackageEntitlements` and the package schema |
| `lib/entitlements.ts` (modify) | `recordingsAllowed`; effective `recordings` from `entitlementsFor`; `FULL_ACCESS`; `PACKAGE_LABEL.executive` |
| `lib/actions/student.ts`, `lib/actions/instructor.ts` (modify) | Read models and `PackageSchema` carry the flag |
| `scripts/mastery-catalogue.mjs` (modify) | §9 plans, plan diff, `--allow-access-loss` |
| `lib/actions/recordings.ts` (modify) | Recordings gate on `recordingsAllowed` |
| `components/instructor/package-editor.tsx` (modify) | "Recorded classes" box, plan copy |
| `components/programs/package-model.ts`, `package-chooser.tsx`, `package-ladder.tsx`, `purchase-panel.tsx`, `whats-included.tsx` (modify) | Plan cards |
| `components/checkout/order-lines.ts`, `order-summary.tsx`, `app/(checkout)/dashboard/checkout/success/page.tsx` (modify) | Checkout lists and success step |
| Six comment-only files (Task 7) | Stale "(Basic)" comments |
| `docs/go-patches-phase-3.md`, `docs/launch-runbook.md`, `docs/institutional-blueprint-plan.md`, `docs/mastery-academy-plan.md`, `context.md` (modify) | Go note, owner steps, status |

---

### Task 1: The `recordings` entitlement and the Executive label

**Files:**
- Modify:
  - `lib/db/models/course.ts`, `lib/entitlements.ts`
  - `lib/actions/student.ts`, `lib/actions/instructor.ts`
  - `components/instructor/package-editor.tsx` (the `NO_ENTITLEMENTS` literal only)
  - `components/programs/package-model.ts` (the ladder-less `servicesOf` literal only)
  - `components/programs/package-chooser.tsx` (`SERVICE_ICON` only)

**Interfaces:**
- Produces:
  - **The type and schema.** `IPackageEntitlements.recordings: boolean`, appended after `prioritySupport`. In the schema it is `recordings: { type: Boolean, default: false }`, appended after `prioritySupport: { type: Boolean, default: false },`.
  - **The rule.** `recordingsAllowed(ent: { recordings?: boolean | null; liveClasses?: boolean | null } | null | undefined): boolean` returns `Boolean(ent?.recordings || ent?.liveClasses)`.
  - **`entitlementsFor(course, enrollment): IPackageEntitlements`** returns a fresh object. It reads each of the seven flags by name as `Boolean(stored.x)`, and sets `recordings` to `recordingsAllowed(stored)`. It never spreads a subdocument. It still returns `FULL_ACCESS` for a null key or a missing package.
  - **`FULL_ACCESS.recordings`** is `true`.
  - **`PACKAGE_LABEL.executive`** is `"Executive"`. Its doc comment becomes "Plan names (institutional blueprint §9) as the program page and editor print them."
  - **`PublicPackage.entitlements.recordings`** (from `findProgram`) is effective: `{ ...NO_ENTITLEMENTS, ...p.entitlements, recordings: recordingsAllowed(p.entitlements) }`.
  - **`PackageSchema.entitlements`** gains `recordings: z.boolean().default(false)`.
  - **The editor read model.** The mapping in `lib/actions/instructor.ts` gains `recordings: Boolean(p.entitlements?.recordings)`, appended after `prioritySupport: Boolean(p.entitlements?.prioritySupport),`.
  - **The other literals:**
    - each `NO_ENTITLEMENTS` gains `recordings: false`;
    - the ladder-less `servicesOf` literal gains `recordings: false`, because a ladder-less program promises only Q&A and the certificate;
    - `SERVICE_ICON` gains `recordings: VideoReplayIcon`.

- [ ] **Step 1: Check first.**
  Run: `grep -rn "recordings" lib/db/models/course.ts lib/entitlements.ts; grep -n 'executive: "Executive 101"' lib/entitlements.ts`
  Expected: no `recordings` hits, and one `Executive 101` hit.
  Record the baseline for Task 8: `pnpm lint 2>&1 | tail -3`.

- [ ] **Step 2: The model.** In `lib/db/models/course.ts`, append the field to the interface and the schema as the Interfaces block says. The interface's comment "What a package unlocks beyond the lessons themselves (spec §6 ladder)." gains a line: "`recordings` (institutional blueprint §9, 2026-10-19): recorded classes; read it through `recordingsAllowed`, since plans saved before it carry only `liveClasses`."

- [ ] **Step 3: `lib/entitlements.ts`.**
  - Add `recordingsAllowed` above `entitlementsFor`, with a doc comment naming the legacy rule.
  - Change `entitlementsFor` per the Interfaces block, and update its doc comment ("…`recordings` is always the effective value").
  - Add `recordings: true` to `FULL_ACCESS` and set `PACKAGE_LABEL.executive`.

  Then make every literal the type now requires complete (the Files list). Run `npx tsc --noEmit`. It must name no file outside the Files list. If it does, add `recordings` there the same way and record it in the task report.

- [ ] **Step 4: Assert the rules.** Create `$SCRATCH/t1-entitlements.ts`:

```ts
import assert from "node:assert/strict"
import { FULL_ACCESS, PACKAGE_LABEL, entitlementsFor, recordingsAllowed } from "@/lib/entitlements"
import type { ICoursePackage } from "@/lib/db/models"

const off = { liveClasses: false, instructorQa: false, assignments: false, certificate: false, mentorship: false, prioritySupport: false }
const plan = (key: string, entitlements: object) =>
  ({ key, name: key, tagline: "", price: 1, listPrice: null, duration: null, features: [], highlight: false, ctaLabel: null, enabled: true, entitlements }) as unknown as ICoursePackage

assert.equal(recordingsAllowed({ liveClasses: false }), false)
assert.equal(recordingsAllowed({ liveClasses: true }), true, "a plan saved before the flag keeps its recordings")
assert.equal(recordingsAllowed({ liveClasses: false, recordings: true }), true)
assert.equal(recordingsAllowed(null), false)
assert.equal(recordingsAllowed(undefined), false)

const legacy = { packages: [
  plan("basic", off),
  plan("standard", { ...off, liveClasses: true, instructorQa: true, assignments: true, certificate: true }),
  plan("executive", { ...off, liveClasses: true, recordings: false }),
] }
assert.equal(entitlementsFor(legacy, { packageKey: "basic" }).recordings, false)
assert.equal(entitlementsFor(legacy, { packageKey: "standard" }).recordings, true)
assert.equal(entitlementsFor(legacy, { packageKey: "executive" }).recordings, true, "stored false + live classes = recordings")
assert.deepEqual(entitlementsFor(legacy, { packageKey: null }), FULL_ACCESS)
assert.deepEqual(entitlementsFor({ packages: [plan("basic", off)] }, { packageKey: "executive" }), FULL_ACCESS, "a deleted tier is grandfathered")
assert.equal(FULL_ACCESS.recordings, true)
assert.deepEqual(
  Object.keys(entitlementsFor(legacy, { packageKey: "basic" })).sort(),
  ["assignments", "certificate", "instructorQa", "liveClasses", "mentorship", "prioritySupport", "recordings"],
)
const d23 = { packages: [plan("basic", { ...off, assignments: true, certificate: true, recordings: true })] }
assert.deepEqual(entitlementsFor(d23, { packageKey: "basic" }),
  { ...off, assignments: true, certificate: true, recordings: true }, "Basic per D23: no live classes, no Q&A")
assert.equal(PACKAGE_LABEL.executive, "Executive")
console.log("entitlements: all assertions passed")
```

  Run: `npx tsx --tsconfig ./tsconfig.json "$SCRATCH/t1-entitlements.ts"`
  Expected: `entitlements: all assertions passed`

- [ ] **Step 5: Typecheck, lint, and check the read model.**
  Run: `npx tsc --noEmit`, then `npx eslint` on each changed file, one at a time.
  Expected: clean.
  Start the verification server.
  Run: `curl -s -o /dev/null -w "%{http_code}\n" $BASE/programs/forex-trading-mastery; text /programs/forex-trading-mastery | grep -c "Executive 101"`
  Expected: `200` and `0`.

- [ ] **Step 6: Commit.**

```bash
git add lib/db/models/course.ts lib/entitlements.ts lib/actions/student.ts lib/actions/instructor.ts components/instructor/package-editor.tsx components/programs/package-model.ts components/programs/package-chooser.tsx
git commit -m "feat(plans): a recordings entitlement — recorded classes, kept by every live-class plan"
```

---

### Task 2: The catalogue writes §9's plans, shows what changes, and won't take access away

**Files:**
- Modify: `scripts/mastery-catalogue.mjs`

**Interfaces:**
- Consumes: the `recordings` field (Task 1). The script duplicates shapes literally; it can't import TypeScript.
- Produces:
  - **New flag `--allow-access-loss`.**
  - **Dry-run and apply output.** Each MATCH prints one `  plan <key>: …` line per plan, after its `  plans (enabled prices):` line.
  - **The gate.** `ABORT: --apply would remove access from existing plan(s)…`, with exit 1 and no write.

- [ ] **Step 1: Check first.** The verification block has already applied the unchanged script, which is the Phase 10 state.
  Run: `env $DB node scripts/mastery-catalogue.mjs | grep -c "^  plan "`
  Expected: `0`.

- [ ] **Step 2: Flags and the three plans.**
  - **Flag objects.** Add `recordings` (last) to every flag object:
    - `FULL`: `recordings: true`.
    - `STANDARD_TIER`: `recordings: true`.
    - New `BASIC_TIER`: `{ liveClasses: false, instructorQa: false, assignments: true, certificate: true, mentorship: false, prioritySupport: false, recordings: true }`, with the comment "Basic (institutional blueprint §9, D23): recorded classes, assignments, assessments and the certificate — no live classes, no instructor Q&A."
    - Delete `NONE`, which is now unused.
  - **`PLAN`.**
    - Every plan gains `tagline` and `features`.
    - basic: `tagline: "Foundation"`, `duration: "4 weeks"`, `entitlements: BASIC_TIER`, `features: BASIC_FEATURES`.
    - standard: `tagline: "Mastery"`, `duration: "8–12 weeks"` (en dash), `features: STANDARD_FEATURES`.
    - executive: `tagline: "Personalized Mastery"`, `duration: "Flexible schedule"`, `features: EXECUTIVE_FEATURES`.
    - Prices, list prices, `highlight` and `ctaLabel` are unchanged.
  - **The lists**, verbatim (ruling 3), replacing `EXECUTIVE_PROMISE`:

```js
const BASIC_FEATURES = [
  "Foundation lessons", "Core concepts", "Selected recorded classes", "Learning materials", "Student community",
  "Basic assignments", "Basic assessments", "Student dashboard", "Certificate of completion where applicable",
]
const STANDARD_FEATURES = [
  "Everything in Basic", "Beginner-to-advanced curriculum", "Full live cohort", "Practical assignments", "Projects",
  "Instructor interaction", "Assessments", "Mentorship in your live cohort", "Advanced resources and community",
]
const EXECUTIVE_FEATURES = [
  "Everything in Standard", "Dedicated/private tutor", "One-on-one sessions", "Personalized learning plan",
  "Flexible scheduling", "Individual feedback", "Private mentorship", "Progress reviews", "Personalized projects",
  "Executive community", "Premium support", "Lifetime mentorship access", "Access to the signal group",
]
```

  - **Builders.**
    - `ladder(names)` takes `{ basic, standard, executive }` name strings, and takes tagline, features, entitlements and the rest from `PLAN`.
    - `genericLadder(subject)` becomes `ladder({ basic: \`${subject} Foundation\`, standard: \`${subject} Mastery\`, executive: \`Private ${subject} Mentorship\` })`.
    - `forexPackages` is `ladder({ basic: "Forex Foundation", standard: "Forex Mastery", executive: "Private Forex Mentorship" })`.
    - `cryptoPackages` is `ladder({ basic: "Crypto Foundation", standard: "Crypto Mastery", executive: "Private 1-on-1 Crypto Mentorship" })`.
    - Delete `FOREX_BASIC_FEATURES`, `FOREX_STANDARD_FEATURES`, `FOREX_EXECUTIVE_FEATURES` and `CRYPTO_BASIC_FEATURES`. Keep the `*_WYL` lists.

- [ ] **Step 3: The plan diff and the access gate.**
  - **The diff.** Add `diffPlans(current, next)`. It returns `{ lines: string[], losses: string[] }` and runs in Pass 1 for each MATCH, on `existing.packages ?? []` and the new `packages`. For each new plan key, in ladder order, it adds one line:
    - `plan <key>: new`, when the row has no plan with that key;
    - `plan <key>: unchanged`, when nothing other than price and list price differs;
    - otherwise `plan <key>: ` followed by the changed segments, joined by ` · `, in this order:
      - `name "<a>" -> "<b>"`
      - `tagline "<a>" -> "<b>"`
      - `duration <a> -> <b>`, where a value prints as `"<text>"`, or `none` for null
      - `enabled <a> -> <b>`
      - the flags, as `+flag` / `-flag` in `FULL`'s key order, comparing `Boolean(cur.entitlements?.[flag])` with the new value
      - `features rewritten (<n> -> <m> lines)`, when the arrays differ
  - **Losses.** Each `-flag` adds `"<key>.<flag>"` to `losses`.
  - **Printing.** Pass 2 prints the lines, indented two spaces, after `plans (enabled prices):`.
  - **The access gate.** Right after the price gate, in the same style and also before any write: when `APPLY`, some MATCH has losses and `--allow-access-loss` is absent, print the block below, one line per program, then disconnect and exit 1.

```
ABORT: --apply would remove access from existing plan(s) — learners on them would lose it. Re-run with --allow-access-loss only on the owner's written go:
  - <title> (_id <id>): <losses joined by ", ">
No documents were written.
```

- [ ] **Step 4: Words.**
  - **Header comment.** In the "On MATCH this $sets…" paragraph, say that `packages` is replaced wholesale: every plan's name, tagline, duration, features and entitlements, not only prices. Rewrite the "Plans (owner meeting, 2026-10-03)" paragraph and the comment above `const PLAN` around §9 and D23, covering:
    - durations 4 weeks / 8–12 weeks / Flexible schedule;
    - Basic = recorded classes, assignments, assessments and the certificate;
    - one §9 feature list per plan for every program;
    - the two kept Executive promises.

    Add an `--allow-access-loss` bullet under "Production-safety guards".
  - **The WARNING box.** "Programs that sold one full-access package now start at Basic, which has" / "no live classes, Q&A, assignments or certificate (full access = Executive)." becomes "Basic now includes recorded classes, assignments, assessments and the" / "certificate, but no live classes or instructor Q&A (full access = Executive)."

- [ ] **Step 5: Verify the upgrade on the mock DB.**
  Run: `env $DB node scripts/mastery-catalogue.mjs > "$SCRATCH/dry.log"; grep -c "^  plan " "$SCRATCH/dry.log"; grep "^  plan " "$SCRATCH/dry.log" | head -3`
  Expected: `36`. Then, for Forex (the first program), exactly these three lines:

```
  plan basic: tagline "Perfect for beginners" -> "Foundation" · duration none -> "4 weeks" · +assignments +certificate +recordings · features rewritten (10 -> 9 lines)
  plan standard: tagline "Designed for learners who want a comprehensive Forex education pathway." -> "Mastery" · duration "9 weeks" -> "8–12 weeks" · +recordings · features rewritten (14 -> 9 lines)
  plan executive: tagline "A premium one-on-one learning experience." -> "Personalized Mastery" · duration "9 weeks" -> "Flexible schedule" · +recordings · features rewritten (13 -> 13 lines)
```

  Run: `grep -cE " -(liveClasses|instructorQa|assignments|certificate|mentorship|prioritySupport|recordings)\b|ABORT" "$SCRATCH/dry.log"`
  Expected: `0`.
  Run: `env $DB node scripts/mastery-catalogue.mjs --apply | tail -2; env $DB node scripts/mastery-catalogue.mjs --apply | grep -c "^  plan .*: unchanged"; env $DB node scripts/mastery-catalogue.mjs --apply | tail -1`
  Expected:
  - the first apply ends `Total modifiedCount across matched rows: 12`;
  - then `36`;
  - then `Total modifiedCount across matched rows: 0`.
  `env $DB npx tsx --tsconfig ./tsconfig.json "$SCRATCH/inspect.ts"` shows Forex's plans as Foundation/4 weeks, Mastery/8–12 weeks and Personalized Mastery/Flexible schedule. Basic's entitlements read `assignments`, `certificate` and `recordings` true and the other four false.

- [ ] **Step 6: Verify the access gate** (Review Focus 4). Grant Basic live classes by hand, as an admin's editor save could:

```bash
env $DB node --input-type=module -e 'import mongoose from "mongoose"; await mongoose.connect(process.env.MONGODB_URI); await mongoose.connection.db.collection("courses").updateOne({ title: "Forex Trading Mastery" }, { $set: { "packages.$[p].entitlements.liveClasses": true } }, { arrayFilters: [{ "p.key": "basic" }] }); await mongoose.disconnect()'
env $DB node scripts/mastery-catalogue.mjs | grep "^  plan basic" | head -1
env $DB node scripts/mastery-catalogue.mjs --apply; echo "exit $?"
```

  Expected:
  - the dry run's first Basic line is `  plan basic: -liveClasses`;
  - the `--apply` prints the ABORT block naming `Forex Trading Mastery (_id …): basic.liveClasses`, then `No documents were written.` and `exit 1`. The gate runs before Pass 2, so no plan lines print;
  - `inspect.ts` still shows basic `liveClasses: true`.

  Then run `env $DB node scripts/mastery-catalogue.mjs --apply --allow-access-loss | tail -1`. It modifies 1 row, and a re-run modifies 0.

- [ ] **Step 7: Lint and commit.**

```bash
npx eslint scripts/mastery-catalogue.mjs
git add scripts/mastery-catalogue.mjs
git commit -m "feat(catalogue): the institutional blueprint's three plans — a per-plan diff and an access-loss gate"
```

---

### Task 3: Recordings follow the plan

**Files:**
- Modify:
  - `lib/actions/recordings.ts`
  - `app/(platform)/dashboard/courses/[courseId]/page.tsx` (comment only)
  - `app/(platform)/dashboard/recordings/page.tsx` (comment only)

**Interfaces:**
- Consumes: `recordingsAllowed`, and `entitlementsFor` returning the effective flag (Task 1). Basic plans have `recordings: true` (Task 2).
- Produces: the same action signatures. `getRecordingPlayback`'s refusal reads "Recordings are for students whose plan includes recorded classes".

- [ ] **Step 1: Check first.**
  Run the catalogue `--apply`, then the fixture (`basic`). As `student`, open `$BASE/dashboard/recordings` with Playwright and read the page text.
  Expected: "No class recordings yet". The gates still read `liveClasses`.

- [ ] **Step 2: The three gates.** Import `recordingsAllowed` beside `entitlementsFor`.
  - `recordingAccess`: `return access?.entitlements.liveClasses ? "student" : null` becomes `return access && recordingsAllowed(access.entitlements) ? "student" : null`.
  - `listableCourseIds`: `entitlementsFor(course, e).liveClasses` becomes `recordingsAllowed(entitlementsFor(course, e))`.
  - `listMyRecordings`: `if (!access?.entitlements.liveClasses) return { success: true, data: [] }` becomes `if (!access || !recordingsAllowed(access.entitlements)) return { success: true, data: [] }`.
  - The refusal string becomes "Recordings are for students whose plan includes recorded classes".
  - **Comments.** Rewrite the header ("Students whose package includes live classes watch them…") and the `recordingAccess`, `listableCourseIds` and `listMyRecordings` doc comments around "plan includes recorded classes (`recordingsAllowed`)". Also update the two page comments: "only when the package includes live classes" in `courses/[courseId]/page.tsx`, and "for programs whose package includes live classes" in `recordings/page.tsx`.

- [ ] **Step 3: Verify.** As `student`, with `await page.route("**/*.r2.cloudflarestorage.com/**", () => {})` so the signed URL is held, not failed:
  - `/dashboard/recordings` shows "Fixture class recording".
  - Clicking it renders `video[src*="fixture.mp4"]` (count `1`).
  - `/dashboard/courses/<courseId>` shows "Past classes" with the same title.

  As `guest`, `/dashboard/recordings` redirects to sign-in, as today.

- [ ] **Step 4: Typecheck, lint, commit.**

```bash
npx tsc --noEmit
npx eslint lib/actions/recordings.ts
npx eslint "app/(platform)/dashboard/courses/[courseId]/page.tsx"
npx eslint "app/(platform)/dashboard/recordings/page.tsx"
git add lib/actions/recordings.ts "app/(platform)/dashboard/courses/[courseId]/page.tsx" "app/(platform)/dashboard/recordings/page.tsx"
git commit -m "feat(recordings): recorded classes follow the plan, not live classes"
```

---

### Task 4: The editor offers "Recorded classes"

**Files:**
- Modify: `components/instructor/package-editor.tsx`

**Interfaces:**
- Consumes: `recordingsAllowed` (Task 1), and `PackageSchema` accepting `recordings` (Task 1).
- Produces: `toEditorPackage` and `toCoursePackage` always carry the effective `recordings`.

- [ ] **Step 1: Check first.** As `admin`, open `$BASE/admin/courses/<courseId>/edit` (Forex, from the fixture output) and scroll to "Packages".
  Expected: no "Recorded classes" label.

- [ ] **Step 2: Implement.**
  - **The checkbox.**
    - In `ENTITLEMENT_LABELS`, add `{ key: "recordings", label: "Recorded classes" }` right after `liveClasses`.
    - In the `ENTITLEMENT_LABELS.map` row, for `key === "recordings"`: `checked={recordingsAllowed(pkg.entitlements)}`, `disabled={pkg.entitlements.liveClasses}`, and, while disabled, ` · with live classes` after the label in `text-muted-foreground`.
  - **The two converters.** In both, `recordings` comes last:
    - `toEditorPackage`: `entitlements: { ...NO_ENTITLEMENTS, ...p.entitlements, recordings: recordingsAllowed(p.entitlements) }`.
    - `toCoursePackage`: `entitlements: { ...p.entitlements, recordings: recordingsAllowed(p.entitlements) }`.
  - **Copy:**
    - The intro "Up to three tiers — Basic, Standard and Executive 101. While any tier is enabled the course sells from the cheapest enabled tier and the Pricing section below follows it." becomes "Up to three plans — Basic, Standard and Executive. While any plan is enabled the course sells from the cheapest enabled plan and the Pricing section below follows it."
    - Placeholders: the tagline's `"Perfect for beginners"` becomes `"Foundation"`, and the duration's `"9 weeks"` becomes `"4 weeks"`.
    - Under the Tagline input, add `<p className="text-[10px] text-muted-foreground">A word or two shown beside the plan's name, e.g. Foundation.</p>`.

- [ ] **Step 3: Verify the boxes.** As `admin`, on Forex's edit page:
  - There are three "Recorded classes" checkboxes. Basic's is checked and enabled; Standard's and Executive's are checked and disabled, and read "· with live classes".
  - Unticking Standard's Live classes enables its Recorded classes, still ticked.
  - Reload without saving.

- [ ] **Step 4: Verify the round-trip** (Review Focus 5). Untick Basic's Recorded classes and click "Save changes".
  Expected: `inspect.ts` shows basic `recordings: false`; standard and executive stay `true`. As `student`, `/dashboard/recordings` reads "No class recordings yet".
  Tick it again, save, and confirm `true`.
  Then run the catalogue `--apply`.
  Expected: `Total modifiedCount across matched rows: 0`. Under ruling 4, the editor and the script write one key order. A `1` means the orders drifted: fix the order, don't accept it.

- [ ] **Step 5: Typecheck, lint, commit.**

```bash
npx tsc --noEmit
npx eslint components/instructor/package-editor.tsx
git add components/instructor/package-editor.tsx
git commit -m "feat(editor): Recorded classes on every plan, locked on while live classes are"
```

---

### Task 5: "Recorded classes" wherever a plan's services are listed

**Files:**
- Modify:
  - `components/programs/package-model.ts`, `components/programs/package-ladder.tsx`, `components/programs/purchase-panel.tsx`
  - `components/checkout/order-lines.ts`
  - `app/(checkout)/dashboard/checkout/success/page.tsx`

**Interfaces:**
- Consumes: the effective `PublicPackage.entitlements.recordings` and `CourseAccess.entitlements.recordings` (Task 1).
- Produces: a `{ key: "recordings", label: "Recorded classes" }` entry right after `liveClasses` in `SERVICES` (package-model), `COMPARED` (package-ladder), `SERVICES` (purchase-panel, `icon: VideoReplayIcon`) and `SERVICES` (order-lines, `icon: VideoReplayIcon`). `grantedServices` and `packageServices` therefore include `"recordings"`.

- [ ] **Step 1: Check first.**
  Run: `text /programs/forex-trading-mastery | grep -c "Recorded classes"`
  Expected: `0`.

- [ ] **Step 2: The four lists.** Add the entry in each file, and fix the counting comments: "The six services…" becomes "The seven services…" in `package-model.ts` and `package-ladder.tsx`, and "comparison table of the six entitlements" becomes "…seven…".

- [ ] **Step 3: The success page.** After the `if (services.has("liveClasses")) {` step, add:

```tsx
if (services.has("recordings") && !services.has("liveClasses")) {
  steps.push({
    icon: VideoReplayIcon,
    title: "Recorded classes",
    body: "Your program's class recordings play under Recordings in your dashboard.",
  })
}
```

- [ ] **Step 4: Verify.**
  - **Program page.** Run: `text /programs/forex-trading-mastery | grep -o "Recorded classes" | wc -l`
    Expected: at least `4`: the purchase panel's list once, plus each tier's breakdown in the chooser (every tier renders into the HTML).
  - **The chooser.** In the browser, as `guest`: Basic's breakdown shows "Recorded classes", "Graded assignments" and "Certificate of completion" as included, and "Live classes" and "Instructor Q&A" as "With Standard". "Compare packages" (the existing label, which the vocabulary pass renames) opens a table with a "Recorded classes" row ticked for all three.
  - **Checkout.** As `student`, `text "/dashboard/checkout?courseId=<Crypto Trading Mastery id>&package=basic" student | grep -c "Recorded classes"` is at least `1`. Get the id with `inspect.ts`, or from `/programs/crypto-trading-mastery`'s checkout link.
  - **The success page, Basic.** With the `basic` fixture, `text "/dashboard/checkout/success?courseId=<courseId>" student | grep -oE "Recorded classes|Earn your certificate|Live classes" | sort -u` prints `Earn your certificate` and `Recorded classes` only.
  - **The success page, Standard.** Re-run the fixture with `standard`; then it prints `Earn your certificate` and `Live classes` only. Re-run the fixture with `basic` afterwards.

- [ ] **Step 5: Typecheck, lint, commit.**

```bash
npx tsc --noEmit
npx eslint components/programs/package-model.ts
npx eslint components/programs/package-ladder.tsx
npx eslint components/programs/purchase-panel.tsx
npx eslint components/checkout/order-lines.ts
npx eslint "app/(checkout)/dashboard/checkout/success/page.tsx"
git add components/programs/package-model.ts components/programs/package-ladder.tsx components/programs/purchase-panel.tsx components/checkout/order-lines.ts "app/(checkout)/dashboard/checkout/success/page.tsx"
git commit -m "feat(plans): Recorded classes on every list of what a plan includes"
```

---

### Task 6: The plans read like §9

**Files:**
- Modify:
  - `components/programs/package-chooser.tsx`, `components/programs/package-ladder.tsx`
  - `components/checkout/order-summary.tsx`
  - `components/programs/whats-included.tsx`

**Interfaces:**
- Consumes: the catalogue's taglines (Task 2).
- Produces: the shared markup of ruling 10. After the tier label's span comes a sibling `{pkg.tagline && <span className="text-[13px] font-medium normal-case tracking-normal …">— {pkg.tagline}</span>}`. Its colour follows the label's (selected → `text-ws-primary`, otherwise `text-ws-muted`).

- [ ] **Step 1: Check first.**
  Run: `text /programs/forex-trading-mastery | grep -oE "— (Foundation|Mastery|Personalized Mastery)|Basic plan|Executive 101" | sort -u`
  Expected: nothing.

- [ ] **Step 2: `package-chooser.tsx`.**
  - **`OptionCard`.** Add the tagline span right after the `{PACKAGE_LABEL[pkg.key]}` span, before the "Most popular" chip. Delete the separate `{pkg.tagline && (` / `<span className="mt-1.5 block text-pretty text-[13.5px] leading-relaxed text-ws-muted">{pkg.tagline}</span>` block under the price row.
  - **`Breakdown`.** The `<p>` holding `{PACKAGE_LABEL[pkg.key]} package` becomes a `flex flex-wrap items-baseline gap-x-2` row. Its first span keeps the eyebrow classes and reads `{PACKAGE_LABEL[pkg.key]} plan`, followed by the tagline span.
  - **`SingleOffer`** is unchanged.
  - **Comments.** In the `ServiceGrid` comment, "With Executive 101" becomes "With Executive". The `OptionCard` comment says the tagline sits beside the label.

- [ ] **Step 3: `package-ladder.tsx` and `order-summary.tsx`.**
  - **Ladder card.** In the multi-tier card, the `{PACKAGE_LABEL[pkg.key]}` eyebrow `<p>` becomes a `flex flex-wrap items-baseline gap-x-2` row: its eyebrow classes move to an inner label span, and the tagline span follows it. Delete the tagline line that follows `<h3 className="mt-3 font-display text-xl font-semibold text-ws-primary">{pkg.name}</h3>`. `SinglePackage` keeps its own tagline line.
  - **Ladder comment.** "(BASIC / STANDARD / EXECUTIVE 101)" becomes "(BASIC / STANDARD / EXECUTIVE)".
  - **`PackageRow`.** When `line.label` is set, render the tagline span beside the chip, before "Most popular", and render the `{pkg.tagline && (` paragraph under the name only when `!line.label`.

- [ ] **Step 4: `whats-included.tsx` (§9).**
  - The doc comment cites "institutional blueprint §9".
  - `INCLUDED` becomes these twelve, in order:
    - "Foundation lessons" `SquarePlayIcon`
    - "Beginner-to-advanced curriculum" `ListChecksIcon`
    - "Recorded classes" `VideoReplayIcon`
    - "Full live cohort" `RadioIcon`
    - "Learning materials" `DownloadIcon`
    - "Assignments" `ClipboardListIcon`
    - "Assessments" `CircleHelpIcon`
    - "Projects" `BriefcaseIcon`
    - "Instructor interaction" `CompassIcon`
    - "Mentorship" `HandshakeIcon`
    - "Student community" `UsersIcon`
    - "Certificate of completion" `AwardIcon`
  - The closing note reads "Specific inclusions vary by program and plan."
  - Drop the now-unused imports.

- [ ] **Step 5: Verify the words.**
  Run: `text /programs/forex-trading-mastery | grep -oE "— Foundation|— Mastery|— Personalized Mastery|Basic plan|4 weeks|8–12 weeks|Flexible schedule|Full live cohort|vary by program and plan" | sort -u`
  Expected: all nine.
  Run: `text /programs/forex-trading-mastery | grep -cE "Executive 101|Perfect for beginners"`
  Expected: `0`.
  As `student` on Crypto's checkout (`package=standard`), the row reads "STANDARD — Mastery", then "Crypto Mastery".

- [ ] **Step 6: Look at it.**
  - **Widths.** At 1440, 390 and 320 px, in dark and light themes, on `/programs/forex-trading-mastery`:
    - the option cards read "BASIC — Foundation", "STANDARD — Mastery ★ Most popular" and "EXECUTIVE — Personalized Mastery";
    - there is no horizontal scroll (`document.documentElement.scrollWidth <= innerWidth`).
  - **A long tagline.** Set a 120-character tagline on Forex's Standard with the Task 2 `node -e` pattern (`$set: { "packages.$[p].tagline": "<120 chars>" }`). At 320 px it must wrap inside its card with no overflow. Restore it with the catalogue `--apply`.
  - **Single-tier.** The mock has no single-tier offer with a tagline, so check this in the diff: the tagline lines of `SingleOffer`, `SinglePackage` and a label-less `PackageRow` are untouched.

- [ ] **Step 7: Typecheck, lint, commit.**

```bash
npx tsc --noEmit
npx eslint components/programs/package-chooser.tsx
npx eslint components/programs/package-ladder.tsx
npx eslint components/checkout/order-summary.tsx
npx eslint components/programs/whats-included.tsx
git add components/programs/package-chooser.tsx components/programs/package-ladder.tsx components/checkout/order-summary.tsx components/programs/whats-included.tsx
git commit -m "feat(plans): Basic — Foundation, Standard — Mastery, Executive — Personalized Mastery"
```

---

### Task 7: A Basic learner, end to end

**Files:**
- Modify (comments only; each anchor loses its now-false "(Basic)" claim):
  - `lib/actions/exams.ts`: "certificate entitlement (Basic has neither)" becomes "certificate entitlement".
  - `lib/actions/certificates.ts`: "Packages without assessment & certificate (Basic) complete, but never certify." becomes "Plans without the certificate complete, but never certify."
  - `lib/actions/student.ts`: "no assessment & certificate (Basic), which completes on its lessons." becomes "no certificate, which completes on its lessons."
  - `app/(platform)/dashboard/courses/[courseId]/completed/page.tsx`: "Packages without a certificate (Basic) complete but never certify" becomes "Plans without a certificate complete but never certify".
  - `app/(platform)/dashboard/courses/[courseId]/completed/completion-client.tsx`: "False when the package has no certificate (Basic)" becomes "False when the plan has no certificate".
  - `lib/vivid/actions/progress.ts`: "(Basic completes without)" is removed.

**Interfaces:**
- Consumes: Tasks 1–6. Nothing new is produced.

- [ ] **Step 1: Setup.** Restart the verification server. Apply the catalogue and run the fixture (`basic`). Then `inspect.ts` shows the enrollment `active`, `packageKey: "basic"`, `progress: 0`, `examPassed: false`, `certificateId: null`, and `threads: 0`.

- [ ] **Step 2: Recordings and assignments.** In one Playwright harness, as `student`:
  - `/dashboard/recordings` plays "Fixture class recording" (`video[src*="fixture.mp4"]`, R2 route held).
  - `/dashboard/assignments` lists "Fixture assignment". `/dashboard/assignments/<assignmentId>`: type "Fixture answer", then click "Submit assignment". The page then offers "Resubmit".

- [ ] **Step 3: The exam, completion and the certificate** (Review Focus 3).
  - Before the lessons, `/dashboard/courses/<courseId>/exam` reads "Finish all lessons to unlock the exam — you're at 0%.", with no plan-lock notice.
  - Open `/dashboard/courses/<courseId>/learn/<lessonIds[0]>`, click "Mark as complete", and do the same for `<lessonIds[1]>`.
  - `inspect.ts`: `progress: 100`, `status: "active"` (the exam holds completion), `certificateId: null`.
  - The exam page now offers "Start exam". Start it, choose "A", and click "Submit exam". It reads "You passed!".
  - `inspect.ts`: `status: "completed"`, `examPassed: true`, and a `certificateId` starting `WSA-`.
  - `/dashboard/courses/<courseId>/certificate` renders that ID. `curl -s -o /dev/null -w "%{http_code}" $BASE/verify/<certificateId>` prints `200`, and `text /verify/<certificateId> | grep -c "Forex Trading Mastery"` is at least `1`.

- [ ] **Step 4: Live classes stay refused** (Review Focus 2). As `student`, `/dashboard/meetings?join=<meetingId>` shows "Live classes aren't included in your package", and no RealtimeKit call is made (the room is fixture-only).

- [ ] **Step 5: Instructor Q&A stays refused** (Review Focus 2). Re-run the fixture (`basic`), which resets progress and threads. On `/dashboard/instructor/<hostId>`, clicking "Message Instructor" shows "Instructor Q&A isn't included in your package", and `inspect.ts` still reports `threads: 0`.

- [ ] **Step 6: Nobody loses access** (Review Focus 1). Run the fixture with `standard --legacy`, which removes Standard's stored `recordings` and keeps `liveClasses`. As `student`:
  - `/dashboard/recordings` still plays "Fixture class recording".
  - `/dashboard/meetings?join=<meetingId>` reads "This class hasn't started yet — it begins …", so the plan gate passed.
  - "Message Instructor" on `/dashboard/instructor/<hostId>` lands on `/dashboard/messages?c=…`, and `threads: 1`.

  Afterwards, run the catalogue `--apply` (it restores the flag) and the fixture `basic`.

- [ ] **Step 7: The comments, typecheck, lint, commit.** Apply the six comment edits.

```bash
npx tsc --noEmit
npx eslint lib/actions/exams.ts
npx eslint lib/actions/certificates.ts
npx eslint lib/actions/student.ts
npx eslint "app/(platform)/dashboard/courses/[courseId]/completed/page.tsx"
npx eslint "app/(platform)/dashboard/courses/[courseId]/completed/completion-client.tsx"
npx eslint lib/vivid/actions/progress.ts
git add lib/actions/exams.ts lib/actions/certificates.ts lib/actions/student.ts "app/(platform)/dashboard/courses/[courseId]/completed/page.tsx" "app/(platform)/dashboard/courses/[courseId]/completed/completion-client.tsx" lib/vivid/actions/progress.ts
git commit -m "chore(plans): Basic certifies — retire the comments that said it never would"
```

  Paste the step 2–6 results (texts seen, `inspect.ts` output) into the task report.

---

### Task 8: Go note, owner steps, status; the closing run

**Files:**
- Modify: `docs/go-patches-phase-3.md`, `docs/launch-runbook.md`, `docs/institutional-blueprint-plan.md`, `docs/mastery-academy-plan.md`, `context.md`

**Interfaces:** none.

- [ ] **Step 1: `docs/go-patches-phase-3.md`.**
  - **§1 table.** In the `entitlements` row, append "`recordings` (Phase 14, web-only; missing = `false`)".
  - **§3.** Under the heading, add "Phase 14 (2026-10-19) changed Basic's data; §<N> has its row today."
  - **§10.** "re-checks that the viewer's package includes live classes" becomes "re-checks that the viewer's plan includes recorded classes (`recordings || liveClasses`, `recordingsAllowed`)".
  - **The new section.** Append `## <N>. Phase 14 — plans to the institutional blueprint (owner, 2026-10-19)`, where `<N>` is the next free number (12 today; renumber at merge if another track took it). It says:
    - **Go needs no patch;** only data changed.
    - **`courses.packages[].entitlements.recordings`** is a new web-only boolean (missing = false). The web treats a plan as including recorded classes when `recordings || liveClasses`. If mobile ever plays recordings, it uses the same rule and §10's signed-URL path.
    - **After the catalogue apply,** every catalogue program's Basic plan has `assignments`, `certificate` and `recordings` true, and `liveClasses`, `instructorQa`, `mentorship` and `prioritySupport` false.
    - **What R1 and R4 already do with that data:** a Basic enrollment may start the final exam; `examRequired` now holds Basic completion until it passes; and a completed Basic enrollment gets a certificate.
    - **Basic's row today:** lessons open per R3 · final exam allowed · certificate yes (on completion) · live class refused · new thread refused.
    - **Display only:** `name`, `tagline` ("Foundation" / "Mastery" / "Personalized Mastery"), `duration` ("4 weeks" / "8–12 weeks" / "Flexible schedule") and `features`. The Executive tier label is "Executive"; it is not stored.

- [ ] **Step 2: `docs/launch-runbook.md`.** After the "Cohort launch" section, add `## Plans to the blueprint — Phase 14 (2026-10-19)`:
  1. **Before.** The Phase 10 catalogue apply has run. If it never ran, this single run does both, so follow §6 and expect its price changes (`--allow-price-change`).
  2. **Count the Basic learners this will certify without the exam** (read-only; expected `0`; otherwise decide before applying):

     ```bash
     mongosh "$PROD_URI" --quiet --eval 'const ids = db.courses.distinct("_id", { examRequired: true }); print("basic completed without exam " + db.enrollments.countDocuments({ course: { $in: ids }, packageKey: "basic", status: "completed", examPassed: { $ne: true } }))'
     ```

  3. **Dry run**, then review it:
     - Run `MONGODB_URI="$PROD_URI" node scripts/mastery-catalogue.mjs | tee "plans-dryrun-$(date +%Y%m%d-%H%M).log"`.
     - Each MATCH has three `plan …:` lines. Basic gains `+assignments +certificate +recordings`; Standard and Executive gain `+recordings`.
     - No line carries a `-flag`.
     - If one does, a learner on that plan would lose that service. Stop and take it to the owner: `--allow-access-loss` is for a written go only.
  4. **Apply** with `--apply`, plus `--allow-price-change` only if step 1 applies, and `tee` the log. Then re-run `--apply`; it must end `Total modifiedCount across matched rows: 0`.
  5. **Check:** `curl -s "$SITE/programs/<forex slug>"` shows "Foundation", "Personalized Mastery", "4 weeks", "8–12 weeks" and "Flexible schedule". A Basic test learner sees Recordings, Assignments and, after the lessons, the exam.
  6. **Rollback:** re-run the previous release's script with `--apply --allow-access-loss`. Basic learners then lose recordings, assignments and the exam. Issued certificate IDs stay valid.

  Also add a bullet to the "Cohort launch" step 7 list: "Phase 14: §<N> (Basic certifies; `recordings` is web-only)."

- [ ] **Step 3: Status.**
  - **`docs/institutional-blueprint-plan.md`:**
    - Tick Phase 14's two exit criteria.
    - Set its §3 row's status to `done <date> (<n> commits)`.
    - Under 14.6, add "(Ruling, Phase 14 task plan: no `--update-plans` — the script already replaces `packages` wholesale; the dry run diffs every plan and `--allow-access-loss` guards removals. Runbook: dry run → `--apply`.)"
  - **`docs/mastery-academy-plan.md`:** row 14 becomes `done <date> — task plan docs/plans/mastery-phase-14.md`.
  - **`context.md`:** append `### <date> — Plans to the blueprint (Phase 14)` to the Decision Log, with four bullets:
    - Basic — Foundation / Standard — Mastery / Executive — Personalized Mastery, the tagline beside the label;
    - the `recordings` entitlement and its live-classes fallback;
    - "Recorded classes" in the service lists;
    - Executive's label is "Executive".

- [ ] **Step 4: The closing run.**
  - **Server.** Restart the verification server, then apply the catalogue and run the fixture.
  - **Every published program.** For the ten published catalogue slugs (`forex-trading-mastery crypto-trading-mastery blockchain-technology-mastery ai-ai-automation app-development-with-ai cybersecurity data-analysis content-creation-mastery tech-sales-digital-marketing virtual-assistance`), `text /programs/<slug> | grep -oE "— Foundation|— Mastery|— Personalized Mastery|4 weeks|8–12 weeks|Flexible schedule" | sort -u | wc -l` prints `6`.
  - **Pages.** At 1440 and 390 px, as `guest` and `student`: `/programs/forex-trading-mastery`, the Crypto checkout, `/dashboard/recordings` and `/dashboard/courses/<courseId>` show no horizontal scroll and no console errors beyond the known Vivid 403.
  - **Repo checks.** `pnpm lint` shows no new errors against the count recorded before Task 1, and `npx tsc --noEmit` is clean.
  - **Dev bypasses.** `git diff --stat feat/institutional...HEAD -- mocks lib/dev scripts/dev lib/wallet.ts` prints nothing.

- [ ] **Step 5: Commit.**

```bash
git add docs/go-patches-phase-3.md docs/launch-runbook.md docs/institutional-blueprint-plan.md docs/mastery-academy-plan.md context.md
git commit -m "docs(plans): Phase 14 — Go note, the owner's catalogue steps, status"
```

## Report (end of phase)

Read out Phase 14's exit criteria from `docs/institutional-blueprint-plan.md`, and add:
- **The feature lists for the owner,** with what changed on Executive (ruling 3): "Lifetime mentorship access" and "Access to the signal group" kept, and "Private one-on-one classes with a personal tutor" dropped.
- **Task 7's evidence:** the texts seen and the `inspect.ts` lines.
- **For the controller:** add `--allow-access-loss` to the catalogue bullet in the main checkout's `CLAUDE.md` (ruling 15).
- **Left for the vocabulary pass:** "Live classes aren't included in your package", "Instructor Q&A isn't included in your package", and the editor's "Add … package" / "Remove … package". The landing vignette (`components/marketing/vignettes.tsx`, Track A) still shows an illustrative Basic without a certificate.
