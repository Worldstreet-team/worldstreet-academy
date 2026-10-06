"use client"
import { Plus } from "@/components/icons"

import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Topbar } from "@/components/platform/topbar"
import { PageHeader } from "@/components/shared/page-header"
import { useUser } from "@/components/providers/user-provider"
import { OnboardingChecklist } from "@/components/instructor/onboarding-checklist"
import { TeachingHome } from "@/components/instructor/home/teaching-home"

/**
 * The tutor home (faculty only — the layout sends an approved seller to
 * /instructor/courses): plan classes, see the week, go live. Each program
 * they teach is a cohort. Gold stays on the one primary action, the hero's
 * Start class, so "New course" is an outline button here.
 */
export default function InstructorDashboard() {
  const user = useUser()

  return (
    <>
      <Topbar title="Instructor Dashboard" variant="instructor" />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-7xl space-y-6">
          <PageHeader
            title={user.firstName ? `Welcome back, ${user.firstName}` : "Welcome back"}
            subline="Plan your classes, see your week and go live."
            action={
              <Button
                variant="outline"
                render={<Link href="/instructor/courses/new" />}
                className="hidden h-10 rounded-full px-4 md:inline-flex"
              >
                <Plus size={16} strokeWidth={2} aria-hidden />
                New course
              </Button>
            }
          />

          {/* Post-approval onboarding (hides itself when complete) */}
          <OnboardingChecklist />

          <TeachingHome />
        </div>
      </div>
    </>
  )
}
