'use client';
// VENDORED from worldstreet/design-system by scripts/vendor.mjs. Don't edit: change the design system and re-run it.

import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import { Button } from './button';

function useDialog(open: boolean, onClose?: () => void) {
  const ref = useRef<HTMLDialogElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);
  const handlers = {
    // Esc fires cancel then close; backdrop click is detected as a click on the <dialog> box itself.
    onClose: () => onCloseRef.current?.(),
    onClick: (e: MouseEvent<HTMLDialogElement>) => {
      if (e.target === e.currentTarget) e.currentTarget.close();
    },
  };
  return { ref, handlers };
}

export type ModalProps = {
  open: boolean;
  onClose?: () => void;
  title?: ReactNode;
  children?: ReactNode;
  /** Buttons, right-aligned in .cx-modal-actions. */
  actions?: ReactNode;
  className?: string;
  'aria-label'?: string;
};
export function Modal({ open, onClose, title, children, actions, className, 'aria-label': ariaLabel }: ModalProps) {
  const { ref, handlers } = useDialog(open, onClose);
  const titleId = useId();
  return (
    <dialog
      ref={ref}
      className={cx('cx-modal', className)}
      aria-labelledby={title ? titleId : undefined}
      aria-label={ariaLabel}
      {...handlers}
    >
      <div className="cx-card cx-lit">
        <span className="cx-lit-2" aria-hidden="true" />
        {title && (
          <h2 className="cx-h4" id={titleId}>
            {title}
          </h2>
        )}
        {children}
        {actions && <div className="cx-modal-actions">{actions}</div>}
      </div>
    </dialog>
  );
}

export type DrawerProps = ModalProps & { footer?: ReactNode; closeLabel?: string };
export function Drawer({ open, onClose, title, children, footer, className, closeLabel = 'Close', 'aria-label': ariaLabel }: DrawerProps) {
  const { ref, handlers } = useDialog(open, onClose);
  const titleId = useId();
  return (
    <dialog
      ref={ref}
      className={cx('cx-drawer', className)}
      aria-labelledby={title ? titleId : undefined}
      aria-label={ariaLabel}
      {...handlers}
    >
      <div className="cx-drawer-head">
        <h2 className="cx-h4" id={titleId}>
          {title}
        </h2>
        <Button variant="quiet" size="sm" icon aria-label={closeLabel} onClick={() => ref.current?.close()}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </Button>
      </div>
      <div className="cx-drawer-body">{children}</div>
      {footer && <div className="cx-drawer-foot">{footer}</div>}
    </dialog>
  );
}
