// VENDORED from worldstreet/design-system by scripts/vendor.mjs. Don't edit: change the design system and re-run it.
import { type AnchorHTMLAttributes, type HTMLAttributes } from 'react';
import { cx } from '../lib/cx';

export type OrbPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
const ORB_CLASS: Record<OrbPosition, string> = {
  'top-left': 'cx-orb--tl',
  'top-right': 'cx-orb--tr',
  'bottom-left': 'cx-orb--bl',
  'bottom-right': 'cx-orb--br',
  center: 'cx-orb--center',
};

export type AuroraVariant = 'bloom' | 'ribbon' | 'low' | 'hover' | 'mesh' | 'curtain';

/** The animated aurora layer on its own: place as the first child of any positioned, clipped box. */
export function Aurora({ variant = 'bloom', className }: { variant?: AuroraVariant; className?: string }) {
  return <span className={cx('cx-aurora', variant !== 'bloom' && `cx-aurora--${variant}`, className)} aria-hidden="true" />;
}

export type CardProps = HTMLAttributes<HTMLElement> & {
  /** Corner-lit hairline (default true). */
  lit?: boolean;
  interactive?: boolean;
  elevated?: boolean;
  orb?: OrbPosition;
  /** Animated aurora layer in the theme's ember palette. */
  aurora?: AuroraVariant;
  /** Renders an <a> (implies interactive). */
  href?: string;
  as?: 'div' | 'article' | 'section' | 'li';
};
export function Card({ lit = true, interactive, elevated, orb, aurora, href, as = 'div', className, children, ...rest }: CardProps) {
  const cls = cx('cx-card', lit && 'cx-lit', (interactive || href) && 'cx-card--interactive', elevated && 'cx-card--elevated', className);
  const inner = (
    <>
      {aurora && <Aurora variant={aurora} />}
      {orb && <span className={cx('cx-orb', ORB_CLASS[orb])} aria-hidden="true" />}
      {lit && <span className="cx-lit-2" aria-hidden="true" />}
      {children}
    </>
  );
  if (href) {
    return (
      <a {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)} href={href} className={cls}>
        {inner}
      </a>
    );
  }
  const Tag = as;
  return (
    <Tag {...rest} className={cls}>
      {inner}
    </Tag>
  );
}
