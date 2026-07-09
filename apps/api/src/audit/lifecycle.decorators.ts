/**
 * @fileoverview App-level `@OnConnect` / `@OnDisconnect` method decorators.
 * @layer audit
 *
 * The installed library exposes lifecycle behavior only through the single config
 * `hooks` option; it ships no method decorators. These app-level decorators
 * demonstrate the alternative ergonomic: a provider tags methods with
 * `@OnConnect()` / `@OnDisconnect()`, and a dispatcher (a config-hook consumer)
 * discovers and invokes them. Because the dispatcher runs after the cross-cutting
 * config hooks in the composite, the decorator handlers always fire last.
 *
 * Registration captures the decorated method at class-definition time (keyed by
 * the class), so no runtime reflection or dynamic property access is needed.
 */

import type { ConnectionEventMeta } from '@bymax-one/nest-realtime';

/** A connection lifecycle transition a decorated handler reacts to. */
export type LifecyclePhase = 'connect' | 'disconnect';

/** The shape every `@OnConnect` / `@OnDisconnect` method must satisfy. */
export type LifecycleHandler = (meta: ConnectionEventMeta) => void | Promise<void>;

/** A handler captured at decoration time, tagged with its phase. */
interface StoredHandler {
  readonly phase: LifecyclePhase;
  readonly fn: LifecycleHandler;
}

/** The decorator signature, narrowed to lifecycle-handler methods. */
type LifecycleDecorator = (
  target: object,
  propertyKey: string | symbol,
  descriptor: TypedPropertyDescriptor<LifecycleHandler>,
) => void;

/** Per-class registry of decorated handlers, keyed by the class constructor. */
const REGISTRY = new WeakMap<object, StoredHandler[]>();

/** Build a decorator that records the decorated method under the given phase. */
function decorate(phase: LifecyclePhase): LifecycleDecorator {
  return (target, _propertyKey, descriptor) => {
    // A method decorator always receives the method as `descriptor.value`.
    const fn = descriptor.value!;
    const existing = REGISTRY.get(target.constructor) ?? [];
    existing.push({ phase, fn });
    REGISTRY.set(target.constructor, existing);
  };
}

/**
 * Mark a method to run when a connection is established.
 *
 * @returns The method decorator.
 */
export function OnConnect(): LifecycleDecorator {
  return decorate('connect');
}

/**
 * Mark a method to run when a connection closes.
 *
 * @returns The method decorator.
 */
export function OnDisconnect(): LifecycleDecorator {
  return decorate('disconnect');
}

/**
 * Collect the handlers a provider registered for a phase, bound to the instance.
 *
 * @param instance - The provider whose decorated methods are collected.
 * @param phase - The lifecycle phase to collect.
 * @returns The instance-bound handler functions (empty when none are registered).
 */
export function collectHandlers(instance: object, phase: LifecyclePhase): LifecycleHandler[] {
  const stored = REGISTRY.get(instance.constructor) ?? [];
  return stored
    .filter((handler) => handler.phase === phase)
    .map((handler) => handler.fn.bind(instance));
}
