/**
 * WorldStreet Academy spot illustrations — hand-authored SVG, themed via the
 * `--ws-*` CSS variables so every piece adapts to dark (near-black + gold) and
 * light (warm paper) automatically.
 *
 * Style contract (per design system):
 * - Layered flat shapes, soft rounded geometry. Surfaces from
 *   `var(--ws-bg-raised)` / `var(--ws-bg-chip)`, outlines `var(--ws-border-hairline)`,
 *   detail strokes `var(--ws-text-subtle)` at low opacity.
 * - Gold (`var(--ws-brand-primary)`) on ONE focal element per piece.
 * - A soft radial gold halo behind each composition (~8% at center). Gradient
 *   stops use literal gold `#FFCC29` because `var()` inside gradient stops is
 *   unreliable cross-browser — the value is identical in both themes.
 * - Idle motion is scoped inside each `<svg>` with a unique class prefix and
 *   wrapped in `prefers-reduced-motion: no-preference`. Animated nodes are
 *   wrapped in a plain `<g>` (no `transform` attribute) so the CSS transform
 *   doesn't clobber SVG positioning transforms.
 */

type ArtProps = {
  className?: string
}

/** Four-point curved sparkle, positioned/scaled via SVG attribute transform. */
const SPARKLE_D =
  "M0 -1 C0.12 -0.32 0.32 -0.12 1 0 C0.32 0.12 0.12 0.32 0 1 C-0.12 0.32 -0.32 0.12 -1 0 C-0.32 -0.12 -0.12 -0.32 0 -1 Z"

function Sparkle({
  x,
  y,
  r,
  className,
}: {
  x: number
  y: number
  r: number
  className?: string
}) {
  return (
    <path
      d={SPARKLE_D}
      transform={`translate(${x} ${y}) scale(${r})`}
      fill="var(--ws-brand-primary)"
      className={className}
    />
  )
}

/** Soft gold halo behind a composition. `id` must be unique per component. */
function Halo({ id, cx = 100, cy = 80 }: { id: string; cx?: number; cy?: number }) {
  return (
    <>
      <defs>
        <radialGradient id={id} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFCC29" stopOpacity="0.08" />
          <stop offset="65%" stopColor="#FFCC29" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#FFCC29" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx={cx} cy={cy} rx={92} ry={64} fill={`url(#${id})`} />
    </>
  )
}

const ROSETTE_SCALLOPS = 10

/** Gold wax-seal rosette mark, drawn at (cx, cy) with outer radius r. */
function RosetteMark({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      {Array.from({ length: ROSETTE_SCALLOPS }, (_, i) => {
        const a = (i * Math.PI * 2) / ROSETTE_SCALLOPS
        return (
          <circle
            key={i}
            cx={cx + Math.cos(a) * r * 0.92}
            cy={cy + Math.sin(a) * r * 0.92}
            r={r * 0.24}
            fill="var(--ws-brand-primary)"
          />
        )
      })}
      <circle cx={cx} cy={cy} r={r} fill="var(--ws-brand-primary)" />
      <circle
        cx={cx}
        cy={cy}
        r={r * 0.66}
        fill="none"
        stroke="rgba(0,0,0,0.18)"
        strokeWidth={Math.max(1, r * 0.11)}
      />
      <path
        d={SPARKLE_D}
        transform={`translate(${cx} ${cy}) scale(${r * 0.36})`}
        fill="rgba(0,0,0,0.22)"
      />
    </g>
  )
}

/**
 * Standalone gold seal rosette — for credential cards (certificates page).
 * No halo, no animation: it's a UI motif, not a spot illustration.
 */
export function SealRosette({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <RosetteMark cx={20} cy={20} r={14} />
    </svg>
  )
}

/** Rolled diploma with gold ribbon band, wax seal and sparkles. */
export function ArtCertificate({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden="true">
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .wsart-cert-float { animation: wsart-cert-float 6s ease-in-out infinite; }
          .wsart-cert-tw1 { animation: wsart-cert-tw 2.8s ease-in-out infinite; }
          .wsart-cert-tw2 { animation: wsart-cert-tw 2.8s ease-in-out 0.9s infinite; }
          .wsart-cert-tw3 { animation: wsart-cert-tw 2.8s ease-in-out 1.7s infinite; }
          @keyframes wsart-cert-float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-3px); }
          }
          @keyframes wsart-cert-tw {
            0%, 100% { opacity: 0.25; }
            50% { opacity: 1; }
          }
        }
      `}</style>
      <Halo id="wsart-cert-halo" />
      <g className="wsart-cert-float">
        {/* Rolled diploma, tilted a touch */}
        <g transform="rotate(-4 100 78)">
          <rect
            x="40"
            y="60"
            width="116"
            height="34"
            rx="17"
            fill="var(--ws-bg-raised)"
            stroke="var(--ws-border-hairline)"
          />
          {/* Faint script lines on the roll */}
          <path
            d="M58 72 H98"
            stroke="var(--ws-text-subtle)"
            strokeOpacity="0.45"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M58 80 H88"
            stroke="var(--ws-text-subtle)"
            strokeOpacity="0.35"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Rolled end (right) with inner curl */}
          <ellipse
            cx="156"
            cy="77"
            rx="9"
            ry="17"
            fill="var(--ws-bg-chip)"
            stroke="var(--ws-border-hairline)"
          />
          <ellipse
            cx="156"
            cy="77"
            rx="3.5"
            ry="7"
            fill="none"
            stroke="var(--ws-text-subtle)"
            strokeOpacity="0.5"
            strokeWidth="1.5"
          />
          {/* Gold ribbon band wrapping the scroll */}
          <rect x="119" y="56" width="14" height="42" rx="4" fill="var(--ws-brand-primary)" />
        </g>
        {/* Ribbon tails, tucked behind the seal */}
        <path d="M121 102 L108 126 L117 123 L120 133 Z" fill="var(--ws-brand-primary)" opacity="0.55" />
        <path d="M131 102 L144 126 L135 123 L132 133 Z" fill="var(--ws-brand-primary)" opacity="0.55" />
        {/* Wax seal */}
        <RosetteMark cx={126} cy={102} r={13} />
      </g>
      <Sparkle x={44} y={42} r={7} className="wsart-cert-tw1" />
      <Sparkle x={162} y={46} r={4.5} className="wsart-cert-tw2" />
      <Sparkle x={52} y={114} r={4} className="wsart-cert-tw3" />
      <circle cx="170" cy="96" r="2" fill="var(--ws-brand-primary)" className="wsart-cert-tw2" />
    </svg>
  )
}

/** Layered bookmark ribbons — the front one gold. */
export function ArtBookmarks({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden="true">
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .wsart-bm-float { animation: wsart-bm-float 5s ease-in-out infinite; }
          .wsart-bm-tw1 { animation: wsart-bm-tw 2.6s ease-in-out infinite; }
          .wsart-bm-tw2 { animation: wsart-bm-tw 2.6s ease-in-out 1.1s infinite; }
          @keyframes wsart-bm-float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-3.5px); }
          }
          @keyframes wsart-bm-tw {
            0%, 100% { opacity: 0.25; }
            50% { opacity: 1; }
          }
        }
      `}</style>
      <Halo id="wsart-bm-halo" />
      {/* Back ribbon */}
      <g transform="translate(56 44) rotate(-14 17 27)" opacity="0.75">
        <path
          d="M0 5 Q0 0 5 0 H29 Q34 0 34 5 V54 L17 42.5 L0 54 Z"
          fill="var(--ws-bg-chip)"
          stroke="var(--ws-border-hairline)"
        />
      </g>
      {/* Middle ribbon */}
      <g transform="translate(84 36) rotate(-2 19 30)">
        <path
          d="M0 5 Q0 0 5 0 H33 Q38 0 38 5 V60 L19 47 L0 60 Z"
          fill="var(--ws-bg-raised)"
          stroke="var(--ws-border-hairline)"
        />
        <path
          d="M8 12 H30"
          stroke="var(--ws-text-subtle)"
          strokeOpacity="0.4"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
      {/* Front ribbon — gold, floating gently */}
      <g className="wsart-bm-float">
        <g transform="translate(114 48) rotate(11 16 25)">
          <path
            d="M0 5 Q0 0 5 0 H27 Q32 0 32 5 V50 L16 39 L0 50 Z"
            fill="var(--ws-brand-primary)"
          />
          <circle cx="16" cy="15" r="4" fill="rgba(0,0,0,0.16)" />
        </g>
      </g>
      <Sparkle x={50} y={112} r={4} className="wsart-bm-tw1" />
      <Sparkle x={152} y={34} r={6} className="wsart-bm-tw2" />
      <circle cx="162" cy="106" r="2" fill="var(--ws-brand-primary)" className="wsart-bm-tw1" />
    </svg>
  )
}

/** Open book with soft page curves, a gold ribbon marker and a floating page. */
export function ArtCourses({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden="true">
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .wsart-course-float { animation: wsart-course-float 5.5s ease-in-out infinite; }
          .wsart-course-tw1 { animation: wsart-course-tw 3s ease-in-out infinite; }
          .wsart-course-tw2 { animation: wsart-course-tw 3s ease-in-out 1s infinite; }
          .wsart-course-tw3 { animation: wsart-course-tw 3s ease-in-out 2s infinite; }
          @keyframes wsart-course-float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-4px); }
          }
          @keyframes wsart-course-tw {
            0%, 100% { opacity: 0.25; }
            50% { opacity: 1; }
          }
        }
      `}</style>
      <Halo id="wsart-course-halo" cx={100} cy={84} />
      {/* Cover */}
      <path
        d="M100 116 C85 106 62 104 38 109 L38 60 C62 55 85 57 100 66 C115 57 138 55 162 60 L162 109 C138 104 115 106 100 116 Z"
        fill="var(--ws-bg-raised)"
        stroke="var(--ws-border-hairline)"
      />
      {/* Pages */}
      <path
        d="M100 108 C87 100 70 98 48 101 L48 64 C70 61 87 63 100 70 Z"
        fill="var(--ws-bg-chip)"
      />
      <path
        d="M100 108 C113 100 130 98 152 101 L152 64 C130 61 113 63 100 70 Z"
        fill="var(--ws-bg-chip)"
        opacity="0.92"
      />
      {/* Text lines following the page curve */}
      <g
        stroke="var(--ws-text-subtle)"
        strokeOpacity="0.4"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      >
        <path d="M58 74 C70 71.5 82 72 92 75" />
        <path d="M58 82 C70 79.5 82 80 92 83" />
        <path d="M58 90 C68 88 78 88.5 88 91" />
        <path d="M142 74 C130 71.5 118 72 108 75" />
        <path d="M142 82 C130 79.5 118 80 108 83" />
      </g>
      {/* Spine */}
      <path d="M100 70 V108" stroke="var(--ws-border-hairline)" strokeWidth="1.5" />
      {/* Gold ribbon marker draping over the right page */}
      <path
        d="M97 67 C98 84 101 98 108 111 L116 106 C110 95 106 82 105 66 Z"
        fill="var(--ws-brand-primary)"
      />
      {/* Floating page */}
      <g className="wsart-course-float">
        <g transform="translate(140 24) rotate(10)">
          <rect
            width="22"
            height="28"
            rx="3"
            fill="var(--ws-bg-chip)"
            stroke="var(--ws-border-hairline)"
          />
          <g
            stroke="var(--ws-text-subtle)"
            strokeOpacity="0.5"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <path d="M5 8 H17" />
            <path d="M5 13 H15" />
            <path d="M5 18 H13" />
          </g>
        </g>
      </g>
      <Sparkle x={36} y={46} r={5} className="wsart-course-tw1" />
      <Sparkle x={172} y={44} r={5.5} className="wsart-course-tw2" />
      <Sparkle x={58} y={122} r={3.5} className="wsart-course-tw3" />
    </svg>
  )
}

/** Two overlapping chat bubbles — the reply gold — with typing dots. */
export function ArtMessages({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden="true">
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .wsart-msg-float { animation: wsart-msg-float 5s ease-in-out infinite; }
          .wsart-msg-dot1 { animation: wsart-msg-dot 1.8s ease-in-out infinite; }
          .wsart-msg-dot2 { animation: wsart-msg-dot 1.8s ease-in-out 0.25s infinite; }
          .wsart-msg-dot3 { animation: wsart-msg-dot 1.8s ease-in-out 0.5s infinite; }
          .wsart-msg-tw1 { animation: wsart-msg-tw 2.7s ease-in-out infinite; }
          .wsart-msg-tw2 { animation: wsart-msg-tw 2.7s ease-in-out 1.2s infinite; }
          @keyframes wsart-msg-float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-3px); }
          }
          @keyframes wsart-msg-dot {
            0%, 60%, 100% { opacity: 0.3; }
            30% { opacity: 1; }
          }
          @keyframes wsart-msg-tw {
            0%, 100% { opacity: 0.25; }
            50% { opacity: 1; }
          }
        }
      `}</style>
      <Halo id="wsart-msg-halo" cx={100} cy={76} />
      {/* Incoming bubble with typing dots */}
      <path
        d="M56 40 H112 C121.9 40 130 48.1 130 58 V82 C130 91.9 121.9 100 112 100 H74 L56 114 L61 100 H56 C46.1 100 38 91.9 38 82 V58 C38 48.1 46.1 40 56 40 Z"
        fill="var(--ws-bg-raised)"
        stroke="var(--ws-border-hairline)"
      />
      <circle cx="66" cy="70" r="4.5" fill="var(--ws-text-subtle)" className="wsart-msg-dot1" />
      <circle cx="84" cy="70" r="4.5" fill="var(--ws-text-subtle)" className="wsart-msg-dot2" />
      <circle cx="102" cy="70" r="4.5" fill="var(--ws-text-subtle)" className="wsart-msg-dot3" />
      {/* Gold reply bubble, floating */}
      <g className="wsart-msg-float">
        <path
          d="M134 26 H160 C166.6 26 172 31.4 172 38 V52 C172 58.6 166.6 64 160 64 H146 L136 73 L139 64 H134 C127.4 64 122 58.6 122 52 V38 C122 31.4 127.4 26 134 26 Z"
          fill="var(--ws-brand-primary)"
        />
        <g stroke="rgba(0,0,0,0.28)" strokeWidth="3" strokeLinecap="round">
          <path d="M134 41 H160" />
          <path d="M134 49 H152" />
        </g>
      </g>
      <Sparkle x={44} y={118} r={4} className="wsart-msg-tw1" />
      <Sparkle x={172} y={86} r={5} className="wsart-msg-tw2" />
    </svg>
  )
}

/** Calendar with an overlapping video tile and a pulsing gold live dot. */
export function ArtMeetings({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden="true">
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .wsart-meet-float { animation: wsart-meet-float 5.5s ease-in-out infinite; }
          .wsart-meet-ping {
            transform-box: fill-box;
            transform-origin: center;
            animation: wsart-meet-ping 2.4s cubic-bezier(0, 0, 0.2, 1) infinite;
          }
          .wsart-meet-tw1 { animation: wsart-meet-tw 2.9s ease-in-out infinite; }
          .wsart-meet-tw2 { animation: wsart-meet-tw 2.9s ease-in-out 1.3s infinite; }
          @keyframes wsart-meet-float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-3px); }
          }
          @keyframes wsart-meet-ping {
            0% { transform: scale(0.7); opacity: 0.7; }
            70%, 100% { transform: scale(2); opacity: 0; }
          }
          @keyframes wsart-meet-tw {
            0%, 100% { opacity: 0.25; }
            50% { opacity: 1; }
          }
        }
      `}</style>
      <Halo id="wsart-meet-halo" />
      {/* Calendar card */}
      <rect
        x="42"
        y="38"
        width="84"
        height="78"
        rx="10"
        fill="var(--ws-bg-raised)"
        stroke="var(--ws-border-hairline)"
      />
      <path
        d="M42 48 C42 42.5 46.5 38 52 38 H116 C121.5 38 126 42.5 126 48 V58 H42 Z"
        fill="var(--ws-bg-chip)"
      />
      {/* Binder rings */}
      <rect x="58" y="30" width="5" height="14" rx="2.5" fill="var(--ws-text-subtle)" opacity="0.7" />
      <rect x="105" y="30" width="5" height="14" rx="2.5" fill="var(--ws-text-subtle)" opacity="0.7" />
      {/* Date dots */}
      <g fill="var(--ws-text-subtle)" opacity="0.35">
        <circle cx="58" cy="72" r="2.8" />
        <circle cx="74" cy="72" r="2.8" />
        <circle cx="90" cy="72" r="2.8" />
        <circle cx="106" cy="72" r="2.8" />
        <circle cx="58" cy="86" r="2.8" />
        <circle cx="74" cy="86" r="2.8" />
        <circle cx="90" cy="86" r="2.8" />
        <circle cx="58" cy="100" r="2.8" />
        <circle cx="74" cy="100" r="2.8" />
      </g>
      {/* Video tile, floating, with live dot */}
      <g className="wsart-meet-float">
        <rect
          x="104"
          y="82"
          width="60"
          height="44"
          rx="9"
          fill="var(--ws-bg-chip)"
          stroke="var(--ws-border-hairline)"
        />
        <g fill="var(--ws-text-subtle)" opacity="0.6">
          <rect x="116" y="97" width="22" height="14" rx="3.5" />
          <path d="M141 100 L150 95.5 V112.5 L141 108 Z" />
        </g>
        <circle
          cx="164"
          cy="82"
          r="5.5"
          fill="none"
          stroke="var(--ws-brand-primary)"
          strokeWidth="2"
          className="wsart-meet-ping"
        />
        <circle cx="164" cy="82" r="5.5" fill="var(--ws-brand-primary)" />
      </g>
      <Sparkle x={36} y={58} r={5} className="wsart-meet-tw1" />
      <Sparkle x={152} y={38} r={4} className="wsart-meet-tw2" />
    </svg>
  )
}

/** Magnifier over a faint result card, with a gold glint. */
export function ArtSearch({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden="true">
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .wsart-srch-float { animation: wsart-srch-float 5s ease-in-out infinite; }
          .wsart-srch-tw1 { animation: wsart-srch-tw 2.8s ease-in-out infinite; }
          .wsart-srch-tw2 { animation: wsart-srch-tw 2.8s ease-in-out 1.2s infinite; }
          @keyframes wsart-srch-float {
            0%, 100% { transform: translate(0, 0); }
            50% { transform: translate(2px, -3px); }
          }
          @keyframes wsart-srch-tw {
            0%, 100% { opacity: 0.25; }
            50% { opacity: 1; }
          }
        }
      `}</style>
      <Halo id="wsart-srch-halo" />
      {/* Faint result card */}
      <g opacity="0.9">
        <rect
          x="40"
          y="38"
          width="88"
          height="66"
          rx="10"
          fill="var(--ws-bg-raised)"
          stroke="var(--ws-border-hairline)"
        />
        <circle cx="56" cy="54" r="6.5" fill="var(--ws-bg-chip)" />
        <g stroke="var(--ws-text-subtle)" strokeLinecap="round">
          <path d="M68 51 H112" strokeOpacity="0.45" strokeWidth="3.5" />
          <path d="M68 58 H98" strokeOpacity="0.35" strokeWidth="3" />
          <path d="M52 74 H116" strokeOpacity="0.35" strokeWidth="3" />
          <path d="M52 84 H104" strokeOpacity="0.3" strokeWidth="3" />
        </g>
      </g>
      {/* Magnifier, drifting gently */}
      <g className="wsart-srch-float">
        <circle
          cx="118"
          cy="80"
          r="27"
          fill="var(--ws-bg-chip)"
          fillOpacity="0.55"
          stroke="var(--ws-text-subtle)"
          strokeWidth="5"
        />
        <path
          d="M137 99 L156 118"
          stroke="var(--ws-text-subtle)"
          strokeWidth="7"
          strokeLinecap="round"
        />
        {/* Gold glint on the glass */}
        <path
          d="M103 70 A19 19 0 0 1 114 62"
          stroke="var(--ws-brand-primary)"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.9"
        />
        <circle cx="124" cy="86" r="3" fill="var(--ws-brand-primary)" opacity="0.8" />
      </g>
      <Sparkle x={156} y={42} r={5} className="wsart-srch-tw1" />
      <Sparkle x={36} y={106} r={4} className="wsart-srch-tw2" />
    </svg>
  )
}
