# Mastery Academy — Phase 7 Implementation Plan (Executive services: mentorship booking, personal roadmap, full assignments)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Executive package's promises become features, and practical assignments become real work:
- An Executive student proposes up to three times for a private session. The course instructor confirms one. The result is a scheduled room both can join, with T-24h/T-1h reminders, that nobody else can enter.
- The instructor writes the student's personal roadmap; the student reads it.
- Instructors publish assignments and grade submissions. Students whose package includes assignments submit text and files. Files go to the private resources bucket only. Assignments appear in the dashboard Assignments tile.
- "Priority support" is already live (Phase 4 Task 5); this phase adds nothing there.

**Owner direction (2026-09-14):** production push soon — "we need everything working, refinements afterwards." This is the leanest version that makes each promise real and truthful, in six tasks.

**Architecture:**
- **Data.** Three new collections: `mentorshipsessions`, `assignments`, `submissions`. Two additive fields: `Meeting.mentorshipSessionId` (the `applicationId` precedent) and `Enrollment.mentorRoadmap`. Nothing is renamed; no enum on an existing field changes.
- **Rules.** Package rules keep their two homes. `lib/entitlements.ts` gains one pure `includesMentorship(course, enrollment)`. Every server gate pairs it, or `entitlements.assignments`, with `getCourseAccess` (`lib/course-access.ts`), so only access-granting enrollments count.
- **Booking reuses the interview machinery.** A confirmed session is an interview-shaped scheduled `Meeting`: no `courseId`, the student in `invites[]`, and the RTK room minted up front, as in `scheduleInterviewCore` and Phase 4's `createCourseMeeting`. `joinMeeting` gives it the class rules: `HOST_EARLY_START_MS` for the host, and "hasn't started yet" plus `startsAt` for the student. It adds a privacy gate. The Phase 4 reminders cron gains a session branch.
- **Actions** live in two new files: `lib/actions/mentorship.ts` and `lib/actions/assignments.ts`. `getMyAssessments` in `lib/actions/exams.ts` gains assignment rows.
- **Surfaces.**
  - Student: `/dashboard/mentorship` (roadmap, request form, sessions), `/dashboard/assignments` and `/dashboard/assignments/[assignmentId]`.
  - Instructor: a Mentorship panel on `/instructor/meetings`, and `/instructor/courses/[courseId]/assignments`.
  - Links: the dashboard Instructor/Mentor tile and the Assignments tile.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict · Mongoose 9 · Zod (`zod/v4`) · Tailwind v4 + DS v2 `ws-*` tokens · Base UI (`render` prop) · TanStack Query · lucide-react · RealtimeKit (`lib/realtime.ts`) · R2 via S3 presigning (`lib/r2.ts`) · Resend (no-op locally) · Ably notifications (`lib/notify.ts`).

**Spec:**
- `docs/mastery-academy-blueprint.md` §6, Executive 101 package. The promises are: "Private 1-on-1 coaching · Personalized learning roadmap · Private expert sessions · Individual strategy review · Personalized trading-plan development · Private Q&A · Direct mentorship · Individual progress assessment · Personalized feedback · Priority support". Standard's list includes "Practical assignments". §9 includes "Practical assignments" and "Mentorship".
- `docs/mastery-academy-plan.md`:
  - § Phase 7 (7.1 booking, 7.2 roadmap, 7.3 full assignments) and its Exit criteria;
  - D4 (Executive pays now, then intake; booking is Phase 7), D5 (no upgrades), D7 (assignments lite now, full submissions in Phase 7);
  - §0.3 hard constraints; §0.4 cross-repo checklist.
- Consumed from Phase 3: `lib/entitlements.ts`, `lib/course-access.ts`, `Enrollment.mentorshipIntake`.
- Consumed from Phase 4: `createCourseMeeting`'s up-front room, `HOST_EARLY_START_MS`, `joinMeeting`'s not-started refusal with `startsAt`, `joinErrorMessage` and `earlyStartNotice`, the reminders cron and its ledger, `getUpcomingClasses`, `getMyAssessments` with `AssignmentsTile`, `DashboardTile`, `InstructorsTile`, `lib/datetime-local.ts`, and `formatDateTime` in `lib/dashboard-home.ts`.
- Phases 5 and 6 run before this phase. Anchors below are **quoted text**, never line numbers, and avoid every region those plans edit (see Global Constraints).

**Branch:** `mastery/phase-7`, cut from the tip that holds Phase 6.

## Controller rulings (binding — do not re-litigate)

1. **No `mentorshipSessions` quota in v1.** `ICoursePackage.entitlements.mentorship` stays the only switch.
   - The throttle is one open request per enrollment, enforced by a partial unique index, plus the instructor confirming each session.
   - *Why:* the blueprint promises no number of sessions. A quota needs a package field, the packages editor, Zod in two save paths, the catalogue script and a Go note. Nothing on the site claims a count, so nothing is untruthful without one. Add it when product names a number.
2. **Who has mentorship: `includesMentorship(course, enrollment)`** in `lib/entitlements.ts`.
   - True only when `packageKey === "executive"` and the course's `executive` package (found by key, `enabled` ignored like `entitlementsFor`) has `entitlements.mentorship`.
   - Server callers pair it with `getCourseAccess`, so only `active|completed` enrollments count.
   - *Why:* it is the server twin of the dashboard's `isMentorEnrollment` (Phase 4 ruling 4). Grandfathered FULL_ACCESS and single "Full program" tiers are access, not a purchased mentorship. `submitMentorshipIntake` inlines the same test; it is left alone.
3. **Booking data: `MentorshipSession`**, a new collection.
   - Fields: `student`, `instructor` (the course instructor at request time), `course`, `enrollment`, `status: requested | confirmed | declined | cancelled`, `proposedSlots: { at }[]` (1–3), `note`, `scheduledAt`, `meetingId` (the Meeting `_id`), `responseNote`, `cancelledBy`.
   - A partial unique index on `{ enrollment: 1 }` where `status: "requested"` gives one open request per enrollment, race-safe (the `InstructorApplication` precedent).
   - No stored `completed` or `no_show` in v1. The read model derives the view status:
     - `requested`;
     - `upcoming`: confirmed, and the meeting is not ended and not more than 2 h past its time;
     - `past`;
     - `declined`;
     - `cancelled`.
   - *Why:* nothing in v1 needs a completion event. No quota counts sessions, and the host ends the room in the existing meeting UI.
4. **Slots.**
   - A request carries 1–3 distinct times. Each must be at least 1 hour ahead and within 60 days.
   - Confirming picks one of those exact instants, and it must still be more than now + 60 s (the class rule).
   - The optional `note` is ≤ 1,000 characters.
   - *Why:* the `proposedSlots` pattern, mirrored: the student proposes and the instructor picks. The lead time gives the instructor room to answer.
5. **A confirmed session is an interview-shaped Meeting**, created by `confirmMentorshipSession`:
   - `status: "scheduled"` + `scheduledAt`;
   - **no `courseId`**;
   - `invites: [student]`;
   - `mentorshipSessionId`;
   - `settings: { requireApproval: true, guestAccess: true, maxParticipants: 10, muteOnEntry: false, allowScreenShare: true }`;
   - the reminders ledger. `h24SentAt` is pre-stamped when the session is within 24 h, because the confirmation just told the student, as `createCourseMeeting` does.

   *Why:* a `courseId` would put a private session into `getUpcomingClasses`, Course Sessions and the class reminder audience of every live-class student. `guestAccess: true` auto-admits the one person the privacy gate (ruling 7) lets through, so no waiting room is needed.
6. **RealtimeKit is minted up front, and a failure writes nothing.**
   - Order: validate → mint the RTK room + host participant → `Meeting.create` → atomically claim the request (`findOneAndUpdate({ _id, status: "requested" })` → confirmed + `scheduledAt` + `meetingId`).
   - RTK throws → `"Couldn't open a room for this session — try again"`. The request stays `requested`; no Meeting row exists.
   - Claim lost (double confirm, or the student cancelled meanwhile) → delete the just-created Meeting → `"This request was already answered"`.
   - *Why:* Phase 4 ruling 7. `Meeting.meetingId`/`hostToken` are `required`, so a lazy room needs a schema change Go also reads. This order never leaves a confirmed session without a room, nor a room nobody owns.
7. **`joinMeeting` for a session meeting (`meeting.mentorshipSessionId`):**
   - **Host:** the Phase 4 early-start guard now applies: more than `HOST_EARLY_START_MS` ahead → `"This class is scheduled for later"` + `startsAt`. The string is unchanged because the instructor page matches it exactly.
   - **Everyone else except ADMIN:** the caller must be the session's student, the session must be `confirmed`, and `includesMentorship` must hold on `getCourseAccess`. The refusals are `"This mentorship session is private"` and `"Private mentorship isn't included in your package"`.
   - **Before the host starts:** `"This session hasn't started yet"` + `startsAt`, like classes.
   - `joinErrorMessage` on `/dashboard/meetings` words it as a session: "This session hasn't started yet — it begins …" / "Your mentor hasn't started this session yet".
   - *Why:* a room link is not a way into a paid 1-on-1, and a refund closes the door.
8. **Course Sessions.** `getMyMeetingInvites` leaves out a **scheduled** session meeting, which is listed on `/dashboard/mentorship` until the host starts it. Once active it appears there with "Join", like an interview. *Why:* Phase 4 ruling 18 — an invite row shows a live dot and Join, which is false for an unstarted room.
9. **Reminders.** The cron's session branch sends to the host plus the invited student only.
   - In-app title: "Mentorship session coming up" (24h) / "Starting in ~1 hour".
   - Email: session wording via `sendMentorshipEmail`.
   - The host's link is `/instructor/meetings`; the student's is `/dashboard/meetings?join=<id>`. The ledger is unchanged.
   - *Why:* 7.1 "reminders fire". The interview branch would say "interview" and "tomorrow".
10. **Cancelling: one action, `cancelMentorshipSession(sessionId, note?)`.**
    - The course instructor on a `requested` session → `declined`. Either party on `requested` or `confirmed` → `cancelled`.
    - A confirmed session's meeting is ended only while `scheduled` (Phase 4 "Cancel class" semantics). A started session can't be cancelled ("This session has started — end it from the room"); an ended one refuses too.
    - The counterpart gets a bell notification and an email.
11. **Roadmap = plain text** on `Enrollment.mentorRoadmap: { text, updatedAt, updatedBy } | null`, text ≤ 5,000. Only the course instructor writes it, and only for an enrollment with mentorship. The student sees it with `whitespace-pre-wrap`. Saving empty text clears it.
    - *Why no TipTap:* TipTap is in `package.json` (`components/ui/rich-text-editor.tsx`), but it produces HTML. Rendering instructor HTML to a student needs a sanitiser, and there is none without a new dependency. Plain text is safe and acceptable for v1 per owner direction. The field is `text`, not the plan's `markdown`, because nothing renders markdown.
12. **Mentorship surfaces.**
    - Student: new client page `/dashboard/mentorship`. One card per Executive program shows the roadmap, and either the request form or "Your request is with …". Below it, a Sessions list with Open session and Cancel.
    - Dashboard: `InstructorsTile` mentor rows get a "Sessions & roadmap" link. Phase 4 ruling 4 held back "Request a session" copy until this phase.
    - Instructor: a `MentorshipPanel` section at the top of `/instructor/meetings`, with Requests (confirm a slot, decline), Upcoming (cancel) and Mentees (intake + roadmap editor). It renders nothing when all three are empty.
    - No sidebar items.
    - *Why:* the confirmed room lands in that same page's Active Meetings with Start. The student entry points are the tile, notifications and emails. A sidebar item for every student would advertise a service most don't have.
13. **Assignments data.**
    - `Assignment { course, instructor, title ≤ 120, instructions ≤ 5,000, dueAt | null, status: draft | published }`, course-level only. No lesson link, no `minPackageKey`, no attached resources in v1.
    - `Submission { assignment, course, user, enrollment, text ≤ 10,000, files: { key, filename, mimeType, sizeBytes }[] ≤ 3, status: submitted | graded, submittedAt, grade 0–100 int | null, feedback ≤ 5,000, gradedBy, gradedAt }`, with a unique `{ assignment, user }` index.
    - Resubmission overwrites until graded; after grading it is refused. Due dates are shown, never enforced.
    - *Why:* the entitlement `assignments` is the package's gate (Basic false; Standard and Executive true). A lesson-tier variant is a refinement.
14. **Gate:** `getCourseAccess(user, course)?.entitlements.assignments`, on every student read and write. Legacy null-package enrollments keep FULL_ACCESS (Phase 3 semantics). Draft assignments are invisible to students.
15. **Files: the private bucket or nothing.**
    - Uploads are presigned PUTs to `R2_RESOURCE_BUCKET`, and only when `hasPrivateResourceBucket()` is true (`R2_RESOURCES_BUCKET_NAME` set). Otherwise → `"File uploads aren't available right now"`. This is fail-closed, unlike course resources, which only warn.
    - Keys are `worldstreet-academy/submissions/<assignmentId>/<userId>/<ts>-<random>.<ext>`. `submitAssignment` refuses any key outside the caller's own prefix.
    - Downloads are 5-minute signed GETs (`generatePresignedDownloadUrl`), minted per file index for the submitting student, the course instructor or an admin. Instructors' views never see storage keys.
    - Types: pdf, doc(x), xls(x), ppt(x), csv, txt, zip, png, jpeg. Max 25 MB each.
    - `submitAssignment` doesn't HEAD-check the object: the client submits only after the PUT succeeds, and a HEAD would reach live R2 during verification. Files dropped on resubmission stay in the bucket (ops debt, Phase report).
16. **Verification never PUTs to R2.** Presigning is local signing, so checks stop at the returned URL and print booleans derived from it, never the URL. Submission rows for grading come from `submission-fixture` with fake keys under the right prefix. Browser checks never pick a file.
17. **Assignments in the tile.**
    - `getMyAssessments` appends one row per published assignment on a program whose package has `assignments`: `scope: "assignment"`, status `not_started | submitted | graded`, `dueAt`, href `/dashboard/assignments/<id>`.
    - `MyAssessment.examId` is renamed `id` (only the tile reads it).
    - The tile gains "Submitted"/"Graded" chips, the "Assignment" label with its due date, "N to do · M done", and a "View all" action to `/dashboard/assignments` when there are more than 4.
    - Exams stay ungated by `assignments` (Phase 4 ruling 10).
18. **Assignment surfaces.**
    - Instructor: `/instructor/courses/[courseId]/assignments` (client page, the exam-builder precedent). Create/edit with a Published checkbox; per assignment, submissions with text, file downloads and a grade + feedback form. An outline "Assignments" button sits under "Exam (CBT)" on the course page.
    - Student: `/dashboard/assignments` (every row from `getMyAssessments`) and `/dashboard/assignments/[assignmentId]` (instructions, submit/resubmit, grade and feedback).
    - The instructor course pages already gate on `INSTRUCTOR|ADMIN` in `app/(instructor)/layout.tsx`. Actions re-check ownership (course instructor or ADMIN).
19. **One gold CTA per view.**
    - Gold (`Button` default): "New assignment" on the instructor assignments page; "Submit assignment"/"Resubmit" on the student detail page.
    - Everything else on new surfaces is `outline`/`ghost`/`destructive`. The mentorship page and panel have no gold at all.
20. **Six tasks, each action landing with the UI that imports it** (Phase 5 ruling 13 — `action.sh` finds an action only in a page's client chunks):
    - (1) data + rules;
    - (2) student mentorship;
    - (3) instructor queue, confirm, roadmap;
    - (4) sessions run like classes;
    - (5) assignments, instructor side;
    - (6) assignments, student side.

## Global Constraints

- **Schema: additive only** (§0.3.1).
  - Task 1 is the only model change: three new collections, `Meeting.mentorshipSessionId` and `Enrollment.mentorRoadmap`.
  - No renamed fields, no new `role` values, no changed status semantics on existing collections.
  - Mongoose caches schemas in the running dev server and strips unknown paths from writes. **The controller restarts the dev server after Task 1 is committed**; Tasks 2–6 assume it.
- **Do not edit (Phases 5–6 own these regions):**
  - `lib/actions/profile.ts`, `lib/actions/admin-users.ts`, `lib/actions/applications.ts`, `lib/actions/student.ts`, `lib/actions/certificates.ts`, `lib/actions/reviews.ts`, `lib/actions/admin-courses.ts`;
  - `completeLesson`/`purchaseCourse` in `lib/actions/enrollments.ts`; `gradeAttempt` in `lib/actions/exams.ts`;
  - the `mentorshipIntake`/`certificateId`/`progress` region and the index block of `lib/db/models/enrollment.ts` (Task 1 anchors on `bestScorePercent` instead);
  - `lib/db/models/user.ts`, `lib/db/models/review.ts`, `lib/brand.ts`, `lib/faculty.ts`, `lib/countries.ts`;
  - marketing components, `components/learn/certificate-view.tsx`, `/admin/*` pages;
  - the `adminApplicationDetail` line of `lib/hooks/queries/keys.ts` (add keys only at the anchors given).

  If a later fix moved an anchor in a file you do edit, match the current text and say so in the report.
- **`"use server"` files export only async functions** (plus types). Constants, schemas and helpers stay non-exported inside them. `lib/actions/mentorship.ts` and `lib/actions/assignments.ts` start with `"use server"`.
- **Server actions:** `connectDB()` → auth/ownership → Zod (`import { z } from "zod/v4"`) → mutate → `revalidatePath()` → `{ success: true, data }` or `{ success: false, error }`. Never throw across the boundary. Read actions return `null`/empty on failure, like `getMyAssessments`.
- **Package rules have exactly two homes:** `lib/entitlements.ts` (pure, `includesMentorship` added) and `lib/course-access.ts` (`getCourseAccess`). Never write a package-key comparison or `packages.find(...)` for access inline in new code.
- **Money:** untouched. No wallet, order, earning or price code is read or written.
- **Copy (verbatim):**
  - Student page: "Mentorship" · "Private 1-on-1 sessions and your personal roadmap." · "Your roadmap" · "Your mentor hasn't written your roadmap yet — it appears here once they do." · "Private sessions" · "Request a session" · "Mentorship comes with Executive packages"
  - Status chips: "Waiting for your mentor" · "Confirmed" · "Past" · "Declined" · "Cancelled"
  - Tile link: "Sessions & roadmap"
  - Refusals: "Private mentorship isn't included in your package" · "You already have a request waiting for your mentor" · "Each time must be at least an hour from now" · "Propose times within the next 60 days" · "Pick one of the proposed times" · "Couldn't open a room for this session — try again" · "This request was already answered" · "This mentorship session is private" · "This session hasn't started yet" · "Assignments aren't included in your package" · "File uploads aren't available right now" · "Upload your files again" · "This assignment has already been graded"
  - Brand always via `BRAND` if needed; never invent numbers or claims.
- **Icons:** `lucide-react` only; never emoji.
- **UI tokens:**
  - Semantic classes only (`bg-ws-surface`, `bg-ws-sunken`, `bg-ws-raised`, `bg-ws-chip`, `text-ws-primary`, `text-ws-muted`, `text-ws-subtle`, `bg-ws-success/10`, `text-ws-success`, `bg-ws-warning/10`, `text-ws-warning`, `text-ws-danger`, `font-display`); never a hex.
  - New markup uses `rounded-xs/sm/md/lg/full` only. Cards are separated by fill.
  - Dates, counts and grades in `tabular-nums`; separators `·`. Client dates via `formatDateTime` (`lib/dashboard-home.ts`); server-written notification text via `formatUtcDateTime` (`lib/email.tsx`), which names its zone.
  - No horizontal overflow at 400 px. Page content clears the mobile nav (`pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-12`).
- **Base UI:** `render` prop, never `asChild`. No Base UI `Select` in this phase (one form per program instead of a program picker). RSC-first does not apply to the new pages: they are TanStack client pages like the exam builder.
- **TanStack `queryFn`s wrap the action** (`queryFn: () => getX()`).
- **Links:** `/dashboard/mentorship` · `/dashboard/meetings?join=<meetingId>` · `/instructor/meetings` · `/dashboard/assignments` · `/dashboard/assignments/<id>` · `/instructor/courses/<courseId>/assignments`. Never ship a dead link.
- **No new dependencies. No `any`.**
- **Commits:**
  - One per task; every message ends with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
  - Add files by name; never `git add -A`; never commit `.env*`.
  - **Never run `git stash`.** The untracked `AGENTS.md` isn't yours.
- **Surgical:** touch only the listed files, plus files a compile error forces (say so in the report). No reformatting.

## Verification kit (controller-owned — use it, never start or restart servers yourself)

No test runner exists. Every task ends with:
- `npx tsc --noEmit 2>&1 | grep -v '^\.next/'` printing nothing;
- `npx eslint <every file you touched>` printing no errors and no new warnings;
- the task's runtime checks.

Set once per shell (Git Bash, repo root):

```bash
H="C:/Users/owen/AppData/Local/Temp/claude/C--Users-owen-downloads-projects-worldstreet-worldstreet-academy/d4ab89bb-8435-4b94-b993-6b42283d1e4b/scratchpad/phase-3"
P7="C:/Users/owen/AppData/Local/Temp/claude/C--Users-owen-downloads-projects-worldstreet-worldstreet-academy/d4ab89bb-8435-4b94-b993-6b42283d1e4b/scratchpad/phase-7-8"
export NODE_PATH="$(pwd)/node_modules"
BASE=http://localhost:3001
F=6aa7bc2845744c5eeb0eb781          # Forex: basic (all six false) / standard (no mentorship, no priority) / executive (all six)
BTC=6a6fc0bb6433bbbd6322be03        # Bitcoin: legacy, no packages → FULL_ACCESS
BTC_ENR=6a6fe33862cf63ed050e56c6    # the student's Bitcoin enrollment (active, packageKey absent)
STUDENT=6a6fc0bb6433bbbd6322be61; INSTRUCTOR=6a6fc0ba6433bbbd6322bdfd; ADMIN=6a6fc1258372b65d1ee8e972
strip() { perl -pe 's/<script\b.*?<\/script>//gs'; }
# Minutes from now → ISO.
iso() { node -e "console.log(new Date(Date.now()+($1)*60000).toISOString())"; }
# Read a dotted field from JSON on stdin: … | field data.sessionId
field() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=process.argv[1].split(".").reduce((o,k)=>o==null?o:o[k],JSON.parse(s));console.log(typeof v==="string"?v:JSON.stringify(v))})' "$1"; }
# Raw action POST as any persona: post <actionId> <pagePath> <persona> '<json args>'
post() { curl -s -X POST "$BASE$2" -H "Next-Action: $1" -H "Accept: text/x-component" -H "Content-Type: text/plain;charset=UTF-8" -b "mock_persona=$3" --data "$4" | tail -1; echo; }
```

- **Preflight, every task:** `echo "${MONGODB_URI:-unset}"` must print `unset`. Anything else → stop and report **BLOCKED**.
- **Dev server:** `pnpm dev:mock` on **http://localhost:3001**, already running, with the Phase 4 env (wallet stub, `CRON_SECRET=phase4-cron-secret`).
  - Mock Clerk; local Mongo `mongodb://127.0.0.1:27017/worldstreet-academy`. Never `.env.local`.
  - **RealtimeKit, Resend and OpenAI keys are placeholders:** `createRTKMeeting`/`addParticipant` throw and email no-ops. Verify recipients through Notification rows and rooms through fixtures.
  - **R2 keys are LIVE.** Never PUT, GET or DELETE against R2. Presigning is local; print only booleans derived from a signed URL, never the URL (it names the account and bucket).
- **Personas:** cookie `mock_persona=guest|student|instructor|admin`; no cookie = student. `/instructor/*` redirects a student, so an instructor-page action is called as a student with `PRINT_ID=1` + `post`.
- **Calling a server action:** `bash "$H/action.sh" "<page whose client chunks import it>" <actionName> '<json args array>' [persona]`.
  - `getMyMentorship`, `requestMentorshipSession`, `cancelMentorshipSession` → `/dashboard/mentorship` (Task 2).
  - `getMentorshipQueue`, `confirmMentorshipSession`, `saveMentorRoadmap` (and `cancelMentorshipSession`) → `/instructor/meetings` (Task 3, persona instructor).
  - `joinMeeting`, `getMyMeetingInvites` → `/dashboard/meetings`; `joinMeeting` as host → `/instructor/meetings`.
  - `getCourseAssignments`, `saveAssignment`, `gradeSubmission`, `getSubmissionFileUrl` → `/instructor/courses/$F/assignments` (Task 5, persona instructor).
  - `getAssignmentForStudent`, `getSubmissionUploadUrl`, `submitAssignment`, `getSubmissionFileUrl` → `/dashboard/assignments/<assignmentId>` (Task 6).
  - `getMyAssessments` → `/dashboard`.
- **Mock DB helper:** `node "$H/mockdb.cjs" <cmd>`.
  - Existing: `restore` · `probe` · `fixture basic|standard|executive|none` (3 Forex lessons + a student enrollment; prints `enrollmentId`) · `set-package` · `set-status` · `meetings` · `notifications [limit]` · `scheduled-class-fixture` · Phase 5/6 commands.
  - **New (Controller setup):** `mentorship-fixture <enrollmentId> <requested|confirmed> [minutesAhead]` · `mentorship` · `set-roadmap <enrollmentId> <text|null>` · `assignment-fixture <courseId> [published|draft] [dueMinutes]` · `submission-fixture <assignmentId> [userId]` · `assignments`.
  - **Run `restore` first and last in every task that touches data**, and say so.
- **HTML checks:** the new pages are client pages, so their data is not in the HTML. Check data with `action.sh` and rendering in the browser. `(platform)`/`(instructor)` `loading.tsx` streams redirects as 200: judge by content.
- **Browser (controller only):**
  - `B=~/.claude/skills/gstack/browse/dist/browse`.
  - Commands: `$B viewport 400x800|1280x900` · `$B goto <url>` · `$B wait --load` · `$B js "document.body.scrollWidth + '/' + window.innerWidth"` · `$B screenshot --viewport "$P7/<name>.png"` · `$B console --errors`.
  - Switch persona with `$B js "document.cookie='mock_persona=instructor; path=/'"` after a `goto`; set it back to student when done.
  - Steps marked **(controller)** are left for the controller in implementer reports.
- **Mock data (baseline):**

| Thing | Value |
|---|---|
| Forex packages | basic "Forex Foundation" (all six false) · standard "Forex Mastery" (liveClasses, instructorQa, assignments, certificate) · executive "Private Forex Mentorship" (all six) |
| Instructor | Sarah Chen `6a6fc0ba6433bbbd6322bdfd` teaches Forex and Bitcoin |
| Student | "Johnson Demo" `6a6fc0bb6433bbbd6322be61`, `student@worldstreet.academy`; baseline enrollments on Bitcoin (`6a6fe33862cf63ed050e56c6`) and Technical Analysis (`6a6fe33862cf63ed050e56c7`), no Forex enrollment |
| Counts | mentorshipsessions 0 · assignments 0 · submissions 0 · meetings 0 · notifications 0 |

## Controller setup (once, before Task 1 — edits the scratchpad helper, not the repo)

1. **Baseline.** After Phase 6 merges, cut `mastery/phase-7` from that tip. Run `node "$H/mockdb.cjs" restore` and confirm the counts above.
2. **Private bucket present? (name-only check, no values):**
   - `grep -c '^R2_RESOURCES_BUCKET_NAME=.' .env.local` prints `1` or `0`.
   - Record it. With `0`, Task 6's upload checks expect `"File uploads aren't available right now"` instead of a signed URL, and production must set the variable before release.
3. **Extend `$H/mockdb.cjs`.**
   - In `TRACKED`, add a line `  "mentorshipsessions", "assignments", "submissions",` before the closing `]`.
   - `restore` must read `(snap.ids[c] ?? [])`. Phase 6 setup step 2 made that change; if it's missing, make it now. The baseline has none of these rows, so restore deletes every one. `restore` replaces enrollments from the snapshot, which also clears `mentorRoadmap`.
   - Add to the header comment's command list:

```js
//   mentorship-fixture <enrollmentId> <requested|confirmed> [minutesAhead]
//                                    a mentorship session on that enrollment (two slots: +minutesAhead,
//                                    +minutesAhead+1d; default 1440). "confirmed" also creates the
//                                    scheduled interview-shaped meeting, linked both ways. Prints ids + slots.
//   mentorship                       mentorshipsessions indexes, every session + its meeting, every roadmap.
//   set-roadmap <enrollmentId> <text|null>
//   assignment-fixture <courseId> [published|draft] [dueMinutes]
//                                    an assignment by the course instructor. Prints the id.
//   submission-fixture <assignmentId> [userId]
//                                    a "submitted" submission with one FAKE file key under the user's
//                                    prefix (nothing uploaded). Prints ids + key.
//   assignments                      every assignment and submission.
```

   - Insert directly before the final `} else {` (the "unknown command" branch):

```js
  } else if (cmd === "mentorship-fixture") {
    const [enrollmentId, status = "requested", minutesAhead = "1440"] = args
    if (!["requested", "confirmed"].includes(status)) throw new Error(`bad status ${status}`)
    const e = await db.collection("enrollments").findOne({ _id: oid(enrollmentId) })
    if (!e) throw new Error(`no enrollment ${enrollmentId}`)
    const c = await db.collection("courses").findOne({ _id: e.course })
    const at = new Date(now.getTime() + Number(minutesAhead) * 60_000)
    const later = new Date(at.getTime() + 86_400_000)
    const session = {
      student: e.user, instructor: c.instructor, course: e.course, enrollment: e._id, status,
      proposedSlots: [{ at }, { at: later }], note: "Fixture: position sizing review",
      scheduledAt: null, meetingId: null, responseNote: "", cancelledBy: null, createdAt: now, updatedAt: now,
    }
    if (status === "confirmed") {
      const m = await db.collection("meetings").insertOne({
        title: `Mentorship session · ${c.title} · Fixture`, description: "Phase 7 fixture", hostId: c.instructor,
        status: "scheduled", meetingId: "rtk-fixture-mentorship", hostToken: "fixture", scheduledAt: at,
        participants: [{ userId: c.instructor, role: "host", status: "admitted", joinedAt: now }],
        invites: [{ userId: e.user, email: "student@worldstreet.academy", status: "sent", sentAt: now }],
        reminders: { h24SentAt: null, h1SentAt: null },
        settings: { allowScreenShare: true, muteOnEntry: false, requireApproval: true, guestAccess: true, maxParticipants: 10 },
        createdAt: now, updatedAt: now,
      })
      session.scheduledAt = at
      session.meetingId = m.insertedId
    }
    const r = await db.collection("mentorshipsessions").insertOne(session)
    if (session.meetingId) {
      await db.collection("meetings").updateOne({ _id: session.meetingId }, { $set: { mentorshipSessionId: r.insertedId } })
    }
    console.log(JSON.stringify({
      sessionId: r.insertedId.toString(),
      meetingId: session.meetingId ? session.meetingId.toString() : null,
      slots: [at.toISOString(), later.toISOString()],
    }))
  } else if (cmd === "mentorship") {
    const ix = await db.collection("mentorshipsessions").indexes().catch(() => [])
    console.log("indexes: " + ix.map((i) => `${i.name}${i.unique ? " unique" : ""}${i.partialFilterExpression ? " partial=" + JSON.stringify(i.partialFilterExpression) : ""}`).join(", "))
    for (const s of await db.collection("mentorshipsessions").find({}).sort({ createdAt: 1 }).toArray()) {
      const m = s.meetingId ? await db.collection("meetings").findOne({ _id: s.meetingId }) : null
      console.log(`  ${s._id} status=${s.status} enrollment=${s.enrollment} slots=${(s.proposedSlots ?? []).map((x) => x.at.toISOString()).join("|")} scheduledAt=${s.scheduledAt ? s.scheduledAt.toISOString() : null} note=${JSON.stringify(s.note ?? "")} response=${JSON.stringify(s.responseNote ?? "")} meeting=${m ? `${m._id} status=${m.status} linked=${String(m.mentorshipSessionId ?? null)} course=${m.courseId ?? null} invites=${(m.invites ?? []).map((i) => i.userId).join("|")}` : null}`)
    }
    for (const e of await db.collection("enrollments").find({ mentorRoadmap: { $type: "object" } }).toArray()) {
      console.log(`  roadmap enrollment=${e._id} by=${e.mentorRoadmap.updatedBy} ${JSON.stringify(e.mentorRoadmap.text)}`)
    }
  } else if (cmd === "set-roadmap") {
    const [enrollmentId, text] = args
    await db.collection("enrollments").updateOne(
      { _id: oid(enrollmentId) },
      { $set: { mentorRoadmap: text === "null" ? null : { text, updatedAt: now, updatedBy: oid(INSTRUCTOR) } } }
    )
    console.log(`enrollment ${enrollmentId} roadmap → ${text === "null" ? "null" : JSON.stringify(text)}`)
  } else if (cmd === "assignment-fixture") {
    const [courseId, status = "published", dueMinutes] = args
    const c = await db.collection("courses").findOne({ _id: oid(courseId) })
    if (!c) throw new Error(`no course ${courseId}`)
    const r = await db.collection("assignments").insertOne({
      course: c._id, instructor: c.instructor,
      title: status === "draft" ? "Fixture draft assignment" : "Fixture trade plan",
      instructions: "Write a one-page trade plan for EUR/USD and attach it.",
      dueAt: dueMinutes ? new Date(now.getTime() + Number(dueMinutes) * 60_000) : null,
      status, createdAt: now, updatedAt: now,
    })
    console.log(JSON.stringify({ assignmentId: r.insertedId.toString() }))
  } else if (cmd === "submission-fixture") {
    const [assignmentId, userId = STUDENT] = args
    const a = await db.collection("assignments").findOne({ _id: oid(assignmentId) })
    if (!a) throw new Error(`no assignment ${assignmentId}`)
    const e = await db.collection("enrollments").findOne({ user: oid(userId), course: a.course })
    if (!e) throw new Error("the user has no enrollment on the assignment's course")
    const key = `worldstreet-academy/submissions/${assignmentId}/${userId}/${now.getTime()}-fixture.pdf`
    const r = await db.collection("submissions").insertOne({
      assignment: a._id, course: a.course, user: oid(userId), enrollment: e._id, text: "Fixture submission text.",
      files: [{ key, filename: "trade-plan.pdf", mimeType: "application/pdf", sizeBytes: 1024 }],
      status: "submitted", submittedAt: now, grade: null, feedback: "", gradedBy: null, gradedAt: null,
      createdAt: now, updatedAt: now,
    })
    console.log(JSON.stringify({ submissionId: r.insertedId.toString(), key }))
  } else if (cmd === "assignments") {
    for (const a of await db.collection("assignments").find({}).sort({ createdAt: 1 }).toArray()) {
      console.log(`  assignment ${a._id} ${JSON.stringify(a.title)} status=${a.status} course=${a.course} dueAt=${a.dueAt ? a.dueAt.toISOString() : null}`)
    }
    for (const s of await db.collection("submissions").find({}).sort({ createdAt: 1 }).toArray()) {
      console.log(`  submission ${s._id} assignment=${s.assignment} user=${s.user} status=${s.status} grade=${s.grade} files=${(s.files ?? []).map((f) => f.key).join("|")} text=${JSON.stringify(s.text)} feedback=${JSON.stringify(s.feedback ?? "")}`)
    }
```

   - Smoke test: `node "$H/mockdb.cjs" restore && node "$H/mockdb.cjs" mentorship && node "$H/mockdb.cjs" assignments` prints `indexes: ` and nothing else.
4. **Restart after Task 1's commit** (schema). Use the Phase 4 command (wallet stub + `CRON_SECRET=phase4-cron-secret` + the placeholder RTK/Resend/OpenAI keys). Confirm `curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "Authorization: Bearer phase4-cron-secret" $BASE/api/cron/reminders` → `200`.

---

### Task 1: Data and rules — three collections, two additive fields, `includesMentorship`, submission-key helpers

**Files:**
- Create: `lib/db/models/mentorship-session.ts`
- Create: `lib/db/models/assignment.ts`
- Create: `lib/db/models/submission.ts`
- Modify: `lib/db/models/meeting.ts` (interface after `applicationId`; schema after `applicationId`)
- Modify: `lib/db/models/enrollment.ts` (interface after `bestScorePercent`; schema after the `bestScorePercent` block)
- Modify: `lib/db/models/index.ts` (append three export lines)
- Modify: `lib/entitlements.ts` (append `includesMentorship`)
- Modify: `lib/r2.ts` (three helpers above `export { r2Client }`)

**Interfaces:**
- Produces:
  - `MentorshipSession`, `IMentorshipSession`, `MentorshipSessionStatus = "requested" | "confirmed" | "declined" | "cancelled"`
  - `Assignment`, `IAssignment`, `AssignmentStatus = "draft" | "published"`
  - `Submission`, `ISubmission`, `ISubmissionFile`, `SubmissionStatus = "submitted" | "graded"`
  - `IMeeting.mentorshipSessionId?: Types.ObjectId`
  - `IEnrollment.mentorRoadmap: { text: string; updatedAt: Date; updatedBy: Types.ObjectId } | null`
  - `includesMentorship(course: { packages?: ICoursePackage[] | null }, enrollment: { packageKey?: PackageKey | null } | null | undefined): boolean`
  - `hasPrivateResourceBucket(): boolean` · `submissionKeyPrefix(assignmentId: string, userId: string): string` · `generateSubmissionKey(assignmentId: string, userId: string, originalFilename: string): string`
- No actions (ruling 20).

- [ ] **Step 1: `MentorshipSession`.** Create `lib/db/models/mentorship-session.ts`:

```ts
import mongoose, { Schema, Document, Model, Types } from "mongoose"

/**
 * One Executive mentorship session (spec §6 "Private 1-on-1 coaching"). The
 * student proposes up to three times; the course instructor confirms one,
 * which creates an interview-shaped scheduled Meeting — deliberately without
 * courseId, which would reach every live-class student — linked back through
 * Meeting.mentorshipSessionId.
 *
 *   requested → confirmed | declined (instructor) | cancelled (either party)
 *   confirmed → cancelled (either party, while the room is still unstarted)
 *
 * "Upcoming" vs "past" is derived at read time from the linked meeting and the
 * time; v1 stores no completed state. New collection — the Go API doesn't read it.
 */

export type MentorshipSessionStatus = "requested" | "confirmed" | "declined" | "cancelled"

export interface IMentorshipSession extends Document {
  _id: Types.ObjectId
  student: Types.ObjectId
  /** The course instructor when the request was made. */
  instructor: Types.ObjectId
  course: Types.ObjectId
  enrollment: Types.ObjectId
  status: MentorshipSessionStatus
  /** 1–3 times the student proposed. */
  proposedSlots: { at: Date }[]
  /** What the student wants to cover (≤ 1,000). */
  note: string
  /** The confirmed slot. */
  scheduledAt: Date | null
  /** The Meeting (_id) created on confirmation. */
  meetingId: Types.ObjectId | null
  /** Decline or cancellation note from whoever closed it. */
  responseNote: string
  cancelledBy: Types.ObjectId | null
  createdAt: Date
  updatedAt: Date
}

const MentorshipSessionSchema = new Schema<IMentorshipSession>(
  {
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    instructor: { type: Schema.Types.ObjectId, ref: "User", required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    enrollment: { type: Schema.Types.ObjectId, ref: "Enrollment", required: true },
    status: {
      type: String,
      enum: ["requested", "confirmed", "declined", "cancelled"],
      default: "requested",
    },
    proposedSlots: [
      {
        at: { type: Date, required: true },
        _id: false,
      },
    ],
    note: { type: String, default: "", maxlength: 1000 },
    scheduledAt: { type: Date, default: null },
    meetingId: { type: Schema.Types.ObjectId, ref: "Meeting", default: null },
    responseNote: { type: String, default: "", maxlength: 500 },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
)

MentorshipSessionSchema.index({ instructor: 1, status: 1, createdAt: 1 })
MentorshipSessionSchema.index({ student: 1, createdAt: -1 })
// One open request per enrollment, race-safe (the InstructorApplication precedent).
MentorshipSessionSchema.index(
  { enrollment: 1 },
  { unique: true, partialFilterExpression: { status: "requested" } }
)

export const MentorshipSession: Model<IMentorshipSession> =
  mongoose.models.MentorshipSession ||
  mongoose.model<IMentorshipSession>("MentorshipSession", MentorshipSessionSchema)
```

- [ ] **Step 2: `Assignment`.** Create `lib/db/models/assignment.ts`:

```ts
import mongoose, { Schema, Document, Model, Types } from "mongoose"

/**
 * A practical assignment on a course (spec §6 "Practical assignments", D7 v2).
 * Course-level in v1. Students see published ones only when their package
 * includes `assignments` (lib/actions/assignments.ts). New collection — the Go
 * API doesn't read it.
 */

export type AssignmentStatus = "draft" | "published"

export interface IAssignment extends Document {
  _id: Types.ObjectId
  course: Types.ObjectId
  /** The course instructor when created. */
  instructor: Types.ObjectId
  title: string
  /** Plain text (≤ 5,000). */
  instructions: string
  /** Shown to students; never enforced in v1. */
  dueAt: Date | null
  status: AssignmentStatus
  createdAt: Date
  updatedAt: Date
}

const AssignmentSchema = new Schema<IAssignment>(
  {
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    instructor: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    instructions: { type: String, default: "", maxlength: 5000 },
    dueAt: { type: Date, default: null },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
  },
  { timestamps: true }
)

AssignmentSchema.index({ course: 1, status: 1, createdAt: 1 })

export const Assignment: Model<IAssignment> =
  mongoose.models.Assignment || mongoose.model<IAssignment>("Assignment", AssignmentSchema)
```

- [ ] **Step 3: `Submission`.** Create `lib/db/models/submission.ts`:

```ts
import mongoose, { Schema, Document, Model, Types } from "mongoose"

/**
 * A student's answer to one assignment: text and up to three files. Files live
 * ONLY in the private resources bucket; this row stores storage keys, never a
 * URL, and downloads are short-lived signed URLs minted after an ownership or
 * staff check (lib/actions/assignments.ts). One submission per student per
 * assignment, overwritten until graded. New collection — the Go API doesn't read it.
 */

export type SubmissionStatus = "submitted" | "graded"

export interface ISubmissionFile {
  /** R2 key under worldstreet-academy/submissions/<assignmentId>/<userId>/ in the private bucket. */
  key: string
  filename: string
  mimeType: string
  sizeBytes: number
}

export interface ISubmission extends Document {
  _id: Types.ObjectId
  assignment: Types.ObjectId
  course: Types.ObjectId
  user: Types.ObjectId
  enrollment: Types.ObjectId
  text: string
  files: ISubmissionFile[]
  status: SubmissionStatus
  submittedAt: Date
  /** 0–100 once graded. */
  grade: number | null
  feedback: string
  gradedBy: Types.ObjectId | null
  gradedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const SubmissionSchema = new Schema<ISubmission>(
  {
    assignment: { type: Schema.Types.ObjectId, ref: "Assignment", required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    enrollment: { type: Schema.Types.ObjectId, ref: "Enrollment", required: true },
    text: { type: String, default: "", maxlength: 10000 },
    files: [
      {
        key: { type: String, required: true },
        filename: { type: String, default: "" },
        mimeType: { type: String, default: "" },
        sizeBytes: { type: Number, default: 0 },
        _id: false,
      },
    ],
    status: { type: String, enum: ["submitted", "graded"], default: "submitted" },
    submittedAt: { type: Date, default: Date.now },
    grade: { type: Number, default: null, min: 0, max: 100 },
    feedback: { type: String, default: "", maxlength: 5000 },
    gradedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    gradedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

SubmissionSchema.index({ assignment: 1, user: 1 }, { unique: true })
SubmissionSchema.index({ user: 1, assignment: 1, status: 1 })

export const Submission: Model<ISubmission> =
  mongoose.models.Submission || mongoose.model<ISubmission>("Submission", SubmissionSchema)
```

- [ ] **Step 4: `Meeting.mentorshipSessionId`.** In `lib/db/models/meeting.ts`:
  1. Replace

```ts
  /** Set when this meeting is an instructor-application interview. */
  applicationId?: Types.ObjectId
```

   with

```ts
  /** Set when this meeting is an instructor-application interview. */
  applicationId?: Types.ObjectId
  /** Set when this meeting is an Executive mentorship session (private; joinMeeting gates it). */
  mentorshipSessionId?: Types.ObjectId
```

  2. Replace

```ts
    applicationId: { type: Schema.Types.ObjectId, ref: "InstructorApplication" },
```

   with

```ts
    applicationId: { type: Schema.Types.ObjectId, ref: "InstructorApplication" },
    mentorshipSessionId: { type: Schema.Types.ObjectId, ref: "MentorshipSession" },
```

   No default: interviews and classes keep the field absent, which Task 4's `$exists: false` filter relies on.

- [ ] **Step 5: `Enrollment.mentorRoadmap`.** In `lib/db/models/enrollment.ts`:
  1. Replace

```ts
  bestScorePercent: number | null
  createdAt: Date
  updatedAt: Date
}
```

   with

```ts
  bestScorePercent: number | null
  /** Executive mentor's plain-text roadmap for this student (Phase 7). Additive — Go ignores it. */
  mentorRoadmap: { text: string; updatedAt: Date; updatedBy: Types.ObjectId } | null
  createdAt: Date
  updatedAt: Date
}
```

  2. Replace

```ts
    bestScorePercent: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  }
)
```

   with

```ts
    bestScorePercent: {
      type: Number,
      default: null,
    },
    mentorRoadmap: {
      type: new Schema(
        {
          text: { type: String, required: true, maxlength: 5000 },
          updatedAt: { type: Date, required: true },
          updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
        },
        { _id: false }
      ),
      default: null,
    },
  },
  {
    timestamps: true,
  }
)
```

- [ ] **Step 6: Barrel.** In `lib/db/models/index.ts`, directly after the line `export { ExamAttempt, type IExamAttempt, type IAttemptAnswer, type AttemptStatus } from "./exam-attempt"`, add:

```ts
export { MentorshipSession, type IMentorshipSession, type MentorshipSessionStatus } from "./mentorship-session"
export { Assignment, type IAssignment, type AssignmentStatus } from "./assignment"
export { Submission, type ISubmission, type ISubmissionFile, type SubmissionStatus } from "./submission"
```

- [ ] **Step 7: The mentorship rule.** In `lib/entitlements.ts`, directly after the closing `}` of `lowestPackageWith` (its body is `return PACKAGE_KEYS.find((key) => packageFor(course, key)?.entitlements[flag]) ?? null`), append:

```ts

/**
 * Executive mentorship (spec §6 "Private 1-on-1 coaching"): an enrollment that
 * bought the Executive package, while that package is still on the course (found
 * by key, `enabled` ignored — buyers keep what they paid for) and includes
 * mentorship. Legacy null-package rows and single "Full program" tiers never
 * qualify: full ACCESS is not a purchased service. Server callers pair it with an
 * access-granting enrollment (`getCourseAccess`). The dashboard's
 * `isMentorEnrollment` is the client twin.
 */
export function includesMentorship(course: CourseLike, enrollment: EnrollmentLike): boolean {
  if (enrollment?.packageKey !== "executive") return false
  return Boolean((course.packages ?? []).find((p) => p.key === "executive")?.entitlements.mentorship)
}
```

- [ ] **Step 8: Submission-key helpers.** In `lib/r2.ts`, directly above the last line `export { r2Client }`, insert:

```ts
/**
 * Student submission files refuse to upload unless the PRIVATE resources bucket
 * is configured. Unlike course resources they never fall back to the public
 * bucket (R2_RESOURCE_BUCKET's `|| R2_BUCKET`).
 */
export function hasPrivateResourceBucket(): boolean {
  return Boolean(process.env.R2_RESOURCES_BUCKET_NAME)
}

/** The folder one student's files for one assignment live in — submitAssignment only accepts keys inside it. */
export function submissionKeyPrefix(assignmentId: string, userId: string): string {
  return `worldstreet-academy/submissions/${assignmentId}/${userId}/`
}

/** Key for one submission file: inside the student's folder, unguessable, extension kept. */
export function generateSubmissionKey(assignmentId: string, userId: string, originalFilename: string): string {
  const randomId = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10)
  const extension = originalFilename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin"
  return `${submissionKeyPrefix(assignmentId, userId)}${Date.now()}-${randomId}.${extension}`
}

```

- [ ] **Step 9: Verify.**
  1. `npx tsc --noEmit 2>&1 | grep -v '^\.next/'` → nothing. Then `npx eslint lib/db/models/mentorship-session.ts lib/db/models/assignment.ts lib/db/models/submission.ts lib/db/models/meeting.ts lib/db/models/enrollment.ts lib/db/models/index.ts lib/entitlements.ts lib/r2.ts` → clean.
  2. Pure rule check. Write `$P7/t1-rules.ts`:

```ts
import { includesMentorship } from "@/lib/entitlements"
import type { ICoursePackage, IPackageEntitlements } from "@/lib/db/models"

const flags = (mentorship: boolean): IPackageEntitlements => ({
  liveClasses: true, instructorQa: true, assignments: true, certificate: true, mentorship, prioritySupport: mentorship,
})
const pkg = (key: ICoursePackage["key"], mentorship: boolean, enabled = true): ICoursePackage => ({
  key, name: key, tagline: "", price: 1, features: [], highlight: false, ctaLabel: null, enabled, entitlements: flags(mentorship),
})
const ladder = { packages: [pkg("basic", false), pkg("standard", false), pkg("executive", true)] }
const checks: [string, boolean, boolean][] = [
  ["executive on ladder", includesMentorship(ladder, { packageKey: "executive" }), true],
  ["standard", includesMentorship(ladder, { packageKey: "standard" }), false],
  ["legacy null package", includesMentorship(ladder, { packageKey: null }), false],
  ["no enrollment", includesMentorship(ladder, null), false],
  ["executive disabled for sale keeps it", includesMentorship({ packages: [pkg("executive", true, false)] }, { packageKey: "executive" }), true],
  ["executive removed from course", includesMentorship({ packages: [pkg("standard", true)] }, { packageKey: "executive" }), false],
  ["executive without mentorship flag", includesMentorship({ packages: [pkg("executive", false)] }, { packageKey: "executive" }), false],
  ["single full-program standard with mentorship", includesMentorship({ packages: [pkg("standard", true)] }, { packageKey: "standard" }), false],
]
let failed = 0
for (const [name, got, want] of checks) {
  if (got !== want) failed++
  console.log(`${got === want ? "ok  " : "FAIL"} ${name}: ${got}`)
}
process.exit(failed ? 1 : 0)
```

   From the repo root run `npx tsx --tsconfig tsconfig.json "$P7/t1-rules.ts"` → eight `ok` lines, exit 0. If the `@/` alias doesn't resolve for a file outside the repo, copy it to the repo root as `t1-rules.tmp.ts`, run `npx tsx t1-rules.tmp.ts`, then delete it. Never commit it. (`lib/entitlements.ts` has only `import type` from models, so nothing touches Mongo.)
  3. **(controller)** Restart the dev server (Controller setup step 4), then `curl -s -o /dev/null -w "%{http_code}\n" $BASE/dashboard` → `200`.

- [ ] **Step 10: Commit.**

```bash
git add lib/db/models/mentorship-session.ts lib/db/models/assignment.ts lib/db/models/submission.ts lib/db/models/meeting.ts lib/db/models/enrollment.ts lib/db/models/index.ts lib/entitlements.ts lib/r2.ts
git commit -m "feat(executive): mentorship session, assignment and submission models; roadmap and session-meeting fields; mentorship rule

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Student mentorship — request, cancel, `/dashboard/mentorship`, the tile link

**Files:**
- Create: `lib/actions/mentorship.ts`
- Modify: `lib/email.tsx` (add `sendMentorshipEmail` directly after `sendClassReminderEmail`)
- Modify: `lib/hooks/queries/keys.ts` (two keys after `assessments`)
- Create: `app/(platform)/dashboard/mentorship/page.tsx`
- Modify: `components/dashboard/home-tiles.tsx` (`InstructorsTile`: one link under the headline)

**Interfaces:**
- Consumes: `MentorshipSession`, `includesMentorship`, `getCourseAccess`, `notifyUser`, `formatUtcDateTime` (`lib/email.tsx`), `APP_URL`, `formatDateTime` (`lib/dashboard-home.ts`), `isoToLocalInput` / `localInputToIso` (`lib/datetime-local.ts`), `SimplePipelineEmail` (module-private in `lib/email.tsx`).
- Produces:
  - `sendMentorshipEmail(to: string, data: { subject: string; title: string; bodyText: string; ctaLabel: string; ctaUrl: string; recipientName?: string }): Promise<{ success: boolean; error?: string }>`
  - `type MentorshipSessionView = { id; courseId; courseTitle; studentName; instructorName; status: "requested" | "upcoming" | "past" | "declined" | "cancelled"; proposedSlots: string[]; scheduledAt: string | null; note; responseNote; joinHref: string | null }`
  - `type MentorshipProgram = { courseId; courseTitle; instructorName; roadmap: { text: string; updatedAt: string } | null; hasOpenRequest: boolean }`
  - `type MyMentorship = { programs: MentorshipProgram[]; sessions: MentorshipSessionView[] }`
  - `getMyMentorship(): Promise<MyMentorship>`
  - `requestMentorshipSession(input: { courseId: string; slots: string[]; note?: string }): Promise<{ success: true; data: { sessionId: string } } | { success: false; error: string }>`
  - `cancelMentorshipSession(sessionId: string, note?: string): Promise<{ success: true; data: { status: "declined" | "cancelled" } } | { success: false; error: string }>`
  - `queryKeys.mentorship`, `queryKeys.mentorshipQueue`
  - Module-private helpers Task 3 reuses: `OBJECT_ID`, `STUDENT_PATH`, `INSTRUCTOR_PATH`, `fullName`, `mailable`, `toViews`.

- [ ] **Step 1: The email.** In `lib/email.tsx`, find the end of `sendClassReminderEmail`:

```tsx
    console.error("[Email] Class reminder error:", err)
    return { success: false, error: "Failed to send email" }
  }
}
```

   Directly after that closing `}`, add:

```tsx

/**
 * Executive mentorship mail — request, confirmation, decline/cancellation and
 * T-24h/T-1h reminders. The caller composes the copy (times via
 * formatUtcDateTime, which names its zone).
 */
export async function sendMentorshipEmail(
  to: string,
  data: {
    subject: string
    title: string
    bodyText: string
    ctaLabel: string
    ctaUrl: string
    recipientName?: string
  }
) {
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: data.subject,
      react: React.createElement(SimplePipelineEmail, {
        preview: data.title,
        title: data.title,
        bodyText: data.bodyText,
        ctaLabel: data.ctaLabel,
        ctaUrl: data.ctaUrl,
        avatarName: data.recipientName,
      }),
    })
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err) {
    console.error("[Email] Mentorship email error:", err)
    return { success: false, error: "Failed to send email" }
  }
}
```

- [ ] **Step 2: The actions.** Create `lib/actions/mentorship.ts`:

```ts
"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod/v4"
import connectDB from "@/lib/db"
import {
  Course,
  Enrollment,
  Meeting,
  MentorshipSession,
  User,
  type MentorshipSessionStatus,
} from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth/actions"
import { getCourseAccess } from "@/lib/course-access"
import { includesMentorship } from "@/lib/entitlements"
import { notifyUser } from "@/lib/notify"
import { formatUtcDateTime, sendMentorshipEmail } from "@/lib/email"
import { APP_URL } from "@/lib/app-url"

/*
 * Executive mentorship (spec §6): the student proposes times, the course
 * instructor confirms one (→ a private scheduled Meeting), either side can
 * cancel, and the instructor keeps a plain-text roadmap on the enrollment.
 * Who qualifies is `includesMentorship` over `getCourseAccess` — never inline.
 */

const OBJECT_ID = /^[a-f0-9]{24}$/
/** A proposed time must leave the instructor at least this long to answer. */
const MIN_LEAD_MS = 60 * 60_000
/** Nobody books further out than this. */
const MAX_AHEAD_MS = 60 * 24 * 3600_000
/** A confirmed session the host never started reads "upcoming" this long past its time, then "past". */
const SESSION_GRACE_MS = 2 * 3600_000
const STUDENT_PATH = "/dashboard/mentorship"
const INSTRUCTOR_PATH = "/instructor/meetings"

/* ═══════════════════ shared ═══════════════════ */

export type MentorshipSessionView = {
  id: string
  courseId: string
  courseTitle: string
  studentName: string
  instructorName: string
  status: "requested" | "upcoming" | "past" | "declined" | "cancelled"
  /** ISO times the student proposed. */
  proposedSlots: string[]
  /** ISO — set once confirmed. */
  scheduledAt: string | null
  note: string
  responseNote: string
  /** Upcoming confirmed sessions: the meetings page's join link (it refuses politely before the host starts). */
  joinHref: string | null
}

type SessionLean = {
  _id: { toString(): string }
  student: { toString(): string }
  instructor: { toString(): string }
  course: { toString(): string }
  status: MentorshipSessionStatus
  proposedSlots: { at: Date }[]
  scheduledAt: Date | null
  note: string
  responseNote: string
  meetingId: { toString(): string } | null
}

function fullName(
  person: { firstName?: string | null; lastName?: string | null } | null | undefined,
  fallback: string
): string {
  const name = `${person?.firstName ?? ""} ${person?.lastName ?? ""}`.trim()
  return name || fallback
}

/** Placeholder addresses minted for mobile sign-ups never get mail (the reminders cron's rule). */
function mailable(email: string | null | undefined): email is string {
  return typeof email === "string" && email !== "" && !email.endsWith("@users.noemail")
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000
}

function viewStatus(
  status: MentorshipSessionStatus,
  scheduledAt: Date | null,
  meetingStatus: string | undefined,
  now: number
): MentorshipSessionView["status"] {
  if (status !== "confirmed") return status
  if (meetingStatus === "ended") return "past"
  if (meetingStatus === "active" || meetingStatus === "waiting") return "upcoming"
  return scheduledAt && scheduledAt.getTime() + SESSION_GRACE_MS < now ? "past" : "upcoming"
}

/** Sessions → views: names, course titles and meeting states in three bulk reads. */
async function toViews(sessions: SessionLean[]): Promise<MentorshipSessionView[]> {
  if (sessions.length === 0) return []
  const userIds = [...new Set(sessions.flatMap((s) => [s.student.toString(), s.instructor.toString()]))]
  const courseIds = [...new Set(sessions.map((s) => s.course.toString()))]
  const meetingIds = sessions.flatMap((s) => (s.meetingId ? [s.meetingId.toString()] : []))
  const [users, courses, meetings] = await Promise.all([
    User.find({ _id: { $in: userIds } }).select("firstName lastName").lean(),
    Course.find({ _id: { $in: courseIds } }).select("title").lean(),
    Meeting.find({ _id: { $in: meetingIds } }).select("status").lean(),
  ])
  const usersById = new Map(users.map((u) => [u._id.toString(), u]))
  const titlesById = new Map(courses.map((c) => [c._id.toString(), c.title]))
  const meetingStatusById = new Map(meetings.map((m) => [m._id.toString(), m.status]))
  const now = Date.now()

  return sessions.map((s) => {
    const meetingId = s.meetingId ? s.meetingId.toString() : null
    const status = viewStatus(s.status, s.scheduledAt, meetingId ? meetingStatusById.get(meetingId) : undefined, now)
    return {
      id: s._id.toString(),
      courseId: s.course.toString(),
      courseTitle: titlesById.get(s.course.toString()) ?? "",
      studentName: fullName(usersById.get(s.student.toString()), "Student"),
      instructorName: fullName(usersById.get(s.instructor.toString()), "Your mentor"),
      status,
      proposedSlots: (s.proposedSlots ?? []).map((slot) => slot.at.toISOString()),
      scheduledAt: s.scheduledAt ? s.scheduledAt.toISOString() : null,
      note: s.note ?? "",
      responseNote: s.responseNote ?? "",
      joinHref: status === "upcoming" && meetingId ? `/dashboard/meetings?join=${meetingId}` : null,
    }
  })
}

/* ═══════════════════ student ═══════════════════ */

export type MentorshipProgram = {
  courseId: string
  courseTitle: string
  instructorName: string
  roadmap: { text: string; updatedAt: string } | null
  /** An unanswered request exists — the form stays closed until it's answered. */
  hasOpenRequest: boolean
}

export type MyMentorship = {
  /** Access-granting Executive enrollments whose package includes mentorship. */
  programs: MentorshipProgram[]
  /** Every session the student ever requested, newest first (history survives a lapsed package). */
  sessions: MentorshipSessionView[]
}

export async function getMyMentorship(): Promise<MyMentorship> {
  const empty: MyMentorship = { programs: [], sessions: [] }
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return empty

    const [enrollments, sessions] = await Promise.all([
      Enrollment.find({ user: user.id, status: { $in: ["active", "completed"] }, packageKey: "executive" })
        .select("course packageKey mentorRoadmap")
        .lean(),
      MentorshipSession.find({ student: user.id }).sort({ createdAt: -1 }).limit(50).lean(),
    ])
    const courses = await Course.find({ _id: { $in: enrollments.map((e) => e.course) } })
      .select("title packages instructor")
      .lean()
    const coursesById = new Map(courses.map((c) => [c._id.toString(), c]))
    const mentored = enrollments.flatMap((enrollment) => {
      const course = coursesById.get(enrollment.course.toString())
      return course && includesMentorship(course, enrollment) ? [{ enrollment, course }] : []
    })
    const instructors = await User.find({ _id: { $in: mentored.map((m) => m.course.instructor) } })
      .select("firstName lastName")
      .lean()
    const instructorsById = new Map(instructors.map((u) => [u._id.toString(), u]))
    const openRequests = new Set(
      sessions.filter((s) => s.status === "requested").map((s) => s.enrollment.toString())
    )

    return {
      programs: mentored.map(({ enrollment, course }) => ({
        courseId: course._id.toString(),
        courseTitle: course.title,
        instructorName: fullName(instructorsById.get(course.instructor.toString()), "Your mentor"),
        roadmap: enrollment.mentorRoadmap
          ? { text: enrollment.mentorRoadmap.text, updatedAt: enrollment.mentorRoadmap.updatedAt.toISOString() }
          : null,
        hasOpenRequest: openRequests.has(enrollment._id.toString()),
      })),
      sessions: await toViews(sessions),
    }
  } catch (error) {
    console.error("Get my mentorship error:", error)
    return empty
  }
}

const RequestInput = z.object({
  courseId: z.string().regex(OBJECT_ID, "Unknown program"),
  slots: z.array(z.string()).min(1, "Propose at least one time").max(3, "Propose up to three times"),
  note: z.string().trim().max(1000, "Keep your note under 1,000 characters").default(""),
})

/** The student proposes 1–3 times for a private session on one Executive program. */
export async function requestMentorshipSession(input: {
  courseId: string
  slots: string[]
  note?: string
}): Promise<{ success: true; data: { sessionId: string } } | { success: false; error: string }> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "You need to be signed in" }

    const parsed = RequestInput.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again" }
    }

    const now = Date.now()
    const times = [...new Set(parsed.data.slots.map((slot) => new Date(slot).getTime()))].sort((a, b) => a - b)
    if (times.some((t) => Number.isNaN(t))) return { success: false, error: "Pick valid dates and times" }
    if (times.some((t) => t < now + MIN_LEAD_MS)) {
      return { success: false, error: "Each time must be at least an hour from now" }
    }
    if (times.some((t) => t > now + MAX_AHEAD_MS)) {
      return { success: false, error: "Propose times within the next 60 days" }
    }

    const access = await getCourseAccess(user.id, parsed.data.courseId)
    if (!access || !includesMentorship(access.course, access)) {
      return { success: false, error: "Private mentorship isn't included in your package" }
    }

    let sessionId: string
    try {
      const session = await MentorshipSession.create({
        student: user.id,
        instructor: access.course.instructorId,
        course: access.course.id,
        enrollment: access.enrollmentId,
        status: "requested",
        proposedSlots: times.map((t) => ({ at: new Date(t) })),
        note: parsed.data.note,
      })
      sessionId = session._id.toString()
    } catch (error) {
      if (isDuplicateKey(error)) return { success: false, error: "You already have a request waiting for your mentor" }
      throw error
    }

    const [course, instructor] = await Promise.all([
      Course.findById(access.course.id).select("title").lean(),
      User.findById(access.course.instructorId).select("firstName email").lean(),
    ])
    const courseTitle = course?.title ?? "their program"
    const studentName = fullName(user, user.email)
    const proposed = times.map((t) => formatUtcDateTime(new Date(t))).join("; ")

    void notifyUser(access.course.instructorId, {
      type: "meeting",
      title: "Mentorship session requested",
      body: `${studentName} (${courseTitle}) proposed: ${proposed}.`.slice(0, 500),
      href: INSTRUCTOR_PATH,
    })
    if (mailable(instructor?.email)) {
      void sendMentorshipEmail(instructor.email, {
        subject: "New mentorship session request",
        title: "A student asked for a session",
        bodyText: `${studentName} (${courseTitle}) proposed: ${proposed}. Confirm one from Meetings.`,
        ctaLabel: "Review request",
        ctaUrl: `${APP_URL}${INSTRUCTOR_PATH}`,
        recipientName: instructor.firstName || undefined,
      })
    }

    revalidatePath(STUDENT_PATH)
    return { success: true, data: { sessionId } }
  } catch (error) {
    console.error("Request mentorship session error:", error)
    return { success: false, error: "Couldn't send your request — try again" }
  }
}

const CancelInput = z.object({
  sessionId: z.string().regex(OBJECT_ID, "Session not found"),
  note: z.string().trim().max(500, "Keep the note under 500 characters").default(""),
})

/**
 * Close a session. The course instructor on a request → declined; either party
 * on a request or an unstarted confirmed session → cancelled (its meeting ends,
 * leaving invites and the reminder cron). The other side is told.
 */
export async function cancelMentorshipSession(
  sessionId: string,
  note?: string
): Promise<{ success: true; data: { status: "declined" | "cancelled" } } | { success: false; error: string }> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "You need to be signed in" }

    const parsed = CancelInput.safeParse({ sessionId, note: note ?? "" })
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again" }
    }

    const session = await MentorshipSession.findById(parsed.data.sessionId).lean()
    if (!session) return { success: false, error: "Session not found" }
    const isStudent = session.student.toString() === user.id
    const isInstructor = session.instructor.toString() === user.id
    if (!isStudent && !isInstructor) return { success: false, error: "Session not found" }
    if (session.status !== "requested" && session.status !== "confirmed") {
      return { success: false, error: "This session is already closed" }
    }

    if (session.status === "confirmed" && session.meetingId) {
      const meeting = await Meeting.findById(session.meetingId).select("status").lean()
      if (meeting?.status === "ended") return { success: false, error: "This session has already happened" }
      if (meeting && meeting.status !== "scheduled") {
        return { success: false, error: "This session has started — end it from the room" }
      }
    }

    const nextStatus: "declined" | "cancelled" =
      session.status === "requested" && isInstructor ? "declined" : "cancelled"
    const closed = await MentorshipSession.findOneAndUpdate(
      { _id: session._id, status: session.status },
      { $set: { status: nextStatus, responseNote: parsed.data.note, cancelledBy: user.id } },
      { new: true }
    )
    if (!closed) return { success: false, error: "This session just changed — refresh and try again" }

    if (session.meetingId) {
      await Meeting.updateOne(
        { _id: session.meetingId, status: "scheduled" },
        { $set: { status: "ended", endedAt: new Date() } }
      )
    }

    const [counterpart, course] = await Promise.all([
      User.findById(isStudent ? session.instructor : session.student).select("firstName email").lean(),
      Course.findById(session.course).select("title").lean(),
    ])
    const courseTitle = course?.title ?? "the program"
    const actorName = fullName(user, isStudent ? "Your student" : "Your mentor")
    const quoted = parsed.data.note ? ` “${parsed.data.note}”` : ""
    const title = nextStatus === "declined" ? "Mentorship request declined" : "Mentorship session cancelled"
    const body =
      nextStatus === "declined"
        ? `${actorName} can't take the times you proposed for ${courseTitle}.${quoted} You can propose new times.`
        : session.scheduledAt
          ? `${actorName} cancelled the ${formatUtcDateTime(session.scheduledAt)} session for ${courseTitle}.${quoted}`
          : `${actorName} withdrew the session request for ${courseTitle}.${quoted}`
    const href = isStudent ? INSTRUCTOR_PATH : STUDENT_PATH

    void notifyUser((isStudent ? session.instructor : session.student).toString(), {
      type: "meeting",
      title,
      body: body.slice(0, 500),
      href,
    })
    if (mailable(counterpart?.email)) {
      void sendMentorshipEmail(counterpart.email, {
        subject: title,
        title,
        bodyText: body,
        ctaLabel: isStudent ? "Open meetings" : "Open mentorship",
        ctaUrl: `${APP_URL}${href}`,
        recipientName: counterpart.firstName || undefined,
      })
    }

    revalidatePath(STUDENT_PATH)
    revalidatePath(INSTRUCTOR_PATH)
    return { success: true, data: { status: nextStatus } }
  } catch (error) {
    console.error("Cancel mentorship session error:", error)
    return { success: false, error: "Couldn't update the session — try again" }
  }
}
```

   (`mailable` is a type guard, so `instructor.email` / `counterpart.email` narrow to `string` inside the `if`. If tsc doesn't narrow the optional-chained object, bind `const email = instructor?.email` first and pass `email`. Never use `!` or `any`.)

- [ ] **Step 3: Keys.** In `lib/hooks/queries/keys.ts`, directly after `  assessments: ["assessments"] as const,` add:

```ts
  mentorship: ["mentorship"] as const,
  mentorshipQueue: ["mentorship-queue"] as const,
```

- [ ] **Step 4: The student page.** Create `app/(platform)/dashboard/mentorship/page.tsx`:

```tsx
"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { CalendarClockIcon, CompassIcon } from "lucide-react"
import { Topbar } from "@/components/platform/topbar"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  cancelMentorshipSession,
  getMyMentorship,
  requestMentorshipSession,
  type MentorshipProgram,
  type MentorshipSessionView,
} from "@/lib/actions/mentorship"
import { formatDateTime } from "@/lib/dashboard-home"
import { isoToLocalInput, localInputToIso } from "@/lib/datetime-local"
import { queryKeys } from "@/lib/hooks/queries/keys"
import { cn } from "@/lib/utils"

/* Spec §6 Executive: private 1-on-1 sessions and the personal roadmap. No gold
   on this page — its actions are secondary to the dashboard's Continue learning. */

const SESSION_STATUS: Record<MentorshipSessionView["status"], { label: string; className: string }> = {
  requested: { label: "Waiting for your mentor", className: "bg-ws-warning/10 text-ws-warning" },
  upcoming: { label: "Confirmed", className: "bg-ws-success/10 text-ws-success" },
  past: { label: "Past", className: "bg-ws-chip text-ws-muted" },
  declined: { label: "Declined", className: "bg-ws-chip text-ws-muted" },
  cancelled: { label: "Cancelled", className: "bg-ws-chip text-ws-muted" },
}

function RequestForm({ program, onSent }: { program: MentorshipProgram; onSent: () => void }) {
  const [slots, setSlots] = React.useState(["", "", ""])
  const [note, setNote] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()
  // Earliest pickable time, an hour out, in the viewer's timezone. The form only
  // mounts after the query resolves in the browser, so this never server-renders.
  const [minLocal] = React.useState(() => isoToLocalInput(new Date(Date.now() + 60 * 60_000).toISOString()))

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        const picked = slots.map((value) => localInputToIso(value)).filter((iso) => iso !== "")
        if (picked.length === 0) {
          setError("Propose at least one time")
          return
        }
        startTransition(async () => {
          const res = await requestMentorshipSession({ courseId: program.courseId, slots: picked, note })
          if (res.success) {
            setSlots(["", "", ""])
            setNote("")
            onSent()
          } else {
            setError(res.error)
          }
        })
      }}
    >
      <p className="text-[13px] text-ws-muted">
        Propose up to three times that suit you. {program.instructorName} confirms one.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {slots.map((value, i) => (
          <div key={i} className="min-w-0 space-y-1">
            <Label htmlFor={`slot-${program.courseId}-${i}`} className="text-[11px] text-ws-muted">
              {i === 0 ? "Option 1" : `Option ${i + 1} (optional)`}
            </Label>
            <Input
              id={`slot-${program.courseId}-${i}`}
              type="datetime-local"
              value={value}
              min={minLocal}
              required={i === 0}
              onChange={(e) => {
                const next = e.target.value
                setSlots((prev) => prev.map((slot, j) => (j === i ? next : slot)))
              }}
              className="h-10 w-full min-w-0 text-sm"
            />
          </div>
        ))}
      </div>
      <div className="space-y-1">
        <Label htmlFor={`note-${program.courseId}`} className="text-[11px] text-ws-muted">
          What would you like to cover? (optional)
        </Label>
        <Textarea
          id={`note-${program.courseId}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          className="min-h-16"
        />
      </div>
      {error && <p className="text-xs text-ws-danger">{error}</p>}
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Sending…" : "Request a session"}
      </Button>
    </form>
  )
}

function ProgramCard({ program, onChanged }: { program: MentorshipProgram; onChanged: () => void }) {
  return (
    <section className="space-y-5 rounded-lg bg-ws-surface p-5">
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ws-muted">Executive mentorship</p>
        <h2 className="mt-1 font-display text-lg font-semibold text-ws-primary">{program.courseTitle}</h2>
        <p className="text-[13px] text-ws-muted">Your mentor · {program.instructorName}</p>
      </div>

      <div className="rounded-md bg-ws-sunken p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ws-primary">
          <CompassIcon size={14} className="text-ws-muted" aria-hidden />
          Your roadmap
        </h3>
        {program.roadmap ? (
          <>
            <p className="mt-2 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-ws-primary">
              {program.roadmap.text}
            </p>
            <p className="mt-2 text-[11px] tabular-nums text-ws-subtle">
              Updated {formatDateTime(program.roadmap.updatedAt)}
            </p>
          </>
        ) : (
          <p className="mt-2 text-[13px] text-ws-muted">
            Your mentor hasn&apos;t written your roadmap yet — it appears here once they do.
          </p>
        )}
      </div>

      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ws-primary">
          <CalendarClockIcon size={14} className="text-ws-muted" aria-hidden />
          Private sessions
        </h3>
        {program.hasOpenRequest ? (
          <p className="text-[13px] text-ws-muted">
            Your request is with {program.instructorName}. You&apos;ll get a notification when they confirm a time.
          </p>
        ) : (
          <RequestForm program={program} onSent={onChanged} />
        )}
      </div>
    </section>
  )
}

function SessionRow({ session, onChanged }: { session: MentorshipSessionView; onChanged: () => void }) {
  const [confirming, setConfirming] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()
  const chip = SESSION_STATUS[session.status]
  const cancellable = session.status === "requested" || session.status === "upcoming"

  return (
    <li className="rounded-md bg-ws-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-ws-primary">{session.courseTitle}</p>
          <p className="text-[11px] tabular-nums text-ws-muted">
            {session.scheduledAt
              ? formatDateTime(session.scheduledAt)
              : `Proposed: ${session.proposedSlots.map((slot) => formatDateTime(slot)).join(" · ")}`}
          </p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", chip.className)}>
          {chip.label}
        </span>
      </div>
      {session.responseNote && (
        <p className="mt-2 break-words text-[12px] text-ws-muted">“{session.responseNote}”</p>
      )}
      {(session.joinHref || cancellable) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {session.joinHref && (
            <Button size="sm" variant="outline" render={<Link href={session.joinHref} />}>
              Open session
            </Button>
          )}
          {cancellable &&
            (confirming ? (
              <>
                <span className="text-[12px] text-ws-muted">
                  Cancel this {session.status === "requested" ? "request" : "session"}?
                </span>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      setError(null)
                      const res = await cancelMentorshipSession(session.id)
                      if (res.success) onChanged()
                      else setError(res.error)
                    })
                  }
                >
                  {pending ? "Cancelling…" : "Yes, cancel"}
                </Button>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
                  Keep
                </Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
                Cancel
              </Button>
            ))}
        </div>
      )}
      {error && <p className="mt-2 text-xs text-ws-danger">{error}</p>}
    </li>
  )
}

export default function MentorshipPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.mentorship,
    queryFn: () => getMyMentorship(),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000, // a confirmation shows up without a reload
  })
  const programs = data?.programs ?? []
  const sessions = data?.sessions ?? []
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.mentorship })

  return (
    <>
      <Topbar title="Mentorship" />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-4xl space-y-8">
          <PageHeader title="Mentorship" subline="Private 1-on-1 sessions and your personal roadmap." />

          {isLoading ? (
            <div className="h-48 animate-pulse rounded-lg bg-ws-surface" />
          ) : programs.length === 0 && sessions.length === 0 ? (
            <div className="rounded-lg bg-ws-surface px-6 py-8">
              <p className="text-[15px] font-semibold text-ws-primary">Mentorship comes with Executive packages</p>
              <p className="mt-1 text-[13px] text-ws-muted">
                When you enrol in an Executive package, your mentor, roadmap and private sessions appear here.
              </p>
              <Link
                href="/dashboard/courses"
                className="mt-4 inline-flex text-[13px] font-medium text-ws-primary hover:underline"
              >
                Browse programs
              </Link>
            </div>
          ) : (
            <>
              {programs.map((program) => (
                <ProgramCard key={program.courseId} program={program} onChanged={refresh} />
              ))}
              {sessions.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold text-ws-primary">Sessions</h2>
                  <ul className="space-y-2">
                    {sessions.map((session) => (
                      <SessionRow key={session.id} session={session} onChanged={refresh} />
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 5: The tile link.** In `components/dashboard/home-tiles.tsx` (`InstructorsTile`), replace

```tsx
              {row.headline && <p className="truncate text-xs text-ws-muted">{row.headline}</p>}
```

   with

```tsx
              {row.headline && <p className="truncate text-xs text-ws-muted">{row.headline}</p>}
              {row.isMentor && (
                <Link
                  href="/dashboard/mentorship"
                  className="mt-0.5 inline-block text-xs font-medium text-ws-primary hover:underline"
                >
                  Sessions &amp; roadmap
                </Link>
              )}
```

   (`Link` is already imported in that file. `row.isMentor` is Phase 4's `isMentorEnrollment`, the client twin of `includesMentorship`.)

- [ ] **Step 6: Verify.** tsc; `npx eslint lib/actions/mentorship.ts lib/email.tsx lib/hooks/queries/keys.ts "app/(platform)/dashboard/mentorship/page.tsx" components/dashboard/home-tiles.tsx`.

```bash
node "$H/mockdb.cjs" restore
N=$(node "$H/mockdb.cjs" fixture executive | field enrollmentId)
MP=/dashboard/mentorship
T1=$(iso 2880); T2=$(iso 4320); SOON=$(iso 30); FAR=$(iso 90000)
req() { bash "$H/action.sh" "$MP" requestMentorshipSession "[{\"courseId\":\"$1\",\"slots\":$2,\"note\":\"Risk review\"}]" "${3:-student}"; }
mine() { bash "$H/action.sh" "$MP" getMyMentorship '[]' "${1:-student}"; }
```

  1. Read model:
     - `mine` → `programs` holds exactly one row with `courseId` `$F`, `"roadmap":null`, `"hasOpenRequest":false`; `"sessions":[]`.
     - `mine admin` → `{"programs":[],"sessions":[]}`.
  2. Refusals (each prints `{"success":false,"error":…}`):
     - `req $F '[]'` → `Propose at least one time`.
     - `req $F "[\"$SOON\"]"` → `Each time must be at least an hour from now`.
     - `req $F "[\"$FAR\"]"` → `Propose times within the next 60 days`.
     - `req $F '["not-a-date"]'` → `Pick valid dates and times`.
     - `req nope "[\"$T1\"]"` → `Unknown program`.
     - `req $BTC "[\"$T1\"]"` → `Private mentorship isn't included in your package` (legacy FULL_ACCESS is not mentorship).
     - `node "$H/mockdb.cjs" set-package $N standard`, then `req $F "[\"$T1\"]"` → the same refusal. `set-package $N executive` afterwards.
     - `req $F "[\"$T1\"]" admin` → the same refusal (no enrollment).
  3. Request:
     - `S=$(req $F "[\"$T1\",\"$T2\",\"$T1\"]" | field data.sessionId)` → a 24-hex id.
     - `node "$H/mockdb.cjs" mentorship` → `indexes:` includes `enrollment_1 unique partial={"status":"requested"}`, and one session `status=requested` with exactly two slots, ascending (the duplicate collapsed).
     - `node "$H/mockdb.cjs" notifications 3` → `to=$INSTRUCTOR type=meeting "Mentorship session requested" … href=/instructor/meetings`.
     - `req $F "[\"$T2\"]"` → `You already have a request waiting for your mentor`.
     - `mine` → `"hasOpenRequest":true`; `sessions[0]` has `"status":"requested"`, two `proposedSlots`, `"joinHref":null`.
  4. Cancel and decline:
     - `bash "$H/action.sh" "$MP" cancelMentorshipSession "[\"$S\"]" admin` → `Session not found`.
     - The same as student → `{"success":true,"data":{"status":"cancelled"}}`; again → `This session is already closed`.
     - `notifications 1` → to the instructor, `"Mentorship session cancelled"`.
     - `S2=$(req $F "[\"$T1\"]" | field data.sessionId)` (the partial index lets a new request in).
     - As the instructor, from the same page (instructors may open `/dashboard/*`): `bash "$H/action.sh" "$MP" cancelMentorshipSession "[\"$S2\",\"Those times clash with a class\"]" instructor` → `{"success":true,"data":{"status":"declined"}}`.
     - `mentorship` → S2 `response="Those times clash with a class"`. `notifications 1` → to the student, `"Mentorship request declined"`, `href=/dashboard/mentorship`.
     - `bash "$H/action.sh" "$MP" cancelMentorshipSession '["nope"]'` → `Session not found`.
  5. Confirmed sessions (fixture meetings):
     - `C=$(node "$H/mockdb.cjs" mentorship-fixture $N confirmed 1440)`; `S3=$(echo "$C" | field sessionId)`; `M3=$(echo "$C" | field meetingId)`.
     - `mine` → S3 has `"status":"upcoming"` and `"joinHref":"/dashboard/meetings?join=M3"`.
     - Student cancel S3 → `cancelled`; `node "$H/mockdb.cjs" meetings` → M3 `status=ended`.
     - `C=$(node "$H/mockdb.cjs" mentorship-fixture $N confirmed 600)`, then S4/M4 from it. Start M4 by hand: `node -e 'const m=require("mongoose");m.connect("mongodb://127.0.0.1:27017/worldstreet-academy").then(async()=>{await m.connection.db.collection("meetings").updateOne({_id:new m.Types.ObjectId(process.argv[1])},{$set:{status:"active",startedAt:new Date()}});await m.disconnect()})' "$M4"`. Cancel S4 → `This session has started — end it from the room`.
     - `node "$H/mockdb.cjs" mentorship-fixture $N confirmed -180` → `mine` lists it with `"status":"past"` and `"joinHref":null`.
  6. Roadmap read: `node "$H/mockdb.cjs" set-roadmap $N "Week 1: journal every trade."` → `mine` → `programs[0].roadmap.text` = `Week 1: journal every trade.`
  7. **(controller)** Browser, student, same state:
     - `$B viewport 400x800`, `/dashboard/mentorship`: one Forex card with the roadmap text and "Private sessions" (a request form, since S2 was declined). Below, Sessions with Past / Cancelled / Declined chips; the declined row quotes the note.
     - `$B js "document.body.scrollWidth + '/' + window.innerWidth"` → `400/400`. Save `"$P7/t2-mentorship-400.png"`.
     - Submit the form with one time two days out → the form is replaced by "Your request is with Sarah Chen…" and a "Waiting for your mentor" row appears.
     - `/dashboard`: the Instructor / Mentor tile's Sarah Chen row shows "Your mentor" and "Sessions & roadmap" → the link opens `/dashboard/mentorship`. Save `"$P7/t2-tile-400.png"`.
     - `node "$H/mockdb.cjs" restore` and reload `/dashboard/mentorship` → "Mentorship comes with Executive packages"; `/dashboard` → no "Sessions & roadmap" link.
  8. End: `node "$H/mockdb.cjs" restore`.

- [ ] **Step 7: Commit.**

```bash
git add lib/actions/mentorship.ts lib/email.tsx lib/hooks/queries/keys.ts "app/(platform)/dashboard/mentorship/page.tsx" components/dashboard/home-tiles.tsx
git commit -m "feat(mentorship): Executive students request private sessions, cancel them and read their roadmap

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Instructor side — the Mentorship panel, confirming a slot (room up front), the roadmap editor

**Files:**
- Modify: `lib/actions/mentorship.ts` (two import lines; append an INSTRUCTOR section at the end of the file)
- Create: `components/mentorship/mentorship-panel.tsx`
- Modify: `app/(instructor)/instructor/meetings/page.tsx` (one import; the panel above `CourseMeetingCards`)

**Interfaces:**
- Consumes: Task 2's module-private `OBJECT_ID`, `STUDENT_PATH`, `INSTRUCTOR_PATH`, `fullName`, `mailable`, `toViews` and the exported `MentorshipSessionView` and `cancelMentorshipSession`; `createMeeting as createRTKMeeting`, `addParticipant` (`lib/realtime.ts`); `queryKeys.mentorshipQueue`, `queryKeys.meetings`.
- Produces:
  - `type MenteeView = { enrollmentId: string; courseId: string; courseTitle: string; studentName: string; intake: { goals: string; availability: string } | null; roadmap: { text: string; updatedAt: string } | null }`
  - `type MentorshipQueue = { requests: MentorshipSessionView[]; upcoming: MentorshipSessionView[]; mentees: MenteeView[] }`
  - `getMentorshipQueue(): Promise<MentorshipQueue>`
  - `confirmMentorshipSession(sessionId: string, slotISO: string): Promise<{ success: true; data: { meetingId: string; scheduledAt: string } } | { success: false; error: string }>`
  - `saveMentorRoadmap(enrollmentId: string, text: string): Promise<{ success: true; data: { updatedAt: string | null } } | { success: false; error: string }>`
  - `MentorshipPanel()`, which renders nothing when all three lists are empty.

- [ ] **Step 1: Imports.** In `lib/actions/mentorship.ts`:
  - replace `import { revalidatePath } from "next/cache"` with

```ts
import { revalidatePath } from "next/cache"
import { Types } from "mongoose"
```

  - replace `import { APP_URL } from "@/lib/app-url"` with

```ts
import { APP_URL } from "@/lib/app-url"
import { createMeeting as createRTKMeeting, addParticipant } from "@/lib/realtime"
```

- [ ] **Step 2: Instructor actions.** Append at the end of `lib/actions/mentorship.ts`:

```ts

/* ═══════════════════ instructor ═══════════════════ */

export type MenteeView = {
  enrollmentId: string
  courseId: string
  courseTitle: string
  studentName: string
  /** The Executive onboarding intake from checkout (D4), when sent. */
  intake: { goals: string; availability: string } | null
  roadmap: { text: string; updatedAt: string } | null
}

export type MentorshipQueue = {
  /** Unanswered requests, oldest first. */
  requests: MentorshipSessionView[]
  /** Confirmed sessions not yet past, soonest first. */
  upcoming: MentorshipSessionView[]
  /** Access-granting Executive enrollments with mentorship on courses you teach. */
  mentees: MenteeView[]
}

/** The signed-in instructor's mentorship work: requests, booked sessions, mentees. */
export async function getMentorshipQueue(): Promise<MentorshipQueue> {
  const empty: MentorshipQueue = { requests: [], upcoming: [], mentees: [] }
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user || (user.role !== "INSTRUCTOR" && user.role !== "ADMIN")) return empty

    const courses = await Course.find({ instructor: user.id }).select("title packages").lean()
    const [enrollments, sessions] = await Promise.all([
      Enrollment.find({
        course: { $in: courses.map((c) => c._id) },
        status: { $in: ["active", "completed"] },
        packageKey: "executive",
      })
        .select("user course packageKey mentorshipIntake mentorRoadmap")
        .sort({ createdAt: 1 })
        .lean(),
      MentorshipSession.find({ instructor: user.id, status: { $in: ["requested", "confirmed"] } })
        .sort({ createdAt: 1 })
        .limit(100)
        .lean(),
    ])
    const coursesById = new Map(courses.map((c) => [c._id.toString(), c]))
    const mentored = enrollments.flatMap((enrollment) => {
      const course = coursesById.get(enrollment.course.toString())
      return course && includesMentorship(course, enrollment) ? [{ enrollment, course }] : []
    })
    const [students, views] = await Promise.all([
      User.find({ _id: { $in: mentored.map((m) => m.enrollment.user) } }).select("firstName lastName").lean(),
      toViews(sessions),
    ])
    const studentsById = new Map(students.map((s) => [s._id.toString(), s]))

    return {
      requests: views.filter((v) => v.status === "requested"),
      upcoming: views
        .filter((v) => v.status === "upcoming")
        .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? "")),
      mentees: mentored.map(({ enrollment, course }) => ({
        enrollmentId: enrollment._id.toString(),
        courseId: course._id.toString(),
        courseTitle: course.title,
        studentName: fullName(studentsById.get(enrollment.user.toString()), "Student"),
        intake: enrollment.mentorshipIntake
          ? { goals: enrollment.mentorshipIntake.goals, availability: enrollment.mentorshipIntake.availability }
          : null,
        roadmap: enrollment.mentorRoadmap
          ? { text: enrollment.mentorRoadmap.text, updatedAt: enrollment.mentorRoadmap.updatedAt.toISOString() }
          : null,
      })),
    }
  } catch (error) {
    console.error("Get mentorship queue error:", error)
    return empty
  }
}

const ConfirmInput = z.object({
  sessionId: z.string().regex(OBJECT_ID, "Session not found"),
  slot: z.string().min(1, "Pick one of the proposed times"),
})

/**
 * The course instructor confirms one proposed time. The RTK room is minted first
 * (scheduled classes and interviews do the same), then the Meeting, then the
 * request is claimed atomically. A RealtimeKit failure writes nothing — the
 * request stays open; a lost claim deletes the unused Meeting row.
 */
export async function confirmMentorshipSession(
  sessionId: string,
  slotISO: string
): Promise<{ success: true; data: { meetingId: string; scheduledAt: string } } | { success: false; error: string }> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "You need to be signed in" }

    const parsed = ConfirmInput.safeParse({ sessionId, slot: slotISO })
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again" }
    }

    const session = await MentorshipSession.findOne({ _id: parsed.data.sessionId, instructor: user.id }).lean()
    if (!session) return { success: false, error: "Session not found" }
    if (session.status !== "requested") return { success: false, error: "This request was already answered" }

    const wanted = new Date(parsed.data.slot).getTime()
    const picked = (session.proposedSlots ?? []).find((slot) => slot.at.getTime() === wanted)
    if (!picked) return { success: false, error: "Pick one of the proposed times" }
    if (picked.at.getTime() <= Date.now() + 60_000) {
      return { success: false, error: "That time has passed — decline it and ask the student for new times" }
    }

    // The student must still hold Executive mentorship (a refund or package change closes the door).
    const access = await getCourseAccess(session.student.toString(), session.course.toString())
    if (!access || !includesMentorship(access.course, access)) {
      return { success: false, error: "This student's package no longer includes mentorship" }
    }

    const [student, course] = await Promise.all([
      User.findById(session.student).select("firstName lastName email").lean(),
      Course.findById(session.course).select("title").lean(),
    ])
    if (!student) return { success: false, error: "Session not found" }
    const studentName = fullName(student, "Student")
    const hostName = fullName(user, "Your mentor")
    const courseTitle = course?.title ?? "the program"
    const scheduledAt = picked.at

    let rtkMeetingId: string
    let hostToken: string
    try {
      rtkMeetingId = await createRTKMeeting(`Mentorship: ${studentName}`)
      const hostParticipant = await addParticipant(rtkMeetingId, {
        name: hostName,
        customParticipantId: user.id,
        presetName: "group_call_host",
      })
      hostToken = hostParticipant.authToken
    } catch (error) {
      console.error("[Mentorship] room setup failed:", error)
      return { success: false, error: "Couldn't open a room for this session — try again" }
    }

    // Interview-shaped on purpose: no courseId (that would reach every live-class student).
    const meeting = await Meeting.create({
      title: `Mentorship session · ${courseTitle} · ${studentName}`,
      description: `Private mentorship session for ${courseTitle}.`,
      hostId: new Types.ObjectId(user.id),
      status: "scheduled",
      scheduledAt,
      meetingId: rtkMeetingId,
      hostToken,
      mentorshipSessionId: session._id,
      reminders: {
        // Within 24 h the confirmation itself is the heads-up; the 1h reminder still fires.
        h24SentAt: scheduledAt.getTime() - Date.now() <= 24 * 3600 * 1000 ? new Date() : null,
        h1SentAt: null,
      },
      participants: [
        { userId: new Types.ObjectId(user.id), role: "host", status: "admitted", joinedAt: new Date() },
      ],
      invites: [{ userId: student._id, email: student.email ?? "", status: "sent", sentAt: new Date() }],
      settings: {
        allowScreenShare: true,
        muteOnEntry: false,
        requireApproval: true,
        // joinMeeting's privacy gate admits only this session's student, so no waiting room.
        guestAccess: true,
        maxParticipants: 10,
      },
    })

    const claimed = await MentorshipSession.findOneAndUpdate(
      { _id: session._id, status: "requested" },
      { $set: { status: "confirmed", scheduledAt, meetingId: meeting._id } },
      { new: true }
    )
    if (!claimed) {
      await Meeting.deleteOne({ _id: meeting._id })
      return { success: false, error: "This request was already answered" }
    }

    void notifyUser(student._id.toString(), {
      type: "meeting",
      title: "Mentorship session confirmed",
      body: `${hostName} confirmed ${formatUtcDateTime(scheduledAt)} for ${courseTitle}.`,
      href: STUDENT_PATH,
    })
    if (mailable(student.email)) {
      void sendMentorshipEmail(student.email, {
        subject: "Your mentorship session is confirmed",
        title: "Session confirmed",
        bodyText: `${student.firstName || "Hi"}, ${hostName} confirmed your private session for ${courseTitle} on ${formatUtcDateTime(scheduledAt, "full")}. Open it from Mentorship when it's time — you can join once your mentor starts it.`,
        ctaLabel: "View session",
        ctaUrl: `${APP_URL}${STUDENT_PATH}`,
        recipientName: student.firstName || undefined,
      })
    }

    revalidatePath(STUDENT_PATH)
    revalidatePath(INSTRUCTOR_PATH)
    return { success: true, data: { meetingId: meeting._id.toString(), scheduledAt: scheduledAt.toISOString() } }
  } catch (error) {
    console.error("Confirm mentorship session error:", error)
    return { success: false, error: "Couldn't confirm the session — try again" }
  }
}

const RoadmapInput = z.object({
  enrollmentId: z.string().regex(OBJECT_ID, "Student not found"),
  text: z.string().trim().max(5000, "Keep the roadmap under 5,000 characters"),
})

/** The course instructor writes (or, with empty text, clears) a mentee's plain-text roadmap. */
export async function saveMentorRoadmap(
  enrollmentId: string,
  text: string
): Promise<{ success: true; data: { updatedAt: string | null } } | { success: false; error: string }> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "You need to be signed in" }

    const parsed = RoadmapInput.safeParse({ enrollmentId, text })
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Check the roadmap and try again" }
    }

    const enrollment = await Enrollment.findById(parsed.data.enrollmentId).select("user course packageKey status").lean()
    if (!enrollment) return { success: false, error: "Student not found" }
    const course = await Course.findById(enrollment.course).select("instructor packages title").lean()
    if (!course || course.instructor.toString() !== user.id) return { success: false, error: "Student not found" }
    if ((enrollment.status !== "active" && enrollment.status !== "completed") || !includesMentorship(course, enrollment)) {
      return { success: false, error: "This student's package doesn't include mentorship" }
    }

    const roadmap = parsed.data.text
      ? { text: parsed.data.text, updatedAt: new Date(), updatedBy: new Types.ObjectId(user.id) }
      : null
    await Enrollment.updateOne({ _id: enrollment._id }, { $set: { mentorRoadmap: roadmap } })

    if (roadmap) {
      void notifyUser(enrollment.user.toString(), {
        type: "course",
        title: "Your roadmap was updated",
        body: `${fullName(user, "Your mentor")} updated your personal roadmap for ${course.title}.`,
        href: STUDENT_PATH,
      })
    }

    revalidatePath(STUDENT_PATH)
    return { success: true, data: { updatedAt: roadmap ? roadmap.updatedAt.toISOString() : null } }
  } catch (error) {
    console.error("Save mentor roadmap error:", error)
    return { success: false, error: "Couldn't save the roadmap — try again" }
  }
}
```

- [ ] **Step 3: The panel.** Create `components/mentorship/mentorship-panel.tsx`:

```tsx
"use client"

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  cancelMentorshipSession,
  confirmMentorshipSession,
  getMentorshipQueue,
  saveMentorRoadmap,
  type MenteeView,
  type MentorshipSessionView,
} from "@/lib/actions/mentorship"
import { formatDateTime } from "@/lib/dashboard-home"
import { queryKeys } from "@/lib/hooks/queries/keys"

/* Executive mentorship on /instructor/meetings: answer requests, see booked
   sessions (they start from Active Meetings below), keep each mentee's roadmap.
   Outline/ghost only — gold stays with the page's own actions. */

type ActionResult = { success: boolean; error?: string }

function useRowAction(onChanged: () => void) {
  const [error, setError] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()
  function run(action: () => Promise<ActionResult>, onSuccess?: () => void) {
    setError(null)
    startTransition(async () => {
      const res = await action()
      if (res.success) {
        onSuccess?.()
        onChanged()
      } else {
        setError(res.error ?? "Something went wrong — try again")
      }
    })
  }
  return { error, pending, run }
}

function RequestRow({ session, onChanged }: { session: MentorshipSessionView; onChanged: () => void }) {
  const [declining, setDeclining] = React.useState(false)
  const [note, setNote] = React.useState("")
  const { error, pending, run } = useRowAction(onChanged)

  return (
    <li className="space-y-3 rounded-md bg-ws-sunken p-3">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-ws-primary">{session.studentName}</p>
        <p className="truncate text-[11px] text-ws-muted">{session.courseTitle}</p>
        {session.note && <p className="mt-1 break-words text-[12px] text-ws-muted">“{session.note}”</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {session.proposedSlots.map((slot) => (
          <Button
            key={slot}
            size="sm"
            variant="outline"
            className="tabular-nums"
            disabled={pending}
            onClick={() => run(() => confirmMentorshipSession(session.id, slot))}
          >
            Confirm {formatDateTime(slot)}
          </Button>
        ))}
        {!declining && (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setDeclining(true)}>
            Decline
          </Button>
        )}
      </div>
      {declining && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="Optional note to the student"
            aria-label="Note to the student"
            className="h-9 min-w-0 flex-1 basis-48 text-sm"
          />
          <Button
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={() => run(() => cancelMentorshipSession(session.id, note))}
          >
            Decline request
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setDeclining(false)}>
            Keep
          </Button>
        </div>
      )}
      {pending && <p className="text-[11px] text-ws-muted">Working…</p>}
      {error && <p className="text-xs text-ws-danger">{error}</p>}
    </li>
  )
}

function UpcomingRow({ session, onChanged }: { session: MentorshipSessionView; onChanged: () => void }) {
  const [confirming, setConfirming] = React.useState(false)
  const { error, pending, run } = useRowAction(onChanged)

  return (
    <li className="space-y-2 rounded-md bg-ws-sunken p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-ws-primary">
            {session.studentName} <span className="font-normal text-ws-muted">· {session.courseTitle}</span>
          </p>
          <p className="text-[11px] tabular-nums text-ws-muted">
            {session.scheduledAt ? formatDateTime(session.scheduledAt) : ""} · start it from Active Meetings
          </p>
        </div>
        {confirming ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() => run(() => cancelMentorshipSession(session.id))}
            >
              {pending ? "Cancelling…" : "Cancel session"}
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
              Keep
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
            Cancel
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-ws-danger">{error}</p>}
    </li>
  )
}

function MenteeRow({ mentee, onChanged }: { mentee: MenteeView; onChanged: () => void }) {
  const [editing, setEditing] = React.useState(false)
  const [text, setText] = React.useState(mentee.roadmap?.text ?? "")
  const { error, pending, run } = useRowAction(onChanged)

  return (
    <li className="space-y-2 rounded-md bg-ws-sunken p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-ws-primary">{mentee.studentName}</p>
          <p className="truncate text-[11px] text-ws-muted">{mentee.courseTitle}</p>
        </div>
        {!editing && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setText(mentee.roadmap?.text ?? "")
              setEditing(true)
            }}
          >
            {mentee.roadmap ? "Edit roadmap" : "Write roadmap"}
          </Button>
        )}
      </div>
      {mentee.intake && (
        <p className="break-words text-[12px] text-ws-muted">
          <span className="text-ws-subtle">Goals</span> · {mentee.intake.goals}{" "}
          <span className="text-ws-subtle">· Availability</span> · {mentee.intake.availability}
        </p>
      )}
      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={5000}
            className="min-h-32"
            aria-label={`Roadmap for ${mentee.studentName}`}
            placeholder="Milestones, focus areas and what to practise before the next session"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => run(() => saveMentorRoadmap(mentee.enrollmentId, text), () => setEditing(false))}
            >
              {pending ? "Saving…" : "Save roadmap"}
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <span className="ml-auto text-[11px] tabular-nums text-ws-subtle">{text.length}/5000</span>
          </div>
        </div>
      ) : mentee.roadmap ? (
        <p className="line-clamp-3 whitespace-pre-wrap break-words text-[12px] text-ws-primary">{mentee.roadmap.text}</p>
      ) : (
        <p className="text-[12px] text-ws-muted">No roadmap yet.</p>
      )}
      {error && <p className="text-xs text-ws-danger">{error}</p>}
    </li>
  )
}

export function MentorshipPanel() {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: queryKeys.mentorshipQueue,
    queryFn: () => getMentorshipQueue(),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  })
  const requests = data?.requests ?? []
  const upcoming = data?.upcoming ?? []
  const mentees = data?.mentees ?? []
  if (requests.length + upcoming.length + mentees.length === 0) return null

  // A confirmation creates a scheduled meeting in Active Meetings; refresh both.
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.mentorshipQueue })
    queryClient.invalidateQueries({ queryKey: queryKeys.meetings })
  }

  return (
    <section id="mentorship" className="space-y-4 rounded-lg bg-ws-surface p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ws-primary">Mentorship</h2>
        <span className="text-[11px] tabular-nums text-ws-muted">
          {requests.length} to answer · {upcoming.length} upcoming · {mentees.length} mentee{mentees.length === 1 ? "" : "s"}
        </span>
      </div>
      {requests.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-ws-muted">Requests</h3>
          <ul className="space-y-2">
            {requests.map((session) => (
              <RequestRow key={session.id} session={session} onChanged={refresh} />
            ))}
          </ul>
        </div>
      )}
      {upcoming.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-ws-muted">Upcoming sessions</h3>
          <ul className="space-y-2">
            {upcoming.map((session) => (
              <UpcomingRow key={session.id} session={session} onChanged={refresh} />
            ))}
          </ul>
        </div>
      )}
      {mentees.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-ws-muted">Mentees</h3>
          <ul className="space-y-2">
            {mentees.map((mentee) => (
              <MenteeRow key={mentee.enrollmentId} mentee={mentee} onChanged={refresh} />
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Mount it.** In `app/(instructor)/instructor/meetings/page.tsx`:
  - directly after `import { useMyMeetings, useMeetingHistory, useInstructorMeetingCourses, queryKeys } from "@/lib/hooks/queries"` add `import { MentorshipPanel } from "@/components/mentorship/mentorship-panel"`;
  - replace

```tsx
          {/* Course cards - Go Live from your courses */}
          <CourseMeetingCards
```

   with

```tsx
          {/* Executive mentorship — requests, booked sessions, roadmaps (Phase 7) */}
          <MentorshipPanel />

          {/* Course cards - Go Live from your courses */}
          <CourseMeetingCards
```

- [ ] **Step 5: Verify.** tsc; `npx eslint lib/actions/mentorship.ts components/mentorship/mentorship-panel.tsx "app/(instructor)/instructor/meetings/page.tsx"`.

```bash
node "$H/mockdb.cjs" restore
N=$(node "$H/mockdb.cjs" fixture executive | field enrollmentId)
IP=/instructor/meetings
R=$(node "$H/mockdb.cjs" mentorship-fixture $N requested 2880)
S=$(echo "$R" | field sessionId); SLOT=$(echo "$R" | field slots | node -e 'process.stdin.on("data",d=>console.log(JSON.parse(d)[0]))')
queue() { bash "$H/action.sh" "$IP" getMentorshipQueue '[]' "${1:-instructor}"; }
confirm() { bash "$H/action.sh" "$IP" confirmMentorshipSession "[\"$1\",\"$2\"]" "${3:-instructor}"; }
```

  1. Queue:
     - `queue` → `requests` has one row (`id` $S, `"studentName":"Johnson Demo"`, two `proposedSlots`), `"upcoming":[]`, and `mentees` one row (`enrollmentId` $N, `"intake":null`, `"roadmap":null`).
     - `queue admin` → all three empty (the admin teaches nothing).
     - As student: `ID=$(PRINT_ID=1 bash "$H/action.sh" "$IP" getMentorshipQueue '[]' instructor)`; `post "$ID" "$IP" student '[]'` → all three empty (role USER).
  2. Confirm refusals:
     - `confirm $S "$(iso 1000)"` → `Pick one of the proposed times`.
     - `confirm nope "$SLOT"` → `Session not found`.
     - `confirm $S "$SLOT" admin` → `Session not found`.
     - `node "$H/mockdb.cjs" set-package $N standard`; `confirm $S "$SLOT"` → `This student's package no longer includes mentorship`; `set-package $N executive`.
  3. **Up to the RTK call:** `confirm $S "$SLOT"` → `{"success":false,"error":"Couldn't open a room for this session — try again"}`. Then `node "$H/mockdb.cjs" mentorship` → S still `status=requested meeting=null`, and `node "$H/mockdb.cjs" meetings` prints nothing: RTK failed and nothing was written.
  4. Decline, then a passed slot:
     - `bash "$H/action.sh" "$IP" cancelMentorshipSession "[\"$S\",\"Fully booked this week\"]" instructor` → `declined`; `notifications 1` → to the student, `"Mentorship request declined"`.
     - `R2=$(node "$H/mockdb.cjs" mentorship-fixture $N requested 0)`; `confirm $(echo "$R2" | field sessionId) "$(echo "$R2" | field slots | node -e 'process.stdin.on("data",d=>console.log(JSON.parse(d)[0]))')"` → `That time has passed — decline it and ask the student for new times`.
  5. Upcoming + cancel:
     - `C=$(node "$H/mockdb.cjs" mentorship-fixture $N confirmed 1440)` → `queue` → `upcoming` holds it with `scheduledAt` ≈ now + 24 h.
     - `bash "$H/action.sh" "$IP" cancelMentorshipSession "[\"$(echo "$C" | field sessionId)\"]" instructor` → `cancelled`; `meetings` → its meeting `status=ended`; `notifications 1` → to the student, `"Mentorship session cancelled"`.
  6. Roadmap:
     - `bash "$H/action.sh" "$IP" saveMentorRoadmap "[\"$N\",\"Week 1: journal every trade.\\nWeek 2: risk 1% per trade.\"]" instructor` → `success:true` with an ISO `updatedAt`. `mentorship` → `roadmap enrollment=$N by=$INSTRUCTOR "Week 1: journal every trade.\nWeek 2: risk 1% per trade."`. `notifications 1` → to the student, `"Your roadmap was updated"`, `href=/dashboard/mentorship`. `queue` → `mentees[0].roadmap.text` matches.
     - `…saveMentorRoadmap "[\"$N\",\"\"]"` → `{"success":true,"data":{"updatedAt":null}}`; the `mentorship` roadmap line is gone.
     - `…saveMentorRoadmap "[\"$BTC_ENR\",\"x\"]"` → `This student's package doesn't include mentorship`.
     - `LONG=$(node -e 'console.log("a".repeat(5001))')`; `…saveMentorRoadmap "[\"$N\",\"$LONG\"]"` → `Keep the roadmap under 5,000 characters`.
     - `…saveMentorRoadmap "[\"$N\",\"x\"]" admin` → `Student not found`.
     - The student reads it: Task 2's `getMyMentorship` on `/dashboard/mentorship` shows the text after a re-save.
  7. **(controller)** Browser, instructor persona:
     - `node "$H/mockdb.cjs" restore`; `N=$(… fixture executive …)`; `node "$H/mockdb.cjs" mentorship-fixture $N requested 2880`.
     - `$B viewport 400x800`, `/instructor/meetings`: the Mentorship panel sits above the course cards. It shows `1 to answer · 0 upcoming · 1 mentee`, a request row with two "Confirm <date>" buttons and Decline, and a mentee row with "Write roadmap".
     - Tap a Confirm → the row shows `Couldn't open a room for this session — try again`.
     - Write a roadmap and save → the row shows the preview.
     - `$B js "document.body.scrollWidth + '/' + window.innerWidth"` → `400/400`. Save `"$P7/t3-panel-400.png"`; repeat at 1280×900 → `"$P7/t3-panel-1280.png"`.
     - `restore` and reload → no panel.
  8. End: `node "$H/mockdb.cjs" restore`.

   A real confirmation (room created, the host starts it, the student joins) needs RealtimeKit credentials. It is a staging check in the Phase report.

- [ ] **Step 6: Commit.**

```bash
git add lib/actions/mentorship.ts components/mentorship/mentorship-panel.tsx "app/(instructor)/instructor/meetings/page.tsx"
git commit -m "feat(mentorship): instructors confirm a proposed time into a private scheduled room, decline or cancel, and keep each mentee's roadmap

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Sessions run like classes — private join, host early-start, not-started refusal, Course Sessions filter, reminders

> **Controller first:** the dev server must carry `CRON_SECRET=phase4-cron-secret` (Controller setup step 4). If the cron probe answers 401, report **BLOCKED**.

**Files:**
- Modify: `lib/actions/meetings.ts` (models + entitlements imports; `joinMeeting` host guard, privacy gate, not-started refusal; `getMyMeetingInvites` direct-invite filter)
- Modify: `app/(platform)/dashboard/meetings/page.tsx` (`joinErrorMessage` only)
- Modify: `app/api/cron/reminders/route.ts` (import; doc comment; `title`; a session branch before the course-class branch)

**Interfaces:**
- Consumes: `IMeeting.mentorshipSessionId`, `MentorshipSession`, `includesMentorship`, `getCourseAccess` (already imported in `meetings.ts`), `sendMentorshipEmail`, `HOST_EARLY_START_MS`.
- Produces (behaviour only; no signatures change):
  - `joinMeeting` on a session meeting: the host is refused early with `"This class is scheduled for later"` + `startsAt` (unchanged string). A non-admin who isn't the confirmed session's student gets `"This mentorship session is private"`. A student without mentorship gets `"Private mentorship isn't included in your package"`. Before start: `"This session hasn't started yet"` + `startsAt`.
  - `getMyMeetingInvites` omits scheduled session meetings.
  - The cron sends `"Mentorship session coming up"` / `"Starting in ~1 hour"` to the host and the student only.

- [ ] **Step 1: Imports.** In `lib/actions/meetings.ts`:
  - replace `import { Meeting, User, Course, Enrollment, type IMeeting, type IMeetingParticipant, type MeetingStatus } from "@/lib/db/models"` with `import { Meeting, MentorshipSession, User, Course, Enrollment, type IMeeting, type IMeetingParticipant, type MeetingStatus } from "@/lib/db/models"`;
  - replace `import { entitlementsFor } from "@/lib/entitlements"` with `import { entitlementsFor, includesMentorship } from "@/lib/entitlements"`.

- [ ] **Step 2: Host early-start covers sessions.** In `joinMeeting`, replace

```ts
      // A scheduled course class can't be started more than HOST_EARLY_START_MS
      // ahead — a reminder tap a day early must not open the room. Interviews
      // (no courseId) keep starting whenever the host joins.
      if (
        meeting.courseId &&
        meeting.status === "scheduled" &&
```

   with

```ts
      // A scheduled course class or mentorship session can't be started more than
      // HOST_EARLY_START_MS ahead — a reminder tap a day early must not open the
      // room. Interviews keep starting whenever the host joins. The refusal text
      // stays class-worded: the instructor page matches it exactly.
      if (
        (meeting.courseId || meeting.mentorshipSessionId) &&
        meeting.status === "scheduled" &&
```

- [ ] **Step 3: The privacy gate.** Still in `joinMeeting`, find the end of the course-class gate:

```ts
        if (!access.entitlements.liveClasses) {
          return { success: false, error: "Live classes aren't included in your package" }
        }
      }
    }
```

   Directly after it, insert:

```ts

    // Mentorship sessions are private: only the confirmed session's student (or
    // an admin) gets in, and only while their package still includes mentorship.
    if (meeting.mentorshipSessionId && currentUser.role !== "ADMIN") {
      const session = await MentorshipSession.findById(meeting.mentorshipSessionId)
        .select("student course status")
        .lean()
      if (!session || session.status !== "confirmed" || session.student.toString() !== currentUser.id) {
        return { success: false, error: "This mentorship session is private" }
      }
      const access = await getCourseAccess(currentUser.id, session.course.toString())
      if (!access || !includesMentorship(access.course, access)) {
        return { success: false, error: "Private mentorship isn't included in your package" }
      }
    }
```

- [ ] **Step 4: Not started yet.** Replace

```ts
    if (meeting.courseId && meeting.status === "scheduled") {
      return {
        success: false,
        error: "This class hasn't started yet",
        startsAt: meeting.scheduledAt?.toISOString(),
      }
    }
```

   with

```ts
    if ((meeting.courseId || meeting.mentorshipSessionId) && meeting.status === "scheduled") {
      return {
        success: false,
        error: meeting.courseId ? "This class hasn't started yet" : "This session hasn't started yet",
        startsAt: meeting.scheduledAt?.toISOString(),
      }
    }
```

   Also update the comment directly above it: replace `// keep their waiting room.` with `// keep their waiting room; mentorship sessions follow the class rule.`

- [ ] **Step 5: Course Sessions.** In `getMyMeetingInvites`, replace

```ts
      Meeting.find({
        "invites.userId": new Types.ObjectId(currentUser.id),
        status: { $in: ["active", "waiting", "scheduled"] },
      })
```

   with

```ts
      Meeting.find({
        "invites.userId": new Types.ObjectId(currentUser.id),
        // A booked mentorship session is listed on /dashboard/mentorship until
        // the host starts it — an invite row would show a live dot and Join.
        $or: [
          { status: { $in: ["active", "waiting"] } },
          { status: "scheduled", mentorshipSessionId: { $exists: false } },
        ],
      })
```

- [ ] **Step 6: The student's wording.** In `app/(platform)/dashboard/meetings/page.tsx`, replace the whole `joinErrorMessage` function (from its `/** A class that hasn't started …` comment through its closing `}`) with:

```tsx
/**
 * A class or mentorship session that hasn't started names its start time in the
 * viewer's timezone — or, once that has passed, the late host.
 */
function joinErrorMessage(result: { error?: string; startsAt?: string }): string {
  if (result.startsAt) {
    const isSession = result.error === "This session hasn't started yet"
    if (new Date(result.startsAt).getTime() <= Date.now()) {
      return isSession ? "Your mentor hasn't started this session yet" : "Your instructor hasn't started this class yet"
    }
    const when = new Date(result.startsAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
    return `${isSession ? "This session" : "This class"} hasn't started yet — it begins ${when}`
  }
  return result.error ?? "Couldn't join this meeting"
}
```

- [ ] **Step 7: Reminders.** In `app/api/cron/reminders/route.ts`:
  1. Replace `import { formatUtcDateTime, sendClassReminderEmail, sendInterviewReminderEmail } from "@/lib/email"` with `import { formatUtcDateTime, sendClassReminderEmail, sendInterviewReminderEmail, sendMentorshipEmail } from "@/lib/email"`.
  2. Replace

```ts
 * - Every other scheduled meeting (instructor interviews): host + invitees,
 *   interview wording, exactly as before.
```

   with

```ts
 * - Mentorship sessions (meeting.mentorshipSessionId): the host and the invited
 *   student only, session wording.
 * - Every other scheduled meeting (instructor interviews): host + invitees,
 *   interview wording, exactly as before.
```

  3. Replace

```ts
      const title =
        window === "1h"
          ? "Starting in ~1 hour"
          : meeting.courseId
            ? "Class coming up"
            : "Reminder: scheduled for tomorrow"
```

   with

```ts
      const title =
        window === "1h"
          ? "Starting in ~1 hour"
          : meeting.mentorshipSessionId
            ? "Mentorship session coming up"
            : meeting.courseId
              ? "Class coming up"
              : "Reminder: scheduled for tomorrow"
```

  4. Replace

```ts
      if (meeting.courseId) {
        // Course class: host + invitees + students whose package includes live classes.
```

   with

```ts
      if (meeting.mentorshipSessionId) {
        // Mentorship session: the host and the invited student — never a course audience.
        const hostId = meeting.hostId.toString()
        const recipients = await User.find({ _id: { $in: [...new Set([hostId, ...inviteeIds])] } })
          .select("firstName email")
          .lean()
        const whenFull = formatUtcDateTime(when, "full")

        for (const recipient of recipients) {
          const recipientId = recipient._id.toString()
          const isHost = recipientId === hostId
          const href = isHost ? HOST_CLASS_PATH : joinPath
          jobs.push(notifyUser(recipientId, { type: "meeting", title, body: bodyLine, href }))
          if (recipient.email && !recipient.email.endsWith("@users.noemail")) {
            jobs.push(
              sendMentorshipEmail(recipient.email, {
                subject:
                  window === "1h"
                    ? "Your mentorship session starts in about an hour"
                    : "Reminder: your mentorship session is coming up",
                title: window === "1h" ? "Session starting soon" : "Session coming up",
                bodyText: isHost
                  ? `${recipient.firstName || "Hi"}, ${meeting.title} is scheduled for ${whenFull}. Start it from Meetings — your student can join once you're in.`
                  : `${recipient.firstName || "Hi"}, your private session with ${hostName} is scheduled for ${whenFull}. You can join as soon as your mentor starts it.`,
                ctaLabel: isHost ? "Open meetings" : "View session",
                ctaUrl: `${APP_URL}${href}`,
                recipientName: recipient.firstName || undefined,
              })
            )
          }
        }
      } else if (meeting.courseId) {
        // Course class: host + invitees + students whose package includes live classes.
```

   The course-class and interview branches below are unchanged.

- [ ] **Step 8: Verify.** tsc; `npx eslint lib/actions/meetings.ts "app/(platform)/dashboard/meetings/page.tsx" app/api/cron/reminders/route.ts`.

```bash
node "$H/mockdb.cjs" restore
N=$(node "$H/mockdb.cjs" fixture executive | field enrollmentId)
MP=/dashboard/meetings; IP=/instructor/meetings
C=$(node "$H/mockdb.cjs" mentorship-fixture $N confirmed 90); S=$(echo "$C" | field sessionId); M=$(echo "$C" | field meetingId)
join() { bash "$H/action.sh" "$1" joinMeeting "[\"$2\"]" "$3"; }
mongo() { node -e 'const m=require("mongoose");m.connect("mongodb://127.0.0.1:27017/worldstreet-academy").then(async()=>{const [c,id,set]=process.argv.slice(1);const v=JSON.parse(set);for(const k of Object.keys(v)){if(/^[a-f0-9]{24}$/.test(String(v[k])))v[k]=new m.Types.ObjectId(v[k])}await m.connection.db.collection(c).updateOne({_id:new m.Types.ObjectId(id)},{$set:v});await m.disconnect()})' "$@"; }
cron() { curl -s -X POST -H "Authorization: Bearer phase4-cron-secret" $BASE/api/cron/reminders; echo; }
```

  1. Student before start: `join $MP $M student` → `{"success":false,"error":"This session hasn't started yet","startsAt":"<≈ now + 90 min>"}`.
  2. Admin: `join $MP $M admin` → the same refusal (the admin passes privacy, not the start rule).
  3. Package: `set-package $N standard` → `join $MP $M student` → `Private mentorship isn't included in your package`. `set-package $N executive` afterwards.
  4. Privacy:
     - `mongo mentorshipsessions $S "{\"student\":\"$ADMIN\"}"` → `join $MP $M student` → `This mentorship session is private`. Then `mongo mentorshipsessions $S "{\"student\":\"$STUDENT\"}"`.
     - `mongo mentorshipsessions $S '{"status":"cancelled"}'` → the same refusal. Then `mongo mentorshipsessions $S '{"status":"confirmed"}'`.
  5. Host early: `join $IP $M instructor` → `{"success":false,"error":"This class is scheduled for later","startsAt":…}`.
  6. Near start:
     - `C2=$(node "$H/mockdb.cjs" mentorship-fixture $N confirmed 10)`; `M2=$(echo "$C2" | field meetingId)`.
     - `join $IP $M2 instructor` → `"success":true`, `"role":"host"`, `meeting.status` `"active"`. `node "$H/mockdb.cjs" meetings` → M2 `status=active`.
     - `join $MP $M2 student` → `Failed to join meeting`: it passed every gate and reached RealtimeKit; it is not a refusal.
  7. Course Sessions:
     - `bash "$H/action.sh" "$MP" getMyMeetingInvites '[]'` → `invites` contains M2 and not M.
     - Interview regression: `I=$(node "$H/mockdb.cjs" scheduled-class-fixture none 30 | field meetingId)` → invites also contain I.
  8. Reminders (state: M scheduled at +90 min, M2 active, I scheduled at +30 min):
     - `cron` → `{"ok":true,"upcoming":2,"sent24":1,"sent1":1}`.
     - `node "$H/mockdb.cjs" notifications 4` → exactly two rows titled `"Mentorship session coming up"`: `to=$INSTRUCTOR … href=/instructor/meetings` and `to=$STUDENT … href=/dashboard/meetings?join=$M`, body `"Mentorship session · … — <UTC time>"`. Plus the two interview rows `"Starting in ~1 hour"`. No row `to=$ADMIN`.
     - `cron` again → `"sent24":0,"sent1":0`.
     - One-hour window: `M3=$(node "$H/mockdb.cjs" mentorship-fixture $N confirmed 40 | field meetingId)`; `cron` → `"sent1":1`; `notifications 2` → both `"Starting in ~1 hour"`, to the instructor and to the student.
     - Class regression: `node "$H/mockdb.cjs" scheduled-class-fixture $F 300`; `cron` → `notifications 2` includes `"Class coming up"` to the student (Executive includes live classes).
  9. **(controller)** Browser, student:
     - `$B viewport 400x800`, `$B goto "$BASE/dashboard/meetings?join=$M"` → the alert reads `This session hasn't started yet — it begins <local date, time>`. Save `"$P7/t4-session-not-started-400.png"`.
     - On the same page, Course Sessions lists M2 with Join and never M. `$B js "document.body.scrollWidth + '/' + window.innerWidth"` → `400/400`.
  10. End: `node "$H/mockdb.cjs" restore`.

- [ ] **Step 9: Commit.**

```bash
git add lib/actions/meetings.ts "app/(platform)/dashboard/meetings/page.tsx" app/api/cron/reminders/route.ts
git commit -m "feat(mentorship): sessions are private rooms with the class start rules, stay out of Course Sessions until live, and get reminders

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Assignments, instructor side — author, publish, review submissions, grade, download files

**Files:**
- Create: `lib/actions/assignments.ts`
- Create: `components/assignments/submission-files.tsx`
- Modify: `lib/hooks/queries/keys.ts` (two keys after `mentorshipQueue`)
- Create: `app/(instructor)/instructor/courses/[courseId]/assignments/page.tsx`
- Modify: `app/(instructor)/instructor/courses/[courseId]/page.tsx` (lucide import; one button under "Exam (CBT)")

**Interfaces:**
- Consumes: `Assignment`, `Submission` (Task 1); `generatePresignedDownloadUrl`, `hasPrivateResourceBucket`, `R2_RESOURCE_BUCKET` (`lib/r2.ts`); `notifyUser`; `formatDateTime`; `isoToLocalInput`/`localInputToIso`.
- Produces:
  - `type SubmissionFileView = { index: number; filename: string; sizeBytes: number }`
  - `type InstructorSubmission = { id: string; studentName: string; submittedAt: string; text: string; files: SubmissionFileView[]; status: "submitted" | "graded"; grade: number | null; feedback: string }`
  - `type InstructorAssignment = { id: string; title: string; instructions: string; dueAt: string | null; status: "draft" | "published"; submissions: InstructorSubmission[] }`
  - `type CourseAssignments = { courseTitle: string; assignments: InstructorAssignment[] }`
  - `getCourseAssignments(courseId: string): Promise<CourseAssignments | null>`
  - `saveAssignment(input: { courseId: string; assignmentId: string | null; title: string; instructions: string; dueAt: string | null; published: boolean }): Promise<{ success: true; data: { assignmentId: string } } | { success: false; error: string }>`
  - `gradeSubmission(input: { submissionId: string; grade: number; feedback: string }): Promise<{ success: true; data: { gradedAt: string } } | { success: false; error: string }>`
  - `getSubmissionFileUrl(submissionId: string, fileIndex: number): Promise<{ success: true; data: { url: string } } | { success: false; error: string }>`
  - `SubmissionFiles({ submissionId, files })`, `formatSize(bytes)` from `@/components/assignments/submission-files`
  - `queryKeys.courseAssignments(courseId)`, `queryKeys.studentAssignment(assignmentId)`

- [ ] **Step 1: The actions.** Create `lib/actions/assignments.ts`:

```ts
"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod/v4"
import connectDB from "@/lib/db"
import { Assignment, Course, Submission, User } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth/actions"
import { notifyUser } from "@/lib/notify"
import { generatePresignedDownloadUrl, hasPrivateResourceBucket, R2_RESOURCE_BUCKET } from "@/lib/r2"

/*
 * Practical assignments (spec §6, D7 v2). Instructors (course owner or admin)
 * author and grade; students whose package includes `assignments` submit text
 * and files. Files live ONLY in the private resources bucket and leave it only
 * as 5-minute signed URLs minted after an ownership or staff check.
 */

const OBJECT_ID = /^[a-f0-9]{24}$/

type Viewer = { id: string; role: string }

/** The course instructor or an admin — the authoring and grading gate. */
async function courseStaff(user: Viewer, courseId: string) {
  const course = await Course.findById(courseId).select("instructor title").lean()
  if (!course) return null
  if (course.instructor.toString() !== user.id && user.role !== "ADMIN") return null
  return course
}

function fullName(person: { firstName?: string | null; lastName?: string | null } | null | undefined, fallback: string) {
  const name = `${person?.firstName ?? ""} ${person?.lastName ?? ""}`.trim()
  return name || fallback
}

/* ═══════════════════ instructor ═══════════════════ */

export type SubmissionFileView = { index: number; filename: string; sizeBytes: number }

export type InstructorSubmission = {
  id: string
  studentName: string
  submittedAt: string
  text: string
  /** Downloads go through getSubmissionFileUrl by index — storage keys never reach this view. */
  files: SubmissionFileView[]
  status: "submitted" | "graded"
  grade: number | null
  feedback: string
}

export type InstructorAssignment = {
  id: string
  title: string
  instructions: string
  dueAt: string | null
  status: "draft" | "published"
  submissions: InstructorSubmission[]
}

export type CourseAssignments = { courseTitle: string; assignments: InstructorAssignment[] }

export async function getCourseAssignments(courseId: string): Promise<CourseAssignments | null> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user || !OBJECT_ID.test(courseId)) return null
    const course = await courseStaff(user, courseId)
    if (!course) return null

    const assignments = await Assignment.find({ course: courseId }).sort({ createdAt: 1 }).lean()
    const submissions = await Submission.find({ assignment: { $in: assignments.map((a) => a._id) } })
      .sort({ submittedAt: 1 })
      .lean()
    const students = await User.find({ _id: { $in: submissions.map((s) => s.user) } })
      .select("firstName lastName")
      .lean()
    const namesById = new Map(students.map((s) => [s._id.toString(), fullName(s, "Student")]))

    const byAssignment = new Map<string, InstructorSubmission[]>()
    for (const s of submissions) {
      const key = s.assignment.toString()
      const list = byAssignment.get(key) ?? []
      list.push({
        id: s._id.toString(),
        studentName: namesById.get(s.user.toString()) ?? "Student",
        submittedAt: s.submittedAt.toISOString(),
        text: s.text ?? "",
        files: (s.files ?? []).map((file, index) => ({
          index,
          filename: file.filename || `File ${index + 1}`,
          sizeBytes: file.sizeBytes ?? 0,
        })),
        status: s.status,
        grade: s.grade ?? null,
        feedback: s.feedback ?? "",
      })
      byAssignment.set(key, list)
    }

    return {
      courseTitle: course.title,
      assignments: assignments.map((a) => ({
        id: a._id.toString(),
        title: a.title,
        instructions: a.instructions ?? "",
        dueAt: a.dueAt ? a.dueAt.toISOString() : null,
        status: a.status,
        submissions: byAssignment.get(a._id.toString()) ?? [],
      })),
    }
  } catch (error) {
    console.error("Get course assignments error:", error)
    return null
  }
}

const AssignmentInput = z.object({
  courseId: z.string().regex(OBJECT_ID, "Course not found"),
  assignmentId: z.string().regex(OBJECT_ID, "Assignment not found").nullable(),
  title: z.string().trim().min(3, "Give the assignment a title").max(120, "Keep the title under 120 characters"),
  instructions: z
    .string()
    .trim()
    .min(10, "Tell students what to submit")
    .max(5000, "Keep instructions under 5,000 characters"),
  dueAt: z.string().nullable(),
  published: z.boolean(),
})

/** Create (assignmentId null) or edit an assignment; `published` controls student visibility. */
export async function saveAssignment(input: {
  courseId: string
  assignmentId: string | null
  title: string
  instructions: string
  dueAt: string | null
  published: boolean
}): Promise<{ success: true; data: { assignmentId: string } } | { success: false; error: string }> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "You need to be signed in" }

    const parsed = AssignmentInput.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again" }
    }
    const course = await courseStaff(user, parsed.data.courseId)
    if (!course) return { success: false, error: "Course not found" }

    let dueAt: Date | null = null
    if (parsed.data.dueAt) {
      dueAt = new Date(parsed.data.dueAt)
      if (Number.isNaN(dueAt.getTime())) return { success: false, error: "Pick a valid due date" }
    }
    const fields = {
      title: parsed.data.title,
      instructions: parsed.data.instructions,
      dueAt,
      status: parsed.data.published ? ("published" as const) : ("draft" as const),
    }

    let assignmentId: string
    if (parsed.data.assignmentId) {
      const updated = await Assignment.findOneAndUpdate(
        { _id: parsed.data.assignmentId, course: parsed.data.courseId },
        { $set: fields },
        { new: true }
      )
      if (!updated) return { success: false, error: "Assignment not found" }
      assignmentId = updated._id.toString()
    } else {
      const created = await Assignment.create({ course: parsed.data.courseId, instructor: course.instructor, ...fields })
      assignmentId = created._id.toString()
    }

    revalidatePath(`/instructor/courses/${parsed.data.courseId}/assignments`)
    revalidatePath("/dashboard/assignments")
    return { success: true, data: { assignmentId } }
  } catch (error) {
    console.error("Save assignment error:", error)
    return { success: false, error: "Couldn't save the assignment — try again" }
  }
}

const GradeInput = z.object({
  submissionId: z.string().regex(OBJECT_ID, "Submission not found"),
  grade: z
    .number("Enter a grade from 0 to 100")
    .int("Grades are whole numbers")
    .min(0, "Enter a grade from 0 to 100")
    .max(100, "Enter a grade from 0 to 100"),
  feedback: z.string().trim().max(5000, "Keep feedback under 5,000 characters"),
})

/** Grade (or re-grade) a submission; the student is told and can no longer resubmit. */
export async function gradeSubmission(input: {
  submissionId: string
  grade: number
  feedback: string
}): Promise<{ success: true; data: { gradedAt: string } } | { success: false; error: string }> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "You need to be signed in" }

    const parsed = GradeInput.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Check the grade and try again" }
    }

    const submission = await Submission.findById(parsed.data.submissionId).select("course user assignment").lean()
    if (!submission) return { success: false, error: "Submission not found" }
    const course = await courseStaff(user, submission.course.toString())
    if (!course) return { success: false, error: "Submission not found" }

    const gradedAt = new Date()
    await Submission.updateOne(
      { _id: submission._id },
      {
        $set: {
          status: "graded",
          grade: parsed.data.grade,
          feedback: parsed.data.feedback,
          gradedBy: user.id,
          gradedAt,
        },
      }
    )

    const assignment = await Assignment.findById(submission.assignment).select("title").lean()
    const assignmentId = submission.assignment.toString()
    void notifyUser(submission.user.toString(), {
      type: "course",
      title: "Assignment graded",
      body: `${assignment?.title ?? "Your assignment"} (${course.title}): ${parsed.data.grade}/100.`.slice(0, 500),
      href: `/dashboard/assignments/${assignmentId}`,
    })

    revalidatePath(`/instructor/courses/${submission.course.toString()}/assignments`)
    revalidatePath(`/dashboard/assignments/${assignmentId}`)
    return { success: true, data: { gradedAt: gradedAt.toISOString() } }
  } catch (error) {
    console.error("Grade submission error:", error)
    return { success: false, error: "Couldn't save the grade — try again" }
  }
}

const FileInput = z.object({
  submissionId: z.string().regex(OBJECT_ID, "File not found"),
  fileIndex: z.number().int().min(0, "File not found").max(9, "File not found"),
})

/**
 * A 5-minute signed download for one submission file — for the student who
 * submitted it, the course instructor, or an admin. Never a public URL.
 */
export async function getSubmissionFileUrl(
  submissionId: string,
  fileIndex: number
): Promise<{ success: true; data: { url: string } } | { success: false; error: string }> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "You need to be signed in" }

    const parsed = FileInput.safeParse({ submissionId, fileIndex })
    if (!parsed.success) return { success: false, error: "File not found" }
    if (!hasPrivateResourceBucket()) return { success: false, error: "File storage isn't available right now" }

    const submission = await Submission.findById(parsed.data.submissionId).select("user course files").lean()
    if (!submission) return { success: false, error: "File not found" }
    const isOwner = submission.user.toString() === user.id
    if (!isOwner && !(await courseStaff(user, submission.course.toString()))) {
      return { success: false, error: "File not found" }
    }
    const file = (submission.files ?? [])[parsed.data.fileIndex]
    if (!file) return { success: false, error: "File not found" }

    const url = await generatePresignedDownloadUrl(file.key, {
      expiresIn: 300,
      downloadFilename: file.filename || "submission",
      bucket: R2_RESOURCE_BUCKET,
    })
    return { success: true, data: { url } }
  } catch (error) {
    console.error("Get submission file URL error:", error)
    return { success: false, error: "Couldn't prepare the download — try again" }
  }
}
```

   (`z.number("…")` sets zod v4's invalid-type message. If the installed zod rejects a string argument there, use `z.number({ error: "Enter a grade from 0 to 100" })`.)

- [ ] **Step 2: Shared file list.** Create `components/assignments/submission-files.tsx`:

```tsx
"use client"

import * as React from "react"
import { DownloadIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getSubmissionFileUrl } from "@/lib/actions/assignments"

export function formatSize(bytes: number): string {
  if (!bytes) return ""
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * Submission files as download buttons. Each click mints a fresh 5-minute signed
 * URL (attachment disposition), so navigating to it downloads without leaving the page.
 */
export function SubmissionFiles({
  submissionId,
  files,
}: {
  submissionId: string
  files: { index: number; filename: string; sizeBytes: number }[]
}) {
  const [busy, setBusy] = React.useState<number | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  if (files.length === 0) return null

  async function download(index: number) {
    setBusy(index)
    setError(null)
    const res = await getSubmissionFileUrl(submissionId, index)
    setBusy(null)
    if (res.success) window.location.assign(res.data.url)
    else setError(res.error)
  }

  return (
    <div className="space-y-1.5">
      <ul className="flex flex-wrap gap-2">
        {files.map((file) => (
          <li key={file.index} className="min-w-0 max-w-full">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy !== null}
              onClick={() => download(file.index)}
              className="max-w-full"
            >
              <DownloadIcon size={14} aria-hidden />
              <span className="truncate">{file.filename}</span>
              {file.sizeBytes > 0 && <span className="tabular-nums text-ws-muted">{formatSize(file.sizeBytes)}</span>}
            </Button>
          </li>
        ))}
      </ul>
      {error && <p className="text-xs text-ws-danger">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 3: Keys.** In `lib/hooks/queries/keys.ts`, directly after `  mentorshipQueue: ["mentorship-queue"] as const,` add:

```ts
  courseAssignments: (courseId: string) => ["course-assignments", courseId] as const,
  studentAssignment: (assignmentId: string) => ["student-assignment", assignmentId] as const,
```

- [ ] **Step 4: The instructor page.** Create `app/(instructor)/instructor/courses/[courseId]/assignments/page.tsx`:

```tsx
"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, PlusIcon } from "lucide-react"
import { Topbar } from "@/components/platform/topbar"
import { PageHeader } from "@/components/shared/page-header"
import { SubmissionFiles } from "@/components/assignments/submission-files"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  getCourseAssignments,
  gradeSubmission,
  saveAssignment,
  type InstructorAssignment,
  type InstructorSubmission,
} from "@/lib/actions/assignments"
import { formatDateTime } from "@/lib/dashboard-home"
import { isoToLocalInput, localInputToIso } from "@/lib/datetime-local"
import { queryKeys } from "@/lib/hooks/queries/keys"
import { cn } from "@/lib/utils"

/* Practical assignments for one course (spec §6, D7 v2). "New assignment" is
   the page's one gold CTA; everything else is outline/ghost. */

function AssignmentForm({
  courseId,
  initial,
  onSaved,
  onCancel,
}: {
  courseId: string
  initial: InstructorAssignment | null
  onSaved: () => void
  onCancel: () => void
}) {
  const [title, setTitle] = React.useState(initial?.title ?? "")
  const [instructions, setInstructions] = React.useState(initial?.instructions ?? "")
  const [dueLocal, setDueLocal] = React.useState(() => isoToLocalInput(initial?.dueAt))
  const [published, setPublished] = React.useState(initial ? initial.status === "published" : true)
  const [error, setError] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()
  const idBase = initial?.id ?? "new"

  return (
    <form
      className="space-y-4 rounded-lg bg-ws-surface p-5"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        startTransition(async () => {
          const res = await saveAssignment({
            courseId,
            assignmentId: initial?.id ?? null,
            title,
            instructions,
            dueAt: dueLocal ? localInputToIso(dueLocal) : null,
            published,
          })
          if (res.success) onSaved()
          else setError(res.error)
        })
      }}
    >
      <h2 className="text-sm font-semibold text-ws-primary">{initial ? "Edit assignment" : "New assignment"}</h2>
      <div className="space-y-1.5">
        <Label htmlFor={`title-${idBase}`}>Title</Label>
        <Input id={`title-${idBase}`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`instructions-${idBase}`}>Instructions</Label>
        <Textarea
          id={`instructions-${idBase}`}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          maxLength={5000}
          className="min-h-32"
          placeholder="What to do, what to submit, how it will be assessed"
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor={`due-${idBase}`}>Due (optional)</Label>
          <Input
            id={`due-${idBase}`}
            type="datetime-local"
            value={dueLocal}
            onChange={(e) => setDueLocal(e.target.value)}
            className="w-full min-w-0"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 self-end pb-2 text-[13px] text-ws-primary">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="h-4 w-4 accent-ws-brand"
          />
          Published — students whose package includes assignments see it
        </label>
      </div>
      {error && <p className="text-xs text-ws-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Saving…" : "Save assignment"}
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function SubmissionCard({ submission, onGraded }: { submission: InstructorSubmission; onGraded: () => void }) {
  const [grade, setGrade] = React.useState(submission.grade === null ? "" : String(submission.grade))
  const [feedback, setFeedback] = React.useState(submission.feedback)
  const [error, setError] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()
  const graded = submission.status === "graded"

  return (
    <li className="space-y-3 rounded-md bg-ws-sunken p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-ws-primary">{submission.studentName}</p>
          <p className="text-[11px] tabular-nums text-ws-muted">Submitted {formatDateTime(submission.submittedAt)}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums",
            graded ? "bg-ws-success/10 text-ws-success" : "bg-ws-warning/10 text-ws-warning"
          )}
        >
          {graded ? `Graded · ${submission.grade}/100` : "Needs grading"}
        </span>
      </div>
      {submission.text && (
        <p className="whitespace-pre-wrap break-words text-[13px] text-ws-primary">{submission.text}</p>
      )}
      <SubmissionFiles submissionId={submission.id} files={submission.files} />
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          const value = Number(grade)
          if (grade.trim() === "" || !Number.isFinite(value)) {
            setError("Enter a grade from 0 to 100")
            return
          }
          startTransition(async () => {
            const res = await gradeSubmission({ submissionId: submission.id, grade: value, feedback })
            if (res.success) onGraded()
            else setError(res.error)
          })
        }}
      >
        <div className="flex items-center gap-2">
          <Label htmlFor={`grade-${submission.id}`} className="text-[12px] text-ws-muted">
            Grade
          </Label>
          <Input
            id={`grade-${submission.id}`}
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            step={1}
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className="h-9 w-20 tabular-nums"
          />
          <span className="text-[12px] text-ws-muted">/ 100</span>
        </div>
        <Textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          maxLength={5000}
          className="min-h-20"
          placeholder="Feedback for the student"
          aria-label={`Feedback for ${submission.studentName}`}
        />
        {error && <p className="text-xs text-ws-danger">{error}</p>}
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? "Saving…" : graded ? "Update grade" : "Save grade"}
        </Button>
      </form>
    </li>
  )
}

function AssignmentCard({
  courseId,
  assignment,
  onChanged,
}: {
  courseId: string
  assignment: InstructorAssignment
  onChanged: () => void
}) {
  const [editing, setEditing] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const graded = assignment.submissions.filter((s) => s.status === "graded").length

  if (editing) {
    return (
      <li>
        <AssignmentForm
          courseId={courseId}
          initial={assignment}
          onSaved={() => {
            setEditing(false)
            onChanged()
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    )
  }

  return (
    <li className="space-y-3 rounded-lg bg-ws-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="break-words font-display text-base font-semibold text-ws-primary">{assignment.title}</h2>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                assignment.status === "published" ? "bg-ws-success/10 text-ws-success" : "bg-ws-chip text-ws-muted"
              )}
            >
              {assignment.status === "published" ? "Published" : "Draft"}
            </span>
          </div>
          <p className="mt-1 text-[12px] tabular-nums text-ws-muted">
            {assignment.dueAt ? `Due ${formatDateTime(assignment.dueAt)} · ` : ""}
            {assignment.submissions.length} submitted · {graded} graded
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          Edit
        </Button>
      </div>
      <p className="line-clamp-3 whitespace-pre-wrap break-words text-[13px] text-ws-muted">{assignment.instructions}</p>
      {assignment.submissions.length > 0 && (
        <>
          <Button size="sm" variant="outline" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? "Hide submissions" : `Review submissions (${assignment.submissions.length})`}
          </Button>
          {open && (
            <ul className="space-y-2">
              {assignment.submissions.map((submission) => (
                <SubmissionCard key={submission.id} submission={submission} onGraded={onChanged} />
              ))}
            </ul>
          )}
        </>
      )}
    </li>
  )
}

export default function InstructorAssignmentsPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const queryClient = useQueryClient()
  const [creating, setCreating] = React.useState(false)
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.courseAssignments(courseId),
    queryFn: () => getCourseAssignments(courseId),
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.courseAssignments(courseId) })

  return (
    <>
      <Topbar
        title="Assignments"
        variant="instructor"
        breadcrumbOverrides={{ [courseId]: data?.courseTitle ?? "Course" }}
      />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-4xl space-y-6">
          <Link
            href={`/instructor/courses/${courseId}`}
            className="inline-flex h-10 items-center gap-1.5 text-[13px] font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary"
          >
            <ArrowLeft size={14} strokeWidth={2} aria-hidden />
            Back to course
          </Link>
          <PageHeader
            title="Assignments"
            subline={data ? `${data.courseTitle} · practical work for packages that include assignments` : undefined}
            action={
              data && !creating ? (
                <Button onClick={() => setCreating(true)}>
                  <PlusIcon size={16} aria-hidden />
                  New assignment
                </Button>
              ) : undefined
            }
          />

          {isLoading ? (
            <div className="h-40 animate-pulse rounded-lg bg-ws-surface" />
          ) : !data ? (
            <div className="rounded-lg bg-ws-surface px-6 py-8">
              <p className="text-[15px] font-semibold text-ws-primary">Course not found</p>
            </div>
          ) : (
            <>
              {creating && (
                <AssignmentForm
                  courseId={courseId}
                  initial={null}
                  onSaved={() => {
                    setCreating(false)
                    refresh()
                  }}
                  onCancel={() => setCreating(false)}
                />
              )}
              {data.assignments.length === 0 && !creating ? (
                <div className="rounded-lg bg-ws-surface px-6 py-8">
                  <p className="text-[15px] font-semibold text-ws-primary">No assignments yet</p>
                  <p className="mt-1 text-[13px] text-ws-muted">
                    Published assignments appear on the dashboard of students whose package includes assignments.
                  </p>
                </div>
              ) : (
                <ul className="space-y-4">
                  {data.assignments.map((assignment) => (
                    <AssignmentCard key={assignment.id} courseId={courseId} assignment={assignment} onChanged={refresh} />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 5: Link from the course page.** In `app/(instructor)/instructor/courses/[courseId]/page.tsx`:
  - replace `import { ArrowLeft, FileQuestion, Pencil } from "lucide-react"` with `import { ArrowLeft, ClipboardCheck, FileQuestion, Pencil } from "lucide-react"`;
  - replace

```tsx
                    <FileQuestion size={16} strokeWidth={2} />
                    Exam (CBT)
                  </Button>
```

   with

```tsx
                    <FileQuestion size={16} strokeWidth={2} />
                    Exam (CBT)
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    render={<Link href={`/instructor/courses/${course.id}/assignments`} />}
                  >
                    <ClipboardCheck size={16} strokeWidth={2} />
                    Assignments
                  </Button>
```

- [ ] **Step 6: Verify.** tsc; `npx eslint lib/actions/assignments.ts components/assignments/submission-files.tsx lib/hooks/queries/keys.ts "app/(instructor)/instructor/courses/[courseId]/assignments/page.tsx" "app/(instructor)/instructor/courses/[courseId]/page.tsx"`.

```bash
node "$H/mockdb.cjs" restore
N=$(node "$H/mockdb.cjs" fixture standard | field enrollmentId)
AP="/instructor/courses/$F/assignments"
save() { bash "$H/action.sh" "$AP" saveAssignment "[$1]" "${2:-instructor}"; }
# Signed-URL facts only — never print the URL itself.
urlcheck() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s);if(!r.success){console.log(JSON.stringify(r));return}const u=new URL(r.data.url);console.log(JSON.stringify({pathEndsWithKey:decodeURIComponent(u.pathname).endsWith(process.argv[1]),expires:u.searchParams.get("X-Amz-Expires"),namesFile:(u.searchParams.get("response-content-disposition")||"").includes(process.argv[2])}))})' "$1" "$2"; }
```

  1. Authoring:
     - `save '{"courseId":"'$F'","assignmentId":null,"title":"ab","instructions":"Write a trade plan.","dueAt":null,"published":true}'` → `Give the assignment a title`.
     - `…"title":"Trade plan","instructions":"short"…` → `Tell students what to submit`.
     - `…"dueAt":"not-a-date"…` (valid title/instructions) → `Pick a valid due date`.
     - `…"courseId":"nope"…` → `Course not found`.
     - As student: `ID=$(PRINT_ID=1 bash "$H/action.sh" "$AP" saveAssignment '[]' instructor)`; `post "$ID" "$AP" student '[{"courseId":"'$F'","assignmentId":null,"title":"Trade plan","instructions":"Write a one-page trade plan.","dueAt":null,"published":true}]'` → `Course not found`.
     - Valid: `A=$(save '{"courseId":"'$F'","assignmentId":null,"title":"Trade plan","instructions":"Write a one-page trade plan.","dueAt":"'$(iso 10080)'","published":true}' | field data.assignmentId)` → an id. Admin persona with the same body → success (admins author on any course).
     - Edit: `save '{"courseId":"'$F'","assignmentId":"'$A'","title":"Trade plan v2","instructions":"Write a one-page trade plan.","dueAt":null,"published":false}'` → the same id. `node "$H/mockdb.cjs" assignments` → `"Trade plan v2" status=draft … dueAt=null`.
  2. Listing: `A2=$(node "$H/mockdb.cjs" assignment-fixture $F published | field assignmentId)`; `SUB=$(node "$H/mockdb.cjs" submission-fixture $A2 | field submissionId)`; `KEY=$(node "$H/mockdb.cjs" assignments | grep -o 'worldstreet-academy/submissions/[^ |]*' | head -1)`.
     - `bash "$H/action.sh" "$AP" getCourseAssignments "[\"$F\"]" instructor` → the A2 entry has one submission with `"files":[{"index":0,"filename":"trade-plan.pdf","sizeBytes":1024}]` and `"status":"submitted"`.
     - The same output piped to `grep -c 'worldstreet-academy/submissions'` → `0` (no keys reach the instructor).
     - As admin → the same list. `…getCourseAssignments '["nope"]' instructor` → `null`.
  3. Grading:
     - `bash "$H/action.sh" "$AP" gradeSubmission "[{\"submissionId\":\"$SUB\",\"grade\":101,\"feedback\":\"\"}]" instructor` → `Enter a grade from 0 to 100`; `"grade":7.5` → `Grades are whole numbers`; `"submissionId":"nope"` → `Submission not found`.
     - Valid: `"grade":85,"feedback":"Clear entries; tighten your stop placement."` → `success:true` with `gradedAt`. `assignments` → SUB `status=graded grade=85 feedback="Clear entries; tighten your stop placement."`.
     - `notifications 1` → `to=$STUDENT type=course "Assignment graded" "Fixture trade plan (Forex Trading Mastery): 85/100." href=/dashboard/assignments/$A2`.
     - As student via `PRINT_ID`/`post` → `Submission not found`.
  4. Downloads (never fetched):
     - `bash "$H/action.sh" "$AP" getSubmissionFileUrl "[\"$SUB\",0]" instructor | urlcheck "$KEY" trade-plan.pdf` → `{"pathEndsWithKey":true,"expires":"300","namesFile":true}`. If the controller's step-2 check printed `0`, expect `File storage isn't available right now` instead and say so.
     - `…"[\"$SUB\",5]"` → `File not found`. As admin → the same booleans.
     - As student: `ID=$(PRINT_ID=1 bash "$H/action.sh" "$AP" getSubmissionFileUrl '[]' instructor)`; `post "$ID" "$AP" student "[\"$SUB\",0]" | urlcheck "$KEY" trade-plan.pdf` → the same booleans (the owner may download).
  5. **(controller)** Browser, instructor persona:
     - `$B viewport 400x800`, `/instructor/courses/$F`: the sidebar card shows "Assignments" under "Exam (CBT)" → it opens the page.
     - The page lists "Trade plan v2" (Draft) and "Fixture trade plan" (Published, `1 submitted · 1 graded`). "Review submissions (1)" → a card with "Graded · 85/100", the text, a `trade-plan.pdf` button (do **not** click it — it would fetch from live R2), grade 85 and feedback prefilled.
     - "New assignment" (gold, the only gold) → the form → save with a title and instructions → a new Published card.
     - `$B js "document.body.scrollWidth + '/' + window.innerWidth"` → `400/400`. Save `"$P7/t5-assignments-400.png"`.
  6. End: `node "$H/mockdb.cjs" restore`.

- [ ] **Step 7: Commit.**

```bash
git add lib/actions/assignments.ts components/assignments/submission-files.tsx lib/hooks/queries/keys.ts "app/(instructor)/instructor/courses/[courseId]/assignments/page.tsx" "app/(instructor)/instructor/courses/[courseId]/page.tsx"
git commit -m "feat(assignments): instructors author and publish assignments, review submissions, grade them and download files through signed URLs

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Assignments, student side — the tile, `/dashboard/assignments`, submitting text and files to the private bucket

**Files:**
- Modify: `lib/actions/assignments.ts` (the `@/lib/r2` import; append a STUDENT section)
- Modify: `lib/actions/exams.ts` (models import; the `MyAssessment` + order block; `getMyAssessments` whole function)
- Modify: `components/dashboard/assignments-tile.tsx` (whole file)
- Create: `app/(platform)/dashboard/assignments/page.tsx`
- Create: `app/(platform)/dashboard/assignments/[assignmentId]/page.tsx`

**Interfaces:**
- Consumes:
  - `getCourseAccess`; `generatePresignedUploadUrl`, `generateSubmissionKey`, `submissionKeyPrefix`, `hasPrivateResourceBucket`, `R2_RESOURCE_BUCKET`;
  - `SubmissionFileView`, `getSubmissionFileUrl`, `SubmissionFiles`, `formatSize` (Task 5);
  - `queryKeys.studentAssignment`, `queryKeys.assessments`; `useMyAssessments`; `DashboardTile`.
- Produces:
  - `type StudentSubmissionFile = SubmissionFileView & { key: string; mimeType: string }`
  - `type StudentAssignment = { id; courseId; courseTitle; title; instructions; dueAt: string | null; submission: { id; text; files: StudentSubmissionFile[]; submittedAt; status: "submitted" | "graded"; grade: number | null; feedback } | null }`
  - `getAssignmentForStudent(assignmentId: string): Promise<{ success: true; data: StudentAssignment } | { success: false; error: string }>`
  - `getSubmissionUploadUrl(assignmentId: string, filename: string, contentType: string, sizeBytes: number): Promise<{ success: true; data: { uploadUrl: string; storageKey: string } } | { success: false; error: string }>`
  - `submitAssignment(input: { assignmentId: string; text: string; files: { key: string; filename: string; mimeType: string; sizeBytes: number }[] }): Promise<{ success: true; data: { submittedAt: string } } | { success: false; error: string }>`
  - `MyAssessment` becomes `{ id; courseId; courseTitle; title; scope: "final" | "lesson" | "assignment"; lessonId; status: "not_started" | "in_progress" | "passed" | "failed" | "locked" | "submitted" | "graded"; dueAt: string | null; href }` (`examId` → `id`).
  - Exports from `components/dashboard/assignments-tile.tsx`: `ASSESSMENT_STATUS`, `assessmentKindLabel(a)`, `AssignmentsTile()`.

- [ ] **Step 1: Imports.** In `lib/actions/assignments.ts`, replace `import { generatePresignedDownloadUrl, hasPrivateResourceBucket, R2_RESOURCE_BUCKET } from "@/lib/r2"` with:

```ts
import { getCourseAccess } from "@/lib/course-access"
import {
  generatePresignedDownloadUrl,
  generatePresignedUploadUrl,
  generateSubmissionKey,
  hasPrivateResourceBucket,
  R2_RESOURCE_BUCKET,
  submissionKeyPrefix,
} from "@/lib/r2"
```

- [ ] **Step 2: Student actions.** Append at the end of `lib/actions/assignments.ts`:

```ts

/* ═══════════════════ student ═══════════════════ */

const MAX_SUBMISSION_BYTES = 25 * 1024 * 1024
const MAX_SUBMISSION_FILES = 3
const SUBMISSION_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/csv",
  "text/plain",
  "application/zip",
  "image/png",
  "image/jpeg",
])
const MIME_ERROR = "Upload a PDF, Word, Excel, PowerPoint, CSV, text, PNG, JPEG or zip file"

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000
}

export type StudentSubmissionFile = SubmissionFileView & { key: string; mimeType: string }

export type StudentAssignment = {
  id: string
  courseId: string
  courseTitle: string
  title: string
  instructions: string
  dueAt: string | null
  submission: {
    id: string
    text: string
    /** The student's own files — keys included so a resubmission can keep them (submitAssignment re-checks the prefix). */
    files: StudentSubmissionFile[]
    submittedAt: string
    status: "submitted" | "graded"
    grade: number | null
    feedback: string
  } | null
}

/** A published assignment on a course where the student's access-granting package includes assignments. */
async function studentAssignmentGate(userId: string, assignmentId: string) {
  const assignment = await Assignment.findOne({ _id: assignmentId, status: "published" }).lean()
  if (!assignment) return { ok: false as const, error: "Assignment not found" }
  const access = await getCourseAccess(userId, assignment.course.toString())
  if (!access) return { ok: false as const, error: "Assignment not found" }
  if (!access.entitlements.assignments) return { ok: false as const, error: "Assignments aren't included in your package" }
  return { ok: true as const, assignment, access }
}

export async function getAssignmentForStudent(
  assignmentId: string
): Promise<{ success: true; data: StudentAssignment } | { success: false; error: string }> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "You need to be signed in" }
    if (!OBJECT_ID.test(assignmentId)) return { success: false, error: "Assignment not found" }

    const gate = await studentAssignmentGate(user.id, assignmentId)
    if (!gate.ok) return { success: false, error: gate.error }

    const [course, submission] = await Promise.all([
      Course.findById(gate.assignment.course).select("title").lean(),
      Submission.findOne({ assignment: gate.assignment._id, user: user.id }).lean(),
    ])

    return {
      success: true,
      data: {
        id: gate.assignment._id.toString(),
        courseId: gate.assignment.course.toString(),
        courseTitle: course?.title ?? "",
        title: gate.assignment.title,
        instructions: gate.assignment.instructions ?? "",
        dueAt: gate.assignment.dueAt ? gate.assignment.dueAt.toISOString() : null,
        submission: submission
          ? {
              id: submission._id.toString(),
              text: submission.text ?? "",
              files: (submission.files ?? []).map((file, index) => ({
                index,
                key: file.key,
                filename: file.filename || `File ${index + 1}`,
                mimeType: file.mimeType ?? "",
                sizeBytes: file.sizeBytes ?? 0,
              })),
              submittedAt: submission.submittedAt.toISOString(),
              status: submission.status,
              grade: submission.grade ?? null,
              feedback: submission.feedback ?? "",
            }
          : null,
      },
    }
  } catch (error) {
    console.error("Get assignment for student error:", error)
    return { success: false, error: "Couldn't load the assignment — try again" }
  }
}

const UploadInput = z.object({
  assignmentId: z.string().regex(OBJECT_ID, "Assignment not found"),
  filename: z.string().trim().min(1, "Choose a file").max(200, "Rename the file to under 200 characters"),
  contentType: z.string().max(200),
  sizeBytes: z.number().int().min(1, "Choose a file").max(MAX_SUBMISSION_BYTES, "Files can be up to 25 MB"),
})

/**
 * A presigned PUT into the PRIVATE resources bucket, inside this student's
 * folder for this assignment. The file goes straight from the browser to R2;
 * refused outright when the private bucket isn't configured.
 */
export async function getSubmissionUploadUrl(
  assignmentId: string,
  filename: string,
  contentType: string,
  sizeBytes: number
): Promise<{ success: true; data: { uploadUrl: string; storageKey: string } } | { success: false; error: string }> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "You need to be signed in" }

    const parsed = UploadInput.safeParse({ assignmentId, filename, contentType, sizeBytes })
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Choose a file" }
    }

    const gate = await studentAssignmentGate(user.id, parsed.data.assignmentId)
    if (!gate.ok) return { success: false, error: gate.error }
    const existing = await Submission.findOne({ assignment: gate.assignment._id, user: user.id }).select("status").lean()
    if (existing?.status === "graded") return { success: false, error: "This assignment has already been graded" }
    if (!SUBMISSION_MIME.has(parsed.data.contentType)) return { success: false, error: MIME_ERROR }
    if (!hasPrivateResourceBucket()) return { success: false, error: "File uploads aren't available right now" }

    const storageKey = generateSubmissionKey(parsed.data.assignmentId, user.id, parsed.data.filename)
    const { uploadUrl } = await generatePresignedUploadUrl(storageKey, parsed.data.contentType, 900, R2_RESOURCE_BUCKET)
    return { success: true, data: { uploadUrl, storageKey } }
  } catch (error) {
    console.error("Submission upload URL error:", error)
    return { success: false, error: "Couldn't prepare the upload — try again" }
  }
}

const SubmitInput = z
  .object({
    assignmentId: z.string().regex(OBJECT_ID, "Assignment not found"),
    text: z.string().trim().max(10000, "Keep your answer under 10,000 characters"),
    files: z
      .array(
        z.object({
          key: z.string().min(1, "Upload your files again").max(300, "Upload your files again"),
          filename: z.string().trim().min(1, "Upload your files again").max(200, "Upload your files again"),
          mimeType: z.string().max(200),
          sizeBytes: z.number().int().min(0).max(MAX_SUBMISSION_BYTES, "Files can be up to 25 MB"),
        })
      )
      .max(MAX_SUBMISSION_FILES, "Attach up to three files"),
  })
  .refine((value) => value.text.length > 0 || value.files.length > 0, {
    message: "Write an answer or attach a file",
  })

/**
 * Submit or resubmit (until graded). Files must already be uploaded through
 * getSubmissionUploadUrl — only keys inside this student's own folder are accepted.
 */
export async function submitAssignment(input: {
  assignmentId: string
  text: string
  files: { key: string; filename: string; mimeType: string; sizeBytes: number }[]
}): Promise<{ success: true; data: { submittedAt: string } } | { success: false; error: string }> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "You need to be signed in" }

    const parsed = SubmitInput.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Check your submission and try again" }
    }

    const gate = await studentAssignmentGate(user.id, parsed.data.assignmentId)
    if (!gate.ok) return { success: false, error: gate.error }

    const prefix = submissionKeyPrefix(parsed.data.assignmentId, user.id)
    const files = parsed.data.files
    if (files.some((file) => !file.key.startsWith(prefix) || file.key.includes(".."))) {
      return { success: false, error: "Upload your files again" }
    }
    if (files.some((file) => !SUBMISSION_MIME.has(file.mimeType))) return { success: false, error: MIME_ERROR }
    if (files.length > 0 && !hasPrivateResourceBucket()) {
      return { success: false, error: "File uploads aren't available right now" }
    }

    const existing = await Submission.findOne({ assignment: gate.assignment._id, user: user.id }).select("status").lean()
    if (existing?.status === "graded") return { success: false, error: "This assignment has already been graded" }

    const submittedAt = new Date()
    try {
      // One row per student per assignment. A graded row can't match the filter,
      // so a race with grading hits the unique index instead of overwriting a grade.
      await Submission.findOneAndUpdate(
        { assignment: gate.assignment._id, user: user.id, status: { $ne: "graded" } },
        {
          $set: { text: parsed.data.text, files, status: "submitted", submittedAt },
          $setOnInsert: { course: gate.assignment.course, enrollment: gate.access.enrollmentId },
        },
        { upsert: true, new: true, runValidators: true }
      )
    } catch (error) {
      if (isDuplicateKey(error)) return { success: false, error: "This assignment has already been graded" }
      throw error
    }

    void notifyUser(gate.access.course.instructorId, {
      type: "course",
      title: "New assignment submission",
      body: `${fullName(user, "A student")} submitted ${gate.assignment.title}.`.slice(0, 500),
      href: `/instructor/courses/${gate.assignment.course.toString()}/assignments`,
    })

    revalidatePath(`/dashboard/assignments/${parsed.data.assignmentId}`)
    revalidatePath(`/instructor/courses/${gate.assignment.course.toString()}/assignments`)
    return { success: true, data: { submittedAt: submittedAt.toISOString() } }
  } catch (error) {
    console.error("Submit assignment error:", error)
    return { success: false, error: "Couldn't submit — try again" }
  }
}
```

- [ ] **Step 3: Assignments in `getMyAssessments`.** In `lib/actions/exams.ts`:
  1. In the models import, replace

```ts
  Lesson,
  type IExamSettings,
```

   with

```ts
  Lesson,
  Assignment,
  Submission,
  type IExamSettings,
```

  2. Replace

```ts
export type MyAssessment = {
  courseId: string
  courseTitle: string
  examId: string
  title: string
  scope: "final" | "lesson"
  lessonId: string | null
  status: "not_started" | "in_progress" | "passed" | "failed" | "locked"
  href: string
}

const ASSESSMENT_STATUS_ORDER: Record<MyAssessment["status"], number> = {
  in_progress: 0,
  not_started: 1,
  failed: 2,
  locked: 3,
  passed: 4,
}
```

   with

```ts
export type MyAssessment = {
  /** Exam id — or assignment id when scope is "assignment". */
  id: string
  courseId: string
  courseTitle: string
  title: string
  scope: "final" | "lesson" | "assignment"
  lessonId: string | null
  status: "not_started" | "in_progress" | "passed" | "failed" | "locked" | "submitted" | "graded"
  /** Assignments only: due date (ISO) when set. */
  dueAt: string | null
  href: string
}

const ASSESSMENT_STATUS_ORDER: Record<MyAssessment["status"], number> = {
  in_progress: 0,
  not_started: 1,
  failed: 2,
  locked: 3,
  submitted: 4,
  passed: 5,
  graded: 6,
}

/** Within a course: knowledge checks, then the final exam, then assignments. */
const ASSESSMENT_SCOPE_ORDER: Record<MyAssessment["scope"], number> = { lesson: 0, final: 1, assignment: 2 }
```

  3. Replace the whole of `getMyAssessments`: from its doc comment (the `/**` line followed by ` * Every published assessment the student can take across their active /`) through the function's closing `}` (the one after `console.error("Get my assessments error:", error)` / `return []` / `}`), with:

```ts
/**
 * Everything the student can take or submit across their active / completed
 * enrollments — the dashboard's Assignments tile and /dashboard/assignments.
 *
 * Exams (D7 lite): knowledge checks follow their lesson's tier and the final
 * exam follows `certificate` (the rules behind examPackageLock); a final also
 * needs 100% progress to start, exactly like `startExamAttempt` — short of that
 * it's `locked`, never a false `not_started`. Exams are NOT gated on the
 * `assignments` entitlement.
 *
 * Practical assignments (Phase 7): published ones on programs whose package
 * includes `assignments`, with the student's submission state. Bulk queries
 * only, whatever the number of courses.
 */
export async function getMyAssessments(): Promise<MyAssessment[]> {
  try {
    const user = await initAction()
    if (!user) return []

    const enrollments = await Enrollment.find({ user: user.id, status: { $in: ["active", "completed"] } })
      .select("course packageKey examPassed progress")
      .lean()
    if (enrollments.length === 0) return []
    const courseIds = enrollments.map((e) => e.course)

    const [courses, exams] = await Promise.all([
      Course.find({ _id: { $in: courseIds } }).select("title packages").lean(),
      Exam.find({ course: { $in: courseIds }, status: "published" }).select("course scope lesson title").lean(),
    ])
    const coursesById = new Map(courses.map((c) => [c._id.toString(), c]))
    const enrollmentsByCourse = new Map(enrollments.map((e) => [e.course.toString(), e]))
    // Assignments are a package service: only programs whose package includes them.
    const assignmentCourseIds = enrollments.flatMap((e) => {
      const course = coursesById.get(e.course.toString())
      return course && entitlementsFor(course, e).assignments ? [e.course] : []
    })

    const quizLessonIds = exams.flatMap((exam) => (exam.scope === "lesson" && exam.lesson ? [exam.lesson] : []))
    const [lessons, attempts, assignments] = await Promise.all([
      Lesson.find({ _id: { $in: quizLessonIds } }).select("course minPackageKey isFree").lean(),
      ExamAttempt.find({ user: user.id, exam: { $in: exams.map((exam) => exam._id) } })
        .select("exam status submittedAt createdAt")
        .lean(),
      Assignment.find({ course: { $in: assignmentCourseIds }, status: "published" })
        .select("course title dueAt")
        .lean(),
    ])
    const submissions = await Submission.find({ user: user.id, assignment: { $in: assignments.map((a) => a._id) } })
      .select("assignment status")
      .lean()

    const lessonsById = new Map(lessons.map((l) => [l._id.toString(), l]))
    // Grouped per exam; latestFinishedAttempt() below picks the authoritative one.
    const attemptsByExam = new Map<string, AssessmentAttempt[]>()
    for (const attempt of attempts) {
      const key = attempt.exam.toString()
      const list = attemptsByExam.get(key) ?? []
      list.push(attempt)
      attemptsByExam.set(key, list)
    }

    const rows: MyAssessment[] = []
    for (const exam of exams) {
      const courseId = exam.course.toString()
      const course = coursesById.get(courseId)
      const enrollment = enrollmentsByCourse.get(courseId)
      if (!course || !enrollment) continue

      // Legacy exams without a scope are finals (the schema default).
      const isQuiz = exam.scope === "lesson"
      let lessonId: string | null = null
      if (isQuiz) {
        const lesson = exam.lesson ? lessonsById.get(exam.lesson.toString()) : undefined
        if (!lesson || lesson.course.toString() !== courseId || !canAccessLesson(course, lesson, enrollment)) continue
        lessonId = lesson._id.toString()
      } else if (!entitlementsFor(course, enrollment).certificate) {
        continue
      }

      const history = attemptsByExam.get(exam._id.toString()) ?? []
      const inProgress = history.some((a) => a.status === "in_progress")
      const finished = latestFinishedAttempt(history)

      const status: MyAssessment["status"] = isQuiz
        ? inProgress
          ? "in_progress"
          : finished
            ? finished.status === "passed"
              ? "passed"
              : "failed"
            : "not_started"
        : enrollment.examPassed
          ? "passed"
          : inProgress
            ? "in_progress"
            : (enrollment.progress ?? 0) < 100
              ? "locked"
              : finished && finished.status !== "passed"
                ? "failed"
                : "not_started"

      rows.push({
        id: exam._id.toString(),
        courseId,
        courseTitle: course.title,
        title: exam.title,
        scope: isQuiz ? "lesson" : "final",
        lessonId,
        status,
        dueAt: null,
        href: isQuiz ? `/dashboard/courses/${courseId}/learn/${lessonId}` : `/dashboard/courses/${courseId}/exam`,
      })
    }

    const submissionStatus = new Map(submissions.map((s) => [s.assignment.toString(), s.status]))
    for (const assignment of assignments) {
      const courseId = assignment.course.toString()
      const id = assignment._id.toString()
      rows.push({
        id,
        courseId,
        courseTitle: coursesById.get(courseId)?.title ?? "",
        title: assignment.title,
        scope: "assignment",
        lessonId: null,
        status: submissionStatus.get(id) ?? "not_started",
        dueAt: assignment.dueAt ? assignment.dueAt.toISOString() : null,
        href: `/dashboard/assignments/${id}`,
      })
    }

    return rows.sort(
      (a, b) =>
        ASSESSMENT_STATUS_ORDER[a.status] - ASSESSMENT_STATUS_ORDER[b.status] ||
        a.courseTitle.localeCompare(b.courseTitle) ||
        ASSESSMENT_SCOPE_ORDER[a.scope] - ASSESSMENT_SCOPE_ORDER[b.scope] ||
        a.title.localeCompare(b.title)
    )
  } catch (error) {
    console.error("Get my assessments error:", error)
    return []
  }
}
```

   The exam-status logic is Phase 4's, unchanged. Only the early `if (exams.length === 0) return []` went away, so assignment-only students still get rows. Empty `$in` arrays simply match nothing.

- [ ] **Step 4: The tile.** Replace the whole of `components/dashboard/assignments-tile.tsx` with:

```tsx
"use client"

import Link from "next/link"
import { ClipboardCheckIcon } from "lucide-react"
import { DashboardTile } from "@/components/dashboard/home-tiles"
import type { MyAssessment } from "@/lib/actions/exams"
import { formatDateTime } from "@/lib/dashboard-home"
import { useMyAssessments } from "@/lib/hooks/queries"
import { cn } from "@/lib/utils"

export const ASSESSMENT_STATUS: Record<MyAssessment["status"], { label: string; className: string }> = {
  not_started: { label: "Not started", className: "bg-ws-chip text-ws-muted" },
  in_progress: { label: "In progress", className: "bg-ws-warning/10 text-ws-warning" },
  passed: { label: "Passed", className: "bg-ws-success/10 text-ws-success" },
  failed: { label: "Failed", className: "bg-ws-danger/10 text-ws-danger" },
  locked: { label: "Finish lessons first", className: "bg-ws-chip text-ws-muted" },
  submitted: { label: "Submitted", className: "bg-ws-chip text-ws-primary" },
  graded: { label: "Graded", className: "bg-ws-success/10 text-ws-success" },
}

/** "Final exam" · "Knowledge check" · "Assignment" (with its due date). */
export function assessmentKindLabel(assessment: MyAssessment): string {
  if (assessment.scope === "final") return "Final exam"
  if (assessment.scope === "lesson") return "Knowledge check"
  return assessment.dueAt ? `Assignment · due ${formatDateTime(assessment.dueAt)}` : "Assignment"
}

/** Nothing left for the student to do on these (a submitted assignment awaits the instructor). */
const DONE: ReadonlySet<MyAssessment["status"]> = new Set(["passed", "submitted", "graded"])

/**
 * Spec §12 Assignments: the knowledge checks and final exams the student's
 * packages include (D7 lite) and practical assignments (Phase 7), with state.
 * Hidden while loading and when there is nothing — an empty tile would imply work exists.
 */
export function AssignmentsTile() {
  const { data: assessments = [] } = useMyAssessments()
  if (assessments.length === 0) return null

  const done = assessments.filter((a) => DONE.has(a.status)).length

  return (
    <DashboardTile
      icon={ClipboardCheckIcon}
      title="Assignments"
      action={assessments.length > 4 ? { label: "View all", href: "/dashboard/assignments" } : undefined}
    >
      <p className="mb-3 text-[13px] text-ws-muted">
        <span className="font-semibold tabular-nums text-ws-primary">{assessments.length - done}</span> to do ·{" "}
        <span className="tabular-nums">{done}</span> done
      </p>
      <ul className="space-y-3">
        {assessments.slice(0, 4).map((a) => (
          <li key={`${a.scope}-${a.id}`}>
            <Link href={a.href} className="flex items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ws-primary">{a.title}</span>
                <span className="block truncate text-[11px] text-ws-muted">
                  {assessmentKindLabel(a)} · {a.courseTitle}
                </span>
              </span>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", ASSESSMENT_STATUS[a.status].className)}>
                {ASSESSMENT_STATUS[a.status].label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </DashboardTile>
  )
}
```

- [ ] **Step 5: The index page.** Create `app/(platform)/dashboard/assignments/page.tsx`:

```tsx
"use client"

import Link from "next/link"
import { ChevronRightIcon } from "lucide-react"
import { Topbar } from "@/components/platform/topbar"
import { PageHeader } from "@/components/shared/page-header"
import { ASSESSMENT_STATUS, assessmentKindLabel } from "@/components/dashboard/assignments-tile"
import { useMyAssessments } from "@/lib/hooks/queries"
import { cn } from "@/lib/utils"

/** Every row behind the dashboard's Assignments tile. */
export default function AssignmentsPage() {
  const { data: assessments = [], isLoading } = useMyAssessments()

  return (
    <>
      <Topbar title="Assignments" />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-4xl space-y-6">
          <PageHeader
            title="Assignments"
            subline="Knowledge checks, final exams and practical assignments your packages include."
          />
          {isLoading ? (
            <div className="h-40 animate-pulse rounded-lg bg-ws-surface" />
          ) : assessments.length === 0 ? (
            <div className="rounded-lg bg-ws-surface px-6 py-8">
              <p className="text-[15px] font-semibold text-ws-primary">Nothing to take or submit right now</p>
              <p className="mt-1 text-[13px] text-ws-muted">
                Assessments and assignments from your programs appear here.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {assessments.map((a) => (
                <li key={`${a.scope}-${a.id}`}>
                  <Link
                    href={a.href}
                    className="flex items-center gap-3 rounded-md bg-ws-surface p-4 transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-ws-primary">{a.title}</span>
                      <span className="block truncate text-[12px] text-ws-muted">
                        {assessmentKindLabel(a)} · {a.courseTitle}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        ASSESSMENT_STATUS[a.status].className
                      )}
                    >
                      {ASSESSMENT_STATUS[a.status].label}
                    </span>
                    <ChevronRightIcon size={14} className="shrink-0 text-ws-subtle" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 6: The detail page.** Create `app/(platform)/dashboard/assignments/[assignmentId]/page.tsx`:

```tsx
"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, PaperclipIcon, XIcon } from "lucide-react"
import { Topbar } from "@/components/platform/topbar"
import { SubmissionFiles, formatSize } from "@/components/assignments/submission-files"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  getAssignmentForStudent,
  getSubmissionUploadUrl,
  submitAssignment,
  type StudentAssignment,
  type StudentSubmissionFile,
} from "@/lib/actions/assignments"
import { formatDateTime } from "@/lib/dashboard-home"
import { queryKeys } from "@/lib/hooks/queries/keys"

/* One practical assignment: instructions, submit/resubmit until graded, then the
   grade and feedback. "Submit assignment" is the page's one gold CTA. */

const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.zip,.png,.jpg,.jpeg"
const MAX_FILES = 3
const MAX_BYTES = 25 * 1024 * 1024

type UploadedFile = { key: string; filename: string; mimeType: string; sizeBytes: number }

function SubmissionForm({ assignment, onSubmitted }: { assignment: StudentAssignment; onSubmitted: () => void }) {
  const existing = assignment.submission
  const [text, setText] = React.useState(existing?.text ?? "")
  const [kept, setKept] = React.useState<StudentSubmissionFile[]>(existing?.files ?? [])
  const [added, setAdded] = React.useState<File[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [progress, setProgress] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()
  const fileRef = React.useRef<HTMLInputElement>(null)
  const room = MAX_FILES - kept.length - added.length

  function addFiles(list: FileList | null) {
    if (!list) return
    setError(null)
    const next = [...added]
    for (const file of Array.from(list)) {
      if (kept.length + next.length >= MAX_FILES) {
        setError("Attach up to three files")
        break
      }
      if (file.size > MAX_BYTES) {
        setError(`${file.name} is over 25 MB`)
        continue
      }
      next.push(file)
    }
    setAdded(next)
    if (fileRef.current) fileRef.current.value = ""
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        startTransition(async () => {
          // Straight to the private bucket; the submission is written only after every upload succeeded.
          const uploaded: UploadedFile[] = []
          for (const file of added) {
            setProgress(`Uploading ${file.name}…`)
            const presign = await getSubmissionUploadUrl(assignment.id, file.name, file.type, file.size)
            if (!presign.success) {
              setProgress(null)
              setError(presign.error)
              return
            }
            const put = await fetch(presign.data.uploadUrl, {
              method: "PUT",
              body: file,
              headers: { "Content-Type": file.type },
            })
            if (!put.ok) {
              setProgress(null)
              setError(`Couldn't upload ${file.name} — try again`)
              return
            }
            uploaded.push({ key: presign.data.storageKey, filename: file.name, mimeType: file.type, sizeBytes: file.size })
          }
          setProgress("Submitting…")
          const res = await submitAssignment({
            assignmentId: assignment.id,
            text,
            files: [
              ...kept.map(({ key, filename, mimeType, sizeBytes }) => ({ key, filename, mimeType, sizeBytes })),
              ...uploaded,
            ],
          })
          setProgress(null)
          if (res.success) {
            setAdded([])
            onSubmitted()
          } else {
            setError(res.error)
          }
        })
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="submission-text">Your answer</Label>
        <Textarea
          id="submission-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={10000}
          className="min-h-40"
          placeholder="Write your answer, or attach your work below"
        />
      </div>

      <div className="space-y-2">
        {(kept.length > 0 || added.length > 0) && (
          <ul className="space-y-1.5">
            {kept.map((file) => (
              <li key={file.key} className="flex items-center gap-2 rounded-sm bg-ws-sunken px-3 py-2 text-[13px]">
                <PaperclipIcon size={13} className="shrink-0 text-ws-muted" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-ws-primary">{file.filename}</span>
                <span className="shrink-0 tabular-nums text-[11px] text-ws-muted">{formatSize(file.sizeBytes)}</span>
                <button
                  type="button"
                  aria-label={`Remove ${file.filename}`}
                  onClick={() => setKept((prev) => prev.filter((f) => f.key !== file.key))}
                  className="shrink-0 text-ws-muted transition-colors hover:text-ws-primary"
                >
                  <XIcon size={14} aria-hidden />
                </button>
              </li>
            ))}
            {added.map((file, i) => (
              <li key={`${file.name}-${i}`} className="flex items-center gap-2 rounded-sm bg-ws-sunken px-3 py-2 text-[13px]">
                <PaperclipIcon size={13} className="shrink-0 text-ws-muted" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-ws-primary">{file.name}</span>
                <span className="shrink-0 tabular-nums text-[11px] text-ws-muted">{formatSize(file.size)}</span>
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => setAdded((prev) => prev.filter((_, j) => j !== i))}
                  className="shrink-0 text-ws-muted transition-colors hover:text-ws-primary"
                >
                  <XIcon size={14} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          aria-label="Attach files"
          onChange={(e) => addFiles(e.target.files)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={room <= 0 || pending}
            onClick={() => fileRef.current?.click()}
          >
            <PaperclipIcon size={14} aria-hidden />
            Attach files
          </Button>
          <p className="text-[11px] text-ws-muted">
            Up to 3 files, 25 MB each. Only you, your instructor and admins can open them.
          </p>
        </div>
      </div>

      {progress && <p className="text-[12px] text-ws-muted">{progress}</p>}
      {error && <p className="text-xs text-ws-danger">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Submitting…" : existing ? "Resubmit" : "Submit assignment"}
      </Button>
    </form>
  )
}

export default function AssignmentPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>()
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.studentAssignment(assignmentId),
    queryFn: () => getAssignmentForStudent(assignmentId),
  })
  const assignment = data?.success ? data.data : null
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.studentAssignment(assignmentId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.assessments })
  }

  return (
    <>
      <Topbar title="Assignment" breadcrumbOverrides={{ [assignmentId]: assignment?.title ?? "Assignment" }} />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-3xl space-y-6">
          <Link
            href="/dashboard/assignments"
            className="inline-flex h-10 items-center gap-1.5 text-[13px] font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary"
          >
            <ArrowLeft size={14} strokeWidth={2} aria-hidden />
            All assignments
          </Link>

          {isLoading ? (
            <div className="h-48 animate-pulse rounded-lg bg-ws-surface" />
          ) : !assignment ? (
            <div className="rounded-lg bg-ws-surface px-6 py-8">
              <p className="text-[15px] font-semibold text-ws-primary">
                {data && !data.success ? data.error : "Assignment not found"}
              </p>
            </div>
          ) : (
            <>
              <header className="min-w-0 space-y-1">
                <p className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-ws-muted">
                  {assignment.courseTitle}
                </p>
                <h1 className="break-words font-display text-[28px] font-semibold tracking-[-0.02em] text-ws-primary">
                  {assignment.title}
                </h1>
                {assignment.dueAt && (
                  <p className="text-[13px] tabular-nums text-ws-muted">Due {formatDateTime(assignment.dueAt)}</p>
                )}
              </header>

              <section className="rounded-lg bg-ws-surface p-5">
                <h2 className="text-sm font-semibold text-ws-primary">Instructions</h2>
                <p className="mt-2 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-ws-primary">
                  {assignment.instructions}
                </p>
              </section>

              {assignment.submission?.status === "graded" ? (
                <section className="space-y-4 rounded-lg bg-ws-surface p-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="text-sm font-semibold text-ws-primary">Your grade</h2>
                    <p className="font-display text-3xl font-light tabular-nums text-ws-primary">
                      {assignment.submission.grade}
                      <span className="ml-1 font-sans text-[13px] font-normal text-ws-muted">/ 100</span>
                    </p>
                  </div>
                  {assignment.submission.feedback && (
                    <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-ws-primary">
                      {assignment.submission.feedback}
                    </p>
                  )}
                  <div className="space-y-2 rounded-md bg-ws-sunken p-4">
                    <p className="text-[11px] tabular-nums text-ws-muted">
                      Submitted {formatDateTime(assignment.submission.submittedAt)}
                    </p>
                    {assignment.submission.text && (
                      <p className="whitespace-pre-wrap break-words text-[13px] text-ws-primary">
                        {assignment.submission.text}
                      </p>
                    )}
                    <SubmissionFiles submissionId={assignment.submission.id} files={assignment.submission.files} />
                  </div>
                </section>
              ) : (
                <section className="space-y-4 rounded-lg bg-ws-surface p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-sm font-semibold text-ws-primary">
                      {assignment.submission ? "Your submission" : "Submit your work"}
                    </h2>
                    {assignment.submission && (
                      <p className="text-[11px] tabular-nums text-ws-muted">
                        Submitted {formatDateTime(assignment.submission.submittedAt)} · you can resubmit until it&apos;s graded
                      </p>
                    )}
                  </div>
                  {assignment.submission && assignment.submission.files.length > 0 && (
                    <SubmissionFiles submissionId={assignment.submission.id} files={assignment.submission.files} />
                  )}
                  <SubmissionForm
                    key={assignment.submission?.submittedAt ?? "new"}
                    assignment={assignment}
                    onSubmitted={refresh}
                  />
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 7: Verify.** tsc; `npx eslint lib/actions/assignments.ts lib/actions/exams.ts components/dashboard/assignments-tile.tsx "app/(platform)/dashboard/assignments/page.tsx" "app/(platform)/dashboard/assignments/[assignmentId]/page.tsx"`.

```bash
node "$H/mockdb.cjs" restore
N=$(node "$H/mockdb.cjs" fixture standard | field enrollmentId)
A=$(node "$H/mockdb.cjs" assignment-fixture $F published 10080 | field assignmentId)
D=$(node "$H/mockdb.cjs" assignment-fixture $F draft | field assignmentId)
DP="/dashboard/assignments/$A"
rows() { bash "$H/action.sh" /dashboard getMyAssessments '[]' | node -e 'for (const a of JSON.parse(require("fs").readFileSync(0,"utf8"))) console.log([a.title,a.scope,a.status,a.id,a.href,a.dueAt?"due":"-"].join(" | "))'; }
student() { bash "$H/action.sh" "$DP" "$1" "$2" "${3:-student}"; }
# Upload-URL facts only — never print the URL, never PUT.
uploadcheck() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s);if(!r.success){console.log(JSON.stringify(r));return}const u=new URL(r.data.uploadUrl);const k=r.data.storageKey;console.log(JSON.stringify({keyInPrefix:k.startsWith(process.argv[1]),pathEndsWithKey:decodeURIComponent(u.pathname).endsWith(k),expires:u.searchParams.get("X-Amz-Expires"),extKept:k.endsWith(".pdf")}))})' "$1"; }
PREFIX="worldstreet-academy/submissions/$A/$STUDENT/"
```

  1. The tile's data:
     - `rows` → exactly `Fixture trade plan | assignment | not_started | $A | /dashboard/assignments/$A | due`. No draft row.
     - `node "$H/mockdb.cjs" exam-fixture $F`; `rows` → adds `Fixture final exam | final | locked | <examId> | /dashboard/courses/$F/exam | -`. The field is now `id`, and the Phase 4 status is unchanged.
     - `node "$H/mockdb.cjs" set-package $N basic` → `rows` prints nothing (Basic has neither `assignments` nor `certificate`). `set-package $N standard` afterwards.
     - Legacy: `node "$H/mockdb.cjs" assignment-fixture $BTC published` → `rows` adds a `Fixture trade plan | assignment | not_started | … | … | -` row for Bitcoin (FULL_ACCESS).
  2. Reading one:
     - `student getAssignmentForStudent "[\"$A\"]"` → `success:true`, `"title":"Fixture trade plan"`, `"submission":null`.
     - `…"[\"$D\"]"` → `Assignment not found`; `'["nope"]'` → `Assignment not found`; as admin → `Assignment not found`.
     - `set-package $N basic` → `Assignments aren't included in your package`; `set-package $N standard`.
  3. Upload URL (never PUT):
     - `student getSubmissionUploadUrl "[\"$A\",\"plan.pdf\",\"application/pdf\",2048]" | uploadcheck "$PREFIX"` → `{"keyInPrefix":true,"pathEndsWithKey":true,"expires":"900","extKept":true}`. If the controller's step-2 check printed `0`: `File uploads aren't available right now`; report it.
     - `…"[\"$A\",\"setup.exe\",\"application/x-msdownload\",2048]"` → `Upload a PDF, Word, Excel, PowerPoint, CSV, text, PNG, JPEG or zip file`.
     - `…"[\"$A\",\"big.pdf\",\"application/pdf\",30000000]"` → `Files can be up to 25 MB`.
     - With `set-package $N basic` → `Assignments aren't included in your package`; restore `standard`.
  4. Submitting (keys are fake; nothing is uploaded):
     - `sub() { student submitAssignment "[{\"assignmentId\":\"$A\",\"text\":$1,\"files\":$2}]"; }`
     - `sub '""' '[]'` → `Write an answer or attach a file`.
     - `sub '"My plan: buy the pullback."' '[]'` → `success:true`. `node "$H/mockdb.cjs" assignments` → one submission `status=submitted files= text="My plan: buy the pullback."`. `rows` → the assignment is `submitted`. `notifications 1` → `to=$INSTRUCTOR "New assignment submission" … href=/instructor/courses/$F/assignments`.
     - `sub '"x"' '[{"key":"worldstreet-academy/resources/x.pdf","filename":"x.pdf","mimeType":"application/pdf","sizeBytes":10}]'` → `Upload your files again`.
     - Another user's folder, `"key":"worldstreet-academy/submissions/'$A'/'$ADMIN'/1-x.pdf"` → `Upload your files again`. A `..` inside your own prefix, `"key":"'$PREFIX'../x.pdf"` → `Upload your files again`.
     - Four valid-prefix files → `Attach up to three files`.
     - `"mimeType":"application/x-msdownload"` with a valid-prefix key → the MIME refusal.
     - Own prefix: `sub '"Revised plan."' '[{"key":"'$PREFIX'1-plan.pdf","filename":"plan.pdf","mimeType":"application/pdf","sizeBytes":2048}]'` → `success:true`. `assignments` → still **one** submission for A (`text="Revised plan."`, `files=${PREFIX}1-plan.pdf`).
  5. Graded:
     - `SUBID=$(student getAssignmentForStudent "[\"$A\"]" | field data.submission.id)`.
     - `bash "$H/action.sh" "/instructor/courses/$F/assignments" gradeSubmission "[{\"submissionId\":\"$SUBID\",\"grade\":90,\"feedback\":\"Solid\"}]" instructor` → `success:true`.
     - `student getAssignmentForStudent "[\"$A\"]"` → `"status":"graded","grade":90,"feedback":"Solid"`, `files[0].key` = `${PREFIX}1-plan.pdf` (the owner sees their own key).
     - `sub '"again"' '[]'` → `This assignment has already been graded`. `getSubmissionUploadUrl` → the same refusal. `rows` → `graded`.
     - Download (not fetched): `student getSubmissionFileUrl "[\"$SUBID\",0]" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s);console.log(r.success?JSON.stringify({signed:new URL(r.data.url).searchParams.has("X-Amz-Signature")}):JSON.stringify(r))})'` → `{"signed":true}`.
  6. **(controller)** Browser, student — **never choose a file** (the PUT would hit live R2):
     - `node "$H/mockdb.cjs" restore`; `N=$(… fixture standard …)`; `A=$(… assignment-fixture $F published 10080 …)`.
     - `$B viewport 400x800`, `/dashboard`: the Assignments tile shows "Fixture trade plan · Assignment · due <date> · Forex Trading Mastery" with "Not started" and "1 to do · 0 done".
     - Open it → the instructions card, "Submit your work", Attach files (outline) and "Submit assignment" (gold, the only gold). Type an answer and submit → "Your submission · Submitted … · you can resubmit until it's graded" and the button reads "Resubmit".
     - `$B js "document.body.scrollWidth + '/' + window.innerWidth"` → `400/400`. Save `"$P7/t6-submit-400.png"`.
     - Grade it 90 from the instructor page (or with the action above), reload → the "Your grade 90 / 100" card with "Solid". Save `"$P7/t6-graded-400.png"`.
     - Add four more `assignment-fixture $F published` → the tile shows "View all" → `/dashboard/assignments` lists all five with chips; 400/400. Save `"$P7/t6-index-400.png"`.
  7. End: `node "$H/mockdb.cjs" restore`.

- [ ] **Step 8: Commit.**

```bash
git add lib/actions/assignments.ts lib/actions/exams.ts components/dashboard/assignments-tile.tsx "app/(platform)/dashboard/assignments/page.tsx" "app/(platform)/dashboard/assignments/[assignmentId]/page.tsx"
git commit -m "feat(assignments): students submit text and files to the private bucket, see grades and feedback; assignments join the dashboard tile

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Spec coverage (self-review)

| Spec / plan item | Where |
|---|---|
| §6 Executive "Private 1-on-1 coaching · Private expert sessions · Direct mentorship" | Tasks 2–4: request → confirm → private room, class start rules, reminders |
| §6 Executive "Personalized learning roadmap" | Task 1 field; Task 3 editor; Task 2 student read |
| §6 Executive "Private Q&A" | Existing Instructor Q&A (Phase 3/4, `MessageInstructorButton`); unchanged |
| §6 Executive "Individual strategy review · Personalized trading-plan development · Individual progress assessment · Personalized feedback" | Delivered in sessions (Tasks 2–4) and graded assignments with feedback (Tasks 5–6); no separate feature claimed |
| §6 Executive "Priority support" | Already live: Phase 4 Task 5 (badge + `[Priority]` mailto) |
| §6 Standard/Executive "Practical assignments" · D7 v2 | Tasks 5–6, gated by `entitlements.assignments` |
| 7.1 model, one open request, `proposedSlots` pattern, confirm via interview mechanics, notifications + email on request/confirm/cancel, reminders | Rulings 3–10; Tasks 1–4 |
| 7.1 UI: request from the Instructor/Mentor tile; instructor queue on `/instructor/meetings` | Task 2 Step 5 (tile link → `/dashboard/mentorship`); Task 3 |
| 7.1 quota | Ruling 1 — none in v1 |
| 7.2 roadmap edited by the instructor, seen by the student; TipTap | Ruling 11 — plain text; Tasks 2–3 |
| 7.3 `Assignment`/`Submission` models, private bucket, grading, the Assignments tile | Rulings 13–17; Tasks 1, 5, 6 |
| 7.3 "submit from the lesson page" | Deferred: course-level assignments are submitted from `/dashboard/assignments/[id]`, reached from the tile and `/dashboard/assignments` (ruling 13) |

**Exit criteria → evidence:**
- **"Executive students can request, get confirmed, and join a private session; instructors manage the queue; reminders fire."**
  - Request and cancel: Task 2 Step 6.1–6.5.
  - Queue and confirm, up to the RealtimeKit call, with nothing written on failure: Task 3 Step 5.1–5.5.
  - Join rules on fixtures (student refused before start, privacy, package, host early/near start): Task 4 Step 8.1–8.6.
  - Reminders: Task 4 Step 8.8.
  - **Staging, before release:** one real confirmation with RealtimeKit credentials — the host starts from Active Meetings, the student joins from `/dashboard/mentorship`.
- **"Roadmap editable/visible; priority-support badge live."** Roadmap: Task 3 Step 5.6 and Task 2 Step 6.6. Priority support: Phase 4 Task 5 (unchanged).
- **"Assignments with file submissions and grading, gated by package."**
  - Instructor side: Task 5 Step 6.
  - Student side, up to the presigned PUT: Task 6 Step 6.
  - **Staging, before release:** one real upload and download with the production private bucket.

**Type consistency (checked across tasks):**
- `MentorshipSessionView`, `toViews` and the module-private helpers (Task 2) are reused by `getMentorshipQueue` (Task 3).
- `includesMentorship` (Task 1) is used by Tasks 2, 3 and 4.
- `Meeting.mentorshipSessionId` (Task 1) is written in Task 3 and the fixture, and read in Task 4 (`joinMeeting`, `getMyMeetingInvites` `$exists: false`, the cron).
- `queryKeys.mentorship`/`mentorshipQueue` (Task 2) and `courseAssignments`/`studentAssignment` (Task 5) are read in Tasks 2, 3, 5 and 6.
- `SubmissionFileView` and `SubmissionFiles` (Task 5) are extended/reused by `StudentSubmissionFile` and the student page (Task 6).
- `MyAssessment` (`id`, `scope: "assignment"`, `dueAt`, `submitted|graded`) is defined in Task 6 Step 3 and read by the tile, the index page and the detail page's invalidation.

**Placeholder scan:** every code step carries complete code. Each task's Interfaces block names what it consumes.

## Phase report — exit criteria and where they are proven

Report these lines, with the evidence above:
- Executive students request a private session with up to three proposed times. The instructor confirms one from the Mentorship panel on `/instructor/meetings`, which opens a private scheduled room; either side can decline or cancel. Nobody but that student (or an admin) can enter, the host can start it from 15 minutes before, the student is told when it begins, and T-24h/T-1h reminders reach the two of them only.
- Instructors write each mentee's roadmap as plain text; students read it on `/dashboard/mentorship`, reached from the dashboard's "Sessions & roadmap" link.
- Instructors publish assignments and grade submissions (0–100 plus feedback). Students whose package includes assignments submit text and up to three files, which are stored only in the private bucket and downloaded through 5-minute signed links. Assignments appear in the dashboard Assignments tile and on `/dashboard/assignments`.
- Priority support was already live from Phase 4.

**§0.4 cross-repo rows to add (Go / mobile / ops):**

| When | Repo | Change |
|---|---|---|
| Phase 7 | Go (`worldstreet-academy/backend`) | New collections `mentorshipsessions`, `assignments`, `submissions` are web-only; Go may ignore them. Never write them without mirroring the web rules (one `requested` per enrollment; submissions only under `worldstreet-academy/submissions/<assignmentId>/<userId>/` in the private bucket). |
| Phase 7 | Go | `meetings.mentorshipSessionId` (additive). If Go lists or joins meetings: treat such a meeting as private — only its session's `student` (session `status: "confirmed"`, Executive mentorship still held) or the host may join. Refuse non-hosts before the host starts it, and never list it as a course session while `scheduled`. It has no `courseId` by design. |
| Phase 7 | Go | `enrollments.mentorRoadmap: { text, updatedAt, updatedBy } \| null` (additive). If mobile shows it, render as plain text. If Go ever rewrites enrollments wholesale, carry it (and Phase 6's `certificateId`). |
| Phase 7 | Go | Rule R-M (mentorship): `enrollment.packageKey == "executive"` AND the course's `executive` package (by key, ignoring `enabled`) has `entitlements.mentorship` AND status `active\|completed`. Assignments follow R1's `entitlements.assignments`. |
| Phase 7 | Coolify | `R2_RESOURCES_BUCKET_NAME` must be set to a bucket with **no public access**, or submissions refuse uploads ("File uploads aren't available right now"). The reminders cron (Phase 4) already covers sessions. |
| Phase 8 | Ops | Run the two staging checks above (RealtimeKit session end to end; one real submission upload/download) before production. |

**Notes and debts for the report:**
- No session quota (ruling 1), and no stored `completed`/`no_show`. "Past" is derived. A no-show looks like a past session.
- The host's early-start message stays class-worded ("This class is scheduled for …") because the instructor page matches that exact string. It is a copy refinement for later.
- No slot-conflict check against the instructor's other meetings. Confirmation is the instructor's call.
- An instructor change on a course leaves existing requests with the previous instructor (`MentorshipSession.instructor` is a snapshot).
- Files replaced on resubmission stay in the private bucket (no delete during verification against live R2). Submissions don't HEAD-check their objects: the client submits only after a successful PUT. Both are ops debt.
- Assignments are course-level: no lesson attachment, no lesson-tier gate, no resource attachments, due dates shown but not enforced.
- Roadmap is plain text, because TipTap HTML would need a sanitiser dependency.
- Instructors have no sidebar entry for Mentorship; the panel lives on `/instructor/meetings`. Students have no sidebar entry; they use the tile link, notifications and emails.
