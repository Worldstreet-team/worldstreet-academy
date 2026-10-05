import "server-only"
import { cache } from "react"
import connectDB from "@/lib/db"
import { User, type SellerStatus } from "@/lib/db/models"

/**
 * A user's marketplace seller status (lib/marketplace.ts has the client-safe
 * rules). `LocalUser` doesn't carry it, so the instructor layout reads it
 * here — once per request. Fails closed: an unreadable status is "none",
 * which never opens the seller area.
 */
export const getSellerStatus = cache(async (userId: string): Promise<SellerStatus> => {
  try {
    await connectDB()
    const user = await User.findById(userId).select("sellerStatus").lean()
    return user?.sellerStatus ?? "none"
  } catch (error) {
    console.error("[Seller] status read failed:", error)
    return "none"
  }
})
