"use server"

import connectDB from "@/lib/db"
import { getCurrentUser } from "@/lib/auth/actions"
import { pointsSummary, type PointsSummary } from "@/lib/points"

/** The signed-in student's points for the dashboard tile; null when signed out or on error. */
export async function getMyPointsSummary(): Promise<PointsSummary | null> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return null
    return await pointsSummary(user.id)
  } catch (error) {
    console.error("Get my points error:", error)
    return null
  }
}
