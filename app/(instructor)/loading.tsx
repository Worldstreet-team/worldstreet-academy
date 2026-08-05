import { Skeleton } from "@/components/ui/skeleton"

/**
 * Neutral instructor-portal skeleton: page header bar + generic card rows.
 * Deliberately not course-card shaped — this boundary covers every route in
 * the group (settings, analytics, certificates…), so it stays contentless.
 */
export default function InstructorLoading() {
  return (
    <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
      <div className="mx-auto w-full max-w-7xl space-y-8">
        {/* Header bar */}
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>

        {/* Stat row */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[76px] rounded-lg" />
          ))}
        </div>

        {/* Card rows */}
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-lg border border-ws-hairline bg-ws-surface p-4"
            >
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
