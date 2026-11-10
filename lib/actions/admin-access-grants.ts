"use server"

import { revalidatePath } from "next/cache"
import type { Types } from "mongoose"
import { z } from "zod/v4"
import connectDB from "@/lib/db"
import {
  AccessGrant,
  Course,
  Enrollment,
  User,
  type AccessGrantStatus,
  type ICoursePackage,
  type PackageKey,
} from "@/lib/db/models"
import { requireSuperAdmin } from "@/lib/auth/admin" // CTO 2026-11-08: transfers and outside payments are reconciled by the super admin only
import { registerUrl } from "@/lib/auth/login-url"
import { PACKAGE_KEYS, PACKAGE_RANK, packageFor, sellsPackages } from "@/lib/entitlements"
import { OPENS_DASHBOARD_FILTER } from "@/lib/start-gate"
import { TRANSFER_METHODS, transferLabel, type TransferMethod } from "@/lib/payment-channels"
import { normalizeGrantEmail, openAccessGrant } from "@/lib/access-grants"
import { sendAccessReadyEmail } from "@/lib/email"

/*
 * Learners who paid outside the platform (team voice note, 2026-11-06: "we
 * have students that have made payments … how are we going to onboard those
 * students on the platform without them paying again"). An admin records
 * each payment by email at /admin/enrollments/add, one at a time or from a
 * CSV list. Nobody gets login details: sign-in stays on the hub (owner,
 * 2026-11-03). An account with that email gets the program at once; without
 * one, the learner is emailed and the program opens on their first sign-in
 * (lib/access-grants.ts).
 */

const OBJECT_ID = /^[a-f0-9]{24}$/
/** Rows per call. The page sends a longer list in batches, so it can show progress. */
const MAX_ROWS = 25
/** Resend allows a few requests a second: the list add waits this long after each row that emailed. */
const EMAIL_GAP_MS = 600
/** "Send the email again" no more often than this. */
const RESEND_AFTER_MS = 10 * 60 * 1000
const PAGE_SIZE = 25
const BLOCKED = ["suspended", "cancelled", "expired"]
const LAGOS_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Lagos",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

const PaidLearnerSchema = z.object({
  email: z
    .string({ error: "Enter their email address" })
    .trim()
    .toLowerCase()
    .max(254)
    .pipe(z.email({ error: "Enter a valid email address" })),
  name: z.string().trim().max(120).default(""),
  courseId: z.string().regex(OBJECT_ID, { error: "Choose a program" }),
  packageKey: z.enum(PACKAGE_KEYS).nullable().default(null),
  amount: z
    .number({ error: "Enter the amount they paid, in US dollars" })
    .finite()
    .positive({ error: "Enter the amount they paid, in US dollars" })
    .max(100_000, { error: "That amount looks too large" }),
  method: z.enum(TRANSFER_METHODS, { error: "Choose how they paid" }),
  reference: z.string().trim().max(120).default(""),
  note: z.string().trim().max(500).default(""),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Enter the date they paid" }),
})

export type PaidLearnerInput = z.input<typeof PaidLearnerSchema>

export type PaidLearnerOutcome = "opened" | "waiting" | "already_has_access" | "already_waiting" | "error"
export type PaidLearnerResult = { index: number; email: string; outcome: PaidLearnerOutcome; message: string }

export type PaidLearnerProgram = {
  id: string
  title: string
  slug: string | null
  /** Enabled plans, in ladder order; empty for a course without plans. */
  packages: { key: PackageKey; name: string; price: number }[]
  price: number
}

export type PaidLearnerRow = {
  id: string
  email: string
  name: string | null
  courseId: string
  courseTitle: string
  packageName: string | null
  amount: number
  methodLabel: string
  reference: string | null
  note: string | null
  paidAt: string
  status: AccessGrantStatus
  alreadyHadAccess: boolean
  /** Waiting rows only: an account with this email exists, so "Open now" works. */
  accountExists: boolean
  lastError: string | null
  addedByName: string
  createdAt: string
  openedAt: string | null
  emailedAt: string | null
}

type ProgramDoc = { _id: Types.ObjectId; title: string; slug?: string | null; price?: number; packages?: ICoursePackage[] | null }

function adminNameOf(admin: { firstName?: string | null; lastName?: string | null; email: string }): string {
  return `${admin.firstName ?? ""} ${admin.lastName ?? ""}`.trim() || admin.email
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** The day they paid, as noon in Lagos (never later than now), or why it can't be used. */
function paidAtFrom(day: string): Date | string {
  const at = new Date(`${day}T12:00:00+01:00`)
  if (Number.isNaN(at.getTime()) || at.toISOString().slice(0, 10) !== day) return "Enter a real date"
  if (day > LAGOS_DAY.format(new Date())) return "The payment date can't be in the future"
  if (day < "2025-01-01") return "That payment date is too early"
  return at.getTime() > Date.now() ? new Date() : at
}

async function emailAccessReady(grant: {
  _id: Types.ObjectId
  email: string
  name: string | null
  packageName: string | null
  courseTitle: string
}): Promise<boolean> {
  const res = await sendAccessReadyEmail({
    to: grant.email,
    name: (grant.name ?? "").split(/\s+/)[0] ?? "",
    courseTitle: grant.courseTitle,
    packageName: grant.packageName,
    registerHref: registerUrl("/dashboard"),
  })
  if (res.success) {
    await AccessGrant.updateOne({ _id: grant._id }, { $set: { emailedAt: new Date() } }).catch(() => {})
  }
  return res.success
}

/** The Academy programs on sale an admin can record a payment for, with their plans. */
export async function adminPaidLearnerPrograms(): Promise<PaidLearnerProgram[]> {
  try {
    await connectDB()
    await requireSuperAdmin()
    const courses = await Course.find({ ...OPENS_DASHBOARD_FILTER, status: "published" })
      .select("title slug price packages")
      .sort({ title: 1 })
      .lean<ProgramDoc[]>()
    return courses.map((c) => ({
      id: c._id.toString(),
      title: c.title,
      slug: c.slug ?? null,
      price: c.price ?? 0,
      packages: (c.packages ?? [])
        .filter((p) => p.enabled)
        .sort((a, b) => PACKAGE_RANK[a.key] - PACKAGE_RANK[b.key])
        .map((p) => ({ key: p.key, name: p.name, price: p.price })),
    }))
  } catch (error) {
    console.error("Admin paid-learner programs error:", error)
    return []
  }
}

/**
 * Records payments made outside the platform, up to MAX_ROWS per call, and
 * says what happened to each row. Re-sending a row is safe: an open program
 * reads "already has access" and a waiting one "already added".
 */
export async function adminAddPaidLearners(
  rows: PaidLearnerInput[]
): Promise<{ success: true; data: PaidLearnerResult[] } | { success: false; error: string }> {
  try {
    await connectDB()
    const admin = await requireSuperAdmin()
    if (!Array.isArray(rows) || rows.length === 0) return { success: false, error: "There is nothing to add" }
    if (rows.length > MAX_ROWS) return { success: false, error: `Add at most ${MAX_ROWS} learners at a time` }

    const adminName = adminNameOf(admin)
    const adminEmail = normalizeGrantEmail(admin.email)
    const programs = new Map<string, ProgramDoc | null>()
    const programOf = async (id: string) => {
      if (!programs.has(id)) {
        programs.set(
          id,
          await Course.findOne({ _id: id, ...OPENS_DASHBOARD_FILTER, status: "published" })
            .select("title packages")
            .lean<ProgramDoc>()
        )
      }
      return programs.get(id) ?? null
    }
    const seen = new Set<string>()
    const results: PaidLearnerResult[] = []

    for (const [index, raw] of rows.entries()) {
      const email = normalizeGrantEmail(typeof raw?.email === "string" ? raw.email : "")
      const out = (outcome: PaidLearnerOutcome, message: string): PaidLearnerResult => ({ index, email, outcome, message })
      try {
        const parsed = PaidLearnerSchema.safeParse(raw)
        if (!parsed.success) {
          results.push(out("error", parsed.error.issues[0]?.message ?? "Check this row"))
          continue
        }
        const row = parsed.data
        // Four eyes, as on a transfer approval: nobody records their own payment.
        if (row.email === adminEmail) {
          results.push(out("error", "You can't add yourself. Another admin has to."))
          continue
        }
        const paidAt = paidAtFrom(row.paidOn)
        if (typeof paidAt === "string") {
          results.push(out("error", paidAt))
          continue
        }
        const program = await programOf(row.courseId)
        if (!program) {
          results.push(out("error", "That isn't an Academy program on sale"))
          continue
        }
        let packageKey: PackageKey | null = null
        let packageName: string | null = null
        if (sellsPackages(program)) {
          const pkg = packageFor(program, row.packageKey)
          if (!pkg) {
            results.push(out("error", `Choose one of ${program.title}'s plans`))
            continue
          }
          packageKey = pkg.key
          packageName = pkg.name
        }
        const key = `${row.email}|${row.courseId}`
        if (seen.has(key)) {
          results.push(out("error", "This learner and program are listed twice"))
          continue
        }
        seen.add(key)

        const user = await User.findOne({ email: row.email }).select("_id").lean()
        if (user) {
          const existing = await Enrollment.findOne({ user: user._id, course: program._id }).select("status").lean()
          if (existing && (existing.status === "active" || existing.status === "completed")) {
            results.push(out("already_has_access", "Already has access to this program"))
            continue
          }
          if (existing && BLOCKED.includes(existing.status)) {
            results.push(out("error", `Their enrollment is ${existing.status}. Restore it from Enrollments.`))
            continue
          }
        }

        let grantId: Types.ObjectId
        try {
          const grant = await AccessGrant.create({
            email: row.email,
            name: row.name || null,
            course: program._id,
            packageKey,
            packageName,
            amountMinor: Math.round(row.amount * 100),
            method: row.method,
            reference: row.reference || null,
            note: row.note || null,
            paidAt,
            addedBy: admin.id,
            addedByName: adminName,
          })
          grantId = grant._id
        } catch (err) {
          if (isDuplicateKey(err)) {
            results.push(out("already_waiting", "Already added. It opens when they sign in."))
            continue
          }
          throw err
        }

        // An account made between the lookup above and the insert would miss the grant: look again.
        const account = user ?? (await User.findOne({ email: row.email }).select("_id").lean())
        if (account) {
          const opened = await openAccessGrant(grantId.toString(), account._id.toString(), {
            how: `by ${adminName}`,
            awaitEmails: true,
          })
          if (opened.ok) {
            results.push(
              opened.alreadyHadAccess
                ? out("already_has_access", "Already had access to this program")
                : out("opened", "Opened. They can sign in and start.")
            )
          } else {
            results.push(out("error", `Saved, but not opened yet: ${opened.message}`))
          }
        } else {
          const sent = await emailAccessReady({
            _id: grantId,
            email: row.email,
            name: row.name || null,
            packageName,
            courseTitle: program.title,
          })
          results.push(
            out(
              "waiting",
              sent
                ? "Waiting for them to sign in. We emailed them."
                : "Waiting for them to sign in. The email didn't send, so tell them yourself."
            )
          )
        }
        if (index < rows.length - 1) await pause(EMAIL_GAP_MS)
      } catch (err) {
        console.error("[Grants] add row failed:", err)
        results.push(out("error", "Couldn't save this row. Try it again."))
      }
    }

    revalidatePath("/admin/enrollments")
    revalidatePath("/admin/enrollments/add")
    return { success: true, data: results }
  } catch (error) {
    console.error("Admin add paid learners error:", error)
    return { success: false, error: "Couldn't add the learners. Try again." }
  }
}

/** Every recorded payment, newest first, with whether a waiting one can open now. */
export async function adminListPaidLearners(filters?: {
  status?: AccessGrantStatus | "all"
  search?: string
  page?: number
}): Promise<{
  rows: PaidLearnerRow[]
  total: number
  page: number
  pageCount: number
  counts: Record<AccessGrantStatus, number>
}> {
  const counts: Record<AccessGrantStatus, number> = { waiting: 0, opened: 0, cancelled: 0 }
  const empty = { rows: [], total: 0, page: 1, pageCount: 1, counts }
  try {
    await connectDB()
    await requireSuperAdmin()

    const page = Math.max(1, filters?.page ?? 1)
    const query: Record<string, unknown> = {}
    if (filters?.status && filters.status !== "all") query.status = filters.status
    if (filters?.search?.trim()) {
      const rx = new RegExp(escapeRegex(filters.search.trim()), "i")
      query.$or = [{ email: rx }, { name: rx }, { reference: rx }]
    }

    const [grants, total, byStatus] = await Promise.all([
      AccessGrant.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .populate("course", "title")
        .lean(),
      AccessGrant.countDocuments(query),
      AccessGrant.aggregate<{ _id: AccessGrantStatus; n: number }>([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
    ])
    for (const s of byStatus) if (s._id in counts) counts[s._id] = s.n

    const waitingEmails = [...new Set(grants.filter((g) => g.status === "waiting").map((g) => g.email))]
    const accounts =
      waitingEmails.length > 0
        ? await User.find({ email: { $in: waitingEmails } }).select("email").lean()
        : []
    const withAccount = new Set(accounts.map((a) => normalizeGrantEmail(a.email)))

    const rows: PaidLearnerRow[] = grants.map((g) => {
      const course = g.course as unknown as { _id: Types.ObjectId; title?: string } | null
      return {
        id: g._id.toString(),
        email: g.email,
        name: g.name ?? null,
        courseId: course?._id?.toString() ?? "",
        courseTitle: course?.title ?? "(deleted program)",
        packageName: g.packageName ?? null,
        amount: g.amountMinor / 100,
        methodLabel: transferLabel(g.method as TransferMethod),
        reference: g.reference ?? null,
        note: g.note ?? null,
        paidAt: g.paidAt.toISOString(),
        status: g.status,
        alreadyHadAccess: g.alreadyHadAccess ?? false,
        accountExists: g.status === "waiting" && withAccount.has(g.email),
        lastError: g.status === "waiting" ? (g.lastError ?? null) : null,
        addedByName: g.addedByName,
        createdAt: g.createdAt.toISOString(),
        openedAt: g.openedAt ? g.openedAt.toISOString() : null,
        emailedAt: g.emailedAt ? g.emailedAt.toISOString() : null,
      }
    })

    return { rows, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)), counts }
  } catch (error) {
    console.error("Admin list paid learners error:", error)
    return empty
  }
}

/** Opens a waiting one now, onto the account that has its email (made in the mobile app, say). */
export async function adminOpenPaidLearner(grantId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await connectDB()
    const admin = await requireSuperAdmin()
    if (!OBJECT_ID.test(grantId)) return { success: false, error: "Not found" }
    const grant = await AccessGrant.findById(grantId).select("email status").lean()
    if (!grant) return { success: false, error: "Not found" }
    if (grant.status !== "waiting") return { success: false, error: `This one is already ${grant.status}` }
    if (grant.email === normalizeGrantEmail(admin.email)) {
      return { success: false, error: "You can't open your own. Another admin has to." }
    }
    const user = await User.findOne({ email: grant.email }).select("_id").lean()
    if (!user) return { success: false, error: "No account uses this email yet. It opens when they sign in." }
    const opened = await openAccessGrant(grantId, user._id.toString(), { how: `by ${adminNameOf(admin)}`, awaitEmails: true })
    revalidatePath("/admin/enrollments")
    return opened.ok ? { success: true } : { success: false, error: opened.message }
  } catch (error) {
    console.error("Admin open paid learner error:", error)
    return { success: false, error: "Couldn't open it. Try again." }
  }
}

/** Withdraws a waiting one (a typo in the email, say). An open one is cancelled from Enrollments. */
export async function adminCancelPaidLearner(grantId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await connectDB()
    const admin = await requireSuperAdmin()
    if (!OBJECT_ID.test(grantId)) return { success: false, error: "Not found" }
    const now = Date.now()
    const cancelled = await AccessGrant.findOneAndUpdate(
      {
        _id: grantId,
        status: "waiting",
        $or: [{ openingAt: null }, { openingAt: { $lt: new Date(now - 2 * 60 * 1000) } }],
      },
      { $set: { status: "cancelled", cancelledAt: new Date(now), cancelledByName: adminNameOf(admin), openingAt: null } }
    )
    if (!cancelled) return { success: false, error: "It already opened, or is opening right now" }
    revalidatePath("/admin/enrollments/add")
    return { success: true }
  } catch (error) {
    console.error("Admin cancel paid learner error:", error)
    return { success: false, error: "Couldn't cancel it. Try again." }
  }
}

/** Sends "your place is ready" again to a learner who hasn't signed in yet. */
export async function adminEmailPaidLearner(grantId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await connectDB()
    await requireSuperAdmin()
    if (!OBJECT_ID.test(grantId)) return { success: false, error: "Not found" }
    const grant = await AccessGrant.findById(grantId).populate("course", "title").lean()
    if (!grant) return { success: false, error: "Not found" }
    if (grant.status !== "waiting") return { success: false, error: `This one is already ${grant.status}` }
    if (grant.emailedAt && Date.now() - grant.emailedAt.getTime() < RESEND_AFTER_MS) {
      return { success: false, error: "We emailed them in the last 10 minutes. Try again later." }
    }
    const course = grant.course as unknown as { title?: string } | null
    const sent = await emailAccessReady({
      _id: grant._id,
      email: grant.email,
      name: grant.name ?? null,
      packageName: grant.packageName ?? null,
      courseTitle: course?.title ?? "your program",
    })
    revalidatePath("/admin/enrollments/add")
    return sent ? { success: true } : { success: false, error: "The email didn't send. Try again later." }
  } catch (error) {
    console.error("Admin email paid learner error:", error)
    return { success: false, error: "Couldn't send the email. Try again." }
  }
}
