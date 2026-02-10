"use server"

import { getCurrentUser } from "@/lib/auth"
import { createAblyToken } from "@/lib/call-events"

/**
 * Server action to generate a scoped Ably token for the current user.
 * Replaces the previous /api/ably-token route handler.
 */
export async function getAblyTokenAction() {
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")
  const token = await createAblyToken(user.id.toString())
  // Return plain object for server action serialization
  return {
    token: token.token,
    expires: token.expires,
    issued: token.issued,
    capability: token.capability,
    clientId: token.clientId,
  }
}
