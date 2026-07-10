/**
 * @fileoverview Glassmorphism card primitive, per the design system.
 * @layer components
 */

import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

/** Glassmorphism card container. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-(--glass-border) bg-(--glass-card-bg) text-card-foreground shadow-sm backdrop-blur-md',
        className,
      )}
      {...props}
    />
  );
}

/** Card title: monospace, bold, matching the design system's data typography. */
export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('font-mono text-base font-bold leading-none tracking-tight', className)}
      {...props}
    />
  );
}

/** Card description: muted secondary text below the title. */
export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('mt-1 text-sm text-muted-foreground', className)} {...props} />;
}
