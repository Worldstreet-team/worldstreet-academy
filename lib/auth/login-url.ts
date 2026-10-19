const isLocalDev = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")

/**
 * Sign-in URL that brings the visitor back to `returnPath` (root-relative,
 * query included). Mirrors middleware.ts: local `/login` with `redirect_url`
 * for pk_test_ keys, otherwise the WorldStreet hub with an absolute return
 * URL to the academy origin, sent as both `redirect` (this app's older
 * contract with the hub) and `redirect_url` (what the hub's Clerk
 * `<SignIn/>` reads).
 */
export function loginUrl(returnPath: string): string {
  if (isLocalDev) return `/login?redirect_url=${encodeURIComponent(returnPath)}`
  const back = `https://academy.worldstreetgold.com${returnPath}`
  const url = new URL("https://www.worldstreetgold.com/login")
  url.searchParams.set("redirect", back)
  url.searchParams.set("redirect_url", back)
  return url.toString()
}

/**
 * Where a signed-out visitor returns to after signing in from a checkout page:
 * the checkout path they were on, query included (`courseId`, `package`).
 * Only a checkout path is ever returned, so the return can never be steered
 * elsewhere; anything else falls back to `/dashboard/checkout`.
 */
export function checkoutReturnPath(pathname: string | null, search: string | null): string {
  const root = "/dashboard/checkout"
  if (pathname !== root && !pathname?.startsWith(`${root}/`)) return root
  return search && search.startsWith("?") && search.length > 1 ? `${pathname}${search}` : pathname
}

/**
 * Sign-up URL that brings the new learner back to `returnPath`. The hub's
 * `<SignUp/>` is Clerk's, which reads `redirect_url`; `redirect` is this
 * app's older contract with the hub. Both are sent, so either works.
 */
export function registerUrl(returnPath: string): string {
  if (isLocalDev) return `/register?redirect_url=${encodeURIComponent(returnPath)}`
  const back = `https://academy.worldstreetgold.com${returnPath}`
  const url = new URL("https://www.worldstreetgold.com/register")
  url.searchParams.set("redirect", back)
  url.searchParams.set("redirect_url", back)
  return url.toString()
}
