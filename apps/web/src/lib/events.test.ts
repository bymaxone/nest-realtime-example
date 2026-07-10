/**
 * @fileoverview Unit tests for the `LiveEvents` map helpers.
 * @layer test
 */

import { describe, expect, it } from 'vitest';

import { SSE_APPLICATION_EVENT_NAMES, toInspectorEntries } from './events';

describe('SSE_APPLICATION_EVENT_NAMES', () => {
  it('lists every non-reserved event name the pages need delivered over SSE', () => {
    // Scenario: the provider forwards this exact list to the hook's `events` option.
    expect(SSE_APPLICATION_EVENT_NAMES).toContain('order.created');
    expect(SSE_APPLICATION_EVENT_NAMES).toContain('lab.both');
  });
});

describe('toInspectorEntries', () => {
  it('projects an SSE-shaped entry (with id) onto the inspector shape', () => {
    // Scenario: an SSE event entry carries a real Last-Event-ID.
    const result = toInspectorEntries([
      { type: 'order.created', data: { orderId: '1' }, id: '42' },
    ]);
    expect(result).toEqual([{ type: 'order.created', data: { orderId: '1' }, id: '42' }]);
  });

  it('projects a WebSocket-shaped entry (no id) without adding one', () => {
    // Scenario: a WebSocket event entry has no `id` field at all.
    const result = toInspectorEntries([{ type: 'chat.message', data: { body: 'hi' } }]);
    expect(result).toEqual([{ type: 'chat.message', data: { body: 'hi' } }]);
    expect(result[0]).not.toHaveProperty('id');
  });

  it('stringifies a non-string type key', () => {
    // Scenario: `TEvents` default of `Record<string, unknown>` still yields string keys.
    const result = toInspectorEntries([{ type: 'presence:online', data: { userId: 'u1' } }]);
    expect(result[0]?.type).toBe('presence:online');
  });
});
