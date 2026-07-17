"use server"

import { revalidatePath } from "next/cache"
import connectDB from "@/lib/db"
import { Course, Enrollment, Resource, ResourceDownload } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth/actions"
import {
  generatePresignedUploadUrl,
  generatePresignedDownloadUrl,
  generateResourceKey,
  deleteFromR2,
  resourceBucketIsPublic,
  R2_RESOURCE_BUCKET,
} from "@/lib/r2"
import type { ResourceKind } from "@/lib/db/models/resource"

// Instructors upload learning materials, students download them — but only
// once the server has confirmed they're enrolled. Files live in a private
// bucket and are only ever surfaced as short-lived signed URLs; a public
// direct link would make the paywall decorative.

const MAX_RESOURCE_BYTES = 100 * 1024 * 1024 // 100 MB

/** Accepted document types, mapped to the default resource kind. */
const ALLOWED_MIME: Record<string, ResourceKind> = {
  "application/pdf": "pdf",
  "application/epub+zip": "ebook",
  "application/x-mobipocket-ebook": "ebook",
  "application/msword": "worksheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "worksheet",
  "application/vnd.ms-excel": "template",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "template",
  "application/vnd.ms-powerpoint": "slides",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "slides",
  "text/csv": "template",
  "application/zip": "template",
}

export type ResourceListItem = {
  id: string
  title: string
  description: string
  kind: ResourceKind
  filename: string
  sizeBytes: number
  order: number
  isFree: boolean
  lessonId: string | null
  externalUrl: string | null
  downloadCount: number
  /** True when this viewer may not download it yet (not enrolled, not free). */
  locked: boolean
}

async function assertCourseOwner(courseId: string) {
  const user = await getCurrentUser()
  if (!user) return { error: "You need to be signed in" as const }
  const course = await Course.findById(courseId).select("instructor")
  if (!course) return { error: "Course not found" as const }
  if (course.instructor.toString() !== user.id && user.role !== "ADMIN") {
    return { error: "You don't own this course" as const }
  }
  return { user, course }
}

/**
 * Presigned PUT so the instructor's browser uploads straight to R2 (the file
 * never touches our server). Validates type and size before issuing.
 */
export async function getResourceUploadUrl(
  courseId: string,
  filename: string,
  contentType: string,
  sizeBytes: number
): Promise<{ success: boolean; uploadUrl?: string; storageKey?: string; kind?: ResourceKind; error?: string }> {
  try {
    await connectDB()
    const owner = await assertCourseOwner(courseId)
    if ("error" in owner) return { success: false, error: owner.error }

    const kind = ALLOWED_MIME[contentType]
    if (!kind) {
      return {
        success: false,
        error: "Unsupported file type. Upload a PDF, eBook, document, spreadsheet, slide deck or zip.",
      }
    }
    if (sizeBytes <= 0 || sizeBytes > MAX_RESOURCE_BYTES) {
      return { success: false, error: `File is too large (max ${MAX_RESOURCE_BYTES / 1024 / 1024} MB).` }
    }

    const storageKey = generateResourceKey(filename)
    const { uploadUrl } = await generatePresignedUploadUrl(storageKey, contentType, 3600, R2_RESOURCE_BUCKET)
    return { success: true, uploadUrl, storageKey, kind }
  } catch (error) {
    console.error("Resource upload URL error:", error)
    return { success: false, error: "Failed to prepare upload. Please try again." }
  }
}

/** Attach an uploaded file (or an external link) to a course/lesson. */
export async function addResource(input: {
  courseId: string
  lessonId?: string | null
  title: string
  description?: string
  kind: ResourceKind
  storageKey?: string | null
  externalUrl?: string | null
  filename?: string
  mimeType?: string
  sizeBytes?: number
  isFree?: boolean
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    await connectDB()
    const owner = await assertCourseOwner(input.courseId)
    if ("error" in owner) return { success: false, error: owner.error }

    if (!input.title?.trim()) return { success: false, error: "Give the resource a title" }
    if (input.kind === "link") {
      if (!input.externalUrl?.trim()) return { success: false, error: "A link resource needs a URL" }
    } else if (!input.storageKey) {
      return { success: false, error: "Upload a file first" }
    }

    const count = await Resource.countDocuments({ course: input.courseId })
    const doc = await Resource.create({
      course: input.courseId,
      lesson: input.lessonId || null,
      title: input.title.trim(),
      description: input.description?.trim() || "",
      kind: input.kind,
      storageKey: input.kind === "link" ? null : input.storageKey,
      externalUrl: input.kind === "link" ? input.externalUrl!.trim() : null,
      filename: input.filename || "",
      mimeType: input.mimeType || "",
      sizeBytes: input.sizeBytes || 0,
      order: count,
      isFree: Boolean(input.isFree),
    })

    revalidatePath(`/dashboard/courses/${input.courseId}`)
    revalidatePath(`/instructor/courses/${input.courseId}`)
    return { success: true, id: doc._id.toString() }
  } catch (error) {
    console.error("Add resource error:", error)
    return { success: false, error: "Failed to add resource" }
  }
}

export async function deleteResource(resourceId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await connectDB()
    const resource = await Resource.findById(resourceId)
    if (!resource) return { success: false, error: "Resource not found" }

    const owner = await assertCourseOwner(resource.course.toString())
    if ("error" in owner) return { success: false, error: owner.error }

    if (resource.storageKey) {
      // Best-effort: a failed object delete shouldn't strand the DB record.
      await deleteFromR2(resource.storageKey, R2_RESOURCE_BUCKET)
    }
    await resource.deleteOne()

    revalidatePath(`/dashboard/courses/${resource.course.toString()}`)
    revalidatePath(`/instructor/courses/${resource.course.toString()}`)
    return { success: true }
  } catch (error) {
    console.error("Delete resource error:", error)
    return { success: false, error: "Failed to delete resource" }
  }
}

/** Does this viewer have download rights for the course's paid materials? */
async function hasCourseAccess(courseId: string, user: { id: string; role: string } | null) {
  if (!user) return false
  if (user.role === "ADMIN") return true
  const course = await Course.findById(courseId).select("instructor")
  if (course && course.instructor.toString() === user.id) return true
  const enrollment = await Enrollment.findOne({
    user: user.id,
    course: courseId,
    status: { $in: ["active", "completed"] },
  }).select("_id")
  return Boolean(enrollment)
}

/**
 * Resource metadata for a course. Always safe to call: it returns titles and
 * sizes so the course page can advertise what's included, but marks anything
 * the viewer can't have as `locked` and never leaks a URL or storage key.
 */
export async function listCourseResources(courseId: string): Promise<ResourceListItem[]> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    const access = await hasCourseAccess(courseId, user)

    const resources = await Resource.find({ course: courseId }).sort({ order: 1 }).lean()
    return resources.map((r) => {
      const unlocked = access || r.isFree
      return {
        id: r._id.toString(),
        title: r.title,
        description: r.description,
        kind: r.kind,
        filename: r.filename,
        sizeBytes: r.sizeBytes,
        order: r.order,
        isFree: r.isFree,
        lessonId: r.lesson ? r.lesson.toString() : null,
        // Only expose the destination of a link once unlocked.
        externalUrl: unlocked ? r.externalUrl : null,
        downloadCount: r.downloadCount,
        locked: !unlocked,
      }
    })
  } catch (error) {
    console.error("List course resources error:", error)
    return []
  }
}

/**
 * Mint a short-lived download URL — the paywall. Enrollment is verified here,
 * server-side, on every request; the URL expires in 5 minutes so a shared link
 * dies quickly.
 */
export async function getResourceDownloadUrl(
  resourceId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "You need to be signed in" }

    const resource = await Resource.findById(resourceId)
    if (!resource) return { success: false, error: "Resource not found" }

    if (!resource.isFree) {
      const access = await hasCourseAccess(resource.course.toString(), user)
      if (!access) {
        return { success: false, error: "Enroll in this course to download its materials" }
      }
    }

    if (resource.kind === "link") {
      if (!resource.externalUrl) return { success: false, error: "This link is not available" }
      return { success: true, url: resource.externalUrl }
    }
    if (!resource.storageKey) return { success: false, error: "This file is not available" }

    if (resourceBucketIsPublic()) {
      // Loud, because it means the signed URL below is not actually protecting
      // anything — the object is fetchable without it.
      console.warn(
        "[Resources] R2_RESOURCES_BUCKET_NAME is unset — paid resources are in the PUBLIC bucket; signed URLs are not enforcing the paywall."
      )
    }

    const url = await generatePresignedDownloadUrl(resource.storageKey, {
      expiresIn: 300,
      downloadFilename: resource.filename || `${resource.title}`,
    })

    // Track the issue (analytics + audit trail); never block the download on it.
    try {
      await Promise.all([
        ResourceDownload.create({ resource: resource._id, course: resource.course, user: user.id }),
        Resource.updateOne({ _id: resource._id }, { $inc: { downloadCount: 1 } }),
      ])
    } catch (err) {
      console.error("[Resources] download tracking failed:", err)
    }

    return { success: true, url }
  } catch (error) {
    console.error("Get resource download URL error:", error)
    return { success: false, error: "Failed to prepare download" }
  }
}
