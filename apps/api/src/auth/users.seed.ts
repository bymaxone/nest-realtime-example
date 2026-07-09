/**
 * @fileoverview Frozen demo users spanning two tenants.
 * @layer auth
 *
 * The example ships fixed demo identities (never a real user store) so the
 * tenant-isolation scenarios have stable, known principals: `acme` and `globex`
 * each own users with distinct roles.
 */

/** A demo principal: its login id, owning tenant and roles. */
export interface DemoUser {
  readonly id: string;
  readonly tenantId: string;
  readonly roles: readonly string[];
}

/** The immutable set of demo users the login endpoint accepts. */
export const DEMO_USERS: readonly DemoUser[] = Object.freeze([
  Object.freeze({ id: 'ana@acme', tenantId: 'acme', roles: Object.freeze(['admin']) }),
  Object.freeze({ id: 'bob@acme', tenantId: 'acme', roles: Object.freeze(['member']) }),
  Object.freeze({ id: 'gil@globex', tenantId: 'globex', roles: Object.freeze(['admin']) }),
]);

/**
 * Find a demo user by its login id.
 *
 * @param username - The login id submitted to `POST /auth/login`.
 * @returns The matching {@link DemoUser}, or `undefined` when unknown.
 */
export function findDemoUser(username: string): DemoUser | undefined {
  return DEMO_USERS.find((user) => user.id === username);
}
