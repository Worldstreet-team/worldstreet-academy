"use client"

/**
 * Vivid Overlay — Side panel for displaying data: courses, meetings, messages,
 * enrollments, certificates, profiles, etc. Includes loading skeleton states.
 */

import Image from "next/image"
import { motion, AnimatePresence } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"
import {
  TeachingIcon,
  UserGroupIcon,
  BubbleChatIcon,
  Certificate01Icon,
  UserIcon,
  StarIcon,
  ArrowRight01Icon,
  Search01Icon,
  Tick02Icon,
  BookOpen01Icon,
} from "@hugeicons/core-free-icons"
import type { OverlayPanel, OverlaySection } from "@/lib/vivid/types"

// ============================================================================
// Constants
// ============================================================================

const SECTION_ICONS: Record<OverlaySection, IconSvgElement> = {
  courses: TeachingIcon,
  meetings: UserGroupIcon,
  messages: BubbleChatIcon,
  enrollments: Certificate01Icon,
  "course-detail": TeachingIcon,
  profile: UserIcon,
  "search-results": Search01Icon,
  certificates: Certificate01Icon,
}

// ============================================================================
// Panel View
// ============================================================================

export function OverlayPanelView({ panel }: { panel: OverlayPanel }) {
  const icon = SECTION_ICONS[panel.section] || TeachingIcon

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-accent/30">
          <HugeiconsIcon icon={icon} size={16} className="text-foreground/70" />
        </div>
        <h3 className="text-lg font-semibold text-foreground tracking-tight capitalize">
          {panel.title}
        </h3>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={panel.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          {panel.data === null ? (
            <OverlaySkeleton section={panel.section} />
          ) : (
            <OverlayContent section={panel.section} data={panel.data} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function OverlaySkeleton({ section }: { section: OverlaySection }) {
  const count = section === "course-detail" || section === "profile" ? 1 : 4

  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.05 }}
          className="p-3 rounded-xl bg-card/40 border border-border/20 space-y-2"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-muted/40 animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-3/4 rounded-md bg-muted/40 animate-pulse" />
              <div className="h-2.5 w-1/2 rounded-md bg-muted/30 animate-pulse" />
            </div>
          </div>
          {section === "enrollments" && (
            <div className="h-1.5 w-full rounded-full bg-muted/30 animate-pulse" />
          )}
        </motion.div>
      ))}
    </div>
  )
}

// ============================================================================
// Content Router
// ============================================================================

function OverlayContent({ section, data }: { section: OverlaySection; data: unknown }) {
  switch (section) {
    case "courses":
      return <CourseGrid data={data} />
    case "search-results":
      return <SearchResultsList data={data} />
    case "course-detail":
      return <CourseDetail data={data} />
    case "enrollments":
      return <EnrollmentList data={data} />
    case "meetings":
      return <MeetingList data={data} />
    case "messages":
      return <MessageList data={data} />
    case "profile":
      return <ProfileCard data={data} />
    case "certificates":
      return <CertificateList data={data} />
    default:
      return <GenericData data={data} />
  }
}

// ──── Course Grid ────

function CourseGrid({ data }: { data: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = Array.isArray(data) ? data : (data as any)?.courses || (data as any)?.bookmarks || []

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="p-4 rounded-2xl bg-accent/20 mb-4">
          <HugeiconsIcon icon={TeachingIcon} size={28} className="text-muted-foreground/50" />
        </div>
        <p className="text-muted-foreground text-sm">No courses found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.slice(0, 12).map((course: CourseItem, i: number) => (
        <motion.div
          key={course.id || i}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04, type: "spring", stiffness: 300, damping: 25 }}
          className="rounded-2xl bg-card/50 border border-border/20
                     hover:border-foreground/10 hover:bg-card/70 transition-all duration-200
                     group cursor-pointer overflow-hidden"
        >
          {/* Thumbnail banner */}
          {course.thumbnailUrl ? (
            <div className="relative w-full aspect-2/1 bg-muted overflow-hidden">
              <Image
                src={course.thumbnailUrl}
                alt={course.title}
                fill
                className="object-cover group-hover:scale-[1.03] transition-transform duration-500 ease-out"
                sizes="400px"
              />
              {/* Price badge — top right */}
              <div className="absolute top-2.5 right-2.5">
                {course.pricing === "free" ? (
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-600/90 text-white backdrop-blur-sm">
                    Free
                  </span>
                ) : course.price ? (
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-background/80 text-foreground backdrop-blur-sm border border-border/30">
                    ${course.price}
                  </span>
                ) : null}
              </div>
              {/* Level badge — top left */}
              {course.level && (
                <div className="absolute top-2.5 left-2.5">
                  <span className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-background/70 text-foreground/80 backdrop-blur-sm border border-border/20 capitalize">
                    {course.level}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-20 bg-accent/20 flex items-center justify-center">
              <HugeiconsIcon icon={TeachingIcon} size={28} className="text-muted-foreground/30" />
            </div>
          )}

          {/* Content */}
          <div className="p-3.5 space-y-2.5">
            <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
              {course.title}
            </p>

            {/* Author row */}
            <div className="flex items-center gap-2">
              {course.instructorAvatar ? (
                <div className="relative w-5 h-5 rounded-full overflow-hidden bg-muted shrink-0 ring-1 ring-border/20">
                  <Image src={course.instructorAvatar} alt="" fill className="object-cover" sizes="20px" />
                </div>
              ) : course.instructorName ? (
                <div className="w-5 h-5 rounded-full bg-accent/40 flex items-center justify-center shrink-0">
                  <span className="text-[9px] font-bold text-foreground/50">
                    {course.instructorName[0]?.toUpperCase()}
                  </span>
                </div>
              ) : null}
              {course.instructorName && (
                <span className="text-xs text-muted-foreground truncate">{course.instructorName}</span>
              )}
            </div>

            {/* Progress bar (if enrolled) */}
            {(course.progress ?? 0) > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 rounded-full bg-accent/30 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${course.progress}%` }}
                    transition={{ duration: 0.8, ease: "circOut", delay: i * 0.04 + 0.2 }}
                    className="h-full rounded-full bg-foreground/60"
                  />
                </div>
                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{course.progress}%</span>
              </div>
            )}

            {/* Meta row */}
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              {(course.rating ?? 0) > 0 && (
                <span className="flex items-center gap-0.5 text-amber-400">
                  <HugeiconsIcon icon={StarIcon} size={11} className="fill-current" />
                  {(course.rating ?? 0).toFixed(1)}
                </span>
              )}
              {(course.totalLessons ?? 0) > 0 && (
                <span className="flex items-center gap-1">
                  <HugeiconsIcon icon={BookOpen01Icon} size={11} />
                  {course.totalLessons}
                </span>
              )}
              {(course.enrolledCount ?? 0) > 0 && (
                <span>
                  {course.enrolledCount! > 999
                    ? `${(course.enrolledCount! / 1000).toFixed(1)}k`
                    : course.enrolledCount} students
                </span>
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

interface CourseItem {
  id?: string
  title: string
  shortDescription?: string
  thumbnailUrl?: string
  instructorName?: string
  instructorAvatar?: string
  rating?: number
  level?: string
  pricing?: string
  price?: number
  totalLessons?: number
  enrolledCount?: number
  progress?: number
}

// ──── Course Detail ────

function CourseDetail({ data }: { data: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const course = (data as any)?.course || data
  if (!course) return null

  return (
    <div className="space-y-5">
      {/* Thumbnail */}
      {course.thumbnailUrl && (
        <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-muted">
          <Image src={course.thumbnailUrl} alt={course.title} fill className="object-cover" sizes="420px" />
          {/* Price overlay */}
          {(course.pricing === "free" || course.price) && (
            <div className="absolute bottom-3 right-3">
              <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-background/80 text-foreground backdrop-blur-sm border border-border/30">
                {course.pricing === "free" ? "Free" : `$${course.price}`}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Title + Author */}
      <div className="space-y-3">
        <h4 className="text-base font-semibold text-foreground leading-snug">{course.title}</h4>

        {/* Instructor row */}
        {course.instructorName && (
          <div className="flex items-center gap-2.5">
            {course.instructorAvatar ? (
              <div className="relative w-7 h-7 rounded-full overflow-hidden bg-muted shrink-0 ring-1 ring-border/20">
                <Image src={course.instructorAvatar} alt="" fill className="object-cover" sizes="28px" />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-full bg-accent/40 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-foreground/50">
                  {course.instructorName[0]?.toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-sm text-foreground/80">{course.instructorName}</span>
              <span className="text-[11px] text-muted-foreground">Instructor</span>
            </div>
          </div>
        )}
      </div>

      {/* Description */}
      {course.shortDescription && (
        <p className="text-sm text-muted-foreground leading-relaxed">{course.shortDescription}</p>
      )}

      {/* Rating row */}
      {((course.rating ?? 0) > 0 || (course.totalReviews ?? 0) > 0) && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <HugeiconsIcon
                key={s}
                icon={StarIcon}
                size={14}
                className={s <= Math.round(course.rating || 0) ? "text-amber-400 fill-amber-400" : "text-muted-foreground/20"}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            {(course.rating || 0).toFixed(1)} {course.totalReviews ? `(${course.totalReviews})` : ""}
          </span>
        </div>
      )}

      {/* Enrolled progress */}
      {course.isEnrolled && (
        <div className="p-3.5 rounded-xl bg-accent/15 border border-border/20 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Your progress</span>
            <span className="font-semibold text-foreground tabular-nums">{course.enrollmentProgress || 0}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-accent/30 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${course.enrollmentProgress || 0}%` }}
              transition={{ duration: 0.8, ease: "circOut" }}
              className="h-full rounded-full bg-foreground/60"
            />
          </div>
        </div>
      )}

      {/* Meta badges */}
      <div className="flex flex-wrap gap-2">
        {course.totalLessons > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/20 text-xs text-foreground/70">
            <HugeiconsIcon icon={BookOpen01Icon} size={12} /> {course.totalLessons} lessons
          </span>
        )}
        {course.enrolledCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/20 text-xs text-foreground/70">
            <HugeiconsIcon icon={UserGroupIcon} size={12} /> {course.enrolledCount} students
          </span>
        )}
        {course.level && (
          <span className="px-3 py-1.5 rounded-lg bg-accent/20 text-xs text-foreground/70 capitalize">{course.level}</span>
        )}
        {course.category && (
          <span className="px-3 py-1.5 rounded-lg bg-accent/20 text-xs text-foreground/70">{course.category}</span>
        )}
      </div>
    </div>
  )
}

// ──── Enrollment List ────

function EnrollmentList({ data }: { data: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = Array.isArray(data) ? data : (data as any)?.enrollments || []

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="p-4 rounded-2xl bg-accent/20 mb-4">
          <HugeiconsIcon icon={Certificate01Icon} size={28} className="text-muted-foreground/50" />
        </div>
        <p className="text-muted-foreground text-sm">No enrollments found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.slice(0, 12).map((e: EnrollmentItem, i: number) => {
        const pct = e.progress || 0
        const isComplete = pct >= 100
        return (
          <motion.div
            key={e.id || i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="rounded-2xl bg-card/50 border border-border/20 overflow-hidden
                       hover:border-foreground/10 hover:bg-card/70 transition-all duration-200"
          >
            <div className="flex gap-3 p-3.5">
              {/* Course thumbnail */}
              {e.thumbnailUrl ? (
                <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-muted shrink-0">
                  <Image src={e.thumbnailUrl} alt="" fill className="object-cover" sizes="64px" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
                  <HugeiconsIcon icon={TeachingIcon} size={20} className="text-muted-foreground/30" />
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
                  {e.courseTitle}
                </p>

                {/* Instructor */}
                {e.instructorName && (
                  <div className="flex items-center gap-1.5">
                    {e.instructorAvatar ? (
                      <div className="relative w-4 h-4 rounded-full overflow-hidden bg-muted shrink-0">
                        <Image src={e.instructorAvatar} alt="" fill className="object-cover" sizes="16px" />
                      </div>
                    ) : null}
                    <span className="text-[11px] text-muted-foreground truncate">{e.instructorName}</span>
                  </div>
                )}

                {/* Progress */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full bg-accent/30 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.7, ease: "circOut", delay: i * 0.04 + 0.15 }}
                      className={`h-full rounded-full ${isComplete ? "bg-emerald-500/80" : "bg-foreground/50"}`}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 w-8 text-right">
                    {pct}%
                  </span>
                </div>

                {/* Lesson count */}
                {e.completedLessons !== undefined && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    {isComplete && <HugeiconsIcon icon={Tick02Icon} size={10} className="text-emerald-500" />}
                    {e.completedLessons}/{e.totalLessons || "?"} lessons
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

interface EnrollmentItem {
  id?: string
  courseTitle: string
  thumbnailUrl?: string
  instructorName?: string
  instructorAvatar?: string
  progress?: number
  completedLessons?: number
  totalLessons?: number
}

// ──── Meeting List ────

function MeetingList({ data }: { data: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = Array.isArray(data) ? data : (data as any)?.meetings || []

  return (
    <div className="space-y-3">
      {items.slice(0, 10).map((m: MeetingItem, i: number) => (
        <motion.div
          key={m.id || i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          className="flex items-center gap-3 p-3.5 rounded-2xl bg-card/50 border border-border/20
                     hover:border-foreground/10 hover:bg-card/70 transition-all duration-200"
        >
          <div className="p-2 rounded-xl bg-accent/30">
            <HugeiconsIcon icon={UserGroupIcon} size={16} className="text-foreground/70" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{m.title}</p>
            <p className="text-xs text-muted-foreground">
              {m.hostName} · {m.participantCount || 0} participants
            </p>
          </div>
          <span className={`text-[11px] px-2.5 py-1 rounded-lg font-medium ${
            m.status === "active" ? "bg-emerald-500/15 text-emerald-500" :
            m.status === "waiting" ? "bg-amber-500/15 text-amber-500" :
            "bg-accent/30 text-muted-foreground"
          }`}>
            {m.status}
          </span>
        </motion.div>
      ))}
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">No active meetings.</p>
      )}
    </div>
  )
}

interface MeetingItem {
  id?: string
  title: string
  status: string
  hostName?: string
  participantCount?: number
}

// ──── Message List ────

function MessageList({ data }: { data: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = Array.isArray(data) ? data : (data as any)?.conversations || []

  return (
    <div className="space-y-2">
      {items.slice(0, 12).map((c: ConvoItem, i: number) => (
        <motion.div
          key={c.conversationId || i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          className="flex items-center gap-3 p-3 rounded-2xl bg-card/50 border border-border/20
                     hover:border-foreground/10 hover:bg-card/70 transition-all duration-200"
        >
          <div className="relative w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center overflow-hidden shrink-0 ring-1 ring-border/20">
            {c.userAvatar ? (
              <Image src={c.userAvatar} alt="" fill className="object-cover" sizes="36px" />
            ) : (
              <HugeiconsIcon icon={UserIcon} size={20} className="text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{c.userName}</p>
            <p className="text-xs text-muted-foreground truncate">
              {c.isFromMe ? "You: " : ""}{formatCallEvent(c.lastMessage)}
            </p>
          </div>
        </motion.div>
      ))}
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">No conversations.</p>
      )}
    </div>
  )
}

interface ConvoItem {
  conversationId?: string
  userName: string
  userAvatar?: string
  lastMessage?: string
  isFromMe?: boolean
}

/** Parse CALL_EVENT:type:status:duration:callerId into human-readable text */
function formatCallEvent(msg?: string): string {
  if (!msg) return "No messages yet"
  if (!msg.startsWith("CALL_EVENT:")) return msg
  const parts = msg.split(":")
  const callType = parts[1] === "video" ? "Video" : "Voice"
  const status = parts[2] || "completed"
  const dur = parts[3] || "0"
  if (status === "completed" && dur !== "0") return `${callType} call · ${dur}`
  if (status === "missed") return `Missed ${callType.toLowerCase()} call`
  if (status === "declined") return `Declined ${callType.toLowerCase()} call`
  if (status === "failed") return `Failed ${callType.toLowerCase()} call`
  return `${callType} call`
}

// ──── Profile Card ────

function ProfileCard({ data }: { data: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = (data as any)?.profile || data
  if (!p) return null

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center text-center pt-2">
        <div className="relative w-16 h-16 rounded-full bg-accent/20 overflow-hidden mb-3 ring-2 ring-border/15 ring-offset-2 ring-offset-background">
          {p.avatarUrl ? (
            <Image src={p.avatarUrl} alt="" fill className="object-cover" sizes="64px" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <HugeiconsIcon icon={UserIcon} size={28} className="text-muted-foreground/50" />
            </div>
          )}
        </div>
        <p className="text-base font-semibold text-foreground">{p.firstName} {p.lastName}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{p.email}</p>
        {p.role && (
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1.5 px-2.5 py-0.5 rounded-lg bg-accent/25">
            {p.role}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="p-3.5 rounded-2xl bg-accent/15 border border-border/15 text-center">
          <p className="text-xl font-bold text-foreground tabular-nums">{p.activeEnrollments || 0}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Active</p>
        </div>
        <div className="p-3.5 rounded-2xl bg-accent/15 border border-border/15 text-center">
          <p className="text-xl font-bold text-foreground tabular-nums">{p.completedEnrollments || 0}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Completed</p>
        </div>
      </div>
    </div>
  )
}

// ──── Certificate List ────

function CertificateList({ data }: { data: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = Array.isArray(data) ? data : (data as any)?.certificates || []

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No certificates earned yet.</p>
  }

  return (
    <div className="space-y-3">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {items.map((cert: any, i: number) => (
        <motion.div
          key={cert.id || cert._id || i}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className="p-3 rounded-xl bg-card/50 border border-border/30 space-y-2"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <HugeiconsIcon icon={Certificate01Icon} size={16} className="text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {cert.courseTitle || cert.title || "Certificate"}
              </p>
              {cert.issuedAt && (
                <p className="text-xs text-muted-foreground">
                  Issued {new Date(cert.issuedAt).toLocaleDateString()}
                </p>
              )}
            </div>
            {cert.hasSignature && (
              <div className="flex items-center gap-1 text-xs text-green-400">
                <HugeiconsIcon icon={Tick02Icon} size={12} />
                Signed
              </div>
            )}
          </div>
          {cert.certificateUrl && (
            <div className="relative w-full aspect-[1.414] rounded-lg overflow-hidden bg-muted">
              <Image
                src={cert.certificateUrl}
                alt="Certificate"
                fill
                className="object-contain"
                sizes="400px"
              />
            </div>
          )}
        </motion.div>
      ))}
    </div>
  )
}

// ──── Search Results (User Grid) ────

function SearchResultsList({ data }: { data: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = Array.isArray(data) ? data : (data as any)?.users || (data as any)?.results || []

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="p-4 rounded-2xl bg-accent/20 mb-4">
          <HugeiconsIcon icon={Search01Icon} size={28} className="text-muted-foreground/50" />
        </div>
        <p className="text-muted-foreground text-sm">No results found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {items.slice(0, 15).map((user: any, i: number) => (
        <motion.div
          key={user.id || user._id || i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03 }}
          className="flex items-center gap-3 p-3 rounded-2xl bg-card/50 border border-border/20
                     hover:border-foreground/10 hover:bg-card/70 transition-all duration-200"
        >
          <div className="relative w-10 h-10 rounded-full bg-accent/20 overflow-hidden shrink-0 ring-1 ring-border/20">
            {user.avatar || user.avatarUrl ? (
              <Image src={user.avatar || user.avatarUrl} alt="" fill className="object-cover" sizes="40px" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <HugeiconsIcon icon={UserIcon} size={18} className="text-muted-foreground/50" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || "User"}
            </p>
            {(user.email || user.role) && (
              <p className="text-[11px] text-muted-foreground truncate">
                {user.role ? <span className="capitalize">{user.role}</span> : null}
                {user.role && user.email ? " · " : ""}
                {user.email}
              </p>
            )}
          </div>
          <HugeiconsIcon icon={ArrowRight01Icon} size={14} className="text-muted-foreground/30 shrink-0" />
        </motion.div>
      ))}
    </div>
  )
}

// ──── Generic Data ────

function GenericData({ data }: { data: unknown }) {
  if (!data) return <p className="text-sm text-muted-foreground">No data.</p>
  return (
    <pre className="text-xs text-muted-foreground bg-accent/10 p-4 rounded-2xl overflow-auto max-h-80 border border-border/20">
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}
