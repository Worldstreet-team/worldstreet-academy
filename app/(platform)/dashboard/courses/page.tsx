"use client"

import { useState, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, FilterIcon } from "@hugeicons/core-free-icons"
import { Topbar } from "@/components/platform/topbar"
import { CourseGrid } from "@/components/courses/course-grid"
import { CourseGridSkeleton } from "@/components/skeletons/course-skeletons"
import { type BrowseCourse } from "@/lib/actions/student"
import { useBrowseCourses } from "@/lib/hooks/queries"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const SEARCH_PLACEHOLDERS = [
  "Learn about DeFi yield strategies…",
  "How to read candlestick charts?",
  "Introduction to blockchain consensus",
  "Master technical analysis patterns",
  "What is an NFT smart contract?",
  "Risk management for crypto portfolios",
]

const LEVEL_TABS = ["All", "Beginner", "Intermediate", "Advanced"] as const
type Level = (typeof LEVEL_TABS)[number]

const PRICE_FILTERS = ["All", "Free", "Paid"] as const
type PriceFilter = (typeof PRICE_FILTERS)[number]

export default function BrowseCoursesPage() {
  const [search, setSearch] = useState("")
  const [activeLevel, setActiveLevel] = useState<Level>("All")
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("All")

  const filters = useMemo(() => ({
    level: activeLevel,
    pricing: priceFilter,
  }), [activeLevel, priceFilter])

  const { data: courses = [], isLoading } = useBrowseCourses(filters)

  const filtered = useMemo(() => {
    if (!search.trim()) return courses

    const q = search.toLowerCase()
    return courses.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.instructorName.toLowerCase().includes(q) ||
        c.level.toLowerCase().includes(q)
    )
  }, [search, courses])

  return (
    <>
      <Topbar title="Browse Courses" />
      <div className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 pb-24 md:pb-8">
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Browse Courses</h1>
            <p className="text-muted-foreground mt-1">
              Explore our catalog of courses across crypto, trading, and blockchain.
            </p>
          </div>

          {/* Search + Filter row */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <HugeiconsIcon
                icon={Search01Icon}
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-50"
              />
              <PlaceholdersAndVanishInput
                placeholders={SEARCH_PLACEHOLDERS}
                onChange={(e) => setSearch(e.target.value)}
                onSubmit={(e) => e.preventDefault()}
                className="max-w-none mx-0 rounded-lg h-10 bg-muted/40 border-border shadow-none"
                inputClassName="pl-9 pr-3 rounded-lg"
                placeholderClassName="pl-9"
                hideSubmitButton
              />
            </div>
            <Popover>
              <PopoverTrigger
                className="shrink-0 h-10 px-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <HugeiconsIcon icon={FilterIcon} size={16} className="text-muted-foreground" />
                Filters
                {(activeLevel !== "All" || priceFilter !== "All") && (
                  <Badge className="h-4 w-4 p-0 text-[9px] flex items-center justify-center">
                    {(activeLevel !== "All" ? 1 : 0) + (priceFilter !== "All" ? 1 : 0)}
                  </Badge>
                )}
              </PopoverTrigger>
              <PopoverContent side="bottom" align="end" className="p-4 w-64">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Level</p>
                    <div className="flex flex-wrap gap-1.5">
                      {LEVEL_TABS.map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setActiveLevel(level)}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
                            activeLevel === level
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          )}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Price</p>
                    <div className="flex gap-1.5">
                      {PRICE_FILTERS.map((pf) => (
                        <button
                          key={pf}
                          type="button"
                          onClick={() => setPriceFilter(pf)}
                          className={cn(
                            "flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                            priceFilter === pf
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          )}
                        >
                          {pf}
                        </button>
                      ))}
                    </div>
                  </div>
                  {(activeLevel !== "All" || priceFilter !== "All") && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setActiveLevel("All")
                        setPriceFilter("All")
                      }}
                    >
                      Clear filters
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Search results with thumbnails (when searching) */}
        {isLoading ? (
          <CourseGridSkeleton count={9} />
        ) : search.trim() && filtered.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {filtered.length} result{filtered.length !== 1 ? "s" : ""} for &quot;{search}&quot;
            </p>
            <div className="space-y-1">
              {filtered.slice(0, 6).map((course) => (
                <Link
                  key={course.id}
                  href={`/dashboard/courses/${course.id}`}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="relative h-10 w-16 rounded-md bg-muted overflow-hidden shrink-0">
                    {course.thumbnailUrl ? (
                      <Image
                        src={course.thumbnailUrl}
                        alt={course.title}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[8px] text-muted-foreground/40">No img</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{course.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {course.instructorName} · {course.totalLessons} lessons · <span className="capitalize">{course.level}</span>
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] capitalize shrink-0">
                    {course.level}
                  </Badge>
                </Link>
              ))}
            </div>
            {filtered.length > 6 && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                Showing 6 of {filtered.length} results
              </p>
            )}
            <div className="border-t pt-4">
              <CourseGrid courses={filtered as unknown as Parameters<typeof CourseGrid>[0]["courses"]} />
            </div>
          </div>
        ) : filtered.length === 0 && search.trim() ? (
          <div className="flex flex-col items-center justify-center py-16 text-sm text-muted-foreground">
            <p>No courses match &quot;{search}&quot;</p>
            <button
              type="button"
              onClick={() => setSearch("")}
              className="text-primary text-xs mt-1 hover:underline"
            >
              Clear search
            </button>
          </div>
        ) : (
          <CourseGrid courses={filtered as unknown as Parameters<typeof CourseGrid>[0]["courses"]} />
        )}
      </div>
    </>
  )
}
