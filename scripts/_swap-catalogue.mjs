/**
 * Replace the visible catalogue with the ten WorldStreet Academy programs.
 *
 *   node scripts/_swap-catalogue.mjs           # dry run
 *   node scripts/_swap-catalogue.mjs --apply   # archive old + insert new
 *
 * Old courses are ARCHIVED, not dropped: 561 real enrollments, 517 watch
 * progress rows, 106 bookmarks and 21 reviews point at them. Archived courses
 * vanish from the landing page and catalogue (both filter status:"published")
 * while every existing student keeps their record.
 */
import mongoose from "mongoose"
import { config } from "dotenv"
config({ path: ".env.local" })
config()

const APPLY = process.argv.includes("--apply")
await mongoose.connect(process.env.MONGODB_URI)
const db = mongoose.connection.db

const OWNER_EMAIL = "samsonrichfield@gmail.com"
const owner = await db.collection("users").findOne({ email: OWNER_EMAIL })
if (!owner) throw new Error(`owner ${OWNER_EMAIL} not found`)

const PROGRAMS = [
  { title: "Forex Trading Mastery", price: 199, category: "Trading", level: "intermediate",
    short: "Trade the currency markets with a repeatable process.",
    desc: "A complete path through the currency markets: how pairs move, how to read structure and sessions, how to size a position, and how to keep a losing week from becoming a losing account.",
    img: "photo-1611974789855-9c2a0a7236a3" },
  { title: "Crypto Trading Mastery", price: 199, category: "Cryptocurrency", level: "intermediate",
    short: "Trade digital assets without getting run over by volatility.",
    desc: "Spot and derivatives trading for crypto markets — market structure, liquidity, funding, and the risk rules that keep you solvent through the swings this asset class is known for.",
    img: "photo-1621761191319-c6fb62004040" },
  { title: "Blockchain Technology Mastery", price: 99, category: "Blockchain", level: "beginner",
    short: "Understand the technology under the whole industry.",
    desc: "How blockchains actually work: consensus, wallets and keys, transactions and fees, tokens, and how to read a chain rather than take someone's word for what happened on it.",
    img: "photo-1639762681485-074b7f938ba0" },
  { title: "Artificial Intelligence & AI Automation", price: 99, category: "Development", level: "beginner",
    short: "Put AI to work on real tasks, not demos.",
    desc: "Practical AI for people with work to do — prompting that holds up, automating repetitive processes end to end, and wiring tools together so the automation survives contact with real inputs.",
    img: "photo-1677442136019-21780ecad995" },
  { title: "App Development with AI", price: 49, category: "Development", level: "beginner",
    short: "Ship a working app with AI as your pair.",
    desc: "Build and ship a real application using AI tooling throughout — scaffolding, writing and reviewing code, debugging, and getting it deployed rather than leaving it on your laptop.",
    img: "photo-1587620962725-abab7fe55159" },
  { title: "Cybersecurity", price: 99, category: "Other", level: "intermediate",
    short: "Defend accounts, devices and funds.",
    desc: "Security for people who hold real assets: threat models, account and device hardening, phishing and social engineering, key handling, and what to actually do when something is compromised.",
    img: "photo-1550751827-4bd374c3f58b" },
  { title: "Data Analysis", price: 99, category: "Other", level: "beginner",
    short: "Turn raw data into decisions you can defend.",
    desc: "Cleaning messy data, asking answerable questions of it, and presenting findings so somebody can act on them — the analysis workflow, end to end.",
    img: "photo-1551288049-bebda4e38f71" },
  { title: "Virtual Assistance", price: 49, category: "Other", level: "beginner",
    short: "Build a remote support career clients keep paying for.",
    desc: "The skills a virtual assistant is hired for: inbox and calendar ownership, client communication, tooling and systems, and running your services like a business rather than a favour.",
    img: "photo-1486312338219-ce68d2c6f44d" },
  { title: "Content Creation / Video Editing Mastery", price: 99, category: "Other", level: "beginner",
    short: "Make content people finish watching.",
    desc: "Planning, shooting and editing video that holds attention — structure and pacing, the edit itself, sound and colour, and publishing on the platforms where your audience already is.",
    img: "photo-1574717024653-61fd2cf4d44d" },
  { title: "Tech Sales & Digital Marketing", price: 49, category: "Other", level: "beginner",
    short: "Find buyers and close them.",
    desc: "The commercial side of tech: prospecting and outreach that gets replies, running a pipeline, and the digital marketing fundamentals that keep it fed.",
    img: "photo-1460925895917-afdab827c52f" },
]

const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "")

const stale = await db.collection("courses").countDocuments({ status: { $ne: "archived" } })
console.log(`Old courses to archive: ${stale}`)
console.log(`New programs to insert: ${PROGRAMS.length} (owner: ${owner.firstName} ${owner.lastName})`)

if (!APPLY) {
  console.log("\nDRY RUN — nothing written. Re-run with --apply")
  await mongoose.disconnect()
  process.exit(0)
}

const res = await db.collection("courses").updateMany(
  { status: { $ne: "archived" } },
  { $set: { status: "archived", updatedAt: new Date() } }
)
console.log(`Archived ${res.modifiedCount} courses.`)

const now = new Date()
const docs = PROGRAMS.map((p) => ({
  title: p.title,
  slug: `${slug(p.title)}-${Math.random().toString(36).slice(2, 8)}`,
  description: p.desc,
  shortDescription: p.short,
  thumbnailUrl: `https://images.unsplash.com/${p.img}?w=1200&h=675&fit=crop`,
  thumbnailPublicId: null,
  previewVideoUrl: null,
  instructor: owner._id,
  level: p.level,
  pricing: "paid",
  price: p.price,
  currency: "USD",
  status: "published",
  category: p.category,
  tags: [],
  totalLessons: 0,
  totalDuration: 0,
  enrolledCount: 0,
  rating: { average: 0, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } },
  whatYouWillLearn: [],
  requirements: [],
  targetAudience: [],
  examRequired: false,
  publishedAt: now,
  availableAt: null,
  preEnrollEnabled: true,
  liveNotifiedAt: null,
  createdAt: now,
  updatedAt: now,
}))
const ins = await db.collection("courses").insertMany(docs)
console.log(`Inserted ${ins.insertedCount} programs.`)
console.log(await db.collection("courses").find({ status: "published" }, { projection: { title: 1, price: 1 } }).toArray())
await mongoose.disconnect()
