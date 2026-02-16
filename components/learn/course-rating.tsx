"use client"

import { useState, useTransition } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { StarIcon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { submitReview, updateReview } from "@/lib/actions/reviews"
import { useUser } from "@/components/providers/user-provider"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

type CourseRatingProps = {
  courseId: string
  currentRating?: number
  ratingCount?: number
  userRating?: number
  userReviewId?: string
  inline?: boolean
}

const ratingLabels: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Great",
  5: "Excellent",
}

export function CourseRating({
  courseId,
  currentRating,
  ratingCount,
  userRating: initialUserRating,
  userReviewId,
  inline,
}: CourseRatingProps) {
  const user = useUser()
  const [rating, setRating] = useState(initialUserRating ?? 0)
  const [hovered, setHovered] = useState(0)
  const [submitted, setSubmitted] = useState(!!initialUserRating)
  const [pendingStar, setPendingStar] = useState(0)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleStarClick = (star: number) => {
    setPendingStar(star)
    setShowConfirm(true)
    setError(null)
  }

  const confirmRating = () => {
    startTransition(async () => {
      try {
        let result
        if (submitted && userReviewId) {
          // Update existing review
          result = await updateReview(user.id, userReviewId, { rating: pendingStar })
        } else {
          // Submit new review
          result = await submitReview(user.id, courseId, { rating: pendingStar })
        }

        if (result.success) {
          setRating(pendingStar)
          setSubmitted(true)
          setShowConfirm(false)
        } else {
          setError(result.error ?? "Failed to submit rating")
        }
      } catch {
        setError("Something went wrong. Please try again.")
      }
    })
  }

  const confirmDialog = (
    <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {submitted ? "Update your rating?" : "Confirm your rating"}
          </DialogTitle>
          <DialogDescription>
            You&apos;re giving this course{" "}
            <span className="font-semibold text-foreground">{pendingStar} out of 5</span> stars
            ({ratingLabels[pendingStar]}).
            {submitted && " This will replace your previous rating."}
          </DialogDescription>
        </DialogHeader>

        {/* Star preview */}
        <div className="flex items-center justify-center gap-1 py-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <HugeiconsIcon
              key={star}
              icon={StarIcon}
              size={28}
              className={star <= pendingStar ? "text-orange-500" : "text-muted-foreground/20"}
              fill={star <= pendingStar ? "currentColor" : "none"}
            />
          ))}
        </div>

        {error && (
          <p className="text-xs text-red-500 text-center">{error}</p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConfirm(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={confirmRating}
            disabled={isPending}
          >
            {isPending ? "Submitting..." : submitted ? "Update Rating" : "Submit Rating"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  if (submitted) {
    return (
      <>
        {confirmDialog}
        <div className={cn(
          inline ? "flex items-center justify-between" : "rounded-xl border bg-muted/30 p-4 text-center space-y-1.5"
        )}>
          <div className={cn("flex items-center gap-0.5", !inline && "justify-center")}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => handleStarClick(star)}
                className="p-0.5 transition-transform hover:scale-110"
              >
                <HugeiconsIcon
                  icon={StarIcon}
                  size={inline ? 16 : 18}
                  className={star <= rating ? "text-orange-500" : "text-muted-foreground/30"}
                  fill={star <= rating ? "currentColor" : "none"}
                />
              </button>
            ))}
          </div>
          <p className={cn("text-xs text-muted-foreground", !inline && "font-medium text-foreground")}>
            {inline ? `You rated ${rating}/5` : `You rated ${rating}/5 — ${ratingLabels[rating]}`}
          </p>
          {!inline && currentRating != null && (
            <p className="text-[10px] text-muted-foreground">
              Course average: {currentRating.toFixed(1)} / 5 ({ratingCount ?? 0} {(ratingCount ?? 0) === 1 ? "rating" : "ratings"})
            </p>
          )}
        </div>
      </>
    )
  }

  if (inline) {
    return (
      <>
        {confirmDialog}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Rate this course</p>
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onMouseEnter={() => setHovered(star)}
                onMouseLeave={() => setHovered(0)}
                onClick={() => handleStarClick(star)}
                className="p-0.5 transition-transform hover:scale-110"
              >
                <HugeiconsIcon
                  icon={StarIcon}
                  size={16}
                  className={cn(
                    "transition-colors",
                    star <= (hovered || rating)
                      ? "text-orange-500"
                      : "text-muted-foreground/30"
                  )}
                  fill={star <= (hovered || rating) ? "currentColor" : "none"}
                />
              </button>
            ))}
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      {confirmDialog}
      <div className="rounded-xl border bg-muted/30 p-4 space-y-2.5">
        <div className="text-center space-y-0.5">
          <p className="text-sm font-semibold">Rate this course</p>
          <p className="text-[11px] text-muted-foreground">
            How would you rate your learning experience?
          </p>
        </div>
        <div className="flex items-center justify-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => handleStarClick(star)}
              className="p-1 transition-transform hover:scale-110"
            >
              <HugeiconsIcon
                icon={StarIcon}
                size={24}
                className={cn(
                  "transition-colors",
                  star <= (hovered || rating)
                    ? "text-orange-500"
                    : "text-muted-foreground/30"
                )}
                fill={star <= (hovered || rating) ? "currentColor" : "none"}
              />
            </button>
          ))}
        </div>
        {hovered > 0 && (
          <p className="text-xs text-muted-foreground text-center font-medium">
            {ratingLabels[hovered]}
          </p>
        )}
        {currentRating != null && (
          <p className="text-[10px] text-muted-foreground text-center">
            Course average: {currentRating.toFixed(1)} / 5 ({ratingCount ?? 0} {(ratingCount ?? 0) === 1 ? "rating" : "ratings"})
          </p>
        )}
      </div>
    </>
  )
}
