/**
 * @fileoverview Inline code token for identifiers quoted inside prose.
 * @layer components
 *
 * Descriptions across the dashboard name env vars, endpoints and hook options.
 * Written as markdown backticks they render as literal backtick characters,
 * because JSX is not markdown; this renders them as a real `<code>` element in
 * the mono face instead, which is also what a screen reader announces as code.
 */

import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

/** Inline monospace token for an identifier mentioned in body copy. */
export function Code({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <code
      className={cn(
        'rounded-sm bg-(--glass-bg-raised) px-1 py-0.5 font-mono text-[0.9em] text-white/80',
        className,
      )}
      {...props}
    />
  );
}
