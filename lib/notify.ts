import "server-only"

import { Notification, type NotificationType } from "@/lib/db/models"
import { emitEvent } from "@/lib/call-events"

/**
 * Create an in-app notification and push it live over Ably.
 * Fire-and-forget friendly: never throws — a failed notification must never
 * fail the action that triggered it.
 */
export async function notifyUser(
  userId: string,
  input: {
    type: NotificationType
    title: string
    body: string
    href?: string
    meta?: Record<string, unknown>
  }
): Promise<void> {
  try {
    const notification = await Notification.create({
      user: userId,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href ?? null,
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

/** Notify every ADMIN user (e.g. a new instructor application arrived). */
export async function notifyAdmins(input: {
  type: NotificationType
  title: string
  body: string
  href?: string
  meta?: Record<string, unknown>
}): Promise<void> {
  try {
    const { User } = await import("@/lib/db/models")
    const admins = await User.find({ role: "ADMIN" }).select("_id").lean()
    await Promise.allSettled(admins.map((a) => notifyUser(a._id.toString(), input)))
  } catch (err) {
    console.error("[Notify] failed to notify admins:", err)
  }
}
