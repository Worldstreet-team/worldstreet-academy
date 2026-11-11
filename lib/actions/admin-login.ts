"use server"

import { headers } from "next/headers"
import { clerkClient } from "@clerk/nextjs/server"
import { z } from "zod/v4"
import connectDB from "@/lib/db"
import { User } from "@/lib/db/models"
import { isSuperAdmin } from "@/lib/admin-levels"

/*
 * The admin panels' own sign-in (Owen, 2026-11-11: "someone that is already
 * logged in as anything can go to those routes and put in the login details
 * and log into the admin or the super admin panels"). /admin/login takes any
 * admin, /superadmin a super admin.
 *
 * Identity stays WorldStreet's: the password is checked by Clerk (the hub's
 * instance), and a match returns a one-minute, single-use sign-in token that
 * the browser exchanges for an ordinary WorldStreet session
 * (components/admin/admin-login-form.tsx). Only an account that is ADMIN in
 * Mongo ever gets a token, so this is never a second way in for learners. An
 * account with two-step sign-in is sent to the hub, so its second step is
 * never skipped. Learners still sign in only on the hub (owner, 2026-11-03).
 */

const LoginInput = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  password: z.string().min(1).max(256),
  level: z.enum(["admin", "super"]),
})

type AdminLoginResult = { success: true; data: { ticket: string } } | { success: false; error: string }

const NO_MATCH = "That email and password don't match an admin account."
const TOO_MANY = "Too many attempts. Wait 30 minutes, then try again."

const WINDOW_MS = 30 * 60 * 1000
/** One email from one address: a stranger's guesses don't lock the real admin out. */
const MAX_PER_SOURCE = 5
/** One email from anywhere: bounds guessing spread over many addresses. */
const MAX_PER_EMAIL = 20
const MAX_PER_IP = 20
/** Past this many tracked keys (a flood), every attempt is refused until the sweep. */
const MAX_KEYS = 5000
const SWEEP_EVERY_MS = 60 * 1000

/**
 * Attempts per client IP, per email and per email + IP. In memory on purpose,
 * like the /verify limit in lib/actions/certificates.ts: the app runs as one
 * long-lived Node process (Coolify). Never exported — this is a "use server" file.
 */
const attempts = new Map<string, { count: number; resetAt: number }>()
let lastSweep = 0

function countAttempt(key: string, now: number): number {
  const entry = attempts.get(key)
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return 1
  }
  entry.count += 1
  return entry.count
}

async function clientIp(): Promise<string> {
  const h = await headers()
  // Cloudflare, when it fronts the app, sets cf-connecting-ip and overwrites any client-sent value.
  return (
    h.get("cf-connecting-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    "unknown"
  )
}

/** A 4xx from Clerk's Backend API (e.g. 422 incorrect_password): the details are wrong, not the service. */
function isClerkRefusal(error: unknown): boolean {
  const status = typeof error === "object" && error !== null && "status" in error ? error.status : null
  return typeof status === "number" && status >= 400 && status < 500
}

export async function adminPanelSignIn(input: {
  email: string
  password: string
  level: "admin" | "super"
}): Promise<AdminLoginResult> {
  try {
    // Mock auth and local Clerk test keys have no WorldStreet accounts to check.
    if (process.env.MOCK_AUTH === "1" || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")) {
      return { success: false, error: "Admin sign-in needs the live WorldStreet accounts. Locally, use an admin persona." }
    }

    const parsed = LoginInput.safeParse(input)
    if (!parsed.success) return { success: false, error: "Enter your admin email and password." }
    const { email, password, level } = parsed.data

    const now = Date.now()
    if (now - lastSweep > SWEEP_EVERY_MS) {
      lastSweep = now
      for (const [key, entry] of attempts) {
        if (entry.resetAt <= now) attempts.delete(key)
      }
    }
    if (attempts.size >= MAX_KEYS) {
      console.warn("[admin-login] attempt table full; refusing until it clears")
      return { success: false, error: TOO_MANY }
    }
    const ip = await clientIp()
    const overIp = countAttempt(`ip:${ip}`, now) > MAX_PER_IP
    const overSource = countAttempt(`source:${email}|${ip}`, now) > MAX_PER_SOURCE
    const overEmail = countAttempt(`email:${email}`, now) > MAX_PER_EMAIL
    if (overIp || overSource || overEmail) {
      console.warn(`[admin-login] rate limited (${level})`)
      return { success: false, error: TOO_MANY }
    }

    await connectDB()
    const admin = await User.findOne({ email, role: "ADMIN" }).select("_id authUserId linkedAuthIds role adminLevel").lean()
    if (!admin) return { success: false, error: NO_MATCH }

    // The Clerk account must be this admin's own: a Clerk id the Mongo user holds.
    const clerk = await clerkClient()
    const ownIds = new Set([admin.authUserId, ...(admin.linkedAuthIds ?? [])])
    const { data: accounts } = await clerk.users.getUserList({ emailAddress: [email], limit: 10 })
    const account = accounts.find((a) => ownIds.has(a.id))
    // The typed email must be one Clerk has verified on that account, not just any address on it.
    const verifiedEmail = account?.emailAddresses.some(
      (a) => a.emailAddress.toLowerCase() === email && a.verification?.status === "verified"
    )
    if (!account || !verifiedEmail || account.banned || account.locked || !account.passwordEnabled) {
      return { success: false, error: NO_MATCH }
    }

    try {
      const { verified } = await clerk.users.verifyPassword({ userId: account.id, password })
      if (!verified) return { success: false, error: NO_MATCH }
    } catch (error) {
      if (isClerkRefusal(error)) {
        console.warn(`[admin-login] wrong password for admin ${admin._id.toString()} (${level})`)
        return { success: false, error: NO_MATCH }
      }
      throw error
    }

    // Only after the password: said earlier, it would tell anyone which emails are admins.
    // A second step is never skipped here, so a two-step account signs in on the hub.
    if (account.twoFactorEnabled) {
      return { success: false, error: "This account uses two-step sign-in. Sign in on WorldStreet instead." }
    }

    if (level === "super" && !isSuperAdmin(admin)) {
      return { success: false, error: "This is an admin account, not a super admin. Sign in at /admin/login instead." }
    }

    attempts.delete(`email:${email}`)
    attempts.delete(`source:${email}|${ip}`)
    const token = await clerk.signInTokens.createSignInToken({ userId: account.id, expiresInSeconds: 60 })
    console.info(`[admin-login] ${level} panel sign-in for admin ${admin._id.toString()}`)
    return { success: true, data: { ticket: token.token } }
  } catch (error) {
    console.error("Admin panel sign-in error:", error)
    return { success: false, error: "Couldn't sign you in right now. Try again in a minute." }
  }
}
