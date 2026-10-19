import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import type { Readable } from "node:stream"

// R2 Client configuration
const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  // Disable automatic checksums for R2 compatibility
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
})

export const R2_BUCKET = process.env.R2_BUCKET_NAME!
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!

/**
 * Bucket for PAID, enrollment-gated files (course resources / eBooks).
 *
 * ⚠️ This MUST be a bucket with **no public access** (no r2.dev URL, no public
 * custom domain). R2 public access is per-bucket, not per-prefix: if paid
 * resources live in the same bucket as public thumbnails, anyone who guesses
 * the key can fetch the file directly and the presigned-URL paywall becomes
 * decorative. We never store or return a public URL for these objects — only
 * the key, resolved to a short-lived signed URL at download time.
 */
export const R2_RESOURCE_BUCKET = process.env.R2_RESOURCES_BUCKET_NAME || R2_BUCKET

/** True when paid resources would land in the publicly-readable bucket. */
export function resourceBucketIsPublic(): boolean {
  return !process.env.R2_RESOURCES_BUCKET_NAME && Boolean(R2_PUBLIC_URL)
}

export type UploadType = "image" | "video" | "audio"

/**
 * Generate a presigned URL for uploading a file to R2
 */
export async function generatePresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600, // 1 hour
  bucket: string = R2_BUCKET,
  contentLength?: number // when given, signed as Content-Length: the PUT must be exactly this size
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    ...(contentLength !== undefined ? { ContentLength: contentLength } : {}),
  })

  const uploadUrl = await getSignedUrl(r2Client, command, {
    expiresIn,
    // Sign the content-type header so browser can send it (and the length, when bound)
    signableHeaders: new Set(contentLength !== undefined ? ["content-type", "content-length"] : ["content-type"]),
  })
  const publicUrl = `${R2_PUBLIC_URL}/${key}`

  return { uploadUrl, publicUrl }
}

/**
 * Short-lived signed GET for a gated file. The caller MUST have already
 * verified entitlement (enrollment / ownership) — this only mints the URL.
 * `downloadFilename` forces a browser download with the original name rather
 * than the opaque storage key.
 */
export async function generatePresignedDownloadUrl(
  key: string,
  opts: { expiresIn?: number; downloadFilename?: string; bucket?: string } = {}
): Promise<string> {
  const { expiresIn = 300, downloadFilename, bucket = R2_RESOURCE_BUCKET } = opts
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ...(downloadFilename
      ? {
          ResponseContentDisposition: `attachment; filename="${downloadFilename.replace(/"/g, "")}"`,
        }
      : {}),
  })
  return getSignedUrl(r2Client, command, { expiresIn })
}

/**
 * Delete a file from R2
 */
export async function deleteFromR2(key: string, bucket: string = R2_BUCKET): Promise<boolean> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
    await r2Client.send(command)
    return true
  } catch (error) {
    console.error("R2 delete error:", error)
    return false
  }
}

/**
 * Generate a unique file key for R2
 */
export function generateFileKey(
  type: UploadType,
  originalFilename: string
): string {
  const timestamp = Date.now()
  const randomId = Math.random().toString(36).substring(2, 10)
  const extension = originalFilename.split(".").pop()?.toLowerCase() || 
    (type === "image" ? "webp" : type === "video" ? "mp4" : "webm")
  const folder = type === "image" ? "thumbnails" : type === "video" ? "videos" : "audio"
  
  return `worldstreet-academy/${folder}/${timestamp}-${randomId}.${extension}`
}

/**
 * Key for a gated course resource. Unguessable by construction (random id) —
 * but that is defence in depth, not the control: the control is the private
 * bucket + signed URLs (see R2_RESOURCE_BUCKET).
 */
export function generateResourceKey(originalFilename: string): string {
  const timestamp = Date.now()
  const randomId = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10)
  const extension = originalFilename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin"
  return `worldstreet-academy/resources/${timestamp}-${randomId}.${extension}`
}

/**
 * Student submission files refuse to upload unless the PRIVATE resources bucket
 * is configured. Unlike course resources they never fall back to the public
 * bucket (R2_RESOURCE_BUCKET's `|| R2_BUCKET`).
 */
export function hasPrivateResourceBucket(): boolean {
  return Boolean(process.env.R2_RESOURCES_BUCKET_NAME)
}

/** The folder one student's files for one assignment live in — submitAssignment only accepts keys inside it. */
export function submissionKeyPrefix(assignmentId: string, userId: string): string {
  return `worldstreet-academy/submissions/${assignmentId}/${userId}/`
}

/** Key for one submission file: inside the student's folder, unguessable, extension kept. */
export function generateSubmissionKey(assignmentId: string, userId: string, originalFilename: string): string {
  const randomId = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10)
  const extension = originalFilename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin"
  return `${submissionKeyPrefix(assignmentId, userId)}${Date.now()}-${randomId}.${extension}`
}

/**
 * The folder one uploader's template and guide files live in. PRIVATE bucket
 * only: a save accepts only keys inside the saving user's folder. The prefix is
 * the uploader's, not the course's, so a file can be uploaded before the
 * course's first save.
 */
export function productKeyPrefix(userId: string): string {
  return `worldstreet-academy/products/${userId}/`
}

/** Key for one product file: inside the uploader's folder, unguessable, extension kept. PRIVATE bucket only. */
export function generateProductKey(userId: string, originalFilename: string): string {
  const randomId = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10)
  const extension = originalFilename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin"
  return `${productKeyPrefix(userId)}${Date.now()}-${randomId}.${extension}`
}

/**
 * The folder one learner's ESPEE payment proofs live in — submitEspeePayment
 * only accepts keys inside it. Private bucket only, like submissions: callers
 * refuse outright while hasPrivateResourceBucket() is false.
 */
export function paymentProofKeyPrefix(userId: string): string {
  return `worldstreet-academy/payment-proofs/${userId}/`
}

/**
 * Key for one payment proof: inside the learner's folder, unguessable. The
 * extension comes from the validated content type (lib/espee.ts), not the
 * file name, so the key alone says what the receipt is.
 */
export function generatePaymentProofKey(userId: string, extension: string): string {
  const randomId = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10)
  return `${paymentProofKeyPrefix(userId)}${Date.now()}-${randomId}.${extension.replace(/[^a-z0-9]/g, "")}`
}

/**
 * Where a class recording lives — PRIVATE bucket only. Built from server-side
 * ids (never a browser value) and `rtkRecordingId`, so a retried copy writes
 * the same object.
 */
export function recordingKey(courseId: string, meetingId: string, rtkRecordingId: string): string {
  const safe = (v: string) => v.replace(/[^a-zA-Z0-9-]/g, "")
  return `worldstreet-academy/recordings/${safe(courseId)}/${safe(meetingId)}/${safe(rtkRecordingId)}.mp4`
}

/**
 * Stream a body of known length into the PRIVATE resources bucket with one
 * PutObject (no buffering in memory). R2 caps a single PUT at ~5 GB. Throws
 * when the private bucket isn't configured — callers must fail closed, never
 * fall back to the public bucket.
 */
export async function putPrivateObjectStream(
  key: string,
  body: Readable,
  contentLength: number,
  contentType: string
): Promise<void> {
  const bucket = process.env.R2_RESOURCES_BUCKET_NAME
  if (!bucket) throw new Error("R2_RESOURCES_BUCKET_NAME is not set")
  await r2Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentLength: contentLength,
      ContentType: contentType,
    })
  )
}

export { r2Client }
