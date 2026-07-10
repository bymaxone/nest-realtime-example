/**
 * @fileoverview Pill button primitive: brand gradient default, per the design system.
 * @layer components
 */

import type { ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

/** Visual style variant. */
export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'destructive';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    'bg-linear-to-r from-brand-500 to-brand-600 text-white shadow-sm hover:shadow-(--shadow-primary) hover:scale-[1.02] active:scale-[0.98]',
  outline:
    'border border-(--glass-border) bg-(--glass-bg) hover:bg-(--glass-bg-hover) text-foreground',
  ghost: 'text-white/70 hover:bg-(--glass-bg-hover) hover:text-foreground',
  destructive: 'bg-(--color-danger) text-white shadow-sm hover:opacity-90',
};

/** Props for {@link Button}, extending the native button element's attributes. */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant. Defaults to `primary`. */
  readonly variant?: ButtonVariant;
}

/** Brand-styled pill button. */
export function Button({ className, variant = 'primary', type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full px-6 text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50',
        VARIANT_CLASS[variant],
        className,
      )}
      {...props}
    />
  );
}
