# Go API patch list — Mastery Academy Phase 3 (packages & entitlements)

**For:** the owner of the Go mobile API (`worldstreet-academy/backend`), which reads the same MongoDB as the web app.
**Why:** Phase 3 makes the web app sell courses in packages (Basic / Standard / Executive 101) and enforce what each package includes. Every rule below is enforced on the web only. Until Go applies the same rules, a Basic buyer can open Standard lessons and collect a certificate from the mobile app.
**Release rule:** ship these Go changes the same day as web Phase 3. If Go can't ship that day, keep every lesson's `minPackageKey` unset in production (the web then gates only services, not lessons) and treat certificates for Basic buyers as a known gap until Go lands.

Source of truth for the rules: `lib/entitlements.ts` and `lib/course-access.ts` in the web repo. If this document and that code ever disagree, the code wins.

---

## 1. Data (all additive — nothing renamed, no new enum values on existing fields)

| Collection | Field | Type | Meaning |
|---|---|---|---|
| `courses` | `packages[]` | array of objects (may be missing on old rows = `[]`) | The tiers a course sells. |
| `courses.packages[]` | `key` | `"basic" \| "standard" \| "executive"` | Tier id, unique per course. |
| | `name`, `tagline`, `features[]`, `highlight`, `ctaLabel` | strings / bool | Display only. |
| | `price` | integer, **whole USD** (same unit as `Course.price`) | Package price. |
| | `listPrice`, `duration` | integer whole USD \| `null`; string \| `null` | Additive, display only (2026-10-03): the pre-discount price the web shows struck through, and how long the package runs ("9 weeks"). Go may ignore both; what is charged is still `price`. Missing on older rows = `null`. |
| | `enabled` | bool | Whether the tier is on sale. |
| | `entitlements` | `{ liveClasses, instructorQa, assignments, certificate, mentorship, prioritySupport }` booleans | What the tier includes. A missing flag means `false`. |
| `courses` | `price` / `pricing` | unchanged | Kept equal to the **cheapest enabled** package (`pricing: "free"` only when that cheapest tier is $0). |
| `lessons` | `minPackageKey` | `null \| "basic" \| "standard" \| "executive"` | Lowest tier that can open the lesson. `null` = every tier. |
| `enrollments` | `packageKey` | `null \| "basic" \| "standard" \| "executive"` | Tier bought. `null` = legacy, free, or pre-enrolled → full access. |
| `enrollments` | `packageName` | `string \| null` | Name snapshot at purchase (display). |
| `enrollments` | `mentorshipIntake` | `{ goals, availability, submittedAt } \| null` | Executive onboarding answers (web only; Go may ignore). |
| `orders` | `packageKey` | `null \| key` | Tier the order paid for. |
| `paymentevents` | `type: "package_changed"` | new event type | An admin moved an enrollment to another tier (no money moved). |

Rank: `basic = 1`, `standard = 2`, `executive = 3`.

## 2. Rules

**R1 — What an enrollment includes (`entitlementsFor`).**
- `enrollment.packageKey == null` → all six flags `true` (grandfathered).
- Otherwise find `course.packages[]` with `key == enrollment.packageKey`, **ignoring `enabled`**: buyers keep what they paid for after a tier is taken off sale.
  - Found → that package's `entitlements`.
  - Not found (tier deleted from the course) → all six `true`.

**R2 — A lesson's effective tier (`effectiveLessonTier`).** `lesson.minPackageKey`, but only while the course has an **enabled** package with that key; otherwise `null`.

**R3 — Can the student open a lesson (`canAccessLesson`).** Open when **any** of these is true:
- `lesson.isFree`
- effective tier (R2) is `null`
- `enrollment.packageKey == null`
- `rank(enrollment.packageKey) >= rank(effective tier)`

Otherwise the lesson is **locked**, and Go must:
- **Lesson list:** still list the lesson (title, order, duration), with a `locked: true` flag and **no** `videoUrl` or `content`.
- **Lesson detail / stream URL:** refuse.
- **Mark complete, watch progress, "last accessed":** refuse for locked lessons.
- **Progress %:** completed open lessons ÷ **published** lessons the package opens. Locked and unpublished lessons count in neither number. Cap at 100. The same set gates completion: a course finishes only when every published lesson the package opens is completed (web: `completeLesson`, `markCourseComplete`, and an admin package change, which re-evaluates progress and completion).
  - Both web call sites (`learn/[lessonId]/page.tsx`, `markLessonComplete`) were aligned to the published-open set in Phase 4.
- **Resources attached to a locked lesson:** locked, no download URL — except resources marked `isFree`, which stay unlocked even on a locked lesson (a free resource skips both the enrollment check and the lesson lock).

**R4 — Assessment and certificate.**
- Final exam: refuse to start an attempt when `entitlements.certificate == false`.
- Lesson knowledge check: refuse when its lesson is locked (R3).
- Completion gate: `course.examRequired` holds completion back only when `entitlements.certificate == true`. A package without a certificate completes on its lessons alone.
- Certificates: never issue, list or render one for an enrollment whose `entitlements.certificate == false`, even when `status == "completed"`.

**R5 — Purchases (only if Go has a purchase or enrol endpoint — please confirm whether one exists).**
- If the course has **any enabled package**:
  - Require a `packageKey` naming an enabled package; otherwise reject with `package_required`.
  - Charge `package.price × 100` cents.
  - Use the wallet reference and idempotency key `academy_enroll_<userId>_<courseId>_<packageKey>`, plus `_r<n>` after `n` refunded orders for that user and course.
  - Write `orders.packageKey`, `enrollments.packageKey` and `enrollments.packageName`.
  - A **pre-enrolled** enrollment activated by payment gets the same fields.
- If the course has **no enabled package**, ignore any `packageKey` sent. Charge `course.price`, keep the reference exactly as today (no package segment), and store `packageKey: null`.
- **Free-enrol paths:** a course whose single enabled package is $0 must record that package's `key` and `name`. A course with **several** enabled packages is never free-enrolled; the web rejects $0 tiers next to paid ones at save time, but Go should refuse anyway.
- **Never create an enrollment as a side effect** of progress, completion or certificate endpoints. The web's `markLessonComplete` / `markCourseComplete` used to do this, which gave full access on any course without payment. Please check Go has no equivalent.

**R6 — Live classes.** Only if Go lists or joins course meetings (`meetings.courseId` set):
- List: show a class only to enrollments with `entitlements.liveClasses`.
- Join: allow the host, admins, users in `meetings.invites[].userId`, and enrollments with `liveClasses`. Refuse everyone else.
- Scheduled classes (Phase 4): course meetings can now be `status: "scheduled"` with `scheduledAt`. List them as upcoming, and refuse non-host joins until the host starts the class (`status: "active"`); the web lets the host start it only from 15 minutes before `scheduledAt`.

**R7 — Instructor Q&A.** Only if Go creates conversations. When a `USER` starts a **new** conversation with someone who teaches courses the user is enrolled in, refuse if none of those enrollments has `entitlements.instructorQa`. Existing conversations are untouched. Users with no enrollment with that instructor are unaffected.

## 3. Test matrix (mock data: Forex Trading Mastery, Basic $49 · Standard $199 · Executive 101 $999)

| Enrollment | Lesson `minPackageKey: null` | Lesson `standard` | Lesson `executive` | Final exam | Certificate | Live class | New thread with instructor |
|---|---|---|---|---|---|---|---|
| `packageKey: null` (legacy) | open | open | open | allowed | yes (on completion) | yes | yes |
| `basic` | open | **locked** | **locked** | **refused** | **never** | **refused** | **refused** |
| `standard` | open | open | **locked** | allowed | yes | yes | yes |
| `executive` | open | open | open | allowed | yes | yes | yes |
| `basic`, lesson `isFree: true` | open | open | open | — | — | — | — |
| `basic`, Standard tier disabled on the course | open | open (tier not sold → R2 null) | locked if Executive is still enabled | refused | never | refused | refused |

## 4. Questions for the backend owner

1. Does the mobile app have any purchase or free-enrol endpoint? If yes, R5 applies in full.
2. Which endpoints return lesson media (`videoUrl`, `content`)? Each needs R3.
3. Does Go render or return certificates, or start exam attempts? Each needs R4.
4. Does Go list or join course meetings, or create conversations? If yes, R6 and R7 apply.

---

## 5. Added by Phases 5–7 (ship in the same Go release)

**R8 — Faculty profile fields (Phase 5).** New, additive fields on `users`:

| Field | Type | Meaning |
|---|---|---|
| `country` (top level) | ISO 3166-1 alpha-2 string \| `null` | Shown on faculty profiles and homepage testimonials. |
| `instructorProfile.specialization` | string \| `null` | Area of specialization (public faculty card). |
| `instructorProfile.experience` | string \| `null` | Professional experience (≤ 2,000 characters). |
| `instructorProfile.credentials` | string[] | Credentials and achievements (≤ 10). |
| `instructorProfile.featured` | bool | Admin-curated: listed first on `/faculty`. |

If Go ever writes `instructorProfile`, write dotted paths (`instructorProfile.headline`) or carry these four fields: a whole-object `$set: { instructorProfile: {...} }` drops them.

**R9 — Certificate IDs (Phase 6).** `enrollments.certificateId: string | null`, under a **partial unique** index `{ certificateId: 1 }` with `partialFilterExpression: { certificateId: { $type: "string" } }`.
- **Never write `certificateId: ""`.** Every string is indexed, so a second empty string fails with E11000 and that whole write fails. Omit the field or write `null`.
- The web stamps an ID when an enrollment becomes `completed` and its package includes the certificate (R1, R4): `WSA-` + 8 Crockford base32 symbols (`0-9A-Z` without I, L, O, U) from 5 random bytes, retried once on a duplicate. An enrollment that was already completed without an ID gets its legacy value instead. Go completions don't stamp one yet. Until they do, the web stores the legacy value the first time the student opens that certificate on the web (or an admin changes the enrollment's package or restores it), and a re-run of the web backfill (`scripts/backfill-certificate-ids.mjs`) covers the ones nobody has opened.
- Rendering a certificate on mobile: print `certificateId`; when it is `null`, print the legacy value `WSA-<last 8 characters of the enrollment _id, uppercased>` — what certificates have always printed.
- Public check: `https://academy.worldstreetgold.com/verify/<certificateId>` answers only for a `completed`, certificate-entitled enrollment, so a refund or an admin status change away from `completed` takes the certificate off that page.

**R10 — Other additive changes.** `reviews.featured: bool` (web-only homepage curation; Go may ignore it). Once `scripts/mastery-catalogue.mjs --apply` runs, `courses.category` holds the school's short label ("Trading & Financial Markets", …) on every catalogue row: a mobile filter or grouping keyed on the old strings (Cryptocurrency, Trading, DeFi, …) must switch to `courses.school` in the same release.

**R11 — Executive services: private mentorship sessions (Phase 7).**
- **Meetings privacy.** `meetings.mentorshipSessionId` (ObjectId, additive) marks a private 1-on-1 session room; it has no `courseId` by design. Any Go/mobile meeting-join path must refuse a meeting with `mentorshipSessionId` unless the caller is that session's student, the meeting's host or an admin, and must honour the session status: the student gets in only while `mentorshipsessions.status` is `"confirmed"` and they still have mentorship (R-M below). Refuse everyone but the host until the host starts the room (`meetings.status: "active"`), and never list it as a course session while it is `scheduled`. Rooms the web creates store `settings.guestAccess: false`, so a join path that reads only `settings` holds a stranger for the host's approval — the rule above is still required.
- **Who has mentorship (R-M).** `enrollment.packageKey == "executive"`, the course's `executive` package (found by key, ignoring `enabled`, as in R1) has `entitlements.mentorship`, and the enrollment's status is `active` or `completed`. Assignments follow R1's `entitlements.assignments`.
- **`enrollments.mentorRoadmap`** — `{ text, updatedAt, updatedBy } | null` (additive). If mobile shows it, render it as plain text. Any wholesale enrollment write must carry it (and R9's `certificateId`): write dotted paths or keep the field.
- **Web-only collections.** `mentorshipsessions`, `assignments` and `submissions` are written only by the web; Go may ignore them. If Go ever writes them, mirror the web rules: one `requested` session per enrollment (a partial unique index), and submission files only under the per-user prefix `worldstreet-academy/submissions/<assignmentId>/<userId>/` in the private resources bucket.

## 6. Phase 9 — `enrollmentintents` (new collection)

Go needs no patch: nothing it reads changed. Optional for mobile: `GET` the caller's row where `status: "open"` to show "Finish enrolling".

| Field | Type | Meaning |
|---|---|---|
| `user` | ObjectId | The learner who saved a school. |
| `school` | string (slug) | The saved school. |
| `course` | ObjectId \| `null` | The saved program, if one was picked. |
| `packageKey` | `null \| "basic" \| "standard" \| "executive"` | The saved tier, if one was picked. |
| `status` | `"open" \| "converted" \| "dismissed"` | `open` until the learner enrolls (`converted`) or dismisses it. |
| `savedAt` | date | When the intent was last saved. |

## 7. Pay with ESPEE (owner meeting, 2026-10-03)

Learners may pay by ESPEE transfer outside the wallet (1 ESPEE = $1); an admin approves their uploaded receipt on the web. All additive:

- **`orders.paymentMethod`** — `"wallet" | "espee"`, default `"wallet"` (a missing field means wallet). An ESPEE order is written straight to `paid` → `enrolled` with `chargeId: null` and reference `academy_espee_<manualPaymentId>`. Any Go reconciliation, refund or "paid without a charge" check must skip or refuse `paymentMethod: "espee"`: there is no wallet charge to look up or refund.
- **ESPEE enrollments** — ordinary `active` rows with `pricePaid > 0`, `transactionId: null` and `legacyUnpaid: false`. They are paid, not legacy: don't flag or revoke them. No `earnings` row is written for them (the money never enters the wallet).
- **`users.referredBy`** — `{ text, at } | null`, checkout's "Who invited you?" (first answer wins). Any wholesale user write must keep it.
- **`manualpayments`** — web-only; Go may ignore it. Receipts live only under `worldstreet-academy/payment-proofs/<userId>/` in the private resources bucket.
- **Dashboard gate (web).** A learner reaches the web dashboard only with an `active` or `completed` enrollment; a saved school no longer opens it. Mobile may mirror this.

## 8. Referrals and marketplace shares (owner, 2026-10-05)

Every student and tutor has a referral code; a marketplace course's seller keeps more when their own link made the sale. The web decides all of it at purchase time. All additive — Go needs no patch to keep working, only to keep these fields:

- **`users.referralCode`** — string or `null`, uppercase, under a **partial unique** index (`partialFilterExpression: { referralCode: { $type: "string" } }`). Minted once by the web and never changed. **Never write `referralCode: ""`** (the same trap as R9's `certificateId`).
- **`users.referredBy`** gains **`code`** (string or `null`) and **`userId`** (ObjectId or `null`) beside `{ text, at }` (§7): set when the learner arrived through someone's link (`?ref=CODE`, kept 30 days in the `wsa_ref` cookie) or typed someone's code at checkout. First answer wins. Any wholesale user write must keep the whole object.
- **`orders.attribution`** — `{ code, userId, kind }` or `null`; `kind` is `"seller_link"` (a marketplace course bought through its own seller's code) or `"referral"` (any other code, never the buyer's own). Null or missing = an Academy sale with no code. Written on wallet orders and, as a record only, on ESPEE orders.
- **`earnings.kind: "referral"`** — a new value on an existing field. One row per referred person, ever: 10% of their **first** paid enrollment (`grossMinor` = the sale, `netMinor` = the commission, `feeMinor` = the rest), credited to the referrer (`instructor`, `instructorAuthUserId` — the referrer may be a plain `USER`) after the usual 7-day clearing, with `creditReference: "academy_ref_<buyer user _id>"` (unique, so a second commission for the same person cannot be written). A refund reverses it or writes an `"adjustment"` clawback, exactly like a sale row. Anything in Go that reads `earnings` must accept the new kind; anything that counts `kind: "sale"` rows as sales should keep excluding it.
- **Seller share on `kind: "sale"` rows** — no longer always 85%: a marketplace course's seller keeps 85% through their own link and 50% otherwise; school programs keep 85%. The row's own `feeMinor`/`netMinor` are the truth; never recompute them from `INSTRUCTOR_REVENUE_SHARE`.
- **If Go ever sells a course**, it must apply the same rules (the truth table on `splitSale` in `lib/referrals.ts`) or write `attribution: null` with the program share; it must never pay a referral commission itself.

## 9. The Academy Marketplace and New Economy (owner, 2026-10-03 / 10-05)

The Academy now has two halves: **school programs** (live cohorts, three plans) and the **marketplace** (pre-recorded courses sold by approved sellers and by the Academy's faculty, each quality-reviewed before it is published). **New Economy** courses are free courses on how to use each WorldStreet product. All changes are additive; no `role` value was added.

**Go must hide non-program kinds wherever it lists programs** — school pages, the program catalogue, search and recommendations, "courses taught" and faculty counts. Match programs with `kind: { $nin: ["marketplace", "new-economy"] }`, which also matches legacy rows that have no `kind`. A course's own page, enrollment, lessons and checkout work for every kind.

| Field | Type | Meaning |
|---|---|---|
| `courses.kind` | `"program" \| "marketplace" \| "new-economy"` | Missing on legacy rows = `"program"`. Indexed. |
| `courses.review` | `{ status, submittedAt, reviewedAt, reviewedBy, note }` | The marketplace review. `status`: `"none" \| "pending" \| "approved" \| "changes_requested"` (default `"none"`); `reviewedBy` is a user ObjectId; `note` ≤ 2000 chars. A seller's course stays `draft` until an admin approves it; approval sets `status: "published"`, `publishedAt` (if unset) and publishes its lessons. |
| `courses.communityUrl` | string \| `null` | The course's class community (WhatsApp, Telegram, Discord, Social…): http(s), ≤ 500 chars. |
| `users.sellerStatus` | `"none" \| "applied" \| "approved" \| "rejected"` | Missing = `"none"`. `"approved"` lets a **USER** create and edit their own marketplace courses on the web. It is not a role and grants nothing else. |

- **Single price.** Marketplace and New Economy courses carry no package ladder (`packages: []`) and sell at `price`/`pricing`. New Economy courses are always `pricing: "free"`, `price: 0`, `school: null`, `category: "New Economy"`.
- **Who may publish.** Go must never publish a course whose owner is a seller (role `USER`) except as the admin review does: `review.status` `"approved"`. Faculty marketplace courses publish directly, as programs do.
- **Credit.** A marketplace course owned by a `USER` shows the seller's name ("by Jane Doe"); one owned by INSTRUCTOR/ADMIN credits the Academy's faculty.
- **Splits** (`lib/db/models/earning.ts`): a seller keeps `MARKETPLACE_SHARE_OWN_LINK` (85%) on a sale through their own referral link and `MARKETPLACE_SHARE_ACADEMY` (50%) when the Academy makes the sale. Wired on the web by the referrals stream.
- **`sellerapplications`** — web-only; Go may ignore it. `{ user, status: "submitted" | "approved" | "rejected", fullName, school, topic, experience, sampleUrl, pitch, agreedAt, reviewedBy, reviewedAt, reason }`, one `submitted` row per user (partial unique index). Approval mirrors into `users.sellerStatus`.
- Any wholesale course write must carry `kind`, `review` and `communityUrl`, and any wholesale user write `sellerStatus` (write dotted paths or keep the fields).

## 10. Live teaching: go-live notices and class recordings (owner, 2026-10-03 / 2026-10-05)

Go needs no patch. All additive:

- **`meetings.liveNotifiedAt`** — date or `null` (missing = `null`). Set on a course class when its "<course> is live now" notice goes to the class's students (when the host starts a scheduled class, or when a class is created to start now). The web claims it with a filtered update before sending, so a host rejoining never re-notifies. If Go ever starts a class, it should claim the same field before notifying, or leave it alone. Any wholesale meeting write must keep it.
- **Course-class RealtimeKit rooms are created with `record_on_start: true`.** Mentorship rooms, interviews and ad-hoc meetings are not. If Go creates class rooms, it should pass the same flag, or those classes won't be recorded.
- **`recordings`** — new web-only collection; Go may ignore it. One row per RealtimeKit recording of a course class: `meeting`, `course`, `host` (ObjectIds), `rtkRecordingId` (unique), `rtkStatus`, `status` (`"pending" | "stored" | "failed"`), `storageKey` (private resources bucket only, `worldstreet-academy/recordings/<courseId>/<meetingId>/<rtkRecordingId>.mp4`), `durationSeconds`, `sizeBytes`, `recordedAt`, `title`, `hidden`, `failureReason`, `attempts`, `copyStartedAt`, `storedAt`. Written by `/api/cron/recordings`. Playback is a 10-minute signed GET minted after the web re-checks that the viewer's package includes live classes (or that they are course staff). If mobile ever plays recordings, it must go through the same check and never expose `storageKey` or a public URL.

## 11. Points and the tutor application questions (owner meeting, 2026-10-03)

Go needs no patch for either: nothing it reads changed.

**`pointevents`** — new collection, **web-only**; Go may ignore it. Learning points with no cash value, one row per award. Totals are summed on read (no cached total anywhere, so nothing to keep in step).

| Field | Type | Meaning |
|---|---|---|
| `user` | ObjectId | Who earned it. |
| `course` | ObjectId \| `null` | The program it was earned in. |
| `kind` | `"lesson_completed" \| "assignment_submitted" \| "assignment_graded" \| "exam_passed" \| "course_completed"` | What earned it. |
| `points` | integer ≥ 0 | 10 a lesson, 20 an assignment handed in, grade ÷ 5 (rounded) when it's graded, 50 a passed final exam, 200 a completed program (`POINTS` in `lib/points.ts`). |
| `key` | string, **unique** | Makes each award pay once: `lesson:<enrollmentId>:<lessonId>`, `assignment-submitted:<submissionId>`, `assignment-graded:<submissionId>`, `exam:<enrollmentId>:<examId>`, `course:<enrollmentId>`. |
| `createdAt` | date | When it was awarded. |

Indexes: `{ key: 1 }` unique, `{ user: 1, createdAt: -1 }`, `{ course: 1, user: 1 }`. Lessons a learner completes or programs they finish **through Go/mobile earn nothing** until Go writes the same rows; if it does, use the same keys so a web save of the same event stays a no-op (a duplicate key error means "already awarded").

**`instructorapplications.answers`** gains six optional fields (additive; missing on applications submitted before them, so read every one as optional):

| Field | Type | Meaning |
|---|---|---|
| `school` | string (SchoolSlug) | "Which school would you teach in?" |
| `teachingTopic` | string ≤ 200 | "What exactly would you like to teach?" |
| `passion` | `"yes" \| "somewhat"` | "Are you passionate about teaching it?" |
| `passionReason` | string ≤ 200 | One line on why. |
| `readyToCommit` | boolean | "Ready to commit to bringing learners to a place of real understanding?" — required at submit, so `true` whenever present. |
| `extraDocumentUrl` | string \| `null` | An optional extra PDF, uploaded like `cvUrl`. |

The web requires the first five on every new application. Any wholesale application write must keep them (write dotted paths or keep the fields).

## 12. Super admins and admin levels (Phase 21, D32)

**R14 — Admin levels. Go needs no patch.** Two web-only fields on `users`, both additive:

| Field | Type | Meaning |
|---|---|---|
| `adminLevel` | `"super" \| null` | Missing = `null`. A super admin is `role: "ADMIN"` and `adminLevel: "super"`. |
| `adminAudit[]` | `{ action: "grant" \| "revoke" \| "promote" \| "demote", fromRole, toRole, fromLevel, toLevel, by: ObjectId \| null, at }` | One entry per change involving `ADMIN` or the level. `by: null` means the bootstrap script. |

- Go keeps treating `role: "ADMIN"` as admin everywhere, including the mobile admin surfaces such as Vision. A super admin is still an `ADMIN`.
- Go never writes `adminLevel` or `adminAudit`. Any wholesale user write must carry them (write dotted `$set`s, or keep the fields).
- If Go has any path that sets `users.role`, it must neither set nor clear `ADMIN`. Admin access is granted and removed only on the web, by a super admin, so it is audited.
- If Go raises roles from Clerk metadata at sign-in, it must never raise an **existing** account to `ADMIN`. The web stopped doing so in Phase 21; otherwise a removed admin whose metadata is stale gets admin back.
