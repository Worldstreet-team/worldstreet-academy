# Mastery Academy — Phase 11 Implementation Plan (The institution's voice: hero, `/academy`, vocabulary)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A visitor meets the institution the owner's Institutional Blueprint describes:
- the §18 hero and cohort section;
- Wealth Liquefaction, the three gaps and the three worlds on the landing;
- an `/academy` page that carries §1–§6 and §20–§23;
- one pass over the site's words, so plans are "plans", sellers are "Marketplace Creators" and the teaching CTA reads "Become a WMA Instructor".

**Architecture:**
- **Copy.** It has one home, the new `lib/institution.ts`, which holds the blueprint's institutional wording verbatim. `lib/brand.ts` stays the home of the name, tagline and meta description. Pages import from both, and nothing re-types the copy.
- **The cohort number.** It joins `lib/cohort.ts` as a build-time env value. That's deliberately small: Phase 12 replaces the whole module with data.
- **Scope.** No data, route, action or model changes, apart from one new marketing route, `/academy`.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict · Tailwind v4 with the WorldStreet design system (`ds/`, `ws-*` tokens) · `motion` (installed).

**Spec:** `docs/institutional-blueprint.md` §1–§6, §16–§23. **Roadmap:** `docs/institutional-blueprint-plan.md` Phase 11, decisions D16–D19.

**Branch:** `mastery/phase-11`, cut from `feat/cohort-launch` (or from `main` once Phase 10 has merged it). Never cut it from a `main` that doesn't yet hold `feat/cohort-launch`.

## Controller rulings (binding)

1. **"Explore the Academy" opens `/schools`.** The Academy is World 1 (§6): schools, then programs. A chosen school still turns the CTA into "Explore the School of …".
2. **"Join the upcoming cohort" opens `/#cohort`** (the cohort band directly below the hero), and only while a cohort is upcoming. After the start, the secondary CTA goes back to today's "Start learning", so it never points at a band that has disappeared. The landing (a server component) decides this with `cohortIsUpcoming()` and passes it down, so server and client agree.
3. **Dates stay in the site's en-GB style:** "Cohort 001 — Starts Monday 19 October", not "October 19".
4. **§4 replaces the 2026-10-03 "Who we are" framing** ("point A to point B"). It is the newer owner text; list the replaced copy in the phase report so the owner can object.
5. **Competitor names never print.** §23's contrast reads "Most learning platforms answer: …", and §6's "Think Udemy + Coursera Marketplace + WMA ecosystem" is left out.
6. **The Opportunity Hub is "Coming soon", with no link and no route** (D18).
7. **Vocabulary changes user-facing strings only.** Identifiers, routes, enum values, field names, comments and log text stay. Marketplace and New Economy items stay "courses"; Academy offerings are "programs".
8. **What stays:** `WhyBand` (six pillars), `HowItWorks`, `CertificateBand`, `Faq` and the teasers don't conflict with the new blueprint. They only take the plan wording.

## Global Constraints

- **Wording:**
  - Copy is verbatim from `docs/institutional-blueprint.md` wherever the spec gives wording. Where it gives a heading and no body, ship "Coming soon".
  - Never invent figures, testimonials or policy.
  - "Enrol" in new copy; existing strings are left alone.
- **Code:**
  - No new dependencies. No `any`. No hardcoded palette hex: use `ws-*` utilities and tokens only.
  - Icons only through `@/components/icons`. Base UI composition uses `render`.
  - Gold is only for the primary CTA, active nav and brand moments. The one gold word in a chain is its last stop.
- **Motion:** opacity and transform only, honouring reduced motion. No hover scaling, no loops.
- **Lint and types:** `npx eslint <changed files>` (lint changed files individually) and `npx tsc --noEmit`. One stale `.next/types` error is not real.
- **No test runner, and none is added.** Copy is checked by fetching the rendered page with scripts stripped (below); layout is checked by driving the page at 1440, 390 and 320 px.
- Anchors below are **quoted text**, never line numbers.

## Review Focus

1. **The cohort has already started** (production since 2026-10-19 00:00 Lagos time). The hero must show "Start learning", not "Join the upcoming cohort". No `#cohort` link may exist, and the band must not render. Covered in Task 2, step 6.
2. **320 px phones.** "the New Economy" must hold one line, the band heading must wrap without overflow, and the cohort bar must stay one line at 360 px. Covered in Task 2, step 7, and Task 3, step 5.
3. **Reduced motion.** The hero claim and the six-stop Wealth Liquefaction arc render fully lit and still. Covered in Task 4, step 6.
4. **Light theme.** `/academy` and `WorldsBand` must read in light and dark: tokens only, and the "Coming soon" card legible. Covered in Task 5, step 6.
5. **Sharing.** `/academy` needs a canonical URL and a sitemap entry, and the OG image must render the new tagline without clipping. Covered in Task 1, step 5, and Task 5, step 5.

## Verification server

```bash
# Nothing already listening? (a killed dev:mock leaves next + mongod alive)
netstat -ano | grep -E ":3100|:27018"

# A FUTURE cohort, so the band and the cohort CTA render (Task 2–4 checks).
RESEND_API_KEY=re_disabled_local CLOUDFLARE_REALTIME_API_KEY=disabled-local OPENAI_API_KEY=disabled-local \
ABLY_API_KEY=disabled-local R2_SECRET_ACCESS_KEY=disabled-local WALLET_SERVICE_TOKEN=disabled-local \
NEXT_PUBLIC_COHORT_STARTS_AT=2026-11-16T00:00:00+01:00 NEXT_PUBLIC_COHORT_NUMBER=2 \
MOCK_DB_PORT=27018 PORT=3100 node scripts/dev-mock.mjs

# Programs for the pages (explicit MONGODB_URI is mandatory — .env.local is PRODUCTION)
MONGODB_URI=mongodb://127.0.0.1:27018/worldstreet-academy node scripts/mastery-catalogue.mjs --apply
```

`NEXT_PUBLIC_*` values are read when the dev server starts. For the "cohort already started" checks, restart without the two cohort variables; the default start, 2026-10-19, is then in the past. Personas switch with the `mock_persona` cookie (`guest`, `student`, `instructor`, `admin`).

The page-text helper strips scripts and tags so the RSC payload never counts as rendered copy:

```bash
BASE=http://localhost:3100
SCRATCH=$(mktemp -d)   # inventories (Tasks 6–7) live outside the repository
text() { curl -s ${2:+-b "mock_persona=$2"} "$BASE$1" | perl -0pe 's#<script\b.*?</script>##gs; s#<style\b.*?</style>##gs; s#<[^>]+># #g; s#&\#x27;#\x27#g; s#&quot;#"#g; s#&amp;#&#g; s#\s+# #g'; }
# usage: text / | grep -o "Explore the Academy" | head -1      text /dashboard/checkout?... student
```

## File structure

| File | Responsibility |
|---|---|
| `lib/brand.ts` (modify) | `shortName`, the D16 tagline, the §22 `SITE_DESCRIPTION` |
| `lib/institution.ts` (new) | The blueprint's institutional copy, verbatim; the one place it is typed |
| `lib/cohort.ts` (modify) | + `COHORT_NUMBER`, `COHORT_NAME` |
| `components/marketing/hero-copy.tsx`, `hero-wall.tsx` (modify) | §18 claim, sub-copy, CTAs |
| `components/marketing/cohort-banner.tsx` (modify) | §18 cohort section: `id="cohort"`, heading, CTAs |
| `components/marketing/about-band.tsx` (modify) | §1–§2 Wealth Liquefaction |
| `components/marketing/institution-band.tsx` (modify) | §4 mission and three gaps |
| `components/marketing/worlds-band.tsx` (new) | §6 three worlds (landing and `/academy`) |
| `components/marketing/reviews-finale.tsx` (modify) | §23 close |
| `components/marketing/landing.tsx` (modify) | Pass `cohortOpen`; mount `WorldsBand` |
| `components/academy/chain.tsx` (new) | An ordered chain with hairline connectors, last stop gold (server) |
| `app/(marketing)/academy/page.tsx` (new) | `/academy`: §1–§6 and §20–§23 |
| `app/sitemap.ts`, `components/marketing/navbar.tsx`, `mobile-nav.tsx`, `footer.tsx` (modify) | Reach `/academy` |
| Vocabulary files (modify) | Listed by the inventory greps in Tasks 6–7 |

---

### Task 1: The institution's words have one home

**Files:**
- Modify: `lib/brand.ts`
- Create: `lib/institution.ts`

**Interfaces:**
- Produces:
  - `BRAND.shortName: "WMA"`.
  - `BRAND.tagline: "The Academy of the New Economy"`.
  - `SITE_DESCRIPTION`: the §22 sentence.
  - From `lib/institution.ts`: `HERO`, `PURPOSE`, `COMBINES`, `WEALTH_LIQUEFACTION`, `WEALTH_LIQUEFACTION_DEFINITION`, `VALUE_LINE`, `VISION`, `MISSION`, `GAPS`, `JOURNEY`, `JOURNEY_EXAMPLES`, `WORLDS` (+ `type World`), `ECOSYSTEM`, `CORE_TRANSFORMATION`, `CORE_PROPOSITION`, `DEFINITION`, `ACADEMY_LINE` and `BIGGER_VISION`. Their exact values are in step 3.

- [ ] **Step 1: Record the starting state.**
  Run: `grep -rn "Own Your Future\|Create Your Future" app components lib`
  Expected: hits in `lib/brand.ts`, `components/marketing/hero-copy.tsx` and `components/marketing/reviews-finale.tsx`.

- [ ] **Step 2: `lib/brand.ts`.**
  - In `BRAND`, add `shortName: "WMA",` after `eyebrow`. Set `tagline: "The Academy of the New Economy",`. Leave `descriptor` as it is; it is §2's positioning, verbatim.
  - Replace `SITE_DESCRIPTION` with `` `${BRAND.name} is a global institution for the new economy that equips people with practical knowledge, develops that knowledge into mastery, and helps them apply valuable skills to create economic value and transform their financial capacity.` `` (§22).
  - Update the comment above it to cite "institutional blueprint §22".

- [ ] **Step 3: Create `lib/institution.ts`.** It's a client-safe module with no server imports. The doc comment names it the one home of the blueprint's institutional copy and points at `docs/institutional-blueprint.md`. Values are verbatim:

```ts
import { BRAND, SITE_DESCRIPTION } from "@/lib/brand"

/** §18 — the homepage hero. The eyebrow is uppercased by CSS. */
export const HERO = {
  eyebrow: `Welcome to ${BRAND.name}`,
  titleLines: ["The Academy of", "the New Economy"],
  positioning: BRAND.descriptor,
  beats: "Learn the knowledge. Master the skill. Apply the knowledge. Create economic value.",
} as const

/** §1 */
export const PURPOSE =
  "To equip people with knowledge that has utility, develop that knowledge into mastery through structured learning and application, and help them use their mastery to transform their personal financial capacity."
export const COMBINES = [
  "Structured learning programs", "Live cohort-based learning", "Practical skills development",
  "Faculty members and expert instructors", "Mentorship", "Assignments and assessments",
  "Projects and application", "Communities", "Certifications", "Career and income pathways",
  "A digital marketplace for additional knowledge products",
] as const
export const WEALTH_LIQUEFACTION = [
  "Knowledge", "Application", "Mastery", "Skills", "Economic Value", "Financial Transformation",
] as const

/** §2 */
export const WEALTH_LIQUEFACTION_DEFINITION =
  "Wealth Liquefaction is the process of transforming knowledge, skills, ideas, assets, opportunities and innovation into economic value and ultimately into financial capacity."
export const VALUE_LINE = "We teach people how to turn knowledge into economic value."

/** §3, §4 */
export const VISION =
  "To build the world's most impactful institution for developing people who can create, capture and multiply economic value in the new economy."
export const MISSION =
  "To equip individuals with relevant knowledge, practical skills, innovative thinking and access to economic opportunities that enable them to transform their personal economy."
export const GAPS = [
  { title: "The Knowledge Gap", body: "People don't know what they need to know." },
  { title: "The Mastery Gap", body: "People may know something but cannot apply it effectively." },
  { title: "The Opportunity Gap", body: "People may have knowledge and skills but lack pathways to monetize them." },
] as const

/** §5 */
export const JOURNEY = [
  { name: "Discover", body: "The learner discovers a field, skill or economic opportunity." },
  { name: "Learn", body: "The learner acquires foundational knowledge." },
  { name: "Master", body: "The learner develops competence through structured practice, mentorship and assessment." },
  { name: "Apply", body: "The learner applies the knowledge to real-world problems, projects or opportunities." },
  {
    name: "Liquidate",
    body: "The learner learns how to convert the acquired capability into economic value. This is where the concept of wealth liquefaction becomes central.",
  },
] as const
export const JOURNEY_EXAMPLES = [
  ["Learn graphic design", "Master graphic design", "Build portfolio", "Acquire clients", "Generate income"],
  ["Learn AI", "Build AI solutions", "Solve business problems", "Create products/services", "Generate economic value"],
] as const

/** §6 — the Opportunity Hub has no description yet (D18): no body, no link. */
export type World = { key: "academy" | "marketplace" | "opportunity-hub"; name: string; body: string | null; href: string | null }
export const WORLDS: readonly World[] = [
  {
    key: "academy",
    name: "The Academy",
    body: "This is the institutional learning environment. Schools, Programs, Faculty, Cohorts, Live classes, Assessments, Assignments, Mentorship, Certifications, Student communities and Projects. This is the premium, structured academic side.",
    href: "/schools",
  },
  {
    key: "marketplace",
    name: "The Academy Marketplace",
    body: "This is the open knowledge marketplace. External educators, experts and creators can submit courses. They do not automatically become WMA faculty.",
    href: "/marketplace",
  },
  { key: "opportunity-hub", name: "The Opportunity Hub", body: null, href: null },
]

/** §20, §21 */
export const ECOSYSTEM =
  "The Academy is the institution; the Marketplace is the knowledge-commerce layer; the student dashboard is the campus; the schools are the academic divisions; the faculty are the educators; cohorts are the academic sessions; and the mastery-to-economic-value framework is the philosophy that ties everything together."
export const CORE_TRANSFORMATION = [
  "Knowledge", "Skill", "Mastery", "Application", "Value Creation", "Economic Opportunity", "Financial Transformation",
] as const
export const CORE_PROPOSITION =
  "The ultimate proposition is that WMA should help people move from knowing to doing, and from doing to creating value."

/** §22, §23 — competitor names never print (ruling 5). */
export const DEFINITION = SITE_DESCRIPTION
export const ACADEMY_LINE = "WMA is the Academy of the New Economy."
export const BIGGER_VISION = {
  contrast: "Most learning platforms answer: “What course do you want to buy?”",
  question: "Who do you want to become, what do you need to master, and how can that mastery create value in the new economy?",
} as const
```

- [ ] **Step 4: Typecheck and lint.**
  Run: `npx tsc --noEmit && npx eslint lib/brand.ts lib/institution.ts`
  Expected: no errors (ignore the one stale `.next/types` error).

- [ ] **Step 5: The tagline consumers still render.** Start the verification server.
  Run: `text / | grep -o "The Academy of the New Economy" | head -1` (the footer prints `BRAND.tagline`).
  Expected: one line.
  Then open `$BASE/opengraph-image` in the browser and check that the new tagline sits inside the card, unclipped.

- [ ] **Step 6: Commit.**

```bash
git add lib/brand.ts lib/institution.ts
git commit -m "feat(brand): the Academy of the New Economy — one home for the institutional blueprint's words"
```

---

### Task 2: The §18 hero

**Files:**
- Modify: `components/marketing/hero-copy.tsx`, `components/marketing/hero-wall.tsx`, `components/marketing/landing.tsx`

**Interfaces:**
- Consumes: `HERO` (Task 1); `cohortIsUpcoming` from `lib/cohort.ts`.
- Produces: `HeroWall` gains a required prop `cohortOpen: boolean`.

- [ ] **Step 1: Check first.**
  Run: `text / | grep -c "Explore the Academy"`
  Expected: `0`.

- [ ] **Step 2: `hero-copy.tsx`.**
  - In `headLines`, the no-school branch returns `HERO.titleLines` as two `Line`s, the second with `className: "text-ws-gold"`.
  - In `eyebrow`, the no-school branch returns `HERO.eyebrow`.
  - `DEFAULT_SUB` becomes `HERO.positioning`, followed by `HERO.beats` in a `<span className="mt-2 block font-medium text-ws-primary max-sm:hidden">`. Phones show only the positioning sentence; keep the comment's reason (it brings the gold CTA onto the first screen).
  - Update the comment on `H1_DEFAULT` that measures "Own Your Future.", so it names "the New Economy" instead.

- [ ] **Step 3: `hero-wall.tsx`.**
  - `const cta = school ? \`Explore the ${school.name}\` : "Explore the Academy"`. Its default `href` becomes `"/schools"`, which was `"/programs"`.
  - The secondary CTA: when `cohortOpen`, render one link `href="/#cohort"` labelled "Join the upcoming cohort", for guests and signed-in visitors alike, using the same motion element and `secondary` class as today. Otherwise keep the two existing "Start learning" branches unchanged.
  - Update the component comment that describes the CTAs.

- [ ] **Step 4: `landing.tsx`.** Import `cohortIsUpcoming` from `@/lib/cohort` and pass `cohortOpen={cohortIsUpcoming()}` to `HeroWall`. Change the hero comment to cite "institutional blueprint §18".

- [ ] **Step 5: Verify, with a future cohort.**
  Run: `text / | grep -oE "Welcome to WorldStreet Mastery Academy|The Academy of the New Economy|premier institution for skills, innovation and wealth liquefaction|Create economic value|Explore the Academy|Join the upcoming cohort" | sort -u`
  Expected: all six phrases.
  Run: `text / | grep -c "Own Your Future"`
  Expected: `0`.

- [ ] **Step 6: Verify, with the cohort already started.** Restart the server without the two cohort variables.
  Run: `text / | grep -c "Join the upcoming cohort"; curl -s $BASE/ | grep -c 'href="/#cohort"'`
  Expected: `0` and `0`.
  Run: `text / | grep -c "Start learning"`
  Expected: at least `1`.

- [ ] **Step 7: Look at it.**
  - At 1440, 390 and 320 px, as a guest and as `student`: the claim holds two lines, "the New Economy" never breaks, and there is no horizontal scroll (`document.documentElement.scrollWidth <= innerWidth`).
  - If "the New Economy" breaks at 320 px, lower the phone size in `H1_DEFAULT` (`min(9.6vw,2.75rem)`) one step at a time until it holds.
  - Choosing a school chip still reshapes the CTA to "Explore the School of …".

- [ ] **Step 8: Lint and commit.**

```bash
npx eslint components/marketing/hero-copy.tsx components/marketing/hero-wall.tsx components/marketing/landing.tsx
git add components/marketing/hero-copy.tsx components/marketing/hero-wall.tsx components/marketing/landing.tsx
git commit -m "feat(landing): the institutional blueprint's hero — Welcome to WMA, the Academy of the New Economy"
```

---

### Task 3: The §18 cohort section

**Files:**
- Modify: `lib/cohort.ts`, `components/marketing/cohort-banner.tsx`

**Interfaces:**
- Produces:
  - `COHORT_NUMBER: number`: from `NEXT_PUBLIC_COHORT_NUMBER`, a whole number ≥ 1. Anything else falls back to `1`.
  - `COHORT_NAME: string`: `` `Cohort ${String(COHORT_NUMBER).padStart(3, "0")}` ``.
  - The band's root gets `id="cohort"`.

- [ ] **Step 1: Check first** (future cohort, number 2).
  Run: `text / | grep -c "Cohort 002"`
  Expected: `0`.

- [ ] **Step 2: `lib/cohort.ts`.** Add `COHORT_NUMBER` and `COHORT_NAME` beside the start date. Extend the header comment: the variable is build-time like the date, and Phase 12 replaces both with data.

- [ ] **Step 3: `cohort-banner.tsx`.**
  - **Band.** The section gets `id="cohort"` and `scroll-mt-24`. The heading becomes `` `${COHORT_NAME} — Starts ${COHORT_DATE_LABEL}` ``; the live eyebrow and the body stay. The actions become, in order: an outline "Explore Programs" → `/programs`, then the gold "Join Cohort" → `/schools` (was "Choose your school" / "How it works").
  - **Bar.** The text names the cohort, `` `${COHORT_NAME} starts ${COHORT_DATE_SHORT}` ``, and keeps its short phone variant.
  - **Strip.** The headline names the cohort the same way.
  - Update the component comment to cite institutional blueprint §18.

- [ ] **Step 4: Verify.**
  Run: `text / | grep -oE "Cohort 002 — Starts [A-Za-z]+ [0-9]+ [A-Za-z]+|Explore Programs|Join Cohort" | sort -u`
  Expected: `Cohort 002 — Starts Monday 16 November`, `Explore Programs` and `Join Cohort`.
  Run: `curl -s $BASE/ | grep -c 'id="cohort"'`
  Expected: `1`.
  Clicking the hero's "Join the upcoming cohort" scrolls to the band, whose heading clears the navbar.

- [ ] **Step 5: Look at it.** At 360 px the bar is one line. At 320 px the band heading wraps cleanly and the two buttons stack full-width. With the cohort already started (restart without the variables), `text / | grep -c "Cohort 00"` prints `0`.

- [ ] **Step 6: Lint and commit.**

```bash
npx eslint lib/cohort.ts components/marketing/cohort-banner.tsx
git add lib/cohort.ts components/marketing/cohort-banner.tsx
git commit -m "feat(cohort): the cohort section names its cohort — Explore Programs / Join Cohort"
```

---

### Task 4: The landing tells the institution's story

**Files:**
- Modify: `components/marketing/about-band.tsx`, `components/marketing/institution-band.tsx`, `components/marketing/reviews-finale.tsx`, `components/marketing/landing.tsx`
- Create: `components/marketing/worlds-band.tsx`

**Interfaces:**
- Consumes: `PURPOSE`, `COMBINES`, `WEALTH_LIQUEFACTION`, `WEALTH_LIQUEFACTION_DEFINITION`, `VALUE_LINE`, `MISSION`, `GAPS`, `WORLDS`, `BIGGER_VISION`, `ACADEMY_LINE` (Task 1).
- Produces: `WorldsBand({ className?: string })`, a server component used by the landing and by `/academy` (Task 5).

- [ ] **Step 1: Check first.**
  Run: `text / | grep -oE "Wealth Liquefaction|The Mastery Gap|The Opportunity Hub|point A to point B" | sort -u`
  Expected: only `point A to point B`.

- [ ] **Step 2: `about-band.tsx` becomes §1–§2.**
  - **Label column:** `SectionLabel` "Our philosophy", then the `h2` "Wealth Liquefaction".
  - **Statement:** "Our purpose is simple:", then `LitStatement` with `PURPOSE` (the scroll-lit treatment stays).
  - **Arc:** `ARC` becomes `WEALTH_LIQUEFACTION`, six stops with the last one gold. The `aria-label` becomes "Wealth Liquefaction, from knowledge to financial transformation". Phones keep the two-column grid (three rows).
  - **Body:** the left column holds `WEALTH_LIQUEFACTION_DEFINITION` and then `VALUE_LINE` in `font-semibold text-ws-primary`. The right column holds "This Academy is not simply an online course platform. It is designed to function as a modern institution of learning, combining:" followed by `COMBINES` as a compact two-column list. The link "Explore the schools" → `/schools` becomes "About the Academy" → `/academy`.
  - Rewrite the component comment around the new copy. Keep the motion notes.

- [ ] **Step 3: `institution-band.tsx` becomes §4** (ruling 4).
  - `SectionLabel` becomes "Our mission". The title becomes "The Academy exists to close three major gaps.", with one paragraph, `MISSION`, under it.
  - `POINTS` becomes `GAPS`.
  - Replace the comment's 2026-10-03 framing with a §4 citation, and record in it that §4 superseded the "point A to point B" text.

- [ ] **Step 4: Create `worlds-band.tsx` (§6).** It's a server component in the landing's section rhythm, the same grammar as `InstitutionBand`: `SectionLabel` "The three worlds", `SectionTitle` "The Academy has three major worlds", and three cards built from `WORLDS`.
  - A world with an `href` is one link: name, body, and an arrow (`ArrowRightIcon`).
  - The Opportunity Hub is a muted card: the name and a "Coming soon" chip, not a link, with no invented body.
  - Cards are `rounded-[20px]`, tokens only, stacking on phones.
  - In `landing.tsx`, mount `<WorldsBand />` after `<HowItWorks />`, and add it to the landing's doc comment in order.

- [ ] **Step 5: `reviews-finale.tsx`, the §23 close.** Replace the paragraph that begins `Welcome to {BRAND.name}.{" "}` (the one holding "Learn Skills. Build Value. Create Your Future.") with `BIGGER_VISION.question`, followed by `ACADEMY_LINE` in `font-semibold text-ws-primary`. The gold button's "Explore programs" becomes "Explore the Academy" (same `/schools`). Leave the rest of the finale alone.

- [ ] **Step 6: Verify.**
  Run: `text / | grep -oE "Wealth Liquefaction|We teach people how to turn knowledge into economic value|The Knowledge Gap|The Mastery Gap|The Opportunity Gap|The Academy Marketplace|The Opportunity Hub|Coming soon|WMA is the Academy of the New Economy|Who do you want to become" | sort -u`
  Expected: all ten.
  Run: `text / | grep -cE "point A to point B|Create Your Future|Udemy|Coursera"`
  Expected: `0`.
  Then, in the browser:
  - With reduced motion emulated, the purpose statement is fully lit and the six-stop arc sits still.
  - At 390 px, no horizontal scroll.
  - Tabbing through `WorldsBand` stops on The Academy and the Marketplace only. The Opportunity Hub card is not wrapped in an `<a>` (inspect it).

- [ ] **Step 7: Lint and commit.**

```bash
npx eslint components/marketing/about-band.tsx components/marketing/institution-band.tsx components/marketing/worlds-band.tsx components/marketing/reviews-finale.tsx components/marketing/landing.tsx
git add components/marketing/about-band.tsx components/marketing/institution-band.tsx components/marketing/worlds-band.tsx components/marketing/reviews-finale.tsx components/marketing/landing.tsx
git commit -m "feat(landing): Wealth Liquefaction, the three gaps, the three worlds and the bigger vision"
```

---

### Task 5: `/academy` — the institution, in the blueprint's order

**Files:**
- Create: `app/(marketing)/academy/page.tsx`, `components/academy/chain.tsx`
- Modify: `app/sitemap.ts`

**Interfaces:**
- Consumes: everything in `lib/institution.ts`; `WorldsBand` (Task 4); `SectionLabel`, `SectionTitle` (`components/marketing/section-heading.tsx`); `Reveal`, `RevealGroup`.
- Produces: `Chain({ steps, label, className? }: { steps: readonly string[]; label: string; className?: string })`. It's a server `<ol aria-label={label}>` with hairline connectors from `sm`, two columns on phones, and the last step `text-ws-gold`.

- [ ] **Step 1: Check first.**
  Run: `curl -s -o /dev/null -w "%{http_code}\n" $BASE/academy`
  Expected: `404`.

- [ ] **Step 2: Create `components/academy/chain.tsx`** per its interface. It is a static server component.

- [ ] **Step 3: Create `app/(marketing)/academy/page.tsx`.** `export const metadata` has title "The Academy", description `BRAND.descriptor` and `alternates: { canonical: appUrl("/academy") }`.
  Sections in the document's order, each with an `id`:
  1. **Hero.** Eyebrow `BRAND.name`; `h1` `BRAND.tagline`; lede `DEFINITION`.
  2. `#big-idea`, "The big idea": `PURPOSE` as a blockquote, then the "not simply an online course platform … combining:" sentence and `COMBINES`.
  3. `#wealth-liquefaction`: `<Chain steps={WEALTH_LIQUEFACTION} label="Wealth Liquefaction" />`, `WEALTH_LIQUEFACTION_DEFINITION`, `VALUE_LINE`.
  4. `#vision`: `VISION`. `#mission`: `MISSION`, then `GAPS` as three cards.
  5. `#journey`, "The 5-stage Mastery Journey": `JOURNEY` as five numbered stages ("Stage 1 — Discover" …), then the two `JOURNEY_EXAMPLES` as `Chain`s labelled "Example".
  6. `#worlds`: `<WorldsBand />`.
  7. `#ecosystem`: `ECOSYSTEM`.
  8. `#transformation`, "The core transformation": `<Chain steps={CORE_TRANSFORMATION} … />`, then `CORE_PROPOSITION`.
  9. **Close.** `BIGGER_VISION.contrast`, `BIGGER_VISION.question` (display size), `ACADEMY_LINE`. Then a gold "Explore the Academy" → `/schools` and an outline "Become a WMA Instructor" → `/teach`.

  It is a server page, uses the marketing layout's chrome, and has no data fetch.

- [ ] **Step 4: `app/sitemap.ts`.** Add `{ url: appUrl("/academy") }` right after the home entry.

- [ ] **Step 5: Verify.**
  Run: `curl -s -o /dev/null -w "%{http_code}\n" $BASE/academy`
  Expected: `200`.
  Run: `text /academy | grep -oE "The big idea|Wealth Liquefaction|world's most impactful institution|The Mastery Gap|Stage 5 — Liquidate|Generate income|The Opportunity Hub|knowledge-commerce layer|Value Creation|from knowing to doing|Who do you want to become" | sort -u`
  Expected: all eleven.
  Run: `text /academy | grep -cE "Udemy|Coursera"`
  Expected: `0`.
  Run: `curl -s $BASE/academy | grep -o '<link rel="canonical"[^>]*>'; curl -s $BASE/sitemap.xml | grep -c "/academy<"`
  Expected: a canonical ending in `/academy`, and `1`.

- [ ] **Step 6: Look at it.** In dark and light themes, at 1440, 390 and 320 px: no horizontal scroll, every chain wraps cleanly, the "Coming soon" card is legible, and the headings run in order (`h1` → `h2`). With reduced motion, everything is visible and still.

- [ ] **Step 7: Lint and commit.**

```bash
npx eslint "app/(marketing)/academy/page.tsx" components/academy/chain.tsx app/sitemap.ts
git add "app/(marketing)/academy/page.tsx" components/academy/chain.tsx app/sitemap.ts
git commit -m "feat(academy): /academy — the big idea, vision, mission, the journey and the three worlds"
```

---

### Task 6: Plans, not packages (D19)

**Files:**
- Modify: every file the inventory below lists. Expect `components/programs/*`, `components/checkout/*`, `app/(checkout)/**`, `components/dashboard/*`, `app/(platform)/dashboard/**`, `components/instructor/package-editor.tsx`, `components/instructor/course-editor.tsx`, `app/(admin)/admin/enrollments/**`, `lib/email.tsx`, `lib/vivid/prompt.ts`, and user-facing error strings in `lib/actions/*.ts`.

**Interfaces:** none (strings only).

- [ ] **Step 1: Inventory.** Write every hit to the scratchpad and classify each as *user-facing* (JSX text, a string literal that renders or is emailed, spoken by Vivid, or returned as `error`) or *code* (identifier, key, enum value, field, import, comment, log).

```bash
grep -rnE '"[^"]*\b[Pp]ackages?\b[^"]*"|`[^`]*\b[Pp]ackages?\b[^`]*`|>[^<{]*\b[Pp]ackages?\b' app components lib --include=*.ts --include=*.tsx > "$SCRATCH/package-hits.txt"; wc -l "$SCRATCH/package-hits.txt"
```

- [ ] **Step 2: Change the user-facing hits.** "package" → "plan" and "packages" → "plans", keeping case and grammar ("Choose your package" → "Choose your plan", "Package" column → "Plan", "Packages" editor section → "Plans", "your package doesn't include …" → "your plan doesn't include …"). Code hits stay exactly as they are (ruling 7).

- [ ] **Step 3: Re-run the inventory.** Every remaining hit must be classified *code*. Paste the remaining list into the task report.

- [ ] **Step 4: Typecheck and lint the changed files.**
  Run: `npx tsc --noEmit` and `npx eslint <each changed file>`.
  Expected: clean.

- [ ] **Step 5: Drive it.**
  Run: `text /programs/forex-trading-mastery | grep -ciE "\bpackages?\b"`
  Expected: `0`.
  Then, signed in as `student`, open a checkout URL from that page (`text "/dashboard/checkout?courseId=<id>&package=standard" student | grep -ciE "\bpackages?\b"`, expected `0`; the `package=` query key is code and stays). As `instructor`, open a program in the course editor and see the "Plans" section. As `admin`, open `/admin/enrollments` and see the "Plan" column.

- [ ] **Step 6: Commit.**

```bash
git add -A app components lib
git commit -m "chore(copy): plans, not packages — the institutional blueprint's word, UI text only"
```

---

### Task 7: Marketplace Creators, programs, Become a WMA Instructor (D19)

**Files:**
- Modify (expected, confirm with the inventory):
  - `app/(marketing)/marketplace/page.tsx`, `app/(marketing)/sell/page.tsx`, `components/sell/seller-apply-panel.tsx`, `components/marketplace/*` (the filters)
  - `components/marketing/navbar.tsx` and `mobile-nav.tsx` ("Seller area")
  - `components/instructor/instructor-sidebar.tsx` (seller variant)
  - `app/(admin)/admin/sellers/page.tsx`, `components/admin/admin-sidebar.tsx`, `components/admin/bottom-nav.tsx`
  - the seller emails in `lib/email.tsx`
  - `app/(marketing)/programs/page.tsx`, `components/marketing/faq.tsx`, `components/marketing/upcoming-drops.tsx`, `components/schools-index/model.ts`
  - `components/marketing/footer.tsx`, `app/(marketing)/teach/page.tsx`, `components/platform/app-sidebar.tsx` (the "Teach on Academy" card), `app/(platform)/dashboard/become-instructor/page.tsx`

**Interfaces:** none (strings only).

- [ ] **Step 1: Inventory.**

```bash
grep -rnE '"[^"]*\b[Ss]ellers?\b[^"]*"|>[^<{]*\b[Ss]ellers?\b' app components lib --include=*.ts --include=*.tsx > "$SCRATCH/seller-hits.txt"
grep -rnE 'Become an [Ii]nstructor|Teach on Academy|Apply to teach' app components lib > "$SCRATCH/instructor-cta-hits.txt"
grep -rnE '"[^"]*\b[Cc]ourses?\b[^"]*"|>[^<{]*\b[Cc]ourses?\b' "app/(marketing)" components/marketing components/schools components/schools-index components/programs > "$SCRATCH/course-hits.txt"
```

- [ ] **Step 2: Sellers.** In user-facing strings, "seller" → "Marketplace Creator" and "sellers" → "Marketplace Creators". "Seller area" → "Creator area". The admin nav item "Sellers" → "Marketplace Creators". Routes (`/admin/sellers`, `/dashboard/sell/apply`), `sellerStatus` and every identifier stay.

- [ ] **Step 3: Become a WMA Instructor (§16).** The footer's "Become an Instructor", `/teach`'s two gold "Apply to teach" buttons, the student sidebar card "Teach on Academy" and the `h1` of `/dashboard/become-instructor` all read **"Become a WMA Instructor"**. Hrefs are unchanged.

- [ ] **Step 4: Programs.** Where a public string names an Academy offering, "course" → "program" (for example `upcoming-drops.tsx` "View course →" → "View program →"). Leave every Marketplace and New Economy string as "course" (ruling 7), and leave "Create a Course" / "Sell your course" in the footer, which name the creator's action.

- [ ] **Step 5: Re-run the inventories.** Every remaining hit is either code or a Marketplace / New Economy "course". Paste the remainder into the report.

- [ ] **Step 6: Verify.**
  Run: `text /sell | grep -ciE "\bsellers?\b"` and `text /marketplace | grep -ciE "\bsellers?\b"`
  Expected: `0` and `0`.
  Run: `text / | grep -c "Become a WMA Instructor"; text /teach | grep -c "Become a WMA Instructor"`
  Expected: `≥ 1` each.
  As `admin`, the sidebar reads "Marketplace Creators" and `/admin/sellers` still opens. Run `npx tsc --noEmit` and lint the changed files.

- [ ] **Step 7: Commit.**

```bash
git add -A app components lib
git commit -m "chore(copy): Marketplace Creators, Academy programs and Become a WMA Instructor"
```

---

### Task 8: Reach `/academy`; docs; the closing run

**Files:**
- Modify: `components/marketing/navbar.tsx`, `components/marketing/mobile-nav.tsx` (if it holds its own list), `components/marketing/footer.tsx`, `docs/institutional-blueprint-plan.md`, `docs/mastery-academy-plan.md`, `context.md`

**Interfaces:** none.

- [ ] **Step 1: Navigation.**
  - Navbar (lg and up): "The Academy" → `/academy`, before "Programs".
  - Mobile sheet: `{ href: "/academy", label: "The Academy" }` first in the list.
  - Footer Academy column: "About the Academy" → `/academy`, first. Use the existing link classes.

- [ ] **Step 2: Docs.**
  - Tick Phase 11's exit criteria in `docs/institutional-blueprint-plan.md`, and set its status-board row to done, with the date and commit count.
  - Update Phase 11's row in the status board of `docs/mastery-academy-plan.md` to match.
  - Add a dated entry to `context.md`: the tagline change, the new `/academy`, plans not packages, and the §4 replacement of "Who we are".

- [ ] **Step 3: The closing run.**
  - Start the verification server with a future cohort.
  - At 1440, 390 and 320 px, in dark and light, as `guest` and `student`, check `/`, `/academy`, `/schools`, `/programs/forex-trading-mastery`, `/teach`, `/sell` and `/marketplace`: no horizontal scroll, no console errors apart from the known Vivid 403, and the navbar reaches `/academy`.
  - Restart without the cohort variables and repeat the Task 2, step 6 checks.

- [ ] **Step 4: Whole-repo checks.**
  Run: `pnpm lint` and `npx tsc --noEmit`
  Expected: no new lint errors against the count before Task 1 (record both numbers); tsc clean.

- [ ] **Step 5: Commit.**

```bash
git add components/marketing/navbar.tsx components/marketing/mobile-nav.tsx components/marketing/footer.tsx docs/institutional-blueprint-plan.md docs/mastery-academy-plan.md context.md
git commit -m "feat(nav): The Academy in the navbar and footer; Phase 11 docs"
```

## Report (end of phase)

Read out the Phase 11 exit criteria from `docs/institutional-blueprint-plan.md`, and add:
- the copy §4 replaced (ruling 4);
- the remaining "package", "seller" and "course" hits, with their classification;
- the `H1_DEFAULT` phone size, if it changed;
- a reminder for the owner: production shows the cohort band and "Join the upcoming cohort" only once a future cohort is configured. Until Phase 12 that means setting `NEXT_PUBLIC_COHORT_STARTS_AT` and `NEXT_PUBLIC_COHORT_NUMBER` as build variables in Coolify.
