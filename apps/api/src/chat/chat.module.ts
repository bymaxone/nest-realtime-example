/**
 * @fileoverview Chat module: the incident-chat gateway, gated to WebSocket profiles.
 * @layer module
 *
 * The chat gateway is a client-to-server WebSocket handler, so it is meaningful
 * only when Socket.IO is booted. This module registers it for the `websocket` and
 * `both` profiles and registers nothing for the SSE profile, which is how the
 * "inert under SSE" property is realized: under SSE the gateway does not exist, so
 * no client-to-server handler is bound and no Socket.IO server is started. The
 * boot transport is read from the environment at module-definition time, the same
 * synchronous gating the realtime wiring uses for its transport hint.
 */

import type { TransportMode } from '@bymax-one/nest-realtime/shared';
import { Module, type Provider } from '@nestjs/common';

import { envSchema } from '../config/env.schema';
import { LifecycleModule } from '../lifecycle/lifecycle.module';

import { ChatGateway } from './chat.gateway';

/**
 * Select the chat providers for a transport: the gateway for the WebSocket and
 * composite profiles, nothing for the SSE profile.
 *
 * @param transport - The boot transport mode.
 * @returns The providers to register (the gateway, or an empty list under SSE).
 */
export function chatGatewayProviders(transport: TransportMode): Provider[] {
  return transport === 'sse' ? [] : [ChatGateway];
}

/** The boot transport, parsed from the environment before DI resolves. */
const BOOT_TRANSPORT = envSchema.shape.REALTIME_TRANSPORT.parse(process.env.REALTIME_TRANSPORT);

/** Wires the incident-chat gateway for the WebSocket and composite profiles. */
@Module({
  imports: [LifecycleModule],
  providers: chatGatewayProviders(BOOT_TRANSPORT),
})
export class ChatModule {}
