"use server"

import { Meeting, User } from "@/lib/db/models"
import { Types } from "mongoose"
import { initAction } from "./helpers"

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
