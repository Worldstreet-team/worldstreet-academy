"use client"

import Image from "next/image"
import Link from "next/link"
import { MarqueeBackground } from "./marquee-background"
import { OnboardingFlow } from "./onboarding-flow"

type WelcomePageClientProps = {
  firstName: string
  hasOnboarded: boolean
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
}: WelcomePageClientProps) {
  // Not onboarded → show the onboarding carousel
  if (!hasOnboarded) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        <MarqueeBackground />
        <OnboardingFlow
          userName={firstName || "there"}
          onComplete={() => {}}
          showSetupLoading
        />
      </div>
    )
  }

  // Onboarded → welcome-back screen
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <MarqueeBackground />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Logo */}
        <div className="absolute top-5 left-5 z-20 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xs">
            W
          </div>
          <span className="text-sm font-semibold tracking-tight hidden sm:inline">
            World<span className="text-primary">Street</span>
          </span>
        </div>

        {/* ====== MOBILE ====== */}
        <div className="flex flex-col flex-1 lg:hidden">
          <div className="flex-1" />
          <div className="flex flex-col items-center text-center px-6 pb-12 pt-4
            animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="relative w-52 h-52 sm:w-60 sm:h-60 mb-5">
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

            <p className="text-muted-foreground text-sm mb-1">
              {getGreeting()}, {firstName} 👋
            </p>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight mb-1 text-balance">
              Ready to learn?
            </h1>
            <p className="text-muted-foreground text-xs max-w-[280px] mb-8 text-balance leading-relaxed">
              Pick up where you left off and keep growing.
            </p>

            <div className="flex flex-col gap-3 w-full max-w-xs">
              <Link
                href="/dashboard"
                className="w-full h-12 rounded-full bg-primary text-primary-foreground
                  text-sm font-semibold tracking-wide flex items-center justify-center
                  transition-all hover:opacity-90 active:scale-[0.98]"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        </div>

        {/* ====== DESKTOP ====== */}
        <div className="hidden lg:grid lg:grid-cols-2 flex-1 items-end pb-12 px-12 xl:px-16 gap-12">
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

          <div className="flex flex-col items-start justify-end text-left
            animate-in fade-in slide-in-from-right-6 duration-700">
            <p className="text-muted-foreground text-sm mb-2">
              {getGreeting()}, {firstName} 👋
            </p>
            <h1 className="text-3xl xl:text-4xl font-bold tracking-tight mb-3 text-balance">
              Welcome back
            </h1>
            <p className="text-muted-foreground text-sm xl:text-base leading-relaxed max-w-md">
              Your courses are waiting. Continue where you left off or discover something new to sharpen your edge.
            </p>

            <div className="flex items-center gap-3 mt-8 w-full max-w-sm">
              <Link
                href="/dashboard"
                className="h-12 px-10 rounded-full bg-primary text-primary-foreground
                  text-sm font-semibold tracking-wide flex items-center justify-center
                  transition-all hover:opacity-90 active:scale-[0.98]"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
