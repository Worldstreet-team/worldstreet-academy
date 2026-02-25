"use client"

/**
 * Vivid Wrapper — Persistent voice assistant wrapper.
 *
 * Drop into the root layout to provide the AI assistant across ALL pages.
 * The orb renders everywhere; the full experience only activates on interaction.
 * On auth pages (login/register), the widget is hidden.
 */

import { type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { VividProvider } from "@/lib/vivid/provider"
import { VividWidget } from "./vivid-widget"

// Pages where Vivid should NOT appear
const HIDDEN_PATHS = ["/login", "/register"]

interface VividWrapperProps {
  children?: ReactNode
  user?: {
    id: string
    firstName: string
    lastName: string
    email: string
    role: string
    avatarUrl?: string | null
  }
}

export function VividWrapper({ children, user }: VividWrapperProps) {
  const pathname = usePathname()
  const isHidden = HIDDEN_PATHS.some((p) => pathname.startsWith(p))

  // On auth pages or when no user, just render children
  if (isHidden || !user) {
    return <>{children}</>
  }

  return (
    <VividProvider>
      {children}
      <VividWidget />
    </VividProvider>
  )
}
