/**
 * @fileoverview Connection lab: manual connect/disconnect, backoff tuning, kill switch.
 * @layer app
 *
 * `autoConnect: false` and manual `connect()`/`disconnect()` are realized by
 * conditionally mounting `<ManagedConnection>` (mount = connect, unmount =
 * disconnect), since the shipped hook has no such flags. Backoff tuning
 * (`initialDelayMs` / `maxDelayMs` / `maxAttempts`) and the live
 * `reconnectAttempts` counter are genuine hook features. "Kill my stream" calls
 * the replay lab's drop endpoint, which force-closes the caller's own SSE
 * streams so the backoff climb is observable without leaving the page.
 */
'use client';

import { useState } from 'react';

import { ManagedConnection } from '@/components/realtime/managed-connection';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Code } from '@/components/ui/code';
import { Label } from '@/components/ui/input';
import { ApiError, replayLabApi } from '@/lib/api-client';

/** The three backoff-tuning values the connection lab exposes as sliders. */
interface TuningValues {
  readonly initialDelayMs: number;
  readonly maxDelayMs: number;
  readonly maxAttempts: number;
}

/** One labeled range slider bound to a tuning value. */
function TuningSlider({
  id,
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly onChange: (value: number) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

/** The initial-delay, max-delay, and max-attempts sliders in a row. */
function TuningSliders({
  values,
  onChange,
}: {
  readonly values: TuningValues;
  readonly onChange: (values: TuningValues) => void;
}) {
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
      <TuningSlider
        id="initial-delay"
        label={`Initial delay: ${values.initialDelayMs}ms`}
        value={values.initialDelayMs}
        min={200}
        max={5000}
        step={100}
        onChange={(initialDelayMs) => onChange({ ...values, initialDelayMs })}
      />
      <TuningSlider
        id="max-delay"
        label={`Max delay: ${values.maxDelayMs}ms`}
        value={values.maxDelayMs}
        min={1000}
        max={60000}
        step={1000}
        onChange={(maxDelayMs) => onChange({ ...values, maxDelayMs })}
      />
      <TuningSlider
        id="max-attempts"
        label={`Max attempts: ${values.maxAttempts}`}
        value={values.maxAttempts}
        min={1}
        max={20}
        step={1}
        onChange={(maxAttempts) => onChange({ ...values, maxAttempts })}
      />
    </div>
  );
}

/** The connect/disconnect toggle, kill-stream button, and drop status line. */
function ConnectionControls({
  isMounted,
  onConnect,
  onDisconnect,
  onKillStream,
  dropStatus,
}: {
  readonly isMounted: boolean;
  readonly onConnect: () => void;
  readonly onDisconnect: () => void;
  readonly onKillStream: () => void;
  readonly dropStatus: string | null;
}) {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      {isMounted ? (
        <Button variant="destructive" onClick={onDisconnect}>
          Disconnect
        </Button>
      ) : (
        <Button onClick={onConnect}>Connect</Button>
      )}
      <Button variant="outline" onClick={onKillStream} disabled={!isMounted}>
        Kill my stream
      </Button>
      {dropStatus ? <span className="text-xs text-white/50">{dropStatus}</span> : null}
    </div>
  );
}

/** Force-close the caller's own SSE streams and report the result via `setStatus`. */
function dropStream(setStatus: (status: string) => void): void {
  replayLabApi
    .drop()
    .then((result) => setStatus(`dropped ${result.dropped} stream(s); watch the backoff climb`))
    .catch((err: unknown) =>
      setStatus(err instanceof ApiError ? err.message : 'Failed to drop the stream'),
    );
}

/** Connection lab page: manual connect/disconnect, backoff tuning, kill switch. */
export default function ConnectionLabPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [tuning, setTuning] = useState<TuningValues>({
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    maxAttempts: 10,
  });
  const [dropStatus, setDropStatus] = useState<string | null>(null);

  const connect = (): void => {
    setGeneration((g) => g + 1);
    setIsMounted(true);
  };

  return (
    <Card>
      <CardHeader accent>
        <CardTitle>Connection lab</CardTitle>
        <CardDescription>
          Manual connect/disconnect (<Code>autoConnect: false</Code>) plus reconnect tuning:{' '}
          <Code>initialDelayMs</Code>, <Code>maxDelayMs</Code>, <Code>maxAttempts</Code>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TuningSliders values={tuning} onChange={setTuning} />
        <ConnectionControls
          isMounted={isMounted}
          onConnect={connect}
          onDisconnect={() => setIsMounted(false)}
          onKillStream={() => dropStream(setDropStatus)}
          dropStatus={dropStatus}
        />

        <div>
          {isMounted ? (
            <ManagedConnection key={generation} {...tuning} />
          ) : (
            <span className="text-xs text-white/40">
              Not connected. Click Connect to open a stream.
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
