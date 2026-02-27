"use server"

import { Conversation, Message, User } from "@/lib/db/models"
import { Types } from "mongoose"
import { initAction, type Doc } from "./helpers"

export async function vividGetRecentMessages(p: { limit?: number }) {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, conversations: [], error: "Not authenticated" }

    const conversations = await Conversation.find({
      participants: new Types.ObjectId(currentUser.id),
    })
      .sort({ lastMessageAt: -1 })
      .limit(p.limit || 15)
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

export async function vividSendMessage(p: { recipientId: string; content: string }) {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const { sendMessage } = await import("@/lib/actions/messages")
    const result = await sendMessage(p.recipientId, p.content)
    if (!result.success) return { success: false, error: result.error || "Failed to send" }
    return { success: true, message: "Message sent!" }
  } catch (error) {
    console.error("[Vivid] sendMessage error:", error)
    return { success: false, error: "Failed to send message" }
  }
}

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

export async function vividSearchUsers(p: { query: string; limit?: number }) {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, users: [], error: "Not authenticated" }

    const { searchUsers } = await import("@/lib/actions/messages")
    const users = await searchUsers(p.query)

    const limited = Array.isArray(users) ? users.slice(0, p.limit || 15) : []
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
