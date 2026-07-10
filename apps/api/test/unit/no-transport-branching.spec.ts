/**
 * Meta test: application services never branch on the configured transport.
 *
 * Layer: unit (static source scan).
 * Goal: prove the dual-transport promise structurally. Only the wiring/config layer
 *       (and the transport-aware auth dispatch) may compare a transport literal; no
 *       application service does, so switching REALTIME_TRANSPORT changes zero
 *       service code. The runtime parity specs prove the same behaviorally.
 * Mocks: none; the scan reads the source files as text.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** The application source root, resolved from this spec's location. */
const SRC_DIR = join(__dirname, '..', '..', 'src');

/** A comparison against a transport literal (`=== 'sse'`, `!== 'websocket'`, ...). */
const TRANSPORT_COMPARISON = /(===|!==)\s*['"](sse|websocket|both)['"]/u;

/**
 * Files permitted to compare a transport literal, each for a wiring, config or
 * transport-aware auth reason rather than an application-service behavior change.
 */
const ALLOWED: ReadonlySet<string> = new Set<string>([
  'main.ts', // bootstrap: registers the WebSocket adapter for non-SSE profiles
  'realtime/options.factory.ts', // config wiring: builds the transport-specific options
  'chat/chat.module.ts', // config wiring: gates the chat gateway to WebSocket profiles
  'auth/bearer.authenticator.ts', // auth pattern: bearer authenticates only WebSocket handshakes
  'auth/composite.authenticator.ts', // auth dispatch: routes a WebSocket handshake to the bearer path
]);

/**
 * Recursively collect every TypeScript source file under a directory.
 *
 * @param dir - The directory to walk.
 * @returns Absolute paths of every `.ts` file found.
 */
function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectSourceFiles(full));
    else if (entry.name.endsWith('.ts')) files.push(full);
  }
  return files;
}

/** The `src`-relative, forward-slash path of a source file. */
function toRelative(file: string): string {
  return relative(SRC_DIR, file).split(sep).join('/');
}

describe('no transport branching in application services', () => {
  /**
   * Structural parity guard.
   *
   * The scan must be live (the known wiring and auth files are detected) and no
   * file outside that allowed set may compare a transport literal, so a future
   * service that branches on the transport fails this test.
   */
  it('confines transport-literal comparisons to the wiring and auth layers', () => {
    const withComparison = collectSourceFiles(SRC_DIR)
      .filter((file) => TRANSPORT_COMPARISON.test(readFileSync(file, 'utf8')))
      .map(toRelative);

    expect(withComparison).toEqual(expect.arrayContaining([...ALLOWED]));
    expect(withComparison.filter((rel) => !ALLOWED.has(rel))).toEqual([]);
  });
});
