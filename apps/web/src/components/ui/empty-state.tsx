/**
 * @fileoverview Action-oriented empty state, per the design system.
 * @layer components
 */

import type { ReactNode } from 'react';

/** Props for {@link EmptyState}. */
export interface EmptyStateProps {
  /** Short, mono-styled title naming the missing content. */
  readonly title: string;
  /** One line describing how to produce content, or an action button. */
  readonly children?: ReactNode;
}

/** Dashed-border empty state, used instead of a blank pane. */
export function EmptyState({ title, children }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-(--glass-border) px-6 py-10 text-center text-white/50">
      <div className="mb-1.5 font-mono text-sm text-white/80">{title}</div>
      {children}
    </div>
  );
}
