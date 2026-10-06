// VENDORED from worldstreet/design-system by scripts/vendor.mjs. Don't edit: change the design system and re-run it.
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '../lib/cx';
import { Icon, type IconName } from './icon';

/** A money amount with small, dim cents: $24,180.50 reads like a price, not a cell. */
export function AmountDisplay({ value, currency = '$', className }: { value: number; currency?: string; className?: string }) {
  const [whole, cents] = value.toFixed(2).split('.');
  const formatted = Number(whole).toLocaleString('en-US');
  return (
    <span className={cx('cx-amount-display', className)} aria-label={`${currency}${formatted}.${cents}`}>
      <span className="cur" aria-hidden="true">{currency}</span>
      <span aria-hidden="true">{formatted}</span>
      <span className="cents" aria-hidden="true">.{cents}</span>
    </span>
  );
}

export type ActionProps = ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; primary?: boolean };
/** Round icon button with its label underneath. */
export function Action({ icon, label, primary, className, type = 'button', ...rest }: ActionProps) {
  return (
    <button {...rest} type={type} className={cx('cx-action', primary && 'cx-action--primary', className)}>
      <span>
        <Icon name={icon} tone="current" size={20} />
      </span>
      <span>{label}</span>
    </button>
  );
}

export function Actions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('cx-actions', className)}>{children}</div>;
}

export type PayCardProps = { last4: string; name: string; network?: ReactNode; className?: string };
/** Brushed-ember payment card with a slow sheen. */
export function PayCard({ last4, name, network, className }: PayCardProps) {
  return (
    <div className={cx('cx-paycard', className)} role="img" aria-label={`Card ending ${last4}, ${name}`}>
      <div className="top">
        <span className="chip" />
        <Icon name="sparkle" tone="white" size={20} />
      </div>
      <div className="bottom">
        <div>
          <div className="num">•••• {last4}</div>
          <div className="name">{name}</div>
        </div>
        {network}
      </div>
    </div>
  );
}

/** Thin spend-vs-limit meter. */
export function Limit({ spent, limit, currency = '$' }: { spent: number; limit: number; currency?: string }) {
  const pct = Math.min(100, Math.round((spent / limit) * 100));
  const f = (n: number) => `${currency}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return (
    <div className="cx-limit">
      <div className="bar" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Spend against limit">
        <span style={{ ['--value' as string]: pct }} />
      </div>
      <div className="row">
        <span><b>{f(spent)}</b> spent</span>
        <span>{f(limit)} limit</span>
      </div>
    </div>
  );
}
