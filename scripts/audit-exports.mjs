#!/usr/bin/env node
/**
 * @fileoverview Export-usage audit for `@bymax-one/nest-realtime`.
 * @layer tooling
 *
 * Proves the example exercises the whole library: it reads the installed library's
 * `exports` map, extracts every named export from each subpath's type declaration,
 * and asserts each symbol is referenced somewhere in the example source. A symbol
 * with zero references fails the audit unless it is listed in JUSTIFIED_EXCEPTIONS
 * with a reason a spec section sanctions (internal transports the library resolves
 * from config and consumes through the module, the `useClass` async-options
 * interface the example does not use, and the type/return-type projections of
 * runtime constants and hooks that are exercised by value). Run with
 * `pnpm audit:exports`; exit code 1 means an unjustified unused export.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const LIB_NAME = '@bymax-one/nest-realtime';
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SEARCH_DIRS = ['apps/api/src', 'apps/api/test', 'apps/web/src', 'apps/web/scripts'];

/**
 * Resolve the installed library's package root from the api workspace, walking up
 * from its resolved entry point to the directory whose package.json names it.
 *
 * @returns The absolute path to the library package root.
 */
function resolveLibDir() {
  const require = createRequire(resolve(REPO_ROOT, 'apps/api/package.json'));
  let dir = dirname(require.resolve(LIB_NAME));
  while (dir !== dirname(dir)) {
    const manifest = resolve(dir, 'package.json');
    if (existsSync(manifest)) {
      const parsed = JSON.parse(readFileSync(manifest, 'utf8'));
      if (parsed.name === LIB_NAME) {
        return dir;
      }
    }
    dir = dirname(dir);
  }
  throw new Error(`Unable to locate the installed ${LIB_NAME} package root.`);
}

const LIB_DIR = resolveLibDir();

/**
 * Symbols the library exports that the example does not reference by name, each with
 * a spec-sanctioned reason. Keyed by symbol name (subpath-independent).
 */
const JUSTIFIED_EXCEPTIONS = {
  CompositeTransport:
    'Internal transport the library composes for `transport: "both"`; consumed indirectly through the module (spec §4.1).',
  WebSocketTransport:
    'Internal transport the library boots for the WebSocket profile; consumed indirectly through the module (spec §4.1).',
  RealtimeGateway:
    'Internal Socket.IO gateway the library registers for the WebSocket profile; consumed indirectly through the module (spec §4.1).',
  BymaxRealtimeModuleOptionsFactory:
    'The `useClass` async-options interface; the example wires options via `useFactory` (spec §9.2), so the `useClass` counterpart is intentionally unused.',
  RealtimeErrorCode:
    "Union projection of the runtime `REALTIME_ERROR_CODES` constant, which the example exercises (spec §7.9); the alias types the library's own error surface.",
  RoomPrefix:
    "Value projection of the runtime `ROOM_PREFIXES` constant, which the example exercises through `composeRoomId` (spec §7.4); internal to the library's room-id typing.",
  PresenceEventName:
    "Value projection of the runtime `PRESENCE_EVENT_NAMES` constant, which the example exercises (spec §4.2); internal to the library's presence event typing.",
  UsePresenceReturn:
    'Inferred return type of the `usePresence` hook the presence page consumes structurally (spec §4.2, §13.2); referenced by inference, not by name.',
};

/**
 * Read the library's `exports` map and resolve each subpath to its `.d.ts` file.
 *
 * @returns The ordered subpath-to-declaration map.
 */
function readSubpaths() {
  const pkg = JSON.parse(readFileSync(resolve(LIB_DIR, 'package.json'), 'utf8'));
  const subpaths = [];
  for (const [subpath, entry] of Object.entries(pkg.exports ?? {})) {
    const types = typeof entry === 'object' && entry !== null ? entry.types : undefined;
    if (typeof types === 'string') {
      subpaths.push({ subpath, dts: resolve(LIB_DIR, types) });
    }
  }
  return subpaths;
}

/**
 * Extract every named export from a `.d.ts` file's `export { ... }` statements.
 *
 * Strips `type ` modifiers and resolves `Local as Exported` to the exported name.
 *
 * @param dtsPath - Absolute path to the declaration file.
 * @returns The sorted list of exported names.
 */
function extractExports(dtsPath) {
  const source = readFileSync(dtsPath, 'utf8');
  const names = new Set();
  const blockPattern = /export\s*(?:type\s*)?\{([^}]*)\}/g;
  let match;
  while ((match = blockPattern.exec(source)) !== null) {
    for (const raw of match[1].split(',')) {
      const entry = raw.trim();
      if (entry.length === 0) {
        continue;
      }
      const withoutType = entry.replace(/^type\s+/, '');
      const parts = withoutType.split(/\s+as\s+/);
      const exported = (parts.length === 2 ? parts[1] : parts[0]).trim();
      if (/^[A-Za-z_$][\w$]*$/.test(exported)) {
        names.add(exported);
      }
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

/**
 * Report whether a symbol is referenced as a whole word in the example source.
 *
 * @param symbol - The exported symbol name.
 * @returns True when at least one source file references it.
 */
function isReferenced(symbol) {
  try {
    execFileSync(
      'grep',
      [
        '-rIlw',
        '--exclude-dir=node_modules',
        '--include=*.ts',
        '--include=*.tsx',
        '--include=*.mjs',
        symbol,
        ...SEARCH_DIRS,
      ],
      { cwd: REPO_ROOT, stdio: 'pipe' },
    );
    return true;
  } catch (error) {
    // grep exits 1 when there are no matches: a genuine "not referenced".
    if (error.status === 1) {
      return false;
    }
    // Exit 2 (grep error) or ENOENT (grep missing from PATH) are real failures;
    // surfacing them avoids a misleading cascade of unused-export reports.
    throw new Error(`grep failed while searching for "${symbol}": ${error.message}`, {
      cause: error,
    });
  }
}

/**
 * Run the audit: print a per-subpath table and exit non-zero on any unjustified
 * unused export.
 *
 * @returns The process exit code.
 */
function main() {
  const subpaths = readSubpaths();
  let unjustified = 0;
  let referenced = 0;
  let excepted = 0;
  let total = 0;

  for (const { subpath, dts } of subpaths) {
    console.log(`\nSubpath "${subpath}"`);
    for (const symbol of extractExports(dts)) {
      total += 1;
      if (isReferenced(symbol)) {
        referenced += 1;
        console.log(`  [used]      ${symbol}`);
      } else if (symbol in JUSTIFIED_EXCEPTIONS) {
        excepted += 1;
        console.log(`  [exception] ${symbol} - ${JUSTIFIED_EXCEPTIONS[symbol]}`);
      } else {
        unjustified += 1;
        console.log(`  [UNUSED]    ${symbol} (no reference and no justified exception)`);
      }
    }
  }

  console.log(
    `\nSummary: ${total} exports across ${subpaths.length} subpaths - ${referenced} referenced, ${excepted} justified exceptions, ${unjustified} unjustified.`,
  );
  if (unjustified > 0) {
    console.error(
      `\nExport audit FAILED: ${unjustified} export(s) are neither referenced nor justified.`,
    );
    return 1;
  }
  console.log('\nExport audit PASSED: every library export is referenced or justified.');
  return 0;
}

process.exit(main());
