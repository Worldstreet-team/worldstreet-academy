/**
 * "Pay with ESPEE" rules (owner meeting, 2026-10-03) — pure and client-safe,
 * so checkout and the server actions read the same facts. ESPEE is a currency
 * the learner transfers outside our system; 1 ESPEE = $1.
 */

/** Receipt types a proof may be, mapped to the extension its storage key carries. */
export const PAYMENT_PROOF_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
}

/** The file picker's `accept`. */
export const PAYMENT_PROOF_ACCEPT = ".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"

export const MAX_PAYMENT_PROOF_BYTES = 10 * 1024 * 1024

export const PAYMENT_PROOF_TYPE_ERROR = "Upload the receipt as a JPEG, PNG, WebP or PDF"

/** The content type a stored proof key stands for, from its extension; null when it isn't one of ours. */
export function proofContentTypeForKey(key: string): string | null {
  const extension = key.split(".").pop()?.toLowerCase() ?? ""
  return Object.keys(PAYMENT_PROOF_TYPES).find((type) => PAYMENT_PROOF_TYPES[type] === extension) ?? null
}

/** The ESPEE figure for a USD amount: 4900 → "49", 4950 → "49.50". */
export function espeeAmount(amountMinor: number): string {
  const whole = amountMinor % 100 === 0
  return (amountMinor / 100).toLocaleString("en-US", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })
}

/** "49 ESPEE" — what the learner is asked to send, stored on the proof. */
export function espeeAmountLabel(amountMinor: number): string {
  return `${espeeAmount(amountMinor)} ESPEE`
}

/** The checkout link back to one program and plan (a single-price program carries no package). */
export function checkoutPathFor(courseId: string, packageKey: string | null): string {
  return `/dashboard/checkout?courseId=${courseId}${packageKey ? `&package=${packageKey}` : ""}`
}
