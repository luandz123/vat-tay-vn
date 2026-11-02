/** Thành phần giao diện dùng chung theo theme A. */
import type { ComponentProps, ReactNode } from 'react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Variant = 'primary' | 'secondary' | 'ghost' | 'light';
const variants: Record<Variant, string> = {
  primary: 'display btn-slant bg-brand text-white hover:brightness-110 px-7 text-lg',
  light: 'display btn-slant bg-fg text-brand hover:brightness-95 px-7 text-lg',
  secondary: 'border border-line-strong text-fg hover:bg-surface-2 px-4 font-semibold',
  ghost: 'text-brand-text hover:underline px-2 font-semibold',
};

export function buttonClass(variant: Variant = 'secondary', extra?: string) {
  return cx(
    'inline-flex min-h-11 items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50',
    variants[variant],
    extra,
  );
}

export function Button({ variant = 'secondary', className, ...p }: ComponentProps<'button'> & { variant?: Variant }) {
  return <button type="button" className={buttonClass(variant, className)} {...p} />;
}

export const inputClass =
  'min-h-11 w-full border border-line-strong bg-bg px-3 text-base text-fg placeholder:text-muted focus:outline-2 focus:outline-brand-text';

export function Field({
  label,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx('flex flex-col gap-1.5 text-sm text-fg-2', className)}>
      <span>{label}</span>
      {children}
      {hint && !error && <span className="text-xs text-muted">{hint}</span>}
      {error && <span className="text-xs font-semibold text-brand-text">{error}</span>}
    </label>
  );
}

export function Card({ title, children, className, actions }: { title?: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={cx('flex flex-col gap-4 border border-line bg-surface p-4 sm:p-5', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          {title && <h2 className="display text-xl">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Alert({ tone = 'warning', children }: { tone?: 'warning' | 'error' | 'success'; children: ReactNode }) {
  const styles = {
    warning: 'border-gold bg-warning-bg text-warning-text',
    error: 'border-brand bg-[#2a1214] text-[#ffb3b6]',
    success: 'border-success bg-[#0f2418] text-success-text',
  }[tone];
  return (
    <div role="status" className={cx('border px-3 py-2.5 text-sm', styles)}>
      {children}
    </div>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx('display text-2xl leading-none', className)}>
      VẬT<span className="text-brand-text">TAY</span>
      <span className="text-sm text-muted">.vn</span>
    </span>
  );
}

export { cx };
