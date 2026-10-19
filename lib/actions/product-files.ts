"use server"

import { z } from "zod/v4"
import connectDB from "@/lib/db"
import { User } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth/actions"
import { MAX_PRODUCT_BYTES, PRODUCT_MIME } from "@/lib/course-format"
import { generatePresignedUploadUrl, generateProductKey, hasPrivateResourceBucket, R2_RESOURCE_BUCKET } from "@/lib/r2"

const UploadInput = z.object({
  filename: z.string().trim().min(1, "Choose a file").max(200, "Choose a file"),
  contentType: z.string().max(200),
  sizeBytes: z.number().int().min(1, "Files can be up to 100 MB").max(MAX_PRODUCT_BYTES, "Files can be up to 100 MB"),
})

/**
 * A presigned PUT into the PRIVATE resources bucket, inside the caller's own
 * products folder. Faculty and approved Marketplace Creators only. The file
 * goes straight from the browser to R2; refused outright while the private
 * bucket isn't configured (it never falls back to the public one).
 */
export async function getProductUploadUrl(
  filename: string,
  contentType: string,
  sizeBytes: number
): Promise<{ success: true; data: { uploadUrl: string; storageKey: string } } | { success: false; error: string }> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "You need to be signed in" }

    let allowed = user.role === "INSTRUCTOR" || user.role === "ADMIN"
    if (!allowed) {
      const row = await User.findById(user.id).select("sellerStatus").lean()
      allowed = row?.sellerStatus === "approved"
    }
    if (!allowed) return { success: false, error: "Only approved Marketplace Creators and faculty can upload files" }

    const parsed = UploadInput.safeParse({ filename, contentType, sizeBytes })
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Choose a file" }
    }
    if (!Object.hasOwn(PRODUCT_MIME, parsed.data.contentType)) {
      return { success: false, error: "Upload a PDF, EPUB, Word, Excel, PowerPoint, CSV or ZIP file" }
    }
    if (!hasPrivateResourceBucket()) return { success: false, error: "File uploads aren't available right now" }

    const storageKey = generateProductKey(user.id, parsed.data.filename)
    // The declared size is signed in as Content-Length, so a PUT of any other size fails the signature.
    const { uploadUrl } = await generatePresignedUploadUrl(
      storageKey,
      parsed.data.contentType,
      900,
      R2_RESOURCE_BUCKET,
      parsed.data.sizeBytes
    )
    return { success: true, data: { uploadUrl, storageKey } }
  } catch (error) {
    console.error("Product upload URL error:", error)
    return { success: false, error: "Couldn't prepare the upload — try again" }
  }
}
