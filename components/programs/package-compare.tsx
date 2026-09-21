"use client"

import * as React from "react"
import { motion } from "motion/react"
import { CheckIcon, MinusIcon, PlusIcon } from "lucide-react"
import { PACKAGE_LABEL } from "@/lib/entitlements"
import { packagePriceLabel } from "@/lib/program-price"
import { cn } from "@/lib/utils"
import { useMotionOK } from "@/components/marketing/motion/bus"
import { EASE_LUX } from "@/components/marketing/motion/ease"
import { usePackageSelection } from "@/components/programs/package-selection"
import { comparisonOf, type CompareCell, type LessonAccess } from "@/components/programs/package-model"

/**
 * "Compare packages" — the feature × tier table, folded by default. Rows are
 * the same data as the cards: lessons, services, then every feature line
 * grouped by the tier that first lists it ("Everything in Basic" resolved, so
 * a Standard column really shows Basic's lines ticked). The selected tier's
 * column is lit; its header is a button, so a visitor can choose from here.
 */
export function PackageCompare({ lessons }: { lessons: LessonAccess | null }) {
  const { packages, tierCount, selected, select } = usePackageSelection()
  const ok = useMotionOK()
  const [open, setOpen] = React.useState(false)
  const groups = React.useMemo(() => comparisonOf(packages, tierCount, lessons), [packages, tierCount, lessons])
  if (groups.length === 0) return null

  const names = packages.map((p) => PACKAGE_LABEL[p.key])
  const joined = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0]

  return (
    <div className="mt-6 overflow-hidden rounded-[20px] border border-ws-hairline bg-ws-surface dark:border-transparent">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="package-compare"
        onClick={() => setOpen((v) => !v)}
        className="group flex w-full items-center justify-between gap-6 px-5 py-5 text-left transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ws-brand/40 sm:px-8"
      >
        <span className="min-w-0">
          <span className="block font-display text-[17px] font-semibold tracking-[-0.01em] text-ws-primary">
            Compare packages
          </span>
          <span className="mt-0.5 block text-[14px] text-ws-muted">
            Everything in {joined}, side by side.
          </span>
        </span>
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors duration-[var(--ws-motion-fast)]",
            open ? "bg-ws-raised text-ws-primary" : "bg-ws-raised/60 text-ws-muted group-hover:text-ws-primary"
          )}
        >
          <PlusIcon
            size={16}
            aria-hidden
            className={cn(
              "transition-transform duration-[var(--ws-motion-base)] ease-[var(--ws-ease)] motion-reduce:transition-none",
              open && "rotate-45"
            )}
          />
        </span>
      </button>

      <motion.div
        id="package-compare"
        className="overflow-hidden"
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: ok ? 0.38 : 0, ease: EASE_LUX }}
        inert={!open}
      >
        <div className="overflow-x-auto border-t border-ws-hairline">
          <table className="w-full min-w-[19rem] table-fixed border-collapse text-left">
            <caption className="sr-only">What each package of this program includes</caption>
            <colgroup>
              <col className="w-[38%] sm:w-[40%]" />
              {packages.map((pkg) => (
                <col key={pkg.key} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className="px-5 py-4 align-bottom text-[13px] font-medium text-ws-muted sm:px-8">
                  <span className="sr-only">Inclusion</span>
                </th>
                {packages.map((pkg) => {
                  const active = pkg.key === selected.key
                  return (
                    <th
                      key={pkg.key}
                      scope="col"
                      className={cn(
                        "relative px-0.5 py-3 text-center align-bottom sm:px-2 transition-colors duration-[var(--ws-motion-base)]",
                        active && "bg-ws-raised"
                      )}
                    >
                      {active && <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-ws-brand" />}
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={() => select(pkg.key)}
                        className="mx-auto flex flex-col items-center rounded-[12px] px-1.5 py-1.5 sm:px-3 transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
                      >
                        <span
                          className={cn(
                            "text-[10px] font-semibold uppercase leading-tight tracking-[0.04em] sm:text-[11px] sm:tracking-[0.12em]",
                            active ? "text-ws-primary" : "text-ws-muted"
                          )}
                        >
                          {PACKAGE_LABEL[pkg.key]}
                        </span>
                        <span className="mt-1 font-display text-[20px] font-light leading-none tabular-nums text-ws-primary">
                          {packagePriceLabel(pkg.price)}
                        </span>
                        <span className="sr-only">{active ? " (selected)" : " — select this package"}</span>
                      </button>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <React.Fragment key={group.title}>
                  <tr className="border-t border-ws-hairline">
                    <th
                      scope="colgroup"
                      colSpan={packages.length + 1}
                      className="bg-ws-sunken/50 px-5 py-2.5 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-ws-muted sm:px-8"
                    >
                      {group.title}
                    </th>
                  </tr>
                  {group.rows.map((row) => (
                    <tr key={`${group.title}-${row.label}`} className="border-t border-ws-hairline">
                      <th scope="row" className="px-5 py-3 text-[13.5px] font-normal leading-snug text-ws-primary/90 sm:px-8 sm:text-[14px]">
                        {row.label}
                      </th>
                      {row.cells.map((cell, i) => (
                        <td
                          key={packages[i].key}
                          className={cn(
                            "px-0.5 py-3 text-center transition-colors sm:px-2 duration-[var(--ws-motion-base)]",
                            packages[i].key === selected.key && "bg-ws-raised"
                          )}
                        >
                          <Cell value={cell} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  )
}

function Cell({ value }: { value: CompareCell }) {
  if (typeof value === "string") {
    return <span className="text-[13.5px] font-medium tabular-nums text-ws-primary">{value}</span>
  }
  return value ? (
    <CheckIcon size={17} className="mx-auto text-ws-primary" role="img" aria-label="Included" />
  ) : (
    <MinusIcon size={16} className="mx-auto text-ws-subtle/70" role="img" aria-label="Not included" />
  )
}
