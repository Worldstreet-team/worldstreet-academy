import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

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
  bucket: string = R2_BUCKET
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  })

  const uploadUrl = await getSignedUrl(r2Client, command, {
    expiresIn,
    // Sign the content-type header so browser can send it
    signableHeaders: new Set(["content-type"]),
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

export { r2Client }
