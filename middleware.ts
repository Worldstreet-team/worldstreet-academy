import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/instructor(.*)"])

const isLocalDev = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")

export default clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl

  // Add pathname header so server components can read the current path
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-next-pathname", pathname)

  if (isProtectedRoute(request)) {
    const { userId } = await auth()

    if (!userId) {
      if (isLocalDev) {
        // Local dev: redirect to local sign-in
        const loginUrl = new URL("/login", request.url)
        loginUrl.searchParams.set("redirect_url", pathname)
        return NextResponse.redirect(loginUrl)
      }

      const returnUrl = `https://academy.worldstreetgold.com${pathname}${request.nextUrl.search}`
      const authUrl = new URL("https://www.worldstreetgold.com/login")
      authUrl.searchParams.set("redirect", returnUrl)
      return NextResponse.redirect(authUrl)
    }
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  })
}, isLocalDev
  ? {
      signInUrl: "/login",
      signUpUrl: "/register",
    }
  : {
      domain: "worldstreetgold.com",
      isSatellite: true,
      signInUrl: "https://www.worldstreetgold.com/login",
      signUpUrl: "https://www.worldstreetgold.com/register",
    }
)

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
