/**
 * Transport parity under the 'both' composite profile.
 *
 * Layer: e2e.
 * Goal: run the same shared parity suite from phase 06 twice against ONE 'both'
 *       profile app: once connecting every client over SSE, once connecting every
 *       client over WebSocket. Both runs must pass unchanged, proving the composite
 *       profile preserves the exact tenant/user/room/broadcast delivery semantics
 *       each transport already has on its own, with zero application service code
 *       branching on the boot transport.
 * Mocks: none; one real 'both'-profile app, alternately driven by `eventsource` and
 *        `socket.io-client` clients.
 */

import type { INestApplication } from '@nestjs/common';

import { APP_CONFIG } from '../../../src/config/config.tokens';
import type { AppConfig } from '../../../src/config/env.loader';
import { setEnv } from '../../support/env.fixture';
import { login, nextEvent, openSse } from '../../support/sse.fixture';
import { mintWsToken, openWs } from '../../support/ws.fixture';

import { type ParityConnection, type ParityHarness, runParitySuite } from './parity.suite';

interface AddressInfo {
  readonly port: number;
}

let app: INestApplication;
let baseUrl: string;
let namespaceUrl: string;
let restoreEnv: () => void;

const sseHarness: ParityHarness = {
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

const wsHarness: ParityHarness = {
  app: () => app,
  connect: async (username: string): Promise<ParityConnection> => {
    const cookie = await login(app, username);
    const token = await mintWsToken(app, cookie);
    const { socket, established } = await openWs(namespaceUrl, token);
    return {
      connectionId: established.connectionId as string,
      cookie,
      traits: established.traits as Record<string, unknown>,
      collect: (event: string): number[] => {
        const seqs: number[] = [];
        socket.on(event, (data: { seq: number }) => {
          seqs.push(data.seq);
        });
        return seqs;
      },
      close: () => socket.close(),
    };
  },
};

describe('Both-mode transport parity (e2e)', () => {
  beforeAll(async () => {
    restoreEnv = setEnv({ REALTIME_TRANSPORT: 'both', REAUTH_INTERVAL_SECONDS: '3600' });
    const { createApp } = await import('../../../src/main');
    app = await createApp();
    await app.listen(0);
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
    namespaceUrl = `${baseUrl}${app.get<AppConfig>(APP_CONFIG).realtime.wsNamespace}`;
  });

  afterAll(async () => {
    await app.close();
    restoreEnv();
  });

  describe('driven over SSE', () => {
    runParitySuite(sseHarness);
  });

  describe('driven over WebSocket', () => {
    runParitySuite(wsHarness);
  });
});
