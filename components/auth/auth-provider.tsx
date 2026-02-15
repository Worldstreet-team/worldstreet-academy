"use client"

import { useUser as useClerkUser, useClerk } from "@clerk/nextjs"
import {
  createContext,
  useContext,
  type ReactNode,
} from "react"

type AuthContextType = {
  user: {
    id: string
    email: string
    firstName: string
    lastName: string
    imageUrl: string | null
  } | null
  isLoading: boolean
  isAuthenticated: boolean
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

type AuthProviderProps = {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { user: clerkUser, isLoaded } = useClerkUser()
  const { signOut } = useClerk()

  const user = clerkUser
    ? {
        id: clerkUser.id,
        email: clerkUser.emailAddresses[0]?.emailAddress || "",
        firstName: clerkUser.firstName || "",
        lastName: clerkUser.lastName || "",
        imageUrl: clerkUser.imageUrl || null,
      }
    : null

  const logout = async () => {
    await signOut()
    window.location.href = "https://www.worldstreetgold.com/login"
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading: !isLoaded,
        isAuthenticated: !!clerkUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export function useRequireAuth() {
  const { user, isLoading, isAuthenticated } = useAuth()
  return { user, isLoading, isAuthenticated }
}

export function useGuestOnly() {
  const { user, isLoading, isAuthenticated } = useAuth()
  return { user, isLoading, isAuthenticated }
}
