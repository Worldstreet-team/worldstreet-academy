# Go API patch list — WorldStreet Mastery Academy (web Phases 3–21)

**For:** the owner of the Go mobile API (`worldstreet-academy/backend`), which reads the same MongoDB as the web app.
**Why:** the web app now sells programs in plans (Basic / Standard / Executive), runs a reviewed marketplace, cohorts, certificates in three tiers and admin levels. Every rule below is enforced on the web only. Until Go applies the ones it needs, a mobile client can open what a plan doesn't include.
**Release rule:** §0 is the work order: which patch must be live before which web launch step. The sections after it hold the detail. (The file name dates from Phase 3, when this list started.)

Source of truth for the rules: `lib/entitlements.ts` and `lib/course-access.ts` in the web repo. If this document and that code ever disagree, the code wins.

## 0. Release order — what must be live before what

Required, in launch order:
1. **Before the web release that sells plans:** R1–R11 (§2, §5). If Go can't ship them by then, keep every lesson's `minPackageKey` unset in production: the web then gates only services, not lessons, and certificates for Basic buyers stay a known gap until Go lands (runbook §2).
2. **Before the first marketplace or New Economy course is published:** §9's `kind: { $nin: ["marketplace", "new-economy"] }` filter on every program list, and its rules for courses owned by a `USER`.
3. **Before the first ESPEE approval:** §7. Reconciliation and refunds skip `paymentMethod: "espee"`, and readers accept the new `paymentevents.type` values.
4. **Before the first referral sale, if Go decodes `earnings.kind` as a closed enum:** §8. Accept `kind: "referral"`, and never recompute a row's shares.
5. **Before the Phase 21 deploy, if Go writes `users.role` or maps Clerk roles at sign-in:** R14 (§12).
6. **Before `scripts/migrate-schools-v2.mjs --apply`:** R12 (§15).
7. **Before any template or guide is approved or published:** R15 (§9).

Optional, any time: R9's ID stamping on Go completions, R13's tier names on mobile certificates, R-A attendance (§13, recommended before the first certificate tiers are awarded), points (§11), the welcome email (§14), intents (§6) and cohorts (§18).

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
| | `entitlements` | `{ liveClasses, instructorQa, assignments, certificate, mentorship, prioritySupport }` booleans, plus `recordings` (Phase 14, web-only; missing = `false`) | What the tier includes. A missing flag means `false`. |
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
- First R15: a course whose `format` is `"template"` or `"guide"` grants nothing, whatever follows.
- `enrollment.packageKey == null` → all seven flags `true` (grandfathered): `liveClasses`, `instructorQa`, `assignments`, `certificate`, `mentorship`, `prioritySupport`, `recordings`.
- Otherwise find `course.packages[]` with `key == enrollment.packageKey`, **ignoring `enabled`**: buyers keep what they paid for after a tier is taken off sale.
  - Found → that package's `entitlements`, with `recordings` read as `recordings || liveClasses`.
  - Not found (tier deleted from the course) → all seven `true`.

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
- **Progress %:** completed open lessons ÷ **published** lessons the package opens. Locked and unpublished lessons count in neither number. Cap at 100. The same set gates completion: a course finishes only when every published lesson the package opens is completed (web: `completeLesson`, `markCourseComplete`, and an admin package change, which re-evaluates progress and completion). **Refuse completion when the package opens no published lesson at all** (web: `markCourseComplete`, `lib/actions/student.ts`): an empty set is never "all done".
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

Phase 14 (2026-10-19) changed Basic's data; §16 has its row today.

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
5. Does Go ever write `users.role`, or raise roles from Clerk metadata at sign-in? If yes, R14 is required (§0 step 5).
6. Does Go have any instructor-side write: creating or editing courses, lessons, resources, meetings, exams or assignments? If yes, §9's rules for `USER`-owned courses apply.
7. Does Go end classes or record time in them? If yes, R-A (§13) decides whether mobile attendance counts.
8. Does Go mark lessons or courses complete? If yes, R3's completion rules and R9's certificate ID apply.
9. Does Go read `earnings`, and does it decode `kind` as a closed enum? If yes, §0 step 4 applies.

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
- **New `paymentevents.type` values** — `"espee_approved"` and `"espee_enroll_failed"` (web: `lib/actions/manual-payments.ts`). `type` is a free string: any reader must accept types it doesn't know.
- **Dashboard gate (web).** A learner reaches the web dashboard only with an `active` or `completed` enrollment; a saved school no longer opens it. Mobile may mirror this.

## 8. Referrals and marketplace shares (owner, 2026-10-05)

Every student and tutor has a referral code; a marketplace course's seller keeps more when their own link made the sale. The web decides all of it at purchase time. All additive. Go needs no patch to keep working, only to keep these fields, **except one: if Go decodes `earnings.kind` as a closed enum, accepting `"referral"` is REQUIRED before the first referral sale (§0 step 4).**

- **`users.referralCode`** — string or `null`, uppercase, under a **partial unique** index (`partialFilterExpression: { referralCode: { $type: "string" } }`). Minted once by the web and never changed. **Never write `referralCode: ""`** (the same trap as R9's `certificateId`).
- **`users.referredBy`** gains **`code`** (string or `null`) and **`userId`** (ObjectId or `null`) beside `{ text, at }` (§7): set when the learner arrived through someone's link (`?ref=CODE`, kept 30 days in the `wsa_ref` cookie) or typed someone's code at checkout. First answer wins. Any wholesale user write must keep the whole object.
- **`orders.attribution`** — `{ code, userId, kind }` or `null`; `kind` is `"seller_link"` (a marketplace course bought through its own seller's code) or `"referral"` (any other code, never the buyer's own). Null or missing = an Academy sale with no code. Written on wallet orders and, as a record only, on ESPEE orders.
- **`earnings.kind: "referral"`** — a new value on an existing field. One row per referred person, ever: 10% of their **first** paid enrollment (`grossMinor` = the sale, `netMinor` = the commission, `feeMinor` = the rest), credited to the referrer (`instructor`, `instructorAuthUserId` — the referrer may be a plain `USER`) after the usual 7-day clearing, with `creditReference: "academy_ref_<buyer user _id>"` (unique, so a second commission for the same person cannot be written). A refund reverses it or writes an `"adjustment"` clawback, exactly like a sale row. Anything in Go that reads `earnings` must accept the new kind; anything that counts `kind: "sale"` rows as sales should keep excluding it.
- **Seller share on `kind: "sale"` rows** — no longer always 85%: a marketplace course's seller keeps 85% through their own link and 50% otherwise; school programs keep 85%. The row's own `feeMinor`/`netMinor` are the truth; never recompute them from `INSTRUCTOR_REVENUE_SHARE`.
- **If Go ever sells a course**, it must apply the same rules (the truth table on `splitSale` in `lib/referrals.ts`) or write `attribution: null` with the no-code share: 85% (`INSTRUCTOR_REVENUE_SHARE`) for programs and New Economy courses, 50% (`MARKETPLACE_SHARE_ACADEMY`) for marketplace courses. It must never pay a referral commission itself.
- **`partnerclicks`** (Phase 18, WMA Partners, 2026-10) — a new web-only collection, `{ code, day: "YYYY-MM-DD" (Africa/Lagos), count }`, unique on `{ code, day }`, incremented once per visitor per code per day. Go never reads or writes it. Nothing above changes: the "Partner Code" the UI shows is `users.referralCode`, and every commission field and rule is as before.

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
- **Who may publish.** Go never publishes a course whose owner is a `USER` (a Marketplace Creator) and never writes `review.*`. Only the web's admin review publishes those, after four recorded checks on the current content. Faculty marketplace courses publish directly, as programs do.
- **List by `status`, never by `review.status`.** A creator who edits a live course leaves it `status: "published"` with `review.status: "pending"` while the edit is re-reviewed, and it stays on sale meanwhile (web: `listCourses` in `lib/actions/student.ts` filters on `status` only).
- **A `USER` can own a course.** `courses.instructor` may be a `USER` with `sellerStatus: "approved"`. The web refuses such an owner live classes, exams, assignments and certificate lists, and re-opens review when they edit. A live course's price is frozen for them. Go must refuse a `USER` owner on every meeting, exam, assignment, certificate-list, course, lesson and resource write: creators edit on the web only.
- **Privacy.** Return `communityUrl` only to a learner whose enrollment grants access (R1/R3) or to the course's staff (web: `classCommunityUrl`, `lib/course-access.ts`). Never return `review.note` or `review.checks` to learners.
- **Credit.** A marketplace course owned by a `USER` shows the seller's name ("by Jane Doe"); one owned by INSTRUCTOR/ADMIN credits the Academy's faculty.
- **Splits** (`lib/db/models/earning.ts`): a seller keeps `MARKETPLACE_SHARE_OWN_LINK` (85%) on a sale through their own referral link and `MARKETPLACE_SHARE_ACADEMY` (50%) when the Academy makes the sale. Wired on the web by the referrals stream.
- **`sellerapplications`** — web-only; Go may ignore it. `{ user, status: "submitted" | "approved" | "rejected", fullName, school, topic, experience, sampleUrl, pitch, agreedAt, reviewedBy, reviewedAt, reason }`, one `submitted` row per user (partial unique index). Approval mirrors into `users.sellerStatus`.
- Any wholesale course write must carry `kind`, `review` and `communityUrl`, and any wholesale user write `sellerStatus` (write dotted paths or keep the fields).

**Phase 20 — formats, templates and guides, staged review (2026-10-19).** The fields are all additive, but Go needs one patch: **R15 (below) is REQUIRED** and must be live before any template or guide is approved or published.
- **`courses.format`**: `"course" | "masterclass" | "workshop" | "template" | "guide"` or `null`, marketplace only. `null` or missing on a marketplace course means `"course"`. Programs and New Economy courses always have `null`.
- **`courses.productFile`**: `{ key, filename, mimeType, sizeBytes, uploadedAt }` or `null`. Templates and guides only; the key is in the private resources bucket under `worldstreet-academy/products/<uploader user id>/`.
- **`courses.review.checks`**: `{ content, quality, accuracy, technical }`, each `{ status: "passed" | "changes" | "n/a" | null, by, at, note, contentHash }`. Only `accuracy` may be `"n/a"`.
- **The rules:**
  - Templates and guides are marketplace kinds, so they stay out of every program list (the `$nin` filter above).
  - **Go must never return `productFile.key`, a public URL or a signed URL for the file.** The web mints 5-minute signed downloads after checking an access-granting enrollment.
  - **A template or guide enrollment grants NO services.** This is R15, a required patch (below).
  - A template or guide has no lessons. Its enrollment stays `active`, never completes and earns no certificate. Mobile should show it as "Download on the web", or leave it out of the learner's course list.
  - It is bought exactly like a marketplace course. If Go ever sells it, the rules above apply.
  - Approval now needs four recorded checks on the current content. Go must never set `review.status: "approved"` or publish a course whose owner is a `USER`.
  - Wholesale course writes must keep `format`, `productFile` and `review.checks`.

**R15 — Templates and guides grant nothing. REQUIRED: live before any template or guide is approved or published (`docs/launch-runbook.md` §12).**
- **The rule.** Before R1, read the course's `format`. When it is `"template"` or `"guide"`, every entitlement flag is `false` (`liveClasses`, `instructorQa`, `assignments`, `certificate`, `mentorship`, `prioritySupport`, `recordings`), whatever the enrollment's `packageKey`. R1's null-`packageKey` = full access rule never applies to these courses. Web: `NO_ENTITLEMENTS` in `lib/entitlements.ts`.
- **Why it can't wait.** Every template or guide enrollment has `packageKey: null`. Without this patch, R1 reads a mobile buyer as full access: R4 lets them start the final exam and get a certificate, R6 lets them join the creator's live classes, and R7 lets them open Q&A threads.
- **Every read that feeds R1 must select `format` beside `packages`.** A read that drops it grants full access again.

## 10. Live teaching: go-live notices and class recordings (owner, 2026-10-03 / 2026-10-05)

Go needs no patch. All additive:

- **`meetings.liveNotifiedAt`** — date or `null` (missing = `null`). Set on a course class when its "<course> is live now" notice goes to the class's students (when the host starts a scheduled class, or when a class is created to start now). The web claims it with a filtered update before sending, so a host rejoining never re-notifies. If Go ever starts a class, it should claim the same field before notifying, or leave it alone. Any wholesale meeting write must keep it.
- **Course-class RealtimeKit rooms are created with `record_on_start: true`.** Mentorship rooms, interviews and ad-hoc meetings are not. If Go creates class rooms, it should pass the same flag, or those classes won't be recorded.
- **`recordings`** — new web-only collection; Go may ignore it. One row per RealtimeKit recording of a course class: `meeting`, `course`, `host` (ObjectIds), `rtkRecordingId` (unique), `rtkStatus`, `status` (`"pending" | "stored" | "failed"`), `storageKey` (private resources bucket only, `worldstreet-academy/recordings/<courseId>/<meetingId>/<rtkRecordingId>.mp4`), `durationSeconds`, `sizeBytes`, `recordedAt`, `title`, `hidden`, `failureReason`, `attempts`, `copyStartedAt`, `storedAt`. Written by `/api/cron/recordings`. Learners see only rows with `status: "stored"` and `hidden: false`; a hidden recording plays for course staff only. Playback is a 10-minute signed GET minted after the web re-checks that the viewer's plan includes recorded classes (`recordings || liveClasses`, `recordingsAllowed`) (or that they are course staff). If mobile ever plays recordings, it must go through the same check and never expose `storageKey` or a public URL.

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

**R14 — Admin levels.** Go needs no patch unless it writes `users.role` or raises roles from Clerk metadata at sign-in. **If it does either, the last two rules below are REQUIRED before the Phase 21 deploy (§0 step 5).** Two web-only fields on `users`, both additive:

| Field | Type | Meaning |
|---|---|---|
| `adminLevel` | `"super" \| null` | Missing = `null`. A super admin is `role: "ADMIN"` and `adminLevel: "super"`. |
| `adminAudit[]` | `{ action: "grant" \| "revoke" \| "promote" \| "demote", fromRole, toRole, fromLevel, toLevel, by: ObjectId \| null, at }` | One entry per change involving `ADMIN` or the level. `by: null` means the bootstrap script. |

- Go keeps treating `role: "ADMIN"` as admin everywhere, including the mobile admin surfaces such as Vision. A super admin is still an `ADMIN`.
- Go never writes `adminLevel` or `adminAudit`. Any wholesale user write must carry them (write dotted `$set`s, or keep the fields).
- If Go has any path that sets `users.role`, it must neither set nor clear `ADMIN`. Admin access is granted and removed only on the web, by a super admin, so it is audited.
- If Go raises roles from Clerk metadata at sign-in, it must never raise an **existing** account to `ADMIN`. The web stopped doing so in Phase 21; otherwise a removed admin whose metadata is stale gets admin back.

## 13. Phase 16 — Mastery Score and attendance (institutional blueprint §12)

**No required patch:** nothing Go reads changed. R-A below is recommended.

**`attendances`** is a new web-only collection. Go may ignore it.

| Field | Type | Meaning |
|---|---|---|
| `meeting` | ObjectId | The class (`meetings._id`). |
| `course` | ObjectId | The class's course. |
| `user` | ObjectId | The learner. |
| `firstJoinedAt` | Date | Written once, on the first join. |
| `lastJoinedAt` | Date | The most recent join. |
| `openSince` | Date \| null | The start of time not yet banked. `null` when the learner is not in the class. |
| `seconds` | number | Banked attended seconds. |
| `createdAt`, `updatedAt` | Date | Timestamps. |

The unique index is on `{ meeting, user }`. The web writes rows only for course classes (`courseId` set, no `mentorshipSessionId`), and never for the host.

**R-A — recommended before the first certificate tiers are awarded.** Mobile joins aren't counted until Go writes the same rows. Attendance is 15% of the Mastery Score, and the Practitioner and Mastery tiers need a score of 70 and 85 (`lib/certificate-tier.ts`), so without R-A a class a learner joins only on mobile counts as an absence and can cost them a tier. Go writes:
- on a join, bank and reopen;
- every 60 s while in the class, add `now − openSince` when it is ≤ 150 s, else 0, and set `openSince = now`;
- on leave or kick, bank and set `openSince` to `null`;
- on end, bank every open row at `endedAt`;
- filter every update on the `openSince` value read, so two writers never double-count.

**`assignments.kind`** is `"assignment" | "project"` (missing means `"assignment"`), on a web-only collection.

**The Mastery Score** is computed on read from enrollments, submissions, meetings and attendances. Nothing is stored. If mobile ever shows it, port `lib/mastery-inputs.ts` and `lib/mastery-score.ts` whole, or show no score. The weights alone are not enough. The algorithm also has these rules:
- it scores programs only, and only the parts the learner's plan includes;
- there is no score until at least two parts have a value;
- projects and assignments are counted apart (`assignments.kind`);
- a class counts as held at 600 s or more;
- a learner attended a class when present for at least half of it or 30 minutes, whichever is less;
- only the learner's own time window counts.

It reads `enrollments.progress`, `bestScorePercent`, `examPassed` and `meetings.startedAt`/`endedAt`, so Go's exam and class paths must keep writing those fields as the web does.

## 14. Phase 15 — the welcome email (institutional blueprint §10, D27)

Go needs no patch.

**`users.welcomedAt`** is a date or `null` (missing = `null`). It is web-only, and Go may ignore it.

- The web claims it with a filtered update (`{ _id, welcomedAt: null }`) before sending the one-time "Welcome to WorldStreet Mastery Academy" email, after a learner's first paid enrollment (a wallet purchase or an ESPEE approval).
- If Go ever sends that welcome, it must claim the same field the same way first.
- The web also skips the welcome when the learner already had an earlier paid enrollment (the rule in `lib/welcome-email.ts`), so Go must do the same if it ever sends it.
- **Consequence:** if a learner's first paid enrollment happens through Go, the web never welcomes them later. Either Go sends the welcome with the same claim, or the owner accepts that mobile-first buyers get none.
- Any wholesale user write must keep it.

## 15. Phase 13 — the seven schools (owner, 2026-10-19; D21, D22)

**R12 — School slugs and labels change; ship before `scripts/migrate-schools-v2.mjs --apply` runs.**

The institutional blueprint (§7) replaces the eight schools with seven. Four old schools merge into one, three are renamed, and two are new:

| Old slug(s) | New slug | New `courses.category` |
|---|---|---|
| `trading-financial-markets` (unchanged) | `trading-financial-markets` | Trading & Financial Markets |
| `ai-automation`, `software-app-development`, `cybersecurity`, `data-analytics` | `technology-ai` | Technology & AI |
| `digital-business-remote-careers` | `digital-business` | Digital Business |
| (new) | `entrepreneurship-wealth-creation` | Entrepreneurship & Wealth Creation (no programs yet) |
| `digital-media-creative` | `creative-economy` | Creative Economy |
| (new) | `leadership-personal-development` | Leadership & Personal Development (no programs yet) |
| `blockchain-web3` | `emerging-technologies` | Emerging Technologies |

Fields whose **values** the migration rewrites:
- `courses.school`, and `courses.category` (on moved courses only);
- `enrollmentintents.school`;
- `sellerapplications.school`;
- `instructorapplications.answers.school`.

What Go does:
- Any mobile list of school slugs, names, icons or filters switches to the seven, in §7's order (the order of the table above), in the same release.
- Go must never write a retired slug. Until the migration has run, a read should map a retired slug through the table, as the web does (`schoolFromSlug`, `lib/schools.ts`).
- Web `/schools/<retired>` answers 308 to the new school.
- Nothing is added, renamed or removed: no field, model, route or enum changes. Only these string values move.

## 16. Phase 14 — plans to the institutional blueprint (owner, 2026-10-19)

**Go needs no patch;** only data changed.

- **`courses.packages[].entitlements.recordings`** is a new web-only boolean (missing = `false`). The web treats a plan as including recorded classes when `recordings || liveClasses`. If mobile ever plays recordings, it uses the same rule and §10's signed-URL path.
- **After the catalogue apply,** every catalogue program's Basic plan has `assignments`, `certificate` and `recordings` true, and `liveClasses`, `instructorQa`, `mentorship` and `prioritySupport` false.
- **What R1 and R4 already do with that data:** a Basic enrollment may start the final exam; `examRequired` now holds Basic completion until it passes; and a completed Basic enrollment gets a certificate.
- **Basic's row today:** lessons open per R3 · final exam allowed · certificate yes (on completion) · live class refused · new thread refused.
- **Display only:** `name`, `tagline` ("Foundation" / "Mastery" / "Personalized Mastery"), `duration` ("4 weeks" / "8–12 weeks" / "Flexible schedule") and `features`. The Executive tier label is "Executive"; it is not stored.

## 17. Phase 19 — Faculty system (institutional blueprint §16, D29)

Go needs no patch. All additive:

- **`instructorapplications.demo`** — `null`, or `{ requested: true, meetingId, scheduledAt, outcome: "passed" | "not_passed" | null, note, decidedAt }`. A teaching demonstration requested during `interview_scheduled`; **the status never changes for it**. The web refuses approval while `requested` and `outcome` is `null` — if Go ever approves applications, apply the same rule.
- The demonstration room is a `meetings` row shaped like the interview's (`applicationId` set, no `courseId`), titled "Teaching demonstration — <name>".
- **`users.instructorProfile.handbook`** — `{ teachingStandardsAt, curriculumGuidelinesAt, platformTrainingAt }`, each a date or `null`.
- **`users.instructorProfile.credential`** — `null`, or `{ id: "WMAF-XXXXXX", issuedAt }`. Unique when set (partial index `facultyCredential_unique`); written once, never changed.
- Any whole-object write of `instructorProfile` (an approval or profile edit in Go) must carry `handbook` and `credential` across, as the web's approval does — or use dotted `$set` paths.

## 18. Phase 12 — cohorts (web-only)

Go needs no patch: nothing it reads changed.

- **`cohorts`** is a new collection that Go doesn't read. One row per academic session (`number`, `name`, `startsAt`, `endsAt`, `note`), entered by an admin at `/admin/cohorts`.
- **No `enrollments` field changes.** A learner's cohort is derived on the web from `purchasedAt` (or, for ESPEE, the approved proof's `createdAt` when it was submitted earlier). Nothing is stored.
- Mobile shows no cohort until a later Go release chooses to read the collection.

## 19. Certificate tiers (Phase 17, institutional blueprint §13)

Go needs no patch to keep working: everything is additive.

**R13: certificate tiers.**

- **Fields.**
  - `enrollments.certificateTier` is `"completion" | "practitioner" | "mastery" | null`. A missing value means null.
  - `enrollments.certificateTierAt` is a date or null.
  - Only the web writes them, and it never lowers the tier. Go must not write them. Any wholesale enrollment write must carry them, alongside R9's `certificateId` and R11's `mentorRoadmap` (use dotted paths).
- **Rendering on mobile.** Print the tier's name: "WMA Certificate of Completion", "WMA Certified Practitioner" or "WMA Mastery Certification". When the tier is null, print "WMA Certificate of Completion". R9's ID rules are unchanged: one `WSA-` ID per enrollment, and a higher tier reprints under the same ID.
- **Who decides.** The web computes the tier from completion, the final exam, the Mastery Score and a graded project, as published at `/certification`. A completion made through Go gets its tier the next time the learner opens their certificates on the web. Go needs no tier logic.
