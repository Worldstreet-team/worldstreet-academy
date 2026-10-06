'use client';
// VENDORED from worldstreet/design-system by scripts/vendor.mjs. Don't edit: change the design system and re-run it.

import { useCallback, useRef, type HTMLAttributes, type PointerEvent } from 'react';
import { cx } from '../lib/cx';

export type SpotlightCardProps = HTMLAttributes<HTMLDivElement> & { lit?: boolean };

/**
 * A card with a soft ember light and a lit border that follow the cursor.
 * Writes --mx/--my on pointer move (one rAF per frame); CSS does the rest.
 */
export function SpotlightCard({ lit = true, className, children, onPointerMove, ...rest }: SpotlightCardProps) {
  const frame = useRef(0);
  const move = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      onPointerMove?.(e);
      const el = e.currentTarget;
      const { clientX, clientY } = e;
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${clientX - r.left}px`);
        el.style.setProperty('--my', `${clientY - r.top}px`);
      });
    },
    [onPointerMove],
  );
  return (
    <div {...rest} onPointerMove={move} className={cx('cx-card', 'cx-spotlight', lit && 'cx-lit', className)}>
      {lit && <span className="cx-lit-2" aria-hidden="true" />}
      {children}
    </div>
  );
}
