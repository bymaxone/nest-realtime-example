/**
 * @fileoverview Scoped process-environment overrides for end-to-end boots.
 * @layer test-support
 *
 * A suite that boots the app under a specific profile (offline queue on, reauth
 * pushed far into the future) sets the env before `createApp` reads it, then
 * restores the prior values so no later suite inherits the override.
 */

/**
 * Apply environment overrides and return a restore function.
 *
 * @param vars - The variables to set for the boot.
 * @returns A function that restores every variable to its prior value.
 */
export function setEnv(vars: Record<string, string>): () => void {
  const saved = Object.keys(vars).map((key) => [key, process.env[key]] as const);
  for (const [key, value] of Object.entries(vars)) {
    process.env[key] = value;
  }
  return () => {
    for (const [key, previous] of saved) {
      if (previous === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous;
      }
    }
  };
}
