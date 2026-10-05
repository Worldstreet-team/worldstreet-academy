import { CourseEditor } from "@/components/instructor/course-editor"
import { MARKETPLACE_SHARE_ACADEMY, MARKETPLACE_SHARE_OWN_LINK } from "@/lib/db/models"
import { sellerSplitNote } from "@/lib/marketplace"

export default function NewCoursePage() {
  return <CourseEditor splitNote={sellerSplitNote(MARKETPLACE_SHARE_OWN_LINK, MARKETPLACE_SHARE_ACADEMY)} />
}
