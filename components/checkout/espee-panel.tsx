"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CheckIcon,
  ClockIcon,
  CopyIcon,
  FileTextIcon,
  ImageIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  UploadIcon,
} from "lucide-react"
import {
  getPaymentProofUploadUrl,
  submitEspeePayment,
  type EspeeCheckoutState,
} from "@/lib/actions/manual-payments"
import type { PackageKey } from "@/lib/db/models"
import {
  MAX_PAYMENT_PROOF_BYTES,
  PAYMENT_PROOF_ACCEPT,
  PAYMENT_PROOF_TYPES,
  PAYMENT_PROOF_TYPE_ERROR,
  espeeAmount,
} from "@/lib/espee"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

/*
 * "Pay with ESPEE" at checkout (owner meeting, 2026-10-03). The learner sends
 * exactly the order's amount in ESPEE (1 ESPEE = $1) to the Academy's account,
 * then submits the transfer reference and the receipt. The receipt goes
 * straight from the browser into the private bucket the moment it is chosen,
 * so submitting is one quick server call; an admin then opens the program.
 */

export type ReceiptState =
  | { phase: "empty" }
  | { phase: "uploading"; name: string; size: number; progress: number }
  | { phase: "ready"; name: string; size: number; key: string }
  | { phase: "failed"; name: string; error: string }

type FieldErrors = { reference?: string; receipt?: string; form?: string }

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** PUT to the presigned URL with upload progress. Resolves true on a 2xx. */
function putWithProgress(
  url: string,
  file: File,
  onProgress: (percent: number) => void,
  xhrRef: React.RefObject<XMLHttpRequest | null>
): Promise<boolean> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhrRef.current = xhr
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    })
    xhr.addEventListener("load", () => resolve(xhr.status >= 200 && xhr.status < 300))
    xhr.addEventListener("error", () => resolve(false))
    xhr.addEventListener("abort", () => resolve(false))
    xhr.open("PUT", url)
    xhr.setRequestHeader("Content-Type", file.type)
    xhr.send(file)
  })
}

/**
 * The ESPEE form's state and its two actions, owned by the checkout so the
 * submit button can live in the payment card (desktop) and the pinned bar
 * (phone) like the wallet's pay button.
 */
export function useEspeeProof({ courseId, packageKey }: { courseId: string; packageKey: PackageKey | undefined }) {
  const router = useRouter()
  const [reference, setReference] = React.useState("")
  const [note, setNote] = React.useState("")
  const [receipt, setReceipt] = React.useState<ReceiptState>({ phase: "empty" })
  const [errors, setErrors] = React.useState<FieldErrors>({})
  const [submitting, setSubmitting] = React.useState(false)
  const xhrRef = React.useRef<XMLHttpRequest | null>(null)
  // Each choice gets a ticket; events from a replaced upload are ignored.
  const ticketRef = React.useRef(0)

  React.useEffect(() => () => xhrRef.current?.abort(), [])

  async function chooseFile(file: File) {
    const ticket = ++ticketRef.current
    xhrRef.current?.abort()
    setErrors((e) => ({ ...e, receipt: undefined, form: undefined }))
    if (!PAYMENT_PROOF_TYPES[file.type]) {
      setReceipt({ phase: "failed", name: file.name, error: PAYMENT_PROOF_TYPE_ERROR })
      return
    }
    if (file.size > MAX_PAYMENT_PROOF_BYTES) {
      setReceipt({ phase: "failed", name: file.name, error: "Receipts can be up to 10 MB" })
      return
    }
    setReceipt({ phase: "uploading", name: file.name, size: file.size, progress: 0 })
    const presign = await getPaymentProofUploadUrl({ courseId, contentType: file.type, sizeBytes: file.size }).catch(
      () => null
    )
    if (ticket !== ticketRef.current) return
    if (!presign?.success) {
      setReceipt({ phase: "failed", name: file.name, error: presign?.error ?? "Couldn't prepare the upload — try again" })
      return
    }
    const ok = await putWithProgress(
      presign.data.uploadUrl,
      file,
      (progress) => {
        if (ticket === ticketRef.current) setReceipt({ phase: "uploading", name: file.name, size: file.size, progress })
      },
      xhrRef
    )
    if (ticket !== ticketRef.current) return
    setReceipt(
      ok
        ? { phase: "ready", name: file.name, size: file.size, key: presign.data.storageKey }
        : { phase: "failed", name: file.name, error: "The upload didn't finish — choose the file again" }
    )
  }

  /** Validates, runs `before` (the referral save — never blocking), then submits. Navigates on success. */
  async function submit(before: () => Promise<void>) {
    if (submitting) return
    const next: FieldErrors = {}
    if (reference.trim().length < 3) next.reference = "Enter the transfer reference from your ESPEE receipt"
    if (receipt.phase === "uploading") next.receipt = "Wait for the receipt to finish uploading"
    else if (receipt.phase !== "ready") next.receipt = "Upload your receipt"
    setErrors(next)
    if (next.reference || next.receipt) return

    setSubmitting(true)
    await before()
    const result = await submitEspeePayment({
      courseId,
      packageKey,
      receiptKey: receipt.phase === "ready" ? receipt.key : "",
      transferReference: reference,
      note: note.trim() || undefined,
    }).catch(() => null)
    if (result?.success) {
      // Stays "submitting" through the navigation.
      router.push("/dashboard/checkout/pending")
      return
    }
    if (result?.code === "already_enrolled") {
      router.push(`/dashboard/checkout/success?courseId=${courseId}`)
      return
    }
    if (result?.code === "receipt") setReceipt({ phase: "empty" })
    setErrors({ form: result?.error ?? "Couldn't send your proof — try again" })
    setSubmitting(false)
  }

  return { reference, setReference, note, setNote, receipt, chooseFile, errors, submitting, submit }
}

export type EspeeProof = ReturnType<typeof useEspeeProof>

/** The ESPEE half of the payment card: the amount, our details, the form — or the proof already under review. */
export function EspeePanel({
  espee,
  priceMinor,
  form,
}: {
  espee: EspeeCheckoutState
  priceMinor: number
  form: EspeeProof
}) {
  if (espee.open) return <UnderReview open={espee.open} />

  const amount = espeeAmount(priceMinor)
  return (
    <div className="mt-5 space-y-5">
      {espee.lastRejection && (
        <div role="status" className="rounded-[14px] bg-warning-chip p-4">
          <p className="text-[14px] font-semibold text-warning">Your last proof wasn&apos;t confirmed</p>
          {espee.lastRejection.reason && (
            <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-ws-primary">
              {espee.lastRejection.reason}
            </p>
          )}
          <p className="mt-1 text-[13px] leading-relaxed text-ws-muted">Check the details below and send a new proof.</p>
        </div>
      )}

      <div className="rounded-[14px] bg-ws-sunken p-4">
        <p className="text-[12.5px] font-medium text-ws-muted">Send exactly</p>
        <p className="mt-0.5 font-display text-[28px] font-semibold leading-tight tracking-[-0.02em] tabular-nums text-ws-primary">
          {amount} ESPEE
        </p>
        <p className="mt-1 text-[12.5px] text-ws-muted">1 ESPEE = $1, so this order is {amount} ESPEE.</p>
      </div>

      {espee.details && <EspeeDetails details={espee.details} />}

      <div className="space-y-1.5">
        <Label htmlFor="espee-reference">Transfer reference</Label>
        <Input
          id="espee-reference"
          value={form.reference}
          onChange={(e) => form.setReference(e.target.value)}
          maxLength={120}
          autoComplete="off"
          placeholder="e.g. the transaction ID"
          aria-invalid={form.errors.reference ? true : undefined}
          aria-describedby="espee-reference-hint"
          disabled={form.submitting}
        />
        <p
          id="espee-reference-hint"
          className={cn("text-[12.5px] leading-relaxed", form.errors.reference ? "text-ws-danger" : "text-ws-muted")}
        >
          {form.errors.reference ?? "The reference or transaction ID on your ESPEE receipt."}
        </p>
      </div>

      <ReceiptField form={form} />

      <div className="space-y-1.5">
        <Label htmlFor="espee-note">
          Note <span className="font-normal text-ws-muted">· optional</span>
        </Label>
        <Textarea
          id="espee-note"
          value={form.note}
          onChange={(e) => form.setNote(e.target.value)}
          maxLength={500}
          className="min-h-20"
          placeholder="Anything our payments team should know"
          disabled={form.submitting}
        />
      </div>

      {form.errors.form && (
        <p role="alert" className="rounded-[14px] bg-debit-chip px-4 py-3 text-[13.5px] leading-relaxed text-debit">
          {form.errors.form}
        </p>
      )}
    </div>
  )
}

function EspeeDetails({ details }: { details: string }) {
  const [copied, setCopied] = React.useState(false)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(details)
      setCopied(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard refused (permissions, insecure origin): the text stays selectable.
    }
  }

  return (
    <div className="rounded-[14px] border border-ws-hairline p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-semibold text-ws-primary">Send it to</p>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised hover:text-ws-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
        >
          {copied ? <CheckIcon size={13} aria-hidden /> : <CopyIcon size={13} aria-hidden />}
          <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <p className="mt-2 select-all whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-ws-primary">
        {details}
      </p>
    </div>
  )
}

function ReceiptField({ form }: { form: EspeeProof }) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const { receipt } = form
  const pick = () => inputRef.current?.click()
  const error = form.errors.receipt ?? (receipt.phase === "failed" ? receipt.error : null)

  return (
    <div className="space-y-1.5">
      <Label htmlFor="espee-receipt">Receipt</Label>
      <input
        ref={inputRef}
        id="espee-receipt"
        type="file"
        accept={PAYMENT_PROOF_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        disabled={form.submitting}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void form.chooseFile(file)
          e.target.value = ""
        }}
      />
      {receipt.phase === "empty" ? (
        <button
          type="button"
          onClick={pick}
          disabled={form.submitting}
          className="flex w-full flex-col items-center justify-center gap-1 rounded-[14px] border border-dashed border-ws-hairline px-4 py-5 text-center transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
        >
          <UploadIcon size={18} className="text-ws-muted" aria-hidden />
          <span className="text-[14px] font-semibold text-ws-primary">Upload your receipt</span>
          <span className="text-[12.5px] text-ws-muted">A screenshot or PDF · JPEG, PNG, WebP or PDF · up to 10 MB</span>
        </button>
      ) : (
        <div className="rounded-[14px] bg-ws-sunken p-3.5">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-ws-raised text-ws-muted"
            >
              {receipt.name.toLowerCase().endsWith(".pdf") ? <FileTextIcon size={16} /> : <ImageIcon size={16} />}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13.5px] font-medium text-ws-primary">{receipt.name}</span>
              <span className="text-[12px] text-ws-muted" aria-live="polite">
                {receipt.phase === "uploading"
                  ? `Uploading… ${receipt.progress}%`
                  : receipt.phase === "ready"
                    ? `Uploaded · ${formatSize(receipt.size)}`
                    : "Not uploaded"}
              </span>
            </span>
            {receipt.phase === "ready" && <CheckIcon size={16} className="shrink-0 text-credit" aria-hidden />}
            <button
              type="button"
              onClick={pick}
              disabled={form.submitting}
              className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised hover:text-ws-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 disabled:cursor-default"
            >
              <RefreshCwIcon size={12} aria-hidden />
              {receipt.phase === "failed" ? "Choose again" : "Replace"}
            </button>
          </div>
          {receipt.phase === "uploading" && (
            <div
              role="progressbar"
              aria-label="Receipt upload"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={receipt.progress}
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-ws-raised"
            >
              <div
                className="h-full origin-left rounded-full bg-ws-primary/70 transition-transform duration-[var(--ws-motion-fast)]"
                style={{ transform: `scaleX(${receipt.progress / 100})` }}
              />
            </div>
          )}
        </div>
      )}
      {error && <p className="text-[12.5px] leading-relaxed text-ws-danger">{error}</p>}
    </div>
  )
}

function UnderReview({ open }: { open: NonNullable<EspeeCheckoutState["open"]> }) {
  return (
    <div role="status" className="mt-5 rounded-[14px] bg-ws-sunken p-4">
      <p className="flex items-center gap-2 text-[14px] font-semibold text-ws-primary">
        <ClockIcon size={15} className="shrink-0 text-ws-muted" aria-hidden />
        Payment under review
      </p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ws-muted">
        We received your proof of {open.amountLabel} on{" "}
        <time dateTime={open.submittedAt} suppressHydrationWarning>
          {new Date(open.submittedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
        </time>
        . Your program opens once an admin confirms it, and we&apos;ll email you.
      </p>
      <p className="mt-2 truncate text-[12.5px] text-ws-muted">Reference · {open.transferReference}</p>
    </div>
  )
}

/** The ESPEE primary action: submit the proof, or — once one is under review — its status page. */
export function EspeeAction({ id, open, form, onSubmit }: { id: string; open: boolean; form: EspeeProof; onSubmit: () => void }) {
  if (open) {
    return (
      <Link
        id={id}
        href="/dashboard/checkout/pending"
        className="flex h-[52px] w-full items-center justify-center rounded-full border border-ws-hairline text-[15px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
      >
        View payment status
      </Link>
    )
  }
  return (
    <button
      id={id}
      type="button"
      onClick={onSubmit}
      disabled={form.submitting}
      aria-live="polite"
      className={cn(
        "flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-ws-brand text-[15px] font-semibold text-ws-brand-on transition-colors duration-[var(--ws-motion-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ws-page",
        form.submitting ? "cursor-progress" : "hover:bg-ws-brand/90 active:translate-y-px"
      )}
    >
      {form.submitting ? (
        <>
          <LoaderCircleIcon size={17} className="animate-spin" aria-hidden />
          Sending your proof…
        </>
      ) : (
        "Submit payment proof"
      )}
    </button>
  )
}
