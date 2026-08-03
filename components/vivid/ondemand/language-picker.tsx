"use client"

import { motion } from "motion/react"
import { useVivid } from "@/lib/vivid/provider"
import { LANG_OPTIONS } from "./helpers"
import { GlobeIcon } from "lucide-react"

export function LanguagePickerUI() {
  const vivid = useVivid()

  return (
    <div className="space-y-1.5 max-h-80 overflow-y-auto">
      {LANG_OPTIONS.map((lang, i) => (
        <motion.button
          key={lang.code}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.03 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => vivid.resolveUI({ languageCode: lang.code })}
          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent/40
                     border border-transparent hover:border-ws-hairline transition-all text-left"
        >
          <GlobeIcon  size={16} className="text-foreground/50 shrink-0" />
          <span className="text-sm font-medium">{lang.label}</span>
          <span className="text-xs text-muted-foreground ml-auto uppercase tracking-wider">{lang.code}</span>
        </motion.button>
      ))}
    </div>
  )
}
