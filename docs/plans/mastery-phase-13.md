# Mastery Academy — Phase 13 Implementation Plan (Schools v2: seven schools and the full school page)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The academic structure becomes the institutional blueprint's seven schools (§7), and every school page carries §8's sections in order:
- the seven schools in `lib/schools.ts`, each with its overview, what you'll learn, who it's for, career and economic applications, and §7's study areas;
- every old school link, cookie and stored value lands on the right new school;
- a migration script moves stored slugs, and the catalogue files programs under the new schools;
- every surface counts seven.

**Architecture:**
- **One home.** `lib/schools.ts` stays the only place a school is defined. It gains the §8 copy fields, `areas` (§7, verbatim, each with the catalogue title of the program that teaches it) and `legacySlugs` (D21). `schoolFromSlug()` resolves current and retired slugs; every reader of a stored or remembered slug goes through it. Writes stay strict: only the seven slugs are ever written.
- **Data.** `scripts/migrate-schools-v2.mjs` rewrites stored slugs and `courses.category` (dry run by default). Until it runs, the web already reads old values as their new school, so deploy order can't strand a program.
- **Page.** The school page is reordered into §8's order with three small new sections (`SchoolPoints` × 3, `SchoolAreas`), and one commented slot where Phase 12 mounts "Upcoming cohorts".

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict · MongoDB/Mongoose (raw driver in scripts) · Tailwind v4 with the WorldStreet design system (`ds/`, `ws-*` tokens).

**Spec:** `docs/institutional-blueprint.md` §7, §8. **Roadmap:** `docs/institutional-blueprint-plan.md` Phase 13; decisions D21, D22 (answered yes, 2026-10-19) and D31.

**Branch:** `mastery/phase-13`, in the worktree `C:/Users/owen/Downloads/Projects/worldstreet/wsa-track-g` (cut from `feat/institutional` @ `4138066`). It runs **in parallel** with Phases 11, 12, 14, 15, 18, 20 and 21. The worktree has no `CLAUDE.md`, no `.env.local` and no `scripts/dev/`. That is intended.

## Controller rulings (binding)

1. **The seven schools (D21).** Order, slugs, names and short labels, in §7's order:

   | # | Slug | Name | `short` (also `courses.category`) | Was |
   |---|---|---|---|---|
   | 1 | `trading-financial-markets` | School of Trading & Financial Markets | Trading & Financial Markets | unchanged |
   | 2 | `technology-ai` | School of Technology & Artificial Intelligence | Technology & AI | `ai-automation`, `software-app-development`, `cybersecurity`, `data-analytics` |
   | 3 | `digital-business` | School of Digital Business | Digital Business | `digital-business-remote-careers` |
   | 4 | `entrepreneurship-wealth-creation` | School of Entrepreneurship & Wealth Creation | Entrepreneurship & Wealth Creation | new |
   | 5 | `creative-economy` | School of Creative Economy | Creative Economy | `digital-media-creative` |
   | 6 | `leadership-personal-development` | School of Leadership & Personal Development | Leadership & Personal Development | new |
   | 7 | `emerging-technologies` | School of Emerging Technologies | Emerging Technologies | `blockchain-web3` |

   "Technology & AI" is the short label because the old short labels already abbreviate ("AI & Automation"), and it shows in chips and sticky bars.
2. **§8's "School Overview" is the existing `School.intro` field**, the paragraph `SchoolHero` already renders. No `overview` field is added (the roadmap names one): two fields for one paragraph would drift. `tagline` stays `null` for the six schools other than Trading, so no headline is invented.
3. **Study areas (D22) live on each school as `areas: StudyArea[]`, where `StudyArea = { name; program }`.** `name` is §7's text, verbatim and in §7's order. `program` is the **catalogue title** of the program that teaches it (`scripts/mastery-catalogue.mjs`), or `null` for "Coming soon". It's matched against the school's *published* programs by trimmed, case-insensitive title, never by slug: production slugs carry random suffixes (`forex-trading-mastery-j7g0ta`), and the catalogue keeps them. A draft program's area reads "Coming soon". No Course rows are created.
4. **Legacy URLs answer 308 from the school page itself, not from `next.config.ts`.**
   - `next.config.ts` has no `redirects()` today.
   - The Docker runner copies only `next.config.ts` and runs it at runtime ("COPY --from=builder /app/next.config.ts ./"). If the config imported `lib/schools.ts`, `next start` would fail in production, and a duplicated map in the config would drift.
   - `app/(marketing)/schools/[slug]/page.tsx` calls `permanentRedirect` instead. That is the repo's existing 308 pattern (`app/(marketing)/courses/page.tsx`, the lowercase rule in `programs/[slug]`). The marketing group has no `loading.tsx`, so it's a real HTTP 308.
   - If the status isn't 308, stop and report. Don't move the redirect into the config or the middleware.
5. **Every stored or remembered slug is read through `schoolFromSlug` / `schoolSlugOf`.** That covers read models, the `wsa_school` cookie, `?school=` parameters and the reviews query. Writes stay strict: `z.enum(SCHOOL_SLUGS)` and `isSchoolSlug` keep meaning "one of the seven", so a retired slug is never written again. This is what makes deploy → migration safe in either order, and it covers a Go client that still writes an old slug.
6. **Covers: existing renders are reused, one per school, no duplicates. Nothing is rendered in this phase.** New scenes are art direction (GLSL still-life design with preview iterations on the GPU), which doesn't fit a parallel implementer track. `scripts/art/school-covers/*` is frozen (the engine moved to the `render-3d-assets` skill), so `render.mjs` is **not** edited; its keys are scene and file ids. Old files stay in place:

   | School | Cover file (`public/art/schools/…`) | Status |
   |---|---|---|
   | trading-financial-markets | `trading-financial-markets.webp` | its own |
   | technology-ai | `ai-automation.webp` | fits (neural lattice) |
   | digital-business | `digital-business-remote-careers.webp` | its own (briefcase and globe) |
   | entrepreneurship-wealth-creation | `data-analytics.webp` | placeholder (marble growth chart) |
   | creative-economy | `digital-media-creative.webp` | its own |
   | leadership-personal-development | `cybersecurity.webp` | placeholder (open padlock) |
   | emerging-technologies | `blockchain-web3.webp` | its own |

   Real renders for Entrepreneurship & Wealth Creation and Leadership & Personal Development are content debt, recorded in Task 7.
7. **Content.** `areas` names are §7 verbatim. The `learn`, `audience` and `careers` lists of all seven schools, and the `blurb` and `intro` of the six new or renamed schools, are drafted below from §7 and the schools' programs. Each school entry carries the marker comment `// DRAFT: owner sign-off pending`. Trading's `blurb`, `tagline` and `intro` are the 2026-09-14 blueprint's text and stay byte-for-byte. A blurb is at most 110 characters (the longest today is 108), so the landing hero, which reserves room for every school's blurb, doesn't grow.
8. **The school page in §8's order.** Faculty is behind `FACULTY_PUBLIC` (D31, unchanged).
   1. Hero (Overview)
   2. `#learn` What you'll learn
   3. `#audience` Who it's for
   4. `#careers` Career & economic applications (§8's "Career/economic" slash is shorthand)
   5. `#programs` Available programs, followed by `#compare` and `#topics`, which belong to the programs block, then `#areas` Study areas
   6. `#faculty`
   7. **the commented slot for Phase 12's "Upcoming cohorts"**
   8. `#path`, retitled "Learning pathways"
   9. `#free-lessons`, `#reviews`, `#faq`, `#other-schools`, then the closing band

   The existing `SchoolTopics` stops being "What you'll learn here" (`#learn`). It becomes `#topics`, titled "Topics across the programs", because the school's own `learn` list now owns `#learn`. The program cards already lead to `/programs/<slug>`, where the plan is chosen; that is unchanged.
9. **Parallel tracks.** Keep merges small:
   - **Phase 12** adds `components/schools/school-cohorts.tsx` and mounts it in the school page. Leave exactly one comment slot (Task 5), and leave the `cohort={…}` strip expression passed to `SchoolPrograms` untouched; Phase 12 changes it.
   - **Phase 15** adds `communityUrl` to `School`. This phase adds `communityUrl: null` to all seven schools, so that merge is trivial.
   - **Phase 14** rewrites `PLAN` and the feature lists in `scripts/mastery-catalogue.mjs`. Touch only its `SCHOOLS` literal, the `school:` values in `PROGRAMS`, the header comment and one MATCH print line.
   - **Phase 11** has already rewritten `SITE_DESCRIPTION` in `lib/brand.ts` (the "eight schools" sentence is gone on `mastery/phase-11`). It also owns `components/marketing/landing.tsx`, `navbar.tsx`, `mobile-nav.tsx` and `footer.tsx`. Do not edit those five files.
   - The vocabulary pass runs last (2026-10-19). Don't rename existing "package" strings.
10. **"Eight" copy.** Every user-facing "eight schools" reads `SCHOOLS.length`. Code comments saying "eight" are corrected only in files this phase edits anyway; others are left alone, to avoid merge noise with the parallel tracks.
11. **Icons.** The new schools use `lightbulb` (Entrepreneurship), `palette` (Creative Economy) and `users` (Leadership). `SchoolIcon` gains those three names; the existing names stay mapped.
12. **Go note R12** is section `## 12.` of `docs/go-patches-phase-3.md`. If another track's merge has already taken 12, renumber at merge time; the `R12` label is fixed by the roadmap.

## Global Constraints

- **Data and Go:**
  - Additive only: the Go mobile API reads the same MongoDB. This phase adds no field, enum value or role. It rewrites the *values* of five existing string fields (`courses.school`, `courses.category`, `enrollmentintents.school`, `sellerapplications.school`, `instructorapplications.answers.school`), which Go note R12 announces.
  - Never rename a field, model, route or enum.
- **Database scripts:**
  - Dry run by default.
  - `--apply` refuses unless `MONGODB_URI` was set on the command line. Read `process.env.MONGODB_URI` *before* `dotenv` runs, as `scripts/backfill-certificate-ids.mjs` does: in the owner's checkout `.env.local` holds **production**.
  - Raw collection writes; no `updatedAt` bump.
  - A `.mjs` script can't import the app's TS, so duplicated literals carry a "duplicated literally from lib/schools.ts" comment.
  - Production runs belong to the owner, through `docs/launch-runbook.md`.
- **Server code:**
  - Server actions keep the existing order: `connectDB()` → auth/ownership → Zod (`import { z } from "zod/v4"`) → mutate → `revalidatePath()` → `{ success: true, data } | { success: false, error }`. They never throw across the boundary. This phase adds no action.
  - User ids come from `getCurrentUser()`, never from the browser. Admin actions use `requireAdmin()`. Role gates live in each route group's `layout.tsx`, not in the middleware.
  - Don't touch the money path (`lib/wallet.ts`, purchases, ESPEE) or the buckets.
  - No new dependencies, no `any`, no secrets.
- **UI:**
  - The WorldStreet design system. `ds/` is vendored; never edit it.
  - `ws-*` tokens only, never a hex. Gold only for primary CTAs, active nav and brand moments: area tiles, list bullets and cards are ink and muted, never gold.
  - Icons only from `@/components/icons` (duotone glyphs; never lucide, Hugeicons or emoji). Base UI composition uses `render`, never `asChild`.
  - Pills for buttons, `rounded-[20px]` cards, Manrope. `·` as separator, `tabular-nums` for counts.
  - Motion: opacity and transform only, honouring reduced motion. No hover scaling.
  - RSC-first: the new sections are server components.
- **Copy:**
  - Copy the spec verbatim where it gives wording; never invent figures, testimonials or policy.
  - New strings use the new vocabulary: plan (not package), program for Academy offerings, Marketplace Creator, Become a WMA Instructor. "Enrol" in new copy.
  - Don't rename existing strings outside this phase's scope.
- **Checks:**
  - **No test runner exists, and none is added.** Pure rules are checked with a throwaway `node:assert/strict` script in `$SCRATCH` (`SCRATCH=$(mktemp -d)`), run **from the worktree root** with `npx tsx --tsconfig ./tsconfig.json "$SCRATCH/<file>.ts"` so `@/` imports resolve.
  - Everything else is checked with `npx tsc --noEmit` (one stale `.next/types` error is not real), `npx eslint <file>` (one changed file at a time) and a driven route.
- **Surgical:** touch only the files a task lists. Stage files by name, never `git add -A`. Anchors below are **quoted text**, never line numbers.

## Review Focus

1. **Deploy before migration.** Production runs the new code against old slugs until the owner's `--apply` runs; a Go client may also still write one. Programs must still appear under their new school, not vanish, and nothing may crash on `SCHOOL_BY_SLUG[<old slug>]`. Covered in Task 2, step 6, which checks against the legacy-slug mock DB *before* migrating.
2. **Old links and 30-day cookies.** `/schools/<each of the 7 retired slugs>` must 308 to the right school. The cookie `wsa_school=<old>`, `/dashboard/start?school=<old>`, `/dashboard/courses?school=<old>` and `/marketplace?school=<old>` must all land on the new school. An unknown slug still 404s. Covered in Task 2, steps 5 and 7.
3. **Schools with no programs** (Entrepreneurship, Leadership). The page must show hero, learn, audience and careers, the "first programs are on their way" panel, six "Coming soon" areas and no compare section. There must be no sticky bar and no dead links, and no card anywhere may print "0 programs". Covered in Task 5, step 7, and Task 6, step 5.
4. **Seven in layouts drawn for eight.** That means the `/schools` cover wall (4 columns), the navbar's schools menu (2 × 4), the hero chips, the landing vignettes and showcase, and the "Other schools" grid. There's also a section nav of up to 13 links at 390 px. None of them may overflow, look broken or lose the active link. Covered in Task 5, step 8, and Task 6, step 6.
5. **Migration re-runs and odd data.**
   - A second `--apply` moves 0.
   - A value that was never a school is reported and left alone.
   - `--apply` without an explicit `MONGODB_URI` refuses.
   - A row changed mid-run is skipped, not overwritten.

   Covered in Task 3, steps 4–6.

## Verification server

The controller fills `<PORT>` and `<DBPORT>` for this track.

```bash
netstat -ano | grep -E ":<PORT>|:<DBPORT>"      # must print nothing first
RESEND_API_KEY=re_disabled_local CLOUDFLARE_REALTIME_API_KEY=disabled-local OPENAI_API_KEY=disabled-local \
ABLY_API_KEY=disabled-local R2_SECRET_ACCESS_KEY=disabled-local WALLET_SERVICE_TOKEN=disabled-local \
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_bG9jYWwuZGV2JA MOCK_DB_PORT=<DBPORT> PORT=<PORT> node scripts/dev-mock.mjs
MONGODB_URI=mongodb://127.0.0.1:<DBPORT>/worldstreet-academy node scripts/mastery-catalogue.mjs --apply
```

- **The catalogue line runs exactly once, at the first start, before Task 4 edits the script.** At that point it still files the 12 programs under the **retired** slugs, which is the legacy data Tasks 2 and 3 need. Once Task 3 has migrated the DB, never run the catalogue again until Task 4 is committed: the old script would move the programs back.
- `.local-db` persists across restarts.
- Personas switch with the `mock_persona` cookie: `guest`, `student`, `instructor`, `admin` (`mocks/clerk/personas.ts`). No new persona is needed.
- Stop the server when the phase is done. A killed `dev:mock` leaves `next` and `mongod` alive, so check the ports again.

Helpers, used by every task:

```bash
BASE=http://localhost:<PORT>
URI=mongodb://127.0.0.1:<DBPORT>/worldstreet-academy
SCRATCH=$(mktemp -d)
# Rendered text only (scripts, styles and tags stripped) — the RSC payload never counts as copy.
text() { curl -s ${2:+-b "mock_persona=$2"} "$BASE$1" | perl -0pe 's#<script\b.*?</script>##gs; s#<style\b.*?</style>##gs; s#<[^>]+># #g; s#&\#x27;#\x27#g; s#&quot;#"#g; s#&amp;#&#g; s#\s+# #g'; }
# Status and Location of one request.
hop() { curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" ${2:+-b "$2"} "$BASE$1"; }
# The page's <section id> order (every school section puts `id` first; new sections must too).
sections() { curl -s "$BASE$1" | grep -oE '<section id="[a-z-]+"' | sed -E 's/<section id="([a-z-]+)"/\1/' | tr '\n' ' '; echo; }
# One section's HTML: section /schools/creative-economy areas
section() { curl -s "$BASE$1" | ID="$2" perl -0ne 'print $1 if /(<section id="$ENV{ID}".*?<\/section>)/s'; }
```

## File structure

| File | Responsibility |
|---|---|
| `lib/schools.ts` (modify) | The seven schools, §8 copy, `areas`, `legacySlugs`, `schoolFromSlug`, `schoolSlugOf`, `storedSlugsFor`, `studyAreas` |
| `lib/school-art.ts` (modify) | Seven cover entries; `schoolCover` resolves retired slugs |
| `components/shared/school-icon.tsx` (modify) | + `lightbulb`, `palette`, `users` |
| `lib/start-gate.ts`, `app/(platform)/dashboard/courses/page.tsx`, `app/(marketing)/marketplace/page.tsx` (modify) | Remembered and linked slugs resolve |
| `lib/actions/{student,certificates,teaching-home,seller-applications,applications,enrollment-intent,instructor,admin-leads,reviews,school-page}.ts`, `app/api/cron/reminders/route.ts` (modify) | Stored slugs read as their new school |
| `scripts/migrate-schools-v2.mjs` (new) | Owner-run data move, dry run by default |
| `scripts/mastery-catalogue.mjs` (modify) | Programs filed under the seven schools |
| `components/schools/school-points.tsx` (new) | §8 learn / audience / careers sections |
| `components/schools/school-areas.tsx` (new) | §7 study areas (D22) |
| `app/(marketing)/schools/[slug]/page.tsx` (modify) | 308s; §8 order; Phase 12 slot |
| `components/schools/school-topics.tsx`, `school-path.tsx` (modify) | `#topics`; "Learning pathways" |
| Copy files (modify, Task 6) | Counts read `SCHOOLS.length`; marquee; search terms |
| `docs/go-patches-phase-3.md`, `docs/launch-runbook.md`, `docs/institutional-blueprint-plan.md`, `docs/mastery-academy-plan.md`, `context.md` (modify) | R12, owner steps, status |

---

### Task 1: The seven schools, as data

**Files:**
- Modify: `lib/schools.ts`, `lib/school-art.ts`, `components/shared/school-icon.tsx`

**Interfaces:**
- Produces (`lib/schools.ts`):
  - `type SchoolSlug = "trading-financial-markets" | "technology-ai" | "digital-business" | "entrepreneurship-wealth-creation" | "creative-economy" | "leadership-personal-development" | "emerging-technologies"`
  - `type StudyArea = { name: string; program: string | null }`. `program` is a catalogue title.
  - `School` keeps every field it has today (`slug`, `name`, `short`, `blurb`, `tagline`, `intro`, `icon`, `order`) and adds:
    - `learn: readonly string[]`
    - `audience: readonly string[]`
    - `careers: readonly string[]`
    - `areas: readonly StudyArea[]`
    - `communityUrl: string | null`
    - `legacySlugs: readonly string[]`
  - `SCHOOLS`, `SCHOOL_BY_SLUG`, `SCHOOL_SLUGS`, `isSchoolSlug`, `countProgramsBySchool`, `cheapestBySchool`: same names and signatures. `isSchoolSlug` still means "one of the seven".
  - `schoolFromSlug(value: unknown): School | null`: a current slug, or a retired one (via `legacySlugs`), returns its school; anything else returns null. Exact, case-sensitive match. Build a module-level `Map` once.
  - `schoolSlugOf(value: unknown): SchoolSlug | null` = `schoolFromSlug(value)?.slug ?? null`.
  - `storedSlugsFor(slug: SchoolSlug): string[]` = `[slug, ...SCHOOL_BY_SLUG[slug].legacySlugs]`.
  - `type StudyAreaLink = { name: string; program: { title: string; href: string } | null }`
  - `studyAreas(school: School, programs: ReadonlyArray<{ title: string; slug: string }>): StudyAreaLink[]`: one entry per `school.areas`, in order. `program` is the first item whose `title.trim().toLowerCase()` equals the area's `program` lower-cased, with `href: "/programs/<slug>"` and that item's own `title`; otherwise null.
- Produces (`lib/school-art.ts`): `SCHOOL_COVERS` with seven entries (ruling 6). `schoolCover(slug)` returns `SCHOOL_COVERS[schoolSlugOf(slug)]`, so a retired slug shows its new school's cover.

- [ ] **Step 1: Record the baselines.**
  Run: `pnpm lint 2>&1 | tail -3` and `npx tsc --noEmit 2>&1 | tail -3`
  Expected: note the problem count and any errors; Task 7 compares against them.

- [ ] **Step 2: Write the failing check** at `"$SCRATCH/t1-schools.ts"`:

```ts
import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import {
  SCHOOLS, SCHOOL_BY_SLUG, SCHOOL_SLUGS, isSchoolSlug, schoolFromSlug, schoolSlugOf, storedSlugsFor, studyAreas,
} from "@/lib/schools"
import { SCHOOL_COVERS, schoolCover } from "@/lib/school-art"

const SEVEN = [
  "trading-financial-markets", "technology-ai", "digital-business", "entrepreneurship-wealth-creation",
  "creative-economy", "leadership-personal-development", "emerging-technologies",
]
assert.deepEqual(SCHOOLS.map((s) => s.slug), SEVEN)
assert.deepEqual([...SCHOOL_SLUGS], SEVEN)
assert.deepEqual(SCHOOLS.map((s) => s.order), [1, 2, 3, 4, 5, 6, 7])
assert.deepEqual(SCHOOLS.map((s) => s.short), [
  "Trading & Financial Markets", "Technology & AI", "Digital Business", "Entrepreneurship & Wealth Creation",
  "Creative Economy", "Leadership & Personal Development", "Emerging Technologies",
])

// D21
const D21: Record<string, string> = {
  "ai-automation": "technology-ai", "software-app-development": "technology-ai", cybersecurity: "technology-ai",
  "data-analytics": "technology-ai", "digital-business-remote-careers": "digital-business",
  "digital-media-creative": "creative-economy", "blockchain-web3": "emerging-technologies",
}
for (const [old, next] of Object.entries(D21)) {
  assert.equal(isSchoolSlug(old), false, `${old} is retired`)
  assert.equal(schoolFromSlug(old)?.slug, next, old)
  assert.equal(schoolSlugOf(old), next, old)
}
assert.equal(SCHOOLS.flatMap((s) => s.legacySlugs).length, 7)
for (const v of ["", "nope", "Technology-AI", null, undefined, 42]) assert.equal(schoolFromSlug(v), null, String(v))
assert.deepEqual(storedSlugsFor("technology-ai"), ["technology-ai", "ai-automation", "software-app-development", "cybersecurity", "data-analytics"])
assert.deepEqual(storedSlugsFor("leadership-personal-development"), ["leadership-personal-development"])

for (const s of SCHOOLS) {
  assert.equal(schoolFromSlug(s.slug), s)
  assert.equal(s.communityUrl, null, `${s.slug} communityUrl (Phase 15 fills it)`)
  assert.ok(s.intro && s.intro.length > 40, `${s.slug} has an overview`)
  assert.ok(s.blurb.length <= 110, `${s.slug} blurb is ${s.blurb.length} chars`)
  for (const k of ["learn", "audience", "careers"] as const) assert.ok(s[k].length >= 3, `${s.slug}.${k}`)
}
assert.equal(SCHOOL_BY_SLUG["trading-financial-markets"].tagline, "Understand the markets. Develop your skills. Trade with knowledge.")

// §7 areas, verbatim
assert.deepEqual(SCHOOLS.map((s) => s.areas.length), [6, 7, 6, 6, 6, 6, 7])
assert.deepEqual(SCHOOL_BY_SLUG["technology-ai"].areas.map((a) => a.name), [
  "Artificial Intelligence", "Software Development", "Web Development", "Data Analytics", "Cybersecurity", "Cloud Computing", "AI Automation",
])
assert.deepEqual(SCHOOL_BY_SLUG["emerging-technologies"].areas.map((a) => a.name), [
  "Blockchain", "Web3", "Robotics", "IoT", "FinTech", "Extended Reality", "Emerging technology",
])
const CATALOGUE = [
  "Forex Trading Mastery", "Crypto Trading Mastery", "Blockchain Technology Mastery", "AI & AI Automation",
  "App Development with AI", "Cybersecurity", "Data Analysis", "Content Creation Mastery", "Video Editing Mastery",
  "Tech Sales & Digital Marketing", "E-Commerce & Digital Business", "Virtual Assistance",
]
const linked = SCHOOLS.flatMap((s) => s.areas).filter((a) => a.program !== null)
assert.equal(linked.length, 13)
for (const a of linked) assert.ok(CATALOGUE.includes(a.program as string), `${a.name} → ${a.program}`)

// D22 linking: by title, case-insensitive, suffixed production slugs
assert.deepEqual(
  studyAreas(SCHOOL_BY_SLUG["technology-ai"], [
    { title: " ai & ai automation ", slug: "ai-ai-automation-j7g0ta" },
    { title: "Data Analysis", slug: "data-analysis" },
    { title: "Forex Trading Mastery", slug: "forex-trading-mastery" },
  ]),
  [
    { name: "Artificial Intelligence", program: { title: " ai & ai automation ", href: "/programs/ai-ai-automation-j7g0ta" } },
    { name: "Software Development", program: null },
    { name: "Web Development", program: null },
    { name: "Data Analytics", program: { title: "Data Analysis", href: "/programs/data-analysis" } },
    { name: "Cybersecurity", program: null },
    { name: "Cloud Computing", program: null },
    { name: "AI Automation", program: { title: " ai & ai automation ", href: "/programs/ai-ai-automation-j7g0ta" } },
  ]
)
assert.ok(studyAreas(SCHOOL_BY_SLUG["leadership-personal-development"], []).every((a) => a.program === null))

// Covers (ruling 6)
assert.deepEqual(Object.keys(SCHOOL_COVERS).sort(), [...SEVEN].sort())
for (const [slug, file] of Object.entries(SCHOOL_COVERS)) assert.ok(existsSync(`public${file}`), `${slug}: ${file}`)
assert.equal(new Set(Object.values(SCHOOL_COVERS)).size, 7, "no two schools share a cover")
assert.equal(schoolCover("cybersecurity"), "/art/schools/ai-automation.webp", "a retired slug shows its new school's cover")
assert.equal(schoolCover("nope"), null)
console.log("schools-v2: all assertions passed")
```

- [ ] **Step 3: Run it to see it fail.**
  Run (worktree root): `npx tsx --tsconfig ./tsconfig.json "$SCRATCH/t1-schools.ts"`
  Expected: FAIL. Either `schoolFromSlug` isn't exported, or the first `deepEqual` fails on eight slugs.

- [ ] **Step 4: `lib/schools.ts`.**
  - Rewrite the header comment: the seven Schools (institutional blueprint §7, D21), the §8 fields, `areas` (D22, matched by catalogue title, ruling 3), `legacySlugs` (retired slugs: 308s, cookies, stored values), and the Phase 15 `communityUrl`.
  - Add the types and functions from the Interfaces, each with a one-line doc comment. Update the `intro` doc to "§8 School Overview: the hero paragraph."
  - Above `SCHOOLS`, add a comment that names the drafted fields and the verbatim ones (ruling 7) and points the owner at each entry's marker.
  - `SCHOOLS` is exactly the following. The marker comment opens each entry; field order is free.

```ts
  {
    // DRAFT: owner sign-off pending (learn, audience, careers; blurb, tagline and intro are the 2026-09-14 blueprint's)
    slug: "trading-financial-markets", order: 1, icon: "landmark",
    name: "School of Trading & Financial Markets",
    short: "Trading & Financial Markets",
    blurb: "Learn about Forex, cryptocurrency, market analysis, risk management and trading psychology.",
    tagline: "Understand the markets. Develop your skills. Trade with knowledge.",
    intro: "Financial markets offer enormous opportunities—but opportunity without knowledge can become expensive experience. Our programs are designed to help students understand market fundamentals, develop structured approaches to analysis and learn responsible risk management.",
    learn: [
      "How the Forex and crypto markets work, and what moves them",
      "Technical and fundamental analysis",
      "Risk management and position sizing",
      "Trading psychology and discipline",
      "Building and following a written trading plan",
    ],
    audience: [
      "Beginners who want a structured start in the markets",
      "Self-taught traders who want a method and discipline",
      "Professionals who want to understand the markets they invest in",
    ],
    careers: [
      "Trading your own account with a tested plan and clear risk rules",
      "Market research and analysis roles",
      "Financial content, education and community work",
      "A grounding for further study in finance and investing",
    ],
    areas: [
      { name: "Forex Trading Mastery", program: "Forex Trading Mastery" },
      { name: "Crypto Trading Mastery", program: "Crypto Trading Mastery" },
      { name: "Technical Analysis", program: null },
      { name: "Fundamental Analysis", program: null },
      { name: "Risk Management", program: null },
      { name: "Financial Markets Intelligence", program: null },
    ],
    communityUrl: null,
    legacySlugs: [],
  },
  {
    // DRAFT: owner sign-off pending
    slug: "technology-ai", order: 2, icon: "bot",
    name: "School of Technology & Artificial Intelligence",
    short: "Technology & AI",
    blurb: "Build practical skills in artificial intelligence, software, data and cybersecurity.",
    tagline: null,
    intro: "Technology and artificial intelligence are changing how businesses operate, how people work and how value is created. This school brings AI, software, data and security together, so you learn the tools and the thinking behind them, and how to apply them to real problems.",
    learn: [
      "Practical AI tools, prompt engineering and automation workflows",
      "How modern software and apps are designed and built",
      "Collecting, analysing and presenting data",
      "Digital security and responsible cybersecurity practice",
      "Applying technology to real business problems",
    ],
    audience: [
      "Beginners curious about AI and technology",
      "Professionals who want to work faster with AI and automation",
      "Aspiring developers, analysts and security practitioners",
      "Founders who want to build with technology",
    ],
    careers: [
      "Building AI-powered workflows and automation for businesses",
      "Software, web and app development",
      "Data analysis and reporting",
      "Cybersecurity support and awareness",
      "Technology freelancing and consulting",
    ],
    areas: [
      { name: "Artificial Intelligence", program: "AI & AI Automation" },
      { name: "Software Development", program: "App Development with AI" },
      { name: "Web Development", program: null },
      { name: "Data Analytics", program: "Data Analysis" },
      { name: "Cybersecurity", program: "Cybersecurity" },
      { name: "Cloud Computing", program: null },
      { name: "AI Automation", program: "AI & AI Automation" },
    ],
    communityUrl: null,
    legacySlugs: ["ai-automation", "software-app-development", "cybersecurity", "data-analytics"],
  },
  {
    // DRAFT: owner sign-off pending
    slug: "digital-business", order: 3, icon: "briefcase",
    name: "School of Digital Business",
    short: "Digital Business",
    blurb: "Build practical skills for selling, marketing, e-commerce and working in the global digital economy.",
    tagline: null,
    intro: "Every business now sells, markets and serves its customers online. This school teaches the skills that make that work, from marketing and selling to e-commerce and the remote work behind them, so you can grow a business or bring those skills to one.",
    learn: [
      "Digital and social media marketing",
      "Selling, from the first conversation to the closed deal",
      "Setting up and running an online store",
      "Writing copy that persuades",
      "Supporting a business remotely as a virtual assistant",
    ],
    audience: [
      "Business owners who want to grow online",
      "Job seekers building skills for remote work",
      "Marketers and salespeople who want a structured upgrade",
      "Creators and freelancers who want to sell their own work",
    ],
    careers: [
      "Digital marketing and social media management",
      "Sales and business development roles",
      "Running your own e-commerce store",
      "Copywriting and content for brands",
      "Remote virtual assistance for businesses worldwide",
    ],
    areas: [
      { name: "Digital Marketing", program: "Tech Sales & Digital Marketing" },
      { name: "E-commerce", program: "E-Commerce & Digital Business" },
      { name: "Copywriting", program: null },
      { name: "Sales", program: "Tech Sales & Digital Marketing" },
      { name: "Business Development", program: null },
      { name: "Social Media Marketing", program: null },
    ],
    communityUrl: null,
    legacySlugs: ["digital-business-remote-careers"],
  },
  {
    // DRAFT: owner sign-off pending
    slug: "entrepreneurship-wealth-creation", order: 4, icon: "lightbulb",
    name: "School of Entrepreneurship & Wealth Creation",
    short: "Entrepreneurship & Wealth Creation",
    blurb: "Learn to start, run and grow a business, and the principles of investing and building wealth.",
    tagline: null,
    intro: "Knowledge creates value when it is put to work. This school is about turning ideas, skills and opportunities into businesses and assets: validating an idea, building a startup, managing a company and understanding how wealth is created and grown.",
    learn: [
      "Finding and testing a business idea",
      "Building and launching a startup",
      "Business strategy and management",
      "Investment fundamentals",
      "The principles of creating and growing wealth",
    ],
    audience: [
      "Aspiring founders with an idea to test",
      "Small-business owners who want to grow",
      "Professionals planning a business of their own",
      "Anyone who wants to understand investing and wealth",
    ],
    careers: [
      "Starting and running your own business",
      "Growing an existing business",
      "Business strategy and management roles",
      "Making informed personal investment decisions",
    ],
    areas: [
      { name: "Entrepreneurship", program: null },
      { name: "Startup Building", program: null },
      { name: "Business Strategy", program: null },
      { name: "Investment Fundamentals", program: null },
      { name: "Wealth Creation", program: null },
      { name: "Business Management", program: null },
    ],
    communityUrl: null,
    legacySlugs: [],
  },
  {
    // DRAFT: owner sign-off pending
    slug: "creative-economy", order: 5, icon: "palette",
    name: "School of Creative Economy",
    short: "Creative Economy",
    blurb: "Turn ideas into compelling design, video and content, and build skills for the creator economy.",
    tagline: null,
    intro: "Creativity is now an economy of its own. This school teaches the craft behind design, video and content, and how to turn that craft into a portfolio, clients and an audience.",
    learn: [
      "Graphic design and UI/UX fundamentals",
      "Video production and editing",
      "Content creation for social platforms",
      "Photography and animation basics",
      "Building a portfolio that wins clients",
    ],
    audience: [
      "Aspiring designers, editors and content creators",
      "Creators who want to grow an audience",
      "Marketers who want to make their own content",
      "Freelancers who want a stronger portfolio",
    ],
    careers: [
      "Freelance design, video and content work",
      "In-house creative roles in brands and agencies",
      "Building an audience as a creator",
      "Content production for businesses",
    ],
    areas: [
      { name: "Graphic Design", program: null },
      { name: "UI/UX", program: null },
      { name: "Video Production", program: "Video Editing Mastery" },
      { name: "Animation", program: null },
      { name: "Photography", program: null },
      { name: "Content Creation", program: "Content Creation Mastery" },
    ],
    communityUrl: null,
    legacySlugs: ["digital-media-creative"],
  },
  {
    // DRAFT: owner sign-off pending
    slug: "leadership-personal-development", order: 6, icon: "users",
    name: "School of Leadership & Personal Development",
    short: "Leadership & Personal Development",
    blurb: "Develop the leadership, communication and personal effectiveness that turn knowledge into results.",
    tagline: null,
    intro: "Skills create value when the people who hold them can lead, communicate and decide well. This school develops the personal capabilities behind every career and business: leadership, communication, productivity and clear thinking.",
    learn: [
      "Leading people and teams",
      "Communicating clearly and speaking with confidence",
      "Managing your time, focus and priorities",
      "Emotional intelligence at work",
      "Strategic thinking and decision-making",
    ],
    audience: [
      "New and aspiring managers",
      "Professionals preparing for their next role",
      "Founders leading their first team",
      "Anyone who wants to communicate and decide with more confidence",
    ],
    careers: [
      "Team leadership and management",
      "Presenting, pitching and public speaking",
      "Coaching and mentoring others",
      "Greater effectiveness in any role or business",
    ],
    areas: [
      { name: "Leadership", program: null },
      { name: "Communication", program: null },
      { name: "Personal Productivity", program: null },
      { name: "Public Speaking", program: null },
      { name: "Emotional Intelligence", program: null },
      { name: "Strategic Thinking", program: null },
    ],
    communityUrl: null,
    legacySlugs: [],
  },
  {
    // DRAFT: owner sign-off pending
    slug: "emerging-technologies", order: 7, icon: "blocks",
    name: "School of Emerging Technologies",
    short: "Emerging Technologies",
    blurb: "Understand blockchain, Web3, FinTech and the technologies shaping what comes next.",
    tagline: null,
    intro: "New technologies create new economies. This school explains how blockchain, Web3, FinTech, robotics, IoT and extended reality work, where they are being used, and the opportunities they open.",
    learn: [
      "How blockchain and digital assets work",
      "The Web3 ecosystem and decentralised applications",
      "FinTech and the future of financial services",
      "Robotics, IoT and extended reality fundamentals",
      "Judging which emerging technologies matter, and why",
    ],
    audience: [
      "Learners curious about blockchain and Web3",
      "Professionals in finance and technology",
      "Founders exploring new technology for their business",
      "Anyone who wants to understand what comes next",
    ],
    careers: [
      "Blockchain and Web3 projects and communities",
      "FinTech products and services",
      "Advising businesses on new technology",
      "A foundation for specialised technical study",
    ],
    areas: [
      { name: "Blockchain", program: "Blockchain Technology Mastery" },
      { name: "Web3", program: null },
      { name: "Robotics", program: null },
      { name: "IoT", program: null },
      { name: "FinTech", program: null },
      { name: "Extended Reality", program: null },
      { name: "Emerging technology", program: null },
    ],
    communityUrl: null,
    legacySlugs: ["blockchain-web3"],
  },
```

- [ ] **Step 5: `lib/school-art.ts`.**
  - `SCHOOL_COVERS` takes the seven entries from ruling 6.
  - `schoolCover` resolves through `schoolSlugOf`.
  - The header comment says "seven schools" and notes that two covers are placeholders until real renders land (content debt). Leave `PROGRAM_ART` and `programArt` untouched.

- [ ] **Step 6: `components/shared/school-icon.tsx`.** Import `LightbulbIcon`, `PaletteIcon` and `UsersIcon` from `@/components/icons`, and add `lightbulb`, `palette` and `users` to `SCHOOL_ICONS`.

- [ ] **Step 7: Run the check.**
  Run: `npx tsx --tsconfig ./tsconfig.json "$SCRATCH/t1-schools.ts"`
  Expected: `schools-v2: all assertions passed`.
  Run: `grep -c "DRAFT: owner sign-off pending" lib/schools.ts`
  Expected: `7`.

- [ ] **Step 8: Typecheck and lint.**
  Run: `npx tsc --noEmit`, then `npx eslint lib/schools.ts`, `npx eslint lib/school-art.ts` and `npx eslint components/shared/school-icon.tsx`.
  Expected: clean, apart from the one stale `.next/types` error. No other `.ts` file names a retired slug: `grep -rnE '"(blockchain-web3|ai-automation|software-app-development|data-analytics|digital-media-creative|digital-business-remote-careers)"' app components lib --include=*.ts --include=*.tsx` prints only `lib/schools.ts` lines.

- [ ] **Step 9: Commit.**

```bash
git add lib/schools.ts lib/school-art.ts components/shared/school-icon.tsx
git commit -m "feat(schools): the institutional blueprint's seven schools — §8 copy, §7 study areas, retired slugs"
```

---

### Task 2: Old slugs land on the new school

**Files:**
- Modify (links and cookies): `lib/start-gate.ts`, `app/(platform)/dashboard/courses/page.tsx`, `app/(marketing)/marketplace/page.tsx`, `app/(marketing)/schools/[slug]/page.tsx`
- Modify (stored values): `lib/actions/student.ts`, `lib/actions/certificates.ts`, `lib/actions/teaching-home.ts`, `lib/actions/seller-applications.ts`, `lib/actions/applications.ts`, `lib/actions/enrollment-intent.ts`, `lib/actions/instructor.ts`, `lib/actions/admin-leads.ts`, `lib/actions/reviews.ts`, `lib/actions/school-page.ts`, `app/api/cron/reminders/route.ts`

**Interfaces:**
- Consumes: `schoolFromSlug`, `schoolSlugOf`, `storedSlugsFor` (Task 1).
- Produces: `schoolsPathFor(school: string | null | undefined): string` keeps its signature and now resolves retired slugs. Every read model returns `school` as one of the seven, or null.

- [ ] **Step 1: Start the verification server** (above), with the one catalogue run. Sync the two personas by opening `curl -s -o /dev/null -b "mock_persona=student" $BASE/dashboard/wallet` and the same with `instructor`.

- [ ] **Step 2: Insert the fixtures.** These are legacy rows the catalogue doesn't make, reused by Task 3. Create `"$SCRATCH/phase13-fixtures.mjs"`:

```js
// node "$SCRATCH/phase13-fixtures.mjs" [--clean]   — run from the worktree root, MONGODB_URI=$URI in front
import { createRequire } from "node:module"
const require = createRequire(`${process.cwd()}/package.json`)
const mongoose = require("mongoose")
await mongoose.connect(process.env.MONGODB_URI)
const db = mongoose.connection.db
const COLLECTIONS = ["courses", "enrollmentintents", "sellerapplications", "instructorapplications"]
if (process.argv.includes("--clean")) {
  for (const c of COLLECTIONS) console.log(c, (await db.collection(c).deleteMany({ phase13Fixture: true })).deletedCount)
} else {
  const student = await db.collection("users").findOne({ email: "student@worldstreet.academy" })
  const instructor = await db.collection("users").findOne({ email: "instructor@worldstreet.academy" })
  if (!student || !instructor) throw new Error("Open the site once as student and as instructor first")
  const now = new Date()
  const oid = () => new mongoose.Types.ObjectId()
  await db.collection("sellerapplications").insertOne({
    phase13Fixture: true, user: student._id, status: "submitted", fullName: "Johnson Demo", school: "digital-media-creative",
    topic: "Short-form video for small brands", experience: "Phase 13 fixture.", sampleUrl: "https://example.com/sample",
    pitch: "Phase 13 fixture.", agreedAt: now, reviewedBy: null, reviewedAt: null, reason: null, createdAt: now, updatedAt: now,
  })
  await db.collection("enrollmentintents").insertOne({
    phase13Fixture: true, user: oid(), school: "cybersecurity", course: null, packageKey: null, source: "landing",
    status: "open", savedAt: now, nudges: { h24SentAt: null, h72SentAt: null }, createdAt: now, updatedAt: now,
  })
  await db.collection("instructorapplications").insertOne({
    phase13Fixture: true, user: oid(), status: "submitted", answers: { school: "blockchain-web3" }, createdAt: now, updatedAt: now,
  })
  const base = { phase13Fixture: true, status: "draft", instructor: instructor._id, packages: [], price: 0, pricing: "free", createdAt: now, updatedAt: now }
  await db.collection("courses").insertMany([
    { ...base, title: "Phase 13 fixture — marketplace", slug: "phase13-fixture-marketplace", kind: "marketplace", school: "data-analytics", category: "Data & Analytics" },
    { ...base, title: "Phase 13 fixture — unknown school", slug: "phase13-fixture-unknown", school: "astrology", category: "Astrology" },
  ])
  console.log("fixtures inserted")
}
await mongoose.disconnect()
```

  Run: `MONGODB_URI=$URI node "$SCRATCH/phase13-fixtures.mjs"`
  Expected: `fixtures inserted`.
  **Don't open `/instructor/*` or `/admin/*` pages until Task 3 cleans the fixtures up:** they are minimal rows.

- [ ] **Step 3: Check first** (Task 1 is in, so nothing resolves yet).
  Run: `hop /schools/cybersecurity`
  Expected: `404`.
  Run: `text /schools/technology-ai | grep -c "The first programs are on their way"`
  Expected: `1` (the programs still carry retired slugs).
  Run: `text /dashboard/sell/apply student | grep -c "small brands · Creative Economy"`
  Expected: `0`.

- [ ] **Step 4: Implement.**
  - `lib/start-gate.ts`:
    - `schoolsPathFor` returns `` `/schools/${slug}` `` for `schoolSlugOf(school)`, otherwise `"/schools?start=1"`.
    - Its comment notes that the `wsa_school` cookie outlives a rename by 30 days.
    - This one change covers the platform gate and `/dashboard/start`.
  - `app/(platform)/dashboard/courses/page.tsx`: replace `typeof school === "string" && isSchoolSlug(school) ? \`/schools/${school}\` : "/programs"` with the `schoolSlugOf(school)` equivalent.
  - `app/(marketing)/marketplace/page.tsx`: `school: isSchoolSlug(school) ? school : "",` becomes `school: schoolSlugOf(school) ?? "",`.
  - `app/(marketing)/schools/[slug]/page.tsx`: in `SchoolPage`, replace `if (!isSchoolSlug(slug)) notFound()` with:
    - `const moved = isSchoolSlug(slug) ? null : schoolFromSlug(slug)`
    - `if (moved) permanentRedirect(\`/schools/${moved.slug}\`)`
    - `if (!isSchoolSlug(slug)) notFound()`

    `permanentRedirect` comes from `next/navigation`. `generateMetadata` is unchanged.
  - Stored values. The anchor on the left becomes the code on the right:

    | File | Anchor (quoted) | Becomes |
    |---|---|---|
    | `lib/actions/student.ts` (4×) | `school: isSchoolSlug(course.school) ? course.school : null,` | `school: schoolSlugOf(course.school),` |
    | `lib/actions/certificates.ts` (2×) | `schoolName: isSchoolSlug(course.school) ? SCHOOL_BY_SLUG[course.school].name : null,` | `schoolName: schoolFromSlug(course.school)?.name ?? null,` |
    | `lib/actions/teaching-home.ts` | `schoolName: isSchoolSlug(c.school) ? SCHOOL_BY_SLUG[c.school].short : null,` | `schoolName: schoolFromSlug(c.school)?.short ?? null,` |
    | `lib/actions/seller-applications.ts` | `school: isSchoolSlug(app.school) ? app.school : null,` | `school: schoolSlugOf(app.school),` |
    | `lib/actions/applications.ts` | `school: isSchoolSlug(answers.school) ? answers.school : undefined,` | `school: schoolSlugOf(answers.school) ?? undefined,` |
    | `lib/actions/enrollment-intent.ts` | `if (!intent \|\| !isSchoolSlug(intent.school)) return null` + `const school = intent.school` | `const school = schoolSlugOf(intent?.school)` then `if (!intent \|\| !school) return null` |
    | `lib/actions/instructor.ts` | `school: (course.school ?? null) as SchoolSlug \| null,` | `school: schoolSlugOf(course.school),` |
    | `lib/actions/admin-leads.ts` | `const schoolName = (slug: string) => SCHOOL_BY_SLUG[slug as SchoolSlug]?.name ?? slug` | `… => schoolFromSlug(slug)?.name ?? slug`. Also `[...lead.schools].map(schoolName).join("; ")` becomes `[...new Set([...lead.schools].map(schoolName))].join("; ")`, so an old and a new slug don't print the school twice. |
    | `lib/actions/reviews.ts` | `if (course?.school) revalidatePath(\`/schools/${course.school}\`)` | revalidate `` `/schools/${schoolSlugOf(course?.school)}` `` only when it is non-null |
    | `lib/actions/school-page.ts` | `Course.find({ school: slug, status: "published", ...PROGRAM_KIND_FILTER })` | `school: { $in: storedSlugsFor(slug) }`. The `isSchoolSlug(slug)` guard on the parameter stays. |
    | `app/api/cron/reminders/route.ts` | `if (!intent.course \|\| !isSchoolSlug(intent.school)) continue` and `schoolName: SCHOOL_BY_SLUG[intent.school].name,` | resolve once (`const school = schoolFromSlug(intent.school)`), `continue` when `!intent.course \|\| !school`, and pass `schoolName: school.name` |

  - Drop imports that become unused. Writes are untouched: `z.enum(SCHOOL_SLUGS)` in `applications.ts`, `enrollment-intent.ts` and `seller-applications.ts`, and `courseHome` and its `isSchoolSlug` form checks in `instructor.ts`.

- [ ] **Step 5: Pure check** at `"$SCRATCH/t2-gate.ts"`:

```ts
import assert from "node:assert/strict"
import { schoolsPathFor } from "@/lib/start-gate"
assert.equal(schoolsPathFor("technology-ai"), "/schools/technology-ai")
assert.equal(schoolsPathFor("cybersecurity"), "/schools/technology-ai")
assert.equal(schoolsPathFor("digital-media-creative"), "/schools/creative-economy")
assert.equal(schoolsPathFor("blockchain-web3"), "/schools/emerging-technologies")
assert.equal(schoolsPathFor("digital-business-remote-careers"), "/schools/digital-business")
assert.equal(schoolsPathFor("nope"), "/schools?start=1")
assert.equal(schoolsPathFor(""), "/schools?start=1")
assert.equal(schoolsPathFor(undefined), "/schools?start=1")
console.log("start-gate: all assertions passed")
```

  Run: `npx tsx --tsconfig ./tsconfig.json "$SCRATCH/t2-gate.ts"`
  Expected: `start-gate: all assertions passed`.

- [ ] **Step 6: Verify against legacy data** (Review Focus 1). The DB still holds the retired slugs.
  Run: `text /schools/technology-ai | grep -oE "AI & AI Automation|App Development with AI|Cybersecurity|Data Analysis" | sort -u`
  Expected: all four.
  Run: `text /schools/emerging-technologies | grep -c "Blockchain Technology Mastery"`
  Expected: `≥ 1`.
  Run: `text /programs/cybersecurity | grep -c "More from Technology & AI"`
  Expected: `1` (the related-programs heading, which prints only when the program's school resolves).
  Run: `text /dashboard/sell/apply student | grep -c "small brands · Creative Economy"`
  Expected: `1` (the submitted fixture application's status line).

- [ ] **Step 7: Verify links and cookies** (Review Focus 2).

```bash
for old in ai-automation software-app-development cybersecurity data-analytics digital-business-remote-careers digital-media-creative blockchain-web3; do echo "$old → $(hop /schools/$old)"; done
```

  Expected: every line is `308 http://localhost:<PORT>/schools/<new>`, matching ruling 1.
  Run: `hop /schools/not-a-school; hop /schools/technology-ai`
  Expected: `404` and `200`.
  Run: `hop /dashboard/start "mock_persona=student; wsa_school=digital-media-creative"`
  Expected: a redirect ending `/schools/creative-economy`.
  Run: `hop "/dashboard/start?school=blockchain-web3" "mock_persona=student"`
  Expected: a redirect ending `/schools/emerging-technologies`.
  Run: `hop "/dashboard/courses?school=data-analytics" "mock_persona=admin"`
  Expected: a redirect ending `/schools/technology-ai`. The admin persona bypasses the school-first gate.
  In the browser, open `/marketplace?school=cybersecurity`. The school filter shows "Technology & AI" selected.

- [ ] **Step 8: Only input checks still call `isSchoolSlug`.**
  Run: `grep -rn "isSchoolSlug(" app components lib`
  Expected: exactly these:
  - `lib/schools.ts` (1, its definition);
  - `lib/actions/instructor.ts` (3, form validation);
  - `app/(marketing)/schools/[slug]/page.tsx` (3, route parameter);
  - `lib/actions/school-page.ts` (1, parameter guard).
  Run: `grep -rn "SCHOOL_BY_SLUG\[" lib/actions app/api`
  Expected: only `lib/actions/instructor.ts` (`courseHome`, a validated write) and `lib/actions/seller-applications.ts` (`answers.school`, Zod-validated).

- [ ] **Step 9: Typecheck and lint.** Run `npx tsc --noEmit`, then `npx eslint <file>` for each of the 15 changed files. Expected: clean.

- [ ] **Step 10: Commit.**

```bash
git add lib/start-gate.ts "app/(platform)/dashboard/courses/page.tsx" "app/(marketing)/marketplace/page.tsx" "app/(marketing)/schools/[slug]/page.tsx" lib/actions/student.ts lib/actions/certificates.ts lib/actions/teaching-home.ts lib/actions/seller-applications.ts lib/actions/applications.ts lib/actions/enrollment-intent.ts lib/actions/instructor.ts lib/actions/admin-leads.ts lib/actions/reviews.ts lib/actions/school-page.ts app/api/cron/reminders/route.ts
git commit -m "feat(schools): retired school links, cookies and stored slugs land on the new school (308s)"
```

---

### Task 3: The migration script, Go note R12 and the owner's steps

**Files:**
- Create: `scripts/migrate-schools-v2.mjs`
- Modify: `docs/go-patches-phase-3.md`, `docs/launch-runbook.md`

**Interfaces:**
- Consumes: the D21 map and the seven short labels (Task 1), duplicated as literals.
- Produces: `node scripts/migrate-schools-v2.mjs [--apply]`. Output lines, which the runbook quotes:
  - per document: `WOULD MOVE <collection>.<field> <_id> <old> → <new>`, `MOVED …`, or `SKIP <collection> <_id> · changed while running`;
  - per mapping: `<collection>.<field>  <old> → <new>  <count>`;
  - per stray value: `LEFTOVER <collection>.<field> "<value>" ×<n> — not a school; untouched`;
  - the summary: `would move <n> · leftovers <n>` (dry run) or `moved <n> · changed while running <n> · leftovers <n>` (apply).

- [ ] **Step 1: Check first.**
  Run: `ls scripts/migrate-schools-v2.mjs`
  Expected: `No such file or directory`.

- [ ] **Step 2: Write the script.** Copy the safety skeleton of `scripts/backfill-certificate-ids.mjs`:
  - capture `EXPLICIT_URI` before `config()`;
  - the same `REFUSING --apply: MONGODB_URI must be passed on the command line …` and `MONGODB_URI is not set — refusing to run.` exits (code 1);
  - the masked `Target: …` line and the `Mode:` line.

  The header comment states:
  - the purpose, D21 and usage;
  - that the maps below are "duplicated literally from lib/schools.ts (each school's `legacySlugs` and `short`)";
  - idempotency;
  - that it never deletes;
  - that raw writes don't bump `updatedAt`;
  - "run it right after deploying Phase 13; never run a pre-Phase 13 `mastery-catalogue.mjs` after it".

  The data:

```js
const MOVES = {
  "ai-automation": "technology-ai", "software-app-development": "technology-ai", cybersecurity: "technology-ai",
  "data-analytics": "technology-ai", "digital-business-remote-careers": "digital-business",
  "digital-media-creative": "creative-economy", "blockchain-web3": "emerging-technologies",
}
const SHORT = {
  "trading-financial-markets": "Trading & Financial Markets", "technology-ai": "Technology & AI",
  "digital-business": "Digital Business", "entrepreneurship-wealth-creation": "Entrepreneurship & Wealth Creation",
  "creative-economy": "Creative Economy", "leadership-personal-development": "Leadership & Personal Development",
  "emerging-technologies": "Emerging Technologies",
}
const TARGETS = [
  { collection: "courses", field: "school", extra: (next) => ({ category: SHORT[next] }) },
  { collection: "enrollmentintents", field: "school", extra: () => ({}) },
  { collection: "sellerapplications", field: "school", extra: () => ({}) },
  { collection: "instructorapplications", field: "answers.school", extra: () => ({}) },
]
```

  For each target, in order:
  1. Find `{ [field]: { $in: Object.keys(MOVES) } }`, projecting `_id` and the field (read a dotted field with a tiny `get(doc, "answers.school")`).
  2. For each document: in a dry run print `WOULD MOVE`. With `--apply`, call `updateOne({ _id, [field]: old }, { $set: { [field]: next, ...extra(next) } })` and print `MOVED` on `modifiedCount === 1`, else `SKIP … changed while running`.
  3. Print the per-mapping counts.
  4. Report leftovers: `distinct(field, { [field]: { $nin: [...Object.keys(SHORT), ...Object.keys(MOVES), null, ""] } })`, then `countDocuments` per value, then one `LEFTOVER` line each.

  End with the summary line and, in a dry run, `DRY RUN — nothing written. Re-run with MONGODB_URI=<uri> … --apply`. Exit 0.

- [ ] **Step 3: Lint.**
  Run: `npx eslint scripts/migrate-schools-v2.mjs`
  Expected: clean.

- [ ] **Step 4: It refuses** (Review Focus 5). The worktree has no `.env.local`.
  Run: `node scripts/migrate-schools-v2.mjs --apply; echo "exit $?"`
  Expected: the `REFUSING --apply` message, `exit 1`.
  Run: `node scripts/migrate-schools-v2.mjs; echo "exit $?"`
  Expected: `MONGODB_URI is not set — refusing to run.`, `exit 1`.

- [ ] **Step 5: Dry run on the mock DB** (the catalogue under retired slugs, plus Task 2's fixtures).
  Run: `MONGODB_URI=$URI node scripts/migrate-schools-v2.mjs | tee "$SCRATCH/t3-dry.log" | grep -vE "^WOULD MOVE"`
  Expected mapping lines and counts:

```
courses.school  ai-automation → technology-ai  1
courses.school  software-app-development → technology-ai  1
courses.school  cybersecurity → technology-ai  1
courses.school  data-analytics → technology-ai  2
courses.school  digital-business-remote-careers → digital-business  3
courses.school  digital-media-creative → creative-economy  2
courses.school  blockchain-web3 → emerging-technologies  1
enrollmentintents.school  cybersecurity → technology-ai  1
sellerapplications.school  digital-media-creative → creative-economy  1
instructorapplications.answers.school  blockchain-web3 → emerging-technologies  1
LEFTOVER courses.school "astrology" ×1 — not a school; untouched
would move 14 · leftovers 1
```

  `grep -c "^WOULD MOVE" "$SCRATCH/t3-dry.log"` prints `14`. Trading's two programs and the seeded school-less courses aren't listed. Rows created by hand would add to the counts.

- [ ] **Step 6: Apply, then apply again.**
  Run: `MONGODB_URI=$URI node scripts/migrate-schools-v2.mjs --apply | tail -2`
  Expected: `moved 14 · changed while running 0 · leftovers 1`.
  Run the same `--apply` again.
  Expected: `moved 0 · changed while running 0 · leftovers 1`, with no `MOVED` line.
  The app still reads right: `text /schools/technology-ai | grep -oE "AI & AI Automation|App Development with AI|Cybersecurity|Data Analysis" | sort -u` prints all four (now stored slugs), and `text /dashboard/sell/apply student | grep -c "small brands · Creative Economy"` prints `1`.

- [ ] **Step 7: Clean up the fixtures.**
  Run: `MONGODB_URI=$URI node "$SCRATCH/phase13-fixtures.mjs" --clean`
  Expected: `courses 2`, `enrollmentintents 1`, `sellerapplications 1`, `instructorapplications 1`.
  Then `MONGODB_URI=$URI node scripts/migrate-schools-v2.mjs | tail -2`
  Expected: `would move 0 · leftovers 0`.

- [ ] **Step 8: Go note R12.** Append to `docs/go-patches-phase-3.md` a section `## 12. Phase 13 — the seven schools (owner, 2026-10-19; D21, D22)`, holding:
  - **R12 — School slugs and labels change; ship before `scripts/migrate-schools-v2.mjs --apply` runs.**
  - Ruling 1's table: old slug(s) → new slug → new `courses.category`, plus the two new schools, marked "no programs yet".
  - The rewritten fields: `courses.school`, `courses.category` (on moved courses only), `enrollmentintents.school`, `sellerapplications.school`, `instructorapplications.answers.school`.
  - Any mobile list of school slugs, names, icons or filters switches to the seven, in §7's order, in the same release.
  - Go must never write a retired slug. Until the migration has run, a read should map a retired slug through the table, as the web does (`schoolFromSlug`, `lib/schools.ts`).
  - Web `/schools/<retired>` answers 308.
  - Nothing is added, renamed or removed.

- [ ] **Step 9: Runbook.** In `docs/launch-runbook.md`, add a section `## Seven schools — Phase 13 (D21, D22)` right before `## 0. Blockers — settle these first`, with these steps in order:
  1. **Go.** R12 is live (`docs/go-patches-phase-3.md` §12).
  2. **Backup** (§1).
  3. **Deploy** the web app (§4). From here, the site already shows retired slugs under their new school.
  4. **Dry run:**

     ```bash
     MONGODB_URI="$PROD_URI" node scripts/migrate-schools-v2.mjs | tee "schools-v2-dryrun-$(date +%Y%m%d-%H%M).log"
     ```

     Review the per-mapping counts. Every `LEFTOVER` line must be explained before applying; none is expected.
  5. **Apply, the same day:** the same command with `--apply`, tee'd to `schools-v2-apply-…log`.
  6. **Check:**
     - Re-running `--apply` prints `moved 0`.
     - `curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "$SITE/schools/cybersecurity"` prints `308 $SITE/schools/technology-ai`.
     - `$SITE/schools/entrepreneurship-wealth-creation` returns `200`.
  7. **Catalogue dry run (§6), from a Phase 13 checkout.** Every MATCH prints `school: X -> X`. **Never run `mastery-catalogue.mjs` from an older checkout after this step.** It would move the 12 programs back to retired slugs.
  8. **Rollback.** The apply log lists every `MOVED` document, old → new. The mapping is many-to-one, so restore the four fields from the backup (`mongorestore` of those collections) or reverse the logged lines by hand. Reverting only the web deploy leaves programs under schools the old code doesn't know.
  9. **Owed by product:** sign off each school's copy in `lib/schools.ts` (entries marked `DRAFT: owner sign-off pending`), and the two placeholder covers.

- [ ] **Step 10: Commit.**

```bash
git add scripts/migrate-schools-v2.mjs docs/go-patches-phase-3.md docs/launch-runbook.md
git commit -m "feat(scripts): migrate-schools-v2 — stored school slugs move to the seven schools (dry run by default); Go R12, runbook"
```

---

### Task 4: The catalogue files programs under the seven schools

**Files:**
- Modify: `scripts/mastery-catalogue.mjs` (only the header comment, the `SCHOOLS` literal, the `school:` values in `PROGRAMS`, and one MATCH print line; ruling 9)

**Interfaces:**
- Consumes: ruling 1 (slugs and `short`), Task 1's `blurb`s.
- Produces: catalogue rows with `school` set to one of the seven and `category` set to its `short`. Each MATCH prints `  school: <existing> -> <new>`.

- [ ] **Step 1: Check first.**
  Run: `grep -cE '"(blockchain-web3|ai-automation|software-app-development|cybersecurity|data-analytics|digital-media-creative|digital-business-remote-careers)"|^  cybersecurity:' scripts/mastery-catalogue.mjs`
  Expected: a count above `0`. **Do not run the unedited script against the mock DB now.** Task 3 migrated it, and the old script would move programs back.

- [ ] **Step 2: Edit.**
  - **`SCHOOLS`.** It becomes the seven, with `short` from ruling 1 and `blurb` from Task 1, in §7 order. Keep the "duplicated from lib/schools.ts" banner comment.
  - **`PROGRAMS`, `school:` values:**
    - Forex and Crypto: `trading-financial-markets`.
    - Blockchain Technology Mastery: `emerging-technologies`.
    - AI & AI Automation, App Development with AI, Cybersecurity and Data Analysis: `technology-ai`.
    - Content Creation Mastery and Video Editing Mastery: `creative-economy`.
    - Tech Sales & Digital Marketing, E-Commerce & Digital Business and Virtual Assistance: `digital-business`.
  - **MATCH print.** In the `plan.kind === "match"` branch, after the `slug:` line, add `` console.log(`  school: ${existing.school ?? "none"} -> ${program.school}`) ``.
  - **Header comment.** Mention the Phase 13 move and "run `migrate-schools-v2.mjs` first; never run a pre-Phase 13 copy of this script after it".

- [ ] **Step 3: Verify.**
  Run: `node --check scripts/mastery-catalogue.mjs && npx eslint scripts/mastery-catalogue.mjs`
  Expected: clean.
  Run: `grep -cE '"(blockchain-web3|ai-automation|software-app-development|cybersecurity|data-analytics|digital-media-creative|digital-business-remote-careers)"|^  cybersecurity:' scripts/mastery-catalogue.mjs`
  Expected: `0`.
  Run: `MONGODB_URI=$URI node scripts/mastery-catalogue.mjs | grep -E "^MATCH|school:"`
  Expected: 12 MATCH lines, each followed by a no-op line, such as `school: technology-ai -> technology-ai` for the four Technology & AI programs.
  Run: `MONGODB_URI=$URI node scripts/mastery-catalogue.mjs --apply | tail -3`
  Expected: `matched 12 / renamed 0 / inserted 0 / skipped 0` and `Total modifiedCount across matched rows: 0`. The migration and the catalogue agree on every slug and category.

- [ ] **Step 4: Commit.**

```bash
git add scripts/mastery-catalogue.mjs
git commit -m "feat(catalogue): the 12 programs filed under the seven schools; MATCH prints the school"
```

---

### Task 5: The school page in §8's order

**Files:**
- Create: `components/schools/school-points.tsx`, `components/schools/school-areas.tsx`
- Modify: `app/(marketing)/schools/[slug]/page.tsx`, `components/schools/school-topics.tsx`, `components/schools/school-path.tsx`

**Interfaces:**
- Consumes: `School.learn` / `audience` / `careers` / `areas`, `studyAreas`, `StudyAreaLink`, `SCHOOLS` (Task 1); `SCHOOL_SECTION` and `SectionHead` (`components/schools/section-head.tsx`); `plural` (`components/programs/format`); `ArrowRightIcon` (`@/components/icons`).
- Produces:
  - `SchoolPoints({ id, title, items, layout }: { id: "learn" | "audience" | "careers"; title: string; items: readonly string[]; layout: "list" | "cards" })`: a server component that returns `null` when `items` is empty.
    - Its root is `<section id={id} aria-labelledby={\`${id}-heading\`} className={SCHOOL_SECTION}>` with `SectionHead` (no lede).
    - `"list"` is a `<ul className="mt-10 grid gap-x-10 gap-y-4 md:grid-cols-2">`. Each `<li>` uses the ring bullet that `SchoolTopics`' `TopicList` uses (`size-2 rounded-full ring-[1.5px] ring-ws-muted`) and `text-[16px] text-ws-primary`.
    - `"cards"` is an `<ol className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">`. Each `<li>` is a `rounded-[20px] border border-ws-hairline bg-ws-surface p-6 dark:border-transparent` card holding a `tabular-nums text-ws-muted` index ("01"…) and the text.
  - `SchoolAreas({ areas }: { areas: StudyAreaLink[] })`: a server component, `<section id="areas" aria-labelledby="areas-heading">`, titled "Study areas", with the lede "Areas with an open program link to it. The rest are coming soon."
    - The aside reads `` `${open} of ${areas.length} open` `` (`tabular-nums`), shown only when `open > 0`.
    - The grid is `mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3`, in §7 order.
    - An open area is one `<Link>` tile: `rounded-[20px]`, hairline border, the area name in `font-semibold text-ws-primary`, the program's title below in `text-[13px] text-ws-muted`, then an `ArrowRightIcon`. It has a hover fill of `bg-ws-raised` and a `ring-ws-brand/40` focus ring.
    - Any other area is a non-interactive `<div>` with a dashed hairline border, the name in `text-ws-muted`, and a pill chip "Coming soon" (`rounded-full bg-ws-raised px-2.5 py-1 text-[12px] font-semibold text-ws-muted`).
    - No gold anywhere.

- [ ] **Step 1: Check first.**
  Run: `sections /schools/technology-ai`
  Expected: `programs compare learn faq other-schools`. Here `learn` is `SchoolTopics`; the AI program is the only one with outcomes.

- [ ] **Step 2: Create `school-points.tsx` and `school-areas.tsx`** per their interfaces. Each gets a doc comment citing institutional blueprint §8 (and D22 for areas).

- [ ] **Step 3: `school-topics.tsx`.**
  - `id="learn"` becomes `id="topics"`, and `aria-labelledby` / `SectionHead id` become `topics-heading`.
  - The title "What you’ll learn here" becomes "Topics across the programs".
  - The doc comment's `` `#learn` — "What you'll learn here" `` becomes `` `#topics` — "Topics across the programs" ``, noting that §8's "What you'll learn" is now the school's own list.

- [ ] **Step 4: `school-path.tsx`.** `title="Suggested path"` becomes `title="Learning pathways"` (§8). The lede stays.

- [ ] **Step 5: `app/(marketing)/schools/[slug]/page.tsx`.**
  - **Data.** Add `const areas = studyAreas(school, programs.map(({ program }) => ({ title: program.title, slug: program.slug })))`.
  - **`links`, in this order** (each conditional on its section rendering):
    1. `learn` "What you’ll learn"
    2. `audience` "Who it’s for"
    3. `careers` "Careers"
    4. `programs` "Programs"
    5. `compare` "Compare" (2+ programs)
    6. `topics` "Topics" (was `{ id: "learn", label: "What you’ll learn" }` on `hasTopics`)
    7. `areas` "Study areas"
    8. `faculty` "Faculty"
    9. `path` "Pathways"
    10. `free-lessons` "Free lessons"
    11. `reviews` "Reviews"
    12. `faq` "FAQ"
    13. `other-schools` "Other schools"

    `SectionNav` marks the last section passed, so this array must match the DOM order.
  - **Body, inside the sticky-nav container:**
    1. `<SchoolPoints id="learn" title="What you’ll learn" items={school.learn} layout="list" />`
    2. `<SchoolPoints id="audience" title="Who it’s for" items={school.audience} layout="cards" />`
    3. `<SchoolPoints id="careers" title="Career & economic applications" items={school.careers} layout="list" />`
    4. `<SchoolPrograms …/>`, with its `cohort={…}` expression untouched (ruling 9)
    5. `<SchoolCompare …/>`
    6. `<SchoolTopics …/>`
    7. `<SchoolAreas areas={areas} />`
    8. `<SchoolFaculty …/>`
    9. then exactly this one line:

       ```tsx
       {/* §8 "Upcoming cohorts": Phase 12 mounts <SchoolCohorts /> (components/schools/school-cohorts.tsx) here, between Faculty and Learning pathways. */}
       ```

    10. `<SchoolPath …/>`, `<SchoolFreeLessons …/>`, `<SchoolReviews …/>`, the `Faq` wrapper and `<OtherSchools …/>`, as today

    `SchoolClosing` and `SchoolStickyBar` are unchanged.
  - **Copy.** The closing body "Every program open today, across all eight schools, is in one list — each with its level and price." reads `` `… across all ${SCHOOLS.length} schools, …` ``.
  - **Comments.** Rewrite the page's doc comment as §8's order, citing institutional blueprint §8, D22 and D31, and the Phase 12 slot.

- [ ] **Step 6: Verify the order.**
  Run: `sections /schools/technology-ai`
  Expected: `learn audience careers programs compare topics areas faq other-schools`.
  Run: `sections /schools/trading-financial-markets`
  Expected: `learn audience careers programs compare topics areas faq other-schools`.
  Run: `sections /schools/creative-economy`
  Expected: `learn audience careers programs areas faq other-schools` (one published program: Video Editing is a draft).
  Areas link only to published programs (D22):
  - `section /schools/creative-economy areas | grep -oE 'href="/programs/[a-z0-9-]+"'` prints only `href="/programs/content-creation-mastery"`. Video Editing Mastery is a draft, so "Video Production" reads Coming soon.
  - `section /schools/technology-ai areas | grep -oE 'href="/programs/[a-z0-9-]+"' | sort | uniq -c` prints `ai-ai-automation` ×2, then `app-development-with-ai`, `cybersecurity` and `data-analysis` once each.

  Run: `text /schools/technology-ai | grep -oE "What you’ll learn|Who it’s for|Career & economic applications|Available programs|Topics across the programs|Study areas|5 of 7 open" | sort -u`
  Expected: all seven phrases. Faculty stays hidden (`FACULTY_PUBLIC` off), as before.

- [ ] **Step 7: A school with no programs** (Review Focus 3).
  Run: `sections /schools/entrepreneurship-wealth-creation`
  Expected: `learn audience careers programs areas faq other-schools`.
  Run: `text /schools/leadership-personal-development | grep -c "The first programs are on their way"`
  Expected: `1`.
  Run: `section /schools/leadership-personal-development areas | grep -o "Coming soon" | wc -l; section /schools/leadership-personal-development areas | grep -c "<a "; section /schools/leadership-personal-development areas | grep -c "of 6 open"`
  Expected: `6`, `0`, `0`. Task 6 removes the "0 programs" that school cards print.
  In the browser:
  - the hero shows the placeholder cover (ruling 6) and "See the other schools";
  - there is no sticky phone bar;
  - tabbing through Study areas stops on no tile.

- [ ] **Step 8: Look at it.** At 1440, 390 and 320 px, in dark and light, on `/schools/technology-ai` and `/schools/leadership-personal-development`:
  - no horizontal scroll (`document.documentElement.scrollWidth <= innerWidth`);
  - the section nav stays one line and scrolls sideways on phones;
  - jumping to "Study areas" lands under the stuck nav, and the active link follows the scroll in order;
  - area tiles wrap without clipping "Entrepreneurship & Wealth Creation"-length names;
  - with reduced motion everything is visible;
  - clicking a program card on `/schools/trading-financial-markets` opens `/programs/forex-trading-mastery`, which shows the three plans (§8: programs lead to enrolment options).

- [ ] **Step 9: Typecheck, lint and commit.**

```bash
npx tsc --noEmit
npx eslint components/schools/school-points.tsx
npx eslint components/schools/school-areas.tsx
npx eslint "app/(marketing)/schools/[slug]/page.tsx"
npx eslint components/schools/school-topics.tsx
npx eslint components/schools/school-path.tsx
git add components/schools/school-points.tsx components/schools/school-areas.tsx "app/(marketing)/schools/[slug]/page.tsx" components/schools/school-topics.tsx components/schools/school-path.tsx
git commit -m "feat(school-page): §8's order — what you'll learn, who it's for, careers, programs, study areas, faculty, pathways"
```

---

### Task 6: Every surface says seven

**Files:**
- Modify: `app/(marketing)/programs/page.tsx`, `app/(marketing)/sell/page.tsx`, `app/(marketing)/teach/page.tsx`, `components/schools/other-schools.tsx`, `components/schools-index/schools-index.tsx`, `components/schools-index/model.ts`, `lib/marketplace.ts`, `components/marketing/words-marquee.tsx`, `components/marketing/school-card.tsx`, `components/marketing/school-panel.tsx`

**Interfaces:**
- Consumes: `SCHOOLS` (Task 1). Produces: none (copy, plus search terms).

- [ ] **Step 1: Check first.**
  Run: `for p in /programs /sell /teach /schools /schools/technology-ai; do echo "$p $(text $p | grep -ciE 'eight schools|all eight')"; done`
  Expected: non-zero on `/programs`, `/sell`, `/schools/technology-ai` and `/schools` (the empty-search text is client-side, so it may read 0).

- [ ] **Step 2: Counts read `SCHOOLS.length`** (import `SCHOOLS` from `@/lib/schools` where a file lacks it). Each "eight" below becomes the count:
  - `programs/page.tsx`: both "Browse every program across the eight schools of" strings (the `metadata.description` and the visible lede).
  - `sell/page.tsx`: "a topic that fits one of\n              of the eight schools." becomes `…one of the {SCHOOLS.length} schools.`
  - `other-schools.tsx`: "Across all eight schools, with each one&apos;s level and price."
  - `schools-index.tsx`: "not yet part of one of the eight schools." and "start from one of the eight schools."
  - `lib/marketplace.ts`, `QUALITY_CRITERIA`: the title "Fits one of the eight schools" becomes `` `Fits one of the ${SCHOOLS.length} schools` ``. Its body becomes "The topic belongs in a school of the Academy, from trading and technology to digital business, the creative economy and leadership."
  - `teach/page.tsx`, the first FAQ answer: the list "from trading and blockchain to AI, software, cybersecurity, data, digital media and digital business" becomes "from trading and technology to digital business, entrepreneurship, the creative economy, leadership and emerging technologies".

- [ ] **Step 3: The words band and the search.**
  - `words-marquee.tsx`. The comment becomes "The seven schools' vocabulary." `WORDS` becomes `"Trading", "Artificial intelligence", "Software", "Data", "Cybersecurity", "Digital business", "Entrepreneurship", "Creative economy", "Leadership", "Blockchain", "Mentorship", "Certification"`.
  - `schools-index/model.ts`. In `terms: wordsOf([...].join(" "))`, add `...school.areas.map((a) => a.name)`, so a search for "Photography" keeps Creative Economy lit.
  - **Zero-program schools** (Review Focus 3). Two schools now have no programs by design. In `school-card.tsx` and `school-panel.tsx`, `const programs = count === 1 ? "1 program" : \`${count} programs\`` reads "Programs coming soon" when `count === 0`. That is the wording `components/schools-index/school-row.tsx` already uses. `hero-wall.tsx` already hides a zero count; leave it.

- [ ] **Step 4: Fix "eight" comments in this task's files only** (ruling 10). Run `grep -n -i "eight" <file>` and reword each school-count comment to seven. Leave "weight", "height" and the certificate-ID text alone.

- [ ] **Step 5: Verify the copy.**
  Run: `for p in / /programs /sell /teach /schools /marketplace /schools/technology-ai /schools/creative-economy; do echo "$p $(text $p | grep -ciE 'eight schools|all eight|8 schools')"; done`
  Expected: `0` on every line.
  Run: `text /programs | grep -o "across the 7 schools"; text /sell | grep -o "one of the 7 schools"; text /teach | grep -o "one of our 7 schools"; text /schools/technology-ai | grep -o "Across all 7 schools"`
  Expected: one hit each.
  Run: `grep -rniE "eight schools|all eight|8 schools" app components lib --include=*.ts --include=*.tsx`
  Expected: comments in files this phase doesn't edit, plus `lib/brand.ts` `SITE_DESCRIPTION`. That is meta-only, and Phase 11 has already rewritten it on `mastery/phase-11` (ruling 9), so leave it. Paste the list into the task report.
  Run: `for p in / /schools/leadership-personal-development /schools/technology-ai; do echo "$p $(text $p | grep -cE '(^|[^0-9])0 programs')"; done`
  Expected: `0` on every line. "Programs coming soon" shows instead, on the landing's schools showcase and in "Other schools".

- [ ] **Step 6: Seven in layouts drawn for eight** (Review Focus 4). At 1440, 390 and 320 px, dark and light, as `guest`:
  - `/schools`: the cover wall reads as 4 + 3 at every width, with stagger intact and no blank or broken tile; `#` jumps land on each row. Type "photography": Creative Economy stays lit.
  - The navbar's schools menu (lg): two columns, 4 + 3.
  - `/`: the hero school chips (lg) wrap cleanly with "Entrepreneurship & Wealth Creation" and "Leadership & Personal Development". Picking each chip shows its cover (ruling 6), and the CTA reads "Explore the School of …".
  - `/`: the vignettes tile grid, the schools showcase (`schools-grid`) and the sticky school bar hold seven, without overflow.
  - `/schools/creative-economy`: "Other schools" shows six schools plus "Every program in one list".

  If a layout breaks visibly, fix it in the smallest way in that component (and add it to this task's files), or stop and report. Don't redesign.

- [ ] **Step 7: Typecheck, lint and commit.**

```bash
npx tsc --noEmit
for f in "app/(marketing)/programs/page.tsx" "app/(marketing)/sell/page.tsx" "app/(marketing)/teach/page.tsx" components/schools/other-schools.tsx components/schools-index/schools-index.tsx components/schools-index/model.ts lib/marketplace.ts components/marketing/words-marquee.tsx components/marketing/school-card.tsx components/marketing/school-panel.tsx; do npx eslint "$f"; done
git add "app/(marketing)/programs/page.tsx" "app/(marketing)/sell/page.tsx" "app/(marketing)/teach/page.tsx" components/schools/other-schools.tsx components/schools-index/schools-index.tsx components/schools-index/model.ts lib/marketplace.ts components/marketing/words-marquee.tsx components/marketing/school-card.tsx components/marketing/school-panel.tsx
git commit -m "chore(copy): seven schools on every surface — counts from SCHOOLS, the words band, study areas in search"
```

---

### Task 7: Docs and the closing run

**Files:**
- Modify: `docs/institutional-blueprint-plan.md`, `docs/mastery-academy-plan.md`, `context.md`

**Interfaces:** none.

- [ ] **Step 1: Docs.**
  - **`docs/institutional-blueprint-plan.md`:**
    - In §3's table, the Phase 13 row becomes "done (<date>, <n> commits), migration owner-run".
    - Tick Phase 13's first two exit criteria. Leave the third ("The migration dry run on a production copy …") unticked, marked "owner, runbook 'Seven schools'".
    - Under "Risk register" item 5, add "real school covers for Entrepreneurship & Wealth Creation and Leadership & Personal Development (13; placeholders now)".
  - **`docs/mastery-academy-plan.md`:** the row for 13 says the same.
  - **`context.md`:** add a dated Decision Log entry covering:
    - the seven schools and the D21 map;
    - `intro` as the §8 overview;
    - areas matched by catalogue title;
    - 308s from the page, not `next.config.ts` (the Docker reason);
    - the read-side `schoolFromSlug` rule;
    - the placeholder covers;
    - the drafted copy awaiting sign-off.

- [ ] **Step 2: The closing run.** Restart the verification server (don't re-run the catalogue line; it is a no-op now anyway).
  - Check `/`, `/schools`, all seven `/schools/<slug>`, `/programs`, `/programs/forex-trading-mastery`, `/marketplace`, `/sell` and `/teach` at 1440, 390 and 320 px, in dark and light, as `guest` and `student`. There must be no horizontal scroll, and no console errors apart from the known Vivid 403.
  - Run: `curl -s $BASE/sitemap.xml | grep -oE "<loc>[^<]*/schools[^<]*</loc>" | wc -l`
    Expected: `8` (the index plus the seven), with no retired slug in them.
  - Re-run Task 2, step 7's loop.
    Expected: seven 308s.

- [ ] **Step 3: Whole-repo checks.**
  Run: `pnpm lint` and `npx tsc --noEmit`.
  Expected: no new lint problems against Task 1, step 1's count, and tsc clean apart from the one stale `.next/types` error.

- [ ] **Step 4: Commit and stop the server.**

```bash
git add docs/institutional-blueprint-plan.md docs/mastery-academy-plan.md context.md
git commit -m "docs: Phase 13 — seven schools and the §8 school page"
```

## Report (end of phase)

Read out Phase 13's exit criteria, and add:
- the controller rulings that changed the roadmap: `intro` as the overview, page-level 308s, read-side resolution, reused covers, and `render.mjs` left frozen;
- the remaining "eight" comment hits (Task 6, step 5);
- for the owner:
  - every `DRAFT: owner sign-off pending` entry in `lib/schools.ts`;
  - the two placeholder covers;
  - the runbook section "Seven schools — Phase 13", in its order: Go R12 → deploy → dry run → `--apply` → catalogue dry run;
  - "never run a pre-Phase 13 catalogue after the migration".
