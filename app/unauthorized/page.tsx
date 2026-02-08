"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"

export default function UnauthorizedPage() {
  const [countdown, setCountdown] = useState(10)

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          window.location.href = "https://worldstreetgold.com"
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Logo at top left */}
      <header className="p-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
            W
          </div>
          <span className="text-lg font-bold tracking-tight">
            World<span className="text-primary">Street</span>
          </span>
        </div>
      </header>

      {/* Main content centered */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-20">
        <div className="max-w-md w-full text-center space-y-8">
          {/* Illustration */}
          <div className="w-64 h-64 mx-auto">
            <Image
              src="/user/dashboard/unauthorized-illustration.png"
              alt="Access Required"
              width={256}
              height={256}
              className="w-full h-auto"
              priority
            />
          </div>

          {/* Header and Tagline */}
          <div className="space-y-3">
            <h1 className="text-2xl font-bold">Right Place, Wrong Time</h1>
            <p className="text-muted-foreground text-sm">
              Sign in to continue your learning journey
            </p>
          </div>

          {/* CTA with countdown */}
          <div className="space-y-3 pt-2">
            <Button 
              size="lg" 
              className="w-full" 
              render={<a href="https://worldstreetgold.com" />}
            >
              Sign In at WorldStreetGold.com
            </Button>
            <p className="text-xs text-muted-foreground">
              Redirecting in {countdown} second{countdown !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
