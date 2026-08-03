import * as React from "react"

/**
 * <Mascot /> — the Academy owl, hand-authored in the WorldStreet palette.
 *
 * A static brand illustration: gold body #FFCC29, cream chest, warm-ink cap
 * and outlines #1B1A16, amber beak/feet. Literal hexes on purpose — the
 * character keeps its identity on both the dark #0B0B0F page and warm paper.
 * Deliberately not animated: the DS bans looping ambient motion, so the owl
 * holds a pose like any other illustration.
 */
export function Mascot({
  className,
  size = 120,
}: {
  className?: string
  size?: number
}) {
  return (
    <svg
      viewBox="0 0 220 220"
      width={size}
      height={size}
      fill="none"
      role="img"
      aria-hidden="true"
      className={className}
    >
      {/* The owl */}
      <g>
        {/* Feet — behind the body, toes peeking out */}
        <g fill="#D4A917" stroke="#B45309" strokeWidth="2">
          <ellipse cx="92" cy="192" rx="7" ry="8" />
          <ellipse cx="103" cy="194" rx="7" ry="8" />
          <ellipse cx="117" cy="194" rx="7" ry="8" />
          <ellipse cx="128" cy="192" rx="7" ry="8" />
        </g>

        {/* Ear tufts */}
        <g fill="#FFCC29" stroke="#1B1A16" strokeWidth="3" strokeLinejoin="round">
          <path d="M66 92 C58 78 60 66 70 58 C72 70 78 80 88 86 C80 92 72 94 66 92 Z" />
          <path d="M154 92 C162 78 160 66 150 58 C148 70 142 80 132 86 C140 92 148 94 154 92 Z" />
        </g>

        {/* Body — one soft egg */}
        <path
          d="M110 74
             C144 74 166 100 166 134
             C166 168 142 190 110 190
             C78 190 54 168 54 134
             C54 100 76 74 110 74 Z"
          fill="#FFCC29"
          stroke="#1B1A16"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />

        {/* Chest — cream with feather scallops */}
        <ellipse cx="110" cy="158" rx="33" ry="28" fill="#FFE9A3" />
        <path
          d="M90 150 Q100 159 110 159 Q120 159 130 150"
          stroke="#F5D876"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M94 164 Q102 172 110 172 Q118 172 126 164"
          stroke="#F5D876"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />

        {/* Diploma — tucked under the right wing (drawn behind it) */}
        <g transform="translate(154 152) rotate(-38)">
          <rect
            x="-23"
            y="-9"
            width="46"
            height="18"
            rx="9"
            fill="#FAF9F5"
            stroke="#1B1A16"
            strokeWidth="3"
          />
          <circle cx="16" cy="0" r="6.5" fill="#EDE4CF" stroke="#1B1A16" strokeWidth="2" />
          <circle cx="16" cy="0" r="2.2" fill="none" stroke="#B4A98C" strokeWidth="1.5" />
          <rect
            x="-8"
            y="-10.5"
            width="9"
            height="21"
            rx="2.5"
            fill="#FFCC29"
            stroke="#1B1A16"
            strokeWidth="2"
          />
        </g>

        {/* Right wing — tucked, holding the diploma */}
        <path
          d="M152 108
             C172 114 182 134 176 156
             C173 167 164 172 155 168
             C160 150 158 128 148 112 Z"
          fill="#F2C424"
          stroke="#1B1A16"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        {/* Left wing — raised */}
        <path
          d="M68 124
             C50 120 36 104 33 86
             C31.5 75 39 67 47 71
             C60 78 68 98 70 116 Z"
          fill="#F2C424"
          stroke="#1B1A16"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        {/* Blush */}
        <ellipse cx="74" cy="132" rx="8" ry="5" fill="#F0788C" opacity="0.4" />
        <ellipse cx="146" cy="132" rx="8" ry="5" fill="#F0788C" opacity="0.4" />

        {/* Eyes — big and glossy */}
        <g>
          <circle cx="89" cy="114" r="16.5" fill="#FAF9F5" stroke="#1B1A16" strokeWidth="3" />
          <circle cx="131" cy="114" r="16.5" fill="#FAF9F5" stroke="#1B1A16" strokeWidth="3" />
          <circle cx="90" cy="115" r="11" fill="#1B1A16" />
          <circle cx="130" cy="115" r="11" fill="#1B1A16" />
          <circle cx="86" cy="110" r="4" fill="#FFFFFF" />
          <circle cx="126" cy="110" r="4" fill="#FFFFFF" />
          <circle cx="94" cy="119" r="1.8" fill="#FFFFFF" opacity="0.85" />
          <circle cx="134" cy="119" r="1.8" fill="#FFFFFF" opacity="0.85" />
        </g>

        {/* Beak */}
        <path
          d="M103 130 Q110 126 117 130 Q115.5 141 110 143.5 Q104.5 141 103 130 Z"
          fill="#D4A917"
          stroke="#B45309"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Graduation cap — skullcap band, mortarboard, button */}
        <ellipse cx="110" cy="70" rx="40" ry="19" fill="#1B1A16" />
        <path
          d="M110 36 L179 62 L110 88 L41 62 Z"
          fill="#1B1A16"
          stroke="#1B1A16"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {/* subtle top-face sheen so the board reads on near-black backgrounds */}
        <path
          d="M110 40 L170 62 L110 84 L50 62 Z"
          fill="#FAF9F5"
          opacity="0.08"
        />
        <circle cx="110" cy="62" r="4" fill="#FFCC29" />

        {/* Tassel */}
        <g>
          <path
            d="M179 62 C183 72 184 82 181 92"
            stroke="#FFCC29"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
          <rect x="176" y="91" width="9" height="16" rx="4" fill="#FFCC29" stroke="#B45309" strokeWidth="2" />
          <rect x="177.5" y="88" width="6" height="5" rx="2" fill="#D4A917" />
        </g>
      </g>
    </svg>
  )
}
