import { notFound, permanentRedirect } from "next/navigation"
import { fetchProgramSlug } from "@/lib/actions/student"

// The slug lookup must see the current published state.
export const revalidate = 0

/**
 * `/courses/[id]` moved to `/programs/[slug]` (Phase 2). Old links, the
 * `revalidatePath` calls in enrollments/reviews and any bookmark keep
 * resolving; unknown or unpublished ids 404 as before.
 */
export default async function CourseRedirect({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params
  const slug = await fetchProgramSlug(courseId)
  if (!slug) notFound()
  return permanentRedirect(`/programs/${slug}`)
}
