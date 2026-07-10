/**
 * @fileoverview Client-side session state, backed by `GET /auth/me`.
 * @layer lib
 *
 * The session cookie itself is HttpOnly and never readable from JavaScript; this
 * context only mirrors the client-safe traits the api already agreed to return
 * once authenticated. `status` distinguishes the loading window from a confirmed
 * absence of a session so the shell can render a skeleton instead of flashing a
 * logged-out state on first paint.
 */
'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { authApi, type SessionTraits } from './api-client';

/** Lifecycle of the session lookup: loading, then resolved either way. */
export type SessionStatus = 'loading' | 'authenticated' | 'anonymous';

/** The session context value shared with every descendant. */
export interface SessionContextValue {
  /** Current lookup status. */
  readonly status: SessionStatus;
  /** The authenticated traits, or `null` when anonymous or still loading. */
  readonly traits: SessionTraits | null;
  /** Re-run the `/auth/me` lookup (call after login). */
  readonly refresh: () => Promise<void>;
  /** Clear the session cookie and refresh local state. */
  readonly logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Fetch the current session, treating any failure (a 401, or a real network or
 * server error) as "not authenticated right now" rather than leaving the shell
 * stuck on a loading skeleton forever.
 */
async function loadSession(): Promise<SessionTraits | null> {
  try {
    return await authApi.me();
  } catch {
    return null;
  }
}

/**
 * Provide the current session's traits to the whole app, loaded once on mount.
 *
 * @param props - Provider props.
 * @param props.children - The subtree that can call {@link useSession}.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [traits, setTraits] = useState<SessionTraits | null>(null);

  const refresh = useCallback(async () => {
    const next = await loadSession();
    setTraits(next);
    setStatus(next ? 'authenticated' : 'anonymous');
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setTraits(null);
    setStatus('anonymous');
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <SessionContext.Provider value={{ status, traits, refresh, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

/**
 * Read the current session from the nearest {@link SessionProvider}.
 *
 * @throws Error when called outside a `SessionProvider`.
 */
export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within <SessionProvider>');
  return ctx;
}
