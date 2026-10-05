"use server"

import connectDB from "@/lib/db"
import { Bookmark, Course, Enrollment, EnrollmentIntent, ManualPayment, Order, User } from "@/lib/db/models"
import { requireAdmin } from "@/lib/auth/admin"
import { countryName } from "@/lib/countries"
import { SCHOOL_BY_SLUG, type SchoolSlug } from "@/lib/schools"

export interface LeadCounts {
  total: number
  withSignal: number
  signedUpOnly: number
}

/**
 * Sales-outreach export: every learner who showed interest but has not paid.
 *
 * Population: users with role USER, an email, and NO Enrollment in status
 * `active` or `completed`. Interest signals (batched with `$in`): a saved
 * school (EnrollmentIntent), a wishlist bookmark, a `pre_enrolled` enrollment,
 * an Order in pending / payment_requested / failed / cancelled, and an ESPEE
 * payment proof under review or rejected. Users with
 * no signal are kept as "Signed up only". Sorted by last activity, newest first.
 *
 * Phone numbers are not stored by the Academy: the User model has no phone
 * field, so there is no phone column.
 */
export async function exportInterestedLearnersCsv(): Promise<
  { success: true; data: { csv: string; counts: LeadCounts } } | { success: false; error: string }
> {
  try {
    await connectDB()
    await requireAdmin()

    const paidIds = await Enrollment.distinct("user", { status: { $in: ["active", "completed"] } })
    const users = await User.find({
      role: "USER",
      email: { $exists: true, $nin: [null, ""] },
      _id: { $nin: paidIds },
    })
      .select("firstName lastName email country createdAt referredBy")
      .lean()

    const ids = users.map((u) => u._id)
    const [intents, bookmarks, preEnrolled, orders, proofs] = await Promise.all([
      EnrollmentIntent.find({ user: { $in: ids } })
        .select("user school course packageKey savedAt")
        .lean(),
      Bookmark.find({ user: { $in: ids } }).select("user course createdAt").lean(),
      Enrollment.find({ user: { $in: ids }, status: "pre_enrolled" })
        .select("user course createdAt")
        .lean(),
      Order.find({
        user: { $in: ids },
        status: { $in: ["pending", "payment_requested", "failed", "cancelled"] },
      })
        .select("user course packageKey failureCode createdAt")
        .lean(),
      ManualPayment.find({ user: { $in: ids }, status: { $in: ["submitted", "rejected"] } })
        .select("user course packageKey status createdAt")
        .lean(),
    ])

    const courseIds = new Set<string>()
    for (const r of [...intents, ...bookmarks, ...preEnrolled, ...orders, ...proofs]) {
      if (r.course) courseIds.add(r.course.toString())
    }
    const courses = await Course.find({ _id: { $in: [...courseIds] } })
      .select("title school")
      .lean()
    const courseById = new Map(courses.map((c) => [c._id.toString(), c]))

    type Lead = {
      labels: Set<string>
      schools: Set<string>
      programs: Set<string>
      plan: { key: string; at: number } | null
      last: number
    }
    const leads = new Map<string, Lead>()
    for (const u of users) {
      leads.set(u._id.toString(), {
        labels: new Set(),
        schools: new Set(),
        programs: new Set(),
        plan: null,
        last: new Date(u.createdAt).getTime(),
      })
    }

    const note = (
      userId: unknown,
      label: string,
      at: Date | undefined,
      opts: { school?: string | null; course?: unknown; plan?: string | null } = {},
    ) => {
      const lead = leads.get(String(userId))
      if (!lead) return
      lead.labels.add(label)
      const t = at ? new Date(at).getTime() : 0
      if (t > lead.last) lead.last = t
      if (opts.school) lead.schools.add(opts.school)
      if (opts.course) {
        const c = courseById.get(String(opts.course))
        if (c) {
          lead.programs.add(c.title)
          if (c.school) lead.schools.add(c.school)
        }
      }
      if (opts.plan && (!lead.plan || t >= lead.plan.at)) lead.plan = { key: opts.plan, at: t }
    }

    for (const i of intents) {
      note(i.user, "Saved a school", i.savedAt, { school: i.school, course: i.course, plan: i.packageKey })
    }
    for (const b of bookmarks) note(b.user, "Wishlist", b.createdAt, { course: b.course })
    for (const e of preEnrolled) note(e.user, "Pre-enrolled", e.createdAt, { course: e.course })
    for (const o of orders) {
      const funds = /insufficient/i.test(o.failureCode ?? "")
      note(o.user, funds ? "Started checkout (insufficient funds)" : "Started checkout", o.createdAt, {
        course: o.course,
        plan: o.packageKey,
      })
    }

    for (const m of proofs) {
      const label = m.status === "submitted" ? "ESPEE proof under review" : "ESPEE proof rejected"
      note(m.user, label, m.createdAt, { course: m.course, plan: m.packageKey })
    }

    const schoolName = (slug: string) => SCHOOL_BY_SLUG[slug as SchoolSlug]?.name ?? slug
    const ORDER = ["Saved a school", "Wishlist", "Pre-enrolled"]
    const rank = (l: string) => {
      const i = ORDER.indexOf(l)
      return i === -1 ? ORDER.length : i
    }

    const rows = users
      .map((u) => ({ u, lead: leads.get(u._id.toString())! }))
      .sort((a, b) => b.lead.last - a.lead.last)

    let withSignal = 0
    // Names and referral answers are typed by learners: a leading = + - @
    // would run as a formula when sales opens the file in a spreadsheet.
    const quote = (v: string | number | null) => {
      const text = String(v ?? "")
      return `"${(/^[=+\-@]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`
    }
    const header = [
      "First name",
      "Last name",
      "Email",
      "Country",
      "Signed up",
      "Interest",
      "School(s)",
      "Program(s)",
      "Plan",
      "Referred by",
      "Last activity",
    ]
    const lines = rows.map(({ u, lead }) => {
      if (lead.labels.size > 0) withSignal++
      const interest =
        lead.labels.size > 0
          ? [...lead.labels].sort((x, y) => rank(x) - rank(y)).join("; ")
          : "Signed up only"
      return [
        u.firstName,
        u.lastName,
        u.email,
        countryName(u.country) ?? "",
        new Date(u.createdAt).toISOString().slice(0, 10),
        interest,
        [...lead.schools].map(schoolName).join("; "),
        [...lead.programs].join("; "),
        lead.plan?.key ?? "",
        u.referredBy?.text ?? "",
        new Date(lead.last).toISOString().slice(0, 10),
      ]
        .map(quote)
        .join(",")
    })

    const csv = [header.map(quote).join(","), ...lines].join("\n")
    return {
      success: true,
      data: {
        csv,
        counts: { total: rows.length, withSignal, signedUpOnly: rows.length - withSignal },
      },
    }
  } catch (error) {
    console.error("Admin export interested learners error:", error)
    return { success: false, error: "Failed to export interested learners" }
  }
}
