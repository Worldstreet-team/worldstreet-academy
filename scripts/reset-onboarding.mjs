/**
 * Flip users back to "not onboarded" so the first-run modal shows again.
 *
 *   node scripts/reset-onboarding.mjs              # every user
 *   node scripts/reset-onboarding.mjs student@worldstreet.academy
 *
 * Onboarding is one-shot by design — completing it sets hasOnboarded and the
 * modal never returns. This resets that flag so the flow can be re-tested.
 * Reads MONGODB_URI from .env.local (the same DB `pnpm dev:mock` runs).
 */

import mongoose from "mongoose"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const URI = process.env.MONGODB_URI
if (!URI) {
  console.error("MONGODB_URI is not set — check .env.local")
  process.exit(1)
}

const email = process.argv[2]
const filter = email ? { email: email.toLowerCase() } : {}

await mongoose.connect(URI)

const users = mongoose.connection.collection("users")
const result = await users.updateMany(filter, { $set: { hasOnboarded: false } })

const rows = await users
  .find({}, { projection: { email: 1, hasOnboarded: 1 } })
  .toArray()

console.log(`Reset ${result.modifiedCount} user(s).`)
for (const u of rows) {
  console.log(`  ${u.email} → hasOnboarded=${u.hasOnboarded ?? false}`)
}

await mongoose.disconnect()
