# Academy Update — Instructor Pipeline, Admin, Wallet, CBT Exams

**Date:** 2026-07-26 · **Status:** Phases 0–5 BUILT (this commit) · Phases 6–7 proposed below
**Scope:** instructor application/onboarding · interview links · admin section · wallet port from the mobile ecosystem · CBT exams

---

## Part 1 — How the platform is wired today (audit synthesis)

Three codebases share one world:

| Surface | Stack | Data access | Auth |
|---|---|---|---|
| **Web academy** (this repo) | Next.js 16 App Router, server actions for all mutations, TanStack Query client-side | mongoose → shared MongoDB | Clerk **satellite** of `worldstreetgold.com`; role lives in Mongo `users.role` (`USER\|INSTRUCTOR\|ADMIN`), JIT-synced from Clerk `publicMetadata.role` only on first login → **DB role is authoritative** |
| **Mobile academy** (`app-dev/worldstreet-academy/mobile` + Go API `…/backend`) | Expo SDK 56 + **its own Go (chi) API** on `/api/v1` | Go store → **the same MongoDB collections** | Same Clerk pool (currently dev instance on mobile); Go resolves `{authUserId} OR {linkedAuthIds}` + JIT placeholder; web resolves **only** `authUserId` |
| **Wallet service** (`app-dev/worldstreet-wallet`) | Hono + mongoose, Flutterwave rails, Didit KYC, deployed at `https://wallet-api.worldstreetgold.com` (Coolify) | Own collections in the shared cluster (`user-account` DB) | Dual principal: user Clerk JWT (reads + self-service money UX) and `X-Wallet-Service-Token` (**all** charges/credits/refunds/holds — service-only) |

Money flow today (built in WA-01..05): checkout → `purchaseCourse` server action → `Order` state machine + `PaymentEvent` audit trail → wallet `POST /charges` (idempotent deterministic reference) → `Enrollment` → `Earning` row (85/15 split, 7-day clearing, **lazy** clearing when instructor opens dashboard) → wallet `POST /credits`. Refund pipeline (`refundEnrollment`) is **fully built, ADMIN-gated, and has no UI**. Reconciliation is `scripts/reconcile-orders.mjs --heal` (deliberately no webhooks — the spend API is synchronous), **not scheduled anywhere yet**.

Interview-ready substrate: the **Meeting** system (RTK rooms) already has join-by-link (`/dashboard/meetings?join=<id>`), email invites (Resend), waiting rooms (`requireApproval`), roles, kick-block, history. `scheduledAt` + `status:"scheduled"` exist on the model but no create-path sets them. `joinMeeting` requires an authenticated academy user.

What does **not** exist anywhere: admin UI (role + scattered server checks only), instructor application flow (mobile has **one-tap self-serve** `POST /me/become-instructor`!), real notifications (bell is mock data), any quiz/exam substrate (web, Go, or mobile), in-academy wallet UI beyond a balance readout + external funding link.

### Hard constraints the plan must respect

1. **Two backends, one database.** Any access/money/certificate rule enforced only in web UI is bypassable via the Go API (proven twice: the refund-access bug was fixed in both repos). Rules must live in **data + both backends**.
2. **No new role enum values.** Go's `normalizeRole` maps unknown roles → `USER` (silent demotion). Use **additive fields** on shared collections; Go ignores unmapped bson safely.
3. **Instructor gating must land simultaneously** on web (portal is currently open to *any* authed user by design) and Go (`POST /me/become-instructor` bypass) — same release.
4. **ADMIN has mobile side effects** — it unlocks the Vision admin UI in the mobile app. Grant deliberately.
5. **Identity keying:** always primary `authUserId` (Clerk id) for wallet, Mongo `_id` for Ably channels. Web never reads `linkedAuthIds` — declare it in the web schema defensively but don't build on it.
6. **Ably contract is hand-synced** between web and Go (`channel user:<mongoId>`, name `event`, flat payloads). New event `type` values are additive-safe; changed shapes are not.
7. **Roles:** DB is authoritative. When admin UI changes a role, also write web-Clerk `publicMetadata.role` (via Clerk backend SDK) so a future re-sync can't clobber it.

---

## Part 2 — Target architecture for the new features

### Instructor pipeline state machine

```
USER ──apply──▶ InstructorApplication: submitted ──▶ under_review ──▶ interview_scheduled ──▶ approved ──▶ role=INSTRUCTOR + instructorProfile seeded
                                                        │                                      │
                                                        └──────────────▶ rejected ◀────────────┘   (re-apply after cooldown)
```

- New model `InstructorApplication` (additive collection — invisible to Go until it opts in):
  `user`, `status` (`submitted|under_review|interview_scheduled|approved|rejected|withdrawn`), `answers` (headline, expertise[], experience, motivation, portfolio/social links, sampleVideoUrl via R2 presign), `interviewMeetingId?`, `reviewerNotes[]`, `decidedBy/decidedAt`, `history[]` (Order-style transitions), timestamps. One **active** application per user (partial unique index on `{user, status ∈ open set}`).
- `User` additive field `instructorStatus: "none"|"applied"|"interview"|"approved"|"rejected"` — denormalized mirror for cheap gating everywhere (safe for Go).
- Gating flips in the same release: web `(instructor)/layout.tsx` + `getAuthenticatedInstructor()` require `role ∈ {INSTRUCTOR, ADMIN}`; Go `POST /me/become-instructor` becomes "create application" or 410.
- Grandfathering: one-time script marks every user who already owns a course as `role: INSTRUCTOR` so nobody currently teaching is locked out.

### Interviews = scheduled Meetings

- Extend Meeting create-path with `scheduledAt` (+ `status:"scheduled"`, `applicationId?` following the existing `courseId` pattern). Add `startScheduledMeeting` host action (scheduled → active, reusing `startMeeting`).
- Admin flow: application detail → "Schedule interview" → creates scheduled meeting with `requireApproval: true, guestAccess: false` (waiting room), invites applicant (`invites[]` + third email template + in-app notification). The link is the existing deep link: `/dashboard/meetings?join=<meetingId>`.
- Applicants are authed users (they applied from their account) — **no anonymous join needed**, which keeps `joinMeeting` untouched.
- Outcome (notes + verdict) written back onto the application.

### Admin section

- New route group `app/(admin)/admin/*` cloning the `(instructor)` layout skeleton (sidebar/topbar/bottom-nav are copy-adapt). Layout does a **hard role check** (`role === "ADMIN"`, redirect otherwise) — first role-gated layout in the app.
- `middleware.ts` matcher gains `"/admin(.*)"`.
- Pages (v1): Overview (KPIs) · Instructor applications queue/detail · Users (search, role management incl. Clerk metadata write-back, view enrollments/orders) · Payments (Orders + PaymentEvents browser, **refund button on the already-built `refundEnrollment`**, earnings ledger, reconcile report) · Courses (status lifecycle, review moderation using the dormant `isApproved/isHidden` fields) · Exams oversight (Phase 5).
- First ADMIN is granted by one-off script/manual Mongo + Clerk metadata; thereafter via the Users page.

### Wallet port (from the mobile ecosystem)

The wallet **service** already exposes everything the mobile app's wallet UX uses; the port is a web UI + a thin server-proxy layer — no wallet-service code changes.

- **Integration mode: server-proxy via Next server actions** (extend `lib/wallet.ts`), using the existing `academy:<token>` service token, forwarding `body.actor` identity for Flutterwave-touching calls, generating `Idempotency-Key` per mutation. Rationale: matches the app's "server actions for everything" convention, zero dependency on unknown deployed wallet env (`CORS_ALLOWED_ORIGINS`, `CLERK_AUTHORIZED_PARTIES`), secrets stay server-side. Direct-from-browser (mobile's mode) stays a later option — it's an env-only change on the wallet service.
- New `(platform)` section `/dashboard/wallet`:
  - **Overview** — USD (`GET /dollar/account`) + NGN (`GET /fiat/wallet`) balances, unified transaction feed merging deposits/transfers/withdrawals/charges (mobile's `hooks.ts` mapping tables are the ready-made spec; course purchases surface from `GET /charges` with `metadata.courseId`).
  - **Deposit** — USD hosted checkout (`POST /dollar/deposits` → open `checkoutUrl` in new tab → return page with "I've paid" → `POST /deposits/:txRef/sync`) · NGN payout-subaccount bank details (provision on demand) + NGN hosted checkout.
  - **Withdraw** — NGN payouts (`POST /fiat/withdrawals` + bank verify/save flow), gated on Didit KYC status (`GET /identity`, `POST /identity/sessions`); USD international transfers later.
- **Checkout upgrade:** replace the external funding link with the in-academy deposit sheet (mobile's `wallet-checkout-sheet.tsx` precedent): shortfall → top-up → sync → retry purchase without leaving the page.
- **Instructor earnings:** withdraw in-academy (same NGN rail), keep the central-dashboard link as fallback.
- **Ops hardening (same phase):** schedule `reconcile-orders.mjs --heal` and an earnings-clearing tick as Coolify scheduled tasks (the wallet repo's `run-cron.mjs` pattern); verify production `WALLET_BASE_URL`/`WALLET_SERVICE_TOKEN` in Coolify; confirm web + Go academies point at the **same** Mongo DB and same `academy` branch token (else reconcile sees half the picture).

### CBT exams

- New models (all additive):
  - `Exam` — `course` (1:1 for v1), `title`, `settings {durationMinutes, passMarkPercent, maxAttempts, shuffleQuestions, shuffleOptions, showResults}`, `status draft|published`, `questionCount` cache.
  - `Question` — `exam`, `type: "single"|"multi"` (v1 = MCQ only), `prompt` (rich text), `options[] {id, text}`, `correctOptionIds[]` (**never serialized to students**), `points`, `order`.
  - `ExamAttempt` — `user`, `exam`, `course`, `enrollment`, `attemptNumber`, `startedAt`, `deadlineAt` (**server-authoritative** = start + duration), `answers {questionId → optionIds[]}` (autosaved), `status in_progress|submitted|expired|passed|failed`, `scorePercent`, `submittedAt`. Partial unique index: one `in_progress` per `{user, exam}`.
- `Course` additive field `examRequired: boolean`; `Enrollment` additive fields `examPassed`, `examPassedAt`, `bestScorePercent`.
- Flow: instructor builds exam in course editor → student unlocks it at 100% lesson progress → timed runner (server deadline, autosave every ~10s, submit or auto-expire grades server-side) → pass sets `enrollment.examPassed` → completion/certificate gate.
- **Gate enforcement in both backends:** web — `completeLesson` auto-complete, `markCourseComplete`, and `certificates.ts` eligibility all require `!course.examRequired || enrollment.examPassed`. Go — same guard in lesson-complete auto-completion and both certificate endpoints; mobile shows "exam required — take it on the web" until a mobile exam UI exists (backlog).
- Integrity v1: server-side grading + deadline, correct answers never leave the server, attempt cap, shuffle. (Proctoring/anti-cheat beyond that is explicitly out of scope.)

### Notifications (enabler, not headline)

Minimal real `Notification` model (`user`, `type`, `title`, `body`, `href`, `readAt`) + server action emitters + Ably `notification:new` event (additive type) + swap the mock bell to real data. First consumers: application status changes, interview invites, refunds, exam results.

---

## Part 3 — Phase-by-phase plan

Ordering rationale: Admin must exist before applications can be reviewed; applications before interviews; wallet is independent (can run in parallel after Phase 1); exams last (biggest greenfield + only phase requiring coordinated Go changes beyond a single endpoint).

### Phase 0 — Foundations & safety rails (~2–3 days)
1. `middleware.ts`: add `/admin(.*)` to the protected matcher.
2. Scaffold `app/(admin)` route group: cloned layout/sidebar/bottom-nav, **role-gated layout**, empty overview page. Topbar `labelMap` entries.
3. Web `User` schema: declare `linkedAuthIds: string[]`, `instructorStatus` (default `"none"`).
4. Notification model + actions + real bell wiring (replaces `MOCK_NOTIFICATIONS`).
5. Ops: Coolify scheduled tasks for `reconcile-orders.mjs` (report-only first) ; verify prod `WALLET_*` env; **verify Go academy DB = web DB** (one-line check against both configs).
6. Pre-flight cleanups touching our path: resolve the `/` route collision (`app/page.tsx` vs `app/(marketing)/page.tsx`); note-but-don't-fix the legacy client-passed-identity actions except where admin builds on them.
- **Exit:** `/admin` exists (empty, ADMIN-only), notifications real, crons ticking.

### Phase 1 — Admin core (~4–6 days)
1. Users page: list/search/filter, detail drawer (enrollments, orders, applications), **role management** writing Mongo + web-Clerk `publicMetadata` (Clerk backend SDK), with an "ADMIN unlocks mobile Vision admin" warning in the UI.
2. Payments ops: Orders browser (status, history, PaymentEvents), one-click **refund** → existing `refundEnrollment`; earnings ledger view; reconcile report page (extract script core into `lib/reconcile.ts`, script becomes a thin wrapper).
3. Courses moderation: status lifecycle actions, review moderation (`isApproved/isHidden` finally get actions + UI).
4. First-admin grant script (`scripts/grant-admin.mjs` — Mongo + Clerk).
- **Exit:** admins manage users/roles/payments/courses; refunds have a UI.

### Phase 2 — Instructor application & onboarding (~4–6 days)
1. `InstructorApplication` model + server actions (`submitApplication`, `withdrawApplication`, `getMyApplication`, admin: `listApplications`, `reviewApplication`, `decideApplication`).
2. Applicant UX: `/dashboard/become-instructor` — multi-step form (OnboardingFlow pattern; R2 presigned sample-video upload), status tracker page, notifications + 2 new email templates (received / decision).
3. Approve path: sets `role: INSTRUCTOR` + `instructorStatus: "approved"` + seeds `instructorProfile` + Clerk metadata write-back.
4. **Gating flip (same release):** `(instructor)` layout + `getAuthenticatedInstructor()` require INSTRUCTOR|ADMIN; non-instructors see "apply" CTA. Grandfather script for existing course owners.
5. **Go patch (same release):** `POST /me/become-instructor` → 410 or creates an application doc; mobile profile button copy handled gracefully (Go returns explicit error code mobile already toasts).
- **Exit:** becoming an instructor requires an approved application on **every** platform.

### Phase 3 — Interview links (~3–4 days)
1. Meeting model: `applicationId?`; create-path variant with `scheduledAt` + `status:"scheduled"`; `startScheduledMeeting` action; surfacing in `getMyMeetings`/invites (fields already queried).
2. Admin: "Schedule interview" on application detail (date/time picker) → scheduled meeting (waiting room on), applicant invite = notification + **interview email template** (third `lib/email.tsx` template, scheduled-variant copy exists) + `?join=` deep link.
3. Application auto-transitions `interview_scheduled`; interview outcome (notes/verdict) recorded on the application; decision then follows Phase 2 flow.
4. Verify mobile renders `status:"scheduled"` meetings benignly in its lists (additive status value — confirm Go store copes; it already queries "scheduled" in invite lookups).
- **Exit:** admin schedules an interview in two clicks; applicant gets email + bell + a link that just works; outcome feeds the decision.

### Phase 4 — Wallet section (~5–7 days, can overlap Phases 2–3)
1. Proxy layer: extend `lib/wallet.ts` with typed read/write wrappers (dollar account, fiat wallet, deposits + sync, withdrawals, banks, identity/KYC), actor forwarding, per-call idempotency keys; new `lib/actions/wallet.ts` actions; react-query hooks + `queryKeys.wallet`.
2. `/dashboard/wallet` overview (balances + unified feed), `/deposit` (USD checkout w/ return-and-sync UX; NGN subaccount details + checkout), `/withdraw` (NGN: KYC gate → bank verify/save → payout; history with status sync-on-read).
3. Checkout integration: inline top-up sheet on insufficient funds (shortfall presets → deposit → sync → retry purchase).
4. Instructor: withdraw from earnings page via the same rail; earnings-clearing scheduled tick (removes the "instructor must visit dashboard" dependency).
5. Sidebar/nav entries (student + instructor), Vivid prompt awareness note.
- **Exit:** users fund, view, and withdraw without leaving the academy; checkout never dead-ends on an empty wallet.

### Phase 5 — CBT exams (~7–10 days)
1. Models (`Exam`, `Question`, `ExamAttempt`) + `Course.examRequired` + `Enrollment.examPassed/bestScorePercent`.
2. Instructor exam builder inside course editor (questions CRUD, settings, publish; TipTap for prompts).
3. Student runner: entry card on learn/completion surfaces at 100% progress → full-screen timed runner (server `deadlineAt`, autosave, tab-safe resume of `in_progress`) → server-side grading → results screen + attempts history + retake rules.
4. Gates: web completion/certificate paths honor `examRequired && !examPassed`; certificate page shows "pass the exam to unlock".
5. Admin oversight: attempts list per exam, reset-attempts action.
6. **Go patch list (same release):** completion/certificate guards mirrored; mobile completion screen copy for "exam required on web".
- **Exit:** paid courses can require a passed CBT exam before completion/certificate — enforced at the data layer on both platforms.

### Phase 6 — Backlog (explicitly deferred)
Push notifications (no push infra exists on any platform) · mobile exam runner (in the `worldstreet-app` merge shell) · direct-browser wallet calls (wallet env change) · USD international transfers UI · review-queue for course publishing · consolidating the duplicate course-CRUD stacks + dead-code sweep (`lib/cloudinary.ts` stubs, `lib/mock-data.ts`, legacy providers) · partial refunds (wallet service limitation).

---

## Part 4 — Cross-repo coordination checklist

| When | Repo | Change |
|---|---|---|
| Phase 2 | `worldstreet-academy/backend` (Go) | Gate/replace `POST /me/become-instructor`; recognize `instructorStatus` (read-only) |
| Phase 3 | Go | Confirm `status:"scheduled"` meetings list/join benignly |
| Phase 5 | Go | Completion + certificate endpoints honor `examRequired`/`examPassed` |
| Phase 0/4 | Coolify | Cron: reconcile + earnings clearing; verify `WALLET_*` env; confirm single shared Mongo DB across web/Go |
| Any role work | web-Clerk | Write `publicMetadata.role` alongside Mongo `users.role` |
| Never | all | New role **values**, changed Ably payload shapes, semantic changes to `orders`/`enrollments` statuses without a both-repos release |

## Phase 6 (proposed) — In-course knowledge checks

The final CBT gates the certificate; knowledge checks are small quizzes INSIDE the course
(per lesson/section) that keep learners engaged and surface weak spots early.

**Design (reuses the entire Phase-5 engine):**
- `Exam.scope: "final" | "lesson"` + `Exam.lesson?: ObjectId` (additive fields; the unique
  course index becomes partial on `scope: "final"`). Questions/attempts unchanged.
- `Lesson.quizExamId?: ObjectId` (additive — Go/mobile ignore it safely; lesson `type` is
  NOT extended, which would break the mobile player switch).
- Learn player: after a lesson's content, render the quiz inline (reuse the runner in
  compact mode — untimed or short-timed, generous attempts, instant per-question feedback
  since `showResults` already exists).
- v1 is **non-blocking practice** (zero mobile risk). v2 adds an optional
  "must pass to complete this lesson" toggle — that flips lesson completion (and therefore
  progress %) into a gate, which needs the Go `POST /lessons/{id}/complete` path patched in
  the same release, exactly like the Phase-5 completion gate.
- Instructor UX: "Add knowledge check" button per lesson in the lesson manager, opening the
  same question-builder dialog.

Estimate: 3–4 days (v1), +2 days (v2 blocking mode incl. Go patch).

## Phase 7 (proposed) — Instructor pipeline overhaul (end-to-end hardening)

What exists today (Phases 0–3) is already end-to-end: apply → admin queue → review notes →
interview (scheduled RTK room + email + waiting room) → approve (auto-promotion, profile
seeding, Clerk mirror) / reject (reason, re-apply). The overhaul closes the operational gaps:

1. **Richer application** — sample-video/CV upload to R2 (presigned, like course media)
   instead of URL-only; terms-of-teaching acceptance checkbox recorded on the application;
   minimum-profile check (name + avatar) before submit.
2. **Admin ops** — reviewer assignment (`assignedTo`), SLA badges in the queue (>48h
   unreviewed), expertise filters, CSV export; admins get an email (not just a bell) on new
   applications.
3. **Interview scheduling negotiation** — admin proposes 2–3 slots, applicant picks one
   (application status `slots_proposed`); ICS calendar attachment on the invite email;
   automated T-24h and T-1h reminder notifications (cron); no-show handling (reschedule or
   auto-move back to under_review after 30 min).
4. **Structured scorecard** — rubric on the interview (expertise depth, communication,
   production readiness, 1–5 each + recommendation) stored on the application; decision
   dialog pre-filled from the scorecard.
5. **Decision hygiene** — rejection reason taxonomy + free text; enforced re-apply cooldown
   (e.g. 30 days, checked in submitInstructorApplication); optional waitlist state.
6. **Post-approval onboarding** — first-login instructor checklist (complete profile,
   upload signature, verify payout KYC, create first course draft); rev-share agreement
   acceptance recorded with timestamp/version.
7. **Comms completeness** — emails at every transition (submitted ✓, under-review, slots
   proposed, interview scheduled ✓/rescheduled ✓, reminders, decision ✓); one shared
   template layout.
8. **Mobile parity** — Go read-only endpoints: `GET /me/instructor-application` (status
   card in the mobile profile) and later `POST` to apply from mobile.
9. **Funnel analytics** — applications by status over time + conversion % on the admin
   overview.

Estimate: 5–7 days. Highest-value first: (3) scheduling negotiation + reminders,
(1) uploads, (5) cooldown, (7) comms.

## Part 5 — Risk register (top 5)

1. **Mobile bypass window** — instructor gating shipped on web before the Go patch = applications are theater. Mitigation: Phase 2 ships both or web-first with the Go endpoint disabled the same day.
2. **Wallet env unknowns in production** — `.env.local.production` predates WA-01; if Coolify lacks `WALLET_*`, all money paths fail closed (by design) but the wallet page would launch dead. Mitigation: Phase 0 verification.
3. **Certificate semantics fork** — exams gated only on web let mobile mint certificates for unpassed courses. Mitigation: data-level gate + Go patch in the same phase; `examRequired` defaults false so existing courses are untouched.
4. **Role writes clobbered** — future auth changes re-syncing from Clerk could overwrite Mongo roles. Mitigation: always dual-write role to Clerk metadata (Phase 1 does this from day one).
5. **Reconcile blind spots** — if web and Go academies point at different DBs/tokens, orders exist the reconciler never sees. Mitigation: Phase 0 verification before any new money flows.
