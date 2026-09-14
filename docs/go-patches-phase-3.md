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

## 5. Added by Phases 5–6 (ship in the same Go release)

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
