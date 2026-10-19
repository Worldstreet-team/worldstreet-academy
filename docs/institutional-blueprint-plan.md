# WorldStreet Mastery Academy — Institutional Blueprint Implementation Plan (Phases 10–20)

**Date:** 2026-10-19 · **Status:** BUILT, NOT RELEASED — Phases 11–21 are merged on `feat/institutional`, the final fix round is in progress on `fix/final-review`, and nothing has been pushed. Phase 10, the production release, is the owner's step. Owner, 2026-10-19: "we need all these in the document implemented and we will need super admin and admin level people asap". Every phase runs; D21–D23 answered yes; D25 and D30 built on their defaults (Phase 21 added for super admin) · **Integration branch:** `feat/institutional` (off `feat/cohort-launch`) · **Spec:** `docs/institutional-blueprint.md` (cited "institutional blueprint §N", shortened to "§N" in this file)
**Builds on:** `feat/cohort-launch` @ `3ceca71`, which is 67 commits ahead of production `main` (`52bcf8f`). **Predecessor:** `docs/mastery-academy-plan.md` (Phases 0–9, decisions D1–D15). Its hard constraints (§0.3 there) still bind every phase here, and phase numbers continue from it. Nothing is renumbered.

> **How to drive this plan.** Say **"start phase N"**. The executor reads this file and the spec, cuts `mastery/phase-N` from the current release tip (never from a `main` that doesn't yet hold `feat/cohort-launch`), writes or refreshes `docs/plans/mastery-phase-N.md` (bite-sized tasks, superpowers:writing-plans), runs it with superpowers:subagent-driven-development, and reports against the phase's **Exit criteria**. A phase marked ⛔ waits for the owner's answer to the decision it names (§2). Every other phase proceeds on the bold defaults unless the owner overrules them. Phase 11's task plan is already written: `docs/plans/mastery-phase-11.md`.

---

## 0. Where we stand (2026-10-19)

1. **Production is a month behind.** `academy.worldstreetgold.com` still serves `main` at `52bcf8f` (21 Sep). Everything from the 3 October meeting onward is unreleased on `feat/cohort-launch`:
   - Payment: the three plans with struck prices and the offer timer, ESPEE proof-of-payment, and the no-dashboard-without-paying gate.
   - Cohort: the countdown.
   - Marketplace, referrals and the New Economy courses, plus `/teach`, `/sell` and `/new-economy`.
   - Teaching: recordings, points and leaderboards, class communities, the tutor home and calendar, and the whiteboard.
   - The WorldStreet design-system migration.

   That branch already covers much of §9, §10, §11, §15, §16 and §17, but no learner can see any of it.
2. **Cohort 001 starts today.** `lib/cohort.ts` defaults the start to `2026-10-19T00:00:00+01:00`. Since midnight Lagos time, every cohort banner and strip, and the plans' "Offer ends in" timer, renders nothing. The discounted prices stay, because they are stored on the packages; only the timer goes.
3. **The production catalogue is still the old one.** `scripts/mastery-catalogue.mjs --apply` has never run there, so programs are single-price under legacy titles, plus two programs outside the catalogue.
4. **This blueprint disagrees with the build in four places:** 7 schools against our 8; about 44 program names against our 12; a Basic plan that includes recordings, assignments, assessments and a certificate, where ours grants none of them; and Basic at 4 weeks and Standard at 8–12 weeks, against "9 weeks". These are owner decisions (§2), not build tasks.

5. **Update, 2026-10-19 (end of day): built, not released.** Phases 11–21 are built, reviewed task by task, and merged into `feat/institutional`. A runtime QA pass on the integrated branch (dev-mock, local DB, about 70 routes as guest, student, instructor and admin, at 1280 and 390) found no blockers and no majors. The final whole-branch review found 0 Critical and 4 Important; they are being fixed on `fix/final-review`: a live file swap with no review, going back to draft keeping the approval, the Go note for file products becoming a REQUIRED patch, and the faculty Mastery Score filter. Nothing has been pushed. Phase 10 (the production release) is the owner's step. Exit criteria below are ticked only where a local run or a phase ledger verifies them, marked "(verified locally)"; anything needing production, the owner, or a real email send stays open and says what remains.

---

## 1. Coverage — the blueprint, section by section

| § | It asks for | Built today (`feat/cohort-launch`) | Gap | Phase |
|---|---|---|---|---|
| 1 | Purpose, the "not just a course platform" list, the Wealth Liquefaction chain | — | All of it | 11 |
| 2 | Name, "The Academy of the New Economy", positioning, Wealth Liquefaction defined | Name ✓; the positioning sentence sits unused in `BRAND.descriptor` | The descriptor as the tagline; the definition; "We teach people how to turn knowledge into economic value." | 11 |
| 3 | Vision | — | Copy | 11 |
| 4 | Mission, three gaps | — | Copy | 11 |
| 5 | The 5-stage Mastery Journey | — | Copy | 11 |
| 6 | Three worlds: Academy, Marketplace, Opportunity Hub | Academy (`/schools`, `/programs`), Marketplace (`/marketplace`) | Never shown as a set; the Opportunity Hub has no description (D18) | 11 |
| 7 | 7 schools, about 44 program names | 8 schools, 12 programs | The taxonomy switch and study areas | 13 ⛔ |
| 8 | School page: overview, learn, who, careers, programs, faculty, cohorts, pathways | Hero/intro, "What you'll learn here" (derived), Available programs, Suggested path, Faculty (switched off), one global cohort strip | Who it's for, Career/economic applications, Upcoming cohorts per school, real overviews | 12, 13 |
| 9 | Basic/Standard/Executive, names, prices, durations, inclusions | Three plans per program with struck price and timer (script, not applied in production); Standard and Executive "9 weeks"; Basic entitles nothing | Basic's inclusions, durations, plan names, a recordings entitlement | 10, 14 ⛔ |
| 10 | Visitor → plan → pay → confirmed → welcome email + credentials → portal | School → program → plan → checkout; wallet and ESPEE; confirmation email with a sign-in line; the gate | A welcome email; signed-out checkout loses its return URL | 10, 15 |
| 11 | Portal: welcome, progress, next class, inbox, messages, courses, classes, recordings, assignments, assessments, points, communities | Welcome, progress, next class, messages, My programs, Meetings, Recordings, Assignments (assessments mixed in), Points | Inbox in the nav, "My classes", an Assessments page, a Communities page | 15 |
| 12 | Mastery Score | Points (lesson 10, submission 20, grade ÷ 5, final 50, completion 200) | The score, attendance capture, projects | 16 |
| 13 | Completion, Certified Practitioner, Mastery Certification; published requirements | One certificate (`WSA-` IDs, `/verify`) | Tiers, a requirements page | 17 ⛔ |
| 14 | Program, school, academy communities | An external link per program; one env link as a fallback | School, academy and executive links; a page | 15 |
| 15 | Partner code, link, clicks, enrollments, revenue, commissions, dashboard | Codes, `?ref=` links, "Who invited you?", 10% of the first paid purchase, `/dashboard/referrals` | The name, click tracking, revenue, faculty entry, admin view | 18 |
| 16 | Become a WMA Instructor pipeline; faculty dashboard | Apply, review, interview (slots, scorecard), approve, onboarding checklist; tutor home, calendar, assignments, materials, meetings | Teaching demonstration, handbook (standards, curriculum, training), faculty credential, My Students, Student Performance, earnings page, WMA Partners entry | 11, 18, 19 |
| 17 | Creators selling courses, masterclasses, workshops, templates, guides; staged QC | Approved sellers, one-pass review, 85% / 50% split, `/marketplace` | Formats, staged checks, "Marketplace Creators" | 11, 20 (⛔ file products) |
| 18 | Hero copy and CTAs; "COHORT 001 — Starts October 19" with countdown and CTAs | Slideshow hero with the old claim; a cohort band with countdown (hidden from today) | Copy, CTAs, the cohort number | 11, 12 |
| 19 | Institutional vocabulary | Schools, Programs, Cohort in use | A narrow pass (D19) | 11, 12, 15, 17 |
| 20 | The ecosystem framing | — | Copy | 11 |
| 21 | The core transformation chain | — | Copy | 11 |
| 22 | The one-sentence definition | — | Copy and meta description | 11 |
| 23 | "Who do you want to become…" | — | Copy | 11 |

## 2. Owner decisions (D16–D31)

**Answered 2026-10-19:**
- D21 (seven schools), D22 (study areas) and D23 (Basic per the blueprint, signal group kept): **yes, as proposed**.
- D25 (certificate tiers): no answer, but the owner said "all these in the document implemented". Built on the proposed thresholds, which are named constants, so they can be tuned.
- D30: templates and guides are **built**, in Phase 20.
- The ⛔ marks below are historical.

Defaults are in bold. ⛔ means the phase waits for an explicit answer. That applies to every change to schools or to what a plan includes, because those touch live data and paid access. The other decisions proceed on the default unless overruled.

| # | Question | Default | Phase |
|---|---|---|---|
| D16 | Short name and tagline | **"WMA"** in copy (the document says WMA 14 times and WSMA twice). **`BRAND.tagline` = "The Academy of the New Economy"** (§2). "Learn Skills. Build Value. Own Your Future." and the finale's "…Create Your Future." retire. The lockup (WorldStreet + MASTERY ACADEMY) and the certificate prefix `WSA-` stay: issued IDs and verify links depend on the prefix. | 11 |
| D17 | Two transformation chains (§1 has 6 steps, §21 has 7) | **The landing shows §1's chain under "Wealth Liquefaction". `/academy` shows both, each in its own section, as the document does.** | 11 |
| D18 | The Opportunity Hub (§6 is empty) | **Show three worlds; the Hub reads "Coming soon", with no link and no route,** until product describes it. Nothing else about it is planned. | 11 |
| D19 | Institutional vocabulary (§19) | The document itself still says instructor, tutor and course (§9, §11, §16), so this is **a narrow pass of UI text only, never identifiers or routes**: Academy offerings are *programs* (Marketplace and New Economy items stay *courses*); *package* → **plan** in every user-facing string (§9; Bason's word too); *seller* → **Marketplace Creator**; "Become an Instructor" → **Become a WMA Instructor**; the dashboard is the **Campus** (eyebrow only; the nav keeps "Dashboard"); **Academic Calendar** = the public cohort calendar; **Alumni** = learners holding a certificate. "Scholars" is **not used** until it has a meaning (it usually implies a scholarship). | 11, 12, 15, 17 |
| D20 | Cohorts as data | **A `Cohort` collection (number, name, start, optional end), academy-wide, managed at `/admin/cohorts`.** Cohort 001 = 19 Oct 2026. An enrollment's cohort is **derived from its enrolment date** (the first cohort starting on or after `enrolledAt`, else the latest started one), so the money path writes nothing new. The offer timer counts down to the next cohort (owner rule, 2026-10-05). With no future cohort, cohort surfaces hide, as today. **The owner supplies Cohort 002's date** (content, not a blocker). | 12 |
| D21 ⛔ | Switch to the seven schools (§7)? | **Yes.** `trading-financial-markets` keeps its slug. `ai-automation`, `software-app-development`, `cybersecurity` and `data-analytics` → **Technology & Artificial Intelligence** (`technology-ai`). `digital-business-remote-careers` → **Digital Business** (`digital-business`). `digital-media-creative` → **Creative Economy** (`creative-economy`). `blockchain-web3` → **Emerging Technologies** (`emerging-technologies`). New: **Entrepreneurship & Wealth Creation** (`entrepreneurship-wealth-creation`) and **Leadership & Personal Development** (`leadership-personal-development`). Old slugs return 308s. **Virtual Assistance** isn't in §7 and moves to Digital Business. Confirm. | 13 |
| D22 ⛔ | The ~44 program names in §7 | **They are each school's study areas, listed on the school page.** An area with a published program links to it; the rest read "Coming soon". **No empty Course rows** (there's nothing to sell, and Go would list them). Product decides which areas become programs, and when. | 13 |
| D23 ⛔ | What each plan includes (§9) | **As the document says.** Basic (*Foundation*, 4 weeks): recorded classes (a new `recordings` entitlement), assignments, assessments, a Certificate of Completion and the program community; no live classes, no instructor Q&A. Standard (*Mastery*, 8–12 weeks): adds live classes, instructor Q&A and projects; its "mentorship" is **group mentorship in the live cohort, copy only**, because private 1-on-1 stays Executive's. Executive (*Personalized Mastery*, "Flexible schedule"): everything, plus the executive community and priority ("premium") support. Prices unchanged. **Nobody loses access; existing Basic buyers gain.** Go reads the flags from package data (R1), so flipping them needs no Go change. Keep or drop the "signal group" line on Executive? | 14 |
| D24 | Mastery Score formula (§12) | **0–100 per program, the weighted mean of the parts the learner's plan includes**: Completion 30 · Assessments 25 (best final-exam score) · Assignments 20 (mean grade) · Projects 10 (mean grade of project-type assignments; §12's "practical application") · Attendance 15 (classes attended ÷ classes held since enrolment, where attended means ≥ 50% of the class or ≥ 30 minutes). Parts with no data drop out and the rest re-weight; the score shows once two parts have data. Computed on read, never stored, no cash value; visible to the learner, their faculty and admins. The weights are one constant the owner can tune later. | 16 |
| D25 ⛔ | Certificate tiers (§13) | Published on a public `/certification` page. **Certificate of Completion:** every lesson the plan opens is complete, plus the final exam where the program requires one; any plan that certifies (Basic too, under D23). **WMA Certified Practitioner:** Standard or Executive; Completion + final exam passed + Mastery Score ≥ 70. **WMA Mastery Certification:** Practitioner + Mastery Score ≥ 85 + a graded project ≥ 70. One certificate and one `WSA-` ID per enrollment, showing the highest tier earned; it reprints when a higher tier is reached. | 17 |
| D26 | Communities (§14) | **External links, as D6 decided**: program = `Course.communityUrl` (exists); school = `School.communityUrl` (new, null until product supplies links); academy = `NEXT_PUBLIC_COMMUNITY_URL` (exists; now shown to every enrolled learner, not only as a fallback); executive = `NEXT_PUBLIC_EXECUTIVE_COMMUNITY_URL` (Executive learners only). No in-app forum. | 15 |
| D27 | "Welcome email + login credentials" (§10) | **Never email passwords**: the account is the learner's WorldStreet hub account, made before paying. **A one-time "Welcome to WorldStreet Mastery Academy" email on the first paid enrollment** (wallet or ESPEE) gives the sign-in address and email, a map of the Student Portal, and the cohort start. The per-program confirmation email stays. | 15 |
| D28 | WMA Partners (§15) | **The referral program becomes "WMA Partners", with the commission rule as built** (owner, 2026-10-05): 10% of a referred person's first paid purchase, wallet only, never ESPEE, once per buyer. Each account's `referralCode` is its Partner Code (UI rename). **Click tracking counts one visit per visitor per code per day,** in a new web-only collection. The dashboard shows clicks, sign-ups, paying learners, their revenue and commission (pending / cleared). Admins get a partners table and a CSV. | 18 |
| D29 | Faculty pipeline (§16) | **Teaching demonstration:** an optional stage the reviewer turns on after the interview. It runs as a second meeting through the interview machinery and is recorded in an additive `demo` sub-document; no new status values (Go-safe). **Onboarding** adds three read-and-acknowledge pages under `/instructor/handbook/*`: Teaching standards, Curriculum guidelines and Platform training. **We draft their copy from the blueprint and the platform's real rules; the owner signs it off before release.** **Faculty credential:** a "WMA Faculty" credential (ID `WMAF-` + 6 Crockford symbols, issue date) granted when onboarding completes and shown on the faculty profile. | 19 |
| D30 ⛔ (partly) | Marketplace formats (§17) | **v1 stays lesson-based and adds a format label: Course · Masterclass · Workshop.** **Templates and guides** are file products with no lessons, a separate build that waits for an owner yes. **Quality control** becomes four recorded checks (content, quality, accuracy where relevant, technical) that must pass before Approve publishes. | 20 |
| D32 | Super admin and admin levels (owner, 2026-10-19: "we will need super admin and admin level people asap") | **Two levels on the existing `ADMIN` role**, so Go still sees `ADMIN` and no role enum value is added. An additive `User.adminLevel: "super" \| null` marks super admins. **Only a super admin** can grant or revoke `ADMIN`, promote or demote a super admin, and open `/admin/team`; every other admin power is unchanged. Today any admin can do this from `/admin/users`, and that stops. The first super admin is bootstrapped by `node scripts/grant-admin.mjs <email> --super` (owner-run, production). Every admin role change is audited. Nobody can change their own level, and the last super admin can't be demoted. | 21 |
| D31 | Faculty names on public pages | `FACULTY_PUBLIC` is off (the "ghost tutors", 2026-10-05), but §8 and §16 want faculty shown. **It stays off until real faculty own the programs; the owner flips it.** Phases build their faculty sections behind it. | 13, 19 |

**Retired:** the "school pass" (the Phase 10 candidate recorded by Phase 9's D11). §9–§10 sell a program's plan, never a school, so Phase 10 is reused below.

## 3. The phases at a glance

| Phase | Name | Spec | Est. | Can start | Status |
|---|---|---|---|---|---|
| 10 | Release the cohort build | §9, §10, §15–§18 (built, unreleased) | 0.5 d + owner | **Now** (owner-run) | owner step |
| 11 | The institution's voice: hero, `/academy`, vocabulary | §1–§6, §16–§23 (copy) | 2–3 d | **Now**; task plan written | built (merged, `feat/institutional`) |
| 12 | Cohorts as data + Academic Calendar | §6, §8, §18, §19, §20 | 3–4 d | **Now** | built (merged, `feat/institutional`) |
| 13 | Schools v2: seven schools and the full school page | §7, §8 | 4–5 d | ⛔ D21, D22 | built (merged, `feat/institutional`) |
| 14 | Plans to the blueprint | §9 | 2 d | ⛔ D23 | built (merged, `feat/institutional`) |
| 15 | Student portal, welcome email, communities | §10, §11, §14, §19 | 2–3 d | **Now** | built (merged, `feat/institutional`) |
| 16 | Mastery Score and attendance | §12 | 3 d | **Now** (D24 default) | built (merged, `feat/institutional`) |
| 17 | Certification tiers and Alumni | §13, §19 | 2–3 d | ⛔ D25; after 14 and 16 | built (merged, `feat/institutional`) |
| 18 | WMA Partners | §15, §16 | 2–3 d | **Now** | built (merged, `feat/institutional`) |
| 19 | Faculty system | §16 | 4–5 d | **Now** (owner signs off the handbook copy) | built (merged, `feat/institutional`) |
| 20 | Marketplace formats and quality control | §17 | 3 d | **Now** (file products ⛔ D30) | built (merged, `feat/institutional`) |
| 21 | Super admin and admin levels | owner, 2026-10-19 | 1–2 d | **Now** (first) | built (merged, `feat/institutional`) |

Total ≈ 28–35 dev-days in sequence, or ≈ 14–18 across three tracks:

| Track A — public | Track B — learner | Track C — faculty and commerce | Track D — administration |
|---|---|---|---|
| 10 → 11 → 12 → 13 | 15 → 16 → 14 → 17 | 18 → 19 → 20 | 21 (first: owner asked "asap") |

**Ruling (2026-10-19): the vocabulary pass runs last.** Phase 11 Tasks 6–7 rename user-facing strings in almost every directory, and would conflict with every other track. They run once, after all the tracks have merged into `feat/institutional`. Until then, every phase writes its new strings in the new vocabulary: plan, Marketplace Creator, program, Become a WMA Instructor.

**Where tracks collide (sequence these):**
- 11 and 12 both edit `cohort-banner.tsx` and `lib/cohort.ts`, so they run in order.
- 15 and 18 both edit `components/platform/app-sidebar.tsx`. 15 goes first, or 18's sidebar line lands after 15 merges.
- 19's My Students uses 16's `masteryInputsFor`. Either 16 goes first, or 19 ships the view without the score and 16 adds it.
- 13 changes school slugs that 12's school-page section and 15's school communities key on. Both read `SCHOOLS`, so they follow the rename automatically.

**Where to start:**
1. **Today: Phase 10.** Nothing else reaches a learner until it ships, and the cohort has begun.
2. **Then Phase 11** (task plan ready), with Phases 15 and 18 alongside: they touch different files.
3. **Owner answers D21, D22, D23, D25 and D30.** Those unblock 13, 14, 17 and the marketplace file products.

## 4. Constraints for every phase

- Everything in `docs/mastery-academy-plan.md` §0.3, plus `CLAUDE.md`: additive schemas only (Go reads the same database); no new role or status enum values; money in integer cents through `lib/wallet.ts`, failing closed; ids from `getCurrentUser()`, never the browser; actions return `{ success, data | error }`; no new dependencies; no `any`; `zod/v4`.
- **Copy the spec's wording verbatim where it gives wording.** Never invent figures, testimonials or policy. Where the spec gives a heading and no body (the Opportunity Hub), ship "Coming soon", not prose. Competitor names (Udemy, Coursera) are the owner's internal framing and stay off public pages.
- **Renames are UI only:** routes, model names, field names and enum values never change, and old links keep working.
- Design system (`../design-system/`, vendored as `ds/`):
  - Gold only for primary CTAs, active nav and brand moments.
  - Icons through `components/icons.tsx`, never emoji.
  - Pills, 20 px cards, Manrope.
  - Never hardcode a palette hex.
  - `render`, never `asChild`.
  - `pb-24 md:pb-8` in `(platform)`.
  - `·` separators, `tabular-nums` for money.
- **No test runner, and none is added.** Pure rules are checked with a throwaway `node:assert/strict` script run by `npx tsx` from the session scratchpad. Everything else is checked with `npx tsc --noEmit` (one stale `.next/types` error is not real), `npx eslint <changed files>`, and a route driven in `dev:mock` started with the placeholder keys from `CLAUDE.md`, at 1440 and 390 px.
- **Database scripts** are dry-run by default, and `--apply` refuses without `MONGODB_URI` on the command line, because `.env.local` points at production. Production runs belong to the owner, through `docs/launch-runbook.md`.
- Each phase adds its Go notes to `docs/go-patches-phase-3.md` (the next free section number) and its owner steps to the runbook.

---

## Phase 10 — Release the cohort build (today)

**Goal:** what was built for the 3 October meeting reaches learners: the three plans, ESPEE, the gate, marketplace, referrals, recordings, points and the new design. Most of §9, §10, §15, §16 and §17 goes live with it.

**Depends on:** nothing. **Owner-run:** everything that touches production.

### Tasks
- **10.1 Release check (repository, no production access).**
  - `git diff origin/main HEAD -- mocks lib/dev scripts/dev lib/wallet.ts` prints nothing (true on 2026-10-19). The working tree's `mocks/clerk` edits stay uncommitted.
  - `pnpm lint` and `npx tsc --noEmit` pass. `pnpm build` passes with a well-formed `pk_live_` key: base64 of `clerk.worldstreetgold.com$`, because a plain placeholder fails the prerender.
  - In `dev:mock`, walk the cohort-launch smoke list (runbook "Cohort launch", step 5): gate → ESPEE submit → approve → reject → wallet purchase → leads CSV.
- **10.2 The cohort date after today.** Leave it, and cohort banners and the offer timer stay hidden while discounted prices keep selling. Or, once the owner names Cohort 002, set `NEXT_PUBLIC_COHORT_STARTS_AT` (and `NEXT_PUBLIC_COHORT_NUMBER` from Phase 11) in Coolify as build variables and redeploy. Phase 12 replaces both with data.
- **10.3 Push and open the PR** from `feat/cohort-launch` to `main`, **on the owner's go**, because it is outward-facing. The PR body groups the 67 commits by theme and links the runbook's "Cohort launch" section.
- **10.4 Owner: the runbook**, in order: backup (§1), the Go release R1–R11 plus §7–§11 (§2), Coolify env including `ESPEE_PAYMENT_DETAILS` and `R2_RESOURCES_BUCKET_NAME` with its CORS (§3), deploy (§4), scheduled tasks including the hourly `academy-recordings` (§5), the catalogue dry run then `--apply --allow-price-change` (§6), the certificate-ID backfill (§7), granting admins, then the smoke tests and the §17 journey (§8).

### Exit criteria
- [ ] Production serves `feat/cohort-launch`: three plans with struck prices on every catalogue program, ESPEE live, the gate live. **Open: owner step.** Production still serves `main`; nothing is pushed.
- [ ] Catalogue applied; certificate IDs backfilled; crons scheduled; run logs kept. **Open: owner step** (runbook §5–§7).
- [ ] The Go release is live first, or the owner accepts in writing the B1 risk, which holds as long as no lesson has a tier set. **Open: owner step.**

---

## Phase 11 — The institution's voice: hero, `/academy`, vocabulary

**Goal:** a visitor meets the institution the blueprint describes. The §18 hero and cohort section, the Wealth Liquefaction philosophy, the three gaps and the three worlds on the landing; an `/academy` page carrying §1–§6 and §20–§23; and one vocabulary pass (D19).

**Depends on:** nothing. Ship it after or with Phase 10. **Decisions:** D16–D19. **Task plan:** `docs/plans/mastery-phase-11.md`.

### Tasks (summary; details are in the task plan)
1. `lib/brand.ts` (D16 tagline, `shortName`, §22 meta description) and a new `lib/institution.ts`, the one home for the blueprint's institutional copy.
2. Hero (§18): "Welcome to WorldStreet Mastery Academy", "The Academy of the New Economy", the positioning and the four beats. "Explore the Academy" goes to `/schools`. "Join the upcoming cohort" goes to `#cohort` while a cohort is upcoming, otherwise "Start learning".
3. Cohort section (§18): `COHORT_NUMBER` / `COHORT_NAME` in `lib/cohort.ts`. The band reads "Cohort 001 — Starts Monday 19 October", with the countdown and "Explore Programs" / "Join Cohort".
4. Landing story bands:
   - `AboutBand` becomes Wealth Liquefaction (§1–§2).
   - `InstitutionBand` becomes the three gaps (§4).
   - A new `WorldsBand` presents the three worlds (§6, D18).
   - `FinaleCta` closes on §23's question and "WMA is the Academy of the New Economy."
5. `/academy`: §1–§6 and §20–§23 in the document's order, plus metadata and the sitemap.
6. The vocabulary pass (D19): plan, Marketplace Creator, programs, Become a WMA Instructor.
7. Navigation ("The Academy" in the navbar and the footer), docs, and the closing run.

### Exit criteria
- [x] `/` shows the §18 hero and CTAs verbatim. With a future cohort configured, the cohort band reads "Cohort 00N — Starts …" with the countdown and both CTAs. (verified locally)
- [x] `/academy` is live with §1–§6 and §20–§23. The Opportunity Hub reads "Coming soon" and links nowhere. (verified locally)
- [x] No user-facing "package", "seller" or "Become an Instructor" remains. "Own Your Future" appears nowhere. (verified locally) on the checked pages: 0 "package" or "seller"; "Become a WMA Instructor" on `/` and `/teach`.
- [ ] 390 px: no horizontal scroll on `/` or `/academy`, and the hero claim holds two lines from 320 px. Verified locally: no horizontal scroll at 390, and at 320 on `/` and `/academy`. The two-line hero claim from 320 px was not recorded separately, so this stays open.

---

## Phase 12 — Cohorts as data + Academic Calendar

**Goal:** cohorts are the academic sessions (§20). An admin enters Cohort 002, and every countdown, banner, offer timer, school page and learner card follows it. Learners and faculty see which cohort a learner is in; the public sees an Academic Calendar.

**Depends on:** Phase 11 (cohort copy). **Decision:** D20. **Go:** none (web-only collection).

### Tasks
- **12.1 Model.** `lib/db/models/cohort.ts`, `Cohort`: `number` (unique, ≥ 1), `name` (`"Cohort 001"`), `startsAt: Date`, `endsAt: Date | null`, `note: string | null`, `createdBy`, timestamps. Exported from the models barrel.
- **12.2 Pure rules.** `lib/cohort-rules.ts`:
  - `cohortName(n: number): string` returns `"Cohort 001"`.
  - `nextCohort(cohorts, now): CohortView | null` is the soonest start strictly after `now`.
  - `currentCohort(cohorts, now): CohortView | null` is the latest start at or before `now`.
  - `cohortForEnrolment(cohorts, enrolledAt): CohortView | null` is the first cohort starting on or after `enrolledAt`, else the latest started one.
  - `CohortView = { number: number; name: string; startsAt: string; endsAt: string | null }`.

  Check with an assert script: boundaries at the exact start instant, an empty list, and enrolment after the last cohort.
- **12.3 Server loader.**
  - `getCohortCalendar(): Promise<{ next: CohortView | null; current: CohortView | null; all: CohortView[] }>` lives in `lib/cohort-calendar.ts` (server-only, `React.cache`).
  - While the collection is empty, it returns a single cohort built from `NEXT_PUBLIC_COHORT_STARTS_AT` / `COHORT_NUMBER`, so production behaves as today until an admin adds one.
  - `lib/cohort.ts` keeps `COHORT_TIME_ZONE` and gains formatters that take a date: `cohortDateLabel(iso)`, `cohortDateShort(iso)`.
  - Its module constants are removed once every importer below is moved.
- **12.4 Client components take the date as a prop.**
  - `CohortCountdown` and `WhileCohortUpcoming` gain `startsAt: string`.
  - `CohortBanner` gains `cohort: CohortView | null` and renders nothing for null.
  - `OfferEnds` (`components/programs/package-offer.tsx`) gains `endsAt: string | null`.
  - Callers pass the value from `getCohortCalendar()`:
    - the marketing layout bar, the landing band, the strips on `/schools`, `/schools/[slug]` and `/programs/[slug]`
    - `components/dashboard/class-band.tsx`, `components/instructor/home/next-class-hero.tsx`, `cohort-grid.tsx`
    - `lib/actions/teaching-home.ts`, `lib/actions/class-board.ts`
    - `lib/vivid/prompt.ts`
- **12.5 Admin.**
  - `/admin/cohorts` lists every cohort with its start, status (upcoming / running / past) and learner count, which is derived.
  - Create and edit form (number, start date and time in Africa/Lagos, optional end, note).
  - Actions in `lib/actions/admin-cohorts.ts`: `adminCreateCohort`, `adminUpdateCohort` (`requireAdmin`, Zod; a number can't repeat; a started cohort's start can't move into the future). No delete.
  - Links in `components/admin/admin-sidebar.tsx` and `bottom-nav.tsx`.
- **12.6 Academic Calendar (§19).** `app/(marketing)/calendar/page.tsx` serves `/calendar`. It shows the next cohort with the block countdown and "Join Cohort" → `/schools`, then the list of cohorts (upcoming, running, past) with dates. Add it to the sitemap and as a footer link, "Academic Calendar".
- **12.7 School page "Upcoming cohorts" (§8).** `components/schools/school-cohorts.tsx` shows the next cohort and which of this school's programs' plans include live classes. It hides when there is no future cohort, and slots in after Faculty in `app/(marketing)/schools/[slug]/page.tsx`.
- **12.8 Learners and faculty see the cohort.**
  - "My programs" cards and the dashboard hero show "Cohort 001", via `cohortForEnrolment` in the read model.
  - The tutor home's `CohortCard` shows a learner count per cohort.
  - The admin enrollment sheet shows the cohort.
  - Nothing is written to `Enrollment`.
- **12.9 Owner.** Runbook: after deploying, create Cohort 001 (2026-10-19 00:00 Lagos) and Cohort 002 at `/admin/cohorts`, then remove `NEXT_PUBLIC_COHORT_STARTS_AT`.
- **Phase 19 seam.** Fill `cohortsFor` in `lib/faculty-seams.ts` (the fill is in its comment).

### Exit criteria
- [x] Entering Cohort 002 in admin moves every countdown, banner, strip and "Offer ends in" timer to its date, with no redeploy. (verified locally) (cohort create and edit work; duplicate numbers refused; a started cohort's start can't move later).
- [x] `/calendar` lists the cohorts. School pages show Upcoming cohorts. Learners and faculty see "Cohort 00N". (verified locally)
- [ ] With the collection empty, behaviour equals today's. Open: the empty-collection fallback was not exercised in the QA pass or recorded in the ledger.

---

## Phase 13 — Schools v2: seven schools and the full school page

**Goal:** the academic structure is §7's seven schools, and every school page carries §8's sections in order.

**Built on:** D21, D22 (answered yes, 2026-10-19). **Depends on:** Phase 12 (Upcoming cohorts). **Go:** a new note R12 (school slugs and category labels change; ship before the migration runs).

### Tasks
- **13.1 `lib/schools.ts`.**
  - The seven schools per D21.
  - `School` gains `overview: string | null`, `learn: string[]`, `audience: string[]` (Who it's for), `careers: string[]` (Career/economic applications), `areas: string[]` (§7's names, verbatim), `communityUrl: string | null` (D26) and `legacySlugs: string[]`.
  - Content: `areas` comes from §7. `overview`, `learn`, `audience` and `careers` are drafted from §7 and the school's programs, **marked for owner sign-off**; empty sections hide.
- **13.2 Old links keep working.**
  - `next.config.ts` redirects (308) `/schools/<legacy>` to `/schools/<new>`, built from `legacySlugs`.
  - New `schoolFromSlug(value)` in `lib/schools.ts` resolves legacy values. It is used by the `wsa_school` cookie reader, `?school=` on `/dashboard/start` and `schoolsPathFor`.
- **13.3 Migration script.** `scripts/migrate-schools-v2.mjs`: dry run by default; `--apply` refuses without `MONGODB_URI` on the command line. It rewrites `courses.school` and `courses.category`, `enrollmentintents.school`, `sellerapplications.school` and `instructorapplications.answers.school`; prints counts per mapping; and is idempotent.
- **13.4 Catalogue and art.**
  - Update `scripts/mastery-catalogue.mjs`: its `SCHOOLS` and the program → school map.
  - Render seven covers (`render-3d-assets` skill; three are new) and update `lib/school-art.ts` and `scripts/art/school-covers/render.mjs`.
- **13.5 School page in §8's order.**
  1. Overview (hero)
  2. What you'll learn
  3. Who it's for (new `school-audience.tsx`)
  4. Career/economic applications (new `school-careers.tsx`)
  5. Available programs, then the study areas (new `school-areas.tsx`, D22)
  6. Faculty (behind `FACULTY_PUBLIC`, D31)
  7. Upcoming cohorts (12.7)
  8. Learning pathways (existing `SchoolPath`)
  9. The program cards lead to the plans

  The existing reviews, FAQ and other-schools sections follow after.
- **13.6 Copy.** Every "eight schools" (`lib/brand.ts`, `lib/marketplace.ts`, `/sell`, `/programs`, `schools/[slug]`, `other-schools.tsx`, `schools-index.tsx`) reads from `SCHOOLS.length`.
- **13.7 Owner.** Runbook: Go release R12 → deploy → `migrate-schools-v2.mjs` dry run → `--apply` → catalogue dry run.

### Exit criteria
- [x] Seven schools on every surface. Old school links and cookies land on the right new school. (verified locally): all 7 return 200, retired slugs 308 to the new school, and a `wsa_school` cookie with a retired slug lands on the right one.
- [ ] Each school page shows §8's sections in order, and sections without content hide. Open: only Upcoming cohorts was checked at runtime; section order was reviewed task by task, not walked end to end.
- [ ] The migration dry run on a production copy shows every course mapped and none left over. **Open: owner step.** Needs a production copy.

---

## Phase 14 — Plans to the blueprint

**Goal:** the three plans are §9's (names, durations, inclusions), and Basic learners receive what §9 promises.

**Built on:** D23 (answered yes, 2026-10-19). **Depends on:** Phase 10 (catalogue applied). **Go:** a note only. Flags are data, Go's R1 already honours `entitlements.certificate`, and `recordings` is web-only.

### Tasks
- **14.1 A `recordings` entitlement.**
  - Additive in `IPackageEntitlements` and the schema (default `false`).
  - New pure `recordingsAllowed(ent: IPackageEntitlements): boolean`, which returns `ent.recordings || ent.liveClasses`, so packages saved before the flag keep their recordings.
  - It replaces the three `liveClasses` checks in `lib/actions/recordings.ts` and the Recordings link condition in the student nav.
- **14.2 Editor.** `ENTITLEMENT_LABELS` and `PackageSchema` gain the flag. The label is "Recorded classes".
- **14.3 Catalogue.** `scripts/mastery-catalogue.mjs` `PLAN`:
  - Basic: tagline "Foundation", duration "4 weeks", entitlements `{ recordings, assignments, certificate }`.
  - Standard: tagline "Mastery", "8–12 weeks", plus `recordings`.
  - Executive: name "Executive", tagline "Personalized Mastery", "Flexible schedule", `FULL` plus `recordings`.

  Every `features` list is rewritten from §9's wording. If the script doesn't already update entitlements, features, durations and taglines on existing packages, add that (diffed in the dry run, behind `--update-plans`). `PACKAGE_LABEL.executive` becomes "Executive".
- **14.4 Plan cards.**
  - The tagline shows beside the plan name.
  - `SERVICES` (`components/programs/package-model.ts`) gains "Recorded classes".
  - `whats-included.tsx` copy follows §9.
  - Standard's mentorship line reads "Mentorship in your live cohort" (D23).
- **14.5 Check the gates** with a Basic mock enrollment: recordings play; assignments submit; the final exam opens after the lessons; completion issues a Certificate of Completion; live-class join and instructor Q&A are still refused.
- **14.6 Go and owner.** Go note: Basic now certifies; `recordings` is web-only. Runbook: catalogue dry run → `--apply --update-plans`.

### Exit criteria
- [x] Every program's plans read Basic — Foundation (4 weeks), Standard — Mastery (8–12 weeks), Executive — Personalized Mastery (Flexible schedule), with §9's inclusions. (verified locally) on the mock DB. The production catalogue apply is Phase 10.
- [x] A Basic learner can watch recordings, submit assignments, sit the final and receive a Certificate of Completion. No existing learner loses access. (verified locally) (Phase 14 Task 7, Basic end to end).

---

## Phase 15 — Student portal, welcome email, communities

**Goal:** the portal answers §11's four questions, with every §11 item one tap away. A first-time payer gets a welcome email (§10). Program, school and academy communities sit on one page (§14).

**Depends on:** nothing. **Decisions:** D19 (Campus), D26, D27. **Go:** `users.welcomedAt` is additive and Go ignores it.

### Tasks
- **15.1 Student sidebar** (`components/platform/app-sidebar.tsx`).
  - **Learn:** Dashboard · My programs · **My classes** (`/dashboard/meetings`, label only) · **Recordings** (moved from Connect) · Assignments · **Assessments** · **My points** · Certificates · Mentorship (Executive).
  - **Connect:** **Inbox** (`/dashboard/notifications`, with the bell's unread count) · Messages · **Communities**.
  - Page titles match the labels.
- **15.2 Assessments page.** `/dashboard/assessments` lists final exams and lesson quizzes the plan opens, with attempts, best score, pass mark and the next action, via `getMyAssessments` with scope `final | lesson`. `/dashboard/assignments` keeps scope `assignment` only. Both pages share one list component.
- **15.3 Communities.**
  - Pure `lib/communities.ts`: `communitiesFor({ programs, academyUrl, executiveUrl }): CommunityLink[]`, where `CommunityLink = { scope: "program" | "school" | "academy" | "executive"; label: string; url: string }`.
  - School links come from a new `School.communityUrl` (null for now).
  - It deduplicates and is checked with an assert script.
  - `/dashboard/communities` renders it. The dashboard `SupportTile` uses the same list.
  - The academy row shows to every enrolled learner.
- **15.4 Welcome email (D27).**
  - `sendWelcomeEmail` in `lib/email.tsx`. Subject: "Welcome to WorldStreet Mastery Academy". It contains the sign-in address and email, a short map of the Student Portal (programs, classes, recordings, assignments, assessments, points, communities) and the next cohort's start.
  - `sendWelcomeOnce(userId)` claims the send atomically: `User.updateOne({ _id, welcomedAt: null }, { $set: { welcomedAt: now } })`, and sends only on `modifiedCount === 1`.
  - Called fire-and-forget **after** the existing confirmation email in `purchaseCourse` and in `adminApproveEspeePayment`. It is never awaited before the result returns, so the money path is unchanged.
  - A backfill isn't needed: existing learners simply never get one.
- **15.5 Campus.** The dashboard greeting's eyebrow reads "WMA Campus" (D19). Emails call the dashboard "the WMA Student Portal".
- **15.6 Signed-out checkout keeps its place (§10).** `app/(checkout)/layout.tsx` redirects to the hub login *with* the return path, as `middleware.ts` does, mirroring the `pk_test_` local switch.

### Exit criteria
- [x] Every §11 item is in the sidebar. `/dashboard/assessments` and `/dashboard/communities` are live. (verified locally): all 21 student dashboard routes return 200, and every sidebar link and the bottom nav resolve.
- [ ] A first wallet purchase and a first ESPEE approval each send exactly one welcome email; a second purchase sends none. **Open: needs production.** Resend is disabled locally, so no email can send. Owner: run the pre-launch paid-rows count from the Phase 15 ledger, then confirm one welcome after release.
- [x] A signed-out visitor who opens a plan's checkout returns to it after signing in. (verified locally)

---

## Phase 16 — Mastery Score and attendance

**Goal:** "mastery" is measurable (§12). Each learner has a 0–100 score per program, built from completion, assessments, assignments, projects and attendance, and can see its parts.

**Depends on:** nothing (15 first, for the sidebar). **Decision:** D24. **Go:** optional note R-A. Mobile joins aren't counted until Go writes `attendances`.

### Tasks
- **16.1 Attendance capture.**
  - Web-only collection `lib/db/models/attendance.ts`, `Attendance`: `meeting`, `course`, `user`, `firstJoinedAt`, `lastJoinedAt`, `openSince: Date | null`, `seconds`; unique `{ meeting, user }`.
  - Written by `joinMeeting` (sets `firstJoinedAt` once, `openSince = now`), `leaveMeeting` (adds `now − openSince`, clears it) and `endMeeting` (closes every open row).
  - Course classes only: `Meeting.courseId` set, no `mentorshipSessionId`.
- **16.2 Projects.** `Assignment.kind: "assignment" | "project"`, additive, defaulting to `"assignment"`. A toggle in the instructor's assignment editor; a "Project" chip for learners.
- **16.3 Pure score.** `lib/mastery-score.ts`:
  - `MASTERY_WEIGHTS = { completion: 30, assessment: 25, assignments: 20, projects: 10, attendance: 15 }`.
  - `type MasteryInputs = Record<keyof typeof MASTERY_WEIGHTS, number | null>`, each value 0–100, or null when excluded or with no data.
  - `masteryScore(inputs): { score: number | null; parts: { key; value; weight }[] }`: a re-weighted mean over non-null parts; null when fewer than 2; rounded to an integer.

  Check with an assert script: all null, one part, re-weighting, and clamping.
- **16.4 Server inputs.** `lib/mastery-inputs.ts`: `masteryInputsFor(enrollment, course): Promise<MasteryInputs>`.
  - Completion = `Enrollment.progress`.
  - Assessment = `bestScorePercent` (null without a final).
  - Assignments and projects = the mean `Submission.grade` by `kind`, only if the plan includes assignments.
  - Attendance = classes attended ÷ classes held since `enrolledAt`, only if the plan includes live classes; attended means ≥ 50% of the class or ≥ 1,800 s.
  - Batched for lists: `masteryInputsForMany(enrollments)`.
- **16.5 Surfaces.**
  - `/dashboard/points` gets a "Mastery Score" card per program, with the parts and their weights.
  - The dashboard hero stats gain "Mastery".
  - The admin enrollment sheet shows it.
  - Phase 19's My Students and Student Performance read it.
  - It never appears on a public page.
- **Phase 19 seams.** `masteryFor` in `lib/faculty-seams.ts` is filled (Phase 19 integration). Still to do: pass `attended` to `ClassesList` on Student Performance.

### Exit criteria
- [x] A learner sees a score and its parts per program once two parts have data. Parts the plan doesn't include never count against them. (verified locally) (50% completion and an assignment of 80 gives 62); shown on points, the dashboard, My Students, Student Performance and admin enrollments.
- [ ] Joining and leaving a class on the web records attendance; ending the class closes it. Open: needs a live RealtimeKit class; not exercised in the local QA pass.
- [ ] Assert scripts pass. Open: no recorded run of the assert scripts in the closing QA.

---

## Phase 17 — Certification tiers and Alumni

**Goal:** three credentials with published requirements (§13). A certificate shows the highest tier earned, and certificate holders are Alumni (§19).

**Built on:** D25 (default, built as written). **Depends on:** Phases 14 (Basic certifies) and 16 (score). **Go:** note R13 (`enrollments.certificateTier` is additive; mobile prints "Certificate of Completion" when it is null).

### Tasks
- **17.1 Pure tiers.** `lib/certificate-tier.ts`:
  - `CertificateTier = "completion" | "practitioner" | "mastery"` and `CERT_TIER_LABEL`.
  - `tierFor({ completed, certifies, packageKey, examPassed, score, bestProjectGrade }): CertificateTier | null`, with D25's thresholds as named constants.

  Check with an assert script.
- **17.2 Stored tier.**
  - Additive `Enrollment.certificateTier` (null) and `certificateTierAt`.
  - `ensureCertificateTier(enrollmentId)` recomputes and stores the tier and never lowers it.
  - Called after `saveWithCertificateId`, an exam pass, and an assignment grade.
- **17.3 Surfaces.**
  - The certificate view's title follows the tier.
  - `/verify/[certificateId]` prints the tier.
  - `/dashboard/certificates` shows the tier and what the next tier needs.
- **17.4 `/certification`.** A public page with the three credentials and their requirements (D25, verbatim from the constants), linked from `CertificateBand`, the footer and `/verify`.
- **17.5 Alumni.** A learner holding a certificate shows "WMA Alumni" on their profile and dashboard greeting.

### Exit criteria
- [ ] Each tier is issued exactly when its published requirements are met. A higher tier reprints under the same ID, and none is ever lowered. Open: tier rules were reviewed per task but not exercised end to end in the QA pass.
- [x] `/certification` is live, and `/verify` shows the tier. (verified locally) (Phase 17's own closing run).

---

## Phase 18 — WMA Partners

**Goal:** the referral program is the WMA Partners Program (§15), with a partner dashboard, link and code, click tracking, sign-ups, paying learners, revenue and commissions. Faculty reach it from their dashboard (§16).

**Depends on:** nothing (after 15's sidebar edit). **Decision:** D28. **Money rules unchanged.** **Go:** none (`partnerclicks` is web-only).

### Tasks
- **18.1 Name.** "Refer & earn" → **"WMA Partners"** in both sidebars. On `/dashboard/referrals` (the route stays): the page title "WMA Partners", "Your Partner Code", "Your partner link", and the explainer stating the commission rule as built.
- **18.2 Click tracking.**
  - Web-only `lib/db/models/partner-click.ts`, `PartnerClick`: `{ code, day: "YYYY-MM-DD" (Africa/Lagos), count }`, unique `{ code, day }`.
  - A server action, `recordPartnerVisit(code: string)`:
    - ignores unknown codes, the visitor's own code and bot user agents;
    - dedupes with a `wsa_ref_seen` cookie (code + day);
    - does `$inc` on `count`.
  - It is called once from a small client component that the marketing layout mounts when the URL carries `?ref=`.
- **18.3 Summary.** Extend `referralSummary` (`lib/referrals.ts`) with `clicks` (total and the last 30 days by day), `signUps` (users with `referredBy.userId`), `payingLearners`, `revenueMinor` (gross of referral-attributed first purchases) and `commission { pendingMinor, clearedMinor }` (Earnings of kind `referral`).
- **18.4 Dashboard.** A stats row (Clicks · Sign-ups · Enrolled · Revenue · Commission pending · Commission paid); a 30-day list of clicks by day (no chart dependency); the existing people list.
- **18.5 Faculty entry.** A "WMA Partners" item in `components/instructor/instructor-sidebar.tsx`, replacing the footer's "Refer & earn".
- **18.6 Admin.** `/admin/partners` shows a table (code, owner, clicks, sign-ups, enrolled, revenue, commission) sorted by revenue, with CSV export; plus a link in the admin nav.

### Exit criteria
- [x] A visit to `/?ref=<code>` counts once per visitor per day. Unknown codes, the owner's own visits and bots don't count. (verified locally); the CSV export downloads.
- [ ] A partner sees clicks, sign-ups, paying learners, revenue and commissions. Faculty reach it from their sidebar, and admins see all partners and export them. Open: the CSV export is verified; the partner view and the faculty sidebar link were not recorded in the QA pass.
- [x] Commission amounts and rules are byte-for-byte unchanged (`enrollments.ts` and `manual-payments.ts` untouched). (verified locally) (money-files-untouched proof in the Phase 18 ledger).

---

## Phase 19 — Faculty system

**Goal:** §16's pipeline (with the teaching demonstration and onboarding into faculty credentials, standards, guidelines and training) and §16's Faculty Dashboard: Today's classes, Upcoming classes, My Students, Assignments, Course Materials, Live Classroom, Student Performance, Earnings, WMA Partners.

**Depends on:** 18 (the Partners link), and 16 for the score in 19.5–19.6 (or ship without it). **Decisions:** D29, D31. **Go:** a note. `instructorapplications.demo`, `users.instructorProfile.handbook` and `.credential` are additive dotted writes.

### Tasks
- **19.1 Become a WMA Instructor.** `/teach`'s "How it works" becomes §16's pipeline: Application → Academic review → Interview → Teaching demonstration (where appropriate) → Approval → Onboarding. The applicant tracker on `/dashboard/become-instructor` shows the demo step only when it was requested. (The wording change itself lands in Phase 11.)
- **19.2 Teaching demonstration (D29).**
  - Additive `InstructorApplication.demo: { requested: boolean; meetingId; scheduledAt; outcome: "passed" | "not_passed" | null; note; decidedAt } | null`.
  - `adminRequestTeachingDemo(applicationId)` schedules through `scheduleInterviewCore`, titled "Teaching demonstration".
  - `adminRecordDemoOutcome(applicationId, outcome, note)` records the result.
  - `adminDecideApplication` refuses approval while a requested demo has no outcome.
  - The status stays `interview_scheduled` throughout.
- **19.3 Handbook and onboarding.**
  - `lib/faculty-handbook.ts` holds the copy for `teaching-standards`, `curriculum-guidelines` and `platform-training`, drafted from the blueprint and the platform's real rules (pass mark, assignments, recordings, conduct, plans) and **marked for owner sign-off**.
  - `/instructor/handbook/[slug]` renders each one.
  - `acknowledgeHandbook(key)` does a dotted `$set` of `instructorProfile.handbook.<key>At`.
  - The `OnboardingChecklist` gains the three items.
- **19.4 Faculty credential.** When the checklist completes, `issueFacultyCredential()` stores `instructorProfile.credential { id: "WMAF-XXXXXX", issuedAt }`, with a Crockford generator like `lib/certificate-id.ts` and a partial unique index. It shows on `/instructor/profile` and the public faculty page ("WMA Faculty · since October 2026").
- **19.5 My Students.** `/instructor/students` lists every learner across the faculty member's programs.
  - Columns: program, plan, cohort (12), progress, last active, best exam, assignments graded and average, attendance and Mastery Score (16).
  - Filters: program, cohort, plan. It is built on `getCourseStudents`, which today has no UI caller.
  - Faculty see only their own programs; admins see all.
- **19.6 Student Performance.** `/instructor/students/[enrollmentId]` shows one learner's lessons, exam attempts, submissions with grades, attendance by class, score parts and (Executive) the roadmap link. Ownership is checked in the loader.
- **19.7 Today's classes.** The tutor home gets a "Today" list above `WeekAgenda`, from the same data.
- **19.8 Earnings.**
  - `/instructor/earnings` shows a ledger from `getMyInstructorEarnings` rows: date, kind, program, masked learner, gross, share, net, status and clearing date. It also shows the totals.
  - **Fix** `/instructor/analytics` per-course revenue, which hard-codes `price × enrolled × 0.85` and is wrong for 50% marketplace sales and for ESPEE. It should sum `Earning.netMinor` by course.
- **19.9 Sidebar in §16's order:** Overview (today and upcoming) · My Students · Courses (materials and assignments per program) · Live Classroom (Meetings) · Calendar · Earnings · WMA Partners · Profile · Handbook.

### Exit criteria
- [ ] A reviewer can request, hold and record a teaching demonstration, and approval waits for its outcome. Open: only "approval is refused until the demo has an outcome" was verified locally.
- [ ] A new faculty member completes onboarding (agreement, profile, signature, KYC, three handbook pages) and receives a `WMAF-` credential. Open: only the handbook acknowledgement ticking the checklist was verified locally; agreement, KYC and the `WMAF-` credential were not.
- [ ] My Students, Student Performance and Earnings are live. Analytics revenue matches the ledger. Open: My Students filters and the Mastery Score column were verified locally; Earnings and the Analytics-to-ledger match were not recorded. The faculty Mastery Score filter is pending the final-review fix.

---

## Phase 20 — Marketplace formats and quality control

**Goal:** approved Marketplace Creators sell courses, masterclasses and workshops (§17), and each submission passes the staged quality checks before it publishes.

**Depends on:** nothing (Phase 11 did the vocabulary). **Decision:** D30 (file products ⛔). **Go:** a note. `courses.format` and `courses.review.checks` are additive; Go still publishes creator courses only through review (§9 there).

### Tasks
- **20.1 Format.**
  - `Course.format: "course" | "masterclass" | "workshop" | null`, additive and marketplace-only; null means course.
  - A select in the course editor for the marketplace kind, validated in `lib/actions/instructor.ts`.
  - A chip on marketplace cards and the program page, plus a format filter on `/marketplace`.
- **20.2 Staged checks.**
  - Additive `course.review.checks: { content, quality, accuracy, technical }`, each `{ status: "passed" | "changes" | "n/a" | null; by; at; note }` (only `accuracy` may be `n/a`).
  - `adminRecordReviewCheck(courseId, check, status, note)` records one check.
  - `adminApproveCourseReview` refuses until all four are passed (or `n/a`). "Changes" sends the course back with that check's note.
  - The admin review page shows the pipeline. The creator sees which check asked for changes.
  - A re-submission keeps passed checks unless the content changed.
- **20.3 `/sell` "How it works" is §17's pipeline:** Application → Content review → Quality review → Accuracy review (where relevant) → Technical review → Approval → Publishing.
- **20.4 Templates and guides (built, owner 2026-10-19).** `lib/course-format.ts` holds the formats and file limits, the file sits in the private bucket, and owners get a product home at `/dashboard/courses/[courseId]` with a signed 5-minute Download.

### Exit criteria
- [ ] Marketplace listings show their format and filter by it. Open: file products show "Buy now" and a price (verified locally); the format filter was not recorded. Pending the final-review fix: a live file swap with no review, and the Go note for file products becoming a REQUIRED patch.
- [ ] No creator course publishes without the four checks recorded, and each check's notes reach the creator. Open, **pending the final-review fix**: the review fingerprint refuses a stale check (verified locally), but a live file swap skips review and going back to draft keeps the approval (`fix/final-review`).

---

## Phase 21 — Super admin and admin levels

**Goal:** the Academy has super admins and admins (owner, 2026-10-19). Super admins run the admin team; admins run the Academy. Nobody else can create an admin.

**Depends on:** nothing. **Decision:** D32. **Go:** note R14. `users.adminLevel` is additive. Go keeps treating `role: "ADMIN"` as admin, and must never write `adminLevel`.

### Tasks
- **21.1 Data and guard.**
  - Additive `User.adminLevel: "super" | null` (default null) and `User.adminAudit[]` (`{ action, fromRole, toRole, fromLevel, toLevel, by, at }`).
  - `requireSuperAdmin(): Promise<LocalUser>` in `lib/auth/admin.ts` throws unless the caller has role `ADMIN` and `adminLevel === "super"`.
  - `LocalUser` and `getCurrentUser()` carry `adminLevel`.
- **21.2 Role changes are super-only where admin is involved.** `adminUpdateUserRole` (`lib/actions/admin-users.ts`) refuses for non-super callers whenever the target is or would become `ADMIN`; regular admins still move users between `USER` and `INSTRUCTOR`. New actions, each audited and mirrored to Clerk through `syncRoleToClerk`:
  - `superGrantAdmin(userId)`
  - `superRevokeAdmin(userId)`, which sets the role back to `INSTRUCTOR` if `instructorStatus === "approved"`, else `USER`
  - `superSetAdminLevel(userId, "super" | null)`

  Self-changes and demoting the last super admin are refused.
- **21.3 `/admin/team`** (super admins only; regular admins get a 404):
  - the list of admins and super admins: name, email, level, granted by and when;
  - "Add an admin" by email, which must match an existing account (search by email);
  - promote, demote and revoke, each behind a confirm step;
  - the audit trail.
  - It gets an admin-nav item shown to super admins only. The role menu on `/admin/users` hides the Admin option for non-super admins.
- **21.4 Bootstrap.** `scripts/grant-admin.mjs` gains `--super`, which sets `adminLevel: "super"` with the admin role, and `--revoke`, which clears it. The runbook gets a step: grant the first super admins before anything else.
- **21.5 Super admin badge.** The admin shell shows "Super admin" beside the lockup eyebrow for super admins.

### Exit criteria
- [ ] Only a super admin can make, unmake or promote an admin, from `/admin/team` or `/admin/users`. Every such change is audited and mirrored to Clerk. Open: the add, promote, demote and remove flow with confirmation and audit trail was verified locally; the Clerk mirror needs a real Clerk instance, so the owner confirms it in production.
- [x] A regular admin keeps every other admin power. Nobody can change their own level, and the last super admin can't be demoted. (verified locally): a regular admin gets 404 on `/admin/team`; the opus security review approved the level, self-change and last-super guards.
- [ ] `grant-admin.mjs --super` bootstraps production. **Open: owner step** (production run).

---

## Not planned

- **The Opportunity Hub (§6, World 3).** The document gives only a heading. It is shown as "Coming soon" (D18) until product describes it; then it gets its own phase.
- **The school pass.** Retired (see §2).

## Risk register

1. **Everything builds on an unreleased branch.** Until Phase 10 ships, each phase branches from `feat/cohort-launch` and widens the gap. Ship Phase 10 before starting more than two build phases.
2. **School migration on live data (13).** Slugs live in cookies, intents, applications, Go filters and shared links. The mitigations are redirects, a dry run on a production copy, and the Go release before `--apply`.
3. **Plan entitlements are paid access (14).** Learners only gain; Go reads the flags from data; check that Basic still can't join live classes or message instructors.
4. **Attendance only counts web joins (16)** until Go writes `attendances`. Show attendance only after at least one class has been held, and note "classes joined on the web" beside it.
5. **Content debt.** Owed by product:
   - school overviews, audiences and careers (13)
   - real school covers for Entrepreneurship & Wealth Creation and Leadership & Personal Development (13; placeholders now)
   - handbook copy (19)
   - certificate thresholds (17)
   - Cohort 002's date (12)
   - community links (15)
   - the Opportunity Hub
   - the signatory (D9, still open)
6. **Parallel tracks collide in the sidebars and the cohort module.** Sequence them as §3 says, and never run two implementers in one checkout.
