/**
 * @fileoverview Card primitive: glassmorphism surface, per the shared design system.
 * @layer components
 *
 * Mirrors the sibling example dashboards so the family reads as one product: the
 * container owns only the glass surface, and the padding rhythm lives in
 * `CardHeader` / `CardContent` / `CardFooter` rather than being passed at every
 * call site. `CardHeader` can render the brand accent hairline along the top edge,
 * which is what visually separates a headline card from an ordinary one.
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

/** Props for {@link CardHeader}. */
export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  /** When true, draws the brand accent hairline across the top edge. */
  readonly accent?: boolean;
}

/** Card header region: holds the title and description. */
export function CardHeader({ className, accent = false, children, ...props }: CardHeaderProps) {
  return (
    <div className={cn('flex flex-col space-y-1.5 p-6', className)} {...props}>
      {accent ? (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-brand-500/40 to-transparent"
        />
      ) : null}
      {children}
    </div>
  );
}

/**
 * Card title: monospace and bold, the design system's data typography.
 *
 * Level two, because a card is a section of the page whose `h1` the app shell
 * renders; starting cards at `h3` left every route with a heading outline that
 * skipped straight to level three.
 */
export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn('font-mono text-xl font-bold leading-none tracking-tight', className)}
      {...props}
    />
  );
}

/** Card description: muted secondary text below the title. */
export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

/** Card content region. */
export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-6 pt-0', className)} {...props} />;
}

/** Card footer region: typically holds the actions. */
export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center p-6 pt-0', className)} {...props} />;
}
