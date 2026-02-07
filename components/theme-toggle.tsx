"use client"

import { useTheme } from "next-themes"
import { HugeiconsIcon } from "@hugeicons/react"
import { Sun03Icon, Moon02Icon } from "@hugeicons/core-free-icons"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
      className="relative flex h-8 w-8 items-center justify-center rounded-full border text-muted-foreground hover:bg-muted transition-colors"
    >
      <HugeiconsIcon
        icon={Sun03Icon}
        size={16}
        className="rotate-0 scale-100 transition-all dark:rotate-90 dark:scale-0"
      />
      <HugeiconsIcon
        icon={Moon02Icon}
        size={16}
        className="absolute rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
      />
    </button>
  )
}
