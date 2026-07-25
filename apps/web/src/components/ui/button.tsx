/**
 * @fileoverview Pill button primitive: brand gradient default, per the design system.
 * @layer components
 *
 * Variant and size names match the sibling example dashboards so the family shares
 * one vocabulary: `default` is the brand gradient, and the size scale carries the
 * compact `sm` used in dense chrome such as the top bar, which is what stops that
 * chrome from hand-rolling its own button classes and drifting off the scale.
 */

import type { ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

/** Visual style variant. */
export type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';

/** Control size. */
export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  default:
    'bg-linear-to-r from-brand-500 to-brand-600 text-white shadow-sm hover:shadow-(--shadow-primary) hover:scale-[1.02] active:scale-[0.98]',
  destructive: 'bg-(--color-danger) text-white shadow-sm hover:opacity-90',
  outline:
    'border border-(--glass-border) bg-(--glass-bg) hover:bg-(--glass-bg-hover) text-foreground',
  secondary: 'bg-(--glass-bg-raised) text-foreground shadow-sm hover:bg-(--glass-bg-hover)',
  ghost: 'text-white/70 hover:bg-(--glass-bg-hover) hover:text-foreground',
  link: 'text-brand-500 underline-offset-4 hover:underline',
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  default: 'h-10 px-6 text-sm',
  sm: 'h-8 px-4 text-xs',
  lg: 'h-12 px-8 text-base',
  icon: 'h-10 w-10',
};

/** Classes shared by every control, independent of variant and size. */
const BASE_CLASS =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0';

/**
 * Build the button class string for an element that cannot be a `<button>`.
 *
 * Anchors are the real case: a navigation control must stay a link for
 * middle-click, focus order and screen readers, while still looking identical to
 * its button siblings.
 *
 * @param options - The variant and size to render, plus extra classes.
 * @returns The merged class string.
 */
export function buttonClasses({
  variant = 'default',
  size = 'default',
  className,
}: {
  readonly variant?: ButtonVariant | undefined;
  readonly size?: ButtonSize | undefined;
  readonly className?: string | undefined;
} = {}): string {
  return cn(BASE_CLASS, SIZE_CLASS[size], VARIANT_CLASS[variant], className);
}

/** Props for {@link Button}, extending the native button element's attributes. */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant. Defaults to the brand gradient. */
  readonly variant?: ButtonVariant;
  /** Control height. Defaults to the 40px `default` size. */
  readonly size?: ButtonSize;
}

/** Brand-styled pill button. */
export function Button({
  className,
  variant = 'default',
  size = 'default',
  type = 'button',
  ...props
}: ButtonProps) {
  return <button type={type} className={buttonClasses({ variant, size, className })} {...props} />;
}
