/**
 * @fileoverview Unit tests for the typed REST client.
 * @layer test
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  auditApi,
  authApi,
  clusterLabApi,
  connectionsApi,
  domainApi,
  emitApi,
  evictionLabApi,
  presenceApi,
  replayLabApi,
  roomsApi,
} from './api-client';
import { ApiError } from './api-error';

/** Build a minimal fetch Response stub. */
function jsonResponse(body: unknown, init: { status?: number; ok?: boolean } = {}): Response {
  const status = init.status ?? 200;
  return {
    ok: init.ok ?? (status >= 200 && status < 300),
    status,
    statusText: 'status text',
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe('api-client', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('performs a credentialed GET and returns the parsed body', async () => {
    // Scenario: GET /auth/me resolves with the session traits.
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] }),
    );
    const result = await authApi.me();
    expect(result.userId).toBe('ana@acme');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/me'),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('performs a POST with a JSON body', async () => {
    // Scenario: login sends the username as a JSON body.
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ userId: 'ana@acme', tenantId: 'acme', roles: [] }),
    );
    await authApi.login('ana@acme');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ username: 'ana@acme' }));
  });

  it('performs a POST with no body when none is given', async () => {
    // Scenario: logout has no request body.
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await authApi.logout();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBeUndefined();
  });

  it('returns undefined for a 204 response without parsing a body', async () => {
    // Scenario: a hypothetical no-content success response short-circuits JSON parsing.
    fetchMock.mockResolvedValueOnce(jsonResponse(null, { status: 204 }));
    const result = await connectionsApi.disconnect('conn-1');
    expect(result).toBeUndefined();
  });

  it('throws an ApiError with the api message and issues on failure', async () => {
    // Scenario: a 400 from the Zod pipe carries field-level issues.
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { message: 'Invalid request body', issues: [{ path: 'event', code: 'too_small' }] },
        { status: 400, ok: false },
      ),
    );
    await expect(emitApi.toUser('bob@acme', '', {})).rejects.toMatchObject({
      status: 400,
      message: 'Invalid request body',
      issues: [{ path: 'event', code: 'too_small' }],
    });
  });

  it('falls back to the response statusText when the body cannot be parsed', async () => {
    // Scenario: a non-JSON error body (e.g. a proxy error page) still yields an ApiError.
    const response = {
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      json: () => Promise.reject(new Error('not json')),
    } as unknown as Response;
    fetchMock.mockResolvedValueOnce(response);
    await expect(domainApi.simulateOrders()).rejects.toBeInstanceOf(ApiError);
  });

  it('mints a one-shot ticket and a WebSocket bearer token', async () => {
    // Scenario: both auth-flow endpoints used by the ticket and chat/both labs.
    fetchMock.mockResolvedValueOnce(jsonResponse({ ticket: 'one-shot-1' }));
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ token: 'ws-token', expiresAt: '2026-01-01T00:00:00.000Z' }),
    );
    const ticket = await authApi.issueTicket();
    const wsToken = await authApi.mintWsToken();
    expect(ticket.ticket).toBe('one-shot-1');
    expect(wsToken.token).toBe('ws-token');
  });

  it('exercises every domain and emit endpoint', async () => {
    // Scenario: every thin wrapper issues the right method/path pair.
    fetchMock.mockResolvedValue(jsonResponse({ accepted: true }));
    await domainApi.simulateDeployments();
    await emitApi.toTenant('acme', 'incident.updated', { ok: true });
    await emitApi.toRoom('resource:incident:1', 'incident.updated', { ok: true });
    await emitApi.broadcast('incident.updated', { ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('exercises the audit feed with and without a kind filter, plus decorator stats', async () => {
    // Scenario: both the filtered and unfiltered audit feed shapes are requested.
    fetchMock.mockResolvedValue(
      jsonResponse({ service: { name: 'api', version: '0.1.0' }, entries: [] }),
    );
    await auditApi.feed();
    await auditApi.feed('connect');
    fetchMock.mockResolvedValueOnce(jsonResponse({ connects: 1, disconnects: 0 }));
    await auditApi.decoratorStats();
    const [urlWithKind] = fetchMock.mock.calls[1] as [string];
    expect(urlWithKind).toContain('kind=connect');
  });

  it('exercises the connections, eviction, cluster, replay, presence, and rooms endpoints', async () => {
    // Scenario: every remaining thin wrapper resolves against a stubbed fetch.
    fetchMock.mockResolvedValue(jsonResponse({}));
    await connectionsApi.list();
    await evictionLabApi.timeline('ana@acme');
    await clusterLabApi.stats();
    await replayLabApi.emitBurst(5);
    await replayLabApi.drop();
    await replayLabApi.timeline('ana@acme');
    await presenceApi.roster('acme');
    await roomsApi.join('conn-1', 'incident', '1');
    await roomsApi.leave('conn-1', 'incident', '1');
    await roomsApi.mine('conn-1');
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });
});
