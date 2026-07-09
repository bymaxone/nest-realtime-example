/**
 * @fileoverview Dependency-injection token for the frozen application config.
 * @layer config
 *
 * A Symbol token keeps the configuration provider unambiguous and collision-free
 * across the container, and forces every consumer to inject it explicitly rather
 * than resolving it by a stringly-typed name.
 */

/**
 * Injection token for the frozen {@link AppConfig}. Inject it with
 * `@Inject(APP_CONFIG)` and type the parameter as `AppConfig`.
 */
export const APP_CONFIG = Symbol('APP_CONFIG');
