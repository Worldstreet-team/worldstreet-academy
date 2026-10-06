'use client';
// VENDORED from worldstreet/design-system by scripts/vendor.mjs. Don't edit: change the design system and re-run it.

import { type ReactNode } from 'react';
import { cx } from '../lib/cx';

/** 1-based page list with 'gap' markers, e.g. [1,'gap',4,5,6,'gap',20]. */
export function pageRange(page: number, pageCount: number, siblings = 1): (number | 'gap')[] {
  const total = siblings * 2 + 5;
  if (pageCount <= total) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const lo = Math.max(2, Math.min(page - siblings, pageCount - 1 - (siblings * 2 + 1)));
  const hi = Math.min(pageCount - 1, Math.max(page + siblings, 2 + siblings * 2 + 1));
  const out: (number | 'gap')[] = [1];
  if (lo > 2) out.push('gap');
  for (let p = lo; p <= hi; p++) out.push(p);
  if (hi < pageCount - 1) out.push('gap');
  out.push(pageCount);
  return out;
}

export type PaginationProps = {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  siblings?: number;
  className?: string;
  'aria-label'?: string;
};
export function Pagination({ page, pageCount, onChange, siblings = 1, className, 'aria-label': label = 'Pagination' }: PaginationProps) {
  const go = (p: number) => p >= 1 && p <= pageCount && p !== page && onChange(p);
  return (
    <nav aria-label={label}>
      <div className={cx('cx-pager', className)}>
        <button type="button" aria-label="Previous page" aria-disabled={page <= 1 || undefined} onClick={() => go(page - 1)}>
          ‹
        </button>
        {pageRange(page, pageCount, siblings).map((p, i) =>
          p === 'gap' ? (
            <span key={`g${i}`} aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              aria-label={`Page ${p}`}
              aria-current={p === page ? 'page' : undefined}
              onClick={() => go(p)}
            >
              {p}
            </button>
          ),
        )}
        <button type="button" aria-label="Next page" aria-disabled={page >= pageCount || undefined} onClick={() => go(page + 1)}>
          ›
        </button>
      </div>
    </nav>
  );
}

export type Crumb = { label: ReactNode; href?: string };
export function Breadcrumbs({ items, className, 'aria-label': label = 'Breadcrumb' }: { items: Crumb[]; className?: string; 'aria-label'?: string }) {
  return (
    <nav aria-label={label}>
      <ol className={cx('cx-crumbs', className)}>
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i}>
              {last || !c.href ? <span aria-current={last ? 'page' : undefined}>{c.label}</span> : <a href={c.href}>{c.label}</a>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
