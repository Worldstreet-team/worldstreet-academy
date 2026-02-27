"use server"

import connectDB from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Doc = Record<string, any>

export async function initAction() {
  await connectDB()
  return getCurrentUser()
}
