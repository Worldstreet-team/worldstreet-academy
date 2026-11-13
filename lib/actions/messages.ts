"use server"

import { Types } from "mongoose"
import connectDB from "@/lib/db"
// 2026-11-12: Course and Enrollment for who a learner may message. Was:
// import { Message, Conversation, User, type IMessage, type IConversation, type IUser } from "@/lib/db/models"
import {
  Message,
  Conversation,
  Course,
  Enrollment,
  User,
  type IMessage,
  type IConversation,
  type IUser,
} from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth"
import { emitEvent, type MessageEventPayload } from "@/lib/call-events"
import { instructorQaRefusal } from "@/lib/course-access"
import { R2_PUBLIC_URL } from "@/lib/r2"
import { assignedFacultyFor } from "@/lib/teaching"

const OBJECT_ID = /^[a-f0-9]{24}$/
const MESSAGE_TYPES: readonly string[] = ["text", "image", "video", "audio", "file"]
const MAX_MESSAGE_LENGTH = 5000

/**
 * 2026-11-12: a message's media may only be a file we stored (a link into our
 * public bucket, as avatars are). Any other URL reached the receiver's <img>,
 * <video> and download fallback (window.open) as typed: a tracking pixel, or a
 * javascript: link run on our origin.
 */
function isOurFileUrl(url: unknown): url is string {
  return typeof url === "string" && url.length <= 2048 && Boolean(R2_PUBLIC_URL) && url.startsWith(`${R2_PUBLIC_URL}/`)
}

function shortText(value: unknown): string | undefined {
  return typeof value === "string" ? value.slice(0, 200) : undefined
}

/*
 * Who a learner may message (Owen, 2026-11-12). A learner (role USER) sees, and
 * starts a chat or a call with, only the people they study with: classmates
 * (an active or completed seat in a course the learner holds an active or
 * completed seat in), those courses' teachers (the owner, and the assigned
 * faculty who still hold a faculty role — lib/teaching.ts), admins (support),
 * and anyone they already have a conversation with. Existing conversations
 * keep working both ways. Instructors and admins reach anyone, as before.
 */
const STUDYING = ["active", "completed"]
/** A learner's own seats considered: far more than anyone holds. */
const MAX_CIRCLE_COURSES = 50
/** Classmates the new-chat search can find. Messaging any classmate is checked exactly (newContactRefusal). */
const MAX_LISTED_CLASSMATES = 1000
/** Conversation partners the new-chat search can find. */
const MAX_LISTED_PARTNERS = 200
/** Suggestions in the new-chat sheet before anything is typed. */
const MAX_SUGGESTIONS = 8
const CONTACTS_RULE = "You can message classmates and tutors from your programs, and our support team."

/** The courses a learner is in, and the ids of the people who teach them. */
async function studyCircle(userId: string): Promise<{ courseIds: Types.ObjectId[]; teacherIds: Set<string> }> {
  const seats = await Enrollment.find({ user: userId, status: { $in: STUDYING } })
    .select("course")
    .limit(MAX_CIRCLE_COURSES)
    .lean()
  const courseIds = seats.map((s) => s.course)
  const teacherIds = new Set<string>()
  if (courseIds.length === 0) return { courseIds, teacherIds }
  // courseTeacherIds (lib/teaching.ts) for every course at once: the owner, plus assignedFacultyFor.
  const [owners, faculty] = await Promise.all([
    Course.find({ _id: { $in: courseIds } }).select("instructor").lean(),
    assignedFacultyFor(courseIds.map((id) => id.toString())),
  ])
  for (const course of owners) if (course.instructor) teacherIds.add(course.instructor.toString())
  for (const members of faculty.values()) for (const member of members) teacherIds.add(member.id)
  teacherIds.delete(userId)
  return { courseIds, teacherIds }
}

/**
 * Null when this user may open a NEW conversation (or call) with the
 * recipient, else why not. Asked only when no conversation exists yet.
 */
async function newContactRefusal(user: { id: string; role: string }, recipientId: string): Promise<string | null> {
  if (user.role !== "USER") return null
  if (!OBJECT_ID.test(recipientId)) return "User not found"
  const [recipient, circle] = await Promise.all([
    User.findById(recipientId).select("role").lean(),
    studyCircle(user.id),
  ])
  if (!recipient) return "User not found"
  if (recipient.role === "ADMIN") return null
  if (circle.teacherIds.has(recipientId)) return null
  if (circle.courseIds.length > 0) {
    const classmate = await Enrollment.exists({
      user: recipient._id,
      course: { $in: circle.courseIds },
      status: { $in: STUDYING },
    })
    if (classmate) return null
  }
  return CONTACTS_RULE
}

/** Classmates for the new-chat lists, capped (MAX_LISTED_CLASSMATES), without the learner. */
async function listedClassmates(userId: string, courseIds: Types.ObjectId[]): Promise<Types.ObjectId[]> {
  if (courseIds.length === 0) return []
  const seats = await Enrollment.find({
    course: { $in: courseIds },
    status: { $in: STUDYING },
    user: { $ne: new Types.ObjectId(userId) },
  })
    .select("user")
    .limit(MAX_LISTED_CLASSMATES)
    .lean()
  const unique = new Map(seats.map((s) => [s.user.toString(), s.user]))
  return [...unique.values()]
}

/** Who a learner may find by name: teachers, classmates and conversation partners (admins are matched by role). */
async function searchableContactIds(userId: string): Promise<Types.ObjectId[]> {
  const me = new Types.ObjectId(userId)
  const [circle, conversations] = await Promise.all([
    studyCircle(userId),
    Conversation.find({ participants: me })
      .sort({ lastMessageAt: -1 })
      .select("participants")
      .limit(MAX_LISTED_PARTNERS)
      .lean(),
  ])
  const classmates = await listedClassmates(userId, circle.courseIds)
  const ids = new Map<string, Types.ObjectId>()
  for (const id of circle.teacherIds) ids.set(id, new Types.ObjectId(id))
  for (const id of classmates) ids.set(id.toString(), id)
  for (const conv of conversations) {
    for (const p of conv.participants) if (p.toString() !== userId) ids.set(p.toString(), p)
  }
  return [...ids.values()]
}

type ContactRow = {
  _id: Types.ObjectId
  firstName?: string | null
  lastName?: string | null
  username?: string | null
  avatarUrl?: string | null
  role: string
}

function toSearchResult(u: ContactRow): UserSearchResult {
  return {
    id: u._id.toString(),
    name: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim(),
    username: u.username ?? "",
    avatar: u.avatarUrl || null,
    role: u.role,
  }
}

/** A learner's suggestions before they type: their teachers, then classmates, then support. */
async function learnerSuggestions(userId: string): Promise<UserSearchResult[]> {
  const me = new Types.ObjectId(userId)
  const circle = await studyCircle(userId)
  const classmateIds = await listedClassmates(userId, circle.courseIds)
  const teacherIds = [...circle.teacherIds].map((id) => new Types.ObjectId(id))
  const fields = "firstName lastName username avatarUrl role"
  const [staff, classmates] = await Promise.all([
    User.find({ _id: { $ne: me }, $or: [{ _id: { $in: teacherIds } }, { role: "ADMIN" }] })
      .select(fields)
      .limit(50)
      .lean<ContactRow[]>(),
    classmateIds.length > 0
      ? User.find({ _id: { $in: classmateIds } })
          .sort({ createdAt: -1 })
          .select(fields)
          .limit(MAX_SUGGESTIONS)
          .lean<ContactRow[]>()
      : Promise.resolve([] as ContactRow[]),
  ])
  const teachers = staff.filter((u) => circle.teacherIds.has(u._id.toString()))
  const support = staff.filter((u) => !circle.teacherIds.has(u._id.toString()))
  const seen = new Set<string>()
  return [...teachers, ...classmates, ...support]
    .filter((u) => {
      const id = u._id.toString()
      if (seen.has(id)) return false
      seen.add(id)
      return true
    })
    .slice(0, MAX_SUGGESTIONS)
    .map(toSearchResult)
}

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

        // Count unread messages (exclude call event system messages)
        const unreadCount = await Message.countDocuments({
          conversationId: conv._id,
          receiverId: userId,
          isRead: false,
          content: { $not: /^CALL_EVENT:/ },
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

    if (typeof conversationId !== "string" || !OBJECT_ID.test(conversationId)) {
      return { success: false, error: "Conversation not found" }
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

    // 2026-11-12: a message whose sender's account no longer exists threw and
    // the whole conversation failed to open; it is left out.
    // const messagesWithDetails: MessageWithDetails[] = messages.map((msg) => ({
    const messagesWithDetails: MessageWithDetails[] = messages.filter((msg) => msg.senderId).map((msg) => ({
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

    // 2026-11-12: everything below arrives from the browser as typed.
    if (typeof receiverId !== "string" || !OBJECT_ID.test(receiverId)) {
      return { success: false, error: "Recipient not found" }
    }
    // To yourself, `$all: [me, me]` matched any conversation of yours and posted into it.
    if (receiverId === currentUser.id) return { success: false, error: "You can't message yourself" }
    if (!MESSAGE_TYPES.includes(type)) return { success: false, error: "This kind of message isn't supported" }
    if (typeof content !== "string" || content.length > MAX_MESSAGE_LENGTH) {
      return { success: false, error: "Messages can be up to 5,000 characters" }
    }
    if (type === "text" && !content.trim()) return { success: false, error: "Write a message first" }
    if (type !== "text" && !fileData) return { success: false, error: "Upload the file again" }
    if (
      fileData &&
      (!isOurFileUrl(fileData.url) ||
        (fileData.urls !== undefined &&
          (!Array.isArray(fileData.urls) || fileData.urls.length > 20 || !fileData.urls.every(isOurFileUrl))))
    ) {
      return { success: false, error: "Upload the file again" }
    }
    if (fileData) {
      fileData = {
        url: fileData.url,
        urls: fileData.urls,
        name: shortText(fileData.name),
        size: shortText(fileData.size),
        duration: shortText(fileData.duration),
        waveform:
          Array.isArray(fileData.waveform) &&
          fileData.waveform.length <= 200 &&
          fileData.waveform.every((n) => typeof n === "number" && Number.isFinite(n))
            ? fileData.waveform
            : undefined,
      }
    }

    const senderId = new Types.ObjectId(currentUser.id)
    const recipientId = new Types.ObjectId(receiverId)

    // Find or create conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, recipientId] },
    })

    if (!conversation) {
      // 2026-11-12: never a conversation with an account that doesn't exist.
      if (!(await User.exists({ _id: recipientId }))) return { success: false, error: "Recipient not found" }
      // 2026-11-12: a learner starts a chat only with someone they study with, or support.
      const outsider = await newContactRefusal(currentUser, receiverId)
      if (outsider) return { success: false, error: outsider }
      const refusal = await instructorQaRefusal(currentUser, receiverId)
      if (refusal) return { success: false, error: refusal }

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

    // Emit SSE event to both the receiver AND sender for instant delivery.
    // Sender needs the event too — when Vivid AI sends a message on the
    // user's behalf, the messages page is open but has no optimistic update.
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
    await Promise.all([
      emitEvent(recipientId.toString(), msgEvent),
      emitEvent(senderId.toString(), { ...msgEvent }),
    ])

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

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
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

    // 2026-11-12: a string only, and a sane length.
    // if (!query || query.length < 2) {
    if (typeof query !== "string" || query.trim().length < 2 || query.length > 100) {
      return { success: true, users: [] }
    }

    // Typed text is matched literally (never as a pattern), and an email only
    // in full — a partial one would list who has an account.
    const rx = new RegExp(escapeRegex(query.trim()), "i")
    // 2026-11-12: a learner finds only the people they may message, never the whole platform.
    const learnerContacts = currentUser.role === "USER" ? await searchableContactIds(currentUser.id) : null
    const users = await User.find({
      _id: { $ne: new Types.ObjectId(currentUser.id) },
      $or: [
        { firstName: rx },
        { lastName: rx },
        { username: rx },
        { email: query.trim().toLowerCase() },
      ],
      ...(learnerContacts ? { $and: [{ $or: [{ role: "ADMIN" }, { _id: { $in: learnerContacts } }] }] } : {}),
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

    // 2026-11-12: an id string, never yourself (`$all: [me, me]` matched any conversation of yours).
    if (typeof userId !== "string" || !OBJECT_ID.test(userId)) return { success: false, error: "User not found" }
    if (userId === currentUser.id) return { success: false, error: "You can't message yourself" }

    const senderId = new Types.ObjectId(currentUser.id)
    const recipientId = new Types.ObjectId(userId)

    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, recipientId] },
    })

    if (!conversation) {
      if (!(await User.exists({ _id: recipientId }))) return { success: false, error: "User not found" }
      // 2026-11-12: a learner starts a chat only with someone they study with, or support.
      const outsider = await newContactRefusal(currentUser, userId)
      if (outsider) return { success: false, error: outsider }
      const refusal = await instructorQaRefusal(currentUser, userId)
      if (refusal) return { success: false, error: refusal }

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

    if (typeof conversationId !== "string" || !OBJECT_ID.test(conversationId)) {
      return { success: false, error: "Conversation not found" }
    }
    const userId = new Types.ObjectId(currentUser.id)
    const convId = new Types.ObjectId(conversationId)

    // Find unread messages to know who to notify
    const unreadMessages = await Message.find(
      { conversationId: convId, receiverId: userId, isRead: false }
    ).select("senderId").lean()

    if (unreadMessages.length === 0) return { success: true }

    await Message.updateMany(
      { conversationId: convId, receiverId: userId, isRead: false },
      { isRead: true }
    )

    // Emit message:read event to senders so their UI updates read receipts
    const senderIds = [...new Set(unreadMessages.map((m) => m.senderId.toString()))]
    for (const senderId of senderIds) {
      if (senderId !== currentUser.id) {
        await emitEvent(senderId, {
          type: "message:read",
          messageId: "",
          conversationId,
          senderId: currentUser.id,
          senderName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
          senderAvatar: currentUser.avatarUrl || null,
          content: "",
          messageType: "text",
          timestamp: new Date().toISOString(),
        })
      }
    }

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
      content: { $not: /^CALL_EVENT:/ },
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

    // 2026-11-12: a learner is offered the people they study with (and support), not the newest sign-ups.
    if (currentUser.role === "USER") {
      return { success: true, users: await learnerSuggestions(currentUser.id) }
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

    if (typeof messageId !== "string" || !OBJECT_ID.test(messageId)) return { success: false, error: "Message not found" }
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
      await emitEvent(receiverId.toString(), {
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
