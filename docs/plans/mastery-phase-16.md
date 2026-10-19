# Mastery Academy — Phase 16 Implementation Plan (Mastery Score and attendance)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "mastery" is measurable (§12). Each learner has a 0–100 Mastery Score per program, built from completion, assessments, assignments, projects and attendance. They can see its parts on `/dashboard/points` and in the dashboard hero, and admins see it on `/admin/enrollments`.

**Architecture:**
- **Attendance.** A new web-only `attendances` collection, one row per learner per course class, has exactly one writer: `lib/attendance.ts`. The meeting actions call it on join, admit, leave, kick and end. The layout-level `MeetingProvider` sends a 60-second heartbeat that banks time while a learner is in a class. Time after a silent gap of more than 150 s is never credited, so a closed tab or a locked phone stops counting.
- **Rules.** Two pure, client-safe modules hold the rules, each checked by an assert script: `lib/attendance-rules.ts` (banking, held, attended) and `lib/mastery-score.ts` (D24's weights, the re-weighted mean, the view types and the copy).
- **Loader.** One server-only loader, `lib/mastery-inputs.ts`, turns enrollments into score inputs in four bulk queries. Every surface, and Phases 17 and 19, read it. The score is computed on read and never stored.
- **Projects.** They are assignments with `kind: "project"` (an additive field on a web-only collection).

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict · MongoDB/Mongoose · TanStack Query · Tailwind v4 with the WorldStreet design system (`ds/`, `ws-*` tokens).

**Spec:** `docs/institutional-blueprint.md` §12. **Roadmap:** `docs/institutional-blueprint-plan.md` Phase 16, decision D24, risk register item 4.

**Branch:** `mastery/phase-16`, in track B's worktree, after Phase 15 has merged into it (track B runs 15 → 16 → 14 → 17).

## Controller rulings (binding)

1. **A closed tab must not earn the rest of the class.** No existing path records it:
   - `/api/calls/end` ends 1-on-1 calls by `callId` only.
   - RealtimeKit's `participantLeft` handlers in both meetings pages only remove a tile on *other* clients.

   So the time is banked by a heartbeat. `MeetingProvider` calls `pingAttendance(meetingId)` every 60 s while a non-host is registered in a meeting. Each bank adds `now − openSince` and restarts the interval, but only when that gap is ≤ 150 s; a longer silence adds 0. Leave, kick and end bank by the same rule and then close the row.
   - No route handler is added; the five stay five.
   - The model keeps the roadmap's fields, with `openSince` meaning "the start of the time not yet banked".
2. **Attendance hooks.** `joinMeeting`'s four admitted paths (rejoin after leaving, already admitted, guest auto-admit, participant auto-admit) open the row, and so does `admitParticipant`. `leaveMeeting` and `kickParticipant` close one row; `endMeeting` closes every open row. The roadmap named only join, leave and end; admit and kick are exits and entries too.
   - Only course classes count: `courseId` set and no `mentorshipSessionId`.
   - The host never gets a row.
   - Rejoins add to `seconds` and never overwrite it; `firstJoinedAt` is written once.
3. **A join's open runs beside `meeting.save()`,** inside the same `Promise.all`, not after the RealtimeKit token. It matches how the participant entry is already saved. It costs no join latency, and it lets `dev:mock` verify it, because RealtimeKit is disabled there and `joinMeeting` returns "Failed to join meeting". A join whose RealtimeKit call failed earns nothing, because no heartbeat follows.
4. **Classes held** are course classes with `status: "ended"`, `startedAt` and `endedAt` set and `startedAt` at or after the enrolment start (`activatedAt ?? purchasedAt ?? createdAt`), which ran at least **10 minutes** (`MIN_HELD_CLASS_SECONDS`). The 10-minute floor is a new constant, so an instructor's accidental start-and-stop never counts against a class.
   - A class left running counts once its host ends it.
   - **Attended** means attended seconds ≥ min(50% of the class, 1,800 s) (D24).
   - The attendance part is a percentage and is null while no class has been held (risk register 4).
5. **Assessment** is `Enrollment.bestScorePercent`, the best *final*-exam score (lesson quizzes never write it). It counts only when the plan includes `certificate`, because that is the final exam's gate (`examPackageLock` in `lib/actions/exams.ts`). There is no "assessments" entitlement.
6. **Assignments and projects** are the mean grade of *graded* submissions (`status: "graded"`, grade set), split by `Assignment.kind` (a missing kind is `"assignment"`). Ungraded and unsubmitted work doesn't count. A submission counts whatever its assignment's current publish status. Both parts count only when the plan includes `assignments`.
7. **Completion** is `Enrollment.progress`: the stored share of published lessons the plan opens, which `completeLesson` writes. It is always included, so a score appears once one more part has data.
8. **`masteryInputsFor` returns `MasteryFacts`,** not bare `MasteryInputs`. Facts are the inputs plus `excluded`, `classes` and `bestProjectGrade`. The cards must tell "Not in your plan" from "No data yet", Phase 19 shows attended ÷ held, and Phase 17's Mastery tier needs the best project grade.
   - `masteryInputsForMany` takes `{ enrollment, course }` pairs, because it needs the course's packages, and returns a `Map` keyed by enrollment id.
9. **Programs only.** The score is computed for Academy programs (`courseKindOf(course) === "program"`). Marketplace and New Economy courses get no card, no hero figure and no admin figure.
10. **"The admin enrollment sheet" is the `/admin/enrollments` table:** a "Mastery" column for the rows on the page. The CSV export is unchanged.
11. **The hero figure** is the score of the most recently opened program that has one. It is hidden until one does, and reads "Mastery Score" for one program or "Mastery · <program>" for several. It links to `/dashboard/points#mastery`.
12. **Action shapes.** `pingAttendance` returns `{ success, data | error }` and has no `revalidatePath`: nothing cached shows live attendance. The read action `getMyMastery` follows its neighbour `getMyPointsSummary` (`lib/actions/points.ts`) and returns a value or `null`.
13. **Phase 15 lands first in this track.** Anchor on `assessmentKindLabel` and on `getMyAssessments`'s assignment rows, which Phase 15 keeps. If Phase 15 moved the list markup into a shared component, the "Project" label still flows through `assessmentKindLabel`.
14. **No persona is added.** `mocks/` is never committed (dev bypasses never ship). The committed `guest`, `student`, `instructor` and `admin` personas are enough.

## Global Constraints

- **Data:**
  - Additive schema changes only, because the Go mobile API reads the same MongoDB. No renamed fields, no new enum values on existing fields, no new role values.
  - `attendances` is a new web-only collection, and `assignments` is already web-only.
- **Server actions:**
  - Each follows `connectDB()` → auth/ownership → Zod (`import { z } from "zod/v4"`) → mutate → `revalidatePath()` → return `{ success: true, data } | { success: false, error }`. They never throw across the boundary.
  - User ids come from `getCurrentUser()`, never the browser. Server actions are callable with any arguments.
  - **`lib/attendance.ts` and `lib/mastery-inputs.ts` are `import "server-only"` modules and never `"use server"`**: as actions, `closeAttendance(meetingId, userId)` or `myMastery(userId)` would let anyone touch anyone's data.
- **Server reads and gates:**
  - `connectDB()` comes first in every action and loader.
  - RSC pages use `getCachedUser()`; actions use `getCurrentUser()`; admin actions use `requireAdmin()`.
  - Role gates live in each route group's `layout.tsx`, never in middleware.
- **Untouched:**
  - The money path: `lib/wallet.ts`, `lib/actions/enrollments.ts` purchase code, `lib/actions/manual-payments.ts`.
  - `lib/rtk-client.ts` stays a module-level singleton, never converted to `useRealtimeKitClient()`, and `reactStrictMode: false` stays.
  - `ds/` is vendored; never edit it.
- **Code:** no new dependencies, no `any` (the meetings pages' existing `eslint-disable` lines stay as they are), no secrets, no hardcoded hex.
- **UI:**
  - The WorldStreet design system, with `ws-*` and shadcn-bridge tokens only.
  - Gold only for primary CTAs, active nav and brand moments; the score figure is ink, never gold.
  - Icons only through `@/components/icons`. The Mastery cell uses `GaugeIcon`; never lucide, Hugeicons or emoji.
  - Base UI composition uses `render`, never `asChild`.
  - Pills; 20 px cards (`CardShell` already is); Manrope; `·` separators; `tabular-nums` on every score, percentage and count.
  - Keep `(platform)` pages' existing bottom padding.
  - RSC-first: `"use client"` only where interaction needs it.
- **Where the score shows:** only on `(platform)` and `(admin)` surfaces, never on a public page, and only to the learner, their faculty (Phase 19) and admins. It has no cash value.
- **Words:**
  - New user-facing strings use the new vocabulary: *plan*, never package; *program* for Academy offerings.
  - Don't rename existing strings: the vocabulary pass runs last.
  - The copy below is exact.
- **No test runner, and none is added.** Pure rules are checked by a throwaway `node:assert/strict` script, run with `npx tsx` from a scratch directory outside the repository. Everything else is checked with:
  - `npx tsc --noEmit` (one stale `.next/types` error is not real);
  - `npx eslint <file>`, one changed file at a time, expecting no new errors against the count before the change;
  - driving the route in `dev:mock`.
- **Shell:** write scratch scripts with your file-writing tool. Heredocs that contain apostrophes fail in this shell.
- **Commits:** anchors in this plan are **quoted text**, never line numbers. Commit messages end with the attribution trailer your session's instructions give.

## Review Focus

1. **A learner closes the tab or locks the phone without pressing Leave.** The silent time must not be credited, and their earlier seconds must stay. Covered in Task 2, steps 7–8 (a 400 s silence banks 0; the end banks only a fresh interval).
2. **A learner rejoins after leaving or dropping out.** Seconds accumulate, `firstJoinedAt` never moves, and a host or an ad-hoc meeting records nothing. Covered in Task 2, steps 6 and 9–10.
3. **A Basic learner** (no live classes, no assignments, no certificate today). Those parts read "Not in your plan" and never lower anything. With completion alone, no score shows. Covered in Task 4, step 1 (`masteryView` drops excluded parts) and Task 5, step 7.
4. **Classes that shouldn't count.** An accidental 5-minute class, a class still running, a class before enrolment and a mentorship session are never "held". Covered in Task 5, step 7 (held = 4 of 9 seeded meetings).
5. **Ungraded or missing work.** A submitted-but-ungraded assignment must not drag the average to zero, and a project counts only under Projects. Covered in Task 5, step 7 (Assignments 80% from 70 and 90, with the ungraded one ignored; Projects 60%).

## Verification server

Each track runs its own `dev:mock` in its worktree, on its own ports. The controller fills `<PORT>` and `<DBPORT>`.

```bash
netstat -ano | grep -E ":<PORT>|:<DBPORT>"      # must print nothing first
RESEND_API_KEY=re_disabled_local CLOUDFLARE_REALTIME_API_KEY=disabled-local OPENAI_API_KEY=disabled-local \
ABLY_API_KEY=disabled-local R2_SECRET_ACCESS_KEY=disabled-local WALLET_SERVICE_TOKEN=disabled-local \
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_bG9jYWwuZGV2JA MOCK_DB_PORT=<DBPORT> PORT=<PORT> node scripts/dev-mock.mjs
MONGODB_URI=mongodb://127.0.0.1:<DBPORT>/worldstreet-academy node scripts/mastery-catalogue.mjs --apply
```

- The worktree has no `.env.local`; that is intended.
- RealtimeKit is disabled, so nobody can actually enter a room. Attendance is checked through the server actions instead (`act` below).
- Personas switch with the `mock_persona` cookie: `guest`, `student`, `instructor`, `admin`. The catalogue's programs belong to the seeded instructor. If `Forex Trading Mastery` belongs to someone else in your database, use `admin` for the instructor-side steps.
- Stop the server when done. A killed `dev:mock` leaves `next` and `mongod` alive, so check the ports before restarting.

**Helpers**, used by every task:

```bash
REPO=$(git rev-parse --show-toplevel); BASE=http://localhost:<PORT>; DBPORT=<DBPORT>; SCRATCH=$(mktemp -d)
# Page text with scripts and tags stripped (React's <!-- --> separators become spaces).
text() { curl -s ${2:+-b "mock_persona=$2"} "$BASE$1" | perl -0pe 's#<script\b.*?</script>##gs; s#<style\b.*?</style>##gs; s#<[^>]+># #g; s#&\#x27;#\x27#g; s#&quot;#"#g; s#&amp;#&#g; s#\s+# #g'; }
# act <file> <export> <persona> <json-args>: call a server action the way the browser does, through /dashboard/meetings.
act() {
  local id
  id=$(node -e 'const m=require(process.argv[1]);for(const[k,v]of Object.entries(m.node))for(const w of Object.values(v.workers))if(w.filename===process.argv[2]&&w.exportedName===process.argv[3]){console.log(k);process.exit(0)}process.exit(1)' "$REPO/.next/dev/server/server-reference-manifest.json" "$1" "$2") \
    || { echo "no action id for $2: open $BASE/dashboard/meetings once as $3, then retry"; return 1; }
  curl -s -X POST "$BASE/dashboard/meetings" -H "Next-Action: $id" -H "Origin: $BASE" \
    -H "Content-Type: text/plain;charset=UTF-8" -H "Accept: text/x-component" -b "mock_persona=$3" --data "$4"; echo
}
```

`act` reads the dev server's action manifest, which fills in as routes compile. Open `/dashboard/meetings` once as each persona first (`curl -s -o /dev/null -b mock_persona=student $BASE/dashboard/meetings`). The reply is the RSC stream; look for `"success":true` or the error text in it.

**`$SCRATCH/p16.mjs`**, the fixture (write it once; Tasks 2, 3, 5 and 6 use it). Run it as `node "$SCRATCH/p16.mjs" "$REPO" $DBPORT <command>`:

```js
// Phase 16 fixture. Commands: seed | att | backdate <seconds> | kinds
import { createRequire } from "node:module"

const [repo, port, command, arg] = process.argv.slice(2)
const mongoose = createRequire(`${repo}/package.json`)("mongoose")
await mongoose.connect(`mongodb://127.0.0.1:${port}/worldstreet-academy`)
const col = (name) => mongoose.connection.db.collection(name)
async function must(name, filter, hint) {
  const doc = await col(name).findOne(filter)
  if (!doc) throw new Error(`missing ${hint}`)
  return doc
}
const student = await must("users", { email: "student@worldstreet.academy" }, "the student")
const instructor = await must("users", { email: "instructor@worldstreet.academy" }, "the instructor")
const forex = await must("courses", { title: "Forex Trading Mastery" }, "Forex Trading Mastery (run the catalogue)")
const crypto = await must("courses", { title: "Crypto Trading Mastery" }, "Crypto Trading Mastery (run the catalogue)")
const now = Date.now(), MIN = 60_000, DAY = 86_400_000
const p16 = () => col("meetings").find({ title: /^P16 / }).project({ title: 1 }).toArray()

if (command === "seed") {
  const old = await p16()
  await col("attendances").deleteMany({ $or: [{ meeting: { $in: old.map((m) => m._id) } }, { user: student._id }] })
  await col("meetings").deleteMany({ title: /^P16 / })
  await col("submissions").deleteMany({ user: student._id, course: forex._id })
  await col("assignments").deleteMany({ course: forex._id, title: /^P16 / })
  await col("enrollments").deleteMany({ user: student._id, course: { $in: [forex._id, crypto._id] } })

  const enrolledAt = new Date(now - 30 * DAY)
  const enrollment = (course, packageKey, pricePaid, progress, bestScorePercent, lastAccessedAt) => ({
    user: student._id, course: course._id, status: "active", purchasedAt: enrolledAt, activatedAt: enrolledAt,
    pricePaid, currency: "USD", transactionId: `p16-${packageKey}`, legacyUnpaid: false, preEnrolledAt: null,
    packageKey, packageName: packageKey === "standard" ? "Standard" : "Basic", mentorshipIntake: null,
    certificateId: null, progress, completedLessons: [], lastAccessedLesson: null, lastAccessedAt, completedAt: null,
    examPassed: false, examPassedAt: null, bestScorePercent, mentorRoadmap: null, createdAt: enrolledAt, updatedAt: new Date(),
  })
  const fx = await col("enrollments").insertOne(enrollment(forex, "standard", 199, 50, 80, new Date(now)))
  await col("enrollments").insertOne(enrollment(crypto, "basic", 49, 20, null, new Date(now - DAY)))

  const assignment = async (title, kind) => (await col("assignments").insertOne({
    course: forex._id, instructor: instructor._id, title, instructions: "Seeded for the Phase 16 checks.",
    dueAt: null, status: "published", kind, createdAt: new Date(), updatedAt: new Date(),
  })).insertedId
  const submission = (assignmentId, grade) => ({
    assignment: assignmentId, course: forex._id, user: student._id, enrollment: fx.insertedId, text: "Seeded.",
    files: [], status: grade === null ? "submitted" : "graded", submittedAt: new Date(now - DAY), grade, feedback: "",
    gradedBy: grade === null ? null : instructor._id, gradedAt: grade === null ? null : new Date(),
    createdAt: new Date(), updatedAt: new Date(),
  })
  await col("submissions").insertMany([
    submission(await assignment("P16 Assignment one", "assignment"), 70),
    submission(await assignment("P16 Assignment two", "assignment"), 90),
    submission(await assignment("P16 Assignment three", "assignment"), null),
    submission(await assignment("P16 Project", "project"), 60),
  ])

  const settings = { allowScreenShare: true, muteOnEntry: true, requireApproval: true, guestAccess: true, maxParticipants: 50 }
  const meeting = async (title, startMs, minutes, extra = {}) => (await col("meetings").insertOne({
    title, description: "", hostId: instructor._id, status: "ended", meetingId: `p16-${title}`, hostToken: "p16",
    participants: [{ userId: instructor._id, role: "host", status: "admitted", joinedAt: new Date(startMs) }],
    invites: [], courseId: forex._id, settings, startedAt: new Date(startMs),
    endedAt: new Date(startMs + minutes * MIN), createdAt: new Date(startMs), updatedAt: new Date(), ...extra,
  })).insertedId
  const c1 = await meeting("P16 Class 1", now - 10 * DAY, 60)
  const c2 = await meeting("P16 Class 2", now - 9 * DAY, 40)
  const c3 = await meeting("P16 Class 3", now - 8 * DAY, 60)
  await meeting("P16 Class 4, missed", now - 7 * DAY, 60)
  await meeting("P16 Class 5, five minutes", now - 6 * DAY, 5)
  await meeting("P16 Class 6, before enrolment", now - 40 * DAY, 60)
  await meeting("P16 Mentorship session", now - 5 * DAY, 60, { mentorshipSessionId: new mongoose.Types.ObjectId() })
  const live = await meeting("P16 Live class", now - 30 * MIN, 0, { status: "active", endedAt: null })
  const adhoc = await meeting("P16 Ad-hoc meeting", now - 30 * MIN, 0, { status: "active", endedAt: null, courseId: null })
  const row = (m, seconds) => ({
    meeting: m, course: forex._id, user: student._id, firstJoinedAt: new Date(now - 10 * DAY),
    lastJoinedAt: new Date(now - 10 * DAY), openSince: null, seconds, createdAt: new Date(), updatedAt: new Date(),
  })
  await col("attendances").insertMany([row(c1, 1900), row(c2, 1300), row(c3, 1800)])
  console.log(`LIVE=${live} ADHOC=${adhoc} FOREX=${forex._id} CRYPTO=${crypto._id} STUDENT=${student._id}`)
}

if (command === "att") {
  await new Promise((resolve) => setTimeout(resolve, 1500)) // a join's write can land just after its reply
  const meetings = (await p16()).filter((m) => /^P16 (Live|Ad-hoc)/.test(m.title))
  const titles = new Map(meetings.map((m) => [String(m._id), m.title]))
  const who = (id) => (String(id) === String(student._id) ? "student" : String(id) === String(instructor._id) ? "instructor" : String(id))
  const rows = await col("attendances").find({ meeting: { $in: meetings.map((m) => m._id) } }).toArray()
  if (rows.length === 0) console.log("no attendance rows")
  for (const r of rows) {
    const open = r.openSince ? `open ${Math.round((Date.now() - r.openSince.getTime()) / 1000)}s` : "closed"
    console.log(`${titles.get(String(r.meeting))} · ${who(r.user)} · seconds=${r.seconds} · ${open} · first=${r.firstJoinedAt.toISOString()} · last=${r.lastJoinedAt.toISOString()}`)
  }
}

if (command === "backdate") {
  const live = await must("meetings", { title: "P16 Live class" }, "the live class (seed first)")
  const res = await col("attendances").updateOne(
    { meeting: live._id, user: student._id, openSince: { $ne: null } },
    { $set: { openSince: new Date(Date.now() - Number(arg) * 1000) } }
  )
  console.log(`backdated ${res.modifiedCount}`)
}

if (command === "kinds") {
  for (const a of await col("assignments").find({ course: forex._id }).sort({ createdAt: 1 }).toArray()) {
    console.log(`${a._id} · ${a.kind ?? "(none)"} · ${a.status} · ${a.title}`)
  }
}
await mongoose.disconnect()
```

**`$SCRATCH/pw16.cjs`**, for client-rendered pages. Run it as `node "$SCRATCH/pw16.cjs" <url> <persona> <selector> <waitText> [width] [theme] [shot.png]`; Playwright is installed globally:

```js
const { chromium } = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright")
const [url, persona, selector, waitText, width = "1440", theme = "dark", shot] = process.argv.slice(2)
;(async () => {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: Number(width), height: 900 } })
  await context.addCookies([{ name: "mock_persona", value: persona, url }])
  await context.addInitScript((t) => { try { localStorage.setItem("theme", t) } catch {} }, theme)
  const page = await context.newPage()
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 })
  await page.waitForFunction(([s, t]) => document.querySelector(s)?.textContent?.includes(t), [selector, waitText], { timeout: 90000 })
  console.log((await page.locator(selector).first().innerText()).replace(/\s+/g, " "))
  console.log("horizontal overflow:", await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth))
  if (shot) {
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }) // the dev "1 Issue" badge is the known Vivid 403
    await page.screenshot({ path: shot, fullPage: true })
  }
  await browser.close()
})()
```

Known `dev:mock` noise that is not a failure: the Vivid 403 in the console, a hydration warning on query pages, and no wallet chip.

## File structure

| File | Responsibility |
|---|---|
| `lib/db/models/attendance.ts` (new), `lib/db/models/index.ts` | `Attendance`: one row per learner per course class |
| `lib/attendance-rules.ts` (new, pure) | Banking, held and attended rules; heartbeat constants |
| `lib/attendance.ts` (new, server-only) | The only writer of `attendances` |
| `lib/actions/attendance.ts` (new) | `pingAttendance`, the heartbeat action |
| `lib/actions/meetings.ts` (modify) | Open, close and close-all calls in the meeting actions |
| `components/providers/meeting-provider.tsx` (modify) | The 60 s heartbeat |
| `lib/db/models/assignment.ts`, `lib/db/models/index.ts` (modify) | `Assignment.kind` |
| `lib/actions/assignments.ts` (modify) | `kind` in `saveAssignment` and the read models |
| `app/(instructor)/instructor/courses/[courseId]/assignments/page.tsx` (modify) | The Project toggle and chip |
| `lib/actions/exams.ts`, `components/dashboard/assignments-tile.tsx`, `app/(platform)/dashboard/assignments/[assignmentId]/page.tsx` (modify) | "Project" for learners |
| `lib/mastery-score.ts` (new, pure) | D24's weights, `masteryScore`, the view types, the part copy |
| `lib/mastery-inputs.ts` (new, server-only) | `masteryInputsFor`, `masteryInputsForMany`, `myMastery` |
| `components/dashboard/mastery-card.tsx` (new) | One program's score and parts (no hooks; usable from server and client trees) |
| `app/(platform)/dashboard/points/page.tsx` (modify) | The Mastery Score section |
| `lib/actions/mastery.ts`, `lib/hooks/queries/use-mastery.ts` (new); `lib/hooks/queries/keys.ts`, `index.ts` (modify) | `getMyMastery` and its hook |
| `components/dashboard/home-strip.tsx` (modify) | The hero's "Mastery" cell |
| `lib/actions/admin-enrollments.ts`, `app/(admin)/admin/enrollments/page.tsx` (modify) | The admin "Mastery" column |
| `docs/go-patches-phase-3.md`, `docs/launch-runbook.md`, `docs/institutional-blueprint-plan.md`, `docs/mastery-academy-plan.md`, `context.md` (modify) | Go note, owner note, status, decision log |

---

### Task 1: Attendance — the model and its rules

**Files:**
- Create: `lib/db/models/attendance.ts`, `lib/attendance-rules.ts`
- Modify: `lib/db/models/index.ts`
- Test: `$SCRATCH/attendance-rules.assert.ts` (throwaway, outside the repository)

**Interfaces:**
- Produces, in `lib/db/models/attendance.ts`, re-exported from the models barrel: `Attendance: Model<IAttendance>` and `IAttendance` (fields in step 4).
- Produces, in `lib/attendance-rules.ts` (pure and client-safe; it imports nothing at runtime):
  - Constants: `ATTENDANCE_PING_MS = 60_000`, `ATTENDANCE_STALE_MS = 150_000`, `MIN_HELD_CLASS_SECONDS = 600`, `ATTENDED_FRACTION = 0.5`, `ATTENDED_ENOUGH_SECONDS = 1800`.
  - `isCourseClass(meeting: { courseId?: unknown; mentorshipSessionId?: unknown }): boolean`. True when `courseId` is set and `mentorshipSessionId` is not.
  - `bankSeconds(openSince: Date, at: Date): number`. Whole seconds from `openSince` to `at`; 0 when the gap is negative, NaN or greater than `ATTENDANCE_STALE_MS`.
  - `attendedSeconds(row: { seconds: number; openSince: Date | null }, at: Date): number`. Equals `row.seconds + (openSince ? bankSeconds(openSince, at) : 0)`.
  - `classHeld(classSeconds: number): boolean`. True when `classSeconds >= MIN_HELD_CLASS_SECONDS`.
  - `classAttended(attended: number, classSeconds: number): boolean`. True when `attended > 0` and `attended >= Math.min(classSeconds * ATTENDED_FRACTION, ATTENDED_ENOUGH_SECONDS)`.
  - `attendancePercent(attended: number, held: number): number | null`. Null when `held <= 0`, else `min(attended, held) / held * 100`.
  - Phase 19 builds its "attendance by class" view from `attendedSeconds`, `classHeld` and `classAttended`; nothing re-derives them.

- [ ] **Step 1: Check first.**
  Run: `ls lib/attendance-rules.ts lib/db/models/attendance.ts; grep -c "Attendance" lib/db/models/index.ts`
  Expected: two "No such file" errors, then `0`.

- [ ] **Step 2: Write the assert script** `$SCRATCH/attendance-rules.assert.ts`. Replace `<REPO>` with the output of `git rev-parse --show-toplevel`; an absolute static import works from outside the repository.

```ts
import assert from "node:assert/strict"
import {
  ATTENDANCE_PING_MS, ATTENDANCE_STALE_MS, MIN_HELD_CLASS_SECONDS, ATTENDED_FRACTION, ATTENDED_ENOUGH_SECONDS,
  isCourseClass, bankSeconds, attendedSeconds, classHeld, classAttended, attendancePercent,
} from "<REPO>/lib/attendance-rules"

const t0 = new Date("2026-10-19T10:00:00Z")
const at = (ms: number) => new Date(t0.getTime() + ms)

assert.equal(ATTENDANCE_PING_MS, 60_000)
assert.equal(ATTENDANCE_STALE_MS, 150_000)
assert.equal(MIN_HELD_CLASS_SECONDS, 600)
assert.equal(ATTENDED_FRACTION, 0.5)
assert.equal(ATTENDED_ENOUGH_SECONDS, 1800)

assert.equal(isCourseClass({ courseId: "c" }), true)
assert.equal(isCourseClass({ courseId: "c", mentorshipSessionId: "s" }), false)
assert.equal(isCourseClass({ courseId: null }), false)
assert.equal(isCourseClass({}), false)

assert.equal(bankSeconds(t0, at(59_999)), 59)
assert.equal(bankSeconds(t0, at(150_000)), 150) // the stale limit itself still banks
assert.equal(bankSeconds(t0, at(150_001)), 0) // a silent tab banks nothing
assert.equal(bankSeconds(t0, at(-5_000)), 0)
assert.equal(bankSeconds(new Date(Number.NaN), t0), 0)

assert.equal(attendedSeconds({ seconds: 100, openSince: null }, t0), 100)
assert.equal(attendedSeconds({ seconds: 100, openSince: t0 }, at(30_000)), 130)
assert.equal(attendedSeconds({ seconds: 100, openSince: t0 }, at(600_000)), 100)

assert.equal(classHeld(599), false)
assert.equal(classHeld(600), true)

assert.equal(classAttended(1800, 7200), true) // 30 minutes of a two-hour class
assert.equal(classAttended(1799, 7200), false)
assert.equal(classAttended(1200, 2400), true) // half of a 40-minute class
assert.equal(classAttended(1199, 2400), false)
assert.equal(classAttended(300, 600), true)
assert.equal(classAttended(0, 600), false)
assert.equal(classAttended(0, 0), false)

assert.equal(attendancePercent(0, 0), null)
assert.equal(attendancePercent(3, 4), 75)
assert.equal(attendancePercent(0, 4), 0)
assert.equal(attendancePercent(5, 4), 100)
console.log("attendance rules: ok")
```

- [ ] **Step 3: Run it to see it fail.**
  Run: `cd "$SCRATCH" && npx tsx attendance-rules.assert.ts`
  Expected: it fails with "Cannot find module" for `lib/attendance-rules`.

- [ ] **Step 4: Create the model, `lib/db/models/attendance.ts`.** Copy the shape of `lib/db/models/point-event.ts`: a doc comment, the interface, the schema and the guarded `mongoose.models.Attendance || mongoose.model(...)` export.
  - **Doc comment.** Institutional blueprint §12 / D24: one row per learner per course class (`courseId` set, no `mentorshipSessionId`). It is written only by `lib/attendance.ts`, from the meeting actions and the 60 s heartbeat. `seconds` is the time banked; `openSince` is the start of the time not yet banked, null while the learner is out of the class. It is a new web-only collection that the Go API doesn't read, so mobile joins aren't counted.
  - **Fields** (`timestamps: true`):
    - `meeting`: ObjectId, ref `Meeting`, required.
    - `course`: ObjectId, ref `Course`, required.
    - `user`: ObjectId, ref `User`, required.
    - `firstJoinedAt: Date` and `lastJoinedAt: Date`, both required.
    - `openSince`: `{ type: Date, default: null }`.
    - `seconds`: `{ type: Number, default: 0, min: 0 }`.
  - **Index:** `AttendanceSchema.index({ meeting: 1, user: 1 }, { unique: true })`.
  - In `lib/db/models/index.ts`, after the `PointEvent` export line, add `export { Attendance, type IAttendance } from "./attendance"`.

- [ ] **Step 5: Create `lib/attendance-rules.ts`** per the Interfaces block. Its doc comment says it is pure and client-safe, that `MeetingProvider` imports the ping interval from it, and that D24 defines "attended" (≥ 50% of the class or ≥ 30 minutes). It also records that the 10-minute held floor is a named constant the owner can tune.

- [ ] **Step 6: Run the assert script again.**
  Run: `cd "$SCRATCH" && npx tsx attendance-rules.assert.ts`
  Expected: `attendance rules: ok`.

- [ ] **Step 7: Typecheck and lint.**
  Run: `npx tsc --noEmit`, then `npx eslint lib/attendance-rules.ts`, `npx eslint lib/db/models/attendance.ts` and `npx eslint lib/db/models/index.ts`.
  Expected: clean, apart from the one stale `.next/types` error.

- [ ] **Step 8: Commit.**

```bash
git add lib/db/models/attendance.ts lib/db/models/index.ts lib/attendance-rules.ts
git commit -m "feat(attendance): the attendances collection and its rules — banked seconds, held and attended classes"
```

---

### Task 2: Attendance capture — join, ping, leave, kick, end

**Files:**
- Create: `lib/attendance.ts`, `lib/actions/attendance.ts`
- Modify: `lib/actions/meetings.ts`, `components/providers/meeting-provider.tsx`

**Interfaces:**
- Consumes: `Attendance` (Task 1); `isCourseClass`, `bankSeconds` and `ATTENDANCE_PING_MS` (Task 1); `IMeeting` from `@/lib/db/models`.
- Produces, in `lib/attendance.ts` (`import "server-only"`; never `"use server"`). Each function **never rejects**: it catches, logs `[Attendance] …` and resolves, so attendance can never fail a meeting action.
  - `type AttendanceMeeting = Pick<IMeeting, "_id" | "hostId" | "courseId" | "mentorshipSessionId">`
  - `openAttendance(meeting: AttendanceMeeting, userId: string, now?: Date): Promise<void>`
  - `bankAttendance(meetingId: string, userId: string, now?: Date): Promise<void>`
  - `closeAttendance(meetingId: string, userId: string, at?: Date): Promise<void>`
  - `closeAllAttendance(meetingId: string, at: Date): Promise<void>`
- Produces, in `lib/actions/attendance.ts` (`"use server"`): `pingAttendance(meetingId: string): Promise<{ success: true; data: null } | { success: false; error: string }>`.

- [ ] **Step 1: Check first.** Start the verification server and write the two helper scripts.
  - Record the lint baseline: `npx eslint lib/actions/meetings.ts` and `npx eslint components/providers/meeting-provider.tsx`. Note each error count.
  - Run: `node "$SCRATCH/p16.mjs" "$REPO" $DBPORT seed`. Expected: one `LIVE=… ADHOC=… FOREX=… CRYPTO=… STUDENT=…` line. Then `eval` it: `eval "$(node "$SCRATCH/p16.mjs" "$REPO" $DBPORT seed)"`.
  - Open `/dashboard/meetings` once as `student` and once as `instructor` (curl) so the action manifest fills in.
  - Run: `act lib/actions/meetings.ts joinMeeting student "[\"$LIVE\"]"; node "$SCRATCH/p16.mjs" "$REPO" $DBPORT att`
  - Expected: the reply holds `Failed to join meeting` (RealtimeKit is disabled), and then `no attendance rows`.
  - Re-run `seed` afterwards, because the join saved the student as a participant.

- [ ] **Step 2: Create `lib/attendance.ts`.** The algorithm, which the rules don't determine:

```ts
// openAttendance — a learner is in the class from `now`.
if (!isCourseClass(meeting) || meeting.hostId.toString() === userId) return
const key = { meeting: meeting._id, user: new Types.ObjectId(userId) }
const row = await Attendance.findOne(key).select("openSince").lean()
if (!row) {
  // A parallel join that created the row first (E11000) has opened it already: return.
  await Attendance.create({ ...key, course: meeting.courseId, firstJoinedAt: now, lastJoinedAt: now, openSince: now, seconds: 0 })
  return
}
// Rejoin or second session: bank what was open (stale rule), then reopen. Never overwrite seconds.
await Attendance.updateOne(
  { _id: row._id, openSince: row.openSince ?? null },
  { $inc: { seconds: row.openSince ? bankSeconds(row.openSince, now) : 0 }, $set: { openSince: now, lastJoinedAt: now } }
)

// bankAttendance (the heartbeat): only an OPEN row; never reopens a closed one.
//   find { meeting, user, openSince: { $ne: null } } → updateOne(
//     { _id, openSince: row.openSince }, { $inc: { seconds: bankSeconds(row.openSince, now) }, $set: { openSince: now } })
// closeAttendance: the same find, then { $inc: { seconds: bankSeconds(row.openSince, at) }, $set: { openSince: null } }.
//   When the filtered update matched nothing (a ping banked it in between), re-read the open row and retry once.
// closeAllAttendance: every open row of the meeting, closed with the same filtered update (one bulkWrite),
//   then a single retry pass for the rows whose update matched nothing.
```

  Validate ids with `mongoose.isValidObjectId` and return quietly when one is invalid. The doc comment names the module as the only writer of `attendances` and states the stale rule.

- [ ] **Step 3: Create `lib/actions/attendance.ts`.** Copy the pattern of `lib/actions/points.ts`: `"use server"`, `connectDB()`, then `getCurrentUser()` from `@/lib/auth/actions`.
  - Signed out returns `{ success: false, error: "You need to be signed in" }`.
  - `z.string().regex(/^[a-f0-9]{24}$/)` failing returns `{ success: false, error: "Meeting not found" }`.
  - Otherwise it runs `await bankAttendance(meetingId, user.id)` and returns `{ success: true, data: null }`.
  - No `revalidatePath` (ruling 12). The doc comment says that `MeetingProvider` calls it every `ATTENDANCE_PING_MS` while a non-host is in a meeting.

- [ ] **Step 4: Hook the meeting actions** in `lib/actions/meetings.ts`. Import `openAttendance`, `closeAttendance` and `closeAllAttendance` from `@/lib/attendance`.
  - **The four `joinMeeting` paths.** Add `openAttendance(meeting, currentUser.id)` as the **last** element of the `Promise.all` under each comment below (ruling 3). The destructuring stays as it is.
    - `// User left previously — re-admit them`: the array that ends with `rejoinEvent) : Promise.resolve(),`.
    - `// Already admitted — parallelize RTK token + host lookup + notify old sessions`: the array that ends with `emitEvent(currentUser.id, sessionReplacedEvent),`.
    - `// Auto-admit as guest — no waiting room`: the array that ends with `emitEventToMany(admittedIds, joinedEvent) : Promise.resolve(),`. Course classes take this path.
    - `// Auto-admit as participant — parallelize save, RTK token, host lookup, and broadcast`: the array that ends with `emitEventToMany(otherAdmittedIds, joinedEvent) : Promise.resolve(),`.
  - **`admitParticipant`.** In the `Promise.all` under `// Parallelize ALL independent operations: DB save, user lookup, AND RTK token generation`, add `openAttendance(meeting, userId)` last.
  - **`leaveMeeting`.** Right after its `if (!meeting) return { success: false, error: "Meeting not found" }`, add `await closeAttendance(meeting._id.toString(), currentUser.id)`.
  - **`kickParticipant`.** Add `closeAttendance(meeting._id.toString(), userId)` to the `Promise.all` that holds `emitEvent(userId, eventPayload),`.
  - **`endMeeting`.** Right after the `await meeting.save()` under `// Save DB immediately, fire-and-forget Ably broadcasts`, add `await closeAllAttendance(meeting._id.toString(), meeting.endedAt ?? new Date())`.
  - The host path, the pending paths and `createCourseMeeting` stay untouched (the host never gets a row).

- [ ] **Step 5: The heartbeat** in `components/providers/meeting-provider.tsx`.
  - Import `pingAttendance` from `@/lib/actions/attendance` and `ATTENDANCE_PING_MS` from `@/lib/attendance-rules`.
  - After `const hasActiveMeeting = activeMeetingInfo !== null`, add one effect with these dependencies: `[activeMeetingInfo?.meetingId, activeMeetingInfo?.isHost]`.
  - Unless the meeting id is missing or the viewer is the host, it runs `setInterval(() => { void pingAttendance(id).catch(() => {}) }, ATTENDANCE_PING_MS)` and clears it on cleanup.
  - Comment: §12 attendance; the provider wraps every authed shell, so the beat survives navigating away while the meeting is minimised; the server ignores meetings that aren't course classes.
  - Check that both meetings pages register with the Mongo id. Run: `grep -n "meetingId: meeting.id" "app/(platform)/dashboard/meetings/page.tsx" "app/(instructor)/instructor/meetings/page.tsx"`. Expected: one hit in each.

- [ ] **Step 6: Verify join, ping and rejoin.** Re-seed and `eval` it, then run these in order. Read the `P16 Live class · student` line of `att` after each. `att` waits 1.5 s before reading, so a freshly opened row reads `open 1s` to `open 5s`, written "open ≤ 5s" below.
  1. Run `act lib/actions/meetings.ts joinMeeting student "[\"$LIVE\"]"` (the reply holds `Failed to join meeting`, which is expected), then `att`. Expected: `seconds=0`, open ≤ 5s, with `first` equal to `last`.
  2. Run `node "$SCRATCH/p16.mjs" "$REPO" $DBPORT backdate 90; act lib/actions/attendance.ts pingAttendance student "[\"$LIVE\"]"`, then `att`. Expected: the reply holds `"success":true`; `seconds` is 90–92, and the row is open ≤ 5s.
  3. Run `backdate 30`, then `act lib/actions/meetings.ts leaveMeeting student "[\"$LIVE\"]"`, then `att`. Expected: `seconds` is 120–124 · `closed`.
  4. Rejoin: run `act lib/actions/meetings.ts joinMeeting student "[\"$LIVE\"]"`, then `att`. Expected: the same `seconds` (120–124, which accumulate and aren't reset), the row is open, `first` is unchanged, and `last` is later.

- [ ] **Step 7: Verify the silent tab.** With the row open:
  - Run `backdate 400`, then `pingAttendance`, then `att`. Expected: `seconds` unchanged (the 400 s silence banks 0), and the row is open ≤ 5s.
  - Run `act lib/actions/attendance.ts pingAttendance student "[\"000000000000000000000000\"]"`. Expected: `"success":true`, with no change.

- [ ] **Step 8: Verify the end.**
  - Run `backdate 60`, then `act lib/actions/meetings.ts endMeeting instructor "[\"$LIVE\"]"`, then `att`. Expected: `"success":true`; `seconds` rose by 60–62 · `closed`.
  - Run `act lib/actions/attendance.ts pingAttendance student "[\"$LIVE\"]"`, then `att`. Expected: unchanged, because a ping never reopens a closed row.

- [ ] **Step 9: Verify that hosts and ad-hoc meetings record nothing.** Re-seed and `eval` it.
  - Run `act lib/actions/meetings.ts joinMeeting instructor "[\"$LIVE\"]"`. Expected: `"success":true` (the host path).
  - Run `act lib/actions/meetings.ts joinMeeting student "[\"$ADHOC\"]"`.
  - Then `att`. Expected: `no attendance rows` (no instructor row, no ad-hoc row).

- [ ] **Step 10: Verify the kick.** Re-seed and `eval` it.
  - Run the student's `joinMeeting` on `$LIVE`, then `backdate 45`, then `act lib/actions/meetings.ts kickParticipant instructor "[\"$LIVE\",\"$STUDENT\"]"`.
  - Then `att`. Expected: `seconds` is 45–47 · `closed`.

- [ ] **Step 11: Typecheck and lint.**
  - Run: `npx tsc --noEmit`, then `npx eslint` on each of `lib/attendance.ts`, `lib/actions/attendance.ts`, `lib/actions/meetings.ts` and `components/providers/meeting-provider.tsx`.
  - Expected: the new files are clean, and the two modified files show no more errors than the baseline from step 1.

- [ ] **Step 12: Commit.**

```bash
git add lib/attendance.ts lib/actions/attendance.ts lib/actions/meetings.ts components/providers/meeting-provider.tsx
git commit -m "feat(attendance): web class joins, a one-minute heartbeat, leaves, kicks and ends record attendance"
```

---

### Task 3: Projects — `Assignment.kind`

**Files:**
- Modify:
  - `lib/db/models/assignment.ts` and `lib/db/models/index.ts`
  - `lib/actions/assignments.ts`
  - `app/(instructor)/instructor/courses/[courseId]/assignments/page.tsx`
  - `lib/actions/exams.ts` and `components/dashboard/assignments-tile.tsx`
  - `app/(platform)/dashboard/assignments/[assignmentId]/page.tsx`

**Interfaces:**
- Produces:
  - `type AssignmentKind = "assignment" | "project"`, exported from the models barrel beside `AssignmentStatus`.
  - `IAssignment.kind: AssignmentKind`, with schema `{ type: String, enum: ["assignment", "project"], default: "assignment" }`.
  - `saveAssignment`'s input gains a required `kind: AssignmentKind`, validated by `kind: z.enum(["assignment", "project"])`.
  - `kind: AssignmentKind` is added to `InstructorAssignment` and `StudentAssignment`; `MyAssessment` gains `kind: AssignmentKind | null` (null for exams).
  - Every reader maps a missing kind to `"assignment"`.
- Task 5 reads `Assignment.kind`.

- [ ] **Step 1: Check first.** Run: `node "$SCRATCH/p16.mjs" "$REPO" $DBPORT kinds`
  Expected: the four `P16 …` rows. Then run: `grep -n "kind" lib/db/models/assignment.ts`. Expected: no output.

- [ ] **Step 2: Model.** In `lib/db/models/assignment.ts`, add the type, the interface field (doc: "`project` grades feed the Mastery Score's Projects part, §12 'practical application'; a missing kind reads as `assignment`") and the schema field. Export `type AssignmentKind` from `lib/db/models/index.ts`.

- [ ] **Step 3: Actions** (`lib/actions/assignments.ts`).
  - `AssignmentInput` gains `kind` after `published: z.boolean(),`.
  - `saveAssignment`'s input type gains `kind: AssignmentKind`, and `fields` gains `kind: parsed.data.kind`.
  - `InstructorAssignment` and the `getCourseAssignments` mapping gain `kind: a.kind ?? "assignment"`.
  - `StudentAssignment` and `getAssignmentForStudent` gain `kind: gate.assignment.kind ?? "assignment"`.

- [ ] **Step 4: Learner list** (`lib/actions/exams.ts`, `getMyAssessments`).
  - The `Assignment.find` `.select("course title dueAt")` becomes `.select("course title dueAt kind")`.
  - The assignment row (`scope: "assignment",`) gains `kind: assignment.kind ?? "assignment"`.
  - The exam row (`scope: isQuiz ? "lesson" : "final",`) gains `kind: null`.
  - `MyAssessment` gains the field with the doc "Assignments only: `project` or `assignment`; null for exams".
  - In `components/dashboard/assignments-tile.tsx`, `assessmentKindLabel` returns `Project · due …` / `Project` when `assessment.kind === "project"`, using the same date format as the assignment branch. Update its doc comment.

- [ ] **Step 5: The instructor editor** (`AssignmentForm`).
  - Add a state, `isProject`, initialised from `initial?.kind === "project"`, and pass `kind: isProject ? "project" : "assignment"` to `saveAssignment`.
  - Under the grid that holds the Published checkbox, add a second checkbox label in the same classes:
    ```
    Project — its grade counts toward the Projects part of the Mastery Score
    ```
  - In `AssignmentCard`, beside the `Published`/`Draft` chip, render a `Project` chip (same chip classes, `bg-ws-chip text-ws-primary`) when `assignment.kind === "project"`.

- [ ] **Step 6: The learner's detail page.** In the `<header>` of `app/(platform)/dashboard/assignments/[assignmentId]/page.tsx`, between the course-title `<p>` and the `<h1>`, render `<span className="inline-flex rounded-full bg-ws-chip px-2 py-0.5 text-[10px] font-semibold text-ws-primary">Project</span>` when `assignment.kind === "project"`.

- [ ] **Step 7: Verify, driving the UI.**
  - **Create.** As `instructor`, open `$BASE/instructor/courses/$FOREX/assignments` in a browser (Playwright or Chrome). Create "P16 Capstone project", with instructions "Build and present a trading plan.", Published, and Project ticked.
    Expected: its card shows `Published` and `Project`.
  - **Edit.** Edit "P16 Assignment one", tick Project, save, then edit it again and untick it.
  - Run: `node "$SCRATCH/p16.mjs" "$REPO" $DBPORT kinds`
    Expected: `project · published · P16 Capstone project`, and `assignment · published · P16 Assignment one` (it went to project and back).
  - **The learner's list.** Run: `node "$SCRATCH/pw16.cjs" "$BASE/dashboard/assignments" student body "P16 Capstone project"`
    Expected: the text holds `P16 Capstone project Project · Forex Trading Mastery Not started` and `P16 Project Project · Forex Trading Mastery Graded`.
  - **The learner's detail page.** Run: `node "$SCRATCH/pw16.cjs" "$BASE/dashboard/assignments/<Capstone id from kinds>" student body "Capstone"`
    Expected: the text holds `Forex Trading Mastery Project P16 Capstone project`.

- [ ] **Step 8: Typecheck and lint.**
  Run: `npx tsc --noEmit` and `npx eslint` on each changed file.
  Expected: clean.

- [ ] **Step 9: Commit.**

```bash
git add lib/db/models/assignment.ts lib/db/models/index.ts lib/actions/assignments.ts lib/actions/exams.ts components/dashboard/assignments-tile.tsx "app/(instructor)/instructor/courses/[courseId]/assignments/page.tsx" "app/(platform)/dashboard/assignments/[assignmentId]/page.tsx"
git commit -m "feat(assignments): projects — an assignment kind that feeds the Mastery Score"
```

---

### Task 4: The Mastery Score rules

**Files:**
- Create: `lib/mastery-score.ts`
- Test: `$SCRATCH/mastery-score.assert.ts` (throwaway)

**Interfaces:**
- Produces (pure and client-safe; type-only imports at most). Phases 17 and 19 consume these exact names:

```ts
export const MASTERY_WEIGHTS = { completion: 30, assessment: 25, assignments: 20, projects: 10, attendance: 15 } as const
export type MasteryKey = keyof typeof MASTERY_WEIGHTS
export const MASTERY_KEYS: readonly MasteryKey[] = ["completion", "assessment", "assignments", "projects", "attendance"]
export const MASTERY_MIN_PARTS = 2
/** Each 0–100; null when the plan excludes the part or it has no data. */
export type MasteryInputs = Record<MasteryKey, number | null>
export type MasteryPart = { key: MasteryKey; value: number | null; weight: number }
export type MasteryResult = { score: number | null; parts: MasteryPart[] }
export type MasteryClasses = { attended: number; held: number }
export type MasteryFacts = {
  inputs: MasteryInputs
  /** Parts the plan doesn't include, in MASTERY_KEYS order. */
  excluded: MasteryKey[]
  /** Null when the plan has no live classes. */
  classes: MasteryClasses | null
  /** Highest graded project (0–100), null when none or the plan has no assignments; Phase 17's Mastery tier. */
  bestProjectGrade: number | null
}
export type MasteryView = { result: MasteryResult; excluded: MasteryKey[]; classes: MasteryClasses | null }
export type MyMastery = MasteryView & { enrollmentId: string; courseId: string; courseTitle: string }
export function masteryScore(inputs: MasteryInputs): MasteryResult
export function masteryView(facts: MasteryFacts): MasteryView
export const MASTERY_PART_COPY: Record<MasteryKey, { label: string; hint: string }>
```

- **`masteryScore`:**
  - A non-finite value counts as null; the rest are clamped to [0, 100].
  - The score is the mean of the clamped values, weighted by `MASTERY_WEIGHTS` over the non-null parts only, rounded with `Math.round`. It is null when fewer than `MASTERY_MIN_PARTS` parts have values.
  - `parts` always holds all five keys in `MASTERY_KEYS` order, with `value` set to the clamped value rounded with `Math.round` (or null) and `weight` set to the nominal weight.
- **`masteryView`** nulls every key in `facts.excluded` before scoring, so a part the plan doesn't include can never count. It passes `excluded` and `classes` through.
- **`MASTERY_PART_COPY`** (exact):
  - completion: "Completion" / "Lessons your plan opens"
  - assessment: "Assessments" / "Your best final-exam score"
  - assignments: "Assignments" / "Average grade, graded work only"
  - projects: "Projects" / "Average project grade"
  - attendance: "Attendance" / "Live classes joined on the web"

- [ ] **Step 1: Write the assert script** `$SCRATCH/mastery-score.assert.ts`, importing from `<REPO>/lib/mastery-score`:

```ts
import assert from "node:assert/strict"
import { MASTERY_WEIGHTS, MASTERY_KEYS, MASTERY_MIN_PARTS, masteryScore, masteryView, type MasteryInputs, type MasteryResult } from "<REPO>/lib/mastery-score"

const none: MasteryInputs = { completion: null, assessment: null, assignments: null, projects: null, attendance: null }
const value = (r: MasteryResult, key: string) => r.parts.find((p) => p.key === key)?.value

assert.deepEqual(MASTERY_WEIGHTS, { completion: 30, assessment: 25, assignments: 20, projects: 10, attendance: 15 })
assert.equal(Object.values(MASTERY_WEIGHTS).reduce((a, b) => a + b, 0), 100)
assert.deepEqual([...MASTERY_KEYS], ["completion", "assessment", "assignments", "projects", "attendance"])
assert.equal(MASTERY_MIN_PARTS, 2)

const empty = masteryScore(none)
assert.equal(empty.score, null)
assert.deepEqual(empty.parts.map((p) => [p.key, p.value, p.weight]), [
  ["completion", null, 30], ["assessment", null, 25], ["assignments", null, 20], ["projects", null, 10], ["attendance", null, 15],
])

const one = masteryScore({ ...none, completion: 50 }) // one part is not a score
assert.equal(one.score, null)
assert.equal(value(one, "completion"), 50)

assert.equal(masteryScore({ completion: 50, assessment: 80, assignments: 80, projects: 60, attendance: 75 }).score, 68)
assert.equal(masteryScore({ completion: 50, assessment: null, assignments: 80, projects: 60, attendance: 75 }).score, 64) // re-weighted
assert.equal(masteryScore({ ...none, completion: 100, attendance: 0 }).score, 67)

const clamped = masteryScore({ ...none, completion: 140, assessment: -20 })
assert.equal(clamped.score, 55)
assert.equal(value(clamped, "completion"), 100)
assert.equal(value(clamped, "assessment"), 0)

const nan = masteryScore({ ...none, completion: Number.NaN, assessment: 90, assignments: 70 })
assert.equal(nan.score, 81)
assert.equal(value(nan, "completion"), null)

const fractions = masteryScore({ ...none, completion: 33.4, assessment: 79.5 }) // parts round; the score uses raw values
assert.equal(value(fractions, "completion"), 33)
assert.equal(value(fractions, "assessment"), 80)
assert.equal(fractions.score, 54)

// A part the plan doesn't include never counts, even when a value slipped through.
const basic = masteryView({
  inputs: { ...none, completion: 20, assessment: 90 },
  excluded: ["assessment", "assignments", "projects", "attendance"],
  classes: null,
  bestProjectGrade: null,
})
assert.equal(basic.result.score, null)
assert.equal(value(basic.result, "assessment"), null)
assert.deepEqual(basic.excluded, ["assessment", "assignments", "projects", "attendance"])
assert.equal(basic.classes, null)
console.log("mastery score: ok")
```

- [ ] **Step 2: Run it to see it fail.**
  Run: `cd "$SCRATCH" && npx tsx mastery-score.assert.ts`
  Expected: "Cannot find module".

- [ ] **Step 3: Create `lib/mastery-score.ts`** per the Interfaces block. Its doc comment records:
  - D24 and institutional blueprint §12;
  - 0–100 per program, computed on read, never stored, no cash value;
  - visible only to the learner, their faculty and admins, never on a public page;
  - `MASTERY_WEIGHTS` is the one constant the owner tunes;
  - the server loader is `lib/mastery-inputs.ts`.

- [ ] **Step 4: Run it to see it pass.**
  Run: `cd "$SCRATCH" && npx tsx mastery-score.assert.ts`
  Expected: `mastery score: ok`.

- [ ] **Step 5: Typecheck and lint.**
  Run: `npx tsc --noEmit && npx eslint lib/mastery-score.ts`
  Expected: clean.

- [ ] **Step 6: Commit.**

```bash
git add lib/mastery-score.ts
git commit -m "feat(mastery): the Mastery Score — D24's weighted, re-weighting mean over the parts a plan includes"
```

---

### Task 5: Score inputs and the points page

**Files:**
- Create: `lib/mastery-inputs.ts`, `components/dashboard/mastery-card.tsx`
- Modify: `app/(platform)/dashboard/points/page.tsx`

**Interfaces:**
- Consumes:
  - Task 1: `Attendance`, `attendedSeconds`, `classHeld`, `classAttended`, `attendancePercent`.
  - Task 3: `Assignment.kind`.
  - Task 4: `masteryView` and the types.
  - Existing: `entitlementsFor` (`lib/entitlements.ts`) and `courseKindOf` (`lib/course-kind.ts`).
- Produces, in `lib/mastery-inputs.ts` (`import "server-only"`). Callers have run `connectDB()`. Phases 17 and 19 call these exact signatures:

```ts
type Id = Types.ObjectId | string
export type MasteryEnrollmentRow = {
  _id: Id; user: Id; course: Id
  packageKey?: PackageKey | null
  progress?: number | null
  bestScorePercent?: number | null
  activatedAt?: Date | null
  purchasedAt?: Date | null
  createdAt?: Date | null
}
export type MasteryCourseRow = { _id: Id; packages?: ICoursePackage[] | null }
export function masteryInputsFor(enrollment: MasteryEnrollmentRow, course: MasteryCourseRow): Promise<MasteryFacts>
/** Keyed by enrollment id. Four queries at most, whatever the list length. */
export function masteryInputsForMany(rows: { enrollment: MasteryEnrollmentRow; course: MasteryCourseRow }[]): Promise<Map<string, MasteryFacts>>
/** The learner's Academy programs (active or completed), most recently opened first. */
export function myMastery(userId: string): Promise<MyMastery[]>
```

- Produces `MasteryCard({ title, mastery }: { title: string; mastery: MasteryView })` in `components/dashboard/mastery-card.tsx`. It has no `"use client"` and no hooks, so Phase 19 can render it from client pages too.

- [ ] **Step 1: Check first.** Re-seed (`eval "$(node "$SCRATCH/p16.mjs" "$REPO" $DBPORT seed)"`).
  Run: `text /dashboard/points student | grep -c "Mastery Score"`
  Expected: `0`.

- [ ] **Step 2: Create `lib/mastery-inputs.ts`.** `masteryInputsForMany`, for each `{ enrollment, course }` with `ent = entitlementsFor(course, enrollment)` (rulings 4–7):
  - **completion** = `enrollment.progress ?? 0`. It is never excluded.
  - **assessment** = `ent.certificate ? (enrollment.bestScorePercent ?? null) : null`. It is excluded when `!ent.certificate`.
  - **assignments / projects** = when `ent.assignments`, the mean `grade` of the learner's submissions on that course with `status: "graded"` and `grade` not null, split by the assignment's `kind` (missing means `"assignment"`). The mean is null when there are none. Both are excluded when `!ent.assignments`. `bestProjectGrade` is the highest project grade, null when there is none or the part is excluded.
  - **attendance**, when `ent.liveClasses`:
    - The window opens at `activatedAt ?? purchasedAt ?? createdAt`.
    - For each ended course class of that course with `classSeconds = (endedAt − startedAt) / 1000`, where `startedAt` ≥ the window and `classHeld(classSeconds)`, the class counts as held. It counts as attended when `classAttended(attendedSeconds(row, endedAt), classSeconds)` for the learner's row (no row means not attended).
    - `classes = { attended, held }` and `attendance = attendancePercent(attended, held)`.
    - It is excluded, with `classes: null`, when `!ent.liveClasses`.
  - **Queries**, each skipped when its id list is empty:
    1. `Submission.find({ user: { $in }, course: { $in }, status: "graded", grade: { $ne: null } }).select("user course assignment grade")`, then pair by `${user}:${course}`.
    2. `Assignment.find({ _id: { $in: submissionAssignmentIds } }).select("kind")`.
    3. `Meeting.find({ courseId: { $in: liveCourseIds }, mentorshipSessionId: null, status: "ended", startedAt: { $ne: null, $gte: earliestWindow }, endedAt: { $ne: null } }).select("courseId startedAt endedAt")`.
    4. `Attendance.find({ meeting: { $in: heldIds }, user: { $in: liveUserIds } }).select("meeting user seconds openSince")`, paired by `${meeting}:${user}`.
  - `masteryInputsFor` returns `(await masteryInputsForMany([{ enrollment, course }])).get(id)`.
  - **`myMastery(userId)`:**
    - `Enrollment.find({ user, status: { $in: ["active", "completed"] } }).sort({ lastAccessedAt: -1, createdAt: -1 }).select("user course packageKey progress bestScorePercent activatedAt purchasedAt createdAt")`.
    - `Course.find({ _id: { $in } }).select("title packages kind")`, keeping only the programs (ruling 9).
    - Map each to `{ enrollmentId, courseId, courseTitle, ...masteryView(facts) }`, in enrollment order.
    - It returns `[]` for an invalid id.

- [ ] **Step 3: Create `components/dashboard/mastery-card.tsx`.**
  - Compose `CardShell` and `CardHeader` from `@/components/ui/system`, in the grammar of the points page's "How you earn points" card.
  - **React splits text nodes, so build every line below as one template-literal string.** The page-text checks depend on it.
  - The order:
    1. **Header.** `CardHeader` with `title={title}`, `subtitle="Mastery Score"` and, when `score !== null`, `right` set to `{score}` in `text-[22px] font-semibold tabular-nums`, followed by a muted `<span> / 100</span>`.
    2. **Null score.** When `score === null`, a muted line under the header: `Your score shows once two parts have data.`
    3. **Parts.** A `<ul>` with one `<li>` per part, in order.
       - The left block holds the label (`text-[14px] font-medium`) and a muted line, `` `${hint} · weighs ${weight}%` ``. For attendance with `classes.held > 0`, the hint is `` `${attended} of ${held} classes · joined on the web` ``.
       - The right block (`tabular-nums`) holds `` `${value}%` `` in `font-semibold`. A null value shows muted text instead: `Not in your plan` when the key is in `excluded`; else `No classes held yet` for attendance; else `No data yet`.
    4. **Footer.** A muted line: `Parts your plan doesn't include, or that have no data yet, don't count; the rest are re-weighted. No cash value.`

- [ ] **Step 4: The points page** (`app/(platform)/dashboard/points/page.tsx`).
  - After the `Promise.all` try block, load the cards separately, so a failure hides only this section: `const mastery = await myMastery(user.id).catch((error) => { console.error("Mastery Score error:", error); return null })`.
  - When `data` loaded and `mastery?.length`, render `<Rise delay={60}><section id="mastery" aria-label="Mastery Score" className="flex scroll-mt-24 flex-col gap-6">` right after the `Rise` holding `<Stat label="This week"`, with one `<MasteryCard title={m.courseTitle} mastery={m} />` per entry.
  - The rest of the page is unchanged.

- [ ] **Step 5: Typecheck and lint.**
  Run: `npx tsc --noEmit`, then `npx eslint` on each of `lib/mastery-inputs.ts`, `components/dashboard/mastery-card.tsx` and `app/(platform)/dashboard/points/page.tsx`.
  Expected: clean.

- [ ] **Step 6: Verify the Standard program.** The fixture's Forex enrollment (Standard: live classes, assignments, certificate) has:
  - completion 50, best final 80;
  - graded assignments 70 and 90 plus one ungraded;
  - one project graded 60;
  - nine seeded meetings, of which four are held (classes 1–4) and three attended (1,900 s of 60 min, 1,300 s of 40 min, 1,800 s of 60 min).

  Run: `text /dashboard/points student | grep -oE "Forex Trading Mastery Mastery Score 68 / 100|Completion Lessons your plan opens · weighs 30% 50%|Assessments Your best final-exam score · weighs 25% 80%|Assignments Average grade, graded work only · weighs 20% 80%|Projects Average project grade · weighs 10% 60%|Attendance 3 of 4 classes · joined on the web · weighs 15% 75%" | sort -u | wc -l`
  Expected: `6`.

- [ ] **Step 7: Verify the Basic program and the review focus.**
  - Run: `text /dashboard/points student | grep -oE "Crypto Trading Mastery Mastery Score Your score shows once two parts have data\.|Completion Lessons your plan opens · weighs 30% 20%" | sort -u | wc -l`
    Expected: `2`.
  - Run: `text /dashboard/points student | grep -o "Not in your plan" | wc -l`
    Expected: `4` (Crypto's four parts; Forex has none).
  - The numbers in step 6 already prove four things:
    - the 5-minute class, the class before enrolment, the mentorship session and the running class weren't held (held = 4);
    - the ungraded assignment didn't count (80 = mean of 70 and 90);
    - the project counted only under Projects;
    - Basic's parts never lowered anything.

- [ ] **Step 8: Look at it.**
  - Run `pw16.cjs` on `$BASE/dashboard/points` as `student`, with `'#mastery' "Mastery Score"`, at `1440 dark`, `390 dark` and `390 light`, each with a screenshot.
  - Expected: `horizontal overflow: false` each time; long hints truncate rather than wrap the figure off the card; the score reads in both themes.

- [ ] **Step 9: Commit.**

```bash
git add lib/mastery-inputs.ts components/dashboard/mastery-card.tsx "app/(platform)/dashboard/points/page.tsx"
git commit -m "feat(mastery): Mastery Score inputs and a score card per program on the points page"
```

---

### Task 6: The hero's "Mastery" cell and the admin column

**Files:**
- Create: `lib/actions/mastery.ts`, `lib/hooks/queries/use-mastery.ts`
- Modify:
  - `lib/hooks/queries/keys.ts` and `lib/hooks/queries/index.ts`
  - `components/dashboard/home-strip.tsx`
  - `lib/actions/admin-enrollments.ts` and `app/(admin)/admin/enrollments/page.tsx`

**Interfaces:**
- Consumes: `myMastery`, `masteryInputsForMany` (Task 5); `masteryView` and `MyMastery` (Task 4).
- Produces:
  - `getMyMastery(): Promise<MyMastery[] | null>` (`"use server"`, the `getMyPointsSummary` pattern: null when signed out or on error).
  - `queryKeys.mastery = ["mastery"] as const`, placed after `points`.
  - `useMyMastery()`, the `useMyPoints` pattern with `staleTime: 60 * 1000`, exported from the queries barrel.
  - `AdminEnrollmentRow.mastery: number | null`.

- [ ] **Step 1: Check first.** Re-seed.
  Run: `node "$SCRATCH/pw16.cjs" "$BASE/dashboard" student '[aria-label="Your learning at a glance"]' "Points"`
  Expected: no `Mastery` in the printed text.

- [ ] **Step 2: Action, key and hook,** per the Interfaces block. `lib/actions/mastery.ts` mirrors `lib/actions/points.ts` line for line.

- [ ] **Step 3: The hero cell** (`components/dashboard/home-strip.tsx`).
  - Add `function MasteryStat()`. It reads `useMyMastery()`, takes the first entry whose `result.score !== null`, and returns `null` while loading or when there is none.
  - Otherwise it returns `<StatCell icon={GaugeIcon} value={entry.result.score} label={...} href="/dashboard/points#mastery" />`, where `label` is `` data.length > 1 ? `Mastery · ${entry.courseTitle}` : "Mastery Score" ``.
  - Render it right after `<PointsStat />` in `HeroStats`, and add `GaugeIcon` to the icons import.
  - Extend the `HeroStats` doc comment: "the Mastery Score once a program has one".

- [ ] **Step 4: The admin column.**
  - **The action** (`lib/actions/admin-enrollments.ts`):
    - Add `kind` to `.populate("course", "title pricing status availableAt packages")`.
    - After `mapped = mapped.slice(0, PAGE_SIZE)`, build `{ enrollment, course }` pairs for the page's rows whose course is a program (`courseKindOf`) and whose status is `active` or `completed`. Use the raw `rows` docs, matched by id, with `user: user._id` and `course: course._id`; skip rows whose user or course is gone.
    - Call `masteryInputsForMany` once and set `mastery = masteryView(facts).result.score` on each mapped row (`null` otherwise).
    - `AdminEnrollmentRow` gains `mastery: number | null` after `progress: number`.
  - **The page** (`app/(admin)/admin/enrollments/page.tsx`):
    - Add `<TableHead>Mastery</TableHead>` after `<TableHead>Progress</TableHead>`.
    - Add a cell after the progress cell: `<span className="text-xs tabular-nums">{e.mastery ?? "—"}</span>`, with the dash in `text-muted-foreground`.

- [ ] **Step 5: Verify the hero.**
  Run: `node "$SCRATCH/pw16.cjs" "$BASE/dashboard" student '[aria-label="Your learning at a glance"]' "Mastery"`
  Expected: the text holds `68 Mastery · Forex Trading Mastery`, and `horizontal overflow: false`. Repeat at width `390`: no overflow.

- [ ] **Step 6: Verify the admin column.**
  Run: `node "$SCRATCH/pw16.cjs" "$BASE/admin/enrollments" admin table "Mastery"`
  Expected: the text holds `50% 68` (Forex) and `20% —` (Crypto).

- [ ] **Step 7: Never public, never anyone else's.**
  - Run: `grep -rlE "mastery-inputs|mastery-card|getMyMastery|useMyMastery|masteryInputsFor" "app/(marketing)" components/marketing components/schools components/schools-index components/programs components/faculty 2>/dev/null`
    Expected: no output.
  - Run: `grep -n '"use server"' lib/mastery-inputs.ts lib/attendance.ts`
    Expected: no output.

- [ ] **Step 8: Typecheck and lint.**
  Run: `npx tsc --noEmit`, then `npx eslint` on each changed file.
  Expected: clean.

- [ ] **Step 9: Commit.**

```bash
git add lib/actions/mastery.ts lib/hooks/queries/use-mastery.ts lib/hooks/queries/keys.ts lib/hooks/queries/index.ts components/dashboard/home-strip.tsx lib/actions/admin-enrollments.ts "app/(admin)/admin/enrollments/page.tsx"
git commit -m "feat(mastery): the Mastery Score in the dashboard hero and the admin enrollments table"
```

---

### Task 7: Docs and the closing run

**Files:**
- Modify: `docs/go-patches-phase-3.md`, `docs/launch-runbook.md`, `docs/institutional-blueprint-plan.md`, `docs/mastery-academy-plan.md`, `context.md`

**Interfaces:** none.

- [ ] **Step 1: The Go note.** Append a section to `docs/go-patches-phase-3.md` with the next free section number: `## N. Phase 16 — Mastery Score and attendance (institutional blueprint §12)`. Its content:
  - **No patch.** Go needs no patch: nothing it reads changed.
  - **`attendances`.** A new web-only collection; Go may ignore it.
    - A fields table: `meeting`, `course`, `user` (ObjectIds), `firstJoinedAt`, `lastJoinedAt`, `openSince` (Date | null: the start of time not yet banked), `seconds` (banked), plus timestamps.
    - The unique index on `{ meeting, user }`.
    - The web writes rows only for course classes (`courseId` set, no `mentorshipSessionId`), never for the host.
  - **Optional R-A.** Mobile joins aren't counted until Go writes the same rows:
    - on a join, bank and reopen;
    - every 60 s while in the class, add `now − openSince` when ≤ 150 s, else 0, and set `openSince = now`;
    - on leave or kick, bank and set `null`;
    - on end, bank every open row at `endedAt`;
    - filter every update on the `openSince` value read.
  - **`assignments.kind`.** `"assignment" | "project"` (missing means assignment), on a web-only collection.
  - **The Mastery Score.** Computed on read from enrollments, submissions, meetings and attendances; nothing is stored. If mobile ever shows it, it must use `lib/mastery-score.ts`'s weights.

- [ ] **Step 2: The runbook.** In `docs/launch-runbook.md`, find the owner-steps section for the institutional phases. If no other track has created it yet, add `## Institutional blueprint phases — owner steps` at the end. Under it, add `### Phase 16 — Mastery Score and attendance` with these points:
  - No script, no env, no data migration; the `attendances` index builds itself at boot.
  - Smoke test after deploy: as a Standard learner, join a live class on the web for over two minutes and leave, then check `db.attendances.find({ user: <id> })` shows `seconds` > 0 and `openSince: null`.
  - Classes joined in the mobile app don't count until Go R-A.

- [ ] **Step 3: Status.**
  - In `docs/institutional-blueprint-plan.md`, tick Phase 16's three exit criteria. Add `**Task plan:** \`docs/plans/mastery-phase-16.md\`.` to its header line. Set its §3 status cell to `done (<date>, <n> commits)`.
  - Set row 16 in `docs/mastery-academy-plan.md` to match.
  - Add a dated `context.md` decision-log entry: the Mastery Score (D24 weights, programs only, computed on read); attendance via the heartbeat (rulings 1 and 4, with the 10-minute floor); projects as an assignment kind; where the score shows.

- [ ] **Step 4: The closing run.**
  - Re-seed. At 1440 and 390 px, in dark and light, check `/dashboard/points` and `/dashboard` as `student`, `/admin/enrollments` as `admin`, and `/instructor/courses/$FOREX/assignments` as `instructor`.
  - Expected: no horizontal scroll, no console errors apart from the known Vivid 403, and every figure in `tabular-nums`.
  - Re-run both assert scripts. Expected: `attendance rules: ok` and `mastery score: ok`.

- [ ] **Step 5: Whole-repository checks.**
  Run: `pnpm lint` and `npx tsc --noEmit`
  Expected: no new lint errors against the count before Task 1 (record both numbers); tsc clean apart from the stale `.next/types` error.

- [ ] **Step 6: Commit.**

```bash
git add docs/go-patches-phase-3.md docs/launch-runbook.md docs/institutional-blueprint-plan.md docs/mastery-academy-plan.md context.md
git commit -m "docs: Phase 16 — the Mastery Score and attendance (Go note, owner note, status)"
```

## Report (end of phase)

Read out Phase 16's exit criteria from `docs/institutional-blueprint-plan.md`, then add:
- **Rulings the owner should hear:**
  - the 150 s silence rule (a closed tab or a long-locked phone stops counting);
  - the 10-minute floor for a class to count as held;
  - Basic learners (completion only, until Phase 14) see parts but no score;
  - mobile joins don't count until Go R-A.
- **The interfaces Phases 17 and 19 consume:** `masteryInputsFor`, `masteryInputsForMany`, `MasteryFacts.bestProjectGrade` and `.classes`, `masteryView`, `MasteryCard`, and `attendedSeconds` / `classHeld` / `classAttended`.
- **Lines for the controller to add to `CLAUDE.md`** in the main checkout (it is git-excluded):
  - `lib/attendance-rules.ts` + `lib/attendance.ts`: attendance; `lib/attendance.ts` is the only writer, called from the meeting actions and `MeetingProvider`'s heartbeat.
  - `lib/mastery-score.ts` + `lib/mastery-inputs.ts`: the Mastery Score (D24). Import them; never re-derive a part inline.
