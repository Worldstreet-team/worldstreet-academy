"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { StarIcon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

type CourseRatingProps = {
  courseId: string
  currentRating?: number
}

export function CourseRating({ courseId, currentRating }: CourseRatingProps) {
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (star: number) => {
    setRating(star)
    setSubmitted(true)
    // TODO: persist rating via server action
  }

  if (submitted) {
    return (
      <div className="rounded-xl border bg-muted/30 p-4 text-center space-y-1.5">
        <div className="flex items-center justify-center gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <HugeiconsIcon
              key={star}
              icon={StarIcon}
              size={18}
              className={star <= rating ? "text-orange-500" : "text-muted-foreground/30"}
              fill={star <= rating ? "currentColor" : "none"}
            />
          ))}
        </div>
        <p className="text-xs font-medium text-foreground">
          Thanks for rating!
        </p>
        <p className="text-[11px] text-muted-foreground">
          You gave this course {rating} star{rating !== 1 ? "s" : ""}
        </p>
      </div>
    )
  }

  return (
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
            onClick={() => handleSubmit(star)}
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
      {currentRating && (
        <p className="text-[10px] text-muted-foreground text-center">
          Course average: {currentRating} / 5
        </p>
      )}
    </div>
  )
}
