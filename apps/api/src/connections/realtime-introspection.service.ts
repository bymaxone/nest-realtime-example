/**
 * @fileoverview Read-only introspection of the resolved realtime wiring.
 * @layer connections
 *
 * The library provides its resolved configuration and collaborators through
 * exported Symbol DI tokens (`REALTIME_OPTIONS_TOKEN`, `REALTIME_TRANSPORT_TOKEN`,
 * `REALTIME_INSTANCE_ID_TOKEN`, `REALTIME_AUTHENTICATOR_TOKEN`,
 * `REALTIME_HOOKS_TOKEN`, `REALTIME_PUBSUB_TOKEN`, `REALTIME_PRESENCE_TOKEN`), all
 * exported by its `@Global` module. This service injects them to surface a
 * client-safe snapshot of what the module actually resolved at boot: the transport
 * mode and the transport kind the library selected, the scalar SSE tunables, and
 * the class names of the authenticator, hooks, pub/sub bus and presence storage the
 * example handed the library. It reads only scalar fields and constructor names, so
 * no authenticator secret, hook closure or live connection metadata ever leaves the
 * process. Presence is `undefined` under the single-instance memory profile, so its
 * token is injected optionally.
 */

import {
  type BymaxRealtimeModuleOptions,
  type IConnectionAuthenticator,
  type IConnectionLifecycleHooks,
  type IPresenceStorage,
  type IRealtimePubSub,
  type ITransport,
  REALTIME_AUTHENTICATOR_TOKEN,
  REALTIME_HOOKS_TOKEN,
  REALTIME_INSTANCE_ID_TOKEN,
  REALTIME_OPTIONS_TOKEN,
  REALTIME_PRESENCE_TOKEN,
  REALTIME_PUBSUB_TOKEN,
  REALTIME_TRANSPORT_TOKEN,
  type TransportMode,
} from '@bymax-one/nest-realtime';
import { Inject, Injectable, Optional } from '@nestjs/common';

/** Client-safe view of the resolved SSE tunables. */
export interface RealtimeSseSnapshot {
  readonly endpoint: string | null;
  readonly heartbeatMs: number | null;
  readonly replayBufferSize: number | null;
  readonly maxConnectionsPerUser: number | null;
  readonly emitConnectionEvent: boolean | null;
}

/** Class names of the collaborators the example wired into the library. */
export interface RealtimeProvidersSnapshot {
  readonly authenticator: string;
  readonly hooks: string;
  readonly pubsub: string;
  readonly presence: string | null;
}

/** Client-safe snapshot of the resolved realtime wiring. */
export interface RealtimeWiringSnapshot {
  readonly instanceId: string;
  readonly transport: TransportMode;
  readonly transportKind: ITransport['kind'];
  readonly sse: RealtimeSseSnapshot | null;
  readonly providers: RealtimeProvidersSnapshot;
}

/** Surfaces the resolved realtime wiring through the library's DI tokens. */
@Injectable()
export class RealtimeIntrospectionService {
  /**
   * Build the introspection service from the library's exported DI tokens.
   *
   * @param options - The resolved module options (`REALTIME_OPTIONS_TOKEN`).
   * @param transport - The resolved transport (`REALTIME_TRANSPORT_TOKEN`).
   * @param instanceId - The resolved instance id (`REALTIME_INSTANCE_ID_TOKEN`).
   * @param authenticator - The wired authenticator (`REALTIME_AUTHENTICATOR_TOKEN`).
   * @param hooks - The wired lifecycle hooks (`REALTIME_HOOKS_TOKEN`).
   * @param pubsub - The wired pub/sub bus (`REALTIME_PUBSUB_TOKEN`).
   * @param presence - The wired presence storage, absent in memory mode
   *   (`REALTIME_PRESENCE_TOKEN`).
   */
  constructor(
    @Inject(REALTIME_OPTIONS_TOKEN) private readonly options: BymaxRealtimeModuleOptions,
    @Inject(REALTIME_TRANSPORT_TOKEN) private readonly transport: ITransport,
    @Inject(REALTIME_INSTANCE_ID_TOKEN) private readonly instanceId: string,
    @Inject(REALTIME_AUTHENTICATOR_TOKEN) private readonly authenticator: IConnectionAuthenticator,
    @Inject(REALTIME_HOOKS_TOKEN) private readonly hooks: IConnectionLifecycleHooks,
    @Inject(REALTIME_PUBSUB_TOKEN) private readonly pubsub: IRealtimePubSub,
    @Optional() @Inject(REALTIME_PRESENCE_TOKEN) private readonly presence?: IPresenceStorage,
  ) {}

  /**
   * Snapshot the resolved realtime wiring for operator introspection.
   *
   * @returns The client-safe {@link RealtimeWiringSnapshot}.
   */
  snapshot(): RealtimeWiringSnapshot {
    return {
      instanceId: this.instanceId,
      transport: this.options.transport,
      transportKind: this.transport.kind,
      sse: this.sseSnapshot(),
      providers: {
        authenticator: this.authenticator.constructor.name,
        hooks: this.hooks.constructor.name,
        pubsub: this.pubsub.constructor.name,
        presence: this.presence ? this.presence.constructor.name : null,
      },
    };
  }

  /**
   * Project the resolved SSE options to their client-safe scalars.
   *
   * @returns The SSE snapshot, or `null` when the profile carries no SSE block.
   */
  private sseSnapshot(): RealtimeSseSnapshot | null {
    const sse = this.options.sse;
    if (sse === undefined) {
      return null;
    }
    return {
      endpoint: sse.endpoint ?? null,
      heartbeatMs: sse.heartbeatMs ?? null,
      replayBufferSize: sse.replayBufferSize ?? null,
      maxConnectionsPerUser: sse.maxConnectionsPerUser ?? null,
      emitConnectionEvent: sse.emitConnectionEvent ?? null,
    };
  }
}
