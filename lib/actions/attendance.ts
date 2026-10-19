"use server"

import { z } from "zod/v4"
import connectDB from "@/lib/db"
import { getCurrentUser } from "@/lib/auth/actions"
import { bankAttendance } from "@/lib/attendance"

/**
 * The attendance heartbeat. MeetingProvider calls it every ATTENDANCE_PING_MS
 * while a non-host is in a meeting; the server banks the open interval of the
 * caller's own row (meetings that aren't course classes have none). No
 * revalidatePath: nothing cached shows live attendance.
 */
export async function pingAttendance(
  meetingId: string
): Promise<{ success: true; data: null } | { success: false; error: string }> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "You need to be signed in" }
    if (!z.string().regex(/^[a-f0-9]{24}$/).safeParse(meetingId).success) {
      return { success: false, error: "Meeting not found" }
    }
    await bankAttendance(meetingId, user.id)
    return { success: true, data: null }
  } catch (error) {
    console.error("[Attendance] ping error:", error)
    return { success: false, error: "Could not record attendance" }
  }
}
