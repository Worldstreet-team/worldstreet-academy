"use client"

import { useEffect } from "react"
import { ThemeProvider as NextThemesProvider, useTheme, type ThemeProviderProps } from "next-themes"

/* next-themes owns the light/dark choice (class attribute for shadcn's
   `dark:` variants); the design-system palette is driven by data-ws-theme on
   <html>. This keeps the two in lockstep so tokens — not a parallel class
   system — decide every color (platform = dark, platform-light = light). */
function WsThemeSync() {
  const { resolvedTheme } = useTheme()
  useEffect(() => {
    if (!resolvedTheme) return
    document.documentElement.setAttribute(
      "data-ws-theme",
      resolvedTheme === "light" ? "platform-light" : "platform",
    )
  }, [resolvedTheme])
  return null
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <WsThemeSync />
      {children}
    </NextThemesProvider>
  )
}
