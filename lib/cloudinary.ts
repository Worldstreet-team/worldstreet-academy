import { v2 as cloudinary } from "cloudinary"

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export type UploadType = "image" | "video"

export interface UploadResult {
  url: string
  publicId: string
  width?: number
  height?: number
  duration?: number // For videos, in seconds
  thumbnailUrl?: string // Auto-generated thumbnail for videos
}

export interface UploadOptions {
  folder?: string
  resourceType?: UploadType
  transformation?: Record<string, unknown>[]
  eager?: Record<string, unknown>[] // For video transformations
}

/**
 * Upload a file to Cloudinary
 */
export async function uploadToCloudinary(
  file: string | Buffer,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const {
    folder = "worldstreet-academy",
    resourceType = "image",
    transformation,
    eager,
  } = options

  try {
    const uploadOptions: Record<string, unknown> = {
      folder,
      resource_type: resourceType,
    }

    if (transformation) {
      uploadOptions.transformation = transformation
    }

    // For videos, generate thumbnails automatically
    if (resourceType === "video") {
      uploadOptions.eager = eager || [
        { width: 640, height: 360, crop: "fill", format: "jpg" }, // Thumbnail
        { width: 1280, height: 720, crop: "limit" }, // HD version
      ]
      uploadOptions.eager_async = true
    }

    // Handle base64 or URL string
    const uploadSource = typeof file === "string" ? file : `data:image/png;base64,${file.toString("base64")}`
    
    const result = await cloudinary.uploader.upload(uploadSource, uploadOptions)

    return {
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      duration: result.duration,
      thumbnailUrl: resourceType === "video" 
        ? result.secure_url.replace(/\.[^/.]+$/, ".jpg")
        : undefined,
    }
  } catch (error) {
    console.error("Cloudinary upload error:", error)
    throw new Error("Failed to upload file to Cloudinary")
  }
}

/**
 * Upload a thumbnail image
 */
export async function uploadThumbnail(file: string | Buffer): Promise<UploadResult> {
  return uploadToCloudinary(file, {
    folder: "worldstreet-academy/thumbnails",
    resourceType: "image",
    transformation: [
      { width: 1280, height: 720, crop: "fill" },
      { quality: "auto:good" },
      { format: "webp" },
    ],
  })
}

/**
 * Upload a lesson video
 */
export async function uploadVideo(file: string | Buffer): Promise<UploadResult> {
  return uploadToCloudinary(file, {
    folder: "worldstreet-academy/videos",
    resourceType: "video",
    eager: [
      { width: 640, height: 360, crop: "fill", format: "jpg" }, // Thumbnail
      { streaming_profile: "hd", format: "m3u8" }, // HLS adaptive streaming
    ],
  })
}

/**
 * Delete a file from Cloudinary
 */
export async function deleteFromCloudinary(
  publicId: string,
  resourceType: UploadType = "image"
): Promise<boolean> {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType })
    return true
  } catch (error) {
    console.error("Cloudinary delete error:", error)
    return false
  }
}

/**
 * Generate a signed upload URL for client-side uploads
 */
export function generateUploadSignature(
  folder: string,
  resourceType: UploadType = "image"
) {
  const timestamp = Math.round(Date.now() / 1000)
  
  const signature = cloudinary.utils.api_sign_request(
    {
      timestamp,
      folder,
      resource_type: resourceType,
    },
    process.env.CLOUDINARY_API_SECRET!
  )

  return {
    signature,
    timestamp,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    folder,
  }
}

export { cloudinary }
