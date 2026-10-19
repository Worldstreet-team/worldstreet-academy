"use server"

import { z } from "zod/v4"
import connectDB from "@/lib/db"
import { Course, Enrollment, User } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth/actions"
import {
  FORMAT_LABEL,
  MAX_PRODUCT_BYTES,
  PRODUCT_MIME,
  courseFormatOf,
  isFileFormat,
  productTypeLabel,
  safeDownloadFilename,
  type FileFormat,
} from "@/lib/course-format"
import { programArt } from "@/lib/school-art"
import {
  generatePresignedDownloadUrl,
  generatePresignedUploadUrl,
  generateProductKey,
  hasPrivateResourceBucket,
  R2_RESOURCE_BUCKET,
} from "@/lib/r2"

const OBJECT_ID = /^[a-f0-9]{24}$/

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

type ProductAccess = {
  course: {
    _id: { toString(): string }
    slug: string
    title: string
    shortDescription?: string | null
    thumbnailUrl?: string | null
    kind?: "program" | "marketplace" | "new-economy" | null
    format?: "course" | "masterclass" | "workshop" | "template" | "guide" | null
    productFile?: { key: string; filename: string; mimeType: string; sizeBytes: number } | null
    instructor: { _id: { toString(): string }; firstName?: string; lastName?: string; role?: string } | null
  }
  format: FileFormat
  viewer: "buyer" | "staff"
}

/**
 * The one access rule for a file product: an admin, the course's own owner, or
 * a holder of an access-granting enrollment. The course's own status is never
 * checked, so a buyer keeps the file after the listing is closed or archived.
 */
async function loadOwnedProduct(
  user: { id: string; role: string },
  courseId: string
): Promise<ProductAccess | "no_file" | { noAccess: FileFormat }> {
  if (!OBJECT_ID.test(courseId)) return "no_file"
  const course = await Course.findById(courseId)
    .select("slug title shortDescription thumbnailUrl school kind format productFile instructor")
    .populate("instructor", "firstName lastName role")
    .lean()
  if (!course) return "no_file"
  const format = courseFormatOf(course)
  if (!isFileFormat(format) || !course.productFile?.key) return "no_file"

  const instructor = course.instructor as unknown as ProductAccess["course"]["instructor"]
  const isStaff = user.role === "ADMIN" || instructor?._id.toString() === user.id
  if (!isStaff) {
    const held = await Enrollment.exists({
      user: user.id,
      course: courseId,
      status: { $in: ["active", "completed"] },
    })
    if (!held) return { noAccess: format }
  }
  return {
    course: { ...(course as unknown as ProductAccess["course"]), instructor },
    format,
    viewer: isStaff ? "staff" : "buyer",
  }
}

/**
 * A 5-minute signed download of a template or guide, for its buyer, its owner
 * or an admin. Never a public URL: the file lives in the private bucket and
 * the key never leaves the server. Fails closed while that bucket is unset.
 */
export async function getProductDownloadUrl(
  courseId: string
): Promise<{ success: true; data: { url: string } } | { success: false; error: string }> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "You need to be signed in" }
    if (typeof courseId !== "string" || !OBJECT_ID.test(courseId)) return { success: false, error: "File not found" }
    if (!hasPrivateResourceBucket()) return { success: false, error: "Downloads aren't available right now" }

    const found = await loadOwnedProduct(user, courseId)
    if (found === "no_file") return { success: false, error: "File not found" }
    if ("noAccess" in found) {
      return { success: false, error: `Buy this ${FORMAT_LABEL[found.noAccess].toLowerCase()} to download it` }
    }

    const file = found.course.productFile!
    const url = await generatePresignedDownloadUrl(file.key, {
      expiresIn: 300,
      downloadFilename: safeDownloadFilename(file.filename, found.course.title),
      bucket: R2_RESOURCE_BUCKET,
    })
    return { success: true, data: { url } }
  } catch (error) {
    console.error("Product download URL error:", error)
    return { success: false, error: "Couldn't prepare the download — try again" }
  }
}

export type OwnedProduct = {
  id: string
  slug: string
  title: string
  shortDescription: string | null
  thumbnailUrl: string | null
  format: FileFormat
  file: { filename: string; typeLabel: string; sizeBytes: number }
  sellerName: string | null
  viewer: "buyer" | "staff"
}

/**
 * The product home's read model for a template or guide the caller owns (bought,
 * owns or administers); null for anything else, so the page falls through to
 * the normal course flow. Carries no storage key.
 */
export async function getOwnedProduct(courseId: string): Promise<OwnedProduct | null> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return null
    const found = await loadOwnedProduct(user, courseId)
    if (typeof found === "string" || "noAccess" in found) return null

    const { course } = found
    const owner = course.instructor
    return {
      id: course._id.toString(),
      slug: course.slug,
      title: course.title,
      shortDescription: course.shortDescription ?? null,
      thumbnailUrl: programArt(course as Parameters<typeof programArt>[0]),
      format: found.format,
      file: {
        filename: safeDownloadFilename(course.productFile!.filename, course.title),
        typeLabel: productTypeLabel(course.productFile!.mimeType),
        sizeBytes: course.productFile!.sizeBytes,
      },
      sellerName:
        owner?.role === "USER" ? `${owner.firstName ?? ""} ${owner.lastName ?? ""}`.trim() || null : null,
      viewer: found.viewer,
    }
  } catch (error) {
    console.error("Owned product error:", error)
    return null
  }
}
