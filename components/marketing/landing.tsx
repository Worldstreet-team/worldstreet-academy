import Link from "next/link"
import { CourseCard } from "@/components/courses/course-card"
import { BookmarkProvider } from "@/components/providers/bookmark-provider"
import { fetchBrowseCourses } from "@/lib/actions/student"
import { ChartLineIcon, FileBadgeIcon, GraduationCapIcon, UsersIcon } from "lucide-react"
import { RenderIcon } from "@/components/shared/render-icon"

const isLocalDev = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")
const REGISTER_URL = isLocalDev ? "/register" : "https://worldstreetgold.com/register"

/**
 * The Academy landing, Udemy-style: what this is, proof it's real, the actual
 * catalog, and one way in. Rendered at `/` for guests (signed-in users are
 * redirected to the dashboard there) and at `/home` for everyone — that route
 * exists so signed-in users can still reach the landing from the app shell.
 *
 * Stats are computed from the live catalog, not typed in. Fabricated numbers
 * on a landing page for a money product is exactly the kind of trust leak the
 * copy tone rules ("calm, confident, few words") exist to prevent.
 */
export async function Landing() {
  const courses = await fetchBrowseCourses()
  const featured = [...courses]
    .sort((a, b) => (b.enrolledCount ?? 0) - (a.enrolledCount ?? 0))
    .slice(0, 3)

  const learners = courses.reduce((sum, c) => sum + (c.enrolledCount ?? 0), 0)
  const instructors = new Set(courses.map((c) => c.instructorId)).size
  const rated = courses.filter((c) => c.rating)
  const avgRating = rated.length
    ? (rated.reduce((s, c) => s + (c.rating ?? 0), 0) / rated.length).toFixed(1)
    : null

  // Each stat has a floor: real numbers only, but not so early that honesty
  // reads as weakness ("1 Instructor" sells nothing). Below the floor the stat
  // simply doesn't render.
  const stats = [
    courses.length >= 4 ? { value: String(courses.length), label: "Courses" } : null,
    learners >= 100 ? { value: learners.toLocaleString(), label: "Enrollments" } : null,
    instructors >= 3 ? { value: String(instructors), label: "Instructors" } : null,
    avgRating && rated.length >= 2 ? { value: avgRating, label: "Avg rating" } : null,
  ].filter((s): s is { value: string; label: string } => s !== null)

  const pillars = [
    {
      icon: ChartLineIcon,
      title: "Learn from working traders",
      body: "Courses on trading, DeFi and risk management, built by people who trade for a living — not content mills.",
    },
    {
      icon: UsersIcon,
      title: "Live sessions & community",
      body: "Join live classes and meetings, message instructors directly, and learn alongside the WorldStreet community.",
    },
    {
      icon: FileBadgeIcon,
      title: "Earn verifiable certificates",
      body: "Finish a course, pass the exam, and get a certificate you can share on LinkedIn or your résumé.",
    },
  ]

  return (
    <div>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        {/* Quiet gold wash — brand at whisper volume, no imagery to fight the copy */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, color-mix(in srgb, var(--ws-brand-primary) 8%, transparent), transparent)",
          }}
        />
        <div className="relative mx-auto max-w-5xl px-6 pb-16 pt-20 text-center md:pb-24 md:pt-32">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ws-muted">
            WorldStreet Academy
          </p>
          <h1 className="mx-auto mt-4 max-w-3xl font-display text-4xl font-extrabold leading-[1.08] tracking-[-0.02em] text-ws-primary sm:text-5xl md:text-6xl">
            Go from your first trade to <span className="text-ws-gold">confident trader</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-ws-muted md:text-lg">
            Structured courses on crypto, trading and DeFi — taught by instructors who trade for
            a living, with live sessions and certificates that mean something.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={REGISTER_URL}
              className="inline-flex h-[52px] items-center justify-center rounded-sm bg-ws-brand px-9 text-base font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"
            >
              Start learning
            </a>
            <Link
              href="/courses"
              className="inline-flex h-[52px] items-center justify-center rounded-sm border border-ws-hairline px-8 text-base font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised"
            >
              Browse courses
            </Link>
          </div>

          {/* Live stats from the catalog */}
          {/* gap-x-12 between two content-sized columns is ~48px of a 272px
              320px-viewport line box — enough to push a long stat label out.
              The gutter opens back up from sm, where there is room for it. */}
          {stats.length > 0 && (
          <dl className="mx-auto mt-14 grid w-fit max-w-full grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4 sm:gap-x-12">
            {stats.map((s) => (
              <div key={s.label}>
                <dd className="font-display text-2xl font-bold tabular-nums text-ws-primary md:text-3xl">
                  {s.value}
                </dd>
                <dt className="mt-0.5 text-[13px] text-ws-muted">{s.label}</dt>
              </div>
            ))}
          </dl>
          )}
        </div>
      </section>

      {/* ── Why here ── */}
      <section className="border-y border-ws-hairline bg-ws-surface">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-16 md:grid-cols-3 md:py-20">
          {pillars.map((p) => (
            <div key={p.title} className="flex flex-col items-start">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-md border"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--ws-accent-academy) 13%, transparent)",
                  borderColor: "color-mix(in srgb, var(--ws-accent-academy) 33%, transparent)",
                }}
              >
                <RenderIcon icon={p.icon}  size={24} className="text-ws-academy" />
              </div>
              <h2 className="mt-4 text-[17px] font-bold text-ws-primary">{p.title}</h2>
              <p className="mt-1.5 text-[15px] leading-relaxed text-ws-muted">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Featured courses (real catalog) ── */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 py-16 md:py-20">
          <div className="mb-8 flex items-baseline justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-[-0.015em] text-ws-primary">
                Most popular courses
              </h2>
              <p className="mt-1 text-[15px] text-ws-muted">
                Where most learners start.
              </p>
            </div>
            <Link
              href="/courses"
              className="shrink-0 text-[13px] font-medium text-ws-gold transition-opacity hover:opacity-80"
            >
              See all
            </Link>
          </div>
          {/* Grid inlined (vs CourseGrid) so the grid reaches the cards as
              direct children and cascades them in. */}
          <BookmarkProvider courseIds={featured.map((c) => c.id)}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featured.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          </BookmarkProvider>
        </section>
      )}

      {/* ── Teach strip ── */}
      <section className="border-t border-ws-hairline bg-ws-surface">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-14 md:flex-row md:items-center">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-ws-raised">
              <GraduationCapIcon  size={24} className="text-ws-gold" />
            </div>
            <div>
              <h2 className="text-[17px] font-bold text-ws-primary">Know the markets? Teach them.</h2>
              <p className="mt-1 max-w-lg text-[15px] leading-relaxed text-ws-muted">
                Publish your own courses on Academy and earn from every enrollment.
              </p>
            </div>
          </div>
          <a
            href={REGISTER_URL}
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-sm border border-ws-hairline px-6 text-[15px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised"
          >
            Become an instructor
          </a>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="border-t border-ws-hairline">
        <div className="mx-auto max-w-2xl px-6 py-16 text-center md:py-20">
          <h2 className="font-display text-3xl font-bold tracking-[-0.02em] text-ws-primary">
            Start free today
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-ws-muted">
            Free courses to get you started — one account across the whole WorldStreet ecosystem.
          </p>
          <a
            href={REGISTER_URL}
            className="mt-8 inline-flex h-[52px] items-center justify-center rounded-sm bg-ws-brand px-10 text-base font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"
          >
            Create your account
          </a>
        </div>
      </section>
    </div>
  )
}
