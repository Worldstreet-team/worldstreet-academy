'use client';
// VENDORED from worldstreet/design-system by scripts/vendor.mjs. Don't edit: change the design system and re-run it.

import { type AnchorHTMLAttributes, type ButtonHTMLAttributes, type MouseEvent } from 'react';
import { cx } from '../lib/cx';

type ButtonOwnProps = {
  /** 'aurora' is primary with pooled light and a hover sheen: the one action per view you most want pressed. */
  variant?: 'primary' | 'aurora' | 'ghost' | 'quiet' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  /** Square icon-only button (.cx-btn--icon). Give it an aria-label. */
  icon?: boolean;
  /** Nudges the trailing svg on hover (.cx-btn--arrow). */
  arrow?: boolean;
  block?: boolean;
  /** Sets aria-busy (spinner) and blocks interaction. */
  loading?: boolean;
  disabled?: boolean;
};
export type ButtonProps = ButtonOwnProps &
  (
    | ({ href?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>)
    | ({ href: string } & AnchorHTMLAttributes<HTMLAnchorElement>)
  );

export function Button(props: ButtonProps) {
  const { variant = 'primary', size = 'md', icon, arrow, block, loading, disabled, className, children, ...rest } = props;
  const cls = cx(
    'cx-btn',
    variant !== 'primary' && `cx-btn--${variant}`,
    size !== 'md' && `cx-btn--${size}`,
    icon && 'cx-btn--icon',
    arrow && 'cx-btn--arrow',
    block && 'cx-btn--block',
    className,
  );
  if (rest.href !== undefined) {
    const { onClick, ...anchor } = rest as AnchorHTMLAttributes<HTMLAnchorElement>;
    const inert = disabled || loading;
    return (
      <a
        {...anchor}
        className={cls}
        aria-disabled={inert || undefined}
        aria-busy={loading || undefined}
        tabIndex={inert ? -1 : anchor.tabIndex}
        onClick={(e: MouseEvent<HTMLAnchorElement>) => {
          if (inert) return e.preventDefault();
          onClick?.(e);
        }}
      >
        {children}
      </a>
    );
  }
  const { type = 'button', ...button } = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button {...button} type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined}>
      {children}
    </button>
  );
}
