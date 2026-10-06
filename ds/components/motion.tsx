'use client';
// VENDORED from worldstreet/design-system by scripts/vendor.mjs. Don't edit: change the design system and re-run it.

import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type ElementType,
  type HTMLAttributes,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';
import { cx } from '../lib/cx';

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Adds `is-in` once the element scrolls into view (then `is-done` to drop will-change). */
export function useInView<T extends Element>(options: { once?: boolean; margin?: string } = {}) {
  const { once = true, margin = '0px 0px -12% 0px' } = options;
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced() || !('IntersectionObserver' in window)) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) io.disconnect();
        } else if (!once) setInView(false);
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once, margin]);
  return [ref, inView] as const;
}

function useDone(active: boolean, ms: number) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setDone(true), ms);
    return () => clearTimeout(t);
  }, [active, ms]);
  return done;
}

/**
 * `as` accepts any element, but the JSX below is typed as a plain HTML element.
 * Left as a bare ElementType, apps that also register other JSX intrinsics
 * (@react-three/fiber's <mesh> and friends) narrow its props to `never`.
 */
function polymorphic(as: ElementType) {
  return as as ComponentType<HTMLAttributes<HTMLElement> & { ref?: Ref<HTMLElement> }>;
}

export type RevealProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  /** Stagger direct children (each gets --i). */
  stagger?: boolean;
  /** Extra delay steps before this element starts. */
  delay?: number;
};

/** Rises 24px and resolves from blur into focus when scrolled into view. */
export function Reveal({ as = 'div', stagger, delay = 0, className, style, children, ...rest }: RevealProps) {
  const Tag = polymorphic(as);
  const [ref, inView] = useInView<HTMLElement>();
  const count = stagger ? Children.count(children) : 1;
  const done = useDone(inView, 1200 + (count + delay) * 60);
  const kids = stagger
    ? Children.map(children, (child, i) =>
        isValidElement<{ style?: CSSProperties }>(child)
          ? cloneElement(child as ReactElement<{ style?: CSSProperties }>, { style: { ...child.props.style, ['--i' as string]: i + delay } })
          : child,
      )
    : children;
  return (
    <Tag
      ref={ref}
      {...rest}
      className={cx(stagger ? 'cx-reveal-group' : 'cx-reveal', inView && 'is-in', done && 'is-done', className)}
      style={stagger ? style : { ...style, ['--i' as string]: delay }}
    >
      {kids}
    </Tag>
  );
}

/** Headline words lift out of their own masks, one after another. */
export function WordReveal({
  text,
  className,
  as = 'span',
  delay = 0,
  fade = 'none',
}: {
  text: string;
  className?: string;
  as?: ElementType;
  delay?: number;
  /** Recreate the headline gradient per word: 'center' (H1) fades both ends, 'end' (H2) fades the tail. */
  fade?: 'none' | 'center' | 'end';
}) {
  const Tag = polymorphic(as);
  const [ref, inView] = useInView<HTMLElement>();
  const words = text.split(' ');
  const alpha = (i: number) => {
    const t = words.length > 1 ? i / (words.length - 1) : 0;
    if (fade === 'center') return 1 - 0.45 * Math.abs(t - 0.5) * 2;
    if (fade === 'end') return 1 - 0.5 * Math.pow(t, 1.4);
    return 1;
  };
  return (
    <Tag ref={ref} className={cx('cx-words', inView && 'is-in', className)} aria-label={text}>
      {words.map((w, i) => (
        <span className="w" key={`${w}-${i}`} aria-hidden="true">
          <span style={{ ['--i' as string]: i + delay, ['--a' as string]: alpha(i).toFixed(2) }}>{w}</span>
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </Tag>
  );
}

export type RollingNumberProps = {
  value: number;
  /** Intl formatting, e.g. { style: 'currency', currency: 'USD' }. */
  format?: Intl.NumberFormatOptions;
  locale?: string;
  className?: string;
};

/**
 * Every digit is a 0–9 strip that springs to its value, staggered from the
 * right, with a hint of motion blur while rolling. Starts from zero when it
 * first scrolls into view, then rolls between values on change.
 */
export function RollingNumber({ value, format, locale = 'en-US', className }: RollingNumberProps) {
  const [ref, inView] = useInView<HTMLSpanElement>();
  const text = new Intl.NumberFormat(locale, format).format(value);
  const shown = inView ? text : text.replace(/\d/g, '0');
  const [rolling, setRolling] = useState(false);
  useEffect(() => {
    if (!inView) return;
    setRolling(true);
    const t = setTimeout(() => setRolling(false), 900);
    return () => clearTimeout(t);
  }, [inView, text]);
  const chars = shown.split('');
  const digitsFromRight = (i: number) => chars.slice(i + 1).filter((c) => /\d/.test(c)).length;
  return (
    <span ref={ref} className={cx('cx-roll', rolling && 'is-rolling', className)} aria-label={text} role="img">
      {chars.map((c, i) =>
        /\d/.test(c) ? (
          <span className="d" key={i} aria-hidden="true">
            <span style={{ ['--n' as string]: Number(c), ['--i' as string]: digitsFromRight(i) }}>
              {Array.from({ length: 10 }, (_, n) => (
                <span key={n}>{n}</span>
              ))}
            </span>
          </span>
        ) : (
          <span key={i} aria-hidden="true">
            {c}
          </span>
        ),
      )}
    </span>
  );
}

export type TiltCardProps = HTMLAttributes<HTMLDivElement> & { max?: number; glare?: boolean };

/** A card that tilts toward the pointer in 3D with a moving glare, and springs back flat on leave. */
export function TiltCard({ max = 8, glare = true, className, children, onPointerMove, onPointerLeave, ...rest }: TiltCardProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const frame = useRef(0);
  const [active, setActive] = useState(false);
  const move = (e: PointerEvent<HTMLDivElement>) => {
    onPointerMove?.(e);
    if (reduced() || e.pointerType === 'touch') return;
    const el = e.currentTarget;
    const { clientX, clientY } = e;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      const px = (clientX - r.left) / r.width;
      const py = (clientY - r.top) / r.height;
      el.style.setProperty('--ry', `${(px - 0.5) * max * 2}deg`);
      el.style.setProperty('--rx', `${(0.5 - py) * max * 2}deg`);
      el.style.setProperty('--gx', `${px * 100}%`);
      el.style.setProperty('--gy', `${py * 100}%`);
    });
    if (!active) setActive(true);
  };
  const leave = (e: PointerEvent<HTMLDivElement>) => {
    onPointerLeave?.(e);
    cancelAnimationFrame(frame.current);
    const el = e.currentTarget;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
    setActive(false);
  };
  return (
    <div ref={ref} {...rest} onPointerMove={move} onPointerLeave={leave} className={cx('cx-tilt', active && 'is-active', className)}>
      {children}
      {glare && <span className="cx-glare" aria-hidden="true" />}
    </div>
  );
}

/** Wraps a control so it leans toward the pointer and springs home with a small overshoot. */
export function Magnetic({ strength = 0.3, children, className }: { strength?: number; children: ReactNode; className?: string }) {
  const [active, setActive] = useState(false);
  const move = (e: PointerEvent<HTMLSpanElement>) => {
    if (reduced() || e.pointerType === 'touch') return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${(e.clientX - r.left - r.width / 2) * strength}px`);
    el.style.setProperty('--my', `${(e.clientY - r.top - r.height / 2) * strength}px`);
    if (!active) setActive(true);
  };
  const leave = (e: PointerEvent<HTMLSpanElement>) => {
    e.currentTarget.style.setProperty('--mx', '0px');
    e.currentTarget.style.setProperty('--my', '0px');
    setActive(false);
  };
  return (
    <span className={cx('cx-magnetic', active && 'is-active', className)} style={{ display: 'inline-block' }} onPointerMove={move} onPointerLeave={leave}>
      {children}
    </span>
  );
}

type VTDocument = Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } };

/**
 * Runs `update` inside a View Transition, revealing the new state as a circle
 * spreading from the click point. Falls back to an instant change.
 */
export function useCircleTransition() {
  return useCallback((e: ReactMouseEvent | undefined, update: () => void) => {
    const doc = document as VTDocument;
    if (!doc.startViewTransition || reduced()) return update();
    const x = e?.clientX ?? innerWidth / 2;
    const y = e?.clientY ?? 0;
    const root = document.documentElement;
    root.style.setProperty('--vt-x', `${x}px`);
    root.style.setProperty('--vt-y', `${y}px`);
    root.style.setProperty('--vt-r', `${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))}px`);
    doc.startViewTransition(update);
  }, []);
}
