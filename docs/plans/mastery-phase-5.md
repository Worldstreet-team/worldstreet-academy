# Mastery Academy — Phase 5 Implementation Plan (Faculty: profiles, public pages, editors)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Visitors can browse a public faculty directory at `/faculty` and read `/faculty/[username]` profiles showing the seven §10 fields. Instructors edit their own faculty profile; admins edit any instructor's and mark who is featured. An approved application seeds "Professional experience". The homepage teaser and the Faculty nav/footer links appear only while faculty exists.

**Architecture:**
- **Data.** Additive fields only: top-level `User.country` (ISO alpha-2) and `instructorProfile.{specialization, experience, credentials, featured}`. Every write is a targeted dotted `$set`, so counters and anything the Go API stored survive.
- **Rules.** `lib/faculty.ts` is pure and client-safe: the one Zod schema, limits, form type, `$set` builder and URL helpers. `lib/countries.ts` holds the 249 ISO codes, named by `Intl.DisplayNames`.
- **Writes.** `lib/actions/profile.ts` (the instructor's own profile) and `lib/actions/admin-users.ts` (any faculty profile, plus `featured`) both parse with that schema.
- **Reads.** A new FACULTY section appended to `lib/actions/student.ts` is the only place "faculty" is queried: role INSTRUCTOR or ADMIN **and** at least one published course.
- **Surfaces.** `/faculty` and `/faculty/[username]` (RSC, `revalidate = 0`). A homepage `FacultyTeaser` between the catalogue and Upcoming drops. The marketing layout counts faculty once and passes a boolean to the server-rendered navbar and footer. Links from the program page's instructor block and from `/dashboard/instructor/[instructorId]`.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict · Mongoose 9 · Zod (`zod/v4`) · Tailwind v4 + DS v2 `ws-*` tokens · Base UI (`render` prop) · TanStack Query (admin page) · lucide-react.

**Spec:**
- `docs/mastery-academy-blueprint.md` §10 (copy is binding):
  - **LEARN FROM EXPERIENCED INSTRUCTORS**
  - "Behind every great learning experience is a great teacher. Worldstreet Mastery Academy brings together instructors and practitioners across technology, financial markets, digital business and creative industries."
  - **Meet Our Faculty** — each instructor profile shows: Photo · Name · Area of specialization · Short biography · Professional experience · Courses taught · Relevant credentials/achievements.
  - **[VIEW FACULTY]**
- `docs/mastery-academy-plan.md`: § "Phase 5 — Faculty" (scope and exit criteria); §0.3 hard constraints; D1 (brand casing, so the copy prints `{BRAND.name}` = "WorldStreet Mastery Academy").

**Branch:** `mastery/phase-5`, cut from `mastery/phase-4`. Phase 5 uses no Phase 4 code. Phase 4 edits `fetchMyEnrollments` in `lib/actions/student.ts`; this plan edits `fetchBrowseCourses` and `findProgram`, and appends a new FACULTY section at the end of the file. Locate every edit by its quoted anchor text, never by line number.

**Controller rulings (binding — do not re-litigate):**
1. **Profile action.** The save path is `lib/actions/profile.ts`, not instructor.ts. It gains `getMyFacultyProfile()` and `updateFacultyProfile()`; `updateProfile` keeps its shape and gains the 1,000-char bio cap. *Why:* that is where the profile editor already saves. The schema lives in `lib/faculty.ts` because a `"use server"` file may export only async functions; the admin action imports the same schema.
2. **Admin editing.** It happens in an "Edit faculty profile" dialog, with no new admin route. It is backed by `adminGetFacultyProfile` and `adminUpdateFacultyProfile` in `lib/actions/admin-users.ts` (`requireAdmin()`), and the `featured` switch is in the same dialog. *Why:* there is no `/admin/users/[userId]` page.
   - *Code fact:* rows on `/admin/users` have no menu; clicking a row opens the user **Sheet**, which is where row actions live. The dialog's button goes in that Sheet, for INSTRUCTOR and ADMIN rows only.
3. **Country.** Top-level `User.country: string | null` (ISO 3166-1 alpha-2, default null). Names come from `Intl.DisplayNames(["en"], { type: "region" })` over the full hand-written 249-code list in `lib/countries.ts`, with no dependency. *Why:* Phase 6 testimonials reuse it for every user, not just instructors.
4. **New `instructorProfile` fields.** Additive with defaults: `specialization: string | null`, `experience: string | null` (≤ 2,000), `credentials: string[]` (≤ 10 × ≤ 120), `featured: boolean` (default false). `headline`, `expertise[]`, `socialLinks` and `totalStudents` are kept. `bio` is capped at 1,000 in validation only; stored data is never truncated. *Why:* §0.3 — two backends read one database.
5. **Experience from applications.** On approval (`adminDecideApplication` in `lib/actions/applications.ts`), `answers.experience` is copied into `instructorProfile.experience` only when that is empty. That `$set` rewrites the whole `instructorProfile`, so the other new fields are carried across. *Why:* the approval path is the only writer of `instructorProfile` today.
6. **Faculty definition and URL.**
   - Faculty is role ∈ {INSTRUCTOR, ADMIN} with ≥ 1 **published** course, at the public URL `/faculty/[username]`.
   - *Code facts:* `username` has a unique index (verified: `{ username: 1 }` unique in the mock DB). URL-safety is **not** guaranteed: web sign-ups generate `[a-z0-9]`, but seeded and mobile rows differ (the mock has `sarah_chen`).
   - *Ruling:* look up by the exact decoded username (Next decodes params — verified with `/programs/forex%2Dtrading-mastery` → 200), and build every link with `facultyHref()` = `encodeURIComponent`. Anything that isn't faculty 404s.
7. **Program page link.** The link goes in `components/programs/program-instructor.tsx` (`ProgramInstructor`), fed by `ProgramDetail.instructorUsername` from `findProgram`. The username is set only when the instructor's role is INSTRUCTOR/ADMIN (the course is published, so they are faculty); otherwise the existing signed-in dashboard link stays. *Why:* never link a page that 404s.
8. **Homepage teaser.** `FacultyTeaser` sits between `CatalogueGrid` and `UpcomingDrops` in `components/marketing/landing.tsx`: up to 4 cards plus [View faculty], rendering nothing at 0.
9. **Nav and footer links.**
   - *Code facts:* `Navbar` is an async server component; `Footer` is a sync server component; `app/(marketing)/layout.tsx` is a server component rendering both.
   - *Ruling:* the layout awaits `fetchFacultyCount()` once and passes `showFaculty` to both. That is the cheapest truthful mechanism: one count query per marketing request, no client fetch, no endpoint.
10. **Dashboard profile link.** `/dashboard/instructor/[instructorId]` stays and gains a "Public profile" button, shown only when `fetchFacultyUsername()` resolves.
11. **UI.**
    - DS v2 tokens only, radii `rounded-xs/sm/md/lg/full`, gold only on the primary CTA, the active state, eyebrows and ~10% washes.
    - `font-display` headings, `tabular-nums` counts, no horizontal overflow at 400px.
    - Marketing pages are RSC and match `app/(marketing)/schools/page.tsx` / `schools/[slug]/page.tsx` anatomy.
12. **Five tasks:** schema + rules → instructor editor → admin editor + application seed → public pages → teaser, links, nav.

**Rulings added while planning (same force):**

13. **Each action lands with the UI that imports it.** Task 1 has no actions. *Why:* `action.sh` can only reach an action that a page's client components import, so an action added alone can't be verified.
14. **Admins edit the faculty fields plus `featured`, not name or photo.** Those stay on the owner's account card on `/instructor/profile`, beside the existing avatar upload and name fields. *Why:* the §10 profile is what admins curate; the avatar upload path (`getImageUploadUrl` → `updateAvatar`) is scoped to the signed-in user, and adding admin write paths for identity fields is outside this phase.
15. **"Short biography" moves into the Faculty profile card on `/instructor/profile`.** The account card keeps first/last name. *Why:* one bio field per page.
    - The other two bio textareas (`/instructor/settings`, `/dashboard/profile`) get `maxLength={1000}`. *Why:* their save handlers ignore errors, so the new server cap would otherwise fail silently.
16. **Country select labels.** `/instructor/profile` computes `countryOptions()` on the server and passes it down; the admin dialog is mounted only while open, so it never server-renders. *Why:* browser ICU can name a country differently from Node's (hydration mismatch).
17. **Social links are stored as http(s) URLs**, matching the application flow (the only existing writer). A bare `linkedin.com/in/you` gets `https://`; anything else is refused. The read path passes every stored link through `safeWebUrl`, so a legacy `javascript:` value never renders.
18. **Navbar "Faculty" visibility.**
    - *Measured on the dev server:* a fourth link in the md+ row overlaps the right-hand CTA group for guests at 768–~815px. For instructors (whose row also holds "Instructor Dashboard") it overlaps or wraps labels to two lines up to ~1,200px.
    - *Ruling:* the md+ row shows "Faculty" from `lg` for guests/students and from `xl` for instructors/admins. The phone sheet and the footer always list it.
    - A signed-in overlap at exactly 768px exists **before** this phase and is not touched.
19. **Card line and ordering.** The card shows `specialization`, falling back to `headline`; the profile page shows both. The directory orders featured → stored `instructorProfile.totalStudents` → name.
20. **Empty directory.** `/faculty` with zero faculty renders an empty state, not a 404 (nav links are hidden then, so nothing routes there).
21. **Buttons on `/instructor/profile`.** The existing account-card "Save Profile" stays the page's gold button; "Save faculty profile" is `outline`. *Why:* one gold CTA per view.
22. **Go note (non-blocking, add to §0.4 at Phase 8).** If the Go API ever rewrites `instructorProfile` wholesale, the Phase 5 fields would be dropped; Go must write dotted paths or carry them.

## Global Constraints

- **Schema: additive only.**
  - Task 1's `User` fields are the only model change.
  - No renamed fields, no new `role` values.
  - A running dev server keeps the old schema, and Mongoose silently strips unknown paths from `$set`. **The controller restarts the dev server after Task 1 is committed**; Tasks 2–5 assume that restart happened.
- **`"use server"` files export only async functions (plus types).** Schemas, constants and helpers go in `lib/faculty.ts` / `lib/countries.ts`.
- **Faculty has exactly two homes:**
  - `lib/faculty.ts`, which is pure: `FACULTY_ROLES`, `isFacultyRole`, `FACULTY_LIMITS`, `FacultyProfileForm`, `FacultyProfileSchema`, `AdminFacultyProfileSchema`, `facultyProfileSet`, `facultyFormFrom`, `firstFacultyError`, `safeWebUrl`, `facultyHref`, `facultyInitials`.
  - The FACULTY section of `lib/actions/student.ts` (queries).
  - Never write a published-course count or a role check for faculty inline elsewhere.
- **Writes:** targeted `$set` with dotted `instructorProfile.*` paths (`facultyProfileSet`). Never `$set: { instructorProfile: {...} }` outside the approval path, which already does it and carries the fields (ruling 5).
- **Copy (verbatim):**
  - "Learn from experienced instructors" (the spec's all-caps heading, set in sentence case as Phase 1 did for §11/§16)
  - "Behind every great learning experience is a great teacher. {BRAND.name} brings together instructors and practitioners across technology, financial markets, digital business and creative industries."
  - "Meet our faculty"
  - "View faculty"
  - Brand always via `BRAND` from `@/lib/brand`.
  - Never invent credentials, counts or claims; empty fields hide their section.
- **Links:**
  - Public profile: `facultyHref(username)`.
  - Programs: `/programs/${slug}` (via `ProgramRow`).
  - Dashboard profile: `/dashboard/instructor/${id}`.
  - Never ship a dead link.
- **Icons:** `lucide-react` only. lucide v1 has **no brand icons** (`LinkedinIcon`/`TwitterIcon` are undefined — verified); use `GlobeIcon` / `ExternalLinkIcon`.
- **UI tokens:**
  - Semantic classes only (`bg-ws-surface`, `bg-ws-raised`, `bg-ws-sunken`, `bg-ws-chip`, `border-ws-hairline`, `text-ws-primary`, `text-ws-muted`, `text-ws-subtle`, `text-ws-gold`, `bg-ws-brand/10`, `border-ws-brand/40`, `text-ws-success`, `text-ws-danger`, `font-display`); never a hex.
  - New markup uses `rounded-xs/sm/md/lg/full` only.
  - Counts `tabular-nums`; separators `·`.
- **Base UI:** the `render` prop, never `asChild`. A `Select` needs `items` to show labels instead of raw values. RSC-first: `"use client"` only where hooks are needed.
- **No new dependencies. No `any`.**
- **Commits:**
  - One per task; every message ends with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
  - Add files by name, never `git add -A`; never commit `.env*`.
  - Never `git stash`. The untracked `AGENTS.md` is not yours.
- **Surgical:** touch only the listed files, plus files a compile error forces (say so in the report). No reformatting.

## Verification kit (controller-owned — use it; never start, stop or restart servers)

No test runner exists. Every task ends with:
- `npx tsc --noEmit 2>&1 | grep -v '^\.next/'` printing nothing;
- `npx eslint <every file you touched>` printing no errors. The only warnings allowed are the **three pre-existing** `@next/next/no-img-element` warnings on the one `<img>` already in each of `app/(instructor)/instructor/profile/instructor-profile-client.tsx`, `app/(instructor)/instructor/settings/instructor-profile-client.tsx` and `app/(platform)/dashboard/profile/page.tsx`;
- the task's own runtime checks.

Set this once per shell (Git Bash, repo root):

```bash
H="C:/Users/owen/AppData/Local/Temp/claude/C--Users-owen-downloads-projects-worldstreet-worldstreet-academy/d4ab89bb-8435-4b94-b993-6b42283d1e4b/scratchpad/phase-3"
export NODE_PATH="$(pwd)/node_modules"
B=~/.claude/skills/gstack/browse/dist/browse
BASE=http://localhost:3001
SARAH=6a6fc0ba6433bbbd6322bdfd   # INSTRUCTOR "Sarah Chen", username sarah_chen, 15 published programs, totalStudents 3741
ADA=6a6fc1258372b65d1ee8e972     # ADMIN "Ada Admin", username adminwteo, 0 courses → not faculty
STU=6a6fc0bb6433bbbd6322be61     # USER "demo_student", username demo_student
strip() { perl -pe 's/<script\b.*?<\/script>//gs'; }
count() { grep -o -- "$1" | wc -l | tr -d ' '; }
PROFILE='{"headline":"Crypto Trading Expert and Blockchain Educator","specialization":"Crypto markets and risk management","bio":"Former Wall Street analyst turned crypto educator.","experience":"Twelve years across equities research and digital-asset trading desks.","expertise":["Technical analysis","Risk management"],"credentials":["Fixture credential one","Fixture credential two"],"country":"US","socialLinks":{"twitter":"","linkedin":"linkedin.com/in/sarahchen","website":"https://sarahchen.example.com"}}'
```

- **Dev server:**
  - `pnpm dev:mock` on http://localhost:3001, already running.
  - Mock Clerk; local Mongo at `mongodb://127.0.0.1:27017/worldstreet-academy`.
  - **Never use `.env.local`** (production credentials).
  - Turbopack hot-reloads code, not model schemas: the controller restarts after Task 1.
- **Personas:** cookie `mock_persona=guest|student|instructor|admin`. Existing users are not re-synced from Clerk, so a role set in the DB holds until `restore`.
- **Page behaviour:**
  - Marketing pages (`/`, `/faculty…`, `/programs…`) have no `loading.tsx`, so `notFound()` returns a **real 404** (verified: `/programs/nope` → 404).
  - The `(platform)` and `(instructor)` groups have `loading.tsx`, which streams redirects/`notFound` as 200: judge those pages by content.
  - HTML escapes `&` as `&amp;` and `'` as `&#x27;`; the fixture text avoids both.
- **Calling a server action:** `bash "$H/action.sh" "<page whose client chunks import it>" <actionName> '<json args array>' [persona]` prints the return value.
  - `PRINT_ID=1 bash "$H/action.sh" …` prints only the action id, for raw POSTs as another persona:
    `curl -s -X POST "$BASE<page>" -H "Next-Action: $ID" -H "Accept: text/x-component" -H "Content-Type: text/plain;charset=UTF-8" -b mock_persona=<p> --data '<json>'`.
- **Mock DB helper:** `node "$H/mockdb.cjs" <cmd>`.
  - Existing commands: `restore`, `probe [userId]`, …
  - Phase 5 additions (see Controller setup): `user [userId]`, `set-role <userId> <role>`, `faculty-fixture`, `application-fixture <userId> <experience> [existingProfileExperience]`.
  - **Run `restore` at the end of every task that touched data**, and say so in the report.
- **Browser:**
  - `$B viewport 400x800` · `$B goto <url>` · `$B wait --load` · `$B js "<expr>"` (awaits promises) · `$B screenshot --viewport "$H/<file>.png"` · `$B console --errors`.
  - **`$B cookie mock_persona=<p>` works only after a `$B goto`** (the cookie needs a domain). Reset with `$B cookie mock_persona=student` when done.
- **Homepage greps:** the §3 Why band already contains "Learn from experienced instructors and practitioners…", so homepage checks key on `id="faculty-teaser-heading"`, never on the heading text.

## Controller setup (once, before Task 1)

Extend `$H/mockdb.cjs`. It is only ever pointed at the mock DB. A syntax-checked preview of exactly these edits is at `…/scratchpad/phase-5-6/mockdb5-preview.cjs`; the builder is `mockdb5-apply.cjs` in the same folder.

1. Run `node "$H/mockdb.cjs" restore` **with the current helper**, so the DB is at the Phase 3 baseline.
2. Apply the edits:
   - In the header comment, after the `//   preenrol <userId> <courseId>     a pre_enrolled reservation (no money)` line, add:

```js
//   user [userId]                    username / role / bio / country / instructorProfile (default: instructor)
//   set-role <userId> <USER|INSTRUCTOR|ADMIN>
//   faculty-fixture                  a published program taught by the mock admin (makes them faculty)
//   application-fixture <userId> <experience> [existingProfileExperience]
//                                    a submitted instructor application; the optional third argument
//                                    first sets the user's instructorProfile.experience
```

   - In `TRACKED`, after `"resources", "watchprogresses",` add a line `  "instructorapplications", "courses",`.
   - In `snapshot`, replace `snap.users = await db.collection("users").find({}, { projection: { instructorProfile: 1 } }).toArray()` with:

```js
    snap.users = await db.collection("users").find({}, { projection: { instructorProfile: 1, bio: 1, country: 1, role: 1, instructorStatus: 1 } }).toArray()
```

   - In `restore`, replace the `for (const u of snap.users) { … }` loop with:

```js
    for (const u of snap.users) {
      const $set = {}
      const $unset = {}
      for (const key of ["instructorProfile", "bio", "country", "role", "instructorStatus"]) {
        if (u[key] === undefined) $unset[key] = ""
        else $set[key] = u[key]
      }
      await db.collection("users").updateOne(
        { _id: u._id },
        { ...(Object.keys($set).length ? { $set } : {}), ...(Object.keys($unset).length ? { $unset } : {}) }
      )
    }
```

   - Directly before the final `} else {` (the one printing "unknown command"), add:

```js
  } else if (cmd === "user") {
    const u = await db.collection("users").findOne(
      { _id: oid(args[0] ?? INSTRUCTOR) },
      { projection: { username: 1, role: 1, instructorStatus: 1, bio: 1, country: 1, instructorProfile: 1 } }
    )
    console.log(JSON.stringify(u, null, 2))
  } else if (cmd === "set-role") {
    const [userId, role] = args
    await db.collection("users").updateOne({ _id: oid(userId) }, { $set: { role } })
    console.log(`user ${userId} → ${role}`)
  } else if (cmd === "faculty-fixture") {
    const ADMIN = "6a6fc1258372b65d1ee8e972"
    const r = await db.collection("courses").insertOne({
      title: "Faculty Fixture Program", slug: "faculty-fixture-program",
      description: "Phase 5 fixture: a published program taught by the mock admin.", shortDescription: "Phase 5 fixture program.",
      thumbnailUrl: null, thumbnailPublicId: null, previewVideoUrl: null, instructor: oid(ADMIN),
      level: "beginner", pricing: "paid", price: 49, currency: "USD", status: "published",
      category: "AI & Automation", school: "ai-automation", totalLessons: 0, totalDuration: 0, enrolledCount: 0,
      rating: { average: 0, count: 0 }, whatYouWillLearn: [], requirements: [], targetAudience: [],
      examRequired: false, packages: [], publishedAt: now, availableAt: null, preEnrollEnabled: true, liveNotifiedAt: null,
      createdAt: now, updatedAt: now,
    })
    console.log(JSON.stringify({ courseId: r.insertedId.toString(), instructorId: ADMIN }))
  } else if (cmd === "application-fixture") {
    const [userId, experience, existingExperience] = args
    if (existingExperience !== undefined) {
      await db.collection("users").updateOne({ _id: oid(userId) }, { $set: { "instructorProfile.experience": existingExperience } })
    }
    const r = await db.collection("instructorapplications").insertOne({
      user: oid(userId), status: "submitted",
      answers: {
        headline: "Fixture applicant headline", expertise: ["Fixture"], experienceYears: "3-5", experience,
        motivation: "Phase 5 fixture motivation, long enough to pass the form's checks.",
        portfolioUrl: null, twitter: null, linkedin: null, website: null, sampleVideoUrl: null, cvUrl: null,
      },
      interviewMeetingId: null, proposedSlots: [], slotsProposedBy: null, slotsProposedAt: null,
      assignedTo: null, assignedToName: "", scorecard: null, termsAcceptedAt: now, reviewerNotes: [],
      decidedBy: null, decidedAt: null, decisionNote: "", rejectionReason: "",
      history: [{ status: "submitted", at: now, by: "Fixture" }], createdAt: now, updatedAt: now,
    })
    console.log(JSON.stringify({ applicationId: r.insertedId.toString() }))
```

3. Run `node "$H/mockdb.cjs" snapshot` once. The new `TRACKED` collections and user fields need a fresh baseline; `restore` would crash on the old snapshot, which has no `instructorapplications` ids.
4. Copy `…/scratchpad/phase-5-6/t5-order.cjs` into `$H/` (Task 5 uses it).
5. After Task 1's commit: restart the dev server (`restart-dev.ps1`), then `curl -s -o /dev/null -w "%{http_code}\n" $BASE/` → 200.

---
### Task 1: Faculty data — `User` fields, country list, shared faculty rules

**Files:**
- Modify: `lib/db/models/user.ts` (the `IUser` interface around `preferredLanguage` / `instructorProfile`; the schema around the same two fields)
- Create: `lib/countries.ts`
- Create: `lib/faculty.ts`

**Interfaces:**
- Consumes: `zod/v4`; nothing from other Phase 5 tasks.
- Produces (later tasks rely on these exact names):
  - `IUser.country: string | null`
  - `IUser.instructorProfile.specialization: string | null`, `.experience: string | null`, `.credentials: string[]`, `.featured: boolean`
  - `lib/countries.ts`:
    - `COUNTRY_CODES` (249 codes, `as const`)
    - `type CountryCode`
    - `isCountryCode(value: unknown): value is CountryCode`
    - `countryName(code: string | null | undefined): string | null`
    - `type CountryOption = { value: CountryCode; label: string }`
    - `countryOptions(): CountryOption[]` (sorted by English name)
  - `lib/faculty.ts`:
    - `FACULTY_ROLES`, `isFacultyRole(role): role is "INSTRUCTOR" | "ADMIN"`
    - `FACULTY_LIMITS` (`headline` 120, `specialization` 80, `bio` 1000, `experience` 2000, `expertiseItems` 8, `expertiseItem` 40, `credentialItems` 10, `credentialItem` 120, `link` 300)
    - `type FacultyProfileForm = { headline: string; specialization: string; bio: string; experience: string; expertise: string[]; credentials: string[]; country: string | null; socialLinks: { twitter: string; linkedin: string; website: string } }`
    - `FacultyProfileSchema`, `AdminFacultyProfileSchema` (adds `featured: boolean`), `type FacultyProfileValues`
    - `firstFacultyError(error: z.ZodError): string`
    - `facultyProfileSet(values: FacultyProfileValues): Record<string, unknown>`
    - `facultyFormFrom(user): FacultyProfileForm`
    - `safeWebUrl(value: string | null | undefined): string | null`
    - `facultyHref(username: string): string`, `facultyInitials(name: string): string`

- [ ] **Step 1: Model interface.** In `lib/db/models/user.ts` replace

```ts
  preferredLanguage: string | null
  // For instructors
  instructorProfile?: {
    headline: string | null
    expertise: string[]
```

with

```ts
  preferredLanguage: string | null
  /** ISO 3166-1 alpha-2 code (lib/countries.ts); null = not shown. Faculty pages now; testimonials reuse it in Phase 6. */
  country: string | null
  // For instructors
  instructorProfile?: {
    headline: string | null
    /** Area of specialization (spec §10), distinct from the one-line headline. */
    specialization: string | null
    /** Professional experience (spec §10), ≤ 2,000 chars; seeded from the approved application. */
    experience: string | null
    /** Credentials and achievements (spec §10), ≤ 10 items × 120 chars. */
    credentials: string[]
    /** Admin-curated: featured faculty are listed first on /faculty and the homepage. */
    featured: boolean
    expertise: string[]
```

- [ ] **Step 2: Model schema.** In the same file replace

```ts
    preferredLanguage: {
      type: String,
      default: null,
    },
    instructorProfile: {
      headline: { type: String, default: null },
      expertise: [{ type: String }],
```

with

```ts
    preferredLanguage: {
      type: String,
      default: null,
    },
    country: {
      type: String,
      default: null,
    },
    instructorProfile: {
      headline: { type: String, default: null },
      specialization: { type: String, default: null },
      experience: { type: String, default: null },
      credentials: [{ type: String }],
      featured: { type: Boolean, default: false },
      expertise: [{ type: String }],
```

(No length limits in the schema: validation lives in `FacultyProfileSchema`, so rows the Go API wrote never fail a web save.)

- [ ] **Step 3: Countries.** Create `lib/countries.ts`:

```ts
/**
 * ISO 3166-1 alpha-2 country codes — all 249 officially assigned — with
 * English names from the runtime's built-in `Intl.DisplayNames`, so there is
 * no dependency and no hand-kept name table. `User.country` stores the code;
 * pages print the name. Client-safe: no server imports.
 */
export const COUNTRY_CODES = [
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ",
  "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS",
  "BT", "BV", "BW", "BY", "BZ", "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN",
  "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ", "DE", "DJ", "DK", "DM", "DO", "DZ", "EC", "EE",
  "EG", "EH", "ER", "ES", "ET", "FI", "FJ", "FK", "FM", "FO", "FR", "GA", "GB", "GD", "GE", "GF",
  "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY", "HK", "HM",
  "HN", "HR", "HT", "HU", "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT", "JE", "JM",
  "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ", "LA", "LB", "LC",
  "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK",
  "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA",
  "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ", "OM", "PA", "PE", "PF", "PG",
  "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY", "QA", "RE", "RO", "RS", "RU", "RW",
  "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS",
  "ST", "SV", "SX", "SY", "SZ", "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO",
  "TR", "TT", "TV", "TW", "TZ", "UA", "UG", "UM", "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VI",
  "VN", "VU", "WF", "WS", "YE", "YT", "ZA", "ZM", "ZW",
] as const

export type CountryCode = (typeof COUNTRY_CODES)[number]

const CODE_SET: ReadonlySet<string> = new Set(COUNTRY_CODES)

export function isCountryCode(value: unknown): value is CountryCode {
  return typeof value === "string" && CODE_SET.has(value)
}

let displayNames: Intl.DisplayNames | null = null

/** English name for a stored code ("NG" → "Nigeria"); null for null or an unknown code. */
export function countryName(code: string | null | undefined): string | null {
  if (!isCountryCode(code)) return null
  if (!displayNames) displayNames = new Intl.DisplayNames(["en"], { type: "region" })
  return displayNames.of(code) ?? code
}

export type CountryOption = { value: CountryCode; label: string }

/**
 * Every country as a select option, sorted by English name. Compute it on the
 * server and pass it down wherever the select is server-rendered — the
 * browser's ICU data can name a country differently from Node's.
 */
export function countryOptions(): CountryOption[] {
  return COUNTRY_CODES.map((code) => ({ value: code, label: countryName(code) ?? code })).sort((a, b) =>
    a.label.localeCompare(b.label, "en")
  )
}
```

- [ ] **Step 4: Faculty rules.** Create `lib/faculty.ts`:

```ts
import { z } from "zod/v4"
import { isCountryCode } from "@/lib/countries"

/**
 * Faculty (spec §10): the rules both profile editors share. Pure and
 * client-safe. The editors import the limits and the form type;
 * `lib/actions/profile.ts` and `lib/actions/admin-users.ts` validate with the
 * same schema. It lives here because a "use server" file may only export
 * async functions.
 *
 * Who is faculty: role INSTRUCTOR or ADMIN **and** at least one published
 * course. `isFacultyRole` is the role half; the course half is a query in the
 * FACULTY section of `lib/actions/student.ts`.
 */

export const FACULTY_ROLES = ["INSTRUCTOR", "ADMIN"] as const
export type FacultyRole = (typeof FACULTY_ROLES)[number]

export function isFacultyRole(role: string | null | undefined): role is FacultyRole {
  return role === "INSTRUCTOR" || role === "ADMIN"
}

export const FACULTY_LIMITS = {
  headline: 120,
  specialization: 80,
  bio: 1000,
  experience: 2000,
  expertiseItems: 8,
  expertiseItem: 40,
  credentialItems: 10,
  credentialItem: 120,
  link: 300,
} as const

/** What the editors hold. Text fields are always strings ("" = empty); the schema stores "" as null. */
export type FacultyProfileForm = {
  headline: string
  specialization: string
  bio: string
  experience: string
  expertise: string[]
  credentials: string[]
  country: string | null
  socialLinks: { twitter: string; linkedin: string; website: string }
}

/** An http(s) address with a dotted host, else null — never a javascript: or data: URL. */
export function safeWebUrl(value: string | null | undefined): string | null {
  const v = value?.trim()
  if (!v) return null
  try {
    const url = new URL(v)
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname.includes(".") ? v : null
  } catch {
    return null
  }
}

const n = (value: number) => value.toLocaleString("en-US")
const unique = (items: string[]) => Array.from(new Set(items))

function text(max: number, label: string) {
  return z
    .string()
    .trim()
    .max(max, `${label} must be ${n(max)} characters or less`)
    .nullable()
    .transform((v) => (v ? v : null))
}

function link(label: string) {
  return (
    z
      .string()
      .trim()
      .max(FACULTY_LIMITS.link, `${label} must be ${n(FACULTY_LIMITS.link)} characters or less`)
      .nullable()
      // People paste "linkedin.com/in/you" — assume https when no scheme is given.
      .transform((v) => (v ? (/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`) : null))
      .refine((v) => v === null || safeWebUrl(v) !== null, `${label} must be a web address`)
  )
}

export const FacultyProfileSchema = z.object({
  headline: text(FACULTY_LIMITS.headline, "Headline"),
  specialization: text(FACULTY_LIMITS.specialization, "Area of specialization"),
  bio: text(FACULTY_LIMITS.bio, "Short biography"),
  experience: text(FACULTY_LIMITS.experience, "Professional experience"),
  expertise: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Remove the blank area of expertise")
        .max(FACULTY_LIMITS.expertiseItem, `Each area of expertise must be ${FACULTY_LIMITS.expertiseItem} characters or less`)
    )
    .max(FACULTY_LIMITS.expertiseItems, `Add at most ${FACULTY_LIMITS.expertiseItems} areas of expertise`)
    .transform(unique),
  credentials: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Remove the blank credential")
        .max(FACULTY_LIMITS.credentialItem, `Each credential must be ${FACULTY_LIMITS.credentialItem} characters or less`)
    )
    .max(FACULTY_LIMITS.credentialItems, `Add at most ${FACULTY_LIMITS.credentialItems} credentials`)
    .transform(unique),
  country: z
    .string()
    .nullable()
    .refine((v) => v === null || isCountryCode(v), "Choose a country from the list"),
  socialLinks: z.object({
    twitter: link("X (Twitter)"),
    linkedin: link("LinkedIn"),
    website: link("Website"),
  }),
})

/** The admin dialog's schema: the same profile plus the curation flag. */
export const AdminFacultyProfileSchema = FacultyProfileSchema.extend({ featured: z.boolean() })

export type FacultyProfileValues = z.output<typeof FacultyProfileSchema>

/** First validation message, for the `{ success: false, error }` action shape. */
export function firstFacultyError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the profile and try again"
}

/**
 * The targeted `$set` a validated profile writes. Dotted `instructorProfile.*`
 * paths leave the counters (totalStudents, totalCourses, totalEarnings),
 * `featured`, and anything the Go backend stored untouched. Empty social links
 * are dropped, never stored as null.
 */
export function facultyProfileSet(values: FacultyProfileValues): Record<string, unknown> {
  const { twitter, linkedin, website } = values.socialLinks
  return {
    bio: values.bio,
    country: values.country,
    "instructorProfile.headline": values.headline,
    "instructorProfile.specialization": values.specialization,
    "instructorProfile.experience": values.experience,
    "instructorProfile.expertise": values.expertise,
    "instructorProfile.credentials": values.credentials,
    "instructorProfile.socialLinks": {
      ...(twitter ? { twitter } : {}),
      ...(linkedin ? { linkedin } : {}),
      ...(website ? { website } : {}),
    },
  }
}

type FacultySource = {
  bio?: string | null
  country?: string | null
  instructorProfile?: {
    headline?: string | null
    specialization?: string | null
    experience?: string | null
    expertise?: string[] | null
    credentials?: string[] | null
    socialLinks?: { twitter?: string | null; linkedin?: string | null; website?: string | null } | null
  } | null
}

/** A stored user (lean or hydrated) as editor state. Legacy rows missing Phase 5 fields read as empty. */
export function facultyFormFrom(user: FacultySource): FacultyProfileForm {
  const profile = user.instructorProfile
  return {
    headline: profile?.headline ?? "",
    specialization: profile?.specialization ?? "",
    bio: user.bio ?? "",
    experience: profile?.experience ?? "",
    expertise: [...(profile?.expertise ?? [])],
    credentials: [...(profile?.credentials ?? [])],
    country: isCountryCode(user.country) ? user.country : null,
    socialLinks: {
      twitter: profile?.socialLinks?.twitter ?? "",
      linkedin: profile?.socialLinks?.linkedin ?? "",
      website: profile?.socialLinks?.website ?? "",
    },
  }
}

/** Public profile URL. Usernames are unique but not guaranteed URL-safe (mobile-created rows), so encode. */
export function facultyHref(username: string): string {
  return `/faculty/${encodeURIComponent(username)}`
}

export function facultyInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}
```

- [ ] **Step 5: Verify.**
  1. tsc (filtered) prints nothing; `npx eslint lib/db/models/user.ts lib/countries.ts lib/faculty.ts` prints nothing.
  2. Rule assertions. Create `"$H/t5-faculty.ts"`:

```ts
import assert from "node:assert/strict"
import { COUNTRY_CODES, countryName, countryOptions, isCountryCode } from "@/lib/countries"
import {
  AdminFacultyProfileSchema, FacultyProfileSchema, facultyFormFrom, facultyHref, facultyInitials,
  facultyProfileSet, firstFacultyError, isFacultyRole, safeWebUrl, type FacultyProfileForm,
} from "@/lib/faculty"

assert.equal(COUNTRY_CODES.length, 249)
assert.equal(new Set(COUNTRY_CODES).size, 249)
assert.equal(countryName("NG"), "Nigeria")
assert.equal(countryName("XX"), null)
assert.equal(countryName(null), null)
assert.equal(isCountryCode("us"), false)
const options = countryOptions()
assert.equal(options.length, 249)
assert.equal(options[0].value, "AF")
assert.ok(options.every((o) => o.label !== o.value), "every code has an English name")

const valid: FacultyProfileForm = {
  headline: "  Crypto Trading Expert & Blockchain Educator ",
  specialization: "Crypto markets & risk management",
  bio: "Former Wall Street analyst turned crypto educator.",
  experience: "",
  expertise: ["Technical analysis", "Risk management", "Technical analysis"],
  credentials: ["CFA Charterholder"],
  country: "US",
  socialLinks: { twitter: "", linkedin: "linkedin.com/in/sarahchen", website: "https://sarahchen.example.com" },
}
const ok = FacultyProfileSchema.safeParse(valid)
assert.ok(ok.success)
assert.equal(ok.data.headline, "Crypto Trading Expert & Blockchain Educator")
assert.equal(ok.data.experience, null)
assert.deepEqual(ok.data.expertise, ["Technical analysis", "Risk management"])
assert.equal(ok.data.socialLinks.linkedin, "https://linkedin.com/in/sarahchen")
assert.equal(ok.data.socialLinks.twitter, null)
assert.deepEqual(facultyProfileSet(ok.data), {
  bio: "Former Wall Street analyst turned crypto educator.",
  country: "US",
  "instructorProfile.headline": "Crypto Trading Expert & Blockchain Educator",
  "instructorProfile.specialization": "Crypto markets & risk management",
  "instructorProfile.experience": null,
  "instructorProfile.expertise": ["Technical analysis", "Risk management"],
  "instructorProfile.credentials": ["CFA Charterholder"],
  "instructorProfile.socialLinks": { linkedin: "https://linkedin.com/in/sarahchen", website: "https://sarahchen.example.com" },
})

const refuse = (patch: Partial<FacultyProfileForm>, message: string) => {
  const r = FacultyProfileSchema.safeParse({ ...valid, ...patch })
  assert.ok(!r.success, `expected refusal: ${message}`)
  assert.equal(firstFacultyError(r.error), message)
}
refuse({ bio: "x".repeat(1001) }, "Short biography must be 1,000 characters or less")
refuse({ experience: "x".repeat(2001) }, "Professional experience must be 2,000 characters or less")
refuse({ credentials: Array.from({ length: 11 }, (_, i) => `Credential ${i}`) }, "Add at most 10 credentials")
refuse({ credentials: ["x".repeat(121)] }, "Each credential must be 120 characters or less")
refuse({ credentials: ["  "] }, "Remove the blank credential")
refuse({ expertise: Array.from({ length: 9 }, (_, i) => `Area ${i}`) }, "Add at most 8 areas of expertise")
refuse({ country: "XX" }, "Choose a country from the list")
refuse({ socialLinks: { ...valid.socialLinks, website: "javascript:alert(1)" } }, "Website must be a web address")
refuse({ socialLinks: { ...valid.socialLinks, linkedin: "localhost" } }, "LinkedIn must be a web address")
assert.ok(FacultyProfileSchema.safeParse({ ...valid, bio: "x".repeat(1000) }).success, "exactly 1000 is allowed")

const admin = AdminFacultyProfileSchema.safeParse({ ...valid, featured: true })
assert.ok(admin.success && admin.data.featured === true)
assert.ok(!AdminFacultyProfileSchema.safeParse(valid).success, "featured is required for admins")

assert.deepEqual(facultyFormFrom({ bio: null, country: "ZZ", instructorProfile: { headline: "H", expertise: ["a"], socialLinks: { website: "https://x.com" } } }), {
  headline: "H", specialization: "", bio: "", experience: "", expertise: ["a"], credentials: [], country: null,
  socialLinks: { twitter: "", linkedin: "", website: "https://x.com" },
})
assert.deepEqual(facultyFormFrom({}).expertise, [])

assert.equal(safeWebUrl("javascript:alert(1)"), null)
assert.equal(safeWebUrl("https://twitter.com/sarah"), "https://twitter.com/sarah")
assert.equal(safeWebUrl("sarah"), null)
assert.equal(facultyHref("sarah_chen"), "/faculty/sarah_chen")
assert.equal(facultyHref("a b/c"), "/faculty/a%20b%2Fc")
assert.equal(facultyInitials("Sarah  Chen"), "SC")
assert.equal(isFacultyRole("ADMIN"), true)
assert.equal(isFacultyRole("USER"), false)
console.log("faculty rules: all assertions passed")
```

   Run from the repo root: `npx tsx --tsconfig ./tsconfig.json "$H/t5-faculty.ts"` → `faculty rules: all assertions passed`.
  3. Model defaults. Create `"$H/t5-model.ts"`:

```ts
import assert from "node:assert/strict"
import { User } from "@/lib/db/models/user"

const u = new User({ authUserId: "user_x", email: "x@example.com", username: "x" })
assert.equal(u.country, null)
assert.equal(u.instructorProfile?.specialization, null)
assert.equal(u.instructorProfile?.experience, null)
assert.deepEqual([...(u.instructorProfile?.credentials ?? [])], [])
assert.equal(u.instructorProfile?.featured, false)
assert.equal(u.instructorProfile?.totalStudents, 0)
assert.ok(User.schema.path("instructorProfile.specialization"), "dotted $set path exists in the schema")
assert.ok(User.schema.path("instructorProfile.featured"))
assert.ok(User.schema.path("country"))
console.log("user model: Phase 5 defaults OK")
```

   Run `npx tsx --tsconfig ./tsconfig.json "$H/t5-model.ts"` → `user model: Phase 5 defaults OK`. No database is touched.

   If tsx can't resolve `@/lib/…` for a file outside the repo, change the imports in both scripts to absolute file paths into the repo, and say so in the report.

- [ ] **Step 6: Commit.**

```bash
git add lib/db/models/user.ts lib/countries.ts lib/faculty.ts
git commit -m "feat(faculty): profile fields, country list and shared faculty rules

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

   **Controller restarts the dev server now** (Controller setup, step 5). Until then Mongoose strips the new paths from every `$set`.

---
### Task 2: Instructors edit their faculty profile (`/instructor/profile`)

**Files:**
- Modify: `lib/actions/profile.ts` (imports; `updateProfile` bio cap; append a FACULTY PROFILE section)
- Create: `components/faculty/faculty-profile-fields.tsx`
- Create: `app/(instructor)/instructor/profile/faculty-profile-card.tsx`
- Modify: `app/(instructor)/instructor/profile/page.tsx` (whole file)
- Modify: `app/(instructor)/instructor/profile/instructor-profile-client.tsx` (imports, props, bio state, save call, bio field, children slot)
- Modify: `app/(instructor)/instructor/settings/instructor-profile-client.tsx` (bio `maxLength` only)
- Modify: `app/(platform)/dashboard/profile/page.tsx` (bio `maxLength` only)

**Interfaces:**
- Consumes (Task 1): `FACULTY_LIMITS`, `FacultyProfileSchema`, `facultyFormFrom`, `facultyProfileSet`, `firstFacultyError`, `isFacultyRole`, `FacultyProfileForm`, `CountryOption`, `countryOptions`.
- Produces:
  - `getMyFacultyProfile(): Promise<FacultyProfileForm | null>` (null for USER)
  - `updateFacultyProfile(input: FacultyProfileForm): Promise<{ success: true } | { success: false; error: string }>`
  - `FacultyProfileFields({ value: FacultyProfileForm; onChange: (next: FacultyProfileForm) => void; countries: CountryOption[]; idPrefix: string; disabled?: boolean })`: a client component that Task 3 reuses. Input ids are `${idPrefix}-headline|specialization|bio|experience|expertise|credentials|country|website|linkedin|twitter`.
  - `updateProfile` refuses `bio` longer than 1,000 chars with `"Bio must be 1,000 characters or less"`.

- [ ] **Step 1: Actions.** In `lib/actions/profile.ts`:
  - directly under `import { revalidatePath } from "next/cache"` add:

```ts
import {
  FACULTY_LIMITS,
  FacultyProfileSchema,
  facultyFormFrom,
  facultyProfileSet,
  firstFacultyError,
  isFacultyRole,
  type FacultyProfileForm,
} from "@/lib/faculty"
```

  - in `updateProfile` replace

```ts
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const update: Record<string, string> = {}
```

   with

```ts
    if (!currentUser) return { success: false, error: "Not authenticated" }
    if (data.bio !== undefined && data.bio.trim().length > FACULTY_LIMITS.bio)
      return { success: false, error: "Bio must be 1,000 characters or less" }

    const update: Record<string, string> = {}
```

  - append at the end of the file:

```ts

// ============================================================================
// FACULTY PROFILE (spec §10) — /instructor/profile; the admin dialog shares the schema
// ============================================================================

/** The signed-in user's faculty fields as editor state; null for students (only instructors and admins have one). */
export async function getMyFacultyProfile(): Promise<FacultyProfileForm | null> {
  try {
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser || !isFacultyRole(currentUser.role)) return null

    const user = await User.findById(currentUser.id).select("bio country instructorProfile").lean()
    return user ? facultyFormFrom(user) : null
  } catch (error) {
    console.error("Get faculty profile error:", error)
    return null
  }
}

/**
 * Save the signed-in instructor's faculty fields. Same schema as the admin
 * editor; written as a targeted $set, so the student counters and the
 * admin-only `featured` flag are untouched.
 */
export async function updateFacultyProfile(
  input: FacultyProfileForm
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }
    if (!isFacultyRole(currentUser.role)) {
      return { success: false, error: "Only instructors and admins have a faculty profile" }
    }

    const parsed = FacultyProfileSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: firstFacultyError(parsed.error) }

    await User.updateOne({ _id: currentUser.id }, { $set: facultyProfileSet(parsed.data) })

    revalidatePath("/instructor/profile")
    revalidatePath("/faculty", "layout")
    revalidatePath("/")
    return { success: true }
  } catch (error) {
    console.error("Update faculty profile error:", error)
    return { success: false, error: "Failed to update faculty profile" }
  }
}
```

- [ ] **Step 2: Shared fields.** Create `components/faculty/faculty-profile-fields.tsx`:

```tsx
"use client"

import { useState } from "react"
import { PlusIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { CountryOption } from "@/lib/countries"
import { FACULTY_LIMITS, type FacultyProfileForm } from "@/lib/faculty"

/** Select value for "no country" — Base UI items need a string key. */
const NO_COUNTRY = "none"

const LINK_FIELDS = [
  { key: "website", label: "Website", placeholder: "https://your-site.com" },
  { key: "linkedin", label: "LinkedIn", placeholder: "linkedin.com/in/you" },
  { key: "twitter", label: "X (Twitter)", placeholder: "x.com/you" },
] as const

/**
 * The spec §10 faculty fields as one controlled block. The instructor's own
 * editor (/instructor/profile) and the admin dialog (/admin/users) render
 * exactly these fields against the same limits; the server re-validates with
 * `FacultyProfileSchema`. Name and photo stay in the owner's account card.
 */
export function FacultyProfileFields({
  value,
  onChange,
  countries,
  idPrefix,
  disabled = false,
}: {
  value: FacultyProfileForm
  onChange: (next: FacultyProfileForm) => void
  /** From `countryOptions()` — computed on the server wherever this block is server-rendered. */
  countries: CountryOption[]
  /** Prefix for input ids, so labels stay unique on the page. */
  idPrefix: string
  disabled?: boolean
}) {
  const [expertiseDraft, setExpertiseDraft] = useState("")
  const [credentialDraft, setCredentialDraft] = useState("")
  const id = (name: string) => `${idPrefix}-${name}`
  const countryItems = [{ value: NO_COUNTRY, label: "Not shown" }, ...countries]
  const expertiseFull = value.expertise.length >= FACULTY_LIMITS.expertiseItems
  const credentialsFull = value.credentials.length >= FACULTY_LIMITS.credentialItems

  function patch(next: Partial<FacultyProfileForm>) {
    onChange({ ...value, ...next })
  }

  function addExpertise() {
    const tag = expertiseDraft.trim().slice(0, FACULTY_LIMITS.expertiseItem)
    if (tag && !value.expertise.includes(tag) && !expertiseFull) {
      patch({ expertise: [...value.expertise, tag] })
    }
    setExpertiseDraft("")
  }

  function addCredential() {
    const item = credentialDraft.trim().slice(0, FACULTY_LIMITS.credentialItem)
    if (item && !value.credentials.includes(item) && !credentialsFull) {
      patch({ credentials: [...value.credentials, item] })
    }
    setCredentialDraft("")
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor={id("headline")}>Headline</Label>
        <Input
          id={id("headline")}
          value={value.headline}
          onChange={(e) => patch({ headline: e.target.value })}
          maxLength={FACULTY_LIMITS.headline}
          placeholder="e.g. Forex educator and former bank dealer"
          disabled={disabled}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={id("specialization")}>Area of specialization</Label>
        <Input
          id={id("specialization")}
          value={value.specialization}
          onChange={(e) => patch({ specialization: e.target.value })}
          maxLength={FACULTY_LIMITS.specialization}
          placeholder="e.g. Risk management for retail traders"
          disabled={disabled}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor={id("bio")}>Short biography</Label>
          <span className="text-[11px] tabular-nums text-ws-subtle">
            {value.bio.length.toLocaleString("en-US")} / {FACULTY_LIMITS.bio.toLocaleString("en-US")}
          </span>
        </div>
        <Textarea
          id={id("bio")}
          value={value.bio}
          onChange={(e) => patch({ bio: e.target.value })}
          maxLength={FACULTY_LIMITS.bio}
          className="min-h-24"
          placeholder="Who you are and what you teach, in a few sentences."
          disabled={disabled}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor={id("experience")}>Professional experience</Label>
          <span className="text-[11px] tabular-nums text-ws-subtle">
            {value.experience.length.toLocaleString("en-US")} / {FACULTY_LIMITS.experience.toLocaleString("en-US")}
          </span>
        </div>
        <Textarea
          id={id("experience")}
          value={value.experience}
          onChange={(e) => patch({ experience: e.target.value })}
          maxLength={FACULTY_LIMITS.experience}
          className="min-h-32"
          placeholder="Roles, years in the field and the work you have done."
          disabled={disabled}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={id("expertise")}>Areas of expertise</Label>
        <div className="flex gap-2">
          <Input
            id={id("expertise")}
            value={expertiseDraft}
            onChange={(e) => setExpertiseDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault()
                addExpertise()
              }
            }}
            maxLength={FACULTY_LIMITS.expertiseItem}
            placeholder={expertiseFull ? "Limit reached" : "e.g. Technical analysis — press Enter"}
            disabled={disabled || expertiseFull}
          />
          <Button type="button" variant="outline" size="sm" onClick={addExpertise} disabled={disabled || expertiseFull}>
            <PlusIcon size={14} aria-hidden />
            Add
          </Button>
        </div>
        {value.expertise.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 pt-1">
            {value.expertise.map((tag) => (
              <li
                key={tag}
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-ws-chip py-0.5 pl-2.5 pr-1 text-[12px] text-ws-primary"
              >
                <span className="truncate">{tag}</span>
                <button
                  type="button"
                  onClick={() => patch({ expertise: value.expertise.filter((t) => t !== tag) })}
                  aria-label={`Remove ${tag}`}
                  disabled={disabled}
                  className="flex size-5 shrink-0 items-center justify-center rounded-full text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised hover:text-ws-primary"
                >
                  <XIcon size={12} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-ws-subtle">Up to {FACULTY_LIMITS.expertiseItems}.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={id("credentials")}>Credentials &amp; achievements</Label>
        <div className="flex gap-2">
          <Input
            id={id("credentials")}
            value={credentialDraft}
            onChange={(e) => setCredentialDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                addCredential()
              }
            }}
            maxLength={FACULTY_LIMITS.credentialItem}
            placeholder={credentialsFull ? "Limit reached" : "e.g. a certification or award — press Enter"}
            disabled={disabled || credentialsFull}
          />
          <Button type="button" variant="outline" size="sm" onClick={addCredential} disabled={disabled || credentialsFull}>
            <PlusIcon size={14} aria-hidden />
            Add
          </Button>
        </div>
        {value.credentials.length > 0 && (
          <ul className="rounded-md border border-ws-hairline">
            {value.credentials.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 border-t border-ws-hairline px-3 py-2 text-[13px] text-ws-primary first:border-t-0"
              >
                <span className="min-w-0 flex-1 break-words">{item}</span>
                <button
                  type="button"
                  onClick={() => patch({ credentials: value.credentials.filter((c) => c !== item) })}
                  aria-label={`Remove ${item}`}
                  disabled={disabled}
                  className="flex size-5 shrink-0 items-center justify-center rounded-full text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised hover:text-ws-primary"
                >
                  <XIcon size={12} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-ws-subtle">Up to {FACULTY_LIMITS.credentialItems}.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={id("country")}>Country</Label>
        <Select
          items={countryItems}
          value={value.country ?? NO_COUNTRY}
          onValueChange={(v) => patch({ country: v && v !== NO_COUNTRY ? v : null })}
          disabled={disabled}
        >
          <SelectTrigger id={id("country")} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {countryItems.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <fieldset className="space-y-3">
        <legend className="mb-3 text-sm font-medium text-ws-primary">Links</legend>
        {LINK_FIELDS.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <Label htmlFor={id(field.key)}>{field.label}</Label>
            <Input
              id={id(field.key)}
              inputMode="url"
              autoComplete="url"
              value={value.socialLinks[field.key]}
              onChange={(e) => patch({ socialLinks: { ...value.socialLinks, [field.key]: e.target.value } })}
              maxLength={FACULTY_LIMITS.link}
              placeholder={field.placeholder}
              disabled={disabled}
            />
          </div>
        ))}
      </fieldset>
    </div>
  )
}
```

- [ ] **Step 3: The card.** Create `app/(instructor)/instructor/profile/faculty-profile-card.tsx`:

```tsx
"use client"

import { useState, useTransition } from "react"
import { CheckIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FacultyProfileFields } from "@/components/faculty/faculty-profile-fields"
import { updateFacultyProfile } from "@/lib/actions/profile"
import type { CountryOption } from "@/lib/countries"
import type { FacultyProfileForm } from "@/lib/faculty"

/**
 * The instructor's own faculty profile (spec §10) — what /faculty/[username]
 * shows once they teach a published program.
 */
export function FacultyProfileCard({
  initial,
  countries,
}: {
  initial: FacultyProfileForm
  countries: CountryOption[]
}) {
  const [value, setValue] = useState(initial)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function save() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await updateFacultyProfile(value)
      if (result.success) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Faculty profile</CardTitle>
        <CardDescription>Shown on your public faculty page once you teach a published program.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <FacultyProfileFields
          value={value}
          onChange={setValue}
          countries={countries}
          idPrefix="faculty"
          disabled={pending}
        />
        {error && <p className="text-xs text-ws-danger">{error}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant="outline" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save faculty profile"}
          </Button>
          {saved && (
            <p className="flex items-center gap-1 text-xs text-ws-success">
              <CheckIcon size={14} aria-hidden />
              Faculty profile updated
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: The page.** Replace the whole of `app/(instructor)/instructor/profile/page.tsx` with:

```tsx
import { Topbar } from "@/components/platform/topbar"
import { PageHeader } from "@/components/shared/page-header"
import { getCurrentUser } from "@/lib/auth"
import { getMySignature } from "@/lib/actions/signature"
import { getMyFacultyProfile } from "@/lib/actions/profile"
import { countryOptions } from "@/lib/countries"
import { InstructorProfileClient } from "./instructor-profile-client"
import { FacultyProfileCard } from "./faculty-profile-card"

export default async function InstructorProfilePage() {
  const [currentUser, currentSignature, faculty] = await Promise.all([
    getCurrentUser(),
    getMySignature(),
    getMyFacultyProfile(),
  ])

  return (
    <>
      <Topbar title="Profile" variant="instructor" />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-2xl space-y-8">
          <PageHeader
            title="My Profile"
            subline="Manage your instructor profile, faculty page and signature."
          />

          <InstructorProfileClient
            user={currentUser}
            currentSignatureUrl={currentSignature}
          >
            {/* Country names are computed here, on the server, so the select's
                server-rendered label matches hydration. */}
            {faculty && <FacultyProfileCard initial={faculty} countries={countryOptions()} />}
          </InstructorProfileClient>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 5: Account card.** In `app/(instructor)/instructor/profile/instructor-profile-client.tsx` make these six replacements (bio moves to the faculty card — ruling 15):
  1. Replace

```tsx
import { useRef, useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
```

   with

```tsx
import { useRef, useState, useTransition, type ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
```

  2. Replace

```tsx
export function InstructorProfileClient({
  user,
  currentSignatureUrl,
}: {
  user: LocalUser | null
  currentSignatureUrl: string | null
}) {
```

   with

```tsx
export function InstructorProfileClient({
  user,
  currentSignatureUrl,
  children,
}: {
  user: LocalUser | null
  currentSignatureUrl: string | null
  /** Rendered between the account card and the signature card — the faculty profile card. */
  children?: ReactNode
}) {
```

  3. Replace

```tsx
  const [lastName, setLastName] = useState(user?.lastName ?? "")
  const [bio, setBio] = useState(user?.bio ?? "")
```

   with

```tsx
  const [lastName, setLastName] = useState(user?.lastName ?? "")
```

  4. Replace `      const result = await updateProfile({ firstName, lastName, bio })` with `      const result = await updateProfile({ firstName, lastName })`.
  5. Replace

```tsx
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="min-h-24"
              placeholder="Share your teaching experience and expertise…"
            />
          </div>

          <div className="flex items-center gap-3">
```

   with

```tsx
          </div>

          <div className="flex items-center gap-3">
```

  6. Replace

```tsx
      </Card>

      {/* ── Signature card ────────────────────────────────────── */}
```

   with

```tsx
      </Card>

      {children}

      {/* ── Signature card ────────────────────────────────────── */}
```

- [ ] **Step 6: The other bio fields.**
  - In `app/(instructor)/instructor/settings/instructor-profile-client.tsx` replace

```tsx
              onChange={(e) => setBio(e.target.value)}
              className="min-h-20"
              placeholder="Describe your teaching background…"
```

   with

```tsx
              onChange={(e) => setBio(e.target.value)}
              maxLength={1000}
              className="min-h-20"
              placeholder="Describe your teaching background…"
```

  - In `app/(platform)/dashboard/profile/page.tsx` replace

```tsx
                    onChange={(e) => setBio(e.target.value)}
                    className="min-h-20"
                    placeholder="Tell us about yourself..."
```

   with

```tsx
                    onChange={(e) => setBio(e.target.value)}
                    maxLength={1000}
                    className="min-h-20"
                    placeholder="Tell us about yourself..."
```

- [ ] **Step 7: Verify.** The dev server must have been restarted after Task 1 (ask the controller if unsure; do not restart it yourself).
  1. tsc (filtered) prints nothing. `npx eslint lib/actions/profile.ts components/faculty/faculty-profile-fields.tsx "app/(instructor)/instructor/profile/page.tsx" "app/(instructor)/instructor/profile/instructor-profile-client.tsx" "app/(instructor)/instructor/profile/faculty-profile-card.tsx" "app/(instructor)/instructor/settings/instructor-profile-client.tsx" "app/(platform)/dashboard/profile/page.tsx"` → 0 errors and exactly the 3 pre-existing `no-img-element` warnings.
  2. Save:
     - `bash "$H/action.sh" /instructor/profile updateFacultyProfile "[$PROFILE]" instructor` → `{"success":true}`.
     - `node "$H/mockdb.cjs" user $SARAH` shows:
       - `"bio": "Former Wall Street analyst turned crypto educator."` and `"country": "US"`;
       - `instructorProfile` with `specialization: "Crypto markets and risk management"`, `experience: "Twelve years…"`, `credentials` (2), `socialLinks: { linkedin: "https://linkedin.com/in/sarahchen", website: "https://sarahchen.example.com" }` (no `twitter` key);
       - **still** `totalStudents: 3741` and the seed's legacy `bio`/`isVerified` keys inside `instructorProfile`, which proves the `$set` was targeted.
  3. The page reads it back: `H2=$(curl -s -b mock_persona=instructor $BASE/instructor/profile | strip)`.
     - Counts of 1 each: `value="Crypto markets and risk management"`, `Twelve years across equities research`, `Fixture credential one`, `United States` (the select label proves `items` is wired), `Faculty profile`, `id="faculty-bio"`.
     - `id="bio"` → 0: the account card lost its bio field.
  4. Refusals. Create `"$H/t5-bad.cjs"`:

```js
// Prints a one-argument action payload: $PROFILE with one invalid field.
const [base, which, extra] = process.argv.slice(2)
const p = JSON.parse(base)
const patches = {
  bio: { bio: "x".repeat(1001) },
  credentials: { credentials: Array.from({ length: 11 }, (_, i) => `Fixture credential ${i}`) },
  country: { country: "XX" },
  website: { socialLinks: { ...p.socialLinks, website: "javascript:alert(1)" } },
}
const payload = { ...p, ...patches[which], ...(extra ? JSON.parse(extra) : {}) }
console.log(JSON.stringify([payload]))
```

   For each `which` in `bio credentials country website`, run `bash "$H/action.sh" /instructor/profile updateFacultyProfile "$(node "$H/t5-bad.cjs" "$PROFILE" $which)" instructor`. Expect `{"success":false,"error":…}` with, in order:
   - `Short biography must be 1,000 characters or less`
   - `Add at most 10 credentials`
   - `Choose a country from the list`
   - `Website must be a web address`

   Afterwards `mockdb user $SARAH` is unchanged from check 2.
  5. Students can't: `ID=$(PRINT_ID=1 bash "$H/action.sh" /instructor/profile updateFacultyProfile '[]' instructor)`, then `curl -s -X POST "$BASE/instructor/profile" -H "Next-Action: $ID" -H "Accept: text/x-component" -H "Content-Type: text/plain;charset=UTF-8" -b mock_persona=student --data "[$PROFILE]" | count 'Only instructors and admins have a faculty profile'` → 1. The student row in `mockdb user $STU` has no `specialization`.
  6. Bio cap on the old action: `bash "$H/action.sh" /instructor/profile updateProfile "$(node -e 'console.log(JSON.stringify([{bio:"x".repeat(1001)}]))')" instructor` → `{"success":false,"error":"Bio must be 1,000 characters or less"}`.
  7. Browser, phone width, instructor:

```bash
$B viewport 400x800 && $B goto "$BASE/" && $B cookie mock_persona=instructor && $B goto "$BASE/instructor/profile" && $B wait --load
$B js "document.documentElement.scrollWidth + '/' + window.innerWidth"
$B js "(async () => { const wait = (ms) => new Promise((r) => setTimeout(r, ms)); const input = document.getElementById('faculty-credentials'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Browser credential'); input.dispatchEvent(new Event('input', { bubbles: true })); await wait(100); input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await wait(200); [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Save faculty profile').click(); for (let i = 0; i < 50; i++) { if (document.body.textContent.includes('Faculty profile updated')) return 'saved'; await wait(200) } return 'no confirmation' })()"
$B screenshot --viewport "$H/t5-t2-profile-400.png"
$B console --errors
$B cookie mock_persona=student
```

   Expect `400/400`, then `saved`. `mockdb user $SARAH` → `credentials` has 3 items, ending `"Browser credential"`. No console errors from this page.
  8. End: `node "$H/mockdb.cjs" restore`.

- [ ] **Step 8: Commit.**

```bash
git add lib/actions/profile.ts components/faculty/faculty-profile-fields.tsx "app/(instructor)/instructor/profile/page.tsx" "app/(instructor)/instructor/profile/instructor-profile-client.tsx" "app/(instructor)/instructor/profile/faculty-profile-card.tsx" "app/(instructor)/instructor/settings/instructor-profile-client.tsx" "app/(platform)/dashboard/profile/page.tsx"
git commit -m "feat(faculty): instructors edit their faculty profile

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---
### Task 3: Admins edit faculty profiles and feature faculty; approval seeds experience

**Files:**
- Modify: `lib/actions/admin-users.ts` (imports; append a FACULTY PROFILE section)
- Modify: `lib/hooks/queries/keys.ts` (one key after `adminApplicationDetail`)
- Create: `components/admin/faculty-profile-dialog.tsx`
- Modify: `app/(admin)/admin/users/page.tsx` (import, one state hook, a Sheet section, the dialog mount)
- Modify: `lib/actions/applications.ts` (`adminDecideApplication`, the approved `$set`)

**Interfaces:**
- Consumes:
  - Task 1: `AdminFacultyProfileSchema`, `facultyFormFrom`, `facultyProfileSet`, `firstFacultyError`, `isFacultyRole`, `FacultyProfileForm`, `countryOptions`.
  - Task 2: `FacultyProfileFields`.
- Produces:
  - `type AdminFacultyProfile = { userId: string; name: string; username: string; form: FacultyProfileForm; featured: boolean }`
  - `adminGetFacultyProfile(userId: string): Promise<AdminFacultyProfile | null>` (null for USER, unknown or invalid ids)
  - `adminUpdateFacultyProfile(userId: string, input: FacultyProfileForm & { featured: boolean }): Promise<{ success: true } | { success: false; error: string }>`
  - `queryKeys.adminFacultyProfile(userId)`
  - `FacultyProfileDialog({ userId: string; onClose: () => void })`
  - Approval writes `instructorProfile.experience` from `answers.experience` when the profile had none, and carries `specialization`, `credentials` and `featured`.

- [ ] **Step 1: Admin actions.** In `lib/actions/admin-users.ts` replace

```ts
import { revalidatePath } from "next/cache"
import connectDB from "@/lib/db"
import { User, Enrollment, Order, Course, InstructorApplication } from "@/lib/db/models"
import { requireAdmin, syncRoleToClerk } from "@/lib/auth/admin"
import { notifyUser } from "@/lib/notify"
```

   with

```ts
import { revalidatePath } from "next/cache"
import mongoose from "mongoose"
import connectDB from "@/lib/db"
import { User, Enrollment, Order, Course, InstructorApplication } from "@/lib/db/models"
import { requireAdmin, syncRoleToClerk } from "@/lib/auth/admin"
import { notifyUser } from "@/lib/notify"
import {
  AdminFacultyProfileSchema,
  facultyFormFrom,
  facultyProfileSet,
  firstFacultyError,
  isFacultyRole,
  type FacultyProfileForm,
} from "@/lib/faculty"
```

   and append at the end of the file:

```ts

// ============================================================================
// FACULTY PROFILE (spec §10) — the "Edit faculty profile" dialog on /admin/users
// ============================================================================

export type AdminFacultyProfile = {
  userId: string
  name: string
  username: string
  form: FacultyProfileForm
  featured: boolean
}

/** One instructor's or admin's faculty fields for the admin dialog; null for students and unknown ids. */
export async function adminGetFacultyProfile(userId: string): Promise<AdminFacultyProfile | null> {
  try {
    await connectDB()
    await requireAdmin()
    if (!mongoose.isValidObjectId(userId)) return null

    const u = await User.findById(userId)
      .select("username firstName lastName role bio country instructorProfile")
      .lean()
    if (!u || !isFacultyRole(u.role)) return null

    return {
      userId: u._id.toString(),
      name: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.username,
      username: u.username,
      form: facultyFormFrom(u),
      featured: u.instructorProfile?.featured ?? false,
    }
  } catch (error) {
    console.error("Admin get faculty profile error:", error)
    return null
  }
}

/**
 * Admin save of a faculty profile: the instructor editor's schema plus
 * `featured`. Name and photo are not editable here — they belong to the
 * account owner, who sets them on /instructor/profile.
 */
export async function adminUpdateFacultyProfile(
  userId: string,
  input: FacultyProfileForm & { featured: boolean }
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await connectDB()
    await requireAdmin()

    if (!mongoose.isValidObjectId(userId)) return { success: false, error: "User not found" }
    const user = await User.findById(userId).select("role").lean()
    if (!user) return { success: false, error: "User not found" }
    if (!isFacultyRole(user.role)) {
      return { success: false, error: "Only instructors and admins have a faculty profile" }
    }

    const parsed = AdminFacultyProfileSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: firstFacultyError(parsed.error) }

    const { featured, ...profile } = parsed.data
    await User.updateOne(
      { _id: user._id },
      { $set: { ...facultyProfileSet(profile), "instructorProfile.featured": featured } }
    )

    revalidatePath("/admin/users")
    revalidatePath("/faculty", "layout")
    revalidatePath("/")
    return { success: true }
  } catch (error) {
    console.error("Admin update faculty profile error:", error)
    const denied = error instanceof Error && error.message === "Not authorized"
    return { success: false, error: denied ? "Not authorized" : "Failed to update faculty profile" }
  }
}
```

- [ ] **Step 2: Query key.** In `lib/hooks/queries/keys.ts` replace

```ts
  adminApplicationDetail: (id: string) => ["admin", "application", id] as const,
} as const
```

   with

```ts
  adminApplicationDetail: (id: string) => ["admin", "application", id] as const,
  adminFacultyProfile: (userId: string) => ["admin", "faculty-profile", userId] as const,
} as const
```

- [ ] **Step 3: The dialog.** Create `components/admin/faculty-profile-dialog.tsx`:

```tsx
"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { FacultyProfileFields } from "@/components/faculty/faculty-profile-fields"
import {
  adminGetFacultyProfile,
  adminUpdateFacultyProfile,
  type AdminFacultyProfile,
} from "@/lib/actions/admin-users"
import { countryOptions } from "@/lib/countries"
import { queryKeys } from "@/lib/hooks/queries/keys"

/**
 * Admin edit of one user's faculty profile (spec §10) plus the `featured`
 * curation flag. The users page mounts this only while it is open, so it
 * never server-renders — country names come from the browser and cannot
 * mismatch a server render.
 */
export function FacultyProfileDialog({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.adminFacultyProfile(userId),
    queryFn: () => adminGetFacultyProfile(userId),
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit faculty profile</DialogTitle>
          <DialogDescription>
            {data ? `${data.name} · @${data.username}` : "What /faculty shows for this instructor."}
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 rounded-md" />
            ))}
          </div>
        ) : data ? (
          <FacultyProfileEditor profile={data} onClose={onClose} />
        ) : (
          <p className="text-sm text-ws-danger">Only instructors and admins have a faculty profile.</p>
        )}
      </DialogContent>
    </Dialog>
  )
}

function FacultyProfileEditor({ profile, onClose }: { profile: AdminFacultyProfile; onClose: () => void }) {
  const queryClient = useQueryClient()
  const countries = useMemo(() => countryOptions(), [])
  const [value, setValue] = useState(profile.form)
  const [featured, setFeatured] = useState(profile.featured)
  const [error, setError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: () => adminUpdateFacultyProfile(profile.userId, { ...value, featured }),
    onSuccess: (res) => {
      if (!res.success) {
        setError(res.error)
        return
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.adminFacultyProfile(profile.userId) })
      onClose()
    },
    onError: () => setError("Failed to update faculty profile"),
  })

  return (
    <>
      <div className="flex items-start justify-between gap-4 rounded-md bg-ws-sunken p-3">
        <div className="space-y-0.5">
          <Label htmlFor="admin-faculty-featured">Featured</Label>
          <p className="text-[11px] text-ws-muted">Featured faculty are listed first on /faculty and the homepage.</p>
        </div>
        <Switch
          id="admin-faculty-featured"
          checked={featured}
          onCheckedChange={(checked) => setFeatured(checked)}
          disabled={save.isPending}
        />
      </div>
      <FacultyProfileFields
        value={value}
        onChange={setValue}
        countries={countries}
        idPrefix="admin-faculty"
        disabled={save.isPending}
      />
      {error && <p className="text-xs text-ws-danger">{error}</p>}
      <DialogFooter>
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={save.isPending}
          onClick={() => {
            setError(null)
            save.mutate()
          }}
        >
          {save.isPending ? "Saving…" : "Save profile"}
        </Button>
      </DialogFooter>
    </>
  )
}
```

- [ ] **Step 4: Users page.** In `app/(admin)/admin/users/page.tsx` make four replacements:
  1. Replace

```tsx
import { useUser } from "@/components/providers/user-provider"
import { UsersIcon } from "lucide-react"
```

   with

```tsx
import { useUser } from "@/components/providers/user-provider"
import { FacultyProfileDialog } from "@/components/admin/faculty-profile-dialog"
import { UserRoundPenIcon, UsersIcon } from "lucide-react"
```

  2. Replace `  const [actionError, setActionError] = React.useState<string | null>(null)` with:

```tsx
  const [actionError, setActionError] = React.useState<string | null>(null)
  const [facultyUserId, setFacultyUserId] = React.useState<string | null>(null)
```

  3. In the user Sheet replace

```tsx
                  {actionError && <p className="text-xs text-ws-danger">{actionError}</p>}
                </div>
              </div>
            </>
          )}
        </SheetContent>
```

   with

```tsx
                  {actionError && <p className="text-xs text-ws-danger">{actionError}</p>}
                </div>

                {/* Faculty profile (spec §10) — instructors and admins only */}
                {selected.role !== "USER" && (
                  <div className="space-y-2 pt-2 border-t border-ws-hairline">
                    <p className="text-xs font-semibold">Faculty profile</p>
                    <p className="text-[11px] text-ws-muted">
                      Specialization, biography, experience, credentials, country, links and the featured flag.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs"
                      onClick={() => setFacultyUserId(selected.id)}
                    >
                      <UserRoundPenIcon size={14} aria-hidden />
                      Edit faculty profile
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
```

  4. At the end of the component replace

```tsx
        </DialogContent>
      </Dialog>
    </>
  )
}
```

   with

```tsx
        </DialogContent>
      </Dialog>

      {/* Faculty profile editor — mounted only while open */}
      {facultyUserId && (
        <FacultyProfileDialog userId={facultyUserId} onClose={() => setFacultyUserId(null)} />
      )}
    </>
  )
}
```

- [ ] **Step 5: Approval seeds experience.** In `lib/actions/applications.ts`, `adminDecideApplication`, replace

```ts
      const newRole = user.role === "USER" ? "INSTRUCTOR" : user.role
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            role: newRole,
            instructorStatus: "approved",
            instructorProfile: {
              headline: app.answers.headline,
              expertise: app.answers.expertise ?? [],
```

   with

```ts
      const newRole = user.role === "USER" ? "INSTRUCTOR" : user.role
      // Spec §10 "Professional experience" starts as the application's answer
      // but never replaces one already on the profile. This $set rewrites the
      // whole instructorProfile, so the Phase 5 fields are carried across.
      const currentExperience = user.instructorProfile?.experience ?? null
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            role: newRole,
            instructorStatus: "approved",
            instructorProfile: {
              headline: app.answers.headline,
              specialization: user.instructorProfile?.specialization ?? null,
              experience: currentExperience?.trim() ? currentExperience : app.answers.experience?.trim() || null,
              credentials: [...(user.instructorProfile?.credentials ?? [])],
              featured: user.instructorProfile?.featured ?? false,
              expertise: app.answers.expertise ?? [],
```

   The rest of that `$set` (`socialLinks`, the three counters) is unchanged.

- [ ] **Step 6: Verify.**
  1. tsc (filtered) prints nothing; `npx eslint lib/actions/admin-users.ts lib/hooks/queries/keys.ts components/admin/faculty-profile-dialog.tsx "app/(admin)/admin/users/page.tsx" lib/actions/applications.ts` prints nothing.
  2. Read:
     - `bash "$H/action.sh" /admin/users adminGetFacultyProfile "[\"$SARAH\"]" admin` → `"username":"sarah_chen"`, `"name":"Sarah Chen"`, `"featured":false`, `form.headline` `"Crypto Trading Expert & Blockchain Educator"` (the seed), `form.specialization` `""`, `form.country` `null`.
     - With `"[\"$STU\"]"` → `null`; with `'["nope"]'` → `null`.
  3. Save with `featured`:
     - `bash "$H/action.sh" /admin/users adminUpdateFacultyProfile "$(node -e 'const p=JSON.parse(process.argv[1]); console.log(JSON.stringify([process.argv[2], { ...p, featured: true }]))' "$PROFILE" "$SARAH")" admin` → `{"success":true}`.
     - `node "$H/mockdb.cjs" user $SARAH` → `instructorProfile.featured: true`, `specialization: "Crypto markets and risk management"`, `country: "US"`, `totalStudents: 3741`.
  4. Refusals:
     - Student target: `bash "$H/action.sh" /admin/users adminUpdateFacultyProfile "$(node -e 'const p=JSON.parse(process.argv[1]); console.log(JSON.stringify([process.argv[2], { ...p, featured: false }]))' "$PROFILE" "$STU")" admin` → `Only instructors and admins have a faculty profile`.
     - The same with `nope` as the id → `User not found`.
     - `bash "$H/action.sh" /admin/users adminUpdateFacultyProfile "$(node -e 'const [b]=JSON.parse(process.argv[1]); console.log(JSON.stringify([process.argv[2], { ...b, featured: true }]))' "$(node "$H/t5-bad.cjs" "$PROFILE" credentials)" "$SARAH")" admin` → `Add at most 10 credentials`.
  5. Admins only: `ID=$(PRINT_ID=1 bash "$H/action.sh" /admin/users adminUpdateFacultyProfile '[]' admin)`, then `curl -s -X POST "$BASE/admin/users" -H "Next-Action: $ID" -H "Accept: text/x-component" -H "Content-Type: text/plain;charset=UTF-8" -b mock_persona=instructor --data "$(node -e 'const p=JSON.parse(process.argv[1]); console.log(JSON.stringify([process.argv[2], { ...p, featured: true }]))' "$PROFILE" "$SARAH")" | count 'Not authorized'` → 1.
  6. `node "$H/mockdb.cjs" restore`.
  7. Approval seeds experience:
     - `A=$(node "$H/mockdb.cjs" application-fixture $STU "Seven years teaching retail traders to size positions and manage drawdowns." | node -pe 'JSON.parse(require("fs").readFileSync(0, "utf8")).applicationId')`
     - `bash "$H/action.sh" "/admin/applications/$A" adminDecideApplication "[\"$A\",\"approved\"]" admin` → `{"success":true}`.
     - `node "$H/mockdb.cjs" user $STU` → `role: "INSTRUCTOR"`, `instructorStatus: "approved"`, `instructorProfile.headline: "Fixture applicant headline"`, `experience: "Seven years teaching retail traders to size positions and manage drawdowns."`, `specialization: null`, `credentials: []`, `featured: false`.
     - `node "$H/mockdb.cjs" restore`.
  8. Approval never overwrites experience:
     - `A=$(node "$H/mockdb.cjs" application-fixture $STU "Answer that must not replace the profile." "Experience the student already wrote." | node -pe 'JSON.parse(require("fs").readFileSync(0, "utf8")).applicationId')`
     - Approve as in check 7 → `{"success":true}`.
     - `mockdb user $STU` → `experience: "Experience the student already wrote."`.
     - `node "$H/mockdb.cjs" restore`.
  9. Browser, phone width, admin:

```bash
$B viewport 400x800 && $B goto "$BASE/" && $B cookie mock_persona=admin && $B goto "$BASE/admin/users" && $B wait --load
$B js "(async () => { const wait = (ms) => new Promise((r) => setTimeout(r, ms)); const until = async (fn) => { for (let i = 0; i < 50; i++) { const v = fn(); if (v) return v; await wait(200) } return null }; const row = await until(() => [...document.querySelectorAll('tr')].find((tr) => tr.textContent.includes('Sarah Chen'))); if (!row) return 'no row'; row.click(); const edit = await until(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Edit faculty profile')); if (!edit) return 'no edit button'; edit.click(); const dialog = await until(() => [...document.querySelectorAll('[data-slot=dialog-content]')].find((d) => d.textContent.includes('Area of specialization'))); if (!dialog) return 'no dialog'; return JSON.stringify({ sw: document.documentElement.scrollWidth, dialogRight: Math.round(dialog.getBoundingClientRect().right) }) })()"
$B screenshot --viewport "$H/t5-t3-dialog-400.png"
$B js "(async () => { const wait = (ms) => new Promise((r) => setTimeout(r, ms)); const open = () => [...document.querySelectorAll('[data-slot=dialog-content]')].find((d) => d.textContent.includes('Area of specialization')); open().querySelector('[role=switch]').click(); await wait(200); [...open().querySelectorAll('button')].find((b) => b.textContent.trim() === 'Save profile').click(); for (let i = 0; i < 50; i++) { if (!open()) return 'closed'; await wait(200) } return 'still open' })()"
$B console --errors
$B cookie mock_persona=student
```

   Expect:
   - the first `js` prints `{"sw":400,"dialogRight":…}` with `dialogRight` ≤ 400;
   - the second prints `closed`;
   - `mockdb user $SARAH` → `instructorProfile.featured: true`;
   - no console errors.
  10. End: `node "$H/mockdb.cjs" restore`.

- [ ] **Step 7: Commit.**

```bash
git add lib/actions/admin-users.ts lib/hooks/queries/keys.ts components/admin/faculty-profile-dialog.tsx "app/(admin)/admin/users/page.tsx" lib/actions/applications.ts
git commit -m "feat(faculty): admins edit and feature faculty profiles; approval seeds professional experience

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---
### Task 4: Public faculty directory and profiles (`/faculty`, `/faculty/[username]`)

**Files:**
- Modify: `lib/actions/student.ts` (imports; `fetchBrowseCourses` options and query; append a FACULTY section at the end of the file)
- Create: `components/faculty/faculty-card.tsx`
- Create: `app/(marketing)/faculty/page.tsx`
- Create: `app/(marketing)/faculty/[username]/page.tsx`

**Interfaces:**
- Consumes (Task 1): `FACULTY_ROLES`, `safeWebUrl`, `facultyHref`, `facultyInitials`, `isCountryCode`, `countryName`. Existing: `ProgramRow` (`components/marketing/program-row.tsx`, renders its own `<li>`), `appUrl`, `BRAND`.
- Produces (Task 5 relies on these):
  - `type FacultyMember = { id: string; username: string; name: string; avatarUrl: string | null; headline: string | null; specialization: string | null; expertise: string[]; country: string | null; featured: boolean; courseCount: number }`
  - `type FacultyProfile = FacultyMember & { bio: string | null; experience: string | null; credentials: string[]; socialLinks: { website: string | null; linkedin: string | null; twitter: string | null } }`
  - `fetchFaculty(): Promise<FacultyMember[]>`: ordered featured → `instructorProfile.totalStudents` → name.
  - `fetchFacultyProfile(username: string): Promise<FacultyProfile | null>`
  - Non-exported, in the same section: `FACULTY_FIELDS`, `FacultyUserDoc`, `publishedCourseCounts(): Promise<Map<string, number>>`, `toFacultyMember(user, courseCount)`. Task 5 appends two more functions that use `publishedCourseCounts`.
  - `fetchBrowseCourses({ instructorId })` option.
  - `FacultyCard({ member: FacultyMember })`: server-safe, heading `h3`.

- [ ] **Step 1: Imports.** In `lib/actions/student.ts`, directly under `import { getCourseAccess, lockedLessonIds, openPublishedLessonIds } from "@/lib/course-access"` (the Phase 3 final fix wave added `openPublishedLessonIds` to this import — verified at HEAD `07c18f8`) add:

```ts
import { isCountryCode } from "@/lib/countries"
import { FACULTY_ROLES, safeWebUrl } from "@/lib/faculty"
```

- [ ] **Step 2: Programs by instructor.** In `fetchBrowseCourses` replace

```ts
  search?: string
  school?: SchoolSlug
}): Promise<BrowseCourse[]> {
```

   with

```ts
  search?: string
  school?: SchoolSlug
  /** Only this instructor's programs — "Courses taught" on /faculty/[username]. */
  instructorId?: string
}): Promise<BrowseCourse[]> {
```

   and replace

```ts
    if (options?.school) {
      query.school = options.school
    }
```

   with

```ts
    if (options?.school) {
      query.school = options.school
    }
    if (options?.instructorId) {
      query.instructor = options.instructorId
    }
```

- [ ] **Step 3: Faculty queries.** Append at the end of `lib/actions/student.ts` (after `fetchEnrolledCoursesFromInstructor`):

```ts

// ============================================================================
// FACULTY (spec §10) — /faculty, /faculty/[username], homepage teaser, nav
// ============================================================================

export type FacultyMember = {
  id: string
  /** Unique on User — the public URL key (`facultyHref`). */
  username: string
  name: string
  avatarUrl: string | null
  headline: string | null
  /** Area of specialization (spec §10). */
  specialization: string | null
  expertise: string[]
  /** ISO 3166-1 alpha-2; print it with `countryName`. */
  country: string | null
  featured: boolean
  /** Published programs they teach — at least 1, or they aren't faculty. */
  courseCount: number
}

export type FacultyProfile = FacultyMember & {
  bio: string | null
  experience: string | null
  credentials: string[]
  /** Only safe http(s) addresses; anything else stored reads as null. */
  socialLinks: { website: string | null; linkedin: string | null; twitter: string | null }
}

const FACULTY_FIELDS = "username firstName lastName avatarUrl bio country instructorProfile"

type FacultyUserDoc = {
  _id: { toString(): string }
  username: string
  firstName: string
  lastName?: string | null
  avatarUrl?: string | null
  country?: string | null
  instructorProfile?: {
    headline?: string | null
    specialization?: string | null
    expertise?: string[] | null
    featured?: boolean | null
  } | null
}

/**
 * Published-program count per instructor id — the course half of "who is
 * faculty" (role INSTRUCTOR or ADMIN is the other half, applied by each caller).
 */
async function publishedCourseCounts(): Promise<Map<string, number>> {
  const rows = await Course.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
    { $match: { status: "published" } },
    { $group: { _id: "$instructor", count: { $sum: 1 } } },
  ])
  return new Map(rows.map((row) => [row._id.toString(), row.count]))
}

function toFacultyMember(user: FacultyUserDoc, courseCount: number): FacultyMember {
  const profile = user.instructorProfile
  return {
    id: user._id.toString(),
    username: user.username,
    name: `${user.firstName} ${user.lastName ?? ""}`.trim(),
    avatarUrl: user.avatarUrl ?? null,
    headline: profile?.headline?.trim() || null,
    specialization: profile?.specialization?.trim() || null,
    expertise: profile?.expertise ?? [],
    country: isCountryCode(user.country) ? user.country : null,
    featured: profile?.featured ?? false,
    courseCount,
  }
}

/** Every faculty member — featured first, then most students, then by name. */
export async function fetchFaculty(): Promise<FacultyMember[]> {
  try {
    await connectDB()
    const counts = await publishedCourseCounts()
    if (counts.size === 0) return []

    const users = await User.find({ _id: { $in: Array.from(counts.keys()) }, role: { $in: [...FACULTY_ROLES] } })
      .select(FACULTY_FIELDS)
      .lean()

    return users
      .sort(
        (a, b) =>
          Number(b.instructorProfile?.featured ?? false) - Number(a.instructorProfile?.featured ?? false) ||
          (b.instructorProfile?.totalStudents ?? 0) - (a.instructorProfile?.totalStudents ?? 0) ||
          `${a.firstName} ${a.lastName ?? ""}`.localeCompare(`${b.firstName} ${b.lastName ?? ""}`)
      )
      .map((user) => toFacultyMember(user, counts.get(user._id.toString()) ?? 0))
  } catch (error) {
    console.error("Fetch faculty error:", error)
    return []
  }
}

/**
 * One public faculty profile by username. null — so the page 404s — for
 * unknown usernames, students, and instructors with no published program.
 */
export async function fetchFacultyProfile(username: string): Promise<FacultyProfile | null> {
  try {
    if (typeof username !== "string" || username.length === 0 || username.length > 100) return null
    await connectDB()

    const user = await User.findOne({ username, role: { $in: [...FACULTY_ROLES] } })
      .select(FACULTY_FIELDS)
      .lean()
    if (!user) return null

    const courseCount = await Course.countDocuments({ instructor: user._id, status: "published" })
    if (courseCount === 0) return null

    const profile = user.instructorProfile
    return {
      ...toFacultyMember(user, courseCount),
      bio: user.bio?.trim() || null,
      experience: profile?.experience?.trim() || null,
      credentials: profile?.credentials ?? [],
      socialLinks: {
        website: safeWebUrl(profile?.socialLinks?.website),
        linkedin: safeWebUrl(profile?.socialLinks?.linkedin),
        twitter: safeWebUrl(profile?.socialLinks?.twitter),
      },
    }
  } catch (error) {
    console.error("Fetch faculty profile error:", error)
    return null
  }
}
```

   (`typeof username !== "string"` matters: an exported `"use server"` function is callable from a browser, and an object would turn the lookup into a query operator.)

- [ ] **Step 4: The card.** Create `components/faculty/faculty-card.tsx`:

```tsx
import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { FacultyMember } from "@/lib/actions/student"
import { countryName } from "@/lib/countries"
import { facultyHref, facultyInitials } from "@/lib/faculty"

/**
 * One faculty member (spec §10): photo, name, area of specialization (the
 * headline until one is set), country, up to four expertise chips and how many
 * programs they teach. The whole card is one link. Server-safe (no hooks):
 * /faculty and the homepage teaser both render it under a section h2.
 */
export function FacultyCard({ member }: { member: FacultyMember }) {
  const line = member.specialization ?? member.headline
  const country = countryName(member.country)

  return (
    <Link
      href={facultyHref(member.username)}
      className="group flex h-full flex-col rounded-lg border border-ws-hairline bg-ws-surface p-6 transition-colors duration-[var(--ws-motion-base)] hover:border-ws-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
    >
      <Avatar className="h-16 w-16">
        {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt="" />}
        <AvatarFallback className="bg-ws-brand/10 text-sm font-semibold text-ws-gold">
          {facultyInitials(member.name)}
        </AvatarFallback>
      </Avatar>
      <h3 className="mt-5 break-words font-display text-[17px] font-semibold leading-snug tracking-[-0.01em] text-ws-primary">
        {member.name}
      </h3>
      {line && <p className="mt-1 break-words text-[13px] leading-relaxed text-ws-muted">{line}</p>}
      {country && <p className="mt-1 text-[12px] text-ws-subtle">{country}</p>}
      {member.expertise.length > 0 && (
        <span className="mt-4 flex flex-wrap gap-1.5">
          {member.expertise.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="max-w-full truncate rounded-full bg-ws-chip px-2 py-0.5 text-[11px] font-medium text-ws-muted"
            >
              {tag}
            </span>
          ))}
        </span>
      )}
      <span className="mt-auto flex items-center justify-between gap-3 pt-6 text-[13px]">
        <span className="tabular-nums text-ws-subtle">
          {member.courseCount === 1 ? "1 program" : `${member.courseCount} programs`}
        </span>
        <span className="inline-flex items-center gap-1.5 font-semibold text-ws-muted transition-colors duration-[var(--ws-motion-fast)] group-hover:text-ws-primary">
          View profile
          <ArrowRightIcon size={14} aria-hidden />
        </span>
      </span>
    </Link>
  )
}
```

- [ ] **Step 5: Directory.** Create `app/(marketing)/faculty/page.tsx`:

```tsx
import type { Metadata } from "next"
import Link from "next/link"
import { fetchFaculty } from "@/lib/actions/student"
import { appUrl } from "@/lib/app-url"
import { BRAND } from "@/lib/brand"
import { FacultyCard } from "@/components/faculty/faculty-card"

/** Spec §10 intro, verbatim (brand casing per D1). */
const INTRO = `Behind every great learning experience is a great teacher. ${BRAND.name} brings together instructors and practitioners across technology, financial markets, digital business and creative industries.`

export const metadata: Metadata = {
  title: "Faculty",
  description: INTRO,
  alternates: { canonical: appUrl("/faculty") },
}

// Faculty follows roles, profile edits and publishing — never serve a stale list.
export const revalidate = 0

/**
 * `/faculty` — spec §10 as a page: the heading and intro, then every faculty
 * member (role INSTRUCTOR or ADMIN with at least one published program),
 * featured first.
 */
export default async function FacultyPage() {
  const faculty = await fetchFaculty()

  return (
    <div className="mx-auto max-w-7xl px-6 pb-24 pt-10 md:pb-32 md:pt-16">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ws-gold">Faculty</p>
      <h1
        className="mt-4 max-w-3xl font-display font-semibold leading-[1.05] tracking-[-0.02em] text-ws-primary"
        style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)" }}
      >
        Learn from experienced instructors
      </h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ws-muted md:text-[17px]">{INTRO}</p>

      <section className="mt-16 border-t border-ws-hairline pt-10" aria-labelledby="faculty-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="faculty-heading" className="font-display text-2xl font-semibold tracking-[-0.015em] text-ws-primary">
            Meet our faculty
          </h2>
          <span className="text-[13px] tabular-nums text-ws-subtle">
            {faculty.length === 1 ? "1 instructor" : `${faculty.length} instructors`}
          </span>
        </div>

        {faculty.length > 0 ? (
          <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {faculty.map((member) => (
              <li key={member.id}>
                <FacultyCard member={member} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-8 rounded-lg border border-dashed border-ws-hairline p-10 text-center">
            <p className="font-display text-lg font-semibold text-ws-primary">Faculty profiles are on the way</p>
            <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-ws-muted">
              Instructors appear here once their first program is published. Explore the programs in the meantime.
            </p>
            <Link
              href="/programs"
              className="mt-6 inline-flex h-11 items-center justify-center rounded-sm border border-ws-hairline px-6 text-[14px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:border-ws-brand/40 hover:text-ws-gold"
            >
              Explore programs
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 6: Profile.** Create `app/(marketing)/faculty/[username]/page.tsx`:

```tsx
import type { Metadata } from "next"
import { cache } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeftIcon, AwardIcon, ExternalLinkIcon, GlobeIcon, type LucideIcon } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ProgramRow } from "@/components/marketing/program-row"
import { fetchBrowseCourses, fetchFacultyProfile } from "@/lib/actions/student"
import { appUrl } from "@/lib/app-url"
import { BRAND } from "@/lib/brand"
import { countryName } from "@/lib/countries"
import { facultyHref, facultyInitials } from "@/lib/faculty"

// Profile edits, role changes and publishing all change this page.
export const revalidate = 0

type Params = { params: Promise<{ username: string }> }

// generateMetadata and the page both need the profile; dedupe the read.
const getProfile = cache((username: string) => fetchFacultyProfile(username))

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { username } = await params
  const profile = await getProfile(username)
  if (!profile) return {}
  return {
    title: profile.name,
    description:
      profile.specialization ?? profile.headline ?? profile.bio?.slice(0, 160) ?? `${profile.name} teaches at ${BRAND.name}.`,
    alternates: { canonical: appUrl(facultyHref(profile.username)) },
  }
}

/**
 * `/faculty/[username]` — one instructor's public profile with the seven
 * spec §10 fields: photo, name, area of specialization, short biography,
 * professional experience, courses taught and credentials/achievements — plus
 * headline, country, expertise and links. Unknown usernames, students and
 * instructors without a published program 404.
 */
export default async function FacultyProfilePage({ params }: Params) {
  const { username } = await params
  const profile = await getProfile(username)
  if (!profile) notFound()

  const courses = await fetchBrowseCourses({ instructorId: profile.id })
  const country = countryName(profile.country)
  const subline = [profile.headline, country].filter(Boolean).join(" · ")
  const links = (
    [
      { href: profile.socialLinks.website, label: "Website", icon: GlobeIcon },
      { href: profile.socialLinks.linkedin, label: "LinkedIn", icon: ExternalLinkIcon },
      { href: profile.socialLinks.twitter, label: "X (Twitter)", icon: ExternalLinkIcon },
    ] satisfies { href: string | null; label: string; icon: LucideIcon }[]
  ).filter((link): link is { href: string; label: string; icon: LucideIcon } => link.href !== null)

  return (
    <div className="mx-auto max-w-7xl px-6 pb-24 pt-10 md:pb-32 md:pt-16">
      <Link
        href="/faculty"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary"
      >
        <ArrowLeftIcon size={14} aria-hidden />
        All faculty
      </Link>

      <header className="mt-8 flex max-w-4xl flex-col gap-6 sm:flex-row sm:items-start">
        <Avatar className="h-24 w-24 shrink-0">
          {profile.avatarUrl && <AvatarImage src={profile.avatarUrl} alt={profile.name} />}
          <AvatarFallback className="bg-ws-brand/10 text-2xl font-semibold text-ws-gold">
            {facultyInitials(profile.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ws-gold">Faculty</p>
          <h1
            className="mt-3 break-words font-display font-semibold leading-[1.05] tracking-[-0.02em] text-ws-primary"
            style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)" }}
          >
            {profile.name}
          </h1>
          {profile.specialization && (
            <p className="mt-3 break-words font-display text-xl font-medium text-ws-primary md:text-2xl">
              {profile.specialization}
            </p>
          )}
          {subline && <p className="mt-2 break-words text-[15px] text-ws-muted">{subline}</p>}
          {profile.expertise.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Areas of expertise">
              {profile.expertise.map((tag) => (
                <li
                  key={tag}
                  className="max-w-full truncate rounded-full bg-ws-chip px-2.5 py-1 text-[12px] font-medium text-ws-muted"
                >
                  {tag}
                </li>
              ))}
            </ul>
          )}
          {links.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-2">
              {links.map(({ href, label, icon: Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-ws-hairline px-3.5 text-[13px] font-medium text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised"
                  >
                    <Icon size={14} aria-hidden />
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </header>

      {profile.bio && (
        <section className="mt-16 border-t border-ws-hairline pt-10" aria-labelledby="about-heading">
          <h2 id="about-heading" className="font-display text-2xl font-semibold tracking-[-0.015em] text-ws-primary">
            About
          </h2>
          <p className="mt-4 max-w-3xl whitespace-pre-line break-words text-[15px] leading-relaxed text-ws-muted md:text-[17px]">
            {profile.bio}
          </p>
        </section>
      )}

      {profile.experience && (
        <section className="mt-16 border-t border-ws-hairline pt-10" aria-labelledby="experience-heading">
          <h2 id="experience-heading" className="font-display text-2xl font-semibold tracking-[-0.015em] text-ws-primary">
            Professional experience
          </h2>
          <p className="mt-4 max-w-3xl whitespace-pre-line break-words text-[15px] leading-relaxed text-ws-muted md:text-[17px]">
            {profile.experience}
          </p>
        </section>
      )}

      {profile.credentials.length > 0 && (
        <section className="mt-16 border-t border-ws-hairline pt-10" aria-labelledby="credentials-heading">
          <h2 id="credentials-heading" className="font-display text-2xl font-semibold tracking-[-0.015em] text-ws-primary">
            Credentials &amp; achievements
          </h2>
          <ul className="mt-6 grid max-w-3xl gap-3">
            {profile.credentials.map((item) => (
              <li key={item} className="flex items-start gap-3 text-[15px] leading-relaxed text-ws-primary">
                <AwardIcon size={16} className="mt-1 shrink-0 text-ws-muted" aria-hidden />
                <span className="min-w-0 break-words">{item}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {courses.length > 0 && (
        <section className="mt-16 border-t border-ws-hairline pt-10" aria-labelledby="courses-heading">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="courses-heading" className="font-display text-2xl font-semibold tracking-[-0.015em] text-ws-primary">
              Courses taught
            </h2>
            <span className="text-[13px] tabular-nums text-ws-subtle">
              {courses.length === 1 ? "1 program" : `${courses.length} programs`}
            </span>
          </div>
          <ul className="mt-8 grid gap-4">
            {courses.map((course) => (
              <ProgramRow key={course.id} course={course} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 7: Verify.**
  1. tsc (filtered) prints nothing; `npx eslint lib/actions/student.ts components/faculty/faculty-card.tsx "app/(marketing)/faculty/page.tsx" "app/(marketing)/faculty/[username]/page.tsx"` prints nothing.
  2. Data: `bash "$H/action.sh" /instructor/profile updateFacultyProfile "[$PROFILE]" instructor` → `{"success":true}`.
  3. Directory, guest: `curl -s -o /dev/null -w "%{http_code}\n" -b mock_persona=guest $BASE/faculty` → `200`. Then `F=$(curl -s -b mock_persona=guest $BASE/faculty | strip)`:
     - Counts of 1: `<title>Faculty | WorldStreet Mastery Academy</title>`, `Learn from experienced instructors`, `Meet our faculty`, `1 instructor`, `href="/faculty/sarah_chen"`, `Crypto markets and risk management`, `United States`, `15 programs`.
     - `Behind every great learning experience is a great teacher.` → at least 1.
     - `Ada Admin` → 0: an ADMIN with no published course is not faculty.
  4. Profile, guest: `curl -s -o /dev/null -w "%{http_code}\n" -b mock_persona=guest $BASE/faculty/sarah_chen` → `200`. `P=$(curl -s -b mock_persona=guest $BASE/faculty/sarah_chen)`:
     - `printf '%s' "$P" | count 'photo-1494790108377'` → at least 1. The photo URL reaches the page; Base UI renders the `<img>` only after load, so check 7 confirms it in the browser.
     - `PS=$(printf '%s' "$P" | strip)`. Counts of at least 1 each:
       - `<title>Sarah Chen | WorldStreet Mastery Academy</title>`
       - `Crypto markets and risk management`
       - `Former Wall Street analyst turned crypto educator.`
       - `Twelve years across equities research and digital-asset trading desks.`
       - `Fixture credential one`
       - `Courses taught`
       - `15 programs`
       - `href="/programs/forex-trading-mastery"`
       - `href="https://linkedin.com/in/sarahchen"`
       - `rel="canonical"`
       - `/faculty/sarah_chen"`
     - `X (Twitter)` → 0: an empty link renders nothing.
  5. Not faculty → real 404: `for u in adminwteo demo_student nope; do curl -s -o /dev/null -w "$u %{http_code}\n" -b mock_persona=guest $BASE/faculty/$u; done` → `adminwteo 404`, `demo_student 404`, `nope 404`.
  6. Ordering and `featured`:
     - `node "$H/mockdb.cjs" faculty-fixture` (Ada now teaches one published program).
     - `curl -s -b mock_persona=guest $BASE/faculty | strip | grep -o 'Sarah Chen\|Ada Admin' | tr '\n' ' '` → `Sarah Chen Ada Admin` (3,741 students before 0); the page shows `2 instructors`; `/faculty/adminwteo` → 200 and lists `Faculty Fixture Program`.
     - Feature Ada: `bash "$H/action.sh" /admin/users adminUpdateFacultyProfile "[\"$ADA\",{\"headline\":\"\",\"specialization\":\"\",\"bio\":\"\",\"experience\":\"\",\"expertise\":[],\"credentials\":[],\"country\":null,\"socialLinks\":{\"twitter\":\"\",\"linkedin\":\"\",\"website\":\"\"},\"featured\":true}]" admin` → `{"success":true}`.
     - The same grep → `Ada Admin Sarah Chen`.
  7. Browser, phone width:

```bash
$B viewport 400x800 && $B goto "$BASE/faculty" && $B wait --load
$B js "document.documentElement.scrollWidth + '/' + window.innerWidth"
$B screenshot --viewport "$H/t5-t4-faculty-400.png"
$B goto "$BASE/faculty/sarah_chen" && $B wait --load
$B js "(async () => { for (let i = 0; i < 25; i++) { if (document.querySelector('img[src*=photo-1494790108377]')) break; await new Promise((r) => setTimeout(r, 200)) } return document.documentElement.scrollWidth + '/' + window.innerWidth + ' photo=' + Boolean(document.querySelector('img[src*=photo-1494790108377]')) })()"
$B screenshot --viewport "$H/t5-t4-profile-400.png"
$B console --errors
```

   Expect `400/400` on both pages, `photo=true`, and no console errors.
  8. End: `node "$H/mockdb.cjs" restore`. Then `curl -s -o /dev/null -w "%{http_code}\n" -b mock_persona=guest $BASE/faculty/adminwteo` → `404` again.

- [ ] **Step 8: Commit.**

```bash
git add lib/actions/student.ts components/faculty/faculty-card.tsx "app/(marketing)/faculty/page.tsx" "app/(marketing)/faculty/[username]/page.tsx"
git commit -m "feat(faculty): public /faculty directory and /faculty/[username] profiles

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---
### Task 5: Faculty across the site — homepage teaser, nav/footer links, program and dashboard profile links

**Files:**
- Modify: `lib/actions/student.ts` (faculty import; `ProgramDetail`; `findProgram`; append `fetchFacultyCount` and `fetchFacultyUsername` after `fetchFacultyProfile`)
- Create: `components/faculty/faculty-teaser.tsx`
- Modify: `components/marketing/landing.tsx` (imports, doc comment, the fetch, one section)
- Modify: `app/(marketing)/layout.tsx` (whole file)
- Modify: `components/marketing/navbar.tsx` (import, public links, props, both link lists)
- Modify: `components/marketing/footer.tsx` (props, one list item)
- Modify: `components/programs/program-instructor.tsx` (imports, doc, props, the profile link)
- Modify: `app/(marketing)/programs/[slug]/page.tsx` (one prop)
- Modify: `app/(platform)/dashboard/instructor/[instructorId]/page.tsx` (imports, the fetch, the button row)

**Interfaces:**
- Consumes:
  - Task 1: `isFacultyRole`, `facultyHref`, `FACULTY_ROLES`.
  - Task 4: `FacultyMember`, `fetchFaculty`, `FacultyCard`, `publishedCourseCounts` (non-exported, same file).
- Produces:
  - `fetchFacultyCount(): Promise<number>`
  - `fetchFacultyUsername(userId: string): Promise<string | null>`
  - `ProgramDetail.instructorUsername: string | null`
  - `Navbar({ showFaculty: boolean })`, `Footer({ showFaculty: boolean })`
  - `ProgramInstructor` gains `username: string | null`
  - `FacultyTeaser({ faculty: FacultyMember[] })`: renders null for `[]`; section id `faculty`, heading id `faculty-teaser-heading`.

- [ ] **Step 1: Queries.** In `lib/actions/student.ts`:
  1. Replace `import { FACULTY_ROLES, safeWebUrl } from "@/lib/faculty"` with `import { FACULTY_ROLES, isFacultyRole, safeWebUrl } from "@/lib/faculty"`.
  2. In `ProgramDetail` replace

```ts
  instructorTotalStudents: number
  /**
```

   with

```ts
  instructorTotalStudents: number
  /** The instructor's faculty URL key; null when they aren't INSTRUCTOR/ADMIN, so no /faculty link is offered. */
  instructorUsername: string | null
  /**
```

  3. In `findProgram` replace

```ts
    .populate("instructor", "firstName lastName avatarUrl bio instructorProfile")
    .lean()

  if (!course) return null

  const instructor = course.instructor as unknown as {
    _id: { toString(): string }
    firstName: string
```

   with

```ts
    .populate("instructor", "username role firstName lastName avatarUrl bio instructorProfile")
    .lean()

  if (!course) return null

  const instructor = course.instructor as unknown as {
    _id: { toString(): string }
    username: string
    role: string
    firstName: string
```

   and replace

```ts
    instructorTotalStudents: instructor.instructorProfile?.totalStudents || 0,
    packages,
```

   with

```ts
    instructorTotalStudents: instructor.instructorProfile?.totalStudents || 0,
    // The course is published, so an INSTRUCTOR/ADMIN teaching it is faculty.
    instructorUsername: isFacultyRole(instructor.role) ? instructor.username : null,
    packages,
```

  4. Replace the end of `fetchFacultyProfile`

```ts
  } catch (error) {
    console.error("Fetch faculty profile error:", error)
    return null
  }
}
```

   with

```ts
  } catch (error) {
    console.error("Fetch faculty profile error:", error)
    return null
  }
}

/** How many faculty members exist — the marketing layout shows "Faculty" links only when this is > 0. */
export async function fetchFacultyCount(): Promise<number> {
  try {
    await connectDB()
    const counts = await publishedCourseCounts()
    if (counts.size === 0) return 0
    return await User.countDocuments({ _id: { $in: Array.from(counts.keys()) }, role: { $in: [...FACULTY_ROLES] } })
  } catch (error) {
    console.error("Fetch faculty count error:", error)
    return 0
  }
}

/** A user's faculty URL key, or null when they aren't faculty — so a /faculty link is only offered when it resolves. */
export async function fetchFacultyUsername(userId: string): Promise<string | null> {
  try {
    if (!mongoose.isValidObjectId(userId)) return null
    await connectDB()
    const user = await User.findOne({ _id: userId, role: { $in: [...FACULTY_ROLES] } })
      .select("username")
      .lean()
    if (!user) return null
    const teaches = await Course.exists({ instructor: user._id, status: "published" })
    return teaches ? user.username : null
  } catch (error) {
    console.error("Fetch faculty username error:", error)
    return null
  }
}
```

- [ ] **Step 2: Teaser.** Create `components/faculty/faculty-teaser.tsx`:

```tsx
import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import type { FacultyMember } from "@/lib/actions/student"
import { BRAND } from "@/lib/brand"
import { FacultyCard } from "@/components/faculty/faculty-card"
import { Reveal, RevealGroup } from "@/components/marketing/motion/reveal"

/**
 * LEARN FROM EXPERIENCED INSTRUCTORS (spec §10) on the homepage: the heading
 * and intro verbatim, up to four faculty cards and [VIEW FACULTY]. Renders
 * nothing when there is no faculty — the landing never shows an empty section.
 */
export function FacultyTeaser({ faculty }: { faculty: FacultyMember[] }) {
  if (faculty.length === 0) return null

  return (
    <section id="faculty" className="relative scroll-mt-24 py-24 md:py-32" aria-labelledby="faculty-teaser-heading">
      <div className="mx-auto max-w-7xl px-6">
        <RevealGroup>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ws-gold">Faculty</p>
          <h2
            id="faculty-teaser-heading"
            className="mt-4 max-w-3xl font-display font-semibold leading-[1.05] tracking-[-0.02em] text-ws-primary"
            style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)" }}
          >
            Learn from experienced instructors
          </h2>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ws-muted md:text-[17px]">
            Behind every great learning experience is a great teacher. {BRAND.name} brings together
            instructors and practitioners across technology, financial markets, digital business and
            creative industries.
          </p>
        </RevealGroup>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-3">
          <p className="font-display text-xl font-semibold tracking-[-0.01em] text-ws-primary">Meet our faculty</p>
          <Link
            href="/faculty"
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-sm border border-ws-hairline px-6 text-[14px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:border-ws-brand/40"
          >
            View faculty
            <ArrowRightIcon size={14} aria-hidden />
          </Link>
        </div>

        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {faculty.slice(0, 4).map((member, i) => (
            <Reveal as="li" key={member.id} delay={i * 0.06} y={20} duration={0.6}>
              <FacultyCard member={member} />
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Landing.** In `components/marketing/landing.tsx`:
  1. Replace `import { fetchBrowseCourses, type BrowseCourse } from "@/lib/actions/student"` with `import { fetchBrowseCourses, fetchFaculty, type BrowseCourse } from "@/lib/actions/student"`.
  2. Replace `import { CatalogueGrid } from "@/components/marketing/catalogue-rail"` with:

```tsx
import { CatalogueGrid } from "@/components/marketing/catalogue-rail"
import { FacultyTeaser } from "@/components/faculty/faculty-teaser"
```

  3. Replace

```tsx
 * the How-it-works timeline, the catalogue card grid (the ONLY section
 * allowed to show course thumbnails), Upcoming drops (hidden when nothing is
 * scheduled), testimonials (real reviews), the FAQ, and the finale CTA.
```

   with

```tsx
 * the How-it-works timeline, the catalogue card grid (the ONLY section
 * allowed to show course thumbnails), the Faculty teaser (hidden when there is
 * no faculty), Upcoming drops (hidden when nothing is scheduled), testimonials
 * (real reviews), the FAQ, and the finale CTA.
```

  4. Replace

```tsx
  const [user, courses, reviews] = await Promise.all([
    getCurrentUser().catch(() => null),
    fetchBrowseCourses(),
    fetchLandingReviews(9),
  ])
```

   with

```tsx
  const [user, courses, reviews, faculty] = await Promise.all([
    getCurrentUser().catch(() => null),
    fetchBrowseCourses(),
    fetchLandingReviews(9),
    fetchFaculty(),
  ])
```

  5. Replace

```tsx
      <CatalogueGrid courses={gridCourses} signedIn={signedIn} />

      {/* Upcoming drops (renders only when something is scheduled) */}
```

   with

```tsx
      <CatalogueGrid courses={gridCourses} signedIn={signedIn} />

      {/* Faculty — up to four instructors and View faculty; hides at zero (spec §10) */}
      <FacultyTeaser faculty={faculty} />

      {/* Upcoming drops (renders only when something is scheduled) */}
```

- [ ] **Step 4: Layout.** Replace the whole of `app/(marketing)/layout.tsx` with:

```tsx
import { Navbar } from "@/components/marketing/navbar"
import { Footer } from "@/components/marketing/footer"
import { fetchFacultyCount } from "@/lib/actions/student"

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // One count per request drives both "Faculty" links (spec §10): they show
  // only when there is faculty to show. Navbar and footer are server
  // components, so a prop carries it — no client fetch.
  const showFaculty = (await fetchFacultyCount()) > 0

  return (
    <div className="flex min-h-svh flex-col">
      <Navbar showFaculty={showFaculty} />
      {/* The navbar is fixed, so every marketing page clears it; the landing
          hero cancels this with -mt to run beneath the transparent bar. */}
      <main className="flex-1 pt-[4.25rem] sm:pt-[5.25rem]">{children}</main>
      <Footer showFaculty={showFaculty} />
    </div>
  )
}
```

- [ ] **Step 5: Navbar.** In `components/marketing/navbar.tsx`:
  1. Replace `import { BrandLockup } from "@/components/shared/brand-lockup"` with:

```tsx
import { BrandLockup } from "@/components/shared/brand-lockup"
import { cn } from "@/lib/utils"
```

  2. Replace

```tsx
/** Public destinations, in journey order (spec §17). Shared by the md+ link row and the mobile sheet. */
const PUBLIC_LINKS: MarketingNavLink[] = [
  { href: "/schools", label: "Schools" },
  { href: "/programs", label: "Programs" },
  { href: "/#how-it-works", label: "How it works" },
]

export async function Navbar() {
```

   with

```tsx
/**
 * Public destinations, in journey order (spec §17). Shared by the md+ link row
 * and the mobile sheet. "Faculty" (spec §10) is listed only when faculty
 * exists, so it never links to an empty page.
 */
function publicLinks(showFaculty: boolean): MarketingNavLink[] {
  return [
    { href: "/schools", label: "Schools" },
    { href: "/programs", label: "Programs" },
    ...(showFaculty ? [{ href: "/faculty", label: "Faculty" }] : []),
    { href: "/#how-it-works", label: "How it works" },
  ]
}

export async function Navbar({ showFaculty }: { showFaculty: boolean }) {
```

  3. Replace

```tsx
  const mobileLinks: MarketingNavLink[] = [
    ...PUBLIC_LINKS,
```

   with

```tsx
  const links = publicLinks(showFaculty)
  const mobileLinks: MarketingNavLink[] = [
    ...links,
```

  4. Replace

```tsx
            {PUBLIC_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full px-3 py-1.5 text-sm font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-chip hover:text-ws-primary"
              >
```

   with

```tsx
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-chip hover:text-ws-primary",
                  // Measured: a fourth link overlaps the bar's CTA below lg, and
                  // below xl once "Instructor Dashboard" is in the row too.
                  link.href === "/faculty" && (isInstructor ? "hidden xl:inline-flex" : "hidden lg:inline-flex")
                )}
              >
```

- [ ] **Step 6: Footer.** In `components/marketing/footer.tsx`:
  1. Replace `export function Footer() {` with `export function Footer({ showFaculty }: { showFaculty: boolean }) {`.
  2. Replace

```tsx
                <Link href="/programs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Programs
                </Link>
              </li>
```

   with

```tsx
                <Link href="/programs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Programs
                </Link>
              </li>
              {/* Only when faculty exists (spec §10) — never a link to an empty page */}
              {showFaculty && (
                <li>
                  <Link href="/faculty" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Faculty
                  </Link>
                </li>
              )}
```

   (The classes match the neighbouring footer links on purpose; restyling the footer isn't in scope.)

- [ ] **Step 7: Program page instructor block.**
  1. In `components/programs/program-instructor.tsx` replace

```tsx
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

/**
 * Public instructor block (spec §6 "instructor"). No Message button — that
 * needs a signed-in conversation. The profile link is the dashboard one and
 * therefore only offered to signed-in visitors (it would bounce a guest
 * through the login wall); `/faculty/[username]` arrives in Phase 5.
 */
export function ProgramInstructor({
  id,
  name,
  avatarUrl,
  headline,
  bio,
  totalStudents,
  signedIn,
}: {
  id: string
  name: string
```

   with

```tsx
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { facultyHref } from "@/lib/faculty"

/**
 * Public instructor block (spec §6 "instructor"). No Message button — that
 * needs a signed-in conversation. When the instructor is faculty the block
 * links their public `/faculty/[username]` page for every visitor; otherwise
 * only signed-in visitors get the dashboard profile (it would bounce a guest
 * through the login wall).
 */
export function ProgramInstructor({
  id,
  username,
  name,
  avatarUrl,
  headline,
  bio,
  totalStudents,
  signedIn,
}: {
  id: string
  /** Faculty URL key; null when the instructor isn't faculty, so there is no page to link. */
  username: string | null
  name: string
```

   and replace

```tsx
          {signedIn && (
            <Link
              href={`/dashboard/instructor/${id}`}
              className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-ws-gold hover:underline"
            >
              View full profile
              <ChevronRightIcon size={14} aria-hidden />
            </Link>
          )}
```

   with

```tsx
          {username ? (
            <Link
              href={facultyHref(username)}
              className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-ws-gold hover:underline"
            >
              View faculty profile
              <ChevronRightIcon size={14} aria-hidden />
            </Link>
          ) : (
            signedIn && (
              <Link
                href={`/dashboard/instructor/${id}`}
                className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-ws-gold hover:underline"
              >
                View full profile
                <ChevronRightIcon size={14} aria-hidden />
              </Link>
            )
          )}
```

  2. In `app/(marketing)/programs/[slug]/page.tsx` replace

```tsx
        <ProgramInstructor
          id={program.instructorId}
```

   with

```tsx
        <ProgramInstructor
          id={program.instructorId}
          username={program.instructorUsername}
```

- [ ] **Step 8: Dashboard instructor page.** In `app/(platform)/dashboard/instructor/[instructorId]/page.tsx`:
  1. Replace

```tsx
  fetchEnrolledCoursesFromInstructor,
} from "@/lib/actions/student"
import { BookOpenIcon, CalendarIcon, ChevronLeftIcon, ExternalLinkIcon, StarIcon, UsersIcon } from "lucide-react"
```

   with

```tsx
  fetchEnrolledCoursesFromInstructor,
  fetchFacultyUsername,
} from "@/lib/actions/student"
import { facultyHref } from "@/lib/faculty"
import { BookOpenIcon, CalendarIcon, ChevronLeftIcon, ExternalLinkIcon, GlobeIcon, StarIcon, UsersIcon } from "lucide-react"
```

  2. Replace

```tsx
  const [instructor, courses, enrolledCourses] = await Promise.all([
    fetchInstructorProfile(instructorId),
    fetchInstructorPublicCourses(instructorId),
    fetchEnrolledCoursesFromInstructor(instructorId).catch(() => []),
  ])
```

   with

```tsx
  const [instructor, courses, enrolledCourses, facultyUsername] = await Promise.all([
    fetchInstructorProfile(instructorId),
    fetchInstructorPublicCourses(instructorId),
    fetchEnrolledCoursesFromInstructor(instructorId).catch(() => []),
    fetchFacultyUsername(instructorId),
  ])
```

  3. Replace

```tsx
            {/* Message button */}
            <MessageInstructorButton instructorId={instructorId} />
```

   with

```tsx
            {/* Message button + the public faculty page, only when it resolves */}
            <div className="flex flex-wrap items-start justify-center gap-2">
              <MessageInstructorButton instructorId={instructorId} />
              {facultyUsername && (
                <Button variant="outline" size="sm" className="gap-1.5" render={<Link href={facultyHref(facultyUsername)} />}>
                  <GlobeIcon size={14} aria-hidden />
                  Public profile
                </Button>
              )}
            </div>
```

- [ ] **Step 9: Verify.**
  1. tsc (filtered) prints nothing; `npx eslint lib/actions/student.ts components/faculty/faculty-teaser.tsx components/marketing/landing.tsx "app/(marketing)/layout.tsx" components/marketing/navbar.tsx components/marketing/footer.tsx components/programs/program-instructor.tsx "app/(marketing)/programs/[slug]/page.tsx" "app/(platform)/dashboard/instructor/[instructorId]/page.tsx"` prints nothing.
  2. Data: `bash "$H/action.sh" /instructor/profile updateFacultyProfile "[$PROFILE]" instructor` → `{"success":true}`.
  3. Homepage, guest:
     - `node "$H/t5-order.cjs"` → a line ending `catalogue < faculty < faq` (drops/testimonials appear in between only if the mock has them), then `ORDER-OK`.
     - `L=$(curl -s -b mock_persona=guest $BASE/ | strip)`:
       - `href="/faculty"` → 3 (md nav row, footer, teaser CTA; the phone sheet isn't in the HTML until opened);
       - `id="faculty-teaser-heading"` → 1;
       - `Meet our faculty` → 1;
       - `href="/faculty/sarah_chen"` → 1;
       - `View faculty` → at least 1.
  4. Other marketing pages, guest:
     - `curl -s -b mock_persona=guest $BASE/schools | strip | count 'href="/faculty"'` → 2 (nav + footer).
     - `R=$(curl -s -b mock_persona=guest $BASE/programs/forex-trading-mastery | strip)`: `View faculty profile` → 1, `href="/faculty/sarah_chen"` → 1, `View full profile` → 0.
  5. Dashboard, student:
     - `curl -s -b mock_persona=student "$BASE/dashboard/instructor/$SARAH" | strip`: `Public profile` → 1, `href="/faculty/sarah_chen"` → 1.
     - The same for `$ADA` (not faculty): `Public profile` → 0.
  6. No faculty → nothing shows. `node "$H/mockdb.cjs" set-role $SARAH USER`, then:
     - guest `/`: `href="/faculty"` → 0 and `id="faculty-teaser-heading"` → 0; `node "$H/t5-order.cjs"` prints `faculty teaser: ABSENT`.
     - guest `/faculty` → 200 with `Faculty profiles are on the way` → 1.
     - `/faculty/sarah_chen` → 404.
     - guest `/programs/forex-trading-mastery`: `/faculty/` → 0 and `View full profile` → 0.
     - student `/programs/forex-trading-mastery`: `View full profile` → 1 (dashboard fallback) and `/faculty/` → 0.
     - Then `node "$H/mockdb.cjs" restore` → guest `/` shows `href="/faculty"` → 3 again.
  7. Browser — nav fit at each width (ruling 18):

```bash
NAV="(() => { const nav = document.querySelector('header nav'); const right = nav.parentElement.nextElementSibling; const fac = [...nav.querySelectorAll('a')].find((a) => a.getAttribute('href') === '/faculty'); return JSON.stringify({ faculty: fac ? getComputedStyle(fac).display : 'absent', fits: nav.getBoundingClientRect().right <= right.getBoundingClientRect().left, oneLine: [...nav.querySelectorAll('a')].every((a) => a.getBoundingClientRect().height <= 36) }) })()"
$B goto "$BASE/"
for spec in guest:768 guest:1024 student:1024 instructor:1100 instructor:1280; do
  p=${spec%%:*}; w=${spec##*:}
  $B viewport ${w}x900 >/dev/null; $B cookie mock_persona=$p >/dev/null
  $B goto "$BASE/schools" >/dev/null; $B wait --load >/dev/null
  echo "$p $w $($B js "$NAV")"
done
```

   Expect, per line (`fits` and `oneLine` true on every line):
   - `guest 768` → `faculty: "none"`
   - `guest 1024` → `faculty` not `none`
   - `student 1024` → `faculty` not `none`
   - `instructor 1100` → `faculty: "none"`
   - `instructor 1280` → `faculty` not `none`
  8. Browser — phone width, guest:

```bash
$B viewport 400x800 && $B cookie mock_persona=guest && $B goto "$BASE/" && $B wait --load
$B js "(async () => { [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Open menu').click(); for (let i = 0; i < 25; i++) { const a = [...document.querySelectorAll('[role=dialog] a')].find((x) => x.getAttribute('href') === '/faculty'); if (a) return 'sheet has Faculty'; await new Promise((r) => setTimeout(r, 200)) } return 'sheet missing Faculty' })()"
$B goto "$BASE/" && $B wait --load
$B js "(async () => { document.getElementById('faculty').scrollIntoView(); await new Promise((r) => setTimeout(r, 1200)); return document.documentElement.scrollWidth + '/' + window.innerWidth })()"
$B screenshot --viewport "$H/t5-t5-teaser-400.png"
$B console --errors
$B cookie mock_persona=student
```

   Expect `sheet has Faculty`, `400/400`, the teaser visible in the screenshot, and no console errors.
  9. End: `node "$H/mockdb.cjs" restore`.

- [ ] **Step 10: Commit.**

```bash
git add lib/actions/student.ts components/faculty/faculty-teaser.tsx components/marketing/landing.tsx "app/(marketing)/layout.tsx" components/marketing/navbar.tsx components/marketing/footer.tsx components/programs/program-instructor.tsx "app/(marketing)/programs/[slug]/page.tsx" "app/(platform)/dashboard/instructor/[instructorId]/page.tsx"
git commit -m "feat(faculty): homepage teaser, Faculty nav and footer links, program and dashboard profile links

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Phase report — exit criteria and where they are proven

| Exit criterion (`docs/mastery-academy-plan.md` Phase 5) | Proven by |
|---|---|
| `/faculty`, `/faculty/[username]` live with the seven §10 fields | Task 4 checks 3–5, 7. The seven fields: **photo** (`avatarUrl`, check 7 `photo=true`) · **name** · **area of specialization** (`instructorProfile.specialization`) · **short biography** (`User.bio`, ≤ 1,000) · **professional experience** (`instructorProfile.experience`) · **courses taught** (published programs via `fetchBrowseCourses({ instructorId })`, "Courses taught" + `ProgramRow`) · **credentials/achievements** (`instructorProfile.credentials`) |
| Instructors and admins can edit every field; `experience` seeded from applications | Instructors: Task 2 checks 2–7 (photo and name stay on the same page's account card). Admins: Task 3 checks 2–5, 9 (faculty fields + `featured`; name/photo owner-managed per ruling 14). Seeding: Task 3 checks 7–8 |
| Homepage teaser + nav/footer link appear only when faculty exists | Task 5 checks 3, 4, 6, 7, 8 |

Report also:
- the §0.4 Go note (ruling 22);
- the pre-existing signed-in navbar overlap at 768px (ruling 18), left untouched.
