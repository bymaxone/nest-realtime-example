/**
 * Transport parity under the WebSocket profile.
 *
 * Layer: e2e.
 * Goal: run the shared parity suite against a WebSocket-profile app with a
 *       `socket.io-client` factory, proving the identical delivery semantics hold on
 *       WebSocket; switching REALTIME_TRANSPORT changes zero application service code.
 * Mocks: none; a real WebSocket-profile app with `socket.io-client` clients.
 */

import type { INestApplication } from '@nestjs/common';

import { APP_CONFIG } from '../../../src/config/config.tokens';
import type { AppConfig } from '../../../src/config/env.loader';
import { setEnv } from '../../support/env.fixture';
import { login } from '../../support/sse.fixture';
import { mintWsToken, openWs } from '../../support/ws.fixture';

import { type ParityConnection, type ParityHarness, runParitySuite } from './parity.suite';

interface AddressInfo {
  readonly port: number;
}

let app: INestApplication;
let namespaceUrl: string;
let restoreEnv: () => void;

const harness: ParityHarness = {
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

describe('WebSocket transport parity (e2e)', () => {
  beforeAll(async () => {
    restoreEnv = setEnv({ REALTIME_TRANSPORT: 'websocket', REAUTH_INTERVAL_SECONDS: '3600' });
    const { createApp } = await import('../../../src/main');
    app = await createApp();
    await app.listen(0);
    const port = (app.getHttpServer().address() as AddressInfo).port;
    namespaceUrl = `http://127.0.0.1:${port}${app.get<AppConfig>(APP_CONFIG).realtime.wsNamespace}`;
  });

  afterAll(async () => {
    await app.close();
    restoreEnv();
  });

  runParitySuite(harness);
});
