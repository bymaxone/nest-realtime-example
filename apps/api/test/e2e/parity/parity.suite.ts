/**
 * @fileoverview Transport-blind parity suite shared by the SSE and WebSocket specs.
 * @layer test-support
 *
 * The dual-transport thesis, executable: the exact same delivery assertions run
 * against both transports, differing only in the client factory the caller passes.
 * The suite emits through the transport-agnostic REST console and asserts who
 * receives what (tenant isolation, per-user delivery, room membership, broadcast)
 * plus the client-safe `connection:established` traits. It deliberately avoids any
 * transport-specific assertion (for example the SSE `Last-Event-ID` ordering), so
 * a green run on both profiles proves the application services never change with
 * the transport.
 */

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

/** A transport-blind view of one connected client. */
export interface ParityConnection {
  /** The server connection id from `connection:established`. */
  readonly connectionId: string;
  /** The session cookie for REST calls authorized as this client. */
  readonly cookie: string;
  /** The client-safe traits delivered on connect. */
  readonly traits: Record<string, unknown>;
  /**
   * Start collecting the `seq` of every occurrence of an event.
   *
   * @param event - The event name to collect.
   * @returns A live array appended to as events arrive.
   */
  collect(event: string): number[];
  /** Close the underlying transport client. */
  close(): void;
}

/** The transport-specific harness the parity suite drives. */
export interface ParityHarness {
  /** The running application, for the transport-agnostic REST calls. */
  app(): INestApplication;
  /**
   * Log a user in and open a transport client for them.
   *
   * @param username - The demo user to connect.
   * @returns The connected client.
   */
  connect(username: string): Promise<ParityConnection>;
}

/** The event name every parity emit carries. */
const EVENT = 'order.created';
/** The incident room the room-emit assertion uses. */
const ROOM_ID = 'resource:incident:parity';
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Register the shared parity assertions against a transport harness.
 *
 * @param harness - The transport-specific client factory and app accessor.
 */
export function runParitySuite(harness: ParityHarness): void {
  describe('transport parity', () => {
    let ana: ParityConnection;
    let bob: ParityConnection;
    let gil: ParityConnection;

    beforeAll(async () => {
      ana = await harness.connect('ana@acme');
      bob = await harness.connect('bob@acme');
      gil = await harness.connect('gil@globex');
    });

    afterAll(() => {
      ana.close();
      bob.close();
      gil.close();
    });

    /**
     * Client-safe traits on connect.
     *
     * Every client must receive its own `{ userId, tenantId, roles }` on connect,
     * identically across transports, proving no metadata leaks on either.
     */
    it('delivers connection:established with client-safe traits', () => {
      expect(ana.traits).toEqual({ userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] });
      expect(bob.traits).toEqual({ userId: 'bob@acme', tenantId: 'acme', roles: ['member'] });
      expect(gil.traits).toEqual({ userId: 'gil@globex', tenantId: 'globex', roles: ['admin'] });
    });

    /**
     * Delivery isolation across every scope.
     *
     * A tenant emit reaches only that tenant (acme: ana+bob, not gil); a user emit
     * only that user (ana); a room emit only its members (ana+bob who joined, not
     * gil); and a broadcast every client. The identical assertions must hold on
     * both transports.
     */
    it('isolates tenant, user and room emits while broadcasting to all', async () => {
      const anaSeq = ana.collect(EVENT);
      const bobSeq = bob.collect(EVENT);
      const gilSeq = gil.collect(EVENT);

      await emit(harness, ana.cookie, '/api/emit/tenant/acme', 1);
      await waitUntil(() => anaSeq.includes(1) && bobSeq.includes(1));
      await sleep(200);
      expect(gilSeq).not.toContain(1);

      await emit(harness, ana.cookie, `/api/emit/user/${encodeURIComponent('ana@acme')}`, 2);
      await waitUntil(() => anaSeq.includes(2));
      await sleep(200);
      expect(bobSeq).not.toContain(2);
      expect(gilSeq).not.toContain(2);

      await join(harness, ana.cookie, ana.connectionId);
      await join(harness, bob.cookie, bob.connectionId);
      await emit(harness, ana.cookie, `/api/emit/room/${ROOM_ID}`, 4);
      await waitUntil(() => anaSeq.includes(4) && bobSeq.includes(4));
      await sleep(200);
      expect(gilSeq).not.toContain(4);

      await emit(harness, ana.cookie, '/api/emit/broadcast', 3);
      await waitUntil(() => anaSeq.includes(3) && bobSeq.includes(3) && gilSeq.includes(3));
    });
  });
}

/** POST an emit to a console path as the given session. */
function emit(harness: ParityHarness, cookie: string, path: string, seq: number): Promise<unknown> {
  return request(harness.app().getHttpServer())
    .post(path)
    .set('Cookie', cookie)
    .send({ event: EVENT, data: { seq } })
    .expect(201);
}

/** Join a connection to the parity incident room as its owner. */
function join(harness: ParityHarness, cookie: string, connectionId: string): Promise<unknown> {
  return request(harness.app().getHttpServer())
    .post('/api/rooms/join')
    .set('Cookie', cookie)
    .send({ connectionId, resourceType: 'incident', resourceId: 'parity' })
    .expect(200);
}

/** Resolve once the predicate holds, or reject after the timeout. */
async function waitUntil(predicate: () => boolean, timeoutMs = 6000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('parity condition not met in time');
    await sleep(25);
  }
}
