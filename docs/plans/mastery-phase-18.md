# Mastery Academy — Phase 18 Implementation Plan (WMA Partners)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The referral program becomes the WMA Partners Program (institutional blueprint §15):
- every account's referral code is its **Partner Code**;
- partner links count clicks, once per visitor per code per day;
- the partner dashboard shows clicks, sign-ups, paying learners, revenue and commission;
- faculty reach it from their sidebar (§16, "Faculty Dashboard … WMA Partners");
- admins see every active partner and export a CSV.

Commission amounts and rules do not change.

**Architecture:**
- **Clicks.** A pure rules module, `lib/partner-clicks.ts`, and a new web-only collection, `partnerclicks`, with one row per code per Lagos day holding a counter. A server action, `recordPartnerVisit`, does the counting. A client component that renders nothing calls it; the marketing layout mounts that component. Middleware is not touched.
- **Numbers.** `referralSummary` in `lib/referrals.ts` gains `clicks` and `revenueMinor`. It already returns the sign-ups, paying learners and commission. The admin loader `partnerRows()` sits beside it, so all the commission arithmetic lives in one file.
- **Money is read-only.** No write path changes.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict · Mongoose 9 · Zod (`zod/v4`) · Tailwind v4 with the WorldStreet design system (`ds/`, `ws-*` tokens) · TanStack Query (admin pages).

**Spec:** `docs/institutional-blueprint.md` §15 and §16. **Roadmap:** `docs/institutional-blueprint-plan.md` Phase 18, decision D28.

**Branch:** `mastery/phase-18`, cut from `feat/institutional`. This is Track C: Phase 19 builds on top of this branch.

## Controller rulings (binding)

1. **The route stays `/dashboard/referrals` for everyone** (roadmap 18.1). There is no `/instructor/partners`; the faculty item links to the shared page, as "Refer & earn" does today.
2. **Where a visit is recorded.**
   - `PartnerVisit` (client) is **always** mounted in `app/(marketing)/layout.tsx`, because a server layout cannot read the query string. In an effect, it reads `window.location.search`. It does not use `useSearchParams`, which would need a Suspense boundary on statically rendered marketing pages.
   - Middleware keeps `?ref=` in the URL (it never redirects or strips it) and stays free of database work. A reload therefore re-fires the action, and the `wsa_ref_seen` cookie absorbs it.
   - Every link the app generates points at a marketing page: `/` from the partner page, and `/programs/<slug>` from a creator's course list (`lib/actions/instructor.ts`). Collecting on marketing pages only therefore covers every generated link.
3. **The action's order.** The cheap rejections (shape, bot user agent, already counted today) run **before** `connectDB()`, so a crawler or a reload costs no database round trip. Everything after that follows the house order.
   - **No `revalidatePath`.** Nothing cached shows clicks, and revalidating from an action fired on a marketing page would re-render that page on every visit.
   - **Ignored visits return `{ success: true, data: null }`**, exactly like counted ones, so the action reveals nothing about which codes exist.
4. **"The partner's own visits"** are detected only while the partner is signed in, through `getCurrentUser()`. A signed-out visit by the partner counts; the runbook says so.
5. **Revenue (corrects the roadmap's "first purchases").** `revenueMinor` is the sum of `amountMinor` over Orders where:
   - `attribution.kind` is `"referral"`;
   - `attribution.userId` is the partner;
   - `status` is `paid` or `enrolled`;
   - the payment was by wallet or ESPEE.

   It excludes refunded orders and `seller_link` sales (a creator's own course link). Revenue is everything the code brought in. Commission stays first-purchase-only.
6. **The summary is additive.** The roadmap's `signUps`, `payingLearners` and `commission { pendingMinor, clearedMinor }` already exist as `referredCount`, `paidCount`, `pendingMinor` and `clearedMinor`. They are **not renamed**, so `lib/actions/teaching-home.ts` (the tutor home, the other caller) compiles untouched. Only `clicks` and `revenueMinor` are new.
7. **The explainer states the rule as built** (Task 3 copy). `isFirstPaidPurchase` counts ESPEE orders, and `adminApproveEspeePayment` writes no referral Earning. So a learner whose first purchase was paid by ESPEE, or credited to another code, never earns their referrer a commission.
8. **Faculty entry (18.5).** Faculty (`!seller`) get "WMA Partners" as the last item of `teachItems`. The bottom-group "Refer & earn" row stays only for approved Marketplace Creators (`seller`), relabelled "WMA Partners": every account holds a Partner Code. The tutor home's money card and Vivid's page description take the new name too.
9. **The admin page is a client component**, like every neighbour in `app/(admin)/admin/`. `money()` lives in the `"use client"` module `components/admin/shared.tsx`, so an RSC can't call it. It uses the literal query key `["admin", "partners"]`, so `lib/hooks/queries/keys.ts`, which Tracks A and D also edit, stays untouched.
   - The table and the CSV list **partners with any activity**: clicks, sign-ups, revenue or commission. The page states how many code holders have none.
   - The nav item is "Partners" with `HandshakeIcon`, placed right after "Sellers" in both admin navs.
10. **Go note.** Append one bullet to the existing §8 of `docs/go-patches-phase-3.md`. Don't add a new numbered section: every track would be fighting over "the next free number".
11. **Dates.** The click list reuses the page's existing `day()` formatter, so the page uses one date style. The 30-day window is in Africa/Lagos, like the cohort calendar.
12. **Shared files with other tracks** (keep both sides when merging):

    | File | Also edited by |
    |---|---|
    | `components/platform/app-sidebar.tsx` | Phase 15. Phase 18 changes **one line** there. |
    | `app/(marketing)/layout.tsx` | Phase 12 |
    | `components/admin/admin-sidebar.tsx`, `components/admin/bottom-nav.tsx` | Phases 12 and 21 |
    | `lib/db/models/index.ts` | Phases 12 and 16 |
    | `lib/vivid/prompt.ts` | Phase 12 |
    | The docs | Every phase |

## Global Constraints

- **Never touch the money and attribution path:**
  - `lib/actions/enrollments.ts`, `lib/actions/manual-payments.ts`, `lib/actions/earnings.ts`
  - `lib/db/models/earning.ts`, `lib/db/models/order.ts`
  - `lib/referral-link.ts`, `middleware.ts`
  - everything in `lib/referrals.ts` above the `/* ═══════════════════ the referrals page ═══════════════════ */` banner, except its import block

  Commission stays 10% (`REFERRAL_COMMISSION_RATE`) of a referred learner's first paid purchase, wallet only, once per buyer, cleared after `EARNINGS_CLEARING_DAYS`.
- **Schemas are additive only:** the Go mobile API reads the same MongoDB. No renamed fields, no new enum values on existing fields, no new role values. `partnerclicks` is a new collection that only the web reads or writes.
- **Server actions** follow this order: `connectDB()` → auth or ownership → Zod (`import { z } from "zod/v4"`) → mutate → `revalidatePath()` → return `{ success: true, data } | { success: false, error }`.
  - They never throw across the boundary. Ruling 3 is this phase's only exception to the order.
  - A `"use server"` file may export **only async functions** (types are fine); constants stay unexported.
  - Server actions are callable with any arguments, so validate every input.
- **Identity and gates:**
  - User ids come from `getCurrentUser()` (`@/lib/auth`), never from the browser.
  - Admin actions call `requireAdmin()` (`@/lib/auth/admin`), which throws; catch it into the error shape.
  - Role gates live in each route group's `layout.tsx`. `app/(admin)/layout.tsx` already sends non-admins away.
- **Database access:** call `connectDB()` (default export of `@/lib/db`) first. Models come from the barrel `@/lib/db/models`. Aggregation pipelines don't cast types, so pass `new Types.ObjectId(id)` in `$match`.
- **Local-dev switch:** `process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")` means local http, so cookies are `secure: false`. Mirror the expression in `middleware.ts`.
- **Code hygiene:** no new dependencies, no `any`, no secrets.
- **UI:**
  - The design system is `ds/`, vendored; never edit it.
  - Use `ws-*` and semantic tokens only (`bg-foreground/[0.06]`, `text-muted-foreground`, `bg-ws-chip` …), never a hex.
  - Gold is only for primary CTAs, active nav and brand moments; the click bars are never gold.
  - Icons come only from `@/components/icons` (duotone glyphs). Never lucide, Hugeicons or emoji.
  - Base UI composition uses the `render` prop, never `asChild`.
  - Pills, 20 px cards (`CardShell`), Manrope.
  - Use `·` separators, and `tabular-nums` for every count and amount.
  - Dark is the default theme, and light must read too.
  - RSC-first: `"use client"` only where interaction needs it.
- **Vocabulary (D19, D28):** new strings say **WMA Partners**, **Partner Code** (capitalised, as the blueprint's "WMA Partner Code"), **partner link**, **plan** and **program**. Don't rename strings outside this phase's scope; the vocabulary pass runs last.
- **Anchors are quoted text**, never line numbers.
- **Verification:**
  - No test runner exists, and none may be added.
  - Pure rules are checked with a throwaway `node:assert/strict` script, run with `npx tsx --tsconfig ./tsconfig.json "$SCRATCH/<file>.ts"` from the worktree root.
  - Everything else: `npx tsc --noEmit` (one stale `.next/types` error is not real), `npx eslint <file>` (one file at a time) and driving the route.
  - Write scratch scripts with the Write tool. Bash heredocs break on apostrophes.

## Review Focus

1. **Reloads, page hops and other browsers.** A visitor who reloads `/?ref=CODE`, then opens a program page with the same code, counts once. Another browser counts again, a lowercase `?ref=` included. Covered in Task 2, step 5 (contexts A and B).
2. **Lagos midnight.** A visit at 23:30 UTC belongs to the next Lagos day, and the 30-day window crosses month ends correctly. Covered in Task 1, step 1 (`partnerDay` and `recentDays` assertions).
3. **Refunds, ESPEE and creator links.** Revenue counts only paid or enrolled orders credited to the code as a referral, ESPEE included. A refunded order and a `seller_link` sale don't count. Commission figures are exactly the existing ones. Covered in Task 3, step 6 (fixture expectations).
4. **A CSV opened in a spreadsheet.** A partner named `=HYPERLINK("x")` must not run as a formula. Covered in Task 5, step 7 (the `FIX-0001` row).
5. **Phones at 390 px.** The six stat tiles, the click list and the admin table fit without horizontal page scroll. Covered in Task 3, step 7, and Task 5, step 7.

## Verification server

The controller fills `<PORT>` and `<DBPORT>` for this track. The worktree has no `.env.local`; that is intended.

```bash
netstat -ano | grep -E ":<PORT>|:<DBPORT>"      # must print nothing first
RESEND_API_KEY=re_disabled_local CLOUDFLARE_REALTIME_API_KEY=disabled-local OPENAI_API_KEY=disabled-local \
ABLY_API_KEY=disabled-local R2_SECRET_ACCESS_KEY=disabled-local WALLET_SERVICE_TOKEN=disabled-local \
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_bG9jYWwuZGV2JA MOCK_DB_PORT=<DBPORT> PORT=<PORT> node scripts/dev-mock.mjs
MONGODB_URI=mongodb://127.0.0.1:<DBPORT>/worldstreet-academy node scripts/mastery-catalogue.mjs --apply
```

**Personas.** Switch personas with the `mock_persona` cookie: `guest` (signed out), `student`, `instructor` or `admin`. With no cookie you are `student`. No new persona is needed. Stop the server when the phase is done.

**Helpers.**
- Create one scratch directory outside the repository, once (`mktemp -d`), and reuse its literal path as `$SCRATCH`. Shell variables don't survive between tool calls, so paste literal values.
- `text` is Phase 11's page-text helper. It strips scripts and tags, so the RSC payload never counts as rendered copy.

```bash
BASE=http://localhost:<PORT>
text() { curl -s ${2:+-b "mock_persona=$2"} "$BASE$1" | perl -0pe 's#<script\b.*?</script>##gs; s#<style\b.*?</style>##gs; s#<[^>]+># #g; s#&\#x27;#\x27#g; s#&quot;#"#g; s#&amp;#&#g; s#\s+# #g'; }
```

**Warm up every persona once, before Task 2, with no `?ref=`.** The first request a seeded persona makes links its account, and that sync would attribute it to whatever `wsa_ref` cookie the request carries. Without the warm-up, Task 2's instructor visit would turn the instructor into one of the student's sign-ups.

```bash
text /dashboard/referrals student >/dev/null; text /instructor instructor >/dev/null; text /admin admin >/dev/null
```

`$SCRATCH/page-text.cjs` reads a page that loads its data in the browser. The tutor home (`/instructor`) and the admin pages are client-rendered, so `text` can't see their content.

```js
// NODE_PATH="$(npm root -g)" node "$SCRATCH/page-text.cjs" <BASE> <persona> <path> "<text to wait for>"
const { chromium } = require("playwright")
const [base, persona, path, waitFor] = process.argv.slice(2)
;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.addCookies([{ name: "mock_persona", value: persona, url: base }])
  const page = await ctx.newPage()
  await page.goto(base + path)
  await page.getByText(waitFor).first().waitFor({ timeout: 30000 })
  console.log((await page.locator("body").innerText()).replace(/\s+/g, " "))
  await browser.close()
})()
```

`$SCRATCH/db.mjs` reads the mock database. Run it from the worktree root, so `mongoose` resolves:

```js
// MONGODB_URI=mongodb://127.0.0.1:<DBPORT>/worldstreet-academy node "$SCRATCH/db.mjs" <code|clicks|slug> [arg]
import { createRequire } from "node:module"
const mongoose = createRequire(`${process.cwd()}/package.json`)("mongoose")
await mongoose.connect(process.env.MONGODB_URI)
const db = mongoose.connection.db
const [cmd, arg] = process.argv.slice(2)
if (cmd === "code") console.log((await db.collection("users").findOne({ email: arg }))?.referralCode ?? null)
if (cmd === "clicks") console.log(JSON.stringify(await db.collection("partnerclicks").find({ code: arg }, { projection: { _id: 0, day: 1, count: 1 } }).sort({ day: -1 }).toArray()))
if (cmd === "slug") console.log((await db.collection("courses").findOne({ status: "published" }, { sort: { title: 1 } }))?.slug)
await mongoose.disconnect()
```

`$SCRATCH/fixture.mjs` gives the partner dashboard (Task 3) and the admin table (Task 5) known numbers. Run it, the same way as `db.mjs`, after the warm-up; it is re-runnable. It writes:
- four learners referred by the student;
- one buyer who is not referred, for a creator's own-link sale;
- a second partner, `FIX-0001`, whose first name is a spreadsheet formula;
- orders, referral earnings and clicks.

```js
import { createRequire } from "node:module"
const mongoose = createRequire(`${process.cwd()}/package.json`)("mongoose")
await mongoose.connect(process.env.MONGODB_URI)
const db = mongoose.connection.db
const { ObjectId } = mongoose.Types
const me = await db.collection("users").findOne({ email: "student@worldstreet.academy" })
const course = (await db.collection("courses").findOne({ status: "published" })) ?? (await db.collection("courses").findOne({}))
const code = me.referralCode
const day = (ago) => new Date(Date.now() + 3600_000 - ago * 86400_000).toISOString().slice(0, 10) // Lagos = UTC+1
const old = await db.collection("users").find({ email: /@partners\.test$/ }).project({ _id: 1 }).toArray()
await db.collection("users").deleteMany({ _id: { $in: old.map((u) => u._id) } })
await db.collection("orders").deleteMany({ reference: /^fixture-/ })
await db.collection("earnings").deleteMany({ creditReference: /^fixture-/ })
await db.collection("partnerclicks").deleteMany({ code: { $in: [code, "FIX-0001"] } })
const now = new Date()
const user = (k, firstName, extra = {}) => ({ _id: new ObjectId(), authUserId: `fixture_${k}`, email: `${k}@partners.test`, username: `fixture-${k}`, firstName, lastName: "Fixture", role: "USER", referralCode: null, referredBy: { text: code, at: now, code, userId: me._id }, createdAt: now, updatedAt: now, ...extra })
const [a, b, c, e] = [user("a", "Ada"), user("b", "Bayo"), user("c", "Chi"), user("e", "Efe")]
const x = user("x", "Xena", { referredBy: null })
const z = user("z", '=HYPERLINK("x")', { referredBy: null, referralCode: "FIX-0001" })
await db.collection("users").insertMany([a, b, c, e, x, z])
const order = (ref, u, amountMinor, status, extra = {}) => ({ user: u._id, authUserId: u.authUserId, course: course._id, reference: `fixture-${ref}`, amountMinor, currency: "USD", status, chargeId: null, packageKey: "standard", paymentMethod: "wallet", attribution: { code, userId: me._id, kind: "referral" }, failureCode: null, history: [], createdAt: now, updatedAt: now, ...extra })
await db.collection("orders").insertMany([
  order("a1", a, 19900, "enrolled"), order("a2", a, 99900, "enrolled"),
  order("b1", b, 4900, "enrolled", { paymentMethod: "espee" }), order("e1", e, 4900, "paid"),
  order("c-refund", c, 30000, "refunded"),
  order("x-own-link", x, 5000, "enrolled", { attribution: { code, userId: me._id, kind: "seller_link" } }),
])
const earning = (ref, student, netMinor, status) => ({ enrollment: null, order: null, course: course._id, instructor: me._id, instructorAuthUserId: me.authUserId, student: student._id, kind: "referral", grossMinor: netMinor * 10, feeMinor: netMinor * 9, netMinor, currency: "USD", status, availableAt: new Date(Date.now() + 7 * 86400_000), clearedAt: status === "cleared" ? now : null, creditReference: `fixture-${ref}`, chargeId: null, note: "fixture", createdAt: now, updatedAt: now })
await db.collection("earnings").insertMany([earning("ref-a", a, 1990, "pending"), earning("ref-e", e, 490, "cleared")])
await db.collection("partnerclicks").insertMany([[code, 0, 3], [code, 1, 4], [code, 10, 2], [code, 40, 7], ["FIX-0001", 0, 1]].map(([c2, ago, count]) => ({ code: c2, day: day(ago), count, createdAt: now, updatedAt: now })))
console.log("fixture ready for", code)
await mongoose.disconnect()
```

**The numbers the fixture produces** (student partner):

| Measure | Value |
|---|---|
| Clicks | 16 in total; 9 in the last 30 days, as 3 rows (counts 3, 4, 2) |
| Sign-ups | 4 (A, B, C, E) |
| Enrolled | 3 (A, B, E; C's only order was refunded) |
| Revenue | 19900 + 99900 + 4900 (ESPEE) + 4900 = **129600** ($1,296.00). The refund and the own-link sale are excluded. |
| Commission pending | $19.90 |
| Commission paid | $4.90 |

## File structure

| File | Responsibility |
|---|---|
| `lib/partner-clicks.ts` (new) | Pure click rules: the Lagos day, the 30-day window, bot user agents, the `wsa_ref_seen` cookie value |
| `lib/db/models/partner-click.ts` (new), `lib/db/models/index.ts` (modify) | `PartnerClick` (`partnerclicks`), web-only |
| `lib/actions/partners.ts` (new) | `recordPartnerVisit`, the one write |
| `components/marketing/partner-visit.tsx` (new), `app/(marketing)/layout.tsx` (modify) | Fire the action once per page load that carries `?ref=` |
| `lib/referrals.ts` (modify, below the "referrals page" banner) | `referralSummary` + `clicks`, `revenueMinor`; new `partnerRows()` |
| `app/(platform)/dashboard/referrals/page.tsx`, `components/referrals/referral-share.tsx` (modify) | The WMA Partners dashboard |
| `components/platform/app-sidebar.tsx`, `components/instructor/instructor-sidebar.tsx`, `components/instructor/home/money-card.tsx`, `lib/vivid/prompt.ts` (modify) | Entries and names |
| `lib/actions/admin-partners.ts` (new), `app/(admin)/admin/partners/page.tsx` (new), `components/admin/admin-sidebar.tsx`, `components/admin/bottom-nav.tsx` (modify) | Admin table and CSV |
| `docs/go-patches-phase-3.md`, `docs/launch-runbook.md`, `docs/institutional-blueprint-plan.md`, `context.md` (modify) | Notes, owner steps, status |

---

### Task 1: Click rules and the `partnerclicks` collection

**Files:**
- Create: `lib/partner-clicks.ts`, `lib/db/models/partner-click.ts`
- Modify: `lib/db/models/index.ts`

**Interfaces:**
- Consumes: `normalizeReferralCode(input: string | null | undefined): string | null` from `@/lib/referral-link`. That module has no imports and is safe to use from a pure module.
- Produces, from `lib/partner-clicks.ts` (no other imports):
  - `PARTNER_SEEN_COOKIE = "wsa_ref_seen"`
  - `PARTNER_TIME_ZONE = "Africa/Lagos"`
  - `PARTNER_SEEN_MAX = 20`
  - `PARTNER_CLICK_WINDOW_DAYS = 30`
  - `type PartnerClickDay = { day: string; count: number }`
  - `partnerDay(at: Date): string` returns `"YYYY-MM-DD"` in Lagos.
  - `recentDays(today: string, n: number): string[]` returns n day keys, newest first, `today` included.
  - `isBotUserAgent(ua: string | null | undefined): boolean`
  - `seenCodes(value: string | null | undefined, day: string): string[]`
  - `withSeenCode(value: string | null | undefined, day: string, code: string): string`
- Produces, from `lib/db/models`: `PartnerClick: Model<IPartnerClick>` and `IPartnerClick { _id: Types.ObjectId; code: string; day: string; count: number; createdAt: Date; updatedAt: Date }`.

- [ ] **Step 0: Baseline.** On the fresh branch, run `pnpm lint 2>&1 | tail -3` and `npx tsc --noEmit 2>&1 | tail -3`. Paste both outputs into the task report; Task 6 compares against them.

- [ ] **Step 1: Write the assertion script** `$SCRATCH/t1-partner-clicks.ts`:

```ts
import assert from "node:assert/strict"
import { PARTNER_SEEN_MAX, isBotUserAgent, partnerDay, recentDays, seenCodes, withSeenCode } from "@/lib/partner-clicks"
import { PartnerClick } from "@/lib/db/models/partner-click"

assert.equal(partnerDay(new Date("2026-10-18T22:59:59.000Z")), "2026-10-18")
assert.equal(partnerDay(new Date("2026-10-18T23:00:00.000Z")), "2026-10-19")
assert.equal(partnerDay(new Date("2026-12-31T23:30:00.000Z")), "2027-01-01")
assert.deepEqual(recentDays("2026-10-19", 3), ["2026-10-19", "2026-10-18", "2026-10-17"])
assert.deepEqual(recentDays("2026-03-01", 2), ["2026-03-01", "2026-02-28"])
const month = recentDays("2026-10-19", 30)
assert.equal(month.length, 30)
assert.equal(month[29], "2026-09-20")

const human = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 14; SM-A546E Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.81 Mobile Safari/537.36",
]
const bots = [
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/129.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse",
  "", null, undefined,
]
for (const ua of human) assert.equal(isBotUserAgent(ua), false, ua)
for (const ua of bots) assert.equal(isBotUserAgent(ua), true, String(ua))

const D = "2026-10-19"
assert.deepEqual(seenCodes(undefined, D), [])
assert.deepEqual(seenCodes("garbage", D), [])
assert.deepEqual(seenCodes("2026-10-19~ADA-7K2Q.WSA-1234", D), ["ADA-7K2Q", "WSA-1234"])
assert.deepEqual(seenCodes("2026-10-18~ADA-7K2Q", D), [])
assert.deepEqual(seenCodes("2026-10-19~ADA-7K2Q.x", D), ["ADA-7K2Q"])
assert.equal(withSeenCode(undefined, D, "ADA-7K2Q"), "2026-10-19~ADA-7K2Q")
assert.equal(withSeenCode("2026-10-19~ADA-7K2Q", D, "WSA-1234"), "2026-10-19~ADA-7K2Q.WSA-1234")
assert.equal(withSeenCode("2026-10-19~ADA-7K2Q", D, "ADA-7K2Q"), "2026-10-19~ADA-7K2Q")
assert.equal(withSeenCode("2026-10-18~ADA-7K2Q", D, "WSA-1234"), "2026-10-19~WSA-1234")
let v = ""
for (let i = 1; i <= 25; i++) v = withSeenCode(v, D, `CODE-${String(i).padStart(2, "0")}`)
const kept = seenCodes(v, D)
assert.equal(kept.length, PARTNER_SEEN_MAX)
assert.equal(kept[0], "CODE-06")
assert.equal(kept.at(-1), "CODE-25")

assert.equal(new PartnerClick({ code: "ADA-7K2Q", day: "2026-10-19", count: 1 }).validateSync(), undefined)
assert.ok(new PartnerClick({ code: "ADA-7K2Q", day: "19/10/2026", count: 1 }).validateSync()?.errors.day)
const idx = PartnerClick.schema.indexes()
assert.equal(idx.length, 1)
assert.deepEqual(idx[0][0], { code: 1, day: 1 })
assert.equal(idx[0][1].unique, true)
assert.equal(PartnerClick.collection.collectionName, "partnerclicks")
console.log("partner clicks: all assertions passed")
```

- [ ] **Step 2: Run it to see it fail.**
  Run: `npx tsx --tsconfig ./tsconfig.json "$SCRATCH/t1-partner-clicks.ts"`
  Expected: it fails, because `@/lib/partner-clicks` cannot be resolved.

- [ ] **Step 3: Create `lib/partner-clicks.ts`.** It is client-safe and pure, with a doc comment that cites institutional blueprint §15 and D28.
  - **`partnerDay`.** Use `Intl.DateTimeFormat("en-CA", { timeZone: PARTNER_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at)`, then join the parts as `${year}-${month}-${day}`.
  - **`recentDays`.** Use calendar arithmetic on the key: `Date.UTC(y, m - 1, d - i)`, then `toISOString().slice(0, 10)`.
  - **`isBotUserAgent`.** It is true for a missing or blank user agent, or a match of this pattern (fixed here):

    ```ts
    const BOT_UA = /bot\b|crawl|spider|slurp|headless|lighthouse|phantomjs|inspectiontool|mediapartners|facebookexternalhit|preview/i
    ```

  - **The cookie value** is `<day>~<CODE>.<CODE>…`. `~` and `.` are valid cookie characters and never appear in a code.
    - `seenCodes` returns the codes only when the stored day equals `day`, and drops every entry for which `normalizeReferralCode` returns null.
    - `withSeenCode` starts from `seenCodes(value, day)`, removes `code` if present, appends it, and keeps the last `PARTNER_SEEN_MAX` codes.

- [ ] **Step 4: Create `lib/db/models/partner-click.ts`.** Copy the shape of `lib/db/models/point-event.ts`. Its doc comment says the collection is new, written only by the web, and that the Go API never reads it. The schema:
  - `code: { type: String, required: true, maxlength: 24 }`
  - `day: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }`
  - `count: { type: Number, required: true, min: 0 }`. It has **no default**, so the upsert's `$inc` alone sets it on insert.
  - `{ timestamps: true }`, and `PartnerClickSchema.index({ code: 1, day: 1 }, { unique: true })`.
  - Export as `mongoose.models.PartnerClick || mongoose.model<IPartnerClick>("PartnerClick", PartnerClickSchema)`.

  In `lib/db/models/index.ts`, after the line `export { PointEvent, type IPointEvent, type PointEventKind } from "./point-event"`, add `export { PartnerClick, type IPartnerClick } from "./partner-click"`.

- [ ] **Step 5: Run it to see it pass.**
  Run: `npx tsx --tsconfig ./tsconfig.json "$SCRATCH/t1-partner-clicks.ts"`
  Expected: `partner clicks: all assertions passed`. If tsx can't resolve `@/…` from outside the repo, switch the two imports to absolute file paths into the worktree and say so in the report.

- [ ] **Step 6: Typecheck and lint.**
  Run: `npx tsc --noEmit`, then `npx eslint lib/partner-clicks.ts`, `npx eslint lib/db/models/partner-click.ts` and `npx eslint lib/db/models/index.ts`.
  Expected: clean, apart from the one stale `.next/types` error.

- [ ] **Step 7: Commit.**

```bash
git add lib/partner-clicks.ts lib/db/models/partner-click.ts lib/db/models/index.ts
git commit -m "feat(partners): click rules and the web-only partnerclicks collection"
```

---

### Task 2: Count a partner-link visit

**Files:**
- Create: `lib/actions/partners.ts`, `components/marketing/partner-visit.tsx`
- Modify: `app/(marketing)/layout.tsx`

**Interfaces:**
- Consumes:
  - From Task 1: `PARTNER_SEEN_COOKIE`, `partnerDay`, `isBotUserAgent`, `seenCodes`, `withSeenCode`, `PartnerClick`.
  - From `lib/referrals.ts`: `referralOwner(code: string): Promise<{ id: string; authUserId: string } | null>`.
  - From `@/lib/referral-link`: `REFERRAL_PARAM`, `normalizeReferralCode`.
  - From `@/lib/auth`: `getCurrentUser(): Promise<LocalUser | null>`.
- Produces:
  - `recordPartnerVisit(code: string): Promise<{ success: true; data: null } | { success: false; error: string }>`, in `"use server"` `lib/actions/partners.ts`.
  - `PartnerVisit(): null`, a client component.

- [ ] **Step 1: Check first** (server running, personas warmed up).
  - Run: `MONGODB_URI=mongodb://127.0.0.1:<DBPORT>/worldstreet-academy node "$SCRATCH/db.mjs" code student@worldstreet.academy`. Expected: a code such as `JOHNSON-7K2Q`. Call it `<CODE>`.
  - Run: `… node "$SCRATCH/db.mjs" clicks <CODE>`. Expected: `[]`.

- [ ] **Step 2: Create `lib/actions/partners.ts`** (`"use server"`). It has a doc comment citing D28 and ruling 3. The validation is `z.string().max(64)`, and the steps run in this order:
  1. **Shape.** Zod `safeParse`, then `normalizeReferralCode`. A failure is ignored.
  2. **Bots.** `isBotUserAgent((await headers()).get("user-agent"))` means ignored.
  3. **Already counted today.** `const day = partnerDay(new Date())`, `const jar = await cookies()` and `const prev = jar.get(PARTNER_SEEN_COOKIE)?.value` (`cookies` and `headers` come from `next/headers`). If `seenCodes(prev, day)` includes the code, the visit is ignored.
  4. **Unknown code.** `await connectDB()`, then `const owner = await referralOwner(code)`. `null` means ignored.
  5. **The partner's own visit.** `const user = await getCurrentUser()`. `user?.id === owner.id` means ignored.
  6. **Count it.** `await PartnerClick.updateOne({ code, day }, { $inc: { count: 1 } }, { upsert: true })`. On a duplicate-key error (`code === 11000`, a racing first insert), retry once.
  7. **Remember it.** `jar.set(PARTNER_SEEN_COOKIE, withSeenCode(prev, day, code), { path: "/", sameSite: "lax", httpOnly: true, secure: !isLocalDev, maxAge: 60 * 60 * 48 })`.

  `isLocalDev` is an unexported module constant, the Global Constraints' `pk_test_` expression. "Ignored" and "counted" both return `{ success: true, data: null }`. Any thrown error is logged as `console.error("[Partners] visit not recorded:", err)` and returns `{ success: false, error: "Visit not recorded" }`. There is no `revalidatePath` (ruling 3).

- [ ] **Step 3: Create `components/marketing/partner-visit.tsx`** (`"use client"`). `PartnerVisit` renders `null`. In a mount-only `useEffect`:
  - it reads `normalizeReferralCode(new URLSearchParams(window.location.search).get(REFERRAL_PARAM))`;
  - it returns when the code is null or already in a module-level `Set<string>` of codes reported from this tab;
  - otherwise it adds the code and calls `recordPartnerVisit(code).catch(() => {})`.

  It never awaits in render and never throws. Its comment names ruling 2: it doesn't use `useSearchParams`, and why.

- [ ] **Step 4: Mount it.** In `app/(marketing)/layout.tsx`, import `PartnerVisit` and render `<PartnerVisit />` right after `<Footer showFaculty={showFaculty} />`. Add a one-line comment: "WMA Partners: counts a `?ref=` visit (once per visitor per code per day)".

- [ ] **Step 5: Drive it.** Write `$SCRATCH/visits.cjs`:

```js
// NODE_PATH="$(npm root -g)" node "$SCRATCH/visits.cjs" <BASE> <CODE> <PROGRAM_SLUG>
const { chromium } = require("playwright")
const [base, code, slug] = process.argv.slice(2)
const REAL = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
const BOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
async function visit(browser, persona, ua, paths) {
  const ctx = await browser.newContext({ userAgent: ua })
  await ctx.addCookies([{ name: "mock_persona", value: persona, url: base }])
  const page = await ctx.newPage()
  for (const p of paths) {
    const action = page.waitForResponse((r) => r.request().method() === "POST" && !!r.request().headers()["next-action"], { timeout: 20000 })
    await page.goto(base + p)
    await action
  }
  const seen = (await ctx.cookies()).find((c) => c.name === "wsa_ref_seen")?.value ?? null
  await ctx.close()
  return seen
}
;(async () => {
  const browser = await chromium.launch()
  console.log("A guest  ", await visit(browser, "guest", REAL, [`/?ref=${code}`, `/?ref=${code}`, `/programs/${slug}?ref=${code}`]))
  console.log("B guest  ", await visit(browser, "guest", REAL, [`/programs/${slug}?ref=${code.toLowerCase()}`]))
  console.log("C bot    ", await visit(browser, "guest", BOT, [`/?ref=${code}`]))
  console.log("D owner  ", await visit(browser, "student", REAL, [`/?ref=${code}`]))
  console.log("E unknown", await visit(browser, "guest", REAL, ["/?ref=NOPE-0000"]))
  console.log("F tutor  ", await visit(browser, "instructor", REAL, [`/?ref=${code}`]))
  await browser.close()
})()
```

  - Run it with `PROGRAM_SLUG` from `db.mjs slug`.
    Expected:
    - A, B and F print `<today>~<CODE>`, the code uppercased in B too.
    - C, D and E print `null`.
  - Then run `db.mjs clicks <CODE>`.
    Expected: `[{"day":"<today>","count":3}]`, from A once, B once and F once.
  - Then run `db.mjs clicks NOPE-0000`.
    Expected: `[]`.
  - In the server log, no `[Partners] visit not recorded` line appears.

- [ ] **Step 6: Lint and commit.**

```bash
npx tsc --noEmit
npx eslint lib/actions/partners.ts
npx eslint components/marketing/partner-visit.tsx
npx eslint "app/(marketing)/layout.tsx"
git add lib/actions/partners.ts components/marketing/partner-visit.tsx "app/(marketing)/layout.tsx"
git commit -m "feat(partners): count a partner-link visit once per visitor per code per day"
```

---

### Task 3: The WMA Partners dashboard

**Files:**
- Modify: `lib/referrals.ts` (the import block, then only below `/* ═══════════════════ the referrals page ═══════════════════ */`), `app/(platform)/dashboard/referrals/page.tsx`, `components/referrals/referral-share.tsx`

**Interfaces:**
- Consumes: from Task 1, `PartnerClick`, `PartnerClickDay`, `partnerDay`, `recentDays` and `PARTNER_CLICK_WINDOW_DAYS`.
- Produces: `ReferralSummary` gains two fields, and every existing field keeps its name and meaning (ruling 6):
  - `clicks: { total: number; last30: PartnerClickDay[] }`. `last30` holds exactly 30 entries, newest first, with days that had no clicks set to `0`.
  - `revenueMinor: number`, as defined in ruling 5.

- [ ] **Step 1: Check first.**
  Run: `text /dashboard/referrals student | grep -c "WMA Partners"`
  Expected: `0`.

- [ ] **Step 2: Extend `referralSummary(userId, limit = 25)`.** Its signature is unchanged. Add three reads to its first `Promise.all`:
  - Clicks total: `PartnerClick.aggregate([{ $match: { code } }, { $group: { _id: null, total: { $sum: "$count" } } }])`.
  - The window: `const days = recentDays(partnerDay(new Date()), PARTNER_CLICK_WINDOW_DAYS)`, then `PartnerClick.find({ code, day: { $gte: days[days.length - 1] } }).select("day count").lean()`, zero-filled onto `days`.
  - Revenue: `Order.aggregate([{ $match: { "attribution.userId": me, "attribution.kind": "referral", status: { $in: ["paid", "enrolled"] } } }, { $group: { _id: null, total: { $sum: "$amountMinor" } } }])`. Here `me` is the existing `new Types.ObjectId(userId)`.

  Document both new fields on the type. Revenue's comment: "what learners paid for purchases credited to this code as a referral: paid or enrolled orders, wallet and ESPEE; not refunds, not a creator's own link".

- [ ] **Step 3: `components/referrals/referral-share.tsx`.**
  - Eyebrow "Your code" → "Your Partner Code".
  - `aria-label="Copy your code"` → `"Copy your Partner Code"`.
  - "Code copied." → "Partner Code copied."
  - Add `<Eyebrow className="mt-4">Your partner link</Eyebrow>` above the link row, and change that row's `mt-4` to `mt-1.5`.

  Nothing else changes.

- [ ] **Step 4: The page.** In `app/(platform)/dashboard/referrals/page.tsx`:
  - **Names.** `metadata.title`, the `Topbar` `title`, `breadcrumbOverrides={{ referrals: "WMA Partners" }}` and the `PageHeader` title all read "WMA Partners". The failed-load `EmptyState` title becomes "Your partner dashboard didn't load".
  - **Copy.** Replace `RULE` with these constants, verbatim (ruling 7):

```ts
const RATE = `${Math.round(REFERRAL_COMMISSION_RATE * 100)}%`
const SUBTITLE = `Share your Partner Code and earn ${RATE} of the first purchase of every learner you refer.`
const RULES = [
  `You earn ${RATE} of the first purchase each learner you refer pays for, once per learner.`,
  "It counts when that first purchase is paid from their WorldStreet wallet and credited to your code. A first purchase paid by ESPEE transfer, or credited to another code, earns you no commission.",
  `Commission clears to your WorldStreet wallet ${EARNINGS_CLEARING_DAYS} days after the purchase. If the purchase is refunded, the commission is reversed.`,
  "Your own purchases never earn commission.",
] as const
const STATS_NOTE = "Clicks count each visitor once a day. Revenue is what learners paid for purchases credited to your code."
```

  - **Layout, in order:**
    1. `ReferralShare`, unchanged.
    2. **Stats**, in `grid grid-cols-2 gap-3 sm:grid-cols-3`, exactly in this order: `Clicks` (`clicks.total`), `Sign-ups` (`referredCount`), `Enrolled` (`paidCount`), `Revenue` (`usd(revenueMinor)`), `Commission pending` (`usd(pendingMinor)`), `Commission paid` (`usd(clearedMinor)`). Below the grid, `STATS_NOTE` in `text-[12.5px] text-muted-foreground`.
    3. **Clicks card.** A `CardShell` with `CardHeader` title "Clicks in the last 30 days" and subtitle "One per visitor per day".
       - It lists only the days with a count above 0, newest first. Each row shows the date, through the page's existing `day()` formatter called with `` `${d.day}T00:00:00.000Z` ``, a muted bar (`bg-foreground/[0.06]` track, `bg-foreground/30` fill, width = count ÷ the window's highest count) and the count in `tabular-nums font-semibold`.
       - With no clicks, show the system `EmptyState`, title "No clicks yet", description "When someone opens your partner link, the visit shows here."
    4. **The existing "People you invited" card**, unchanged.
    5. **Rules card.** A `CardShell` with `CardHeader` title "How commission works", and `RULES` as a list in `text-[13.5px] leading-relaxed`.
  - The `PageHeader` subtitle is `SUBTITLE`.

- [ ] **Step 5: Run the fixture.**
  Run: `MONGODB_URI=mongodb://127.0.0.1:<DBPORT>/worldstreet-academy node "$SCRATCH/fixture.mjs"`
  Expected: `fixture ready for <CODE>`.

- [ ] **Step 6: Verify the numbers** (Review Focus 3).
  Keep these patterns in single quotes: inside double quotes, bash would expand `$[`.
  - Run: `text /dashboard/referrals student | grep -oE 'Clicks [0-9]+ Sign-ups [0-9]+ Enrolled [0-9]+ Revenue \$[0-9,.]+ Commission pending \$[0-9,.]+ Commission paid \$[0-9,.]+'`
    Expected: `Clicks 16 Sign-ups 4 Enrolled 3 Revenue $1,296.00 Commission pending $19.90 Commission paid $4.90`.
  - Run: `text /dashboard/referrals student | grep -oE 'WMA Partners|Your Partner Code|Your partner link|Clicks in the last 30 days|How commission works|ESPEE transfer|\$19\.90 clears|\$4\.90 paid to your wallet' | sort -u`
    Expected: all eight.
  - In the browser, the clicks card shows exactly three rows, with counts 3, 4 and 2, newest first. The 40-day-old row is absent from the list but counted in the 16.

- [ ] **Step 7: The other consumer, and phones.**
  - Run: `NODE_PATH="$(npm root -g)" node "$SCRATCH/page-text.cjs" $BASE instructor /instructor "Sales this month" | grep -c "Referral earnings"`
    Expected: `1`. The tutor home's money card still renders on the unchanged fields.
  - At 390 × 844 and at 1440 px, in dark and light themes, as `student` on `/dashboard/referrals`: `document.documentElement.scrollWidth <= innerWidth` is `true`; the six tiles sit in two columns on the phone; the click bars use no gold.

- [ ] **Step 8: Lint and commit.**

```bash
npx tsc --noEmit
npx eslint lib/referrals.ts
npx eslint "app/(platform)/dashboard/referrals/page.tsx"
npx eslint components/referrals/referral-share.tsx
git add lib/referrals.ts "app/(platform)/dashboard/referrals/page.tsx" components/referrals/referral-share.tsx
git commit -m "feat(partners): the WMA Partners dashboard — clicks, sign-ups, revenue and commission"
```

---

### Task 4: WMA Partners in every shell

**Files:**
- Modify: `components/platform/app-sidebar.tsx` (one line), `components/instructor/instructor-sidebar.tsx`, `components/instructor/home/money-card.tsx`, `lib/vivid/prompt.ts` (one line)

**Interfaces:**
- Produces, for Phase 19.9:
  - `teachItems` in `instructor-sidebar.tsx` ends with `{ title: "WMA Partners", href: "/dashboard/referrals", icon: Gift, match: (p) => p.startsWith("/dashboard/referrals") }`.
  - The bottom group's partners row renders only when `seller`.

- [ ] **Step 1: Check first.** `PT` stands for `NODE_PATH="$(npm root -g)" node "$SCRATCH/page-text.cjs" $BASE`.
  Run: `text /dashboard/referrals student | grep -c "Refer & earn"; PT instructor /instructor "Sales this month" | grep -o "Refer & earn" | wc -l`
  Expected: at least `1`, then `2` (the sidebar row and the money card link).

- [ ] **Step 2: Student sidebar, one line** (ruling 12). In `accountItems`, change `title: "Refer & earn",` to `title: "WMA Partners",`. Nothing else in the file changes.

- [ ] **Step 3: Instructor sidebar** (ruling 8).
  - Append the item from the Interfaces block to `teachItems`, after the "Analytics" entry. `Gift` is already imported. Appending keeps the indices that `sellerItems` uses (`teachItems[2]`, `[3]`, `[1]`).
  - In the bottom group, the `NavRow` titled "Refer & earn" becomes `{seller && <NavRow item={{ title: "WMA Partners", href: "/dashboard/referrals", icon: Gift }} active={false} />}`. Replace its comment with: "Marketplace Creators reach WMA Partners here; faculty have it in their main rail (institutional blueprint §16)".

- [ ] **Step 4: Money card.** In `money-card.tsx`, the `dt` "Referral earnings" becomes "Partner commission", and the link text `Refer &amp; earn` becomes `WMA Partners`. The href stays the same.

- [ ] **Step 5: Vivid.** In `lib/vivid/prompt.ts`, change `return "their referral code and earnings"` to `return "their WMA Partners dashboard — Partner Code, partner link, clicks and commission"`.

- [ ] **Step 6: Verify.**
  - Run: `text /dashboard/referrals student | grep -c "Refer & earn"; PT instructor /instructor "Sales this month" | grep -c "Refer & earn"`
    Expected: `0` and `0`.
  - Run: `PT instructor /instructor "Sales this month" | grep -oE "WMA Partners|Partner commission" | sort -u`
    Expected: both.
  - Run: `git diff --stat -- components/platform/app-sidebar.tsx`
    Expected: `1 file changed, 1 insertion(+), 1 deletion(-)`.
  - In the browser as `instructor`: "WMA Partners" sits under Analytics and opens `/dashboard/referrals`, and the bottom group shows only "Student Dashboard". The seller branch has no mock persona, so the reviewer checks it in the JSX.

- [ ] **Step 7: Lint and commit.**

```bash
npx tsc --noEmit
npx eslint components/platform/app-sidebar.tsx
npx eslint components/instructor/instructor-sidebar.tsx
npx eslint components/instructor/home/money-card.tsx
npx eslint lib/vivid/prompt.ts
git add components/platform/app-sidebar.tsx components/instructor/instructor-sidebar.tsx components/instructor/home/money-card.tsx lib/vivid/prompt.ts
git commit -m "feat(partners): WMA Partners in the student and faculty rails"
```

---

### Task 5: `/admin/partners` and the CSV

**Files:**
- Modify: `lib/referrals.ts` (append below `referralSummary`), `components/admin/admin-sidebar.tsx`, `components/admin/bottom-nav.tsx`
- Create: `lib/actions/admin-partners.ts`, `app/(admin)/admin/partners/page.tsx`

**Interfaces:**
- Produces, in `lib/referrals.ts`:

```ts
export type PartnerRow = {
  userId: string
  code: string
  firstName: string
  lastName: string
  email: string
  role: "USER" | "INSTRUCTOR" | "ADMIN"
  clicks: number
  signUps: number
  enrolled: number
  revenueMinor: number
  commissionPendingMinor: number
  commissionPaidMinor: number
}
/** Code holders with any activity, sorted; `inactive` counts the holders with none. */
export async function partnerRows(): Promise<{ rows: PartnerRow[]; inactive: number }>
```

- Produces, in `"use server"` `lib/actions/admin-partners.ts`:
  - `adminListPartners(): Promise<{ success: true; data: { rows: PartnerRow[]; inactive: number } } | { success: false; error: string }>`
  - `adminExportPartnersCsv(): Promise<{ success: true; data: { csv: string; count: number } } | { success: false; error: string }>`

- [ ] **Step 1: Check first.**
  Run: `curl -s -o /dev/null -w "%{http_code}\n" -b "mock_persona=admin" $BASE/admin/partners`
  Expected: `404`.

- [ ] **Step 2: `partnerRows()`.** It runs a fixed number of queries, with no per-user loop.
  1. **Holders:** `User.find({ referralCode: { $type: "string" } }).select("_id firstName lastName email role referralCode").lean()`.
  2. **In parallel:**
     - clicks per code: `PartnerClick.aggregate([{ $group: { _id: "$code", total: { $sum: "$count" } } }])`;
     - referred users: `User.find({ "referredBy.userId": { $type: "objectId" } }).select("_id referredBy.userId").lean()`;
     - revenue per partner: an `Order.aggregate` with ruling 5's `$match`, minus the `userId` term, grouped by `"$attribution.userId"`;
     - every `Earning` with `kind: "referral"` (`_id instructor netMinor status`).
  3. **Then:**
     - paying users: `Order.distinct("user", { user: { $in: referredIds }, status: { $in: ["paid", "enrolled"] } })`;
     - clawbacks: ``Earning.find({ kind: "adjustment", creditReference: { $in: commissions.map((c) => `academy_clawback_${c._id}`) }, status: { $ne: "reversed" } }).select("instructor netMinor")``.
  4. **Fold per holder, mirroring `referralSummary` exactly:**
     - pending = the sum of `netMinor` with status `pending`;
     - paid = the sum with status `cleared`, plus the clawback rows' (negative) `netMinor`.
  5. **Active rows** have any of `clicks`, `signUps` or `revenueMinor` above 0, or a non-zero commission.
  6. **Sort** by `revenueMinor` descending, then pending + paid descending, then `clicks` descending, then `code` ascending.

- [ ] **Step 3: `lib/actions/admin-partners.ts`.** Copy the structure of `lib/actions/admin-leads.ts`.
  - Both actions: `connectDB()` → `requireAdmin()` → `partnerRows()`. They log with `console.error("Admin partners error:", error)` and return `{ success: false, error: "Failed to load partners" }` or `"Failed to export partners"`.
  - **The CSV** copies the leads export's `quote` closure, formula guard included. The header is exactly:

    ```
    "Partner Code","First name","Last name","Email","Role","Clicks","Sign-ups","Enrolled","Revenue (USD)","Commission pending (USD)","Commission paid (USD)"
    ```

  - **Cells.** Role maps `USER` → `Student`, `INSTRUCTOR` → `Faculty`, `ADMIN` → `Admin`. Money is `(minor / 100).toFixed(2)`. Rows join with `\n`. `count` is the number of rows.

- [ ] **Step 4: The page.** `app/(admin)/admin/partners/page.tsx` is `"use client"` (ruling 9), modelled on `app/(admin)/admin/users/page.tsx`.
  - **Data:** `useQuery({ queryKey: ["admin", "partners"], queryFn: () => adminListPartners() })`.
  - **Header:** `<Topbar variant="admin" title="WMA Partners" />`, then `PageHeader` (`@/components/shared/page-header`):
    - title "WMA Partners";
    - subline, once loaded: `` `${rows.length.toLocaleString()} active partners · ${inactive.toLocaleString()} codes with no activity yet` ``; before that: "Partner Codes, clicks, sign-ups and commission.";
    - action: an outline `Button size="sm"` with `DownloadIcon` labelled "Export CSV" ("Exporting…" while busy). It downloads `wma-partners-YYYY-MM-DD.csv` exactly as the users page's `exportLeads` does, and shows `res.error` in `text-xs text-destructive`.
  - **Table** (`@/components/ui/table`), inside `rounded-[20px] border border-ws-hairline bg-ws-surface overflow-x-auto`:
    - Columns: Partner, Clicks, Sign-ups, Enrolled, Revenue, Commission. Clicks, Sign-ups and Enrolled are `hidden md:table-cell`.
    - The Partner cell shows the full name, with `code · email` beneath in muted text (truncated).
    - Commission shows `money(pending + paid)`, with `${money(pending)} pending` beneath in muted text.
    - Numbers are `tabular-nums`. `money` comes from `@/components/admin/shared`.
  - **States:**
    - Loading: six `Skeleton` rows.
    - Error: `EmptyState` (`@/components/shared/empty-state`) with `icon={HandshakeIcon}`, title "Partners didn't load", description `res.error`.
    - Empty: the same, with title "No partner activity yet" and description "Partners appear here once someone opens their link or joins through it."
  - **Padding:** `pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-12`, as on the neighbouring admin pages.

- [ ] **Step 5: Navigation** (ruling 9).
  - In `admin-sidebar.tsx`, add `{ title: "Partners", href: "/admin/partners", icon: HandshakeIcon, match: (p) => p.startsWith("/admin/partners") }` to `manageItems`, right after the `"Sellers"` entry.
  - In `bottom-nav.tsx`, add the same item to `moreItems`, right after `"Sellers"`, and add Partners to the comment that lists the More menu.
  - Add `HandshakeIcon` to each file's `@/components/icons` import.

- [ ] **Step 6: Gate check.**
  Run: `curl -s -o /dev/null -w "%{http_code}\n" -b "mock_persona=student" $BASE/admin/partners`
  Expected: `307` (the layout redirects to `/dashboard`).

- [ ] **Step 7: Drive it** (the fixture from Task 3 is in place; Review Focus 4 and 5). Write `$SCRATCH/admin.cjs`:

```js
// NODE_PATH="$(npm root -g)" node "$SCRATCH/admin.cjs" <BASE> "$SCRATCH/partners.csv"
const { chromium } = require("playwright")
const [base, out] = process.argv.slice(2)
;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 900 } })
  await ctx.addCookies([{ name: "mock_persona", value: "admin", url: base }])
  const page = await ctx.newPage()
  await page.goto(`${base}/admin/partners`)
  await page.locator("tbody tr").first().waitFor({ timeout: 30000 })
  console.log("rows", await page.locator("tbody tr").count())
  console.log("first", (await page.locator("tbody tr").first().innerText()).replace(/\s+/g, " "))
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSV" }).click()])
  await dl.saveAs(out)
  await page.setViewportSize({ width: 390, height: 844 })
  console.log("overflow", await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth))
  await browser.close()
})()
```

  - Run it. Expected:
    - `rows 2`;
    - `first …` contains `<CODE>`, `$1296.00` (admin `money()` has no thousands separator) and `$24.80`;
    - `overflow false`.
  - Run: `head -1 "$SCRATCH/partners.csv"`
    Expected: the header from step 3, exactly.
  - Run: `grep -c '"16","4","3","1296.00","19.90","4.90"' "$SCRATCH/partners.csv"`
    Expected: `1`.
  - Run: `grep -c "\"FIX-0001\",\"'=HYPERLINK(\"\"x\"\")\",\"Fixture\"" "$SCRATCH/partners.csv"`
    Expected: `1`. The formula is quoted and defused.
  - In the browser: the sidebar's "Partners" item is active on `/admin/partners`; at 390 px the More menu lists Partners. Check dark and light themes.

- [ ] **Step 8: Lint and commit.**

```bash
npx tsc --noEmit
npx eslint lib/referrals.ts
npx eslint lib/actions/admin-partners.ts
npx eslint "app/(admin)/admin/partners/page.tsx"
npx eslint components/admin/admin-sidebar.tsx
npx eslint components/admin/bottom-nav.tsx
git add lib/referrals.ts lib/actions/admin-partners.ts "app/(admin)/admin/partners/page.tsx" components/admin/admin-sidebar.tsx components/admin/bottom-nav.tsx
git commit -m "feat(admin): /admin/partners — every active WMA Partner, with CSV export"
```

---

### Task 6: Docs, owner steps and the closing run

**Files:**
- Modify: `docs/go-patches-phase-3.md`, `docs/launch-runbook.md`, `docs/institutional-blueprint-plan.md`, `context.md`

**Interfaces:** none.

- [ ] **Step 1: Go note** (ruling 10). In `docs/go-patches-phase-3.md` §8 ("Referrals and marketplace shares"), append this bullet after the one that begins `- **If Go ever sells a course**`:

  > - **`partnerclicks`** (Phase 18, WMA Partners, 2026-10) — a new web-only collection, `{ code, day: "YYYY-MM-DD" (Africa/Lagos), count }`, unique on `{ code, day }`, incremented once per visitor per code per day. Go never reads or writes it. Nothing above changes: the "Partner Code" the UI shows is `users.referralCode`, and every commission field and rule is as before.

- [ ] **Step 2: Runbook.** In `docs/launch-runbook.md`, insert this section immediately before `## 0. Blockers — settle these first`:

  > ## WMA Partners — Phase 18 (institutional blueprint §15)
  >
  > Nothing to configure. The `partnerclicks` collection and its unique index are created on first use, and clicks count from the deploy on, with no history before it. Commission rules are unchanged.
  >
  > 1. **Smoke test.** Signed in, open `/dashboard/referrals` and copy your partner link. Open it in a private window and reload once. Back in your own session, Clicks reads 1 more, not 2. Opening your own link while signed in adds nothing (a signed-out visit by you does count).
  > 2. **Admin.** `/admin/partners` lists you. "Export CSV" opens cleanly in a spreadsheet.

- [ ] **Step 3: Roadmap and log.**
  - In `docs/institutional-blueprint-plan.md`, tick Phase 18's three exit criteria, and set the status cell of its row in the §3 table ("| 18 | WMA Partners |") to `done (<date>, <n> commits)`.
  - In `context.md`, under `## Decision Log`, add a dated `### <date> — WMA Partners (Phase 18)` entry. It covers: the referral program renamed WMA Partners (route unchanged); Partner Codes; click counting in `partnerclicks` (once per visitor per code per Lagos day; bots, unknown codes and the partner's own signed-in visits ignored); revenue as defined in ruling 5; `/admin/partners` with CSV; commission unchanged.

- [ ] **Step 4: The money path is untouched.**
  - Run: `git diff "$(git merge-base HEAD feat/institutional)" -- lib/actions/enrollments.ts lib/actions/manual-payments.ts lib/actions/earnings.ts lib/db/models/earning.ts lib/db/models/order.ts lib/referral-link.ts middleware.ts`
    Expected: no output.
  - Run: `git diff -U0 "$(git merge-base HEAD feat/institutional)" -- lib/referrals.ts | grep '^@@'`
    Expected: hunks only in the import block and after the "the referrals page" banner. Check with `git diff` that `splitSale`, `isFirstPaidPurchase`, `referralCreditReference` and `referrerFor` show no `-` lines.

- [ ] **Step 5: The closing run.**
  - Restart the server. Re-run the fixture, then Task 2's harness. `db.mjs clicks <CODE>` now shows today's row at `count` 6: the fixture's 3, plus A, B and F.
  - Then, at 1440 and 390 px in dark and light themes, check `/?ref=<CODE>` as `guest`, `/dashboard/referrals` as `student`, `/instructor` as `instructor` and `/admin/partners` as `admin`. Expect no horizontal scroll, and no console errors apart from the known Vivid 403 (hide `nextjs-portal` in screenshots).

- [ ] **Step 6: Whole-repo checks.**
  Run: `pnpm lint` and `npx tsc --noEmit`.
  Expected: no new lint errors against Task 1's baseline, and tsc clean (the stale `.next/types` error excepted).

- [ ] **Step 7: Commit.**

```bash
git add docs/go-patches-phase-3.md docs/launch-runbook.md docs/institutional-blueprint-plan.md context.md
git commit -m "docs(partners): Phase 18 — Go note, runbook smoke test, status"
```

## Report (end of phase)

Read out Phase 18's exit criteria from `docs/institutional-blueprint-plan.md`. Add:
- **Rulings 5 and 7.** Revenue covers all credited purchases, ESPEE included. ESPEE or another code on a learner's first purchase forfeits commission, and the page now says so. The owner may want either one stated differently.
- **The controller's follow-up in the main checkout.** `CLAUDE.md` is git-excluded, so the worktree can't carry this. Add one bullet to its "Catalogue, packages and trust" list: "`lib/partner-clicks.ts` + `lib/actions/partners.ts` — WMA Partners click counting (one per visitor per code per Lagos day, web-only `partnerclicks`; `referralSummary`/`partnerRows` in `lib/referrals.ts` read it)."
- **Merge notes:** the shared files in ruling 12.
