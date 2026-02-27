"use client"

import { motion } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Tick02Icon } from "@hugeicons/core-free-icons"
import { useVivid } from "@/lib/vivid/provider"
import type { OnDemandUI } from "@/lib/vivid/types"

export function ConfirmationUI({ ui }: { ui: OnDemandUI }) {
  const vivid = useVivid()

  return (
    <div className="space-y-5">
      <div className="p-4 rounded-2xl bg-accent/20 border border-border/30">
        <p className="text-sm text-foreground/80 leading-relaxed">
          {ui.config?.message as string || "Are you sure?"}
        </p>
      </div>
      <div className="flex gap-2">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => vivid.resolveUI({ confirmed: false })}
          className="flex-1 py-2.5 px-3 rounded-xl text-sm font-medium bg-accent/40
                     hover:bg-accent/60 transition-colors"
        >
          Cancel
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => vivid.resolveUI({ confirmed: true })}
          className="flex-1 py-2.5 px-3 rounded-xl text-sm font-medium bg-foreground text-background
                     hover:bg-foreground/90 transition-colors flex items-center justify-center gap-2"
        >
          <HugeiconsIcon icon={Tick02Icon} size={14} /> Confirm
        </motion.button>
      </div>
    </div>
  )
}
