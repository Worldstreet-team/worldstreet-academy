/**
 * Stand-in for `@clerk/nextjs/server`, swapped in by next.config.ts when
 * MOCK_AUTH=1. Everyone is always signed in as the active persona, so the
 * whole app is reachable without a Clerk instance.
 *
 * Only the surface this codebase actually imports is implemented:
 * auth, currentUser, clerkMiddleware, createRouteMatcher, clerkClient.
 */

import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server"
import { resolvePersona, type Persona } from "./personas"

const PERSONA_COOKIE = "mock_persona"

/**
 * Active persona. Prefers the `mock_persona` cookie (switch personas without
 * a restart) and falls back to MOCK_PERSONA from the environment.
 * next/headers is imported lazily because it is unavailable in middleware.
 */
/** `mock_persona=guest` simulates a signed-out visitor (landing page, public
 * catalog, sign-in buttons) — otherwise mock mode can never be logged out. */
async function isGuest(): Promise<boolean> {
  try {
    const { cookies } = await import("next/headers")
    return (await cookies()).get(PERSONA_COOKIE)?.value === "guest"
  } catch {
    return process.env.MOCK_PERSONA === "guest"
  }
}

async function activePersona(): Promise<Persona> {
  try {
    const { cookies } = await import("next/headers")
    const jar = await cookies()
    const fromCookie = jar.get(PERSONA_COOKIE)?.value
    if (fromCookie) return resolvePersona(fromCookie)
  } catch {
    // Not in a request scope (middleware, build) — fall through to env.
  }
  return resolvePersona(process.env.MOCK_PERSONA)
}

function personaFromRequest(request: NextRequest): Persona {
  const fromCookie = request.cookies.get(PERSONA_COOKIE)?.value
  return resolvePersona(fromCookie ?? process.env.MOCK_PERSONA)
}

export type MockAuthObject = {
  userId: string
  sessionId: string
  sessionClaims: Record<string, unknown>
  orgId: null
  getToken: () => Promise<string>
  redirectToSignIn: () => Response
}

function authObjectFor(persona: Persona): MockAuthObject {
  return {
    userId: persona.id,
    sessionId: `sess_mock_${persona.key}`,
    sessionClaims: { role: persona.role },
    orgId: null,
    getToken: async () => `mock_token_${persona.key}`,
    redirectToSignIn: () => NextResponse.redirect("http://localhost:3000/login"),
  }
}

export async function auth(): Promise<MockAuthObject | { userId: null }> {
  if (await isGuest()) {
    return { userId: null } as unknown as MockAuthObject
  }
  return authObjectFor(await activePersona())
}

export type MockClerkUser = {
  id: string
  firstName: string
  lastName: string
  imageUrl: string
  createdAt: number
  publicMetadata: { role: string }
  emailAddresses: Array<{
    emailAddress: string
    verification: { status: string }
  }>
}

export async function currentUser(): Promise<MockClerkUser | null> {
  if (await isGuest()) return null
  const persona = await activePersona()
  return {
    id: persona.id,
    firstName: persona.firstName,
    lastName: persona.lastName,
    imageUrl: persona.imageUrl,
    createdAt: Date.UTC(2024, 0, 1),
    publicMetadata: { role: persona.role },
    emailAddresses: [
      {
        emailAddress: persona.email,
        verification: { status: "verified" },
      },
    ],
  }
}

/**
 * Turns Clerk's path patterns ("/dashboard(.*)") into a matcher. The patterns
 * this repo uses are already regex-shaped, so they only need anchoring.
 */
export function createRouteMatcher(patterns: string[]) {
  const regexes = patterns.map((p) => new RegExp(`^${p}$`))
  return (request: NextRequest): boolean => {
    const { pathname } = request.nextUrl
    return regexes.some((re) => re.test(pathname))
  }
}

type MiddlewareHandler = (
  auth: () => Promise<MockAuthObject>,
  request: NextRequest,
  event: NextFetchEvent
) => Response | undefined | Promise<Response | undefined>

export function clerkMiddleware(
  handler: MiddlewareHandler,
  _options?: unknown
) {
  return async (request: NextRequest, event: NextFetchEvent): Promise<Response> => {
    const guest = request.cookies.get(PERSONA_COOKIE)?.value === "guest"
    const persona = personaFromRequest(request)
    const authFn = async () =>
      guest ? ({ userId: null } as unknown as MockAuthObject) : authObjectFor(persona)
    const result = await handler(authFn, request, event)
    return result ?? NextResponse.next()
  }
}

export async function clerkClient() {
  return {
    users: {
      // Role writes are a no-op: Mongo is authoritative and there is no Clerk.
      updateUserMetadata: async (userId: string, params: unknown) => {
        console.log("[mock-clerk] updateUserMetadata", userId, params)
        return { id: userId }
      },
    },
  }
}
