"use server"

import { getCurrentUser } from "@/lib/auth"
import { createAblyToken } from "@/lib/call-events"

type AblyTokenData = {
  token: string
  expires: number
  issued: number
  capability: string
  clientId: string | undefined
}

/**
 * Server action to generate a scoped Ably token for the current user.
 * Replaces the previous /api/ably-token route handler.
 *
 * `code: "not_configured"` means retrying can't help (no key, or Ably rejected
 * it); `"unavailable"` is a passing failure worth retrying.
 */
export async function getAblyTokenAction(): Promise<
  | { success: true; data: AblyTokenData }
  | { success: false; error: string; code: "unauthorized" | "not_configured" | "unavailable" }
> {
  try {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "Unauthorized", code: "unauthorized" }
    const token = await createAblyToken(user.id.toString())
    // Return plain object for server action serialization
    return {
      success: true,
      data: {
        token: token.token,
        expires: token.expires,
        issued: token.issued,
        capability: token.capability,
        clientId: token.clientId,
      },
    }
  } catch (error) {
    console.error("[Ably] token request failed:", error)
    const status = (error as { statusCode?: unknown })?.statusCode
    const rejected = typeof status === "number" && status >= 400 && status < 500
    return {
      success: false,
      error: "Live updates are unavailable right now",
      code: !process.env.ABLY_API_KEY || rejected ? "not_configured" : "unavailable",
    }
  }
}
