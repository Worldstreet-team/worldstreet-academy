"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod/v4"
import connectDB from "@/lib/db"
import { User } from "@/lib/db/models"
import { applyRoleChange, requireSuperAdmin, type RoleChangeResult } from "@/lib/auth/admin"
import { adminLevelOf, roleAfterRevoke, type AdminAuditAction, type AdminLevel, type Role } from "@/lib/admin-levels"

export type TeamMember = {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  adminLevel: AdminLevel
  isYou: boolean
  /** The latest grant: who (null = the bootstrap script) and when. Null for admins granted before Phase 21. */
  granted: { byName: string | null; at: string } | null
}
export type TeamAuditRow = {
  at: string
  action: AdminAuditAction
  actorName: string | null
  targetName: string
  toRole: Role
  toLevel: AdminLevel
}
export type TeamView = { members: TeamMember[]; audit: TeamAuditRow[] }
export type FoundAccount = {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  role: Role
  adminLevel: AdminLevel
}

const IdSchema = z.string().regex(/^[a-f0-9]{24}$/, "User not found")
const LevelSchema = z.enum(["super"], "Choose a valid level").nullable()
const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Enter a full email address")
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a full email address")

type Named = { firstName?: string | null; lastName?: string | null; username: string }
function nameOf(u: Named): string {
  return `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.username
}

function failure(label: string, error: unknown, fallback: string): { success: false; error: string } {
  console.error("[Admin team]", label, error instanceof Error ? error.message : error)
  const denied = error instanceof Error && error.message === "Not authorized"
  return { success: false, error: denied ? "Not authorized" : fallback }
}

type Ref = { toString(): string }

export async function superGetTeam(): Promise<{ success: true; data: TeamView } | { success: false; error: string }> {
  try {
    await connectDB()
    const me = await requireSuperAdmin()

    const admins = await User.find({ role: "ADMIN" }).lean()
    const auditRows = await User.aggregate<
      Named & {
        adminAudit: { action: AdminAuditAction; toRole: Role; toLevel: AdminLevel; by: Ref | null; at: Date }
      }
    >([
      { $match: { "adminAudit.0": { $exists: true } } },
      { $unwind: "$adminAudit" },
      { $sort: { "adminAudit.at": -1 } },
      { $limit: 50 },
      { $project: { firstName: 1, lastName: 1, username: 1, adminAudit: 1 } },
    ])

    const actorIds = new Set<string>()
    for (const a of admins) for (const e of a.adminAudit ?? []) if (e.by) actorIds.add(e.by.toString())
    for (const r of auditRows) if (r.adminAudit.by) actorIds.add(r.adminAudit.by.toString())
    const actors = actorIds.size ? await User.find({ _id: { $in: [...actorIds] } }).lean() : []
    const actorName = new Map(actors.map((a) => [a._id.toString(), nameOf(a)]))
    const nameFor = (by: Ref | null | undefined): string | null =>
      by ? (actorName.get(by.toString()) ?? "A removed account") : null

    const members: TeamMember[] = admins.map((a) => {
      const grants = (a.adminAudit ?? []).filter((e) => e.action === "grant")
      const last = grants.length ? grants[grants.length - 1] : null
      return {
        id: a._id.toString(),
        name: nameOf(a),
        email: a.email,
        avatarUrl: a.avatarUrl ?? null,
        adminLevel: adminLevelOf(a.adminLevel),
        isYou: a._id.toString() === me.id,
        granted: last ? { byName: nameFor(last.by), at: last.at.toISOString() } : null,
      }
    })
    members.sort((x, y) => {
      if (x.adminLevel !== y.adminLevel) return x.adminLevel === "super" ? -1 : 1
      return x.name.localeCompare(y.name)
    })

    const audit: TeamAuditRow[] = auditRows.map((r) => ({
      at: r.adminAudit.at.toISOString(),
      action: r.adminAudit.action,
      actorName: nameFor(r.adminAudit.by),
      targetName: nameOf(r),
      toRole: r.adminAudit.toRole,
      toLevel: adminLevelOf(r.adminAudit.toLevel),
    }))

    return { success: true, data: { members, audit } }
  } catch (error) {
    return failure("superGetTeam", error, "Couldn't load the team")
  }
}

export async function superFindAccount(
  email: string
): Promise<{ success: true; data: FoundAccount } | { success: false; error: string }> {
  try {
    await connectDB()
    await requireSuperAdmin()

    const parsed = EmailSchema.safeParse(email)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Enter a full email address" }

    const u = await User.findOne({ email: parsed.data }).lean()
    if (!u) {
      return { success: false, error: "No account uses that email. They need to sign in to the Academy once first." }
    }
    return {
      success: true,
      data: {
        id: u._id.toString(),
        name: nameOf(u),
        email: u.email,
        avatarUrl: u.avatarUrl ?? null,
        role: u.role,
        adminLevel: adminLevelOf(u.adminLevel),
      },
    }
  } catch (error) {
    return failure("superFindAccount", error, "Couldn't update admin access")
  }
}

function done(result: RoleChangeResult): RoleChangeResult {
  if (result.success) {
    revalidatePath("/admin/team")
    revalidatePath("/admin/users")
  }
  return result
}

export async function superGrantAdmin(userId: string): Promise<RoleChangeResult> {
  try {
    await connectDB()
    const actor = await requireSuperAdmin()
    const id = IdSchema.safeParse(userId)
    if (!id.success) return { success: false, error: id.error.issues[0]?.message ?? "User not found" }
    return done(
      await applyRoleChange(actor, id.data, (t) => ({
        role: "ADMIN",
        adminLevel: t.role === "ADMIN" ? t.adminLevel : null,
      }))
    )
  } catch (error) {
    return failure("superGrantAdmin", error, "Couldn't update admin access")
  }
}

export async function superRevokeAdmin(userId: string): Promise<RoleChangeResult> {
  try {
    await connectDB()
    const actor = await requireSuperAdmin()
    const id = IdSchema.safeParse(userId)
    if (!id.success) return { success: false, error: id.error.issues[0]?.message ?? "User not found" }
    return done(
      await applyRoleChange(actor, id.data, (t) =>
        t.role !== "ADMIN"
          ? "That account isn't an admin."
          : { role: roleAfterRevoke(t.lastGrantFromRole, t.instructorStatus), adminLevel: null }
      )
    )
  } catch (error) {
    return failure("superRevokeAdmin", error, "Couldn't update admin access")
  }
}

export async function superSetAdminLevel(userId: string, level: AdminLevel): Promise<RoleChangeResult> {
  try {
    await connectDB()
    const actor = await requireSuperAdmin()
    const id = IdSchema.safeParse(userId)
    if (!id.success) return { success: false, error: id.error.issues[0]?.message ?? "User not found" }
    const lv = LevelSchema.safeParse(level)
    if (!lv.success) return { success: false, error: lv.error.issues[0]?.message ?? "Choose a valid level" }
    return done(
      await applyRoleChange(actor, id.data, (t) =>
        t.role !== "ADMIN" ? "Make them an admin first." : { role: "ADMIN", adminLevel: lv.data }
      )
    )
  } catch (error) {
    return failure("superSetAdminLevel", error, "Couldn't update admin access")
  }
}
