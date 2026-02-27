"use client"

import { useState } from "react"
import { motion } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { StarIcon } from "@hugeicons/core-free-icons"
import { useVivid } from "@/lib/vivid/provider"

export function RatingUI() {
  const vivid = useVivid()
  const [rating, setRating] = useState(0)
  const [hoveredStar, setHoveredStar] = useState(0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-center gap-3 py-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <motion.button
            key={star}
            whileHover={{ scale: 1.25, y: -2 }}
            whileTap={{ scale: 0.9 }}
            onMouseEnter={() => setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(0)}
            onClick={() => setRating(star)}
            className="p-1 cursor-pointer"
          >
            <HugeiconsIcon
              icon={StarIcon}
              size={32}
              className={`transition-colors duration-150 ${
                star <= (hoveredStar || rating)
                  ? "text-amber-400 fill-amber-400"
                  : "text-muted-foreground/20"
              }`}
            />
          </motion.button>
        ))}
      </div>
      {rating > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-center text-xs text-muted-foreground mb-3">
            {rating === 5 ? "Excellent!" : rating === 4 ? "Great!" : rating === 3 ? "Good" : rating === 2 ? "Fair" : "Poor"}
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => vivid.resolveUI({ rating })}
            className="w-full py-2.5 rounded-xl text-sm font-medium bg-foreground text-background
                       hover:bg-foreground/90 transition-colors"
          >
            Submit {rating} star{rating !== 1 ? "s" : ""}
          </motion.button>
        </motion.div>
      )}
    </div>
  )
}
