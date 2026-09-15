import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        /* h-11 (44px) on touch, h-10 (40px) from md up — 32px left forms
           cramped. 10px corners: the 13px `rounded-lg` on a short box read as a
           pill. `text-base` below md is load-bearing: iOS Safari force-zooms
           the viewport on focus for any input under 16px, and never zooms back. */
        "dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 disabled:bg-input/50 dark:disabled:bg-input/80 h-11 md:h-10 rounded-[10px] border bg-transparent px-3.5 py-1 text-base transition-colors file:h-7 file:text-sm file:font-medium focus-visible:ring-3 aria-invalid:ring-3 md:text-[14px] file:text-foreground placeholder:text-muted-foreground/70 w-full min-w-0 outline-none file:inline-flex file:border-0 file:bg-transparent disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
