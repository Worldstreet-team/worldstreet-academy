"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon } from "@hugeicons/core-free-icons"
import { completeOnboarding } from "@/lib/actions/onboarding"

const screens = [
  {
    illustration: "/user/dashboard/dashboard-welcome.png",
    tagline: "Welcome to WorldStreet Academy",
    subtitleMobile: "Your journey to mastering the markets starts here.",
    subtitleDesktop:
      "We bring together expert instructors, structured courses, and a global community — everything you need to go from beginner to confident trader.",
  },
  {
    illustration: "/user/dashboard/course-empty-state.png",
    tagline: "Learn from the best",
    subtitleMobile: "Expert-led courses on trading, DeFi & blockchain.",
    subtitleDesktop:
      "From technical analysis and risk management to DeFi protocols and smart contracts — our library is built by professionals who trade for a living.",
  },
  {
    illustration: "/user/dashboard/course-completion.png",
    tagline: "Earn certificates",
    subtitleMobile: "Showcase your achievements to the world.",
    subtitleDesktop:
      "Complete courses to earn verifiable certificates. Share them on LinkedIn, add them to your resume, and stand out in the industry.",
  },
] as const

type OnboardingFlowProps = {
  userName: string
  onComplete: () => void
  showSetupLoading?: boolean
}

export function OnboardingFlow({ userName, onComplete, showSetupLoading = false }: OnboardingFlowProps) {
  const router = useRouter()
  const [current, setCurrent] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [phase, setPhase] = useState<"loading" | "fading" | "ready">(
    showSetupLoading ? "loading" : "ready"
  )

  const screen = screens[current]
  const isLast = current === screens.length - 1
  const isFirst = current === 0

  // Loading → fading (start fade-out after 2s)
  useEffect(() => {
    if (phase !== "loading") return
    const timer = setTimeout(() => setPhase("fading"), 2000)
    return () => clearTimeout(timer)
  }, [phase])

  // Fading → ready (complete fade-out, then show content)
  useEffect(() => {
    if (phase !== "fading") return
    const timer = setTimeout(() => setPhase("ready"), 500)
    return () => clearTimeout(timer)
  }, [phase])

  const finish = useCallback(async () => {
    await completeOnboarding()
    router.push("/dashboard")
  }, [router])

  const goNext = useCallback(() => {
    if (isAnimating) return
    if (isLast) {
      finish()
      return
    }
    setIsAnimating(true)
    setCurrent((p) => p + 1)
    setTimeout(() => setIsAnimating(false), 400)
  }, [isLast, isAnimating, finish])

  const goBack = useCallback(() => {
    if (isAnimating || isFirst) return
    setIsAnimating(true)
    setCurrent((p) => p - 1)
    setTimeout(() => setIsAnimating(false), 400)
  }, [isFirst, isAnimating])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "Enter") goNext()
      if (e.key === "ArrowLeft") goBack()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [goNext, goBack])

  return (
    <div className="relative z-10 flex flex-col min-h-screen">
      {/* Skip — top right, glassmorphic */}
      {!isLast && (
        <div className="absolute top-5 right-5 z-20">
          <button
            onClick={finish}
            className="px-5 py-2 rounded-full text-xs font-medium
              bg-white/20 dark:bg-white/10 backdrop-blur-xl
              text-foreground/70 hover:text-foreground hover:bg-white/30
              dark:hover:bg-white/15 transition-all"
          >
            Skip
          </button>
        </div>
      )}

      {/* Logo — top left */}
      <div className="absolute top-5 left-5 z-20 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xs">
          W
        </div>
        <span className="text-sm font-semibold tracking-tight hidden sm:inline">
          World<span className="text-primary">Street</span>
        </span>
      </div>

      {/* ====== MOBILE LAYOUT ====== */}
      <div className="flex flex-col flex-1 lg:hidden pt-20">
        {/* Illustration — pushed down, above content, big */}
        <div className="flex-1 flex items-end justify-center px-6 ">
          <div className="relative w-72 h-72 sm:w-80 sm:h-80">
            <div className="absolute inset-0 bg-primary/10 blur-[60px] rounded-full" />
            {screens.map((s, i) => (
              <div
                key={i}
                className="absolute inset-0 transition-all duration-300 ease-out"
                style={{
                  opacity: i === current ? 1 : 0,
                  transform:
                    i === current
                      ? "translateX(0) scale(1)"
                      : i < current
                        ? "translateX(-20%) scale(0.95)"
                        : "translateX(20%) scale(0.95)",
                  pointerEvents: i === current ? "auto" : "none",
                }}
              >
                <Image
                  src={s.illustration}
                  alt=""
                  fill
                  className="object-contain"
                  sizes="320px"
                  priority={i === 0}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Text + CTA — or Loading State */}
        <div className="px-6 pb-10 pt-2">
          <div className="max-w-sm mx-auto flex flex-col items-center text-center relative">
            {/* Setup Loading — fades out cleanly */}
            {phase !== "ready" && (
              <div
                className="flex flex-col items-center gap-3 transition-all duration-400 ease-out"
                style={{
                  opacity: phase === "fading" ? 0 : 1,
                  transform: phase === "fading" ? "scale(0.95) translateY(-8px)" : "scale(1) translateY(0)",
                }}
              >
                <HugeiconsIcon
                  icon={Loading03Icon}
                  size={28}
                  className="text-primary animate-spin"
                />
                <p className="text-sm text-muted-foreground">
                  Setting up your experience
                </p>
              </div>
            )}

            {/* Onboarding Content — animates in after loading fades out */}
            {phase === "ready" && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
                {current === 0 && (
                  <p className="text-muted-foreground text-sm mb-1.5">
                    Hi, {userName} 👋
                  </p>
                )}
                <div key={current} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-1.5 text-balance">
                    {screen.tagline}
                  </h2>
                  <p className="text-muted-foreground text-sm leading-relaxed text-balance max-w-[300px] mx-auto">
                    {screen.subtitleMobile}
                  </p>
                </div>

                {/* Dots — centered */}
                <div className="flex items-center justify-center gap-2 mt-6 mb-5">
                  {screens.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === current ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/20"
                      }`}
                    />
                  ))}
                </div>

                {/* CTA */}
                <div className="flex items-center gap-3 w-full">
                  {!isFirst && (
                    <button
                      onClick={goBack}
                      className="h-12 w-12 flex-shrink-0 rounded-full flex items-center justify-center
                        bg-white/20 dark:bg-white/10 backdrop-blur-xl
                        text-foreground/70 hover:text-foreground hover:bg-white/30
                        dark:hover:bg-white/15 transition-all"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={goNext}
                    className="flex-1 h-12 rounded-full bg-primary text-primary-foreground
                      text-sm font-semibold tracking-wide transition-all hover:opacity-90
                      active:scale-[0.98]"
                  >
                    {isLast ? "Get Started" : "Continue"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ====== DESKTOP LAYOUT — grid: illustration left (down+left more), text left ====== */}
      <div className="hidden lg:grid lg:grid-cols-2 flex-1 pt-6 items-end pb-16 px-12 xl:px-16 gap-12">
        {/* Left — Illustration (pushed down and to the left) */}
        <div className="flex items-end justify-start pl-0 xl:pl-4 pb-4" style={{ transform: "translateY(20%)" }}>
          <div className="relative w-[28rem] h-[28rem] xl:w-[32rem] xl:h-[32rem]">
            <div className="absolute inset-0 bg-primary/10 blur-[80px] rounded-full" />
            {screens.map((s, i) => (
              <div
                key={i}
                className="absolute inset-0 transition-all duration-300 ease-out"
                style={{
                  opacity: i === current ? 1 : 0,
                  transform:
                    i === current
                      ? "translateX(0) scale(1)"
                      : i < current
                        ? "translateX(-20%) scale(0.95)"
                        : "translateX(20%) scale(0.95)",
                  pointerEvents: i === current ? "auto" : "none",
                }}
              >
                <Image
                  src={s.illustration}
                  alt=""
                  fill
                  className="object-contain "
                  sizes="512px"
                  priority={i === 0}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Right — Text + CTA, left-aligned */}
        <div className="flex flex-col items-start justify-center text-left relative -translate-y-12">
          {/* Setup Loading */}
          {phase !== "ready" && (
            <div
              className="flex items-center gap-4 transition-all duration-400 ease-out"
              style={{
                opacity: phase === "fading" ? 0 : 1,
                transform: phase === "fading" ? "scale(0.95) translateY(-8px)" : "scale(1) translateY(0)",
              }}
            >
              <HugeiconsIcon
                icon={Loading03Icon}
                size={32}
                className="text-primary animate-spin"
              />
              <p className="text-sm text-muted-foreground">
                Setting up your experience
              </p>
            </div>
          )}

          {/* Onboarding Content */}
          {phase === "ready" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both w-full">
              {current === 0 && (
                <p className="text-muted-foreground text-sm mb-2">
                  Hi, {userName} 👋
                </p>
              )}
              <div key={current} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <h2 className="text-3xl xl:text-4xl font-bold tracking-tight mb-3 text-balance">
                  {screen.tagline}
                </h2>
                <p className="text-muted-foreground text-sm xl:text-base leading-relaxed max-w-md">
                  {screen.subtitleDesktop}
                </p>
              </div>

              {/* Dots + CTA — same line on desktop */}
              <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6 lg:gap-4 mt-8 w-full">
                {/* CTA */}
                <div className="flex items-center gap-3 w-full lg:flex-1 lg:max-w-sm">
                {!isFirst && (
                  <button
                    onClick={goBack}
                    className="h-12 w-12 flex-shrink-0 rounded-full flex items-center justify-center
                      bg-white/20 dark:bg-white/10 backdrop-blur-xl
                      text-foreground/70 hover:text-foreground hover:bg-white/30
                      dark:hover:bg-white/15 transition-all"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
                  <button
                    onClick={goNext}
                    className="flex-1 h-12 rounded-full bg-primary text-primary-foreground
                      text-sm font-semibold tracking-wide transition-all hover:opacity-90
                      active:scale-[0.98]"
                  >
                    {isLast ? "Get Started" : "Continue"}
                  </button>
                </div>

                {/* Dots */}
                <div className="flex items-center gap-2">
                  {screens.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === current ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/20"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
