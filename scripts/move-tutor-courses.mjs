/**
 * Take tutors' own courses out of the Academy's school programs (Owen,
 * 2026-10-28: "faculty restricted to the Academy only" — programs are the
 * Academy's; outside tutors such as Nwakwesi Milash sell on the marketplace).
 *
 *   node scripts/move-tutor-courses.mjs                              # dry run
 *   MONGODB_URI=<uri> node scripts/move-tutor-courses.mjs --apply    # writes
 *
 * Candidates: every course that reads as a school program (`kind` missing or
 * "program", the same rule as PROGRAM_KIND_FILTER in lib/course-kind.ts) whose
 * title is NOT one of the 12 Mastery programs (scripts/mastery-catalogue.mjs
 * PROGRAMS, legacy aliases included) and whose owner is NOT the Academy
 * account (OWNER_EMAIL, the same account mastery-catalogue.mjs installs the
 * programs under). In production that is the two legacy courses
 * docs/launch-runbook.md §6 names: "Cryptocurrency Trading Masterclass
 * Beginner to Advanced" and "DIGITAL MARKETING MASTERCLASS".
 *
 * Each candidate becomes a marketplace course (`kind: "marketplace"`,
 * `format: "course"`) waiting in the admin review queue
 * (/admin/courses?review=pending, `review.status: "pending"`). A published one
 * is set to "archived" — never "draft", which its owner could hard-delete
 * along with its lessons while learners still hold it — so it leaves the
 * Academy's catalogue and is not on the marketplace shelf until an admin
 * approves it; approval publishes it (lib/actions/admin-course-review.ts).
 * A marketplace course sells at ONE price, so a plan ladder it carried is
 * cleared (`packages: []`); its scalar `price` is already the cheapest plan,
 * and buyers whose plan is gone keep full access (entitlementsFor, R1).
 * Enrollments, lessons, the price and the owner's role are never touched:
 * learners who bought it keep it. Its owner becomes a Marketplace Creator
 * (`sellerStatus: "approved"`, never a role change) so they keep their editor
 * once they stop being faculty. Roles change only through applyRoleChange
 * (/admin/users), so an owner who still holds INSTRUCTOR is printed for an
 * admin to decide. Either way the marketplace credits the course to its
 * creator by name, never to the Academy (creditsAcademy in lib/faculty.ts).
 *
 * The title list is duplicated literally from scripts/mastery-catalogue.mjs
 * (a .mjs script can't import another's top-level-await module); keep both
 * equal. Idempotent: a re-run finds nothing once the candidates moved.
 *
 * SAFETY: .env.local holds the PRODUCTION URI. A dry run may read it; --apply
 * refuses unless MONGODB_URI was set on the command line. Raw collection
 * writes don't bump updatedAt, as in the other catalogue scripts.
 */
import mongoose from "mongoose"
import { config } from "dotenv"

// Read BEFORE dotenv runs: dotenv never overrides a variable that is already
// set, so this is non-empty only when the operator passed the URI explicitly.
const EXPLICIT_URI = process.env.MONGODB_URI
config({ path: ".env.local" })
config()

const APPLY = process.argv.includes("--apply")

if (APPLY && !EXPLICIT_URI) {
  console.error("REFUSING --apply: MONGODB_URI must be passed on the command line; a URI from .env files is never written to.")
  console.error("  MONGODB_URI=<uri> node scripts/move-tutor-courses.mjs --apply")
  process.exit(1)
}

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error("MONGODB_URI is not set — refusing to run.")
  process.exit(1)
}

// ---- duplicated from scripts/mastery-catalogue.mjs (OWNER_EMAIL, PROGRAMS titles + legacyTitles) ----
const OWNER_EMAIL = "samsonrichfield@gmail.com"
const ACADEMY_TITLES = new Set([
  "Forex Trading Mastery",
  "Crypto Trading Mastery",
  "Blockchain Technology Mastery",
  "AI & AI Automation",
  "Artificial Intelligence & AI Automation",
  "App Development with AI",
  "Cybersecurity",
  "Data Analysis",
  "Content Creation Mastery",
  "Content Creation / Video Editing Mastery",
  "Video Editing Mastery",
  "Tech Sales & Digital Marketing",
  "E-Commerce & Digital Business",
  "Virtual Assistance",
])

await mongoose.connect(uri)
const db = mongoose.connection.db
console.log(
  `Target: ${uri.replace(/\/\/[^@/]+@/, "//***@")} · database ${db.databaseName} · URI from ${EXPLICIT_URI ? "command line" : ".env file"}`
)
console.log(`Mode: ${APPLY ? "APPLY" : "dry run"}`)

const users = db.collection("users")
const courses = db.collection("courses")

const academy = await users.findOne({ email: OWNER_EMAIL }, { projection: { _id: 1 } })
if (!academy) {
  // Without the Academy account every program would look like a tutor's — refuse rather than guess.
  console.error(`No Academy account (${OWNER_EMAIL}) in this database — refusing to run.`)
  await mongoose.disconnect()
  process.exit(1)
}

const candidates = await courses
  .find(
    {
      kind: { $nin: ["marketplace", "new-economy"] },
      title: { $nin: [...ACADEMY_TITLES] },
      instructor: { $ne: academy._id },
    },
    { projection: { _id: 1, title: 1, status: 1, price: 1, packages: 1, instructor: 1, enrolledCount: 1 } }
  )
  .toArray()

const owners = new Map(
  (
    await users
      .find(
        { _id: { $in: candidates.map((c) => c.instructor).filter(Boolean) } },
        { projection: { email: 1, firstName: 1, lastName: 1, role: 1, sellerStatus: 1 } }
      )
      .toArray()
  ).map((u) => [u._id.toString(), u])
)

if (candidates.length === 0) {
  console.log("Nothing to move: every school program is the Academy's.")
  await mongoose.disconnect()
  process.exit(0)
}

console.log(`\n${candidates.length} tutor course(s) listed as Academy programs:`)
const instructorOwners = new Set()
for (const c of candidates) {
  const o = c.instructor ? owners.get(c.instructor.toString()) : null
  const who = o ? `${`${o.firstName ?? ""} ${o.lastName ?? ""}`.trim() || "(no name)"} <${o.email}> role ${o.role ?? "?"}` : "no owner"
  if (o?.role === "INSTRUCTOR" || o?.role === "ADMIN") instructorOwners.add(who)
  const next = c.status === "published" ? "archived (until approved)" : c.status
  const plans = (c.packages ?? []).length > 0 ? ` · ${c.packages.length} plan(s) cleared` : ""
  console.log(`  - "${c.title}" (${c._id}) · ${c.status} -> ${next} · price ${c.price ?? 0}${plans} · ${c.enrolledCount ?? 0} enrolled · ${who}`)
}
if (instructorOwners.size > 0) {
  console.log("\nStill faculty by role — decide at /admin/users (a role change is never made here):")
  for (const who of instructorOwners) console.log(`  - ${who}`)
}

if (!APPLY) {
  console.log("\nDry run — nothing written. Re-run with MONGODB_URI=<uri> on the command line and --apply.")
  await mongoose.disconnect()
  process.exit(0)
}

const now = new Date()
let moved = 0
for (const c of candidates) {
  const res = await courses.updateOne(
    // Pin the state we printed, so a row edited in between is skipped, not clobbered.
    { _id: c._id, kind: { $nin: ["marketplace", "new-economy"] }, status: c.status },
    {
      $set: {
        kind: "marketplace",
        format: "course",
        ...(c.status === "published" ? { status: "archived" } : {}),
        ...((c.packages ?? []).length > 0 ? { packages: [] } : {}),
        "review.status": "pending",
        "review.submittedAt": now,
        "review.note": "Moved from the Academy's school programs to the marketplace (2026-10-28). Review before it goes live.",
      },
    }
  )
  moved += res.modifiedCount
}
// Their owners sell on the marketplace from now on: a creator's access, never a role change.
const ownerIds = [...new Set(candidates.map((c) => c.instructor?.toString()).filter(Boolean))].map(
  (id) => new mongoose.Types.ObjectId(id)
)
const creators =
  ownerIds.length > 0
    ? await users.updateMany({ _id: { $in: ownerIds }, sellerStatus: { $ne: "approved" } }, { $set: { sellerStatus: "approved" } })
    : { modifiedCount: 0 }
console.log(`\nMoved ${moved} of ${candidates.length}. ${creators.modifiedCount} owner(s) made Marketplace Creators.`)
console.log("Review the courses at /admin/courses?review=pending.")
await mongoose.disconnect()
