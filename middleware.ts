import { NextResponse, type NextRequest } from "next/server"
import { jwtVerify } from "jose"

const ACCESS_TOKEN_COOKIE = "accessToken"
const REFRESH_TOKEN_COOKIE = "refreshToken"
const AUTH_BASE_URL = process.env.AUTH_API_URL || "https://api.worldstreetgold.com"
const AUTH_LOGIN_URL = "https://worldstreetgold.com/login"

const JWT_ACCESS_SECRET = new TextEncoder().encode(
  process.env.JWT_ACCESS_SECRET || "worldstreetgold"
)

// Routes that require authentication
const protectedRoutes = ["/dashboard", "/instructor"]

/**
 * Build the redirect URL to the central auth login page with a return URL
 * so the user comes back after logging in.
 */
function buildAuthRedirect(request: NextRequest): NextResponse {
  const returnUrl = `${request.nextUrl.origin}${request.nextUrl.pathname}${request.nextUrl.search}`
  const authUrl = new URL(AUTH_LOGIN_URL)
  authUrl.searchParams.set("redirect", returnUrl)
  const res = NextResponse.redirect(authUrl)

  // Clear stale cookies on redirect
  res.cookies.delete(ACCESS_TOKEN_COOKIE)
  res.cookies.delete(REFRESH_TOKEN_COOKIE)

  return res
}

/**
 * Attempt to refresh the access token using the refresh token.
 * Returns the new tokens on success, or null on failure.
 */
async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    const res = await fetch(`${AUTH_BASE_URL}/api/auth/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) return null

    const data = await res.json()
    if (!data.success || !data.data?.tokens) return null

    return data.data.tokens
  } catch {
    return null
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Add pathname header so server components can read the current path
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-next-pathname", pathname)

  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  )

  if (!isProtectedRoute) {
    return NextResponse.next({
      request: { headers: requestHeaders },
    })
  }

  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value

  // No tokens at all → redirect to login
  if (!accessToken && !refreshToken) {
    return buildAuthRedirect(request)
  }

  // Try verifying the access token first
  if (accessToken) {
    try {
      await jwtVerify(accessToken, JWT_ACCESS_SECRET)
      return NextResponse.next({
        request: { headers: requestHeaders },
      })
    } catch {
      // Access token invalid/expired — fall through to refresh
    }
  }

  // Attempt refresh using the refresh token
  if (refreshToken) {
    const newTokens = await refreshAccessToken(refreshToken)

    if (newTokens) {
      // Set the fresh tokens on the response and let the request through
      const response = NextResponse.next({
        request: { headers: requestHeaders },
      })

      response.cookies.set(ACCESS_TOKEN_COOKIE, newTokens.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 15 * 60, // 15 minutes
      })

      response.cookies.set(REFRESH_TOKEN_COOKIE, newTokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60, // 7 days
      })

      return response
    }
  }

  // Both access and refresh failed → redirect to login
  return buildAuthRedirect(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes (handled separately)
     */
    "/((?!_next/static|_next/image|favicon.ico|public/|api/).*)",
  ],
}
