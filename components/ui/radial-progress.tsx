"use client"

import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import { Tick02Icon } from "@hugeicons/core-free-icons"

type RadialProgressProps = {
  value: number
  size?: number
  strokeWidth?: number
  className?: string
}

export function RadialProgress({
  value,
  size = 64,
  strokeWidth = 5,
  className,
}: RadialProgressProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference
  const isComplete = value >= 100

  if (isComplete) {
    return (
      <div
        className={cn("inline-flex items-center justify-center", className)}
        style={{ width: size, height: size }}
      >
        <HugeiconsIcon
          icon={Tick02Icon}
          size={size * 0.55}
          strokeWidth={2.5}
          className="text-emerald-500"
        />
      </div>
    )
  }

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/60"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out text-primary"
        />
      </svg>
      <span className="absolute text-xs font-semibold tabular-nums text-foreground">
        {Math.round(value)}%
      </span>
    </div>
  )
}
