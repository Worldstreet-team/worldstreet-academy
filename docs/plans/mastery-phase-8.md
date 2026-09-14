# Mastery Academy — Phase 8 Implementation Plan (Launch: SEO, legal links, cleanup, docs, production runbook)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The repository is launch-ready, and the owner holds one ordered runbook for everything that touches production or another repo.
- Search engines and share previews see the public site:
  - `/sitemap.xml` lists home, schools, published programs and faculty;
  - `/robots.txt` keeps the signed-in apps out;
  - every page carries the brand share card, or its program thumbnail, plus canonical URLs.
- The footer's Legal column links the WorldStreet hub's published legal documents instead of two dead labels.
- The two one-off identity scripts with real Clerk ids are gone.
- `CLAUDE.md` and `context.md` describe the app as it now is.
- `docs/launch-runbook.md` gives the owner exact commands and checks for:
  - env and scheduled tasks;
  - deploy order against the Go API;
  - the catalogue migration and the certificate-ID backfill;
  - the §17 journey QA;
  - rollback and post-launch cleanup.

**Architecture:**
- **Metadata** is file-convention only, with no new dependency:
  - `app/opengraph-image.tsx` (`next/og`, bundled with next 16.1.6), `app/sitemap.ts` and `app/robots.ts`;
  - `metadataBase` and default `openGraph`/`twitter` in the root layout;
  - canonicals through `appUrl()` from `lib/app-url.ts`.
- **Legal** stays with the hub. `https://www.worldstreetgold.com/legal` publishes the ecosystem's documents and states they apply across every platform. The Academy links them and keeps no copy.
- **Production work is documentation.** Tasks 4–5 write docs. Nothing in this plan writes to a production service; the only production contact is Task 3's read-only GETs of the hub's public legal URLs.

**Tech Stack:** Next.js 16.1.6 App Router (Metadata API, `next/og` ImageResponse) · React 19 · TypeScript strict · Tailwind v4 + DS v2 · Mongoose (read-only here, through existing actions).

**Spec:**
- `docs/mastery-academy-plan.md`:
  - § "Phase 8 — Launch" (tasks 1–8, exit criteria);
  - §0.4 cross-repo checklist;
  - Risk register 3 (catalogue on live data) and 6 (satellite return URL);
  - D1, D3, D9.
- `docs/mastery-academy-blueprint.md` §17 "The Exact User Journey" (binding order for the QA checklist).
- `docs/go-patches-phase-3.md` (R1–R7).
- Phase 5 plan ruling 22 (Go and `instructorProfile`).
- Phase 6 plan "Notes for the phase report" (Go / mobile, Phase 8 order, revocation).

**Branch:** `mastery/phase-8`, cut from the Phase 6 tip (`mastery/phase-6`, which contains Phase 5). Anchors that exist only after Phase 5 or Phase 6 lands are marked **[P5]** / **[P6]**. Locate every edit by its quoted anchor text, never by line number.

**Controller rulings (binding — do not re-litigate):**

1. **Legal = the hub's published documents (option a). No `/terms` or `/privacy` routes, no draft copy.**
   - *Evidence (fetched 2026-09-14):* `https://www.worldstreetgold.com/legal` answers 200 with "Legal & Compliance". It says "Read them in the browser or download the PDF — each one applies across all nine platforms on a single login", and its platform menu lists Academy.
   - Its documents are PDFs, each 200 `application/pdf`:
     - `/legal-docs/WS%20Terms%20of%20Business.pdf`
     - `/legal-docs/Privacy%20Policy.pdf`
     - `/legal-docs/WS%20Cookie%20Policy%201.pdf`
   - `/legal/privacy-policy`, `/terms` and `/privacy` are 404 on the hub.
   - *Code facts:* the Academy footer renders "Terms of Service" and "Privacy Policy" as plain `<span>`s. No legal copy exists in this repo; the only "terms" string is the instructor-application checkbox. The local `../dashboard-revamp` has no legal route on `main` or its current branch, and `../worldstreet-dashboard` has none either.
   - *Ruling:* the Legal column links "Terms of Business", "Privacy Policy" and "Cookie Policy" (the documents' own names, same hrefs as the hub's footer) and "All legal documents" → `/legal`. They are external links: new tab, `rel="noopener noreferrer"`.
   - *Why:* the Academy is a satellite of the hub (one account, one set of documents). Inventing terms, refunds, jurisdictions or company details is banned.
   - The hub page's source not being in the local hub checkout is an owner follow-up (runbook §10). Whether legal must confirm the documents cover Academy specifics is the owner's call (runbook B4).
2. **`metadataBase: new URL(APP_URL)` in `app/layout.tsx`.** Canonicals use `appUrl()`. *Why:* without a base, a relative `og:image` resolves against localhost, and `lib/app-url.ts` already ignores a loopback value in production.
3. **Default share card = `app/opengraph-image.tsx`** (static, Node runtime, 1200×630).
   - It shows the wsa-mark (read from `public/brand/wsa-mark.png` as a data URI, keeping its 206×118 ratio), `BRAND.wordmark` and the gold uppercase `BRAND.eyebrow`, then `BRAND.tagline` and `BRAND.name`, on `#0C0A09`.
   - Satori has no CSS cascade, so token values are literals, each commented with its token name. This is the one sanctioned hex exception.
   - Font: next/og's bundled Noto Sans. *Why:* no Poppins font file exists locally (checked `node_modules`, `public`, `app`), and fetching one at build adds a network failure point. Poppins on the card is a post-launch refinement.
4. **Program share preview.**
   - *Code fact* (`node_modules/next/dist/lib/metadata/resolve-metadata.js`): a segment's `openGraph` **replaces** the inherited object, and the root file image is attached only at the root segment. A page that sets `openGraph` without `images` therefore loses the site card.
   - *Ruling:* `/programs/[slug]` sets `openGraph` (thumbnail as the image) **only when `thumbnailUrl` exists**. Otherwise it sets none and inherits the site card; Next fills og:title/description from the page metadata (`inheritFromMetadata`).
   - The root sets `twitter: { card: "summary_large_image" }`; Next fills twitter title/description/images from openGraph (`postProcessMetadata`).
5. **Canonicals and descriptions.**
   - Add canonicals to `/`, `/schools`, `/schools/[slug]` and `/programs`. `/programs/[slug]` (Phase 2) and `/faculty`, `/faculty/[username]` **[P5]** already have them.
   - `/verify/[certificateId]` **[P6]** stays noindex without a canonical. `/courses*` are redirects and get no metadata.
   - The root layout's stale description ("Learn cryptocurrency trading, DeFi…") becomes `SITE_DESCRIPTION`, the homepage's existing sentence moved into `lib/brand.ts`.
6. **Sitemap.**
   - Contents: `/`, `/schools`, the 8 `/schools/<slug>` (SCHOOLS order), `/programs`, and every program `fetchBrowseCourses()` returns (the set `/programs` lists, coming-soon included).
   - `/faculty` and each profile are included only when `fetchFaculty()` **[P5]** is non-empty.
   - No `lastModified`/`priority`/`changeFrequency`: `BrowseCourse` carries no update time, and nothing may be invented.
   - `export const revalidate = 0`, like the marketing pages, so the catalogue is never frozen at build.
7. **Robots.**
   - `allow: "/"`.
   - `disallow`: `/dashboard`, `/instructor`, `/admin`, `/api/`, `/login`, `/register`.
   - `sitemap: appUrl("/sitemap.xml")`.
   - **`/verify` is not disallowed.** *Why:* a crawler must be allowed to fetch a page to read its `noindex`; a disallowed URL can still be indexed from links.
   - robots is static (resolved at build); `APP_URL` then falls back to the production origin, which is correct.
8. **Cleanup: `git rm link-tmp.cjs link-mobile-identity.cjs`.** Both are tracked since `48ae3c0` (samie105, 2026-08-15). What they did (read 2026-09-14):
   - Both hard-code one person's mobile Clerk id and web Clerk id.
   - `$addToSet` the mobile id into the web user's `linkedAuthIds`.
   - Only if the user holding the mobile id is a thin placeholder (`@users.noemail` email and first name "User"/empty), set its `authUserId` to `orphaned:<mobile id>`; otherwise leave it.
   - Print which user the mobile id now resolves to.
   - `link-tmp.cjs` reads the URI from `MURI`. `link-mobile-identity.cjs` parses `MONGODB_URI` out of `.env.local` (production) and says "Safe to delete this file afterwards".

   Nothing references them, and `lib/auth/sync.ts` now links ids on email match. They are not moved under `scripts/`, because nothing should run them again. Git history is **not** rewritten (Clerk user ids are identifiers, not credentials); that is listed for the owner (runbook §11).
9. **Docs.**
   - `CLAUDE.md`:
     - five route handlers, checked against `app/api`;
     - the Mastery modules;
     - public URLs;
     - script warnings;
     - the `dev:mock` credentials warning;
     - the doc index.
   - The `scripts/dev-mock.mjs` header comment, which falsely says R2/Ably/RealtimeKit/OpenAI/Resend/wallet "stay unconfigured", is corrected.
   - `context.md` gets a dated entry.
   - `docs/go-patches-phase-3.md` gains §5 (Phase 5 ruling 22 + Phase 6 Go notes) so the backend owner has one list; plan §0.4 gains matching rows.
10. **The runbook is owner-executed and holds no secret value.**
    - Production URIs enter the shell through `read -rs`.
    - Every DB script call passes `MONGODB_URI="$PROD_URI"` explicitly.
    - Scripts run from a checkout: the runner image has no `scripts/`, since the Dockerfile copies only `.next`, `public`, `next.config.ts` and package files.
11. **Scheduled-task command = Node `fetch` inside the app container to `http://127.0.0.1:3000`.**
    - *Code fact:* the runner is `node:22-alpine` with only `libc6-compat ca-certificates` added, so `curl` (which the route comments show) is absent.
    - Schedules come from each route's own comment: course-live every 5 min, reminders every 10, earnings every 15.
12. **Five tasks:** metadata + share card → sitemap/robots → legal links + script removal → runbook + Go/§0.4 docs → CLAUDE.md/context.md/dev-mock comment.

**Rulings added while planning (same force):**

13. **Dependency markers.** If an **[P5]**/**[P6]** anchor differs at the branch point, match the current text, keep the intent, and say so in the report.
14. **No design-system edit.** Plan Phase 8 task 5 lists `../design-system/04-components` (lockup eyebrow). A grep of `design-system/*.md` on 2026-09-14 found no literal "ACADEMY", and the code lockup reads `BRAND.eyebrow`. That repo item becomes confirm-only (runbook §10).
15. **`SITE_DESCRIPTION` is appended to `lib/brand.ts` after `BRAND`.** *Why:* one sentence with two call sites (root layout, homepage), and brand copy lives there. Phase 6 edits the top of `BRAND` **[P6]**; appending after `} as const` doesn't collide.
16. **Footer classes stay the neighbours'** (`text-sm text-muted-foreground hover:text-foreground transition-colors`), as Phase 5 did. Hrefs are full literal URLs, so the runbook and footer can be diffed by grep.
17. **No `next build` in task verification.** It loads `.env.local` (production credentials) and writes `.next` next to the controller's running dev server. The Coolify build log is the build proof (runbook §4). Task 2 carries an optional controller-only build with local overrides.
18. **Metadata checks use plain `curl`.** The saved Phase 2 page `guest-forex.html` shows `<link rel="canonical">` and `<meta name="description">` outside `<script>` for a curl user agent. Checks strip hosts, because dev resolves `APP_URL` from the environment (a `localhost:3000` origin in the saved page).
19. **QA fixtures from mock data (read-only):** `bitcoin-cryptocurrency-fundamentals` has a seed thumbnail (`images.unsplash.com/photo-1518546305927…`, 9 hits in the saved page); `forex-trading-mastery` has none (0 hits).

## Global Constraints

- **Schema:** no model changes. No new dependencies. No `any`. Zod (if touched) via `zod/v4`. None is expected.
- **`"use server"` files are imported, never edited** (`lib/actions/student.ts` supplies `fetchBrowseCourses`, `fetchFaculty` **[P5]**).
- **Copy (verbatim):**
  - Footer: "Terms of Business" · "Privacy Policy" · "Cookie Policy" · "All legal documents".
  - Brand via `BRAND`/`SITE_DESCRIPTION` from `@/lib/brand`.
  - Never invent legal terms, refund policy, jurisdictions, company details, prices or dates. The runbook quotes prices only as "what the dry run prints".
- **Links:**
  - Legal hrefs exactly as in Task 3.
  - Programs `/programs/${slug}`; faculty `facultyHref(username)` **[P5]**.
  - Never ship a dead link.
- **UI:** no new markup except the footer list, with neighbour classes (ruling 16). `lucide-react` only if an icon were needed (none is). Base UI `render`, never `asChild` (no composition this phase). The OG literals are the one hex exception (ruling 3).
- **Secrets:**
  - Never read or print `.env.local` values; names only (`grep -o '^[A-Z0-9_]*=' .env.local`).
  - The runbook contains placeholders (`<…>`, `$PROD_URI`) only.
  - Never run a script against a non-local database.
- **Line endings:** `app/layout.tsx`, `components/marketing/footer.tsx`, `app/(marketing)/page.tsx` and `context.md` are CRLF in the working tree (`core.autocrlf=true`). Keep them. `git diff --numstat <file>` must show only the lines you meant to change.
- **Commits:**
  - One or more per task; every message ends with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
  - Add files by name; never `git add -A`; never commit `.env*`.
  - **Never run `git stash`.** The untracked `AGENTS.md` isn't yours: don't edit or add it.
- **Surgical:** touch only the listed files, plus any a compile error forces (say so in the report). No reformatting.

## Verification kit (controller-owned — use it, never start or restart servers yourself)

No test runner exists. Every task ends with:
- `npx tsc --noEmit 2>&1 | grep -v '^\.next/'` printing nothing;
- `npx eslint <every .ts/.tsx/.mjs file you touched>` printing no errors or warnings. Markdown and `.cjs` removals need no lint;
- the task's runtime checks.

Set once per shell (Git Bash, repo root):

```bash
H="C:/Users/owen/AppData/Local/Temp/claude/C--Users-owen-downloads-projects-worldstreet-worldstreet-academy/d4ab89bb-8435-4b94-b993-6b42283d1e4b/scratchpad/phase-3"
P8="C:/Users/owen/AppData/Local/Temp/claude/C--Users-owen-downloads-projects-worldstreet-worldstreet-academy/d4ab89bb-8435-4b94-b993-6b42283d1e4b/scratchpad/phase-7-8"
export NODE_PATH="$(pwd)/node_modules"
BASE=http://localhost:3001
B=~/.claude/skills/gstack/browse/dist/browse
SARAH=6a6fc0ba6433bbbd6322bdfd   # INSTRUCTOR Sarah Chen, username sarah_chen, all published programs
strip() { perl -pe 's/<script\b.*?<\/script>//gs'; }
count() { grep -o -- "$1" | wc -l | tr -d ' '; }
page() { curl -s "$BASE$1" | strip; }
hostless() { sed -E 's#https?://[^/"]+##g'; }
```

- **Dev server:** `pnpm dev:mock` on http://localhost:3001, already running from the Phase 6 tip.
  - Mock Clerk; local Mongo `mongodb://127.0.0.1:27017/worldstreet-academy`.
  - Placeholder Resend/RealtimeKit/OpenAI keys (Phase 4 `restart-dev.ps1`). Never `.env.local`.
  - Turbopack picks up new app-dir files. If `/sitemap.xml`, `/robots.txt` or `/opengraph-image` 404s right after its file is created, report it and the controller restarts.
- **Marketing pages** have no `loading.tsx`, so `notFound()` is a real 404 (`/programs/nope` → 404).
- **HTML:**
  - Next HTML is one line: count with `grep -o … | wc -l`.
  - Strip scripts first.
  - `&` is escaped `&amp;`, `'` as `&#x27;`.
- **Mock DB helper** (Task 2's optional check only): `node "$H/mockdb.cjs" set-role <userId> <role>` **[P5]**, then `node "$H/mockdb.cjs" restore`.
- **Browser (controller only):** `$B viewport 400x800` · `$B goto <url>` · `$B wait --load` · `$B js "document.body.scrollWidth + '/' + window.innerWidth"` · `$B screenshot --viewport "$P8/<name>.png"`. Steps marked **(controller)** are left for the controller; implementers list them as "left for controller".
- **Mock data baseline (read-only):**
  - 15 published programs (the saved `/programs` page links 15 slugs), including `bitcoin-cryptocurrency-fundamentals` (thumbnail) and `forex-trading-mastery` (no thumbnail).
  - Faculty **[P5]**: Sarah Chen only.

## Controller setup (once, before Task 1)

1. **Branch.**
   - After Phases 5 and 6 are committed, cut `mastery/phase-8` from the Phase 6 tip.
   - Preflight: `ls lib/faculty.ts lib/countries.ts lib/certificate-id.ts scripts/backfill-certificate-ids.mjs "app/(marketing)/faculty/page.tsx" "app/(marketing)/faculty/[username]/page.tsx" "app/(marketing)/verify/[certificateId]/page.tsx"` → all seven exist.
   - `git ls-files | grep '^link-'` → `link-mobile-identity.cjs`, `link-tmp.cjs`.
2. **Dev server.**
   - Running from the Phase 6 tip with placeholders; `node "$H/mockdb.cjs" restore`.
   - `curl -s -o /dev/null -w '%{http_code}\n' "$BASE/programs/forex-trading-mastery"` → `200`.
   - `curl -s -o /dev/null -w '%{http_code}\n' "$BASE/faculty/sarah_chen"` → `200`.
3. **No new mock-DB commands, no restarts planned.**

---

### Task 1: Site metadata — `metadataBase`, the default share card, canonicals, program thumbnails as og:image

**Files:**
- Modify: `lib/brand.ts` (append `SITE_DESCRIPTION` at the end)
- Modify: `app/layout.tsx` (imports; `metadata`)
- Create: `app/opengraph-image.tsx`
- Modify: `app/(marketing)/page.tsx` (imports; `metadata`)
- Modify: `app/(marketing)/schools/page.tsx` (one import; `metadata`)
- Modify: `app/(marketing)/schools/[slug]/page.tsx` (one import; `generateMetadata` return)
- Modify: `app/(marketing)/programs/page.tsx` (one import; `metadata`)
- Modify: `app/(marketing)/programs/[slug]/page.tsx` (one import; `generateMetadata`)

**Interfaces:**
- Consumes:
  - `APP_URL`, `appUrl` (`lib/app-url.ts`);
  - `BRAND` (`lib/brand.ts`);
  - `ProgramDetail.thumbnailUrl/shortDescription/description/slug/title` (`lib/actions/student.ts`, via the page's existing `getProgram`).
- Produces:
  - `export const SITE_DESCRIPTION: string` (`lib/brand.ts`);
  - the route `/opengraph-image` (PNG 1200×630);
  - root `metadata.metadataBase/openGraph/twitter`.

- [ ] **Step 1: Site description.** Append to the end of `lib/brand.ts`, after the last line `} as const` (the close of `BRAND`; Phase 6 adds `signatory` above it **[P6]**):

```ts

/**
 * Default meta description — the root layout's (every page without its own)
 * and the homepage's. Spec §1 hero copy; the name comes from BRAND (D1).
 */
export const SITE_DESCRIPTION = `Master practical, in-demand skills through expert-led programs designed for the new and modern economy. Explore the eight schools of ${BRAND.name}, choose your path and start building capabilities you can apply in the real world.`
```

- [ ] **Step 2: Root metadata.** In `app/layout.tsx` (CRLF, semicolons):
  1. Replace `import { BRAND } from "@/lib/brand";` with:

```ts
import { BRAND, SITE_DESCRIPTION } from "@/lib/brand";
import { APP_URL } from "@/lib/app-url";
```

  2. Replace

```ts
export const metadata: Metadata = {
  title: {
    default: BRAND.name,
    template: `%s | ${BRAND.name}`,
  },
  description:
    "Learn cryptocurrency trading, DeFi, risk management, and blockchain development from industry experts.",
  icons: {
```

   with

```ts
export const metadata: Metadata = {
  // Absolute base for og:image, canonical and share URLs (lib/app-url.ts — loopback is ignored in production).
  metadataBase: new URL(APP_URL),
  title: {
    default: BRAND.name,
    template: `%s | ${BRAND.name}`,
  },
  description: SITE_DESCRIPTION,
  // Every page inherits this card and app/opengraph-image.tsx unless its own metadata sets openGraph.
  openGraph: {
    siteName: BRAND.name,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
  icons: {
```

- [ ] **Step 3: The share card.** Create `app/opengraph-image.tsx`:

```tsx
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { ImageResponse } from "next/og"
import { BRAND } from "@/lib/brand"

/**
 * Site-wide share card (1200×630): the brand lockup on the stone page. Every
 * route inherits it unless its metadata sets `openGraph` itself — a program
 * with a thumbnail does (app/(marketing)/programs/[slug]/page.tsx).
 *
 * Satori renders outside the CSS cascade, so the DS v2 tokens are literals
 * here, each named after its token in design-tokens/tokens.css (dark mode).
 * Type is next/og's bundled Noto Sans: no font is fetched at build time.
 */

export const alt = BRAND.name
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const PAGE = "#0C0A09" // --background (stone page)
const INK = "#FBFAF9" // --foreground, oklch(0.986 0.002 67.8)
const MUTED = "#A8A29E" // --muted-foreground
const GOLD = "#EAB308" // --primary (gold)

export default async function OpengraphImage() {
  // public/brand/wsa-mark.png is 206×118; the lockup renders it contained, so keep that ratio.
  const mark = await readFile(join(process.cwd(), "public/brand/wsa-mark.png"))
  const markSrc = `data:image/png;base64,${mark.toString("base64")}`

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: PAGE,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <img src={markSrc} width={140} height={80} alt="" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 46, color: INK, letterSpacing: -1 }}>{BRAND.wordmark}</div>
            <div style={{ fontSize: 22, color: GOLD, letterSpacing: 5, textTransform: "uppercase" }}>
              {BRAND.eyebrow}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ maxWidth: 960, fontSize: 68, lineHeight: 1.1, color: INK, letterSpacing: -2 }}>
            {BRAND.tagline}
          </div>
          <div style={{ marginTop: 24, fontSize: 28, color: MUTED }}>{BRAND.name}</div>
        </div>
      </div>
    ),
    size
  )
}
```

   (`@next/next/no-img-element` skips `opengraph-image` files by path, per its own rule source; `alt=""` satisfies `jsx-a11y/alt-text`.)

- [ ] **Step 4: Homepage.** In `app/(marketing)/page.tsx` (CRLF) replace

```ts
import { BRAND } from "@/lib/brand"

export const metadata: Metadata = {
  description: `Master practical, in-demand skills through expert-led programs designed for the new and modern economy. Explore the eight schools of ${BRAND.name}, choose your path and start building capabilities you can apply in the real world.`,
}
```

   with

```ts
import { SITE_DESCRIPTION } from "@/lib/brand"
import { appUrl } from "@/lib/app-url"

export const metadata: Metadata = {
  description: SITE_DESCRIPTION,
  alternates: { canonical: appUrl("/") },
}
```

- [ ] **Step 5: Schools index.** In `app/(marketing)/schools/page.tsx`:
  1. Replace `import { BRAND } from "@/lib/brand"` with

```ts
import { BRAND } from "@/lib/brand"
import { appUrl } from "@/lib/app-url"
```

  2. Replace

```ts
  description:
    "Your future can take many directions. Choose the school that matches your interests, goals and ambitions.",
}
```

   with

```ts
  description:
    "Your future can take many directions. Choose the school that matches your interests, goals and ambitions.",
  alternates: { canonical: appUrl("/schools") },
}
```

- [ ] **Step 6: School page.** In `app/(marketing)/schools/[slug]/page.tsx`:
  1. Replace `import { ProgramRow } from "@/components/marketing/program-row"` with

```ts
import { ProgramRow } from "@/components/marketing/program-row"
import { appUrl } from "@/lib/app-url"
```

  2. Replace `  return { title: school.name, description: school.tagline ?? school.blurb }` with

```ts
  return {
    title: school.name,
    description: school.tagline ?? school.blurb,
    alternates: { canonical: appUrl(`/schools/${school.slug}`) },
  }
```

- [ ] **Step 7: Programs index.** In `app/(marketing)/programs/page.tsx`:
  1. Replace `import { BRAND } from "@/lib/brand"` with

```ts
import { BRAND } from "@/lib/brand"
import { appUrl } from "@/lib/app-url"
```

  2. Replace

```ts
  description: `Browse every program across the eight schools of ${BRAND.name}.`,
}
```

   with

```ts
  description: `Browse every program across the eight schools of ${BRAND.name}.`,
  alternates: { canonical: appUrl("/programs") },
}
```

- [ ] **Step 8: Program page.** In `app/(marketing)/programs/[slug]/page.tsx`:
  1. Replace `import { appUrl } from "@/lib/app-url"` with

```ts
import { appUrl } from "@/lib/app-url"
import { BRAND } from "@/lib/brand"
```

  2. Replace

```ts
  if (!program) return {}
  return {
    title: program.title,
    description: program.shortDescription ?? program.description.slice(0, 160),
    alternates: { canonical: appUrl(`/programs/${program.slug}`) },
  }
}
```

   with

```ts
  if (!program) return {}
  const description = program.shortDescription ?? program.description.slice(0, 160)
  const url = appUrl(`/programs/${program.slug}`)
  return {
    title: program.title,
    description,
    alternates: { canonical: url },
    // A page's openGraph REPLACES the inherited one, so set it only with a thumbnail
    // to show; without one the page keeps the site card (app/opengraph-image.tsx)
    // and Next fills og:title/description from the fields above.
    ...(program.thumbnailUrl
      ? {
          openGraph: {
            siteName: BRAND.name,
            type: "website",
            url,
            title: `${program.title} | ${BRAND.name}`,
            description,
            images: [{ url: program.thumbnailUrl, alt: program.title }],
          },
        }
      : {}),
  }
}
```

   (Phase 5 Task 5 edits this file's `ProgramInstructor` props **[P5]**, not `generateMetadata`.)

- [ ] **Step 9: Verify — static.**
  1. tsc (filtered) prints nothing.
  2. `npx eslint lib/brand.ts app/layout.tsx app/opengraph-image.tsx "app/(marketing)/page.tsx" "app/(marketing)/schools/page.tsx" "app/(marketing)/schools/[slug]/page.tsx" "app/(marketing)/programs/page.tsx" "app/(marketing)/programs/[slug]/page.tsx"` prints nothing.
  3. `git diff --numstat app/layout.tsx "app/(marketing)/page.tsx"` shows small counts (under 20 per file), not whole-file rewrites.

- [ ] **Step 10: Verify — runtime.**
  1. **Home carries the card.**
     - `page / | grep -o '<meta property="og:image" content="[^"]*"' | hostless` → exactly one line, starting `<meta property="og:image" content="/opengraph-image`.
     - Each of these → `1`:
       - `page / | count 'og:image:width" content="1200"'`
       - `page / | count 'og:image:height" content="630"'`
       - `page / | count 'og:image:alt" content="WorldStreet Mastery Academy"'`
       - `page / | count 'og:site_name" content="WorldStreet Mastery Academy"'`
       - `page / | count 'og:type" content="website"'`
       - `page / | count 'name="twitter:card" content="summary_large_image"'`
     - `page / | count 'name="twitter:image"'` → ≥ `1`.
     - `page / | grep -o '<link rel="canonical" href="[^"]*"' | hostless` → `<link rel="canonical" href="/"`.
     - `page / | count '<meta name="description" content="Master practical, in-demand skills'` → `1`.
  2. **The image renders.**

```bash
OG=$(page / | grep -o '<meta property="og:image" content="[^"]*"' | head -1 | sed -E 's/.*content="//; s/"$//; s/&amp;/\&/g' | hostless)
curl -s -o "$P8/og-default.png" -w '%{http_code} %{content_type}\n' "$BASE$OG"
file "$P8/og-default.png"
```

     → `200 image/png`, then `PNG image data, 1200 x 630`.
     **(controller)** Open `$P8/og-default.png`: the mark with "WorldStreet" and the gold "MASTERY ACADEMY" top-left, the tagline, and the name below; nothing clipped.
  3. **Other pages inherit.**
     - For each of `/schools`, `/schools/trading-financial-markets`, `/programs`, `page <path> | grep -o '<meta property="og:image" content="[^"]*"' | hostless` → one line starting `…content="/opengraph-image`.
     - `page <path> | grep -o '<link rel="canonical" href="[^"]*"' | hostless` → `/schools`, `/schools/trading-financial-markets`, `/programs` respectively.
     - `page /schools | grep -o '<meta property="og:title" content="[^"]*"'` → content starts `Schools`.
  4. **Program with a thumbnail** (`/programs/bitcoin-cryptocurrency-fundamentals`, ruling 19):
     - `count '<meta property="og:image"'` → `1`, and its content starts `https://images.unsplash.com/photo-1518546305927-5a555bb7020d`.
     - `count 'og:image:alt" content="Bitcoin &amp; Cryptocurrency Fundamentals"'` → `1`.
     - `grep -o '<meta property="og:url" content="[^"]*"' | hostless` → `…content="/programs/bitcoin-cryptocurrency-fundamentals"`.
     - `count 'og:site_name" content="WorldStreet Mastery Academy"'` → `1`.
     - `grep -o '<meta name="twitter:image" content="[^"]*"'` → the same unsplash URL.
     - canonical (hostless) → `/programs/bitcoin-cryptocurrency-fundamentals`.
  5. **Program without a thumbnail** (`/programs/forex-trading-mastery`):
     - og:image (hostless) starts `…content="/opengraph-image`.
     - `grep -o '<meta property="og:title" content="[^"]*"'` → content starts `Forex Trading Mastery`.
     - canonical (hostless) → `/programs/forex-trading-mastery`.
  6. **Earlier phases unchanged.**
     - `/faculty` **[P5]** canonical (hostless) → `/faculty`.
     - `curl -s "$BASE/verify/WSA-00000000" | strip | count '<meta name="robots" content="noindex'` **[P6]** → `1`.
     - `curl -s -o /dev/null -w '%{http_code}\n' "$BASE/programs/nope"` → `404`.

- [ ] **Step 11: Commit.**

```bash
git add lib/brand.ts app/layout.tsx app/opengraph-image.tsx "app/(marketing)/page.tsx" "app/(marketing)/schools/page.tsx" "app/(marketing)/schools/[slug]/page.tsx" "app/(marketing)/programs/page.tsx" "app/(marketing)/programs/[slug]/page.tsx"
git commit -m "feat(seo): metadataBase, site-wide share card, canonicals on marketing pages, program thumbnails as og:image

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `/sitemap.xml` and `/robots.txt`

**Files:**
- Create: `app/sitemap.ts`
- Create: `app/robots.ts`

**Interfaces:**
- Consumes:
  - `appUrl` (`lib/app-url.ts`) and `SCHOOLS` (`lib/schools.ts`);
  - `fetchBrowseCourses(): Promise<BrowseCourse[]>` (`BrowseCourse.slug`);
  - `fetchFaculty(): Promise<FacultyMember[]>` **[P5]** (`FacultyMember.username`; returns `[]` on error), both from `lib/actions/student.ts`;
  - `facultyHref(username: string): string` **[P5]** (`lib/faculty.ts`).
- Produces: routes `/sitemap.xml` (dynamic) and `/robots.txt` (static).

- [ ] **Step 1: Sitemap.** Create `app/sitemap.ts`:

```ts
import type { MetadataRoute } from "next"
import { appUrl } from "@/lib/app-url"
import { SCHOOLS } from "@/lib/schools"
import { facultyHref } from "@/lib/faculty"
import { fetchBrowseCourses, fetchFaculty } from "@/lib/actions/student"

// Programs and faculty change with publishing and roles — read them per
// request, never freeze them into the build (same rule as the marketing pages).
export const revalidate = 0

/**
 * /sitemap.xml — the indexable public pages: home, the schools, every
 * published program (the set /programs lists) and, while faculty exists,
 * /faculty and each profile. Never /verify (student names, noindex), the
 * signed-in apps, /login, /register or the /courses redirects. No
 * lastModified: BrowseCourse carries no update time, and a guess would be false.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [programs, faculty] = await Promise.all([fetchBrowseCourses(), fetchFaculty()])

  return [
    { url: appUrl("/") },
    { url: appUrl("/schools") },
    ...SCHOOLS.map((school) => ({ url: appUrl(`/schools/${school.slug}`) })),
    { url: appUrl("/programs") },
    ...programs.map((program) => ({ url: appUrl(`/programs/${program.slug}`) })),
    ...(faculty.length > 0
      ? [{ url: appUrl("/faculty") }, ...faculty.map((member) => ({ url: appUrl(facultyHref(member.username)) }))]
      : []),
  ]
}
```

- [ ] **Step 2: Robots.** Create `app/robots.ts`:

```ts
import type { MetadataRoute } from "next"
import { appUrl } from "@/lib/app-url"

/**
 * /robots.txt — crawl the public site; keep the signed-in apps, the API and
 * the local-dev auth pages out. /verify stays crawlable on purpose: its pages
 * say noindex, and a crawler has to fetch a page to read that.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/instructor", "/admin", "/api/", "/login", "/register"],
    },
    sitemap: appUrl("/sitemap.xml"),
  }
}
```

- [ ] **Step 3: Verify — static.** tsc (filtered) prints nothing; `npx eslint app/sitemap.ts app/robots.ts` prints nothing.

- [ ] **Step 4: Verify — runtime.**
  1. **Robots.** `curl -s -o "$P8/robots.txt" -w '%{http_code} %{content_type}\n' "$BASE/robots.txt" && cat "$P8/robots.txt" | hostless` →
     - `200 text/plain…`, then:
       - a user-agent `*` line and `Allow: /`;
       - six `Disallow:` lines: `/dashboard`, `/instructor`, `/admin`, `/api/`, `/login`, `/register`;
       - `Sitemap: /sitemap.xml`.
     - `grep -c 'verify' "$P8/robots.txt"` → `0`.
  2. **Sitemap.**

```bash
curl -s -o "$P8/sitemap.xml" -w '%{http_code} %{content_type}\n' "$BASE/sitemap.xml"
grep -o '<loc>[^<]*</loc>' "$P8/sitemap.xml" | sed -E 's#</?loc>##g' | hostless > "$P8/sitemap-paths.txt"
cat "$P8/sitemap-paths.txt"
```

     → `200 application/xml`, then in order:
     - `/`, `/schools`;
     - `/schools/trading-financial-markets`, `/schools/blockchain-web3`, `/schools/ai-automation`, `/schools/software-app-development`, `/schools/cybersecurity`, `/schools/data-analytics`, `/schools/digital-media-creative`, `/schools/digital-business-remote-careers`;
     - `/programs`, then one `/programs/<slug>` per published program;
     - `/faculty`, `/faculty/sarah_chen` **[P5]**.
  3. **Program count matches `/programs`.** `page /programs | grep -o '[0-9]* programs</p>' | head -1` prints `N programs</p>`; `grep -c '^/programs/' "$P8/sitemap-paths.txt"` → the same `N` (15 on the baseline).
  4. **Every listed page answers 200.** `while read -r p; do printf '%s %s\n' "$(curl -s -o /dev/null -w '%{http_code}' "$BASE$p")" "$p"; done < "$P8/sitemap-paths.txt" | grep -v '^200 '` → prints nothing.
  5. **Exclusions.** `grep -E '^/(verify|dashboard|instructor|admin|login|register|courses|api)' "$P8/sitemap-paths.txt"` → prints nothing.
  6. **Faculty hides when empty [P5].**
     - `node "$H/mockdb.cjs" set-role $SARAH USER`, then `curl -s "$BASE/sitemap.xml" | grep -c '/faculty'` → `0`.
     - `node "$H/mockdb.cjs" restore`, then the same command → ≥ `1`.
     - Report that `restore` ran.
  7. **(controller, optional)** A production build check, only if the dev server can be restarted afterwards. It writes `.next`; the dev server lives in `.next/dev` (`isolatedDevBuild: true`). Override the live keys first:

```bash
MONGODB_URI=mongodb://127.0.0.1:27017/worldstreet-academy RESEND_API_KEY=re_disabled_local CLOUDFLARE_REALTIME_API_KEY=disabled-local OPENAI_API_KEY=disabled-local ABLY_API_KEY=disabled-local npx next build 2>&1 | tee "$P8/build.txt" | grep -E 'opengraph-image|robots.txt|sitemap.xml|Failed|Error'
```

     → `○ /opengraph-image`, `○ /robots.txt`, `ƒ /sitemap.xml`; no `Failed`/`Error`. Otherwise the Coolify build log is the proof (runbook §4).

- [ ] **Step 5: Commit.**

```bash
git add app/sitemap.ts app/robots.ts
git commit -m "feat(seo): sitemap of the public catalogue and faculty; robots keeps the signed-in apps out

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Footer links the hub's legal documents; remove the one-off identity scripts

**Files:**
- Modify: `components/marketing/footer.tsx` (constants after the imports; the Legal column)
- Delete: `link-tmp.cjs`, `link-mobile-identity.cjs`

**Interfaces:**
- Consumes: nothing new. Phase 5 changes this file's `Footer` signature and Academy list **[P5]**; the anchors below avoid both.
- Produces: `LEGAL_LINKS` (module-private). The four hrefs are repeated verbatim in `docs/launch-runbook.md` §4 (Task 4).

- [ ] **Step 1: Constants.** In `components/marketing/footer.tsx` (CRLF) replace `import { BRAND } from "@/lib/brand"` with

```tsx
import { BRAND } from "@/lib/brand"

/**
 * The ecosystem's legal documents, published by the WorldStreet hub
 * (https://www.worldstreetgold.com/legal — "each one applies across all nine
 * platforms on a single login"). The Academy links them and keeps no copy of
 * its own. These are the hub footer's own hrefs, URL-encoded; if the hub
 * renames a file, update it here and in docs/launch-runbook.md §4.
 */
const LEGAL_LINKS = [
  { label: "Terms of Business", href: "https://www.worldstreetgold.com/legal-docs/WS%20Terms%20of%20Business.pdf" },
  { label: "Privacy Policy", href: "https://www.worldstreetgold.com/legal-docs/Privacy%20Policy.pdf" },
  { label: "Cookie Policy", href: "https://www.worldstreetgold.com/legal-docs/WS%20Cookie%20Policy%201.pdf" },
  { label: "All legal documents", href: "https://www.worldstreetgold.com/legal" },
] as const
```

- [ ] **Step 2: Legal column.** Replace

```tsx
            <h4 className="text-sm font-semibold mb-3">Legal</h4>
            <ul className="space-y-2">
              <li>
                <span className="text-sm text-muted-foreground">Terms of Service</span>
              </li>
              <li>
                <span className="text-sm text-muted-foreground">Privacy Policy</span>
              </li>
            </ul>
```

   with

```tsx
            <h4 className="text-sm font-semibold mb-3">Legal</h4>
            <ul className="space-y-2">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
```

- [ ] **Step 3: Verify — footer.**
  1. tsc (filtered) prints nothing; `npx eslint components/marketing/footer.tsx` prints nothing.
  2. `git diff --numstat components/marketing/footer.tsx` → additions under 30, deletions under 10.
  3. `page / | grep -o '<a href="https://www.worldstreetgold.com/legal[^"]*" target="_blank" rel="noopener noreferrer"[^>]*>[^<]*'` → four lines, ending in `>Terms of Business`, `>Privacy Policy`, `>Cookie Policy` and `>All legal documents`.
  4. `page / | count '>Terms of Service<'` → `0`. `page /programs | count 'href="https://www.worldstreetgold.com/legal'` → `4` (footer on every marketing page).
  5. Each link answers:

```bash
for u in $(page / | grep -o 'href="https://www.worldstreetgold.com/legal[^"]*"' | sed 's/^href="//; s/"$//'); do printf '%s %s\n' "$(curl -s -o /dev/null -m 20 -w '%{http_code} %{content_type}' "$u")" "$u"; done
```

     → three `200 application/pdf` lines and one `200 text/html; charset=utf-8` line. A `000` is the local network's Cloudflare block (memory note), not a dead link: report it and don't change the hrefs.
  6. **(controller)** `$B viewport 400x800`, `$B goto $BASE/`, scroll to the footer:
     - `$B js "document.body.scrollWidth + '/' + window.innerWidth"` → `400/400`;
     - save `"$P8/t3-footer-400.png"`.

- [ ] **Step 4: Commit the footer.**

```bash
git add components/marketing/footer.tsx
git commit -m "feat(footer): Legal links to the hub's Terms of Business, Privacy Policy and Cookie Policy — no more dead labels

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5: Remove the scripts** (ruling 8 records what they did): `git rm link-tmp.cjs link-mobile-identity.cjs`.

- [ ] **Step 6: Verify — removal.**
  1. `git ls-files | grep -c '^link-'` → `0`.
  2. `grep -rn 'link-tmp\|link-mobile-identity' --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git .` → only `./docs/mastery-academy-plan.md` (the plan's own cleanup line).
  3. tsc (filtered) still prints nothing.

- [ ] **Step 7: Commit the removal.**

```bash
git commit -m "chore: remove one-off identity-link scripts (hard-coded Clerk ids; lib/auth/sync.ts links by email)

link-tmp.cjs and link-mobile-identity.cjs linked one mobile Clerk id to one
web account and orphaned a placeholder user; the second read MONGODB_URI
from .env.local. Nothing references them.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `docs/launch-runbook.md`, Go patch list §5, plan §0.4 rows

**Files:**
- Create: `docs/launch-runbook.md`
- Modify: `docs/go-patches-phase-3.md` (append §5 at the end)
- Modify: `docs/mastery-academy-plan.md` (§0.4 table: three rows above the `| Never |` row)

**Interfaces:**
- Consumes:
  - Script CLIs: `scripts/mastery-catalogue.mjs [--apply] [--allow-price-change]` (prints `Target database:`, a WARNING box of `current -> derived` prices, MATCH/RENAME/INSERT lines, `matched … / renamed … / inserted … / skipped …`; with `--apply`, `Inserted N` and `Total modifiedCount across matched rows: N`).
  - `scripts/backfill-certificate-ids.mjs [--apply]` **[P6]** (`WOULD SET`/`SET`/`SKIP`/`COLLISION` lines and a `candidates … · (would) set … · no certificate … · course missing … · collisions …` summary; `REFUSING --apply` without an explicit URI).
  - The cron routes `app/api/cron/{course-live,earnings,reminders}/route.ts`.
  - Task 3's four legal hrefs.
  - Copy: "No certificate with this ID" **[P6]**, "Enrollment confirmed" / "Your learning journey starts now." (Phase 3), `Welcome to WorldStreet Mastery Academy` (Phase 4).
- Produces: the three docs above. Task 5's `CLAUDE.md` links the runbook.

- [ ] **Step 1: Runbook.** Create `docs/launch-runbook.md` with exactly:

````markdown
# WorldStreet Mastery Academy — production launch runbook

**For:** the owner. Every step here touches production or another repository, so nobody runs it but you. The repository side (SEO, legal links, docs) is already on the release branch.
**Release:** `mastery/phase-8` — Mastery Academy Phases 0–6 plus the launch work. Phase 7 (Executive services) is not in this release.
**Written:** 2026-09-14. **Specs:** `docs/mastery-academy-plan.md` (§0.4, Phase 8), `docs/mastery-academy-blueprint.md` §17, `docs/go-patches-phase-3.md`.

Do the steps in order. Each ends with a **Check**; don't start the next step until it passes. Keep every log this runbook tells you to `tee` — rollback (§9) needs them — and keep them out of the repository.

## Conventions

- Use Git Bash (or any POSIX shell), in a checkout of the exact commit Coolify deploys.
- Production values never go into files or shell history. Load them once per shell:

  ```bash
  read -rs PROD_URI     # paste the production MongoDB URI, press Enter (nothing is echoed)
  SITE=https://academy.worldstreetgold.com
  ```

- **Always put `MONGODB_URI="$PROD_URI"` in front of a script.** Both database scripts load `.env.local` through dotenv, but dotenv never overrides a variable that is already set, so the explicit value decides the target. `scripts/backfill-certificate-ids.mjs --apply` refuses to run without it.
- Scripts run from your checkout, never the container: the runner image copies only `.next`, `public`, `next.config.ts` and the package files, so there is no `scripts/` folder in it. Run `pnpm install --frozen-lockfile` in the checkout first.
- Tools: MongoDB Database Tools (`mongodump --version`) and `mongosh` (`mongosh --version`).
- Some Cloudflare ranges are blocked on the office network. A `curl` that prints `000` means "couldn't connect from here", not "the site is down" — re-check from another network or an external checker.

## 0. Blockers — settle these first

| # | Item | Who | Blocks launch? |
|---|---|---|---|
| B1 | **Go API patches** R1–R10 in `docs/go-patches-phase-3.md` built and ready to deploy (§2), and that document's §4 questions answered. | Backend owner | **Yes** — unless you decide in writing to launch the web app with every lesson's `minPackageKey` unset (the catalogue script never sets it; set no lesson tiers in the editor until Go ships), accepting that mobile can open Standard lessons and issue certificates to Basic buyers until Go lands. |
| B2 | **Price sign-off (plan D3).** The catalogue `--apply` (§6) sets each spec-ladder program's course price from its packages. The script's own header says Forex and Crypto go 199 → 49 (their Basic package) and AI & AI Automation goes 99 → 199. The §6 dry run prints the real `current -> derived` lines; product signs those lines. | Product | **Yes** |
| B3 | **Wallet env.** `WALLET_BASE_URL` and `WALLET_SERVICE_TOKEN` set in Coolify (§3). Without them every purchase fails closed. | You | **Yes** |
| B4 | **Legal coverage.** The Academy footer links the hub's Terms of Business, Privacy Policy and Cookie Policy (`https://www.worldstreetgold.com/legal` says each applies across every platform on one login). Ask the documents' owner to confirm they cover what the Academy does: public certificate pages (`/verify/<id>`) showing a student's name, program, school, instructor and completion date; public faculty profiles; homepage testimonials with photo, name, country and program; the OpenAI-powered voice assistant; the Google Translate widget; RealtimeKit classes and calls; email through Resend; files on Cloudflare R2. | You + legal | Your call |
| B5 | **QA account and program.** A real WorldStreet account with enough wallet balance for the §8 purchase, and a program with at least one published lesson. The plan's journey is Forex Standard; if Forex has no published lessons yet, use a program that does and note it in the run log. | You | **Yes** for §8 |

## 1. Backup

```bash
mongodump --uri="$PROD_URI" --gzip --archive="academy-prelaunch-$(date +%Y%m%d-%H%M).archive.gz"
mongosh "$PROD_URI" --quiet --eval 'print("db " + db.getName()); print("published " + db.courses.countDocuments({ status: "published" })); print("with school " + db.courses.countDocuments({ school: { $type: "string" } })); print("orphans " + db.enrollments.countDocuments({ course: { $nin: db.courses.distinct("_id") } }))' | tee "counts-before-$(date +%Y%m%d-%H%M).log"
```

**Check:** `mongodump` prints `done dumping <db>.courses`, `.enrollments`, `.orders` and `.users`; `ls -lh academy-prelaunch-*.gz` shows a non-empty archive; the counts log has four lines. If your MongoDB host takes snapshots, take one too and note its id.

## 2. Go API — deploy before the web app

Every Go rule reads a missing field as full access, so the patches are safe against today's data. They must be live before the web app sells packages, or mobile opens what a package doesn't include.

1. Deploy the Go release with R1–R10 from `docs/go-patches-phase-3.md` — including R10's category change: once §6 runs, `courses.category` holds school labels, so a mobile filter on the old strings must already use `courses.school`.
2. **Check:** in the mobile app, a legacy enrollment still opens all of its lessons and the course list loads. The full matrix runs in §8, once the catalogue exists.

## 3. Coolify environment (academy app)

Coolify → the academy application → Environment Variables. Names only here; values live in Coolify.

| Name | Needed | Read at | Notes |
|---|---|---|---|
| `WALLET_BASE_URL`, `WALLET_SERVICE_TOKEN` | Yes | Runtime | Missing either → purchases fail closed and `/api/cron/earnings` answers `503 wallet_disabled`. |
| `SITE_URL` | Yes | Runtime | `https://academy.worldstreetgold.com`, no trailing slash. `lib/app-url.ts` builds email links, canonical URLs, the sitemap, share-card URLs and certificate verify URLs from it. |
| `NEXT_PUBLIC_APP_URL` | Optional | Runtime (server) | If set, it wins over `SITE_URL` — make it the same public origin. A localhost value is ignored in production. |
| `NEXT_PUBLIC_COMMUNITY_URL` | Optional | **Build** | The dashboard's Community tile reads it in the browser, so Next bakes it in during the build: tick "Build Variable" and redeploy after any change. Unset → the tile is hidden. |
| `CRON_SECRET` | Yes | Runtime | A long random value (`openssl rand -hex 32`). The three scheduled tasks (§5) send it as a bearer token. |

Also confirm these existing names are present (don't change working values): `MONGODB_URI`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_WALLET_FUNDING_URL`, `NEXT_PUBLIC_WALLET_WITHDRAW_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `ABLY_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_REALTIME_ORG_ID`, `CLOUDFLARE_REALTIME_API_KEY`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_RESOURCES_BUCKET_NAME` (that bucket must have no public access), `R2_PUBLIC_URL`, `OPENAI_API_KEY`.

**Check:** after §4, `curl -s -o /dev/null -w "%{http_code}\n" -X POST "$SITE/api/cron/course-live"` prints `401` (route live, secret required).

## 4. Deploy the web app

1. Confirm Coolify → academy app → Source deploys `main`.
2. Push the release branch and open the PR:

   ```bash
   git push -u origin mastery/phase-8
   gh pr create --base main --head mastery/phase-8 --title "WorldStreet Mastery Academy — Phases 0–6 and launch" --body "Release steps: docs/launch-runbook.md"
   ```

3. Merge after review; Coolify builds and deploys.

**Check — build log:** the route table lists `○ /opengraph-image`, `○ /robots.txt` and `ƒ /sitemap.xml`; the first minutes of runtime logs show no `E11000` and no `Index build failed`.

**Check — pages:**

```bash
for p in / /schools /schools/trading-financial-markets /programs /faculty /robots.txt /sitemap.xml /opengraph-image; do
  printf "%-40s " "$p"; curl -s -o /dev/null -w "%{http_code} %{content_type}\n" "$SITE$p"
done
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "$SITE/courses"
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "$SITE/dashboard"
curl -s "$SITE/verify/WSA-00000000" | grep -o "No certificate with this ID" | head -1
curl -s "$SITE/robots.txt"
```

Expect: `200` for every path (`text/plain` for robots, `application/xml` for the sitemap, `image/png` for the card; `/faculty` is 200 even with no faculty yet); `308 https://academy.worldstreetgold.com/programs`; `307 https://www.worldstreetgold.com/login?redirect=…`; the "No certificate" line; a robots file ending `Sitemap: https://academy.worldstreetgold.com/sitemap.xml`.

**Check — footer legal links** (all `200`; if one isn't, fix `components/marketing/footer.tsx` before launch — never ship a dead link):

```bash
for u in "https://www.worldstreetgold.com/legal-docs/WS%20Terms%20of%20Business.pdf" "https://www.worldstreetgold.com/legal-docs/Privacy%20Policy.pdf" "https://www.worldstreetgold.com/legal-docs/WS%20Cookie%20Policy%201.pdf" "https://www.worldstreetgold.com/legal"; do
  printf "%s %s\n" "$(curl -s -o /dev/null -w "%{http_code}" "$u")" "$u"
done
```

**Check — certificate index (Phase 6):** Mongoose builds it the first time the app touches enrollments after the deploy. Sign in and open `/dashboard`, then:

```bash
mongosh "$PROD_URI" --quiet --eval 'printjson(db.enrollments.getIndexes().filter(i => i.name === "certificateId_1"))'
```

Expect one index with `unique: true` and `partialFilterExpression: { certificateId: { '$type': 'string' } }`. If it is still missing after 10 minutes, create exactly that index:

```bash
mongosh "$PROD_URI" --quiet --eval 'db.enrollments.createIndex({ certificateId: 1 }, { unique: true, partialFilterExpression: { certificateId: { $type: "string" } } })'
```

Never create it `sparse`: new enrollments store `certificateId: null`, a sparse unique index still indexes that null, and the second new enrollment — a purchase — would fail.

## 5. Scheduled tasks (Coolify)

All three routes under `app/api/cron/` are `POST`, require `Authorization: Bearer $CRON_SECRET`, and are idempotent.

| Task | Path | Cron | What it does |
|---|---|---|---|
| academy-course-live | `/api/cron/course-live` | `*/5 * * * *` | Emails and notifies pre-enrolled students when a scheduled course goes live; stamps `liveNotifiedAt`. Phase 3 recorded it as not yet scheduled in production. |
| academy-reminders | `/api/cron/reminders` | `*/10 * * * *` | T-24h and T-1h reminders for scheduled classes (students whose package includes live classes) and interviews. |
| academy-earnings | `/api/cron/earnings` | `*/15 * * * *` | Clears matured instructor earnings to the wallet and applies refund clawbacks. |

Coolify → academy app → Scheduled Tasks → Add, container = the academy app. The runner image (`node:22-alpine`) has no `curl`, so call the app from inside its own container with Node (swap the path for each task):

```sh
node -e 'fetch("http://127.0.0.1:3000/api/cron/course-live",{method:"POST",headers:{Authorization:"Bearer "+process.env.CRON_SECRET}}).then(async r=>{console.log(r.status,await r.text());if(!r.ok)process.exit(1)}).catch(e=>{console.error(e);process.exit(1)})'
```

If reminders or earnings tasks already exist with a `curl` command, open their last run log: `curl: not found` means they have never run — replace them with the command above. If the in-container call returns anything but JSON, use `https://academy.worldstreetgold.com/api/cron/<name>` as the URL in the same command.

**Check:** run each task once ("Run now", or wait one interval). Its log shows `200 {"ok":true,…}`. `401` → `CRON_SECRET` isn't in the container env; `503 {"ok":false,"error":"wallet_disabled"}` (earnings) → `WALLET_*` missing.

## 6. Production catalogue — `scripts/mastery-catalogue.mjs`

What it does (its header): upserts the 12 programs by exact title (scoped to the catalogue owner, with a printed warning on any other match) — sets title, school, category and packages; sets copy only for Forex, Crypto and AI & AI Automation; derives those three programs' course price from their packages; renames "Content Creation / Video Editing Mastery" → "Content Creation Mastery" and "Artificial Intelligence & AI Automation" → "AI & AI Automation". **Not all new inserts are drafts:** each of the 12 program literals carries its own `newInsertDraft` flag (`status = program.newInsertDraft ? "draft" : "published"` — read the script, not this paraphrase, for which); on the current script only 2 of the 12 are flagged `true`, so a title that doesn't already exist in production and isn't one of those 2 goes live as `published` the moment `--apply` runs. Check each `INSERT` line in the dry run against this before applying. It never deletes or archives, aborts on slug drift (`ABORT: slug … exists`), and refuses a price change without `--allow-price-change`.

Before: §2 (Go) and §4 (package-aware checkout) are live, and B2 is signed.

```bash
git checkout <the release commit on main> && pnpm install --frozen-lockfile
MONGODB_URI="$PROD_URI" node scripts/mastery-catalogue.mjs | tee "catalogue-dryrun-$(date +%Y%m%d-%H%M).log"
```

**Review the dry run:**
- `Target database:` is the production database (same name as `db` in §1's counts log).
- The WARNING box's `current -> derived` lines are exactly what product signed (B2).
- Every `MATCH`/`RENAME` line's `_id`, status, owner email and price is the row you expect. No `WARN adopted row owned by`, no `WARN duplicate title`, no `ABORT`.
- The summary reads `matched M / renamed R / inserted I / skipped 0`, with no `WARN: planned actions … do not add up`.

**Apply** (`--allow-price-change` is needed only when the dry run shows a price change; without it the run exits 1 before writing):

```bash
MONGODB_URI="$PROD_URI" node scripts/mastery-catalogue.mjs --apply --allow-price-change | tee "catalogue-apply-$(date +%Y%m%d-%H%M).log"
```

**Check:**

```bash
MONGODB_URI="$PROD_URI" node scripts/mastery-catalogue.mjs --apply | tail -3     # idempotent re-run
mongosh "$PROD_URI" --quiet --eval 'print("published " + db.courses.countDocuments({ status: "published" })); print("with school " + db.courses.countDocuments({ school: { $type: "string" } })); print("orphans " + db.enrollments.countDocuments({ course: { $nin: db.courses.distinct("_id") } }))'
curl -s "$SITE/schools/trading-financial-markets" | grep -o 'href="/programs/[^"]*"' | sort -u
```

- The re-run prints `Inserted 0` and `Total modifiedCount across matched rows: 0`.
- `with school` is at least 12, and `orphans` equals §1's value (the script can't orphan anything).
- The school page links the Forex and Crypto programs. `curl -s "$SITE/programs/<forex slug>" | grep -o 'Forex Foundation\|Forex Mastery\|Private Forex Mentorship' | sort -u` prints all three package names.
- A student with an old enrollment still sees it on `/dashboard/my-courses`.

## 7. Certificate IDs — `scripts/backfill-certificate-ids.mjs`

What it does: stores the legacy ID certificates have always printed (`WSA-<last 8 characters of the enrollment _id, uppercased>`) on completed, certificate-entitled enrollments that have none, so PDFs already downloaded verify at `/verify/<id>`. It skips Basic completions, reports collisions and never overwrites. `--apply` refuses without an explicit `MONGODB_URI`.

Before: §4's index check passed.

```bash
MONGODB_URI="$PROD_URI" node scripts/backfill-certificate-ids.mjs | tee "certids-dryrun-$(date +%Y%m%d-%H%M).log"
```

**Review:**
- the `WOULD SET <enrollment id> → WSA-…` lines;
- each `COLLISION` line: two enrollments share their last 8 id characters, so the skipped one's printed ID belongs to the other. Decide by hand which student keeps it, and don't hand-write a duplicate;
- the summary `candidates … · would set … · no certificate … · course missing … · collisions …`.

```bash
MONGODB_URI="$PROD_URI" node scripts/backfill-certificate-ids.mjs --apply | tee "certids-apply-$(date +%Y%m%d-%H%M).log"
```

**Check:**
- Re-run the same `--apply`. The summary shows `set 0`; only `SKIP`/`COLLISION` lines remain.
- Take one `SET … → WSA-XXXXXXXX` from the apply log. `curl -s "$SITE/verify/WSA-XXXXXXXX" | grep -o 'Valid' | head -1` prints `Valid`, and the page shows that student's name and program.

## 8. §17 journey QA — production, real wallet-funded account

Use a private browser window, signed out of worldstreetgold.com. Keep a run log: date, account email, program and package, the order reference from `/admin/payments`, and screenshots of steps 7, 11 and 12.

| # | §17 step | Do | Pass when |
|---|---|---|---|
| 1 | Homepage | Open `https://academy.worldstreetgold.com/` | Hero "Learn Skills. Build Value. Own Your Future."; no browser console errors. |
| 2 | Explore Our Schools | "Explore programs" | `/schools`: eight school cards with program counts. |
| 3 | Select School | Trading & Financial Markets | `/schools/trading-financial-markets` lists Forex and Crypto. |
| 4 | View Programs → Select Program | "View program" on Forex (or your B5 program) | `/programs/<slug>` opens. |
| 5 | Program Details → View Curriculum | Scroll | Hero, "What you will learn", the instructor block (its name links to `/faculty/<username>`), FAQ. |
| 6 | Choose Package → View Price | The package ladder | Basic, Standard and Executive cards at the prices signed in B2. |
| 7 | ENROL NOW | Standard's enrol button | Signed out → `www.worldstreetgold.com/login?redirect=https://academy.worldstreetgold.com/dashboard/checkout?courseId=…&package=standard`. |
| 8 | Create/Login to WorldStreet Account | Sign in (or register) the QA account | Back on the Academy checkout with `package=standard` — the satellite return works on the real origin (plan Risk 6). |
| 9 | Checkout | Review, then pay | Package summary (name, tagline, price), wallet balance, package switcher. |
| 10 | Payment Successful | — | The wallet is debited the Standard price exactly once (hub wallet transactions). |
| 11 | Enrollment Confirmed | Success page | "Enrollment confirmed" and "Your learning journey starts now." with the package name; the confirmation email arrives and names the package. |
| 12 | Student Dashboard | "Go to dashboard" | `/dashboard?welcome=1` shows "Welcome to WorldStreet Mastery Academy" and the gold Continue learning button. |
| 13 | START LEARNING | Continue learning | The first lesson plays; lessons the Standard package opens play; an Executive-only lesson, if any, shows the lock card. |

Then:
- `/admin/payments` shows the order with package `standard` and the amount; `/admin/enrollments` shows the enrollment.
- Reloading checkout for the same package doesn't charge again.
- Share previews: paste `$SITE/` and the program URL into a link-preview debugger. The homepage shows the brand card; a program with a thumbnail shows its thumbnail.
- `/faculty` and one profile render; the footer's legal links open; `/verify/<an ID from §7>` shows Valid.
- **Mobile (Go, `docs/go-patches-phase-3.md` §3 matrix):**
  - With the QA Standard enrollment, Standard lessons open, an Executive-only lesson is locked, and the final exam can start.
  - In `/admin/enrollments`, change that enrollment's package to Basic. The change is audited and moves no money. Mobile now locks Standard lessons, refuses the final exam and shows no certificate.
  - Change it back to Standard, and confirm a legacy enrollment still opens everything.

## 9. Rollback

**Code:** Coolify → academy app → Deployments → the last pre-launch deployment → Redeploy. Alternatively revert the merge on `main` (`git revert -m 1 <merge sha> && git push origin main`) and let Coolify rebuild.

**Data** is additive, except the catalogue's prices:
- **If §6 ran and the web app goes back to pre-package code, restore the course prices first.** The old checkout charges the course price for full access, and §6 lowered Forex and Crypto to their Basic price. For each program in the dry-run log's WARNING box, take its `_id` from its `MATCH` line and its old price from the box, then:

  ```bash
  mongosh "$PROD_URI" --quiet --eval 'printjson(db.courses.updateOne({ _id: ObjectId("<_id>") }, { $set: { price: <old price> } }))'
  ```

  Expect `modifiedCount: 1` for each.
- Everything else §6 wrote (school, packages, category label, the two renamed titles, draft inserts) is ignored or cosmetic under old code. Leave it.
- `certificateId` values and their partial index are ignored by old code, and enrollments it creates omit the field, which the partial index doesn't cover. Leave them.
- **Go:** rolling Go back reopens mobile tier bypass for package enrollments. Roll Go back only together with the web app, after restoring prices.
- **Last resort**, and only by your decision: restore one collection from §1's archive with `mongorestore --uri="$PROD_URI" --gzip --archive=<file> --nsInclude="<db>.courses" --drop`. It discards every change to that collection since the backup (enrolment counts, ratings…).

## 10. Other repositories (non-blocking)

- **`../design-system`:** plan D1 asked for the lockup eyebrow "ACADEMY" → "MASTERY ACADEMY" in `04-components`. On 2026-09-14 no literal "ACADEMY" appears in `design-system/*.md`, and the code lockup reads `BRAND.eyebrow`. Confirm nothing else needs changing.
- **The hub's legal page:** `https://www.worldstreetgold.com/legal` and `/legal-docs/*.pdf` are live, but neither is in the local `../dashboard-revamp` checkout (`main`, `dev/self-custody-preview`). Ask the hub owner where that page is deployed from, so a hub redeploy can't remove the files the Academy footer links to.
- **Mobile app:** certificate screens print `certificateId` with the legacy fallback (Go doc R9), and course filters use `school` (R10).

## 11. Post-launch cleanup — decide

| Item | What happened | Options |
|---|---|---|
| Two real RealtimeKit rooms | On 2026-09-14 a local Phase 4 check (`pnpm dev:mock` had inherited `.env.local`'s `CLOUDFLARE_REALTIME_*`) created "Meeting: Week 1 live class" and "Meeting: Live now" in the RealtimeKit organization those credentials belong to. The local records were removed; the remote rooms remain. | Leave them, or end them from that organization's RealtimeKit dashboard. The app's own `endMeeting` (`lib/realtime.ts`) sends `DELETE https://api.dyte.io/v2/meetings/<id>` with Basic auth `ORG_ID:API_KEY` but swallows errors, so that call's effect is unverified. |
| Possible Resend emails | Resend was live during Phase 3 and Phase 4 Tasks 1–3 local checks (2026-09-14). Enrollment-confirmation and meeting emails may have gone to the mock addresses `student@`, `instructor@` and `admin@worldstreet.academy`. | Check Resend → Emails for those recipients on that date. Sent mail can't be recalled; if `worldstreet.academy` has real inboxes, tell their owner. |
| The §8 test purchase | A real debit on the QA account. | Refund it from `/admin/payments` (re-credits the wallet, revokes access, reverses the instructor's pending earning), or keep the enrollment. |
| Identity scripts in git history | `link-tmp.cjs` and `link-mobile-identity.cjs` were removed in Phase 8 but stay in history with two Clerk user ids (identifiers, not credentials). | Leave (recommended), or rewrite history. |
| `scripts/_swap-catalogue.mjs` | Superseded by `mastery-catalogue.mjs`. If run with `--apply` it archives courses and inserts the old 10-program catalogue. | Delete it, or keep it with its history. |
| Certificate IDs for mobile completions | Go doesn't stamp `certificateId` yet (Go doc R9). | Re-run §7 after mobile completions happen, until Go stamps IDs. |
| Product debt | School intros, program curricula, thumbnails and instructor bios (Phase 2); the Academy signatory name and signature file (D9); a surface for §13's "LEARN. COMPLETE. GET RECOGNIZED." (Phase 6); real RealtimeKit scheduling run on staging (Phase 4). | Schedule with product. |
````

- [ ] **Step 2: Go patch list §5.** Append to the end of `docs/go-patches-phase-3.md` (after item 4 of "## 4. Questions for the backend owner"):

```markdown

---

## 5. Added by Phases 5–6 (ship in the same Go release)

**R8 — Faculty profile fields (Phase 5).** New, additive fields on `users`:

| Field | Type | Meaning |
|---|---|---|
| `country` (top level) | ISO 3166-1 alpha-2 string \| `null` | Shown on faculty profiles and homepage testimonials. |
| `instructorProfile.specialization` | string \| `null` | Area of specialization (public faculty card). |
| `instructorProfile.experience` | string \| `null` | Professional experience (≤ 2,000 characters). |
| `instructorProfile.credentials` | string[] | Credentials and achievements (≤ 10). |
| `instructorProfile.featured` | bool | Admin-curated: listed first on `/faculty`. |

If Go ever writes `instructorProfile`, write dotted paths (`instructorProfile.headline`) or carry these four fields: a whole-object `$set: { instructorProfile: {...} }` drops them.

**R9 — Certificate IDs (Phase 6).** `enrollments.certificateId: string | null`, under a **partial unique** index `{ certificateId: 1 }` with `partialFilterExpression: { certificateId: { $type: "string" } }`.
- **Never write `certificateId: ""`.** Every string is indexed, so a second empty string fails with E11000 and that whole write fails. Omit the field or write `null`.
- The web stamps an ID when an enrollment becomes `completed` and its package includes the certificate (R1, R4): `WSA-` + 8 Crockford base32 symbols (`0-9A-Z` without I, L, O, U) from 5 random bytes, retried once on a duplicate. An enrollment that was already completed without an ID gets its legacy value instead. Go completions don't stamp one yet; until they do, those certificates become verifiable when the web backfill (`scripts/backfill-certificate-ids.mjs`) is re-run.
- Rendering a certificate on mobile: print `certificateId`; when it is `null`, print the legacy value `WSA-<last 8 characters of the enrollment _id, uppercased>` — what certificates have always printed.
- Public check: `https://academy.worldstreetgold.com/verify/<certificateId>` answers only for a `completed`, certificate-entitled enrollment, so a refund or an admin status change away from `completed` takes the certificate off that page.

**R10 — Other additive changes.** `reviews.featured: bool` (web-only homepage curation; Go may ignore it). Once `scripts/mastery-catalogue.mjs --apply` runs, `courses.category` holds the school's short label ("Trading & Financial Markets", …) on every catalogue row: a mobile filter or grouping keyed on the old strings (Cryptocurrency, Trading, DeFi, …) must switch to `courses.school` in the same release.
```

- [ ] **Step 3: Plan §0.4 rows.** In `docs/mastery-academy-plan.md` replace

```markdown
| Never | all | Non-additive schema changes; new `role` values; changed Ably payload shapes. |
```

   with

```markdown
| Phase 5 → 8 | Go (`worldstreet-academy/backend`) | `users.country` and `users.instructorProfile.{specialization, experience, credentials, featured}` are additive; if Go writes `instructorProfile` it writes dotted paths or carries them (Phase 5 ruling 22; Go doc R8). |
| Phase 6 → 8 | Go / mobile | Never write `enrollments.certificateId: ""` (partial unique index); Go completions don't stamp an ID until patched — a backfill re-run covers them; mobile certificates print `certificateId`, else `WSA-<last 8 of _id>` (Go doc R9). `reviews.featured` is additive; category vocabulary per R10. |
| Phase 8 | Owner | Production order — Go, env, deploy, crons, catalogue, certificate backfill, §17 QA, rollback: `docs/launch-runbook.md`. |
| Never | all | Non-additive schema changes; new `role` values; changed Ably payload shapes. |
```

- [ ] **Step 4: Verify.**
  1. **Cron paths match the disk.** `for r in $(grep -o '/api/cron/[a-z-]*' docs/launch-runbook.md | sort -u); do test -f "app${r}/route.ts" && echo "ok $r" || echo "MISSING $r"; done` → three `ok` lines. `find app/api/cron -name route.ts | wc -l` → `3`.
  2. **Script flags exist.**
     - `grep -c -- '--allow-price-change' scripts/mastery-catalogue.mjs` → ≥ `1`.
     - `grep -c 'Total modifiedCount across matched rows' scripts/mastery-catalogue.mjs` → `1`.
     - `grep -c 'REFUSING --apply' scripts/backfill-certificate-ids.mjs` **[P6]** → ≥ `1`.
  3. **Env names are real.** `for v in WALLET_BASE_URL WALLET_SERVICE_TOKEN SITE_URL NEXT_PUBLIC_APP_URL NEXT_PUBLIC_COMMUNITY_URL CRON_SECRET RESEND_API_KEY EMAIL_FROM ABLY_API_KEY CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_REALTIME_ORG_ID CLOUDFLARE_REALTIME_API_KEY R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET_NAME R2_RESOURCES_BUCKET_NAME R2_PUBLIC_URL OPENAI_API_KEY MONGODB_URI NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY NEXT_PUBLIC_WALLET_FUNDING_URL NEXT_PUBLIC_WALLET_WITHDRAW_URL; do grep -rq "process.env.$v" app lib components middleware.ts && echo "ok $v" || echo "UNUSED $v"; done | grep -v '^ok'` → prints nothing. (`CLERK_SECRET_KEY` is read by the Clerk SDK, not app code.)
  4. **Legal hrefs match the footer.** `diff <(grep -o 'https://www.worldstreetgold.com/legal[^" ]*' components/marketing/footer.tsx | sort -u) <(grep -o 'https://www.worldstreetgold.com/legal[^" ]*' docs/launch-runbook.md | tr -d '`' | sort -u)` → prints nothing. (`[^" ]*` on both sides, so the footer's doc-comment mention of `/legal` collapses into the `/legal` href.)
  5. **No secrets or ids.** `grep -nE 'mongodb(\+srv)?://[^<"$ ]+@|re_[A-Za-z0-9]{12,}|sk-[A-Za-z0-9]{12,}|pk_live_|user_3' docs/launch-runbook.md docs/go-patches-phase-3.md` → prints nothing.
  6. **Structure.**
     - `grep -c '^## ' docs/launch-runbook.md` → `13` (Conventions + §0–§11).
     - `grep -n '^## 5\. Added by Phases 5–6' docs/go-patches-phase-3.md` → one line.
     - `grep -c 'launch-runbook' docs/mastery-academy-plan.md` → `1`.
     - `grep -c '^| Never | all |' docs/mastery-academy-plan.md` → `1`.

- [ ] **Step 5: Commit.**

```bash
git add docs/launch-runbook.md docs/go-patches-phase-3.md docs/mastery-academy-plan.md
git commit -m "docs: launch runbook (env, crons, deploy order, catalogue, certificate backfill, §17 QA, rollback); Go patch list R8–R10; §0.4 rows

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `CLAUDE.md`, `context.md` and the `dev:mock` header describe the app as it is

**Files:**
- Modify: `CLAUDE.md` (Commands block; the paragraph after it; scripts paragraph; route groups; route handlers; one inserted paragraph above **Realtime.**; Repo Docs list)
- Modify: `context.md` (append a dated entry; CRLF)
- Modify: `scripts/dev-mock.mjs` (header comment only)

**Interfaces:**
- Consumes (names checked in Step 5):
  - `lib/brand.ts` `BRAND`, `SITE_DESCRIPTION` (Task 1);
  - `lib/schools.ts` `SCHOOLS`, `SCHOOL_BY_SLUG`, `isSchoolSlug`;
  - `lib/entitlements.ts` `packageFor`, `entitlementsFor`, `canAccessLesson`, `effectiveLessonTier`, `pricingFromPackages`;
  - `lib/course-access.ts` `getCourseAccess`, `lockedLessonIds`, `openPublishedLessonIds`, `instructorQaRefusal`;
  - `lib/faculty.ts` `facultyHref`, `safeWebUrl` **[P5]**;
  - `lib/countries.ts` `countryName` **[P5]**;
  - `lib/certificate-id.ts` `saveWithCertificateId` **[P6]**;
  - `docs/launch-runbook.md` (Task 4).
- Produces: docs only.

- [ ] **Step 1: `CLAUDE.md` — commands and the dev:mock warning.**
  1. Replace `pnpm dev                 # dev server :3000` with

```bash
pnpm dev                 # dev server :3000
pnpm dev:mock            # local Mongo + mock Clerk (scripts/dev-mock.mjs) — NOT credential-free, see below
```

  2. Replace

```markdown
pnpm 10.32.0 is enforced via `packageManager`. **No test runner is configured** — verification is manual/E2E, so there is no single-test command; do not invent one.
```

   with

````markdown
pnpm 10.32.0 is enforced via `packageManager`. **No test runner is configured** — verification is manual/E2E, so there is no single-test command; do not invent one.

**`pnpm dev:mock` is not credential-free.** `scripts/dev-mock.mjs` replaces only `MONGODB_URI` (a local mongod) and Clerk (`mocks/clerk`). `next dev` still loads `.env.local`, so its live `RESEND_API_KEY`, `CLOUDFLARE_REALTIME_*`, `ABLY_API_KEY`, `OPENAI_API_KEY`, `R2_*` and any set `WALLET_*` are used: local checks can send real email and create real RealtimeKit rooms (two were, 2026-09-14). Next never overrides a variable already in the environment, so launch it with placeholders:

```bash
RESEND_API_KEY=re_disabled_local CLOUDFLARE_REALTIME_API_KEY=disabled-local OPENAI_API_KEY=disabled-local ABLY_API_KEY=disabled-local R2_SECRET_ACCESS_KEY=disabled-local WALLET_SERVICE_TOKEN=disabled-local pnpm dev:mock
```
````

- [ ] **Step 2: `CLAUDE.md` — scripts.** Replace

```markdown
`scripts/*.{ts,mjs}` are one-off maintenance jobs run directly (`npx tsx scripts/backfill-avatars.ts`, `node scripts/grant-admin.mjs`). They load `.env.local`. Several mutate production data (`reconcile-orders`, `migrate-exam-indexes`, `grandfather-instructors`) — read before running.
```

   with

```markdown
`scripts/*.{ts,mjs}` are one-off maintenance jobs run directly (`npx tsx scripts/backfill-avatars.ts`, `node scripts/grant-admin.mjs`). They load `.env.local`, **whose `MONGODB_URI` is production** — without `MONGODB_URI=<uri>` in front, a script targets production. Several mutate production data (`reconcile-orders`, `migrate-exam-indexes`, `grandfather-instructors`) — read before running. Two run once at launch (`docs/launch-runbook.md` §6–§7):
- `mastery-catalogue.mjs` — upserts the 12 programs by title (school, category, packages; derives Forex/Crypto/AI prices from their ladders). Dry run by default; `--apply` writes; changing an existing course's price also needs `--allow-price-change`. Never deletes.
- `backfill-certificate-ids.mjs` — stores legacy `WSA-<last 8 of _id>` IDs on completed, certificate-entitled enrollments. Dry run by default; `--apply` refuses unless `MONGODB_URI` is passed on the command line.

`_swap-catalogue.mjs` is superseded: with `--apply` it archives courses and installs the old 10-program catalogue. Never run it.
```

- [ ] **Step 3: `CLAUDE.md` — routes, handlers, modules.**
  1. Replace

```markdown
**Route groups** — `(marketing)` public · `(auth)` local-dev sign-in only · `(platform)` `/dashboard/*` · `(instructor)` `/instructor/*` · `(admin)` `/admin/*`.
```

   with

```markdown
**Route groups** — `(marketing)` public · `(auth)` local-dev sign-in only · `(platform)` `/dashboard/*` · `(instructor)` `/instructor/*` · `(admin)` `/admin/*`.

**Public URLs** — `/` · `/schools`, `/schools/[slug]` · `/programs`, `/programs/[slug]` (public program URLs are always `/programs/<Course.slug>`; `/courses` and `/courses/[id]` only 308 there; signed-in course pages stay `/dashboard/courses/<id>`) · `/faculty`, `/faculty/[username]` · `/verify/[certificateId]` (public, noindex). SEO is file-convention: `app/sitemap.ts`, `app/robots.ts`, `app/opengraph-image.tsx`, with `metadataBase` and canonicals from `lib/app-url.ts` (`APP_URL`/`appUrl` — the only source of absolute URLs, also for emails). Legal documents are the hub's (`https://www.worldstreetgold.com/legal`), linked from the marketing footer; this app keeps no terms or privacy copy.
```

  2. Replace

```markdown
Only four route handlers exist, for what actions can't do: `/api/calls/end` (sendBeacon), `/api/messages/poll`, and `/api/cron/{earnings,reminders}` (POST, `Authorization: Bearer $CRON_SECRET`, idempotent, run as Coolify scheduled tasks).
```

   with

```markdown
Only five route handlers exist, for what actions can't do: `/api/calls/end` (sendBeacon), `/api/messages/poll`, and `/api/cron/{course-live,earnings,reminders}` (POST, `Authorization: Bearer $CRON_SECRET`, idempotent, run as Coolify scheduled tasks — schedules and the in-container command are in `docs/launch-runbook.md` §5).
```

  3. Replace `**Realtime.** `lib/call-events.ts` is an **Ably** bus` (the start of the Realtime paragraph) with

```markdown
**Catalogue, packages and trust (Mastery Academy — `docs/mastery-academy-plan.md`).** Each fact has one home; import it, never re-derive it inline:
- `lib/brand.ts` — `BRAND` (name, lockup wordmark/eyebrow, tagline, sender, certificate prefix, dormant signatory) and `SITE_DESCRIPTION`.
- `lib/schools.ts` — the 8 schools (`SCHOOLS`, `SCHOOL_BY_SLUG`, `isSchoolSlug`). Program membership is `Course.school`; `Course.category` is the school's short label.
- `lib/entitlements.ts` — pure package rules: `packageFor`, `entitlementsFor` (a null `packageKey` is full access, grandfathered), `canAccessLesson`, `effectiveLessonTier`, `pricingFromPackages`. `Course.price` follows the cheapest enabled package.
- `lib/course-access.ts` — the server-only loader over those rules (`getCourseAccess`, `lockedLessonIds`, `openPublishedLessonIds`, `instructorQaRefusal`). Lesson, exam, certificate, live-class and Q&A gates go through it or `entitlementsFor`.
- `lib/faculty.ts` — pure faculty rules (profile schema, `$set` builder, `facultyHref`, `safeWebUrl`). Faculty = INSTRUCTOR/ADMIN with ≥ 1 published course, queried only in the FACULTY section of `lib/actions/student.ts`.
- `lib/countries.ts` — the ISO 3166-1 alpha-2 list and `countryName` (`User.country`).
- `lib/certificate-id.ts` — certificate ID rules; completions save through `saveWithCertificateId`, and `/verify/[certificateId]` reads `Enrollment.certificateId`.

Every Mastery schema change is additive: the Go API reads the same collections, and its patch list is `docs/go-patches-phase-3.md`.

**Realtime.** `lib/call-events.ts` is an **Ably** bus
```

   (The replaced text is the paragraph's opening words; the rest of that paragraph continues unchanged after them.)

- [ ] **Step 4: `CLAUDE.md` — doc index, `context.md`, `dev-mock.mjs`.**
  1. In `CLAUDE.md` replace

```markdown
- `context.md` — running UI decision log, partially stale.
```

   with

```markdown
- `context.md` — running UI decision log, partially stale.
- `docs/mastery-academy-plan.md` + `docs/plans/mastery-phase-*.md` — the Mastery rebuild: the status board and decisions, and each phase's task plan.
- `docs/go-patches-phase-3.md` — the Go API patch list for Phases 3–6 (the file name predates §5).
- `docs/launch-runbook.md` — production launch steps (env, crons, deploy order, scripts, §17 QA, rollback); owner-executed.
```

  2. Append to the end of `context.md` (CRLF — keep it), after its last line `- Components with hooks (Badge uses `useRender`) are client components internally`:

```markdown

## Decision Log

### 2026-09-14 — Launch prep (Mastery Academy Phase 8)
- **SEO:** `app/sitemap.ts` (home, schools, published programs, faculty; never `/verify` or the signed-in apps), `app/robots.ts` (disallows `/dashboard`, `/instructor`, `/admin`, `/api/`, `/login`, `/register`; `/verify` stays crawlable so its noindex is read), `app/opengraph-image.tsx` (lockup on stone, next/og's bundled font). The root layout sets `metadataBase` from `lib/app-url.ts`; marketing pages carry canonicals; a program with a thumbnail shares it, every other page shares the site card.
- **Legal:** the footer links the hub's documents (Terms of Business, Privacy Policy, Cookie Policy, `worldstreetgold.com/legal`). No `/terms` or `/privacy` in this app.
- **Removed** `link-tmp.cjs` and `link-mobile-identity.cjs` (one-off Clerk-id linking; `lib/auth/sync.ts` links by email).
- **Launch:** env, crons, catalogue, certificate backfill, §17 QA and rollback live in `docs/launch-runbook.md`.
- The sections above predate the Mastery rebuild (`/courses` routes, Hugeicons, `#44A08E`) — `CLAUDE.md` and `design-system/` are current.
```

  3. In `scripts/dev-mock.mjs` replace

```js
 * Everything else (R2, Ably, RealtimeKit, OpenAI, Resend, wallet) stays
 * unconfigured — those features degrade at call time, they don't block boot.
```

   with

```js
 * NOT credential-free: only MONGODB_URI and Clerk are replaced. `next dev`
 * still loads .env.local, so a live RESEND_API_KEY, CLOUDFLARE_REALTIME_*,
 * ABLY_API_KEY, OPENAI_API_KEY, R2_* or WALLET_* there is used — local checks
 * can send real email and create real RealtimeKit rooms. Export placeholders
 * before launching (Next never overrides a variable already set); see CLAUDE.md.
```

- [ ] **Step 5: Verify.**
  1. **Handlers match the disk.** `find app/api -name route.ts | sort` → exactly `app/api/calls/end/route.ts`, `app/api/cron/course-live/route.ts`, `app/api/cron/earnings/route.ts`, `app/api/cron/reminders/route.ts`, `app/api/messages/poll/route.ts`.
     - `grep -c 'Only five route handlers' CLAUDE.md` → `1`.
     - `grep -c 'Only four route handlers' CLAUDE.md` → `0`.
     - `grep -c 'cron/{course-live,earnings,reminders}' CLAUDE.md` → `1`.
  2. **Modules exist and are documented.** `for m in brand schools entitlements course-access faculty countries certificate-id app-url; do test -f lib/$m.ts && grep -q "lib/$m.ts" CLAUDE.md && echo ok || echo "BAD $m"; done | grep -v '^ok'` → prints nothing.
  3. **Named exports exist.** `for n in SITE_DESCRIPTION SCHOOLS SCHOOL_BY_SLUG isSchoolSlug packageFor entitlementsFor canAccessLesson effectiveLessonTier pricingFromPackages getCourseAccess lockedLessonIds openPublishedLessonIds instructorQaRefusal facultyHref safeWebUrl countryName saveWithCertificateId; do grep -rqE "export (async )?(function|const) $n\b" lib && echo ok || echo "MISSING $n"; done | grep -v '^ok'` → prints nothing (the last three are **[P5]**/**[P6]**).
  4. **Scripts are real.** `ls scripts/mastery-catalogue.mjs scripts/backfill-certificate-ids.mjs scripts/_swap-catalogue.mjs` → all three. `node --check scripts/dev-mock.mjs` → no output. `grep -c 'NOT credential-free' scripts/dev-mock.mjs CLAUDE.md` → `1` each.
  5. **Docs referenced exist.** `for d in docs/mastery-academy-plan.md docs/go-patches-phase-3.md docs/launch-runbook.md; do test -f $d && echo ok || echo "MISSING $d"; done | grep -v '^ok'` → prints nothing. `ls docs/plans/mastery-phase-*.md | wc -l` → ≥ `5`.
  6. **Diffs are additive where expected.**
     - `git diff --numstat context.md` → `N	0	context.md`.
     - `git diff --numstat scripts/dev-mock.mjs` → `5	2	scripts/dev-mock.mjs`.
     - `npx eslint scripts/dev-mock.mjs` prints nothing.

- [ ] **Step 6: Commit.**

```bash
git add CLAUDE.md context.md scripts/dev-mock.mjs
git commit -m "docs: CLAUDE.md — five route handlers, Mastery modules, public URLs, script and dev:mock credential warnings; launch entry in context.md

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Phase report — exit criteria and where they are proven

Phase 8 splits into repo proof (this plan, verified on the dev server) and production proof (the owner, following the runbook).

| Exit criterion (`docs/mastery-academy-plan.md` Phase 8) | Repo proof | Production proof (runbook) |
|---|---|---|
| Production catalogue = 12 programs with schools + packages; no orphaned enrollments | Task 4 (§6 commands and review list; §1 before-counts) | §6: the apply log, the idempotent re-run (`Inserted 0` / `modifiedCount 0`), `with school` ≥ 12, orphans unchanged from §1 |
| §17 journey passes end to end on production; run log attached | Task 4 (§8 thirteen-row checklist in §17 order, plus admin and mobile checks) | §8 run log |
| Sitemap/OG/metadata live | Task 1 Step 10 checks 1–6; Task 2 Step 4 checks 1–6 | §4 page table and build log |
| `/terms` and `/privacy` real | **Replaced by ruling 1:** the hub's published Terms of Business, Privacy Policy and Cookie Policy apply across all platforms; Task 3 Step 3 checks 3–5 | §4 footer link check; B4 (legal coverage, owner's call) |
| Docs updated | Task 5 Step 5; Task 4 (Go doc §5, plan §0.4) | — |
| Crons scheduled | Task 4 (§5 table + in-container command); Task 5 (CLAUDE.md lists all five handlers) | §5 run-now logs showing `200 {"ok":true…}` |
| Plan task 2: Go patches deployed and verified from mobile | Task 4 (Go doc R8–R10; runbook §2, §8 mobile matrix) | §2 and §8 |
| Plan task 8: cleanup of `link-tmp.cjs` / `link-mobile-identity.cjs` | Task 3 Steps 5–7 (ruling 8 records what they did) | §11 (history decision) |
| Plan task 5: design-system lockup eyebrow | Ruling 14 (no literal "ACADEMY" in `design-system/*.md`) | §10 confirm |

Report also:
- **Launch blockers needing the owner:**
  - B1 Go patches, or the written "tiers unset" decision;
  - B2 price sign-off on the dry run's `current -> derived` lines;
  - B3 `WALLET_*` in Coolify;
  - B5 a funded QA account and a program with published lessons;
  - B4 legal coverage (the owner's call).
- The hub's `/legal` page and PDFs aren't in the local `dashboard-revamp` checkout (runbook §10).
- The in-container cron command (no `curl` in the runner image), and that existing `curl`-based tasks, if any, have never run.
- The two real RealtimeKit rooms and possible Resend emails from local checks (runbook §11).
- `AGENTS.md` (untracked, not ours) mirrors the old `CLAUDE.md` text and was deliberately not touched.
- The share card uses next/og's bundled font; Poppins on the card is a refinement.

## Self-review

- **Scope coverage.** SEO (sitemap, robots, default OG, per-program OG, metadata on every marketing route, canonicals) → Tasks 1–2. Legal (footer checked, hub and dashboard repos checked, option a chosen on live evidence, no invented copy) → ruling 1 and Task 3. Cleanup (read, recorded, `git rm`) → ruling 8 and Task 3. Docs (verified handler list, modules, `/programs` URLs, catalogue/backfill warnings, dev:mock inheritance, context entry) → Task 5. Runbook (env names, all three cron routes with path, schedule and bearer, Go deploy order with Phase 5 ruling 22 and Phase 6 notes, catalogue dry run → `--apply` with real flags, backfill dry run → `--apply`, §17 QA, rollback, post-launch cleanup) → Task 4.
- **Placeholder scan.** Every code and doc step carries its complete text. The only `<…>` placeholders are inside the owner-run runbook, for values that must never be written down (URIs, ids, prices from the dry run).
- **Consistency.**
  - The four legal hrefs are identical in `footer.tsx` and the runbook (Task 4 check 4).
  - `SITE_DESCRIPTION` is defined in Task 1 and documented in Task 5.
  - The route lists in Tasks 2, 4 and 5 all derive from `app/api` on disk.
  - The cron schedules match each route's own comment.
