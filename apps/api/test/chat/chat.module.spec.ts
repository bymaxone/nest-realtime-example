/**
 * Unit tests for ChatModule provider gating.
 *
 * Layer: unit.
 * Goal: the chat gateway is registered for the WebSocket and composite profiles and
 *       registered for neither under SSE, so under SSE no client-to-server handler
 *       is bound and no Socket.IO server is started.
 * Mocks: none; the exported gating function and the module metadata are inspected.
 */

import 'reflect-metadata';

import { ChatGateway } from '../../src/chat/chat.gateway';
import { chatGatewayProviders, ChatModule } from '../../src/chat/chat.module';

describe('chatGatewayProviders', () => {
  /**
   * SSE no-op.
   *
   * Under SSE the gateway must not be registered, which is how the chat handler is
   * inert under SSE: with no gateway there is nothing to bind and Socket.IO never
   * boots.
   */
  it('registers no chat gateway for the SSE profile', () => {
    expect(chatGatewayProviders('sse')).toEqual([]);
  });

  /**
   * WebSocket profile.
   *
   * The websocket profile must register the gateway so client-to-server chat is
   * handled.
   */
  it('registers the chat gateway for the websocket profile', () => {
    expect(chatGatewayProviders('websocket')).toEqual([ChatGateway]);
  });

  /**
   * Composite profile.
   *
   * The `both` profile also serves WebSocket clients, so it must register the
   * gateway.
   */
  it('registers the chat gateway for the both profile', () => {
    expect(chatGatewayProviders('both')).toEqual([ChatGateway]);
  });
});

describe('ChatModule', () => {
  /**
   * Default boot is inert.
   *
   * With no `REALTIME_TRANSPORT` in the environment the module boots under SSE, so
   * its provider list must be empty, proving the chat gateway is not bound during
   * an SSE boot of the application.
   */
  it('registers no providers when booted under the default SSE profile', () => {
    const providers: unknown[] = (Reflect.getMetadata('providers', ChatModule) ?? []) as unknown[];

    expect(providers).toEqual([]);
  });
});
