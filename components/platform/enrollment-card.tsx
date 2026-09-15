"use client"

import { CourseCard } from "@/components/platform/course-card"
import type { StudentEnrollment } from "@/lib/actions/student"
import { enrollmentHref, enrollmentStatusLabel, isComingSoon, isFinished } from "@/lib/dashboard-home"

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
  return (
    <CourseCard
      href={enrollmentHref(enrollment)}
      title={enrollment.courseTitle}
      thumbnailUrl={enrollment.courseThumbnail}
      progress={enrollment.progress}
      completed={isFinished(enrollment)}
      // A badge requires the package still to exist on the course.
      packageName={enrollment.explicitPackage ? enrollment.packageName : null}
      statusLabel={enrollmentStatusLabel(enrollment, now)}
      comingSoonAt={isComingSoon(enrollment, now) ? enrollment.courseAvailableAt : null}
    />
  )
}
