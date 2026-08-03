"use client"

/**
 * Stand-in for `@clerk/nextjs` (client surface), swapped in by next.config.ts
 * when MOCK_AUTH=1. Only what this codebase imports is implemented:
 * ClerkProvider, SignIn, SignUp, useUser, useClerk.
 */

import type { ReactNode } from "react"
import { resolvePersona, type Persona } from "./personas"

const PERSONA_COOKIE = "mock_persona"

function activePersona(): Persona {
  if (typeof document !== "undefined") {
    const match = document.cookie.match(new RegExp(`(?:^|; )${PERSONA_COOKIE}=([^;]*)`))
    if (match) return resolvePersona(decodeURIComponent(match[1]))
  }
  return resolvePersona(process.env.NEXT_PUBLIC_MOCK_PERSONA)
}

export function ClerkProvider({ children }: { children: ReactNode } & Record<string, unknown>) {
  return <>{children}</>
}

type MockUserResource = {
  id: string
  firstName: string
  lastName: string
  imageUrl: string
  fullName: string
  primaryEmailAddress: { emailAddress: string }
  emailAddresses: Array<{ emailAddress: string }>
  publicMetadata: { role: string }
}

function toUserResource(persona: Persona): MockUserResource {
  return {
    id: persona.id,
    firstName: persona.firstName,
    lastName: persona.lastName,
    imageUrl: persona.imageUrl,
    fullName: `${persona.firstName} ${persona.lastName}`,
    primaryEmailAddress: { emailAddress: persona.email },
    emailAddresses: [{ emailAddress: persona.email }],
    publicMetadata: { role: persona.role },
  }
}

export function useUser() {
  return {
    isLoaded: true,
    isSignedIn: true,
    user: toUserResource(activePersona()),
  }
}

export function useAuth() {
  const persona = activePersona()
  return {
    isLoaded: true,
    isSignedIn: true,
    userId: persona.id,
    sessionId: `sess_mock_${persona.key}`,
    getToken: async () => `mock_token_${persona.key}`,
    signOut: async () => {},
  }
}

export function useClerk() {
  return {
    user: toUserResource(activePersona()),
    signOut: async (opts?: { redirectUrl?: string }) => {
      // No session to end — just honour the redirect the caller asked for.
      if (opts?.redirectUrl && typeof window !== "undefined") {
        window.location.href = opts.redirectUrl
      }
    },
    openSignIn: () => {},
    openUserProfile: () => {},
  }
}

/** Placeholder for Clerk's hosted <SignIn />. Mock mode is always signed in. */
export function SignIn() {
  return <MockAuthCard title="Sign in" />
}

/** Placeholder for Clerk's hosted <SignUp />. Mock mode is always signed in. */
export function SignUp() {
  return <MockAuthCard title="Sign up" />
}

function MockAuthCard({ title }: { title: string }) {
  const persona = activePersona()
  return (
    <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Mock auth is on — no real sign-in needed. You are already signed in as{" "}
        <span className="font-medium text-foreground">
          {persona.firstName} {persona.lastName}
        </span>{" "}
        ({persona.role}).
      </p>
      <p className="mt-4 text-xs text-muted-foreground">
        Switch personas with <code className="tabular-nums">MOCK_PERSONA</code> in{" "}
        <code className="tabular-nums">.env.local</code>, or the{" "}
        <code className="tabular-nums">mock_persona</code> cookie.
      </p>
      <a
        href="/dashboard"
        className="mt-5 inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
      >
        Go to dashboard
      </a>
    </div>
  )
}
