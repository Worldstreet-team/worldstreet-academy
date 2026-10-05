import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import {
  REFERRAL_COOKIE,
  REFERRAL_COOKIE_MAX_AGE,
  REFERRAL_PARAM,
  SELLER_LINK_COOKIE,
  normalizeReferralCode,
  sellerLinkValue,
} from "@/lib/referral-link"

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/instructor(.*)", "/admin(.*)"])

const isLocalDev = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")

export default clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl

  // Add pathname header so server components can read the current path
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-next-pathname", pathname)

  // Referral links (owner, 2026-10-05): any page with a valid `?ref=CODE`
  // stores the code for 30 days, so it survives sign-up on the hub. First
  // touch wins — a valid code already stored is never replaced. The code is
  // also added to this request's own cookies, so a user created while
  // rendering it (lib/auth/sync.ts) is already attributed.
  const refCode = normalizeReferralCode(request.cookies.get(REFERRAL_COOKIE)?.value)
    ? null
    : normalizeReferralCode(request.nextUrl.searchParams.get(REFERRAL_PARAM))
  if (refCode) {
    const cookieHeader = requestHeaders.get("cookie")
    requestHeaders.set("cookie", `${cookieHeader ? `${cookieHeader}; ` : ""}${REFERRAL_COOKIE}=${refCode}`)
  }
  // A code on a program page is also kept per course, last touch wins
  // (SELLER_LINK_COOKIE): a seller's own link must still credit the seller
  // when this visitor followed someone else's link before.
  const linkedSlug = pathname.match(/^\/programs\/([^/]+)\/?$/)?.[1] ?? null
  const courseRefCode = linkedSlug ? normalizeReferralCode(request.nextUrl.searchParams.get(REFERRAL_PARAM)) : null
  const withReferral = (response: NextResponse) => {
    if (linkedSlug && courseRefCode) {
      response.cookies.set(SELLER_LINK_COOKIE, sellerLinkValue(linkedSlug, courseRefCode), {
        path: "/",
        sameSite: "lax",
        maxAge: REFERRAL_COOKIE_MAX_AGE,
        httpOnly: true,
        secure: !isLocalDev,
      })
    }
    if (refCode) {
      response.cookies.set(REFERRAL_COOKIE, refCode, {
        path: "/",
        sameSite: "lax",
        maxAge: REFERRAL_COOKIE_MAX_AGE,
        httpOnly: true,
        // Local dev runs on http://localhost; everywhere else is https.
        secure: !isLocalDev,
      })
    }
    return response
  }

  if (isProtectedRoute(request)) {
    const { userId } = await auth()

    if (!userId) {
      if (isLocalDev) {
        // Local dev: redirect to local sign-in
        const loginUrl = new URL("/login", request.url)
        loginUrl.searchParams.set("redirect_url", `${pathname}${request.nextUrl.search}`)
        return withReferral(NextResponse.redirect(loginUrl))
      }

      const returnUrl = `https://academy.worldstreetgold.com${pathname}${request.nextUrl.search}`
      const authUrl = new URL("https://www.worldstreetgold.com/login")
      authUrl.searchParams.set("redirect", returnUrl)
      // The hub's Clerk <SignIn/> reads redirect_url; `redirect` is the older contract.
      authUrl.searchParams.set("redirect_url", returnUrl)
      return withReferral(NextResponse.redirect(authUrl))
    }
  }

  return withReferral(
    NextResponse.next({
      request: { headers: requestHeaders },
    })
  )
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
