# WorldStreet Academy — Project Scope

## What We're Building
The **Academy** module of WorldStreet — a structured learning platform with courses, lessons, live classes, progress tracking, and certificates.

## Approach
- **Frontend-first** — Build all UI skeletons, then wire features incrementally
- **Next.js App Router** with route groups for public vs auth-gated pages
- **Shadcn UI (Nova)** for all components including sidebar, cards, forms
- **Server Actions** for all mutations (no API routes)
- **RSC-first** — only use `'use client'` where interaction demands it
- **Mock data** initially, swap for real backend later

## Route Structure

### Public — `(marketing)/`
| Route | Purpose |
|-------|---------|
| `/` | Landing page |
| `/courses` | Browse all courses |
| `/courses/[courseId]` | Course detail + curriculum |

### Auth-Gated — `(platform)/`
| Route | Purpose |
|-------|---------|
| `/dashboard` | My enrolled courses + progress |
| `/dashboard/certificates` | My certificates |
| `/courses/[courseId]/learn/[lessonId]` | Lesson viewer (video + text) |
| `/courses/[courseId]/live` | Live class room |
| `/courses/[courseId]/certificate` | View/download certificate |

### Instructor — `(platform)/instructor/`
| Route | Purpose |
|-------|---------|
| `/instructor` | Instructor dashboard |
| `/instructor/courses/new` | Create course |
| `/instructor/courses/[courseId]/edit` | Edit course + lessons |

## Tech Stack
| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router) |
| UI | Shadcn (Nova) + Tailwind v4 |
| Icons | Hugeicons |
| State | Zustand (when needed) |
| Server State | TanStack React Query (when needed) |
| Validation | Zod |
| Video Player | TBD (vidstack or similar) |
| Live Classes | TBD (LiveKit or similar) |
| Certificates | TBD (@react-pdf or similar) |
| Payments | TBD (Stripe/Paystack) |

## Current Phase: UI Skeletons
Building out all layouts, pages, and navigation with placeholder content. No real data, no API calls — just the UI shell.

### Layouts
- **Marketing layout** — Navbar + footer (public pages)
- **Platform layout** — Sidebar + topbar (authenticated pages)

### Components to Build
- Navbar (marketing)
- Footer (marketing)
- Sidebar (platform — Shadcn sidebar)
- Topbar (platform)
- Course card
- Empty states
- Page headers

## Roles
| Role | Access |
|------|--------|
| USER | Browse, enroll, learn, attend live, get certs |
| INSTRUCTOR | All USER + create/edit courses, host live classes |
| ADMIN | Everything |

## Features (To Wire Later)
1. Course CRUD (server actions)
2. Enrollment + payment
3. Video lesson playback
4. Progress tracking + resume
5. Live classes (WebRTC)
6. Certificate generation
7. Instructor analytics
8. Auth (JWT + RBAC)
