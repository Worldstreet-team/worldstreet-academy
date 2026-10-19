# Mastery Academy — Phase 17 Implementation Plan (Certification tiers and Alumni)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three credentials with published requirements (institutional blueprint §13):
- WMA Certificate of Completion, WMA Certified Practitioner and WMA Mastery Certification;
- each certificate shows the highest tier its enrollment has earned and reprints under the same `WSA-` ID when a higher tier is reached, and no tier is ever lowered;
- a public `/certification` page publishes the requirements;
- learners holding a certificate are "WMA Alumni" (§19).

**Architecture:**
- **Rules.** The tier rules are pure and client-safe, in the new `lib/certificate-tier.ts`: labels, thresholds as named constants, `tierFor`, `nextTierNeeds` and the published requirement lines. An assert script checks them.
- **Storage.** The server side is the new `lib/certificate-standing.ts` (`ensureCertificateTier`). It gathers the inputs (Phase 16's Mastery Score, the best graded project, the exam flag), computes the tier and stores it on the additive `Enrollment.certificateTier`. The write is conditional, so it can only raise the stored tier.
- **Triggers.** It runs on every path that can change a tier: completions and final-exam attempts (through `saveWithCertificateId`), grading, admin restores and plan changes. It also runs lazily when a learner opens a certificate or the certificate list, the way `ensureCertificateId` already does.
- **Readers.** The certificate, `/dashboard/certificates`, the home tile and `/verify` read the stored tier. Null reads as Completion.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict · MongoDB/Mongoose · Tailwind v4 with the WorldStreet design system (`ds/`, `ws-*` tokens) · jsPDF (installed) · Zod v4 (unchanged here).

**Spec:** `docs/institutional-blueprint.md` §13, §19. **Roadmap:** `docs/institutional-blueprint-plan.md` Phase 17, decision D25 (built on its proposed thresholds; owner, 2026-10-19: "implement everything"), D19 (Alumni).

**Branch:** `mastery/phase-17`, cut from `feat/institutional` **after Phases 14 and 16 have merged into it** (Track B: 15 → 16 → 14 → 17).

## Controller rulings (binding)

1. **Interfaces from Phases 14 and 16 come from the roadmap.** Neither `docs/plans/mastery-phase-14.md` nor `docs/plans/mastery-phase-16.md` existed when this plan was written (2026-10-19). This plan uses the roadmap's names exactly:
   - Phase 16, `lib/mastery-score.ts`: `MASTERY_WEIGHTS` and `masteryScore(inputs): { score: number | null; parts }`.
   - Phase 16, `lib/mastery-inputs.ts`: `masteryInputsFor(enrollment, course): Promise<MasteryInputs>`.
   - Phase 16: `Assignment.kind: "assignment" | "project"`, where a missing value means `"assignment"`.
   - Phase 14: Basic's `entitlements.certificate: true` (data) and `PACKAGE_LABEL.executive === "Executive"`.

   Task 1, step 1 checks that they exist. If Phase 16's parameter types differ, Task 2 adapts **only its call site**. The rules in this plan don't change.
2. **"Completion" means `Enrollment.status === "completed"`.** The completion paths already require every lesson the plan opens, plus the final exam where the program requires one and the plan certifies (`completeLesson`, `markCourseComplete`, `gradeAttempt`). Tiers never re-derive that.
3. **"Final exam passed" means `Enrollment.examPassed === true`, strictly (D25).** A program without a published final exam tops out at Completion, and its next-tier line says so. Catalogue programs have `examRequired: false` and no exams yet. That is owner/faculty content debt, and it goes in the report.
4. **Practitioner plans are found by `packageKey`.** `PRACTITIONER_PLANS = ["standard", "executive"]`. A null `packageKey` (legacy single-price, free or pre-enrolled) tops out at Completion, even though `entitlementsFor` grants it full access elsewhere. The tiers are new, so nobody loses anything. Because a stored tier is never lowered, starting strict is the reversible choice: widening the constant raises those enrollments at their next trigger.
5. **Thresholds are inclusive (`>=`).**
   - Practitioner: Mastery Score ≥ 70.
   - Mastery: score ≥ 85, plus a graded project ≥ 70.
   - "A graded project" is the best `Submission.grade` (`status: "graded"`, this enrollment) on an assignment of `kind: "project"` in that program. A re-grade can lower that figure, but the tier stays.
6. **When the tier is computed.** `ensureCertificateTier` runs:
   - (a) inside `saveWithCertificateId`, whenever the saved enrollment is completed. That covers completion and every final-exam attempt, because `gradeAttempt` already calls it on each one, pass or fail;
   - (b) after `gradeSubmission`;
   - (c) after both `ensureCertificateId(enrollment, false)` calls in `lib/actions/admin-enrollments.ts`;
   - (d) lazily, in `fetchCertificate` and `fetchMyCertificates`. That catches attendance gained after completion, and completions made through Go.

   `/verify` never computes. It prints the stored tier (null reads as Completion), so it stays cheap behind its rate limit.
7. **Never lowered.**
   - The write is a conditional `updateOne`. It matches `status: "completed"` and a stored tier strictly below the new one (`tiersBelow`).
   - `certificateTierAt` changes only when the tier rises.
   - The stored tier stays when an enrollment later leaves `completed` (a refund, an admin downgrade). Every surface already hides a certificate whose enrollment isn't completed and certifying.
8. **Labels follow §13 verbatim:** "WMA Certificate of Completion", "WMA Certified Practitioner", "WMA Mastery Certification".
   - The paper prints a two-line title: Certificate / of Completion · Certified / Practitioner · Mastery / Certification.
   - The `WSA-` prefix and one ID per enrollment stay (D16, D25).
9. **Alumni means `fetchMyCertificates()` returns at least one row.** The certificates page counts the same list, so the two never disagree. "WMA Alumni" shows on `/dashboard/profile` and the dashboard greeting only, never on a public page.
10. **No backfill script.** Today's production completions are legacy (null `packageKey`, so Completion under ruling 4). None are on the new plans yet, because Cohort 001 started on 2026-10-19. A null stored tier reads as Completion everywhere, Go R13 included, and the lazy trigger stores it.
11. **`/certification` copy.** §13 gives only the three names and one sentence. The requirement lines are D25 written as sentences, and every number in them is interpolated from the constants, never typed. The page also publishes the Mastery Score's weights from `MASTERY_WEIGHTS`, because Practitioner's requirement depends on the score. It publishes no learner's score. The copy is marked for owner sign-off in the report.
12. **`TierInput` has a seventh field, `hasFinalExam`, besides the roadmap's six.** Only `nextTierNeeds` reads it, so the "Pass the final exam" line can be honest when no exam exists.
13. **The Go note is R13.** It goes in `docs/go-patches-phase-3.md` as a new `## N.` section, numbered one past the last section present when Task 6 runs, because the parallel tracks add sections too.
14. **Don't depend on Phase 11** (Track A). It may not have merged, so don't use `BRAND.shortName` or `lib/institution.ts`; write "WMA" literally.

## Global Constraints

- **Data:**
  - Additive schema only: the Go mobile API reads the same MongoDB. No renamed fields, no new enum values on existing fields, no new role or status values.
  - `certificateTier` is a new field.
  - Never write `certificateId: ""` (R9: the partial unique index indexes every string).
  - Mongoose caches models on `global`. **Restart the verification server after Task 2's schema edit**; otherwise strict mode silently drops `certificateTier` from writes.
- **Server code:**
  - Every action calls `connectDB()` first.
  - User ids come from `getCurrentUser()`, never from the browser.
  - Actions return `{ success: true, data } | { success: false, error }` and never throw across the boundary.
  - Admin actions use `requireAdmin()`. Role gates live in each route group's `layout.tsx`, never in middleware.
  - Zod is `import { z } from "zod/v4"`.
  - `ensureCertificateTier`, like `ensureCertificateId`, **never throws**: a completion, an exam or a grade never fails over its tier.
- **Money and files:** don't touch the money path (`lib/wallet.ts`, `purchaseCourse`, `manual-payments.ts`). Paid files go only to the private bucket (`R2_RESOURCES_BUCKET_NAME`); nothing here uploads.
- **Module boundaries:**
  - `lib/certificate-tier.ts` stays client-safe: no Mongoose, no `server-only`, type-only model imports.
  - `lib/certificate-standing.ts` starts with `import "server-only"`, like `lib/course-access.ts`, and is never imported from a `"use client"` file.
- **Certificates:**
  - `/verify` stays public, noindex, rate-limited and never in the sitemap.
  - The student's name stays masked there, and its gates (completed + certifying + a stored ID) stay as they are.
  - The printed certificate stays a light island (`data-theme="light"` around a `data-brand` element).
- **UI:**
  - Use the WorldStreet design system: `ds/` is vendored, so never edit it.
  - `ws-*` tokens or the shadcn bridge only, never a hex.
  - Gold only for primary CTAs, active nav and brand moments.
  - Icons only through `@/components/icons` (duotone glyphs; never lucide, Hugeicons or emoji).
  - Base UI composition uses `render`, never `asChild`.
  - Pills, 20 px cards (`rounded-[20px]`), Manrope.
  - `·` separators, and `tabular-nums` for scores, grades and counts.
  - RSC-first: `"use client"` only where interaction needs it.
- **Copy:**
  - New user-facing strings use the new vocabulary (plan, not package; program for Academy offerings; Marketplace Creator; Become a WMA Instructor).
  - Don't rename existing strings outside this phase's own new text; the vocabulary pass runs last.
  - Never invent figures or policy.
  - JSX text with an apostrophe uses `&apos;` or a `{"…"}` string (`react/no-unescaped-entities`).
- **No new dependencies, no `any`, no secrets.** Surgical: touch only the files listed.
- **No test runner, and none is added.**
  - Pure rules are checked with a throwaway `node:assert/strict` script in `SCRATCH=$(mktemp -d)`, run from the worktree root: `npx tsx --tsconfig ./tsconfig.json "$SCRATCH/<script>.ts"`.
  - Everything else is checked with `npx tsc --noEmit` (one stale `.next/types` error naming a deleted route is not real) and `npx eslint <file>` for each changed file, plus driving the route.
  - Write scratch scripts with the Write tool: Bash heredocs break on apostrophes.
- Anchors below are **quoted text**, never line numbers. Phases 15 and 16 edited some of these files first, so read each file as it stands.

## Review Focus

1. **Certificates issued before Phase 17** have no stored tier: legacy, null `packageKey`, field missing. The certificate, the list, the home tile and `/verify` must print "WMA Certificate of Completion" without crashing, and opening the certificate stores `"completion"`. Covered in Task 3, step 6, and Task 4, step 6.
2. **Too little data, or no final exam.** With a null Mastery Score, or a program with no published final exam, Practitioner must not issue. The next-tier line must read "(not enough data yet)" or "(this program has none published yet)", never "null", "NaN" or "undefined". Covered in Task 1, step 2 (asserts) and Task 3, step 5 (page).
3. **Grades and scores going down after a tier is reached:** a re-graded project or a falling score. The stored tier and `certificateTierAt` must not move. Covered in Task 2, step 7(d).
4. **An enrollment that leaves `completed`** (refund, admin downgrade) while a tier is stored. `/verify` must say "No certificate with this ID", and `/dashboard/certificates` must drop it. Covered in Task 4, step 7.
5. **Phones.** The tier title on the certificate preview ("Certified / Practitioner") and `/certification` must not overflow at 390 or 320 px, and the PDF title must stay centred. Covered in Task 3, step 7, and Task 4, step 8.

## Verification server

The controller fills `<PORT>` and `<DBPORT>` for this track. The worktree has no `.env.local`; that is intended.

```bash
netstat -ano | grep -E ":<PORT>|:<DBPORT>"      # must print nothing first
RESEND_API_KEY=re_disabled_local CLOUDFLARE_REALTIME_API_KEY=disabled-local OPENAI_API_KEY=disabled-local \
ABLY_API_KEY=disabled-local R2_SECRET_ACCESS_KEY=disabled-local WALLET_SERVICE_TOKEN=disabled-local \
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_bG9jYWwuZGV2JA MOCK_DB_PORT=<DBPORT> PORT=<PORT> node scripts/dev-mock.mjs
MONGODB_URI=mongodb://127.0.0.1:<DBPORT>/worldstreet-academy node scripts/mastery-catalogue.mjs --apply
```

- **Personas** switch with the `mock_persona` cookie. Use `guest`, `student`, `instructor` and `admin` (see `mocks/clerk/personas.ts`); no new persona is needed.
- **Hydrated pages.** `/dashboard` and `/dashboard/profile` are client pages fed by React Query, so check them in a browser.
- **Driving the UI.** Use the global Playwright, `require(require("path").join(require("child_process").execSync("npm root -g").toString().trim(), "playwright"))`, with the persona cookie set per step. The gstack `browse` tool also works on these pages.
- Stop the server when done.

Text helpers. `text` strips scripts and tags, so the RSC payload never counts as rendered copy; `html` strips only scripts, for counting `href`s:

```bash
BASE=http://localhost:<PORT>
SCRATCH=$(mktemp -d)
DB=mongodb://127.0.0.1:<DBPORT>/worldstreet-academy
text() { curl -s ${2:+-b "mock_persona=$2"} "$BASE$1" | perl -0pe 's#<script\b.*?</script>##gs; s#<style\b.*?</style>##gs; s#<[^>]+># #g; s#&\#x27;#\x27#g; s#&quot;#"#g; s#&amp;#&#g; s#\s+# #g'; }
html() { curl -s ${2:+-b "mock_persona=$2"} "$BASE$1" | perl -0pe 's#<script\b.*?</script>##gs'; }
```

### The fixture and DB helper (`$SCRATCH/t17-db.ts`, written in Task 2 and reused after)

A tsx script that imports `connectDB` from `@/lib/db` and the models from `@/lib/db/models`. It never imports `mongoose` directly, because the scratch directory has no `node_modules`; it disconnects through the connection `connectDB()` returns. Run it as `MONGODB_URI=$DB npx tsx --tsconfig ./tsconfig.json "$SCRATCH/t17-db.ts" <command>`.

Commands:

- `fixture` resets and builds the following, then prints `{ courseId, lessonId, examId, assignmentId, submissionId, enrollmentId, legacyCourseId, legacyEnrollmentId }` as JSON:
  - **Lookups.** `course` is `Course` with slug `forex-trading-mastery`; `legacy` is the course with slug `crypto-trading-mastery`; `student` is the `User` with email `student@worldstreet.academy`. If any is missing, exit with a message saying which (run the catalogue, or open `/dashboard` as `student` once).
  - **Reset.** First delete the `Lesson`, `Exam` (and its `Question`s), `Assignment` and `Submission` rows on `course` whose title starts with `T17 `, plus the `ExamAttempt`s of the student's `course` enrollment.
  - `Lesson`: `{ course, title: "T17 lesson", type: "text", order: 1, isPublished: true }`.
  - `Exam`: `{ course, scope: "final", instructor: course.instructor, title: "T17 final", status: "published", settings: { passMarkPercent: 50 }, questionCount: 1, totalPoints: 1 }`. Its `Question` is `{ exam, type: "single", prompt: "2 + 2 = ?", options: [{ id: "a", text: "4" }, { id: "b", text: "5" }], correctOptionIds: ["a"], points: 1 }`. If `course` already has a final exam not titled `T17 `, exit and say so.
  - `Assignment`: `{ course, instructor: course.instructor, title: "T17 project", status: "published", kind: "project" }`.
  - **Enrollment.** Upsert the student's `course` enrollment by `{ user, course }` with `$set`: `status: "active"`, `packageKey: "standard"`, `packageName: "Standard"`, `activatedAt: now`, `pricePaid: 199`, `progress: 0`, `completedLessons: []`, `completedAt: null`, `examPassed: false`, `examPassedAt: null`, `bestScorePercent: null`, `certificateId: null`, `certificateTier: null`, `certificateTierAt: null`.
  - `Submission`: `{ assignment, course, user: student, enrollment, text: "T17 project work", status: "submitted", submittedAt: now }`.
  - **Legacy row.** Upsert the student's `legacy` enrollment with `$set` `{ status: "completed", completedAt: now, progress: 100, packageKey: null, packageName: null, certificateId: "WSA-T17LEGAC" }` and `$unset` `{ certificateTier: "", certificateTierAt: "" }`. That is a pre-Phase-17 certificate.
  - **Signatures.** Give both courses' instructors `signatureUrl: "/brand/wsa-mark.png"` where it is null, missing or empty, so the preview isn't overlaid and the PDF downloads.
- `read` prints both enrollments' `status`, `certificateId`, `certificateTier`, `certificateTierAt`, `examPassed` and `bestScorePercent` as JSON.
- `legacy-untiered` `$unset`s `certificateTier` and `certificateTierAt` on the legacy row.
- `legacy-status <status>` sets the legacy row's `status`.

## File structure

| File | Responsibility |
|---|---|
| `lib/certificate-tier.ts` (new) | Pure, client-safe tier rules: labels, titles, thresholds, `tierFor`, `nextTierNeeds`, the published requirement lines, `ALUMNI_LABEL` |
| `lib/db/models/enrollment.ts` (modify) | + `certificateTier`, `certificateTierAt` |
| `lib/certificate-standing.ts` (new) | Server-only `ensureCertificateTier`: gather the inputs, store a raise, return the standing |
| `lib/certificate-id.ts`, `lib/actions/assignments.ts`, `lib/actions/admin-enrollments.ts` (modify) | The triggers |
| `lib/actions/certificates.ts` (modify) | `tier` / `next` on `CertificateData`, `StudentCertificate`, `VerifiedCertificate`; the lazy trigger |
| `components/learn/certificate-view.tsx` (modify) | The paper and PDF title follow the tier |
| `app/(platform)/dashboard/certificates/page.tsx`, `components/dashboard/home-tiles.tsx` (modify) | Tier and next-tier needs; tile subtitle |
| `app/(marketing)/certification/page.tsx` (new) | The public requirements page |
| `app/sitemap.ts`, `components/marketing/footer.tsx`, `components/marketing/certificate-band.tsx`, `app/(marketing)/verify/[certificateId]/page.tsx` (modify) | Reach `/certification`; `/verify` prints the credential |
| `components/dashboard/alumni-chip.tsx` (new) | The "WMA Alumni" chip |
| `components/dashboard/learning-hero.tsx`, `app/(platform)/dashboard/page.tsx`, `app/(platform)/dashboard/profile/page.tsx` (modify) | Alumni on the greeting and the profile |
| `docs/go-patches-phase-3.md`, `docs/launch-runbook.md`, `docs/institutional-blueprint-plan.md`, `docs/mastery-academy-plan.md`, `context.md` (modify) | R13, owner steps, status |

---

### Task 1: The tier rules have one pure home

**Files:**
- Create: `lib/certificate-tier.ts`
- Test: `$SCRATCH/t17-tier.ts` (throwaway, outside the repository)

**Interfaces:**
- Consumes:
  - `PACKAGE_LABEL` from `lib/entitlements.ts` (Phase 14 makes `executive` read "Executive");
  - `type PackageKey` from `@/lib/db/models` (type-only import).
- Produces (exact copy below): `CertificateTier`, `CERT_TIERS`, `CERT_TIER_LABEL`, `CERT_TIER_TITLE`, `ALUMNI_LABEL`, `PRACTITIONER_PLANS`, `PRACTITIONER_MIN_SCORE`, `MASTERY_MIN_SCORE`, `MASTERY_MIN_PROJECT_GRADE`, `TierInput`, `NextTier`, `tierFor`, `higherTier`, `tiersBelow`, `nextTierNeeds`, `certificateTierLabel` and `CERT_TIER_REQUIREMENTS`.

- [ ] **Step 1: Check first, and record the baselines.**
  Run:
  ```bash
  grep -n "export const MASTERY_WEIGHTS\|export function masteryScore" lib/mastery-score.ts
  grep -n "export async function masteryInputsFor" lib/mastery-inputs.ts
  grep -n "kind" lib/db/models/assignment.ts
  grep -n 'executive: "Executive"' lib/entitlements.ts
  ls lib/certificate-tier.ts
  ```
  Expected: a hit for each of the first four (Phases 16 and 14 have merged), and `No such file` for the last. If any of the first four is missing, stop and report it: this phase starts after 14 and 16.
  Then record `pnpm lint 2>&1 | tail -3` (the error and warning counts) for Task 6's comparison.

- [ ] **Step 2: Write the assert script** `$SCRATCH/t17-tier.ts`:

```ts
import assert from "node:assert/strict"
import {
  CERT_TIER_LABEL, CERT_TIER_REQUIREMENTS, CERT_TIER_TITLE, certificateTierLabel,
  higherTier, nextTierNeeds, tierFor, tiersBelow, type TierInput,
} from "@/lib/certificate-tier"

const base: TierInput = {
  completed: true, certifies: true, packageKey: "standard", examPassed: true,
  hasFinalExam: true, score: 90, bestProjectGrade: 80,
}
// tierFor
assert.equal(tierFor(base), "mastery")
assert.equal(tierFor({ ...base, packageKey: "executive" }), "mastery")
assert.equal(tierFor({ ...base, completed: false }), null)
assert.equal(tierFor({ ...base, certifies: false }), null)
assert.equal(tierFor({ ...base, packageKey: "basic" }), "completion")
assert.equal(tierFor({ ...base, packageKey: null }), "completion", "ruling 4: legacy tops out at Completion")
assert.equal(tierFor({ ...base, examPassed: false }), "completion")
assert.equal(tierFor({ ...base, score: null }), "completion")
assert.equal(tierFor({ ...base, score: 70, bestProjectGrade: 100 }), "practitioner", "70 is inclusive")
assert.equal(tierFor({ ...base, score: 69 }), "completion")
assert.equal(tierFor({ ...base, score: 85, bestProjectGrade: 70 }), "mastery", "85 and 70 are inclusive")
assert.equal(tierFor({ ...base, score: 84 }), "practitioner")
assert.equal(tierFor({ ...base, bestProjectGrade: 69 }), "practitioner")
assert.equal(tierFor({ ...base, bestProjectGrade: null }), "practitioner")
// ordering helpers
assert.equal(higherTier(null, "completion"), "completion")
assert.equal(higherTier("mastery", "practitioner"), "mastery")
assert.equal(higherTier("completion", "practitioner"), "practitioner")
assert.equal(higherTier(null, null), null)
assert.deepEqual(tiersBelow("completion"), [null])
assert.deepEqual(tiersBelow("practitioner"), [null, "completion"])
assert.deepEqual(tiersBelow("mastery"), [null, "completion", "practitioner"])
// nextTierNeeds — measured against the STORED tier
assert.deepEqual(nextTierNeeds({ ...base, packageKey: "basic" }, "completion"), {
  tier: "practitioner", needs: ["Study on the Standard or Executive plan"],
})
assert.deepEqual(nextTierNeeds({ ...base, examPassed: false, score: null }, "completion"), {
  tier: "practitioner", needs: ["Pass the final exam", "Reach a Mastery Score of 70 (not enough data yet)"],
})
assert.deepEqual(nextTierNeeds({ ...base, examPassed: false, hasFinalExam: false, score: 64 }, "completion"), {
  tier: "practitioner",
  needs: ["Pass the final exam (this program has none published yet)", "Reach a Mastery Score of 70 (yours: 64)"],
})
assert.deepEqual(nextTierNeeds({ ...base, score: 78, bestProjectGrade: null }, "practitioner"), {
  tier: "mastery",
  needs: ["Reach a Mastery Score of 85 (yours: 78)", "Score 70 or more on a graded project (none graded yet)"],
})
assert.deepEqual(nextTierNeeds({ ...base, bestProjectGrade: 62 }, "practitioner"), {
  tier: "mastery", needs: ["Score 70 or more on a graded project (best so far: 62)"],
})
assert.deepEqual(nextTierNeeds({ ...base, score: 60, bestProjectGrade: 50 }, "practitioner"), {
  tier: "mastery",
  needs: ["Reach a Mastery Score of 85 (yours: 60)", "Score 70 or more on a graded project (best so far: 50)"],
}, "a stored tier above the computed one still points at the next rung")
assert.equal(nextTierNeeds(base, "mastery"), null)
assert.equal(nextTierNeeds(base, "completion"), null, "nothing unmet")
assert.equal(nextTierNeeds({ ...base, certifies: false }, "completion"), null)
// copy
assert.deepEqual(CERT_TIER_LABEL, {
  completion: "WMA Certificate of Completion",
  practitioner: "WMA Certified Practitioner",
  mastery: "WMA Mastery Certification",
})
assert.deepEqual(CERT_TIER_TITLE.practitioner, ["Certified", "Practitioner"])
assert.equal(certificateTierLabel(null), "WMA Certificate of Completion")
assert.equal(certificateTierLabel(undefined), "WMA Certificate of Completion")
assert.deepEqual(CERT_TIER_REQUIREMENTS, {
  completion: [
    "Complete every lesson your plan includes.",
    "Pass the final exam, where the program requires one.",
    "Open to every plan that includes a certificate.",
  ],
  practitioner: [
    "Earn the WMA Certificate of Completion.",
    "Pass the program's final exam.",
    "Reach a WMA Mastery Score of 70 or more.",
    "Study on the Standard or Executive plan.",
  ],
  mastery: [
    "Earn the WMA Certified Practitioner credential.",
    "Reach a WMA Mastery Score of 85 or more.",
    "Score 70 or more on a graded project.",
  ],
})
for (const line of Object.values(CERT_TIER_REQUIREMENTS).flat()) {
  assert.doesNotMatch(line, /null|undefined|NaN/)
}
console.log("certificate-tier: all assertions passed")
```

- [ ] **Step 3: Run it to see it fail.**
  Run: `npx tsx --tsconfig ./tsconfig.json "$SCRATCH/t17-tier.ts"`
  Expected: FAIL, `Cannot find module '@/lib/certificate-tier'`.

- [ ] **Step 4: Create `lib/certificate-tier.ts`.**
  - Its doc comment: the one home of the certificate tier rules (institutional blueprint §13, D25); client-safe; the thresholds are named constants the owner may tune; a stored tier is never lowered (`lib/certificate-standing.ts`).
  - The constants and types are exact:

```ts
import type { PackageKey } from "@/lib/db/models"
import { PACKAGE_LABEL } from "@/lib/entitlements"

export type CertificateTier = "completion" | "practitioner" | "mastery"
/** Ladder order. */
export const CERT_TIERS: readonly CertificateTier[] = ["completion", "practitioner", "mastery"]

/** §13, verbatim. */
export const CERT_TIER_LABEL: Record<CertificateTier, string> = {
  completion: "WMA Certificate of Completion",
  practitioner: "WMA Certified Practitioner",
  mastery: "WMA Mastery Certification",
}
/** The paper's two lines: large, then small. */
export const CERT_TIER_TITLE: Record<CertificateTier, readonly [string, string]> = {
  completion: ["Certificate", "of Completion"],
  practitioner: ["Certified", "Practitioner"],
  mastery: ["Mastery", "Certification"],
}
/** §19 / D19: a learner holding a certificate. */
export const ALUMNI_LABEL = "WMA Alumni"

/** D25 thresholds — inclusive. */
export const PRACTITIONER_PLANS: readonly PackageKey[] = ["standard", "executive"]
export const PRACTITIONER_MIN_SCORE = 70
export const MASTERY_MIN_SCORE = 85
export const MASTERY_MIN_PROJECT_GRADE = 70

export type TierInput = {
  /** Enrollment.status === "completed" (ruling 2). */
  completed: boolean
  /** The plan includes the certificate: entitlementsFor(course, enrollment).certificate. */
  certifies: boolean
  packageKey: PackageKey | null
  examPassed: boolean
  /** The program has a published final exam — read by nextTierNeeds' copy only. */
  hasFinalExam: boolean
  /** Phase 16's Mastery Score, 0–100; null until two parts have data. */
  score: number | null
  /** Best graded project-kind submission, 0–100; null when none is graded. */
  bestProjectGrade: number | null
}
export type NextTier = { tier: CertificateTier; needs: string[] }
```

  - Implement the functions:
    - `tierFor(input: TierInput): CertificateTier | null`:
      - null unless `completed && certifies`;
      - Practitioner needs a plan in `PRACTITIONER_PLANS`, `examPassed`, and `score !== null && score >= PRACTITIONER_MIN_SCORE`;
      - Mastery needs Practitioner, plus `score >= MASTERY_MIN_SCORE` and `bestProjectGrade !== null && bestProjectGrade >= MASTERY_MIN_PROJECT_GRADE`.
    - `higherTier(a, b): CertificateTier | null`: the one later in `CERT_TIERS`; null only when both are null.
    - `tiersBelow(tier): (CertificateTier | null)[]`: `null`, then every tier earlier in `CERT_TIERS`.
    - `nextTierNeeds(input: TierInput, current: CertificateTier): NextTier | null`:
      - null when `tierFor(input)` is null, when `current` is `"mastery"`, or when `needs` would be empty;
      - otherwise the target is the rung after `current`, and `needs` holds the target's unmet requirements in this order:
        - If the plan isn't in `PRACTITIONER_PLANS`: `needs` is **only** `` `Study on the ${PLAN_NAMES} plan` ``.
        - Otherwise, the exam: `"Pass the final exam"`, or with no published exam `"Pass the final exam (this program has none published yet)"`.
        - Then the score, against the target's minimum: `` `Reach a Mastery Score of ${min} (yours: ${score})` ``, or `"(not enough data yet)"` when it is null.
        - Then, for Mastery only, the project: `` `Score ${MASTERY_MIN_PROJECT_GRADE} or more on a graded project (best so far: ${grade})` ``, or `"(none graded yet)"`.
      - `PLAN_NAMES` is `PRACTITIONER_PLANS.map((k) => PACKAGE_LABEL[k]).join(" or ")`.
    - `certificateTierLabel(tier: CertificateTier | null | undefined): string`: `CERT_TIER_LABEL[tier ?? "completion"]`. That is how null reads everywhere, Go R13 included.
    - `CERT_TIER_REQUIREMENTS: Record<CertificateTier, readonly string[]>`, built with template literals:
      - from `CERT_TIER_LABEL` (the "Earn the …" lines);
      - from the three thresholds;
      - and from `PLAN_NAMES`.

      The exact values are in the step 2 asserts, so no number is typed twice.

- [ ] **Step 5: Run it to see it pass.**
  Run: `npx tsx --tsconfig ./tsconfig.json "$SCRATCH/t17-tier.ts"`
  Expected: `certificate-tier: all assertions passed`.

- [ ] **Step 6: Typecheck and lint.**
  Run: `npx tsc --noEmit && npx eslint lib/certificate-tier.ts`
  Expected: clean.

- [ ] **Step 7: Commit.**

```bash
git add lib/certificate-tier.ts
git commit -m "feat(certificates): the three WMA credentials and their rules, in one pure module"
```

---

### Task 2: The stored tier, raised at every trigger

**Files:**
- Modify: `lib/db/models/enrollment.ts`, `lib/certificate-id.ts`, `lib/actions/assignments.ts`, `lib/actions/admin-enrollments.ts`
- Create: `lib/certificate-standing.ts`
- Test: `$SCRATCH/t17-db.ts` (the fixture and DB helper, specified under "Verification server")

**Interfaces:**
- Consumes: from Task 1, `tierFor`, `higherTier`, `tiersBelow`, `nextTierNeeds`, `TierInput`, `NextTier` and `CertificateTier`. From Phase 16, `masteryInputsFor` (`lib/mastery-inputs.ts`), `masteryScore` (`lib/mastery-score.ts`) and `Assignment.kind`. From `lib/entitlements.ts`, `entitlementsFor`.
- Produces:
  - `IEnrollment.certificateTier: CertificateTier | null` and `IEnrollment.certificateTierAt: Date | null`;
  - from `lib/certificate-standing.ts`, `export type CertificateStanding = { tier: CertificateTier; next: NextTier | null }`;
  - `export async function ensureCertificateTier(enrollmentId: Types.ObjectId | string): Promise<CertificateStanding | null>`. It returns null when the enrollment isn't completed and certifying, or on any error, and it never throws.

- [ ] **Step 1: Check first.** Start the verification server, write `$SCRATCH/t17-db.ts`, and run `fixture`, then `read`.
  Expected: the forex row reads `status: "active"`. On this pre-change schema `certificateTier` is absent (the fixture's `$set` of an unknown path is dropped). The legacy row reads `status: "completed"`, `certificateId: "WSA-T17LEGAC"`.
  Run: `grep -rn "certificateTier" lib app components`
  Expected: hits only in `lib/certificate-tier.ts`.

- [ ] **Step 2: The schema.** In `lib/db/models/enrollment.ts`:
  - Add `import type { CertificateTier } from "@/lib/certificate-tier"`. That follows `course.ts`, which imports `SchoolSlug` the same way.
  - After the `certificateId` member of `IEnrollment`, add:

```ts
  /** Highest credential earned (institutional blueprint §13, D25). Web-written, never lowered (lib/certificate-standing.ts); null reads as Completion. Additive — Go R13. */
  certificateTier: CertificateTier | null
  /** When certificateTier last rose. */
  certificateTierAt: Date | null
```

  - In the schema, after `certificateId: { type: String, default: null },`:

```ts
    certificateTier: { type: String, enum: [null, "completion", "practitioner", "mastery"], default: null },
    certificateTierAt: { type: Date, default: null },
```

- [ ] **Step 3: Create `lib/certificate-standing.ts`.** It starts with `import "server-only"`. Its callers have already called `connectDB()`. `ensureCertificateTier(enrollmentId)` works as follows:
  1. Load the enrollment `.lean()`. Return null unless `status === "completed"`.
  2. Load its course with `packages`, plus any fields Phase 16's `masteryInputsFor` parameter type needs. Return null unless `entitlementsFor(course, enrollment).certificate`.
  3. Gather these in parallel:
     - `masteryScore(await masteryInputsFor(enrollment, course)).score`;
     - `hasFinalExam` = `Boolean(await Exam.exists({ course: enrollment.course, scope: "final", status: "published" }))`;
     - `bestProjectGrade` = the highest `grade` among `Submission`s with `enrollment: enrollment._id`, `status: "graded"` and a non-null grade, whose `assignment` is in `Assignment.find({ course: enrollment.course, kind: "project" })`. It is null when there are no projects or nothing is graded (a private helper).
  4. Build the `TierInput` (`packageKey: enrollment.packageKey ?? null`, `examPassed: Boolean(enrollment.examPassed)`). Then `computed = tierFor(input)` and `stored = enrollment.certificateTier ?? null`.
  5. **Raise only.** When `higherTier(stored, computed) !== stored`, run `Enrollment.updateOne({ _id, status: "completed", certificateTier: { $in: tiersBelow(computed) } }, { $set: { certificateTier: computed, certificateTierAt: new Date() } })`.
     - On `modifiedCount === 1`, the current tier is `computed`.
     - Otherwise re-read `certificateTier` and use what is stored. If that is null, the row left `completed`, so return null.
     - When no raise is needed, the current tier is `stored`.
  6. Return `{ tier: current, next: nextTierNeeds(input, current) }`.
  7. The whole body sits in `try/catch`, which logs `` `[Certificates] failed to set the certificate tier for enrollment ${id}` `` with the error and returns null.

  Its doc comment repeats ruling 6 (who calls it) and ruling 7 (never lowered; a stored tier outlives a status change).

- [ ] **Step 4: The triggers.**
  - `lib/certificate-id.ts`, in `saveWithCertificateId`, after `await ensureCertificateId(enrollment, firstCompletion)`: `if (enrollment.status === "completed") await ensureCertificateTier(enrollment._id)`.
    - Extend the function's doc comment: a completion and every final-exam attempt (`gradeAttempt` calls this on each one) re-evaluate the credential.
    - Extend the file header: tiers live in `lib/certificate-tier.ts` and `lib/certificate-standing.ts`.
  - `lib/actions/assignments.ts`, in `gradeSubmission`:
    - Change `.select("course user assignment")` to `.select("course user assignment enrollment")`.
    - Just after the `void awardPoints({` call that awards `kind: "assignment_graded"`, add `await ensureCertificateTier(submission.enrollment)` with the comment "A graded project can raise the credential (D25)".
  - `lib/actions/admin-enrollments.ts`:
    - After `if (action === "restore") await ensureCertificateId(enrollment, false)`, add `if (action === "restore") await ensureCertificateTier(enrollment._id)`.
    - After the package change's `await ensureCertificateId(enrollment, false)` (the one under "An upgrade can make an existing completion certify"), add `await ensureCertificateTier(enrollment._id)`.

- [ ] **Step 5: Typecheck and lint.**
  Run: `npx tsc --noEmit`, then `npx eslint` on each of `lib/db/models/enrollment.ts`, `lib/certificate-standing.ts`, `lib/certificate-id.ts`, `lib/actions/assignments.ts` and `lib/actions/admin-enrollments.ts`.
  Expected: clean.

- [ ] **Step 6: Restart the verification server** (the schema changed), then run `fixture` again and keep the printed ids.
  Run `read`. Expected: forex `certificateTier: null`, `certificateTierAt: null`; the legacy row has no `certificateTier` key.

- [ ] **Step 7: Drive every trigger.** After each action, run `read`.
  - (a) As `student`, open `/dashboard/courses/<courseId>/learn/<lessonId>` and press "Mark as complete".
    Expected: forex `status: "completed"`, `certificateId` matches `^WSA-[0-9A-Z]{8}$`, `certificateTier: "completion"`, and `certificateTierAt` is set (note it).
  - (b) As `student`, open `/dashboard/courses/<courseId>/exam`, press "Start exam", choose "4", then "Submit exam".
    Expected: `examPassed: true`, `bestScorePercent: 100`, `certificateTier: "practitioner"`, and `certificateTierAt` is later than (a). The score is 100 here: completion 100 and assessment 100, with the other parts empty.
  - (c) As `admin`, open `/instructor/courses/<courseId>/assignments`, give the T17 project submission a grade of 80 with feedback "Good", and press "Save grade".
    Expected: `certificateTier: "mastery"`, with `certificateTierAt` later than (b). The score is round((30·100 + 25·100 + 10·80) / 65) = 97.
  - (d) **Review Focus 3.** Re-grade it 40 and press "Update grade".
    Expected: `certificateTier` is still `"mastery"`, and `certificateTierAt` is equal to (c)'s.
  - (e) The legacy row still has no `certificateTier`: nothing has opened it yet.

  These expected values assume Phase 16 drops attendance when no class has been held (D24: "parts with no data drop out"). If (b) or (c) comes out lower because attendance reads `0`, report it as a Phase 16 defect against D24. Don't change a threshold.

- [ ] **Step 8: Commit.**

```bash
git add lib/db/models/enrollment.ts lib/certificate-standing.ts lib/certificate-id.ts lib/actions/assignments.ts lib/actions/admin-enrollments.ts
git commit -m "feat(certificates): store the highest tier earned — raised on completion, exam, grade and admin changes, never lowered"
```

---

### Task 3: The certificate and the learner's list show the tier

**Files:**
- Modify: `lib/actions/certificates.ts` (`fetchCertificate`, `fetchMyCertificates`), `components/learn/certificate-view.tsx`, `app/(platform)/dashboard/certificates/page.tsx`, `components/dashboard/home-tiles.tsx`

**Interfaces:**
- Consumes: `ensureCertificateTier` (Task 2); `CERT_TIER_LABEL`, `CERT_TIER_TITLE`, `NextTier` and `CertificateTier` (Task 1).
- Produces:
  - `CertificateData.tier: CertificateTier`;
  - `StudentCertificate.tier: CertificateTier` and `StudentCertificate.next: NextTier | null`.

  `fetchMyCertificates()` stays the one list. Task 5 counts it for Alumni, and the home and Vivid read it unchanged.

- [ ] **Step 1: Check first.**
  Run: `text /dashboard/certificates student | grep -c "WMA Mastery Certification"`
  Expected: `0`. The card still reads "Certificate of Completion".

- [ ] **Step 2: `lib/actions/certificates.ts`.**
  - **`fetchCertificate`.** After `const certificateId = enrollment.certificateId ?? (await ensureCertificateId(enrollment, false))`, run `const standing = await ensureCertificateTier(enrollment._id)`. Return `tier: standing?.tier ?? enrollment.certificateTier ?? "completion"`.
  - **`fetchMyCertificates`.**
    - After the `.filter(…certificate)`, run `ensureCertificateTier` for every kept row with `Promise.all` (a learner holds few certificates; no batching).
    - Each row gets `tier: standing?.tier ?? row.certificateTier ?? "completion"` and `next: standing?.next ?? null`.
  - Add both fields to the exported types, with doc comments (null stored reads as Completion; `next` is what the next rung needs, null at the top or when nothing is left).

- [ ] **Step 3: `components/learn/certificate-view.tsx`.**
  - **Preview.** In `CertificatePreview`, take `const [titleMain, titleSub] = CERT_TIER_TITLE[data.tier]`. The `<h1>` whose text is `Certificate` renders `titleMain`. The `<p>` whose text is `of Completion` renders `titleSub`. Keep the classes.
  - **PDF.** In `downloadPDF`, `doc.text("CERTIFICATE", cx, 56, …)` takes `titleMain.toUpperCase()` and `doc.text("OF COMPLETION", cx, 63, …)` takes `titleSub.toUpperCase()`. Update the two section comments ("Certificate" title / "of Completion" subtitle) to say they follow the tier.
  - Everything else on the paper stays, "for successfully completing the program" included. Every tier includes completion.

- [ ] **Step 4: `/dashboard/certificates` and the home tile.**
  - **Card eyebrow.** The `<p>` reading `Certificate of Completion` renders `CERT_TIER_LABEL[cert.tier]`.
  - **Next rung.** When `cert.next`, the card shows a block between the instructor row and the footer.
    - Its eyebrow is `` `Next · ${CERT_TIER_LABEL[cert.next.tier]}` ``, in `text-[11px] font-medium uppercase tracking-[0.1em] text-ws-subtle`.
    - Under it, a `<ul>` of `cert.next.needs`, in `text-[13px] text-ws-muted`. Scores and grades stay plain text, the numbers already inside the strings; give the list `tabular-nums`.
    - It is plain text inside the card's link: no nested links.
  - **Header link.** After the header's subtitle `<p>`, add a text link "How certification works" → `/certification`, in `text-[13px] font-medium text-ws-muted hover:text-ws-primary`, with `ArrowRightIcon` at size 14.
  - **Home tile.** In `components/dashboard/home-tiles.tsx`, `CertificatesTile`'s row subtitle changes from `Earned {formatShortDate(cert.completedAt, now)}` to `` `${CERT_TIER_LABEL[cert.tier]} · Earned ${formatShortDate(cert.completedAt, now)}` ``. It keeps `truncate`.

- [ ] **Step 5: Verify against Task 2's state** (forex is at Mastery). **Review Focus 2**, part one, is in this step.
  - Run: `text /dashboard/certificates student | grep -oE "WMA Mastery Certification|WMA Certificate of Completion|How certification works" | sort -u`
    Expected: all three. Forex reads Mastery, and the legacy row reads Completion.
  - Run: `text /dashboard/certificates student | grep -o "Next ·" | wc -l`. `text` prints one line, so count matches, not lines.
    Expected: `1`. That is the legacy row's ("Study on the Standard or Executive plan"), since Mastery has no next rung.
  - Run `fixture` again, then repeat Task 2, step 7(a) only. Now:
    Run: `text /dashboard/certificates student | grep -oE "Next · WMA Certified Practitioner|Pass the final exam|Reach a Mastery Score of 70 \(not enough data yet\)" | sort -u`
    Expected: all three.
    Run: `text /dashboard/certificates student | grep -cE "null|NaN|undefined"`
    Expected: `0`.
  - Then repeat 7(b) and 7(c) to bring forex back to Mastery.

- [ ] **Step 6: The legacy certificate (Review Focus 1).**
  - Run `legacy-untiered`. Then: `text "/dashboard/courses/<legacyCourseId>/certificate" student | grep -oE "of Completion|Practitioner|Mastery Certification" | sort -u`
    Expected: `of Completion` only.
  - Run `read`. Expected: the legacy row now has `certificateTier: "completion"`; opening the certificate stored it.

- [ ] **Step 7: Look at it (Review Focus 5).** In a browser, as `student`, open `/dashboard/courses/<courseId>/certificate`.
  - The preview reads "Mastery / Certification" and is not overlaid.
  - At 390 and 320 px the title stays inside the frame, and `document.documentElement.scrollWidth <= innerWidth`.
  - Press "Download PDF" and keep the file. Run `grep -ac "MASTERY" <file>` and `grep -ac "CERTIFICATION" <file>`; each must be ≥ 1, and `grep -ac "OF COMPLETION" <file>` must be `0`. jsPDF writes uncompressed text by default. Open the PDF once and check that the title is centred.
  - On `/dashboard` the Certificates tile row reads "WMA Mastery Certification · Earned …".

- [ ] **Step 8: Typecheck, lint and commit.**

```bash
npx tsc --noEmit
npx eslint lib/actions/certificates.ts
npx eslint components/learn/certificate-view.tsx
npx eslint "app/(platform)/dashboard/certificates/page.tsx"
npx eslint components/dashboard/home-tiles.tsx
git add lib/actions/certificates.ts components/learn/certificate-view.tsx "app/(platform)/dashboard/certificates/page.tsx" components/dashboard/home-tiles.tsx
git commit -m "feat(certificates): the certificate prints its tier; the list shows it and what the next one needs"
```

---

### Task 4: `/certification`, and `/verify` names the credential

**Files:**
- Create: `app/(marketing)/certification/page.tsx`
- Modify: `lib/actions/certificates.ts` (`verifyCertificate`), `app/(marketing)/verify/[certificateId]/page.tsx`, `app/sitemap.ts`, `components/marketing/footer.tsx`, `components/marketing/certificate-band.tsx`

**Interfaces:**
- Consumes:
  - from Task 1: `CERT_TIERS`, `CERT_TIER_LABEL`, `CERT_TIER_REQUIREMENTS` and `certificateTierLabel`;
  - `MASTERY_WEIGHTS` (Phase 16);
  - `SectionLabel` and `SectionTitle` (`components/marketing/section-heading.tsx`), `appUrl` (`lib/app-url.ts`).
- Produces: `VerifiedCertificate.tier: CertificateTier`, and the public route `/certification`.

- [ ] **Step 1: Check first.**
  Run: `curl -s -o /dev/null -w "%{http_code}\n" $BASE/certification`
  Expected: `404`.

- [ ] **Step 2: `verifyCertificate`.** Add `certificateTier` to its `.select("user course completedAt packageKey certificateId")`, and return `tier: enrollment.certificateTier ?? "completion"`. No computation here (ruling 6). Add `tier` to `VerifiedCertificate`, with a comment that it holds the stored tier and that null reads as Completion.

- [ ] **Step 3: The `/verify` page.**
  - Make `<Field label="Credential" value={certificateTierLabel(certificate.tier)} />` the first field in the `<dl>`.
  - Wrap the closing "Explore the schools" link in `<div className="mt-10 flex flex-wrap gap-3">`; the link loses its own `mt-10`. Add a second link in the same outline style: "How WMA credentials work" → `/certification`.

- [ ] **Step 4: Create `app/(marketing)/certification/page.tsx`.** It is a static server page with no data fetch, in `/teach`'s grammar (that page's `GOLD_CTA` and `CARD` class strings, `SectionLabel` and `SectionTitle`).
  - **Metadata:** title `"Certification"`; description `"The three WMA credentials (Certificate of Completion, Certified Practitioner and Mastery Certification) and what each one requires."`; `alternates: { canonical: appUrl("/certification") }`.
  - **Hero:** `SectionLabel` "Certification"; `h1` "WMA Certification"; the lede "Every WMA credential corresponds to published academic requirements and demonstrated competency." (§13, adapted from "should").
  - **The credentials:** an `<ol aria-label="WMA credentials">` of three 20 px cards in `CERT_TIERS` order.
    - Each card shows its rung number (`tabular-nums`), an `h2` with `CERT_TIER_LABEL[tier]`, and a `<ul>` of `CERT_TIER_REQUIREMENTS[tier]`, each line led by `CheckIcon` at size 15.
    - The cards stack on phones and sit in three columns from `lg`.
  - **`h2` "The WMA Mastery Score":**
    - The line "A score from 0 to 100 for each program, built from five parts:".
    - Then one chip per `MASTERY_WEIGHTS` entry, in its key order, reading `` `${PART_LABEL[key]} ${weight}` `` with `tabular-nums`. That gives "Completion 30", "Assessments 25", "Assignments 20", "Projects 10" and "Attendance 15".
    - Then the line "Parts your plan doesn't include never count against you, and the score shows once two parts have data." Write it as a `{"…"}` string because of the apostrophe.
    - `PART_LABEL` is Phase 16's label record, if `lib/mastery-score.ts` exports one. Otherwise it is a local `Record<keyof typeof MASTERY_WEIGHTS, string>` holding exactly those five words.
  - **`h2` "One certificate per program":** "Each program issues one certificate with one ID. It shows the highest credential you have earned, reprints under the same ID when you reach a higher one, and is never lowered. Every certificate carries an ID that anyone can verify online."
  - **Close:** a gold "Explore programs" → `/programs`.

- [ ] **Step 5: Reach it.**
  - **Sitemap.** In `app/sitemap.ts`, add `{ url: appUrl("/certification") },` right after `{ url: appUrl("/teach") },`, and add `/certification` to the doc comment's list of pages.
  - **Footer.** In `components/marketing/footer.tsx`, add `<li>` "Certification" → `/certification` in the Academy column, immediately before the `<li>` holding `href="/#faq"`, with the same link classes.
  - **Certificate band.** In `components/marketing/certificate-band.tsx`, right after the `SHOWS` `<ul>`:
    - Add `<p className="mt-6 max-w-xl text-[14px] text-ws-muted">` reading `` `Three credentials: ${CERT_TIERS.map((t) => CERT_TIER_LABEL[t]).join(" · ")}.` ``.
    - Under it, a text link "See what each one requires" → `/certification`, with `ArrowRightIcon` at size 14, muted and turning primary on hover.
    - The band's sample card stays "Certificate of Completion".

- [ ] **Step 6: Verify the page and the links (Review Focus 1, on `/verify`).**
  - Run: `curl -s -o /dev/null -w "%{http_code}\n" $BASE/certification`
    Expected: `200`.
  - Run: `text /certification | grep -oE "WMA Certificate of Completion|WMA Certified Practitioner|WMA Mastery Certification|Mastery Score of 70 or more|Mastery Score of 85 or more|70 or more on a graded project|Standard or Executive plan|Completion 30|Attendance 15" | sort -u`
    Expected: all nine.
  - Run: `curl -s $BASE/certification | grep -o '<link rel="canonical"[^>]*>'; curl -s $BASE/sitemap.xml | grep -c "/certification<"`
    Expected: a canonical ending in `/certification`, and `1`.
  - Run: `html / | grep -o 'href="/certification"' | wc -l`
    Expected: `2` (the footer and the band).
  - Run `legacy-untiered`. Then: `text /verify/WSA-T17LEGAC | grep -oE "Valid|Credential|WMA Certificate of Completion|How WMA credentials work" | sort -u`
    Expected: all four, before anyone opens that certificate.
  - Run: `text "/verify/<forex certificateId from read>" | grep -o "WMA Mastery Certification"`
    Expected: one line.

- [ ] **Step 7: An enrollment that left `completed` (Review Focus 4).**
  - Run `legacy-status refunded`. Then: `text /verify/WSA-T17LEGAC | grep -c "No certificate with this ID"; text /dashboard/certificates student | grep -c "WMA Certificate of Completion"`
    Expected: `1`, then `0`. The legacy card is gone, and forex reads Mastery.
  - Run `legacy-status completed` to restore it.

- [ ] **Step 8: Look at it (Review Focus 5).** Check `/certification` in dark and light, at 1440, 390 and 320 px:
  - no horizontal scroll;
  - the cards stack;
  - the weight chips wrap;
  - the headings run in order (`h1` → `h2`);
  - gold appears only on "Explore programs".

  Check `/verify/<id>` at 390 px: the two links wrap.

- [ ] **Step 9: Typecheck, lint and commit.**

```bash
npx tsc --noEmit
npx eslint "app/(marketing)/certification/page.tsx"
npx eslint lib/actions/certificates.ts
npx eslint "app/(marketing)/verify/[certificateId]/page.tsx"
npx eslint app/sitemap.ts
npx eslint components/marketing/footer.tsx
npx eslint components/marketing/certificate-band.tsx
git add "app/(marketing)/certification/page.tsx" lib/actions/certificates.ts "app/(marketing)/verify/[certificateId]/page.tsx" app/sitemap.ts components/marketing/footer.tsx components/marketing/certificate-band.tsx
git commit -m "feat(certification): /certification publishes the three credentials; /verify names the one earned"
```

---

### Task 5: WMA Alumni

**Files:**
- Create: `components/dashboard/alumni-chip.tsx`
- Modify: `components/dashboard/learning-hero.tsx` (`HomeGreeting`), `app/(platform)/dashboard/page.tsx`, `app/(platform)/dashboard/profile/page.tsx`

**Interfaces:**
- Consumes: `ALUMNI_LABEL` (Task 1); `useMyCertificates` from `@/lib/hooks/queries` (it reads `fetchMyCertificates`, Task 3).
- Produces:
  - `AlumniChip({ className }: { className?: string })`, a hook-free component that client parents can render;
  - a required prop `alumni: boolean` on `HomeGreeting`.

- [ ] **Step 1: Check first.** In a browser, as `student`, open `/dashboard`.
  Expected: no "WMA Alumni" text.

- [ ] **Step 2: Create `components/dashboard/alumni-chip.tsx`.**
  - A pill: `inline-flex items-center gap-1 rounded-full bg-ws-chip px-2.5 py-0.5 text-[12px] font-semibold normal-case tracking-normal text-ws-primary`.
  - `GraduationCapIcon` at size 13 with `aria-hidden`, then `ALUMNI_LABEL`.
  - No gold surface; the duotone glyph carries the brand.
  - Its doc comment cites §19 / D19 and ruling 9.

- [ ] **Step 3: The greeting.**
  - **`HomeGreeting`** (`export function HomeGreeting(` in `components/dashboard/learning-hero.tsx`) gains `alumni: boolean`.
    - When it is true, the eyebrow line becomes `<div className="flex flex-wrap items-center gap-2">`, holding the existing eyebrow `<p>` (the first child of its `<header>`, which Phase 15 made read "WMA Campus") and then `<AlumniChip />`.
    - When it is false, the markup is unchanged.
  - **The dashboard page.** In `app/(platform)/dashboard/page.tsx`, pass `alumni={certificates.length > 0}` to `<HomeGreeting`. `certificates` is the page's existing `useMyCertificates(showCertificates)` result, so no new query.

- [ ] **Step 4: The profile.** In `app/(platform)/dashboard/profile/page.tsx`:
  - Read `const { data: certificates = [] } = useMyCertificates()`.
  - Wrap `<h2 className="text-lg font-semibold">{fullName}</h2>` in `<div className="flex flex-wrap items-center gap-2">` with `{certificates.length > 0 && <AlumniChip />}` after it.

- [ ] **Step 5: Verify, in a browser** (both pages hydrate from React Query).
  - As `student`, which holds certificates since Tasks 2–4: `/dashboard` and `/dashboard/profile` each show "WMA Alumni" once the queries settle.
  - As `instructor`, with no certificate: `/dashboard/profile` shows no "WMA Alumni".
  - At 390 px the greeting's eyebrow and chip wrap without overflow. In light theme the chip is legible.

- [ ] **Step 6: Typecheck, lint and commit.**

```bash
npx tsc --noEmit
npx eslint components/dashboard/alumni-chip.tsx
npx eslint components/dashboard/learning-hero.tsx
npx eslint "app/(platform)/dashboard/page.tsx"
npx eslint "app/(platform)/dashboard/profile/page.tsx"
git add components/dashboard/alumni-chip.tsx components/dashboard/learning-hero.tsx "app/(platform)/dashboard/page.tsx" "app/(platform)/dashboard/profile/page.tsx"
git commit -m "feat(alumni): certificate holders are WMA Alumni on their greeting and profile"
```

---

### Task 6: Go note R13, owner steps, status, and the closing run

**Files:**
- Modify: `docs/go-patches-phase-3.md`, `docs/launch-runbook.md`, `docs/institutional-blueprint-plan.md`, `docs/mastery-academy-plan.md`, `context.md`

**Interfaces:** none.

- [ ] **Step 1: The Go note.** In `docs/go-patches-phase-3.md`, append a section numbered one past the last `## N.` heading present (ruling 13): `## N. Certificate tiers (Phase 17, institutional blueprint §13)`. It opens "Go needs no patch to keep working: everything is additive." Then **R13**:
  - **Fields.**
    - `enrollments.certificateTier` is `"completion" | "practitioner" | "mastery" | null`; missing means null.
    - `enrollments.certificateTierAt` is a date or null.
    - Only the web writes them, and it never lowers the tier. Go must not write them, and any wholesale enrollment write must carry them, alongside R9's `certificateId` and R11's `mentorRoadmap` (use dotted paths).
  - **Rendering on mobile.** Print the tier's name: "WMA Certificate of Completion", "WMA Certified Practitioner" or "WMA Mastery Certification". When it is null, print "WMA Certificate of Completion". R9's ID rules are unchanged: one `WSA-` ID per enrollment, and a higher tier reprints under the same ID.
  - **Who decides.** The web computes the tier: completion, the final exam, the Mastery Score and a graded project, as published at `/certification`. A completion made through Go gets its tier the next time the learner opens their certificates on the web. Go needs no tier logic.

- [ ] **Step 2: The runbook.** In `docs/launch-runbook.md`, add a section `## Certification tiers — Phase 17 (\`mastery/phase-17\`)`. Place it after the last phase section present and before `## 0. Blockers — settle these first`. It reads:
  - No script, no env and no index. Deploy as usual. The Go R13 release is optional: without it, mobile prints "Certificate of Completion" for every tier.
  - Smoke test after the deploy:
    - `/certification` is 200;
    - `/verify/<an ID from §7>` shows "Credential · WMA Certificate of Completion";
    - the footer links `/certification`.
  - Owner content:
    - The thresholds (70, 85, a project of 70) live in `lib/certificate-tier.ts`, and a change needs a deploy. Raising one never takes a tier away, because stored tiers never go down.
    - Practitioner and Mastery need a **published final exam** on the program. Catalogue programs have none yet.
    - The `/certification` copy needs your sign-off.

- [ ] **Step 3: Status.**
  - In `docs/institutional-blueprint-plan.md`:
    - tick Phase 17's two exit criteria;
    - set Phase 17's row in §3's table to `done (2026-MM-DD, N commits)`;
    - remove ⛔ from the Phase 17 heading;
    - change "**Blocked on:** D25" to "**Built on:** D25's thresholds (owner, 2026-10-19)".
  - In `docs/mastery-academy-plan.md`, set Phase 17's status-board row to match.
  - In `context.md`'s Decision Log, add a dated entry: the three tiers; the stored, never-lowered `certificateTier`; `/certification`; WMA Alumni; and rulings 3 and 4.

- [ ] **Step 4: Whole-repo checks.**
  Run: `pnpm lint 2>&1 | tail -3` and `npx tsc --noEmit`
  Expected: no new lint errors or warnings against Task 1, step 1's numbers, and a clean tsc.

- [ ] **Step 5: The closing run.** With the verification server and the fixture in its Task 4 end state, check each page at 1440 and 390 px, in dark and light:
  - `/certification` and `/verify/<forex ID>` (as `guest`);
  - `/dashboard/certificates`, `/dashboard/courses/<courseId>/certificate`, `/dashboard` and `/dashboard/profile` (as `student`).

  Pass means:
  - no horizontal scroll;
  - no console errors apart from the known Vivid 403 and placeholder-key Ably 500s;
  - a hydration warning only where `/dashboard/my-courses` already shows one.

  Then stop the server.

- [ ] **Step 6: Commit.**

```bash
git add docs/go-patches-phase-3.md docs/launch-runbook.md docs/institutional-blueprint-plan.md docs/mastery-academy-plan.md context.md
git commit -m "docs: Phase 17 — Go R13, the certification runbook step and status"
```

## Report (end of phase)

Read out Phase 17's exit criteria from `docs/institutional-blueprint-plan.md`, then add:
- the `/certification` and requirement copy, for the owner's sign-off (ruling 11);
- rulings 3 and 4 (Practitioner needs a published final exam; legacy and free enrollments top out at Completion), so the owner can object;
- whether Phase 16 needed a call-site adaptation (ruling 1), and how attendance behaved with no classes (Task 2, step 7);
- for the controller, the line to add to the git-excluded `CLAUDE.md`, under "Catalogue, packages and trust": "`lib/certificate-tier.ts` — the three WMA credentials (labels, D25 thresholds, `tierFor`, `nextTierNeeds`, published requirements); `lib/certificate-standing.ts` — `ensureCertificateTier`, which stores `Enrollment.certificateTier`, never lowered, raised from `saveWithCertificateId`, `gradeSubmission`, admin enrollment changes and when a learner opens their certificates."
