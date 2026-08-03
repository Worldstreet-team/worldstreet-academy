"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Mascot } from "@/components/platform/mascot"
import { ArtCourses, ArtCertificate } from "@/components/shared/illustrations"
import { completeOnboarding } from "@/lib/actions/onboarding"
import { onboardingSteps } from "./onboarding-steps"
import {
  ACADEMY_ACCENT,
  ACADEMY_ACCENT_WASH,
  CONTROL_H,
  GOLD,
  HAIRLINE_DARK,
  ON_GOLD,
  RADIUS_LG,
  RADIUS_SM,
  STONE_MUTED,
  STONE_SUNKEN,
  STONE_SURFACE,
  STONE_TEXT,
} from "./ds"
import { LoaderCircleIcon } from "lucide-react"

type OnboardingModalProps = {
  userName: string
}

/**
 * First-run onboarding, presented over the real dashboard rather than on a
 * page of its own — the user sees what they're being introduced to behind the
 * blur. Pinned to the design system's dark stone surfaces regardless of the
 * Academy's light/dark setting, per "dark theme is the app default".
 */
export function OnboardingModal({ userName }: OnboardingModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(true)
  const [current, setCurrent] = useState(0)
  const [isFinishing, setIsFinishing] = useState(false)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  const step = onboardingSteps[current]
  const isLast = current === onboardingSteps.length - 1
  const isFirst = current === 0

  const finish = useCallback(async () => {
    if (isFinishing) return
    setIsFinishing(true)
    await completeOnboarding()
    setOpen(false)
    // Re-fetch the server component tree so the layout stops rendering this.
    router.refresh()
  }, [router, isFinishing])

  const goNext = useCallback(() => {
    if (isFinishing) return
    if (isLast) {
      finish()
      return
    }
    setCurrent((p) => p + 1)
  }, [isLast, isFinishing, finish])

  const goBack = useCallback(() => {
    if (isFirst || isFinishing) return
    setCurrent((p) => p - 1)
  }, [isFirst, isFinishing])

  // Lock the page behind the modal so the blurred dashboard can't be scrolled.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  useEffect(() => {
    primaryRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") goNext()
      if (e.key === "ArrowLeft") goBack()
      if (e.key === "Escape") finish()
      // Keep focus inside the dialog while it owns the screen.
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [open, goNext, goBack, finish])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-[var(--ws-motion-base)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      {/* Scrim — the standard modal scrim token, no blur */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "var(--ws-overlay-scrim)" }}
      />

      <div
        ref={dialogRef}
        className="relative w-full max-w-4xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-[var(--ws-motion-base)]"
        style={{
          backgroundColor: STONE_SURFACE,
          border: `1px solid ${HAIRLINE_DARK}`,
          borderRadius: RADIUS_LG,
          color: STONE_TEXT,
        }}
      >
        {/* Skip */}
        {!isLast && (
          <button
            onClick={finish}
            disabled={isFinishing}
            className="absolute right-4 top-4 z-10 px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40"
            style={{ color: STONE_MUTED, borderRadius: RADIUS_SM }}
          >
            Skip
          </button>
        )}

        <div className="grid md:grid-cols-[1.05fr_0.95fr]">
          {/* Copy */}
          <div className="order-2 flex flex-col justify-center p-7 sm:p-9 md:order-1 md:min-h-[24rem] md:p-10">
            {isFirst ? (
              <p className="mb-3 text-[15px]" style={{ color: STONE_MUTED }}>
                Hi, {userName}
              </p>
            ) : (
              <span
                className="mb-3 inline-flex w-fit items-center px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em]"
                style={{
                  color: ACADEMY_ACCENT,
                  backgroundColor: ACADEMY_ACCENT_WASH,
                  borderRadius: RADIUS_SM,
                }}
              >
                WorldStreet Academy
              </span>
            )}

            <div key={current} className="animate-in fade-in slide-in-from-bottom-2 duration-[var(--ws-motion-base)]">
              <h2
                id="onboarding-title"
                className="font-display text-2xl font-extrabold leading-[1.1] tracking-[-0.02em] text-balance sm:text-3xl"
              >
                {step.tagline}
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed" style={{ color: STONE_MUTED }}>
                {step.subtitleDesktop}
              </p>
            </div>

            <div className="mt-8 flex items-center gap-3">
              {!isFirst && (
                <button
                  onClick={goBack}
                  aria-label="Previous"
                  disabled={isFinishing}
                  className="flex flex-shrink-0 items-center justify-center transition-colors disabled:opacity-40"
                  style={{
                    height: CONTROL_H,
                    width: CONTROL_H,
                    borderRadius: RADIUS_SM,
                    border: `1px solid ${HAIRLINE_DARK}`,
                    color: STONE_MUTED,
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                </button>
              )}

              <button
                ref={primaryRef}
                onClick={goNext}
                disabled={isFinishing}
                className="flex items-center justify-center gap-2 px-8 text-base font-semibold transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ws-surface"
                style={{
                  height: CONTROL_H,
                  borderRadius: RADIUS_SM,
                  backgroundColor: GOLD,
                  color: ON_GOLD,
                }}
              >
                {isFinishing && (
                  <LoaderCircleIcon  size={18} className="animate-spin" />
                )}
                {isLast ? (isFinishing ? "Setting up…" : "Get Started") : "Continue"}
              </button>

              <div className="ml-1 flex items-center gap-2">
                {onboardingSteps.map((_, i) => (
                  <div
                    key={i}
                    className="h-1.5 transition-all duration-[var(--ws-motion-base)]"
                    style={{
                      width: i === current ? 24 : 6,
                      borderRadius: 999,
                      backgroundColor: i === current ? GOLD : "rgba(255,255,255,0.18)",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Illustration panel */}
          <div
            className="relative order-1 flex items-center justify-center overflow-hidden border-b border-white/10 p-6 md:order-2 md:border-b-0 md:border-l md:p-8"
            style={{ backgroundColor: STONE_SUNKEN }}
          >
            <div
              className="absolute inset-[18%] rounded-full blur-[64px] opacity-70"
              style={{ backgroundColor: ACADEMY_ACCENT_WASH }}
            />
            <div className="relative h-40 w-40 sm:h-52 sm:w-52 md:h-[19rem] md:w-[19rem]">
              {onboardingSteps.map((s, i) => (
                <div
                  key={i}
                  className="absolute inset-0 transition-all duration-[var(--ws-motion-base)] ease-out"
                  style={{
                    opacity: i === current ? 1 : 0,
                    transform:
                      i === current
                        ? "translateX(0) scale(1)"
                        : i < current
                          ? "translateX(-16%) scale(0.95)"
                          : "translateX(16%) scale(0.95)",
                    pointerEvents: i === current ? "auto" : "none",
                  }}
                >
                  <div className="flex h-full w-full items-center justify-center">
                    {s.art === "mascot" ? (
                      <Mascot className="h-[85%] w-[85%]" />
                    ) : s.art === "courses" ? (
                      <ArtCourses className="h-full w-full" />
                    ) : (
                      <ArtCertificate className="h-full w-full" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
