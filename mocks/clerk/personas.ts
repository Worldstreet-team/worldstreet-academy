/**
 * Fake sign-in identities for MOCK_AUTH mode.
 *
 * `student` and `instructor` match the accounts created by `scripts/seed.ts`,
 * so syncUserToLocal resolves them by email and adopts the seeded profile.
 * `admin` has no seeded row — it is created on first request and upgraded to
 * ADMIN through the normal "Clerk may upgrade a USER" path in lib/auth/sync.ts.
 */

export type PersonaKey = "student" | "instructor" | "admin"

export type Persona = {
  key: PersonaKey
  id: string
  email: string
  firstName: string
  lastName: string
  /** Lowercase role claim, exactly as Clerk publicMetadata would carry it. */
  role: "user" | "instructor" | "admin"
  imageUrl: string
}

export const PERSONAS: Record<PersonaKey, Persona> = {
  student: {
    key: "student",
    id: "user_mock_student",
    email: "student@worldstreet.academy",
    firstName: "Johnson",
    lastName: "Demo",
    role: "user",
    imageUrl:
      "https://api.dicebear.com/9.x/notionists/svg?seed=Johnson%20Demo&backgroundColor=b6e3f4&backgroundType=gradientLinear",
  },
  instructor: {
    key: "instructor",
    id: "user_mock_instructor",
    email: "instructor@worldstreet.academy",
    firstName: "Sarah",
    lastName: "Chen",
    role: "instructor",
    imageUrl:
      "https://api.dicebear.com/9.x/notionists/svg?seed=Sarah%20Chen&backgroundColor=ffd5dc&backgroundType=gradientLinear",
  },
  admin: {
    key: "admin",
    id: "user_mock_admin",
    email: "admin@worldstreet.academy",
    firstName: "Ada",
    lastName: "Admin",
    role: "admin",
    imageUrl:
      "https://api.dicebear.com/9.x/notionists/svg?seed=Ada%20Admin&backgroundColor=c0aede&backgroundType=gradientLinear",
  },
}

export const DEFAULT_PERSONA: PersonaKey = "student"

export function resolvePersona(key?: string | null): Persona {
  if (key && key in PERSONAS) return PERSONAS[key as PersonaKey]
  return PERSONAS[DEFAULT_PERSONA]
}

/** Every mock id, so the middleware can treat any of them as signed in. */
export const MOCK_USER_IDS = Object.values(PERSONAS).map((p) => p.id)
