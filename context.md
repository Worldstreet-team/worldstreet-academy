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
- `/dashboard/favorites` — Bookmarked courses
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
- **Platform sidebar**: Same pattern — user avatar + name + ThemeToggle, then Log out. Includes Favorites nav item (`Bookmark01Icon`)
- **Marketing navbar**: ThemeToggle next to Sign In / Get Started buttons

### Topbar
- **Shared component** (`components/platform/topbar.tsx`) — client component with `variant` prop: `"platform"` (default) or `"instructor"`
- **User profile dropdown**: Avatar in top-right with DropdownMenu showing name, email, Profile, Settings, Log out
- **Breadcrumbs bar**: Auto-generated from pathname, scrollable on mobile (`overflow-x-auto`). Shows beneath main bar when path has >1 segment
- **Theme Toggle**: Always visible in topbar, plus sidebar footers and marketing navbar

### Mobile Navigation
- **Bottom nav**: Fixed bottom bar on mobile (`md:hidden`) for both portals
  - **Platform**: Home, My Courses (`BookOpen01Icon`), [Browse CTA], Favorites, Profile — center button is `Search01Icon` in primary circle
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
- **Favorites section**: Empty state with `Bookmark01Icon`, "Browse Courses" CTA. Route: `/dashboard/favorites`
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
