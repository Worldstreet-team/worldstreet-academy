'use client';
// VENDORED from worldstreet/design-system by scripts/vendor.mjs. Don't edit: change the design system and re-run it.

import { useEffect, useRef, type ComponentType, type CSSProperties, type ElementType, type HTMLAttributes, type ReactNode, type Ref } from 'react';
import { cx } from '../lib/cx';

/** `as` props: a plain element type is too wide for JSX (R3F intrinsics), so narrow it. */
function polymorphic(as: ElementType) {
  return as as ComponentType<HTMLAttributes<HTMLElement> & { ref?: Ref<HTMLElement> }>;
}

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * A slowly turning ring of aurora light round one child (usually a Card), with
 * a soft glow bleeding outside it. Use it for the single featured thing in a view.
 */
export function AuroraFrame({ fast, className, children, ...rest }: HTMLAttributes<HTMLDivElement> & { fast?: boolean }) {
  return (
    <div {...rest} className={cx('cx-aurora-frame', fast && 'cx-aurora-frame--fast', className)}>
      <span className="cx-aurora-frame__glow" aria-hidden="true" />
      {children}
    </div>
  );
}

export type AuroraFieldProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  /** Diameter of the light pool in px (default 520). */
  size?: number;
  /** 0–1: how quickly the light catches the pointer (default 0.08, liquid). */
  ease?: number;
};

/**
 * A section whose aurora pool glides after the pointer like liquid light, with a
 * smaller core trailing behind it. The loop runs only while the light is moving,
 * parks in the centre when the pointer leaves, and never runs under reduced motion.
 */
export function AuroraField({ as = 'div', size = 520, ease = 0.08, className, style, children, ...rest }: AuroraFieldProps) {
  const Tag = polymorphic(as);
  const root = useRef<HTMLElement | null>(null);
  const big = useRef<HTMLSpanElement | null>(null);
  const small = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = root.current;
    if (!el || reduced()) return;
    let raf = 0;
    const target = { x: 0, y: 0 };
    const a = { x: 0, y: 0 };
    const b = { x: 0, y: 0 };
    const centre = () => {
      target.x = el.clientWidth / 2;
      target.y = el.clientHeight * 0.55;
    };
    centre();
    Object.assign(a, target);
    Object.assign(b, target);
    const paint = () => {
      big.current?.style.setProperty('transform', `translate3d(${a.x}px, ${a.y}px, 0)`);
      small.current?.style.setProperty('transform', `translate3d(${b.x}px, ${b.y}px, 0)`);
    };
    const tick = () => {
      a.x += (target.x - a.x) * ease;
      a.y += (target.y - a.y) * ease;
      b.x += (target.x - b.x) * ease * 0.55;
      b.y += (target.y - b.y) * ease * 0.55;
      paint();
      const settled = Math.abs(target.x - b.x) + Math.abs(target.y - b.y) < 0.5;
      raf = settled ? 0 : requestAnimationFrame(tick);
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const r = el.getBoundingClientRect();
      target.x = e.clientX - r.left;
      target.y = e.clientY - r.top;
      kick();
    };
    const leave = () => {
      centre();
      kick();
    };
    paint();
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
    };
  }, [ease]);

  return (
    <Tag ref={root} {...rest} className={cx('cx-aurora-field', className)} style={{ ...style, ['--size' as string]: `${size}px` } as CSSProperties}>
      <span ref={big} className="cx-aurora-field__light" aria-hidden="true" />
      <span ref={small} className="cx-aurora-field__light" aria-hidden="true" />
      {children}
    </Tag>
  );
}

/** The brand ramp flowing slowly through text. One headline per page. */
export function AuroraText({ as = 'span', className, children, ...rest }: HTMLAttributes<HTMLElement> & { as?: ElementType }) {
  const Tag = polymorphic(as);
  return (
    <Tag {...rest} className={cx('cx-aurora-text', className)}>
      {children}
    </Tag>
  );
}

/** A light that breathes behind its child: today's balance, a live dot, whoever is speaking. */
export function AuroraPulse({ live, className, children, ...rest }: HTMLAttributes<HTMLSpanElement> & { live?: boolean; children: ReactNode }) {
  return (
    <span {...rest} className={cx('cx-aurora-pulse', live && 'cx-aurora-pulse--live', className)} style={{ display: 'inline-flex', ...rest.style }}>
      {children}
    </span>
  );
}

/** A spinning ring of aurora light. */
export function AuroraSpinner({ size = 32, label = 'Loading', className }: { size?: number; label?: string; className?: string }) {
  return <span role="status" aria-label={label} className={cx('cx-aurora-spinner', className)} style={{ ['--size' as string]: `${size}px` } as CSSProperties} />;
}

/** Indeterminate progress: a comet of light running along the track. */
export function AuroraBar({ label = 'Loading', className }: { label?: string; className?: string }) {
  return <div role="progressbar" aria-label={label} aria-busy="true" className={cx('cx-aurora-bar', className)} />;
}

/** A hairline divider with a slow glint travelling along it. */
export function AuroraRule({ className }: { className?: string }) {
  return <hr className={cx('cx-aurora-rule', className)} />;
}

/** A light sweep across its parent on hover or keyboard focus. Place inside any clipped box. */
export function Sheen({ className }: { className?: string }) {
  return <span className={cx('cx-sheen', className)} aria-hidden="true" />;
}
