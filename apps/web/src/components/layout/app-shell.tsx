/**
 * @fileoverview App chrome: fixed topbar + sticky sidebar + the page content well.
 * @layer components
 *
 * Owns the mobile sidebar open/close state. The content well is centered at
 * `max-w-5xl`, matching the sibling example dashboards.
 */
'use client';

import { useState, type ReactNode } from 'react';

import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

/** App chrome: fixed topbar + sticky sidebar + the page content well. */
export function AppShell({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Topbar onMenuOpen={() => setIsOpen(true)} />
      <div className="flex pt-16">
        <Sidebar isOpen={isOpen} onNavClick={() => setIsOpen(false)} />
        {isOpen ? (
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setIsOpen(false)}
            className="fixed bottom-0 left-0 right-0 top-16 z-90 bg-black/50 lg:hidden"
          />
        ) : null}
        <main className="min-w-0 flex-1 px-6 py-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </>
  );
}
