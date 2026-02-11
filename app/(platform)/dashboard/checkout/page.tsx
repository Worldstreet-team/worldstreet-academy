"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  BookOpen01Icon,
  Clock01Icon,
  UserMultipleIcon,
  Loading03Icon,
  CheckmarkCircle01Icon,
  ArrowLeft01Icon,
  SecurityCheckIcon,
} from "@hugeicons/core-free-icons"
import { Topbar } from "@/components/platform/topbar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useUser } from "@/components/providers/user-provider"
import { enrollInCourse, checkEnrollment } from "@/lib/actions/enrollments"
import { fetchPublicCourse, type PublicCourse } from "@/lib/actions/student"

export default function CheckoutPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const user = useUser()

  const courseId = searchParams.get("courseId")
  const [course, setCourse] = useState<PublicCourse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!courseId) {
      setIsLoading(false)
      return
    }
    fetchPublicCourse(courseId).then((c) => {
      setCourse(c)
      setIsLoading(false)
    })
  }, [courseId])

  async function handlePurchase() {
    if (!course || !user) return
    setIsProcessing(true)
    setError(null)

    // Check if already enrolled
    const check = await checkEnrollment(user.id, course.id)
    if (check.isEnrolled) {
      router.push(`/dashboard/checkout/success?courseId=${course.id}`)
      return
    }

    const price = course.pricing === "free" ? 0 : (course.price ?? 0)
    const result = await enrollInCourse(user.id, course.id, price)

    if (result.success) {
      router.push(`/dashboard/checkout/success?courseId=${course.id}`)
    } else {
      setError(result.error || "Something went wrong")
      setIsProcessing(false)
    }
  }

  if (isLoading) {
    return (
      <>
        <Topbar title="Checkout" />
        <div className="flex-1 flex items-center justify-center">
          <HugeiconsIcon icon={Loading03Icon} size={24} className="animate-spin text-muted-foreground" />
        </div>
      </>
    )
  }

  if (!course || !courseId) {
    return (
      <>
        <Topbar title="Checkout" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">Course not found</p>
            <Button variant="outline" onClick={() => router.back()}>
              Go Back
            </Button>
          </div>
        </div>
      </>
    )
  }

  const price = course.pricing === "free" ? 0 : (course.price ?? 0)
  const totalHours = Math.floor(course.totalDuration / 60)
  const totalMins = course.totalDuration % 60
  const durationLabel = totalHours > 0 ? `${totalHours}h ${totalMins}m` : `${totalMins}m`

  return (
    <>
      <Topbar title="Checkout" />
      <div className="flex-1 overflow-y-auto pb-24 md:pb-8">
        <div className="max-w-lg mx-auto px-4 md:px-6 py-8 space-y-6">
          {/* Back */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={14} />
            Back to course
          </button>

          {/* Course Summary Card */}
          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
            {/* Thumbnail */}
            <div className="relative aspect-[21/9] bg-muted">
              {course.thumbnailUrl ? (
                <Image
                  src={course.thumbnailUrl}
                  alt={course.title}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <HugeiconsIcon icon={BookOpen01Icon} size={32} className="text-muted-foreground/30" />
                </div>
              )}
            </div>

            <div className="p-4 space-y-3">
              <div>
                <h1 className="text-base font-semibold">{course.title}</h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  by {course.instructorName}
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <HugeiconsIcon icon={BookOpen01Icon} size={12} />
                  {course.totalLessons} lessons
                </span>
                <span className="flex items-center gap-1">
                  <HugeiconsIcon icon={Clock01Icon} size={12} />
                  {durationLabel}
                </span>
                <span className="flex items-center gap-1">
                  <HugeiconsIcon icon={UserMultipleIcon} size={12} />
                  {course.enrolledCount.toLocaleString()} students
                </span>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-4">
            <h2 className="text-sm font-semibold">Order Summary</h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Course price</span>
                <span className="font-medium">
                  {price === 0 ? "Free" : `$${price.toFixed(2)}`}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">Total</span>
                <span className="text-lg font-bold">
                  ${price.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Secure checkout note */}
          <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground/60">
            <HugeiconsIcon icon={SecurityCheckIcon} size={13} />
            <span>Secure checkout</span>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          {/* CTA */}
          <Button
            onClick={handlePurchase}
            disabled={isProcessing}
            className="w-full h-12 text-sm font-semibold gap-2"
            size="lg"
          >
            {isProcessing ? (
              <>
                <HugeiconsIcon icon={Loading03Icon} size={16} className="animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <HugeiconsIcon icon={CheckmarkCircle01Icon} size={16} />
                {price === 0 ? "Enroll for Free" : `Pay $${price.toFixed(2)}`}
              </>
            )}
          </Button>
        </div>
      </div>
    </>
  )
}
