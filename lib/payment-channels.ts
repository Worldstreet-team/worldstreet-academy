/**
 * Transfer payments are CLOSED (CTO, 2026-11-08: "All payments route through
 * WorldStreet"). Learners fund their WorldStreet wallet and pay from it; the
 * Academy shows no bank account, USDT address, ESPEES merchant or payment
 * WhatsApp number anywhere. Never add payment destinations back here: if
 * anyone asks why, they ask the CTO.
 *
 * What stays is the vocabulary for records made while transfers were open
 * (the programme document of 13 Sept 2026, 2026-10-03 to 2026-11-08): the
 * method names on old proofs, orders and the learner's Payments history, and
 * the amount labels stored on those proofs. Pure and client-safe.
 */

export const TRANSFER_METHODS = ["espee", "bank", "usdt_trc20", "usdt_bep20"] as const
export type TransferMethod = (typeof TRANSFER_METHODS)[number]

export function isTransferMethod(value: unknown): value is TransferMethod {
  return typeof value === "string" && (TRANSFER_METHODS as readonly string[]).includes(value)
}

/** The method's name on an old record: "Bank transfer", "USDT (TRC20)" … */
export const TRANSFER_CHANNELS: Record<TransferMethod, { label: string }> = {
  espee: { label: "ESPEES" },
  bank: { label: "Bank transfer" },
  usdt_trc20: { label: "USDT (TRC20)" },
  usdt_bep20: { label: "USDT (BEP20)" },
}

// ── Commented out 2026-11-08 (CTO: transfers not allowed) — kept, not deleted ──
// The payment destinations checkout showed while transfers were open. Comments
// never reach a browser bundle. Restore only on the CTO's word.
//
// export type TransferDetail = { label: string; value: string }
//
// export type TransferChannel = {
//   /** "Bank transfer", "USDT (TRC20)" … */
//   label: string
//   /** Where to send it, line by line. */
//   details: TransferDetail[]
//   /** The receiving account in words, for "arrived in the Academy's …". */
//   account: string
//   /** The hint under the reference field: what to copy from the receipt. */
//   referenceHint: string
// }
//
// export const TRANSFER_CHANNELS: Record<TransferMethod, TransferChannel> = {
//   espee: {
//     label: "ESPEES",
//     details: [{ label: "Merchant", value: "LGFPROGS" }],
//     account: "ESPEES merchant account (LGFPROGS)",
//     referenceHint: "The reference or transaction ID on your ESPEES receipt.",
//   },
//   bank: {
//     label: "Bank transfer",
//     details: [
//       { label: "Account name", value: "Worldstreet Limited" },
//       { label: "Account number", value: "1000340700" },
//       { label: "Bank", value: "Parallex Bank" },
//     ],
//     account: "Parallex Bank account",
//     referenceHint: "The transaction reference or session ID on your bank receipt.",
//   },
//   usdt_trc20: {
//     label: "USDT (TRC20)",
//     details: [
//       { label: "Network", value: "TRC20 (Tron)" },
//       { label: "Address", value: "TQugK3aQ2mYaLJjs2C9DuDJMZ3xGoMPoge" },
//     ],
//     account: "USDT wallet on TRC20",
//     referenceHint: "The transaction hash (TxID) of your transfer.",
//   },
//   usdt_bep20: {
//     label: "USDT (BEP20)",
//     details: [
//       { label: "Network", value: "BEP20 (BNB Smart Chain)" },
//       { label: "Address", value: "0x2d7356ecedb98076551be23075c12fcdc0cfb6d9" },
//     ],
//     account: "USDT wallet on BEP20",
//     referenceHint: "The transaction hash (TxID) of your transfer.",
//   },
// }
//
// /** After paying, the document's contacts: the receipt, full name and plan go to WhatsApp. */
// export const PAYMENT_WHATSAPP = { display: "+234 813 533 4502", href: "https://wa.me/2348135334502" }
// export const PAYMENT_CALLS = { display: "+234 810 393 4017", href: "tel:+2348103934017" }

/** "49", "49.50" — a USD amount as a figure (1 ESPEE = 1 USDT = $1). */
export function transferFigure(amountMinor: number): string {
  const whole = amountMinor % 100 === 0
  return (amountMinor / 100).toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })
}

/**
 * The naira rate a bank transfer is quoted at (client, 2026-11-05; the account
 * takes naira, Owen 2026-11-05): an admin's pinned rate, else the public
 * feed's market rate (lib/naira-rate.ts). `asOf` is when that rate was set.
 */
export type NairaQuote = { ngnPerUsd: number; source: "pinned" | "market"; asOf: string }

/** The market rate's source asks for this credit wherever its rate shows. */
export const NAIRA_FEED_CREDIT = { label: "Rates By Exchange Rate API", href: "https://www.exchangerate-api.com" }

/** Whole naira for a USD amount at `ngnPerUsd`, rounded up so the full fee arrives. */
export function nairaFor(amountMinor: number, ngnPerUsd: number): number {
  // The epsilon keeps a float like 267948.00000001 from rounding up a whole naira.
  return Math.ceil((amountMinor * ngnPerUsd) / 100 - 1e-6)
}

/** "₦267,949" */
export function formatNaira(naira: number): string {
  return `₦${naira.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
}

/** "₦1,346.47" — a rate per $1. */
export function formatNairaRate(ngnPerUsd: number): string {
  return `₦${ngnPerUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * What the learner is asked to send, stored on the proof: "49 ESPEE",
 * "49 USDT", or for the bank "₦65,978 ($49)" at the quoted rate — "$49 in
 * naira" when no rate is known, and the learner confirms it on WhatsApp.
 */
export function transferAmountLabel(method: TransferMethod, amountMinor: number, ngnPerUsd?: number | null): string {
  const figure = transferFigure(amountMinor)
  if (method === "espee") return `${figure} ESPEE`
  if (method === "bank") return ngnPerUsd ? `${formatNaira(nairaFor(amountMinor, ngnPerUsd))} ($${figure})` : `$${figure} in naira`
  return `${figure} USDT`
}

/** The method's name for a row or a notice: "ESPEES", "Bank transfer", "USDT (TRC20)". Older rows have no method: ESPEE. */
export function transferLabel(method: string | null | undefined): string {
  return isTransferMethod(method) ? TRANSFER_CHANNELS[method].label : TRANSFER_CHANNELS.espee.label
}
