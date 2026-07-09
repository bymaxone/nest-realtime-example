/**
 * @fileoverview Dependency-injection tokens for the auth module.
 * @layer auth
 *
 * Symbol tokens keep the Redis client and the revocation store unambiguous and
 * force every consumer to inject them explicitly rather than by a string name.
 */

/** Injection token for the shared ioredis client. */
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/** Injection token for the {@link IRevocationStore} implementation. */
export const REVOCATION_STORE = Symbol('REVOCATION_STORE');
