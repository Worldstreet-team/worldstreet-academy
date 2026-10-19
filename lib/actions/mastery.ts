"use server"

import connectDB from "@/lib/db"
import { getCurrentUser } from "@/lib/auth/actions"
import { myMastery } from "@/lib/mastery-inputs"
import type { MyMastery } from "@/lib/mastery-score"

/** The signed-in student's Mastery Score per program for the dashboard hero; null when signed out or on error. */
export async function getMyMastery(): Promise<MyMastery[] | null> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return null
    return await myMastery(user.id)
  } catch (error) {
    console.error("Get my mastery error:", error)
    return null
  }
}
