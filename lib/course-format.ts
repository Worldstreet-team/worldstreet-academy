import type { CourseKind } from "@/lib/db/models"

/**
 * The one home of marketplace formats and file-product limits (owner,
 * 2026-10-19; institutional blueprint §17). Pure and client-safe: its only
 * import is a type, because the Course model imports the values from here.
 *
 * Course, masterclass and workshop are lesson-based and differ only in label.
 * Template and guide are file formats: one downloadable file, no lessons.
 */
export const COURSE_FORMATS = ["course", "masterclass", "workshop", "template", "guide"] as const
export type CourseFormat = (typeof COURSE_FORMATS)[number]
export type FileFormat = Extract<CourseFormat, "template" | "guide">

export const FORMAT_LABEL: Record<CourseFormat, string> = {
  course: "Course", masterclass: "Masterclass", workshop: "Workshop", template: "Template", guide: "Guide",
}
export const FORMAT_PLURAL: Record<CourseFormat, string> = {
  course: "courses", masterclass: "masterclasses", workshop: "workshops", template: "templates", guide: "guides",
}
/** Drafted from §17 for the owner's sign-off: /sell and the editor's helper line. */
export const FORMAT_BLURB: Record<CourseFormat, string> = {
  course: "A structured course of pre-recorded lessons.",
  masterclass: "An expert's deep dive into one subject, in lessons.",
  workshop: "A hands-on session in lessons, built around doing the work.",
  template: "A ready-to-use file, such as a spreadsheet, planner or toolkit, that buyers download.",
  guide: "A written guide or eBook, delivered as one download.",
}

/** Accepted product files → the short type buyers see. */
export const PRODUCT_MIME: Readonly<Record<string, string>> = {
  "application/pdf": "PDF",
  "application/epub+zip": "EPUB",
  "application/msword": "Word",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "application/vnd.ms-excel": "Excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
  "application/vnd.ms-powerpoint": "PowerPoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint",
  "text/csv": "CSV",
  "application/zip": "ZIP",
  "application/x-zip-compressed": "ZIP",
}
export const PRODUCT_ACCEPT = ".pdf,.epub,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.zip"
export const MAX_PRODUCT_BYTES = 100 * 1024 * 1024

/** A product file as the editor and the save carry it (no upload date, no URL). */
export type ProductFileValue = { key: string; filename: string; mimeType: string; sizeBytes: number }

export function isCourseFormat(value: unknown): value is CourseFormat {
  return typeof value === "string" && (COURSE_FORMATS as readonly string[]).includes(value)
}

export function isFileFormat(format: CourseFormat | null | undefined): format is FileFormat {
  return format === "template" || format === "guide"
}

/**
 * A course's format. Only marketplace courses have one: null for programs,
 * New Economy and legacy rows (no kind); a marketplace course with no stored
 * format reads as "course".
 */
export function courseFormatOf(course: { kind?: CourseKind | null; format?: CourseFormat | null }): CourseFormat | null {
  if (course.kind !== "marketplace") return null
  return course.format ?? "course"
}

/** "1 template", "3 masterclasses". */
export function formatCount(n: number, format: CourseFormat): string {
  return n === 1 ? `1 ${FORMAT_LABEL[format].toLowerCase()}` : `${n} ${FORMAT_PLURAL[format]}`
}

export function productTypeLabel(mimeType: string): string {
  return Object.hasOwn(PRODUCT_MIME, mimeType) ? PRODUCT_MIME[mimeType] : "File"
}

/** "" for 0, whole KB (at least 1) under 1 MB, one-decimal MB from there. */
export function fileSizeLabel(bytes: number): string {
  if (!bytes) return ""
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** Whether a course has what its buyers receive: a file for file formats, otherwise a lesson. */
export function hasDeliverable(course: {
  format: CourseFormat | null
  totalLessons: number
  productFile: { key: string } | null
}): boolean {
  return isFileFormat(course.format) ? course.productFile !== null : course.totalLessons > 0
}

/**
 * A filename that is safe inside a Content-Disposition header. The stored
 * filename is creator-claimed, so it is never trusted: only letters, digits,
 * spaces and . _ ( ) - survive (CR, LF, quotes, path separators and every other
 * control or non-ASCII character become "_"), capped at 100 characters. An
 * empty or dots-only result falls back to a slug of the product title.
 */
export function safeDownloadFilename(filename: string | null | undefined, title: string): string {
  const cleaned = (filename ?? "")
    .replace(/[^A-Za-z0-9 ._()-]+/g, "_")
    .replace(/\.{2,}/g, ".")
    .trim()
    .slice(0, 100)
    .trim()
  if (cleaned.replace(/[._\s-]/g, "") !== "") return cleaned
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
  return slug || "download"
}
