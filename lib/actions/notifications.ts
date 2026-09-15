"use server"

import { Types } from "mongoose"
import { z } from "zod/v4"
import connectDB from "@/lib/db"
import { Notification, type NotificationType } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth/actions"
import {
  CATEGORY_OF,
  NOTIFICATION_CATEGORIES,
  typesIn,
  type NotificationCategory,
} from "@/lib/notification-categories"

export type NotificationItem = {
  id: string
  type: NotificationType
  /** Where the hub files it — course activity leads. */
  category: NotificationCategory
  title: string
  body: string
  href: string | null
  read: boolean
  createdAt: string
  /** The program it is about, when it is about one. */
  course: { id: string; title: string; thumbnailUrl: string | null } | null
}

export type NotificationFeed = {
  notifications: NotificationItem[]
  unreadCount: number
  unreadByCategory: Record<NotificationCategory, number>
}

const OBJECT_ID = /^[a-f0-9]{24}$/

type FeedRow = {
  _id: { toString(): string }
  type: NotificationType
  title: string
  body: string
  href?: string | null
  readAt?: Date | null
  createdAt: Date
  course?: { _id: { toString(): string }; title: string; thumbnailUrl?: string | null } | null
}

function emptyCounts(): Record<NotificationCategory, number> {
  return { courses: 0, payments: 0, account: 0 }
}

/** The signed-in user's latest notifications, with their programs, plus unread counts per category. */
export async function getMyNotifications(limit = 25): Promise<NotificationFeed> {
  const empty: NotificationFeed = { notifications: [], unreadCount: 0, unreadByCategory: emptyCounts() }
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return empty

    // The limit arrives from the browser — keep it to a sane page.
    const pageSize = Math.min(Math.max(Math.trunc(Number(limit)) || 25, 1), 100)

    const [rows, unreadByType] = await Promise.all([
      Notification.find({ user: user.id })
        .sort({ createdAt: -1 })
        .limit(pageSize)
        .populate({ path: "course", select: "title thumbnailUrl" })
        .lean<FeedRow[]>(),
      // Aggregation doesn't cast, so the user id goes in as an ObjectId.
      Notification.aggregate<{ _id: NotificationType; n: number }>([
        { $match: { user: new Types.ObjectId(user.id), readAt: null } },
        { $group: { _id: "$type", n: { $sum: 1 } } },
      ]),
    ])

    const unreadByCategory = emptyCounts()
    for (const { _id, n } of unreadByType) {
      const category = CATEGORY_OF[_id]
      if (category) unreadByCategory[category] += n
    }

    return {
      unreadCount: unreadByCategory.courses + unreadByCategory.payments + unreadByCategory.account,
      unreadByCategory,
      notifications: rows.map((n) => ({
        id: n._id.toString(),
        type: n.type,
        category: CATEGORY_OF[n.type] ?? "account",
        title: n.title,
        body: n.body,
        href: n.href ?? null,
        read: n.readAt != null,
        createdAt: n.createdAt.toISOString(),
        course: n.course
          ? { id: n.course._id.toString(), title: n.course.title, thumbnailUrl: n.course.thumbnailUrl ?? null }
          : null,
      })),
    }
  } catch (error) {
    console.error("Get notifications error:", error)
    return empty
  }
}

export async function markNotificationRead(notificationId: string) {
  try {
    if (typeof notificationId !== "string" || !OBJECT_ID.test(notificationId)) return { success: false }
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

const CategoryInput = z.enum(NOTIFICATION_CATEGORIES).optional()

/** Mark everything read — or only one category's, when the hub is filtered to it. */
export async function markAllNotificationsRead(category?: NotificationCategory) {
  try {
    const parsed = CategoryInput.safeParse(category)
    if (!parsed.success) return { success: false }
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false }

    await Notification.updateMany(
      {
        user: user.id,
        readAt: null,
        ...(parsed.data ? { type: { $in: typesIn(parsed.data) } } : {}),
      },
      { $set: { readAt: new Date() } }
    )
    return { success: true }
  } catch (error) {
    console.error("Mark all notifications read error:", error)
    return { success: false }
  }
}
