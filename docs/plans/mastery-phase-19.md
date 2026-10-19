# Mastery Academy — Phase 19 Implementation Plan (Faculty system)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** institutional blueprint §16, end to end:
- **The pipeline.** Application → Academic review → Interview → Teaching demonstration (where appropriate) → Approval → Onboarding. Onboarding ends in a WMA Faculty credential, after the teaching standards, the curriculum guidelines and the platform training.
- **The Faculty Dashboard.** Today's classes, upcoming classes, My Students, assignments, course materials, Live Classroom, Student Performance, Earnings and WMA Partners.

**Architecture:**
- **The demonstration** is a second meeting run through the interview machinery. `scheduleInterviewCore` gains a `kind`, and the application gains an additive `demo` sub-document. The status stays `interview_scheduled` throughout, so Go needs no change.
- **Onboarding.**
  - The handbook copy has one client-safe home, `lib/faculty-handbook.ts`. It is a draft for the owner to sign off.
  - Acknowledgements and the credential are dotted writes under `users.instructorProfile`.
  - The credential is issued by the onboarding read itself, never by an exported action that takes a user id.
- **The dashboard.**
  - Pages are RSC pages over faculty-scoped loaders in a new `lib/actions/faculty-students.ts`.
  - `getMyInstructorEarnings` gains read-only aggregates. The money code isn't touched.
  - A learner's cohort (Phase 12) and Mastery Score (Phase 16) come through one seam file, `lib/faculty-seams.ts`. It ships empty, and every cohort and Mastery surface hides until it is filled.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict · Mongoose · Zod (`zod/v4`) · Tailwind v4 with the WorldStreet design system (`ds/`, `ws-*` tokens) · Base UI (`render` prop) · TanStack Query · Resend (no-op locally) · RealtimeKit (`lib/realtime.ts`; it throws locally).

**Spec:** `docs/institutional-blueprint.md` §16, with §6 and §17 for "WMA Faculty ≠ Marketplace Instructor". **Roadmap:** `docs/institutional-blueprint-plan.md` Phase 19, decisions D29 and D31, §3 (tracks, collisions, the vocabulary ruling) and §4 (constraints).

**Branch:** track C's branch, after Phase 18 (WMA Partners) is committed on it. Task 8 moves Phase 18's "WMA Partners" sidebar item.

## Controller rulings (binding)

1. **Requesting a demonstration schedules it.**
   - `adminRequestTeachingDemo(applicationId, scheduledAtISO)` takes the time. The roadmap's one-argument form had nothing to schedule with.
   - It is allowed only while the application is `interview_scheduled`, and calling it again reschedules.
   - It is refused once an outcome is recorded.
   - Demonstrations take no slot proposals: the reviewer picks the time, as "Schedule directly" does for interviews.
2. **A failed room writes nothing.** The `demo` sub-document is written in the same save as the meeting pointer, after RealtimeKit has minted the room. A RealtimeKit failure leaves `demo: null`, which can never block approval.
3. **The interview path stays byte-identical.** `scheduleInterviewCore` gains a fifth parameter, `kind: "interview" | "demo" = "interview"`. Task 1, step 3 has the per-kind table.
4. **Approval waits for an outcome; the reviewer decides.**
   - `adminDecideApplication` refuses approval while `demo.requested && demo.outcome === null`.
   - A "not passed" outcome does not block approval. The blueprint sets no such rule, so none is invented.
   - Applicants never see the outcome, only the step and the room.
5. **Reminder emails name the demonstration.** `sendInterviewReminderEmail` gains `what`, and the reminders cron passes `"teaching demonstration"` for a demo room. Otherwise the applicant would get "your interview is tomorrow".
6. **Handbook keys and storage.**
   - Keys are camelCase fields: `teachingStandards`, `curriculumGuidelines`, `platformTraining`.
   - Slugs are kebab-case: `teaching-standards`, `curriculum-guidelines`, `platform-training`.
   - Storage is `instructorProfile.handbook.<key>At`. The first acknowledgement wins and its date never moves.
7. **The handbook is a draft until the owner approves it.**
   - `HANDBOOK_APPROVED = false` shows a "Draft" chip on every handbook page. The runbook step is the owner's sign-off.
   - Every figure comes from the constant that enforces it:
     - shares and clearing days from `lib/db/models/earning.ts`, passed in by the server page;
     - the 15-minute early start from `lib/class-schedule.ts`.
   - Exam defaults, submission limits and mentorship windows are schema defaults or module-private constants. They are literals in the copy, each with a comment naming its source.
8. **When the credential is issued.**
   - It is issued when every checklist item except "Create your first course" is done. The exit criteria list agreement, profile, signature, KYC and the three handbook pages.
   - KYC must be *verified* whenever the wallet is configured. An unreachable wallet defers issuance; it never skips KYC.
   - The roadmap's `issueFacultyCredential()` becomes the module-private `ensureFacultyCredential(userId)`, which the onboarding read runs. A `"use server"` export that takes a user id would be callable by anyone.
9. **The credential ID never changes.** It is `WMAF-` + 6 Crockford base32 symbols drawn from 30 random bits (Web Crypto, so the module is client-safe). It is stored once and protected by the partial unique index `facultyCredential_unique`.
10. **Approval keeps faculty history.** `adminDecideApplication`'s approval rewrites the whole `instructorProfile`, so it carries `handbook` and `credential` across, as it already does for the Phase 5 fields. A returning instructor keeps their credential ID.
11. **My Students is a new loader, not `getCourseStudents`.**
   - `getCourseStudents` takes the instructor id as an argument (a browser-supplied id), returns emails and covers one course. It stays untouched and uncalled, and `lib/actions/enrollments.ts` isn't edited.
   - The new loader:
     - lists `active` and `completed` enrollments;
     - shows no email column (faculty reach learners through Messages);
     - scopes faculty to the courses they own, of any kind, and lets admins see every course.
   - A program id outside the caller's scope matches nothing.
12. **The seams live in `lib/faculty-seams.ts`.**
   - `cohortsFor` (Phase 12) and `masteryFor` (Phase 16) each have a one-line body marked `// SEAM(phase-12)` or `// SEAM(phase-16)`. Both return an empty `Map` until filled.
   - While a seam is empty, its column, filter or card hides. Attendance is the Mastery result's `attendance` part.
   - Per-class "Attended" marks on Student Performance arrive through the optional `attended` prop of `ClassesList`. That is the Phase 16 follow-up, which Task 8 records in the roadmap.
13. **Earnings reads gain fields; nothing else changes.**
   - `getMyInstructorEarnings` gains `byCourse`, and each row gains `courseId` and `learnerName`. These are read-only additions; `clearMaturedEarnings`, `clawBack` and `refundEnrollment` are untouched.
   - A program's revenue is the sum of its `sale` and `adjustment` rows that weren't reversed.
   - Referral commissions are WMA Partners income. They appear in the ledger and the totals, never in a program's revenue.
14. **New faculty pages are faculty-only.** `sellerMayOpen` (`lib/marketplace.ts`) is unchanged, so an approved Marketplace Creator is redirected from `/instructor/students`, `/instructor/earnings` and `/instructor/handbook` to `/instructor/courses`.
15. **The sidebar follows §16's order.**
   - The first group: Overview · My Students · My Courses · Live Classroom · Calendar · Earnings · WMA Partners · Profile · Handbook.
   - Messages, Add Course, Certificates and Analytics keep their rows in a second group.
   - "Meetings" is relabelled "Live Classroom", in the rail and in that page's Topbar title. The route is unchanged.
   - The seller rail is built from named items, never `teachItems[n]` indices, and keeps WMA Partners in its last group.
   - The bottom nav is unchanged.
16. **Today's classes come from the week the home already loads.** They are `agendaDays(home.week, now)[0].entries`, rendered client-side. No server change: Phase 12 edits `lib/actions/teaching-home.ts`.
17. **D31 stays off.** The public faculty page shows the credential as eyebrow text ("WMA Faculty · since October 2026"), and only behind `FACULTY_PUBLIC`, which stays `false`.
18. **Vocabulary.** New strings use the new vocabulary. Existing strings ("Become an instructor", "My Courses", "Executive 101", the editor's "Packages") are left for the final vocabulary pass.

## Global Constraints

Implementers don't see `CLAUDE.md` (it is git-excluded). These are its rules that this phase depends on.

- **Schema:**
  - Additive only: the Go mobile API reads the same MongoDB. No renamed fields, no new enum values on existing fields, no new role or status values.
  - A nullable enum lists `null` itself (`enum: [null, "a", "b"]`), as `Enrollment.packageKey` does.
  - Writes to `users.instructorProfile` are dotted `$set` paths (see `facultyProfileSet` in `lib/faculty.ts`). The one whole-object write, the approval in `adminDecideApplication`, carries every field across.
- **Server actions:**
  - The shape is `connectDB()` → auth and ownership → Zod (`import { z } from "zod/v4"`) → mutate → `revalidatePath()` → return `{ success: true, data } | { success: false, error }`. They never throw across the boundary.
  - Every export of a `"use server"` file is a public endpoint. Never export one that takes a user id, and validate every argument.
  - User ids come from `getCurrentUser()` (`@/lib/auth/actions` in actions; `getCachedUser()` from `@/lib/auth/cached` in RSC layouts and pages), never from the browser.
  - Admin actions start with `requireAdmin()` (`@/lib/auth/admin`). Role gates live in each route group's `layout.tsx`, not in middleware.
  - `connectDB()` comes first in every action. Models are imported from the `@/lib/db/models` barrel.
- **Money:**
  - Integer US cents through `lib/wallet.ts`, failing closed.
  - This phase never touches the money path: `purchaseCourse` and everything else in `lib/actions/enrollments.ts`, `lib/actions/manual-payments.ts`, and `clearMaturedEarnings`, `clawBack` and `refundEnrollment` in `lib/actions/earnings.ts`.
  - Paid files go only to the private bucket (`R2_RESOURCES_BUCKET_NAME`), never the public one. This phase uploads nothing.
- **Code:**
  - No new dependencies, no `any`, no secrets or env values in code.
  - Imports use `@/*`. RSC-first: `"use client"` only where interaction needs it.
  - No `Date.now()` during a component's render; the React Compiler lint flags it. Compute it in an event handler or on the server.
- **UI** (the WorldStreet design system; `ds/` is vendored and never edited):
  - `ws-*` utilities and tokens only, never a hex.
  - Gold only for primary CTAs, active nav and brand moments. The tutor home's gold stays on the hero's "Start class".
  - Icons only from `@/components/icons` (duotone glyphs; never lucide, Hugeicons or emoji).
  - Base UI composition uses `render`, never `asChild`.
  - Pills (`rounded-full`), 20px cards (`rounded-[20px]` or `CardShell` from `@/components/ui/system`), Manrope.
  - `·` separators; `tabular-nums` on money and counts.
  - New `(instructor)` pages copy the wrapper from `app/(instructor)/instructor/settings/page.tsx`: `<Topbar title="…" variant="instructor" />`, then `flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12`, then `PageHeader` from `@/components/shared/page-header`.
  - `(platform)` pages clear the mobile bottom nav (`pb-24 md:pb-8`). This phase edits only the existing `/dashboard/become-instructor` there, and its wrapper stays as it is.
  - Motion: opacity and transform only, honouring reduced motion.
- **Words:**
  - New user-facing strings use the new vocabulary: plan (not package), Marketplace Creator (not seller), program for Academy offerings, Become a WMA Instructor.
  - Don't rename existing strings outside this phase (ruling 18).
  - Never invent policy beyond what the platform enforces.
  - Dates print in en-GB in the Lagos zone (`COHORT_TIME_ZONE` from `lib/cohort.ts`).
- **No test runner, and none is added.**
  - Pure modules are checked by a throwaway `node:assert/strict` script in `$SCRATCH` (`SCRATCH=$(mktemp -d)`), run from the worktree root with `npx tsx --tsconfig ./tsconfig.json "$SCRATCH/<name>.ts"` so `@/` resolves.
  - If `@/` won't resolve for a file outside the repo, copy the script to the worktree root as `<name>.tmp.ts`, run it there, then delete it. Never commit it.
- **Every task ends with:**
  - `npx tsc --noEmit` clean (one stale `.next/types` error is not real; anything else is);
  - `npx eslint <file>` on each changed file, one at a time;
  - the task's runtime checks.
- **Git:**
  - Commit only the task's files, by explicit path. Never `git add -A`, never `git stash`.
  - Never commit `mocks/`, `.env*` or anything under `$KIT`.
  - Message: `git commit -m "type(scope): summary" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`.
- **Databases:** never run a database script without an explicit local `MONGODB_URI=mongodb://127.0.0.1:<DBPORT>/…` in front. The real `.env.local` points at production.
- **Anchors** below are quoted text, never line numbers.

## Review Focus

1. **RealtimeKit fails while a reviewer requests a demonstration** (it does in every local run, and can in production). The expected result: the error shows, `demo` stays `null`, no meeting row is written, and approval still works. A half-written demo would block approval forever. Covered in Task 1, step 8a.
2. **A returning instructor is approved again.** The approval's whole-object `instructorProfile` write must keep their `WMAF-` credential and handbook acknowledgements. Covered in Task 3, step 9.
3. **An instructor opens another instructor's learner** by URL (`/instructor/students/<theirEnrollmentId>`) or filter (`?program=<theirProgramId>`). The expected result is the not-found page and an empty list, with nothing leaked. Covered in Task 6, step 7, and Task 7, step 6.
4. **An approved Marketplace Creator types a faculty URL** (`/instructor/students`, `/instructor/earnings`, `/instructor/handbook`). They are sent to `/instructor/courses`, and keep WMA Partners in their own rail. Covered in Task 5, step 7, and Task 8, step 7.
5. **Revenue counts the wrong rows.** A referral commission or a sale reversed before clearing must never count toward a program's revenue, and analytics must equal the ledger's "By program". Covered in Task 5, step 6.

Also checked inside tasks:
- 320 and 390 px: the five-step tracker (Task 2) and the My Students list (Task 6).
- A wallet that can't be reached never issues a credential without KYC (Task 4, pure check).

## Verification server

Each track runs its own `dev:mock` in its worktree. The controller fills `<PORT>` and `<DBPORT>`. This phase adds `CRON_SECRET` for the reminders check in Task 1.

```bash
netstat -ano | grep -E ":<PORT>|:<DBPORT>"      # must print nothing first
RESEND_API_KEY=re_disabled_local CLOUDFLARE_REALTIME_API_KEY=disabled-local OPENAI_API_KEY=disabled-local \
ABLY_API_KEY=disabled-local R2_SECRET_ACCESS_KEY=disabled-local WALLET_SERVICE_TOKEN=disabled-local \
CRON_SECRET=p19-cron NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_bG9jYWwuZGV2JA MOCK_DB_PORT=<DBPORT> PORT=<PORT> node scripts/dev-mock.mjs
MONGODB_URI=mongodb://127.0.0.1:<DBPORT>/worldstreet-academy node scripts/mastery-catalogue.mjs --apply
```

- **The worktree has no `.env.local`; that is intended.**
  - The wallet is off, so KYC reads as not required and earnings never clear.
  - RealtimeKit throws, so new rooms fail.
  - Email no-ops.
- **Personas** switch with the `mock_persona` cookie: `guest`, `student` (Johnson Demo, `student@worldstreet.academy`), `instructor` (Sarah Chen, `instructor@worldstreet.academy`, username `sarah_chen`) and `admin` (Ada Admin, `admin@worldstreet.academy`). No new persona is needed: fixture users cover the other learners.
- **Restart the server after any change to a file in `lib/db/models/`.** Mongoose keeps compiled models across hot reloads, so a new field is silently dropped on save until a restart.
- **When you finish,** kill every process listening on the two ports and confirm with `netstat`.

## Verification kit

Set once per shell, from the worktree root:

```bash
WT=$(pwd)
BASE=http://localhost:<PORT>
KIT=/tmp/wsa-p19-kit; mkdir -p "$KIT"        # outside the repo; kept between tasks
SCRATCH=$(mktemp -d)                        # assert scripts
fx() { MONGODB_URI=mongodb://127.0.0.1:<DBPORT>/worldstreet-academy node "$KIT/fx.cjs" "$@"; }
# HTML without scripts (the RSC payload never counts), as a persona:
html() { curl -s ${2:+-b "mock_persona=$2"} "$BASE$1" | perl -0pe 's#<script\b.*?</script>##gs'; }
# Visible text only:
text() { html "$1" "$2" | perl -0pe 's#<style\b.*?</style>##gs; s#<[^>]+># #g; s#&\#x27;#\x27#g; s#&quot;#"#g; s#&amp;#&#g; s#\s+# #g'; }
# Create the three persona users before any fixture runs:
for p in student instructor admin; do curl -s -o /dev/null -b "mock_persona=$p" "$BASE/dashboard"; done
```

**`$KIT/fx.cjs`** holds the local-only fixtures. It is created by the first task that needs it, and each task adds the commands it lists. Every document it inserts carries `p19: true`, so later runs can find and remove its own rows. The skeleton:

```js
// Phase 19 fixtures — LOCAL mock DB only. Run from the worktree root via fx().
const uri = process.env.MONGODB_URI || ""
if (!/^mongodb:\/\/127\.0\.0\.1:\d+\//.test(uri)) { console.error("refusing: MONGODB_URI must be a local 127.0.0.1 URI"); process.exit(1) }
const mongoose = require(require.resolve("mongoose", { paths: [process.cwd()] }))
const { ObjectId } = mongoose.Types
const [cmd, ...args] = process.argv.slice(2)
const now = new Date()
const mins = (m) => new Date(now.getTime() + m * 60_000)
const commands = {} // each task adds commands: commands.name = async (db, args, h) => { … }
;(async () => {
  await mongoose.connect(uri)
  const db = mongoose.connection.db
  const user = async (email) => {
    const u = await db.collection("users").findOne({ email })
    if (!u) throw new Error(`no user ${email} — open $BASE/dashboard once as that persona`)
    return u
  }
  if (!commands[cmd]) throw new Error(`unknown command "${cmd}"; known: ${Object.keys(commands).join(", ")}`)
  await commands[cmd](db, args, { user, mins, now, ObjectId })
  await mongoose.disconnect()
})().catch(async (e) => { console.error(e.message); await mongoose.disconnect().catch(() => {}); process.exit(1) })
```

**The browser.** Client pages (the applicant page, the admin application page, the tutor home) need one. Use Playwright (installed globally: `require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright")`) or the controller's browse tool.
- Set the cookie `mock_persona=<persona>` for `localhost` before navigating.
- No horizontal scroll means `document.documentElement.scrollWidth <= innerWidth`.

## File structure

| File | Responsibility |
|---|---|
| `lib/db/models/instructor-application.ts` (modify) | + `demo` sub-document, `ITeachingDemo`, `DemoOutcome` |
| `lib/db/models/user.ts` (modify) | + `instructorProfile.handbook`, `instructorProfile.credential`, index `facultyCredential_unique` |
| `lib/actions/applications.ts` (modify) | `scheduleInterviewCore(kind)`, `adminRequestTeachingDemo`, `adminRecordDemoOutcome`, approval guard and carry-over, demo views |
| `lib/email.tsx`, `app/api/cron/reminders/route.ts` (modify) | Demonstration invite and reminder wording |
| `components/admin/teaching-demo-card.tsx` (new) | The reviewer's demonstration controls |
| `lib/application-tracker.ts` (new) | Pure: the applicant tracker's steps and current step |
| `lib/faculty-handbook.ts` (new) | Pure, client-safe: the handbook's pages and copy (owner sign-off) |
| `lib/faculty-credential.ts` (new) | Pure, client-safe: credential ID, labels, readiness |
| `lib/actions/instructor-onboarding.ts` (modify) | Handbook state, `acknowledgeHandbook`, credential issuing, `getMyFacultyCredential` |
| `app/(instructor)/instructor/handbook/**` (new) | The three handbook pages and their index |
| `lib/faculty-format.ts` (new) | Pure: ledger labels, share, dates |
| `lib/actions/earnings.ts` (modify, read model only) | + `byCourse`, row `courseId` and `learnerName` |
| `app/(instructor)/instructor/earnings/page.tsx` (new) | The earnings ledger |
| `lib/faculty-students.ts` (new) | Pure: student filters, plan labels, links |
| `lib/faculty-seams.ts` (new) | The Phase 12 and Phase 16 seams (empty) |
| `lib/actions/faculty-students.ts` (new) | `getFacultyStudents`, `getStudentPerformance` |
| `app/(instructor)/instructor/students/**`, `components/instructor/students/*` (new) | My Students and Student Performance |
| `components/instructor/home/today-classes.tsx` (new) | Today's classes on the tutor home |
| `components/instructor/instructor-sidebar.tsx` (modify) | §16 order |

---

### Task 1: The teaching demonstration — data, actions and the reviewer's card

**Files:**
- Modify:
  - `lib/db/models/instructor-application.ts`
  - `lib/db/models/index.ts`
  - `lib/actions/applications.ts`
  - `lib/email.tsx`
  - `app/api/cron/reminders/route.ts`
  - `app/(admin)/admin/applications/[applicationId]/page.tsx`
- Create: `components/admin/teaching-demo-card.tsx`

**Interfaces:**
- Consumes:
  - in `lib/actions/applications.ts`: the existing module-private `scheduleInterviewCore(app, host, scheduledAt, byName)` and `InterviewInfo`; `requireAdmin`; `buildInterviewIcs` (`lib/ics.ts`);
  - in `lib/email.tsx`: `formatUtcDateTime`, the module-private `SimplePipelineEmail` and `InterviewEmailData`.
- Produces:
  - In the model, exported from the barrel: `type DemoOutcome = "passed" | "not_passed"`, `interface ITeachingDemo { requested: boolean; meetingId: Types.ObjectId | null; scheduledAt: Date | null; outcome: DemoOutcome | null; note: string; decidedAt: Date | null }`, and `IInstructorApplication.demo: ITeachingDemo | null`.
  - `adminRequestTeachingDemo(applicationId: string, scheduledAtISO: string): Promise<{ success: true; data: { meetingId: string; joinPath: string; rescheduled: boolean } } | { success: false; error: string }>`.
  - `adminRecordDemoOutcome(applicationId: string, outcome: DemoOutcome, note: string): Promise<{ success: true; data: null } | { success: false; error: string }>`.
  - `type AdminDemoView = { scheduledAt: string | null; joinPath: string | null; outcome: DemoOutcome | null; note: string; decidedAt: string | null }`. `AdminApplicationDetail` gains `demo: AdminDemoView | null` (null means never requested). `joinPath` is null once the room has ended.
  - `scheduleInterviewCore(app, host, scheduledAt, byName, kind: "interview" | "demo" = "interview")`, still module-private.
  - In `lib/email.tsx`: `sendTeachingDemoInviteEmail(to: string, data: InterviewEmailData, ics?: string)`. The data of `sendInterviewReminderEmail` gains `what?: "interview" | "teaching demonstration"` (default `"interview"`).
  - `TeachingDemoCard(props: { applicationId: string; status: ApplicationStatus; demo: AdminDemoView | null; onChanged: () => void })`, a client component.

- [ ] **Step 1: Check first, and add the kit commands.**
  - Run `grep -c "demo" lib/db/models/instructor-application.ts`. Expected: `0`.
  - Create `$KIT/fx.cjs` from the skeleton, with these commands:
    - **`applicant [credential]`** resets, then builds the student's application.
      - Delete every `instructorapplications` row of `student@worldstreet.academy`, and every `meetings` row with `p19: true` whose `applicationId` was one of them.
      - On the student user: `$set role: "USER", instructorStatus: "interview"`, and `$unset "instructorProfile.credential"` and `"instructorProfile.handbook"`.
      - With the `credential` argument, also `$set "instructorProfile.credential": { id: "WMAF-TEST01", issuedAt: new Date("2026-01-05T10:00:00Z") }` and `"instructorProfile.handbook.teachingStandardsAt": new Date("2026-01-04T10:00:00Z")`.
      - Insert the interview meeting: `{ p19: true, title: "Instructor Interview — Johnson Demo", hostId: <admin _id>, status: "ended", meetingId: "rtk-fixture-interview", hostToken: "fixture", scheduledAt: mins(-120), startedAt: mins(-120), endedAt: mins(-90), participants: [], invites: [], reminders: { h24SentAt: null, h1SentAt: null }, settings: { allowScreenShare: true, muteOnEntry: false, requireApproval: true, guestAccess: false, maxParticipants: 10 }, createdAt: now, updatedAt: now }`.
      - Insert the application, with no `demo` key (the legacy shape):
        - `{ p19: true, user: <student _id>, status: "interview_scheduled", interviewMeetingId: <that meeting> }`;
        - `answers: { headline: "Forex educator and risk coach", expertise: ["Forex"], experienceYears: "3-5", experience: <60 × "x">, motivation: <60 × "y">, portfolioUrl: null, twitter: null, linkedin: null, website: null, sampleVideoUrl: null, cvUrl: null, school: "trading-financial-markets", teachingTopic: "Forex risk management", passion: "yes", passionReason: "I love teaching it", readyToCommit: true }`;
        - `proposedSlots: [], slotsProposedBy: null, slotsProposedAt: null, assignedTo: null, assignedToName: "", scorecard: null, termsAcceptedAt: now, reviewerNotes: [], decidedBy: null, decidedAt: null, decisionNote: "", rejectionReason: ""`;
        - `history: [{ status: "submitted", at: mins(-2880), by: "Johnson Demo" }, { status: "interview_scheduled", at: mins(-1440), by: "Ada Admin" }], createdAt: mins(-2880), updatedAt: now`.
      - Set the meeting's `applicationId`.
      - Print `{"applicationId":"…","interviewMeetingId":"…"}`.
    - **`demo-room <applicationId> <minutesAhead>`** simulates a request whose room was minted.
      - Insert the meeting: `{ p19: true, title: "Teaching demonstration — Johnson Demo", description: "Phase 19 fixture", hostId: <admin _id>, status: "scheduled", meetingId: "rtk-fixture-demo", hostToken: "fixture", scheduledAt: mins(m), applicationId, participants: [{ userId: <admin _id>, role: "host", status: "admitted", joinedAt: now }], invites: [{ userId: <student _id>, email: "student@worldstreet.academy", status: "sent", sentAt: now }], reminders: { h24SentAt: null, h1SentAt: null }, settings: <as above>, createdAt: now, updatedAt: now }`.
      - `$set demo: { requested: true, meetingId, scheduledAt: mins(m), outcome: null, note: "", decidedAt: null }` on the application.
      - Print `{"meetingId":"…"}`.
    - **`app <applicationId>`** prints `{ status, demo, meetings: <count of meetings with that applicationId>, demoReminders: <the demo meeting's reminders or null>, history: <the last two history notes> }`.
    - **`user <email>`** prints `{ role, instructorStatus, sellerStatus, credential: instructorProfile.credential ?? null, handbook: instructorProfile.handbook ?? null }`.
    - **`notes <email> [n=3]`** prints the user's newest `n` notifications as `{ title, body }`.
    - **`reset-student`**:
      - deletes the student's applications and their `p19` meetings;
      - `$set role: "USER", instructorStatus: "none", sellerStatus: "none"`;
      - `$unset "instructorProfile.credential"` and `"instructorProfile.handbook"`;
      - prints `reset`.
  - Run `fx applicant` and record the `applicationId` as `$APP`. As `admin`, `/admin/applications/$APP` shows no "Teaching demonstration".

- [ ] **Step 2: The model.** In `lib/db/models/instructor-application.ts`:
  - Add `DemoOutcome` and `ITeachingDemo` beside `IScorecard`.
  - In `IInstructorApplication`, add after `rejectionReason: RejectionReason | ""`:

    ```ts
      /** Teaching demonstration (institutional blueprint §16, D29) — null until a reviewer requests one. The status stays interview_scheduled throughout. */
      demo: ITeachingDemo | null
    ```

  - In the schema, insert before `    history: [`:

    ```ts
        demo: {
          type: new Schema(
            {
              requested: { type: Boolean, default: true },
              meetingId: { type: Schema.Types.ObjectId, ref: "Meeting", default: null },
              scheduledAt: { type: Date, default: null },
              outcome: { type: String, enum: [null, "passed", "not_passed"], default: null },
              note: { type: String, default: "", maxlength: 2000 },
              decidedAt: { type: Date, default: null },
            },
            { _id: false }
          ),
          default: null,
        },
    ```

  - Add `type ITeachingDemo, type DemoOutcome` to the `./instructor-application` export in `lib/db/models/index.ts`.
  - Update the header comment's state machine: "a teaching demonstration may be requested during `interview_scheduled`; it never changes the status".

- [ ] **Step 3: `scheduleInterviewCore(…, kind)`.** Add the fifth parameter. `"interview"` keeps every value it has today. `"demo"` differs only where this table says:

  | | interview (unchanged) | demo |
  |---|---|---|
  | Room reused when not ended | `app.interviewMeetingId` | `app.demo?.meetingId` |
  | `createRTKMeeting` name | `` `Interview: ${applicantName}` `` | `` `Demonstration: ${applicantName}` `` |
  | `Meeting.title` | `` `Instructor Interview — ${applicantName}` `` | `` `Teaching demonstration — ${applicantName}` `` |
  | `Meeting.description` | `` `Interview call for a ${BRAND.name} instructor application.` `` | `` `Teaching demonstration for a ${BRAND.name} instructor application.` `` |
  | Application writes | `interviewMeetingId`, `proposedSlots = []`, status → `interview_scheduled` | only `app.demo = { requested: true, meetingId, scheduledAt, outcome: null, note: "", decidedAt: null }` |
  | History note | `Scheduled for <when>` / `Rescheduled for <when>` | `Teaching demonstration scheduled for <when>` / `Teaching demonstration rescheduled for <when>` |
  | Bell title | `Interview scheduled` / `Your interview was rescheduled` | `Teaching demonstration scheduled` / `Your teaching demonstration was rescheduled` |
  | Email | `sendInterviewInviteEmail` | `sendTeachingDemoInviteEmail` |
  | `.ics` title / description | `` `${BRAND.name} — Instructor Interview` `` / `` `Interview with ${host.name} about your instructor application.` `` | `` `${BRAND.name} — Teaching Demonstration` `` / `` `Teaching demonstration with ${host.name} for your instructor application.` `` |

  `<when>`, the bell body, `applicationId: app._id`, the `instructorStatus: "interview"` write, the 30-minute `.ics` and the return value are the same for both kinds. Every write comes after the RealtimeKit calls (ruling 2), as it does today.

- [ ] **Step 4: The two actions and the approval guard.** Add them after `adminScheduleInterview`. Both take `ObjectIdSchema = z.string().regex(/^[a-f0-9]{24}$/, "Application not found")`.
  - **`adminRequestTeachingDemo`:**
    - `requireAdmin()`. `scheduledAtISO` is parsed with `z.iso.datetime()`.
    - A time before `Date.now() - 60_000` → `"Demonstration time must be in the future"`.
    - Load with `.populate("user", "firstName lastName email avatarUrl")` (the core needs it). Missing → `"Application not found"`.
    - `status !== "interview_scheduled"` → `"Schedule the interview before a teaching demonstration"`.
    - `app.demo?.outcome` set → `"This teaching demonstration already has an outcome"`.
    - Call the core with `kind "demo"` and the admin as host.
    - Its catch → `"Couldn't open a room for the teaching demonstration — try again"`.
    - Revalidate `/admin/applications/${id}` and `/admin/applications`.
  - **`adminRecordDemoOutcome`:**
    - `requireAdmin()`, then Zod `{ applicationId, outcome: z.enum(["passed", "not_passed"]), note: z.string().trim().max(2000, "Keep the note under 2,000 characters") }`.
    - Status not in `ACTIVE_APPLICATION_STATUSES` → `` `Application is already ${status}` ``.
    - `!app.demo?.requested` → `"No teaching demonstration was requested"`.
    - Set `demo.outcome`, `demo.note` and `demo.decidedAt = now`. Push history `{ status: app.status, at: now, by: <admin name>, note: "Teaching demonstration: passed" | "Teaching demonstration: not passed" }`, followed by `` ` — ${note}` `` when a note was given.
    - A later call overwrites the outcome and adds another history entry.
    - Revalidate as above.
  - **The approval guard.** In `adminDecideApplication`, directly after the `ACTIVE_APPLICATION_STATUSES` check:

    ```ts
        if (decision === "approved" && app.demo?.requested && !app.demo.outcome) {
          return { success: false, error: "Record the teaching demonstration's outcome before approving" }
        }
    ```

- [ ] **Step 5: The admin view.** In `adminGetApplication`, build `demo`:
  - `null` when `!a.demo`.
  - Otherwise, read `Meeting.findById(a.demo.meetingId).select("scheduledAt status")`.
  - `joinPath` is `` `/dashboard/meetings?join=${meetingId}` `` while the status isn't `"ended"`, else `null`.
  - `scheduledAt` is the meeting's (ISO). `outcome`, `note` and `decidedAt` are copied (ISO).

- [ ] **Step 6: Emails and reminders.**
  - **`lib/email.tsx`: `sendTeachingDemoInviteEmail`** goes after `sendInterviewInviteEmail`. It uses `SimplePipelineEmail` with `when = formatUtcDateTime(data.scheduledAt, "full")`:
    - subject and `preview`: `"Your teaching demonstration is scheduled"`;
    - `title`: `"Teaching demonstration scheduled"`;
    - `bodyText`: `` `${data.applicantName}, the next step of your instructor application is a teaching demonstration with ${data.hostName} on ${when}. Join from this link at the scheduled time — you'll be admitted from the waiting room.` ``;
    - `ctaLabel`: `"Join teaching demonstration"`, `ctaUrl`: `data.joinUrl`, `avatarUrl`: `data.applicantAvatarUrl`, `avatarName`: `data.applicantName`;
    - the `.ics` attachment is named `teaching-demonstration.ics`.
  - **`sendInterviewReminderEmail`** gains `what`. With `What` as its capitalised form:
    - subject: `` `Your ${what} starts in about an hour` `` / `` `Reminder: your ${what} is tomorrow` ``;
    - preview: `` `${What} with ${counterpartName} — ${when}` ``;
    - 24h title: `` `${What} tomorrow` ``;
    - body: `` `your ${what} with` ``;
    - CTA: `` `Open ${what} room` ``.

    With the default, every string equals today's.
  - **`app/api/cron/reminders/route.ts`.** At `// Interview (or any other scheduled meeting): host + everyone invited.`, compute once:

    ```ts
    const what =
      meeting.applicationId &&
      (await InstructorApplication.exists({ _id: meeting.applicationId, "demo.meetingId": meeting._id }))
        ? "teaching demonstration"
        : "interview"
    ```

    Pass `what` to both `sendInterviewReminderEmail` calls. Add `InstructorApplication` to the models import, and update the route's doc comment ("instructor interviews and teaching demonstrations").

- [ ] **Step 7: The reviewer's card.** Create `components/admin/teaching-demo-card.tsx` (client, `useMutation`). Use the page's own surface and chip classes (`rounded-lg border border-ws-hairline bg-ws-surface p-4`; the scorecard's recommendation chips for the outcome). Heading: "Teaching demonstration".
  - **No demo, status `interview_scheduled`:**
    - one line, "Optional. Ask for one after the interview when you want to see the applicant teach.";
    - a `datetime-local` input whose `min` is set in its `onFocus` handler (now + 5 minutes);
    - an outline button "Request teaching demonstration" (pending: "Scheduling…").
  - **No demo, any other active status:** muted "Schedule the interview first."
  - **Demo requested:**
    - "Scheduled for {formatDateTime(scheduledAt)}" (`formatDateTime` from `@/components/admin/shared`);
    - an outline "Open demonstration room" link (`render={<a href={joinPath} />}`) while `joinPath` is set;
    - a reschedule row: a `datetime-local` input and "Reschedule & notify". It hides once an outcome exists.
    - the outcome form: chips "Passed" (success tone) and "Not passed" (danger tone), a `Textarea` with placeholder "Notes for the review team…" and an outline "Record outcome". It is pre-filled from `demo` and shows "Recorded {formatDate(decidedAt)}" once one exists.
  - **Once the status is no longer active** (approved, rejected or withdrawn), the card is read-only: the date, the outcome and the note.
  - Each action's `error` shows under it in `text-xs text-ws-danger`. Success calls `onChanged()`.
  - **Wire it into the page.** In `app/(admin)/admin/applications/[applicationId]/page.tsx`, render `<TeachingDemoCard … onChanged={invalidate} />` in the right column, directly before the `div` that holds `Reviewer notes`, whenever `isActive || app.demo`.
  - **The dialog shows its error.** In the decision dialog, render `{actionError && <p className="text-xs text-ws-danger">{actionError}</p>}` directly before its `<DialogFooter>`, so the approval refusal shows inside the open dialog.

- [ ] **Step 8: Verify (restart the server first: schema).**
  a. **RealtimeKit down.**
     - Run `fx applicant`, then `APP=<id>`. As `admin`, open `/admin/applications/$APP`, pick a time two days ahead and press "Request teaching demonstration".
     - Expected: "Couldn't open a room for the teaching demonstration — try again".
     - `fx app $APP` → `"demo":null` and `"meetings":1`.
     - Approve now → it succeeds (no demo was requested). Then run `fx applicant` again and set `APP` to the new id for the rest of the step.
  b. **Reminder wording.** Run `fx demo-room $APP 30`, then `curl -s -X POST -H "Authorization: Bearer p19-cron" $BASE/api/cron/reminders`.
     - Expected: a JSON `ok`.
     - `fx app $APP` → `demoReminders.h1SentAt` is set.
     - `fx notes student@worldstreet.academy 1` → title `Starting in ~1 hour`, and the body starts with `Teaching demonstration — Johnson Demo —`.
  c. **Reschedule.** In the card, reschedule to three days ahead.
     - Expected: success.
     - `fx app $APP` → `meetings` is still `2`, `demo.scheduledAt` has moved, and the last history note starts `Teaching demonstration rescheduled for`.
     - `fx notes student@worldstreet.academy 1` → `Your teaching demonstration was rescheduled`.
  d. **Approval waits.** Approve → the dialog shows "Record the teaching demonstration's outcome before approving". `fx user student@worldstreet.academy` → `"role":"USER"`.
  e. **Record an outcome.** Record "Passed" with the note "Clear and well paced".
     - `fx app $APP` → `outcome: "passed"`, `decidedAt` set, and the last history note is `Teaching demonstration: passed — Clear and well paced`.
     - "Request teaching demonstration" is gone, and a direct request is refused with the outcome message.
  f. **Approve.** Approve → success. `fx user student@worldstreet.academy` → `"role":"INSTRUCTOR","instructorStatus":"approved"`.
  g. **An ordinary interview still schedules.** Run `fx applicant`. In the header, "Reschedule interview" now creates a new room (the fixture interview has ended), so expect the existing "Failed to schedule interview". That is unchanged behaviour.
  h. Run `fx reset-student`.

- [ ] **Step 9: Lint, typecheck, commit.**

```bash
for f in lib/db/models/instructor-application.ts lib/db/models/index.ts lib/actions/applications.ts lib/email.tsx app/api/cron/reminders/route.ts "app/(admin)/admin/applications/[applicationId]/page.tsx" components/admin/teaching-demo-card.tsx; do npx eslint "$f"; done
npx tsc --noEmit
git add lib/db/models/instructor-application.ts lib/db/models/index.ts lib/actions/applications.ts lib/email.tsx app/api/cron/reminders/route.ts "app/(admin)/admin/applications/[applicationId]/page.tsx" components/admin/teaching-demo-card.tsx
git commit -m "feat(faculty): the teaching demonstration — a second room through the interview machinery, approval waits for its outcome" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The applicant sees §16's pipeline

**Files:**
- Create: `lib/application-tracker.ts`
- Modify:
  - `lib/actions/applications.ts` (`getMyInstructorApplication` and `MyApplication` only)
  - `app/(platform)/dashboard/become-instructor/page.tsx`
  - `app/(marketing)/teach/page.tsx`

**Interfaces:**
- Consumes: `ITeachingDemo` (Task 1); `InterviewInfo`.
- Produces:
  - `type TrackerStep = { key: "submitted" | "under_review" | "interview" | "demo" | "decision"; label: string }`.
  - `trackerFor(status: string, demoRequested: boolean): { steps: TrackerStep[]; current: number }`, which is pure.
  - `MyApplication` gains `demoRequested: boolean` and `demo: InterviewInfo | null`. `demo` is the room while it hasn't ended; the outcome is never exposed.

- [ ] **Step 1: The assert script, failing first.** Write `$SCRATCH/tracker.ts`:

```ts
import assert from "node:assert/strict"
import { trackerFor } from "@/lib/application-tracker"

const labels = (s: string, d: boolean) => trackerFor(s, d).steps.map((x) => x.label)
assert.deepEqual(labels("submitted", false), ["Submitted", "Under review", "Interview", "Decision"])
assert.deepEqual(labels("interview_scheduled", true), ["Submitted", "Under review", "Interview", "Teaching demonstration", "Decision"])
assert.equal(trackerFor("submitted", false).current, 0)
assert.equal(trackerFor("under_review", true).current, 1)
assert.equal(trackerFor("interview_scheduled", false).current, 2)
assert.equal(trackerFor("interview_scheduled", true).current, 3)
assert.equal(trackerFor("approved", true).current, 4)
assert.equal(trackerFor("rejected", false).current, 3)
assert.equal(trackerFor("withdrawn", false).current, 0)
console.log("application-tracker: all assertions passed")
```

  Run `npx tsx --tsconfig ./tsconfig.json "$SCRATCH/tracker.ts"`. Expected: it fails, because the module doesn't exist.

- [ ] **Step 2: `lib/application-tracker.ts`.** A pure module with no imports. The demo step sits between Interview and Decision only when `demoRequested`. `approved` and `rejected` map to the last step; anything unknown maps to 0. The doc comment cites institutional blueprint §16 and D29.

- [ ] **Step 3: Run the script.** Expected: `application-tracker: all assertions passed`.

- [ ] **Step 4: `getMyInstructorApplication`.**
  - `demoRequested: Boolean(app.demo?.requested)`.
  - `demo`: read the demo meeting as the function reads the interview's (`select("scheduledAt status")`). While it isn't `"ended"`, return `{ meetingId, scheduledAt, joinPath: `/dashboard/meetings?join=${meetingId}` }`; otherwise `null`.

- [ ] **Step 5: `/dashboard/become-instructor`.**
  - Delete `TRACKER_STEPS` and `statusIndex`. `StatusTracker` takes `{ status, demoRequested }` and renders `trackerFor(...)`.
  - Its labels lose `whitespace-nowrap` and become `text-center leading-tight max-sm:max-w-[4.75rem]`, so five steps fit at 320 px. Keep the circles and connectors as they are.
  - Pass `demoRequested={application.demoRequested}`.
  - In the status line, replace `: "interview scheduled — see below"}` with: `application.demo ? "teaching demonstration scheduled — see below" : "interview scheduled — see below"`.
  - After the interview card, add the demo card when `application.status === "interview_scheduled" && application.demo`. Copy the interview card's markup with this copy:
    - heading: "Your teaching demonstration";
    - the date, formatted as the interview's;
    - "Join at the scheduled time — you'll be admitted from the waiting room.";
    - button: "Join teaching demonstration" → `application.demo.joinPath`.
  - Leave the page's `h1` and its three-card "How it works" alone (ruling 18).

- [ ] **Step 6: `/teach` "How it works" becomes §16's pipeline.** Replace the `STEPS` array with:

```ts
/** From application to a faculty dashboard — institutional blueprint §16. */
const STEPS = [
  { title: "Application", body: "Tell us what you'd like to teach and why, and upload your CV. It takes about ten minutes." },
  { title: "Academic review", body: "Our team reads every application. You'll hear back by email and in the app." },
  {
    title: "Interview",
    body: "We schedule a short call on the platform — usually a few times for you to pick from — and you join it from your dashboard.",
  },
  {
    title: "Teaching demonstration",
    body: "Where appropriate, the reviewer asks you to give a teaching demonstration on the platform. You join it from your dashboard, like the interview.",
  },
  { title: "Approval", body: "We decide after the interview, and the demonstration if there was one, and tell you by email and in the app." },
  {
    title: "Onboarding",
    body: "Accept the instructor agreement, complete your profile and signature, verify your identity for payouts, and read the teaching standards, curriculum guidelines and platform training. Then you receive your WMA Faculty credential.",
  },
] as const
```

- [ ] **Step 7: Verify.**
  - Run `fx applicant` and set `APP` to its id. As `student`, open `/dashboard/become-instructor` in the browser.
    - Expected: four steps, with "Interview" current and no demo card.
  - Run `fx demo-room $APP 2880` and reload.
    - Expected: five steps, with "Teaching demonstration" current and `aria-current="step"` on it.
    - The card "Your teaching demonstration" shows. Its button's `href` is `/dashboard/meetings?join=<meetingId>`.
    - The status line says "teaching demonstration scheduled — see below".
  - At 390 and 320 px: no horizontal scroll, and "Teaching demonstration" wraps onto two lines inside its column.
  - Run `text /teach | grep -oE "Academic review|Teaching demonstration|Onboarding|WMA Faculty credential" | sort -u`.
    - Expected: all four.
  - Run `text /teach | grep -c "Admin review"`. Expected: `0`.
  - Run `fx reset-student`.

- [ ] **Step 8: Lint, typecheck, commit.**

```bash
for f in lib/application-tracker.ts lib/actions/applications.ts "app/(platform)/dashboard/become-instructor/page.tsx" "app/(marketing)/teach/page.tsx"; do npx eslint "$f"; done
npx tsc --noEmit
git add lib/application-tracker.ts lib/actions/applications.ts "app/(platform)/dashboard/become-instructor/page.tsx" "app/(marketing)/teach/page.tsx"
git commit -m "feat(faculty): applicants follow the §16 pipeline — a teaching demonstration step when one is requested" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Faculty handbook and the onboarding checklist

**Files:**
- Create:
  - `lib/faculty-handbook.ts`
  - `app/(instructor)/instructor/handbook/page.tsx`
  - `app/(instructor)/instructor/handbook/[slug]/page.tsx`
  - `components/instructor/handbook-acknowledge.tsx`
- Modify:
  - `lib/db/models/user.ts`
  - `lib/actions/applications.ts` (the approval's `instructorProfile` object only)
  - `lib/actions/instructor-onboarding.ts`
  - `components/instructor/onboarding-checklist.tsx`

**Interfaces:**
- Produces:
  - In `lib/faculty-handbook.ts`:
    - `HANDBOOK_APPROVED: boolean`, `HANDBOOK_KEYS`, `type HandbookKey`, `HANDBOOK_PAGES: readonly HandbookPage[]`, `handbookPageBySlug(slug: string): HandbookPage | null`;
    - `type HandbookFigures`, `type HandbookSection`, `handbookSections(key: HandbookKey, figures: HandbookFigures): HandbookSection[]`. All exact shapes are in step 3.
  - On `IUser.instructorProfile`: `handbook?: { teachingStandardsAt: Date | null; curriculumGuidelinesAt: Date | null; platformTrainingAt: Date | null }` and `credential?: { id: string; issuedAt: Date } | null`.
  - `InstructorOnboarding` gains `handbook: Record<HandbookKey, boolean>`. `allDone` also requires all three.
  - `acknowledgeHandbook(key: HandbookKey): Promise<{ success: true; data: { acknowledgedAt: string } } | { success: false; error: string }>`.
  - `getMyHandbookStatus(): Promise<Record<HandbookKey, string | null>>` (ISO or null), for the handbook pages.
  - `HandbookAcknowledge({ handbookKey, title, acknowledgedAt }: { handbookKey: HandbookKey; title: string; acknowledgedAt: string | null })`, a client component.

- [ ] **Step 1: The assert script, failing first.** Write `$SCRATCH/handbook.ts`:

```ts
import assert from "node:assert/strict"
import { HANDBOOK_KEYS, HANDBOOK_PAGES, handbookPageBySlug, handbookSections } from "@/lib/faculty-handbook"

const fig = { facultyShare: 0.85, creatorShareOwnLink: 0.85, creatorShareAcademy: 0.5, referralRate: 0.1, clearingDays: 7 }
assert.deepEqual(HANDBOOK_PAGES.map((p) => p.slug), ["teaching-standards", "curriculum-guidelines", "platform-training"])
assert.deepEqual(HANDBOOK_PAGES.map((p) => p.key), [...HANDBOOK_KEYS])
assert.equal(handbookPageBySlug("platform-training")?.key, "platformTraining")
assert.equal(handbookPageBySlug("nope"), null)
const all = HANDBOOK_KEYS.map((k) => JSON.stringify(handbookSections(k, fig))).join(" ")
for (const s of ["85%", "50%", "10%", "7 days", "15 minutes", "We teach people how to turn knowledge into economic value."]) assert.ok(all.includes(s), s)
assert.ok(!/\bpackages?\b|\bsellers?\b/i.test(all), "new vocabulary only")
for (const k of HANDBOOK_KEYS) for (const sec of handbookSections(k, fig)) assert.ok(sec.heading && sec.blocks.length > 0, `${k}: ${sec.heading}`)
console.log("faculty-handbook: all assertions passed")
```

  Run it (`npx tsx --tsconfig ./tsconfig.json "$SCRATCH/handbook.ts"`). Expected: it fails, because the module doesn't exist.

- [ ] **Step 2: The user schema.**
  - **Interface.** In `IUser.instructorProfile`, after `totalEarnings: number`, add `handbook?` and `credential?` as in Interfaces. Their doc comments:
    - "acknowledged handbook pages (institutional blueprint §16, D29)";
    - "WMA Faculty credential, set once by `ensureFacultyCredential`, never rewritten".
  - **Schema.** After `totalEarnings: { type: Number, default: 0 },`:

    ```ts
          handbook: {
            teachingStandardsAt: { type: Date, default: null },
            curriculumGuidelinesAt: { type: Date, default: null },
            platformTrainingAt: { type: Date, default: null },
          },
          credential: {
            type: new Schema({ id: { type: String, required: true }, issuedAt: { type: Date, required: true } }, { _id: false }),
            default: null,
          },
    ```

  - **Index.** After `UserSchema.index({ "referredBy.userId": 1 }, { sparse: true })`, add `UserSchema.index({ "instructorProfile.credential.id": 1 }, { unique: true, partialFilterExpression: { "instructorProfile.credential.id": { $type: "string" } }, name: "facultyCredential_unique" })`, with a comment: a partial filter, not `sparse`, as on `certificateId`.

- [ ] **Step 3: `lib/faculty-handbook.ts`.** This is the exact copy. It is client-safe: it imports only `sharePercent` from `@/lib/marketplace` and `HOST_EARLY_START_MS` from `@/lib/class-schedule`. `handbookSections` returns the sections below, with `{…}` filled from `figures`: `sharePercent` for rates, `` `${clearingDays} days` ``, and `HOST_EARLY_START_MS / 60_000` minutes.

````ts
/**
 * The faculty handbook — institutional blueprint §16 (Teaching standards →
 * Curriculum guidelines → Platform training), D29. The one home for its copy.
 *
 * OWNER SIGN-OFF REQUIRED. Drafted 2026-10-19 from the blueprint and the
 * platform's real rules. Every figure is either passed in from the constant
 * that enforces it or is a literal whose source is named beside it. Until the
 * owner approves the text, HANDBOOK_APPROVED stays false and each page shows
 * "Draft". Client-safe: the onboarding checklist reads the titles.
 */
export const HANDBOOK_APPROVED: boolean = false

export const HANDBOOK_KEYS = ["teachingStandards", "curriculumGuidelines", "platformTraining"] as const
export type HandbookKey = (typeof HANDBOOK_KEYS)[number]
export type HandbookPage = { key: HandbookKey; slug: string; title: string; summary: string; checklistLabel: string }
export type HandbookFigures = {
  facultyShare: number        // INSTRUCTOR_REVENUE_SHARE
  creatorShareOwnLink: number // MARKETPLACE_SHARE_OWN_LINK
  creatorShareAcademy: number // MARKETPLACE_SHARE_ACADEMY
  referralRate: number        // REFERRAL_COMMISSION_RATE
  clearingDays: number        // EARNINGS_CLEARING_DAYS
}
export type HandbookBlock = { kind: "p"; text: string } | { kind: "list"; items: { title?: string; text: string }[] }
export type HandbookSection = { heading: string; blocks: HandbookBlock[] }

export const HANDBOOK_PAGES: readonly HandbookPage[] = [
  { key: "teachingStandards", slug: "teaching-standards", title: "Teaching standards",
    summary: "What a WMA program sets out to do, and what every learner can count on from you.",
    checklistLabel: "Read the teaching standards" },
  { key: "curriculumGuidelines", slug: "curriculum-guidelines", title: "Curriculum guidelines",
    summary: "How a program is built here: plans, lessons, assessments, assignments and certificates.",
    checklistLabel: "Read the curriculum guidelines" },
  { key: "platformTraining", slug: "platform-training", title: "Platform training",
    summary: "Your faculty dashboard, live classes, mentorship and how you are paid.",
    checklistLabel: "Complete the platform training" },
]

teachingStandards:
  "Why we teach"
    p  "WorldStreet Mastery Academy exists to equip people with knowledge that has utility, develop that knowledge into mastery through structured learning and application, and help them use their mastery to transform their personal financial capacity."   // §1
    p  "We teach people how to turn knowledge into economic value."                                                                                                                                                       // §2
  "The Mastery Journey"
    p  "Every program carries a learner through five stages:"
    list  Discover — "The learner discovers a field, skill or economic opportunity."
          Learn — "The learner acquires foundational knowledge."
          Master — "The learner develops competence through structured practice, mentorship and assessment."
          Apply — "The learner applies the knowledge to real-world problems, projects or opportunities."
          Liquidate — "The learner learns how to convert the acquired capability into economic value."                                                                                                                   // §5
  "What every learner can count on"
    list  "Classes run when they are scheduled. Learners see each class on their dashboard and are reminded a day and an hour before it starts. You can open the room up to {early} minutes early."
          "Every submission is graded. Give a grade from 0 to 100 and written feedback; the learner sees both."
          "Questions are answered. Learners whose plan includes instructor Q&A can message you directly."
          "Executive learners get you one to one. They propose times for a private session; you confirm one and keep their roadmap up to date."
  "Teach to the plan"
    p  "Each learner buys a plan — Basic, Standard or Executive — and the plan decides what they receive: live classes, instructor Q&A, assignments, a certificate, private mentorship and priority support. The platform enforces it: a learner can't join a class, message you or submit work that their plan doesn't include. Promise learners only what their plan includes."
  "Faculty and Marketplace Creators"
    p  "You teach as WMA faculty. Marketplace Creators, who sell their own courses in the Academy Marketplace, remain distinct from official WMA faculty."                                                                 // §6, §17

curriculumGuidelines:
  "Programs and plans"
    p  "A program is what a learner learns — for example, Crypto Trading Mastery. A plan is how they learn it: Basic, Standard or Executive. Every program belongs to one school."                                            // §9
    p  "Each plan has its own price, inclusions and lessons. You set them in the program editor."
  "Lessons"
    list  "Lessons sit in sections and play in the order you set."
          "A free preview lesson is open to anyone, enrolled or not."
          "A lesson can require a plan. Learners on a lower plan see it locked, but only while the program still sells that plan."
  "Assessments"
    list  "Each program can have one final exam. It opens when a learner has completed every lesson."
          "You set the pass mark (70% unless you change it), the time limit (30 minutes by default) and the number of attempts (3 by default; 0 means unlimited)."   // schema defaults, lib/db/models/exam.ts
          "When a program requires its final exam, a learner completes the program, and receives a certificate, only by passing it."
          "Lesson quizzes are practice. They never block completion."
  "Assignments"
    list  "Assignments are practical work set on a program. Learners whose plan includes assignments can submit them."
          "A submission holds text and up to three files of up to 25 MB each. Files are private: only the learner, you and admins can open them."   // MAX_SUBMISSION_FILES / MAX_SUBMISSION_BYTES, lib/actions/assignments.ts
          "A learner can replace a submission until you grade it. Due dates are shown to learners but not enforced."
  "Certificates"
    list  "A learner whose plan includes the certificate receives one on completing the program, with a certificate ID anyone can verify."
          "Certificates carry your signature. Until you add one in Settings, your learners' certificates read “Pending Instructor Signature”."
  "Communities"
    p  "Each program can link one community group. Add its link in the program editor; learners with access to the program see it."

platformTraining:
  "Your faculty dashboard"
    list  Overview — "Today's classes, the week ahead, your programs and what is waiting on you."
          My Students — "Every learner in your programs. Open one to see their lessons, exams, assignments and classes."
          My Courses — "Your programs' lessons, materials, exams and assignments."
          Live Classroom — "Start classes, run your Executive mentorship sessions and keep roadmaps."
          Calendar — "Schedule classes and check their recordings."
          Earnings — "Every sale, refund and commission, and when each clears."
          WMA Partners — "Your partner code and link."
  "Live classes"
    list  "Schedule a class in Calendar. You can start it up to {early} minutes before its time."
          "When you start a class, learners whose plan includes live classes are told it is live and join from their dashboard."
          "Every class is recorded. The recording appears for those learners once it has been processed; they can watch it but not download it. You can rename or hide a recording."
  "Grading"
    p  "Create assignments from the program's page in My Courses. Submissions waiting for a grade appear in your to-do list on the Overview, oldest first."
  "Mentorship (Executive)"
    list  "Executive learners propose up to three times, at least an hour ahead and no more than 60 days out."   // MIN_LEAD_MS / MAX_AHEAD_MS, lib/actions/mentorship.ts
          "Confirm one in Live Classroom and it becomes a private meeting that only you, the learner and admins can join."
          "Keep each mentee's roadmap there too; the learner sees it on their dashboard."
  "How you are paid"
    list  "You earn {facultyShare} of every sale of your programs."
          "In the Academy Marketplace, you keep {creatorShareOwnLink} of sales made through your own link and {creatorShareAcademy} of sales the Academy makes."
          "Each earning clears {clearingDays} days after the sale (refund protection) into your WorldStreet wallet. You withdraw from the WorldStreet dashboard, where identity verification happens."
          "If a sale is refunded, its earning is taken back: reversed before it clears, or deducted from your wallet after."
          "WMA Partners: when someone you invite makes their first paid purchase, {referralRate} of it is yours, paid like a sale."
  "Your WMA Faculty credential"
    p  "Accept the instructor agreement, complete your profile, add your signature, verify your identity for payouts and acknowledge these three handbook pages, and you receive your WMA Faculty credential: an ID that starts WMAF-. It shows on your profile."
````

  The outline is the content. Write it as typed `HandbookSection[]` literals, one per key, inside `handbookSections`. A list item written `Title — "text"` becomes `{ title, text }`.

- [ ] **Step 4: Run the script.** Expected: `faculty-handbook: all assertions passed`.

- [ ] **Step 5: The actions, in `lib/actions/instructor-onboarding.ts`.**
  - **`getInstructorOnboarding`.**
    - Extend the select to `"bio signatureUrl instructorAgreement instructorProfile.handbook instructorProfile.credential"`.
    - Add `handbook: { teachingStandards: Boolean(h?.teachingStandardsAt), curriculumGuidelines: …, platformTraining: … }`.
    - `allDone` also requires all three handbook flags.
  - **`acknowledgeHandbook(key)`.**
    - Caller must be `INSTRUCTOR` or `ADMIN`, else `"Instructor access required"`.
    - Zod `z.enum(HANDBOOK_KEYS)`, failing with `"Unknown handbook page"`.
    - `const path = \`instructorProfile.handbook.${key}At\``, then `User.updateOne({ _id: me.id, [path]: null }, { $set: { [path]: new Date() } })`. The filter means the first acknowledgement wins.
    - Re-read the stored date, then revalidate `/instructor`, `/instructor/handbook` and `/instructor/handbook/<slug>`.
  - **`getMyHandbookStatus()`** returns the three ISO dates or null, for the caller only. It returns all nulls on any failure.

- [ ] **Step 6: The pages.**
  - **`/instructor/handbook`** (RSC):
    - Topbar "Handbook"; PageHeader "Faculty handbook", subline "Teaching standards, curriculum guidelines and platform training. Read each one and acknowledge it."
    - Three `CardShell`s in `HANDBOOK_PAGES` order. Each has the title, summary and status ("Acknowledged {shortDate}" with `CircleCheckBigIcon` in `text-ws-success`, or "Not yet acknowledged"), and the whole card links to `/instructor/handbook/<slug>`.
    - While `!HANDBOOK_APPROVED`, a muted chip "Draft · awaiting approval" sits beside the header.
  - **`/instructor/handbook/[slug]`** (RSC):
    - `notFound()` when `handbookPageBySlug` returns null.
    - `BackAction` to `/instructor/handbook`, the title as `h1`, the summary and the same draft chip.
    - The sections from `handbookSections(page.key, { facultyShare: INSTRUCTOR_REVENUE_SHARE, creatorShareOwnLink: MARKETPLACE_SHARE_OWN_LINK, creatorShareAcademy: MARKETPLACE_SHARE_ACADEMY, referralRate: REFERRAL_COMMISSION_RATE, clearingDays: EARNINGS_CLEARING_DAYS })`, imported from `@/lib/db/models`. Each section is an `h2` with paragraphs and `<ul>` lists (a titled item renders as `<strong>title</strong> — text`), in `max-w-2xl` prose.
    - At the foot: `<HandbookAcknowledge handbookKey={page.key} title={page.title} acknowledgedAt={status[page.key]} />`.
  - **`components/instructor/handbook-acknowledge.tsx`** (client):
    - When acknowledged: "You acknowledged the {title} on {date}." (en-GB date).
    - Otherwise the button "I have read the {title}". Its `onClick` calls `acknowledgeHandbook`; on success it runs `router.refresh()` and `queryClient.invalidateQueries({ queryKey: ["instructor-onboarding"] })`. An error shows under it.
    - `{title}` is `title.toLowerCase()` in both sentences ("I have read the platform training").

- [ ] **Step 7: The checklist.** In `components/instructor/onboarding-checklist.tsx`:
  - Insert one `Item` per `HANDBOOK_PAGES` entry before `label="Create your first course"`: `done={data.handbook[p.key]}`, `label={p.checklistLabel}`, `href={\`/instructor/handbook/${p.slug}\`}`.
  - Under the description, add one line: "Finish them all to receive your WMA Faculty credential."

- [ ] **Step 8: The approval carries the new fields** (ruling 10). In `adminDecideApplication`'s `instructorProfile` object, after `totalEarnings: user.instructorProfile?.totalEarnings ?? 0,`:

```ts
              handbook: user.instructorProfile?.handbook ?? { teachingStandardsAt: null, curriculumGuidelinesAt: null, platformTrainingAt: null },
              credential: user.instructorProfile?.credential ?? null,
```

  Extend the comment above it to name both fields.

- [ ] **Step 9: Verify (restart the server: schema).**
  - **Carry-over** (Review Focus 2).
    - Run `fx applicant credential` (no demo). As `admin`, approve `$APP` with the note "Fixture approval".
    - `fx user student@worldstreet.academy` → `"role":"INSTRUCTOR"`, `credential.id` `"WMAF-TEST01"`, and `handbook.teachingStandardsAt` still `2026-01-04T10:00:00.000Z`.
    - Then `fx reset-student`.
  - **The handbook flow.** Add to `$KIT/fx.cjs`: **`onboarding <email> ready|clear`**.
    - `ready`: `$set bio: "Fixture bio: twelve years teaching forex risk.", signatureUrl: "https://example.com/fixture-signature.png", instructorAgreement: { acceptedAt: now, version: "2026-07" }`, and `$unset "instructorProfile.handbook"` and `"instructorProfile.credential"`.
    - `clear`: `$set bio: null, signatureUrl: null, "instructorAgreement.acceptedAt": null` with the same two `$unset`s.
    - Print `ok`.
  - Run `fx onboarding instructor@worldstreet.academy ready`. As `instructor`, `/instructor` shows the checklist with the three handbook items.
  - Run `text /instructor/handbook instructor | grep -oE "Teaching standards|Curriculum guidelines|Platform training|Not yet acknowledged|Draft · awaiting approval" | sort | uniq -c`.
    - Expected: each title, three `Not yet acknowledged` and one `Draft · awaiting approval`.
  - Open `/instructor/handbook/teaching-standards` in the browser and press "I have read the teaching standards".
    - Expected: the sentence "You acknowledged the teaching standards on …".
    - `fx user instructor@worldstreet.academy` → `handbook.teachingStandardsAt` is set.
    - Reload: the date is unchanged.
  - Run `text /instructor/handbook/platform-training instructor | grep -oE "85%|50%|10%|7 days|15 minutes" | sort -u`.
    - Expected: all five.
  - Run `text /instructor/handbook/nope instructor | grep -c "Lost in Space"`. Expected: `1`.
  - At 390 px: no horizontal scroll on either handbook page.

- [ ] **Step 10: Lint, typecheck, commit.**

```bash
for f in lib/db/models/user.ts lib/faculty-handbook.ts lib/actions/instructor-onboarding.ts lib/actions/applications.ts components/instructor/onboarding-checklist.tsx components/instructor/handbook-acknowledge.tsx "app/(instructor)/instructor/handbook/page.tsx" "app/(instructor)/instructor/handbook/[slug]/page.tsx"; do npx eslint "$f"; done
npx tsc --noEmit
git add lib/db/models/user.ts lib/faculty-handbook.ts lib/actions/instructor-onboarding.ts lib/actions/applications.ts components/instructor/onboarding-checklist.tsx components/instructor/handbook-acknowledge.tsx "app/(instructor)/instructor/handbook"
git commit -m "feat(faculty): the faculty handbook — teaching standards, curriculum guidelines and platform training, acknowledged in onboarding" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The WMA Faculty credential

**Files:**
- Create: `lib/faculty-credential.ts`, `components/instructor/faculty-credential-card.tsx`
- Modify:
  - `lib/actions/instructor-onboarding.ts`
  - `app/(instructor)/instructor/profile/page.tsx`
  - `lib/actions/student.ts` (`FacultyProfile` and `fetchFacultyProfile` only)
  - `app/(marketing)/faculty/[username]/page.tsx`

**Interfaces:**
- Consumes: the `instructorProfile.credential` schema and `InstructorOnboarding.handbook` (Task 3).
- Produces:
  - In `lib/faculty-credential.ts`:
    - `FACULTY_CREDENTIAL_PREFIX = "WMAF"`, `FACULTY_CREDENTIAL_NAME = "WMA Faculty"`;
    - `generateFacultyCredentialId(): string`, `isFacultyCredentialId(v: string): boolean`;
    - `facultySinceLabel(issuedAt: Date | string): string` ("since October 2026") and `credentialIssuedLabel(issuedAt: Date | string): string` ("19 October 2026");
    - `type KycState = "verified" | "unverified" | "not_required" | "unknown"`;
    - `credentialReady(i: { agreementAccepted: boolean; profileComplete: boolean; signatureSet: boolean; handbookDone: boolean; kyc: KycState }): boolean`.
  - `InstructorOnboarding` gains `credentialReady: boolean` and `credential: { id: string; issuedAt: string } | null`.
  - `getMyFacultyCredential(): Promise<{ id: string; issuedAt: string } | null>`.
  - `FacultyProfile` gains `facultySince: string | null`.

- [ ] **Step 1: The assert script, failing first.** Write `$SCRATCH/credential.ts`:

```ts
import assert from "node:assert/strict"
import { credentialIssuedLabel, credentialReady, facultySinceLabel, generateFacultyCredentialId, isFacultyCredentialId } from "@/lib/faculty-credential"

const ids = Array.from({ length: 10_000 }, generateFacultyCredentialId)
for (const id of ids) assert.match(id, /^WMAF-[0-9A-HJKMNP-TV-Z]{6}$/)
assert.ok(new Set(ids).size >= 9_995)
assert.equal(isFacultyCredentialId("WMAF-0A1B2C"), true)
for (const bad of ["WMAF-0A1B2", "WMAF-0A1B2I", "wmaf-0a1b2c", "WSA-0A1B2C", " WMAF-0A1B2C"]) assert.equal(isFacultyCredentialId(bad), false, bad)
assert.equal(facultySinceLabel("2026-10-19T08:00:00Z"), "since October 2026")
assert.equal(facultySinceLabel("2026-09-30T23:30:00Z"), "since October 2026") // Lagos is UTC+1
assert.equal(credentialIssuedLabel("2026-10-19T08:00:00Z"), "19 October 2026")
const ok = { agreementAccepted: true, profileComplete: true, signatureSet: true, handbookDone: true } as const
assert.equal(credentialReady({ ...ok, kyc: "verified" }), true)
assert.equal(credentialReady({ ...ok, kyc: "not_required" }), true)
assert.equal(credentialReady({ ...ok, kyc: "unknown" }), false) // wallet unreachable: defer, never skip KYC
assert.equal(credentialReady({ ...ok, kyc: "unverified" }), false)
assert.equal(credentialReady({ ...ok, handbookDone: false, kyc: "verified" }), false)
console.log("faculty-credential: all assertions passed")
```

  Run it. Expected: it fails, because the module doesn't exist.

- [ ] **Step 2: `lib/faculty-credential.ts`.** It is pure and client-safe. Its only import is `COHORT_TIME_ZONE` from `@/lib/cohort`. Copy the style of `lib/certificate-id.ts`:
  - The same `CROCKFORD` alphabet.
  - `const value = crypto.getRandomValues(new Uint32Array(1))[0] >>> 2` gives exactly 30 bits, which is six 5-bit symbols with no modulo bias. Use Web Crypto, not `node:crypto`.
  - Labels are `en-GB` in `COHORT_TIME_ZONE`.
  - The doc comment cites D29 and says that the ID never changes once stored.

- [ ] **Step 3: Run the script.** Expected: `faculty-credential: all assertions passed`.

- [ ] **Step 4: Issuing the credential, in `lib/actions/instructor-onboarding.ts`.**
  - **A module-private `ensureFacultyCredential(userId: string): Promise<{ id: string; issuedAt: Date } | null>`.** Never export it.
    - It runs `User.updateOne({ _id: userId, "instructorProfile.credential.id": { $exists: false } }, { $set: { "instructorProfile.credential": { id, issuedAt: new Date() } } })`, trying two fresh IDs in turn.
    - `modifiedCount === 1` returns the new credential. Otherwise it re-reads and returns the stored one.
    - A duplicate key error (`code 11000` with `keyPattern` on `instructorProfile.credential.id`) moves on to the next ID.
    - It never throws: it logs `[Faculty] …` and returns null.
  - **Factor out a private `onboardingFor(me)`.** It computes today's state plus:
    - `kyc`: `walletEnabled()` false → `"not_required"`; else `getIdentityStatus` verified or unverified; else (the call threw) `"unknown"`;
    - `credentialReady({ …, handbookDone: all three, kyc })`.

    When ready and none is stored yet, it calls `ensureFacultyCredential(me.id)`. `getInstructorOnboarding` returns its result, with `credential` as ISO.
  - **`getMyFacultyCredential()`** runs the same `onboardingFor`, so a ready member also receives the credential from the profile page. It returns `credential`.
  - `allDone` is unchanged in meaning: every item, including "Create your first course".

- [ ] **Step 5: Where the credential shows.**
  - **`components/instructor/faculty-credential-card.tsx`** (server component, `Card` from `@/components/ui/card`, as `FacultyProfileCard` uses):
    - With a credential: `BadgeCheckIcon` in a 9px chip, "WMA Faculty", the ID in `font-semibold tracking-[0.04em] tabular-nums`, and "Issued {credentialIssuedLabel}".
    - Without one: "Your WMA Faculty credential", then "Finish your onboarding checklist on the Overview to receive it." and a link "Open the Overview" → `/instructor`.
  - **`app/(instructor)/instructor/profile/page.tsx`:** add `getMyFacultyCredential()` to the `Promise.all`, and render the card first in the `space-y-8` stack, before `<InstructorProfileClient`.
  - **`lib/actions/student.ts`:**
    - `FacultyUserDoc.instructorProfile` gains `credential?: { issuedAt?: Date | null } | null`.
    - `FacultyProfile` gains `facultySince: string | null`.
    - `fetchFacultyProfile` sets it to `facultySinceLabel(profile.credential.issuedAt)` when present, else null.
  - **`app/(marketing)/faculty/[username]/page.tsx`:** the eyebrow `Faculty` reads `` profile.facultySince ? `${FACULTY_CREDENTIAL_NAME} · ${profile.facultySince}` : "Faculty" ``. It stays behind `FACULTY_PUBLIC` (ruling 17).

- [ ] **Step 6: Verify.**
  - Run `fx onboarding instructor@worldstreet.academy ready`. As `instructor`, acknowledge two of the three pages.
    - `fx user instructor@worldstreet.academy` → `credential: null`.
  - Acknowledge the third, then open `/instructor`.
    - The checklist is gone: Sarah has programs, so `allDone` holds.
    - `fx user …` → `credential.id` matches `WMAF-[0-9A-HJKMNP-TV-Z]{6}`. Record it.
  - Reload `/instructor` twice. `fx user …` → the same ID.
  - Run `text /instructor/profile instructor | grep -oE "WMAF-[0-9A-Z]{6}|Issued [0-9]+ [A-Za-z]+ [0-9]{4}"`.
    - Expected: the recorded ID and today's date.
  - **The public line.** In the worktree only, set `FACULTY_PUBLIC` to `true` in `lib/faculty.ts`.
    - Run `text /faculty/sarah_chen guest | grep -o "WMA Faculty · since [A-Za-z]* [0-9]*"`. Expected: `WMA Faculty · since October 2026` (the current month).
    - Then run `git checkout -- lib/faculty.ts` and confirm that `git diff --stat lib/faculty.ts` prints nothing.
  - Run `fx onboarding instructor@worldstreet.academy clear`. `/instructor/profile` shows "Your WMA Faculty credential" with the Overview link, because the credential was unset.

- [ ] **Step 7: Lint, typecheck, commit.**

```bash
for f in lib/faculty-credential.ts lib/actions/instructor-onboarding.ts components/instructor/faculty-credential-card.tsx "app/(instructor)/instructor/profile/page.tsx" lib/actions/student.ts "app/(marketing)/faculty/[username]/page.tsx"; do npx eslint "$f"; done
npx tsc --noEmit
git add lib/faculty-credential.ts lib/actions/instructor-onboarding.ts components/instructor/faculty-credential-card.tsx "app/(instructor)/instructor/profile/page.tsx" lib/actions/student.ts "app/(marketing)/faculty/[username]/page.tsx"
git commit -m "feat(faculty): the WMA Faculty credential — a WMAF- ID issued when onboarding is complete" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The earnings ledger, and analytics that match it

**Files:**
- Create: `lib/faculty-format.ts`, `app/(instructor)/instructor/earnings/page.tsx`
- Modify:
  - `lib/actions/earnings.ts` (`EarningRow`, `InstructorEarnings` and `getMyInstructorEarnings` only)
  - `app/(instructor)/instructor/analytics/page.tsx`
  - `components/instructor/home/money-card.tsx`

**Interfaces:**
- Produces:
  - In `lib/faculty-format.ts`:
    - `EARNING_KIND_LABEL: Record<"sale" | "adjustment" | "referral", string>`;
    - `EARNING_STATUS_LABEL: Record<"pending" | "cleared" | "reversed", string>`;
    - `earningShareLabel(grossMinor: number, netMinor: number): string`;
    - `shortDate(iso: string): string` ("19 Oct 2026", Lagos zone).
  - `EarningRow` gains `courseId: string` and `learnerName: string | null` (`maskedName`).
  - `InstructorEarnings` gains `byCourse: { courseId: string; courseTitle: string; netMinor: number; sales: number }[]`, highest `netMinor` first (ruling 13).

- [ ] **Step 1: The assert script, failing first.** Write `$SCRATCH/format.ts`:

```ts
import assert from "node:assert/strict"
import { EARNING_KIND_LABEL, EARNING_STATUS_LABEL, earningShareLabel, shortDate } from "@/lib/faculty-format"

assert.equal(earningShareLabel(19900, 16915), "85%")
assert.equal(earningShareLabel(4900, 2450), "50%")
assert.equal(earningShareLabel(99900, 9990), "10%")
assert.equal(earningShareLabel(-19900, -16915), "85%")
assert.equal(earningShareLabel(0, 0), "—")
assert.deepEqual(EARNING_KIND_LABEL, { sale: "Sale", adjustment: "Refund", referral: "Partner commission" })
assert.deepEqual(EARNING_STATUS_LABEL, { pending: "Clearing", cleared: "In wallet", reversed: "Reversed" })
assert.equal(shortDate("2026-10-19T08:00:00Z"), "19 Oct 2026")
assert.equal(shortDate("2026-10-19T23:30:00Z"), "20 Oct 2026") // Lagos is UTC+1
console.log("faculty-format: all assertions passed")
```

  Run it. Expected: it fails, because the module doesn't exist.

- [ ] **Step 2: `lib/faculty-format.ts`.** It is pure. The share is `Math.round((net / gross) * 100)` + `%`, or `—` when gross is 0. `shortDate` uses `en-GB` `{ day: "numeric", month: "short", year: "numeric", timeZone: COHORT_TIME_ZONE }`. Run the script. Expected: `faculty-format: all assertions passed`.

- [ ] **Step 3: The read model (ruling 13).** In `getMyInstructorEarnings` only:
  - Rows: add `.populate("student", "firstName lastName")`. Map `courseId: String((r.course as { _id?: unknown })?._id ?? r.course)` and `learnerName` (`maskedName(first, last)` when a student is set, else null).
  - Add a third aggregate to the `Promise.all`:

    ```ts
          Earning.aggregate<{ _id: Types.ObjectId; netMinor: number; sales: number }>([
            { $match: { instructor: new Types.ObjectId(user.id), kind: { $in: ["sale", "adjustment"] }, status: { $ne: "reversed" } } },
            { $group: { _id: "$course", netMinor: { $sum: "$netMinor" }, sales: { $sum: { $cond: [{ $eq: ["$kind", "sale"] }, 1, 0] } } } },
          ]),
    ```

  - Titles come from one `Course.find({ _id: { $in } }).select("title")`. A missing title reads "Program".
  - The clearing pass, the totals, the `limit(100)` and `clearingDays` stay as they are.

- [ ] **Step 4: `/instructor/earnings`** (RSC, from `getMyInstructorEarnings()`):
  - **Header.** Topbar "Earnings"; PageHeader "Earnings", subline "Your share of every sale, from the ledger." Its action is an outline pill link "Withdraw on the WorldStreet dashboard" → `earnings.withdrawUrl`, which opens in a new tab.
  - **Totals.** Three `StatTile`s (`@/components/shared/stat-tile`), all `formatMinor` from `@/lib/teaching-home`:
    - "Clearing", `pendingMinor`, context `` `${clearingDays}-day refund window` ``;
    - "In your wallet", `clearedMinor`;
    - "Lifetime net", `lifetimeNetMinor`.
  - **"By program".** A `CardShell` list: the title, `` `${sales} sales` ``, and the net (`tabular-nums`).
  - **"Ledger".** A `CardShell` with the subtitle "The 100 most recent entries".
    - At `lg` and up, a table: Date (`shortDate(createdAt)`) · Kind · Program · Learner (`learnerName ?? "—"`) · Gross · Share · Net · Status · Clears.
    - "Clears" is `shortDate(availableAt)` while pending, `shortDate(clearedAt)` once cleared, `—` when reversed.
    - Below `lg`, one stacked row per entry: the program and the net on the first line; kind · learner · status · date on the second.
  - **Empty states.** `null` or no rows → `EmptyState` (`@/components/ui/system`), title "No earnings yet", description "Your share of each sale appears here once a learner buys one of your programs."

- [ ] **Step 5: Analytics and the money card.**
  - **Analytics.** In `app/(instructor)/instructor/analytics/page.tsx`, replace the expression that begins `` `$${((course.price ?? 0) * course.enrolledCount * 0.85) `` with the course's `byCourse` net:
    - build a `Map` from `earnings?.byCourse`;
    - a paid course shows `formatMinor(map.get(course.id) ?? 0)`, or `"—"` while `earnings` is undefined;
    - a free course still shows "Free".
  - Change the label `Revenue (est.)` to `Revenue (net)`, and replace the comment with "From the earnings ledger (sales minus refunds); partner commissions are excluded".
  - **Money card.** In `money-card.tsx`, the `<Link href="/instructor/settings" className={LINK}>` becomes `href="/instructor/earnings"`. Its label stays.

- [ ] **Step 6: Verify the money** (Review Focus 5). Add to `$KIT/fx.cjs`: **`earnings`**.
  - It sets `instructor = Sarah` on the courses with slugs `forex-trading-mastery` (F) and `crypto-trading-mastery` (C).
  - It deletes **every** `earnings` row with `instructor = Sarah` (local DB only; it prints the count).
  - It inserts six rows. Each has `instructor: Sarah._id`, `instructorAuthUserId: Sarah.authUserId`, `student: <student _id>`, `currency: "USD"`, `creditReference: "p19-fixture-<n>"` and `p19: true`:

    | n | kind | course | gross | fee | net | status | dates |
    |---|---|---|---|---|---|---|---|
    | 1 | sale | F | 19900 | 2985 | 16915 | pending | availableAt mins(7200), createdAt now |
    | 2 | sale | F | 19900 | 2985 | 16915 | cleared | clearedAt mins(-1440), availableAt mins(-1440), createdAt mins(-11520) |
    | 3 | adjustment | F | −19900 | −2985 | −16915 | pending | availableAt now, createdAt mins(-120) |
    | 4 | sale | C | 4900 | 735 | 4165 | reversed | availableAt mins(5760), createdAt mins(-4320) |
    | 5 | sale | C | 4900 | 735 | 4165 | pending | availableAt mins(4320), createdAt mins(-5760) |
    | 6 | referral | F | 99900 | 89910 | 9990 | pending | availableAt mins(7000), createdAt mins(-300) |

  - It prints `ok`.
  - **Checks.** Run `fx earnings`, then:
    - `text /instructor/earnings instructor | grep -oE '\$141\.55|\$169\.15|\$310\.70|\$41\.65|Partner commission|Refund|Reversed|10%|85%|Johnson D\.' | sort -u`. Expected: all ten.
    - `text /instructor/earnings instructor | grep -c '\$269\.05'`. Expected: `0`. That would be Forex with the commission wrongly counted (16915 + 9990).
    - In the browser, `/instructor/analytics` as `instructor`: Forex Trading Mastery reads `$169.15` and Crypto Trading Mastery reads `$41.65` under "Revenue (net)", the same as the ledger's "By program".
    - At 390 px, `/instructor/earnings` has no horizontal scroll.

- [ ] **Step 7: Verify that Marketplace Creators can't open it** (Review Focus 4). Add to `$KIT/fx.cjs`: **`seller <email> on|off`**, which sets `sellerStatus` to `"approved"` or `"none"` and prints `ok`.
  - Run `fx seller student@worldstreet.academy on`.
  - Run `curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" -b mock_persona=student $BASE/instructor/earnings`.
    - Expected: `307`, with a URL ending in `/instructor/courses`.
  - Run `fx seller student@worldstreet.academy off`.

- [ ] **Step 8: Lint, typecheck, commit.**

```bash
for f in lib/faculty-format.ts lib/actions/earnings.ts "app/(instructor)/instructor/earnings/page.tsx" "app/(instructor)/instructor/analytics/page.tsx" components/instructor/home/money-card.tsx; do npx eslint "$f"; done
npx tsc --noEmit
git add lib/faculty-format.ts lib/actions/earnings.ts "app/(instructor)/instructor/earnings/page.tsx" "app/(instructor)/instructor/analytics/page.tsx" components/instructor/home/money-card.tsx
git commit -m "feat(faculty): an earnings ledger, and analytics revenue from it instead of price x enrolled x 0.85" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: My Students

**Files:**
- Create:
  - `lib/faculty-students.ts`
  - `lib/faculty-seams.ts`
  - `lib/actions/faculty-students.ts`
  - `app/(instructor)/instructor/students/page.tsx`
  - `components/instructor/students/students-filters.tsx`
  - `components/instructor/students/students-list.tsx`

**Interfaces:**
- Consumes: `shortDate` (Task 5); `PACKAGE_LABEL` and `isPackageKey` (`lib/entitlements.ts`).
- Produces:
  - In `lib/faculty-students.ts` (pure):
    - `type PlanFilter = PackageKey | "full"`, `PLAN_FILTERS: readonly { value: PlanFilter; label: string }[]`;
    - `type FacultyStudentFilters = { program: string | null; plan: PlanFilter | null; cohort: number | null }`;
    - `parseStudentFilters(raw: Record<string, string | string[] | undefined>): FacultyStudentFilters`;
    - `studentsHref(f: FacultyStudentFilters): string`;
    - `planOf(packageKey: PackageKey | null | undefined): { key: PlanFilter; label: string }`;
    - `assignmentsLabel(graded: number, average: number | null): string`.
  - In `lib/faculty-seams.ts` (server-only; exact code in step 3): `type SeamEnrollment`, `type CohortTag`, `type MasteryPartKey`, `type MasteryResult`, `cohortsFor(rows)` and `masteryFor(rows)`.
  - In `lib/actions/faculty-students.ts`:
    - `type FacultyStudentRow = { enrollmentId: string; learner: { name: string; avatarUrl: string | null }; program: { id: string; title: string }; plan: { key: PlanFilter; label: string }; status: "active" | "completed"; cohort: CohortTag | null; progress: number; lastActiveAt: string | null; bestExam: { percent: number; passed: boolean } | null; assignments: { graded: number; average: number | null }; attendance: number | null; mastery: number | null }`;
    - `type FacultyStudentsView = { scope: "own" | "all"; programs: { id: string; title: string }[]; cohorts: CohortTag[]; masteryReady: boolean; rows: FacultyStudentRow[]; total: number; truncated: boolean }`;
    - `getFacultyStudents(filters: FacultyStudentFilters): Promise<{ success: true; data: FacultyStudentsView } | { success: false; error: string }>`.

- [ ] **Step 1: The assert script, failing first.** Write `$SCRATCH/students.ts`:

```ts
import assert from "node:assert/strict"
import { assignmentsLabel, parseStudentFilters, planOf, studentsHref } from "@/lib/faculty-students"

const ID = "6a6fc0ba6433bbbd6322bdfd"
assert.deepEqual(parseStudentFilters({}), { program: null, plan: null, cohort: null })
assert.deepEqual(parseStudentFilters({ program: ID, plan: "executive", cohort: "2" }), { program: ID, plan: "executive", cohort: 2 })
assert.deepEqual(parseStudentFilters({ program: "nope", plan: "gold", cohort: "0" }), { program: null, plan: null, cohort: null })
assert.equal(parseStudentFilters({ plan: ["full", "basic"] }).plan, "full")
assert.equal(parseStudentFilters({ cohort: "1.5" }).cohort, null)
assert.equal(parseStudentFilters({ cohort: "-1" }).cohort, null)
assert.equal(studentsHref({ program: null, plan: null, cohort: null }), "/instructor/students")
assert.equal(studentsHref({ program: ID, plan: "basic", cohort: 3 }), `/instructor/students?program=${ID}&plan=basic&cohort=3`)
assert.deepEqual(planOf(null), { key: "full", label: "Full access" })
assert.deepEqual(planOf("standard"), { key: "standard", label: "Standard" })
assert.equal(assignmentsLabel(0, null), "None graded")
assert.equal(assignmentsLabel(2, 75), "2 graded · avg 75")
console.log("faculty-students: all assertions passed")
```

  Run it. Expected: it fails, because the module doesn't exist.

- [ ] **Step 2: `lib/faculty-students.ts`.**
  - `program` must match `/^[a-f0-9]{24}$/`. `cohort` must be a whole number of at least 1. For array values, the first one counts.
  - `PLAN_FILTERS` lists, in order: basic, standard, executive (labels from `PACKAGE_LABEL`), then `{ value: "full", label: "Full access" }`.
  - `studentsHref` keeps only the set filters, in the order program, plan, cohort.
  - Run the script. Expected: `faculty-students: all assertions passed`.

- [ ] **Step 3: `lib/faculty-seams.ts`: the one seam file** (ruling 12). Write it exactly:

```ts
import "server-only"
import type { Types } from "mongoose"
import type { PackageKey } from "@/lib/db/models"

/*
 * The faculty dashboard's two seams (institutional blueprint Phase 19). Each
 * body is ONE line marked SEAM; whoever merges Phase 12 or Phase 16 into a tree
 * that has this file replaces that line with the fill below it, plus imports.
 * While a seam returns an empty map, My Students and Student Performance hide
 * every cohort or Mastery column, filter and card.
 */

/** The enrollment fields both seams receive (lean rows). */
export type SeamEnrollment = {
  _id: Types.ObjectId
  user: Types.ObjectId
  course: Types.ObjectId
  status: string
  packageKey?: PackageKey | null
  progress: number
  bestScorePercent?: number | null
  examPassed?: boolean
  purchasedAt: Date
  activatedAt?: Date | null
  createdAt: Date
}

export type CohortTag = { number: number; name: string }

export type MasteryPartKey = "completion" | "assessment" | "assignments" | "projects" | "attendance"
/** Phase 16's masteryScore() result (roadmap 16.3). Alias it to Phase 16's own type when filling. */
export type MasteryResult = { score: number | null; parts: { key: MasteryPartKey; value: number | null; weight: number }[] }

/**
 * Each enrollment's cohort, keyed by enrollment id.
 * Phase 12 fill (lib/cohort-calendar.ts + lib/cohort-rules.ts; pass the enrolment date Phase 12's read model passes):
 *   const { all } = await getCohortCalendar(); return new Map(rows.flatMap((r) => { const c = cohortForEnrolment(all, r.activatedAt ?? r.purchasedAt); return c ? [[r._id.toString(), { number: c.number, name: c.name }] as [string, CohortTag]] : [] }))
 */
export async function cohortsFor(rows: SeamEnrollment[]): Promise<Map<string, CohortTag>> {
  void rows // delete with the fill
  return new Map() // SEAM(phase-12)
}

/**
 * Each enrollment's Mastery Score and parts, keyed by enrollment id.
 * Phase 16 fill (lib/mastery-inputs.ts + lib/mastery-score.ts; masteryInputsForMany keyed by enrollment id):
 *   return new Map([...(await masteryInputsForMany(rows))].map(([id, inputs]) => [id, masteryScore(inputs)]))
 */
export async function masteryFor(rows: SeamEnrollment[]): Promise<Map<string, MasteryResult>> {
  void rows // delete with the fill
  return new Map() // SEAM(phase-16)
}
```

  - **Check first.** If `lib/cohort-rules.ts` and `lib/cohort-calendar.ts` already exist in the worktree (Phase 12 merged), apply the Phase 12 fill now, adjusting the date argument to Phase 12's real signature. Do the same with the Phase 16 fill if `lib/mastery-score.ts` and `lib/mastery-inputs.ts` exist. Record which seams you filled in the task report.
  - `void rows` only keeps the unused parameter from a lint warning. A fill replaces the `SEAM` line and deletes `void rows`.

- [ ] **Step 4: `getFacultyStudents`.** In `lib/actions/faculty-students.ts` (`"use server"`):
  1. `connectDB()`, then `getCurrentUser()`. Missing → `"You need to be signed in"`. Neither `INSTRUCTOR` nor `ADMIN` → `"Instructors only"`. Re-validate `filters` by passing them through `parseStudentFilters`, because server actions are callable with anything.
  2. **Scope.** An admin covers every course (`scope: "all"`). Anyone else covers `Course.find({ instructor: me }).select("_id")` (`"own"`).
  3. **Load once.** `Enrollment.find({ course: { $in: scopeIds }, status: { $in: ["active", "completed"] } })`, selecting the `SeamEnrollment` fields plus `lastAccessedAt` (omit the `course` filter for admins), `.lean()`.
  4. **Options and cohorts.** `programs` are the distinct courses among those rows, with titles from one `Course.find`, sorted by title. Then `cohortsFor(all rows)`. `cohorts` are the distinct tags, sorted by number.
  5. **Filter, in memory.** By `program` (an id outside the rows matches nothing), by `plan` (`"full"` means `packageKey` null), then by `cohort`.
  6. **Sort and cap.** Sort by `lastAccessedAt` descending (nulls last), then `purchasedAt` descending. `total` is the count, `MAX_ROWS = 500` is the cap, and `truncated = total > MAX_ROWS`.
  7. **Details for the capped rows only.**
     - Users: `firstName lastName avatarUrl`.
     - Graded submissions, as `teaching-home.ts` reads them through the assignment index: `Assignment.find({ course: { $in } }).select("_id")`, then `Submission.aggregate([{ $match: { assignment: { $in }, enrollment: { $in }, status: "graded" } }, { $group: { _id: "$enrollment", graded: { $sum: 1 }, average: { $avg: "$grade" } } }])`, with `Math.round` on the average.
     - `masteryFor(capped)`.
     - `bestExam` is `{ percent: bestScorePercent, passed: examPassed }` when `bestScorePercent !== null`.
     - `mastery` is the result's `score`, and `attendance` is its `attendance` part's `value`.
     - `masteryReady` is `masteryMap.size > 0`.

- [ ] **Step 5: The page and its parts.**
  - **`app/(instructor)/instructor/students/page.tsx`** (RSC, `searchParams: Promise<Record<string, string | string[] | undefined>>`):
    - Topbar "My Students"; PageHeader "My Students", subline "Every learner in your programs." (admins: "Every learner in every program.").
    - Then the filters, then a count line (`` `${total} learners` ``, `tabular-nums`), with "Showing the 500 most recently active." when `truncated`.
    - Then the list. A failure renders `EmptyState` with the error.
  - **`students-filters.tsx`** (client): copy the native-`<select>` GET form of `components/marketplace/marketplace-filters.tsx`.
    - Selects: Program ("All programs" plus `programs`), Plan ("All plans" plus `PLAN_FILTERS`), and Cohort ("All cohorts" plus `cohorts`, only when `cohorts.length > 0`).
    - A change navigates to `studentsHref(next)`.
    - A "Clear filters" link shows while any filter is set.
  - **`students-list.tsx`** (server):
    - **At `lg` and up, a table.** Columns: Learner (avatar and name, linking to `/instructor/students/<enrollmentId>`) · Program · Plan · Cohort (only when `cohorts.length > 0`) · Progress (a 4px bar plus `%`) · Last active (`shortDate`, or "Never") · Best exam (`85%` with "Passed" in `text-ws-success` when passed, or "—") · Assignments (`assignmentsLabel`) · "Attendance" and "Mastery Score" (only when `masteryReady`; `—` when null).
    - **Below `lg`, one `CardShell` row per learner.** It is one link: the name, `program · plan`, and progress with last active on the right.
    - **Empty states:**
      - no programs in scope → "You don't teach a program yet", with "Create a program" → `/instructor/courses/new`;
      - programs but no learners → "No learners yet";
      - filters matching nothing → "No learners match these filters", with "Clear filters" → `/instructor/students`.

- [ ] **Step 6: The fixture.** Add to `$KIT/fx.cjs`: **`roster`**. It is idempotent: it first deletes every `p19` roster row, and any enrollment it is about to insert for the same `{ user, course }` pair. Then it writes these rows, and prints their ids as JSON (`F, C, O, E1…E5, A1, A2, L1, L3`):

  | What | Values |
  |---|---|
  | Programs | F = `forex-trading-mastery`, C = `crypto-trading-mastery`; `$set instructor` = Sarah on both |
  | Fixture users (`role: "USER"`, `instructorStatus: "none"`, `sellerStatus: "none"`) | `grace@fixture.local` Grace Hopper (`authUserId` and `username` `fixture_grace`) · `kwame@fixture.local` Kwame Mensah (`fixture_kwame`) |
  | Other faculty | `other@fixture.local` "Other Faculty", `role: "INSTRUCTOR"`, `fixture_other` |
  | Course O | `{ title: "Fixture Program — Other Faculty", slug: "fixture-program-other-faculty", instructor: other, status: "published", kind: "program", school: F.school, category: F.category, packages: F.packages, pricing: "paid", price: F.price, currency: "USD", totalLessons: 0, enrolledCount: 1 }` |
  | Lessons in F (`isPublished: true`) | L1 "Fixture lesson 1", `order: 9001`, `isFree: true` · L2 "Fixture lesson 2", `order: 9002` · L3 "Fixture lesson 3 (Executive)", `order: 9003`, `minPackageKey: "executive"` |
  | E1 | student × F · `standard` · `active` · `progress: 40` · `completedLessons: [L1]` · `lastAccessedAt: mins(-60)` · `purchasedAt` and `activatedAt` `mins(-14400)` |
  | E2 | Grace × F · `executive` · `completed` · `progress: 100` · `examPassed: true` · `bestScorePercent: 85` · `completedAt` and `lastAccessedAt` `mins(-2880)` · `mentorRoadmap: { text: "Week 1: risk sizing", updatedAt: mins(-4320), updatedBy: Sarah }` · `purchasedAt` and `activatedAt` `mins(-20160)` |
  | E3 | Kwame × C · `basic` · `active` · `progress: 10` · `lastAccessedAt: null` · `purchasedAt: mins(-7200)` · inserted **without** `bestScorePercent` or `examPassed` keys (the legacy shape) |
  | E4 | Grace × O · `standard` · `active` · `progress: 50` · `purchasedAt: mins(-3000)` |
  | E5 | Kwame × F · `packageKey: null` · `refunded` · `progress: 0` · `purchasedAt: mins(-9000)` |
  | Assignments in F (`published`, instructor Sarah) | A1 "Fixture: position sizing" · A2 "Fixture: trade journal" |
  | Submissions | E1×A1 graded 80, feedback "Good sizing" · E1×A2 `submitted` · E2×A1 graded 60 · E2×A2 graded 90 |
  | Final exam in F | Reuse it if one exists (print its pass mark). Otherwise insert `{ course: F, scope: "final", lesson: null, instructor: Sarah, title: "Fixture final exam", status: "published", settings: { durationMinutes: 30, passMarkPercent: 70, maxAttempts: 3, shuffleQuestions: true, shuffleOptions: true, showResults: true }, questionCount: 0, totalPoints: 0 }` |
  | Attempts on E2 | #1 `failed`, `scorePercent: 55`, `submittedAt: mins(-4400)` · #2 `passed`, `scorePercent: 85`, `submittedAt: mins(-4300)` |
  | Classes in F (`hostId` Sarah, `status: "ended"`, no `mentorshipSessionId`) | M0 "Fixture class 0 (before enrolment)", `startedAt: mins(-30000)` · M1 "Fixture class 1", `startedAt: mins(-4320)` · M2 "Fixture class 2", `startedAt: mins(-1440)` |

  Each row has the fields its model requires, the `p19: true` tag, and `createdAt` and `updatedAt`. Each attempt also has `user`, `exam`, `course` and `enrollment`, plus `attemptNumber`, `startedAt` and `deadlineAt`.

- [ ] **Step 7: Verify.** Run `R=$(fx roster)` and read the ids from it. `E1=…` and so on, through the kit's JSON. Each line below counts links to `/instructor/students/<id>` in `html …`:
  - **As `instructor`** on `/instructor/students`: E1, E2 and E3 links each ≥ 1; E4 and E5 links `0`. E4 is another instructor's learner (Review Focus 3); E5 is refunded.
  - `?plan=executive`: E2 ≥ 1, while E1 and E3 are `0`.
  - `?program=$C`: E3 ≥ 1 and E1 `0`.
  - `?program=$O` as `instructor`: E4 is `0`, and `text` contains "No learners match these filters".
  - `text /instructor/students instructor | grep -oE "1 graded · avg 80|2 graded · avg 75|85%" | sort -u`. Expected: all three. The page still renders E3, whose row has no `bestScorePercent` key (the legacy shape), and its Best exam reads `—`.
  - **As `admin`:** E4 ≥ 1.
  - **The seams are still empty** (if step 3 filled nothing): `text /instructor/students instructor | grep -cE "Mastery Score|Attendance|All cohorts"`. Expected: `0`.
  - **Phones.** At 390 and 320 px: rows, no horizontal scroll. At 1440 px: the table.
  - **Marketplace Creators.** Run `fx seller student@worldstreet.academy on`. `curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" -b mock_persona=student $BASE/instructor/students` → `307 …/instructor/courses`. Then run `fx seller student@worldstreet.academy off`.

- [ ] **Step 8: Lint, typecheck, commit.**

```bash
for f in lib/faculty-students.ts lib/faculty-seams.ts lib/actions/faculty-students.ts "app/(instructor)/instructor/students/page.tsx" components/instructor/students/students-filters.tsx components/instructor/students/students-list.tsx; do npx eslint "$f"; done
npx tsc --noEmit
git add lib/faculty-students.ts lib/faculty-seams.ts lib/actions/faculty-students.ts "app/(instructor)/instructor/students/page.tsx" components/instructor/students
git commit -m "feat(faculty): My Students — every learner across a faculty member's programs, with cohort and Mastery seams" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Student Performance

**Files:**
- Create: `app/(instructor)/instructor/students/[enrollmentId]/page.tsx`, `components/instructor/students/classes-list.tsx`
- Modify: `lib/actions/faculty-students.ts`, `lib/faculty-students.ts`

**Interfaces:**
- Consumes: `cohortsFor`, `masteryFor` and `MasteryResult` (Task 6); `planOf`, `shortDate`; `canAccessLesson` and `includesMentorship` (`lib/entitlements.ts`).
- Produces:
  - In `lib/faculty-students.ts`: `ENROLLMENT_STATUS_LABEL: Record<EnrollmentStatus, string>` = Active, Completed, Pre-enrolled, Expired, Refunded, Suspended, Cancelled.
  - In `lib/actions/faculty-students.ts`:

    ```ts
    export type StudentPerformance = {
      enrollmentId: string
      learner: { name: string; avatarUrl: string | null }
      program: { id: string; title: string; manageHref: string }
      plan: { key: PlanFilter; label: string }
      status: EnrollmentStatus
      cohort: CohortTag | null
      enrolledAt: string
      lastActiveAt: string | null
      completedAt: string | null
      progress: number
      certificateId: string | null
      lessons: { id: string; title: string; section: string | null; completed: boolean; locked: boolean }[]
      exam: { passMark: number | null; attempts: { id: string; title: string; scope: "final" | "lesson"; attemptNumber: number; status: AttemptStatus; scorePercent: number | null; at: string }[] }
      assignments: { id: string; title: string; dueAt: string | null; submission: { status: "submitted" | "graded"; grade: number | null; feedback: string; submittedAt: string; gradedAt: string | null } | null }[]
      classes: { id: string; title: string; heldAt: string }[]
      mastery: MasteryResult | null
      mentorship: { roadmap: string | null; updatedAt: string | null; href: "/instructor/meetings#mentorship" } | null
    }
    export async function getStudentPerformance(enrollmentId: string): Promise<{ success: true; data: StudentPerformance } | { success: false; error: string; code?: "not_found" }>
    ```

  - `ClassesList({ classes, attended }: { classes: StudentPerformance["classes"]; attended?: ReadonlySet<string> })`. With `attended`, it shows an "Attended" column. That prop is the Phase 16 follow-up (ruling 12).

- [ ] **Step 1: Check first.** Run `fx roster` and read the ids. `text /instructor/students/$E2 instructor | grep -c "Grace Hopper"`. Expected: `0` (the route doesn't exist yet).

- [ ] **Step 2: `getStudentPerformance`.**
  - **Gates, in order:**
    - `connectDB()`, then the role check (as Task 6).
    - `enrollmentId` must match `/^[a-f0-9]{24}$/`, and the enrollment and its course (`title instructor packages examRequired`) must exist.
    - Unless the caller is an `ADMIN`, the course's instructor must be them.

    Each failure returns `{ success: false, error: "Learner not found", code: "not_found" }`, so nothing reveals whether the row exists.
  - **Then, in parallel:**
    - the learner (`firstName lastName avatarUrl`);
    - published lessons (`Lesson.find({ course, isPublished: true }).sort({ order: 1 }).select("title sectionTitle order isFree minPackageKey")`), where `completed` means listed in `completedLessons` and `locked` is `!canAccessLesson(course, lesson, enrollment)`;
    - attempts: `ExamAttempt.find({ enrollment: id, status: { $ne: "in_progress" } })` with `exam` populated (`title scope`), newest first, `at = submittedAt ?? startedAt`;
    - `passMark` from `Exam.findOne({ course, scope: "final" }).select("settings.passMarkPercent")`;
    - published assignments (`Assignment.find({ course, status: "published" }).sort({ createdAt: 1 })`), with this learner's `Submission`s (`{ assignment: { $in }, user: learner }`);
    - classes held since enrolment: `Meeting.find({ courseId: course._id, mentorshipSessionId: null, startedAt: { $gte: activatedAt ?? purchasedAt } }).select("title startedAt").sort({ startedAt: -1 }).limit(50)`;
    - `cohortsFor([row])` and `masteryFor([row])` (both null when empty).
  - **Mentorship** is set only when `includesMentorship(course, enrollment)`. It carries the roadmap text and date, which are null when there is no roadmap yet.

- [ ] **Step 3: The page.** `app/(instructor)/instructor/students/[enrollmentId]/page.tsx` (RSC):
  - `code === "not_found"` → `notFound()`. The Topbar is `variant="instructor"` with `breadcrumbOverrides={{ [enrollmentId]: learner.name }}`.
  - **Header:**
    - `BackAction` to `/instructor/students`;
    - the avatar, with the name as `h1`;
    - chips: program (linking to `manageHref`), plan, status (`ENROLLMENT_STATUS_LABEL`) and the cohort name when present;
    - "Enrolled {shortDate} · Last active {shortDate or "Never"}";
    - a 4px progress bar with `%`.
  - **Sections, each a `CardShell` with a `CardHeader`:**
    1. **Lessons.** "{n} of {m} completed", then rows grouped by `section`, each marked "Completed" (`CircleCheckBigIcon`, `text-ws-success`), "Locked by plan" (`LockIcon`, muted) or nothing.
    2. **Exams.** The subtitle "Pass mark {passMark}%" when known. Rows: title, "Final exam" or "Lesson quiz", "Attempt {n}", score `%`, the status chip and the date. Empty: "No attempts yet".
    3. **Assignments.** Rows: title, due date, and "Not submitted", "Submitted {date} · waiting for a grade", or "Graded {grade} · {date}" with the feedback below in muted text. The header link "Grade submissions" → `/instructor/courses/<id>/assignments`.
    4. **Classes.** `<ClassesList classes={classes} />` with no `attended` prop. Rows: title and `shortDate(heldAt)`. Empty: "No classes held since this learner enrolled".
    5. **Mastery Score**, only when `mastery`. The score out of 100 (`tabular-nums`), then each part's key label, value (or "—") and weight.
    6. **Mentorship**, only when `mentorship`. The roadmap text (`whitespace-pre-line`) or "No roadmap yet", "Updated {date}", and the link "Open mentorship" → `/instructor/meetings#mentorship`.

- [ ] **Step 4: Typecheck and lint.** Run `npx tsc --noEmit`, and `npx eslint` on each changed file.

- [ ] **Step 5: Verify the content.**
  - Run `text /instructor/students/$E2 instructor | grep -oE "Grace Hopper|Attempt 2|85%|Pass mark 70%|Week 1: risk sizing|Fixture: trade journal|Graded 90|Fixture class 2|Open mentorship" | sort -u`.
    - Expected: all nine. If the Forex final exam already existed, use its pass mark.
  - Run `text /instructor/students/$E1 instructor | grep -oE "Fixture class 1|Fixture class 2|Fixture class 0 \(before enrolment\)|Locked by plan|Submitted [0-9]+ [A-Za-z]+ [0-9]{4} · waiting for a grade" | sort -u`.
    - Expected: everything except `Fixture class 0 (before enrolment)`.
  - `text /instructor/students/$E1 instructor | grep -c "Open mentorship"`. Expected: `0` (E1 is on Standard).
  - With the seams empty: `text /instructor/students/$E2 instructor | grep -c "Mastery Score"`. Expected: `0`.

- [ ] **Step 6: Verify ownership** (Review Focus 3).
  - `text /instructor/students/$E4 instructor | grep -c "Lost in Space"` → `1`, and `… | grep -c "Grace Hopper"` → `0`.
  - As `admin`, `text /instructor/students/$E4 admin | grep -c "Grace Hopper"` → ≥ `1`.
  - `text /instructor/students/zzz instructor | grep -c "Lost in Space"` → `1`.
  - At 390 px, `$E2` has no horizontal scroll and long feedback wraps.

- [ ] **Step 7: Commit.**

```bash
git add lib/actions/faculty-students.ts lib/faculty-students.ts "app/(instructor)/instructor/students/[enrollmentId]/page.tsx" components/instructor/students/classes-list.tsx
git commit -m "feat(faculty): Student Performance — one learner's lessons, exams, assignments, classes and roadmap" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Today's classes, the §16 sidebar, and the docs

**Files:**
- Create: `components/instructor/home/today-classes.tsx`
- Modify:
  - `components/instructor/home/teaching-home.tsx`
  - `components/instructor/instructor-sidebar.tsx`
  - `app/(instructor)/instructor/meetings/page.tsx` (its Topbar title only)
  - `docs/go-patches-phase-3.md`
  - `docs/launch-runbook.md`
  - `docs/institutional-blueprint-plan.md`
  - `docs/mastery-academy-plan.md`

**Interfaces:**
- Consumes: `HomeEntry` (`lib/actions/teaching-home.ts`); `agendaDays` and `timeLabel` (`lib/teaching-home.ts`); `hostMayStart` (`lib/class-schedule.ts`); `Countdown` (`components/shared/countdown`).
- Produces: `TodayClasses({ entries, now }: { entries: HomeEntry[]; now: number })`.

- [ ] **Step 1: Check first.**
  - `grep -c '"WMA Partners"' components/instructor/instructor-sidebar.tsx`. Expected: `≥ 1` (Phase 18's item). If it prints `0`, stop and report BLOCKED: Phase 18 hasn't landed.
  - Add to `$KIT/fx.cjs`: **`today-class`**. It deletes the `p19` meeting titled "Fixture class today" and inserts `{ p19: true, title: "Fixture class today", courseId: F, hostId: Sarah, status: "scheduled", scheduledAt: mins(10), meetingId: "rtk-fixture-today", hostToken: "fixture", participants: [], invites: [], reminders: { h24SentAt: null, h1SentAt: null }, settings: <as Task 1>, createdAt: now, updatedAt: now }`. It prints `ok`. Run it before 23:30 local time.

- [ ] **Step 2: `today-classes.tsx`.** A client component in the `WeekAgenda` card's grammar (`CardShell`, the same header row):
  - Heading "Today's classes"; subtitle `` `${n} today` `` or "Nothing scheduled today".
  - Rows show `timeLabel(start)` · the title (`Mentorship · {studentName}` for a session) · `Class · {course}` or `1-on-1 · {course}`. On the right:
    - live → a red "Live" dot and an outline pill "Rejoin" → `joinHref`;
    - upcoming and `hostMayStart(start, now)` → an outline pill "Start" → `joinHref`;
    - upcoming later → `<Countdown target={start} variant="compact" prefix="in " … />`;
    - ended → "Done", at `opacity-60`.
  - Empty: one line, with the link "Open calendar" → `/instructor/calendar`.
  - No gold here: the hero holds it.

- [ ] **Step 3: Mount it.** In `teaching-home.tsx`, directly before `<WeekAgenda entries={home.week} now={now} />`'s `Rise`, add `<Rise delay={60}><TodayClasses entries={agendaDays(home.week, now)[0]?.entries ?? []} now={now} /></Rise>`. Move the later `Rise` delays by 60 (120, 180, 240). Add a matching card to `TeachingHomeSkeleton` (a header and `SkeletonRows rows={2}`), and name it in the component comment's top-to-bottom list.

- [ ] **Step 4: The sidebar** (ruling 15). In `components/instructor/instructor-sidebar.tsx`:
  - **`teachItems`** becomes, in this order:

    | title | href | icon | match |
    |---|---|---|---|
    | Overview | `/instructor` | `House` | `p === "/instructor"` |
    | My Students | `/instructor/students` | `UserGroupIcon` | `p.startsWith("/instructor/students")` |
    | My Courses | `/instructor/courses` | `BookOpen` | today's rule |
    | Live Classroom | `/instructor/meetings` | `Video` | `p.startsWith("/instructor/meetings")` |
    | Calendar | `/instructor/calendar` | `CalendarDays` | `p.startsWith("/instructor/calendar")` |
    | Earnings | `/instructor/earnings` | `Wallet` | `p === "/instructor/earnings"` |
    | WMA Partners | `/dashboard/referrals` | Phase 18's icon | — |
    | Profile | `/instructor/profile` | `User` | `p === "/instructor/profile"` |
    | Handbook | `/instructor/handbook` | `Notebook01Icon` | `p.startsWith("/instructor/handbook")` |

  - **`connectItems`** becomes Messages (unchanged), then Add Course, Certificates and Analytics, moved here unchanged.
  - The live-meetings badge moves with "Live Classroom": change the `item.title === "Meetings"` test to `"Live Classroom"`, and render the badges for both groups.
  - **Define each item once, as named constants**, and build `teachItems`, `connectItems` and `sellerItems` from them. The seller rail is My Courses, Add Course, Profile, Settings, with no `teachItems[n]`.
  - **The last group:** "Student Dashboard" for faculty. For sellers, "Marketplace" followed by Phase 18's "WMA Partners" row, now rendered only when `seller` (faculty reach it from the first group).
  - Update the component comment: §16's order, and the seller rail.
  - In `app/(instructor)/instructor/meetings/page.tsx`, `<Topbar title="Meetings" variant="instructor" />` becomes `<Topbar title="Live Classroom" variant="instructor" />`.

- [ ] **Step 5: Verify the tutor home.** Run `fx roster` (if not already) and `fx today-class`. As `instructor`, open `/instructor` at 1440 px.
  - "Today's classes" lists "Fixture class today" with "Start", and sits between the hero and "This week".
  - At 390 px: no horizontal scroll.
  - With reduced motion emulated: everything is visible.

- [ ] **Step 6: Verify the faculty rail.** At 1440 px, as `instructor`, on `/instructor/students`, in the browser:

```js
[...document.querySelectorAll('[data-sidebar="menu-button"] > span.truncate')].map((s) => s.textContent)
```

  Expected:

```js
["Overview","My Students","My Courses","Live Classroom","Calendar","Earnings","WMA Partners","Profile","Handbook","Messages","Add Course","Certificates","Analytics","Student Dashboard"]
```

  The "My Students" row is the active one (`data-active="true"`, gold icon).

- [ ] **Step 7: Verify the seller rail** (Review Focus 4). Run `fx seller student@worldstreet.academy on`. As `student`, open `/instructor/courses`.
  - Expected: `["My Courses","Add Course","Profile","Settings","Marketplace","WMA Partners"]`.
  - Run `fx seller student@worldstreet.academy off`.

- [ ] **Step 8: The docs.**
  - **`docs/go-patches-phase-3.md`.** Append a section, using the next free section number (renumber at merge if another phase took it):

```markdown
## <N>. Phase 19 — Faculty system (institutional blueprint §16, D29)

Go needs no patch. All additive:

- **`instructorapplications.demo`** — `null`, or `{ requested: true, meetingId, scheduledAt, outcome: "passed" | "not_passed" | null, note, decidedAt }`. A teaching demonstration requested during `interview_scheduled`; **the status never changes for it**. The web refuses approval while `requested` and `outcome` is `null` — if Go ever approves applications, apply the same rule.
- The demonstration room is a `meetings` row shaped like the interview's (`applicationId` set, no `courseId`), titled "Teaching demonstration — <name>".
- **`users.instructorProfile.handbook`** — `{ teachingStandardsAt, curriculumGuidelinesAt, platformTrainingAt }`, each a date or `null`.
- **`users.instructorProfile.credential`** — `null`, or `{ id: "WMAF-XXXXXX", issuedAt }`. Unique when set (partial index `facultyCredential_unique`); written once, never changed.
- Any whole-object write of `instructorProfile` (an approval or profile edit in Go) must carry `handbook` and `credential` across, as the web's approval does — or use dotted `$set` paths.
```

  - **`docs/launch-runbook.md`.** Add a section "Phase 19 — Faculty system (owner)":
    1. **Before release: sign off the handbook.** Read the three pages (`lib/faculty-handbook.ts`, or `/instructor/handbook` on staging), correct or approve the copy, and set `HANDBOOK_APPROVED = true`. Until then every page shows "Draft · awaiting approval".
    2. **After deploying: check the index.** Run `mongosh "$PROD_URI" --quiet --eval 'db.users.getIndexes().map(i => i.name)'`. The output must include `facultyCredential_unique`.
    3. **What existing faculty will see.** They see three new checklist items on `/instructor`. Each member receives a `WMAF-` credential once everything apart from "Create your first course" is done, with KYC verified.
    4. **`FACULTY_PUBLIC` stays `false` (D31).** The public "WMA Faculty · since …" line appears when you switch it on.
  - **`docs/institutional-blueprint-plan.md`.** Tick Phase 19's exit criteria, and set its row in the §3 table to `done (<date>)`.
  - **`docs/mastery-academy-plan.md`.** Set the Phase 19 row to `done (<date>) — task plan docs/plans/mastery-phase-19.md`.
  - **The Phase 16 follow-up.** Under Phase 16's tasks in the roadmap, add one line: "Phase 19 seams: fill `masteryFor` in `lib/faculty-seams.ts`, and pass `attended` to `ClassesList` on Student Performance." Under Phase 12's tasks: "Phase 19 seam: fill `cohortsFor` in `lib/faculty-seams.ts`."

- [ ] **Step 9: Whole-repo checks.**
  - Run `pnpm lint` and `npx tsc --noEmit`. Expected: no new lint errors against the count before Task 1 (record both numbers), and tsc clean.
  - Run `git diff --stat <phase base>..HEAD -- lib/actions/enrollments.ts lib/actions/manual-payments.ts mocks .env.local`. Expected: nothing.
  - Run `fx reset-student`, then stop the server and confirm with `netstat`.

- [ ] **Step 10: Commit.**

```bash
for f in components/instructor/home/today-classes.tsx components/instructor/home/teaching-home.tsx components/instructor/instructor-sidebar.tsx "app/(instructor)/instructor/meetings/page.tsx"; do npx eslint "$f"; done
git add components/instructor/home/today-classes.tsx components/instructor/home/teaching-home.tsx components/instructor/instructor-sidebar.tsx "app/(instructor)/instructor/meetings/page.tsx" docs/go-patches-phase-3.md docs/launch-runbook.md docs/institutional-blueprint-plan.md docs/mastery-academy-plan.md
git commit -m "feat(faculty): today's classes and the §16 faculty sidebar; Phase 19 docs" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Report (end of phase)

Read out Phase 19's exit criteria from `docs/institutional-blueprint-plan.md`, then add:
- **Seams.** Which seams were filled in this tree (Task 6, step 3), and which are left for the merge with Phase 12 or Phase 16.
- **For the owner:**
  - the handbook copy waits for their sign-off (`HANDBOOK_APPROVED`);
  - `FACULTY_PUBLIC` is still off;
  - existing faculty will see three new onboarding items.
- **Untested locally.** A real demonstration room needs RealtimeKit (a staging check). So do real emails, and KYC with the wallet on.
- **`getCourseStudents`** stays exported, unused and unchanged (ruling 11). It takes the instructor id as an argument; if a UI ever calls it, it must derive the id from `getCurrentUser()` instead.
