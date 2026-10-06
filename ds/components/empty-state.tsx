// VENDORED from worldstreet/design-system by scripts/vendor.mjs. Don't edit: change the design system and re-run it.
import { type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../lib/cx';

export type SkeletonProps = HTMLAttributes<HTMLDivElement> & { width?: CSSProperties['width']; height?: CSSProperties['height']; radius?: CSSProperties['borderRadius'] };
export function Skeleton({ width = '100%', height = 16, radius, className, style, ...rest }: SkeletonProps) {
  return <div aria-hidden="true" {...rest} className={cx('cx-skel', className)} style={{ width, height, borderRadius: radius, ...style }} />;
}

export type EmptyStateProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  error?: boolean;
};
export function EmptyState({ icon, title, description, action, error, className, ...rest }: EmptyStateProps) {
  return (
    <div {...rest} className={cx('cx-empty', error && 'cx-empty--error', className)}>
      {icon && <div className="cx-icon-tile">{icon}</div>}
      <h3 className="cx-h4">{title}</h3>
      {description && <p className="cx-small">{description}</p>}
      {action}
    </div>
  );
}
