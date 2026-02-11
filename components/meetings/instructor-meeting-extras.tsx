"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import Image from "next/image"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Copy01Icon,
  Search01Icon,
  Loading03Icon,
  CheckmarkCircle01Icon,
  UserIcon,
  Video01Icon,
  UserGroupIcon,
  Calendar03Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

import {
  inviteByEmail,
  searchUsersByEmail,
  type InviteResult,
} from "@/lib/actions/meetings"

/* ═══════════════════════════════════════════════════════════
   INSTRUCTOR INVITE DIALOG
   Unique invite modal for instructors:
   1. Meeting link field (read-only + copy)
   2. Search by email + send invite
   ═══════════════════════════════════════════════════════════ */

type InvitedUser = {
  email: string
  name: string
  status: "inviting" | "invited" | "already_in_call" | "error"
}

type SearchResult = {
  id: string
  email: string
  name: string
  avatar: string | null
  status: "available" | "already_in_call" | "invited"
}

export function InstructorInviteDialog({
  open,
  onOpenChange,
  meetingId,
  meetingLink,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  meetingId: string
  meetingLink: string
}) {
  const [copiedLink, setCopiedLink] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [invitedUsers, setInvitedUsers] = useState<Map<string, InvitedUser>>(new Map())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function copyLink() {
    navigator.clipboard.writeText(meetingLink)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleSearch = useCallback(
    async (query: string) => {
      if (query.length < 3) {
        setSearchResults([])
        return
      }
      setIsSearching(true)
      const result = await searchUsersByEmail(query, meetingId)
      if (result.success && result.users) {
        // Merge local invite state with server state
        setSearchResults(
          result.users.map((u) => {
            const local = invitedUsers.get(u.email)
            if (local?.status === "invited") return { ...u, status: "invited" as const }
            if (local?.status === "already_in_call") return { ...u, status: "already_in_call" as const }
            return u
          })
        )
      }
      setIsSearching(false)
    },
    [meetingId, invitedUsers]
  )

  function handleSearchInput(value: string) {
    setSearchQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => handleSearch(value), 400)
  }

  async function handleInvite(email: string, name: string) {
    // Show inviting state
    setInvitedUsers((prev) => {
      const next = new Map(prev)
      next.set(email, { email, name, status: "inviting" })
      return next
    })

    // Update search results to show inviting
    setSearchResults((prev) =>
      prev.map((u) => (u.email === email ? { ...u, status: "invited" as const } : u))
    )

    const result: InviteResult = await inviteByEmail(meetingId, email)

    setInvitedUsers((prev) => {
      const next = new Map(prev)
      if (result.status === "already_in_call") {
        next.set(email, { email, name: result.userName || name, status: "already_in_call" })
      } else if (result.success) {
        next.set(email, { email, name: result.userName || name, status: "invited" })
      } else {
        next.set(email, { email, name, status: "error" })
      }
      return next
    })

    // Update search results with final status
    setSearchResults((prev) =>
      prev.map((u) => {
        if (u.email !== email) return u
        if (result.status === "already_in_call") return { ...u, status: "already_in_call" as const }
        return { ...u, status: "invited" as const }
      })
    )
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setSearchQuery("")
      setSearchResults([])
    }
    onOpenChange(nextOpen)
  }

  return (
    open ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => handleOpenChange(false)} />
        <div className="relative w-full max-w-sm mx-4 bg-card border border-border/50 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-1 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-muted/60 flex items-center justify-center">
                <HugeiconsIcon icon={UserGroupIcon} size={17} className="text-foreground" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">Invite People</h2>
            </div>
            <button
              onClick={() => handleOpenChange(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted/80 transition-colors"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={16} className="text-muted-foreground" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 pb-5 pt-3 space-y-4 overflow-y-auto">
            {/* Meeting Link */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground">Meeting Link</label>
              <div className="relative">
                <Input
                  value={meetingLink}
                  readOnly
                  className="h-9 pr-9 text-xs bg-muted/20 border-border/30 text-foreground/60 select-all cursor-text"
                />
                <button
                  onClick={copyLink}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <HugeiconsIcon
                    icon={copiedLink ? CheckmarkCircle01Icon : Copy01Icon}
                    size={13}
                    className={copiedLink ? "text-emerald-500" : "text-muted-foreground/60"}
                  />
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground">Invite by Email</label>
              <div className="relative">
                <HugeiconsIcon
                  icon={Search01Icon}
                  size={13}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40"
                />
                <Input
                  placeholder="Search by email..."
                  value={searchQuery}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  className="h-9 pl-8 text-xs bg-muted/20 border-border/30"
                  autoComplete="off"
                />
                {isSearching && (
                  <HugeiconsIcon
                    icon={Loading03Icon}
                    size={13}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin"
                  />
                )}
              </div>

              {/* Results */}
              {searchResults.length > 0 && (
                <div className="rounded-xl bg-muted/20 overflow-hidden">
                  {searchResults.map((user, i) => {
                    const localState = invitedUsers.get(user.email)
                    const isInviting = localState?.status === "inviting"
                    const isInvited = user.status === "invited" || localState?.status === "invited"
                    const isInCall = user.status === "already_in_call" || localState?.status === "already_in_call"

                    return (
                      <div
                        key={user.id}
                        className={`flex items-center gap-2.5 px-3 py-2 ${i > 0 ? "border-t border-border/20" : ""}`}
                      >
                        <Avatar className="w-7 h-7 shrink-0">
                          {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
                          <AvatarFallback className="text-[9px] font-medium bg-muted text-muted-foreground">
                            {user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium truncate">{user.name}</p>
                          <p className="text-[10px] text-muted-foreground/50 truncate">{user.email}</p>
                        </div>

                        {isInCall ? (
                          <span className="text-[10px] font-medium text-emerald-500 shrink-0">In call</span>
                        ) : isInviting ? (
                          <HugeiconsIcon icon={Loading03Icon} size={12} className="text-muted-foreground animate-spin shrink-0" />
                        ) : isInvited ? (
                          <HugeiconsIcon icon={CheckmarkCircle01Icon} size={12} className="text-emerald-500 shrink-0" />
                        ) : (
                          <button
                            onClick={() => handleInvite(user.email, user.name)}
                            className="h-6 px-2.5 rounded-md text-[10px] font-medium bg-foreground text-background hover:opacity-90 transition-opacity shrink-0"
                          >
                            Invite
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {searchQuery.length >= 3 && !isSearching && searchResults.length === 0 && (
                <p className="text-center py-3 text-[11px] text-muted-foreground/50">No users found</p>
              )}
            </div>

            {/* Sent Invites */}
            {invitedUsers.size > 0 && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Sent ({invitedUsers.size})
                </label>
                <div className="space-y-0.5 max-h-28 overflow-y-auto">
                  {Array.from(invitedUsers.values()).map((inv) => (
                    <div key={inv.email} className="flex items-center gap-2 px-2 py-1.5 rounded-lg">
                      <div className="w-4 h-4 rounded-full bg-muted/40 flex items-center justify-center shrink-0">
                        <HugeiconsIcon icon={UserIcon} size={8} className="text-muted-foreground/50" />
                      </div>
                      <span className="text-[11px] font-medium truncate flex-1">{inv.name}</span>
                      {inv.status === "inviting" && <HugeiconsIcon icon={Loading03Icon} size={10} className="text-muted-foreground animate-spin shrink-0" />}
                      {inv.status === "invited" && <HugeiconsIcon icon={CheckmarkCircle01Icon} size={10} className="text-emerald-500 shrink-0" />}
                      {inv.status === "already_in_call" && <span className="text-[9px] text-emerald-500 shrink-0">In call</span>}
                      {inv.status === "error" && <span className="text-[9px] text-red-400 shrink-0">Failed</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    ) : null
  )
}

/* ═══════════════════════════════════════════════════════════
   INSTRUCTOR COURSE MEETING CARDS
   Shows published courses with Start Meeting CTA
   ═══════════════════════════════════════════════════════════ */

export type CourseSummary = {
  id: string
  title: string
  thumbnailUrl: string | null
  enrolledCount: number
}

export function CourseMeetingCards({
  courses,
  isLoading,
  onStartMeeting,
}: {
  courses: CourseSummary[]
  isLoading: boolean
  onStartMeeting: (course: CourseSummary) => void
}) {
  const [openPopover, setOpenPopover] = useState<string | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)

  // Close popover on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpenPopover(null)
      }
    }
    if (openPopover) {
      document.addEventListener("mousedown", handleClick)
      return () => document.removeEventListener("mousedown", handleClick)
    }
  }, [openPopover])

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-56 rounded-2xl bg-muted/40 animate-pulse" />
        ))}
      </div>
    )
  }

  if (courses.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Your Courses</h2>
        <span className="text-[11px] text-muted-foreground/60">
          Start a session for your students
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {courses.map((course) => (
          <div
            key={course.id}
            className="group relative rounded-2xl border border-border/40 bg-card overflow-hidden hover:border-border/80 hover:shadow-sm transition-all"
          >
            {/* Thumbnail — 60% longer */}
            <div className="relative h-56 bg-muted/30">
              {course.thumbnailUrl ? (
                <Image
                  src={course.thumbnailUrl}
                  alt={course.title}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <HugeiconsIcon icon={Video01Icon} size={28} className="text-muted-foreground/30" />
                </div>
              )}

              {/* Glassmorphic overlay */}
              <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/60 via-black/30 to-transparent">
                <div className="flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-[13px] font-semibold text-white truncate drop-shadow-sm">{course.title}</h3>
                    <div className="flex items-center gap-1 mt-0.5">
                      <HugeiconsIcon icon={UserGroupIcon} size={10} className="text-white/70" />
                      <span className="text-[10px] text-white/70 font-medium">{course.enrolledCount} enrolled</span>
                    </div>
                  </div>

                  {/* Start Call with popover */}
                  <div className="relative shrink-0" ref={openPopover === course.id ? popoverRef : null}>
                    <button
                      onClick={() => setOpenPopover(openPopover === course.id ? null : course.id)}
                      className="flex items-center gap-1.5 h-8 px-3.5 rounded-xl text-[11px] font-semibold text-white bg-white/20 backdrop-blur-md border border-white/20 hover:bg-white/30 transition-all shadow-lg"
                    >
                      <HugeiconsIcon icon={Video01Icon} size={13} />
                      Start Call
                    </button>

                    {/* Glassmorphic popover */}
                    {openPopover === course.id && (
                      <div className="absolute bottom-full right-0 mb-2 w-44 rounded-xl bg-white/15 backdrop-blur-xl border border-white/20 shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                        <button
                          onClick={() => {
                            setOpenPopover(null)
                            onStartMeeting(course)
                          }}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[12px] font-medium text-white hover:bg-white/15 transition-colors"
                        >
                          <HugeiconsIcon icon={Video01Icon} size={14} />
                          Instant Meeting
                        </button>
                        <div className="h-px bg-white/10" />
                        <button
                          onClick={() => {
                            setOpenPopover(null)
                            // For now, same as instant — can extend with scheduling logic
                            onStartMeeting(course)
                          }}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[12px] font-medium text-white hover:bg-white/15 transition-colors"
                        >
                          <HugeiconsIcon icon={Calendar03Icon} size={14} />
                          Schedule Call
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   CREATE COURSE MEETING MODAL
   Prefilled title from course, editable
   ═══════════════════════════════════════════════════════════ */

export function CreateCourseMeetingModal({
  open,
  onOpenChange,
  course,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  course: CourseSummary | null
  onCreate: (courseId: string, title: string) => void
}) {
  const [title, setTitle] = useState(course ? `${course.title} — Session` : "")
  const [isCreating, setIsCreating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open && course) {
      setTimeout(() => {
        setTitle(`${course.title} — Session`)
        inputRef.current?.focus()
      }, 100)
    }
  }, [open, course])

  async function handleCreate() {
    if (!title.trim() || !course) return
    setIsCreating(true)
    onCreate(course.id, title.trim())
    setIsCreating(false)
  }

  if (!course || !open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className="relative w-full max-w-sm mx-4 bg-card border border-border/50 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <HugeiconsIcon icon={Video01Icon} size={17} className="text-emerald-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Start Session</h2>
              <p className="text-[11px] text-muted-foreground">
                {course.enrolledCount} student{course.enrolledCount !== 1 ? "s" : ""} will be notified
              </p>
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted/80 transition-colors"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pb-5 pt-3 space-y-3">
          {course.thumbnailUrl && (
            <div className="relative h-28 rounded-xl overflow-hidden">
              <Image src={course.thumbnailUrl} alt={course.title} fill className="object-cover" />
            </div>
          )}

          <Input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            className="h-10 text-sm bg-muted/30 border-border/40 focus-visible:ring-1 focus-visible:ring-emerald-500/30"
          />

          <Button
            onClick={handleCreate}
            disabled={!title.trim() || isCreating}
            className="w-full gap-2 h-10 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl"
          >
            {isCreating ? (
              <>
                <HugeiconsIcon icon={Loading03Icon} size={15} className="animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <HugeiconsIcon icon={Video01Icon} size={15} />
                Start &amp; Notify Students
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
