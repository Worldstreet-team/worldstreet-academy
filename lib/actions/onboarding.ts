"use server"

import { revalidatePath } from "next/cache"
import connectDB from "@/lib/db"
import { User } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth/actions"

export async function completeOnboarding() {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { success: false }

  await connectDB()
  await User.findByIdAndUpdate(currentUser.id, { hasOnboarded: true })

  revalidatePath("/")
  // The onboarding modal is mounted from the (platform) layout off this flag.
  revalidatePath("/dashboard", "layout")

  return { success: true }
}
