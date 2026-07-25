/**
 * @fileoverview Both-mode lab: SSE and WebSocket panels receiving the same emit.
 * @layer app
 *
 * Requires `REALTIME_TRANSPORT=both` on the api. Each panel opens its own
 * independent connection (one SSE, one WebSocket) for the same user, and one
 * `emitToUser` call reaches both through the library's composite transport. A
 * WebSocket bearer is minted once on mount via `POST /auth/ws-token`.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';

import { SplitPanel } from '@/components/realtime/split-panel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Code } from '@/components/ui/code';
import { ApiError, authApi, emitApi } from '@/lib/api-client';
import { SSE_EVENTS_URL, WS_URL } from '@/lib/constants';
import { useSession } from '@/lib/session-context';

/** Everything the both-mode lab page's JSX needs. */
interface BothLabState {
  readonly wsToken: string | null;
  readonly status: string | null;
  readonly sseNonce: string | null;
  readonly wsNonce: string | null;
  readonly onSseNonce: (nonce: string) => void;
  readonly onWsNonce: (nonce: string) => void;
  readonly emitBoth: () => void;
}

/** Mints the WS token once and owns the emit-both action plus the observed nonces. */
function useBothLab(): BothLabState {
  const { traits } = useSession();
  const [wsToken, setWsToken] = useState<string | null>(null);
  const [sseNonce, setSseNonce] = useState<string | null>(null);
  const [wsNonce, setWsNonce] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    authApi
      .mintWsToken()
      .then((grant) => setWsToken(grant.token))
      .catch(() => setWsToken(null));
  }, []);

  const emitBoth = (): void => {
    if (!traits) return;
    const nonce = crypto.randomUUID();
    emitApi
      .toUser(traits.userId, 'lab.both', { nonce })
      .then(() => setStatus(`emitted nonce ${nonce.slice(0, 8)}`))
      .catch((err: unknown) => setStatus(err instanceof ApiError ? err.message : 'Emit failed'));
  };

  return {
    wsToken,
    status,
    sseNonce,
    wsNonce,
    onSseNonce: useCallback((nonce: string) => setSseNonce(nonce), []),
    onWsNonce: useCallback((nonce: string) => setWsNonce(nonce), []),
    emitBoth,
  };
}

/** The SSE and WebSocket panels side by side; the WS panel waits for its token. */
function TransportPanels({
  wsToken,
  onSseNonce,
  onWsNonce,
}: Pick<BothLabState, 'wsToken' | 'onSseNonce' | 'onWsNonce'>) {
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
      <SplitPanel
        label="SSE"
        options={{
          url: SSE_EVENTS_URL,
          withCredentials: true,
          transport: 'sse',
          events: ['lab.both'],
        }}
        onNonce={onSseNonce}
      />
      {wsToken ? (
        <SplitPanel
          label="WebSocket"
          options={{ url: WS_URL, transport: 'websocket', auth: { token: wsToken } }}
          onNonce={onWsNonce}
        />
      ) : (
        <div className="rounded-lg border border-(--glass-border) bg-(--glass-bg) p-4 text-xs text-white/40">
          Minting a WebSocket token...
        </div>
      )}
    </div>
  );
}

/** Both-mode lab: SSE and WebSocket panels receiving the same emit. */
export default function BothLabPage() {
  const lab = useBothLab();
  const matched = lab.sseNonce !== null && lab.sseNonce === lab.wsNonce;

  return (
    <Card>
      <CardHeader accent>
        <CardTitle>Both-mode lab</CardTitle>
        <CardDescription>
          One emit, both transports. Requires the api booted with{' '}
          <Code>REALTIME_TRANSPORT=both</Code>.
        </CardDescription>
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={lab.emitBoth}>Emit to both</Button>
          {lab.status ? <span className="text-xs text-white/50">{lab.status}</span> : null}
        </div>
      </CardHeader>
      <CardContent>
        <TransportPanels
          wsToken={lab.wsToken}
          onSseNonce={lab.onSseNonce}
          onWsNonce={lab.onWsNonce}
        />
        <div className="text-sm">
          {matched ? (
            <span className="text-(--color-success)">
              nonce match: both panels received {lab.sseNonce}
            </span>
          ) : (
            <span className="text-white/40">waiting for a matching nonce on both panels</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
