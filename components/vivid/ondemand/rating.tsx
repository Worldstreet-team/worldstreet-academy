"use client"

import { useState } from "react"
import { motion } from "motion/react"
import { useVivid } from "@/lib/vivid/provider"
import { StarIcon } from "lucide-react"

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
            whileTap={{ scale: 0.98 }}
            onMouseEnter={() => setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(0)}
            onClick={() => setRating(star)}
            className="p-1 cursor-pointer"
          >
            <StarIcon
              
              size={32}
              className={`transition-colors duration-[var(--ws-motion-fast)] ${
                star <= (hoveredStar || rating)
                  ? "text-ws-rating fill-ws-rating"
                  : "text-muted-foreground/20"
              }`} />
          </motion.button>
        ))}
      </div>
      {rating > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-center text-xs text-muted-foreground mb-3">
            {rating === 5 ? "Excellent!" : rating === 4 ? "Great!" : rating === 3 ? "Good" : rating === 2 ? "Fair" : "Poor"}
          </p>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => vivid.resolveUI({ rating })}
            className="w-full py-2.5 rounded-lg text-sm font-medium bg-foreground text-background
                       hover:bg-foreground/90 transition-colors"
          >
            Submit {rating} star{rating !== 1 ? "s" : ""}
          </motion.button>
        </motion.div>
      )}
    </div>
  )
}
