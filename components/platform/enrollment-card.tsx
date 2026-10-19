"use client"

import { CourseCard } from "@/components/platform/course-card"
import type { StudentEnrollment } from "@/lib/actions/student"
import { FORMAT_LABEL } from "@/lib/course-format"
import { enrollmentHref, enrollmentStatusLabel, isComingSoon, isFileProductEnrollment, isFinished } from "@/lib/dashboard-home"

/**
 * A CourseCard for one of the student's enrollments: package chip, status chip
 * and the right destination (player vs course page). Dashboard + My programs.
 */
export function EnrollmentCard({ enrollment }: { enrollment: StudentEnrollment }) {
  // Current time is read once per render to decide the card's face (status
  // chip vs "Not live yet"); a stale value only self-corrects on the next
  // render — the same tolerance `isComingSoon`'s other callers already take.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  const fileFormat = isFileProductEnrollment(enrollment) ? enrollment.format : null
  return (
    <CourseCard
      href={enrollmentHref(enrollment)}
      title={enrollment.courseTitle}
      thumbnailUrl={enrollment.courseThumbnail}
      progress={fileFormat ? undefined : enrollment.progress}
      completed={!fileFormat && isFinished(enrollment)}
      // A badge requires the package still to exist on the course.
      packageName={fileFormat ? FORMAT_LABEL[fileFormat] : enrollment.explicitPackage ? enrollment.packageName : null}
      cohortName={enrollment.cohortName}
      statusLabel={enrollmentStatusLabel(enrollment, now)}
      priceLabel={fileFormat ? "Ready to download" : undefined}
      comingSoonAt={isComingSoon(enrollment, now) ? enrollment.courseAvailableAt : null}
    />
  )
}
