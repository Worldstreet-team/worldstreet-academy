# Mastery Academy — Phase 6 Implementation Plan (Certification & trust: certificate rebrand, stable IDs, public verification, testimonials with country)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every certificate a student earns carries the WorldStreet Mastery Academy brand, the program (and school), the completion date, a stable certificate ID that is stored on the enrollment, and the authorized signature. Anyone can check that ID at a public `/verify/<id>` page. Homepage testimonials show the student's country, and admins choose which reviews the homepage features.

**Architecture:**
- **IDs.** `Enrollment.certificateId` (string or null) sits under a **partial** unique index. One helper module, `lib/certificate-id.ts`, holds the ID rules: generate, the legacy rule, normalize user input, and `saveWithCertificateId`. That helper is a drop-in for `enrollment.save()` on the three completion paths. It stamps an ID atomically, only when the package includes the certificate.
- **Legacy.** Certificates have always printed `WSA-<last 8 of the enrollment _id>`. A dry-run-first backfill script stores exactly that value on completed, certificate-entitled enrollments, so PDFs already downloaded stay verifiable.
- **Certificate.** `fetchCertificate` adds `certificateId`, `programName` and `schoolName` to `CertificateData`. The certificate view (preview and jsPDF export) prints the stored ID, the program wording and the verify URL as text. It has a dormant Academy signatory slot that renders once product supplies a name and a signature file.
- **Verification.** `verifyCertificate(id)` is a public, names-and-dates-only lookup that re-applies the certificate entitlement. `app/(marketing)/verify/[certificateId]/page.tsx` renders it (RSC, noindex).
- **Testimonials.** `LandingReview.country` is the reviewer's country name from Phase 5's `User.country`. Students set their country from a small card on `/dashboard/profile`. `Review.featured` plus an admin toggle make featured reviews sort first on the homepage, always inside the existing honesty floor.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict · Mongoose 9 (MongoDB 8) · Zod (`zod/v4`) · Tailwind v4 + DS v2 `ws-*` tokens · Base UI (`render` prop) · lucide-react · jsPDF (already a dependency) · Node `crypto`.

**Spec:**
- `docs/mastery-academy-blueprint.md` §13 Certification (student name · program · completion date · certificate ID · authorized signature · WorldStreet Mastery Academy branding) and §14 Testimonials (photo · name · country · program · testimonial; never fabricated). This copy is binding.
- `docs/mastery-academy-plan.md` § "Phase 6" (tasks 6.1–6.4, verification, exit criteria), risk register item 4, decision D9 (authorized signature), §0.3 hard constraints, §0.4 Go coordination.
- Branch context: `mastery/phase-6` is cut from `mastery/phase-5` ← `mastery/phase-4` ← `mastery/phase-3` (committed through the Task 6 access gates).
  - Phase 3 already gates `fetchCertificate`/`fetchMyCertificates` on `entitlementsFor(course, enrollment).certificate`.
  - **From Phase 5 (consumed, never re-added here):**
    - `User.country: string | null` (ISO-3166 alpha-2, top level on the user document);
    - `lib/countries.ts` exporting `COUNTRY_CODES: readonly string[]` and `countryName(code: string | null | undefined): string | null` (English names from `Intl.DisplayNames`).
  - Phase 4 touches the dashboard home, appends `getMyAssessments` to `lib/actions/exams.ts`, and edits meetings and `fetchMyEnrollments`. This plan edits none of those functions.

**Controller rulings (binding — do not re-litigate):**
1. **Three completion paths mint, through one helper.** An enrollment becomes `completed` in `completeLesson` (`lib/actions/enrollments.ts`), in the exam-pass branch of `gradeAttempt` (`lib/actions/exams.ts`), and in `markCourseComplete` (`lib/actions/student.ts`). All three replace their completion `await enrollment.save()` with `await saveWithCertificateId(enrollment)` from `lib/certificate-id.ts`.
   - An ID is stamped only when `entitlementsFor(course, enrollment).certificate` is true. A Basic completion gets none.
   - *Why:* the plan text named two paths, but the code has three. One helper means one rule.
2. **ID format and index.**
   - Format: `` `${BRAND.certificatePrefix}-${8 symbols}` ``. The 8 symbols are Crockford base32 (`0-9A-Z` without I, L, O, U) from `crypto.randomBytes(5)`: 40 bits, exactly 8 five-bit symbols, no modulo bias.
   - On a duplicate-key error, retry once with a fresh random ID.
   - `Enrollment.certificateId: string | null`, `default: null`.
   - Index: `{ certificateId: 1 }` with `{ unique: true, partialFilterExpression: { certificateId: { $type: "string" } } }`. **Not `sparse`** (and MongoDB refuses `sparse` together with a partial filter).
   - *Why partial:* Mongoose writes `certificateId: null` into every newly created enrollment, and a sparse index still indexes explicit nulls. The second enrollment ever created after deploy would fail with E11000, which breaks purchases. A partial index covers only string values.
3. **Backfill `scripts/backfill-certificate-ids.mjs`.**
   - Dry run by default; writes only with `--apply`.
   - Stores `WSA-<last 8 of _id, uppercased>` on completed (`completedAt` set), certificate-entitled enrollments that have no ID.
   - Skips and reports collisions; never overwrites.
   - **URI safety.** It mirrors `scripts/mastery-catalogue.mjs`, which calls `dotenv` `config({ path: ".env.local" })`. That file holds the *production* URI. So the script reads `process.env.MONGODB_URI` **before** dotenv runs (dotenv never overrides a variable that is already set) and **refuses `--apply` unless the URI came from the command line**.
   - Verification passes `MONGODB_URI=mongodb://127.0.0.1:27017/worldstreet-academy` explicitly on every invocation. It tests the refusal with `env -u MONGODB_URI`, and never lets the script read `.env.local`.
4. **`CertificateData` gains** `certificateId: string | null`, `programName` (course title) and `schoolName: string | null` (`SCHOOL_BY_SLUG[course.school].name`).
   - `certificate-view.tsx` prints the stored ID. A legacy certificate (no stored ID) falls back to the value it has always printed.
   - Brand: the preview (`BRAND.name` + CSS `uppercase`) and the PDF (`BRAND.name.toUpperCase()`) already print "WORLDSTREET MASTERY ACADEMY" since Phase 0. Keep both.
   - Wording: "for successfully completing the program" replaces "…the course" in both halves.
   - Every ID print site is replaced: preview bottom line, PDF text, page footer.
5. **Authorized signature (D9).**
   - `lib/brand.ts` gains `signatory: { name: string | null; title: string | null; imagePath: string | null }`, all null.
   - The Academy signatory block (preview and PDF) renders only when `name` and `imagePath` are both set. It then takes the certificate's centre column, where the seal sits.
   - Until then the instructor signature is the authorized signature. Never invent a person.
   - *Why centre:* the student (left) and instructor (right) columns stay where issued certificates had them, and branding stays in the header and watermark.
6. **No QR code.** No QR library exists, and new deps need approval. The verify URL is printed as text (preview, PDF, page footer), built with `appUrl` from `lib/app-url.ts`.
7. **Public verify page `app/(marketing)/verify/[certificateId]/page.tsx`.**
   - No auth; `/verify` is outside the middleware's protected matcher.
   - The lookup is `verifyCertificate(certificateId)` in `lib/actions/certificates.ts`. It matches the stored `Enrollment.certificateId` (normalized: trimmed, uppercased) on a `completed` enrollment and re-applies the certificate entitlement.
   - Legacy IDs verify only once stored (backfill). The public-safe shape carries names, program, school and dates only: no email, no user or enrollment ids.
   - Shows: student name, program, school, completion date, instructor, and a "Valid" chip in the success token. An unknown or malformed ID shows "No certificate with this ID".
   - `generateMetadata` sets `robots: { index: false }`. The page anatomy follows `app/(marketing)/schools/page.tsx`.
8. **Testimonials (§14).**
   - `Review.featured: boolean` (default false).
   - `LandingReview.country: string | null` is the reviewer's country *display name*, resolved server-side with `countryName(User.country)`.
   - `reviews-finale.tsx` shows Name · Country · Program, dropping country when null.
   - `fetchLandingReviews` sorts featured first, then rating, and keeps its honesty floor: approved, not hidden, 4–5★, has text, published course.
   - `/admin/reviews` gets a "Feature on homepage" toggle via `adminSetReviewFeatured` (`requireAdmin()`).
   - Students set their country on `/dashboard/profile`.
9. **UI.**
   - DS v2 semantic classes only; radii `rounded-xs/sm/md/lg/full`.
   - Gold only on the primary CTA, the active state and the established marketing eyebrow.
   - The "Valid" chip is `bg-ws-success/10 text-ws-success` (`--color-ws-success` → `--ws-status-success` in `app/globals.css`).
   - Marketing pages are RSC. No horizontal overflow at 400px.
10. **Six tasks:**
    - (1) IDs: model, helper, 3 paths;
    - (2) backfill script;
    - (3) certificate data and view;
    - (4) public verify page;
    - (5) country on testimonials and student profile;
    - (6) featured curation.

**Rulings added while planning (same force as above):**
11. **Which value the helper stamps.**
    - Random when this save is the transition into `completed` (`enrollment.isModified("status")` before save).
    - The legacy value when the enrollment was *already* completed but had no ID. That happens during the deploy → backfill window, after an admin package change on a Basic completion, or after a Go/mobile completion.
    - *Why:* in all those cases the certificate page has been printing the legacy fallback. Storing that same value keeps the printed ID verifiable; a random one would orphan it.
    - The write is `updateOne({ _id, status: "completed", certificateId: null }, { $set })`. The first writer wins, so concurrent completions can't hand out two IDs.
    - A second collision is logged, never thrown. A completion never fails over its certificate ID.
11b. **Admin "restore" never mints.** `adminSetEnrollmentStatus` can return an enrollment to `completed` only if it already has a `completedAt`, so it keeps whatever ID it had (restore never clears the field). A refund moves the enrollment out of `completed`, so its certificate stops verifying. That is revocation, by design.
11c. **Certificate ID survives an admin package-change demotion.** `adminSetEnrollmentPackage` can move a `completed` enrollment back to `active` (Phase 3 fix: completion is re-checked on every package change). The stored `certificateId` is kept — nothing clears it. While the enrollment is not `completed`, or its current package isn't certificate-entitled, `/verify/<id>` shows "No certificate with this ID" (`verifyCertificate`'s `status: "completed"` and `entitlementsFor(...).certificate` checks both fail closed). When the student completes again, `saveWithCertificateId`'s guard (`enrollment.certificateId` already set) keeps that same ID rather than minting a new one, so any already-issued PDF verifies again.
12. **The legacy rule has three literal homes:**
    - `legacyCertificateId` in `lib/certificate-id.ts`;
    - `printedCertificateId` in `certificate-view.tsx`, because a client bundle can't import a module that loads node `crypto` and Mongoose;
    - the backfill `.mjs`, which can't import TS (same precedent as `scripts/mastery-catalogue.mjs`).
    Each carries a comment naming the others.
13. **The verify URL is computed in the RSC certificate page** with `appUrl` and passed as a prop.
    - *Why:* `APP_URL` reads the server-only `SITE_URL`, and a client-side read could render a different host.
    - It prints only when the ID is stored (a legacy fallback isn't verifiable yet).
    - It prints without the scheme and never uppercased, because the `/verify` path is case-sensitive.
14. **Verification ignores the instructor signature.** It attests completion + entitlement. The signature is a per-instructor field an instructor can change later, and that must not revoke issued PDFs.
15. **Dates print in UTC** on the certificate preview, the PDF and the verify page, so paper and `/verify` show the same day.
16. **Featuring never bypasses the floor.** `adminSetReviewFeatured(…, true)` refuses a review that is unapproved, hidden, under 4★ or without text. Hiding a featured review leaves the flag; the floor already keeps it off the homepage.
17. **Student country is saved by its own card and two new actions** (`getMyCountry`, `updateMyCountry`, appended to `lib/actions/profile.ts`). They do not go through `updateProfile`, which Phase 5 extends for the faculty editor, or through `LocalUser`.
    - *Why:* no overlap with Phase 5's edits, and the profile form's edit/cancel state stays untouched.
18. **Unknown IDs render inline with HTTP 200** (the ruling's copy plus the looked-up ID echoed), not `notFound()`, whose page can't carry that message.

## Global Constraints

- **Schema: additive only** (§0.3.1).
  - The only model changes: `Enrollment.certificateId` (+ its partial unique index) in Task 1, and `Review.featured` in Task 6. Both default so existing rows are unaffected.
  - No renamed fields, no new `role` values, no changed status semantics.
  - Mongoose caches models in the running dev server. **Controller restarts dev server** after Task 1 Step 1 and Task 6 Step 1; nobody else edits `lib/db/models/*`.
  - The index is built by Mongoose `autoIndex` (default on; `lib/db/index.ts` doesn't disable it) the first time the Enrollment model is used after restart.
- **Consume Phase 5, don't redefine it:** `User.country`, `IUser.country`, `lib/countries.ts` (`COUNTRY_CODES`, `countryName`, `countryOptions`). `CountryCard` calls `countryOptions()` for its select list rather than recomputing it. If `lib/actions/profile.ts` already imports `z` or `COUNTRY_CODES` when you get there, reuse the import — never add a second.
- **Don't touch Phase 4's surface:** the dashboard home, `getMyAssessments`, meetings, `fetchMyEnrollments`. Edits here are anchored by quoted text, never by line number. Line numbers quoted are from `mastery/phase-3` and may have shifted.
- **`"use server"` files export only async functions (plus types).** `lib/actions/*.ts` are all `"use server"`. `lib/certificate-id.ts` is a plain server module (Node `crypto` + Mongoose); never import it from a `"use client"` file.
- **Copy (verbatim):**
  - "for successfully completing the program" (preview) / "FOR SUCCESSFULLY COMPLETING THE PROGRAM" (PDF)
  - "Certificate ID"
  - "Verify at"
  - "No certificate with this ID"
  - "Valid"
  - "Feature on homepage" / "Remove from homepage"
  - Testimonial caption order: Name · Country · Program.
  - Brand and prefix only via `BRAND` from `@/lib/brand`.
  - Never invent a signatory, a testimonial, a number or a claim (§0.3.5). Mock-DB review fixtures exist only for verification, and `restore` deletes them.
- **Icons:** `lucide-react` only (`BadgeCheckIcon`, `CircleAlertIcon`, `CheckIcon` already ship in this repo); never emoji.
- **UI tokens:**
  - Semantic classes only (`bg-ws-surface`, `bg-ws-sunken`, `border-ws-hairline`, `text-ws-primary`, `text-ws-muted`, `text-ws-subtle`, `text-ws-gold`, `bg-ws-success/10`, `text-ws-success`, `bg-ws-danger/10`, `text-ws-danger`, `font-display`); never a hex in app UI.
  - The jsPDF RGB literals are the existing print palette, unchanged.
  - New markup uses `rounded-xs/sm/md/lg/full` only. Cards are separated by fill, not borders.
  - IDs and dates in `tabular-nums`. Separators use `·`.
- **Base UI composition uses the `render` prop, never `asChild`.** A Base UI `Select` needs `items` to show labels. RSC-first: `"use client"` only where hooks need it.
- **Links:**
  - Certificate: `/dashboard/courses/${courseId}/certificate`.
  - Verify: `/verify/${certificateId}`.
  - Program: `/programs/${slug}`.
  - Schools index: `/schools`.
  - Never ship a dead link.
- **No new dependencies. No `any`.**
- **Commits:**
  - One or more per task; every message ends with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
  - Add files by name; never `git add -A`; never commit `.env*`.
  - **Never run `git stash`.** The untracked `AGENTS.md` in the repo root is not yours.
- **Surgical:** touch only the listed files, plus files a compile error forces you into (say so in the report).

## Verification kit (controller-owned — use it, never start or restart servers yourself)

No test runner exists. Every task ends with:
- `npx tsc --noEmit 2>&1 | grep -v '^\.next/'` printing nothing;
- `npx eslint <every file you touched>` printing **no errors and no new warnings**. The baseline warnings, which you must not add to:
  - `components/learn/certificate-view.tsx`: 3× `@next/next/no-img-element` (the student/instructor signature `<img>`s and the signature thumbnail);
  - `app/(platform)/dashboard/profile/page.tsx`: 1×, same rule;
- the task's runtime checks.

Set once per shell (Git Bash, repo root):

```bash
H="C:/Users/owen/AppData/Local/Temp/claude/C--Users-owen-downloads-projects-worldstreet-worldstreet-academy/d4ab89bb-8435-4b94-b993-6b42283d1e4b/scratchpad/phase-3"
P6="C:/Users/owen/AppData/Local/Temp/claude/C--Users-owen-downloads-projects-worldstreet-worldstreet-academy/d4ab89bb-8435-4b94-b993-6b42283d1e4b/scratchpad/phase-5-6"
export NODE_PATH="$(pwd)/node_modules"
LOCAL_URI="mongodb://127.0.0.1:27017/worldstreet-academy"
F=6aa7bc2845744c5eeb0eb781      # forex-trading-mastery (basic / standard / executive)
C=6aa7bc2845744c5eeb0eb782      # crypto-trading-mastery (basic / standard / executive)
BTC=6a6fc0bb6433bbbd6322be03    # bitcoin-cryptocurrency-fundamentals (free, no packages)
STUDENT=6a6fc0bb6433bbbd6322be61; INSTRUCTOR=6a6fc0ba6433bbbd6322bdfd; ADMIN=6a6fc1258372b65d1ee8e972
strip() { perl -pe 's/<script\b.*?<\/script>//gs'; }
# Raw action POST (action ids are per build, not per page): post <actionId> <pagePath> <persona> '<json args>'
post() { curl -s -X POST "http://localhost:3001$2" -H "Next-Action: $1" -H "Accept: text/x-component" -H "Content-Type: text/plain;charset=UTF-8" -b "mock_persona=$3" --data "$4" | tail -1; echo; }
```

- **Preflight, every task:** `echo "${MONGODB_URI:-unset}"` must print `unset`. If it prints anything else, stop and report **BLOCKED**: a URI in your shell could point a script at production.
- **Dev server:** `pnpm dev:mock` on **http://localhost:3001**, already running.
  - Mock Clerk (production auth branch). Local Mongo at `$LOCAL_URI`.
  - Turbopack hot-reloads code, not model schemas.
  - Never start a second server; never edit `next.config.ts`.
  - It never reads `.env.local`'s `MONGODB_URI` (dev:mock overrides it), and neither do you.
- **Personas:** cookie `mock_persona=guest|student|instructor|admin`; no cookie means student. A guest on `/dashboard/*` is redirected to the hub login.
- **Server actions:**
  - `bash "$H/action.sh" "<page whose client chunks import it>" <actionName> '<json args>' [persona]` prints the return value.
  - `PRINT_ID=1 bash "$H/action.sh" …` prints only the id, for `post`.
  - Pages per action:
    - `markCourseComplete`: a learn page that renders the Finish button (the last lesson).
    - `startExamAttempt` / `submitExamAttempt`: `/dashboard/courses/<id>/exam`.
    - `purchaseCourse`: `/dashboard/checkout?courseId=<id>`.
    - `getMyCountry` / `updateMyCountry`: `/dashboard/profile`.
    - `adminSetReviewFeatured` / `adminSetReviewModeration` / `adminListReviews`: `/admin/reviews` (admin).
- **Mock DB helper** `node "$H/mockdb.cjs" <cmd>`:
  - existing: `restore`, `probe`, `fixture`, `exam-fixture`, `set-package`, `set-status` (completed also stamps `completedAt` and progress 100), `preenrol`;
  - added for Phase 6 in the Controller setup below: `certs`, `set-progress`, `set-certificate-id`, `review-fixture`, `set-country`, `set-signature`.
  - **Run `restore` first and last in every task that touches data**, and say so in your report.
  - At the Phase 3 baseline the student also holds no Forex enrollment (a leftover one is removed by `restore`).
- **HTML checks:**
  - Next HTML is one line: count with `grep -o … | wc -l`, never `grep -c`.
  - Strip scripts before counting visible text (`| strip`).
  - HTML escapes `&` as `&amp;` and `'` as `&#x27;`.
  - The dashboard `(platform)/loading.tsx` streams, so a redirect or `notFound()` there can still answer HTTP 200: judge dashboard pages by content, not status code.
- **Browser (phone width / visual / PDF):**
  - `B=~/.claude/skills/gstack/browse/dist/browse`.
  - Commands: `$B viewport 400x800` · `$B goto <url>` · `$B wait --load` · `$B js "<expr>"` · `$B screenshot --viewport "$P6/<name>.png"` · `$B console --errors`.
  - It browses as the student. Switch persona with `$B js "document.cookie='mock_persona=admin; path=/'"` and **set it back to student** before you finish.
- **Mock data:**

| What | id | Notes |
|---|---|---|
| Forex `forex-trading-mastery` | `6aa7bc2845744c5eeb0eb781` | basic "Forex Foundation" (certificate **false**) · standard "Forex Mastery" · executive "Private Forex Mentorship"; school `trading-financial-markets` ("School of Trading & Financial Markets"); 0 lessons (use `fixture`) |
| Crypto `crypto-trading-mastery` | `6aa7bc2845744c5eeb0eb782` | same ladder shape; same school |
| Blockchain `blockchain-technology-mastery` | `6aa7bc2845744c5eeb0eb783` | one standard "Full program", all entitlements true |
| Bitcoin `bitcoin-cryptocurrency-fundamentals` | `6a6fc0bb6433bbbd6322be03` | free, no packages, no school; student enrollment `6a6fe33862cf63ed050e56c6` (active, `packageKey` absent) |
| Technical analysis `technical-analysis-crypto-trading` | `6a6fc0bb6433bbbd6322be07` | paid $79, no packages; student enrollment `6a6fe33862cf63ed050e56c7` (active) |
| student "Johnson Demo" | `6a6fc0bb6433bbbd6322be61` | `student@worldstreet.academy`, no country, no signature |
| instructor "Sarah Chen" | `6a6fc0ba6433bbbd6322bdfd` | teaches every course above; **no signature** (certificate download disabled until `set-signature`) |
| admin "Ada Admin" | `6a6fc1258372b65d1ee8e972` | `signatureUrl: null` |

Baseline: 0 completed enrollments, 0 exams, 0 meetings, **0 reviews**.

## Controller setup (once, before Task 1 — edits the scratchpad helper, not the repo)

Apply these edits to `$H/mockdb.cjs`. If Phase 4 or Phase 5 already changed the quoted regions, apply the equivalent change and say so.

1. Track reviews. Replace

```js
  "messages", "meetings", "lessons", "exams", "examattempts", "questions", "resources", "watchprogresses",
]
```

with

```js
  "messages", "meetings", "lessons", "exams", "examattempts", "questions", "resources", "watchprogresses",
  "reviews",
]
```

2. Restore tolerates a collection the snapshot never recorded. The Phase 3 baseline had 0 reviews, so an empty list correctly means "delete every review". Replace

```js
      const r = await db.collection(c).deleteMany({ _id: { $nin: snap.ids[c].map(oid) } })
```

with

```js
      const r = await db.collection(c).deleteMany({ _id: { $nin: (snap.ids[c] ?? []).map(oid) } })
```

3. Snapshot and restore user `country` and `signatureUrl`. In `snapshot` replace

```js
    snap.users = await db.collection("users").find({}, { projection: { instructorProfile: 1 } }).toArray()
```

with

```js
    snap.users = await db.collection("users").find({}, { projection: { instructorProfile: 1, country: 1, signatureUrl: 1 } }).toArray()
```

and in `restore` replace the whole `for (const u of snap.users) { … }` loop with:

```js
    for (const u of snap.users) {
      // A field the snapshot didn't record is unset. True at the Phase 3
      // baseline: no user had a country or signature (admin's explicit null
      // becomes absent, which the app reads the same way).
      const set = {}
      const unset = {}
      for (const field of ["instructorProfile", "country", "signatureUrl"]) {
        if (u[field] === undefined) unset[field] = ""
        else set[field] = u[field]
      }
      await db.collection("users").updateOne(
        { _id: u._id },
        { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) }
      )
    }
```

4. New commands. Insert directly before the final `} else {` (the "unknown command" branch):

```js
  } else if (cmd === "set-progress") {
    const [enrollmentId, n] = args
    await db.collection("enrollments").updateOne({ _id: oid(enrollmentId) }, { $set: { progress: Number(n) } })
    console.log(`enrollment ${enrollmentId} progress → ${Number(n)}`)
  } else if (cmd === "set-certificate-id") {
    const [enrollmentId, value] = args
    await db.collection("enrollments").updateOne(
      { _id: oid(enrollmentId) },
      { $set: { certificateId: value === "null" ? null : value } }
    )
    console.log(`enrollment ${enrollmentId} certificateId → ${value}`)
  } else if (cmd === "certs") {
    const slugs = new Map((await db.collection("courses").find({}, { projection: { slug: 1 } }).toArray()).map((c) => [c._id.toString(), c.slug]))
    console.log("certificateId indexes:")
    for (const ix of await db.collection("enrollments").indexes()) {
      if (ix.name.startsWith("certificateId")) {
        console.log(`  ${ix.name} unique=${Boolean(ix.unique)} sparse=${Boolean(ix.sparse)} partial=${JSON.stringify(ix.partialFilterExpression ?? null)}`)
      }
    }
    console.log("enrollments:")
    for (const e of await db.collection("enrollments").find({}).toArray()) {
      console.log(`  ${e._id} user=${e.user} course=${slugs.get(e.course.toString())} status=${e.status} pkg=${e.packageKey ?? null} completedAt=${e.completedAt ? "yes" : "no"} cert=${"certificateId" in e ? JSON.stringify(e.certificateId) : "(missing)"}`)
    }
  } else if (cmd === "review-fixture") {
    // MOCK-ONLY verification data — never real testimonials; `restore` deletes them.
    const ADMIN = "6a6fc1258372b65d1ee8e972"
    const rows = [
      ["forex", STUDENT, FOREX, 5, "Clear structure from the first lesson; the risk module changed how I size positions."],
      ["crypto", ADMIN, "6aa7bc2845744c5eeb0eb782", 4, "Solid grounding in wallets and security before any trading talk."],
      ["blockchain", INSTRUCTOR, "6aa7bc2845744c5eeb0eb783", 5, "Explains consensus without hand-waving; the examples stick."],
      ["low", ADMIN, "6a6fc0bb6433bbbd6322be07", 3, "Useful, though a few sections move slowly."],
    ]
    const ids = {}
    for (const [i, [key, user, course, rating, content]] of rows.entries()) {
      const at = new Date(now.getTime() - i * 60_000) // forex newest → deterministic tie-break
      const r = await db.collection("reviews").insertOne({
        user: oid(user), course: oid(course), rating, title: null, content, isVerifiedPurchase: true,
        isApproved: true, isHidden: false, helpfulCount: 0, reportCount: 0, createdAt: at, updatedAt: at,
      })
      ids[key] = r.insertedId.toString()
    }
    console.log(JSON.stringify(ids))
  } else if (cmd === "set-country") {
    const [userId, code] = args
    await db.collection("users").updateOne(
      { _id: oid(userId) },
      code === "null" ? { $unset: { country: "" } } : { $set: { country: code } }
    )
    console.log(`user ${userId} country → ${code}`)
  } else if (cmd === "set-signature") {
    const [userId, url] = args
    await db.collection("users").updateOne(
      { _id: oid(userId) },
      url === "null" ? { $unset: { signatureUrl: "" } } : { $set: { signatureUrl: url } }
    )
    console.log(`user ${userId} signatureUrl → ${url}`)
```

5. Add these lines to the header comment's command list:

```js
//   set-progress <enrollmentId> <n>
//   set-certificate-id <enrollmentId> <id|null>
//   certs                            certificateId index + every enrollment's status/package/cert
//   review-fixture                   4 mock reviews (forex 5★ student, crypto 4★ admin,
//                                    blockchain 5★ instructor, technical 3★ admin); prints ids
//   set-country <userId> <ISO|null>
//   set-signature <userId> <url|null>
```

6. Check: `node "$H/mockdb.cjs" restore && node "$H/mockdb.cjs" certs` prints `certificateId indexes:` with nothing under it (Task 1 creates the index), plus the student's 2 baseline enrollments with `cert=(missing)`.

---

### Task 1: Stable certificate IDs — field + partial unique index, `lib/certificate-id.ts`, minted on all three completion paths

**Files:**
- Modify: `lib/db/models/enrollment.ts` (interface after `mentorshipIntake`; schema before `progress`; index after the course-analytics index)
- Create: `lib/certificate-id.ts`
- Modify: `lib/actions/enrollments.ts` (import; `completeLesson`'s save)
- Modify: `lib/actions/exams.ts` (import; `gradeAttempt`'s enrollment save)
- Modify: `lib/actions/student.ts` (import; `markCourseComplete`'s completion save)

**Interfaces:**
- Consumes: `BRAND.certificatePrefix` (`@/lib/brand`); `Course`, `Enrollment`, `IEnrollment` (`@/lib/db/models`); `entitlementsFor` (`@/lib/entitlements`, Phase 3).
- Produces (later tasks rely on these exact names):
  - `IEnrollment.certificateId: string | null` (schema default `null`); index `certificateId_1`, unique, `partialFilterExpression: { certificateId: { $type: "string" } }`.
  - `lib/certificate-id.ts`:
    - `generateCertificateId(): string`, e.g. `"WSA-7K2M9QXD"`
    - `legacyCertificateId(enrollmentId: string): string` → `` `${BRAND.certificatePrefix}-${enrollmentId.slice(-8).toUpperCase()}` ``
    - `normalizeCertificateId(raw: string): string | null`: trimmed + uppercased; null unless it matches `^WSA-[0-9A-Z]{8}$`
    - `saveWithCertificateId(enrollment: IEnrollment): Promise<void>`: drop-in for `enrollment.save()` (ruling 11)

- [ ] **Step 1: Model.** In `lib/db/models/enrollment.ts`:
  - in `IEnrollment`, directly under `mentorshipIntake: { goals: string; availability: string; submittedAt: Date } | null`, add:

```ts
  /**
   * Stable certificate ID (spec §13), e.g. "WSA-7K2M9QXD". Stamped once, when a
   * completion's package includes the certificate (lib/certificate-id.ts);
   * null for Basic completions and for rows that aren't complete.
   */
  certificateId: string | null
```

  - in the schema, replace

```ts
        { _id: false }
      ),
      default: null,
    },
    progress: {
```

   with

```ts
        { _id: false }
      ),
      default: null,
    },
    certificateId: { type: String, default: null },
    progress: {
```

  - replace

```ts
// Index for course analytics
EnrollmentSchema.index({ course: 1, status: 1 })
```

   with

```ts
// Index for course analytics
EnrollmentSchema.index({ course: 1, status: 1 })

// Certificate IDs are unique among the enrollments that hold one. A partial
// filter, NOT `sparse`: Mongoose stores certificateId: null on every new row,
// and a sparse index still indexes explicit nulls — the second null would be a
// duplicate-key error on every enrollment create.
EnrollmentSchema.index(
  { certificateId: 1 },
  { unique: true, partialFilterExpression: { certificateId: { $type: "string" } } }
)
```

   Then tell the controller: **controller restarts dev server** (schema change). Continue with Step 2 meanwhile.

- [ ] **Step 2: The helper.** Create `lib/certificate-id.ts`:

```ts
import { randomBytes } from "crypto"
import { BRAND } from "@/lib/brand"
import { Course, Enrollment, type IEnrollment } from "@/lib/db/models"
import { entitlementsFor } from "@/lib/entitlements"

/**
 * Certificate IDs (spec §13). One home for the rules: how an ID is generated,
 * the legacy value certificates printed before IDs were stored, how user input
 * is normalized, and when an enrollment gets one.
 *
 * Server-only by construction (node crypto + Mongoose) — never import this from
 * a "use client" file. The legacy rule is repeated literally in
 * components/learn/certificate-view.tsx (client bundle) and
 * scripts/backfill-certificate-ids.mjs (can't import TS); keep all three equal.
 */

/** Crockford base32: 0-9 and A-Z without I, L, O, U (nothing to misread). */
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

/** Stored IDs are prefix + 8 symbols; legacy hex IDs are a subset of [0-9A-Z]. */
const ID_SHAPE = new RegExp(`^${BRAND.certificatePrefix}-[0-9A-Z]{8}$`)

/** A fresh random ID: 5 random bytes = 40 bits = exactly 8 five-bit symbols (no modulo bias). */
export function generateCertificateId(): string {
  let value = randomBytes(5).readUIntBE(0, 5)
  let symbols = ""
  for (let i = 0; i < 8; i++) {
    symbols = CROCKFORD[value % 32] + symbols
    value = Math.floor(value / 32)
  }
  return `${BRAND.certificatePrefix}-${symbols}`
}

/** What certificates printed before IDs were stored: prefix + last 8 chars of the enrollment id, uppercased. */
export function legacyCertificateId(enrollmentId: string): string {
  return `${BRAND.certificatePrefix}-${enrollmentId.slice(-8).toUpperCase()}`
}

/** Trim + uppercase user input; null when it can't be a certificate ID (so it never reaches the database). */
export function normalizeCertificateId(raw: string): string | null {
  const id = raw.trim().toUpperCase()
  return ID_SHAPE.test(id) ? id : null
}

function isDuplicateCertificateId(err: unknown): boolean {
  const e = err as { code?: number; keyPattern?: Record<string, unknown> } | null
  return e?.code === 11000 && Boolean(e.keyPattern && "certificateId" in e.keyPattern)
}

/**
 * Drop-in for `enrollment.save()` on the completion paths (completeLesson,
 * gradeAttempt's exam pass, markCourseComplete). Saves, then — when the
 * enrollment is completed, has no ID yet, and its package includes the
 * certificate — stamps one:
 *   - a random ID when this save is the transition into "completed";
 *   - the legacy value when it was already completed without an ID (the
 *     certificate page has been printing that value, so storing it keeps the
 *     printed ID verifiable).
 * The stamp only matches a still-completed row with no ID, so concurrent
 * completions can't hand out two IDs. A duplicate retries once with a fresh
 * random ID; a completion never fails because of its certificate ID.
 */
export async function saveWithCertificateId(enrollment: IEnrollment): Promise<void> {
  // Read before save() clears the modified state: an unchanged status means the
  // enrollment was already completed before this call.
  const firstCompletion = enrollment.isModified("status")
  await enrollment.save()

  if (enrollment.status !== "completed" || enrollment.certificateId) return

  const course = await Course.findById(enrollment.course).select("packages").lean()
  if (!course || !entitlementsFor(course, enrollment).certificate) return

  const enrollmentId = enrollment._id.toString()
  const candidates = [
    firstCompletion ? generateCertificateId() : legacyCertificateId(enrollmentId),
    generateCertificateId(),
  ]
  for (const certificateId of candidates) {
    try {
      await Enrollment.updateOne(
        { _id: enrollment._id, status: "completed", certificateId: null },
        { $set: { certificateId } }
      )
      return
    } catch (err) {
      if (!isDuplicateCertificateId(err)) throw err
    }
  }
  console.error(`[Certificates] no unique certificate ID for enrollment ${enrollmentId} after one retry`)
}
```

- [ ] **Step 3: `completeLesson`.** In `lib/actions/enrollments.ts`:
  - directly under `import { getCourseAccess, isLessonLockedFor, lockedLessonIds } from "@/lib/course-access"` add `import { saveWithCertificateId } from "@/lib/certificate-id"`;
  - in `completeLesson` replace

```ts
    await enrollment.save()

    revalidatePath(`/courses/${courseId}/learn/${lessonId}`)
```

   with

```ts
    // A completion and its certificate ID (when the package certifies) land together.
    await saveWithCertificateId(enrollment)

    revalidatePath(`/courses/${courseId}/learn/${lessonId}`)
```

- [ ] **Step 4: Exam pass.** In `lib/actions/exams.ts`:
  - directly under `import { PACKAGE_LABEL, canAccessLesson, effectiveLessonTier, entitlementsFor, lowestPackageWith } from "@/lib/entitlements"` add `import { saveWithCertificateId } from "@/lib/certificate-id"`;
  - in `gradeAttempt` replace

```ts
        enrollment.status = "completed"
        enrollment.completedAt = new Date()
      }
    }
    await enrollment.save()
  }
```

   with

```ts
        enrollment.status = "completed"
        enrollment.completedAt = new Date()
      }
    }
    // A pass that completes the course also issues its certificate ID.
    await saveWithCertificateId(enrollment)
  }
```

- [ ] **Step 5: `markCourseComplete`.** In `lib/actions/student.ts`:
  - directly under `import { getCourseAccess, lockedLessonIds, openPublishedLessonIds } from "@/lib/course-access"` add `import { saveWithCertificateId } from "@/lib/certificate-id"`; [audit: the import gained `openPublishedLessonIds` in the Phase 3 final-fix wave (commit 3de21ee) — the plan's original quote (`getCourseAccess, lockedLessonIds`) no longer matches HEAD]
  - in `markCourseComplete` replace (leave the earlier `requiresExam` save untouched)

```ts
    enrollment.status = "completed"
    enrollment.completedAt = new Date()
    await enrollment.save()
```

   with

```ts
    enrollment.status = "completed"
    enrollment.completedAt = new Date()
    // A completion and its certificate ID (when the package certifies) land together.
    await saveWithCertificateId(enrollment)
```

- [ ] **Step 6: Verify — static.**
  1. tsc (filtered) and `npx eslint lib/db/models/enrollment.ts lib/certificate-id.ts lib/actions/enrollments.ts lib/actions/exams.ts lib/actions/student.ts`. No output.
  2. `grep -c "saveWithCertificateId(enrollment)" lib/actions/enrollments.ts lib/actions/exams.ts lib/actions/student.ts` → `1` for each file.
  3. Path 1 has no web caller today: `grep -rn "completeLesson(" app components lib --include=*.ts --include=*.tsx` prints only its definition. It is covered by the shared helper and by check 2.
  4. Rules. Create `"$P6/t1-certificate-id.ts"`:

```ts
import assert from "node:assert/strict"
import { generateCertificateId, legacyCertificateId, normalizeCertificateId } from "@/lib/certificate-id"

const shape = /^WSA-[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{8}$/
const ids = Array.from({ length: 5000 }, () => generateCertificateId())
for (const id of ids) assert.match(id, shape)
assert.equal(new Set(ids).size, ids.length, "5,000 draws, no repeats")
const symbols = new Set(ids.flatMap((id) => [...id.slice(4)]))
assert.equal(symbols.size, 32, "every Crockford symbol appears")
for (const banned of ["I", "L", "O", "U"]) assert.ok(!symbols.has(banned), `no ${banned}`)

assert.equal(legacyCertificateId("6a6fe33862cf63ed050e56c6"), "WSA-050E56C6")
assert.equal(normalizeCertificateId("  wsa-7k2m9qxd "), "WSA-7K2M9QXD")
assert.equal(normalizeCertificateId("WSA-050E56C6"), "WSA-050E56C6", "legacy hex IDs are accepted")
assert.equal(normalizeCertificateId("WSA-7K2M9QX"), null)
assert.equal(normalizeCertificateId("XYZ-7K2M9QXD"), null)
assert.equal(normalizeCertificateId("hello"), null)

console.log("certificate-id: all assertions passed")
```

   Run from the repo root: `npx tsx --tsconfig ./tsconfig.json "$P6/t1-certificate-id.ts"` → `certificate-id: all assertions passed`. Importing the module loads the Mongoose models without connecting; that is fine. If tsx can't resolve `@/lib/…` from outside the repo, switch the import to an absolute path into the repo and say so.

- [ ] **Step 7: Verify — runtime** (after the controller confirms the restart). Preflight `echo "${MONGODB_URI:-unset}"` → `unset`; `node "$H/mockdb.cjs" restore`. The helper `jid() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).enrollmentId))'; }` extracts an id from `fixture`/`preenrol` output.
  1. **Index + null rows.** Two free enrollments, each created by Mongoose with an explicit null. With a sparse index the second would fail.
     - `bash "$H/action.sh" "/dashboard/checkout?courseId=$BTC" purchaseCourse "[{\"courseId\":\"$BTC\"}]" admin` → `success: true`.
     - The same call with persona `instructor` → `success: true`.
     - `node "$H/mockdb.cjs" certs` shows:
       - `certificateId_1 unique=true sparse=false partial={"certificateId":{"$type":"string"}}`
       - two new bitcoin rows (users `$ADMIN`, `$INSTRUCTOR`), each with `cert=null` (stored null, not `(missing)`).
     - Note the instructor's bitcoin enrollment id as `I2`.
  2. **Fixture + action id.** [audit: `markCourseComplete` now refuses until every open published lesson is done (commit 3de21ee) — the fixture's enrollment starts with `completedLessons: []`, so the three lessons the executive package opens must be marked complete before `markCourseComplete` can succeed. Inserted the `markLessonComplete` pass below; steps 3–6 are unchanged and still hold once it runs, since `completedLessons` persists across the later `set-package` calls.]
     - `node "$H/mockdb.cjs" fixture executive` → note `N` (enrollmentId) and `LE`/`LS`/`LX` (`lessons.everyone`/`lessons.standard`/`lessons.executive`, the last lesson).
     - Mark all three fixture lessons complete while the package is still executive (it opens all of them), via the Finish button's per-lesson action, `markLessonComplete` (`lib/actions/student.ts`) — never `completeLesson`, which has no web caller:
       - `MLC=$(PRINT_ID=1 bash "$H/action.sh" "/dashboard/courses/$F/learn/$LE" markLessonComplete '[]')` must print a hex id.
       - `post "$MLC" "/dashboard/courses/$F/learn/$LE" student "[\"$F\",\"$LE\"]"` → `{"success":true}`.
       - `post "$MLC" "/dashboard/courses/$F/learn/$LS" student "[\"$F\",\"$LS\"]"` → `{"success":true}`.
       - `post "$MLC" "/dashboard/courses/$F/learn/$LX" student "[\"$F\",\"$LX\"]"` → `{"success":true}`.
     - `MCC=$(PRINT_ID=1 bash "$H/action.sh" "/dashboard/courses/$F/learn/$LX" markCourseComplete '[]')` must print a hex id. If it doesn't, report which page did render the Finish button.
  3. **Basic never gets an ID.**
     - `node "$H/mockdb.cjs" set-package $N basic`.
     - `post "$MCC" "/dashboard/courses/$F/learn/$LX" student "[\"$F\"]"` → `{"success":true}`.
     - `certs`: `N` shows `status=completed pkg=basic` with `cert=(missing)` or `cert=null`, **never** a string.
  4. **Fresh completion → random ID.**
     - `set-package $N standard`, then `set-status $N active`, then the same `post` → success.
     - `certs`: `N` has `cert="WSA-…"` matching `^WSA-[0-9A-HJKMNP-TV-Z]{8}$` and **not** equal to `WSA-<last 8 of N, uppercased>`. Note it as `X1`.
     - Repeat the `post` → `N` still has `X1`.
  5. **Already completed without an ID → legacy value.** `node "$H/mockdb.cjs" set-certificate-id $N null` (status stays completed), then `post` → `certs`: `N` has `cert="WSA-<last 8 of N, uppercased>"`.
  6. **Duplicate → one retry with a random ID.**
     - `set-certificate-id $N null`, then `set-certificate-id $I2 WSA-<last 8 of N, uppercased>`.
     - `post` → `{"success":true}`.
     - `certs`: `N` has a random-shaped cert that is not the legacy value; `I2` still holds the legacy value.
  7. **Exam pass (path 2)**, as admin on Crypto:

```bash
A=$(node "$H/mockdb.cjs" preenrol $ADMIN $C | jid)
node "$H/mockdb.cjs" set-status $A active
node "$H/mockdb.cjs" set-package $A standard
node "$H/mockdb.cjs" set-progress $A 100
node "$H/mockdb.cjs" exam-fixture $C
START=$(bash "$H/action.sh" "/dashboard/courses/$C/exam" startExamAttempt "[\"$C\"]" admin)
ATT=$(node -e 'console.log(JSON.parse(process.argv[1]).runner.attemptId)' "$START")
Q=$(node -e 'console.log(JSON.parse(process.argv[1]).runner.questions[0].id)' "$START")
bash "$H/action.sh" "/dashboard/courses/$C/exam" submitExamAttempt "[\"$ATT\",{\"$Q\":[\"a\"]}]" admin
```

     The last command prints `"passed":true` and `"courseCompleted":true`. `certs`: `A` is `status=completed pkg=standard` with a random-shaped cert. If the flight row isn't plain JSON for `node -e`, read `attemptId` and the question id by eye and say so.
  8. End: `node "$H/mockdb.cjs" restore`; `certs` shows no string certs (the index stays; expected).

- [ ] **Step 8: Commit.**

```bash
git add lib/db/models/enrollment.ts lib/certificate-id.ts lib/actions/enrollments.ts lib/actions/exams.ts lib/actions/student.ts
git commit -m "feat(certificates): stable certificate IDs stamped on every certifying completion (partial unique index)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Backfill script — legacy IDs stored on already-completed certificates (dry run first, `--apply` needs an explicit URI)

**Files:**
- Create: `scripts/backfill-certificate-ids.mjs`

**Interfaces:**
- Consumes:
  - `enrollments.certificateId` and its partial unique index (Task 1);
  - `courses.packages[].key/entitlements.certificate` (Phase 0).
  - Duplicated literally, with comments naming the sources: `BRAND.certificatePrefix`, `legacyCertificateId`, and the certificate rule of `entitlementsFor`.
- Produces:
  - CLI `MONGODB_URI=<uri> node scripts/backfill-certificate-ids.mjs [--apply]`.
  - Output lines `WOULD SET <id> → <cert>` / `SET <id> → <cert>` / `SKIP <id> · …` / `COLLISION <id> · …`, then a summary `candidates N · (would) set N · no certificate N · course missing N · collisions N`.
  - Exit 1 on refusal.
  - Phase 8 runs it against production with an explicit URI.

- [ ] **Step 1: Script.** Create `scripts/backfill-certificate-ids.mjs`:

```js
/**
 * Store the legacy certificate ID on enrollments completed before IDs were
 * stored (WorldStreet Mastery Academy, Phase 6).
 *
 * Certificates have always printed `WSA-<last 8 chars of the enrollment _id,
 * uppercased>`. This writes exactly that value to `enrollments.certificateId`
 * so every PDF already downloaded stays verifiable at /verify/<id>. New
 * completions get a random ID from lib/certificate-id.ts instead.
 *
 *   MONGODB_URI=<uri> node scripts/backfill-certificate-ids.mjs           # dry run
 *   MONGODB_URI=<uri> node scripts/backfill-certificate-ids.mjs --apply   # writes
 *
 * Candidates: status "completed", completedAt set, no certificateId, and a
 * package that includes the certificate. Duplicated literally from the app's
 * TS (a .mjs script can't import it):
 *   - lib/brand.ts           BRAND.certificatePrefix ("WSA")
 *   - lib/certificate-id.ts  legacyCertificateId()
 *   - lib/entitlements.ts    entitlementsFor(): a null packageKey, or a package
 *                            no longer on the course, is full access (certifies)
 * Basic completions never certify and are skipped. Collisions (the legacy
 * value already stored on another enrollment, or two candidates sharing their
 * last 8 chars) are skipped and reported — never overwritten. Idempotent: a
 * re-run only revisits the rows it skipped.
 *
 * SAFETY: .env.local holds the PRODUCTION URI. A dry run may read it; --apply
 * refuses unless MONGODB_URI was set on the command line. Like
 * scripts/mastery-catalogue.mjs, raw collection writes don't bump updatedAt.
 */
import mongoose from "mongoose"
import { config } from "dotenv"

// Read BEFORE dotenv runs: dotenv never overrides a variable that is already
// set, so this is non-empty only when the operator passed the URI explicitly.
const EXPLICIT_URI = process.env.MONGODB_URI
config({ path: ".env.local" })
config()

const APPLY = process.argv.includes("--apply")
const PREFIX = "WSA" // lib/brand.ts BRAND.certificatePrefix

if (APPLY && !EXPLICIT_URI) {
  console.error("REFUSING --apply: MONGODB_URI must be passed on the command line; a URI from .env files is never written to.")
  console.error("  MONGODB_URI=<uri> node scripts/backfill-certificate-ids.mjs --apply")
  process.exit(1)
}

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error("MONGODB_URI is not set — refusing to run.")
  process.exit(1)
}

await mongoose.connect(uri)
const db = mongoose.connection.db
console.log(
  `Target: ${uri.replace(/\/\/[^@/]+@/, "//***@")} · database ${db.databaseName} · URI from ${EXPLICIT_URI ? "command line" : ".env file"}`
)
console.log(`Mode: ${APPLY ? "APPLY" : "dry run"}`)

const enrollments = db.collection("enrollments")

// `certificateId: null` matches both a stored null and a missing field.
const candidates = await enrollments
  .find(
    { status: "completed", completedAt: { $ne: null }, certificateId: null },
    { projection: { _id: 1, course: 1, packageKey: 1 } }
  )
  .toArray()

const courseIds = [...new Map(candidates.map((e) => [e.course.toString(), e.course])).values()]
const courseById = new Map(
  (await db.collection("courses").find({ _id: { $in: courseIds } }, { projection: { packages: 1 } }).toArray()).map(
    (c) => [c._id.toString(), c]
  )
)

/** lib/entitlements.ts entitlementsFor(course, enrollment).certificate, literally. */
function certifies(course, packageKey) {
  if (!packageKey) return true
  const pkg = (course.packages ?? []).find((p) => p.key === packageKey)
  return pkg ? Boolean(pkg.entitlements?.certificate) : true
}

const counts = { candidates: candidates.length, set: 0, noCertificate: 0, courseMissing: 0, collisions: 0, changed: 0 }
const claimed = new Map() // certificateId -> enrollment id, within this run

for (const e of candidates) {
  const id = e._id.toString()
  const course = courseById.get(e.course.toString())
  if (!course) {
    console.log(`SKIP ${id} · course ${e.course} missing`)
    counts.courseMissing++
    continue
  }
  if (!certifies(course, e.packageKey ?? null)) {
    console.log(`SKIP ${id} · package "${e.packageKey}" has no certificate`)
    counts.noCertificate++
    continue
  }

  const certificateId = `${PREFIX}-${id.slice(-8).toUpperCase()}` // lib/certificate-id.ts legacyCertificateId
  const holder =
    claimed.get(certificateId) ??
    (await enrollments.findOne({ certificateId }, { projection: { _id: 1 } }))?._id.toString()
  if (holder) {
    console.log(`COLLISION ${id} · ${certificateId} already belongs to enrollment ${holder} — skipped`)
    counts.collisions++
    continue
  }
  claimed.set(certificateId, id)

  if (!APPLY) {
    console.log(`WOULD SET ${id} → ${certificateId}`)
    counts.set++
    continue
  }
  try {
    const res = await enrollments.updateOne({ _id: e._id, certificateId: null }, { $set: { certificateId } })
    if (res.modifiedCount === 1) {
      console.log(`SET ${id} → ${certificateId}`)
      counts.set++
    } else {
      console.log(`SKIP ${id} · changed while running (it has an ID now)`)
      counts.changed++
    }
  } catch (err) {
    if (err?.code !== 11000) throw err
    console.log(`COLLISION ${id} · ${certificateId} was taken while running — skipped`)
    counts.collisions++
  }
}

console.log(`\n${"-".repeat(60)}`)
console.log(
  `candidates ${counts.candidates} · ${APPLY ? "set" : "would set"} ${counts.set} · no certificate ${counts.noCertificate} · course missing ${counts.courseMissing} · collisions ${counts.collisions}${counts.changed ? ` · changed ${counts.changed}` : ""}`
)
if (!APPLY) console.log("\nDRY RUN — nothing written. Re-run with MONGODB_URI=<uri> … --apply")

await mongoose.disconnect()
```

- [ ] **Step 2: Verify.** Never run this script without `MONGODB_URI="$LOCAL_URI"` in front, except the refusal check in 2.1, which strips the variable on purpose and exits before connecting.
  - Preflight `echo "${MONGODB_URI:-unset}"` → `unset`.
  - `npx eslint scripts/backfill-certificate-ids.mjs` → no output.
  - `node "$H/mockdb.cjs" restore`.
  - Define `jid` as in Task 1 Step 7.
  1. **Refusal.** `env -u MONGODB_URI node scripts/backfill-certificate-ids.mjs --apply; echo "exit=$?"` → the two `REFUSING --apply …` lines, then `exit=1`, and **no** `Target:` line.
  2. **Data.**

```bash
N1=$(node "$H/mockdb.cjs" fixture standard | jid)         # student · Forex Standard (certifies)
node "$H/mockdb.cjs" set-status $N1 completed
N2=$(node "$H/mockdb.cjs" preenrol $ADMIN $C | jid)       # admin · Crypto Basic (no certificate)
node "$H/mockdb.cjs" set-package $N2 basic
node "$H/mockdb.cjs" set-status $N2 completed
node "$H/mockdb.cjs" set-status 6a6fe33862cf63ed050e56c6 completed   # bitcoin, no package → WSA-050E56C6
node "$H/mockdb.cjs" set-status 6a6fe33862cf63ed050e56c7 completed   # technical analysis → WSA-050E56C7 …
N3=$(node "$H/mockdb.cjs" preenrol $INSTRUCTOR 6aa7bc2845744c5eeb0eb783 | jid)
node "$H/mockdb.cjs" set-certificate-id $N3 WSA-050E56C7            # … already held by another row
```

  3. **Dry run.** `MONGODB_URI="$LOCAL_URI" node scripts/backfill-certificate-ids.mjs` prints:
     - `Target: mongodb://127.0.0.1:27017/worldstreet-academy · database worldstreet-academy · URI from command line`
     - `Mode: dry run`
     - in any order:
       - `WOULD SET <N1> → WSA-<last 8 of N1, uppercased>`
       - `WOULD SET 6a6fe33862cf63ed050e56c6 → WSA-050E56C6`
       - `COLLISION 6a6fe33862cf63ed050e56c7 · WSA-050E56C7 already belongs to enrollment <N3> — skipped`
       - `SKIP <N2> · package "basic" has no certificate`
     - `candidates 4 · would set 2 · no certificate 1 · course missing 0 · collisions 1`
     - `DRY RUN — nothing written…`

     `node "$H/mockdb.cjs" certs`: the only string cert is `N3`'s.
  4. **Apply.** `MONGODB_URI="$LOCAL_URI" node scripts/backfill-certificate-ids.mjs --apply` prints the same, with `SET` instead of `WOULD SET` and `Mode: APPLY`. Summary: `candidates 4 · set 2 · no certificate 1 · course missing 0 · collisions 1`. `certs`: `N1` and `…56c6` hold their legacy values; `…56c7` and `N2` have none.
  5. **Idempotent.** Run `--apply` again → only the COLLISION and SKIP lines, then `candidates 2 · set 0 · no certificate 1 · course missing 0 · collisions 1`.
  6. End: `node "$H/mockdb.cjs" restore`.

- [ ] **Step 3: Commit.**

```bash
git add scripts/backfill-certificate-ids.mjs
git commit -m "feat(certificates): dry-run-first backfill storing legacy certificate IDs (apply needs an explicit MONGODB_URI)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Certificate rebrand — stored ID, program and school, verify URL as text, dormant Academy signatory slot

**Files:**
- Modify: `lib/brand.ts` (whole file)
- Modify: `lib/actions/certificates.ts` (import; `CertificateData`; `fetchCertificate`'s return)
- Modify: `components/learn/certificate-view.tsx` (preview props + four blocks; `CertificateClient` head; PDF image load, program, seal, date, ID/filename; preview call; footer)
- Modify: `app/(platform)/dashboard/courses/[courseId]/certificate/page.tsx` (whole file)

**Interfaces:**
- Consumes: `IEnrollment.certificateId` (Task 1); `SCHOOL_BY_SLUG`, `isSchoolSlug` (`@/lib/schools`); `appUrl` (`@/lib/app-url`).
- Produces:
  - `export type Signatory = { name: string | null; title: string | null; imagePath: string | null }` and `BRAND.signatory: Signatory` (all null).
  - `CertificateData` gains `certificateId: string | null`, `programName: string`, `schoolName: string | null`; the existing fields are unchanged.
  - `CertificateClient({ data, verifyUrl }: { data: CertificateData; verifyUrl: string | null })`. `verifyUrl` is absolute, and non-null only when `data.certificateId` is stored.

- [ ] **Step 1: Brand.** Replace the whole of `lib/brand.ts` with:

```ts
/**
 * Brand facts for WorldStreet Mastery Academy. The only place the product
 * name, lockup eyebrow, tagline and sender identity are spelled out — every
 * surface imports from here (design-system 04-components → TopNav lockup).
 */

/** The Academy's authorized signatory on certificates (decision D9). */
export type Signatory = { name: string | null; title: string | null; imagePath: string | null }

/**
 * Product has not supplied the signatory's name or signature file yet (product
 * debt). Certificates render the Academy signatory block only when `name` and
 * `imagePath` are both set — until then the instructor signature is the
 * authorized signature. Never fill these with a placeholder person.
 * `imagePath` is a public path, e.g. "/brand/signatory.png".
 */
const SIGNATORY: Signatory = { name: null, title: null, imagePath: null }

export const BRAND = {
  name: "WorldStreet Mastery Academy",
  /** Lockup wordmark next to the gold wsa-mark. */
  wordmark: "WorldStreet",
  /** Lockup eyebrow; rendered uppercase by CSS. Admin shell overrides with "Admin". */
  eyebrow: "Mastery Academy",
  tagline: "Learn Skills. Build Value. Own Your Future.",
  descriptor:
    "The world's premier institution for skills, innovation and wealth liquefaction.",
  supportEmail: "support@worldstreetgold.com",
  fromEmail: "WorldStreet Mastery Academy <noreply@worldstreet.academy>",
  certificatePrefix: "WSA",
  signatory: SIGNATORY,
} as const
```

- [ ] **Step 2: Certificate data.** In `lib/actions/certificates.ts`:
  - under `import { entitlementsFor } from "@/lib/entitlements"` add `import { SCHOOL_BY_SLUG, isSchoolSlug } from "@/lib/schools"`;
  - in `CertificateData`, directly under `studentSignatureUrl: string | null`, add:

```ts
  /** Stored certificate ID (spec §13); null for a certificate completed before IDs were stored — the view prints the legacy value. */
  certificateId: string | null
  /** The program (course) title as printed on the certificate. */
  programName: string
  /** Full school name ("School of Trading & Financial Markets"); null for a course without a school. */
  schoolName: string | null
```

  - in `fetchCertificate`'s returned object, directly under `studentSignatureUrl: user.signatureUrl ?? null,`, add:

```ts
      certificateId: enrollment.certificateId ?? null,
      programName: course.title,
      schoolName: isSchoolSlug(course.school) ? SCHOOL_BY_SLUG[course.school].name : null,
```

- [ ] **Step 3: Preview.** In `components/learn/certificate-view.tsx`.
  - (Brand: the preview already prints `{BRAND.name}` under an `uppercase` class, and the PDF prints `BRAND.name.toUpperCase()`. Both stay as they are.)
  1. Replace

```tsx
function CertificatePreview({
  data,
  studentSignature,
}: {
  data: CertificateData
  studentSignature: string | null
}) {
```

   with

```tsx
/** The Academy signatory block renders only once product supplies a name and a signature file (D9). */
const signatory =
  BRAND.signatory.name && BRAND.signatory.imagePath
    ? { name: BRAND.signatory.name, title: BRAND.signatory.title, imagePath: BRAND.signatory.imagePath }
    : null

function CertificatePreview({
  data,
  studentSignature,
  certificateId,
  verifyLabel,
}: {
  data: CertificateData
  studentSignature: string | null
  certificateId: string
  verifyLabel: string | null
}) {
```

  2. Replace

```tsx
  const completedDate = new Date(data.completedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
```

   with

```tsx
  // UTC — the same day /verify shows.
  const completedDate = new Date(data.completedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  })
```

  3. Replace

```tsx
        {/* Course info */}
        <div className="text-center max-w-[70%]">
          <p className="text-[8px] sm:text-[9px] md:text-[10px] text-ws-subtle mb-1.5 sm:mb-2">
            for successfully completing the course
          </p>
          <p className="text-xs sm:text-sm md:text-lg font-semibold text-ws-primary leading-snug">
            {data.courseTitle}
          </p>
        </div>
```

   with

```tsx
        {/* Program info */}
        <div className="text-center max-w-[70%]">
          <p className="text-[8px] sm:text-[9px] md:text-[10px] text-ws-subtle mb-1.5 sm:mb-2">
            for successfully completing the program
          </p>
          <p className="text-xs sm:text-sm md:text-lg font-semibold text-ws-primary leading-snug">
            {data.programName}
          </p>
          {data.schoolName && (
            <p className="mt-0.5 text-[7px] sm:text-[8px] md:text-[10px] text-ws-muted">
              {data.schoolName}
            </p>
          )}
        </div>
```

  4. Replace

```tsx
          {/* Center seal — Logo */}
          <div className="flex flex-col items-center">
            <Image
              src={logoPath}
              alt={BRAND.name}
              width={64}
              height={64}
              className="w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 object-contain"
            />
            <p className="text-[6px] sm:text-[7px] md:text-[8px] text-ws-subtle tracking-widest uppercase mt-1">
              Verified
            </p>
          </div>
```

   with

```tsx
          {/* Center — the Academy signatory once configured (D9), else the seal */}
          {signatory ? (
            <div className="flex flex-col items-center gap-1">
              <Image
                src={signatory.imagePath}
                alt={`${signatory.name} signature`}
                width={160}
                height={40}
                className="h-6 sm:h-8 md:h-10 w-auto object-contain mb-0.5"
              />
              <div className="w-full max-w-[120px] sm:max-w-[140px] md:max-w-[160px] h-px bg-ws-track" />
              <p className="text-[7px] sm:text-[8px] md:text-[9px] text-ws-subtle uppercase tracking-widest mt-0.5">
                {signatory.title ?? "Authorized signatory"}
              </p>
              <p className="text-[8px] sm:text-[9px] md:text-[10px] text-ws-muted font-medium">
                {signatory.name}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <Image
                src={logoPath}
                alt={BRAND.name}
                width={64}
                height={64}
                className="w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 object-contain"
              />
              <p className="text-[6px] sm:text-[7px] md:text-[8px] text-ws-subtle tracking-widest uppercase mt-1">
                Verified
              </p>
            </div>
          )}
```

  5. Replace

```tsx
        {/* Certificate ID */}
        <p className="absolute bottom-3 sm:bottom-4 md:bottom-5 left-0 right-0 text-center text-[6px] sm:text-[7px] md:text-[8px] text-ws-subtle tracking-wider">
          WSA-{data.id.slice(-8).toUpperCase()}
        </p>
```

   with

```tsx
        {/* Certificate ID + where to verify it (spec §13) */}
        <p className="absolute bottom-3 sm:bottom-4 md:bottom-5 inset-x-0 flex flex-wrap justify-center gap-x-2 px-8 text-center text-[6px] sm:text-[7px] md:text-[8px] text-ws-subtle tracking-wider tabular-nums">
          <span>{`Certificate ID ${certificateId}`}</span>
          {verifyLabel && <span>{`Verify at ${verifyLabel}`}</span>}
        </p>
```

- [ ] **Step 4: Client + PDF.** Same file.
  1. Replace `export function CertificateClient({ data }: { data: CertificateData }) {` with:

```tsx
/**
 * The stored certificate ID, or — for a certificate completed before IDs were
 * stored — the ID it has always printed. Same rule as `legacyCertificateId` in
 * lib/certificate-id.ts, repeated because that module (node crypto + Mongoose)
 * can't enter a client bundle.
 */
function printedCertificateId(data: CertificateData): string {
  return data.certificateId ?? `${BRAND.certificatePrefix}-${data.id.slice(-8).toUpperCase()}`
}

export function CertificateClient({ data, verifyUrl }: { data: CertificateData; verifyUrl: string | null }) {
  const certificateId = printedCertificateId(data)
  /** Printed without the scheme; never uppercased — the /verify path is case-sensitive. */
  const verifyLabel = verifyUrl ? verifyUrl.replace(/^https?:\/\//, "") : null
```

  2. Replace

```tsx
    const [logoDataUrl, watermarkDataUrl, instructorSigDataUrl, studentSigDataUrl] =
      await Promise.all([
        fetchAsDataUrl(logoPath),
        fetchAsDataUrl(logoPath),
        data.instructorSignatureUrl
          ? fetchAsDataUrl(data.instructorSignatureUrl)
          : null,
        studentSig ? fetchAsDataUrl(studentSig) : null,
      ])
```

   with

```tsx
    const [logoDataUrl, watermarkDataUrl, instructorSigDataUrl, studentSigDataUrl, signatoryDataUrl] =
      await Promise.all([
        fetchAsDataUrl(logoPath),
        fetchAsDataUrl(logoPath),
        data.instructorSignatureUrl
          ? fetchAsDataUrl(data.instructorSignatureUrl)
          : null,
        studentSig ? fetchAsDataUrl(studentSig) : null,
        signatory ? fetchAsDataUrl(signatory.imagePath) : null,
      ])
```

  3. Replace

```tsx
    // ── "for successfully completing the course" ─────────────────
    doc.setFont("helvetica", "normal")
    doc.setFontSize(6.5)
    doc.setTextColor(160, 160, 160)
    doc.text("FOR SUCCESSFULLY COMPLETING THE COURSE", cx, 108, {
      align: "center",
    })

    // ── Course title ─────────────────────────────────────────────
    doc.setFont("helvetica", "bold")
    doc.setFontSize(13)
    doc.setTextColor(50, 50, 50)
    const courseTitle = data.courseTitle
    if (courseTitle.length > 55) {
      const lines = doc.splitTextToSize(courseTitle, 170)
      doc.text(lines, cx, 118, { align: "center" })
    } else {
      doc.text(courseTitle, cx, 118, { align: "center" })
    }
```

   with

```tsx
    // ── "for successfully completing the program" ────────────────
    doc.setFont("helvetica", "normal")
    doc.setFontSize(6.5)
    doc.setTextColor(160, 160, 160)
    doc.text("FOR SUCCESSFULLY COMPLETING THE PROGRAM", cx, 108, {
      align: "center",
    })

    // ── Program title (+ school) ─────────────────────────────────
    doc.setFont("helvetica", "bold")
    doc.setFontSize(13)
    doc.setTextColor(50, 50, 50)
    const programLines: string[] =
      data.programName.length > 55 ? doc.splitTextToSize(data.programName, 170) : [data.programName]
    doc.text(programLines, cx, 118, { align: "center" })
    if (data.schoolName) {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(7)
      doc.setTextColor(120, 120, 120)
      doc.text(data.schoolName, cx, 118 + programLines.length * 5.5 + 1, { align: "center" })
    }
```

  4. Replace

```tsx
    const dateFormatted = new Date(data.completedAt).toLocaleDateString(
      "en-US",
      { year: "numeric", month: "long", day: "numeric" }
    )
```

   with

```tsx
    const dateFormatted = new Date(data.completedAt).toLocaleDateString(
      "en-US",
      { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }
    )
```

  5. Replace

```tsx
    // ── Center: Seal / Logo — WorldStreet3x ──────────────────────
    if (logoDataUrl) {
      // Maintain aspect ratio - WorldStreet logo is wider than tall
      const sealWidth = 24
      const sealHeight = 16
      doc.addImage(logoDataUrl, "PNG", cx - sealWidth/2, botY - 12, sealWidth, sealHeight)
    }
    doc.setFont("helvetica", "normal")
    doc.setFontSize(5)
    doc.setTextColor(190, 190, 190)
    doc.text("VERIFIED", cx, botY + 13, { align: "center" })
```

   with

```tsx
    // ── Center: Academy signatory (D9) when configured, else the seal ──
    if (signatory) {
      if (signatoryDataUrl) {
        doc.addImage(signatoryDataUrl, "PNG", cx - 18, botY - 14, 36, 12)
      }
      doc.setDrawColor(180, 180, 180)
      doc.setLineWidth(0.25)
      doc.line(cx - 22, botY, cx + 22, botY)

      doc.setFont("helvetica", "normal")
      doc.setFontSize(5.5)
      doc.setTextColor(160, 160, 160)
      doc.text((signatory.title ?? "Authorized signatory").toUpperCase(), cx, botY + 5, { align: "center" })

      doc.setFontSize(7)
      doc.setTextColor(80, 80, 80)
      doc.text(signatory.name, cx, botY + 11, { align: "center" })
    } else {
      if (logoDataUrl) {
        // Maintain aspect ratio - WorldStreet logo is wider than tall
        const sealWidth = 24
        const sealHeight = 16
        doc.addImage(logoDataUrl, "PNG", cx - sealWidth/2, botY - 12, sealWidth, sealHeight)
      }
      doc.setFont("helvetica", "normal")
      doc.setFontSize(5)
      doc.setTextColor(190, 190, 190)
      doc.text("VERIFIED", cx, botY + 13, { align: "center" })
    }
```

  6. Replace

```tsx
    // ── Certificate ID ───────────────────────────────────────────
    doc.setFont("helvetica", "normal")
    doc.setFontSize(5)
    doc.setTextColor(200, 200, 200)
    doc.text(`WSA-${data.id.slice(-8).toUpperCase()}`, cx, h - 12, {
      align: "center",
    })

    doc.save(
      `WorldStreet-Certificate-${data.courseTitle.replace(/[^a-zA-Z0-9]/g, "-")}.pdf`
    )
  }, [data, studentSig, logoPath])
```

   with

```tsx
    // ── Certificate ID + verify URL (spec §13) ───────────────────
    doc.setFont("helvetica", "normal")
    doc.setFontSize(5.5)
    doc.setTextColor(150, 150, 150)
    doc.text(`CERTIFICATE ID ${certificateId}`, cx, h - 21, { align: "center" })
    if (verifyLabel) {
      doc.setFontSize(5)
      doc.setTextColor(170, 170, 170)
      doc.text(`Verify at ${verifyLabel}`, cx, h - 16.5, { align: "center" })
    }

    doc.save(
      `${BRAND.name.replace(/[^a-zA-Z0-9]+/g, "-")}-Certificate-${data.programName.replace(/[^a-zA-Z0-9]/g, "-")}.pdf`
    )
  }, [data, studentSig, logoPath, certificateId, verifyLabel])
```

  7. Replace `<CertificatePreview data={data} studentSignature={studentSig} />` with:

```tsx
          <CertificatePreview
            data={data}
            studentSignature={studentSig}
            certificateId={certificateId}
            verifyLabel={verifyLabel}
          />
```

  8. Replace

```tsx
        <p className="text-center text-[11px] text-muted-foreground mt-4">
          Certificate ID: WSA-{data.id.slice(-8).toUpperCase()}
        </p>
```

   with

```tsx
        <p className="text-center text-[11px] text-muted-foreground mt-4 tabular-nums">
          {`Certificate ID: ${certificateId}`}
        </p>
        {verifyUrl && (
          <p className="text-center text-[11px] text-muted-foreground mt-1">
            Verify this certificate at{" "}
            <a href={verifyUrl} className="underline underline-offset-2 hover:text-ws-primary break-all">
              {verifyLabel}
            </a>
          </p>
        )}
```

- [ ] **Step 5: Page.** Replace the whole of `app/(platform)/dashboard/courses/[courseId]/certificate/page.tsx` with:

```tsx
import { notFound } from "next/navigation"
import { fetchCertificate } from "@/lib/actions/certificates"
import { CertificateClient } from "@/components/learn/certificate-view"
import { Topbar } from "@/components/platform/topbar"
import { appUrl } from "@/lib/app-url"

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ courseId: string }>
}) {
  const { courseId } = await params
  const certificate = await fetchCertificate(courseId)

  if (!certificate) notFound()

  // Built on the server: APP_URL reads SITE_URL, which a client bundle can't
  // see. Only a stored ID can be verified, so a legacy certificate prints none.
  const verifyUrl = certificate.certificateId ? appUrl(`/verify/${certificate.certificateId}`) : null

  return (
    <>
      <Topbar 
        title="Certificate" 
        breadcrumbOverrides={{ 
          [courseId]: certificate.courseTitle,
          certificate: "Certificate"
        }} 
      />
      <CertificateClient data={certificate} verifyUrl={verifyUrl} />
    </>
  )
}
```

- [ ] **Step 6: Verify — static.**
  1. tsc (filtered). Then `npx eslint lib/brand.ts lib/actions/certificates.ts components/learn/certificate-view.tsx "app/(platform)/dashboard/courses/[courseId]/certificate/page.tsx"` → only the 3 baseline `@next/next/no-img-element` warnings in `certificate-view.tsx` (their line numbers move). The signatory uses `next/image`, so it adds none.
  2. `grep -c 'slice(-8)' components/learn/certificate-view.tsx` → `1` (only `printedCertificateId`).
  3. `grep -o 'COMPLETING THE COURSE\|completing the course' components/learn/certificate-view.tsx | wc -l` → `0`.

- [ ] **Step 7: Verify — runtime.** Preflight; `node "$H/mockdb.cjs" restore`.

[audit: `markCourseComplete` now refuses until every open published lesson is done (commit 3de21ee), so the executive package's three fixture lessons must be marked complete — via `markLessonComplete`, the Finish button's per-lesson action — before `markCourseComplete` will succeed. Added the `LE`/`LS` captures and the `MLC` completion pass below; same fix as Task 1 Step 7.2.]

```bash
FX=$(node "$H/mockdb.cjs" fixture executive)
N=$(node -e 'console.log(JSON.parse(process.argv[1]).enrollmentId)' "$FX")
LE=$(node -e 'console.log(JSON.parse(process.argv[1]).lessons.everyone)' "$FX")
LS=$(node -e 'console.log(JSON.parse(process.argv[1]).lessons.standard)' "$FX")
LX=$(node -e 'console.log(JSON.parse(process.argv[1]).lessons.executive)' "$FX")
MLC=$(PRINT_ID=1 bash "$H/action.sh" "/dashboard/courses/$F/learn/$LE" markLessonComplete '[]')
post "$MLC" "/dashboard/courses/$F/learn/$LE" student "[\"$F\",\"$LE\"]"
post "$MLC" "/dashboard/courses/$F/learn/$LS" student "[\"$F\",\"$LS\"]"
post "$MLC" "/dashboard/courses/$F/learn/$LX" student "[\"$F\",\"$LX\"]"
MCC=$(PRINT_ID=1 bash "$H/action.sh" "/dashboard/courses/$F/learn/$LX" markCourseComplete '[]')
post "$MCC" "/dashboard/courses/$F/learn/$LX" student "[\"$F\"]"
X=$(node "$H/mockdb.cjs" certs | grep "$N" | sed -n 's/.*cert="\(WSA-[0-9A-Z]*\)".*/\1/p'); echo "$X"
PAGE=$(curl -s -b mock_persona=student "http://localhost:3001/dashboard/courses/$F/certificate" | strip)
```

  1. Counts over `$PAGE` (`grep -o '<text>' <<<"$PAGE" | wc -l`):
     - `Certificate ID $X` → 1
     - `Certificate ID: $X` → 1
     - `Verify at [^<]*/verify/$X` → 1
     - `href="[^"]*/verify/$X"` → 1
     - `for successfully completing the program` → 1
     - `completing the course` → 0
     - `School of Trading &amp; Financial Markets` → 1
     - `WorldStreet Mastery Academy` → ≥ 1
     - `Authorized signatory` → 0
     - `Verified` → ≥ 1 (the seal)
  2. **Legacy fallback.** `node "$H/mockdb.cjs" set-status 6a6fe33862cf63ed050e56c6 completed`. On `curl -s -b mock_persona=student "http://localhost:3001/dashboard/courses/$BTC/certificate" | strip`:
     - `Certificate ID: WSA-050E56C6` → 1
     - `Verify at` → 0
     - `/verify/` → 0
     - `School of` → 0
  3. **Phase 3 gate intact.** `set-package $N basic` → `Certificate ID` on the Forex certificate page → 0. Then `set-package $N executive`.
  4. **Signatory slot** (temporary edit — never committed).
     - In `lib/brand.ts` set `const SIGNATORY: Signatory = { name: "Test Signatory", title: "Director", imagePath: "/brand/wsa-mark.png" }`.
     - Reload the Forex certificate page: `Test Signatory` → 1, `Director` → 1, `Verified` → 0.
     - **Revert** to `{ name: null, title: null, imagePath: null }`, then confirm with `grep -c "name: null, title: null, imagePath: null" lib/brand.ts` → `1`.
  5. **PDF export** (browser, student).
     - `node "$H/mockdb.cjs" set-signature $INSTRUCTOR /brand/wsa-mark.png` (it enables Download).

```bash
$B viewport 1280x900
$B goto "http://localhost:3001/dashboard/courses/$F/certificate"
$B wait --load
$B js "window.__pdf = null; const o = URL.createObjectURL; URL.createObjectURL = (b) => { b.text().then((t) => { window.__pdf = t }); return o.call(URL, b) }; [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Download PDF')).click(); 'clicked'"
$B js "window.__pdf ? ['FOR SUCCESSFULLY COMPLETING THE PROGRAM', 'CERTIFICATE ID $X', 'Verify at ', '/verify/$X', 'School of Trading'].map((s) => window.__pdf.includes(s)).join(',') : 'pending'"
$B console --errors
```

     - Repeat the second `js` while it prints `pending` → `true,true,true,true,true`.
     - `console --errors` → nothing from the certificate page.
     - If jsPDF's output can't be captured this way (no blob URL, or encoded text), say so and rely on the console check plus Step 6.
  6. **Phone width.** `$B viewport 400x800`, `goto` the Forex certificate page, `wait --load`, `$B js "document.body.scrollWidth + '/' + window.innerWidth"` → `400/400`. Then `$B screenshot --viewport "$P6/t3-certificate-400.png"` and look: the ID and verify lines sit under the signature row without overlapping it.
  7. End: `node "$H/mockdb.cjs" restore` (it also removes the test signature).

- [ ] **Step 8: Commit.**

```bash
git add lib/brand.ts lib/actions/certificates.ts components/learn/certificate-view.tsx "app/(platform)/dashboard/courses/[courseId]/certificate/page.tsx"
git commit -m "feat(certificates): print stored ID, program + school and verify URL; program wording; dormant Academy signatory slot

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Public verification — `verifyCertificate` + `/verify/[certificateId]`

**Files:**
- Modify: `lib/actions/certificates.ts` (import; new type + action directly above the `INSTRUCTOR ACTIONS` banner)
- Create: `app/(marketing)/verify/[certificateId]/page.tsx`

**Interfaces:**
- Consumes:
  - `normalizeCertificateId` (Task 1);
  - the partial index on `certificateId` (Task 1);
  - `SCHOOL_BY_SLUG`, `isSchoolSlug` (imported into this file by Task 3);
  - `entitlementsFor` (Phase 3).
- Produces:
  - `type VerifiedCertificate = { certificateId: string; studentName: string; programName: string; schoolName: string | null; completedAt: string; instructorName: string }`
  - `verifyCertificate(certificateId: string): Promise<VerifiedCertificate | null>`: public, no auth, names and dates only.
  - Route `/verify/<id>`: public (outside the middleware matcher `/dashboard|/instructor|/admin`), RSC, `revalidate = 0`, noindex.

- [ ] **Step 1: Lookup.** In `lib/actions/certificates.ts`:
  - under `import { SCHOOL_BY_SLUG, isSchoolSlug } from "@/lib/schools"` add `import { normalizeCertificateId } from "@/lib/certificate-id"`;
  - directly above

```ts
// ============================================================================
// INSTRUCTOR ACTIONS
// ============================================================================
```

   insert:

```ts
// ============================================================================
// PUBLIC VERIFICATION (spec §13)
// ============================================================================

export type VerifiedCertificate = {
  certificateId: string
  studentName: string
  programName: string
  /** null for a course without a school */
  schoolName: string | null
  completedAt: string
  /** "" when the instructor account no longer exists */
  instructorName: string
}

/**
 * Public lookup behind /verify/[certificateId] — no auth. A certificate
 * verifies only while its enrollment is completed, its package includes the
 * certificate, and the ID is stored on the enrollment (legacy IDs count once
 * backfilled). The instructor's signature is not required: it attests
 * completion, and a later signature change must not revoke issued PDFs.
 * Returns names, program and dates only — never an email or a database id.
 */
export async function verifyCertificate(certificateId: string): Promise<VerifiedCertificate | null> {
  try {
    const id = normalizeCertificateId(certificateId)
    if (!id) return null

    await connectDB()

    // $type repeats the partial unique index's filter so this lookup can use it.
    const enrollment = await Enrollment.findOne({
      certificateId: { $eq: id, $type: "string" },
      status: "completed",
    })
      .select("user course completedAt packageKey certificateId")
      .lean()
    if (!enrollment || !enrollment.completedAt || !enrollment.certificateId) return null

    const [course, student] = await Promise.all([
      Course.findById(enrollment.course)
        .select("title school packages instructor")
        .populate("instructor", "firstName lastName")
        .lean(),
      User.findById(enrollment.user).select("firstName lastName").lean(),
    ])
    if (!course || !student) return null

    // The same gate as fetchCertificate: packages without the certificate never certify.
    if (!entitlementsFor(course, enrollment).certificate) return null

    const instructor = course.instructor as unknown as { firstName?: string; lastName?: string } | null

    return {
      certificateId: enrollment.certificateId,
      studentName: `${student.firstName} ${student.lastName ?? ""}`.trim(),
      programName: course.title,
      schoolName: isSchoolSlug(course.school) ? SCHOOL_BY_SLUG[course.school].name : null,
      completedAt: enrollment.completedAt.toISOString(),
      instructorName: instructor ? `${instructor.firstName ?? ""} ${instructor.lastName ?? ""}`.trim() : "",
    }
  } catch (error) {
    console.error("Verify certificate error:", error)
    return null
  }
}
```

   (If tsc rejects `$type` inside the filter, keep it and cast the filter object `as Parameters<typeof Enrollment.findOne>[0]`. Say so in the report; never drop the operator.)

- [ ] **Step 2: Page.** Create `app/(marketing)/verify/[certificateId]/page.tsx`:

```tsx
import type { Metadata } from "next"
import Link from "next/link"
import { BadgeCheckIcon, CircleAlertIcon } from "lucide-react"
import { verifyCertificate } from "@/lib/actions/certificates"
import { BRAND } from "@/lib/brand"

// Certificates are issued and revoked (refunds) at any moment — never cache.
export const revalidate = 0

type Params = { params: Promise<{ certificateId: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { certificateId } = await params
  return {
    title: `Certificate ${certificateId.trim().toUpperCase().slice(0, 40)}`,
    description: `Check that a ${BRAND.name} certificate is genuine.`,
    // Verification pages carry student names — never index them.
    robots: { index: false },
  }
}

/** UTC, like the certificate itself — paper and this page show the same day. */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  })
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-ws-subtle">{label}</dt>
      <dd className="mt-1 break-words text-[15px] font-medium text-ws-primary">{value}</dd>
    </div>
  )
}

/**
 * `/verify/[certificateId]` — spec §13 made checkable. Public (no auth), RSC,
 * noindex. The ID is read case-insensitively; an unknown, revoked or
 * non-certifying ID reads "No certificate with this ID" (HTTP 200).
 */
export default async function VerifyCertificatePage({ params }: Params) {
  const { certificateId } = await params
  const certificate = await verifyCertificate(certificateId)
  const lookedUp = certificateId.trim().toUpperCase().slice(0, 40)

  return (
    <div className="mx-auto max-w-3xl px-6 pb-24 pt-10 md:pb-32 md:pt-16">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ws-gold">Certificate verification</p>
      <h1
        className="mt-4 font-display font-semibold leading-[1.05] tracking-[-0.02em] text-ws-primary"
        style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)" }}
      >
        Verify a certificate
      </h1>
      <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ws-muted md:text-[17px]">
        Every {BRAND.name} certificate carries a unique ID. This page checks it against our records.
      </p>

      {certificate ? (
        <section aria-labelledby="certificate-heading" className="mt-10 rounded-lg bg-ws-surface p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              id="certificate-heading"
              className="font-mono text-[15px] tabular-nums tracking-wide text-ws-primary"
            >
              {certificate.certificateId}
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ws-success/10 px-2.5 py-1 text-[12px] font-semibold text-ws-success">
              <BadgeCheckIcon size={14} aria-hidden />
              Valid
            </span>
          </div>
          <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
            <Field label="Student" value={certificate.studentName} />
            <Field label="Program" value={certificate.programName} />
            {certificate.schoolName && <Field label="School" value={certificate.schoolName} />}
            <Field label="Completed" value={formatDate(certificate.completedAt)} />
            {certificate.instructorName && <Field label="Instructor" value={certificate.instructorName} />}
          </dl>
          <p className="mt-6 border-t border-ws-hairline pt-4 text-[13px] leading-relaxed text-ws-muted">
            This certificate was issued by {BRAND.name} and matches our records.
          </p>
        </section>
      ) : (
        <section aria-labelledby="certificate-heading" className="mt-10 rounded-lg bg-ws-surface p-6 md:p-8">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ws-danger/10 text-ws-danger">
              <CircleAlertIcon size={18} aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 id="certificate-heading" className="font-display text-lg font-semibold text-ws-primary">
                No certificate with this ID
              </h2>
              <p className="mt-1 break-all font-mono text-[13px] tabular-nums text-ws-muted">{lookedUp}</p>
              <p className="mt-3 text-[14px] leading-relaxed text-ws-muted">
                Check the ID printed at the bottom of the certificate: {BRAND.certificatePrefix}- followed by eight
                letters and numbers.
              </p>
            </div>
          </div>
        </section>
      )}

      <Link
        href="/schools"
        className="mt-10 inline-flex h-11 items-center justify-center rounded-sm border border-ws-hairline px-6 text-[14px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:border-ws-brand/40 hover:text-ws-gold"
      >
        Explore the schools
      </Link>
    </div>
  )
}
```

- [ ] **Step 3: Verify.**
  - tsc (filtered); `npx eslint lib/actions/certificates.ts "app/(marketing)/verify/[certificateId]/page.tsx"` → no output.
  - Preflight; `node "$H/mockdb.cjs" restore`.
  - Data: same as Task 3 Step 7's first block, as repaired there (`FX`, `N`, `LE`, `LS`, `LX`, `MLC`, `MCC`, `post`, `X`) — the lesson-completion pass is required before `markCourseComplete` succeeds. Then:

```bash
V=$(curl -s -b mock_persona=guest "http://localhost:3001/verify/$X"); VS=$(strip <<<"$V")
D=$(node -e 'console.log(new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric",timeZone:"UTC"}))')
```

  1. **Valid (guest).**
     - `curl -s -o /dev/null -w "%{http_code}\n" -b mock_persona=guest "http://localhost:3001/verify/$X"` → `200`.
     - Counts over `$VS`:
       - `>Valid</span>` → 1
       - `Johnson Demo` → 1
       - `Forex Trading Mastery` → 1
       - `School of Trading &amp; Financial Markets` → 1
       - `Sarah Chen` → ≥ 1
       - `$D` → 1
       - `No certificate with this ID` → 0
  2. **Public-safe.** Over the **raw** `$V` (RSC payload included):
     - `student@worldstreet.academy` → 0
     - `$STUDENT` → 0
     - `$N` → 0
     - `<meta name="robots" content="noindex` → 1
  3. **Case-insensitive.** `/verify/$(tr 'A-Z' 'a-z' <<<"$X")` → `>Valid</span>` 1.
  4. **Unknown and malformed.**
     - `/verify/WSA-ZZZZZZZZ` → `No certificate with this ID` 1 and `WSA-ZZZZZZZZ` ≥ 1.
     - `/verify/hello` → `No certificate with this ID` 1 and `HELLO` ≥ 1.
  5. **Entitlement and status gates.**
     - `set-package $N basic` → `/verify/$X` shows `No certificate with this ID`.
     - `set-package $N executive` → `Valid`.
     - `set-status $N refunded` → `No certificate with this ID`.
     - `set-status $N completed` → `Valid`.
  6. **Legacy only when stored.**
     - `set-status 6a6fe33862cf63ed050e56c6 completed` → `/verify/WSA-050E56C6` shows `No certificate with this ID`.
     - `set-certificate-id 6a6fe33862cf63ed050e56c6 WSA-050E56C6` → `Valid`, with `>School</dt>` → 0 (bitcoin has no school).
  7. **Index use.** This passes the local URI as an argument, never via the environment:

```bash
node -e '
const mongoose = require("mongoose")
;(async () => {
  await mongoose.connect(process.argv[1])
  const plan = await mongoose.connection.db.collection("enrollments")
    .find({ certificateId: { $eq: process.argv[2], $type: "string" }, status: "completed" })
    .explain("queryPlanner")
  console.log(JSON.stringify(plan.queryPlanner.winningPlan).includes("certificateId_1") ? "IXSCAN certificateId_1" : "NO INDEX")
  await mongoose.disconnect()
})()' "$LOCAL_URI" "$X"
```

     → `IXSCAN certificateId_1`.
  8. **Phone width.**
     - `$B viewport 400x800`, `$B goto "http://localhost:3001/verify/$X"`, `$B wait --load`, `$B js "document.body.scrollWidth + '/' + window.innerWidth"` → `400/400`; `$B screenshot --viewport "$P6/t4-verify-valid-400.png"`.
     - Repeat for `/verify/WSA-ZZZZZZZZ` → `400/400`; `$B screenshot --viewport "$P6/t4-verify-unknown-400.png"`.
     - Look: the "Valid" chip is success green on a faint green wash, no gold except the eyebrow, and one column on the phone.
  9. End: `node "$H/mockdb.cjs" restore`.

- [ ] **Step 4: Commit.**

```bash
git add lib/actions/certificates.ts "app/(marketing)/verify/[certificateId]/page.tsx"
git commit -m "feat(certificates): public /verify/[certificateId] page with entitlement-gated, public-safe lookup

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Testimonials show country — student country card, `LandingReview.country`, Name · Country · Program caption

**Files:**
- Modify: `lib/actions/profile.ts` (imports; append `getMyCountry`, `updateMyCountry`)
- Create: `components/platform/country-card.tsx`
- Modify: `app/(platform)/dashboard/profile/page.tsx` (one import; render the card above the signature card)
- Modify: `lib/actions/reviews.ts` (import; the `LandingReview` type + `fetchLandingReviews` block)
- Modify: `components/marketing/reviews-finale.tsx` (the `ReviewCard` figcaption name/program block)

**Interfaces:**
- Consumes (**from Phase 5**): `User.country: string | null` on the user document and `IUser`; `lib/countries.ts` exports `COUNTRY_CODES: readonly string[]`, `countryName(code: string | null | undefined): string | null`, `type CountryOption = { value: CountryCode; label: string }` and `countryOptions(): CountryOption[]` (every country as a select option, sorted by English name).
  - `COUNTRY_CODES`/`countryName` (for `updateMyCountry`'s validation) and `countryOptions` (for `CountryCard`'s options list — reused, not reimplemented) must all be importable from a client component (pure data + `Intl.DisplayNames`; `lib/countries.ts`'s own header calls itself client-safe). If Phase 5 made that module server-only, stop and report.
- Produces:
  - `getMyCountry(): Promise<string | null>`, the ISO code.
  - `updateMyCountry(country: string | null): Promise<{ success: true } | { success: false; error: string }>`, where the input is an ISO code from `COUNTRY_CODES`, or null to clear.
  - `CountryCard()`, a client component with no props.
  - `LandingReview.country: string | null`, the **display name** (e.g. "Nigeria"), resolved on the server.

- [ ] **Step 1: Actions.** In `lib/actions/profile.ts`:
  - under `import { revalidatePath } from "next/cache"` add the two imports below. If Phase 5 already imports either, reuse it.

```ts
import { z } from "zod/v4"
import { COUNTRY_CODES } from "@/lib/countries"
```

  - append at the end of the file:

```ts
/**
 * The current user's country (ISO-3166 alpha-2). Null when unset or signed out.
 */
export async function getMyCountry(): Promise<string | null> {
  try {
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) return null

    const user = await User.findById(currentUser.id).select("country").lean()
    return user?.country ?? null
  } catch (error) {
    console.error("Get country error:", error)
    return null
  }
}

const CountryInput = z
  .string()
  // Widened: Phase 5 may type the list as a literal tuple, whose .includes() rejects a plain string.
  .refine((code) => (COUNTRY_CODES as readonly string[]).includes(code), "Choose a country from the list")
  .nullable()

/**
 * Set or clear the current user's country — shown next to their name on
 * homepage testimonials (spec §14). Kept apart from updateProfile, which the
 * faculty editor extends.
 */
export async function updateMyCountry(
  country: string | null
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const parsed = CountryInput.safeParse(country)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Choose a country from the list" }
    }

    await User.findByIdAndUpdate(currentUser.id, { $set: { country: parsed.data } })

    revalidatePath("/dashboard/profile")
    revalidatePath("/")
    return { success: true }
  } catch (error) {
    console.error("Update country error:", error)
    return { success: false, error: "Failed to update country" }
  }
}
```

- [ ] **Step 2: Card.** Create `components/platform/country-card.tsx`:

```tsx
"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { CheckIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getMyCountry, updateMyCountry } from "@/lib/actions/profile"
import { countryOptions } from "@/lib/countries"
import { BRAND } from "@/lib/brand"

/**
 * The student's country (spec §14): shown next to their name when one of their
 * reviews appears in the homepage testimonials. Saves on selection.
 *
 * `countryOptions()` is Phase 5's (`lib/countries.ts`) — same sorted
 * value/label list the faculty editor uses, not reimplemented here. Its own
 * doc comment prefers a server-computed call (Node's ICU data can name a
 * country slightly differently from the browser's); calling it client-side
 * here is a deliberate, cosmetic-risk-only exception so this card stays a
 * self-contained, prop-free component.
 */
export function CountryCard() {
  const [country, setCountry] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const items = useMemo(() => countryOptions(), [])

  useEffect(() => {
    getMyCountry().then((code) => {
      setCountry(code)
      setLoaded(true)
    })
  }, [])

  function save(next: string | null) {
    const previous = country
    setCountry(next)
    setSaved(false)
    setError(null)
    startTransition(async () => {
      const result = await updateMyCountry(next)
      if (result.success) {
        setSaved(true)
      } else {
        setCountry(previous)
        setError(result.error)
      }
    })
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Country</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Shown next to your name when your review appears on the {BRAND.name} homepage.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            items={items}
            value={country}
            onValueChange={(value) => save((value as string | null) ?? null)}
            disabled={!loaded || isPending}
          >
            <SelectTrigger className="w-full sm:w-72" aria-label="Country">
              <SelectValue placeholder={loaded ? "Choose your country" : "Loading…"} />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {country && (
            <Button variant="ghost" size="sm" disabled={isPending} onClick={() => save(null)}>
              Remove
            </Button>
          )}
          {saved && !isPending && (
            <p className="text-xs text-ws-success flex items-center gap-1">
              <CheckIcon size={14} />
              Saved
            </p>
          )}
        </div>
        {error && <p className="text-xs text-ws-danger">{error}</p>}
      </CardContent>
    </Card>
  )
}
```

   (If the local `Select` wrapper's types reject `value`, `onValueChange` or `disabled` as written, mirror the `Select` usage in `app/(admin)/admin/enrollments/page.tsx` (Phase 3 Task 7) exactly and say so.)

- [ ] **Step 3: Profile page.** In `app/(platform)/dashboard/profile/page.tsx`:
  - under `import { SignatureCanvas } from "@/components/shared/signature-canvas"` add `import { CountryCard } from "@/components/platform/country-card"`;
  - replace `        {/* ── Signature card ──────────────────────────────────── */}` with:

```tsx
        {/* ── Country card (spec §14 testimonials) ─────────────── */}
        <CountryCard />

        {/* ── Signature card ──────────────────────────────────── */}
```

- [ ] **Step 4: Landing reviews.** In `lib/actions/reviews.ts`:
  - under `import { z } from "zod/v4"` add `import { countryName } from "@/lib/countries"`;
  - replace everything from `export type LandingReview = {` through the closing `}` of `fetchLandingReviews` with the block below. Only the country lines are new; the doc comment and sort stay as they are for Task 6.

```ts
export type LandingReview = {
  id: string
  rating: number
  title: string | null
  content: string
  reviewerName: string
  reviewerAvatarUrl: string | null
  /** Reviewer's country as an English display name ("Nigeria"); null when they haven't set one (spec §14). */
  country: string | null
  courseTitle: string
  courseId: string
  courseSlug: string
}

/**
 * Real testimonials for the landing page: approved 4–5★ reviews that actually
 * say something, best-first. The landing hides the section below 3 — the same
 * floors principle as its stats. Nothing here is ever typed in by hand.
 */
export async function fetchLandingReviews(limit = 6): Promise<LandingReview[]> {
  try {
    await connectDB()

    const reviews = await Review.find({
      isApproved: true,
      isHidden: false,
      rating: { $gte: 4 },
      content: { $nin: [null, ""] },
    })
      .populate("user", "firstName lastName avatarUrl country")
      .populate("course", "title status slug")
      .sort({ rating: -1, helpfulCount: -1, createdAt: -1 })
      .limit(limit * 2) // room to drop reviews of unpublished courses below
      .lean()

    return reviews
      .map((r) => {
        const user = r.user as unknown as {
          firstName?: string
          lastName?: string
          avatarUrl?: string | null
          country?: string | null
        } | null
        const course = r.course as unknown as {
          _id: { toString(): string }
          title?: string
          status?: string
          slug?: string
        } | null
        if (!course || course.status !== "published") return null
        const name = user
          ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
          : ""
        return {
          id: r._id.toString(),
          rating: r.rating,
          title: r.title ?? null,
          content: r.content ?? "",
          reviewerName: name || "WorldStreet learner",
          reviewerAvatarUrl: user?.avatarUrl ?? null,
          country: countryName(user?.country),
          courseTitle: course.title ?? "",
          courseId: course._id.toString(),
          courseSlug: course.slug ?? "",
        }
      })
      .filter((r): r is LandingReview => r !== null && r.content.length > 0)
      .slice(0, limit)
  } catch (error) {
    console.error("Fetch landing reviews error:", error)
    return []
  }
}
```

- [ ] **Step 5: Caption.** In `components/marketing/reviews-finale.tsx`, `ReviewCard`, replace

```tsx
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-medium text-ws-primary">
            {review.reviewerName}
          </span>
          <Link
            href={`/programs/${review.courseSlug}`}
            className="block truncate text-[12px] text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-gold"
          >
            on {review.courseTitle}
          </Link>
        </span>
```

   with

```tsx
        {/* Spec §14: Name · Country · Program — country only when the student set one. */}
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-medium text-ws-primary">
            {review.reviewerName}
            {review.country && (
              <span className="font-normal text-ws-muted">{` · ${review.country}`}</span>
            )}
          </span>
          <Link
            href={`/programs/${review.courseSlug}`}
            className="block truncate text-[12px] text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-gold"
          >
            {review.courseTitle}
          </Link>
        </span>
```

- [ ] **Step 6: Verify.**
  - tsc (filtered); `npx eslint lib/actions/profile.ts components/platform/country-card.tsx "app/(platform)/dashboard/profile/page.tsx" lib/actions/reviews.ts components/marketing/reviews-finale.tsx` → only the 1 baseline `no-img-element` warning in the profile page.
  - Preflight; `node "$H/mockdb.cjs" restore`; `node "$H/mockdb.cjs" review-fixture`.
  - Define:

```bash
testimonials() { curl -s -b mock_persona=guest http://localhost:3001/ | perl -0pe 's/<script\b.*?<\/script>//gs; s/.*Real people\. Real learning experiences\.//s; s/Your next level starts with.*//s'; }
```

  1. `bash "$H/action.sh" "/dashboard/profile" getMyCountry '[]'` → `null`.
  2. `updateMyCountry '["NG"]'` (same page) → `{"success":true}`; `getMyCountry '[]'` → `"NG"`.
  3. `updateMyCountry '["ZZ"]'` → `{"success":false,"error":"Choose a country from the list"}`; `getMyCountry` still `"NG"`.
  4. Counts over `testimonials`:
     - `Johnson Demo<span class="font-normal text-ws-muted"> · Nigeria</span>` → 1
     - `Ada Admin<span` → 0
     - `Sarah Chen<span` → 0
     - `Forex Trading Mastery` → ≥ 1
     - `>on ` → 0
     - `Useful, though` → 0 (the 3★ review stays below the floor)
  5. `updateMyCountry '[null]'` → `{"success":true}`; `Johnson Demo<span` in `testimonials` → 0.
  6. **Phone width** (student).
     - `$B viewport 400x800`, `$B goto http://localhost:3001/dashboard/profile`, `$B wait --load`, `$B js "document.body.scrollWidth + '/' + window.innerWidth"` → `400/400`.
     - `$B js "document.querySelector('[aria-label=Country]').click(); 'open'"`, then `$B js "document.querySelectorAll('[data-slot=select-item]').length"` → equals `COUNTRY_CODES.length`, or report the number.
     - `$B screenshot --viewport "$P6/t5-profile-country-400.png"`.
  7. End: `node "$H/mockdb.cjs" restore` (it deletes the fixture reviews and unsets the country).

- [ ] **Step 7: Commit.**

```bash
git add lib/actions/profile.ts components/platform/country-card.tsx "app/(platform)/dashboard/profile/page.tsx" lib/actions/reviews.ts components/marketing/reviews-finale.tsx
git commit -m "feat(testimonials): students set their country; homepage testimonials read Name · Country · Program

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Admin-curated homepage testimonials — `Review.featured`, featured-first ordering, "Feature on homepage" toggle

**Files:**
- Modify: `lib/db/models/review.ts` (interface after `isHidden`; schema after `isHidden`)
- Modify: `lib/actions/reviews.ts` (`fetchLandingReviews` doc comment + sort line only)
- Modify: `lib/actions/admin-courses.ts` (zod import; `AdminReviewRow`; `adminListReviews` filter + mapping; new `adminSetReviewFeatured`)
- Modify: `app/(admin)/admin/reviews/page.tsx` (import; `Filter`; feature mutation; subline; chip; empty-state copy; badge; row buttons)

**Interfaces:**
- Consumes: `fetchLandingReviews` / `LandingReview` as left by Task 5; `requireAdmin` (`@/lib/auth/admin`).
- Produces:
  - `IReview.featured: boolean` (schema default false; rows without the field read as not featured).
  - `adminSetReviewFeatured(reviewId: string, featured: boolean): Promise<{ success: boolean; error?: string }>`. It is the same result shape as `adminSetReviewModeration`, and it refuses to feature a review below the landing floor (ruling 16).
  - `AdminReviewRow.featured: boolean`; `adminListReviews` accepts `filter: "all" | "reported" | "hidden" | "featured"`.
  - `fetchLandingReviews` order: `featured` desc → `rating` desc → `helpfulCount` desc → `createdAt` desc, inside the unchanged floor.

- [ ] **Step 1: Model.** In `lib/db/models/review.ts`:
  - in `IReview` replace `  isHidden: boolean` with:

```ts
  isHidden: boolean
  /** Admin-curated: featured reviews lead the homepage testimonials (spec §14). Never bypasses the landing's floor. */
  featured: boolean
```

  - in the schema replace

```ts
    isHidden: {
      type: Boolean,
      default: false,
    },
    helpfulCount: {
```

   with

```ts
    isHidden: {
      type: Boolean,
      default: false,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    helpfulCount: {
```

   Then tell the controller: **controller restarts dev server** (schema change). Continue meanwhile.

- [ ] **Step 2: Ordering.** In `lib/actions/reviews.ts`:
  - replace

```ts
/**
 * Real testimonials for the landing page: approved 4–5★ reviews that actually
 * say something, best-first. The landing hides the section below 3 — the same
 * floors principle as its stats. Nothing here is ever typed in by hand.
 */
```

   with

```ts
/**
 * Real testimonials for the landing page (spec §14): approved, visible 4–5★
 * reviews that actually say something. Admin-featured reviews come first (so
 * the homepage six are curated), then the best-rated. Featuring never bypasses
 * this floor, and nothing here is ever typed in by hand.
 */
```

  - replace `      .sort({ rating: -1, helpfulCount: -1, createdAt: -1 })` with:

```ts
      .sort({ featured: -1, rating: -1, helpfulCount: -1, createdAt: -1 })
```

- [ ] **Step 3: Admin action.** In `lib/actions/admin-courses.ts`:
  - under `import { revalidatePath } from "next/cache"` add `import { z } from "zod/v4"`;
  - in `AdminReviewRow` replace

```ts
  isHidden: boolean
  reportCount: number
```

   with

```ts
  isHidden: boolean
  featured: boolean
  reportCount: number
```

  - in `adminListReviews`:
    - change `filter?: "all" | "reported" | "hidden"` to `filter?: "all" | "reported" | "hidden" | "featured"`;
    - directly under `    if (filters?.filter === "hidden") query.isHidden = true` add `    if (filters?.filter === "featured") query.featured = true`;
    - in the row mapping, directly under `          isHidden: r.isHidden,` add `          featured: r.featured ?? false,`.
  - directly above `/** Ensure the User model is registered before populate("instructor") in serverless cold paths. */` insert:

```ts
const FeatureReviewInput = z.object({
  reviewId: z.string().regex(/^[a-f0-9]{24}$/),
  featured: z.boolean(),
})

/**
 * Curate the homepage testimonials (spec §14). Only a review the landing can
 * actually show — approved, visible, 4–5★, with text — can be featured, so the
 * toggle never promises something the homepage won't render.
 */
export async function adminSetReviewFeatured(reviewId: string, featured: boolean) {
  try {
    await connectDB()
    await requireAdmin()

    const parsed = FeatureReviewInput.safeParse({ reviewId, featured })
    if (!parsed.success) return { success: false, error: "Invalid review" }

    const review = await Review.findById(parsed.data.reviewId)
    if (!review) return { success: false, error: "Review not found" }

    if (
      parsed.data.featured &&
      (!review.isApproved || review.isHidden || review.rating < 4 || !review.content?.trim())
    ) {
      return { success: false, error: "Only approved, visible 4–5★ reviews with text can be featured" }
    }

    review.featured = parsed.data.featured
    await review.save()

    revalidatePath("/admin/reviews")
    revalidatePath("/")
    return { success: true }
  } catch (error) {
    console.error("Admin feature review error:", error)
    return { success: false, error: "Failed to update review" }
  }
}
```

- [ ] **Step 4: Admin page.** In `app/(admin)/admin/reviews/page.tsx`:
  1. Replace

```tsx
import {
  adminListReviews,
  adminSetReviewModeration,
} from "@/lib/actions/admin-courses"
```

   with

```tsx
import {
  adminListReviews,
  adminSetReviewFeatured,
  adminSetReviewModeration,
} from "@/lib/actions/admin-courses"
```

  2. Replace `type Filter = "all" | "reported" | "hidden"` with `type Filter = "all" | "reported" | "hidden" | "featured"`.
  3. Replace

```tsx
    onSettled: () => setActingId(null),
  })

  return (
```

   with

```tsx
    onSettled: () => setActingId(null),
  })

  const feature = useMutation({
    mutationFn: ({ reviewId, featured }: { reviewId: string; featured: boolean }) =>
      adminSetReviewFeatured(reviewId, featured),
    onMutate: ({ reviewId }) => {
      setActingId(reviewId)
      setRowError(null)
    },
    onSuccess: (res, vars) => {
      if (!res.success) {
        setRowError({
          id: vars.reviewId,
          message: ("error" in res && res.error) || "Couldn't update the homepage",
        })
      }
      queryClient.invalidateQueries({ queryKey: ["admin", "reviews"] })
    },
    onError: (_err, vars) => {
      setRowError({ id: vars.reviewId, message: "Couldn't update the homepage — try again." })
    },
    onSettled: () => setActingId(null),
  })

  return (
```

  4. Replace `          subline="Moderate reported or problematic course reviews."` with `          subline="Moderate reviews and choose which ones the homepage features."`.
  5. Replace

```tsx
            { value: "hidden", label: "Hidden" },
            { value: "all", label: "All" },
```

   with

```tsx
            { value: "hidden", label: "Hidden" },
            { value: "featured", label: "Featured" },
            { value: "all", label: "All" },
```

  6. Replace

```tsx
              filter === "reported"
                ? "No reviews have been reported."
                : "No reviews match this filter."
```

   with

```tsx
              filter === "reported"
                ? "No reviews have been reported."
                : filter === "featured"
                  ? "No reviews are featured on the homepage."
                  : "No reviews match this filter."
```

  7. Replace

```tsx
                      {!r.isApproved && (
                        <Badge variant="outline" className="text-[9px]">unapproved</Badge>
                      )}
```

   with

```tsx
                      {!r.isApproved && (
                        <Badge variant="outline" className="text-[9px]">unapproved</Badge>
                      )}
                      {r.featured && (
                        <Badge variant="outline" className="text-[9px]">featured</Badge>
                      )}
```

  8. Replace

```tsx
                  <div className="flex items-center justify-between gap-2 pt-1">
```

   with

```tsx
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
```

   and replace

```tsx
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
```

   with

```tsx
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={actingId === r.id}
                        onClick={() => feature.mutate({ reviewId: r.id, featured: !r.featured })}
                      >
                        {r.featured ? "Remove from homepage" : "Feature on homepage"}
                      </Button>
                      <Button
```

- [ ] **Step 5: Verify** (after the controller confirms the restart).
  - tsc (filtered); `npx eslint lib/db/models/review.ts lib/actions/reviews.ts lib/actions/admin-courses.ts "app/(admin)/admin/reviews/page.tsx"` → no output.
  - Preflight; `node "$H/mockdb.cjs" restore`.
  - Setup:

```bash
R=$(node "$H/mockdb.cjs" review-fixture)
RF=$(node -e 'console.log(JSON.parse(process.argv[1]).forex)' "$R")
RC=$(node -e 'console.log(JSON.parse(process.argv[1]).crypto)' "$R")
RB=$(node -e 'console.log(JSON.parse(process.argv[1]).blockchain)' "$R")
RL=$(node -e 'console.log(JSON.parse(process.argv[1]).low)' "$R")
names() { curl -s -b mock_persona=guest http://localhost:3001/ | perl -0pe 's/<script\b.*?<\/script>//gs; s/.*Real people\. Real learning experiences\.//s; s/Your next level starts with.*//s' | grep -o 'Johnson Demo\|Sarah Chen\|Ada Admin' | tr '\n' ' '; echo; }
```

  1. `names` → `Johnson Demo Sarah Chen Ada Admin`: two 5★ newest-first, then the 4★.
  2. `bash "$H/action.sh" "/admin/reviews" adminSetReviewFeatured "[\"$RC\",true]" admin` → `{"success":true}`; `names` → `Ada Admin Johnson Demo Sarah Chen`.
  3. `bash "$H/action.sh" "/admin/reviews" adminListReviews '[{"filter":"featured"}]' admin` → exactly one row, `"id":"<RC>"` with `"featured":true`.
  4. **The floor holds.**
     - `adminSetReviewFeatured "[\"$RL\",true]"` → `"success":false`, error beginning `Only approved, visible 4`.
     - `adminSetReviewModeration "[\"$RF\",{\"isHidden\":true}]"` → success; then `adminSetReviewFeatured "[\"$RF\",true]"` → the same refusal.
     - `adminSetReviewModeration "[\"$RF\",{\"isHidden\":false}]"`.
     - `adminSetReviewFeatured '["nope",true]'` → `Invalid review`.
  5. **Admins only.** Resolve the id as admin (the id itself is a plain export hash, not a secret — the check is whether the server still enforces the role when the id is used from elsewhere), then call it as the student:
     - `FID=$(PRINT_ID=1 bash "$H/action.sh" "/admin/reviews" adminSetReviewFeatured '[]' admin)`; `post "$FID" "/admin/reviews" student "[\"$RB\",true]"` → `{"success":false,"error":"Failed to update review"}`. Not a redirect: `requireAdmin()` throws for a non-admin caller, and `adminSetReviewFeatured`'s own `try`/`catch` returns that string before ever calling `revalidatePath` — a raw `Next-Action` POST invokes the exported function directly and never re-runs `app/(admin)/layout.tsx`'s `redirect("/dashboard")` gate, which only fires on an actual page render.
     - Check 3's call still lists only `$RC`.
  6. `adminSetReviewFeatured "[\"$RC\",false]"` → success; `names` → `Johnson Demo Sarah Chen Ada Admin`.
  7. **Phone width** (admin).
     - `$B js "document.cookie='mock_persona=admin; path=/'"`, `$B viewport 400x800`, `$B goto http://localhost:3001/admin/reviews`, `$B wait --load`.
     - `$B js "[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'All').click(); 'all'"`.
     - `$B js "document.body.scrollWidth + '/' + window.innerWidth"` → `400/400`; `$B screenshot --viewport "$P6/t6-admin-reviews-400.png"` (the Feature, Hide and Approve buttons wrap, never overflow).
     - Then `$B js "document.cookie='mock_persona=student; path=/'"`.
  8. End: `node "$H/mockdb.cjs" restore`.

- [ ] **Step 6: Commit.**

```bash
git add lib/db/models/review.ts lib/actions/reviews.ts lib/actions/admin-courses.ts "app/(admin)/admin/reviews/page.tsx"
git commit -m "feat(testimonials): admins feature reviews on the homepage; featured first, inside the honesty floor

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Spec and exit-criteria coverage

| Requirement | Where it is met |
|---|---|
| §13 Student name | Printed on the certificate already (`data.studentName`, preview + PDF); verify page "Student" (Task 4) |
| §13 Program | `CertificateData.programName` printed with its school (Task 3); verify page "Program" / "School" (Task 4) |
| §13 Completion date | Printed already, now in UTC (Task 3); verify page "Completed" (Task 4) |
| §13 Certificate ID | Stored on completion (Task 1); legacy IDs stored (Task 2); printed with the verify URL (Task 3); checkable publicly (Task 4) |
| §13 Authorized signature | The instructor signature (existing, still gates download); the Academy signatory slot renders once product supplies it (Task 3, ruling 5) |
| §13 Branding | `BRAND.name` uppercase in preview + PDF (Phase 0, kept); PDF filename from `BRAND` (Task 3) |
| §14 Photo · Name · Country · Program · Testimonial | Avatar, name and text existing; country (Task 5); program caption without "on" (Task 5) |
| §14 Never fabricated | Floor unchanged; featuring can't bypass it (Task 6); fixtures mock-only, deleted by `restore` |
| Exit: "Every completed enrollment has a unique `certificateId`" | Tasks 1–2, for **certificate-entitled** completions. Basic completions deliberately get none (ruling 1); report it in that wording |
| Exit: certificate shows the six §13 fields | Task 3 |
| Exit: `/verify/[id]` public and correct | Task 4 |
| Exit: testimonials show country; homepage six admin-curated, never fabricated | Tasks 5–6 |
| Risk 4 (rebrand touches issued certificates) | Notes below |

## Notes for the phase report

- **Product debt (D9).** The Academy signatory's name, title and signature file (e.g. `public/brand/signatory.png`) are not supplied. Set them in `lib/brand.ts` → `SIGNATORY`; until then the instructor signature is the authorized signature.
- **Product copy with no surface yet.** §13's heading "LEARN. COMPLETE. GET RECOGNIZED." and its intro paragraph have no page: Phase 1's homepage order has no certification band. Product decides whether one is wanted.
- **Risk 4.** PDFs already downloaded keep "for successfully completing the course" and the old filename. A re-download shows the program wording and the same ID, once the backfill has stored it.
- **QR (6.3).** None: no dependency. The verify URL is printed as text. A QR needs a dependency approval or a hand-written encoder.
- **Go / mobile (add to §0.4):**
  - Go completion paths don't stamp `certificateId`. Those completions print the legacy fallback. It becomes verifiable after a web re-save of the completion or a backfill re-run (the backfill is idempotent).
  - Go must never write `certificateId: ""`. Omit the field or write null: the unique index covers every string value.
  - Mobile certificate screens should print `certificateId` and fall back to the legacy value.
  - Add §0.4 rows for Go: read `Enrollment.certificateId` (legacy fallback derived) when rendering or verifying certificates on mobile; `Review.featured` and `User.country` are additive.
- **Phase 8 order.**
  1. Deploy. Mongoose `autoIndex` builds `certificateId_1` on first Enrollment use; confirm with `db.enrollments.getIndexes()`.
  2. Dry-run `MONGODB_URI=<prod> node scripts/backfill-certificate-ids.mjs`; review COLLISION lines (two enrollments sharing their last 8 id chars — the skipped one's printed ID belongs to the other; resolve by hand).
  3. Run `--apply` with the same explicit URI.
  4. Re-run after the Go patch if mobile completions happened meanwhile.
- **Revocation.** A refund takes a certificate off `/verify`. Admin suspend/cancel does too while the status is not `completed`; restore brings back the same ID.
- `completeLesson` has no web caller today; it still mints through the shared helper (verified statically, Task 1).

## Self-review

- **Spec coverage:** every §13 field, §14 item and Phase 6 exit criterion maps to a task (table above). Plan 6.1–6.4 map to Tasks 1–3 / 3 / 4 / 5–6. D9 and the QR note are resolved by rulings 5 and 6.
- **Placeholder scan:** every code step carries complete code. The only temporary value (Task 3 Step 7.4's test signatory) is reverted and grep-checked before commit. No "TBD/TODO/similar to".
- **Type consistency:** these names are used identically across tasks:
  - `certificateId: string | null` on `IEnrollment` and `CertificateData`; `certificateId: string` on `VerifiedCertificate`;
  - `generateCertificateId`, `legacyCertificateId`, `normalizeCertificateId`, `saveWithCertificateId(enrollment: IEnrollment)`;
  - `programName`, `schoolName: string | null`; `Signatory`, `BRAND.signatory`;
  - `CertificateClient({ data, verifyUrl })`;
  - `verifyCertificate(certificateId: string): Promise<VerifiedCertificate | null>`;
  - `getMyCountry(): Promise<string | null>`, `updateMyCountry(country: string | null)`;
  - `LandingReview.country: string | null` (display name); `IReview.featured`, `AdminReviewRow.featured`, `adminSetReviewFeatured(reviewId, featured)`;
  - mock-DB commands `certs`, `set-progress`, `set-certificate-id`, `review-fixture`, `set-country`, `set-signature`.
