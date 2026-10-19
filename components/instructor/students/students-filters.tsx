"use client"
import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { ChevronDownIcon } from "@/components/icons"
import { PLAN_FILTERS, studentsHref, type FacultyStudentFilters, type PlanFilter, type StudentsBase } from "@/lib/faculty-students"

const FIELD =
  "h-11 w-full appearance-none rounded-full border border-ws-hairline bg-ws-surface pl-4 pr-9 text-[14px] font-medium text-ws-primary outline-none transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised focus-visible:border-ws-muted/50 focus-visible:ring-2 focus-visible:ring-ws-brand/30 md:h-10 dark:border-transparent"

function FilterSelect({
  name,
  label,
  value,
  options,
  onChange,
}: {
  name: string
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
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
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

/** Program, plan and cohort filters: a plain GET form, so it works before hydration. */
export function StudentsFilters({
  values,
  programs,
  cohorts,
  base = "/instructor/students",
}: {
  values: FacultyStudentFilters
  programs: { id: string; title: string }[]
  cohorts: { number: number; name: string }[]
  /** The page being filtered: My Students (default) or Student Performance. */
  base?: StudentsBase
}) {
  const router = useRouter()
  const go = (next: Partial<FacultyStudentFilters>) =>
    router.push(studentsHref({ ...values, ...next }, base), { scroll: false })
  const anySet = values.program !== null || values.plan !== null || values.cohort !== null

  return (
    <form action={base} method="get" className="flex flex-wrap items-center gap-2.5">
      <div className="grid w-full grid-cols-1 gap-2.5 sm:w-auto sm:grid-cols-[repeat(3,minmax(10rem,14rem))]">
        <FilterSelect
          name="program"
          label="Program"
          value={values.program ?? ""}
          onChange={(v) => go({ program: v || null })}
          options={[{ value: "", label: "All programs" }, ...programs.map((p) => ({ value: p.id, label: p.title }))]}
        />
        <FilterSelect
          name="plan"
          label="Plan"
          value={values.plan ?? ""}
          onChange={(v) => go({ plan: (v || null) as PlanFilter | null })}
          options={[{ value: "", label: "All plans" }, ...PLAN_FILTERS]}
        />
        {cohorts.length > 0 && (
          <FilterSelect
            name="cohort"
            label="Cohort"
            value={values.cohort ? String(values.cohort) : ""}
            onChange={(v) => go({ cohort: v ? Number(v) : null })}
            options={[
              { value: "", label: "All cohorts" },
              ...cohorts.map((c) => ({ value: String(c.number), label: c.name })),
            ]}
          />
        )}
      </div>
      <noscript>
        <button type="submit" className="h-10 rounded-full bg-ws-chip px-4 text-[13px] font-semibold">
          Apply
        </button>
      </noscript>
      {anySet && (
        <Link
          href={base}
          className="text-[13px] font-medium text-ws-muted transition-colors hover:text-ws-primary"
        >
          Clear filters
        </Link>
      )}
    </form>
  )
}
