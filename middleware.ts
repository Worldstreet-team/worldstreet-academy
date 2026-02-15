import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/instructor(.*)"])

const signInUrl = "https://www.worldstreetgold.com/login"

export default clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl

  // Add pathname header so server components can read the current path
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-next-pathname", pathname)

  if (isProtectedRoute(request)) {
    const { userId } = await auth()

    if (!userId) {
      const returnUrl = `${request.nextUrl.origin}${pathname}${request.nextUrl.search}`
      const authUrl = new URL(signInUrl)
      authUrl.searchParams.set("redirect", returnUrl)
      return NextResponse.redirect(authUrl)
    }
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  })
})

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
