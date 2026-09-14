const isLocalDev = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")

/**
 * Sign-in URL that brings the visitor back to `returnPath` (root-relative,
 * query included). Mirrors middleware.ts: local `/login` with `redirect_url`
 * for pk_test_ keys, otherwise the WorldStreet hub with an absolute
 * `redirect` to the academy origin.
 */
export function loginUrl(returnPath: string): string {
  if (isLocalDev) return `/login?redirect_url=${encodeURIComponent(returnPath)}`
  const url = new URL("https://www.worldstreetgold.com/login")
  url.searchParams.set("redirect", `https://academy.worldstreetgold.com${returnPath}`)
  return url.toString()
}
