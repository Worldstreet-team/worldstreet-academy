import type {
  AuthUser,
  AuthTokens,
  AuthResponse,
  LoginCredentials,
  RegisterCredentials,
  ResetPasswordPayload,
  ChangePasswordPayload,
  AuthSession,
} from "./types"

const AUTH_BASE_URL = process.env.AUTH_API_URL || "https://api.worldstreetgold.com"

type FetchOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE"
  body?: Record<string, unknown>
  accessToken?: string
  refreshToken?: string
}

async function authFetch<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<AuthResponse<T>> {
  const { method = "GET", body, accessToken } = options

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`
  }

  try {
    const response = await fetch(`${AUTH_BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        message: data.message || "Request failed",
      }
    }

    return data as AuthResponse<T>
  } catch (error) {
    console.error("Auth fetch error:", error)
    return {
      success: false,
      message: "Network error. Please try again.",
    }
  }
}

// ============================================================================
// AUTH SERVICE FUNCTIONS
// ============================================================================

/**
 * Register a new user
 */
export async function register(
  credentials: RegisterCredentials
): Promise<AuthResponse<AuthSession>> {
  return authFetch<AuthSession>("/api/auth/register", {
    method: "POST",
    body: credentials,
  })
}

/**
 * Login user
 */
export async function login(
  credentials: LoginCredentials
): Promise<AuthResponse<AuthSession>> {
  return authFetch<AuthSession>("/api/auth/login", {
    method: "POST",
    body: credentials,
  })
}

/**
 * Get current user profile
 */
export async function getProfile(
  accessToken: string
): Promise<AuthResponse<{ user: AuthUser }>> {
  return authFetch<{ user: AuthUser }>("/api/auth/me", {
    accessToken,
  })
}

/**
 * Verify user's access token (for microservice verification)
 */
export async function verifyToken(
  accessToken: string
): Promise<AuthResponse<{ user: AuthUser }>> {
  return authFetch<{ user: AuthUser }>("/api/auth/verify", {
    accessToken,
  })
}

/**
 * Refresh tokens
 */
export async function refreshTokens(
  refreshToken: string
): Promise<AuthResponse<{ tokens: AuthTokens }>> {
  return authFetch<{ tokens: AuthTokens }>("/api/auth/refresh-token", {
    method: "POST",
    body: { refreshToken },
  })
}

/**
 * Request password reset email
 */
export async function forgotPassword(
  email: string
): Promise<AuthResponse<void>> {
  return authFetch<void>("/api/auth/forgot-password", {
    method: "POST",
    body: { email },
  })
}

/**
 * Reset password with token
 */
export async function resetPassword(
  payload: ResetPasswordPayload
): Promise<AuthResponse<void>> {
  return authFetch<void>("/api/auth/reset-password", {
    method: "POST",
    body: payload,
  })
}

/**
 * Change password (authenticated)
 */
export async function changePassword(
  accessToken: string,
  payload: ChangePasswordPayload
): Promise<AuthResponse<void>> {
  return authFetch<void>("/api/auth/change-password", {
    method: "POST",
    body: payload,
    accessToken,
  })
}

/**
 * Resend verification email (authenticated)
 */
export async function resendVerification(
  accessToken: string
): Promise<AuthResponse<void>> {
  return authFetch<void>("/api/auth/resend-verification", {
    method: "POST",
    accessToken,
  })
}

/**
 * Logout (revoke refresh token)
 */
export async function logout(refreshToken: string): Promise<AuthResponse<void>> {
  return authFetch<void>("/api/auth/logout", {
    method: "POST",
    body: { refreshToken },
  })
}

/**
 * Logout all sessions (authenticated)
 */
export async function logoutAll(accessToken: string): Promise<AuthResponse<void>> {
  return authFetch<void>("/api/auth/logout-all", {
    method: "POST",
    accessToken,
  })
}
