"use server"

import connectDB from "@/lib/db"
import { requireAdmin } from "@/lib/auth/admin"
import { partnerRows, type PartnerRow } from "@/lib/referrals"

export async function adminListPartners(): Promise<
  { success: true; data: { rows: PartnerRow[]; inactive: number } } | { success: false; error: string }
> {
  try {
    await connectDB()
    await requireAdmin()
    return { success: true, data: await partnerRows() }
  } catch (error) {
    console.error("Admin partners error:", error)
    return { success: false, error: "Failed to load partners" }
  }
}

const ROLE_LABEL: Record<PartnerRow["role"], string> = { USER: "Student", INSTRUCTOR: "Faculty", ADMIN: "Admin" }

/** Every active partner as a CSV for the sales and finance teams. */
export async function adminExportPartnersCsv(): Promise<
  { success: true; data: { csv: string; count: number } } | { success: false; error: string }
> {
  try {
    await connectDB()
    await requireAdmin()
    const { rows } = await partnerRows()

    // Names are typed by learners: a leading = + - @ would run as a formula
    // when the file is opened in a spreadsheet.
    const quote = (v: string | number | null) => {
      const text = String(v ?? "")
      return `"${(/^[=+\-@]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`
    }
    const usd = (minor: number) => (minor / 100).toFixed(2)
    const header = [
      "Partner Code",
      "First name",
      "Last name",
      "Email",
      "Role",
      "Clicks",
      "Sign-ups",
      "Enrolled",
      "Revenue (USD)",
      "Commission pending (USD)",
      "Commission paid (USD)",
    ]
    const lines = rows.map((r) =>
      [
        r.code,
        r.firstName,
        r.lastName,
        r.email,
        ROLE_LABEL[r.role],
        r.clicks,
        r.signUps,
        r.enrolled,
        usd(r.revenueMinor),
        usd(r.commissionPendingMinor),
        usd(r.commissionPaidMinor),
      ]
        .map(quote)
        .join(","),
    )
    return { success: true, data: { csv: [header.map(quote).join(","), ...lines].join("\n"), count: rows.length } }
  } catch (error) {
    console.error("Admin partners error:", error)
    return { success: false, error: "Failed to export partners" }
  }
}
