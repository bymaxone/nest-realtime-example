/**
 * @fileoverview Text input and label primitives, per the design system.
 * @layer components
 */

import type { InputHTMLAttributes, LabelHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

/** Glass-surface text input. */
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-md border border-(--glass-border) bg-(--glass-bg) px-3.5 text-sm text-foreground placeholder:text-white/40 focus:border-brand-500 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20',
        className,
      )}
      {...props}
    />
  );
}

/** Form field label, muted secondary text. */
export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('mb-1.5 block text-xs text-white/60', className)} {...props} />;
}
