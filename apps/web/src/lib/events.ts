/**
 * @fileoverview The typed realtime event map every `useRealtime` call is generic over.
 * @layer lib
 *
 * Mirrors the event names and payload shapes the api emits (domain orders and
 * deployments, incident chat, the reserved connection/room/presence catalog, and
 * the replay/both labs). Kept as a hand-written literal map rather than an import
 * from `apps/api`: the two apps are independent workspace packages that only
 * share a contract through the published library, never through each other's
 * source, so this is the web-side source of truth for what a live event looks
 * like.
 *
 * `SSE_APPLICATION_EVENT_NAMES` lists every non-reserved event name a page needs
 * delivered over SSE. `EventSource` never routes a named event to the default
 * `onmessage` handler (see the library's `PRESENCE_EVENT_NAMES` doc comment), so
 * the shared `RealtimeProvider` connection passes this list as `events` to
 * subscribe to each of them explicitly.
 */

import {
  PRESENCE_EVENT_NAMES,
  RESERVED_EVENT_NAMES,
  type PublicConnectionMeta,
} from '@bymax-one/nest-realtime/shared';

/** Payload of an `order.*` lifecycle event. */
export interface OrderEventPayload {
  readonly orderId: string;
  readonly status: 'created' | 'paid' | 'shipped';
}

/** Payload of a `deployment.*` lifecycle event. */
export interface DeploymentEventPayload {
  readonly deploymentId: string;
  readonly status: 'queued' | 'running' | 'succeeded';
}

/** Payload of a `chat.message` incident-room event (WebSocket only). */
export interface ChatMessagePayload {
  readonly roomId: string;
  readonly from: string;
  readonly tenantId: string;
  readonly body: string;
  readonly at: string;
}

/** Payload of a numbered `lab.replay` burst event. */
export interface LabReplayPayload {
  readonly seq: number;
}

/** Payload of a `lab.both` split-screen demonstration event. */
export interface LabBothPayload {
  readonly nonce: string;
}

/** Payload of a numbered `lab.offline` event delivered from the durable queue. */
export interface LabOfflinePayload {
  readonly seq: number;
}

/** Payload of the reserved `connection:established` event. */
export interface ConnectionEstablishedPayload {
  readonly connectionId: string;
  readonly traits: Pick<PublicConnectionMeta, 'userId' | 'tenantId'> & {
    readonly roles: readonly string[];
  };
}

/** Payload of the reserved `connection:reauthentication-failed` event. */
export interface ReauthFailedPayload {
  readonly reason: string;
}

/** Payload of a `presence:online` / `presence:offline` event. */
export interface PresencePayload {
  readonly userId: string;
}

/** Payload of a `room:joined` / `room:left` event. */
export interface RoomMembershipPayload {
  readonly roomId: string;
}

/**
 * The full typed event map shared by every `useRealtime`/`useRealtimeConnection`
 * call in this app. Keys are the wire event names; values are their payload shape.
 */
export interface LiveEvents {
  'order.created': OrderEventPayload;
  'order.paid': OrderEventPayload;
  'order.shipped': OrderEventPayload;
  'deployment.queued': DeploymentEventPayload;
  'deployment.running': DeploymentEventPayload;
  'deployment.succeeded': DeploymentEventPayload;
  'chat.message': ChatMessagePayload;
  'lab.replay': LabReplayPayload;
  'lab.both': LabBothPayload;
  'lab.offline': LabOfflinePayload;
  'connection:established': ConnectionEstablishedPayload;
  'connection:reauthentication-failed': ReauthFailedPayload;
  'connection:credential-expiring': ReauthFailedPayload;
  'presence:online': PresencePayload;
  'presence:offline': PresencePayload;
  'room:joined': RoomMembershipPayload;
  'room:left': RoomMembershipPayload;
}

/**
 * Non-reserved, application-level SSE event names a page may need delivered.
 *
 * Passed as the library hook's `events` option so the shared connection
 * subscribes to each with a dedicated `addEventListener`, matching how the
 * library itself pre-registers the reserved and presence catalog.
 */
export const SSE_APPLICATION_EVENT_NAMES: readonly string[] = [
  'order.created',
  'order.paid',
  'order.shipped',
  'deployment.queued',
  'deployment.running',
  'deployment.succeeded',
  'lab.replay',
  'lab.both',
  'lab.offline',
];

/**
 * The presence transition names, as a set for membership checks.
 *
 * The library pre-registers these listeners itself, so they never belong in
 * {@link SSE_APPLICATION_EVENT_NAMES}; the roster page uses this set to decide
 * when an observed event should re-read the REST snapshot.
 */
export const PRESENCE_EVENT_NAME_SET: ReadonlySet<string> = new Set(
  Object.values(PRESENCE_EVENT_NAMES),
);

/**
 * The reserved event the library emits when a periodic revalidation fails.
 *
 * Taken from the library's own catalog rather than retyped, so the reauth lab can
 * never drift from the name actually sent on the wire.
 */
export const REAUTH_FAILED_EVENT_NAME: string = RESERVED_EVENT_NAMES.CONNECTION_REAUTH_FAILED;

/** The minimal shape `EventInspector` renders: a wire event name and its payload. */
export interface InspectorEntry {
  readonly type: string;
  readonly data: unknown;
  readonly id?: string;
}

/** The union shape returned by `useRealtime`'s `events` array on either transport branch. */
type HookEventEntry = { readonly type: PropertyKey; readonly data: unknown; readonly id?: string };

/**
 * Project a `useRealtime` events array onto {@link EventInspector}'s input shape.
 *
 * The hook's `id` field is present on the SSE branch and absent on the WebSocket
 * branch; this narrows it safely with an `in` check instead of an unsafe cast.
 *
 * @param events - The accumulated events from `useRealtime`/`useRealtimeContext`.
 * @returns The events projected onto `{ type, data, id? }`.
 */
export function toInspectorEntries(events: readonly HookEventEntry[]): readonly InspectorEntry[] {
  return events.map((entry) => ({
    type: String(entry.type),
    data: entry.data,
    ...('id' in entry && entry.id !== undefined ? { id: entry.id } : {}),
  }));
}
