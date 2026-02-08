/**
 * @deprecated Cloudinary has been replaced with Cloudflare R2
 * These functions are stubs for backwards compatibility.
 * Use the new R2 upload actions in lib/actions/upload.ts instead.
 */

export type UploadType = "image" | "video"

export interface UploadResult {
  url: string
  publicId: string
  width?: number
  height?: number
  duration?: number
  thumbnailUrl?: string
}

export interface UploadOptions {
  folder?: string
  resourceType?: UploadType
  transformation?: Record<string, unknown>[]
  eager?: Record<string, unknown>[]
}

/**
 * @deprecated Use R2 presigned URLs instead
 */
export async function uploadToCloudinary(
  _file: string | Buffer,
  _options: UploadOptions = {}
): Promise<UploadResult> {
  throw new Error("Cloudinary has been replaced with R2. Use getImageUploadUrl or getVideoUploadUrl from lib/actions/upload.ts")
}

/**
 * @deprecated Use R2 presigned URLs instead  
 */
export async function uploadThumbnail(_file: string | Buffer): Promise<UploadResult> {
  throw new Error("Cloudinary has been replaced with R2. Use getImageUploadUrl from lib/actions/upload.ts")
}

/**
 * @deprecated Use R2 presigned URLs instead
 */
export async function uploadVideo(_file: string | Buffer): Promise<UploadResult> {
  throw new Error("Cloudinary has been replaced with R2. Use getVideoUploadUrl from lib/actions/upload.ts")
}

/**
 * @deprecated R2 deletion should be implemented separately
 */
export async function deleteFromCloudinary(
  publicId: string,
  resourceType: UploadType = "image"
): Promise<boolean> {
  console.warn(`[DEPRECATED] deleteFromCloudinary called for ${resourceType}:${publicId}. R2 deletion not implemented yet.`)
  return true // Return success to not break existing flows
}
