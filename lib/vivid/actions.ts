"use server"

/**
 * Vivid AI Server Actions — WorldStreet Academy
 *
 * ALL Vivid server-side logic: token creation, function dispatch,
 * and data queries. Covers courses, meetings, messages, profile,
 * enrollments, certificates, language, reviews, signatures.
 */

import connectDB from "@/lib/db"
import { Course, Enrollment, Meeting, User, Lesson, Conversation, Message } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth"
import { Types } from "mongoose"
import { buildAcademyPrompt, generateFunctionInstructions } from "./prompt"
import { allVividFunctions } from "./functions"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = Record<string, any>

async function initAction() {
  await connectDB()
  return getCurrentUser()
}

// ============================================================================
// Course Search
// ============================================================================

export async function vividSearchCourses(p: {
  search?: string
  level?: string
  pricing?: string
  category?: string
  sortBy?: string
  limit?: number
}) {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, courses: [], error: "Not authenticated" }

    const query: Doc = { status: "published" }
    if (p.search) query.$or = [
      { title: { $regex: p.search, $options: "i" } },
      { description: { $regex: p.search, $options: "i" } },
      { tags: { $regex: p.search, $options: "i" } },
    ]
    if (p.level) query.level = p.level
    if (p.pricing) query.pricing = p.pricing
    if (p.category) query.category = p.category

    let sort: Doc = { enrolledCount: -1 }
    if (p.sortBy === "newest") sort = { createdAt: -1 }
    else if (p.sortBy === "rating") sort = { "rating.average": -1 }
    else if (p.sortBy === "price-low") sort = { price: 1 }
    else if (p.sortBy === "price-high") sort = { price: -1 }

    const courses = await Course.find(query)
      .populate("instructor", "firstName lastName avatarUrl")
      .sort(sort)
      .limit(p.limit || 8)
      .lean()

    return {
      success: true,
      courses: courses.map((c) => ({
        id: c._id.toString(),
        title: c.title,
        slug: c.slug,
        shortDescription: c.shortDescription,
        thumbnailUrl: c.thumbnailUrl,
        level: c.level,
        pricing: c.pricing,
        price: c.price,
        enrolledCount: c.enrolledCount,
        rating: c.rating?.average || 0,
        totalLessons: c.totalLessons,
        instructorName: `${(c.instructor as Doc)?.firstName || ""} ${(c.instructor as Doc)?.lastName || ""}`.trim(),
        instructorAvatar: (c.instructor as Doc)?.avatarUrl || null,
      })),
    }
  } catch (error) {
    console.error("[Vivid] searchCourses error:", error)
    return { success: false, courses: [], error: "Failed to search courses" }
  }
}

// ============================================================================
// Course Details
// ============================================================================

export async function vividGetCourseDetails(p: { courseId: string }) {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const course = await Course.findById(p.courseId)
      .populate("instructor", "firstName lastName avatarUrl bio")
      .lean()

    if (!course) return { success: false, error: "Course not found" }

    const lessonCount = await Lesson.countDocuments({ course: course._id, isPublished: true })

    // Check enrollment
    const enrollment = await Enrollment.findOne({
      user: currentUser.id,
      course: course._id,
    }).lean()

    // Get first lesson for "start learning"
    const firstLesson = await Lesson.findOne({ course: course._id, isPublished: true })
      .sort({ order: 1 })
      .select("_id")
      .lean()

    return {
      success: true,
      course: {
        id: course._id.toString(),
        title: course.title,
        slug: course.slug,
        shortDescription: course.shortDescription,
        description: course.description,
        thumbnailUrl: course.thumbnailUrl,
        level: course.level,
        pricing: course.pricing,
        price: course.price,
        enrolledCount: course.enrolledCount,
        rating: course.rating?.average || 0,
        ratingCount: course.rating?.count || 0,
        totalLessons: lessonCount,
        totalDuration: course.totalDuration,
        whatYouWillLearn: course.whatYouWillLearn,
        requirements: course.requirements,
        category: course.category,
        instructorName: `${(course.instructor as Doc)?.firstName || ""} ${(course.instructor as Doc)?.lastName || ""}`.trim(),
        instructorAvatar: (course.instructor as Doc)?.avatarUrl,
        isEnrolled: !!enrollment,
        enrollmentStatus: enrollment?.status,
        enrollmentProgress: enrollment?.progress || 0,
        firstLessonId: firstLesson?._id?.toString(),
      },
    }
  } catch (error) {
    console.error("[Vivid] getCourseDetails error:", error)
    return { success: false, error: "Failed to get course details" }
  }
}

// ============================================================================
// User Enrollments
// ============================================================================

export async function vividGetUserEnrollments(p: { status?: string }) {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, enrollments: [], error: "Not authenticated" }

    const query: Doc = { user: currentUser.id }
    if (p.status && p.status !== "all") query.status = p.status

    const enrollments = await Enrollment.find(query)
      .populate({ path: "course", populate: { path: "instructor", select: "firstName lastName" } })
      .sort({ lastAccessedAt: -1 })
      .limit(10)
      .lean()

    return {
      success: true,
      enrollments: enrollments.map((e) => {
        const course = e.course as Doc
        return {
          id: e._id.toString(),
          courseId: course?._id?.toString(),
          courseTitle: course?.title || "Unknown",
          courseThumbnail: course?.thumbnailUrl,
          instructorName: course?.instructor
            ? `${course.instructor.firstName} ${course.instructor.lastName}`.trim()
            : "Unknown",
          progress: e.progress,
          completedLessons: e.completedLessons?.length || 0,
          totalLessons: course?.totalLessons || 0,
          status: e.status,
          lastAccessedAt: e.lastAccessedAt?.toISOString(),
        }
      }),
    }
  } catch (error) {
    console.error("[Vivid] getUserEnrollments error:", error)
    return { success: false, enrollments: [], error: "Failed to get enrollments" }
  }
}

// ============================================================================
// Enroll in Course
// ============================================================================

export async function vividEnrollInCourse(p: { courseId: string }) {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const course = await Course.findById(p.courseId).lean()
    if (!course) return { success: false, error: "Course not found" }

    // Check existing enrollment
    const existing = await Enrollment.findOne({ user: currentUser.id, course: course._id })
    if (existing) return { success: true, already: true, message: "Already enrolled" }

    // Free course: enroll directly
    if (course.pricing === "free") {
      await Enrollment.create({
        user: currentUser.id,
        course: course._id,
        status: "active",
        progress: 0,
        completedLessons: [],
      })
      await Course.findByIdAndUpdate(course._id, { $inc: { enrolledCount: 1 } })
      return { success: true, enrolled: true, message: "Enrolled successfully!" }
    }

    // Paid course: need checkout
    return {
      success: true,
      needsCheckout: true,
      checkoutUrl: `/dashboard/checkout?courseId=${course._id}`,
      price: course.price,
      message: `This course costs $${course.price}. Redirecting to checkout.`,
    }
  } catch (error) {
    console.error("[Vivid] enrollInCourse error:", error)
    return { success: false, error: "Failed to enroll" }
  }
}

// ============================================================================
// Course Lessons
// ============================================================================

export async function vividGetCourseLessons(p: { courseId: string }) {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const lessons = await Lesson.find({ course: p.courseId, isPublished: true })
      .sort({ order: 1 })
      .select("_id title order videoDuration")
      .lean()

    // Get completed lessons
    const enrollment = await Enrollment.findOne({ user: currentUser.id, course: p.courseId })
      .select("completedLessons")
      .lean()

    const completedIds = new Set((enrollment?.completedLessons || []).map((id: Types.ObjectId) => id.toString()))

    return {
      success: true,
      courseId: p.courseId,
      lessons: lessons.map((l, i) => ({
        id: l._id.toString(),
        title: l.title,
        order: l.order || i + 1,
        duration: l.videoDuration,
        isCompleted: completedIds.has(l._id.toString()),
      })),
    }
  } catch (error) {
    console.error("[Vivid] getCourseLessons error:", error)
    return { success: false, error: "Failed to get lessons" }
  }
}

// ============================================================================
// Active Meetings
// ============================================================================

export async function vividCheckActiveMeetings() {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, meetings: [], error: "Not authenticated" }

    const meetings = await Meeting.find({
      $or: [
        { hostId: new Types.ObjectId(currentUser.id) },
        { "participants.userId": new Types.ObjectId(currentUser.id) },
      ],
      status: { $in: ["active", "waiting", "scheduled"] },
    }).lean()

    const hostIds = [...new Set(meetings.map((m) => m.hostId.toString()))]
    const hosts = await User.find({ _id: { $in: hostIds } }).select("firstName lastName").lean()
    const hostMap = new Map(hosts.map((h) => [h._id.toString(), h]))

    return {
      success: true,
      meetings: meetings.map((m) => {
        const host = hostMap.get(m.hostId.toString())
        return {
          id: m._id.toString(),
          title: m.title,
          status: m.status,
          meetingId: m.meetingId,
          hostName: host ? `${host.firstName} ${host.lastName}`.trim() : "Unknown",
          isHost: m.hostId.toString() === currentUser.id,
          participantCount: m.participants.filter((p) => p.status === "admitted").length,
          startedAt: m.startedAt?.toISOString(),
          joinUrl: `/dashboard/meetings?meetingId=${m.meetingId}`,
        }
      }),
    }
  } catch (error) {
    console.error("[Vivid] checkActiveMeetings error:", error)
    return { success: false, meetings: [], error: "Failed to check meetings" }
  }
}

// ============================================================================
// Create Meeting
// ============================================================================

export async function vividCreateMeeting(p: { title: string }) {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const meetingId = `meeting-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    const meeting = await Meeting.create({
      title: p.title,
      hostId: new Types.ObjectId(currentUser.id),
      meetingId,
      status: "waiting",
      participants: [{
        userId: new Types.ObjectId(currentUser.id),
        role: "host",
        status: "admitted",
        joinedAt: new Date(),
      }],
    })

    return {
      success: true,
      meeting: {
        id: meeting._id.toString(),
        meetingId,
        title: p.title,
        joinUrl: `/dashboard/meetings?meetingId=${meetingId}`,
      },
    }
  } catch (error) {
    console.error("[Vivid] createMeeting error:", error)
    return { success: false, error: "Failed to create meeting" }
  }
}

// ============================================================================
// Recent Messages
// ============================================================================

export async function vividGetRecentMessages(p: { limit?: number }) {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, conversations: [], error: "Not authenticated" }

    const conversations = await Conversation.find({
      participants: new Types.ObjectId(currentUser.id),
    })
      .sort({ lastMessageAt: -1 })
      .limit(p.limit || 5)
      .lean()

    const results = await Promise.all(
      conversations.map(async (conv) => {
        const otherParticipantId = conv.participants.find(
          (pid: Types.ObjectId) => pid.toString() !== currentUser.id
        )
        const otherUser = otherParticipantId
          ? await User.findById(otherParticipantId).select("firstName lastName avatarUrl").lean()
          : null

        const lastMsg = await Message.findOne({ conversationId: conv._id })
          .sort({ createdAt: -1 })
          .select("content senderId createdAt type")
          .lean()

        // Parse CALL_EVENT into human-readable text
        let lastMessageText = lastMsg?.content || ""
        if (lastMessageText.startsWith("CALL_EVENT:")) {
          const parts = lastMessageText.split(":")
          const callType = parts[1] === "video" ? "Video" : "Voice"
          const status = parts[2] || "completed"
          const dur = parts[3] || "0"
          if (status === "completed" && dur !== "0") lastMessageText = `${callType} call · ${dur}`
          else if (status === "completed") lastMessageText = `${callType} call`
          else if (status === "missed") lastMessageText = `Missed ${callType.toLowerCase()} call`
          else if (status === "declined") lastMessageText = `Declined ${callType.toLowerCase()} call`
          else if (status === "failed") lastMessageText = `Failed ${callType.toLowerCase()} call`
          else lastMessageText = `${callType} call`
        }

        return {
          conversationId: conv._id.toString(),
          userId: otherParticipantId?.toString(),
          userName: otherUser ? `${otherUser.firstName} ${otherUser.lastName}`.trim() : "Unknown",
          userAvatar: otherUser?.avatarUrl,
          lastMessage: lastMessageText,
          lastMessageType: lastMsg?.type || "text",
          isFromMe: lastMsg?.senderId?.toString() === currentUser.id,
          timestamp: lastMsg?.createdAt?.toISOString() || conv.lastMessageAt?.toISOString(),
        }
      })
    )

    return { success: true, conversations: results }
  } catch (error) {
    console.error("[Vivid] getRecentMessages error:", error)
    return { success: false, conversations: [], error: "Failed to get messages" }
  }
}

// ============================================================================
// Send Message
// ============================================================================

export async function vividSendMessage(p: { recipientId: string; content: string }) {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    // Use existing server action
    const { sendMessage } = await import("@/lib/actions/messages")
    const result = await sendMessage(p.recipientId, p.content)
    if (!result.success) return { success: false, error: result.error || "Failed to send" }
    return { success: true, message: "Message sent!" }
  } catch (error) {
    console.error("[Vivid] sendMessage error:", error)
    return { success: false, error: "Failed to send message" }
  }
}

// ============================================================================
// User Profile
// ============================================================================

export async function vividGetUserProfile() {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const [activeEnrollments, completedEnrollments] = await Promise.all([
      Enrollment.countDocuments({ user: currentUser.id, status: "active" }),
      Enrollment.countDocuments({ user: currentUser.id, status: "completed" }),
    ])

    return {
      success: true,
      profile: {
        id: currentUser.id,
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
        email: currentUser.email,
        role: currentUser.role,
        avatarUrl: currentUser.avatarUrl,
        walletBalance: currentUser.walletBalance,
        hasOnboarded: currentUser.hasOnboarded,
        activeEnrollments,
        completedEnrollments,
      },
    }
  } catch (error) {
    console.error("[Vivid] getUserProfile error:", error)
    return { success: false, error: "Failed to get profile" }
  }
}

// ============================================================================
// Update Profile
// ============================================================================

export async function vividUpdateProfile(p: { firstName?: string; lastName?: string; bio?: string }) {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const { updateProfile } = await import("@/lib/actions/profile")
    await updateProfile(p)
    return { success: true, message: "Profile updated!" }
  } catch (error) {
    console.error("[Vivid] updateProfile error:", error)
    return { success: false, error: "Failed to update profile" }
  }
}

// ============================================================================
// Change Language
// ============================================================================

export async function vividChangeLanguage(p: { languageCode: string }) {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const { updatePreferredLanguage } = await import("@/lib/actions/language")
    await updatePreferredLanguage(p.languageCode)
    return { success: true, languageCode: p.languageCode, message: `Language changed to ${p.languageCode}` }
  } catch (error) {
    console.error("[Vivid] changeLanguage error:", error)
    return { success: false, error: "Failed to change language" }
  }
}

// ============================================================================
// Course Review
// ============================================================================

export async function vividSubmitReview(p: { courseId: string; rating: number; comment?: string }) {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const { submitReview } = await import("@/lib/actions/reviews")
    await submitReview(currentUser.id, p.courseId, {
      rating: p.rating,
      content: p.comment || undefined,
    })
    return { success: true, message: `Rated ${p.rating} stars!` }
  } catch (error) {
    console.error("[Vivid] submitReview error:", error)
    return { success: false, error: "Failed to submit review" }
  }
}

// ============================================================================
// Certificates
// ============================================================================

export async function vividGetMyCertificates() {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, certificates: [], error: "Not authenticated" }

    const { fetchMyCertificates } = await import("@/lib/actions/certificates")
    const certs = await fetchMyCertificates()
    return { success: true, certificates: certs }
  } catch (error) {
    console.error("[Vivid] getMyCertificates error:", error)
    return { success: false, certificates: [], error: "Failed to get certificates" }
  }
}

// ============================================================================
// Save Signature
// ============================================================================

export async function vividSaveSignature(p: { signatureDataUrl: string }) {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    // Convert base64 data URL to a buffer and upload to R2
    const { getImageUploadUrl } = await import("@/lib/actions/upload")
    const result = await getImageUploadUrl("signature.png", "image/png")
    if (!result.success || !result.uploadUrl || !result.publicUrl) {
      return { success: false, error: "Failed to prepare upload" }
    }

    // Decode base64 data URL → Buffer → Blob for the PUT request
    const base64Data = p.signatureDataUrl.replace(/^data:image\/\w+;base64,/, "")
    const buffer = Buffer.from(base64Data, "base64")

    await fetch(result.uploadUrl, {
      method: "PUT",
      body: buffer,
      headers: { "Content-Type": "image/png" },
    })

    // Save the public R2 URL (not the base64 data URL)
    const { saveSignature: saveSig } = await import("@/lib/actions/signature")
    await saveSig(result.publicUrl)
    return { success: true, message: "Signature saved!" }
  } catch (error) {
    console.error("[Vivid] saveSignature error:", error)
    return { success: false, error: "Failed to save signature" }
  }
}

// ============================================================================
// Initiate Call (uses the real call system, NOT meetings)
// ============================================================================

export async function vividInitiateCall(p: { recipientId: string; recipientName: string; callType: string }) {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    // Resolve recipientId — it might be a MongoDB ObjectId string or need lookup by name
    let resolvedId = p.recipientId
    if (!Types.ObjectId.isValid(resolvedId)) {
      // Search all user conversations for a matching participant name
      const allConvos = await Conversation.find({
        participants: new Types.ObjectId(currentUser.id),
      }).lean()
      
      for (const conv of allConvos) {
        const otherId = conv.participants.find(
          (pid: Types.ObjectId) => pid.toString() !== currentUser.id
        )
        if (otherId) {
          const otherUser = await User.findById(otherId).select("firstName lastName").lean()
          if (otherUser) {
            const fullName = `${otherUser.firstName} ${otherUser.lastName}`.trim().toLowerCase()
            const searchName = p.recipientName.toLowerCase()
            if (fullName.includes(searchName) || searchName.includes(fullName) ||
                (otherUser.firstName && searchName.includes(otherUser.firstName.toLowerCase()))) {
              resolvedId = otherId.toString()
              break
            }
          }
        }
      }
      
      // If still not valid, try a direct user search by name
      if (!Types.ObjectId.isValid(resolvedId)) {
        const nameParts = p.recipientName.trim().split(/\s+/)
        const nameQuery: Doc = nameParts.length > 1
          ? { firstName: { $regex: nameParts[0], $options: "i" }, lastName: { $regex: nameParts.slice(1).join(" "), $options: "i" } }
          : { $or: [{ firstName: { $regex: nameParts[0], $options: "i" } }, { lastName: { $regex: nameParts[0], $options: "i" } }] }
        
        const foundUser = await User.findOne(nameQuery).select("_id").lean()
        if (foundUser) {
          resolvedId = foundUser._id.toString()
        } else {
          return { success: false, error: `Could not find user "${p.recipientName}". Ask the user to check messages first so you can get the correct user ID.` }
        }
      }
    }

    // Don't initiate the call server-side here — the client's CallProvider
    // + VideoCall component will handle the full call flow (create call record,
    // signal receiver, prepare tokens) when startCall() is triggered after
    // navigation.  This avoids duplicate calls.
    const callType = p.callType === "video" ? "video" : "audio"

    return {
      success: true,
      call: {
        callType,
        recipientName: p.recipientName,
        // Navigate to messages page with userId + callType so the page
        // auto-opens the conversation and triggers the outgoing call UI
        navigateTo: `/dashboard/messages?userId=${resolvedId}&callType=${callType}`,
      },
    }
  } catch (error) {
    console.error("[Vivid] initiateCall error:", error)
    return { success: false, error: "Failed to initiate call" }
  }
}

// ============================================================================
// Get User Signature
// ============================================================================

export async function vividGetUserSignature() {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const user = await User.findById(currentUser.id).select("signatureUrl").lean()
    return {
      success: true,
      hasSignature: !!user?.signatureUrl,
      signatureUrl: user?.signatureUrl || null,
    }
  } catch (error) {
    console.error("[Vivid] getUserSignature error:", error)
    return { success: false, error: "Failed to check signature" }
  }
}

// ============================================================================
// Toggle Bookmark (B1)
// ============================================================================

export async function vividToggleBookmark(p: { courseId: string }) {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const { toggleCourseBookmark } = await import("@/lib/actions/student")
    const result = await toggleCourseBookmark(p.courseId)
    return {
      success: true,
      isBookmarked: result.isBookmarked,
      message: result.isBookmarked ? "Course bookmarked!" : "Bookmark removed.",
    }
  } catch (error) {
    console.error("[Vivid] toggleBookmark error:", error)
    return { success: false, error: "Failed to toggle bookmark" }
  }
}

// ============================================================================
// Mark Lesson Complete (B2)
// ============================================================================

export async function vividMarkLessonComplete(p: { courseId: string; lessonId: string }) {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const { markLessonComplete } = await import("@/lib/actions/student")
    await markLessonComplete(p.courseId, p.lessonId)
    return { success: true, message: "Lesson marked as complete!" }
  } catch (error) {
    console.error("[Vivid] markLessonComplete error:", error)
    return { success: false, error: "Failed to mark lesson complete" }
  }
}

// ============================================================================
// Mark Course Complete (B3)
// ============================================================================

export async function vividMarkCourseComplete(p: { courseId: string }) {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const { markCourseComplete } = await import("@/lib/actions/student")
    await markCourseComplete(p.courseId)
    return { success: true, message: "Course completed! Your certificate is ready." }
  } catch (error) {
    console.error("[Vivid] markCourseComplete error:", error)
    return { success: false, error: "Failed to mark course complete" }
  }
}

// ============================================================================
// Get Watch Progress (B4)
// ============================================================================

export async function vividGetWatchProgress(p: { courseId: string }) {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const { getCourseWatchProgress } = await import("@/lib/actions/watch-progress")
    const progress = await getCourseWatchProgress(p.courseId)

    // Also get the enrollment to return overall progress
    const enrollment = await Enrollment.findOne({ user: currentUser.id, course: p.courseId })
      .select("progress completedLessons")
      .lean()

    return {
      success: true,
      courseId: p.courseId,
      overallProgress: enrollment?.progress || 0,
      completedLessonCount: enrollment?.completedLessons?.length || 0,
      lessonProgress: progress || [],
    }
  } catch (error) {
    console.error("[Vivid] getWatchProgress error:", error)
    return { success: false, error: "Failed to get watch progress" }
  }
}

// ============================================================================
// Get Bookmarks (B5)
// ============================================================================

export async function vividGetBookmarks() {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, bookmarks: [], error: "Not authenticated" }

    const { fetchMyBookmarks } = await import("@/lib/actions/student")
    const bookmarks = await fetchMyBookmarks()

    return {
      success: true,
      bookmarks: Array.isArray(bookmarks) ? bookmarks.map((b: Doc) => ({
        id: b._id?.toString() || b.id,
        courseId: b.course?._id?.toString() || b.courseId,
        courseTitle: b.course?.title || b.title || "Unknown",
        thumbnailUrl: b.course?.thumbnailUrl || b.thumbnailUrl,
        instructorName: b.course?.instructor
          ? `${b.course.instructor.firstName || ""} ${b.course.instructor.lastName || ""}`.trim()
          : b.instructorName || "",
        level: b.course?.level || b.level,
        rating: b.course?.rating?.average || b.rating || 0,
      })) : [],
    }
  } catch (error) {
    console.error("[Vivid] getBookmarks error:", error)
    return { success: false, bookmarks: [], error: "Failed to get bookmarks" }
  }
}

// ============================================================================
// Join Meeting (B6)
// ============================================================================

export async function vividJoinMeeting(p: { meetingId: string }) {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const { joinMeeting } = await import("@/lib/actions/meetings")
    const result = await joinMeeting(p.meetingId)

    return {
      success: true,
      joinUrl: `/dashboard/meetings?meetingId=${p.meetingId}`,
      meeting: result,
    }
  } catch (error) {
    console.error("[Vivid] joinMeeting error:", error)
    return { success: false, error: "Failed to join meeting" }
  }
}

// ============================================================================
// Search Users (B7)
// ============================================================================

export async function vividSearchUsers(p: { query: string; limit?: number }) {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, users: [], error: "Not authenticated" }

    const { searchUsers } = await import("@/lib/actions/messages")
    const users = await searchUsers(p.query)

    const limited = Array.isArray(users) ? users.slice(0, p.limit || 5) : []
    return {
      success: true,
      users: limited.map((u: Doc) => ({
        id: u._id?.toString() || u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        fullName: `${u.firstName || ""} ${u.lastName || ""}`.trim(),
        avatarUrl: u.avatarUrl,
        email: u.email,
        bio: u.bio,
        role: u.role,
      })),
    }
  } catch (error) {
    console.error("[Vivid] searchUsers error:", error)
    return { success: false, users: [], error: "Failed to search users" }
  }
}

// ============================================================================
// Get Unread Count (B8)
// ============================================================================

export async function vividGetUnreadCount() {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const { getTotalUnreadCount } = await import("@/lib/actions/messages")
    const raw = await getTotalUnreadCount()
    const count = raw?.count ?? 0

    return {
      success: true,
      unreadCount: count,
      message: count === 0 ? "No unread messages." : `You have ${count} unread message${count === 1 ? "" : "s"}.`,
    }
  } catch (error) {
    console.error("[Vivid] getUnreadCount error:", error)
    return { success: false, error: "Failed to get unread count" }
  }
}

// ============================================================================
// Get Completed Lessons (B9)
// ============================================================================

export async function vividGetCompletedLessons(p: { courseId: string }) {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const { getCompletedLessons } = await import("@/lib/actions/student")
    const completed = await getCompletedLessons(p.courseId)

    // Also get all lessons for context
    const lessons = await Lesson.find({ course: p.courseId, isPublished: true })
      .sort({ order: 1 })
      .select("_id title order")
      .lean()

    const completedSet = new Set(
      Array.isArray(completed) ? completed.map((id: string | Types.ObjectId) => id.toString()) : []
    )

    return {
      success: true,
      courseId: p.courseId,
      totalLessons: lessons.length,
      completedCount: completedSet.size,
      lessons: lessons.map((l, i) => ({
        id: l._id.toString(),
        title: l.title,
        order: l.order || i + 1,
        isCompleted: completedSet.has(l._id.toString()),
      })),
    }
  } catch (error) {
    console.error("[Vivid] getCompletedLessons error:", error)
    return { success: false, error: "Failed to get completed lessons" }
  }
}

// ============================================================================
// Create Vivid Session Token
// ============================================================================

interface CreateSessionParams {
  userId?: string
  userName?: string
  userLastName?: string
  userEmail?: string
  userRole?: string
  pathname?: string
}

export async function createVividSession(params: CreateSessionParams) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return { success: false, error: "Server configuration error" }

    const user = params.userId
      ? { id: params.userId, firstName: params.userName, lastName: params.userLastName, email: params.userEmail, role: params.userRole }
      : null

    let instructions = buildAcademyPrompt(user, params.pathname || "/")
    const functionNames = allVividFunctions.map((f) => f.name)
    instructions += generateFunctionInstructions(functionNames)

    const tools = allVividFunctions.map((f) => ({
      type: "function" as const,
      name: f.name,
      description: f.description,
      parameters: f.parameters,
    }))

    const res = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        modalities: ["text", "audio"],
        voice: "alloy",
        instructions,
        input_audio_transcription: { model: "whisper-1" },
        turn_detection: { type: "server_vad", threshold: 0.6, prefix_padding_ms: 400, silence_duration_ms: 600 },
        tools,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Unknown error" }))
      console.error("[Vivid] OpenAI session error:", err)
      return { success: false, error: "Failed to create voice session" }
    }

    const data = await res.json()
    return { success: true, client_secret: data.client_secret.value, expires_at: data.client_secret.expires_at }
  } catch (error) {
    console.error("[Vivid] Token generation error:", error)
    return { success: false, error: "Failed to generate token" }
  }
}

// ============================================================================
// Function Dispatcher
// ============================================================================

const handlers: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
  searchCourses: (a) => vividSearchCourses(a as Parameters<typeof vividSearchCourses>[0]),
  getCourseDetails: (a) => vividGetCourseDetails(a as Parameters<typeof vividGetCourseDetails>[0]),
  getUserEnrollments: (a) => vividGetUserEnrollments(a as Parameters<typeof vividGetUserEnrollments>[0]),
  enrollInCourse: (a) => vividEnrollInCourse(a as Parameters<typeof vividEnrollInCourse>[0]),
  getCourseLessons: (a) => vividGetCourseLessons(a as Parameters<typeof vividGetCourseLessons>[0]),
  checkActiveMeetings: () => vividCheckActiveMeetings(),
  createMeeting: (a) => vividCreateMeeting(a as Parameters<typeof vividCreateMeeting>[0]),
  getRecentMessages: (a) => vividGetRecentMessages(a as Parameters<typeof vividGetRecentMessages>[0]),
  sendMessage: (a) => vividSendMessage(a as Parameters<typeof vividSendMessage>[0]),
  getUserProfile: () => vividGetUserProfile(),
  updateUserProfile: (a) => vividUpdateProfile(a as Parameters<typeof vividUpdateProfile>[0]),
  changeLanguage: (a) => vividChangeLanguage(a as Parameters<typeof vividChangeLanguage>[0]),
  submitCourseReview: (a) => vividSubmitReview(a as Parameters<typeof vividSubmitReview>[0]),
  getMyCertificates: () => vividGetMyCertificates(),
  saveSignature: (a) => vividSaveSignature(a as Parameters<typeof vividSaveSignature>[0]),
  initiateCall: (a) => vividInitiateCall(a as Parameters<typeof vividInitiateCall>[0]),
  getUserSignature: () => vividGetUserSignature(),
  toggleBookmark: (a) => vividToggleBookmark(a as Parameters<typeof vividToggleBookmark>[0]),
  markLessonComplete: (a) => vividMarkLessonComplete(a as Parameters<typeof vividMarkLessonComplete>[0]),
  markCourseComplete: (a) => vividMarkCourseComplete(a as Parameters<typeof vividMarkCourseComplete>[0]),
  getWatchProgress: (a) => vividGetWatchProgress(a as Parameters<typeof vividGetWatchProgress>[0]),
  getBookmarks: () => vividGetBookmarks(),
  joinMeeting: (a) => vividJoinMeeting(a as Parameters<typeof vividJoinMeeting>[0]),
  searchUsers: (a) => vividSearchUsers(a as Parameters<typeof vividSearchUsers>[0]),
  getUnreadCount: () => vividGetUnreadCount(),
  getCompletedLessons: (a) => vividGetCompletedLessons(a as Parameters<typeof vividGetCompletedLessons>[0]),
}

export async function executeVividFunction(name: string, args: Record<string, unknown>) {
  try {
    const handler = handlers[name]
    if (!handler) return { success: false, error: `Function "${name}" not found` }
    return await handler(args || {})
  } catch (error) {
    console.error("[Vivid] Function error:", error)
    return { success: false, error: error instanceof Error ? error.message : "Function failed" }
  }
}
