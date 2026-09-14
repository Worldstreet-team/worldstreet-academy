import Link from "next/link"
import { BrandLockup } from "@/components/shared/brand-lockup"

export function Footer() {
  return (
    <footer className="border-t bg-muted/40">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            {/* Unified ecosystem lockup (05-screens): gold wsa-mark 26px +
                "WorldStreet" Poppins SemiBold 15 + gold app eyebrow. */}
            <Link href="/" className="flex items-center gap-2 mb-4">
              <BrandLockup alt="" />
            </Link>
            <p className="text-sm text-muted-foreground">
              Learn, trade, and grow with the WorldStreet ecosystem.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3">Academy</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/courses" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Browse Courses
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  My Learning
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3">Teach</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/instructor" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Become an Instructor
                </Link>
              </li>
              <li>
                <Link href="/instructor/courses/new" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Create a Course
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3">Legal</h4>
            <ul className="space-y-2">
              <li>
                <span className="text-sm text-muted-foreground">Terms of Service</span>
              </li>
              <li>
                <span className="text-sm text-muted-foreground">Privacy Policy</span>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t">
          <p className="text-sm text-muted-foreground text-center">
            © 2026 WorldStreet. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
