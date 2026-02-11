const AUTH_LOGIN_URL = "https://worldstreetgold.com/login"
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

/**
 * Build the external login redirect URL with a redirect param
 * so the user returns to the correct page after signing in.
 *
 * @param path - The path the user was trying to access (e.g. "/dashboard")
 * @returns Full external login URL with redirect query param
 */
export function buildLoginRedirectUrl(path: string): string {
  const redirectUrl = `${APP_URL}${path}`
  const loginUrl = new URL(AUTH_LOGIN_URL)
  loginUrl.searchParams.set("redirect", redirectUrl)
  return loginUrl.toString()
}
