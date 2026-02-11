"use client"

import { useActionState, useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { MediaUpload } from "@/components/ui/media-upload"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SectionDivider } from "@/components/instructor/section-divider"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  ArrowDown01Icon,
  Add01Icon,
  Delete01Icon,
  Video01Icon,
  ViewIcon,
  Tick02Icon,
  Edit01Icon,
  File01Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/theme-toggle"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import type { Lesson, CourseLevel, CoursePricing, CourseStatus, CourseCategory } from "@/lib/types"

// Minimal course data for editing
type EditableCourse = {
  id: string
  title: string
  description: string
  thumbnailUrl: string | null
  level: CourseLevel
  pricing: CoursePricing
  price: number | null
  status: CourseStatus
  category?: CourseCategory
}

/* ─── Duration helpers (stored in seconds) ─── */

/** Format seconds as HH:MM:SS for the editor duration field */
function formatDurationTimecode(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return "00:00"
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, "0")
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`
  return `${pad(m)}:${pad(s)}`
}

/** Human-readable summary: "23s", "3m", "1hr 10min", "4hrs 10min" */
function formatDurationHuman(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return "0s"
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h === 0 && m === 0) return `${s}s`
  if (h === 0) return s > 0 ? `${m}m ${s}s` : `${m}m`
  if (m === 0) return h === 1 ? "1hr" : `${h}hrs`
  return h === 1 ? `1hr ${m}min` : `${h}hrs ${m}min`
}
import {
  createCourse,
  updateCourse,
  type CourseFormState,
} from "@/lib/actions/instructor"
import { getImageUploadUrl, getVideoUploadUrl } from "@/lib/actions/upload"

/* ─── Local Lesson Type (client-side, not yet persisted) ─── */
type EditorLesson = {
  tempId: string
  title: string
  description: string
  type: "video" | "text"
  thumbnailUrl: string
  videoUrl: string
  content: string
  duration: string
  autoDuration: boolean
  isFree: boolean
}

const typeIcons = {
  video: Video01Icon,
  text: File01Icon,
}

const initialFormState: CourseFormState = {
  success: false,
  error: null,
  fieldErrors: {},
}

function emptyLesson(): EditorLesson {
  return {
    tempId: crypto.randomUUID(),
    title: "",
    description: "",
    type: "video",
    thumbnailUrl: "",
    videoUrl: "",
    content: "",
    duration: "",
    autoDuration: true,
    isFree: false,
  }
}

/* ─── Main Course Editor ─── */
export function CourseEditor({
  course,
  existingLessons = [],
}: {
  course?: EditableCourse
  existingLessons?: Lesson[]
}) {
  const isEdit = !!course
  const action = isEdit ? updateCourse : createCourse
  const [state, formAction, isPending] = useActionState(action, initialFormState)

  /* Course fields */
  const [title, setTitle] = useState(course?.title ?? "")
  const [description, setDescription] = useState(course?.description ?? "")
  const [thumbnailUrl, setThumbnailUrl] = useState(course?.thumbnailUrl ?? "")
  const [level, setLevel] = useState(course?.level ?? "beginner")
  const [category, setCategory] = useState(course?.category ?? "Cryptocurrency")
  const [pricing, setPricing] = useState(course?.pricing ?? "free")
  const [price, setPrice] = useState(course?.price?.toString() ?? "")
  const [status, setStatus] = useState(course?.status ?? "draft")
  const [previewError, setPreviewError] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => setPreviewError(false), [thumbnailUrl])

  /* Get presigned URL for course thumbnail upload */
  async function getCourseThumbnailPresignedUrl(file: File) {
    setUploadError(null)
    const result = await getImageUploadUrl(file.name, file.type)
    if (!result.success) {
      setUploadError(result.error || "Failed to prepare upload")
    }
    return result
  }

  /* Get presigned URL for lesson thumbnail upload */
  async function getLessonThumbnailPresignedUrl(file: File) {
    return await getImageUploadUrl(file.name, file.type)
  }

  /* Get presigned URL for lesson video upload */
  async function getLessonVideoPresignedUrl(file: File) {
    return await getVideoUploadUrl(file.name, file.type)
  }

  /* Lessons */
  const [lessons, setLessons] = useState<EditorLesson[]>(
    existingLessons.map((l) => ({
      tempId: l.id,
      title: l.title,
      description: l.description ?? "",
      type: l.type === "live" ? "video" : l.type,
      thumbnailUrl: l.thumbnailUrl ?? "",
      videoUrl: l.videoUrl ?? "",
      content: l.content ?? "",
      duration: l.duration ? l.duration.toString() : "",
      autoDuration: true,
      isFree: l.isFree,
    }))
  )
  const [expandedLesson, setExpandedLesson] = useState<string | null>(null)

  function addNewLesson() {
    const lesson = emptyLesson()
    setLessons((prev) => [...prev, lesson])
    setExpandedLesson(lesson.tempId)
  }

  function updateLesson(tempId: string, updates: Partial<EditorLesson>) {
    setLessons((prev) =>
      prev.map((l) => (l.tempId === tempId ? { ...l, ...updates } : l))
    )
  }

  function removeLesson(tempId: string) {
    setLessons((prev) => prev.filter((l) => l.tempId !== tempId))
    if (expandedLesson === tempId) setExpandedLesson(null)
  }

  /* ─── Render ─── */
  return (
    <div className="flex h-[calc(100svh-1px)] flex-col">
      {/* ─── Top Bar ─── */}
      <header className="flex h-14 items-center justify-between border-b px-5 shrink-0 bg-background z-10">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/instructor/courses" />}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
            Courses
          </Button>
          <Separator orientation="vertical" className="!h-4" />
          <span className="text-sm font-semibold">
            {isEdit ? "Edit Course" : "Create New Course"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Badge variant="secondary" className="text-[10px] capitalize">
            {status}
          </Badge>
          <form action={formAction} data-editor-form>
            {isEdit && (
              <input type="hidden" name="courseId" value={course.id} />
            )}
            <input type="hidden" name="title" value={title} />
            <input type="hidden" name="description" value={description} />
            <input type="hidden" name="thumbnailUrl" value={thumbnailUrl} />
            <input type="hidden" name="level" value={level} />
            <input type="hidden" name="pricing" value={pricing} />
            <input type="hidden" name="price" value={price} />
            <input type="hidden" name="status" value={status} />
            <input
              type="hidden"
              name="lessons"
              value={JSON.stringify(lessons)}
            />

            <DropdownMenu>
              <DropdownMenuTrigger
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isPending ? "Saving…" : "Save"}
                <HugeiconsIcon icon={ArrowDown01Icon} size={14} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={4}>
                <DropdownMenuItem
                  className="text-sm gap-2"
                  onClick={() => {
                    setStatus("draft")
                    requestAnimationFrame(() => {
                      const form = document.querySelector<HTMLFormElement>(
                        "[data-editor-form]"
                      )
                      form?.requestSubmit()
                    })
                  }}
                >
                  <HugeiconsIcon icon={Edit01Icon} size={14} />
                  Save as Draft
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-sm gap-2"
                  onClick={() => {
                    setStatus("published")
                    requestAnimationFrame(() => {
                      const form = document.querySelector<HTMLFormElement>(
                        "[data-editor-form]"
                      )
                      form?.requestSubmit()
                    })
                  }}
                >
                  <HugeiconsIcon icon={Tick02Icon} size={14} />
                  Save &amp; Publish
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </form>
        </div>
      </header>

      {/* ─── Error banner ─── */}
      {(state.error || Object.keys(state.fieldErrors).length > 0) && (
        <div className="bg-destructive/10 border-b border-destructive/20 px-5 py-2 text-xs text-destructive">
          {state.error ??
            Object.values(state.fieldErrors).join(" · ")}
        </div>
      )}

      {/* ─── 3-Column Layout ─── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_1fr_340px] overflow-hidden">
        {/* ───────── LEFT: Course Details ───────── */}
        <div className="overflow-auto border-r p-5 space-y-4">
          <SectionDivider label="Basic Information" />

          <div className="space-y-1.5">
            <Label htmlFor="ed-title">Course Title</Label>
            <Input
              id="ed-title"
              placeholder="e.g. Introduction to Cryptocurrency Trading"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ed-desc">Description</Label>
            <Textarea
              id="ed-desc"
              placeholder="What will students learn?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-24"
            />
          </div>

          <SectionDivider label="Thumbnail" />

          <MediaUpload
            type="image"
            value={thumbnailUrl}
            onChange={(url) => setThumbnailUrl(url)}
            onRemove={() => setThumbnailUrl("")}
            onGetPresignedUrl={getCourseThumbnailPresignedUrl}
          />
          {uploadError && (
            <p className="text-sm text-destructive">{uploadError}</p>
          )}

          <SectionDivider label="Level & Status" />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Level</Label>
              <Select
                defaultValue={level}
                onValueChange={(v) => setLevel((v ?? "beginner") as typeof level)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                defaultValue={status}
                onValueChange={(v) =>
                  setStatus((v ?? "draft") as typeof status)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <SectionDivider label="Pricing" />

          <div className="space-y-3">
            <Select
              defaultValue={pricing}
              onValueChange={(v) =>
                setPricing((v ?? "free") as "free" | "paid")
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>

            {pricing === "paid" && (
              <div className="space-y-1.5">
                <Label htmlFor="ed-price">Price (USD)</Label>
                <div className="relative max-w-[180px]">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="ed-price"
                    type="number"
                    step="0.01"
                    min="0.99"
                    placeholder="49.99"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="pl-7"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Platform takes 15% commission
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ───────── CENTER: Curriculum ───────── */}
        <div className="overflow-auto border-r p-5 space-y-3">
          <SectionDivider label="Curriculum" />

          {lessons.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-border p-8 text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                No lessons yet. Start building your curriculum.
              </p>
            </div>
          ) : (
            /* ── Simple lesson list ── */
            <div className="space-y-2">
              {lessons.map((lesson, i) => {
                const isExpanded = expandedLesson === lesson.tempId
                const dur = parseInt(lesson.duration) || 0

                return (
                  <div key={lesson.tempId}>
                    {/* ── Collapsible lesson card ── */}
                    <Collapsible
                      open={isExpanded}
                      onOpenChange={(open) =>
                        setExpandedLesson(open ? lesson.tempId : null)
                      }
                    >
                      {/* Trigger header */}
                      <CollapsibleTrigger
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-colors cursor-pointer hover:bg-muted/30",
                          isExpanded && "rounded-b-none border-b-0 bg-muted/10"
                        )}
                      >
                        <span className="text-[11px] font-mono font-semibold text-muted-foreground w-5 text-center shrink-0">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {lesson.title || "Untitled Lesson"}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <HugeiconsIcon
                              icon={typeIcons[lesson.type]}
                              size={12}
                              className="text-muted-foreground"
                            />
                            <span className="text-[11px] text-muted-foreground capitalize">
                              {lesson.type}
                            </span>
                            {dur > 0 && (
                              <>
                                <span className="text-[11px] text-muted-foreground">
                                  ·
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                  {formatDurationTimecode(dur)}
                                </span>
                              </>
                            )}
                            {lesson.isFree && (
                              <Badge
                                variant="outline"
                                className="text-[9px] px-1 py-0 ml-1"
                              >
                                Free
                              </Badge>
                            )}
                          </div>
                        </div>
                        <HugeiconsIcon
                          icon={ArrowDown01Icon}
                          size={16}
                          className={cn(
                            "text-muted-foreground transition-transform duration-200 shrink-0",
                            isExpanded && "rotate-180"
                          )}
                        />
                      </CollapsibleTrigger>

                      {/* Expanded form */}
                      <CollapsibleContent>
                        <div className="border-x border-b rounded-b-lg bg-muted/10 p-3 space-y-3">
                          {/* Title */}
                          <div className="space-y-1.5">
                            <Label>Title</Label>
                            <Input
                              placeholder="Lesson title"
                              value={lesson.title}
                              onChange={(e) =>
                                updateLesson(lesson.tempId, {
                                  title: e.target.value,
                                })
                              }
                            />
                          </div>

                          {/* Description */}
                          <div className="space-y-1.5">
                            <Label>Description</Label>
                            <Textarea
                              placeholder="Brief overview of this lesson"
                              className="min-h-14"
                              value={lesson.description}
                              onChange={(e) =>
                                updateLesson(lesson.tempId, {
                                  description: e.target.value,
                                })
                              }
                            />
                          </div>

                          {/* Type + Duration */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label>Type</Label>
                              <Select
                                value={lesson.type}
                                onValueChange={(v) =>
                                  updateLesson(lesson.tempId, {
                                    type: (v ?? "video") as EditorLesson["type"],
                                  })
                                }
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="video">Video</SelectItem>
                                  <SelectItem value="text">Text</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <Label>
                                Duration
                                {dur > 0 && (
                                  <span className="text-muted-foreground font-normal ml-1">
                                    — {formatDurationTimecode(dur)}
                                  </span>
                                )}
                              </Label>
                              <Input
                                type="number"
                                min="1"
                                placeholder="Seconds"
                                value={lesson.duration}
                                onChange={(e) =>
                                  updateLesson(lesson.tempId, {
                                    duration: e.target.value,
                                  })
                                }
                                disabled={lesson.autoDuration}
                              />
                              {/* Auto-detect from video checkbox */}
                              {lesson.type === "video" && (
                                <label className="flex items-center gap-2 cursor-pointer mt-1">
                                  <Checkbox
                                    checked={lesson.autoDuration}
                                    onCheckedChange={(checked) =>
                                      updateLesson(lesson.tempId, {
                                        autoDuration: !!checked,
                                      })
                                    }
                                  />
                                  <span className="text-[11px] text-muted-foreground">
                                    Auto-detect from video
                                  </span>
                                </label>
                              )}
                            </div>
                          </div>

                          {/* Lesson Thumbnail */}
                          <MediaUpload
                            type="image"
                            label="Lesson Thumbnail"
                            value={lesson.thumbnailUrl}
                            onChange={(url) =>
                              updateLesson(lesson.tempId, {
                                thumbnailUrl: url,
                              })
                            }
                            onRemove={() =>
                              updateLesson(lesson.tempId, {
                                thumbnailUrl: "",
                              })
                            }
                            onGetPresignedUrl={getLessonThumbnailPresignedUrl}
                            compact
                          />

                          {/* Video Upload */}
                          {lesson.type === "video" && (
                            <MediaUpload
                              type="video"
                              label="Video File"
                              value={lesson.videoUrl}
                              onChange={(url) =>
                                updateLesson(lesson.tempId, {
                                  videoUrl: url,
                                })
                              }
                              onRemove={() =>
                                updateLesson(lesson.tempId, { videoUrl: "" })
                              }
                              onGetPresignedUrl={getLessonVideoPresignedUrl}
                              onDurationDetected={(seconds) => {
                                if (lesson.autoDuration) {
                                  updateLesson(lesson.tempId, {
                                    duration: seconds.toString(),
                                  })
                                }
                              }}
                              compact
                            />
                          )}

                          {/* Text Content Editor */}
                          {lesson.type === "text" && (
                            <div className="space-y-1.5">
                              <Label>Lesson Content</Label>
                              <RichTextEditor
                                value={lesson.content}
                                onChange={(html) =>
                                  updateLesson(lesson.tempId, {
                                    content: html,
                                  })
                                }
                                placeholder="Write your lesson content here..."
                              />
                            </div>
                          )}

                          {/* Free preview toggle */}
                          <div className="flex items-center justify-between rounded-lg border bg-background px-3 py-2.5">
                            <div className="space-y-0.5">
                              <Label className="text-xs font-medium">
                                Free Preview
                              </Label>
                              <p className="text-[10px] text-muted-foreground">
                                Allow students to preview this lesson for free
                              </p>
                            </div>
                            <Switch
                              checked={lesson.isFree}
                              onCheckedChange={(checked) =>
                                updateLesson(lesson.tempId, {
                                  isFree: checked,
                                })
                              }
                            />
                          </div>

                          <Separator />

                          <div className="flex items-center justify-end">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => removeLesson(lesson.tempId)}
                            >
                              <HugeiconsIcon icon={Delete01Icon} size={14} />
                              Remove Lesson
                            </Button>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                )
              })}
            </div>
          )}

          <Button
            variant="outline"
            className="w-full border-dashed"
            onClick={addNewLesson}
          >
            <HugeiconsIcon icon={Add01Icon} size={16} />
            Add Lesson
          </Button>

          {lessons.length > 0 && (
            <div className="pt-1">
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span>
                  {lessons.length} lesson{lessons.length !== 1 ? "s" : ""}
                </span>
                <span>·</span>
                <span>
                  {formatDurationHuman(
                    lessons.reduce(
                      (s, l) => s + (parseInt(l.duration) || 0),
                      0
                    )
                  )}{" "}
                  total
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ───────── RIGHT: Preview ───────── */}
        <div className="overflow-auto p-5 space-y-4 bg-muted/10 hidden lg:block">
          <div className="flex items-center gap-2">
            <HugeiconsIcon
              icon={ViewIcon}
              size={14}
              className="text-muted-foreground"
            />
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Student Preview
            </span>
          </div>

          {/* Card Preview */}
          <Card className="overflow-hidden">
            <div className="aspect-video w-full bg-muted relative overflow-hidden">
              {thumbnailUrl && !previewError ? (
                <Image
                  src={thumbnailUrl}
                  alt="Preview"
                  fill
                  className="object-cover"
                  sizes="320px"
                  onError={() => setPreviewError(true)}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-muted-foreground/40 text-xs">
                    No thumbnail
                  </span>
                </div>
              )}
              <Badge
                className="absolute top-2.5 left-2.5 text-[10px] z-10 shadow-sm"
                variant={pricing === "free" ? "default" : "secondary"}
              >
                {pricing === "free" ? "Free" : price ? `$${price}` : "Paid"}
              </Badge>
            </div>
            <CardContent className="p-3.5 space-y-2">
              <Badge variant="secondary" className="text-[10px] capitalize">
                {level}
              </Badge>
              <h3 className="font-semibold text-sm leading-snug line-clamp-2">
                {title || "Course Title"}
              </h3>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {description || "Course description will appear here."}
              </p>
              <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Avatar size="sm">
                    <AvatarImage
                      src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&fit=crop&crop=face"
                      alt="Sarah Chen"
                    />
                    <AvatarFallback>SC</AvatarFallback>
                  </Avatar>
                  <span>Sarah Chen</span>
                </div>
                <span>{lessons.length} lessons</span>
              </div>
            </CardContent>
          </Card>

          {/* Lesson List Preview */}
          {lessons.length > 0 && (
            <>
              <SectionDivider label="Lesson Preview" />
              <div className="space-y-0">
                {lessons.map((lesson, i) => (
                  <div
                    key={lesson.tempId}
                    className="flex items-center gap-3 py-2 border-b border-dashed border-border last:border-b-0"
                  >
                    {/* Thumbnail with number badge */}
                    <div className="relative w-12 h-8 rounded overflow-hidden shrink-0 bg-muted">
                      {lesson.thumbnailUrl ? (
                        <Image
                          src={lesson.thumbnailUrl}
                          alt={lesson.title}
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-muted">
                          <HugeiconsIcon 
                            icon={typeIcons[lesson.type]} 
                            size={12} 
                            className="text-muted-foreground/50" 
                          />
                        </div>
                      )}
                      <div className="absolute bottom-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-[9px] font-semibold text-white">
                        {i + 1}
                      </div>
                    </div>
                    <span className="text-xs truncate flex-1">
                      {lesson.title}
                    </span>
                    {lesson.duration && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatDurationHuman(parseInt(lesson.duration) || 0)}
                      </span>
                    )}
                    {lesson.isFree && (
                      <Badge
                        variant="outline"
                        className="text-[8px] px-1 py-0 shrink-0"
                      >
                        Free
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Course Stats Preview */}
          <SectionDivider label="Course Info" />
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-lg font-bold">{lessons.length}</p>
              <p className="text-[10px] text-muted-foreground">Lessons</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-lg font-bold">
                {formatDurationHuman(
                  lessons.reduce(
                    (s, l) => s + (parseInt(l.duration) || 0),
                    0
                  )
                )}
              </p>
              <p className="text-[10px] text-muted-foreground">Duration</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
