import Image from "next/image"
import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { RENDER_THUMB, isRender, plural } from "./model"

/**
 * The way out for anyone who would rather see every program than pick a
 * school first: one wide band to `/programs`, fanned with the real art of the
 * first few programs. Then a quiet line to the FAQ and the faculty.
 */
export function BrowseAll({
  total,
  art,
  showFaculty,
}: {
  total: number
  /** Program art, already de-duplicated, in the schools' order. */
  art: string[]
  showFaculty: boolean
}) {
  const fan = art.slice(0, 5)
  return (
    <div>
      {total > 0 && (
        <Link
          href="/programs"
          className="group grid grid-cols-[minmax(0,1fr)] gap-8 overflow-hidden rounded-[20px] border border-ws-hairline bg-ws-surface p-6 transition-colors duration-[var(--ws-motion-base)] hover:bg-ws-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 dark:border-transparent sm:p-8 md:p-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-12"
        >
          <div>
            <h2 className="font-display text-[clamp(1.5rem,2.4vw,2rem)] font-semibold leading-[1.1] tracking-[-0.02em] text-ws-primary">
              Every program in one list
            </h2>
            <p className="mt-3 max-w-lg text-pretty text-[15px] leading-relaxed text-ws-muted md:text-[16px]">
              See all {plural(total, "program")} side by side, with each one&apos;s level and price, and open the
              one you want.
            </p>
          </div>
          <div className="flex items-center justify-between gap-6 lg:justify-end">
            {fan.length > 0 && (
              <span aria-hidden className="flex">
                {fan.map((src, i) => (
                  <span
                    key={src}
                    className={cn(
                      "relative -ml-6 aspect-[16/10] w-20 overflow-hidden rounded-[12px] bg-ws-sunken ring-4 ring-ws-surface transition-[transform,box-shadow] duration-[var(--ws-motion-base)] ease-[var(--ws-ease)] first:ml-0 group-hover:ring-ws-raised sm:w-24 motion-safe:group-hover:-translate-y-1",
                      // A phone shows three; the band never outgrows its card.
                      i >= 3 && "hidden sm:block"
                    )}
                    style={{ transitionDelay: `${i * 30}ms` }}
                  >
                    <Image
                      src={src}
                      alt=""
                      fill
                      sizes={isRender(src) ? "192px" : "96px"}
                      className={cn("object-cover", isRender(src) && RENDER_THUMB)}
                    />
                  </span>
                ))}
              </span>
            )}
            <span className="inline-flex shrink-0 items-center gap-3 text-[14.5px] font-semibold text-ws-primary">
              <span className="sr-only sm:not-sr-only">Browse all</span>
              <span className="flex size-10 items-center justify-center rounded-full bg-ws-primary/[0.08] ring-1 ring-ws-primary/10 transition-colors duration-[var(--ws-motion-base)] group-hover:bg-ws-primary/[0.16]">
                <ArrowRightIcon
                  size={16}
                  aria-hidden
                  className="transition-transform duration-200 ease-[var(--ws-ease)] group-hover:translate-x-0.5"
                />
              </span>
            </span>
          </div>
        </Link>
      )}

      <p className="mt-8 text-center text-[14px] leading-loose text-ws-muted">
        <span className="block sm:inline">Questions before you choose?</span>{" "}
        <Link
          href="/#faq"
          className="whitespace-nowrap font-semibold text-ws-primary underline decoration-ws-hairline underline-offset-4 transition-colors hover:decoration-ws-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
        >
          Read the FAQ
        </Link>
        {showFaculty && (
          <>
            <span aria-hidden className="mx-2 text-ws-subtle">·</span>
            <Link
              href="/faculty"
              className="whitespace-nowrap font-semibold text-ws-primary underline decoration-ws-hairline underline-offset-4 transition-colors hover:decoration-ws-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
            >
              Meet the faculty
            </Link>
          </>
        )}
      </p>
    </div>
  )
}
