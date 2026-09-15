import "server-only"

import { Types } from "mongoose"
import { Notification, type NotificationType } from "@/lib/db/models"
import { emitEvent } from "@/lib/call-events"

type NotifyInput = {
  type: NotificationType
  title: string
  body: string
  href?: string
  /**
   * The program this is about. Course-scoped notifications lead the hub and
   * carry the program's title and cover, so pass it whenever one exists.
   */
  courseId?: string | null
  meta?: Record<string, unknown>
}

function courseRef(courseId: string | null | undefined): Types.ObjectId | null {
  return courseId && Types.ObjectId.isValid(courseId) ? new Types.ObjectId(courseId) : null
}

/**
 * Create an in-app notification and push it live over Ably.
 * Fire-and-forget friendly: never throws — a failed notification must never
 * fail the action that triggered it.
 */
export async function notifyUser(userId: string, input: NotifyInput): Promise<void> {
  try {
    const notification = await Notification.create({
      user: userId,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href ?? null,
      course: courseRef(input.courseId),
      meta: input.meta ?? {},
    })

    await emitEvent(userId, {
      type: "notification:new",
      notificationId: notification._id.toString(),
      notifType: input.type,
      title: input.title,
      body: input.body,
      href: input.href,
      createdAt: notification.createdAt.toISOString(),
    })
  } catch (err) {
    console.error("[Notify] failed to create notification:", err)
  }
}

/**
 * One notification to many people — a lesson or assignment published to a
 * course's students. A single insertMany, then a live event per recipient.
 * Never throws.
 */
export async function notifyUsers(userIds: string[], input: NotifyInput): Promise<void> {
  const recipients = [...new Set(userIds)]
  if (recipients.length === 0) return
  try {
    const course = courseRef(input.courseId)
    const docs = await Notification.insertMany(
      recipients.map((user) => ({
        user,
        type: input.type,
        title: input.title,
        body: input.body,
        href: input.href ?? null,
        course,
        meta: input.meta ?? {},
      }))
    )
    await Promise.allSettled(
      docs.map((n) =>
        emitEvent(n.user.toString(), {
          type: "notification:new",
          notificationId: n._id.toString(),
          notifType: input.type,
          title: input.title,
          body: input.body,
          href: input.href,
          createdAt: n.createdAt.toISOString(),
        })
      )
    )
  } catch (err) {
    console.error("[Notify] failed to fan out notification:", err)
  }
}

/** Notify every ADMIN user (e.g. a new instructor application arrived). */
export async function notifyAdmins(input: NotifyInput): Promise<void> {
  try {
    const { User } = await import("@/lib/db/models")
    const admins = await User.find({ role: "ADMIN" }).select("_id").lean()
    await Promise.allSettled(admins.map((a) => notifyUser(a._id.toString(), input)))
  } catch (err) {
    console.error("[Notify] failed to notify admins:", err)
  }
}
