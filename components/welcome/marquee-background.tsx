"use client"

import Image from "next/image"

/**
 * Curated images for the Netflix-style scrolling grid.
 * Each row is duplicated to create a seamless infinite loop.
 */
const MARQUEE_IMAGES = [
  // Row 1 — Trading & Charts
  [
    "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=240&fit=crop",
    "https://images.unsplash.com/photo-1642790106117-e829e14a795f?w=400&h=240&fit=crop",
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=240&fit=crop",
    "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=400&h=240&fit=crop",
    "https://images.unsplash.com/photo-1535320903710-d993d3d77d29?w=400&h=240&fit=crop",
    "https://images.unsplash.com/photo-1518186285589-2f7649de83e0?w=400&h=240&fit=crop",
  ],
  // Row 2 — Crypto & Blockchain
  [
    "https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=400&h=240&fit=crop",
    "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=400&h=240&fit=crop",
    "https://images.unsplash.com/photo-1639322537228-f710d846310a?w=400&h=240&fit=crop",
    "https://images.unsplash.com/photo-1622630998477-20aa696ecb05?w=400&h=240&fit=crop",
    "https://images.unsplash.com/photo-1516245834210-c4c142787335?w=400&h=240&fit=crop",
    "https://images.unsplash.com/photo-1620321023374-d1a68fbc720d?w=400&h=240&fit=crop",
  ],
  // Row 3 — Finance & Business
  [
    "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=240&fit=crop",
    "https://images.unsplash.com/photo-1579532537598-459ecdaf39cc?w=400&h=240&fit=crop",
    "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=240&fit=crop",
    "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=400&h=240&fit=crop",
    "https://images.unsplash.com/photo-1504607798333-52a30db54a5d?w=400&h=240&fit=crop",
    "https://images.unsplash.com/photo-1553729459-afe8f2e2ed08?w=400&h=240&fit=crop",
  ],
  // Row 4 — Technology & Learning
  [
    "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=400&h=240&fit=crop",
    "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&h=240&fit=crop",
    "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400&h=240&fit=crop",
    "https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=400&h=240&fit=crop",
    "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400&h=240&fit=crop",
    "https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=400&h=240&fit=crop",
  ],
  // Row 5 — Global Markets
  [
    "https://images.unsplash.com/photo-1468254095679-bbcba94a7066?w=400&h=240&fit=crop",
    "https://images.unsplash.com/photo-1559526324-593bc073d938?w=400&h=240&fit=crop",
    "https://images.unsplash.com/photo-1611348586804-61bf6c080437?w=400&h=240&fit=crop",
    "https://images.unsplash.com/photo-1605792657660-596af9009e82?w=400&h=240&fit=crop",
    "https://images.unsplash.com/photo-1634704784915-aacf363b021f?w=400&h=240&fit=crop",
    "https://images.unsplash.com/photo-1563986768609-322da13575f2?w=400&h=240&fit=crop",
  ],
]

export function MarqueeBackground() {
  return (
    <div className="absolute inset-x-0 top-0 h-[70vh] overflow-hidden pointer-events-none select-none">
      {/* Slight tilt for depth effect */}
      <div className="absolute inset-0 -rotate-[4deg] scale-[1.15] origin-center flex flex-col justify-center gap-3 md:gap-4">
        {MARQUEE_IMAGES.map((row, rowIndex) => {
          const direction = rowIndex % 2 === 0 ? "left" : "right"
          return (
            <MarqueeRow
              key={rowIndex}
              images={row}
              direction={direction}
              speed={30 + rowIndex * 5}
            />
          )
        })}
      </div>

      {/* Theme-aware gradient overlay: transparent top → background bottom */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/50 to-background" />
      {/* Side fades */}
      <div className="absolute inset-0 bg-gradient-to-r from-background/60 via-transparent to-background/60" />
    </div>
  )
}

function MarqueeRow({
  images,
  direction,
  speed,
}: {
  images: string[]
  direction: "left" | "right"
  speed: number
}) {
  // Duplicate images for seamless loop
  const duplicated = [...images, ...images]

  return (
    <div
      className="flex gap-3 md:gap-4 w-max"
      style={{
        animation: `marquee-${direction} ${speed}s linear infinite`,
      }}
    >
      {duplicated.map((src, i) => (
        <div
          key={`${src}-${i}`}
          className="relative w-[160px] h-[100px] md:w-[220px] md:h-[130px] lg:w-[260px] lg:h-[155px] flex-shrink-0 rounded-lg overflow-hidden"
        >
          <Image
            src={src}
            alt=""
            fill
            sizes="260px"
            className="object-cover opacity-60 dark:opacity-40"
            unoptimized
          />
        </div>
      ))}
    </div>
  )
}
