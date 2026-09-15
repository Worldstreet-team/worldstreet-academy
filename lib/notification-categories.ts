import type { NotificationType } from "@/lib/db/models"

/**
 * How the notification hub files things. Course activity — lessons, live
 * classes, assignments, exams, certificates, mentorship — leads; money and
 * account housekeeping sit behind it. Pure and client-safe: the bell, the
 * inbox and `getMyNotifications` all read this one mapping.
 */

export type NotificationCategory = "courses" | "payments" | "account"

export const NOTIFICATION_CATEGORIES = ["courses", "payments", "account"] as const

export const CATEGORY_OF: Record<NotificationType, NotificationCategory> = {
  course: "courses",
  meeting: "courses",
  payment: "payments",
  application: "account",
  system: "account",
}

export const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  courses: "Courses",
  payments: "Payments",
  account: "Account",
}

export function typesIn(category: NotificationCategory): NotificationType[] {
  return (Object.keys(CATEGORY_OF) as NotificationType[]).filter((t) => CATEGORY_OF[t] === category)
}
