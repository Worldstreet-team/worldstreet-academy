// VENDORED from worldstreet/design-system by scripts/vendor.mjs. Don't edit: change the design system and re-run it.
import { type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import { DeltaChip } from './chip';

/** Build line + area paths in a 100×H viewBox. */
export function sparkPaths(data: number[], h = 48, pad = 2): { line: string; area: string } {
  if (data.length === 0) return { line: '', area: '' };
  const pts = data.length === 1 ? [data[0], data[0]] : data;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const xy = pts.map((v, i) => [(i / (pts.length - 1)) * 100, pad + (1 - (v - min) / span) * (h - pad * 2)] as const);
  const f = (n: number) => Number(n.toFixed(2));
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${f(x)} ${f(y)}`).join(' ');
  return { line, area: `${line} L100 ${h} L0 ${h} Z` };
}

export type SparklineProps = {
  data: number[];
  /** auto = gain/loss by first→last direction. */
  tone?: 'neutral' | 'gain' | 'loss' | 'auto';
  area?: boolean;
  height?: number;
  className?: string;
  /** Accessible summary; omitted = decorative. */
  label?: string;
};
export function Sparkline({ data, tone = 'neutral', area = true, height = 48, className, label }: SparklineProps) {
  const { line, area: areaD } = sparkPaths(data, height);
  const dir = data.length > 1 ? data[data.length - 1] - data[0] : 0;
  const t = tone === 'auto' ? (dir > 0 ? 'gain' : dir < 0 ? 'loss' : 'neutral') : tone;
  return (
    <svg
      className={cx('cx-spark', t !== 'neutral' && `cx-spark--${t}`, className)}
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {area && <path className="area" d={areaD} />}
      <path d={line} />
    </svg>
  );
}

export type StatProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  label: ReactNode;
  value: ReactNode;
  /** Percent change → DeltaChip. */
  delta?: number;
  /** Secondary text next to the delta. */
  foot?: ReactNode;
  sparkline?: number[];
};
export function Stat({ label, value, delta, foot, sparkline, className, ...rest }: StatProps) {
  return (
    <div {...rest} className={cx('cx-stat', className)}>
      <div className="cx-stat-label">{label}</div>
      <div className="cx-stat-value">{value}</div>
      {(delta !== undefined || foot) && (
        <div className="cx-stat-foot">
          {delta !== undefined && <DeltaChip value={delta} />}
          {foot}
        </div>
      )}
      {sparkline && sparkline.length > 0 && (
        <Sparkline data={sparkline} tone={delta === undefined ? 'auto' : delta > 0 ? 'gain' : delta < 0 ? 'loss' : 'neutral'} />
      )}
    </div>
  );
}
