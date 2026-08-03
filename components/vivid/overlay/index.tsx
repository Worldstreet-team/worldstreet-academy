"use client"

/**
 * Vivid Overlay — Modular side panel for displaying data.
 * Each section has its own component file for independent maintenance.
 */

import { motion, AnimatePresence } from "motion/react"
import type { OverlayPanel, OverlaySection } from "@/lib/vivid/types"

import { CourseGrid } from "./course-grid"
import { CourseDetail } from "./course-detail"
import { EnrollmentList } from "./enrollment-list"
import { MeetingList } from "./meeting-list"
import { MessageList } from "./message-list"
import { ProfileCard } from "./profile-card"
import { CertificateList } from "./certificate-list"
import { SearchResultsList } from "./search-results"
import { GenericData } from "./generic-data"
import { FileBadgeIcon, GraduationCapIcon, MessageCircleIcon, SearchIcon, UserIcon, UsersIcon } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { RenderIcon } from "@/components/shared/render-icon"

// ============================================================================
// Constants
// ============================================================================

const SECTION_ICONS: Record<OverlaySection, LucideIcon> = {
  courses: GraduationCapIcon,
  meetings: UsersIcon,
  messages: MessageCircleIcon,
  enrollments: FileBadgeIcon,
  "course-detail": GraduationCapIcon,
  profile: UserIcon,
  "search-results": SearchIcon,
  certificates: FileBadgeIcon,
}

// ============================================================================
// Panel View
// ============================================================================

export function OverlayPanelView({ panel }: { panel: OverlayPanel }) {
  const icon = SECTION_ICONS[panel.section] || GraduationCapIcon

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-accent/30">
          <RenderIcon icon={icon}  size={16} className="text-foreground/70" />
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
          transition={{ duration: 0.32, ease: [0.2, 0, 0, 1] }}
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
          className="p-3 rounded-lg bg-card/40 border border-ws-hairline space-y-2"
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
