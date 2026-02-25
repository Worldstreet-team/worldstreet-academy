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
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-white/10">
          <HugeiconsIcon icon={icon} size={16} className="text-foreground/80" />
        </div>
        <h3 className="text-lg font-semibold text-foreground capitalize">
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
    case "search-results":
      return <CourseGrid data={data} />
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
  const items = Array.isArray(data) ? data : (data as any)?.courses || []

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="p-3 rounded-full bg-muted/40 mb-3">
          <HugeiconsIcon icon={TeachingIcon} size={24} className="text-muted-foreground" />
        </div>
        <p className="text-muted-foreground text-sm">No courses found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((course: CourseItem, i: number) => (
        <motion.div
          key={course.id || i}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06, type: "spring", stiffness: 300, damping: 25 }}
          className="rounded-xl bg-card/60 border border-border/30
                     hover:border-foreground/15 hover:bg-card/80 transition-all duration-200
                     group cursor-pointer overflow-hidden"
        >
          {/* Thumbnail banner */}
          {course.thumbnailUrl ? (
            <div className="relative w-full aspect-[16/8] bg-muted overflow-hidden">
              <Image
                src={course.thumbnailUrl}
                alt={course.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
                sizes="400px"
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              {/* Price badge */}
              <div className="absolute top-2 right-2">
                {course.pricing === "free" ? (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/90 text-white backdrop-blur-sm">
                    Free
                  </span>
                ) : course.price ? (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-black/60 text-white backdrop-blur-sm">
                    ${course.price}
                  </span>
                ) : null}
              </div>
              {/* Level badge */}
              {course.level && (
                <div className="absolute top-2 left-2">
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-black/50 text-white/90 backdrop-blur-sm capitalize">
                    {course.level}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-20 bg-gradient-to-r from-muted/60 to-muted/30 flex items-center justify-center">
              <HugeiconsIcon icon={TeachingIcon} size={28} className="text-muted-foreground/40" />
            </div>
          )}

          {/* Content */}
          <div className="p-3 space-y-2">
            <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-foreground/80 transition-colors">
              {course.title}
            </p>

            {/* Short description */}
            {course.shortDescription && (
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                {course.shortDescription}
              </p>
            )}

            {/* Author + meta row */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1.5 min-w-0">
                {course.instructorAvatar ? (
                  <div className="relative w-5 h-5 rounded-full overflow-hidden bg-muted shrink-0">
                    <Image src={course.instructorAvatar} alt="" fill className="object-cover" sizes="20px" />
                  </div>
                ) : course.instructorName ? (
                  <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-bold text-muted-foreground">
                      {course.instructorName[0]?.toUpperCase()}
                    </span>
                  </div>
                ) : null}
                {course.instructorName && (
                  <span className="text-xs text-muted-foreground truncate">{course.instructorName}</span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {(course.rating ?? 0) > 0 && (
                  <span className="text-xs text-amber-400 flex items-center gap-0.5">
                    <HugeiconsIcon icon={StarIcon} size={11} className="fill-current" />
                    {(course.rating ?? 0).toFixed(1)}
                  </span>
                )}
                {(course.totalLessons ?? 0) > 0 && (
                  <span className="text-[11px] text-muted-foreground">
                    {course.totalLessons} lessons
                  </span>
                )}
                {(course.enrolledCount ?? 0) > 0 && (
                  <span className="text-[11px] text-muted-foreground">
                    {course.enrolledCount! > 999
                      ? `${(course.enrolledCount! / 1000).toFixed(1)}k`
                      : course.enrolledCount} students
                  </span>
                )}
              </div>
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
}

// ──── Course Detail ────

function CourseDetail({ data }: { data: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const course = (data as any)?.course || data
  if (!course) return null

  return (
    <div className="space-y-4">
      {course.thumbnailUrl && (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-muted">
          <Image src={course.thumbnailUrl} alt={course.title} fill className="object-cover" sizes="420px" />
        </div>
      )}
      <div>
        <h4 className="text-base font-semibold">{course.title}</h4>
        {course.instructorName && (
          <p className="text-sm text-muted-foreground mt-1">by {course.instructorName}</p>
        )}
      </div>
      {course.shortDescription && (
        <p className="text-sm text-muted-foreground leading-relaxed">{course.shortDescription}</p>
      )}
      <div className="flex flex-wrap gap-3 text-xs">
        {course.totalLessons > 0 && (
          <span className="px-2 py-1 rounded-md bg-accent/50">{course.totalLessons} lessons</span>
        )}
        {course.enrolledCount > 0 && (
          <span className="px-2 py-1 rounded-md bg-accent/50">{course.enrolledCount} students</span>
        )}
        {course.level && (
          <span className="px-2 py-1 rounded-md bg-accent/50 capitalize">{course.level}</span>
        )}
        {course.isEnrolled && (
          <span className="px-2 py-1 rounded-md bg-white/10 text-foreground/80">
            Enrolled · {course.enrollmentProgress || 0}%
          </span>
        )}
      </div>
    </div>
  )
}

// ──── Enrollment List ────

function EnrollmentList({ data }: { data: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = Array.isArray(data) ? data : (data as any)?.enrollments || []

  return (
    <div className="space-y-3">
      {items.map((e: EnrollmentItem, i: number) => (
        <motion.div
          key={e.id || i}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className="p-3 rounded-xl bg-card/50 border border-border/30 space-y-2"
        >
          <p className="text-sm font-medium text-foreground truncate">{e.courseTitle}</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${e.progress || 0}%` }}
                transition={{ duration: 0.6, ease: "circOut" }}
                className="h-full rounded-full bg-foreground/70"
              />
            </div>
            <span className="text-xs text-muted-foreground shrink-0">{e.progress || 0}%</span>
          </div>
          {e.completedLessons !== undefined && (
            <p className="text-xs text-muted-foreground">
              {e.completedLessons}/{e.totalLessons || "?"} lessons
            </p>
          )}
        </motion.div>
      ))}
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">No enrollments found.</p>
      )}
    </div>
  )
}

interface EnrollmentItem {
  id?: string
  courseTitle: string
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
      {items.map((m: MeetingItem, i: number) => (
        <motion.div
          key={m.id || i}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className="flex items-center gap-3 p-3 rounded-xl bg-card/50 border border-border/30"
        >
          <div className="p-2 rounded-lg bg-white/10">
            <HugeiconsIcon icon={UserGroupIcon} size={16} className="text-foreground/80" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{m.title}</p>
            <p className="text-xs text-muted-foreground">
              {m.hostName} · {m.participantCount || 0} participants
            </p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            m.status === "active" ? "bg-green-500/20 text-green-400" :
            m.status === "waiting" ? "bg-amber-500/20 text-amber-400" :
            "bg-muted text-muted-foreground"
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
    <div className="space-y-3">
      {items.map((c: ConvoItem, i: number) => (
        <motion.div
          key={c.conversationId || i}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className="flex items-center gap-3 p-3 rounded-xl bg-card/50 border border-border/30"
        >
          <div className="relative w-9 h-9 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
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
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative w-14 h-14 rounded-full bg-muted overflow-hidden">
          {p.avatarUrl ? (
            <Image src={p.avatarUrl} alt="" fill className="object-cover" sizes="56px" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <HugeiconsIcon icon={UserIcon} size={28} className="text-muted-foreground" />
            </div>
          )}
        </div>
        <div>
          <p className="font-medium">{p.firstName} {p.lastName}</p>
          <p className="text-sm text-muted-foreground">{p.email}</p>
          <p className="text-xs text-foreground/60 capitalize mt-0.5">{p.role}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-accent/30 text-center">
          <p className="text-lg font-bold text-foreground">{p.activeEnrollments || 0}</p>
          <p className="text-xs text-muted-foreground">Active</p>
        </div>
        <div className="p-3 rounded-xl bg-accent/30 text-center">
          <p className="text-lg font-bold text-foreground">{p.completedEnrollments || 0}</p>
          <p className="text-xs text-muted-foreground">Completed</p>
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

// ──── Generic Data ────

function GenericData({ data }: { data: unknown }) {
  if (!data) return <p className="text-sm text-muted-foreground">No data.</p>
  return (
    <pre className="text-xs text-muted-foreground bg-muted/20 p-3 rounded-lg overflow-auto max-h-80">
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}
