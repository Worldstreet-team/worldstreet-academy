"use server"

import { Types } from "mongoose"
import connectDB from "@/lib/db"
import { Message, Conversation, User, type IMessage, type IConversation, type IUser } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth"
import { emitEvent, type MessageEventPayload } from "@/lib/call-events"

export type ConversationWithDetails = {
  id: string
  participant: {
    id: string
    name: string
    avatar: string | null
    isOnline: boolean
  }
  lastMessage: string
  lastMessageType: "text" | "image" | "video" | "audio" | "file"
  isOwnLastMessage: boolean
  lastMessageAt: Date
  unreadCount: number
}

export type MessageWithDetails = {
  id: string
  senderId: string
  senderName: string
  senderAvatar: string | null
  content: string
  type: "text" | "image" | "video" | "audio" | "file"
  fileUrl?: string
  fileUrls?: string[]
  fileName?: string
  fileSize?: string
  duration?: string
  waveform?: number[]
  isOwn: boolean
  isRead: boolean
  isDelivered: boolean
  timestamp: Date
}

export type UserSearchResult = {
  id: string
  name: string
  username: string
  avatar: string | null
  role: string
}

// Get all conversations for the current user
export async function getConversations(): Promise<{ 
  success: boolean
  conversations?: ConversationWithDetails[]
  error?: string 
}> {
  try {
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return { success: false, error: "Unauthorized" }
    }

    const userId = new Types.ObjectId(currentUser.id)

    const conversations = await Conversation.find({
      participants: userId,
    })
      .sort({ lastMessageAt: -1 })
      .populate<{ participants: IUser[] }>("participants")
      .populate<{ lastMessage: IMessage }>("lastMessage")
      .lean()

    const conversationsWithDetails = await Promise.all(
      conversations.map(async (conv) => {
        const otherParticipant = conv.participants.find(
          (p) => p._id.toString() !== currentUser.id
        )

        // Count unread messages
        const unreadCount = await Message.countDocuments({
          conversationId: conv._id,
          receiverId: userId,
          isRead: false,
        })

        return {
          id: conv._id.toString(),
          participant: {
            id: otherParticipant?._id.toString() || "",
            name: otherParticipant
              ? `${otherParticipant.firstName} ${otherParticipant.lastName}`.trim()
              : "Unknown",
            avatar: otherParticipant?.avatarUrl || null,
            isOnline: false, // Would need real-time presence system
          },
          lastMessage: conv.lastMessage?.content || "",
          lastMessageType: conv.lastMessage?.type || "text",
          isOwnLastMessage: conv.lastMessage?.senderId?.toString() === currentUser.id,
          lastMessageAt: conv.lastMessageAt,
          unreadCount,
        }
      })
    )

    return { success: true, conversations: conversationsWithDetails }
  } catch (error) {
    console.error("Error fetching conversations:", error)
    return { success: false, error: "Failed to fetch conversations" }
  }
}

// Get messages for a conversation
export async function getMessages(conversationId: string): Promise<{
  success: boolean
  messages?: MessageWithDetails[]
  error?: string
}> {
  try {
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return { success: false, error: "Unauthorized" }
    }

    const userId = new Types.ObjectId(currentUser.id)
    const convId = new Types.ObjectId(conversationId)

    // Verify user is part of conversation
    const conversation = await Conversation.findOne({
      _id: convId,
      participants: userId,
    })

    if (!conversation) {
      return { success: false, error: "Conversation not found" }
    }

    const messages = await Message.find({ conversationId: convId })
      .sort({ createdAt: 1 })
      .populate<{ senderId: IUser }>("senderId")
      .lean()

    // Mark messages as read
    await Message.updateMany(
      { conversationId: convId, receiverId: userId, isRead: false },
      { isRead: true }
    )

    const messagesWithDetails: MessageWithDetails[] = messages.map((msg) => ({
      id: msg._id.toString(),
      senderId: msg.senderId._id.toString(),
      senderName: `${msg.senderId.firstName} ${msg.senderId.lastName}`.trim(),
      senderAvatar: msg.senderId.avatarUrl || null,
      content: msg.content,
      type: msg.type,
      fileUrl: msg.fileUrl,
      fileUrls: msg.fileUrls,
      fileName: msg.fileName,
      fileSize: msg.fileSize,
      duration: msg.duration,
      waveform: msg.waveform,
      isOwn: msg.senderId._id.toString() === currentUser.id,
      isRead: msg.isRead,
      isDelivered: msg.isDelivered,
      timestamp: msg.createdAt,
    }))

    return { success: true, messages: messagesWithDetails }
  } catch (error) {
    console.error("Error fetching messages:", error)
    return { success: false, error: "Failed to fetch messages" }
  }
}

// Send a message
export async function sendMessage(
  receiverId: string,
  content: string,
  type: "text" | "image" | "video" | "audio" | "file" = "text",
  fileData?: { url: string; urls?: string[]; name?: string; size?: string; duration?: string; waveform?: number[] }
): Promise<{ success: boolean; message?: MessageWithDetails; error?: string }> {
  try {
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return { success: false, error: "Unauthorized" }
    }

    const senderId = new Types.ObjectId(currentUser.id)
    const recipientId = new Types.ObjectId(receiverId)

    // Find or create conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, recipientId] },
    })

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [senderId, recipientId],
        lastMessageAt: new Date(),
      })
    }

    // Create message
    const message = await Message.create({
      conversationId: conversation._id,
      senderId,
      receiverId: recipientId,
      content,
      type,
      fileUrl: fileData?.url,
      fileUrls: fileData?.urls,
      fileName: fileData?.name,
      fileSize: fileData?.size,
      duration: fileData?.duration,
      waveform: fileData?.waveform,
      isDelivered: true,
    })

    // Update conversation
    conversation.lastMessage = message._id
    conversation.lastMessageAt = new Date()
    await conversation.save()

    const senderName = `${currentUser.firstName} ${currentUser.lastName}`.trim()
    const senderAvatar = currentUser.avatarUrl || null

    // Emit SSE event to the receiver for instant delivery
    const msgEvent: MessageEventPayload = {
      type: "message:new",
      messageId: message._id.toString(),
      conversationId: conversation._id.toString(),
      senderId: senderId.toString(),
      senderName,
      senderAvatar,
      content,
      messageType: type,
      fileUrl: fileData?.url,
      fileUrls: fileData?.urls,
      fileName: fileData?.name,
      fileSize: fileData?.size,
      duration: fileData?.duration,
      waveform: fileData?.waveform,
      timestamp: message.createdAt.toISOString(),
    }
    emitEvent(recipientId.toString(), msgEvent)

    return {
      success: true,
      message: {
        id: message._id.toString(),
        senderId: senderId.toString(),
        senderName,
        senderAvatar,
        content,
        type,
        fileUrl: fileData?.url,
        fileUrls: fileData?.urls,
        fileName: fileData?.name,
        fileSize: fileData?.size,
        duration: fileData?.duration,
        waveform: fileData?.waveform,
        isOwn: true,
        isRead: false,
        isDelivered: true,
        timestamp: message.createdAt,
      },
    }
  } catch (error) {
    console.error("Error sending message:", error)
    return { success: false, error: "Failed to send message" }
  }
}

// Search users to start a conversation with
export async function searchUsers(query: string): Promise<{
  success: boolean
  users?: UserSearchResult[]
  error?: string
}> {
  try {
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return { success: false, error: "Unauthorized" }
    }

    if (!query || query.length < 2) {
      return { success: true, users: [] }
    }

    const users = await User.find({
      _id: { $ne: new Types.ObjectId(currentUser.id) },
      $or: [
        { firstName: { $regex: query, $options: "i" } },
        { lastName: { $regex: query, $options: "i" } },
        { username: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
      ],
    })
      .limit(10)
      .select("firstName lastName username avatarUrl role")
      .lean()

    return {
      success: true,
      users: users.map((u) => ({
        id: u._id.toString(),
        name: `${u.firstName} ${u.lastName}`.trim(),
        username: u.username,
        avatar: u.avatarUrl || null,
        role: u.role,
      })),
    }
  } catch (error) {
    console.error("Error searching users:", error)
    return { success: false, error: "Failed to search users" }
  }
}

// Get or create a conversation with a user
export async function getOrCreateConversation(userId: string): Promise<{
  success: boolean
  conversationId?: string
  error?: string
}> {
  try {
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return { success: false, error: "Unauthorized" }
    }

    const senderId = new Types.ObjectId(currentUser.id)
    const recipientId = new Types.ObjectId(userId)

    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, recipientId] },
    })

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [senderId, recipientId],
        lastMessageAt: new Date(),
      })
    }

    return { success: true, conversationId: conversation._id.toString() }
  } catch (error) {
    console.error("Error getting/creating conversation:", error)
    return { success: false, error: "Failed to get conversation" }
  }
}

// Mark messages as read
export async function markMessagesAsRead(conversationId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return { success: false, error: "Unauthorized" }
    }

    const userId = new Types.ObjectId(currentUser.id)
    const convId = new Types.ObjectId(conversationId)

    await Message.updateMany(
      { conversationId: convId, receiverId: userId, isRead: false },
      { isRead: true }
    )

    return { success: true }
  } catch (error) {
    console.error("Error marking messages as read:", error)
    return { success: false, error: "Failed to mark messages as read" }
  }
}

// Get total unread message count across all conversations
export async function getTotalUnreadCount(): Promise<{
  success: boolean
  count?: number
  error?: string
}> {
  try {
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return { success: false, error: "Unauthorized" }
    }

    const userId = new Types.ObjectId(currentUser.id)

    const count = await Message.countDocuments({
      receiverId: userId,
      isRead: false,
    })

    return { success: true, count }
  } catch (error) {
    console.error("Error fetching unread count:", error)
    return { success: false, error: "Failed to fetch unread count" }
  }
}

// Get recently added users (newest signups excluding current user)
export async function getRecentUsers(): Promise<{
  success: boolean
  users?: UserSearchResult[]
  error?: string
}> {
  try {
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return { success: false, error: "Unauthorized" }
    }

    const users = await User.find({
      _id: { $ne: new Types.ObjectId(currentUser.id) },
    })
      .sort({ createdAt: -1 })
      .limit(8)
      .select("firstName lastName username avatarUrl role")
      .lean()

    return {
      success: true,
      users: users.map((u) => ({
        id: u._id.toString(),
        name: `${u.firstName} ${u.lastName}`.trim(),
        username: u.username,
        avatar: u.avatarUrl || null,
        role: u.role,
      })),
    }
  } catch (error) {
    console.error("Error fetching recent users:", error)
    return { success: false, error: "Failed to fetch recent users" }
  }
}

// Delete a message (only own messages)
export async function deleteMessage(messageId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const message = await Message.findById(messageId)
    if (!message) return { success: false, error: "Message not found" }

    if (message.senderId.toString() !== currentUser.id) {
      return { success: false, error: "Can only delete your own messages" }
    }

    const conversationId = message.conversationId
    const receiverId = message.receiverId
    await Message.findByIdAndDelete(messageId)

    // Notify the other participant about deletion
    if (receiverId) {
      emitEvent(receiverId.toString(), {
        type: "message:deleted",
        messageId,
        conversationId: conversationId.toString(),
        senderId: currentUser.id,
        senderName: "",
        senderAvatar: null,
        content: "",
        messageType: "text",
        timestamp: new Date().toISOString(),
      } as MessageEventPayload)
    }

    // Update conversation's last message if this was the latest
    const lastMsg = await Message.findOne({ conversationId })
      .sort({ createdAt: -1 })
      .lean()

    if (lastMsg) {
      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: lastMsg._id,
        lastMessageAt: lastMsg.createdAt,
      })
    }

    return { success: true }
  } catch (error) {
    console.error("Error deleting message:", error)
    return { success: false, error: "Failed to delete message" }
  }
}
