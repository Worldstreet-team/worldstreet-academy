"use client"

import { useEffect } from "react"
import { ThemeProvider as NextThemesProvider, useTheme, type ThemeProviderProps } from "next-themes"

/* next-themes owns the light/dark choice (the .dark class for shadcn's
   `dark:` variants); the design system's palette follows data-theme on
   <html>. This keeps the two in lockstep, so the system's tokens — not a
   parallel class system — decide every colour. */
function WsThemeSync() {
  const { resolvedTheme } = useTheme()
  useEffect(() => {
    if (!resolvedTheme) return
    document.documentElement.setAttribute("data-theme", resolvedTheme === "light" ? "light" : "dark")
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
