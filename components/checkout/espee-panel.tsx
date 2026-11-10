// Transfers closed (CTO, 2026-11-08: "All payments route through WorldStreet").
// This whole file is commented out, not deleted. Nothing imports it: the import in
// components/checkout/checkout-view.tsx is commented too. Restore only on the CTO's word.
//
// "use client"
// import { CheckIcon, ClockIcon, CopyIcon, FileTextIcon, ImageIcon, LoaderCircleIcon, RefreshCwIcon, UploadIcon } from "@/components/icons"
// 
// import * as React from "react"
// import Link from "next/link"
// import { useRouter } from "next/navigation"
// 
// import {
//   getPaymentProofUploadUrl,
//   submitEspeePayment,
//   type EspeeCheckoutState,
// } from "@/lib/actions/manual-payments"
// import type { PackageKey } from "@/lib/db/models"
// import {
//   MAX_PAYMENT_PROOF_BYTES,
//   PAYMENT_PROOF_ACCEPT,
//   PAYMENT_PROOF_TYPES,
//   PAYMENT_PROOF_TYPE_ERROR,
// } from "@/lib/espee"
// import {
//   NAIRA_FEED_CREDIT,
//   PAYMENT_CALLS,
//   PAYMENT_WHATSAPP,
//   TRANSFER_CHANNELS,
//   formatNaira,
//   formatNairaRate,
//   nairaFor,
//   transferFigure,
//   transferLabel,
//   type NairaQuote,
//   type TransferDetail,
//   type TransferMethod,
// } from "@/lib/payment-channels"
// import { cn } from "@/lib/utils"
// import { Segmented } from "@/components/ui/system"
// import { Input } from "@/components/ui/input"
// import { Label } from "@/components/ui/label"
// import { Textarea } from "@/components/ui/textarea"
// 
// /*
//  * Paying by transfer at checkout: ESPEE (owner meeting, 2026-10-03), and since
//  * 2026-11-05 a bank transfer or USDT — the programme document's payment
//  * details (lib/payment-channels.ts). The learner sends the order's amount to
//  * the Academy's account, then submits the transfer reference and the receipt.
//  * The receipt goes straight from the browser into the private bucket the
//  * moment it is chosen, so submitting is one quick server call; an admin then
//  * opens the program.
//  */
// 
// export type ReceiptState =
//   | { phase: "empty" }
//   | { phase: "uploading"; name: string; size: number; progress: number }
//   | { phase: "ready"; name: string; size: number; key: string }
//   | { phase: "failed"; name: string; error: string }
// 
// type FieldErrors = { reference?: string; receipt?: string; form?: string }
// 
// function formatSize(bytes: number): string {
//   if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
//   return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
// }
// 
// /** PUT to the presigned URL with upload progress. Resolves true on a 2xx. */
// function putWithProgress(
//   url: string,
//   file: File,
//   onProgress: (percent: number) => void,
//   xhrRef: React.RefObject<XMLHttpRequest | null>
// ): Promise<boolean> {
//   return new Promise((resolve) => {
//     const xhr = new XMLHttpRequest()
//     xhrRef.current = xhr
//     xhr.upload.addEventListener("progress", (event) => {
//       if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
//     })
//     xhr.addEventListener("load", () => resolve(xhr.status >= 200 && xhr.status < 300))
//     xhr.addEventListener("error", () => resolve(false))
//     xhr.addEventListener("abort", () => resolve(false))
//     xhr.open("PUT", url)
//     xhr.setRequestHeader("Content-Type", file.type)
//     xhr.send(file)
//   })
// }
// 
// /**
//  * The ESPEE form's state and its two actions, owned by the checkout so the
//  * submit button can live in the payment card (desktop) and the pinned bar
//  * (phone) like the wallet's pay button.
//  */
// export function useEspeeProof({
//   courseId,
//   packageKey,
//   receiptUpload,
// }: {
//   courseId: string
//   packageKey: PackageKey | undefined
//   /** false: no upload here — the receipt goes on WhatsApp. */
//   receiptUpload: boolean
// }) {
//   const router = useRouter()
//   const [reference, setReference] = React.useState("")
//   const [note, setNote] = React.useState("")
//   const [receipt, setReceipt] = React.useState<ReceiptState>({ phase: "empty" })
//   const [errors, setErrors] = React.useState<FieldErrors>({})
//   const [submitting, setSubmitting] = React.useState(false)
//   const xhrRef = React.useRef<XMLHttpRequest | null>(null)
//   // Each choice gets a ticket; events from a replaced upload are ignored.
//   const ticketRef = React.useRef(0)
// 
//   React.useEffect(() => () => xhrRef.current?.abort(), [])
// 
//   async function chooseFile(file: File) {
//     const ticket = ++ticketRef.current
//     xhrRef.current?.abort()
//     setErrors((e) => ({ ...e, receipt: undefined, form: undefined }))
//     if (!PAYMENT_PROOF_TYPES[file.type]) {
//       setReceipt({ phase: "failed", name: file.name, error: PAYMENT_PROOF_TYPE_ERROR })
//       return
//     }
//     if (file.size > MAX_PAYMENT_PROOF_BYTES) {
//       setReceipt({ phase: "failed", name: file.name, error: "Receipts can be up to 10 MB" })
//       return
//     }
//     setReceipt({ phase: "uploading", name: file.name, size: file.size, progress: 0 })
//     const presign = await getPaymentProofUploadUrl({ courseId, contentType: file.type, sizeBytes: file.size }).catch(
//       () => null
//     )
//     if (ticket !== ticketRef.current) return
//     if (!presign?.success) {
//       setReceipt({ phase: "failed", name: file.name, error: presign?.error ?? "Couldn't prepare the upload — try again" })
//       return
//     }
//     const ok = await putWithProgress(
//       presign.data.uploadUrl,
//       file,
//       (progress) => {
//         if (ticket === ticketRef.current) setReceipt({ phase: "uploading", name: file.name, size: file.size, progress })
//       },
//       xhrRef
//     )
//     if (ticket !== ticketRef.current) return
//     setReceipt(
//       ok
//         ? { phase: "ready", name: file.name, size: file.size, key: presign.data.storageKey }
//         : { phase: "failed", name: file.name, error: "The upload didn't finish — choose the file again" }
//     )
//   }
// 
//   /**
//    * Validates, runs `before` (the referral save — never blocking), then submits
//    * how it was paid and, for a bank transfer, the naira rate its amount was
//    * shown at. Navigates on success.
//    */
//   async function submit(before: () => Promise<void>, method: TransferMethod, ngnPerUsd: number | null) {
//     if (submitting) return
//     const next: FieldErrors = {}
//     if (reference.trim().length < 3) next.reference = "Enter the reference from your receipt"
//     if (receiptUpload) {
//       if (receipt.phase === "uploading") next.receipt = "Wait for the receipt to finish uploading"
//       else if (receipt.phase !== "ready") next.receipt = "Upload your receipt"
//     }
//     setErrors(next)
//     if (next.reference || next.receipt) return
// 
//     setSubmitting(true)
//     await before()
//     const result = await submitEspeePayment({
//       courseId,
//       packageKey,
//       method,
//       receiptKey: receiptUpload && receipt.phase === "ready" ? receipt.key : "",
//       transferReference: reference,
//       note: note.trim() || undefined,
//       ngnPerUsd: method === "bank" ? ngnPerUsd : null,
//     }).catch(() => null)
//     if (result?.success) {
//       // Stays "submitting" through the navigation.
//       router.push("/dashboard/checkout/pending")
//       return
//     }
//     if (result?.code === "already_enrolled") {
//       router.push(`/dashboard/checkout/success?courseId=${courseId}`)
//       return
//     }
//     if (result?.code === "receipt") setReceipt({ phase: "empty" })
//     // The rate moved on since the page loaded: reload the checkout state so the new amount shows.
//     if (result?.code === "rate_changed") router.refresh()
//     setErrors({ form: result?.error ?? "Couldn't send your proof — try again" })
//     setSubmitting(false)
//   }
// 
//   return { reference, setReference, note, setNote, receipt, chooseFile, errors, submitting, submit }
// }
// 
// export type EspeeProof = ReturnType<typeof useEspeeProof>
// 
// const USDT_NETWORKS = [
//   { key: "usdt_trc20", label: "TRC20" },
//   { key: "usdt_bep20", label: "BEP20" },
// ] as const satisfies readonly { key: TransferMethod; label: string }[]
// 
// /**
//  * "Send exactly": the figure and the line under it, by method. A bank transfer
//  * is quoted in naira at the checkout rate (client, 2026-11-05), the same figure
//  * the server stores on the proof; with no rate known, the learner confirms it
//  * on WhatsApp, as before.
//  */
// function sendLine(
//   method: TransferMethod,
//   priceMinor: number,
//   naira: NairaQuote | null
// ): { amount: string; note: string; exact: boolean } {
//   const figure = transferFigure(priceMinor)
//   if (method === "espee") return { amount: `${figure} ESPEE`, note: `1 ESPEE = $1, so this order is ${figure} ESPEE.`, exact: true }
//   if (method === "bank") {
//     if (naira) {
//       const whose = naira.source === "pinned" ? "the Academy's rate" : "today's market rate"
//       return {
//         amount: formatNaira(nairaFor(priceMinor, naira.ngnPerUsd)),
//         note: `$${figure} at ${formatNairaRate(naira.ngnPerUsd)} per $1, ${whose}. Bank charges are yours, so this full amount should arrive.`,
//         exact: true,
//       }
//     }
//     return {
//       amount: `$${figure} in naira`,
//       note: `The account takes naira: send the naira equivalent of $${figure} at today's rate. Not sure of the rate? Ask us on WhatsApp before you pay.`,
//       exact: false,
//     }
//   }
//   return {
//     amount: `${figure} USDT`,
//     note: `1 USDT = $1. Network fees are yours, so ${figure} USDT should arrive.`,
//     exact: true,
//   }
// }
// 
// /**
//  * The transfer half of the payment card for one method: the amount, where to
//  * send it, the form — or the proof already under review. USDT picks its
//  * network here (TRC20 or BEP20), each with its own address.
//  */
// export function EspeePanel({
//   espee,
//   priceMinor,
//   form,
//   method,
//   onUsdtNetwork,
// }: {
//   espee: EspeeCheckoutState
//   priceMinor: number
//   form: EspeeProof
//   method: TransferMethod
//   onUsdtNetwork: (network: TransferMethod) => void
// }) {
//   if (espee.open) return <UnderReview open={espee.open} />
// 
//   const channel = TRANSFER_CHANNELS[method]
//   const naira = method === "bank" ? espee.nairaRate : null
//   const send = sendLine(method, priceMinor, naira)
//   const usdt = method === "usdt_trc20" || method === "usdt_bep20"
//   return (
//     <div className="mt-5 space-y-5">
//       {espee.lastRejection && (
//         <div role="status" className="rounded-[14px] bg-warning-chip p-4">
//           <p className="text-[14px] font-semibold text-warning">Your last proof wasn&apos;t confirmed</p>
//           {espee.lastRejection.reason && (
//             <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-ws-primary">
//               {espee.lastRejection.reason}
//             </p>
//           )}
//           <p className="mt-1 text-[13px] leading-relaxed text-ws-muted">Check the details below and send a new proof.</p>
//         </div>
//       )}
// 
//       <div className="rounded-[14px] bg-ws-sunken p-4">
//         <p className="text-[12.5px] font-medium text-ws-muted">{send.exact ? "Send exactly" : "Send"}</p>
//         <p className="mt-0.5 font-display text-[28px] font-semibold leading-tight tracking-[-0.02em] tabular-nums text-ws-primary">
//           {send.amount}
//         </p>
//         <p className="mt-1 text-[12.5px] leading-relaxed text-ws-muted">{send.note}</p>
//         {/* The market feed asks for this credit wherever its rate shows. */}
//         {naira?.source === "market" && (
//           <p className="mt-1 text-[11.5px] text-ws-muted">
//             <a
//               href={NAIRA_FEED_CREDIT.href}
//               target="_blank"
//               rel="noopener noreferrer"
//               className="underline-offset-4 hover:underline"
//             >
//               {NAIRA_FEED_CREDIT.label}
//             </a>
//           </p>
//         )}
//       </div>
// 
//       {usdt && (
//         <div className="space-y-2">
//           <p className="text-[13px] font-semibold text-ws-primary">Network</p>
//           <Segmented options={USDT_NETWORKS} value={method} onChange={onUsdtNetwork} size="sm" grow />
//           <p className="text-[12.5px] leading-relaxed text-warning">
//             Send only on the {channel.details[0]?.value} network. USDT sent on another network can&apos;t be recovered.
//           </p>
//         </div>
//       )}
// 
//       <TransferDetails title={`Send it to · ${channel.label}`} details={channel.details} />
// 
//       <div className="space-y-1.5">
//         <Label htmlFor="espee-reference">Transfer reference</Label>
//         <Input
//           id="espee-reference"
//           value={form.reference}
//           onChange={(e) => form.setReference(e.target.value)}
//           maxLength={120}
//           autoComplete="off"
//           placeholder={usdt ? "e.g. the TxID" : "e.g. the transaction ID"}
//           aria-invalid={form.errors.reference ? true : undefined}
//           aria-describedby="espee-reference-hint"
//           disabled={form.submitting}
//         />
//         <p
//           id="espee-reference-hint"
//           className={cn("text-[12.5px] leading-relaxed", form.errors.reference ? "text-ws-danger" : "text-ws-muted")}
//         >
//           {form.errors.reference ?? channel.referenceHint}
//         </p>
//       </div>
// 
//       {espee.receiptUpload ? <ReceiptField form={form} /> : <WhatsAppReceipt />}
// 
//       <div className="space-y-1.5">
//         <Label htmlFor="espee-note">
//           Note <span className="font-normal text-ws-muted">· optional</span>
//         </Label>
//         <Textarea
//           id="espee-note"
//           value={form.note}
//           onChange={(e) => form.setNote(e.target.value)}
//           maxLength={500}
//           className="min-h-20"
//           placeholder="Anything our payments team should know"
//           disabled={form.submitting}
//         />
//       </div>
// 
//       {/* The document's own instruction: the receipt, full name and plan on WhatsApp. */}
//       {espee.receiptUpload && (
//         <p className="text-[12.5px] leading-relaxed text-ws-muted">
//           You can also send your receipt, full name and plan on WhatsApp to{" "}
//           <a
//             href={PAYMENT_WHATSAPP.href}
//             target="_blank"
//             rel="noopener noreferrer"
//             className="font-medium text-ws-primary underline-offset-4 hover:underline"
//           >
//             {PAYMENT_WHATSAPP.display}
//           </a>
//           , or call{" "}
//           <a href={PAYMENT_CALLS.href} className="font-medium text-ws-primary underline-offset-4 hover:underline">
//             {PAYMENT_CALLS.display}
//           </a>
//           . Uploading it here is what opens your program fastest.
//         </p>
//       )}
// 
//       {form.errors.form && (
//         <p role="alert" className="rounded-[14px] bg-debit-chip px-4 py-3 text-[13.5px] leading-relaxed text-debit">
//           {form.errors.form}
//         </p>
//       )}
//     </div>
//   )
// }
// 
// /** No private bucket to keep receipts in: the receipt goes on WhatsApp, as the programme document asks. */
// function WhatsAppReceipt() {
//   return (
//     <div className="rounded-[14px] bg-ws-sunken p-4">
//       <p className="text-[13px] font-semibold text-ws-primary">Send your receipt on WhatsApp</p>
//       <p className="mt-1 text-[12.5px] leading-relaxed text-ws-muted">
//         After paying, send the receipt with your full name and plan to{" "}
//         <a
//           href={PAYMENT_WHATSAPP.href}
//           target="_blank"
//           rel="noopener noreferrer"
//           className="font-medium text-ws-primary underline-offset-4 hover:underline"
//         >
//           {PAYMENT_WHATSAPP.display}
//         </a>{" "}
//         (calls:{" "}
//         <a href={PAYMENT_CALLS.href} className="font-medium text-ws-primary underline-offset-4 hover:underline">
//           {PAYMENT_CALLS.display}
//         </a>
//         ), and submit its reference here. Your program opens once we match the two.
//       </p>
//     </div>
//   )
// }
// 
// /** Where to send it: one row per detail, each with its own copy button. */
// function TransferDetails({ title, details }: { title: string; details: TransferDetail[] }) {
//   return (
//     <div className="rounded-[14px] border border-ws-hairline p-4">
//       <p className="text-[13px] font-semibold text-ws-primary">{title}</p>
//       <dl className="mt-2 divide-y divide-ws-hairline">
//         {details.map((d) => (
//           <div key={d.label} className="flex items-center gap-3 py-2">
//             <div className="min-w-0 flex-1">
//               <dt className="text-[12px] text-ws-muted">{d.label}</dt>
//               <dd className="select-all break-all text-[14px] font-medium tabular-nums text-ws-primary">{d.value}</dd>
//             </div>
//             <CopyButton value={d.value} label={d.label} />
//           </div>
//         ))}
//       </dl>
//     </div>
//   )
// }
// 
// function CopyButton({ value, label }: { value: string; label: string }) {
//   const [copied, setCopied] = React.useState(false)
//   const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
//   React.useEffect(() => () => {
//     if (timer.current) clearTimeout(timer.current)
//   }, [])
// 
//   async function copy() {
//     try {
//       await navigator.clipboard.writeText(value)
//       setCopied(true)
//       if (timer.current) clearTimeout(timer.current)
//       timer.current = setTimeout(() => setCopied(false), 1800)
//     } catch {
//       // Clipboard refused (permissions, insecure origin): the text stays selectable.
//     }
//   }
// 
//   return (
//     <button
//       type="button"
//       onClick={copy}
//       aria-label={`Copy ${label.toLowerCase()}`}
//       className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised hover:text-ws-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
//     >
//       {copied ? <CheckIcon size={13} aria-hidden /> : <CopyIcon size={13} aria-hidden />}
//       <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
//     </button>
//   )
// }
// 
// function ReceiptField({ form }: { form: EspeeProof }) {
//   const inputRef = React.useRef<HTMLInputElement>(null)
//   const { receipt } = form
//   const pick = () => inputRef.current?.click()
//   const error = form.errors.receipt ?? (receipt.phase === "failed" ? receipt.error : null)
// 
//   return (
//     <div className="space-y-1.5">
//       <Label htmlFor="espee-receipt">Receipt</Label>
//       <input
//         ref={inputRef}
//         id="espee-receipt"
//         type="file"
//         accept={PAYMENT_PROOF_ACCEPT}
//         className="sr-only"
//         tabIndex={-1}
//         disabled={form.submitting}
//         onChange={(e) => {
//           const file = e.target.files?.[0]
//           if (file) void form.chooseFile(file)
//           e.target.value = ""
//         }}
//       />
//       {receipt.phase === "empty" ? (
//         <button
//           type="button"
//           onClick={pick}
//           disabled={form.submitting}
//           className="flex w-full flex-col items-center justify-center gap-1 rounded-[14px] border border-dashed border-ws-hairline px-4 py-5 text-center transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
//         >
//           <UploadIcon size={18} className="text-ws-muted" aria-hidden />
//           <span className="text-[14px] font-semibold text-ws-primary">Upload your receipt</span>
//           <span className="text-[12.5px] text-ws-muted">A screenshot or PDF · JPEG, PNG, WebP or PDF · up to 10 MB</span>
//         </button>
//       ) : (
//         <div className="rounded-[14px] bg-ws-sunken p-3.5">
//           <div className="flex items-center gap-3">
//             <span
//               aria-hidden
//               className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-ws-raised text-ws-muted"
//             >
//               {receipt.name.toLowerCase().endsWith(".pdf") ? <FileTextIcon size={16} /> : <ImageIcon size={16} />}
//             </span>
//             <span className="flex min-w-0 flex-1 flex-col">
//               <span className="truncate text-[13.5px] font-medium text-ws-primary">{receipt.name}</span>
//               <span className="text-[12px] text-ws-muted" aria-live="polite">
//                 {receipt.phase === "uploading"
//                   ? `Uploading… ${receipt.progress}%`
//                   : receipt.phase === "ready"
//                     ? `Uploaded · ${formatSize(receipt.size)}`
//                     : "Not uploaded"}
//               </span>
//             </span>
//             {receipt.phase === "ready" && <CheckIcon size={16} className="shrink-0 text-credit" aria-hidden />}
//             <button
//               type="button"
//               onClick={pick}
//               disabled={form.submitting}
//               className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised hover:text-ws-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 disabled:cursor-default"
//             >
//               <RefreshCwIcon size={12} aria-hidden />
//               {receipt.phase === "failed" ? "Choose again" : "Replace"}
//             </button>
//           </div>
//           {receipt.phase === "uploading" && (
//             <div
//               role="progressbar"
//               aria-label="Receipt upload"
//               aria-valuemin={0}
//               aria-valuemax={100}
//               aria-valuenow={receipt.progress}
//               className="mt-3 h-1.5 overflow-hidden rounded-full bg-ws-raised"
//             >
//               <div
//                 className="h-full origin-left rounded-full bg-ws-primary/70 transition-transform duration-[var(--ws-motion-fast)]"
//                 style={{ transform: `scaleX(${receipt.progress / 100})` }}
//               />
//             </div>
//           )}
//         </div>
//       )}
//       {error && <p className="text-[12.5px] leading-relaxed text-ws-danger">{error}</p>}
//     </div>
//   )
// }
// 
// function UnderReview({ open }: { open: NonNullable<EspeeCheckoutState["open"]> }) {
//   return (
//     <div role="status" className="mt-5 rounded-[14px] bg-ws-sunken p-4">
//       <p className="flex items-center gap-2 text-[14px] font-semibold text-ws-primary">
//         <ClockIcon size={15} className="shrink-0 text-ws-muted" aria-hidden />
//         Payment under review
//       </p>
//       <p className="mt-1.5 text-[13px] leading-relaxed text-ws-muted">
//         We received your {transferLabel(open.method)} proof of {open.amountLabel} on{" "}
//         <time dateTime={open.submittedAt} suppressHydrationWarning>
//           {new Date(open.submittedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
//         </time>
//         . Your program opens once an admin confirms it, and we&apos;ll email you.
//       </p>
//       <p className="mt-2 truncate text-[12.5px] text-ws-muted">Reference · {open.transferReference}</p>
//     </div>
//   )
// }
// 
// /** The transfer primary action: submit the proof, or — once one is under review — its status page. */
// export function EspeeAction({ id, open, form, onSubmit }: { id: string; open: boolean; form: EspeeProof; onSubmit: () => void }) {
//   if (open) {
//     return (
//       <Link
//         id={id}
//         href="/dashboard/checkout/pending"
//         className="flex h-[52px] w-full items-center justify-center rounded-full border border-ws-hairline text-[15px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
//       >
//         View payment status
//       </Link>
//     )
//   }
//   return (
//     <button
//       id={id}
//       type="button"
//       onClick={onSubmit}
//       disabled={form.submitting}
//       aria-live="polite"
//       className={cn(
//         "flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-ws-brand text-[15px] font-semibold text-ws-brand-on transition-colors duration-[var(--ws-motion-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ws-page",
//         form.submitting ? "cursor-progress" : "hover:bg-ws-brand/90 active:translate-y-px"
//       )}
//     >
//       {form.submitting ? (
//         <>
//           <LoaderCircleIcon size={17} className="animate-spin" aria-hidden />
//           Sending your proof…
//         </>
//       ) : (
//         "Submit payment proof"
//       )}
//     </button>
//   )
// }

export {}
