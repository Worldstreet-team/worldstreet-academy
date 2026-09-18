# Mastery Academy — Phase 9 Implementation Plan (School-first enrolment + the visual uplift)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A visitor picks a school on the landing page, that choice survives sign-up, and before the dashboard opens they either pay for it or save it to pay later. Every school and program surface carries imagery and purposeful motion, so the Academy invites people to learn the way Coursera and Udemy do.

**Owner direction (voice note, 2026-09-16 — the spec, verbatim):**

> "I just checked what you did and it's good work, but I think that the UI is a little bit mundane for an academy. When you look at the likes of Coursera and Udemy, it's a bit more flashy and invites you to learn. […] In the file I sent you, you'd see that there are different schools. On the landing page, that's where people can pick the schools before they even have access to their dashboard. They should have picked the school first. Then it tells them to pay for the school. Or they can keep the school — bookmark the school to pay later. […] I need you to add more pizzazz and more razzmatazz to it."

**What is wrong today (verified in code, 2026-09-18):**

| # | Finding | Evidence |
|---|---|---|
| 1 | Sign-up dead-ends. "Start learning" goes to the hub's `/register` with no return address, so a new learner lands on the hub, or on an empty Academy dashboard with a tour. Nothing ever asks for a school. | `components/marketing/landing.tsx:18`, `components/marketing/hero-wall.tsx:200` |
| 2 | "Save for later" cannot hold a school. `Bookmark` is `{ user, course }`, signed-in only. | `lib/db/models/bookmark.ts:18` |
| 3 | An unpaid checkout leaves no trace. Nothing on the dashboard or by email brings the learner back. | `app/(checkout)/dashboard/checkout/page.tsx` |
| 4 | There is no imagery. All 12 program thumbnails are content debt, so the hero's drifting wall renders nothing (`rows.length === 0`), school cards are eight identical icon tiles, and student cards print "No thumbnail". | `hero-wall.tsx:40-47`, `school-card.tsx`, `components/courses/course-card.tsx:49` |
| 5 | The schools section is fifth on the landing, below About and Why. | `landing.tsx:76-88` |

**What "4× better" means here (the exit bar, all measurable):**

1. No route from sign-up reaches an empty dashboard: a learner with no enrollment and no saved school always lands on the school picker.
2. A school can be chosen in the landing's first viewport.
3. Landing → Pay is 4 clicks for the five single-program schools (chip → Start → Continue to payment → Pay). Today it is 5, and the register path never gets there at all.
4. Every unpaid choice is recoverable: a dashboard hero card, plus emails at 24 h and 72 h.
5. Zero empty art boxes on any public or student surface.
6. The surfaces a learner browses are no longer plain: program cards name their school and instructor and peek their outcomes; `/programs` shows each school's cover beside its programs; the student browse page is on the v2 kit and filters by school; the landing's one action follows the visitor down the page and the certificate is shown, not just described.

**Architecture:**
- **Data.** One new collection, `enrollmentintents`: one row per user, "the school I picked". No existing field changes. The money path (`purchaseCourse`) is not touched; an intent converts lazily when its enrollment is seen.
- **Rules.** Pure and importable, like `lib/entitlements.ts`: `lib/start-gate.ts` (who is gated; which step shows) and `lib/school-art.ts` (which image a school or program shows).
- **Flow.** A chrome-less `(start)` route group serves `/dashboard/start`. Steps are URL-driven (`?school=` → `?program=`), so the back button works and the landing can deep-link. The gate lives in `app/(platform)/layout.tsx`, where this repo keeps its gates, and **fails open**.
- **Guests.** The choice rides the URL through login (`/dashboard/start?school=…` is a protected path, so middleware already bounces and returns). A first-party cookie `wsa_school` is the fallback when the hub drops the return address.
- **Art.** Eight code-owned school covers in `public/art/schools/`. A program without its own thumbnail shows its school's cover, resolved once in the student read models, so every surface fills at the same moment.
- **Colour** comes from the imagery. No token changes; gold stays meaning-only.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict · Mongoose 9 · Zod (`zod/v4`) · Tailwind v4 + DS v2 `ws-*` tokens · `motion` (already installed) · TanStack Query · `sharp` (already installed) · Resend.

**Spec:** the voice note above · `docs/mastery-academy-blueprint.md` §4 (schools), §11 ("CHOOSE YOUR SCHOOL" is step 1), §17 (journey), §18 ("premium education marketplace") · `../design-system/` 01, 05, 06.

**Branch:** `feat/school-first`, cut from `feat/student-dashboard-revamp` **after** its in-flight work is committed (see Preflight). Estimated 13–14 working days: Parts A–D 7–8, Part E 3, Part F 3. **Task order:** 1–11, then 13–21, then Task 12 (docs and the journey run) last.

## Controller rulings (binding — do not re-litigate)

1. **"Pay for the school" means pay for a program inside it (v1).** Schools have no price; packages belong to programs (`lib/entitlements.ts`). Five of eight schools hold exactly one program, so for them choosing the school *is* choosing the program and the flow skips straight to packages. Trading (2), Digital Media (2) and Digital Business (3) add one "choose your program" step. A true **school pass** (one price for every program in a school) is *not built*: it needs owner prices and touches entitlements, `Order`, the Go API and multi-instructor earnings. It is recorded as the Phase 10 candidate at the end of this file.
2. **"Bookmark the school" is an `EnrollmentIntent`, not a `Bookmark`.** `Bookmark` has a unique `{ user, course }` index that Go and the mobile app read; a school has no course id. A new collection is additive and invisible to Go.
3. **One intent per user; the newest choice wins.** A unique index on `user`. Saving again overwrites. Changing school or program resets the nudge ledger.
4. **Who is gated:** role `USER`, `instructorStatus === "none"`, no `Enrollment` row of any status, no `EnrollmentIntent` row of any status. Exempt paths: `/dashboard/start`, `/dashboard/checkout`, `/dashboard/become-instructor`, `/dashboard/meetings` (interview and invite links). *Why:* instructors, applicants and existing students must never be asked to pick a school to reach what they already have.
5. **Choosing a school is mandatory; paying is not.** `/dashboard/start` has no skip. One tap plus "Save and pay later" opens the dashboard.
6. **The gate fails open.** If its two lookups throw, nobody is redirected. A broken gate must not lock the dashboard.
7. **Reaching checkout is choosing.** The checkout page records the intent on load, so an abandoned order is recoverable and the wallet-funding round trip is never gated.
8. **Motion lives on marketing surfaces and in one-shot moments.** The app shell keeps the 2026-09-15 rule: no background animation, no infinite loops, no hover scaling. The hero cover crossfade fires on a user's tap, so it is not ambient.
9. **Icons:** every surface this plan touches is a lucide surface (`SchoolIcon` renders lucide names). Do not introduce Hugeicons into them.
10. **Instructor surfaces keep "No thumbnail".** That label tells an instructor to upload art. Only student and public surfaces fall back to the school cover.

## Global Constraints

- No new dependencies. No `any`. No secrets in code. Zod is `import { z } from "zod/v4"`.
- Never hardcode a palette hex: `var(--ws-*)` / `ws-*` utilities only. Gold = primary CTA, active state, brand. Never a tab, never decoration.
- Base UI composition uses `render`, never `asChild`.
- Every action: `connectDB()` → auth → Zod parse → mutate → `revalidatePath()` → return `{ success: true, data }` or `{ success: false, error }`. Actions return errors; they do not throw.
- Any user id comes from `getCurrentUser()`, never from the browser.
- Schema changes are additive. Go reads the same database.
- Mirror the local-dev switch (`pk_test_` → `/login`) in every new auth redirect.
- Page content clears the mobile bottom nav: `pb-24 md:pb-8` inside `(platform)`.
- Separators are `·`. Money and counts use `tabular-nums`. "Enrol" (British) in new copy; leave existing strings alone.
- **No test runner exists; do not add one.** Pure rules are checked with a throwaway `node:assert/strict` script run by `npx tsx` from a scratch directory (the Phase 3 precedent). Everything else is verified by `npx tsc --noEmit`, `npx eslint <changed files>` and a driven route.
- Anchors below are **quoted text**, never line numbers.
- Surgical changes: no drive-by refactors, renames or reformatting.

## Verification server

```bash
# 1. Make sure nothing is already listening (a killed dev:mock leaves next + mongod alive).
netstat -ano | grep -E ":3100|:27018"

# 2. Start the mock stack on free ports, with placeholder service keys (CLAUDE.md).
RESEND_API_KEY=re_disabled_local CLOUDFLARE_REALTIME_API_KEY=disabled-local OPENAI_API_KEY=disabled-local \
ABLY_API_KEY=disabled-local R2_SECRET_ACCESS_KEY=disabled-local WALLET_SERVICE_TOKEN=disabled-local \
MOCK_DB_PORT=27018 PORT=3100 node scripts/dev-mock.mjs

# 3. Give the schools their programs. The explicit MONGODB_URI is mandatory —
#    without it the script reads .env.local, whose MONGODB_URI is PRODUCTION.
MONGODB_URI=mongodb://127.0.0.1:27018/worldstreet-academy node scripts/mastery-catalogue.mjs --apply
```

Below, `$BASE` is `http://localhost:3100`. Personas switch with the `mock_persona` cookie: `student` (has enrollments), `instructor`, `admin`, `guest`, and `fresh` (added in Task 4: a learner with nothing).

`npx tsc --noEmit` may print one stale `.next/types` error; it is not real (see the project memory). Lint changed files individually.

## Preflight (before Task 1)

- [ ] **Commit the in-flight work** on `feat/student-dashboard-revamp`: the `(checkout)` route group, `components/programs/program-outcomes.tsx` and the modified program/school components. This plan builds on all of it. Then `git switch -c feat/school-first`.
- [ ] **Check the hub return trip on production** (risk #6 on the status board). Signed out, open `https://academy.worldstreetgold.com/dashboard/checkout?courseId=<any published id>`, sign in, and note where you land.
  - Lands back on checkout → nothing to do.
  - Lands on the hub dashboard → the hub's Clerk `<SignIn/>` reads `redirect_url`, not the `redirect` this app sends. The fix is two one-line changes (`middleware.ts`: `authUrl.searchParams.set("redirect", returnUrl)` and `lib/auth/login-url.ts`: `url.searchParams.set("redirect", …)` each gain a sibling `redirect_url` with the same value), plus `https://academy.worldstreetgold.com` in the hub ClerkProvider's `allowedRedirectOrigins`. Record the outcome in the Task 12 report. The `wsa_school` cookie keeps this plan working either way.

## File structure

| File | Responsibility |
|---|---|
| `lib/school-art.ts` (new) | `SCHOOL_COVERS`, `schoolCover`, `programArt` — the only place art is resolved |
| `scripts/optimize-art.mjs` (new) | Source images → 1600×1000 WebP in `public/art/schools/` |
| `public/art/schools/<slug>.webp` (new ×8) | The covers |
| `lib/schools.ts` (modify) | + `cheapestBySchool` |
| `components/marketing/school-card.tsx` (modify) | Image-led card; optional `href`, `cta`, `fromPrice` |
| `lib/db/models/enrollment-intent.ts` (new) | The collection |
| `lib/start-gate.ts` (new) | Pure: `needsSchoolChoice`, `resolveStartStep`, `START_SCHOOL_COOKIE` |
| `lib/start-gate-state.ts` (new) | Server loader: `getStartGateState` |
| `lib/actions/enrollment-intent.ts` (new) | `saveEnrollmentIntent`, `getMyEnrollmentIntent`, `dismissEnrollmentIntent` |
| `app/(start)/layout.tsx`, `app/(start)/dashboard/start/page.tsx` (new) | The picker |
| `components/start/package-chooser.tsx`, `components/start/save-school-button.tsx` (new) | The two client leaves |
| `app/(platform)/layout.tsx` (modify) | The gate |
| `app/(checkout)/dashboard/checkout/page.tsx` (modify) | Record the intent; "Save and pay later" |
| `components/dashboard/learning-hero.tsx` (modify) | `FinishEnrollingHero` |
| `components/marketing/hero-wall.tsx`, `landing.tsx`, `schools-grid.tsx` (modify) | Hero picker; schools second; card grid |
| `lib/auth/login-url.ts` (modify) | + `registerUrl` |
| `lib/actions/student.ts` (modify) | Art fallback in the read models |
| `components/checkout/enrolled-seal.tsx` (new), `app/globals.css` (modify) | The one-shot celebration |
| `lib/email.tsx`, `app/api/cron/reminders/route.ts` (modify) | Pay-later nudges |
| `components/marketing/course-card.tsx` (modify) | School label, instructor, outcomes peek |
| `app/(marketing)/programs/page.tsx` (modify) | A school's cover panel beside its programs |
| `app/(platform)/dashboard/courses/page.tsx` (rewrite) | The student browse page on v2, by school |
| `components/marketing/start-school-store.ts`, `sticky-school-bar.tsx`, `certificate-band.tsx` (new) | The shared landing choice, the bar that follows, the certificate |
| `components/ui/button.tsx` (modify) | `nativeButton` derived from `render` |
| `lib/program-rail.ts` (new) | Pure: what the student program page prints about price and size |
| `app/(platform)/dashboard/courses/[courseId]/page.tsx` (modify) | True figures, on-page package ladder, v2 shape |
| `components/meetings/meeting-lobby.tsx`, `app/(platform)/dashboard/meetings/page.tsx` (modify) | Page header; hosting controls for hosts only |
| `components/marketing/free-preview-rail.tsx` (new) | "Watch a free lesson" — hides at zero |
| `scripts/upload-program-art.mjs` (new) | Guarded R2 upload + `Course.thumbnailUrl` for the twelve programs |

---

## Part A — Art foundation

### Task 1: The art module, the optimiser and the eight covers

**Files:**
- Create: `lib/school-art.ts`, `scripts/optimize-art.mjs`, `public/art/schools/*.webp`
- Modify: `lib/schools.ts` (append `cheapestBySchool`)

**Interfaces:**
- Produces: `SCHOOL_COVERS: Partial<Record<SchoolSlug, string>>` · `schoolCover(slug: string | null | undefined): string | null` · `programArt(course: { thumbnailUrl?: string | null; school?: string | null }): string | null` · `cheapestBySchool(items): Record<SchoolSlug, number | null>`
- The code works with an empty manifest: every consumer falls back to the school icon. Art can land one file at a time.

- [ ] **Step 1: Create `lib/school-art.ts`.**

```ts
import { isSchoolSlug, type SchoolSlug } from "@/lib/schools"

/**
 * Cover art for the eight schools: static, code-owned files under
 * `public/art/schools/`. A slug missing here has no cover yet and every
 * surface falls back to the school's icon, so art lands one file at a time.
 * Add an entry only in the same commit as its file.
 */
export const SCHOOL_COVERS: Partial<Record<SchoolSlug, string>> = {}

export function schoolCover(slug: string | null | undefined): string | null {
  return isSchoolSlug(slug) ? (SCHOOL_COVERS[slug] ?? null) : null
}

/**
 * What a program shows: its own thumbnail, else its school's cover, else
 * null (the caller renders the school icon). The cover is the school's real
 * art, never a stand-in for data.
 */
export function programArt(course: { thumbnailUrl?: string | null; school?: string | null }): string | null {
  return course.thumbnailUrl || schoolCover(course.school)
}
```

- [ ] **Step 2: Append `cheapestBySchool` to `lib/schools.ts`**, after `countProgramsBySchool`.

```ts
/**
 * Cheapest program per school, whole USD (0 = a free program exists), null
 * when the school has no priced program. `price` is already the cheapest
 * enabled package (Phase 0 rule), so this never re-derives package rules.
 */
export function cheapestBySchool(
  items: ReadonlyArray<{ school: SchoolSlug | null; pricing: "free" | "paid"; price: number | null }>
): Record<SchoolSlug, number | null> {
  const out = Object.fromEntries(SCHOOLS.map((s) => [s.slug, null])) as Record<SchoolSlug, number | null>
  for (const item of items) {
    if (!item.school || !(item.school in out)) continue
    const price = item.pricing === "free" ? 0 : item.price
    if (price === null || price === undefined) continue
    const current = out[item.school]
    if (current === null || price < current) out[item.school] = price
  }
  return out
}
```

- [ ] **Step 3: Create `scripts/optimize-art.mjs`.** It reads no env and touches no database.

```js
// Usage: node scripts/optimize-art.mjs <input-dir>
// Converts every .png/.jpg/.jpeg in <input-dir> to a 1600x1000 WebP at
// public/art/schools/<same-name>.webp. Name each source file after its school
// slug (lib/schools.ts), e.g. cybersecurity.png.
import { mkdir, readdir } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

const input = process.argv[2]
if (!input) {
  console.error("usage: node scripts/optimize-art.mjs <input-dir>")
  process.exit(1)
}
const out = path.resolve("public/art/schools")
await mkdir(out, { recursive: true })

const sources = (await readdir(input)).filter((f) => /\.(png|jpe?g)$/i.test(f))
for (const file of sources) {
  const slug = path.parse(file).name
  const target = path.join(out, `${slug}.webp`)
  const info = await sharp(path.join(input, file))
    .resize(1600, 1000, { fit: "cover", position: "attention" })
    .webp({ quality: 78 })
    .toFile(target)
  console.log(`${slug}.webp  ${Math.round(info.size / 1024)} KB`)
}
console.log(`${sources.length} file(s) written to ${out}`)
```

- [ ] **Step 4: Produce the eight covers.** One art direction, so the set reads as a series. Generate at 16:10, at least 2400 px wide, name each file after its slug, then run `node scripts/optimize-art.mjs <dir>`. Each output must be under 220 KB; if one is not, lower `quality` for that run.

  Shared style line, prepended to every prompt:
  > *Photoreal studio still life, one sculptural object on a warm near-black stone plinth, deep shadow, a single warm gold rim light from upper left, one saturated accent light from the right, shallow depth of field, generous empty space on the left third, no text, no logos, no people, no UI, 16:10.*

  | File | Subject | Accent light |
  |---|---|---|
  | `trading-financial-markets` | a brass candlestick-chart sculpture, rising bars | emerald |
  | `blockchain-web3` | interlocked brushed-metal chain links forming a cube | electric blue |
  | `ai-automation` | a translucent glass head-shaped lattice of fine wires | violet |
  | `software-app-development` | stacked glass slabs like layered app screens, edges lit | cyan |
  | `cybersecurity` | a machined steel padlock split open to show its mechanism | teal |
  | `data-analytics` | polished stone columns of different heights, a bar chart in marble | amber |
  | `digital-media-creative` | a cinema camera lens and a clapperboard edge, glass reflections | magenta |
  | `digital-business-remote-careers` | a leather briefcase opening onto a small glowing globe | coral |

  The accent colour lives **inside the image only**. It is where the page gets its colour; no UI token changes.

- [ ] **Step 5: Fill the manifest** with exactly the files that exist:

```ts
export const SCHOOL_COVERS: Partial<Record<SchoolSlug, string>> = {
  "trading-financial-markets": "/art/schools/trading-financial-markets.webp",
  "blockchain-web3": "/art/schools/blockchain-web3.webp",
  "ai-automation": "/art/schools/ai-automation.webp",
  "software-app-development": "/art/schools/software-app-development.webp",
  "cybersecurity": "/art/schools/cybersecurity.webp",
  "data-analytics": "/art/schools/data-analytics.webp",
  "digital-media-creative": "/art/schools/digital-media-creative.webp",
  "digital-business-remote-careers": "/art/schools/digital-business-remote-careers.webp",
}
```

- [ ] **Step 6: Verify.** Create `"$H/t1-art.ts"` (`H=$(mktemp -d)`):

```ts
import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { SCHOOL_COVERS, programArt, schoolCover } from "@/lib/school-art"
import { cheapestBySchool } from "@/lib/schools"

for (const [slug, file] of Object.entries(SCHOOL_COVERS)) {
  assert.ok(existsSync(`public${file}`), `manifest names a missing file for ${slug}`)
}
assert.equal(schoolCover("not-a-school"), null)
assert.equal(schoolCover(null), null)
assert.equal(programArt({ thumbnailUrl: "https://cdn/x.jpg", school: "cybersecurity" }), "https://cdn/x.jpg")
assert.equal(programArt({ thumbnailUrl: "", school: "cybersecurity" }), schoolCover("cybersecurity"))
assert.equal(programArt({ thumbnailUrl: null, school: null }), null)

const cheapest = cheapestBySchool([
  { school: "cybersecurity", pricing: "paid", price: 99 },
  { school: "trading-financial-markets", pricing: "paid", price: 199 },
  { school: "trading-financial-markets", pricing: "paid", price: 49 },
  { school: "data-analytics", pricing: "free", price: null },
  { school: null, pricing: "paid", price: 1 },
])
assert.equal(cheapest["cybersecurity"], 99)
assert.equal(cheapest["trading-financial-markets"], 49)
assert.equal(cheapest["data-analytics"], 0)
assert.equal(cheapest["ai-automation"], null)
console.log("school-art: all assertions passed")
```

  Run from the repo root: `npx tsx --tsconfig ./tsconfig.json "$H/t1-art.ts"` → `school-art: all assertions passed`. Then `npx tsc --noEmit` and `npx eslint lib/school-art.ts lib/schools.ts scripts/optimize-art.mjs`.

- [ ] **Step 7: Commit.**

```bash
git add lib/school-art.ts lib/schools.ts scripts/optimize-art.mjs public/art/schools
git commit -m "feat(art): school covers, programArt fallback and the art optimiser"
```

### Task 2: The image-led school card, and schools second on the landing

**Files:**
- Modify: `components/marketing/school-card.tsx`, `components/marketing/schools-grid.tsx`, `components/marketing/landing.tsx`, `app/(marketing)/schools/page.tsx`, `app/(marketing)/schools/[slug]/page.tsx`

**Interfaces:**
- Consumes: `schoolCover`, `cheapestBySchool` (Task 1).
- Produces: `SchoolCard({ school, count, fromPrice?, headingLevel?, href?, cta?, priority? })`. `href` defaults to `/schools/<slug>`; Task 5 passes `/dashboard/start?school=<slug>`.

- [ ] **Step 1: Replace the body of `components/marketing/school-card.tsx`.** Keep the existing doc comment's motion paragraph; replace its first paragraph with: *"One school card (spec §4): cover art, icon chip, name, blurb, program count with the cheapest price, and one affordance. The WHOLE card is the link. With no cover yet the art area shows the school's glyph, so the grid never has an empty box."*

```tsx
import Link from "next/link"
import Image from "next/image"
import { ArrowRightIcon } from "lucide-react"
import type { School } from "@/lib/schools"
import { schoolCover } from "@/lib/school-art"
import { SchoolIcon } from "@/components/shared/school-icon"

export function SchoolCard({
  school,
  count,
  fromPrice = null,
  headingLevel = "h3",
  href,
  cta = "Explore school",
  priority = false,
}: {
  school: School
  count: number
  /** Cheapest program in the school, whole USD; 0 = free; null hides it. */
  fromPrice?: number | null
  /** h3 under a section h2 (landing); h2 under the page h1 (/schools, /dashboard/start). */
  headingLevel?: "h2" | "h3"
  /** Defaults to the public school page. */
  href?: string
  cta?: string
  /** First-row cards above the fold. */
  priority?: boolean
}) {
  const Heading = headingLevel
  const cover = schoolCover(school.slug)
  const programs = count === 1 ? "1 program" : `${count} programs`
  const price = fromPrice === null ? null : fromPrice === 0 ? "Free" : `from $${fromPrice.toLocaleString("en-US")}`

  return (
    <Link
      href={href ?? `/schools/${school.slug}`}
      data-school={school.slug}
      className="ws-school group flex h-full flex-col overflow-hidden rounded-[20px] border border-ws-hairline bg-ws-surface transition-colors duration-[var(--ws-motion-base)] hover:bg-ws-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 dark:border-transparent"
    >
      <span className="relative block aspect-[16/10] overflow-hidden bg-ws-sunken">
        {cover ? (
          <Image
            src={cover}
            alt=""
            fill
            priority={priority}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover opacity-90 transition-[opacity,transform] duration-600 ease-[var(--ws-ease-rise)] group-hover:scale-[1.03] group-hover:opacity-100 motion-reduce:transition-none dark:opacity-80"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-ws-gold">
            <span className="ws-school-glyph">
              <SchoolIcon name={school.icon} size={44} />
            </span>
          </span>
        )}
      </span>

      <span className="flex flex-1 flex-col p-6">
        {cover && (
          <span className="relative z-10 -mt-11 mb-4 flex h-10 w-10 items-center justify-center rounded-[9px] bg-ws-surface text-ws-gold ring-1 ring-ws-hairline transition-colors duration-[var(--ws-motion-base)] group-hover:bg-ws-raised">
            <span className="ws-school-glyph">
              <SchoolIcon name={school.icon} size={18} />
            </span>
          </span>
        )}
        <Heading className="font-display text-[18px] font-semibold leading-snug tracking-[-0.01em] text-ws-primary">
          {school.name}
        </Heading>
        <p className="mb-6 mt-2 text-[14px] leading-relaxed text-ws-muted">{school.blurb}</p>
        <span className="mt-auto flex items-center justify-between gap-3 border-t border-ws-hairline pt-4 text-[13px]">
          <span className="tabular-nums text-ws-muted">
            {programs}
            {price && ` · ${price}`}
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-ws-muted transition-colors duration-[var(--ws-motion-fast)] group-hover:text-ws-primary">
            {cta}
            <ArrowRightIcon size={14} aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
        </span>
      </span>
    </Link>
  )
}
```

  The card chrome never scales: hover lightens one surface step. The image takes the one sanctioned zoom (1 → 1.03 inside its clipped frame, 600 ms `--ws-ease-rise`) — the same exception `MarketingCourseCard` already uses, so school and program cards move alike.

- [ ] **Step 2: Turn the landing's schools directory into the card grid.** In `components/marketing/schools-grid.tsx`:
  - the component signature becomes `SchoolsGrid({ counts, cheapest }: { counts: Record<SchoolSlug, number>; cheapest: Record<SchoolSlug, number | null> })`;
  - replace the `<Reveal …>` block that holds the `<ul className="overflow-hidden rounded-[20px] …">` with:

```tsx
        <Reveal y={20} duration={0.65} className="mt-10 md:mt-12">
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {SCHOOLS.map((school) => (
              <li key={school.slug}>
                <SchoolCard school={school} count={counts[school.slug]} fromPrice={cheapest[school.slug]} />
              </li>
            ))}
          </ul>
        </Reveal>
```

  - delete `SchoolRow` and the imports it alone used (`Link`, `ArrowRightIcon`, `School`, `cn`, `SchoolIcon`); add `import { SchoolCard } from "@/components/marketing/school-card"`;
  - rewrite the doc comment: *"OUR SCHOOLS (spec §4) — eight image-led cards, four across from lg. With cover art the schools no longer read as near-identical items, so the marketplace grid (blueprint §18) replaces the directory. Counts and prices come from the landing's single fetch."*

- [ ] **Step 3: Move the section up and feed it prices.** In `components/marketing/landing.tsx`:
  - import `cheapestBySchool` beside `countProgramsBySchool`;
  - after `const schoolCounts = …` add `const schoolFrom = cheapestBySchool(published)`;
  - move `<SchoolsGrid … />` (with its comment) to directly after `<WordsMarquee />` and pass `cheapest={schoolFrom}`;
  - in the doc comment's section order, move "the Schools grid" to follow "the band of words".

- [ ] **Step 4: `/schools` index.** In `app/(marketing)/schools/page.tsx` import `cheapestBySchool`, add `const cheapest = cheapestBySchool(courses)`, and pass `fromPrice={cheapest[school.slug]}` and `priority={i < 3}` to `<SchoolCard>`.

- [ ] **Step 5: School page banner and the fast-lane CTA.** In `app/(marketing)/schools/[slug]/page.tsx`:
  - import `Image` from `next/image` and `schoolCover` from `@/lib/school-art`; add `const cover = schoolCover(school.slug)`;
  - directly above `<header className="mt-8 max-w-3xl">` insert:

```tsx
      {cover && (
        <div className="rise relative mt-8 aspect-[21/9] overflow-hidden rounded-[20px] bg-ws-sunken">
          <Image src={cover} alt="" fill priority sizes="(max-width: 1280px) 100vw, 1232px" className="object-cover" />
        </div>
      )}
```

  - after the intro paragraph, inside `<header>`, add the one gold action on the page:

```tsx
        <Link
          href={`/dashboard/start?school=${school.slug}`}
          className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-ws-brand px-7 text-[15px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"
        >
          Start with this school
        </Link>
```

  - the tagline `<p className="mt-4 font-display text-xl font-medium text-ws-gold …">` becomes `text-ws-primary`: gold is now the CTA's alone (this closes the audit's "Forex hero tagline in gold" line).

- [ ] **Step 6: Verify.** `npx tsc --noEmit`; `npx eslint` on the five files. With `mock_persona=guest`: `$BASE/` shows the schools grid directly under the word band, 4 across at 1280 px, 1 across at 390 px, with art and "N programs · from $X"; `$BASE/schools` shows nine tiles with art on eight; `$BASE/schools/cybersecurity` shows the banner and one gold button. Hover a card: it lightens, the image brightens and eases to 1.03 inside its frame, the glyph plays its motion, the card itself does not scale. No horizontal scroll at 390 px. Temporarily empty `SCHOOL_COVERS` and confirm every card falls back to a large glyph; restore it.

- [ ] **Step 7: Commit.**

```bash
git add components/marketing/school-card.tsx components/marketing/schools-grid.tsx components/marketing/landing.tsx "app/(marketing)/schools"
git commit -m "feat(schools): image-led school cards, schools second on the landing"
```

---

## Part B — School first

### Task 3: The intent collection and the pure gate rules

**Files:**
- Create: `lib/db/models/enrollment-intent.ts`, `lib/start-gate.ts`
- Modify: `lib/db/models/index.ts`

**Interfaces:**
- Produces: model `EnrollmentIntent` with `IEnrollmentIntent`, `EnrollmentIntentStatus = "open" | "converted" | "dismissed"`, `EnrollmentIntentSource = "landing" | "start" | "checkout"`.
- Produces: `START_SCHOOL_COOKIE = "wsa_school"` · `needsSchoolChoice(input: StartGateInput): boolean` · `resolveStartStep(args): StartStep`.

- [ ] **Step 1: Create `lib/db/models/enrollment-intent.ts`.**

```ts
import mongoose, { Schema, Document, Model, Types } from "mongoose"
import type { PackageKey } from "./course"

/**
 * "The school I picked" (Phase 9). One row per user — the newest choice wins.
 * `course` and `packageKey` fill in as the learner gets further; a school with
 * no programs yet saves with both null. The intent is `converted` lazily, when
 * a reader sees the matching enrollment, so the money path never writes here.
 * New collection: invisible to the Go API.
 */
export type EnrollmentIntentStatus = "open" | "converted" | "dismissed"
export type EnrollmentIntentSource = "landing" | "start" | "checkout"

export interface IEnrollmentIntent extends Document {
  _id: Types.ObjectId
  user: Types.ObjectId
  /** A SchoolSlug (lib/schools.ts); validated by Zod in the action. */
  school: string
  course: Types.ObjectId | null
  packageKey: PackageKey | null
  source: EnrollmentIntentSource
  status: EnrollmentIntentStatus
  /** When this school/program was chosen; reset when either changes. */
  savedAt: Date
  /** Pay-later email ledger (cron/reminders). */
  nudges: { h24SentAt: Date | null; h72SentAt: Date | null }
  createdAt: Date
  updatedAt: Date
}

const EnrollmentIntentSchema = new Schema<IEnrollmentIntent>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    school: { type: String, required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", default: null },
    packageKey: { type: String, enum: ["basic", "standard", "executive", null], default: null },
    source: { type: String, enum: ["landing", "start", "checkout"], required: true },
    status: { type: String, enum: ["open", "converted", "dismissed"], default: "open" },
    savedAt: { type: Date, default: () => new Date() },
    nudges: {
      h24SentAt: { type: Date, default: null },
      h72SentAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
)

// One intent per user.
EnrollmentIntentSchema.index({ user: 1 }, { unique: true })
// The nudge sweep: open intents, oldest first.
EnrollmentIntentSchema.index({ status: 1, savedAt: 1 })

export const EnrollmentIntent: Model<IEnrollmentIntent> =
  mongoose.models.EnrollmentIntent ||
  mongoose.model<IEnrollmentIntent>("EnrollmentIntent", EnrollmentIntentSchema)
```

- [ ] **Step 2: Export it.** Append to `lib/db/models/index.ts`:

```ts
export {
  EnrollmentIntent,
  type IEnrollmentIntent,
  type EnrollmentIntentStatus,
  type EnrollmentIntentSource,
} from "./enrollment-intent"
```

- [ ] **Step 3: Create `lib/start-gate.ts`.** Pure: no database, no Next imports.

```ts
import { isSchoolSlug, type SchoolSlug } from "@/lib/schools"

/** First-party memory of a guest's landing-page choice (30 days). */
export const START_SCHOOL_COOKIE = "wsa_school"

export type StartGateInput = {
  role: "USER" | "INSTRUCTOR" | "ADMIN"
  instructorStatus: "none" | "applied" | "interview" | "approved" | "rejected"
  hasEnrollment: boolean
  hasIntent: boolean
  pathname: string
}

/** Reachable without a school: the picker, the till, the instructor door, and invite links. */
const EXEMPT_PREFIXES = [
  "/dashboard/start",
  "/dashboard/checkout",
  "/dashboard/become-instructor",
  "/dashboard/meetings",
] as const

/**
 * School first (owner, 2026-09-16): a learner with no enrollment and no saved
 * school chooses one before the dashboard opens. Instructors, admins,
 * applicants and anyone who already has either are never asked.
 */
export function needsSchoolChoice(input: StartGateInput): boolean {
  if (input.role !== "USER") return false
  if (input.instructorStatus !== "none") return false
  if (input.hasEnrollment || input.hasIntent) return false
  return !EXEMPT_PREFIXES.some((p) => input.pathname === p || input.pathname.startsWith(`${p}/`))
}

export type StartStep =
  | { step: "school" }
  | { step: "program"; school: SchoolSlug }
  | { step: "package"; school: SchoolSlug; courseId: string }
  | { step: "waitlist"; school: SchoolSlug }

/**
 * Which screen `/dashboard/start` shows. A school with one program skips the
 * program step — for it, choosing the school IS choosing the program.
 */
export function resolveStartStep(args: {
  school: string | null | undefined
  program: string | null | undefined
  /** Published program ids in that school. */
  programIds: readonly string[]
}): StartStep {
  if (!isSchoolSlug(args.school)) return { step: "school" }
  const school = args.school
  if (args.programIds.length === 0) return { step: "waitlist", school }
  if (args.program && args.programIds.includes(args.program)) {
    return { step: "package", school, courseId: args.program }
  }
  if (args.programIds.length === 1) return { step: "package", school, courseId: args.programIds[0] }
  return { step: "program", school }
}
```

- [ ] **Step 4: Verify.** Create `"$H/t3-gate.ts"`:

```ts
import assert from "node:assert/strict"
import { needsSchoolChoice, resolveStartStep, type StartGateInput } from "@/lib/start-gate"

const fresh: StartGateInput = {
  role: "USER", instructorStatus: "none", hasEnrollment: false, hasIntent: false, pathname: "/dashboard",
}
assert.equal(needsSchoolChoice(fresh), true)
assert.equal(needsSchoolChoice({ ...fresh, pathname: "/dashboard/courses" }), true)
assert.equal(needsSchoolChoice({ ...fresh, pathname: "" }), true, "missing header still gates")
assert.equal(needsSchoolChoice({ ...fresh, hasEnrollment: true }), false)
assert.equal(needsSchoolChoice({ ...fresh, hasIntent: true }), false)
assert.equal(needsSchoolChoice({ ...fresh, role: "INSTRUCTOR" }), false)
assert.equal(needsSchoolChoice({ ...fresh, role: "ADMIN" }), false)
assert.equal(needsSchoolChoice({ ...fresh, instructorStatus: "interview" }), false)
for (const p of ["/dashboard/start", "/dashboard/checkout/success", "/dashboard/become-instructor", "/dashboard/meetings"]) {
  assert.equal(needsSchoolChoice({ ...fresh, pathname: p }), false, p)
}
assert.equal(needsSchoolChoice({ ...fresh, pathname: "/dashboard/startled" }), true, "prefix must be a path segment")

assert.deepEqual(resolveStartStep({ school: undefined, program: undefined, programIds: [] }), { step: "school" })
assert.deepEqual(resolveStartStep({ school: "nope", program: undefined, programIds: ["a"] }), { step: "school" })
assert.deepEqual(resolveStartStep({ school: "cybersecurity", program: undefined, programIds: [] }), { step: "waitlist", school: "cybersecurity" })
assert.deepEqual(resolveStartStep({ school: "cybersecurity", program: undefined, programIds: ["a"] }), { step: "package", school: "cybersecurity", courseId: "a" })
assert.deepEqual(resolveStartStep({ school: "trading-financial-markets", program: undefined, programIds: ["a", "b"] }), { step: "program", school: "trading-financial-markets" })
assert.deepEqual(resolveStartStep({ school: "trading-financial-markets", program: "b", programIds: ["a", "b"] }), { step: "package", school: "trading-financial-markets", courseId: "b" })
assert.deepEqual(resolveStartStep({ school: "trading-financial-markets", program: "zzz", programIds: ["a", "b"] }), { step: "program", school: "trading-financial-markets" }, "foreign program id is ignored")
console.log("start-gate: all assertions passed")
```

  `npx tsx --tsconfig ./tsconfig.json "$H/t3-gate.ts"` → `start-gate: all assertions passed`. Then tsc and `npx eslint lib/start-gate.ts lib/db/models/enrollment-intent.ts lib/db/models/index.ts`.

- [ ] **Step 5: Commit.**

```bash
git add lib/db/models/enrollment-intent.ts lib/db/models/index.ts lib/start-gate.ts
git commit -m "feat(start): EnrollmentIntent collection and the pure school-first rules"
```

### Task 4: Intent actions, the gate loader and a `fresh` persona

**Files:**
- Create: `lib/actions/enrollment-intent.ts`, `lib/start-gate-state.ts`, `lib/hooks/queries/use-enrollment-intent.ts`
- Modify: `lib/program-price.ts`, `lib/hooks/queries/keys.ts`, `lib/hooks/queries/index.ts`, `mocks/clerk/personas.ts`

**Interfaces:**
- Consumes: `EnrollmentIntent` (Task 3), `fetchProgramById` and `ProgramDetail` (`lib/actions/student.ts`).
- Produces:
  - `saveEnrollmentIntent(input: SaveEnrollmentIntentInput): Promise<{ success: true; data: { checkoutHref: string | null } } | { success: false; error: string }>`
  - `getMyEnrollmentIntent(): Promise<MyEnrollmentIntent | null>`
  - `dismissEnrollmentIntent(): Promise<{ success: boolean }>`
  - `getStartGateState(userId: string): Promise<{ hasEnrollment: boolean; hasIntent: boolean }>`
  - `useMyEnrollmentIntent()` · `queryKeys.enrollmentIntent`
  - `packagePriceLabel(price: number): string`

- [ ] **Step 1: Add `packagePriceLabel` to `lib/program-price.ts`** (new code uses it; the two existing local copies stay as they are).

```ts
/** A package's own price: whole USD, or "Free". */
export function packagePriceLabel(price: number): string {
  return price === 0 ? "Free" : `$${price.toLocaleString("en-US")}`
}
```

- [ ] **Step 2: Create `lib/actions/enrollment-intent.ts`.**

```ts
"use server"

import mongoose from "mongoose"
import { revalidatePath } from "next/cache"
import { z } from "zod/v4"
import connectDB from "@/lib/db"
import { Enrollment, EnrollmentIntent, type PackageKey } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth"
import { fetchProgramById } from "@/lib/actions/student"
import { SCHOOL_SLUGS, isSchoolSlug, type SchoolSlug } from "@/lib/schools"

const SaveSchema = z.object({
  school: z.enum(SCHOOL_SLUGS),
  courseId: z
    .string()
    .refine((v) => mongoose.Types.ObjectId.isValid(v), "Invalid program")
    .nullable()
    .default(null),
  packageKey: z.enum(["basic", "standard", "executive"]).nullable().default(null),
  source: z.enum(["landing", "start", "checkout"]),
})

export type SaveEnrollmentIntentInput = z.input<typeof SaveSchema>

type SaveResult =
  | { success: true; data: { checkoutHref: string | null } }
  | { success: false; error: string }

function checkoutHrefFor(courseId: string | null, packageKey: PackageKey | null): string | null {
  if (!courseId) return null
  return `/dashboard/checkout?courseId=${courseId}${packageKey ? `&package=${packageKey}` : ""}`
}

/**
 * Save "the school I picked" — with the program and package once chosen.
 * Idempotent; the newest choice overwrites. Changing school or program
 * restarts the pay-later clock. Identity comes from the session only.
 */
export async function saveEnrollmentIntent(input: SaveEnrollmentIntentInput): Promise<SaveResult> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "Sign in to save your school" }

    const parsed = SaveSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: "That choice isn't valid" }
    const { school, courseId, source } = parsed.data
    let packageKey: PackageKey | null = parsed.data.packageKey

    if (courseId) {
      const program = await fetchProgramById(courseId)
      if (!program || program.status !== "published") return { success: false, error: "That program isn't available" }
      if (program.school !== school) return { success: false, error: "That program isn't part of this school" }
      // A program without a ladder has one synthesized tier; it carries no key.
      if (program.tierCount === 0) packageKey = null
      else if (packageKey && !program.packages.some((p) => p.key === packageKey)) {
        return { success: false, error: "That package isn't on sale" }
      }
    } else {
      packageKey = null
    }

    const existing = await EnrollmentIntent.findOne({ user: user.id }).select("school course").lean()
    const changed =
      !existing || existing.school !== school || String(existing.course ?? "") !== (courseId ?? "")

    await EnrollmentIntent.updateOne(
      { user: user.id },
      {
        $set: {
          school,
          course: courseId,
          packageKey,
          source,
          status: "open",
          ...(changed ? { savedAt: new Date(), "nudges.h24SentAt": null, "nudges.h72SentAt": null } : {}),
        },
        $setOnInsert: { user: user.id },
      },
      { upsert: true }
    )

    revalidatePath("/dashboard")
    return { success: true, data: { checkoutHref: checkoutHrefFor(courseId, packageKey) } }
  } catch (error) {
    console.error("Save enrollment intent error:", error)
    return { success: false, error: "Couldn't save your choice — try again" }
  }
}

export type MyEnrollmentIntent = {
  school: SchoolSlug
  courseId: string | null
  courseTitle: string | null
  packageName: string | null
  /** Whole USD for the chosen package, else the program's cheapest; null with no program. */
  price: number | null
  /** True when `price` is a "from" figure (a ladder with no package chosen). */
  fromPrice: boolean
  /** Checkout when a program is chosen, else back into the picker. */
  href: string
}

/** The signed-in learner's OPEN intent, or null. Converts it when its enrollment exists. */
export async function getMyEnrollmentIntent(): Promise<MyEnrollmentIntent | null> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return null

    const intent = await EnrollmentIntent.findOne({ user: user.id, status: "open" }).lean()
    if (!intent || !isSchoolSlug(intent.school)) return null
    const school = intent.school
    const courseId = intent.course ? String(intent.course) : null
    const schoolOnly: MyEnrollmentIntent = {
      school, courseId: null, courseTitle: null, packageName: null, price: null, fromPrice: false,
      href: `/dashboard/start?school=${school}`,
    }
    if (!courseId) return schoolOnly

    if (await Enrollment.exists({ user: user.id, course: courseId })) {
      await EnrollmentIntent.updateOne({ _id: intent._id }, { $set: { status: "converted" } })
      return null
    }

    const program = await fetchProgramById(courseId)
    if (!program || program.status !== "published") return schoolOnly

    const chosen = intent.packageKey ? program.packages.find((p) => p.key === intent.packageKey) : undefined
    return {
      school,
      courseId,
      courseTitle: program.title,
      packageName: chosen && program.tierCount > 1 ? chosen.name : null,
      price: chosen ? chosen.price : program.price,
      fromPrice: !chosen && program.tierCount > 1,
      href: checkoutHrefFor(courseId, chosen ? chosen.key : null) ?? `/dashboard/start?school=${school}`,
    }
  } catch (error) {
    console.error("Get enrollment intent error:", error)
    return null
  }
}

/** "Not now" on the dashboard card. The row stays, so the gate never re-asks. */
export async function dismissEnrollmentIntent(): Promise<{ success: boolean }> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false }
    await EnrollmentIntent.updateOne({ user: user.id, status: "open" }, { $set: { status: "dismissed" } })
    revalidatePath("/dashboard")
    return { success: true }
  } catch (error) {
    console.error("Dismiss enrollment intent error:", error)
    return { success: false }
  }
}
```

- [ ] **Step 3: Create `lib/start-gate-state.ts`.**

```ts
import { cache } from "react"
import connectDB from "@/lib/db"
import { Enrollment, EnrollmentIntent } from "@/lib/db/models"

/**
 * The two facts the school-first gate needs, for RSC layouts. Request-deduped
 * like getCachedUser. Callers must treat a throw as "do not gate".
 */
export const getStartGateState = cache(async (userId: string) => {
  await connectDB()
  const [enrollment, intent] = await Promise.all([
    Enrollment.exists({ user: userId }),
    EnrollmentIntent.exists({ user: userId }),
  ])
  return { hasEnrollment: Boolean(enrollment), hasIntent: Boolean(intent) }
})
```

- [ ] **Step 4: The query hook.** In `lib/hooks/queries/keys.ts`, under `bookmarks`, add `enrollmentIntent: ["enrollment-intent"] as const,`. Create `lib/hooks/queries/use-enrollment-intent.ts`:

```ts
"use client"

import { useQuery } from "@tanstack/react-query"
import { getMyEnrollmentIntent, type MyEnrollmentIntent } from "@/lib/actions/enrollment-intent"
import { queryKeys } from "./keys"

/** The learner's saved-but-unpaid school, or null. */
export function useMyEnrollmentIntent() {
  return useQuery<MyEnrollmentIntent | null>({
    queryKey: queryKeys.enrollmentIntent,
    queryFn: getMyEnrollmentIntent,
    staleTime: 2 * 60 * 1000,
  })
}
```

  Re-export it from `lib/hooks/queries/index.ts` in the same form that file uses for `use-bookmarks`.

- [ ] **Step 5: A learner with nothing, for QA.** In `mocks/clerk/personas.ts`: `PersonaKey` gains `| "fresh"`; extend the header comment with *"`fresh` has no seeded row and no enrollments — the school-first gate's test subject."*; add to `PERSONAS`:

```ts
  fresh: {
    key: "fresh",
    id: "user_mock_fresh",
    email: "fresh@worldstreet.academy",
    firstName: "Noor",
    lastName: "Newcomer",
    role: "user",
    imageUrl:
      "https://api.dicebear.com/9.x/notionists/svg?seed=Noor%20Newcomer&backgroundColor=d1f4d9&backgroundType=gradientLinear",
  },
```

- [ ] **Step 6: Verify.** tsc; `npx eslint` on the seven files. Behaviour is exercised in Task 5.

- [ ] **Step 7: Commit.**

```bash
git add lib/actions/enrollment-intent.ts lib/start-gate-state.ts lib/program-price.ts lib/hooks/queries mocks/clerk/personas.ts
git commit -m "feat(start): intent actions, gate loader, query hook and a fresh mock persona"
```

### Task 5: `/dashboard/start` — school, program, package

**Files:**
- Create: `app/(start)/layout.tsx`, `app/(start)/dashboard/start/page.tsx`, `components/start/package-chooser.tsx`, `components/start/save-school-button.tsx`
- Modify: `components/marketing/program-row.tsx` (optional `href`)

**Interfaces:**
- Consumes: `resolveStartStep`, `START_SCHOOL_COOKIE` (Task 3); `saveEnrollmentIntent` (Task 4); `SchoolCard` with `href`/`cta` (Task 2); `packagePriceLabel` (Task 4).
- Produces: the route `/dashboard/start?school=<slug>&program=<courseId>`; `?pick=1` forces the school step.

- [ ] **Step 1: `ProgramRow` accepts a destination.** In `components/marketing/program-row.tsx` the signature becomes `ProgramRow({ course, href }: { course: BrowseCourse; href?: string })`, the `<Link href=…>` becomes `href={href ?? \`/programs/${course.slug}\`}`, and "View program" becomes `{href ? "Choose program" : "View program"}`.

- [ ] **Step 2: Create `app/(start)/layout.tsx`.**

```tsx
import { redirect } from "next/navigation"
import { BrandLockup } from "@/components/shared/brand-lockup"
import { getCachedUser } from "@/lib/auth/cached"

/**
 * The school picker runs in its OWN route group, outside `(platform)`, for the
 * reason checkout does: a learner choosing where to begin should not also be
 * offered a sidebar of nine other places to go. The URL stays under
 * `/dashboard`, so middleware protects it and a guest's deep link
 * (`/dashboard/start?school=…`) survives the sign-in round trip.
 *
 * A route group is not a security boundary: this still gates on auth. The
 * local-dev Clerk branch mirrors `(platform)/layout.tsx`; keep them in step.
 */
export default async function StartLayout({ children }: { children: React.ReactNode }) {
  const user = await getCachedUser()

  if (!user) {
    const isLocalDev = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")
    redirect(isLocalDev ? "/login" : "https://www.worldstreetgold.com/login")
  }

  return (
    <div className="flex min-h-svh flex-col bg-ws-page">
      <header className="border-b border-ws-hairline">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
          <BrandLockup alt="" />
          <p className="text-[12px] font-medium text-ws-muted">Welcome, {user.firstName}</p>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
```

- [ ] **Step 3: Create `components/start/save-school-button.tsx`.**

```tsx
"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { saveEnrollmentIntent } from "@/lib/actions/enrollment-intent"
import type { SchoolSlug } from "@/lib/schools"

/** A school with no programs yet: keep the school, open the dashboard. */
export function SaveSchoolButton({ school }: { school: SchoolSlug }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function save() {
    setError(null)
    startTransition(async () => {
      const result = await saveEnrollmentIntent({ school, source: "start" })
      if (result.success) router.push("/dashboard?saved=1")
      else setError(result.error)
    })
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="inline-flex h-12 items-center justify-center rounded-full bg-ws-brand px-7 text-[15px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save this school"}
      </button>
      {error && <p role="alert" className="text-[13px] text-ws-danger">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 4: Create `components/start/package-chooser.tsx`.**

```tsx
"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckIcon } from "lucide-react"
import { saveEnrollmentIntent } from "@/lib/actions/enrollment-intent"
import type { PublicPackage } from "@/lib/actions/student"
import { PACKAGE_LABEL } from "@/lib/entitlements"
import { packagePriceLabel } from "@/lib/program-price"
import type { SchoolSlug } from "@/lib/schools"
import { cn } from "@/lib/utils"

/**
 * The last step: pick a package, then pay now or save it. Both buttons save
 * the intent first, so "pay later" is never a lost choice and a checkout the
 * learner walks away from is still on their dashboard.
 */
export function PackageChooser({
  school,
  courseId,
  packages,
  tierCount,
}: {
  school: SchoolSlug
  courseId: string
  /** Enabled tiers, never empty (ProgramDetail.packages). */
  packages: PublicPackage[]
  /** 0 = no ladder: one synthesized tier that carries no key. */
  tierCount: number
}) {
  const router = useRouter()
  const initial = packages.find((p) => p.highlight) ?? packages[0]
  const [key, setKey] = useState<PublicPackage["key"]>(initial.key)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const selected = packages.find((p) => p.key === key) ?? initial
  const multiTier = packages.length > 1

  function go(next: "pay" | "later") {
    setError(null)
    startTransition(async () => {
      const result = await saveEnrollmentIntent({
        school,
        courseId,
        packageKey: tierCount > 0 ? selected.key : null,
        source: "start",
      })
      if (!result.success) return setError(result.error)
      router.push(next === "pay" && result.data.checkoutHref ? result.data.checkoutHref : "/dashboard?saved=1")
    })
  }

  return (
    <div className="space-y-6">
      {multiTier && (
        <fieldset className="min-w-0 space-y-2">
          <legend className="sr-only">Choose your package</legend>
          {packages.map((pkg) => {
            const active = pkg.key === key
            return (
              <label
                key={pkg.key}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-[20px] border p-5 transition-colors duration-[var(--ws-motion-fast)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ws-brand/40",
                  active ? "border-ws-brand/40 bg-ws-raised" : "border-ws-hairline bg-ws-surface hover:bg-ws-raised dark:border-transparent"
                )}
              >
                <input
                  type="radio"
                  name="package"
                  value={pkg.key}
                  checked={active}
                  onChange={() => setKey(pkg.key)}
                  className="sr-only"
                />
                <span
                  aria-hidden
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                    active ? "border-ws-brand bg-ws-brand text-ws-brand-on" : "border-ws-hairline"
                  )}
                >
                  {active && <CheckIcon size={10} strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-ws-muted">
                    {PACKAGE_LABEL[pkg.key]}
                  </span>
                  <span className="block text-[15px] font-medium text-ws-primary">{pkg.name}</span>
                  {pkg.tagline && <span className="block text-[13px] text-ws-muted">{pkg.tagline}</span>}
                </span>
                <span className="font-display text-2xl font-light tabular-nums text-ws-primary">
                  {packagePriceLabel(pkg.price)}
                </span>
              </label>
            )
          })}
        </fieldset>
      )}

      {selected.features.length > 0 && (
        <ul className="space-y-2">
          {selected.features.slice(0, 6).map((feature, i) => (
            <li key={`${selected.key}-${i}`} className="flex items-start gap-2.5 text-[14px] leading-relaxed text-ws-muted">
              <CheckIcon size={15} className="mt-0.5 shrink-0 text-ws-subtle" aria-hidden />
              {feature}
            </li>
          ))}
        </ul>
      )}

      {error && <p role="alert" className="text-[13px] text-ws-danger">{error}</p>}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => go("pay")}
          disabled={pending}
          className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-ws-brand px-7 text-[15px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90 disabled:opacity-60"
        >
          {selected.price === 0 ? "Continue — it's free" : `Continue to payment · ${packagePriceLabel(selected.price)}`}
        </button>
        <button
          type="button"
          onClick={() => go("later")}
          disabled={pending}
          className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-ws-hairline px-7 text-[15px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised disabled:opacity-60"
        >
          Save and pay later
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create `app/(start)/dashboard/start/page.tsx`.**

```tsx
import type { Metadata } from "next"
import Link from "next/link"
import { cookies } from "next/headers"
import { ArrowLeftIcon } from "lucide-react"
import { fetchBrowseCourses, fetchProgramById } from "@/lib/actions/student"
import { SCHOOLS, SCHOOL_BY_SLUG, cheapestBySchool, countProgramsBySchool, isSchoolSlug } from "@/lib/schools"
import { START_SCHOOL_COOKIE, resolveStartStep } from "@/lib/start-gate"
import { courseAvailability } from "@/lib/types/course"
import { SchoolCard } from "@/components/marketing/school-card"
import { ProgramRow } from "@/components/marketing/program-row"
import { PackageChooser } from "@/components/start/package-chooser"
import { SaveSchoolButton } from "@/components/start/save-school-button"

export const metadata: Metadata = { title: "Choose your school", robots: { index: false, follow: false } }
export const revalidate = 0

type Search = { searchParams: Promise<{ school?: string; program?: string; pick?: string }> }

function StepHeading({ step, of, title, lede }: { step: number; of: number; title: string; lede: string }) {
  return (
    <header className="rise max-w-2xl">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ws-gold">
        Step <span className="tabular-nums">{step}</span> of <span className="tabular-nums">{of}</span>
      </p>
      <h1
        className="mt-4 font-display font-semibold leading-[1.05] tracking-[-0.02em] text-ws-primary"
        style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
      >
        {title}
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-ws-muted md:text-[17px]">{lede}</p>
    </header>
  )
}

function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary"
    >
      <ArrowLeftIcon size={14} aria-hidden />
      {children}
    </Link>
  )
}

/**
 * `/dashboard/start` — school first (owner, 2026-09-16). Steps are URL-driven:
 * `?school=` then `?program=`, so Back works and the landing can deep-link. A
 * guest's landing choice arrives by URL, or by the `wsa_school` cookie when
 * the sign-in round trip dropped the query. `?pick=1` forces the school step.
 */
export default async function StartPage({ searchParams }: Search) {
  const params = await searchParams
  const remembered = (await cookies()).get(START_SCHOOL_COOKIE)?.value
  const schoolParam = params.pick ? undefined : (params.school ?? remembered)

  const published = (await fetchBrowseCourses()).filter((c) => c.status === "published")
  const inSchool = isSchoolSlug(schoolParam) ? published.filter((c) => c.school === schoolParam) : []
  const step = resolveStartStep({ school: schoolParam, program: params.program, programIds: inSchool.map((c) => c.id) })

  const shell = "mx-auto w-full max-w-6xl px-4 pb-24 pt-10 md:px-6 md:pt-14"

  if (step.step === "school") {
    const counts = countProgramsBySchool(published)
    const cheapest = cheapestBySchool(published)
    return (
      <div className={shell}>
        <StepHeading
          step={1}
          of={3}
          title="Choose your school"
          lede="Your future can take many directions. Pick the one that matches your goals — you can add another school later."
        />
        <ul className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {SCHOOLS.map((school, i) => (
            <li key={school.slug} className="rise" style={{ "--rise-delay": `${i * 45}ms` } as React.CSSProperties}>
              <SchoolCard
                school={school}
                count={counts[school.slug]}
                fromPrice={cheapest[school.slug]}
                headingLevel="h2"
                href={`/dashboard/start?school=${school.slug}`}
                cta="Choose school"
                priority={i < 4}
              />
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const school = SCHOOL_BY_SLUG[step.school]

  if (step.step === "waitlist") {
    return (
      <div className={shell}>
        <BackLink href="/dashboard/start?pick=1">All schools</BackLink>
        <div className="mt-8">
          <StepHeading
            step={2}
            of={2}
            title={school.name}
            lede="This school's first programs are being prepared. Save it and it will be waiting on your dashboard the day they open."
          />
        </div>
        <div className="rise mt-8" style={{ "--rise-delay": "90ms" } as React.CSSProperties}>
          <SaveSchoolButton school={school.slug} />
        </div>
      </div>
    )
  }

  if (step.step === "program") {
    return (
      <div className={shell}>
        <BackLink href="/dashboard/start?pick=1">All schools</BackLink>
        <div className="mt-8">
          <StepHeading step={2} of={3} title="Choose your program" lede={school.tagline ?? school.blurb} />
        </div>
        <ul className="mt-10 grid gap-4">
          {inSchool.map((course) => (
            <ProgramRow
              key={course.id}
              course={course}
              href={`/dashboard/start?school=${school.slug}&program=${course.id}`}
            />
          ))}
        </ul>
      </div>
    )
  }

  // step.step === "package"
  const program = await fetchProgramById(step.courseId)
  const single = inSchool.length === 1
  const back = single ? "/dashboard/start?pick=1" : `/dashboard/start?school=${school.slug}`
  if (!program) {
    return (
      <div className={shell}>
        <BackLink href={back}>Back</BackLink>
        <p className="mt-8 text-[15px] text-ws-muted">That program isn&apos;t available right now.</p>
      </div>
    )
  }
  const comingSoon = courseAvailability({ status: "published", availableAt: program.availableAt }) === "coming_soon"

  return (
    <div className={`${shell} max-w-3xl`}>
      <BackLink href={back}>{single ? "All schools" : school.short}</BackLink>
      <div className="mt-8">
        <StepHeading
          step={single ? 2 : 3}
          of={single ? 2 : 3}
          title={program.title}
          lede={program.shortDescription ?? program.description}
        />
      </div>
      <p className="mt-3 text-[13px] text-ws-muted">
        <Link href={`/programs/${program.slug}`} className="underline underline-offset-4 hover:text-ws-primary">
          See the full curriculum
        </Link>
      </p>
      <div className="rise mt-8" style={{ "--rise-delay": "90ms" } as React.CSSProperties}>
        {comingSoon ? (
          // Pre-enrolment lives on the program page; here the learner keeps the school.
          <div className="space-y-4">
            <p className="text-[15px] text-ws-muted">
              This program opens soon. Reserve your seat on its page, or save the school and come back.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href={`/programs/${program.slug}`}
                className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-ws-brand px-7 text-[15px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"
              >
                View program
              </Link>
              <SaveSchoolButton school={school.slug} />
            </div>
          </div>
        ) : (
          <PackageChooser
            school={school.slug}
            courseId={program.id}
            packages={program.packages}
            tierCount={program.tierCount}
          />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Verify.** tsc; `npx eslint "app/(start)" components/start components/marketing/program-row.tsx`. With `mock_persona=fresh`:
  1. `$BASE/dashboard/start` → "Step 1 of 3", eight cards, no sidebar or bottom nav.
  2. Click **Cybersecurity** → "Step 2 of 2", the program title, one price, two buttons (single-program school skips the program step).
  3. Back → **Trading & Financial Markets** → "Step 2 of 3", two rows → **Forex** → "Step 3 of 3", three packages with Standard preselected.
  4. **Save and pay later** → lands on `/dashboard?saved=1`. In mongosh: `db.enrollmentintents.findOne({})` shows `school`, `course`, `packageKey: "standard"`, `status: "open"`, `source: "start"`.
  5. `$BASE/dashboard/start?school=trading-financial-markets&program=000000000000000000000000` → the program step (a foreign id is ignored).
  6. `mock_persona=guest`, `$BASE/dashboard/start?school=cybersecurity` → redirected to `/login?redirect_url=%2Fdashboard%2Fstart%3Fschool%3Dcybersecurity`.
  7. 390 px: one column, both buttons full width, no horizontal scroll.

- [ ] **Step 7: Commit.**

```bash
git add "app/(start)" components/start components/marketing/program-row.tsx
git commit -m "feat(start): /dashboard/start — choose a school, a program and a package"
```

### Task 6: The gate, and checkout remembers

**Files:**
- Modify: `app/(platform)/layout.tsx`, `app/(checkout)/dashboard/checkout/page.tsx`

**Interfaces:**
- Consumes: `needsSchoolChoice` (Task 3), `getStartGateState` and `saveEnrollmentIntent` (Task 4).

- [ ] **Step 1: The gate.** In `app/(platform)/layout.tsx`:
  - change `import { cookies } from "next/headers"` to `import { cookies, headers } from "next/headers"`; add `import { needsSchoolChoice } from "@/lib/start-gate"` and `import { getStartGateState } from "@/lib/start-gate-state"`;
  - directly after the `if (!user) { … }` block insert:

```tsx
  // School first (owner, 2026-09-16): a learner with no enrollment and no
  // saved school chooses one before the dashboard opens. Fails OPEN — a gate
  // that cannot read its state must never lock anyone out. `redirect()` throws
  // by design, so it stays outside the catch.
  if (user.role === "USER") {
    const pathname = (await headers()).get("x-next-pathname") ?? ""
    const gate = await getStartGateState(user.id).catch(() => null)
    if (
      gate &&
      needsSchoolChoice({ role: user.role, instructorStatus: user.instructorStatus, pathname, ...gate })
    ) {
      redirect("/dashboard/start")
    }
  }
```

- [ ] **Step 2: Checkout records the choice.** In `app/(checkout)/dashboard/checkout/page.tsx`:
  - add `import Link from "next/link"` and `import { saveEnrollmentIntent } from "@/lib/actions/enrollment-intent"`;
  - inside the `.then(([p, enrollment, walletBalance]) => {` callback, directly after `setProgram(p)`:

```tsx
      if (p?.school) {
        // Reaching checkout IS choosing (Phase 9): remember it, so an order the
        // buyer walks away from can be finished from the dashboard, and the
        // wallet-funding round trip is never stopped by the school-first gate.
        const chosen = p.packages.find((k) => k.key === packageParam)
        void saveEnrollmentIntent({
          school: p.school,
          courseId: p.id,
          packageKey: p.tierCount > 0 ? (chosen?.key ?? null) : null,
          source: "checkout",
        })
      }
```

  - add `packageParam` to that effect's dependency array;
  - directly after the closing `</Button>` of the CTA add:

```tsx
          {!isSuccess && (
            <Link
              href="/dashboard?saved=1"
              className="flex h-11 w-full items-center justify-center rounded-full text-sm font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary"
            >
              Save and pay later
            </Link>
          )}
```

- [ ] **Step 3: Verify.** tsc; eslint on both files. Clear `db.enrollmentintents` first.
  1. `mock_persona=fresh`, `$BASE/dashboard` → lands on `/dashboard/start`. Same for `/dashboard/courses` and `/dashboard/wallet`.
  2. `$BASE/dashboard/become-instructor` and `$BASE/dashboard/meetings` → open normally.
  3. `mock_persona=student`, `instructor`, `admin` → `$BASE/dashboard` opens; never redirected.
  4. `mock_persona=fresh`, open `$BASE/dashboard/checkout?courseId=<Forex id>&package=basic` → checkout renders; `db.enrollmentintents.findOne({})` shows `source: "checkout"`, `packageKey: "basic"`. Click **Save and pay later** → `/dashboard` opens (the gate now passes).
  5. Fail-open: temporarily make `getStartGateState` `throw new Error("x")`; `mock_persona=fresh` → `/dashboard` opens. Revert.
  6. The dashboard tour still starts for `fresh` on first arrival at `/dashboard`.

- [ ] **Step 4: Commit.**

```bash
git add "app/(platform)/layout.tsx" "app/(checkout)/dashboard/checkout/page.tsx"
git commit -m "feat(start): school-first gate in the platform layout; checkout remembers the choice"
```

### Task 7: "Finish enrolling" on the dashboard home

**Files:**
- Modify: `components/dashboard/learning-hero.tsx`, `app/(platform)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `useMyEnrollmentIntent`, `MyEnrollmentIntent`, `dismissEnrollmentIntent`, `queryKeys.enrollmentIntent` (Task 4); `schoolCover` (Task 1).
- Produces: `LearningHero` gains an optional `intent?: MyEnrollmentIntent | null` prop.

- [ ] **Step 1: The hero variant.** In `components/dashboard/learning-hero.tsx`, add imports (`useQueryClient` from `@tanstack/react-query`; `dismissEnrollmentIntent`, `type MyEnrollmentIntent` from `@/lib/actions/enrollment-intent`; `queryKeys` from `@/lib/hooks/queries/keys`; `schoolCover` from `@/lib/school-art`; `SCHOOL_BY_SLUG` beside the existing `SCHOOLS` import). Directly above `/** \`footer\` is the student's totals` add:

```tsx
/** A school is saved and unpaid: its art, the exact order, one gold CTA — and a quiet way to put it down. */
function FinishEnrollingHero({ intent }: { intent: MyEnrollmentIntent }) {
  const queryClient = useQueryClient()
  const school = SCHOOL_BY_SLUG[intent.school]
  const cover = schoolCover(intent.school)
  const price =
    intent.price === null
      ? null
      : intent.price === 0
        ? "Free"
        : `${intent.fromPrice ? "from " : ""}$${intent.price.toLocaleString("en-US")}`

  async function dismiss() {
    await dismissEnrollmentIntent()
    queryClient.invalidateQueries({ queryKey: queryKeys.enrollmentIntent })
  }

  return (
    <CardShell className="@container overflow-hidden">
      <div className="flex flex-col @xl:flex-row">
        {cover && (
          <div className="relative aspect-[16/9] w-full shrink-0 bg-ws-sunken @xl:aspect-auto @xl:w-[42%]">
            <Image src={cover} alt="" fill sizes="(max-width: 768px) 100vw, 40vw" className="object-cover" />
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col items-start gap-3 p-6 @xl:p-8">
          <Eyebrow>Saved for you</Eyebrow>
          <h2 className="font-display text-[24px] font-semibold leading-[1.2] tracking-[-0.015em] @xl:text-[28px]">
            {intent.courseTitle ?? school.name}
          </h2>
          <p className="max-w-md text-[14px] leading-relaxed text-muted-foreground">
            {intent.courseTitle
              ? [school.short, intent.packageName, price].filter(Boolean).join(" · ")
              : "Your school is saved. Its programs appear here as they open."}
          </p>
          <HeroActions
            primary={{ label: intent.courseId ? "Finish enrolling" : "View school", href: intent.href }}
            secondary={{ label: "Choose another school", href: "/dashboard/start?pick=1" }}
            className="mt-1"
          />
          <button
            type="button"
            onClick={dismiss}
            className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            Not now
          </button>
        </div>
      </div>
    </CardShell>
  )
}
```

  Then give `LearningHero` the prop and the branch:

```tsx
export function LearningHero({
  hero,
  hasEnrollments,
  footer,
  intent = null,
}: {
  hero: HomeHero | null
  hasEnrollments: boolean
  footer?: React.ReactNode
  /** The learner's saved-but-unpaid school; shown only while nothing opens the player. */
  intent?: MyEnrollmentIntent | null
}) {
  if (!hero && intent) return <FinishEnrollingHero intent={intent} />
  if (!hero) return <StartHero returning={hasEnrollments} />
```

  `HeroActions` already takes `secondary?: HeroLink | null` (`{ label, href }`), and this file already imports `Image`, `CardShell` and `Eyebrow`. It is a Hugeicons surface; the new hero adds no icon, so no library is mixed.

  In `StartHero`, the first-timer CTA changes from `{ label: "Browse programs", href: "/dashboard/courses" }` to `{ label: returning ? "Browse programs" : "Choose your school", href: returning ? "/dashboard/courses" : "/dashboard/start?pick=1" }`.

- [ ] **Step 2: Feed it.** In `app/(platform)/dashboard/page.tsx` add `useMyEnrollmentIntent` to the `@/lib/hooks/queries` import, add `const { data: intent = null } = useMyEnrollmentIntent()` beside the other queries, and pass `intent={intent}` to `<LearningHero …>`.

- [ ] **Step 3: Verify.** tsc; eslint on both files. `mock_persona=fresh` with the Forex/Standard intent from Task 5: `$BASE/dashboard` shows the Trading cover, "Forex Trading Mastery", "Trading & Financial Markets · Standard · $…", a gold **Finish enrolling** going to `/dashboard/checkout?courseId=…&package=standard`. **Not now** swaps the card for the Start hero, whose CTA reads "Choose your school"; reloading does not send the user back to the gate. `mock_persona=student` is unchanged. At 390 px the art sits above the copy.

- [ ] **Step 4: Commit.**

```bash
git add components/dashboard/learning-hero.tsx "app/(platform)/dashboard/page.tsx"
git commit -m "feat(dashboard): finish-enrolling hero for a saved, unpaid school"
```

---

## Part C — The landing invites

### Task 8: The hero becomes the school picker

**Files:**
- Modify: `components/marketing/hero-wall.tsx`, `components/marketing/landing.tsx`, `lib/auth/login-url.ts`

**Interfaces:**
- Consumes: `SCHOOLS`, `countProgramsBySchool`, `cheapestBySchool`, `schoolCover`, `START_SCHOOL_COOKIE`.
- Produces: `registerUrl(returnPath: string): string`.

- [ ] **Step 1: `registerUrl`.** Append to `lib/auth/login-url.ts`:

```ts
/**
 * Sign-up URL that brings the new learner back to `returnPath`. The hub's
 * `<SignUp/>` is Clerk's, which reads `redirect_url`; `redirect` is this
 * app's older contract with the hub. Both are sent, so either works.
 */
export function registerUrl(returnPath: string): string {
  if (isLocalDev) return `/register?redirect_url=${encodeURIComponent(returnPath)}`
  const back = `https://academy.worldstreetgold.com${returnPath}`
  const url = new URL("https://www.worldstreetgold.com/register")
  url.searchParams.set("redirect", back)
  url.searchParams.set("redirect_url", back)
  return url.toString()
}
```

- [ ] **Step 2: Every guest CTA enters the funnel.** In `components/marketing/landing.tsx` delete the `isLocalDev` and `REGISTER_URL` constants, add `import { registerUrl } from "@/lib/auth/login-url"` and `const REGISTER_URL = registerUrl("/dashboard/start")`. `HeroWall` and `FinaleCta` keep receiving it. A new account now returns to the picker, never to the hub.

- [ ] **Step 3: The picker.** In `components/marketing/hero-wall.tsx`:
  - imports: add `AnimatePresence` to the `motion/react` import; add `SCHOOLS, cheapestBySchool, countProgramsBySchool, type SchoolSlug` from `@/lib/schools`, `schoolCover` from `@/lib/school-art`, `START_SCHOOL_COOKIE` from `@/lib/start-gate`, `cn` from `@/lib/utils`;
  - state and derived values, after `const positions = …`:

```tsx
  const [picked, setPicked] = React.useState<SchoolSlug | null>(null)
  const counts = React.useMemo(() => countProgramsBySchool(courses), [courses])
  const cheapest = React.useMemo(() => cheapestBySchool(courses), [courses])
  const pickedSchool = picked ? SCHOOLS.find((s) => s.slug === picked)! : null
  const pickedCover = schoolCover(picked)

  function pick(slug: SchoolSlug) {
    setPicked(slug)
    // Survives the sign-up round trip even if the hub drops the return URL.
    document.cookie = `${START_SCHOOL_COOKIE}=${slug}; path=/; max-age=2592000; samesite=lax`
  }
```

  - the chosen school's cover, between the wall and the overlay (the wall is `-z-20`, the overlay `-z-10`). Insert directly before `{/* ── Overlay:`:

```tsx
      {/* ── The chosen school's cover: a crossfade on the visitor's tap, not ambient motion ── */}
      <AnimatePresence>
        {pickedCover && (
          <motion.div
            key={pickedCover}
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-[15]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: ok ? 0.32 : 0 }}
          >
            <Image src={pickedCover} alt="" fill sizes="100vw" className="object-cover opacity-60" />
          </motion.div>
        )}
      </AnimatePresence>
```

  - replace the whole CTA `<motion.div className="mt-8 flex flex-wrap items-center gap-3" …>…</motion.div>` with:

```tsx
        <motion.div
          className="mt-8 max-w-2xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE_INERTIA, delay: 0.5 }}
        >
          <p id="hero-pick" className="text-[13px] font-medium text-ws-muted">
            What do you want to master?
          </p>
          <div
            role="group"
            aria-labelledby="hero-pick"
            className="-mx-6 mt-3 flex gap-2 overflow-x-auto px-6 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
          >
            {SCHOOLS.map((school) => (
              <button
                key={school.slug}
                type="button"
                aria-pressed={picked === school.slug}
                onClick={() => pick(school.slug)}
                className={cn(
                  "h-10 shrink-0 rounded-full px-4 text-[13.5px] font-medium transition-colors duration-[var(--ws-motion-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40",
                  picked === school.slug
                    ? "bg-ws-raised text-ws-primary ring-1 ring-ws-hairline"
                    : "bg-ws-surface/70 text-ws-muted hover:bg-ws-raised hover:text-ws-primary"
                )}
              >
                {school.short}
              </button>
            ))}
          </div>

          {/* Reserved height, so choosing a school never moves the buttons. */}
          <p className="mt-4 min-h-[1.5rem] text-[14px] tabular-nums text-ws-muted" aria-live="polite">
            {pickedSchool &&
              [
                counts[pickedSchool.slug] === 1 ? "1 program" : `${counts[pickedSchool.slug]} programs`,
                cheapest[pickedSchool.slug] === null
                  ? null
                  : cheapest[pickedSchool.slug] === 0
                    ? "free to start"
                    : `from $${cheapest[pickedSchool.slug]!.toLocaleString("en-US")}`,
                "pay now or save it for later",
              ]
                .filter(Boolean)
                .join(" · ")}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href={pickedSchool ? `/dashboard/start?school=${pickedSchool.slug}` : "#schools"}
              className="inline-flex h-12 items-center justify-center rounded-sm bg-ws-brand px-8 text-[15px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"
            >
              {pickedSchool ? `Start with ${pickedSchool.short}` : "Choose your school"}
            </Link>
            {signedIn ? (
              <Link
                href="/dashboard"
                className="inline-flex h-12 items-center justify-center rounded-sm border border-ws-hairline px-7 text-[15px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:border-ws-brand/40 hover:text-ws-gold"
              >
                Continue learning
              </Link>
            ) : (
              <a
                href={registerUrl}
                className="inline-flex h-12 items-center justify-center rounded-sm border border-ws-hairline px-7 text-[15px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:border-ws-brand/40 hover:text-ws-gold"
              >
                Create an account
              </a>
            )}
          </div>
        </motion.div>
```

  - update the component's doc comment: add *"Below the claim the hero asks one question — what do you want to master? — and the eight schools answer as chips. Choosing one crossfades that school's cover in behind the copy, states what it costs, and points the gold CTA at `/dashboard/start?school=…` (owner, 2026-09-16: the school is chosen on the landing, before the dashboard)."*

  The chips are a choice list, not tabs: raised when pressed, never gold. Gold stays on the one CTA.

- [ ] **Step 4: Verify.** tsc; eslint on the three files. `mock_persona=guest`, `$BASE/`:
  1. The chips sit in the first viewport at 1280×800 and at 390×844 (where they scroll sideways inside their row; the page itself never scrolls horizontally).
  2. Tap **Cybersecurity**: the cover fades in, the line reads "1 program · from $99 · pay now or save it for later", the CTA reads "Start with Cybersecurity", nothing below shifts. `document.cookie` contains `wsa_school=cybersecurity`.
  3. Click the CTA → `/login?redirect_url=%2Fdashboard%2Fstart%3Fschool%3Dcybersecurity`. Set `mock_persona=fresh`, reload → the package step for Cybersecurity.
  4. Cookie fallback: with the cookie set, open `$BASE/dashboard/start` with no query → the Cybersecurity package step. `?pick=1` → the school grid.
  5. With nothing picked, "Choose your school" scrolls to `#schools`.
  6. Reduced motion (DevTools → Rendering): the cover swaps without a fade and the wall stands still.
  7. Keyboard: Tab reaches every chip, Space toggles, `aria-pressed` follows.

- [ ] **Step 5: Commit.**

```bash
git add components/marketing/hero-wall.tsx components/marketing/landing.tsx lib/auth/login-url.ts
git commit -m "feat(landing): the hero asks for a school; every guest CTA enters the funnel"
```

### Task 9: Art on every program surface

**Files:**
- Modify: `lib/actions/student.ts`, `components/courses/course-card.tsx`, `components/learn/course-carousel.tsx`, `app/(platform)/dashboard/courses/[courseId]/page.tsx`, and any `opengraph-image.tsx` that reads a program thumbnail

**Interfaces:**
- Consumes: `programArt` (Task 1).
- After this task, `thumbnailUrl` / `courseThumbnail` in the **student read models** mean "the program's art: its own thumbnail, else its school's cover". Instructor and admin read models are untouched (ruling 10).

- [ ] **Step 1: Resolve art once, in the read models.** In `lib/actions/student.ts` add `import { programArt } from "@/lib/school-art"`. For every DTO line of the form `thumbnailUrl: course.thumbnailUrl,` and `courseThumbnail: course.thumbnailUrl,` (eight sites: `fetchBrowseCourses`, `fetchPublicCourse`, the `ProgramDetail` builder, `fetchOtherCourses`, `fetchMyEnrollments`, `fetchMyBookmarks`, `fetchInstructorPublicCourses`, `fetchEnrolledCoursesFromInstructor`) write the value as `programArt(course)`. Lesson lines (`l.videoThumbnailUrl`) are not touched. Where the course comes from a populated or selected query, add `school` to its field list:
  - `select: "slug title thumbnailUrl instructor totalLessons availableAt status packages examRequired"` → append ` school`, and add `school?: string | null` to that populate's inline type;
  - `select: "title thumbnailUrl instructor level pricing price rating enrolledCount"` → append ` school`, and the same on its inline type;
  - both `.select("title thumbnailUrl level pricing price totalLessons enrolledCount rating")` → append ` school`.

  Update the `BrowseCourse.thumbnailUrl` field comment: `/** The program's art: its own thumbnail, else its school's cover (lib/school-art.ts). Null only when neither exists. */`

- [ ] **Step 2: Absolute URLs where HTML is not a browser page.** Run `grep -rn "thumbnailUrl" app --include="opengraph-image.tsx"`. Wherever a student read model's thumbnail feeds an `ImageResponse` `<img src>`, wrap it: `const src = art && art.startsWith("/") ? appUrl(art) : art` (`appUrl` from `@/lib/app-url`). Emails build their own queries and are unaffected.

- [ ] **Step 3: The three student placeholders become an icon, never a label.** In each of `components/courses/course-card.tsx` ("No thumbnail"), `components/learn/course-carousel.tsx` ("No thumbnail") and `app/(platform)/dashboard/courses/[courseId]/page.tsx` ("Course Thumbnail"), replace the text span with:

```tsx
<span className="flex h-11 w-11 items-center justify-center rounded-full bg-ws-brand/10 text-ws-gold">
  <GraduationCapIcon size={20} aria-hidden />
</span>
```

  importing `GraduationCapIcon` from `lucide-react` (all three are lucide surfaces). After Step 1 this fallback is reached only by a program with no school.

- [ ] **Step 4: Verify.** tsc; eslint on the changed files. `grep -rn "No thumbnail\|Course Thumbnail" app components` now lists instructor files only. With the mock catalogue (no program thumbnails): `$BASE/` — the hero wall now drifts with school covers; the catalogue grid has art on every card. `$BASE/schools/trading-financial-markets` — both rows show the Trading cover. `mock_persona=student`: `/dashboard`, `/dashboard/courses`, `/dashboard/bookmarks`, `/dashboard/my-courses` and the checkout page show art on every card. `mock_persona=instructor`: `/instructor/analytics` still says "No thumbnail". View source on a program page's OG image route: the `<img>` URL is absolute.

- [ ] **Step 5: Commit.**

```bash
git add lib/actions/student.ts components/courses/course-card.tsx components/learn/course-carousel.tsx "app/(platform)/dashboard/courses/[courseId]/page.tsx"
git commit -m "feat(art): programs without a thumbnail show their school's cover"
```

### Task 10: One celebration, at the moment it is earned

**Files:**
- Create: `components/checkout/enrolled-seal.tsx`
- Modify: `app/globals.css`, `app/(checkout)/dashboard/checkout/success/page.tsx`

- [ ] **Step 1: The keyframes.** In `app/globals.css`, directly after the `.rise { … }` rule:

```css
/* ── Enrolment seal — one-shot, on "Enrollment confirmed" only ───────────────
   The ring draws, then the tick. Plays once; nothing loops. */
@keyframes ws-seal-ring {
  from { stroke-dashoffset: 176; }
  to   { stroke-dashoffset: 0; }
}
@keyframes ws-seal-tick {
  from { stroke-dashoffset: 36; }
  to   { stroke-dashoffset: 0; }
}
.ws-seal-ring {
  stroke-dasharray: 176;
  animation: ws-seal-ring 620ms var(--ws-ease) 120ms both;
}
.ws-seal-tick {
  stroke-dasharray: 36;
  animation: ws-seal-tick 320ms var(--ws-ease) 640ms both;
}
```

  and add `.ws-seal-ring, .ws-seal-tick` to the selector list of the existing `prefers-reduced-motion` block that already names `.rise`, with `animation: none; stroke-dashoffset: 0;`.

- [ ] **Step 2: Create `components/checkout/enrolled-seal.tsx`.**

```tsx
/** The drawn seal on "Enrollment confirmed". Success green: money moved the right way. */
export function EnrolledSeal() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden className="mx-auto text-ws-success">
      <circle cx="36" cy="36" r="28" className="fill-current opacity-10" />
      <circle
        cx="36"
        cy="36"
        r="28"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
        className="ws-seal-ring"
      />
      <path
        d="M24 37.5 32.5 46 49 28.5"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="ws-seal-tick"
      />
    </svg>
  )
}
```

- [ ] **Step 3: Use it.** In `app/(checkout)/dashboard/checkout/success/page.tsx` replace the `<div className="mx-auto flex h-16 w-16 …"><CircleCheckIcon … /></div>` with `<EnrolledSeal />`, drop `CircleCheckIcon` from the lucide import, import `EnrolledSeal`, and add `className="rise"` with `style={{ "--rise-delay": "520ms" } as React.CSSProperties}` to the `<h1>` so the words arrive as the ring closes.

- [ ] **Step 4: Verify.** tsc; eslint. Complete a free enrolment as `mock_persona=fresh`: the ring draws once, the tick follows, the heading rises, then everything is still. Reduced motion: a static ring and tick.

- [ ] **Step 5: Commit.**

```bash
git add components/checkout/enrolled-seal.tsx app/globals.css "app/(checkout)/dashboard/checkout/success/page.tsx"
git commit -m "feat(checkout): a drawn seal on Enrollment confirmed"
```

---

## Part D — Follow-through

### Task 11: Pay-later nudges

**Files:**
- Modify: `lib/email.tsx`, `app/api/cron/reminders/route.ts`

**Interfaces:**
- Produces: `sendFinishEnrollingEmail(data: FinishEnrollingEmailData)`; the cron's JSON gains `nudged`.

- [ ] **Step 1: The email.** Append to `lib/email.tsx`, reusing the file's shared style constants exactly as `CourseLiveEmail` does:

```tsx
export type FinishEnrollingEmailData = {
  to: string
  firstName: string
  courseTitle: string
  schoolName: string
  /** Root-relative checkout path, query included. */
  checkoutPath: string
  /** Whole USD; 0 = free. */
  price: number
  /** A ladder with no package chosen: quote "from $X". */
  fromPrice: boolean
  /** The second email says it is the last. */
  final: boolean
}

function FinishEnrollingEmail({ data }: { data: FinishEnrollingEmailData }) {
  const url = `${APP_URL}${data.checkoutPath}`
  const priceLabel =
    data.price === 0 ? "free" : `${data.fromPrice ? "from " : ""}$${data.price.toLocaleString("en-US")}`
  return (
    <Html style={base}>
      <Head />
      <Preview>{data.courseTitle} is saved for you</Preview>
      <Body style={body}>
        <Container style={card}>
          <Section style={contentPad}>
            <Text style={heading}>Your place is saved</Text>
            <Text style={sub}>
              {data.firstName ? `${data.firstName}, you` : "You"} chose <strong>{data.courseTitle}</strong> in the{" "}
              {data.schoolName}. It is still here ({priceLabel}) whenever you are ready.
            </Text>
            {data.final && <Text style={muted}>This is the last reminder we&apos;ll send about it.</Text>}
            <Section style={{ marginTop: "28px" }}>
              <Button href={url} style={cta}>
                Finish enrolling
              </Button>
            </Section>
            <Hr style={{ borderColor: "#E4E4E9", margin: "24px 0 16px" }} />
            <Link href={url} style={linkSmall}>
              {url}
            </Link>
          </Section>
        </Container>
        <Section style={footer}>
          <Text style={footerText}>{BRAND.name}</Text>
        </Section>
      </Body>
    </Html>
  )
}

export async function sendFinishEnrollingEmail(data: FinishEnrollingEmailData) {
  if (!data.to) return { success: false, error: "No recipient" }
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.to,
      subject: `Still thinking about ${data.courseTitle}?`,
      react: React.createElement(FinishEnrollingEmail, { data }),
    })
    if (error) {
      console.error("[Email] Finish enrolling failed:", error)
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (err) {
    console.error("[Email] Finish enrolling error:", err)
    return { success: false, error: "Failed to send email" }
  }
}
```

- [ ] **Step 2: The sweep.** In `app/api/cron/reminders/route.ts`: add `EnrollmentIntent` to the models import, `sendFinishEnrollingEmail` to the email import, and `import { fetchProgramById } from "@/lib/actions/student"` and `import { SCHOOL_BY_SLUG, isSchoolSlug } from "@/lib/schools"`. Directly before `return NextResponse.json({ ok: true, upcoming: upcoming.length, sent24, sent1 })` insert:

```ts
  // ── Pay-later nudges (Phase 9): a saved, unpaid program gets one email at
  // 24 h and a last one at 72 h. Marketing mail is claimed BEFORE it is sent
  // (at most once) — the opposite of class reminders, which must never be
  // skipped. A run that missed the 24 h window sends only the 72 h email.
  let nudged = 0
  const DAY = 24 * 3600 * 1000
  const due = await EnrollmentIntent.find({
    status: "open",
    course: { $ne: null },
    $or: [
      { savedAt: { $lte: new Date(now - DAY) }, "nudges.h24SentAt": null },
      { savedAt: { $lte: new Date(now - 3 * DAY) }, "nudges.h72SentAt": null },
    ],
  })
    .sort({ savedAt: 1 })
    .limit(100)

  for (const intent of due) {
    try {
      if (!intent.course || !isSchoolSlug(intent.school)) continue
      const courseId = intent.course.toString()

      if (await Enrollment.exists({ user: intent.user, course: intent.course })) {
        await EnrollmentIntent.updateOne({ _id: intent._id }, { $set: { status: "converted" } })
        continue
      }

      const final = now - intent.savedAt.getTime() >= 3 * DAY
      const stamp = new Date()
      const claimed = await EnrollmentIntent.findOneAndUpdate(
        { _id: intent._id, status: "open", [final ? "nudges.h72SentAt" : "nudges.h24SentAt"]: null },
        {
          $set: final
            ? { "nudges.h24SentAt": intent.nudges?.h24SentAt ?? stamp, "nudges.h72SentAt": stamp }
            : { "nudges.h24SentAt": stamp },
        }
      )
      if (!claimed) continue

      const [program, learner] = await Promise.all([
        fetchProgramById(courseId),
        User.findById(intent.user).select("firstName email").lean(),
      ])
      if (!program || program.status !== "published" || !learner?.email) continue

      const chosen = intent.packageKey ? program.packages.find((p) => p.key === intent.packageKey) : undefined
      await sendFinishEnrollingEmail({
        to: learner.email,
        firstName: learner.firstName ?? "",
        courseTitle: program.title,
        schoolName: SCHOOL_BY_SLUG[intent.school].name,
        checkoutPath: `/dashboard/checkout?courseId=${courseId}${chosen ? `&package=${chosen.key}` : ""}`,
        price: chosen ? chosen.price : (program.price ?? 0),
        fromPrice: !chosen && program.tierCount > 1,
        final,
      })
      nudged++
    } catch (error) {
      console.error("[cron/reminders] intent", intent._id.toString(), error)
    }
  }
```

  and change the return to `NextResponse.json({ ok: true, upcoming: upcoming.length, sent24, sent1, nudged })`. Extend the route's header comment with one bullet: *"- Saved, unpaid programs (`EnrollmentIntent`): one email at 24 h, a last one at 72 h."*

- [ ] **Step 3: Verify.** tsc; eslint on both files. With `RESEND_API_KEY=re_disabled_local` no mail leaves the machine. In mongosh age the `fresh` intent: `db.enrollmentintents.updateOne({}, { $set: { savedAt: new Date(Date.now() - 25*3600*1000), "nudges.h24SentAt": null, "nudges.h72SentAt": null } })`. Then:

```bash
curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" $BASE/api/cron/reminders
```

  → `"nudged":1` and `nudges.h24SentAt` is set. Run it again → `"nudged":0` (idempotent). Age it to 73 h → `"nudged":1`, both stamps set. Age a fresh copy straight to 80 h with both stamps null → exactly one email, both stamps set. Enrol the user in that course, reset the stamps, run → `"nudged":0` and `status: "converted"`.

- [ ] **Step 4: Commit.**

```bash
git add lib/email.tsx app/api/cron/reminders/route.ts
git commit -m "feat(start): pay-later emails at 24h and 72h for a saved, unpaid program"
```

### Task 12: Docs, the Go note, and the journey run

**Run this task last — after Parts E and F (Tasks 13–21).** Its journey run is the phase's acceptance test and must see the finished UI. Add to the run: the student program page for a buyer and for an Executive mentee (Task 18), `/dashboard/meetings` as a learner (Task 19), and the landing with and without a free lesson (Task 20).

**Files:**
- Modify: `CLAUDE.md`, `docs/go-patches-phase-3.md`, `docs/mastery-academy-plan.md`, `docs/launch-runbook.md`

- [ ] **Step 1: `CLAUDE.md`.**
  - *Route groups* line: add `(checkout)` `/dashboard/checkout*` (chrome-less) and `(start)` `/dashboard/start` (chrome-less school picker).
  - After the role-gating sentence add: *"`(platform)/layout.tsx` also holds the **school-first gate** (`needsSchoolChoice`, `lib/start-gate.ts`): a `USER` with no enrollment and no `EnrollmentIntent` is sent to `/dashboard/start`. It fails open. Exempt paths are listed in that module."*
  - In the "each fact has one home" list add: `lib/school-art.ts` — school covers and `programArt` (a program without a thumbnail shows its school's cover; student read models already apply it, instructor ones deliberately do not) · `lib/start-gate.ts` + `lib/actions/enrollment-intent.ts` — the saved school (`EnrollmentIntent`, one per user, converted lazily; the money path never writes it).
  - *Commands*: `node scripts/optimize-art.mjs <dir> [out] [WxH]` — source images → WebP (default `public/art/schools/`, 1600×1000); no env, no database. Add `upload-program-art.mjs` to the list of scripts that **mutate production data**: dry run by default, `--apply` refuses without `MONGODB_URI` on the command line, public bucket only.
  - In the "each fact has one home" list add: `lib/program-rail.ts` — what the student program page may print about price and size (an enrolled learner is never quoted a price; a ladder reads "From"; zeros are omitted).
- [ ] **Step 2: `docs/go-patches-phase-3.md`.** Add a section: *"§ Phase 9 — `enrollmentintents` (new collection). Go needs no patch: nothing it reads changed. Optional for mobile: `GET` the caller's row where `status: "open"` to show 'Finish enrolling'. Fields: `user`, `school` (slug), `course` (ObjectId|null), `packageKey` (basic|standard|executive|null), `status` (open|converted|dismissed), `savedAt`."*
- [ ] **Step 3: `docs/launch-runbook.md`.** Under the crons section note that `/api/cron/reminders` now also sends pay-later emails and returns `nudged`; no new scheduled task is needed.
- [ ] **Step 4: Tick the status board.** In `docs/mastery-academy-plan.md` § Phase 9, check each exit criterion that the run below proves.
- [ ] **Step 5: The journey run** (record it as the phase report, with a screenshot per line, at 1280 px and 390 px):
  1. Guest → landing → chip **Cybersecurity** → **Start with Cybersecurity** → sign-in → package step → **Continue to payment** → checkout → pay → seal → dashboard.
  2. Guest → **Create an account** → returns to `/dashboard/start` (the cookie preselects when a chip was tapped first).
  3. `fresh` → `/dashboard` → gate → Trading → Forex → Standard → **Save and pay later** → dashboard hero "Finish enrolling" → checkout.
  4. `fresh` → checkout deep link → **Save and pay later** → dashboard, no gate.
  5. `student`, `instructor`, `admin` → never gated.
  6. Every card on `/`, `/schools`, `/schools/<slug>`, `/programs`, `/dashboard`, `/dashboard/courses`, `/dashboard/bookmarks` shows art.
  7. `pnpm lint` (53 warnings is the baseline; zero new), `npx tsc --noEmit`, `pnpm build`.
- [ ] **Step 6: Commit.**

```bash
git add CLAUDE.md docs
git commit -m "docs: Phase 9 — school-first gate, art module, Go note, journey run"
```

---

## Part E — Enticing UI (run before Task 12's journey run)

Parts A–D fix the flow and put art on the page. Part E is the owner's other sentence — "a little bit mundane … more pizzazz" — applied to the surfaces a learner actually browses: the program card, the catalogue, the student browse page and the landing's proof. Everything stays inside the design system: transform/opacity only, no infinite loops in the app shell, no glass, gold on one CTA per view.

### Task 13: Program cards that sell

**Files:**
- Modify: `lib/actions/student.ts`, `components/marketing/course-card.tsx`

**Interfaces:**
- Produces: `BrowseCourse.outcomes: string[]` (first three "what you'll learn" lines; empty when the program has none).

- [ ] **Step 1: The data.** In `lib/actions/student.ts`, add to `BrowseCourse` after `rating`:

```ts
  /** First three "what you'll learn" lines, for the card's hover peek. Empty until the program has outcomes. */
  outcomes: string[]
```

  and to the `fetchBrowseCourses` builder, after `rating: …`: `outcomes: (course.whatYouWillLearn ?? []).slice(0, 3),`. Run `npx tsc --noEmit`: it names every other place a `BrowseCourse` is built (the `ProgramDetail` builder and `fetchOtherCourses`). Add the same line to each.

- [ ] **Step 2: The card.** In `components/marketing/course-card.tsx`:
  - imports: add `SCHOOL_BY_SLUG` from `@/lib/schools` and `Avatar, AvatarFallback, AvatarImage` from `@/components/ui/avatar`;
  - inside the `{/* Clipped thumbnail frame */}` div, after the image/fallback conditional, add the school label and the peek:

```tsx
          {course.school && (
            <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-white">
              {SCHOOL_BY_SLUG[course.school].short}
            </span>
          )}
          {/* The Udemy move, inside the rules: on a hover-capable pointer the
              first three outcomes slide up over the art. Solid fill (no glass),
              transform only, and the full list lives on the program page, so
              this is decoration for assistive tech. */}
          {course.outcomes.length > 0 && (
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 hidden translate-y-full bg-ws-raised px-4 py-3 transition-transform duration-[320ms] ease-[var(--ws-ease-rise)] group-hover:translate-y-0 group-focus-within:translate-y-0 motion-reduce:transition-none md:block"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ws-subtle">You&apos;ll learn</p>
              <ul className="mt-1.5 space-y-1">
                {course.outcomes.map((line, i) => (
                  <li key={i} className="line-clamp-1 text-[12.5px] text-ws-primary">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          )}
```

  - in the footer, replace the empty `<span />` (and the comment above it stays) with the instructor:

```tsx
            <span className="flex min-w-0 items-center gap-2">
              <Avatar className="h-5 w-5 shrink-0">
                {course.instructorAvatarUrl && <AvatarImage src={course.instructorAvatarUrl} alt="" />}
                <AvatarFallback className="text-[9px]">{initials(course.instructorName)}</AvatarFallback>
              </Avatar>
              <span className="truncate text-[12px] text-ws-muted">{course.instructorName}</span>
            </span>
```

  - in the right-hand footer group, before the rating, add `{course.tierCount > 1 && <span className="text-[11px] tabular-nums text-ws-subtle">{course.tierCount} packages</span>}`;
  - extend the doc comment: *"The art carries the school's label; on hover the first three outcomes slide up over it (hidden when the program has none). The footer names the instructor."*

- [ ] **Step 3: Verify.** tsc; eslint on both files. `$BASE/programs`: every card shows a school label and an instructor; Forex shows "3 packages"; hovering Forex slides three outcomes over the art, and a program with no outcomes shows no panel. Tab to a card: the panel appears on focus. At 390 px no panel ever shows. Reduced motion: the panel appears without sliding.

- [ ] **Step 4: Commit.**

```bash
git add lib/actions/student.ts components/marketing/course-card.tsx
git commit -m "feat(programs): cards name their school and instructor, and peek their outcomes"
```

### Task 14: `/programs` — each school beside its programs

**Files:**
- Modify: `app/(marketing)/programs/page.tsx`

- [ ] **Step 1: The panel.** Add imports `Image` from `next/image`, `schoolCover` from `@/lib/school-art`, `type School` beside `SCHOOLS`, and `cn` from `@/lib/utils`. Add below the page component:

```tsx
/**
 * A school's face beside its programs. With one to three programs per school a
 * bare three-column grid is mostly air; the cover fills it and says where you
 * are. From lg it sticks while a longer list scrolls past. No gold here — a
 * page of eight gold buttons would have no primary action.
 */
function SchoolPanel({ school, count }: { school: School; count: number }) {
  const cover = schoolCover(school.slug)
  return (
    <div className="relative flex min-h-[18rem] flex-col justify-end overflow-hidden rounded-[20px] bg-ws-surface p-6 lg:sticky lg:top-24 lg:self-start">
      {cover && (
        <>
          <Image src={cover} alt="" fill sizes="(max-width: 1024px) 100vw, 33vw" className="object-cover" />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
        </>
      )}
      <div className={cn("relative", cover ? "text-white" : "text-ws-primary")}>
        <h2 id={`school-${school.slug}`} className="font-display text-2xl font-semibold tracking-[-0.015em]">
          {school.name}
        </h2>
        <p className={cn("mt-2 text-[14px] leading-relaxed", cover ? "text-white/80" : "text-ws-muted")}>
          {school.tagline ?? school.blurb}
        </p>
        <p className={cn("mt-3 text-[13px] tabular-nums", cover ? "text-white/70" : "text-ws-subtle")}>
          {count === 1 ? "1 program" : `${count} programs`}
        </p>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-semibold">
          <Link href={`/dashboard/start?school=${school.slug}`} className="inline-flex items-center gap-1 hover:underline">
            Start with this school
            <ArrowRightIcon size={14} aria-hidden />
          </Link>
          <Link href={`/schools/${school.slug}`} className={cn("hover:underline", cover ? "text-white/80" : "text-ws-muted")}>
            About this school
          </Link>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Use it.** Replace each school `<section …>` body with:

```tsx
        <section
          key={school.slug}
          className="rise mt-14 grid gap-5 border-t border-ws-hairline pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"
          aria-labelledby={`school-${school.slug}`}
        >
          <SchoolPanel school={school} count={programs.length} />
          <ul className="grid content-start gap-5 sm:grid-cols-2">
            {programs.map((course) => (
              <li key={course.id}>
                <MarketingCourseCard course={course} signedIn={signedIn} />
              </li>
            ))}
          </ul>
        </section>
```

  Remove the `SchoolIcon` import if nothing else uses it. The "More programs" group and the empty state are unchanged.

- [ ] **Step 3: Verify.** tsc; eslint. `$BASE/programs` at 1280 px: each school is a cover panel with its cards to the right; in Digital Business (3 programs) the panel stays pinned while the cards scroll. At 390 px the panel stacks above its cards, no horizontal scroll. With `SCHOOL_COVERS` emptied the panel is a plain surface card with ink text; restore.

- [ ] **Step 4: Commit.**

```bash
git add "app/(marketing)/programs/page.tsx"
git commit -m "feat(programs): each school's cover panel sits beside its programs"
```

### Task 15: The student browse page, on v2 and by school

**Files:**
- Modify: `app/(platform)/dashboard/courses/page.tsx` (full rewrite), `components/platform/course-card.tsx` (one optional prop)

**Why:** this is the page a learner opens from the sidebar's Programs row, and it is still v1: "Browse Courses", copy that says "crypto, trading, and blockchain", gold filter chips, a popover for two filters, "No img", no school anywhere.

- [ ] **Step 1: The card can quote a ladder.** In `components/platform/course-card.tsx` add to `CourseCardProps`, after `pricing`: `/** Overrides the computed price text — browse passes "From $49" for a package ladder. */ priceLabel?: string`. Destructure `priceLabel`, and in the browse footer make the price expression `{priceLabel ?? (pricing === "free" ? "Free" : price != null ? \`$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\` : "")}`.

- [ ] **Step 2: Rewrite `app/(platform)/dashboard/courses/page.tsx`.**

```tsx
"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon } from "@hugeicons/core-free-icons"
import { Topbar } from "@/components/platform/topbar"
import { CourseCard, CourseCardSkeleton } from "@/components/platform/course-card"
import { CardShell, EmptyState, PageHeader, Rise, Segmented, type SegmentedOption } from "@/components/ui/system"
import { useBookmarkedIds, useBrowseCourses, useMyEnrollmentIntent, useToggleBookmark } from "@/lib/hooks/queries"
import { programPriceLabel } from "@/lib/program-price"
import { schoolCover } from "@/lib/school-art"
import { SCHOOLS, isSchoolSlug, type SchoolSlug } from "@/lib/schools"
import { cn } from "@/lib/utils"

type Level = "All" | "Beginner" | "Intermediate" | "Advanced"
const LEVELS: readonly SegmentedOption<Level>[] = [
  { key: "All", label: "All levels" },
  { key: "Beginner", label: "Beginner" },
  { key: "Intermediate", label: "Intermediate" },
  { key: "Advanced", label: "Advanced" },
]

const CHIP =
  "flex h-10 shrink-0 items-center gap-2 rounded-full pl-1.5 pr-4 text-[13px] font-medium transition-colors duration-[var(--ws-motion-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"

/*
 * Browse programs — by school first (owner, 2026-09-16), then level, then a
 * search. It opens on the learner's own school: `?school=` when linked, else
 * the school they saved. The school chips are a filter, not tabs: raised when
 * pressed, never gold. Level is the page's one Segmented.
 */
export default function BrowseProgramsPage() {
  const paramSchool = useSearchParams().get("school")
  const { data: intent } = useMyEnrollmentIntent()
  const [search, setSearch] = useState("")
  const [level, setLevel] = useState<Level>("All")
  // null = the learner has not touched the filter yet, so the default applies.
  const [chosen, setChosen] = useState<SchoolSlug | "all" | null>(null)
  const school: SchoolSlug | "all" = chosen ?? (isSchoolSlug(paramSchool) ? paramSchool : (intent?.school ?? "all"))

  const filters = useMemo(() => ({ level, pricing: "All" }), [level])
  const { data: courses = [], isLoading } = useBrowseCourses(filters)
  const bookmarkedIds = useBookmarkedIds()
  const toggleBookmark = useToggleBookmark()

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return courses.filter(
      (c) =>
        (school === "all" || c.school === school) &&
        (!q || c.title.toLowerCase().includes(q) || c.instructorName.toLowerCase().includes(q))
    )
  }, [courses, school, search])

  const filtered = school !== "all" || level !== "All" || search.trim() !== ""

  return (
    <>
      <Topbar title="Programs" />
      <div className="flex-1 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 md:px-8 md:pb-12 md:pt-8 lg:px-12">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
          <Rise>
            <PageHeader title="Programs" subtitle="Expert-led programs across eight schools. Start with yours." />
          </Rise>

          <Rise delay={60} className="flex flex-col gap-4">
            <div
              role="group"
              aria-label="School"
              className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
            >
              <button
                type="button"
                aria-pressed={school === "all"}
                onClick={() => setChosen("all")}
                className={cn(
                  CHIP,
                  "pl-4",
                  school === "all" ? "bg-accent text-foreground ring-1 ring-border" : "bg-card text-muted-foreground hover:bg-accent"
                )}
              >
                All schools
              </button>
              {SCHOOLS.map((s) => {
                const cover = schoolCover(s.slug)
                const on = school === s.slug
                return (
                  <button
                    key={s.slug}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setChosen(s.slug)}
                    className={cn(
                      CHIP,
                      !cover && "pl-4",
                      on ? "bg-accent text-foreground ring-1 ring-border" : "bg-card text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {cover && (
                      <Image src={cover} alt="" width={28} height={28} className="h-7 w-7 rounded-full object-cover" />
                    )}
                    {s.short}
                  </button>
                )
              })}
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <label className="relative flex-1">
                <span className="sr-only">Search programs</span>
                <HugeiconsIcon
                  icon={Search01Icon}
                  className="ws-icon-mono pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ws-subtle"
                  aria-hidden
                />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search programs"
                  className="h-11 w-full rounded-full border border-transparent bg-ws-chip pl-10 pr-4 text-base text-ws-primary outline-none transition-colors duration-[var(--ws-motion-fast)] placeholder:text-ws-subtle focus:border-ws-brand md:h-10 md:text-sm"
                />
              </label>
              <Segmented options={LEVELS} value={level} onChange={setLevel} size="sm" className="self-start md:self-auto" />
            </div>
          </Rise>

          <Rise delay={120}>
            {isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <CourseCardSkeleton key={i} />
                ))}
              </div>
            ) : shown.length === 0 ? (
              <CardShell>
                <EmptyState
                  illustration="noTransactions"
                  title={filtered ? "No programs match" : "No programs published yet"}
                  description={
                    filtered
                      ? "Try another school or level — every program is listed under All schools."
                      : "New programs appear here as instructors publish them."
                  }
                  ctas={
                    filtered
                      ? [{ label: "Clear filters", onClick: () => { setChosen("all"); setLevel("All"); setSearch("") } }]
                      : []
                  }
                />
              </CardShell>
            ) : (
              <>
                <p className="mb-3 text-[13px] tabular-nums text-muted-foreground" aria-live="polite">
                  {shown.length === 1 ? "1 program" : `${shown.length} programs`}
                </p>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {shown.map((course) => (
                    <CourseCard
                      key={course.id}
                      href={`/dashboard/courses/${course.id}`}
                      title={course.title}
                      thumbnailUrl={course.thumbnailUrl}
                      price={course.price}
                      pricing={course.pricing}
                      priceLabel={programPriceLabel(course)}
                      rating={course.rating}
                      level={course.level}
                      totalDuration={course.totalDuration}
                      enrolledCount={course.enrolledCount}
                      comingSoonAt={
                        course.availableAt && new Date(course.availableAt).getTime() > Date.now()
                          ? course.availableAt
                          : null
                      }
                      isBookmarked={bookmarkedIds.has(course.id)}
                      onToggleBookmark={() => toggleBookmark.mutate(course.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </Rise>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 3: Retire what nothing imports.** `grep -rn "components/courses/course-grid\|skeletons/course-skeletons" app components`. For each of `components/courses/course-grid.tsx`, `components/courses/course-card.tsx` and `CourseGridSkeleton`: delete it **only** if no importer remains; otherwise leave it and list the importers in the task report.

- [ ] **Step 4: Verify.** tsc; eslint on both files. `mock_persona=student`, `$BASE/dashboard/courses`: title reads "Programs"; school chips carry their covers; choosing a school filters the grid and the count; Level is a sunken-track Segmented, not gold; search narrows by title or instructor; Forex reads "From $…"; bookmark toggles. `?school=cybersecurity` opens filtered. `mock_persona=fresh` with a saved Trading intent opens on Trading. A filter with no result shows the empty state and "Clear filters" restores the grid. 390 px: chips scroll inside their row, the page does not.

- [ ] **Step 5: Commit.**

```bash
git add "app/(platform)/dashboard/courses/page.tsx" components/platform/course-card.tsx
git commit -m "feat(browse): the student programs page on v2, filtered by school"
```

### Task 16: The landing keeps inviting — a school bar that follows, and the certificate

**Files:**
- Create: `components/marketing/start-school-store.ts`, `components/marketing/sticky-school-bar.tsx`, `components/marketing/certificate-band.tsx`
- Modify: `components/marketing/hero-wall.tsx`, `components/marketing/landing.tsx`

**Interfaces:**
- Produces: `useStartSchool` (`{ picked: SchoolSlug | null; pick(slug): void }`) — the hero and the bar share one choice.

- [ ] **Step 1: The shared choice.** Create `components/marketing/start-school-store.ts` (zustand is already a dependency; `lib/vivid/store.ts` is the precedent):

```ts
import { create } from "zustand"
import type { SchoolSlug } from "@/lib/schools"
import { START_SCHOOL_COOKIE } from "@/lib/start-gate"

/** The school picked on the landing — shared by the hero's chips and the bar that follows the visitor down the page. */
export const useStartSchool = create<{ picked: SchoolSlug | null; pick: (slug: SchoolSlug) => void }>((set) => ({
  picked: null,
  pick: (slug) => {
    // Survives the sign-up round trip even if the hub drops the return URL.
    document.cookie = `${START_SCHOOL_COOKIE}=${slug}; path=/; max-age=2592000; samesite=lax`
    set({ picked: slug })
  },
}))
```

  In `components/marketing/hero-wall.tsx` (after Task 8): delete the local `picked` state and the `pick` function, import `useStartSchool`, and read `const picked = useStartSchool((s) => s.picked)` and `const pick = useStartSchool((s) => s.pick)`. Drop the now-unused `START_SCHOOL_COOKIE` import. Give the hero `<section>` `id="hero"`.

- [ ] **Step 2: Create `components/marketing/sticky-school-bar.tsx`.**

```tsx
"use client"

import * as React from "react"
import Link from "next/link"
import { SCHOOLS, type SchoolSlug } from "@/lib/schools"
import { useStartSchool } from "@/components/marketing/start-school-store"
import { cn } from "@/lib/utils"

/**
 * Once the hero has scrolled away, its one action follows the visitor: the
 * school they picked (or the invitation to pick one) and the way in. It shows
 * only while the hero — and the hero's gold CTA — is off screen, so the page
 * still has one primary action in view. `inert` while hidden keeps it out of
 * the tab order.
 */
export function StickySchoolBar({ cheapest }: { cheapest: Record<SchoolSlug, number | null> }) {
  const picked = useStartSchool((s) => s.picked)
  const [show, setShow] = React.useState(false)

  React.useEffect(() => {
    const hero = document.getElementById("hero")
    if (!hero) return
    const io = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting), { threshold: 0 })
    io.observe(hero)
    return () => io.disconnect()
  }, [])

  const school = picked ? SCHOOLS.find((s) => s.slug === picked)! : null
  const from = school ? cheapest[school.slug] : null

  return (
    <div
      inert={!show}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] transition-[transform,opacity] duration-[var(--ws-motion-base)] motion-reduce:transition-none",
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      )}
    >
      <div className="flex w-full max-w-md items-center gap-3 rounded-full bg-ws-raised p-2 pl-5 ring-1 ring-ws-hairline">
        <p className="min-w-0 flex-1 truncate text-[13.5px] text-ws-primary">
          {school ? (
            <>
              <span className="font-semibold">{school.short}</span>
              {from !== null && (
                <span className="tabular-nums text-ws-muted">
                  {" "}· {from === 0 ? "free to start" : `from $${from.toLocaleString("en-US")}`}
                </span>
              )}
            </>
          ) : (
            "What do you want to master?"
          )}
        </p>
        <Link
          href={school ? `/dashboard/start?school=${school.slug}` : "/#schools"}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-ws-brand px-5 text-[14px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"
        >
          {school ? "Start" : "Choose a school"}
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `components/marketing/certificate-band.tsx`** (blueprint §13, which the landing does not show yet). The sample is drawn on paper in both themes by scoping the light tokens to its subtree; it is labelled a sample and names no person.

```tsx
import Image from "next/image"
import { CheckIcon } from "lucide-react"
import { BRAND } from "@/lib/brand"
import { Reveal, RevealGroup } from "@/components/marketing/motion/reveal"
import { SectionLabel, SectionTitle } from "@/components/marketing/section-heading"

const SHOWS = ["Student name", "Program", "Completion date", "Certificate ID", "Authorized signature", `${BRAND.name} branding`]

/** CERTIFICATION (spec §13): the claim, what the certificate carries, and what one looks like. */
export function CertificateBand() {
  return (
    <section className="py-14 sm:py-20 md:py-28" aria-labelledby="certificate-heading">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 lg:grid-cols-2 lg:gap-16">
        <RevealGroup>
          <SectionLabel>Certification</SectionLabel>
          <SectionTitle id="certificate-heading" className="mt-4 max-w-xl">
            Learn. Complete. Get recognized.
          </SectionTitle>
          <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-ws-muted md:text-[17px]">
            Students who successfully meet the requirements of eligible programs can receive a {BRAND.name}{" "}
            certificate. Every certificate carries an ID that anyone can verify online.
          </p>
          <ul className="mt-6 grid max-w-xl gap-x-6 gap-y-2.5 sm:grid-cols-2">
            {SHOWS.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[14px] text-ws-muted">
                <CheckIcon size={15} className="mt-0.5 shrink-0 text-ws-subtle" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </RevealGroup>

        <Reveal y={24} duration={0.7}>
          <div
            data-ws-theme="platform-light"
            role="img"
            aria-label="A sample certificate"
            className="relative mx-auto w-full max-w-lg -rotate-2 rounded-[20px] border border-ws-hairline bg-ws-surface p-8 text-center sm:p-10"
          >
            <span className="absolute right-5 top-5 rounded-full bg-ws-chip px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-ws-muted">
              Sample
            </span>
            <Image src="/brand/wsa-mark.png" alt="" width={36} height={36} className="mx-auto h-9 w-9 object-contain" />
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-ws-muted">{BRAND.name}</p>
            <p className="mt-6 font-display text-[22px] font-semibold tracking-[-0.01em] text-ws-primary sm:text-[26px]">
              Certificate of Completion
            </p>
            <p className="mt-5 text-[13px] text-ws-muted">This certifies that</p>
            <p className="mt-1 font-display text-[26px] font-light text-ws-primary sm:text-[30px]">Your Name</p>
            <p className="mt-3 text-[13px] text-ws-muted">has successfully completed the program</p>
            <p className="mt-1 font-display text-[17px] font-semibold text-ws-primary">Your Program</p>
            <div className="mt-8 flex items-end justify-between border-t border-ws-hairline pt-4 text-left text-[11px] text-ws-muted">
              <span>
                Certificate ID
                <span className="block font-mono text-[12px] tabular-nums text-ws-primary">
                  {BRAND.certificatePrefix}-XXXXXXXX
                </span>
              </span>
              <span className="text-right">
                Completed
                <span className="block text-[12px] text-ws-primary">Your date</span>
              </span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Mount both.** In `components/marketing/landing.tsx`: import both; render `<CertificateBand />` directly after `<HowItWorks />` with the comment `{/* Certification — what completing a program earns (spec §13) */}`; render `<StickySchoolBar cheapest={schoolFrom} />` as the last child of the wrapper `<div>`. Add both to the doc comment's section order.

- [ ] **Step 5: Verify.** tsc; eslint on the five files. `$BASE/` as guest: scroll past the hero → the bar rises from the bottom reading "What do you want to master? · Choose a school"; scroll back up → it leaves. Pick **AI & Automation** in the hero, scroll → the bar reads "AI & Automation · from $…" and **Start** goes to `/dashboard/start?school=ai-automation`. While hidden, Tab never lands in it. In dark mode the sample certificate is still paper-white; in light mode it sits on a hairline. 390 px: the bar spans the width above the home indicator and covers no CTA in the finale when scrolled to the very end (if it does, add `pb-24` to the landing wrapper). Reduced motion: the bar appears without sliding.

- [ ] **Step 6: Commit.**

```bash
git add components/marketing/start-school-store.ts components/marketing/sticky-school-bar.tsx components/marketing/certificate-band.tsx components/marketing/hero-wall.tsx components/marketing/landing.tsx
git commit -m "feat(landing): a school bar that follows the visitor, and the certificate band"
```

### Task 17: Visible defects from the 2026-09-16 audit

Each line below was true on 2026-09-16. **Re-verify it against the code before changing anything**; skip and report any that no longer reproduces.

**Files:**
- Modify: `components/ui/button.tsx`, the student-shell files named below

- [ ] **Step 1: The console error on every page.** Base UI logs an error when `<Button render={<Link/>}>` renders a non-`<button>` element without `nativeButton={false}` (31 call sites). Fix it once, in `components/ui/button.tsx`: destructure `render` and `nativeButton` from the props and pass them through explicitly —

```tsx
function Button({
  className,
  variant = "default",
  size = "default",
  loading = false,
  disabled,
  children,
  render,
  nativeButton,
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & { loading?: boolean }) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      render={render}
      // A `render` target is a link or a custom element here, never a native
      // <button>; callers can still say otherwise.
      nativeButton={nativeButton ?? (render ? false : undefined)}
      {...props}
    >
```

  Verify: load `/dashboard`, `/`, `/dashboard/wallet` with the console open — the Base UI `nativeButton` error is gone, and a plain `<Button onClick>` still submits forms and takes Enter/Space.

- [ ] **Step 2: "Course" → "program" in the student shell.** Run `grep -rn "Browse courses\|Browse Courses\|Course Content\|Search courses\|courses: \"Courses\"" app/\(platform\) components/platform components/shared components/learn`. Change only user-visible strings, only on student surfaces: `Browse courses` → `Browse programs`; the topbar breadcrumb label `courses: "Courses"` → `courses: "Programs"`; the command palette's and search inputs' `Search courses` → `Search programs`; the lesson sidebar's `Course Content` → `Program content`. Do not rename routes, props, files or instructor/admin copy.

- [ ] **Step 3: A failed query must not sit on a skeleton forever.** For the wallet, notifications, bookmarks, assignments and mentorship pages: where the page renders its skeleton on `isLoading`, read `isError` and `refetch` from the same query and render, in the skeleton's place:

```tsx
<CardShell>
  <EmptyState
    illustration="noTransactions"
    title="Couldn't load this"
    description="Check your connection and try again."
    ctas={[{ label: "Try again", onClick: () => refetch() }]}
  />
</CardShell>
```

  Verify each by blocking the action's request in DevTools (Network → block request URL) and reloading: the retry card appears, and **Try again** recovers once unblocked.

- [ ] **Step 4: Verify the whole task.** tsc; `npx eslint components/ui/button.tsx` and each touched file; `pnpm lint` stays at the 53-warning baseline.

- [ ] **Step 5: Commit.**

```bash
git add -A components app
git commit -m "fix(ui): Button render without the Base UI error, program wording, retry on failed queries"
```

---

## Exit criteria

- [ ] Every program card names its school and instructor; programs with outcomes peek them on hover and focus; `/programs` shows each school's cover panel beside its programs.
- [ ] `/dashboard/courses` is on the v2 kit, filters by school (opening on the learner's own), and carries no "course" wording, gold filter chip or "No img".
- [ ] On the landing, the school bar follows the visitor once the hero leaves and is inert while hidden; the certificate band renders on paper in both themes and is labelled a sample.
- [ ] No Base UI `nativeButton` console error on any page; failed queries offer a retry.
- [ ] The student program page never quotes a price to an enrolled learner, quotes "From" for a ladder, prints no zero figure, and shows the package ladder to buyers; its access behaviour is unchanged.
- [ ] `/dashboard/meetings` has a header; a learner is not offered "Start Meeting"; instructors and admins are.
- [ ] The landing's free-lesson section is absent with no free lessons and appears with one; no non-free `videoUrl` leaves the server.
- [ ] `upload-program-art.mjs` dry-runs clean on the mock database and refuses `--apply` without an explicit `MONGODB_URI`. *(owner: the production `--apply`, runbook)*
- [ ] A `USER` with no enrollment and no saved school cannot reach `/dashboard` without choosing a school; instructors, admins, applicants and existing students are never asked; a gate failure opens the dashboard.
- [ ] A school can be chosen in the landing's first viewport at 1280 px and 390 px, and the choice survives sign-in by URL and by cookie.
- [ ] "Save and pay later" exists on the package step and on checkout; the dashboard hero offers the exact order back; emails go at 24 h and 72 h, at most once each, and stop on enrolment.
- [ ] No public or student surface shows an empty art box or a "No thumbnail" label; instructor surfaces still do.
- [ ] `purchaseCourse` and every wallet path are byte-for-byte unchanged (`git diff main -- lib/actions/enrollments.ts lib/wallet.ts` is empty).
- [ ] No new dependency; no token or palette change; lint at baseline; tsc and build clean.

## Part F — The pages behind the cards (run after Part E, before Task 12)

Added 2026-09-18 at the owner's request: the four items first listed as "still owed". Tasks 18–21.

### Task 18: The student program page tells the truth, in the v2 shape

**Files:**
- Create: `lib/program-rail.ts`
- Modify: `app/(platform)/dashboard/courses/[courseId]/page.tsx`

**What is wrong today (read from the page, 2026-09-18):**
- `const priceLabel = course.pricing === "free" ? "Free" : \`$${course.price}\`` — `price` is the *cheapest* tier, and it prints for everyone. A learner who paid $999 for Executive sees "$49 · One-time purchase", and so does a buyer about to choose between three packages.
- The stat tiles and the rail print `course.totalLessons` and `course.totalDuration` (stored counters, 0 on the new programs) beside a curriculum built from `course.lessons` (the real rows). Hence "0 lessons · 0m" above a three-lesson list.
- The hero says "N students" for this program while `AboutInstructor` gets `instructorTotalStudents`, a stored counter that can be lower. The two numbers disagree.
- Gold stat icons (gold as decoration), 13px `rounded-lg` cards, "About this course", "Enroll Now", "Students also viewed".

**Ruling:** access logic is not touched. `checkEnrollment`, `getCourseAccess`, `CourseSchedulingCta`, the learn route and every `href` keep their behaviour; this task changes what is *printed* and the page's shape. `CourseSchedulingCta` still receives `price={course.price}`; for a ladder that is a "from" figure — note it in the report, do not fix it here.

**Interfaces:**
- Produces: `programRail(input): ProgramRail` · `programStats(course): { label: string; value: string }[]`.
- Consumes: `fetchProgramById` (packages, `tierCount`), `getCourseAccess` (`packageName`), `PackageLadder` and `ProgramAccess` (`components/programs/`).

- [ ] **Step 1: Create `lib/program-rail.ts`.** Pure.

```ts
/**
 * What the student program page may print about price and size. One rule
 * each: an enrolled learner is never quoted a price; a ladder is quoted
 * "From"; a zero is not a fact worth showing.
 */
export type ProgramRail = {
  /** The large figure: a price, "Free", or "Enrolled". */
  headline: string
  /** The chip beside it. */
  note: string
  /** Button copy for a buyer; null when enrolled (the page renders Continue). */
  buyLabel: string | null
}

export function programRail(input: {
  isEnrolled: boolean
  /** Enrollment.packageName of the access-granting enrollment, else null. */
  packageName: string | null
  pricing: "free" | "paid"
  /** Whole USD; for a ladder, the cheapest enabled tier. */
  price: number | null
  /** Enabled tiers; 0 or 1 = a single price. */
  tierCount: number
}): ProgramRail {
  if (input.isEnrolled) return { headline: "Enrolled", note: input.packageName ?? "Full access", buyLabel: null }
  if (input.pricing === "free" || !input.price) return { headline: "Free", note: "Full access", buyLabel: "Enrol for free" }
  const usd = `$${input.price.toLocaleString("en-US")}`
  if (input.tierCount > 1) {
    return { headline: `From ${usd}`, note: `${input.tierCount} packages`, buyLabel: "Choose your package" }
  }
  return { headline: usd, note: "One-time purchase", buyLabel: "Enrol now" }
}

function minutesLabel(total: number): string {
  const h = Math.floor(total / 60)
  const m = Math.round(total % 60)
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

/**
 * The page's figures, from the real lesson rows first and the stored counters
 * second. Anything that would read 0 is left out.
 */
export function programStats(course: {
  totalLessons: number
  /** Minutes. */
  totalDuration: number
  enrolledCount: number
  lessons: ReadonlyArray<{ duration: number | null }>
}): { label: string; value: string }[] {
  const lessons = course.lessons.length || course.totalLessons
  const minutes = course.totalDuration || course.lessons.reduce((sum, l) => sum + (l.duration ?? 0), 0)
  const out: { label: string; value: string }[] = []
  if (lessons > 0) out.push({ label: "Lessons", value: String(lessons) })
  if (minutes > 0) out.push({ label: "Duration", value: minutesLabel(minutes) })
  if (course.enrolledCount > 0) out.push({ label: "Enrolled", value: course.enrolledCount.toLocaleString("en-US") })
  return out
}
```

- [ ] **Step 2: Check the rules.** Create `"$H/t18-rail.ts"`:

```ts
import assert from "node:assert/strict"
import { programRail, programStats } from "@/lib/program-rail"

const ladder = { pricing: "paid" as const, price: 49, tierCount: 3 }
assert.deepEqual(programRail({ ...ladder, isEnrolled: true, packageName: "Executive 101" }), { headline: "Enrolled", note: "Executive 101", buyLabel: null }, "a $999 mentee is never quoted $49")
assert.deepEqual(programRail({ ...ladder, isEnrolled: true, packageName: null }), { headline: "Enrolled", note: "Full access", buyLabel: null }, "grandfathered")
assert.deepEqual(programRail({ ...ladder, isEnrolled: false, packageName: null }), { headline: "From $49", note: "3 packages", buyLabel: "Choose your package" })
assert.deepEqual(programRail({ pricing: "paid", price: 1999, tierCount: 1, isEnrolled: false, packageName: null }), { headline: "$1,999", note: "One-time purchase", buyLabel: "Enrol now" })
assert.deepEqual(programRail({ pricing: "free", price: 0, tierCount: 0, isEnrolled: false, packageName: null }), { headline: "Free", note: "Full access", buyLabel: "Enrol for free" })

assert.deepEqual(programStats({ totalLessons: 0, totalDuration: 0, enrolledCount: 0, lessons: [] }), [], "a new program prints nothing, not three zeros")
assert.deepEqual(
  programStats({ totalLessons: 0, totalDuration: 0, enrolledCount: 12, lessons: [{ duration: 30 }, { duration: 45 }, { duration: null }] }),
  [{ label: "Lessons", value: "3" }, { label: "Duration", value: "1h 15m" }, { label: "Enrolled", value: "12" }],
  "real rows win over stale counters"
)
console.log("program-rail: all assertions passed")
```

  `npx tsx --tsconfig ./tsconfig.json "$H/t18-rail.ts"` → `program-rail: all assertions passed`.

- [ ] **Step 3: Feed the page.** In `app/(platform)/dashboard/courses/[courseId]/page.tsx`:
  - imports: add `fetchProgramById` to the `@/lib/actions/student` import; add `import { programRail, programStats } from "@/lib/program-rail"`, `import { PackageLadder } from "@/components/programs/package-ladder"`, `import type { ProgramAccess } from "@/components/programs/access"`, `import { CardShell } from "@/components/ui/system"`. Remove `BookOpenIcon, ClockIcon, UsersIcon` and `RenderIcon` once Step 5 stops using them.
  - add `fetchProgramById(courseId)` as a fifth entry of the existing `Promise.all`, destructured as `program`.
  - delete `totalHours`, `totalMins`, `durationLabel` and `priceLabel`. After the `courseAccess` line add:

```tsx
  const rail = programRail({
    isEnrolled,
    packageName: courseAccess?.packageName ?? null,
    pricing: course.pricing,
    price: course.price,
    tierCount: program?.tierCount ?? 0,
  })
  const stats = programStats(course)
  const packages = program?.packages ?? []
  // The on-page ladder answers "which package?" before checkout does.
  const showLadder = !isEnrolled && !isPreEnrolled && packages.length > 1
  const ladderAccess: ProgramAccess = isComingSoon ? { kind: "coming_soon" } : { kind: "open" }
```

  Move the `isComingSoon` / `isPreEnrolled` consts above this block (they are defined just below it today).

- [ ] **Step 4: The CTA stops quoting a price.** In the `cta` expression: the enrolled link's text becomes `Continue learning`; the buyer link becomes

```tsx
    <Link
      href={showLadder ? "#packages" : `/dashboard/checkout?courseId=${course.id}`}
      className="flex h-11 flex-1 items-center justify-center rounded-full bg-ws-brand px-5 text-sm font-semibold text-ws-brand-on transition-opacity hover:opacity-90"
    >
      {rail.buyLabel}
    </Link>
```

  and the enrolled link's `rounded-sm` also becomes `rounded-full`. (`PackageLadder` renders `id="packages"` and its cards link to checkout with the package key.)

- [ ] **Step 5: Print only what is true.**
  - Hero: the price `<Badge>` prints `{rail.headline}`. The line `<span>{course.enrolledCount.toLocaleString()} students</span>` and the `·` before it render only when `course.enrolledCount > 0`, as `{n} enrolled`.
  - Replace the whole `{/* Quick stats */}` grid with one fill-separated card, ink figures, no icons:

```tsx
              {stats.length > 0 && (
                <CardShell className="h-auto flex-row divide-x divide-border">
                  {stats.map((stat) => (
                    <div key={stat.label} className="flex min-w-0 flex-1 flex-col gap-1 px-5 py-4">
                      <span className="font-display text-[22px] font-light leading-none tabular-nums tracking-[-0.02em] text-foreground">
                        {stat.value}
                      </span>
                      <span className="text-[12px] text-muted-foreground">{stat.label}</span>
                    </div>
                  ))}
                </CardShell>
              )}
```

  - Directly after `<CourseOutcomes … />` add `{showLadder && <PackageLadder courseId={course.id} packages={packages} access={ladderAccess} />}`.
  - Curriculum heading: `({course.lessons.length} lessons)` renders only when `course.lessons.length > 0`.
  - Rail: the figure prints `{rail.headline}` and the chip `{rail.note}`. Replace the four hand-written `<div>` rows of the `<dl>` with `stats` mapped to rows of the same markup, followed by the existing Level row. The rail card and the mobile bar's container go from `rounded-lg` to `rounded-[20px]` (the bar keeps square bottom corners: `rounded-t-[20px]`).
  - Mobile bar: the eyebrow reads `{isEnrolled ? "Your package" : rail.note}` and the figure `{isEnrolled ? rail.note : rail.headline}`.
  - `AboutInstructor`: `totalStudents={Math.max(course.instructorTotalStudents, course.enrolledCount)}` — an instructor cannot have fewer students than this one program has.
  - Wording: "About this course" → "About this program"; `title="Students also viewed"` → `title="Learners also viewed"`.

- [ ] **Step 6: Verify.** tsc; `npx eslint lib/program-rail.ts "app/(platform)/dashboard/courses/[courseId]/page.tsx"`. Then, on Forex (three packages):
  1. `mock_persona=fresh` → hero and rail read "From $…" · "3 packages"; the gold button reads "Choose your package" and scrolls to the ladder; each ladder card goes to checkout with its `package=`.
  2. Enrol `fresh` on Executive (free the price in the mock DB or use the mock wallet branch) → rail reads "Enrolled · Executive 101"; no dollar figure anywhere on the page; button reads "Continue learning"; the ladder is gone.
  3. A program with lessons but zero stored counters → the stat card shows the real lesson count and summed duration; a program with no lessons, no duration and no learners → no stat card at all, and the rail lists only Level.
  4. A single-price program → "$99 · One-time purchase", "Enrol now" straight to checkout, no ladder.
  5. A coming-soon program and a pre-enrolled learner → `CourseSchedulingCta` exactly as before.
  6. 390 px: the bottom bar shows the same truth; nothing overlaps the bottom nav.

- [ ] **Step 7: Commit.**

```bash
git add lib/program-rail.ts "app/(platform)/dashboard/courses/[courseId]/page.tsx"
git commit -m "fix(program-page): never quote a price to an enrolled learner, print real figures, v2 shape"
```

### Task 19: The meetings page gets a header, and students stop being offered "Start Meeting"

**Files:**
- Modify: `components/meetings/meeting-lobby.tsx`, `app/(platform)/dashboard/meetings/page.tsx`

**Ruling:** this is a UI change only. A learner's page is for joining classes, mentorship sessions and invitations; hosting belongs to instructors and admins. The server action behind "Start Meeting" is **not** changed here — check whether it verifies the caller's role and write the answer in the task report; if it does not, that is a separate, owner-approved change.

- [ ] **Step 1: `MeetingQuickActions` learns who is looking.** In `components/meetings/meeting-lobby.tsx`, add `canStart = true` to the props (`canStart?: boolean` with the comment `/** Hosts only. A learner sees Join alone. */`). The grid class becomes `cn("grid grid-cols-1 gap-3", canStart && "sm:grid-cols-2")` and the `{/* Start Meeting card */}` button renders only when `canStart`. Import `cn` if the file does not already.

- [ ] **Step 2: The empty state stops telling learners to host.** `ActiveMeetingsList` takes the same optional `canStart = true`. Its empty copy "Start a meeting to collaborate with screen sharing, chat, and polls." renders when `canStart`; otherwise: "Live classes, mentorship sessions and invitations appear here when they start."

- [ ] **Step 3: The header.** In `app/(platform)/dashboard/meetings/page.tsx`: import `PageHeader` from `@/components/ui/system`; add `const canStart = user.role !== "USER"` beside the other derived values; as the first child of the `space-y-6` content wrapper (above `{/* Quick actions hero */}`) add

```tsx
          <PageHeader
            title="Meetings"
            subtitle={
              canStart
                ? "Start a session, or join one you've been invited to."
                : "Join your live classes, mentorship sessions and invitations."
            }
          />
```

  and pass `canStart={canStart}` to both `<MeetingQuickActions>` and `<ActiveMeetingsList>`.

- [ ] **Step 4: Verify.** tsc; eslint on both files. `mock_persona=student` → `/dashboard/meetings` has a title and subtitle, one full-width Join card, and the learner empty copy. `mock_persona=instructor` and `admin` → both cards, as before. Joining by link still works for all three. The page's modal (`CreateMeetingModal`) is unreachable for a learner.

- [ ] **Step 5: Commit.**

```bash
git add components/meetings/meeting-lobby.tsx "app/(platform)/dashboard/meetings/page.tsx"
git commit -m "fix(meetings): a page header, and hosting controls only for hosts"
```

### Task 20: "Watch a free lesson" on the landing

**Files:**
- Create: `components/marketing/free-preview-rail.tsx`
- Modify: `lib/actions/student.ts`, `components/marketing/landing.tsx`

**Why now, although no program has lessons yet:** the section follows the landing's rule — it hides at zero, never fakes — so it costs nothing today and appears by itself the day an instructor marks a video lesson "free preview". That switch already exists in the lesson editor (`Lesson.isFree`), and `fetchPublicCourse` already exposes a free lesson's `videoUrl`; this task shows the same thing one page earlier.

**Interfaces:**
- Produces: `fetchFreePreviewLessons(limit?: number): Promise<FreePreview[]>`.

- [ ] **Step 1: The read model.** Append to the BROWSE section of `lib/actions/student.ts`:

```ts
export type FreePreview = {
  lessonId: string
  lessonTitle: string
  /** Whole minutes; null when unknown. */
  minutes: number | null
  /** The lesson's poster, else the program's art. */
  posterUrl: string | null
  /** Public by the instructor's choice: only `isFree` lessons ever reach here. */
  videoUrl: string
  courseTitle: string
  courseSlug: string
  school: SchoolSlug | null
}

/**
 * Free preview video lessons from published programs, for the landing. The
 * same exposure rule as fetchPublicCourse: a videoUrl leaves the server only
 * when the instructor marked the lesson `isFree`. One per program, so a single
 * generous program cannot fill the rail.
 */
export async function fetchFreePreviewLessons(limit = 6): Promise<FreePreview[]> {
  try {
    await connectDB()
    const lessons = await Lesson.find({
      isFree: true,
      isPublished: true,
      type: "video",
      videoUrl: { $nin: [null, ""] },
    })
      .sort({ order: 1 })
      .limit(60)
      .populate({ path: "course", match: { status: "published" }, select: "title slug school thumbnailUrl" })
      .select("title videoUrl videoDuration videoThumbnailUrl course")
      .lean()

    const seen = new Set<string>()
    const out: FreePreview[] = []
    for (const lesson of lessons) {
      const course = lesson.course as unknown as {
        _id: { toString(): string }
        title: string
        slug: string
        school?: string | null
        thumbnailUrl: string | null
      } | null
      if (!course || !lesson.videoUrl) continue // populate `match` nulls unpublished programs
      const courseId = course._id.toString()
      if (seen.has(courseId)) continue
      seen.add(courseId)
      out.push({
        lessonId: lesson._id.toString(),
        lessonTitle: lesson.title,
        minutes: lesson.videoDuration ? Math.max(1, Math.round(lesson.videoDuration / 60)) : null,
        posterUrl: lesson.videoThumbnailUrl || programArt(course),
        videoUrl: lesson.videoUrl,
        courseTitle: course.title,
        courseSlug: course.slug,
        school: isSchoolSlug(course.school) ? course.school : null,
      })
      if (out.length >= limit) break
    }
    return out
  } catch (error) {
    console.error("Fetch free previews error:", error)
    return []
  }
}
```

- [ ] **Step 2: Create `components/marketing/free-preview-rail.tsx`.**

```tsx
"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { PlayIcon } from "lucide-react"
import type { FreePreview } from "@/lib/actions/student"
import { SCHOOL_BY_SLUG } from "@/lib/schools"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Reveal, RevealGroup } from "@/components/marketing/motion/reveal"
import { SectionLabel, SectionTitle } from "@/components/marketing/section-heading"

/**
 * WATCH A FREE LESSON — the try-before-you-buy row. Real free-preview lessons
 * only; with none, the section does not render. A card opens the lesson in a
 * dialog on the landing itself — no sign-in between the visitor and the first
 * minute — and the dialog's one action leads to the program.
 */
export function FreePreviewRail({ previews }: { previews: FreePreview[] }) {
  const [open, setOpen] = React.useState<FreePreview | null>(null)
  if (previews.length === 0) return null

  return (
    <section className="py-14 sm:py-20 md:py-28" aria-labelledby="preview-heading">
      <div className="mx-auto max-w-7xl px-6">
        <RevealGroup>
          <SectionLabel>Try a lesson</SectionLabel>
          <SectionTitle id="preview-heading" className="mt-4 max-w-2xl">
            Watch a free lesson before you decide
          </SectionTitle>
        </RevealGroup>

        <Reveal y={20} duration={0.65} className="mt-10">
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {previews.map((preview) => (
              <li key={preview.lessonId}>
                <button
                  type="button"
                  onClick={() => setOpen(preview)}
                  className="group flex h-full w-full flex-col overflow-hidden rounded-[20px] border border-ws-hairline bg-ws-surface text-left transition-colors duration-[var(--ws-motion-base)] hover:bg-ws-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 dark:border-transparent"
                >
                  <span className="relative block aspect-video w-full overflow-hidden bg-ws-sunken">
                    {preview.posterUrl && (
                      <Image
                        src={preview.posterUrl}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 416px"
                        className="object-cover transition-transform duration-600 ease-[var(--ws-ease-rise)] group-hover:scale-[1.03] motion-reduce:transition-none"
                      />
                    )}
                    <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white">
                        <PlayIcon size={18} fill="currentColor" aria-hidden />
                      </span>
                    </span>
                    {preview.minutes !== null && (
                      <span className="absolute bottom-2.5 right-3 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium tabular-nums text-white">
                        {preview.minutes} min
                      </span>
                    )}
                  </span>
                  <span className="flex flex-1 flex-col p-4">
                    <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-ws-subtle">
                      {preview.school ? SCHOOL_BY_SLUG[preview.school].short : "Free lesson"}
                    </span>
                    <span className="mt-1.5 line-clamp-2 font-display text-[16px] font-semibold leading-[1.3] text-ws-primary">
                      {preview.lessonTitle}
                    </span>
                    <span className="mt-1 text-[13px] text-ws-muted">{preview.courseTitle}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>

      <Dialog open={open !== null} onOpenChange={(next) => !next && setOpen(null)}>
        <DialogContent className="max-w-3xl overflow-hidden p-0">
          {open && (
            <>
              {/* Mounted only while open, so closing the dialog stops playback. */}
              <video
                key={open.lessonId}
                src={open.videoUrl}
                poster={open.posterUrl ?? undefined}
                controls
                autoPlay
                playsInline
                className="aspect-video w-full bg-black"
              />
              <div className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <DialogTitle className="truncate font-display text-[17px] font-semibold text-ws-primary">
                    {open.lessonTitle}
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 text-[13px] text-ws-muted">
                    A free lesson from {open.courseTitle}
                  </DialogDescription>
                </div>
                <Link
                  href={`/programs/${open.courseSlug}`}
                  className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-ws-brand px-6 text-[14px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"
                >
                  View the program
                </Link>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
```

- [ ] **Step 3: Mount it.** In `components/marketing/landing.tsx`: add `fetchFreePreviewLessons` to the student import and as a fifth entry of the `Promise.all` (`previews`); render `<FreePreviewRail previews={previews} />` directly after `<CatalogueGrid … />` with the comment `{/* Watch a free lesson — real free previews only; hides at zero */}`; add it to the doc comment's order.

- [ ] **Step 4: Verify.** tsc; eslint on the three files. With no free lessons in the mock DB, `$BASE/` renders no such section and no empty heading. Then mark one published video lesson free (`db.lessons.updateOne({ type: "video", videoUrl: { $ne: null } }, { $set: { isFree: true, isPublished: true } })`): the section appears with one card; the card opens a dialog that plays; Esc and the close button stop the sound; "View the program" lands on the program page. Mark a second lesson of the *same* program free → still one card. An unpublished program's free lesson never appears. View source: no `videoUrl` of a non-free lesson is present anywhere in the landing's payload.

- [ ] **Step 5: Commit.**

```bash
git add lib/actions/student.ts components/marketing/free-preview-rail.tsx components/marketing/landing.tsx
git commit -m "feat(landing): watch a free lesson — real free previews, hidden at zero"
```

### Task 21: Twelve program thumbnails

**Files:**
- Create: `scripts/upload-program-art.mjs`
- Modify: `scripts/optimize-art.mjs`, `docs/launch-runbook.md`

**Why a script and not the editor:** twelve hand uploads through the instructor editor need the twelve instructors' sessions. The art is the Academy's, not theirs. The script writes `Course.thumbnailUrl`, the field the web **and the mobile app** already read, so both get the art with no Go change. School covers remain the fallback for any program added later.

- [ ] **Step 1: The optimiser takes a target.** In `scripts/optimize-art.mjs` replace the usage comment's first line with `// Usage: node scripts/optimize-art.mjs <input-dir> [output-dir] [WIDTHxHEIGHT]`, and replace the `out` line and the `.resize(…)` call with:

```js
const out = path.resolve(process.argv[3] ?? "public/art/schools")
const [width, height] = (process.argv[4] ?? "1600x1000").split("x").map(Number)
if (!width || !height) {
  console.error("size must look like 1600x900")
  process.exit(1)
}
```

```js
    .resize(width, height, { fit: "cover", position: "attention" })
```

  School covers still run as before. Program art runs as `node scripts/optimize-art.mjs <src> <scratch>/programs 1600x900`.

- [ ] **Step 2: The art.** Same shared style line as Task 1, at 16:9. Each program takes its school's accent, with its own object, so a school's programs read as a family beside its cover. Name each file after the program's **slug** — the dry run in Step 4 prints every slug.

  | Program | Subject | Accent |
  |---|---|---|
  | Forex Trading Mastery | two brass scales in balance above a dark relief map of the world | emerald |
  | Crypto Trading Mastery | an unmarked faceted crystal coin hovering over a brass candlestick sculpture | emerald |
  | Blockchain Technology Mastery | a row of glass blocks, each holding a small brass mechanism, joined by light | electric blue |
  | AI & AI Automation | a brass robotic hand setting a glass sphere into a line of identical spheres | violet |
  | App Development with AI | a phone-shaped slab of smoked glass with wireframe layers lifting off it | cyan |
  | Cybersecurity | a steel shield with a keyhole, one brass key suspended before it | teal |
  | Data Analysis | a magnifying lens over marble columns of different heights | amber |
  | Content Creation Mastery | a ring light's halo around a studio microphone | magenta |
  | Video Editing Mastery | a strip of film unspooling into a ribbon across an editing dial | magenta |
  | Tech Sales & Digital Marketing | a brass megaphone facing a rising staircase of stone blocks | coral |
  | E-Commerce & Digital Business | a small stone storefront arch with a glowing parcel on its step | coral |
  | Virtual Assistance | a headset resting on a neat stack of leather notebooks beside a desk clock | coral |

- [ ] **Step 3: Create `scripts/upload-program-art.mjs`.**

```js
/**
 * Upload program thumbnails to the PUBLIC R2 bucket and store their URLs on
 * `courses.thumbnailUrl` (Phase 9, Task 21).
 *
 *   MONGODB_URI=<uri> node scripts/upload-program-art.mjs <dir>             # dry run
 *   MONGODB_URI=<uri> node scripts/upload-program-art.mjs <dir> --apply     # uploads + writes
 *   … --apply --replace                                                     # also overwrite an existing thumbnail
 *
 * <dir> holds `<course-slug>.webp` files (scripts/optimize-art.mjs output).
 * A course is matched by `slug`. The object key carries the file's content
 * hash, so a re-run with the same file is a no-op and a new file never serves
 * from a stale cache. Never deletes an object or a course. Without --replace a
 * course that already has a thumbnail is skipped — an instructor's own upload
 * always wins.
 *
 * SAFETY: .env.local holds the PRODUCTION URI. A dry run may read it; --apply
 * refuses unless MONGODB_URI was set on the command line (the
 * backfill-certificate-ids.mjs rule). R2 credentials come from the env files.
 * Raw collection writes don't bump updatedAt.
 */
import { createHash } from "node:crypto"
import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import mongoose from "mongoose"
import { config } from "dotenv"
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

// Read BEFORE dotenv runs: dotenv never overrides a variable that is already set.
const EXPLICIT_URI = process.env.MONGODB_URI
config({ path: ".env.local" })
config()

const dir = process.argv[2]
const APPLY = process.argv.includes("--apply")
const REPLACE = process.argv.includes("--replace")

if (!dir || dir.startsWith("--")) {
  console.error("usage: MONGODB_URI=<uri> node scripts/upload-program-art.mjs <dir> [--apply] [--replace]")
  process.exit(1)
}
if (APPLY && !EXPLICIT_URI) {
  console.error("REFUSING --apply: MONGODB_URI must be passed on the command line; a URI from .env files is never written to.")
  process.exit(1)
}
const uri = process.env.MONGODB_URI
if (!uri) {
  console.error("MONGODB_URI is not set — refusing to run.")
  process.exit(1)
}
const { CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL } = process.env
if (APPLY && !(CLOUDFLARE_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME && R2_PUBLIC_URL)) {
  console.error("REFUSING --apply: the R2 env (account, keys, R2_BUCKET_NAME, R2_PUBLIC_URL) is incomplete.")
  process.exit(1)
}

await mongoose.connect(uri)
const db = mongoose.connection.db
console.log(`Target: ${uri.replace(/\/\/[^@/]+@/, "//***@")} · database ${db.databaseName} · URI from ${EXPLICIT_URI ? "command line" : ".env file"}`)
console.log(`Bucket: ${R2_BUCKET_NAME ?? "(unset)"} · Mode: ${APPLY ? "APPLY" : "dry run"}${REPLACE ? " + replace" : ""}`)

const courses = db.collection("courses")
const published = await courses
  .find({ status: "published" }, { projection: { slug: 1, title: 1, thumbnailUrl: 1 } })
  .toArray()
const bySlug = new Map(published.map((c) => [c.slug, c]))

const files = (await readdir(dir)).filter((f) => f.toLowerCase().endsWith(".webp"))
const s3 = APPLY
  ? new S3Client({
      region: "auto",
      endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    })
  : null

let written = 0
for (const file of files) {
  const slug = path.parse(file).name
  const course = bySlug.get(slug)
  if (!course) {
    console.log(`SKIP  ${file} — no published course with slug "${slug}"`)
    continue
  }
  if (course.thumbnailUrl && !REPLACE) {
    console.log(`KEEP  ${slug} — already has a thumbnail (pass --replace to overwrite)`)
    continue
  }
  const body = await readFile(path.join(dir, file))
  const hash = createHash("sha256").update(body).digest("hex").slice(0, 8)
  const key = `images/programs/${slug}-${hash}.webp`
  const url = `${R2_PUBLIC_URL ?? "<R2_PUBLIC_URL>"}/${key}`
  if (course.thumbnailUrl === url) {
    console.log(`SAME  ${slug} — this exact file is already live`)
    continue
  }
  console.log(`${APPLY ? "WRITE" : "WOULD"} ${slug} → ${url} (${Math.round(body.length / 1024)} KB)`)
  if (!APPLY) continue
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    })
  )
  await courses.updateOne({ _id: course._id }, { $set: { thumbnailUrl: url } })
  written++
}

const covered = new Set(files.map((f) => path.parse(f).name))
for (const course of published) {
  if (!covered.has(course.slug) && !course.thumbnailUrl) console.log(`OWED  ${course.slug} — no file and no thumbnail (shows its school cover)`)
}
console.log(`${written} thumbnail(s) written.`)
await mongoose.disconnect()
```

  The key prefix `images/` and the public URL shape (`${R2_PUBLIC_URL}/${key}`) are the ones `lib/r2.ts` uses. **Never point this script at `R2_RESOURCES_BUCKET_NAME`** — that bucket must stay private.

- [ ] **Step 4: Verify on the mock database first.** `MONGODB_URI=mongodb://127.0.0.1:27018/worldstreet-academy node scripts/upload-program-art.mjs <scratch>/programs` → one `WOULD` line per file, `SKIP` for a misnamed file, `OWED` for any program without a file, `0 thumbnail(s) written`, and nothing uploaded. Without `MONGODB_URI=` in front, add `--apply` → it refuses. `npx eslint scripts/upload-program-art.mjs scripts/optimize-art.mjs`.

- [ ] **Step 5: The runbook.** In `docs/launch-runbook.md`, beside the catalogue script's section, add: *"Program thumbnails (Phase 9, owner-run, once): `node scripts/optimize-art.mjs <src> <scratch>/programs 1600x900`, then `MONGODB_URI=<prod uri> node scripts/upload-program-art.mjs <scratch>/programs` (read every line of the dry run), then the same with `--apply`. It uploads to the public R2 bucket and sets `thumbnailUrl` only where a program has none; `--replace` overwrites. Re-running is a no-op. Roll back one program by clearing its `thumbnailUrl` — it falls back to its school cover."*

- [ ] **Step 6: Commit.**

```bash
git add scripts/upload-program-art.mjs scripts/optimize-art.mjs docs/launch-runbook.md
git commit -m "feat(art): program thumbnails — prompt sheet, optimiser target, guarded R2 upload script"
```

  The production `--apply` is an **owner step**, like every script in the runbook. After it runs, the hero wall, every card and the mobile app show each program's own art.

---

## Not in this phase — the school pass (Phase 10 candidate)

If the owner means one price for a whole school, it is a product decision before it is code. It needs: a price per school; whether a pass includes programs added later; how one payment splits across several instructors' `Earning` rows; a refund rule when one program of three is completed. In code it touches `Order` (a pass has no single `course`), `lib/entitlements.ts` and `lib/course-access.ts` (access by pass), `purchaseCourse`, the Go API, and the mobile app. Ask him this, verbatim: **"When someone picks a school, do they pay one price for the whole school, or pick a program inside it and pay for that? Today five of the eight schools have one program, so for those it is the same thing."** Phase 9 is built so that either answer leaves it standing: the picker, the gate, the saved school and the art all survive a pass.

## Self-review (done 2026-09-18)

- **Spec coverage.** "Mundane / Coursera, Udemy / pizzazz" → Tasks 1, 2, 8, 9, 10, all of Part E (13–17) and Part F (18–21). "Pick the schools on the landing page" → Tasks 2, 8. "Before they even have access to their dashboard" → Tasks 3, 5, 6. "Pay for the school" → Task 5 + ruling 1. "Bookmark the school to pay later" → Tasks 3, 4, 5, 6, 7, 11.
- **Names** are consistent across tasks: `EnrollmentIntent`, `saveEnrollmentIntent`, `getMyEnrollmentIntent`, `dismissEnrollmentIntent`, `getStartGateState`, `needsSchoolChoice`, `resolveStartStep`, `START_SCHOOL_COOKIE`, `schoolCover`, `programArt`, `cheapestBySchool`, `packagePriceLabel`, `registerUrl`, `useMyEnrollmentIntent`, `queryKeys.enrollmentIntent`.
- **Known unknowns, each with its check in the task:** which `opengraph-image` files read a program thumbnail (Task 9 Step 2); whether the hub honours `redirect` (Preflight — the cookie covers either outcome).
