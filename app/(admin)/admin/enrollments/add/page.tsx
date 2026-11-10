"use client"
import { ArrowLeftIcon, DownloadIcon, MoreHorizontal, UploadIcon, UserPlusIcon } from "@/components/icons"

import * as React from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Topbar } from "@/components/platform/topbar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FilterChips, Pagination, StatusBadge, formatDate } from "@/components/admin/shared"
import {
  adminAddPaidLearners,
  adminCancelPaidLearner,
  adminEmailPaidLearner,
  adminListPaidLearners,
  adminOpenPaidLearner,
  adminPaidLearnerPrograms,
  type PaidLearnerInput,
  type PaidLearnerOutcome,
  type PaidLearnerProgram,
  type PaidLearnerResult,
} from "@/lib/actions/admin-access-grants"
import type { AccessGrantStatus, PackageKey } from "@/lib/db/models"
import { queryKeys } from "@/lib/hooks/queries/keys"
import { PACKAGE_LABEL } from "@/lib/entitlements"
import { TRANSFER_METHODS, transferLabel, type TransferMethod } from "@/lib/payment-channels"

/*
 * Learners who paid outside the platform (team voice note, 2026-11-06). The
 * admin records each payment here; the program opens on the learner's own
 * WorldStreet account (sign-in stays on the hub), at once if it exists, else
 * when they first sign in. lib/actions/admin-access-grants.ts does the work.
 */

const BATCH = 10
const METHOD_ITEMS = TRANSFER_METHODS.map((m) => ({ value: m, label: transferLabel(m) }))
const LAGOS_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" })
const todayInLagos = () => LAGOS_DAY.format(new Date())

const OUTCOME_TONE: Record<PaidLearnerOutcome, string> = {
  opened: "text-ws-success",
  waiting: "text-foreground",
  already_has_access: "text-muted-foreground",
  already_waiting: "text-muted-foreground",
  error: "text-ws-danger",
}

const STATUS_FILTERS: { value: AccessGrantStatus | "all"; label: string }[] = [
  { value: "waiting", label: "Waiting to sign in" },
  { value: "opened", label: "Opened" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" },
]

/** "Standard · AI Mastery · $199": the tier the team names, then the program's own plan name. */
const planLabel = (p: { key: PackageKey; name: string; price: number }) => `${PACKAGE_LABEL[p.key]} · ${p.name} · $${p.price}`

const money = (amount: number) =>
  `$${amount.toLocaleString("en-US", { minimumFractionDigits: amount % 1 ? 2 : 0, maximumFractionDigits: 2 })}`

/* ─── CSV ─── */

const CSV_HEADER = ["email", "name", "program", "plan", "amount_usd", "paid_by", "paid_on", "reference", "note"] as const

/** RFC 4180-ish: quoted fields, doubled quotes, commas and newlines inside quotes, CRLF, a BOM. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false
  const src = text.replace(/^﻿/, "")
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ",") {
      row.push(field)
      field = ""
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++
      row.push(field)
      rows.push(row)
      row = []
      field = ""
    } else field += ch
  }
  if (field !== "" || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""))
}

const squash = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "")

const METHOD_ALIASES: Record<string, TransferMethod> = {
  bank: "bank",
  banktransfer: "bank",
  transfer: "bank",
  parallex: "bank",
  espee: "espee",
  espees: "espee",
  usdttrc20: "usdt_trc20",
  trc20: "usdt_trc20",
  usdtbep20: "usdt_bep20",
  bep20: "usdt_bep20",
}

/** "2026-10-12", or day first: "12/10/2026", "12-10-2026". */
function dayOf(value: string): string | null {
  const v = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  const m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (!m) return null
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`
}

type PreviewRow = { line: number; email: string; summary: string; input: PaidLearnerInput | null; problem: string | null }

function previewRows(text: string, programs: PaidLearnerProgram[]): { rows: PreviewRow[]; error: string | null } {
  const table = parseCsv(text)
  if (table.length < 2) return { rows: [], error: "The file has no rows under its header" }
  const header = table[0].map((h) => squash(h))
  const col = (name: (typeof CSV_HEADER)[number]) => header.indexOf(squash(name))
  if (col("email") < 0 || col("program") < 0) {
    return { rows: [], error: `The first row must be the header: ${CSV_HEADER.join(",")}` }
  }
  const byName = new Map<string, PaidLearnerProgram>()
  for (const p of programs) {
    byName.set(squash(p.title), p)
    if (p.slug) byName.set(squash(p.slug), p)
  }
  const cell = (r: string[], name: (typeof CSV_HEADER)[number]) => (col(name) >= 0 ? (r[col(name)] ?? "").trim() : "")

  const rows = table.slice(1).map((r, i): PreviewRow => {
    const line = i + 2
    const email = cell(r, "email").toLowerCase()
    const fail = (problem: string, summary = ""): PreviewRow => ({ line, email, summary, input: null, problem })
    if (!email) return fail("No email")
    const program = byName.get(squash(cell(r, "program")))
    if (!program) return fail(`No program called "${cell(r, "program")}"`)
    let packageKey: PackageKey | null = null
    let planName: string | null = null
    let planPrice = program.price
    if (program.packages.length > 0) {
      const plan = program.packages.find((p) => p.key === squash(cell(r, "plan")) || squash(p.name) === squash(cell(r, "plan")))
      if (!plan) return fail(`Plan must be ${program.packages.map((p) => p.key).join(", ")}`, program.title)
      packageKey = plan.key
      planName = plan.name
      planPrice = plan.price
    }
    const summary = `${program.title}${planName && packageKey ? ` · ${PACKAGE_LABEL[packageKey]} (${planName})` : ""}`
    const amountText = cell(r, "amount_usd").replace(/[$,\s]/g, "")
    const amount = amountText ? Number(amountText) : planPrice
    if (!Number.isFinite(amount) || amount <= 0) return fail("Amount must be in US dollars, like 199", summary)
    const methodText = squash(cell(r, "paid_by") || "bank")
    const method = METHOD_ALIASES[methodText]
    if (!method) {
      return fail(methodText === "usdt" ? "Say which USDT network: usdt_trc20 or usdt_bep20" : "paid_by must be bank, usdt_trc20, usdt_bep20 or espees", summary)
    }
    const paidOn = cell(r, "paid_on") ? dayOf(cell(r, "paid_on")) : todayInLagos()
    if (!paidOn) return fail("paid_on must be a date like 2026-10-12 or 12/10/2026", summary)
    return {
      line,
      email,
      summary: `${summary} · ${money(amount)} · ${transferLabel(method)} · ${paidOn}`,
      problem: null,
      input: {
        email,
        name: cell(r, "name"),
        courseId: program.id,
        packageKey,
        amount,
        method,
        paidOn,
        reference: cell(r, "reference"),
        note: cell(r, "note"),
      },
    }
  })
  return { rows, error: null }
}

function templateCsv(programs: PaidLearnerProgram[]): string {
  const p = programs[0]
  const plan = p?.packages.find((x) => x.key === "standard") ?? p?.packages[0]
  const example = [
    "ada@example.com",
    "Ada Obi",
    p ? p.title : "Crypto Trading Mastery",
    plan ? plan.key : "standard",
    String(plan?.price ?? p?.price ?? 199),
    "bank",
    todayInLagos(),
    "PRLX-123456",
    "Paid before checkout opened",
  ]
  const quote = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  return [CSV_HEADER.join(","), example.map(quote).join(",")].join("\n")
}

/* ─── One learner ─── */

function OneLearnerForm({ programs }: { programs: PaidLearnerProgram[] }) {
  const queryClient = useQueryClient()
  const [email, setEmail] = React.useState("")
  const [name, setName] = React.useState("")
  const [courseId, setCourseId] = React.useState<string | null>(null)
  const [packageKey, setPackageKey] = React.useState<PackageKey | null>(null)
  const [amount, setAmount] = React.useState("")
  const [method, setMethod] = React.useState<TransferMethod>("bank")
  const [paidOn, setPaidOn] = React.useState(todayInLagos)
  const [reference, setReference] = React.useState("")
  const [note, setNote] = React.useState("")
  const [result, setResult] = React.useState<{ tone: string; text: string } | null>(null)

  const program = programs.find((p) => p.id === courseId) ?? null

  const add = useMutation({
    mutationFn: (row: PaidLearnerInput) => adminAddPaidLearners([row]),
    onSuccess: (res) => {
      if (!res.success) {
        setResult({ tone: OUTCOME_TONE.error, text: res.error })
        return
      }
      const r = res.data[0]
      setResult({ tone: OUTCOME_TONE[r.outcome], text: `${r.email}: ${r.message}` })
      if (r.outcome !== "error") {
        setEmail("")
        setName("")
        setReference("")
        setNote("")
      }
      queryClient.invalidateQueries({ queryKey: ["admin", "paid-learners"] })
      queryClient.invalidateQueries({ queryKey: ["admin", "enrollments"] })
    },
    onError: () => setResult({ tone: OUTCOME_TONE.error, text: "Couldn't add them. Try again." }),
  })

  function chooseProgram(id: string | null) {
    setCourseId(id)
    const p = programs.find((x) => x.id === id)
    const plan = p?.packages.find((x) => x.key === "standard") ?? p?.packages[0] ?? null
    setPackageKey(plan?.key ?? null)
    setAmount(String(plan?.price ?? p?.price ?? ""))
  }

  function choosePlan(key: PackageKey | null) {
    setPackageKey(key)
    const plan = program?.packages.find((x) => x.key === key)
    if (plan) setAmount(String(plan.price))
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setResult(null)
    if (!courseId) {
      setResult({ tone: OUTCOME_TONE.error, text: "Choose a program" })
      return
    }
    add.mutate({
      email,
      name,
      courseId,
      packageKey,
      amount: Number(amount.replace(/[$,\s]/g, "")),
      method,
      paidOn,
      reference,
      note,
    })
  }

  return (
    <section aria-labelledby="one-learner-heading" className="rounded-lg border border-ws-hairline bg-ws-surface p-4 sm:p-5">
      <h2 id="one-learner-heading" className="text-sm font-semibold">
        One learner
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Use the email they will sign in with. If they already have an account, the program opens now; if not, we email
        them and it opens the first time they sign in.
      </p>
      <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pl-email">Email</Label>
          <Input id="pl-email" type="email" required autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ada@example.com" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pl-name">Name (optional)</Label>
          <Input id="pl-name" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Obi" />
        </div>
        <div className="space-y-1.5">
          <Label id="pl-program-label">Program</Label>
          <Select
            items={programs.map((p) => ({ value: p.id, label: p.title }))}
            value={courseId}
            onValueChange={(v) => chooseProgram((v as string | null) ?? null)}
          >
            <SelectTrigger className="w-full" aria-labelledby="pl-program-label" id="pl-program">
              <SelectValue placeholder="Choose a program" />
            </SelectTrigger>
            <SelectContent>
              {programs.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">Published programs only. Publish a draft first to add learners to it.</p>
        </div>
        <div className="space-y-1.5">
          <Label id="pl-plan-label">Plan</Label>
          <Select
            items={(program?.packages ?? []).map((p) => ({ value: p.key, label: planLabel(p) }))}
            value={packageKey}
            onValueChange={(v) => choosePlan((v as PackageKey | null) ?? null)}
            disabled={!program || program.packages.length === 0}
          >
            <SelectTrigger className="w-full" aria-labelledby="pl-plan-label" id="pl-plan">
              <SelectValue placeholder={program && program.packages.length === 0 ? "No plans" : "Choose a plan"} />
            </SelectTrigger>
            <SelectContent>
              {(program?.packages ?? []).map((p) => (
                <SelectItem key={p.key} value={p.key}>
                  {planLabel(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pl-amount">Amount they paid (US dollars)</Label>
          <Input id="pl-amount" inputMode="decimal" required autoComplete="off" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="199" />
          <p className="text-[11px] text-muted-foreground">What they actually paid, even if the price has changed since.</p>
        </div>
        <div className="space-y-1.5">
          <Label id="pl-method-label">Paid by</Label>
          <Select items={METHOD_ITEMS} value={method} onValueChange={(v) => v && setMethod(v as TransferMethod)}>
            <SelectTrigger className="w-full" aria-labelledby="pl-method-label" id="pl-method">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METHOD_ITEMS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pl-paid-on">Date they paid</Label>
          <Input id="pl-paid-on" type="date" required max={todayInLagos()} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
          <p className="text-[11px] text-muted-foreground">Places them in the cohort they paid for.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pl-reference">Payment reference (optional)</Label>
          <Input id="pl-reference" autoComplete="off" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="From their receipt" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="pl-note">Note (optional)</Label>
          <Textarea id="pl-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Paid ₦300,000 on WhatsApp before checkout opened" />
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button type="submit" size="sm" disabled={add.isPending}>
            <UserPlusIcon size={14} />
            {add.isPending ? "Adding…" : "Add learner"}
          </Button>
          {result && (
            <p role="status" id="pl-result" className={`text-xs ${result.tone}`}>
              {result.text}
            </p>
          )}
        </div>
      </form>
    </section>
  )
}

/* ─── A list ─── */

function ListUpload({ programs }: { programs: PaidLearnerProgram[] }) {
  const queryClient = useQueryClient()
  const [fileName, setFileName] = React.useState<string | null>(null)
  const [rows, setRows] = React.useState<PreviewRow[]>([])
  const [fileError, setFileError] = React.useState<string | null>(null)
  const [results, setResults] = React.useState<Map<number, PaidLearnerResult>>(new Map())
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null)
  const [runError, setRunError] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const ready = rows.filter((r) => r.input && !results.has(r.line))

  async function readFile(file: File | undefined) {
    setResults(new Map())
    setRunError(null)
    if (!file) return
    setFileName(file.name)
    const parsed = previewRows(await file.text(), programs)
    setRows(parsed.rows)
    setFileError(parsed.error)
  }

  function downloadTemplate() {
    const blob = new Blob([templateCsv(programs)], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "paid-learners-template.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  async function addAll() {
    const todo = ready
    if (todo.length === 0) return
    setRunError(null)
    setProgress({ done: 0, total: todo.length })
    const next = new Map(results)
    try {
      for (let i = 0; i < todo.length; i += BATCH) {
        const chunk = todo.slice(i, i + BATCH)
        const res = await adminAddPaidLearners(chunk.map((r) => r.input as PaidLearnerInput))
        if (!res.success) {
          setRunError(res.error)
          break
        }
        for (const r of res.data) next.set(chunk[r.index].line, r)
        setResults(new Map(next))
        setProgress({ done: Math.min(i + chunk.length, todo.length), total: todo.length })
      }
    } catch {
      setRunError("The connection dropped. Rows marked done are saved; add the file again to finish the rest.")
    } finally {
      setProgress(null)
      queryClient.invalidateQueries({ queryKey: ["admin", "paid-learners"] })
      queryClient.invalidateQueries({ queryKey: ["admin", "enrollments"] })
    }
  }

  const problems = rows.filter((r) => r.problem).length

  return (
    <section aria-labelledby="list-heading" className="rounded-lg border border-ws-hairline bg-ws-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="list-heading" className="text-sm font-semibold">
          A list (CSV)
        </h2>
        <Button type="button" size="xs" variant="ghost" onClick={downloadTemplate}>
          <DownloadIcon size={12} />
          Download the template
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        One row per learner and program, with the header{" "}
        <code className="rounded bg-ws-chip px-1 py-0.5 text-[11px]">{CSV_HEADER.join(",")}</code>. Program is its
        name as listed below; plan is basic, standard or executive; amount_usd blank means today&apos;s price for the
        plan; paid_by is bank, usdt_trc20, usdt_bep20 or espees; paid_on is a date like 2026-10-12 (blank means today).
        Nothing is saved until you press Add.
      </p>
      <details className="mt-2 text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none">Program names</summary>
        <ul className="mt-1 list-disc pl-5">
          {programs.map((p) => (
            <li key={p.id}>
              {p.title}
              {p.packages.length > 0 && ` · ${p.packages.map((x) => `${x.key} (${x.name}) $${x.price}`).join(", ")}`}
            </li>
          ))}
        </ul>
      </details>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          id="pl-file"
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => void readFile(e.target.files?.[0])}
        />
        <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
          <UploadIcon size={14} />
          {fileName ? "Choose another file" : "Choose a CSV file"}
        </Button>
        {fileName && <span className="text-xs text-muted-foreground">{fileName}</span>}
      </div>
      {fileError && <p className="mt-2 text-xs text-ws-danger">{fileError}</p>}

      {rows.length > 0 && (
        <>
          <p className="mt-4 text-xs text-muted-foreground" id="pl-file-summary">
            {rows.length} row{rows.length === 1 ? "" : "s"} · {rows.length - problems} ready
            {problems > 0 ? ` · ${problems} to fix in the file` : ""}
          </p>
          <div className="mt-2 overflow-x-auto rounded-lg border border-ws-hairline">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Row</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>What they paid for</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const done = results.get(r.line)
                  return (
                    <TableRow key={r.line} data-line={r.line}>
                      <TableCell className="text-xs tabular-nums text-muted-foreground">{r.line}</TableCell>
                      <TableCell className="text-sm">{r.email || "—"}</TableCell>
                      <TableCell className="text-xs">{r.summary || "—"}</TableCell>
                      <TableCell className="text-xs">
                        {done ? (
                          <span className={OUTCOME_TONE[done.outcome]}>{done.message}</span>
                        ) : r.problem ? (
                          <span className="text-ws-danger">{r.problem}</span>
                        ) : (
                          <span className="text-muted-foreground">Ready</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button type="button" size="sm" onClick={() => void addAll()} disabled={ready.length === 0 || progress !== null}>
              <UserPlusIcon size={14} />
              {progress
                ? `Adding ${progress.done} of ${progress.total}…`
                : ready.length > 0
                  ? `Add ${ready.length} learner${ready.length === 1 ? "" : "s"}`
                  : "All added"}
            </Button>
            {runError && <p className="text-xs text-ws-danger">{runError}</p>}
          </div>
        </>
      )}
    </section>
  )
}

/* ─── Recorded payments ─── */

function RecordedList() {
  const queryClient = useQueryClient()
  const [status, setStatus] = React.useState<AccessGrantStatus | "all">("waiting")
  const [search, setSearch] = React.useState("")
  const [debounced, setDebounced] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [actionMessage, setActionMessage] = React.useState<{ tone: string; text: string } | null>(null)

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350)
    return () => clearTimeout(t)
  }, [search])

  const filters = { status, search: debounced || undefined, page }
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.adminPaidLearners(filters),
    queryFn: () => adminListPaidLearners(filters),
  })

  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "open" | "email" | "cancel" }) =>
      action === "open" ? adminOpenPaidLearner(id) : action === "email" ? adminEmailPaidLearner(id) : adminCancelPaidLearner(id),
    onSuccess: (res, vars) => {
      setActionMessage(
        res.success
          ? { tone: "text-ws-success", text: vars.action === "open" ? "Opened." : vars.action === "email" ? "Emailed." : "Cancelled." }
          : { tone: "text-ws-danger", text: res.error ?? "That didn't work" }
      )
      queryClient.invalidateQueries({ queryKey: ["admin", "paid-learners"] })
      queryClient.invalidateQueries({ queryKey: ["admin", "enrollments"] })
    },
  })

  return (
    <section aria-labelledby="recorded-heading" className="space-y-3">
      <h2 id="recorded-heading" className="text-sm font-semibold">
        Recorded payments
      </h2>
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          placeholder="Search email, name or reference…"
          className="h-10 max-w-xs text-sm"
          aria-label="Search recorded payments"
        />
        <FilterChips
          value={status}
          onChange={(v) => {
            setStatus(v)
            setPage(1)
          }}
          options={STATUS_FILTERS.map((f) => ({ ...f, count: f.value === "all" ? undefined : data?.counts[f.value] }))}
        />
      </div>
      {actionMessage && (
        <p role="status" className={`text-xs ${actionMessage.tone}`}>
          {actionMessage.text}
        </p>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : !data || data.rows.length === 0 ? (
        <EmptyState icon={UserPlusIcon} title="Nothing here" description="Payments you record show up here." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-ws-hairline">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Learner</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead aria-label="Actions" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((r) => (
                  <TableRow key={r.id} data-grant={r.id}>
                    <TableCell>
                      <p className="text-sm font-medium">{r.name || r.email}</p>
                      {r.name && <p className="text-xs text-muted-foreground">{r.email}</p>}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{r.courseTitle}</p>
                      {r.packageName && <p className="text-[10px] text-muted-foreground">{r.packageName}</p>}
                    </TableCell>
                    <TableCell className="text-xs">
                      <p className="tabular-nums">
                        {money(r.amount)} · {r.methodLabel}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDate(r.paidAt)}
                        {r.reference ? ` · ${r.reference}` : ""}
                      </p>
                    </TableCell>
                    <TableCell className="text-xs">
                      <StatusBadge status={r.status} />
                      <p className="mt-0.5 max-w-56 text-[10px] text-muted-foreground">
                        {r.status === "opened"
                          ? r.alreadyHadAccess
                            ? "They already had access"
                            : `Opened ${r.openedAt ? formatDate(r.openedAt) : ""}`
                          : r.status === "waiting"
                            ? r.accountExists
                              ? "Has an account: open it now"
                              : r.emailedAt
                                ? `No account yet · emailed ${formatDate(r.emailedAt)}`
                                : "No account yet · not emailed"
                            : "Withdrawn"}
                      </p>
                      {r.lastError && <p className="mt-0.5 max-w-56 text-[10px] text-ws-danger">{r.lastError}</p>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(r.createdAt)}
                      <p className="text-[10px]">by {r.addedByName}</p>
                    </TableCell>
                    <TableCell>
                      {r.status === "waiting" && (
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.email}`} />}>
                            <MoreHorizontal size={16} strokeWidth={2} />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            {r.accountExists ? (
                              <DropdownMenuItem onClick={() => act.mutate({ id: r.id, action: "open" })}>Open it now</DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => act.mutate({ id: r.id, action: "email" })}>Email them again</DropdownMenuItem>
                            )}
                            <DropdownMenuItem variant="destructive" onClick={() => act.mutate({ id: r.id, action: "cancel" })}>
                              Cancel
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={data.page} pageCount={data.pageCount} onPageChange={setPage} />
        </>
      )}
    </section>
  )
}

export default function AddPaidLearnersPage() {
  const { data: programs, isLoading } = useQuery({
    queryKey: queryKeys.adminPaidLearnerPrograms,
    queryFn: () => adminPaidLearnerPrograms(),
  })

  return (
    <>
      <Topbar variant="admin" />
      <div className="flex-1 px-6 pb-24 pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-7xl space-y-8">
          <PageHeader
            title="Add paid learners"
            subline="For students who paid outside the platform, so they don't pay again. Nobody gets login details: each learner signs in with their own WorldStreet account."
            action={
              <Button size="sm" variant="outline" render={<Link href="/admin/enrollments" />}>
                <ArrowLeftIcon size={14} />
                Enrollments
              </Button>
            }
          />
          {isLoading ? (
            <Skeleton className="h-72 rounded-lg" />
          ) : !programs || programs.length === 0 ? (
            <p className="rounded-lg border border-ws-hairline bg-ws-surface p-4 text-sm text-muted-foreground">
              No Academy program is on sale yet, so there is nothing to add learners to.
            </p>
          ) : (
            <>
              <OneLearnerForm programs={programs} />
              <ListUpload programs={programs} />
            </>
          )}
          <RecordedList />
        </div>
      </div>
    </>
  )
}
