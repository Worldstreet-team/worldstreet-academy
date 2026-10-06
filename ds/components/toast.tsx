'use client';
// VENDORED from worldstreet/design-system by scripts/vendor.mjs. Don't edit: change the design system and re-run it.

import { useSyncExternalStore, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import { Button } from './button';

export type ToastTone = 'gain' | 'loss' | 'warning';
export type ToastData = { id: number; message: ReactNode; tone?: ToastTone; action?: ReactNode; duration?: number };
export type ToastInput = Omit<ToastData, 'id'>;

let toasts: ToastData[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();
const emit = () => listeners.forEach((l) => l());
const EMPTY: ToastData[] = [];

function dismissToast(id: number) {
  clearTimeout(timers.get(id));
  timers.delete(id);
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}
/** Show a toast from anywhere. Returns its id. duration 0 = sticky. */
export function toast(input: ToastInput | ReactNode): number {
  const data: ToastInput =
    input !== null && typeof input === 'object' && 'message' in (input as object) ? (input as ToastInput) : { message: input as ReactNode };
  const id = nextId++;
  toasts = [...toasts, { ...data, id }];
  emit();
  const ms = data.duration ?? 4000;
  if (ms > 0) timers.set(id, setTimeout(() => dismissToast(id), ms));
  return id;
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function useToast() {
  const list = useSyncExternalStore(subscribe, () => toasts, () => EMPTY);
  return { toasts: list, toast, dismiss: dismissToast };
}

export type ToastProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  tone?: ToastTone;
  message: ReactNode;
  action?: ReactNode;
};
export function Toast({ tone = 'gain', message, action, className, ...rest }: ToastProps) {
  return (
    <div {...rest} className={cx('cx-toast', tone !== 'gain' && `cx-toast--${tone}`, className)}>
      <span className="dot" aria-hidden="true" />
      <span>{message}</span>
      {action}
    </div>
  );
}

/** Render once near the root. Announces politely. */
export function ToastViewport({ className, dismissLabel = 'Dismiss' }: { className?: string; dismissLabel?: string }) {
  const { toasts: list, dismiss } = useToast();
  return (
    <div className={cx('cx-toast-stack', className)} aria-live="polite" role="status">
      {list.map((t) => (
        <Toast
          key={t.id}
          tone={t.tone}
          message={t.message}
          action={
            t.action ?? (
              <Button variant="quiet" size="sm" onClick={() => dismiss(t.id)}>
                {dismissLabel}
              </Button>
            )
          }
        />
      ))}
    </div>
  );
}
