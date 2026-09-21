"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { StarIcon } from "lucide-react"

/** The learner's own review, as `getUserReview` reads it. */
export type OwnReview = {
  id: string
  rating: number
  title: string | null
  content: string | null
}

type CourseRatingProps = {
  courseId: string
  courseTitle: string
  currentRating?: number
  ratingCount?: number
  review?: OwnReview | null
  /** A row inside the lesson player's instructor box; otherwise a card (the completion page). */
  inline?: boolean
}

const ratingLabels: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Great",
  5: "Excellent",
}

// The same limits `submitReview` validates against.
const TITLE_MIN = 3
const TITLE_MAX = 100
const CONTENT_MIN = 10
const CONTENT_MAX = 2000

/**
 * Rate and review a program. Picking a star opens the review dialog with that
 * rating chosen; the headline and text are optional, so a learner can leave
 * just stars. Written reviews are what the public program page lists (under
 * the reviewer's first name and last initial); stars alone only count towards
 * the average.
 */
export function CourseRating({
  courseId,
  courseTitle,
  currentRating,
  ratingCount,
  review,
  inline,
}: CourseRatingProps) {
  const user = useUser()
  const router = useRouter()
  const [saved, setSaved] = useState<OwnReview | null>(review ?? null)
  const [hovered, setHovered] = useState(0)
  const [open, setOpen] = useState(false)
  const [draftRating, setDraftRating] = useState(0)
  const [draftHover, setDraftHover] = useState(0)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const written = !!(saved?.title || saved?.content)

  const openDialog = (star?: number) => {
    setDraftRating(star ?? saved?.rating ?? 0)
    setTitle(saved?.title ?? "")
    setContent(saved?.content ?? "")
    setError(null)
    setOpen(true)
  }

  const submit = () => {
    const t = title.trim()
    const c = content.trim()
    if (draftRating < 1) return setError("Choose a star rating.")
    if (t && t.length < TITLE_MIN) return setError(`Make the headline at least ${TITLE_MIN} characters, or leave it empty.`)
    if (c && c.length < CONTENT_MIN) return setError(`Write at least ${CONTENT_MIN} characters, or leave the review empty.`)
    setError(null)

    startTransition(async () => {
      try {
        let id = saved?.id ?? null
        if (saved) {
          const result = await updateReview(user.id, saved.id, { rating: draftRating, title: t || null, content: c || null })
          if (!result.success) return setError(result.error ?? "Couldn't save your review. Try again.")
        } else {
          const result = await submitReview(user.id, courseId, {
            rating: draftRating,
            title: t || undefined,
            content: c || undefined,
          })
          if (!result.success || !result.data) return setError(result.error ?? "Couldn't post your review. Try again.")
          id = result.data.reviewId
        }
        setSaved({ id: id!, rating: draftRating, title: t || null, content: c || null })
        setOpen(false)
        // The average beside the stars is the server's; refresh it.
        router.refresh()
      } catch {
        setError("Something went wrong. Please try again.")
      }
    })
  }

  const shownDraft = draftHover || draftRating

  const dialog = (
    <Dialog open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{saved ? "Edit your review" : "Review this program"}</DialogTitle>
          <DialogDescription>{courseTitle}</DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <div className="flex flex-col items-center gap-1.5 py-1">
            <div role="radiogroup" aria-label="Your rating" className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  role="radio"
                  aria-checked={draftRating === star}
                  aria-label={`${star} out of 5 — ${ratingLabels[star]}`}
                  onMouseEnter={() => setDraftHover(star)}
                  onMouseLeave={() => setDraftHover(0)}
                  onClick={() => setDraftRating(star)}
                  className="rounded-sm p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
                >
                  <StarIcon
                    size={28}
                    className={cn("transition-colors", star <= shownDraft ? "text-ws-rating" : "text-muted-foreground/25")}
                    fill={star <= shownDraft ? "currentColor" : "none"}
                  />
                </button>
              ))}
            </div>
            <p className="h-4 text-xs font-medium text-ws-muted" aria-live="polite">
              {shownDraft > 0 ? ratingLabels[shownDraft] : "Tap a star"}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`review-title-${courseId}`}>
              Headline <span className="font-normal text-ws-muted">(optional)</span>
            </Label>
            <Input
              id={`review-title-${courseId}`}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                setError(null)
              }}
              maxLength={TITLE_MAX}
              placeholder="Sum it up in a few words"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`review-content-${courseId}`}>
              Your review <span className="font-normal text-ws-muted">(optional)</span>
            </Label>
            <Textarea
              id={`review-content-${courseId}`}
              value={content}
              onChange={(e) => {
                setContent(e.target.value)
                setError(null)
              }}
              maxLength={CONTENT_MAX}
              placeholder="What did you learn? Who would you recommend it to?"
              className="min-h-28"
            />
            <div className="flex items-start justify-between gap-3 text-[11px] text-ws-muted">
              <span>Shown on the program page with your first name and last initial.</span>
              <span className="shrink-0 tabular-nums">
                {content.length}/{CONTENT_MAX}
              </span>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-xs text-ws-danger">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending || draftRating < 1}>
              {isPending ? "Saving…" : saved ? "Save changes" : "Post review"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )

  const shown = hovered || saved?.rating || 0
  const stars = (size: number) => (
    <div className="flex items-center gap-0.5" onMouseLeave={() => setHovered(0)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          aria-label={`Rate ${star} out of 5 — ${ratingLabels[star]}`}
          onMouseEnter={() => setHovered(star)}
          onClick={() => openDialog(star)}
          className="rounded-sm p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
        >
          <StarIcon
            size={size}
            className={cn("transition-colors", star <= shown ? "text-ws-rating" : "text-muted-foreground/30")}
            fill={star <= shown ? "currentColor" : "none"}
          />
        </button>
      ))}
    </div>
  )

  const reviewLink = saved && (
    <button
      type="button"
      onClick={() => openDialog()}
      className="rounded-sm text-xs font-medium text-ws-primary underline decoration-ws-hairline underline-offset-4 hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
    >
      {written ? "Edit review" : "Write a review"}
    </button>
  )

  if (inline) {
    return (
      <>
        {dialog}
        <div className="flex items-center justify-between gap-3">
          {saved ? (
            <p className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
              <span className="tabular-nums">You rated {saved.rating}/5</span>
              <span aria-hidden>·</span>
              {reviewLink}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Rate this program</p>
          )}
          {stars(16)}
        </div>
      </>
    )
  }

  return (
    <>
      {dialog}
      <div className="space-y-3 rounded-[20px] border border-ws-hairline bg-ws-surface p-5 text-center dark:border-transparent">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-ws-primary">
            {written ? "Thanks for your review" : saved ? "Add a few words to your rating" : "How was this program?"}
          </p>
          <p className="text-xs text-ws-muted">
            {written
              ? "It helps the next learner decide. You can edit it any time."
              : "A written review helps the next learner decide."}
          </p>
        </div>
        <div className="flex justify-center">{stars(24)}</div>
        <p className="h-4 text-xs font-medium text-ws-muted">
          {hovered > 0 ? ratingLabels[hovered] : saved ? `You rated ${saved.rating}/5 — ${ratingLabels[saved.rating]}` : ""}
        </p>
        {saved && (
          <Button type="button" variant="outline" size="sm" onClick={() => openDialog()}>
            {written ? "Edit review" : "Write a review"}
          </Button>
        )}
        {currentRating != null && (ratingCount ?? 0) > 0 && (
          <p className="text-[11px] tabular-nums text-ws-muted">
            Program average: {currentRating.toFixed(1)} / 5 · {ratingCount} {ratingCount === 1 ? "rating" : "ratings"}
          </p>
        )}
      </div>
    </>
  )
}
