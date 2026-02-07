"use client"

import { useActionState, useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { HugeiconsIcon } from "@hugeicons/react"
import { Image01Icon } from "@hugeicons/core-free-icons"
import type { Course } from "@/lib/types"
import {
  createCourse,
  updateCourse,
  type CourseFormState,
} from "@/lib/actions/instructor"

const initialState: CourseFormState = {
  success: false,
  error: null,
  fieldErrors: {},
}

export function CourseForm({ course }: { course?: Course }) {
  const isEdit = !!course
  const action = isEdit ? updateCourse : createCourse
  const [state, formAction, isPending] = useActionState(action, initialState)

  const [pricing, setPricing] = useState(course?.pricing ?? "free")
  const [thumbnailUrl, setThumbnailUrl] = useState(course?.thumbnailUrl ?? "")
  const [previewError, setPreviewError] = useState(false)

  useEffect(() => {
    setPreviewError(false)
  }, [thumbnailUrl])

  return (
    <form action={formAction} className="space-y-6 max-w-3xl">
      {isEdit && <input type="hidden" name="courseId" value={course.id} />}

      {/* Thumbnail Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Course Thumbnail</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="aspect-video w-full max-w-md rounded-lg border-2 border-dashed border-border bg-muted/30 relative overflow-hidden">
            {thumbnailUrl && !previewError ? (
              <Image
                src={thumbnailUrl}
                alt="Thumbnail preview"
                fill
                className="object-cover rounded-lg"
                sizes="448px"
                onError={() => setPreviewError(true)}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <HugeiconsIcon icon={Image01Icon} size={32} />
                <span className="text-xs">Paste an image URL below</span>
              </div>
            )}
          </div>
          <div className="max-w-md space-y-1.5">
            <Label htmlFor="thumbnailUrl">Image URL</Label>
            <Input
              id="thumbnailUrl"
              name="thumbnailUrl"
              type="url"
              placeholder="https://images.unsplash.com/photo-..."
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Recommended: 800×450px, 16:9 aspect ratio
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Course Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Course Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              placeholder="e.g. Introduction to Cryptocurrency Trading"
              defaultValue={course?.title ?? ""}
              required
            />
            {state.fieldErrors.title && (
              <p className="text-xs text-destructive">{state.fieldErrors.title}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="What will students learn in this course?"
              defaultValue={course?.description ?? ""}
              className="min-h-24"
              required
            />
            {state.fieldErrors.description && (
              <p className="text-xs text-destructive">
                {state.fieldErrors.description}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Level</Label>
              <Select name="level" defaultValue={course?.level ?? "beginner"}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
              {state.fieldErrors.level && (
                <p className="text-xs text-destructive">
                  {state.fieldErrors.level}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select name="status" defaultValue={course?.status ?? "draft"}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">
                    Draft
                  </SelectItem>
                  <SelectItem value="published">
                    Published
                  </SelectItem>
                  <SelectItem value="archived">
                    Archived
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pricing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Pricing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Pricing Model</Label>
            <Select
              name="pricing"
              defaultValue={pricing}
              onValueChange={(val) => setPricing((val ?? "free") as "free" | "paid")}
            >
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">
                  Free
                </SelectItem>
                <SelectItem value="paid">
                  Paid
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {pricing === "paid" && (
            <div className="space-y-1.5 max-w-xs">
              <Label htmlFor="price">Price (USD)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id="price"
                  name="price"
                  type="number"
                  step="0.01"
                  min="0.99"
                  placeholder="49.99"
                  defaultValue={course?.price?.toString() ?? ""}
                  className="pl-7"
                />
              </div>
              {state.fieldErrors.price && (
                <p className="text-xs text-destructive">
                  {state.fieldErrors.price}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">
                Minimum price: $0.99. Platform takes 15% commission.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submit */}
      <Separator />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending
            ? isEdit
              ? "Saving..."
              : "Creating..."
            : isEdit
              ? "Save Changes"
              : "Create Course"}
        </Button>
        {state.error && (
          <Badge variant="destructive" className="text-xs">
            {state.error}
          </Badge>
        )}
      </div>
    </form>
  )
}
