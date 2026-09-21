"use client"

import * as React from "react"
import Form from "next/form"
import { usePathname, useSearchParams } from "next/navigation"
import { SearchIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type NavSearchProps = {
  className?: string
  /** Merged over the field's fill — the sheet sits on a surface, not the page. */
  inputClassName?: string
  /** Runs after a submit — the mobile sheet closes itself with it. */
  onSubmit?: () => void
}

/**
 * "Search programs": a real GET form to `/programs?q=…` (next/form, so the
 * submit is a client navigation). On `/programs` the field shows the live
 * query; everywhere else it starts empty.
 */
export function NavSearch(props: NavSearchProps) {
  // useSearchParams needs a Suspense boundary on statically rendered routes;
  // the fallback is the same field, empty.
  return (
    <React.Suspense fallback={<SearchField {...props} query="" />}>
      <SearchFieldWithQuery {...props} />
    </React.Suspense>
  )
}

function SearchFieldWithQuery(props: NavSearchProps) {
  const pathname = usePathname()
  const params = useSearchParams()
  const query = pathname === "/programs" ? (params.get("q") ?? "") : ""
  return <SearchField {...props} query={query} />
}

function SearchField({ className, inputClassName, onSubmit, query }: NavSearchProps & { query: string }) {
  return (
    <Form action="/programs" role="search" onSubmit={onSubmit} className={cn("relative", className)}>
      <SearchIcon
        aria-hidden
        size={16}
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ws-subtle"
      />
      <input
        // Remount on a new query so the field follows back/forward and
        // clears when leaving /programs.
        key={query}
        type="search"
        name="q"
        defaultValue={query}
        placeholder="Search programs"
        aria-label="Search programs"
        autoComplete="off"
        enterKeyHint="search"
        className={cn(
          // Light: a sunken well with a hairline. Dark: fill, not border — one
          // step above the page, a step more on hover.
          "h-10 w-full rounded-full bg-ws-sunken pl-10 pr-4 text-sm text-ws-primary outline-none ring-1 ring-inset ring-ws-hairline transition-[background-color,box-shadow] duration-[var(--ws-motion-fast)] placeholder:text-ws-subtle hover:bg-ws-surface focus-visible:bg-ws-surface focus-visible:ring-2 focus-visible:ring-ws-primary/25 dark:bg-ws-surface dark:ring-transparent dark:hover:bg-ws-raised dark:focus-visible:bg-ws-surface dark:focus-visible:ring-ws-primary/25 [&::-webkit-search-cancel-button]:appearance-none",
          inputClassName
        )}
      />
    </Form>
  )
}
