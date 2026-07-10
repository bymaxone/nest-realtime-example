/**
 * Cluster e2e tests for the WebSocket transport across instances.
 *
 * Layer: e2e (multi-instance, live compose stack in websocket mode).
 * Goal: a chat message sent through app-a reaches a room member on app-b (Redis
 *       adapter fan-out), a WebSocket revoked from another instance is closed
 *       (adapter-aware disconnect), and a WebSocket connects through nginx (sticky
 *       upgrade path).
 * Mocks: none; real app-a (3001), app-b (3002) and nginx (8080) over Socket.IO.
 *
 * Requires the stack booted in WebSocket mode:
 *   REALTIME_TRANSPORT=websocket docker compose --profile cluster up -d --build
 */

import type { Socket } from 'socket.io-client';

import { openWs } from '../support/ws.fixture';

import {
  APP_A,
  APP_B,
  NGINX,
  clusterLogin,
  disconnectConnection,
  joinIncidentRoom,
  mintClusterWsToken,
  pollUntil,
  readPresence,
} from './cluster.fixture';

/** The config-driven namespace both cluster instances serve. */
const NAMESPACE = '/live';
const INCIDENT_ID = 'ws-cluster';
const ROOM_ID = `resource:incident:${INCIDENT_ID}`;

/** A connected member: its socket, owner cookie and server connection id. */
interface ClusterMember {
  readonly socket: Socket;
  readonly cookie: string;
  readonly connectionId: string;
}

/** Log in against one instance, mint a bearer, and open an authenticated socket. */
async function connectTo(baseUrl: string, username: string): Promise<ClusterMember> {
  const cookie = await clusterLogin(baseUrl, username);
  const token = await mintClusterWsToken(baseUrl, cookie);
  const { socket, established } = await openWs(`${baseUrl}${NAMESPACE}`, token);
  return { socket, cookie, connectionId: established.connectionId as string };
}

describe('WebSocket cluster (e2e)', () => {
  /**
   * Cross-instance chat fan-out.
   *
   * A member on app-a and a member on app-b join the same incident room; a message
   * emitted through app-a must reach the app-b member, proving the Redis adapter
   * fans WebSocket messages across instances (not just within one).
   */
  it('fans a chat message from app-a to a room member on app-b', async () => {
    const ana = await connectTo(APP_A, 'ana@acme');
    const bob = await connectTo(APP_B, 'bob@acme');
    try {
      await joinIncidentRoom(APP_A, ana.cookie, ana.connectionId, INCIDENT_ID);
      await joinIncidentRoom(APP_B, bob.cookie, bob.connectionId, INCIDENT_ID);

      const received: Array<Record<string, unknown>> = [];
      bob.socket.on('chat.message', (m: Record<string, unknown>) => received.push(m));

      ana.socket.emit('chat.message', { roomId: ROOM_ID, body: 'cross-node update' });
      await pollUntil(async () => received.length > 0);

      expect(received[0]).toMatchObject({
        roomId: ROOM_ID,
        from: 'ana@acme',
        body: 'cross-node update',
      });
    } finally {
      ana.socket.close();
      bob.socket.close();
    }
  });

  /**
   * Cross-instance WebSocket revocation.
   *
   * A socket owned on app-a must be closed when its owner revokes it through app-b:
   * the adapter-aware disconnect broadcasts to the connection room over the Redis
   * adapter so the owning instance force-closes the socket.
   */
  it('closes a websocket owned on app-a when revoked via app-b', async () => {
    const ana = await connectTo(APP_A, 'ana@acme');
    let disconnected = false;
    ana.socket.on('disconnect', () => {
      disconnected = true;
    });

    // The shared presence index must know the connection before app-b can authorize
    // the cross-instance kill.
    await pollUntil(async () =>
      (await readPresence(APP_A, ana.cookie, 'acme')).includes('ana@acme'),
    );

    const response = await disconnectConnection(APP_B, ana.cookie, ana.connectionId);
    expect(response.status).toBe(200);

    await pollUntil(async () => disconnected);
    expect(disconnected).toBe(true);
    ana.socket.close();
  });

  /**
   * WebSocket through the nginx front door.
   *
   * A bearer-authenticated handshake through nginx must establish, proving the
   * `/socket.io/` upgrade + sticky-session location serves WebSocket clients.
   */
  it('establishes a websocket through nginx', async () => {
    const cookie = await clusterLogin(NGINX, 'gil@globex');
    const token = await mintClusterWsToken(NGINX, cookie);
    const { socket, established } = await openWs(`${NGINX}${NAMESPACE}`, token);

    expect(typeof established.connectionId).toBe('string');
    socket.close();
  });
});
