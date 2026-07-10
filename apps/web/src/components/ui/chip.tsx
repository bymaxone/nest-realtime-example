/**
 * @fileoverview Chip and role-pill primitives, per the design system.
 * @layer components
 */

import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

/** Neutral glass chip, used for filters, tags, and instance labels. */
export function Chip({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-(--glass-border) bg-(--glass-bg-raised) px-2.5 py-1 text-xs text-white/70',
        className,
      )}
      {...props}
    />
  );
}

/** Semantic tone for a status chip. */
export type ChipTone = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

const TONE_CLASS: Record<ChipTone, string> = {
  success: 'text-(--color-success) border-(--color-success)/30 bg-(--color-success)/10',
  danger: 'text-(--color-danger) border-(--color-danger)/30 bg-(--color-danger)/10',
  warning: 'text-amber-400 border-amber-400/30 bg-amber-400/10',
  info: 'text-(--color-secondary) border-(--color-secondary)/30 bg-(--color-secondary)/10',
  neutral: 'text-white/60 border-(--glass-border) bg-(--glass-bg-raised)',
};

/** Props for {@link StatusChip}. */
export interface StatusChipProps extends HTMLAttributes<HTMLSpanElement> {
  /** Semantic tone, encoded via color and border together (never color alone). */
  readonly tone: ChipTone;
}

/** Colored status chip: a dot plus text, so status is never color-only. */
export function StatusChip({ tone, className, children, ...props }: StatusChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold',
        TONE_CLASS[tone],
        className,
      )}
      {...props}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
