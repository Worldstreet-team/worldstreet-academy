// VENDORED from worldstreet/design-system by scripts/vendor.mjs. Don't edit: change the design system and re-run it.
import { type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../lib/cx';

export type AlertProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  tone?: 'neutral' | 'gain' | 'loss' | 'warning';
  title?: ReactNode;
  /** An <svg>; the kit sizes and colours it. */
  icon?: ReactNode;
  action?: ReactNode;
};
export function Alert({ tone = 'neutral', title, icon, action, className, children, ...rest }: AlertProps) {
  return (
    <div
      role={tone === 'loss' || tone === 'warning' ? 'alert' : 'status'}
      {...rest}
      className={cx('cx-alert', tone !== 'neutral' && `cx-alert--${tone}`, className)}
    >
      {icon}
      <div>
        {title && <b>{title}</b>}
        {children}
      </div>
      {action}
    </div>
  );
}
