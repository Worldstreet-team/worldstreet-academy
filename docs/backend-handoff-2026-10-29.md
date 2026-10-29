# Backend handoff — Academy corrections (2026-10-29)

**For:** the backend developer: the owner of the Go mobile API (`worldstreet-academy/backend`), the central Worldstreet Wallet service and the production environment (Coolify, MongoDB).
**From:** the web app (`worldstreet-academy`, Next.js), branch `blueprint/complete`.
**Why:** Owen's corrections of 2026-10-28 and the "WMA Website & Platform Corrections Brief":
- faculty is the Academy only;
- the tutors' marketplace is open to anyone;
- outside tutors move to the marketplace;
- every faculty course sells Basic $49, Standard $99 and Executive $199;
- payments must work.

The web side is done. This list is what has to happen outside the web app before those changes are true in production and on mobile.

Detail lives in two places:
- The Go rules are in `docs/go-patches-phase-3.md` §21 (R16, R17), with the release order in its §0.
- The production steps are in `docs/launch-runbook.md`.

If this document and the code disagree, the code wins.

---

## 1. What this push changes (web)

| Area | Change |
|---|---|
| **Price list** | Every plan of every school program sells at Basic $49 · Standard $99 · Executive $199 (`PROGRAM_PRICE_LIST`, `lib/entitlements.ts`). The plan editor shows the price read-only. The server writes the list price whatever is posted, and refuses a paid program with no plan turned on (it may still be free). The catalogue script carries the same ladder, with no struck-through "was" price. |
| **Academy-only faculty** | Learners never see the account that owns the programs as a tutor. Programs and New Economy courses credit "WorldStreet Mastery Academy faculty" with the gold mark, or the faculty an admin assigned. That covers the dashboard, My programs, the course and lesson pages, Executive mentorship, checkout, certificates, `/verify` and the Vivid assistant. Marketplace courses credit their creator by name, faculty included; only an admin-owned course credits the Academy. |
| **Open marketplace** | Anyone can sell: the seller application approves itself and opens the creator area at once. One sent before this change approves itself when its applicant next opens `/dashboard/sell/apply`. Every creator course still passes the four recorded review checks before it goes live. |
| **Tutors to the marketplace** | `scripts/move-tutor-courses.mjs` (dry run by default) turns non-Academy courses listed as programs into marketplace courses in the review queue, clears their plan ladder and makes their owner a Marketplace Creator. In production that is Nwakwesi Milash's two courses. |
| **Payments page** | New `/dashboard/payments`: each learner's purchases with plan, amount, method (wallet or ESPEE) and status (paid, processing, in review, failed, being refunded, refunded, declined). Read-only; no money moves. |
| **Brief alignment** | The brand promise "Learn. Master. Build Wealth." (footer and `/academy`). The menu adds Cohorts, Become an Instructor and Sell on the marketplace, and the guest button reads "Join WMA". |
| **Payments** | No code change was needed. The wallet purchase was re-verified end to end on the local mock wallet: Data Analysis Standard charged $99 once despite a double-click, then the order, enrollment and pending earning were written. In production it works only once §2's wallet setup is live. |

## 2. Required before the first sale — payments

### B1. Wallet service: register the Academy and confirm the API it calls

The Academy never holds a balance. It calls the central wallet server-to-server (`lib/wallet.ts`), with header `X-Wallet-Service-Token: <token>` and, on money writes, `Idempotency-Key`. Amounts are integer US cents. **Without both env vars below, every paid enrollment fails closed** ("Payments are temporarily unavailable"). That is safe, but nothing sells.

- [ ] Register the Academy's service token on the wallet as `academy:<token>` in `WALLET_SERVICE_TOKENS`.
- [ ] Confirm these endpoints exist in production and behave as described:

| Method and path (`/v1/wallet/{authUserId}/…`) | Used for | Must |
|---|---|---|
| `GET …/balances` | Top-bar balance, checkout | Return `USD` and `NGN`, each with `availableMinor` and `lockedMinor`. |
| `POST …/charges` | Every purchase | Be idempotent on `Idempotency-Key` (the web reuses `academy_enroll_<userId>_<courseId>_<plan>` on retries) and replay the stored response for 24 h. Answer `409 INSUFFICIENT_BALANCE` with `details.availableMinor` when short. |
| `POST …/charges/{id}/refund` | Admin refunds, failed-enrollment compensation | Re-credit the buyer. Be safe to call twice. |
| `GET …/charges/{id}` | Reconciliation | Return `status: "succeeded" \| "refunded"`. |
| `POST …/credits` | Instructor, seller and referral payouts (`/api/cron/earnings`) | Be idempotent on the earning's `creditReference`. |
| `…/dollar/*`, `…/fiat/*`, `…/identity/*`, `GET …/charges` | The wallet, deposit and withdraw pages | As the hub already uses them. |

**Acceptance:** with a real funded test account, buy a program plan on production. The wallet shows one debit of exactly the plan price, the learner lands on "Payment successful", and `/admin/payments` lists the order as enrolled.

### B2. Production environment (Coolify)

- [ ] `WALLET_BASE_URL` and `WALLET_SERVICE_TOKEN`: required, read at runtime.
- [ ] `NEXT_PUBLIC_WALLET_FUNDING_URL` and `NEXT_PUBLIC_WALLET_WITHDRAW_URL`: optional. Without them, learners top up and withdraw on the Academy's own wallet pages.
- [ ] `CRON_SECRET`, plus the Coolify scheduled tasks in runbook §5. `academy-earnings` runs `/api/cron/earnings` every 15 minutes and moves matured earnings into wallets; it answers `503 wallet_disabled` without B1.
- [ ] ESPEE (pay by transfer, admin approves the receipt):
  - `ESPEE_PAYMENT_DETAILS`, the details learners pay to;
  - `R2_RESOURCES_BUCKET_NAME`, the private bucket with no public access, whose CORS allows `PUT` with `Content-Type` from `https://academy.worldstreetgold.com`.
  - Without both, the ESPEE option stays hidden.

**Acceptance:** each cron task's log shows `200 {"ok":true,…}` (runbook §5 "Check").

### B3. Confirm who receives the programs' sales share — a decision, not code

A program sale books 85% to the program's owner, `courses.instructor`, as a pending `earnings` row. After 7 days the earnings cron credits that account's wallet. **All 12 programs are owned by `samsonrichfield@gmail.com`, named "Thy Richfield".** The web now hides that name from learners, but the money rule is unchanged.

- [ ] Confirm that account's wallet is the Academy's own, and who controls it.
- If it is a person's, Owen picks one before the first paid sale:
  1. **Re-own the programs to an Academy account.** A data change, plus the scripts' `OWNER_EMAIL`.
  2. **Set the programs' share to 0%**, so the Academy keeps the whole sale. That is a small web change (the program row of `splitSale` in `lib/referrals.ts`), made only on Owen's word.
  3. **Accept it as is.**

  Faculty pay stays outside the app either way.

## 3. Go API (mobile) — from `docs/go-patches-phase-3.md`

In release order. "§" means a section of that file.

- [ ] **§9 `kind` filter.** Required before `scripts/move-tutor-courses.mjs --apply`; it may already be live. Every mobile program list must match `kind: { $nin: ["marketplace", "new-economy"] }`, or Milash's courses stay on mobile as Academy programs. An enrolled learner must still open an archived course they bought.
- [ ] **R15.** Required before any template or guide is approved. Templates and guides grant no services.
- [ ] **R16, the price list.** Required only if Go writes `courses.packages`, has its own plan-price table or prints prices from copy. Program plans are 49 / 99 / 199; Go charges `package.price × 100` (R5). If Go only reads the data, the catalogue apply is enough.
- [ ] **R17, the Academy credit.** Recommended for this release. Mobile still prints the owner account's name ("Thy Richfield") on every program card, course page, "my courses" row and certificate.
  - Programs and New Economy courses credit "WorldStreet Mastery Academy faculty".
  - Marketplace courses credit their creator, unless an admin owns them.
  - Assigned teaching faculty (§20) are named where learners meet their teachers.
- [ ] **No patch needed** for the open marketplace (self-approved `sellerapplications`, `users.sellerStatus: "approved"` on submit). Go still never publishes a `USER`-owned course and never writes `review.*` (§9).
- [ ] **Still open from earlier releases.** R1–R11 (plan gating, §2 and §5), R12 (school slugs, §15) and R14 (admin levels, §12), if any has not shipped. Please answer §4's questions, above all whether mobile has a purchase or free-enrol endpoint (R5).

## 4. Production data steps, after the deploy

Whoever holds the production URI runs these, in this order. Each script is a dry run without `--apply`, and refuses `--apply` unless `MONGODB_URI` is on the command line. **`.env.local`'s URI is production.**

1. [ ] **Catalogue prices.** `node scripts/mastery-catalogue.mjs` (read the boxed warning: every program changes to 49/99/199), then `MONGODB_URI="$PROD_URI" node scripts/mastery-catalogue.mjs --apply --allow-price-change`.
2. [ ] **Tutors to the marketplace.** `node scripts/move-tutor-courses.mjs`, check the two courses it lists, then `MONGODB_URI="$PROD_URI" node scripts/move-tutor-courses.mjs --apply`.
   - The courses leave the program catalogue at once.
   - They return on the marketplace, under the tutor's name, when an admin approves them at `/admin/courses?review=pending`. That takes four checks.
   - Buyers keep access.
3. [ ] **Roles.** For each owner the dry run listed as still holding INSTRUCTOR, an admin sets the account to Student at `/admin/users`. They keep the creator area through `sellerStatus`.
4. [ ] **Waiting seller applications.** Nothing to run: one sent before this change approves itself when its applicant next opens `/dashboard/sell/apply`. New ones approve themselves on submit.
5. [ ] **Smoke test.** Run the B1 acceptance purchase. Refund it from `/admin/payments`, or keep it, and confirm the refund re-credits the wallet.

## 5. Infrastructure items from the brief (§15)

These are outside the web app's code. Please confirm or schedule each:

- [ ] **Backups and point-in-time recovery** for the production MongoDB; it is shared with Go.
- [ ] **Production monitoring and alerting**: container health, 5xx rate, cron failures, and wallet `5xx`/timeouts. The web logs `[Payments] ORPHANED CHARGE` when a refund fails after a charge, so alert on it.
- [ ] **Rate limiting at the edge** for `/api/*` and the sign-in hub. The web limits `/verify` lookups only; ESPEE proof uploads have no limit.
- [ ] **Payment callbacks.** The Academy takes no payment webhooks: charges are synchronous and confirmed server-to-server, and the client is never trusted. Card and bank deposits are the wallet's own (Flutterwave), synced through `…/deposits/{txRef}/sync`. The wallet should verify those provider webhooks and stay idempotent.

## 6. Questions for the backend owner

1. Is the Academy's wallet token registered in production, and is `WALLET_BASE_URL` reachable from the Coolify container?
2. Whose wallet is `samsonrichfield@gmail.com` (B3)?
3. Does mobile sell anything (a purchase or free-enrol endpoint)? If yes, R5 and R16 apply in full.
4. Which Go endpoints return an instructor name or render certificates (R17)?
5. Does Go write `courses.packages` or `users.role`? (R16, R14.)
6. The brief proposes new roles: Employer, Academic Admin, Finance Admin and Support Admin. `users.role` is shared with Go, so any new value needs a joint plan before the web adds it.

---

## Appendix — status of the corrections brief (web app, 2026-10-29)

The brief asks the team to classify every item. The statuses are:
- **Done:** built and checked in a local run with the roles involved.
- **Built:** in the code, and still needs the production QA pass (runbook §8).
- **Partial:** some of the item exists.
- **Not built.**
- **Decision:** needs management approval; the brief itself flags pricing, durations, score weights, thresholds and commissions.
- **Backend:** the backend or infrastructure owns it.

Owner names and target dates are Owen's to fill.

| § | Item | Status | Where / note |
|---|---|---|---|
| 2 | "The Academy of the New Economy", Wealth Liquefaction | Built | `lib/brand.ts`, `lib/institution.ts`, landing |
| 2 | Brand promise "Learn. Master. Build Wealth." | Done | `BRAND.promise`: the footer of every public page and the `/academy` title (this push) |
| 2 | Premium system: charcoal and gold, readable type, responsive | Built | WorldStreet design system (stone `#0C0A09`, gold, Manrope). The brief says navy; the system is charcoal |
| 3 | Nav: Home, Academy, Schools, Programmes, Marketplace, Login | Built | `components/marketing/navbar.tsx` |
| 3 | Nav: Cohorts, About, Become an Instructor, Join WMA | Done (menu) | This push: the menu lists Cohorts (`/calendar`), The Academy (the about page), Become an Instructor (`/teach`) and Sell on the marketplace (`/sell`), and the guest button reads "Join WMA". The desktop bar keeps three links so it fits at 1024px; adding more there is a design call |
| 3 | Nav: Opportunity Hub, Become a Partner | Not built | No pages. WMA Partners lives in the dashboard (`/dashboard/referrals`) |
| 3 | Homepage, school pages | Built | Phases 11–13. School faculty sections are hidden while `FACULTY_PUBLIC` is off |
| 3 | Every link, form and CTA on desktop and mobile | Built | All-role crawl, 127 routes × 2 viewports (2026-10-19). Re-run on staging after this push |
| 4 | Academy world | Built | Schools, programs, cohorts, classes, recordings, assessments, mentorship, certificates, communities |
| 4 | Marketplace distinct from official faculty | Done | This push: creators named, Academy programs credited to the Academy |
| 4, 11 | Opportunity Hub (whole section) | Not built | Scope, data source and verification owner are needed first (P1) |
| 5 | Seven schools; programme vs plan | Built | `lib/schools.ts` (Phase 13); plans per program |
| 5 | Duration, curriculum, price and cohort per programme | Built | Plan duration per program, cohorts at `/admin/cohorts`. Prices now follow the price list (Owen) |
| 6 | Prices | Done | Owen's 49 / 99 / 199 replaces the brief's 49 / 199 / 999 |
| 6 | "Regular" prices $300 / $1,000 / $10,000 | Decision | Not shown. Against the new prices they would read as 84%, 90% and 98% off |
| 6 | Referral 10% / 12% / 15% by plan | Decision | The web pays 10% of a referred learner's first paid purchase on any plan (`lib/referrals.ts`) |
| 6 | Enrol only after verified payment or admin override; no duplicates | Done | Verified locally: $99 charged once despite a double-click. Admin overrides at `/admin/enrollments` and ESPEE approval |
| 6 | Inclusions, duration, price and next steps before checkout | Built | Program page and checkout summary |
| 6 | Cancellation and refund policy before checkout | Partial | Checkout says a failed enrollment is refunded. There is no policy text; the hub's legal documents need a refund clause and a link |
| 6 | Pending, success, failed, retry, reconciliation; audit trail | Built | `orders` states and `paymentevents`, `/dashboard/checkout/pending`, `scripts/reconcile-orders`. Learners see each state at `/dashboard/payments` (this push) |
| 7 | My Courses, Classes, Recordings, Assignments, Assessments, Projects, Mentorship, Messages, Communities, Points, Mastery Score, Certificates, Profile, Support | Built | Dashboard sidebar. Projects are assignments of kind `project` |
| 7 | Payments module | Done | `/dashboard/payments` (this push): every purchase with plan, amount, method and status. Balance and top-ups stay on Wallet |
| 7 | Plan permissions, deadlines, grading, feedback | Built | `lib/entitlements.ts`, `lib/actions/assignments.ts` |
| 8 | Score explained, credential tiers with issue date | Built | `/certification`, dashboard Mastery card, three WMA credentials |
| 8 | Proposed weights 15 / 25 / 20 / 25 / 15 | Decision | Live weights are D24: 30 / 25 / 20 / 10 / 15. Not changed without approval |
| 9 | Faculty: application → review → interview or demo → approval → onboarding → access | Built | Phase 19, the handbook |
| 9 | Faculty restricted to assigned courses; faculty distinct from creators | Done | Teaching faculty (`lib/teaching.ts`); credit rule this push |
| 10 | Creator application, submission, four-check review, approval, updates, takedown | Done | Now open to anyone (this push), including applications that were waiting. Course review unchanged |
| 10 | Product page: creator, format, price, preview, reviews, CTA | Built | `/programs/<slug>` for marketplace items |
| 10 | Creator analytics and sales reporting | Partial | Sellers see earnings and payout status. The analytics pages are faculty-only |
| 12 | Codes and links, clicks, commission on verified sales, no self-referral or duplicates | Built | Phase 18 WMA Partners, `/admin/partners` CSV |
| 12 | States approved and rejected; payout history; partner tiers | Partial / Decision | Earnings are pending, available, then reversed. Tiers don't change rates without an approved rule |
| 13 | Users, roles, programs, plans, cohorts, faculty, content, marketplace, partners, payments, certificates | Built | `/admin/*`; schools are fixed in code |
| 13 | Announcements, support desk, opportunities | Not built | No admin surfaces yet |
| 13 | Audit of roles, payments and overrides, publication | Built | `users.adminAudit`, `paymentevents`, recorded review checks |
| 13 | Roles: Partner, Employer, Academic, Finance and Support Admin | Decision / Backend | Live: Student, Faculty, Marketplace Creator (`sellerStatus`), Admin, Super admin. New roles need Go (§6 Q6) |
| 14 | Email and in-app alerts for enrollment, payment, classes, grades | Built | `lib/email.tsx`, the bell, `/api/cron/reminders` |
| 14 | Notification preferences; opportunity and commission alerts | Not built | — |
| 15 | Auth, authorization, protected paid content, validation | Built | Clerk with role gates per layout, private R2 with signed URLs, Zod on every action |
| 15 | Rate limiting, backups, monitoring | Backend | §5 above |
| 16 | P0: navigation, auth, payment and enrollment, access | Partial | Payment code is done and verified locally; production needs B1–B3. The nav labels need a decision |
