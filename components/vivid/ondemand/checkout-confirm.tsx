"use client"

import Image from "next/image"
import { useState } from "react"
import { motion } from "motion/react"
import { useVivid } from "@/lib/vivid/provider"
import type { OnDemandUI } from "@/lib/vivid/types"
import { parseConfig } from "./helpers"
import { CircleCheckBigIcon, ShoppingCartIcon } from "lucide-react"
import { RenderIcon } from "@/components/shared/render-icon"

export function CheckoutConfirmUI({ ui }: { ui: OnDemandUI }) {
  const vivid = useVivid()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config = parseConfig(ui.config as any)
  const [isPurchasing, setIsPurchasing] = useState(false)
  const price = Number(config.price) || 0
  const balance = Number(config.walletBalance) || 0
  const canAfford = balance >= price

  return (
    <div className="space-y-5">
      {/* Course preview */}
      <div className="rounded-lg overflow-hidden border border-ws-hairline bg-card/60">
        {config.thumbnailUrl && (
          <div className="relative w-full aspect-2/1 bg-muted">
            <Image
              src={config.thumbnailUrl}
              alt={config.courseTitle || ""}
              fill
              className="object-cover"
              sizes="400px"
            />
          </div>
        )}
        <div className="p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground leading-snug">
            {config.courseTitle || "Course"}
          </p>

          {/* Price breakdown */}
          <div className="space-y-2 pt-2 border-t border-ws-hairline">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Price</span>
              <span className="font-semibold text-foreground">${price.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Wallet balance</span>
              <span className={`font-medium ${canAfford ? "text-foreground" : "text-destructive"}`}>
                ${balance.toFixed(2)}
              </span>
            </div>
            <div className="h-px bg-border/30" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">After purchase</span>
              <span className="font-semibold text-foreground">
                ${canAfford ? (balance - price).toFixed(2) : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Insufficient balance warning */}
      {!canAfford && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <p className="text-xs text-destructive">
            Insufficient balance. You need ${(price - balance).toFixed(2)} more.
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => vivid.resolveUI({ confirmed: false })}
          className="flex-1 py-3 px-4 rounded-lg text-sm font-medium bg-accent/40
                     hover:bg-accent/60 transition-colors"
        >
          Cancel
        </motion.button>
        <motion.button
          whileTap={canAfford ? { scale: 0.98 } : {}}
          disabled={!canAfford || isPurchasing}
          onClick={async () => {
            setIsPurchasing(true)
            vivid.resolveUI({ confirmed: true, courseId: config.courseId })
          }}
          className={`
            flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium
            transition-colors disabled:opacity-40
            ${canAfford
              ? "bg-foreground text-background hover:bg-foreground/90"
              : "bg-muted text-muted-foreground cursor-not-allowed"
            }
          `}
        >
          {isPurchasing ? (
            <span className="inline-block w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
          ) : (
            <RenderIcon icon={canAfford ? ShoppingCartIcon : CircleCheckBigIcon}  size={16} />
          )}
          {isPurchasing ? "Processing…" : canAfford ? `Pay $${price.toFixed(2)}` : "Insufficient funds"}
        </motion.button>
      </div>
    </div>
  )
}
