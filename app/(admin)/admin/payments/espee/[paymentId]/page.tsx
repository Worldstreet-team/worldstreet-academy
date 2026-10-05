"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { ExternalLinkIcon, FileTextIcon } from "lucide-react"
import { Topbar } from "@/components/platform/topbar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  adminApproveEspeePayment,
  adminGetEspeePayment,
  adminRejectEspeePayment,
} from "@/lib/actions/manual-payments"
import { queryKeys } from "@/lib/hooks/queries/keys"
import { formatDate, formatDateTime, money, StatusBadge } from "@/components/admin/shared"

/** One label/value line in the details card. */
function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-0.5">{label}</p>
      <div className="text-sm break-words">{children}</div>
    </div>
  )
}

/**
 * One ESPEE payment proof (owner meeting 2026-10-03): the receipt beside what
 * the learner says they sent. Approve opens the program and sends the
 * enrollment email; Reject emails the learner the reason, and they may try
 * again. Both are one-shot on the server — a second click is refused.
 */
export default function AdminEspeePaymentDetailPage() {
  const params = useParams<{ paymentId: string }>()
  const paymentId = params.paymentId
  const queryClient = useQueryClient()

  const [dialog, setDialog] = React.useState<"approve" | "reject" | null>(null)
  const [reason, setReason] = React.useState("")
  const [actionError, setActionError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)

  const { data: payment, isLoading } = useQuery({
    queryKey: queryKeys.adminEspeePaymentDetail(paymentId),
    queryFn: () => adminGetEspeePayment(paymentId),
    // The receipt link is signed for 10 minutes; keep a fresh one on screen.
    refetchInterval: 8 * 60 * 1000,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.adminEspeePaymentDetail(paymentId) })
    queryClient.invalidateQueries({ queryKey: ["admin", "espee-payments"] })
    queryClient.invalidateQueries({ queryKey: ["admin", "orders"] })
  }

  const approve = useMutation({
    mutationFn: () => adminApproveEspeePayment(paymentId),
    onSuccess: (res) => {
      if (!res.success) {
        setActionError(res.error)
      } else {
        setActionError(null)
        setDialog(null)
        setNotice(
          res.data.alreadyEnrolled
            ? "Approved. The learner already had access, so their enrollment was left as it was — refund the transfer outside the platform if it was a duplicate."
            : "Approved. The program is open and the learner has been emailed."
        )
      }
      invalidate()
    },
    onError: () => setActionError("Couldn't approve the payment — try again"),
  })

  const reject = useMutation({
    mutationFn: () => adminRejectEspeePayment(paymentId, reason),
    onSuccess: (res) => {
      if (!res.success) {
        setActionError(res.error)
      } else {
        setActionError(null)
        setDialog(null)
        setReason("")
        setNotice("Rejected. The learner has been emailed the reason and can send a new proof.")
      }
      invalidate()
    },
    onError: () => setActionError("Couldn't reject the payment — try again"),
  })

  const isOpen = payment?.status === "submitted"
  const isPdf = payment?.receiptContentType === "application/pdf"
  const plan = payment?.packageName ? ` — ${payment.packageName}` : ""
  const alreadyIn = payment?.enrollmentStatus === "active" || payment?.enrollmentStatus === "completed"
  const reasonLength = reason.trim().length

  return (
    <>
      <Topbar variant="admin" breadcrumbOverrides={{ [paymentId]: payment?.learnerName ?? "Payment" }} />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-5xl space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-96 rounded-lg" />
            </div>
          ) : !payment ? (
            <div className="rounded-lg border border-ws-hairline bg-ws-surface p-6 text-center">
              <p className="text-sm font-medium">Payment not found</p>
              <Link href="/admin/payments/espee" className="mt-2 inline-block text-xs text-ws-muted hover:text-ws-primary hover:underline">
                Back to ESPEE payments
              </Link>
            </div>
          ) : (
            <>
              {/* Learner header */}
              <div className="rounded-lg border border-ws-hairline bg-ws-surface p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-12 w-12">
                      {payment.learnerAvatar && <AvatarImage src={payment.learnerAvatar} />}
                      <AvatarFallback className="bg-ws-chip text-ws-primary">
                        {payment.learnerName[0]?.toUpperCase() ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-base font-semibold truncate">{payment.learnerName}</h1>
                        <StatusBadge status={payment.status} />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{payment.learnerEmail}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {payment.learnerJoinedAt ? `Joined ${formatDate(payment.learnerJoinedAt)} · ` : ""}
                        Submitted {formatDateTime(payment.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* One gold primary (Approve), one danger (Reject). */}
                  {isOpen && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => {
                          setActionError(null)
                          setDialog("approve")
                        }}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setActionError(null)
                          setDialog("reject")
                        }}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                  {payment.stranded && (
                    <Button
                      size="sm"
                      className="shrink-0"
                      onClick={() => {
                        setActionError(null)
                        setDialog("approve")
                      }}
                    >
                      Finish approval
                    </Button>
                  )}
                </div>
                {payment.stranded && (
                  <p className="mt-3 rounded-lg border border-ws-hairline bg-ws-raised px-3 py-2.5 text-xs">
                    This approval was interrupted before the program opened. Finish it to open the program and email the
                    learner.
                  </p>
                )}
                {isOpen && alreadyIn && (
                  <p className="mt-3 rounded-lg border border-ws-hairline bg-ws-raised px-3 py-2.5 text-xs">
                    This learner already has access to this program ({payment.enrollmentStatus}). Approving records the
                    payment but leaves the enrollment as it is.
                  </p>
                )}
                {notice && <p className="mt-3 text-xs text-ws-success">{notice}</p>}
                {actionError && !dialog && <p className="mt-2 text-xs text-ws-danger">{actionError}</p>}
                {payment.status === "rejected" && payment.rejectionReason && (
                  <p className="text-xs text-muted-foreground mt-3 border-l-2 border-ws-danger/40 pl-2 whitespace-pre-wrap">
                    Rejection reason: {payment.rejectionReason}
                  </p>
                )}
              </div>

              <div className="grid lg:grid-cols-5 gap-4">
                {/* Receipt */}
                <div className="lg:col-span-3">
                  <div className="rounded-lg border border-ws-hairline bg-ws-surface p-4">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <h2 className="text-sm font-semibold">Receipt</h2>
                      {payment.receiptUrl && (
                        <a
                          href={payment.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-ws-muted hover:text-ws-primary hover:underline"
                        >
                          {isPdf ? "Open PDF" : "Open full size"}
                          <ExternalLinkIcon size={12} aria-hidden />
                        </a>
                      )}
                    </div>
                    {!payment.receiptUrl ? (
                      <p className="rounded-lg bg-ws-raised px-3 py-6 text-center text-xs text-muted-foreground">
                        The receipt can&apos;t be shown: the private resources bucket isn&apos;t configured.
                      </p>
                    ) : isPdf ? (
                      <div className="flex flex-col items-center gap-3 rounded-lg bg-ws-raised px-3 py-10 text-center">
                        <FileTextIcon size={28} className="text-ws-muted" aria-hidden />
                        <p className="text-xs text-muted-foreground">The receipt is a PDF.</p>
                        <Button
                          size="sm"
                          variant="outline"
                          render={<a href={payment.receiptUrl} target="_blank" rel="noopener noreferrer" />}
                        >
                          Open PDF
                        </Button>
                      </div>
                    ) : (
                      // A short-lived signed URL from the private bucket — not something next/image can optimise.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={payment.receiptUrl}
                        alt={`Receipt uploaded by ${payment.learnerName}`}
                        className="max-h-[70vh] w-full rounded-lg bg-ws-raised object-contain"
                      />
                    )}
                  </div>
                </div>

                {/* Details + timeline */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="rounded-lg border border-ws-hairline bg-ws-surface p-4 space-y-3">
                    <h2 className="text-sm font-semibold">Payment</h2>
                    <DetailRow label="Program">
                      {payment.courseTitle}
                      {plan}
                    </DetailRow>
                    <DetailRow label="Amount">
                      <span className="font-semibold tabular-nums">{payment.amountLabel}</span>
                      <span className="text-muted-foreground tabular-nums"> · {money(payment.amountMinor)}</span>
                    </DetailRow>
                    <DetailRow label="Transfer reference">
                      <span className="font-mono text-[13px]">{payment.transferReference}</span>
                    </DetailRow>
                    {payment.note && (
                      <DetailRow label="Learner's note">
                        <span className="whitespace-pre-wrap">{payment.note}</span>
                      </DetailRow>
                    )}
                    <DetailRow label="Invited by">
                      {payment.referredBy ? (
                        payment.referredBy.text
                      ) : (
                        <span className="text-muted-foreground">Not given</span>
                      )}
                    </DetailRow>
                    {payment.orderReference && (
                      <DetailRow label="Order">
                        <span className="font-mono text-[12px]">{payment.orderReference}</span>
                      </DetailRow>
                    )}
                    {payment.reviewedAt && (
                      <DetailRow label="Reviewed">
                        {payment.reviewedByName ? `${payment.reviewedByName} · ` : ""}
                        {formatDateTime(payment.reviewedAt)}
                      </DetailRow>
                    )}
                  </div>

                  <div className="rounded-lg border border-ws-hairline bg-ws-surface p-4">
                    <h2 className="text-sm font-semibold mb-2">Timeline</h2>
                    <div className="space-y-2">
                      {payment.history.map((h, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-ws-brand mt-1.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium capitalize">
                              {h.status}
                              {h.by ? ` — ${h.by}` : ""}
                            </p>
                            {h.note && <p className="text-[11px] text-muted-foreground whitespace-pre-wrap">{h.note}</p>}
                            <p className="text-[10px] text-muted-foreground/70">{formatDateTime(h.at)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Approve — a confirm step: this opens the program and emails the learner. */}
      <Dialog open={dialog === "approve"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve this payment?</DialogTitle>
            <DialogDescription>
              Approve only once you&apos;ve confirmed {payment?.amountLabel} arrived in the ESPEE account.{" "}
              {payment?.learnerName} gets {payment?.courseTitle}
              {plan} straight away, plus the enrollment email with their sign-in details. No instructor earning is
              recorded for ESPEE payments.
            </DialogDescription>
          </DialogHeader>
          {actionError && <p className="text-xs text-ws-danger">{actionError}</p>}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate()}>
              {approve.isPending ? "Approving…" : "Approve & open program"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject — the reason is emailed to the learner. */}
      <Dialog open={dialog === "reject"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this payment</DialogTitle>
            <DialogDescription>
              {payment?.learnerName} is emailed this reason with a link back to checkout, and can send a new proof.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            placeholder="e.g. We couldn't find a transfer with this reference. Check the amount and send the receipt again."
            className="text-xs min-h-24"
          />
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {reasonLength < 5 ? "At least 5 characters" : `${reasonLength} / 500`}
          </p>
          {actionError && <p className="text-xs text-ws-danger">{actionError}</p>}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={reject.isPending || reasonLength < 5}
              onClick={() => reject.mutate()}
            >
              {reject.isPending ? "Rejecting…" : "Reject payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
