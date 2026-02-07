import Image from "next/image"
import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

type EmptyStateProps = {
  icon?: IconSvgElement
  /** Path to an illustration image (takes priority over icon) */
  illustration?: string
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
  /** Use outline variant for the action button */
  actionVariant?: "default" | "outline"
}

export function EmptyState({
  icon,
  illustration,
  title,
  description,
  actionLabel,
  actionHref,
  actionVariant = "default",
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      {illustration ? (
        <div className="relative w-48 h-48 md:w-56 md:h-56 mb-3">
          <Image
            src={illustration}
            alt={title}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 192px, 224px"
          />
        </div>
      ) : icon ? (
        <div className="mb-4">
          <HugeiconsIcon icon={icon} size={28} className="text-muted-foreground" />
        </div>
      ) : null}
      <h3 className="font-semibold text-sm mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground max-w-[260px]">{description}</p>
      {actionLabel && actionHref && (
        <Button
          size="sm"
          variant={actionVariant}
          className="mt-4"
          render={<Link href={actionHref} />}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
