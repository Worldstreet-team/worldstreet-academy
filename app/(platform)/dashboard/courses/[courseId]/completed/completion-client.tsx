"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import confetti from "canvas-confetti"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Home01Icon,
  Certificate01Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"

interface CourseCompletionClientProps {
  courseTitle: string
  courseId: string
}

export function CourseCompletionClient({
  courseTitle,
  courseId,
}: CourseCompletionClientProps) {
  const confettiTimeout = useRef<NodeJS.Timeout | null>(null)
  const confettiInterval = useRef<NodeJS.Timeout | null>(null)

  // Gradual confetti effect - like hand-held confetti pouring down slowly
  useEffect(() => {
    // Small bursts of confetti falling slowly from top
    const fireConfettiGradually = () => {
      const duration = 4000 // Total animation duration
      const animationEnd = Date.now() + duration
      
      // Create interval to continuously drop small amounts of confetti
      confettiInterval.current = setInterval(() => {
        if (Date.now() > animationEnd) {
          if (confettiInterval.current) clearInterval(confettiInterval.current)
          return
        }

        // Fire small bursts from random positions along the top
        const startPositionX = Math.random() * 0.8 + 0.1 // Random position between 10% and 90%
        
        confetti({
          particleCount: 3, // Small amount per burst
          angle: 90, // Straight down
          spread: 30, // Slight spread
          startVelocity: 20, // Slow fall
          decay: 0.92, // Slower decay for gradual fall
          gravity: 0.6, // Gentle gravity
          drift: 0, // No horizontal drift
          ticks: 200, // Longer life
          origin: {
            x: startPositionX,
            y: 0, // From the top
          },
          colors: ['#FFD700', '#FFA500', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'],
          shapes: ['circle', 'square'],
          scalar: 0.8, // Smaller particles
        })
      }, 150) // Fire every 150ms for gradual effect
    }

    // Start confetti after a short delay
    confettiTimeout.current = setTimeout(() => {
      fireConfettiGradually()
    }, 300)

    // Cleanup
    return () => {
      if (confettiTimeout.current) clearTimeout(confettiTimeout.current)
      if (confettiInterval.current) clearInterval(confettiInterval.current)
    }
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <div className="w-full max-w-lg space-y-6 text-center">
        {/* Illustration */}
        <div className="flex justify-center">
          <div className="relative w-64 h-64">
            <Image
              src="/user/dashboard/course-completion.png"
              alt="Course Completed"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* Content */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 text-primary">
            <HugeiconsIcon icon={SparklesIcon} size={24} />
            <h1 className="text-3xl font-bold">Congratulations!</h1>
            <HugeiconsIcon icon={SparklesIcon} size={24} />
          </div>
          
          <h2 className="text-xl font-semibold">
            Course Completed
          </h2>
          
          <p className="text-muted-foreground max-w-md mx-auto">
            You&apos;ve successfully completed <span className="font-semibold text-foreground">&ldquo;{courseTitle}&rdquo;</span>. 
            You&apos;re one step closer to mastering your skills. Keep up the amazing work!
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-4">
          <Button
            size="lg"
            className="w-full gap-2"
            render={<Link href={`/dashboard/courses/${courseId}/certificate`} />}
          >
            <HugeiconsIcon icon={Certificate01Icon} size={20} />
            View Certificate
          </Button>
          
          <Button
            variant="outline"
            size="lg"
            className="w-full gap-2"
            render={<Link href="/dashboard" />}
          >
            <HugeiconsIcon icon={Home01Icon} size={20} />
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  )
}
