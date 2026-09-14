import { z } from "zod/v4"
import { isCountryCode } from "@/lib/countries"

/**
 * Faculty (spec §10): the rules both profile editors share. Pure and
 * client-safe. The editors import the limits and the form type;
 * `lib/actions/profile.ts` and `lib/actions/admin-users.ts` validate with the
 * same schema. It lives here because a "use server" file may only export
 * async functions.
 *
 * Who is faculty: role INSTRUCTOR or ADMIN **and** at least one published
 * course. `isFacultyRole` is the role half; the course half is a query in the
 * FACULTY section of `lib/actions/student.ts`.
 */

export const FACULTY_ROLES = ["INSTRUCTOR", "ADMIN"] as const
export type FacultyRole = (typeof FACULTY_ROLES)[number]

export function isFacultyRole(role: string | null | undefined): role is FacultyRole {
  return role === "INSTRUCTOR" || role === "ADMIN"
}

export const FACULTY_LIMITS = {
  headline: 120,
  specialization: 80,
  bio: 1000,
  experience: 2000,
  expertiseItems: 8,
  expertiseItem: 40,
  credentialItems: 10,
  credentialItem: 120,
  link: 300,
} as const

/** What the editors hold. Text fields are always strings ("" = empty); the schema stores "" as null. */
export type FacultyProfileForm = {
  headline: string
  specialization: string
  bio: string
  experience: string
  expertise: string[]
  credentials: string[]
  country: string | null
  socialLinks: { twitter: string; linkedin: string; website: string }
}

/** An http(s) address with a dotted host, else null — never a javascript: or data: URL. */
export function safeWebUrl(value: string | null | undefined): string | null {
  const v = value?.trim()
  if (!v) return null
  try {
    const url = new URL(v)
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname.includes(".") ? v : null
  } catch {
    return null
  }
}

const n = (value: number) => value.toLocaleString("en-US")
const unique = (items: string[]) => Array.from(new Set(items))

function text(max: number, label: string) {
  return z
    .string()
    .trim()
    .max(max, `${label} must be ${n(max)} characters or less`)
    .nullable()
    .transform((v) => (v ? v : null))
}

function link(label: string) {
  return (
    z
      .string()
      .trim()
      .max(FACULTY_LIMITS.link, `${label} must be ${n(FACULTY_LIMITS.link)} characters or less`)
      .nullable()
      // People paste "linkedin.com/in/you" — assume https when no scheme is given.
      .transform((v) => (v ? (/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`) : null))
      .refine((v) => v === null || safeWebUrl(v) !== null, `${label} must be a web address`)
  )
}

export const FacultyProfileSchema = z.object({
  headline: text(FACULTY_LIMITS.headline, "Headline"),
  specialization: text(FACULTY_LIMITS.specialization, "Area of specialization"),
  bio: text(FACULTY_LIMITS.bio, "Short biography"),
  experience: text(FACULTY_LIMITS.experience, "Professional experience"),
  expertise: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Remove the blank area of expertise")
        .max(FACULTY_LIMITS.expertiseItem, `Each area of expertise must be ${FACULTY_LIMITS.expertiseItem} characters or less`)
    )
    .max(FACULTY_LIMITS.expertiseItems, `Add at most ${FACULTY_LIMITS.expertiseItems} areas of expertise`)
    .transform(unique),
  credentials: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Remove the blank credential")
        .max(FACULTY_LIMITS.credentialItem, `Each credential must be ${FACULTY_LIMITS.credentialItem} characters or less`)
    )
    .max(FACULTY_LIMITS.credentialItems, `Add at most ${FACULTY_LIMITS.credentialItems} credentials`)
    .transform(unique),
  country: z
    .string()
    .nullable()
    .refine((v) => v === null || isCountryCode(v), "Choose a country from the list"),
  socialLinks: z.object({
    twitter: link("X (Twitter)"),
    linkedin: link("LinkedIn"),
    website: link("Website"),
  }),
})

/** The admin dialog's schema: the same profile plus the curation flag. */
export const AdminFacultyProfileSchema = FacultyProfileSchema.extend({ featured: z.boolean() })

export type FacultyProfileValues = z.output<typeof FacultyProfileSchema>

/** First validation message, for the `{ success: false, error }` action shape. */
export function firstFacultyError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the profile and try again"
}

/**
 * The targeted `$set` a validated profile writes. Dotted `instructorProfile.*`
 * paths leave the counters (totalStudents, totalCourses, totalEarnings),
 * `featured`, and anything the Go backend stored untouched. Empty social links
 * are dropped, never stored as null.
 */
export function facultyProfileSet(values: FacultyProfileValues): Record<string, unknown> {
  const { twitter, linkedin, website } = values.socialLinks
  return {
    bio: values.bio,
    country: values.country,
    "instructorProfile.headline": values.headline,
    "instructorProfile.specialization": values.specialization,
    "instructorProfile.experience": values.experience,
    "instructorProfile.expertise": values.expertise,
    "instructorProfile.credentials": values.credentials,
    "instructorProfile.socialLinks": {
      ...(twitter ? { twitter } : {}),
      ...(linkedin ? { linkedin } : {}),
      ...(website ? { website } : {}),
    },
  }
}

type FacultySource = {
  bio?: string | null
  country?: string | null
  instructorProfile?: {
    headline?: string | null
    specialization?: string | null
    experience?: string | null
    expertise?: string[] | null
    credentials?: string[] | null
    socialLinks?: { twitter?: string | null; linkedin?: string | null; website?: string | null } | null
  } | null
}

/** A stored user (lean or hydrated) as editor state. Legacy rows missing Phase 5 fields read as empty. */
export function facultyFormFrom(user: FacultySource): FacultyProfileForm {
  const profile = user.instructorProfile
  return {
    headline: profile?.headline ?? "",
    specialization: profile?.specialization ?? "",
    bio: user.bio ?? "",
    experience: profile?.experience ?? "",
    expertise: [...(profile?.expertise ?? [])],
    credentials: [...(profile?.credentials ?? [])],
    country: isCountryCode(user.country) ? user.country : null,
    socialLinks: {
      twitter: profile?.socialLinks?.twitter ?? "",
      linkedin: profile?.socialLinks?.linkedin ?? "",
      website: profile?.socialLinks?.website ?? "",
    },
  }
}

/** Public profile URL. Usernames are unique but not guaranteed URL-safe (mobile-created rows), so encode. */
export function facultyHref(username: string): string {
  return `/faculty/${encodeURIComponent(username)}`
}

export function facultyInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}
