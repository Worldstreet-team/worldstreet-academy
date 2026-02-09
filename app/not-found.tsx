"use client"

import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Logo at top left */}
      <header className="p-6">
        <Link href="/" className="flex items-center gap-2 w-fit">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
            W
          </div>
          <span className="text-lg font-bold tracking-tight">
            World<span className="text-primary">Street</span>
          </span>
        </Link>
      </header>

      {/* Main content centered */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-20">
        <div className="max-w-md w-full text-center space-y-8">
          {/* Illustration */}
          <div className="w-64 h-64 mx-auto">
            <Image
              src="/user/dashboard/unauthorized-illustration.png"
              alt="Page not found"
              width={256}
              height={256}
              className="w-full h-auto"
              priority
            />
          </div>

          {/* Header and Tagline */}
          <div className="space-y-3">
            <h1 className="text-2xl font-bold">Oops! Lost in Space</h1>
            <p className="text-muted-foreground text-sm">
              This page doesn&apos;t exist. Let&apos;s get you back on track.
            </p>
          </div>

          {/* CTA */}
          <div className="pt-2">
            <Button 
              size="lg" 
              className="w-full" 
              render={<a href="https://worldstreetgold.com" />}
            >
              Go to WorldStreetGold.com
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
