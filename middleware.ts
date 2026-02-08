import { NextResponse, type NextRequest } from "next/server"

const ACCESS_TOKEN_COOKIE = "accessToken"

// Routes that require authentication
const protectedRoutes = [
  "/dashboard",
  "/instructor",
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value

  // Check if route is protected
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname.startsWith(route)
  )

  // Redirect unauthenticated users from protected routes to unauthorized page
  if (isProtectedRoute && !accessToken) {
    return NextResponse.redirect(new URL("/unauthorized", request.url))
  }

  // For instructor routes, we'll validate the role server-side in the layout
  // This is because we need to verify the token and check the role
  // The middleware just ensures there's a token present

  return NextResponse.next()
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
