"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CardShell, Rise, Skel, SkeletonRows } from "@/components/ui/system"
import { getTeachingHome } from "@/lib/actions/teaching-home"
import { startOfDay } from "@/lib/calendar-grid"
import { useUnreadCount } from "@/lib/hooks/queries"
import { useClientNow } from "@/lib/hooks/use-now"
import { CohortGrid } from "./cohort-grid"
import { MoneyCard } from "./money-card"
import { NextClassHero } from "./next-class-hero"
import { TodoQueue } from "./todo-queue"
import { WeekAgenda } from "./week-agenda"

/*
 * The tutor home, top to bottom: the next class, this week, the cohorts, the
 * to-do queue and the money. One server read (getTeachingHome), refetched
 * every 30 s so a class flips to live without a reload; the unread count is
 * the shell's own query, so the to-do row and the sidebar badge always agree.
 * The browser sends where its day and month begin — the week and "this month"
 * are the tutor's, not the server's.
 */

const REFETCH_MS = 30_000

export function TeachingHome() {
  // Null on the server and through hydration: the week depends on the browser's clock and zone.
  const now = useClientNow()
  const today = now === null ? null : startOfDay(new Date(now))
  const weekStart = today?.toISOString() ?? ""
  const monthStart = today ? new Date(today.getFullYear(), today.getMonth(), 1).toISOString() : ""

  const { data, isPending, isFetching, refetch } = useQuery({
    queryKey: ["instructor", "teaching-home", weekStart, monthStart],
    queryFn: () => getTeachingHome({ weekStart, monthStart }),
    enabled: now !== null,
    refetchInterval: REFETCH_MS,
    // Midnight changes the key; keep the old home on screen while the new day loads.
    placeholderData: keepPreviousData,
  })
  const { data: unread = 0 } = useUnreadCount()

  if (now === null || isPending) return <TeachingHomeSkeleton />

  if (!data?.success) {
    return (
      <CardShell className="items-center gap-3 px-6 py-10 text-center">
        <p className="text-[15px] font-semibold">{data?.error ?? "Couldn't load your teaching home"}</p>
        <p className="text-[13px] text-muted-foreground">Your classes and courses are safe — this page just couldn&apos;t load them.</p>
        <Button variant="outline" className="rounded-full" onClick={() => refetch()} loading={isFetching}>
          <RotateCcw size={14} strokeWidth={2} aria-hidden />
          Try again
        </Button>
      </CardShell>
    )
  }

  const home = data.data
  return (
    <div className="flex flex-col gap-6">
      <Rise>
        <NextClassHero
          hero={home.hero}
          now={now}
          teachesProgram={home.teachesProgram}
          hasCourses={home.cohorts.some((c) => c.status === "published")}
        />
      </Rise>
      <Rise delay={60}>
        <WeekAgenda entries={home.week} now={now} />
      </Rise>
      <Rise delay={120}>
        <CohortGrid cohorts={home.cohorts} draftCount={home.draftCount} now={now} />
      </Rise>
      <Rise delay={180}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">
            <TodoQueue items={home.todo} unread={unread} now={now} />
          </div>
          <div className="min-w-0">
            <MoneyCard money={home.money} />
          </div>
        </div>
      </Rise>
    </div>
  )
}

/** The page's shape while it loads: hero, week, three cohort cards, the queue and the money. */
export function TeachingHomeSkeleton() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-busy="true" aria-label="Loading your teaching home">
      <CardShell className="gap-5 p-5 sm:p-6">
        <Skel className="h-3 w-28" />
        <div className="flex flex-col gap-2">
          <Skel className="h-7 w-72 max-w-full" />
          <Skel className="h-4 w-48 max-w-[70%]" />
        </div>
        <Skel className="h-4 w-64 max-w-full" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skel key={i} className="h-12 w-14 rounded-[9px]" />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Skel className="h-11 w-36 rounded-full" />
          <Skel className="h-11 w-40 rounded-full" />
        </div>
      </CardShell>

      <CardShell>
        <div className="flex flex-col gap-1.5 px-4 py-3.5 sm:px-5">
          <Skel className="h-4 w-24" />
          <Skel className="h-3 w-40" />
        </div>
        <SkeletonRows rows={3} label="Loading this week" className="border-t border-border/60" />
      </CardShell>

      <div className="flex flex-col gap-3">
        <Skel className="h-4 w-32" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardShell key={i} className={i === 2 ? "hidden 2xl:flex" : undefined}>
              <div className="flex items-center gap-3 px-4 pb-3 pt-4">
                <Skel className="h-11 w-11 shrink-0 rounded-[9px]" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skel className="h-4 w-40 max-w-full" />
                  <Skel className="h-3 w-24" />
                </div>
              </div>
              <div className="flex flex-col divide-y divide-border/60 border-t border-border/60">
                {Array.from({ length: 5 }).map((_, r) => (
                  <div key={r} className="flex min-h-11 items-center justify-between px-4 py-2">
                    <Skel className="h-3 w-20" />
                    <Skel className="h-3 w-14" />
                  </div>
                ))}
              </div>
            </CardShell>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <CardShell className="lg:col-span-2">
          <div className="px-4 py-3.5 sm:px-5">
            <Skel className="h-4 w-16" />
          </div>
          <SkeletonRows rows={3} label="Loading your to-do list" className="border-t border-border/60" />
        </CardShell>
        <CardShell>
          <div className="px-4 py-3.5 sm:px-5">
            <Skel className="h-4 w-20" />
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-border/60 px-4 py-4 sm:px-5">
            <Skel className="h-7 w-24" />
            <Skel className="h-7 w-24" />
          </div>
        </CardShell>
      </div>
    </div>
  )
}
