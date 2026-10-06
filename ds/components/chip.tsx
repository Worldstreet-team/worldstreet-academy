// VENDORED from worldstreet/design-system by scripts/vendor.mjs. Don't edit: change the design system and re-run it.
import { type HTMLAttributes, type ReactNode } from 'react';
import { Tone, cx } from '../lib/cx';

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & { icon?: ReactNode };
export function Badge({ icon, className, children, ...rest }: BadgeProps) {
  // .cx-badge lifts element children above its wash — text must be wrapped.
  return (
    <span {...rest} className={cx('cx-badge', className)}>
      {icon}
      <span>{children}</span>
    </span>
  );
}

export type ChipProps = HTMLAttributes<HTMLSpanElement> & { tone?: Tone; dot?: boolean };
export function Chip({ tone = 'neutral', dot, className, ...rest }: ChipProps) {
  return <span {...rest} className={cx('cx-chip', tone !== 'neutral' && `cx-chip--${tone}`, dot && 'cx-chip--dot', className)} />;
}

export type DeltaChipProps = Omit<ChipProps, 'tone' | 'children'> & {
  /** Percent change, e.g. 2.4 → "▲ 2.40%". */
  value: number;
  digits?: number;
};
export function DeltaChip({ value, digits = 2, ...rest }: DeltaChipProps) {
  const up = value > 0;
  const down = value < 0;
  const pct = `${Math.abs(value).toFixed(digits)}%`;
  return (
    <Chip {...rest} tone={up ? 'gain' : down ? 'loss' : 'neutral'} aria-label={`${up ? 'up' : down ? 'down' : 'unchanged'} ${pct}`}>
      <span aria-hidden="true">
        {up ? '▲ ' : down ? '▼ ' : ''}
        {pct}
      </span>
    </Chip>
  );
}

export type CountProps = HTMLAttributes<HTMLSpanElement> & { value?: number; max?: number; dot?: boolean };
export function Count({ value = 0, max = 99, dot, className, ...rest }: CountProps) {
  return (
    <span {...rest} className={cx('cx-count', dot && 'cx-count--dot', className)}>
      {dot ? null : value > max ? `${max}+` : value}
    </span>
  );
}
