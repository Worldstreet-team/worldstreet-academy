"use server"

import { Conversation, User } from "@/lib/db/models"
import { Types } from "mongoose"
import { initAction, type Doc } from "./helpers"

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

export async function vividInitiateCall(p: { recipientId: string; recipientName: string; callType: string }) {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    let resolvedId = p.recipientId
    if (!Types.ObjectId.isValid(resolvedId)) {
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

      if (!Types.ObjectId.isValid(resolvedId)) {
        const nameParts = p.recipientName.trim().split(/\s+/)
        const nameQuery: Doc = nameParts.length > 1
          ? { firstName: { $regex: nameParts[0], $options: "i" }, lastName: { $regex: nameParts.slice(1).join(" "), $options: "i" } }
          : { $or: [{ firstName: { $regex: nameParts[0], $options: "i" } }, { lastName: { $regex: nameParts[0], $options: "i" } }] }

        const foundUsers = await User.find(nameQuery).select("_id firstName lastName avatarUrl").limit(5).lean()
        if (foundUsers.length === 1) {
          resolvedId = foundUsers[0]._id.toString()
        } else if (foundUsers.length > 1) {
          return {
            success: false,
            disambiguation: true,
            message: `Found ${foundUsers.length} people named "${p.recipientName}". Ask the user which one they mean.`,
            users: foundUsers.map(u => ({
              id: u._id.toString(),
              name: `${u.firstName || ""} ${u.lastName || ""}`.trim(),
              avatarUrl: u.avatarUrl,
            })),
          }
        } else {
          return { success: false, error: `Could not find user "${p.recipientName}". Try searching for them by name first.` }
        }
      }
    }

    const callType = p.callType === "video" ? "video" : "audio"

    return {
      success: true,
      call: {
        callType,
        recipientName: p.recipientName,
        navigateTo: `/dashboard/messages?userId=${resolvedId}&callType=${callType}`,
      },
    }
  } catch (error) {
    console.error("[Vivid] initiateCall error:", error)
    return { success: false, error: "Failed to initiate call" }
  }
}
