"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Search01Icon,
  Home01Icon,
  BookOpen01Icon,
  Bookmark01Icon,
  UserIcon,
  Settings01Icon,
  Logout01Icon,
  Sun03Icon,
  Moon02Icon,
  Analytics01Icon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import { fetchBrowseCourses, type BrowseCourse } from "@/lib/actions/student"

/* ── Types ────────────────────────────────────────────── */
type CommandItem = {
  id: string
  label: string
  description?: string
  icon: IconSvgElement
  thumbnail?: string | null
  action: () => void
  section: "courses" | "pages" | "tools"
}

/* ── Pages & tools factory ────────────────────────────── */
function useCommandItems(courses: BrowseCourse[]) {
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()

  const pages: CommandItem[] = [
    {
      id: "page-dashboard",
      label: "Dashboard",
      description: "Go to your dashboard",
      icon: Home01Icon,
      action: () => router.push("/dashboard"),
      section: "pages",
    },
    {
      id: "page-my-courses",
      label: "My Courses",
      description: "View enrolled courses",
      icon: BookOpen01Icon,
      action: () => router.push("/dashboard/my-courses"),
      section: "pages",
    },
    {
      id: "page-browse",
      label: "Browse Courses",
      description: "Explore the course catalog",
      icon: Search01Icon,
      action: () => router.push("/dashboard/courses"),
      section: "pages",
    },
    {
      id: "page-bookmarks",
      label: "Bookmarks",
      description: "Your saved courses",
      icon: Bookmark01Icon,
      action: () => router.push("/dashboard/bookmarks"),
      section: "pages",
    },
    {
      id: "page-profile",
      label: "Profile",
      description: "View your profile",
      icon: UserIcon,
      action: () => router.push("/dashboard/profile"),
      section: "pages",
    },
    {
      id: "page-settings",
      label: "Settings",
      description: "Account settings",
      icon: Settings01Icon,
      action: () => router.push("/dashboard/settings"),
      section: "pages",
    },
    {
      id: "page-instructor",
      label: "Instructor Dashboard",
      description: "Switch to instructor view",
      icon: Analytics01Icon,
      action: () => router.push("/instructor"),
      section: "pages",
    },
  ]

  const tools: CommandItem[] = [
    {
      id: "tool-dark-mode",
      label: resolvedTheme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode",
      description: "Toggle color theme",
      icon: resolvedTheme === "dark" ? Sun03Icon : Moon02Icon,
      action: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
      section: "tools",
    },
    {
      id: "tool-logout",
      label: "Log Out",
      description: "Sign out of your account",
      icon: Logout01Icon,
      action: () => {
        // TODO: implement real logout
        router.push("/")
      },
      section: "tools",
    },
  ]

  const courseItems: CommandItem[] = courses.slice(0, 8).map((c) => ({
    id: `course-${c.id}`,
    label: c.title,
    description: `${c.instructorName} · ${c.totalLessons} lessons`,
    icon: BookOpen01Icon,
    thumbnail: c.thumbnailUrl,
    action: () => router.push(`/dashboard/courses/${c.id}`),
    section: "courses" as const,
  }))

  return [...courseItems, ...pages, ...tools]
}

/* ── Shared results list ─────────────────────────────── */
function CommandList({
  items,
  query,
  activeIndex,
  setActiveIndex,
  onSelect,
  listRef,
}: {
  items: CommandItem[]
  query: string
  activeIndex: number
  setActiveIndex: (i: number) => void
  onSelect: (item: CommandItem) => void
  listRef: React.RefObject<HTMLDivElement | null>
}) {
  const sections = React.useMemo(() => {
    const map = new Map<string, CommandItem[]>()
    for (const item of items) {
      const arr = map.get(item.section) ?? []
      arr.push(item)
      map.set(item.section, arr)
    }
    return map
  }, [items])

  const sectionLabels: Record<string, string> = {
    courses: "Courses",
    pages: "Pages",
    tools: "Tools",
  }

  let globalIndex = -1

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground">
        <p>No results found</p>
        {query && <p className="text-xs mt-1">Try a different search term</p>}
      </div>
    )
  }

  return (
    <div ref={listRef} className="overflow-y-auto overscroll-contain">
      {Array.from(sections.entries()).map(([section, sectionItems]) => (
        <div key={section} className="px-2 py-1.5">
          <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {sectionLabels[section] ?? section}
          </p>
          {sectionItems.map((item) => {
            globalIndex++
            const idx = globalIndex
            const isActive = idx === activeIndex
            return (
              <button
                key={item.id}
                type="button"
                data-active={isActive}
                onClick={() => onSelect(item)}
                onMouseEnter={() => setActiveIndex(idx)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-muted/60"
                }`}
              >
                {item.thumbnail ? (
                  <div className="relative h-8 w-12 rounded-md bg-muted overflow-hidden shrink-0">
                    <Image
                      src={item.thumbnail}
                      alt={item.label}
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  </div>
                ) : (
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      isActive ? "bg-primary/15" : "bg-muted/60"
                    }`}
                  >
                    <HugeiconsIcon
                      icon={item.icon}
                      size={16}
                      className={isActive ? "text-primary" : "text-muted-foreground"}
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-[13px]">{item.label}</p>
                  {item.description && (
                    <p className="text-[11px] text-muted-foreground truncate">
                      {item.description}
                    </p>
                  )}
                </div>
                {isActive && (
                  <kbd className="text-[10px] text-muted-foreground hidden sm:inline">↵</kbd>
                )}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/* ── Shared search input ─────────────────────────────── */
function SearchInput({
  inputRef,
  query,
  onQueryChange,
  onKeyDown,
  showEsc,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>
  query: string
  onQueryChange: (v: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  showEsc?: boolean
}) {
  return (
    <div className="flex items-center gap-3 border-b px-4 py-3">
      <HugeiconsIcon icon={Search01Icon} size={18} className="text-muted-foreground shrink-0" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Search courses, pages, tools…"
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      {showEsc && (
        <kbd className="hidden sm:inline-flex items-center rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
          ESC
        </kbd>
      )}
    </div>
  )
}

/* ── Detect mobile ───────────────────────────────────── */
function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false)
  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])
  return isMobile
}

/* ── Main Component ──────────────────────────────────── */
export function CommandSearch() {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [courses, setCourses] = React.useState<BrowseCourse[]>([])
  const listRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const isMobile = useIsMobile()

  // Load courses when component mounts
  React.useEffect(() => {
    fetchBrowseCourses().then(setCourses).catch(console.error)
  }, [])

  const items = useCommandItems(courses)

  const filtered = React.useMemo(() => {
    if (!query.trim()) return items
    const q = query.toLowerCase()
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q)
    )
  }, [items, query])

  // Keyboard shortcut
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  // Reset on open
  React.useEffect(() => {
    if (open) {
      setQuery("")
      setActiveIndex(0)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  // Scroll active into view
  React.useEffect(() => {
    const active = listRef.current?.querySelector("[data-active='true']")
    active?.scrollIntoView({ block: "nearest" })
  }, [activeIndex])

  function runItem(item: CommandItem) {
    setOpen(false)
    item.action()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % filtered.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length)
    } else if (e.key === "Enter" && filtered[activeIndex]) {
      e.preventDefault()
      runItem(filtered[activeIndex])
    }
  }

  function handleQueryChange(v: string) {
    setQuery(v)
    setActiveIndex(0)
  }

  // Mobile: bottom sheet drawer
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" showCloseButton={false} className="p-0 gap-0 rounded-t-2xl max-h-[85vh] flex flex-col">
          <SheetTitle className="sr-only">Search</SheetTitle>

          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="h-1 w-8 rounded-full bg-muted-foreground/30" />
          </div>

          <SearchInput
            inputRef={inputRef}
            query={query}
            onQueryChange={handleQueryChange}
            onKeyDown={handleKeyDown}
          />

          <div className="flex-1 overflow-y-auto max-h-[60vh]">
            <CommandList
              items={filtered}
              query={query}
              activeIndex={activeIndex}
              setActiveIndex={setActiveIndex}
              onSelect={runItem}
              listRef={listRef}
            />
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  // Desktop: centered dialog
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-lg p-0 gap-0 overflow-hidden"
      >
        <DialogTitle className="sr-only">Search</DialogTitle>

        <SearchInput
          inputRef={inputRef}
          query={query}
          onQueryChange={handleQueryChange}
          onKeyDown={handleKeyDown}
          showEsc
        />

        <div className="max-h-80 overflow-hidden">
          <CommandList
            items={filtered}
            query={query}
            activeIndex={activeIndex}
            setActiveIndex={setActiveIndex}
            onSelect={runItem}
            listRef={listRef}
          />
        </div>

        {/* Footer hint */}
        <div className="border-t px-4 py-2 flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1 py-0.5 font-mono">↑↓</kbd>
            navigate
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1 py-0.5 font-mono">↵</kbd>
            select
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1 py-0.5 font-mono">esc</kbd>
            close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
