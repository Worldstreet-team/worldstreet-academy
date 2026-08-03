"use client"

import { motion } from "motion/react"
import { useVivid } from "@/lib/vivid/provider"
import type { OnDemandUI } from "@/lib/vivid/types"
import { CheckIcon } from "lucide-react"

export function ConfirmationUI({ ui }: { ui: OnDemandUI }) {
  const vivid = useVivid()

  return (
    <div className="space-y-5">
      <div className="p-4 rounded-lg bg-accent/20 border border-ws-hairline">
        <p className="text-sm text-foreground/80 leading-relaxed">
          {ui.config?.message as string || "Are you sure?"}
        </p>
      </div>
      <div className="flex gap-2">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => vivid.resolveUI({ confirmed: false })}
          className="flex-1 py-2.5 px-3 rounded-lg text-sm font-medium bg-accent/40
                     hover:bg-accent/60 transition-colors"
        >
          Cancel
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => vivid.resolveUI({ confirmed: true })}
          className="flex-1 py-2.5 px-3 rounded-lg text-sm font-medium bg-foreground text-background
                     hover:bg-foreground/90 transition-colors flex items-center justify-center gap-2"
        >
          <CheckIcon  size={14} /> Confirm
        </motion.button>
      </div>
    </div>
  )
}
