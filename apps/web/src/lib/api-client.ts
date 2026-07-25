/**
 * @fileoverview Thin, typed, credentialed fetch client for the api's REST surface.
 * @layer lib
 *
 * Every call sends `credentials: 'include'` so the HttpOnly session cookie rides
 * along automatically; this is the only auth channel the REST surface needs (the
 * SSE and WebSocket connections carry their own cookie / ticket / bearer). No
 * commands are ever cached: this app only proxies commands (POST) and one-shot
 * reads (GET), while all live data flows through the library's hooks.
 */

import { ApiError, type ApiIssue } from './api-error';
import { API_BASE_URL } from './constants';

/** Shape of a failed api response body, when the api sends one. */
interface ErrorBody {
  readonly message?: string;
  readonly issues?: readonly ApiIssue[];
}

/** Parse a failed response into an {@link ApiError}, tolerating a body-less response. */
async function toApiError(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => undefined)) as ErrorBody | undefined;
  return new ApiError(res.status, body?.message ?? res.statusText, body?.issues ?? []);
}

/**
 * Perform a credentialed JSON request against the api.
 *
 * @param path - The path under {@link API_BASE_URL}, e.g. `/auth/login`.
 * @param init - Optional fetch overrides (method, body).
 * @returns The parsed JSON response body, typed as `T`.
 * @throws ApiError when the response status is not in the 2xx range.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Issue a GET request. */
function get<T>(path: string): Promise<T> {
  return request<T>(path);
}

/** Issue a POST request with an optional JSON body. */
function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

/** Issue a DELETE request. */
function del<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' });
}

/** Client-safe identity traits returned by the auth endpoints. */
export interface SessionTraits {
  readonly userId: string;
  readonly tenantId: string;
  readonly roles: readonly string[];
}

/** Auth endpoints: demo login/logout, the current session, tickets and ws tokens. */
export const authApi = {
  /** Log in as a seeded demo user and set the session cookie. */
  login: (username: string): Promise<SessionTraits> => post('/auth/login', { username }),
  /** Clear the session cookie. */
  logout: (): Promise<{ ok: true }> => post('/auth/logout'),
  /** Read the current session's traits, or throw a 401 `ApiError` when absent. */
  me: (): Promise<SessionTraits> => get('/auth/me'),
  /** Mint a one-shot SSE ticket bound to the current session. */
  issueTicket: (): Promise<{ ticket: string }> => post('/auth/ticket'),
  /** Mint a short-lived WebSocket bearer token bound to the current session. */
  mintWsToken: (): Promise<{ token: string; expiresAt: string }> => post('/auth/ws-token'),
};

/** Acceptance envelope returned by every emit and simulate endpoint. */
export type AcceptedAck = {
  readonly accepted?: true;
  readonly simulated?: 'orders' | 'deployments';
};

/** Domain simulator endpoints driving the Live Operations Board. */
export const domainApi = {
  /** Simulate an order created -> paid -> shipped burst to the caller's tenant. */
  simulateOrders: (): Promise<AcceptedAck> => post('/domain/orders/simulate'),
  /** Simulate a deployment queued -> running -> succeeded burst to the caller's tenant. */
  simulateDeployments: (): Promise<AcceptedAck> => post('/domain/deployments/simulate'),
};

/** Emit console endpoints (user / tenant / room / broadcast). */
export const emitApi = {
  toUser: (userId: string, event: string, data: unknown): Promise<AcceptedAck> =>
    post(`/emit/user/${encodeURIComponent(userId)}`, { event, data }),
  toTenant: (tenantId: string, event: string, data: unknown): Promise<AcceptedAck> =>
    post(`/emit/tenant/${encodeURIComponent(tenantId)}`, { event, data }),
  toRoom: (roomId: string, event: string, data: unknown): Promise<AcceptedAck> =>
    post(`/emit/room/${encodeURIComponent(roomId)}`, { event, data }),
  broadcast: (event: string, data: unknown): Promise<AcceptedAck> =>
    post('/emit/broadcast', { event, data }),
};

/** Union of audit entry kinds the api records. */
export type AuditKind = 'connect' | 'disconnect' | 'error' | 'reauth-failed';

/** One entry in the lifecycle audit feed. */
export interface AuditEntry {
  readonly kind: AuditKind;
  readonly at: string;
  readonly instance: string;
  readonly connectionId: string | undefined;
  readonly userId: string | undefined;
  readonly tenantId: string | undefined;
  readonly transport: 'sse' | 'websocket' | undefined;
  readonly extra: Record<string, unknown> | undefined;
}

/** Per-user connect/disconnect counters bumped by the `@OnConnect`/`@OnDisconnect` decorators. */
export interface DecoratorStats {
  readonly connects: number;
  readonly disconnects: number;
}

/** Audit feed endpoints. */
export const auditApi = {
  feed: (
    kind?: AuditKind,
  ): Promise<{ service: { name: string; version: string }; entries: readonly AuditEntry[] }> =>
    get(`/audit/feed${kind ? `?kind=${encodeURIComponent(kind)}` : ''}`),
  decoratorStats: (): Promise<DecoratorStats> => get('/audit/decorator-stats'),
};

/** A single active connection, as reported by the instance the caller reaches. */
export interface ConnectionMeta {
  readonly connectionId: string;
  readonly userId: string;
  readonly tenantId?: string;
  readonly transport: 'sse' | 'websocket';
  readonly connectedAt: string;
}

/** Connection introspection and kill-switch endpoints. */
export const connectionsApi = {
  list: (): Promise<{ instance: string; connections: readonly ConnectionMeta[] }> =>
    get('/connections'),
  introspection: (): Promise<RealtimeWiringSnapshot> => get('/connections/introspection'),
  disconnect: (connectionId: string): Promise<{ disconnected: true }> =>
    post(`/connections/${encodeURIComponent(connectionId)}/disconnect`),
};

/** One connection's lifecycle: opened, then possibly evicted with a reason. */
export interface EvictionTimelineEntry {
  readonly connectionId: string;
  readonly userId: string;
  readonly connectedAt: string;
  readonly evictedAt: string | null;
  readonly reason: string | null;
}

/** FIFO-eviction timeline lab endpoint. */
export const evictionLabApi = {
  timeline: (
    userId: string,
  ): Promise<{ userId: string; timeline: readonly EvictionTimelineEntry[] }> =>
    get(`/labs/eviction/timeline?userId=${encodeURIComponent(userId)}`),
};

/** Per-instance pub/sub fan-out counters. */
export interface ClusterStats {
  readonly instance: string;
  readonly published: number;
  readonly receivedRemote: number;
  readonly deliveredLocal: number;
}

/** Cluster fan-out counters lab endpoint. */
export const clusterLabApi = {
  stats: (): Promise<ClusterStats> => get('/labs/cluster/stats'),
};

/** One emission the replay lab recorded for a user. */
export interface ReplayTimelineEntry {
  readonly seq: number;
  readonly id: string;
}

/** A queued offline event, as surfaced by the replay/offline labs. */
export interface OfflineQueuedView {
  readonly seq: number | undefined;
  readonly id: string;
  readonly emittedAt: string;
}

/** The full recovery picture for a user: emissions, buffer window, and queue. */
export interface ReplayTimelineView {
  readonly userId: string;
  readonly replayBufferSize: number;
  readonly emissions: readonly ReplayTimelineEntry[];
  readonly retainedSeqs: readonly number[];
  readonly evictedSeqs: readonly number[];
  readonly offlineQueued: readonly OfflineQueuedView[];
}

/** Replay lab endpoints: numbered burst, drop, and the recovery timeline. */
export const replayLabApi = {
  emitBurst: (count: number): Promise<{ emitted: number }> =>
    post('/labs/replay/emit-burst', { count }),
  drop: (): Promise<{ dropped: number }> => post('/labs/replay/drop'),
  timeline: (userId: string): Promise<ReplayTimelineView> =>
    get(`/labs/replay/timeline?userId=${encodeURIComponent(userId)}`),
};

/** Tenant presence roster endpoint. */
export const presenceApi = {
  roster: (tenantId: string): Promise<{ tenantId: string; online: readonly string[] }> =>
    get(`/presence/${encodeURIComponent(tenantId)}`),
};

/** Offline-queue lab endpoints: enqueue for an absent user, peek, acknowledge. */
export const offlineLabApi = {
  emit: (userId: string, count: number): Promise<{ emitted: number }> =>
    post('/labs/offline/emit', { userId, count }),
  peek: (userId: string): Promise<{ userId: string; events: readonly OfflineQueuedView[] }> =>
    get(`/labs/offline/peek?userId=${encodeURIComponent(userId)}`),
  acknowledge: (upToId: string): Promise<{ acknowledged: true }> =>
    post('/labs/offline/ack', { upToId }),
};

/** How many times one user's credentials were actually revalidated. */
export interface RevalidationCount {
  readonly userId: string;
  readonly revalidations: number;
}

/** Acknowledgement returned by a revocation change. */
export interface RevocationAck {
  readonly userId: string;
  readonly revoked: boolean;
}

/** Reauthentication lab endpoints: the revocation switch and the revalidation counters. */
export const reauthLabApi = {
  stats: (): Promise<{ revalidations: readonly RevalidationCount[] }> => get('/labs/reauth/stats'),
  revoke: (userId: string): Promise<RevocationAck> =>
    post(`/auth/revoke/${encodeURIComponent(userId)}`),
  restore: (userId: string): Promise<RevocationAck> =>
    del(`/auth/revoke/${encodeURIComponent(userId)}`),
};

/** The realtime wiring the library resolved at boot, as reported by the api. */
export interface RealtimeWiringSnapshot {
  readonly instanceId: string;
  readonly transport: string;
  readonly transportKind: string;
  readonly sse: {
    readonly endpoint: string;
    readonly heartbeatMs: number;
    readonly replayBufferSize: number;
    readonly maxConnectionsPerUser: number;
    readonly emitConnectionEvent: boolean;
  } | null;
  readonly websocket?: Record<string, unknown> | null;
  readonly providers: {
    readonly authenticator: string | null;
    readonly hooks: string | null;
    readonly pubsub: string | null;
    readonly presence: string | null;
  };
}

/** Resource-room membership endpoints backing the incident chat. */
export const roomsApi = {
  join: (
    connectionId: string,
    resourceType: string,
    resourceId: string,
  ): Promise<{ roomId: string; joined: true }> =>
    post('/rooms/join', { connectionId, resourceType, resourceId }),
  leave: (
    connectionId: string,
    resourceType: string,
    resourceId: string,
  ): Promise<{ roomId: string; left: true }> =>
    post('/rooms/leave', { connectionId, resourceType, resourceId }),
  mine: (connectionId: string): Promise<{ connectionId: string; rooms: readonly string[] }> =>
    get(`/rooms/mine?connectionId=${encodeURIComponent(connectionId)}`),
};

export { ApiError };
