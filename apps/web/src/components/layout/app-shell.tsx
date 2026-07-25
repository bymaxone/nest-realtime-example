/**
 * @fileoverview App chrome: fixed topbar + sticky sidebar + the page content well.
 * @layer components
 *
 * Owns the mobile sidebar open/close state. The content well is centered at
 * `max-w-5xl`, matching the sibling example dashboards.
 */
'use client';

import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { navLabelFor } from './nav-items';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

/** App chrome: fixed topbar + sticky sidebar + the page content well. */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
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
          <div className="mx-auto max-w-5xl">
            {/* The visible page identity is the highlighted nav item, so the h1 that
                anchors the heading outline is announced rather than drawn. */}
            <h1 className="sr-only">{navLabelFor(pathname)}</h1>
            {children}
          </div>
        </main>
      </div>
    </>
  );
}
