/**
 * @fileoverview Fixed 64px dark-glass top bar: brand identity + connection badge + session.
 * @layer components
 *
 * Shows the orange-bordered stacked-layers brand mark and the gradient
 * `nest-realtime-example` wordmark on the left, the global connection badge and
 * session controls on the right, and a hamburger that toggles the mobile sidebar
 * overlay. It takes no client state of its own beyond the session context - the
 * mobile toggle handler is supplied by `AppShell`.
 */
'use client';

import { Menu } from 'lucide-react';
import Link from 'next/link';

import { ConnectionBadge } from '@/components/realtime/connection-badge';
import { Button, buttonClasses } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { APP_NAME } from '@/lib/constants';
import { useSession } from '@/lib/session-context';

interface TopbarProps {
  /** Called when the hamburger is pressed to open the mobile sidebar. */
  readonly onMenuOpen: () => void;
}

/** The orange-bordered brand mark plus the gradient wordmark. */
function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-brand-500/40 bg-brand-500/15"
        aria-hidden="true"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2L2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5"
            stroke="var(--color-brand-500)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {/* A wordmark that wraps stops being a wordmark, so it never breaks and is
          dropped entirely on the narrowest screens, where the mark alone identifies us. */}
      <span className="hidden select-none whitespace-nowrap bg-linear-to-r from-brand-500 to-amber-200 bg-clip-text font-mono text-sm font-bold leading-tight text-transparent sm:inline">
        {APP_NAME}
      </span>
    </div>
  );
}

/**
 * The authenticated user id + logout button, or a log-in link when anonymous.
 *
 * Rendered at every width: hiding it below the `md` breakpoint left a phone with
 * no way to sign in or out at all. The identity chip is dropped on the narrowest
 * screens, where the control that matters is the action, not the label.
 */
function SessionControl() {
  const { status, traits, logout } = useSession();

  if (status === 'authenticated' && traits) {
    return (
      <div className="flex items-center gap-2">
        <Chip className="hidden font-mono sm:inline-flex">{traits.userId}</Chip>
        <Button size="sm" variant="outline" onClick={() => void logout()}>
          Log out
        </Button>
      </div>
    );
  }
  return (
    <Link href="/login" className={buttonClasses({ size: 'sm' })}>
      Log in
    </Link>
  );
}

/** Fixed 64px dark-glass top bar: brand identity (left) + status/session (right). */
export function Topbar({ onMenuOpen }: TopbarProps) {
  return (
    <header className="fixed left-0 right-0 top-0 z-200 flex h-16 items-center justify-between border-b border-white/7 bg-black/85 px-4 backdrop-blur-md lg:px-6">
      <BrandMark />
      <div className="flex items-center gap-3">
        <ConnectionBadge />
        <SessionControl />
        <button
          type="button"
          aria-label="Open navigation menu"
          onClick={onMenuOpen}
          className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-white/5 lg:hidden"
        >
          <Menu className="h-4 w-4 text-white/70" />
        </button>
      </div>
    </header>
  );
}
