/**
 * @fileoverview Route metadata for the Connection lab page.
 * @layer app
 *
 * The page itself is a Client Component and cannot export `metadata`, so the
 * route's own browser title lives here. Without it every route would share the
 * root title and browser history would be indistinguishable.
 */

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Connection lab',
  description: 'Manual connect/disconnect and reconnect backoff tuning.',
};

/** Pass-through layout carrying only this route's metadata. */
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
