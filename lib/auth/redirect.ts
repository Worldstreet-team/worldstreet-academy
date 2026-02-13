import { headers } from "next/headers"

const AUTH_LOGIN_URL = "https://worldstreetgold.com/login"

async function getBaseUrl(): Promise<string> {
  // Try env var first (for development)
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }
  
  // Get from request headers (works in production)
  const headersList = await headers()
  const host = headersList.get("host") || "academy.worldstreetgold.com"
  const protocol = headersList.get("x-forwarded-proto") || "https"
  return `${protocol}://${host}`
}

/**
 * Build the external login redirect URL with a redirect param
 * so the user returns to the correct page after signing in.
 *
 * @param path - The path the user was trying to access (e.g. "/dashboard")
 * @returns Full external login URL with redirect query param
 */
export async function buildLoginRedirectUrl(path: string): Promise<string> {
  const redirectUrl = `${await getBaseUrl()}${path}`
  const loginUrl = new URL(AUTH_LOGIN_URL)
  loginUrl.searchParams.set("redirect", redirectUrl)
  return loginUrl.toString()
}
