// VENDORED from worldstreet/design-system by scripts/vendor.mjs. Don't edit: change the design system and re-run it.
import { type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../lib/cx';

export type ProgressProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  value?: number;
  indeterminate?: boolean;
  tone?: 'brand' | 'gain';
  label?: string;
};
export function Progress({ value = 0, indeterminate, tone = 'brand', label, className, ...rest }: ProgressProps) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : v}
      {...rest}
      className={cx('cx-progress', tone === 'gain' && 'cx-progress--gain', indeterminate && 'cx-progress--indeterminate', className)}
    >
      <span style={indeterminate ? undefined : ({ '--value': v } as CSSProperties)} />
    </div>
  );
}

export type StepsProps = Omit<HTMLAttributes<HTMLOListElement>, 'children'> & {
  steps: ReactNode[];
  /** Zero-based index of the current step. */
  current: number;
};
export function Steps({ steps, current, className, ...rest }: StepsProps) {
  return (
    <ol {...rest} className={cx('cx-steps', className)}>
      {steps.map((s, i) => (
        <li key={i} data-state={i < current ? 'done' : undefined} aria-current={i === current ? 'step' : undefined}>
          <span>{s}</span>
        </li>
      ))}
    </ol>
  );
}
