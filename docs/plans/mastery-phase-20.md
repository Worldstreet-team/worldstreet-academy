# Mastery Academy — Phase 20 Implementation Plan (Marketplace formats and quality control)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Approved Marketplace Creators sell courses, masterclasses, workshops, templates and guides (institutional blueprint §17), and every submission passes four recorded checks before it publishes:
- every marketplace listing carries a **format**, shown on its card and page and filterable on `/marketplace`;
- **templates and guides** are file products: one file in the private bucket, bought exactly like a marketplace course, downloaded by their buyers through a 5-minute signed link, with no lessons;
- **staged quality control**: content, quality, accuracy (or not applicable) and technical checks are recorded one by one, and approval waits for all four on the current content;
- `/sell` explains §17's pipeline and the formats.

**Architecture:**
- **Two pure modules hold the rules.** `lib/course-format.ts` holds formats, file-product limits and labels. `lib/review-checks.ts` holds the four checks, which ones are still outstanding, and the canonical content string the review fingerprint hashes. Both are client-safe and checked with assert scripts.
- **Data is additive on `courses`:** `format`, `productFile` and `review.checks`. There is no new collection and no change to any existing enum.
- **A file product is a marketplace course with no lessons.** Checkout, `purchaseCourse`, the splits, Orders and Enrollments are untouched. The access-granting enrollment *is* ownership. `/dashboard/courses/[courseId]` shows owners a product home with a Download button, instead of a player.
- **The file travels through the course editor's save**, beside the lessons, so there is one save path and one review fingerprint. Uploads are presigned PUTs straight into the private bucket, like assignment submissions.
- **Review.** Each check stores the content fingerprint it was recorded against, which is how "the content changed" is detected. A new admin page, `/admin/courses/[courseId]/review`, records the checks and approves.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict · Mongoose 9 · Zod (`zod/v4`) · Cloudflare R2 through `@aws-sdk/client-s3` (installed) · Tailwind v4 with the WorldStreet design system (`ds/`, `ws-*` tokens) · TanStack Query (admin course list).

**Spec:** `docs/institutional-blueprint.md` §6 (World 2), §17 and §19. **Roadmap:** `docs/institutional-blueprint-plan.md` Phase 20 and decision D30 ("Answered 2026-10-19": templates and guides are built here).

**Branch:** `mastery/phase-20`, cut from `mastery/phase-19` (Track C: 18 → 19 → 20).

## Controller rulings (binding)

1. **Five formats, one new field.**
   - `Course.format` is `"course" | "masterclass" | "workshop" | "template" | "guide" | null`. The roadmap's 20.1 named three formats; templates and guides join them because 20.4 is now built (owner, 2026-10-19).
   - It applies to marketplace courses only. Programs and New Economy courses always store `null`. On a marketplace course, `null` (and a missing field) reads as `"course"`.
   - Always read it through `courseFormatOf`.
   - Course, masterclass and workshop are lesson-based; they differ only in label. Template and guide are **file formats**.
2. **A file product is bought like a marketplace course** (same checkout, `purchaseCourse`, `splitSale`, ESPEE). The money path is not touched (see Global Constraints).
3. **"Owned", not "completed".** A file product is owned while its buyer holds an access-granting enrollment (`active` or `completed`).
   - It never completes, and earns no progress, points or certificate. `markCourseComplete` already refuses a course with no open lessons, so no change is needed there.
   - Learning surfaces skip it: Continue learning, the dashboard hero, In progress and the stat strip.
   - My programs lists it as a download.
   - The single price tier synthesized for a file product carries **no entitlements**, so no page promises instructor Q&A or a certificate for it.
4. **Delivery lives at `/dashboard/courses/[courseId]`.** For an owner (a buyer, the course's creator or an admin), the page renders the product home and returns **before** `getLearnStart` and `fetchPublicCourse`.
   - Buyers therefore keep their download after the listing is closed, suspended or archived, as with "existing enrollments keep access" today.
   - The download is a fresh 5-minute signed GET with an attachment disposition, minted on click. Neither the key nor the URL is ever in a page's HTML.
   - The storage key reaches only the owner's and admins' course editor.
5. **Storage.**
   - Keys are `worldstreet-academy/products/<uploader user id>/<timestamp>-<random>.<ext>`, in `R2_RESOURCES_BUCKET_NAME` only. The prefix is the uploader's, not the course's, so a file can be uploaded before the course's first save.
   - A save accepts a key only if it sits inside the **saving user's** prefix, or equals the course's current key.
   - Every upload and download path checks `hasPrivateResourceBucket()` first and fails closed. Nothing may rely on `R2_RESOURCE_BUCKET`'s fallback to the public bucket.
   - Limits: 100 MB; PDF, EPUB, Word, Excel, PowerPoint, CSV or ZIP.
   - Replaced or abandoned uploads are **not deleted**, because a buyer may be mid-download from the old key. There is no download counter.
6. **The format family locks at first publish.** Once `publishedAt` is set, a course can't switch between lesson-based and file-based, because buyers hold one or the other. Within a family it can switch freely.
   - A draft switched to a file format loses its lessons on save. The editor warns first, as it already does for packages.
   - The instructor edit page maps every field explicitly ("anything dropped gets wiped on save"), so it must carry `format`, `productFile` and `formatLocked`.
7. **"The content changed" = a different review fingerprint.**
   - The fingerprint is SHA-256 over `reviewContentString`: the reviewable course fields, the lessons in order (without ids, because the editor recreates lessons on every save) and the product file's key.
   - Each check stores the fingerprint it was recorded against.
   - **A re-submission keeps a check only if it is cleared (`passed`, or `n/a` for accuracy) on the same fingerprint.** Every other check is reset.
   - **Approval requires all four cleared on the *current* fingerprint.** A creator can still save a pending draft, so an edit made mid-review voids the checks recorded before it.
8. **"Changes" sends the course back at once.**
   - Recording `changes` on any check sets `review.status: "changes_requested"` with `review.note` = `"<Check title>: <note>"`, and tells the creator through the existing notification and email.
   - The remaining checks wait for the re-submission.
   - `adminRequestCourseChanges` is folded into the new `adminRecordReviewCheck` and removed, along with the queue's "Request changes" dialog. Its only caller is that page.
9. **No way around the checks.**
   - `adminSetCourseStatus(…, "published")` and an admin's "Save & Publish" in the course editor refuse a Marketplace Creator's marketplace course (owner role `USER`) unless `review.status === "approved"`.
   - Faculty marketplace courses still publish directly, without review, as today.
   - `hasDeliverable` replaces the "no lessons" gates in both admin paths, so a faculty template can be published.
10. **The review page is new:** `/admin/courses/[courseId]/review`. In the queue, a pending row's actions become one "Open review" link.
11. **Vocabulary.** New strings say **Marketplace Creator**, never seller. Existing "seller" strings stay for the vocabulary pass that runs last. `/sell`'s "How it works" and the new formats band are this phase's own copy.
12. **Drafted copy.** The format blurbs and the check descriptions are drafted from §17, for the owner to sign off. List them in the phase report.
13. **No new persona.** `mocks/` is never committed (the dev-bypass rule). The `student` persona becomes an approved Marketplace Creator by a mock-database write, `instructor` is faculty, `admin` reviews, and `guest` is signed out.
14. **Go note.** Append to the existing §9 of `docs/go-patches-phase-3.md` (the marketplace section). Don't add a new numbered section: every track would be fighting over the next free number.
15. **Shared files with other tracks** (keep both sides when merging):

    | File | Also edited by |
    |---|---|
    | `lib/actions/student.ts`, `lib/dashboard-home.ts` | Phases 12, 15 and 16 (read models, dashboard) |
    | `lib/db/models/course.ts`, `lib/db/models/index.ts` | Phase 14 (`recordings` entitlement), Phases 12, 16 and 18 (barrel) |
    | `components/programs/purchase-panel.tsx`, `components/programs/package-model.ts`, `components/checkout/order-lines.ts` | Phase 14 (a new service row) |
    | `lib/marketplace.ts`, `app/(marketing)/sell/page.tsx`, `app/(marketing)/marketplace/page.tsx` | Phase 13 ("eight schools" copy), and Phase 11's vocabulary pass (last) |
    | `lib/actions/instructor.ts`, `components/instructor/course-editor.tsx` | Phase 19 (same track, earlier), and the vocabulary pass |
    | The docs | Every phase |

## Global Constraints

- **Never touch the money path:**
  - `lib/actions/enrollments.ts`, `lib/actions/manual-payments.ts`, `lib/actions/earnings.ts`
  - `lib/wallet.ts`, `lib/referrals.ts`
  - `lib/db/models/earning.ts`, `lib/db/models/order.ts`, `lib/db/models/enrollment.ts`

  Templates and guides are sold by the existing code, as it is. Money is integer cents through `lib/wallet.ts` and fails closed.
- **Schemas are additive only:** the Go mobile API reads the same MongoDB. No renamed fields, no new enum values on existing fields, no new role values. New enums go on new fields only, written `enum: [null, …]` as the repo does.
- **Server actions** follow this order: `connectDB()` (default export of `@/lib/db`) → auth or ownership → Zod (`import { z } from "zod/v4"`) → mutate → `revalidatePath()` → return `{ success: true, data } | { success: false, error }`.
  - They never throw across the boundary.
  - A `"use server"` file exports **only async functions** (types are fine); constants stay unexported or live in a pure module.
  - Server actions are callable with any arguments, so validate every input.
- **Identity and gates:**
  - User ids come from `getCurrentUser()` (`@/lib/auth/actions`), never from the browser.
  - Admin actions call `requireAdmin()` (`@/lib/auth/admin`), which throws; catch it into the error shape.
  - Role gates live in each route group's `layout.tsx` (`app/(admin)/layout.tsx` already redirects non-admins to `/dashboard`). Middleware stays untouched.
- **Paid files go only to the private bucket** (`R2_RESOURCES_BUCKET_NAME`), never the public one. Check `hasPrivateResourceBucket()` before minting any upload or download URL; without it, refuse.
- **Models** come from the barrel `@/lib/db/models`. `lib/course-format.ts` and `lib/review-checks.ts` may import **types only** from the models (`import type`), because the model imports their values.
- **Code hygiene:** no new dependencies, no `any`, no secrets.
- **UI:**
  - The design system is `ds/`, vendored; never edit it.
  - Use `ws-*` and semantic tokens only, never a hex.
  - Gold is only for primary CTAs, active nav and brand moments. Each page has one gold action: Download on the product home, "Approve & publish" on the review page.
  - Icons come only from `@/components/icons` (`DownloadIcon`, `UploadIcon`, `FileIcon`, `CircleCheckIcon`, `CircleAlertIcon` and `MinusIcon` exist). Never lucide, Hugeicons or emoji.
  - Base UI composition uses the `render` prop, never `asChild`. A Base UI `Select` must be given `items`, or its trigger shows the raw value.
  - Pills, 20 px cards (`rounded-[20px]`), Manrope.
  - Pages inside `(platform)` use `pb-24 md:pb-8`. Use `·` separators, and `tabular-nums` for sizes, counts and prices.
  - Dark is the default theme, and light must read too.
  - RSC-first: `"use client"` only where interaction needs it.
- **Vocabulary (D19):** new strings use **Marketplace Creator**, **plan** and **program** (for Academy offerings). Marketplace items stay "courses". Don't rename existing strings outside this phase's scope.
- **Anchors are quoted text**, never line numbers.
- **Verification:**
  - No test runner exists, and none may be added.
  - Pure rules are checked with a throwaway `node:assert/strict` script in `$SCRATCH`, run with `npx tsx --tsconfig ./tsconfig.json "$SCRATCH/<file>.ts"` from the worktree root, so `@/` resolves.
  - Everything else: `npx tsc --noEmit` (one stale `.next/types` error is not real), `npx eslint <file>` (one file at a time) and driving the route.
  - Write scratch scripts with the Write tool. Bash heredocs break on apostrophes.
- **Commits:** `git add` the named files only. Never stage `mocks/`, `.local-db/` or `.claude/`.

## Review Focus

1. **A buyer keeps the file whatever happens to the listing.** After an admin closes or archives a template, its buyer still opens the product home and gets a download link. Covered in Task 5, step 8.
2. **No private bucket.** With `R2_RESOURCES_BUCKET_NAME` unset, the editor's upload and the product home's download both refuse with their messages. The editor never hangs on a network failure, and nothing falls back to the public bucket. Covered in Task 2, step 9 (upload) and Task 5, step 9 (download).
3. **The file is reachable only through the check.**
   - No page's HTML carries a products key or a signed URL.
   - A signed-in learner who hasn't bought the template is sent to its program page.
   - A save carrying a key from another user's folder is refused.

   Covered in Task 2, step 10 and Task 5, steps 1 and 6.
4. **A save that changes nothing changes nothing.** Re-saving an unchanged template keeps its file and format. Re-submitting unchanged content keeps every passed check, even though the editor recreates the lesson rows. Covered in Task 2, step 11 and Task 7, step 7.
5. **There is no way around the four checks.**
   - An edit made mid-review voids the checks recorded before it.
   - Neither the queue's "Publish" item nor an admin's "Save & Publish" in the editor can publish an unapproved creator's course.
   - A faculty marketplace course still publishes directly.

   Covered in Task 6, steps 7–8 and Task 7, step 8.

## Verification server

The controller fills `<PORT>` and `<DBPORT>` for this track. The worktree has no `.env.local`; that is intended.

```bash
netstat -ano | grep -E ":<PORT>|:<DBPORT>"      # must print nothing first
RESEND_API_KEY=re_disabled_local CLOUDFLARE_REALTIME_API_KEY=disabled-local OPENAI_API_KEY=disabled-local \
ABLY_API_KEY=disabled-local R2_SECRET_ACCESS_KEY=disabled-local WALLET_SERVICE_TOKEN=disabled-local \
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_bG9jYWwuZGV2JA MOCK_DB_PORT=<DBPORT> PORT=<PORT> node scripts/dev-mock.mjs
MONGODB_URI=mongodb://127.0.0.1:<DBPORT>/worldstreet-academy node scripts/mastery-catalogue.mjs --apply
```

**Two bucket modes.** The block above runs with **the bucket off**: the private bucket is unset, so uploads and downloads must refuse.
- **To turn the bucket on**, put `R2_RESOURCES_BUCKET_NAME=wsa-private-placeholder R2_ACCESS_KEY_ID=placeholder CLOUDFLARE_ACCOUNT_ID=placeholder` in front of `node scripts/dev-mock.mjs`.
- Signing is offline, so the actions mint real-looking URLs, but R2 is never reached. Playwright fulfils those requests, as below.
- The values are read at start-up, so restart to switch modes. The mock database persists in `.local-db/`, so fixtures survive restarts.

**Personas.** Switch personas with the `mock_persona` cookie: `guest` (signed out), `student`, `instructor` or `admin`. With no cookie you are `student`. Stop the server when the phase is done.

**Helpers.** Create one scratch directory outside the repository, once (`mktemp -d`), and reuse its literal path as `$SCRATCH`, because shell variables don't survive between tool calls.

```bash
BASE=http://localhost:<PORT>
text() { curl -s ${2:+-b "mock_persona=$2"} "$BASE$1" | perl -0pe 's#<script\b.*?</script>##gs; s#<style\b.*?</style>##gs; s#<[^>]+># #g; s#&\#x27;#\x27#g; s#&quot;#"#g; s#&amp;#&#g; s#\s+# #g'; }
db() { MONGODB_URI=mongodb://127.0.0.1:<DBPORT>/worldstreet-academy node "$SCRATCH/db.mjs" "$@"; }
```

`$SCRATCH/db.mjs` reads and nudges the mock database. Run it from the worktree root, so `mongoose` resolves:

```js
// db <uid|seller|course|set|enrolled> <arg> [json]
import { createRequire } from "node:module"
const mongoose = createRequire(`${process.cwd()}/package.json`)("mongoose")
await mongoose.connect(process.env.MONGODB_URI)
const db = mongoose.connection.db
const [cmd, arg, json] = process.argv.slice(2)
const course = (title) => db.collection("courses").findOne({ title })
if (cmd === "uid") console.log(String((await db.collection("users").findOne({ email: arg }))?._id ?? null))
if (cmd === "seller") console.log((await db.collection("users").updateOne({ email: arg }, { $set: { sellerStatus: "approved" } })).matchedCount)
if (cmd === "course") {
  const c = await course(arg)
  console.log(JSON.stringify(c && { id: c._id, slug: c.slug, status: c.status, format: c.format, productFile: c.productFile, totalLessons: c.totalLessons, review: c.review }))
}
if (cmd === "set") console.log((await db.collection("courses").updateOne({ title: arg }, { $set: JSON.parse(json) })).modifiedCount)
if (cmd === "enrolled") {
  const [email, title] = arg.split("|")
  const u = await db.collection("users").findOne({ email })
  const c = await course(title)
  console.log(JSON.stringify(await db.collection("enrollments").findOne({ user: u?._id, course: c?._id }, { projection: { _id: 0, status: 1, progress: 1, packageKey: 1 } })))
}
await mongoose.disconnect()
```

**Browser steps** use a throwaway Playwright script in `$SCRATCH`, run with `NODE_PATH="$(npm root -g)" node "$SCRATCH/<name>.cjs"`. Playwright is installed globally, not in the project. Every script:
- sets the persona with `ctx.addCookies([{ name: "mock_persona", value: "<persona>", url: BASE }])`;
- fulfils R2 traffic, recording each request:

```js
const r2 = []
await page.route(/\.r2\.cloudflarestorage\.com\//, (route) => {
  const req = route.request()
  r2.push(`${req.method()} ${req.url()}`)
  return route.fulfill({
    status: 200,
    headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, PUT, OPTIONS", "access-control-allow-headers": "*" },
    body: "",
  })
})
```

Test files are made in memory with `setInputFiles({ name, mimeType, buffer: Buffer.from("%PDF-1.4\n% WMA test file\n%%EOF\n") })`. That buffer is 31 bytes, which `fileSizeLabel` prints as "1 KB".

**Once, before Task 2:**
1. Warm up the personas: `text / student >/dev/null; text /instructor instructor >/dev/null; text /admin admin >/dev/null`.
2. Make the student an approved Marketplace Creator: `db seller student@worldstreet.academy`. Expected: `1`.

**The fixtures.** Task 2 creates these through the editor, and later tasks reuse them. Every fixture is in the topic `trading-financial-markets`, at Beginner level, with a description of at least 10 characters.

| Id | Owner | Title | Format | Price | Content | Left as |
|---|---|---|---|---|---|---|
| F1 | `instructor` (faculty) | `Trading Journal Template` | marketplace · Template | Free | `journal.pdf` | published |
| F2 | `instructor` | `Risk Management Masterclass` | marketplace · Masterclass | Free | 1 text lesson, "Position sizing" | published |
| F3 | `student` (Marketplace Creator) | `Creator Budget Guide` | marketplace · Guide | $15 | `budget-guide.pdf` | draft, never submitted |

## File structure

| File | Responsibility |
|---|---|
| `lib/course-format.ts` (new) | Formats, file formats, labels, blurbs, file-product limits and size labels; `hasDeliverable` |
| `lib/review-checks.ts` (new) | The four checks: copy, statuses, `outstandingChecks`, `reviewContentString` |
| `lib/db/models/course.ts`, `lib/db/models/index.ts` (modify) | `format`, `productFile`, `review.checks` |
| `lib/r2.ts` (modify) | `productKeyPrefix`, `generateProductKey` |
| `lib/actions/product-files.ts` (new) | `getProductUploadUrl`, `getProductDownloadUrl`, `getOwnedProduct` |
| `lib/actions/instructor.ts` (modify) | Format and file rules on save; the editor's read; the admin publish gate |
| `components/instructor/product-file-field.tsx` (new), `components/instructor/course-editor.tsx`, `app/(instructor)/instructor/courses/[courseId]/edit/page.tsx` (modify) | Choose a format, upload the file, see the review checks |
| `lib/actions/student.ts` (modify) | `format` on every course read model; `productFile` on `ProgramDetail`; the file product's single tier |
| `lib/marketplace.ts`, `components/marketplace/marketplace-filters.tsx`, `app/(marketing)/marketplace/page.tsx`, `components/marketing/course-card.tsx` (modify) | Format chip and filter |
| `components/programs/program-hero.tsx`, `purchase-panel.tsx`, `package-model.ts`, `package-chooser.tsx`, `app/(marketing)/programs/[slug]/page.tsx`, `components/checkout/order-lines.ts` (modify) | What a template's page and checkout promise |
| `components/marketplace/product-home.tsx`, `components/marketplace/product-download-button.tsx` (new), `app/(platform)/dashboard/courses/[courseId]/page.tsx`, `app/(checkout)/dashboard/checkout/success/page.tsx` (modify) | Delivery |
| `lib/dashboard-home.ts`, `components/platform/enrollment-card.tsx` (modify) | A file product in the learner's lists |
| `lib/course-review.ts`, `lib/actions/admin-course-review.ts`, `lib/actions/admin-courses.ts` (modify) | Fingerprint, carrying checks forward, recording them, the approval and publish gates |
| `app/(admin)/admin/courses/[courseId]/review/page.tsx`, `components/admin/review-pipeline.tsx` (new), `app/(admin)/admin/courses/page.tsx` (modify) | The review page; the queue links to it |
| `app/(marketing)/sell/page.tsx` (modify) | §17's pipeline and the formats |
| `docs/go-patches-phase-3.md`, `docs/launch-runbook.md`, `docs/institutional-blueprint-plan.md`, `context.md` (modify) | Notes, owner steps, status |

---

### Task 1: Formats and file products — the data

**Files:**
- Create: `lib/course-format.ts`
- Modify: `lib/db/models/course.ts`, `lib/db/models/index.ts`, `lib/r2.ts`

**Interfaces:**
- Produces, from `lib/course-format.ts` (pure; its only import is `import type { CourseKind } from "@/lib/db/models"`):
  - `COURSE_FORMATS`, `type CourseFormat`, `type FileFormat = Extract<CourseFormat, "template" | "guide">`
  - `isCourseFormat(value: unknown): value is CourseFormat`
  - `isFileFormat(format: CourseFormat | null | undefined): format is FileFormat`
  - `courseFormatOf(course: { kind?: CourseKind | null; format?: CourseFormat | null }): CourseFormat | null`
  - `FORMAT_LABEL`, `FORMAT_PLURAL`, `FORMAT_BLURB: Record<CourseFormat, string>`
  - `formatCount(n: number, format: CourseFormat): string`
  - `PRODUCT_MIME: Readonly<Record<string, string>>`, `PRODUCT_ACCEPT: string`, `MAX_PRODUCT_BYTES: number`
  - `productTypeLabel(mimeType: string): string`, `fileSizeLabel(bytes: number): string`
  - `type ProductFileValue = { key: string; filename: string; mimeType: string; sizeBytes: number }`
  - `hasDeliverable(course: { format: CourseFormat | null; totalLessons: number; productFile: { key: string } | null }): boolean`
- Produces, from `lib/db/models`:
  - `ICourse.format: CourseFormat | null`
  - `ICourse.productFile: ICourseProductFile | null`
  - `interface ICourseProductFile { key: string; filename: string; mimeType: string; sizeBytes: number; uploadedAt: Date }`, exported from the barrel.
- Produces, from `lib/r2.ts`: `productKeyPrefix(userId: string): string` and `generateProductKey(userId: string, originalFilename: string): string`.

- [ ] **Step 0: Baseline.** On the fresh branch, run `git rev-parse HEAD`, `pnpm lint 2>&1 | tail -3` and `npx tsc --noEmit 2>&1 | tail -3`. Paste all three outputs into the task report. Task 8 compares against them, and uses the commit as `<PHASE20_BASE>`.

- [ ] **Step 1: Check first.**
  Run: `grep -n "format\|productFile" lib/db/models/course.ts; ls lib/course-format.ts`
  Expected: no grep output, and `ls` reports that the file doesn't exist.

- [ ] **Step 2: Write the assertion script** `$SCRATCH/t1-course-format.ts`:

```ts
import assert from "node:assert/strict"
import {
  COURSE_FORMATS, FORMAT_LABEL, MAX_PRODUCT_BYTES, courseFormatOf, fileSizeLabel, formatCount,
  hasDeliverable, isCourseFormat, isFileFormat, productTypeLabel,
} from "@/lib/course-format"

assert.deepEqual([...COURSE_FORMATS], ["course", "masterclass", "workshop", "template", "guide"])
assert.equal(courseFormatOf({ kind: "marketplace", format: null }), "course")
assert.equal(courseFormatOf({ kind: "marketplace" }), "course")
assert.equal(courseFormatOf({ kind: "marketplace", format: "template" }), "template")
assert.equal(courseFormatOf({ kind: "program", format: "template" }), null)
assert.equal(courseFormatOf({ kind: "new-economy", format: "guide" }), null)
assert.equal(courseFormatOf({}), null) // a legacy row is a program
for (const f of ["template", "guide"] as const) assert.equal(isFileFormat(f), true)
for (const f of ["course", "masterclass", "workshop", null, undefined] as const) assert.equal(isFileFormat(f), false)
assert.equal(isCourseFormat("guide"), true)
assert.equal(isCourseFormat("ebook"), false)
assert.equal(isCourseFormat(null), false)
assert.equal(FORMAT_LABEL.masterclass, "Masterclass")
assert.equal(formatCount(1, "template"), "1 template")
assert.equal(formatCount(3, "masterclass"), "3 masterclasses")
assert.equal(formatCount(0, "guide"), "0 guides")
assert.equal(MAX_PRODUCT_BYTES, 104857600)
assert.equal(productTypeLabel("application/pdf"), "PDF")
assert.equal(productTypeLabel("application/x-zip-compressed"), "ZIP") // Windows browsers' zip type
assert.equal(productTypeLabel("text/plain"), "File")
assert.equal(fileSizeLabel(0), "")
assert.equal(fileSizeLabel(31), "1 KB")
assert.equal(fileSizeLabel(512000), "500 KB")
assert.equal(fileSizeLabel(2516582), "2.4 MB")
assert.equal(hasDeliverable({ format: null, totalLessons: 1, productFile: null }), true)
assert.equal(hasDeliverable({ format: "course", totalLessons: 0, productFile: null }), false)
assert.equal(hasDeliverable({ format: "workshop", totalLessons: 3, productFile: null }), true)
assert.equal(hasDeliverable({ format: "template", totalLessons: 0, productFile: null }), false)
assert.equal(hasDeliverable({ format: "template", totalLessons: 0, productFile: { key: "k" } }), true)
assert.equal(hasDeliverable({ format: "guide", totalLessons: 4, productFile: null }), false)
console.log("course-format: all assertions passed")
```

- [ ] **Step 3: Run it to see it fail.**
  Run: `npx tsx --tsconfig ./tsconfig.json "$SCRATCH/t1-course-format.ts"`
  Expected: FAIL, because `@/lib/course-format` can't be resolved.

- [ ] **Step 4: Create `lib/course-format.ts`.** Its doc comment names it the one home of marketplace formats and file-product limits (owner, 2026-10-19; institutional blueprint §17). The values are fixed:

```ts
export const COURSE_FORMATS = ["course", "masterclass", "workshop", "template", "guide"] as const

export const FORMAT_LABEL: Record<CourseFormat, string> = {
  course: "Course", masterclass: "Masterclass", workshop: "Workshop", template: "Template", guide: "Guide",
}
export const FORMAT_PLURAL: Record<CourseFormat, string> = {
  course: "courses", masterclass: "masterclasses", workshop: "workshops", template: "templates", guide: "guides",
}
/** Drafted from §17 for the owner's sign-off: /sell and the editor's helper line. */
export const FORMAT_BLURB: Record<CourseFormat, string> = {
  course: "A structured course of pre-recorded lessons.",
  masterclass: "An expert's deep dive into one subject, in lessons.",
  workshop: "A hands-on session in lessons, built around doing the work.",
  template: "A ready-to-use file, such as a spreadsheet, planner or toolkit, that buyers download.",
  guide: "A written guide or eBook, delivered as one download.",
}

/** Accepted product files → the short type buyers see. */
export const PRODUCT_MIME: Readonly<Record<string, string>> = {
  "application/pdf": "PDF",
  "application/epub+zip": "EPUB",
  "application/msword": "Word",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "application/vnd.ms-excel": "Excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
  "application/vnd.ms-powerpoint": "PowerPoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint",
  "text/csv": "CSV",
  "application/zip": "ZIP",
  "application/x-zip-compressed": "ZIP",
}
export const PRODUCT_ACCEPT = ".pdf,.epub,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.zip"
export const MAX_PRODUCT_BYTES = 100 * 1024 * 1024
```

  The functions follow the assertions:
  - `courseFormatOf`: `null` unless `kind === "marketplace"`; then `format ?? "course"`.
  - `formatCount`: `1 <label lowercased>` for one, otherwise `<n> <plural>`.
  - `productTypeLabel`: `PRODUCT_MIME[m] ?? "File"`.
  - `fileSizeLabel`: the same rule as `formatSize` in `components/assignments/submission-files.tsx`. That is `""` for 0, whole KB (at least 1) under 1 MB, and one-decimal MB from 1 MB. It can't be imported from there, because that module is `"use client"`.
  - `hasDeliverable`: a file format needs `productFile`; anything else needs at least one lesson.

- [ ] **Step 5: `lib/db/models/course.ts`.**
  - Import `COURSE_FORMATS` and `type CourseFormat` from `@/lib/course-format`.
  - Add `ICourseProductFile` beside `ICoursePackage`.
  - In `ICourse`, after `communityUrl: string | null`, add the two fields with these doc comments:
    - "Marketplace only (lib/course-format.ts): null on programs and New Economy; null on a marketplace course reads "course". Read through courseFormatOf." on `format: CourseFormat | null`.
    - "Templates and guides: their one file, in the PRIVATE resources bucket. A key, never a URL." on `productFile: ICourseProductFile | null`.
  - In the schema, after `communityUrl: { type: String, default: null, trim: true, maxlength: 500 },`:

```ts
    format: { type: String, enum: [null, ...COURSE_FORMATS], default: null },
    productFile: {
      type: new Schema<ICourseProductFile>(
        {
          key: { type: String, required: true, maxlength: 300 },
          filename: { type: String, required: true, trim: true, maxlength: 200 },
          mimeType: { type: String, required: true, maxlength: 200 },
          sizeBytes: { type: Number, required: true, min: 1 },
          uploadedAt: { type: Date, required: true },
        },
        { _id: false }
      ),
      default: null,
    },
```

  - In `lib/db/models/index.ts`, add `type ICourseProductFile` to the `./course` export list.

- [ ] **Step 6: `lib/r2.ts`.** After `generateSubmissionKey`, add the two key helpers, with doc comments in the style of the submission ones (PRIVATE bucket only; a save accepts only keys inside the saving user's folder):
  - `productKeyPrefix` returns `` `worldstreet-academy/products/${userId}/` ``.
  - `generateProductKey` is the prefix plus `` `${Date.now()}-${randomId}.${extension}` ``, with `randomId` and `extension` built exactly as `generateSubmissionKey` builds them.

- [ ] **Step 7: Verify.**
  Run: `npx tsx --tsconfig ./tsconfig.json "$SCRATCH/t1-course-format.ts"`
  Expected: `course-format: all assertions passed`.
  Run: `npx tsc --noEmit`, then `npx eslint lib/course-format.ts`, `npx eslint lib/db/models/course.ts`, `npx eslint lib/db/models/index.ts` and `npx eslint lib/r2.ts`.
  Expected: clean, apart from the stale `.next/types` error.

- [ ] **Step 8: Commit.**

```bash
git add lib/course-format.ts lib/db/models/course.ts lib/db/models/index.ts lib/r2.ts
git commit -m "feat(marketplace): course formats and file products — the data"
```

---

### Task 2: Creators choose a format and upload a template or guide

**Files:**
- Create: `lib/actions/product-files.ts`, `components/instructor/product-file-field.tsx`
- Modify: `lib/actions/instructor.ts`, `components/instructor/course-editor.tsx`, `app/(instructor)/instructor/courses/[courseId]/edit/page.tsx`

**Interfaces:**
- Consumes: everything Task 1 produces; `hasPrivateResourceBucket`, `generatePresignedUploadUrl`, `R2_RESOURCE_BUCKET` from `@/lib/r2`.
- Produces:
  - `getProductUploadUrl(filename: string, contentType: string, sizeBytes: number): Promise<{ success: true; data: { uploadUrl: string; storageKey: string } } | { success: false; error: string }>` in `lib/actions/product-files.ts` (`"use server"`).
  - `fetchCourseForEdit(courseId)`'s `course` gains `format: CourseFormat | null`, `productFile: ProductFileValue | null` and `formatLocked: boolean` (`publishedAt` is set).
  - `ProductFileField({ value, onChange, format }: { value: ProductFileValue | null; onChange: (value: ProductFileValue) => void; format: FileFormat })`, a client component.
  - Form fields that the editor posts and `createCourse`/`updateCourse` read: `format` (a `CourseFormat`, or `""`), and `productFile` (JSON `ProductFileValue` or `null`).

- [ ] **Step 1: Check first** (instructor, bucket off).
  Open `/instructor/courses/new`, choose Course type "Marketplace course".
  Expected: there is no Format select and no Product file section.

- [ ] **Step 2: `lib/actions/product-files.ts`, `getProductUploadUrl`.** Copy the order of `getSubmissionUploadUrl` in `lib/actions/assignments.ts`:
  1. `connectDB()`, then `getCurrentUser()`.
  2. The gate: the caller is `INSTRUCTOR` or `ADMIN`, or is a `USER` whose `User.sellerStatus` is `"approved"` (read it with `User.findById(user.id).select("sellerStatus")`).
  3. Zod.
  4. The MIME type is in `PRODUCT_MIME`.
  5. `hasPrivateResourceBucket()`.
  6. `storageKey = generateProductKey(user.id, filename)`.
  7. `generatePresignedUploadUrl(storageKey, contentType, 900, R2_RESOURCE_BUCKET, sizeBytes)`, so the declared size is signed in.

  Errors, exactly:

  | When | `error` |
  |---|---|
  | No session | `You need to be signed in` |
  | Neither faculty nor an approved creator | `Only approved Marketplace Creators and faculty can upload files` |
  | Filename empty or over 200 characters | `Choose a file` |
  | Size < 1 or > `MAX_PRODUCT_BYTES` | `Files can be up to 100 MB` |
  | MIME not accepted | `Upload a PDF, EPUB, Word, Excel, PowerPoint, CSV or ZIP file` |
  | Bucket unset | `File uploads aren't available right now` |
  | Anything thrown | `Couldn't prepare the upload — try again` |

- [ ] **Step 3: The save rules in `lib/actions/instructor.ts`.**
  - **Parsing.** `CourseExtrasSchema` gains `format: z.enum(COURSE_FORMATS).nullable()` and `productFile: ProductFileSchema.nullable()`.
    - `ProductFileSchema` checks: `key` 1–300; `filename` trimmed, 1–200; `mimeType` in `PRODUCT_MIME`; `sizeBytes` an integer from 1 to `MAX_PRODUCT_BYTES`. Every message is `Upload your file again`.
    - `parseExtras` reads `format` (`""` → null) and `productFile` (JSON; `""` or `"null"` → null; unparseable → a value that fails the schema). It returns them.
    - Its error mapping keys each issue by `issue.path[0]` (`kind`, `communityUrl`, `format`, `productFile`).
  - **A new private helper**, `resolveProduct(...)`, returns `{ format: CourseFormat | null; productFile: ICourseProductFile | null } | { field: string; error: string }`. It takes `{ kind: CourseKind; extras; existing: { format?; publishedAt?; productFile? } | null; actingUserId: string; sentProductFile: boolean }`, where `sentProductFile` is `formData.has("productFile")`. The rules, in order:
    1. `kind !== "marketplace"` → `{ format: null, productFile: null }`.
    2. `format = extras.format ?? courseFormatOf({ kind, format: existing?.format }) ?? "course"`.
    3. `existing?.publishedAt` is set and `isFileFormat(existing format) !== isFileFormat(format)` → `{ field: "format", error: "A published course can't switch between lessons and a downloadable file" }`.
    4. A lesson format gets `productFile: null`.
    5. A file format takes the incoming file: `extras.productFile` when `sentProductFile`, else the existing file.
       - With no incoming file, `productFile` is null.
       - A key equal to `existing.productFile.key` keeps the existing `uploadedAt`.
       - A key that starts with `productKeyPrefix(actingUserId)` and contains no `..` gets `uploadedAt: new Date()`.
       - Anything else → `{ field: "productFile", error: "Upload your file again" }`.
  - **`createCourse`.**
    - The pre-check `if (extras.submitForReview && !sentLessons) {` gains `&& !isFileFormat(extras.format)`.
    - After `const kind: CourseKind = seller ? "marketplace" : (extras.kind ?? "program")`, call `resolveProduct` (no `existing`). Then refuse, as `fieldErrors`:
      - a file format with `sentLessons > 0` → `lessons`: `A template or guide is one file — it has no lessons`;
      - a file format, submitting, with no file → `productFile`: `Upload your file before submitting for review`;
      - a file format, `requestedStatus === "published"`, with no file → `productFile`: `Upload the file before publishing`.
    - Write `format` and `productFile` in `Course.create`.
  - **`updateCourse`.**
    - Resolve against `existingCourse` after the `kind` line, and apply the same three refusals. `submitting` keeps its lesson check only for lesson formats.
    - Add `format` and `productFile` to the `Course.findByIdAndUpdate(courseId, {` object.
    - `requestCourseReview` / `requestLiveCourseReview` keep being called as today.
  - **`fetchCourseForEdit`.** Add, after `communityUrl: course.communityUrl ?? null,`:
    - `format: courseFormatOf(course)`;
    - `productFile`, as `{ key, filename, mimeType, sizeBytes }` or null;
    - `formatLocked: Boolean(course.publishedAt)`.

- [ ] **Step 4: Create `components/instructor/product-file-field.tsx`** (`"use client"`). Copy the upload loop of `SubmissionForm` in `app/(platform)/dashboard/assignments/[assignmentId]/page.tsx`: presign, then `fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } })`.
  - Wrap the PUT in `try/catch`; a rejection or a non-OK response shows `Couldn't upload <name> — try again`.
  - Before calling the action, refuse a type outside `PRODUCT_MIME` (`Upload a PDF, EPUB, Word, Excel, PowerPoint, CSV or ZIP file`) or a file over `MAX_PRODUCT_BYTES` (`Files can be up to 100 MB`).
  - The input is hidden and uses `accept={PRODUCT_ACCEPT}`.
  - With no file: a dashed `rounded-[20px]` box, titled `No <format> file yet`, with the line "One file, delivered after purchase: PDF, EPUB, Word, Excel, PowerPoint, CSV or ZIP, up to 100 MB. It's stored privately; only buyers can download it." and an outline pill, "Choose a file".
  - With a file: `FileIcon`, the filename, `<productTypeLabel> · <fileSizeLabel>` in `tabular-nums`, and "Replace file".
  - While uploading: `Uploading <name>…`. Errors use `role="alert"` and `text-ws-danger`.

- [ ] **Step 5: `components/instructor/course-editor.tsx`.**
  - `EditableCourse` gains `format?: CourseFormat | null`, `productFile?: ProductFileValue | null` and `formatLocked?: boolean`.
  - **State:** `format` (`course?.format ?? "course"`) and `productFile` (`course?.productFile ?? null`). `const fileFormat = kind === "marketplace" && isFileFormat(format)`.
  - **Format select.** Below the Course type block (after `<SectionDivider label="Course Type" />`'s seller paragraph or select), shown when `kind === "marketplace"`: a `Select` labelled "Format", with `items` built from `COURSE_FORMATS` and `FORMAT_LABEL`.
    - When `formatLocked`, the items are only the formats in the course's current family.
    - The helper line under it is `FORMAT_BLURB[format]`. When locked, it adds " Published: it stays lesson-based." or " Published: it stays a downloadable file."
  - **Hidden inputs.** After `<input type="hidden" name="communityUrl" value={communityUrl} />`:
    - `format` = `kind === "marketplace" ? format : ""`;
    - `productFile` = `JSON.stringify(fileFormat ? productFile : null)`.

    The `lessons` input's value becomes `JSON.stringify(fileFormat ? [] : lessons)`.
  - **The centre column** (`{/* ───────── CENTER: Curriculum ───────── */}`). When `fileFormat`, it holds `<SectionDivider label="Product file" />` and `ProductFileField` instead of the curriculum.
    - If `lessons.length > 0`, a `text-ws-warning` line comes first: `Saving removes this draft's <1 lesson | N lessons>. A <format> is one file, with no lessons.`
    - Otherwise the column is unchanged.

- [ ] **Step 6: `app/(instructor)/instructor/courses/[courseId]/edit/page.tsx`.** Add `format: data.course.format`, `productFile: data.course.productFile` and `formatLocked: data.course.formatLocked` to the `course` object, under the comment "Every editable field must pass through here". The admin edit page passes `data.course` whole and needs no change.

- [ ] **Step 7: Typecheck and lint.**
  Run: `npx tsc --noEmit`, then `npx eslint` on each of the five files.
  Expected: clean.

- [ ] **Step 8: Make the fixtures** (bucket **on**; Playwright with the R2 route; see "The fixtures").
  - **F1.** As `instructor`, create it: Course type "Marketplace course", Format "Template", pricing Free, the file `journal.pdf` (`application/pdf`), then Save & Publish.
    - `r2` holds one `PUT` whose URL contains `worldstreet-academy/products/<db uid instructor@worldstreet.academy>/`.
    - `db course "Trading Journal Template"`: `status: "published"`, `format: "template"`, `totalLessons: 0`, and a `productFile` with that key prefix, `filename: "journal.pdf"`, `mimeType: "application/pdf"` and `sizeBytes: 31`.
  - **F2.** As `instructor`, create it: Format "Masterclass", Free, one text lesson titled "Position sizing", Save & Publish.
    - `db course`: `format: "masterclass"`, `productFile: null`, `totalLessons: 1`.
  - **F3, refused without a file.** As `student`, create it as a Guide at $15 with no file, and choose "Save & submit for review".
    - The banner reads `Upload your file before submitting for review`, and `db course "Creator Budget Guide"` prints `null`.
  - **F3, saved.** Upload `budget-guide.pdf`, then "Save as Draft".
    - `db course`: `status: "draft"`, `format: "guide"`, `review.status: "none"`, and a key under the **student's** prefix.

- [ ] **Step 9 (Review Focus 2): Uploads fail closed.** Restart with the bucket **off**. As `instructor`, open F1's editor and choose "Replace file".
  - The field shows `File uploads aren't available right now`, with no PUT and no hang.
  - Then choose `notes.txt` (`text/plain`). The field shows `Upload a PDF, EPUB, Word, Excel, PowerPoint, CSV or ZIP file`, before any action call.
  - Restart with the bucket **on** for the rest of the phase.

- [ ] **Step 10 (Review Focus 3): Forged values are refused.** For each case, set the hidden input with `page.$eval` and save:
  - In F1's editor (instructor), `productFile` is a copy of F1's file with the key changed to `worldstreet-academy/products/<student uid>/x.pdf`. Expected banner: `Upload your file again`.
  - In F1's editor, `format` is `course`. Expected banner: `A published course can't switch between lessons and a downloadable file`. The visible Format select offers only Template and Guide.
  - In F3's editor (student), `lessons` is `[{"title":"x","type":"text","content":"y"}]`. Expected banner: `A template or guide is one file — it has no lessons`.

  After each one, `db course` shows the course unchanged.

- [ ] **Step 11 (Review Focus 4): An unchanged save changes nothing.** As `instructor`, open F1's editor, touch nothing, and Save & Publish.
  - `db course "Trading Journal Template"` shows the same `productFile.key` and `uploadedAt` as in step 8, and `format: "template"`.
  - Switching F2's Format to "Workshop" and back to "Masterclass", then saving, leaves its lesson in place.

- [ ] **Step 12: Commit.**

```bash
git add lib/actions/product-files.ts components/instructor/product-file-field.tsx lib/actions/instructor.ts components/instructor/course-editor.tsx "app/(instructor)/instructor/courses/[courseId]/edit/page.tsx"
git commit -m "feat(marketplace): creators choose a format and upload templates and guides to the private bucket"
```

---

### Task 3: Listings show their format and filter by it

**Files:**
- Modify: `lib/actions/student.ts`, `lib/marketplace.ts`, `components/marketplace/marketplace-filters.tsx`, `app/(marketing)/marketplace/page.tsx`, `components/marketing/course-card.tsx`, `components/programs/program-hero.tsx`

**Interfaces:**
- Consumes: `courseFormatOf`, `isCourseFormat`, `FORMAT_LABEL`, `formatCount`, `COURSE_FORMATS` (Task 1).
- Produces:
  - `BrowseCourse.format: CourseFormat | null`: never null on a marketplace item, and always null otherwise. `ProgramDetail` inherits it.
  - `MarketplaceFilterValues.format: "" | CourseFormat`.
  - `marketplaceHref` writes `format` after `school`.
  - `MarketplaceFilters` gains a prop, `formats: ReadonlyArray<{ value: CourseFormat; label: string; count: number }>`.

- [ ] **Step 1: Check first.**
  Run: `text "/marketplace?format=template" | grep -c "Risk Management Masterclass"`
  Expected: `1`, because the filter is ignored today.

- [ ] **Step 2: Write the assertion script** `$SCRATCH/t3-marketplace.ts`:

```ts
import assert from "node:assert/strict"
import { marketplaceHref } from "@/lib/marketplace"

assert.equal(marketplaceHref({ format: "template" }), "/marketplace?format=template")
assert.equal(marketplaceHref({ format: "" }), "/marketplace")
assert.equal(
  marketplaceHref({ q: "x", school: "trading-financial-markets", format: "guide", level: "beginner", sort: "newest" }),
  "/marketplace?q=x&school=trading-financial-markets&format=guide&level=beginner&sort=newest"
)
console.log("marketplace: all assertions passed")
```

  Run it. Expected: FAIL, because `format` is ignored.

- [ ] **Step 3: `lib/actions/student.ts`.** Add `format: CourseFormat | null` to `BrowseCourse`, with a doc line ("Marketplace items only, via courseFormatOf"). Set `format: courseFormatOf(course)` in all three builders: `fetchBrowseCourses`, `findProgram` and `fetchOtherCourses`. Each one ends with `publishedAt: course.publishedAt ? course.publishedAt.toISOString() : null,`.

- [ ] **Step 4: `lib/marketplace.ts`.**
  - `MarketplaceFilterValues` gains `format: "" | CourseFormat`, with `import type`.
  - `marketplaceHref` sets `format` after `school`, keeping the params' order.
  - Update the type's comment: `?q=&school=&format=&price=&level=&sort=`.

- [ ] **Step 5: The filter.**
  - **`components/marketplace/marketplace-filters.tsx`:** a `FilterSelect` named `format`, labelled "Format", right after Topic. Its options are `{ value: "", label: "All formats" }`, then `` `${label} (${count})` `` per entry of `formats`. The grid becomes `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`.
  - **`app/(marketing)/marketplace/page.tsx`:**
    - `readFilters` reads `format` through `isCourseFormat` (anything else → `""`).
    - `filtered` adds `(!filters.format || c.format === filters.format)`.
    - `filtering` includes `filters.format`.
    - `formats` holds, in `COURSE_FORMATS` order, each format with at least one listing in `catalogue`, plus the one in the URL.
    - The count line reads `formatCount(courses.length, filters.format)` when a format is set. Otherwise it keeps "1 course" / "N courses".

- [ ] **Step 6: The chip.**
  - **`components/marketing/course-card.tsx`:** in the body row, before the span styled `levelChipStyle(course.level)`, render a chip when `course.kind === "marketplace"`. It holds `FORMAT_LABEL[course.format ?? "course"]`, styled `rounded-full bg-ws-chip px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-ws-primary`. Wrap the chip and the level span in one `flex items-center gap-1.5`.
  - **`components/programs/program-hero.tsx`:** the marketplace `badge` becomes `` `Marketplace · ${FORMAT_LABEL[program.format ?? "course"]}` ``.

- [ ] **Step 7: Verify.**
  - Run: `npx tsx --tsconfig ./tsconfig.json "$SCRATCH/t3-marketplace.ts"`. Expected: `marketplace: all assertions passed`.
  - Run: `text "/marketplace?format=template" | grep -c "Trading Journal Template"; text "/marketplace?format=template" | grep -c "Risk Management Masterclass"; text "/marketplace?format=template" | grep -o "1 template"`. Expected: `1`, `0` and `1 template`.
  - Run: `text "/marketplace?format=ebook" | grep -c "Clear filters"; text "/marketplace?format=ebook" | grep -c "Risk Management Masterclass"`. Expected: `0` and `1` (an unknown format is ignored).
  - Run: `text /programs/<F2 slug> | grep -o "Marketplace · Masterclass"; text /programs/forex-trading-mastery | grep -c "Marketplace ·"`. Expected: the badge once, then `0`.
  - In the browser, at 1440 and 390 px: each marketplace card shows its format chip beside the level, the five filters wrap without horizontal scroll, and choosing "Template" in the Format select navigates to `?format=template`.

- [ ] **Step 8: Lint and commit.**

```bash
npx tsc --noEmit
npx eslint lib/actions/student.ts && npx eslint lib/marketplace.ts && npx eslint components/marketplace/marketplace-filters.tsx && npx eslint "app/(marketing)/marketplace/page.tsx" && npx eslint components/marketing/course-card.tsx && npx eslint components/programs/program-hero.tsx
git add lib/actions/student.ts lib/marketplace.ts components/marketplace/marketplace-filters.tsx "app/(marketing)/marketplace/page.tsx" components/marketing/course-card.tsx components/programs/program-hero.tsx
git commit -m "feat(marketplace): every listing shows its format, and /marketplace filters by it"
```

---

### Task 4: A template's page and checkout promise a download, nothing more

**Files:**
- Modify: `lib/actions/student.ts`, `components/programs/program-hero.tsx`, `components/programs/purchase-panel.tsx`, `components/programs/package-model.ts`, `components/programs/package-chooser.tsx`, `app/(marketing)/programs/[slug]/page.tsx`, `components/checkout/order-lines.ts`

**Interfaces:**
- Consumes: `isFileFormat`, `FORMAT_LABEL`, `productTypeLabel`, `fileSizeLabel` (Task 1); `BrowseCourse.format` (Task 3).
- Produces:
  - `ProgramDetail.productFile: { typeLabel: string; sizeBytes: number } | null`. Public metadata only: never the key, never the filename.
  - `PackageChooser` gains an optional `heading?: string`.
  - The single tier synthesized for a file product is `{ name: FORMAT_LABEL[format], ctaLabel: price === 0 ? "Get it free" : "Buy now", entitlements: NO_ENTITLEMENTS, features: whatYouWillLearn }`, with everything else as today.

- [ ] **Step 1: Check first, and snapshot the regressions.** In Playwright, as `guest`, save the `innerText` of `[data-purchase]` (first match) and of `#packages` for `/programs/forex-trading-mastery` and for F2, to `$SCRATCH/before-forex.txt` and `$SCRATCH/before-f2.txt`. Then, on F1's page:
  Run: `text /programs/<F1 slug> guest | grep -c "Certificate of completion"`
  Expected: `1` or more. That is the bug this task fixes.

- [ ] **Step 2: `lib/actions/student.ts`, `findProgram`.**
  - It already loads the whole course, so no `select` changes. With `const format = courseFormatOf(course)`, add `productFile: isFileFormat(format) && course.productFile ? { typeLabel: productTypeLabel(course.productFile.mimeType), sizeBytes: course.productFile.sizeBytes } : null`.
  - In the synthesized tier, the line `name: courseKindOf(course) === "program" ? "Full program" : "Full course",` gains the file-product branch first. For a file product, `ctaLabel` and `entitlements` follow the interface above. Other courses keep `FULL_ACCESS` and `ctaLabel: null`.

- [ ] **Step 3: Make the ladder-less rules read the tier's entitlements.** For every existing course this is the same outcome, because the synthesized tier is `FULL_ACCESS`. For a file product it yields nothing.
  - `servicesOf` in `components/programs/package-model.ts`: the `tierCount === 0` branch returns all-false, except `instructorQa: pkg.entitlements.instructorQa` and `certificate: pkg.entitlements.certificate`.
  - `programIncludes` in `components/programs/purchase-panel.tsx`, the `if (program.tierCount === 0) {` branch:
    - For a file product, push `{ icon: DownloadIcon, label: "Instant download after purchase", tier: null }`, then `{ icon: FileIcon, label: \`${typeLabel} · ${fileSizeLabel(sizeBytes)}\`, tier: null }`.
    - Then push Q&A and the certificate only where `program.packages[0]?.entitlements` has them.
  - `packageServices` in `components/checkout/order-lines.ts`: its `tierCount === 0` filter also requires `pkg.entitlements[s.key]`.
  - `packageLine`: `if (program.tierCount === 0) return { label: null, name: isFileFormat(program.format) ? pkg.name : "Full program" }`.
  - `app/(marketing)/programs/[slug]/page.tsx`: `const certificate = program.packages.some((p) => p.entitlements.certificate)`. The old `program.tierCount === 0 ||` is subsumed, because a synthesized `FULL_ACCESS` tier carries the certificate.

- [ ] **Step 4: How it reads.**
  - **`package-chooser.tsx`.** `SingleOffer` prints `{pkg.name}` where it printed `{tierCount > 0 ? pkg.name : \`Full ${noun}\`}`. The synthesized names already equal `Full ${noun}` for every non-file course. `PackageChooser` renders `heading ?? (existing expression)` in its `h2`.
  - **The program page.** It passes `heading={fileProduct ? \`Get this ${FORMAT_LABEL[program.format].toLowerCase()}\` : undefined}` to `PackageChooser`, where `const fileProduct = isFileFormat(program.format)`.
  - **`program-hero.tsx`.** The `meta` list adds, after the level, `program.productFile ? { icon: FileIcon, label: \`${typeLabel} · ${fileSizeLabel(sizeBytes)}\` } : null`.
  - **`PurchasePanel`'s enrolled face.** For a file product, the heading is `You own this <format>`, the line is `Download it from your dashboard any time.`, and the button is `Go to your <format>`, with the same `access.continueHref`. The format is lowercased in all three. Everything else stays as it is.

- [ ] **Step 5: Verify F1** (as `guest`, in Playwright).
  - `[data-purchase]` contains "Instant download after purchase", "PDF · 1 KB" and "Get it free". It contains neither "Certificate" nor "Instructor Q&A".
  - `#packages` contains "Get this template", "Template" and "Get it free", and does not contain "Full course".
  - The hero shows "Marketplace · Template" and "PDF · 1 KB", and no "Certificate" meta item.
  - Then run `db set "Trading Journal Template" '{"pricing":"paid","price":9}'` and reload. `[data-purchase]` now contains "Buy now" and "$9". Restore it with `db set "Trading Journal Template" '{"pricing":"free","price":0}'`.

- [ ] **Step 6: Verify the regressions.** Re-take the step 1 snapshots for Forex and F2.
  Run: `diff "$SCRATCH/before-forex.txt" "$SCRATCH/after-forex.txt"; diff "$SCRATCH/before-f2.txt" "$SCRATCH/after-f2.txt"`
  Expected: no output. F2 still lists "Instructor Q&A" and "Certificate of completion", and still says "Full course".

- [ ] **Step 7: Verify checkout.** As `student`, open `/dashboard/checkout?courseId=<F1 id>` (checkout is outside the dashboard gate).
  - The order line reads "Template".
  - The page has no "Full program", no "Instructor Q&A" and no "Certificate of completion".
  - The same check on F2 still shows "Full program" and both services.

- [ ] **Step 8: Lint and commit.**

```bash
npx tsc --noEmit
npx eslint lib/actions/student.ts && npx eslint components/programs/program-hero.tsx && npx eslint components/programs/purchase-panel.tsx && npx eslint components/programs/package-model.ts && npx eslint components/programs/package-chooser.tsx && npx eslint "app/(marketing)/programs/[slug]/page.tsx" && npx eslint components/checkout/order-lines.ts
git add lib/actions/student.ts components/programs/program-hero.tsx components/programs/purchase-panel.tsx components/programs/package-model.ts components/programs/package-chooser.tsx "app/(marketing)/programs/[slug]/page.tsx" components/checkout/order-lines.ts
git commit -m "feat(marketplace): a template's page and checkout promise an instant download, not a course"
```

---

### Task 5: Buyers download what they bought

**Files:**
- Create: `components/marketplace/product-home.tsx`, `components/marketplace/product-download-button.tsx`
- Modify: `lib/actions/product-files.ts`, `app/(platform)/dashboard/courses/[courseId]/page.tsx`, `app/(checkout)/dashboard/checkout/success/page.tsx`, `lib/actions/student.ts`, `lib/dashboard-home.ts`, `components/platform/enrollment-card.tsx`

**Interfaces:**
- Consumes: Task 1's helpers; `generatePresignedDownloadUrl`, `hasPrivateResourceBucket`, `R2_RESOURCE_BUCKET` (`@/lib/r2`); `programArt` (`@/lib/school-art`); `getCourseRatingSummary`, `getUserReview` (`@/lib/actions/reviews`); `CourseRating` (`@/components/learn/course-rating`).
- Produces:
  - In `lib/actions/product-files.ts`:
    - `getProductDownloadUrl(courseId: string): Promise<{ success: true; data: { url: string } } | { success: false; error: string }>`
    - `getOwnedProduct(courseId: string): Promise<OwnedProduct | null>`
    - `type OwnedProduct = { id: string; slug: string; title: string; shortDescription: string | null; thumbnailUrl: string | null; format: FileFormat; file: { filename: string; typeLabel: string; sizeBytes: number }; sellerName: string | null; viewer: "buyer" | "staff" }`
  - `ProductDownloadButton({ courseId, label, variant = "primary" }: { courseId: string; label: string; variant?: "primary" | "outline" })`, a client component.
  - `ProductHome({ product, rating, review })`, a server component.
  - `StudentEnrollment.format: CourseFormat | null`.
  - `isFileProductEnrollment(e: Pick<StudentEnrollment, "format">): boolean` in `lib/dashboard-home.ts`.

- [ ] **Step 1: Check first.** As `student`, buy F2, which is free, through its checkout (this opens the dashboard gate). Then:
  Run: `curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" -b mock_persona=student $BASE/dashboard/courses/<F1 id>`
  Expected: `307 …/programs/<F1 slug>`. The student doesn't own F1 yet. This must still hold after the task (Review Focus 3), so re-run it before step 6's purchase.

- [ ] **Step 2: Write the assertion script** `$SCRATCH/t5-dashboard-home.ts`:

```ts
import assert from "node:assert/strict"
import type { StudentEnrollment } from "@/lib/actions/student"
import { enrollmentHref, isFileProductEnrollment, isInProgress, learningTotals, pickCurrent, pickResume } from "@/lib/dashboard-home"

const row = (o: Partial<StudentEnrollment>) =>
  ({ id: "r", courseId: "c1", status: "active", format: null, lastAccessedAt: "2026-10-10T00:00:00.000Z",
     resumeLessonId: "l1", firstLessonId: "l1", openLessons: 3, completedOpenLessons: 0, ...o }) as unknown as StudentEnrollment

assert.equal(isFileProductEnrollment(row({ format: "template" })), true)
assert.equal(isFileProductEnrollment(row({ format: "course" })), false)
assert.equal(isInProgress(row({ format: "guide" })), false)
assert.equal(isInProgress(row({ format: null })), true)
assert.equal(isInProgress(row({ format: "workshop" })), true)
assert.equal(enrollmentHref(row({ courseId: "c9", format: "guide" })), "/dashboard/courses/c9")
assert.equal(enrollmentHref(row({ courseId: "c9", format: "workshop", resumeLessonId: "l3" })), "/dashboard/courses/c9/learn/l3")
const t = row({ id: "t", format: "template", lastAccessedAt: "2026-10-18T00:00:00.000Z" })
const c = row({ id: "c", lastAccessedAt: "2026-10-01T00:00:00.000Z" })
assert.equal(pickResume([t, c])?.id, "c")
assert.equal(pickCurrent([t, c])?.id, "c")
assert.equal(pickResume([t]), null)
assert.equal(learningTotals([t, c]).open, 1)
console.log("dashboard-home: all assertions passed")
```

  Run it. Expected: FAIL, because `isFileProductEnrollment` doesn't exist.

- [ ] **Step 3: `getProductDownloadUrl` and `getOwnedProduct`** in `lib/actions/product-files.ts`.
  - **The download** runs in this order:
    1. `getCurrentUser()`.
    2. The id must be 24-hex.
    3. `hasPrivateResourceBucket()`.
    4. `Course.findById(id).select("title kind format productFile instructor")`.
    5. It must be a file format with `productFile.key`.
    6. Access: `ADMIN`, the course's `instructor`, or an `Enrollment` `{ user, course, status: { $in: ["active", "completed"] } }`. **The course's own status is never checked.**
    7. `generatePresignedDownloadUrl(key, { expiresIn: 300, downloadFilename: productFile.filename || title, bucket: R2_RESOURCE_BUCKET })`.

    Errors, exactly:

    | When | `error` |
    |---|---|
    | No session | `You need to be signed in` |
    | Bad id, not a file product, or no file | `File not found` |
    | Bucket unset | `Downloads aren't available right now` |
    | No access | `Buy this <format> to download it` |
    | Anything thrown | `Couldn't prepare the download — try again` |
  - **`getOwnedProduct`** applies the same lookup and access rule, and returns `null` instead of each error.
    - `thumbnailUrl` is `programArt(course)`.
    - `sellerName` is the owner's full name when the owner's role is `USER`, otherwise null (populate `instructor` with `firstName lastName role`).
    - `viewer` is `"staff"` for an admin or the owner.

- [ ] **Step 4: Create the components.**
  - **`product-download-button.tsx`** copies the `download()` of `components/assignments/submission-files.tsx`: call the action, then `window.location.assign(url)`; on failure show the error inline with `role="alert"`.
    - `primary` is the default `Button` at `size="lg"`, the page's one gold action. `outline` is `variant="outline"`.
    - It carries `DownloadIcon`, and reads "Preparing…" while busy.
  - **`product-home.tsx`.** `Topbar` (title, plus `breadcrumbOverrides` for the id), then a `max-w-3xl` column with `pb-24 md:pb-8`. It holds one `rounded-[20px]` card containing:
    - the art (`ProgramCover`, 2:1);
    - an eyebrow: `Your <format>` for buyers, `<Format> · preview` for staff;
    - the `h1` title, then the short description;
    - a `FileIcon` line with `<typeLabel> · <fileSizeLabel>`;
    - "By <sellerName>" when it is set;
    - `ProductDownloadButton`, labelled `Download <format>`;
    - the small print "Each download link works for 5 minutes. Come back here whenever you need the file again."

    Below the card, buyers see `CourseRating` (inline, with props as in the lesson page). Last comes a text link, "My programs" → `/dashboard/my-courses`.

- [ ] **Step 5: Wire the routes.**
  - **`app/(platform)/dashboard/courses/[courseId]/page.tsx`.** Directly after `const currentUser = await getCurrentUser()`, and before the line `const start = currentUser ? await getLearnStart(currentUser.id, courseId) : null`:
    - `const product = currentUser ? await getOwnedProduct(courseId) : null`;
    - when it is set, load the rating summary and the user's review in parallel, and `return <ProductHome … />`.

    Update the page's doc comment to say that a template or guide's owner lands on its product home.
  - **`app/(checkout)/dashboard/checkout/success/page.tsx`.** When `isFileFormat(program?.format)`:
    - the first `NextStep` is `{ icon: DownloadIcon, title: "Your <format> is ready", body: "Download it from your dashboard whenever you need it." }`;
    - the gold CTA reads `Download your <format>`, with the same `startHref`.
  - **`lib/actions/student.ts`.** In `fetchMyEnrollments`, add `kind format` to the populate `select`, add `kind?`/`format?` to `PopulatedCourse`, and put `format: courseFormatOf(course)` on each row. `StudentEnrollment` gains `format`.
  - **`lib/dashboard-home.ts`.**
    - Add `isFileProductEnrollment`.
    - `enrollmentHref` sends an access-granting file product to `/dashboard/courses/<id>`.
    - `isInProgress` is `status === "active" && !isFileProductEnrollment(e)`.
    - `pickResume` and `pickCurrent` skip file products.
    - `learningTotals.open` counts only enrollments that aren't file products.
    - In `programsForTab`'s rank, file products sit with completed ones (`isFinished(e) || isFileProductEnrollment(e) ? 2`).
  - **`components/platform/enrollment-card.tsx`.** For a file product, pass no `progress`, `packageName={FORMAT_LABEL[format]}` and `priceLabel="Ready to download"`.

- [ ] **Step 6: Verify the purchase and the download** (bucket on).
  - Run `npx tsx --tsconfig ./tsconfig.json "$SCRATCH/t5-dashboard-home.ts"`. Expected: `dashboard-home: all assertions passed`.
  - As `student`, in Playwright, buy F1 through its checkout. The success page shows "Your template is ready" and "Download your template".
  - `db enrolled "student@worldstreet.academy|Trading Journal Template"` prints `{"status":"active","progress":0,"packageKey":null}`.
  - On `/dashboard/courses/<F1 id>`, click "Download template". `r2` holds one `GET` whose URL contains `worldstreet-academy/products/`, `X-Amz-Expires=300` and `response-content-disposition=attachment`.
  - (Review Focus 3) Run `curl -s -b mock_persona=student $BASE/dashboard/courses/<F1 id> | grep -c "worldstreet-academy/products"`, then the same for `$BASE/programs/<F1 slug>` and `$BASE/dashboard/my-courses`. Expected: `0` for each.

- [ ] **Step 7: The learner's lists.**
  - On `/dashboard/my-courses`, F1's card shows the "Template" chip and "Ready to download", and links to `/dashboard/courses/<F1 id>`. The "In Progress" tab lists F2 and not F1.
  - On `/dashboard`, the hero and the sidebar's "Continue learning" name "Risk Management Masterclass", although F1 was opened last.

- [ ] **Step 8 (Review Focus 1): A buyer keeps the file.** As `admin`, on `/admin/courses`, choose F1 → "Close enrollments".
  - As `student`, `/dashboard/courses/<F1 id>` returns `200` with the product home, and Download records a new R2 `GET`.
  - Repeat after "Archive". Then, as admin, "Publish" F1 again: it is faculty-owned, so this is allowed.

- [ ] **Step 9 (Review Focus 2): Downloads fail closed.** Restart with the bucket **off**. As `student`, click Download.
  - It shows `Downloads aren't available right now`, and there is no R2 request.
  - Restart with the bucket **on**.

- [ ] **Step 10: Look at it.** At 390 and 1440 px, in dark and light: the product home has no horizontal scroll, Download is the only gold control, and the size reads in tabular figures.

- [ ] **Step 11: Lint and commit.**

```bash
npx tsc --noEmit
npx eslint lib/actions/product-files.ts && npx eslint components/marketplace/product-home.tsx && npx eslint components/marketplace/product-download-button.tsx && npx eslint "app/(platform)/dashboard/courses/[courseId]/page.tsx" && npx eslint "app/(checkout)/dashboard/checkout/success/page.tsx" && npx eslint lib/actions/student.ts && npx eslint lib/dashboard-home.ts && npx eslint components/platform/enrollment-card.tsx
git add lib/actions/product-files.ts components/marketplace/product-home.tsx components/marketplace/product-download-button.tsx "app/(platform)/dashboard/courses/[courseId]/page.tsx" "app/(checkout)/dashboard/checkout/success/page.tsx" lib/actions/student.ts lib/dashboard-home.ts components/platform/enrollment-card.tsx
git commit -m "feat(marketplace): buyers download templates and guides from their product home"
```

---

### Task 6: Four recorded checks gate approval

**Files:**
- Create: `lib/review-checks.ts`
- Modify: `lib/db/models/course.ts`, `lib/course-review.ts`, `lib/actions/admin-course-review.ts`, `lib/actions/admin-courses.ts`, `lib/actions/instructor.ts`

**Interfaces:**
- Produces, from `lib/review-checks.ts` (pure, no imports):
  - `REVIEW_CHECKS`, `type ReviewCheckKey`, `REVIEW_CHECK_STATUSES`, `type ReviewCheckStatus`
  - `type CheckState = { status?: ReviewCheckStatus | null; contentHash?: string | null }`
  - `EMPTY_CHECK`, `REVIEW_CHECK_DETAILS`, `CHECK_STATUS_LABEL`
  - `statusAllowed(check: ReviewCheckKey, status: ReviewCheckStatus): boolean`
  - `isCleared(check: CheckState | null | undefined): boolean`
  - `outstandingChecks(checks: Partial<Record<ReviewCheckKey, CheckState | null>> | null | undefined, contentHash: string): ReviewCheckKey[]`, in pipeline order.
  - `type ReviewContent` and `reviewContentString(content: ReviewContent): string`
- Produces, from `lib/db/models`: `ICourse.review.checks?: Partial<Record<ReviewCheckKey, IReviewCheck>>`, with `interface IReviewCheck { status: ReviewCheckStatus | null; by: Types.ObjectId | null; at: Date | null; note: string | null; contentHash: string | null }`, exported from the barrel.
- Produces, from `lib/course-review.ts`: `courseReviewFingerprint(courseId: string): Promise<string | null>`, a 64-character hex SHA-256 (`node:crypto`). The signatures of `requestCourseReview` and `requestLiveCourseReview` are unchanged.

- [ ] **Step 1: Write the assertion script** `$SCRATCH/t6-review-checks.ts`:

```ts
import assert from "node:assert/strict"
import { EMPTY_CHECK, REVIEW_CHECK_DETAILS, isCleared, outstandingChecks, reviewContentString, statusAllowed } from "@/lib/review-checks"

const H = "h1"
const pass = { status: "passed", contentHash: H } as const
const ALL = ["content", "quality", "accuracy", "technical"]
assert.deepEqual(outstandingChecks(undefined, H), ALL)
assert.deepEqual(outstandingChecks(null, H), ALL)
assert.deepEqual(outstandingChecks({ content: pass, quality: pass, accuracy: pass, technical: pass }, H), [])
assert.deepEqual(outstandingChecks({ content: pass, quality: pass, accuracy: { status: "n/a", contentHash: H }, technical: pass }, H), [])
assert.deepEqual(outstandingChecks({ content: { status: "passed", contentHash: "old" }, quality: pass, accuracy: pass, technical: pass }, H), ["content"])
assert.deepEqual(outstandingChecks({ technical: pass, accuracy: { status: "changes", contentHash: H }, content: pass }, H), ["quality", "accuracy"])
assert.equal(isCleared({ status: null, contentHash: H }), false)
assert.equal(isCleared({ status: "n/a", contentHash: null }), true)
assert.equal(isCleared(undefined), false)
assert.equal(statusAllowed("accuracy", "n/a"), true)
assert.equal(statusAllowed("content", "n/a"), false)
assert.equal(statusAllowed("technical", "changes"), true)
assert.deepEqual(EMPTY_CHECK, { status: null, by: null, at: null, note: null, contentHash: null })
assert.equal(REVIEW_CHECK_DETAILS.accuracy.title, "Accuracy review")

const base = { title: "T", shortDescription: null, description: "D", thumbnailUrl: null, level: "beginner", school: "trading-financial-markets",
  format: "template", pricing: "paid", price: 15, whatYouWillLearn: ["a"], communityUrl: null, productFileKey: "k1", lessons: [] }
const L1 = { title: "One", description: null, type: "video", videoUrl: "u1", content: null, videoDuration: 60, isFree: false }
const L2 = { ...L1, title: "Two", videoUrl: "u2" }
assert.equal(reviewContentString(base), reviewContentString({ lessons: [], productFileKey: "k1", ...base })) // key order is irrelevant
assert.equal(reviewContentString({ ...base, shortDescription: undefined }), reviewContentString(base)) // undefined reads as null
assert.notEqual(reviewContentString(base), reviewContentString({ ...base, productFileKey: "k2" }))
assert.notEqual(reviewContentString(base), reviewContentString({ ...base, price: 20 }))
assert.notEqual(reviewContentString({ ...base, lessons: [L1, L2] }), reviewContentString({ ...base, lessons: [L2, L1] }))
assert.notEqual(reviewContentString({ ...base, lessons: [L1] }), reviewContentString({ ...base, lessons: [{ ...L1, videoUrl: "u9" }] }))
assert.equal(
  reviewContentString({ ...base, lessons: [{ ...L1, _id: "a", order: 0 }] } as never),
  reviewContentString({ ...base, lessons: [{ ...L1, _id: "b", order: 7 }] } as never)
) // lesson ids and stored order never count
console.log("review-checks: all assertions passed")
```

  Run it. Expected: FAIL, because the module doesn't exist.

- [ ] **Step 2: Create `lib/review-checks.ts`.** Its doc comment cites institutional blueprint §17's pipeline and rulings 7–8. The values are fixed:

```ts
export const REVIEW_CHECKS = ["content", "quality", "accuracy", "technical"] as const
export const REVIEW_CHECK_STATUSES = ["passed", "changes", "n/a"] as const
export const EMPTY_CHECK = { status: null, by: null, at: null, note: null, contentHash: null } as const

/** Drafted from §17 for the owner's sign-off: the review page, the editor and /sell. */
export const REVIEW_CHECK_DETAILS: Record<ReviewCheckKey, { title: string; qualifier: string | null; body: string }> = {
  content: { title: "Content review", qualifier: null, body: "The topic fits a school of the Academy. The material is original and delivers what its page promises." },
  quality: { title: "Quality review", qualifier: null, body: "Clear structure, clear sound and picture, readable files. A learner can follow it from start to finish." },
  accuracy: { title: "Accuracy review", qualifier: "where relevant", body: "Facts, figures and claims are correct and current. Where there is nothing to fact-check, this review is marked not applicable." },
  technical: { title: "Technical review", qualifier: null, body: "Every video plays and every file opens. The page, the price and the links all work." },
}
export const CHECK_STATUS_LABEL: Record<ReviewCheckStatus | "none", string> = {
  none: "Not checked yet", passed: "Passed", changes: "Changes requested", "n/a": "Not applicable",
}
```

  The functions:
  - `statusAllowed`: `"n/a"` only for `accuracy`.
  - `isCleared`: `status` is `passed` or `n/a`.
  - `outstandingChecks`: every key in `REVIEW_CHECKS` order that is not (`isCleared` and `contentHash === contentHash`).
  - `ReviewContent`: `title`, `description` (strings), and `shortDescription`, `thumbnailUrl`, `level`, `school`, `format`, `pricing`, `price`, `whatYouWillLearn`, `communityUrl`, `productFileKey` (optional, nullable). `lessons` is an array of `{ title, description, type, videoUrl, content, videoDuration, isFree }`, each optional and nullable.
  - `reviewContentString` is this algorithm (`v` maps `undefined` to `null`):

```ts
JSON.stringify([
  v(c.title), v(c.shortDescription), v(c.description), v(c.thumbnailUrl), v(c.level), v(c.school), v(c.format),
  v(c.pricing), v(c.price), c.whatYouWillLearn ?? [], v(c.communityUrl), v(c.productFileKey),
  (c.lessons ?? []).map((l) => [v(l.title), v(l.description), v(l.type), v(l.videoUrl), v(l.content), v(l.videoDuration), Boolean(l.isFree)]),
])
```

- [ ] **Step 3: The model.** In `lib/db/models/course.ts`:
  - Import `REVIEW_CHECK_STATUSES`, `type ReviewCheckKey` and `type ReviewCheckStatus` from `@/lib/review-checks`.
  - Add `IReviewCheck`, and `checks?: Partial<Record<ReviewCheckKey, IReviewCheck>>` to `ICourse.review`. It is optional because legacy rows have none.
  - Inside the `review: {` schema block, after `note: { type: String, default: null, maxlength: 2000 },`, add `checks: { content: reviewCheckPaths(), quality: reviewCheckPaths(), accuracy: reviewCheckPaths(), technical: reviewCheckPaths() }`.
  - `reviewCheckPaths()` is a module function that returns a fresh object each call:
    - `status: { type: String, enum: [null, ...REVIEW_CHECK_STATUSES], default: null }`
    - `by: { type: Schema.Types.ObjectId, ref: "User", default: null }`
    - `at: { type: Date, default: null }`
    - `note: { type: String, default: null, maxlength: 2000 }`
    - `contentHash: { type: String, default: null }`
  - Export `type IReviewCheck` from the barrel.

- [ ] **Step 4: `lib/course-review.ts`.**
  - **`courseReviewFingerprint`** loads, after the caller's `connectDB()`:
    - `Course.findById(courseId).select("title shortDescription description thumbnailUrl level school kind format pricing price whatYouWillLearn communityUrl productFile").lean()`;
    - `Lesson.find({ course: courseId }).sort({ order: 1 }).select("title description type videoUrl content videoDuration isFree").lean()`.

    It hashes `reviewContentString({ …, format: courseFormatOf(course), productFileKey: course.productFile?.key ?? null, lessons })`. It returns `null` when the course doesn't exist.
  - **`requestCourseReview` and `requestLiveCourseReview`** first read `review.checks` and the fingerprint, in parallel. Then `reset = fingerprint ? outstandingChecks(checks, fingerprint) : [...REVIEW_CHECKS]`. Their existing `$set` gains `` [`review.checks.${key}`]: EMPTY_CHECK `` for each key in `reset`. Update both doc comments (ruling 7).

- [ ] **Step 5: The gates.**
  - **`adminApproveCourseReview`** (`lib/actions/admin-course-review.ts`). The `select` gains `format productFile review.checks`.
    - Replace `if ((course.totalLessons ?? 0) === 0) return { success: false, error: "Can't publish a course with no lessons" }` with a `hasDeliverable` check. Its error for a file format is `Can't publish a template or guide without its file`; otherwise the message is unchanged.
    - Then `fingerprint = await courseReviewFingerprint(id.data)`, and refuse when `outstandingChecks(course.review?.checks, fingerprint)` is non-empty, with `Every check must pass first. Still to do: <titles from REVIEW_CHECK_DETAILS, joined by ", ">`.
  - **`adminSetCourseStatus`** (`lib/actions/admin-courses.ts`). When `status === "published"`:
    - replace the `totalLessons` check with the same `hasDeliverable` check;
    - when `courseKindOf(course) === "marketplace"` and `course.review?.status !== "approved"`, read the owner's role. If it is `USER`, refuse with `A Marketplace Creator's course is published from its review page, once all four checks pass.`
  - **`updateCourse`** (`lib/actions/instructor.ts`). After the seller block, apply the same refusal (as `error`, with `fieldErrors: {}`) when all of these hold: the caller isn't the owner (so is an admin); `kind === "marketplace"`; `status === "published"`; `existingCourse.status !== "published"`; and `existingCourse.review?.status !== "approved"`. The owner's role must be `USER`.

- [ ] **Step 6: Verify the submission** (bucket on).
  - Run `npx tsx --tsconfig ./tsconfig.json "$SCRATCH/t6-review-checks.ts"`. Expected: `review-checks: all assertions passed`.
  - As `student`, in F3's editor, choose "Save & submit for review".
  - `db course "Creator Budget Guide"` shows `review.status: "pending"`, and `review.checks` with all four keys at `status: null`.

- [ ] **Step 7 (Review Focus 5): The queue's buttons can't publish it.** As `admin`, on `/admin/courses?review=pending` (its buttons are still the old ones; Task 7 replaces them):
  - "Approve & publish" on F3 shows `Every check must pass first. Still to do: Content review, Quality review, Accuracy review, Technical review`.
  - The row menu's "Publish" shows `A Marketplace Creator's course is published from its review page, once all four checks pass.`
  - On `/admin/courses/<F3 id>/edit`, "Save & Publish" shows the same message in the banner.
  - `db course` still shows `status: "draft"`.

- [ ] **Step 8 (Review Focus 5): Faculty are unaffected.** As `admin`, on F2: the row menu → "Unpublish (to draft)", then "Publish". F2 is published again. As `instructor`, saving F2 with Save & Publish succeeds.

- [ ] **Step 9: A stale pass is reset on re-submission.**
  - Run: `db set "Creator Budget Guide" '{"review.status":"changes_requested","review.checks.content":{"status":"passed","by":null,"at":null,"note":null,"contentHash":"stale"}}'`
  - As `student`, choose "Save & submit for review" on F3.
  - `db course` shows `review.status: "pending"` and `review.checks.content.status: null`.

- [ ] **Step 10: Lint and commit.**

```bash
npx tsc --noEmit
npx eslint lib/review-checks.ts && npx eslint lib/db/models/course.ts && npx eslint lib/db/models/index.ts && npx eslint lib/course-review.ts && npx eslint lib/actions/admin-course-review.ts && npx eslint lib/actions/admin-courses.ts && npx eslint lib/actions/instructor.ts
git add lib/review-checks.ts lib/db/models/course.ts lib/db/models/index.ts lib/course-review.ts lib/actions/admin-course-review.ts lib/actions/admin-courses.ts lib/actions/instructor.ts
git commit -m "feat(review): four recorded checks gate a creator's course — and no admin path skips them"
```

---

### Task 7: The review page, and what the creator sees

**Files:**
- Create: `app/(admin)/admin/courses/[courseId]/review/page.tsx`, `components/admin/review-pipeline.tsx`
- Modify: `lib/actions/admin-course-review.ts`, `app/(admin)/admin/courses/page.tsx`, `lib/actions/admin-courses.ts`, `lib/actions/instructor.ts`, `components/instructor/course-editor.tsx`

**Interfaces:**
- Consumes: Task 6's module, fingerprint and gates; `ProductDownloadButton` (Task 5); `FORMAT_LABEL`, `productTypeLabel`, `fileSizeLabel`, `isFileFormat` (Task 1).
- Produces, in `lib/actions/admin-course-review.ts`:
  - `adminRecordReviewCheck(courseId: string, check: ReviewCheckKey, status: ReviewCheckStatus, note: string): Promise<Result>`
  - `adminGetCourseReview(courseId: string): Promise<AdminCourseReview | null>`
  - The types:

```ts
export type AdminReviewCheckView = {
  key: ReviewCheckKey
  status: ReviewCheckStatus | null
  note: string | null
  at: string | null
  byName: string | null
  /** Recorded on an earlier version of the content, so it no longer counts. */
  stale: boolean
}
export type AdminCourseReview = {
  id: string
  title: string
  format: CourseFormat
  status: CourseStatus
  pricing: CoursePricing
  price: number
  creator: { name: string; email: string | null }
  review: { status: CourseReviewStatus; submittedAt: string | null; note: string | null }
  checks: AdminReviewCheckView[] // REVIEW_CHECKS order
  outstanding: ReviewCheckKey[]
  lessons: { id: string; title: string; type: LessonType; durationSec: number | null; isFree: boolean }[]
  productFile: { typeLabel: string; sizeBytes: number } | null
}
```

  - `adminRequestCourseChanges` is **removed** (ruling 8).
- Also produces:
  - `AdminCourseRow.format: CourseFormat | null`.
  - `fetchCourseForEdit().course.review.checks: { key: ReviewCheckKey; status: ReviewCheckStatus | null; note: string | null }[]`.
  - `ReviewPipeline({ review }: { review: AdminCourseReview })`, a client component.

- [ ] **Step 1: Check first.**
  Run: `curl -s -o /dev/null -w "%{http_code}\n" -b mock_persona=admin $BASE/admin/courses/<F3 id>/review`
  Expected: `404`.

- [ ] **Step 2: `adminRecordReviewCheck`.**
  - **Input.** `connectDB()`, then `requireAdmin()`, then Zod on `{ courseId, check: z.enum(REVIEW_CHECKS), status: z.enum(REVIEW_CHECK_STATUSES), note }`. The note is trimmed, at most 2000 characters (`Keep the note to 2,000 characters`). Two refinements:
    - `statusAllowed` → `Only the accuracy review can be marked not applicable`;
    - `changes` needs a note of at least 5 characters → `Tell the Marketplace Creator what to change (at least 5 characters)`.
  - **The course** must match `{ _id, kind: "marketplace", "review.status": "pending" }`, else `This course isn't waiting for review`. Then `fingerprint = await courseReviewFingerprint(id)`.
  - **The write** is `Course.updateOne({ _id, "review.status": "pending" }, { $set })`. `$set` holds `` [`review.checks.${check}`]: { status, by: admin.id, at: now, note: note || null, contentHash: fingerprint } ``.
    - For `changes`, it also holds `"review.status": "changes_requested"`, `"review.reviewedAt": now`, `"review.reviewedBy": admin.id` and `` "review.note": `${REVIEW_CHECK_DETAILS[check].title}: ${note}` ``.
    - `modifiedCount === 0` → `This course isn't waiting for review`.
  - **For `changes`, tell the creator.** Move the body of `adminRequestCourseChanges` here: `notifyUser` with the title `Changes requested: <title>` and the prefixed note as its body, and `sendCourseReviewDecisionEmail` with `approved: false` and the prefixed note. Then delete `adminRequestCourseChanges` and its `ChangesInput`.
  - **Revalidate** `/admin/courses`, `/admin/courses/<id>/review`, `/instructor/courses` and `/instructor/courses/<id>/edit`.

- [ ] **Step 3: `adminGetCourseReview`.**
  - `requireAdmin()` inside `try`, so it returns null on any failure. It handles marketplace courses only.
  - It populates the owner's name and email, and resolves `byName` for the recorded checks with one `User.find`.
  - `stale` is `status !== null && contentHash !== fingerprint`, and `outstanding` comes from `outstandingChecks`.
  - Lessons are in `order`, with `durationSec` taken from `videoDuration`. `productFile` is set only for a file format.

- [ ] **Step 4: The page and the pipeline.**
  - **`app/(admin)/admin/courses/[courseId]/review/page.tsx`** is a server page: `await params`, then `adminGetCourseReview`, and `notFound()` when it returns null.
    - It opens with `Topbar variant="admin"` and the admin container. Copy the wrapper `div`s of `app/(admin)/admin/courses/page.tsx`.
    - `PageHeader` takes the course title, with the subline `<Format> by <creator> · submitted <date>` and a back link "Review queue" → `/admin/courses?review=pending`.
    - Left, "What to review":
      - for a lesson format, the numbered lesson list (title, type, duration, a "Free preview" chip);
      - for a file product, `FileIcon` with `<typeLabel> · <size>` and an outline `ProductDownloadButton` labelled "Download file";
      - in both cases, then "Open in the editor" → `/admin/courses/<id>/edit`.
    - Right: `<ReviewPipeline review={review} />`.
  - **`components/admin/review-pipeline.tsx`** (`"use client"`) has the heading "Quality control", then an `<ol>` of the four checks, each a `rounded-[20px]` card:
    - the number and `title`, with ` · where relevant` when it has a qualifier;
    - the `body` in `text-ws-muted`;
    - a status chip: `CHECK_STATUS_LABEL`, or `Re-check: the content changed` when `stale`;
    - `<byName> · <date>` and the note, when recorded.

    While `review.status === "pending"`, each card offers:
    - outline pills "Pass" and "Needs changes…";
    - "Not applicable" on accuracy only.

    "Needs changes…" opens a `Dialog`:
    - title: `What needs to change? (<title>)`;
    - description: "It goes back to its Marketplace Creator with this note, by email and in the app. Checks that passed stay passed unless the content changes.";
    - a `Textarea` (placeholder "e.g. Page 3 of the PDF is blank.", `maxLength={2000}`);
    - buttons "Cancel" and "Send back", the latter enabled at 5 characters.

    The footer has the gold "Approve & publish", disabled while `outstanding.length > 0`, with the helper `1 check to go` / `N checks to go` (in `tabular-nums`).
  - **Mutations** use `useTransition`. A recorded check calls `router.refresh()`. Approval calls `router.push("/admin/courses?review=pending")`. An action error shows inline with `role="alert"`.
  - **When `review.status` isn't pending**, the actions are replaced by the line `This course isn't waiting for review · <status label>`. The status label is `Changes requested`, `Approved` or `Not submitted`.

- [ ] **Step 5: The queue, and the creator's view.**
  - **`app/(admin)/admin/courses/page.tsx`:**
    - In the pending row, the `div` holding "Request changes" and "Approve & publish" becomes one `Button size="sm" render={<Link href={\`/admin/courses/${c.id}/review\`} />}` reading "Open review". The menu's two review items become one "Open review" item.
    - The `approveReview` and `requestChanges` mutations, `changesTarget`/`changesNote` and the dialog (`{/* Request changes — the note goes to the seller by email and in the app. */}`) are deleted, with their now-unused imports.
    - Hide the menu's "Publish" when `c.kind === "marketplace" && c.sellerOwned && c.reviewStatus !== "approved"`.
    - The kind chip reads `` `${KIND_LABEL[c.kind]} · ${FORMAT_LABEL[c.format]}` `` when `c.format` is set. A file product's meta line reads "1 file" instead of `N lessons`.
    - The pending subline becomes "Marketplace courses from Marketplace Creators, oldest first. Open one to record its four checks."
  - **`lib/actions/admin-courses.ts`:** `AdminCourseRow.format = courseFormatOf(c)`.
  - **`lib/actions/instructor.ts`, `fetchCourseForEdit`:** `review.checks`, built from `REVIEW_CHECKS` over the stored checks (status and note only).
  - **`components/instructor/course-editor.tsx`, `ReviewState`:**
    - For `pending` and `changes_requested`, a compact list headed "Quality control" follows the existing text: one row per check, `<title>` · `CHECK_STATUS_LABEL[status ?? "none"]`.
    - The "Changes requested" panel keeps printing `review.note`, which now begins with the check's title.
    - Add `checks?` to `EditableCourse.review`.

- [ ] **Step 6: The review, end to end** (bucket on; Playwright as `admin`, unless noted).
  - **Open the review.** `/admin/courses?review=pending` shows F3 with "Open review". The review page shows four "Not checked yet", a disabled "Approve & publish", "4 checks to go" and "PDF · 1 KB". "Download file" records an R2 `GET` with a products key.
  - **Record the checks.** Content → Pass, Quality → Pass, Accuracy → Not applicable. Technical → Needs changes, with the note "Page 3 of the PDF is blank.", then Send back.
    - The page now reads `This course isn't waiting for review · Changes requested`.
    - `db course "Creator Budget Guide"` shows `review.status: "changes_requested"` and `review.note: "Technical review: Page 3 of the PDF is blank."`.
    - Content and quality are `passed`, accuracy is `n/a` and technical is `changes`, each with a 64-character `contentHash`.
  - **The creator's view.** As `student`, F3's editor shows "Changes requested" with that note, and the rows "Content review · Passed", "Quality review · Passed", "Accuracy review · Not applicable" and "Technical review · Changes requested".

- [ ] **Step 7 (Review Focus 4): An unchanged re-submission keeps its passes.** As `student`, choose "Save & submit for review" on F3 without changing anything.
  - `db course` shows content and quality still `passed`, with the same `contentHash` values as in step 6. Accuracy is still `n/a`, and technical is `null`.
  - The admin page shows "1 check to go".

- [ ] **Step 8 (Review Focus 5): An edit mid-review voids the checks.** As `student`, change F3's short description and choose "Save as Draft". The course is still pending.
  - The admin page shows content, quality and accuracy as `Re-check: the content changed`, and "4 checks to go". "Approve & publish" is disabled.
  - Record four passes (accuracy may be Not applicable), then "Approve & publish".
  - The browser lands on the queue. `db course` shows `status: "published"` and `review.status: "approved"`.
  - `text "/marketplace?format=guide" | grep -c "Creator Budget Guide"` prints `1`.

- [ ] **Step 9: Only admins.**
  Run: `curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" -b mock_persona=student $BASE/admin/courses/<F3 id>/review`
  Expected: `307 …/dashboard`.
  Then, at 390 px, the review page has no horizontal scroll and the check cards stack. In light theme the chips read.

- [ ] **Step 10: Lint and commit.**

```bash
npx tsc --noEmit
npx eslint lib/actions/admin-course-review.ts && npx eslint "app/(admin)/admin/courses/[courseId]/review/page.tsx" && npx eslint components/admin/review-pipeline.tsx && npx eslint "app/(admin)/admin/courses/page.tsx" && npx eslint lib/actions/admin-courses.ts && npx eslint lib/actions/instructor.ts && npx eslint components/instructor/course-editor.tsx
grep -rn "adminRequestCourseChanges" app components lib   # expect no output
git add lib/actions/admin-course-review.ts "app/(admin)/admin/courses/[courseId]/review/page.tsx" components/admin/review-pipeline.tsx "app/(admin)/admin/courses/page.tsx" lib/actions/admin-courses.ts lib/actions/instructor.ts components/instructor/course-editor.tsx
git commit -m "feat(review): the review page records each check, and creators see which one asked for changes"
```

---

### Task 8: `/sell` tells §17's pipeline; docs; the closing run

**Files:**
- Modify: `app/(marketing)/sell/page.tsx`, `docs/go-patches-phase-3.md`, `docs/launch-runbook.md`, `docs/institutional-blueprint-plan.md`, `context.md`

**Interfaces:**
- Consumes: `REVIEW_CHECKS`, `REVIEW_CHECK_DETAILS` (Task 6); `COURSE_FORMATS`, `FORMAT_LABEL`, `FORMAT_BLURB` (Task 1).

- [ ] **Step 1: Check first.**
  Run: `text /sell | grep -oE "Content review|Technical review|What you can sell" | sort -u`
  Expected: no output.

- [ ] **Step 2: `/sell`'s How it works becomes §17's pipeline.**
  - `STEPS` becomes seven steps, in this order:
    1. `{ title: "Application", body: "Apply in ten minutes: what you'll teach, a sample of your work and your agreement to the standards. Once you're approved as a Marketplace Creator, build your listing in the editor and submit it." }`
    2. to 5. The four checks, built from `REVIEW_CHECKS` and `REVIEW_CHECK_DETAILS`. The accuracy title reads `Accuracy review (where relevant)`.
    6. `{ title: "Approval", body: "Once all four reviews pass, an admin approves it. You'll hear by email and in the app." }`
    7. `{ title: "Publishing", body: "It goes live on the Academy Marketplace. Share your own link: sales through it pay you the larger share." }`
  - The `SectionTitle` "From application to a live course." becomes "From application to publishing.".
  - Its paragraph becomes "Every submission passes four recorded reviews before it is published. If one asks for changes, you'll see which review and why, and reviews that passed stay passed unless you change the content."
  - Update the `STEPS` comment to cite institutional blueprint §17.

- [ ] **Step 3: The formats band.** Between "The split" and "The standard", add a section with:
  - `SectionLabel` "What you can sell";
  - `SectionTitle` "Courses, masterclasses, workshops, templates and guides.";
  - five `rounded-[20px]` cards (`sm:grid-cols-2 lg:grid-cols-5`), each with `FORMAT_LABEL` and `FORMAT_BLURB`.

  Leave the rest of `/sell` alone. Its "seller" wording waits for the vocabulary pass.

- [ ] **Step 4: Verify.**
  Run: `text /sell | grep -oE "Application|Content review|Quality review|Accuracy review \(where relevant\)|Technical review|Approval|Publishing|What you can sell|From application to publishing" | sort -u | wc -l`
  Expected: `9`.
  At 390 px there is no horizontal scroll, and the seven steps stay numbered 1–7.

- [ ] **Step 5: The Go note.** Append to §9 of `docs/go-patches-phase-3.md`, after its last bullet ("Any wholesale course write must carry `kind`, `review` and `communityUrl`…"), a block headed **"Phase 20 — formats, templates and guides, staged review (2026-10-19)."**. It is all additive, and Go needs no patch to keep working. It covers:
  - **`courses.format`**: `"course" | "masterclass" | "workshop" | "template" | "guide"` or `null`, marketplace only. `null` or missing on a marketplace course means `"course"`. Programs and New Economy courses always have `null`.
  - **`courses.productFile`**: `{ key, filename, mimeType, sizeBytes, uploadedAt }` or `null`. Templates and guides only; the key is in the private resources bucket under `worldstreet-academy/products/<uploader user id>/`.
  - **`courses.review.checks`**: `{ content, quality, accuracy, technical }`, each `{ status: "passed" | "changes" | "n/a" | null, by, at, note, contentHash }`. Only `accuracy` may be `"n/a"`.
  - **The rules:**
    - Templates and guides are marketplace kinds, so they stay out of every program list (the `$nin` filter above).
    - **Go must never return `productFile.key`, a public URL or a signed URL for the file.** The web mints 5-minute signed downloads after checking an access-granting enrollment.
    - A template or guide has no lessons. Its enrollment stays `active`, never completes and earns no certificate. Mobile should show it as "Download on the web", or leave it out of the learner's course list.
    - It is bought exactly like a marketplace course. If Go ever sells it, the §8 rules apply.
    - Approval now needs four recorded checks on the current content. Go must never set `review.status: "approved"` or publish a course whose owner is a `USER`.
    - Wholesale course writes must keep `format`, `productFile` and `review.checks`.

- [ ] **Step 6: The runbook.** Append a section, "## Phase 20 — Marketplace formats and staged review", to `docs/launch-runbook.md`:
  - **No migration.** Courses already in the review queue keep their place, and an admin records their four checks on `/admin/courses/<id>/review`.
  - **The private bucket.** It needs `R2_RESOURCES_BUCKET_NAME` and its CORS `PUT` rule from §3. Templates and guides upload straight to it from the browser. Without it, their uploads and downloads refuse, and lesson courses are unaffected.
  - **Order.** Ship the Go release carrying the §9 note first, or accept in writing that mobile shows templates as courses with no lessons.
  - **Staging check, from the academy origin** (as in B7):
    1. A Marketplace Creator uploads a PDF template and submits it.
    2. An admin downloads it on the review page, records the four checks and approves it.
    3. A buyer buys it and downloads it.
    4. A second account without the purchase is sent to the program page.
    5. Within 5 minutes, the download URL works. After that, it returns `403`.

    Delete the test listing afterwards.
  - **Owner sign-off:** the format blurbs (`lib/course-format.ts`) and the check descriptions (`lib/review-checks.ts`).

- [ ] **Step 7: Status.**
  - **`docs/institutional-blueprint-plan.md`, Phase 20:**
    - Rewrite 20.4's heading to "**20.4 Templates and guides (built, owner 2026-10-19).**", followed by one line naming `lib/course-format.ts`, the private-bucket file and the product home.
    - Add the exit criterion "- [ ] A template or guide sells like a course and downloads only for its buyers; uploads and downloads fail closed without the private bucket."
    - Tick all three exit criteria.
    - Set the Phase 20 row of §3's table to done, with the date and the commit count.
  - **`context.md`:** add a dated entry covering formats, file products and the product home, staged review with the fingerprint rule, and the removal of `adminRequestCourseChanges`.

- [ ] **Step 8: The closing run.**
  - At 1440 and 390 px, in dark and light, check these pages for horizontal scroll and for console errors other than the known Vivid 403:
    - as `guest`: `/marketplace`, `/marketplace?format=template`, `/programs/<F1 slug>`, `/programs/<F3 slug>` (paid: "Buy now" and "$15") and `/sell`;
    - as `student`: `/dashboard/courses/<F1 id>` and `/dashboard/my-courses`;
    - as `admin`: `/admin/courses/<F3 id>/review`.
  - Run: `git diff --stat <PHASE20_BASE> HEAD -- lib/actions/enrollments.ts lib/actions/manual-payments.ts lib/actions/earnings.ts lib/wallet.ts lib/referrals.ts lib/db/models/earning.ts lib/db/models/order.ts lib/db/models/enrollment.ts mocks`
    Expected: no output.
  - Run: `pnpm lint 2>&1 | tail -3` and `npx tsc --noEmit 2>&1 | tail -3`.
    Expected: no new lint errors against Task 1's baseline, and tsc clean apart from the stale `.next/types` error.

- [ ] **Step 9: Commit.**

```bash
git add "app/(marketing)/sell/page.tsx" docs/go-patches-phase-3.md docs/launch-runbook.md docs/institutional-blueprint-plan.md context.md
git commit -m "feat(sell): §17's quality-control pipeline and the five formats; Phase 20 docs"
```

## Report (end of phase)

Read out the Phase 20 exit criteria from `docs/institutional-blueprint-plan.md`, and add:
- the drafted copy awaiting the owner's sign-off: `FORMAT_BLURB` and `REVIEW_CHECK_DETAILS`;
- what this phase deliberately left alone:
  - the purchase confirmation email still says "course" for a template, because it sits in the money path;
  - existing "seller" strings, which wait for the vocabulary pass;
  - replaced files aren't deleted from the bucket;
- the Go note's location (§9) and the runbook's staging check;
- the two baselines next to the final `pnpm lint` and `tsc` output.
