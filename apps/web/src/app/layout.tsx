/**
 * @fileoverview Root App Router layout: Geist fonts, forced dark theme, the app shell.
 * @layer app
 *
 * Loads the Geist Sans/Mono fonts as CSS variables and forces the design
 * system's dark theme by hard-coding the `dark` class on `<html>` (no
 * theme-switching library; the `.dark` token set in `globals.css` is the only
 * live one). Client providers live in `<Providers>`, keeping this layout a
 * Server Component. `suppressHydrationWarning` guards against mismatches from
 * the statically injected font-variable class names and the hard-coded `dark`
 * class.
 */

import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { AppShell } from '@/components/layout/app-shell';

import { Providers } from './providers';

import './globals.css';

/**
 * Next.js App Router page metadata: browser tab title and description.
 *
 * The template wraps whatever title a route declares, so every tab is
 * self-identifying while still carrying the app name.
 */
export const metadata: Metadata = {
  title: { default: 'nest-realtime-example', template: '%s | nest-realtime-example' },
  description: 'Reference dashboard for @bymax-one/nest-realtime, built on the ./react hooks.',
};

/**
 * Root App Router layout: Geist fonts, forced dark class, provider boundary, shell.
 *
 * @param props - Layout props.
 * @param props.children - Page or nested layout subtree.
 * @returns The full HTML document shell.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} dark`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
