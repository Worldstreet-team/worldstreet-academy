"use client"

/**
 * Vivid On-Demand UI — Modular interactive panels.
 * Each UI type has its own component file for independent maintenance.
 */

import { motion, AnimatePresence } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { useVivid } from "@/lib/vivid/provider"
import type { OnDemandUI } from "@/lib/vivid/types"

import { FileUploadUI } from "./file-upload"
import { SignatureCanvasUI } from "./signature-canvas"
import { ConfirmationUI } from "./confirmation"
import { RatingUI } from "./rating"
import { LanguagePickerUI } from "./language-picker"
import { BookmarkToggleUI } from "./bookmark-toggle"
import { ProgressDashboardUI } from "./progress-dashboard"
import { ContactCardUI } from "./contact-card"
import { CheckoutConfirmUI } from "./checkout-confirm"
import { FriendSearchUI } from "./friend-search"

export function OnDemandUIPanel({ ui }: { ui: OnDemandUI }) {
  const vivid = useVivid()

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground tracking-tight">{ui.title}</h3>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => vivid.dismissUI()}
          className="p-1.5 rounded-lg hover:bg-accent/50 text-muted-foreground"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={16} />
        </motion.button>
      </div>
      {ui.description && (
        <p className="text-sm text-muted-foreground leading-relaxed">{ui.description}</p>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={ui.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          <OnDemandUIContent ui={ui} />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function OnDemandUIContent({ ui }: { ui: OnDemandUI }) {
  switch (ui.type) {
    case "file-upload":
      return <FileUploadUI />
    case "signature-canvas":
      return <SignatureCanvasUI />
    case "confirmation":
      return <ConfirmationUI ui={ui} />
    case "rating":
      return <RatingUI />
    case "language-picker":
      return <LanguagePickerUI />
    case "bookmark-toggle":
      return <BookmarkToggleUI ui={ui} />
    case "progress-dashboard":
      return <ProgressDashboardUI ui={ui} />
    case "contact-card":
      return <ContactCardUI ui={ui} />
    case "checkout-confirm":
      return <CheckoutConfirmUI ui={ui} />
    case "friend-search":
      return <FriendSearchUI />
    default:
      return <p className="text-sm text-muted-foreground">Unknown UI type.</p>
  }
}
