import { permanentRedirect } from "next/navigation"

/** `/courses` moved to `/programs` (Phase 2). Kept as a route so old links and bookmarks land. */
export default function CoursesRedirect() {
  return permanentRedirect("/programs")
}
