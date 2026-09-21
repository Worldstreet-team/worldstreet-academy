"use client"

import * as React from "react"
import { SearchIcon, XIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * The index's search box. Controlled by `SchoolsIndex`, which narrows the
 * schools and their programs on every keystroke — so the form never submits
 * anywhere: Enter (the phone keyboard's "Search") only hands off to
 * `onSubmit`, which takes the visitor to the results. Escape clears.
 *
 * Same field language as the navbar search (a sunken well with a hairline in
 * light, one fill step above the page in dark), a size up.
 */
export function SearchField({
  id,
  value,
  onChange,
  onSubmit,
  size = "lg",
  className,
  inputRef,
}: {
  id: string
  value: string
  onChange: (next: string) => void
  onSubmit?: () => void
  size?: "lg" | "md"
  className?: string
  inputRef?: React.Ref<HTMLInputElement>
}) {
  const lg = size === "lg"
  return (
    <form
      role="search"
      className={cn("relative", className)}
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit?.()
      }}
    >
      <label htmlFor={id} className="sr-only">
        Search schools and programs
      </label>
      <SearchIcon
        aria-hidden
        size={lg ? 18 : 16}
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-ws-subtle",
          lg ? "left-5" : "left-3.5"
        )}
      />
      <input
        ref={inputRef}
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.preventDefault()
            onChange("")
          }
        }}
        placeholder="Search schools and programs"
        autoComplete="off"
        enterKeyHint="search"
        spellCheck={false}
        className={cn(
          "w-full rounded-full bg-ws-sunken text-ws-primary outline-none ring-1 ring-inset ring-ws-hairline transition-[background-color,box-shadow] duration-[var(--ws-motion-fast)] placeholder:text-ws-subtle hover:bg-ws-surface focus-visible:bg-ws-surface focus-visible:ring-2 focus-visible:ring-ws-primary/25 dark:bg-ws-surface dark:ring-transparent dark:hover:bg-ws-raised dark:focus-visible:bg-ws-surface dark:focus-visible:ring-ws-primary/25 [&::-webkit-search-cancel-button]:appearance-none",
          lg ? "h-14 pl-13 pr-14 text-[16px]" : "h-10 pl-10 pr-10 text-[14px]"
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className={cn(
            "absolute top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-chip hover:text-ws-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40",
            lg ? "right-2.5 size-10" : "right-1 size-8"
          )}
        >
          <XIcon size={lg ? 16 : 14} aria-hidden />
        </button>
      )}
    </form>
  )
}
