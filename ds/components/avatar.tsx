// VENDORED from worldstreet/design-system by scripts/vendor.mjs. Don't edit: change the design system and re-run it.
import { type HTMLAttributes } from 'react';
import { cx } from '../lib/cx';

export type AvatarProps = HTMLAttributes<HTMLSpanElement> & {
  src?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Shows the online dot. */
  status?: boolean;
  brand?: boolean;
};
export function initials(name = ''): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
export function Avatar({ src, name, size = 'md', status, brand, className, ...rest }: AvatarProps) {
  return (
    <span
      role="img"
      aria-label={name}
      {...rest}
      className={cx('cx-avatar', size !== 'md' && `cx-avatar--${size}`, brand && 'cx-avatar--brand', className)}
    >
      {src ? <img src={src} alt="" /> : <span aria-hidden="true">{initials(name)}</span>}
      {status && <span className="cx-avatar-status" aria-hidden="true" />}
    </span>
  );
}
