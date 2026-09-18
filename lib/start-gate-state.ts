import { cache } from "react"
import connectDB from "@/lib/db"
import { Enrollment, EnrollmentIntent } from "@/lib/db/models"

/**
 * The two facts the school-first gate needs, for RSC layouts. Request-deduped
 * like getCachedUser. Callers must treat a throw as "do not gate".
 */
export const getStartGateState = cache(async (userId: string) => {
  await connectDB()
  const [enrollment, intent] = await Promise.all([
    Enrollment.exists({ user: userId }),
    EnrollmentIntent.exists({ user: userId }),
  ])
  return { hasEnrollment: Boolean(enrollment), hasIntent: Boolean(intent) }
})
