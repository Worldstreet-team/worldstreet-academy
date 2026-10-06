'use client';
// VENDORED from worldstreet/design-system by scripts/vendor.mjs. Don't edit: change the design system and re-run it.

import { createContext, forwardRef, useCallback, useContext, useEffect, useId, useMemo, useRef, type ClipboardEvent, type HTMLAttributes, type InputHTMLAttributes, type KeyboardEvent, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cx } from '../lib/cx';

type FieldCtx = { id: string; describedBy?: string; invalid: boolean };
const FieldContext = createContext<FieldCtx | null>(null);

/** Wires id / aria-describedby / aria-invalid from the nearest <Field>. */
function useFieldProps<P extends { id?: string; 'aria-describedby'?: string; 'aria-invalid'?: InputHTMLAttributes<HTMLInputElement>['aria-invalid'] }>(p: P) {
  const f = useContext(FieldContext);
  if (!f) return p;
  return {
    ...p,
    id: p.id ?? f.id,
    'aria-describedby': cx(f.describedBy, p['aria-describedby']) || undefined,
    'aria-invalid': p['aria-invalid'] ?? (f.invalid || undefined),
  };
}

export type FieldProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  label?: ReactNode;
  help?: ReactNode;
  /** Replaces help and puts the field in its error state. */
  error?: ReactNode;
  optional?: boolean;
  /** Override the generated control id. */
  id?: string;
  children: ReactNode;
};
export function Field({ label, help, error, optional, id, className, children, ...rest }: FieldProps) {
  const auto = useId();
  const controlId = id ?? `cx-f${auto}`;
  const helpId = `${controlId}-help`;
  const msg = error ?? help;
  const ctx = useMemo<FieldCtx>(
    () => ({ id: controlId, describedBy: msg ? helpId : undefined, invalid: !!error }),
    [controlId, helpId, msg, error],
  );
  return (
    <div {...rest} className={cx('cx-field', error != null && error !== false && 'cx-field--error', className)}>
      {label && (
        <label className="cx-label" htmlFor={controlId}>
          <span>{label}</span>
          {optional && <span className="opt">Optional</span>}
        </label>
      )}
      <FieldContext.Provider value={ctx}>{children}</FieldContext.Provider>
      {msg && (
        <div className="cx-help" id={helpId} role={error ? 'alert' : undefined}>
          {msg}
        </div>
      )}
    </div>
  );
}

export type InputProps = InputHTMLAttributes<HTMLInputElement>;
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} {...useFieldProps(rest)} className={cx('cx-input', className)} />;
});

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} {...useFieldProps(rest)} className={cx('cx-textarea', className)} />;
});

export type SelectOption = { value: string; label: ReactNode; disabled?: boolean };
export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { options?: SelectOption[] };
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ className, options, children, ...rest }, ref) {
  return (
    <select ref={ref} {...useFieldProps(rest)} className={cx('cx-select', className)}>
      {options?.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
      {children}
    </select>
  );
});

export type AmountInputProps = Omit<InputProps, 'type'> & { currency?: ReactNode; wrapperClassName?: string };
export const AmountInput = forwardRef<HTMLInputElement, AmountInputProps>(function AmountInput(
  { currency = '$', wrapperClassName, className, ...rest },
  ref,
) {
  const local = useRef<HTMLInputElement | null>(null);
  const setRef = useCallback(
    (el: HTMLInputElement | null) => {
      local.current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) ref.current = el;
    },
    [ref],
  );
  return (
    <div className={cx('cx-amount', wrapperClassName)} onClick={() => local.current?.focus()}>
      <span aria-hidden="true">{currency}</span>
      <input ref={setRef} type="text" inputMode="decimal" autoComplete="off" {...useFieldProps(rest)} className={className} />
    </div>
  );
});

export type OtpInputProps = {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  /** Digits only by default. */
  pattern?: RegExp;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
};
export function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  pattern = /\d/,
  autoFocus,
  disabled,
  className,
  'aria-label': groupLabel = 'Verification code',
}: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const chars = Array.from({ length }, (_, i) => value[i] ?? '');
  const focus = (i: number) => refs.current[Math.max(0, Math.min(length - 1, i))]?.focus();

  const commit = (next: string[]) => {
    const v = next.join('').slice(0, length);
    onChange(v);
    if (v.length === length && next.every(Boolean)) onComplete?.(v);
  };

  const setAt = (i: number, input: string) => {
    const valid = [...input].filter((ch) => pattern.test(ch));
    if (!valid.length) return;
    const next = [...chars];
    let j = i;
    for (const ch of valid) {
      if (j >= length) break;
      next[j++] = ch;
    }
    commit(next);
    focus(j);
  };

  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const next = [...chars];
      if (next[i]) next[i] = '';
      else if (i > 0) {
        next[i - 1] = '';
        focus(i - 1);
      }
      commit(next);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focus(i - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      focus(i + 1);
    }
  };

  const onPaste = (i: number, e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    setAt(i, e.clipboardData.getData('text'));
  };

  return (
    <div className={cx('cx-otp', className)} role="group" aria-label={groupLabel}>
      {chars.map((ch, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={ch}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          autoFocus={autoFocus && i === 0}
          disabled={disabled}
          aria-label={`Digit ${i + 1} of ${length}`}
          onChange={(e) => setAt(i, e.target.value.replace(ch, '') || e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={(e) => onPaste(i, e)}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}

type CheckProps = Omit<InputProps, 'type'> & { label?: ReactNode; labelClassName?: string };

export type CheckboxProps = CheckProps & { indeterminate?: boolean };
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, labelClassName, indeterminate, children, className, ...rest },
  ref,
) {
  const local = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (local.current) local.current.indeterminate = !!indeterminate;
  }, [indeterminate]);
  return (
    <label className={cx('cx-check', labelClassName)}>
      <input
        {...rest}
        ref={(el) => {
          local.current = el;
          if (typeof ref === 'function') ref(el);
          else if (ref) ref.current = el;
        }}
        type="checkbox"
        className={className}
        aria-checked={indeterminate ? 'mixed' : undefined}
      />
      {(label ?? children) != null && <span>{label ?? children}</span>}
    </label>
  );
});

export type RadioProps = CheckProps;
export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio({ label, labelClassName, children, className, ...rest }, ref) {
  return (
    <label className={cx('cx-check', labelClassName)}>
      <input {...rest} ref={ref} type="radio" className={className} />
      {(label ?? children) != null && <span>{label ?? children}</span>}
    </label>
  );
});

export type SwitchProps = CheckProps;
export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch({ label, labelClassName, children, className, ...rest }, ref) {
  return (
    <label className={cx('cx-check', labelClassName)}>
      <input
        {...rest}
        ref={ref}
        type="checkbox"
        role="switch"
        aria-checked={rest.checked ?? undefined}
        className={cx('cx-switch', className)}
      />
      {(label ?? children) != null && <span>{label ?? children}</span>}
    </label>
  );
});
