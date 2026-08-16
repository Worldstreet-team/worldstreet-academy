"use server"

import mongoose from "mongoose"
import connectDB from "@/lib/db"
import { Bookmark } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth"

/**
 * Idempotent, add-only bookmark. Unlike `toggleCourseBookmark` this NEVER
 * removes an existing bookmark, so it is safe to call fire-and-forget (e.g.
 * when a signed-in visitor clicks through to a course from the landing page).
 *
 * The unique `{ user, course }` index on the Bookmark model makes the upsert
 * a no-op when the row already exists. Signed-out callers and invalid ids
 * resolve to `{ success: false }` — never a thrown error.
 */
export async function addCourseBookmark(
  courseId: string
): Promise<{ success: boolean }> {
  try {
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return { success: false }
    }

    const user = await getCurrentUser()
    if (!user) {
      return { success: false }
    }

    await connectDB()
    await Bookmark.updateOne(
      { user: user.id, course: courseId },
      { $setOnInsert: { user: user.id, course: courseId } },
      { upsert: true }
    )

    return { success: true }
  } catch (error) {
    // Duplicate-key races between concurrent upserts land here too — the
    // bookmark exists either way, and callers treat this as best-effort.
    console.error("Add bookmark error:", error)
    return { success: false }
  }
}
