# Mastery Academy — Phase 21 Implementation Plan (Super admin and admin levels)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Academy has super admins and admins (owner, 2026-10-19: "we will need super admin and admin level people asap"):
- super admins run the admin team: they grant and remove `ADMIN`, and promote and demote super admins;
- admins keep every other admin power;
- nobody else can make an admin, and nobody can do it from the browser by calling an action directly.

**Architecture:**
- **Data.** Two additive fields on `users`: `adminLevel: "super" | null` and `adminAudit[]`. The role enum is unchanged, so Go still sees `ADMIN`.
- **Rules.** They live in one pure, import-free module, `lib/admin-levels.ts`. There is one server-only write path, `applyRoleChange` in `lib/auth/admin.ts`. `adminUpdateUserRole` and the three new super actions all go through it. It refuses, writes with a state filter, audits, mirrors the role to Clerk and notifies.
- **UI.** A super-only `/admin/team` (a 404 for regular admins). The Admin option on `/admin/users` is hidden for regular admins. A Team nav item and a "Super admin" eyebrow appear for super admins only.
- **Bootstrap.** `scripts/grant-admin.mjs --super`.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict · Mongoose 9 · Clerk (satellite; `mocks/clerk` locally) · Zod (`zod/v4`) · TanStack Query · Tailwind v4 with the WorldStreet design system (`ds/`, `ws-*` tokens).

**Spec:** `docs/institutional-blueprint-plan.md`: Phase 21 and decision D32 (owner, 2026-10-19). The institutional blueprint itself has no section on admin levels. Go note **R14**.

**Branch:** `mastery/phase-21`, cut from `feat/institutional` (`4138066`) in its own worktree. This phase runs first: the owner asked for it "asap".

## Controller rulings (binding)

1. **A super admin is `role: "ADMIN"` and `adminLevel: "super"`.** Any other combination is not super (`isSuperAdmin`).
   - `adminLevel` lives in Mongo only. It is never read from Clerk and never written to it.
   - `syncRoleToClerk` keeps mirroring `role` alone. Promote and demote change no role, so they mirror nothing.
2. **Clerk metadata can no longer make an existing account `ADMIN`.** Verified in `lib/auth/sync.ts`:
   - The email-link branch and the found-by-id branch both run `if (claimedRole !== "USER" && user.role === "USER") user.role = claimedRole`.
   - `syncRoleToClerk` is best-effort and swallows failures.
   - So a removed admin set back to `USER` whose Clerk mirror failed, or a mobile/dev Clerk instance still carrying `role: "admin"`, got `ADMIN` back the next time a new Clerk id linked by email.
   - Both branches now raise a `USER` to `INSTRUCTOR` only. A claimed `admin` on an existing account is ignored.
   - A **brand-new** account still takes its claimed role. The mock `admin` persona is created that way, and hub-side behaviour is unchanged. It can only ever be a *regular* admin (open risk, in the report).
3. **Removing an admin restores the role they had when they were granted.** That is the latest `grant` audit entry's `fromRole` (`USER` or `INSTRUCTOR`).
   - Admins granted before this phase have no grant entry. They fall back to the roadmap's rule: `INSTRUCTOR` if `instructorStatus === "approved"`, else `USER`.
   - **Granting `ADMIN` no longer sets `instructorStatus: "approved"`**, in the UI or the script. Otherwise every removed student admin would come back as an instructor, and a legacy instructor (status `"none"`) would come back as a student. This corrects roadmap 21.2.
4. **One write path.** `applyRoleChange` lives in `lib/auth/admin.ts` (`import "server-only"`).
   - It is never exported from a `"use server"` file, because every export there is callable from the browser with any arguments.
   - The audit records every change that involves `ADMIN` or `adminLevel`: grant, revoke, promote, demote. Moves between `USER` and `INSTRUCTOR` stay unaudited, as today.
5. **The last super admin.** The acting super admin always remains, because self-changes are refused.
   - A count check refuses demoting the last super admin.
   - A post-write recount undoes a demotion if two super admins demote each other in the same instant.
   - The script's `--revoke` refuses the last super admin.
6. **No mock persona is committed** (corrects the brief).
   - Owen's standing rule: any `mocks/clerk/*` change is a local-only dev bypass that never reaches `main`.
   - By ruling 1, a persona couldn't carry `adminLevel` anyway.
   - The local super admin is made with the bootstrap script: `admin` (Ada Admin) becomes the super admin; `instructor` (Sarah Chen) is the regular admin under test; `student` (Johnson Demo) is the target account.
7. **`/admin/team` 404s for regular admins** through `notFound()` in a server `page.tsx` that wraps the client console.
   - Non-admins never pass the `(admin)` layout (its redirect to `/dashboard` stays), so the layout needs no change.
   - The actions are the security boundary. The page gate and the hidden nav item are UX only.
8. **The "Super admin" badge is the admin lockup's eyebrow.** It reads "Super admin" instead of "Admin". The shared `BrandLockup` is not changed.
9. **"Add an admin" is an exact, case-insensitive email match** on an existing account: no fuzzy search, no invitations.
10. **`grant-admin.mjs` refuses to run unless `MONGODB_URI` is on the command line**, as `backfill-certificate-ids.mjs` does. It now mints the highest privilege, and `.env.local` points at production. `--revoke` mirrors the actual new role to Clerk (it was hard-coded `"user"`).
11. **`adminUpdateUserRole` gains Zod.** Today any string reaches `updateOne`, which skips enum validators.
12. **The Team nav item is a separate constant, spliced in at render time.** Phases 11 (Task 7), 12 (12.5) and 18 (18.6) also edit the admin nav arrays, and this keeps the merges clean.

## Global Constraints

- **Data (Go reads the same MongoDB):**
  - Additive schema changes only: no renamed fields, no new enum values on existing fields, no new role values.
  - MongoDB is authoritative for `role`. Never overwrite `User.authUserId`: it is the wallet subject.
- **Server actions** (`lib/actions/*.ts`, `"use server"`):
  - Order: `connectDB()` → auth (`requireAdmin()` / `requireSuperAdmin()`) → Zod parse (`import { z } from "zod/v4"`) → mutate → `revalidatePath()` → return `{ success: true, data } | { success: false, error }`.
  - They never throw across the boundary. Catch, and map a thrown `"Not authorized"` to `{ success: false, error: "Not authorized" }`.
  - **Every export of a `"use server"` file is callable from the browser with any arguments.** The actor always comes from `getCurrentUser()` (inside `requireAdmin`), never from an argument. Helpers live in `server-only` modules.
  - RSC pages and layouts use `getCachedUser()` (`lib/auth/cached.ts`). Actions use `getCurrentUser()`.
  - Role gates live in each route group's `layout.tsx` (or the page, for a 404), never in middleware.
- **Untouched:** the money path (`lib/wallet.ts`), buckets and every other admin power.
- **Never stage or commit** anything under `mocks/`, `lib/dev/` or `scripts/dev/`, or `lib/wallet.ts` (Owen's dev-bypass rule). Commit with explicit paths, never `git add -A`.
- **Scripts:** `.env.local`'s `MONGODB_URI` is production. Put `MONGODB_URI=…` in front of every script run, and run scripts from the worktree, which has no `.env.local`.
- **Code:**
  - No new dependencies. No `any`. No secrets or env values in code.
  - Imports use `@/*`.
  - RSC-first: `"use client"` only where interaction needs it. The admin pages are client pages on TanStack Query, so match `app/(admin)/admin/users/page.tsx`.
- **UI:**
  - The WorldStreet design system. `ds/` is vendored: never edit it.
  - `ws-*` tokens and utilities only, never a hex.
  - Gold only for primary CTAs, active nav and brand moments.
  - Icons only from `@/components/icons` (duotone glyphs; never lucide, Hugeicons or emoji).
  - Base UI composition through `render`, never `asChild`.
  - Pill buttons, 20 px cards (`rounded-[20px]`), Manrope.
  - `·` separators, `tabular-nums` for counts.
- **Copy:**
  - New strings use the new vocabulary: plan, program, Marketplace Creator, Become a WMA Instructor. Existing strings are not renamed.
  - The exact copy below is binding.
- **Verification:**
  - No test runner, and none is added. Pure rules: a throwaway `node:assert/strict` script in `$SCRATCH`.
  - Everything else: `npx tsc --noEmit` (one stale `.next/types` error naming a deleted route is not real), then `npx eslint <file>` for each changed file, one at a time, then drive the route.
  - Anchors are quoted text, never line numbers.

## Review Focus

1. **A regular admin calls an action directly**, bypassing the hidden UI: `adminUpdateUserRole(id, "ADMIN")`, or a replayed `superGrantAdmin` / `superSetAdminLevel`. The server must refuse and the database must not change. Tests: Task 3, step 6; Task 4, step 8.
2. **A removed admin gets `ADMIN` back from stale Clerk metadata** when a new Clerk identity links by email. They must stay removed. Tests: Task 1, steps 1 and 12.
3. **Self-changes and the last super admin**, through a forged self-call and through the script. Both must be refused. Tests: Task 2, step 4 (script); Task 3, step 7 and Task 4, step 9 (forged self-calls).
4. **Removal lands on the wrong role.** A student made admin must come back a student, and an instructor must come back an instructor, even with `instructorStatus: "none"`. Tests: Task 2, step 4; Task 4, step 7.
5. **Garbage arguments reach the database.** A role of `"GOD"`, a level of `"root"`, a malformed id: `updateOne` runs no enum validators, so Zod must stop them. Tests: Task 3, step 6; Task 4, step 9.

## Verification server

```bash
netstat -ano | grep -E ":<PORT>|:<DBPORT>"      # must print nothing first
RESEND_API_KEY=re_disabled_local CLOUDFLARE_REALTIME_API_KEY=disabled-local OPENAI_API_KEY=disabled-local \
ABLY_API_KEY=disabled-local R2_SECRET_ACCESS_KEY=disabled-local WALLET_SERVICE_TOKEN=disabled-local \
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_bG9jYWwuZGV2JA MOCK_DB_PORT=<DBPORT> PORT=<PORT> node scripts/dev-mock.mjs
MONGODB_URI=mongodb://127.0.0.1:<DBPORT>/worldstreet-academy node scripts/mastery-catalogue.mjs --apply
```

- **The server.**
  - Run it in the background, with its output in `$SCRATCH/dev.log` (set `SCRATCH` from the helpers below first). The log shows `[mock-clerk] updateUserMetadata …` for each Clerk mirror and the `[Admin team]` lines (Task 4).
  - The worktree has no `.env.local`; that is intended.
  - **Restart after a model change:** Mongoose caches models on `global`.
  - Stop the server when the phase is done.
- **Personas.** They switch with the `mock_persona` cookie (`guest`, `student`, `instructor`, `admin`).
  - A persona's row is linked on its first request, so visit once as each before using its id.
  - `admin` (Ada Admin, `admin@worldstreet.academy`) is created `ADMIN` on her first request.
  - `instructor` (Sarah Chen) and `student` (Johnson Demo) are seeded.

Helpers. Run them from the **worktree root**. `mdb` needs the repo's `mongoose`.

```bash
BASE=http://localhost:<PORT>
U=mongodb://127.0.0.1:<DBPORT>/worldstreet-academy
SCRATCH=$(mktemp -d)
code() { curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" -b "mock_persona=$1" "$BASE$2"; }   # code admin /admin/team
cat > "$SCRATCH/mdb.mjs" <<'EOF'
import { createRequire } from "node:module"
const mongoose = createRequire(process.cwd() + "/package.json")("mongoose")
await mongoose.connect(process.env.MONGODB_URI)
const users = mongoose.connection.db.collection("users")
const fn = new Function("users", "ObjectId", `return (async () => { ${process.argv[2]} })()`)
console.log(JSON.stringify(await fn(users, mongoose.Types.ObjectId)))
await mongoose.disconnect()
EOF
mdb() { MONGODB_URI=$U node "$SCRATCH/mdb.mjs" "$1"; }
# mdb 'return users.findOne({ email: "admin@worldstreet.academy" }, { projection: { _id: 0, role: 1, adminLevel: 1, adminAudit: 1 } })'
idof() { mdb "return (await users.findOne({ email: \"$1\" }))._id" | tr -d '"'; }
# act <persona> <page path> <Next-Action id> '<json args>' — replays a captured server action as another persona.
act() { curl -s -o "$SCRATCH/act.out" -w "%{http_code}\n" -X POST "$BASE$2" -b "mock_persona=$1" -H "Origin: $BASE" \
  -H "Next-Action: $3" -H "Accept: text/x-component" -H "Content-Type: text/plain;charset=UTF-8" --data "$4"; }
```

**Capturing an action id.** Perform the action once in the browser and copy the request's `Next-Action` header from DevTools → Network. With Playwright (global install), `page.on("request", r => r.headers()["next-action"] && console.log(r.headers()["next-action"], r.postData()))` does the same. A call with plain arguments posts a JSON array, e.g. `["<userId>","INSTRUCTOR"]`.

**Judging a replay.** The database is the verdict. A refusal must also show up, either in `$SCRATCH/act.out` or in the dev log, so a request that never reached the action can't pass silently.

## File structure

| File | Responsibility |
|---|---|
| `lib/admin-levels.ts` (new) | Pure rules and refusal copy: `isSuperAdmin`, `adminLevelOf`, `auditActionFor`, `roleAfterRevoke`, `adminChangeRefusal` |
| `lib/db/models/user.ts` (modify) | `adminLevel`, `adminAudit[]` |
| `lib/auth/sync.ts`, `lib/auth/cached.ts` (modify) | `LocalUser.adminLevel` in all four mappers; Clerk claims never raise an existing account to `ADMIN` |
| `lib/auth/admin.ts` (modify) | `requireSuperAdmin`, `applyRoleChange` (the one write path) |
| `scripts/grant-admin.mjs` (modify) | `--super`, `--revoke` per the rules, audit, explicit-URI guard |
| `lib/actions/admin-users.ts`, `app/(admin)/admin/users/page.tsx` (modify) | `/admin/users` through the write path; the Admin option for super admins only |
| `lib/actions/admin-team.ts` (new) | `superGetTeam`, `superFindAccount`, `superGrantAdmin`, `superRevokeAdmin`, `superSetAdminLevel` |
| `app/(admin)/admin/team/page.tsx`, `components/admin/team-console.tsx` (new) | `/admin/team`: the server gate and the client console |
| `lib/hooks/queries/keys.ts` (modify) | `adminTeam` |
| `components/admin/admin-sidebar.tsx`, `components/admin/bottom-nav.tsx` (modify) | The Team item and the "Super admin" eyebrow |
| `docs/go-patches-phase-3.md`, `docs/launch-runbook.md`, `docs/institutional-blueprint-plan.md`, `docs/mastery-academy-plan.md`, `context.md` (modify) | R14, the bootstrap step, status |

---

### Task 1: Super admins exist in the data, and Clerk can't make an admin

**Files:**
- Create: `lib/admin-levels.ts`
- Modify: `lib/db/models/user.ts`, `lib/auth/sync.ts`, `lib/auth/cached.ts`, `lib/auth/admin.ts`, `docs/go-patches-phase-3.md`

**Interfaces:**
- Produces (`lib/admin-levels.ts`, **no imports at all**, client-safe):
  ```ts
  export type Role = "USER" | "INSTRUCTOR" | "ADMIN"
  export type AdminLevel = "super" | null
  export type AdminAuditAction = "grant" | "revoke" | "promote" | "demote"
  export type AdminState = { role: Role; adminLevel: AdminLevel }
  export const ADMIN_REFUSALS: {
    readonly self: "You can't change your own role or admin level."
    readonly notSuper: "Only a super admin can grant, change or remove admin access."
    readonly invalid: "Only an admin can be a super admin."
    readonly lastSuper: "The last super admin can't be demoted. Make someone else a super admin first."
  }
  export function isSuperAdmin(user: { role: string; adminLevel?: string | null }): boolean
  export function adminLevelOf(value: unknown): AdminLevel               // "super" → "super"; anything else → null
  export function auditActionFor(from: AdminState, to: AdminState): AdminAuditAction | null
  export function roleAfterRevoke(lastGrantFromRole: string | null | undefined, instructorStatus: string | null | undefined): "USER" | "INSTRUCTOR"
  export function adminChangeRefusal(input: {
    actor: { id: string; role: string; adminLevel?: string | null }
    targetId: string
    from: AdminState
    to: AdminState
    superAdminCount: number
  }): string | null
  ```
- Produces: `IUser.adminLevel: AdminLevel` and `IUser.adminAudit: { action: AdminAuditAction; fromRole: Role; toRole: Role; fromLevel: AdminLevel; toLevel: AdminLevel; by: Types.ObjectId | null; at: Date }[]`.
- Produces: `LocalUser.adminLevel: AdminLevel`. It is set by all four mappers (`getCachedUser`, `syncUserToLocal`, `getLocalUserByAuthId`, `getLocalUserById`) as `adminLevelOf(user.adminLevel)`, so `getCurrentUser()`, `getCachedUser()` and `useUser()` all carry it.
- Produces: `requireSuperAdmin(): Promise<LocalUser>` in `lib/auth/admin.ts`.

The rules, in this order (the assertions in step 2 pin them):
- `auditActionFor`:
  - `"grant"` when `from.role !== "ADMIN"` and `to.role === "ADMIN"`;
  - `"revoke"` for the reverse;
  - when both are `ADMIN`: `"promote"` for null → `"super"`, `"demote"` for `"super"` → null;
  - otherwise `null`.
- `roleAfterRevoke` returns `lastGrantFromRole` when it is `"USER"` or `"INSTRUCTOR"`. Otherwise it returns `"INSTRUCTOR"` if `instructorStatus === "approved"`, else `"USER"`.
- `adminChangeRefusal`:
  1. `actor.id === targetId` → `self`.
  2. The change involves an admin (`from.role === "ADMIN" || to.role === "ADMIN" || from.adminLevel !== to.adminLevel`) and `!isSuperAdmin(actor)` → `notSuper`.
  3. `to.adminLevel === "super" && to.role !== "ADMIN"` → `invalid`.
  4. `from.adminLevel === "super" && to.adminLevel !== "super" && superAdminCount <= 1` → `lastSuper`.
  5. Otherwise `null`.

- [ ] **Step 0: Record the lint baseline.** Run `pnpm lint 2>&1 | tail -3` and keep the error and warning counts for Task 5.

- [ ] **Step 1: Check first: the hole is real.** Start the verification server, then run:
  ```bash
  code admin /admin                                  # 200 (creates Ada)
  mdb 'return users.updateOne({ email: "admin@worldstreet.academy" }, { $set: { role: "USER", authUserId: "user_mock_admin_previous" } })'
  code admin /admin                                  # expected today: 200 — Clerk's "admin" claim re-granted ADMIN
  mdb 'return users.findOne({ email: "admin@worldstreet.academy" }, { projection: { _id: 0, role: 1 } })'   # {"role":"ADMIN"}
  mdb 'return users.updateOne({ email: "admin@worldstreet.academy" }, { $set: { role: "ADMIN", authUserId: "user_mock_admin" }, $unset: { linkedAuthIds: "" } })'
  ```
  The two `updateOne` calls stand in for "a removed admin whose Clerk metadata still says admin, seen under a new Clerk id". The last line restores Ada.

- [ ] **Step 2: Write the rules check** to `$SCRATCH/admin-levels.check.mts`:

```ts
import assert from "node:assert/strict"
import { pathToFileURL } from "node:url"
const L = await import(pathToFileURL(`${process.cwd()}/lib/admin-levels.ts`).href)
const S = (role: string, adminLevel: string | null = null) => ({ role, adminLevel })
const R = L.ADMIN_REFUSALS

assert.equal(L.isSuperAdmin({ role: "ADMIN", adminLevel: "super" }), true)
assert.equal(L.isSuperAdmin({ role: "ADMIN", adminLevel: null }), false)
assert.equal(L.isSuperAdmin({ role: "ADMIN" }), false)
assert.equal(L.isSuperAdmin({ role: "INSTRUCTOR", adminLevel: "super" }), false)
assert.equal(L.adminLevelOf("super"), "super")
for (const v of [null, undefined, "", "SUPER", "root", 1]) assert.equal(L.adminLevelOf(v), null)

assert.equal(L.auditActionFor(S("USER"), S("ADMIN")), "grant")
assert.equal(L.auditActionFor(S("INSTRUCTOR"), S("ADMIN", "super")), "grant")
assert.equal(L.auditActionFor(S("ADMIN"), S("INSTRUCTOR")), "revoke")
assert.equal(L.auditActionFor(S("ADMIN", "super"), S("USER")), "revoke")
assert.equal(L.auditActionFor(S("ADMIN"), S("ADMIN", "super")), "promote")
assert.equal(L.auditActionFor(S("ADMIN", "super"), S("ADMIN")), "demote")
assert.equal(L.auditActionFor(S("USER"), S("INSTRUCTOR")), null)
assert.equal(L.auditActionFor(S("ADMIN"), S("ADMIN")), null)

assert.equal(L.roleAfterRevoke("INSTRUCTOR", "none"), "INSTRUCTOR")
assert.equal(L.roleAfterRevoke("USER", "approved"), "USER")
assert.equal(L.roleAfterRevoke(null, "approved"), "INSTRUCTOR")
assert.equal(L.roleAfterRevoke(undefined, "none"), "USER")
assert.equal(L.roleAfterRevoke("ADMIN", "approved"), "INSTRUCTOR")
assert.equal(L.roleAfterRevoke("ADMIN", undefined), "USER")

const ada = { id: "a", role: "ADMIN", adminLevel: "super" }
const sam = { id: "s", role: "ADMIN", adminLevel: null }
const ask = (actor: object, targetId: string, from: object, to: object, superAdminCount = 2) =>
  L.adminChangeRefusal({ actor, targetId, from, to, superAdminCount })
assert.equal(ask(ada, "a", S("ADMIN", "super"), S("ADMIN")), R.self)
assert.equal(ask(sam, "s", S("ADMIN"), S("USER")), R.self)
assert.equal(ask(sam, "u", S("USER"), S("ADMIN")), R.notSuper)
assert.equal(ask(sam, "x", S("ADMIN"), S("INSTRUCTOR")), R.notSuper)
assert.equal(ask(sam, "x", S("ADMIN"), S("ADMIN", "super")), R.notSuper)
assert.equal(ask({ id: "i", role: "INSTRUCTOR", adminLevel: "super" }, "u", S("USER"), S("ADMIN")), R.notSuper)
assert.equal(ask(sam, "u", S("USER"), S("INSTRUCTOR")), null)
assert.equal(ask(sam, "u", S("INSTRUCTOR"), S("USER")), null)
assert.equal(ask(ada, "u", S("USER"), S("ADMIN")), null)
assert.equal(ask(ada, "u", S("USER"), S("USER", "super")), R.invalid)
assert.equal(ask(ada, "b", S("ADMIN", "super"), S("ADMIN"), 1), R.lastSuper)
assert.equal(ask(ada, "b", S("ADMIN", "super"), S("INSTRUCTOR"), 1), R.lastSuper)
assert.equal(ask(ada, "b", S("ADMIN", "super"), S("ADMIN"), 2), null)
assert.equal(ask(ada, "b", S("ADMIN"), S("ADMIN", "super"), 1), null)
console.log("admin-levels: all assertions passed")
```

- [ ] **Step 3: Run it to see it fail.**
  Run (worktree root): `npx tsx "$SCRATCH/admin-levels.check.mts"`
  Expected: FAIL, cannot find `lib/admin-levels.ts`.

- [ ] **Step 4: Create `lib/admin-levels.ts`** with the interface above, the `ADMIN_REFUSALS` copy exactly as written (`as const`), and the rules in the stated order. The doc comment cites D32 and says the module has no imports on purpose: client components, the server and the check script all load it.

- [ ] **Step 5: Run the check.**
  Run: `npx tsx "$SCRATCH/admin-levels.check.mts"`
  Expected: `admin-levels: all assertions passed`.

- [ ] **Step 6: `lib/db/models/user.ts`.**
  - Add `import type { AdminAuditAction, AdminLevel } from "@/lib/admin-levels"`, as `course.ts` imports `SchoolSlug`.
  - In `IUser`, after `sellerStatus: SellerStatus`, add both fields. The doc comment reads: D32, additive; Go keeps treating `role: "ADMIN"` as admin and never writes these (go-patches R14).
  - In the schema, after the `sellerStatus` block, add:

```ts
    adminLevel: { type: String, enum: [null, "super"], default: null },
    adminAudit: [
      {
        action: { type: String, enum: ["grant", "revoke", "promote", "demote"], required: true },
        fromRole: { type: String, enum: ["USER", "INSTRUCTOR", "ADMIN"], required: true },
        toRole: { type: String, enum: ["USER", "INSTRUCTOR", "ADMIN"], required: true },
        fromLevel: { type: String, enum: [null, "super"], default: null },
        toLevel: { type: String, enum: [null, "super"], default: null },
        by: { type: Schema.Types.ObjectId, ref: "User", default: null },
        at: { type: Date, required: true },
        _id: false,
      },
    ],
```

- [ ] **Step 7: `LocalUser` carries the level.**
  - In `lib/auth/sync.ts`, add `adminLevel: AdminLevel` after `role` in `export type LocalUser = {`.
  - In each of the three `return {` mappers in `sync.ts` (all three hold `role: user.role,`), add `adminLevel: adminLevelOf(user.adminLevel),`.
  - In `lib/auth/cached.ts`, after `role: user.role as "USER" | "INSTRUCTOR" | "ADMIN",`, add the same line.

- [ ] **Step 8: Clerk never raises an existing account to `ADMIN` (ruling 2).**
  - In `lib/auth/sync.ts`, replace both occurrences of `if (claimedRole !== "USER" && user.role === "USER") {` and the assignment inside with `if (claimedRole === "INSTRUCTOR" && user.role === "USER") { user.role = "INSTRUCTOR" }`.
  - Above the first, extend the comment: admins are granted only by a super admin or `scripts/grant-admin.mjs` (D32), so an `admin` claim on an existing account is ignored. That keeps a removed admin whose Clerk metadata is stale from being re-granted on the next link.
  - Leave the create branch's `role: mapRole(authUser.role)` alone.

- [ ] **Step 9: `requireSuperAdmin` in `lib/auth/admin.ts`.**
  - It calls `requireAdmin()`, then throws `new Error("Not authorized")` unless `isSuperAdmin(user)`, and returns the user.
  - Doc comment: the guard for D32 actions; the database is re-read on every call, so a demotion takes effect on the very next request.

- [ ] **Step 10: Go note R14.** Append `## 12. Super admins and admin levels (Phase 21, D32)` to `docs/go-patches-phase-3.md`. If another track's §12 landed first, use the next free number at merge. Content:
  - **R14 — Admin levels. Go needs no patch.** A table of the two web-only fields on `users`:
    - `adminLevel`: `"super" | null`, missing = `null`. A super admin is `role: "ADMIN"` and `adminLevel: "super"`.
    - `adminAudit[]`: `{ action: "grant" | "revoke" | "promote" | "demote", fromRole, toRole, fromLevel, toLevel, by: ObjectId | null, at }`. `by: null` means the bootstrap script.
  - Go keeps treating `role: "ADMIN"` as admin everywhere, including the mobile admin surfaces such as Vision. A super admin is still an `ADMIN`.
  - Go never writes `adminLevel` or `adminAudit`. Any wholesale user write must carry them (write dotted `$set`s, or keep the fields).
  - If Go has any path that sets `users.role`, it must neither set nor clear `ADMIN`. Admin access is granted and removed only on the web, by a super admin, so it is audited.
  - If Go raises roles from Clerk metadata at sign-in, it must never raise an **existing** account to `ADMIN`. The web stopped doing so in Phase 21; otherwise a removed admin whose metadata is stale gets admin back.

- [ ] **Step 11: Typecheck and lint.**
  Run: `npx tsc --noEmit`, then `npx eslint` on each of `lib/admin-levels.ts`, `lib/db/models/user.ts`, `lib/auth/sync.ts`, `lib/auth/cached.ts` and `lib/auth/admin.ts`.
  Expected: clean. If tsc names another `LocalUser` literal that lacks `adminLevel`, add the same line there.

- [ ] **Step 12: Verify.** Restart the server (model change), then repeat step 1.
  Expected:
  - The second `code admin /admin` prints `307 …/dashboard`.
  - The `findOne` prints `{"role":"USER"}`.
  - After the restore line, `code admin /admin` prints `200`.

  Then check that nothing else moved:
  - `code instructor /instructor` → `200`.
  - `code student /dashboard` → `200`.
  - `mdb 'return users.findOne({ email: "admin@worldstreet.academy" }, { projection: { _id: 0, role: 1, adminLevel: 1 } })'` → `{"role":"ADMIN","adminLevel":null}` (or the level absent).

- [ ] **Step 13: Commit.**

```bash
git add lib/admin-levels.ts lib/db/models/user.ts lib/auth/sync.ts lib/auth/cached.ts lib/auth/admin.ts docs/go-patches-phase-3.md
git commit -m "feat(admin): admin levels in the data; Clerk metadata can no longer make an existing account an admin"
```

---

### Task 2: The bootstrap script makes super admins

**Files:**
- Modify: `scripts/grant-admin.mjs`, `docs/launch-runbook.md`

**Interfaces:**
- Consumes: the rules of Task 1. A `.mjs` script can't import TypeScript, so it repeats `auditActionFor`, `roleAfterRevoke` and the last-super check in a few lines, with a comment naming `lib/admin-levels.ts` as their source of truth.
- Produces the CLI: `MONGODB_URI=<uri> node scripts/grant-admin.mjs <email> [--super | --revoke]`.

The script's behaviour. Describe a state as `USER`, `INSTRUCTOR`, `ADMIN/admin` or `ADMIN/super`.
- **Guards:**
  - Capture `const EXPLICIT_URI = process.env.MONGODB_URI` *before* `config({ path: ".env.local" })`. If it is empty, print `REFUSING: MONGODB_URI must be passed on the command line (.env.local points at production).` and the usage line, then exit 1. `.env.local` still loads, for `CLERK_SECRET_KEY`.
  - Both flags, an unknown flag, or no email → print `Usage: MONGODB_URI=<uri> node scripts/grant-admin.mjs <email> [--super | --revoke]` and exit 1.
- **The change:** `from` is the account's `{ role, adminLevel }`.
  - The default target is `ADMIN`, keeping an existing level.
  - `--super` targets `ADMIN/super`.
  - `--revoke` on a non-admin prints `✗ <email> isn't an admin (<ROLE>).` and exits 1. Otherwise it targets `roleAfterRevoke(latest grant fromRole, instructorStatus)` with level null.
- **Refusals and no-ops:**
  - No change → `• <email> is already <state> — nothing to change.` and exit 0, without writing.
  - Demoting the only super admin → `✗ <email> is the last super admin. Make someone else a super admin first (--super).` and exit 1.
- **The write:**
  - One `updateOne({ _id, role: from.role }, …)`: `$set` the role and level. Set `instructorStatus: "approved"` only when the new role is `INSTRUCTOR` and it isn't already approved; **never on a grant**.
  - `$push` an `adminAudit` entry with `by: null` and `at: new Date()`.
  - Print `✓ Mongo: <email> (<id>) <from> → <to>`.
- **The Clerk mirror:** only when the role changed, with the new role lowercased (the existing fetch block). Otherwise print `• Clerk: role unchanged — nothing to mirror.`
- **The last line:** `Done — admin access removed.` for `--revoke`, otherwise `Done — sign in and open /admin.` (`/admin/team` for a super admin).

- [ ] **Step 1: Check first.**
  Run: `grep -c -- "--super" scripts/grant-admin.mjs`
  Expected: `0`.

- [ ] **Step 2: Implement** the behaviour above. Rewrite the header comment's usage block: three forms, the command-line URI rule, and that `--revoke` restores the role held before the grant.

- [ ] **Step 3: Syntax check.**
  Run: `node --check scripts/grant-admin.mjs && npx eslint scripts/grant-admin.mjs`
  Expected: clean.

- [ ] **Step 4: Drive it against the local database** (server running; `code admin /admin` and `code student /dashboard` first, so both rows are linked):

| Run | Expected output | Exit |
|---|---|---|
| `node scripts/grant-admin.mjs admin@worldstreet.academy --super` | `REFUSING: MONGODB_URI must be passed on the command line …` | 1 |
| `MONGODB_URI=$U node scripts/grant-admin.mjs admin@worldstreet.academy --super --revoke` | `Usage: …` | 1 |
| `MONGODB_URI=$U node scripts/grant-admin.mjs nobody@worldstreet.academy` | `✗ No user with email nobody@worldstreet.academy` | 1 |
| `MONGODB_URI=$U node scripts/grant-admin.mjs admin@worldstreet.academy --super` | `✓ Mongo: admin@worldstreet.academy (…) ADMIN/admin → ADMIN/super`, `• Clerk: role unchanged — nothing to mirror.` | 0 |
| the same again | `• admin@worldstreet.academy is already ADMIN/super — nothing to change.` | 0 |
| `MONGODB_URI=$U node scripts/grant-admin.mjs admin@worldstreet.academy --revoke` | `✗ admin@worldstreet.academy is the last super admin. …` | 1 |
| `MONGODB_URI=$U node scripts/grant-admin.mjs instructor@worldstreet.academy` | `… INSTRUCTOR → ADMIN/admin`, `⚠ Skipped Clerk mirror …` | 0 |
| `MONGODB_URI=$U node scripts/grant-admin.mjs instructor@worldstreet.academy --revoke` | `… ADMIN/admin → INSTRUCTOR` | 0 |
| `MONGODB_URI=$U node scripts/grant-admin.mjs student@worldstreet.academy`, then `… --revoke` | `USER → ADMIN/admin`, then `ADMIN/admin → USER` | 0, 0 |

  Then check what was written:
  ```bash
  mdb 'return users.find({ email: { $in: ["admin@worldstreet.academy", "instructor@worldstreet.academy", "student@worldstreet.academy"] } }, { projection: { _id: 0, email: 1, role: 1, adminLevel: 1, instructorStatus: 1, "adminAudit.action": 1, "adminAudit.fromRole": 1, "adminAudit.toRole": 1, "adminAudit.toLevel": 1, "adminAudit.by": 1 } }).toArray()'
  ```
  Expected:
  - Ada is `ADMIN`/`super` with one entry, `promote`.
  - Sarah is `INSTRUCTOR`/null with `grant` (`fromRole` `INSTRUCTOR`) then `revoke` (`toRole` `INSTRUCTOR`), and `instructorStatus` `"approved"` (set by the revoke to `INSTRUCTOR`).
  - Johnson is `USER`/null with `grant` then `revoke` (`toRole` `USER`), and his `instructorStatus` is untouched (absent or `"none"`).
  - Every `by` is `null`.

  Finally, `code admin /admin` → `200`.

- [ ] **Step 5: Runbook.** In `docs/launch-runbook.md`:
  - Append to cohort step 4 ("**Admins.**"): `From Phase 21 on, super admins grant admins at /admin/team — see "Admin levels" below.`
  - Add a section after the cohort-launch section, `## Admin levels — 2026-10-19 (Phase 21, feat/institutional)`, with these steps:
    1. **First super admins, before anything else.** Pick the owner and one other trusted person; two, so neither is ever "the last". Each must have signed in to the Academy once. For each, run `MONGODB_URI="$PROD_URI" node scripts/grant-admin.mjs <email> --super`. This is safe before or after the deploy, because older code ignores `adminLevel`. Until it runs, nobody can grant admin access from the web. **Check:** the script prints `… → ADMIN/super`.
    2. **Deploy** (§4). Every existing admin stays an admin, at the regular level.
    3. **Check:**
       - As a super admin, the admin sidebar shows Team, the eyebrow reads "Super admin", and `/admin/team` lists every admin.
       - As a regular admin, `/admin/team` is a 404 and `/admin/users` offers no Admin role.
    4. **From now on:** grant admins at `/admin/team` → "Add an admin".
       - `grant-admin.mjs` without `--super` still makes a regular admin.
       - `--revoke` removes admin access and restores the earlier role. It refuses the last super admin.
       - Every change is in Team's audit trail.
    5. **Go team:** `docs/go-patches-phase-3.md` §12 (R14). No Go change, unless Go writes `users.role`.

- [ ] **Step 6: Commit.**

```bash
git add scripts/grant-admin.mjs docs/launch-runbook.md
git commit -m "feat(admin): grant-admin.mjs --super bootstraps super admins; --revoke restores the earlier role; runbook step"
```

---

### Task 3: One audited write path, and `/admin/users` obeys it

**Files:**
- Modify: `lib/auth/admin.ts`, `lib/actions/admin-users.ts`, `app/(admin)/admin/users/page.tsx`

**Interfaces:**
- Consumes: Task 1's rules, `requireAdmin`, `syncRoleToClerk`, `notifyUser` (`lib/notify.ts`), `InstructorStatus` (`lib/db/models`).
- Produces (`lib/auth/admin.ts`, server-only):
  ```ts
  export type RoleTarget = { id: string; role: Role; adminLevel: AdminLevel; instructorStatus: InstructorStatus; lastGrantFromRole: Role | null }
  export type RoleChangeResult =
    | { success: true; data: { role: Role; adminLevel: AdminLevel; changed: boolean } }
    | { success: false; error: string }
  export async function applyRoleChange(
    actor: LocalUser,
    targetId: string,
    next: (target: RoleTarget) => AdminState | string,   // a string is a refusal message
  ): Promise<RoleChangeResult>
  ```
- Produces: `AdminUserRow.adminLevel: AdminLevel` (also on `AdminUserDetail`), and `adminUpdateUserRole(userId: string, role: Role): Promise<RoleChangeResult>`.

`applyRoleChange`. The caller has already called `connectDB()`. The steps are fixed, in this order:
1. **Load.** An invalid ObjectId or a missing user → `"User not found"`. Load `role adminLevel instructorStatus authUserId adminAudit`.
   - `from` is `{ role, adminLevel: adminLevelOf(...) }`.
   - `lastGrantFromRole` is the `fromRole` of the latest `adminAudit` entry whose action is `"grant"`, else `null`.
2. **Next.** `to = next(target)`. A string comes back as the error.
3. **Refuse.** `superAdminCount = countDocuments({ role: "ADMIN", adminLevel: "super" })`. If `adminChangeRefusal(...)` returns a message, return it. Refusal comes before the no-op check, so a forbidden no-op is still refused.
4. **No-op.** If `from` equals `to` → `{ success: true, data: { ...to, changed: false } }`.
5. **Write.**
   - `updateOne({ _id, role: from.role, adminLevel: from.adminLevel }, …)`. A `null` filter matches a missing field.
   - `$set: { role: to.role, adminLevel: to.adminLevel }`. Add `instructorStatus: "approved"` only when `to.role === "INSTRUCTOR"`, `from.role !== "INSTRUCTOR"` and the status isn't already `"approved"`.
   - When `auditActionFor(from, to)` names an action, `$push` an `adminAudit` entry with `by: new Types.ObjectId(actor.id)` and `at: new Date()`.
   - `matchedCount === 0` → `"This account changed in the meantime. Reload and try again."`
6. **Recount.** If `from` was super and `to` isn't, count again. At `0`, undo: `$set` `from` back, and `$pull: { adminAudit: { at: entry.at, by: entry.by } }`. Return `ADMIN_REFUSALS.lastSuper`.
7. **Mirror.** If the role changed and `authUserId` is set → `await syncRoleToClerk(authUserId, to.role)`.
8. **Notify** the target (`type: "system"`) per the table below, then return `{ success: true, data: { ...to, changed: true } }`.

| Change | Title | Body | href |
|---|---|---|---|
| grant | Your account role changed | You now have administrator access. | `/admin` |
| revoke → INSTRUCTOR | Your admin access was removed | Your account is an instructor account again. | `/instructor` |
| revoke → USER | Your admin access was removed | Your account is a student account again. | `/dashboard` |
| promote | You're now a super admin | You can now add and remove admins from Team. | `/admin/team` |
| demote | Your super admin access was removed | You're still an admin. | `/admin` |
| USER ↔ INSTRUCTOR (unaudited) | Your account role changed | Today's copy, unchanged: "You now have instructor access. Welcome aboard!" / "Your account was set back to a student account." | `/instructor` / `/dashboard` |

- [ ] **Step 1: Set up and check first.**
  ```bash
  code student /dashboard; code instructor /instructor        # link both rows
  MONGODB_URI=$U node scripts/grant-admin.mjs instructor@worldstreet.academy   # Sarah: a regular admin
  ADA=$(idof admin@worldstreet.academy); SARAH=$(idof instructor@worldstreet.academy); JOHNSON=$(idof student@worldstreet.academy)
  ```
  In the browser as `instructor` (Sarah, a regular admin), open `/admin/users` and click Johnson Demo.
  Expected today: all three role buttons, `admin` included. That is the hole. Don't click it.

- [ ] **Step 2: Implement `applyRoleChange`** in `lib/auth/admin.ts` per the steps and table. Its doc comment says: the one write path for roles and admin levels (D32); never re-export it from a `"use server"` file.

- [ ] **Step 3: `adminUpdateUserRole` goes through it** (`lib/actions/admin-users.ts`).
  - Order: `connectDB()` → `const admin = await requireAdmin()` → Zod: `userId` matches `/^[a-f0-9]{24}$/` ("User not found"), `role` is `z.enum(["USER", "INSTRUCTOR", "ADMIN"])` ("Choose a valid role"); return the first issue's message.
  - Then `applyRoleChange(admin, userId, (t) => ({ role, adminLevel: role === "ADMIN" ? t.adminLevel : null }))`.
  - On success, `revalidatePath("/admin/users")` and `revalidatePath("/admin/team")`. Return the result.
  - The catch keeps its log line and maps `"Not authorized"` as `adminUpdateFacultyProfile` does, else `"Failed to update role"`.
  - Delete the old self-check, the old `$set` (including its ADMIN `instructorStatus` side effect), the direct `syncRoleToClerk` call and `notifyUser` call.
  - Update the doc comment: only super admins may involve `ADMIN`; regular admins move accounts between student and instructor.
  - `AdminUserRow` and both mappers gain `adminLevel: adminLevelOf(u.adminLevel)`.

- [ ] **Step 4: `/admin/users`** (`app/(admin)/admin/users/page.tsx`).
  - `const superMe = isSuperAdmin(me)`.
  - In the table's Role cell and in the sheet's badge row, after `<StatusBadge status={…role} />`, render `<Badge variant="outline" className="text-[10px]">Super admin</Badge>` when `adminLevel === "super"`.
  - Under "Change role", after the self branch:
    - When `!superMe && selected.role === "ADMIN"`, show `<p className="text-[11px] text-ws-muted">Only a super admin can change an admin's role.</p>` instead of the buttons.
    - Otherwise the buttons list `["USER", "INSTRUCTOR", "ADMIN"]` for super admins and `["USER", "INSTRUCTOR"]` for everyone else.
    - When `superMe && selected.role === "ADMIN"`, add a `Link` under the buttons: "Admin levels are on Team" → `/admin/team`, in `text-[11px] text-ws-muted underline-offset-4 hover:underline`.
  - The mutation's `setSelected` also sets `adminLevel: vars.newRole === "ADMIN" ? prev.adminLevel : null`.

- [ ] **Step 5: Typecheck and lint.**
  Run: `npx tsc --noEmit`, then `npx eslint` on each of `lib/auth/admin.ts`, `lib/actions/admin-users.ts` and `"app/(admin)/admin/users/page.tsx"`.
  Expected: clean.

- [ ] **Step 6: A regular admin can't involve `ADMIN`, whatever they send.** In the browser as `instructor` (Sarah) on `/admin/users`:
  - Johnson shows `user` and `instructor` only.
  - Ada's row has the "Super admin" badge, and her sheet reads "Only a super admin can change an admin's role."
  - Click `instructor` on Johnson and confirm. Johnson is `INSTRUCTOR`: regular admins keep this power. Capture that request's `Next-Action` id as `ROLE_ACTION`.

  Then replay it:
  ```bash
  act instructor /admin/users $ROLE_ACTION "[\"$JOHNSON\",\"ADMIN\"]"; grep -c "Only a super admin can grant, change or remove admin access." "$SCRATCH/act.out"   # 200, 1
  act instructor /admin/users $ROLE_ACTION "[\"$ADA\",\"USER\"]";      grep -c "Only a super admin" "$SCRATCH/act.out"                                       # 200, 1
  act instructor /admin/users $ROLE_ACTION "[\"$JOHNSON\",\"GOD\"]";   grep -c "Choose a valid role" "$SCRATCH/act.out"                                      # 200, 1
  act instructor /admin/users $ROLE_ACTION "[\"not-an-id\",\"USER\"]"; grep -c "User not found" "$SCRATCH/act.out"                                           # 200, 1
  mdb 'return users.find({ email: { $in: ["admin@worldstreet.academy", "student@worldstreet.academy"] } }, { projection: { _id: 0, email: 1, role: 1, adminLevel: 1, adminAudit: 1 } }).toArray()'
  ```
  Expected: Ada is still `ADMIN`/`super` with only her Task 2 entry. Johnson is `INSTRUCTOR` with his two Task 2 entries and nothing new.

- [ ] **Step 7: A super admin can, but never on themselves.**
  ```bash
  act admin /admin/users $ROLE_ACTION "[\"$ADA\",\"USER\"]"; grep -c "You can't change your own role or admin level." "$SCRATCH/act.out"   # 200, 1
  act admin /admin/users $ROLE_ACTION "[\"$JOHNSON\",\"ADMIN\"]"
  mdb "return (await users.findOne({ email: \"student@worldstreet.academy\" })).adminAudit.at(-1)"
  ```
  Expected:
  - Ada is unchanged.
  - Johnson is `ADMIN`/null, and the last entry is `grant` with `fromRole` `INSTRUCTOR`, `toRole` `ADMIN` and `by` = `$ADA`.
  - `$SCRATCH/dev.log` shows `[mock-clerk] updateUserMetadata user_mock_student { publicMetadata: { role: 'admin' } }`.

  Then, in the browser as `admin` (Ada):
  - Open Johnson. All three buttons show, plus "Admin levels are on Team".
  - Click `user` and confirm. Johnson is `USER`/null, the last entry is `revoke` (`toRole` `USER`, `by` Ada), and the log shows the `role: 'user'` mirror.
  - Ada's own sheet still reads "You can't change your own role."

- [ ] **Step 8: Reset Johnson.** Step 6 made him an instructor, which approved his status.
  `mdb 'return users.updateOne({ email: "student@worldstreet.academy" }, { $set: { instructorStatus: "none" } })'`

- [ ] **Step 9: Commit.**

```bash
git add lib/auth/admin.ts lib/actions/admin-users.ts "app/(admin)/admin/users/page.tsx"
git commit -m "feat(admin): one audited write path for roles; only super admins can grant or remove admin on /admin/users"
```

---

### Task 4: `/admin/team`

**Files:**
- Create: `lib/actions/admin-team.ts`, `app/(admin)/admin/team/page.tsx`, `components/admin/team-console.tsx`
- Modify: `lib/hooks/queries/keys.ts`

**Interfaces:**
- Consumes: `applyRoleChange`, `RoleChangeResult`, `requireSuperAdmin` (Tasks 1 and 3); `isSuperAdmin`, `adminLevelOf`, `roleAfterRevoke`, `AdminLevel`, `AdminAuditAction`, `Role` (Task 1).
- Produces (`lib/actions/admin-team.ts`, `"use server"`):
  ```ts
  export type TeamMember = {
    id: string; name: string; email: string; avatarUrl: string | null; adminLevel: AdminLevel; isYou: boolean
    /** The latest grant: who (null = the bootstrap script) and when. Null for admins granted before Phase 21. */
    granted: { byName: string | null; at: string } | null
  }
  export type TeamAuditRow = { at: string; action: AdminAuditAction; actorName: string | null; targetName: string; toRole: Role; toLevel: AdminLevel }
  export type TeamView = { members: TeamMember[]; audit: TeamAuditRow[] }
  export type FoundAccount = { id: string; name: string; email: string; avatarUrl: string | null; role: Role; adminLevel: AdminLevel }
  export async function superGetTeam(): Promise<{ success: true; data: TeamView } | { success: false; error: string }>
  export async function superFindAccount(email: string): Promise<{ success: true; data: FoundAccount } | { success: false; error: string }>
  export async function superGrantAdmin(userId: string): Promise<RoleChangeResult>
  export async function superRevokeAdmin(userId: string): Promise<RoleChangeResult>
  export async function superSetAdminLevel(userId: string, level: AdminLevel): Promise<RoleChangeResult>
  ```
- Produces: `queryKeys.adminTeam: ["admin", "team"]`; `TeamConsole()` (a client component, no props).

The actions. Each one runs `connectDB()` → `const actor = await requireSuperAdmin()` → Zod → work.
- **Zod:**
  - `userId` matches `/^[a-f0-9]{24}$/` ("User not found").
  - `level` is `z.enum(["super"]).nullable()` ("Choose a valid level").
  - `email` is `z.string().trim().toLowerCase().max(254).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a full email address")`.
- **`next` callbacks:**
  - `superGrantAdmin`: `{ role: "ADMIN", adminLevel: t.role === "ADMIN" ? t.adminLevel : null }`.
  - `superRevokeAdmin`: `t.role !== "ADMIN"` → `"That account isn't an admin."`, else `{ role: roleAfterRevoke(t.lastGrantFromRole, t.instructorStatus), adminLevel: null }`.
  - `superSetAdminLevel`: `t.role !== "ADMIN"` → `"Make them an admin first."`, else `{ role: "ADMIN", adminLevel: level }`.
  - After a successful mutation: `revalidatePath("/admin/team")`, `revalidatePath("/admin/users")`.
- **`superFindAccount`:** an exact `{ email }` match. Nothing found → `"No account uses that email. They need to sign in to the Academy once first."`
- **`superGetTeam`:**
  - Members: `User.find({ role: "ADMIN" })`, super admins first, then by name.
  - Audit: `User.aggregate`: match accounts with a non-empty `adminAudit`, `$unwind`, sort `adminAudit.at` descending, limit 50.
  - Actor names: one `User.find({ _id: { $in } })`. An actor that no longer exists reads `"A removed account"`.
  - Names follow the users-page rule: `` `${firstName} ${lastName}`.trim() || username ``.
- **Errors:** every catch logs `console.error("[Admin team]", "<action name>", error instanceof Error ? error.message : error)`. A thrown `"Not authorized"` returns `"Not authorized"`. Other errors return `"Couldn't update admin access"`, or `"Couldn't load the team"` for `superGetTeam`.

**The page** (`app/(admin)/admin/team/page.tsx`, server):

```tsx
/** /admin/team — super admins only (D32). Regular admins get a 404; non-admins never pass the (admin) layout.
 *  The actions re-check with requireSuperAdmin: this gate is UX, not the security boundary. */
export default async function AdminTeamPage() {
  const user = await getCachedUser()
  if (!user || !isSuperAdmin(user)) notFound()
  return <TeamConsole />
}
```

**The console** (`components/admin/team-console.tsx`, `"use client"`).
- **Shell:** `<Topbar variant="admin" />` and the users page's two wrapper `div`s, copied as they are.
- **Header:** `PageHeader` with title "Team" and subline "Admins run the Academy. Super admins also decide who is an admin."
- **Sections:** three `rounded-[20px] border border-ws-hairline bg-ws-surface p-5` sections:
  1. **"Add an admin."**
     - An email `Input` (label "Email address", placeholder `name@example.com`) and an outline "Find account" button.
     - A found account shows avatar, name, email and role. If it isn't an admin, a default (gold) "Make admin" button; otherwise "Already an admin." in `text-ws-muted`.
     - Errors show under the input.
  2. **"Admins · {count}"** (count in `tabular-nums`). One row per member:
     - avatar 32, name with an outline "You" badge, the email (truncated);
     - a level badge: "Super admin" or "Admin" (outline, never gold);
     - the grant line: "Granted by {byName} · {date}", "Granted by the bootstrap script · {date}", or "Granted before admin levels". Use `formatDate` from `components/admin/shared`.
     - Actions, never on your own row: a super admin's row gets outline "Make regular admin" and outline "Remove admin"; a regular admin's row gets outline "Make super admin" and outline "Remove admin".
     - On phones, the actions wrap under the name.
  3. **"Audit trail."** Rows read "{actorName ?? "The bootstrap script"} {phrase} · {formatDateTime(at)}".
     - grant: "made {target} an admin", or "made {target} a super admin" when `toLevel` is super;
     - revoke: "removed {target}'s admin access";
     - promote: "made {target} a super admin";
     - demote: "made {target} a regular admin".
     - Empty: "No admin changes recorded yet."
- **Confirm dialogs:** every change opens one, and errors render inside it (as on `/admin/users`):

| Change | Title | Body | Confirm button |
|---|---|---|---|
| grant | Make {name} an admin? | Admins manage programs, payments, enrollments and users here and in the mobile app's admin screens. Only a super admin can undo this. | Make admin (default) |
| promote | Make {name} a super admin? | Super admins can add and remove admins, including other super admins. | Make super admin (default) |
| demote | Make {name} a regular admin? | They keep admin access but can no longer add or remove admins. | Make regular admin (default) |
| revoke | Remove {name}'s admin access? | Their account goes back to the role it had before they were made an admin. Their programs stay untouched. | Remove admin (destructive) |

- **Data:** one `useQuery({ queryKey: queryKeys.adminTeam, queryFn: superGetTeam })`, with skeletons while loading. One `useMutation` maps grant, revoke, promote and demote to the three actions. On success it invalidates `["admin", "team"]` and `["admin", "users"]`, closes the dialog and clears the found account.

- [ ] **Step 1: Check first.**
  Run: `code admin /admin/team`
  Expected: `404`.

- [ ] **Step 2: Add `adminTeam: ["admin", "team"] as const`** to `queryKeys`, after `adminUserDetail`.

- [ ] **Step 3: Create `lib/actions/admin-team.ts`** per the interfaces and rules above.

- [ ] **Step 4: Create the page and `components/admin/team-console.tsx`** per the spec above.

- [ ] **Step 5: Typecheck and lint.**
  Run: `npx tsc --noEmit`, then `npx eslint` on each of `lib/actions/admin-team.ts`, `"app/(admin)/admin/team/page.tsx"`, `components/admin/team-console.tsx` and `lib/hooks/queries/keys.ts`.
  Expected: clean.

- [ ] **Step 6: Who can open it.**
  Run: `code admin /admin/team; code instructor /admin/team; code student /admin/team; code guest /admin/team`
  Expected:
  - `200`;
  - `404` (Sarah is a regular admin);
  - `307 …/dashboard`;
  - `307 …/login`.

- [ ] **Step 7: Drive it as Ada** (browser, 1440 px; capture `GRANT_ACTION`, `REVOKE_ACTION` and `LEVEL_ACTION` from the Network tab as you go).
  1. **The list.** Ada shows "You", Super admin and "Granted before admin levels". Sarah shows Admin and "Granted by the bootstrap script · {today}".
  2. **The trail.** It holds the Task 2 and Task 3 entries, newest first, including "Ada Admin removed Johnson Demo's admin access" and "The bootstrap script made Sarah Chen an admin".
  3. **Finding accounts.**
     - "  STUDENT@worldstreet.academy " finds Johnson Demo.
     - "nobody@worldstreet.academy" → "No account uses that email. They need to sign in to the Academy once first."
     - "not-an-email" → "Enter a full email address".
  4. **Grant.** Make Johnson an admin. He appears with "Granted by Ada Admin · {today}", and the trail starts "Ada Admin made Johnson Demo an admin".
  5. **Promote and demote.**
     - Make Sarah a super admin; then `code instructor /admin/team` → `200`.
     - Make her a regular admin again; then `code instructor /admin/team` → `404`.
  6. **Remove.**
     - Remove Johnson's admin access: `mdb` shows him `USER`, restored from his grant.
     - Remove Sarah's: she is `INSTRUCTOR`, from her Task 3 grant.
  7. **Restore Sarah as a regular admin** through "Add an admin" with `instructor@worldstreet.academy`.

- [ ] **Step 8: A regular admin can't use the team actions.** Sarah is a regular admin again.
  ```bash
  BEFORE=$(grep -c "\[Admin team\] .* Not authorized" "$SCRATCH/dev.log")
  act instructor /admin/team $GRANT_ACTION "[\"$JOHNSON\"]"
  act instructor /admin/team $LEVEL_ACTION "[\"$SARAH\",\"super\"]"
  act instructor /admin/team $REVOKE_ACTION "[\"$ADA\"]"
  echo $(( $(grep -c "\[Admin team\] .* Not authorized" "$SCRATCH/dev.log") - BEFORE ))     # 3
  mdb 'return users.find({ email: { $in: ["admin@worldstreet.academy", "instructor@worldstreet.academy", "student@worldstreet.academy"] } }, { projection: { _id: 0, email: 1, role: 1, adminLevel: 1 } }).toArray()'
  ```
  Expected: Ada `ADMIN`/`super`, Sarah `ADMIN`/null, Johnson `USER`/null, all unchanged. If the log holds no `[Admin team]` lines, the requests never reached the actions: repeat them against `/admin/users`.

- [ ] **Step 9: A super admin can't change themselves, or send garbage.**
  ```bash
  act admin /admin/team $LEVEL_ACTION "[\"$ADA\",null]";       grep -c "You can't change your own role or admin level." "$SCRATCH/act.out"   # 1
  act admin /admin/team $REVOKE_ACTION "[\"$ADA\"]";           grep -c "You can't change your own role or admin level." "$SCRATCH/act.out"   # 1
  act admin /admin/team $LEVEL_ACTION "[\"$SARAH\",\"root\"]"; grep -c "Choose a valid level" "$SCRATCH/act.out"                             # 1
  act admin /admin/team $GRANT_ACTION "[\"$JOHNSON\"]"   # positive control: the harness reaches the action
  ```
  Expected:
  - Ada is unchanged and Sarah is unchanged.
  - Johnson is `ADMIN`. Remove him again in the UI; he goes back to `USER`.

- [ ] **Step 10: Look at it.** At 390 px, in dark and light themes:
  - no horizontal scroll (`document.documentElement.scrollWidth <= innerWidth`);
  - rows wrap cleanly and the dialogs fit;
  - the level badges and the trail are legible;
  - the only gold is "Make admin".

- [ ] **Step 11: Commit.**

```bash
git add lib/actions/admin-team.ts "app/(admin)/admin/team/page.tsx" components/admin/team-console.tsx lib/hooks/queries/keys.ts
git commit -m "feat(admin): /admin/team — super admins add, promote, demote and remove admins, with an audit trail"
```

---

### Task 5: Signposts, docs and the closing run

**Files:**
- Modify: `components/admin/admin-sidebar.tsx`, `components/admin/bottom-nav.tsx`, `docs/institutional-blueprint-plan.md`, `docs/mastery-academy-plan.md`, `context.md`

**Interfaces:**
- Consumes: `isSuperAdmin` (Task 1); `useUser()`, which carries `adminLevel`.
- Produces: none.

- [ ] **Step 1: Check first.** As Ada, the admin sidebar has no "Team", and the eyebrow reads "ADMIN".

- [ ] **Step 2: `admin-sidebar.tsx`.**
  - Add `ShieldCheck` to the icon import.
  - Add a separate `const teamItem: NavItem = { title: "Team", href: "/admin/team", icon: ShieldCheck, match: (p) => p.startsWith("/admin/team") }` (ruling 12; `manageItems` stays unchanged).
  - In `AdminSidebar`, compute `const items` by inserting `teamItem` right after the item whose `href` is `"/admin/users"`, for super admins only. Both the prefetch effect and the menu use `items`.
  - The lockup becomes `eyebrow={isSuperAdmin(user) ? "Super admin" : "Admin"}` (ruling 8).

- [ ] **Step 3: `bottom-nav.tsx`.**
  - Add `ShieldCheck` and `useUser`. Add the same separate `teamItem` (as a `BottomNavItem`).
  - The More menu lists `[teamItem, ...moreItems]` for super admins only. `moreActive` is computed over that shown list.
  - Update the comment above `moreItems` to say that Team joins the More menu for super admins.

- [ ] **Step 4: Lint and look.** Run `npx eslint components/admin/admin-sidebar.tsx` and `npx eslint components/admin/bottom-nav.tsx`. Then check:
  - **As Ada at 1440:** Team sits right after Users. On `/admin/team` it has the active pill and a gold icon. The eyebrow reads "SUPER ADMIN" (uppercased by CSS) and truncates cleanly in the collapsed rail.
  - **As Sarah:** no Team, and the eyebrow reads "ADMIN".
  - **At 390 px:** Ada's More menu starts with Team and lights up on `/admin/team`. Sarah's has no Team.

- [ ] **Step 5: Docs.**
  - `docs/institutional-blueprint-plan.md`: tick Phase 21's three exit criteria, and set row 21 of the §3 table to `done (2026-10-DD, N commits)`.
  - `docs/mastery-academy-plan.md`: row 21 of the Phases 10–20 table, to match.
  - `context.md`: under "## Decision Log", add `### 2026-10-19 — Admin levels (Phase 21)`, with bullets on:
    - `User.adminLevel` and `adminAudit`;
    - super-only grants at `/admin/team` and `/admin/users`;
    - Clerk can no longer make an existing account an admin;
    - removal restores the earlier role;
    - `grant-admin.mjs --super`.

- [ ] **Step 6: The closing run.**
  - Run `pnpm lint 2>&1 | tail -3`. Expected: no new errors or warnings against the Task 1 baseline.
  - Run `npx tsc --noEmit`. Expected: clean.
  - Run `git diff --stat feat/institutional HEAD -- mocks lib/dev scripts/dev lib/wallet.ts`. Expected: no output (Owen's rule).
  - Then the browser pass:
    - **As Ada and as Sarah:** open `/admin`, `/admin/users`, `/admin/payments` and `/admin/courses`. They open as before; a regular admin keeps every other power. No console errors appear apart from the known Vivid 403 and Ably placeholder-key noise.
    - **As `student`:** `/dashboard` is unchanged.
  - Stop the server.

- [ ] **Step 7: Commit.**

```bash
git add components/admin/admin-sidebar.tsx components/admin/bottom-nav.tsx docs/institutional-blueprint-plan.md docs/mastery-academy-plan.md context.md
git commit -m "feat(admin): Team in the admin nav and a Super admin eyebrow for super admins; Phase 21 docs"
```

## Report (end of phase)

Read out the Phase 21 exit criteria from `docs/institutional-blueprint-plan.md`, then add:
- **For the owner:**
  - The runbook's "Admin levels" step 1 must run first. Until a super admin exists, nobody can grant admin access from the web.
  - Every existing admin becomes a regular admin.
- **Open risk (ruling 2):** a brand-new account whose Clerk `publicMetadata.role` is `"admin"` still starts as a regular admin, unaudited. The Academy shares the hub's Clerk instance, and `syncRoleToClerk` writes `role` there. The owner should decide whether only the Academy may mint admins.
- **For the controller:** update the main checkout's local `CLAUDE.md` Auth paragraph, which worktrees don't have:
  - `requireSuperAdmin()` for D32 actions;
  - Clerk metadata raises an existing account only to `INSTRUCTOR`;
  - roles and levels change only through `applyRoleChange`.
