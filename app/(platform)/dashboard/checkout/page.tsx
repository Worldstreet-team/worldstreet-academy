"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { Topbar } from "@/components/platform/topbar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useUser } from "@/components/providers/user-provider"
import { purchaseCourse, checkEnrollment } from "@/lib/actions/enrollments"
import { getMyWalletBalance, type MyWalletBalance } from "@/lib/actions/wallet"
import { fetchPublicCourse, type PublicCourse } from "@/lib/actions/student"
import { BookOpenIcon, ChevronLeftIcon, CircleCheckIcon, ClockIcon, LoaderCircleIcon, ShieldCheckIcon, UsersIcon } from "lucide-react"

export default function CheckoutPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const user = useUser()

  const courseId = searchParams.get("courseId")
  const [course, setCourse] = useState<PublicCourse | null>(null)
  const [wallet, setWallet] = useState<MyWalletBalance | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shortfallMinor, setShortfallMinor] = useState<number | null>(null)

  useEffect(() => {
    if (!courseId) {
      setIsLoading(false)
      return
    }
    // Fetch course, enrollment state and central wallet balance in parallel
    Promise.all([
      fetchPublicCourse(courseId),
      user ? checkEnrollment(user.id, courseId) : Promise.resolve({ isEnrolled: false }),
      getMyWalletBalance(),
    ]).then(([c, enrollment, walletBalance]) => {
      if (enrollment.isEnrolled) {
        // Already enrolled — skip checkout entirely
        router.replace(`/dashboard/checkout/success?courseId=${courseId}`)
        return
      }
      setCourse(c)
      setWallet(walletBalance)
      setIsLoading(false)
    })
  }, [courseId, user, router])

  function openFunding() {
    if (!wallet) return
    // Internal wallet deposit page (default): navigate in-tab with the
    // shortfall prefilled and a redirect straight back to this checkout.
    if (wallet.fundingUrl.startsWith("/")) {
      const returnTo =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : `/dashboard/checkout?courseId=${courseId}`
      const params = new URLSearchParams({ redirect: returnTo })
      if (shortfallMinor && shortfallMinor > 0) params.set("suggestMinor", String(shortfallMinor))
      router.push(`${wallet.fundingUrl}?${params.toString()}`)
      return
    }
    // External override (central dashboard) — keep the legacy new-tab flow.
    const returnTo = typeof window !== "undefined" ? window.location.href : ""
    const url = `${wallet.fundingUrl}${wallet.fundingUrl.includes("?") ? "&" : "?"}redirect=${encodeURIComponent(returnTo)}`
    window.open(url, "_blank", "noopener")
  }

  async function handlePurchase() {
    if (!course || !user) return
    setIsProcessing(true)
    setError(null)
    setShortfallMinor(null)

    try {
      // The server derives identity from the session and price from the course
      // record; enrollment is only granted after the central Worldstreet wallet
      // confirms the debit. No optimistic success.
      const result = await purchaseCourse(course.id)

      if (result.success) {
        setIsSuccess(true)
        router.push(`/dashboard/checkout/success?courseId=${course.id}`)
      } else {
        if (result.code === "insufficient_funds") {
          setShortfallMinor(result.shortfallMinor ?? null)
          setError(null)
          // Refresh the displayed balance to what the wallet reported
          getMyWalletBalance().then(setWallet)
        } else {
          setError(result.error || "Something went wrong")
        }
        setIsProcessing(false)
      }
    } catch {
      setError("Something went wrong. You have not been charged.")
      setIsProcessing(false)
    }
  }

  if (isLoading) {
    return (
      <>
        <Topbar title="Checkout" />
        <div className="flex-1 flex items-center justify-center">
          <LoaderCircleIcon  size={24} className="animate-spin text-muted-foreground" />
        </div>
      </>
    )
  }

  if (!course || !courseId) {
    return (
      <>
        <Topbar title="Checkout" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">Course not found</p>
            <Button variant="outline" onClick={() => router.back()}>
              Go Back
            </Button>
          </div>
        </div>
      </>
    )
  }

  const price = course.pricing === "free" ? 0 : (course.price ?? 0)
  const totalHours = Math.floor(course.totalDuration / 60)
  const totalMins = course.totalDuration % 60
  const durationLabel = totalHours > 0 ? `${totalHours}h ${totalMins}m` : `${totalMins}m`

  return (
    <>
      <Topbar title="Checkout" />
      <div className="flex-1 overflow-y-auto pb-24 md:pb-8">
        <div className="max-w-lg mx-auto px-4 md:px-6 py-8 space-y-6">
          {/* Back */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeftIcon  size={14} />
            Back to course
          </button>

          {/* Course Summary Card */}
          <div className="rounded-lg border border-ws-hairline bg-card overflow-hidden">
            {/* Thumbnail */}
            <div className="relative aspect-[21/9] bg-muted">
              {course.thumbnailUrl ? (
                <Image
                  src={course.thumbnailUrl}
                  alt={course.title}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <BookOpenIcon  size={32} className="text-muted-foreground/30" />
                </div>
              )}
            </div>

            <div className="p-4 space-y-3">
              <div>
                <h1 className="text-base font-semibold">{course.title}</h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  by {course.instructorName}
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <BookOpenIcon  size={12} />
                  {course.totalLessons} lessons
                </span>
                <span className="flex items-center gap-1">
                  <ClockIcon  size={12} />
                  {durationLabel}
                </span>
                <span className="flex items-center gap-1">
                  <UsersIcon  size={12} />
                  {course.enrolledCount.toLocaleString()} students
                </span>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="rounded-lg border border-ws-hairline bg-card p-4 space-y-4">
            <h2 className="text-sm font-semibold">Order Summary</h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Course price</span>
                <span className="font-medium">
                  {price === 0 ? "Free" : `$${price.toFixed(2)}`}
                </span>
              </div>
              {price > 0 && wallet?.enabled && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Worldstreet balance</span>
                  <span
                    className={`font-medium ${wallet.usdAvailable >= price ? "" : "text-ws-danger"}`}
                  >
                    ${wallet.usdAvailable.toFixed(2)}
                  </span>
                </div>
              )}
              <Separator />
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">Total</span>
                <span className="text-lg font-bold">
                  ${price.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Secure checkout note */}
          <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground/60">
            <ShieldCheckIcon  size={13} />
            <span>
              {price === 0
                ? "Secure checkout"
                : "Paid from your Worldstreet wallet — funding & withdrawals live on the Worldstreet dashboard"}
            </span>
          </div>

          {/* Insufficient funds */}
          {shortfallMinor !== null && (
            <div className="rounded-lg bg-ws-warning/10 border border-ws-warning/20 px-4 py-3 space-y-2">
              <p className="text-sm font-medium text-ws-warning dark:text-ws-warning">
                Insufficient balance
              </p>
              <p className="text-xs text-muted-foreground">
                You need ${(shortfallMinor / 100).toFixed(2)} more in your Worldstreet wallet to buy
                this course. Top up on the Worldstreet dashboard, then come back — your order will
                still be here.
              </p>
              <Button variant="outline" size="sm" className="w-full" onClick={openFunding}>
                Fund my Worldstreet wallet
              </Button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-ws-danger/10 border border-ws-danger/20 px-4 py-3">
              <p className="text-sm text-ws-danger">{error}</p>
            </div>
          )}

          {/* CTA */}
          <Button
            onClick={handlePurchase}
            disabled={isProcessing || isSuccess}
            className="w-full h-12 text-sm font-semibold gap-2"
            size="lg"
          >
            {isSuccess ? (
              <>
                <CircleCheckIcon  size={16} />
                Enrolled! Redirecting...
              </>
            ) : isProcessing ? (
              <>
                <LoaderCircleIcon  size={16} className="animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CircleCheckIcon  size={16} />
                {price === 0 ? "Enroll for Free" : `Pay $${price.toFixed(2)}`}
              </>
            )}
          </Button>
        </div>
      </div>
    </>
  )
}
