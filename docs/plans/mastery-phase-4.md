# Mastery Academy — Phase 4 Implementation Plan (Student dashboard per blueprint §12)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After payment the student lands on `/dashboard` and sees the blueprint §12 dashboard:
- the "Welcome to WorldStreet Mastery Academy — Your learning journey starts now." band (on `?welcome=1`);
- a gold **Continue learning →** CTA;
- the ten tiles: My programs · Current course · My progress · Upcoming classes · Assignments · Certificates · Instructor / Mentor · Community · Support.

Each tile is backed by real data, or hidden when the student's packages can't back it. Instructors can schedule a course class for later. Students with live classes see it under Upcoming classes, get T-24h/T-1h reminders, and can't sit in the room before the host starts it. My programs shows each card's package and a chip for every status that doesn't open the player.

**Architecture:**
- **One enrollment read feeds the page.** `fetchMyEnrollments` gains package, instructor, entitlement, open-lesson and resume-title fields. Pure selectors in `lib/dashboard-home.ts` turn that list into the CTA target, Current course, instructor rows and badge decisions. The selectors are pure so badge truthfulness can be asserted with `tsx`.
- **Three new data sources, each with a TanStack hook:**
  - `getUpcomingClasses()` in `lib/actions/meetings.ts`;
  - `getMyAssessments()` in `lib/actions/exams.ts`;
  - the existing `fetchMyCertificates()`.
- **Scheduling reuses the Meeting model as it stands.** No schema change: `status: "scheduled"`, `scheduledAt` and the `reminders` ledger already exist. `createCourseMeeting` mints the RTK room up front, like interviews. The host's join already flips scheduled → active. The reminders cron learns the course-class audience.
- **The dashboard stays a client page.** Tiles live in `components/dashboard/`. Assignments lands last as one inserted line.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict · Mongoose · Tailwind v4 + DS v2 `ws-*` tokens · Base UI (`render` prop) · TanStack Query · lucide-react · Resend (no-op in mock) · Ably notifications (`lib/notify.ts`).

**Spec:**
- `docs/mastery-academy-blueprint.md` §12 (welcome copy + the ten tiles, lines 207–214).
- `docs/mastery-academy-plan.md`:
  - § Phase 4 (4.1 tiles, 4.2 scheduled classes, 4.3 My programs chips, 4.4 nav; lines 353–393) and its Exit criteria;
  - D1 (product name = `BRAND.name`), D5 (no upgrades), D6 (community env), D7 (assignments lite);
  - §0.3 hard constraints.
- Phase 3 (branch `mastery/phase-3`) shipped what this plan consumes: `lib/entitlements.ts`, `lib/course-access.ts`, the lesson/exam/certificate/live-class/Q&A gates, and `/dashboard?welcome=1` as the success page's "Go to dashboard" link.

**Controller rulings (binding — do not re-litigate):**
1. **Welcome band.** `/dashboard?welcome=1` shows the heading `Welcome to ${BRAND.name}` and the line "Your learning journey starts now.". Every other visit keeps the time-of-day greeting. *Why:* first-visit onboarding is already the `OnboardingModal` (`app/(platform)/layout.tsx:46`), so keying on `hasOnboarded` would double up. The success page's link is the "just paid" signal.
2. **Continue learning.** The hero CTA is the page's only gold CTA.
   - It goes to the most recently accessed enrollment with status `active` or `completed`, at its learn page for `resumeLessonId`.
   - With no such enrollment it reads **"Browse programs"** → `/dashboard/courses`.
   - *Why:* signed-in users browse programs at `/dashboard/courses`, which is the sidebar's "Programs" item. `/programs` is the public marketing index.
3. **`StudentEnrollment` / `fetchMyEnrollments` extended additively.**
   - New fields: `packageKey`, `packageName`, `instructorId`, `instructorHeadline`, `entitlements` (via `entitlementsFor`), `explicitPackage`, `openLessons` (via `openPublishedLessonIds`, ruling 27), `resumeLessonTitle`.
   - Every existing field and behaviour stays, including returning ALL statuses.
   - My progress counts lessons over `openLessons`.
   - *Why:* one read feeds every tile. `totalLessons` counts lessons a tiered package can't open, so the "X/Y lessons" tally was wrong after Phase 3 Task 4.
4. **Truthful badges.**
   - "Priority support" requires `explicitPackage` and `prioritySupport`.
   - "Your mentor" requires `explicitPackage`, `packageKey === "executive"` and `mentorship`.
   - Legacy enrollments get FULL_ACCESS for *access*, but are never labelled.
   - No "Request a session" copy until Phase 7. The mentor action is "Message your mentor", through the existing conversation flow.
   - *Why:* §0.3.5 truthfulness. Grandfathered access is not a purchased service.
5. **Tiles.**
   - Order: §12. Phone: one column. Desktop: a grid.
   - Tiles are `bg-ws-surface rounded-lg` cards separated by fill, not borders. Bottom padding clears the mobile nav as today.
   - Tile contents: My programs = the old "My courses" grid with a package chip. Current course = the most recent active enrollment. My progress = the existing pane. Certificates = count + latest, plus `queryKeys.certificates` and `useMyCertificates`. Community = `NEXT_PUBLIC_COMMUNITY_URL`, hidden when unset, new tab, `rel="noopener noreferrer"`. Support = `/dashboard/help` plus the priority badge.
   - "Browse courses" and "Bookmarks" stay **below** the tiles. "Browse courses" is renamed "Browse programs".
   - *Why:* §12 lists the tiles. Browsing and bookmarks are still useful, but they are not §12.
6. **Upcoming classes (consumer).**
   - `getUpcomingClasses()` returns `{ id, title, courseTitle, scheduledAt, joinHref }[]` for scheduled, not-yet-due classes on the student's `active|completed` enrollments with `liveClasses`.
   - Soonest first, limit 10. `joinHref` = `/dashboard/meetings?join=<id>`.
   - Also a `useUpcomingClasses` hook + key, and an "Upcoming classes" list above invites on `/dashboard/meetings`.
   - Empty copy: "No classes scheduled — your instructor will post them here."
   - *Why:* 4.2's consumer, gated exactly like `getMyMeetingInvites`.
7. **Scheduling (producer).**
   - A future `scheduledAtISO` (more than now + 60 s) creates `status: "scheduled"` + `scheduledAt`, with no `startedAt`. The past and invalid dates are rejected, like `adminScheduleInterview`.
   - The RTK room is minted up front, like `scheduleInterviewCore`. There is no `startScheduledMeeting`: the host's `joinMeeting` already starts it.
   - The notification email gets `scheduledAt`: `MeetingNotificationEmail` already renders "Scheduled for …".
   - `MeetingWithDetails` gains `scheduledAt?: string`.
   - The instructor modal gets a "Schedule for later" `datetime-local`. A scheduled create does not join RTK: the page confirms, invalidates meetings, and the host starts the class from Active Meetings.
   - *Why:* the interview precedent. RTK needs `meetingId`/`hostToken`, which are `required` on the schema, so creating the room later would need a schema change the Go API also reads.
8. **Students before the host.** A non-host joining a `scheduled` **course** meeting is refused with "This class hasn't started yet — it begins <time>".
   - The check runs after the Task 6 package gate, so the gate's refusals come first.
   - Interviews (no `courseId`) keep their waiting-room behaviour.
   - *Why:* nobody sits in an unstarted room. Keeping the gate first means students without live classes are told that, not a start time.
9. **Reminders cron.**
   - For course meetings the recipients are the host, invitees and every student with an `active|completed` enrollment whose package has `liveClasses`, with class wording.
   - The ledger and the interview behaviour stay unchanged.
   - *Why:* 4.2 exit criterion "reminders fire". The existing email says "interview".
10. **Assignments (D7 lite).**
    - `getMyAssessments()` returns published exams across `active|completed` enrollments. Knowledge checks appear only for lessons the package opens. Finals appear only when the package has `certificate`.
    - Status: `in_progress` if one is open; otherwise `passed` (final → `enrollment.examPassed`, quiz → any passed attempt); otherwise `failed` if the latest finished attempt isn't passed; otherwise `not_started`.
    - Hrefs: final → `/dashboard/courses/<id>/exam`; quiz → its lesson's learn page.
    - Bulk queries only. The tile is hidden when the list is empty.
    - Lesson quizzes are **not** gated on the `assignments` entitlement.
    - *Why:* Task 5's rules. `assignments` is reserved for Phase 7 submissions.
11. **Instructor / Mentor tile.**
    - One row per distinct instructor across `active|completed` enrollments: avatar, name linked to `/dashboard/instructor/<id>`, and headline.
    - `MessageInstructorButton` shows when some enrollment with that instructor has `instructorQa`. Otherwise the row shows "Instructor Q&A isn't in your package", the learn page's Task 6 copy.
    - Executive rows get "Your mentor".
    - *Why:* it mirrors the server gate in `getOrCreateConversation`.
12. **My programs page.**
    - Heading "My programs"; tabs stay progress-based.
    - `CourseCard` gains `packageName` and `statusLabel`.
    - Non-access statuses route to the course page, not the player.
    - Topbar title, breadcrumb, sidebar item and bottom-nav label → "My programs". The bottom-nav label is measured to fit at 400 px, and the controller verifies it.
    - *Why:* 4.3 and 4.4.
13. **Nav 4.4.** No new routes. The bottom nav keeps its items (only ruling 12's label changes). Help stays in the sidebar. *Why:* four items + the Vivid orb leave no room.
14. **UI rules.**
    - DS v2 tokens only; radii 4/7/10/13/999.
    - Gold only on the Continue learning CTA, existing active states, existing progress bars and ~10 % icon washes.
    - `font-display` headings; tabular numerals for counts, dates and progress.
    - lucide only.
    - Dates via `toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })`.
    - No horizontal overflow at 400 px.
    - The dashboard stays a client page using TanStack hooks.

**Rulings added while planning (binding for executors):**

15. **Task order differs from the suggestion.**
    - Assignments (action + hook + tile) lands **after** the dashboard layout, as Task 6.
    - The nav rename folds into Task 1.
    - *Why:* `action.sh` finds an action id only in the client chunks of a page that imports it. `getMyAssessments` has no consumer until its tile is mounted, so it can't be verified in a data-only task. The rename belongs with "My programs".
16. **Uniform auto grid, not 12-column spans.** Tiles use `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`. *Why:* tiles are hidden per student, and fixed spans would leave holes.
17. **Upcoming classes and Certificates tiles hide** when no `active|completed` enrollment includes `liveClasses` / `certificate`. *Why:* "your instructor will post them here" is false for a Basic-only student.
18. **Scheduled course classes leave "Course Sessions".** `getMyMeetingInvites` lists course meetings only while `active`/`waiting`; Upcoming classes lists them before that. *Why:* the invite row shows a live dot and "Join", and joining a scheduled class is now refused. Interviews (direct invites) are unchanged.
19. **`createCourseMeeting` keeps `description` as its 3rd parameter**; `scheduledAtISO` is the 4th. *Why:* renaming the 3rd positional parameter silently changes its meaning for any caller. The only caller passes two arguments.
20. **The not-started refusal also returns `startsAt` (ISO).** `/dashboard/meetings` formats it in the viewer's timezone. *Why:* server `toLocaleString` runs in UTC in Docker.
21. **Status chips.** Chips go on rows that don't open the player:
    - `pre_enrolled` on a launched course → "Seat reserved";
    - `expired` → "Access expired";
    - `refunded` → "Refunded";
    - `suspended` → "Suspended";
    - `cancelled` → "Cancelled".

    A reservation before launch keeps the card's existing "Not live yet" face. `completed` keeps the card's existing "Completed" chip (completed rows carry progress 100). `active` needs no chip. *Why:* one chip per state, and no duplicate "Completed". "Not live yet" is false once a course launches (the course page then says "Start Course — Pay").
22. **`MessageInstructorButton` gains optional `label` and `variant`.** *Why:* its default gold button would add gold CTAs to the dashboard. The mentor row needs "Message your mentor".
23. **Section "See all" links on the dashboard turn muted.** *Why:* gold is reserved for Continue learning (ruling 14). `CourseCard`'s own internals are unchanged.
24. **The ISO ↔ `datetime-local` helpers move to `lib/datetime-local.ts`.** The course editor and the class modal import them. *Why:* the helpers live in a large client component, and importing that file would pull it into the meetings bundle.
25. **Priority badge, help-page mailto and mentor label also require an access-granting status.** *Why:* a refunded or cancelled Executive enrollment isn't priority or mentored.
26. **The help page mailto gets `?subject=[Priority] Support request` for priority students.** *Why:* plan 4.1 item 10. The help page is a server component and reuses `fetchMyEnrollments` + `hasPrioritySupport`.
27. **`openLessons` is `openPublishedLessonIds(access).size`** (`lib/course-access.ts`) — published lessons the package opens, not every lesson row. A null `access` (no active/completed enrollment, or course staff) falls back to the course's own published lesson count. This also settles the `docs/go-patches-phase-3.md` R3 note that `learn/[lessonId]/page.tsx` and `markLessonComplete` "still count unpublished lessons" — Task 1 aligns both to the same published-open set. *Why:* one definition of "open", and it must exclude drafts: `lockedLessonIds` alone (used elsewhere for the lock check itself) doesn't filter on `isPublished`, so a draft lesson would otherwise count as "open" wherever it isn't tier-locked.
28. **Current course and Continue learning order by `lastAccessedAt` exactly as the sidebar's resume row does.** Never-opened rows serialize as "now", so a fresh purchase leads. *Why:* the dashboard and sidebar never disagree, and after payment the CTA points at what was just bought.
29. **`getOrCreateConversation`'s existing-conversation path is untouched — no new gate.** A student who once qualified for Instructor Q&A and opened a thread keeps `MessageInstructorButton` working even after a downgrade drops `canMessage` on the dashboard's `InstructorsTile` row, because `getOrCreateConversation` only runs `instructorQaRefusal` when creating a NEW conversation, not when one already exists. This is intended, not a gap Task 5 introduces or must close. *Why:* an existing thread is a relationship the student already has with the instructor, not a purchase the current package must keep re-justifying — the same reason the gate is named for *opening* a conversation, not for using one.

## Global Constraints

- **Schema:** no model changes in Phase 4. `Meeting.status/scheduledAt/reminders`, `Enrollment.packageKey/packageName` and `Exam/ExamAttempt` already exist. Two backends read one DB (§0.3.1), so nothing is renamed and no status changes meaning.
- **Do not edit (Phase 3 is still landing there):**
  - `lib/hooks/queries/keys.ts` `adminEnrollments` (add NEW keys only, at the anchors given);
  - `lib/actions/certificates.ts` instructor functions;
  - `lib/vivid/actions/progress.ts`;
  - `components/learn/lesson-sidebar.tsx`, `components/learn/mobile-lesson-list.tsx`;
  - `completeLesson` in `lib/actions/enrollments.ts`.

  If a Phase 3 fix has moved an anchor in a file you do edit, match the current text and say so in the report.
- **`"use server"` files export only async functions** (plus types). Non-exported helpers and consts are fine. `lib/actions/*.ts` are all `"use server"`.
- **Package rules have exactly two homes:** `lib/entitlements.ts` (pure) and `lib/course-access.ts` (server-only loader). Use `entitlementsFor` / `canAccessLesson`. Never write a rank comparison or a `packages.find(...)` for access inline, except `explicitPackage`'s existence check in `fetchMyEnrollments` (ruling 3).
- **`lib/dashboard-home.ts` is pure:** no React, no server imports, only `import type`. The dashboard, `EnrollmentCard` and the help page share it.
- **Copy (verbatim):**
  - `Welcome to ${BRAND.name}` · "Your learning journey starts now."
  - "Continue learning" · "Browse programs"
  - "My programs"
  - "No classes scheduled — your instructor will post them here."
  - "This class hasn't started yet" (server) / "This class hasn't started yet — it begins <medium date, short time>" (client)
  - "Class time must be in the future"
  - "Priority support" · "Your mentor" · "Message your mentor" · "Message"
  - "Instructor Q&A isn't in your package"
  - Status chips per ruling 21
  - Brand always via `BRAND` from `@/lib/brand`
  - Never invent numbers or claims.
- **Icons:** `lucide-react` only; never emoji.
- **UI tokens:**
  - Semantic classes only (`bg-ws-surface`, `bg-ws-raised`, `bg-ws-sunken`, `bg-ws-chip`, `bg-ws-track`, `text-ws-primary`, `text-ws-muted`, `text-ws-subtle`, `text-ws-gold`, `bg-ws-brand`, `bg-ws-brand/10`, `text-ws-success`, `bg-ws-success/10`, `text-ws-danger`, `bg-ws-danger/10`, `text-ws-warning`, `bg-ws-warning/10`, `font-display`); never a hex.
  - New markup uses `rounded-xs/sm/md/lg/full` only. Tiles are separated by fill (no borders).
  - Counts, dates and percentages in `tabular-nums`. Separators use `·`.
- **Base UI composition uses `render`, never `asChild`.** RSC-first applies to new files that need no hooks. The dashboard page and tiles are client components by ruling 14.
- **TanStack `queryFn`s wrap the action** (`queryFn: () => getX()`) so React Query's context object is never sent as a server-action argument.
- **Links:**
  - Browse programs: `/dashboard/courses`
  - My programs: `/dashboard/my-courses`
  - Course page: `/dashboard/courses/${id}`
  - Player: `/dashboard/courses/${id}/learn/${lessonId}`
  - Final exam: `/dashboard/courses/${id}/exam`
  - Certificates: `/dashboard/certificates`
  - Support: `/dashboard/help`
  - Instructor profile: `/dashboard/instructor/${id}`
  - Class join: `/dashboard/meetings?join=${meetingId}`

  Never ship a dead link.
- **No new dependencies. No `any`.**
- **Commits:**
  - One or more per task; every message ends with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
  - Add files by name; never `git add -A`.
  - Never commit `.env*`.
  - **Never run `git stash`.** The untracked `AGENTS.md` isn't yours.
- **Surgical:** touch only the listed files, plus files a compile error forces you into (say so in the report).

## Verification kit (controller-owned — use it, never start or restart servers yourself)

No test runner exists. Every task ends with:
- `npx tsc --noEmit 2>&1 | grep -v '^\.next/'` printing nothing;
- `npx eslint <every file you touched>` printing no errors or warnings;
- the task's runtime checks.

Set once per shell (Git Bash, repo root):

```bash
H="C:/Users/owen/AppData/Local/Temp/claude/C--Users-owen-downloads-projects-worldstreet-worldstreet-academy/d4ab89bb-8435-4b94-b993-6b42283d1e4b/scratchpad/phase-3"
P4="C:/Users/owen/AppData/Local/Temp/claude/C--Users-owen-downloads-projects-worldstreet-worldstreet-academy/d4ab89bb-8435-4b94-b993-6b42283d1e4b/scratchpad/phase-4"
export NODE_PATH="$(pwd)/node_modules"
F=6aa7bc2845744c5eeb0eb781          # Forex (basic/standard/executive packages, 0 lessons until `fixture`)
BTC=6a6fc0bb6433bbbd6322be03        # Bitcoin (legacy, free, 12 lessons)
STUDENT=6a6fc0bb6433bbbd6322be61
INSTRUCTOR=6a6fc0ba6433bbbd6322bdfd
```

Helpers live in `$H`. New test scripts and screenshots go in `$P4`.

- **Dev server:** `pnpm dev:mock` on **http://localhost:3001**, already running.
  - Mock Clerk.
  - Local Mongo `mongodb://127.0.0.1:27017/worldstreet-academy`.
  - Wallet stub env on :4010 (not used by Phase 4).
  - Never `.env.local` (production).
  - Turbopack hot-reloads code. `NEXT_PUBLIC_*` values and `CRON_SECRET` need a controller restart (see Controller setup).
  - **RealtimeKit is not configured:** `createRTKMeeting`/`addParticipant` throw. `createCourseMeeting` returns `Failed to create meeting` before writing, and a non-host `joinMeeting` that reaches RTK returns `Failed to join meeting`. Scheduled/active meetings are verified through fixtures.
  - Email is a no-op (Resend unset): verify recipients through Notification rows.
- **Personas:** cookie `mock_persona=guest|student|instructor|admin`; no cookie = student.
- **Calling a server action:** `bash "$H/action.sh" "<page whose client chunks import it>" <actionName> '<json args array>' [persona]` prints the return value.
  - `fetchMyEnrollments` → `/dashboard/my-courses`.
  - `getUpcomingClasses`, `getMyMeetingInvites`, `joinMeeting` → `/dashboard/meetings`.
  - `createCourseMeeting`, `getMyMeetings` → `/instructor/meetings` (persona instructor).
  - `fetchMyCertificates`, `getMyAssessments` → `/dashboard` (from Task 5 / Task 6).
- **Mock DB helper:** `node "$H/mockdb.cjs" <cmd>`.
  - `snapshot` · `restore` · `probe [userId]`
  - `fixture basic|standard|executive|none`: 3 Forex video lessons, tiers everyone / standard / executive, titled `Fixture — everyone|standard|executive`, orders 1–3, plus a student enrollment on that package. Prints `{"courseId","lessons":{"everyone","standard","executive"},"enrollmentId"}`.
  - `exam-fixture <courseId> [lessonId]`: a published final "Fixture final exam", or a knowledge check "Fixture knowledge check". Prints `{"examId"}`.
  - `meeting-fixture <courseId>`: an ACTIVE class "Fixture live class".
  - `set-package <enrollmentId> <key>` · `set-status <enrollmentId> <status>` · `preenrol <userId> <courseId>`
  - **New (Controller setup):** `scheduled-class-fixture <courseId|none> <minutesAhead>` · `attempt-fixture <examId> <userId> <status>` · `meetings` · `notifications [limit]`.
  - **Run `restore` at the end of every task that touched data**, and say so.
- **HTML checks:**
  - Next HTML is one line: count with `grep -o … | wc -l`.
  - Strip scripts first: `curl -s -b mock_persona=student URL | perl -pe 's/<script\b.*?<\/script>//gs' | grep -o '…' | wc -l`.
  - HTML escapes `'` as `&#x27;` and `&` as `&amp;`.
  - `(platform)/loading.tsx` streams redirects/notFound as HTTP 200, so judge by content.
  - **A client page's query data is not in its HTML.** Check data with `action.sh` and rendering in the browser.
- **Browser (controller only):**
  - `B=~/.claude/skills/gstack/browse/dist/browse`.
  - Commands: `$B viewport 400x800|1280x900` · `$B goto <url>` · `$B wait --load` · `$B js "document.body.scrollWidth + '/' + window.innerWidth"` · `$B screenshot --viewport "$P4/<name>.png"` · `$B console --errors`.
  - It browses as student unless the controller sets the persona cookie.
  - Steps marked **(controller)** are done by the controller. Implementers list them as "left for controller" in their report.
- **Mock data (baseline, verified read-only 2026-09-14):**

| Thing | Value |
|---|---|
| Student enrollments | `6a6fe33862cf63ed050e56c6` Bitcoin & Cryptocurrency Fundamentals — active, progress 64, `packageKey` absent, `lastAccessedAt` 2026-08-03T12:29Z, `lastAccessedLesson` `6a6fc0bb6433bbbd6322be15` "What is Bitcoin?", 12 lessons · `6a6fe33862cf63ed050e56c7` Technical Analysis for Crypto Trading — active, progress 31, `lastAccessedAt` 2026-08-03T00:39Z, no last lesson, first lesson "Introduction to Technical Analysis", **8 lesson rows** (course `totalLessons` says 24) |
| Instructor | Sarah Chen `6a6fc0ba6433bbbd6322bdfd`, headline "Crypto Trading Expert & Blockchain Educator", teaches all 15 published courses |
| Forex packages | basic "Forex Foundation" (all six entitlements false) · standard "Forex Mastery" (liveClasses, instructorQa, assignments, certificate) · executive "Private Forex Mentorship" (all six) |
| Counts | exams 0 · examattempts 0 · meetings 0 · notifications 0 · conversations 0 · completed enrollments 0 · users 3 (student, instructor, admin `6a6fc1258372b65d1ee8e972`) |

## Controller setup (before Task 1)

1. **Baseline.**
   - After Phase 3's remaining work merges into `mastery/phase-3`, cut `mastery/phase-4`.
   - Run `node "$H/mockdb.cjs" restore` and confirm the counts above.
   - If Phase 3 changed baseline data, re-run `snapshot`.
2. **New `mockdb.cjs` commands.**
   - In `$H/mockdb.cjs`, add these lines to the header comment under `preenrol`:

```js
//   scheduled-class-fixture <courseId|none> <minutesAhead>
//                                    a SCHEDULED meeting hosted by the instructor, due in
//                                    <minutesAhead> (negative = past). "none" = no course,
//                                    student invited (interview-shaped). Prints ids as JSON.
//   attempt-fixture <examId> <userId> <in_progress|submitted|expired|passed|failed>
//                                    an exam attempt on the user's enrollment; a passed FINAL
//                                    also stamps enrollment.examPassed (as gradeAttempt does).
//   meetings                         list every meeting (status, course, scheduledAt, ledger).
//   notifications [limit]            newest notifications, all users (default 10).
//   unpublished-lesson-fixture <courseId>
//                                    one more lesson on the course, isPublished:false,
//                                    open to everyone (no tier) — proves progress and
//                                    completion exclude drafts. Prints the lesson id.
```

   - Insert these branches directly above the final `} else {` (`unknown command`) branch:

```js
  } else if (cmd === "scheduled-class-fixture") {
    const [courseArg, minutesAhead] = args
    const course = courseArg && courseArg !== "none" ? oid(courseArg) : null
    const scheduledAt = new Date(now.getTime() + Number(minutesAhead ?? 60) * 60_000)
    const r = await db.collection("meetings").insertOne({
      title: course ? "Fixture scheduled class" : "Fixture interview",
      hostId: oid(INSTRUCTOR), status: "scheduled", meetingId: "rtk-fixture-scheduled", hostToken: "fixture",
      ...(course ? { courseId: course } : {}),
      participants: [{ userId: oid(INSTRUCTOR), role: "host", status: "admitted", joinedAt: now }],
      invites: course ? [] : [{ userId: oid(STUDENT), email: "student@worldstreet.academy", status: "sent", sentAt: now }],
      reminders: { h24SentAt: null, h1SentAt: null },
      settings: { allowScreenShare: true, muteOnEntry: true, requireApproval: true, guestAccess: Boolean(course), maxParticipants: 50 },
      scheduledAt, createdAt: now, updatedAt: now,
    })
    console.log(JSON.stringify({ meetingId: r.insertedId.toString(), scheduledAt: scheduledAt.toISOString() }))
  } else if (cmd === "attempt-fixture") {
    const [examId, userId, status] = args
    if (!["in_progress", "submitted", "expired", "passed", "failed"].includes(status)) throw new Error(`bad status ${status}`)
    const exam = await db.collection("exams").findOne({ _id: oid(examId) })
    if (!exam) throw new Error(`no exam ${examId}`)
    const enrollment = await db.collection("enrollments").findOne({ user: oid(userId), course: exam.course })
    if (!enrollment) throw new Error("the user has no enrollment on the exam's course")
    const finished = status !== "in_progress"
    const attemptNumber = (await db.collection("examattempts").countDocuments({ user: oid(userId), exam: exam._id })) + 1
    const r = await db.collection("examattempts").insertOne({
      user: oid(userId), exam: exam._id, course: exam.course, enrollment: enrollment._id, attemptNumber, status,
      startedAt: now, deadlineAt: new Date(now.getTime() + 10 * 60_000), submittedAt: finished ? now : null,
      answers: [], questionOrder: [], optionOrder: {},
      scorePercent: status === "passed" ? 100 : finished ? 0 : null,
      pointsEarned: finished ? (status === "passed" ? 1 : 0) : null, pointsTotal: finished ? 1 : null,
      createdAt: now, updatedAt: now,
    })
    // gradeAttempt stamps a passed FINAL onto the enrollment — mirror it.
    if (status === "passed" && (exam.scope ?? "final") === "final") {
      await db.collection("enrollments").updateOne(
        { _id: enrollment._id },
        { $set: { examPassed: true, examPassedAt: now, bestScorePercent: 100 } }
      )
    }
    console.log(JSON.stringify({ attemptId: r.insertedId.toString(), attemptNumber }))
  } else if (cmd === "meetings") {
    for (const m of await db.collection("meetings").find({}).sort({ createdAt: 1 }).toArray()) {
      console.log(`  ${m._id} ${JSON.stringify(m.title)} status=${m.status} course=${m.courseId ?? null} scheduledAt=${m.scheduledAt ? m.scheduledAt.toISOString() : null} startedAt=${m.startedAt ? m.startedAt.toISOString() : null} h24=${m.reminders?.h24SentAt ? "sent" : "-"} h1=${m.reminders?.h1SentAt ? "sent" : "-"}`)
    }
  } else if (cmd === "notifications") {
    const limit = Number(args[0] ?? 10)
    for (const n of await db.collection("notifications").find({}).sort({ createdAt: -1 }).limit(limit).toArray()) {
      console.log(`  to=${n.user} type=${n.type} ${JSON.stringify(n.title)} ${JSON.stringify(n.body)} href=${n.href}`)
    }
  } else if (cmd === "unpublished-lesson-fixture") {
    const [courseId] = args
    const r = await db.collection("lessons").insertOne({
      course: oid(courseId), title: "Fixture — draft", description: "Phase 4 fixture", type: "video",
      videoDuration: 300, videoThumbnailUrl: null, videoPublicId: null, content: null, liveScheduledAt: null,
      liveUrl: null, sectionTitle: null, isFree: false, isPublished: false, minPackageKey: null,
      videoUrl: "https://example.com/fixture-draft.mp4", resources: [], order: 99, createdAt: now, updatedAt: now,
    })
    console.log(JSON.stringify({ lessonId: r.insertedId.toString() }))
```

   - `restore` already covers `meetings`, `examattempts`, `exams`, `questions`, `notifications` and `lessons`, so no restore change is needed — the new draft lesson's `_id` isn't in the baseline snapshot, so `restore` deletes it like any other fixture row.
   - Smoke test: `node "$H/mockdb.cjs" scheduled-class-fixture none 10 && node "$H/mockdb.cjs" meetings && node "$H/mockdb.cjs" unpublished-lesson-fixture $F && node "$H/mockdb.cjs" restore`.
3. **Before Task 4 — restart with a cron secret.**
   - `scripts/dev-mock.mjs` sets no `CRON_SECRET` (it only inherits `process.env`), so `/api/cron/reminders` answers 401.
   - Copy `$H/restart-dev.ps1` to `$P4/restart-dev-p4.ps1` and change its `$cmd` line to:

```powershell
$cmd = 'set PORT=3001&& set WALLET_BASE_URL=http://127.0.0.1:4010&& set WALLET_SERVICE_TOKEN=stub-token&& set CRON_SECRET=phase4-cron-secret&& pnpm dev:mock'
```

   - Run it. Confirm: `curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "Authorization: Bearer phase4-cron-secret" http://localhost:3001/api/cron/reminders` → `200`.
   - Keep this env for the rest of the phase.
4. **Task 5, community shown state.**
   - Temporarily use `$cmd = 'set PORT=3001&& set WALLET_BASE_URL=http://127.0.0.1:4010&& set WALLET_SERVICE_TOKEN=stub-token&& set CRON_SECRET=phase4-cron-secret&& set NEXT_PUBLIC_COMMUNITY_URL=https://social.worldstreetgold.com&& pnpm dev:mock'`.
   - Run that task's community check, then restart back to the step-3 command.

---

### Task 1: Enrollment data for the dashboard, package & status chips, "My programs"

**Files:**
- Modify: `lib/actions/student.ts` (models import, line 5; `StudentEnrollment`, lines 44–59; `LearnLesson`, lines 467–483; `fetchCourseForLearning`'s lesson mapper, lines 568–587; `fetchMyEnrollments`, lines 653–718; `markLessonComplete`, lines 846–889)
- Create: `lib/dashboard-home.ts`
- Create: `components/platform/enrollment-card.tsx`
- Modify: `components/platform/course-card.tsx` (props; `isComplete`; cover chip; package chip; footer branch)
- Modify: `app/(platform)/dashboard/my-courses/page.tsx` (whole file)
- Modify: `app/(platform)/dashboard/page.tsx` (`ProgressPane` tally only — Task 5 rewrites the page)
- Modify: `app/(platform)/dashboard/courses/[courseId]/learn/[lessonId]/page.tsx` (one import; the progress computation, ~line 81)
- Modify: `components/platform/app-sidebar.tsx`, `components/platform/topbar.tsx`, `components/platform/bottom-nav.tsx`, `components/shared/command-search.tsx` (one label each)
- Modify: `docs/go-patches-phase-3.md` (one line — the Phase 4 alignment note)

**Interfaces:**
- Consumes: `entitlementsFor`, `canAccessLesson` (`lib/entitlements.ts`, already imported in `student.ts`); `ICoursePackage`, `IPackageEntitlements`, `PackageKey` from `@/lib/db/models`; `getCourseAccess`, `lockedLessonIds`, `openPublishedLessonIds` (`lib/course-access.ts`, already imported in `student.ts`; `openPublishedLessonIds` is new to `learn/[lessonId]/page.tsx`, which doesn't import from `lib/course-access.ts` yet).
- Produces:
  - `StudentEnrollment` gains `resumeLessonTitle: string | null`, `packageKey: PackageKey | null`, `packageName: string | null`, `instructorId: string`, `instructorHeadline: string | null`, `entitlements: IPackageEntitlements`, `explicitPackage: boolean`, `openLessons: number`. All existing fields are unchanged.
  - `LearnLesson` gains `isPublished: boolean`.
  - `lib/dashboard-home.ts`:
    - `grantsAccess(e: Pick<StudentEnrollment, "status">): boolean`
    - `enrollmentHref(e: StudentEnrollment): string`
    - `isComingSoon(e: StudentEnrollment, now: number): boolean`
    - `enrollmentStatusLabel(e: StudentEnrollment, now: number): string | null`
  - `EnrollmentCard({ enrollment }: { enrollment: StudentEnrollment })`
  - `CourseCard` accepts `packageName?: string | null` and `statusLabel?: string | null`.

- [ ] **Step 1: The enrollment type.** In `lib/actions/student.ts`:
  - line 5 is now (Phase 3's fix wave already added `IPackageEntitlements`/`PackageKey` for `markCourseComplete`'s package check) `import { Course, Enrollment, Bookmark, User, Lesson, type IPackageEntitlements, type PackageKey } from "@/lib/db/models"` — add `type ICoursePackage,` to it so it reads:

```ts
import { Course, Enrollment, Bookmark, User, Lesson, type ICoursePackage, type IPackageEntitlements, type PackageKey } from "@/lib/db/models"
```

  - replace the whole `export type StudentEnrollment = { … }` with:

```ts
export type StudentEnrollment = {
  id: string
  courseId: string
  courseTitle: string
  courseThumbnail: string | null
  instructorName: string
  instructorAvatarUrl: string | null
  progress: number
  totalLessons: number
  lastAccessedAt: string
  status: string
  courseAvailableAt: string | null
  firstLessonId: string | null
  /** Lesson to resume at — last accessed lesson, falling back to the first. */
  resumeLessonId: string | null
  /** Title of `resumeLessonId`; null when that lesson no longer exists. */
  resumeLessonTitle: string | null
  /** Package bought; null for legacy, free and pre-enrolled rows. */
  packageKey: PackageKey | null
  /** Package name snapshot taken at purchase. */
  packageName: string | null
  instructorId: string
  instructorHeadline: string | null
  /** What the package includes. Legacy rows read FULL_ACCESS — that is access, never a label. */
  entitlements: IPackageEntitlements
  /** True only when `packageKey` is set AND the course still has that package. Badges require it. */
  explicitPackage: boolean
  /** Published lessons on the course this package opens — `openPublishedLessonIds`'s size, the set `progress` is measured over. */
  openLessons: number
}
```

- [ ] **Step 2: `fetchMyEnrollments`.** Replace the whole function (from its `/**\n * Fetch user's enrolled courses\n */` comment through its closing `}`) with:

```ts
/**
 * Fetch user's enrolled courses — every status, most recently accessed first.
 */
export async function fetchMyEnrollments(): Promise<StudentEnrollment[]> {
  try {
    await connectDB()
    const user = await getAuthenticatedUser()

    const enrollments = await Enrollment.find({ user: user._id })
      .populate({
        path: "course",
        select: "title thumbnailUrl instructor totalLessons availableAt status packages",
        populate: {
          path: "instructor",
          select: "firstName lastName avatarUrl instructorProfile.headline",
        },
      })
      .sort({ lastAccessedAt: -1 })
      .lean()

    type PopulatedCourse = {
      _id: { toString(): string }
      title: string
      thumbnailUrl: string
      totalLessons?: number
      availableAt?: Date | null
      packages?: ICoursePackage[] | null
      instructor: {
        _id: { toString(): string }
        firstName: string
        lastName: string
        avatarUrl: string | null
        instructorProfile?: { headline?: string | null }
      }
    }

    // One lesson read for every enrolled course (was one query per enrollment).
    const courseIds = enrollments.map((e) => (e.course as unknown as PopulatedCourse)._id.toString())
    const lessons = await Lesson.find({ course: { $in: courseIds } })
      .sort({ order: 1 })
      .select("_id course title order minPackageKey isFree isPublished")
      .lean()
    const lessonsByCourse = new Map<string, typeof lessons>()
    for (const lesson of lessons) {
      const key = lesson.course.toString()
      const list = lessonsByCourse.get(key)
      if (list) list.push(lesson)
      else lessonsByCourse.set(key, [lesson])
    }

    return await Promise.all(
      enrollments.map(async (enrollment) => {
        const course = enrollment.course as unknown as PopulatedCourse
        const courseId = course._id.toString()
        const courseLessons = lessonsByCourse.get(courseId) ?? []
        const firstLesson = courseLessons[0]
        const packages = course.packages ?? []
        const packageKey = enrollment.packageKey ?? null
        const resumeLessonId =
          enrollment.lastAccessedLesson?.toString() ?? firstLesson?._id.toString() ?? null

        // openLessons is `openPublishedLessonIds`'s own set (docs/go-patches-phase-3.md
        // R3) — published lessons the package opens. `getCourseAccess` reads null for a
        // non-access-granting status (pre_enrolled/expired/refunded/suspended/cancelled)
        // or for course staff; either way there's no per-enrollment access record to
        // size the set from, so fall back to the course's own published lesson count.
        const access = await getCourseAccess(user._id.toString(), courseId)
        const openLessons = access
          ? (await openPublishedLessonIds(access)).size
          : courseLessons.filter((l) => l.isPublished).length

        return {
          id: enrollment._id.toString(),
          courseId,
          courseTitle: course.title,
          courseThumbnail: course.thumbnailUrl,
          instructorName: `${course.instructor.firstName} ${course.instructor.lastName}`,
          instructorAvatarUrl: course.instructor.avatarUrl,
          progress: enrollment.progress,
          totalLessons: course.totalLessons || 0,
          lastAccessedAt: enrollment.lastAccessedAt?.toISOString() || new Date().toISOString(),
          status: enrollment.status,
          courseAvailableAt: course.availableAt ? new Date(course.availableAt).toISOString() : null,
          firstLessonId: firstLesson?._id.toString() || null,
          resumeLessonId,
          resumeLessonTitle: courseLessons.find((l) => l._id.toString() === resumeLessonId)?.title ?? null,
          packageKey,
          packageName: enrollment.packageName ?? null,
          instructorId: course.instructor._id.toString(),
          instructorHeadline: course.instructor.instructorProfile?.headline || null,
          entitlements: entitlementsFor({ packages }, { packageKey }),
          explicitPackage: packageKey !== null && packages.some((p) => p.key === packageKey),
          openLessons,
        }
      })
    )
  } catch (error) {
    console.error("Fetch my enrollments error:", error)
    return []
  }
}
```

   (The old body's `const { Lesson } = await import("@/lib/db/models")` goes away: `Lesson` is imported at the top of the file. An empty `$in` returns no lessons, so a student with no enrollments costs one cheap query. `canAccessLesson` is no longer called directly in this function for `openLessons` — `openPublishedLessonIds` does the same tier check internally, filtered to published lessons — but `student.ts` still uses `canAccessLesson` elsewhere, in `fetchCourseForLearning`, so its import stays. Per ruling 27, this trades the removed per-enrollment lesson query for one `getCourseAccess` call per enrollment — the same per-item cost `isLessonLockedFor` already pays elsewhere in the codebase.)

- [ ] **Step 3: Align the two web call sites `docs/go-patches-phase-3.md` flagged.** Both still measure progress over every lesson row instead of the published-open set; bring them to the same definition ruling 27 gives `openLessons`.

  1. **`LearnLesson` gains `isPublished`.** In `lib/actions/student.ts`, `isFree: boolean` also appears in the unrelated `PublicCourseLesson` type, and `isFree: l.isFree,` also appears in `fetchPublicCourse`'s unrelated lesson mapper earlier in the file, so anchor on the two-line combo that's unique to each site below. In `LearnLesson` (lines 467–483), directly after

```ts
  order: number
  isFree: boolean
```

     add:

```ts
  /** Draft lessons never count toward progress (docs/go-patches-phase-3.md R3). */
  isPublished: boolean
```

     In `fetchCourseForLearning`'s lesson mapper (lines 568–587), directly after

```ts
          order: l.order,
          isFree: l.isFree,
```

     add `isPublished: l.isPublished,`.

  2. **The learn page's progress computation.** In `app/(platform)/dashboard/courses/[courseId]/learn/[lessonId]/page.tsx`:
     - directly after `import { getCurrentUser } from "@/lib/auth"` add `import { getCourseAccess, openPublishedLessonIds } from "@/lib/course-access"`;
     - replace

```ts
  const isLessonCompleted = completedLessonIds.includes(actualLessonId)
  // Progress is measured over the lessons this package opens.
  const openLessonIds = new Set(lessons.filter((l) => !l.locked).map((l) => l.id))
  const courseProgressPercent =
    openLessonIds.size > 0
      ? Math.min(100, Math.round((completedLessonIds.filter((id) => openLessonIds.has(id)).length / openLessonIds.size) * 100))
      : 0
```

       with

```ts
  const isLessonCompleted = completedLessonIds.includes(actualLessonId)
  // Progress is measured over the published lessons this package opens
  // (docs/go-patches-phase-3.md R3) — the same set `fetchMyEnrollments`'s
  // `openLessons` counts. Course staff (admin, or the course's own instructor)
  // have no enrollment, so `getCourseAccess` reads null for them; they see
  // progress over every published lesson, same fallback as `fetchMyEnrollments`.
  const access = currentUser ? await getCourseAccess(currentUser.id, courseId) : null
  const openLessonIds = access
    ? await openPublishedLessonIds(access)
    : new Set(lessons.filter((l) => l.isPublished).map((l) => l.id))
  const courseProgressPercent =
    openLessonIds.size > 0
      ? Math.min(100, Math.round((completedLessonIds.filter((id) => openLessonIds.has(id)).length / openLessonIds.size) * 100))
      : 0
```

       (`currentUser` is already fetched above, at `const currentUser = await getCurrentUser()`, before this block.)

  3. **`markLessonComplete`.** In `lib/actions/student.ts`, replace

```ts
    const locked = await lockedLessonIds(await getCourseAccess(user._id.toString(), courseId))
    if (locked.has(lessonId)) return { success: false, error: "This lesson isn't included in your package" }

    if (!enrollment.completedLessons.some((id: { toString(): string }) => id.toString() === lessonId)) {
      enrollment.completedLessons.push(new mongoose.Types.ObjectId(lessonId))
    }

    // Progress counts only the lessons this package opens.
    const open = new Set(lessonIds.filter((id) => !locked.has(id)))
    const done = enrollment.completedLessons.filter((id: { toString(): string }) => open.has(id.toString())).length
```

     with

```ts
    const access = await getCourseAccess(user._id.toString(), courseId)
    const locked = await lockedLessonIds(access)
    if (locked.has(lessonId)) return { success: false, error: "This lesson isn't included in your package" }

    if (!enrollment.completedLessons.some((id: { toString(): string }) => id.toString() === lessonId)) {
      enrollment.completedLessons.push(new mongoose.Types.ObjectId(lessonId))
    }

    // Progress counts only the published lessons this package opens (docs/go-patches-phase-3.md R3).
    const open = access ? await openPublishedLessonIds(access) : new Set<string>()
    const done = enrollment.completedLessons.filter((id: { toString(): string }) => open.has(id.toString())).length
```

     (The lock check's own eligibility gate is unchanged — a locked lesson still can't be marked complete. Only the progress *denominator* — what counts as "open" — moves to the published-open set. `getCourseAccess`, `lockedLessonIds` and `openPublishedLessonIds` are already imported at the top of `student.ts`; no new import.)

  4. **`docs/go-patches-phase-3.md`.** Replace the line

```
  - Two web call sites (`learn/[lessonId]/page.tsx`, `markLessonComplete`) still count unpublished lessons; they will be aligned in Phase 4.
```

     with

```
  - Both web call sites (`learn/[lessonId]/page.tsx`, `markLessonComplete`) were aligned to the published-open set in Phase 4.
```

- [ ] **Step 4: Card selectors.** Create `lib/dashboard-home.ts`:

```ts
import type { StudentEnrollment } from "@/lib/actions/student"

/*
 * Pure selectors over the student's enrollments (`fetchMyEnrollments`). The
 * dashboard, My programs and the help page share them, and every "is this
 * true for this student?" decision lives here so it can be asserted without a
 * browser. No React, no server imports — `import type` only.
 */

/** The statuses that open the player — the same two `lib/course-access.ts` counts. */
export function grantsAccess(enrollment: Pick<StudentEnrollment, "status">): boolean {
  return enrollment.status === "active" || enrollment.status === "completed"
}

/** Access-granting rows open the player where the student left off; every other row opens the course page. */
export function enrollmentHref(enrollment: StudentEnrollment): string {
  return grantsAccess(enrollment)
    ? `/dashboard/courses/${enrollment.courseId}/learn/${enrollment.resumeLessonId ?? enrollment.firstLessonId ?? "first"}`
    : `/dashboard/courses/${enrollment.courseId}`
}

/** A reservation on a course whose launch is still ahead — the card's "Not live yet" face. */
export function isComingSoon(enrollment: StudentEnrollment, now: number): boolean {
  return (
    enrollment.status === "pre_enrolled" &&
    !!enrollment.courseAvailableAt &&
    new Date(enrollment.courseAvailableAt).getTime() > now
  )
}

const STATUS_CHIP: Record<string, string> = {
  pre_enrolled: "Seat reserved",
  expired: "Access expired",
  refunded: "Refunded",
  suspended: "Suspended",
  cancelled: "Cancelled",
}

/**
 * Cover chip for rows that don't open the player. `active` needs none,
 * `completed` already shows the card's own Completed chip (completed rows carry
 * progress 100), and a reservation before launch shows "Not live yet" instead.
 */
export function enrollmentStatusLabel(enrollment: StudentEnrollment, now: number): string | null {
  if (grantsAccess(enrollment) || isComingSoon(enrollment, now)) return null
  return STATUS_CHIP[enrollment.status] ?? null
}
```

- [ ] **Step 5: Course card props.** In `components/platform/course-card.tsx`:
  1. In `CourseCardProps`, directly after the `comingSoonAt?: string | null` line, add:

```ts
  /** Enrolled cards: the package bought, as a chip under the title. */
  packageName?: string | null
  /** Enrolled cards whose status doesn't open the player ("Refunded", "Suspended"…): a neutral cover chip and a "View" footer. */
  statusLabel?: string | null
```

  2. In the destructuring, add `packageName,` and `statusLabel,` directly after `comingSoonAt,` (just before `}: CourseCardProps) {`).
  3. Change `const isComplete = progress === 100` to `const isComplete = progress === 100 && !statusLabel`.
  4. Replace

```tsx
          {comingSoonAt && (
            <span className="absolute left-3 top-2.5 z-10 inline-flex items-center rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ws-gold">
              Not live yet
            </span>
          )}
```

   with

```tsx
          {statusLabel ? (
            <span className="absolute left-3 top-2.5 z-10 inline-flex items-center rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              {statusLabel}
            </span>
          ) : comingSoonAt ? (
            <span className="absolute left-3 top-2.5 z-10 inline-flex items-center rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ws-gold">
              Not live yet
            </span>
          ) : null}
```

  5. Directly after the title's closing `</h3>` (the `line-clamp-2 min-h-[2.6em]` heading), add:

```tsx
          {packageName && (
            <span className="mt-2 inline-block max-w-full self-start truncate rounded-full bg-ws-chip px-2 py-0.5 text-[11px] font-medium text-ws-muted">
              {packageName}
            </span>
          )}
```

  6. Replace the single line `            ) : showProgress ? (` with:

```tsx
            ) : statusLabel ? (
              <div className="flex items-center justify-between gap-2 border-t border-ws-hairline pt-3">
                <span className="text-[13px] tabular-nums text-ws-muted">
                  {typeof progress === "number" ? `${progress}% complete` : ""}
                </span>
                <span className="inline-flex items-center gap-1 text-[13px] font-medium text-ws-muted">
                  View
                  <ArrowRightIcon size={13} aria-hidden />
                </span>
              </div>
            ) : showProgress ? (
```

- [ ] **Step 6: Enrollment card.** Create `components/platform/enrollment-card.tsx`:

```tsx
"use client"

import { CourseCard } from "@/components/platform/course-card"
import type { StudentEnrollment } from "@/lib/actions/student"
import { enrollmentHref, enrollmentStatusLabel, isComingSoon } from "@/lib/dashboard-home"

/**
 * A CourseCard for one of the student's enrollments: package chip, status chip
 * and the right destination (player vs course page). Dashboard + My programs.
 */
export function EnrollmentCard({ enrollment }: { enrollment: StudentEnrollment }) {
  const now = Date.now()
  return (
    <CourseCard
      href={enrollmentHref(enrollment)}
      title={enrollment.courseTitle}
      thumbnailUrl={enrollment.courseThumbnail}
      progress={enrollment.progress}
      packageName={enrollment.packageName}
      statusLabel={enrollmentStatusLabel(enrollment, now)}
      comingSoonAt={isComingSoon(enrollment, now) ? enrollment.courseAvailableAt : null}
    />
  )
}
```

- [ ] **Step 7: My programs page.** Replace the whole of `app/(platform)/dashboard/my-courses/page.tsx` with:

```tsx
"use client"

import * as React from "react"
import { Topbar } from "@/components/platform/topbar"
import { CourseCardSkeleton } from "@/components/platform/course-card"
import { EnrollmentCard } from "@/components/platform/enrollment-card"
import { EmptyState } from "@/components/shared/empty-state"
import { ArtCourses } from "@/components/shared/illustrations"
import { useEnrollments } from "@/lib/hooks/queries"
import { cn } from "@/lib/utils"
import { SearchIcon } from "lucide-react"

const TABS = ["All", "In Progress", "Completed"] as const
type Tab = (typeof TABS)[number]

export default function MyProgramsPage() {
  const [activeTab, setActiveTab] = React.useState<Tab>("All")
  const [search, setSearch] = React.useState("")
  const { data: enrolledCourses = [], isLoading } = useEnrollments()

  const filteredCourses = React.useMemo(() => {
    let courses = enrolledCourses

    switch (activeTab) {
      case "In Progress":
        courses = courses.filter((c) => c.progress > 0 && c.progress < 100)
        break
      case "Completed":
        courses = courses.filter((c) => c.progress === 100)
        break
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      courses = courses.filter(
        (c) =>
          c.courseTitle.toLowerCase().includes(q) ||
          c.instructorName.toLowerCase().includes(q) ||
          (c.packageName ?? "").toLowerCase().includes(q)
      )
    }

    return courses
  }, [activeTab, search, enrolledCourses])

  return (
    <>
      <Topbar title="My programs" />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-7xl space-y-8">
          <div>
            <h1 className="font-display text-[28px] font-semibold tracking-[-0.02em] text-ws-primary">
              My programs
            </h1>
            <p className="mt-1 text-[15px] text-ws-muted">
              Everything you&apos;re enrolled in, in one place.
            </p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <CourseCardSkeleton key={i} />
              ))}
            </div>
          ) : enrolledCourses.length === 0 ? (
            <EmptyState
              art={<ArtCourses />}
              title="You're not enrolled in anything yet"
              description="Pick a program and it'll show up here with your progress."
              actionLabel="Browse programs"
              actionHref="/dashboard/courses"
            />
          ) : (
            <>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                {/* SegmentedControl per 04-components: height 40, pill
                    container on bg/track, padding 3, active segment raised */}
                <div className="flex h-10 w-fit items-center rounded-full bg-ws-track p-[3px]">
                  {TABS.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        "flex h-[34px] items-center whitespace-nowrap rounded-full px-4 text-[13px] transition-colors duration-[var(--ws-motion-fast)]",
                        activeTab === tab
                          ? "bg-ws-raised font-semibold text-ws-primary"
                          : "font-medium text-ws-muted hover:text-ws-primary"
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div className="relative sm:w-72">
                  <SearchIcon
                    size={16}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ws-subtle"
                  />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search your programs…"
                    className="h-11 md:h-10 w-full rounded-full bg-ws-chip pl-11 pr-4 text-base md:text-sm text-ws-primary outline-none transition-colors duration-[var(--ws-motion-fast)] placeholder:text-ws-subtle focus:ring-[1.5px] focus:ring-ws-brand"
                  />
                </div>
              </div>

              {filteredCourses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-[13px] text-ws-muted">
                  <p>
                    {search.trim()
                      ? `No programs match "${search}"`
                      : `No ${activeTab.toLowerCase()} programs`}
                  </p>
                  <button
                    type="button"
                    onClick={() => (search.trim() ? setSearch("") : setActiveTab("All"))}
                    className="mt-1 text-[13px] font-medium text-ws-gold hover:opacity-80"
                  >
                    {search.trim() ? "Clear search" : "Show all programs"}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredCourses.map((course) => (
                    <EnrollmentCard key={course.id} enrollment={course} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
```

   (The "Clear search / Show all" text button keeps its existing gold: it's an existing affordance, and this task changes only its copy.)

- [ ] **Step 8: Progress tally + labels.**
  - In `app/(platform)/dashboard/page.tsx`, replace

```tsx
  const totalLessons = enrollments.reduce((s, e) => s + (e.totalLessons ?? 0), 0)
  const completedLessons = enrollments.reduce(
    (s, e) => s + Math.round(((e.progress ?? 0) / 100) * (e.totalLessons ?? 0)),
    0
  )
```

   with

```tsx
  // Progress is measured over the lessons each package opens (Phase 3 Task 4).
  const totalLessons = enrollments.reduce((s, e) => s + e.openLessons, 0)
  const completedLessons = enrollments.reduce(
    (s, e) => s + Math.round(((e.progress ?? 0) / 100) * e.openLessons),
    0
  )
```

  - `components/platform/app-sidebar.tsx`: `title: "My courses",` → `title: "My programs",` (in `learnItems`), **and** the badge check ~30 lines later, `item.title === "My courses" && inProgressCount > 0` → `item.title === "My programs" && inProgressCount > 0` — same rename, second consumer: the in-progress badge is keyed off this title string and would silently stop rendering otherwise.
  - `components/platform/topbar.tsx`: `"my-courses": "My Courses",` → `"my-courses": "My programs",`.
  - `components/platform/bottom-nav.tsx`: `title: "My Courses",` → `title: "My programs",`. The label gains one character; at `text-[10px]` the four items + orb total ≈ 330 px of the 384 px row. Step 9.6 checks the fit.
  - `components/shared/command-search.tsx`: in `studentPages`, the entry with `description: "View enrolled courses"` and `action: () => router.push("/dashboard/my-courses")` has `label: "My Courses",` → `label: "My programs",`. (A second entry with the same `id`/label, in the separate `instructorPages` array — `description: "Manage your courses"`, `action: () => router.push("/instructor/courses")` — is the instructor's own courses list and stays "My Courses": out of scope, ruling 12 renames only the student nav.)

- [ ] **Step 9: Verify.**
  1. tsc (filtered). Then `npx eslint lib/actions/student.ts lib/dashboard-home.ts components/platform/enrollment-card.tsx components/platform/course-card.tsx "app/(platform)/dashboard/my-courses/page.tsx" "app/(platform)/dashboard/page.tsx" "app/(platform)/dashboard/courses/[courseId]/learn/[lessonId]/page.tsx" components/platform/app-sidebar.tsx components/platform/topbar.tsx components/platform/bottom-nav.tsx components/shared/command-search.tsx`.
  2. Selector assertions. Create `"$P4/t1-enrollment-card.ts"`:

```ts
import assert from "node:assert/strict"
import type { StudentEnrollment } from "@/lib/actions/student"
import { enrollmentHref, enrollmentStatusLabel, grantsAccess, isComingSoon } from "@/lib/dashboard-home"

const FULL = { liveClasses: true, instructorQa: true, assignments: true, certificate: true, mentorship: true, prioritySupport: true }
const base: StudentEnrollment = {
  id: "e1", courseId: "c1", courseTitle: "Course", courseThumbnail: null, instructorName: "Sarah Chen",
  instructorAvatarUrl: null, progress: 40, totalLessons: 10, lastAccessedAt: "2026-09-01T00:00:00.000Z",
  status: "active", courseAvailableAt: null, firstLessonId: "l1", resumeLessonId: "l3", resumeLessonTitle: "Lesson 3",
  packageKey: null, packageName: null, instructorId: "i1", instructorHeadline: null, entitlements: FULL,
  explicitPackage: false, openLessons: 10,
}
const now = Date.parse("2026-09-14T12:00:00.000Z")
const future = "2026-10-01T00:00:00.000Z"
const past = "2026-09-01T00:00:00.000Z"

assert.equal(enrollmentHref(base), "/dashboard/courses/c1/learn/l3")
assert.equal(enrollmentHref({ ...base, resumeLessonId: null }), "/dashboard/courses/c1/learn/l1")
assert.equal(enrollmentHref({ ...base, resumeLessonId: null, firstLessonId: null }), "/dashboard/courses/c1/learn/first")
assert.equal(enrollmentHref({ ...base, status: "completed" }), "/dashboard/courses/c1/learn/l3")
for (const status of ["pre_enrolled", "expired", "refunded", "suspended", "cancelled"]) {
  assert.equal(grantsAccess({ status }), false, status)
  assert.equal(enrollmentHref({ ...base, status }), "/dashboard/courses/c1", `${status} → course page`)
}

assert.equal(enrollmentStatusLabel(base, now), null)
assert.equal(enrollmentStatusLabel({ ...base, status: "completed", progress: 100 }, now), null)
assert.equal(enrollmentStatusLabel({ ...base, status: "expired" }, now), "Access expired")
assert.equal(enrollmentStatusLabel({ ...base, status: "refunded" }, now), "Refunded")
assert.equal(enrollmentStatusLabel({ ...base, status: "suspended" }, now), "Suspended")
assert.equal(enrollmentStatusLabel({ ...base, status: "cancelled" }, now), "Cancelled")

const reserved = { ...base, status: "pre_enrolled" }
assert.equal(isComingSoon({ ...reserved, courseAvailableAt: future }, now), true)
assert.equal(enrollmentStatusLabel({ ...reserved, courseAvailableAt: future }, now), null, "pre-launch keeps Not live yet")
assert.equal(isComingSoon({ ...reserved, courseAvailableAt: past }, now), false)
assert.equal(enrollmentStatusLabel({ ...reserved, courseAvailableAt: past }, now), "Seat reserved")
assert.equal(enrollmentStatusLabel({ ...reserved, courseAvailableAt: null }, now), "Seat reserved")

console.log("enrollment card: all assertions passed")
```

   Run `npx tsx --tsconfig ./tsconfig.json "$P4/t1-enrollment-card.ts"` → `enrollment card: all assertions passed`. If tsx can't resolve `@/…` for a file outside the repo, switch the imports to absolute file paths into the repo and say so.

  3. Baseline data. Create `"$P4/show-enrollments.cjs"`:

```js
// Reads fetchMyEnrollments' JSON from stdin and prints one line per row.
const rows = JSON.parse(require("fs").readFileSync(0, "utf8"))
for (const e of rows) {
  console.log([
    e.courseTitle, e.status, e.packageKey, e.packageName, e.explicitPackage, e.openLessons,
    e.firstLessonId, e.resumeLessonId, JSON.stringify(e.resumeLessonTitle), e.instructorId,
    JSON.stringify(e.instructorHeadline), Object.values(e.entitlements).filter(Boolean).length,
  ].join(" | "))
}
```

   Run `bash "$H/action.sh" "/dashboard/my-courses" fetchMyEnrollments '[]' | node "$P4/show-enrollments.cjs"`. Expected, in this order (a null prints as an empty field):

```
Bitcoin & Cryptocurrency Fundamentals | active |  |  | false | 12 | 6a6fc0bb6433bbbd6322be15 | 6a6fc0bb6433bbbd6322be15 | "What is Bitcoin?" | 6a6fc0ba6433bbbd6322bdfd | "Crypto Trading Expert & Blockchain Educator" | 6
Technical Analysis for Crypto Trading | active |  |  | false | 8 | 6a6fc0bb6433bbbd6322be39 | 6a6fc0bb6433bbbd6322be39 | "Introduction to Technical Analysis" | 6a6fc0ba6433bbbd6322bdfd | "Crypto Trading Expert & Blockchain Educator" | 6
```

  4. Packages (re-run the step-3 command after each change):
     - `node "$H/mockdb.cjs" fixture standard` (note N) → a third, last row, because it was never accessed and Mongo sorts a null `lastAccessedAt` last: `Forex Trading Mastery | active | standard | Forex Mastery | true | 2 | … | "Fixture — everyone" | 6a6fc0ba6433bbbd6322bdfd | … | 4`.
     - `node "$H/mockdb.cjs" set-package N executive` → `executive | Private Forex Mentorship | true | 3 | … | 6`.
     - `node "$H/mockdb.cjs" set-status N cancelled` → the row is still returned, status `cancelled`.
  5. **(controller)** Browser, student, same state:
     - `$B viewport 400x800`, `$B goto http://localhost:3001/dashboard/my-courses`, `$B wait --load`.
     - The Forex card shows the chips `Private Forex Mentorship` and `CANCELLED` and a muted `View` footer.
     - `$B js "[...document.querySelectorAll('a[href^=\"/dashboard/courses/\"]')].map(a => a.getAttribute('href')).join(' ')"` includes `/dashboard/courses/6aa7bc2845744c5eeb0eb781` with no `/learn/`, plus both legacy cards' `/learn/` hrefs.
     - `$B js "document.body.scrollWidth + '/' + window.innerWidth"` → `400/400`. The Topbar reads `My programs`. Save `$B screenshot --viewport "$P4/t1-my-programs-400.png"`.
  6. **(controller)** Bottom nav at 400 px:
     - `$B js "[...document.querySelectorAll('nav.fixed a span')].map(s => s.textContent + ':' + Math.round(s.getBoundingClientRect().height)).join(' ')"` → four labels at equal single-line heights, including `My programs`.
     - `$B js "(() => { const n = document.querySelector('nav.fixed > div'); return n.scrollWidth + '/' + n.clientWidth })()"` → first number ≤ second.
     - If the label wraps or overflows, revert only the bottom-nav label to `My Courses` and say so.
  7. **Published-open alignment (ruling 27) — `openLessons`, the learn page and `markLessonComplete` agree on the same set.**
     - `node "$H/mockdb.cjs" fixture standard` → note N; lessons E (everyone), S (standard), X (executive).
     - `node "$H/mockdb.cjs" unpublished-lesson-fixture $F` → note D (draft, unpublished, open to everyone).
     - `bash "$H/action.sh" "/dashboard/my-courses" fetchMyEnrollments '[]' | node "$P4/show-enrollments.cjs"` → the Forex row's `openLessons` is `2` — E and S only; X is executive-locked on a standard package, D is unpublished.
     - `bash "$H/action.sh" "/dashboard/courses/$F/learn/D" markLessonComplete "[\"$F\",\"D\"]"` → `{"success":true}` (D isn't tier-locked, so marking it is still allowed) but `node "$H/mockdb.cjs" probe $STUDENT` shows the Forex enrollment's `progress` is still `0` — D isn't in the published-open set, so completing it doesn't move the tally.
     - `bash "$H/action.sh" "/dashboard/courses/$F/learn/E" markLessonComplete "[\"$F\",\"E\"]"` then `…"[\"$F\",\"S\"]"` (same page/action) → both `{"success":true}`; `probe $STUDENT` now shows `progress: 100` — completing only E and S reaches 100% because D and X are excluded from the denominator (it would read 50% if D or X still counted).
     - `curl -s -b mock_persona=student "http://localhost:3001/dashboard/courses/$F/learn/E" | perl -pe 's/<script\b.*?<\/script>//gs' | grep -o '[0-9]*%' | head -1` → `100%`, confirming the learn page's own computation (not just `markLessonComplete`'s) excludes D and X.
     - `node "$H/mockdb.cjs" restore`.
  8. `grep -n '"My programs"' components/shared/command-search.tsx | wc -l` → `1` (the student entry only; the instructor palette's own "My Courses" entry, routing to `/instructor/courses`, is untouched).
  9. **(controller)** After `node "$H/mockdb.cjs" restore`, `/dashboard` at 400 px: the progress pane reads `10/20 lessons` and `50%` (8 of 12 + 2 of 8; it used to read 15/36).
  10. End: `node "$H/mockdb.cjs" restore`.

- [ ] **Step 10: Commit.**

```bash
git add lib/actions/student.ts lib/dashboard-home.ts components/platform/enrollment-card.tsx components/platform/course-card.tsx "app/(platform)/dashboard/my-courses/page.tsx" "app/(platform)/dashboard/page.tsx" "app/(platform)/dashboard/courses/[courseId]/learn/[lessonId]/page.tsx" components/platform/app-sidebar.tsx components/platform/topbar.tsx components/platform/bottom-nav.tsx components/shared/command-search.tsx docs/go-patches-phase-3.md
git commit -m "feat(dashboard): enrollment package & instructor data, package and status chips, My programs

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Upcoming classes — `getUpcomingClasses`, hook, and the list on `/dashboard/meetings`

**Files:**
- Modify: `lib/actions/meetings.ts` (new `UpcomingClass` + `getUpcomingClasses` above `// ── Get meeting invites for current user (user-side) ──`; one filter in `getMyMeetingInvites`)
- Modify: `lib/hooks/queries/keys.ts` (new key only)
- Modify: `lib/hooks/queries/use-meetings.ts`
- Modify: `lib/hooks/queries/index.ts`
- Create: `components/meetings/upcoming-classes-list.tsx`
- Modify: `app/(platform)/dashboard/meetings/page.tsx` (one import, one render line)

**Interfaces:**
- Consumes: `entitlementsFor` (already imported in `meetings.ts`), `Meeting`, `Course`, `Enrollment`, `initAction`.
- Produces:
  - `type UpcomingClass = { id: string; title: string; courseTitle: string; scheduledAt: string /* ISO */; joinHref: string }`
  - `getUpcomingClasses(): Promise<UpcomingClass[]>` — `[]` when signed out or on error; soonest first; at most 10.
  - `queryKeys.upcomingClasses = ["upcoming-classes"]`
  - `useUpcomingClasses(): UseQueryResult<UpcomingClass[]>`; `useInvalidateMeetings()` also invalidates it.
  - `UpcomingClassesList({ onJoin }: { onJoin: (meetingId: string) => void })`
  - `getMyMeetingInvites` no longer lists **course** meetings in `scheduled` status (ruling 18).

- [ ] **Step 1: The action.** In `lib/actions/meetings.ts`, directly above the line `// ── Get meeting invites for current user (user-side) ──`, insert:

```ts
// ── Upcoming classes (student-side, spec §12) ──

export type UpcomingClass = {
  id: string
  title: string
  courseTitle: string
  /** ISO start time. */
  scheduledAt: string
  joinHref: string
}

/** How many upcoming classes the dashboard tile and the meetings page can list. */
const UPCOMING_CLASSES_LIMIT = 10

/**
 * Scheduled course classes the student can attend: status "scheduled", start
 * time still ahead, on a course where they hold an active/completed enrollment
 * whose package includes live classes. Soonest first. When the host starts a
 * class it turns "active" and moves to Course Sessions (getMyMeetingInvites).
 */
export async function getUpcomingClasses(): Promise<UpcomingClass[]> {
  try {
    const currentUser = await initAction()
    if (!currentUser) return []

    const enrollments = await Enrollment.find({
      user: new Types.ObjectId(currentUser.id),
      status: { $in: ["active", "completed"] },
    })
      .select("course packageKey")
      .lean()
    if (enrollments.length === 0) return []

    const courses = await Course.find({ _id: { $in: enrollments.map((e) => e.course) } })
      .select("title packages")
      .lean()
    const coursesById = new Map(courses.map((c) => [c._id.toString(), c]))
    const classCourseIds = enrollments
      .filter((e) => {
        const course = coursesById.get(e.course.toString())
        return course ? entitlementsFor(course, e).liveClasses : false
      })
      .map((e) => e.course)
    if (classCourseIds.length === 0) return []

    const meetings = await Meeting.find({
      courseId: { $in: classCourseIds },
      status: "scheduled",
      scheduledAt: { $gte: new Date() },
    })
      .sort({ scheduledAt: 1 })
      .limit(UPCOMING_CLASSES_LIMIT)
      .select("title courseId scheduledAt")
      .lean()

    return meetings.map((m) => {
      const id = m._id.toString()
      return {
        id,
        title: m.title,
        courseTitle: (m.courseId && coursesById.get(m.courseId.toString())?.title) || "",
        // The query filtered on scheduledAt, so it is set.
        scheduledAt: (m.scheduledAt as Date).toISOString(),
        joinHref: `/dashboard/meetings?join=${id}`,
      }
    })
  } catch (error) {
    console.error("Error fetching upcoming classes:", error)
    return []
  }
}

```

- [ ] **Step 2: Scheduled classes leave Course Sessions.** In `getMyMeetingInvites`, in the `courseMeetings` query (the one with `courseId: { $in: enrolledCourseIds },`), replace

```ts
            courseId: { $in: enrolledCourseIds },
            status: { $in: ["active", "waiting", "scheduled"] },
```

with

```ts
            courseId: { $in: enrolledCourseIds },
            // Scheduled classes are listed under Upcoming classes until the host starts them.
            status: { $in: ["active", "waiting"] },
```

   (Leave the `directInvites` query's `status` list alone: interviews reach applicants through it.)

- [ ] **Step 3: Key and hook.**
  - `lib/hooks/queries/keys.ts`: directly after `  instructorMeetingCourses: ["instructor-meeting-courses"] as const,` add

```ts
  upcomingClasses: ["upcoming-classes"] as const,
```

  - `lib/hooks/queries/use-meetings.ts`:
    - in the `@/lib/actions/meetings` import, add `getUpcomingClasses,` after `getInstructorCoursesForMeeting,` and `type UpcomingClass,` after `type MeetingInviteItem,`;
    - directly after the `useMeetingInvites` function add:

```ts
export function useUpcomingClasses() {
  return useQuery<UpcomingClass[]>({
    queryKey: queryKeys.upcomingClasses,
    queryFn: () => getUpcomingClasses(),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000, // a class leaves the list once it starts
  })
}
```

    - in `useInvalidateMeetings`, after `qc.invalidateQueries({ queryKey: queryKeys.meetingInvites })` add `qc.invalidateQueries({ queryKey: queryKeys.upcomingClasses })`.
  - `lib/hooks/queries/index.ts`: in the `./use-meetings` export block add `useUpcomingClasses,` after `useMeetingInvites,`.

- [ ] **Step 4: The list.** Create `components/meetings/upcoming-classes-list.tsx`:

```tsx
"use client"

import { CalendarClockIcon, ChevronRightIcon } from "lucide-react"
import { useUpcomingClasses } from "@/lib/hooks/queries"

/**
 * Scheduled course classes (spec §12 "Upcoming classes") on the meetings page,
 * above Course Sessions. Renders nothing when there are none — the dashboard
 * tile carries the empty-state copy. Choosing a class runs the page's normal
 * join, which says when a class hasn't started yet.
 */
export function UpcomingClassesList({ onJoin }: { onJoin: (meetingId: string) => void }) {
  const { data: classes = [] } = useUpcomingClasses()
  if (classes.length === 0) return null

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ws-primary">Upcoming classes</h2>
        <span className="text-[11px] tabular-nums text-ws-muted">{classes.length} scheduled</span>
      </div>
      <ul className="space-y-1.5">
        {classes.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onJoin(c.id)}
              className="flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-ws-brand/10">
                <CalendarClockIcon size={16} className="text-ws-gold" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ws-primary">{c.title}</span>
                <span className="block truncate text-[11px] text-ws-muted">
                  <span className="tabular-nums">
                    {new Date(c.scheduledAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                  {c.courseTitle ? ` · ${c.courseTitle}` : ""}
                </span>
              </span>
              <ChevronRightIcon size={14} className="shrink-0 text-ws-subtle" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
```

- [ ] **Step 5: Mount it.** In `app/(platform)/dashboard/meetings/page.tsx`:
  - directly after `import { MeetingInvitesList } from "@/components/meetings/meeting-invites"` add `import { UpcomingClassesList } from "@/components/meetings/upcoming-classes-list"`;
  - replace

```tsx
          {/* Course live session invites */}
          <MeetingInvitesList onJoin={handleJoinByLink} />
```

   with

```tsx
          {/* Scheduled course classes (spec §12) */}
          <UpcomingClassesList onJoin={handleJoinByLink} />

          {/* Course live session invites */}
          <MeetingInvitesList onJoin={handleJoinByLink} />
```

- [ ] **Step 6: Verify.** tsc; `npx eslint lib/actions/meetings.ts lib/hooks/queries/keys.ts lib/hooks/queries/use-meetings.ts lib/hooks/queries/index.ts components/meetings/upcoming-classes-list.tsx "app/(platform)/dashboard/meetings/page.tsx"`. Then:

```bash
node "$H/mockdb.cjs" fixture standard                      # note N
node "$H/mockdb.cjs" scheduled-class-fixture $F 120        # note M1 (in 2 h)
node "$H/mockdb.cjs" scheduled-class-fixture $F -30        # M0, already past
node "$H/mockdb.cjs" meeting-fixture $F                    # A, active
MP="/dashboard/meetings"
```

  1. `bash "$H/action.sh" "$MP" getUpcomingClasses '[]'` → exactly one row: `id` M1, `title` `Fixture scheduled class`, `courseTitle` `Forex Trading Mastery`, `joinHref` `/dashboard/meetings?join=M1`, `scheduledAt` ≈ 2 h from now. No M0, no A.
  2. `bash "$H/action.sh" "$MP" getMyMeetingInvites '[]'` → `invites` contains `Fixture live class` (A) and **not** `Fixture scheduled class`.
  3. `node "$H/mockdb.cjs" set-package N basic` → `getUpcomingClasses` → `[]`.
  4. Legacy access: `node "$H/mockdb.cjs" scheduled-class-fixture $BTC 60` (M2) → `getUpcomingClasses` → one row, `courseTitle` `Bitcoin & Cryptocurrency Fundamentals` (the legacy enrollment has full access even though Forex is Basic).
  5. `bash "$H/action.sh" "$MP" getUpcomingClasses '[]' admin` → `[]` (no enrollments).
  6. **(controller)** Browser, student: `$B viewport 400x800`, `$B goto http://localhost:3001/dashboard/meetings`, `$B wait --load`.
     - "Upcoming classes" shows the Bitcoin class above Course Sessions, and Course Sessions still shows `Fixture live class`.
     - `$B js "document.body.scrollWidth + '/' + window.innerWidth"` → `400/400`.
     - Save `"$P4/t2-meetings-upcoming-400.png"`.
  7. End: `node "$H/mockdb.cjs" restore`.

- [ ] **Step 7: Commit.**

```bash
git add lib/actions/meetings.ts lib/hooks/queries/keys.ts lib/hooks/queries/use-meetings.ts lib/hooks/queries/index.ts components/meetings/upcoming-classes-list.tsx "app/(platform)/dashboard/meetings/page.tsx"
git commit -m "feat(meetings): upcoming classes for students whose package includes live classes

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Scheduling a class — `createCourseMeeting(…, scheduledAtISO)`, the modal, host start, students refused before start

**Files:**
- Create: `lib/datetime-local.ts`
- Modify: `components/instructor/course-editor.tsx` (remove the two local helpers at lines 73–88; add one import)
- Modify: `lib/actions/meetings.ts` (`MeetingWithDetails`; `joinMeeting` return type + not-started refusal; `getMyMeetings` mapper; `createCourseMeeting` whole function)
- Modify: `components/meetings/instructor-meeting-extras.tsx` (imports; `CreateCourseMeetingModal` whole function)
- Modify: `app/(instructor)/instructor/meetings/page.tsx` (state; `handleCreateCourseMeeting`; notice banner)
- Modify: `components/meetings/meeting-lobby.tsx` (`ActiveMeetingsList`: scheduled chip + "Start")
- Modify: `app/(platform)/dashboard/meetings/page.tsx` (join error message helper)

**Interfaces:**
- Consumes: `MeetingWithDetails`, `getMyMeetings`, the Task 6 (Phase 3) gate in `joinMeeting`; `sendMeetingNotificationEmail` (`MeetingEmailData.scheduledAt?: string` already renders "Scheduled for …").
- Produces:
  - `isoToLocalInput(iso: string | null | undefined): string` and `localInputToIso(local: string): string` from `@/lib/datetime-local`
  - `MeetingWithDetails.scheduledAt?: string`
  - `createCourseMeeting(courseId: string, title: string, description?: string, scheduledAtISO?: string)`. With a valid future `scheduledAtISO` it creates `status: "scheduled"` and returns **no** `authToken`. Refusals: `"Invalid class time"`, `"Class time must be in the future"`.
  - `joinMeeting` refuses non-hosts on a scheduled course meeting with `{ success: false, error: "This class hasn't started yet", startsAt?: string }`.
  - `CreateCourseMeetingModal`'s `onCreate: (courseId: string, title: string, scheduledAtISO?: string) => void`

- [ ] **Step 1: Shared datetime helpers.** Create `lib/datetime-local.ts`:

```ts
/*
 * `<input type="datetime-local">` speaks wall-clock time with no zone; the
 * server speaks ISO. Both conversions happen in the viewer's timezone. Used by
 * the course editor (launch date) and the class scheduler.
 */

/** ISO string → value for a datetime-local input, in the viewer's timezone. */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** datetime-local value → ISO string for the wire ("" stays ""). */
export function localInputToIso(local: string): string {
  if (!local) return ""
  const d = new Date(local)
  return Number.isNaN(d.getTime()) ? "" : d.toISOString()
}
```

   In `components/instructor/course-editor.tsx`:
   - delete these lines (73–88) together with the blank line after them:

```ts
/** ISO string → value for a datetime-local input, in the viewer's timezone. */
function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** datetime-local value → ISO string for the wire ("" stays ""). */
function localInputToIso(local: string): string {
  if (!local) return ""
  const d = new Date(local)
  return Number.isNaN(d.getTime()) ? "" : d.toISOString()
}
```

   - directly after `import { PACKAGE_KEYS, PACKAGE_LABEL } from "@/lib/entitlements"` add `import { isoToLocalInput, localInputToIso } from "@/lib/datetime-local"`. The two call sites (lines ~191 and ~314) don't change.

- [ ] **Step 2: Meeting types, host list, join refusal.** In `lib/actions/meetings.ts`:
  1. In `MeetingWithDetails`, replace

```ts
  createdAt: string
  startedAt?: string
  courseId?: string
```

   with

```ts
  createdAt: string
  startedAt?: string
  /** Scheduled classes and interviews: when it's due to start (ISO). */
  scheduledAt?: string
  courseId?: string
```

  2. In `joinMeeting`'s return type, replace

```ts
  requiresApproval?: boolean
  error?: string
}> {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const meeting = await Meeting.findById(meetingId)
```

   with

```ts
  requiresApproval?: boolean
  error?: string
  /** Sent with the not-started refusal so the client can show the start time in the viewer's timezone. */
  startsAt?: string
}> {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const meeting = await Meeting.findById(meetingId)
```

  3. Still in `joinMeeting`: directly above `    const userId = new Types.ObjectId(currentUser.id)` (the one followed by `const existingP = meeting.participants.find(`, right after the live-classes gate block), insert:

```ts
    // A class that hasn't started: only the host's join (above) starts it, so
    // nobody else sits in an unstarted room. Runs after the package gate, so a
    // student without live classes hears that first. Interviews (no courseId)
    // keep their waiting room.
    if (meeting.courseId && meeting.status === "scheduled") {
      return {
        success: false,
        error: "This class hasn't started yet",
        startsAt: meeting.scheduledAt?.toISOString(),
      }
    }

```

  4. In `getMyMeetings`' mapper, replace

```ts
          startedAt: m.startedAt?.toISOString(),
          participantAvatars,
```

   with

```ts
          startedAt: m.startedAt?.toISOString(),
          scheduledAt: m.scheduledAt?.toISOString(),
          participantAvatars,
```

- [ ] **Step 3: `createCourseMeeting`.** Replace the whole function (from `export async function createCourseMeeting(` through its closing `}` above `// ── Invite user by email ──`) with:

```ts
export async function createCourseMeeting(
  courseId: string,
  title: string,
  description?: string,
  /** A future start (ISO) schedules the class instead of starting it now. */
  scheduledAtISO?: string,
): Promise<{
  success: boolean
  meeting?: MeetingWithDetails
  /** Host token for a class that starts now. A scheduled class has none — the host joins at start time. */
  authToken?: string
  notifiedCount?: number
  error?: string
}> {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    // Scheduling: a real future time only — the interview scheduler's rule.
    let scheduledAt: Date | null = null
    if (scheduledAtISO) {
      scheduledAt = new Date(scheduledAtISO)
      if (Number.isNaN(scheduledAt.getTime())) return { success: false, error: "Invalid class time" }
      if (scheduledAt.getTime() <= Date.now() + 60_000) {
        return { success: false, error: "Class time must be in the future" }
      }
    }

    // Verify instructor owns this course
    const course = await Course.findOne({
      _id: courseId,
      instructor: new Types.ObjectId(currentUser.id),
      status: "published",
    }).lean()
    if (!course) return { success: false, error: "Course not found" }

    // Create the RTK room up front — for a scheduled class too, like interviews,
    // so the host's join at start time is instant (joinMeeting flips it live).
    const rtkMeetingId = await createRTKMeeting(`Meeting: ${title}`)
    const hostParticipant = await addParticipant(rtkMeetingId, {
      name: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
      customParticipantId: currentUser.id,
      presetName: "group_call_host",
    })

    // Create meeting record with course linkage
    const meeting = await Meeting.create({
      title,
      description,
      hostId: new Types.ObjectId(currentUser.id),
      status: scheduledAt ? "scheduled" : "active",
      meetingId: rtkMeetingId,
      hostToken: hostParticipant.authToken,
      courseId: new Types.ObjectId(courseId),
      courseThumbnailUrl: course.thumbnailUrl || undefined,
      ...(scheduledAt
        ? { scheduledAt, reminders: { h24SentAt: null, h1SentAt: null } }
        : { startedAt: new Date() }),
      participants: [
        {
          userId: new Types.ObjectId(currentUser.id),
          role: "host",
          status: "admitted",
          joinedAt: new Date(),
        },
      ],
      settings: {
        allowScreenShare: true,
        muteOnEntry: true,
        requireApproval: true,
        guestAccess: true,
        maxParticipants: 50,
      },
    })

    // Fire-and-forget: Notify all enrolled students via email
    const headersList = await headers()
    const host = headersList.get("host") || "academy.worldstreetgold.com"
    const protocol = headersList.get("x-forwarded-proto") || "https"
    const meetingLink = `${protocol}://${host}/dashboard/meetings?join=${meeting._id.toString()}`
    const hostName = `${currentUser.firstName} ${currentUser.lastName}`.trim()

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
            // Renders "Scheduled for …" instead of "Happening right now".
            scheduledAt: scheduledAt ? scheduledAt.toISOString() : undefined,
          })
        )
        await Promise.allSettled(emailPromises)
      })()
    )

    return {
      success: true,
      authToken: scheduledAt ? undefined : hostParticipant.authToken,
      notifiedCount: classEnrollments.length,
      meeting: {
        id: meeting._id.toString(),
        title: meeting.title,
        description: meeting.description,
        hostId: currentUser.id,
        hostName,
        hostAvatar: currentUser.avatarUrl,
        status: meeting.status,
        meetingId: rtkMeetingId,
        participantCount: 1,
        maxParticipants: 50,
        settings: serializeSettings(meeting.settings),
        createdAt: meeting.createdAt.toISOString(),
        startedAt: meeting.startedAt?.toISOString(),
        scheduledAt: meeting.scheduledAt?.toISOString(),
        courseId: courseId,
        courseThumbnailUrl: course.thumbnailUrl || undefined,
      },
    }
  } catch (error) {
    console.error("Error creating course meeting:", error)
    return { success: false, error: "Failed to create meeting" }
  }
}
```

- [ ] **Step 4: The modal.** In `components/meetings/instructor-meeting-extras.tsx`:
  - change the lucide import line to `import { CalendarClockIcon, ChevronLeftIcon, ChevronRightIcon, CircleCheckIcon, CopyIcon, LoaderCircleIcon, SearchIcon, UserIcon, UsersIcon, VideoIcon, XIcon } from "lucide-react"` (one icon added; if Phase 3 changed that line, add `CalendarClockIcon` to what's there);
  - directly under `import { RenderIcon } from "@/components/shared/render-icon"` add `import { isoToLocalInput, localInputToIso } from "@/lib/datetime-local"`;
  - replace the whole `CreateCourseMeetingModal` function (from `export function CreateCourseMeetingModal({` to the end of the file) with:

```tsx
export function CreateCourseMeetingModal({
  open,
  onOpenChange,
  course,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  course: CourseSummary | null
  /** `scheduledAtISO` set → schedule the class for later instead of starting it now. */
  onCreate: (courseId: string, title: string, scheduledAtISO?: string) => void
}) {
  const [title, setTitle] = useState(course ? `${course.title} — Session` : "")
  const [isCreating, setIsCreating] = useState(false)
  const [scheduleLater, setScheduleLater] = useState(false)
  const [scheduledLocal, setScheduledLocal] = useState("")
  const [minLocal, setMinLocal] = useState("")
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open && course) {
      setTimeout(() => {
        setTitle(`${course.title} — Session`)
        // Earliest pickable start, in the viewer's timezone.
        setMinLocal(isoToLocalInput(new Date(Date.now() + 5 * 60_000).toISOString()))
        inputRef.current?.focus()
      }, 100)
    }
  }, [open, course])

  function handleCreate() {
    if (!title.trim() || !course) return
    if (scheduleLater) {
      const iso = localInputToIso(scheduledLocal)
      if (!iso) {
        setScheduleError("Pick a date and time")
        return
      }
      if (new Date(iso).getTime() <= Date.now() + 60_000) {
        setScheduleError("Class time must be in the future")
        return
      }
      setScheduleError(null)
      onCreate(course.id, title.trim(), iso)
      return
    }
    setIsCreating(true)
    onCreate(course.id, title.trim())
    setIsCreating(false)
  }

  if (!course || !open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
      <div className="relative w-full max-w-md mx-4 bg-card border border-ws-hairline rounded-lg shadow-[var(--ws-shadow-sheet)] overflow-hidden animate-in fade-in-0 zoom-in-95 duration-[var(--ws-motion-base)]">
        {/* Thumbnail header */}
        {course.thumbnailUrl ? (
          <div className="relative h-36 bg-muted/30">
            <Image src={course.thumbnailUrl} alt={course.title} fill className="object-cover" />
            <div className="absolute inset-0 bg-black/30" />
            {/* Close button on thumbnail */}
            <button
              onClick={() => onOpenChange(false)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/30 flex items-center justify-center hover:bg-black/50 transition-colors"
            >
              <XIcon  size={14} className="text-white" />
            </button>
            {/* Floating course title over thumbnail */}
            <div className="absolute bottom-3 left-4 right-4">
              <p className="text-white/70 text-[10px] font-medium uppercase tracking-wider">New Session</p>
              <h3 className="text-white text-sm font-semibold truncate mt-0.5">{course.title}</h3>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between px-5 pt-5 pb-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center">
                <VideoIcon  size={18} className="text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">New Session</p>
                <h2 className="text-sm font-semibold text-foreground">{course.title}</h2>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted/80 transition-colors"
            >
              <XIcon  size={16} className="text-muted-foreground" />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="px-5 py-5 space-y-4">
          {/* Enrolled count badge */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30">
            <UsersIcon  size={14} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{course.enrolledCount}</span>{" "}
              student{course.enrolledCount !== 1 ? "s" : ""} will be notified via email
            </span>
          </div>

          {/* Session title input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">Session Title</label>
            <Input
              ref={inputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="e.g. Week 3 — Market Analysis"
              className="h-11 text-sm bg-muted/20 border-ws-hairline rounded-lg focus-visible:ring-1 focus-visible:ring-foreground/20"
            />
          </div>

          {/* Schedule for later (spec §12 Upcoming classes) */}
          <div className="space-y-2">
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ws-primary">
              <input
                type="checkbox"
                checked={scheduleLater}
                onChange={(e) => {
                  setScheduleLater(e.target.checked)
                  setScheduleError(null)
                }}
                className="h-4 w-4 accent-ws-brand"
              />
              <CalendarClockIcon size={14} className="text-ws-muted" aria-hidden />
              Schedule for later
            </label>
            {scheduleLater && (
              <div className="space-y-1.5">
                <Input
                  type="datetime-local"
                  aria-label="Class date and time"
                  value={scheduledLocal}
                  min={minLocal}
                  onChange={(e) => {
                    setScheduledLocal(e.target.value)
                    setScheduleError(null)
                  }}
                  className="h-11 text-sm bg-muted/20 border-ws-hairline rounded-lg"
                />
                <p className="text-[11px] text-ws-muted">
                  Students whose package includes live classes see it on their dashboard and get a reminder before it starts.
                </p>
                {scheduleError && <p className="text-xs text-ws-danger">{scheduleError}</p>}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => onOpenChange(false)}
              className="flex-1 h-11 rounded-lg text-sm font-medium text-muted-foreground border border-ws-hairline hover:bg-muted/40 transition-colors"
            >
              Cancel
            </button>
            <Button
              onClick={handleCreate}
              disabled={!title.trim() || isCreating || (scheduleLater && !scheduledLocal)}
              className="flex-1 gap-2 h-11 bg-foreground hover:bg-foreground/90 text-background text-sm font-medium rounded-lg"
            >
              {isCreating ? (
                <>
                  <LoaderCircleIcon  size={15} className="animate-spin" />
                  Starting...
                </>
              ) : scheduleLater ? (
                <>
                  <CalendarClockIcon size={15} />
                  Schedule class
                </>
              ) : (
                <>
                  <VideoIcon  size={15} />
                  Start Session
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Instructor page.** In `app/(instructor)/instructor/meetings/page.tsx`:
  1. Directly after `  const [selectedCourse, setSelectedCourse] = useState<CourseSummary | null>(null)` add:

```tsx
  const [scheduleNotice, setScheduleNotice] = useState<string | null>(null)
```

  2. Replace the whole `handleCreateCourseMeeting` function with:

```tsx
  async function handleCreateCourseMeeting(courseId: string, title: string, scheduledAtISO?: string) {
    setShowCourseMeetingModal(false)
    setSelectedCourse(null)

    if (scheduledAtISO) {
      // A scheduled class is a record + notifications — no RTK join until the
      // host starts it from Active Meetings (joinMeeting flips it live).
      setSetupMessage("Scheduling your class...")
      const result = await createCourseMeeting(courseId, title, undefined, scheduledAtISO)
      setSetupMessage(null)
      if (result.success && result.meeting?.scheduledAt) {
        queryClient.invalidateQueries({ queryKey: queryKeys.meetings })
        const when = new Date(result.meeting.scheduledAt).toLocaleString("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        })
        const count = result.notifiedCount ?? 0
        setScheduleNotice(
          `Class scheduled for ${when}. ${count} student${count === 1 ? "" : "s"} notified — start it from Active Meetings when it's time.`
        )
      } else {
        setScheduleNotice(result.error ?? "Couldn't schedule the class")
      }
      return
    }

    setSetupMessage("Setting up your live session...")
    playMeetingCreating()
    const result = await createCourseMeeting(courseId, title)
    if (result.success && result.meeting && result.authToken) {
      setActiveMeeting(result.meeting)
      setMyRole("host")
      setMeetingStartTime(
        result.meeting.startedAt ? new Date(result.meeting.startedAt) : new Date()
      )
      await joinRTKAndSetup(result.authToken)
    } else {
      setSetupMessage(null)
    }
  }
```

  3. Directly above `      <Topbar title="Meetings" variant="instructor" />` add:

```tsx
      {scheduleNotice && (
        <div
          role="status"
          className="fixed inset-x-4 top-4 z-50 mx-auto flex max-w-md items-start gap-3 rounded-lg border border-ws-hairline bg-ws-surface px-4 py-3 shadow-lg"
        >
          <p className="flex-1 text-sm text-ws-primary">{scheduleNotice}</p>
          <button
            type="button"
            onClick={() => setScheduleNotice(null)}
            className="text-xs font-medium text-ws-muted transition-colors hover:text-ws-primary"
          >
            Dismiss
          </button>
        </div>
      )}
```

- [ ] **Step 6: Host sees and starts the scheduled class.** In `components/meetings/meeting-lobby.tsx`, `ActiveMeetingsList`:
  1. Replace `        const isActive = meeting.status === "active"` with:

```tsx
        const isActive = meeting.status === "active"
        const isScheduled = meeting.status === "scheduled"
```

  2. Directly after the closing `)}` of the `{isActive && ( … Active … )}` chip (inside the `flex items-center gap-2` title row), add:

```tsx
                {isScheduled && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ws-chip px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-ws-muted">
                    <CalendarDaysIcon size={10} aria-hidden />
                    {meeting.scheduledAt
                      ? new Date(meeting.scheduledAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
                      : "Scheduled"}
                  </span>
                )}
```

  3. Replace

```tsx
            <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex items-center gap-1 text-[11px] font-medium text-foreground">
                Rejoin
```

   with

```tsx
            <div className={cn("shrink-0 transition-opacity", isScheduled && isHostMe ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
              <div className="flex items-center gap-1 text-[11px] font-medium text-foreground">
                {isScheduled && isHostMe ? "Start" : "Rejoin"}
```

   (`cn` and `CalendarDaysIcon` are already imported in this file.)

- [ ] **Step 7: The student's refusal names the local start time.** In `app/(platform)/dashboard/meetings/page.tsx`:
  1. Replace

```tsx
type ScreenSharer = { id: string; name: string; isLocal: boolean }

export default function MeetingsPage() {
```

   with

```tsx
type ScreenSharer = { id: string; name: string; isLocal: boolean }

/** A class that hasn't started names its start time in the viewer's timezone. */
function joinErrorMessage(result: { error?: string; startsAt?: string }): string {
  if (result.startsAt) {
    const when = new Date(result.startsAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
    return `This class hasn't started yet — it begins ${when}`
  }
  return result.error ?? "Couldn't join this meeting"
}

export default function MeetingsPage() {
```

  2. Replace **both** occurrences (in `handleJoinByLink` and `handleRejoin`) of `setJoinError(result.error ?? "Couldn't join this meeting")` with `setJoinError(joinErrorMessage(result))`.

- [ ] **Step 8: Verify.** tsc; `npx eslint lib/datetime-local.ts components/instructor/course-editor.tsx lib/actions/meetings.ts components/meetings/instructor-meeting-extras.tsx "app/(instructor)/instructor/meetings/page.tsx" components/meetings/meeting-lobby.tsx "app/(platform)/dashboard/meetings/page.tsx"`. `IP="/instructor/meetings"`, `MP="/dashboard/meetings"`.
  1. Validation, before RTK (instructor):
     - `bash "$H/action.sh" "$IP" createCourseMeeting "[\"$F\",\"Past class\",null,\"2020-01-01T10:00:00.000Z\"]" instructor` → `{"success":false,"error":"Class time must be in the future"}`.
     - `…"[\"$F\",\"Bad\",null,\"not-a-date\"]" instructor` → `Invalid class time`.
     - `SOON=$(node -e 'console.log(new Date(Date.now()+30e3).toISOString())')`, then `…"[\"$F\",\"Too soon\",null,\"$SOON\"]" instructor` → `Class time must be in the future`.
  2. Valid future time: `LATER=$(node -e 'console.log(new Date(Date.now()+7200e3).toISOString())')`, then `…"[\"$F\",\"Week 1 live class\",null,\"$LATER\"]" instructor` → `{"success":false,"error":"Failed to create meeting"}` (RealtimeKit isn't configured in dev:mock; it reached the RTK call). `node "$H/mockdb.cjs" meetings` prints nothing (no half-written meeting). The two-argument call `"[\"$F\",\"Live now\"]"` gives the same RTK failure (unchanged).
  3. Not-started refusal:
     - `node "$H/mockdb.cjs" fixture standard` (N) and `node "$H/mockdb.cjs" scheduled-class-fixture $F 90` (M).
     - `bash "$H/action.sh" "$MP" joinMeeting "[\"M\"]"` → `{"success":false,"error":"This class hasn't started yet","startsAt":"<≈ now + 90 min>"}`.
     - As admin → the same refusal.
     - `node "$H/mockdb.cjs" set-package N basic` → as student → `Live classes aren't included in your package` (gate first). `set-package N standard` afterwards.
  4. The host's list and start:
     - `bash "$H/action.sh" "$IP" getMyMeetings '[]' instructor` → M with `"status":"scheduled"` and `scheduledAt` set.
     - `bash "$H/action.sh" "$IP" joinMeeting "[\"M\"]" instructor` → `success: true`, `role: "host"`, `meeting.status: "active"`.
     - `meetings` → M `status=active` with a `startedAt`.
     - The student's `joinMeeting ["M"]` now gets past both checks and fails at RTK: `Failed to join meeting`, **not** the not-started message.
  5. Course editor unchanged: `curl -s -b mock_persona=admin "http://localhost:3001/admin/courses/$F/edit" | grep -o 'datetime-local' | wc -l` ≥ 1, and the page renders (no error overlay text `Unhandled Runtime Error`). Do **not** POST the editor.
  6. **(controller)** Browser:
     - Instructor persona, `$B viewport 400x800`, `/instructor/meetings`: tap a course card's "Start Call", then tick "Schedule for later" → a date-time field appears. The button reads `Schedule class` and is disabled until a time is picked. `$B js "document.body.scrollWidth + '/' + window.innerWidth"` → `400/400`. Save `"$P4/t3-schedule-modal-400.png"`.
     - Run `node "$H/mockdb.cjs" scheduled-class-fixture $F 45` (M2); `/instructor/meetings` Active Meetings shows `Fixture scheduled class` with a date chip and a visible `Start`.
     - Student persona: `$B goto "http://localhost:3001/dashboard/meetings?join=M2"` → the alert reads `This class hasn't started yet — it begins <local date, time>`. Save `"$P4/t3-not-started-400.png"`.
  7. End: `node "$H/mockdb.cjs" restore`.

- [ ] **Step 9: Commit.**

```bash
git add lib/datetime-local.ts components/instructor/course-editor.tsx lib/actions/meetings.ts components/meetings/instructor-meeting-extras.tsx "app/(instructor)/instructor/meetings/page.tsx" components/meetings/meeting-lobby.tsx "app/(platform)/dashboard/meetings/page.tsx"
git commit -m "feat(meetings): instructors schedule course classes; students can't enter before the host starts

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Class reminders — the cron reaches students with live classes, in class wording

> **Controller first:** Controller setup step 3 (restart with `CRON_SECRET=phase4-cron-secret`). If the step-6.0 probe answers 401, report **BLOCKED**.

**Files:**
- Modify: `lib/email.tsx` (add `sendClassReminderEmail` directly after `sendInterviewReminderEmail`)
- Modify: `app/api/cron/reminders/route.ts` (whole file)

**Interfaces:**
- Consumes:
  - `entitlementsFor` (`lib/entitlements.ts`);
  - `notifyUser` (`lib/notify.ts`, type `"meeting"`);
  - `SimplePipelineEmail`, `resend`, `FROM_EMAIL` (module-private in `lib/email.tsx`);
  - scheduled course meetings from Task 3 (or `scheduled-class-fixture`).
- Produces:
  - `sendClassReminderEmail(to: string, data: { recipientName: string; classTitle: string; courseTitle: string | null; hostName: string; isHost: boolean; scheduledAt: string; joinUrl: string; window: "24h" | "1h" }): Promise<{ success: boolean; error?: string }>`
  - The cron response shape is unchanged: `{ ok, upcoming, sent24, sent1 }`.

- [ ] **Step 1: Class-worded email.** In `lib/email.tsx`, directly after the closing `}` of `sendInterviewReminderEmail`, add:

```tsx
/** T-24h / T-1h course class reminder (sent by the cron route) — class wording for the host and students. */
export async function sendClassReminderEmail(
  to: string,
  data: {
    recipientName: string
    classTitle: string
    courseTitle: string | null
    hostName: string
    /** The recipient is the instructor running the class. */
    isHost: boolean
    scheduledAt: string
    joinUrl: string
    window: "24h" | "1h"
  }
) {
  const when = new Date(data.scheduledAt).toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "short",
  })
  const what = data.courseTitle ? `${data.classTitle} (${data.courseTitle})` : data.classTitle
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject:
        data.window === "1h"
          ? "Your class starts in about an hour"
          : "Reminder: your class is coming up",
      react: React.createElement(SimplePipelineEmail, {
        preview: `${data.classTitle} — ${when}`,
        title: data.window === "1h" ? "Class starting soon" : "Class coming up",
        bodyText: data.isHost
          ? `${data.recipientName}, you're hosting ${what}, scheduled for ${when}. Open it from Meetings to start the class — students can join once you're in.`
          : `${data.recipientName}, ${what} with ${data.hostName} is scheduled for ${when}. You can join as soon as your instructor starts the class.`,
        ctaLabel: data.isHost ? "Open class" : "View class",
        ctaUrl: data.joinUrl,
        avatarName: data.recipientName,
      }),
    })
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err) {
    console.error("[Email] Class reminder error:", err)
    return { success: false, error: "Failed to send email" }
  }
}
```

- [ ] **Step 2: The cron.** Replace the whole of `app/api/cron/reminders/route.ts` with:

```ts
import { NextRequest, NextResponse } from "next/server"
import connectDB from "@/lib/db"
import { Course, Enrollment, Meeting, User } from "@/lib/db/models"
import { notifyUser } from "@/lib/notify"
import { sendClassReminderEmail, sendInterviewReminderEmail } from "@/lib/email"
import { entitlementsFor } from "@/lib/entitlements"
import { APP_URL } from "@/lib/app-url"


/**
 * Scheduled-meeting reminders — T-24h and T-1h. Idempotent via the per-meeting
 * `reminders` ledger.
 *
 * - Course classes (meeting.courseId): the host, invitees, and every student
 *   whose active/completed enrollment's package includes live classes — the
 *   same audience that may join (joinMeeting) — with class wording.
 * - Every other scheduled meeting (instructor interviews): host + invitees,
 *   interview wording, exactly as before.
 *
 * Coolify scheduled task (~every 10 min):
 *   curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *     https://academy.worldstreetgold.com/api/cron/reminders
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get("authorization") ?? ""
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  await connectDB()
  const now = Date.now()

  const upcoming = await Meeting.find({
    status: "scheduled",
    scheduledAt: { $gt: new Date(now), $lte: new Date(now + 24 * 3600 * 1000) },
  }).limit(100)

  let sent24 = 0
  let sent1 = 0

  for (const meeting of upcoming) {
    if (!meeting.scheduledAt) continue
    const msLeft = meeting.scheduledAt.getTime() - now
    const window: "24h" | "1h" | null =
      msLeft <= 3600 * 1000 && !meeting.reminders?.h1SentAt
        ? "1h"
        : msLeft <= 24 * 3600 * 1000 && !meeting.reminders?.h24SentAt
          ? "24h"
          : null
    if (!window) continue

    const joinPath = `/dashboard/meetings?join=${meeting._id.toString()}`
    const when = meeting.scheduledAt

    const host = await User.findById(meeting.hostId).select("firstName lastName email").lean()
    const hostName = host ? `${host.firstName ?? ""} ${host.lastName ?? ""}`.trim() : "Host"
    const inviteeIds = (meeting.invites ?? [])
      .filter((i) => i.userId)
      .map((i) => i.userId!.toString())

    const title =
      window === "1h" ? "Starting in ~1 hour" : "Reminder: scheduled for tomorrow"
    const bodyLine = `${meeting.title} — ${when.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`

    const jobs: Promise<unknown>[] = []

    if (meeting.courseId) {
      // Course class: host + invitees + students whose package includes live classes.
      const [course, enrollments] = await Promise.all([
        Course.findById(meeting.courseId).select("title packages").lean(),
        Enrollment.find({ course: meeting.courseId, status: { $in: ["active", "completed"] } })
          .select("user packageKey")
          .lean(),
      ])
      const studentIds = course
        ? enrollments.filter((e) => entitlementsFor(course, e).liveClasses).map((e) => e.user.toString())
        : []
      const hostId = meeting.hostId.toString()
      const recipientIds = [...new Set([hostId, ...inviteeIds, ...studentIds])]
      const recipients = await User.find({ _id: { $in: recipientIds } }).select("firstName email").lean()

      for (const recipient of recipients) {
        const recipientId = recipient._id.toString()
        jobs.push(notifyUser(recipientId, { type: "meeting", title, body: bodyLine, href: joinPath }))
        if (recipient.email && !recipient.email.endsWith("@users.noemail")) {
          jobs.push(
            sendClassReminderEmail(recipient.email, {
              recipientName: recipient.firstName || "there",
              classTitle: meeting.title,
              courseTitle: course?.title ?? null,
              hostName,
              isHost: recipientId === hostId,
              scheduledAt: when.toISOString(),
              joinUrl: `${APP_URL}${joinPath}`,
              window,
            })
          )
        }
      }
    } else {
      // Interview (or any other scheduled meeting): host + everyone invited.
      const invitees = inviteeIds.length
        ? await User.find({ _id: { $in: inviteeIds } }).select("firstName lastName email").lean()
        : []

      // Host bell (+ email for interview meetings)
      jobs.push(notifyUser(meeting.hostId.toString(), { type: "meeting", title, body: bodyLine, href: joinPath }))
      if (host?.email && !host.email.endsWith("@users.noemail")) {
        jobs.push(
          sendInterviewReminderEmail(host.email, {
            recipientName: host.firstName || "there",
            counterpartName: invitees[0]
              ? `${invitees[0].firstName ?? ""} ${invitees[0].lastName ?? ""}`.trim()
              : "your participant",
            scheduledAt: when.toISOString(),
            joinUrl: `${APP_URL}${joinPath}`,
            window,
          })
        )
      }
      // Invitees
      for (const inv of invitees) {
        jobs.push(notifyUser(inv._id.toString(), { type: "meeting", title, body: bodyLine, href: joinPath }))
        if (inv.email && !inv.email.endsWith("@users.noemail")) {
          jobs.push(
            sendInterviewReminderEmail(inv.email, {
              recipientName: inv.firstName || "there",
              counterpartName: hostName,
              scheduledAt: when.toISOString(),
              joinUrl: `${APP_URL}${joinPath}`,
              window,
            })
          )
        }
      }
    }

    await Promise.allSettled(jobs)

    // Mark the ledger AFTER sending — a crash mid-send re-sends rather than skips.
    await Meeting.updateOne(
      { _id: meeting._id },
      { $set: window === "1h" ? { "reminders.h1SentAt": new Date() } : { "reminders.h24SentAt": new Date() } }
    )
    if (window === "1h") sent1++
    else sent24++
  }

  return NextResponse.json({ ok: true, upcoming: upcoming.length, sent24, sent1 })
}
```

   (The interview branch is the previous loop body, moved inside `else` with no behaviour change.)

- [ ] **Step 3: Verify.** tsc; `npx eslint lib/email.tsx app/api/cron/reminders/route.ts`. Define:

```bash
cron() { curl -s -X POST -H "Authorization: Bearer phase4-cron-secret" http://localhost:3001/api/cron/reminders; echo; }
```

  0. Probe: `cron` → `{"ok":true,"upcoming":0,"sent24":0,"sent1":0}`. Also `curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3001/api/cron/reminders` → `401`.
  1. Basic students aren't reminded:
     - `node "$H/mockdb.cjs" fixture basic` (N) and `node "$H/mockdb.cjs" scheduled-class-fixture $F 30` (M1).
     - `cron` → `{"ok":true,"upcoming":1,"sent24":0,"sent1":1}`.
     - `node "$H/mockdb.cjs" notifications 10` → exactly one row: `to=6a6fc0ba6433bbbd6322bdfd type=meeting "Starting in ~1 hour" "Fixture scheduled class — …" href=/dashboard/meetings?join=M1`. None to the student.
     - `meetings` → M1 `h1=sent`.
  2. Live-class students are reminded:
     - `node "$H/mockdb.cjs" set-package N standard` and `node "$H/mockdb.cjs" scheduled-class-fixture $F 45` (M2).
     - `cron` → `upcoming:2, sent24:0, sent1:1` (M1 is already on the ledger).
     - `notifications 10` → M2's `Starting in ~1 hour` to **both** `6a6fc0ba6433bbbd6322bdfd` and `6a6fc0bb6433bbbd6322be61`.
  3. Legacy access, 24 h window:
     - `node "$H/mockdb.cjs" scheduled-class-fixture $BTC 600` (M3).
     - `cron` → `upcoming:3, sent24:1, sent1:0`.
     - `notifications 10` → `Reminder: scheduled for tomorrow` for M3 to the instructor and the student (legacy Bitcoin enrollment).
  4. Idempotent: `cron` again → `upcoming:3, sent24:0, sent1:0`, and no new notification rows.
  5. Interview path unchanged:
     - `node "$H/mockdb.cjs" scheduled-class-fixture none 50` (M4, student invited, no course).
     - `cron` → `sent1:1`.
     - `notifications 10` → M4's `Starting in ~1 hour` to the instructor and the student, href `/dashboard/meetings?join=M4`.
     - Emails are no-ops in mock; the interview branch's wording is unchanged code.
  6. End: `node "$H/mockdb.cjs" restore`.

- [ ] **Step 4: Commit.**

```bash
git add lib/email.tsx app/api/cron/reminders/route.ts
git commit -m "feat(meetings): class reminders reach every student whose package includes live classes

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Dashboard home — welcome band, Continue learning, §12 tiles, priority mail

**Files:**
- Modify: `lib/dashboard-home.ts` (one import; append selectors)
- Modify: `lib/hooks/queries/keys.ts` (new key only)
- Create: `lib/hooks/queries/use-certificates.ts`
- Modify: `lib/hooks/queries/index.ts`
- Modify: `app/(platform)/dashboard/instructor/[instructorId]/message-instructor-button.tsx` (whole file — optional `label`/`variant`)
- Create: `components/dashboard/home-tiles.tsx`
- Modify: `app/(platform)/dashboard/page.tsx` (whole file)
- Modify: `app/(platform)/dashboard/help/page.tsx` (imports; async + priority mailto; the FAQ's stale "My Courses" copy)

**Interfaces:**
- Consumes:
  - `StudentEnrollment` + `grantsAccess`, `enrollmentHref` (Task 1);
  - `EnrollmentCard` (Task 1);
  - `useUpcomingClasses` (Task 2);
  - `fetchMyCertificates(): Promise<StudentCertificate[]>` (`{ id, courseId, courseTitle, courseThumbnail, instructorName, instructorAvatarUrl, completedAt }`, newest first, already entitlement-filtered);
  - `MessageInstructorButton`; `BRAND`.
- Produces:
  - `lib/dashboard-home.ts`:
    - `pickResume(list): StudentEnrollment | null`
    - `pickCurrent(list): StudentEnrollment | null`
    - `hasPrioritySupport(list): boolean`
    - `isMentorEnrollment(e): boolean`
    - `type InstructorRow = { instructorId: string; name: string; avatarUrl: string | null; headline: string | null; canMessage: boolean; isMentor: boolean }`
    - `instructorRows(list): InstructorRow[]`
    - `includesAny(list, flag: keyof IPackageEntitlements): boolean`
    - `formatDateTime(iso: string): string`
  - `queryKeys.certificates = ["certificates"]`; `useMyCertificates()`.
  - `MessageInstructorButton({ instructorId, label?: string = "Message Instructor", variant?: "default" | "outline" = "default" })`.
  - `components/dashboard/home-tiles.tsx` exports:
    - `DashboardTile({ icon: LucideIcon; title: string; action?: { label: string; href: string }; children })` (Task 6 uses it)
    - `CurrentCourseTile`, `ProgressTile`, `UpcomingClassesTile`, `CertificatesTile`, `InstructorsTile`, `CommunityTile`, `SupportTile`.
  - Dashboard page: the tile grid contains the exact line `            {showUpcomingClasses && <UpcomingClassesTile />}`, and the page imports `EnrollmentCard` on its own line. Task 6 anchors on both.

- [ ] **Step 1: Dashboard selectors.** In `lib/dashboard-home.ts`:
  - directly under `import type { StudentEnrollment } from "@/lib/actions/student"` add `import type { IPackageEntitlements } from "@/lib/db/models"`;
  - append to the end of the file:

```ts
/**
 * Newest first by `lastAccessedAt` — the ordering the sidebar's "Continue
 * learning" row uses. Never-opened rows serialize as "now", so a fresh purchase leads.
 */
function byRecentAccess(a: StudentEnrollment, b: StudentEnrollment): number {
  return new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime()
}

/** Continue learning → the most recently accessed active or completed enrollment. */
export function pickResume(enrollments: StudentEnrollment[]): StudentEnrollment | null {
  return [...enrollments].filter(grantsAccess).sort(byRecentAccess)[0] ?? null
}

/** Current course → the most recently accessed active enrollment. */
export function pickCurrent(enrollments: StudentEnrollment[]): StudentEnrollment | null {
  return [...enrollments].filter((e) => e.status === "active").sort(byRecentAccess)[0] ?? null
}

/** "Priority support" — only a package actually bought with it, on an enrollment that still grants access. */
export function hasPrioritySupport(enrollments: StudentEnrollment[]): boolean {
  return enrollments.some((e) => grantsAccess(e) && e.explicitPackage && e.entitlements.prioritySupport)
}

/** "Your mentor" — an Executive package with mentorship. Single "Full program" tiers also carry mentorship and never qualify. */
export function isMentorEnrollment(enrollment: StudentEnrollment): boolean {
  return (
    grantsAccess(enrollment) &&
    enrollment.explicitPackage &&
    enrollment.packageKey === "executive" &&
    enrollment.entitlements.mentorship
  )
}

export type InstructorRow = {
  instructorId: string
  name: string
  avatarUrl: string | null
  headline: string | null
  /** Some access-granting enrollment with this instructor includes Q&A — the getOrCreateConversation gate. */
  canMessage: boolean
  isMentor: boolean
}

/** One row per distinct instructor across the student's access-granting enrollments. */
export function instructorRows(enrollments: StudentEnrollment[]): InstructorRow[] {
  const rows = new Map<string, InstructorRow>()
  for (const e of enrollments) {
    if (!grantsAccess(e)) continue
    const row = rows.get(e.instructorId) ?? {
      instructorId: e.instructorId,
      name: e.instructorName,
      avatarUrl: e.instructorAvatarUrl,
      headline: e.instructorHeadline,
      canMessage: false,
      isMentor: false,
    }
    row.canMessage = row.canMessage || e.entitlements.instructorQa
    row.isMentor = row.isMentor || isMentorEnrollment(e)
    rows.set(e.instructorId, row)
  }
  return [...rows.values()]
}

/** Whether any access-granting enrollment's package includes `flag` — tiles that can't be backed stay hidden. */
export function includesAny(enrollments: StudentEnrollment[], flag: keyof IPackageEntitlements): boolean {
  return enrollments.some((e) => grantsAccess(e) && e.entitlements[flag])
}

/** The codebase's date + time format. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
}
```

- [ ] **Step 2: Certificates hook.**
  - `lib/hooks/queries/keys.ts`: directly after `  bookmarks: ["bookmarks"] as const,` add `  certificates: ["certificates"] as const,`.
  - Create `lib/hooks/queries/use-certificates.ts`:

```ts
"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchMyCertificates, type StudentCertificate } from "@/lib/actions/certificates"
import { queryKeys } from "./keys"

export function useMyCertificates() {
  return useQuery<StudentCertificate[]>({
    queryKey: queryKeys.certificates,
    queryFn: () => fetchMyCertificates(),
    staleTime: 5 * 60 * 1000,
  })
}
```

  - `lib/hooks/queries/index.ts`: append `export { useMyCertificates } from "./use-certificates"`.

- [ ] **Step 3: Message button options.** Replace the whole of `app/(platform)/dashboard/instructor/[instructorId]/message-instructor-button.tsx` with:

```tsx
"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { getOrCreateConversation } from "@/lib/actions/messages"
import { MessageSquareIcon } from "lucide-react"

interface MessageInstructorButtonProps {
  instructorId: string
  /** Button text — the dashboard says "Message" or "Message your mentor". */
  label?: string
  /** "outline" where a gold button would compete with the page's primary CTA. */
  variant?: "default" | "outline"
}

export function MessageInstructorButton({
  instructorId,
  label = "Message Instructor",
  variant = "default",
}: MessageInstructorButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant={variant}
        size="sm"
        className="gap-1.5"
        onClick={handleMessage}
        disabled={isPending}
      >
        <MessageSquareIcon  size={14} />
        {isPending ? "Opening..." : label}
      </Button>
      {error && <p className="text-[11px] text-ws-danger">{error}</p>}
    </div>
  )
}
```

   (Existing callers pass only `instructorId`, so they render exactly as before.)

- [ ] **Step 4: Tiles.** Create `components/dashboard/home-tiles.tsx`:

```tsx
"use client"

import * as React from "react"
import Link from "next/link"
import {
  CalendarClockIcon,
  CircleHelpIcon,
  ExternalLinkIcon,
  PlayIcon,
  ShieldCheckIcon,
  TrendingUpIcon,
  TrophyIcon,
  UserRoundIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MessageInstructorButton } from "@/app/(platform)/dashboard/instructor/[instructorId]/message-instructor-button"
import type { StudentEnrollment } from "@/lib/actions/student"
import { enrollmentHref, formatDateTime, type InstructorRow } from "@/lib/dashboard-home"
import { useMyCertificates, useUpcomingClasses } from "@/lib/hooks/queries"

/* Spec §12 dashboard tiles. Surface cards separated by fill (no borders), 13px
   corners, a neutral icon badge — gold stays with the page's Continue learning CTA. */

export function DashboardTile({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: LucideIcon
  title: string
  action?: { label: string; href: string }
  children: React.ReactNode
}) {
  return (
    <section className="flex min-w-0 flex-col rounded-lg bg-ws-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2 font-display text-[15px] font-semibold text-ws-primary">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ws-raised">
            <Icon size={14} className="text-ws-muted" aria-hidden />
          </span>
          <span className="truncate">{title}</span>
        </h2>
        {action && (
          <Link
            href={action.href}
            className="shrink-0 text-[13px] font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary"
          >
            {action.label}
          </Link>
        )}
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </section>
  )
}

function TileSkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-4 w-3/4 animate-pulse rounded-xs bg-ws-raised" />
      <div className="h-3 w-1/2 animate-pulse rounded-xs bg-ws-raised" />
    </div>
  )
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

/** CURRENT COURSE — the most recently accessed active enrollment. */
export function CurrentCourseTile({
  enrollment,
  isLoading,
}: {
  enrollment: StudentEnrollment | null
  isLoading: boolean
}) {
  return (
    <DashboardTile icon={PlayIcon} title="Current course">
      {isLoading ? (
        <TileSkeleton />
      ) : enrollment ? (
        <Link href={enrollmentHref(enrollment)} className="flex flex-1 flex-col">
          <p className="line-clamp-2 text-[15px] font-semibold text-ws-primary">{enrollment.courseTitle}</p>
          {enrollment.resumeLessonTitle && (
            <p className="mt-1 truncate text-[13px] text-ws-muted">
              <span className="text-ws-subtle">Resume</span> · {enrollment.resumeLessonTitle}
            </p>
          )}
          <div className="mt-auto pt-4">
            <div className="h-1 w-full overflow-hidden rounded-full bg-ws-track">
              <div
                className="h-full rounded-full bg-ws-brand"
                style={{ width: `${Math.max(enrollment.progress, 2)}%` }}
              />
            </div>
            <p className="mt-2 text-[13px] tabular-nums text-ws-muted">{enrollment.progress}% complete</p>
          </div>
        </Link>
      ) : (
        <p className="text-[13px] text-ws-muted">Nothing in progress right now.</p>
      )}
    </DashboardTile>
  )
}

/** MY PROGRESS — the former greeting-pane tally, over the lessons each package opens. */
export function ProgressTile({
  enrollments,
  isLoading,
}: {
  enrollments: StudentEnrollment[]
  isLoading: boolean
}) {
  const totalLessons = enrollments.reduce((s, e) => s + e.openLessons, 0)
  const completedLessons = enrollments.reduce(
    (s, e) => s + Math.round(((e.progress ?? 0) / 100) * e.openLessons),
    0
  )
  const overallPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0
  const inProgress = enrollments.filter((e) => e.progress > 0 && e.progress < 100).length
  const completedCourses = enrollments.filter((e) => e.progress === 100).length

  return (
    <DashboardTile icon={TrendingUpIcon} title="My progress">
      {isLoading ? (
        <TileSkeleton />
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ws-muted">Overall progress</p>
            <p className="text-[13px] tabular-nums text-ws-muted">
              {totalLessons > 0 ? (
                <>
                  <span className="font-semibold text-ws-primary">{completedLessons}</span>/{totalLessons} lessons
                </>
              ) : (
                "No lessons yet"
              )}
            </p>
          </div>

          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-ws-track">
            <div
              className="h-full rounded-full bg-ws-brand"
              style={{ width: `${Math.max(overallPct, totalLessons > 0 ? 2 : 0)}%` }}
            />
          </div>

          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="tabular-nums">
              <span className="font-display text-xl font-semibold text-ws-primary">{overallPct}%</span>{" "}
              <span className="text-[13px] text-ws-muted">complete</span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-ws-chip px-2.5 py-1 text-[11px] font-medium text-ws-muted">
                <span className="font-semibold tabular-nums text-ws-primary">{inProgress}</span> in progress
              </span>
              <span className="rounded-full bg-ws-chip px-2.5 py-1 text-[11px] font-medium text-ws-muted">
                <span className="font-semibold tabular-nums text-ws-primary">{completedCourses}</span> completed
              </span>
            </div>
          </div>
        </>
      )}
    </DashboardTile>
  )
}

/** UPCOMING CLASSES — rendered only when some package includes live classes. */
export function UpcomingClassesTile() {
  const { data: classes = [], isLoading } = useUpcomingClasses()
  return (
    <DashboardTile
      icon={CalendarClockIcon}
      title="Upcoming classes"
      action={classes.length > 0 ? { label: "Meetings", href: "/dashboard/meetings" } : undefined}
    >
      {isLoading ? (
        <TileSkeleton />
      ) : classes.length === 0 ? (
        <p className="text-[13px] text-ws-muted">No classes scheduled — your instructor will post them here.</p>
      ) : (
        <ul className="space-y-3">
          {classes.slice(0, 3).map((c) => (
            <li key={c.id}>
              <Link href={c.joinHref} className="block min-w-0">
                <p className="truncate text-[13px] font-medium text-ws-primary">{c.title}</p>
                <p className="truncate text-[11px] text-ws-muted">
                  <span className="tabular-nums">{formatDateTime(c.scheduledAt)}</span>
                  {c.courseTitle ? ` · ${c.courseTitle}` : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardTile>
  )
}

/** CERTIFICATES — count + latest; rendered only when some package includes a certificate. */
export function CertificatesTile() {
  const { data: certificates = [], isLoading } = useMyCertificates()
  const latest = certificates[0]
  return (
    <DashboardTile icon={TrophyIcon} title="Certificates" action={{ label: "View all", href: "/dashboard/certificates" }}>
      {isLoading ? (
        <TileSkeleton />
      ) : (
        <>
          <p className="font-display text-3xl font-light tabular-nums text-ws-primary">
            {certificates.length}
            <span className="ml-2 font-sans text-[13px] font-normal text-ws-muted">earned</span>
          </p>
          <p className="mt-2 text-[13px] text-ws-muted">
            {latest ? (
              <>
                Latest: <span className="text-ws-primary">{latest.courseTitle}</span> ·{" "}
                <span className="tabular-nums">
                  {new Date(latest.completedAt).toLocaleDateString("en-US", { dateStyle: "medium" })}
                </span>
              </>
            ) : (
              "Finish a program to earn your first certificate."
            )}
          </p>
        </>
      )}
    </DashboardTile>
  )
}

/** INSTRUCTOR / MENTOR — one row per instructor; Message only where the package includes Q&A. */
export function InstructorsTile({ rows }: { rows: InstructorRow[] }) {
  return (
    <DashboardTile icon={UserRoundIcon} title="Instructor / Mentor">
      <ul className="space-y-4">
        {rows.map((row) => (
          <li key={row.instructorId} className="flex flex-wrap items-center gap-3">
            <Avatar className="h-10 w-10 shrink-0">
              {row.avatarUrl && <AvatarImage src={row.avatarUrl} alt={row.name} />}
              <AvatarFallback>{initials(row.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <Link
                  href={`/dashboard/instructor/${row.instructorId}`}
                  className="truncate text-sm font-semibold text-ws-primary hover:underline"
                >
                  {row.name}
                </Link>
                {row.isMentor && (
                  <span className="shrink-0 rounded-full bg-ws-chip px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-ws-muted">
                    Your mentor
                  </span>
                )}
              </div>
              {row.headline && <p className="truncate text-xs text-ws-muted">{row.headline}</p>}
            </div>
            <div className="ml-auto">
              {row.canMessage ? (
                <MessageInstructorButton
                  instructorId={row.instructorId}
                  label={row.isMentor ? "Message your mentor" : "Message"}
                  variant="outline"
                />
              ) : (
                <p className="max-w-40 text-right text-[11px] leading-snug text-ws-muted">
                  Instructor Q&amp;A isn&apos;t in your package
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </DashboardTile>
  )
}

/** Inlined at build time; unset or blank hides the tile (D6). */
const COMMUNITY_URL = process.env.NEXT_PUBLIC_COMMUNITY_URL?.trim() || null

/** COMMUNITY — an external link, hidden when NEXT_PUBLIC_COMMUNITY_URL is unset. */
export function CommunityTile() {
  if (!COMMUNITY_URL) return null
  return (
    <DashboardTile icon={UsersIcon} title="Community">
      <p className="text-[13px] text-ws-muted">Connect with other WorldStreet learners.</p>
      <a
        href={COMMUNITY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-auto inline-flex items-center gap-1.5 pt-4 text-[13px] font-medium text-ws-primary transition-opacity hover:opacity-80"
      >
        Join the community
        <ExternalLinkIcon size={13} aria-hidden />
      </a>
    </DashboardTile>
  )
}

/** SUPPORT — the help page; "Priority support" only for a package bought with it. */
export function SupportTile({ priority }: { priority: boolean }) {
  return (
    <DashboardTile icon={CircleHelpIcon} title="Support">
      {priority && (
        <span className="mb-2 inline-flex items-center gap-1 self-start rounded-full bg-ws-chip px-2 py-0.5 text-[11px] font-semibold text-ws-primary">
          <ShieldCheckIcon size={12} aria-hidden />
          Priority support
        </span>
      )}
      <p className="text-[13px] text-ws-muted">Answers to common questions, and real people when you need them.</p>
      <Link
        href="/dashboard/help"
        className="mt-auto inline-flex items-center gap-1.5 pt-4 text-[13px] font-medium text-ws-primary transition-opacity hover:opacity-80"
      >
        Get help
      </Link>
    </DashboardTile>
  )
}
```

- [ ] **Step 5: The page.** Replace the whole of `app/(platform)/dashboard/page.tsx` with:

```tsx
"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { Topbar } from "@/components/platform/topbar"
import { CourseCard, CourseCardSkeleton } from "@/components/platform/course-card"
import { EnrollmentCard } from "@/components/platform/enrollment-card"
import { Mascot } from "@/components/platform/mascot"
import { Button } from "@/components/ui/button"
import {
  CertificatesTile,
  CommunityTile,
  CurrentCourseTile,
  InstructorsTile,
  ProgressTile,
  SupportTile,
  UpcomingClassesTile,
} from "@/components/dashboard/home-tiles"
import { BRAND } from "@/lib/brand"
import {
  enrollmentHref,
  hasPrioritySupport,
  includesAny,
  instructorRows,
  pickCurrent,
  pickResume,
} from "@/lib/dashboard-home"
import {
  useEnrollments,
  useBookmarks,
  useBookmarkedIds,
  useBrowseCourses,
  useToggleBookmark,
} from "@/lib/hooks/queries"
import { useUser } from "@/components/providers/user-provider"

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

/**
 * Section header — title left, a quiet "See all" right. Gold on this page
 * belongs to the Continue learning CTA alone.
 */
function SectionHeader({
  title,
  href,
  linkLabel = "See all",
}: {
  title: string
  href?: string
  linkLabel?: string
}) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-4">
      <h2 className="font-display text-xl font-semibold tracking-[-0.015em] text-ws-primary">
        {title}
      </h2>
      {href && (
        <Link
          href={href}
          className="group inline-flex items-center gap-1 text-[13px] font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary"
        >
          {linkLabel}
          <ArrowRight size={14} strokeWidth={2} aria-hidden />
        </Link>
      )}
    </div>
  )
}

/** 3-up grid, 24px gutters — the reference's course grid. */
function CourseGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </div>
  )
}

/** Compact empty state that sits in a section's flow; the hero CTA carries the action. */
function SectionEmpty({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg bg-ws-surface px-6 py-8">
      <p className="text-[15px] font-semibold text-ws-primary">{title}</p>
      <p className="mt-1 text-[13px] text-ws-muted">{description}</p>
    </div>
  )
}

export default function DashboardPage() {
  const user = useUser()
  // The checkout success page's "Go to dashboard" links here with ?welcome=1.
  const welcome = useSearchParams().get("welcome") === "1"

  const { data: enrollments = [], isLoading: isLoadingEnrollments } = useEnrollments()
  const { data: bookmarks = [], isLoading: isLoadingBookmarks } = useBookmarks()
  const { data: browseCourses = [], isLoading: isLoadingBrowse } = useBrowseCourses()
  const bookmarkedIds = useBookmarkedIds()
  const toggleBookmark = useToggleBookmark()

  const resume = pickResume(enrollments)
  const current = pickCurrent(enrollments)
  const instructors = instructorRows(enrollments)
  // Tiles the student's packages can't back are hidden, never faked.
  const showUpcomingClasses = includesAny(enrollments, "liveClasses")
  const showCertificates = includesAny(enrollments, "certificate")

  return (
    <>
      <Topbar title="Dashboard" />

      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-7xl space-y-12">
          {/* Welcome band + the page's one gold CTA (spec §12 "Continue learning →") */}
          <header className="ws-animate-in rounded-lg bg-ws-surface">
            <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center md:gap-10 md:p-8">
              <Mascot size={150} className="h-[96px] w-[96px] shrink-0 md:h-[130px] md:w-[130px]" />
              <div className="min-w-0 flex-1">
                <h1 className="font-display text-[28px] font-semibold tracking-[-0.02em] text-ws-primary md:text-[34px]">
                  {welcome ? `Welcome to ${BRAND.name}` : `${getGreeting()}, ${user.firstName}`}
                </h1>
                <p className="mt-2 text-[15px] text-ws-muted">
                  {welcome
                    ? "Your learning journey starts now."
                    : "Pick up where you left off, or discover something new."}
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
                  {isLoadingEnrollments ? (
                    <div className="h-11 w-48 animate-pulse rounded-sm bg-ws-raised" />
                  ) : resume ? (
                    <>
                      <Button size="lg" className="h-11 gap-2 px-6" render={<Link href={enrollmentHref(resume)} />}>
                        Continue learning
                        <ArrowRight size={16} aria-hidden />
                      </Button>
                      <span className="max-w-full truncate text-[13px] text-ws-muted">{resume.courseTitle}</span>
                    </>
                  ) : (
                    <Button size="lg" className="h-11 gap-2 px-6" render={<Link href="/dashboard/courses" />}>
                      Browse programs
                      <ArrowRight size={16} aria-hidden />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </header>

          {/* MY PROGRAMS */}
          <section>
            <SectionHeader
              title="My programs"
              href={enrollments.length > 0 ? "/dashboard/my-courses" : undefined}
            />
            {isLoadingEnrollments ? (
              <CourseGrid>
                {[0, 1, 2].map((i) => (
                  <CourseCardSkeleton key={i} />
                ))}
              </CourseGrid>
            ) : enrollments.length === 0 ? (
              <SectionEmpty
                title="You're not enrolled in anything yet"
                description="Choose a program and it'll show up here with your progress."
              />
            ) : (
              <CourseGrid>
                {enrollments.slice(0, 3).map((enrollment) => (
                  <EnrollmentCard key={enrollment.id} enrollment={enrollment} />
                ))}
              </CourseGrid>
            )}
          </section>

          {/* Spec §12 tiles, in spec order. A uniform grid: tiles hide per student,
              so fixed column spans would leave holes. */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <CurrentCourseTile enrollment={current} isLoading={isLoadingEnrollments} />
            <ProgressTile enrollments={enrollments} isLoading={isLoadingEnrollments} />
            {showUpcomingClasses && <UpcomingClassesTile />}
            {showCertificates && <CertificatesTile />}
            {instructors.length > 0 && <InstructorsTile rows={instructors} />}
            <CommunityTile />
            <SupportTile priority={hasPrioritySupport(enrollments)} />
          </div>

          {/* Browse programs */}
          <section>
            <SectionHeader title="Browse programs" href="/dashboard/courses" />
            {isLoadingBrowse ? (
              <CourseGrid>
                {[0, 1, 2].map((i) => (
                  <CourseCardSkeleton key={i} />
                ))}
              </CourseGrid>
            ) : browseCourses.length === 0 ? (
              <SectionEmpty
                title="No programs published yet"
                description="New programs will appear here as instructors publish them."
              />
            ) : (
              <CourseGrid>
                {browseCourses.slice(0, 3).map((course) => (
                  <CourseCard
                    key={course.id}
                    href={`/dashboard/courses/${course.id}`}
                    title={course.title}
                    thumbnailUrl={course.thumbnailUrl}
                    price={course.price}
                    pricing={course.pricing}
                    rating={course.rating}
                    level={course.level}
                    totalLessons={course.totalLessons}
                    totalDuration={course.totalDuration}
                    enrolledCount={course.enrolledCount}
                    isBookmarked={bookmarkedIds.has(course.id)}
                    onToggleBookmark={() => toggleBookmark.mutate(course.id)}
                  />
                ))}
              </CourseGrid>
            )}
          </section>

          {/* Bookmarks — only when there are any. */}
          {(isLoadingBookmarks || bookmarks.length > 0) && (
            <section>
              <SectionHeader title="Bookmarks" href="/dashboard/bookmarks" />
              {isLoadingBookmarks ? (
                <CourseGrid>
                  {[0, 1, 2].map((i) => (
                    <CourseCardSkeleton key={i} />
                  ))}
                </CourseGrid>
              ) : (
                <CourseGrid>
                  {bookmarks.slice(0, 3).map((bookmark) => (
                    <CourseCard
                      key={bookmark.id}
                      href={`/dashboard/courses/${bookmark.courseId}`}
                      title={bookmark.courseTitle}
                      thumbnailUrl={bookmark.courseThumbnail}
                      price={bookmark.price}
                      pricing={bookmark.pricing}
                      rating={bookmark.rating}
                      level={bookmark.level}
                      enrolledCount={bookmark.enrolledCount}
                      isBookmarked
                      onToggleBookmark={() => toggleBookmark.mutate(bookmark.courseId)}
                    />
                  ))}
                </CourseGrid>
              )}
            </section>
          )}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 6: Priority mail on the help page.** In `app/(platform)/dashboard/help/page.tsx`:
  1. Directly after `import { PageHeader } from "@/components/shared/page-header"` add:

```tsx
import { fetchMyEnrollments } from "@/lib/actions/student"
import { hasPrioritySupport } from "@/lib/dashboard-home"
```

  2. Replace

```tsx
export default function HelpPage() {
  return (
```

   with

```tsx
export default async function HelpPage() {
  // Priority-support packages (spec §12 Support) flag their emails for the support inbox.
  const priority = hasPrioritySupport(await fetchMyEnrollments())
  const supportHref = priority
    ? `mailto:support@worldstreetgold.com?subject=${encodeURIComponent("[Priority] Support request")}`
    : "mailto:support@worldstreetgold.com"

  return (
```

  3. Replace `href="mailto:support@worldstreetgold.com"` with `href={supportHref}`.
  4. Replace

```tsx
                    <p className="text-sm font-medium text-ws-primary">
                      Email us
                    </p>
```

   with

```tsx
                    <p className="text-sm font-medium text-ws-primary">
                      Email us{priority ? " · Priority support" : ""}
                    </p>
```

  5. This file also edits the FAQ's own copy, stale since the Task 1 rename: replace

```tsx
      "Each lesson you finish is marked complete, and your overall progress is the share of lessons completed. You can see per-course progress on My Courses and pick up exactly where you left off from the course player.",
```

     with

```tsx
      "Each lesson you finish is marked complete, and your overall progress is the share of lessons completed. You can see per-course progress on My programs and pick up exactly where you left off from the course player.",
```

- [ ] **Step 7: Verify.**
  1. tsc (filtered). `npx eslint lib/dashboard-home.ts lib/hooks/queries/keys.ts lib/hooks/queries/use-certificates.ts lib/hooks/queries/index.ts "app/(platform)/dashboard/instructor/[instructorId]/message-instructor-button.tsx" components/dashboard/home-tiles.tsx "app/(platform)/dashboard/page.tsx" "app/(platform)/dashboard/help/page.tsx"`.
  2. Selector assertions. Create `"$P4/t5-dashboard-home.ts"`:

```ts
import assert from "node:assert/strict"
import type { StudentEnrollment } from "@/lib/actions/student"
import {
  hasPrioritySupport,
  includesAny,
  instructorRows,
  isMentorEnrollment,
  pickCurrent,
  pickResume,
} from "@/lib/dashboard-home"

const FULL = { liveClasses: true, instructorQa: true, assignments: true, certificate: true, mentorship: true, prioritySupport: true }
const NONE = { liveClasses: false, instructorQa: false, assignments: false, certificate: false, mentorship: false, prioritySupport: false }
const STANDARD = { ...NONE, liveClasses: true, instructorQa: true, assignments: true, certificate: true }
const base: StudentEnrollment = {
  id: "e", courseId: "c", courseTitle: "Course", courseThumbnail: null, instructorName: "Sarah Chen",
  instructorAvatarUrl: null, progress: 40, totalLessons: 10, lastAccessedAt: "2026-09-01T00:00:00.000Z",
  status: "active", courseAvailableAt: null, firstLessonId: "l1", resumeLessonId: "l1", resumeLessonTitle: "Lesson 1",
  packageKey: null, packageName: null, instructorId: "i1", instructorHeadline: null, entitlements: FULL,
  explicitPackage: false, openLessons: 10,
}
const e = (over: Partial<StudentEnrollment>): StudentEnrollment => ({ ...base, ...over })

const legacy = e({ id: "legacy", lastAccessedAt: "2026-09-10T00:00:00.000Z" })
const exec = e({ id: "exec", packageKey: "executive", explicitPackage: true, instructorId: "i2", instructorName: "Mentor Two", lastAccessedAt: "2026-09-12T00:00:00.000Z" })
const basic = e({ id: "basic", packageKey: "basic", entitlements: NONE, explicitPackage: true, instructorId: "i3", instructorName: "Basic Teacher" })
const deletedTier = e({ id: "deleted", packageKey: "executive", explicitPackage: false })
const fullProgram = e({ id: "full", packageKey: "standard", explicitPackage: true })

// Priority: bought, and still granting access.
assert.equal(hasPrioritySupport([legacy]), false, "legacy full access is never labelled")
assert.equal(hasPrioritySupport([exec]), true)
assert.equal(hasPrioritySupport([deletedTier]), false, "a deleted tier grants access, not a label")
assert.equal(hasPrioritySupport([{ ...exec, status: "refunded" }]), false)

// Mentor: Executive only.
assert.equal(isMentorEnrollment(exec), true)
assert.equal(isMentorEnrollment(legacy), false)
assert.equal(isMentorEnrollment(deletedTier), false)
assert.equal(isMentorEnrollment(fullProgram), false, "a single Full program tier carries mentorship but isn't Executive")
assert.equal(isMentorEnrollment({ ...exec, status: "cancelled" }), false)

// Instructor rows.
const rows = instructorRows([legacy, exec, basic, e({ id: "gone", status: "refunded", instructorId: "i9" })])
assert.deepEqual(
  rows.map((r) => [r.instructorId, r.canMessage, r.isMentor]),
  [["i1", true, false], ["i2", true, true], ["i3", false, false]]
)
const qaOnOne = instructorRows([basic, e({ id: "std", instructorId: "i3", packageKey: "standard", entitlements: STANDARD, explicitPackage: true })])
assert.equal(qaOnOne[0].canMessage, true, "any enrollment with Q&A opens the conversation")

// Continue learning / Current course.
const done = e({ id: "done", status: "completed", progress: 100, lastAccessedAt: "2026-09-14T00:00:00.000Z" })
const cancelled = e({ id: "cancelled", status: "cancelled", lastAccessedAt: "2026-09-13T00:00:00.000Z" })
assert.equal(pickResume([legacy, exec, cancelled])?.id, "exec")
assert.equal(pickResume([legacy, exec, cancelled, done])?.id, "done")
assert.equal(pickCurrent([legacy, exec, cancelled, done])?.id, "exec")
assert.equal(pickResume([]), null)
assert.equal(pickResume([cancelled]), null)

// Tile visibility.
assert.equal(includesAny([basic], "liveClasses"), false)
assert.equal(includesAny([basic, legacy], "liveClasses"), true)
assert.equal(includesAny([{ ...legacy, status: "refunded" }], "certificate"), false)

console.log("dashboard home: all assertions passed")
```

   Run `npx tsx --tsconfig ./tsconfig.json "$P4/t5-dashboard-home.ts"` → `dashboard home: all assertions passed`.

  3. Server-rendered copy (student; strip scripts):
     - `curl -s -b mock_persona=student "http://localhost:3001/dashboard?welcome=1" | perl -pe 's/<script\b.*?<\/script>//gs' | grep -o "Welcome to WorldStreet Mastery Academy\|Your learning journey starts now." | sort | uniq -c` → one of each.
     - `/dashboard` (no param): `grep -o "Good morning\|Good afternoon\|Good evening" | wc -l` ≥ 1, `grep -o "Welcome to" | wc -l` → 0, `grep -o "Browse programs" | wc -l` ≥ 1, `grep -o "Get help" | wc -l` → 1, `grep -o "Join the community" | wc -l` → 0 (env unset).
  4. Certificates data:
     - `bash "$H/action.sh" "/dashboard" fetchMyCertificates '[]'` → `[]`.
     - `node "$H/mockdb.cjs" fixture standard` (N), then `node "$H/mockdb.cjs" set-status N completed` → one row with `courseTitle` `Forex Trading Mastery`.
     - `node "$H/mockdb.cjs" set-package N basic` → `[]`.
     - `node "$H/mockdb.cjs" restore`.
  5. Priority mail (server-rendered help page):
     - `curl -s -b mock_persona=student http://localhost:3001/dashboard/help | perl -pe 's/<script\b.*?<\/script>//gs' > "$P4/help.html"` → `grep -o 'mailto:support@worldstreetgold.com"' "$P4/help.html" | wc -l` → 1 and `grep -o '%5BPriority%5D' "$P4/help.html" | wc -l` → 0. Also `grep -o 'My programs' "$P4/help.html" | wc -l` → 1 and `grep -o 'My Courses' "$P4/help.html" | wc -l` → 0 (the FAQ copy fix).
     - `node "$H/mockdb.cjs" fixture executive` (N) → re-fetch: `mailto:support@worldstreetgold.com?subject=%5BPriority%5D%20Support%20request` → 1, `Priority support` → ≥ 1.
     - `node "$H/mockdb.cjs" set-status N refunded` → back to the plain mailto (ruling 25).
     - `node "$H/mockdb.cjs" restore`.
  6. **(controller)** Browser, student. For each state check `$B js "document.body.scrollWidth + '/' + window.innerWidth"` → `400/400` at 400 px, and save screenshots as `"$P4/t5-<state>-<400|1280>.png"`.
     - **baseline**:
       - At 400 px, `/dashboard` shows the greeting, `Continue learning` and the tiles in order: Current course (`Bitcoin & Cryptocurrency Fundamentals`, `Resume · What is Bitcoin?`, `64% complete`) · My progress (`10/20 lessons`) · Upcoming classes (the empty copy) · Certificates (`0 earned`) · Instructor / Mentor (Sarah Chen, headline, outline `Message`, no `Your mentor`) · Support (no `Priority support`). No Community tile.
       - `$B js "document.querySelector('header a').getAttribute('href')"` → `/dashboard/courses/6a6fc0bb6433bbbd6322be03/learn/6a6fc0bb6433bbbd6322be15`.
       - Gold check: `$B js "[...(document.querySelector('[data-slot=sidebar-inset]') || document.querySelector('main')).querySelectorAll('a.bg-primary, button.bg-primary, a.bg-ws-brand, button.bg-ws-brand')].map(el => el.textContent.trim()).join(' | ')"` → `Continue learning` only.
       - Repeat at 1280 px (tiles in 3 columns).
     - **welcome**: `/dashboard?welcome=1` → heading `Welcome to WorldStreet Mastery Academy`, line `Your learning journey starts now.`.
     - **executive**: `node "$H/mockdb.cjs" fixture executive` → the Continue learning href is `/dashboard/courses/6aa7bc2845744c5eeb0eb781/learn/<everyone lesson id>` (never opened, so it leads), and Current course is Forex. Sarah Chen's row shows `Your mentor` and `Message your mentor`; Support shows `Priority support`; the Forex card chip reads `Private Forex Mentorship`. Then `restore`.
     - **basic-only**:
       - `node "$H/mockdb.cjs" fixture basic`, `node "$H/mockdb.cjs" set-status 6a6fe33862cf63ed050e56c6 cancelled`, `node "$H/mockdb.cjs" set-status 6a6fe33862cf63ed050e56c7 cancelled`.
       - Result: no Upcoming classes tile and no Certificates tile. The instructor row reads `Instructor Q&A isn't in your package`. My programs shows two `CANCELLED` cards. Then `restore`.
     - **no enrollments** (admin persona cookie): the CTA reads `Browse programs` → `/dashboard/courses`; Current course reads `Nothing in progress right now.`; there is no Instructor / Mentor tile, and My programs shows its empty state.
  7. **(controller)** Community shown (Controller setup step 4):
     - `curl -s -b mock_persona=student http://localhost:3001/dashboard | perl -pe 's/<script\b.*?<\/script>//gs' | grep -o 'href="https://social.worldstreetgold.com"[^>]*' | head -1` shows `target="_blank"` and `rel="noopener noreferrer"`, and `Join the community` appears once.
     - Restart back to the step-3 env.
  8. End: `node "$H/mockdb.cjs" restore`.

- [ ] **Step 8: Commit.**

```bash
git add lib/dashboard-home.ts lib/hooks/queries/keys.ts lib/hooks/queries/use-certificates.ts lib/hooks/queries/index.ts "app/(platform)/dashboard/instructor/[instructorId]/message-instructor-button.tsx" components/dashboard/home-tiles.tsx "app/(platform)/dashboard/page.tsx" "app/(platform)/dashboard/help/page.tsx"
git commit -m "feat(dashboard): §12 home — welcome band, Continue learning, program tiles with truthful badges, priority support mail

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Assignments (D7 lite) — `getMyAssessments`, hook, tile

**Files:**
- Modify: `lib/actions/exams.ts` (new `MyAssessment` + `getMyAssessments`, inserted directly above `export type RunnerQuestion = {`)
- Modify: `lib/hooks/queries/keys.ts` (new key only)
- Create: `lib/hooks/queries/use-assessments.ts`
- Modify: `lib/hooks/queries/index.ts`
- Create: `components/dashboard/assignments-tile.tsx`
- Modify: `app/(platform)/dashboard/page.tsx` (one import, one line)

**Interfaces:**
- Consumes:
  - `initAction`, `Exam`, `ExamAttempt`, `Enrollment`, `Course`, `Lesson`, `canAccessLesson`, `entitlementsFor`, `AttemptStatus` (all already imported in `exams.ts`);
  - `DashboardTile` from `components/dashboard/home-tiles.tsx` (Task 5);
  - the tile grid in `app/(platform)/dashboard/page.tsx` (Task 5).
- Produces:
  - `type MyAssessment = { courseId: string; courseTitle: string; examId: string; title: string; scope: "final" | "lesson"; lessonId: string | null; status: "not_started" | "in_progress" | "passed" | "failed"; href: string }`
  - `getMyAssessments(): Promise<MyAssessment[]>`. Order: in progress → not started → failed → passed, then course title, then knowledge checks before the final.
  - `queryKeys.assessments = ["assessments"]`
  - `useMyAssessments()`
  - `AssignmentsTile()`, which renders nothing while loading or when the list is empty.

- [ ] **Step 1: The action.** In `lib/actions/exams.ts`, directly above `export type RunnerQuestion = {`, insert:

```ts
/* ═══════════════════ student: assignments (spec §12, D7 lite) ═══════════════════ */

export type MyAssessment = {
  courseId: string
  courseTitle: string
  examId: string
  title: string
  scope: "final" | "lesson"
  lessonId: string | null
  status: "not_started" | "in_progress" | "passed" | "failed"
  href: string
}

const ASSESSMENT_STATUS_ORDER: Record<MyAssessment["status"], number> = {
  in_progress: 0,
  not_started: 1,
  failed: 2,
  passed: 3,
}

/**
 * Every published assessment the student can take across their active /
 * completed enrollments — the dashboard's Assignments tile (D7 lite: the
 * existing exam engine; file submissions are Phase 7). Knowledge checks follow
 * their lesson's tier and the final exam follows `certificate` (the rules
 * behind examPackageLock). Deliberately NOT gated on the `assignments`
 * entitlement, which is reserved for Phase 7 submissions. Four queries in
 * total, whatever the number of courses.
 */
export async function getMyAssessments(): Promise<MyAssessment[]> {
  try {
    const user = await initAction()
    if (!user) return []

    const enrollments = await Enrollment.find({ user: user.id, status: { $in: ["active", "completed"] } })
      .select("course packageKey examPassed")
      .lean()
    if (enrollments.length === 0) return []
    const courseIds = enrollments.map((e) => e.course)

    const [courses, exams] = await Promise.all([
      Course.find({ _id: { $in: courseIds } }).select("title packages").lean(),
      Exam.find({ course: { $in: courseIds }, status: "published" }).select("course scope lesson title").lean(),
    ])
    if (exams.length === 0) return []

    const quizLessonIds = exams.flatMap((exam) => (exam.scope === "lesson" && exam.lesson ? [exam.lesson] : []))
    const [lessons, attempts] = await Promise.all([
      quizLessonIds.length > 0
        ? Lesson.find({ _id: { $in: quizLessonIds } }).select("course minPackageKey isFree").lean()
        : Promise.resolve([]),
      ExamAttempt.find({ user: user.id, exam: { $in: exams.map((exam) => exam._id) } })
        .sort({ createdAt: -1 })
        .select("exam status")
        .lean(),
    ])

    const coursesById = new Map(courses.map((c) => [c._id.toString(), c]))
    const enrollmentsByCourse = new Map(enrollments.map((e) => [e.course.toString(), e]))
    const lessonsById = new Map(lessons.map((l) => [l._id.toString(), l]))
    // Newest attempt first per exam (the query sorted by createdAt desc).
    const attemptsByExam = new Map<string, { status: AttemptStatus }[]>()
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
      const latestFinished = history.find((a) => a.status !== "in_progress")
      const passed = isQuiz ? history.some((a) => a.status === "passed") : !!enrollment.examPassed
      const status: MyAssessment["status"] = history.some((a) => a.status === "in_progress")
        ? "in_progress"
        : passed
          ? "passed"
          : latestFinished && latestFinished.status !== "passed"
            ? "failed"
            : "not_started"

      rows.push({
        courseId,
        courseTitle: course.title,
        examId: exam._id.toString(),
        title: exam.title,
        scope: isQuiz ? "lesson" : "final",
        lessonId,
        status,
        href: isQuiz ? `/dashboard/courses/${courseId}/learn/${lessonId}` : `/dashboard/courses/${courseId}/exam`,
      })
    }

    return rows.sort(
      (a, b) =>
        ASSESSMENT_STATUS_ORDER[a.status] - ASSESSMENT_STATUS_ORDER[b.status] ||
        a.courseTitle.localeCompare(b.courseTitle) ||
        (a.scope === b.scope ? a.title.localeCompare(b.title) : a.scope === "lesson" ? -1 : 1)
    )
  } catch (error) {
    console.error("Get my assessments error:", error)
    return []
  }
}

```

   (If tsc rejects `lessons.map` on the `Promise.resolve([])` union, give the empty branch the lean type exactly as `getMyMeetingInvites` does for its `courses`. Do not use `any`.)

- [ ] **Step 2: Key and hook.**
  - `lib/hooks/queries/keys.ts`: directly after `  courseExam: (courseId: string) => ["course-exam", courseId] as const,` add

```ts
  assessments: ["assessments"] as const,
```

  - Create `lib/hooks/queries/use-assessments.ts`:

```ts
"use client"

import { useQuery } from "@tanstack/react-query"
import { getMyAssessments, type MyAssessment } from "@/lib/actions/exams"
import { queryKeys } from "./keys"

export function useMyAssessments() {
  return useQuery<MyAssessment[]>({
    queryKey: queryKeys.assessments,
    queryFn: () => getMyAssessments(),
    staleTime: 60 * 1000,
  })
}
```

  - `lib/hooks/queries/index.ts`: append `export { useMyAssessments } from "./use-assessments"`.

- [ ] **Step 3: The tile.** Create `components/dashboard/assignments-tile.tsx`:

```tsx
"use client"

import Link from "next/link"
import { ClipboardCheckIcon } from "lucide-react"
import { DashboardTile } from "@/components/dashboard/home-tiles"
import type { MyAssessment } from "@/lib/actions/exams"
import { useMyAssessments } from "@/lib/hooks/queries"
import { cn } from "@/lib/utils"

const STATUS: Record<MyAssessment["status"], { label: string; className: string }> = {
  not_started: { label: "Not started", className: "bg-ws-chip text-ws-muted" },
  in_progress: { label: "In progress", className: "bg-ws-warning/10 text-ws-warning" },
  passed: { label: "Passed", className: "bg-ws-success/10 text-ws-success" },
  failed: { label: "Failed", className: "bg-ws-danger/10 text-ws-danger" },
}

/**
 * Spec §12 Assignments (D7 lite): the knowledge checks and final exams the
 * student's packages include, with attempt state. Hidden while loading and when
 * there is nothing to take — a tile with nothing in it would imply work exists.
 */
export function AssignmentsTile() {
  const { data: assessments = [] } = useMyAssessments()
  if (assessments.length === 0) return null

  const passed = assessments.filter((a) => a.status === "passed").length

  return (
    <DashboardTile icon={ClipboardCheckIcon} title="Assignments">
      <p className="mb-3 text-[13px] text-ws-muted">
        <span className="font-semibold tabular-nums text-ws-primary">{assessments.length - passed}</span> to do ·{" "}
        <span className="tabular-nums">{passed}</span> passed
      </p>
      <ul className="space-y-3">
        {assessments.slice(0, 4).map((a) => (
          <li key={a.examId}>
            <Link href={a.href} className="flex items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ws-primary">{a.title}</span>
                <span className="block truncate text-[11px] text-ws-muted">
                  {a.scope === "final" ? "Final exam" : "Knowledge check"} · {a.courseTitle}
                </span>
              </span>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS[a.status].className)}>
                {STATUS[a.status].label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {assessments.length > 4 && (
        <p className="mt-3 text-[11px] tabular-nums text-ws-muted">+{assessments.length - 4} more in your programs</p>
      )}
    </DashboardTile>
  )
}
```

- [ ] **Step 4: Mount it in §12 order.** In `app/(platform)/dashboard/page.tsx`:
  - directly after `import { EnrollmentCard } from "@/components/platform/enrollment-card"` add `import { AssignmentsTile } from "@/components/dashboard/assignments-tile"`;
  - replace `            {showUpcomingClasses && <UpcomingClassesTile />}` with:

```tsx
            {showUpcomingClasses && <UpcomingClassesTile />}
            <AssignmentsTile />
```

- [ ] **Step 5: Verify.** tsc; `npx eslint lib/actions/exams.ts lib/hooks/queries/keys.ts lib/hooks/queries/use-assessments.ts lib/hooks/queries/index.ts components/dashboard/assignments-tile.tsx "app/(platform)/dashboard/page.tsx"`. Fixture:

```bash
node "$H/mockdb.cjs" fixture standard            # note N, and lessons S (standard), X (executive)
node "$H/mockdb.cjs" exam-fixture $F             # FINAL
node "$H/mockdb.cjs" exam-fixture $F S           # QS — knowledge check on the Standard lesson
node "$H/mockdb.cjs" exam-fixture $F X           # QX — knowledge check on the Executive lesson
list() { bash "$H/action.sh" "/dashboard" getMyAssessments '[]' | node -e '
for (const a of JSON.parse(require("fs").readFileSync(0, "utf8"))) console.log([a.title, a.scope, a.status, a.lessonId, a.href].join(" | "))'; }
```

  1. `list` → exactly two rows, in this order:
     - `Fixture knowledge check | lesson | not_started | S | /dashboard/courses/6aa7bc2845744c5eeb0eb781/learn/S`
     - `Fixture final exam | final | not_started |  | /dashboard/courses/6aa7bc2845744c5eeb0eb781/exam`

     No row for QX (Executive lesson, Standard package).
  2. States:
     - `node "$H/mockdb.cjs" attempt-fixture QS $STUDENT in_progress` → QS `in_progress`, listed first.
     - `node "$H/mockdb.cjs" attempt-fixture FINAL $STUDENT failed` → final `failed`.
     - `node "$H/mockdb.cjs" attempt-fixture FINAL $STUDENT passed` → final `passed` (the fixture stamped `examPassed`), listed last.
  3. `node "$H/mockdb.cjs" set-package N basic` → `list` prints nothing (`[]`). Standard lesson locked; no certificate, so no final.
  4. `node "$H/mockdb.cjs" set-package N executive` → three rows, including a second `Fixture knowledge check` whose `lessonId` is X.
  5. Legacy: `node "$H/mockdb.cjs" exam-fixture $BTC` → a `Fixture final exam | final | not_started | | /dashboard/courses/6a6fc0bb6433bbbd6322be03/exam` row appears (full access).
  6. Drafts never list: `node -e 'const m=require("mongoose");m.connect("mongodb://127.0.0.1:27017/worldstreet-academy").then(async()=>{await m.connection.db.collection("exams").updateMany({title:"Fixture knowledge check"},{$set:{status:"draft"}});await m.disconnect()})'`, then `list` → no `Fixture knowledge check` rows.
  7. **(controller)** Browser, student, same state (both finals present):
     - `$B viewport 400x800`, `/dashboard`: the Assignments tile sits between Upcoming classes and Certificates, with a status chip per row.
     - `$B js "document.body.scrollWidth + '/' + window.innerWidth"` → `400/400`.
     - Save `"$P4/t6-assignments-400.png"`.
     - Then `node "$H/mockdb.cjs" restore` and reload: no Assignments tile.
  8. End: `node "$H/mockdb.cjs" restore`.

- [ ] **Step 6: Commit.**

```bash
git add lib/actions/exams.ts lib/hooks/queries/keys.ts lib/hooks/queries/use-assessments.ts lib/hooks/queries/index.ts components/dashboard/assignments-tile.tsx "app/(platform)/dashboard/page.tsx"
git commit -m "feat(dashboard): Assignments tile — knowledge checks and final exams the package includes, with attempt state

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Spec coverage (self-review)

| Spec item | Where |
|---|---|
| §12 "WELCOME TO WorldStreet Mastery Academy — Your learning journey starts now." | Task 5 (`?welcome=1`, ruling 1) |
| MY PROGRAMS (package chip) | Task 1 (`EnrollmentCard`, `/dashboard/my-courses`); Task 5 (dashboard section) |
| CURRENT COURSE | Task 1 (`resumeLessonTitle`); Task 5 (`CurrentCourseTile`) |
| MY PROGRESS (tally over open lessons) | Task 1 (`openLessons`); Task 5 (`ProgressTile`) |
| UPCOMING CLASSES (entitlement-gated, empty copy) | Task 2 (action, hook, meetings list); Task 5 (tile, hidden without live classes) |
| ASSIGNMENTS (D7 lite, states) | Task 6 |
| CERTIFICATES (count + latest, `queryKeys.certificates`) | Task 5 |
| INSTRUCTOR / MENTOR (Q&A-gated Message, "Your mentor") | Task 5 (+ `MessageInstructorButton` options) |
| COMMUNITY (D6 env, hidden when unset) | Task 5 |
| SUPPORT (help link, Priority badge, `[Priority]` mailto) | Task 5 |
| CONTINUE LEARNING → | Task 5 (ruling 2) |
| 4.2 producer: instructors schedule a class | Task 3 |
| 4.2 `getMyMeetings` returns `scheduledAt`; host starts it | Task 3 |
| 4.2 reminders reach enrolled students | Task 4 |
| 4.2 "Upcoming" above invites on `/dashboard/meetings` | Task 2 |
| 4.3 status chips for every non-active status + package name | Task 1 (ruling 21) |
| 4.4 nav: no new routes; label rename if it fits | Task 1 (controller-verified at 400 px) |
| go-patches-phase-3.md R3: progress excludes unpublished lessons everywhere | Task 1 (ruling 27, Step 3) |

**Exit criteria → evidence:**
- **"All ten §12 tiles implemented or truthfully hidden; Continue learning CTA on the dashboard."** Task 5 step 7.3 and step 7.6 (baseline / executive / basic-only / no-enrollment states), plus Task 6 step 5.
- **"Instructors can schedule classes; students see upcoming classes (entitlement-gated); reminders fire."**
  - Scheduling is proven up to the RealtimeKit call: Task 3 steps 8.1–8.2.
  - Joining and starting are proven on fixtures: Task 3 steps 8.3–8.4.
  - Upcoming classes: Task 2 step 6. Reminders: Task 4 step 3.
  - A real end-to-end schedule needs RealtimeKit credentials, which dev:mock doesn't have. Run it once on staging before release.
- **"Package name visible on my programs; status chips for every enrollment status."** Task 1 steps 9.2, 9.4 and 9.5.

**Placeholder scan:** every code step carries complete code. No "TBD"/"similar to Task N". Each task's Interfaces block repeats the names it consumes.

**Type consistency (checked across tasks):**
- `StudentEnrollment` fields (Task 1) are the ones `lib/dashboard-home.ts` (Tasks 1 and 5), `EnrollmentCard` and the tiles read.
- `UpcomingClass` / `useUpcomingClasses` (Task 2) are consumed by `UpcomingClassesTile` (Task 5).
- `MeetingWithDetails.scheduledAt` (Task 3) is read by `ActiveMeetingsList` and the instructor handler.
- `joinMeeting`'s `startsAt` (Task 3) is read by `joinErrorMessage`.
- `DashboardTile` and the `showUpcomingClasses` line (Task 5) are Task 6's anchors.
- `MyAssessment` / `useMyAssessments` (Task 6).
- `LearnLesson.isPublished` (Task 1, `fetchCourseForLearning`) is read by the learn page's own progress computation in the same task.

**Cross-repo note for the release checklist (§0.4, not blocking):** the not-started refusal (ruling 8) and the class audience are enforced on the web. If the Go API exposes a meeting join, add "refuse non-hosts on a scheduled course meeting" to the Go patch list alongside Phase 3's live-class gate.
