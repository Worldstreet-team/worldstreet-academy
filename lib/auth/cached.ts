import { cache } from "react"
import { auth, currentUser } from "@clerk/nextjs/server"
import connectDB from "@/lib/db"
import { User } from "@/lib/db/models"
import type { LocalUser } from "./sync"
import { syncUserToLocal } from "./sync"
import type { AuthUser } from "./types"

/**
 * Request-scoped cached version of getCurrentUser for RSC layouts/pages.
 *
 * React.cache() deduplicates calls within the same request — if both
 * the layout and a child page call this, the DB query only runs once.
 *
 * NOTE: This is NOT a "use server" function — it runs in the RSC context.
 * For server actions, continue using getCurrentUser from ./actions.
 */
export const getCachedUser = cache(async (): Promise<LocalUser | null> => {
  try {
    const { userId } = await auth()
    if (!userId) return null

    await connectDB()
    const user = await User.findOne({ authUserId: userId }).lean()

    if (user) {
      return {
        id: (user._id as { toString(): string }).toString(),
        authUserId: user.authUserId as string,
        email: user.email as string,
        username: user.username as string,
        firstName: user.firstName as string,
        lastName: user.lastName as string,
        bio: (user.bio as string) ?? "",
        avatarUrl: (user.avatarUrl as string) ?? "",
        signatureUrl: (user.signatureUrl as string) ?? null,
        role: user.role as "USER" | "INSTRUCTOR" | "ADMIN",
        verified: user.verified as boolean,
        walletBalance: (user.walletBalance as number) ?? 0,
        hasOnboarded: (user.hasOnboarded as boolean) ?? false,
        preferredLanguage: (user.preferredLanguage as string) ?? null,
        createdAt: (user.createdAt as Date).toISOString(),
        updatedAt: (user.updatedAt as Date).toISOString(),
      }
    }

    // User not in local DB — sync from Clerk
    const clerkUser = await currentUser()
    if (!clerkUser) return null

    const authUser: AuthUser = {
      userId: clerkUser.id,
      email: clerkUser.emailAddresses[0]?.emailAddress || "",
      firstName: clerkUser.firstName || "",
      lastName: clerkUser.lastName || "",
      role: (clerkUser.publicMetadata?.role as "user" | "instructor" | "admin") || "user",
      isVerified: clerkUser.emailAddresses[0]?.verification?.status === "verified",
      createdAt: new Date(clerkUser.createdAt).toISOString(),
    }

    return await syncUserToLocal(authUser)
  } catch (error) {
    console.error("[Auth] getCachedUser error:", error)
    return null
  }
})
