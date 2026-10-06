'use client';
// VENDORED from worldstreet/design-system by scripts/vendor.mjs. Don't edit: change the design system and re-run it.

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from '../lib/cx';

export type TabItem<V extends string = string> = { value: V; label: ReactNode; disabled?: boolean; panelId?: string };
export type TabsProps<V extends string = string> = {
  items: TabItem<V>[];
  value: V;
  onChange: (value: V) => void;
  variant?: 'segmented' | 'line';
  className?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
};
export function Tabs<V extends string = string>({ items, value, onChange, variant = 'segmented', className, ...aria }: TabsProps<V>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const list = useRef<HTMLDivElement | null>(null);
  // Sliding thumb: measure the selected tab, glide the indicator there on a spring.
  // Until measured (SSR / no JS) the selected tab keeps its own background.
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);
  const useIsoLayout = typeof window === 'undefined' ? useEffect : useLayoutEffect;
  useIsoLayout(() => {
    const measure = () => {
      const el = refs.current[items.findIndex((t) => t.value === value)];
      if (el) setThumb({ x: el.offsetLeft, w: el.offsetWidth });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (list.current) ro.observe(list.current);
    return () => ro.disconnect();
  }, [value, items]);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const enabled = items.map((t, i) => (t.disabled ? -1 : i)).filter((i) => i >= 0);
    if (!enabled.length) return;
    const cur = enabled.indexOf(items.findIndex((t) => t.value === value));
    let next: number | undefined;
    if (e.key === 'ArrowRight') next = enabled[(cur + 1) % enabled.length];
    else if (e.key === 'ArrowLeft') next = enabled[(cur - 1 + enabled.length) % enabled.length];
    else if (e.key === 'Home') next = enabled[0];
    else if (e.key === 'End') next = enabled[enabled.length - 1];
    if (next === undefined) return;
    e.preventDefault();
    refs.current[next]?.focus();
    onChange(items[next].value);
  };
  return (
    <div
      ref={list}
      role="tablist"
      {...aria}
      className={cx('cx-tabs', variant === 'line' && 'cx-tabs--line', thumb && 'cx-tabs--slide', className)}
      style={thumb ? ({ '--x': `${thumb.x}px`, '--w': `${thumb.w}px` } as CSSProperties) : undefined}
      onKeyDown={onKeyDown}
    >
      {items.map((t, i) => {
        const selected = t.value === value;
        return (
          <button
            key={t.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            className="cx-tab"
            aria-selected={selected}
            aria-controls={t.panelId}
            tabIndex={selected ? 0 : -1}
            disabled={t.disabled}
            onClick={() => onChange(t.value)}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
