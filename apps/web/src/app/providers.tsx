/**
 * @fileoverview Client provider boundary: session state + the shared realtime connection.
 * @layer app
 *
 * `RealtimeProvider` opens exactly one `EventSource` for the whole app (cookie
 * auth, `withCredentials: true`) and shares it with every descendant that calls
 * `useRealtimeContext()` (matrix row 65: one connection, many hooks). The
 * `events` option additionally subscribes to the application-level SSE event
 * names (`order.*`, `deployment.*`, `lab.replay`, `lab.both`) the shared feed
 * needs, since `EventSource` only routes a named event to a listener registered
 * for that exact name.
 */
'use client';

import { RealtimeProvider } from '@bymax-one/nest-realtime/react';
import type { ReactNode } from 'react';

import { SSE_EVENTS_URL } from '@/lib/constants';
import { SSE_APPLICATION_EVENT_NAMES } from '@/lib/events';
import { SessionProvider } from '@/lib/session-context';

/**
 * Wrap the app with session state and the shared realtime connection.
 *
 * @param props - Provider props.
 * @param props.children - The app tree.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <RealtimeProvider
        options={{
          url: SSE_EVENTS_URL,
          withCredentials: true,
          events: SSE_APPLICATION_EVENT_NAMES,
        }}
      >
        {children}
      </RealtimeProvider>
    </SessionProvider>
  );
}
