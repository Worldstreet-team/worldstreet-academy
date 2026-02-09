import { NextResponse } from "next/server"
import { Types } from "mongoose"
import connectDB from "@/lib/db"
import { Call, User, type IUser } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth"

export async function GET() {
  try {
    await connectDB()
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = new Types.ObjectId(currentUser.id)

    // Expire stale ringing calls (>45 seconds old)
    const staleThreshold = new Date(Date.now() - 45_000)
    await Call.updateMany(
      { status: "ringing", createdAt: { $lt: staleThreshold } },
      { status: "missed", endedAt: new Date() }
    )

    // Find any ringing call where this user is the receiver
    const incomingCall = await Call.findOne({
      receiverId: userId,
      status: "ringing",
    })
      .sort({ createdAt: -1 })
      .lean()

    if (!incomingCall) {
      return NextResponse.json({ incoming: null })
    }

    // Get caller info
    const caller = await User.findById(incomingCall.callerId)
      .select<Pick<IUser, "firstName" | "lastName" | "avatarUrl">>("firstName lastName avatarUrl")
      .lean()

    return NextResponse.json({
      incoming: {
        callId: incomingCall._id.toString(),
        callerName: caller
          ? `${caller.firstName} ${caller.lastName}`.trim()
          : "Unknown",
        callerAvatar: caller?.avatarUrl || null,
        callType: incomingCall.type,
        conversationId: incomingCall.conversationId.toString(),
      },
    })
  } catch (error) {
    console.error("Error polling calls:", error)
    return NextResponse.json({ error: "Failed to poll calls" }, { status: 500 })
  }
}
