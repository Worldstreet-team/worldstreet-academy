'use client';
// VENDORED from worldstreet/design-system by scripts/vendor.mjs. Don't edit: change the design system and re-run it.

import { useEffect, useRef, useState, type HTMLAttributes } from 'react';
import { cx } from '../lib/cx';
import { Button } from './button';

export type CopyFieldProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  value: string;
  copyLabel?: string;
  copiedLabel?: string;
  onCopy?: (value: string) => void;
};
export function CopyField({ value, copyLabel = 'Copy', copiedLabel = 'Copied', onCopy, className, ...rest }: CopyFieldProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      onCopy?.(value);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked (insecure context / permissions) — leave state as is */
    }
  };
  return (
    <div {...rest} className={cx('cx-copy', className)} data-copied={copied || undefined}>
      <code title={value}>{value}</code>
      <Button variant="quiet" size="sm" onClick={copy} aria-live="polite">
        {copied ? copiedLabel : copyLabel}
      </Button>
    </div>
  );
}
