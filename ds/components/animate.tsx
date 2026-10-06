'use client';
// VENDORED from worldstreet/design-system by scripts/vendor.mjs. Don't edit: change the design system and re-run it.

import { Children, cloneElement, isValidElement, useCallback, useEffect, useState, type HTMLAttributes, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { cx } from '../lib/cx';

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

type Point = { clientX: number; clientY: number } | { x: number; y: number };

/**
 * Throws sparks of light from a point: payment sent, goal reached, streak kept.
 *   const burst = useBurst();
 *   <Button onClick={(e) => { send(); burst(e); }}>Send</Button>
 * Sparks live on <body> for under a second and remove themselves.
 */
export function useBurst({ count = 18, spread = 120 }: { count?: number; spread?: number } = {}) {
  return useCallback(
    (at: Point) => {
      if (typeof document === 'undefined' || reduced()) return;
      const x = 'clientX' in at ? at.clientX : at.x;
      const y = 'clientY' in at ? at.clientY : at.y;
      const host = document.createElement('div');
      host.className = 'cx-burst';
      host.setAttribute('aria-hidden', 'true');
      host.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      // Burst inherits the brand + theme tokens of whatever was clicked
      const scope = document.elementFromPoint(x, y)?.closest('[data-brand]') ?? document.body;
      host.appendChild(document.createElement('b'));
      for (let i = 0; i < count; i++) {
        const spark = document.createElement('i');
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const dist = spread * (0.45 + Math.random() * 0.75);
        spark.style.setProperty('--x', `${Math.cos(angle) * dist}px`);
        spark.style.setProperty('--y', `${Math.sin(angle) * dist + 18}px`); // a touch of gravity
        spark.style.setProperty('--s', `${5 + Math.random() * 7}px`);
        spark.style.setProperty('--d', `${700 + Math.random() * 500}ms`);
        spark.style.setProperty('--r', `${Math.random() * 360}deg`);
        host.appendChild(spark);
      }
      scope.appendChild(host);
      setTimeout(() => host.remove(), 1400);
    },
    [count, spread],
  );
}

/**
 * Light spreading from wherever a surface is pressed.
 *   const ripple = useRipple();
 *   <Card onPointerDown={ripple}>…</Card>
 */
export function useRipple() {
  return useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (reduced()) return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.classList.add('cx-ripple-host');
    const dot = document.createElement('span');
    dot.className = 'cx-ripple';
    dot.setAttribute('aria-hidden', 'true');
    dot.style.setProperty('--x', `${e.clientX - r.left}px`);
    dot.style.setProperty('--y', `${e.clientY - r.top}px`);
    dot.style.setProperty('--size', `${Math.hypot(r.width, r.height) * 2}px`);
    el.appendChild(dot);
    dot.addEventListener('animationend', () => dot.remove(), { once: true });
  }, []);
}

const NOISE = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&$+=';

/**
 * Characters settle out of noise, left to right: confirmations, references,
 * reveals of a figure. Re-runs when `text` changes. Screen readers get the text at once.
 */
export function ScrambleText({ text, duration = 900, className }: { text: string; duration?: number; className?: string }) {
  const [out, setOut] = useState(text);
  const [settled, setSettled] = useState(text.length);
  useEffect(() => {
    if (reduced()) {
      setOut(text);
      setSettled(text.length);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const done = Math.floor(t * text.length);
      let s = text.slice(0, done);
      for (let i = done; i < text.length; i++) s += text[i] === ' ' ? ' ' : NOISE[(Math.random() * NOISE.length) | 0];
      setOut(s);
      setSettled(done);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [text, duration]);
  return (
    <span className={cx('cx-scramble', className)}>
      <span className="cx-sr-only">{text}</span>
      <span aria-hidden="true">
        {out.slice(0, settled)}
        <span className="n">{out.slice(settled)}</span>
      </span>
    </span>
  );
}

export type FlipCardProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  front: ReactNode;
  back: ReactNode;
  /** Controlled state; leave undefined to flip on click / Enter / Space. */
  flipped?: boolean;
  onFlip?: (flipped: boolean) => void;
  /** Accessible name for the control, e.g. "Card details". */
  label?: string;
};

/** A card with two faces that turns over on the bouncy spring. */
export function FlipCard({ front, back, flipped, onFlip, label = 'Flip card', className, ...rest }: FlipCardProps) {
  const [own, setOwn] = useState(false);
  const on = flipped ?? own;
  const toggle = () => {
    const next = !on;
    if (flipped === undefined) setOwn(next);
    onFlip?.(next);
  };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  };
  return (
    <div {...rest} role="button" tabIndex={0} aria-pressed={on} aria-label={label} onClick={toggle} onKeyDown={key} className={cx('cx-flip', on && 'is-flipped', className)}>
      <div className="cx-flip__inner">
        <div className="cx-flip__face" aria-hidden={on}>{front}</div>
        <div className="cx-flip__face cx-flip__face--back" aria-hidden={!on}>{back}</div>
      </div>
    </div>
  );
}

/** An endless row that pauses on hover. Children are rendered twice for the loop. */
export function Marquee({ children, speed = 40, reverse, className }: { children: ReactNode; speed?: number; reverse?: boolean; className?: string }) {
  return (
    <div className={cx('cx-marquee', className)}>
      <div style={{ animationDuration: `${speed}s`, animationDirection: reverse ? 'reverse' : undefined }}>
        {children}
        {Children.map(children, (child, i) =>
          isValidElement<Record<string, unknown>>(child) ? cloneElement(child, { key: `dup-${i}`, 'aria-hidden': true }) : child,
        )}
      </div>
    </div>
  );
}

/** A hairline of aurora light across the top of the page that fills as you read. CSS-only. */
export function ScrollProgress() {
  return <div className="cx-scroll-progress" aria-hidden="true" />;
}
