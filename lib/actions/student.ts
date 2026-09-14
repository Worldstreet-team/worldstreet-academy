"use server"

import mongoose from "mongoose"
import connectDB from "@/lib/db"
import { Course, Enrollment, Bookmark, User, Lesson, type ICoursePackage, type IPackageEntitlements, type PackageKey } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth"
import { isSchoolSlug, type SchoolSlug } from "@/lib/schools"
import { FULL_ACCESS, PACKAGE_RANK, canAccessLesson, effectiveLessonTier, entitlementsFor } from "@/lib/entitlements"
import { getCourseAccess, lockedLessonIds, openPublishedLessonIds } from "@/lib/course-access"
import { isCountryCode } from "@/lib/countries"
import { FACULTY_ROLES, isFacultyRole, safeWebUrl } from "@/lib/faculty"

// ============================================================================
// TYPES
// ============================================================================

export type BrowseCourse = {
  id: string
  title: string
  /** Public URL key: `/programs/${slug}`. */
  slug: string
  description: string
  /** Spec §5 program blurb; null on legacy courses (fall back to `description`). */
  shortDescription: string | null
  thumbnailUrl: string | null
  instructorId: string
  instructorName: string
  instructorAvatarUrl: string | null
  level: "beginner" | "intermediate" | "advanced"
  category: string
  /** Phase 0 taxonomy; null on courses not yet assigned to a school. */
  school: SchoolSlug | null
  pricing: "free" | "paid"
  price: number | null
  /** Enabled package tiers on the course (0 = no package ladder). `price` is already the cheapest enabled tier. */
  tierCount: number
  status: string
  availableAt: string | null
  preEnrollEnabled: boolean
  totalLessons: number
  totalDuration: number
  enrolledCount: number
  rating: number | null
}

export type StudentEnrollment = {
  id: string
  courseId: string
  courseTitle: string
  courseThumbnail: string | null
  instructorName: string
  instructorAvatarUrl: string | null
  progress: number
  totalLessons: number
  lastAccessedAt: string
  status: string
  courseAvailableAt: string | null
  firstLessonId: string | null
  /** Lesson to resume at — last accessed lesson, falling back to the first. */
  resumeLessonId: string | null
  /** Title of `resumeLessonId`; null when that lesson no longer exists. */
  resumeLessonTitle: string | null
  /** Package bought; null for legacy, free and pre-enrolled rows. */
  packageKey: PackageKey | null
  /** Package name snapshot taken at purchase. */
  packageName: string | null
  instructorId: string
  instructorHeadline: string | null
  /** What the package includes. Legacy rows read FULL_ACCESS — that is access, never a label. */
  entitlements: IPackageEntitlements
  /** True only when `packageKey` is set AND the course still has that package. Badges require it. */
  explicitPackage: boolean
  /** Published lessons on the course this package opens — `openPublishedLessonIds`'s size, the set `progress` is measured over. */
  openLessons: number
}

export type StudentBookmark = {
  id: string
  courseId: string
  courseTitle: string
  courseThumbnail: string | null
  instructorName: string
  instructorAvatarUrl: string | null
  level: string
  pricing: string
  price: number | null
  rating: number | null
  enrolledCount: number
}

// ---- Get authenticated user's MongoDB document ----
async function getAuthenticatedUser() {
  const authUser = await getCurrentUser()
  
  if (!authUser) {
    throw new Error("Not authenticated")
  }
  
  // getCurrentUser already fetches the user from DB — reuse directly.
  // Only fall back to findById if we need the full Mongoose doc.
  await connectDB()
  const user = await User.findById(authUser.id)
  
  if (!user) {
    throw new Error("User not found in database")
  }
  
  return user
}

// ============================================================================
// BROWSE COURSES (for students)
// ============================================================================

/**
 * Fetch published courses for the browse page
 */
export async function fetchBrowseCourses(options?: {
  level?: string
  pricing?: string
  search?: string
  school?: SchoolSlug
  /** Only this instructor's programs — "Courses taught" on /faculty/[username]. */
  instructorId?: string
}): Promise<BrowseCourse[]> {
  try {
    await connectDB()
    
    const query: Record<string, unknown> = { status: "published" }
    
    if (options?.level && options.level !== "All") {
      query.level = options.level.toLowerCase()
    }
    if (options?.pricing) {
      if (options.pricing === "Free") query.price = 0
      else if (options.pricing === "Paid") query.price = { $gt: 0 }
    }
    if (options?.school) {
      query.school = options.school
    }
    if (options?.instructorId) {
      query.instructor = options.instructorId
    }
    if (options?.search) {
      query.$or = [
        { title: { $regex: options.search, $options: "i" } },
        { description: { $regex: options.search, $options: "i" } },
      ]
    }
    
    const courses = await Course.find(query)
      .populate("instructor", "firstName lastName avatarUrl")
      .sort({ enrolledCount: -1, createdAt: -1 })
      .lean()
    
    return courses.map((course) => {
      const instructor = course.instructor as unknown as {
        _id: { toString(): string }
        firstName: string
        lastName: string
        avatarUrl: string
      }
      
      return {
        id: course._id.toString(),
        title: course.title,
        slug: course.slug,
        description: course.description,
        shortDescription: course.shortDescription ?? null,
        thumbnailUrl: course.thumbnailUrl,
        instructorId: instructor._id.toString(),
        instructorName: `${instructor.firstName} ${instructor.lastName}`,
        instructorAvatarUrl: instructor.avatarUrl,
        level: course.level as "beginner" | "intermediate" | "advanced",
        category: course.category || "",
        school: isSchoolSlug(course.school) ? course.school : null,
        pricing: course.pricing as "free" | "paid",
        price: course.price,
        tierCount: (course.packages ?? []).filter((p) => p.enabled).length,
        status: course.status,
        availableAt: course.availableAt ? course.availableAt.toISOString() : null,
        preEnrollEnabled: course.preEnrollEnabled ?? true,
        totalLessons: course.totalLessons || 0,
        totalDuration: course.totalDuration || 0,
        enrolledCount: course.enrolledCount || 0,
        rating: course.rating?.average || null,
      }
    })
  } catch (error) {
    console.error("Fetch browse courses error:", error)
    return []
  }
}

// ============================================================================
// PUBLIC COURSE DETAIL
// ============================================================================

export type PublicCourseLesson = {
  id: string
  title: string
  description: string | null
  type: "video" | "live" | "text"
  thumbnailUrl: string | null
  videoUrl: string | null
  content: string | null
  duration: number | null
  isFree: boolean
}

export type PublicCourse = {
  id: string
  title: string
  description: string
  thumbnailUrl: string | null
  instructorId: string
  instructorName: string
  instructorAvatarUrl: string | null
  instructorBio: string | null
  instructorHeadline: string | null
  instructorTotalStudents: number
  level: "beginner" | "intermediate" | "advanced"
  pricing: "free" | "paid"
  price: number | null
  availableAt: string | null
  preEnrollEnabled: boolean
  totalLessons: number
  totalDuration: number
  enrolledCount: number
  rating: number | null
  whatYouWillLearn: string[]
  requirements: string[]
  targetAudience: string[]
  lessons: PublicCourseLesson[]
}

/**
 * Fetch a single published course by ID for public view
 */
export async function fetchPublicCourse(courseId: string): Promise<PublicCourse | null> {
  try {
    await connectDB()
    
    const course = await Course.findOne({
      _id: courseId,
      status: "published",
    })
      .populate("instructor", "firstName lastName avatarUrl bio instructorProfile")
      .lean()
    
    if (!course) return null
    
    const instructor = course.instructor as unknown as {
      _id: string
      firstName: string
      lastName?: string
      avatarUrl: string | null
      bio: string | null
      instructorProfile?: {
        headline: string | null
        totalStudents: number
      }
    } | null
    
    // Guard against missing instructor (deleted user, etc.)
    if (!instructor) return null
    
    // Fetch lessons for this course with all needed fields
    const lessons = await Lesson.find({ course: courseId })
      .sort({ order: 1 })
      .select("title description type videoThumbnailUrl videoUrl content videoDuration isFree")
      .lean()
    
    return {
      id: course._id.toString(),
      title: course.title,
      description: course.description,
      thumbnailUrl: course.thumbnailUrl,
      instructorId: instructor._id.toString(),
      instructorName: `${instructor.firstName} ${instructor.lastName || ""}`.trim(),
      instructorAvatarUrl: instructor.avatarUrl,
      instructorBio: instructor.bio,
      instructorHeadline: instructor.instructorProfile?.headline || null,
      instructorTotalStudents: instructor.instructorProfile?.totalStudents || 0,
      level: course.level as "beginner" | "intermediate" | "advanced",
      pricing: course.pricing as "free" | "paid",
      price: course.price,
      availableAt: course.availableAt ? course.availableAt.toISOString() : null,
      preEnrollEnabled: course.preEnrollEnabled ?? true,
      totalLessons: course.totalLessons || 0,
      totalDuration: course.totalDuration || 0,
      enrolledCount: course.enrolledCount || 0,
      rating: course.rating?.average || null,
      whatYouWillLearn: course.whatYouWillLearn || [],
      requirements: course.requirements || [],
      targetAudience: course.targetAudience || [],
      lessons: lessons.map((l) => ({
        id: l._id.toString(),
        title: l.title,
        description: l.description || null,
        type: l.type as "video" | "live" | "text",
        thumbnailUrl: l.videoThumbnailUrl || null,
        videoUrl: l.isFree ? (l.videoUrl || null) : null, // Only expose video URL for free lessons
        content: l.isFree ? (l.content || null) : null, // Only expose content for free lessons
        duration: l.videoDuration ? Math.round(l.videoDuration / 60) : null,
        isFree: l.isFree,
      })),
    }
  } catch (error) {
    console.error("Fetch public course error:", error)
    return null
  }
}

// ============================================================================
// PROGRAM PAGE (spec §6–§9) — /programs/[slug]
// ============================================================================

/** One purchasable tier as the public program page shows it (packages are public; nothing is stripped but `enabled`). */
export type PublicPackage = {
  key: PackageKey
  name: string
  tagline: string
  price: number
  features: string[]
  highlight: boolean
  ctaLabel: string | null
  entitlements: IPackageEntitlements
}

export type ProgramDetail = BrowseCourse & {
  ratingCount: number
  whatYouWillLearn: string[]
  requirements: string[]
  targetAudience: string[]
  instructorHeadline: string | null
  instructorBio: string | null
  instructorTotalStudents: number
  /** The instructor's faculty URL key; null when they aren't INSTRUCTOR/ADMIN, so no /faculty link is offered. */
  instructorUsername: string | null
  /**
   * Enabled tiers in ladder order (basic → standard → executive). Never empty:
   * a course without a ladder gets one synthesized "Full program" tier at the
   * course's own price, so every program renders the same components.
   */
  packages: PublicPackage[]
}

const NO_ENTITLEMENTS: IPackageEntitlements = {
  liveClasses: false,
  instructorQa: false,
  assignments: false,
  certificate: false,
  mentorship: false,
  prioritySupport: false,
}

/** Shared finder behind the program page (by slug) and checkout (by id). */
async function findProgram(filter: { slug: string } | { _id: string }): Promise<ProgramDetail | null> {
  const course = await Course.findOne({ ...filter, status: "published" })
    .populate("instructor", "username role firstName lastName avatarUrl bio instructorProfile")
    .lean()

  if (!course) return null

  const instructor = course.instructor as unknown as {
    _id: { toString(): string }
    username: string
    role: string
    firstName: string
    lastName?: string
    avatarUrl: string | null
    bio: string | null
    instructorProfile?: { headline: string | null; totalStudents: number }
  } | null

  // Guard against missing instructor (deleted user, etc.)
  if (!instructor) return null

  const whatYouWillLearn = course.whatYouWillLearn ?? []
  const enabled = (course.packages ?? [])
    .filter((p) => p.enabled)
    .sort((a, b) => PACKAGE_RANK[a.key] - PACKAGE_RANK[b.key])

  const packages: PublicPackage[] =
    enabled.length > 0
      ? enabled.map((p) => ({
          key: p.key,
          name: p.name,
          tagline: p.tagline ?? "",
          price: p.price,
          features: p.features ?? [],
          highlight: Boolean(p.highlight),
          ctaLabel: p.ctaLabel ?? null,
          entitlements: { ...NO_ENTITLEMENTS, ...p.entitlements },
        }))
      : [
          {
            key: "standard",
            name: "Full program",
            tagline: "",
            price: course.pricing === "free" ? 0 : course.price ?? 0,
            features: whatYouWillLearn,
            highlight: false,
            ctaLabel: null,
            entitlements: FULL_ACCESS,
          },
        ]

  return {
    id: course._id.toString(),
    title: course.title,
    slug: course.slug,
    description: course.description,
    shortDescription: course.shortDescription ?? null,
    thumbnailUrl: course.thumbnailUrl,
    instructorId: instructor._id.toString(),
    instructorName: `${instructor.firstName} ${instructor.lastName || ""}`.trim(),
    instructorAvatarUrl: instructor.avatarUrl,
    level: course.level as "beginner" | "intermediate" | "advanced",
    category: course.category || "",
    school: isSchoolSlug(course.school) ? course.school : null,
    pricing: course.pricing as "free" | "paid",
    price: course.price,
    tierCount: enabled.length,
    status: course.status,
    availableAt: course.availableAt ? course.availableAt.toISOString() : null,
    preEnrollEnabled: course.preEnrollEnabled ?? true,
    totalLessons: course.totalLessons || 0,
    totalDuration: course.totalDuration || 0,
    enrolledCount: course.enrolledCount || 0,
    rating: course.rating?.average || null,
    ratingCount: course.rating?.count || 0,
    whatYouWillLearn,
    requirements: course.requirements ?? [],
    targetAudience: course.targetAudience ?? [],
    instructorHeadline: instructor.instructorProfile?.headline || null,
    instructorBio: instructor.bio,
    instructorTotalStudents: instructor.instructorProfile?.totalStudents || 0,
    // The course is published, so an INSTRUCTOR/ADMIN teaching it is faculty.
    instructorUsername: isFacultyRole(instructor.role) ? instructor.username : null,
    packages,
  }
}

/**
 * Fetch one published program by slug for the public program page.
 */
export async function fetchProgramBySlug(slug: string): Promise<ProgramDetail | null> {
  try {
    await connectDB()
    return await findProgram({ slug })
  } catch (error) {
    console.error("Fetch program by slug error:", error)
    return null
  }
}

/**
 * The same program by course id — checkout's order summary and package
 * switcher. Invalid ids and unpublished courses resolve to null.
 */
export async function fetchProgramById(courseId: string): Promise<ProgramDetail | null> {
  try {
    if (!mongoose.isValidObjectId(courseId)) return null
    await connectDB()
    return await findProgram({ _id: courseId })
  } catch (error) {
    console.error("Fetch program by id error:", error)
    return null
  }
}

/**
 * Slug for a published course id — the old `/courses/[id]` route redirects
 * through this. Non-ObjectId input and unpublished courses resolve to null.
 */
export async function fetchProgramSlug(courseId: string): Promise<string | null> {
  try {
    if (!mongoose.isValidObjectId(courseId)) return null
    await connectDB()
    const course = await Course.findOne({ _id: courseId, status: "published" }).select("slug").lean()
    return course?.slug ?? null
  } catch (error) {
    console.error("Fetch program slug error:", error)
    return null
  }
}

// ============================================================================
// LEARN PAGE - Course content with full lesson details
// ============================================================================

export type LearnLesson = {
  id: string
  courseId: string
  title: string
  description: string
  type: "video" | "live" | "text"
  videoUrl: string | null
  thumbnailUrl: string | null
  content: string | null
  duration: number | null
  order: number
  isFree: boolean
  /** Draft lessons never count toward progress (docs/go-patches-phase-3.md R3). */
  isPublished: boolean
  /** The student's package can't open this lesson — media is withheld and the page shows a lock notice. */
  locked: boolean
  /** Tier that opens a locked lesson; null when the lesson is open. */
  requiredPackage: PackageKey | null
}

export type LearnCourse = {
  id: string
  title: string
  instructorId: string
  instructorName: string
  instructorAvatarUrl: string | null
  rating: number | null
  slug: string
  /** The viewer's package; null for legacy enrollments and for course staff. */
  packageKey: PackageKey | null
  /** What the viewer's package includes — full access for the course's instructor and admins. */
  entitlements: IPackageEntitlements
  /** False when the caller isn't enrolled — paid lesson media is withheld. */
  hasAccess: boolean
  lessons: LearnLesson[]
}

/**
 * Fetch course and lessons for the learn page.
 *
 * Access is enforced server-side: full lesson media (videoUrl/content) is only
 * returned to enrolled students, the course's instructor, or admins. Everyone
 * else gets metadata plus free-preview lessons only — a paid course can no
 * longer be consumed by navigating straight to the learn URL.
 */
export async function fetchCourseForLearning(courseId: string): Promise<LearnCourse | null> {
  try {
    await connectDB()

    const { Lesson, Enrollment } = await import("@/lib/db/models")
    const { getCurrentUser } = await import("@/lib/auth/actions")

    const course = await Course.findById(courseId)
      .populate("instructor", "firstName lastName avatarUrl")
      .lean()

    if (!course) return null

    const user = await getCurrentUser()
    let hasAccess = false
    let enrollment: { packageKey: PackageKey | null } | null = null
    if (user) {
      if (user.role === "ADMIN") {
        hasAccess = true
      } else if (
        (course.instructor as unknown as { _id?: { toString(): string } })?._id?.toString() === user.id
      ) {
        hasAccess = true
      } else {
        const found = await Enrollment.findOne({
          user: user.id,
          course: courseId,
          status: { $in: ["active", "completed"] },
        }).select("_id packageKey")
        hasAccess = Boolean(found)
        enrollment = found ? { packageKey: found.packageKey ?? null } : null
      }
    }

    const instructor = course.instructor as unknown as {
      _id: { toString(): string }
      firstName: string
      lastName: string
      avatarUrl: string
    }

    const lessons = await Lesson.find({ course: courseId })
      .sort({ order: 1 })
      .lean()

    const packages = course.packages ?? []

    return {
      id: course._id.toString(),
      title: course.title,
      instructorId: instructor._id.toString(),
      instructorName: `${instructor.firstName} ${instructor.lastName}`,
      instructorAvatarUrl: instructor.avatarUrl,
      rating: course.rating?.average || null,
      slug: course.slug,
      packageKey: enrollment?.packageKey ?? null,
      entitlements: entitlementsFor({ packages }, enrollment),
      hasAccess,
      lessons: lessons.map((l) => {
        // Staff have no enrollment → nothing locks for them.
        const locked = hasAccess && !canAccessLesson({ packages }, l, enrollment)
        const unlocked = (hasAccess && !locked) || l.isFree
        return {
          id: l._id.toString(),
          courseId: courseId,
          title: l.title,
          description: l.description || "",
          type: l.type as "video" | "live" | "text",
          videoUrl: unlocked ? (l.videoUrl || null) : null,
          thumbnailUrl: l.videoThumbnailUrl || null,
          content: unlocked ? (l.content || null) : null,
          duration: l.videoDuration ? Math.round(l.videoDuration / 60) : null,
          order: l.order,
          isFree: l.isFree,
          isPublished: l.isPublished,
          locked,
          requiredPackage: locked ? effectiveLessonTier({ packages }, l) : null,
        }
      }),
    }
  } catch (error) {
    console.error("Fetch course for learning error:", error)
    return null
  }
}

/**
 * Fetch other courses (for recommendations)
 */
export async function fetchOtherCourses(excludeCourseId: string): Promise<BrowseCourse[]> {
  try {
    await connectDB()
    
    const courses = await Course.find({
      _id: { $ne: excludeCourseId },
      status: "published",
    })
      .populate("instructor", "firstName lastName avatarUrl")
      .limit(6)
      .lean()
    
    return courses.map((course) => {
      const instructor = course.instructor as unknown as {
        _id: { toString(): string }
        firstName: string
        lastName: string
        avatarUrl: string
      }
      
      return {
        id: course._id.toString(),
        title: course.title,
        slug: course.slug,
        description: course.description,
        shortDescription: course.shortDescription ?? null,
        thumbnailUrl: course.thumbnailUrl,
        instructorId: instructor._id.toString(),
        instructorName: `${instructor.firstName} ${instructor.lastName}`,
        instructorAvatarUrl: instructor.avatarUrl,
        level: course.level as "beginner" | "intermediate" | "advanced",
        category: course.category || "",
        school: isSchoolSlug(course.school) ? course.school : null,
        pricing: course.pricing as "free" | "paid",
        price: course.price,
        tierCount: (course.packages ?? []).filter((p) => p.enabled).length,
        status: course.status,
        availableAt: course.availableAt ? course.availableAt.toISOString() : null,
        preEnrollEnabled: course.preEnrollEnabled ?? true,
        totalLessons: course.totalLessons || 0,
        totalDuration: course.totalDuration || 0,
        enrolledCount: course.enrolledCount || 0,
        rating: course.rating?.average || null,
      }
    })
  } catch (error) {
    console.error("Fetch other courses error:", error)
    return []
  }
}

// ============================================================================
// MY COURSES (enrolled courses)
// ============================================================================

/**
 * Fetch user's enrolled courses — every status, most recently accessed first.
 */
export async function fetchMyEnrollments(): Promise<StudentEnrollment[]> {
  try {
    await connectDB()
    const user = await getAuthenticatedUser()

    const enrollments = await Enrollment.find({ user: user._id })
      .populate({
        path: "course",
        select: "title thumbnailUrl instructor totalLessons availableAt status packages",
        populate: {
          path: "instructor",
          select: "firstName lastName avatarUrl instructorProfile.headline",
        },
      })
      .sort({ lastAccessedAt: -1 })
      .lean()

    type PopulatedCourse = {
      _id: { toString(): string }
      title: string
      thumbnailUrl: string
      totalLessons?: number
      availableAt?: Date | null
      packages?: ICoursePackage[] | null
      instructor: {
        _id: { toString(): string }
        firstName: string
        lastName: string
        avatarUrl: string | null
        instructorProfile?: { headline?: string | null }
      }
    }

    // One lesson read for every enrolled course (was one query per enrollment).
    const courseIds = enrollments.map((e) => (e.course as unknown as PopulatedCourse)._id.toString())
    const lessons = await Lesson.find({ course: { $in: courseIds } })
      .sort({ order: 1 })
      .select("_id course title order minPackageKey isFree isPublished")
      .lean()
    const lessonsByCourse = new Map<string, typeof lessons>()
    for (const lesson of lessons) {
      const key = lesson.course.toString()
      const list = lessonsByCourse.get(key)
      if (list) list.push(lesson)
      else lessonsByCourse.set(key, [lesson])
    }

    return await Promise.all(
      enrollments.map(async (enrollment) => {
        const course = enrollment.course as unknown as PopulatedCourse
        const courseId = course._id.toString()
        const courseLessons = lessonsByCourse.get(courseId) ?? []
        const firstLesson = courseLessons[0]
        const packages = course.packages ?? []
        const packageKey = enrollment.packageKey ?? null
        const resumeLessonId =
          enrollment.lastAccessedLesson?.toString() ?? firstLesson?._id.toString() ?? null

        // openLessons is `openPublishedLessonIds`'s own set (docs/go-patches-phase-3.md
        // R3) — published lessons the package opens. `getCourseAccess` reads null for a
        // non-access-granting status (pre_enrolled/expired/refunded/suspended/cancelled)
        // or for course staff; either way there's no per-enrollment access record to
        // size the set from, so fall back to the course's own published lesson count.
        const access = await getCourseAccess(user._id.toString(), courseId)
        const openLessons = access
          ? (await openPublishedLessonIds(access)).size
          : courseLessons.filter((l) => l.isPublished).length

        return {
          id: enrollment._id.toString(),
          courseId,
          courseTitle: course.title,
          courseThumbnail: course.thumbnailUrl,
          instructorName: `${course.instructor.firstName} ${course.instructor.lastName}`,
          instructorAvatarUrl: course.instructor.avatarUrl,
          progress: enrollment.progress,
          totalLessons: course.totalLessons || 0,
          lastAccessedAt: enrollment.lastAccessedAt?.toISOString() || new Date().toISOString(),
          status: enrollment.status,
          courseAvailableAt: course.availableAt ? new Date(course.availableAt).toISOString() : null,
          firstLessonId: firstLesson?._id.toString() || null,
          resumeLessonId,
          resumeLessonTitle: courseLessons.find((l) => l._id.toString() === resumeLessonId)?.title ?? null,
          packageKey,
          packageName: enrollment.packageName ?? null,
          instructorId: course.instructor._id.toString(),
          instructorHeadline: course.instructor.instructorProfile?.headline || null,
          entitlements: entitlementsFor({ packages }, { packageKey }),
          explicitPackage: packageKey !== null && packages.some((p) => p.key === packageKey),
          openLessons,
        }
      })
    )
  } catch (error) {
    console.error("Fetch my enrollments error:", error)
    return []
  }
}

// ============================================================================
// BOOKMARKS
// ============================================================================


/**
 * Fetch user's bookmarked courses
 */
export async function fetchMyBookmarks(): Promise<StudentBookmark[]> {
  try {
    await connectDB()
    const user = await getAuthenticatedUser()
    
    const bookmarks = await Bookmark.find({ user: user._id })
      .populate({
        path: "course",
        match: { status: "published" },
        select: "title thumbnailUrl instructor level pricing price rating enrolledCount",
        populate: {
          path: "instructor",
          select: "firstName lastName avatarUrl",
        },
      })
      .sort({ createdAt: -1 })
      .lean()
    
    return bookmarks
      .filter((b) => b.course !== null)
      .map((bookmark) => {
        const course = bookmark.course as unknown as {
          _id: { toString(): string }
          title: string
          thumbnailUrl: string
          instructor: { firstName: string; lastName: string; avatarUrl: string | null }
          level: string
          pricing: string
          price: number
          rating: { average: number }
          enrolledCount: number
        }
        
        return {
          id: bookmark._id.toString(),
          courseId: course._id.toString(),
          courseTitle: course.title,
          courseThumbnail: course.thumbnailUrl,
          instructorName: `${course.instructor.firstName} ${course.instructor.lastName}`,
          instructorAvatarUrl: course.instructor.avatarUrl,
          level: course.level,
          pricing: course.pricing,
          price: course.price,
          rating: course.rating?.average || null,
          enrolledCount: course.enrolledCount || 0,
        }
      })
  } catch (error) {
    console.error("Fetch my bookmarks error:", error)
    return []
  }
}

/**
 * Toggle bookmark for a course
 */
export async function toggleCourseBookmark(courseId: string): Promise<{ success: boolean; isBookmarked: boolean }> {
  try {
    await connectDB()
    const user = await getAuthenticatedUser()
    
    const existing = await Bookmark.findOne({
      user: user._id,
      course: courseId,
    })
    
    if (existing) {
      await existing.deleteOne()
      return { success: true, isBookmarked: false }
    }
    
    await Bookmark.create({
      user: user._id,
      course: courseId,
    })
    
    return { success: true, isBookmarked: true }
  } catch (error) {
    console.error("Toggle bookmark error:", error)
    return { success: false, isBookmarked: false }
  }
}

/**
 * Check if courses are bookmarked
 */
export async function checkCoursesBookmarked(courseIds: string[]): Promise<Record<string, boolean>> {
  try {
    await connectDB()
    const user = await getAuthenticatedUser()
    
    const bookmarks = await Bookmark.find({
      user: user._id,
      course: { $in: courseIds },
    }).select("course")
    
    const bookmarkedIds = new Set(bookmarks.map((b) => b.course.toString()))
    
    return courseIds.reduce(
      (acc, id) => {
        acc[id] = bookmarkedIds.has(id)
        return acc
      },
      {} as Record<string, boolean>
    )
  } catch (error) {
    console.error("Check bookmarks error:", error)
    return {}
  }
}

// ============================================================================
// LESSON COMPLETION
// ============================================================================

/**
 * Mark a lesson as completed
 */
export async function markLessonComplete(
  courseId: string,
  lessonId: string
): Promise<{ success: boolean; error?: string }> {
  "use server"
  try {
    await connectDB()
    const user = await getAuthenticatedUser()
    const { Lesson } = await import("@/lib/db/models")

    // Progress lives on an enrollment the student already has — this never
    // creates one (it used to, handing an active enrollment and full access on
    // any course to anyone who called the action).
    const enrollment = await Enrollment.findOne({
      user: user._id,
      course: courseId,
      status: { $in: ["active", "completed"] },
    })
    if (!enrollment) return { success: false, error: "Not enrolled in this course" }

    const lessonIds = (await Lesson.find({ course: courseId }).select("_id").lean()).map((l) => l._id.toString())
    if (!lessonIds.includes(lessonId)) return { success: false, error: "Lesson not found" }

    const access = await getCourseAccess(user._id.toString(), courseId)
    const locked = await lockedLessonIds(access)
    if (locked.has(lessonId)) return { success: false, error: "This lesson isn't included in your package" }

    if (!enrollment.completedLessons.some((id: { toString(): string }) => id.toString() === lessonId)) {
      enrollment.completedLessons.push(new mongoose.Types.ObjectId(lessonId))
    }

    // Progress counts only the published lessons this package opens (docs/go-patches-phase-3.md R3).
    const open = access ? await openPublishedLessonIds(access) : new Set<string>()
    const done = enrollment.completedLessons.filter((id: { toString(): string }) => open.has(id.toString())).length
    enrollment.progress = open.size > 0 ? Math.min(100, Math.round((done / open.size) * 100)) : 0
    enrollment.lastAccessedAt = new Date()

    await enrollment.save()

    return { success: true }
  } catch (error) {
    console.error("Mark lesson complete error:", error)
    return { success: false }
  }
}

/**
 * Get completed lesson IDs for a course
 */
export async function getCompletedLessons(courseId: string): Promise<string[]> {
  try {
    await connectDB()
    const user = await getAuthenticatedUser()
    
    const enrollment = await Enrollment.findOne({ user: user._id, course: courseId })
      .select("completedLessons")
      .lean()
    
    if (!enrollment) return []
    
    return enrollment.completedLessons.map((id: { toString(): string }) => id.toString())
  } catch (error) {
    console.error("Get completed lessons error:", error)
    return []
  }
}

/**
 * Mark a course as completed
 */
export async function markCourseComplete(
  courseId: string
): Promise<{ success: boolean; requiresExam?: boolean; error?: string }> {
  "use server"
  try {
    await connectDB()
    const user = await getAuthenticatedUser()

    // Never creates an enrollment (it used to hand a completed enrollment —
    // and so a certificate — to anyone who called this action).
    const enrollment = await Enrollment.findOne({
      user: user._id,
      course: courseId,
      status: { $in: ["active", "completed"] },
    })
    if (!enrollment) return { success: false, error: "Not enrolled in this course" }

    // CBT gate: when the course requires an exam, completion only happens
    // through a passing attempt (lib/actions/exams.ts) — unless the package has
    // no assessment & certificate (Basic), which completes on its lessons.
    const [course, access] = await Promise.all([
      Course.findById(courseId).select("examRequired").lean(),
      getCourseAccess(user._id.toString(), courseId),
    ])
    if (!access) return { success: false, error: "Course not found" }
    const examGates = !!course?.examRequired && access.entitlements.certificate

    // Finishing needs every published lesson the package opens — the same set
    // completeLesson counts — or a student could certify from the last lesson.
    const open = await openPublishedLessonIds(access)
    const completed = new Set(enrollment.completedLessons.map((id: { toString(): string }) => id.toString()))
    if (open.size === 0 || [...open].some((id) => !completed.has(id))) {
      return { success: false, error: "Finish all lessons first" }
    }

    enrollment.progress = 100
    enrollment.lastAccessedAt = new Date()
    if (examGates && !enrollment.examPassed) {
      await enrollment.save()
      return { success: true, requiresExam: true }
    }
    enrollment.status = "completed"
    enrollment.completedAt = new Date()
    await enrollment.save()

    return { success: true }
  } catch (error) {
    console.error("Mark course complete error:", error)
    return { success: false, error: "Failed to mark course complete" }
  }
}

// ============================================================================
// INSTRUCTOR PUBLIC PROFILE
// ============================================================================

export type InstructorPublicProfile = {
  id: string
  firstName: string
  lastName: string
  fullName: string
  avatarUrl: string | null
  bio: string | null
  headline: string | null
  expertise: string[]
  socialLinks: {
    twitter?: string
    linkedin?: string
    website?: string
  }
  totalStudents: number
  totalCourses: number
  createdAt: string
}

export type InstructorCourse = {
  id: string
  title: string
  thumbnailUrl: string | null
  level: "beginner" | "intermediate" | "advanced"
  pricing: "free" | "paid"
  price: number | null
  totalLessons: number
  enrolledCount: number
  rating: number | null
}

/**
 * Fetch instructor public profile by ID
 */
export async function fetchInstructorProfile(instructorId: string): Promise<InstructorPublicProfile | null> {
  try {
    await connectDB()
    
    const instructor = await User.findById(instructorId)
      .select("firstName lastName avatarUrl bio role instructorProfile createdAt")
      .lean()
    
    if (!instructor) return null
    
    // Compute real counts from DB
    const [courseCount, studentCount] = await Promise.all([
      Course.countDocuments({ instructor: instructor._id, status: "published" }),
      Enrollment.distinct("user", {
        course: { $in: await Course.find({ instructor: instructor._id }).distinct("_id") },
      }).then((ids) => ids.length),
    ])
    
    return {
      id: instructor._id.toString(),
      firstName: instructor.firstName,
      lastName: instructor.lastName || "",
      fullName: `${instructor.firstName} ${instructor.lastName || ""}`.trim(),
      avatarUrl: instructor.avatarUrl,
      bio: instructor.bio,
      headline: instructor.instructorProfile?.headline || null,
      expertise: instructor.instructorProfile?.expertise || [],
      socialLinks: instructor.instructorProfile?.socialLinks || {},
      totalStudents: studentCount,
      totalCourses: courseCount,
      createdAt: instructor.createdAt.toISOString(),
    }
  } catch (error) {
    console.error("Fetch instructor profile error:", error)
    return null
  }
}

/**
 * Fetch all published courses by an instructor
 */
export async function fetchInstructorPublicCourses(instructorId: string): Promise<InstructorCourse[]> {
  try {
    await connectDB()
    
    const courses = await Course.find({
      instructor: instructorId,
      status: "published",
    })
      .select("title thumbnailUrl level pricing price totalLessons enrolledCount rating")
      .sort({ createdAt: -1 })
      .lean()
    
    return courses.map((course) => ({
      id: course._id.toString(),
      title: course.title,
      thumbnailUrl: course.thumbnailUrl,
      level: course.level as "beginner" | "intermediate" | "advanced",
      pricing: course.pricing as "free" | "paid",
      price: course.price,
      totalLessons: course.totalLessons || 0,
      enrolledCount: course.enrolledCount || 0,
      rating: course.rating?.average || null,
    }))
  } catch (error) {
    console.error("Fetch instructor courses error:", error)
    return []
  }
}

/**
 * Fetch courses from an instructor that the current user is enrolled in
 */
export async function fetchEnrolledCoursesFromInstructor(instructorId: string): Promise<InstructorCourse[]> {
  try {
    await connectDB()
    const user = await getAuthenticatedUser()
    
    // Get user's enrollments
    const enrollments = await Enrollment.find({ user: user._id })
      .select("course")
      .lean()
    
    const enrolledCourseIds = enrollments.map((e) => e.course.toString())
    
    // Get courses from this instructor that user is enrolled in
    const courses = await Course.find({
      _id: { $in: enrolledCourseIds },
      instructor: instructorId,
    })
      .select("title thumbnailUrl level pricing price totalLessons enrolledCount rating")
      .lean()
    
    return courses.map((course) => ({
      id: course._id.toString(),
      title: course.title,
      thumbnailUrl: course.thumbnailUrl,
      level: course.level as "beginner" | "intermediate" | "advanced",
      pricing: course.pricing as "free" | "paid",
      price: course.price,
      totalLessons: course.totalLessons || 0,
      enrolledCount: course.enrolledCount || 0,
      rating: course.rating?.average || null,
    }))
  } catch (error) {
    console.error("Fetch enrolled courses from instructor error:", error)
    return []
  }
}

// ============================================================================
// FACULTY (spec §10) — /faculty, /faculty/[username], homepage teaser, nav
// ============================================================================

export type FacultyMember = {
  id: string
  /** Unique on User — the public URL key (`facultyHref`). */
  username: string
  name: string
  avatarUrl: string | null
  headline: string | null
  /** Area of specialization (spec §10). */
  specialization: string | null
  expertise: string[]
  /** ISO 3166-1 alpha-2; print it with `countryName`. */
  country: string | null
  featured: boolean
  /** Published programs they teach — at least 1, or they aren't faculty. */
  courseCount: number
}

export type FacultyProfile = FacultyMember & {
  bio: string | null
  experience: string | null
  credentials: string[]
  /** Only safe http(s) addresses; anything else stored reads as null. */
  socialLinks: { website: string | null; linkedin: string | null; twitter: string | null }
}

const FACULTY_FIELDS = "username firstName lastName avatarUrl bio country instructorProfile"

type FacultyUserDoc = {
  _id: { toString(): string }
  username: string
  firstName: string
  lastName?: string | null
  avatarUrl?: string | null
  country?: string | null
  instructorProfile?: {
    headline?: string | null
    specialization?: string | null
    expertise?: string[] | null
    featured?: boolean | null
  } | null
}

/**
 * Published-program count per instructor id — the course half of "who is
 * faculty" (role INSTRUCTOR or ADMIN is the other half, applied by each caller).
 */
async function publishedCourseCounts(): Promise<Map<string, number>> {
  const rows = await Course.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
    { $match: { status: "published" } },
    { $group: { _id: "$instructor", count: { $sum: 1 } } },
  ])
  return new Map(rows.map((row) => [row._id.toString(), row.count]))
}

function toFacultyMember(user: FacultyUserDoc, courseCount: number): FacultyMember {
  const profile = user.instructorProfile
  return {
    id: user._id.toString(),
    username: user.username,
    name: `${user.firstName} ${user.lastName ?? ""}`.trim(),
    avatarUrl: user.avatarUrl ?? null,
    headline: profile?.headline?.trim() || null,
    specialization: profile?.specialization?.trim() || null,
    expertise: profile?.expertise ?? [],
    country: isCountryCode(user.country) ? user.country : null,
    featured: profile?.featured ?? false,
    courseCount,
  }
}

/** Every faculty member — featured first, then most students, then by name. */
export async function fetchFaculty(): Promise<FacultyMember[]> {
  try {
    await connectDB()
    const counts = await publishedCourseCounts()
    if (counts.size === 0) return []

    const users = await User.find({ _id: { $in: Array.from(counts.keys()) }, role: { $in: [...FACULTY_ROLES] } })
      .select(FACULTY_FIELDS)
      .lean()

    return users
      .sort(
        (a, b) =>
          Number(b.instructorProfile?.featured ?? false) - Number(a.instructorProfile?.featured ?? false) ||
          (b.instructorProfile?.totalStudents ?? 0) - (a.instructorProfile?.totalStudents ?? 0) ||
          `${a.firstName} ${a.lastName ?? ""}`.localeCompare(`${b.firstName} ${b.lastName ?? ""}`)
      )
      .map((user) => toFacultyMember(user, counts.get(user._id.toString()) ?? 0))
  } catch (error) {
    console.error("Fetch faculty error:", error)
    return []
  }
}

/**
 * One public faculty profile by username. null — so the page 404s — for
 * unknown usernames, students, and instructors with no published program.
 */
export async function fetchFacultyProfile(username: string): Promise<FacultyProfile | null> {
  try {
    if (typeof username !== "string" || username.length === 0 || username.length > 100) return null
    await connectDB()

    const user = await User.findOne({ username, role: { $in: [...FACULTY_ROLES] } })
      .select(FACULTY_FIELDS)
      .lean()
    if (!user) return null

    const courseCount = await Course.countDocuments({ instructor: user._id, status: "published" })
    if (courseCount === 0) return null

    const profile = user.instructorProfile
    return {
      ...toFacultyMember(user, courseCount),
      bio: user.bio?.trim() || null,
      experience: profile?.experience?.trim() || null,
      credentials: profile?.credentials ?? [],
      socialLinks: {
        website: safeWebUrl(profile?.socialLinks?.website),
        linkedin: safeWebUrl(profile?.socialLinks?.linkedin),
        twitter: safeWebUrl(profile?.socialLinks?.twitter),
      },
    }
  } catch (error) {
    console.error("Fetch faculty profile error:", error)
    return null
  }
}

/** How many faculty members exist — the marketing layout shows "Faculty" links only when this is > 0. */
export async function fetchFacultyCount(): Promise<number> {
  try {
    await connectDB()
    const counts = await publishedCourseCounts()
    if (counts.size === 0) return 0
    return await User.countDocuments({ _id: { $in: Array.from(counts.keys()) }, role: { $in: [...FACULTY_ROLES] } })
  } catch (error) {
    console.error("Fetch faculty count error:", error)
    return 0
  }
}

/** A user's faculty URL key, or null when they aren't faculty — so a /faculty link is only offered when it resolves. */
export async function fetchFacultyUsername(userId: string): Promise<string | null> {
  try {
    if (!mongoose.isValidObjectId(userId)) return null
    await connectDB()
    const user = await User.findOne({ _id: userId, role: { $in: [...FACULTY_ROLES] } })
      .select("username")
      .lean()
    if (!user) return null
    const teaches = await Course.exists({ instructor: user._id, status: "published" })
    return teaches ? user.username : null
  } catch (error) {
    console.error("Fetch faculty username error:", error)
    return null
  }
}
