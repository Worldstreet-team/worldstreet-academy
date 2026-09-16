# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Agent Behavior

- **Think before coding.** Read the surrounding code first. If the request is ambiguous — which role can do it, which bucket a file lands in, whether money moves — ask instead of guessing.
- **Simplicity first.** No new abstraction layers, wrappers, or "flexible" config for a single call site. Match the pattern already in the neighboring file.
- **Surgical changes.** Touch only the files the task requires. No drive-by refactors, dependency bumps, reformatting, or renames.
- **Goal-driven execution.** Finish with explicit verification: `pnpm lint` and `npx tsc --noEmit` at minimum; drive the affected route in `pnpm dev` for behavior changes. Report failures with output — never claim done on unverified work.
- **No new deps** without asking. No `any` to silence TypeScript. No secrets or env values in code.

## Commands

```bash
pnpm dev                 # dev server :3000
pnpm build               # production build
pnpm lint                # eslint flat config (next core-web-vitals + typescript)
npx tsc --noEmit         # typecheck — no package script exists
pnpm seed                # scripts/seed.ts — demo instructor + courses
```

pnpm 10.32.0 is enforced via `packageManager`. **No test runner is configured** — verification is manual/E2E, so there is no single-test command; do not invent one.

`scripts/*.{ts,mjs}` are one-off maintenance jobs run directly (`npx tsx scripts/backfill-avatars.ts`, `node scripts/grant-admin.mjs`). They load `.env.local`. Several mutate production data (`reconcile-orders`, `migrate-exam-indexes`, `grandfather-instructors`) — read before running.

Deploys are Docker on Coolify, **not Vercel**. The Dockerfile copies `next.config.ts` into the runner on purpose: `next start` reads `images.remotePatterns` at runtime.

## Stack

Next.js 16 App Router · React 19 · TypeScript strict · MongoDB/Mongoose · Clerk · Tailwind v4 · Shadcn Nova (Base UI) · Ably · Cloudflare RealtimeKit · Cloudflare R2 · Zod · TanStack Query · Zustand.

Imports use `@/*` → repo root. Zod is imported as `import { z } from "zod/v4"`.

## Architecture

**Route groups** — `(marketing)` public · `(auth)` local-dev sign-in only · `(platform)` `/dashboard/*` · `(instructor)` `/instructor/*` · `(admin)` `/admin/*`.

`middleware.ts` enforces only *authentication* (plus an `x-next-pathname` header for server components). **Role gating lives in each group's `layout.tsx`** — instructor requires `INSTRUCTOR|ADMIN` else redirects to `/dashboard/become-instructor`; admin requires `ADMIN`. Put new gates there, not in middleware.

**Local-dev switch.** A `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` starting with `pk_test_` selects local `/login`; otherwise Clerk runs in satellite mode against `worldstreetgold.com`. This branch is repeated in `middleware.ts`, `app/layout.tsx`, and every authed layout — mirror it in any new auth redirect.

**Auth.** Clerk is the identity provider; **MongoDB is authoritative for `role`**. `lib/auth/sync.ts` resolves a Clerk id via `authUserId` *or* `linkedAuthIds` (mobile and dev Clerk instances mint different ids per human), and on an email match it **links** the new id — never overwrite `authUserId`, it is the wallet subject. Clerk metadata may only upgrade a `USER`, never demote.

- RSC pages/layouts → `getCachedUser()` (`lib/auth/cached.ts`, `React.cache`-deduped)
- Server actions → `getCurrentUser()`; admin actions → `requireAdmin()` (throws, caught into the error shape)

**Data.** `connectDB()` from `lib/db` caches the connection on `global` — call it first in every action and route. Models are barrel-exported from `lib/db/models`.

**Mutations are server actions**, not API routes. Every action in `lib/actions/*.ts` follows: `connectDB()` → auth/ownership check → Zod parse → mutate → `revalidatePath()` → return `{ success: true, data }` or `{ success: false, error, code? }`. Actions **return** errors; they do not throw across the boundary.

Only four route handlers exist, for what actions can't do: `/api/calls/end` (sendBeacon), `/api/messages/poll`, and `/api/cron/{earnings,reminders}` (POST, `Authorization: Bearer $CRON_SECRET`, idempotent, run as Coolify scheduled tasks).

**Money.** The Academy holds no balance. `lib/wallet.ts` is a server-only client for the central Worldstreet Wallet; amounts are **integer US cents**. Missing wallet env = disabled = every money op **fails closed**; paid enrollment must never succeed without a confirmed debit. Flow: charge → `Order` + `PaymentEvent` → `Enrollment` → instructor `Earning` (pending, matures after `EARNINGS_CLEARING_DAYS`, split by `INSTRUCTOR_REVENUE_SHARE`). Refunds clawback reusing the credit reference as idempotency key.

**Realtime.** `lib/call-events.ts` is an **Ably** bus: one channel per user (`user:<id>`, event `event`, type discriminator in payload) carrying `call:*`, `message:*`, `meeting:*`. Actions publish via REST; clients subscribe via `lib/hooks/use-call-events.ts` with a token from `getAblyTokenAction`.

A/V calls and live meetings use Cloudflare RealtimeKit (Dyte REST, `lib/realtime.ts`). `lib/rtk-client.ts` is a **module-level singleton kept outside React state** so the WebSocket survives re-renders and HMR — do not convert it to `useRealtimeKitClient()`. `reactStrictMode: false` exists for this reason. `participantLeft` is debounced ~3s to swallow the SDK's phantom leave.

**Storage.** R2 via S3 SDK (`lib/r2.ts`) with presigned browser uploads. **Two buckets by design**: `R2_BUCKET_NAME` is public (thumbnails, video); `R2_RESOURCES_BUCKET_NAME` must have no public access — paid resources are stored as keys only and resolved to short-lived signed URLs at download. Never write a paid resource to the public bucket.

**Vivid AI** (`lib/vivid/`, `components/vivid/`) — OpenAI Realtime voice assistant over WebRTC, mounted in all authed layouts. `prompt.ts` builds a pathname-aware prompt; `functions.ts` splits client (navigation/UI) vs server (data) tools.

## UI Conventions

- **The canonical design system lives at the workspace root** — read `../design-system/` (foundations, typography, icons, components, screens, motion) and `../design-tokens/tokens.css` before building UI. **DS v2 (2026-08-05):** the ecosystem collapsed to ONE stone+gold look adopted from `../dashboard-revamp/` (the hub). `data-ws-theme="platform"` now resolves to the stone ladder — page `#0C0A09`, surface `#1C1917`, gold `#EAB308` (`platform-light` → the paper light mode). Poppins (display) + Public Sans (UI) unchanged. Value claims elsewhere in this file that say `#0B0B0F`/`#FFCC29` predate v2 — the token file wins. A vendored token mirror is imported at `app/ws-tokens.css`; semantic Tailwind utilities (`bg-ws-surface`, `text-ws-muted`, `text-ws-gold`, `border-ws-hairline`…) are declared in `app/globals.css`. Never hardcode a palette hex — go through `var(--ws-*)`.
- **Base UI composition uses the `render` prop, never `asChild`**: `<Button render={<Link href="…" />}>`.
- Icons: `lucide-react` only (stroke 2, round caps). Do not add `@hugeicons` or any other icon set; never use emoji as icons. Runtime-chosen icons render via `components/shared/render-icon.tsx`.
- Theming: `next-themes` toggles dark/light; `ThemeProvider` syncs the choice to `data-ws-theme="platform" | "platform-light"` on `<html>` so the shared tokens drive both palettes. Dark is the default.
- Radii come from the token ladder only: 4/7/10/13/999 (`rounded-xs/sm/md/lg/full`). No `rounded-2xl/3xl`. Motion: 120/200/320ms with `var(--ws-ease)`, opacity/transform only, no infinite ambient loops, no hover scaling — hover lightens one surface step.
- Gold is reserved for primary CTAs, active nav and brand moments; accents appear only as ~13% washes behind icons. Money/stats use tabular numerals.
- **Brand lockup** (ratified 2026-08-03, design-system 04-components → TopNav): gold wsa-mark 26px (`/brand/wsa-mark.png`, unboxed) + "WorldStreet" Poppins SemiBold 15 + gold uppercase app eyebrow ("ACADEMY"; "ADMIN" in the admin shell). Used in all three sidebars, the marketing navbar and footer — never a typed-letter "W" tile. Cross-app links live in the sidebar "WorldStreet apps" group with DS labels (Dashboard/Xstream/Social/Shop).
- RSC-first — add `"use client"` only where interaction requires it.
- Page content uses `pb-24 md:pb-8` to clear the mobile bottom nav.
- Section separators use `·`, not `|`. Ratings are orange filled `star` (`--ws-accent-star`, the one sanctioned literal).
- Translation is a custom UI driving a hidden Google Translate widget (`components/translator/`).

## Repo Docs — Trust Level

- `REALTIME_IMPLEMENTATION.md` — RTK/Dyte lessons valid; its **SSE sections are outdated** (replaced by Ably, `/api/calls/events` is gone).
- `projectscope.md` — original scope; its "mock data / TBD" stack is historical.
- `context.md` — running UI decision log, partially stale.
