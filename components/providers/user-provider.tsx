"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { LocalUser } from "@/lib/auth/sync"

const UserContext = createContext<LocalUser | null>(null)

type UserProviderProps = {
  children: ReactNode
  user: LocalUser
}

export function UserProvider({ children, user }: UserProviderProps) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>
}

export function useUser() {
  const user = useContext(UserContext)
  if (!user) {
    throw new Error("useUser must be used within a UserProvider")
  }
  return user
}

export function useOptionalUser() {
  return useContext(UserContext)
}
