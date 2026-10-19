# WorldStreet Academy — Context

## Project Overview

Online education platform for cryptocurrency/trading courses. Instructor portal for course management, student-facing dashboard for learning, and a marketing site for discovery.

## Tech Stack

- **Framework**: Next.js 16.1.6 (App Router, Turbopack)
- **UI**: Shadcn Nova (Base UI) — uses `render` prop, NOT `asChild`
- **Styling**: Tailwind CSS v4 with oklch colors, primary `#44A08E`
- **Icons**: `@hugeicons/react` + `@hugeicons/core-free-icons`
- **Theming**: `next-themes` 0.4.6 (dark/light mode)
- **Package Manager**: pnpm

## Route Groups

| Group | Path Prefix | Layout | Purpose |
|-------|------------|--------|---------|
| `(marketing)` | `/`, `/courses/*` | Navbar + Footer | Public-facing pages |
| `(platform)` | `/dashboard/*` | Sidebar (AppSidebar) + Topbar | Student dashboard |
| `(instructor)` | `/instructor/*` | Sidebar (InstructorSidebar) + Topbar | Instructor portal |

## Routes (21 total)

- `/` — Landing page
- `/courses` — Course catalog
- `/courses/[courseId]` — Course info page (public preview)
- `/courses/[courseId]/learn/[lessonId]` — Lesson player
- `/courses/[courseId]/live` — Live session
- `/dashboard` — Student dashboard
- `/dashboard/courses` — Browse courses
- `/dashboard/my-courses` — Enrolled courses
- `/dashboard/bookmarks` — Bookmarked courses
- `/dashboard/profile` — User profile
- `/dashboard/settings` — User settings
- `/dashboard/help` — Help center
- `/instructor` — Instructor overview (stats + course grids)
- `/instructor/courses` — My Courses (grid by status)
- `/instructor/courses/new` — Create course
- `/instructor/courses/[courseId]` — Course info/preview (instructor)
- `/instructor/courses/[courseId]/edit` — Course editor (3-column)
- `/instructor/courses/[courseId]/lessons` — Lesson manager
- `/instructor/analytics` — Analytics
- `/instructor/settings` — Settings

## Key Decisions & Changes

### UI Patterns
- **Separator component**: Uses `data-vertical:h-full` (not `self-stretch`) for proper vertical alignment in flex containers
- **Pipe separators replaced**: All `|` pipe characters replaced with `·` dots throughout instructor pages
- **Star ratings**: Orange `StarIcon` with `fill="currentColor"` and `text-orange-500` everywhere ratings appear
- **Grid layout**: All course listings use responsive grid cards (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`)
- **Section separators**: `<Separator>` divides Draft / Published / Archived groups

### Course Editor
- **No timeline**: Curriculum sections use simple `space-y-2` stacked collapsible cards — no git-style rail/dots
- **Save dropdown**: DropdownMenu with "Save as Draft" and "Save & Publish" options. Uses `data-editor-form` attribute on form + `requestAnimationFrame` to ensure state updates before submission
- **Media uploads**: Video player with glassmorphic play overlay, auto-duration checkbox

### Sidebar Footer
- **Instructor sidebar**: User avatar + name + ThemeToggle on one row, then Log out. "Back to Academy" removed
- **Platform sidebar**: Same pattern — user avatar + name + ThemeToggle, then Log out. Includes Bookmarks nav item (`Bookmark01Icon`)
- **Marketing navbar**: ThemeToggle next to Sign In / Get Started buttons

### Topbar
- **Shared component** (`components/platform/topbar.tsx`) — client component with `variant` prop: `"platform"` (default) or `"instructor"`
- **User profile dropdown**: Avatar in top-right with DropdownMenu showing name, email, Profile, Settings, Log out
- **Breadcrumbs bar**: Auto-generated from pathname, scrollable on mobile (`overflow-x-auto`). Shows beneath main bar when path has >1 segment
- **Theme Toggle**: Always visible in topbar, plus sidebar footers and marketing navbar

### Mobile Navigation
- **Bottom nav**: Fixed bottom bar on mobile (`md:hidden`) for both portals
  - **Platform**: Home, My Courses (`BookOpen01Icon`), [Browse CTA], Bookmarks, Profile — center button is `Search01Icon` in primary circle
  - **Instructor**: Overview, Courses, [Add Course CTA], Analytics, Settings — center button is `Add01Icon` in primary circle
  - CTA button is elevated with `ring-4 ring-background` and `shadow-lg shadow-primary/30`
- **Sidebar preserved**: Bottom nav is mobile-only overlay; sidebar still available via `SidebarTrigger`
- **Bottom padding**: All page content areas use `pb-24 md:pb-8` to avoid content under bottom nav

### Topbar
- **Shared component** (`components/platform/topbar.tsx`) — client component with `variant` prop: `"platform"` (default) or `"instructor"`
- **Sticky**: `sticky top-0 z-40 bg-background/95 backdrop-blur-md` — stays fixed at top of viewport
- **Cmd+K trigger**: Search button visible on sm+ screens with `⌘K` keyboard shortcut hint
- **User profile dropdown**: Avatar in top-right with DropdownMenu showing name, email, Profile, Settings, Log out
- **Breadcrumbs bar**: Auto-generated from pathname, scrollable on mobile (`overflow-x-auto`). Shows beneath main bar when path has >1 segment
- **Theme Toggle**: Always visible in topbar, plus sidebar footers and marketing navbar

### Dashboard (Student)
- **Welcome section**: Transparent container (no gradient bg) with greeting + stats row in subtle `bg-muted/40` cards
- **Search**: Filter input in My Courses section to search enrolled courses by title/instructor
- **My Courses**: Swipeable `Carousel` with prev/next controls in header row. Cards show author avatar, star rating in orange pill, glassmorphic price badge, radial progress (green checkmark at 100%), bookmark button. "View All" button centered below.
- **Bookmarks section**: Empty state with `Bookmark01Icon`, "Browse Courses" CTA. Route: `/dashboard/bookmarks`
- **Empty states**: Reusable `EmptyState` component (`components/shared/empty-state.tsx`)

### Course Cards
- **Price badge**: Glassmorphic — `backdrop-blur-md bg-white/20 text-white dark:bg-black/30 border-white/30`
- **Bookmark button**: Glassmorphic circle in top-right of thumbnail for users to save/favorite courses
- **Rating**: Orange pill badge (`bg-orange-50 dark:bg-orange-500/10`) with star + number in card footer
- **Author avatar**: Always visible in card footer with `Avatar size="sm"`, instructor name + lesson count stacked below
- **Radial progress**: SVG circle at <100%, green `Tick02Icon` checkmark (no circle) at 100%

### Instructor Pages
- **Overview**: Stats grid (4 cards), search input, then course sections (Drafts → Published → Archived). On mobile, course sections use `Carousel`, on desktop they use grid.
- **My Courses**: Same grid card format per section (Drafts → Published → Archived) with badges + separators
- **Course Info Page** (`/instructor/courses/[courseId]`): Full-width hero thumbnail (21:9), course details, curriculum list, sidebar with stats grid + details list + action buttons (Edit, Manage Lessons, Delete)

### Command Palette (Cmd+K)
- **Component**: `components/shared/command-search.tsx` — global dialog triggered by `⌘K` / `Ctrl+K`
- **Sections**: Courses (from mockCourses), Pages (dashboard routes), Tools (dark mode toggle, logout)
- **UX**: Arrow key navigation, Enter to select, Escape to close, real-time filtering
- **Wired in**: Both `(platform)` and `(instructor)` layouts include `<CommandSearch />`

### Mock Data
- 9 courses total: 6 published, 2 drafts (NFT Trading id:7, Algo Trading id:8), 1 archived (Crypto Tax id:9)
- `inst-1` (Sarah Chen) owns: ids 1, 3, 7, 8, 9
- 6 lessons for course id:1 (mix of video + live)

### Duration Formatting
- **Course editor**: HH:MM:SS format in duration inputs
- **Summaries/cards**: Human-readable (`1h 30m`, `45m`)

### Base UI Notes
- Shadcn Nova uses `render` prop for composition: `<Button render={<Link href="..." />}>`
- DropdownMenu = `@base-ui/react/menu` (Menu.Root, Trigger, Portal, Positioner, Popup, Item)
- Components with hooks (Badge uses `useRender`) are client components internally

### 2026-10-19 — Phase 11: the institution's voice
- **Tagline:** the site now reads "the Academy of the New Economy" (one home in `lib/institution.ts`, with the brand constants); the landing hero is the institutional blueprint's "Welcome to WMA" claim.
- **New `/academy`:** the big idea, vision, mission, the journey and the three worlds. Reached from "The Academy" in the navbar (before Programs, first in the mobile sheet) and "About the Academy" in the footer.
- **Plans, not packages:** new user-facing copy says plan; identifiers, routes and field names keep `package`. (The wider vocabulary rename, Tasks 6-7, runs last, after all tracks merge.)
- **§4 replaces "Who we are":** the blueprint's section 4 text supersedes the 2026-10-03 "point A to point B" framing on the landing.
- **Cohort band:** names its cohort ("Cohort 00N — Starts …"), with Explore Programs / Join Cohort; it and the hero's "Join the upcoming cohort" render only while a cohort is upcoming (`cohortIsUpcoming()`).

## Decision Log

### 2026-09-14 — Launch prep (Mastery Academy Phase 8)
- **SEO:** `app/sitemap.ts` (home, schools, published programs, faculty; never `/verify` or the signed-in apps), `app/robots.ts` (disallows `/dashboard`, `/instructor`, `/admin`, `/api/`, `/login`, `/register`; `/verify` stays crawlable so its noindex is read), `app/opengraph-image.tsx` (lockup on stone, next/og's bundled font). The root layout sets `metadataBase` from `lib/app-url.ts`; marketing pages carry canonicals; a program with a thumbnail shares it, every other page shares the site card.
- **Legal:** the footer links the hub's documents (Terms of Business, Privacy Policy, Cookie Policy, `worldstreetgold.com/legal`). No `/terms` or `/privacy` in this app.
- **Removed** `link-tmp.cjs` and `link-mobile-identity.cjs` (one-off Clerk-id linking; `lib/auth/sync.ts` links by email).
- **Launch:** env, crons, catalogue, certificate backfill, §17 QA and rollback live in `docs/launch-runbook.md`.
- The sections above predate the Mastery rebuild (`/courses` routes, Hugeicons, `#44A08E`) — `CLAUDE.md` and `design-system/` are current.

### 2026-10-19 — WMA Partners (Phase 18)
- The referral program is renamed **WMA Partners** (the route stays `/dashboard/referrals`); every account's code is its **Partner Code**. Commission is unchanged: 10% of a referred learner's first paid purchase, wallet only.
- **Clicks** are counted in `partnerclicks` (web-only, one row per code per Lagos day): once per visitor per code per day, through the `wsa_ref_seen` cookie. Bots, unknown codes and the partner's own signed-in visits are ignored.
- **Revenue** is everything credited to the code as a referral: paid or enrolled orders, wallet and ESPEE; not refunds, not a creator's own link. A learner whose first purchase is paid by ESPEE, or credited to another code, earns the referrer no commission, and the page says so.
- **`/admin/partners`** lists every partner with any activity and exports a CSV (`wma-partners-YYYY-MM-DD.csv`); it also counts the codes with no activity yet.

### 2026-10-19 — Admin levels (Phase 21)
- **Data:** `User.adminLevel` (`"super"` or null, Mongo only, never read from or written to Clerk) and `adminAudit[]`. A super admin is `role: "ADMIN"` plus `adminLevel: "super"`; Go still sees `ADMIN`. Every grant, revoke, promote and demote is audited.
- **Super-only grants:** `/admin/team` (a 404 for regular admins) and the Admin option on `/admin/users`. All role changes go through `applyRoleChange` in `lib/auth/admin.ts`; actions use `requireSuperAdmin()`. Self-changes and demoting the last super admin are refused.
- **Clerk:** metadata can no longer make an existing account an admin; it raises a `USER` to `INSTRUCTOR` only. A brand-new account still takes its claimed role (open risk, noted for the owner).
- **Removal** restores the role held at grant time (the latest grant entry's `fromRole`). Granting `ADMIN` no longer sets `instructorStatus: "approved"`.
- **Bootstrap:** `MONGODB_URI=<uri> node scripts/grant-admin.mjs <email> --super` (the explicit URI is required). `--revoke` refuses the last super admin.

### 2026-10-19 — Mastery Score and attendance (institutional Phase 16)
- **Mastery Score** (`lib/mastery-score.ts`, `lib/mastery-inputs.ts`): D24 weights (completion 30, assessment 25, assignments 20, projects 10, attendance 15) as a re-weighted mean over the parts a plan includes and that have data; no score until two parts do. Programs only (`courseKindOf(course) === "program"`). Computed on read, never stored.
- **Attendance** (`lib/attendance-rules.ts`, `lib/attendance.ts`): a web-only `attendances` row per learner per course class, written only by `lib/attendance.ts` from the meeting actions (join, admit, leave, kick, end) and `MeetingProvider`'s 60 s heartbeat (`pingAttendance`). A gap over 150 s earns nothing, so a closed tab stops counting. A class is held once ended and at least 10 minutes long; attended means at least min(50% of the class, 1,800 s). The attendance part is null until a class has been held. Mobile joins don't count until Go R-A.
- **Projects** are assignments with `Assignment.kind: "project"`; instructors toggle it in the editor, learners see a "Project" chip.
- **Where it shows:** `/dashboard/points` (a card per program), the dashboard hero's "Mastery" cell, and a "Mastery" column on `/admin/enrollments`. Never on a public page; Basic learners see parts but no score.

### 2026-10-19 — Student portal, communities and the welcome email (Phase 15)
- **Sidebar (§11):** Learn = Dashboard, My programs, My classes (`/dashboard/meetings`; instructors keep "Meetings"), Recordings, Assignments, Assessments, My points, Certificates, Mentorship; Connect = Inbox (with the bell's unread count, via the shared `useNotificationFeed`), Messages, Communities.
- **Assessments vs Assignments:** `/dashboard/assessments` lists final exams and knowledge checks (attempts, best score, pass mark, next action); `/dashboard/assignments` lists assignments only. One client list component serves both; `getMyAssessments()` keeps its signature and pages split rows with `assessmentKindOf`.
- **Communities (D26):** `lib/communities.ts` builds one deduplicated, `safeWebUrl`-checked list (program, school, Academy, Executive). The Academy row shows to every learner with an active or completed enrollment; Executive only on an Executive plan. The page and the dashboard's Help & community tile share it. School links are code (`School.communityUrl`, none set yet).
- **Welcome email (D27):** "Welcome to WorldStreet Mastery Academy", on a learner's first paid enrollment only (wallet purchase or ESPEE approval), at most once, claimed atomically through `users.welcomedAt`; never retried; learners who paid before this release get none.
- **Campus (D19):** the greeting eyebrow reads "WMA Campus · <date>".
- **Checkout return path:** middleware forwards `x-next-search`; the checkout layout redirects a signed-out visitor to `loginUrl()` with the plan's checkout as the return path.

### 2026-10-19 — Seven schools (Mastery Academy Phase 13)
- **The seven schools (D21)** replace the eight in `lib/schools.ts`: Trading & Financial Markets, Technology & AI, Digital Business, Entrepreneurship & Wealth Creation, Creative Economy, Leadership & Personal Development, Emerging Technologies. The four old technology slugs (`ai-automation`, `software-app-development`, `cybersecurity`, `data-analytics`) fold into `technology-ai`; the other retired slugs are each school's `legacySlugs`. Entrepreneurship and Leadership start with no programs ("first programs are on their way", six "Coming soon" areas).
- **`intro` is §8's School Overview.** No `overview` field was added: two fields for one paragraph would drift. `tagline` stays null except for Trading.
- **Study areas (D22)** are `areas: { name, program }`, §7 verbatim. `program` is the catalogue title, matched against the school's published programs by trimmed, case-insensitive title, never by slug (production slugs carry random suffixes). A draft or missing program reads "Coming soon". No Course rows were created.
- **Legacy URLs 308 from `app/(marketing)/schools/[slug]/page.tsx`** (`permanentRedirect`), not from `next.config.ts`. The Docker runner copies and runs `next.config.ts` at runtime, so importing `lib/schools.ts` there would break `next start`, and a duplicated map would drift.
- **Read-side resolution.** Every stored or remembered slug (cookie, `?school=`, read models, reviews) goes through `schoolFromSlug` / `schoolSlugOf`; writes stay strict (`isSchoolSlug`, `z.enum(SCHOOL_SLUGS)`). Deploy and `scripts/migrate-schools-v2.mjs --apply` can run in either order, and a Go client still writing an old slug is read correctly.
- **Placeholder covers.** Existing renders are reused, one per school. Entrepreneurship uses the data-analytics cover and Leadership the cybersecurity cover until real renders exist (content debt). `scripts/art/school-covers/render.mjs` stays frozen.
- **Drafted copy awaits sign-off.** `learn`, `audience`, `careers` of all seven schools, and the blurb and intro of the six new or renamed ones, are drafted from §7 and marked `// DRAFT: owner sign-off pending` in `lib/schools.ts`. Trading's blurb, tagline and intro are the 2026-09-14 text.
- **Page order (§8):** hero, learn, audience, careers, programs (compare, topics), study areas, faculty, a commented slot for Phase 12's upcoming cohorts, learning pathways, free lessons, reviews, FAQ, other schools. `SchoolTopics` is now `#topics`.
- **Owner steps** are in `docs/launch-runbook.md` "Seven schools — Phase 13". Never run a pre-Phase 13 `mastery-catalogue.mjs` after the migration: it files the programs under retired slugs again.

### 2026-10-19 — Plans to the blueprint (Phase 14)
- **Labels:** Basic — Foundation, Standard — Mastery, Executive — Personalized Mastery. The tagline sits beside the tier label; plan names stay program-specific.
- **`recordings` entitlement:** a plan includes recorded classes when `recordings || liveClasses` (`recordingsAllowed`), so plans saved before the flag keep their recordings. Basic now has recordings, assignments and the certificate; live classes and instructor Q&A stay off.
- **"Recorded classes"** joins every list of what a plan includes (chooser, ladder, purchase panel, checkout lines).
- **Executive's label** is "Executive" (was "Executive 101"); the stored plan name is unchanged.

### 2026-10-19 — Certification tiers and WMA Alumni (Phase 17)
- **Three credentials:** WMA Certificate of Completion, WMA Certified Practitioner and WMA Mastery Certification. The tier rules are pure, in `lib/certificate-tier.ts`; the D25 thresholds (Mastery Score 70 and 85, a graded project of 70) are named constants.
- **Stored, never lowered:** `Enrollment.certificateTier` is raised by `ensureCertificateTier` (`lib/certificate-standing.ts`) on completion, exam, grading, admin changes and when a learner opens their certificates. A conditional write means a re-grade or a falling score never takes a tier away. A null tier reads as Completion. The `WSA-` ID stays one per enrollment.
- **`/certification`** is the public page that publishes the requirements, with the Mastery Score weights read from the constants. `/verify` prints the stored tier and never computes.
- **WMA Alumni:** a chip on the dashboard greeting and the profile for anyone holding at least one certificate. Never on a public page.
- **Ruling 3:** "final exam passed" is `examPassed === true`, so a program with no published final exam tops out at Completion.
- **Ruling 4:** only the Standard and Executive plans reach Practitioner; a null `packageKey` (legacy, free) tops out at Completion. Stored tiers never go down, so widening this later is reversible.

