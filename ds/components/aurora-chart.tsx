'use client';
// VENDORED from worldstreet/design-system by scripts/vendor.mjs. Don't edit: change the design system and re-run it.

import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '../lib/cx';

/** Smooth path through points (Catmull-Rom → cubic Bézier). */
function smooth(pts: [number, number][]): string {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i - 1] ?? pts[i];
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const [x3, y3] = pts[i + 2] ?? pts[i + 1];
    const t = 0.18;
    d += ` C${x1 + (x2 - x0) * t},${y1 + (y2 - y0) * t} ${x2 - (x3 - x1) * t},${y2 - (y3 - y1) * t} ${x2},${y2}`;
  }
  return d;
}

export type AuroraChartProps = {
  data: number[];
  height?: number;
  /** Text alternative, e.g. "Balance up 4.2% over 12 weeks". */
  label: string;
  className?: string;
};

/**
 * The balance history drawn as the aurora itself: a luminous ridge with
 * shimmering vertical rays, a glowing line that draws once, and a pulse on
 * the latest value. Measures its own width so nothing is stretched.
 */
export function AuroraChart({ data, height = 160, label, className }: AuroraChartProps) {
  const id = useId().replace(/:/g, '');
  const ref = useRef<SVGSVGElement | null>(null);
  const [w, setW] = useState(640);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(120, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pad = 14;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i): [number, number] => [(i / (data.length - 1)) * w, pad + (1 - (v - min) / span) * (height - pad * 2) * 0.85]);
  const line = smooth(pts);
  const area = `${line} L${w},${height} L0,${height} Z`;
  const [lx, ly] = pts[pts.length - 1];

  return (
    <svg ref={ref} className={cx('cx-ridge', className)} height={height} viewBox={`0 0 ${w} ${height}`} role="img" aria-label={label}>
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--cx-aurora-core)" />
          <stop offset=".22" stopColor="var(--cx-aurora-mid)" />
          <stop offset=".6" stopColor="var(--cx-aurora-edge)" />
          <stop offset="1" stopColor="var(--cx-aurora-edge)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-fade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset=".75" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <pattern id={`${id}-rays`} width="6" height={height} patternUnits="userSpaceOnUse">
          <rect x="2.5" width="1.2" height={height} fill="var(--cx-aurora-core)" />
        </pattern>
        <mask id={`${id}-mask`}>
          <path d={area} fill={`url(#${id}-fade)`} />
        </mask>
      </defs>
      <path className="glow" d={area} fill={`url(#${id}-fill)`} />
      <path d={area} fill={`url(#${id}-fill)`} opacity=".55" />
      <g mask={`url(#${id}-mask)`}>
        <rect className="rays" x="0" y="0" width={w + 12} height={height} fill={`url(#${id}-rays)`} opacity=".5" />
      </g>
      <path className="line" d={line} pathLength={1} />
      <circle className="dot-halo" cx={lx} cy={ly} r="7" />
      <circle className="dot" cx={lx} cy={ly} r="3.5" />
    </svg>
  );
}
