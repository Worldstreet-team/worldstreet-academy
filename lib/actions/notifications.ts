"use server"

import connectDB from "@/lib/db"
import { Notification } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth/actions"

export type NotificationItem = {
  id: string
  type: "application" | "course" | "payment" | "meeting" | "system"
  title: string
  body: string
  href: string | null
  read: boolean
  createdAt: string
}

/** The signed-in user's latest notifications plus their unread count. */
export async function getMyNotifications(limit = 25): Promise<{
  notifications: NotificationItem[]
  unreadCount: number
}> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { notifications: [], unreadCount: 0 }

    const [rows, unreadCount] = await Promise.all([
      Notification.find({ user: user.id }).sort({ createdAt: -1 }).limit(limit).lean(),
      Notification.countDocuments({ user: user.id, readAt: null }),
    ])

    return {
      unreadCount,
      notifications: rows.map((n) => ({
        id: n._id.toString(),
        type: n.type,
        title: n.title,
        body: n.body,
        href: n.href ?? null,
        read: n.readAt != null,
        createdAt: n.createdAt.toISOString(),
      })),
    }
  } catch (error) {
    console.error("Get notifications error:", error)
    return { notifications: [], unreadCount: 0 }
  }
}

export async function markNotificationRead(notificationId: string) {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false }

    await Notification.updateOne(
      { _id: notificationId, user: user.id, readAt: null },
      { $set: { readAt: new Date() } }
    )
    return { success: true }
  } catch (error) {
    console.error("Mark notification read error:", error)
    return { success: false }
  }
}

export async function markAllNotificationsRead() {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false }

    await Notification.updateMany(
      { user: user.id, readAt: null },
      { $set: { readAt: new Date() } }
    )
    return { success: true }
  } catch (error) {
    console.error("Mark all notifications read error:", error)
    return { success: false }
  }
}
