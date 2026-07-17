/**
 * Daily reconciliation (WA-04): compare the Academy's paid orders/enrollments
 * against the central Worldstreet wallet's charge records and report any
 * mismatch — orders marked paid with no wallet charge, amount drift, refunded
 * charges still granting access, and orphaned charges (paid but never
 * enrolled).
 *
 * Usage: node scripts/reconcile-orders.mjs   (read-only; exits 1 on mismatch)
 */
import mongoose from "mongoose"
import { config } from "dotenv"

config({ path: ".env.local" })
config()

const uri = process.env.MONGODB_URI
const WALLET_BASE_URL = (process.env.WALLET_BASE_URL ?? "").replace(/\/+$/, "")
const WALLET_SERVICE_TOKEN = process.env.WALLET_SERVICE_TOKEN ?? ""

if (!uri || !WALLET_BASE_URL || !WALLET_SERVICE_TOKEN) {
  console.error("MONGODB_URI, WALLET_BASE_URL and WALLET_SERVICE_TOKEN must be set")
  process.exit(1)
}

async function getCharge(authUserId, chargeId) {
  const res = await fetch(
    `${WALLET_BASE_URL}/v1/wallet/${encodeURIComponent(authUserId)}/charges/${encodeURIComponent(chargeId)}`,
    { headers: { "X-Wallet-Service-Token": WALLET_SERVICE_TOKEN } }
  )
  const body = await res.json().catch(() => ({}))
  if (!res.ok || body.ok === false) return { error: body.code ?? `HTTP ${res.status}` }
  return { charge: body.charge }
}

await mongoose.connect(uri)
const db = mongoose.connection.db
const orders = db.collection("orders")
const enrollments = db.collection("enrollments")

const problems = []
const paidOrders = await orders.find({ status: { $in: ["paid", "enrolled", "refunded"] } }).toArray()

console.log(`Reconciling ${paidOrders.length} order(s) against the wallet service...`)
for (const order of paidOrders) {
  const label = `order ${order._id} (${order.reference})`
  if (!order.chargeId) {
    problems.push(`${label}: status=${order.status} but has no chargeId`)
    continue
  }
  const { charge, error } = await getCharge(order.authUserId, order.chargeId)
  if (error) {
    problems.push(`${label}: wallet lookup failed (${error})`)
    continue
  }
  if (charge.amountMinor !== order.amountMinor) {
    problems.push(`${label}: amount mismatch academy=${order.amountMinor} wallet=${charge.amountMinor}`)
  }
  const enrollment = await enrollments.findOne({ transactionId: order.chargeId })
  if (charge.status === "refunded" && enrollment && enrollment.status !== "refunded") {
    problems.push(`${label}: wallet charge refunded but enrollment ${enrollment._id} still grants access`)
  }
  if (charge.status === "succeeded" && ["paid"].includes(order.status) && !enrollment) {
    problems.push(`${label}: charged but never enrolled (orphaned charge — refund or enroll)`)
  }
}

// Paid enrollments whose charge no longer exists / never existed
const paidEnrollments = await enrollments
  .find({ pricePaid: { $gt: 0 }, legacyUnpaid: { $ne: true }, transactionId: { $nin: [null, ""] } })
  .toArray()
for (const e of paidEnrollments) {
  const order = await orders.findOne({ chargeId: e.transactionId })
  if (!order) problems.push(`enrollment ${e._id}: has charge ${e.transactionId} but no order record`)
}

if (problems.length === 0) {
  console.log("✓ Reconciliation clean — academy orders and wallet charges agree.")
  await mongoose.disconnect()
  process.exit(0)
}

console.error(`✗ ${problems.length} mismatch(es):`)
for (const p of problems) console.error("  - " + p)
await mongoose.disconnect()
process.exit(1)
