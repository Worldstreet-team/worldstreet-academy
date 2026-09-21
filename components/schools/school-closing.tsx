import Image from "next/image"
import type { School } from "@/lib/schools"
import { cn } from "@/lib/utils"
import { SchoolIcon } from "@/components/shared/school-icon"
import { CtaLink, GOLD_CTA, type SchoolCta } from "@/components/schools/cta"

/**
 * The closing band: the page ends where it began — on the school's render,
 * now framed as a 20px card — with the one gold action again. The render is
 * dark in both themes, so the band is white-on-dark in both.
 */
export function SchoolClosing({
  school,
  cover,
  title,
  body,
  cta,
}: {
  school: School
  cover: string | null
  title: string
  body: string
  cta: SchoolCta
}) {
  return (
    <section aria-labelledby="closing-heading" className="mx-auto max-w-7xl px-6 pb-24 pt-20 md:pb-32 md:pt-28">
      <div className="relative isolate overflow-hidden rounded-[20px] bg-black">
        {/* As in the hero: from md the render takes the band's right side and
            feathers into the black on its left, so its object stays whole and
            clear of the copy; below md it fills the band under a scrim. */}
        {cover && (
          <div aria-hidden className="absolute inset-0 -z-10 md:left-[38%]">
            <Image
              src={cover}
              alt=""
              fill
              unoptimized
              sizes="(min-width: 1280px) 780px, (min-width: 768px) 62vw, 100vw"
              className="object-cover object-[70%_50%] md:object-[85%_50%]"
            />
            <span className="absolute inset-0 bg-black/65 md:hidden" />
            <span className="absolute inset-y-0 left-0 hidden w-2/5 bg-linear-to-r from-black to-transparent md:block" />
          </div>
        )}
        <div className="px-7 py-14 sm:px-12 sm:py-20 md:max-w-[36rem] lg:max-w-[40rem] lg:px-14 lg:py-24">
          <span className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15">
            <SchoolIcon name={school.icon} size={18} aria-hidden />
          </span>
          <h2
            id="closing-heading"
            className="mt-6 text-balance font-display font-semibold leading-[1.06] tracking-[-0.025em] text-white"
            style={{ fontSize: "clamp(1.875rem, 3.4vw, 2.75rem)" }}
          >
            {title}
          </h2>
          <p className="mt-4 max-w-[30rem] text-pretty text-[16px] leading-relaxed text-white/70">{body}</p>
          <CtaLink cta={cta} data-school-cta="closing" className={cn("mt-8", GOLD_CTA, "focus-visible:ring-offset-black")}>
            {cta.label}
          </CtaLink>
        </div>
      </div>
    </section>
  )
}
