import Link from "next/link"
import { BrandLockup } from "@/components/shared/brand-lockup"
import { BRAND } from "@/lib/brand"

/**
 * The ecosystem's legal documents, published by the WorldStreet hub
 * (https://www.worldstreetgold.com/legal — "each one applies across all nine
 * platforms on a single login"). The Academy links them and keeps no copy of
 * its own. These are the hub footer's own hrefs, URL-encoded; if the hub
 * renames a file, update it here and in docs/launch-runbook.md §4.
 */
const LEGAL_LINKS = [
  { label: "Terms of Business", href: "https://www.worldstreetgold.com/legal-docs/WS%20Terms%20of%20Business.pdf" },
  { label: "Privacy Policy", href: "https://www.worldstreetgold.com/legal-docs/Privacy%20Policy.pdf" },
  { label: "Cookie Policy", href: "https://www.worldstreetgold.com/legal-docs/WS%20Cookie%20Policy%201.pdf" },
  { label: "All legal documents", href: "https://www.worldstreetgold.com/legal" },
] as const

export function Footer({ showFaculty }: { showFaculty: boolean }) {
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
              {BRAND.tagline}
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3">Academy</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/schools" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Schools
                </Link>
              </li>
              <li>
                <Link href="/programs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Programs
                </Link>
              </li>
              {/* Only when faculty exists (spec §10) — never a link to an empty page */}
              {showFaculty && (
                <li>
                  <Link href="/faculty" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Faculty
                  </Link>
                </li>
              )}
              <li>
                <Link href="/#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  FAQ
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
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
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
