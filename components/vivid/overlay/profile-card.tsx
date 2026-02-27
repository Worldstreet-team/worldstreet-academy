"use client"

import Image from "next/image"
import { HugeiconsIcon } from "@hugeicons/react"
import { UserIcon } from "@hugeicons/core-free-icons"

export function ProfileCard({ data }: { data: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = (data as any)?.profile || data
  if (!p) return null

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center text-center pt-2">
        <div className="relative w-16 h-16 rounded-full bg-accent/20 overflow-hidden mb-3 ring-2 ring-border/15 ring-offset-2 ring-offset-background">
          {p.avatarUrl ? (
            <Image src={p.avatarUrl} alt="" fill className="object-cover" sizes="64px" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <HugeiconsIcon icon={UserIcon} size={28} className="text-muted-foreground/50" />
            </div>
          )}
        </div>
        <p className="text-base font-semibold text-foreground">{p.firstName} {p.lastName}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{p.email}</p>
        {p.role && (
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1.5 px-2.5 py-0.5 rounded-lg bg-accent/25">
            {p.role}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="p-3.5 rounded-2xl bg-accent/15 border border-border/15 text-center">
          <p className="text-xl font-bold text-foreground tabular-nums">{p.activeEnrollments || 0}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Active</p>
        </div>
        <div className="p-3.5 rounded-2xl bg-accent/15 border border-border/15 text-center">
          <p className="text-xl font-bold text-foreground tabular-nums">{p.completedEnrollments || 0}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Completed</p>
        </div>
      </div>
    </div>
  )
}
