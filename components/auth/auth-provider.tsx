"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useTransition,
  type ReactNode,
} from "react"
import { useRouter } from "next/navigation"
import type { LoginCredentials, RegisterCredentials } from "@/lib/auth/types"
import type { LocalUser } from "@/lib/auth/sync"
import {
  loginAction,
  registerAction,
  logoutAction,
  getCurrentUser,
} from "@/lib/auth/actions"

type AuthContextType = {
  user: LocalUser | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; message: string }>
  register: (credentials: RegisterCredentials) => Promise<{ success: boolean; message: string }>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

type AuthProviderProps = {
  children: ReactNode
  initialUser?: LocalUser | null
}

export function AuthProvider({ children, initialUser = null }: AuthProviderProps) {
  const [user, setUser] = useState<LocalUser | null>(initialUser)
  const [isLoading, setIsLoading] = useState(!initialUser)
  const [isPending, startTransition] = useTransition()

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser()
      setUser(currentUser)
    } catch {
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!initialUser) {
      refreshUser()
    }
  }, [initialUser, refreshUser])

  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoading(true)
    try {
      const result = await loginAction(credentials)
      
      if (result.success && result.user) {
        setUser(result.user)
        return { success: true, message: result.message }
      }
      
      return { success: false, message: result.message || "Login failed" }
    } catch {
      return { success: false, message: "Network error. Please try again." }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const register = useCallback(async (credentials: RegisterCredentials) => {
    setIsLoading(true)
    try {
      const result = await registerAction(credentials)
      
      if (result.success && result.user) {
        setUser(result.user)
        return { success: true, message: result.message }
      }
      
      return { success: false, message: result.message || "Registration failed" }
    } catch {
      return { success: false, message: "Network error. Please try again." }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    setIsLoading(true)
    try {
      startTransition(async () => {
        await logoutAction()
        setUser(null)
      })
    } catch {
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading: isLoading || isPending,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
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

// Hook for requiring authentication
export function useRequireAuth(redirectTo = "/unauthorized") {
  const { user, isLoading, isAuthenticated } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(redirectTo)
    }
  }, [isLoading, isAuthenticated, router, redirectTo])

  return { user, isLoading, isAuthenticated }
}

// Hook for guest-only pages (login, register)
export function useGuestOnly(redirectTo = "/dashboard") {
  const { user, isLoading, isAuthenticated } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push(redirectTo)
    }
  }, [isLoading, isAuthenticated, router, redirectTo])

  return { user, isLoading, isAuthenticated }
}
