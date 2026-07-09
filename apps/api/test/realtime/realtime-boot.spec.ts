/**
 * Unit tests for the library's boot-time validation and sync path.
 *
 * Layer: unit (library behavior).
 * Goal: malformed options reject boot; the sync forRoot path boots and honors the endpoint.
 * Mocks: a stub authenticator; invalid options are passed as unknown to the runtime guard.
 */

import {
  BymaxRealtimeModule,
  RealtimeService,
  type BymaxRealtimeModuleOptions,
  type IConnectionAuthenticator,
} from '@bymax-one/nest-realtime';
import { Test } from '@nestjs/testing';

const stub: IConnectionAuthenticator = { authenticate: () => Promise.resolve(null) };

/**
 * Call forRoot with intentionally-invalid options. TS forbids the shapes at
 * compile time, so the runtime validator is exercised through an unknown value.
 */
const forRootWith = (options: unknown): unknown =>
  BymaxRealtimeModule.forRoot(options as BymaxRealtimeModuleOptions);

describe('BymaxRealtimeModule boot validation', () => {
  /**
   * Missing authenticator.
   *
   * The library must refuse to boot without an authenticator, surfacing
   * REALTIME_NO_AUTHENTICATOR (error-catalog row 68).
   */
  it('rejects boot when the authenticator is missing', () => {
    expect(() => forRootWith({ transport: 'sse' })).toThrow(/REALTIME_NO_AUTHENTICATOR/);
  });

  /**
   * Malformed transport.
   *
   * An unknown transport must reject boot with REALTIME_INVALID_OPTIONS
   * (error-catalog row 67).
   */
  it('rejects boot on a malformed transport', () => {
    expect(() => forRootWith({ transport: 'carrier-pigeon', authenticator: stub })).toThrow(
      /REALTIME_INVALID_OPTIONS/,
    );
  });

  /**
   * Sync path.
   *
   * The synchronous forRoot must boot in a testing module and honor the
   * configured SSE endpoint, proving the minimal wiring compiles (matrix row 2).
   */
  it('boots the sync forRoot path and exposes RealtimeService', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        BymaxRealtimeModule.forRoot({
          transport: 'sse',
          authenticator: stub,
          sse: { endpoint: '/api/events' },
        }),
      ],
    }).compile();

    expect(moduleRef.get(RealtimeService)).toBeInstanceOf(RealtimeService);

    await moduleRef.close();
  });
});
