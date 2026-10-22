"use server"

import { z } from "zod/v4"
import connectDB from "@/lib/db"
import { User } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth"
import { R2_PUBLIC_URL } from "@/lib/r2"
import { revalidatePath } from "next/cache"

// A signature is printed on certificates, so it may only be an image we
// uploaded: a link into our public bucket, never any URL a client sends.
const SignatureUrl = z
  .url({ protocol: /^https$/ })
  .max(2048)
  .refine((url) => Boolean(R2_PUBLIC_URL) && url.startsWith(`${R2_PUBLIC_URL}/`))

/**
 * Save the user's signature URL (works for both instructor and student)
 */
export async function saveSignature(signatureUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const parsed = SignatureUrl.safeParse(signatureUrl)
    if (!parsed.success) return { success: false, error: "Upload the signature again" }

    await User.findByIdAndUpdate(currentUser.id, { signatureUrl: parsed.data })

    revalidatePath("/instructor/settings")
    revalidatePath("/dashboard/certificates")

    return { success: true }
  } catch (error) {
    console.error("Save signature error:", error)
    return { success: false, error: "Failed to save signature" }
  }
}

/**
 * Get the current user's signature URL
 */
export async function getMySignature(): Promise<string | null> {
  try {
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) return null

    const user = await User.findById(currentUser.id).select("signatureUrl").lean()
    return user?.signatureUrl ?? null
  } catch (error) {
    console.error("Get signature error:", error)
    return null
  }
}
