"use server"

import { z } from "zod/v4"
import { getCurrentUser } from "@/lib/auth"
import {
  generatePresignedUploadUrl,
  generateFileKey,
  generateApplicationDocumentKey,
  hasPrivateResourceBucket,
  R2_RESOURCE_BUCKET,
} from "@/lib/r2"

export type PresignedUrlResponse = {
  success: boolean
  uploadUrl?: string
  publicUrl?: string
  key?: string
  error?: string
}

/**
 * Get a presigned URL for uploading an image (thumbnail)
 */
export async function getImageUploadUrl(
  filename: string,
  contentType: string
): Promise<PresignedUrlResponse> {
  try {
    if (!(await getCurrentUser())) return { success: false, error: "Sign in to upload files." }

    if (!contentType.startsWith("image/")) {
      return { success: false, error: "Invalid file type. Please upload an image." }
    }

    const key = generateFileKey("image", filename)
    const { uploadUrl, publicUrl } = await generatePresignedUploadUrl(key, contentType)

    return { success: true, uploadUrl, publicUrl, key }
  } catch (error) {
    console.error("Image upload URL error:", error)
    return { success: false, error: "Failed to prepare upload. Please try again." }
  }
}

/**
 * Get a presigned URL for uploading a video
 */
export async function getVideoUploadUrl(
  filename: string,
  contentType: string
): Promise<PresignedUrlResponse> {
  try {
    if (!(await getCurrentUser())) return { success: false, error: "Sign in to upload files." }

    if (!contentType.startsWith("video/")) {
      return { success: false, error: "Invalid file type. Please upload a video." }
    }

    const key = generateFileKey("video", filename)
    const { uploadUrl, publicUrl } = await generatePresignedUploadUrl(key, contentType)

    return { success: true, uploadUrl, publicUrl, key }
  } catch (error) {
    console.error("Video upload URL error:", error)
    return { success: false, error: "Failed to prepare upload. Please try again." }
  }
}

/**
 * Get a presigned URL for uploading an audio file (voice note)
 */
export async function getAudioUploadUrl(
  filename: string,
  contentType: string
): Promise<PresignedUrlResponse> {
  try {
    if (!(await getCurrentUser())) return { success: false, error: "Sign in to upload files." }

    if (!contentType.startsWith("audio/")) {
      return { success: false, error: "Invalid file type. Please upload an audio file." }
    }

    const key = generateFileKey("audio", filename)
    const { uploadUrl, publicUrl } = await generatePresignedUploadUrl(key, contentType)

    return { success: true, uploadUrl, publicUrl, key }
  } catch (error) {
    console.error("Audio upload URL error:", error)
    return { success: false, error: "Failed to prepare upload. Please try again." }
  }
}

/** Largest application PDF (2026-11-12): the form never capped it; 25 MB, like assignment files. */
const DOCUMENT_MAX_BYTES = 25 * 1024 * 1024

/** What a document upload may be — server actions take any argument, so every field is checked. */
const DocumentUploadInput = z.object({
  filename: z.string({ error: "Choose a PDF" }).trim().min(1, "Choose a PDF").max(200, "Rename the file to something shorter"),
  contentType: z.literal("application/pdf", { error: "Invalid file type. Please upload a PDF." }),
  sizeBytes: z
    .number({ error: "Choose the PDF again" })
    .int("Choose the PDF again")
    .min(1, "That PDF is empty")
    .max(DOCUMENT_MAX_BYTES, "PDFs can be up to 25 MB"),
})

/**
 * Get a presigned URL for uploading a document (CV / credentials — PDF only).
 * Used by the instructor application flow.
 *
 * 2026-11-12: the PDF goes to the PRIVATE resources bucket, inside the
 * applicant's own folder (lib/r2.ts `applicationDocumentKeyPrefix`), and only
 * the key comes back — never a public URL. The declared size is signed in as
 * Content-Length, so a PUT of any other size fails. Refused outright while
 * R2_RESOURCES_BUCKET_NAME is unset (never a fallback to the public bucket).
 * The application stores the key (`answers.cvKey` / `answers.extraDocumentKey`)
 * and admins open it through getApplicationDocumentUrl (a 5-minute signed link).
 */
export async function getDocumentUploadUrl(
  filename: string,
  contentType: string,
  sizeBytes: number
): Promise<PresignedUrlResponse> {
  try {
    // 2026-11-12: the user is kept, since the key is built inside their own folder.
    // if (!(await getCurrentUser())) return { success: false, error: "Sign in to upload files." }
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "Sign in to upload files." }

    // 2026-11-12: checked with the size below (DocumentUploadInput).
    // if (contentType !== "application/pdf") {
    //   return { success: false, error: "Invalid file type. Please upload a PDF." }
    // }
    const parsed = DocumentUploadInput.safeParse({ filename, contentType, sizeBytes })
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Choose a PDF" }
    }
    if (!hasPrivateResourceBucket()) {
      return {
        success: false,
        error: "PDF uploads aren't available right now. Paste a link to your document instead.",
      }
    }

    // 2026-11-12: this put applicants' CVs in the PUBLIC bucket and returned their public URL.
    // const timestamp = Date.now()
    // const randomId = Math.random().toString(36).substring(2, 10)
    // const key = `worldstreet-academy/documents/${timestamp}-${randomId}.pdf`
    // const { uploadUrl, publicUrl } = await generatePresignedUploadUrl(key, contentType)
    //
    // return { success: true, uploadUrl, publicUrl, key }
    const key = generateApplicationDocumentKey(user.id)
    const { uploadUrl } = await generatePresignedUploadUrl(
      key,
      parsed.data.contentType,
      900,
      R2_RESOURCE_BUCKET,
      parsed.data.sizeBytes
    )
    return { success: true, uploadUrl, key }
  } catch (error) {
    console.error("Document upload URL error:", error)
    return { success: false, error: "Failed to prepare upload. Please try again." }
  }
}
