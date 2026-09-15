import { Skel, SkeletonRows } from "@/components/ui/system"

/**
 * Route loading state in the v2 grammar: neutral static blocks shaped like
 * what's coming (a top bar, a page header, course cards with a progress
 * track, a list card), on 20px cards separated by fill in dark and by a
 * hairline in light.
 */
export default function PlatformLoading() {
  return (
    <div className="flex flex-col">
      {/* The top bar's footprint, so the page doesn't jump when it arrives. */}
      <div aria-hidden className="h-14 border-b border-border md:h-16" />

      <div className="flex flex-col gap-6 px-4 pb-24 pt-6 sm:px-6 md:pb-8 lg:px-8">
        <div className="flex flex-col gap-2">
          <Skel className="h-8 w-56 max-w-full rounded-md" />
          <Skel className="h-4 w-80 max-w-full" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-[20px] border border-border bg-card dark:border-transparent"
            >
              <Skel className="aspect-video w-full rounded-none" />
              <div className="flex flex-col gap-2 p-4">
                <Skel className="h-4 w-3/4" />
                <Skel className="h-3 w-1/2" />
                <Skel className="mt-2 h-1 w-full rounded-full" />
              </div>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-[20px] border border-border bg-card dark:border-transparent">
          <SkeletonRows rows={4} />
        </div>
      </div>
    </div>
  )
}
