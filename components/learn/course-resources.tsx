"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  File01Icon,
  Book02Icon,
  Download04Icon,
  Link01Icon,
  LockIcon,
  Loading03Icon,
  Task01Icon,
  PresentationBarChart01Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { listCourseResources, getResourceDownloadUrl } from "@/lib/actions/resources"
import type { ResourceKind } from "@/lib/db/models/resource"

const KIND_ICON: Record<ResourceKind, typeof File01Icon> = {
  pdf: File01Icon,
  ebook: Book02Icon,
  worksheet: Task01Icon,
  template: File01Icon,
  slides: PresentationBarChart01Icon,
  link: Link01Icon,
}

const KIND_LABEL: Record<ResourceKind, string> = {
  pdf: "PDF",
  ebook: "eBook",
  worksheet: "Worksheet",
  template: "Template",
  slides: "Slides",
  link: "Link",
}

function formatSize(bytes: number) {
  if (!bytes) return ""
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * Downloadable materials for a course. Locked items stay visible (so learners
 * can see what enrolling gets them) but the download action is server-gated —
 * clicking it without access returns an error rather than a file.
 */
export function CourseResources({ courseId, lessonId }: { courseId: string; lessonId?: string }) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ["course-resources", courseId],
    queryFn: () => listCourseResources(courseId),
  })

  // Course-level materials always show; lesson-level ones only on their lesson.
  const visible = resources.filter((r) => !r.lessonId || !lessonId || r.lessonId === lessonId)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <HugeiconsIcon icon={Loading03Icon} size={14} className="animate-spin" />
        Loading resources…
      </div>
    )
  }

  if (visible.length === 0) return null

  async function download(id: string) {
    setBusyId(id)
    setError(null)
    const result = await getResourceDownloadUrl(id)
    setBusyId(null)
    if (result.success && result.url) {
      window.open(result.url, "_blank", "noopener")
    } else {
      setError(result.error || "Couldn't start the download")
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Resources</h3>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
          <p className="text-xs text-red-500">{error}</p>
        </div>
      )}

      <div className="space-y-2">
        {visible.map((r) => {
          const Icon = KIND_ICON[r.kind] ?? File01Icon
          return (
            <div
              key={r.id}
              className="flex items-center gap-3 rounded-xl border border-border/50 bg-card px-3 py-2.5"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <HugeiconsIcon
                  icon={r.locked ? LockIcon : Icon}
                  size={16}
                  className={r.locked ? "text-muted-foreground/50" : "text-foreground"}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-medium">{r.title}</p>
                  {r.isFree && (
                    <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                      Free
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {KIND_LABEL[r.kind]}
                  {r.sizeBytes ? ` · ${formatSize(r.sizeBytes)}` : ""}
                  {r.description ? ` · ${r.description}` : ""}
                </p>
              </div>
              <Button
                variant={r.locked ? "ghost" : "outline"}
                size="sm"
                disabled={r.locked || busyId === r.id}
                onClick={() => download(r.id)}
                className="shrink-0 gap-1.5 text-xs"
              >
                {busyId === r.id ? (
                  <HugeiconsIcon icon={Loading03Icon} size={13} className="animate-spin" />
                ) : (
                  <HugeiconsIcon icon={r.locked ? LockIcon : Download04Icon} size={13} />
                )}
                {r.locked ? "Locked" : r.kind === "link" ? "Open" : "Download"}
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
