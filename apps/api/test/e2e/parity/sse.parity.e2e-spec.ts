/**
 * Transport parity under the SSE profile.
 *
 * Layer: e2e.
 * Goal: run the shared parity suite against an SSE-profile app with an `eventsource`
 *       client factory, proving the delivery semantics hold on SSE.
 * Mocks: none; a real SSE-profile app with `eventsource` clients.
 */

import type { INestApplication } from '@nestjs/common';

import { setEnv } from '../../support/env.fixture';
import { login, nextEvent, openSse } from '../../support/sse.fixture';

import { type ParityConnection, type ParityHarness, runParitySuite } from './parity.suite';

interface AddressInfo {
  readonly port: number;
}

let app: INestApplication;
let baseUrl: string;
let restoreEnv: () => void;

const harness: ParityHarness = {
  app: () => app,
  connect: async (username: string): Promise<ParityConnection> => {
    const cookie = await login(app, username);
    const source = openSse(`${baseUrl}/api/events`, cookie);
    const established = await nextEvent(source, 'connection:established');
    return {
      connectionId: established.connectionId as string,
      cookie,
      traits: established.traits as Record<string, unknown>,
      collect: (event: string): number[] => {
        const seqs: number[] = [];
        source.addEventListener(event, (message: MessageEvent<string>) => {
          seqs.push((JSON.parse(message.data) as { seq: number }).seq);
        });
        return seqs;
      },
      close: () => source.close(),
    };
  },
};

describe('SSE transport parity (e2e)', () => {
  beforeAll(async () => {
    restoreEnv = setEnv({ REALTIME_TRANSPORT: 'sse' });
    const { createApp } = await import('../../../src/main');
    app = await createApp();
    await app.listen(0);
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await app.close();
    restoreEnv();
  });

  runParitySuite(harness);
});
