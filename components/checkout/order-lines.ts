import {
  AwardIcon,
  ClipboardCheckIcon,
  HandshakeIcon,
  MessagesSquareIcon,
  RadioIcon,
  type LucideIcon,
} from "lucide-react"
import type { ProgramDetail, PublicPackage } from "@/lib/actions/student"
import type { IPackageEntitlements, PackageKey } from "@/lib/db/models"
import { PACKAGE_LABEL } from "@/lib/entitlements"

/**
 * What checkout and the success page may say about an order — pure and
 * client-safe. Everything here is derived from the program's own records;
 * nothing is invented, and a zero is left out rather than printed.
 */

/** Whole-dollar package price: "$199", or "Free". */
export function wholeUsd(price: number): string {
  return price === 0 ? "Free" : `$${price.toLocaleString("en-US")}`
}

/** A wallet figure in cents: "$2,500.00". */
export function centsUsd(minor: number): string {
  return `$${(minor / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** "2h 41m", "45m" — a total video length. Empty for zero. */
export function lengthLabel(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return ""
  const minutes = Math.max(1, Math.round(totalSeconds / 60))
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export const LEVEL_LABEL: Record<ProgramDetail["level"], string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
}

/** How the order line names what is being bought: "Standard · Forex Mastery", or the program's own single price. */
export function packageLine(program: ProgramDetail, pkg: PublicPackage): { label: string | null; name: string } {
  // No ladder: the one synthesized tier is the program itself, not a package.
  if (program.tierCount === 0) return { label: null, name: "Full program" }
  // One enabled tier: it is the program's single price (blueprint §8), so the
  // tier label ("Standard") would describe a choice nobody made.
  if (program.tierCount === 1) return { label: null, name: pkg.name }
  return { label: PACKAGE_LABEL[pkg.key], name: pkg.name }
}

/**
 * A package's feature list, with a leading "Everything in Basic" split off so
 * the page can say it as a lead-in ("Everything in Basic, plus") instead of
 * as one more bullet.
 */
export function splitFeatures(features: string[]): { lead: string | null; rest: string[] } {
  const [first, ...rest] = features
  if (first && /^everything in /i.test(first.trim())) return { lead: first.trim(), rest }
  return { lead: null, rest: features }
}

export type Service = { key: keyof IPackageEntitlements; label: string; icon: LucideIcon }

/** The services a package can grant, in the order a buyer climbs them. */
const SERVICES: readonly Service[] = [
  { key: "liveClasses", label: "Live classes", icon: RadioIcon },
  { key: "instructorQa", label: "Instructor Q&A", icon: MessagesSquareIcon },
  { key: "assignments", label: "Graded assignments", icon: ClipboardCheckIcon },
  { key: "certificate", label: "Certificate of completion", icon: AwardIcon },
  { key: "mentorship", label: "1-on-1 mentorship", icon: HandshakeIcon },
]

/**
 * What this package's entitlements actually deliver — the same rules as the
 * program page's "This program includes":
 *
 *  · A program without a ladder sells one synthesized tier whose
 *    entitlements are FULL_ACCESS — that is ACCESS for a legacy enrollment,
 *    not a list of promises. It lists only what a full enrollment delivers
 *    without anyone scheduling anything: instructor Q&A and the certificate.
 *  · Mentorship is only ever delivered to an Executive enrollment
 *    (`includesMentorship`), so it is listed only there.
 *  · Priority support is a promise the Executive feature list already makes
 *    in words; it is not a thing a learner does, so it is not a service here.
 */
export function packageServices(program: ProgramDetail, pkg: PublicPackage): Service[] {
  if (program.tierCount === 0) {
    return SERVICES.filter((s) => s.key === "instructorQa" || s.key === "certificate")
  }
  return SERVICES.filter((s) => pkg.entitlements[s.key] && (s.key !== "mentorship" || pkg.key === "executive"))
}

/** Services for an enrollment the server has already granted (success page). */
export function grantedServices(
  entitlements: IPackageEntitlements,
  packageKey: PackageKey | null
): Set<keyof IPackageEntitlements> {
  const out = new Set<keyof IPackageEntitlements>()
  for (const s of SERVICES) {
    if (!entitlements[s.key]) continue
    if (s.key === "mentorship" && packageKey !== "executive") continue
    out.add(s.key)
  }
  return out
}
