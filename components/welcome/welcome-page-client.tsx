"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { MarqueeBackground } from "./marquee-background"
import { OnboardingFlow } from "./onboarding-flow"

type WelcomePageClientProps = {
  firstName: string | null
  hasOnboarded: boolean
  isAuthenticated: boolean
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

export function WelcomePageClient({
  firstName,
  hasOnboarded,
  isAuthenticated,
}: WelcomePageClientProps) {
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [justFinishedOnboarding, setJustFinishedOnboarding] = useState(false)

  useEffect(() => {
    if (isAuthenticated && !hasOnboarded) {
      setShowOnboarding(true)
    }
    setIsReady(true)
  }, [isAuthenticated, hasOnboarded])

  if (!isReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  const isNewUser = !hasOnboarded

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Netflix-style scrolling background */}
      <MarqueeBackground />

      {/* Onboarding for first-time users */}
      {showOnboarding ? (
        <OnboardingFlow
          userName={firstName ?? "there"}
          onComplete={() => {
            setShowOnboarding(false)
            setJustFinishedOnboarding(true)
          }}
          showSetupLoading={isAuthenticated && !hasOnboarded}
        />
      ) : (
        /* ===== WELCOME / LANDING VIEW ===== */
        <div className="relative z-10 flex flex-col min-h-screen">
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
          <div className="flex flex-col flex-1 lg:hidden">
            {/* Spacer pushes content down below marquee */}
            <div className="flex-1" />

            {/* Content zone */}
            <div className="flex flex-col items-center text-center px-6 pb-12 pt-4
              animate-in fade-in slide-in-from-bottom-4 duration-700">
              {/* Illustration — bigger */}
              <div className="relative w-52 h-52 sm:w-60 sm:h-60 mb-5" >
                <div className="absolute inset-0 bg-primary/10 blur-[50px] rounded-full" />
                <Image
                  src="/user/dashboard/dashboard-welcome.png"
                  alt=""
                  fill
                  className="object-contain relative z-10"
                  sizes="(max-width: 640px) 208px, 240px"
                  priority
                />
              </div>

              {/* Text */}
              {firstName ? (
                <>
                  <p className="text-muted-foreground text-sm mb-1">
                    {getGreeting()}, {firstName} 👋
                  </p>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight mb-1 text-balance">
                    {isNewUser || justFinishedOnboarding
                      ? "Start your learning journey"
                      : "Ready to learn?"}
                  </h1>
                  <p className="text-muted-foreground text-xs max-w-[280px] mb-8 text-balance leading-relaxed">
                    {isNewUser || justFinishedOnboarding
                      ? "Explore courses and begin your path to mastery."
                      : "Pick up where you left off and keep growing."}
                  </p>
                </>
              ) : (
                <>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight mb-1 text-balance">
                    Master the Markets
                  </h1>
                  <p className="text-muted-foreground text-xs max-w-[280px] mb-8 text-balance leading-relaxed">
                    Expert-led courses on trading, DeFi & blockchain.
                  </p>
                </>
              )}

              {/* CTA */}
              <div className="flex flex-col gap-3 w-full max-w-xs">
                <Link
                  href="/dashboard"
                  className="w-full h-12 rounded-full bg-primary text-primary-foreground
                    text-sm font-semibold tracking-wide flex items-center justify-center
                    transition-all hover:opacity-90 active:scale-[0.98]"
                >
                  {firstName ? "Go to Dashboard" : "Get Started"}
                </Link>
                {!firstName && (
                  <Link
                    href="/courses"
                    className="w-full h-12 rounded-full bg-white/20 dark:bg-white/10
                      backdrop-blur-xl text-foreground text-sm font-medium
                      flex items-center justify-center transition-all
                      hover:bg-white/30 dark:hover:bg-white/15 active:scale-[0.98]"
                  >
                    Browse Courses
                  </Link>
                )}
              </div>

              {/* Stats for guests */}
              {!firstName && (
                <div className="flex items-center gap-6 mt-8 text-xs text-muted-foreground">
                  <div className="flex flex-col items-center">
                    <span className="text-base font-bold text-foreground">50+</span>
                    <span>Courses</span>
                  </div>
                  <div className="h-5 w-px bg-border" />
                  <div className="flex flex-col items-center">
                    <span className="text-base font-bold text-foreground">10K+</span>
                    <span>Learners</span>
                  </div>
                  <div className="h-5 w-px bg-border" />
                  <div className="flex flex-col items-center">
                    <span className="text-base font-bold text-foreground">4.8</span>
                    <span>Rating</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ====== DESKTOP LAYOUT — grid: illustration left (down+left), text left ====== */}
          <div className="hidden lg:grid lg:grid-cols-2 flex-1 items-end pb-12 px-12 xl:px-16 gap-12">
            {/* Left — Illustration (pushed down and to the left) */}
            <div className="flex items-end justify-start pl-0 xl:pl-4
              animate-in fade-in slide-in-from-left-6 duration-700" style={{ transform: "translateY(25%)" }}>
              <div className="relative w-[24rem] h-[24rem] xl:w-[28rem] xl:h-[28rem]">
                <div className="absolute inset-0 bg-primary/10 blur-[70px] rounded-full" />
                <Image
                  src="/user/dashboard/dashboard-welcome.png"
                  alt=""
                  fill
                  className="object-contain relative z-10"
                  sizes="(min-width: 1280px) 448px, 384px"
                  priority
                />
              </div>
            </div>

            {/* Right — Text + CTA, left-aligned */}
            <div className="flex flex-col items-start justify-end text-left
              animate-in fade-in slide-in-from-right-6 duration-700">
              {firstName ? (
                <>
                  <p className="text-muted-foreground text-sm mb-2">
                    {getGreeting()}, {firstName} 👋
                  </p>
                  <h1 className="text-3xl xl:text-4xl font-bold tracking-tight mb-3 text-balance">
                    {isNewUser || justFinishedOnboarding
                      ? "Start your learning journey"
                      : "Welcome back"}
                  </h1>
                  <p className="text-muted-foreground text-sm xl:text-base leading-relaxed max-w-md">
                    {isNewUser || justFinishedOnboarding
                      ? "Explore our expert-led courses, learn at your own pace, and build the skills you need to trade with confidence."
                      : "Your courses are waiting. Continue where you left off or discover something new to sharpen your edge."}
                  </p>
                </>
              ) : (
                <>
                  <h1 className="text-3xl xl:text-4xl font-bold tracking-tight mb-3 text-balance">
                    Master the Markets
                  </h1>
                  <p className="text-muted-foreground text-sm xl:text-base leading-relaxed max-w-md">
                    Expert-led courses on crypto trading, DeFi, risk management, and blockchain development. Learn from professionals who trade for a living.
                  </p>
                </>
              )}

              {/* CTA — left aligned */}
              <div className="flex items-center gap-3 mt-8 w-full max-w-sm">
                <Link
                  href="/dashboard"
                  className="h-12 px-10 rounded-full bg-primary text-primary-foreground
                    text-sm font-semibold tracking-wide flex items-center justify-center
                    transition-all hover:opacity-90 active:scale-[0.98]"
                >
                  {firstName ? "Go to Dashboard" : "Get Started"}
                </Link>
                {!firstName && (
                  <Link
                    href="/courses"
                    className="h-12 px-8 rounded-full bg-white/20 dark:bg-white/10
                      backdrop-blur-xl text-foreground text-sm font-medium
                      flex items-center justify-center transition-all
                      hover:bg-white/30 dark:hover:bg-white/15 active:scale-[0.98]"
                  >
                    Browse Courses
                  </Link>
                )}
              </div>

              {/* Stats for guests — desktop */}
              {!firstName && (
                <div className="flex items-center gap-8 mt-8 text-xs text-muted-foreground">
                  <div className="flex flex-col items-center">
                    <span className="text-lg font-bold text-foreground">50+</span>
                    <span>Courses</span>
                  </div>
                  <div className="h-6 w-px bg-border" />
                  <div className="flex flex-col items-center">
                    <span className="text-lg font-bold text-foreground">10K+</span>
                    <span>Learners</span>
                  </div>
                  <div className="h-6 w-px bg-border" />
                  <div className="flex flex-col items-center">
                    <span className="text-lg font-bold text-foreground">4.8</span>
                    <span>Avg Rating</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
