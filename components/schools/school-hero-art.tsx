"use client"

import * as React from "react"
import Image from "next/image"
import { MotionConfig, motion, useMotionValue, useScroll, useTransform } from "motion/react"
import { useMotionOK } from "@/components/marketing/motion/bus"
import { EASE_INERTIA } from "@/components/marketing/motion/ease"

/**
 * The school's render as the hero's stage.
 *
 * lg and up: the stage is the whole hero, edge to edge. The render is dark in
 * both themes, so the stage is too — black on paper, the page's own near-black
 * in dark mode, which is the colour of the render's edges, so there is no
 * seam. The render fills the stage's right side (from 40%, 36% on xl) and
 * feathers into it on the left, which keeps its object clear of the copy at
 * every width from 1024 up; a foot darkens under the fact strip.
 *
 * Below lg: the render leads the page edge to edge and its foot melts into
 * the page above the copy.
 *
 * Motion, all of it transform/opacity and none of it ambient:
 * - one entrance — the render settles from 1.06 to 1 as the page opens;
 * - scroll-linked depth — as the hero leaves, the render drifts down at a
 *   fraction of the scroll, grows a touch and dims, so the page slides over
 *   it rather than past it.
 * Under reduced motion the render is simply there, still: MotionConfig skips
 * the entrance and the scroll values are never bound.
 *
 * `unoptimized`: the file is 1600px and ~22KB, and the optimiser's q75
 * re-encode is larger and bands the dark gradient.
 */
export function SchoolHeroArt({ src }: { src: string }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const ok = useMotionOK()
  // Progress 0 → 1 as the page scrolls from the top to the stage's foot.
  // Measured against the window (not a `target`, which wants a positioned
  // scroll container — the document root here is static).
  const { scrollY } = useScroll()
  const foot = useMotionValue(1)
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => foot.set(Math.max(1, el.getBoundingClientRect().bottom + window.scrollY))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [foot])
  const scrollYProgress = useTransform(() => Math.min(1, Math.max(0, scrollY.get() / foot.get())))
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "18%"])
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.07])
  const dim = useTransform(scrollYProgress, [0, 1], [0, 0.6])

  return (
    <MotionConfig reducedMotion="user">
      <div
        ref={ref}
        aria-hidden
        className="relative aspect-[16/10] overflow-hidden bg-black sm:aspect-[16/9] lg:absolute lg:inset-0 lg:aspect-auto dark:bg-ws-page"
      >
        <motion.div className="absolute inset-0 lg:left-[40%] xl:left-[36%]" style={ok ? { y, scale } : undefined}>
          <motion.div
            className="absolute inset-0"
            initial={{ scale: 1.06 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.6, ease: EASE_INERTIA }}
          >
            <Image
              src={src}
              alt=""
              fill
              priority
              unoptimized
              sizes="(min-width: 1280px) 64vw, (min-width: 1024px) 60vw, 100vw"
              className="object-cover object-[70%_62%] lg:object-[85%_62%]"
            />
          </motion.div>
          {/* lg: the render's left edge feathers into the stage. */}
          <span className="absolute inset-y-0 left-0 hidden w-2/5 bg-linear-to-r from-black to-transparent lg:block dark:from-ws-page" />
        </motion.div>

        {/* lg: a foot under the fact strip. Below lg: the render's foot melts into the page. */}
        <span className="absolute inset-x-0 bottom-0 hidden h-2/5 bg-linear-to-t from-black/85 to-transparent lg:block dark:from-ws-page/90" />
        <span className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-ws-page to-transparent lg:hidden" />
        {ok && <motion.span className="absolute inset-0 bg-black" style={{ opacity: dim }} />}
      </div>
    </MotionConfig>
  )
}
