"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { jwtVerify, decodeJwt } from "jose"
import * as authService from "./service"
import type {
  LoginCredentials,
  RegisterCredentials,
  ResetPasswordPayload,
  ChangePasswordPayload,
  AuthUser,
} from "./types"
import { syncUserToLocal, getLocalUserByAuthId, type LocalUser } from "./sync"

const ACCESS_TOKEN_COOKIE = "accessToken"
const REFRESH_TOKEN_COOKIE = "refreshToken"

// JWT Secret for verification
const JWT_ACCESS_SECRET = new TextEncoder().encode(
  process.env.JWT_ACCESS_SECRET || "worldstreetgold"
)

// Cookie options
const TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
}

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

async function setTokens(accessToken: string, refreshToken: string) {
  const cookieStore = await cookies()
  
  // Access token expires in 15 minutes
  cookieStore.set(ACCESS_TOKEN_COOKIE, accessToken, {
    ...TOKEN_COOKIE_OPTIONS,
    maxAge: 15 * 60, // 15 minutes
  })
  
  // Refresh token expires in 7 days
  cookieStore.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...TOKEN_COOKIE_OPTIONS,
    maxAge: 7 * 24 * 60 * 60, // 7 days
  })
}

async function clearTokens() {
  const cookieStore = await cookies()
  cookieStore.delete(ACCESS_TOKEN_COOKIE)
  cookieStore.delete(REFRESH_TOKEN_COOKIE)
}

export async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(ACCESS_TOKEN_COOKIE)?.value || null
}

export async function getRefreshToken(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(REFRESH_TOKEN_COOKIE)?.value || null
}

/**
 * Verify JWT access token and extract user payload
 * Returns user data even if token is expired (for refresh flow)
 */
async function verifyJWT(token: string): Promise<{ user: AuthUser; expired: boolean } | null> {
  try {
    // First try to verify with signature and expiration
    const { payload } = await jwtVerify(token, JWT_ACCESS_SECRET)
    const user = extractUserFromPayload(payload)
    if (!user) return null
    return { user, expired: false }
  } catch (error: unknown) {
    // If expired, decode without verification to get user data
    if (error && typeof error === "object" && "code" in error && error.code === "ERR_JWT_EXPIRED") {
      console.log("[Auth] Token expired, decoding for user data...")
      try {
        const payload = decodeJwt(token)
        const user = extractUserFromPayload(payload)
        if (!user) return null
        return { user, expired: true }
      } catch {
        return null
      }
    }
    console.error("[Auth] JWT verification failed:", error)
    return null
  }
}

/**
 * Extract user data from JWT payload
 */
function extractUserFromPayload(payload: Record<string, unknown>): AuthUser | null {
  const userId = (payload.userId || payload.user_id || payload.sub || payload.id) as string
  const email = (payload.email || payload.userEmail) as string
  const firstName = (payload.firstName || payload.first_name || payload.name?.toString().split(" ")[0] || "") as string
  const lastName = (payload.lastName || payload.last_name || payload.name?.toString().split(" ").slice(1).join(" ") || "") as string
  const role = ((payload.role || payload.userRole || "user") as string).toLowerCase() as "user" | "instructor" | "admin"
  const isVerified = (payload.isVerified ?? payload.verified ?? payload.emailVerified ?? true) as boolean
  
  if (!userId || !email) {
    console.error("[Auth] JWT missing required fields:", { userId, email, payload: Object.keys(payload) })
    return null
  }
  
  return {
    userId,
    email,
    firstName,
    lastName,
    role,
    isVerified,
    createdAt: (payload.createdAt || payload.iat?.toString() || new Date().toISOString()) as string,
  }
}

// ============================================================================
// AUTH ACTIONS
// ============================================================================

/**
 * Register a new user
 * - Registers with central auth service
 * - Syncs user to local MongoDB
 * - Returns local user with MongoDB _id
 */
export async function registerAction(credentials: RegisterCredentials) {
  const result = await authService.register(credentials)
  
  if (result.success && result.data) {
    await setTokens(
      result.data.tokens.accessToken,
      result.data.tokens.refreshToken
    )
    
    // Sync user to local MongoDB
    const localUser = await syncUserToLocal(result.data.user)
    
    return {
      success: true,
      message: result.message,
      user: localUser,
    }
  }
  
  return {
    success: false,
    message: result.message,
  }
}

/**
 * Login user
 * - Authenticates with central auth service
 * - Syncs user to local MongoDB
 * - Returns local user with MongoDB _id
 */
export async function loginAction(credentials: LoginCredentials) {
  const result = await authService.login(credentials)
  
  if (result.success && result.data) {
    await setTokens(
      result.data.tokens.accessToken,
      result.data.tokens.refreshToken
    )
    
    // Sync user to local MongoDB
    const localUser = await syncUserToLocal(result.data.user)
    
    return {
      success: true,
      message: result.message,
      user: localUser,
    }
  }
  
  return {
    success: false,
    message: result.message,
  }
}

/**
 * Get current authenticated user
 * - Verifies JWT locally using shared secret
 * - Gets/syncs user from local MongoDB
 * - NEVER sets cookies (safe to call from RSC / Route Handlers)
 */
export async function getCurrentUser(): Promise<LocalUser | null> {
  const accessToken = await getAccessToken()
  
  if (!accessToken) return null
  
  // Verify JWT locally
  const result = await verifyJWT(accessToken)
  
  if (result) {
    const { user: authUser } = result
    
    // Whether token is valid or expired, return local user if exists
    const existingUser = await getLocalUserByAuthId(authUser.userId)
    if (existingUser) return existingUser
    
    // Sync if not found locally
    return await syncUserToLocal(authUser, false)
  }
  
  return null
}

/**
 * Verify token and get user (for protected routes)
 * - Verifies JWT locally using shared secret
 * - Returns local user from MongoDB
 */
export async function verifyAuth(): Promise<{ user: LocalUser } | null> {
  const accessToken = await getAccessToken()
  if (!accessToken) return null
  
  // Verify JWT locally
  const result = await verifyJWT(accessToken)
  
  if (result) {
    const { user: authUser } = result
    
    const existingUser = await getLocalUserByAuthId(authUser.userId)
    if (existingUser) return { user: existingUser }
    
    const localUser = await syncUserToLocal(authUser)
    return { user: localUser }
  }
  
  return null
}

/**
 * Logout user
 */
export async function logoutAction() {
  const refreshToken = await getRefreshToken()
  
  if (refreshToken) {
    await authService.logout(refreshToken)
  }
  
  await clearTokens()
  redirect("/unauthorized")
}

/**
 * Logout from all sessions
 */
export async function logoutAllAction() {
  const accessToken = await getAccessToken()
  
  if (accessToken) {
    await authService.logoutAll(accessToken)
  }
  
  await clearTokens()
  redirect("/unauthorized")
}

/**
 * Request password reset
 */
export async function forgotPasswordAction(email: string) {
  const result = await authService.forgotPassword(email)
  return {
    success: result.success,
    message: result.message,
  }
}

/**
 * Reset password with token
 */
export async function resetPasswordAction(payload: ResetPasswordPayload) {
  const result = await authService.resetPassword(payload)
  return {
    success: result.success,
    message: result.message,
  }
}

/**
 * Change password (authenticated)
 */
export async function changePasswordAction(payload: ChangePasswordPayload) {
  const accessToken = await getAccessToken()
  
  if (!accessToken) {
    return {
      success: false,
      message: "Authentication required",
    }
  }
  
  const result = await authService.changePassword(accessToken, payload)
  
  if (result.success) {
    await clearTokens()
  }
  
  return {
    success: result.success,
    message: result.message,
  }
}

/**
 * Resend verification email
 */
export async function resendVerificationAction() {
  const accessToken = await getAccessToken()
  
  if (!accessToken) {
    return {
      success: false,
      message: "Authentication required",
    }
  }
  
  const result = await authService.resendVerification(accessToken)
  return {
    success: result.success,
    message: result.message,
  }
}

/**
 * Refresh tokens manually
 */
export async function refreshTokensAction() {
  const refreshToken = await getRefreshToken()
  
  if (!refreshToken) {
    return {
      success: false,
      message: "No refresh token available",
    }
  }
  
  const result = await authService.refreshTokens(refreshToken)
  
  if (result.success && result.data) {
    await setTokens(
      result.data.tokens.accessToken,
      result.data.tokens.refreshToken
    )
    return {
      success: true,
      message: "Tokens refreshed",
    }
  }
  
  await clearTokens()
  return {
    success: false,
    message: result.message,
  }
}

/**
 * Check if user is authenticated (lightweight check)
 */
export async function isAuthenticated(): Promise<boolean> {
  const accessToken = await getAccessToken()
  return !!accessToken
}
