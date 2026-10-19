"use client"
import { ChevronDownIcon, SearchIcon } from "@/components/icons"

import * as React from "react"
import { useRouter } from "next/navigation"

import {
  MARKETPLACE_SORTS,
  marketplaceHref,
  type MarketplaceFilterValues,
  type MarketplaceSort,
} from "@/lib/marketplace"
import type { CourseFormat } from "@/lib/course-format"
import { cn } from "@/lib/utils"

const FIELD =
  "h-11 w-full appearance-none rounded-full border border-ws-hairline bg-ws-surface pl-4 pr-9 text-[14px] font-medium text-ws-primary outline-none transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised focus-visible:border-ws-muted/50 focus-visible:ring-2 focus-visible:ring-ws-brand/30 md:h-10 dark:border-transparent"

function FilterSelect({
  name,
  label,
  value,
  options,
  onChange,
}: {
  name: keyof MarketplaceFilterValues
  label: string
  value: string
  options: ReadonlyArray<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  const id = React.useId()
  return (
    <div className="relative min-w-0">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select id={id} name={name} value={value} onChange={(e) => onChange(e.target.value)} className={FIELD}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon
        size={15}
        aria-hidden
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ws-muted"
      />
    </div>
  )
}

/**
 * The marketplace's search and filters: topic (the course's school), format, price,
 * level and sort. A plain GET form, so it works before hydration; once
 * hydrated, a change navigates straight away and the URL keeps only the
 * filters that are set. The page itself filters on the server.
 */
export function MarketplaceFilters({
  values,
  topics,
  formats,
  className,
}: {
  values: MarketplaceFilterValues
  /** Schools that have at least one marketplace course, with how many. */
  topics: ReadonlyArray<{ slug: string; label: string; count: number }>
  /** Formats that have at least one listing, with how many. */
  formats: ReadonlyArray<{ value: CourseFormat; label: string; count: number }>
  className?: string
}) {
  const router = useRouter()
  const [q, setQ] = React.useState(values.q)

  function go(next: Partial<MarketplaceFilterValues>) {
    router.push(marketplaceHref({ ...values, q, ...next }), { scroll: false })
  }

  return (
    <form
      action="/marketplace"
      method="get"
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        go({ q })
      }}
      className={cn("space-y-3", className)}
    >
      <div className="relative">
        <SearchIcon
          size={17}
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ws-muted"
        />
        <label htmlFor="marketplace-q" className="sr-only">
          Search the marketplace
        </label>
        <input
          id="marketplace-q"
          name="q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search courses, topics or Marketplace Creators"
          maxLength={80}
          className="h-12 w-full rounded-full border border-ws-hairline bg-ws-surface pl-11 pr-28 text-base text-ws-primary outline-none transition-colors duration-[var(--ws-motion-fast)] placeholder:text-ws-muted focus-visible:border-ws-muted/50 focus-visible:ring-2 focus-visible:ring-ws-brand/30 md:text-[15px] dark:border-transparent"
        />
        <button
          type="submit"
          className="absolute right-1.5 top-1/2 inline-flex h-9 -translate-y-1/2 items-center rounded-full bg-ws-chip px-4 text-[13px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised"
        >
          Search
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        <FilterSelect
          name="school"
          label="Topic"
          value={values.school}
          onChange={(school) => go({ school })}
          options={[
            { value: "", label: "All topics" },
            ...topics.map((t) => ({ value: t.slug, label: `${t.label} (${t.count})` })),
          ]}
        />
        <FilterSelect
          name="format"
          label="Format"
          value={values.format}
          onChange={(format) => go({ format: format as MarketplaceFilterValues["format"] })}
          options={[
            { value: "", label: "All formats" },
            ...formats.map((f) => ({ value: f.value, label: `${f.label} (${f.count})` })),
          ]}
        />
        <FilterSelect
          name="price"
          label="Price"
          value={values.price}
          onChange={(price) => go({ price: price as MarketplaceFilterValues["price"] })}
          options={[
            { value: "", label: "Any price" },
            { value: "free", label: "Free" },
            { value: "paid", label: "Paid" },
          ]}
        />
        <FilterSelect
          name="level"
          label="Level"
          value={values.level}
          onChange={(level) => go({ level: level as MarketplaceFilterValues["level"] })}
          options={[
            { value: "", label: "All levels" },
            { value: "beginner", label: "Beginner" },
            { value: "intermediate", label: "Intermediate" },
            { value: "advanced", label: "Advanced" },
          ]}
        />
        <FilterSelect
          name="sort"
          label="Sort by"
          value={values.sort}
          onChange={(sort) => go({ sort: sort as MarketplaceSort })}
          options={MARKETPLACE_SORTS}
        />
      </div>
    </form>
  )
}
