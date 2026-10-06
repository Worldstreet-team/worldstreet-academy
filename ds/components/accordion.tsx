'use client';
// VENDORED from worldstreet/design-system by scripts/vendor.mjs. Don't edit: change the design system and re-run it.

import { useId, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../lib/cx';

export type AccordionItem = { id?: string; title: ReactNode; content: ReactNode; defaultOpen?: boolean };
export type AccordionProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  items: AccordionItem[];
  /** Prefix each summary with 01, 02… */
  numbered?: boolean;
  /** Only one open at a time (native exclusive <details name>). */
  exclusive?: boolean;
};
export function Accordion({ items, numbered, exclusive, className, ...rest }: AccordionProps) {
  const group = useId();
  return (
    <div {...rest} className={cx('cx-accordion', className)}>
      {items.map((item, i) => (
        <details key={item.id ?? i} open={item.defaultOpen} name={exclusive ? group : undefined}>
          <summary>
            <span>
              {numbered && <span className="idx">{String(i + 1).padStart(2, '0')}</span>}
              {item.title}
            </span>
          </summary>
          <div className="body">{item.content}</div>
        </details>
      ))}
    </div>
  );
}
