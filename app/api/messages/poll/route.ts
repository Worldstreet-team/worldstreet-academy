import { NextRequest, NextResponse } from "next/server"
import { Types } from "mongoose"
import connectDB from "@/lib/db"
import { Message, Conversation, User, type IUser } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth"
import type { MessageWithDetails } from "@/lib/actions/messages"

export async function GET(request: NextRequest) {
  try {
    await connectDB()
    const currentUser = await getCurrentUser()
    
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get("conversationId")
    const lastMessageId = searchParams.get("lastMessageId")

    if (!conversationId) {
      return NextResponse.json({ error: "Missing conversationId" }, { status: 400 })
    }

    const userId = new Types.ObjectId(currentUser.id)
    const convId = new Types.ObjectId(conversationId)

    // Verify user is part of conversation
    const conversation = await Conversation.findOne({
      _id: convId,
      participants: userId,
    })

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    // Build query for new messages
    const query: Record<string, unknown> = { conversationId: convId }
    
    if (lastMessageId) {
      const lastMessage = await Message.findById(lastMessageId)
      if (lastMessage) {
        query.createdAt = { $gt: lastMessage.createdAt }
      }
    }

    const messages = await Message.find(query)
      .sort({ createdAt: 1 })
      .populate<{ senderId: IUser }>("senderId")
      .lean()

    // Mark received messages as read
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
      fileName: msg.fileName,
      fileSize: msg.fileSize,
      duration: msg.duration,
      waveform: msg.waveform,
      isOwn: msg.senderId._id.toString() === currentUser.id,
      isRead: msg.isRead,
      isDelivered: msg.isDelivered,
      timestamp: msg.createdAt,
    }))

    return NextResponse.json({ messages: messagesWithDetails })
  } catch (error) {
    console.error("Error polling messages:", error)
    return NextResponse.json({ error: "Failed to poll messages" }, { status: 500 })
  }
}
